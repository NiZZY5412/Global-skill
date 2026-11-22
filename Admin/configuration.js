
/* =========================================================
   TALVORA TECHNOLOGIES
   GLOBAL PLATFORM CONFIGURATION CENTRE
   configuration.js

   Frontend implementation.
   All privileged operations require backend authorization.
========================================================= */

(() => {
    "use strict";

    /* =====================================================
       1. CONFIGURATION
    ===================================================== */

    const BASE = "/api/super-admin/configuration";

    const API = {
        overview: `${BASE}/overview`,
        environments: `${BASE}/environments`,
        global: `${BASE}/global`,
        countries: `${BASE}/countries`,
        portals: `${BASE}/portals`,
        features: `${BASE}/features`,
        payments: `${BASE}/payments`,
        communications: `${BASE}/communications`,
        security: `${BASE}/security`,
        integrations: `${BASE}/integrations`,
        localization: `${BASE}/localization`,
        operations: `${BASE}/operations`,
        maintenance: `${BASE}/maintenance`,
        deployments: `${BASE}/deployments`,
        approvals: `${BASE}/approvals`,
        versions: `${BASE}/versions`,
        compare: `${BASE}/compare`,
        audit: `${BASE}/audit`,
        emergency: `${BASE}/emergency`
    };

    const state = {
        activeView: "overview",
        cache: {},
        auditPage: 1,
        auditPages: 1,
        auditTotal: 0,
        loading: new Set(),
        modal: null
    };


    /* =====================================================
       2. DOM HELPERS
    ===================================================== */

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        [...root.querySelectorAll(selector)];

    const getElement = id =>
        document.getElementById(id);

    function setText(id, value) {
        const element = getElement(id);

        if (element) {
            element.textContent =
                value === null || value === undefined || value === ""
                    ? "—"
                    : String(value);
        }
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(
            /[&<>"']/g,
            character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            })[character]
        );
    }

    function formatDate(value) {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return date.toLocaleString();
    }

    function formatStatus(value) {
        if (!value) return "Unavailable";

        return String(value)
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, letter => letter.toUpperCase());
    }

    function normalizeStatus(value) {
        return String(value || "unavailable")
            .toLowerCase()
            .replace(/\s+/g, "-");
    }

    function listFrom(payload, keys = []) {
        const data = payload?.data ?? payload;

        if (Array.isArray(data)) return data;

        for (const key of keys) {
            if (Array.isArray(data?.[key])) {
                return data[key];
            }
        }

        return [];
    }

    function objectFrom(payload) {
        const data = payload?.data ?? payload;

        return data && typeof data === "object" && !Array.isArray(data)
            ? data
            : {};
    }

    function setStatus(id, value) {
        const element = getElement(id);

        if (!element) return;

        const status = normalizeStatus(value);

        element.className = "tc-status";
        element.classList.add(`status-${status}`);

        element.textContent = formatStatus(value);
    }


    /* =====================================================
       3. NOTIFICATIONS
    ===================================================== */

    function toast(message, type = "success") {
        const region = getElement("tc-toast-region");

        if (!region) return;

        const item = document.createElement("div");

        item.className = `tc-toast ${type}`;
        item.textContent = message;

        region.appendChild(item);

        window.setTimeout(() => {
            item.remove();
        }, 4500);
    }

    function showNotice(message, type = "info") {
        const notice = getElement("tc-global-notice");

        if (!notice) return;

        notice.hidden = false;
        notice.className = "tc-notice";

        if (type === "success") {
            notice.classList.add("tc-success-notice");
        } else if (type === "warning") {
            notice.classList.add("tc-warning-notice");
        } else if (type === "danger") {
            notice.classList.add("tc-warning-notice");
        }

        notice.textContent = message;
    }

    function hideNotice() {
        const notice = getElement("tc-global-notice");

        if (notice) {
            notice.hidden = true;
            notice.textContent = "";
        }
    }


    /* =====================================================
       4. API CLIENT
    ===================================================== */

    function getCSRFToken() {
        return $('meta[name="csrf-token"]')?.content || "";
    }

    async function apiRequest(path, options = {}) {
        const method = options.method || "GET";

        const headers = {
            Accept: "application/json",
            ...options.headers
        };

        const requestOptions = {
            method,
            headers,
            credentials: "same-origin",
            cache: "no-store"
        };

        if (options.body !== undefined) {
            headers["Content-Type"] = "application/json";

            requestOptions.body = JSON.stringify(options.body);
        }

        if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
            const csrf = getCSRFToken();

            if (csrf) {
                headers["X-CSRF-Token"] = csrf;
            }
        }

        const response = await fetch(path, requestOptions);

        const contentType =
            response.headers.get("content-type") || "";

        let result = null;

        if (response.status !== 204) {
            if (contentType.includes("application/json")) {
                result = await response.json();
            } else {
                result = await response.text();
            }
        }

        if (!response.ok) {
            let message = "The server could not complete the request.";

            if (typeof result === "object" && result) {
                message = result.message || result.error || message;
            } else if (typeof result === "string" && result.trim()) {
                message = result;
            }

            if (response.status === 401) {
                message = "Your administrator session has expired. Sign in again.";
            }

            if (response.status === 403) {
                message = "The server denied this operation. Check your administrator permissions.";
            }

            throw new Error(message);
        }

        return result;
    }


    async function apiDownload(path, filename) {
        const headers = {};

        const csrf = getCSRFToken();

        if (csrf) {
            headers["X-CSRF-Token"] = csrf;
        }

        const response = await fetch(path, {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers
        });

        if (!response.ok) {
            throw new Error(
                `Export failed. Server returned ${response.status}.`
            );
        }

        const blob = await response.blob();

        const url = URL.createObjectURL(blob);

        const anchor = document.createElement("a");

        anchor.href = url;
        anchor.download = filename;

        document.body.appendChild(anchor);

        anchor.click();
        anchor.remove();

        URL.revokeObjectURL(url);
    }


    function queryURL(path, params = {}) {
        const url = new URL(path, window.location.origin);

        Object.entries(params).forEach(([key, value]) => {
            if (value !== "" && value !== null && value !== undefined) {
                url.searchParams.set(key, value);
            }
        });

        return url.pathname + url.search;
    }


    /* =====================================================
       5. MODAL MANAGEMENT
    ===================================================== */

    function openModal(id) {
        const modal = getElement(id);

        if (!modal) return;

        closeModal();

        modal.hidden = false;

        document.body.style.overflow = "hidden";

        state.modal = modal;

        const firstInput = $("input, select, textarea", modal);

        if (firstInput) {
            window.setTimeout(() => firstInput.focus(), 100);
        }
    }

    function closeModal() {
        if (state.modal) {
            state.modal.hidden = true;
            state.modal = null;
        }

        document.body.style.overflow = "";
    }

    document.addEventListener("click", event => {
        if (event.target.closest("[data-close-modal]")) {
            closeModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && state.modal) {
            closeModal();
        }
    });


    /* =====================================================
       6. FORM HELPERS
    ===================================================== */

    function formObject(form) {
        return Object.fromEntries(
            new FormData(form).entries()
        );
    }

    function populateForm(formId, payload) {
        const form = getElement(formId);

        if (!form) return;

        const data = objectFrom(payload);

        const source = data.configuration || data.settings || data;

        $$("[name]", form).forEach(field => {
            const name = field.name;

            if (!(name in source)) return;

            const value = source[name];

            if (value === null || value === undefined) return;

            if (field.type === "checkbox") {
                field.checked = Boolean(value);
            } else {
                field.value = Array.isArray(value)
                    ? value.join(",")
                    : value;
            }
        });
    }

    async function submitRequest({
        form,
        endpoint,
        method = "POST",
        successMessage,
        refresh = true,
        close = false
    }) {
        const button = $('button[type="submit"]', form);

        if (button) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.textContent = "Processing...";
        }

        try {
            const payload = formObject(form);

            await apiRequest(endpoint, {
                method,
                body: payload
            });

            toast(successMessage || "Request submitted successfully.");

            if (close) closeModal();

            form.reset();

            if (refresh) {
                await refreshCurrentView();
            }

        } catch (error) {
            toast(error.message, "error");

        } finally {
            if (button) {
                button.disabled = false;
                button.textContent =
                    button.dataset.originalText || "Submit";
            }
        }
    }

    function bindForm(id, endpoint, options = {}) {
        const form = getElement(id);

        if (!form) return;

        form.addEventListener("submit", async event => {
            event.preventDefault();

            await submitRequest({
                form,
                endpoint,
                ...options
            });
        });
    }

    async function loadFormConfiguration(endpoint, formId) {
        try {
            const result = await apiRequest(endpoint);

            populateForm(formId, result);

        } catch (error) {
            console.warn(
                `Configuration could not be loaded: ${formId}`,
                error.message
            );
        }
    }


    /* =====================================================
       7. ENVIRONMENT MANAGEMENT
    ===================================================== */

    function renderEnvironments(payload) {
        const data = objectFrom(payload);

        const environments =
            data.environments || data;

        const names = [
            "development",
            "staging",
            "production"
        ];

        names.forEach(name => {
            const environment = Array.isArray(environments)
                ? environments.find(item => item.name === name)
                : environments[name];

            if (!environment) return;

            setStatus(
                `tc-${name}-status`,
                environment.status || "unavailable"
            );

            setText(
                `tc-${name}-version`,
                environment.version
            );

            setText(
                `tc-${name}-deployment`,
                formatDate(environment.last_deployment)
            );
        });

        setText(
            "tc-current-environment",
            data.current_environment
                ? formatStatus(data.current_environment)
                : "Environment unavailable"
        );

        if (data.status) {
            const indicator = $(".tc-environment-dot");

            if (indicator) {
                indicator.style.background =
                    data.status === "healthy"
                        ? "var(--tc-green)"
                        : "var(--tc-orange)";
            }
        }
    }


    async function loadEnvironments() {
        try {
            const result = await apiRequest(API.environments);

            state.cache.environments = result;

            renderEnvironments(result);

            return result;

        } catch (error) {
            console.warn("Environment service unavailable:", error.message);
            throw error;
        }
    }


    async function manageEnvironment(environment) {
        try {
            const result = await apiRequest(
                `${API.environments}/${encodeURIComponent(environment)}`
            );

            const data = objectFrom(result);

            showNotice(
                `${formatStatus(environment)} environment information retrieved. ` +
                `Status: ${formatStatus(data.status || "Not reported")}.`,
                "success"
            );

        } catch (error) {
            showNotice(error.message, "danger");
        }
    }


    /* =====================================================
       8. OVERVIEW
    ===================================================== */

    function setMetric(id, value) {
        if (value === null || value === undefined) {
            setText(id, "—");
            return;
        }

        setText(
            id,
            Number(value).toLocaleString()
        );
    }


    function renderPortalStatus(payload) {
        const data = objectFrom(payload);

        const portals = data.portals ||
            data.portal_status ||
            [];

        if (!Array.isArray(portals)) return;

        const container = getElement("tc-portal-status");

        if (!container) return;

        if (!portals.length) {
            container.innerHTML = `
                <div class="tc-empty-state">
                    <strong>No portal records available</strong>
                    <p>Portal information will appear when supplied by the backend.</p>
                </div>
            `;

            return;
        }

        container.innerHTML = portals.map(portal => `
            <div class="tc-readiness-item">
                <span>${escapeHTML(formatStatus(portal.name || portal.portal))}</span>
                <strong>
                    ${escapeHTML(formatStatus(portal.status))}
                </strong>
            </div>
        `).join("");
    }


    function renderRecentActivity(records) {
        const body = getElement("tc-recent-activity");

        if (!body) return;

        const items = listFrom(records, ["items", "records", "activities"]);

        if (!items.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="6" class="tc-table-empty">
                        No configuration activity records available.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML = items.slice(0, 8).map(item => `
            <tr>
                <td>${escapeHTML(item.reference || item.id || "—")}</td>
                <td>${escapeHTML(item.administrator_name || item.actor_name || "—")}</td>
                <td>${escapeHTML(formatStatus(item.action))}</td>
                <td>${escapeHTML(formatStatus(item.environment))}</td>
                <td>
                    <span class="tc-status status-${escapeHTML(normalizeStatus(item.outcome || item.status))}">
                        ${escapeHTML(formatStatus(item.outcome || item.status))}
                    </span>
                </td>
                <td>${escapeHTML(formatDate(item.created_at || item.timestamp))}</td>
            </tr>
        `).join("");
    }


    function renderGovernanceChecks(checks = {}) {
        const mapping = {
            environments: "tc-check-environments",
            production_approval: "tc-check-approval",
            versioning: "tc-check-versioning",
            audit_logging: "tc-check-audit",
            rollback: "tc-check-rollback"
        };

        Object.entries(mapping).forEach(([key, id]) => {
            if (!(key in checks)) {
                setText(id, "Not reported");
                return;
            }

            setText(
                id,
                checks[key] === true
                    ? "Enabled"
                    : checks[key] === false
                        ? "Disabled"
                        : formatStatus(checks[key])
            );
        });
    }


    async function loadOverview() {
        hideNotice();

        const results = await Promise.allSettled([
            apiRequest(API.overview),
            apiRequest(API.environments),
            apiRequest(queryURL(API.audit, { limit: 8, page: 1 }))
        ]);

        let successful = 0;

        if (results[0].status === "fulfilled") {
            successful++;

            const overview = objectFrom(results[0].value);

            state.cache.overview = results[0].value;

            const metrics = overview.metrics || overview;

            setMetric(
                "tc-country-count",
                metrics.country_count ?? metrics.countries_count
            );

            setMetric(
                "tc-feature-count",
                metrics.enabled_feature_count ?? metrics.active_features
            );

            setMetric(
                "tc-approval-count",
                metrics.pending_approval_count ?? metrics.pending_approvals
            );

            setMetric(
                "tc-deployment-count",
                metrics.deployment_count ?? metrics.total_deployments
            );

            const admin = overview.current_admin || overview.admin || {};

            if (admin.name) {
                setText("tc-admin-name", admin.name);
            }

            if (admin.initials) {
                setText("tc-admin-avatar", admin.initials);
            }

            renderPortalStatus(overview);

            renderGovernanceChecks(
                overview.governance_checks || {}
            );
        }

        if (results[1].status === "fulfilled") {
            successful++;

            state.cache.environments = results[1].value;

            renderEnvironments(results[1].value);
        }

        if (results[2].status === "fulfilled") {
            successful++;

            renderRecentActivity(results[2].value);
        }

        if (successful === 0) {
            showNotice(
                "The configuration backend is not currently available. " +
                "The interface is ready, but live configuration records " +
                "and administrative operations require the backend API.",
                "warning"
            );

            setText("tc-sidebar-status", "Backend unavailable");

        } else {
            setText("tc-sidebar-status", "Configuration service connected");
        }

        return successful;
    }


    /* =====================================================
       9. COUNTRIES
    ===================================================== */

    function renderCountries(items) {
        const body = getElement("tc-countries-body");

        if (!body) return;

        if (!items.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="8" class="tc-table-empty">
                        No country configurations available.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML = items.map(country => `
            <tr>
                <td><strong>${escapeHTML(country.name)}</strong></td>
                <td>${escapeHTML(country.country_code)}</td>
                <td>${escapeHTML(country.currency)}</td>
                <td>${escapeHTML(country.language)}</td>
                <td>${escapeHTML(country.timezone)}</td>
                <td>${escapeHTML(country.regulatory_profile || "—")}</td>
                <td>
                    <span class="tc-status status-${escapeHTML(normalizeStatus(country.status))}">
                        ${escapeHTML(formatStatus(country.status))}
                    </span>
                </td>
                <td>
                    <button class="tc-table-action"
                            data-country-edit="${escapeHTML(country.id)}">
                        Edit
                    </button>
                </td>
            </tr>
        `).join("");
    }


    function filterCountries() {
        const search = (
            getElement("tc-country-search")?.value || ""
        ).toLowerCase();

        const status =
            getElement("tc-country-status-filter")?.value || "";

        const items = state.cache.countries || [];

        const filtered = items.filter(country => {
            const text = [
                country.name,
                country.country_code,
                country.currency,
                country.language
            ].join(" ").toLowerCase();

            return text.includes(search) &&
                (!status || country.status === status);
        });

        renderCountries(filtered);
    }


    async function loadCountries() {
        const result = await apiRequest(API.countries);

        state.cache.countries = listFrom(
            result,
            ["countries", "items", "records"]
        );

        filterCountries();
    }


    function editCountry(id) {
        const country = (state.cache.countries || [])
            .find(item => String(item.id) === String(id));

        if (!country) {
            toast("Country record not found.", "error");
            return;
        }

        const form = getElement("tc-country-form");

        if (!form) return;

        form.reset();

        Object.entries(country).forEach(([key, value]) => {
            const field = $(`[name="${CSS.escape(key)}"]`, form);

            if (field && value !== null && value !== undefined) {
                field.value = value;
            }
        });

        setText("tc-country-modal-title", "Edit Country Configuration");

        getElement("tc-country-id").value = country.id;

        openModal("tc-country-modal");
    }


    /* =====================================================
       10. PORTALS
    ===================================================== */

    function renderPortalRecords(items) {
        const body = getElement("tc-portal-records");

        if (!body) return;

        if (!items.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="6" class="tc-table-empty">
                        No portal configuration records available.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML = items.map(item => `
            <tr>
                <td>${escapeHTML(formatStatus(item.portal))}</td>
                <td>${escapeHTML(formatStatus(item.environment))}</td>
                <td>${escapeHTML(item.version || "—")}</td>
                <td>${escapeHTML(formatDate(item.updated_at))}</td>
                <td>
                    <span class="tc-status status-${escapeHTML(normalizeStatus(item.status))}">
                        ${escapeHTML(formatStatus(item.status))}
                    </span>
                </td>
                <td>
                    <button class="tc-table-action"
                            data-portal="${escapeHTML(item.portal)}">
                        Manage
                    </button>
                </td>
            </tr>
        `).join("");
    }


    async function managePortal(portal) {
        try {
            const result = await apiRequest(
                `${API.portals}/${encodeURIComponent(portal)}`
            );

            const data = objectFrom(result);

            showNotice(
                `${formatStatus(portal)} portal configuration retrieved. ` +
                `Status: ${formatStatus(data.status || "Not reported")}.`,
                "success"
            );

        } catch (error) {
            showNotice(error.message, "danger");
        }
    }


    async function loadPortals() {
        const result = await apiRequest(API.portals);

        const data = objectFrom(result);

        const items = listFrom(
            result,
            ["portals", "items", "records"]
        );

        state.cache.portals = items;

        renderPortalRecords(items);

        const portalMap = {
            employer: "tc-employer-config-status",
            employee: "tc-employee-config-status",
            super_admin: "tc-admin-config-status"
        };

        items.forEach(item => {
            const id = portalMap[item.portal];

            if (id) setStatus(id, item.status);
        });

        if (data.portal_status) {
            renderPortalStatus(data);
        }
    }


    /* =====================================================
       11. FEATURE FLAGS
    ===================================================== */

    function renderFeatures(items) {
        const body = getElement("tc-features-body");

        if (!body) return;

        if (!items.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="8" class="tc-table-empty">
                        No feature flag records available.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML = items.map(item => {
            const enabled =
                item.state === "enabled" || item.enabled === true;

            return `
                <tr>
                    <td><strong>${escapeHTML(item.name)}</strong></td>
                    <td>${escapeHTML(item.key)}</td>
                    <td>${escapeHTML(formatStatus(item.environment))}</td>
                    <td>${escapeHTML(formatStatus(item.portal))}</td>
                    <td>${escapeHTML(item.country_scope || "—")}</td>
                    <td>
                        <span class="tc-status status-${enabled ? "enabled" : "disabled"}">
                            ${enabled ? "Enabled" : "Disabled"}
                        </span>
                    </td>
                    <td>${escapeHTML(formatDate(item.updated_at))}</td>
                    <td>
                        <button class="tc-table-action ${enabled ? "danger" : ""}"
                                data-feature-toggle="${escapeHTML(item.id)}"
                                data-enabled="${enabled}">
                            ${enabled ? "Disable" : "Enable"}
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
    }


    function filterFeatures() {
        const search = (
            getElement("tc-feature-search")?.value || ""
        ).toLowerCase();

        const environment =
            getElement("tc-feature-environment")?.value || "";

        const status =
            getElement("tc-feature-status")?.value || "";

        const items = state.cache.features || [];

        const filtered = items.filter(item => {
            const enabled =
                item.state === "enabled" || item.enabled === true;

            const text = `${item.name} ${item.key}`.toLowerCase();

            return text.includes(search) &&
                (!environment || item.environment === environment) &&
                (!status || (enabled ? "enabled" : "disabled") === status);
        });

        renderFeatures(filtered);
    }


    async function loadFeatures() {
        const result = await apiRequest(API.features);

        state.cache.features = listFrom(
            result,
            ["features", "items", "records"]
        );

        filterFeatures();
    }


    async function toggleFeature(button) {
        const id = button.dataset.featureToggle;

        const enabled = button.dataset.enabled === "true";

        const reason = window.prompt(
            `Enter the reason for ${enabled ? "disabling" : "enabling"} this feature:`
        );

        if (!reason || reason.trim().length < 5) {
            toast("A meaningful change reason is required.", "warning");
            return;
        }

        const confirmed = window.confirm(
            `Submit request to ${enabled ? "disable" : "enable"} this feature?`
        );

        if (!confirmed) return;

        try {
            await apiRequest(
                `${API.features}/${encodeURIComponent(id)}/state`,
                {
                    method: "PATCH",
                    body: {
                        enabled: !enabled,
                        reason: reason.trim()
                    }
                }
            );

            toast("Feature change request submitted.");

            await loadFeatures();

        } catch (error) {
            toast(error.message, "error");
        }
    }


    /* =====================================================
       12. INTEGRATIONS
    ===================================================== */

    function renderIntegrations(items) {
        const body = getElement("tc-integrations-body");

        if (!body) return;

        if (!items.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="8" class="tc-table-empty">
                        No integration records available.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML = items.map(item => `
            <tr>
                <td><strong>${escapeHTML(item.name)}</strong></td>
                <td>${escapeHTML(formatStatus(item.type))}</td>
                <td>${escapeHTML(formatStatus(item.environment))}</td>
                <td>${escapeHTML(item.endpoint || "—")}</td>
                <td>${escapeHTML(formatStatus(item.credential_status || "Not reported"))}</td>
                <td>
                    <span class="tc-status status-${escapeHTML(normalizeStatus(item.connection_status))}">
                        ${escapeHTML(formatStatus(item.connection_status))}
                    </span>
                </td>
                <td>${escapeHTML(formatDate(item.last_checked))}</td>
                <td>
                    <button class="tc-table-action"
                            data-integration-view="${escapeHTML(item.id)}">
                        Details
                    </button>
                </td>
            </tr>
        `).join("");
    }


    function filterIntegrations() {
        const search = (
            getElement("tc-integration-search")?.value || ""
        ).toLowerCase();

        const environment =
            getElement("tc-integration-environment")?.value || "";

        const items = state.cache.integrations || [];

        renderIntegrations(items.filter(item =>
            `${item.name} ${item.type}`.toLowerCase().includes(search) &&
            (!environment || item.environment === environment)
        ));
    }


    async function loadIntegrations() {
        const result = await apiRequest(API.integrations);

        state.cache.integrations = listFrom(
            result,
            ["integrations", "items", "records"]
        );

        filterIntegrations();
    }


    async function viewIntegration(id) {
        const item = (state.cache.integrations || [])
            .find(record => String(record.id) === String(id));

        if (!item) return;

        try {
            const result = await apiRequest(
                `${API.integrations}/${encodeURIComponent(id)}`
            );

            const data = objectFrom(result);

            showNotice(
                `Integration ${data.name || item.name} details retrieved. ` +
                `Connection: ${formatStatus(data.connection_status || "Not reported")}. ` +
                `Credential values are intentionally not displayed.`,
                "success"
            );

        } catch (error) {
            toast(error.message, "error");
        }
    }


    /* =====================================================
       13. MAINTENANCE
    ===================================================== */

    function renderMaintenance(items) {
        const body = getElement("tc-maintenance-body");

        if (!body) return;

        if (!items.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="7" class="tc-table-empty">
                        No maintenance records available.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML = items.map(item => `
            <tr>
                <td>${escapeHTML(item.reference || item.id)}</td>
                <td>${escapeHTML(formatStatus(item.environment))}</td>
                <td>${escapeHTML(formatStatus(item.type || "Scheduled"))}</td>
                <td>${escapeHTML(formatDate(item.start_at))}</td>
                <td>${escapeHTML(formatDate(item.end_at))}</td>
                <td>
                    <span class="tc-status status-${escapeHTML(normalizeStatus(item.status))}">
                        ${escapeHTML(formatStatus(item.status))}
                    </span>
                </td>
                <td>${escapeHTML(item.administrator_name || "—")}</td>
            </tr>
        `).join("");
    }


    async function loadMaintenance() {
        const result = await apiRequest(API.maintenance);

        state.cache.maintenance = listFrom(
            result,
            ["maintenance", "items", "records"]
        );

        renderMaintenance(state.cache.maintenance);
    }


    /* =====================================================
       14. DEPLOYMENTS
    ===================================================== */

    function renderDeployments(items) {
        const body = getElement("tc-deployments-body");

        if (!body) return;

        if (!items.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="9" class="tc-table-empty">
                        No deployment records available.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML = items.map(item => `
            <tr>
                <td>${escapeHTML(item.reference || item.id)}</td>
                <td>${escapeHTML(formatStatus(item.source_environment))}</td>
                <td>${escapeHTML(formatStatus(item.target_environment))}</td>
                <td>${escapeHTML(item.configuration_version || "—")}</td>
                <td>${escapeHTML(item.initiated_by_name || "—")}</td>
                <td>${escapeHTML(formatStatus(item.approval_status || "Not required"))}</td>
                <td>
                    <span class="tc-status status-${escapeHTML(normalizeStatus(item.status))}">
                        ${escapeHTML(formatStatus(item.status))}
                    </span>
                </td>
                <td>${escapeHTML(formatDate(item.created_at))}</td>
                <td>
                    <button class="tc-table-action"
                            data-deployment-view="${escapeHTML(item.id)}">
                        Details
                    </button>
                </td>
            </tr>
        `).join("");
    }


    function filterDeployments() {
        const search = (
            getElement("tc-deployment-search")?.value || ""
        ).toLowerCase();

        const status =
            getElement("tc-deployment-status-filter")?.value || "";

        const items = state.cache.deployments || [];

        renderDeployments(items.filter(item =>
            `${item.reference} ${item.initiated_by_name}`.toLowerCase().includes(search) &&
            (!status || item.status === status)
        ));
    }


    async function loadDeployments() {
        const result = await apiRequest(API.deployments);

        state.cache.deployments = listFrom(
            result,
            ["deployments", "items", "records"]
        );

        filterDeployments();

        const versionSelect = getElement("tc-deployment-version");

        if (versionSelect) {
            const versions = state.cache.versions || [];

            versionSelect.innerHTML = `
                <option value="">Select version</option>
                ${versions.map(version => `
                    <option value="${escapeHTML(version.id)}">
                        ${escapeHTML(version.version || version.id)}
                    </option>
                `).join("")}
            `;
        }
    }


    async function viewDeployment(id) {
        try {
            const result = await apiRequest(
                `${API.deployments}/${encodeURIComponent(id)}`
            );

            const data = objectFrom(result);

            showNotice(
                `Deployment ${data.reference || id} retrieved. ` +
                `Status: ${formatStatus(data.status || "Not reported")}.`,
                "success"
            );

        } catch (error) {
            toast(error.message, "error");
        }
    }


    function validateDeployment(payload) {
        const allowed = {
            development: "staging",
            staging: "production"
        };

        if (allowed[payload.source_environment] !== payload.target_environment) {
            throw new Error(
                "Deployment must follow the approved sequence: Development to Staging, then Staging to Production."
            );
        }

        if (!payload.reason || payload.reason.trim().length < 10) {
            throw new Error("A detailed deployment reason is required.");
        }
    }


    /* =====================================================
       15. APPROVALS
    ===================================================== */

    function renderApprovals(payload) {
        const data = objectFrom(payload);

        const pending = Array.isArray(data.pending)
            ? data.pending
            : listFrom(payload, ["items", "approvals"]);

        const history = data.history || data.approval_history || [];

        const pendingBody = getElement("tc-approvals-body");

        const historyBody = getElement("tc-approval-history");

        if (pendingBody) {
            pendingBody.innerHTML = pending.length
                ? pending.map(item => `
                    <tr>
                        <td>${escapeHTML(item.reference || item.id)}</td>
                        <td>${escapeHTML(item.description || "Configuration deployment")}</td>
                        <td>${escapeHTML(item.initiated_by_name || "—")}</td>
                        <td>${escapeHTML(formatStatus(item.target_environment))}</td>
                        <td>${escapeHTML(item.reason || "—")}</td>
                        <td>${escapeHTML(formatDate(item.created_at))}</td>
                        <td>
                            <span class="tc-status status-pending">
                                Pending
                            </span>
                        </td>
                        <td>
                            <button class="tc-table-action"
                                    data-approval-review="${escapeHTML(item.id)}">
                                Review
                            </button>
                        </td>
                    </tr>
                `).join("")
                : `
                    <tr>
                        <td colspan="8" class="tc-table-empty">
                            No pending approval records available.
                        </td>
                    </tr>
                `;
        }

        if (historyBody) {
            historyBody.innerHTML = history.length
                ? history.map(item => `
                    <tr>
                        <td>${escapeHTML(item.reference || item.id)}</td>
                        <td>${escapeHTML(item.requested_by_name || "—")}</td>
                        <td>${escapeHTML(item.reviewed_by_name || "—")}</td>
                        <td>${escapeHTML(formatStatus(item.decision))}</td>
                        <td>${escapeHTML(item.reason || "—")}</td>
                        <td>${escapeHTML(formatDate(item.reviewed_at))}</td>
                    </tr>
                `).join("")
                : `
                    <tr>
                        <td colspan="6" class="tc-table-empty">
                            No approval history available.
                        </td>
                    </tr>
                `;
        }

        state.cache.approvals = pending;
    }


    async function loadApprovals() {
        const result = await apiRequest(API.approvals);

        renderApprovals(result);
    }


    function openApproval(id) {
        const item = (state.cache.approvals || [])
            .find(record => String(record.id) === String(id));

        if (!item) {
            toast("Approval request not found.", "error");
            return;
        }

        const form = getElement("tc-approval-form");

        form.reset();

        getElement("tc-approval-reference").value = item.id;

        openModal("tc-approval-modal");
    }


    /* =====================================================
       16. CONFIGURATION VERSIONS
    ===================================================== */

    function renderVersions(items) {
        const body = getElement("tc-versions-body");

        if (!body) return;

        if (!items.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="7" class="tc-table-empty">
                        No configuration versions available.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML = items.map(item => `
            <tr>
                <td><strong>${escapeHTML(item.version || item.id)}</strong></td>
                <td>${escapeHTML(item.configuration_name || "—")}</td>
                <td>${escapeHTML(formatStatus(item.environment))}</td>
                <td>${escapeHTML(item.created_by_name || "—")}</td>
                <td>${escapeHTML(formatStatus(item.approval_status || "Not reported"))}</td>
                <td>${escapeHTML(formatDate(item.created_at))}</td>
                <td>
                    <button class="tc-table-action"
                            data-version-rollback="${escapeHTML(item.id)}">
                        Restore
                    </button>
                </td>
            </tr>
        `).join("");
    }


    async function loadVersions() {
        const result = await apiRequest(API.versions);

        state.cache.versions = listFrom(
            result,
            ["versions", "items", "records"]
        );

        renderVersions(state.cache.versions);
    }


    async function rollbackVersion(id) {
        const version = (state.cache.versions || [])
            .find(item => String(item.id) === String(id));

        if (!version) return;

        const reason = window.prompt(
            "Explain why this configuration version should be restored:"
        );

        if (!reason || reason.trim().length < 10) {
            toast("A detailed rollback reason is required.", "warning");
            return;
        }

        const confirmed = window.confirm(
            `Request restoration of version ${version.version || id}?`
        );

        if (!confirmed) return;

        try {
            await apiRequest(
                `${API.versions}/${encodeURIComponent(id)}/rollback`,
                {
                    method: "POST",
                    body: { reason: reason.trim() }
                }
            );

            toast(
                "Rollback request submitted. Any required production approval remains in force."
            );

            await loadVersions();

        } catch (error) {
            toast(error.message, "error");
        }
    }


    /* =====================================================
       17. ENVIRONMENT COMPARISON
    ===================================================== */

    function renderComparison(payload) {
        const container = getElement("tc-comparison-results");

        if (!container) return;

        const data = objectFrom(payload);

        const differences = data.differences || data.changes || [];

        container.hidden = false;

        if (!differences.length) {
            container.innerHTML = `
                <h4>Comparison Result</h4>
                <p>No configuration differences were reported by the server.</p>
            `;

            return;
        }

        container.innerHTML = `
            <h4>Configuration Differences (${differences.length})</h4>

            ${differences.map(item => `
                <div class="tc-comparison-item">
                    <strong>${escapeHTML(item.field || item.key || "Configuration")}</strong>

                    <p>
                        Source:
                        ${escapeHTML(item.source_value ?? "—")}
                    </p>

                    <p>
                        Target:
                        ${escapeHTML(item.target_value ?? "—")}
                    </p>

                    <small>
                        ${escapeHTML(item.change_type || "Difference")}
                    </small>
                </div>
            `).join("")}
        `;
    }


    /* =====================================================
       18. AUDIT TRAIL
    ===================================================== */

    function renderAudit(payload) {
        const body = getElement("tc-audit-body");

        if (!body) return;

        const data = objectFrom(payload);

        const items = listFrom(
            payload,
            ["items", "records", "audit"]
        );

        state.auditTotal = Number(data.total ?? items.length);

        state.auditPage = Number(data.page ?? state.auditPage);

        state.auditPages = Number(
            data.pages ??
            Math.max(1, Math.ceil(state.auditTotal / 25))
        );

        setText(
            "tc-audit-count",
            `${state.auditTotal.toLocaleString()} records`
        );

        setText(
            "tc-audit-page",
            `Page ${state.auditPage} of ${state.auditPages}`
        );

        getElement("tc-audit-prev").disabled =
            state.auditPage <= 1;

        getElement("tc-audit-next").disabled =
            state.auditPage >= state.auditPages;

        if (!items.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="8" class="tc-table-empty">
                        No audit records match the selected filters.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML = items.map(item => `
            <tr>
                <td>${escapeHTML(formatDate(item.timestamp || item.created_at))}</td>
                <td>${escapeHTML(item.administrator_name || item.actor_name || "—")}</td>
                <td>${escapeHTML(formatStatus(item.action))}</td>
                <td>${escapeHTML(item.configuration_name || "—")}</td>
                <td>${escapeHTML(formatStatus(item.environment))}</td>
                <td>${escapeHTML(item.ip_address || "—")}</td>
                <td>
                    <span class="tc-status status-${escapeHTML(normalizeStatus(item.outcome || item.status))}">
                        ${escapeHTML(formatStatus(item.outcome || item.status))}
                    </span>
                </td>
                <td>
                    ${escapeHTML(item.summary || item.details || "—")}
                </td>
            </tr>
        `).join("");
    }


    async function loadAudit(page = 1) {
        state.auditPage = page;

        const result = await apiRequest(
            queryURL(API.audit, {
                page,
                limit: 25,
                search: getElement("tc-audit-search")?.value || "",
                environment: getElement("tc-audit-environment")?.value || "",
                from: getElement("tc-audit-from")?.value || "",
                to: getElement("tc-audit-to")?.value || ""
            })
        );

        state.cache.audit = result;

        renderAudit(result);
    }


    async function exportAudit() {
        const url = queryURL(`${API.audit}/export`, {
            search: getElement("tc-audit-search")?.value || "",
            environment: getElement("tc-audit-environment")?.value || "",
            from: getElement("tc-audit-from")?.value || "",
            to: getElement("tc-audit-to")?.value || ""
        });

        try {
            await apiDownload(
                url,
                `talvora-configuration-audit-${new Date().toISOString().slice(0, 10)}.csv`
            );

            toast("Audit export downloaded.");

        } catch (error) {
            toast(error.message, "error");
        }
    }


    /* =====================================================
       19. WORKSPACE LOADING
    ===================================================== */

    async function loadViewData(view) {
        if (state.loading.has(view)) return;

        state.loading.add(view);

        try {
            switch (view) {
                case "overview":
                    await loadOverview();
                    break;

                case "global":
                    await loadFormConfiguration(API.global, "tc-global-form");
                    break;

                case "countries":
                    await loadCountries();
                    break;

                case "portals":
                    await loadPortals();
                    break;

                case "features":
                    await loadFeatures();
                    break;

                case "payments":
                    await loadFormConfiguration(API.payments, "tc-payments-form");
                    break;

                case "communications":
                    await loadFormConfiguration(API.communications, "tc-communications-form");
                    break;

                case "security":
                    await loadFormConfiguration(API.security, "tc-security-form");
                    break;

                case "integrations":
                    await loadIntegrations();
                    break;

                case "localization":
                    await loadFormConfiguration(API.localization, "tc-localization-form");
                    break;

                case "operations":
                    await loadFormConfiguration(API.operations, "tc-operations-form");
                    await loadMaintenance();
                    break;

                case "deployments":
                    await loadVersions();
                    await loadDeployments();
                    break;

                case "approvals":
                    await loadApprovals();
                    break;

                case "versions":
                    await loadVersions();
                    break;

                case "audit":
                    await loadAudit(1);
                    break;
            }

        } catch (error) {
            console.error(`Unable to load ${view}:`, error);

            showNotice(
                `Unable to load ${formatStatus(view)} information: ${error.message}`,
                "warning"
            );

        } finally {
            state.loading.delete(view);
        }
    }


    /* =====================================================
       20. TAB NAVIGATION
    ===================================================== */

    function activateView(view) {
        const target = getElement(`tc-view-${view}`);

        if (!target) return;

        state.activeView = view;

        $$(".tc-module-tab").forEach(tab => {
            const active = tab.dataset.view === view;

            tab.classList.toggle("active", active);

            tab.setAttribute(
                "aria-selected",
                active ? "true" : "false"
            );
        });

        $$(".tc-view").forEach(section => {
            section.hidden = section.id !== `tc-view-${view}`;
        });

        loadViewData(view);
    }


    function refreshCurrentView() {
        return Promise.all([
            loadOverview(),
            loadViewData(state.activeView)
        ]);
    }


    $$(".tc-module-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            activateView(tab.dataset.view);
        });
    });


    $$("[data-go-view]").forEach(button => {
        button.addEventListener("click", () => {
            activateView(button.dataset.goView);
        });
    });


    /* =====================================================
       21. SIDEBAR NAVIGATION
    ===================================================== */

    const sidebar = getElement("tc-sidebar");
    const overlay = getElement("tc-sidebar-overlay");

    function openSidebar() {
        sidebar?.classList.add("open");
        overlay?.classList.add("active");
    }

    function closeSidebar() {
        sidebar?.classList.remove("open");
        overlay?.classList.remove("active");
    }

    getElement("tc-menu-button")
        ?.addEventListener("click", openSidebar);

    getElement("tc-sidebar-close")
        ?.addEventListener("click", closeSidebar);

    overlay?.addEventListener("click", closeSidebar);

    $$(".tc-nav-link").forEach(link => {
        link.addEventListener("click", closeSidebar);
    });


    /* =====================================================
       22. ACTION BUTTONS
    ===================================================== */

    function addEmergencyButton() {
        const container = $(".tc-heading-actions");

        if (!container || $('[data-action="open-emergency"]')) {
            return;
        }

        const button = document.createElement("button");

        button.type = "button";
        button.className = "tc-button tc-button-danger";
        button.dataset.action = "open-emergency";
        button.textContent = "Emergency Controls";

        container.appendChild(button);
    }


    document.addEventListener("click", event => {
        const actionButton = event.target.closest("[data-action]");

        if (actionButton) {
            const action = actionButton.dataset.action;

            const actions = {
                "open-deployment": () => openModal("tc-deployment-modal"),
                "open-country": () => {
                    getElement("tc-country-form")?.reset();
                    getElement("tc-country-id").value = "";
                    setText("tc-country-modal-title", "Add Country Configuration");
                    openModal("tc-country-modal");
                },
                "open-feature": () => {
                    getElement("tc-feature-form")?.reset();
                    openModal("tc-feature-modal");
                },
                "open-integration": () => {
                    getElement("tc-integration-form")?.reset();
                    openModal("tc-integration-modal");
                },
                "open-emergency": () => {
                    getElement("tc-emergency-form")?.reset();
                    openModal("tc-emergency-modal");
                }
            };

            actions[action]?.();
        }


        const environmentButton =
            event.target.closest("[data-environment]");

        if (environmentButton) {
            manageEnvironment(environmentButton.dataset.environment);
        }


        const portalButton =
            event.target.closest("[data-portal]");

        if (portalButton) {
            managePortal(portalButton.dataset.portal);
        }


        const countryButton =
            event.target.closest("[data-country-edit]");

        if (countryButton) {
            editCountry(countryButton.dataset.countryEdit);
        }


        const featureButton =
            event.target.closest("[data-feature-toggle]");

        if (featureButton) {
            toggleFeature(featureButton);
        }


        const integrationButton =
            event.target.closest("[data-integration-view]");

        if (integrationButton) {
            viewIntegration(integrationButton.dataset.integrationView);
        }


        const deploymentButton =
            event.target.closest("[data-deployment-view]");

        if (deploymentButton) {
            viewDeployment(deploymentButton.dataset.deploymentView);
        }


        const approvalButton =
            event.target.closest("[data-approval-review]");

        if (approvalButton) {
            openApproval(approvalButton.dataset.approvalReview);
        }


        const rollbackButton =
            event.target.closest("[data-version-rollback]");

        if (rollbackButton) {
            rollbackVersion(rollbackButton.dataset.versionRollback);
        }
    });


    /* =====================================================
       23. COUNTRY FORM
    ===================================================== */

    const countryForm = getElement("tc-country-form");

    countryForm?.addEventListener("submit", async event => {
        event.preventDefault();

        const payload = formObject(countryForm);

        const id = payload.id;

        delete payload.id;

        const endpoint = id
            ? `${API.countries}/${encodeURIComponent(id)}`
            : API.countries;

        await submitRequest({
            form: countryForm,
            endpoint,
            method: id ? "PUT" : "POST",
            successMessage: id
                ? "Country configuration update submitted."
                : "Country configuration submitted.",
            close: true
        });
    });


    /* =====================================================
       24. FEATURE FORM
    ===================================================== */

    bindForm(
        "tc-feature-form",
        API.features,
        {
            successMessage: "Feature registration submitted.",
            close: true
        }
    );


    /* =====================================================
       25. INTEGRATION FORM
    ===================================================== */

    bindForm(
        "tc-integration-form",
        API.integrations,
        {
            successMessage: "Integration registration submitted.",
            close: true
        }
    );


    /* =====================================================
       26. GLOBAL CONFIGURATION
    ===================================================== */

    bindForm(
        "tc-global-form",
        API.global,
        {
            method: "PUT",
            successMessage: "Global configuration update submitted."
        }
    );


    /* =====================================================
       27. PAYMENTS
    ===================================================== */

    bindForm(
        "tc-payments-form",
        API.payments,
        {
            method: "POST",
            successMessage: "Payment configuration submitted."
        }
    );


    /* =====================================================
       28. COMMUNICATIONS
    ===================================================== */

    bindForm(
        "tc-communications-form",
        API.communications,
        {
            method: "POST",
            successMessage: "Communication configuration submitted."
        }
    );


    /* =====================================================
       29. SECURITY
    ===================================================== */

    bindForm(
        "tc-security-form",
        API.security,
        {
            method: "POST",
            successMessage: "Security configuration submitted."
        }
    );


    /* =====================================================
       30. LOCALIZATION
    ===================================================== */

    bindForm(
        "tc-localization-form",
        API.localization,
        {
            method: "PUT",
            successMessage: "Brand and localization changes submitted."
        }
    );


    /* =====================================================
       31. OPERATIONS
    ===================================================== */

    bindForm(
        "tc-operations-form",
        API.operations,
        {
            method: "POST",
            successMessage: "Operational configuration submitted."
        }
    );


    /* =====================================================
       32. DEPLOYMENT REQUEST
    ===================================================== */

    const deploymentForm = getElement("tc-deployment-form");

    deploymentForm?.addEventListener("submit", async event => {
        event.preventDefault();

        const payload = formObject(deploymentForm);

        try {
            validateDeployment(payload);

        } catch (error) {
            toast(error.message, "warning");
            return;
        }

        await submitRequest({
            form: deploymentForm,
            endpoint: API.deployments,
            method: "POST",
            successMessage:
                "Deployment request submitted for server-side validation and approval.",
            close: true
        });
    });


    /* =====================================================
       33. APPROVAL DECISIONS
    ===================================================== */

    const approvalForm = getElement("tc-approval-form");

    approvalForm?.addEventListener("submit", async event => {
        event.preventDefault();

        const payload = formObject(approvalForm);

        const id = payload.deployment_id;

        delete payload.deployment_id;

        if (!id) {
            toast("Deployment reference is missing.", "error");
            return;
        }

        if (!payload.reason || payload.reason.trim().length < 5) {
            toast("A review reason is required.", "warning");
            return;
        }

        await submitRequest({
            form: approvalForm,
            endpoint: `${API.approvals}/${encodeURIComponent(id)}/decision`,
            method: "POST",
            successMessage: "Independent approval decision submitted.",
            close: true
        });
    });


    /* =====================================================
       34. EMERGENCY OPERATIONS
    ===================================================== */

    const emergencyForm = getElement("tc-emergency-form");

    emergencyForm?.addEventListener("submit", async event => {
        event.preventDefault();

        const payload = formObject(emergencyForm);

        if (!payload.reason || payload.reason.trim().length < 10) {
            toast("A detailed emergency justification is mandatory.", "warning");
            return;
        }

        const confirmed = window.confirm(
            "Submit this emergency configuration request for server-side authorization?"
        );

        if (!confirmed) return;

        await submitRequest({
            form: emergencyForm,
            endpoint: API.emergency,
            method: "POST",
            successMessage:
                "Emergency request submitted for authorization and audit recording.",
            close: true
        });
    });


    /* =====================================================
       35. CONFIGURATION COMPARISON
    ===================================================== */

    const compareForm = getElement("tc-compare-form");

    compareForm?.addEventListener("submit", async event => {
        event.preventDefault();

        const payload = formObject(compareForm);

        if (payload.source === payload.target) {
            toast("Select two different environments.", "warning");
            return;
        }

        try {
            const result = await apiRequest(API.compare, {
                method: "POST",
                body: payload
            });

            renderComparison(result);

            toast("Environment comparison completed.");

        } catch (error) {
            toast(error.message, "error");
        }
    });


    /* =====================================================
       36. FILTERS
    ===================================================== */

    getElement("tc-filter-countries")
        ?.addEventListener("click", filterCountries);

    getElement("tc-country-search")
        ?.addEventListener("input", filterCountries);

    getElement("tc-country-status-filter")
        ?.addEventListener("change", filterCountries);


    getElement("tc-filter-features")
        ?.addEventListener("click", filterFeatures);

    getElement("tc-feature-search")
        ?.addEventListener("input", filterFeatures);

    getElement("tc-feature-environment")
        ?.addEventListener("change", filterFeatures);

    getElement("tc-feature-status")
        ?.addEventListener("change", filterFeatures);


    getElement("tc-filter-integrations")
        ?.addEventListener("click", filterIntegrations);

    getElement("tc-integration-search")
        ?.addEventListener("input", filterIntegrations);

    getElement("tc-integration-environment")
        ?.addEventListener("change", filterIntegrations);


    getElement("tc-filter-deployments")
        ?.addEventListener("click", filterDeployments);

    getElement("tc-deployment-search")
        ?.addEventListener("input", filterDeployments);

    getElement("tc-deployment-status-filter")
        ?.addEventListener("change", filterDeployments);


    getElement("tc-filter-audit")
        ?.addEventListener("click", () => loadAudit(1));


    /* =====================================================
       37. AUDIT PAGINATION
    ===================================================== */

    getElement("tc-audit-prev")
        ?.addEventListener("click", () => {
            if (state.auditPage > 1) {
                loadAudit(state.auditPage - 1);
            }
        });

    getElement("tc-audit-next")
        ?.addEventListener("click", () => {
            if (state.auditPage < state.auditPages) {
                loadAudit(state.auditPage + 1);
            }
        });

    getElement("tc-export-audit")
        ?.addEventListener("click", exportAudit);


    /* =====================================================
       38. REFRESH
    ===================================================== */

    getElement("tc-refresh")
        ?.addEventListener("click", async () => {
            const button = getElement("tc-refresh");

            button.disabled = true;
            button.textContent = "Refreshing...";

            try {
                await refreshCurrentView();

                toast("Configuration information refreshed.");

            } catch (error) {
                toast(error.message, "error");

            } finally {
                button.disabled = false;
                button.textContent = "↻ Refresh";
            }
        });


    /* =====================================================
       39. NOTIFICATIONS
    ===================================================== */

    getElement("tc-notifications")
        ?.addEventListener("click", () => {
            window.location.href = "legacy/communications.html";
        });


    /* =====================================================
       40. INITIALIZATION
    ===================================================== */

    async function initialize() {
        addEmergencyButton();

        // The initial view is overview.
        activateView("overview");

        // Attempt to retrieve actual platform records.
        await loadOverview();

        // Do not insert demo records when the backend is unavailable.
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, {
            once: true
        });
    } else {
        initialize();
    }

})();
