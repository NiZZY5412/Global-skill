
/* =========================================================
   TALVORA GLOBAL
   SUPER ADMIN SUPPORT & HELPDESK CENTRE
   GSES SYSTEM 001

   NO DEMO DATA
   NO FAKE USERS
   NO FAKE TICKETS
   NO SIMULATED MESSAGES
   NO FABRICATED ANALYTICS

   Backend integration required for all real operations.
========================================================= */

"use strict";

(() => {

    /* =====================================================
       01. CONFIGURATION
    ===================================================== */

    const CONFIG = Object.freeze({

        API: "/api/v1/admin/support",

        SESSION: "/api/v1/auth/session",

        PAGE_SIZE: 25,

        REQUEST_TIMEOUT: 20000,

        PANELS: [
            "overview",
            "tickets",
            "detail",
            "escalations",
            "assignments",
            "knowledge",
            "analytics",
            "audit"
        ]

    });


    const ENDPOINTS = Object.freeze({

        overview: "/overview",

        tickets: "/tickets",

        escalations: "/escalations",

        assignments: "/assignments",

        administrators: "/administrators",

        knowledge: "/knowledge-base",

        analytics: "/analytics",

        audit: "/audit"

    });


    /* =====================================================
       02. APPLICATION STATE
    ===================================================== */

    const state = {

        authenticated: false,

        administrator: null,

        csrfToken: null,

        activePanel: "overview",

        activeTicket: null,

        activeTicketReference: null,

        loading: new Set(),

        records: {},

        pages: {},

        filters: {},

        administrators: [],

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


    function formatDuration(value) {

        if (value === undefined || value === null) {
            return "—";
        }

        if (typeof value === "number") {

            return `${value} minutes`;

        }

        return String(value);

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
            item?.ticketReference ||
            item?.id ||
            null;

    }


    function safePath(base, reference) {

        if (!reference) {

            throw new Error(
                "A valid record reference is required."
            );

        }

        return `${base}/${encodeURIComponent(reference)}`;

    }


    /* =====================================================
       04. NOTIFICATIONS
    ===================================================== */

    function notify(message, type = "info") {

        const container = byId(
            "support-toast-container"
        );

        if (!container) return;


        const toast = makeElement(
            "div",
            `support-toast ${type}`,
            message
        );

        toast.setAttribute("role", "status");

        container.appendChild(toast);


        window.setTimeout(() => {

            toast.remove();

        }, 5000);

    }


    function notice(message, type = "info") {

        const element = byId("support-notice");

        if (!element) return;

        element.className = `support-notice ${type}`;

        element.textContent = message;

        show(element);

    }


    function clearNotice() {

        const element = byId("support-notice");

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

                throw new Error(
                    "Your administrator session has expired. Authenticate again."
                );

            }


            if (response.status === 403) {

                throw new Error(
                    "The server denied this administrative operation."
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
                    "Unable to reach the TALVORA backend. The operation has not been confirmed."
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
                    "Access requires an authenticated TALVORA Super Admin account.",
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


            setText("support-admin-name", name);

            setText(
                "support-admin-email",
                response.user.email
            );


            const initials = name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(part => part[0])
                .join("")
                .toUpperCase();


            setText("support-admin-avatar", initials);


            setText(
                "support-connection-text",
                "Verified session"
            );


            $(".support-status-dot")
                ?.classList.add("online");


            $(".support-connection-dot")
                ?.classList.add("online");


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


        $$(".support-panel").forEach(section => {

            const active =
                section.id === `support-panel-${panel}`;

            section.hidden = !active;

            section.classList.toggle("active", active);

        });


        $$(".support-nav-link[data-support-panel]")
            .forEach(link => {

                const active =
                    link.dataset.supportPanel === panel;

                link.classList.toggle("active", active);

                if (active) {

                    link.setAttribute(
                        "aria-current",
                        "page"
                    );

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


        if (panel !== "detail") {

            loadPanel(panel);

        }


        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    }


    function initializeNavigation() {

        $$(".support-nav-link[data-support-panel]")
            .forEach(link => {

                link.addEventListener("click", event => {

                    event.preventDefault();

                    navigate(
                        link.dataset.supportPanel
                    );

                });

            });


        $$("[data-support-panel]")
            .forEach(button => {

                if (
                    button.classList.contains("support-nav-link")
                ) return;


                button.addEventListener("click", () => {

                    navigate(
                        button.dataset.supportPanel
                    );

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

        byId("support-sidebar")
            ?.classList.add("open");

        show(
            byId("support-sidebar-overlay")
        );

        byId("support-menu-toggle")
            ?.setAttribute("aria-expanded", "true");

    }


    function closeSidebar() {

        byId("support-sidebar")
            ?.classList.remove("open");

        hide(
            byId("support-sidebar-overlay")
        );

        byId("support-menu-toggle")
            ?.setAttribute("aria-expanded", "false");

    }


    function initializeSidebar() {

        byId("support-menu-toggle")
            ?.addEventListener("click", openSidebar);

        byId("support-sidebar-close")
            ?.addEventListener("click", closeSidebar);

        byId("support-sidebar-overlay")
            ?.addEventListener("click", closeSidebar);

    }


    /* =====================================================
       09. PANEL LOADING
    ===================================================== */

    async function loadPanel(panel, force = false) {

        if (!requireAuthentication()) return;

        if (panel === "detail") return;


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
                "support-connection-text",
                "Live server data"
            );

        } catch (error) {

            notice(
                `${label(panel)}: ${error.message}`,
                "warning"
            );

        } finally {

            state.loading.delete(panel);

        }

    }


    function renderPanel(panel, data) {

        const renderers = {

            overview: renderOverview,

            tickets: renderTickets,

            escalations: renderEscalations,

            assignments: renderAssignments,

            knowledge: renderKnowledge,

            analytics: renderAnalytics,

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
            "support-empty-cell",
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

        cell.appendChild(
            makeElement(
                "span",
                `support-status ${normalize(value)}`,
                label(value)
            )
        );

        row.appendChild(cell);

    }


    function addPriority(row, value) {

        const cell = makeElement("td");

        cell.appendChild(
            makeElement(
                "span",
                `support-priority ${normalize(value)}`,
                label(value)
            )
        );

        row.appendChild(cell);

    }


    function addActions(row, actions) {

        const cell = makeElement("td");

        const wrapper = makeElement(
            "div",
            "support-row-actions"
        );


        actions.forEach(action => {

            const button = makeElement(
                "button",
                `support-row-button${action.danger ? " danger" : ""}`,
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


    function createEmptyState(symbol, title, description) {

        const empty = makeElement(
            "div",
            "support-empty-state"
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
       11. OVERVIEW
    ===================================================== */

    function renderOverview(data) {

        const metrics = data.metrics || {};


        const metricMap = {

            "metric-total-tickets": metrics.totalTickets,

            "metric-open-tickets": metrics.openTickets,

            "metric-unassigned": metrics.unassignedTickets,

            "metric-escalated": metrics.escalatedTickets,

            "metric-resolved": metrics.resolvedTickets,

            "metric-high-priority": metrics.highPriorityTickets

        };


        Object.entries(metricMap).forEach(([id, value]) => {

            setText(
                id,
                value === undefined
                    ? "—"
                    : formatNumber(value)
            );

        });


        const portals = data.portalDistribution || {};


        setText(
            "portal-employer-tickets",
            portals.employers === undefined
                ? "—"
                : formatNumber(portals.employers)
        );

        setText(
            "portal-employee-tickets",
            portals.employees === undefined
                ? "—"
                : formatNumber(portals.employees)
        );

        setText(
            "portal-admin-tickets",
            portals.superAdmins === undefined
                ? "—"
                : formatNumber(portals.superAdmins)
        );


        renderRecentTickets(
            data.recentTickets || []
        );


        renderOperationalHealth(
            data.operationalHealth || {}
        );

    }


    function renderRecentTickets(items) {

        const body = clearTable(
            "overview-recent-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "overview-recent-body",
                6,
                "No support ticket records returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");


            addCell(row, referenceOf(item), true);

            addCell(row, item.subject);

            addCell(row, label(item.portal));

            addPriority(row, item.priority);

            addStatus(row, item.status);

            addCell(
                row,
                formatDateTime(item.createdAt)
            );


            row.addEventListener("click", () => {

                openTicket(referenceOf(item));

            });

            body.appendChild(row);

        });

    }


    function renderOperationalHealth(data) {

        const container = byId(
            "overview-operational-health"
        );

        if (!container) return;


        container.replaceChildren();


        const rows = [

            ["First response time", data.firstResponseTime],

            ["Average resolution", data.averageResolutionTime],

            ["SLA compliance", data.slaCompliance],

            ["Overdue tickets", data.overdueTickets],

            ["Customer satisfaction", data.customerSatisfaction]

        ];


        const available = rows.filter(
            ([, value]) =>
                value !== undefined &&
                value !== null
        );


        if (!available.length) {

            container.appendChild(
                createEmptyState(
                    "◎",
                    "No operational data returned",
                    "Live operational metrics will appear when supplied by the backend."
                )
            );

            return;

        }


        available.forEach(([name, value]) => {

            const row = makeElement(
                "div",
                "support-health-row"
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


    /* =====================================================
       12. TICKET FILTERS
    ===================================================== */

    const TICKET_FILTER_IDS = [

        "tickets-search",

        "tickets-portal",

        "tickets-status",

        "tickets-priority",

        "tickets-category"

    ];


    function collectTicketFilters() {

        const filters = {};


        TICKET_FILTER_IDS.forEach(id => {

            const element = byId(id);

            if (
                element &&
                element.value.trim()
            ) {

                filters[id] = element.value.trim();

            }

        });


        return filters;

    }


    function buildQuery(filters, page = 1) {

        const query = new URLSearchParams({

            page: String(page),

            pageSize: String(CONFIG.PAGE_SIZE)

        });


        Object.entries(filters).forEach(([key, value]) => {

            query.set(key, value);

        });


        return query;

    }


    async function applyTicketFilters() {

        if (!requireAuthentication()) return;


        state.filters.tickets =
            collectTicketFilters();

        state.pages.tickets = 1;


        await loadFilteredPanel("tickets");

    }


    async function resetTicketFilters() {

        TICKET_FILTER_IDS.forEach(id => {

            const element = byId(id);

            if (element) element.value = "";

        });


        state.filters.tickets = {};

        state.pages.tickets = 1;


        delete state.records.tickets;

        await loadPanel("tickets");

    }


    async function loadFilteredPanel(panel) {

        if (!requireAuthentication()) return;


        try {

            const filters =
                state.filters[panel] || {};


            const query = buildQuery(
                filters,
                state.pages[panel] || 1
            );


            const response = await request(

                `${endpoint(panel)}?${query.toString()}`

            );


            state.records[panel] = response;

            renderPanel(panel, response);

        } catch (error) {

            notify(error.message, "error");

        }

    }


    /* =====================================================
       13. ALL TICKETS
    ===================================================== */

    function renderTickets(data) {

        const items = getItems(data);

        const body = clearTable(
            "tickets-table-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "tickets-table-body",
                10,
                "No matching support tickets returned."
            );

            updatePagination("tickets", data);

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");


            addCell(row, referenceOf(item), true);

            addCell(row, item.subject);


            addCell(
                row,
                item.requester?.displayName ||
                item.requester?.reference ||
                item.requesterReference
            );


            addCell(row, label(item.portal));

            addCell(row, label(item.category));

            addPriority(row, item.priority);


            addCell(
                row,
                item.assignedAdministrator?.displayName ||
                item.assignedAdministrator?.email
            );


            addStatus(row, item.status);


            addCell(
                row,
                formatDateTime(item.createdAt)
            );


            addActions(row, [

                {

                    text: "View",

                    callback: () => openTicket(
                        referenceOf(item)
                    )

                },

                {

                    text: "Assign",

                    callback: () => openAssignment(
                        referenceOf(item)
                    )

                }

            ]);


            body.appendChild(row);

        });


        updatePagination("tickets", data);

    }


    /* =====================================================
       14. TICKET DETAILS
    ===================================================== */

    async function openTicket(reference) {

        if (!requireAuthentication()) return;


        if (!reference) {

            notify(
                "A valid ticket reference is required.",
                "error"
            );

            return;

        }


        state.activeTicketReference = reference;

        state.activeTicket = null;


        navigate("detail");


        const container = byId(
            "ticket-detail-container"
        );


        container.replaceChildren();


        container.appendChild(
            createEmptyState(
                "◷",
                "Loading ticket",
                "Retrieving the authorized ticket record from the server."
            )
        );


        try {

            const response = await request(

                safePath(
                    endpoint("tickets"),
                    reference
                )

            );


            const ticket =
                response.ticket || response;


            if (
                referenceOf(ticket) &&
                referenceOf(ticket) !== reference
            ) {

                throw new Error(
                    "The returned ticket reference does not match the requested record."
                );

            }


            state.activeTicket = ticket;


            renderTicketDetail(ticket);


        } catch (error) {

            container.replaceChildren();

            container.appendChild(
                createEmptyState(
                    "!",
                    "Ticket unavailable",
                    error.message
                )
            );

        }

    }


    function detailRow(name, value) {

        const row = makeElement(
            "div",
            "support-detail-row"
        );


        row.appendChild(
            makeElement("strong", "", name)
        );


        row.appendChild(
            makeElement(
                "span",
                "",
                value === null ||
                    value === undefined ||
                    value === ""
                    ? "—"
                    : String(value)
            )
        );


        return row;

    }


    function renderTicketDetail(ticket) {

        const container = byId(
            "ticket-detail-container"
        );

        if (!container) return;


        container.replaceChildren();


        const layout = makeElement(
            "div",
            "support-detail-grid"
        );


        const main = makeElement(
            "div",
            "support-detail-main"
        );


        const sidebar = makeElement(
            "div",
            "support-detail-sidebar"
        );


        /* TICKET SUMMARY */

        const summary = makeElement(
            "article",
            "support-detail-card"
        );


        const heading = makeElement(
            "div",
            "support-detail-heading"
        );


        const titleGroup = makeElement("div");


        titleGroup.appendChild(
            makeElement(
                "span",
                "support-eyebrow",
                referenceOf(ticket)
            )
        );


        titleGroup.appendChild(
            makeElement(
                "h3",
                "",
                ticket.subject
            )
        );


        titleGroup.appendChild(
            makeElement(
                "div",
                "support-detail-description",
                ticket.description
            )
        );


        heading.appendChild(titleGroup);


        heading.appendChild(
            makeElement(
                "span",
                `support-status ${normalize(ticket.status)}`,
                label(ticket.status)
            )
        );


        summary.appendChild(heading);


        summary.appendChild(
            makeElement(
                "div",
                "support-section-gap",
                ""
            )
        );


        const summaryActions = makeElement(
            "div",
            "support-row-actions"
        );


        const actions = [

            {

                text: "Assign",

                callback: () => openAssignment(
                    referenceOf(ticket)
                )

            },

            {

                text: "Escalate",

                danger: true,

                callback: () => confirmTicketAction(
                    "escalate"
                )

            },

            {

                text: "Change Status",

                callback: () => openStatusAction()

            }

        ];


        actions.forEach(action => {

            const button = makeElement(
                "button",
                `support-row-button${action.danger ? " danger" : ""}`,
                action.text
            );

            button.type = "button";

            button.addEventListener(
                "click",
                action.callback
            );

            summaryActions.appendChild(button);

        });


        summary.appendChild(summaryActions);

        main.appendChild(summary);


        /* CONVERSATION */

        const conversationCard = makeElement(
            "article",
            "support-detail-card"
        );


        conversationCard.appendChild(
            makeElement(
                "h3",
                "",
                "Communication History"
            )
        );


        const conversation = makeElement(
            "div",
            "support-conversation"
        );


        const messages = Array.isArray(ticket.messages)
            ? ticket.messages
            : [];


        if (!messages.length) {

            conversation.appendChild(
                createEmptyState(
                    "✉",
                    "No messages returned",
                    "Communication history will appear here when records are available."
                )
            );

        }


        messages.forEach(message => {

            const isAdmin =
                message.authorRole === "super_admin" ||
                message.authorRole === "administrator";


            const card = makeElement(
                "article",
                `support-message${isAdmin ? " admin" : ""}`
            );


            const header = makeElement(
                "div",
                "support-message-header"
            );


            header.appendChild(
                makeElement(
                    "strong",
                    "",
                    message.author?.displayName ||
                    message.authorReference ||
                    "Unknown author"
                )
            );


            header.appendChild(
                makeElement(
                    "span",
                    "",
                    `${label(message.authorRole)} · ${formatDateTime(message.createdAt)}`
                )
            );


            card.appendChild(header);


            card.appendChild(
                makeElement(
                    "div",
                    "support-message-body",
                    message.body
                )
            );


            conversation.appendChild(card);

        });


        conversationCard.appendChild(conversation);


        /* RESPONSE FORM */

        const responseForm = makeElement(
            "form",
            "support-response-form"
        );

        responseForm.id = "support-response-form";


        const responseLabel = makeElement(
            "label",
            "support-field"
        );


        responseLabel.appendChild(
            makeElement(
                "span",
                "",
                "Send a Support Response"
            )
        );


        const textarea = makeElement("textarea");

        textarea.name = "body";

        textarea.required = true;

        textarea.minLength = 2;

        textarea.maxLength = 10000;

        textarea.placeholder =
            "Write an official response to the requester...";


        responseLabel.appendChild(textarea);


        const responseActions = makeElement(
            "div",
            "support-response-actions"
        );


        const internalLabel = makeElement(
            "label",
            "support-checkbox"
        );


        const internalCheckbox = makeElement("input");

        internalCheckbox.type = "checkbox";

        internalCheckbox.name = "internal";

        internalCheckbox.value = "true";


        internalLabel.appendChild(internalCheckbox);

        internalLabel.appendChild(
            makeElement(
                "span",
                "",
                "Private internal administrator note"
            )
        );


        const submit = makeElement(
            "button",
            "support-button primary",
            "Send Response"
        );

        submit.type = "submit";


        responseActions.append(
            internalLabel,
            submit
        );


        responseForm.append(
            responseLabel,
            responseActions
        );


        responseForm.addEventListener(
            "submit",
            submitTicketResponse
        );


        conversationCard.appendChild(responseForm);

        main.appendChild(conversationCard);


        /* ATTACHMENTS */

        const attachmentCard = makeElement(
            "article",
            "support-detail-card"
        );


        attachmentCard.appendChild(
            makeElement(
                "h3",
                "",
                "Attachments & Evidence"
            )
        );


        const attachments = Array.isArray(ticket.attachments)
            ? ticket.attachments
            : [];


        if (!attachments.length) {

            attachmentCard.appendChild(
                createEmptyState(
                    "▧",
                    "No attachments returned",
                    "No attachment records are currently associated with this ticket."
                )
            );

        }


        attachments.forEach(attachment => {

            const item = makeElement(
                "div",
                "support-attachment"
            );


            const details = makeElement("div");


            details.appendChild(
                makeElement(
                    "strong",
                    "",
                    attachment.fileName || attachment.reference
                )
            );


            details.appendChild(
                makeElement(
                    "small",
                    "",
                    `${attachment.mimeType || "File"} · ${formatDateTime(attachment.createdAt)}`
                )
            );


            const download = makeElement(
                "button",
                "support-row-button",
                "Download"
            );


            download.type = "button";


            download.addEventListener("click", () => {

                downloadAttachment(
                    referenceOf(ticket),
                    attachment.reference
                );

            });


            item.append(details, download);

            attachmentCard.appendChild(item);

        });


        main.appendChild(attachmentCard);


        /* TICKET INFORMATION */

        const information = makeElement(
            "article",
            "support-detail-card"
        );


        information.appendChild(
            makeElement(
                "h3",
                "",
                "Ticket Information"
            )
        );


        [

            ["Requester", ticket.requester?.displayName],

            ["Requester Reference", ticket.requesterReference],

            ["Portal", label(ticket.portal)],

            ["Category", label(ticket.category)],

            ["Priority", label(ticket.priority)],

            ["Assigned Administrator",
                ticket.assignedAdministrator?.displayName],

            ["Related Reference", ticket.relatedReference],

            ["Created", formatDateTime(ticket.createdAt)],

            ["Last Updated", formatDateTime(ticket.updatedAt)],

            ["Resolved", formatDateTime(ticket.resolvedAt)],

            ["Closed", formatDateTime(ticket.closedAt)]

        ].forEach(([name, value]) => {

            information.appendChild(
                detailRow(name, value)
            );

        });


        sidebar.appendChild(information);


        /* SLA INFORMATION */

        const sla = makeElement(
            "article",
            "support-detail-card"
        );


        sla.appendChild(
            makeElement(
                "h3",
                "",
                "Service Level Information"
            )
        );


        [

            ["Response deadline", formatDateTime(ticket.sla?.responseDeadline)],

            ["Resolution deadline", formatDateTime(ticket.sla?.resolutionDeadline)],

            ["First response", formatDateTime(ticket.sla?.firstResponseAt)],

            ["Resolution duration", formatDuration(ticket.resolutionDuration)],

            ["SLA status", label(ticket.sla?.status)]

        ].forEach(([name, value]) => {

            sla.appendChild(detailRow(name, value));

        });


        sidebar.appendChild(sla);


        /* ADMINISTRATIVE ACTIONS */

        const adminActions = makeElement(
            "article",
            "support-detail-card"
        );


        adminActions.appendChild(
            makeElement(
                "h3",
                "",
                "Administrative Actions"
            )
        );


        const actionButtons = [

            ["Resolve Ticket", "resolve"],

            ["Reopen Ticket", "reopen"],

            ["Close Ticket", "close"]

        ];


        actionButtons.forEach(([text, action]) => {

            const button = makeElement(
                "button",
                "support-button secondary",
                text
            );


            button.type = "button";

            button.style.width = "100%";

            button.style.marginBottom = "9px";


            button.addEventListener("click", () => {

                confirmTicketAction(action);

            });


            adminActions.appendChild(button);

        });


        sidebar.appendChild(adminActions);


        layout.append(main, sidebar);

        container.appendChild(layout);

    }


    /* =====================================================
       15. TICKET RESPONSE
    ===================================================== */

    async function submitTicketResponse(event) {

        event.preventDefault();


        if (!requireAuthentication()) return;


        const form = event.currentTarget;

        const formData = new FormData(form);


        const body =
            formData.get("body")?.trim();


        const internal =
            formData.get("internal") === "true";


        if (!body || body.length < 2) {

            notify(
                "Enter a valid response.",
                "warning"
            );

            return;

        }


        const submit = form.querySelector(
            'button[type="submit"]'
        );

        submit.disabled = true;


        try {

            const response = await request(

                `${safePath(endpoint("tickets"), state.activeTicketReference)}/messages`,

                {

                    method: "POST",

                    body: {

                        body,

                        visibility: internal
                            ? "internal"
                            : "requester"

                    }

                }

            );


            notify(
                response.message ||
                "The server accepted the ticket response.",
                "success"
            );


            await openTicket(
                state.activeTicketReference
            );


        } catch (error) {

            notify(error.message, "error");

        } finally {

            submit.disabled = false;

        }

    }


    /* =====================================================
       16. ATTACHMENT DOWNLOAD
    ===================================================== */

    async function downloadAttachment(
        ticketReference,
        attachmentReference
    ) {

        if (!requireAuthentication()) return;


        try {

            const path =
                `${safePath(endpoint("tickets"), ticketReference)}` +
                `/attachments/${encodeURIComponent(attachmentReference)}/download`;


            const response = await fetch(path, {

                method: "GET",

                credentials: "same-origin",

                headers: {

                    "Accept": "application/octet-stream"

                }

            });


            if (!response.ok) {

                throw new Error(
                    `Attachment access denied (${response.status}).`
                );

            }


            const blob = await response.blob();


            const url = URL.createObjectURL(blob);


            const link = makeElement("a");

            link.href = url;

            link.download = "talvora-support-attachment";

            document.body.appendChild(link);

            link.click();

            link.remove();


            URL.revokeObjectURL(url);


        } catch (error) {

            notify(error.message, "error");

        }

    }


    /* =====================================================
       17. CREATE TICKET
    ===================================================== */

    function openCreateTicket() {

        if (!requireAuthentication()) return;


        state.lastFocus = document.activeElement;


        byId("support-create-form")?.reset();


        show(
            byId("support-create-modal")
        );


        byId("support-create-form")
            ?.querySelector("select")
            ?.focus();

    }


    function closeCreateTicket() {

        hide(
            byId("support-create-modal")
        );


        state.lastFocus?.focus?.();

        state.lastFocus = null;

    }


    async function submitCreateTicket(event) {

        event.preventDefault();


        if (!requireAuthentication()) return;


        const form = event.currentTarget;

        if (!form.reportValidity()) return;


        const data = new FormData(form);


        const payload = {

            portal: data.get("portal"),

            requesterReference:
                data.get("requesterReference")?.trim(),

            subject:
                data.get("subject")?.trim(),

            category:
                data.get("category"),

            priority:
                data.get("priority"),

            description:
                data.get("description")?.trim(),

            relatedReference:
                data.get("relatedReference")?.trim() || null,

            sensitive:
                data.get("sensitive") === "true"

        };


        const button = byId(
            "support-create-submit"
        );

        button.disabled = true;


        try {

            const response = await request(

                endpoint("tickets"),

                {

                    method: "POST",

                    body: payload

                }

            );


            notify(
                response.message ||
                "The server accepted the ticket creation request.",
                "success"
            );


            if (response.ticket?.reference) {

                closeCreateTicket();

                delete state.records.tickets;

                delete state.records.overview;


                await openTicket(
                    response.ticket.reference
                );

            } else {

                closeCreateTicket();

                await loadPanel("tickets", true);

            }


        } catch (error) {

            notify(error.message, "error");

        } finally {

            button.disabled = false;

        }

    }


    /* =====================================================
       18. ADMINISTRATOR DIRECTORY
    ===================================================== */

    async function loadAdministrators() {

        if (!requireAuthentication()) return;


        const select = $(
            '#support-assign-form select[name="administratorReference"]'
        );


        if (!select) return;


        select.replaceChildren();


        select.appendChild(
            new Option(
                "Loading authorized administrators...",
                ""
            )
        );


        try {

            const response = await request(

                `${endpoint("administrators")}?status=active`

            );


            const administrators = getItems(response);


            state.administrators = administrators;


            select.replaceChildren();


            select.appendChild(
                new Option(
                    "Select an administrator",
                    ""
                )
            );


            administrators.forEach(admin => {

                if (
                    admin.role !== "super_admin" ||
                    admin.status !== "active"
                ) {

                    return;

                }


                const option = new Option(

                    `${admin.displayName || admin.name} — ${admin.email}`,

                    admin.reference || admin.id

                );


                select.appendChild(option);

            });


            if (select.options.length === 1) {

                select.replaceChildren();

                select.appendChild(
                    new Option(
                        "No eligible administrators returned",
                        ""
                    )
                );

            }

        } catch (error) {

            select.replaceChildren();

            select.appendChild(
                new Option(
                    "Administrator directory unavailable",
                    ""
                )
            );


            notify(error.message, "error");

        }

    }


    /* =====================================================
       19. ASSIGNMENT
    ===================================================== */

    async function openAssignment(ticketReference) {

        if (!requireAuthentication()) return;


        state.lastFocus = document.activeElement;


        byId("support-assign-form")?.reset();


        const referenceInput = $(
            '#support-assign-form input[name="ticketReference"]'
        );


        if (referenceInput) {

            referenceInput.value = ticketReference;

        }


        show(
            byId("support-assign-modal")
        );


        await loadAdministrators();

    }


    function closeAssignment() {

        hide(
            byId("support-assign-modal")
        );


        state.lastFocus?.focus?.();

        state.lastFocus = null;

    }


    async function submitAssignment(event) {

        event.preventDefault();


        if (!requireAuthentication()) return;


        const form = event.currentTarget;

        if (!form.reportValidity()) return;


        const data = new FormData(form);


        const reference =
            data.get("ticketReference");


        const administratorReference =
            data.get("administratorReference");


        const reason =
            data.get("reason")?.trim();


        const button = byId(
            "support-assign-submit"
        );

        button.disabled = true;


        try {

            const response = await request(

                `${safePath(endpoint("tickets"), reference)}/assignments`,

                {

                    method: "POST",

                    body: {

                        administratorReference,

                        reason

                    }

                }

            );


            notify(
                response.message ||
                "The server accepted the assignment request.",
                "success"
            );


            closeAssignment();


            delete state.records.tickets;

            delete state.records.assignments;

            delete state.records.overview;


            if (
                state.activeTicketReference === reference
            ) {

                await openTicket(reference);

            } else {

                await loadPanel(
                    state.activePanel,
                    true
                );

            }

        } catch (error) {

            notify(error.message, "error");

        } finally {

            button.disabled = false;

        }

    }


    /* =====================================================
       20. TICKET ACTIONS
    ===================================================== */

    function confirmTicketAction(action) {

        if (!requireAuthentication()) return;


        const descriptions = {

            escalate:
                "Escalate this support case for higher-level investigation.",

            resolve:
                "Mark this support ticket as resolved. The action will be recorded.",

            reopen:
                "Reopen this previously resolved or closed ticket.",

            close:
                "Close this ticket. Confirm that closure is appropriate."

        };


        openActionModal({

            action,

            reference: state.activeTicketReference,

            title: `${label(action)} Ticket`,

            description: descriptions[action]

        });

    }


    function openStatusAction() {

        if (!requireAuthentication()) return;


        openActionModal({

            action: "change_status",

            reference: state.activeTicketReference,

            title: "Change Ticket Status",

            description:
                "Select the new status and provide an administrative justification."

        });

    }


    /* =====================================================
       21. ACTION CONFIRMATION
    ===================================================== */

    function openActionModal(action) {

        state.pendingAction = action;

        state.lastFocus = document.activeElement;


        setText(
            "support-action-title",
            action.title
        );


        setText(
            "support-action-description",
            action.description
        );


        const reason = byId(
            "support-action-reason"
        );

        if (reason) reason.value = "";


        let existingSelect = byId(
            "support-action-status"
        );


        if (existingSelect) {

            existingSelect.remove();

        }


        if (action.action === "change_status") {

            const select = makeElement("select");

            select.id = "support-action-status";

            select.append(

                new Option("Select status", ""),

                new Option("Open", "open"),

                new Option("In Progress", "in_progress"),

                new Option("Waiting Response", "waiting_response"),

                new Option("Resolved", "resolved"),

                new Option("Closed", "closed")

            );


            const field = makeElement(
                "label",
                "support-field"
            );


            field.append(

                makeElement(
                    "span",
                    "",
                    "New Ticket Status"
                ),

                select

            );


            byId("support-action-description")
                ?.after(field);

        }


        show(
            byId("support-action-modal")
        );

        reason?.focus();

    }


    function closeActionModal() {

        hide(
            byId("support-action-modal")
        );


        byId("support-action-status")?.parentElement?.remove();


        state.pendingAction = null;

        state.lastFocus?.focus?.();

        state.lastFocus = null;

    }


    async function executeTicketAction() {

        if (!requireAuthentication()) return;


        const action = state.pendingAction;

        if (!action) return;


        const reason = byId(
            "support-action-reason"
        )?.value.trim();


        if (!reason || reason.length < 10) {

            notify(
                "Provide an administrative justification of at least 10 characters.",
                "warning"
            );

            return;

        }


        const payload = {

            action: action.action,

            reason

        };


        if (action.action === "change_status") {

            payload.status = byId(
                "support-action-status"
            )?.value;


            if (!payload.status) {

                notify(
                    "Select a new ticket status.",
                    "warning"
                );

                return;

            }

        }


        const button = byId(
            "support-action-confirm"
        );

        button.disabled = true;


        try {

            const response = await request(

                `${safePath(endpoint("tickets"), action.reference)}/actions`,

                {

                    method: "POST",

                    body: payload

                }

            );


            notify(
                response.message ||
                "The server confirmed the requested ticket operation.",
                "success"
            );


            closeActionModal();


            delete state.records.tickets;

            delete state.records.escalations;

            delete state.records.overview;


            await openTicket(action.reference);

        } catch (error) {

            notify(error.message, "error");

        } finally {

            button.disabled = false;

        }

    }


    /* =====================================================
       22. ESCALATIONS
    ===================================================== */

    function renderEscalations(data) {

        const items = getItems(data);

        const body = clearTable(
            "escalations-table-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "escalations-table-body",
                9,
                "No escalated cases returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");


            addCell(row, referenceOf(item), true);

            addCell(row, item.subject);

            addCell(row, label(item.portal));

            addPriority(row, item.priority);

            addCell(row, item.escalationReason);

            addCell(
                row,
                item.assignedAdministrator?.displayName
            );

            addCell(
                row,
                formatDateTime(item.escalatedAt)
            );

            addStatus(row, item.status);


            addActions(row, [

                {

                    text: "Investigate",

                    callback: () => openTicket(
                        referenceOf(item)
                    )

                },

                {

                    text: "Resolve Escalation",

                    callback: () => openActionModal({

                        action: "resolve_escalation",

                        reference: referenceOf(item),

                        title: "Resolve Escalation",

                        description:
                            "Request closure of the escalation after documenting the investigation and outcome."

                    })

                }

            ]);


            body.appendChild(row);

        });

    }


    /* =====================================================
       23. ASSIGNMENT MANAGEMENT
    ===================================================== */

    function renderAssignments(data) {

        renderAdministratorWorkload(
            data.administrators || []
        );


        renderUnassignedTickets(
            data.unassignedTickets || []
        );

    }


    function renderAdministratorWorkload(items) {

        const body = clearTable(
            "assignments-admin-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "assignments-admin-body",
                7,
                "No administrator workload records returned."
            );

            return;

        }


        items.forEach(admin => {

            const row = makeElement("tr");


            addCell(
                row,
                admin.displayName || admin.name,
                true
            );

            addCell(row, admin.email);

            addCell(
                row,
                formatNumber(admin.assignedCount)
            );

            addCell(
                row,
                formatNumber(admin.openCount)
            );

            addCell(
                row,
                formatNumber(admin.inProgressCount)
            );

            addCell(
                row,
                formatNumber(admin.resolvedCount)
            );

            addStatus(row, admin.availability);


            body.appendChild(row);

        });

    }


    function renderUnassignedTickets(items) {

        const body = clearTable(
            "unassigned-table-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "unassigned-table-body",
                6,
                "No unassigned tickets returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");


            addCell(row, referenceOf(item), true);

            addCell(row, item.subject);

            addCell(row, label(item.portal));

            addPriority(row, item.priority);

            addCell(
                row,
                formatDateTime(item.createdAt)
            );


            addActions(row, [

                {

                    text: "Assign",

                    callback: () => openAssignment(
                        referenceOf(item)
                    )

                }

            ]);


            body.appendChild(row);

        });

    }


    /* =====================================================
       24. KNOWLEDGE BASE
    ===================================================== */

    function renderKnowledge(data) {

        const items = getItems(data);

        const body = clearTable(
            "knowledge-table-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "knowledge-table-body",
                8,
                "No knowledge base articles returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");


            addCell(row, referenceOf(item), true);

            addCell(row, item.title);

            addCell(row, label(item.category));

            addCell(row, label(item.portal));

            addCell(
                row,
                item.author?.displayName
            );

            addCell(
                row,
                formatDateTime(item.updatedAt)
            );

            addStatus(row, item.status);


            addActions(row, [

                {

                    text: "Edit",

                    callback: () => editKnowledge(item)

                },

                {

                    text: "Archive",

                    danger: true,

                    callback: () => openActionModal({

                        action: "archive_knowledge",

                        reference: referenceOf(item),

                        title: "Archive Knowledge Article",

                        description:
                            "Archive this article while retaining its revision and publication history."

                    })

                }

            ]);


            body.appendChild(row);

        });

    }


    function openKnowledgeModal() {

        if (!requireAuthentication()) return;


        state.lastFocus = document.activeElement;


        byId("support-knowledge-form")?.reset();


        show(
            byId("support-knowledge-modal")
        );

    }


    function editKnowledge(item) {

        if (!requireAuthentication()) return;


        const form = byId(
            "support-knowledge-form"
        );


        form.elements.reference.value =
            referenceOf(item) || "";

        form.elements.title.value =
            item.title || "";

        form.elements.category.value =
            item.category || "";

        form.elements.portal.value =
            item.portal || "employer";

        form.elements.content.value =
            item.content || "";

        form.elements.status.value =
            item.status || "draft";


        show(
            byId("support-knowledge-modal")
        );

    }


    function closeKnowledgeModal() {

        hide(
            byId("support-knowledge-modal")
        );


        state.lastFocus?.focus?.();

        state.lastFocus = null;

    }


    async function submitKnowledge(event) {

        event.preventDefault();


        if (!requireAuthentication()) return;


        const form = event.currentTarget;

        if (!form.reportValidity()) return;


        const data = new FormData(form);


        const reference =
            data.get("reference");


        const payload = {

            title: data.get("title")?.trim(),

            category: data.get("category")?.trim(),

            portal: data.get("portal"),

            content: data.get("content")?.trim(),

            status: data.get("status")

        };


        const isEdit = Boolean(reference);


        const button = byId(
            "support-knowledge-submit"
        );

        button.disabled = true;


        try {

            const response = await request(

                isEdit
                    ? safePath(endpoint("knowledge"), reference)
                    : endpoint("knowledge"),

                {

                    method: isEdit ? "PATCH" : "POST",

                    body: payload

                }

            );


            notify(
                response.message ||
                "The server accepted the knowledge article operation.",
                "success"
            );


            closeKnowledgeModal();


            delete state.records.knowledge;


            await loadPanel("knowledge", true);

        } catch (error) {

            notify(error.message, "error");

        } finally {

            button.disabled = false;

        }

    }


    /* =====================================================
       25. ANALYTICS
    ===================================================== */

    function renderAnalytics(data) {

        renderAnalyticsList(
            "analytics-ticket-volume",
            data.ticketVolume || [],
            "No ticket volume data returned."
        );


        renderAnalyticsList(
            "analytics-resolution",
            data.resolutionPerformance || [],
            "No resolution performance data returned."
        );


        renderAnalyticsList(
            "analytics-portals",
            data.portalDistribution || [],
            "No portal distribution data returned."
        );


        renderAnalyticsList(
            "analytics-categories",
            data.categoryDistribution || [],
            "No category distribution data returned."
        );


        renderAnalyticsAdministrators(
            data.administratorPerformance || []
        );

    }


    function renderAnalyticsList(id, items, message) {

        const container = byId(id);

        if (!container) return;


        container.replaceChildren();


        if (!items.length) {

            container.appendChild(
                createEmptyState(
                    "◎",
                    "No analytics returned",
                    message
                )
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement(
                "div",
                "support-analytics-row"
            );


            row.appendChild(
                makeElement(
                    "strong",
                    "",
                    item.label ||
                    item.category ||
                    item.portal ||
                    item.period ||
                    "Metric"
                )
            );


            const value =
                item.value === undefined
                    ? item.count
                    : item.value;


            row.appendChild(
                makeElement(
                    "span",
                    "",
                    value === undefined
                        ? "—"
                        : typeof value === "number"
                            ? formatNumber(value)
                            : String(value)
                )
            );


            container.appendChild(row);

        });

    }


    function renderAnalyticsAdministrators(items) {

        const body = clearTable(
            "analytics-admin-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "analytics-admin-body",
                6,
                "No administrator performance records returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");


            addCell(
                row,
                item.displayName || item.name,
                true
            );

            addCell(
                row,
                formatNumber(item.assigned)
            );

            addCell(
                row,
                formatNumber(item.resolved)
            );

            addCell(
                row,
                formatNumber(item.open)
            );

            addCell(
                row,
                formatDuration(item.averageResolution)
            );

            addCell(
                row,
                item.period
            );


            body.appendChild(row);

        });

    }


    async function generateAnalytics() {

        if (!requireAuthentication()) return;


        const from = byId(
            "analytics-from"
        )?.value;


        const to = byId(
            "analytics-to"
        )?.value;


        const period = byId(
            "analytics-period"
        )?.value;


        if (from && to && from > to) {

            notify(
                "The start date cannot be later than the end date.",
                "warning"
            );

            return;

        }


        const query = new URLSearchParams();


        if (from) query.set("from", from);

        if (to) query.set("to", to);

        if (period) query.set("period", period);


        try {

            const response = await request(

                `${endpoint("analytics")}?${query.toString()}`

            );


            state.records.analytics = response;

            renderAnalytics(response);


            notify(
                "Analytics report received from the server.",
                "success"
            );

        } catch (error) {

            notify(error.message, "error");

        }

    }


    /* =====================================================
       26. AUDIT TRAIL
    ===================================================== */

    function renderAudit(data) {

        const items = getItems(data);

        const body = clearTable(
            "audit-table-body"
        );

        if (!body) return;


        if (!items.length) {

            emptyTable(
                "audit-table-body",
                7,
                "No helpdesk audit records returned."
            );

            return;

        }


        items.forEach(item => {

            const row = makeElement("tr");


            addCell(row, referenceOf(item), true);

            addCell(row, item.ticketReference);

            addCell(
                row,
                item.administrator?.displayName ||
                item.administratorReference
            );

            addCell(row, label(item.operation));

            addCell(row, item.reason);

            addCell(
                row,
                formatDateTime(item.timestamp)
            );

            addStatus(row, item.outcome);


            body.appendChild(row);

        });

    }


    async function applyAuditFilters() {

        if (!requireAuthentication()) return;


        const query = new URLSearchParams({

            page: "1",

            pageSize: String(CONFIG.PAGE_SIZE)

        });


        const search = byId(
            "audit-search"
        )?.value.trim();


        const operation = byId(
            "audit-operation"
        )?.value;


        if (search) query.set("search", search);

        if (operation) query.set("operation", operation);


        try {

            const response = await request(

                `${endpoint("audit")}?${query.toString()}`

            );


            state.records.audit = response;

            renderAudit(response);

        } catch (error) {

            notify(error.message, "error");

        }

    }


    /* =====================================================
       27. KNOWLEDGE FILTERS
    ===================================================== */

    async function applyKnowledgeFilters() {

        if (!requireAuthentication()) return;


        const query = new URLSearchParams({

            page: "1",

            pageSize: String(CONFIG.PAGE_SIZE)

        });


        const search = byId(
            "knowledge-search"
        )?.value.trim();


        const portal = byId(
            "knowledge-portal"
        )?.value;


        const status = byId(
            "knowledge-status"
        )?.value;


        if (search) query.set("search", search);

        if (portal) query.set("portal", portal);

        if (status) query.set("status", status);


        try {

            const response = await request(

                `${endpoint("knowledge")}?${query.toString()}`

            );


            state.records.knowledge = response;

            renderKnowledge(response);

        } catch (error) {

            notify(error.message, "error");

        }

    }


    /* =====================================================
       28. PAGINATION
    ===================================================== */

    function updatePagination(panel, data) {

        const pagination =
            data.pagination || {};


        const page =
            pagination.page ||
            state.pages[panel] ||
            1;


        const totalPages =
            pagination.totalPages || 1;


        state.pages[panel] = page;


        setText(
            `${panel}-record-count`,
            `${formatNumber(pagination.total ?? getItems(data).length)} records`
        );


        setText(
            `${panel}-page-info`,
            `Page ${page} of ${totalPages}`
        );


        const previous = byId(
            `${panel}-prev`
        );


        const next = byId(
            `${panel}-next`
        );


        if (previous) previous.disabled = page <= 1;

        if (next) next.disabled = page >= totalPages;

    }


    async function changePage(panel, direction) {

        if (!requireAuthentication()) return;


        state.pages[panel] = Math.max(

            1,

            (state.pages[panel] || 1) + direction

        );


        delete state.records[panel];


        await loadFilteredPanel(panel);

    }


    /* =====================================================
       29. EXPORT
    ===================================================== */

    async function exportSupport() {

        if (!requireAuthentication()) return;


        const panel = {

            tickets: "tickets",

            escalations: "escalations",

            audit: "audit",

            analytics: "analytics"

        }[state.activePanel] || "tickets";


        const query = new URLSearchParams({

            format: "csv"

        });


        const filters =
            state.filters[panel] || {};


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
                `talvora-support-${panel}.csv`;


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


    /* =====================================================
       30. MODAL MANAGEMENT
    ===================================================== */

    function initializeModals() {

        $$("[data-open-ticket]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    openCreateTicket
                );

            });


        $$("[data-close-create]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    closeCreateTicket
                );

            });


        $$("[data-close-assign]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    closeAssignment
                );

            });


        $$("[data-close-action]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    closeActionModal
                );

            });


        $$("[data-close-knowledge]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    closeKnowledgeModal
                );

            });


        byId("support-create-form")
            ?.addEventListener(
                "submit",
                submitCreateTicket
            );


        byId("support-assign-form")
            ?.addEventListener(
                "submit",
                submitAssignment
            );


        byId("support-knowledge-form")
            ?.addEventListener(
                "submit",
                submitKnowledge
            );


        byId("support-action-confirm")
            ?.addEventListener(
                "click",
                executeTicketAction
            );


        byId("knowledge-create")
            ?.addEventListener(
                "click",
                openKnowledgeModal
            );


        const modalIds = [

            "support-create-modal",

            "support-assign-modal",

            "support-action-modal",

            "support-knowledge-modal"

        ];


        modalIds.forEach(id => {

            byId(id)?.addEventListener("click", event => {

                if (event.target.id !== id) return;


                if (id === "support-create-modal") {
                    closeCreateTicket();
                }

                if (id === "support-assign-modal") {
                    closeAssignment();
                }

                if (id === "support-action-modal") {
                    closeActionModal();
                }

                if (id === "support-knowledge-modal") {
                    closeKnowledgeModal();
                }

            });

        });


        document.addEventListener("keydown", event => {

            if (event.key !== "Escape") return;


            closeCreateTicket();

            closeAssignment();

            closeActionModal();

            closeKnowledgeModal();

            closeSidebar();

        });

    }


    /* =====================================================
       31. FILTER EVENTS
    ===================================================== */

    function initializeFilters() {

        byId("tickets-apply")
            ?.addEventListener(
                "click",
                applyTicketFilters
            );


        byId("tickets-reset")
            ?.addEventListener(
                "click",
                resetTicketFilters
            );


        byId("analytics-apply")
            ?.addEventListener(
                "click",
                generateAnalytics
            );


        byId("audit-apply")
            ?.addEventListener(
                "click",
                applyAuditFilters
            );


        byId("knowledge-apply")
            ?.addEventListener(
                "click",
                applyKnowledgeFilters
            );


        byId("tickets-search")
            ?.addEventListener("keydown", event => {

                if (event.key === "Enter") {

                    applyTicketFilters();

                }

            });


        byId("audit-search")
            ?.addEventListener("keydown", event => {

                if (event.key === "Enter") {

                    applyAuditFilters();

                }

            });


        byId("knowledge-search")
            ?.addEventListener("keydown", event => {

                if (event.key === "Enter") {

                    applyKnowledgeFilters();

                }

            });


        byId("tickets-prev")
            ?.addEventListener("click", () => {

                changePage("tickets", -1);

            });


        byId("tickets-next")
            ?.addEventListener("click", () => {

                changePage("tickets", 1);

            });

    }


    /* =====================================================
       32. EXPORT EVENTS
    ===================================================== */

    function initializeExports() {

        $$("[data-export-support]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    exportSupport
                );

            });

    }


    /* =====================================================
       33. REFRESH
    ===================================================== */

    async function refreshCurrentPanel() {

        if (!requireAuthentication()) return;

        if (state.refreshing) return;


        state.refreshing = true;


        const button = byId(
            "support-refresh"
        );

        if (button) button.disabled = true;


        try {

            const panel = state.activePanel;


            if (panel === "detail") {

                if (state.activeTicketReference) {

                    await openTicket(
                        state.activeTicketReference
                    );

                }

                return;

            }


            delete state.records[panel];


            await loadPanel(panel, true);


            notify(
                "The latest available support records have been requested.",
                "success"
            );

        } finally {

            state.refreshing = false;

            if (button) button.disabled = false;

        }

    }


    /* =====================================================
       34. ANALYTICS PERIOD
    ===================================================== */

    function initializeAnalyticsPeriod() {

        byId("analytics-period")
            ?.addEventListener("change", event => {

                const period = event.target.value;


                if (!period) return;


                const days = {

                    "7d": 7,

                    "30d": 30,

                    "90d": 90

                };


                const today = new Date();

                const from = new Date(today);


                if (period === "12m") {

                    from.setFullYear(
                        from.getFullYear() - 1
                    );

                } else {

                    from.setDate(
                        from.getDate() - days[period]
                    );

                }


                byId("analytics-to").value =
                    today.toISOString().slice(0, 10);


                byId("analytics-from").value =
                    from.toISOString().slice(0, 10);

            });

    }


    /* =====================================================
       35. SECURITY AND GOVERNANCE
    ===================================================== */

    function initializeSecurityControls() {

        /*
         * TALVORA HELPDESK SECURITY REQUIREMENTS
         *
         * 1. All requests require server-side Super Admin
         *    authentication and authorization.
         *
         * 2. The ten authorized Super Admin accounts must be
         *    validated against the central administrator
         *    register.
         *
         * 3. Browser role checks are supplementary only.
         *
         * 4. Every ticket belongs to a verified requester
         *    identity and portal.
         *
         * 5. Employer, employee and administrator identities
         *    must not be interchangeable.
         *
         * 6. Ticket access does not grant unrestricted access
         *    to associated evidence or account records.
         *
         * 7. Private internal notes must never appear in
         *    employer or employee conversations.
         *
         * 8. Attachment downloads require independent
         *    authorization and signed access or equivalent
         *    secure server validation.
         *
         * 9. Sensitive information must be protected at rest
         *    and in transit.
         *
         * 10. Every administrative action requires a recorded
         *     administrator identity and timestamp.
         *
         * 11. Ticket assignment must validate active
         *     administrator eligibility on the server.
         *
         * 12. Escalation must preserve the original ticket
         *     history and requester information.
         *
         * 13. Resolution, closure and reopening must preserve
         *     previous states and reasons.
         *
         * 14. SLA deadlines must be calculated server-side.
         *
         * 15. Ticket deletion must not be available as a
         *     routine administrative operation.
         *
         * 16. Audit records must be append-only and protected
         *     from ordinary modification.
         *
         * 17. Knowledge articles must retain revision history.
         *
         * 18. All communication actions must respect
         *     notification and consent preferences.
         *
         * 19. Rate limits and abuse controls must be enforced.
         *
         * 20. Cross-portal support operations must be logged.
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
       36. INITIALIZE
    ===================================================== */

    async function initialize() {

        initializeSidebar();

        initializeNavigation();

        initializeModals();

        initializeFilters();

        initializeExports();

        initializeAnalyticsPeriod();


        byId("support-refresh")
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
            "TALVORA Super Admin Support & Helpdesk Centre initialized."
        );

    }


    /* =====================================================
       37. START APPLICATION
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
