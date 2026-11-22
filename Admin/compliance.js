
(() => {
    "use strict";

    const DEFAULT_ENDPOINTS = {
        dashboard: "/api/compliance/dashboard",
        obligations: "/api/compliance/obligations",
        privacy: "/api/compliance/privacy-requests",
        consent: "/api/compliance/consents",
        retention: "/api/compliance/retention-policies",
        retentionReviews: "/api/compliance/retention-reviews",
        incidents: "/api/compliance/data-incidents",
        jurisdictions: "/api/compliance/jurisdictions",
        alerts: "/api/compliance/alerts",
        metadata: "/api/compliance/metadata"
    };

    const supplied = window.TALVORA_COMPLIANCE_CONFIG || {};

    const CONFIG = {
        apiBaseUrl: document.documentElement.dataset.apiBase || "",
        timeout: 20000,
        refreshInterval: 30000,
        endpoints: { ...DEFAULT_ENDPOINTS, ...(supplied.endpoints || {}) },
        ...supplied
    };

    CONFIG.endpoints = { ...DEFAULT_ENDPOINTS, ...(supplied.endpoints || {}) };

    const state = {
        countries: [],
        selectedRequest: null,
        refreshTimer: null
    };

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

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

    function formatDate(value) {
        if (!value) return "—";
        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? String(value)
            : new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short"
            }).format(date);
    }

    function formatNumber(value) {
        if (value === null || value === undefined) return "—";
        const number = Number(value);
        return Number.isFinite(number) ? new Intl.NumberFormat().format(number) : "—";
    }

    function endpoint(path) {
        return CONFIG.apiBaseUrl.replace(/\/+$/, "") +
            (path.startsWith("/") ? path : `/${path}`);
    }

    async function api(path, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CONFIG.timeout);

        const headers = new Headers(options.headers || {});
        headers.set("Accept", "application/json");

        const csrf = $('meta[name="csrf-token"]')?.content;
        if (csrf) headers.set("X-CSRF-Token", csrf);

        let body = options.body;

        if (body && !(body instanceof FormData) && typeof body !== "string") {
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
                const message = await response.text().catch(() => "");
                throw new Error(message || `Request failed (${response.status})`);
            }

            if (response.status === 204) return null;

            const type = response.headers.get("content-type") || "";

            return type.includes("application/json")
                ? response.json()
                : response.text();

        } finally {
            clearTimeout(timeout);
        }
    }

    function query(params = {}) {
        const search = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value !== "" && value !== null && value !== undefined) {
                search.set(key, value);
            }
        });

        const result = search.toString();
        return result ? `?${result}` : "";
    }

    function records(payload, ...keys) {
        if (Array.isArray(payload)) return payload;

        const source = payload?.data && !Array.isArray(payload.data)
            ? payload.data
            : payload;

        for (const key of keys) {
            if (Array.isArray(source?.[key])) return source[key];
            if (Array.isArray(payload?.[key])) return payload[key];
        }

        return [];
    }

    function metric(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = formatNumber(value);
    }

    function toast(message, type = "info") {
        const region = $("#toastRegion");
        const item = document.createElement("div");

        item.className = `toast ${type}`;
        item.textContent = message;

        region.appendChild(item);
        setTimeout(() => item.remove(), 4500);
    }

    function setConnection(status, message) {
        const element = $("#connectionStatus");
        element.className = `connection-status ${status}`;
        element.innerHTML = `<i></i>${escapeHTML(message)}`;
    }

    function badge(value) {
        const safe = String(value || "").toLowerCase();
        return `<span class="badge ${escapeHTML(safe)}">${escapeHTML(humanize(value))}</span>`;
    }

    function emptyRow(columns, message = "No records available.") {
        return `<tr><td colspan="${columns}">${escapeHTML(message)}</td></tr>`;
    }

    function showModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.hidden = false;
    }

    function closeModal(modal) {
        if (modal) modal.hidden = true;
    }

    // NAVIGATION

    function navigate(section) {
        if (!document.getElementById(section)) return;

        $$(".content-section").forEach(item => {
            item.classList.toggle("active", item.id === section);
        });

        $$(".nav-link[data-section]").forEach(link => {
            link.classList.toggle("active", link.dataset.section === section);
        });

        $("#sidebar").classList.remove("open");

        const loaders = {
            obligations: loadObligations,
            privacy: loadPrivacy,
            consent: loadConsent,
            retention: loadRetention,
            "data-incidents": loadDataIncidents,
            jurisdictions: loadJurisdictions
        };

        if (loaders[section]) loaders[section]();
    }

    // OVERVIEW

    async function loadDashboard() {
        try {
            const payload = await api(CONFIG.endpoints.dashboard);
            const data = payload?.data || payload || {};
            const metrics = data.metrics || data.summary || data;

            metric("totalObligations",
                metrics.totalObligations ?? metrics.total_obligations);

            metric("openIssues",
                metrics.openIssues ?? metrics.open_issues);

            metric("privacyRequests",
                metrics.privacyRequests ?? metrics.privacy_requests);

            metric("overdueRequests",
                metrics.overdueRequests ?? metrics.overdue_requests);

            metric("activePolicies",
                metrics.activePolicies ?? metrics.active_policies);

            metric("dataIncidents",
                metrics.dataIncidents ?? metrics.data_incidents);

            metric("requestsReceived",
                metrics.requestsReceived ?? metrics.requests_received);

            metric("requestsProcessing",
                metrics.requestsProcessing ?? metrics.requests_processing);

            metric("requestsAwaiting",
                metrics.requestsAwaiting ?? metrics.requests_awaiting);

            renderJurisdictionChart(
                data.jurisdictionSummary || data.jurisdiction_summary || []
            );

            renderRequestBreakdown(
                data.requestDistribution || data.request_distribution || {}
            );

            renderActions(
                records(data, "priorityActions", "priority_actions", "actions")
            );

            $("#bannerMessage").textContent =
                data.governanceMessage ||
                data.governance_message ||
                "Compliance information retrieved.";

            setConnection("connected", "Connected");

        } catch (error) {
            setConnection("error", "Connection issue");
            $("#bannerMessage").textContent =
                "Compliance information could not be retrieved.";

            console.error("[TALVORA Compliance] Dashboard:", error);
        }
    }

    function renderJurisdictionChart(items) {
        const container = $("#jurisdictionChart");

        if (!items.length) {
            container.textContent = "No jurisdiction summary available.";
            return;
        }

        const maximum = Math.max(
            1,
            ...items.map(item => Number(item.count ?? item.score ?? 0))
        );

        container.innerHTML = items.map(item => {
            const value = Number(item.count ?? item.score ?? 0);
            const width = Math.max(0, value / maximum * 100);

            return `
        <div class="chart-row">
          <span>${escapeHTML(item.country || item.name || "—")}</span>
          <div class="chart-track">
            <div class="chart-fill" style="width:${width}%"></div>
          </div>
          <strong>${formatNumber(value)}</strong>
        </div>
      `;
        }).join("");
    }

    function renderRequestBreakdown(distribution) {
        const container = $("#requestBreakdown");
        const types = ["received", "processing", "awaiting_information", "completed", "overdue"];

        const items = types.map(type => ({
            type,
            count: Number(
                distribution[type] ??
                distribution[`${type}_count`] ??
                0
            )
        }));

        const total = items.reduce((sum, item) => sum + item.count, 0);

        if (!total) {
            container.textContent = "No privacy request distribution available.";
            return;
        }

        container.innerHTML = items.map(item => {
            const width = item.count / total * 100;

            return `
        <div class="breakdown-row">
          <span>${escapeHTML(humanize(item.type))}</span>
          <div class="breakdown-track">
            <div class="breakdown-fill" style="width:${width}%"></div>
          </div>
          <strong>${formatNumber(item.count)}</strong>
        </div>
      `;
        }).join("");
    }

    function renderActions(items) {
        const container = $("#complianceActions");

        container.innerHTML = items.length
            ? items.map(item => `
        <div class="action-item">
          <strong>${escapeHTML(item.title || item.subject || "Compliance action")}</strong>
          ${escapeHTML(item.description || item.message || "")}
        </div>
      `).join("")
            : "<p>No outstanding priority actions were returned.</p>";
    }

    // METADATA

    async function loadMetadata() {
        try {
            const payload = await api(CONFIG.endpoints.metadata);
            const data = payload?.data || payload || {};

            state.countries = records(data, "countries", "jurisdictions");

            const options = state.countries.map(item => {
                if (typeof item === "string") return { value: item, label: item };

                return {
                    value: item.code || item.id || item.name,
                    label: item.name || item.label || item.code
                };
            });

            const selects = [
                $("#obligationCountry"),
                $("#requestCountry"),
                $("#incidentCountry")
            ];

            selects.forEach(select => {
                const current = select.value;

                select.innerHTML =
                    `<option value="">${select.id === "obligationCountry" ? "All jurisdictions" : "Select jurisdiction"}</option>` +
                    options.map(item =>
                        `<option value="${escapeHTML(item.value)}">${escapeHTML(item.label)}</option>`
                    ).join("");

                select.value = current;
            });

        } catch (error) {
            console.warn("[TALVORA Compliance] Metadata unavailable:", error);
        }
    }

    // REGULATORY OBLIGATIONS

    async function loadObligations() {
        const body = $("#obligationsTable");

        body.innerHTML = emptyRow(8, "Loading obligations...");

        try {
            const payload = await api(CONFIG.endpoints.obligations + query({
                search: $("#obligationSearch").value.trim(),
                country: $("#obligationCountry").value,
                status: $("#obligationStatus").value
            }));

            const items = records(payload, "obligations", "items", "results");

            body.innerHTML = items.length ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || item.reference || "—")}</td>
          <td>${escapeHTML(item.title || item.requirement || "—")}</td>
          <td>${escapeHTML(item.country || item.jurisdiction || "—")}</td>
          <td>${escapeHTML(humanize(item.category))}</td>
          <td>${escapeHTML(item.ownerName || item.owner_name || "—")}</td>
          <td>${escapeHTML(formatDate(item.reviewDate || item.review_date))}</td>
          <td>${badge(item.status)}</td>
          <td><button data-review-obligation="${escapeHTML(item.id)}">Review</button></td>
        </tr>
      `).join("") : emptyRow(8);

        } catch (error) {
            body.innerHTML = emptyRow(8, "Obligations could not be loaded.");
            console.error(error);
        }
    }

    async function reviewObligation(id) {
        try {
            const payload = await api(
                `${CONFIG.endpoints.obligations}/${encodeURIComponent(id)}`
            );

            const item = payload?.obligation || payload?.data || payload;

            const newStatus = window.prompt(
                `Current status: ${item.status || "unknown"}\nEnter the new status: compliant, review_required, non_compliant or pending`,
                item.status || "review_required"
            );

            if (!newStatus) return;

            const allowed = ["compliant", "review_required", "non_compliant", "pending"];

            if (!allowed.includes(newStatus)) {
                toast("Invalid obligation status.", "error");
                return;
            }

            await api(`${CONFIG.endpoints.obligations}/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: { status: newStatus }
            });

            toast("Obligation updated.", "success");
            await Promise.all([loadObligations(), loadDashboard()]);

        } catch (error) {
            toast(`Obligation update failed: ${error.message}`, "error");
        }
    }

    // PRIVACY REQUESTS

    async function loadPrivacy() {
        const body = $("#privacyTable");

        body.innerHTML = emptyRow(9, "Loading privacy requests...");

        try {
            const payload = await api(CONFIG.endpoints.privacy + query({
                search: $("#privacySearch").value.trim(),
                type: $("#privacyType").value,
                status: $("#privacyStatus").value
            }));

            const items = records(payload, "requests", "items", "results");

            body.innerHTML = items.length ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || item.requestId || "—")}</td>
          <td>${escapeHTML(item.individualName || item.individual_name || "—")}</td>
          <td>${escapeHTML(humanize(item.requestType || item.request_type))}</td>
          <td>${escapeHTML(item.country || "—")}</td>
          <td>${escapeHTML(formatDate(item.receivedAt || item.received_at))}</td>
          <td>${escapeHTML(formatDate(item.deadline || item.dueDate || item.due_date))}</td>
          <td>${escapeHTML(item.assigneeName || item.assignee_name || "Unassigned")}</td>
          <td>${badge(item.status)}</td>
          <td><button data-review-privacy="${escapeHTML(item.id)}">Review</button></td>
        </tr>
      `).join("") : emptyRow(9);

        } catch (error) {
            body.innerHTML = emptyRow(9, "Privacy requests could not be loaded.");
            console.error(error);
        }
    }

    async function createPrivacyRequest(form) {
        const button = form.querySelector('[type="submit"]');
        const payload = Object.fromEntries(new FormData(form).entries());

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.privacy, {
                method: "POST",
                body: payload
            });

            form.reset();
            closeModal($("#requestModal"));

            toast("Privacy request registered.", "success");

            await Promise.all([loadPrivacy(), loadDashboard()]);

        } catch (error) {
            toast(`Privacy request could not be registered: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    async function reviewPrivacy(id) {
        try {
            const payload = await api(
                `${CONFIG.endpoints.privacy}/${encodeURIComponent(id)}`
            );

            const item = payload?.request || payload?.data || payload;

            const status = window.prompt(
                "Enter the new request status:\nreceived, verification, processing, awaiting_information, completed, rejected",
                item.status || "processing"
            );

            if (!status) return;

            const allowed = [
                "received", "verification", "processing",
                "awaiting_information", "completed", "rejected"
            ];

            if (!allowed.includes(status)) {
                toast("Invalid privacy request status.", "error");
                return;
            }

            const notes = window.prompt("Enter an administrative note (optional):", "");

            await api(`${CONFIG.endpoints.privacy}/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: { status, notes: notes || "" }
            });

            toast("Privacy request updated.", "success");
            await Promise.all([loadPrivacy(), loadDashboard()]);

        } catch (error) {
            toast(`Privacy request update failed: ${error.message}`, "error");
        }
    }

    // CONSENT MANAGEMENT

    async function loadConsent() {
        const body = $("#consentTable");
        body.innerHTML = emptyRow(8, "Loading consent records...");

        try {
            const payload = await api(CONFIG.endpoints.consent + query({
                search: $("#consentSearch").value.trim(),
                status: $("#consentStatus").value,
                purpose: $("#consentPurpose").value
            }));

            const items = records(payload, "consents", "items", "results");

            body.innerHTML = items.length ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || "—")}</td>
          <td>${escapeHTML(item.individualName || item.individual_name || "—")}</td>
          <td>${escapeHTML(humanize(item.purpose))}</td>
          <td>${escapeHTML(humanize(item.method))}</td>
          <td>${escapeHTML(formatDate(item.grantedAt || item.granted_at))}</td>
          <td>${escapeHTML(formatDate(item.withdrawnAt || item.withdrawn_at))}</td>
          <td>${escapeHTML(item.country || "—")}</td>
          <td>${badge(item.status)}</td>
        </tr>
      `).join("") : emptyRow(8);

        } catch (error) {
            body.innerHTML = emptyRow(8, "Consent records could not be loaded.");
            console.error(error);
        }
    }

    // RETENTION MANAGEMENT

    async function loadRetention() {
        try {
            const payload = await api(CONFIG.endpoints.retention);
            const items = records(payload, "policies", "items", "results");

            $("#retentionPolicies").innerHTML = items.length ? items.map(item => `
        <article class="policy-card">
          <h3>${escapeHTML(item.name || item.title || "Retention policy")}</h3>
          <p>${escapeHTML(item.description || "")}</p>
          <p>Record category: ${escapeHTML(humanize(item.recordCategory || item.record_category))}</p>
          <p>Retention period: ${escapeHTML(item.retentionPeriod || item.retention_period || "—")}</p>
          <p>Jurisdiction: ${escapeHTML(item.country || item.jurisdiction || "—")}</p>
          <label>
            <input type="checkbox"
              data-retention-toggle="${escapeHTML(item.id)}"
              ${item.enabled ? "checked" : ""}>
            Policy enabled
          </label>
        </article>
      `).join("") : "<p>No retention policies available.</p>";

        } catch (error) {
            $("#retentionPolicies").innerHTML = "<p>Retention policies could not be loaded.</p>";
            console.error(error);
        }

        try {
            const payload = await api(CONFIG.endpoints.retentionReviews);
            const items = records(payload, "reviews", "items", "results");

            $("#retentionTable").innerHTML = items.length ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.reference || item.id || "—")}</td>
          <td>${escapeHTML(humanize(item.category))}</td>
          <td>${escapeHTML(item.country || "—")}</td>
          <td>${escapeHTML(item.policyName || item.policy_name || "—")}</td>
          <td>${escapeHTML(formatDate(item.reviewDate || item.review_date))}</td>
          <td>${badge(item.status)}</td>
        </tr>
      `).join("") : emptyRow(6);

        } catch (error) {
            $("#retentionTable").innerHTML = emptyRow(6, "Retention reviews could not be loaded.");
            console.error(error);
        }
    }

    async function updateRetentionPolicy(id, enabled) {
        try {
            await api(`${CONFIG.endpoints.retention}/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: { enabled }
            });

            toast("Retention policy updated.", "success");

        } catch (error) {
            toast(`Policy update failed: ${error.message}`, "error");
            loadRetention();
        }
    }

    // DATA INCIDENTS

    async function loadDataIncidents() {
        const body = $("#dataIncidentsTable");
        body.innerHTML = emptyRow(8, "Loading data incidents...");

        try {
            const payload = await api(CONFIG.endpoints.incidents + query({
                search: $("#dataIncidentSearch").value.trim(),
                status: $("#dataIncidentStatus").value
            }));

            const items = records(payload, "incidents", "items", "results");

            body.innerHTML = items.length ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || "—")}</td>
          <td>${escapeHTML(humanize(item.category))}</td>
          <td>${escapeHTML(item.country || item.jurisdiction || "—")}</td>
          <td>${escapeHTML(formatDate(item.discoveredAt || item.discovered_at))}</td>
          <td>${badge(item.severity)}</td>
          <td>${escapeHTML(humanize(item.notificationAssessment || item.notification_assessment))}</td>
          <td>${badge(item.status)}</td>
          <td><button data-review-data-incident="${escapeHTML(item.id)}">Review</button></td>
        </tr>
      `).join("") : emptyRow(8);

        } catch (error) {
            body.innerHTML = emptyRow(8, "Data incidents could not be loaded.");
            console.error(error);
        }
    }

    async function createDataIncident(form) {
        const button = form.querySelector('[type="submit"]');
        const payload = Object.fromEntries(new FormData(form).entries());

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.incidents, {
                method: "POST",
                body: payload
            });

            form.reset();
            closeModal($("#dataIncidentModal"));

            toast("Data protection incident registered.", "success");

            await Promise.all([loadDataIncidents(), loadDashboard()]);

        } catch (error) {
            toast(`Incident registration failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    async function reviewDataIncident(id) {
        const status = window.prompt(
            "Enter new status:\nreported, investigating, contained, notification_review, resolved, closed",
            "investigating"
        );

        if (!status) return;

        const allowed = [
            "reported", "investigating", "contained",
            "notification_review", "resolved", "closed"
        ];

        if (!allowed.includes(status)) {
            toast("Invalid data incident status.", "error");
            return;
        }

        try {
            await api(`${CONFIG.endpoints.incidents}/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: { status }
            });

            toast("Data incident updated.", "success");
            await Promise.all([loadDataIncidents(), loadDashboard()]);

        } catch (error) {
            toast(`Incident update failed: ${error.message}`, "error");
        }
    }

    // JURISDICTIONS

    async function loadJurisdictions() {
        const container = $("#jurisdictionGrid");
        container.innerHTML = "<p>Loading jurisdictions...</p>";

        try {
            const payload = await api(CONFIG.endpoints.jurisdictions);
            const items = records(payload, "jurisdictions", "countries", "items");

            container.innerHTML = items.length ? items.map(item => `
        <article class="jurisdiction-card">
          <h3>${escapeHTML(item.name || item.country || "Jurisdiction")}</h3>
          <p>Country code: ${escapeHTML(item.code || "—")}</p>
          <p>Applicable frameworks: ${escapeHTML(
                Array.isArray(item.frameworks)
                    ? item.frameworks.join(", ")
                    : item.frameworks || "—"
            )}</p>
          <p>Responsible authority: ${escapeHTML(item.authority || "—")}</p>
          <p>Compliance status: ${escapeHTML(humanize(item.status))}</p>
          <p>Last review: ${escapeHTML(formatDate(item.lastReview || item.last_review))}</p>
        </article>
      `).join("") : "<p>No jurisdiction records available.</p>";

        } catch (error) {
            container.innerHTML = "<p>Jurisdiction information could not be loaded.</p>";
            console.error(error);
        }
    }

    // EVENTS

    function debounce(callback, delay = 350) {
        let timer;

        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => callback(...args), delay);
        };
    }

    function bindEvents() {
        $$(".nav-link[data-section]").forEach(link => {
            link.addEventListener("click", event => {
                event.preventDefault();
                navigate(link.dataset.section);
            });
        });

        $("#menuToggle").addEventListener("click", () => {
            $("#sidebar").classList.toggle("open");
        });

        $("#refreshButton").addEventListener("click", refreshAll);

        $("#alertsButton").addEventListener("click", () => {
            navigate("data-incidents");
        });

        $$("[data-open-request]").forEach(button => {
            button.addEventListener("click", () => showModal("requestModal"));
        });

        $("#registerDataIncident").addEventListener("click", () => {
            showModal("dataIncidentModal");
        });

        $$("[data-close-modal]").forEach(button => {
            button.addEventListener("click", () => {
                closeModal(button.closest(".modal-overlay"));
            });
        });

        $$(".modal-overlay").forEach(modal => {
            modal.addEventListener("click", event => {
                if (event.target === modal) closeModal(modal);
            });
        });

        $("#privacyRequestForm").addEventListener("submit", event => {
            event.preventDefault();
            createPrivacyRequest(event.currentTarget);
        });

        $("#dataIncidentForm").addEventListener("submit", event => {
            event.preventDefault();
            createDataIncident(event.currentTarget);
        });

        $("#obligationSearch").addEventListener("input", debounce(loadObligations));
        $("#obligationCountry").addEventListener("change", loadObligations);
        $("#obligationStatus").addEventListener("change", loadObligations);

        $("#privacySearch").addEventListener("input", debounce(loadPrivacy));
        $("#privacyType").addEventListener("change", loadPrivacy);
        $("#privacyStatus").addEventListener("change", loadPrivacy);

        $("#consentSearch").addEventListener("input", debounce(loadConsent));
        $("#consentStatus").addEventListener("change", loadConsent);
        $("#consentPurpose").addEventListener("change", loadConsent);

        $("#dataIncidentSearch").addEventListener("input", debounce(loadDataIncidents));
        $("#dataIncidentStatus").addEventListener("change", loadDataIncidents);

        document.addEventListener("click", event => {
            const obligation = event.target.closest("[data-review-obligation]");
            if (obligation) reviewObligation(obligation.dataset.reviewObligation);

            const privacy = event.target.closest("[data-review-privacy]");
            if (privacy) reviewPrivacy(privacy.dataset.reviewPrivacy);

            const incident = event.target.closest("[data-review-data-incident]");
            if (incident) reviewDataIncident(incident.dataset.reviewDataIncident);

            const retention = event.target.closest("[data-retention-toggle]");
            if (retention) {
                updateRetentionPolicy(
                    retention.dataset.retentionToggle,
                    retention.checked
                );
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                $$(".modal-overlay").forEach(closeModal);
            }
        });
    }

    async function refreshAll() {
        await Promise.allSettled([
            loadDashboard(),
            loadPrivacy(),
            loadObligations()
        ]);
    }

    async function initialize() {
        bindEvents();
        await loadMetadata();
        await refreshAll();

        state.refreshTimer = setInterval(() => {
            loadDashboard();
        }, CONFIG.refreshInterval);
    }

    document.addEventListener("DOMContentLoaded", initialize);

    window.TALVORA_COMPLIANCE = {
        refresh: refreshAll,
        navigate,
        loadPrivacy,
        loadObligations,
        config: CONFIG
    };

})();
