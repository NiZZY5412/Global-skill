
/* =========================================================
   TALVORA TECHNOLOGIES
   USER ACCOUNTS, ACCESS & IDENTITY MANAGEMENT
   users.js

   Frontend API integration.

   No demo records.
   No fabricated activity.
   No client-side authorization claims.

   All privileged operations must be authorized,
   validated and audited by the backend.
========================================================= */

(() => {
    "use strict";

    const ROOT = document.querySelector(".ua-page");

    if (!ROOT) return;


    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const API_BASE = (
        window.TALVORA_IDENTITY_API_BASE ||
        "/api/v1/admin/identity"
    ).replace(/\/+$/, "");

    const PAGE_SIZE = 20;


    /* =====================================================
       STATE
    ===================================================== */

    const state = {

        view: "overview",

        connection: "unknown",

        overview: null,

        accounts: [],

        verifications: [],

        sessions: [],

        incidents: [],

        audit: [],

        notifications: [],

        currentAccount: null,

        selectedIds: new Set(),

        pendingAction: null,

        accountPage: 1,

        accountTotal: 0,

        auditPage: 1,

        auditTotal: 0,

        notificationDrawerOpen: false

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
            value === null || value === undefined || value === ""
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


    function safeNumber(value) {

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


    function initials(value) {

        const words = String(value || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        if (!words.length) return "NA";

        return words
            .slice(0, 2)
            .map(word => word[0].toUpperCase())
            .join("");

    }


    function normaliseStatus(value) {

        return String(value || "unknown")
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_-]/g, "");

    }


    function statusBadge(value) {

        const status = normaliseStatus(value);

        const label = String(value || "Unknown")
            .replace(/_/g, " ");

        return `
            <span class="ua-status-pill ua-status-${escapeHTML(status)}">
                ${escapeHTML(label)}
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

        state.connection = connected ? "connected" : "disconnected";

        const dot = $("#ua-connection-dot");

        const label = $("#ua-connection-label");

        const sidebarDot = $(".ua-online-dot");

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
          The backend should inject a CSRF token into this
          meta element when cookie-based authentication is used.
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
                "The TALVORA backend could not be reached. Check the server connection."
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

            const message =
                data?.message ||
                data?.error ||
                `Request failed (${response.status}).`;

            throw new ApiError(
                message,
                response.status,
                data
            );

        }


        setConnection(true);

        return data;

    }


    function getErrorMessage(error) {

        if (error instanceof ApiError) {

            return error.message;

        }

        return error?.message ||
            "An unexpected error occurred.";

    }


    /* =====================================================
       TOASTS
    ===================================================== */

    function toast(message, type = "info") {

        const region = $("#ua-toast-region");

        if (!region) return;

        const item = document.createElement("div");

        item.className = `ua-toast ${type}`;

        item.textContent = message;

        region.appendChild(item);

        window.setTimeout(() => {

            item.remove();

        }, 5000);

    }


    function showGlobalNotice(message) {

        const notice = $("#ua-global-notice");

        if (!notice) return;

        notice.textContent = message;

        notice.hidden = false;

    }


    function clearGlobalNotice() {

        const notice = $("#ua-global-notice");

        if (!notice) return;

        notice.textContent = "";

        notice.hidden = true;

    }


    /* =====================================================
       MODAL MANAGEMENT
    ===================================================== */

    function syncModalLock() {

        const openModal = $$(".ua-modal").some(
            modal => !modal.hidden
        );

        document.body.classList.toggle(
            "ua-modal-open",
            openModal
        );

    }


    function openModal(id) {

        const modal = document.getElementById(id);

        if (!modal) return;

        modal.hidden = false;

        syncModalLock();

    }


    function closeModal(id) {

        const modal = document.getElementById(id);

        if (!modal) return;

        modal.hidden = true;

        syncModalLock();

    }


    function closeAllModals() {

        $$(".ua-modal").forEach(modal => {

            modal.hidden = true;

        });

        syncModalLock();

    }


    /* =====================================================
       NAVIGATION
    ===================================================== */

    async function switchView(view) {

        const allowedViews = [

            "overview",
            "directory",
            "verification",
            "sessions",
            "security",
            "audit"

        ];

        if (!allowedViews.includes(view)) return;


        state.view = view;


        $$(".ua-module-tab").forEach(tab => {

            const active = tab.dataset.view === view;

            tab.classList.toggle("active", active);

            tab.setAttribute(
                "aria-selected",
                String(active)
            );

        });


        $$(".ua-view").forEach(section => {

            section.hidden =
                section.id !== `ua-view-${view}`;

        });


        await loadCurrentView();

    }


    async function loadCurrentView() {

        clearGlobalNotice();

        try {

            switch (state.view) {

                case "overview":
                    await loadOverview();
                    break;

                case "directory":
                    await loadAccounts();
                    break;

                case "verification":
                    await loadVerifications();
                    break;

                case "sessions":
                    await loadSessions();
                    break;

                case "security":
                    await loadSecurity();
                    break;

                case "audit":
                    await loadAudit();
                    break;

            }

        } catch (error) {

            showGlobalNotice(getErrorMessage(error));

        }

    }


    /* =====================================================
       ADMIN PROFILE
    ===================================================== */

    async function loadAdminProfile() {

        try {

            const data = await apiRequest("/me");

            const admin = data?.admin || data?.data || data;

            if (admin.name) {

                setText("ua-admin-name", admin.name);

                setText(
                    "ua-admin-avatar",
                    initials(admin.name)
                );

            }

            if (admin.email) {

                setText("ua-admin-email", admin.email);

            }

        } catch {

            /*
              Do not invent an administrator identity.
              The existing neutral HTML placeholder remains.
            */

        }

    }


    /* =====================================================
       OVERVIEW
    ===================================================== */

    async function loadOverview() {

        const data = await apiRequest("/overview");

        state.overview = data;

        const metrics = data?.metrics || data || {};

        setText(
            "ua-total-accounts",
            safeNumber(metrics.total_accounts)
        );

        setText(
            "ua-total-employers",
            safeNumber(metrics.employer_accounts)
        );

        setText(
            "ua-total-employees",
            safeNumber(metrics.employee_accounts)
        );

        setText(
            "ua-total-admins",
            safeNumber(metrics.super_admin_accounts)
        );

        setText(
            "ua-pending-verification",
            safeNumber(metrics.pending_verification)
        );

        setText(
            "ua-suspended-accounts",
            safeNumber(metrics.suspended_accounts)
        );

        setText(
            "ua-active-sessions",
            safeNumber(metrics.active_sessions)
        );

        setText(
            "ua-security-alerts",
            safeNumber(metrics.security_alerts)
        );


        const portals = data?.portal_distribution || {};

        setText(
            "ua-employer-distribution",
            safeNumber(portals.employers)
        );

        setText(
            "ua-employee-distribution",
            safeNumber(portals.employees)
        );

        setText(
            "ua-admin-distribution",
            safeNumber(portals.super_admins)
        );


        const verification = data?.verification || {};

        setText(
            "ua-verification-pending",
            safeNumber(verification.pending)
        );

        setText(
            "ua-verification-approved",
            safeNumber(verification.verified)
        );

        setText(
            "ua-verification-rejected",
            safeNumber(verification.rejected)
        );

        setText(
            "ua-verification-investigation",
            safeNumber(verification.under_investigation)
        );


        setEventList(
            "ua-overview-security-events",
            data?.security_events || [],
            "No security events returned by the platform."
        );

        setEventList(
            "ua-overview-audit-events",
            data?.audit_events || [],
            "No administrative activity returned by the platform."
        );

    }


    function setEventList(id, records, emptyMessage) {

        const container = document.getElementById(id);

        if (!container) return;

        if (!records.length) {

            container.innerHTML = `
                <div class="ua-empty-state">
                    <span class="ua-empty-icon">◈</span>
                    <strong>${escapeHTML(emptyMessage)}</strong>
                    <p>Records will appear when returned by the connected platform.</p>
                </div>
            `;

            return;

        }


        container.innerHTML = records.map(record => `

            <div class="ua-event-item">

                <div class="ua-event-icon">◈</div>

                <div class="ua-event-details">

                    <strong>
                        ${escapeHTML(record.title || record.event_type || record.action || "Platform event")}
                    </strong>

                    <p>
                        ${escapeHTML(record.description || record.details || record.account_name || "")}
                    </p>

                    <small>
                        ${escapeHTML(formatDateTime(record.created_at || record.timestamp))}
                    </small>

                </div>

            </div>

        `).join("");

    }


    /* =====================================================
       ACCOUNT DIRECTORY
    ===================================================== */

    function getAccountFilters() {

        return {

            search: $("#ua-search")?.value,

            type: $("#ua-account-type-filter")?.value,

            status: $("#ua-account-status-filter")?.value,

            verification: $("#ua-verification-filter")?.value,

            country: $("#ua-country-filter")?.value,

            page: state.accountPage,

            page_size: PAGE_SIZE

        };

    }


    async function loadAccounts() {

        const query = buildQuery(getAccountFilters());

        const data = await apiRequest(
            `/accounts${query}`
        );

        state.accounts = getItems(data);

        state.accountTotal = getTotal(
            data,
            state.accounts
        );

        renderAccounts();

        updateBulkToolbar();

        updateAccountPagination(data);

    }


    function getAccountActionOptions(account) {

        const status = normaliseStatus(account.status);

        const options = [];

        if (status === "active") {

            options.push(
                ["suspend", "Suspend"],
                ["lock", "Lock"],
                ["deactivate", "Deactivate"],
                ["archive", "Archive"],
                ["revoke_sessions", "Revoke Sessions"]
            );

        } else if (status === "suspended") {

            options.push(
                ["reactivate", "Reactivate"],
                ["deactivate", "Deactivate"],
                ["archive", "Archive"],
                ["revoke_sessions", "Revoke Sessions"]
            );

        } else if (status === "locked") {

            options.push(
                ["unlock", "Unlock"],
                ["suspend", "Suspend"],
                ["deactivate", "Deactivate"]
            );

        } else if (
            status === "inactive" ||
            status === "deactivated"
        ) {

            options.push(
                ["restore", "Restore"],
                ["archive", "Archive"]
            );

        } else if (status === "archived") {

            options.push(
                ["restore", "Restore"]
            );

        } else if (status === "pending") {

            options.push(
                ["suspend", "Suspend"],
                ["deactivate", "Deactivate"]
            );

        }

        if (status !== "archived") {

            options.push(
                ["delete_request", "Request Deletion"]
            );

        }

        return options;

    }


    function renderAccounts() {

        const tbody = $("#ua-account-table-body");

        if (!tbody) return;


        if (!state.accounts.length) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="ua-table-empty">
                        No account records returned by the platform.
                    </td>
                </tr>
            `;

            updateSelection([]);

            return;

        }


        tbody.innerHTML = state.accounts.map(account => {

            const id = String(account.id || "");

            const name =
                account.name ||
                account.full_name ||
                account.organization_name ||
                "Unnamed account";

            const email = account.email || "";

            const actions = getAccountActionOptions(account);

            const optionsHTML = actions.map(([value, label]) => `

                <option value="${escapeHTML(value)}">
                    ${escapeHTML(label)}
                </option>

            `).join("");


            return `

                <tr data-account-id="${escapeHTML(id)}">

                    <td>
                        <input
                            type="checkbox"
                            class="ua-account-checkbox"
                            data-id="${escapeHTML(id)}"
                            aria-label="Select account"
                            ${state.selectedIds.has(id) ? "checked" : ""}
                        >
                    </td>


                    <td>

                        <div class="ua-table-account">

                            <div class="ua-table-avatar">
                                ${escapeHTML(initials(name))}
                            </div>

                            <div>
                                <strong>${escapeHTML(name)}</strong>
                                <small>${escapeHTML(email)}</small>
                            </div>

                        </div>

                    </td>


                    <td>
                        ${escapeHTML(account.reference || account.id || "—")}
                    </td>


                    <td>
                        ${escapeHTML(String(account.type || "—").replace(/_/g, " "))}
                    </td>


                    <td>
                        ${escapeHTML(account.country || "—")}
                    </td>


                    <td>
                        ${statusBadge(account.verification_status)}
                    </td>


                    <td>
                        ${statusBadge(account.status)}
                    </td>


                    <td>
                        ${escapeHTML(formatDate(account.created_at))}
                    </td>


                    <td>

                        <div class="ua-row-actions">

                            <button
                                class="ua-row-button"
                                data-account-action="view"
                                data-id="${escapeHTML(id)}"
                            >
                                View
                            </button>


                            <button
                                class="ua-row-button"
                                data-account-action="edit"
                                data-id="${escapeHTML(id)}"
                            >
                                Edit
                            </button>


                            <select
                                class="ua-row-action-select"
                                data-row-action-select
                                data-id="${escapeHTML(id)}"
                                aria-label="Select account action"
                            >

                                <option value="">Actions...</option>

                                ${optionsHTML}

                            </select>


                            <button
                                class="ua-row-button"
                                data-execute-account-action
                                data-id="${escapeHTML(id)}"
                            >
                                Apply
                            </button>

                        </div>

                    </td>

                </tr>

            `;

        }).join("");


        updateSelection(
            $$(".ua-account-checkbox:checked")
                .map(input => input.dataset.id)
        );

    }


    function updateAccountPagination(data = {}) {

        const totalPages = Math.max(
            1,
            Math.ceil(state.accountTotal / PAGE_SIZE)
        );

        const currentPage =
            Number(data.page || state.accountPage);

        state.accountPage = currentPage;

        setText(
            "ua-directory-count",
            `${safeNumber(state.accountTotal)} account records`
        );

        setText(
            "ua-directory-page",
            `${currentPage} / ${totalPages}`
        );

        const previous = $("#ua-directory-prev");

        const next = $("#ua-directory-next");

        if (previous) {
            previous.disabled = currentPage <= 1;
        }

        if (next) {
            next.disabled = currentPage >= totalPages;
        }

    }


    /* =====================================================
       ACCOUNT CREATION AND EDITING
    ===================================================== */

    function openAccountEditor(account = null) {

        const form = $("#ua-account-form");

        if (!form) return;

        form.reset();

        state.currentAccount = account;

        const editing = Boolean(account);


        setText(
            "ua-editor-title",
            editing ? "Edit Platform Account" : "Create Platform Account"
        );


        setText(
            "ua-editor-submit",
            editing ? "Save Changes" : "Create Account"
        );


        $("#ua-account-reference").value =
            account?.id || "";


        $("#ua-account-type").value =
            account?.type || "";


        $("#ua-account-name").value =
            account?.name ||
            account?.full_name ||
            account?.organization_name ||
            "";


        $("#ua-account-email").value =
            account?.email || "";


        $("#ua-account-phone").value =
            account?.phone || "";


        $("#ua-account-country").value =
            account?.country_code ||
            account?.country ||
            "";


        $("#ua-account-status").value =
            account?.status || "pending";


        $("#ua-account-notes").value =
            account?.administrative_notes || "";


        /*
          Account type and lifecycle status are not changed
          through the ordinary edit form.
        */

        $("#ua-account-type").disabled = editing;

        $("#ua-account-status").disabled = editing;


        openModal("ua-editor-modal");

    }


    async function submitAccountForm(event) {

        event.preventDefault();

        const form = $("#ua-account-form");

        const submitButton = $("#ua-editor-submit");

        const editing = Boolean(state.currentAccount);


        const payload = {

            type: editing
                ? state.currentAccount.type
                : $("#ua-account-type").value,

            name: $("#ua-account-name").value.trim(),

            email: $("#ua-account-email").value.trim(),

            phone: $("#ua-account-phone").value.trim(),

            country: $("#ua-account-country").value,

            notes: $("#ua-account-notes").value.trim()

        };


        if (!editing) {

            payload.status =
                $("#ua-account-status").value;

        }


        if (
            !payload.type ||
            !payload.name ||
            !payload.email
        ) {

            toast(
                "Account type, name and email are required.",
                "warning"
            );

            return;

        }


        submitButton.disabled = true;

        submitButton.textContent = "Saving...";


        try {

            if (editing) {

                await apiRequest(
                    `/accounts/${encodeURIComponent(state.currentAccount.id)}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify(payload)
                    }
                );

                toast(
                    "Account changes saved successfully.",
                    "success"
                );

            } else {

                await apiRequest(
                    "/accounts",
                    {
                        method: "POST",
                        body: JSON.stringify(payload)
                    }
                );

                toast(
                    "Account creation request completed.",
                    "success"
                );

            }


            closeModal("ua-editor-modal");

            state.accountPage = 1;

            await Promise.all([
                loadAccounts(),
                loadOverview()
            ]);


        } catch (error) {

            toast(
                getErrorMessage(error),
                "error"
            );

        } finally {

            submitButton.disabled = false;

            submitButton.textContent =
                editing ? "Save Changes" : "Create Account";

        }

    }


    /* =====================================================
       ACCOUNT DETAILS
    ===================================================== */

    async function openAccountDetails(id) {

        if (!id) return;

        try {

            const data = await apiRequest(
                `/accounts/${encodeURIComponent(id)}`
            );

            const account =
                data?.account ||
                data?.data ||
                data;

            state.currentAccount = account;

            renderAccountDetails(account);

            openModal("ua-account-modal");

        } catch (error) {

            toast(
                getErrorMessage(error),
                "error"
            );

        }

    }


    function renderAccountDetails(account) {

        setText(
            "ua-account-modal-title",
            account.name ||
            account.full_name ||
            account.organization_name ||
            "Account Details"
        );

        setText(
            "ua-account-modal-reference",
            account.reference || account.id || "Reference unavailable"
        );


        const fields = [

            ["Account Name", account.name || account.full_name || account.organization_name],

            ["Email", account.email],

            ["Phone", account.phone],

            ["Account Type", account.type],

            ["Account Status", account.status],

            ["Verification Status", account.verification_status],

            ["Country", account.country],

            ["Registration Date", formatDateTime(account.created_at)],

            ["Last Login", formatDateTime(account.last_login_at)],

            ["Last Activity", formatDateTime(account.last_activity_at)],

            ["Account Reference", account.reference || account.id],

            ["Organization Registration", account.registration_number]

        ];


        const container = $("#ua-account-details");

        container.innerHTML = fields.map(([label, value]) => `

            <div class="ua-detail-item">

                <span>${escapeHTML(label)}</span>

                <strong>${escapeHTML(value || "Not available")}</strong>

            </div>

        `).join("");


        renderAccountModalActions(account);

    }


    function renderAccountModalActions(account) {

        const container = $("#ua-account-action-bar");

        const id = String(account.id || "");

        const actions = getAccountActionOptions(account);

        container.innerHTML = `

            <button
                class="ua-button ua-button-secondary"
                data-close-account
            >
                Close
            </button>

            <button
                class="ua-button ua-button-primary"
                data-account-action="edit"
                data-id="${escapeHTML(id)}"
            >
                Edit Account
            </button>

            <select
                class="ua-row-action-select"
                id="ua-detail-action-select"
                aria-label="Select administrative action"
            >

                <option value="">Administrative action...</option>

                ${actions.map(([value, label]) => `

                    <option value="${escapeHTML(value)}">
                        ${escapeHTML(label)}
                    </option>

                `).join("")}

            </select>

            <button
                class="ua-button ua-button-warning"
                data-detail-execute
                data-id="${escapeHTML(id)}"
            >
                Apply
            </button>

        `;

    }


    /* =====================================================
       ADMINISTRATIVE ACTION MODAL
    ===================================================== */

    const ACTION_LABELS = {

        suspend: "Suspend Account",

        reactivate: "Reactivate Account",

        lock: "Lock Account",

        unlock: "Unlock Account",

        deactivate: "Deactivate Account",

        restore: "Restore Account",

        archive: "Archive Account",

        delete_request: "Submit Permanent Deletion Request",

        revoke_sessions: "Revoke Account Sessions",

        approve: "Approve Verification",

        reject: "Reject Verification",

        under_review: "Start Verification Review",

        investigate: "Investigate Security Incident",

        resolve: "Resolve Security Incident",

        close: "Close Security Incident"

    };


    function openActionModal(configuration) {

        state.pendingAction = configuration;

        const action = configuration.action;

        const label =
            ACTION_LABELS[action] ||
            "Confirm Administrative Action";


        setText(
            "ua-action-title",
            label
        );


        setText(
            "ua-action-description",
            configuration.description ||
            "Review the requested operation before proceeding."
        );


        setText(
            "ua-action-account-name",
            configuration.accountName ||
            configuration.id ||
            "Selected platform records"
        );


        $("#ua-action-reference").value =
            configuration.id || "";


        $("#ua-action-type").value = action || "";


        $("#ua-action-account-type").value =
            configuration.accountType || "";


        $("#ua-action-reason").value = "";


        setText(
            "ua-action-warning",
            configuration.warning ||
            "This operation must be authorized and recorded by the TALVORA backend."
        );


        setText(
            "ua-action-confirm",
            label
        );


        openModal("ua-action-modal");

    }


    async function submitAdministrativeAction(event) {

        event.preventDefault();

        const configuration = state.pendingAction;

        if (!configuration) return;


        const reason = $("#ua-action-reason").value.trim();

        if (reason.length < 5) {

            toast(
                "Please provide a meaningful administrative reason.",
                "warning"
            );

            return;

        }


        const submitButton = $("#ua-action-confirm");

        submitButton.disabled = true;

        submitButton.textContent = "Processing...";


        try {

            const action = configuration.action;

            const id = encodeURIComponent(
                configuration.id || ""
            );


            switch (configuration.kind) {


                case "account":

                    if (action === "revoke_sessions") {

                        await apiRequest(
                            `/accounts/${id}/actions`,
                            {
                                method: "POST",
                                body: JSON.stringify({
                                    action,
                                    reason
                                })
                            }
                        );

                    } else if (action === "delete_request") {

                        /*
                          This submits a controlled deletion request.
                          It does not permanently erase the account.
                        */

                        await apiRequest(
                            `/accounts/${id}/deletion-requests`,
                            {
                                method: "POST",
                                body: JSON.stringify({ reason })
                            }
                        );

                    } else {

                        await apiRequest(
                            `/accounts/${id}/actions`,
                            {
                                method: "POST",
                                body: JSON.stringify({
                                    action,
                                    reason
                                })
                            }
                        );

                    }

                    break;


                case "bulk_accounts":

                    await apiRequest(
                        "/accounts/bulk-actions",
                        {
                            method: "POST",
                            body: JSON.stringify({

                                account_ids:
                                    configuration.ids,

                                action,

                                reason

                            })
                        }
                    );

                    break;


                case "session":

                    await apiRequest(
                        `/sessions/${id}/revoke`,
                        {
                            method: "POST",
                            body: JSON.stringify({ reason })
                        }
                    );

                    break;


                case "bulk_sessions":

                    await apiRequest(
                        "/sessions/bulk-revoke",
                        {
                            method: "POST",
                            body: JSON.stringify({

                                account_ids:
                                    configuration.ids,

                                reason

                            })
                        }
                    );

                    break;


                case "verification":

                    await apiRequest(
                        `/verifications/${id}/decision`,
                        {
                            method: "POST",
                            body: JSON.stringify({

                                decision: action,

                                reason

                            })
                        }
                    );

                    break;


                case "incident":

                    await apiRequest(
                        `/security/incidents/${id}/actions`,
                        {
                            method: "POST",
                            body: JSON.stringify({

                                action,

                                reason

                            })
                        }
                    );

                    break;


                default:

                    throw new Error(
                        "Unsupported administrative action."
                    );

            }


            closeModal("ua-action-modal");

            state.pendingAction = null;

            state.selectedIds.clear();


            toast(
                "The backend accepted the administrative operation.",
                "success"
            );


            await refreshAffectedViews(configuration.kind);


        } catch (error) {

            toast(
                getErrorMessage(error),
                "error"
            );

        } finally {

            submitButton.disabled = false;

            submitButton.textContent =
                ACTION_LABELS[configuration.action] ||
                "Confirm Action";

        }

    }


    async function refreshAffectedViews(kind) {

        const tasks = [loadOverview()];

        if (
            kind === "account" ||
            kind === "bulk_accounts"
        ) {
            tasks.push(loadAccounts());
        }

        if (
            kind === "session" ||
            kind === "bulk_sessions"
        ) {
            tasks.push(loadSessions());
        }

        if (kind === "verification") {
            tasks.push(loadVerifications());
        }

        if (kind === "incident") {
            tasks.push(loadSecurity());
        }

        await Promise.all(tasks);

    }


    /* =====================================================
       BULK SELECTION
    ===================================================== */

    function updateSelection(ids) {

        state.selectedIds = new Set(
            ids.map(String).filter(Boolean)
        );

        updateBulkToolbar();

    }


    function updateBulkToolbar() {

        const toolbar = $("#ua-bulk-toolbar");

        if (!toolbar) return;

        toolbar.hidden =
            state.selectedIds.size === 0;


        setText(
            "ua-selection-count",
            `${state.selectedIds.size} selected`
        );


        const allCheckboxes =
            $$(".ua-account-checkbox");

        const selectedCount =
            allCheckboxes.filter(input => input.checked).length;

        const selectAll = $("#ua-select-all");

        if (selectAll) {

            selectAll.checked =
                allCheckboxes.length > 0 &&
                selectedCount === allCheckboxes.length;

            selectAll.indeterminate =
                selectedCount > 0 &&
                selectedCount < allCheckboxes.length;

        }

    }


    function openBulkAction(action, kind = "bulk_accounts") {

        const ids = Array.from(state.selectedIds);

        if (!ids.length) {

            toast(
                "Select at least one account first.",
                "warning"
            );

            return;

        }


        openActionModal({

            kind,

            action,

            ids,

            accountName: `${ids.length} selected account records`,

            description:
                "This operation will be applied to the selected records.",

            warning:
                "The backend must validate every selected record, its current status and the administrator's authorization before processing."

        });

    }


    /* =====================================================
       VERIFICATION MANAGEMENT
    ===================================================== */

    async function loadVerifications() {

        const query = buildQuery({

            type: $("#ua-verification-type-filter")?.value,

            status: $("#ua-verification-status-filter")?.value

        });


        const data = await apiRequest(
            `/verifications${query}`
        );


        state.verifications = getItems(data);

        renderVerifications(state.verifications);


        const summary = data?.summary || {};

        setText(
            "ua-ver-pending-count",
            safeNumber(summary.pending)
        );

        setText(
            "ua-ver-approved-count",
            safeNumber(summary.verified)
        );

        setText(
            "ua-ver-rejected-count",
            safeNumber(summary.rejected)
        );

        setText(
            "ua-ver-review-count",
            safeNumber(summary.under_review)
        );

    }


    function renderVerifications(records) {

        const tbody = $("#ua-verification-body");

        if (!tbody) return;


        if (!records.length) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="ua-table-empty">
                        No verification records returned by the platform.
                    </td>
                </tr>
            `;

            return;

        }


        tbody.innerHTML = records.map(record => {

            const id = String(record.id || "");

            const status = normaliseStatus(record.status);

            const canDecide = [
                "pending",
                "under_review"
            ].includes(status);


            return `

                <tr>

                    <td>
                        <strong>${escapeHTML(record.applicant_name || record.account_name || "—")}</strong>
                        <br>
                        <small>${escapeHTML(record.reference || id)}</small>
                    </td>

                    <td>
                        ${escapeHTML(record.account_type || "—")}
                    </td>

                    <td>
                        ${escapeHTML(record.verification_type || "—")}
                    </td>

                    <td>
                        ${escapeHTML(record.country || "—")}
                    </td>

                    <td>
                        ${escapeHTML(formatDate(record.submitted_at))}
                    </td>

                    <td>
                        ${statusBadge(record.status)}
                    </td>

                    <td>
                        ${escapeHTML(record.reviewer_name || "Unassigned")}
                    </td>

                    <td>

                        <div class="ua-row-actions">

                            ${canDecide ? `

                                <button
                                    class="ua-row-button"
                                    data-verification-action="under_review"
                                    data-id="${escapeHTML(id)}"
                                    data-name="${escapeHTML(record.applicant_name || record.account_name || "Applicant")}"
                                >
                                    Review
                                </button>

                                <button
                                    class="ua-row-button"
                                    data-verification-action="approve"
                                    data-id="${escapeHTML(id)}"
                                    data-name="${escapeHTML(record.applicant_name || record.account_name || "Applicant")}"
                                >
                                    Approve
                                </button>

                                <button
                                    class="ua-row-button"
                                    data-verification-action="reject"
                                    data-id="${escapeHTML(id)}"
                                    data-name="${escapeHTML(record.applicant_name || record.account_name || "Applicant")}"
                                >
                                    Reject
                                </button>

                            ` : "—"}

                        </div>

                    </td>

                </tr>

            `;

        }).join("");

    }


    /* =====================================================
       SESSION MANAGEMENT
    ===================================================== */

    async function loadSessions() {

        const query = buildQuery({

            search: $("#ua-session-search")?.value,

            status: $("#ua-session-status-filter")?.value,

            portal: $("#ua-session-portal-filter")?.value

        });


        const data = await apiRequest(
            `/sessions${query}`
        );


        state.sessions = getItems(data);

        renderSessions(state.sessions);


        const summary = data?.summary || {};

        setText(
            "ua-session-active-count",
            safeNumber(summary.active)
        );

        setText(
            "ua-session-device-count",
            safeNumber(summary.distinct_devices)
        );

        setText(
            "ua-session-flagged-count",
            safeNumber(summary.flagged)
        );

        setText(
            "ua-session-revoked-count",
            safeNumber(summary.revoked)
        );

    }


    function renderSessions(records) {

        const tbody = $("#ua-session-body");

        if (!tbody) return;


        if (!records.length) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="ua-table-empty">
                        No session records returned by the platform.
                    </td>
                </tr>
            `;

            return;

        }


        tbody.innerHTML = records.map(session => {

            const id = String(session.id || "");

            const status = normaliseStatus(session.status);

            const canRevoke = [
                "active",
                "flagged"
            ].includes(status);


            return `

                <tr>

                    <td>
                        <strong>${escapeHTML(session.account_name || "—")}</strong>
                        <br>
                        <small>${escapeHTML(session.account_email || "")}</small>
                    </td>

                    <td>
                        ${escapeHTML(session.portal || "—")}
                    </td>

                    <td>
                        ${escapeHTML(session.device_name || session.device || "—")}
                    </td>

                    <td>
                        ${escapeHTML(session.ip_address || "—")}
                    </td>

                    <td>
                        ${escapeHTML(session.location || "—")}
                    </td>

                    <td>
                        ${escapeHTML(formatDateTime(session.last_activity_at))}
                    </td>

                    <td>
                        ${statusBadge(session.status)}
                    </td>

                    <td>

                        ${canRevoke ? `

                            <button
                                class="ua-row-button"
                                data-session-revoke
                                data-id="${escapeHTML(id)}"
                                data-name="${escapeHTML(session.account_name || "Account session")}"
                            >
                                Revoke
                            </button>

                        ` : "—"}

                    </td>

                </tr>

            `;

        }).join("");

    }


    /* =====================================================
       SECURITY INCIDENT MANAGEMENT
    ===================================================== */

    async function loadSecurity() {

        const query = buildQuery({

            severity: $("#ua-security-severity-filter")?.value,

            status: $("#ua-security-status-filter")?.value

        });


        const [summary, incidents] = await Promise.all([

            apiRequest("/security/overview"),

            apiRequest(`/security/incidents${query}`)

        ]);


        const metrics =
            summary?.metrics ||
            summary ||
            {};


        setText(
            "ua-unresolved-incidents",
            safeNumber(metrics.unresolved_incidents)
        );

        setText(
            "ua-failed-logins",
            safeNumber(metrics.failed_logins)
        );

        setText(
            "ua-suspicious-locations",
            safeNumber(metrics.suspicious_locations)
        );

        setText(
            "ua-unauthorized-attempts",
            safeNumber(metrics.unauthorized_attempts)
        );


        state.incidents = getItems(incidents);

        renderIncidents(state.incidents);

    }


    function renderIncidents(records) {

        const tbody = $("#ua-security-body");

        if (!tbody) return;


        if (!records.length) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="ua-table-empty">
                        No security incidents returned by the platform.
                    </td>
                </tr>
            `;

            return;

        }


        tbody.innerHTML = records.map(incident => {

            const id = String(incident.id || "");

            const status = normaliseStatus(incident.status);

            let action = "";

            if (status === "open") {
                action = "investigate";
            } else if (status === "investigating") {
                action = "resolve";
            } else if (status === "resolved") {
                action = "close";
            }


            return `

                <tr>

                    <td>
                        ${escapeHTML(incident.reference || id)}
                    </td>

                    <td>
                        ${escapeHTML(incident.account_name || "—")}
                    </td>

                    <td>
                        ${escapeHTML(incident.event_type || "—")}
                    </td>

                    <td>
                        ${statusBadge(incident.severity)}
                    </td>

                    <td>
                        ${escapeHTML(incident.ip_address || "—")}
                        <br>
                        <small>${escapeHTML(incident.location || "")}</small>
                    </td>

                    <td>
                        ${escapeHTML(formatDateTime(incident.detected_at))}
                    </td>

                    <td>
                        ${statusBadge(incident.status)}
                    </td>

                    <td>

                        ${action ? `

                            <button
                                class="ua-row-button"
                                data-incident-action="${escapeHTML(action)}"
                                data-id="${escapeHTML(id)}"
                                data-name="${escapeHTML(incident.reference || incident.event_type || "Security incident")}"
                            >
                                ${escapeHTML(ACTION_LABELS[action])}
                            </button>

                        ` : "—"}

                    </td>

                </tr>

            `;

        }).join("");

    }


    /* =====================================================
       AUDIT HISTORY
    ===================================================== */

    async function loadAudit() {

        const query = buildQuery({

            search: $("#ua-audit-search")?.value,

            action: $("#ua-audit-action")?.value,

            administrator: $("#ua-audit-admin")?.value,

            from: $("#ua-audit-from")?.value,

            to: $("#ua-audit-to")?.value,

            page: state.auditPage,

            page_size: PAGE_SIZE

        });


        const data = await apiRequest(
            `/audit${query}`
        );


        state.audit = getItems(data);

        state.auditTotal = getTotal(
            data,
            state.audit
        );


        renderAudit();

        updateAuditPagination(data);

    }


    function renderAudit() {

        const tbody = $("#ua-audit-body");

        if (!tbody) return;


        if (!state.audit.length) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="ua-table-empty">
                        No audit records returned by the platform.
                    </td>
                </tr>
            `;

            return;

        }


        tbody.innerHTML = state.audit.map(record => {

            const details = {

                reference: record.reference,

                before: record.before,

                after: record.after,

                ip_address: record.ip_address,

                user_agent: record.user_agent,

                additional_details: record.details

            };


            return `

                <tr>

                    <td>
                        ${escapeHTML(formatDateTime(record.created_at))}
                    </td>

                    <td>
                        ${escapeHTML(record.administrator_name || "—")}
                        <br>
                        <small>${escapeHTML(record.administrator_email || "")}</small>
                    </td>

                    <td>
                        ${escapeHTML(record.action || "—")}
                    </td>

                    <td>
                        ${escapeHTML(record.account_name || "—")}
                    </td>

                    <td>
                        ${escapeHTML(record.account_type || "—")}
                    </td>

                    <td>
                        ${escapeHTML(record.reason || "—")}
                    </td>

                    <td>
                        ${escapeHTML(record.reference || record.id || "—")}
                    </td>

                    <td>

                        <details class="ua-audit-details">

                            <summary>View details</summary>

                            <pre>${escapeHTML(
                JSON.stringify(details, null, 2)
            )}</pre>

                        </details>

                    </td>

                </tr>

            `;

        }).join("");

    }


    function updateAuditPagination(data = {}) {

        const totalPages = Math.max(
            1,
            Math.ceil(state.auditTotal / PAGE_SIZE)
        );

        const currentPage =
            Number(data.page || state.auditPage);

        state.auditPage = currentPage;


        setText(
            "ua-audit-count",
            `${safeNumber(state.auditTotal)} audit records`
        );

        setText(
            "ua-audit-page",
            `${currentPage} / ${totalPages}`
        );


        const previous = $("#ua-audit-prev");

        const next = $("#ua-audit-next");

        if (previous) {
            previous.disabled = currentPage <= 1;
        }

        if (next) {
            next.disabled = currentPage >= totalPages;
        }

    }


    /* =====================================================
       NOTIFICATIONS
    ===================================================== */

    async function loadNotifications() {

        const data = await apiRequest(
            "/notifications"
        );

        state.notifications = getItems(data);

        renderNotifications();

    }


    function renderNotifications() {

        const container = $("#ua-notification-content");

        if (!container) return;


        const unreadCount = state.notifications.filter(
            item => !item.read_at && item.is_read !== true
        ).length;


        const countElement = $("#ua-notification-count");

        if (countElement) {

            countElement.textContent =
                String(unreadCount);

            countElement.hidden =
                unreadCount === 0;

        }


        if (!state.notifications.length) {

            container.innerHTML = `

                <div class="ua-empty-state">

                    <span class="ua-empty-icon">♧</span>

                    <strong>No notifications returned</strong>

                    <p>
                        Identity and security notifications
                        will appear here when available.
                    </p>

                </div>

            `;

            return;

        }


        container.innerHTML =
            state.notifications.map(item => `

                <article class="ua-notification-item">

                    <strong>
                        ${escapeHTML(item.title || item.type || "Platform notification")}
                    </strong>

                    <p>
                        ${escapeHTML(item.message || item.description || "")}
                    </p>

                    <small>
                        ${escapeHTML(formatDateTime(item.created_at))}
                    </small>

                </article>

            `).join("");

    }


    /* =====================================================
       COUNTRY METADATA
    ===================================================== */

    async function loadCountries() {

        try {

            const data = await apiRequest(
                "/metadata/countries"
            );

            const countries = getItems(data);

            const filters = [
                $("#ua-country-filter"),
                $("#ua-account-country")
            ];


            filters.forEach(select => {

                if (!select) return;

                const existingValue = select.value;

                countries.forEach(country => {

                    const code =
                        country.code ||
                        country.iso_code ||
                        country.name;

                    const label =
                        country.name ||
                        country.label ||
                        code;

                    if (!code || !label) return;

                    const option = document.createElement("option");

                    option.value = code;

                    option.textContent = label;

                    select.appendChild(option);

                });

                select.value = existingValue;

            });


        } catch {

            /*
              Country options remain empty until metadata
              is supplied by the backend.
            */

        }

    }


    /* =====================================================
       EXPORT
    ===================================================== */

    async function downloadExport(path, filename) {

        try {

            const headers = new Headers();

            const csrfToken = document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute("content");

            if (csrfToken) {
                headers.set("X-CSRF-Token", csrfToken);
            }


            const response = await fetch(
                `${API_BASE}${path}`,
                {
                    method: "GET",
                    headers,
                    credentials: "same-origin",
                    cache: "no-store"
                }
            );


            if (!response.ok) {

                const errorData = await response.json()
                    .catch(() => null);

                throw new ApiError(
                    errorData?.message ||
                    `Export failed (${response.status}).`,
                    response.status
                );

            }


            const blob = await response.blob();

            if (!blob.size) {

                throw new Error(
                    "The export returned an empty file."
                );

            }


            const objectURL = URL.createObjectURL(blob);

            const anchor = document.createElement("a");

            anchor.href = objectURL;

            anchor.download = filename;

            document.body.appendChild(anchor);

            anchor.click();

            anchor.remove();

            URL.revokeObjectURL(objectURL);


            setConnection(true);

            toast(
                "Export downloaded successfully.",
                "success"
            );


        } catch (error) {

            toast(
                getErrorMessage(error),
                "error"
            );

        }

    }


    /* =====================================================
       REFRESH
    ===================================================== */

    async function refreshAll() {

        clearGlobalNotice();

        const button = $("#ua-refresh");

        if (button) {

            button.disabled = true;

            button.textContent = "Refreshing...";

        }


        try {

            await Promise.all([

                loadOverview(),

                loadCurrentView(),

                loadNotifications()

            ]);

            toast(
                "Platform information refreshed.",
                "success"
            );

        } catch (error) {

            showGlobalNotice(
                getErrorMessage(error)
            );

        } finally {

            if (button) {

                button.disabled = false;

                button.textContent = "↻ Refresh";

            }

        }

    }


    /* =====================================================
       SIDEBAR
    ===================================================== */

    function openSidebar() {

        $("#ua-sidebar")?.classList.add("open");

        $("#ua-sidebar-overlay")?.classList.add("visible");

    }


    function closeSidebar() {

        $("#ua-sidebar")?.classList.remove("open");

        $("#ua-sidebar-overlay")?.classList.remove("visible");

    }


    /* =====================================================
       NOTIFICATION DRAWER
    ===================================================== */

    async function toggleNotificationDrawer() {

        const drawer = $("#ua-notification-drawer");

        if (!drawer) return;

        state.notificationDrawerOpen =
            !state.notificationDrawerOpen;

        drawer.hidden =
            !state.notificationDrawerOpen;


        if (state.notificationDrawerOpen) {

            try {

                await loadNotifications();

            } catch (error) {

                toast(
                    getErrorMessage(error),
                    "error"
                );

            }

        }

    }


    /* =====================================================
       EVENT LISTENERS: NAVIGATION
    ===================================================== */

    $$(".ua-module-tab").forEach(tab => {

        tab.addEventListener("click", () => {

            switchView(tab.dataset.view);

        });

    });


    $$("[data-open-view]").forEach(button => {

        button.addEventListener("click", () => {

            switchView(button.dataset.openView);

        });

    });


    $("#ua-menu-button")?.addEventListener(
        "click",
        openSidebar
    );


    $("#ua-sidebar-close")?.addEventListener(
        "click",
        closeSidebar
    );


    $("#ua-sidebar-overlay")?.addEventListener(
        "click",
        closeSidebar
    );


    /* =====================================================
       EVENT LISTENERS: REFRESH AND CREATION
    ===================================================== */

    $("#ua-refresh")?.addEventListener(
        "click",
        refreshAll
    );


    $("#ua-create-account")?.addEventListener(
        "click",
        () => openAccountEditor()
    );


    $("#ua-directory-create")?.addEventListener(
        "click",
        () => openAccountEditor()
    );


    $("#ua-account-form")?.addEventListener(
        "submit",
        submitAccountForm
    );


    $("#ua-action-form")?.addEventListener(
        "submit",
        submitAdministrativeAction
    );


    /* =====================================================
       EVENT LISTENERS: ACCOUNT FILTERS
    ===================================================== */

    $("#ua-filter-form")?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            state.accountPage = 1;

            await loadAccounts();

        }
    );


    $("#ua-reset-filters")?.addEventListener(
        "click",
        async () => {

            $("#ua-filter-form").reset();

            state.accountPage = 1;

            state.selectedIds.clear();

            await loadAccounts();

        }
    );


    $("#ua-directory-prev")?.addEventListener(
        "click",
        async () => {

            if (state.accountPage <= 1) return;

            state.accountPage--;

            await loadAccounts();

        }
    );


    $("#ua-directory-next")?.addEventListener(
        "click",
        async () => {

            state.accountPage++;

            await loadAccounts();

        }
    );


    /* =====================================================
       EVENT LISTENERS: ACCOUNT TABLE
    ===================================================== */

    $("#ua-account-table-body")?.addEventListener(
        "click",
        async event => {

            const viewButton = event.target.closest(
                '[data-account-action="view"]'
            );

            if (viewButton) {

                await openAccountDetails(
                    viewButton.dataset.id
                );

                return;

            }


            const editButton = event.target.closest(
                '[data-account-action="edit"]'
            );

            if (editButton) {

                const account = state.accounts.find(
                    item => String(item.id) === editButton.dataset.id
                );

                if (account) {
                    openAccountEditor(account);
                }

                return;

            }


            const actionButton = event.target.closest(
                "[data-execute-account-action]"
            );

            if (actionButton) {

                const id = actionButton.dataset.id;

                const select = $(
                    `[data-row-action-select][data-id="${CSS.escape(id)}"]`
                );

                const action = select?.value;

                const account = state.accounts.find(
                    item => String(item.id) === id
                );

                if (!action || !account) {

                    toast(
                        "Select an administrative action first.",
                        "warning"
                    );

                    return;

                }


                openActionModal({

                    kind: "account",

                    id,

                    action,

                    accountType: account.type,

                    accountName:
                        account.name ||
                        account.full_name ||
                        account.organization_name

                });

            }

        }
    );


    $("#ua-account-modal")?.addEventListener(
        "click",
        event => {

            const close = event.target.closest(
                "[data-close-account]"
            );

            if (close) {

                closeModal("ua-account-modal");

                return;

            }


            const edit = event.target.closest(
                '[data-account-action="edit"]'
            );

            if (edit && state.currentAccount) {

                const account = state.currentAccount;

                closeModal("ua-account-modal");

                openAccountEditor(account);

                return;

            }


            const execute = event.target.closest(
                "[data-detail-execute]"
            );

            if (execute) {

                const select = $("#ua-detail-action-select");

                const action = select?.value;

                if (!action || !state.currentAccount) {

                    toast(
                        "Select an administrative action first.",
                        "warning"
                    );

                    return;

                }


                const account = state.currentAccount;

                closeModal("ua-account-modal");

                openActionModal({

                    kind: "account",

                    id: account.id,

                    action,

                    accountType: account.type,

                    accountName:
                        account.name ||
                        account.full_name ||
                        account.organization_name

                });

            }

        }
    );


    /* =====================================================
       EVENT LISTENERS: SELECTION
    ===================================================== */

    $("#ua-account-table-body")?.addEventListener(
        "change",
        event => {

            const checkbox = event.target.closest(
                ".ua-account-checkbox"
            );

            if (!checkbox) return;

            const id = checkbox.dataset.id;

            if (checkbox.checked) {

                state.selectedIds.add(id);

            } else {

                state.selectedIds.delete(id);

            }

            updateBulkToolbar();

        }
    );


    $("#ua-select-all")?.addEventListener(
        "change",
        event => {

            const checked = event.target.checked;

            $$(".ua-account-checkbox").forEach(input => {

                input.checked = checked;

                if (checked) {

                    state.selectedIds.add(input.dataset.id);

                } else {

                    state.selectedIds.delete(input.dataset.id);

                }

            });

            updateBulkToolbar();

        }
    );


    $("#ua-bulk-clear")?.addEventListener(
        "click",
        () => {

            state.selectedIds.clear();

            $$(".ua-account-checkbox").forEach(input => {

                input.checked = false;

            });

            updateBulkToolbar();

        }
    );


    $("#ua-bulk-suspend")?.addEventListener(
        "click",
        () => openBulkAction("suspend")
    );


    $("#ua-bulk-reactivate")?.addEventListener(
        "click",
        () => openBulkAction("reactivate")
    );


    $("#ua-bulk-revoke-sessions")?.addEventListener(
        "click",
        () => openBulkAction(
            "revoke_sessions",
            "bulk_sessions"
        )
    );


    /* =====================================================
       EVENT LISTENERS: VERIFICATION
    ===================================================== */

    $("#ua-refresh-verification")?.addEventListener(
        "click",
        async () => {

            try {

                await loadVerifications();

                toast(
                    "Verification records refreshed.",
                    "success"
                );

            } catch (error) {

                toast(
                    getErrorMessage(error),
                    "error"
                );

            }

        }
    );


    $("#ua-verification-type-filter")?.addEventListener(
        "change",
        () => loadVerifications().catch(error =>
            toast(getErrorMessage(error), "error")
        )
    );


    $("#ua-verification-status-filter")?.addEventListener(
        "change",
        () => loadVerifications().catch(error =>
            toast(getErrorMessage(error), "error")
        )
    );


    $("#ua-verification-body")?.addEventListener(
        "click",
        event => {

            const button = event.target.closest(
                "[data-verification-action]"
            );

            if (!button) return;


            openActionModal({

                kind: "verification",

                id: button.dataset.id,

                action: button.dataset.verificationAction,

                accountName: button.dataset.name,

                description:
                    "Record the verification decision and its reason.",

                warning:
                    "Verification decisions must be based on the actual submitted evidence and must be recorded by the backend."

            });

        }
    );


    /* =====================================================
       EVENT LISTENERS: SESSIONS
    ===================================================== */

    $("#ua-refresh-sessions")?.addEventListener(
        "click",
        () => loadSessions().catch(error =>
            toast(getErrorMessage(error), "error")
        )
    );


    $("#ua-session-status-filter")?.addEventListener(
        "change",
        () => loadSessions().catch(error =>
            toast(getErrorMessage(error), "error")
        )
    );


    $("#ua-session-portal-filter")?.addEventListener(
        "change",
        () => loadSessions().catch(error =>
            toast(getErrorMessage(error), "error")
        )
    );


    $("#ua-session-search")?.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                event.preventDefault();

                loadSessions().catch(error =>
                    toast(getErrorMessage(error), "error")
                );

            }

        }
    );


    $("#ua-session-body")?.addEventListener(
        "click",
        event => {

            const button = event.target.closest(
                "[data-session-revoke]"
            );

            if (!button) return;


            openActionModal({

                kind: "session",

                id: button.dataset.id,

                action: "revoke_sessions",

                accountName: button.dataset.name,

                description:
                    "Revoke the selected authenticated device session.",

                warning:
                    "The authentication service must invalidate the session and reject any subsequent use of its credentials."

            });

        }
    );


    /* =====================================================
       EVENT LISTENERS: SECURITY
    ===================================================== */

    $("#ua-security-severity-filter")?.addEventListener(
        "change",
        () => loadSecurity().catch(error =>
            toast(getErrorMessage(error), "error")
        )
    );


    $("#ua-security-status-filter")?.addEventListener(
        "change",
        () => loadSecurity().catch(error =>
            toast(getErrorMessage(error), "error")
        )
    );


    $("#ua-security-body")?.addEventListener(
        "click",
        event => {

            const button = event.target.closest(
                "[data-incident-action]"
            );

            if (!button) return;


            const action = button.dataset.incidentAction;


            openActionModal({

                kind: "incident",

                id: button.dataset.id,

                action,

                accountName: button.dataset.name,

                description:
                    "Record the investigation or resolution of this security incident.",

                warning:
                    "All investigation decisions and resolution details must be preserved in the security audit trail."

            });

        }
    );


    /* =====================================================
       EVENT LISTENERS: AUDIT
    ===================================================== */

    $("#ua-audit-filter-form")?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            state.auditPage = 1;

            try {

                await loadAudit();

            } catch (error) {

                toast(
                    getErrorMessage(error),
                    "error"
                );

            }

        }
    );


    $("#ua-audit-prev")?.addEventListener(
        "click",
        async () => {

            if (state.auditPage <= 1) return;

            state.auditPage--;

            await loadAudit();

        }
    );


    $("#ua-audit-next")?.addEventListener(
        "click",
        async () => {

            state.auditPage++;

            await loadAudit();

        }
    );


    /* =====================================================
       EVENT LISTENERS: EXPORT
    ===================================================== */

    $("#ua-export-accounts")?.addEventListener(
        "click",
        () => {

            const query = buildQuery(
                getAccountFilters()
            );

            downloadExport(
                `/accounts/export${query}`,
                "talvora-account-directory.csv"
            );

        }
    );


    $("#ua-export-audit")?.addEventListener(
        "click",
        () => {

            const query = buildQuery({

                search: $("#ua-audit-search")?.value,

                action: $("#ua-audit-action")?.value,

                administrator: $("#ua-audit-admin")?.value,

                from: $("#ua-audit-from")?.value,

                to: $("#ua-audit-to")?.value

            });

            downloadExport(
                `/audit/export${query}`,
                "talvora-administrative-audit.csv"
            );

        }
    );


    /* =====================================================
       EVENT LISTENERS: NOTIFICATIONS
    ===================================================== */

    $("#ua-notification-button")?.addEventListener(
        "click",
        toggleNotificationDrawer
    );


    $("#ua-notification-close")?.addEventListener(
        "click",
        () => {

            state.notificationDrawerOpen = false;

            $("#ua-notification-drawer").hidden = true;

        }
    );


    /* =====================================================
       EVENT LISTENERS: MODAL CLOSING
    ===================================================== */

    document.addEventListener(
        "click",
        event => {

            const editorClose = event.target.closest(
                "[data-close-editor]"
            );

            if (editorClose) {

                closeModal("ua-editor-modal");

                return;

            }


            const actionClose = event.target.closest(
                "[data-close-action]"
            );

            if (actionClose) {

                closeModal("ua-action-modal");

                state.pendingAction = null;

                return;

            }

        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {

                closeAllModals();

                state.pendingAction = null;

                state.notificationDrawerOpen = false;

                const drawer = $("#ua-notification-drawer");

                if (drawer) drawer.hidden = true;

                closeSidebar();

            }

        }
    );


    /* =====================================================
       INITIALIZATION
    ===================================================== */

    async function initialize() {

        setConnection(
            false,
            "Checking connection"
        );


        /*
          Load live information only.

          No hardcoded account records or demo activity
          are generated by this application.
        */

        const initialTasks = [

            loadAdminProfile(),

            loadOverview(),

            loadCountries(),

            loadNotifications()

        ];


        const results = await Promise.allSettled(
            initialTasks
        );


        const successful = results.some(
            result => result.status === "fulfilled"
        );


        if (!successful) {

            setConnection(
                false,
                "Backend unavailable"
            );

            showGlobalNotice(
                "The identity management interface is ready, but its backend is not connected. No account, activity or transaction data has been fabricated."
            );

        }

    }


    initialize();

})();
