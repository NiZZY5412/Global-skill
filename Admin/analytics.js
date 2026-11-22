
/* ============================================================
   TALVORA TECHNOLOGIES
   GLOBAL PLATFORM ANALYTICS & INTELLIGENCE CENTRE
   analytics.js

   Integrated application architecture:
   - Authenticated API communication
   - Server-side analytics aggregation
   - Database-backed datasets
   - Global filtering
   - Country and portal intelligence
   - Workforce and employment analytics
   - Financial analytics with currency separation
   - Operational analytics
   - Server-side CSV imports
   - Server-generated report exports
   - Session and permission handling
   - Error handling and request timeouts
   - Automatic dashboard refresh
============================================================ */

(() => {
    "use strict";

    /* ========================================================
       1. APPLICATION CONFIGURATION
    ======================================================== */

    const ROOT_CONFIG = window.TALVORA_CONFIG || {};
    const PROVIDED_CONFIG = ROOT_CONFIG.analytics || {};

    const CONFIG = {
        apiBaseUrl:
            PROVIDED_CONFIG.apiBaseUrl ||
            ROOT_CONFIG.apiBaseUrl ||
            "/api",

        credentials: PROVIDED_CONFIG.credentials || "include",

        requestTimeout: PROVIDED_CONFIG.requestTimeout || 30000,

        refreshInterval: PROVIDED_CONFIG.refreshInterval ?? 60000,

        maxImportSize: PROVIDED_CONFIG.maxImportSize || 10 * 1024 * 1024,

        endpoints: {
            dashboard: "/v1/admin/analytics/dashboard",
            datasetImport: "/v1/admin/analytics/datasets/import",
            report: "/v1/admin/analytics/reports/{type}",

            ...(PROVIDED_CONFIG.endpoints || {})
        },

        getAccessToken: PROVIDED_CONFIG.getAccessToken,

        onUnauthorized: PROVIDED_CONFIG.onUnauthorized,

        onForbidden: PROVIDED_CONFIG.onForbidden
    };

    const state = {
        activeView: "overview",

        dashboard: null,

        filters: {
            from: "",
            to: "",
            country: "",
            portal: ""
        },

        loading: false,

        initialized: false,

        requestSequence: 0,

        lastUpdated: null,

        refreshTimer: null
    };

    const COLORS = [
        "#6658d9",
        "#3984ed",
        "#159b75",
        "#ed963e",
        "#17a8bd",
        "#c99a35",
        "#dc5265"
    ];

    const METRIC_LABELS = {
        platform_users: "Platform Users",
        employers: "Employers",
        employees: "Employees",
        active_users: "Active Users",
        registrations: "Registrations",
        jobs: "Published Jobs",
        applications: "Applications",
        placements: "Placements",
        revenue: "Revenue",
        transactions: "Transactions",
        uptime_percent: "Uptime",
        incidents: "Incidents",
        errors: "Errors",
        response_time_ms: "Response Time"
    };


    /* ========================================================
       2. DOM UTILITIES
    ======================================================== */

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        [...root.querySelectorAll(selector)];

    const byId = id =>
        document.getElementById(id);

    function escapeHTML(value) {
        return String(value ?? "").replace(
            /[&<>"']/g,
            character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            })[character]
        );
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

    function number(value, decimals = 0) {
        if (
            value === null ||
            value === undefined ||
            value === "" ||
            !Number.isFinite(Number(value))
        ) {
            return "—";
        }

        return Number(value).toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    function percentage(value) {
        return value === null || value === undefined
            ? "—"
            : `${number(value, 2)}%`;
    }

    function dateTime(value) {
        if (!value) return "—";

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? "—"
            : date.toLocaleString();
    }

    function dateLabel(value) {
        if (!value) return "";

        return String(value).slice(0, 10);
    }

    function getValue(object, ...keys) {
        for (const key of keys) {
            if (
                object &&
                object[key] !== undefined &&
                object[key] !== null
            ) {
                return object[key];
            }
        }

        return null;
    }

    function array(value) {
        return Array.isArray(value) ? value : [];
    }

    function currency(value, currencyCode) {
        if (value === null || value === undefined) {
            return "—";
        }

        if (!currencyCode || currencyCode === "Unspecified") {
            return `${number(value, 2)} (currency unspecified)`;
        }

        try {
            return new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: currencyCode,
                maximumFractionDigits: 2
            }).format(value);

        } catch {
            return `${currencyCode} ${number(value, 2)}`;
        }
    }


    /* ========================================================
       3. API COMMUNICATION LAYER
    ======================================================== */

    class APIError extends Error {
        constructor(message, status, details = null) {
            super(message);

            this.name = "APIError";
            this.status = status;
            this.details = details;
        }
    }

    function getCSRFToken() {
        if (typeof PROVIDED_CONFIG.getCSRFToken === "function") {
            return PROVIDED_CONFIG.getCSRFToken();
        }

        return (
            PROVIDED_CONFIG.csrfToken ||
            $('meta[name="csrf-token"]')?.content ||
            ""
        );
    }

    async function getAuthorizationToken() {
        if (typeof CONFIG.getAccessToken !== "function") {
            return null;
        }

        return await CONFIG.getAccessToken();
    }

    function buildAPIURL(path, query = {}) {
        const base = new URL(
            CONFIG.apiBaseUrl.endsWith("/")
                ? CONFIG.apiBaseUrl
                : `${CONFIG.apiBaseUrl}/`,
            window.location.origin
        );

        const cleanPath = String(path).replace(/^\/+/, "");

        const url = new URL(cleanPath, base);

        Object.entries(query).forEach(([key, value]) => {
            if (
                value !== null &&
                value !== undefined &&
                value !== ""
            ) {
                url.searchParams.set(key, value);
            }
        });

        return url.toString();
    }

    async function readError(response) {
        try {
            const data = await response.json();

            return (
                data.message ||
                data.error ||
                data.detail ||
                `Server request failed (${response.status}).`
            );

        } catch {
            return `Server request failed (${response.status}).`;
        }
    }

    async function apiRequest(
        path,
        {
            method = "GET",
            query = {},
            body = null,
            responseType = "json",
            headers = {}
        } = {}
    ) {
        const controller = new AbortController();

        const timeout = window.setTimeout(
            () => controller.abort(),
            CONFIG.requestTimeout
        );

        try {
            const requestHeaders = {
                Accept: responseType === "blob"
                    ? "text/csv, application/octet-stream, application/json"
                    : "application/json",

                ...headers
            };

            const token = await getAuthorizationToken();

            if (token) {
                requestHeaders.Authorization = `Bearer ${token}`;
            }

            const csrf = getCSRFToken();

            if (csrf && !["GET", "HEAD", "OPTIONS"].includes(method)) {
                requestHeaders["X-CSRF-Token"] = csrf;
            }

            if (
                body !== null &&
                !(body instanceof FormData)
            ) {
                requestHeaders["Content-Type"] = "application/json";
            }

            const response = await fetch(
                buildAPIURL(path, query),
                {
                    method,

                    headers: requestHeaders,

                    credentials: CONFIG.credentials,

                    cache: "no-store",

                    body: body === null
                        ? undefined
                        : body instanceof FormData
                            ? body
                            : JSON.stringify(body),

                    signal: controller.signal
                }
            );

            if (response.status === 401) {
                if (typeof CONFIG.onUnauthorized === "function") {
                    CONFIG.onUnauthorized();
                }

                throw new APIError(
                    "Your session has expired. Please sign in again.",
                    401
                );
            }

            if (response.status === 403) {
                if (typeof CONFIG.onForbidden === "function") {
                    CONFIG.onForbidden();
                }

                throw new APIError(
                    "You do not have permission to access this resource.",
                    403
                );
            }

            if (!response.ok) {
                throw new APIError(
                    await readError(response),
                    response.status
                );
            }

            if (response.status === 204) {
                return null;
            }

            if (responseType === "blob") {
                return {
                    blob: await response.blob(),
                    response
                };
            }

            if (responseType === "text") {
                return await response.text();
            }

            return await response.json();

        } catch (error) {
            if (error.name === "AbortError") {
                throw new APIError(
                    "The server request timed out. Please try again.",
                    408
                );
            }

            if (error instanceof APIError) {
                throw error;
            }

            throw new APIError(
                "Unable to communicate with the TALVORA server. Check your connection and try again.",
                0,
                error
            );

        } finally {
            window.clearTimeout(timeout);
        }
    }


    /* ========================================================
       4. API RESPONSE NORMALIZATION
    ======================================================== */

    function normalizeDashboard(response) {
        const data = response?.data ?? response;

        if (!data || typeof data !== "object") {
            throw new APIError(
                "The analytics server returned an invalid response.",
                502
            );
        }

        return {
            meta: data.meta || {},

            overview: data.overview || {},

            growth: data.growth || {},

            workforce: data.workforce || {},

            countries: data.countries || {},

            employment: data.employment || {},

            financial: data.financial || {},

            operations: data.operations || {},

            datasets: array(data.datasets),

            activity: array(data.activity)
        };
    }


    /* ========================================================
       5. NOTIFICATION SYSTEM
    ======================================================== */

    function notify(message, type = "success") {
        let region = byId("ta-toast-region");

        if (!region) {
            region = document.createElement("div");

            region.id = "ta-toast-region";
            region.className = "ta-toast-region";

            region.setAttribute("role", "status");
            region.setAttribute("aria-live", "polite");

            document.body.appendChild(region);
        }

        const toast = document.createElement("div");

        toast.className = `ta-toast ${type}`;
        toast.textContent = message;

        region.appendChild(toast);

        window.setTimeout(() => toast.remove(), 5000);
    }

    function updateConnectionNotice(message, isError = false) {
        const notice = byId("ta-notice");

        if (!notice) return;

        notice.textContent = message;

        notice.classList.toggle(
            "ta-connection-error",
            isError
        );
    }

    function setLoading(loading) {
        state.loading = loading;

        const refreshButton = byId("ta-refresh");

        if (refreshButton) {
            refreshButton.disabled = loading;

            refreshButton.textContent = loading
                ? "Loading..."
                : "↻ Refresh";
        }

        document.body.classList.toggle(
            "ta-analytics-loading",
            loading
        );
    }


    /* ========================================================
       6. GLOBAL FILTERS
    ======================================================== */

    function getFilterParameters() {
        return {
            date_from: state.filters.from,
            date_to: state.filters.to,
            country: state.filters.country,
            portal: state.filters.portal
        };
    }

    function readFilters() {
        const from = byId("ta-date-from")?.value || "";
        const to = byId("ta-date-to")?.value || "";

        if (from && to && from > to) {
            notify(
                "The start date cannot be after the end date.",
                "warning"
            );

            return false;
        }

        state.filters = {
            from,
            to,

            country:
                byId("ta-country-filter")?.value || "",

            portal:
                byId("ta-portal-filter")?.value || ""
        };

        return true;
    }

    async function applyFilters() {
        if (!readFilters()) return;

        await loadDashboard();

        notify("Analytics filters applied.");
    }

    async function clearFilters() {
        [
            "ta-date-from",
            "ta-date-to",
            "ta-country-filter",
            "ta-portal-filter"
        ].forEach(id => {
            const input = byId(id);

            if (input) input.value = "";
        });

        state.filters = {
            from: "",
            to: "",
            country: "",
            portal: ""
        };

        await loadDashboard();

        notify("All analytics filters cleared.");
    }


    /* ========================================================
       7. DASHBOARD DATA RETRIEVAL
    ======================================================== */

    async function loadDashboard({ silent = false } = {}) {
        if (state.loading) return;

        const requestId = ++state.requestSequence;

        setLoading(true);

        if (!silent) {
            updateConnectionNotice(
                "Connecting to TALVORA analytics services..."
            );
        }

        try {
            const response = await apiRequest(
                CONFIG.endpoints.dashboard,
                {
                    method: "GET",
                    query: getFilterParameters()
                }
            );

            if (requestId !== state.requestSequence) return;

            state.dashboard = normalizeDashboard(response);

            state.lastUpdated = new Date().toISOString();

            renderAll();

            updateConnectionNotice(
                `Connected to TALVORA analytics services. Last updated: ${dateTime(state.lastUpdated)}`
            );

            setText(
                "ta-last-updated",
                dateTime(state.lastUpdated)
            );

        } catch (error) {
            if (requestId !== state.requestSequence) return;

            console.error(
                "[TALVORA Analytics API]",
                error
            );

            updateConnectionNotice(
                error.message,
                true
            );

            if (!silent) {
                notify(error.message, "error");
            }

        } finally {
            if (requestId === state.requestSequence) {
                setLoading(false);
            }
        }
    }


    /* ========================================================
       8. CHART UTILITIES
    ======================================================== */

    function emptyChart(id, message) {
        const container = byId(id);

        if (!container) return;

        container.innerHTML = `
            <div class="ta-empty-chart">
                ${escapeHTML(message)}
            </div>
        `;
    }

    function normalizeSeries(items) {
        return array(items)
            .map(item => ({
                label: item.date || item.label || item.period || "",
                value: Number(item.value ?? item.total)
            }))
            .filter(item =>
                item.label &&
                Number.isFinite(item.value)
            )
            .sort((a, b) =>
                String(a.label).localeCompare(String(b.label))
            );
    }


    /* ========================================================
       9. LINE CHART
    ======================================================== */

    function renderLineChart(
        id,
        data,
        message = "No analytics data available."
    ) {
        const container = byId(id);

        if (!container) return;

        const values = normalizeSeries(data);

        if (!values.length) {
            emptyChart(id, message);
            return;
        }

        const width = 760;
        const height = 280;

        const left = 65;
        const right = 25;
        const top = 20;
        const bottom = 45;

        const plotWidth = width - left - right;
        const plotHeight = height - top - bottom;

        const minimum = Math.min(
            0,
            ...values.map(item => item.value)
        );

        const maximum = Math.max(
            1,
            ...values.map(item => item.value)
        );

        const range = maximum - minimum || 1;

        const x = index =>
            values.length === 1
                ? left + plotWidth / 2
                : left + index / (values.length - 1) * plotWidth;

        const y = value =>
            top + (maximum - value) / range * plotHeight;

        const points = values.map((item, index) => ({
            x: x(index),
            y: y(item.value),
            item
        }));

        const path = points.map((point, index) =>
            `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
        ).join(" ");

        const gradientId =
            `ta-gradient-${id.replace(/[^a-z0-9]/gi, "")}`;

        const areaPath = `
            ${path}
            L ${points[points.length - 1].x} ${top + plotHeight}
            L ${points[0].x} ${top + plotHeight}
            Z
        `;

        let grid = "";

        for (let i = 0; i <= 4; i++) {
            const value = maximum - range * i / 4;

            const gridY =
                top + plotHeight * i / 4;

            grid += `
                <line
                    x1="${left}"
                    y1="${gridY}"
                    x2="${width - right}"
                    y2="${gridY}"
                    class="ta-chart-gridline"
                />

                <text
                    x="${left - 10}"
                    y="${gridY + 4}"
                    text-anchor="end"
                    class="ta-chart-axis-text"
                >
                    ${escapeHTML(number(value))}
                </text>
            `;
        }

        const step = Math.max(
            1,
            Math.ceil(values.length / 7)
        );

        const labels = points.map((point, index) => {
            if (
                index % step !== 0 &&
                index !== points.length - 1
            ) {
                return "";
            }

            return `
                <text
                    x="${point.x}"
                    y="${height - 12}"
                    text-anchor="middle"
                    class="ta-chart-axis-text"
                >
                    ${escapeHTML(point.item.label.slice(5, 10))}
                </text>
            `;
        }).join("");

        const circles = points.map(point => `
            <circle
                cx="${point.x}"
                cy="${point.y}"
                r="4.5"
                class="ta-chart-point"
            >
                <title>
                    ${escapeHTML(point.item.label)}:
                    ${escapeHTML(number(point.item.value, 2))}
                </title>
            </circle>
        `).join("");

        container.innerHTML = `
            <svg
                class="ta-chart-svg"
                viewBox="0 0 ${width} ${height}"
                role="img"
                aria-label="Analytics trend chart"
            >
                <defs>
                    <linearGradient
                        id="${gradientId}"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                    >
                        <stop
                            offset="0%"
                            stop-color="#6658d9"
                            stop-opacity=".35"
                        />

                        <stop
                            offset="100%"
                            stop-color="#6658d9"
                            stop-opacity="0"
                        />
                    </linearGradient>
                </defs>

                ${grid}

                <path
                    d="${areaPath}"
                    fill="url(#${gradientId})"
                />

                <path
                    d="${path}"
                    class="ta-chart-line"
                />

                ${circles}
                ${labels}
            </svg>
        `;
    }


    /* ========================================================
       10. BAR CHART
    ======================================================== */

    function renderBarChart(
        id,
        data,
        message = "No comparison data available."
    ) {
        const container = byId(id);

        if (!container) return;

        const items = array(data)
            .map(item => ({
                label: String(item.label || item.name || ""),
                value: Number(item.value ?? item.total)
            }))
            .filter(item =>
                item.label &&
                Number.isFinite(item.value)
            )
            .sort((a, b) => b.value - a.value)
            .slice(0, 12);

        if (!items.length) {
            emptyChart(id, message);
            return;
        }

        const width = 760;
        const height = 280;

        const left = 65;
        const right = 25;
        const top = 25;
        const bottom = 55;

        const plotWidth = width - left - right;
        const plotHeight = height - top - bottom;

        const maximum = Math.max(
            1,
            ...items.map(item => item.value)
        );

        const groupWidth = plotWidth / items.length;

        const barWidth = Math.min(
            42,
            groupWidth * 0.56
        );

        let bars = "";

        items.forEach((item, index) => {
            const barHeight =
                Math.max(1, item.value / maximum * plotHeight);

            const x =
                left +
                index * groupWidth +
                (groupWidth - barWidth) / 2;

            const y = top + plotHeight - barHeight;

            bars += `
                <rect
                    x="${x}"
                    y="${y}"
                    width="${barWidth}"
                    height="${barHeight}"
                    class="ta-chart-bar"
                    rx="5"
                >
                    <title>
                        ${escapeHTML(item.label)}:
                        ${escapeHTML(number(item.value))}
                    </title>
                </rect>

                <text
                    x="${x + barWidth / 2}"
                    y="${Math.max(12, y - 7)}"
                    text-anchor="middle"
                    class="ta-chart-axis-text"
                >
                    ${escapeHTML(number(item.value))}
                </text>

                <text
                    x="${x + barWidth / 2}"
                    y="${height - 22}"
                    text-anchor="middle"
                    class="ta-chart-axis-text"
                >
                    ${escapeHTML(
                item.label.length > 11
                    ? item.label.slice(0, 10) + "…"
                    : item.label
            )}
                </text>
            `;
        });

        let grid = "";

        for (let i = 0; i <= 4; i++) {
            const y = top + plotHeight * i / 4;

            grid += `
                <line
                    x1="${left}"
                    y1="${y}"
                    x2="${width - right}"
                    y2="${y}"
                    class="ta-chart-gridline"
                />
            `;
        }

        container.innerHTML = `
            <svg
                class="ta-chart-svg"
                viewBox="0 0 ${width} ${height}"
                role="img"
                aria-label="Analytics comparison chart"
            >
                ${grid}
                ${bars}
            </svg>
        `;
    }


    /* ========================================================
       11. DONUT CHART
    ======================================================== */

    function renderDonutChart(id, data) {
        const container = byId(id);

        if (!container) return;

        const items = array(data)
            .map(item => ({
                label: item.label || item.name || "",
                value: Number(item.value ?? item.total)
            }))
            .filter(item =>
                item.label &&
                Number.isFinite(item.value) &&
                item.value > 0
            );

        if (!items.length) {
            emptyChart(
                id,
                "No composition data available."
            );

            return;
        }

        const total = items.reduce(
            (sum, item) => sum + item.value,
            0
        );

        const radius = 57;
        const circumference = 2 * Math.PI * radius;

        let offset = 0;

        const circles = items.map((item, index) => {
            const length =
                item.value / total * circumference;

            const circle = `
                <circle
                    cx="90"
                    cy="90"
                    r="${radius}"
                    fill="none"
                    stroke="${COLORS[index % COLORS.length]}"
                    stroke-width="19"
                    stroke-dasharray="${length} ${circumference - length}"
                    stroke-dashoffset="${-offset}"
                    transform="rotate(-90 90 90)"
                />
            `;

            offset += length;

            return circle;
        }).join("");

        const legend = items.map((item, index) => `
            <div class="ta-donut-legend-item">

                <span
                    class="ta-donut-dot"
                    style="background:${COLORS[index % COLORS.length]}"
                ></span>

                ${escapeHTML(item.label)}

                <strong>${escapeHTML(number(item.value))}</strong>

            </div>
        `).join("");

        container.innerHTML = `
            <div class="ta-donut-layout">

                <svg
                    class="ta-donut-svg"
                    viewBox="0 0 180 180"
                    role="img"
                    aria-label="Analytics composition"
                >
                    <circle
                        cx="90"
                        cy="90"
                        r="${radius}"
                        fill="none"
                        stroke="#edf0f5"
                        stroke-width="19"
                    />

                    ${circles}

                    <text
                        x="90"
                        y="87"
                        text-anchor="middle"
                        font-size="19"
                        font-weight="800"
                        fill="#101a35"
                    >
                        ${escapeHTML(number(total))}
                    </text>

                    <text
                        x="90"
                        y="105"
                        text-anchor="middle"
                        font-size="9"
                        fill="#8490a5"
                    >
                        TOTAL
                    </text>
                </svg>

                <div class="ta-donut-legend">
                    ${legend}
                </div>

            </div>
        `;
    }


    /* ========================================================
       12. OVERVIEW ANALYTICS
    ======================================================== */

    function renderOverview() {
        const data = state.dashboard;

        if (!data) return;

        const overview = data.overview;

        const fields = [
            ["ta-total-users", "totalUsers"],
            ["ta-total-employers", "totalEmployers"],
            ["ta-total-employees", "totalEmployees"],
            ["ta-total-jobs", "totalJobs"],
            ["ta-total-applications", "totalApplications"],
            ["ta-total-placements", "totalPlacements"]
        ];

        fields.forEach(([id, key]) => {
            setText(id, number(overview[key]));
        });

        const growth = data.growth;

        const metric =
            byId("ta-growth-chart-metric")?.value ||
            "platform_users";

        const metricMap = {
            platform_users: growth.platformUsers,
            registrations: growth.registrations,
            active_users: growth.activeUsers,
            jobs: growth.jobs,
            applications: growth.applications,
            placements: growth.placements
        };

        renderLineChart(
            "ta-overview-growth-chart",
            metricMap[metric],
            "No historical growth data available."
        );

        renderDonutChart(
            "ta-workforce-chart",
            data.workforce.distribution
        );

        renderBarChart(
            "ta-overview-country-chart",
            array(data.countries.summary).map(item => ({
                label: item.country,
                value: item.users
            })),
            "No country comparison data available."
        );

        renderActivity();
    }


    /* ========================================================
       13. GROWTH INTELLIGENCE
    ======================================================== */

    function renderGrowth() {
        const data = state.dashboard;

        if (!data) return;

        const growth = data.growth;

        setText(
            "ta-growth-registrations",
            number(growth.totalRegistrations)
        );

        setText(
            "ta-growth-active",
            number(growth.activeUsers)
        );

        setText(
            "ta-growth-countries",
            number(growth.countriesCovered)
        );

        setText(
            "ta-growth-records",
            number(data.meta.recordCount)
        );

        renderLineChart(
            "ta-registration-chart",
            growth.registrations
        );

        renderLineChart(
            "ta-adoption-chart",
            growth.activeUserTrend
        );

        renderBarChart(
            "ta-growth-portal-chart",
            growth.portalUsers
        );
    }


    /* ========================================================
       14. WORKFORCE INTELLIGENCE
    ======================================================== */

    function renderWorkforce() {
        const workforce = state.dashboard?.workforce;

        if (!workforce) return;

        setText(
            "ta-workforce-total",
            number(workforce.total)
        );

        setText(
            "ta-workforce-active",
            number(workforce.active)
        );

        setText(
            "ta-workforce-employers",
            number(workforce.employers)
        );

        setText(
            "ta-workforce-ratio",
            workforce.employeeEmployerRatio === null ||
                workforce.employeeEmployerRatio === undefined
                ? "—"
                : `${number(workforce.employeeEmployerRatio, 2)} : 1`
        );

        renderDonutChart(
            "ta-workforce-distribution",
            workforce.distribution
        );

        renderLineChart(
            "ta-workforce-trends",
            workforce.trend
        );

        renderTable(
            "ta-workforce-table",
            [
                "date",
                "country",
                "employers",
                "employees",
                "activeUsers",
                "portal"
            ],
            array(workforce.rows)
        );
    }


    /* ========================================================
       15. COUNTRY INTELLIGENCE
    ======================================================== */

    function renderCountries() {
        const countries = state.dashboard?.countries;

        if (!countries) return;

        const summary = array(countries.summary);

        setText(
            "ta-country-total",
            number(countries.totalCountries ?? summary.length)
        );

        setText(
            "ta-country-users",
            number(countries.totalUsers)
        );

        const leading = countries.leadingCountry;

        setText(
            "ta-country-leading",
            leading?.country || "—"
        );

        setText(
            "ta-country-records",
            number(summary.length)
        );

        renderBarChart(
            "ta-country-comparison",
            summary.map(item => ({
                label: item.country,
                value: item.users
            }))
        );

        renderTable(
            "ta-country-table",
            [
                "country",
                "users",
                "employers",
                "employees",
                "jobs",
                "applications",
                "placements"
            ],
            summary
        );
    }


    /* ========================================================
       16. EMPLOYMENT INTELLIGENCE
    ======================================================== */

    function renderEmployment() {
        const employment = state.dashboard?.employment;

        if (!employment) return;

        setText(
            "ta-employment-jobs",
            number(employment.jobs)
        );

        setText(
            "ta-employment-applications",
            number(employment.applications)
        );

        setText(
            "ta-employment-placements",
            number(employment.placements)
        );

        setText(
            "ta-employment-rate",
            percentage(employment.placementRate)
        );

        renderBarChart(
            "ta-employment-lifecycle",
            employment.lifecycle
        );

        renderLineChart(
            "ta-application-chart",
            employment.applicationTrend
        );

        renderBarChart(
            "ta-placement-chart",
            employment.placementsByCountry
        );
    }


    /* ========================================================
       17. FINANCIAL INTELLIGENCE
    ======================================================== */

    function renderFinancial() {
        const financial = state.dashboard?.financial;

        if (!financial) return;

        const revenue = array(financial.revenueByCurrency);

        if (revenue.length === 1) {
            setText(
                "ta-financial-revenue",
                currency(
                    revenue[0].amount,
                    revenue[0].currency
                )
            );

        } else if (revenue.length > 1) {
            setText(
                "ta-financial-revenue",
                "Multiple currencies"
            );

        } else {
            setText(
                "ta-financial-revenue",
                "—"
            );
        }

        setText(
            "ta-financial-transactions",
            number(financial.transactions)
        );

        const average = array(
            financial.averageTransactionValueByCurrency
        );

        setText(
            "ta-financial-average",
            average.length === 1
                ? currency(
                    average[0].amount,
                    average[0].currency
                )
                : average.length > 1
                    ? "Multiple currencies"
                    : "—"
        );

        setText(
            "ta-financial-currency",
            revenue.map(item => item.currency).join(", ") || "—"
        );

        if (revenue.length === 1) {
            renderLineChart(
                "ta-revenue-chart",
                financial.revenueTrend
            );

        } else {
            renderBarChart(
                "ta-revenue-chart",
                revenue.map(item => ({
                    label: item.currency,
                    value: item.amount
                }))
            );
        }

        renderTable(
            "ta-financial-table",
            [
                "date",
                "country",
                "revenue",
                "currency",
                "transactions",
                "status"
            ],
            array(financial.rows)
        );
    }


    /* ========================================================
       18. OPERATIONAL INTELLIGENCE
    ======================================================== */

    function renderOperations() {
        const operations = state.dashboard?.operations;

        if (!operations) return;

        setText(
            "ta-operations-uptime",
            percentage(operations.uptimePercent)
        );

        setText(
            "ta-operations-incidents",
            number(operations.incidents)
        );

        setText(
            "ta-operations-errors",
            number(operations.errors)
        );

        setText(
            "ta-operations-response",
            operations.responseTimeMs === null ||
                operations.responseTimeMs === undefined
                ? "—"
                : `${number(operations.responseTimeMs, 2)} ms`
        );

        renderLineChart(
            "ta-uptime-chart",
            operations.uptimeTrend
        );

        renderLineChart(
            "ta-incident-chart",
            operations.incidentTrend
        );

        renderTable(
            "ta-operations-table",
            [
                "date",
                "country",
                "uptimePercent",
                "incidents",
                "errors",
                "responseTimeMs"
            ],
            array(operations.rows)
        );
    }


    /* ========================================================
       19. UNIVERSAL TABLE RENDERER
    ======================================================== */

    function renderTable(id, columns, rows) {
        const body = byId(id);

        if (!body) return;

        if (!rows.length) {
            const colspan = $(`#${id}`)
                ?.closest("table")
                ?.querySelectorAll("thead th").length || columns.length;

            body.innerHTML = `
                <tr>
                    <td
                        colspan="${colspan}"
                        class="ta-table-empty"
                    >
                        No records available for the selected filters.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML = rows.slice(0, 200).map(row => `
            <tr>
                ${columns.map(column => {
            let value = row[column];

            if (
                column.toLowerCase().includes("percent") &&
                value !== null &&
                value !== undefined
            ) {
                value = `${number(value, 2)}%`;
            }

            if (
                column.toLowerCase().includes("responsetime") &&
                value !== null &&
                value !== undefined
            ) {
                value = `${number(value, 2)} ms`;
            }

            if (
                typeof value === "number"
            ) {
                value = number(value, 2);
            }

            return `
                        <td>${escapeHTML(value ?? "—")}</td>
                    `;
        }).join("")}
            </tr>
        `).join("");
    }


    /* ========================================================
       20. RECENT ADMIN ACTIVITY
    ======================================================== */

    function renderActivity() {
        const container = byId("ta-recent-activity");

        if (!container) return;

        const activity = array(
            state.dashboard?.activity
        );

        if (!activity.length) {
            container.innerHTML = `
                <div class="ta-empty-state">
                    <strong>No activity records available</strong>
                    <p>Administrator activity will appear here when provided by the server.</p>
                </div>
            `;

            return;
        }

        container.innerHTML = activity.slice(0, 12).map(item => `
            <div class="ta-activity-item">

                <div class="ta-activity-icon">◈</div>

                <div>
                    <strong>
                        ${escapeHTML(item.action || item.title || "Platform activity")}
                    </strong>

                    <p>
                        ${escapeHTML(item.description || item.message || "")}
                    </p>

                    <time>
                        ${escapeHTML(
            dateTime(item.timestamp || item.createdAt)
        )}
                    </time>
                </div>

            </div>
        `).join("");
    }


    /* ========================================================
       21. DATASET REGISTER
    ======================================================== */

    function renderDatasets() {
        const body = byId("ta-dataset-table");

        if (!body) return;

        const datasets = array(
            state.dashboard?.datasets
        );

        if (!datasets.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="4" class="ta-table-empty">
                        No datasets are currently registered.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML = datasets.map(dataset => `
            <tr>
                <td>
                    <strong>
                        ${escapeHTML(dataset.name || dataset.filename)}
                    </strong>

                    <br>

                    <small>
                        ${escapeHTML(dataset.filename || "")}
                    </small>
                </td>

                <td>
                    ${escapeHTML(number(dataset.recordCount ?? dataset.records))}
                </td>

                <td>
                    ${escapeHTML(
            dateTime(dataset.importedAt || dataset.createdAt)
        )}
                </td>

                <td>
                    <span class="ta-data-label">
                        ${escapeHTML(dataset.status || "Registered")}
                    </span>
                </td>
            </tr>
        `).join("");
    }


    /* ========================================================
       22. RENDER ALL DASHBOARD SECTIONS
    ======================================================== */

    function renderAll() {
        if (!state.dashboard) return;

        renderOverview();

        renderGrowth();

        renderWorkforce();

        renderCountries();

        renderEmployment();

        renderFinancial();

        renderOperations();

        renderDatasets();

        renderActivity();
    }


    /* ========================================================
       23. COUNTRY FILTER OPTIONS
    ======================================================== */

    function updateCountryOptions() {
        const selector = byId("ta-country-filter");

        if (!selector) return;

        const countries = array(
            state.dashboard?.countries?.options
        );

        const selected = state.filters.country;

        selector.innerHTML = `
            <option value="">All countries</option>

            ${countries.map(item => {
            const name = typeof item === "string"
                ? item
                : item.country;

            return `
                    <option value="${escapeHTML(name)}">
                        ${escapeHTML(name)}
                    </option>
                `;
        }).join("")}
        `;

        selector.value = selected;
    }


    /* ========================================================
       24. DATASET IMPORT
    ======================================================== */

    function openImportModal() {
        const form = byId("ta-import-form");

        if (form) form.reset();

        const modal = byId("ta-import-modal");

        if (!modal) return;

        modal.hidden = false;

        document.body.style.overflow = "hidden";
    }

    function closeImportModal() {
        const modal = byId("ta-import-modal");

        if (modal) modal.hidden = true;

        document.body.style.overflow = "";
    }

    async function importDataset(form) {
        const name = byId("ta-dataset-name")?.value.trim();

        const file = byId("ta-dataset-file")?.files?.[0];

        if (!name || !file) {
            notify(
                "Enter a dataset name and select a file.",
                "warning"
            );

            return;
        }

        if (!file.name.toLowerCase().endsWith(".csv")) {
            notify(
                "Please select a CSV file.",
                "warning"
            );

            return;
        }

        if (file.size > CONFIG.maxImportSize) {
            notify(
                "The selected file exceeds the permitted upload size.",
                "warning"
            );

            return;
        }

        const submitButton = form.querySelector(
            '[type="submit"]'
        );

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Uploading...";
        }

        try {
            const formData = new FormData();

            formData.append("name", name);
            formData.append("file", file);

            const result = await apiRequest(
                CONFIG.endpoints.datasetImport,
                {
                    method: "POST",
                    body: formData
                }
            );

            closeImportModal();

            form.reset();

            notify(
                result?.message ||
                "Dataset successfully submitted for server processing."
            );

            await loadDashboard();

        } catch (error) {
            console.error(
                "[TALVORA Dataset Import]",
                error
            );

            notify(error.message, "error");

        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Import Dataset";
            }
        }
    }


    /* ========================================================
       25. SERVER-SIDE REPORT GENERATION
    ======================================================== */

    function getReportFilename(response, type) {
        const disposition = response.headers.get(
            "Content-Disposition"
        );

        if (disposition) {
            const match = disposition.match(
                /filename\*?=(?:UTF-8''|")?([^";]+)/i
            );

            if (match) {
                return decodeURIComponent(
                    match[1].replace(/"/g, "")
                );
            }
        }

        return `talvora-${type}-report-${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;
    }

    async function exportReport(type) {
        const allowed = [
            "executive",
            "countries",
            "workforce",
            "employment",
            "financial",
            "operations"
        ];

        if (!allowed.includes(type)) {
            notify("Invalid report type.", "warning");
            return;
        }

        const endpoint = CONFIG.endpoints.report.replace(
            "{type}",
            encodeURIComponent(type)
        );

        try {
            notify("Generating report from TALVORA servers...");

            const result = await apiRequest(
                endpoint,
                {
                    method: "GET",

                    query: getFilterParameters(),

                    responseType: "blob"
                }
            );

            const filename = getReportFilename(
                result.response,
                type
            );

            const url = URL.createObjectURL(result.blob);

            const anchor = document.createElement("a");

            anchor.href = url;
            anchor.download = filename;

            document.body.appendChild(anchor);

            anchor.click();

            anchor.remove();

            window.setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);

            notify("Report successfully downloaded.");

        } catch (error) {
            console.error(
                "[TALVORA Report Export]",
                error
            );

            notify(error.message, "error");
        }
    }

    function exportCurrentView() {
        const viewMap = {
            overview: "executive",
            growth: "executive",
            workforce: "workforce",
            countries: "countries",
            employment: "employment",
            financial: "financial",
            operations: "operations",
            reports: "executive"
        };

        exportReport(
            viewMap[state.activeView] || "executive"
        );
    }


    /* ========================================================
       26. WORKSPACE NAVIGATION
    ======================================================== */

    const VIEWS = [
        "overview",
        "growth",
        "workforce",
        "countries",
        "employment",
        "financial",
        "operations",
        "reports"
    ];

    function activateView(view) {
        if (!VIEWS.includes(view)) return;

        const target = byId(`ta-view-${view}`);

        if (!target) {
            notify(
                `The ${view} workspace could not be found.`,
                "warning"
            );

            return;
        }

        state.activeView = view;

        $$(".ta-view").forEach(section => {
            section.classList.toggle(
                "active",
                section.id === `ta-view-${view}`
            );
        });

        $$(".ta-nav-link").forEach(link => {
            const active = link.dataset.view === view;

            link.classList.toggle("active", active);

            if (active) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });

        closeSidebar();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }


    /* ========================================================
       27. SIDEBAR CONTROLS
    ======================================================== */

    function openSidebar() {
        byId("ta-sidebar")?.classList.add("open");

        byId("ta-sidebar-overlay")?.classList.add("active");
    }

    function closeSidebar() {
        byId("ta-sidebar")?.classList.remove("open");

        byId("ta-sidebar-overlay")?.classList.remove("active");
    }


    /* ========================================================
       28. AUTOMATIC REFRESH
    ======================================================== */

    function startAutomaticRefresh() {
        if (state.refreshTimer) {
            window.clearInterval(state.refreshTimer);
        }

        if (!CONFIG.refreshInterval) return;

        state.refreshTimer = window.setInterval(() => {
            if (
                document.visibilityState === "visible" &&
                !state.loading
            ) {
                loadDashboard({ silent: true });
            }

        }, CONFIG.refreshInterval);
    }

    function stopAutomaticRefresh() {
        if (state.refreshTimer) {
            window.clearInterval(state.refreshTimer);

            state.refreshTimer = null;
        }
    }


    /* ========================================================
       29. EVENT LISTENERS
    ======================================================== */

    function bindEvents() {

        // Workspace navigation

        document.addEventListener("click", event => {

            const viewButton = event.target.closest("[data-view]");

            if (viewButton) {
                activateView(viewButton.dataset.view);
            }

            const goButton = event.target.closest("[data-go-view]");

            if (goButton) {
                activateView(goButton.dataset.goView);
            }

            const reportButton = event.target.closest("[data-report]");

            if (reportButton) {
                exportReport(reportButton.dataset.report);
            }

            if (event.target.closest("[data-close-modal]")) {
                closeImportModal();
            }

        });


        // Sidebar

        byId("ta-menu-button")?.addEventListener(
            "click",
            openSidebar
        );

        byId("ta-sidebar-close")?.addEventListener(
            "click",
            closeSidebar
        );

        byId("ta-sidebar-overlay")?.addEventListener(
            "click",
            closeSidebar
        );


        // Import

        byId("ta-import-trigger")?.addEventListener(
            "click",
            openImportModal
        );

        byId("ta-import-form")?.addEventListener(
            "submit",
            async event => {
                event.preventDefault();

                if (!event.currentTarget.reportValidity()) {
                    return;
                }

                await importDataset(event.currentTarget);
            }
        );


        // Filters

        byId("ta-apply-filters")?.addEventListener(
            "click",
            applyFilters
        );

        byId("ta-clear-filters")?.addEventListener(
            "click",
            clearFilters
        );


        // Chart selection

        byId("ta-growth-chart-metric")?.addEventListener(
            "change",
            renderOverview
        );


        // Refresh

        byId("ta-refresh")?.addEventListener(
            "click",
            () => loadDashboard()
        );


        // Export

        byId("ta-export-current")?.addEventListener(
            "click",
            exportCurrentView
        );


        // Keyboard controls

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closeImportModal();
                closeSidebar();
            }
        });


        // Pause automatic refresh when page is hidden

        document.addEventListener(
            "visibilitychange",
            () => {
                if (document.visibilityState === "visible") {
                    if (
                        state.lastUpdated &&
                        Date.now() - new Date(state.lastUpdated).getTime() >
                        CONFIG.refreshInterval
                    ) {
                        loadDashboard({ silent: true });
                    }
                }
            }
        );

    }


    /* ========================================================
       30. APPLICATION INITIALIZATION
    ======================================================== */

    async function initialize() {
        if (state.initialized) return;

        state.initialized = true;

        bindEvents();

        updateConnectionNotice(
            "Connecting to TALVORA analytics services..."
        );

        await loadDashboard();

        startAutomaticRefresh();

        console.info(
            "TALVORA Global Platform Analytics Centre initialized."
        );
    }


    /* ========================================================
       31. PUBLIC APPLICATION INTERFACE
    ======================================================== */

    window.TALVORAAnalytics = Object.freeze({

        refresh: () => loadDashboard(),

        applyFilters,

        clearFilters,

        exportReport,

        navigate: activateView,

        getLastUpdated: () => state.lastUpdated,

        getActiveView: () => state.activeView

    });


    /* ========================================================
       32. START APPLICATION
    ======================================================== */

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
