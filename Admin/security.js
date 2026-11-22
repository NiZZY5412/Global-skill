
(() => {
    "use strict";

    const CONFIG = {
        apiBaseUrl: document.documentElement.dataset.apiBase || "",
        refreshInterval: 30000,
        timeout: 20000,
        eventStreamUrl: "",
        endpoints: {
            dashboard: "/api/security/dashboard",
            incidents: "/api/security/incidents",
            threats: "/api/security/threats",
            access: "/api/security/access-events",
            sessions: "/api/security/sessions",
            policies: "/api/security/policies",
            investigations: "/api/security/investigations",
            alerts: "/api/security/alerts"
        },
        ...(window.TALVORA_SECURITY_CONFIG || {})
    };

    CONFIG.endpoints = {
        ...{
            dashboard: "/api/security/dashboard",
            incidents: "/api/security/incidents",
            threats: "/api/security/threats",
            access: "/api/security/access-events",
            sessions: "/api/security/sessions",
            policies: "/api/security/policies",
            investigations: "/api/security/investigations",
            alerts: "/api/security/alerts"
        },
        ...(window.TALVORA_SECURITY_CONFIG?.endpoints || {})
    };

    const state = {
        selectedIncident: null,
        refreshTimer: null,
        eventSource: null
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
        return Number.isFinite(number)
            ? new Intl.NumberFormat().format(number)
            : "—";
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
                body,
                headers,
                credentials: "include",
                signal: options.signal || controller.signal
            });

            if (!response.ok) {
                const message = await response.text().catch(() => "");
                throw new Error(message || `Server returned ${response.status}`);
            }

            if (response.status === 204) return null;

            const contentType = response.headers.get("content-type") || "";

            return contentType.includes("application/json")
                ? await response.json()
                : await response.text();

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

    function connection(status, message) {
        const element = $("#connectionStatus");

        element.className = `connection-status ${status}`;
        element.innerHTML = `<i></i>${escapeHTML(message)}`;
    }

    function showModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.hidden = false;
    }

    function closeModal(modal) {
        if (modal) modal.hidden = true;
    }

    function badge(value, type = "") {
        const safe = String(value || "").toLowerCase();
        return `<span class="badge ${type || safe}">${escapeHTML(humanize(value))}</span>`;
    }

    function emptyRow(columns, message = "No records available.") {
        return `<tr><td colspan="${columns}">${escapeHTML(message)}</td></tr>`;
    }

    function activateSection(section) {
        const target = document.getElementById(section);
        if (!target) return;

        $$(".content-section").forEach(item => {
            item.classList.toggle("active", item.id === section);
        });

        $$(".nav-link[data-section]").forEach(link => {
            link.classList.toggle("active", link.dataset.section === section);
        });

        if (section === "incidents") loadIncidents();
        if (section === "threats") loadThreats();
        if (section === "access") loadAccess();
        if (section === "sessions") loadSessions();
        if (section === "policies") loadPolicies();
        if (section === "investigations") loadInvestigations();
        if (section === "security-alerts") loadAlerts();
    }

    // DASHBOARD

    async function loadDashboard() {
        try {
            const [dashboardPayload, incidentPayload] = await Promise.all([
                api(CONFIG.endpoints.dashboard),
                api(CONFIG.endpoints.incidents + query({ page: 1, pageSize: 8 }))
            ]);

            const dashboard = dashboardPayload?.data || dashboardPayload || {};
            const metrics = dashboard.metrics || dashboard.summary || dashboard;

            metric("totalIncidents", metrics.totalIncidents ?? metrics.total_incidents);
            metric("criticalThreats", metrics.criticalThreats ?? metrics.critical_threats);
            metric("suspiciousLogins", metrics.suspiciousLogins ?? metrics.suspicious_logins);
            metric("activeSessions", metrics.activeSessions ?? metrics.active_sessions);
            metric("blockedAttempts", metrics.blockedAttempts ?? metrics.blocked_attempts);
            metric("openInvestigations", metrics.openInvestigations ?? metrics.open_investigations);

            metric("threatsDetected", metrics.threatsDetected ?? metrics.threats_detected);
            metric("unresolvedThreats", metrics.unresolvedThreats ?? metrics.unresolved_threats);
            metric("containedThreats", metrics.containedThreats ?? metrics.contained_threats);

            renderSeverity(dashboard.severityDistribution || dashboard.severity_distribution || {});
            renderTrend(dashboard.incidentTrend || dashboard.incident_trend || []);

            const incidents = records(
                incidentPayload,
                "incidents",
                "items",
                "results"
            );

            renderRecentIncidents(incidents);

            $("#bannerMessage").textContent =
                dashboard.securityMessage ||
                dashboard.security_message ||
                "Security monitoring data successfully retrieved.";

            connection("connected", "Connected");

        } catch (error) {
            connection("error", "Connection issue");
            $("#bannerMessage").textContent =
                "Security monitoring data could not be retrieved.";

            console.error("[TALVORA Security] Dashboard:", error);
        }
    }

    function renderSeverity(distribution) {
        const container = $("#severityBreakdown");

        const levels = ["critical", "high", "medium", "low"];

        const values = levels.map(level => ({
            level,
            count: Number(
                distribution[level] ??
                distribution[`${level}Count`] ??
                distribution[`${level}_count`] ?? 0
            )
        }));

        const total = values.reduce((sum, item) => sum + item.count, 0);

        if (!total) {
            container.innerHTML = "<p>No severity distribution data available.</p>";
            return;
        }

        container.innerHTML = values.map(item => {
            const percentage = item.count / total * 100;

            return `
        <div class="severity-row">
          <span>${humanize(item.level)}</span>
          <div class="severity-track">
            <div class="severity-fill ${item.level}"
                 style="width:${percentage}%"></div>
          </div>
          <strong>${formatNumber(item.count)}</strong>
        </div>
      `;
        }).join("");
    }

    function renderTrend(series) {
        const container = $("#incidentChart");
        const items = records(series, "points", "items");

        if (!items.length) {
            container.innerHTML = "<p>No security trend data available.</p>";
            return;
        }

        const maximum = Math.max(
            1,
            ...items.map(item => Number(item.count ?? item.value ?? 0))
        );

        container.innerHTML = `
      <div class="chart-bars">
        ${items.map(item => {
            const value = Number(item.count ?? item.value ?? 0);
            const height = Math.max(3, value / maximum * 100);

            return `
            <div class="chart-column">
              <div class="chart-bar" style="height:${height}%"></div>
              <span>${escapeHTML(item.label || item.date || "")}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
    }

    function renderRecentIncidents(items) {
        $("#recentIncidents").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || item.incidentId || "—")}</td>
          <td>${escapeHTML(item.title || item.description || "—")}</td>
          <td>${escapeHTML(humanize(item.portal))}</td>
          <td>${badge(item.severity)}</td>
          <td>${badge(item.status, `status-${item.status}`)}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td><button data-incident-open="${escapeHTML(item.id)}">Review</button></td>
        </tr>
      `).join("")
            : emptyRow(7, "No recent security incidents.");
    }

    // INCIDENT MANAGEMENT

    async function loadIncidents() {
        const params = {
            search: $("#incidentSearch").value.trim(),
            severity: $("#incidentSeverity").value,
            status: $("#incidentStatus").value
        };

        const body = $("#incidentsTable");
        body.innerHTML = emptyRow(8, "Loading incidents...");

        try {
            const payload = await api(CONFIG.endpoints.incidents + query(params));
            const items = records(payload, "incidents", "items", "results");

            body.innerHTML = items.length ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || item.incidentId || "—")}</td>
          <td>${escapeHTML(item.title || "—")}</td>
          <td>${escapeHTML(humanize(item.category))}</td>
          <td>${escapeHTML(humanize(item.portal))}</td>
          <td>${badge(item.severity)}</td>
          <td>${escapeHTML(item.assigneeName || item.assignee_name || "Unassigned")}</td>
          <td>${badge(item.status, `status-${item.status}`)}</td>
          <td><button data-incident-open="${escapeHTML(item.id)}">Open</button></td>
        </tr>
      `).join("") : emptyRow(8);

        } catch (error) {
            body.innerHTML = emptyRow(8, "Unable to load incident records.");
            console.error("[TALVORA Security] Incidents:", error);
        }
    }

    async function createIncident(form) {
        const button = form.querySelector('[type="submit"]');
        const payload = Object.fromEntries(new FormData(form).entries());

        button.disabled = true;

        try {
            const result = await api(CONFIG.endpoints.incidents, {
                method: "POST",
                body: payload
            });

            closeModal($("#incidentModal"));
            form.reset();

            toast("Security incident registered.", "success");

            await Promise.all([loadDashboard(), loadIncidents()]);

            const incident = result?.incident || result?.data || result;

            if (incident?.id) openIncident(incident.id);

        } catch (error) {
            toast(`Incident registration failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    async function openIncident(id) {
        if (!id) return;

        try {
            const payload = await api(
                `${CONFIG.endpoints.incidents}/${encodeURIComponent(id)}`
            );

            const item = payload?.incident || payload?.data?.incident ||
                payload?.data || payload;

            state.selectedIncident = item;

            $("#detailIncidentId").textContent = item.id || id;
            $("#detailTitle").textContent = item.title || "Security incident";
            $("#detailStatus").value = item.status || "open";

            $("#incidentDetailContent").innerHTML = `
        <div class="policy-card">
          <p><strong>Category:</strong> ${escapeHTML(humanize(item.category))}</p>
          <p><strong>Severity:</strong> ${escapeHTML(humanize(item.severity))}</p>
          <p><strong>Portal:</strong> ${escapeHTML(humanize(item.portal))}</p>
          <p><strong>Source:</strong> ${escapeHTML(item.source || "—")}</p>
          <p><strong>Assigned investigator:</strong> ${escapeHTML(item.assigneeName || item.assignee_name || "Unassigned")}</p>
          <p><strong>Reported:</strong> ${escapeHTML(formatDate(item.createdAt || item.created_at))}</p>
          <p><strong>Description:</strong></p>
          <p>${escapeHTML(item.description || "No description supplied.")}</p>
          <p><strong>Investigation history</strong></p>
          ${records(item, "history", "timeline").map(entry => `
            <p>${escapeHTML(formatDate(entry.createdAt || entry.created_at))}
              — ${escapeHTML(entry.description || entry.action || "")}</p>
          `).join("") || "<p>No investigation history available.</p>"}
        </div>
      `;

            $("#incidentUpdateForm").elements.notes.value = "";
            showModal("detailModal");

        } catch (error) {
            toast("Unable to retrieve incident details.", "error");
            console.error(error);
        }
    }

    async function updateIncident(form) {
        const item = state.selectedIncident;
        if (!item) return;

        const id = item.id || item.incidentId;
        const payload = Object.fromEntries(new FormData(form).entries());

        try {
            await api(`${CONFIG.endpoints.incidents}/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: payload
            });

            toast("Investigation update saved.", "success");

            closeModal($("#detailModal"));

            await Promise.all([loadIncidents(), loadDashboard()]);

        } catch (error) {
            toast(`Update failed: ${error.message}`, "error");
        }
    }

    // THREAT MONITORING

    async function loadThreats() {
        const body = $("#threatsTable");
        body.innerHTML = emptyRow(7, "Loading threat records...");

        try {
            const payload = await api(CONFIG.endpoints.threats);
            const items = records(payload, "threats", "items", "results");

            body.innerHTML = items.length ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || "—")}</td>
          <td>${escapeHTML(humanize(item.type || item.category))}</td>
          <td>${escapeHTML(item.source || "—")}</td>
          <td>${escapeHTML(item.target || "—")}</td>
          <td>${badge(item.severity)}</td>
          <td>${escapeHTML(formatDate(item.detectedAt || item.detected_at))}</td>
          <td>${badge(item.status, `status-${item.status}`)}</td>
        </tr>
      `).join("") : emptyRow(7);

        } catch (error) {
            body.innerHTML = emptyRow(7, "Threat records could not be loaded.");
            console.error(error);
        }
    }

    // ACCESS MONITORING

    async function loadAccess() {
        const params = {
            search: $("#accessSearch").value.trim(),
            result: $("#accessResult").value
        };

        const body = $("#accessTable");
        body.innerHTML = emptyRow(7, "Loading access events...");

        try {
            const payload = await api(CONFIG.endpoints.access + query(params));
            const items = records(payload, "events", "items", "results");

            body.innerHTML = items.length ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.userName || item.user_name || item.email || "—")}</td>
          <td>${escapeHTML(humanize(item.portal))}</td>
          <td>${escapeHTML(item.ipAddress || item.ip_address || "—")}</td>
          <td>${escapeHTML(item.location || "—")}</td>
          <td>${escapeHTML(humanize(item.eventType || item.event_type))}</td>
          <td>${badge(item.outcome || item.result)}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
        </tr>
      `).join("") : emptyRow(7);

        } catch (error) {
            body.innerHTML = emptyRow(7, "Access events could not be loaded.");
            console.error(error);
        }
    }

    // ACTIVE SESSIONS

    async function loadSessions() {
        const body = $("#sessionsTable");
        body.innerHTML = emptyRow(7, "Loading authenticated sessions...");

        try {
            const payload = await api(CONFIG.endpoints.sessions);
            const items = records(payload, "sessions", "items", "results");

            body.innerHTML = items.length ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.userName || item.user_name || "—")}</td>
          <td>${escapeHTML(humanize(item.portal))}</td>
          <td>${escapeHTML(item.device || item.deviceName || "—")}</td>
          <td>${escapeHTML(item.ipAddress || item.ip_address || "—")}</td>
          <td>${escapeHTML(item.location || "—")}</td>
          <td>${escapeHTML(formatDate(item.lastActivity || item.last_activity))}</td>
          <td>
            <button data-revoke-session="${escapeHTML(item.id)}">
              Revoke session
            </button>
          </td>
        </tr>
      `).join("") : emptyRow(7, "No active sessions available.");

        } catch (error) {
            body.innerHTML = emptyRow(7, "Session records could not be loaded.");
            console.error(error);
        }
    }

    async function revokeSession(id) {
        if (!id) return;

        if (!window.confirm("Revoke this authenticated session?")) return;

        try {
            await api(`${CONFIG.endpoints.sessions}/${encodeURIComponent(id)}/revoke`, {
                method: "POST",
                body: { reason: "Revoked by authorized Super Admin" }
            });

            toast("Session revocation submitted.", "success");
            await Promise.all([loadSessions(), loadDashboard()]);

        } catch (error) {
            toast(`Session revocation failed: ${error.message}`, "error");
        }
    }

    // SECURITY POLICIES

    async function loadPolicies() {
        const container = $("#policyGrid");
        container.innerHTML = "<p>Loading policies...</p>";

        try {
            const payload = await api(CONFIG.endpoints.policies);
            const items = records(payload, "policies", "items", "results");

            container.innerHTML = items.length ? items.map(item => `
        <article class="policy-card">
          <h3>${escapeHTML(item.name || item.title || "Security policy")}</h3>
          <p>${escapeHTML(item.description || "")}</p>
          <label>
            <input
              type="checkbox"
              data-policy-toggle="${escapeHTML(item.id)}"
              ${item.enabled || item.isEnabled ? "checked" : ""}
            >
            Enabled
          </label>
          <p>Scope: ${escapeHTML(humanize(item.scope || item.portal))}</p>
          <p>Last updated: ${escapeHTML(formatDate(item.updatedAt || item.updated_at))}</p>
        </article>
      `).join("") : "<p>No security policies are available.</p>";

        } catch (error) {
            container.innerHTML = "<p>Security policies could not be loaded.</p>";
            console.error(error);
        }
    }

    async function updatePolicy(id, enabled) {
        try {
            await api(`${CONFIG.endpoints.policies}/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: { enabled }
            });

            toast("Security policy updated.", "success");

        } catch (error) {
            toast(`Policy update failed: ${error.message}`, "error");
            loadPolicies();
        }
    }

    // INVESTIGATIONS

    async function loadInvestigations() {
        const body = $("#investigationsTable");
        body.innerHTML = emptyRow(7, "Loading investigations...");

        try {
            const payload = await api(CONFIG.endpoints.investigations);
            const items = records(payload, "investigations", "items", "results");

            body.innerHTML = items.length ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || "—")}</td>
          <td>${escapeHTML(item.incidentId || item.incident_id || "—")}</td>
          <td>${escapeHTML(item.investigatorName || item.investigator_name || "—")}</td>
          <td>${badge(item.priority)}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${escapeHTML(formatDate(item.updatedAt || item.updated_at))}</td>
          <td>${badge(item.status, `status-${item.status}`)}</td>
        </tr>
      `).join("") : emptyRow(7);

        } catch (error) {
            body.innerHTML = emptyRow(7, "Investigation records could not be loaded.");
            console.error(error);
        }
    }

    // SECURITY ALERTS

    async function loadAlerts() {
        const container = $("#alertsList");
        container.innerHTML = "<p>Loading security alerts...</p>";

        try {
            const payload = await api(CONFIG.endpoints.alerts);
            const items = records(payload, "alerts", "items", "results");

            container.innerHTML = items.length ? items.map(item => `
        <article class="alert-item ${item.read ? "" : "unread"}">
          <strong>${escapeHTML(item.title || "Security alert")}</strong>
          <p>${escapeHTML(item.message || item.description || "")}</p>
          <small>
            ${escapeHTML(humanize(item.severity || item.priority))}
            · ${escapeHTML(formatDate(item.createdAt || item.created_at))}
          </small>
        </article>
      `).join("") : "<p>No security alerts available.</p>";

        } catch (error) {
            container.innerHTML = "<p>Security alerts could not be loaded.</p>";
            console.error(error);
        }
    }

    async function markAlertsRead() {
        try {
            await api(`${CONFIG.endpoints.alerts}/read-all`, {
                method: "POST",
                body: {}
            });

            toast("Security alerts marked as read.", "success");
            loadAlerts();

        } catch (error) {
            toast(`Unable to update alerts: ${error.message}`, "error");
        }
    }

    // LIVE EVENT MONITORING

    function connectLiveEvents() {
        if (!CONFIG.eventStreamUrl || !window.EventSource) return;

        state.eventSource = new EventSource(
            endpoint(CONFIG.eventStreamUrl),
            { withCredentials: true }
        );

        state.eventSource.onopen = () => {
            connection("connected", "Live security monitoring");
        };

        state.eventSource.onerror = () => {
            connection("error", "Reconnecting");
        };

        state.eventSource.addEventListener("security.alert", event => {
            try {
                const alert = JSON.parse(event.data);

                loadAlerts();
                loadDashboard();

                if (alert.severity === "critical") {
                    showCriticalAlert(alert);
                }

            } catch (error) {
                console.error("Invalid security event:", error);
            }
        });
    }

    function showCriticalAlert(alert) {
        const region = document.createElement("div");

        region.className = "toast error";
        region.textContent =
            `CRITICAL SECURITY ALERT: ${alert.title || alert.message || "Immediate review required"}`;

        $("#toastRegion").appendChild(region);

        setTimeout(() => region.remove(), 10000);
    }

    // NAVIGATION AND EVENT BINDING

    function bindEvents() {

        $$(".nav-link[data-section]").forEach(link => {
            link.addEventListener("click", event => {
                event.preventDefault();
                activateSection(link.dataset.section);
            });
        });

        $$("[data-navigate]").forEach(button => {
            button.addEventListener("click", () => {
                activateSection(button.dataset.navigate);
            });
        });

        $("#menuToggle").addEventListener("click", () => {
            $("#sidebar").classList.toggle("open");
        });

        $("#refreshSecurity").addEventListener("click", refreshAll);

        $("#trendPeriod").addEventListener("change", async () => {
            try {
                const payload = await api(
                    CONFIG.endpoints.dashboard +
                    query({ period: $("#trendPeriod").value })
                );

                const data = payload?.data || payload || {};

                renderTrend(data.incidentTrend || data.incident_trend || []);

            } catch (error) {
                toast("Unable to refresh security trends.", "error");
            }
        });

        $$("[data-open-incident]").forEach(button => {
            button.addEventListener("click", () => showModal("incidentModal"));
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

        $("#incidentForm").addEventListener("submit", event => {
            event.preventDefault();
            createIncident(event.currentTarget);
        });

        $("#incidentUpdateForm").addEventListener("submit", event => {
            event.preventDefault();
            updateIncident(event.currentTarget);
        });

        $("#incidentSearch").addEventListener("input", debounce(loadIncidents));
        $("#incidentSeverity").addEventListener("change", loadIncidents);
        $("#incidentStatus").addEventListener("change", loadIncidents);

        $("#resetIncidentFilters").addEventListener("click", () => {
            $("#incidentSearch").value = "";
            $("#incidentSeverity").value = "";
            $("#incidentStatus").value = "";
            loadIncidents();
        });

        $("#accessSearch").addEventListener("input", debounce(loadAccess));
        $("#accessResult").addEventListener("change", loadAccess);

        $("#markAlertsRead").addEventListener("click", markAlertsRead);

        $("#alertsButton").addEventListener("click", () => {
            activateSection("security-alerts");
        });

        document.addEventListener("click", event => {

            const incidentButton = event.target.closest("[data-incident-open]");

            if (incidentButton) {
                openIncident(incidentButton.dataset.incidentOpen);
            }

            const revokeButton = event.target.closest("[data-revoke-session]");

            if (revokeButton) {
                revokeSession(revokeButton.dataset.revokeSession);
            }

            const policyToggle = event.target.closest("[data-policy-toggle]");

            if (policyToggle) {
                updatePolicy(
                    policyToggle.dataset.policyToggle,
                    policyToggle.checked
                );
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                $$(".modal-overlay").forEach(closeModal);
            }
        });

        window.addEventListener("talvora:security:alert", event => {
            if (event.detail) {
                showCriticalAlert(event.detail);
                loadDashboard();
            }
        });
    }

    function debounce(callback, delay = 350) {
        let timer;

        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => callback(...args), delay);
        };
    }

    async function refreshAll() {
        await Promise.allSettled([
            loadDashboard(),
            loadIncidents(),
            loadAlerts()
        ]);

        if ($("#threats").classList.contains("active")) loadThreats();
        if ($("#access").classList.contains("active")) loadAccess();
        if ($("#sessions").classList.contains("active")) loadSessions();
        if ($("#policies").classList.contains("active")) loadPolicies();
        if ($("#investigations").classList.contains("active")) loadInvestigations();
    }

    async function initialize() {
        bindEvents();

        await refreshAll();

        connectLiveEvents();

        state.refreshTimer = setInterval(() => {
            loadDashboard();
            loadAlerts();
        }, CONFIG.refreshInterval);
    }

    document.addEventListener("DOMContentLoaded", initialize);

    window.TALVORA_SECURITY = {
        refresh: refreshAll,
        navigate: activateSection,
        openIncident,
        config: CONFIG
    };

})();
