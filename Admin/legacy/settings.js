
/* =========================================================
   TALVORA GLOBAL — SYSTEM SETTINGS
   GSES SYSTEM 001
   Frontend Controller & Backend Integration Layer

   IMPORTANT:
   - No demo data.
   - No fabricated administrator accounts.
   - No fake statistics.
   - No simulated successful administrative actions.
   - All privileged actions require server authorization.
========================================================= */

"use strict";

(() => {

    /* =====================================================
       01. CONFIGURATION
    ===================================================== */

    const CONFIG = Object.freeze({

        API_BASE: "/api/v1/admin/settings",

        SESSION_ENDPOINT: "/api/v1/auth/session",

        PAGE_SIZE: 20,

        MAX_ADMINISTRATORS: 10,

        REQUEST_TIMEOUT: 20000,

        PANELS: [
            "overview",
            "admins",
            "invitations",
            "permissions",
            "approvals",
            "portal-access",
            "impersonation",
            "security",
            "audit",
            "branding",
            "global",
            "portals",
            "notifications",
            "email",
            "maintenance",
            "integrations",
            "monitoring"
        ]

    });


    /* =====================================================
       02. API ENDPOINT REGISTRY
    ===================================================== */

    const ENDPOINTS = Object.freeze({

        overview: "/summary",

        admins: "/admins",

        invitations: "/invitations",

        permissions: "/permissions",

        approvals: "/approvals",

        portalAccess: "/portal-access",

        impersonation: "/impersonation",

        security: "/security",

        audit: "/audit",

        branding: "/branding",

        global: "/global",

        portals: "/portals",

        notifications: "/notifications",

        email: "/email-templates",

        maintenance: "/maintenance",

        integrations: "/integrations",

        monitoring: "/monitoring"

    });


    /* =====================================================
       03. APPLICATION STATE
    ===================================================== */

    const state = {

        authenticated: false,

        administrator: null,

        csrfToken: null,

        activePanel: "overview",

        loadedPanels: new Set(),

        loadingPanels: new Set(),

        panelRecords: {},

        filters: {},

        pagination: {

            admins: 1

        },

        activeModal: null,

        pendingAction: null,

        impersonationActive: false,

        refreshInProgress: false

    };


    /* =====================================================
       04. DOM HELPERS
    ===================================================== */

    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

    const $$ = (selector, parent = document) =>
        Array.from(parent.querySelectorAll(selector));


    const getElement = id =>
        document.getElementById(id);


    function setText(id, value) {

        const element = getElement(id);

        if (!element) return;

        element.textContent =
            value === null || value === undefined || value === ""
                ? "—"
                : String(value);

    }


    function showElement(element) {

        if (element) {
            element.hidden = false;
        }

    }


    function hideElement(element) {

        if (element) {
            element.hidden = true;
        }

    }


    function safeNumber(value) {

        if (
            typeof value !== "number" ||
            !Number.isFinite(value)
        ) {
            return "—";
        }

        return new Intl.NumberFormat().format(value);

    }


    function formatDate(value) {

        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return new Intl.DateTimeFormat(undefined, {

            dateStyle: "medium"

        }).format(date);

    }


    function formatDateTime(value) {

        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return new Intl.DateTimeFormat(undefined, {

            dateStyle: "medium",

            timeStyle: "short"

        }).format(date);

    }


    function normalizeStatus(value) {

        return String(value || "unknown")
            .toLowerCase()
            .replace(/\s+/g, "_");

    }


    function displayStatus(value) {

        if (!value) return "Unknown";

        return String(value)
            .replace(/_/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());

    }


    function createElement(tag, className, text) {

        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined && text !== null) {
            element.textContent = String(text);
        }

        return element;

    }


    /* =====================================================
       05. NOTIFICATIONS
    ===================================================== */

    function toast(message, type = "info") {

        const container =
            getElement("settings-toast-container");

        if (!container) return;

        const notification = createElement(
            "div",
            `settings-toast ${type}`,
            message
        );

        notification.setAttribute("role", "status");

        container.appendChild(notification);

        window.setTimeout(() => {

            notification.remove();

        }, 5000);

    }


    function showNotice(message, type = "info") {

        const notice = getElement("settings-notice");

        if (!notice) return;

        notice.className = `settings-notice ${type}`;

        notice.textContent = message;

        showElement(notice);

    }


    function clearNotice() {

        const notice = getElement("settings-notice");

        if (!notice) return;

        notice.textContent = "";

        hideElement(notice);

    }


    /* =====================================================
       06. API REQUEST HANDLER
    ===================================================== */

    async function apiRequest(path, options = {}) {

        const controller = new AbortController();

        const timeout = window.setTimeout(() => {

            controller.abort();

        }, CONFIG.REQUEST_TIMEOUT);


        const headers = {

            "Accept": "application/json",

            ...options.headers

        };


        const requestOptions = {

            method: options.method || "GET",

            credentials: "same-origin",

            headers,

            signal: controller.signal

        };


        if (options.body !== undefined) {

            headers["Content-Type"] = "application/json";

            requestOptions.body =
                JSON.stringify(options.body);

        }


        if (state.csrfToken && requestOptions.method !== "GET") {

            headers["X-CSRF-Token"] = state.csrfToken;

        }


        try {

            const response = await fetch(path, requestOptions);

            const contentType =
                response.headers.get("content-type") || "";

            let result = null;

            if (contentType.includes("application/json")) {

                result = await response.json();

            } else if (response.status !== 204) {

                result = await response.text();

            }


            if (response.status === 401) {

                state.authenticated = false;

                state.administrator = null;

                showNotice(
                    "Your administrator session is unavailable or has expired. Please authenticate again.",
                    "error"
                );

                throw new Error("Authentication required.");

            }


            if (response.status === 403) {

                throw new Error(
                    "The server denied this operation. Your authorization must be verified."
                );

            }


            if (!response.ok) {

                const message =
                    result?.message ||
                    result?.error ||
                    `Server request failed (${response.status}).`;

                throw new Error(message);

            }


            return result;

        } catch (error) {

            if (error.name === "AbortError") {

                throw new Error("The server request timed out.");

            }

            if (error instanceof TypeError) {

                throw new Error(
                    "The backend could not be reached. No changes have been confirmed."
                );

            }

            throw error;

        } finally {

            window.clearTimeout(timeout);

        }

    }


    function endpoint(panel) {

        const route = ENDPOINTS[panel];

        if (!route) {

            throw new Error(
                `No API endpoint configured for ${panel}.`
            );

        }

        return CONFIG.API_BASE + route;

    }


    /* =====================================================
       07. SESSION AUTHENTICATION
    ===================================================== */

    async function verifySession() {

        try {

            const response = await apiRequest(
                CONFIG.SESSION_ENDPOINT
            );


            if (
                !response ||
                response.authenticated !== true ||
                response.user?.role !== "super_admin"
            ) {

                state.authenticated = false;

                showNotice(
                    "A verified Super Admin session is required to access administrative operations.",
                    "error"
                );

                return false;

            }


            state.administrator = response.user;

            state.csrfToken = response.csrfToken || null;

            state.authenticated = true;


            setText(
                "settings-admin-name",
                response.user.displayName ||
                response.user.name ||
                "Super Administrator"
            );


            setText(
                "settings-admin-role",
                "Super Admin"
            );


            const initials = (
                response.user.displayName ||
                response.user.name ||
                "SA"
            )
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(part => part[0])
                .join("")
                .toUpperCase();


            setText("settings-admin-avatar", initials);


            setText(
                "settings-platform-status",
                "Session verified"
            );


            const statusDot =
                $(".settings-platform-status .status-dot");

            if (statusDot) {
                statusDot.classList.add("online");
            }


            setText(
                "settings-admin-role",
                "Super Admin · Verified"
            );


            return true;

        } catch (error) {

            state.authenticated = false;

            showNotice(
                error.message,
                "error"
            );

            return false;

        }

    }


    function requireAuthentication() {

        if (!state.authenticated) {

            toast(
                "A verified Super Admin session is required.",
                "error"
            );

            return false;

        }

        return true;

    }


    /* =====================================================
       08. NAVIGATION
    ===================================================== */

    function navigate(panel, updateHash = true) {

        if (!CONFIG.PANELS.includes(panel)) {

            panel = "overview";

        }


        state.activePanel = panel;


        $$(".settings-nav-item").forEach(button => {

            const active =
                button.dataset.settingsPanel === panel;

            button.classList.toggle("active", active);

            if (active) {

                button.setAttribute("aria-current", "page");

            } else {

                button.removeAttribute("aria-current");

            }

        });


        $$(".settings-panel").forEach(section => {

            const active =
                section.id === `settings-panel-${panel}`;

            section.hidden = !active;

            section.classList.toggle("active", active);

        });


        const activeButton = $(
            `[data-settings-panel="${panel}"]`
        );

        const title = activeButton
            ? activeButton.querySelector("span:last-child")?.textContent
            : "System Overview";


        setText(
            "settings-page-title",
            title || "System Overview"
        );


        if (updateHash) {

            history.replaceState(
                null,
                "",
                `#${panel}`
            );

        }


        closeSidebar();

        loadPanel(panel);

        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    }


    function initializeNavigation() {

        $$(".settings-nav-item").forEach(button => {

            button.addEventListener("click", () => {

                navigate(button.dataset.settingsPanel);

            });

        });


        $$("[data-open-panel]").forEach(button => {

            button.addEventListener("click", () => {

                navigate(button.dataset.openPanel);

            });

        });


        const initialPanel =
            location.hash.replace("#", "");


        navigate(
            CONFIG.PANELS.includes(initialPanel)
                ? initialPanel
                : "overview",
            false
        );

    }


    /* =====================================================
       09. MOBILE SIDEBAR
    ===================================================== */

    function openSidebar() {

        const sidebar = getElement("settings-sidebar");

        const overlay =
            getElement("settings-sidebar-overlay");

        const toggle =
            getElement("settings-menu-toggle");


        sidebar?.classList.add("open");

        showElement(overlay);

        toggle?.setAttribute("aria-expanded", "true");

    }


    function closeSidebar() {

        const sidebar = getElement("settings-sidebar");

        const overlay =
            getElement("settings-sidebar-overlay");

        const toggle =
            getElement("settings-menu-toggle");


        sidebar?.classList.remove("open");

        hideElement(overlay);

        toggle?.setAttribute("aria-expanded", "false");

    }


    function initializeSidebar() {

        getElement("settings-menu-toggle")
            ?.addEventListener("click", openSidebar);


        getElement("settings-sidebar-close")
            ?.addEventListener("click", closeSidebar);


        getElement("settings-sidebar-overlay")
            ?.addEventListener("click", closeSidebar);

    }


    /* =====================================================
       10. PANEL DATA LOADING
    ===================================================== */

    async function loadPanel(panel, force = false) {

        if (!requireAuthentication()) return;


        if (
            state.loadedPanels.has(panel) &&
            !force
        ) {

            return;

        }


        if (state.loadingPanels.has(panel)) return;


        state.loadingPanels.add(panel);


        try {

            const data = await apiRequest(
                endpoint(panel)
            );


            if (!data || typeof data !== "object") {

                throw new Error(
                    "The server returned an invalid response."
                );

            }


            state.panelRecords[panel] = data;

            state.loadedPanels.add(panel);


            renderPanel(panel, data);


        } catch (error) {

            showNotice(
                `${displayStatus(panel)}: ${error.message}`,
                "warning"
            );

        } finally {

            state.loadingPanels.delete(panel);

        }

    }


    function renderPanel(panel, data) {

        const renderers = {

            overview: renderOverview,

            admins: renderAdmins,

            invitations: renderInvitations,

            permissions: renderPermissions,

            approvals: renderApprovals,

            "portal-access": renderPortalAccess,

            impersonation: renderImpersonation,

            security: renderSecurity,

            audit: renderAudit,

            branding: renderBranding,

            global: renderGlobal,

            portals: renderPortals,

            notifications: renderNotifications,

            email: renderEmail,

            maintenance: renderMaintenance,

            integrations: renderIntegrations,

            monitoring: renderMonitoring

        };


        const renderer = renderers[panel];

        if (renderer) {

            renderer(data);

        }

    }


    /* =====================================================
       11. SAFE TABLE RENDERING
    ===================================================== */

    function clearTable(id) {

        const body = getElement(id);

        if (!body) return null;

        body.replaceChildren();

        return body;

    }


    function emptyTable(id, colspan, message) {

        const body = clearTable(id);

        if (!body) return;

        const row = createElement("tr");

        const cell = createElement(
            "td",
            "settings-empty-cell",
            message
        );

        cell.colSpan = colspan;

        row.appendChild(cell);

        body.appendChild(row);

    }


    function addCell(row, value, options = {}) {

        const cell = createElement("td");

        if (options.strong) {

            const strong = createElement(
                "strong",
                "",
                value ?? "—"
            );

            cell.appendChild(strong);

        } else {

            cell.textContent =
                value === null || value === undefined || value === ""
                    ? "—"
                    : String(value);

        }

        row.appendChild(cell);

        return cell;

    }


    function addStatusCell(row, status) {

        const cell = createElement("td");

        const badge = createElement(
            "span",
            `settings-status ${normalizeStatus(status)}`,
            displayStatus(status)
        );

        cell.appendChild(badge);

        row.appendChild(cell);

    }


    function addActionCell(row, reference, panel) {

        const cell = createElement("td");

        const button = createElement(
            "button",
            "settings-table-action",
            "View"
        );

        button.type = "button";

        button.addEventListener("click", () => {

            showRecordDetails(panel, reference);

        });

        cell.appendChild(button);

        row.appendChild(cell);

    }


    function getItems(data) {

        if (Array.isArray(data)) return data;

        if (Array.isArray(data?.items)) {
            return data.items;
        }

        if (Array.isArray(data?.records)) {
            return data.records;
        }

        return [];

    }


    /* =====================================================
       12. OVERVIEW
    ===================================================== */

    function renderOverview(data) {

        const metrics = data.metrics || {};

        const capacity =
            metrics.adminCapacity ??
            CONFIG.MAX_ADMINISTRATORS;


        setText(
            "overview-admin-capacity",
            safeNumber(capacity)
        );


        setText(
            "overview-active-admins",
            metrics.activeAdministrators === undefined
                ? "—"
                : safeNumber(metrics.activeAdministrators)
        );


        setText(
            "overview-pending-approvals",
            metrics.pendingApprovals === undefined
                ? "—"
                : safeNumber(metrics.pendingApprovals)
        );


        setText(
            "overview-security-events",
            metrics.securityEvents === undefined
                ? "—"
                : safeNumber(metrics.securityEvents)
        );


        const pendingCount =
            getElement("settings-pending-approval-count");


        if (pendingCount) {

            const count = metrics.pendingApprovals;

            if (
                typeof count === "number" &&
                count > 0
            ) {

                pendingCount.textContent =
                    String(count);

                showElement(pendingCount);

            } else {

                hideElement(pendingCount);

            }

        }


        const portals = data.portals || {};

        setText(
            "portal-status-admin",
            portals.superAdmin?.status || "Status unavailable"
        );

        setText(
            "portal-status-employer",
            portals.employer?.status || "Status unavailable"
        );

        setText(
            "portal-status-employee",
            portals.employee?.status || "Status unavailable"
        );


        const services = data.services || {};

        setText(
            "service-authentication",
            services.authentication?.status || "Unknown"
        );

        setText(
            "service-authorization",
            services.authorization?.status || "Unknown"
        );

        setText(
            "service-database",
            services.database?.status || "Unknown"
        );

        setText(
            "service-notifications",
            services.notifications?.status || "Unknown"
        );

        setText(
            "service-integrations",
            services.integrations?.status || "Unknown"
        );

    }


    /* =====================================================
       13. ADMINISTRATOR MANAGEMENT
    ===================================================== */

    function renderAdmins(data) {

        const body = clearTable("admin-table-body");

        if (!body) return;


        const items = getItems(data);


        if (!items.length) {

            emptyTable(
                "admin-table-body",
                7,
                "No administrator records have been returned by the server."
            );

        } else {

            items.forEach(admin => {

                const row = createElement("tr");

                addCell(
                    row,
                    admin.displayName || admin.name,
                    { strong: true }
                );

                addCell(
                    row,
                    admin.reference || admin.id
                );

                addStatusCell(row, admin.status);

                addStatusCell(
                    row,
                    admin.mfaEnabled === true
                        ? "verified"
                        : admin.mfaEnabled === false
                            ? "failed"
                            : "unknown"
                );

                addCell(
                    row,
                    formatDateTime(admin.lastLoginAt)
                );

                addCell(
                    row,
                    formatDate(admin.createdAt)
                );

                addActionCell(
                    row,
                    admin.reference || admin.id,
                    "admins"
                );

                body.appendChild(row);

            });

        }


        const total =
            data.pagination?.total ??
            data.total ??
            items.length;


        setText(
            "admin-record-count",
            `${safeNumber(total)} administrator records`
        );


        const currentPage =
            data.pagination?.page || 1;

        const totalPages =
            data.pagination?.totalPages || 1;


        state.pagination.admins = currentPage;


        setText(
            "admin-page-info",
            `${currentPage} / ${totalPages}`
        );


        const previous = getElement("admin-prev");

        const next = getElement("admin-next");


        if (previous) {

            previous.disabled =
                currentPage <= 1;

        }


        if (next) {

            next.disabled =
                currentPage >= totalPages;

        }


        if (items.length > CONFIG.MAX_ADMINISTRATORS) {

            showNotice(
                "The administrator service returned more records than the authorized capacity. Review the account governance configuration.",
                "warning"
            );

        }

    }


    /* =====================================================
       14. ADMINISTRATOR INVITATIONS
    ===================================================== */

    function renderInvitations(data) {

        const items = getItems(data);

        const body = clearTable(
            "invitation-table-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "invitation-table-body",
                7,
                "No administrator invitations returned."
            );

            return;

        }


        items.forEach(item => {

            const row = createElement("tr");

            addCell(row, item.fullName, { strong: true });

            addCell(row, item.email);

            addCell(row, item.replacementReason);

            addCell(row, item.requestedBy?.displayName);

            addStatusCell(row, item.status);

            addCell(row, formatDateTime(item.createdAt));

            addActionCell(
                row,
                item.reference || item.id,
                "invitations"
            );

            body.appendChild(row);

        });

    }


    /* =====================================================
       15. PERMISSIONS
    ===================================================== */

    function renderPermissions(data) {

        const permissions = data.permissions || [];

        const cards = $$(".settings-permission-card");


        cards.forEach(card => {

            const title =
                card.querySelector("h4")?.textContent?.trim();

            const record = permissions.find(item =>
                item.name === title ||
                item.label === title
            );


            const status = card.querySelector("span");

            if (status) {

                status.textContent = record
                    ? displayStatus(record.status)
                    : "Awaiting authorization service";

            }

        });

    }


    /* =====================================================
       16. APPROVAL CENTRE
    ===================================================== */

    function renderApprovals(data) {

        const items = getItems(data);

        const body = clearTable("approval-table-body");

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "approval-table-body",
                7,
                "No approval requests returned by the server."
            );

            return;

        }


        items.forEach(item => {

            const row = createElement("tr");

            addCell(
                row,
                item.reference || item.id,
                { strong: true }
            );

            addCell(row, item.operation);

            addCell(
                row,
                item.initiatedBy?.displayName
            );

            addCell(
                row,
                formatDateTime(item.createdAt)
            );

            addStatusCell(row, item.status);

            addCell(
                row,
                item.approvedBy?.displayName ||
                "Awaiting independent approval"
            );


            const cell = createElement("td");

            const viewButton = createElement(
                "button",
                "settings-table-action",
                "Review"
            );

            viewButton.type = "button";

            viewButton.addEventListener("click", () => {

                showRecordDetails(
                    "approvals",
                    item.reference || item.id
                );

            });


            cell.appendChild(viewButton);


            const currentAdminId =
                state.administrator?.id;


            const initiatedById =
                item.initiatedBy?.id;


            const isDifferentAdministrator =
                currentAdminId &&
                initiatedById &&
                currentAdminId !== initiatedById;


            if (
                item.status === "pending" &&
                isDifferentAdministrator
            ) {

                const approveButton = createElement(
                    "button",
                    "settings-table-action",
                    "Approve"
                );

                approveButton.type = "button";

                approveButton.addEventListener("click", () => {

                    confirmAction({

                        title: "Approve High-Risk Operation",

                        description:
                            "You are independently authorizing this operation. Review the request and its justification before proceeding.",

                        action: "approve",

                        reference: item.reference || item.id,

                        panel: "approvals"

                    });

                });


                const rejectButton = createElement(
                    "button",
                    "settings-table-action danger",
                    "Reject"
                );

                rejectButton.type = "button";

                rejectButton.addEventListener("click", () => {

                    confirmAction({

                        title: "Reject High-Risk Operation",

                        description:
                            "Confirm that this request should be rejected. Your reason will be recorded.",

                        action: "reject",

                        reference: item.reference || item.id,

                        panel: "approvals"

                    });

                });


                cell.append(
                    approveButton,
                    rejectButton
                );

            }


            row.appendChild(cell);

            body.appendChild(row);

        });

    }


    /* =====================================================
       17. PORTAL ACCESS
    ===================================================== */

    function renderPortalAccess(data) {

        const items = getItems(data);

        const body = clearTable(
            "portal-access-table-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "portal-access-table-body",
                7,
                "No account access records returned."
            );

            return;

        }


        items.forEach(item => {

            const row = createElement("tr");

            addCell(row, item.reference || item.id);

            addCell(
                row,
                item.displayName || item.name,
                { strong: true }
            );

            addCell(row, item.accountType);

            addCell(row, item.portal);

            addStatusCell(row, item.status);

            addCell(
                row,
                formatDateTime(item.lastActivityAt)
            );

            addActionCell(
                row,
                item.reference || item.id,
                "portal-access"
            );

            body.appendChild(row);

        });

    }


    /* =====================================================
       18. IMPERSONATION
    ===================================================== */

    function renderImpersonation(data) {

        const items = getItems(data);

        const body = clearTable(
            "impersonation-table-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "impersonation-table-body",
                7,
                "No impersonation sessions returned."
            );

            return;

        }


        items.forEach(item => {

            const row = createElement("tr");

            addCell(row, item.reference || item.id);

            addCell(
                row,
                item.administrator?.displayName
            );

            addCell(
                row,
                item.targetAccount?.reference
            );

            addCell(row, item.portal);

            addCell(
                row,
                formatDateTime(item.startedAt)
            );

            addCell(
                row,
                formatDateTime(item.endedAt)
            );

            addStatusCell(row, item.status);

            body.appendChild(row);

        });

    }


    /* =====================================================
       19. SECURITY SETTINGS
    ===================================================== */

    function renderSecurity(data) {

        const form = getElement(
            "security-settings-form"
        );

        if (!form) return;


        const policies = data.policies || {};


        const map = {

            adminMfa: "adminMfaRequired",

            individualAdminAccounts: "individualAdminAccounts",

            adminLoginAlerts: "adminLoginAlerts",

            csrfProtection: "csrfProtection",

            auditIntegrity: "auditIntegrity",

            secureCookies: "secureCookies"

        };


        Object.entries(map).forEach(([inputName, key]) => {

            const input = form.elements[inputName];

            if (
                input &&
                typeof policies[key] === "boolean"
            ) {

                input.checked = policies[key];

            }

        });


        const settings = data.sessionSettings || {};


        const timeout = form.elements.adminSessionTimeout;

        if (timeout && settings.adminSessionTimeout) {

            timeout.value =
                String(settings.adminSessionTimeout);

        }


        const sessions =
            form.elements.maxConcurrentSessions;

        if (sessions && settings.maxConcurrentSessions) {

            sessions.value =
                String(settings.maxConcurrentSessions);

        }


        const failed =
            form.elements.failedLoginThreshold;

        if (
            failed &&
            settings.failedLoginThreshold !== undefined
        ) {

            failed.value =
                String(settings.failedLoginThreshold);

        }

    }


    /* =====================================================
       20. AUDIT LOGS
    ===================================================== */

    function renderAudit(data) {

        const items = getItems(data);

        const body = clearTable(
            "settings-audit-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "settings-audit-body",
                7,
                "No audit records returned by the protected audit service."
            );

            return;

        }


        items.forEach(item => {

            const row = createElement("tr");

            addCell(
                row,
                item.eventReference || item.reference || item.id
            );

            addCell(
                row,
                item.actor?.displayName ||
                item.administrator?.displayName
            );

            addCell(row, item.event || item.action);

            addCell(row, item.category);

            addCell(
                row,
                item.target?.reference ||
                item.targetReference
            );

            addCell(
                row,
                formatDateTime(item.timestamp)
            );

            addStatusCell(row, item.outcome || item.status);

            body.appendChild(row);

        });

    }


    /* =====================================================
       21. CORPORATE BRANDING
    ===================================================== */

    function renderBranding(data) {

        const brand = data.brand || data;

        const formFields = {

            corporateName: brand.corporateName,

            brandName: brand.brandName,

            platformName: brand.platformName,

            tagline: brand.tagline

        };


        Object.entries(formFields).forEach(([name, value]) => {

            const input = $(
                `[name="${name}"]`
            );

            if (input && value !== undefined) {

                input.value = value;

            }

        });

    }


    /* =====================================================
       22. GLOBAL CONFIGURATION
    ===================================================== */

    function renderGlobal(data) {

        const config = data.configuration || data;


        setText(
            "global-registration-status",
            config.registrationStatus
        );


        setText(
            "global-employee-verification",
            config.employeeVerification
        );


        setText(
            "global-employer-verification",
            config.employerVerification
        );


        setText(
            "global-maintenance-policy",
            config.maintenancePolicy
        );


        const form = getElement("global-settings-form");

        if (!form) return;


        const fields = {

            platformDisplayName: config.platformDisplayName,

            defaultLanguage: config.defaultLanguage,

            timezone: config.timezone,

            dateFormat: config.dateFormat

        };


        Object.entries(fields).forEach(([name, value]) => {

            const input = form.elements[name];

            if (input && value !== undefined) {

                input.value = value;

            }

        });

    }


    /* =====================================================
       23. PORTAL CONFIGURATION
    ===================================================== */

    function renderPortals(data) {

        const portals = data.portals || {};

        setText(
            "settings-platform-status",
            data.platformStatus || "Status unavailable"
        );


        const portalButtons =
            $$("[data-portal-config]");


        portalButtons.forEach(button => {

            const key = button.dataset.portalConfig;

            const portal = portals[key];

            if (!portal) {

                button.title =
                    "Portal configuration unavailable";

                return;

            }

            button.title =
                `Portal status: ${displayStatus(portal.status)}`;

        });

    }


    /* =====================================================
       24. NOTIFICATIONS
    ===================================================== */

    function renderNotifications(data) {

        const channels = data.channels || {};


        setText(
            "notification-email-status",
            channels.email?.status
        );


        setText(
            "notification-inapp-status",
            channels.inApp?.status
        );


        setText(
            "notification-sms-status",
            channels.sms?.status
        );


        const items = getItems(data);

        const body = clearTable(
            "notification-table-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "notification-table-body",
                6,
                "No notification policy records returned."
            );

            return;

        }


        items.forEach(item => {

            const row = createElement("tr");

            addCell(row, item.event);

            addCell(row, item.recipientGroup);

            addCell(row, item.channel);

            addStatusCell(row, item.status);

            addCell(row, formatDateTime(item.updatedAt));

            addActionCell(
                row,
                item.reference || item.id,
                "notifications"
            );

            body.appendChild(row);

        });

    }


    /* =====================================================
       25. EMAIL TEMPLATES
    ===================================================== */

    function renderEmail(data) {

        const email = data.configuration || {};

        setText(
            "email-provider-status",
            email.providerStatus
        );

        setText(
            "email-sender-domain",
            email.senderDomain
        );

        setText(
            "email-domain-verification",
            email.domainVerification
        );


        const items = getItems(data);

        const body = clearTable(
            "email-template-table-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "email-template-table-body",
                6,
                "No email templates returned."
            );

            return;

        }


        items.forEach(item => {

            const row = createElement("tr");

            addCell(row, item.name, { strong: true });

            addCell(row, item.category);

            addCell(row, item.recipient);

            addStatusCell(row, item.status);

            addCell(row, formatDateTime(item.updatedAt));

            addActionCell(
                row,
                item.reference || item.id,
                "email"
            );

            body.appendChild(row);

        });

    }


    /* =====================================================
       26. MAINTENANCE
    ===================================================== */

    function renderMaintenance(data) {

        const config = data.configuration || {};


        setText(
            "maintenance-mode-status",
            config.mode
        );


        setText(
            "maintenance-window",
            config.scheduledWindow
        );


        setText(
            "maintenance-availability",
            config.availability
        );


        const items = getItems(data);

        const body = clearTable(
            "maintenance-table-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "maintenance-table-body",
                6,
                "No maintenance records returned."
            );

            return;

        }


        items.forEach(item => {

            const row = createElement("tr");

            addCell(row, item.reference || item.id);

            addCell(row, item.scope);

            addCell(
                row,
                formatDateTime(item.startAt)
            );

            addCell(
                row,
                formatDateTime(item.endAt)
            );

            addStatusCell(row, item.status);

            addCell(
                row,
                item.requestedBy?.displayName
            );

            body.appendChild(row);

        });

    }


    /* =====================================================
       27. INTEGRATIONS
    ===================================================== */

    function renderIntegrations(data) {

        const items = getItems(data);

        const body = clearTable(
            "integration-table-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "integration-table-body",
                6,
                "No integration records returned."
            );

            return;

        }


        items.forEach(item => {

            const row = createElement("tr");

            addCell(row, item.name, { strong: true });

            addCell(row, item.category);

            addCell(row, item.environment);

            addStatusCell(row, item.status);

            addCell(
                row,
                formatDateTime(item.lastVerifiedAt)
            );

            addActionCell(
                row,
                item.reference || item.id,
                "integrations"
            );

            body.appendChild(row);

        });

    }


    /* =====================================================
       28. SYSTEM MONITORING
    ===================================================== */

    function renderMonitoring(data) {

        const metrics = data.metrics || {};


        setText(
            "monitor-availability",
            metrics.availability
        );


        setText(
            "monitor-api-latency",
            metrics.apiLatencyMs === undefined
                ? "—"
                : `${safeNumber(metrics.apiLatencyMs)} ms`
        );


        setText(
            "monitor-failed-requests",
            metrics.failedRequests === undefined
                ? "—"
                : safeNumber(metrics.failedRequests)
        );


        setText(
            "monitor-active-alerts",
            metrics.activeAlerts === undefined
                ? "—"
                : safeNumber(metrics.activeAlerts)
        );


        renderMonitoringServices(data.services || []);

        renderMonitoringAlerts(data.alerts || []);

    }


    function renderMonitoringServices(services) {

        const body = clearTable(
            "monitor-service-body"
        );

        if (!body) return;


        if (!services.length) {

            emptyTable(
                "monitor-service-body",
                5,
                "No monitoring service records returned."
            );

            return;

        }


        services.forEach(service => {

            const row = createElement("tr");

            addCell(row, service.name);

            addCell(row, service.environment);

            addStatusCell(row, service.status);

            addCell(
                row,
                service.responseTimeMs === undefined
                    ? "—"
                    : `${safeNumber(service.responseTimeMs)} ms`
            );

            addCell(
                row,
                formatDateTime(service.checkedAt)
            );

            body.appendChild(row);

        });

    }


    function renderMonitoringAlerts(alerts) {

        const body = clearTable(
            "monitor-alert-body"
        );

        if (!body) return;


        if (!alerts.length) {

            emptyTable(
                "monitor-alert-body",
                6,
                "No monitoring alerts returned."
            );

            return;

        }


        alerts.forEach(alert => {

            const row = createElement("tr");

            addCell(row, alert.reference || alert.id);

            addStatusCell(row, alert.severity);

            addCell(row, alert.service);

            addCell(row, alert.description);

            addCell(
                row,
                formatDateTime(alert.detectedAt)
            );

            addStatusCell(row, alert.status);

            body.appendChild(row);

        });

    }


    /* =====================================================
       29. RECORD DETAIL MODAL
    ===================================================== */

    async function showRecordDetails(panel, reference) {

        if (!requireAuthentication()) return;

        if (!reference) return;


        const modal = getElement(
            "settings-detail-modal"
        );

        const content = getElement(
            "settings-detail-content"
        );


        content.replaceChildren();

        setText(
            "settings-detail-title",
            "Loading Record"
        );


        showElement(modal);

        state.activeModal = "detail";


        try {

            const url =
                `${endpoint(panel)}/${encodeURIComponent(reference)}`;

            const response = await apiRequest(url);

            const record =
                response.record || response;


            setText(
                "settings-detail-title",
                record.displayName ||
                record.name ||
                record.reference ||
                record.id ||
                "Record Details"
            );


            const fields = Object.entries(record);


            fields.forEach(([key, value]) => {

                if (
                    value === null ||
                    value === undefined ||
                    typeof value === "object"
                ) {

                    return;

                }


                const row = createElement(
                    "div",
                    "settings-information-row"
                );


                const label = createElement(
                    "strong",
                    "",
                    displayStatus(key)
                );


                const text = createElement(
                    "span",
                    "",
                    String(value)
                );


                row.append(label, text);

                content.appendChild(row);

            });


            if (!content.children.length) {

                content.textContent =
                    "No displayable record details were returned.";

            }

        } catch (error) {

            content.textContent = error.message;

        }

    }


    function closeDetailModal() {

        hideElement(
            getElement("settings-detail-modal")
        );

        state.activeModal = null;

    }


    /* =====================================================
       30. ACTION CONFIRMATION
    ===================================================== */

    function confirmAction(action) {

        if (!requireAuthentication()) return;


        state.pendingAction = action;


        setText(
            "settings-confirm-title",
            action.title || "Confirm Administrative Action"
        );


        setText(
            "settings-confirm-description",
            action.description || "Review this operation."
        );


        const reason =
            getElement("settings-confirm-reason");

        if (reason) {

            reason.value = "";

        }


        showElement(
            getElement("settings-confirm-modal")
        );

        state.activeModal = "confirm";

    }


    function closeConfirmModal() {

        hideElement(
            getElement("settings-confirm-modal")
        );

        state.pendingAction = null;

        state.activeModal = null;

    }


    async function executeConfirmedAction() {

        if (!requireAuthentication()) return;


        const action = state.pendingAction;

        if (!action) return;


        const reason =
            getElement("settings-confirm-reason")?.value.trim();


        if (!reason || reason.length < 10) {

            toast(
                "Provide a meaningful administrative justification of at least 10 characters.",
                "warning"
            );

            return;

        }


        if (
            action.action === "approve" &&
            state.administrator?.id === action.initiatedById
        ) {

            toast(
                "An administrator cannot approve their own request.",
                "error"
            );

            return;

        }


        const button =
            getElement("settings-confirm-submit");

        button.disabled = true;


        try {

            const response = await apiRequest(

                `${endpoint(action.panel)}/${encodeURIComponent(action.reference)}/actions`,

                {

                    method: "POST",

                    body: {

                        action: action.action,

                        reason

                    }

                }

            );


            toast(
                response.message ||
                "The server confirmed the administrative operation.",
                "success"
            );


            closeConfirmModal();


            state.loadedPanels.delete(action.panel);

            await loadPanel(action.panel, true);

            state.loadedPanels.delete("overview");

            await loadPanel("overview", true);


        } catch (error) {

            toast(
                error.message,
                "error"
            );

        } finally {

            button.disabled = false;

        }

    }


    /* =====================================================
       31. FORM SUBMISSION HELPER
    ===================================================== */

    async function submitForm(form, path, successMessage) {

        if (!requireAuthentication()) return;


        if (!form.reportValidity()) return;


        const button = $(
            'button[type="submit"]',
            form
        );


        if (button) {

            button.disabled = true;

        }


        const data = Object.fromEntries(
            new FormData(form).entries()
        );


        try {

            const response = await apiRequest(path, {

                method: "POST",

                body: data

            });


            toast(
                response.message || successMessage,
                "success"
            );


            form.reset();


            return response;

        } catch (error) {

            toast(
                error.message,
                "error"
            );

            return null;

        } finally {

            if (button) {

                button.disabled = false;

            }

        }

    }


    /* =====================================================
       32. ADMINISTRATOR INVITATION FORM
    ===================================================== */

    function initializeAdminInvitation() {

        const form = getElement(
            "admin-invitation-form"
        );


        getElement("settings-invite-admin")
            ?.addEventListener("click", () => {

                const card = getElement(
                    "admin-invitation-card"
                );

                showElement(card);

                card.scrollIntoView({

                    behavior: "smooth",

                    block: "center"

                });

            });


        form?.addEventListener("submit", async event => {

            event.preventDefault();


            const result = await submitForm(

                form,

                endpoint("admins") + "/invitations",

                "Invitation request submitted."

            );


            if (result) {

                hideElement(
                    getElement("admin-invitation-card")
                );


                state.loadedPanels.delete("invitations");

                state.loadedPanels.delete("admins");

                state.loadedPanels.delete("approvals");

                await loadPanel("admins", true);

            }

        });

    }


    /* =====================================================
       33. IMPERSONATION REQUEST FORM
    ===================================================== */

    function initializeImpersonationForm() {

        const form = getElement(
            "impersonation-form"
        );


        form?.addEventListener("submit", async event => {

            event.preventDefault();


            const result = await submitForm(

                form,

                endpoint("impersonation") + "/requests",

                "Temporary portal access request submitted."

            );


            if (result) {

                state.loadedPanels.delete("impersonation");

                await loadPanel("impersonation", true);

            }

        });

    }


    /* =====================================================
       34. MAINTENANCE REQUEST FORM
    ===================================================== */

    function initializeMaintenanceForm() {

        const form = getElement(
            "maintenance-form"
        );


        form?.addEventListener("submit", async event => {

            event.preventDefault();


            const start = new Date(
                form.elements.startAt.value
            );

            const end = new Date(
                form.elements.endAt.value
            );


            if (
                Number.isNaN(start.getTime()) ||
                Number.isNaN(end.getTime()) ||
                end <= start
            ) {

                toast(
                    "The maintenance completion time must be later than its start time.",
                    "warning"
                );

                return;

            }


            const result = await submitForm(

                form,

                endpoint("maintenance") + "/requests",

                "Maintenance request submitted."

            );


            if (result) {

                state.loadedPanels.delete("maintenance");

                await loadPanel("maintenance", true);

            }

        });

    }


    /* =====================================================
       35. FILTERING
    ===================================================== */

    function initializeSearchFilters() {

        const filters = [

            ["admin-search", "admin-table-body"],

            ["invitation-search", "invitation-table-body"],

            ["approval-search", "approval-table-body"],

            ["portal-access-search", "portal-access-table-body"],

            ["audit-search", "settings-audit-body"],

            ["notification-search", "notification-table-body"]

        ];


        filters.forEach(([inputId, tableId]) => {

            const input = getElement(inputId);

            if (!input) return;


            input.addEventListener("input", () => {

                const query =
                    input.value.trim().toLowerCase();

                const body = getElement(tableId);

                if (!body) return;


                $$("tr", body).forEach(row => {

                    const isEmpty =
                        row.querySelector(".settings-empty-cell");

                    if (isEmpty) return;


                    row.hidden =
                        !row.textContent.toLowerCase().includes(query);

                });

            });

        });


        const filterPairs = [

            ["admin-status-filter", "admin-table-body"],

            ["invitation-status-filter", "invitation-table-body"],

            ["approval-status-filter", "approval-table-body"]

        ];


        filterPairs.forEach(([filterId, tableId]) => {

            const select = getElement(filterId);

            if (!select) return;


            select.addEventListener("change", () => {

                const selected = normalizeStatus(select.value);

                const body = getElement(tableId);

                if (!body) return;


                $$("tr", body).forEach(row => {

                    if (
                        row.querySelector(".settings-empty-cell")
                    ) return;


                    const matches =
                        !selected ||
                        row.textContent
                            .toLowerCase()
                            .replace(/\s+/g, "_")
                            .includes(selected);


                    row.hidden = !matches;

                });

            });

        });

    }


    /* =====================================================
       36. ADMINISTRATOR PAGINATION
    ===================================================== */

    async function changeAdminPage(direction) {

        if (!requireAuthentication()) return;


        const current =
            state.pagination.admins || 1;

        const next =
            Math.max(1, current + direction);


        try {

            const query = new URLSearchParams({

                page: String(next),

                pageSize: String(CONFIG.PAGE_SIZE)

            });


            const response = await apiRequest(

                `${endpoint("admins")}?${query.toString()}`

            );


            state.panelRecords.admins = response;

            renderAdmins(response);

        } catch (error) {

            toast(error.message, "error");

        }

    }


    /* =====================================================
       37. AUDIT EXPORT
    ===================================================== */

    async function exportAudit() {

        if (!requireAuthentication()) return;


        const from =
            getElement("audit-date-from")?.value;

        const to =
            getElement("audit-date-to")?.value;


        if (from && to && new Date(from) > new Date(to)) {

            toast(
                "The audit start date cannot be later than the end date.",
                "warning"
            );

            return;

        }


        const query = new URLSearchParams();


        const search =
            getElement("audit-search")?.value.trim();

        const category =
            getElement("audit-category-filter")?.value;


        if (search) query.set("search", search);

        if (category) query.set("category", category);

        if (from) query.set("from", from);

        if (to) query.set("to", to);


        try {

            const response = await fetch(

                `${endpoint("audit")}/export?${query.toString()}`,

                {

                    method: "GET",

                    credentials: "same-origin",

                    headers: {

                        "Accept": "text/csv, application/octet-stream"

                    }

                }

            );


            if (!response.ok) {

                throw new Error(
                    `Audit export failed (${response.status}).`
                );

            }


            const blob = await response.blob();

            const disposition =
                response.headers.get("content-disposition") || "";


            const filenameMatch =
                disposition.match(/filename="?([^"]+)"?/i);


            const filename =
                filenameMatch?.[1] ||
                "talvora-administrative-audit.csv";


            const url = URL.createObjectURL(blob);

            const link = createElement("a");

            link.href = url;

            link.download = filename;

            document.body.appendChild(link);

            link.click();

            link.remove();

            URL.revokeObjectURL(url);


            toast(
                "Audit export received from the server.",
                "success"
            );


        } catch (error) {

            toast(
                error.message,
                "error"
            );

        }

    }


    /* =====================================================
       38. CARD CLOSING
    ===================================================== */

    function initializeCloseButtons() {

        $$("[data-close-card]").forEach(button => {

            button.addEventListener("click", () => {

                const id = button.dataset.closeCard;

                hideElement(getElement(id));

            });

        });


        $$("[data-close-modal]").forEach(button => {

            button.addEventListener(
                "click",
                closeDetailModal
            );

        });


        $$("[data-close-confirm]").forEach(button => {

            button.addEventListener(
                "click",
                closeConfirmModal
            );

        });


        getElement("settings-confirm-submit")
            ?.addEventListener(
                "click",
                executeConfirmedAction
            );


        getElement("settings-detail-modal")
            ?.addEventListener("click", event => {

                if (
                    event.target.id ===
                    "settings-detail-modal"
                ) {

                    closeDetailModal();

                }

            });


        getElement("settings-confirm-modal")
            ?.addEventListener("click", event => {

                if (
                    event.target.id ===
                    "settings-confirm-modal"
                ) {

                    closeConfirmModal();

                }

            });


        document.addEventListener("keydown", event => {

            if (event.key === "Escape") {

                closeDetailModal();

                closeConfirmModal();

                closeSidebar();

            }

        });

    }


    /* =====================================================
       39. REFRESH
    ===================================================== */

    async function refreshCurrentPanel() {

        if (!requireAuthentication()) return;

        if (state.refreshInProgress) return;


        state.refreshInProgress = true;


        const button = getElement(
            "settings-refresh"
        );

        if (button) {

            button.disabled = true;

        }


        try {

            state.loadedPanels.delete(
                state.activePanel
            );


            await loadPanel(
                state.activePanel,
                true
            );


            toast(
                "The latest available server records have been requested.",
                "success"
            );


        } catch (error) {

            toast(error.message, "error");

        } finally {

            state.refreshInProgress = false;

            if (button) {

                button.disabled = false;

            }

        }

    }


    /* =====================================================
       40. GLOBAL EVENT INITIALIZATION
    ===================================================== */

    function initializeEvents() {

        initializeNavigation();

        initializeSidebar();

        initializeAdminInvitation();

        initializeImpersonationForm();

        initializeMaintenanceForm();

        initializeSearchFilters();

        initializeCloseButtons();


        getElement("settings-refresh")
            ?.addEventListener(
                "click",
                refreshCurrentPanel
            );


        getElement("settings-audit-export")
            ?.addEventListener(
                "click",
                exportAudit
            );


        getElement("admin-prev")
            ?.addEventListener("click", () => {

                changeAdminPage(-1);

            });


        getElement("admin-next")
            ?.addEventListener("click", () => {

                changeAdminPage(1);

            });

    }


    /* =====================================================
       41. GLOBAL SECURITY GUARDS
    ===================================================== */

    function initializeSecurityGuards() {

        const app = getElement("settings-app");

        if (!app) return;


        /*
         * Frontend visibility is not authorization.
         * All protected API endpoints must enforce
         * Super Admin authorization independently.
         */


        window.addEventListener("pagehide", () => {

            /*
             * The backend must terminate or expire
             * impersonation sessions independently.
             *
             * Never rely on pagehide as a security boundary.
             */

        });


        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.visibilityState === "visible" &&
                    state.authenticated
                ) {

                    /*
                     * Recheck session before sensitive
                     * operations through server authorization.
                     */

                    state.loadedPanels.clear();

                }

            }
        );

    }


    /* =====================================================
       42. INITIALIZATION
    ===================================================== */

    async function initializeSettings() {

        initializeEvents();

        initializeSecurityGuards();


        const authenticated =
            await verifySession();


        if (!authenticated) {

            return;

        }


        state.loadedPanels.clear();


        await loadPanel("overview", true);


        console.info(
            "TALVORA System Settings initialized."
        );

    }


    /* =====================================================
       43. APPLICATION START
    ===================================================== */

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initializeSettings,
            { once: true }
        );

    } else {

        initializeSettings();

    }


})();
