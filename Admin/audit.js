
(() => {
    "use strict";

    const DEFAULT_ENDPOINTS = {
        dashboard: "/api/admin-audit/dashboard",
        events: "/api/admin-audit/events",
        administrators: "/api/admin-audit/administrators",
        permissions: "/api/admin-audit/permission-changes",
        sensitive: "/api/admin-audit/sensitive-operations",
        authentication: "/api/admin-audit/authentication-events",
        investigations: "/api/admin-audit/investigations",
        exports: "/api/admin-audit/exports"
    };

    const supplied = window.TALVORA_AUDIT_CONFIG || {};

    const CONFIG = {
        apiBaseUrl: document.documentElement.dataset.apiBase || "",
        timeout: 20000,
        refreshInterval: 30000,
        endpoints: { ...DEFAULT_ENDPOINTS, ...(supplied.endpoints || {}) },
        ...supplied
    };

    CONFIG.endpoints = {
        ...DEFAULT_ENDPOINTS,
        ...(supplied.endpoints || {})
    };

    const state = {
        page: 1,
        pageSize: 25,
        selectedEvent: null,
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

    function number(value) {
        if (value === null || value === undefined) return "—";
        const parsed = Number(value);
        return Number.isFinite(parsed)
            ? new Intl.NumberFormat().format(parsed)
            : "—";
    }

    function endpoint(path) {
        return CONFIG.apiBaseUrl.replace(/\/+$/, "") +
            (path.startsWith("/") ? path : `/${path}`);
    }

    async function api(path, options = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), CONFIG.timeout);

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

            const contentType = response.headers.get("content-type") || "";

            return contentType.includes("application/json")
                ? response.json()
                : response.text();

        } finally {
            clearTimeout(timer);
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
        if (element) element.textContent = number(value);
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
            activity: loadActivity,
            permissions: loadPermissions,
            sensitive: loadSensitive,
            authentication: loadAuthentication,
            investigations: loadInvestigations,
            exports: loadExports
        };

        if (loaders[section]) loaders[section]();
    }

    // DASHBOARD

    async function loadDashboard() {
        try {
            const [dashboardPayload, eventsPayload] = await Promise.all([
                api(CONFIG.endpoints.dashboard),
                api(CONFIG.endpoints.events + query({
                    page: 1,
                    pageSize: 8,
                    sort: "created_desc"
                }))
            ]);

            const data = dashboardPayload?.data || dashboardPayload || {};
            const metrics = data.metrics || data.summary || data;

            metric("totalEvents", metrics.totalEvents ?? metrics.total_events);
            metric("activeAdmins", metrics.activeAdmins ?? metrics.active_admins);
            metric("permissionChanges", metrics.permissionChanges ?? metrics.permission_changes);
            metric("sensitiveOperations", metrics.sensitiveOperations ?? metrics.sensitive_operations);
            metric("securityFlags", metrics.securityFlags ?? metrics.security_flags);
            metric("openInvestigations", metrics.openInvestigations ?? metrics.open_investigations);

            renderActivityChart(data.activityTrend || data.activity_trend || []);
            renderBreakdown(data.actionDistribution || data.action_distribution || {});

            const recent = records(eventsPayload, "events", "items", "results");
            renderRecent(recent);

            $("#bannerMessage").textContent =
                data.auditMessage ||
                data.audit_message ||
                "Administrator audit information retrieved.";

            setConnection("connected", "Connected");

        } catch (error) {
            setConnection("error", "Connection issue");

            $("#bannerMessage").textContent =
                "Administrator audit information could not be retrieved.";

            console.error("[TALVORA Audit] Dashboard:", error);
        }
    }

    function renderActivityChart(series) {
        const container = $("#activityChart");
        const items = records(series, "points", "items");

        if (!items.length) {
            container.textContent = "No activity trend data available.";
            return;
        }

        const max = Math.max(
            1,
            ...items.map(item => Number(item.count ?? item.value ?? 0))
        );

        container.innerHTML = `
      <div class="chart-bars">
        ${items.map(item => {
            const value = Number(item.count ?? item.value ?? 0);
            const height = Math.max(3, value / max * 100);

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

    function renderBreakdown(distribution) {
        const container = $("#actionBreakdown");
        const items = Object.entries(distribution).map(([name, value]) => ({
            name,
            count: Number(value?.count ?? value ?? 0)
        }));

        const total = items.reduce((sum, item) => sum + item.count, 0);

        if (!total) {
            container.textContent = "No action distribution data available.";
            return;
        }

        container.innerHTML = items.map(item => `
      <div class="breakdown-row">
        <span>${escapeHTML(humanize(item.name))}</span>
        <div class="breakdown-track">
          <div class="breakdown-fill"
               style="width:${item.count / total * 100}%"></div>
        </div>
        <strong>${number(item.count)}</strong>
      </div>
    `).join("");
    }

    function renderRecent(items) {
        $("#recentActivity").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${escapeHTML(item.id || "—")}</td>
        <td>${escapeHTML(item.actorName || item.actor_name || "—")}</td>
        <td>${escapeHTML(humanize(item.action))}</td>
        <td>${escapeHTML(humanize(item.module))}</td>
        <td>${escapeHTML(item.ipAddress || item.ip_address || "—")}</td>
        <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
        <td>${badge(item.outcome || item.result)}</td>
      </tr>
    `).join("") : emptyRow(7);
    }

    // ADMINISTRATOR METADATA

    async function loadAdministrators() {
        try {
            const payload = await api(CONFIG.endpoints.administrators);
            const items = records(payload, "administrators", "admins", "items");

            const select = $("#activityAdmin");

            select.innerHTML = '<option value="">All administrators</option>' +
                items.map(item => `
          <option value="${escapeHTML(item.id)}">
            ${escapeHTML(item.name || item.email || item.id)}
          </option>
        `).join("");

        } catch (error) {
            console.error("[TALVORA Audit] Administrator list:", error);
        }
    }

    // ACTIVITY RECORDS

    function activityParams() {
        return {
            search: $("#activitySearch").value.trim(),
            administratorId: $("#activityAdmin").value,
            module: $("#activityModule").value,
            outcome: $("#activityOutcome").value,
            from: $("#activityFrom").value,
            to: $("#activityTo").value,
            page: state.page,
            pageSize: state.pageSize
        };
    }

    async function loadActivity() {
        const body = $("#activityTable");
        body.innerHTML = emptyRow(9, "Loading audit events...");

        try {
            const payload = await api(
                CONFIG.endpoints.events + query(activityParams())
            );

            const items = records(payload, "events", "items", "results");

            body.innerHTML = items.length ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || "—")}</td>
          <td>${escapeHTML(item.actorName || item.actor_name || "—")}</td>
          <td>${escapeHTML(item.actorRole || item.actor_role || "—")}</td>
          <td>${escapeHTML(humanize(item.action))}</td>
          <td>${escapeHTML(humanize(item.module))}</td>
          <td>${escapeHTML(item.ipAddress || item.ip_address || "—")}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${badge(item.outcome || item.result)}</td>
          <td><button data-event-open="${escapeHTML(item.id)}">Details</button></td>
        </tr>
      `).join("") : emptyRow(9);

            const total = payload?.total ?? payload?.totalCount ?? payload?.total_count;

            $("#activityCount").textContent =
                total === undefined ? `${items.length} records on this page` : `${number(total)} records`;

            $("#activityPage").textContent = `Page ${state.page}`;
            $("#activityPrev").disabled = state.page <= 1;
            $("#activityNext").disabled =
                items.length < state.pageSize ||
                (total !== undefined && state.page * state.pageSize >= Number(total));

        } catch (error) {
            body.innerHTML = emptyRow(9, "Audit events could not be loaded.");
            console.error(error);
        }
    }

    // EVENT DETAILS

    async function openEvent(id) {
        if (!id) return;

        try {
            const payload = await api(
                `${CONFIG.endpoints.events}/${encodeURIComponent(id)}`
            );

            const item = payload?.event || payload?.data?.event ||
                payload?.data || payload;

            state.selectedEvent = item;

            $("#eventTitle").textContent = item.action
                ? humanize(item.action)
                : "Audit event details";

            const fields = [
                ["Event ID", item.id],
                ["Administrator", item.actorName || item.actor_name],
                ["Administrator ID", item.actorId || item.actor_id],
                ["Administrator role", item.actorRole || item.actor_role],
                ["Action", humanize(item.action)],
                ["Module", humanize(item.module)],
                ["Target resource", item.targetResource || item.target_resource],
                ["Target ID", item.targetId || item.target_id],
                ["IP address", item.ipAddress || item.ip_address],
                ["Device", item.device],
                ["Location", item.location],
                ["Outcome", humanize(item.outcome || item.result)],
                ["Timestamp", formatDate(item.createdAt || item.created_at)],
                ["Reason", item.reason],
                ["Details", item.description || item.details],
                ["Previous values", JSON.stringify(item.previousValues || item.previous_values || null)],
                ["New values", JSON.stringify(item.newValues || item.new_values || null)],
                ["Correlation ID", item.correlationId || item.correlation_id],
                ["Integrity reference", item.integrityHash || item.integrity_hash]
            ];

            $("#eventDetails").innerHTML = fields
                .filter(([, value]) => value !== null && value !== undefined && value !== "")
                .map(([label, value]) => `
          <div class="event-detail-row">
            <span>${escapeHTML(label)}</span>
            <strong>${escapeHTML(value)}</strong>
          </div>
        `).join("");

            $("#eventModal").hidden = false;

        } catch (error) {
            toast(`Audit event could not be opened: ${error.message}`, "error");
        }
    }

    // PERMISSION HISTORY

    async function loadPermissions() {
        const body = $("#permissionsTable");
        body.innerHTML = emptyRow(8, "Loading permission changes...");

        try {
            const payload = await api(CONFIG.endpoints.permissions + query({
                search: $("#permissionSearch").value.trim(),
                type: $("#permissionType").value
            }));

            const items = records(payload, "changes", "items", "results");

            body.innerHTML = items.length ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || "—")}</td>
          <td>${escapeHTML(item.administratorName || item.administrator_name || "—")}</td>
          <td>${escapeHTML(item.changedByName || item.changed_by_name || "—")}</td>
          <td>${escapeHTML(item.previousAccess || item.previous_access || "—")}</td>
          <td>${escapeHTML(item.newAccess || item.new_access || "—")}</td>
          <td>${escapeHTML(humanize(item.changeType || item.change_type))}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${badge(item.approvalStatus || item.approval_status)}</td>
        </tr>
      `).join("") : emptyRow(8);

        } catch (error) {
            body.innerHTML = emptyRow(8, "Permission history could not be loaded.");
            console.error(error);
        }
    }

    // SENSITIVE OPERATIONS

    async function loadSensitive() {
        const body = $("#sensitiveTable");
        body.innerHTML = emptyRow(8, "Loading sensitive operations...");

        try {
            const payload = await api(CONFIG.endpoints.sensitive + query({
                search: $("#sensitiveSearch").value.trim(),
                status: $("#sensitiveStatus").value
            }));

            const data = payload?.data || payload || {};
            const items = records(data, "operations", "items", "results");

            metric("highImpact", data.highImpact ?? data.high_impact);
            metric("approvalRequired", data.approvalRequired ?? data.approval_required);
            metric("flaggedActions", data.flaggedActions ?? data.flagged_actions);

            body.innerHTML = items.length ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || "—")}</td>
          <td>${escapeHTML(item.actorName || item.actor_name || "—")}</td>
          <td>${escapeHTML(humanize(item.operation))}</td>
          <td>${escapeHTML(humanize(item.module))}</td>
          <td>${escapeHTML(item.approverName || item.approver_name || "—")}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${badge(item.status)}</td>
          <td><button data-event-open="${escapeHTML(item.eventId || item.event_id || item.id)}">Review</button></td>
        </tr>
      `).join("") : emptyRow(8);

        } catch (error) {
            body.innerHTML = emptyRow(8, "Sensitive operations could not be loaded.");
            console.error(error);
        }
    }

    // AUTHENTICATION HISTORY

    async function loadAuthentication() {
        const body = $("#authenticationTable");
        body.innerHTML = emptyRow(8, "Loading authentication history...");

        try {
            const payload = await api(CONFIG.endpoints.authentication + query({
                search: $("#authSearch").value.trim(),
                event: $("#authEvent").value
            }));

            const items = records(payload, "events", "items", "results");

            body.innerHTML = items.length ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || "—")}</td>
          <td>${escapeHTML(item.administratorName || item.administrator_name || "—")}</td>
          <td>${escapeHTML(humanize(item.eventType || item.event_type))}</td>
          <td>${escapeHTML(item.ipAddress || item.ip_address || "—")}</td>
          <td>${escapeHTML(item.device || "—")}</td>
          <td>${escapeHTML(item.location || "—")}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${badge(item.result || item.outcome)}</td>
        </tr>
      `).join("") : emptyRow(8);

        } catch (error) {
            body.innerHTML = emptyRow(8, "Authentication records could not be loaded.");
            console.error(error);
        }
    }

    // INVESTIGATIONS

    async function loadInvestigations() {
        const body = $("#investigationsTable");
        body.innerHTML = emptyRow(8, "Loading audit investigations...");

        try {
            const payload = await api(CONFIG.endpoints.investigations);
            const items = records(payload, "investigations", "items", "results");

            body.innerHTML = items.length ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || "—")}</td>
          <td>${escapeHTML(item.title || "—")}</td>
          <td>${escapeHTML(item.eventId || item.event_id || "—")}</td>
          <td>${escapeHTML(item.investigatorName || item.investigator_name || "Unassigned")}</td>
          <td>${badge(item.priority)}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${badge(item.status)}</td>
          <td><button data-investigation-update="${escapeHTML(item.id)}">Update</button></td>
        </tr>
      `).join("") : emptyRow(8);

        } catch (error) {
            body.innerHTML = emptyRow(8, "Investigation records could not be loaded.");
            console.error(error);
        }
    }

    async function createInvestigation(form) {
        const button = form.querySelector('[type="submit"]');
        const payload = Object.fromEntries(new FormData(form).entries());

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.investigations, {
                method: "POST",
                body: payload
            });

            form.reset();
            $("#investigationModal").hidden = true;

            toast("Audit investigation created.", "success");

            await Promise.all([loadInvestigations(), loadDashboard()]);

        } catch (error) {
            toast(`Investigation could not be created: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    async function updateInvestigation(id) {
        const status = window.prompt(
            "Enter the investigation status:\nopen, investigating, pending, resolved, closed",
            "investigating"
        );

        if (!status) return;

        const allowed = ["open", "investigating", "pending", "resolved", "closed"];

        if (!allowed.includes(status)) {
            toast("Invalid investigation status.", "error");
            return;
        }

        const notes = window.prompt("Enter an investigation update:", "");

        try {
            await api(`${CONFIG.endpoints.investigations}/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: { status, notes: notes || "" }
            });

            toast("Investigation updated.", "success");
            await loadInvestigations();

        } catch (error) {
            toast(`Investigation update failed: ${error.message}`, "error");
        }
    }

    // AUDIT REPORTS

    async function loadExports() {
        const body = $("#exportsTable");
        body.innerHTML = emptyRow(7, "Loading report history...");

        try {
            const payload = await api(CONFIG.endpoints.exports);
            const items = records(payload, "exports", "reports", "items");

            body.innerHTML = items.length ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || "—")}</td>
          <td>${escapeHTML(humanize(item.type || item.reportType))}</td>
          <td>${escapeHTML(item.requestedBy || item.requested_by || "—")}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${escapeHTML((item.format || "CSV").toUpperCase())}</td>
          <td>${badge(item.status)}</td>
          <td>
            ${item.downloadAvailable || item.download_available
                    ? `<button data-export-download="${escapeHTML(item.id)}">Download</button>`
                    : "—"}
          </td>
        </tr>
      `).join("") : emptyRow(7);

        } catch (error) {
            body.innerHTML = emptyRow(7, "Export history could not be loaded.");
            console.error(error);
        }
    }

    async function generateExport(type) {
        try {
            const result = await api(CONFIG.endpoints.exports, {
                method: "POST",
                body: {
                    type,
                    format: "csv",
                    filters: activityParams()
                }
            });

            const report = result?.report || result?.data || result;

            toast(
                report?.message || "Audit report request submitted.",
                "success"
            );

            await loadExports();

            if (report?.id && ["ready", "completed"].includes(report.status)) {
                await downloadExport(report.id);
            }

        } catch (error) {
            toast(`Audit report could not be generated: ${error.message}`, "error");
        }
    }

    async function downloadExport(id) {
        try {
            const response = await fetch(
                endpoint(`${CONFIG.endpoints.exports}/${encodeURIComponent(id)}/download`),
                {
                    credentials: "include",
                    headers: {
                        "Accept": "text/csv, application/octet-stream, application/json"
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Download failed (${response.status})`);
            }

            const blob = await response.blob();
            const disposition = response.headers.get("content-disposition") || "";
            const match = disposition.match(/filename="?([^"]+)"?/i);

            const filename = match?.[1] || `talvora-audit-${id}.csv`;
            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(url), 1000);

            toast("Audit report downloaded.", "success");

        } catch (error) {
            toast(`Report download failed: ${error.message}`, "error");
        }
    }

    // FILTERS AND EVENTS

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

        $$("[data-navigate]").forEach(button => {
            button.addEventListener("click", () => navigate(button.dataset.navigate));
        });

        $("#menuToggle").addEventListener("click", () => {
            $("#sidebar").classList.toggle("open");
        });

        $("#refreshAudit").addEventListener("click", refreshAll);

        $("#activitySearch").addEventListener("input", debounce(() => {
            state.page = 1;
            loadActivity();
        }));

        ["activityAdmin", "activityModule", "activityOutcome"].forEach(id => {
            document.getElementById(id).addEventListener("change", () => {
                state.page = 1;
                loadActivity();
            });
        });

        $("#applyActivityFilters").addEventListener("click", () => {
            state.page = 1;
            loadActivity();
        });

        $("#resetActivityFilters").addEventListener("click", () => {
            ["activitySearch", "activityAdmin", "activityModule",
                "activityOutcome", "activityFrom", "activityTo"].forEach(id => {
                    document.getElementById(id).value = "";
                });

            state.page = 1;
            loadActivity();
        });

        $("#activityPrev").addEventListener("click", () => {
            if (state.page > 1) {
                state.page--;
                loadActivity();
            }
        });

        $("#activityNext").addEventListener("click", () => {
            state.page++;
            loadActivity();
        });

        $("#permissionSearch").addEventListener("input", debounce(loadPermissions));
        $("#permissionType").addEventListener("change", loadPermissions);

        $("#sensitiveSearch").addEventListener("input", debounce(loadSensitive));
        $("#sensitiveStatus").addEventListener("change", loadSensitive);

        $("#authSearch").addEventListener("input", debounce(loadAuthentication));
        $("#authEvent").addEventListener("change", loadAuthentication);

        $("#trendPeriod").addEventListener("change", async () => {
            try {
                const payload = await api(CONFIG.endpoints.dashboard +
                    query({ period: $("#trendPeriod").value }));

                const data = payload?.data || payload || {};
                renderActivityChart(data.activityTrend || data.activity_trend || []);

            } catch (error) {
                toast("Activity trend could not be refreshed.", "error");
            }
        });

        $("#createInvestigation").addEventListener("click", () => {
            $("#investigationModal").hidden = false;
        });

        $("#investigationForm").addEventListener("submit", event => {
            event.preventDefault();
            createInvestigation(event.currentTarget);
        });

        $("#exportOverview").addEventListener("click", () => generateExport("full_audit"));
        $("#exportActivity").addEventListener("click", () => generateExport("administrator_activity"));

        $$("[data-export]").forEach(button => {
            button.addEventListener("click", () => generateExport(button.dataset.export));
        });

        $$("[data-close-modal]").forEach(button => {
            button.addEventListener("click", () => {
                button.closest(".modal-overlay").hidden = true;
            });
        });

        $$(".modal-overlay").forEach(modal => {
            modal.addEventListener("click", event => {
                if (event.target === modal) modal.hidden = true;
            });
        });

        document.addEventListener("click", event => {
            const eventButton = event.target.closest("[data-event-open]");
            if (eventButton) openEvent(eventButton.dataset.eventOpen);

            const updateButton = event.target.closest("[data-investigation-update]");
            if (updateButton) updateInvestigation(updateButton.dataset.investigationUpdate);

            const downloadButton = event.target.closest("[data-export-download]");
            if (downloadButton) downloadExport(downloadButton.dataset.exportDownload);
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                $$(".modal-overlay").forEach(modal => modal.hidden = true);
            }
        });
    }

    async function refreshAll() {
        await Promise.allSettled([
            loadDashboard(),
            loadActivity(),
            loadExports()
        ]);
    }

    async function initialize() {
        bindEvents();

        await loadAdministrators();
        await refreshAll();

        state.refreshTimer = setInterval(() => {
            loadDashboard();
        }, CONFIG.refreshInterval);
    }

    document.addEventListener("DOMContentLoaded", initialize);

    window.TALVORA_AUDIT = {
        refresh: refreshAll,
        navigate,
        openEvent,
        generateExport,
        config: CONFIG
    };

})();
