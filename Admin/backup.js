
/* =========================================================
   TALVORA TECHNOLOGIES
   DATA BACKUP, RECOVERY & BUSINESS CONTINUITY
   backup.js

   Frontend implementation.
   No demo data.
   No fabricated infrastructure statistics.
   No simulated backup success.

   All privileged operations require backend authorization.
========================================================= */

(() => {
    "use strict";

    const ROOT = document.querySelector(".tb-page");

    if (!ROOT) return;

    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const API_BASE = (
        window.TALVORA_BACKUP_API_BASE ||
        "/api/v1/admin/backup"
    ).replace(/\/+$/, "");

    const PAGE_SIZE = 20;

    /* =====================================================
       STATE
    ===================================================== */

    const state = {

        view: "overview",

        connection: "unknown",

        recoveryPoints: [],

        jobsPage: 1,

        jobsTotal: 0,

        auditPage: 1,

        auditTotal: 0,

        pendingRequest: null

    };

    /* =====================================================
       DOM HELPERS
    ===================================================== */

    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

    const $$ = (selector, parent = document) =>
        Array.from(parent.querySelectorAll(selector));

    function setText(id, value) {

        const element = document.getElementById(id);

        if (!element) return;

        element.textContent =
            value === null ||
                value === undefined ||
                value === ""
                ? "—"
                : String(value);

    }

    function escapeHTML(value) {

        return String(value ?? "").replace(/[&<>"']/g, char => ({

            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"

        })[char]);

    }

    function formatNumber(value) {

        if (
            value === null ||
            value === undefined ||
            value === "" ||
            !Number.isFinite(Number(value))
        ) {
            return "—";
        }

        return Number(value).toLocaleString();

    }

    function formatBytes(value) {

        if (
            value === null ||
            value === undefined ||
            !Number.isFinite(Number(value))
        ) {
            return "—";
        }

        const bytes = Number(value);

        if (bytes === 0) return "0 Bytes";

        const units = [
            "Bytes",
            "KB",
            "MB",
            "GB",
            "TB",
            "PB"
        ];

        const index = Math.min(
            Math.floor(Math.log(bytes) / Math.log(1024)),
            units.length - 1
        );

        return (
            bytes / Math.pow(1024, index)
        ).toFixed(2) + " " + units[index];

    }

    function formatDate(value) {

        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "—";

        return new Intl.DateTimeFormat(undefined, {

            year: "numeric",
            month: "short",
            day: "2-digit"

        }).format(date);

    }

    function formatDateTime(value) {

        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "—";

        return new Intl.DateTimeFormat(undefined, {

            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"

        }).format(date);

    }

    function normaliseStatus(value) {

        return String(value || "unknown")
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_-]/g, "");

    }

    function statusBadge(value) {

        const status = normaliseStatus(value);

        return `
            <span class="tb-status tb-status-${escapeHTML(status)}">
                ${escapeHTML(String(value || "Unknown").replace(/_/g, " "))}
            </span>
        `;

    }

    function getItems(response) {

        if (Array.isArray(response)) return response;

        if (Array.isArray(response?.items)) {
            return response.items;
        }

        if (Array.isArray(response?.results)) {
            return response.results;
        }

        if (Array.isArray(response?.data?.items)) {
            return response.data.items;
        }

        return [];

    }

    function getTotal(response, items) {

        const total =
            response?.total ??
            response?.pagination?.total ??
            response?.meta?.total;

        return Number.isFinite(Number(total))
            ? Number(total)
            : items.length;

    }

    function buildQuery(parameters = {}) {

        const query = new URLSearchParams();

        Object.entries(parameters).forEach(([key, value]) => {

            if (
                value !== undefined &&
                value !== null &&
                String(value).trim() !== ""
            ) {
                query.set(key, String(value));
            }

        });

        const result = query.toString();

        return result ? `?${result}` : "";

    }

    /* =====================================================
       CONNECTION STATUS
    ===================================================== */

    function setConnection(connected, message) {

        state.connection = connected
            ? "connected"
            : "disconnected";

        const dot = $("#tb-connection-dot");

        const label = $("#tb-connection-label");

        const sidebarDot = $(".tb-online-dot");

        const sidebarStatus = $("#tb-sidebar-status");

        if (dot) {

            dot.classList.toggle("connected", connected);

            dot.classList.toggle("disconnected", !connected);

        }

        if (label) {

            label.textContent = message || (
                connected
                    ? "Backend connected"
                    : "Backend unavailable"
            );

        }

        if (sidebarDot) {

            sidebarDot.style.background = connected
                ? "#149b70"
                : "#e69a27";

        }

        if (sidebarStatus) {

            sidebarStatus.textContent = connected
                ? "Infrastructure connected"
                : "Awaiting infrastructure";

        }

    }

    /* =====================================================
       API ERROR HANDLING
    ===================================================== */

    class ApiError extends Error {

        constructor(message, status = 0, details = null) {

            super(message);

            this.name = "ApiError";

            this.status = status;

            this.details = details;

        }

    }

    async function apiRequest(path, options = {}) {

        const headers = new Headers(options.headers || {});

        headers.set("Accept", "application/json");

        if (
            options.body &&
            !(options.body instanceof FormData)
        ) {
            headers.set("Content-Type", "application/json");
        }

        /*
          Cookie-based authentication should be protected
          using a backend-issued CSRF token.
        */

        const csrfToken = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content");

        if (csrfToken) {

            headers.set("X-CSRF-Token", csrfToken);

        }

        let response;

        try {

            response = await fetch(
                `${API_BASE}${path}`,
                {
                    ...options,
                    headers,
                    credentials: "same-origin",
                    cache: "no-store"
                }
            );

        } catch {

            setConnection(false);

            throw new ApiError(
                "The TALVORA backup service could not be reached."
            );

        }

        let data = null;

        const contentType =
            response.headers.get("content-type") || "";

        if (response.status !== 204) {

            if (contentType.includes("application/json")) {

                data = await response.json().catch(() => null);

            } else {

                const text = await response.text().catch(() => "");

                data = text ? { message: text } : null;

            }

        }

        if (!response.ok) {

            if (response.status === 401) {

                setConnection(false, "Authentication required");

            }

            throw new ApiError(
                data?.message ||
                data?.error ||
                `Request failed (${response.status}).`,
                response.status,
                data
            );

        }

        setConnection(true);

        return data;

    }

    function errorMessage(error) {

        return error?.message ||
            "An unexpected error occurred.";

    }

    /* =====================================================
       TOASTS
    ===================================================== */

    function toast(message, type = "info") {

        const region = $("#tb-toast-region");

        if (!region) return;

        const element = document.createElement("div");

        element.className = `tb-toast ${type}`;

        element.textContent = message;

        region.appendChild(element);

        window.setTimeout(() => {

            element.remove();

        }, 5000);

    }

    function showNotice(message) {

        const notice = $("#tb-global-notice");

        if (!notice) return;

        notice.textContent = message;

        notice.hidden = false;

    }

    function clearNotice() {

        const notice = $("#tb-global-notice");

        if (!notice) return;

        notice.textContent = "";

        notice.hidden = true;

    }

    /* =====================================================
       MODALS
    ===================================================== */

    function openModal(id) {

        const modal = document.getElementById(id);

        if (!modal) return;

        modal.hidden = false;

        document.body.classList.add("tb-modal-open");

    }

    function closeModal(id) {

        const modal = document.getElementById(id);

        if (!modal) return;

        modal.hidden = true;

        const anyOpen = $$(".tb-modal").some(
            item => !item.hidden
        );

        document.body.classList.toggle(
            "tb-modal-open",
            anyOpen
        );

    }

    function closeAllModals() {

        $$(".tb-modal").forEach(modal => {

            modal.hidden = true;

        });

        document.body.classList.remove("tb-modal-open");

        state.pendingRequest = null;

    }

    /* =====================================================
       NAVIGATION
    ===================================================== */

    const VALID_VIEWS = [

        "overview",
        "policies",
        "jobs",
        "storage",
        "recovery",
        "continuity",
        "integrity",
        "audit"

    ];

    async function switchView(view) {

        if (!VALID_VIEWS.includes(view)) return;

        state.view = view;

        $$(".tb-module-tab").forEach(tab => {

            const active = tab.dataset.view === view;

            tab.classList.toggle("active", active);

            tab.setAttribute(
                "aria-selected",
                String(active)
            );

        });

        $$(".tb-view").forEach(section => {

            section.hidden =
                section.id !== `tb-view-${view}`;

        });

        clearNotice();

        await loadCurrentView();

    }

    async function loadCurrentView() {

        try {

            switch (state.view) {

                case "overview":
                    await loadOverview();
                    break;

                case "policies":
                    await loadPolicy();
                    break;

                case "jobs":
                    await loadJobs();
                    break;

                case "storage":
                    await loadStorage();
                    break;

                case "recovery":
                    await loadRecovery();
                    break;

                case "continuity":
                    await loadContinuity();
                    break;

                case "integrity":
                    await loadIntegrity();
                    break;

                case "audit":
                    await loadAudit();
                    break;

            }

        } catch (error) {

            showNotice(errorMessage(error));

        }

    }

    /* =====================================================
       ADMINISTRATOR PROFILE
    ===================================================== */

    async function loadAdminProfile() {

        try {

            const data = await apiRequest("/me");

            const admin =
                data?.admin ||
                data?.data ||
                data;

            if (admin?.name) {

                setText("tb-admin-name", admin.name);

                setText(
                    "tb-admin-avatar",
                    admin.name
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map(word => word[0].toUpperCase())
                        .join("")
                );

            }

        } catch {

            /*
              Keep neutral placeholder.
              Never invent administrator identity.
            */

        }

    }

    /* =====================================================
       OVERVIEW
    ===================================================== */

    async function loadOverview() {

        const data = await apiRequest("/overview");

        const metrics =
            data?.metrics ||
            data?.data ||
            data;

        setText(
            "tb-last-full-backup",
            formatDateTime(metrics.last_successful_full_backup_at)
        );

        setText(
            "tb-last-full-backup-detail",
            metrics.last_successful_full_backup_status || "Live backup information"
        );

        setText(
            "tb-protected-volume",
            metrics.protected_data_bytes !== undefined
                ? formatBytes(metrics.protected_data_bytes)
                : metrics.protected_data_volume
        );

        setText(
            "tb-operational-regions",
            metrics.operational_regions === undefined
                ? "—"
                : `${metrics.operational_regions} / 3`
        );

        setText(
            "tb-open-incidents",
            formatNumber(metrics.open_recovery_incidents)
        );

        renderPortalHealth(
            data?.portal_protection || []
        );

        renderRecentEvents(
            data?.recent_events || []
        );

    }

    function renderPortalHealth(records) {

        const container = $("#tb-portal-health");

        if (!container) return;

        if (!records.length) {

            container.innerHTML = `
                <div class="tb-empty-state">
                    <span class="tb-empty-icon">◈</span>
                    <strong>No portal health records available</strong>
                    <p>Portal backup status will appear when returned by the backup service.</p>
                </div>
            `;

            return;

        }

        container.innerHTML = records.map(record => `

            <div class="tb-portal-item">

                <div class="tb-portal-icon">◫</div>

                <div class="tb-portal-details">

                    <strong>${escapeHTML(record.portal || record.name || "Platform portal")}</strong>

                    <small>
                        ${escapeHTML(record.last_backup_at
            ? formatDateTime(record.last_backup_at)
            : "Last backup unavailable")}
                    </small>

                </div>

                <div class="tb-portal-status">
                    ${statusBadge(record.status)}
                </div>

            </div>

        `).join("");

    }

    function renderRecentEvents(records) {

        const tbody = $("#tb-recent-events");

        if (!tbody) return;

        if (!records.length) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="tb-table-empty">
                        No backup or recovery events returned by the platform.
                    </td>
                </tr>
            `;

            return;

        }

        tbody.innerHTML = records.map(record => `

            <tr>

                <td>${escapeHTML(record.reference || record.id || "—")}</td>

                <td>${escapeHTML(record.operation || record.event_type || "—")}</td>

                <td>${escapeHTML(record.scope || record.portal || "—")}</td>

                <td>${statusBadge(record.status)}</td>

                <td>${escapeHTML(formatDateTime(record.created_at))}</td>

            </tr>

        `).join("");

    }

    /* =====================================================
       BACKUP POLICY
    ===================================================== */

    async function loadPolicy() {

        const data = await apiRequest("/policy");

        const policy = data?.policy || data?.data || data;

        if (!policy) return;

        if (policy.incremental_mode) {

            $("#tb-incremental-mode").value =
                policy.incremental_mode;

        }

        if (policy.full_backup_schedule) {

            $("#tb-full-schedule").value =
                policy.full_backup_schedule;

        }

        if (policy.retention_days !== undefined) {

            $("#tb-retention-days").value =
                String(policy.retention_days);

        }

        if (policy.storage_regions !== undefined) {

            $("#tb-storage-regions").value =
                String(policy.storage_regions);

        }

        if (policy.encryption_at_rest) {

            $("#tb-encryption").value =
                policy.encryption_at_rest;

        }

        if (policy.transmission_encryption) {

            $("#tb-transport-encryption").value =
                policy.transmission_encryption;

        }

        if (policy.key_management) {

            $("#tb-key-management").value =
                policy.key_management;

        }

        if (policy.offsite_protection) {

            $("#tb-offsite").value =
                policy.offsite_protection;

        }

    }

    async function submitPolicy(event) {

        event.preventDefault();

        const reason = $("#tb-policy-reason").value.trim();

        if (reason.length < 5) {

            toast("Provide a meaningful policy change reason.", "warning");

            return;

        }

        const payload = {

            incremental_mode:
                $("#tb-incremental-mode").value,

            full_backup_schedule:
                $("#tb-full-schedule").value,

            retention_days:
                Number($("#tb-retention-days").value),

            storage_regions:
                Number($("#tb-storage-regions").value),

            encryption_at_rest:
                $("#tb-encryption").value,

            transmission_encryption:
                $("#tb-transport-encryption").value,

            key_management:
                $("#tb-key-management").value,

            offsite_protection:
                $("#tb-offsite").value,

            portal_coverage: [
                "employer",
                "employee",
                "super_admin"
            ],

            reason

        };

        await submitFormRequest(
            event.currentTarget,
            "/policy",
            "PATCH",
            payload,
            "Backup policy configuration submitted.",
            "policies"
        );

    }

    /* =====================================================
       BACKUP HISTORY
    ===================================================== */

    async function loadJobs() {

        const query = buildQuery({

            search: $("#tb-job-search")?.value,

            type: $("#tb-job-type-filter")?.value,

            status: $("#tb-job-status-filter")?.value,

            page: state.jobsPage,

            page_size: PAGE_SIZE

        });

        const data = await apiRequest(
            `/jobs${query}`
        );

        const records = getItems(data);

        state.jobsTotal = getTotal(data, records);

        renderJobs(records);

        updateJobPagination(data);

    }

    function renderJobs(records) {

        const tbody = $("#tb-jobs-body");

        if (!tbody) return;

        if (!records.length) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="tb-table-empty">
                        No backup records returned by the platform.
                    </td>
                </tr>
            `;

            return;

        }

        tbody.innerHTML = records.map(job => `

            <tr>

                <td>
                    <strong>${escapeHTML(job.reference || job.id || "—")}</strong>
                </td>

                <td>${escapeHTML(job.type || job.backup_type || "—")}</td>

                <td>${escapeHTML(job.scope || job.portal || "—")}</td>

                <td>${escapeHTML(job.storage_region || "—")}</td>

                <td>${escapeHTML(formatBytes(job.data_size_bytes))}</td>

                <td>${statusBadge(job.status)}</td>

                <td>${escapeHTML(formatDateTime(job.started_at))}</td>

                <td>${escapeHTML(formatDateTime(job.completed_at))}</td>

                <td>
                    <button
                        class="tb-row-button"
                        data-job-details="${escapeHTML(job.id || "")}"
                    >
                        Details
                    </button>
                </td>

            </tr>

        `).join("");

    }

    function updateJobPagination(data = {}) {

        const current = Number(
            data.page || state.jobsPage
        );

        const pages = Math.max(
            1,
            Math.ceil(state.jobsTotal / PAGE_SIZE)
        );

        state.jobsPage = current;

        setText(
            "tb-jobs-count",
            `${formatNumber(state.jobsTotal)} backup records`
        );

        setText(
            "tb-jobs-page",
            `${current} / ${pages}`
        );

        $("#tb-jobs-prev").disabled = current <= 1;

        $("#tb-jobs-next").disabled = current >= pages;

    }

    async function submitBackup(event) {

        event.preventDefault();

        const payload = {

            backup_type:
                $("#tb-run-type").value,

            scope:
                $("#tb-run-scope").value,

            reason:
                $("#tb-run-reason").value.trim()

        };

        if (payload.reason.length < 5) {

            toast("Please explain the reason for this backup.", "warning");

            return;

        }

        await submitFormRequest(
            event.currentTarget,
            "/jobs",
            "POST",
            payload,
            "Backup request accepted by the backend.",
            "jobs",
            "tb-run-modal"
        );

    }

    /* =====================================================
       STORAGE & REPLICATION
    ===================================================== */

    async function loadStorage() {

        const [regionData, replicationData] =
            await Promise.all([

                apiRequest("/storage/regions"),

                apiRequest("/storage/replication-events")

            ]);

        renderRegions(
            getItems(regionData)
        );

        renderReplication(
            getItems(replicationData)
        );

    }

    function renderRegions(records) {

        const tbody = $("#tb-regions-body");

        if (!tbody) return;

        if (!records.length) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="tb-table-empty">
                        No storage region records returned by the infrastructure.
                    </td>
                </tr>
            `;

            return;

        }

        tbody.innerHTML = records.map(region => `

            <tr>

                <td>${escapeHTML(region.reference || region.id || "—")}</td>

                <td>${escapeHTML(region.location || region.country || "—")}</td>

                <td>${escapeHTML(region.role || "—")}</td>

                <td>${statusBadge(region.replication_status)}</td>

                <td>${statusBadge(region.encryption_status)}</td>

                <td>${escapeHTML(formatDateTime(region.last_synchronized_at))}</td>

                <td>${statusBadge(region.health_status || region.status)}</td>

            </tr>

        `).join("");

    }

    function renderReplication(records) {

        const tbody = $("#tb-replication-body");

        if (!tbody) return;

        if (!records.length) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="tb-table-empty">
                        No replication events returned by the platform.
                    </td>
                </tr>
            `;

            return;

        }

        tbody.innerHTML = records.map(event => `

            <tr>

                <td>${escapeHTML(event.reference || event.id || "—")}</td>

                <td>${escapeHTML(event.source_region || "—")}</td>

                <td>${escapeHTML(event.destination_region || "—")}</td>

                <td>${escapeHTML(formatBytes(event.data_size_bytes))}</td>

                <td>${statusBadge(event.status)}</td>

                <td>${escapeHTML(formatDateTime(event.created_at))}</td>

            </tr>

        `).join("");

    }

    /* =====================================================
       RECOVERY CENTRE
    ===================================================== */

    async function loadRecovery() {

        const [pointData, requestData] =
            await Promise.all([

                apiRequest("/recovery-points"),

                apiRequest("/restore-requests")

            ]);

        state.recoveryPoints = getItems(pointData);

        renderRecoveryPoints(state.recoveryPoints);

        renderRestoreRequests(
            getItems(requestData)
        );

        populateRecoverySelects(
            state.recoveryPoints
        );

    }

    function populateRecoverySelects(records) {

        const selects = [

            $("#tb-restore-point"),

            $("#tb-test-point")

        ];

        selects.forEach(select => {

            if (!select) return;

            const previousValue = select.value;

            select.innerHTML = `
                <option value="">Select a recovery point</option>
            `;

            records.forEach(point => {

                const id = String(point.id || "");

                if (!id) return;

                const integrity = normaliseStatus(
                    point.integrity_status
                );

                const available = normaliseStatus(
                    point.availability_status || point.status
                );

                const valid = [
                    "verified",
                    "passed",
                    "healthy",
                    "valid"
                ].includes(integrity);

                const availableStatus = [
                    "available",
                    "active",
                    "healthy",
                    "ready"
                ].includes(available);

                const option = document.createElement("option");

                option.value = id;

                option.textContent =
                    `${point.reference || id} — ${formatDateTime(point.created_at || point.timestamp)}`;

                option.disabled = !valid || !availableStatus;

                select.appendChild(option);

            });

            if (
                previousValue &&
                Array.from(select.options).some(
                    option => option.value === previousValue && !option.disabled
                )
            ) {
                select.value = previousValue;
            }

        });

    }

    function renderRecoveryPoints(records) {

        const tbody = $("#tb-recovery-points-body");

        if (!tbody) return;

        if (!records.length) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="tb-table-empty">
                        No recovery points returned by the platform.
                    </td>
                </tr>
            `;

            return;

        }

        tbody.innerHTML = records.map(point => {

            const id = String(point.id || "");

            const integrity = normaliseStatus(
                point.integrity_status
            );

            const availability = normaliseStatus(
                point.availability_status || point.status
            );

            const valid = [
                "verified",
                "passed",
                "healthy",
                "valid"
            ].includes(integrity);

            const available = [
                "available",
                "active",
                "healthy",
                "ready"
            ].includes(availability);

            const canRestore = valid && available && id;


            return `

                <tr>

                    <td>${escapeHTML(point.reference || id || "—")}</td>

                    <td>${escapeHTML(point.backup_type || "—")}</td>

                    <td>${escapeHTML(point.scope || point.portal || "—")}</td>

                    <td>${escapeHTML(formatDateTime(point.created_at || point.timestamp))}</td>

                    <td>${statusBadge(point.integrity_status)}</td>

                    <td>${escapeHTML(point.storage_region || "—")}</td>

                    <td>${statusBadge(point.availability_status || point.status)}</td>

                    <td>

                        <button
                            class="tb-row-button"
                            data-restore-point="${escapeHTML(id)}"
                            ${canRestore ? "" : "disabled"}
                        >
                            Request Restore
                        </button>

                    </td>

                </tr>

            `;

        }).join("");

    }

    function renderRestoreRequests(records) {

        const tbody = $("#tb-restore-requests-body");

        if (!tbody) return;

        if (!records.length) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="tb-table-empty">
                        No restoration requests returned by the platform.
                    </td>
                </tr>
            `;

            return;

        }

        tbody.innerHTML = records.map(request => `

            <tr>

                <td>${escapeHTML(request.reference || request.id || "—")}</td>

                <td>${escapeHTML(request.recovery_point_reference || "—")}</td>

                <td>${escapeHTML(request.target || "—")}</td>

                <td>${escapeHTML(request.requested_by || "—")}</td>

                <td>${statusBadge(request.approval_status)}</td>

                <td>${statusBadge(request.execution_status || request.status)}</td>

                <td>${escapeHTML(formatDateTime(request.created_at))}</td>

            </tr>

        `).join("");

    }

    async function submitRestore(event) {

        event.preventDefault();

        if (!$("#tb-restore-confirm").checked) {

            toast(
                "Confirm the recovery point and scope first.",
                "warning"
            );

            return;

        }

        const pointId = $("#tb-restore-point").value;

        const point = state.recoveryPoints.find(
            item => String(item.id) === pointId
        );

        if (!point) {

            toast(
                "Select a valid recovery point.",
                "warning"
            );

            return;

        }

        const integrity = normaliseStatus(
            point.integrity_status
        );

        const available = normaliseStatus(
            point.availability_status || point.status
        );

        if (
            !["verified", "passed", "healthy", "valid"].includes(integrity) ||
            !["available", "active", "healthy", "ready"].includes(available)
        ) {

            toast(
                "This recovery point is not verified and available.",
                "error"
            );

            return;

        }

        const payload = {

            recovery_point_id: pointId,

            scope: $("#tb-restore-scope").value,

            target: $("#tb-restore-target").value,

            reason: $("#tb-restore-reason").value.trim(),

            acknowledged: true

        };

        if (payload.reason.length < 5) {

            toast("A meaningful recovery reason is required.", "warning");

            return;

        }

        await submitFormRequest(
            event.currentTarget,
            "/restore-requests",
            "POST",
            payload,
            "Recovery request submitted for backend validation and approval.",
            "recovery",
            "tb-restore-modal"
        );

    }

    /* =====================================================
       DISASTER RECOVERY & CONTINUITY
    ===================================================== */

    async function loadContinuity() {

        const [
            testData,
            planData,
            incidentData
        ] = await Promise.all([

            apiRequest("/recovery/tests"),

            apiRequest("/continuity/plans"),

            apiRequest("/incidents")

        ]);

        renderTests(
            getItems(testData)
        );

        renderPlans(
            getItems(planData)
        );

        renderIncidents(
            getItems(incidentData)
        );

    }

    function renderTests(records) {

        const tbody = $("#tb-tests-body");

        if (!tbody) return;

        if (!records.length) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="tb-table-empty">
                        No recovery test records returned by the platform.
                    </td>
                </tr>
            `;

            return;

        }

        tbody.innerHTML = records.map(test => `

            <tr>

                <td>${escapeHTML(test.reference || test.id || "—")}</td>

                <td>${escapeHTML(test.scope || "—")}</td>

                <td>${escapeHTML(test.environment || "—")}</td>

                <td>${statusBadge(test.result || test.status)}</td>

                <td>${escapeHTML(test.actual_recovery_time || "—")}</td>

                <td>${statusBadge(test.integrity_result)}</td>

                <td>${escapeHTML(formatDateTime(test.created_at))}</td>

            </tr>

        `).join("");

    }

    function renderPlans(records) {

        const tbody = $("#tb-plans-body");

        if (!tbody) return;

        if (!records.length) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="tb-table-empty">
                        No business continuity plans returned by the platform.
                    </td>
                </tr>
            `;

            return;

        }

        tbody.innerHTML = records.map(plan => `

            <tr>

                <td>${escapeHTML(plan.reference || plan.id || "—")}</td>

                <td>${escapeHTML(plan.name || "—")}</td>

                <td>${escapeHTML(plan.scope || "—")}</td>

                <td>${escapeHTML(plan.responsible_team || "—")}</td>

                <td>${statusBadge(plan.approval_status || plan.status)}</td>

                <td>${escapeHTML(formatDate(plan.last_reviewed_at))}</td>

            </tr>

        `).join("");

    }

    function renderIncidents(records) {

        const tbody = $("#tb-incidents-body");

        if (!tbody) return;

        if (!records.length) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="tb-table-empty">
                        No disaster recovery incidents returned by the platform.
                    </td>
                </tr>
            `;

            return;

        }

        tbody.innerHTML = records.map(incident => `

            <tr>

                <td>${escapeHTML(incident.reference || incident.id || "—")}</td>

                <td>${escapeHTML(incident.type || incident.incident_type || "—")}</td>

                <td>${escapeHTML(incident.affected_service || "—")}</td>

                <td>${statusBadge(incident.severity)}</td>

                <td>${statusBadge(incident.status)}</td>

                <td>${escapeHTML(formatDateTime(incident.opened_at))}</td>

                <td>${escapeHTML(formatDateTime(incident.resolved_at))}</td>

            </tr>

        `).join("");

    }

    async function submitRecoveryTest(event) {

        event.preventDefault();

        const pointId = $("#tb-test-point").value;

        const payload = {

            recovery_point_id: pointId,

            scope: $("#tb-test-scope").value,

            environment: "isolated",

            reason: $("#tb-test-reason").value.trim()

        };

        if (!payload.recovery_point_id) {

            toast("Select a recovery point.", "warning");

            return;

        }

        if (payload.reason.length < 5) {

            toast("Please explain the recovery test objective.", "warning");

            return;

        }

        await submitFormRequest(
            event.currentTarget,
            "/recovery/tests",
            "POST",
            payload,
            "Recovery test request submitted.",
            "continuity",
            "tb-test-modal"
        );

    }

    async function submitPlan(event) {

        event.preventDefault();

        const payload = {

            name: $("#tb-plan-name").value.trim(),

            scope: $("#tb-plan-scope").value,

            responsible_team: $("#tb-plan-team").value.trim(),

            description: $("#tb-plan-description").value.trim()

        };

        if (
            payload.name.length < 3 ||
            payload.responsible_team.length < 2 ||
            payload.description.length < 10
        ) {

            toast(
                "Complete all continuity plan fields.",
                "warning"
            );

            return;

        }

        await submitFormRequest(
            event.currentTarget,
            "/continuity/plans",
            "POST",
            payload,
            "Continuity plan submitted.",
            "continuity",
            "tb-plan-modal"
        );

    }

    /* =====================================================
       DATA INTEGRITY
    ===================================================== */

    async function loadIntegrity() {

        const data = await apiRequest(
            "/integrity/checks"
        );

        renderIntegrity(
            getItems(data)
        );

    }

    function renderIntegrity(records) {

        const tbody = $("#tb-integrity-body");

        if (!tbody) return;

        if (!records.length) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="tb-table-empty">
                        No integrity checks returned by the platform.
                    </td>
                </tr>
            `;

            return;

        }

        tbody.innerHTML = records.map(check => `

            <tr>

                <td>${escapeHTML(check.reference || check.id || "—")}</td>

                <td>${escapeHTML(check.backup_reference || "—")}</td>

                <td>${escapeHTML(check.validation_type || "—")}</td>

                <td>${escapeHTML(check.scope || "—")}</td>

                <td>${statusBadge(check.result || check.status)}</td>

                <td>${escapeHTML(check.findings_count ?? "—")}</td>

                <td>${escapeHTML(formatDateTime(check.created_at))}</td>

            </tr>

        `).join("");

    }

    async function submitIntegrity(event) {

        event.preventDefault();

        const payload = {

            validation_type:
                $("#tb-integrity-type").value,

            scope:
                $("#tb-integrity-scope").value,

            reason:
                $("#tb-integrity-reason").value.trim()

        };

        if (payload.reason.length < 5) {

            toast("A meaningful verification reason is required.", "warning");

            return;

        }

        await submitFormRequest(
            event.currentTarget,
            "/integrity/checks",
            "POST",
            payload,
            "Integrity verification request submitted.",
            "integrity",
            "tb-integrity-modal"
        );

    }

    /* =====================================================
       AUDIT TRAIL
    ===================================================== */

    async function loadAudit() {

        const query = buildQuery({

            search: $("#tb-audit-search")?.value,

            action: $("#tb-audit-action-filter")?.value,

            from: $("#tb-audit-from")?.value,

            to: $("#tb-audit-to")?.value,

            page: state.auditPage,

            page_size: PAGE_SIZE

        });

        const data = await apiRequest(
            `/audit${query}`
        );

        const records = getItems(data);

        state.auditTotal = getTotal(data, records);

        renderAudit(records);

        updateAuditPagination(data);

    }

    function renderAudit(records) {

        const tbody = $("#tb-audit-body");

        if (!tbody) return;

        if (!records.length) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="tb-table-empty">
                        No audit records returned by the platform.
                    </td>
                </tr>
            `;

            return;

        }

        tbody.innerHTML = records.map(record => {

            const details = {

                reference: record.reference,

                before: record.before,

                after: record.after,

                additional_details: record.details

            };

            return `

                <tr>

                    <td>${escapeHTML(formatDateTime(record.created_at))}</td>

                    <td>
                        ${escapeHTML(record.administrator_name || "—")}
                        <br>
                        <small>${escapeHTML(record.administrator_email || "")}</small>
                    </td>

                    <td>${escapeHTML(record.action || "—")}</td>

                    <td>${escapeHTML(record.resource || record.resource_reference || "—")}</td>

                    <td>${escapeHTML(record.reason || "—")}</td>

                    <td>${escapeHTML(record.ip_address || "—")}</td>

                    <td>${statusBadge(record.result || record.status)}</td>

                    <td>

                        <details>
                            <summary>Details</summary>
                            <pre class="tb-audit-details">${escapeHTML(JSON.stringify(details, null, 2))}</pre>
                        </details>

                    </td>

                </tr>

            `;

        }).join("");

    }

    function updateAuditPagination(data = {}) {

        const current = Number(
            data.page || state.auditPage
        );

        const pages = Math.max(
            1,
            Math.ceil(state.auditTotal / PAGE_SIZE)
        );

        state.auditPage = current;

        setText(
            "tb-audit-count",
            `${formatNumber(state.auditTotal)} audit records`
        );

        setText(
            "tb-audit-page",
            `${current} / ${pages}`
        );

        $("#tb-audit-prev").disabled = current <= 1;

        $("#tb-audit-next").disabled = current >= pages;

    }

    /* =====================================================
       COMMON FORM SUBMISSION
    ===================================================== */

    async function submitFormRequest(
        form,
        path,
        method,
        payload,
        successMessage,
        refreshView,
        modalId = null
    ) {

        const submitButton = form.querySelector(
            'button[type="submit"]'
        );

        const originalText = submitButton?.textContent;

        if (submitButton) {

            submitButton.disabled = true;

            submitButton.textContent = "Processing...";

        }

        try {

            await apiRequest(
                path,
                {
                    method,
                    body: JSON.stringify(payload)
                }
            );

            if (modalId) {

                closeModal(modalId);

            }

            form.reset();

            toast(successMessage, "success");

            if (refreshView) {

                await switchView(refreshView);

            }

        } catch (error) {

            toast(
                errorMessage(error),
                "error"
            );

        } finally {

            if (submitButton) {

                submitButton.disabled = false;

                submitButton.textContent =
                    originalText || "Submit";

            }

        }

    }

    /* =====================================================
       EXPORT
    ===================================================== */

    async function exportAudit() {

        const query = buildQuery({

            search: $("#tb-audit-search")?.value,

            action: $("#tb-audit-action-filter")?.value,

            from: $("#tb-audit-from")?.value,

            to: $("#tb-audit-to")?.value

        });

        try {

            const csrfToken = document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute("content");

            const headers = new Headers();

            if (csrfToken) {

                headers.set("X-CSRF-Token", csrfToken);

            }

            const response = await fetch(
                `${API_BASE}/audit/export${query}`,
                {
                    method: "GET",
                    headers,
                    credentials: "same-origin",
                    cache: "no-store"
                }
            );

            if (!response.ok) {

                const error = await response.json()
                    .catch(() => null);

                throw new ApiError(
                    error?.message ||
                    `Export failed (${response.status}).`,
                    response.status
                );

            }

            const blob = await response.blob();

            if (!blob.size) {

                throw new Error("The export returned an empty file.");

            }

            const url = URL.createObjectURL(blob);

            const anchor = document.createElement("a");

            anchor.href = url;

            anchor.download = "talvora-backup-recovery-audit.csv";

            document.body.appendChild(anchor);

            anchor.click();

            anchor.remove();

            URL.revokeObjectURL(url);

            setConnection(true);

            toast("Audit export downloaded.", "success");

        } catch (error) {

            toast(errorMessage(error), "error");

        }

    }

    /* =====================================================
       REFRESH
    ===================================================== */

    async function refreshAll() {

        const button = $("#tb-refresh");

        if (button) {

            button.disabled = true;

            button.textContent = "...";

        }

        clearNotice();

        try {

            await Promise.all([

                loadOverview(),

                loadCurrentView()

            ]);

            toast(
                "Backup centre information refreshed.",
                "success"
            );

        } catch (error) {

            showNotice(errorMessage(error));

        } finally {

            if (button) {

                button.disabled = false;

                button.textContent = "↻";

            }

        }

    }

    /* =====================================================
       SIDEBAR
    ===================================================== */

    function openSidebar() {

        $("#tb-sidebar")?.classList.add("open");

        $("#tb-sidebar-overlay")?.classList.add("visible");

    }

    function closeSidebar() {

        $("#tb-sidebar")?.classList.remove("open");

        $("#tb-sidebar-overlay")?.classList.remove("visible");

    }

    /* =====================================================
       EVENT LISTENERS: NAVIGATION
    ===================================================== */

    $$(".tb-module-tab").forEach(tab => {

        tab.addEventListener("click", () => {

            switchView(tab.dataset.view);

        });

    });

    $$("[data-go-view]").forEach(button => {

        button.addEventListener("click", () => {

            switchView(button.dataset.goView);

        });

    });

    $("#tb-menu-button")?.addEventListener(
        "click",
        openSidebar
    );

    $("#tb-sidebar-close")?.addEventListener(
        "click",
        closeSidebar
    );

    $("#tb-sidebar-overlay")?.addEventListener(
        "click",
        closeSidebar
    );

    /* =====================================================
       EVENT LISTENERS: REFRESH
    ===================================================== */

    $("#tb-refresh")?.addEventListener(
        "click",
        refreshAll
    );

    /* =====================================================
       EVENT LISTENERS: OPEN MODALS
    ===================================================== */

    $$('[data-action="open-run"]').forEach(button => {

        button.addEventListener("click", () => {

            openModal("tb-run-modal");

        });

    });

    $$('[data-action="open-restore"]').forEach(button => {

        button.addEventListener("click", () => {

            openModal("tb-restore-modal");

        });

    });

    $$('[data-action="open-test"]').forEach(button => {

        button.addEventListener("click", () => {

            openModal("tb-test-modal");

        });

    });

    $$('[data-action="open-plan"]').forEach(button => {

        button.addEventListener("click", () => {

            openModal("tb-plan-modal");

        });

    });

    $$('[data-action="open-integrity"]').forEach(button => {

        button.addEventListener("click", () => {

            openModal("tb-integrity-modal");

        });

    });

    /* =====================================================
       EVENT LISTENERS: CLOSE MODALS
    ===================================================== */

    document.addEventListener("click", event => {

        const closeButton = event.target.closest(
            "[data-close-modal]"
        );

        if (!closeButton) return;

        const modal = closeButton.closest(".tb-modal");

        if (modal) {

            closeModal(modal.id);

        }

    });

    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {

            closeAllModals();

            closeSidebar();

        }

    });

    /* =====================================================
       EVENT LISTENERS: POLICY
    ===================================================== */

    $("#tb-policy-form")?.addEventListener(
        "submit",
        submitPolicy
    );

    /* =====================================================
       EVENT LISTENERS: BACKUP JOBS
    ===================================================== */

    $("#tb-run-form")?.addEventListener(
        "submit",
        submitBackup
    );

    $("#tb-filter-jobs")?.addEventListener(
        "click",
        () => {

            state.jobsPage = 1;

            loadJobs().catch(error =>
                toast(errorMessage(error), "error")
            );

        }
    );

    $("#tb-jobs-prev")?.addEventListener(
        "click",
        () => {

            if (state.jobsPage <= 1) return;

            state.jobsPage--;

            loadJobs().catch(error =>
                toast(errorMessage(error), "error")
            );

        }
    );

    $("#tb-jobs-next")?.addEventListener(
        "click",
        () => {

            state.jobsPage++;

            loadJobs().catch(error =>
                toast(errorMessage(error), "error")
            );

        }
    );

    $("#tb-jobs-body")?.addEventListener(
        "click",
        event => {

            const button = event.target.closest(
                "[data-job-details]"
            );

            if (!button) return;

            const id = button.dataset.jobDetails;

            if (!id) return;

            apiRequest(
                `/jobs/${encodeURIComponent(id)}`
            ).then(data => {

                const job = data?.job || data?.data || data;

                const details = {

                    reference: job.reference,

                    type: job.type,

                    scope: job.scope,

                    status: job.status,

                    storage_region: job.storage_region,

                    data_size_bytes: job.data_size_bytes,

                    started_at: job.started_at,

                    completed_at: job.completed_at,

                    failure_reason: job.failure_reason

                };

                toast(
                    JSON.stringify(details),
                    "info"
                );

            }).catch(error => {

                toast(errorMessage(error), "error");

            });

        }
    );

    /* =====================================================
       EVENT LISTENERS: RECOVERY
    ===================================================== */

    $("#tb-restore-form")?.addEventListener(
        "submit",
        submitRestore
    );

    $("#tb-recovery-points-body")?.addEventListener(
        "click",
        event => {

            const button = event.target.closest(
                "[data-restore-point]"
            );

            if (!button || button.disabled) return;

            const id = button.dataset.restorePoint;

            const select = $("#tb-restore-point");

            if (select) {

                select.value = id;

            }

            openModal("tb-restore-modal");

        }
    );

    /* =====================================================
       EVENT LISTENERS: RECOVERY TESTS
    ===================================================== */

    $("#tb-test-form")?.addEventListener(
        "submit",
        submitRecoveryTest
    );

    /* =====================================================
       EVENT LISTENERS: CONTINUITY PLANS
    ===================================================== */

    $("#tb-plan-form")?.addEventListener(
        "submit",
        submitPlan
    );

    /* =====================================================
       EVENT LISTENERS: INTEGRITY
    ===================================================== */

    $("#tb-integrity-form")?.addEventListener(
        "submit",
        submitIntegrity
    );

    /* =====================================================
       EVENT LISTENERS: AUDIT
    ===================================================== */

    $("#tb-filter-audit")?.addEventListener(
        "click",
        () => {

            state.auditPage = 1;

            loadAudit().catch(error =>
                toast(errorMessage(error), "error")
            );

        }
    );

    $("#tb-audit-prev")?.addEventListener(
        "click",
        () => {

            if (state.auditPage <= 1) return;

            state.auditPage--;

            loadAudit().catch(error =>
                toast(errorMessage(error), "error")
            );

        }
    );

    $("#tb-audit-next")?.addEventListener(
        "click",
        () => {

            state.auditPage++;

            loadAudit().catch(error =>
                toast(errorMessage(error), "error")
            );

        }
    );

    $("#tb-export-audit")?.addEventListener(
        "click",
        exportAudit
    );

    /* =====================================================
       INITIALIZATION
    ===================================================== */

    async function initialize() {

        setConnection(
            false,
            "Checking backend"
        );

        /*
          Only real backend information is loaded.

          No sample backup jobs.
          No invented storage regions.
          No fabricated recovery points.
        */

        const results = await Promise.allSettled([

            loadAdminProfile(),

            loadOverview()

        ]);

        const overviewSucceeded =
            results[1].status === "fulfilled";

        if (!overviewSucceeded) {

            setConnection(
                false,
                "Backend unavailable"
            );

            showNotice(
                "The TALVORA Backup & Recovery frontend is ready. The backend is not connected, so no live infrastructure information or backup records are currently available."
            );

        }

    }

    initialize();

})();
