
(() => {
    "use strict";

    const DEFAULTS = {
        dashboard: "/api/financial-resilience/dashboard",
        services: "/api/financial-resilience/services",
        incidents: "/api/financial-resilience/incidents",
        plans: "/api/financial-resilience/continuity-plans",
        tests: "/api/financial-resilience/recovery-tests",
        backups: "/api/financial-resilience/backups",
        vendors: "/api/financial-resilience/providers",
        risks: "/api/financial-resilience/risks",
        communications: "/api/financial-resilience/communications",
        audit: "/api/financial-resilience/audit",
        exports: "/api/financial-resilience/exports"
    };

    const config = window.TALVORA_ADMIN_CONFIG || {};
    const base = (config.apiBaseUrl || "").replace(/\/+$/, "");
    const endpoints = { ...DEFAULTS, ...(config.continuityEndpoints || {}) };
    const $ = id => document.getElementById(id);

    const state = {
        section: "overview",
        pendingAction: null,
        refreshTimer: null
    };

    const esc = value => String(value ?? "—").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);

    const dataOf = p => p?.data ?? p ?? {};

    const records = (p, ...keys) => {
        const d = dataOf(p);
        if (Array.isArray(d)) return d;
        for (const key of keys) {
            if (Array.isArray(d?.[key])) return d[key];
        }
        return [];
    };

    const first = (o, ...keys) => {
        for (const key of keys) {
            if (o?.[key] !== undefined && o[key] !== null) return o[key];
        }
    };

    const query = params => {
        const q = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== "" && value !== null && value !== undefined) {
                q.set(key, value);
            }
        });
        const result = q.toString();
        return result ? `?${result}` : "";
    };

    const url = path => base + (path.startsWith("/") ? path : `/${path}`);

    function toast(message, type = "info") {
        const region = $("toastRegion");
        if (!region) return;
        const node = document.createElement("div");
        node.className = `toast ${type}`;
        node.textContent = message;
        region.appendChild(node);
        setTimeout(() => node.remove(), 5000);
    }

    function metric(id, value) {
        if ($(id)) {
            $(id).textContent =
                value === null || value === undefined
                    ? "—"
                    : typeof value === "number"
                        ? value.toLocaleString()
                        : String(value);
        }
    }

    function date(value) {
        if (!value) return "—";
        const d = new Date(value);
        return Number.isNaN(d.getTime())
            ? esc(value)
            : new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short"
            }).format(d);
    }

    function badge(value) {
        const status = String(value || "unknown")
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "_");

        const label = String(value || "Unknown")
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase());

        return `<span class="badge ${status}">${esc(label)}</span>`;
    }

    function empty(columns, message) {
        return `<tr><td colspan="${columns}" class="empty-state">${esc(message)}</td></tr>`;
    }

    function setStatus(status, label) {
        const element = $("apiStatus");
        if (!element) return;
        element.className = `connection ${status}`;
        element.innerHTML = `<i></i>${esc(label)}`;
    }

    async function api(path, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            Number(config.timeout) || 30000
        );

        const headers = new Headers(options.headers || {});
        headers.set("Accept", "application/json");

        const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
        if (csrf) headers.set("X-CSRF-Token", csrf);

        let body = options.body;

        if (body && !(body instanceof FormData) && typeof body !== "string") {
            headers.set("Content-Type", "application/json");
            body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url(path), {
                ...options,
                headers,
                body,
                credentials: "include",
                cache: "no-store",
                signal: controller.signal
            });

            if (!response.ok) {
                let message = `Request failed (${response.status})`;

                try {
                    const error = await response.json();
                    message = error.message || error.detail || error.error || message;
                } catch { }

                if (response.status === 401) {
                    setStatus("error", "Authentication required");
                }

                throw new Error(message);
            }

            if (response.status === 204) return null;

            const contentType = response.headers.get("content-type") || "";

            return contentType.includes("application/json")
                ? response.json()
                : response.text();

        } finally {
            clearTimeout(timeout);
        }
    }

    function idempotencyHeaders() {
        return window.crypto?.randomUUID
            ? { "Idempotency-Key": window.crypto.randomUUID() }
            : {};
    }

    /* =========================================
       OVERVIEW
    ========================================= */

    async function loadOverview() {
        const results = await Promise.allSettled([
            api(endpoints.dashboard),
            api(endpoints.incidents + query({ limit: 8, pageSize: 8 }))
        ]);

        let success = 0;

        if (results[0].status === "fulfilled") {
            success++;

            const data = dataOf(results[0].value);
            const summary = data.metrics || data.summary || data;

            metric("sIncidents", first(summary, "openIncidents", "open_incidents"));
            metric("sServices", first(summary, "criticalServices", "critical_services"));
            metric("sTests", first(summary, "recoveryTestsDue", "recovery_tests_due"));
            metric("sBackups", first(summary, "backupExceptions", "backup_exceptions"));

            renderServiceHealth(records(
                data,
                "serviceHealth",
                "service_health",
                "services"
            ));

            renderIncidentSummary(records(
                data,
                "incidentSeverity",
                "incident_severity",
                "severitySummary"
            ));

            renderReadiness(records(
                data,
                "continuityReadiness",
                "continuity_readiness",
                "readiness"
            ));

            if (data.environment && $("environmentLabel")) {
                $("environmentLabel").textContent =
                    String(data.environment).toUpperCase();
            }
        }

        if (results[1].status === "fulfilled") {
            success++;
            renderIncidents(
                records(results[1].value, "incidents", "records", "items"),
                "recentIncidents",
                true
            );
        }

        setStatus(
            success ? "connected" : "error",
            success ? "Connected" : "Service unavailable"
        );
    }

    function renderServiceHealth(items) {
        const el = $("serviceHealth");
        if (!el) return;

        el.innerHTML = items.length ? items.map(item => `
      <div class="health-row">
        <div>
          <strong>${esc(item.name || item.service || item.component)}</strong>
          <small>${esc(item.provider || item.lastChecked || "Service monitoring")}</small>
        </div>
        ${badge(item.status || item.health)}
      </div>
    `).join("") : '<p class="muted">No service health information returned.</p>';
    }

    function renderIncidentSummary(items) {
        const el = $("incidentSummary");
        if (!el) return;

        el.innerHTML = items.length ? items.map(item => `
      <div class="health-row">
        <div>
          <strong>${esc(item.severity || item.level)}</strong>
          <small>${esc(item.description || "Incident classification")}</small>
        </div>
        <strong>${esc(item.count ?? item.total ?? "—")}</strong>
      </div>
    `).join("") : '<p class="muted">No incident severity information returned.</p>';
    }

    function renderReadiness(items) {
        const el = $("continuityReadiness");
        if (!el) return;

        el.innerHTML = items.length ? items.map(item => `
      <div class="health-row">
        <div>
          <strong>${esc(item.name || item.area || item.function)}</strong>
          <small>${esc(item.description || item.lastReviewed || "Continuity readiness")}</small>
        </div>
        ${badge(item.status || item.readiness)}
      </div>
    `).join("") : '<p class="muted">No continuity readiness information returned.</p>';
    }

    /* =========================================
       CRITICAL SERVICES
    ========================================= */

    async function loadServices() {
        const payload = await api(endpoints.services + query({
            search: $("serviceSearch")?.value?.trim(),
            status: $("serviceStatus")?.value,
            criticality: $("serviceCriticality")?.value,
            pageSize: 100
        }));

        const items = records(payload, "services", "records", "items");

        $("serviceTable").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.name || item.serviceName)}</td>
        <td>${esc(item.domain || item.category)}</td>
        <td>${esc(item.provider || item.providerName || "—")}</td>
        <td>${esc(item.jurisdiction || item.region || "—")}</td>
        <td>${badge(item.criticality)}</td>
        <td>${esc(item.availability ?? item.availabilityPercent ?? "—")}</td>
        <td>${esc(item.rto || item.recoveryTimeObjective || "—")}</td>
        <td>${badge(item.status)}</td>
        <td>
          <button data-detail="services" data-id="${esc(item.id)}">Inspect</button>
        </td>
      </tr>
    `).join("") : empty(9, "No critical service records returned.");
    }

    /* =========================================
       INCIDENT MANAGEMENT
    ========================================= */

    function renderIncidents(items, target = "incidentTable", recent = false) {
        const container = $(target);
        if (!container) return;

        container.innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.reference || item.id)}</td>
        <td>${esc(item.title || item.name)}</td>
        <td>${esc(item.type || item.category)}</td>
        <td>${esc(item.affectedService || item.affected_service || "—")}</td>
        <td>${esc(item.jurisdiction || item.country || "—")}</td>
        <td>${badge(item.severity)}</td>
        <td>${esc(item.owner || item.assignedTo || "Unassigned")}</td>
        <td>${esc(date(item.reportedAt || item.reported_at || item.createdAt))}</td>
        <td>${badge(item.status)}</td>
        ${recent ? "" : `
          <td>
            <button data-detail="incidents" data-id="${esc(item.id)}">Inspect</button>
            <button data-action="investigate-incident" data-id="${esc(item.id)}">Investigate</button>
            ${!["resolved", "closed"].includes(String(item.status).toLowerCase())
                    ? `<button data-action="escalate-incident" data-id="${esc(item.id)}">Escalate</button>` : ""}
          </td>
        `}
      </tr>
    `).join("") : empty(recent ? 7 : 10, "No incident records returned.");
    }

    async function loadIncidents() {
        const payload = await api(endpoints.incidents + query({
            search: $("incidentSearch")?.value?.trim(),
            severity: $("incidentSeverity")?.value,
            status: $("incidentStatus")?.value,
            pageSize: 100
        }));

        renderIncidents(records(payload, "incidents", "records", "items"));
    }

    async function createIncident(form) {
        const button = $("incidentSubmit");
        button.disabled = true;
        button.textContent = "Registering incident...";

        try {
            const values = Object.fromEntries(new FormData(form).entries());

            await api(endpoints.incidents, {
                method: "POST",
                headers: idempotencyHeaders(),
                body: {
                    title: values.title.trim(),
                    type: values.type,
                    severity: values.severity,
                    affectedService: values.affectedService.trim(),
                    jurisdiction: values.jurisdiction.trim() || null,
                    description: values.description.trim(),
                    initialResponse: values.initialResponse.trim() || null,
                    status: "open",
                    source: "talvora_global_security_continuity"
                }
            });

            $("incidentModal").hidden = true;
            form.reset();

            toast("Security incident registered successfully.", "success");

            await Promise.allSettled([
                loadIncidents(),
                loadOverview()
            ]);

        } catch (error) {
            toast(`Incident registration failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Register Incident";
        }
    }

    /* =========================================
       CONTINUITY PLANS
    ========================================= */

    async function loadPlans() {
        const payload = await api(endpoints.plans + query({
            search: $("planSearch")?.value?.trim(),
            status: $("planStatus")?.value,
            pageSize: 100
        }));

        const items = records(payload, "plans", "continuityPlans", "records", "items");

        $("planTable").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.reference || item.id)}</td>
        <td>${esc(item.name || item.title)}</td>
        <td>${esc(item.service || item.businessFunction || "—")}</td>
        <td>${esc(item.owner || item.planOwner || "—")}</td>
        <td>${esc(item.jurisdiction || item.region || "Global")}</td>
        <td>${esc(item.rto || "—")}</td>
        <td>${esc(item.rpo || "—")}</td>
        <td>${esc(date(item.lastReviewed || item.last_reviewed))}</td>
        <td>${badge(item.status)}</td>
        <td>
          <button data-detail="plans" data-id="${esc(item.id)}">Inspect</button>
          <button data-action="review-plan" data-id="${esc(item.id)}">Request review</button>
        </td>
      </tr>
    `).join("") : empty(10, "No continuity plans returned.");
    }

    /* =========================================
       DISASTER RECOVERY TESTS
    ========================================= */

    async function loadTests() {
        const payload = await api(endpoints.tests + query({
            status: $("testStatus")?.value,
            type: $("testType")?.value,
            pageSize: 100
        }));

        const items = records(payload, "tests", "exercises", "records", "items");

        $("testTable").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.reference || item.id)}</td>
        <td>${esc(item.name || item.title)}</td>
        <td>${esc(item.service || item.targetService || "—")}</td>
        <td>${esc(item.type || item.testType)}</td>
        <td>${esc(date(item.plannedDate || item.planned_date))}</td>
        <td>${esc(date(item.actualDate || item.actual_date))}</td>
        <td>${badge(item.result || item.outcome)}</td>
        <td>${esc(item.owner || item.responsibleTeam || "—")}</td>
        <td>${badge(item.status)}</td>
        <td>
          <button data-detail="tests" data-id="${esc(item.id)}">Inspect</button>
          ${["scheduled", "draft"].includes(String(item.status).toLowerCase())
                ? `<button data-action="request-recovery-test" data-id="${esc(item.id)}">Request exercise</button>` : ""}
        </td>
      </tr>
    `).join("") : empty(10, "No recovery test records returned.");
    }

    /* =========================================
       BACKUP & RESTORATION
    ========================================= */

    async function loadBackups() {
        const payload = await api(endpoints.backups + query({
            status: $("backupStatus")?.value,
            type: $("backupType")?.value,
            pageSize: 100
        }));

        const items = records(payload, "backups", "jobs", "records", "items");

        $("backupTable").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.reference || item.id)}</td>
        <td>${esc(item.system || item.sourceSystem || "—")}</td>
        <td>${esc(item.type || item.backupType)}</td>
        <td>${esc(item.region || item.location || "—")}</td>
        <td>${esc(date(item.startedAt || item.started_at))}</td>
        <td>${esc(date(item.completedAt || item.completed_at))}</td>
        <td>${esc(item.retentionPolicy || item.retention || "—")}</td>
        <td>${badge(item.restoreTestStatus || item.restore_test_status)}</td>
        <td>${badge(item.status)}</td>
        <td>
          <button data-detail="backups" data-id="${esc(item.id)}">Inspect</button>
          <button data-action="request-restore-test" data-id="${esc(item.id)}">Request restore test</button>
        </td>
      </tr>
    `).join("") : empty(10, "No backup records returned.");
    }

    /* =========================================
       THIRD-PARTY RESILIENCE
    ========================================= */

    async function loadVendors() {
        const payload = await api(endpoints.vendors + query({
            search: $("vendorSearch")?.value?.trim(),
            criticality: $("vendorCriticality")?.value,
            status: $("vendorStatus")?.value,
            pageSize: 100
        }));

        const items = records(payload, "providers", "vendors", "records", "items");

        $("vendorTable").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.name || item.providerName)}</td>
        <td>${esc(item.service || item.serviceType)}</td>
        <td>${esc(item.jurisdiction || item.country || "—")}</td>
        <td>${badge(item.criticality)}</td>
        <td>${esc(item.dependencyLevel || item.dependency || "—")}</td>
        <td>${badge(item.contingencyPlanStatus || item.contingency_status)}</td>
        <td>${esc(date(item.lastReviewed || item.last_reviewed))}</td>
        <td>${badge(item.status)}</td>
        <td><button data-detail="vendors" data-id="${esc(item.id)}">Inspect</button></td>
      </tr>
    `).join("") : empty(9, "No third-party provider records returned.");
    }

    /* =========================================
       RISK REGISTER
    ========================================= */

    async function loadRisks() {
        const payload = await api(endpoints.risks + query({
            search: $("riskSearch")?.value?.trim(),
            category: $("riskCategory")?.value,
            status: $("riskStatus")?.value,
            pageSize: 100
        }));

        const items = records(payload, "risks", "records", "items");

        $("riskTable").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.reference || item.id)}</td>
        <td>${esc(item.description || item.title)}</td>
        <td>${esc(item.category || item.type)}</td>
        <td>${esc(item.jurisdiction || item.region || "Global")}</td>
        <td>${esc(item.likelihood ?? "—")}</td>
        <td>${esc(item.impact ?? "—")}</td>
        <td>${badge(item.severity || item.riskLevel)}</td>
        <td>${esc(item.owner || item.assignedTo || "Unassigned")}</td>
        <td>${badge(item.status)}</td>
        <td>
          <button data-detail="risks" data-id="${esc(item.id)}">Inspect</button>
          <button data-action="review-risk" data-id="${esc(item.id)}">Review</button>
        </td>
      </tr>
    `).join("") : empty(10, "No resilience risks returned.");
    }

    /* =========================================
       EMERGENCY COMMUNICATIONS
    ========================================= */

    async function loadCommunications() {
        const payload = await api(endpoints.communications + query({
            status: $("communicationStatus")?.value,
            type: $("communicationType")?.value,
            pageSize: 100
        }));

        const items = records(payload, "communications", "messages", "records", "items");

        $("communicationTable").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.reference || item.id)}</td>
        <td>${esc(item.incidentReference || item.incident_reference || "—")}</td>
        <td>${esc(item.type || item.communicationType)}</td>
        <td>${esc(item.recipientGroup || item.recipient_group || "—")}</td>
        <td>${esc(item.approvalOwner || item.approval_owner || "—")}</td>
        <td>${esc(date(item.createdAt || item.created_at))}</td>
        <td>${esc(date(item.sentAt || item.sent_at))}</td>
        <td>${badge(item.status)}</td>
        <td>
          <button data-detail="communications" data-id="${esc(item.id)}">Inspect</button>
          ${String(item.status).toLowerCase() === "draft"
                ? `<button data-action="review-communication" data-id="${esc(item.id)}">Request approval</button>` : ""}
        </td>
      </tr>
    `).join("") : empty(9, "No emergency communications returned.");
    }

    /* =========================================
       SECURITY AUDIT
    ========================================= */

    async function loadAudit() {
        const payload = await api(endpoints.audit + query({
            search: $("auditSearch")?.value?.trim(),
            pageSize: 100
        }));

        const items = records(payload, "audit", "records", "items");

        $("auditTable").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.reference || item.id)}</td>
        <td>${esc(item.actorName || item.actor || "—")}</td>
        <td>${esc(item.action || item.operation)}</td>
        <td>${esc(item.resource || item.resourceReference || "—")}</td>
        <td>${esc(item.incidentReference || item.incident_reference || "—")}</td>
        <td>${esc(item.reason || "—")}</td>
        <td>${esc(date(item.createdAt || item.created_at))}</td>
        <td>${badge(item.result || item.status)}</td>
      </tr>
    `).join("") : empty(8, "No security audit records returned.");
    }

    /* =========================================
       INCIDENT / RESOURCE ACTIONS
    ========================================= */

    const RESOURCE_ENDPOINTS = {
        services: endpoints.services,
        incidents: endpoints.incidents,
        plans: endpoints.plans,
        tests: endpoints.tests,
        backups: endpoints.backups,
        vendors: endpoints.vendors,
        risks: endpoints.risks,
        communications: endpoints.communications
    };

    const ACTION_DESCRIPTIONS = {
        "investigate-incident":
            "Requests assignment and formal investigation of the selected incident.",
        "escalate-incident":
            "Requests escalation to the designated security or operational incident authority.",
        "review-plan":
            "Requests a documented review of the continuity plan, ownership and recovery objectives.",
        "request-recovery-test":
            "Requests scheduling and authorization of a disaster recovery exercise.",
        "request-restore-test":
            "Requests an authorized backup restoration verification exercise. This does not initiate a live production restore.",
        "review-risk":
            "Requests reassessment of the selected security or continuity risk and its mitigation plan.",
        "review-communication":
            "Requests review and approval of an emergency communication before any distribution."
    };

    function requestAction(type, id, action) {
        state.pendingAction = { type, id, action };

        $("actionTitle").textContent = action
            .replace(/-/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase());

        $("actionDescription").textContent =
            ACTION_DESCRIPTIONS[action] ||
            "This action will be submitted for server-side authorization.";

        $("actionReason").value = "";
        $("actionSubmit").disabled = true;
        $("actionModal").hidden = false;
    }

    async function submitAction() {
        const pending = state.pendingAction;
        const reason = $("actionReason").value.trim();

        if (!pending || reason.length < 10) return;

        const button = $("actionSubmit");
        button.disabled = true;
        button.textContent = "Submitting...";

        try {
            const resource = RESOURCE_ENDPOINTS[pending.type];
            if (!resource) throw new Error("Unsupported operation.");

            await api(
                `${resource}/${encodeURIComponent(pending.id)}/actions`,
                {
                    method: "POST",
                    headers: idempotencyHeaders(),
                    body: {
                        action: pending.action,
                        reason,
                        source: "talvora_global_security_continuity"
                    }
                }
            );

            $("actionModal").hidden = true;
            state.pendingAction = null;

            toast("Security and continuity request submitted.", "success");

            await Promise.allSettled([
                loaders[state.section]?.(),
                loadOverview()
            ]);

        } catch (error) {
            toast(`Action failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Submit Request";
        }
    }

    /* =========================================
       RECORD DETAILS
    ========================================= */

    async function openDetail(type, id) {
        const resource = RESOURCE_ENDPOINTS[type];
        if (!resource) return;

        try {
            const payload = await api(`${resource}/${encodeURIComponent(id)}`);
            const record = dataOf(payload);

            $("detailTitle").textContent =
                `${type.toUpperCase()} — ${record.reference || record.id || id}`;

            const sensitive = /password|secret|token|credential|private.?key|access.?key|personal.?address|national.?id|passport|biometric/i;

            $("detailBody").innerHTML = Object.entries(record)
                .filter(([key, value]) =>
                    !sensitive.test(key) &&
                    value !== null &&
                    value !== undefined &&
                    typeof value !== "object"
                )
                .map(([key, value]) => `
          <div class="detail-row">
            <span>${esc(key.replace(/([A-Z])/g, " $1"))}</span>
            <strong>${esc(value)}</strong>
          </div>
        `).join("") || '<p class="muted">No additional details returned.</p>';

            $("detailModal").hidden = false;

        } catch (error) {
            toast(`Unable to retrieve record: ${error.message}`, "error");
        }
    }

    /* =========================================
       AUDIT EXPORT
    ========================================= */

    async function exportAudit() {
        try {
            const response = await fetch(
                url(endpoints.exports + query({
                    type: "financial_resilience_audit",
                    format: "csv"
                })),
                {
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        "Accept": "text/csv",
                        "X-CSRF-Token":
                            document.querySelector('meta[name="csrf-token"]')?.content || ""
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Audit export failed (${response.status})`);
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = objectUrl;
            link.download = "talvora-security-continuity-audit.csv";
            link.click();

            URL.revokeObjectURL(objectUrl);

            toast("Security audit exported successfully.", "success");

        } catch (error) {
            toast(error.message, "error");
        }
    }

    /* =========================================
       NAVIGATION
    ========================================= */

    const loaders = {
        overview: loadOverview,
        services: loadServices,
        incidents: loadIncidents,
        recovery: loadPlans,
        tests: loadTests,
        backups: loadBackups,
        vendors: loadVendors,
        risks: loadRisks,
        communications: loadCommunications,
        audit: loadAudit
    };

    async function navigate(section) {
        if (!loaders[section]) return;

        state.section = section;

        document.querySelectorAll(".section").forEach(element => {
            element.classList.toggle("active", element.id === section);
        });

        document.querySelectorAll(".nav-link").forEach(element => {
            element.classList.toggle(
                "active",
                element.dataset.section === section
            );
        });

        $("sidebar")?.classList.remove("open");

        try {
            await loaders[section]();
        } catch (error) {
            toast(error.message, "error");
        }
    }

    /* =========================================
       FILTERS & EVENT BINDINGS
    ========================================= */

    function debounce(callback, delay = 350) {
        let timer;

        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => callback(...args), delay);
        };
    }

    function bindEvents() {

        document.querySelectorAll("[data-section]").forEach(link => {
            link.addEventListener("click", event => {
                event.preventDefault();
                navigate(link.dataset.section);
            });
        });

        document.querySelectorAll("[data-navigate]").forEach(button => {
            button.addEventListener("click", () => navigate(button.dataset.navigate));
        });

        document.querySelectorAll("[data-open]").forEach(button => {
            button.addEventListener("click", () => {
                $(button.dataset.open).hidden = false;
            });
        });

        document.querySelectorAll("[data-close]").forEach(button => {
            button.addEventListener("click", () => {
                button.closest(".overlay").hidden = true;
            });
        });

        document.querySelectorAll(".overlay").forEach(overlay => {
            overlay.addEventListener("click", event => {
                if (event.target === overlay) overlay.hidden = true;
            });
        });

        $("menuToggle")?.addEventListener("click", () => {
            $("sidebar").classList.toggle("open");
        });

        $("refreshAll")?.addEventListener("click", refreshAll);

        $("incidentForm")?.addEventListener("submit", event => {
            event.preventDefault();
            createIncident(event.currentTarget);
        });

        $("actionReason")?.addEventListener("input", event => {
            $("actionSubmit").disabled = event.target.value.trim().length < 10;
        });

        $("actionSubmit")?.addEventListener("click", submitAction);

        $("exportAudit")?.addEventListener("click", exportAudit);

        document.querySelectorAll("[data-refresh]").forEach(button => {
            button.addEventListener("click", () => {
                loaders[state.section]?.().catch(error =>
                    toast(error.message, "error")
                );
            });
        });

        const filterBindings = [
            ["serviceSearch", "input", loadServices],
            ["serviceStatus", "change", loadServices],
            ["serviceCriticality", "change", loadServices],

            ["incidentSearch", "input", loadIncidents],
            ["incidentSeverity", "change", loadIncidents],
            ["incidentStatus", "change", loadIncidents],

            ["planSearch", "input", loadPlans],
            ["planStatus", "change", loadPlans],

            ["testStatus", "change", loadTests],
            ["testType", "change", loadTests],

            ["backupStatus", "change", loadBackups],
            ["backupType", "change", loadBackups],

            ["vendorSearch", "input", loadVendors],
            ["vendorCriticality", "change", loadVendors],
            ["vendorStatus", "change", loadVendors],

            ["riskSearch", "input", loadRisks],
            ["riskCategory", "change", loadRisks],
            ["riskStatus", "change", loadRisks],

            ["communicationStatus", "change", loadCommunications],
            ["communicationType", "change", loadCommunications],

            ["auditSearch", "input", loadAudit]
        ];

        filterBindings.forEach(([id, event, callback]) => {
            $(id)?.addEventListener(
                event,
                event === "input" ? debounce(callback) : callback
            );
        });

        document.addEventListener("click", event => {
            const detail = event.target.closest("[data-detail]");

            if (detail) {
                openDetail(detail.dataset.detail, detail.dataset.id);
                return;
            }

            const action = event.target.closest("[data-action]");

            if (action) {
                const actionType = action.dataset.action;
                const resource = {
                    "investigate-incident": "incidents",
                    "escalate-incident": "incidents",
                    "review-plan": "plans",
                    "request-recovery-test": "tests",
                    "request-restore-test": "backups",
                    "review-risk": "risks",
                    "review-communication": "communications"
                }[actionType];

                if (resource) {
                    requestAction(resource, action.dataset.id, actionType);
                }
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                document.querySelectorAll(".overlay").forEach(el => {
                    el.hidden = true;
                });
            }
        });
    }

    /* =========================================
       REFRESH & INITIALIZATION
    ========================================= */

    async function refreshAll() {
        setStatus("loading", "Refreshing");

        const result = await loadOverview()
            .then(() => true)
            .catch(error => {
                toast(error.message, "error");
                return false;
            });

        if (!result) {
            setStatus("error", "Unavailable");
            return;
        }

        if (state.section !== "overview") {
            await loaders[state.section]?.().catch(error =>
                toast(error.message, "error")
            );
        }

        setStatus("connected", "Connected");
    }

    async function initialize() {
        bindEvents();
        setStatus("loading", "Connecting");

        await loadOverview().catch(error => {
            setStatus("error", "Unavailable");
            console.error("[TALVORA Resilience]", error);
        });

        if (state.refreshTimer) {
            clearInterval(state.refreshTimer);
        }

        state.refreshTimer = setInterval(() => {
            if (
                document.visibilityState === "visible" &&
                state.section === "overview"
            ) {
                loadOverview().catch(error => {
                    console.warn("[TALVORA Resilience]", error);
                });
            }
        }, Number(config.refreshInterval) || 30000);
    }

    /* =========================================
       PUBLIC MODULE INTERFACE
    ========================================= */

    window.TALVORA_CONTINUITY = {
        refresh: refreshAll,
        navigate,
        loadOverview,
        loadServices,
        loadIncidents,
        loadPlans,
        loadTests,
        loadBackups,
        loadVendors,
        loadRisks,
        loadCommunications,
        loadAudit,
        config: { apiBaseUrl: base, endpoints }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }

})();
