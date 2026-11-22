
/* =========================================================
   TALVORA TECHNOLOGIES
   GSES SYSTEM 001
   SUPER ADMIN FINANCE & REVENUE MANAGEMENT

   FRONTEND APPLICATION

   NO DEMO TRANSACTIONS
   NO FICTIONAL REVENUE
   NO HARDCODED PRICES
   NO CLIENT-SIDE FINANCIAL AUTHORITY

   BACKEND IMPLEMENTATION: FINAL PHASE
========================================================= */

"use strict";

(() => {

    /* =====================================================
       01. CONFIGURATION
    ===================================================== */

    const sharedConfig = window.TALVORA_ADMIN_CONFIG || {};
    const sharedApiBase = String(sharedConfig.apiBaseUrl || "").replace(/\/+$/, "");
    const CONFIG = Object.freeze({

        API: `${sharedApiBase}/api/v1/admin/finance`,

        SESSION: `${sharedApiBase}/api/v1/auth/session`,

        NOTIFICATIONS: `${sharedApiBase}/api/v1/admin/notifications`,

        PAGE_SIZE: 25,

        REQUEST_TIMEOUT: Number(sharedConfig.timeout) || 20000

    });


    /* =====================================================
       02. APPLICATION STATE
    ===================================================== */

    const state = {

        authenticated: false,

        administrator: null,

        csrfToken: null,

        overview: null,

        metrics: {},

        collections: {

            transactions: [],

            invoices: [],

            refunds: [],

            reconciliation: [],

            reports: []

        },

        pages: {

            transactions: 1,

            invoices: 1,

            refunds: 1,

            reconciliation: 1,

            reports: 1

        },

        pagination: {},

        filters: {},

        selectedRefund: null,

        loading: {},

        activeTab: "overview"

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

        const element = document.createElement(tag);


        if (className) {

            element.className = className;

        }


        if (content !== null && content !== undefined) {

            element.textContent = String(content);

        }


        return element;

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


    function normalize(value) {

        return String(value || "unknown")

            .trim()

            .toLowerCase()

            .replace(/[\s-]+/g, "_");

    }


    function pretty(value) {

        if (!value) return "Unknown";


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


    function numericValue(value) {

        if (
            typeof value === "number" &&
            Number.isFinite(value)
        ) {

            return value;

        }


        if (
            typeof value === "string" &&
            value.trim() !== "" &&
            Number.isFinite(Number(value))
        ) {

            return Number(value);

        }


        return null;

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


    function getReference(record) {

        return (

            record?.reference ||

            record?.id ||

            null

        );

    }


    function safePath(reference) {

        if (!reference) {

            throw new Error(
                "A valid financial record reference is required."
            );

        }


        return encodeURIComponent(reference);

    }


    function getItems(result) {

        if (Array.isArray(result?.items)) {

            return result.items;

        }


        if (Array.isArray(result?.data)) {

            return result.data;

        }


        if (Array.isArray(result)) {

            return result;

        }


        return [];

    }


    /* =====================================================
       04. FINANCIAL FORMATTING
    ===================================================== */

    function formatMoney(value, currency) {

        let amount = value;

        let code = currency;


        if (
            value &&
            typeof value === "object"
        ) {

            amount =
                value.amount ?? value.value;

            code =
                value.currency || currency;

        }


        amount = numericValue(amount);


        if (amount === null) {

            return "—";

        }


        if (!code) {

            return `${number(amount)} (currency unavailable)`;

        }


        try {

            return new Intl.NumberFormat(undefined, {

                style: "currency",

                currency: String(code).toUpperCase(),

                maximumFractionDigits: 2

            }).format(amount);

        } catch {

            return `${number(amount)} ${code}`;

        }

    }


    function getAmount(record) {

        return (

            record?.amount ??

            record?.totalAmount ??

            record?.grossAmount ??

            null

        );

    }


    function getCurrency(record) {

        return (

            record?.currency ||

            record?.currencyCode ||

            null

        );

    }


    /* =====================================================
       05. FEEDBACK
    ===================================================== */

    function toast(message, type = "info") {

        const container = byId("toast-container");

        if (!container) return;


        const element = create(

            "div",

            `toast ${type}`,

            message

        );


        element.setAttribute("role", "status");

        container.appendChild(element);


        window.setTimeout(() => {

            element.remove();

        }, 5000);

    }


    function notice(message, type = "info") {

        const element = byId("global-notice");

        if (!element) return;


        element.className = `notice ${type}`;

        element.textContent = message;

        show(element);

    }


    function clearNotice() {

        const element = byId("global-notice");

        if (!element) return;


        element.textContent = "";

        hide(element);

    }


    /* =====================================================
       06. API REQUEST ENGINE
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


        const fetchOptions = {

            method,

            credentials: "same-origin",

            headers,

            signal: controller.signal

        };


        if (options.body !== undefined) {

            headers["Content-Type"] = "application/json";

            fetchOptions.body =
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

                fetchOptions

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
                    "Your Super Admin session has expired."
                );

            }


            if (response.status === 403) {

                throw new Error(
                    "The server denied this financial operation."
                );

            }


            if (!response.ok) {

                throw new Error(

                    result?.message ||

                    result?.error ||

                    `Financial service request failed (${response.status}).`

                );

            }


            return result;

        } catch (error) {

            if (error.name === "AbortError") {

                throw new Error(
                    "The financial service request timed out."
                );

            }


            if (error instanceof TypeError) {

                throw new Error(
                    "Unable to connect to the TALVORA financial service."
                );

            }


            throw error;

        } finally {

            window.clearTimeout(timeout);

        }

    }


    /* =====================================================
       07. SUPER ADMIN AUTHENTICATION
    ===================================================== */

    async function verifySession() {

        try {

            const result = await request(
                CONFIG.SESSION
            );


            if (
                result?.authenticated !== true ||

                normalize(result?.user?.role) !== "super_admin"
            ) {

                throw new Error(
                    "A verified TALVORA Super Admin session is required."
                );

            }


            state.administrator = result.user;

            state.csrfToken =
                result.csrfToken || null;

            state.authenticated = true;


            const name =

                result.user.displayName ||

                result.user.name ||

                "Super Administrator";


            setText(
                "admin-name",
                name
            );


            setText(
                "admin-email",
                result.user.email
            );


            setText(

                "admin-avatar",

                name.split(/\s+/)

                    .filter(Boolean)

                    .slice(0, 2)

                    .map(part => part[0])

                    .join("")

                    .toUpperCase()

            );


            setConnection(
                "online",
                "Administrator session verified"
            );


            return true;

        } catch (error) {

            state.authenticated = false;


            setConnection(
                "offline",
                "Authentication required"
            );


            notice(
                error.message,
                "error"
            );


            return false;

        }

    }


    function authorized() {

        if (!state.authenticated) {

            toast(
                "Verified Super Admin authorization is required.",
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
       08. DATE AND CURRENCY FILTERS
    ===================================================== */

    function getOverviewFilters() {

        return {

            from:
                byId("overview-from")?.value || "",

            to:
                byId("overview-to")?.value || "",

            currency:
                byId("overview-currency")?.value || ""

        };

    }


    function populateSelect(id, items, placeholder) {

        const select = byId(id);

        if (!select) return;


        const previous = select.value;


        select.replaceChildren();


        const defaultOption = create(
            "option",
            "",
            placeholder
        );


        defaultOption.value = "";

        select.appendChild(defaultOption);


        (Array.isArray(items) ? items : [])
            .forEach(item => {

                const value =

                    typeof item === "string"

                        ? item

                        : item.code || item.value;


                if (!value) return;


                const option = create(

                    "option",

                    "",

                    typeof item === "string"

                        ? item

                        : item.name || item.label || value

                );


                option.value = value;

                select.appendChild(option);

            });


        if (
            previous &&
            Array.from(select.options).some(
                option => option.value === previous
            )
        ) {

            select.value = previous;

        }

    }


    function populateCurrencyOptions(currencies) {

        const selects = [

            "overview-currency",

            "transaction-currency",

            "reconciliation-form"

        ];


        populateSelect(

            "overview-currency",

            currencies,

            "All currencies"

        );


        populateSelect(

            "transaction-currency",

            currencies,

            "All currencies"

        );


        const reconciliation =
            $("#reconciliation-form select[name='currency']");


        if (reconciliation) {

            const previous = reconciliation.value;

            reconciliation.replaceChildren();


            const placeholder = create(
                "option",
                "",
                "Select currency"
            );


            placeholder.value = "";

            reconciliation.appendChild(placeholder);


            (Array.isArray(currencies) ? currencies : [])
                .forEach(item => {

                    const code =

                        typeof item === "string"

                            ? item

                            : item.code || item.value;


                    if (!code) return;


                    const option = create(

                        "option",

                        "",

                        typeof item === "string"

                            ? item

                            : item.name || item.label || code

                    );


                    option.value = code;

                    reconciliation.appendChild(option);

                });


            if (
                previous &&
                Array.from(reconciliation.options)
                    .some(option => option.value === previous)
            ) {

                reconciliation.value = previous;

            }

        }

    }


    /* =====================================================
       09. OVERVIEW DATA
    ===================================================== */

    async function loadOverview() {

        if (!authorized()) return;


        const filters = getOverviewFilters();


        const params = new URLSearchParams();


        Object.entries(filters).forEach(
            ([key, value]) => {

                if (value) {

                    params.set(key, value);

                }

            }
        );


        const query = params.toString();


        try {

            const result = await request(

                `${CONFIG.API}/overview${query ? `?${query}` : ""}`

            );


            const overview =
                result?.overview || result;


            state.overview = overview;

            state.metrics =
                overview.metrics || {};


            const currencies =
                overview.availableCurrencies || [];


            populateCurrencyOptions(currencies);


            populateSelect(

                "transaction-type",

                overview.availableTransactionTypes || [],

                "All transaction types"

            );


            renderMetrics(
                state.metrics,
                overview.currency
            );


            renderRevenueTrend(
                overview.revenueTrend || [],
                overview.currency
            );


            renderBreakdown(

                "revenue-source-list",

                overview.revenueBySource || [],

                "No revenue source data is available."

            );


            renderBreakdown(

                "revenue-country-list",

                overview.revenueByCountry || [],

                "No country revenue data is available."

            );


            renderProviders(
                overview.paymentProviders || []
            );


            setText(
                "last-updated",
                dateTime(overview.asOf)
            );


            setConnection(
                "online",
                "Financial overview connected"
            );


            clearNotice();


        } catch (error) {

            setConnection(
                "warning",
                "Financial overview unavailable"
            );


            notice(
                error.message,
                "error"
            );


            renderMetrics({}, null);

            renderRevenueTrend([], null);

            renderBreakdown(
                "revenue-source-list",
                [],
                "Revenue source data is unavailable."
            );

            renderBreakdown(
                "revenue-country-list",
                [],
                "Country revenue data is unavailable."
            );

            renderProviders([]);

            throw error;

        }

    }


    /* =====================================================
       10. FINANCIAL METRICS
    ===================================================== */

    function renderMetrics(metrics, currency) {

        const fields = [

            ["gross-revenue", "grossRevenue"],

            ["net-revenue", "netRevenue"],

            ["pending-settlements", "pendingSettlements"],

            ["refund-total", "refundsTotal"],

            ["platform-fees", "platformFees"]

        ];


        fields.forEach(([id, key]) => {

            setText(

                id,

                formatMoney(metrics[key], currency)

            );

        });


        setText(

            "transaction-count",

            typeof metrics.transactionCount === "number"

                ? number(metrics.transactionCount)

                : "—"

        );

    }


    /* =====================================================
       11. REVENUE TREND CHART
    ===================================================== */

    function renderRevenueTrend(items, currency) {

        const container = byId(
            "revenue-trend-chart"
        );


        if (!container) return;


        container.replaceChildren();


        if (!Array.isArray(items) || !items.length) {

            container.appendChild(

                create(

                    "div",

                    "finance-empty",

                    "No verified revenue trend data is available for this reporting period."

                )

            );

            return;

        }


        const values = items.map(item => ({

            date: item.date || item.period || item.label,

            gross: numericValue(item.grossRevenue),

            net: numericValue(item.netRevenue)

        }));


        const maxValue = Math.max(

            0,

            ...values.flatMap(item => [

                item.gross || 0,

                item.net || 0

            ])

        );


        if (!maxValue) {

            container.appendChild(

                create(
                    "div",
                    "finance-empty",
                    "Revenue trend values are not available."
                )

            );

            return;

        }


        values.forEach(item => {

            const column = create(
                "div",
                "trend-column"
            );


            const label = formatDate(item.date);


            column.title =

                `${label} | Gross: ${formatMoney(item.gross, currency)} | Net: ${formatMoney(item.net, currency)}`;


            const value = create(

                "div",

                "trend-value",

                formatMoney(item.gross, currency)

            );


            const bars = create(
                "div",
                "trend-bars"
            );


            [


                {

                    amount: item.gross || 0,

                    className: "gross"

                },


                {

                    amount: item.net || 0,

                    className: "net"

                }


            ].forEach(series => {

                const track = create(
                    "div",
                    "trend-bar-track"
                );


                const bar = create(

                    "div",

                    `trend-bar ${series.className}`

                );


                const percentage =

                    (series.amount / maxValue) * 100;


                bar.style.height =
                    `${Math.max(0, percentage)}%`;


                bar.title =
                    formatMoney(series.amount, currency);


                track.appendChild(bar);

                bars.appendChild(track);

            });


            const dateLabel = create(

                "div",

                "trend-label",

                label

            );


            column.append(
                value,
                bars,
                dateLabel
            );


            container.appendChild(column);

        });

    }


    /* =====================================================
       12. REVENUE BREAKDOWNS
    ===================================================== */

    function renderBreakdown(id, items, emptyMessage) {

        const container = byId(id);

        if (!container) return;


        container.replaceChildren();


        if (!Array.isArray(items) || !items.length) {

            container.appendChild(

                create(
                    "div",
                    "finance-empty",
                    emptyMessage
                )

            );

            return;

        }


        items.forEach(item => {

            const row = create(
                "div",
                "finance-breakdown-row"
            );


            const info = create(
                "div",
                "finance-breakdown-info"
            );


            const title =

                item.label ||

                item.source ||

                item.country ||

                item.name ||

                "Unclassified";


            info.appendChild(

                create(
                    "strong",
                    "",
                    title
                )

            );


            if (typeof item.transactionCount === "number") {

                info.appendChild(

                    create(

                        "small",

                        "",

                        `${number(item.transactionCount)} transactions`

                    )

                );

            }


            const amount = create(

                "div",

                "finance-breakdown-value",

                formatMoney(
                    item.amount,
                    getCurrency(item)
                )

            );


            row.append(info, amount);

            container.appendChild(row);

        });

    }


    /* =====================================================
       13. PAYMENT PROVIDERS
    ===================================================== */

    function renderProviders(items) {

        const container = byId(
            "payment-provider-list"
        );


        container.replaceChildren();


        if (!Array.isArray(items) || !items.length) {

            container.appendChild(

                create(

                    "div",

                    "finance-empty",

                    "No payment provider status information has been received."

                )

            );

            return;

        }


        items.forEach(provider => {

            const row = create(
                "div",
                "finance-provider-row"
            );


            const info = create(
                "div",
                "finance-provider-name"
            );


            info.appendChild(

                create(

                    "strong",

                    "",

                    provider.name || "Payment provider"

                )

            );


            info.appendChild(

                create(

                    "small",

                    "",

                    `Last checked: ${dateTime(provider.lastCheckedAt)}`

                )

            );


            const status = create(

                "span",

                `finance-status ${normalize(provider.status)}`,

                pretty(provider.status)

            );


            row.append(info, status);

            container.appendChild(row);

        });

    }


    /* =====================================================
       14. COLLECTION LOADER
    ===================================================== */

    const COLLECTION_CONFIG = {

        transactions: {

            endpoint: "transactions",

            table: "transaction-table-body",

            pagination: "transaction-pagination",

            renderer: renderTransactions,

            label: "transactions"

        },


        invoices: {

            endpoint: "invoices",

            table: "invoice-table-body",

            pagination: "invoice-pagination",

            renderer: renderInvoices,

            label: "invoices"

        },


        refunds: {

            endpoint: "refunds",

            table: "refund-table-body",

            pagination: "refund-pagination",

            renderer: renderRefunds,

            label: "refunds"

        },


        reconciliation: {

            endpoint: "reconciliation/runs",

            table: "reconciliation-table-body",

            pagination: "reconciliation-pagination",

            renderer: renderReconciliation,

            label: "reconciliation runs"

        },


        reports: {

            endpoint: "reports",

            table: "report-table-body",

            pagination: null,

            renderer: renderReports,

            label: "financial reports"

        }

    };


    async function loadCollection(key) {

        if (!authorized()) return;


        const config =
            COLLECTION_CONFIG[key];


        if (!config) return;


        if (state.loading[key]) return;


        state.loading[key] = true;


        try {

            const params = new URLSearchParams({

                page: String(state.pages[key]),

                pageSize: String(CONFIG.PAGE_SIZE)

            });


            const filters =
                state.filters[key] || {};


            Object.entries(filters).forEach(
                ([filter, value]) => {

                    if (
                        value !== null &&
                        value !== undefined &&
                        value !== ""
                    ) {

                        params.set(filter, value);

                    }

                }
            );


            const result = await request(

                `${CONFIG.API}/${config.endpoint}?${params.toString()}`

            );


            if (
                !Array.isArray(result?.items) &&
                !Array.isArray(result?.data)
            ) {

                throw new Error(
                    `Unexpected response from the ${config.label} service.`
                );

            }


            const items =
                getItems(result);


            state.collections[key] = items;


            const pagination =
                result.pagination || {};


            state.pagination[key] = {

                page:
                    Number(pagination.page) ||
                    state.pages[key],

                totalPages:
                    Math.max(
                        1,
                        Number(pagination.totalPages) || 1
                    ),

                totalItems:
                    Number(pagination.totalItems) ||
                    0

            };


            config.renderer(items);


            renderCollectionPagination(key);


        } catch (error) {

            state.collections[key] = [];


            config.renderer([]);


            const body = byId(config.table);


            if (body) {

                body.replaceChildren();


                const row = create("tr");


                const cell = create(

                    "td",

                    "empty-cell",

                    error.message

                );


                cell.colSpan =

                    key === "reconciliation"

                        ? 8

                        : key === "reports"

                            ? 7

                            : 7;


                row.appendChild(cell);

                body.appendChild(row);

            }


            toast(
                error.message,
                "error"
            );


        } finally {

            state.loading[key] = false;

        }

    }


    /* =====================================================
       15. PAGINATION
    ===================================================== */

    function renderCollectionPagination(key) {

        const config =
            COLLECTION_CONFIG[key];


        if (!config?.pagination) return;


        const pageInfo =
            state.pagination[key] || {};


        const page =
            pageInfo.page || 1;


        const totalPages =
            pageInfo.totalPages || 1;


        const totalItems =
            pageInfo.totalItems || 0;


        const start =

            totalItems === 0

                ? 0

                : ((page - 1) * CONFIG.PAGE_SIZE) + 1;


        const end = Math.min(

            page * CONFIG.PAGE_SIZE,

            totalItems

        );


        setText(

            config.pagination,

            `Showing ${number(start)}–${number(end)} of ${number(totalItems)} ${config.label}`

        );


        const controls = {

            transactions: [

                "transaction-previous",

                "transaction-next"

            ],

            invoices: [

                "invoice-previous",

                "invoice-next"

            ],

            refunds: [

                "refund-previous",

                "refund-next"

            ],

            reconciliation: [

                "reconciliation-previous",

                "reconciliation-next"

            ]

        };


        const ids = controls[key];

        if (!ids) return;


        const previous = byId(ids[0]);

        const next = byId(ids[1]);


        if (previous) {

            previous.disabled =
                page <= 1 || state.loading[key];

        }


        if (next) {

            next.disabled =

                page >= totalPages ||

                state.loading[key];

        }

    }


    async function changePage(key, direction) {

        const pagination =
            state.pagination[key] || {};


        const current =
            pagination.page || state.pages[key];


        const total =
            pagination.totalPages || 1;


        const nextPage =
            current + direction;


        if (
            nextPage < 1 ||
            nextPage > total
        ) {

            return;

        }


        state.pages[key] = nextPage;

        await loadCollection(key);

    }


    /* =====================================================
       16. TABLE HELPERS
    ===================================================== */

    function createCell(row, value, className = "") {

        const cell = create("td", className);


        cell.textContent =

            value === null ||
                value === undefined ||
                value === ""

                ? "—"
                : String(value);


        row.appendChild(cell);

        return cell;

    }


    function createReferenceCell(row, reference, subtitle) {

        const cell = create("td");


        const primary = create(

            "span",

            "finance-reference",

            reference || "—"

        );


        cell.appendChild(primary);


        if (subtitle) {

            cell.appendChild(

                create(
                    "small",
                    "finance-subtext",
                    subtitle
                )

            );

        }


        row.appendChild(cell);

    }


    function createStatusCell(row, status) {

        const cell = create("td");


        cell.appendChild(

            create(

                "span",

                `finance-status ${normalize(status)}`,

                pretty(status)

            )

        );


        row.appendChild(cell);

    }


    function createAction(label, action, reference) {

        const button = create(

            "button",

            "row-button",

            label

        );


        button.type = "button";

        button.dataset.action = action;

        button.dataset.reference = reference || "";


        return button;

    }


    function showEmptyRow(bodyId, colspan, message) {

        const body = byId(bodyId);

        if (!body) return;


        body.replaceChildren();


        const row = create("tr");


        const cell = create(
            "td",
            "empty-cell",
            message
        );


        cell.colSpan = colspan;

        row.appendChild(cell);

        body.appendChild(row);

    }


    /* =====================================================
       17. TRANSACTIONS
    ===================================================== */

    function renderTransactions(items) {

        const body = byId(
            "transaction-table-body"
        );


        if (!body) return;


        body.replaceChildren();


        if (!items.length) {

            showEmptyRow(

                "transaction-table-body",

                7,

                "No financial transactions match the selected filters."

            );

            return;

        }


        items.forEach(transaction => {

            const row = create("tr");


            createCell(
                row,
                dateTime(transaction.createdAt)
            );


            createReferenceCell(

                row,

                transaction.reference ||

                transaction.id,

                transaction.providerReference

            );


            createCell(

                row,

                transaction.accountName ||

                transaction.customerName ||

                transaction.payerName ||

                transaction.accountReference

            );


            createCell(

                row,

                [

                    transaction.type,

                    transaction.source

                ]

                    .filter(Boolean)

                    .map(pretty)

                    .join(" / ")

            );


            createCell(

                row,

                formatMoney(

                    getAmount(transaction),

                    getCurrency(transaction)

                )

            );


            createStatusCell(
                row,
                transaction.status
            );


            const actions = create("td");


            const reference =
                getReference(transaction);


            actions.appendChild(

                createAction(
                    "View",
                    "transaction-view",
                    reference
                )

            );


            row.appendChild(actions);

            body.appendChild(row);

        });

    }


    /* =====================================================
       18. INVOICES
    ===================================================== */

    function renderInvoices(items) {

        const body = byId(
            "invoice-table-body"
        );


        if (!body) return;


        body.replaceChildren();


        if (!items.length) {

            showEmptyRow(

                "invoice-table-body",

                7,

                "No invoice records match the selected filters."

            );

            return;

        }


        items.forEach(invoice => {

            const row = create("tr");


            createReferenceCell(

                row,

                invoice.reference || invoice.id,

                invoice.number

            );


            createCell(

                row,

                invoice.accountName ||

                invoice.customerName ||

                invoice.accountReference

            );


            createCell(
                row,
                formatDate(invoice.issuedAt)
            );


            createCell(
                row,
                formatDate(invoice.dueAt)
            );


            createCell(

                row,

                formatMoney(

                    getAmount(invoice),

                    getCurrency(invoice)

                )

            );


            createStatusCell(
                row,
                invoice.status
            );


            const actions = create("td");


            actions.appendChild(

                createAction(

                    "View",

                    "invoice-view",

                    getReference(invoice)

                )

            );


            row.appendChild(actions);

            body.appendChild(row);

        });

    }


    /* =====================================================
       19. REFUNDS
    ===================================================== */

    function renderRefunds(items) {

        const body = byId(
            "refund-table-body"
        );


        if (!body) return;


        body.replaceChildren();


        if (!items.length) {

            showEmptyRow(

                "refund-table-body",

                7,

                "No refund records match the selected filters."

            );

            return;

        }


        items.forEach(refund => {

            const row = create("tr");


            createReferenceCell(

                row,

                refund.reference || refund.id

            );


            createReferenceCell(

                row,

                refund.transactionReference

            );


            createCell(
                row,
                dateTime(refund.requestedAt)
            );


            createCell(

                row,

                formatMoney(

                    getAmount(refund),

                    getCurrency(refund)

                )

            );


            createCell(
                row,
                refund.reason
            );


            createStatusCell(
                row,
                refund.status
            );


            const actions = create("td");


            actions.appendChild(

                createAction(

                    "Review",

                    "refund-review",

                    getReference(refund)

                )

            );


            row.appendChild(actions);

            body.appendChild(row);

        });

    }


    /* =====================================================
       20. RECONCILIATION
    ===================================================== */

    function renderReconciliation(items) {

        const body = byId(
            "reconciliation-table-body"
        );


        if (!body) return;


        body.replaceChildren();


        if (!items.length) {

            showEmptyRow(

                "reconciliation-table-body",

                8,

                "No reconciliation runs have been recorded."

            );

            return;

        }


        items.forEach(run => {

            const row = create("tr");


            createReferenceCell(

                row,

                run.reference || run.id

            );


            createCell(

                row,

                `${formatDate(run.periodStart)} – ${formatDate(run.periodEnd)}`

            );


            createCell(
                row,
                run.currency
            );


            createCell(
                row,
                number(run.recordsReviewed)
            );


            createCell(
                row,
                number(run.discrepancyCount)
            );


            createStatusCell(
                row,
                run.status
            );


            createCell(
                row,
                dateTime(run.startedAt)
            );


            const actions = create("td");


            actions.appendChild(

                createAction(

                    "Details",

                    "reconciliation-view",

                    getReference(run)

                )

            );


            row.appendChild(actions);

            body.appendChild(row);

        });

    }


    /* =====================================================
       21. FINANCIAL REPORTS
    ===================================================== */

    function renderReports(items) {

        const body = byId(
            "report-table-body"
        );


        if (!body) return;


        body.replaceChildren();


        if (!items.length) {

            showEmptyRow(

                "report-table-body",

                7,

                "No generated financial reports are available."

            );

            return;

        }


        items.forEach(report => {

            const row = create("tr");


            createReferenceCell(

                row,

                report.reference || report.id

            );


            createCell(
                row,
                pretty(report.type)
            );


            createCell(

                row,

                `${formatDate(report.periodStart)} – ${formatDate(report.periodEnd)}`

            );


            createCell(
                row,
                report.generatedBy
            );


            createCell(
                row,
                dateTime(report.generatedAt)
            );


            createStatusCell(
                row,
                report.status
            );


            const actions = create("td");


            actions.appendChild(

                createAction(

                    "View",

                    "report-view",

                    getReference(report)

                )

            );


            row.appendChild(actions);

            body.appendChild(row);

        });

    }


    /* =====================================================
       22. FILTER INITIALIZATION
    ===================================================== */

    function applyFilters(key, values) {

        state.filters[key] = values;

        state.pages[key] = 1;

        loadCollection(key);

    }


    function initializeFilters() {

        byId("overview-filter-form")
            ?.addEventListener("submit", event => {

                event.preventDefault();


                const from =
                    byId("overview-from").value;


                const to =
                    byId("overview-to").value;


                if (from && to && from > to) {

                    toast(
                        "The reporting start date cannot be after the end date.",
                        "error"
                    );

                    return;

                }


                loadOverview().catch(() => { });

            });


        byId("transaction-filter-form")
            ?.addEventListener("submit", event => {

                event.preventDefault();


                applyFilters("transactions", {

                    search:
                        byId("transaction-search").value.trim(),

                    status:
                        byId("transaction-status").value,

                    type:
                        byId("transaction-type").value,

                    currency:
                        byId("transaction-currency").value

                });

            });


        byId("invoice-filter-form")
            ?.addEventListener("submit", event => {

                event.preventDefault();


                applyFilters("invoices", {

                    search:
                        byId("invoice-search").value.trim(),

                    status:
                        byId("invoice-status").value

                });

            });


        byId("refund-filter-form")
            ?.addEventListener("submit", event => {

                event.preventDefault();


                applyFilters("refunds", {

                    search:
                        byId("refund-search").value.trim(),

                    status:
                        byId("refund-status").value

                });

            });


        const clearFilters = [

            ["clear-transaction-filters", "transaction-filter-form", "transactions"],

            ["clear-invoice-filters", "invoice-filter-form", "invoices"],

            ["clear-refund-filters", "refund-filter-form", "refunds"]

        ];


        clearFilters.forEach(([buttonId, formId, key]) => {

            byId(buttonId)?.addEventListener("click", () => {

                byId(formId).reset();

                applyFilters(key, {});

            });

        });

    }


    /* =====================================================
       23. FINANCIAL RECORD DETAILS
    ===================================================== */

    function addDetail(container, label, value) {

        const wrapper = create("div");


        const title = create(
            "dt",
            "",
            label
        );


        const description = create(
            "dd",
            "",
            value === null ||
                value === undefined ||
                value === ""

                ? "Not available"

                : value
        );


        wrapper.append(title, description);

        container.appendChild(wrapper);

    }


    const DETAIL_FIELDS = {

        transactions: [

            ["Transaction Reference", "reference"],

            ["Provider Reference", "providerReference"],

            ["Account", "accountName"],

            ["Customer", "customerName"],

            ["Transaction Type", "type"],

            ["Revenue Source", "source"],

            ["Amount", "amount"],

            ["Currency", "currency"],

            ["Transaction Status", "status"],

            ["Payment Provider", "provider"],

            ["Payment Method", "paymentMethod"],

            ["Created", "createdAt"],

            ["Completed", "completedAt"],

            ["Description", "description"]

        ],


        invoices: [

            ["Invoice Reference", "reference"],

            ["Invoice Number", "number"],

            ["Account", "accountName"],

            ["Issued", "issuedAt"],

            ["Due Date", "dueAt"],

            ["Amount", "amount"],

            ["Currency", "currency"],

            ["Status", "status"],

            ["Paid Date", "paidAt"],

            ["Description", "description"]

        ],


        "reconciliation/runs": [

            ["Run Reference", "reference"],

            ["Period Start", "periodStart"],

            ["Period End", "periodEnd"],

            ["Currency", "currency"],

            ["Records Reviewed", "recordsReviewed"],

            ["Matched Records", "matchedRecords"],

            ["Discrepancies", "discrepancyCount"],

            ["Status", "status"],

            ["Started", "startedAt"],

            ["Completed", "completedAt"],

            ["Summary", "summary"]

        ],


        reports: [

            ["Report Reference", "reference"],

            ["Report Type", "type"],

            ["Period Start", "periodStart"],

            ["Period End", "periodEnd"],

            ["Generated By", "generatedBy"],

            ["Generated Date", "generatedAt"],

            ["Status", "status"],

            ["Description", "description"]

        ]

    };


    function formatDetailValue(key, value, record) {

        if (value === null || value === undefined) {

            return "Not available";

        }


        if (
            [
                "createdAt",
                "completedAt",
                "issuedAt",
                "dueAt",
                "paidAt",
                "startedAt",
                "completedAt",
                "generatedAt",
                "periodStart",
                "periodEnd"
            ].includes(key)
        ) {

            return dateTime(value);

        }


        if (key === "amount") {

            return formatMoney(
                value,
                record.currency
            );

        }


        if (
            [
                "status",
                "type",
                "source"
            ].includes(key)
        ) {

            return pretty(value);

        }


        return String(value);

    }


    function renderRecordDetails(kind, record) {

        const container = byId(
            "record-details"
        );


        container.replaceChildren();


        const fields =
            DETAIL_FIELDS[kind] || [];


        fields.forEach(([label, key]) => {

            const value =
                record[key];


            if (
                value === null ||
                value === undefined
            ) {

                return;

            }


            addDetail(

                container,

                label,

                formatDetailValue(
                    key,
                    value,
                    record
                )

            );

        });

    }


    function closeDetails() {

        hide(
            byId("finance-details-modal")
        );

    }


    async function openRecord(kind, reference) {

        if (!authorized()) return;


        if (!reference) {

            toast(
                "Financial record reference is unavailable.",
                "error"
            );

            return;

        }


        const path =

            `${CONFIG.API}/${kind}/${safePath(reference)}`;


        try {

            const result = await request(path);


            const record =

                result?.record ||

                result?.transaction ||

                result?.invoice ||

                result?.run ||

                result?.report ||

                result;


            setText(
                "details-title",
                pretty(kind.split("/").pop()) + " Details"
            );


            setText(
                "details-kicker",
                "FINANCIAL RECORD · " + reference
            );


            renderRecordDetails(
                kind,
                record
            );


            show(
                byId("finance-details-modal")
            );


        } catch (error) {

            toast(
                error.message,
                "error"
            );

        }

    }


    /* =====================================================
       24. REFUND REVIEW
    ===================================================== */

    function renderRefundSummary(refund) {

        const container = byId(
            "refund-review-summary"
        );


        container.replaceChildren();


        const fields = [

            ["Refund Reference", refund.reference || refund.id],

            ["Transaction Reference", refund.transactionReference],

            ["Requested Amount", formatMoney(getAmount(refund), getCurrency(refund))],

            ["Current Status", pretty(refund.status)],

            ["Requested Date", dateTime(refund.requestedAt)],

            ["Original Payment", formatMoney(refund.originalAmount, getCurrency(refund))],

            ["Reason", refund.reason]

        ];


        fields.forEach(([label, value]) => {

            const item = create("div");


            item.appendChild(

                create(
                    "small",
                    "",
                    label
                )

            );


            item.appendChild(

                create(
                    "strong",
                    "",
                    value
                )

            );


            container.appendChild(item);

        });

    }


    async function openRefundReview(reference) {

        if (!authorized()) return;


        if (!reference) {

            toast(
                "Refund reference is unavailable.",
                "error"
            );

            return;

        }


        try {

            const result = await request(

                `${CONFIG.API}/refunds/${safePath(reference)}`

            );


            const refund =
                result?.refund || result;


            if (!getReference(refund)) {

                throw new Error(
                    "The refund record could not be verified."
                );

            }


            if (
                normalize(refund.status) !== "pending"
            ) {

                throw new Error(
                    "Only pending refund requests can be reviewed through this workflow."
                );

            }


            state.selectedRefund = refund;


            const form = byId(
                "refund-decision-form"
            );


            form.reset();


            form.elements.reference.value =
                getReference(refund);


            renderRefundSummary(refund);


            show(
                byId("refund-review-modal")
            );


        } catch (error) {

            toast(
                error.message,
                "error"
            );

        }

    }


    function closeRefundReview() {

        hide(
            byId("refund-review-modal")
        );


        state.selectedRefund = null;

    }


    async function submitRefundDecision(event) {

        event.preventDefault();


        if (!authorized()) return;


        const form = event.currentTarget;


        if (!form.reportValidity()) return;


        const reference =
            form.elements.reference.value;


        const decision =
            form.elements.decision.value;


        const reason =
            form.elements.reason.value.trim();


        if (
            !reference ||
            !["approved", "rejected"].includes(decision) ||
            reason.length < 10
        ) {

            toast(
                "A valid refund, decision and detailed reason are required.",
                "error"
            );

            return;

        }


        if (!window.confirm(

            `Confirm this refund decision: ${pretty(decision)}?`

        )) {

            return;

        }


        const button = $(
            'button[type="submit"]',
            form
        );


        try {

            if (button) button.disabled = true;


            const result = await request(

                `${CONFIG.API}/refunds/${safePath(reference)}/decision`,

                {

                    method: "POST",

                    body: {

                        decision,

                        reason

                    }

                }

            );


            toast(

                result?.message ||

                "Refund decision submitted successfully.",

                "success"

            );


            closeRefundReview();


            await loadCollection("refunds");

            await loadOverview().catch(() => { });


        } catch (error) {

            toast(
                error.message,
                "error"
            );

        } finally {

            if (button) button.disabled = false;

        }

    }


    /* =====================================================
       25. RECONCILIATION
    ===================================================== */

    function openReconciliation() {

        if (!authorized()) return;


        const form = byId(
            "reconciliation-form"
        );


        form.reset();


        show(
            byId("reconciliation-modal")
        );

    }


    function closeReconciliation() {

        hide(
            byId("reconciliation-modal")
        );

    }


    async function submitReconciliation(event) {

        event.preventDefault();


        if (!authorized()) return;


        const form = event.currentTarget;


        if (!form.reportValidity()) return;


        const from =
            form.elements.from.value;


        const to =
            form.elements.to.value;


        const currency =
            form.elements.currency.value;


        if (
            !from ||
            !to ||
            !currency ||
            from > to
        ) {

            toast(
                "Select a valid reporting period and currency.",
                "error"
            );

            return;

        }


        if (!window.confirm(

            `Start financial reconciliation for ${from} to ${to} in ${currency}?`

        )) {

            return;

        }


        const button = $(
            'button[type="submit"]',
            form
        );


        try {

            if (button) button.disabled = true;


            const result = await request(

                `${CONFIG.API}/reconciliation/runs`,

                {

                    method: "POST",

                    body: {

                        periodStart: from,

                        periodEnd: to,

                        currency

                    }

                }

            );


            toast(

                result?.message ||

                "Reconciliation request submitted.",

                "success"

            );


            closeReconciliation();


            state.pages.reconciliation = 1;


            await loadCollection("reconciliation");


        } catch (error) {

            toast(
                error.message,
                "error"
            );

        } finally {

            if (button) button.disabled = false;

        }

    }


    /* =====================================================
       26. CSV EXPORT
    ===================================================== */

    function csvSafe(value) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";

        }


        let textValue = String(value);


        /*
         * Prevent spreadsheet formula injection.
         */

        if (/^[\s]*[=+\-@\t\r]/.test(textValue)) {

            textValue = "'" + textValue;

        }


        return `"${textValue.replace(/"/g, '""')}"`;

    }


    function downloadCSV(filename, headers, rows) {

        if (!Array.isArray(rows) || !rows.length) {

            toast(
                "There are no loaded records to export.",
                "warning"
            );

            return;

        }


        const content = [

            headers.map(csvSafe).join(","),

            ...rows.map(row =>

                row.map(csvSafe).join(",")

            )

        ].join("\r\n");


        const blob = new Blob(

            ["\uFEFF" + content],

            { type: "text/csv;charset=utf-8;" }

        );


        const url =
            URL.createObjectURL(blob);


        const link = create("a");


        link.href = url;

        link.download = filename;


        document.body.appendChild(link);

        link.click();

        link.remove();


        window.setTimeout(() => {

            URL.revokeObjectURL(url);

        }, 1000);


        toast(
            "CSV export prepared from the currently loaded records.",
            "success"
        );

    }


    function exportTransactions() {

        const rows = state.collections.transactions.map(item => [

            item.reference,

            item.providerReference,

            item.createdAt,

            item.accountName || item.customerName,

            item.type,

            item.source,

            getAmount(item),

            getCurrency(item),

            item.status,

            item.provider

        ]);


        downloadCSV(

            "talvora-transactions.csv",

            [

                "Reference",

                "Provider Reference",

                "Date",

                "Account",

                "Type",

                "Source",

                "Amount",

                "Currency",

                "Status",

                "Provider"

            ],

            rows

        );

    }


    function exportInvoices() {

        const rows = state.collections.invoices.map(item => [

            item.reference,

            item.number,

            item.accountName,

            item.issuedAt,

            item.dueAt,

            getAmount(item),

            getCurrency(item),

            item.status

        ]);


        downloadCSV(

            "talvora-invoices.csv",

            [

                "Reference",

                "Invoice Number",

                "Account",

                "Issued",

                "Due",

                "Amount",

                "Currency",

                "Status"

            ],

            rows

        );

    }


    function exportRefunds() {

        const rows = state.collections.refunds.map(item => [

            item.reference,

            item.transactionReference,

            item.requestedAt,

            getAmount(item),

            getCurrency(item),

            item.reason,

            item.status

        ]);


        downloadCSV(

            "talvora-refunds.csv",

            [

                "Reference",

                "Transaction Reference",

                "Requested At",

                "Amount",

                "Currency",

                "Reason",

                "Status"

            ],

            rows

        );

    }


    function exportReports() {

        const rows = state.collections.reports.map(item => [

            item.reference,

            item.type,

            item.periodStart,

            item.periodEnd,

            item.generatedBy,

            item.generatedAt,

            item.status

        ]);


        downloadCSV(

            "talvora-financial-reports.csv",

            [

                "Reference",

                "Type",

                "Period Start",

                "Period End",

                "Generated By",

                "Generated At",

                "Status"

            ],

            rows

        );

    }


    function exportOverview() {

        const metrics = state.metrics || {};

        const currency =
            state.overview?.currency;


        const rows = [

            ["Gross Revenue", metrics.grossRevenue],

            ["Net Revenue", metrics.netRevenue],

            ["Pending Settlements", metrics.pendingSettlements],

            ["Refunds", metrics.refundsTotal],

            ["Platform Fees", metrics.platformFees],

            ["Transaction Count", metrics.transactionCount]

        ];


        downloadCSV(

            "talvora-financial-overview.csv",

            ["Financial Metric", "Value"],

            rows.map(([label, value]) => [

                label,

                typeof value === "number"

                    ? value

                    : value?.amount ?? "",

                currency || value?.currency || ""

            ])

        );

    }


    /* =====================================================
       27. FINANCE NAVIGATION
    ===================================================== */

    function openTab(tab) {

        if (!tab) return;


        state.activeTab = tab;


        $$(".finance-tab").forEach(button => {

            const active =
                button.dataset.tab === tab;


            button.classList.toggle(
                "active",
                active
            );


            button.setAttribute(
                "aria-selected",
                String(active)
            );

        });


        $$(".finance-panel").forEach(panel => {

            panel.hidden =
                panel.id !== `panel-${tab}`;

        });


        const loaders = {

            transactions: () =>
                loadCollection("transactions"),

            billing: () =>
                loadCollection("invoices"),

            refunds: () =>
                loadCollection("refunds"),

            reconciliation: () =>
                loadCollection("reconciliation"),

            reports: () =>
                loadCollection("reports")

        };


        if (loaders[tab]) {

            loaders[tab]();

        }

    }


    function initializeTabs() {

        $$(".finance-tab").forEach(button => {

            button.addEventListener("click", () => {

                openTab(
                    button.dataset.tab
                );

            });

        });

    }


    /* =====================================================
       28. ACTION DELEGATION
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


            if (!reference) {

                toast(
                    "Financial record reference is unavailable.",
                    "error"
                );

                return;

            }


            switch (action) {

                case "transaction-view":

                    openRecord(
                        "transactions",
                        reference
                    );

                    break;


                case "invoice-view":

                    openRecord(
                        "invoices",
                        reference
                    );

                    break;


                case "refund-review":

                    openRefundReview(reference);

                    break;


                case "reconciliation-view":

                    openRecord(
                        "reconciliation/runs",
                        reference
                    );

                    break;


                case "report-view":

                    openRecord(
                        "reports",
                        reference
                    );

                    break;


                default:

                    break;

            }

        });

    }


    /* =====================================================
       29. NOTIFICATIONS
    ===================================================== */

    function renderNotifications(items) {

        const container = byId(
            "notification-feed"
        );


        container.replaceChildren();


        if (!items.length) {

            container.appendChild(

                create(
                    "div",
                    "empty-state",
                    "No financial notifications received."
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
                "◇"
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
                    item.message ||
                    "Financial notification"
                )

            );


            details.appendChild(

                create(
                    "p",
                    "",
                    item.description ||
                    item.message ||
                    ""
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


    async function openNotifications() {

        if (!authorized()) return;


        show(
            byId("notification-drawer")
        );


        try {

            const result = await request(

                `${CONFIG.NOTIFICATIONS}?scope=finance`

            );


            renderNotifications(
                getItems(result)
            );


            const unread =
                result?.unreadCount;


            if (
                typeof unread === "number" &&
                unread > 0
            ) {

                setText(
                    "notification-count",
                    number(unread)
                );

                show(
                    byId("notification-count")
                );

            } else {

                hide(
                    byId("notification-count")
                );

            }

        } catch (error) {

            toast(
                error.message,
                "error"
            );

        }

    }


    /* =====================================================
       30. MODALS
    ===================================================== */

    function initializeModals() {

        byId("refund-decision-form")
            ?.addEventListener(
                "submit",
                submitRefundDecision
            );


        byId("reconciliation-form")
            ?.addEventListener(
                "submit",
                submitReconciliation
            );


        byId("run-reconciliation-button")
            ?.addEventListener(
                "click",
                openReconciliation
            );


        $$("[data-close-details]").forEach(button => {

            button.addEventListener(
                "click",
                closeDetails
            );

        });


        $$("[data-close-refund]").forEach(button => {

            button.addEventListener(
                "click",
                closeRefundReview
            );

        });


        $$("[data-close-reconciliation]").forEach(button => {

            button.addEventListener(
                "click",
                closeReconciliation
            );

        });


        const modalPairs = [

            ["finance-details-modal", closeDetails],

            ["refund-review-modal", closeRefundReview],

            ["reconciliation-modal", closeReconciliation]

        ];


        modalPairs.forEach(([id, close]) => {

            byId(id)?.addEventListener("click", event => {

                if (event.target.id === id) {

                    close();

                }

            });

        });

    }


    /* =====================================================
       31. SIDEBAR
    ===================================================== */

    function initializeSidebar() {

        byId("menu-button")
            ?.addEventListener("click", () => {

                byId("sidebar")?.classList.add("open");

                show(
                    byId("sidebar-overlay")
                );

            });


        byId("sidebar-close")
            ?.addEventListener(
                "click",
                closeSidebar
            );


        byId("sidebar-overlay")
            ?.addEventListener(
                "click",
                closeSidebar
            );

    }


    function closeSidebar() {

        byId("sidebar")?.classList.remove("open");

        hide(
            byId("sidebar-overlay")
        );

    }


    /* =====================================================
       32. REFRESH AND EXPORT CONTROLS
    ===================================================== */

    function initializeControls() {

        byId("refresh-button")
            ?.addEventListener("click", () => {

                refreshAll();

            });


        byId("export-overview-button")
            ?.addEventListener(
                "click",
                exportOverview
            );


        byId("export-transactions-button")
            ?.addEventListener(
                "click",
                exportTransactions
            );


        byId("export-invoices-button")
            ?.addEventListener(
                "click",
                exportInvoices
            );


        byId("export-refunds-button")
            ?.addEventListener(
                "click",
                exportRefunds
            );


        byId("export-reports-button")
            ?.addEventListener(
                "click",
                exportReports
            );


        byId("refresh-reports-button")
            ?.addEventListener(
                "click",
                () => loadCollection("reports")
            );


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


        const paginationButtons = [

            ["transaction-previous", "transactions", -1],

            ["transaction-next", "transactions", 1],

            ["invoice-previous", "invoices", -1],

            ["invoice-next", "invoices", 1],

            ["refund-previous", "refunds", -1],

            ["refund-next", "refunds", 1],

            ["reconciliation-previous", "reconciliation", -1],

            ["reconciliation-next", "reconciliation", 1]

        ];


        paginationButtons.forEach(([id, key, direction]) => {

            byId(id)?.addEventListener("click", () => {

                changePage(key, direction);

            });

        });

    }


    /* =====================================================
       33. KEYBOARD ACCESSIBILITY
    ===================================================== */

    function initializeKeyboard() {

        document.addEventListener("keydown", event => {

            if (event.key !== "Escape") return;


            closeDetails();

            closeRefundReview();

            closeReconciliation();

            closeSidebar();

            hide(
                byId("notification-drawer")
            );

        });

    }


    /* =====================================================
       34. SECURITY AND FINANCIAL GOVERNANCE
    ===================================================== */

    function initializeSecurity() {

        /*
         * TALVORA FINANCIAL GOVERNANCE
         *
         * AUTHENTICATION
         *
         * - All privileged financial operations require
         *   a verified Super Admin session.
         * - The established 10-member Super Admin group
         *   uses the central authentication architecture.
         * - Every financial API request must be independently
         *   authorized by the backend.
         *
         * FINANCIAL DATA
         *
         * - Revenue must originate from verified ledger entries.
         * - Transactions must retain their original references.
         * - Gross and net revenue must follow documented
         *   accounting definitions.
         * - Currency information must accompany monetary values.
         * - Historical financial records must not be silently edited.
         *
         * BILLING
         *
         * - Invoices must originate from authorized billing workflows.
         * - Invoice amounts must be traceable to their source records.
         * - Payment status must be synchronized with the
         *   authoritative financial records.
         *
         * REFUNDS
         *
         * - Refund eligibility must be verified server-side.
         * - Approved decisions must be recorded in the audit trail.
         * - Payment-provider confirmation is required before
         *   a refund is considered completed.
         * - Duplicate refund processing must be prevented.
         *
         * RECONCILIATION
         *
         * - Reconciliation must compare authoritative records.
         * - Discrepancies must remain traceable.
         * - Reconciliation must not silently rewrite transactions.
         * - Financial adjustments require a separate controlled
         *   accounting workflow.
         *
         * MULTI-COUNTRY OPERATIONS
         *
         * - Preserve transaction currency and country.
         * - Apply documented conversion rates and timestamps.
         * - Preserve original amounts when reporting converted totals.
         * - Apply appropriate local financial and tax requirements.
         *
         * SECURITY
         *
         * - Never expose payment gateway secret keys in JavaScript.
         * - Never trust client-side monetary values for processing.
         * - Protect customer and account information.
         * - Use server-side idempotency for financial operations.
         * - Require CSRF protection for state-changing requests.
         *
         * AUDIT
         *
         * - Record administrator identity and timestamp.
         * - Record financial target and operation.
         * - Record justification and decision.
         * - Record before-and-after states where appropriate.
         * - Protect audit history from unauthorized alteration.
         *
         */

    }


    /* =====================================================
       35. REFRESH ALL FINANCIAL MODULES
    ===================================================== */

    async function refreshAll() {

        if (!authorized()) return;


        if (state.refreshing) return;


        state.refreshing = true;


        const button = byId("refresh-button");

        if (button) button.disabled = true;


        const tasks = [

            loadOverview(),

            loadCollection("transactions"),

            loadCollection("invoices"),

            loadCollection("refunds"),

            loadCollection("reconciliation"),

            loadCollection("reports")

        ];


        await Promise.allSettled(tasks);


        state.refreshing = false;


        if (button) button.disabled = false;


        toast(
            "Financial information refresh completed.",
            "success"
        );

    }


    /* =====================================================
       36. APPLICATION STARTUP
    ===================================================== */

    async function initialize() {

        initializeSidebar();

        initializeTabs();

        initializeFilters();

        initializeActions();

        initializeModals();

        initializeControls();

        initializeKeyboard();

        initializeSecurity();


        const authenticated =
            await verifySession();


        if (!authenticated) return;


        await refreshAll();


        console.info(
            "TALVORA Finance & Revenue Management initialized."
        );

    }


    /* =====================================================
       37. APPLICATION ENTRY POINT
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
