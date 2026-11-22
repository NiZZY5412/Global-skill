
/* =========================================================
   TALVORA GLOBAL
   SUPER ADMIN ACTIVITY & SECURITY CENTRE
   GSES SYSTEM 001

   Production-oriented frontend controller.

   NO DEMO DATA
   NO FAKE SECURITY EVENTS
   NO SIMULATED LOGIN RECORDS
   NO CLIENT-SIDE AUTHORIZATION TRUST

   All privileged operations require server authorization.
========================================================= */

"use strict";

(() => {

    /* =====================================================
       01. CONFIGURATION
    ===================================================== */

    const CONFIG = Object.freeze({

        API: "/api/v1/admin/activity-security",

        SESSION: "/api/v1/auth/session",

        PAGE_SIZE: 25,

        REQUEST_TIMEOUT: 20000,

        PANELS: [
            "overview",
            "logins",
            "suspicious",
            "sessions",
            "incidents",
            "actions",
            "accountability",
            "audit"
        ]

    });


    const ENDPOINTS = Object.freeze({

        overview: "/overview",

        logins: "/login-history",

        suspicious: "/suspicious-access",

        sessions: "/sessions",

        incidents: "/incidents",

        actions: "/privileged-actions",

        accountability: "/administrators/accountability",

        audit: "/audit-trail"

    });


    /* =====================================================
       02. STATE
    ===================================================== */

    const state = {

        authenticated: false,

        administrator: null,

        csrfToken: null,

        activePanel: "overview",

        loading: new Set(),

        records: {},

        pages: {},

        filters: {},

        selectedIncident: null,

        pendingAction: null,

        lastFocus: null,

        refreshing: false

    };


    /* =====================================================
       03. DOM HELPERS
    ===================================================== */

    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

    const $$ = (selector, parent = document) =>
        Array.from(parent.querySelectorAll(selector));


    function byId(id) {

        return document.getElementById(id);

    }


    function setText(id, value) {

        const element = byId(id);

        if (!element) return;

        element.textContent =
            value === null ||
                value === undefined ||
                value === ""
                ? "—"
                : String(value);

    }


    function show(element) {

        if (element) element.hidden = false;

    }


    function hide(element) {

        if (element) element.hidden = true;

    }


    function makeElement(tag, className, text) {

        const element = document.createElement(tag);

        if (className) element.className = className;

        if (text !== undefined && text !== null) {

            element.textContent = String(text);

        }

        return element;

    }


    function formatNumber(value) {

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

        if (Number.isNaN(date.getTime())) return "—";

        return new Intl.DateTimeFormat(undefined, {

            dateStyle: "medium"

        }).format(date);

    }


    function formatDateTime(value) {

        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "—";

        return new Intl.DateTimeFormat(undefined, {

            dateStyle: "medium",

            timeStyle: "short"

        }).format(date);

    }


    function normalize(value) {

        return String(value || "unknown")
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/-/g, "_");

    }


    function label(value) {

        if (!value) return "Unknown";

        return String(value)
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, character =>
                character.toUpperCase()
            );

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


    function getReference(record) {

        return record?.reference ||
            record?.eventReference ||
            record?.id ||
            null;

    }


    /* =====================================================
       04. NOTIFICATIONS
    ===================================================== */

    function notify(message, type = "info") {

        const container = byId(
            "activity-toast-container"
        );

        if (!container) return;


        const toast = makeElement(
            "div",
            `activity-toast ${type}`,
            message
        );

        toast.setAttribute("role", "status");

        container.appendChild(toast);


        window.setTimeout(() => {

            toast.remove();

        }, 5000);

    }


    function notice(message, type = "info") {

        const element = byId("activity-notice");

        if (!element) return;

        element.className = `activity-notice ${type}`;

        element.textContent = message;

        show(element);

    }


    function clearNotice() {

        const element = byId("activity-notice");

        if (!element) return;

        element.textContent = "";

        hide(element);

    }


    /* =====================================================
       05. API REQUEST HANDLER
    ===================================================== */

    async function request(path, options = {}) {

        const controller = new AbortController();

        const timeout = window.setTimeout(() => {

            controller.abort();

        }, CONFIG.REQUEST_TIMEOUT);


        const method = options.method || "GET";


        const headers = {

            "Accept": "application/json",

            ...options.headers

        };


        const requestOptions = {

            method,

            credentials: "same-origin",

            headers,

            signal: controller.signal

        };


        if (options.body !== undefined) {

            headers["Content-Type"] = "application/json";

            requestOptions.body =
                JSON.stringify(options.body);

        }


        if (
            state.csrfToken &&
            !["GET", "HEAD", "OPTIONS"].includes(method)
        ) {

            headers["X-CSRF-Token"] = state.csrfToken;

        }


        try {

            const response = await fetch(
                path,
                requestOptions
            );


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

                notice(
                    "Your administrator session has expired or is unavailable. Authenticate again.",
                    "error"
                );

                throw new Error("Authentication required.");

            }


            if (response.status === 403) {

                throw new Error(
                    "The server denied this operation. Authorization was not granted."
                );

            }


            if (!response.ok) {

                throw new Error(
                    result?.message ||
                    result?.error ||
                    `Server request failed (${response.status}).`
                );

            }


            return result;

        } catch (error) {

            if (error.name === "AbortError") {

                throw new Error("The server request timed out.");

            }

            if (error instanceof TypeError) {

                throw new Error(
                    "The backend could not be reached. The operation has not been confirmed."
                );

            }

            throw error;

        } finally {

            window.clearTimeout(timeout);

        }

    }


    function api(panel) {

        const path = ENDPOINTS[panel];

        if (!path) {

            throw new Error(
                `No API endpoint configured for ${panel}.`
            );

        }

        return CONFIG.API + path;

    }


    /* =====================================================
       06. SESSION VERIFICATION
    ===================================================== */

    async function verifySession() {

        try {

            const response = await request(
                CONFIG.SESSION
            );


            if (
                !response ||
                response.authenticated !== true ||
                response.user?.role !== "super_admin"
            ) {

                state.authenticated = false;

                notice(
                    "Access requires a verified Super Admin account.",
                    "error"
                );

                return false;

            }


            state.authenticated = true;

            state.administrator = response.user;

            state.csrfToken =
                response.csrfToken || null;


            const name =
                response.user.displayName ||
                response.user.name ||
                "Super Administrator";


            setText("activity-admin-name", name);

            setText(
                "activity-admin-email",
                response.user.email
            );


            const initials = name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(part => part[0])
                .join("")
                .toUpperCase();


            setText("activity-admin-avatar", initials);


            setText(
                "activity-session-status",
                "Verified session"
            );


            $(".activity-status-dot")
                ?.classList.add("online");


            setText(
                "activity-data-status",
                "Authenticated"
            );


            return true;

        } catch (error) {

            state.authenticated = false;

            notice(error.message, "error");

            return false;

        }

    }


    function requireAuthentication() {

        if (!state.authenticated) {

            notify(
                "A verified Super Admin session is required.",
                "error"
            );

            return false;

        }

        return true;

    }


    /* =====================================================
       07. NAVIGATION
    ===================================================== */

    function navigate(panel, updateHash = true) {

        if (!CONFIG.PANELS.includes(panel)) {

            panel = "overview";

        }


        state.activePanel = panel;


        $$(".activity-panel").forEach(section => {

            const active =
                section.id === `activity-panel-${panel}`;

            section.hidden = !active;

            section.classList.toggle("active", active);

        });


        const titles = {

            overview: "Security Overview",

            logins: "Administrator Login History",

            suspicious: "Suspicious Access Monitoring",

            sessions: "Administrator Device Sessions",

            incidents: "Security Incidents",

            actions: "Privileged Actions Register",

            accountability: "Administrator Accountability",

            audit: "Security Audit Trail"

        };


        $$(".activity-nav-link").forEach(link => {

            const active =
                link.dataset.activityPanel === panel;

            link.classList.toggle("active", active);

            if (active) {

                link.setAttribute("aria-current", "page");

            } else {

                link.removeAttribute("aria-current");

            }

        });


        setText(
            "activity-page-title",
            titles[panel] || "Security Centre"
        );


        if (updateHash) {

            history.replaceState(
                null,
                "",
                `#${panel}`
            );

        }


        closeSidebar();

        clearNotice();

        loadPanel(panel);

        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    }


    function initializeNavigation() {

        $$(".activity-nav-link[data-activity-panel]")
            .forEach(link => {

                link.addEventListener("click", event => {

                    event.preventDefault();

                    navigate(link.dataset.activityPanel);

                });

            });


        $$("[data-activity-panel]")
            .forEach(button => {

                if (
                    button.classList.contains(
                        "activity-nav-link"
                    )
                ) return;


                button.addEventListener("click", () => {

                    navigate(button.dataset.activityPanel);

                });

            });


        const initial = location.hash.replace("#", "");

        navigate(
            CONFIG.PANELS.includes(initial)
                ? initial
                : "overview",
            false
        );

    }


    /* =====================================================
       08. MOBILE SIDEBAR
    ===================================================== */

    function openSidebar() {

        byId("activity-sidebar")
            ?.classList.add("open");

        show(
            byId("activity-sidebar-overlay")
        );

        byId("activity-menu-toggle")
            ?.setAttribute("aria-expanded", "true");

    }


    function closeSidebar() {

        byId("activity-sidebar")
            ?.classList.remove("open");

        hide(
            byId("activity-sidebar-overlay")
        );

        byId("activity-menu-toggle")
            ?.setAttribute("aria-expanded", "false");

    }


    function initializeSidebar() {

        byId("activity-menu-toggle")
            ?.addEventListener("click", openSidebar);


        byId("activity-sidebar-close")
            ?.addEventListener("click", closeSidebar);


        byId("activity-sidebar-overlay")
            ?.addEventListener("click", closeSidebar);

    }


    /* =====================================================
       09. PANEL DATA LOADING
    ===================================================== */

    async function loadPanel(panel, force = false) {

        if (!requireAuthentication()) return;

        if (
            state.loading.has(panel) ||
            (state.records[panel] && !force)
        ) {

            return;

        }


        state.loading.add(panel);


        try {

            const query = new URLSearchParams({

                page: String(state.pages[panel] || 1),

                pageSize: String(CONFIG.PAGE_SIZE)

            });


            const response = await request(

                `${api(panel)}?${query.toString()}`

            );


            if (
                !response ||
                typeof response !== "object"
            ) {

                throw new Error(
                    "The server returned an invalid response."
                );

            }


            state.records[panel] = response;


            renderPanel(panel, response);


            setText(
                "activity-data-status",
                "Server data received"
            );


        } catch (error) {

            notice(
                `${label(panel)}: ${error.message}`,
                "warning"
            );

            setText(
                "activity-data-status",
                "Data unavailable"
            );

        } finally {

            state.loading.delete(panel);

        }

    }


    function renderPanel(panel, data) {

        const renderers = {

            overview: renderOverview,

            logins: renderLogins,

            suspicious: renderSuspicious,

            sessions: renderSessions,

            incidents: renderIncidents,

            actions: renderActions,

            accountability: renderAccountability,

            audit: renderAudit

        };


        renderers[panel]?.(data);

    }


    /* =====================================================
       10. TABLE HELPERS
    ===================================================== */

    function clearTable(id) {

        const body = byId(id);

        if (!body) return null;

        body.replaceChildren();

        return body;

    }


    function emptyTable(id, columns, message) {

        const body = clearTable(id);

        if (!body) return;


        const row = makeElement("tr");

        const cell = makeElement(
            "td",
            "activity-empty-cell",
            message
        );

        cell.colSpan = columns;

        row.appendChild(cell);

        body.appendChild(row);

    }


    function addCell(row, value, strong = false) {

        const cell = makeElement("td");

        const text =
            value === null ||
                value === undefined ||
                value === ""
                ? "—"
                : String(value);


        if (strong) {

            cell.appendChild(
                makeElement("strong", "", text)
            );

        } else {

            cell.textContent = text;

        }


        row.appendChild(cell);

        return cell;

    }


    function addStatus(row, value) {

        const cell = makeElement("td");

        const status = normalize(value);

        const badge = makeElement(
            "span",
            `activity-status ${status}`,
            label(value)
        );

        cell.appendChild(badge);

        row.appendChild(cell);

    }


    function addSeverity(row, value) {

        const cell = makeElement("td");

        const badge = makeElement(
            "span",
            `activity-severity ${normalize(value)}`,
            label(value)
        );

        cell.appendChild(badge);

        row.appendChild(cell);

    }


    function addButton(row, text, callback, danger = false) {

        const cell = makeElement("td");

        const button = makeElement(
            "button",
            `activity-row-button${danger ? " danger" : ""}`,
            text
        );

        button.type = "button";

        button.addEventListener("click", callback);

        cell.appendChild(button);

        row.appendChild(cell);

        return button;

    }


    function addActionButtons(row, buttons) {

        const cell = makeElement("td");

        const wrapper = makeElement(
            "div",
            "activity-row-actions"
        );


        buttons.forEach(item => {

            const button = makeElement(
                "button",
                `activity-row-button${item.danger ? " danger" : ""}`,
                item.text
            );

            button.type = "button";

            button.addEventListener(
                "click",
                item.callback
            );

            wrapper.appendChild(button);

        });


        cell.appendChild(wrapper);

        row.appendChild(cell);

    }


    /* =====================================================
       11. RECORD DETAIL MODAL
    ===================================================== */

    async function openDetails(panel, reference) {

        if (!requireAuthentication()) return;

        if (!reference) return;


        const modal = byId("activity-detail-modal");

        const content = byId("activity-detail-content");


        state.lastFocus = document.activeElement;

        content.replaceChildren();


        setText(
            "activity-detail-title",
            "Loading Record"
        );


        show(modal);


        try {

            const url =
                `${api(panel)}/${encodeURIComponent(reference)}`;


            const response = await request(url);

            const record =
                response.record || response;


            setText(
                "activity-detail-title",
                record.title ||
                record.displayName ||
                record.reference ||
                record.id ||
                "Record Details"
            );


            Object.entries(record).forEach(([key, value]) => {

                if (
                    value === null ||
                    value === undefined ||
                    typeof value === "object"
                ) {

                    return;

                }


                const row = makeElement(
                    "div",
                    "activity-detail-row"
                );


                row.appendChild(
                    makeElement(
                        "strong",
                        "",
                        label(key)
                    )
                );


                row.appendChild(
                    makeElement(
                        "span",
                        "",
                        String(value)
                    )
                );


                content.appendChild(row);

            });


            if (!content.children.length) {

                content.textContent =
                    "No additional displayable details were returned.";

            }

        } catch (error) {

            content.textContent = error.message;

        }

    }


    function closeDetails() {

        hide(byId("activity-detail-modal"));

        state.lastFocus?.focus?.();

        state.lastFocus = null;

    }


    /* =====================================================
       12. SECURITY OVERVIEW
    ===================================================== */

    function renderOverview(data) {

        const metrics = data.metrics || {};


        const mapping = {

            "metric-admin-logins": metrics.administratorLogins,

            "metric-failed-logins": metrics.failedLoginAttempts,

            "metric-active-sessions": metrics.activeDeviceSessions,

            "metric-open-incidents": metrics.openSecurityIncidents,

            "metric-suspicious-events": metrics.suspiciousAccessEvents,

            "metric-privileged-actions": metrics.privilegedOperations

        };


        Object.entries(mapping).forEach(([id, value]) => {

            setText(
                id,
                value === undefined
                    ? "—"
                    : formatNumber(value)
            );

        });


        const posture = data.securityPosture || {};


        const postureMapping = {

            "posture-mfa": posture.administratorMfa,

            "posture-sessions": posture.sessionSecurity,

            "posture-audit": posture.auditIntegrity,

            "posture-monitoring": posture.accessMonitoring,

            "posture-incidents": posture.incidentResponse

        };


        Object.entries(postureMapping).forEach(([id, value]) => {

            const element = byId(id);

            if (!element) return;

            element.className =
                `activity-status ${normalize(value)}`;

            element.textContent = label(value);

        });


        renderRecentActivity(
            data.recentAdministratorActivity || []
        );


        renderAlertSummary(
            data.securityAlerts || []
        );

    }


    function renderRecentActivity(items) {

        const body = clearTable(
            "overview-recent-activity"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "overview-recent-activity",
                6,
                "No recent administrator activity returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");

            addCell(
                row,
                item.administrator?.displayName,
                true
            );

            addCell(
                row,
                item.operation || item.action
            );

            addCell(
                row,
                item.target?.reference ||
                item.targetReference
            );

            addCell(row, item.portal);

            addCell(
                row,
                formatDateTime(item.timestamp)
            );

            addStatus(row, item.outcome);

            body.appendChild(row);

        });

    }


    function renderAlertSummary(items) {

        const container = byId(
            "overview-security-alerts"
        );

        if (!container) return;


        container.replaceChildren();


        if (!items.length) {

            const empty = makeElement(
                "div",
                "activity-empty-state"
            );

            empty.appendChild(
                makeElement("span", "", "◎")
            );

            empty.appendChild(
                makeElement(
                    "strong",
                    "",
                    "No alert records returned"
                )
            );

            empty.appendChild(
                makeElement(
                    "p",
                    "",
                    "The backend has not returned security alert records."
                )
            );

            container.appendChild(empty);

            return;

        }


        items.slice(0, 6).forEach(item => {

            const row = makeElement(
                "div",
                "activity-posture-row"
            );


            const details = makeElement("div");

            details.appendChild(
                makeElement(
                    "strong",
                    "",
                    item.title || item.detectionType
                )
            );

            details.appendChild(
                makeElement(
                    "small",
                    "",
                    formatDateTime(item.detectedAt)
                )
            );


            const severity = makeElement(
                "span",
                `activity-severity ${normalize(item.severity)}`,
                label(item.severity)
            );


            row.append(details, severity);

            container.appendChild(row);

        });

    }


    /* =====================================================
       13. LOGIN HISTORY
    ===================================================== */

    function renderLogins(data) {

        const items = getItems(data);

        const body = clearTable(
            "login-history-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "login-history-body",
                9,
                "No administrator login records returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");

            addCell(
                row,
                item.administrator?.displayName ||
                item.administrator?.email,
                true
            );

            addCell(row, item.event);

            addStatus(row, item.result);

            addCell(row, item.ipAddress);

            addCell(
                row,
                item.device?.name ||
                item.deviceName
            );

            addCell(
                row,
                item.location?.label ||
                item.location?.city
            );

            addCell(row, item.loginMethod);

            addCell(
                row,
                formatDateTime(item.timestamp)
            );


            addButton(
                row,
                "View",
                () => openDetails(
                    "logins",
                    getReference(item)
                )
            );


            body.appendChild(row);

        });


        updatePagination("logins", data);

    }


    /* =====================================================
       14. SUSPICIOUS ACCESS
    ===================================================== */

    function renderSuspicious(data) {

        const items = getItems(data);

        const body = clearTable(
            "suspicious-events-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "suspicious-events-body",
                8,
                "No suspicious access records returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");

            addCell(
                row,
                getReference(item),
                true
            );

            addCell(
                row,
                item.administrator?.displayName
            );

            addCell(
                row,
                item.detectionType
            );

            addCell(row, item.ipAddress);

            addSeverity(row, item.severity);

            addCell(
                row,
                formatDateTime(item.detectedAt)
            );

            addStatus(row, item.status);


            const buttons = [

                {

                    text: "Investigate",

                    callback: () => openDetails(
                        "suspicious",
                        getReference(item)
                    )

                }

            ];


            if (
                ["open", "new"].includes(
                    normalize(item.status)
                )
            ) {

                buttons.push({

                    text: "Investigate",

                    callback: () => confirmAction({

                        title: "Start Security Investigation",

                        description:
                            "Record the commencement of a formal investigation into this suspicious access event.",

                        panel: "suspicious",

                        reference: getReference(item),

                        action: "investigate"

                    })

                });

            }


            addActionButtons(row, buttons);

            body.appendChild(row);

        });

    }


    /* =====================================================
       15. DEVICE SESSIONS
    ===================================================== */

    function renderSessions(data) {

        const items = getItems(data);

        const body = clearTable(
            "device-sessions-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "device-sessions-body",
                9,
                "No administrator device sessions returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");


            addCell(
                row,
                item.administrator?.displayName,
                true
            );

            addCell(
                row,
                item.device?.name ||
                item.deviceName
            );

            addCell(
                row,
                [
                    item.device?.browser,
                    item.device?.operatingSystem
                ]
                    .filter(Boolean)
                    .join(" / ")
            );

            addCell(row, item.ipAddress);

            addCell(
                row,
                item.location?.label ||
                item.location?.city
            );

            addCell(
                row,
                formatDateTime(item.startedAt)
            );

            addCell(
                row,
                formatDateTime(item.lastActivityAt)
            );

            addStatus(row, item.status);


            const buttons = [

                {

                    text: "Details",

                    callback: () => openDetails(
                        "sessions",
                        getReference(item)
                    )

                }

            ];


            if (
                normalize(item.status) === "active" &&
                item.isCurrentSession !== true
            ) {

                buttons.push({

                    text: "Revoke",

                    danger: true,

                    callback: () => confirmAction({

                        title: "Revoke Administrator Session",

                        description:
                            "This will request server-side revocation of the selected administrator device session and its associated refresh credentials.",

                        panel: "sessions",

                        reference: getReference(item),

                        action: "revoke"

                    })

                });

            }


            addActionButtons(row, buttons);

            body.appendChild(row);

        });

    }


    /* =====================================================
       16. SECURITY INCIDENTS
    ===================================================== */

    function renderIncidents(data) {

        const items = getItems(data);

        const body = clearTable(
            "security-incidents-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "security-incidents-body",
                8,
                "No security incidents returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");

            addCell(
                row,
                getReference(item),
                true
            );

            addCell(row, item.title);

            addCell(row, item.category);

            addSeverity(row, item.severity);

            addCell(
                row,
                item.assignedTo?.displayName
            );

            addCell(
                row,
                formatDateTime(item.reportedAt)
            );

            addStatus(row, item.status);


            const buttons = [

                {

                    text: "Investigate",

                    callback: () => openIncident(item)

                }

            ];


            if (
                ["open", "investigating"].includes(
                    normalize(item.status)
                )
            ) {

                buttons.push({

                    text: "Update",

                    callback: () => confirmAction({

                        title: "Update Security Incident",

                        description:
                            "Submit a documented incident status update for review and server-side recording.",

                        panel: "incidents",

                        reference: getReference(item),

                        action: "update"

                    })

                });

            }


            addActionButtons(row, buttons);

            body.appendChild(row);

        });

    }


    async function openIncident(item) {

        state.selectedIncident = getReference(item);


        const container = byId(
            "incident-investigation-panel"
        );


        container.replaceChildren();


        const loading = makeElement(
            "div",
            "activity-empty-state",
            "Loading investigation records..."
        );


        container.appendChild(loading);


        try {

            const response = await request(

                `${api("incidents")}/${encodeURIComponent(state.selectedIncident)}/investigation`

            );


            container.replaceChildren();


            const record =
                response.investigation || response;


            const fields = {

                "Incident Reference": state.selectedIncident,

                "Title": item.title,

                "Severity": label(item.severity),

                "Status": label(item.status),

                "Assigned To": item.assignedTo?.displayName,

                "Description": record.description,

                "Investigation Notes": record.notes,

                "Containment Actions": record.containmentActions,

                "Resolution": record.resolution,

                "Last Updated": formatDateTime(record.updatedAt)

            };


            Object.entries(fields).forEach(([key, value]) => {

                if (!value) return;


                const row = makeElement(
                    "div",
                    "activity-detail-row"
                );


                row.appendChild(
                    makeElement("strong", "", key)
                );

                row.appendChild(
                    makeElement("span", "", value)
                );

                container.appendChild(row);

            });


            if (!container.children.length) {

                container.textContent =
                    "No investigation details returned.";

            }

        } catch (error) {

            container.textContent = error.message;

        }

    }


    /* =====================================================
       17. PRIVILEGED ACTIONS
    ===================================================== */

    function renderActions(data) {

        const items = getItems(data);

        const body = clearTable(
            "privileged-actions-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "privileged-actions-body",
                9,
                "No privileged actions returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");


            addCell(
                row,
                item.administrator?.displayName,
                true
            );

            addCell(
                row,
                item.operation || item.action
            );

            addCell(row, item.category);

            addCell(
                row,
                item.target?.reference ||
                item.targetReference
            );

            addCell(row, item.portal);

            addCell(
                row,
                item.approvalReference
            );

            addCell(
                row,
                formatDateTime(item.timestamp)
            );

            addStatus(row, item.outcome);


            addButton(
                row,
                "Details",
                () => openDetails(
                    "actions",
                    getReference(item)
                )
            );


            body.appendChild(row);

        });

    }


    /* =====================================================
       18. ADMINISTRATOR ACCOUNTABILITY
    ===================================================== */

    function renderAccountability(data) {

        const items = getItems(data);

        const body = clearTable(
            "accountability-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "accountability-body",
                8,
                "No administrator accountability records returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");


            addCell(
                row,
                item.displayName ||
                item.name,
                true
            );

            addCell(
                row,
                item.reference ||
                item.id
            );

            addStatus(row, item.accountStatus);

            addCell(
                row,
                formatDateTime(item.lastLoginAt)
            );

            addCell(
                row,
                formatDateTime(item.lastPrivilegedActionAt)
            );

            addStatus(
                row,
                item.mfaEnabled === true
                    ? "verified"
                    : item.mfaEnabled === false
                        ? "failed"
                        : "unknown"
            );

            addCell(
                row,
                item.activeSessionCount === undefined
                    ? "—"
                    : formatNumber(item.activeSessionCount)
            );


            addButton(
                row,
                "View Profile",
                () => openAdministratorProfile(item)
            );


            body.appendChild(row);

        });

    }


    async function openAdministratorProfile(item) {

        const reference =
            item.reference || item.id;


        const container = byId(
            "administrator-profile-panel"
        );


        container.replaceChildren();

        container.textContent =
            "Loading administrator activity profile...";


        try {

            const response = await request(

                `${api("accountability")}/${encodeURIComponent(reference)}/profile`

            );


            const profile =
                response.profile || response;


            container.replaceChildren();


            const fields = {

                "Administrator": profile.displayName,

                "Reference": profile.reference,

                "Email": profile.email,

                "Account Status": label(profile.accountStatus),

                "MFA": label(
                    profile.mfaEnabled === true
                        ? "enabled"
                        : profile.mfaEnabled === false
                            ? "disabled"
                            : "unknown"
                ),

                "Last Login": formatDateTime(profile.lastLoginAt),

                "Last Privileged Action": formatDateTime(profile.lastPrivilegedActionAt),

                "Active Sessions": profile.activeSessionCount,

                "Recorded Operations": profile.privilegedOperationCount,

                "Failed Logins": profile.failedLoginCount,

                "Open Investigations": profile.openInvestigationCount

            };


            Object.entries(fields).forEach(([key, value]) => {

                if (value === undefined || value === null) return;


                const row = makeElement(
                    "div",
                    "activity-detail-row"
                );


                row.appendChild(
                    makeElement("strong", "", key)
                );


                row.appendChild(
                    makeElement(
                        "span",
                        "",
                        typeof value === "number"
                            ? formatNumber(value)
                            : String(value)
                    )
                );


                container.appendChild(row);

            });

        } catch (error) {

            container.textContent = error.message;

        }

    }


    /* =====================================================
       19. SECURITY AUDIT TRAIL
    ===================================================== */

    function renderAudit(data) {

        const items = getItems(data);

        const body = clearTable(
            "security-audit-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "security-audit-body",
                9,
                "No protected audit records returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");


            addCell(
                row,
                getReference(item),
                true
            );

            addCell(
                row,
                formatDateTime(item.timestamp)
            );

            addCell(
                row,
                item.actor?.displayName
            );

            addCell(row, item.eventType);

            addCell(
                row,
                item.operation
            );

            addCell(
                row,
                item.target?.reference
            );

            addCell(row, item.sourceIp);

            addStatus(row, item.integrityStatus);


            addButton(
                row,
                "Inspect",
                () => openDetails(
                    "audit",
                    getReference(item)
                )
            );


            body.appendChild(row);

        });

    }


    /* =====================================================
       20. PAGINATION
    ===================================================== */

    function updatePagination(panel, data) {

        const pagination = data.pagination || {};

        const page =
            pagination.page ||
            state.pages[panel] ||
            1;

        const totalPages =
            pagination.totalPages || 1;

        const total =
            pagination.total ??
            getItems(data).length;


        state.pages[panel] = page;


        setText(
            `${panel}-record-count`,
            `${formatNumber(total)} records`
        );


        setText(
            `${panel}-page-info`,
            `${page} / ${totalPages}`
        );


        const previous = byId(`${panel}-prev`);

        const next = byId(`${panel}-next`);


        if (previous) {

            previous.disabled = page <= 1;

        }


        if (next) {

            next.disabled = page >= totalPages;

        }

    }


    async function changePage(panel, direction) {

        if (!requireAuthentication()) return;


        const next = Math.max(
            1,
            (state.pages[panel] || 1) + direction
        );


        state.pages[panel] = next;

        delete state.records[panel];

        await loadPanel(panel);

    }


    /* =====================================================
       21. SERVER-SIDE FILTERING
    ===================================================== */

    const FILTERS = {

        logins: [

            "login-search",

            "login-result-filter",

            "login-method-filter",

            "login-date-from",

            "login-date-to"

        ],

        suspicious: [

            "suspicious-search",

            "suspicious-severity",

            "suspicious-status"

        ],

        sessions: [

            "session-search",

            "session-status-filter"

        ],

        incidents: [

            "incident-search",

            "incident-severity-filter",

            "incident-status-filter"

        ],

        actions: [

            "actions-search",

            "actions-category",

            "actions-outcome"

        ],

        accountability: [

            "accountability-search",

            "accountability-status"

        ],

        audit: [

            "audit-search",

            "audit-type-filter",

            "audit-from",

            "audit-to"

        ]

    };


    function collectFilters(panel) {

        const result = {};


        (FILTERS[panel] || []).forEach(id => {

            const element = byId(id);

            if (
                element &&
                element.value.trim() !== ""
            ) {

                result[id] = element.value.trim();

            }

        });


        return result;

    }


    async function applyFilters(panel) {

        if (!requireAuthentication()) return;


        const filters = collectFilters(panel);


        if (
            filters["login-date-from"] &&
            filters["login-date-to"] &&
            filters["login-date-from"] >
            filters["login-date-to"]
        ) {

            notify(
                "The start date cannot be later than the end date.",
                "warning"
            );

            return;

        }


        if (
            filters["audit-from"] &&
            filters["audit-to"] &&
            filters["audit-from"] >
            filters["audit-to"]
        ) {

            notify(
                "The audit start date cannot be later than the end date.",
                "warning"
            );

            return;

        }


        state.filters[panel] = filters;

        state.pages[panel] = 1;


        const query = new URLSearchParams({

            page: "1",

            pageSize: String(CONFIG.PAGE_SIZE)

        });


        Object.entries(filters).forEach(([key, value]) => {

            query.set(key, value);

        });


        try {

            const response = await request(

                `${api(panel)}?${query.toString()}`

            );


            state.records[panel] = response;

            renderPanel(panel, response);


            notify(
                "Filtered records received from the server.",
                "success"
            );


        } catch (error) {

            notify(error.message, "error");

        }

    }


    function initializeFilters() {

        const buttons = {

            "login-apply-filter": "logins",

            "suspicious-apply": "suspicious",

            "session-apply": "sessions",

            "incident-apply": "incidents",

            "actions-apply": "actions",

            "accountability-apply": "accountability",

            "audit-apply": "audit"

        };


        Object.entries(buttons).forEach(([id, panel]) => {

            byId(id)?.addEventListener("click", () => {

                applyFilters(panel);

            });

        });


        Object.entries(FILTERS).forEach(([panel, ids]) => {

            ids.forEach(id => {

                const element = byId(id);

                if (!element) return;


                element.addEventListener("keydown", event => {

                    if (
                        event.key === "Enter" &&
                        element.tagName === "INPUT"
                    ) {

                        applyFilters(panel);

                    }

                });

            });

        });

    }


    /* =====================================================
       22. CONFIRMATION ACTIONS
    ===================================================== */

    function confirmAction(action) {

        if (!requireAuthentication()) return;


        state.pendingAction = action;

        state.lastFocus = document.activeElement;


        setText(
            "activity-confirm-title",
            action.title
        );


        setText(
            "activity-confirm-description",
            action.description
        );


        const reason = byId(
            "activity-confirm-reason"
        );

        if (reason) {

            reason.value = "";

        }


        show(
            byId("activity-confirm-modal")
        );

        reason?.focus();

    }


    function closeConfirmModal() {

        hide(
            byId("activity-confirm-modal")
        );


        state.pendingAction = null;

        state.lastFocus?.focus?.();

        state.lastFocus = null;

    }


    async function executeAction() {

        if (!requireAuthentication()) return;


        const action = state.pendingAction;

        if (!action) return;


        const reason =
            byId("activity-confirm-reason")
                ?.value.trim();


        if (!reason || reason.length < 10) {

            notify(
                "Please provide a meaningful justification of at least 10 characters.",
                "warning"
            );

            return;

        }


        const button = byId(
            "activity-confirm-submit"
        );

        button.disabled = true;


        try {

            const response = await request(

                `${api(action.panel)}/${encodeURIComponent(action.reference)}/actions`,

                {

                    method: "POST",

                    body: {

                        action: action.action,

                        reason

                    }

                }

            );


            notify(
                response.message ||
                "The server confirmed the requested operation.",
                "success"
            );


            closeConfirmModal();


            delete state.records[action.panel];

            delete state.records.overview;


            await loadPanel(action.panel, true);


            if (action.panel !== "overview") {

                await loadPanel("overview", true);

            }

        } catch (error) {

            notify(
                error.message,
                "error"
            );

        } finally {

            button.disabled = false;

        }

    }


    /* =====================================================
       23. CREATE INCIDENT
    ===================================================== */

    function openIncidentForm() {

        if (!requireAuthentication()) return;


        state.lastFocus = document.activeElement;


        show(
            byId("incident-modal")
        );

    }


    function closeIncidentForm() {

        hide(
            byId("incident-modal")
        );


        state.lastFocus?.focus?.();

        state.lastFocus = null;

    }


    async function submitIncident(event) {

        event.preventDefault();


        if (!requireAuthentication()) return;


        const form = event.currentTarget;

        if (!form.reportValidity()) return;


        const button = $(
            'button[type="submit"]',
            form
        );

        button.disabled = true;


        const formData = Object.fromEntries(
            new FormData(form).entries()
        );


        try {

            const response = await request(

                `${api("incidents")}`,

                {

                    method: "POST",

                    body: formData

                }

            );


            notify(
                response.message ||
                "The server confirmed receipt of the incident report.",
                "success"
            );


            form.reset();

            closeIncidentForm();


            delete state.records.incidents;

            await loadPanel("incidents", true);


        } catch (error) {

            notify(error.message, "error");

        } finally {

            button.disabled = false;

        }

    }


    /* =====================================================
       24. AUDIT EXPORT
    ===================================================== */

    async function exportAudit(panel = "audit") {

        if (!requireAuthentication()) return;


        const filters =
            state.filters[panel] || {};


        const query = new URLSearchParams();


        Object.entries(filters).forEach(([key, value]) => {

            query.set(key, value);

        });


        const endpointPanel =
            panel === "logins"
                ? "logins"
                : "audit";


        try {

            const response = await fetch(

                `${api(endpointPanel)}/export?${query.toString()}`,

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
                    `Export request failed (${response.status}).`
                );

            }


            const blob = await response.blob();

            const disposition =
                response.headers.get("content-disposition") || "";


            const filenameMatch =
                disposition.match(/filename="?([^"]+)"?/i);


            const filename =
                filenameMatch?.[1] ||
                `talvora-${endpointPanel}-export.csv`;


            const url = URL.createObjectURL(blob);

            const link = makeElement("a");

            link.href = url;

            link.download = filename;

            document.body.appendChild(link);

            link.click();

            link.remove();

            URL.revokeObjectURL(url);


            notify(
                "Export received from the server.",
                "success"
            );

        } catch (error) {

            notify(
                error.message,
                "error"
            );

        }

    }


    function initializeExports() {

        $$("[data-export-audit]").forEach(button => {

            button.addEventListener("click", () => {

                const panel =
                    state.activePanel === "logins"
                        ? "logins"
                        : "audit";

                exportAudit(panel);

            });

        });

    }


    /* =====================================================
       25. MODAL EVENTS
    ===================================================== */

    function initializeModals() {

        $$("[data-close-activity-modal]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    closeDetails
                );

            });


        $$("[data-close-incident-modal]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    closeIncidentForm
                );

            });


        $$("[data-close-confirm-modal]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    closeConfirmModal
                );

            });


        byId("activity-detail-modal")
            ?.addEventListener("click", event => {

                if (
                    event.target.id ===
                    "activity-detail-modal"
                ) {

                    closeDetails();

                }

            });


        byId("incident-modal")
            ?.addEventListener("click", event => {

                if (
                    event.target.id === "incident-modal"
                ) {

                    closeIncidentForm();

                }

            });


        byId("activity-confirm-modal")
            ?.addEventListener("click", event => {

                if (
                    event.target.id ===
                    "activity-confirm-modal"
                ) {

                    closeConfirmModal();

                }

            });


        document.addEventListener("keydown", event => {

            if (event.key === "Escape") {

                closeDetails();

                closeIncidentForm();

                closeConfirmModal();

                closeSidebar();

            }

        });


        byId("activity-confirm-submit")
            ?.addEventListener(
                "click",
                executeAction
            );


        byId("incident-create")
            ?.addEventListener(
                "click",
                openIncidentForm
            );


        byId("incident-create-form")
            ?.addEventListener(
                "submit",
                submitIncident
            );

    }


    /* =====================================================
       26. PAGINATION EVENTS
    ===================================================== */

    function initializePagination() {

        Object.keys(ENDPOINTS).forEach(panel => {

            byId(`${panel}-prev`)
                ?.addEventListener("click", () => {

                    changePage(panel, -1);

                });


            byId(`${panel}-next`)
                ?.addEventListener("click", () => {

                    changePage(panel, 1);

                });

        });

    }


    /* =====================================================
       27. REFRESH
    ===================================================== */

    async function refreshCurrentPanel() {

        if (!requireAuthentication()) return;

        if (state.refreshing) return;


        state.refreshing = true;


        const button = byId(
            "activity-refresh"
        );

        if (button) button.disabled = true;


        try {

            const panel = state.activePanel;


            delete state.records[panel];


            await loadPanel(panel, true);


            notify(
                "The latest available server records have been requested.",
                "success"
            );

        } finally {

            state.refreshing = false;

            if (button) button.disabled = false;

        }

    }


    /* =====================================================
       28. SECURITY INITIALIZATION
    ===================================================== */

    function initializeSecurityControls() {

        /*
         * This application is a frontend interface.
         *
         * It cannot establish whether an IP address,
         * geographic location, device or login is genuine.
         *
         * The backend must:
         *
         * 1. Authenticate every request.
         * 2. Enforce the Super Admin role.
         * 3. Validate the individual administrator identity.
         * 4. Protect session and CSRF controls.
         * 5. Enforce rate limits.
         * 6. Generate trusted timestamps.
         * 7. Preserve audit integrity.
         * 8. Revoke sessions server-side.
         * 9. Record privileged operations.
         * 10. Protect sensitive location and device data.
         */


        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.visibilityState === "visible" &&
                    state.authenticated
                ) {

                    /*
                     * Require fresh server authorization
                     * for subsequent privileged operations.
                     */

                    delete state.records.overview;

                }

            }
        );


        window.addEventListener("pagehide", () => {

            /*
             * Session security must not depend on browser
             * page lifecycle events.
             */

        });

    }


    /* =====================================================
       29. INITIALIZE APPLICATION
    ===================================================== */

    async function initialize() {

        initializeSidebar();

        initializeNavigation();

        initializeFilters();

        initializeModals();

        initializeExports();

        initializePagination();

        initializeSecurityControls();


        byId("activity-refresh")
            ?.addEventListener(
                "click",
                refreshCurrentPanel
            );


        const authenticated =
            await verifySession();


        if (!authenticated) {

            return;

        }


        await loadPanel("overview", true);


        console.info(
            "TALVORA Activity & Security Centre initialized."
        );

    }


    /* =====================================================
       30. START
    ===================================================== */

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            { once: true }
        );

    } else {

        initialize();

    }


})();
