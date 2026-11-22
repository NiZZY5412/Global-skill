
/* =========================================================
   TALVORA TECHNOLOGIES
   COMPLIANCE & GOVERNANCE CENTRE
   GSES SYSTEM 001

   FRONTEND APPLICATION

   NO DEMO DATA
   NO FAKE RECORDS
   NO SIMULATED COMPLIANCE SCORES
   NO CLIENT-SIDE PRIVILEGE GRANTS

   BACKEND IMPLEMENTATION IS THE FINAL PHASE.
========================================================= */

"use strict";

(() => {

    /* =====================================================
       01. CONFIGURATION
    ===================================================== */

    const CONFIG = Object.freeze({

        API: "/api/v1/admin/compliance",

        SESSION: "/api/v1/auth/session",

        REFRESH_INTERVAL: 30000,

        REQUEST_TIMEOUT: 20000,

        PAGE_SIZE: 50,

        RETENTION_DAYS: 365,

        PANELS: [

            "overview",
            "jurisdictions",
            "employers",
            "employees",
            "evidence",
            "privacy",
            "incidents",
            "audits",
            "reports"

        ],

        ROUTES: {

            overview: "/overview",

            jurisdictions: "/jurisdictions",

            requirements: "/requirements",

            employers: "/employers",

            employees: "/employees",

            evidence: "/evidence",

            privacy: "/privacy",

            incidents: "/incidents",

            enforcement: "/enforcement",

            audits: "/audits",

            corrective: "/corrective-actions",

            reports: "/reports",

            alerts: "/alerts",

            notifications: "/notifications"

        }

    });


    /* =====================================================
       02. APPLICATION STATE
    ===================================================== */

    const state = {

        authenticated: false,

        administrator: null,

        csrfToken: null,

        activePanel: "overview",

        cache: {},

        loading: new Set(),

        filters: {},

        refreshTimer: null,

        refreshing: false,

        activeForm: null,

        lastFocus: null,

        destroyed: false

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


    function create(tag, className = "", content = null) {

        const node = document.createElement(tag);


        if (className) {

            node.className = className;

        }


        if (content !== null && content !== undefined) {

            node.textContent = String(content);

        }


        return node;

    }


    function setText(id, value) {

        const node = byId(id);

        if (!node) return;


        node.textContent =

            value === null ||
                value === undefined ||
                value === ""

                ? "—"
                : String(value);

    }


    function show(node) {

        if (node) node.hidden = false;

    }


    function hide(node) {

        if (node) node.hidden = true;

    }


    function number(value) {

        if (
            typeof value !== "number" ||
            !Number.isFinite(value)
        ) {

            return "—";

        }


        return new Intl.NumberFormat().format(value);

    }


    function percent(value) {

        if (
            typeof value !== "number" ||
            !Number.isFinite(value)
        ) {

            return "—";

        }


        return `${value.toFixed(1)}%`;

    }


    function pretty(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return "Unknown";

        }


        return String(value)

            .replace(/[_-]/g, " ")

            .replace(/\b\w/g, character =>
                character.toUpperCase()
            );

    }


    function normalize(value) {

        return String(value || "unknown")

            .trim()

            .toLowerCase()

            .replace(/[\s-]+/g, "_");

    }


    function dateTime(value) {

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


    function getItems(data) {

        if (Array.isArray(data)) return data;


        if (Array.isArray(data?.items)) {

            return data.items;

        }


        if (Array.isArray(data?.records)) {

            return data.records;

        }


        if (Array.isArray(data?.results)) {

            return data.results;

        }


        return [];

    }


    function getReference(item) {

        return (

            item?.reference ||

            item?.id ||

            item?.key ||

            null

        );

    }


    function safePath(base, reference) {

        if (!reference) {

            throw new Error(
                "A valid record reference is required."
            );

        }


        return `${base}/${encodeURIComponent(reference)}`;

    }


    function setMetric(id, value, formatter = number) {

        setText(

            id,

            value === null ||
                value === undefined

                ? "—"

                : formatter(value)

        );

    }


    /* =====================================================
       04. NOTIFICATIONS
    ===================================================== */

    function toast(message, type = "info") {

        const container = byId("toast-container");

        if (!container) return;


        const item = create(
            "div",
            `toast ${type}`,
            message
        );


        item.setAttribute("role", "status");


        container.appendChild(item);


        window.setTimeout(() => {

            item.remove();

        }, 5000);

    }


    function notice(message, type = "info") {

        const node = byId("global-notice");

        if (!node) return;


        node.className = `notice ${type}`;

        node.textContent = message;

        show(node);

    }


    function clearNotice() {

        const node = byId("global-notice");

        if (!node) return;


        node.textContent = "";

        hide(node);

    }


    /* =====================================================
       05. API CLIENT
    ===================================================== */

    async function request(path, options = {}) {

        const controller = new AbortController();


        const timeout = window.setTimeout(() => {

            controller.abort();

        }, CONFIG.REQUEST_TIMEOUT);


        const method = options.method || "GET";


        const headers = {

            Accept: "application/json",

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

                throw new Error(
                    "Administrator session expired. Please authenticate again."
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

                    `Request failed (${response.status}).`

                );

            }


            return result;

        } catch (error) {

            if (error.name === "AbortError") {

                throw new Error(
                    "The request timed out."
                );

            }


            if (error instanceof TypeError) {

                throw new Error(
                    "Unable to connect to the TALVORA backend."
                );

            }


            throw error;

        } finally {

            window.clearTimeout(timeout);

        }

    }


    function endpoint(name) {

        const route = CONFIG.ROUTES[name];


        if (!route) {

            throw new Error(
                `Unknown compliance service: ${name}`
            );

        }


        return CONFIG.API + route;

    }


    /* =====================================================
       06. SUPER ADMIN AUTHENTICATION
    ===================================================== */

    async function verifyAdministrator() {

        try {

            const result = await request(
                CONFIG.SESSION
            );


            if (
                result?.authenticated !== true ||

                result?.user?.role !== "super_admin"
            ) {

                state.authenticated = false;

                setConnection(
                    "offline",
                    "Super Admin authentication required"
                );


                notice(
                    "Access denied. A verified TALVORA Super Admin session is required.",
                    "error"
                );


                return false;

            }


            state.administrator = result.user;

            state.csrfToken =
                result.csrfToken || null;

            state.authenticated = true;


            const name =

                result.user.displayName ||

                result.user.name ||

                "Super Administrator";


            setText("admin-name", name);

            setText("admin-email", result.user.email);


            const initials = name

                .split(/\s+/)

                .filter(Boolean)

                .slice(0, 2)

                .map(part => part[0])

                .join("")

                .toUpperCase();


            setText("admin-avatar", initials);


            setConnection(
                "online",
                "Administrator session verified"
            );


            return true;

        } catch (error) {

            state.authenticated = false;


            setConnection(
                "offline",
                "Authentication unavailable"
            );


            notice(error.message, "error");


            return false;

        }

    }


    function authorized() {

        if (!state.authenticated) {

            toast(
                "A verified Super Admin session is required.",
                "error"
            );

            return false;

        }


        return true;

    }


    function setConnection(status, message) {

        const dot = byId("connection-dot");

        if (dot) {

            dot.className =
                `status-dot ${status}`;

        }


        setText(
            "connection-label",
            message
        );

    }


    /* =====================================================
       07. NAVIGATION
    ===================================================== */

    const PANEL_TITLES = {

        overview: "Compliance Overview",

        jurisdictions: "Regulations & Countries",

        employers: "Employer Compliance",

        employees: "Employee Compliance",

        evidence: "Documents & Evidence",

        privacy: "Data Protection & Privacy",

        incidents: "Risk & Compliance Incidents",

        audits: "Audits & Corrective Actions",

        reports: "Reports & Alerts"

    };


    function navigate(panel, updateHash = true) {

        if (!CONFIG.PANELS.includes(panel)) {

            panel = "overview";

        }


        state.activePanel = panel;


        $$(".panel").forEach(section => {

            const active =
                section.id === `panel-${panel}`;


            section.classList.toggle(
                "active",
                active
            );


            section.hidden = !active;

        });


        $$(".nav-link").forEach(link => {

            const active =
                link.dataset.panel === panel;


            link.classList.toggle(
                "active",
                active
            );


            if (active) {

                link.setAttribute(
                    "aria-current",
                    "page"
                );

            } else {

                link.removeAttribute(
                    "aria-current"
                );

            }

        });


        setText(
            "page-title",
            PANEL_TITLES[panel]
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


        if (state.authenticated) {

            loadPanel(panel, true);

        }


        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    }


    function initializeNavigation() {

        $$(".nav-link").forEach(link => {

            link.addEventListener("click", event => {

                event.preventDefault();

                navigate(link.dataset.panel);

            });

        });


        $$("[data-panel]").forEach(button => {

            if (button.classList.contains("nav-link")) {

                return;

            }


            button.addEventListener("click", () => {

                navigate(button.dataset.panel);

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
       08. SIDEBAR
    ===================================================== */

    function openSidebar() {

        byId("sidebar")?.classList.add("open");

        show(
            byId("sidebar-overlay")
        );

    }


    function closeSidebar() {

        byId("sidebar")?.classList.remove("open");

        hide(
            byId("sidebar-overlay")
        );

    }


    function initializeSidebar() {

        byId("menu-button")
            ?.addEventListener("click", openSidebar);


        byId("sidebar-close")
            ?.addEventListener("click", closeSidebar);


        byId("sidebar-overlay")
            ?.addEventListener("click", closeSidebar);

    }


    /* =====================================================
       09. EMPTY STATES AND TABLE HELPERS
    ===================================================== */

    function emptyRow(id, columns, message) {

        const body = byId(id);

        if (!body) return;


        body.replaceChildren();


        const row = create("tr");

        const td = create(
            "td",
            "empty-cell",
            message
        );


        td.colSpan = columns;

        row.appendChild(td);

        body.appendChild(row);

    }


    function createCell(row, value, bold = false) {

        const td = create("td");


        const content =

            value === null ||
                value === undefined ||
                value === ""

                ? "—"

                : String(value);


        if (bold) {

            td.appendChild(
                create("strong", "", content)
            );

        } else {

            td.textContent = content;

        }


        row.appendChild(td);

        return td;

    }


    function statusCell(row, value) {

        const td = create("td");


        td.appendChild(

            create(

                "span",

                `status-badge ${normalize(value)}`,

                pretty(value)

            )

        );


        row.appendChild(td);

    }


    function severityCell(row, value) {

        const td = create("td");


        td.appendChild(

            create(

                "span",

                `severity-badge ${normalize(value)}`,

                pretty(value)

            )

        );


        row.appendChild(td);

    }


    function createAction(label, action, reference, extra = {}) {

        const button = create(
            "button",
            `row-button${extra.danger ? " danger" : ""}`,
            label
        );


        button.type = "button";

        button.dataset.action = action;

        button.dataset.reference = reference || "";


        Object.entries(extra).forEach(([key, value]) => {

            if (key !== "danger") {

                button.dataset[key] = value;

            }

        });


        return button;

    }


    function renderTable(id, items, columns, renderer, message) {

        const body = byId(id);

        if (!body) return;


        body.replaceChildren();


        if (!items.length) {

            emptyRow(id, columns, message);

            return;

        }


        items.forEach(item => {

            const row = create("tr");

            renderer(row, item);

            body.appendChild(row);

        });

    }


    function renderMetricSet(data, mappings) {

        Object.entries(mappings).forEach(
            ([id, definition]) => {

                const config =

                    typeof definition === "string"

                        ? {
                            field: definition,
                            formatter: number
                        }

                        : definition;


                setMetric(

                    id,

                    data?.[config.field],

                    config.formatter || number

                );

            }
        );

    }


    function renderList(id, items, message, options = {}) {

        const container = byId(id);

        if (!container) return;


        container.replaceChildren();


        if (!items.length) {

            container.appendChild(

                create(
                    "div",
                    "empty-state",
                    message
                )

            );

            return;

        }


        items.forEach(item => {

            const wrapper = create(
                "div",
                options.event ? "event-item" : "data-item"
            );


            if (options.event) {

                const icon = create(

                    "div",

                    `event-icon ${normalize(item.severity)}`,

                    normalize(item.severity) === "critical"
                        ? "!"
                        : "•"

                );


                const details = create(
                    "div",
                    "event-info"
                );


                details.appendChild(

                    create(
                        "strong",
                        "",
                        item.title ||
                        item.name ||
                        item.description ||
                        "Compliance event"
                    )

                );


                details.appendChild(

                    create(
                        "p",
                        "",
                        item.description ||
                        item.summary ||
                        "No further details supplied."
                    )

                );


                details.appendChild(

                    create(
                        "small",
                        "",
                        dateTime(item.createdAt || item.detectedAt)
                    )

                );


                wrapper.append(icon, details);

            } else {

                const details = create("div");


                details.appendChild(

                    create(
                        "strong",
                        "",
                        item.name ||
                        item.countryName ||
                        item.title ||
                        item.reference ||
                        "Compliance record"
                    )

                );


                details.appendChild(

                    create(
                        "small",
                        "",
                        item.description ||
                        item.jurisdiction ||
                        item.category ||
                        "No description supplied."
                    )

                );


                const status = create(

                    "span",

                    `status-badge ${normalize(item.status)}`,

                    pretty(item.status)

                );


                wrapper.append(details, status);

            }


            container.appendChild(wrapper);

        });

    }


    /* =====================================================
       10. PANEL DATA LOADING
    ===================================================== */

    async function loadPanel(panel, force = false) {

        if (!authorized()) return;


        if (state.loading.has(panel)) {

            return;

        }


        if (
            state.cache[panel] &&
            !force
        ) {

            return;

        }


        state.loading.add(panel);


        try {

            const params = new URLSearchParams({

                page: "1",

                pageSize: String(CONFIG.PAGE_SIZE)

            });


            const filters =
                state.filters[panel] || {};


            Object.entries(filters).forEach(([key, value]) => {

                if (
                    value !== null &&
                    value !== undefined &&
                    value !== ""
                ) {

                    params.set(key, value);

                }

            });


            const query = `?${params.toString()}`;


            const data = await fetchPanelData(
                panel,
                query
            );


            state.cache[panel] = data;


            renderPanel(panel, data);


            setConnection(
                "online",
                "Compliance services connected"
            );


            setText(
                "last-updated",
                dateTime(new Date().toISOString())
            );


        } catch (error) {

            setConnection(
                "warning",
                "Some compliance data unavailable"
            );


            notice(
                `${PANEL_TITLES[panel]}: ${error.message}`,
                "warning"
            );

        } finally {

            state.loading.delete(panel);

        }

    }


    async function fetchPanelData(panel, query) {

        switch (panel) {

            case "overview":

                return request(
                    endpoint("overview") + query
                );


            case "jurisdictions": {

                const [jurisdictions, requirements] =
                    await Promise.all([

                        request(endpoint("jurisdictions") + query),

                        request(endpoint("requirements") + query)

                    ]);


                return {

                    jurisdictions,

                    requirements

                };

            }


            case "incidents": {

                const [incidents, enforcement] =
                    await Promise.all([

                        request(endpoint("incidents") + query),

                        request(endpoint("enforcement") + query)

                    ]);


                return {

                    incidents,

                    enforcement

                };

            }


            case "audits": {

                const [audits, corrective] =
                    await Promise.all([

                        request(endpoint("audits") + query),

                        request(endpoint("corrective") + query)

                    ]);


                return {

                    audits,

                    corrective

                };

            }


            case "reports": {

                const [reports, alerts, notifications] =
                    await Promise.all([

                        request(endpoint("reports") + query),

                        request(endpoint("alerts") + query),

                        request(endpoint("notifications") + query)

                    ]);


                return {

                    reports,

                    alerts,

                    notifications

                };

            }


            default:

                return request(
                    endpoint(panel) + query
                );

        }

    }


    function renderPanel(panel, data) {

        const renderers = {

            overview: renderOverview,

            jurisdictions: renderJurisdictions,

            employers: renderEmployers,

            employees: renderEmployees,

            evidence: renderEvidence,

            privacy: renderPrivacy,

            incidents: renderIncidents,

            audits: renderAudits,

            reports: renderReports

        };


        renderers[panel]?.(data);

    }


    /* =====================================================
       11. OVERVIEW
    ===================================================== */

    function renderOverview(data) {

        const metrics = data.metrics || {};


        renderMetricSet(metrics, {

            "overview-score": {
                field: "complianceScore",
                formatter: percent
            },

            "overview-countries": "jurisdictions",

            "overview-risks": "openRisks",

            "overview-investigations": "pendingInvestigations",

            "overview-corrective": "outstandingCorrectiveActions",

            "overview-deadlines": "upcomingDeadlines"

        });


        setText(

            "overview-score-period",

            metrics.assessmentPeriod
                ? `Assessment: ${metrics.assessmentPeriod}`
                : "Verified assessment period unavailable"

        );


        renderPortalStatuses(
            data.portals || {}
        );


        renderList(

            "jurisdiction-overview",

            getItems(data.jurisdictionSummary),

            "No jurisdiction compliance data received."

        );


        renderList(

            "priority-risk-list",

            getItems(data.priorityRisks),

            "No priority risk records received.",

            { event: true }

        );


        renderList(

            "deadline-list",

            getItems(data.upcomingDeadlines),

            "No upcoming deadline records received."

        );


        renderList(

            "recent-governance-activity",

            getItems(data.recentActivity),

            "No governance activity records received.",

            { event: true }

        );


        updateIncidentCount(
            metrics.openRisks
        );

    }


    function renderPortalStatuses(portals) {

        const mapping = [

            ["employer", "employer"],

            ["employee", "employee"],

            ["super_admin", "admin"]

        ];


        mapping.forEach(([key, prefix]) => {

            const portal = portals[key] || {};


            const status = normalize(
                portal.complianceStatus
            );


            const target = byId(
                `portal-${prefix}-status`
            );


            if (target) {

                target.textContent =
                    pretty(portal.complianceStatus);

                target.className = status;

            }


            setText(

                `portal-${prefix}-detail`,

                portal.description ||
                "Compliance status unavailable"

            );

        });

    }


    function updateIncidentCount(value) {

        const badge = byId("incident-count");


        if (
            typeof value !== "number" ||
            !Number.isFinite(value)
        ) {

            hide(badge);

            return;

        }


        setText("incident-count", value);


        if (value > 0) {

            show(badge);

        } else {

            hide(badge);

        }

    }


    /* =====================================================
       12. JURISDICTIONS AND REGULATIONS
    ===================================================== */

    function renderJurisdictions(data) {

        const jurisdictionData =
            data.jurisdictions || {};


        const requirementData =
            data.requirements || {};


        const jurisdictionMetrics =
            jurisdictionData.metrics || {};


        const requirementMetrics =
            requirementData.metrics || {};


        renderMetricSet(jurisdictionMetrics, {

            "jurisdiction-total": "total"

        });


        renderMetricSet(requirementMetrics, {

            "requirement-active": "active",

            "requirement-review": "pendingReview",

            "requirement-upcoming": "upcomingChanges"

        });


        const jurisdictions =
            getItems(jurisdictionData);


        const requirements =
            getItems(requirementData);


        renderTable(

            "jurisdiction-table",

            jurisdictions,

            7,

            (row, item) => {

                createCell(

                    row,

                    item.name ||
                    item.countryName,

                    true

                );


                createCell(
                    row,
                    item.authority
                );


                createCell(
                    row,
                    number(item.requirementCount)
                );


                statusCell(
                    row,
                    item.reviewStatus
                );


                createCell(
                    row,
                    dateTime(item.effectiveFrom)
                );


                statusCell(
                    row,
                    item.status
                );


                const td = create("td");

                td.appendChild(

                    createAction(

                        "View",

                        "view-jurisdiction",

                        getReference(item)

                    )

                );


                row.appendChild(td);

            },

            "No jurisdiction records received."

        );


        renderTable(

            "requirement-table",

            requirements,

            7,

            (row, item) => {

                createCell(
                    row,
                    item.title,
                    true
                );


                createCell(
                    row,
                    item.jurisdictionName ||
                    item.jurisdictionReference
                );


                createCell(
                    row,
                    pretty(item.category)
                );


                createCell(
                    row,
                    item.version
                );


                createCell(
                    row,
                    dateTime(item.effectiveFrom)
                );


                statusCell(
                    row,
                    item.reviewStatus
                );


                statusCell(
                    row,
                    item.status
                );

            },

            "No regulatory requirements received."

        );

    }


    /* =====================================================
       13. EMPLOYER COMPLIANCE
    ===================================================== */

    function renderEmployers(data) {

        const metrics = data.metrics || {};


        renderMetricSet(metrics, {

            "employer-assessed": "assessed",

            "employer-compliant": "compliant",

            "employer-attention": "requiresAttention",

            "employer-investigation": "underInvestigation"

        });


        renderTable(

            "employer-table",

            getItems(data),

            8,

            (row, item) => {

                createCell(
                    row,
                    item.name,
                    true
                );


                createCell(
                    row,
                    item.reference
                );


                createCell(
                    row,
                    item.jurisdictionName
                );


                statusCell(
                    row,
                    item.verificationStatus
                );


                statusCell(
                    row,
                    item.complianceStatus
                );


                createCell(
                    row,
                    number(item.outstandingIssues)
                );


                createCell(
                    row,
                    dateTime(item.lastAssessmentAt)
                );


                const td = create("td");

                const actions = create(
                    "div",
                    "row-actions"
                );


                actions.appendChild(

                    createAction(

                        "View",

                        "view-record",

                        getReference(item),

                        {

                            subjectType: "employer"

                        }

                    )

                );


                actions.appendChild(

                    createAction(

                        "Enforcement",

                        "enforce",

                        getReference(item),

                        {

                            subjectType: "employer",

                            subjectName: item.name

                        }

                    )

                );


                td.appendChild(actions);

                row.appendChild(td);

            },

            "No employer compliance records received."

        );

    }


    /* =====================================================
       14. EMPLOYEE COMPLIANCE
    ===================================================== */

    function renderEmployees(data) {

        const metrics = data.metrics || {};


        renderMetricSet(metrics, {

            "employee-assessed": "assessed",

            "employee-verified": "verified",

            "employee-pending": "pendingVerification",

            "employee-issues": "complianceIssues"

        });


        renderTable(

            "employee-table",

            getItems(data),

            8,

            (row, item) => {

                createCell(
                    row,
                    item.name,
                    true
                );


                createCell(
                    row,
                    item.reference
                );


                createCell(
                    row,
                    item.jurisdictionName
                );


                statusCell(
                    row,
                    item.identityStatus
                );


                statusCell(
                    row,
                    item.qualificationStatus
                );


                statusCell(
                    row,
                    item.complianceStatus
                );


                createCell(
                    row,
                    dateTime(item.lastAssessmentAt)
                );


                const td = create("td");

                const actions = create(
                    "div",
                    "row-actions"
                );


                actions.appendChild(

                    createAction(

                        "View",

                        "view-record",

                        getReference(item),

                        {

                            subjectType: "employee"

                        }

                    )

                );


                actions.appendChild(

                    createAction(

                        "Enforcement",

                        "enforce",

                        getReference(item),

                        {

                            subjectType: "employee",

                            subjectName: item.name

                        }

                    )

                );


                td.appendChild(actions);

                row.appendChild(td);

            },

            "No employee compliance records received."

        );

    }


    /* =====================================================
       15. DOCUMENTS AND EVIDENCE
    ===================================================== */

    function renderEvidence(data) {

        const metrics = data.metrics || {};


        renderMetricSet(metrics, {

            "evidence-total": "total",

            "evidence-verified": "verified",

            "evidence-expiring": "expiring",

            "evidence-issues": "issues"

        });


        renderTable(

            "evidence-table",

            getItems(data),

            7,

            (row, item) => {

                createCell(
                    row,
                    getReference(item),
                    true
                );


                createCell(
                    row,
                    item.documentType
                );


                createCell(
                    row,
                    pretty(item.ownerType)
                );


                createCell(
                    row,
                    item.jurisdictionName
                );


                statusCell(
                    row,
                    item.verificationStatus
                );


                createCell(
                    row,
                    dateTime(item.expiryDate)
                );


                statusCell(
                    row,
                    item.integrityStatus
                );

            },

            "No document compliance records received."

        );

    }


    /* =====================================================
       16. PRIVACY GOVERNANCE
    ===================================================== */

    function renderPrivacy(data) {

        const metrics = data.metrics || {};


        renderMetricSet(metrics, {

            "privacy-consents": "consentRecords",

            "privacy-reviews": "pendingReviews",

            "privacy-retention": "retentionReviewsDue",

            "privacy-incidents": "privacyIncidents"

        });


        renderTable(

            "privacy-table",

            getItems(data),

            7,

            (row, item) => {

                createCell(
                    row,
                    getReference(item),
                    true
                );


                createCell(
                    row,
                    pretty(item.governanceArea)
                );


                createCell(
                    row,
                    item.jurisdictionName
                );


                createCell(
                    row,
                    item.requirement
                );


                createCell(
                    row,
                    dateTime(item.reviewDate)
                );


                statusCell(
                    row,
                    item.complianceStatus
                );


                const td = create("td");


                td.appendChild(

                    createAction(

                        "View",

                        "view-record",

                        getReference(item),

                        {

                            subjectType: "privacy"

                        }

                    )

                );


                row.appendChild(td);

            },

            "No privacy governance records received."

        );

    }


    /* =====================================================
       17. RISK AND INCIDENTS
    ===================================================== */

    function renderIncidents(data) {

        const incidentData =
            data.incidents || {};


        const enforcementData =
            data.enforcement || {};


        const metrics =
            incidentData.metrics || {};


        renderMetricSet(metrics, {

            "risk-open": "open",

            "risk-critical": "critical",

            "risk-investigating": "investigating",

            "risk-resolved": "resolved"

        });


        updateIncidentCount(metrics.open);


        renderTable(

            "risk-table",

            getItems(incidentData),

            8,

            (row, item) => {

                createCell(
                    row,
                    getReference(item),
                    true
                );


                createCell(
                    row,
                    item.subjectName ||
                    item.subjectReference
                );


                createCell(
                    row,
                    pretty(item.category)
                );


                createCell(
                    row,
                    item.jurisdictionName
                );


                severityCell(
                    row,
                    item.severity
                );


                statusCell(
                    row,
                    item.status
                );


                createCell(
                    row,
                    dateTime(item.reportedAt)
                );


                const td = create("td");

                const actions = create(
                    "div",
                    "row-actions"
                );


                actions.appendChild(

                    createAction(

                        "View",

                        "view-incident",

                        getReference(item)

                    )

                );


                if (
                    item.subjectReference &&
                    ["employer", "employee"].includes(
                        normalize(item.subjectType)
                    )
                ) {

                    actions.appendChild(

                        createAction(

                            "Enforcement",

                            "enforce",

                            item.subjectReference,

                            {

                                subjectType: normalize(
                                    item.subjectType
                                ),

                                subjectName:
                                    item.subjectName || ""

                            }

                        )

                    );

                }


                td.appendChild(actions);

                row.appendChild(td);

            },

            "No compliance incident records received."

        );


        renderTable(

            "enforcement-table",

            getItems(enforcementData),

            7,

            (row, item) => {

                createCell(
                    row,
                    getReference(item),
                    true
                );


                createCell(
                    row,
                    item.subjectName ||
                    item.subjectReference
                );


                createCell(
                    row,
                    pretty(item.action)
                );


                createCell(
                    row,
                    item.reason
                );


                createCell(
                    row,
                    item.administrator?.displayName ||
                    item.administratorReference
                );


                createCell(
                    row,
                    dateTime(item.createdAt)
                );


                statusCell(
                    row,
                    item.outcome
                );

            },

            "No enforcement history received."

        );

    }


    /* =====================================================
       18. AUDITS AND CORRECTIVE ACTIONS
    ===================================================== */

    function renderAudits(data) {

        const auditData =
            data.audits || {};


        const correctiveData =
            data.corrective || {};


        const auditMetrics =
            auditData.metrics || {};


        const correctiveMetrics =
            correctiveData.metrics || {};


        renderMetricSet(auditMetrics, {

            "audit-total": "total",

            "audit-findings": "openFindings"

        });


        renderMetricSet(correctiveMetrics, {

            "audit-actions": "total",

            "audit-overdue": "overdue"

        });


        renderTable(

            "audit-table",

            getItems(auditData),

            7,

            (row, item) => {

                createCell(
                    row,
                    getReference(item),
                    true
                );


                createCell(
                    row,
                    item.administrator?.displayName ||
                    item.administratorReference
                );


                createCell(
                    row,
                    pretty(item.operation)
                );


                createCell(
                    row,
                    item.targetReference
                );


                createCell(
                    row,
                    item.justification
                );


                createCell(
                    row,
                    dateTime(item.timestamp)
                );


                statusCell(
                    row,
                    item.result
                );

            },

            "No governance audit records received."

        );


        renderTable(

            "corrective-table",

            getItems(correctiveData),

            7,

            (row, item) => {

                createCell(
                    row,
                    getReference(item),
                    true
                );


                createCell(
                    row,
                    item.findingReference
                );


                createCell(
                    row,
                    item.owner?.name ||
                    item.ownerReference
                );


                createCell(
                    row,
                    dateTime(item.dueDate)
                );


                createCell(
                    row,
                    percent(item.progress)
                );


                statusCell(
                    row,
                    item.verificationStatus
                );


                statusCell(
                    row,
                    item.status
                );

            },

            "No corrective action records received."

        );

    }


    /* =====================================================
       19. REPORTS AND NOTIFICATIONS
    ===================================================== */

    function renderReports(data) {

        const reportData =
            data.reports || {};


        const alertData =
            data.alerts || {};


        const notificationData =
            data.notifications || {};


        const reportMetrics =
            reportData.metrics || {};


        const alertMetrics =
            alertData.metrics || {};


        const notificationMetrics =
            notificationData.metrics || {};


        setMetric(
            "report-total",
            reportMetrics.total
        );


        setMetric(
            "report-alerts",
            alertMetrics.active
        );


        setMetric(
            "report-delivered",
            notificationMetrics.delivered
        );


        setMetric(
            "report-failed",
            notificationMetrics.failed
        );


        renderTable(

            "notification-table",

            getItems(notificationData),

            7,

            (row, item) => {

                createCell(
                    row,
                    getReference(item),
                    true
                );


                createCell(
                    row,
                    item.title ||
                    item.message
                );


                createCell(
                    row,
                    item.recipientGroup
                );


                createCell(
                    row,
                    pretty(item.channel)
                );


                createCell(
                    row,
                    dateTime(item.createdAt)
                );


                statusCell(
                    row,
                    item.deliveryStatus
                );


                createCell(
                    row,
                    dateTime(item.acknowledgedAt)
                );

            },

            "No notification history received."

        );


        renderTable(

            "report-table",

            getItems(reportData),

            7,

            (row, item) => {

                createCell(
                    row,
                    getReference(item),
                    true
                );


                createCell(
                    row,
                    pretty(item.category)
                );


                createCell(
                    row,
                    `${item.from || "—"} to ${item.to || "—"}`
                );


                createCell(
                    row,
                    item.generatedBy?.displayName
                );


                createCell(
                    row,
                    dateTime(item.createdAt)
                );


                statusCell(
                    row,
                    item.status
                );


                const td = create("td");


                if (
                    item.status === "completed" &&
                    getReference(item)
                ) {

                    td.appendChild(

                        createAction(

                            "Download",

                            "download-report",

                            getReference(item)

                        )

                    );

                } else {

                    td.textContent = "—";

                }


                row.appendChild(td);

            },

            "No compliance report history received."

        );


        renderNotificationFeed(
            getItems(notificationData)
        );


        renderNotificationCount(
            alertMetrics.active
        );

    }


    function renderNotificationFeed(items) {

        const container = byId(
            "notification-feed"
        );


        if (!container) return;


        container.replaceChildren();


        if (!items.length) {

            container.appendChild(

                create(
                    "div",
                    "empty-state",
                    "No Super Admin notifications received."
                )

            );

            return;

        }


        items.forEach(item => {

            const wrapper = create(
                "div",
                "event-item"
            );


            const icon = create(
                "div",
                "event-icon",
                "♢"
            );


            const details = create(
                "div",
                "event-info"
            );


            details.appendChild(

                create(
                    "strong",
                    "",
                    item.title || item.message
                )

            );


            details.appendChild(

                create(
                    "p",
                    "",
                    item.description ||
                    item.message ||
                    "No additional details."
                )

            );


            details.appendChild(

                create(
                    "small",
                    "",
                    dateTime(item.createdAt)
                )

            );


            wrapper.append(icon, details);

            container.appendChild(wrapper);

        });

    }


    function renderNotificationCount(value) {

        const badge = byId(
            "notification-count"
        );


        if (
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            value <= 0
        ) {

            hide(badge);

            return;

        }


        setText(
            "notification-count",
            number(value)
        );


        show(badge);

    }


    /* =====================================================
       20. MANAGEMENT MODAL
    ===================================================== */

    const FORM_TITLES = {

        "jurisdiction-form": "Add Global Jurisdiction",

        "requirement-form": "Add Regulatory Requirement",

        "enforcement-form": "Progressive Compliance Enforcement",

        "corrective-form": "Create Corrective Action"

    };


    function openForm(formId, context = {}) {

        if (!authorized()) return;


        const form = byId(formId);


        if (!form) {

            toast(
                "Management form unavailable.",
                "error"
            );

            return;

        }


        state.activeForm = formId;

        state.lastFocus = document.activeElement;


        $$(".modal-form").forEach(item => {

            item.hidden = item.id !== formId;

        });


        setText(
            "modal-title",
            FORM_TITLES[formId] || "Management Form"
        );


        form.reset();


        if (formId === "enforcement-form") {

            form.elements.subjectType.value =
                context.subjectType || "employer";


            form.elements.subjectReference.value =
                context.reference || "";


            if (context.subjectName) {

                form.elements.subjectReference.title =
                    context.subjectName;

            }

        }


        show(
            byId("management-modal")
        );


        const firstInput = $(
            "input:not([type=hidden]), select, textarea",
            form
        );


        firstInput?.focus();

    }


    function closeForm() {

        hide(
            byId("management-modal")
        );


        state.activeForm = null;


        state.lastFocus?.focus?.();

        state.lastFocus = null;

    }


    function initializeModals() {

        $$("[data-open-form]").forEach(button => {

            button.addEventListener("click", () => {

                openForm(
                    button.dataset.openForm
                );

            });

        });


        $$("[data-close-modal]").forEach(button => {

            button.addEventListener(
                "click",
                closeForm
            );

        });


        byId("modal-close")
            ?.addEventListener("click", closeForm);


        byId("management-modal")
            ?.addEventListener("click", event => {

                if (
                    event.target.id === "management-modal"
                ) {

                    closeForm();

                }

            });

    }


    /* =====================================================
       21. FORM SERIALIZATION
    ===================================================== */

    function formPayload(form) {

        const data = new FormData(form);

        const payload = {};


        for (const [key, value] of data.entries()) {

            if (
                key === "confirmation" ||
                value === ""
            ) {

                continue;

            }


            payload[key] = value;

        }


        return payload;

    }


    function validateDateRange(payload) {

        if (
            payload.from &&
            payload.to &&
            payload.from > payload.to
        ) {

            throw new Error(
                "The start date cannot be later than the end date."
            );

        }

    }


    function validateEnforcement(payload) {

        if (
            !payload.reason ||
            payload.reason.trim().length < 10
        ) {

            throw new Error(
                "A detailed enforcement justification of at least 10 characters is required."
            );

        }


        if (
            payload.stage === "restrict" &&
            !payload.restrictionScope
        ) {

            throw new Error(
                "Specify exactly which platform activities are being considered for restriction."
            );

        }


        if (
            !payload.subjectReference
        ) {

            throw new Error(
                "A valid employer or employee reference is required."
            );

        }

    }


    /* =====================================================
       22. FORM SUBMISSION
    ===================================================== */

    const FORM_ENDPOINTS = {

        "jurisdiction-form": "jurisdictions",

        "requirement-form": "requirements",

        "enforcement-form": "enforcement",

        "corrective-form": "corrective",

        "report-form": "reports"

    };


    async function submitForm(event) {

        event.preventDefault();


        if (!authorized()) return;


        const form = event.currentTarget;

        const formId = form.id;


        if (!form.reportValidity()) return;


        const route = FORM_ENDPOINTS[formId];


        if (!route) {

            toast(
                "No submission service is configured for this form.",
                "error"
            );

            return;

        }


        const payload = formPayload(form);


        try {

            if (formId === "enforcement-form") {

                validateEnforcement(payload);

            }


            if (formId === "report-form") {

                validateDateRange(payload);

            }


            if (
                formId === "jurisdiction-form" &&
                payload.sourceUrl
            ) {

                const source = new URL(payload.sourceUrl);

                if (source.protocol !== "https:") {

                    throw new Error(
                        "Regulatory source links must use HTTPS."
                    );

                }

            }


            if (formId === "requirement-form") {

                if (
                    !payload.source ||
                    !payload.version ||
                    !payload.description
                ) {

                    throw new Error(
                        "Regulatory source, version and description are required."
                    );

                }

            }


            if (formId === "enforcement-form") {

                const confirmed = window.confirm(

                    `Submit the ${pretty(payload.stage)} request for server-side authorization?`

                );


                if (!confirmed) return;

            }


            const submitButton = $(
                'button[type="submit"]',
                form
            );


            if (submitButton) {

                submitButton.disabled = true;

            }


            const result = await request(

                endpoint(route),

                {

                    method: "POST",

                    body: payload

                }

            );


            toast(

                result?.message ||

                "Your request was accepted by the server for processing.",

                "success"

            );


            closeForm();


            invalidateRelatedPanels(formId);


            await loadPanel(
                state.activePanel,
                true
            );


        } catch (error) {

            toast(
                error.message,
                "error"
            );

        } finally {

            const submitButton = $(
                'button[type="submit"]',
                form
            );


            if (submitButton) {

                submitButton.disabled = false;

            }

        }

    }


    function invalidateRelatedPanels(formId) {

        const affected = {

            "jurisdiction-form": [
                "jurisdictions",
                "overview"
            ],

            "requirement-form": [
                "jurisdictions",
                "overview"
            ],

            "enforcement-form": [
                "employers",
                "employees",
                "incidents",
                "audits",
                "overview"
            ],

            "corrective-form": [
                "audits",
                "overview"
            ],

            "report-form": [
                "reports"
            ]

        };


        (affected[formId] || []).forEach(panel => {

            delete state.cache[panel];

        });

    }


    function initializeForms() {

        $$(".modal-form, #report-form").forEach(form => {

            form.addEventListener(
                "submit",
                submitForm
            );

        });

    }


    /* =====================================================
       23. FILTERING
    ===================================================== */

    function filterPanel(panel, values) {

        if (!authorized()) return;


        state.filters[panel] = values;


        delete state.cache[panel];


        loadPanel(
            panel,
            true
        );

    }


    function initializeFilters() {

        const filters = [

            {

                button: "employer-filter",

                panel: "employers",

                fields: {

                    search: "employer-search",

                    status: "employer-status-filter"

                }

            },

            {

                button: "employee-filter",

                panel: "employees",

                fields: {

                    search: "employee-search",

                    status: "employee-status-filter"

                }

            },

            {

                button: "evidence-filter",

                panel: "evidence",

                fields: {

                    search: "evidence-search",

                    status: "evidence-status-filter"

                }

            },

            {

                button: "privacy-filter",

                panel: "privacy",

                fields: {

                    search: "privacy-search",

                    status: "privacy-status-filter"

                }

            },

            {

                button: "risk-filter",

                panel: "incidents",

                fields: {

                    search: "risk-search",

                    severity: "risk-severity-filter",

                    status: "risk-status-filter"

                }

            },

            {

                button: "audit-filter",

                panel: "audits",

                fields: {

                    search: "audit-search"

                }

            }

        ];


        filters.forEach(config => {

            byId(config.button)
                ?.addEventListener("click", () => {

                    const values = {};


                    Object.entries(config.fields).forEach(
                        ([key, id]) => {

                            values[key] =
                                byId(id)?.value.trim() || "";

                        }
                    );


                    filterPanel(
                        config.panel,
                        values
                    );

                });

        });


        byId("jurisdiction-search")
            ?.addEventListener("input", () => {

                const search = normalize(
                    byId("jurisdiction-search").value
                );


                const data =
                    state.cache.jurisdictions?.jurisdictions;


                if (!data) return;


                const items = getItems(data);


                renderTable(

                    "jurisdiction-table",

                    items.filter(item => {

                        return (

                            normalize(item.name).includes(search) ||

                            normalize(item.countryName).includes(search) ||

                            normalize(item.code).includes(search)

                        );

                    }),

                    7,

                    (row, item) => {

                        createCell(
                            row,
                            item.name || item.countryName,
                            true
                        );

                        createCell(row, item.authority);

                        createCell(row, number(item.requirementCount));

                        statusCell(row, item.reviewStatus);

                        createCell(row, dateTime(item.effectiveFrom));

                        statusCell(row, item.status);

                        const td = create("td");

                        td.appendChild(
                            createAction(
                                "View",
                                "view-jurisdiction",
                                getReference(item)
                            )
                        );

                        row.appendChild(td);

                    },

                    "No matching jurisdiction records."

                );

            });

    }


    /* =====================================================
       24. RECORD DETAILS
    ===================================================== */

    function showRecordDetails(type, reference) {

        if (!authorized()) return;


        const routes = {

            employer: "employers",

            employee: "employees",

            privacy: "privacy",

            jurisdiction: "jurisdictions",

            incident: "incidents"

        };


        const route = routes[type];


        if (!route || !reference) {

            toast(
                "Record details are unavailable.",
                "warning"
            );

            return;

        }


        const path = safePath(
            endpoint(route),
            reference
        );


        request(path)

            .then(data => {

                const record =
                    data.record || data;


                const details = [

                    ["Reference", getReference(record)],

                    ["Name", record.name],

                    ["Country", record.countryName],

                    ["Jurisdiction", record.jurisdictionName],

                    ["Compliance Status", pretty(record.complianceStatus)],

                    ["Verification", pretty(record.verificationStatus)],

                    ["Review Status", pretty(record.reviewStatus)],

                    ["Last Assessment", dateTime(record.lastAssessmentAt)],

                    ["Description", record.description]

                ];


                const message = details

                    .filter(([, value]) => value !== undefined && value !== null)

                    .map(([key, value]) =>
                        `${key}: ${value || "Not provided"}`
                    )

                    .join("\n");


                toast(
                    message || "No additional record information returned.",
                    "info"
                );

            })

            .catch(error => {

                toast(error.message, "error");

            });

    }


    /* =====================================================
       25. ENFORCEMENT ACTIONS
    ===================================================== */

    function openEnforcement(button) {

        const reference =
            button.dataset.reference;


        const subjectType =
            button.dataset.subjectType;


        if (
            !reference ||
            !["employer", "employee"].includes(subjectType)
        ) {

            toast(
                "A valid employer or employee reference is required.",
                "error"
            );

            return;

        }


        openForm(

            "enforcement-form",

            {

                reference,

                subjectType,

                subjectName: button.dataset.subjectName

            }

        );

    }


    /* =====================================================
       26. REPORT DOWNLOAD
    ===================================================== */

    async function downloadReport(reference) {

        if (!authorized()) return;


        try {

            const response = await fetch(

                `${safePath(endpoint("reports"), reference)}/download`,

                {

                    method: "GET",

                    credentials: "same-origin"

                }

            );


            if (!response.ok) {

                throw new Error(
                    `Report download failed (${response.status}).`
                );

            }


            const blob = await response.blob();


            const url = URL.createObjectURL(blob);

            const link = create("a");


            link.href = url;

            link.download = "talvora-compliance-report";


            document.body.appendChild(link);

            link.click();

            link.remove();


            URL.revokeObjectURL(url);


            toast(
                "Report download received from the server.",
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
       27. AUDIT EXPORT
    ===================================================== */

    async function exportAudit() {

        if (!authorized()) return;


        try {

            const response = await fetch(

                `${endpoint("audits")}/export?format=csv`,

                {

                    method: "GET",

                    credentials: "same-origin"

                }

            );


            if (!response.ok) {

                throw new Error(
                    `Audit export failed (${response.status}).`
                );

            }


            const blob = await response.blob();


            const url = URL.createObjectURL(blob);

            const link = create("a");


            link.href = url;

            link.download = "talvora-governance-audit.csv";


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
       28. NOTIFICATION DRAWER
    ===================================================== */

    async function openNotifications() {

        if (!authorized()) return;


        show(
            byId("notification-drawer")
        );


        try {

            const result = await request(
                endpoint("notifications")
            );


            renderNotificationFeed(
                getItems(result)
            );


        } catch (error) {

            toast(
                error.message,
                "error"
            );

        }

    }


    function initializeNotifications() {

        byId("notification-button")
            ?.addEventListener(
                "click",
                openNotifications
            );


        byId("drawer-close")
            ?.addEventListener("click", () => {

                hide(
                    byId("notification-drawer")
                );

            });

    }


    /* =====================================================
       29. GLOBAL ACTION HANDLER
    ===================================================== */

    function initializeActions() {

        document.addEventListener("click", event => {

            const button = event.target.closest(
                "[data-action]"
            );


            if (!button) return;


            const action =
                button.dataset.action;


            const reference =
                button.dataset.reference;


            switch (action) {

                case "enforce":

                    openEnforcement(button);

                    break;


                case "view-record":

                    showRecordDetails(

                        button.dataset.subjectType,

                        reference

                    );

                    break;


                case "view-jurisdiction":

                    showRecordDetails(
                        "jurisdiction",
                        reference
                    );

                    break;


                case "view-incident":

                    showRecordDetails(
                        "incident",
                        reference
                    );

                    break;


                case "download-report":

                    downloadReport(reference);

                    break;


                default:

                    break;

            }

        });


        byId("audit-export")
            ?.addEventListener("click", exportAudit);

    }


    /* =====================================================
       30. REFRESH
    ===================================================== */

    async function refreshCurrentPanel() {

        if (!authorized()) return;


        if (state.refreshing) return;


        state.refreshing = true;


        const button = byId("refresh-button");

        if (button) button.disabled = true;


        try {

            delete state.cache[
                state.activePanel
            ];


            await loadPanel(
                state.activePanel,
                true
            );


        } finally {

            state.refreshing = false;

            if (button) button.disabled = false;

        }

    }


    function stopRefresh() {

        if (state.refreshTimer) {

            window.clearInterval(
                state.refreshTimer
            );

        }


        state.refreshTimer = null;

    }


    function startRefresh() {

        stopRefresh();


        state.refreshTimer =
            window.setInterval(() => {

                if (
                    document.visibilityState !== "visible" ||
                    !state.authenticated ||
                    state.refreshing
                ) {

                    return;

                }


                refreshCurrentPanel();

            }, CONFIG.REFRESH_INTERVAL);

    }


    function initializeRefresh() {

        byId("refresh-button")
            ?.addEventListener(
                "click",
                refreshCurrentPanel
            );


        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.visibilityState === "visible" &&
                    state.authenticated
                ) {

                    refreshCurrentPanel();

                }

            }
        );

    }


    /* =====================================================
       31. KEYBOARD AND MODAL ACCESSIBILITY
    ===================================================== */

    function initializeKeyboard() {

        document.addEventListener("keydown", event => {

            if (event.key === "Escape") {

                closeForm();

                closeSidebar();

                hide(
                    byId("notification-drawer")
                );

            }

        });

    }


    /* =====================================================
       32. SECURITY ARCHITECTURE
    ===================================================== */

    function initializeSecurity() {

        /*
         * TALVORA SUPER ADMIN ACCESS
         *
         * - Ten authorised Super Admin accounts.
         * - All ten receive the approved Super Admin access.
         * - Identity and role verification is performed by
         *   the central authentication backend.
         * - The browser never grants its own privileges.
         *
         * GLOBAL JURISDICTIONS
         *
         * - Every country has an independently configured
         *   jurisdiction record.
         * - Regulatory requirements retain their source,
         *   version, effective date and review history.
         * - Unreviewed regulations cannot be assumed valid.
         *
         * ENFORCEMENT
         *
         * - Warning
         * - Compliance flag
         * - Relevant activity restriction
         * - Investigation
         * - Suspension
         * - Reinstatement
         *
         * Every enforcement request must contain:
         *
         * - Subject reference
         * - Subject type
         * - Enforcement stage
         * - Reason
         * - Supporting evidence where required
         * - Requesting administrator
         *
         * The backend must independently verify:
         *
         * - Administrator identity
         * - Role and permission
         * - Applicable jurisdiction
         * - Regulatory requirement
         * - Supporting evidence
         * - Action proportionality
         * - Existing enforcement history
         * - Any applicable review or approval requirements
         *
         * Suspension and reinstatement must never be
         * performed solely by client-side JavaScript.
         *
         * DATA PROTECTION
         *
         * - Do not expose document contents unnecessarily.
         * - Do not expose authentication credentials.
         * - Respect consent and access restrictions.
         * - Enforce tenant and record access server-side.
         *
         * AUDIT
         *
         * - Administrative events must be append-only.
         * - The server records administrator identity.
         * - The server records timestamps and outcomes.
         * - The frontend cannot delete audit history.
         *
         * RETENTION
         *
         * - Target retention: 365 days.
         * - Legal holds and applicable retention rules
         *   must override ordinary deletion schedules.
         *
         * NOTIFICATIONS
         *
         * - In-platform messages.
         * - Email notifications.
         * - Super Admin alerts.
         * - No SMS channel is configured.
         *
         * DATA INTEGRITY
         *
         * - Missing records display as unavailable.
         * - Failed API calls never create fake healthy states.
         * - Metrics must originate from backend calculations.
         *
         */

    }


    /* =====================================================
       33. CLEANUP
    ===================================================== */

    function initializeCleanup() {

        window.addEventListener("pagehide", () => {

            state.destroyed = true;

            stopRefresh();

        });

    }


    /* =====================================================
       34. APPLICATION STARTUP
    ===================================================== */

    async function initialize() {

        initializeSidebar();

        initializeNavigation();

        initializeModals();

        initializeForms();

        initializeFilters();

        initializeNotifications();

        initializeActions();

        initializeRefresh();

        initializeKeyboard();

        initializeSecurity();

        initializeCleanup();


        const authenticated =
            await verifyAdministrator();


        if (!authenticated) {

            return;

        }


        await loadPanel(
            state.activePanel,
            true
        );


        startRefresh();


        console.info(
            "TALVORA Compliance & Governance Centre initialized."
        );

    }


    /* =====================================================
       35. START APPLICATION
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
