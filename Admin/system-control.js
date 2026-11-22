
(() => {
    "use strict";

    /* ==========================================
       TALVORA GLOBAL PLATFORM CONTROL
       ========================================== */

    const DEFAULT_ENDPOINTS = {
        dashboard: "/api/platform-control/dashboard",
        settings: "/api/platform-control/settings",
        features: "/api/platform-control/features",
        systemStatus: "/api/platform-control/system/status",
        systemActions: "/api/platform-control/system/actions",
        maintenance: "/api/platform-control/system/maintenance",
        jurisdictions: "/api/platform-control/localization/jurisdictions",
        localizationSummary: "/api/platform-control/localization/summary",
        integrations: "/api/platform-control/integrations",
        integrationActivity: "/api/platform-control/integrations/activity",
        applications: "/api/platform-control/api-applications",
        apiUsage: "/api/platform-control/api-usage",
        notifications: "/api/platform-control/notifications/config",
        templates: "/api/platform-control/notifications/templates",
        branding: "/api/platform-control/branding",
        health: "/api/platform-control/health",
        history: "/api/platform-control/history",
        exports: "/api/platform-control/exports"
    };

    const supplied = window.TALVORA_SYSTEM_CONFIG || {};

    const CONFIG = {
        apiBaseUrl: document.documentElement.dataset.apiBase || "",
        timeout: 20000,
        refreshInterval: 30000,
        pageSize: 25,
        endpoints: {
            ...DEFAULT_ENDPOINTS,
            ...(supplied.endpoints || {})
        },
        ...supplied
    };

    CONFIG.endpoints = {
        ...DEFAULT_ENDPOINTS,
        ...(supplied.endpoints || {})
    };

    const state = {
        features: [],
        jurisdictions: [],
        integrations: [],
        applications: [],
        health: null,
        pendingAction: null,
        refreshTimer: null,
        originalSettings: null,
        originalBranding: null
    };

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        [...root.querySelectorAll(selector)];

    /* ==========================================
       UTILITIES
       ========================================== */

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function humanize(value) {
        if (!value) return "—";

        return String(value)
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());
    }

    function formatNumber(value) {
        if (value === null || value === undefined) return "—";

        const parsed = Number(value);

        return Number.isFinite(parsed)
            ? new Intl.NumberFormat().format(parsed)
            : "—";
    }

    function formatDate(value) {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return String(value);

        return new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(date);
    }

    function safeColor(value, fallback) {
        return /^#[0-9a-f]{6}$/i.test(String(value || ""))
            ? value
            : fallback;
    }

    function endpoint(path) {
        return CONFIG.apiBaseUrl.replace(/\/+$/, "") +
            (path.startsWith("/") ? path : `/${path}`);
    }

    function buildQuery(params = {}) {
        const search = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value !== "" && value !== null && value !== undefined) {
                search.set(key, value);
            }
        });

        const result = search.toString();

        return result ? `?${result}` : "";
    }

    function getRecords(payload, ...keys) {
        if (Array.isArray(payload)) return payload;

        const source =
            payload?.data && !Array.isArray(payload.data)
                ? payload.data
                : payload;

        for (const key of keys) {
            if (Array.isArray(source?.[key])) return source[key];
            if (Array.isArray(payload?.[key])) return payload[key];
        }

        return [];
    }

    function getData(payload) {
        return payload?.data ?? payload ?? {};
    }

    function getField(object, camel, snake) {
        return object?.[camel] ?? object?.[snake];
    }

    function isTrue(value) {
        return value === true || value === 1 || value === "true";
    }

    function badge(value) {
        const status = String(value || "unknown").toLowerCase();

        return `
      <span class="badge ${escapeHTML(status)}">
        ${escapeHTML(humanize(value))}
      </span>
    `;
    }

    function emptyRow(columns, message = "No records available.") {
        return `
      <tr>
        <td colspan="${columns}">${escapeHTML(message)}</td>
      </tr>
    `;
    }

    function toast(message, type = "info") {
        const region = $("#toastRegion");

        if (!region) return;

        const item = document.createElement("div");

        item.className = `toast ${type}`;
        item.textContent = message;

        region.appendChild(item);

        setTimeout(() => item.remove(), 4500);
    }

    function setConnection(status, message) {
        const element = $("#connectionStatus");

        if (!element) return;

        element.className = `connection-status ${status}`;
        element.innerHTML = `<i></i>${escapeHTML(message)}`;
    }

    function setMetric(id, value) {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = formatNumber(value);
        }
    }

    function showModal(id) {
        const modal = document.getElementById(id);

        if (modal) modal.hidden = false;
    }

    function closeModal(modal) {
        if (modal) modal.hidden = true;
    }

    function formValues(form) {
        const result = Object.fromEntries(new FormData(form).entries());

        $$('input[type="checkbox"]', form).forEach(input => {
            if (input.name) result[input.name] = input.checked;
        });

        return result;
    }

    function fillForm(form, values = {}) {
        Object.entries(values).forEach(([name, value]) => {
            const field = form.elements.namedItem(name);

            if (!field) return;

            if (field.type === "checkbox") {
                field.checked = isTrue(value);
            } else if (field.type !== "file") {
                field.value = value ?? "";
            }
        });
    }

    function getStatusText(value) {
        return value ? humanize(value) : "Status unavailable";
    }

    /* ==========================================
       API CLIENT
       ========================================== */

    async function api(path, options = {}) {
        const controller = new AbortController();

        const timer = setTimeout(
            () => controller.abort(),
            CONFIG.timeout
        );

        const headers = new Headers(options.headers || {});

        headers.set("Accept", "application/json");

        const csrf = $('meta[name="csrf-token"]')?.content;

        if (csrf) {
            headers.set("X-CSRF-Token", csrf);
        }

        let body = options.body;

        if (
            body &&
            !(body instanceof FormData) &&
            typeof body !== "string"
        ) {
            headers.set("Content-Type", "application/json");
            body = JSON.stringify(body);
        }

        try {
            const response = await fetch(endpoint(path), {
                ...options,
                headers,
                body,
                credentials: "include",
                signal: options.signal || controller.signal
            });

            if (!response.ok) {
                const contentType = response.headers.get("content-type") || "";

                let message = `Request failed (${response.status})`;

                if (contentType.includes("application/json")) {
                    const error = await response.json().catch(() => ({}));

                    message = error.message ||
                        error.error ||
                        error.detail ||
                        message;
                } else {
                    const text = await response.text().catch(() => "");

                    if (text) message = text;
                }

                throw new Error(message);
            }

            if (response.status === 204) return null;

            const contentType = response.headers.get("content-type") || "";

            if (contentType.includes("application/json")) {
                return response.json();
            }

            return response.text();

        } finally {
            clearTimeout(timer);
        }
    }

    async function downloadFile(path, filename) {
        const headers = new Headers();

        const csrf = $('meta[name="csrf-token"]')?.content;

        if (csrf) headers.set("X-CSRF-Token", csrf);

        try {
            const response = await fetch(endpoint(path), {
                method: "GET",
                credentials: "include",
                headers
            });

            if (!response.ok) {
                throw new Error(`Download failed (${response.status})`);
            }

            const blob = await response.blob();

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = filename;

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(url), 1000);

            toast("Download completed.", "success");

        } catch (error) {
            toast(`Download failed: ${error.message}`, "error");
        }
    }

    /* ==========================================
       NAVIGATION
       ========================================== */

    function navigate(section) {
        const target = document.getElementById(section);

        if (!target) return;

        $$(".content-section").forEach(item => {
            item.classList.toggle("active", item.id === section);
        });

        $$(".nav-link[data-section]").forEach(link => {
            link.classList.toggle(
                "active",
                link.dataset.section === section
            );
        });

        $("#sidebar").classList.remove("open");

        const loaders = {
            overview: loadDashboard,
            settings: loadSettings,
            features: loadFeatures,
            system: loadSystem,
            localization: loadLocalization,
            integrations: loadIntegrations,
            "api-management": loadAPIs,
            notifications: loadNotifications,
            branding: loadBranding,
            health: loadHealth,
            history: loadHistory
        };

        if (loaders[section]) loaders[section]();
    }

    /* ==========================================
       1. GLOBAL DASHBOARD
       ========================================== */

    async function loadDashboard() {
        try {
            const payload = await api(CONFIG.endpoints.dashboard);
            const data = getData(payload);

            const metrics = data.metrics || data.summary || data;

            setMetric(
                "activeFeatures",
                metrics.activeFeatures ?? metrics.active_features
            );

            setMetric(
                "jurisdictionCount",
                metrics.jurisdictionCount ?? metrics.jurisdiction_count
            );

            setMetric(
                "activeIntegrations",
                metrics.activeIntegrations ?? metrics.active_integrations
            );

            setMetric(
                "activeAPIs",
                metrics.activeAPIs ?? metrics.active_apis
            );

            setMetric(
                "pendingChanges",
                metrics.pendingChanges ?? metrics.pending_changes
            );

            setMetric(
                "systemAlerts",
                metrics.systemAlerts ?? metrics.system_alerts
            );

            renderServiceOverview(
                data.services || data.serviceStatus || data.service_status || []
            );

            renderConfigurationSummary(
                data.configurationSummary ||
                data.configuration_summary ||
                {}
            );

            renderRecentConfiguration(
                recordsFromDashboard(data)
            );

            $("#bannerMessage").textContent =
                data.message ||
                data.platformMessage ||
                data.platform_message ||
                "Global platform configuration retrieved successfully.";

            setConnection("connected", "Connected");

        } catch (error) {
            setConnection("error", "Connection issue");

            $("#bannerMessage").textContent =
                "Platform configuration could not be retrieved.";

            console.error("[TALVORA System] Dashboard:", error);
        }
    }

    function recordsFromDashboard(data) {
        return getRecords(
            data,
            "recentChanges",
            "recent_changes",
            "recentConfiguration",
            "recent_configuration"
        );
    }

    function renderServiceOverview(items) {
        const container = $("#serviceOverview");

        if (!items.length) {
            container.textContent = "No service status information available.";
            return;
        }

        container.innerHTML = items.map(item => `
      <div class="service-row">
        <strong>${escapeHTML(item.name || item.service || "Service")}</strong>
        ${badge(item.status)}
      </div>
    `).join("");
    }

    function renderConfigurationSummary(data) {
        const container = $("#configurationSummary");

        const fields = [
            ["Environment", data.environment],
            ["Platform version", data.version || data.platformVersion],
            ["Default country", data.defaultCountry || data.default_country],
            ["Default currency", data.defaultCurrency || data.default_currency],
            ["Default language", data.defaultLanguage || data.default_language],
            ["Maintenance mode", data.maintenanceMode ?? data.maintenance_mode]
        ];

        container.innerHTML = fields.map(([label, value]) => `
      <div class="summary-row">
        <span>${escapeHTML(label)}</span>
        <strong>${escapeHTML(
            typeof value === "boolean" ? (value ? "Enabled" : "Disabled") : value ?? "—"
        )}</strong>
      </div>
    `).join("");
    }

    function renderRecentConfiguration(items) {
        $("#recentConfiguration").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || item.changeId || "—")}</td>
          <td>${escapeHTML(item.configuration || item.setting || "—")}</td>
          <td>${escapeHTML(item.actorName || item.actor_name || "—")}</td>
          <td>${escapeHTML(humanize(item.changeType || item.change_type))}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${badge(item.status)}</td>
        </tr>
      `).join("")
            : emptyRow(6);
    }

    /* ==========================================
       2. GLOBAL SETTINGS
       ========================================== */

    async function loadSettings() {
        try {
            const payload = await api(CONFIG.endpoints.settings);

            const data = getData(payload);
            const settings = data.settings || data;

            state.originalSettings = { ...settings };

            fillForm($("#globalSettingsForm"), settings);

            await loadCountryOptions(
                settings.defaultCountry || settings.default_country
            );

        } catch (error) {
            toast(`Settings could not be loaded: ${error.message}`, "error");
        }
    }

    async function loadCountryOptions(selectedValue) {
        const select = $("#defaultCountry");

        try {
            if (!state.jurisdictions.length) {
                const payload = await api(CONFIG.endpoints.jurisdictions);

                state.jurisdictions = getRecords(
                    payload,
                    "jurisdictions",
                    "countries",
                    "items"
                );
            }

            const options = state.jurisdictions
                .filter(item => item.status !== "inactive")
                .map(item => ({
                    value: item.code || item.id || item.name,
                    label: item.name || item.country || item.code
                }));

            select.innerHTML =
                '<option value="">Select country</option>' +
                options.map(item => `
          <option value="${escapeHTML(item.value)}">
            ${escapeHTML(item.label)}
          </option>
        `).join("");

            if (selectedValue) select.value = selectedValue;

        } catch (error) {
            console.warn("[TALVORA] Country options unavailable:", error);
        }
    }

    async function saveSettings(form) {
        const button = form.querySelector('[type="submit"]');
        const payload = formValues(form);

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.settings, {
                method: "PATCH",
                body: payload
            });

            state.originalSettings = { ...payload };

            toast("Global platform settings saved.", "success");

            await loadDashboard();

        } catch (error) {
            toast(`Settings update failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    /* ==========================================
       3. FEATURE MANAGEMENT
       ========================================== */

    async function loadFeatures() {
        const container = $("#featureGrid");

        container.textContent = "Loading platform features...";

        try {
            const payload = await api(
                CONFIG.endpoints.features + buildQuery({
                    search: $("#featureSearch").value.trim(),
                    category: $("#featureCategory").value,
                    status: $("#featureStatus").value
                })
            );

            state.features = getRecords(
                payload,
                "features",
                "items",
                "results"
            );

            renderFeatures(state.features);

        } catch (error) {
            container.textContent = "Platform features could not be loaded.";
            toast(error.message, "error");
        }
    }

    function renderFeatures(items) {
        const container = $("#featureGrid");

        if (!items.length) {
            container.innerHTML = "<p>No platform features found.</p>";
            return;
        }

        container.innerHTML = items.map(item => `
      <article class="feature-card">

        <div class="feature-meta">
          ${badge(item.status)}
          <span>${escapeHTML(humanize(item.category))}</span>
        </div>

        <h3>${escapeHTML(item.name || item.title || "Platform feature")}</h3>

        <p>${escapeHTML(item.description || "")}</p>

        <div class="feature-controls">

          <label class="switch" title="Enable or disable feature">
            <input
              type="checkbox"
              data-feature-toggle="${escapeHTML(item.id)}"
              ${item.status === "enabled" ? "checked" : ""}
              aria-label="Enable ${escapeHTML(item.name)}"
            >
            <span></span>
          </label>

          <select data-feature-status="${escapeHTML(item.id)}"
                  aria-label="Feature status">
            <option value="enabled" ${item.status === "enabled" ? "selected" : ""}>Enabled</option>
            <option value="disabled" ${item.status === "disabled" ? "selected" : ""}>Disabled</option>
            <option value="maintenance" ${item.status === "maintenance" ? "selected" : ""}>Maintenance</option>
          </select>

        </div>

      </article>
    `).join("");
    }

    async function updateFeature(id, status) {
        const feature = state.features.find(item => String(item.id) === String(id));

        if (!feature) return;

        if (feature.critical && status === "disabled") {
            toast("This critical feature requires a protected change procedure.", "error");
            renderFeatures(state.features);
            return;
        }

        try {
            await api(`${CONFIG.endpoints.features}/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: {
                    status,
                    reason: `Administrative feature status change to ${status}`
                }
            });

            toast("Platform feature updated.", "success");

            await Promise.all([loadFeatures(), loadDashboard()]);

        } catch (error) {
            toast(`Feature update failed: ${error.message}`, "error");
            renderFeatures(state.features);
        }
    }

    /* ==========================================
       4. SYSTEM CONTROLS
       ========================================== */

    async function loadSystem() {
        try {
            const [statusPayload, maintenancePayload] = await Promise.all([
                api(CONFIG.endpoints.systemStatus),
                api(CONFIG.endpoints.maintenance)
            ]);

            const data = getData(statusPayload);

            setControlStatus(
                "platformAvailability",
                data.platformAvailability || data.platform_availability
            );

            setControlStatus(
                "maintenanceStatus",
                data.maintenanceMode ?? data.maintenance_mode
            );

            setControlStatus(
                "backgroundStatus",
                data.backgroundServices || data.background_services
            );

            setControlStatus(
                "backupStatus",
                data.backupStatus || data.backup_status
            );

            setControlStatus(
                "registrationStatus",
                data.registrationStatus || data.registration_status
            );

            const schedules = getRecords(
                maintenancePayload,
                "maintenance",
                "schedules",
                "items"
            );

            renderMaintenance(schedules);

        } catch (error) {
            console.error("[TALVORA System] System controls:", error);
            toast(`System information unavailable: ${error.message}`, "error");
        }
    }

    function setControlStatus(id, value) {
        const element = document.getElementById(id);

        if (!element) return;

        let status;

        if (typeof value === "boolean") {
            status = value ? "Enabled" : "Disabled";
        } else if (typeof value === "string") {
            status = humanize(value);
        } else if (value?.status) {
            status = humanize(value.status);
        } else {
            status = "Unavailable";
        }

        element.textContent = status;
    }

    function renderMaintenance(items) {
        $("#maintenanceTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || "—")}</td>
          <td>${escapeHTML(item.description || "—")}</td>
          <td>${escapeHTML(humanize(item.environment))}</td>
          <td>${escapeHTML(formatDate(item.startAt || item.start_at))}</td>
          <td>${escapeHTML(formatDate(item.endAt || item.end_at))}</td>
          <td>${badge(item.status)}</td>
        </tr>
      `).join("")
            : emptyRow(6);
    }

    function requestConfirmation(action, title, message) {
        state.pendingAction = action;

        $("#confirmationTitle").textContent = title;
        $("#confirmationMessage").textContent = message;
        $("#confirmationReason").value = "";
        $("#confirmationText").value = "";

        $("#confirmOperation").disabled = true;

        showModal("confirmationModal");
    }

    function validateConfirmation() {
        const reason = $("#confirmationReason").value.trim();
        const confirmation = $("#confirmationText").value.trim();

        $("#confirmOperation").disabled =
            !reason || confirmation !== "CONFIRM";
    }

    async function executeSystemAction(action, reason) {
        const button = $("#confirmOperation");

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.systemActions, {
                method: "POST",
                body: {
                    action,
                    reason,
                    source: "global_platform_control"
                }
            });

            closeModal($("#confirmationModal"));

            toast(
                "System operation submitted. The server will enforce authorization and any required approvals.",
                "success"
            );

            state.pendingAction = null;

            await Promise.all([
                loadSystem(),
                loadDashboard(),
                loadHistory()
            ]);

        } catch (error) {
            toast(`System operation failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    const SYSTEM_ACTIONS = {
        availability: {
            action: "manage_platform_availability",
            title: "Manage platform availability",
            message: "This operation may affect platform availability. Explain the reason and confirm the operation."
        },

        maintenance: {
            action: "manage_maintenance_mode",
            title: "Manage maintenance mode",
            message: "This operation may place the platform into maintenance mode or change its maintenance state."
        },

        background: {
            action: "manage_background_services",
            title: "Manage background services",
            message: "This operation may affect background processing. Confirm the requested service operation."
        },

        backup: {
            action: "run_backup",
            title: "Initiate backup operation",
            message: "Submit a backup operation request. The backend must verify backup permissions and report execution status."
        },

        registration: {
            action: "manage_registration",
            title: "Manage registration availability",
            message: "This operation may change new-user registration availability."
        }
    };

    async function scheduleMaintenance(form) {
        const button = form.querySelector('[type="submit"]');
        const payload = formValues(form);

        const start = new Date(payload.startAt);
        const end = new Date(payload.endAt);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime()) ||
            end <= start
        ) {
            toast("The maintenance end time must be after its start time.", "error");
            return;
        }

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.maintenance, {
                method: "POST",
                body: payload
            });

            form.reset();
            closeModal($("#maintenanceModal"));

            toast("Maintenance schedule submitted.", "success");

            await Promise.all([loadSystem(), loadDashboard()]);

        } catch (error) {
            toast(`Maintenance scheduling failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    /* ==========================================
       5. LOCALIZATION
       ========================================== */

    async function loadLocalization() {
        try {
            const [jurisdictionPayload, summaryPayload] = await Promise.all([
                api(CONFIG.endpoints.jurisdictions + buildQuery({
                    search: $("#jurisdictionSearch").value.trim(),
                    status: $("#jurisdictionStatus").value
                })),
                api(CONFIG.endpoints.localizationSummary)
            ]);

            state.jurisdictions = getRecords(
                jurisdictionPayload,
                "jurisdictions",
                "countries",
                "items"
            );

            const summary = getData(summaryPayload);

            setMetric(
                "countryTotal",
                summary.countryCount ?? summary.country_count ?? state.jurisdictions.length
            );

            setMetric(
                "currencyTotal",
                summary.currencyCount ?? summary.currency_count
            );

            setMetric(
                "languageTotal",
                summary.languageCount ?? summary.language_count
            );

            renderJurisdictions(state.jurisdictions);

        } catch (error) {
            $("#jurisdictionTable").innerHTML =
                emptyRow(8, "Localization data could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderJurisdictions(items) {
        $("#jurisdictionTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.name || item.country || "—")}</td>
          <td>${escapeHTML(item.code || "—")}</td>
          <td>${escapeHTML(item.currency || "—")}</td>
          <td>${escapeHTML(item.language || "—")}</td>
          <td>${escapeHTML(item.timezone || "—")}</td>
          <td>${escapeHTML(humanize(item.availability || item.regionStatus))}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-edit-jurisdiction="${escapeHTML(item.id)}">Edit</button>
          </td>
        </tr>
      `).join("")
            : emptyRow(8);
    }

    async function saveJurisdiction(form) {
        const button = form.querySelector('[type="submit"]');
        const payload = formValues(form);

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.jurisdictions, {
                method: "POST",
                body: payload
            });

            form.reset();
            closeModal($("#jurisdictionModal"));

            toast("Jurisdiction registration submitted.", "success");

            await Promise.all([
                loadLocalization(),
                loadCountryOptions()
            ]);

        } catch (error) {
            toast(`Jurisdiction registration failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    async function editJurisdiction(id) {
        const item = state.jurisdictions.find(
            record => String(record.id) === String(id)
        );

        if (!item) return;

        const status = window.prompt(
            "Set jurisdiction status: active, inactive or pending",
            item.status || "active"
        );

        if (!status) return;

        if (!["active", "inactive", "pending"].includes(status)) {
            toast("Invalid jurisdiction status.", "error");
            return;
        }

        try {
            await api(`${CONFIG.endpoints.jurisdictions}/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: { status }
            });

            toast("Jurisdiction updated.", "success");

            await loadLocalization();

        } catch (error) {
            toast(`Jurisdiction update failed: ${error.message}`, "error");
        }
    }

    /* ==========================================
       6. INTEGRATIONS
       ========================================== */

    async function loadIntegrations() {
        try {
            const [integrationPayload, activityPayload] = await Promise.all([
                api(CONFIG.endpoints.integrations),
                api(CONFIG.endpoints.integrationActivity)
            ]);

            state.integrations = getRecords(
                integrationPayload,
                "integrations",
                "items",
                "results"
            );

            const activity = getRecords(
                activityPayload,
                "activity",
                "events",
                "items"
            );

            renderIntegrations(state.integrations);
            renderIntegrationActivity(activity);

        } catch (error) {
            $("#integrationGrid").textContent =
                "Integration information could not be loaded.";

            toast(error.message, "error");
        }
    }

    function renderIntegrations(items) {
        const container = $("#integrationGrid");

        container.innerHTML = items.length
            ? items.map(item => `
        <article class="integration-card">
          <div class="feature-meta">
            ${badge(item.status)}
            <span>${escapeHTML(humanize(item.category))}</span>
          </div>

          <h3>${escapeHTML(item.name || "Integration")}</h3>

          <p>Provider: ${escapeHTML(item.provider || "—")}</p>
          <p>Environment: ${escapeHTML(humanize(item.environment))}</p>
          <p>Last checked: ${escapeHTML(formatDate(item.lastChecked || item.last_checked))}</p>

          <div class="card-actions">
            <button data-test-integration="${escapeHTML(item.id)}">
              Test connection
            </button>
            <button data-edit-integration="${escapeHTML(item.id)}">
              Manage
            </button>
          </div>
        </article>
      `).join("")
            : "<p>No integrations have been registered.</p>";
    }

    function renderIntegrationActivity(items) {
        $("#integrationActivity").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.integrationName || item.integration_name || "—")}</td>
          <td>${escapeHTML(humanize(item.event))}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${badge(item.result || item.status)}</td>
        </tr>
      `).join("")
            : emptyRow(4);
    }

    async function registerIntegration(form) {
        const button = form.querySelector('[type="submit"]');
        const payload = formValues(form);

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.integrations, {
                method: "POST",
                body: payload
            });

            form.reset();
            closeModal($("#integrationModal"));

            toast("Integration registration submitted.", "success");

            await loadIntegrations();

        } catch (error) {
            toast(`Integration registration failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    async function testIntegration(id) {
        try {
            const result = await api(
                `${CONFIG.endpoints.integrations}/${encodeURIComponent(id)}/test`,
                { method: "POST", body: {} }
            );

            const data = getData(result);

            toast(
                data.message || "Integration test request completed.",
                data.success === false ? "error" : "success"
            );

            await loadIntegrations();

        } catch (error) {
            toast(`Integration test failed: ${error.message}`, "error");
        }
    }

    async function manageIntegration(id) {
        const item = state.integrations.find(
            record => String(record.id) === String(id)
        );

        if (!item) return;

        const status = window.prompt(
            "Enter integration status: active, disabled or suspended",
            item.status || "active"
        );

        if (!status) return;

        if (!["active", "disabled", "suspended"].includes(status)) {
            toast("Invalid integration status.", "error");
            return;
        }

        try {
            await api(
                `${CONFIG.endpoints.integrations}/${encodeURIComponent(id)}`,
                {
                    method: "PATCH",
                    body: { status }
                }
            );

            toast("Integration configuration updated.", "success");

            await loadIntegrations();

        } catch (error) {
            toast(`Integration update failed: ${error.message}`, "error");
        }
    }

    /* ==========================================
       7. API MANAGEMENT
       ========================================== */

    async function loadAPIs() {
        try {
            const [applicationPayload, usagePayload] = await Promise.all([
                api(CONFIG.endpoints.applications + buildQuery({
                    search: $("#apiSearch").value.trim(),
                    status: $("#apiStatus").value
                })),
                api(CONFIG.endpoints.apiUsage)
            ]);

            const data = getData(applicationPayload);

            state.applications = getRecords(
                applicationPayload,
                "applications",
                "items",
                "results"
            );

            const usage = getData(usagePayload);

            setMetric(
                "apiApplicationTotal",
                data.total ?? data.totalApplications ?? data.total_applications ?? state.applications.length
            );

            setMetric(
                "apiRequestTotal",
                usage.totalRequests ?? usage.total_requests
            );

            setMetric(
                "apiFailureTotal",
                usage.failedRequests ?? usage.failed_requests
            );

            renderAPIs(state.applications);
            renderAPIUsage(usage);

        } catch (error) {
            $("#apiTable").innerHTML = emptyRow(8, "API applications could not be loaded.");
            toast(error.message, "error");
        }
    }

    function renderAPIs(items) {
        $("#apiTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || "—")}</td>
          <td>${escapeHTML(item.name || "—")}</td>
          <td>${escapeHTML(item.owner || "—")}</td>
          <td>${escapeHTML(humanize(item.scope))}</td>
          <td>${formatNumber(item.requestCount ?? item.request_count)}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-manage-api="${escapeHTML(item.id)}">Manage</button>
          </td>
        </tr>
      `).join("")
            : emptyRow(8);
    }

    function renderAPIUsage(data) {
        const items = [
            ["Total requests", data.totalRequests ?? data.total_requests],
            ["Successful requests", data.successfulRequests ?? data.successful_requests],
            ["Failed requests", data.failedRequests ?? data.failed_requests]
        ];

        $("#apiUsage").innerHTML = items.map(([label, value]) => `
      <div class="api-usage-item">
        <span>${escapeHTML(label)}</span>
        <strong>${formatNumber(value)}</strong>
      </div>
    `).join("");
    }

    async function registerAPI(form) {
        const button = form.querySelector('[type="submit"]');
        const payload = formValues(form);

        button.disabled = true;

        try {
            const response = await api(CONFIG.endpoints.applications, {
                method: "POST",
                body: payload
            });

            form.reset();
            closeModal($("#apiModal"));

            const data = getData(response);

            toast(
                data.message ||
                "API application registration submitted. Credentials should be retrieved through the secure server-side process.",
                "success"
            );

            await loadAPIs();

        } catch (error) {
            toast(`API application registration failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    async function manageAPI(id) {
        const item = state.applications.find(
            record => String(record.id) === String(id)
        );

        if (!item) return;

        const status = window.prompt(
            "Enter application status: active, suspended or revoked",
            item.status || "active"
        );

        if (!status) return;

        if (!["active", "suspended", "revoked"].includes(status)) {
            toast("Invalid API application status.", "error");
            return;
        }

        try {
            await api(`${CONFIG.endpoints.applications}/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: { status }
            });

            toast("API application updated.", "success");

            await loadAPIs();

        } catch (error) {
            toast(`API application update failed: ${error.message}`, "error");
        }
    }

    /* ==========================================
       8. NOTIFICATIONS
       ========================================== */

    async function loadNotifications() {
        try {
            const [configPayload, templatePayload] = await Promise.all([
                api(CONFIG.endpoints.notifications),
                api(CONFIG.endpoints.templates)
            ]);

            const settings = getData(configPayload);

            fillForm(
                $("#notificationForm"),
                settings.configuration || settings
            );

            const templates = getRecords(
                templatePayload,
                "templates",
                "items",
                "results"
            );

            renderTemplates(templates);

        } catch (error) {
            toast(`Notification configuration unavailable: ${error.message}`, "error");
        }
    }

    async function saveNotifications(form) {
        const button = form.querySelector('[type="submit"]');
        const payload = formValues(form);

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.notifications, {
                method: "PATCH",
                body: payload
            });

            toast("Notification configuration saved.", "success");

            await loadNotifications();

        } catch (error) {
            toast(`Notification update failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    function renderTemplates(items) {
        $("#templateTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || "—")}</td>
          <td>${escapeHTML(item.name || "—")}</td>
          <td>${escapeHTML(humanize(item.channel))}</td>
          <td>${escapeHTML(item.language || "—")}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-template-status="${escapeHTML(item.id)}"
                    data-current-status="${escapeHTML(item.status)}">
              Manage
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(6);
    }

    async function saveTemplate(form) {
        const button = form.querySelector('[type="submit"]');
        const payload = formValues(form);

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.templates, {
                method: "POST",
                body: payload
            });

            form.reset();
            closeModal($("#templateModal"));

            toast("Notification template registered.", "success");

            await loadNotifications();

        } catch (error) {
            toast(`Template registration failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    async function manageTemplate(id, currentStatus) {
        const status = window.prompt(
            "Enter template status: active or disabled",
            currentStatus || "active"
        );

        if (!status) return;

        if (!["active", "disabled"].includes(status)) {
            toast("Invalid template status.", "error");
            return;
        }

        try {
            await api(`${CONFIG.endpoints.templates}/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: { status }
            });

            toast("Notification template updated.", "success");

            await loadNotifications();

        } catch (error) {
            toast(`Template update failed: ${error.message}`, "error");
        }
    }

    /* ==========================================
       9. BRANDING
       ========================================== */

    async function loadBranding() {
        try {
            const payload = await api(CONFIG.endpoints.branding);
            const data = getData(payload);

            const branding = data.branding || data;

            state.originalBranding = { ...branding };

            fillForm($("#brandingForm"), branding);

            updateBrandPreview(branding);

        } catch (error) {
            toast(`Branding information unavailable: ${error.message}`, "error");
        }
    }

    function updateBrandPreview(data) {
        const primary = safeColor(data.primaryColor || data.primary_color, "#7058df");
        const secondary = safeColor(data.secondaryColor || data.secondary_color, "#111a35");

        $("#brandPreview").style.backgroundColor = secondary;
        $("#previewName").textContent =
            data.displayName || data.display_name || "TALVORA";

        $("#previewTagline").textContent =
            data.tagline || "Global Workforce Platform";

        $(".preview-logo").style.backgroundColor = primary;
        $(".preview-button").style.backgroundColor = primary;

        const logo = data.logoUrl || data.logo_url;

        if (logo) {
            const url = new URL(logo, window.location.href);

            if (url.protocol === "https:" || url.origin === window.location.origin) {
                $(".preview-logo").innerHTML = `
          <img src="${escapeHTML(url.href)}"
               alt="Brand logo"
               style="max-width:90%;max-height:90%;object-fit:contain">
        `;
            } else {
                $(".preview-logo").textContent = "T";
            }
        } else {
            $(".preview-logo").textContent = "T";
        }
    }

    async function saveBranding(form) {
        const button = form.querySelector('[type="submit"]');
        const payload = formValues(form);

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.branding, {
                method: "PATCH",
                body: payload
            });

            state.originalBranding = { ...payload };

            toast("Platform branding saved.", "success");

            await loadBranding();
            await loadDashboard();

        } catch (error) {
            toast(`Branding update failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    /* ==========================================
       10. SYSTEM HEALTH
       ========================================== */

    async function loadHealth() {
        try {
            const payload = await api(CONFIG.endpoints.health);
            const data = getData(payload);

            state.health = data;

            const metrics = data.metrics || data.infrastructure || {};

            const cards = [
                {
                    title: "CPU utilization",
                    value: metrics.cpuUsage ?? metrics.cpu_usage,
                    unit: "%"
                },
                {
                    title: "Memory utilization",
                    value: metrics.memoryUsage ?? metrics.memory_usage,
                    unit: "%"
                },
                {
                    title: "Storage utilization",
                    value: metrics.storageUsage ?? metrics.storage_usage,
                    unit: "%"
                },
                {
                    title: "Network activity",
                    value: metrics.networkUsage ?? metrics.network_usage,
                    unit: ""
                },
                {
                    title: "Active services",
                    value: metrics.activeServices ?? metrics.active_services,
                    unit: ""
                },
                {
                    title: "System uptime",
                    value: metrics.uptime,
                    unit: ""
                }
            ];

            $("#healthGrid").innerHTML = cards.map(item => `
        <article class="health-card">
          <h3>${escapeHTML(item.title)}</h3>
          <strong>${escapeHTML(
                item.value === null || item.value === undefined
                    ? "—"
                    : `${item.value}${item.unit}`
            )}</strong>
          <small>Latest reported infrastructure value</small>
        </article>
      `).join("");

            renderHealthServices(
                getRecords(data, "services", "components")
            );

            renderHealthAlerts(
                getRecords(data, "alerts", "incidents")
            );

        } catch (error) {
            $("#healthGrid").textContent =
                "Infrastructure health information could not be retrieved.";

            toast(`Health monitoring failed: ${error.message}`, "error");
        }
    }

    function renderHealthServices(items) {
        $("#healthServices").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.name || item.service || "—")}</td>
          <td>${escapeHTML(humanize(item.environment))}</td>
          <td>${badge(item.status)}</td>
          <td>${escapeHTML(
                item.responseTime !== undefined
                    ? `${item.responseTime} ms`
                    : item.response_time !== undefined
                        ? `${item.response_time} ms`
                        : "—"
            )}</td>
          <td>${escapeHTML(formatDate(item.lastChecked || item.last_checked))}</td>
        </tr>
      `).join("")
            : emptyRow(5);
    }

    function renderHealthAlerts(items) {
        $("#healthAlerts").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || "—")}</td>
          <td>${escapeHTML(item.component || "—")}</td>
          <td>${badge(item.severity)}</td>
          <td>${escapeHTML(item.description || "—")}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${badge(item.status)}</td>
        </tr>
      `).join("")
            : emptyRow(6);
    }

    /* ==========================================
       11. CONFIGURATION HISTORY
       ========================================== */

    async function loadHistory() {
        const body = $("#historyTable");

        body.innerHTML = emptyRow(9, "Loading configuration history...");

        try {
            const payload = await api(CONFIG.endpoints.history + buildQuery({
                search: $("#historySearch").value.trim(),
                changeType: $("#historyType").value,
                status: $("#historyStatus").value
            }));

            const items = getRecords(
                payload,
                "history",
                "changes",
                "items",
                "results"
            );

            body.innerHTML = items.length
                ? items.map(item => `
          <tr>
            <td>${escapeHTML(item.id || "—")}</td>
            <td>${escapeHTML(item.configuration || item.setting || "—")}</td>
            <td>${escapeHTML(item.actorName || item.actor_name || "—")}</td>
            <td>${escapeHTML(humanize(item.changeType || item.change_type))}</td>
            <td>${escapeHTML(item.previousValue ?? item.previous_value ?? "—")}</td>
            <td>${escapeHTML(item.newValue ?? item.new_value ?? "—")}</td>
            <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
            <td>${badge(item.status)}</td>
            <td>
              <button data-history-detail="${escapeHTML(item.id)}">Details</button>
            </td>
          </tr>
        `).join("")
                : emptyRow(9);

        } catch (error) {
            body.innerHTML = emptyRow(9, "Configuration history could not be loaded.");
            console.error(error);
        }
    }

    async function openHistoryDetail(id) {
        try {
            const payload = await api(
                `${CONFIG.endpoints.history}/${encodeURIComponent(id)}`
            );

            const item = getData(payload);

            const details = [
                ["Change ID", item.id],
                ["Configuration", item.configuration || item.setting],
                ["Administrator", item.actorName || item.actor_name],
                ["Change type", humanize(item.changeType || item.change_type)],
                ["Previous value", item.previousValue ?? item.previous_value],
                ["New value", item.newValue ?? item.new_value],
                ["Reason", item.reason],
                ["Approval", item.approvalStatus || item.approval_status],
                ["Timestamp", formatDate(item.createdAt || item.created_at)]
            ];

            $("#configModalTitle").textContent = "Configuration change details";

            $("#configModalBody").innerHTML = details
                .filter(([, value]) => value !== null && value !== undefined && value !== "")
                .map(([label, value]) => `
          <div class="summary-row">
            <span>${escapeHTML(label)}</span>
            <strong>${escapeHTML(value)}</strong>
          </div>
        `).join("");

            showModal("configModal");

        } catch (error) {
            toast(`History details unavailable: ${error.message}`, "error");
        }
    }

    /* ==========================================
       EXPORTS
       ========================================== */

    async function exportData(type) {
        try {
            const result = await api(CONFIG.endpoints.exports, {
                method: "POST",
                body: {
                    type,
                    format: "csv",
                    source: "global_platform_control"
                }
            });

            const data = getData(result);

            toast(
                data.message || "Export request submitted.",
                "success"
            );

            if (
                data.downloadAvailable &&
                data.id
            ) {
                await downloadFile(
                    `${CONFIG.endpoints.exports}/${encodeURIComponent(data.id)}/download`,
                    `talvora-${type}.csv`
                );
            }

        } catch (error) {
            toast(`Export failed: ${error.message}`, "error");
        }
    }

    /* ==========================================
       LIVE BRANDING PREVIEW
       ========================================== */

    function bindBrandPreview() {
        const form = $("#brandingForm");

        form.addEventListener("input", () => {
            updateBrandPreview(formValues(form));
        });
    }

    /* ==========================================
       EVENT BINDING
       ========================================== */

    function debounce(callback, delay = 350) {
        let timer;

        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => callback(...args), delay);
        };
    }

    function bindEvents() {

        // Navigation
        $$(".nav-link[data-section]").forEach(link => {
            link.addEventListener("click", event => {
                event.preventDefault();
                navigate(link.dataset.section);
            });
        });

        $$("[data-navigate]").forEach(button => {
            button.addEventListener("click", () => {
                navigate(button.dataset.navigate);
            });
        });

        $("#menuToggle").addEventListener("click", () => {
            $("#sidebar").classList.toggle("open");
        });

        // Refresh
        $("#refreshButton").addEventListener("click", refreshAll);

        $("#refreshFeatures").addEventListener("click", loadFeatures);
        $("#refreshHealth").addEventListener("click", loadHealth);

        $("#alertsButton").addEventListener("click", () => {
            navigate("health");
        });

        // Global settings
        $("#globalSettingsForm").addEventListener("submit", event => {
            event.preventDefault();
            saveSettings(event.currentTarget);
        });

        $("#resetSettings").addEventListener("click", () => {
            if (!state.originalSettings) return;

            fillForm($("#globalSettingsForm"), state.originalSettings);
            toast("Original settings restored in the form.");
        });

        // Feature filters
        $("#featureSearch").addEventListener("input", debounce(loadFeatures));
        $("#featureCategory").addEventListener("change", loadFeatures);
        $("#featureStatus").addEventListener("change", loadFeatures);

        // System controls
        $$("[data-system-action]").forEach(button => {
            button.addEventListener("click", () => {
                const config = SYSTEM_ACTIONS[button.dataset.systemAction];

                if (config) {
                    requestConfirmation(
                        config.action,
                        config.title,
                        config.message
                    );
                }
            });
        });

        $("#scheduleMaintenance").addEventListener("click", () => {
            showModal("maintenanceModal");
        });

        $("#maintenanceForm").addEventListener("submit", event => {
            event.preventDefault();
            scheduleMaintenance(event.currentTarget);
        });

        $("#emergencyControl").addEventListener("click", () => {
            showModal("emergencyModal");
        });

        $$("[data-emergency-action]").forEach(button => {
            button.addEventListener("click", () => {
                const action = button.dataset.emergencyAction;

                const messages = {
                    maintenance: "This can restrict platform access while emergency maintenance is active.",
                    disable_registration: "This can prevent new registrations across the configured platform scope.",
                    disable_integrations: "This can interrupt connected third-party services."
                };

                closeModal($("#emergencyModal"));

                requestConfirmation(
                    `emergency_${action}`,
                    "Confirm emergency operation",
                    messages[action] || "This is a protected emergency operation."
                );
            });
        });

        $("#confirmationReason").addEventListener("input", validateConfirmation);
        $("#confirmationText").addEventListener("input", validateConfirmation);

        $("#confirmOperation").addEventListener("click", async () => {
            const reason = $("#confirmationReason").value.trim();

            if (!reason || $("#confirmationText").value.trim() !== "CONFIRM") {
                toast("Provide a reason and enter CONFIRM.", "error");
                return;
            }

            if (!state.pendingAction) return;

            await executeSystemAction(state.pendingAction, reason);
        });

        // Localization
        $("#addJurisdiction").addEventListener("click", () => {
            showModal("jurisdictionModal");
        });

        $("#jurisdictionForm").addEventListener("submit", event => {
            event.preventDefault();
            saveJurisdiction(event.currentTarget);
        });

        $("#jurisdictionSearch").addEventListener("input", debounce(loadLocalization));
        $("#jurisdictionStatus").addEventListener("change", loadLocalization);

        // Integrations
        $("#addIntegration").addEventListener("click", () => {
            showModal("integrationModal");
        });

        $("#integrationForm").addEventListener("submit", event => {
            event.preventDefault();
            registerIntegration(event.currentTarget);
        });

        // API applications
        $("#registerAPI").addEventListener("click", () => {
            showModal("apiModal");
        });

        $("#apiForm").addEventListener("submit", event => {
            event.preventDefault();
            registerAPI(event.currentTarget);
        });

        $("#apiSearch").addEventListener("input", debounce(loadAPIs));
        $("#apiStatus").addEventListener("change", loadAPIs);

        // Notifications
        $("#notificationForm").addEventListener("submit", event => {
            event.preventDefault();
            saveNotifications(event.currentTarget);
        });

        $("#addTemplate").addEventListener("click", () => {
            showModal("templateModal");
        });

        $("#templateForm").addEventListener("submit", event => {
            event.preventDefault();
            saveTemplate(event.currentTarget);
        });

        // Branding
        $("#brandingForm").addEventListener("submit", event => {
            event.preventDefault();
            saveBranding(event.currentTarget);
        });

        bindBrandPreview();

        // History
        $("#historySearch").addEventListener("input", debounce(loadHistory));
        $("#historyType").addEventListener("change", loadHistory);
        $("#historyStatus").addEventListener("change", loadHistory);

        $("#exportHistory").addEventListener("click", () => {
            exportData("configuration_history");
        });

        $("#exportConfiguration").addEventListener("click", () => {
            exportData("full_configuration");
        });

        // Dynamic elements
        document.addEventListener("change", event => {

            const featureToggle = event.target.closest("[data-feature-toggle]");

            if (featureToggle) {
                updateFeature(
                    featureToggle.dataset.featureToggle,
                    featureToggle.checked ? "enabled" : "disabled"
                );
            }

            const featureStatus = event.target.closest("[data-feature-status]");

            if (featureStatus) {
                updateFeature(
                    featureStatus.dataset.featureStatus,
                    featureStatus.value
                );
            }
        });

        document.addEventListener("click", event => {

            const jurisdiction = event.target.closest("[data-edit-jurisdiction]");

            if (jurisdiction) {
                editJurisdiction(jurisdiction.dataset.editJurisdiction);
            }

            const integrationTest = event.target.closest("[data-test-integration]");

            if (integrationTest) {
                testIntegration(integrationTest.dataset.testIntegration);
            }

            const integrationManage = event.target.closest("[data-edit-integration]");

            if (integrationManage) {
                manageIntegration(integrationManage.dataset.editIntegration);
            }

            const apiManage = event.target.closest("[data-manage-api]");

            if (apiManage) {
                manageAPI(apiManage.dataset.manageApi);
            }

            const templateManage = event.target.closest("[data-template-status]");

            if (templateManage) {
                manageTemplate(
                    templateManage.dataset.templateStatus,
                    templateManage.dataset.currentStatus
                );
            }

            const historyDetail = event.target.closest("[data-history-detail]");

            if (historyDetail) {
                openHistoryDetail(historyDetail.dataset.historyDetail);
            }
        });

        // Modal management
        $$("[data-close-modal]").forEach(button => {
            button.addEventListener("click", () => {
                closeModal(button.closest(".modal-overlay"));
            });
        });

        $$(".modal-overlay").forEach(modal => {
            modal.addEventListener("click", event => {
                if (event.target === modal) {
                    closeModal(modal);
                }
            });
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                $$(".modal-overlay").forEach(modal => {
                    closeModal(modal);
                });
            }
        });
    }

    /* ==========================================
       INITIALIZATION
       ========================================== */

    async function refreshAll() {
        const results = await Promise.allSettled([
            loadDashboard(),
            loadSettings(),
            loadFeatures(),
            loadSystem(),
            loadLocalization(),
            loadIntegrations(),
            loadAPIs(),
            loadNotifications(),
            loadBranding(),
            loadHealth(),
            loadHistory()
        ]);

        const failed = results.filter(
            result => result.status === "rejected"
        );

        if (failed.length) {
            console.warn(
                "[TALVORA System] Some modules could not refresh:",
                failed
            );
        }
    }

    async function initialize() {
        bindEvents();

        setConnection("error", "Connecting");

        await refreshAll();

        state.refreshTimer = setInterval(() => {
            loadDashboard();
            loadHealth();
        }, CONFIG.refreshInterval);
    }

    document.addEventListener("DOMContentLoaded", initialize);

    /* ==========================================
       PUBLIC MODULE INTERFACE
       ========================================== */

    window.TALVORA_SYSTEM_CONTROL = {
        refresh: refreshAll,
        navigate,
        loadDashboard,
        loadSettings,
        loadFeatures,
        loadSystem,
        loadLocalization,
        loadIntegrations,
        loadAPIs,
        loadNotifications,
        loadBranding,
        loadHealth,
        loadHistory,
        exportData,
        config: CONFIG
    };

})();
