
/* =========================================================
   TALVORA GLOBAL
   NOTIFICATIONS & COMMUNICATION CENTRE
   GSES SYSTEM 001

   NO DEMO DATA
   NO FAKE RECIPIENTS
   NO FAKE DELIVERY STATISTICS
   NO SIMULATED COMMUNICATIONS

   All actual operations require backend authorization.
========================================================= */

"use strict";

(() => {

    /* =====================================================
       01. CONFIGURATION
    ===================================================== */

    const CONFIG = Object.freeze({

        API: "/api/v1/admin/communications",

        SESSION: "/api/v1/auth/session",

        PAGE_SIZE: 25,

        TIMEOUT: 20000,

        PANELS: [
            "overview",
            "admin",
            "announcements",
            "composer",
            "system",
            "delivery",
            "audience",
            "oversight"
        ]

    });


    const ENDPOINTS = Object.freeze({

        overview: "/overview",

        admin: "/admin-notifications",

        announcements: "/announcements",

        system: "/system-messages",

        delivery: "/delivery-history",

        audience: "/audiences",

        oversight: "/oversight"

    });


    /* =====================================================
       02. APPLICATION STATE
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

        pendingAction: null,

        pendingPublication: null,

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


    function formatNumber(value) {

        if (
            typeof value !== "number" ||
            !Number.isFinite(value)
        ) {

            return "—";

        }

        return new Intl.NumberFormat().format(value);

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


    function referenceOf(item) {

        return item?.reference ||
            item?.deliveryReference ||
            item?.announcementReference ||
            item?.id ||
            null;

    }


    function safeText(value) {

        return value === null ||
            value === undefined
            ? ""
            : String(value);

    }


    /* =====================================================
       04. NOTIFICATIONS
    ===================================================== */

    function notify(message, type = "info") {

        const container = byId(
            "comm-toast-container"
        );

        if (!container) return;


        const toast = makeElement(
            "div",
            `comm-toast ${type}`,
            message
        );

        toast.setAttribute("role", "status");

        container.appendChild(toast);


        window.setTimeout(() => {

            toast.remove();

        }, 5000);

    }


    function notice(message, type = "info") {

        const element = byId("comm-notice");

        if (!element) return;

        element.className = `comm-notice ${type}`;

        element.textContent = message;

        show(element);

    }


    function clearNotice() {

        const element = byId("comm-notice");

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

        }, CONFIG.TIMEOUT);


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

                throw new Error(
                    "Your administrator session has expired. Please authenticate again."
                );

            }


            if (response.status === 403) {

                throw new Error(
                    "The server denied this communication operation."
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

                throw new Error(
                    "The server request timed out."
                );

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


    function endpoint(panel) {

        const path = ENDPOINTS[panel];

        if (!path) {

            throw new Error(
                `No API endpoint configured for ${panel}.`
            );

        }

        return CONFIG.API + path;

    }


    /* =====================================================
       06. AUTHENTICATION
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
                    "Access requires an authenticated Super Admin account.",
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


            setText("comm-admin-name", name);

            setText(
                "comm-admin-email",
                response.user.email
            );


            const initials = name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(part => part[0])
                .join("")
                .toUpperCase();


            setText("comm-admin-avatar", initials);

            setText(
                "comm-session-status",
                "Verified session"
            );


            $(".comm-status-dot")
                ?.classList.add("online");


            setText(
                "comm-data-status",
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


        $$(".comm-panel").forEach(section => {

            const active =
                section.id === `comm-panel-${panel}`;

            section.hidden = !active;

            section.classList.toggle("active", active);

        });


        $$(".comm-nav-link").forEach(link => {

            const active =
                link.dataset.commPanel === panel;

            link.classList.toggle("active", active);

            if (active) {

                link.setAttribute("aria-current", "page");

            } else {

                link.removeAttribute("aria-current");

            }

        });


        if (updateHash) {

            history.replaceState(
                null,
                "",
                `#${panel}`
            );

        }


        closeSidebar();

        clearNotice();

        if (panel !== "composer") {

            loadPanel(panel);

        }


        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    }


    function initializeNavigation() {

        $$(".comm-nav-link[data-comm-panel]")
            .forEach(link => {

                link.addEventListener("click", event => {

                    event.preventDefault();

                    navigate(link.dataset.commPanel);

                });

            });


        $$("[data-comm-panel]")
            .forEach(button => {

                if (
                    button.classList.contains("comm-nav-link")
                ) return;


                button.addEventListener("click", () => {

                    navigate(button.dataset.commPanel);

                });

            });


        const initial =
            location.hash.replace("#", "");


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

        byId("comm-sidebar")
            ?.classList.add("open");

        show(
            byId("comm-sidebar-overlay")
        );

        byId("comm-menu-toggle")
            ?.setAttribute("aria-expanded", "true");

    }


    function closeSidebar() {

        byId("comm-sidebar")
            ?.classList.remove("open");

        hide(
            byId("comm-sidebar-overlay")
        );

        byId("comm-menu-toggle")
            ?.setAttribute("aria-expanded", "false");

    }


    function initializeSidebar() {

        byId("comm-menu-toggle")
            ?.addEventListener("click", openSidebar);

        byId("comm-sidebar-close")
            ?.addEventListener("click", closeSidebar);

        byId("comm-sidebar-overlay")
            ?.addEventListener("click", closeSidebar);

    }


    /* =====================================================
       09. PANEL LOADING
    ===================================================== */

    async function loadPanel(panel, force = false) {

        if (!requireAuthentication()) return;


        if (
            panel === "composer"
        ) {

            return;

        }


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

                `${endpoint(panel)}?${query.toString()}`

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
                "comm-data-status",
                "Server data received"
            );

        } catch (error) {

            notice(
                `${label(panel)}: ${error.message}`,
                "warning"
            );

            setText(
                "comm-data-status",
                "Data unavailable"
            );

        } finally {

            state.loading.delete(panel);

        }

    }


    function renderPanel(panel, data) {

        const renderers = {

            overview: renderOverview,

            admin: renderAdminNotifications,

            announcements: renderAnnouncements,

            system: renderSystemMessages,

            delivery: renderDelivery,

            audience: renderAudience,

            oversight: renderOversight

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
            "comm-empty-cell",
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

        const badge = makeElement(
            "span",
            `comm-status ${normalize(value)}`,
            label(value)
        );

        cell.appendChild(badge);

        row.appendChild(cell);

    }


    function addPriority(row, value) {

        const cell = makeElement("td");

        const badge = makeElement(
            "span",
            `comm-priority ${normalize(value)}`,
            label(value)
        );

        cell.appendChild(badge);

        row.appendChild(cell);

    }


    function addButton(row, text, callback, danger = false) {

        const cell = makeElement("td");

        const button = makeElement(
            "button",
            `comm-row-button${danger ? " danger" : ""}`,
            text
        );

        button.type = "button";

        button.addEventListener("click", callback);

        cell.appendChild(button);

        row.appendChild(cell);

    }


    function addActions(row, actions) {

        const cell = makeElement("td");

        const wrapper = makeElement(
            "div",
            "comm-row-actions"
        );


        actions.forEach(action => {

            const button = makeElement(
                "button",
                `comm-row-button${action.danger ? " danger" : ""}`,
                action.text
            );

            button.type = "button";

            button.addEventListener(
                "click",
                action.callback
            );

            wrapper.appendChild(button);

        });


        cell.appendChild(wrapper);

        row.appendChild(cell);

    }


    /* =====================================================
       11. COMMUNICATION OVERVIEW
    ===================================================== */

    function renderOverview(data) {

        const metrics = data.metrics || {};


        const metricMap = {

            "metric-total-messages": metrics.totalMessages,

            "metric-delivered": metrics.delivered,

            "metric-pending": metrics.pending,

            "metric-failed": metrics.failed,

            "metric-announcements": metrics.activeAnnouncements,

            "metric-unread-admin": metrics.unreadAdminNotifications

        };


        Object.entries(metricMap).forEach(([id, value]) => {

            setText(
                id,
                value === undefined
                    ? "—"
                    : formatNumber(value)
            );

        });


        const portals = data.portalActivity || {};


        setText(
            "portal-admin-count",
            portals.superAdmin === undefined
                ? "—"
                : formatNumber(portals.superAdmin)
        );

        setText(
            "portal-employer-count",
            portals.employers === undefined
                ? "—"
                : formatNumber(portals.employers)
        );

        setText(
            "portal-employee-count",
            portals.employees === undefined
                ? "—"
                : formatNumber(portals.employees)
        );


        renderRecentCommunications(
            data.recentCommunications || []
        );


        renderDeliveryHealth(
            data.deliveryHealth || {}
        );

    }


    function renderRecentCommunications(items) {

        const body = clearTable(
            "overview-recent-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "overview-recent-body",
                6,
                "No recent communication records returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");

            addCell(row, referenceOf(item), true);

            addCell(row, item.subject);

            addCell(row, label(item.audience));

            addCell(row, label(item.channel));

            addStatus(row, item.status);

            addCell(
                row,
                formatDateTime(item.createdAt)
            );

            body.appendChild(row);

        });

    }


    function renderDeliveryHealth(data) {

        const container = byId(
            "overview-delivery-health"
        );

        if (!container) return;


        container.replaceChildren();


        const rows = [

            ["Delivered", data.delivered],

            ["Pending", data.pending],

            ["Failed", data.failed],

            ["Bounced", data.bounced],

            ["Delivery rate", data.deliveryRate]

        ];


        const available = rows.filter(
            ([, value]) => value !== undefined &&
                value !== null
        );


        if (!available.length) {

            container.appendChild(
                createEmptyState(
                    "◎",
                    "No delivery metrics returned",
                    "Delivery information will appear when provided by the backend."
                )
            );

            return;

        }


        available.forEach(([name, value]) => {

            const row = makeElement(
                "div",
                "comm-health-row"
            );

            row.appendChild(
                makeElement("strong", "", name)
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

    }


    function createEmptyState(symbol, title, description) {

        const empty = makeElement(
            "div",
            "comm-empty-state"
        );

        empty.appendChild(
            makeElement("span", "", symbol)
        );

        empty.appendChild(
            makeElement("strong", "", title)
        );

        empty.appendChild(
            makeElement("p", "", description)
        );

        return empty;

    }


    /* =====================================================
       12. ADMIN NOTIFICATIONS
    ===================================================== */

    function renderAdminNotifications(data) {

        const items = getItems(data);

        const body = clearTable(
            "admin-notifications-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "admin-notifications-body",
                8,
                "No administrator notifications returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");


            addCell(row, referenceOf(item), true);

            addCell(row, item.title || item.subject);

            addCell(row, label(item.category));

            addPriority(row, item.priority);

            addCell(
                row,
                item.recipient?.displayName ||
                item.recipient?.email
            );

            addCell(
                row,
                formatDateTime(item.createdAt)
            );

            addStatus(row, item.status);


            const actions = [

                {

                    text: "View",

                    callback: () => openDetails(
                        "admin",
                        referenceOf(item)
                    )

                }

            ];


            if (normalize(item.status) === "unread") {

                actions.push({

                    text: "Mark Read",

                    callback: () => confirmAction({

                        title: "Mark Notification as Read",

                        description:
                            "Submit a request to mark this administrator notification as read.",

                        panel: "admin",

                        reference: referenceOf(item),

                        action: "mark_read"

                    })

                });

            }


            addActions(row, actions);

            body.appendChild(row);

        });

    }


    /* =====================================================
       13. ANNOUNCEMENTS
    ===================================================== */

    function renderAnnouncements(data) {

        const items = getItems(data);

        const body = clearTable(
            "announcements-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "announcements-body",
                8,
                "No announcements returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");


            addCell(row, referenceOf(item), true);

            addCell(row, item.title || item.subject);

            addCell(row, label(item.audience));

            addCell(
                row,
                item.createdBy?.displayName
            );

            addCell(
                row,
                formatDateTime(item.publishAt)
            );

            addCell(
                row,
                formatDateTime(item.expiresAt)
            );

            addStatus(row, item.status);


            const actions = [

                {

                    text: "View",

                    callback: () => openDetails(
                        "announcements",
                        referenceOf(item)
                    )

                }

            ];


            if (
                ["draft", "scheduled", "paused"].includes(
                    normalize(item.status)
                )
            ) {

                actions.push({

                    text: "Publish",

                    callback: () => confirmPublication(item)

                });

            }


            if (normalize(item.status) === "published") {

                actions.push({

                    text: "Pause",

                    callback: () => confirmAction({

                        title: "Pause Announcement",

                        description:
                            "Request server-side suspension of this published announcement.",

                        panel: "announcements",

                        reference: referenceOf(item),

                        action: "pause"

                    })

                });

            }


            if (
                ["published", "paused", "scheduled"].includes(
                    normalize(item.status)
                )
            ) {

                actions.push({

                    text: "Archive",

                    danger: true,

                    callback: () => confirmAction({

                        title: "Archive Announcement",

                        description:
                            "Request archival of this announcement while preserving its historical records.",

                        panel: "announcements",

                        reference: referenceOf(item),

                        action: "archive"

                    })

                });

            }


            addActions(row, actions);

            body.appendChild(row);

        });

    }


    /* =====================================================
       14. MESSAGE COMPOSER
    ===================================================== */

    function openComposer(type) {

        if (!requireAuthentication()) return;


        navigate("composer");


        const form = byId("communication-form");

        if (type && form) {

            byId("compose-type").value = type;

        }


        updateAudienceControls();

        updateScheduleControls();

        updatePreview();

    }


    function initializeComposer() {

        $$("[data-open-composer]").forEach(button => {

            button.addEventListener("click", () => {

                openComposer(
                    button.dataset.composeType || ""
                );

            });

        });


        const form = byId("communication-form");

        if (!form) return;


        form.addEventListener("input", updatePreview);

        form.addEventListener("change", () => {

            updatePreview();

            updateAudienceControls();

            updateScheduleControls();

        });


        byId("compose-preview")
            ?.addEventListener("click", () => {

                updatePreview();

                notify(
                    "Preview updated. No communication has been sent.",
                    "info"
                );

            });


        byId("compose-save-draft")
            ?.addEventListener("click", saveDraft);


        form.addEventListener(
            "submit",
            submitCommunication
        );

    }


    function updatePreview() {

        setText(
            "preview-subject",
            byId("compose-subject")?.value.trim() ||
            "Your subject will appear here"
        );


        setText(
            "preview-body",
            byId("compose-body")?.value ||
            "Your message content will appear here."
        );


        setText(
            "preview-type",
            label(
                byId("compose-type")?.value ||
                "message type"
            )
        );

    }


    /* =====================================================
       15. AUDIENCE CONTROLS
    ===================================================== */

    function updateAudienceControls() {

        const audience =
            byId("compose-audience")?.value;


        const details = byId(
            "comm-audience-details"
        );


        const scope = byId(
            "compose-recipient-scope"
        );


        const segment = byId(
            "comm-segment-controls"
        );


        const selected = byId(
            "comm-selected-recipients"
        );


        if (!audience) {

            hide(details);

            return;

        }


        show(details);


        const scopeValue = scope?.value || "all";


        if (scopeValue === "segment") {

            show(segment);

        } else {

            hide(segment);

        }


        if (scopeValue === "selected") {

            show(selected);

        } else {

            hide(selected);

        }

    }


    /* =====================================================
       16. DELIVERY SCHEDULE
    ===================================================== */

    function updateScheduleControls() {

        const mode =
            byId("compose-delivery-mode")?.value;


        const fields = byId(
            "comm-schedule-fields"
        );


        const date = byId(
            "compose-scheduled-at"
        );


        if (mode === "scheduled") {

            show(fields);

            if (date) date.required = true;

        } else {

            hide(fields);

            if (date) {

                date.required = false;

                date.value = "";

            }

        }

    }


    /* =====================================================
       17. BUILD COMMUNICATION PAYLOAD
    ===================================================== */

    function buildPayload(form, forceDraft = false) {

        const formData = new FormData(form);


        const channels =
            formData.getAll("channels");


        const audience =
            formData.get("audience");


        const recipientScope =
            formData.get("recipientScope") || "all";


        const rawReferences =
            formData.get("recipientReferences") || "";


        const references = rawReferences
            .split(/\r?\n/)
            .map(value => value.trim())
            .filter(Boolean);


        const payload = {

            type: formData.get("type"),

            subject: formData.get("subject")?.trim(),

            body: formData.get("body")?.trim(),

            audience,

            recipientScope,

            segment:
                recipientScope === "segment"
                    ? formData.get("segment")
                    : null,

            recipientReferences:
                recipientScope === "selected"
                    ? references
                    : [],

            channels,

            deliveryMode:
                forceDraft
                    ? "draft"
                    : formData.get("deliveryMode"),

            scheduledAt:
                forceDraft
                    ? null
                    : formData.get("scheduledAt") || null,

            priority: formData.get("priority"),

            requiresAcknowledgement:
                formData.get("requiresAcknowledgement") === "true"

        };


        return payload;

    }


    function validatePayload(payload) {

        if (!payload.type) {

            throw new Error(
                "Select a communication type."
            );

        }


        if (!payload.subject || payload.subject.length > 180) {

            throw new Error(
                "Enter a valid subject."
            );

        }


        if (!payload.body || payload.body.length < 5) {

            throw new Error(
                "Enter message content."
            );

        }


        if (!payload.audience) {

            throw new Error(
                "Select a target portal."
            );

        }


        if (!payload.channels.length) {

            throw new Error(
                "Select at least one delivery channel."
            );

        }


        if (
            payload.recipientScope === "selected" &&
            payload.recipientReferences.length === 0
        ) {

            throw new Error(
                "Provide at least one recipient reference."
            );

        }


        if (
            payload.recipientScope === "segment" &&
            !payload.segment
        ) {

            throw new Error(
                "Select a recipient segment."
            );

        }


        if (
            payload.deliveryMode === "scheduled" &&
            !payload.scheduledAt
        ) {

            throw new Error(
                "Select a scheduled delivery time."
            );

        }


        if (
            payload.audience === "all_portals" &&
            payload.recipientScope !== "all"
        ) {

            throw new Error(
                "Cross-portal communication requires backend-defined audience authorization. Use an approved distribution scope."
            );

        }


        if (
            payload.type === "admin_notification" &&
            payload.audience !== "super_admin"
        ) {

            throw new Error(
                "Administrator notifications must target the Super Admin Portal."
            );

        }


        if (
            payload.type === "announcement" &&
            payload.audience === "super_admin"
        ) {

            throw new Error(
                "Use an administrator notification for internal Super Admin communication."
            );

        }


        return true;

    }


    /* =====================================================
       18. SAVE DRAFT
    ===================================================== */

    async function saveDraft() {

        if (!requireAuthentication()) return;


        const form = byId("communication-form");


        try {

            const payload = buildPayload(form, true);


            if (
                !payload.subject ||
                !payload.type ||
                !payload.body
            ) {

                throw new Error(
                    "Enter the communication type, subject and message content before saving."
                );

            }


            const button = byId("compose-save-draft");

            button.disabled = true;


            const response = await request(

                `${CONFIG.API}/drafts`,

                {

                    method: "POST",

                    body: payload

                }

            );


            notify(
                response.message ||
                "The server confirmed that the draft was saved.",
                "success"
            );


            state.records.announcements = null;

        } catch (error) {

            notify(error.message, "error");

        } finally {

            const button = byId("compose-save-draft");

            if (button) button.disabled = false;

        }

    }


    /* =====================================================
       19. SUBMIT COMMUNICATION
    ===================================================== */

    async function submitCommunication(event) {

        event.preventDefault();


        if (!requireAuthentication()) return;


        const form = event.currentTarget;

        if (!form.reportValidity()) return;


        const button = byId("compose-submit");

        button.disabled = true;


        try {

            const payload = buildPayload(form);

            validatePayload(payload);


            const response = await request(

                `${CONFIG.API}/communications`,

                {

                    method: "POST",

                    body: payload

                }

            );


            /*
             * This is a submission acknowledgement,
             * not proof of recipient delivery.
             */


            notify(
                response.message ||
                "The server accepted the communication request.",
                "success"
            );


            if (response.reference) {

                notify(
                    `Communication reference: ${response.reference}`,
                    "info"
                );

            }


            form.reset();

            updatePreview();

            updateAudienceControls();

            updateScheduleControls();


            state.records.overview = null;

            state.records.delivery = null;


            navigate("delivery");

        } catch (error) {

            notify(error.message, "error");

        } finally {

            button.disabled = false;

        }

    }


    /* =====================================================
       20. PUBLICATION CONFIRMATION
    ===================================================== */

    function confirmPublication(item) {

        if (!requireAuthentication()) return;


        state.pendingPublication = {

            reference: referenceOf(item),

            title: item.title || item.subject

        };


        state.lastFocus = document.activeElement;


        setText(
            "comm-publish-title",
            "Confirm Announcement Publication"
        );


        setText(
            "comm-publish-description",
            `You are requesting publication of "${item.title || item.subject}" to ${label(item.audience)}.`
        );


        const reason = byId(
            "comm-publish-reason"
        );

        if (reason) reason.value = "";


        show(
            byId("comm-publish-modal")
        );

        reason?.focus();

    }


    function closePublicationModal() {

        hide(
            byId("comm-publish-modal")
        );


        state.pendingPublication = null;

        state.lastFocus?.focus?.();

        state.lastFocus = null;

    }


    async function executePublication() {

        if (!requireAuthentication()) return;


        const item = state.pendingPublication;

        if (!item) return;


        const reason = byId(
            "comm-publish-reason"
        )?.value.trim();


        if (!reason || reason.length < 10) {

            notify(
                "Provide a publication justification of at least 10 characters.",
                "warning"
            );

            return;

        }


        const button = byId(
            "comm-publish-submit"
        );

        button.disabled = true;


        try {

            const response = await request(

                `${endpoint("announcements")}/${encodeURIComponent(item.reference)}/publish`,

                {

                    method: "POST",

                    body: {

                        reason

                    }

                }

            );


            notify(
                response.message ||
                "The server confirmed the publication operation.",
                "success"
            );


            closePublicationModal();


            delete state.records.announcements;

            delete state.records.overview;


            await loadPanel("announcements", true);

            await loadPanel("overview", true);

        } catch (error) {

            notify(error.message, "error");

        } finally {

            button.disabled = false;

        }

    }


    /* =====================================================
       21. GENERIC ADMINISTRATIVE ACTIONS
    ===================================================== */

    function confirmAction(action) {

        if (!requireAuthentication()) return;


        state.pendingAction = action;

        state.lastFocus = document.activeElement;


        setText(
            "comm-confirm-title",
            action.title
        );


        setText(
            "comm-confirm-description",
            action.description
        );


        const reason = byId(
            "comm-confirm-reason"
        );

        if (reason) reason.value = "";


        show(
            byId("comm-confirm-modal")
        );

        reason?.focus();

    }


    function closeConfirmModal() {

        hide(
            byId("comm-confirm-modal")
        );


        state.pendingAction = null;

        state.lastFocus?.focus?.();

        state.lastFocus = null;

    }


    async function executeAction() {

        if (!requireAuthentication()) return;


        const action = state.pendingAction;

        if (!action) return;


        const reason = byId(
            "comm-confirm-reason"
        )?.value.trim();


        if (!reason || reason.length < 10) {

            notify(
                "Provide an administrative justification of at least 10 characters.",
                "warning"
            );

            return;

        }


        const button = byId(
            "comm-confirm-submit"
        );

        button.disabled = true;


        try {

            const response = await request(

                `${endpoint(action.panel)}/${encodeURIComponent(action.reference)}/actions`,

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

            await loadPanel("overview", true);

        } catch (error) {

            notify(error.message, "error");

        } finally {

            button.disabled = false;

        }

    }


    /* =====================================================
       22. SYSTEM MESSAGES
    ===================================================== */

    function renderSystemMessages(data) {

        const items = getItems(data);

        const body = clearTable(
            "system-messages-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "system-messages-body",
                8,
                "No system message templates returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");


            addCell(row, referenceOf(item), true);

            addCell(row, item.name);

            addCell(row, item.trigger);

            addCell(row, label(item.portal));

            addCell(
                row,
                Array.isArray(item.channels)
                    ? item.channels.map(label).join(", ")
                    : item.channels
            );

            addCell(
                row,
                formatDateTime(item.lastTriggeredAt)
            );

            addStatus(row, item.status);


            const actions = [

                {

                    text: "Details",

                    callback: () => openDetails(
                        "system",
                        referenceOf(item)
                    )

                }

            ];


            if (normalize(item.status) === "active") {

                actions.push({

                    text: "Pause",

                    danger: true,

                    callback: () => confirmAction({

                        title: "Pause System Message Template",

                        description:
                            "Request the backend to pause this automated message template. Existing queued deliveries may require separate handling.",

                        panel: "system",

                        reference: referenceOf(item),

                        action: "pause"

                    })

                });

            } else if (
                ["paused", "disabled"].includes(
                    normalize(item.status)
                )
            ) {

                actions.push({

                    text: "Enable",

                    callback: () => confirmAction({

                        title: "Enable System Message Template",

                        description:
                            "Request activation of this automated message template.",

                        panel: "system",

                        reference: referenceOf(item),

                        action: "enable"

                    })

                });

            }


            addActions(row, actions);

            body.appendChild(row);

        });

    }


    /* =====================================================
       23. DELIVERY HISTORY
    ===================================================== */

    function renderDelivery(data) {

        const items = getItems(data);

        const body = clearTable(
            "delivery-history-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "delivery-history-body",
                9,
                "No communication delivery records returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");


            addCell(row, referenceOf(item), true);

            addCell(
                row,
                item.communication?.subject ||
                item.subject
            );

            addCell(
                row,
                item.recipient?.reference ||
                item.recipient?.maskedContact ||
                item.recipientReference
            );

            addCell(row, label(item.portal));

            addCell(row, label(item.channel));

            addCell(
                row,
                item.attemptCount === undefined
                    ? "—"
                    : formatNumber(item.attemptCount)
            );

            addCell(
                row,
                formatDateTime(item.lastAttemptAt)
            );

            addStatus(row, item.status);


            addButton(
                row,
                "Details",
                () => openDetails(
                    "delivery",
                    referenceOf(item)
                )
            );


            body.appendChild(row);

        });


        updatePagination("delivery", data);

    }


    /* =====================================================
       24. AUDIENCE MANAGEMENT
    ===================================================== */

    function renderAudience(data) {

        const items = getItems(data);

        const body = clearTable(
            "audience-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "audience-body",
                8,
                "No audience segments returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");


            addCell(row, referenceOf(item), true);

            addCell(row, item.name);

            addCell(row, label(item.portal));

            addCell(
                row,
                item.eligibilityDescription ||
                item.eligibilityRule
            );

            addCell(
                row,
                item.recipientCount === undefined
                    ? "—"
                    : formatNumber(item.recipientCount)
            );

            addCell(
                row,
                formatDateTime(item.updatedAt)
            );

            addStatus(row, item.status);


            addButton(
                row,
                "Details",
                () => openDetails(
                    "audience",
                    referenceOf(item)
                )
            );


            body.appendChild(row);

        });

    }


    /* =====================================================
       25. COMMUNICATION OVERSIGHT
    ===================================================== */

    function renderOversight(data) {

        renderOversightList(
            "oversight-channels",
            data.channels || [],
            "No channel configuration returned."
        );


        renderOversightList(
            "oversight-consent",
            data.consentControls || [],
            "No consent compliance data returned."
        );


        renderOversightList(
            "oversight-controls",
            data.communicationControls || [],
            "No communication controls returned."
        );


        renderOversightList(
            "oversight-providers",
            data.providers || [],
            "No delivery provider information returned."
        );


        renderCommunicationAudit(
            data.auditRecords || []
        );

    }


    function renderOversightList(id, items, emptyMessage) {

        const container = byId(id);

        if (!container) return;


        container.replaceChildren();


        if (!items.length) {

            container.appendChild(
                createEmptyState(
                    "◎",
                    "No records returned",
                    emptyMessage
                )
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement(
                "div",
                "comm-health-row"
            );


            const details = makeElement("div");

            details.appendChild(
                makeElement(
                    "strong",
                    "",
                    item.name || item.label || item.category
                )
            );


            if (item.description) {

                details.appendChild(
                    makeElement(
                        "small",
                        "",
                        item.description
                    )
                );

            }


            const status = makeElement(
                "span",
                `comm-status ${normalize(item.status)}`,
                label(item.status)
            );


            row.append(details, status);

            container.appendChild(row);

        });

    }


    function renderCommunicationAudit(items) {

        const body = clearTable(
            "communication-audit-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "communication-audit-body",
                7,
                "No communication audit records returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");


            addCell(row, referenceOf(item), true);

            addCell(
                row,
                item.administrator?.displayName
            );

            addCell(row, item.operation);

            addCell(row, item.targetReference);

            addCell(row, item.reason);

            addCell(
                row,
                formatDateTime(item.timestamp)
            );

            addStatus(row, item.outcome);


            body.appendChild(row);

        });

    }


    /* =====================================================
       26. DETAIL MODAL
    ===================================================== */

    async function openDetails(panel, reference) {

        if (!requireAuthentication()) return;

        if (!reference) return;


        state.lastFocus = document.activeElement;


        const modal = byId("comm-detail-modal");

        const content = byId("comm-detail-content");


        content.replaceChildren();


        setText(
            "comm-detail-title",
            "Loading Record"
        );


        show(modal);


        try {

            const response = await request(

                `${endpoint(panel)}/${encodeURIComponent(reference)}`

            );


            const record =
                response.record || response;


            setText(
                "comm-detail-title",
                record.title ||
                record.subject ||
                record.name ||
                record.reference ||
                "Communication Details"
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
                    "comm-detail-row"
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
                    "No additional details were returned.";

            }

        } catch (error) {

            content.textContent = error.message;

        }

    }


    function closeDetails() {

        hide(byId("comm-detail-modal"));

        state.lastFocus?.focus?.();

        state.lastFocus = null;

    }


    /* =====================================================
       27. FILTERING
    ===================================================== */

    const FILTERS = {

        admin: [

            "admin-search",

            "admin-notification-status",

            "admin-notification-type"

        ],

        announcements: [

            "announcement-search",

            "announcement-audience",

            "announcement-status"

        ],

        system: [

            "system-search",

            "system-category",

            "system-status"

        ],

        delivery: [

            "delivery-search",

            "delivery-channel",

            "delivery-status",

            "delivery-portal",

            "delivery-from",

            "delivery-to"

        ],

        audience: [

            "audience-search",

            "audience-portal",

            "audience-category"

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
            filters["delivery-from"] &&
            filters["delivery-to"] &&
            filters["delivery-from"] >
            filters["delivery-to"]
        ) {

            notify(
                "The start date cannot be later than the end date.",
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

                `${endpoint(panel)}?${query.toString()}`

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

            "admin-notification-apply": "admin",

            "announcement-apply": "announcements",

            "system-apply": "system",

            "delivery-apply": "delivery",

            "audience-apply": "audience"

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
       28. PAGINATION
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


        state.pages[panel] = Math.max(

            1,

            (state.pages[panel] || 1) + direction

        );


        delete state.records[panel];

        await loadPanel(panel);

    }


    function initializePagination() {

        byId("delivery-prev")
            ?.addEventListener("click", () => {

                changePage("delivery", -1);

            });


        byId("delivery-next")
            ?.addEventListener("click", () => {

                changePage("delivery", 1);

            });

    }


    /* =====================================================
       29. EXPORT
    ===================================================== */

    async function exportCommunications() {

        if (!requireAuthentication()) return;


        const panel =
            state.activePanel === "delivery"
                ? "delivery"
                : "announcements";


        const filters =
            state.filters[panel] || {};


        const query = new URLSearchParams();


        Object.entries(filters).forEach(([key, value]) => {

            query.set(key, value);

        });


        try {

            const response = await fetch(

                `${endpoint(panel)}/export?${query.toString()}`,

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
                    `Export failed (${response.status}).`
                );

            }


            const blob = await response.blob();


            const disposition =
                response.headers.get("content-disposition") || "";


            const match =
                disposition.match(/filename="?([^"]+)"?/i);


            const filename =
                match?.[1] ||
                `talvora-${panel}-export.csv`;


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

            notify(error.message, "error");

        }

    }


    function initializeExports() {

        $$("[data-export-communications]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    exportCommunications
                );

            });

    }


    /* =====================================================
       30. MODAL EVENTS
    ===================================================== */

    function initializeModals() {

        $$("[data-close-comm-modal]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    closeDetails
                );

            });


        $$("[data-close-confirm]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    closeConfirmModal
                );

            });


        $$("[data-close-publish]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    closePublicationModal
                );

            });


        byId("comm-detail-modal")
            ?.addEventListener("click", event => {

                if (event.target.id === "comm-detail-modal") {

                    closeDetails();

                }

            });


        byId("comm-confirm-modal")
            ?.addEventListener("click", event => {

                if (event.target.id === "comm-confirm-modal") {

                    closeConfirmModal();

                }

            });


        byId("comm-publish-modal")
            ?.addEventListener("click", event => {

                if (event.target.id === "comm-publish-modal") {

                    closePublicationModal();

                }

            });


        byId("comm-confirm-submit")
            ?.addEventListener(
                "click",
                executeAction
            );


        byId("comm-publish-submit")
            ?.addEventListener(
                "click",
                executePublication
            );


        document.addEventListener("keydown", event => {

            if (event.key === "Escape") {

                closeDetails();

                closeConfirmModal();

                closePublicationModal();

                closeSidebar();

            }

        });

    }


    /* =====================================================
       31. REFRESH
    ===================================================== */

    async function refreshCurrentPanel() {

        if (!requireAuthentication()) return;

        if (state.refreshing) return;


        state.refreshing = true;


        const button = byId("comm-refresh");

        if (button) button.disabled = true;


        try {

            const panel = state.activePanel;


            if (panel === "composer") {

                notify(
                    "Composer content is unchanged. No message was sent.",
                    "info"
                );

                return;

            }


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
       32. SECURITY & PRIVACY CONTROLS
    ===================================================== */

    function initializeSecurityControls() {

        /*
         * Important backend requirements:
         *
         * 1. Validate Super Admin identity on every request.
         *
         * 2. Never trust recipient counts submitted by
         *    the browser.
         *
         * 3. Resolve recipient references server-side.
         *
         * 4. Revalidate audience eligibility at dispatch.
         *
         * 5. Respect channel-specific consent and preferences.
         *
         * 6. Enforce email and SMS rate limits.
         *
         * 7. Prevent duplicate dispatches through idempotency.
         *
         * 8. Keep provider credentials on the server.
         *
         * 9. Distinguish accepted, sent and delivered states.
         *
         * 10. Keep message content and recipient information
         *     protected in delivery and audit records.
         *
         * 11. Record the administrator responsible for
         *     every privileged communication operation.
         *
         * 12. Protect all-portal announcements against
         *     accidental mass distribution.
         *
         * 13. Maintain immutable communication audit history.
         *
         * 14. Apply retention and privacy requirements.
         */


        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.visibilityState === "visible" &&
                    state.authenticated
                ) {

                    delete state.records.overview;

                }

            }
        );

    }


    /* =====================================================
       33. INITIALIZE APPLICATION
    ===================================================== */

    async function initialize() {

        initializeSidebar();

        initializeNavigation();

        initializeComposer();

        initializeFilters();

        initializeModals();

        initializePagination();

        initializeExports();

        initializeSecurityControls();


        byId("comm-refresh")
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
            "TALVORA Notifications & Communication Centre initialized."
        );

    }


    /* =====================================================
       34. START
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
