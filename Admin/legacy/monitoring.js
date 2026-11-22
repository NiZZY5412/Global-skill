
/* =========================================================
   TALVORA TECHNOLOGIES
   SYSTEM MONITORING & INFRASTRUCTURE CENTRE
   GSES SYSTEM 001

   PRODUCTION-ORIENTED FRONTEND

   NO DEMO DATA
   NO FABRICATED METRICS
   NO SIMULATED SERVER STATUS
   NO FAKE INCIDENTS
   NO CLIENT-SIDE PRIVILEGE EXECUTION

   BACKEND IMPLEMENTATION REMAINS A SEPARATE FINAL PHASE.
========================================================= */

"use strict";

(() => {

    /* =====================================================
       01. CONFIGURATION
    ===================================================== */

    const CONFIG = Object.freeze({

        API: "/api/v1/admin/monitoring",

        SESSION: "/api/v1/auth/session",

        REFRESH_INTERVAL: 30000,

        REQUEST_TIMEOUT: 20000,

        HISTORY_RETENTION_DAYS: 365,

        PAGE_SIZE: 25,

        AUTHORIZED_ADMIN_COUNT: 10,

        PORTALS: [
            "employer",
            "employee",
            "super_admin"
        ],

        PANELS: [

            "overview",
            "infrastructure",
            "servers",
            "database",
            "storage",
            "network",
            "apis",
            "portals",
            "integrations",
            "jobs",
            "performance",
            "security",
            "incidents",
            "alerts",
            "maintenance",
            "deployments",
            "scheduled",
            "capacity",
            "reports",
            "audit"

        ]

    });


    /* =====================================================
       02. API ROUTES
    ===================================================== */

    const ROUTES = Object.freeze({

        overview: "/overview",

        infrastructure: "/infrastructure",

        servers: "/servers",

        database: "/database",

        storage: "/storage",

        network: "/network",

        apis: "/apis",

        portals: "/portals",

        integrations: "/integrations",

        jobs: "/jobs",

        performance: "/performance",

        security: "/security/events",

        incidents: "/incidents",

        alerts: "/alerts",

        maintenance: "/maintenance",

        deployments: "/deployments",

        scheduled: "/maintenance/scheduled",

        capacity: "/capacity",

        reports: "/reports",

        audit: "/audit"

    });


    /* =====================================================
       03. STATE
    ===================================================== */

    const state = {

        authenticated: false,

        administrator: null,

        csrfToken: null,

        activePanel: "overview",

        panelCache: {},

        panelPages: {},

        loading: new Set(),

        filters: {},

        incidentReference: null,

        pendingAction: null,

        lastFocus: null,

        refreshTimer: null,

        countdownTimer: null,

        countdown: 30,

        refreshing: false,

        destroyed: false

    };


    /* =====================================================
       04. DOM UTILITIES
    ===================================================== */

    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

    const $$ = (selector, parent = document) =>
        Array.from(parent.querySelectorAll(selector));


    function byId(id) {

        return document.getElementById(id);

    }


    function text(id, value) {

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


    function element(tag, className, content) {

        const node = document.createElement(tag);

        if (className) node.className = className;

        if (content !== undefined && content !== null) {

            node.textContent = String(content);

        }

        return node;

    }


    function normalize(value) {

        return String(value || "unknown")
            .toLowerCase()
            .trim()
            .replace(/[\s-]+/g, "_");

    }


    function pretty(value) {

        if (value === null || value === undefined || value === "") {

            return "Unknown";

        }

        return String(value)
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, character =>
                character.toUpperCase()
            );

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


    function percentage(value) {

        if (
            typeof value !== "number" ||
            !Number.isFinite(value)
        ) {

            return "—";

        }

        return `${value.toFixed(2)}%`;

    }


    function milliseconds(value) {

        if (
            typeof value !== "number" ||
            !Number.isFinite(value)
        ) {

            return "—";

        }

        return `${value.toFixed(1)} ms`;

    }


    function dateTime(value) {

        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "—";


        return new Intl.DateTimeFormat(undefined, {

            dateStyle: "medium",

            timeStyle: "short"

        }).format(date);

    }


    function bytes(value) {

        if (
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            value < 0
        ) {

            return "—";

        }


        if (value === 0) return "0 B";


        const units = [
            "B",
            "KB",
            "MB",
            "GB",
            "TB",
            "PB"
        ];


        const index = Math.min(

            Math.floor(Math.log(value) / Math.log(1024)),

            units.length - 1

        );


        return `${(value / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;

    }


    function getItems(data) {

        if (Array.isArray(data)) return data;

        if (Array.isArray(data?.items)) return data.items;

        if (Array.isArray(data?.records)) return data.records;

        if (Array.isArray(data?.results)) return data.results;

        return [];

    }


    function refOf(item) {

        return item?.reference ||
            item?.id ||
            item?.key ||
            null;

    }


    function safePath(base, reference) {

        if (!reference) {

            throw new Error(
                "A valid resource reference is required."
            );

        }

        return `${base}/${encodeURIComponent(reference)}`;

    }


    function emptyRow(id, columns, message) {

        const body = byId(id);

        if (!body) return;


        body.replaceChildren();


        const row = element("tr");

        const cell = element(
            "td",
            "empty-cell",
            message
        );


        cell.colSpan = columns;

        row.appendChild(cell);

        body.appendChild(row);

    }


    function clearTable(id) {

        const body = byId(id);

        if (!body) return null;

        body.replaceChildren();

        return body;

    }


    function cell(row, value, bold = false) {

        const td = element("td");


        const valueText =
            value === null ||
                value === undefined ||
                value === ""
                ? "—"
                : String(value);


        if (bold) {

            td.appendChild(
                element("strong", "", valueText)
            );

        } else {

            td.textContent = valueText;

        }


        row.appendChild(td);

        return td;

    }


    function statusCell(row, value) {

        const td = element("td");


        const badge = element(
            "span",
            `status-badge ${normalize(value)}`,
            pretty(value)
        );


        td.appendChild(badge);

        row.appendChild(td);

    }


    function severityCell(row, value) {

        const td = element("td");


        td.appendChild(
            element(
                "span",
                `severity-badge ${normalize(value)}`,
                pretty(value)
            )
        );


        row.appendChild(td);

    }


    function actionButton(label, callback, danger = false) {

        const button = element(
            "button",
            `row-button${danger ? " danger" : ""}`,
            label
        );


        button.type = "button";

        button.addEventListener("click", callback);

        return button;

    }


    function actionsCell(row, actions) {

        const td = element("td");

        const wrapper = element("div", "row-actions");


        actions.forEach(action => {

            wrapper.appendChild(

                actionButton(
                    action.label,
                    action.callback,
                    action.danger
                )

            );

        });


        td.appendChild(wrapper);

        row.appendChild(td);

    }


    function emptyState(containerId, message) {

        const container = byId(containerId);

        if (!container) return;


        container.replaceChildren();

        container.appendChild(
            element("div", "empty-state", message)
        );

    }


    /* =====================================================
       05. NOTIFICATIONS
    ===================================================== */

    function toast(message, type = "info") {

        const container = byId("toast-container");

        if (!container) return;


        const item = element(
            "div",
            `monitor-toast ${type}`,
            message
        );


        item.setAttribute("role", "status");

        container.appendChild(item);


        window.setTimeout(() => {

            item.remove();

        }, 5000);

    }


    function notice(message, type = "info") {

        const target = byId("monitoring-notice");

        if (!target) return;


        target.className =
            `monitoring-notice ${type}`;

        target.textContent = message;

        show(target);

    }


    function clearNotice() {

        const target = byId("monitoring-notice");

        if (!target) return;

        target.textContent = "";

        hide(target);

    }


    /* =====================================================
       06. API CLIENT
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

            headers["X-CSRF-Token"] =
                state.csrfToken;

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
                    "Your administrator session has expired. Please authenticate again."
                );

            }


            if (response.status === 403) {

                throw new Error(
                    "The server rejected this administrative operation."
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
                    "Monitoring request timed out."
                );

            }


            if (error instanceof TypeError) {

                throw new Error(
                    "Unable to connect to the monitoring backend."
                );

            }


            throw error;

        } finally {

            window.clearTimeout(timeout);

        }

    }


    function api(panel) {

        const route = ROUTES[panel];

        if (!route) {

            throw new Error(
                `No API route configured for ${panel}.`
            );

        }

        return CONFIG.API + route;

    }


    /* =====================================================
       07. AUTHENTICATION
    ===================================================== */

    async function verifySession() {

        try {

            const result = await request(
                CONFIG.SESSION
            );


            if (
                result?.authenticated !== true ||
                result?.user?.role !== "super_admin"
            ) {

                state.authenticated = false;

                notice(
                    "Verified Super Admin authentication is required.",
                    "error"
                );

                return false;

            }


            state.administrator = result.user;

            state.authenticated = true;

            state.csrfToken =
                result.csrfToken || null;


            const name =
                result.user.displayName ||
                result.user.name ||
                "Super Administrator";


            text("admin-name", name);

            text("admin-email", result.user.email);


            const initials = name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(part => part[0])
                .join("")
                .toUpperCase();


            text("admin-avatar", initials);


            setConnection(
                "online",
                "Administrator session verified"
            );


            return true;

        } catch (error) {

            state.authenticated = false;

            setConnection(
                "offline",
                "Session verification failed"
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


    /* =====================================================
       08. CONNECTION STATUS
    ===================================================== */

    function setConnection(status, message) {

        const dot = byId("connection-dot");

        if (dot) {

            dot.classList.toggle(
                "online",
                status === "online"
            );

        }


        text(
            "connection-text",
            message
        );

    }


    /* =====================================================
       09. NAVIGATION
    ===================================================== */

    function navigate(panel, updateHash = true) {

        if (!CONFIG.PANELS.includes(panel)) {

            panel = "overview";

        }


        state.activePanel = panel;


        $$(".monitor-panel").forEach(section => {

            const active =
                section.id === `panel-${panel}`;


            section.classList.toggle(
                "active",
                active
            );


            section.hidden = !active;

        });


        $$(".monitor-nav").forEach(link => {

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


        const activeLink = $(
            `.monitor-nav[data-panel="${panel}"]`
        );


        text(
            "current-page-title",
            activeLink?.textContent.trim() ||
            "System Monitoring Centre"
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

        $$(".monitor-nav").forEach(link => {

            link.addEventListener("click", event => {

                event.preventDefault();

                navigate(
                    link.dataset.panel
                );

            });

        });


        $$("[data-panel]").forEach(button => {

            if (button.classList.contains("monitor-nav")) {
                return;
            }


            button.addEventListener("click", () => {

                navigate(button.dataset.panel);

            });

        });


        const initial =
            location.hash.replace("#", "");


        state.activePanel =
            CONFIG.PANELS.includes(initial)
                ? initial
                : "overview";


        navigate(
            state.activePanel,
            false
        );

    }


    /* =====================================================
       10. SIDEBAR
    ===================================================== */

    function openSidebar() {

        byId("monitoring-sidebar")
            ?.classList.add("open");

        show(
            byId("sidebar-overlay")
        );

    }


    function closeSidebar() {

        byId("monitoring-sidebar")
            ?.classList.remove("open");

        hide(
            byId("sidebar-overlay")
        );

    }


    function initializeSidebar() {

        byId("menu-toggle")
            ?.addEventListener("click", openSidebar);

        byId("sidebar-close")
            ?.addEventListener("click", closeSidebar);

        byId("sidebar-overlay")
            ?.addEventListener("click", closeSidebar);

    }


    /* =====================================================
       11. PANEL LOADING
    ===================================================== */

    async function loadPanel(panel, force = false) {

        if (!authorized()) return;


        if (
            state.loading.has(panel) ||
            (
                state.panelCache[panel] &&
                !force
            )
        ) {

            return;

        }


        state.loading.add(panel);


        try {

            const query = new URLSearchParams({

                page: String(
                    state.panelPages[panel] || 1
                ),

                pageSize: String(
                    CONFIG.PAGE_SIZE
                )

            });


            const filters =
                state.filters[panel] || {};


            Object.entries(filters).forEach(
                ([key, value]) => {

                    if (
                        value !== null &&
                        value !== undefined &&
                        value !== ""
                    ) {

                        query.set(key, value);

                    }

                }
            );


            const result = await request(

                `${api(panel)}?${query.toString()}`

            );


            if (
                !result ||
                typeof result !== "object"
            ) {

                throw new Error(
                    "The monitoring service returned an invalid response."
                );

            }


            state.panelCache[panel] = result;


            renderPanel(panel, result);


            setConnection(
                "online",
                "Monitoring service connected"
            );


            text(
                "last-updated",
                dateTime(new Date().toISOString())
            );


        } catch (error) {

            setConnection(
                "offline",
                "Monitoring data unavailable"
            );


            notice(
                `${pretty(panel)}: ${error.message}`,
                "warning"
            );

        } finally {

            state.loading.delete(panel);

        }

    }


    function renderPanel(panel, data) {

        const renderers = {

            overview: renderOverview,

            infrastructure: renderInfrastructure,

            servers: renderServers,

            database: renderDatabase,

            storage: renderStorage,

            network: renderNetwork,

            apis: renderApis,

            portals: renderPortals,

            integrations: renderIntegrations,

            jobs: renderJobs,

            performance: renderPerformance,

            security: renderSecurity,

            incidents: renderIncidents,

            alerts: renderAlerts,

            maintenance: renderMaintenance,

            deployments: renderDeployments,

            scheduled: renderScheduled,

            capacity: renderCapacity,

            reports: renderReports,

            audit: renderAudit

        };


        renderers[panel]?.(data);

    }


    /* =====================================================
       12. STATUS HELPERS
    ===================================================== */

    function health(value) {

        return normalize(value);

    }


    function resourceItem(item) {

        const wrapper = element(
            "div",
            "resource-item"
        );


        const top = element(
            "div",
            "resource-item-top"
        );


        const name =
            item.name ||
            item.resource ||
            item.label ||
            "Infrastructure resource";


        top.appendChild(
            element("strong", "", name)
        );


        const usage =
            typeof item.utilization === "number"
                ? item.utilization
                : null;


        top.appendChild(
            element(
                "span",
                "",
                usage === null
                    ? pretty(item.status)
                    : percentage(usage)
            )
        );


        wrapper.appendChild(top);


        if (
            usage !== null &&
            usage >= 0 &&
            usage <= 100
        ) {

            const track = element(
                "div",
                "resource-track"
            );


            const fill = element(
                "div",
                "resource-fill"
            );


            fill.style.width = `${usage}%`;


            if (usage >= 90) {

                fill.classList.add("danger");

            } else if (usage >= 75) {

                fill.classList.add("warning");

            }


            track.appendChild(fill);

            wrapper.appendChild(track);

        }


        const foot = element(
            "div",
            "resource-foot"
        );


        foot.appendChild(
            element(
                "span",
                "",
                item.description || item.type || "Resource"
            )
        );


        foot.appendChild(
            element(
                "span",
                "",
                item.lastReportedAt
                    ? dateTime(item.lastReportedAt)
                    : "Latest report unavailable"
            )
        );


        wrapper.appendChild(foot);


        return wrapper;

    }


    function renderResourceList(id, items, message) {

        const container = byId(id);

        if (!container) return;


        container.replaceChildren();


        if (!items.length) {

            container.appendChild(
                element("div", "empty-state", message)
            );

            return;

        }


        items.forEach(item => {

            container.appendChild(
                resourceItem(item)
            );

        });

    }


    function renderEvents(id, items, message) {

        const container = byId(id);

        if (!container) return;


        container.replaceChildren();


        if (!items.length) {

            container.appendChild(
                element("div", "empty-state", message)
            );

            return;

        }


        items.forEach(item => {

            const wrapper = element(
                "div",
                "event-item"
            );


            const severity =
                normalize(item.severity);


            const symbol = element(
                "div",
                `event-symbol ${severity}`,
                severity === "critical" ? "!" : "•"
            );


            const details = element(
                "div",
                "event-info"
            );


            details.appendChild(
                element(
                    "strong",
                    "",
                    item.title ||
                    item.name ||
                    item.message ||
                    "Infrastructure event"
                )
            );


            details.appendChild(
                element(
                    "p",
                    "",
                    item.description ||
                    item.summary ||
                    "No additional description supplied."
                )
            );


            details.appendChild(
                element(
                    "small",
                    "",
                    dateTime(
                        item.detectedAt ||
                        item.createdAt
                    )
                )
            );


            wrapper.append(symbol, details);

            container.appendChild(wrapper);

        });

    }


    /* =====================================================
       13. METRIC HELPERS
    ===================================================== */

    function setMetric(id, value, formatter = number) {

        text(
            id,
            value === undefined ||
                value === null
                ? "—"
                : formatter(value)
        );

    }


    function renderMetricGroup(mapping, data) {

        Object.entries(mapping).forEach(
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


    function renderStatusTable(
        id,
        items,
        columns,
        renderer,
        message
    ) {

        const body = clearTable(id);

        if (!body) return;


        if (!items.length) {

            emptyRow(
                id,
                columns,
                message
            );

            return;

        }


        items.forEach(item => {

            const row = element("tr");

            renderer(row, item);

            body.appendChild(row);

        });

    }


    /* =====================================================
       14. OVERVIEW
    ===================================================== */

    function renderOverview(data) {

        const metrics = data.metrics || {};


        setMetric(
            "metric-uptime",
            metrics.uptimePercentage,
            percentage
        );


        setMetric(
            "metric-incidents",
            metrics.activeIncidents
        );


        setMetric(
            "metric-api",
            metrics.apiSuccessRate,
            percentage
        );


        setMetric(
            "metric-response",
            metrics.averageApiResponse,
            milliseconds
        );


        setMetric(
            "metric-servers",
            metrics.healthyServers
        );


        text(
            "metric-database",
            pretty(
                metrics.databaseStatus
            )
        );


        text(
            "metric-uptime-period",
            metrics.uptimePeriod
                ? `Period: ${metrics.uptimePeriod}`
                : "Reporting period unavailable"
        );


        const overall =
            normalize(data.overallHealth?.status);


        const banner = byId(
            "overall-health-banner"
        );


        banner?.classList.remove(
            "healthy",
            "degraded",
            "critical",
            "down"
        );


        if (
            ["healthy", "degraded", "critical", "down"].includes(overall)
        ) {

            banner?.classList.add(overall);

        }


        text(
            "overall-health-title",
            data.overallHealth?.title ||
            "Overall health not verified"
        );


        text(
            "overall-health-description",
            data.overallHealth?.description ||
            "No overall infrastructure assessment has been returned."
        );


        text(
            "overall-health-badge",
            pretty(data.overallHealth?.status || "unverified")
        );


        renderPortalOverview(
            data.portals || {}
        );


        renderResourceList(
            "overview-resource-list",
            data.resources || [],
            "Infrastructure telemetry has not been received."
        );


        renderEvents(
            "overview-incident-list",
            data.recentIncidents || [],
            "No incident feed has been received."
        );


        renderOverviewApis(
            data.apiServices || []
        );


        updateIncidentCount(
            metrics.activeIncidents
        );

    }


    function renderPortalOverview(portals) {

        const mapping = [

            ["employer", "Employer"],

            ["employee", "Employee"],

            ["super_admin", "Admin"]

        ];


        mapping.forEach(([key, prefix]) => {

            const portal = portals[key] || {};


            const status = health(portal.status);


            const statusElement = byId(
                `${prefix.toLowerCase()}-status`
            );


            if (statusElement) {

                statusElement.textContent =
                    pretty(portal.status || "unverified");


                statusElement.className = status;

            }


            text(
                `${prefix.toLowerCase()}-status-detail`,
                portal.description || "Monitoring data unavailable"
            );


            text(
                `${prefix.toLowerCase()}-latency`,
                `Latency: ${typeof portal.latency === "number"
                    ? milliseconds(portal.latency)
                    : "—"
                }`
            );

        });

    }


    function renderOverviewApis(items) {

        renderStatusTable(

            "overview-api-body",

            items,

            6,

            (row, item) => {

                cell(row, item.name, true);

                cell(row, number(item.requests));

                cell(row, percentage(item.successRate));

                cell(row, milliseconds(item.averageResponse));

                cell(row, number(item.errors));

                statusCell(row, item.status);

            },

            "No API telemetry available."

        );

    }


    function updateIncidentCount(value) {

        const count =
            typeof value === "number"
                ? value
                : null;


        const badge = byId(
            "incident-nav-count"
        );


        const alertBadge = byId(
            "alert-button-count"
        );


        if (count === null) {

            hide(badge);

            return;

        }


        text(
            "incident-nav-count",
            number(count)
        );


        text(
            "alert-button-count",
            number(count)
        );


        if (count > 0) {

            show(badge);

            show(alertBadge);

        } else {

            hide(badge);

            hide(alertBadge);

        }

    }


    /* =====================================================
       15. INFRASTRUCTURE
    ===================================================== */

    function renderInfrastructure(data) {

        const metrics = data.metrics || {};


        setMetric(
            "infra-cpu",
            metrics.cpuUtilization,
            percentage
        );


        setMetric(
            "infra-memory",
            metrics.memoryUtilization,
            percentage
        );


        setMetric(
            "infra-storage",
            metrics.storageUtilization,
            percentage
        );


        setMetric(
            "infra-network",
            metrics.networkUtilization,
            percentage
        );


        renderResourceList(
            "infra-components",
            data.components || [],
            "No infrastructure components returned."
        );


        renderEvents(
            "infra-warnings",
            data.warnings || [],
            "No infrastructure warnings returned."
        );


        renderStatusTable(

            "infra-table-body",

            data.resources || [],

            7,

            (row, item) => {

                cell(row, item.name, true);

                cell(row, item.type);

                cell(row, item.environment);

                cell(row, percentage(item.cpuUtilization));

                cell(row, percentage(item.memoryUtilization));

                statusCell(row, item.status);

                cell(row, dateTime(item.lastReportedAt));

            },

            "No infrastructure records available."

        );

    }


    /* =====================================================
       16. SERVERS
    ===================================================== */

    function renderServers(data) {

        const metrics = data.metrics || {};


        renderMetricGroup({

            "server-total": "total",

            "server-healthy": "healthy",

            "server-down": "unavailable",

            "server-cpu": {
                field: "averageCpu",
                formatter: percentage
            }

        }, metrics);


        renderStatusTable(

            "servers-table-body",

            getItems(data),

            9,

            (row, item) => {

                cell(row, item.name, true);

                cell(row, item.environment);

                cell(row, item.region);

                cell(row, percentage(item.cpuUtilization));

                cell(row, percentage(item.memoryUtilization));

                cell(row, item.uptime);

                statusCell(row, item.status);

                cell(row, dateTime(item.lastHeartbeatAt));


                actionsCell(row, [

                    {

                        label: "Details",

                        callback: () =>
                            showResourceDetails(item)

                    },

                    {

                        label: "Restart",

                        danger: true,

                        callback: () =>
                            openAction({

                                action: "restart",

                                targetType: "server",

                                reference: refOf(item),

                                title: "Restart Server",

                                description:
                                    "Request a controlled restart of this registered server."

                            })

                    }

                ]);

            },

            "No server inventory returned."

        );

    }


    /* =====================================================
       17. DATABASE
    ===================================================== */

    function renderDatabase(data) {

        const metrics = data.metrics || {};


        renderMetricGroup({

            "db-instances": "instances",

            "db-connections": "activeConnections",

            "db-response": {
                field: "averageQueryTime",
                formatter: milliseconds
            }

        }, metrics);


        text(
            "db-availability",
            metrics.availability === undefined
                ? "—"
                : percentage(metrics.availability)
        );


        renderResourceList(
            "db-pool-list",
            data.connectionPools || [],
            "No connection pool data returned."
        );


        renderEvents(
            "db-warning-list",
            data.warnings || [],
            "No database warnings returned."
        );


        renderStatusTable(

            "database-table-body",

            getItems(data),

            7,

            (row, item) => {

                cell(row, item.name, true);

                cell(row, item.engine);

                cell(row, item.environment);

                cell(row, number(item.connections));

                cell(row, milliseconds(item.queryResponse));

                cell(row, pretty(item.replicationStatus));

                statusCell(row, item.status);

            },

            "No database instances returned."

        );

    }


    /* =====================================================
       18. STORAGE
    ===================================================== */

    function renderStorage(data) {

        const metrics = data.metrics || {};


        setMetric(
            "storage-capacity",
            metrics.totalBytes,
            bytes
        );


        setMetric(
            "storage-used",
            metrics.usedBytes,
            bytes
        );


        setMetric(
            "storage-available",
            metrics.availableBytes,
            bytes
        );


        text(
            "storage-status",
            pretty(metrics.status)
        );


        renderStatusTable(

            "storage-table-body",

            getItems(data),

            7,

            (row, item) => {

                cell(row, item.name, true);

                cell(row, item.type);

                cell(row, bytes(item.capacityBytes));

                cell(row, bytes(item.usedBytes));

                cell(row, bytes(item.availableBytes));

                cell(row, percentage(item.utilization));

                statusCell(row, item.status);

            },

            "No storage records returned."

        );

    }


    /* =====================================================
       19. NETWORK
    ===================================================== */

    function renderNetwork(data) {

        const metrics = data.metrics || {};


        text(
            "network-inbound",
            metrics.inboundBytesPerSecond === undefined
                ? "—"
                : `${bytes(metrics.inboundBytesPerSecond)}/s`
        );


        text(
            "network-outbound",
            metrics.outboundBytesPerSecond === undefined
                ? "—"
                : `${bytes(metrics.outboundBytesPerSecond)}/s`
        );


        setMetric(
            "network-latency",
            metrics.averageLatency,
            milliseconds
        );


        setMetric(
            "network-packet-loss",
            metrics.packetLoss,
            percentage
        );


        renderStatusTable(

            "network-table-body",

            getItems(data),

            7,

            (row, item) => {

                cell(row, item.name, true);

                cell(row, item.source);

                cell(row, item.destination);

                cell(row, milliseconds(item.latency));

                cell(row, item.throughput);

                cell(row, percentage(item.packetLoss));

                statusCell(row, item.status);

            },

            "No network measurements returned."

        );

    }


    /* =====================================================
       20. API PERFORMANCE
    ===================================================== */

    function renderApis(data) {

        const metrics = data.metrics || {};


        renderMetricGroup({

            "api-total": "totalEndpoints",

            "api-requests": "totalRequests",

            "api-failures": "failedRequests",

            "api-success": {
                field: "successRate",
                formatter: percentage
            }

        }, metrics);


        const items = getItems(data);


        const search = normalize(
            byId("api-search")?.value
        );


        const status = normalize(
            byId("api-status-filter")?.value
        );


        const filtered = items.filter(item => {

            const matchesSearch =
                !search ||
                normalize(item.name).includes(search) ||
                normalize(item.path).includes(search);


            const matchesStatus =
                !status ||
                normalize(item.status) === status;


            return matchesSearch && matchesStatus;

        });


        renderStatusTable(

            "api-table-body",

            filtered,

            8,

            (row, item) => {

                cell(
                    row,
                    item.path || item.name,
                    true
                );

                cell(row, pretty(item.portal));

                cell(row, number(item.requests));

                cell(row, number(item.errors));

                cell(row, percentage(item.successRate));

                cell(row, milliseconds(item.averageResponse));

                cell(row, milliseconds(item.p95Response));

                statusCell(row, item.status);

            },

            "No matching API records returned."

        );

    }


    /* =====================================================
       21. PORTALS
    ===================================================== */

    function renderPortals(data) {

        const portals = data.portals || {};


        const mapping = [

            ["employer", "Employer"],

            ["employee", "Employee"],

            ["super_admin", "Admin"]

        ];


        mapping.forEach(([key, prefix]) => {

            const item = portals[key] || {};

            const id = `portal-${prefix.toLowerCase()}-state`;

            const target = byId(id);


            if (target) {

                target.textContent =
                    pretty(item.status || "unverified");

                target.className =
                    normalize(item.status);

            }


            text(
                `portal-${prefix.toLowerCase()}-details`,
                item.description ||
                "Portal monitoring information unavailable."
            );

        });


        renderStatusTable(

            "portal-table-body",

            data.connections || [],

            7,

            (row, item) => {

                cell(row, pretty(item.portal), true);

                cell(row, item.service);

                cell(row, item.dependency);

                cell(row, milliseconds(item.latency));

                cell(row, percentage(item.availability));

                statusCell(row, item.status);

                cell(row, dateTime(item.lastCheckedAt));

            },

            "No portal connection records returned."

        );

    }


    /* =====================================================
       22. INTEGRATIONS
    ===================================================== */

    function renderIntegrations(data) {

        const metrics = data.metrics || {};


        renderMetricGroup({

            "integration-total": "total",

            "integration-healthy": "healthy",

            "integration-failed": "failed",

            "integration-retries": "pendingRetries"

        }, metrics);


        renderStatusTable(

            "integrations-table-body",

            getItems(data),

            8,

            (row, item) => {

                cell(row, item.name, true);

                cell(row, item.type);

                cell(row, pretty(item.portal));

                cell(row, dateTime(item.lastSuccessAt));

                cell(row, number(item.failures));

                cell(row, number(item.pendingRetries));

                statusCell(row, item.status);


                actionsCell(row, [

                    {

                        label: "Details",

                        callback: () =>
                            showResourceDetails(item)

                    },

                    {

                        label: "Isolate",

                        danger: true,

                        callback: () =>
                            openAction({

                                action: "disable_integration",

                                targetType: "integration",

                                reference: refOf(item),

                                title: "Isolate Integration",

                                description:
                                    "Request controlled isolation of this integration. Dependent services may be affected."

                            })

                    }

                ]);

            },

            "No integration records returned."

        );

    }


    /* =====================================================
       23. BACKGROUND JOBS
    ===================================================== */

    function renderJobs(data) {

        const metrics = data.metrics || {};


        renderMetricGroup({

            "jobs-total": "total",

            "jobs-running": "running",

            "jobs-failed": "failed",

            "jobs-queued": "queued"

        }, metrics);


        renderStatusTable(

            "jobs-table-body",

            getItems(data),

            7,

            (row, item) => {

                cell(row, item.name, true);

                cell(row, item.queue);

                statusCell(row, item.status);

                cell(row, dateTime(item.startedAt));

                cell(row, item.duration);

                cell(row, number(item.attempts));

                cell(row, item.lastResult);

            },

            "No background job records returned."

        );

    }


    /* =====================================================
       24. APPLICATION PERFORMANCE
    ===================================================== */

    function renderPerformance(data) {

        const metrics = data.metrics || {};


        setMetric(
            "perf-average",
            metrics.averageLatency,
            milliseconds
        );


        setMetric(
            "perf-p95",
            metrics.p95Latency,
            milliseconds
        );


        setMetric(
            "perf-errors",
            metrics.errorRate,
            percentage
        );


        setMetric(
            "perf-throughput",
            metrics.throughput
        );


        renderResourceList(
            "performance-list",
            data.measurements || [],
            "No performance measurements returned."
        );


        renderEvents(
            "performance-errors-list",
            data.errorCategories || [],
            "No error categories returned."
        );


        renderStatusTable(

            "performance-table-body",

            data.services || [],

            7,

            (row, item) => {

                cell(row, item.name, true);

                cell(row, pretty(item.portal));

                cell(row, milliseconds(item.averageLatency));

                cell(row, milliseconds(item.p95Latency));

                cell(row, percentage(item.errorRate));

                cell(row, number(item.throughput));

                statusCell(row, item.status);

            },

            "No application service telemetry returned."

        );

    }


    /* =====================================================
       25. SECURITY
    ===================================================== */

    function renderSecurity(data) {

        const metrics = data.metrics || {};


        renderMetricGroup({

            "security-incidents": "incidents",

            "security-auth-failures": "failedAuthentications",

            "security-suspicious": "suspiciousRequests",

            "security-unauthorized": "unauthorizedRequests"

        }, metrics);


        const items = getItems(data);


        const search = normalize(
            byId("security-search")?.value
        );


        const severity = normalize(
            byId("security-severity")?.value
        );


        const filtered = items.filter(item => {

            const matchesSearch =
                !search ||
                normalize(item.type).includes(search) ||
                normalize(item.source).includes(search) ||
                normalize(item.description).includes(search);


            const matchesSeverity =
                !severity ||
                normalize(item.severity) === severity;


            return matchesSearch && matchesSeverity;

        });


        renderStatusTable(

            "security-table-body",

            filtered,

            8,

            (row, item) => {

                cell(row, refOf(item), true);

                cell(row, pretty(item.type));

                severityCell(row, item.severity);

                cell(row, item.source);

                cell(row, pretty(item.portal));

                cell(row, dateTime(item.detectedAt));

                statusCell(row, item.status);


                actionsCell(row, [

                    {

                        label: "Details",

                        callback: () =>
                            showResourceDetails(item)

                    }

                ]);

            },

            "No security event records returned."

        );

    }


    /* =====================================================
       26. INCIDENT MANAGEMENT
    ===================================================== */

    function renderIncidents(data) {

        const metrics = data.metrics || {};


        renderMetricGroup({

            "inc-open": "open",

            "inc-critical": "critical",

            "inc-investigating": "investigating",

            "inc-resolved": "resolved"

        }, metrics);


        updateIncidentCount(
            metrics.open
        );


        const items = getItems(data);


        const search = normalize(
            byId("incident-search")?.value
        );


        const severity = normalize(
            byId("incident-severity")?.value
        );


        const status = normalize(
            byId("incident-status")?.value
        );


        const filtered = items.filter(item => {

            const matchesSearch =
                !search ||
                normalize(item.title).includes(search) ||
                normalize(item.reference).includes(search) ||
                normalize(item.component).includes(search);


            const matchesSeverity =
                !severity ||
                normalize(item.severity) === severity;


            const matchesStatus =
                !status ||
                normalize(item.status) === status;


            return (
                matchesSearch &&
                matchesSeverity &&
                matchesStatus
            );

        });


        renderStatusTable(

            "incidents-table-body",

            filtered,

            8,

            (row, item) => {

                cell(row, refOf(item), true);

                cell(row, item.title);

                cell(row, item.component);

                severityCell(row, item.severity);

                statusCell(row, item.status);

                cell(
                    row,
                    item.assignedAdministrator?.displayName ||
                    item.assignedAdministrator?.email
                );

                cell(row, dateTime(item.detectedAt));


                actionsCell(row, [

                    {

                        label: "Investigate",

                        callback: () =>
                            openIncident(item)

                    }

                ]);

            },

            "No incident records returned."

        );

    }


    async function openIncident(item) {

        if (!authorized()) return;


        const reference = refOf(item);

        if (!reference) return;


        state.incidentReference = reference;


        state.lastFocus = document.activeElement;


        const content = byId(
            "incident-detail-content"
        );


        content.replaceChildren();


        const details = [

            ["Reference", reference],

            ["Title", item.title],

            ["Description", item.description],

            ["Component", item.component],

            ["Severity", pretty(item.severity)],

            ["Status", pretty(item.status)],

            ["Detected", dateTime(item.detectedAt)],

            ["Assigned Administrator",
                item.assignedAdministrator?.displayName],

            ["Root Cause", item.rootCause],

            ["Resolution", item.resolution]

        ];


        details.forEach(([name, value]) => {

            const row = element(
                "div",
                "detail-row"
            );


            row.append(

                element("strong", "", name),

                element(
                    "span",
                    "",
                    value || "Not provided"
                )

            );


            content.appendChild(row);

        });


        const form = byId(
            "incident-update-form"
        );


        form.elements.reference.value = reference;

        form.elements.status.value =
            normalize(item.status) === "resolved"
                ? "resolved"
                : "investigating";


        form.elements.notes.value = "";


        show(
            byId("incident-modal")
        );

    }


    async function submitIncidentUpdate(event) {

        event.preventDefault();


        if (!authorized()) return;


        const form = event.currentTarget;

        if (!form.reportValidity()) return;


        const data = new FormData(form);


        const reference =
            data.get("reference");


        try {

            const result = await request(

                `${safePath(api("incidents"), reference)}/actions`,

                {

                    method: "POST",

                    body: {

                        status: data.get("status"),

                        notes: data.get("notes")?.trim()

                    }

                }

            );


            toast(
                result.message ||
                "The incident update was accepted by the server.",
                "success"
            );


            closeIncident();

            delete state.panelCache.incidents;

            await loadPanel("incidents", true);

        } catch (error) {

            toast(error.message, "error");

        }

    }


    function closeIncident() {

        hide(
            byId("incident-modal")
        );


        state.incidentReference = null;

        state.lastFocus?.focus?.();

        state.lastFocus = null;

    }


    /* =====================================================
       27. ALERTS
    ===================================================== */

    function renderAlerts(data) {

        const metrics = data.metrics || {};


        renderMetricGroup({

            "alerts-active": "active",

            "alerts-acknowledged": "acknowledged",

            "alerts-email": "emailDelivered",

            "alerts-sms": "smsDelivered"

        }, metrics);


        renderStatusTable(

            "alerts-table-body",

            getItems(data),

            7,

            (row, item) => {

                cell(row, refOf(item), true);

                severityCell(row, item.severity);

                cell(row, pretty(item.channel));

                cell(row, item.recipientGroup);

                statusCell(row, item.deliveryStatus);

                cell(row, dateTime(item.createdAt));

                cell(row, dateTime(item.acknowledgedAt));

            },

            "No alert delivery records returned."

        );

    }


    /* =====================================================
       28. MAINTENANCE
    ===================================================== */

    function renderMaintenance(data) {

        const container = byId(
            "maintenance-current-state"
        );


        container.replaceChildren();


        const states = data.currentStates || [];


        if (!states.length) {

            container.appendChild(
                element(
                    "div",
                    "empty-state",
                    "No maintenance configuration was returned by the server."
                )
            );

        }


        states.forEach(item => {

            const wrapper = element(
                "div",
                "maintenance-state-item"
            );


            wrapper.append(

                element(
                    "strong",
                    "",
                    pretty(item.scope)
                ),

                element(
                    "span",
                    "",
                    `${pretty(item.status)} · ${item.reference || "No reference"}`
                )

            );


            container.appendChild(wrapper);

        });


        renderStatusTable(

            "maintenance-table-body",

            data.history || [],

            7,

            (row, item) => {

                cell(row, refOf(item), true);

                cell(row, pretty(item.scope));

                cell(
                    row,
                    item.initiatedBy?.displayName
                );

                cell(row, item.reason);

                cell(row, dateTime(item.startedAt));

                cell(row, dateTime(item.endedAt));

                statusCell(row, item.status);

            },

            "No maintenance history returned."

        );

    }


    /* =====================================================
       29. DEPLOYMENTS
    ===================================================== */

    function renderDeployments(data) {

        const metrics = data.metrics || {};


        text(
            "deployment-version",
            metrics.currentVersion
        );


        text(
            "deployment-last",
            dateTime(metrics.lastDeploymentAt)
        );


        setMetric(
            "deployment-failed",
            metrics.failedDeployments
        );


        setMetric(
            "deployment-eligible",
            metrics.rollbackEligible
        );


        renderStatusTable(

            "deployments-table-body",

            getItems(data),

            8,

            (row, item) => {

                cell(row, refOf(item), true);

                cell(row, item.version);

                cell(row, item.environment);

                cell(
                    row,
                    item.initiatedBy?.displayName
                );

                cell(row, dateTime(item.deployedAt));

                statusCell(row, item.result);


                cell(
                    row,
                    item.rollbackEligible === true
                        ? "Eligible"
                        : item.rollbackEligible === false
                            ? "Not eligible"
                            : "Unverified"
                );


                const actions = [];


                if (item.rollbackEligible === true) {

                    actions.push({

                        label: "Rollback",

                        danger: true,

                        callback: () =>
                            openAction({

                                action: "rollback",

                                targetType: "deployment",

                                reference: refOf(item),

                                title: "Deployment Rollback",

                                description:
                                    "Request a rollback to this eligible deployment. The server must verify release and migration safety."

                            })

                    });

                }


                actionsCell(row, actions);

            },

            "No deployment records returned."

        );

    }


    /* =====================================================
       30. SCHEDULED MAINTENANCE
    ===================================================== */

    function renderScheduled(data) {

        renderStatusTable(

            "scheduled-table-body",

            getItems(data),

            8,

            (row, item) => {

                cell(row, refOf(item), true);

                cell(row, item.title);

                cell(row, pretty(item.scope));

                cell(row, dateTime(item.startsAt));

                cell(row, dateTime(item.endsAt));

                cell(
                    row,
                    item.createdBy?.displayName
                );

                statusCell(row, item.status);


                actionsCell(row, [

                    {

                        label: "Cancel",

                        danger: true,

                        callback: () =>
                            openAction({

                                action: "cancel_maintenance_schedule",

                                targetType: "maintenance_schedule",

                                reference: refOf(item),

                                title: "Cancel Scheduled Maintenance",

                                description:
                                    "Request cancellation of this maintenance schedule."

                            })

                    }

                ]);

            },

            "No scheduled maintenance records returned."

        );

    }


    /* =====================================================
       31. CAPACITY
    ===================================================== */

    function renderCapacity(data) {

        const metrics = data.metrics || {};


        setMetric(
            "capacity-cpu",
            metrics.cpuCapacity,
            percentage
        );


        setMetric(
            "capacity-memory",
            metrics.memoryCapacity,
            percentage
        );


        setMetric(
            "capacity-storage",
            metrics.storageCapacity,
            percentage
        );


        text(
            "capacity-exhaustion",
            metrics.projectedExhaustionDate
                ? dateTime(metrics.projectedExhaustionDate)
                : "—"
        );


        renderStatusTable(

            "capacity-table-body",

            getItems(data),

            7,

            (row, item) => {

                cell(row, item.resource, true);

                cell(row, item.currentUsage);

                cell(row, item.capacity);

                cell(row, item.growthRate);

                cell(row, item.forecast);

                severityCell(row, item.risk);

                cell(row, item.recommendation);

            },

            "No capacity forecast records returned."

        );

    }


    /* =====================================================
       32. REPORTS
    ===================================================== */

    function renderReports(data) {

        renderStatusTable(

            "reports-table-body",

            getItems(data),

            7,

            (row, item) => {

                cell(row, item.name, true);

                cell(row, pretty(item.category));

                cell(
                    row,
                    `${item.from || "—"} to ${item.to || "—"}`
                );

                cell(
                    row,
                    item.generatedBy?.displayName
                );

                cell(row, dateTime(item.createdAt));

                statusCell(row, item.status);


                actionsCell(row, [

                    {

                        label: "Download",

                        callback: () =>
                            downloadReport(refOf(item))

                    }

                ]);

            },

            "No report history returned."

        );

    }


    async function downloadReport(reference) {

        if (!authorized()) return;


        try {

            const response = await fetch(

                `${safePath(api("reports"), reference)}/download`,

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

            const link = element("a");


            link.href = url;

            link.download = "talvora-monitoring-report";


            document.body.appendChild(link);

            link.click();

            link.remove();


            URL.revokeObjectURL(url);


            toast(
                "Report download received from the server.",
                "success"
            );

        } catch (error) {

            toast(error.message, "error");

        }

    }


    async function generateReport(event) {

        event.preventDefault();


        if (!authorized()) return;


        const form = event.currentTarget;

        if (!form.reportValidity()) return;


        const data = new FormData(form);


        const from = data.get("from");

        const to = data.get("to");


        if (from > to) {

            toast(
                "The start date cannot be later than the end date.",
                "warning"
            );

            return;

        }


        try {

            const result = await request(

                api("reports"),

                {

                    method: "POST",

                    body: {

                        category: data.get("category"),

                        format: data.get("format"),

                        from,

                        to

                    }

                }

            );


            toast(
                result.message ||
                "The report request was accepted by the server.",
                "success"
            );


            delete state.panelCache.reports;

            await loadPanel("reports", true);

        } catch (error) {

            toast(error.message, "error");

        }

    }


    /* =====================================================
       33. INFRASTRUCTURE AUDIT
    ===================================================== */

    function renderAudit(data) {

        renderStatusTable(

            "audit-table-body",

            getItems(data),

            7,

            (row, item) => {

                cell(row, refOf(item), true);

                cell(
                    row,
                    item.administrator?.displayName ||
                    item.administratorReference
                );

                cell(row, pretty(item.operation));

                cell(row, item.targetReference);

                cell(row, item.justification);

                cell(row, dateTime(item.timestamp));

                statusCell(row, item.result);

            },

            "No infrastructure audit records returned."

        );

    }


    /* =====================================================
       34. RESOURCE DETAILS
    ===================================================== */

    function showResourceDetails(item) {

        if (!authorized()) return;


        const lines = [

            `Reference: ${refOf(item) || "Unavailable"}`,

            `Name: ${item.name || "Unavailable"}`,

            `Type: ${item.type || "Unavailable"}`,

            `Status: ${pretty(item.status)}`,

            `Environment: ${item.environment || "Unavailable"}`,

            `Last reported: ${dateTime(item.lastReportedAt)}`,

            `Description: ${item.description || "Unavailable"}`

        ];


        toast(
            lines.join(" | "),
            "info"
        );

    }


    /* =====================================================
       35. CONTROLLED ACTION MODAL
    ===================================================== */

    function openAction(config) {

        if (!authorized()) return;


        if (
            !config.reference ||
            !config.action ||
            !config.targetType
        ) {

            toast(
                "The requested operation is missing its target information.",
                "error"
            );

            return;

        }


        state.pendingAction = config;

        state.lastFocus = document.activeElement;


        text(
            "action-modal-title",
            config.title
        );


        text(
            "action-warning-title",
            "Sensitive infrastructure operation"
        );


        text(
            "action-description",
            config.description
        );


        text(
            "action-operation",
            pretty(config.action)
        );


        text(
            "action-target",
            config.reference
        );


        text(
            "action-administrator",
            state.administrator?.email
        );


        const form = byId(
            "action-confirm-form"
        );


        form.reset();


        const scheduleField = byId(
            "action-schedule-field"
        );


        if (config.action === "restart") {

            show(scheduleField);

        } else {

            hide(scheduleField);

        }


        show(
            byId("action-modal")
        );


        form.elements.reason.focus();

    }


    function closeAction() {

        hide(
            byId("action-modal")
        );


        state.pendingAction = null;


        state.lastFocus?.focus?.();

        state.lastFocus = null;

    }


    /* =====================================================
       36. ACTION SUBMISSION
    ===================================================== */

    async function submitAction(event) {

        event.preventDefault();


        if (!authorized()) return;


        const config = state.pendingAction;

        if (!config) return;


        const form = event.currentTarget;


        if (!form.reportValidity()) return;


        const data = new FormData(form);


        const reason =
            data.get("reason")?.trim();


        if (!reason || reason.length < 10) {

            toast(
                "Provide a detailed administrative justification of at least 10 characters.",
                "warning"
            );

            return;

        }


        const payload = {

            action: config.action,

            targetType: config.targetType,

            targetReference: config.reference,

            reason,

            scheduledAt:
                data.get("scheduledAt") || null,

            requestedBy:
                state.administrator?.reference || null

        };


        const button = byId(
            "action-submit"
        );


        button.disabled = true;


        try {

            const result = await request(

                `${CONFIG.API}/actions`,

                {

                    method: "POST",

                    body: payload

                }

            );


            toast(

                result.message ||
                "The operation request was accepted for server-side processing.",

                "success"

            );


            closeAction();


            CONFIG.PANELS.forEach(panel => {

                delete state.panelCache[panel];

            });


            await loadPanel(
                state.activePanel,
                true
            );


        } catch (error) {

            toast(error.message, "error");

        } finally {

            button.disabled = false;

        }

    }


    /* =====================================================
       37. MAINTENANCE ACTIONS
    ===================================================== */

    async function submitMaintenance(
        event,
        action
    ) {

        event.preventDefault();


        if (!authorized()) return;


        const form = event.currentTarget;

        if (!form.reportValidity()) return;


        const data = new FormData(form);


        const reason =
            data.get("reason")?.trim();


        if (!reason || reason.length < 10) {

            toast(
                "Provide a detailed maintenance justification.",
                "warning"
            );

            return;

        }


        const payload = {

            action,

            scope: data.get("scope"),

            serviceReference:
                data.get("serviceReference") || null,

            maintenanceReference:
                data.get("maintenanceReference") || null,

            reason,

            scheduledEnd:
                data.get("scheduledEnd") || null

        };


        const confirmed = window.confirm(

            action === "activate"
                ? "Submit this maintenance activation request for server-side authorization?"
                : "Submit this service restoration request for server-side authorization?"

        );


        if (!confirmed) return;


        try {

            const result = await request(

                `${api("maintenance")}/actions`,

                {

                    method: "POST",

                    body: payload

                }

            );


            toast(
                result.message ||
                "The maintenance request was accepted by the server.",
                "success"
            );


            form.reset();

            delete state.panelCache.maintenance;

            await loadPanel("maintenance", true);

        } catch (error) {

            toast(error.message, "error");

        }

    }


    /* =====================================================
       38. SCHEDULE MAINTENANCE
    ===================================================== */

    async function submitScheduledMaintenance(event) {

        event.preventDefault();


        if (!authorized()) return;


        const form = event.currentTarget;

        if (!form.reportValidity()) return;


        const data = new FormData(form);


        const startsAt =
            data.get("startsAt");


        const endsAt =
            data.get("endsAt");


        if (new Date(startsAt) >= new Date(endsAt)) {

            toast(
                "The maintenance end time must be later than the start time.",
                "warning"
            );

            return;

        }


        try {

            const result = await request(

                api("scheduled"),

                {

                    method: "POST",

                    body: {

                        title: data.get("title")?.trim(),

                        scope: data.get("scope"),

                        startsAt,

                        endsAt,

                        reason: data.get("reason")?.trim()

                    }

                }

            );


            toast(
                result.message ||
                "The maintenance schedule was submitted to the server.",
                "success"
            );


            form.reset();

            delete state.panelCache.scheduled;

            await loadPanel("scheduled", true);

        } catch (error) {

            toast(error.message, "error");

        }

    }


    /* =====================================================
       39. FILTERING
    ===================================================== */

    async function applyFilter(panel, values) {

        if (!authorized()) return;


        state.filters[panel] = values;

        state.panelPages[panel] = 1;


        delete state.panelCache[panel];


        await loadPanel(panel, true);

    }


    function initializeFilters() {

        byId("api-filter-button")
            ?.addEventListener("click", () => {

                applyFilter("apis", {

                    search:
                        byId("api-search")?.value.trim(),

                    status:
                        byId("api-status-filter")?.value

                });

            });


        byId("security-filter")
            ?.addEventListener("click", () => {

                applyFilter("security", {

                    search:
                        byId("security-search")?.value.trim(),

                    severity:
                        byId("security-severity")?.value

                });

            });


        byId("incident-filter")
            ?.addEventListener("click", () => {

                applyFilter("incidents", {

                    search:
                        byId("incident-search")?.value.trim(),

                    severity:
                        byId("incident-severity")?.value,

                    status:
                        byId("incident-status")?.value

                });

            });


        byId("audit-filter")
            ?.addEventListener("click", () => {

                applyFilter("audit", {

                    search:
                        byId("audit-search")?.value.trim(),

                    action:
                        byId("audit-action-filter")?.value

                });

            });

    }


    /* =====================================================
       40. REPORT FORM
    ===================================================== */

    function initializeReportForm() {

        byId("report-form")
            ?.addEventListener(
                "submit",
                generateReport
            );

    }


    /* =====================================================
       41. MODAL INITIALIZATION
    ===================================================== */

    function initializeModals() {

        byId("action-confirm-form")
            ?.addEventListener(
                "submit",
                submitAction
            );


        $$("[data-close-action]").forEach(button => {

            button.addEventListener(
                "click",
                closeAction
            );

        });


        byId("incident-update-form")
            ?.addEventListener(
                "submit",
                submitIncidentUpdate
            );


        $$("[data-close-incident]").forEach(button => {

            button.addEventListener(
                "click",
                closeIncident
            );

        });


        byId("action-modal")
            ?.addEventListener("click", event => {

                if (
                    event.target.id === "action-modal"
                ) {

                    closeAction();

                }

            });


        byId("incident-modal")
            ?.addEventListener("click", event => {

                if (
                    event.target.id === "incident-modal"
                ) {

                    closeIncident();

                }

            });


        document.addEventListener("keydown", event => {

            if (event.key === "Escape") {

                closeAction();

                closeIncident();

                closeSidebar();

            }

        });

    }


    /* =====================================================
       42. MAINTENANCE FORMS
    ===================================================== */

    function initializeMaintenanceForms() {

        byId("maintenance-activate-form")
            ?.addEventListener("submit", event => {

                submitMaintenance(
                    event,
                    "activate"
                );

            });


        byId("maintenance-deactivate-form")
            ?.addEventListener("submit", event => {

                submitMaintenance(
                    event,
                    "deactivate"
                );

            });


        byId("scheduled-maintenance-form")
            ?.addEventListener(
                "submit",
                submitScheduledMaintenance
            );

    }


    /* =====================================================
       43. EXPORT AUDIT
    ===================================================== */

    async function exportAudit() {

        if (!authorized()) return;


        try {

            const response = await fetch(

                `${api("audit")}/export?format=csv`,

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

            const link = element("a");


            link.href = url;

            link.download = "talvora-infrastructure-audit.csv";


            document.body.appendChild(link);

            link.click();

            link.remove();


            URL.revokeObjectURL(url);


            toast(
                "Audit export received from the server.",
                "success"
            );

        } catch (error) {

            toast(error.message, "error");

        }

    }


    function initializeExports() {

        $$("[data-export]").forEach(button => {

            button.addEventListener("click", () => {

                if (button.dataset.export === "audit") {

                    exportAudit();

                }

            });

        });

    }


    /* =====================================================
       44. AUTOMATIC MONITORING REFRESH
    ===================================================== */

    function stopRefresh() {

        if (state.refreshTimer) {

            window.clearInterval(
                state.refreshTimer
            );

        }


        if (state.countdownTimer) {

            window.clearInterval(
                state.countdownTimer
            );

        }


        state.refreshTimer = null;

        state.countdownTimer = null;

    }


    function startRefresh() {

        stopRefresh();


        state.countdown =
            CONFIG.REFRESH_INTERVAL / 1000;


        text(
            "refresh-countdown",
            `${state.countdown}s`
        );


        state.countdownTimer =
            window.setInterval(() => {

                if (
                    document.visibilityState !== "visible"
                ) {

                    return;

                }


                state.countdown = Math.max(
                    0,
                    state.countdown - 1
                );


                text(
                    "refresh-countdown",
                    `${state.countdown}s`
                );

            }, 1000);


        state.refreshTimer =
            window.setInterval(async () => {

                if (
                    document.visibilityState !== "visible" ||
                    !state.authenticated ||
                    state.refreshing
                ) {

                    return;

                }


                await refreshCurrentPanel(false);


            }, CONFIG.REFRESH_INTERVAL);

    }


    async function refreshCurrentPanel(showMessage = true) {

        if (!authorized()) return;

        if (state.refreshing) return;


        state.refreshing = true;


        const button = byId(
            "refresh-button"
        );


        if (button) button.disabled = true;


        try {

            delete state.panelCache[
                state.activePanel
            ];


            await loadPanel(
                state.activePanel,
                true
            );


            if (showMessage) {

                toast(
                    "A fresh monitoring data request has been completed.",
                    "success"
                );

            }

        } finally {

            state.refreshing = false;

            if (button) button.disabled = false;


            state.countdown =
                CONFIG.REFRESH_INTERVAL / 1000;

        }

    }


    function initializeRefresh() {

        byId("refresh-button")
            ?.addEventListener("click", () => {

                refreshCurrentPanel(true);

            });


        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.visibilityState === "visible" &&
                    state.authenticated
                ) {

                    refreshCurrentPanel(false);

                }

            }
        );


        startRefresh();

    }


    /* =====================================================
       45. SECURITY REQUIREMENTS
    ===================================================== */

    function initializeSecurity() {

        /*
         * TALVORA MONITORING SECURITY ARCHITECTURE
         *
         * ADMINISTRATORS
         *
         * 1. The system supports ten authorized Super Admin
         *    accounts, verified through the central identity
         *    and administrator register.
         *
         * 2. Every authorized administrator receives the
         *    monitoring permissions approved in the central
         *    System Settings module.
         *
         * 3. The frontend does not create administrator
         *    accounts or grant privileges.
         *
         * AUTHORIZATION
         *
         * 4. Every endpoint must enforce server-side role
         *    authorization.
         *
         * 5. Every privileged operation must verify the
         *    current administrator's authorization.
         *
         * 6. Service ownership and environment boundaries
         *    must be validated server-side.
         *
         * INFRASTRUCTURE
         *
         * 7. Server credentials and secrets must never be
         *    returned to the browser.
         *
         * 8. Database connection credentials must never be
         *    exposed in monitoring responses.
         *
         * 9. Monitoring data must be authenticated and
         *    integrity-checked.
         *
         * 10. Resource thresholds must be configured by the
         *     infrastructure monitoring service.
         *
         * EMERGENCY ACTIONS
         *
         * 11. Restarts require server-side service eligibility
         *     and dependency validation.
         *
         * 12. Maintenance mode must support appropriate scope
         *     and recovery controls.
         *
         * 13. Integration isolation must validate downstream
         *     dependencies.
         *
         * 14. Rollback requires release compatibility checks
         *     and database migration safety validation.
         *
         * 15. All privileged operations require a documented
         *     justification.
         *
         * 16. All operations require confirmation and
         *     server-side audit logging.
         *
         * 17. Destructive or unsafe operations must be rejected
         *     when operational safeguards fail.
         *
         * ALERTS
         *
         * 18. Dashboard, email and SMS alerts must be generated
         *     by the backend notification service.
         *
         * 19. Alert delivery status must reflect real delivery
         *     provider responses.
         *
         * AUDIT
         *
         * 20. Infrastructure audit records must be append-only.
         *
         * 21. Retention is configured for 365 days, subject to
         *     applicable legal and security requirements.
         *
         * 22. Audit deletion and alteration are not exposed
         *     as routine frontend operations.
         *
         * RELIABILITY
         *
         * 23. Monitoring failures must never be interpreted
         *     as healthy infrastructure.
         *
         * 24. Missing telemetry must display as unavailable.
         *
         * 25. Monitoring timestamps must use server time and
         *     preserve the source timestamp.
         *
         * 26. Monitoring APIs must be rate-limited.
         *
         * 27. Sensitive event details must respect access
         *     restrictions.
         *
         * 28. All operational changes must preserve their
         *     historical record.
         */

    }


    /* =====================================================
       46. CLEANUP
    ===================================================== */

    function initializeCleanup() {

        window.addEventListener("pagehide", () => {

            state.destroyed = true;

            stopRefresh();

        });

    }


    /* =====================================================
       47. INITIALIZATION
    ===================================================== */

    async function initialize() {

        initializeSidebar();

        initializeNavigation();

        initializeModals();

        initializeFilters();

        initializeMaintenanceForms();

        initializeReportForm();

        initializeExports();

        initializeSecurity();

        initializeCleanup();


        byId("alerts-button")
            ?.addEventListener("click", () => {

                navigate("alerts");

            });


        const authenticated =
            await verifySession();


        if (!authenticated) {

            return;

        }


        await loadPanel(
            state.activePanel,
            true
        );


        startRefresh();


        console.info(
            "TALVORA System Monitoring & Infrastructure Centre initialized."
        );

    }


    /* =====================================================
       48. START
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
