
/* ============================================================
   TALVORA TECHNOLOGIES
   GLOBAL RISK, FRAUD DETECTION & PLATFORM INTEGRITY CENTRE
   risk.js

   Application capabilities:
   - Risk dashboard and intelligence
   - Seven risk categories
   - Four severity levels
   - Critical and High alert pop-ups
   - Persistent unacknowledged alerts
   - Administrator acknowledgement records
   - Investigation management
   - Account intervention workflows
   - Security notifications
   - Risk filtering and reporting
   - Security audit history
   - Configurable authenticated API integration
============================================================ */

(() => {
    "use strict";


    /* ========================================================
       1. APPLICATION CONFIGURATION
    ======================================================== */

    const ROOT_CONFIG = window.TALVORA_CONFIG || {};
    const PROVIDED_CONFIG = ROOT_CONFIG.risk || {};

    const API_BASE_URL =
        PROVIDED_CONFIG.apiBaseUrl ||
        ROOT_CONFIG.apiBaseUrl ||
        null;

    const CONFIG = {

        credentials:
            PROVIDED_CONFIG.credentials || "include",

        requestTimeout:
            PROVIDED_CONFIG.requestTimeout || 30000,

        refreshInterval:
            PROVIDED_CONFIG.refreshInterval ?? 60000,

        getAccessToken:
            PROVIDED_CONFIG.getAccessToken,

        onUnauthorized:
            PROVIDED_CONFIG.onUnauthorized,

        onForbidden:
            PROVIDED_CONFIG.onForbidden,

        endpoints: {

            dashboard: "/v1/admin/risk/dashboard",

            alerts: "/v1/admin/risk/alerts",

            investigations: "/v1/admin/risk/investigations",

            accounts: "/v1/admin/risk/accounts",

            detections: "/v1/admin/risk/detections",

            audit: "/v1/admin/risk/audit",

            acknowledge:
                "/v1/admin/risk/alerts/{id}/acknowledge",

            createInvestigation:
                "/v1/admin/risk/investigations",

            intervention:
                "/v1/admin/risk/accounts/{id}/interventions",

            report:
                "/v1/admin/risk/reports/{type}",

            ...(PROVIDED_CONFIG.endpoints || {})
        }
    };


    /* ========================================================
       2. APPLICATION STATE
    ======================================================== */

    const state = {

        activeView: "overview",

        dashboard: {},

        alerts: [],

        investigations: [],

        accounts: [],

        detections: [],

        audit: [],

        notifications: [],

        reportHistory: [],

        filters: {
            from: "",
            to: "",
            country: "",
            severity: ""
        },

        categoryFilter: "",

        selectedAlert: null,

        selectedAccount: null,

        loading: false,

        initialized: false,

        lastUpdated: null,

        refreshTimer: null,

        popupQueue: [],

        shownPopupIds: new Set(),

        popupActive: false
    };


    /* ========================================================
       3. RISK CATEGORY DEFINITIONS
    ======================================================== */

    const CATEGORIES = {

        global_monitoring: {
            label: "Global Risk Monitoring",
            countId: "tr-category-global-count",
            detailId: "tr-detail-global"
        },

        employer_fraud: {
            label: "Employer Fraud",
            countId: "tr-category-employer-count",
            detailId: "tr-detail-employer"
        },

        employee_identity: {
            label: "Employee Identity",
            countId: "tr-category-identity-count",
            detailId: "tr-detail-identity"
        },

        recruitment_fraud: {
            label: "Recruitment Fraud",
            countId: "tr-category-recruitment-count",
            detailId: "tr-detail-recruitment"
        },

        financial_fraud: {
            label: "Financial Fraud",
            countId: "tr-category-financial-count",
            detailId: "tr-detail-financial"
        },

        account_security: {
            label: "Account Security",
            countId: "tr-category-account-count",
            detailId: "tr-detail-account"
        },

        platform_abuse: {
            label: "Platform Abuse",
            countId: "tr-category-abuse-count",
            detailId: "tr-detail-abuse"
        }

    };


    /* ========================================================
       4. GENERAL UTILITIES
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


    function getArray(value) {

        return Array.isArray(value)
            ? value
            : [];

    }


    function unwrap(response) {

        return response?.data ?? response ?? {};

    }


    function extractList(response, ...keys) {

        const data = unwrap(response);

        if (Array.isArray(data)) {
            return data;
        }

        for (const key of keys) {

            if (Array.isArray(data[key])) {
                return data[key];
            }

        }

        if (Array.isArray(data.items)) {
            return data.items;
        }

        if (Array.isArray(data.records)) {
            return data.records;
        }

        return [];

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


    function formatDate(value) {

        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return date.toLocaleString();

    }


    function normalizeSeverity(value) {

        const severity = String(value || "")
            .toLowerCase()
            .trim();

        return [
            "critical",
            "high",
            "medium",
            "low"
        ].includes(severity)
            ? severity
            : "unknown";

    }


    function normalizeStatus(value) {

        return String(value || "open")
            .toLowerCase()
            .replace(/\s+/g, "_");

    }


    function getSeverityClass(value) {

        const severity = normalizeSeverity(value);

        return severity === "unknown"
            ? "tr-status-open"
            : `tr-severity-${severity}`;

    }


    function getStatusClass(value) {

        return `tr-status-${normalizeStatus(value)}`;

    }


    function getCategoryLabel(value) {

        const category = String(value || "");

        return CATEGORIES[category]?.label ||
            category.replace(/_/g, " ") ||
            "Unclassified";

    }


    function getAlertId(alert) {

        return String(
            getValue(alert, "id", "alertId", "reference") || ""
        );

    }


    function isAcknowledged(alert) {

        return Boolean(
            alert.acknowledged === true ||
            alert.acknowledgedAt ||
            alert.acknowledgedBy ||
            normalizeStatus(alert.status) === "acknowledged"
        );

    }


    function isPriorityAlert(alert) {

        const severity = normalizeSeverity(alert.severity);

        return (
            severity === "critical" ||
            severity === "high"
        ) && !isAcknowledged(alert);

    }


    /* ========================================================
       5. NOTIFICATIONS
    ======================================================== */

    function notify(message, type = "success") {

        const region = byId("tr-toast-region");

        if (!region) return;

        const toast = document.createElement("div");

        toast.className = `tr-toast ${type}`;

        toast.textContent = message;

        region.appendChild(toast);

        window.setTimeout(() => {

            toast.remove();

        }, 5000);

    }


    function announce(message) {

        const region = byId("tr-live-region");

        if (region) {
            region.textContent = message;
        }

    }


    function setNotice(message, error = false) {

        const notice = byId("tr-system-notice");

        const text = byId("tr-system-notice-text");

        if (text) {
            text.textContent = message;
        }

        if (notice) {

            notice.classList.toggle(
                "tr-notice-error",
                error
            );

        }

    }


    function setLoading(loading) {

        state.loading = loading;

        const button = byId("tr-refresh");

        if (button) {

            button.disabled = loading;

            button.textContent = loading
                ? "Loading..."
                : "↻ Refresh";

        }

    }


    /* ========================================================
       6. API COMMUNICATION
    ======================================================== */

    class RiskAPIError extends Error {

        constructor(message, status = 0, details = null) {

            super(message);

            this.name = "RiskAPIError";

            this.status = status;

            this.details = details;

        }

    }


    function buildAPIURL(path, query = {}) {

        if (!API_BASE_URL) {

            throw new RiskAPIError(
                "The TALVORA Risk API connection has not been configured."
            );

        }

        const base = new URL(
            API_BASE_URL.endsWith("/")
                ? API_BASE_URL
                : `${API_BASE_URL}/`,

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


    function getCSRFToken() {

        if (
            typeof PROVIDED_CONFIG.getCSRFToken === "function"
        ) {
            return PROVIDED_CONFIG.getCSRFToken();
        }

        return (
            PROVIDED_CONFIG.csrfToken ||
            $('meta[name="csrf-token"]')?.content ||
            ""
        );

    }


    async function getAccessToken() {

        if (
            typeof CONFIG.getAccessToken !== "function"
        ) {
            return null;
        }

        return await CONFIG.getAccessToken();

    }


    async function readAPIError(response) {

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
            responseType = "json"
        } = {}
    ) {

        const controller = new AbortController();

        const timeout = window.setTimeout(
            () => controller.abort(),
            CONFIG.requestTimeout
        );

        try {

            const headers = {
                Accept: responseType === "blob"
                    ? "*/*"
                    : "application/json"
            };

            const token = await getAccessToken();

            if (token) {

                headers.Authorization =
                    `Bearer ${token}`;

            }

            const csrf = getCSRFToken();

            if (
                csrf &&
                !["GET", "HEAD", "OPTIONS"].includes(method)
            ) {

                headers["X-CSRF-Token"] = csrf;

            }

            if (body !== null) {

                headers["Content-Type"] =
                    "application/json";

            }

            const response = await fetch(
                buildAPIURL(path, query),

                {
                    method,

                    headers,

                    credentials: CONFIG.credentials,

                    cache: "no-store",

                    body: body === null
                        ? undefined
                        : JSON.stringify(body),

                    signal: controller.signal
                }
            );


            if (response.status === 401) {

                if (
                    typeof CONFIG.onUnauthorized === "function"
                ) {
                    CONFIG.onUnauthorized();
                }

                throw new RiskAPIError(
                    "Your session has expired. Please sign in again.",
                    401
                );

            }


            if (response.status === 403) {

                if (
                    typeof CONFIG.onForbidden === "function"
                ) {
                    CONFIG.onForbidden();
                }

                throw new RiskAPIError(
                    "You are not authorized to perform this action.",
                    403
                );

            }


            if (!response.ok) {

                throw new RiskAPIError(
                    await readAPIError(response),
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


            return await response.json();


        } catch (error) {

            if (error.name === "AbortError") {

                throw new RiskAPIError(
                    "The server request timed out. Please try again.",
                    408
                );

            }

            if (error instanceof RiskAPIError) {
                throw error;
            }

            throw new RiskAPIError(
                "Unable to communicate with TALVORA security services.",
                0,
                error
            );

        } finally {

            window.clearTimeout(timeout);

        }

    }


    /* ========================================================
       7. MODAL MANAGEMENT
    ======================================================== */

    function showModal(id) {

        const modal = byId(id);

        if (!modal) return;

        modal.hidden = false;

        document.body.style.overflow = "hidden";

    }


    function hideModal(id) {

        const modal = byId(id);

        if (!modal) return;

        modal.hidden = true;

        const remaining = $$(".tr-modal-overlay")
            .some(item => !item.hidden);

        if (!remaining) {

            document.body.style.overflow = "";

        }

    }


    function closeStandardModals() {

        hideModal("tr-investigation-modal");

        hideModal("tr-intervention-modal");

    }


    /* ========================================================
       8. WORKSPACE NAVIGATION
    ======================================================== */

    const VIEWS = [
        "overview",
        "alerts",
        "investigations",
        "accounts",
        "categories",
        "detection",
        "reports",
        "audit"
    ];


    function activateView(view) {

        if (!VIEWS.includes(view)) return;

        const target = byId(`tr-view-${view}`);

        if (!target) return;

        state.activeView = view;

        $$(".tr-view").forEach(section => {

            section.classList.toggle(
                "active",
                section.id === `tr-view-${view}`
            );

        });


        $$(".tr-nav-link").forEach(link => {

            const active = link.dataset.view === view;

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


        closeSidebar();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }


    /* ========================================================
       9. SIDEBAR
    ======================================================== */

    function openSidebar() {

        byId("tr-sidebar")?.classList.add("open");

        byId("tr-sidebar-overlay")?.classList.add("active");

    }


    function closeSidebar() {

        byId("tr-sidebar")?.classList.remove("open");

        byId("tr-sidebar-overlay")?.classList.remove("active");

    }


    /* ========================================================
       10. GLOBAL FILTERS
    ======================================================== */

    function readFilters() {

        const from = byId("tr-date-from")?.value || "";

        const to = byId("tr-date-to")?.value || "";


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
                byId("tr-country-filter")?.value || "",

            severity:
                byId("tr-severity-filter")?.value || ""

        };

        return true;

    }


    function getFilterParameters() {

        return {

            date_from: state.filters.from,

            date_to: state.filters.to,

            country: state.filters.country,

            severity: state.filters.severity

        };

    }


    async function applyFilters() {

        if (!readFilters()) return;

        await loadWorkspace();

        notify("Risk filters applied.");

    }


    async function clearFilters() {

        [
            "tr-date-from",
            "tr-date-to",
            "tr-country-filter",
            "tr-severity-filter"
        ].forEach(id => {

            const input = byId(id);

            if (input) input.value = "";

        });


        state.filters = {
            from: "",
            to: "",
            country: "",
            severity: ""
        };

        state.categoryFilter = "";

        await loadWorkspace();

    }


    function updateCountryOptions() {

        const select = byId("tr-country-filter");

        if (!select) return;

        const countries = getArray(
            state.dashboard.countryOptions ||
            state.dashboard.countries
        );

        const selected = state.filters.country;

        const options = countries.map(item => {

            const country = typeof item === "string"
                ? item
                : item.country || item.name;

            return country;

        }).filter(Boolean);


        select.innerHTML = `
            <option value="">All countries</option>

            ${options.map(country => `
                <option value="${escapeHTML(country)}">
                    ${escapeHTML(country)}
                </option>
            `).join("")}
        `;

        select.value = selected;

    }


    /* ========================================================
       11. ALERT FILTERING
    ======================================================== */

    function getFilteredAlerts() {

        const statusFilter =
            byId("tr-alert-status-filter")?.value || "";

        return state.alerts.filter(alert => {

            if (
                state.categoryFilter &&
                alert.category !== state.categoryFilter
            ) {
                return false;
            }

            if (
                state.filters.country &&
                alert.country !== state.filters.country
            ) {
                return false;
            }

            if (
                state.filters.severity &&
                normalizeSeverity(alert.severity) !==
                state.filters.severity
            ) {
                return false;
            }

            if (
                statusFilter === "unacknowledged" &&
                isAcknowledged(alert)
            ) {
                return false;
            }

            if (
                statusFilter === "acknowledged" &&
                !isAcknowledged(alert)
            ) {
                return false;
            }

            if (
                statusFilter &&
                !["unacknowledged", "acknowledged"].includes(statusFilter)
            ) {

                if (
                    normalizeStatus(alert.status) !==
                    statusFilter
                ) {
                    return false;
                }

            }

            return true;

        });

    }


    /* ========================================================
       12. SEVERITY CHART
    ======================================================== */

    function renderDonutChart(id, data) {

        const container = byId(id);

        if (!container) return;

        const colors = {
            critical: "#d94b5c",
            high: "#e9923e",
            medium: "#3984ed",
            low: "#159b75"
        };


        const items = getArray(data)
            .map(item => ({

                label: String(
                    item.label ||
                    item.severity ||
                    item.name ||
                    ""
                ).toLowerCase(),

                value: Number(
                    item.value ??
                    item.count ??
                    item.total
                )

            }))
            .filter(item =>
                colors[item.label] &&
                Number.isFinite(item.value) &&
                item.value > 0
            );


        if (!items.length) {

            container.innerHTML = `
                <div class="tr-empty-chart">
                    No severity data available.
                </div>
            `;

            return;

        }


        const total = items.reduce(
            (sum, item) => sum + item.value,
            0
        );

        const radius = 57;

        const circumference =
            2 * Math.PI * radius;

        let offset = 0;


        const circles = items.map(item => {

            const length =
                item.value / total * circumference;

            const circle = `
                <circle
                    cx="90"
                    cy="90"
                    r="${radius}"
                    fill="none"
                    stroke="${colors[item.label]}"
                    stroke-width="19"
                    stroke-dasharray="${length} ${circumference - length}"
                    stroke-dashoffset="${-offset}"
                    transform="rotate(-90 90 90)"
                />
            `;

            offset += length;

            return circle;

        }).join("");


        const legend = items.map(item => `
            <div class="tr-donut-legend-item">

                <span
                    class="tr-donut-dot"
                    style="background:${colors[item.label]}"
                ></span>

                ${escapeHTML(
            item.label.charAt(0).toUpperCase() +
            item.label.slice(1)
        )}

                <strong>
                    ${escapeHTML(formatNumber(item.value))}
                </strong>

            </div>
        `).join("");


        container.innerHTML = `

            <div class="tr-donut-layout">

                <svg
                    class="tr-donut-svg"
                    viewBox="0 0 180 180"
                    role="img"
                    aria-label="Risk severity distribution"
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
                        ${escapeHTML(formatNumber(total))}
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

                <div class="tr-donut-legend">
                    ${legend}
                </div>

            </div>

        `;

    }


    /* ========================================================
       13. RISK TREND CHART
    ======================================================== */

    function renderTrendChart(data) {

        const container = byId("tr-risk-trend");

        if (!container) return;

        const values = getArray(data)
            .map(item => ({

                label:
                    item.date ||
                    item.period ||
                    item.label ||
                    "",

                value: Number(
                    item.count ??
                    item.value ??
                    item.total
                )

            }))
            .filter(item =>
                item.label &&
                Number.isFinite(item.value)
            );


        if (!values.length) {

            container.innerHTML = `
                <div class="tr-empty-chart">
                    No risk trend data available.
                </div>
            `;

            return;

        }


        const width = 760;
        const height = 260;

        const left = 60;
        const right = 25;
        const top = 20;
        const bottom = 40;

        const plotWidth = width - left - right;
        const plotHeight = height - top - bottom;

        const maximum = Math.max(
            1,
            ...values.map(item => item.value)
        );

        const x = index =>
            values.length === 1
                ? left + plotWidth / 2
                : left + index / (values.length - 1) * plotWidth;

        const y = value =>
            top + plotHeight -
            (value / maximum) * plotHeight;


        const points = values.map((item, index) => ({

            x: x(index),

            y: y(item.value),

            item

        }));


        const path = points.map((point, index) =>

            `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`

        ).join(" ");


        const area = `
            ${path}
            L ${points[points.length - 1].x} ${top + plotHeight}
            L ${points[0].x} ${top + plotHeight}
            Z
        `;


        let grid = "";

        for (let i = 0; i <= 4; i++) {

            const gridY =
                top + plotHeight * i / 4;

            const label =
                maximum - maximum * i / 4;

            grid += `

                <line
                    x1="${left}"
                    y1="${gridY}"
                    x2="${width - right}"
                    y2="${gridY}"
                    class="tr-chart-gridline"
                />

                <text
                    x="${left - 10}"
                    y="${gridY + 4}"
                    text-anchor="end"
                    class="tr-chart-axis-text"
                >
                    ${escapeHTML(formatNumber(label))}
                </text>

            `;

        }


        const circles = points.map(point => `

            <circle
                cx="${point.x}"
                cy="${point.y}"
                r="4"
                class="tr-chart-point"
            >
                <title>
                    ${escapeHTML(point.item.label)}:
                    ${escapeHTML(formatNumber(point.item.value))}
                </title>
            </circle>

        `).join("");


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
                    y="${height - 10}"
                    text-anchor="middle"
                    class="tr-chart-axis-text"
                >
                    ${escapeHTML(point.item.label.slice(0, 10))}
                </text>

            `;

        }).join("");


        container.innerHTML = `

            <svg
                class="tr-chart-svg"
                viewBox="0 0 ${width} ${height}"
                role="img"
                aria-label="Risk detection trends"
            >

                <defs>

                    <linearGradient
                        id="tr-risk-gradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >

                        <stop
                            offset="0%"
                            stop-color="#6658d9"
                            stop-opacity=".28"
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
                    d="${area}"
                    fill="url(#tr-risk-gradient)"
                />

                <path
                    d="${path}"
                    class="tr-chart-line"
                />

                ${circles}

                ${labels}

            </svg>

        `;

    }


    /* ========================================================
       14. TABLE UTILITIES
    ======================================================== */

    function emptyTable(id, colspan, message) {

        const body = byId(id);

        if (!body) return;

        body.innerHTML = `

            <tr>
                <td
                    colspan="${colspan}"
                    class="tr-table-empty"
                >
                    ${escapeHTML(message)}
                </td>
            </tr>

        `;

    }


    function statusBadge(status) {

        const normalized = normalizeStatus(status);

        return `

            <span class="tr-status-badge ${getStatusClass(normalized)}">
                ${escapeHTML(normalized.replace(/_/g, " "))}
            </span>

        `;

    }


    function severityBadge(severity) {

        const normalized = normalizeSeverity(severity);

        if (normalized === "unknown") {
            return "—";
        }

        return `

            <span class="tr-severity-badge ${getSeverityClass(normalized)}">
                ${escapeHTML(normalized)}
            </span>

        `;

    }


    /* ========================================================
       15. ALERT TABLES
    ======================================================== */

    function createAlertRow(alert) {

        const id = getAlertId(alert);

        const acknowledged = isAcknowledged(alert);

        const status = acknowledged
            ? "acknowledged"
            : normalizeStatus(alert.status || "unacknowledged");


        return `

            <tr>

                <td>
                    <strong>${escapeHTML(id || "—")}</strong>
                </td>

                <td>
                    ${escapeHTML(
            getValue(alert, "title", "name") ||
            "Security event"
        )}
                </td>

                <td>
                    ${escapeHTML(
            getCategoryLabel(alert.category)
        )}
                </td>

                <td>
                    ${severityBadge(alert.severity)}
                </td>

                <td>
                    ${escapeHTML(
            formatDate(
                getValue(
                    alert,
                    "detectedAt",
                    "createdAt",
                    "timestamp"
                )
            )
        )}
                </td>

                <td>
                    ${statusBadge(status)}
                </td>

                <td>

                    <button
                        class="tr-table-action"
                        data-action="alert-details"
                        data-id="${escapeHTML(id)}"
                    >
                        View
                    </button>

                    ${acknowledged
                ? ""
                : `
                                <button
                                    class="tr-table-action"
                                    data-action="alert-ack"
                                    data-id="${escapeHTML(id)}"
                                >
                                    Acknowledge
                                </button>
                            `
            }

                </td>

            </tr>

        `;

    }


    function renderAlertTables() {

        const alerts = getFilteredAlerts();

        const recentBody = byId("tr-recent-alerts");

        if (recentBody) {

            const recent = alerts.slice(0, 8);

            recentBody.innerHTML = recent.length

                ? recent.map(alert => `

                    <tr>

                        <td>
                            <strong>
                                ${escapeHTML(getAlertId(alert) || "—")}
                            </strong>
                        </td>

                        <td>
                            ${escapeHTML(getCategoryLabel(alert.category))}
                        </td>

                        <td>
                            ${severityBadge(alert.severity)}
                        </td>

                        <td>
                            ${escapeHTML(alert.country || "—")}
                        </td>

                        <td>
                            ${escapeHTML(
                    formatDate(
                        alert.detectedAt ||
                        alert.createdAt
                    )
                )}
                        </td>

                        <td>
                            ${statusBadge(
                    isAcknowledged(alert)
                        ? "acknowledged"
                        : alert.status || "unacknowledged"
                )}
                        </td>

                        <td>
                            <button
                                class="tr-table-action"
                                data-action="alert-details"
                                data-id="${escapeHTML(getAlertId(alert))}"
                            >
                                View
                            </button>
                        </td>

                    </tr>

                `).join("")

                : `
                    <tr>
                        <td colspan="7" class="tr-table-empty">
                            No security alerts available.
                        </td>
                    </tr>
                `;

        }


        const body = byId("tr-alerts-table");

        if (!body) return;

        body.innerHTML = alerts.length

            ? alerts.map(createAlertRow).join("")

            : `

                <tr>
                    <td colspan="7" class="tr-table-empty">
                        No alerts match the selected filters.
                    </td>
                </tr>

            `;

    }


    function renderAlertSummary() {

        const counts = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0
        };

        state.alerts.forEach(alert => {

            const severity = normalizeSeverity(alert.severity);

            if (counts[severity] !== undefined) {
                counts[severity]++;
            }

        });


        setText("tr-alert-critical", formatNumber(counts.critical));

        setText("tr-alert-high", formatNumber(counts.high));

        setText("tr-alert-medium", formatNumber(counts.medium));

        setText("tr-alert-low", formatNumber(counts.low));


        const unacknowledged = state.alerts.filter(
            alert => !isAcknowledged(alert)
        ).length;


        setText(
            "tr-alert-nav-count",
            formatNumber(unacknowledged)
        );

        setText(
            "tr-notification-badge",
            formatNumber(unacknowledged)
        );

    }


    /* ========================================================
       16. INVESTIGATION MANAGEMENT
    ======================================================== */

    function renderInvestigations() {

        const statusFilter =
            byId("tr-investigation-status-filter")?.value || "";


        const rows = state.investigations.filter(item => {

            if (
                statusFilter &&
                normalizeStatus(item.status) !== statusFilter
            ) {
                return false;
            }

            return true;

        });


        setText(
            "tr-invest-open",
            formatNumber(
                state.investigations.filter(item =>
                    ["open", "investigating", "escalated"].includes(
                        normalizeStatus(item.status)
                    )
                ).length
            )
        );


        setText(
            "tr-invest-active",
            formatNumber(
                state.investigations.filter(item =>
                    normalizeStatus(item.status) === "investigating"
                ).length
            )
        );


        setText(
            "tr-invest-escalated",
            formatNumber(
                state.investigations.filter(item =>
                    normalizeStatus(item.status) === "escalated"
                ).length
            )
        );


        setText(
            "tr-invest-resolved",
            formatNumber(
                state.investigations.filter(item =>
                    ["resolved", "closed"].includes(
                        normalizeStatus(item.status)
                    )
                ).length
            )
        );


        const body = byId("tr-investigations-table");

        if (!body) return;


        body.innerHTML = rows.length

            ? rows.map(item => {

                const id = getValue(
                    item,
                    "id",
                    "caseId",
                    "reference"
                ) || "";

                return `

                    <tr>

                        <td>
                            <strong>${escapeHTML(id)}</strong>
                        </td>

                        <td>
                            ${escapeHTML(item.title || "Investigation")}
                        </td>

                        <td>
                            ${escapeHTML(getCategoryLabel(item.category))}
                        </td>

                        <td>
                            ${severityBadge(item.severity)}
                        </td>

                        <td>
                            ${escapeHTML(
                    item.assignedAdmin ||
                    item.assignedTo ||
                    "Unassigned"
                )}
                        </td>

                        <td>
                            ${escapeHTML(
                    formatDate(item.createdAt || item.openedAt)
                )}
                        </td>

                        <td>
                            ${statusBadge(item.status)}
                        </td>

                        <td>

                            <button
                                class="tr-table-action"
                                data-action="investigation-details"
                                data-id="${escapeHTML(id)}"
                            >
                                View
                            </button>

                        </td>

                    </tr>

                `;

            }).join("")

            : `

                <tr>
                    <td colspan="8" class="tr-table-empty">
                        No investigations available.
                    </td>
                </tr>

            `;

    }


    /* ========================================================
       17. FLAGGED ACCOUNT MANAGEMENT
    ======================================================== */

    function renderAccounts() {

        const typeFilter =
            byId("tr-account-type-filter")?.value || "";


        const accounts = state.accounts.filter(account => {

            if (
                typeFilter &&
                normalizeStatus(account.accountType || account.type) !==
                typeFilter
            ) {
                return false;
            }

            return true;

        });


        const body = byId("tr-accounts-table");

        if (!body) return;


        body.innerHTML = accounts.length

            ? accounts.map(account => {

                const id = getValue(
                    account,
                    "id",
                    "accountId",
                    "reference"
                ) || "";

                const riskScore = getValue(
                    account,
                    "riskScore",
                    "score"
                );


                return `

                    <tr>

                        <td>
                            <strong>
                                ${escapeHTML(id || "—")}
                            </strong>
                        </td>

                        <td>
                            ${escapeHTML(
                    account.accountType ||
                    account.type ||
                    "—"
                )}
                        </td>

                        <td>
                            ${escapeHTML(account.country || "—")}
                        </td>

                        <td>
                            ${escapeHTML(
                    riskScore === null
                        ? "—"
                        : formatNumber(riskScore)
                )}
                        </td>

                        <td>
                            ${severityBadge(
                    account.severity ||
                    account.riskLevel
                )}
                        </td>

                        <td>
                            ${escapeHTML(
                    formatDate(
                        account.reportedAt ||
                        account.createdAt
                    )
                )}
                        </td>

                        <td>
                            ${statusBadge(
                    account.accountStatus ||
                    account.status
                )}
                        </td>

                        <td>

                            <button
                                class="tr-table-action danger"
                                data-action="account-intervene"
                                data-id="${escapeHTML(id)}"
                            >
                                Intervene
                            </button>

                        </td>

                    </tr>

                `;

            }).join("")

            : `

                <tr>
                    <td colspan="8" class="tr-table-empty">
                        No flagged accounts available.
                    </td>
                </tr>

            `;

    }


    /* ========================================================
       18. DETECTION HISTORY
    ======================================================== */

    function renderDetections() {

        const body = byId("tr-detection-table");

        if (!body) return;


        body.innerHTML = state.detections.length

            ? state.detections.map(item => `

                <tr>

                    <td>
                        ${escapeHTML(
                getValue(item, "id", "eventId") || "—"
            )}
                    </td>

                    <td>
                        ${escapeHTML(
                item.detectionType ||
                item.type ||
                "—"
            )}
                    </td>

                    <td>
                        ${escapeHTML(getCategoryLabel(item.category))}
                    </td>

                    <td>
                        ${severityBadge(item.severity)}
                    </td>

                    <td>
                        ${escapeHTML(
                formatDate(item.detectedAt || item.createdAt)
            )}
                    </td>

                    <td>
                        ${escapeHTML(item.alertId || "—")}
                    </td>

                </tr>

            `).join("")

            : `

                <tr>
                    <td colspan="6" class="tr-table-empty">
                        No detection events available.
                    </td>
                </tr>

            `;

    }


    /* ========================================================
       19. SECURITY AUDIT HISTORY
    ======================================================== */

    function renderAudit() {

        const body = byId("tr-audit-table");

        if (!body) return;


        body.innerHTML = state.audit.length

            ? state.audit.map(item => `

                <tr>

                    <td>
                        <strong>
                            ${escapeHTML(
                getValue(item, "id", "auditId") || "—"
            )}
                        </strong>
                    </td>

                    <td>
                        ${escapeHTML(
                item.administratorName ||
                item.adminName ||
                item.actor ||
                "—"
            )}
                    </td>

                    <td>
                        ${escapeHTML(
                item.action ||
                item.actionType ||
                "—"
            )}
                    </td>

                    <td>
                        ${escapeHTML(
                item.relatedRecord ||
                item.reference ||
                "—"
            )}
                    </td>

                    <td>
                        ${escapeHTML(
                formatDate(item.timestamp || item.createdAt)
            )}
                    </td>

                    <td>
                        ${escapeHTML(item.outcome || "—")}
                    </td>

                </tr>

            `).join("")

            : `

                <tr>
                    <td colspan="6" class="tr-table-empty">
                        No audit records available.
                    </td>
                </tr>

            `;

    }


    /* ========================================================
       20. RISK CATEGORY COUNTS
    ======================================================== */

    function renderCategories() {

        const supplied =
            state.dashboard.categoryCounts || {};


        Object.entries(CATEGORIES).forEach(([key, config]) => {

            let count;

            if (
                Object.prototype.hasOwnProperty.call(
                    supplied,
                    key
                )
            ) {

                count = supplied[key];

            } else {

                count = state.alerts.filter(
                    alert => alert.category === key
                ).length;

            }


            setText(
                config.countId,
                formatNumber(count)
            );

            setText(
                config.detailId,
                formatNumber(count)
            );

        });

    }


    /* ========================================================
       21. OVERVIEW DASHBOARD
    ======================================================== */

    function renderOverview() {

        const overview =
            state.dashboard.overview ||
            state.dashboard.metrics ||
            {};


        const openCases = state.investigations.filter(item =>

            ["open", "investigating", "escalated"].includes(
                normalizeStatus(item.status)
            )

        ).length;


        const critical = state.alerts.filter(alert =>

            normalizeSeverity(alert.severity) === "critical" &&
            !isAcknowledged(alert)

        ).length;


        const unacknowledged = state.alerts.filter(
            alert => !isAcknowledged(alert)
        ).length;


        const escalated = state.investigations.filter(item =>

            normalizeStatus(item.status) === "escalated"

        ).length;


        const metrics = {

            openCases: getValue(
                overview,
                "openCases",
                "openInvestigations"
            ) ?? openCases,

            critical: getValue(
                overview,
                "criticalRisks",
                "criticalAlerts"
            ) ?? critical,

            unacknowledged: getValue(
                overview,
                "unacknowledgedAlerts"
            ) ?? unacknowledged,

            escalated: getValue(
                overview,
                "escalatedCases"
            ) ?? escalated

        };


        setText(
            "tr-kpi-open-cases",
            formatNumber(metrics.openCases)
        );

        setText(
            "tr-kpi-critical",
            formatNumber(metrics.critical)
        );

        setText(
            "tr-kpi-unacknowledged",
            formatNumber(metrics.unacknowledged)
        );

        setText(
            "tr-kpi-escalated",
            formatNumber(metrics.escalated)
        );


        renderTrendChart(
            state.dashboard.trend ||
            state.dashboard.riskTrend ||
            []
        );


        const severityData =
            state.dashboard.severityDistribution ||
            ["critical", "high", "medium", "low"].map(severity => ({

                label: severity,

                value: state.alerts.filter(alert =>
                    normalizeSeverity(alert.severity) === severity
                ).length

            }));


        renderDonutChart(
            "tr-severity-chart",
            severityData
        );


        renderCategories();

        renderAlertTables();

    }


    /* ========================================================
       22. NOTIFICATION DRAWER
    ======================================================== */

    function renderNotifications() {

        const container = byId("tr-notification-list");

        if (!container) return;


        const notifications = state.notifications.length
            ? state.notifications
            : state.alerts.filter(alert => !isAcknowledged(alert));


        if (!notifications.length) {

            container.innerHTML = `

                <div class="tr-empty-state">

                    <strong>No outstanding notifications</strong>

                    <span>
                        New security alerts will appear here.
                    </span>

                </div>

            `;

            return;

        }


        container.innerHTML = notifications.map(item => {

            const severity = normalizeSeverity(item.severity);

            return `

                <div
                    class="tr-notification-item ${escapeHTML(severity)}"
                    data-action="notification-open"
                    data-id="${escapeHTML(getAlertId(item))}"
                    role="button"
                    tabindex="0"
                >

                    <strong>
                        ${escapeHTML(
                item.title ||
                item.message ||
                "Security notification"
            )}
                    </strong>

                    <p>
                        ${escapeHTML(
                item.description ||
                item.message ||
                getCategoryLabel(item.category)
            )}
                    </p>

                    <time>
                        ${escapeHTML(
                formatDate(
                    item.detectedAt ||
                    item.createdAt ||
                    item.timestamp
                )
            )}
                    </time>

                </div>

            `;

        }).join("");

    }


    function toggleNotificationDrawer(open) {

        const drawer = byId("tr-notification-drawer");

        if (!drawer) return;

        const shouldOpen = open ??
            drawer.hidden;

        drawer.hidden = !shouldOpen;

        if (shouldOpen) {
            renderNotifications();
        }

    }


    /* ========================================================
       23. ALERT POP-UP NOTIFICATIONS
    ======================================================== */

    function populateAlertModal(alert) {

        state.selectedAlert = alert;


        setText(
            "tr-modal-title",
            alert.title ||
            "Suspicious activity detected"
        );


        setText(
            "tr-modal-description",
            alert.description ||
            alert.message ||
            "A security event requires administrator attention."
        );


        setText(
            "tr-modal-alert-id",
            getAlertId(alert)
        );


        setText(
            "tr-modal-category",
            getCategoryLabel(alert.category)
        );


        setText(
            "tr-modal-target",

            getValue(
                alert,
                "accountReference",
                "targetReference",
                "affectedAsset",
                "accountId",
                "transactionId"
            ) || "—"
        );


        setText(
            "tr-modal-country",
            alert.country || "—"
        );


        setText(
            "tr-modal-detected-at",

            formatDate(
                alert.detectedAt ||
                alert.createdAt ||
                alert.timestamp
            )
        );


        setText(
            "tr-modal-reason",
            alert.reason ||
            alert.description ||
            alert.message ||
            "Further investigation is required."
        );


        const badge = byId("tr-modal-severity");

        if (badge) {

            const severity =
                normalizeSeverity(alert.severity);

            badge.textContent =
                severity.toUpperCase();

            badge.className =
                `tr-severity-badge tr-severity-${severity}`;

        }

    }


    function openAlertModal(alert) {

        if (!alert) return;

        populateAlertModal(alert);

        showModal("tr-alert-modal");

        state.popupActive = true;

        announce(
            `${normalizeSeverity(alert.severity)} security alert. Administrator attention required.`
        );

    }


    function closeAlertPopup() {

        hideModal("tr-alert-modal");

        state.popupActive = false;

        state.selectedAlert = null;

        window.setTimeout(
            showNextPriorityAlert,
            300
        );

    }


    function queuePriorityAlerts() {

        const candidates = state.alerts
            .filter(isPriorityAlert)
            .filter(alert => {

                const id = getAlertId(alert);

                return (
                    id &&
                    !state.shownPopupIds.has(id)
                );

            })
            .sort((a, b) => {

                const priority = {
                    critical: 0,
                    high: 1
                };

                const first =
                    priority[normalizeSeverity(a.severity)];

                const second =
                    priority[normalizeSeverity(b.severity)];

                if (first !== second) {
                    return first - second;
                }

                return new Date(
                    b.detectedAt || b.createdAt || 0
                ) - new Date(
                    a.detectedAt || a.createdAt || 0
                );

            });


        candidates.forEach(alert => {

            const id = getAlertId(alert);

            state.shownPopupIds.add(id);

            state.popupQueue.push(alert);

        });


        showNextPriorityAlert();

    }


    function showNextPriorityAlert() {

        if (state.popupActive) return;

        if (state.popupQueue.length === 0) return;

        const next = state.popupQueue.shift();

        if (!next) return;

        if (isAcknowledged(next)) {

            showNextPriorityAlert();

            return;

        }

        openAlertModal(next);

    }


    /* ========================================================
       24. ALERT ACKNOWLEDGEMENT
    ======================================================== */

    async function acknowledgeAlert(alertId) {

        if (!alertId) return;

        if (!API_BASE_URL) {

            notify(
                "Alert acknowledgement requires the authorized server connection. No acknowledgement has been recorded.",
                "warning"
            );

            return;

        }


        const endpoint =
            CONFIG.endpoints.acknowledge.replace(
                "{id}",
                encodeURIComponent(alertId)
            );


        const button = byId("tr-modal-acknowledge");

        if (button) {
            button.disabled = true;
            button.textContent = "Submitting...";
        }


        try {

            await apiRequest(
                endpoint,
                {
                    method: "POST",
                    body: {}
                }
            );


            notify(
                "Alert acknowledgement successfully recorded."
            );


            announce("Security alert acknowledged.");

            closeAlertPopup();

            await loadWorkspace({ silent: true });


        } catch (error) {

            console.error(
                "[TALVORA Alert Acknowledgement]",
                error
            );

            notify(error.message, "error");

        } finally {

            if (button) {
                button.disabled = false;
                button.textContent = "Acknowledge Alert";
            }

        }

    }


    /* ========================================================
       25. INVESTIGATION CREATION
    ======================================================== */

    function openInvestigationModal(alert = null) {

        const form = byId("tr-investigation-form");

        if (form) form.reset();


        if (alert) {

            byId("tr-case-title").value =
                alert.title ||
                "Security investigation";

            byId("tr-case-category").value =
                alert.category || "";

            byId("tr-case-severity").value =
                normalizeSeverity(alert.severity) === "unknown"
                    ? ""
                    : normalizeSeverity(alert.severity);

            byId("tr-case-reference").value =
                getAlertId(alert);

            byId("tr-case-description").value =
                alert.description ||
                alert.reason ||
                alert.message ||
                "";

        }


        showModal("tr-investigation-modal");

    }


    async function createInvestigation(event) {

        event.preventDefault();

        const form = event.currentTarget;

        if (!form.reportValidity()) return;


        if (!API_BASE_URL) {

            notify(
                "Investigation submission requires the configured server connection. No case has been created.",
                "warning"
            );

            return;

        }


        const payload = {

            title:
                byId("tr-case-title").value.trim(),

            category:
                byId("tr-case-category").value,

            severity:
                byId("tr-case-severity").value,

            reference:
                byId("tr-case-reference").value.trim(),

            description:
                byId("tr-case-description").value.trim()

        };


        const button = form.querySelector(
            '[type="submit"]'
        );

        if (button) {
            button.disabled = true;
            button.textContent = "Submitting...";
        }


        try {

            await apiRequest(
                CONFIG.endpoints.createInvestigation,
                {
                    method: "POST",
                    body: payload
                }
            );


            hideModal("tr-investigation-modal");

            notify(
                "Investigation submitted successfully."
            );


            await loadWorkspace({ silent: true });

            activateView("investigations");


        } catch (error) {

            console.error(
                "[TALVORA Investigation]",
                error
            );

            notify(error.message, "error");

        } finally {

            if (button) {
                button.disabled = false;
                button.textContent = "Create Investigation";
            }

        }

    }


    /* ========================================================
       26. ACCOUNT INTERVENTION
    ======================================================== */

    function openInterventionModal(account) {

        if (!account) return;

        state.selectedAccount = account;


        byId("tr-intervention-account-id").value =
            getValue(
                account,
                "id",
                "accountId",
                "reference"
            ) || "";


        byId("tr-intervention-form").reset();


        byId("tr-intervention-account-id").value =
            getValue(
                account,
                "id",
                "accountId",
                "reference"
            ) || "";


        showModal("tr-intervention-modal");

    }


    async function submitIntervention(event) {

        event.preventDefault();

        const form = event.currentTarget;

        if (!form.reportValidity()) return;


        if (!API_BASE_URL) {

            notify(
                "Account intervention requires the authorized server connection. No account change has been made.",
                "warning"
            );

            return;

        }


        const accountId =
            byId("tr-intervention-account-id").value;

        const action =
            byId("tr-intervention-action").value;

        const reason =
            byId("tr-intervention-reason").value.trim();


        if (!accountId || !action || !reason) {

            notify(
                "Complete all intervention details.",
                "warning"
            );

            return;

        }


        const endpoint =
            CONFIG.endpoints.intervention.replace(
                "{id}",
                encodeURIComponent(accountId)
            );


        const button = form.querySelector(
            '[type="submit"]'
        );

        if (button) {
            button.disabled = true;
            button.textContent = "Processing...";
        }


        try {

            await apiRequest(
                endpoint,
                {
                    method: "POST",

                    body: {
                        action,
                        reason
                    }
                }
            );


            hideModal("tr-intervention-modal");

            notify(
                "Account intervention submitted successfully."
            );


            await loadWorkspace({ silent: true });


        } catch (error) {

            console.error(
                "[TALVORA Account Intervention]",
                error
            );

            notify(error.message, "error");

        } finally {

            if (button) {
                button.disabled = false;
                button.textContent = "Confirm Action";
            }

        }

    }


    /* ========================================================
       27. REPORT GENERATION
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

        return `talvora-risk-${type}-${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;

    }


    async function exportReport(type) {

        const allowed = [
            "global",
            "accounts",
            "investigations",
            "alerts",
            "audit"
        ];


        if (!allowed.includes(type)) {

            notify(
                "Invalid report selection.",
                "warning"
            );

            return;

        }


        if (!API_BASE_URL) {

            notify(
                "Report generation requires the configured server reporting service.",
                "warning"
            );

            return;

        }


        const endpoint =
            CONFIG.endpoints.report.replace(
                "{type}",
                encodeURIComponent(type)
            );


        try {

            notify(
                "Generating report..."
            );


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


            const url = URL.createObjectURL(
                result.blob
            );


            const anchor = document.createElement("a");

            anchor.href = url;

            anchor.download = filename;

            document.body.appendChild(anchor);

            anchor.click();

            anchor.remove();


            window.setTimeout(() => {

                URL.revokeObjectURL(url);

            }, 1000);


            notify(
                "Report downloaded successfully."
            );


        } catch (error) {

            console.error(
                "[TALVORA Report Generation]",
                error
            );

            notify(error.message, "error");

        }

    }


    /* ========================================================
       28. ALERT AND INVESTIGATION DETAILS
    ======================================================== */

    function findAlert(id) {

        return state.alerts.find(
            alert => getAlertId(alert) === String(id)
        );

    }


    function findInvestigation(id) {

        return state.investigations.find(item =>

            String(
                getValue(item, "id", "caseId", "reference")
            ) === String(id)

        );

    }


    function findAccount(id) {

        return state.accounts.find(item =>

            String(
                getValue(item, "id", "accountId", "reference")
            ) === String(id)

        );

    }


    function viewAlertDetails(id) {

        const alert = findAlert(id);

        if (!alert) {

            notify(
                "The selected alert could not be found.",
                "warning"
            );

            return;

        }


        state.shownPopupIds.add(getAlertId(alert));

        openAlertModal(alert);

    }


    function investigateAlert(id) {

        const alert = findAlert(id);

        if (!alert) return;

        state.shownPopupIds.add(getAlertId(alert));

        hideModal("tr-alert-modal");

        state.popupActive = false;

        openInvestigationModal(alert);

    }


    function viewInvestigationDetails(id) {

        const item = findInvestigation(id);

        if (!item) return;


        openInvestigationModal();


        byId("tr-case-title").value =
            item.title || "";

        byId("tr-case-category").value =
            item.category || "";

        byId("tr-case-severity").value =
            normalizeSeverity(item.severity) === "unknown"
                ? ""
                : normalizeSeverity(item.severity);

        byId("tr-case-reference").value =
            item.reference || item.id || item.caseId || "";

        byId("tr-case-description").value =
            item.description || "";


        const form = byId("tr-investigation-form");

        const submit = form?.querySelector(
            '[type="submit"]'
        );

        if (submit) {

            submit.disabled = true;

            submit.textContent = "View Only";

        }

    }


    /* ========================================================
       29. CATEGORY NAVIGATION
    ======================================================== */

    function openCategory(category) {

        if (!CATEGORIES[category]) return;

        state.categoryFilter = category;

        activateView("alerts");

        renderAlertTables();

        notify(
            `Viewing ${CATEGORIES[category].label} alerts.`
        );

    }


    /* ========================================================
       30. BACKEND DATA NORMALIZATION
    ======================================================== */

    function applyDashboardData(response) {

        const data = unwrap(response);

        state.dashboard = data;

        state.alerts = getArray(data.alerts);

        state.investigations =
            getArray(data.investigations);

        state.accounts =
            getArray(data.accounts);

        state.detections =
            getArray(data.detections);

        state.audit =
            getArray(data.audit);

        state.notifications =
            getArray(data.notifications);

        state.reportHistory =
            getArray(data.reportHistory);

    }


    /* ========================================================
       31. DATA RETRIEVAL
    ======================================================== */

    async function loadWorkspace({ silent = false } = {}) {

        if (state.loading) return;


        if (!API_BASE_URL) {

            const initial =
                window.TALVORA_RISK_DATA;

            if (initial) {

                applyDashboardData(initial);

                renderAll();

                updateCountryOptions();

                setNotice(
                    "Risk workspace loaded from the supplied TALVORA data source. Live server updates are not connected."
                );

            } else {

                state.dashboard = {};

                state.alerts = [];

                state.investigations = [];

                state.accounts = [];

                state.detections = [];

                state.audit = [];

                state.notifications = [];

                renderAll();

                updateCountryOptions();

                setNotice(
                    "Risk workspace ready. No risk records have been supplied yet."
                );

            }

            return;

        }


        setLoading(true);


        if (!silent) {

            setNotice(
                "Connecting to TALVORA risk intelligence services..."
            );

        }


        const query = getFilterParameters();


        const requests = [

            apiRequest(
                CONFIG.endpoints.dashboard,
                { query }
            ),

            apiRequest(
                CONFIG.endpoints.alerts,
                { query }
            ),

            apiRequest(
                CONFIG.endpoints.investigations,
                { query }
            ),

            apiRequest(
                CONFIG.endpoints.accounts,
                { query }
            ),

            apiRequest(
                CONFIG.endpoints.detections,
                { query }
            ),

            apiRequest(
                CONFIG.endpoints.audit,
                { query }
            )

        ];


        try {

            const results = await Promise.allSettled(
                requests
            );


            const [
                dashboardResult,
                alertsResult,
                investigationsResult,
                accountsResult,
                detectionsResult,
                auditResult
            ] = results;


            const failures = results.filter(
                result => result.status === "rejected"
            );


            if (dashboardResult.status === "fulfilled") {

                applyDashboardData(
                    dashboardResult.value
                );

            }


            if (alertsResult.status === "fulfilled") {

                state.alerts = extractList(
                    alertsResult.value,
                    "alerts"
                );

            }


            if (investigationsResult.status === "fulfilled") {

                state.investigations = extractList(
                    investigationsResult.value,
                    "investigations"
                );

            }


            if (accountsResult.status === "fulfilled") {

                state.accounts = extractList(
                    accountsResult.value,
                    "accounts"
                );

            }


            if (detectionsResult.status === "fulfilled") {

                state.detections = extractList(
                    detectionsResult.value,
                    "detections",
                    "events"
                );

            }


            if (auditResult.status === "fulfilled") {

                state.audit = extractList(
                    auditResult.value,
                    "audit",
                    "records"
                );

            }


            state.lastUpdated =
                new Date().toISOString();


            renderAll();

            updateCountryOptions();


            setText(
                "tr-last-updated",
                `Last updated: ${formatDate(state.lastUpdated)}`
            );


            if (failures.length) {

                setNotice(
                    `${failures.length} risk service request(s) could not be completed. Available information is displayed.`,
                    true
                );

            } else {

                setNotice(
                    `TALVORA risk intelligence services connected. Last updated: ${formatDate(state.lastUpdated)}`
                );

            }


            renderNotifications();

            queuePriorityAlerts();


        } catch (error) {

            console.error(
                "[TALVORA Risk Workspace]",
                error
            );

            setNotice(error.message, true);

            if (!silent) {
                notify(error.message, "error");
            }

        } finally {

            setLoading(false);

        }

    }


    /* ========================================================
       32. RENDER ALL WORKSPACES
    ======================================================== */

    function renderAll() {

        renderOverview();

        renderAlertSummary();

        renderInvestigations();

        renderAccounts();

        renderDetections();

        renderAudit();

        renderCategories();

        renderNotifications();

    }


    /* ========================================================
       33. AUTOMATIC REFRESH
    ======================================================== */

    function startAutomaticRefresh() {

        stopAutomaticRefresh();

        if (
            !API_BASE_URL ||
            !CONFIG.refreshInterval
        ) {
            return;
        }


        state.refreshTimer = window.setInterval(() => {

            if (
                document.visibilityState === "visible" &&
                !state.loading
            ) {

                loadWorkspace({ silent: true });

            }

        }, CONFIG.refreshInterval);

    }


    function stopAutomaticRefresh() {

        if (state.refreshTimer) {

            window.clearInterval(
                state.refreshTimer
            );

            state.refreshTimer = null;

        }

    }


    /* ========================================================
       34. EVENT LISTENERS
    ======================================================== */

    function bindEvents() {


        /* GLOBAL CLICK DELEGATION */

        document.addEventListener("click", async event => {


            // Main navigation

            const nav = event.target.closest(
                ".tr-nav-link[data-view]"
            );

            if (nav) {

                activateView(nav.dataset.view);

                return;

            }


            // Dashboard navigation

            const goView = event.target.closest(
                "[data-go-view]"
            );

            if (goView) {

                activateView(goView.dataset.goView);

                return;

            }


            // Category overview

            const category = event.target.closest(
                "[data-category]"
            );

            if (
                category &&
                category.classList.contains("tr-category-card")
            ) {

                openCategory(
                    category.dataset.category
                );

                return;

            }


            // Detailed category view

            const openCategoryButton = event.target.closest(
                "[data-open-category]"
            );

            if (openCategoryButton) {

                openCategory(
                    openCategoryButton.dataset.openCategory
                );

                return;

            }


            // Alert actions

            const actionButton = event.target.closest(
                "[data-action]"
            );

            if (actionButton) {

                const action = actionButton.dataset.action;

                const id = actionButton.dataset.id;


                if (action === "alert-details") {

                    viewAlertDetails(id);

                    return;

                }


                if (action === "alert-ack") {

                    await acknowledgeAlert(id);

                    return;

                }


                if (action === "alert-investigate") {

                    investigateAlert(id);

                    return;

                }


                if (action === "investigation-details") {

                    viewInvestigationDetails(id);

                    return;

                }


                if (action === "account-intervene") {

                    openInterventionModal(
                        findAccount(id)
                    );

                    return;

                }


                if (action === "notification-open") {

                    const alert = findAlert(id);

                    if (alert) {

                        toggleNotificationDrawer(false);

                        viewAlertDetails(id);

                    }

                    return;

                }

            }


            // Report buttons

            const report = event.target.closest(
                "[data-report]"
            );

            if (report) {

                await exportReport(
                    report.dataset.report
                );

                return;

            }


            // Modal close

            const closeButton = event.target.closest(
                "[data-close-modal]"
            );

            if (closeButton) {

                closeStandardModals();

                return;

            }

        });


        /* SIDEBAR */

        byId("tr-menu-button")?.addEventListener(
            "click",
            openSidebar
        );

        byId("tr-sidebar-close")?.addEventListener(
            "click",
            closeSidebar
        );

        byId("tr-sidebar-overlay")?.addEventListener(
            "click",
            closeSidebar
        );


        /* FILTERS */

        byId("tr-apply-filters")?.addEventListener(
            "click",
            applyFilters
        );

        byId("tr-clear-filters")?.addEventListener(
            "click",
            clearFilters
        );


        byId("tr-alert-status-filter")?.addEventListener(
            "change",
            renderAlertTables
        );

        byId("tr-investigation-status-filter")?.addEventListener(
            "change",
            renderInvestigations
        );

        byId("tr-account-type-filter")?.addEventListener(
            "change",
            renderAccounts
        );


        /* REFRESH */

        byId("tr-refresh")?.addEventListener(
            "click",
            () => loadWorkspace()
        );


        /* NOTIFICATION DRAWER */

        byId("tr-notification-button")?.addEventListener(
            "click",
            () => toggleNotificationDrawer()
        );

        byId("tr-close-notifications")?.addEventListener(
            "click",
            () => toggleNotificationDrawer(false)
        );


        /* INVESTIGATION CREATION */

        byId("tr-create-investigation")?.addEventListener(
            "click",
            () => openInvestigationModal()
        );

        byId("tr-investigation-form")?.addEventListener(
            "submit",
            createInvestigation
        );


        /* ACCOUNT INTERVENTION */

        byId("tr-intervention-form")?.addEventListener(
            "submit",
            submitIntervention
        );


        /* SECURITY ALERT MODAL */

        byId("tr-modal-acknowledge")?.addEventListener(
            "click",
            async () => {

                if (!state.selectedAlert) return;

                await acknowledgeAlert(
                    getAlertId(state.selectedAlert)
                );

            }
        );


        byId("tr-modal-investigate")?.addEventListener(
            "click",
            () => {

                if (!state.selectedAlert) return;

                investigateAlert(
                    getAlertId(state.selectedAlert)
                );

            }
        );


        byId("tr-modal-view-details")?.addEventListener(
            "click",
            () => {

                if (!state.selectedAlert) return;

                state.shownPopupIds.add(
                    getAlertId(state.selectedAlert)
                );

                hideModal("tr-alert-modal");

                state.popupActive = false;

                activateView("alerts");

                renderAlertTables();

                notify(
                    "Alert remains outstanding until acknowledged."
                );

                showNextPriorityAlert();

            }
        );


        /* AUDIT EXPORT */

        byId("tr-export-audit")?.addEventListener(
            "click",
            () => exportReport("audit")
        );


        /* MODAL BACKDROP */

        [
            "tr-investigation-modal",
            "tr-intervention-modal"
        ].forEach(id => {

            byId(id)?.addEventListener(
                "click",
                event => {

                    if (event.target.id === id) {
                        hideModal(id);
                    }

                }
            );

        });


        /* KEYBOARD */

        document.addEventListener(
            "keydown",
            event => {

                if (event.key === "Escape") {

                    closeStandardModals();

                    toggleNotificationDrawer(false);

                    closeSidebar();

                }


                if (
                    (event.key === "Enter" || event.key === " ") &&
                    event.target.matches(
                        ".tr-notification-item[role='button']"
                    )
                ) {

                    event.preventDefault();

                    const id = event.target.dataset.id;

                    if (id) {
                        viewAlertDetails(id);
                    }

                }

            }
        );


        /* TREND PERIOD */

        byId("tr-trend-period")?.addEventListener(
            "change",
            async event => {

                if (!API_BASE_URL) return;

                if (state.loading) return;

                const period = event.target.value;

                await loadDashboardWithPeriod(period);

            }
        );


        /* PAGE VISIBILITY */

        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.visibilityState === "visible" &&
                    API_BASE_URL &&
                    state.lastUpdated &&
                    Date.now() -
                    new Date(state.lastUpdated).getTime() >
                    CONFIG.refreshInterval
                ) {

                    loadWorkspace({ silent: true });

                }

            }
        );

    }


    /* ========================================================
       35. PERIOD-SPECIFIC DASHBOARD REFRESH
    ======================================================== */

    async function loadDashboardWithPeriod(period) {

        if (!API_BASE_URL) return;

        try {

            const response = await apiRequest(
                CONFIG.endpoints.dashboard,

                {
                    query: {
                        ...getFilterParameters(),
                        trend_period: period
                    }
                }
            );


            const data = unwrap(response);

            if (data.trend) {

                state.dashboard.trend = data.trend;

                renderTrendChart(data.trend);

            }

        } catch (error) {

            notify(error.message, "error");

        }

    }


    /* ========================================================
       36. INITIALIZATION
    ======================================================== */

    async function initialize() {

        if (state.initialized) return;

        state.initialized = true;

        bindEvents();

        setNotice(
            "Initializing TALVORA Global Risk & Platform Integrity Centre..."
        );


        await loadWorkspace();


        startAutomaticRefresh();


        console.info(
            "TALVORA Risk & Platform Integrity Centre initialized."
        );

    }


    /* ========================================================
       37. PUBLIC APPLICATION INTERFACE
    ======================================================== */

    window.TALVORARisk = Object.freeze({

        refresh: () => loadWorkspace(),

        navigate: activateView,

        applyFilters,

        clearFilters,

        acknowledgeAlert,

        exportReport,

        openInvestigation: () => openInvestigationModal(),

        getActiveView: () => state.activeView,

        getLastUpdated: () => state.lastUpdated

    });


    /* ========================================================
       38. START
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
