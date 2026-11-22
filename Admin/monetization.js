
/* =========================================================
   TALVORA TECHNOLOGIES
   GSES SYSTEM 001
   SUPER ADMIN SUBSCRIPTION & MONETIZATION CENTRE

   FRONTEND APPLICATION

   NO DEMO PLANS
   NO FICTIONAL PRICES
   NO INVENTED COMMISSIONS
   NO DEMO CUSTOMERS
   NO FABRICATED REVENUE

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

        API: `${sharedApiBase}/api/v1/admin/monetization`,

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

        activeTab: "overview",

        collections: {

            plans: [],

            pricing: [],

            billing: [],

            fees: [],

            services: [],

            rules: [],

            analytics: [],

            history: []

        },

        pagination: {},

        pages: {

            plans: 1,

            pricing: 1,

            billing: 1,

            fees: 1,

            services: 1,

            rules: 1,

            analytics: 1,

            history: 1

        },

        filters: {},

        loading: {},

        refreshing: false,

        editor: {

            entityType: null,

            reference: null,

            editing: false

        }

    };


    /* =====================================================
       03. COLLECTION DEFINITIONS
    ===================================================== */

    const COLLECTIONS = {

        plans: {

            endpoint: "plans",

            label: "subscription plans",

            table: "plans-table-body",

            pagination: "plans-pagination",

            colspan: 8

        },

        pricing: {

            endpoint: "pricing",

            label: "pricing configurations",

            table: "pricing-table-body",

            pagination: "pricing-pagination",

            colspan: 8

        },

        billing: {

            endpoint: "billing-models",

            label: "billing models",

            table: "billing-table-body",

            pagination: "billing-pagination",

            colspan: 7

        },

        fees: {

            endpoint: "fees",

            label: "fee rules",

            table: "fees-table-body",

            pagination: "fees-pagination",

            colspan: 8

        },

        services: {

            endpoint: "services",

            label: "premium services",

            table: "services-table-body",

            pagination: "services-pagination",

            colspan: 7

        },

        rules: {

            endpoint: "rules",

            label: "revenue rules",

            table: "rules-table-body",

            pagination: "rules-pagination",

            colspan: 8

        },

        analytics: {

            endpoint: "analytics/reports",

            label: "analytics reports",

            table: "analytics-table-body",

            pagination: null,

            colspan: 7

        },

        history: {

            endpoint: "history",

            label: "audit records",

            table: "history-table-body",

            pagination: "history-pagination",

            colspan: 7

        }

    };


    /* =====================================================
       04. CONFIGURATION FORM DEFINITIONS
    ===================================================== */

    const EDITOR_FIELDS = {

        plan: [

            {

                name: "name",

                label: "Plan Name",

                type: "text",

                required: true,

                maxLength: 120

            },

            {

                name: "description",

                label: "Plan Description",

                type: "textarea",

                full: true

            },

            {

                name: "portal",

                label: "Applicable Portal",

                type: "select",

                required: true,

                options: [

                    ["employer", "Employer Portal"],

                    ["employee", "Employee Portal"],

                    ["shared", "Shared Portals"]

                ]

            },

            {

                name: "billingModelReference",

                label: "Billing Model Reference",

                type: "text",

                help: "Optional reference to an existing billing model."

            },

            {

                name: "entitlements",

                label: "Plan Entitlements",

                type: "textarea",

                array: true,

                full: true,

                help: "Enter each approved entitlement on a separate line."

            },

            {

                name: "effectiveFrom",

                label: "Effective From",

                type: "date"

            },

            {

                name: "effectiveTo",

                label: "Effective Until",

                type: "date"

            }

        ],


        price: [

            {

                name: "name",

                label: "Pricing Configuration Name",

                type: "text",

                required: true

            },

            {

                name: "targetType",

                label: "Pricing Target",

                type: "select",

                required: true,

                options: [

                    ["subscription_plan", "Subscription Plan"],

                    ["premium_service", "Premium Service"],

                    ["other", "Other Configurable Offering"]

                ]

            },

            {

                name: "planReference",

                label: "Subscription Plan Reference",

                type: "text",

                help: "Required when pricing a subscription plan."

            },

            {

                name: "serviceReference",

                label: "Premium Service Reference",

                type: "text",

                help: "Required when pricing a premium service."

            },

            {

                name: "countryCode",

                label: "Country Code",

                type: "text",

                maxLength: 2,

                help: "Use the supported two-letter country code."

            },

            {

                name: "currency",

                label: "Currency Code",

                type: "text",

                required: true,

                maxLength: 3,

                help: "Enter the applicable three-letter currency code."

            },

            {

                name: "amount",

                label: "Configured Price",

                type: "number",

                required: true,

                min: 0,

                step: "any"

            },

            {

                name: "billingInterval",

                label: "Billing Interval",

                type: "select",

                required: true,

                options: [

                    ["one_time", "One Time"],

                    ["monthly", "Monthly"],

                    ["quarterly", "Quarterly"],

                    ["annual", "Annual"],

                    ["custom", "Custom"]

                ]

            },

            {

                name: "effectiveFrom",

                label: "Effective From",

                type: "date",

                required: true

            },

            {

                name: "effectiveTo",

                label: "Effective Until",

                type: "date"

            },

            {

                name: "description",

                label: "Pricing Notes",

                type: "textarea",

                full: true

            }

        ],


        billing: [

            {

                name: "name",

                label: "Billing Model Name",

                type: "text",

                required: true

            },

            {

                name: "description",

                label: "Description",

                type: "textarea",

                full: true

            },

            {

                name: "portal",

                label: "Applicable Portal",

                type: "select",

                required: true,

                options: [

                    ["employer", "Employer Portal"],

                    ["shared", "Shared Portals"]

                ]

            },

            {

                name: "structure",

                label: "Billing Structure",

                type: "select",

                required: true,

                options: [

                    ["recurring", "Recurring"],

                    ["one_time", "One-Time"],

                    ["usage_based", "Usage-Based"],

                    ["per_seat", "Per-Seat"],

                    ["contract_based", "Contract-Based"]

                ]

            },

            {

                name: "frequency",

                label: "Billing Frequency",

                type: "select",

                options: [

                    ["one_time", "One Time"],

                    ["weekly", "Weekly"],

                    ["monthly", "Monthly"],

                    ["quarterly", "Quarterly"],

                    ["annually", "Annually"],

                    ["usage_based", "Usage-Based"],

                    ["custom", "Custom"]

                ]

            },

            {

                name: "descriptionNotes",

                label: "Additional Billing Conditions",

                type: "textarea",

                full: true

            },

            {

                name: "effectiveFrom",

                label: "Effective From",

                type: "date"

            },

            {

                name: "effectiveTo",

                label: "Effective Until",

                type: "date"

            }

        ],


        fee: [

            {

                name: "name",

                label: "Fee / Commission Rule Name",

                type: "text",

                required: true

            },

            {

                name: "description",

                label: "Rule Description",

                type: "textarea",

                full: true

            },

            {

                name: "feeType",

                label: "Fee Calculation Type",

                type: "select",

                required: true,

                options: [

                    ["fixed", "Fixed Amount"],

                    ["percentage", "Percentage"],

                    ["tiered", "Tiered"],

                    ["hybrid", "Hybrid"]

                ]

            },

            {

                name: "appliesTo",

                label: "Applicable Transaction Category",

                type: "select",

                required: true,

                options: [

                    ["subscription", "Subscription"],

                    ["transaction", "Transaction"],

                    ["premium_service", "Premium Service"],

                    ["other", "Other"]

                ]

            },

            {

                name: "calculationValue",

                label: "Calculation Value",

                type: "number",

                min: 0,

                step: "any",

                help: "Use only where applicable to the selected calculation type."

            },

            {

                name: "currency",

                label: "Currency Code",

                type: "text",

                maxLength: 3

            },

            {

                name: "countryCode",

                label: "Country Code",

                type: "text",

                maxLength: 2

            },

            {

                name: "portal",

                label: "Applicable Portal",

                type: "select",

                options: [

                    ["employer", "Employer Portal"],

                    ["employee", "Employee Portal"],

                    ["shared", "Shared Portals"]

                ]

            },

            {

                name: "parameters",

                label: "Calculation Parameters",

                type: "textarea",

                json: true,

                full: true,

                help: "Optional structured JSON for tiered or hybrid calculations."

            },

            {

                name: "effectiveFrom",

                label: "Effective From",

                type: "date"

            },

            {

                name: "effectiveTo",

                label: "Effective Until",

                type: "date"

            }

        ],


        service: [

            {

                name: "name",

                label: "Premium Service Name",

                type: "text",

                required: true

            },

            {

                name: "description",

                label: "Service Description",

                type: "textarea",

                full: true

            },

            {

                name: "portal",

                label: "Applicable Portal",

                type: "select",

                required: true,

                options: [

                    ["employer", "Employer Portal"],

                    ["employee", "Employee Portal"],

                    ["shared", "Shared Portals"]

                ]

            },

            {

                name: "pricingReference",

                label: "Pricing Configuration Reference",

                type: "text",

                help: "Reference to the applicable pricing configuration."

            },

            {

                name: "accessModel",

                label: "Service Access Model",

                type: "select",

                required: true,

                options: [

                    ["per_purchase", "Per Purchase"],

                    ["subscription_entitlement", "Subscription Entitlement"],

                    ["usage_based", "Usage-Based"],

                    ["contract_based", "Contract-Based"]

                ]

            },

            {

                name: "entitlementKey",

                label: "Entitlement Reference",

                type: "text"

            },

            {

                name: "effectiveFrom",

                label: "Effective From",

                type: "date"

            },

            {

                name: "effectiveTo",

                label: "Effective Until",

                type: "date"

            }

        ],


        rule: [

            {

                name: "name",

                label: "Revenue Rule Name",

                type: "text",

                required: true

            },

            {

                name: "description",

                label: "Rule Description",

                type: "textarea",

                full: true

            },

            {

                name: "portal",

                label: "Applicable Portal",

                type: "select",

                options: [

                    ["employer", "Employer Portal"],

                    ["employee", "Employee Portal"],

                    ["shared", "Shared Portals"]

                ]

            },

            {

                name: "triggerKey",

                label: "Trigger Identifier",

                type: "text",

                required: true,

                help: "Use the event identifier defined by the central platform."

            },

            {

                name: "targetReference",

                label: "Target Configuration Reference",

                type: "text",

                help: "Reference to the approved plan, pricing or fee configuration."

            },

            {

                name: "conditions",

                label: "Rule Conditions",

                type: "textarea",

                json: true,

                full: true,

                help: "Enter valid JSON conditions understood by the backend policy engine."

            },

            {

                name: "priority",

                label: "Rule Priority",

                type: "number",

                min: 0,

                step: 1

            },

            {

                name: "effectiveFrom",

                label: "Effective From",

                type: "date"

            },

            {

                name: "effectiveTo",

                label: "Effective Until",

                type: "date"

            }

        ]

    };


    /* =====================================================
       05. DOM HELPERS
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

            .replace(/\b\w/g, letter =>
                letter.toUpperCase()
            );

    }


    function getReference(record) {

        return (

            record?.reference ||

            record?.id ||

            null

        );

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


    function safePath(value) {

        if (!value) {

            throw new Error(
                "A valid configuration reference is required."
            );

        }


        return encodeURIComponent(value);

    }


    function isFiniteNumber(value) {

        return (

            typeof value === "number" &&

            Number.isFinite(value)

        );

    }


    /* =====================================================
       06. FORMATTING
    ===================================================== */

    function formatNumber(value) {

        if (!isFiniteNumber(value)) {

            return "—";

        }


        return new Intl.NumberFormat().format(value);

    }


    function numericValue(value) {

        if (isFiniteNumber(value)) {

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

            return `${formatNumber(amount)} (currency unavailable)`;

        }


        try {

            return new Intl.NumberFormat(undefined, {

                style: "currency",

                currency: String(code).toUpperCase(),

                maximumFractionDigits: 2

            }).format(amount);

        } catch {

            return `${formatNumber(amount)} ${code}`;

        }

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


    function formatPeriod(record) {

        const start = formatDate(
            record.periodStart
        );


        const end = formatDate(
            record.periodEnd
        );


        if (start === "—" && end === "—") {

            return "—";

        }


        return `${start} – ${end}`;

    }


    function formatMetric(value, currency) {

        if (value === null || value === undefined) {

            return "—";

        }


        if (
            typeof value === "object" &&
            value !== null
        ) {

            if (
                value.amount !== undefined ||
                value.value !== undefined
            ) {

                return formatMoney(value, currency);

            }

        }


        if (isFiniteNumber(value)) {

            return formatNumber(value);

        }


        return String(value);

    }


    function getPortal(record) {

        return pretty(
            record.portal || record.audience
        );

    }


    /* =====================================================
       07. FEEDBACK
    ===================================================== */

    function toast(message, type = "info") {

        const container = byId(
            "toast-container"
        );


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

        const element = byId(
            "global-notice"
        );


        if (!element) return;


        element.className = `notice ${type}`;

        element.textContent = message;

        show(element);

    }


    function clearNotice() {

        const element = byId(
            "global-notice"
        );


        if (!element) return;


        element.textContent = "";

        hide(element);

    }


    function setConnection(status, message) {

        const dot = byId(
            "connection-dot"
        );


        if (dot) {

            dot.className = `status-dot ${status}`;

        }


        setText(
            "connection-label",
            message
        );

    }


    /* =====================================================
       08. API REQUEST ENGINE
    ===================================================== */

    async function request(path, options = {}) {

        const controller = new AbortController();


        const timeout = window.setTimeout(() => {

            controller.abort();

        }, CONFIG.REQUEST_TIMEOUT);


        const method =
            options.method || "GET";


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

            headers["Content-Type"] =
                "application/json";

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
                    "The server denied this monetization operation."
                );

            }


            if (!response.ok) {

                throw new Error(

                    result?.message ||

                    result?.error ||

                    `Monetization service request failed (${response.status}).`

                );

            }


            return result;

        } catch (error) {

            if (error.name === "AbortError") {

                throw new Error(
                    "The monetization service request timed out."
                );

            }


            if (error instanceof TypeError) {

                throw new Error(
                    "Unable to connect to the TALVORA monetization service."
                );

            }


            throw error;

        } finally {

            window.clearTimeout(timeout);

        }

    }


    /* =====================================================
       09. SESSION VERIFICATION
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


    /* =====================================================
       10. DYNAMIC SELECT OPTIONS
    ===================================================== */

    function populateSelect(id, items, placeholder) {

        const select = byId(id);

        if (!select) return;


        const previous = select.value;


        select.replaceChildren();


        const first = create(
            "option",
            "",
            placeholder
        );


        first.value = "";

        select.appendChild(first);


        (Array.isArray(items) ? items : [])
            .forEach(item => {

                const value =

                    typeof item === "string"

                        ? item

                        : item.code || item.value;


                if (!value) return;


                const label =

                    typeof item === "string"

                        ? item

                        : item.name || item.label || value;


                const option = create(
                    "option",
                    "",
                    label
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


    function populateMarketFilters(overview) {

        const countries =
            overview.availableCountries || [];


        const currencies =
            overview.availableCurrencies || [];


        populateSelect(

            "overview-country",

            countries,

            "All countries"

        );


        populateSelect(

            "overview-currency",

            currencies,

            "All currencies"

        );


        populateSelect(

            "pricing-country",

            countries,

            "All countries"

        );


        populateSelect(

            "pricing-currency",

            currencies,

            "All currencies"

        );

    }


    /* =====================================================
       11. OVERVIEW FILTERS
    ===================================================== */

    function overviewFilters() {

        return {

            from:
                byId("overview-from")?.value || "",

            to:
                byId("overview-to")?.value || "",

            country:
                byId("overview-country")?.value || "",

            currency:
                byId("overview-currency")?.value || ""

        };

    }


    function queryString(values) {

        const params = new URLSearchParams();


        Object.entries(values || {}).forEach(
            ([key, value]) => {

                if (
                    value !== null &&
                    value !== undefined &&
                    value !== ""
                ) {

                    params.set(key, value);

                }

            }
        );


        return params.toString();

    }


    /* =====================================================
       12. OVERVIEW LOADER
    ===================================================== */

    async function loadOverview() {

        if (!authorized()) return;


        const query = queryString(
            overviewFilters()
        );


        try {

            const result = await request(

                `${CONFIG.API}/overview${query ? `?${query}` : ""}`

            );


            const overview =
                result?.overview || result;


            state.overview = overview;

            state.metrics =
                overview.metrics || {};


            populateMarketFilters(overview);


            renderMetrics(
                state.metrics,
                overview.currency
            );


            renderRevenueChart(

                overview.revenueTrend || [],

                overview.currency

            );


            renderBreakdown(

                "monetization-model-breakdown",

                overview.revenueByModel || [],

                "No monetization model revenue data is available."

            );


            renderBreakdown(

                "subscription-adoption",

                overview.subscriptionAdoption || [],

                "No subscription adoption data is available."

            );


            renderBreakdown(

                "portal-monetization",

                overview.portalPerformance || [],

                "No portal monetization data is available."

            );


            setConnection(
                "online",
                "Monetization service connected"
            );


            clearNotice();


        } catch (error) {

            setConnection(
                "warning",
                "Monetization service unavailable"
            );


            renderMetrics({}, null);


            renderRevenueChart([], null);


            [

                "monetization-model-breakdown",

                "subscription-adoption",

                "portal-monetization"

            ].forEach(id => {

                renderBreakdown(

                    id,

                    [],

                    "Data is currently unavailable."

                );

            });


            notice(
                error.message,
                "error"
            );


            throw error;

        }

    }


    /* =====================================================
       13. OVERVIEW METRICS
    ===================================================== */

    function renderMetrics(metrics, currency) {

        setText(

            "active-plan-count",

            formatMetric(
                metrics.activePlanCount,
                currency
            )

        );


        setText(

            "active-subscription-count",

            formatMetric(
                metrics.activeSubscriptionCount,
                currency
            )

        );


        setText(

            "recurring-revenue",

            formatMoney(
                metrics.recurringRevenue,
                currency
            )

        );


        setText(

            "monetization-revenue",

            formatMoney(
                metrics.monetizationRevenue,
                currency
            )

        );


        setText(

            "paid-service-adoption",

            formatMetric(
                metrics.paidServiceAdoption,
                currency
            )

        );


        setText(

            "active-rule-count",

            formatMetric(
                metrics.activeRuleCount,
                currency
            )

        );

    }


    /* =====================================================
       14. REVENUE CHART
    ===================================================== */

    function renderRevenueChart(items, currency) {

        const container = byId(
            "monetization-chart"
        );


        if (!container) return;


        container.replaceChildren();


        if (!Array.isArray(items) || !items.length) {

            container.appendChild(

                create(

                    "div",

                    "finance-empty",

                    "No verified monetization performance data is available."

                )

            );

            return;

        }


        const values = items.map(item => ({

            label:
                item.period || item.date || item.label,

            recurring:
                numericValue(item.recurringRevenue) ?? 0,

            other:
                numericValue(item.otherRevenue) ?? 0

        }));


        const maxValue = Math.max(

            0,

            ...values.flatMap(item => [

                item.recurring,

                item.other

            ])

        );


        if (!maxValue) {

            container.appendChild(

                create(

                    "div",

                    "finance-empty",

                    "No revenue values are available for the selected period."

                )

            );

            return;

        }


        values.forEach(item => {

            const column = create(

                "div",

                "monetization-chart-column"

            );


            const label =
                formatDate(item.label);


            column.title =

                `${label} | Recurring: ${formatMoney(item.recurring, currency)} | Other: ${formatMoney(item.other, currency)}`;


            const value = create(

                "div",

                "monetization-chart-value",

                formatMoney(
                    item.recurring + item.other,
                    currency
                )

            );


            const bars = create(

                "div",

                "monetization-chart-bars"

            );


            [

                {

                    amount: item.recurring,

                    className: "recurring"

                },

                {

                    amount: item.other,

                    className: "other"

                }

            ].forEach(series => {

                const track = create(

                    "div",

                    "monetization-chart-track"

                );


                const bar = create(

                    "div",

                    `monetization-chart-bar ${series.className}`

                );


                bar.style.height =

                    `${(series.amount / maxValue) * 100}%`;


                bar.title =
                    formatMoney(series.amount, currency);


                track.appendChild(bar);

                bars.appendChild(track);

            });


            const dateLabel = create(

                "div",

                "monetization-chart-label",

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
       15. OVERVIEW BREAKDOWN
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

                "monetization-breakdown-row"

            );


            const info = create(

                "div",

                "monetization-breakdown-info"

            );


            const label =

                item.label ||

                item.name ||

                item.model ||

                item.planName ||

                item.portal ||

                "Unclassified";


            info.appendChild(

                create(
                    "strong",
                    "",
                    pretty(label)
                )

            );


            const secondary =

                item.subscriptionCount !== undefined

                    ? `${formatNumber(item.subscriptionCount)} subscriptions`

                    : item.accountCount !== undefined

                        ? `${formatNumber(item.accountCount)} accounts`

                        : item.transactionCount !== undefined

                            ? `${formatNumber(item.transactionCount)} transactions`

                            : "";


            if (secondary) {

                info.appendChild(

                    create(
                        "small",
                        "",
                        secondary
                    )

                );

            }


            let value = "—";


            if (item.amount !== undefined) {

                value = formatMoney(
                    item.amount,
                    item.currency
                );

            } else if (item.count !== undefined) {

                value = formatNumber(item.count);

            } else if (item.subscriptionCount !== undefined) {

                value = formatNumber(item.subscriptionCount);

            }


            const amount = create(

                "div",

                "monetization-breakdown-value",

                value

            );


            row.append(info, amount);

            container.appendChild(row);

        });

    }


    /* =====================================================
       16. GENERIC COLLECTION LOADER
    ===================================================== */

    async function loadCollection(key) {

        if (!authorized()) return;


        const config =
            COLLECTIONS[key];


        if (!config) return;


        if (state.loading[key]) return;


        state.loading[key] = true;


        try {

            const filters =
                state.filters[key] || {};


            const params = {

                page:
                    state.pages[key] || 1,

                pageSize:
                    CONFIG.PAGE_SIZE,

                ...filters

            };


            const query = queryString(params);


            const result = await request(

                `${CONFIG.API}/${config.endpoint}?${query}`

            );


            if (

                !Array.isArray(result?.items) &&

                !Array.isArray(result?.data)

            ) {

                throw new Error(

                    `Unexpected response from the ${config.label} service.`

                );

            }


            const items = getItems(result);


            state.collections[key] = items;


            const pagination =
                result.pagination || {};


            state.pagination[key] = {

                page:
                    Number(pagination.page) ||
                    state.pages[key] ||
                    1,

                totalPages:
                    Math.max(
                        1,
                        Number(pagination.totalPages) || 1
                    ),

                totalItems:
                    Number(pagination.totalItems) ||
                    0

            };


            renderCollection(key, items);

            renderPagination(key);


        } catch (error) {

            state.collections[key] = [];


            showEmptyRow(

                config.table,

                config.colspan,

                error.message

            );


            renderPagination(key);


            toast(
                error.message,
                "error"
            );

        } finally {

            state.loading[key] = false;

        }

    }


    /* =====================================================
       17. TABLE HELPERS
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


        cell.appendChild(

            create(

                "span",

                "monetization-reference",

                reference || "—"

            )

        );


        if (subtitle) {

            cell.appendChild(

                create(

                    "small",

                    "monetization-subtext",

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

                `monetization-status ${normalize(status)}`,

                pretty(status)

            )

        );


        row.appendChild(cell);

    }


    function actionButton(label, action, type, reference, danger = false) {

        const button = create(

            "button",

            `row-button${danger ? " danger" : ""}`,

            label

        );


        button.type = "button";

        button.dataset.action = action;

        button.dataset.type = type;

        button.dataset.reference = reference || "";


        return button;

    }


    function showEmptyRow(tableId, colspan, message) {

        const body = byId(tableId);

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


    function addRecordActions(row, type, record) {

        const cell = create("td");


        const reference =
            getReference(record);


        cell.appendChild(

            actionButton(

                "View",

                "view",

                type,

                reference

            )

        );


        if (
            [
                "plans",
                "pricing",
                "billing",
                "fees",
                "services",
                "rules"
            ].includes(type)
        ) {

            cell.appendChild(

                actionButton(

                    "Edit",

                    "edit",

                    type,

                    reference

                )

            );


            const status =
                normalize(record.status);


            if (
                status === "draft" ||
                status === "scheduled"
            ) {

                cell.appendChild(

                    actionButton(

                        "Publish",

                        "publish",

                        type,

                        reference

                    )

                );

            }


            if (
                status === "active" ||
                status === "published"
            ) {

                cell.appendChild(

                    actionButton(

                        "Suspend",

                        "suspend",

                        type,

                        reference,

                        true

                    )

                );

            }


            if (status === "suspended") {

                cell.appendChild(

                    actionButton(

                        "Reactivate",

                        "activate",

                        type,

                        reference

                    )

                );

            }


            if (
                [
                    "active",
                    "published",
                    "suspended"
                ].includes(status)
            ) {

                cell.appendChild(

                    actionButton(

                        "Retire",

                        "retire",

                        type,

                        reference,

                        true

                    )

                );

            }

        }


        row.appendChild(cell);

    }


    /* =====================================================
       18. SUBSCRIPTION PLANS TABLE
    ===================================================== */

    function renderPlans(items) {

        const body = byId(
            "plans-table-body"
        );


        body.replaceChildren();


        if (!items.length) {

            showEmptyRow(

                "plans-table-body",

                8,

                "No subscription plans are currently available."

            );

            return;

        }


        items.forEach(plan => {

            const row = create("tr");


            createCell(
                row,
                plan.name
            );


            createReferenceCell(

                row,

                plan.reference || plan.id

            );


            createCell(
                row,
                getPortal(plan)
            );


            createCell(

                row,

                plan.billingModelName ||

                plan.billingModelReference

            );


            const entitlements =
                Array.isArray(plan.entitlements)

                    ? plan.entitlements.length

                    : 0;


            createCell(

                row,

                plan.entitlementsCount ??

                entitlements

            );


            createStatusCell(
                row,
                plan.status
            );


            createCell(

                row,

                formatDate(plan.effectiveFrom)

            );


            addRecordActions(
                row,
                "plans",
                plan
            );


            body.appendChild(row);

        });

    }


    /* =====================================================
       19. PRICING TABLE
    ===================================================== */

    function renderPricing(items) {

        const body = byId(
            "pricing-table-body"
        );


        body.replaceChildren();


        if (!items.length) {

            showEmptyRow(

                "pricing-table-body",

                8,

                "No pricing configurations are available."

            );

            return;

        }


        items.forEach(price => {

            const row = create("tr");


            createReferenceCell(

                row,

                price.reference || price.id

            );


            createCell(

                row,

                price.targetName ||

                price.planName ||

                price.serviceName ||

                price.name

            );


            createCell(
                row,
                price.countryName || price.countryCode
            );


            createCell(
                row,
                price.currency
            );


            createCell(

                row,

                formatMoney(
                    price.amount,
                    price.currency
                )

            );


            createCell(

                row,

                pretty(price.billingInterval)

            );


            createStatusCell(
                row,
                price.status
            );


            addRecordActions(
                row,
                "pricing",
                price
            );


            body.appendChild(row);

        });

    }


    /* =====================================================
       20. BILLING MODELS TABLE
    ===================================================== */

    function renderBilling(items) {

        const body = byId(
            "billing-table-body"
        );


        body.replaceChildren();


        if (!items.length) {

            showEmptyRow(

                "billing-table-body",

                7,

                "No billing models are available."

            );

            return;

        }


        items.forEach(model => {

            const row = create("tr");


            createCell(
                row,
                model.name
            );


            createReferenceCell(

                row,

                model.reference || model.id

            );


            createCell(

                row,

                pretty(model.structure)

            );


            createCell(

                row,

                pretty(model.frequency)

            );


            createCell(
                row,
                getPortal(model)
            );


            createStatusCell(
                row,
                model.status
            );


            addRecordActions(
                row,
                "billing",
                model
            );


            body.appendChild(row);

        });

    }


    /* =====================================================
       21. FEES & COMMISSIONS TABLE
    ===================================================== */

    function renderFees(items) {

        const body = byId(
            "fees-table-body"
        );


        body.replaceChildren();


        if (!items.length) {

            showEmptyRow(

                "fees-table-body",

                8,

                "No platform fee or commission rules are available."

            );

            return;

        }


        items.forEach(fee => {

            const row = create("tr");


            createCell(
                row,
                fee.name
            );


            createCell(
                row,
                pretty(fee.feeType)
            );


            createCell(
                row,
                pretty(fee.appliesTo)
            );


            const calculation =

                fee.calculationValue !== undefined

                    ? `${fee.calculationValue}${normalize(fee.feeType) === "percentage" ? "%" : ""} ${fee.currency || ""}`.trim()

                    : fee.calculationSummary || "Configured parameters";


            createCell(
                row,
                calculation
            );


            createCell(
                row,
                fee.countryName || fee.countryCode
            );


            createStatusCell(
                row,
                fee.status
            );


            createCell(

                row,

                formatDate(fee.effectiveFrom)

            );


            addRecordActions(
                row,
                "fees",
                fee
            );


            body.appendChild(row);

        });

    }


    /* =====================================================
       22. PREMIUM SERVICES TABLE
    ===================================================== */

    function renderServices(items) {

        const body = byId(
            "services-table-body"
        );


        body.replaceChildren();


        if (!items.length) {

            showEmptyRow(

                "services-table-body",

                7,

                "No premium services are available."

            );

            return;

        }


        items.forEach(service => {

            const row = create("tr");


            createCell(
                row,
                service.name
            );


            createReferenceCell(

                row,

                service.reference || service.id

            );


            createCell(
                row,
                getPortal(service)
            );


            createCell(
                row,
                service.pricingReference
            );


            createCell(

                row,

                pretty(service.accessModel)

            );


            createStatusCell(
                row,
                service.status
            );


            addRecordActions(
                row,
                "services",
                service
            );


            body.appendChild(row);

        });

    }


    /* =====================================================
       23. REVENUE RULES TABLE
    ===================================================== */

    function renderRules(items) {

        const body = byId(
            "rules-table-body"
        );


        body.replaceChildren();


        if (!items.length) {

            showEmptyRow(

                "rules-table-body",

                8,

                "No revenue rules are available."

            );

            return;

        }


        items.forEach(rule => {

            const row = create("tr");


            createCell(
                row,
                rule.name
            );


            createReferenceCell(

                row,

                rule.reference || rule.id

            );


            createCell(
                row,
                rule.triggerKey
            );


            createCell(
                row,
                getPortal(rule)
            );


            createCell(
                row,
                rule.priority
            );


            createStatusCell(
                row,
                rule.status
            );


            createCell(

                row,

                formatDate(rule.effectiveFrom)

            );


            addRecordActions(
                row,
                "rules",
                rule
            );


            body.appendChild(row);

        });

    }


    /* =====================================================
       24. ANALYTICS REPORTS TABLE
    ===================================================== */

    function renderAnalytics(items) {

        const body = byId(
            "analytics-table-body"
        );


        body.replaceChildren();


        if (!items.length) {

            showEmptyRow(

                "analytics-table-body",

                7,

                "No monetization analytics reports are available."

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
                formatPeriod(report)
            );


            createCell(
                row,
                report.generatedBy
            );


            createCell(
                row,
                formatDateTime(report.generatedAt)
            );


            createStatusCell(
                row,
                report.status
            );


            const cell = create("td");


            cell.appendChild(

                actionButton(

                    "View",

                    "view",

                    "analytics",

                    getReference(report)

                )

            );


            row.appendChild(cell);

            body.appendChild(row);

        });

    }


    /* =====================================================
       25. CHANGE HISTORY TABLE
    ===================================================== */

    function renderHistory(items) {

        const body = byId(
            "history-table-body"
        );


        body.replaceChildren();


        if (!items.length) {

            showEmptyRow(

                "history-table-body",

                7,

                "No monetization audit records are available."

            );

            return;

        }


        items.forEach(record => {

            const row = create("tr");


            createCell(

                row,

                formatDateTime(
                    record.createdAt || record.timestamp
                )

            );


            createCell(

                row,

                record.administratorName ||

                record.actorName ||

                record.administratorEmail

            );


            createCell(
                row,
                pretty(record.action)
            );


            createCell(
                row,
                pretty(record.entityType)
            );


            createReferenceCell(

                row,

                record.entityReference ||

                record.reference

            );


            createCell(
                row,
                record.reason
            );


            const cell = create("td");


            cell.appendChild(

                actionButton(

                    "View",

                    "view",

                    "history",

                    getReference(record)

                )

            );


            row.appendChild(cell);

            body.appendChild(row);

        });

    }


    /* =====================================================
       26. COLLECTION RENDER ROUTER
    ===================================================== */

    function renderCollection(key, items) {

        switch (key) {

            case "plans":

                renderPlans(items);

                break;


            case "pricing":

                renderPricing(items);

                break;


            case "billing":

                renderBilling(items);

                break;


            case "fees":

                renderFees(items);

                break;


            case "services":

                renderServices(items);

                break;


            case "rules":

                renderRules(items);

                break;


            case "analytics":

                renderAnalytics(items);

                break;


            case "history":

                renderHistory(items);

                break;


            default:

                break;

        }

    }


    /* =====================================================
       27. PAGINATION
    ===================================================== */

    function renderPagination(key) {

        const config =
            COLLECTIONS[key];


        if (!config?.pagination) return;


        const container = byId(
            config.pagination
        );


        if (!container) return;


        container.replaceChildren();


        const pagination =
            state.pagination[key] || {};


        const page =
            pagination.page || 1;


        const totalPages =
            pagination.totalPages || 1;


        const totalItems =
            pagination.totalItems || 0;


        const start =

            totalItems === 0

                ? 0

                : ((page - 1) * CONFIG.PAGE_SIZE) + 1;


        const end = Math.min(

            page * CONFIG.PAGE_SIZE,

            totalItems

        );


        container.appendChild(

            create(

                "span",

                "",

                `Showing ${formatNumber(start)}–${formatNumber(end)} of ${formatNumber(totalItems)} ${config.label}`

            )

        );


        const controls = create(

            "div",

            "monetization-pagination-controls"

        );


        const previous = create(

            "button",

            "secondary-button",

            "← Previous"

        );


        previous.type = "button";

        previous.disabled =
            page <= 1 || state.loading[key];


        previous.addEventListener("click", () => {

            changePage(key, -1);

        });


        const next = create(

            "button",

            "secondary-button",

            "Next →"

        );


        next.type = "button";

        next.disabled =

            page >= totalPages ||

            state.loading[key];


        next.addEventListener("click", () => {

            changePage(key, 1);

        });


        controls.append(
            previous,
            next
        );


        container.appendChild(controls);

    }


    async function changePage(key, direction) {

        const current =
            state.pages[key] || 1;


        const total =

            state.pagination[key]?.totalPages || 1;


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
       28. FILTER MANAGEMENT
    ===================================================== */

    function initializeFilters() {

        byId("overview-filter-form")
            ?.addEventListener("submit", event => {

                event.preventDefault();


                const filters =
                    overviewFilters();


                if (
                    filters.from &&
                    filters.to &&
                    filters.from > filters.to
                ) {

                    toast(
                        "The reporting start date cannot be after the end date.",
                        "error"
                    );

                    return;

                }


                loadOverview().catch(() => { });

            });


        const filterMap = {

            "plans-filter-form": "plans",

            "pricing-filter-form": "pricing",

            "fees-filter-form": "fees",

            "history-filter-form": "history"

        };


        Object.entries(filterMap).forEach(
            ([formId, key]) => {

                const form = byId(formId);

                if (!form) return;


                form.addEventListener("submit", event => {

                    event.preventDefault();


                    const values = Object.fromEntries(

                        new FormData(form).entries()

                    );


                    state.filters[key] = values;

                    state.pages[key] = 1;


                    loadCollection(key);

                });

            }
        );


        $$("[data-clear-filter]").forEach(button => {

            button.addEventListener("click", () => {

                const key =
                    button.dataset.clearFilter;


                const formId = {

                    plans: "plans-filter-form",

                    pricing: "pricing-filter-form"

                }[key];


                const form = formId
                    ? byId(formId)
                    : null;


                if (form) form.reset();


                state.filters[key] = {};

                state.pages[key] = 1;


                loadCollection(key);

            });

        });

    }


    /* =====================================================
       29. TAB NAVIGATION
    ===================================================== */

    function openTab(tab) {

        if (!tab) return;


        state.activeTab = tab;


        $$(".monetization-tab").forEach(button => {

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


        $$(".monetization-panel").forEach(panel => {

            panel.hidden =
                panel.id !== `panel-${tab}`;

        });


        if (tab !== "overview") {

            loadCollection(tab);

        }

    }


    function initializeTabs() {

        $$(".monetization-tab").forEach(button => {

            button.addEventListener("click", () => {

                openTab(
                    button.dataset.tab
                );

            });

        });

    }


    /* =====================================================
       30. DYNAMIC CONFIGURATION FIELDS
    ===================================================== */

    function createField(definition, record = {}) {

        const wrapper = create(

            "div",

            `configuration-field${definition.full ? " full-field" : ""}`

        );


        const label = create(

            "label",

            "",

            definition.label

        );


        label.htmlFor =
            `config-${definition.name}`;


        const name =
            definition.name;


        const inputId =
            `config-${name}`;


        let input;


        if (definition.type === "textarea") {

            input = create("textarea");

            input.rows = 4;


            if (definition.array) {

                input.placeholder =
                    "Enter one item per line.";

            } else if (definition.json) {

                input.placeholder =
                    "Enter valid JSON.";

            }

        } else if (definition.type === "select") {

            input = create("select");


            const placeholder = create(
                "option",
                "",
                "Select an option"
            );


            placeholder.value = "";

            input.appendChild(placeholder);


            (definition.options || []).forEach(
                ([value, text]) => {

                    const option = create(
                        "option",
                        "",
                        text
                    );


                    option.value = value;

                    input.appendChild(option);

                }
            );

        } else {

            input = create("input");

            input.type = definition.type;

        }


        input.id = inputId;

        input.name = name;


        if (definition.required) {

            input.required = true;

        }


        if (definition.maxLength) {

            input.maxLength =
                definition.maxLength;

        }


        if (definition.min !== undefined) {

            input.min = definition.min;

        }


        if (definition.step) {

            input.step =
                definition.step;

        }


        if (definition.type === "number") {

            input.inputMode = "decimal";

        }


        let value = record[name];


        if (definition.array && Array.isArray(value)) {

            value = value.join("\n");

        }


        if (
            definition.json &&
            value &&
            typeof value === "object"
        ) {

            value = JSON.stringify(value, null, 2);

        }


        if (value !== null && value !== undefined) {

            input.value = String(value);

        }


        if (
            definition.type === "select" &&
            input.value &&
            !Array.from(input.options).some(
                option => option.value === input.value
            )
        ) {

            const unknown = create(
                "option",
                "",
                pretty(input.value)
            );


            unknown.value = input.value;

            input.appendChild(unknown);

        }


        wrapper.append(
            label,
            input
        );


        if (definition.help) {

            wrapper.appendChild(

                create(
                    "small",
                    "",
                    definition.help
                )

            );

        }


        return wrapper;

    }


    function buildConfigurationForm(type, record = {}) {

        const container = byId(
            "configuration-fields"
        );


        container.replaceChildren();


        const definitions =
            EDITOR_FIELDS[type];


        if (!definitions) {

            throw new Error(
                "Unknown monetization configuration type."
            );

        }


        definitions.forEach(definition => {

            container.appendChild(

                createField(
                    definition,
                    record
                )

            );

        });

    }


    /* =====================================================
       31. OPEN CONFIGURATION EDITOR
    ===================================================== */

    function openEditorModal(type) {

        state.editor = {

            entityType: type,

            reference: null,

            editing: false

        };


        const form = byId(
            "configuration-form"
        );


        form.reset();


        form.elements.entityType.value =
            type;


        form.elements.reference.value = "";


        buildConfigurationForm(type);


        setText(

            "editor-title",

            `Create ${pretty(type)} Configuration`

        );


        setText(

            "editor-kicker",

            "NEW MONETIZATION CONFIGURATION"

        );


        setText(

            "editor-description",

            "Configure the commercial policy and save it as a draft."

        );


        const submit = $(
            'button[type="submit"]',
            form
        );


        if (submit) {

            submit.textContent =
                "Save Draft";

        }


        show(
            byId("configuration-modal")
        );

    }


    async function openEditEditor(type, reference) {

        if (!authorized()) return;


        const key = {

            plans: "plans",

            pricing: "pricing",

            billing: "billing-models",

            fees: "fees",

            services: "services",

            rules: "rules"

        }[type];


        if (!key) return;


        try {

            const result = await request(

                `${CONFIG.API}/${key}/${safePath(reference)}`

            );


            const record =

                result?.record ||

                result?.item ||

                result;


            const editorType = {

                plans: "plan",

                pricing: "price",

                billing: "billing",

                fees: "fee",

                services: "service",

                rules: "rule"

            }[type];


            state.editor = {

                entityType: editorType,

                reference,

                editing: true

            };


            const form = byId(
                "configuration-form"
            );


            form.reset();


            form.elements.entityType.value =
                editorType;


            form.elements.reference.value =
                reference;


            buildConfigurationForm(
                editorType,
                record
            );


            setText(

                "editor-title",

                `Create New Version of ${pretty(editorType)}`

            );


            setText(

                "editor-kicker",

                "VERSIONED CONFIGURATION"

            );


            setText(

                "editor-description",

                "Saving creates a new draft version. Existing published configurations remain unchanged."

            );


            const submit = $(
                'button[type="submit"]',
                form
            );


            if (submit) {

                submit.textContent =
                    "Save New Draft Version";

            }


            show(
                byId("configuration-modal")
            );


        } catch (error) {

            toast(
                error.message,
                "error"
            );

        }

    }


    function closeEditor() {

        hide(
            byId("configuration-modal")
        );


        state.editor = {

            entityType: null,

            reference: null,

            editing: false

        };

    }


    /* =====================================================
       32. SERIALIZE CONFIGURATION FORM
    ===================================================== */

    function serializeConfiguration(form, type) {

        const definitions =
            EDITOR_FIELDS[type];


        if (!definitions) {

            throw new Error(
                "Configuration fields are unavailable."
            );

        }


        const body = {

            status: "draft"

        };


        definitions.forEach(definition => {

            const input =
                form.elements[definition.name];


            if (!input) return;


            const raw = input.value.trim();


            if (
                definition.required &&
                !raw
            ) {

                throw new Error(
                    `${definition.label} is required.`
                );

            }


            if (
                definition.name === "effectiveFrom" &&
                raw
            ) {

                const end =
                    form.elements.effectiveTo?.value;


                if (end && raw > end) {

                    throw new Error(
                        "The effective start date cannot be after the end date."
                    );

                }

            }


            if (raw === "") {

                return;

            }


            if (definition.array) {

                body[definition.name] = raw

                    .split(/\r?\n/)

                    .map(value => value.trim())

                    .filter(Boolean);

                return;

            }


            if (definition.json) {

                try {

                    body[definition.name] =
                        JSON.parse(raw);

                } catch {

                    throw new Error(
                        `${definition.label} must contain valid JSON.`
                    );

                }

                return;

            }


            if (definition.type === "number") {

                const value = Number(raw);


                if (
                    !Number.isFinite(value) ||
                    value < 0
                ) {

                    throw new Error(
                        `${definition.label} must be a valid non-negative number.`
                    );

                }


                body[definition.name] = value;

                return;

            }


            body[definition.name] = raw;

        });


        if (
            type === "price" &&
            body.amount !== undefined
        ) {

            if (
                !body.currency ||
                body.currency.length !== 3
            ) {

                throw new Error(
                    "A valid three-letter currency code is required."
                );

            }

        }


        return body;

    }


    /* =====================================================
       33. SAVE CONFIGURATION
    ===================================================== */

    async function saveConfiguration(event) {

        event.preventDefault();


        if (!authorized()) return;


        const form = event.currentTarget;


        if (!form.reportValidity()) return;


        const type =
            state.editor.entityType;


        const reference =
            state.editor.reference;


        if (!type) {

            toast(
                "Configuration type is unavailable.",
                "error"
            );

            return;

        }


        let body;


        try {

            body = serializeConfiguration(
                form,
                type
            );

        } catch (error) {

            toast(
                error.message,
                "error"
            );

            return;

        }


        const entityKey = {

            plan: "plans",

            price: "pricing",

            billing: "billing-models",

            fee: "fees",

            service: "services",

            rule: "rules"

        }[type];


        const path = state.editor.editing

            ? `${CONFIG.API}/${entityKey}/${safePath(reference)}/versions`

            : `${CONFIG.API}/${entityKey}`;


        const button = $(
            'button[type="submit"]',
            form
        );


        try {

            if (button) button.disabled = true;


            const result = await request(

                path,

                {

                    method: "POST",

                    body

                }

            );


            toast(

                result?.message ||

                "Monetization configuration saved as a draft.",

                "success"

            );


            closeEditor();


            const collectionKey = {

                plan: "plans",

                price: "pricing",

                billing: "billing",

                fee: "fees",

                service: "services",

                rule: "rules"

            }[type];


            state.pages[collectionKey] = 1;


            await Promise.allSettled([

                loadCollection(collectionKey),

                loadOverview()

            ]);


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
       34. RECORD DETAILS
    ===================================================== */

    function addDetail(container, label, value) {

        const wrapper = create("div");


        wrapper.appendChild(

            create(
                "dt",
                "",
                label
            )

        );


        wrapper.appendChild(

            create(
                "dd",
                "",
                value === null ||
                    value === undefined ||
                    value === ""

                    ? "Not available"

                    : typeof value === "object"

                        ? JSON.stringify(value)

                        : String(value)

            )

        );


        container.appendChild(wrapper);

    }


    function renderDetails(record) {

        const container = byId(
            "record-details"
        );


        container.replaceChildren();


        if (!record || typeof record !== "object") {

            addDetail(
                container,
                "Information",
                "No details available."
            );

            return;

        }


        const hiddenFields = new Set([

            "internalSecrets",

            "secretKey",

            "privateKey",

            "password",

            "token",

            "credentials"

        ]);


        Object.entries(record).forEach(
            ([key, value]) => {

                if (hiddenFields.has(key)) return;


                if (
                    value === null ||
                    value === undefined
                ) {

                    return;

                }


                let formatted = value;


                if (
                    [
                        "createdAt",
                        "updatedAt",
                        "effectiveFrom",
                        "effectiveTo",
                        "publishedAt",
                        "retiredAt",
                        "generatedAt"
                    ].includes(key)
                ) {

                    formatted = formatDateTime(value);

                } else if (
                    key === "amount" ||
                    key === "recurringRevenue"
                ) {

                    formatted = formatMoney(
                        value,
                        record.currency
                    );

                } else if (
                    key.toLowerCase().includes("status") ||
                    key === "portal"
                ) {

                    formatted = pretty(value);

                }


                addDetail(

                    container,

                    pretty(key),

                    formatted

                );

            }
        );

    }


    async function openRecordDetails(type, reference) {

        if (!authorized()) return;


        if (!reference) {

            toast(
                "Record reference is unavailable.",
                "error"
            );

            return;

        }


        const endpoints = {

            plans: "plans",

            pricing: "pricing",

            billing: "billing-models",

            fees: "fees",

            services: "services",

            rules: "rules",

            analytics: "analytics/reports",

            history: "history"

        };


        const endpoint =
            endpoints[type];


        if (!endpoint) return;


        try {

            const result = await request(

                `${CONFIG.API}/${endpoint}/${safePath(reference)}`

            );


            const record =
                result?.record || result?.item || result;


            setText(

                "record-title",

                `${pretty(type)} Details`

            );


            renderDetails(record);


            show(
                byId("record-modal")
            );


        } catch (error) {

            toast(
                error.message,
                "error"
            );

        }

    }


    function closeRecordDetails() {

        hide(
            byId("record-modal")
        );

    }


    /* =====================================================
       35. PUBLISH / SUSPEND / RETIRE / ACTIVATE
    ===================================================== */

    async function executeConfigurationAction(
        type,
        reference,
        action
    ) {

        if (!authorized()) return;


        if (!reference) {

            toast(
                "Configuration reference is unavailable.",
                "error"
            );

            return;

        }


        const endpointMap = {

            plans: "plans",

            pricing: "pricing",

            billing: "billing-models",

            fees: "fees",

            services: "services",

            rules: "rules"

        };


        const endpoint =
            endpointMap[type];


        if (!endpoint) return;


        const reason = window.prompt(

            `Enter the administrative reason for ${action}:`

        );


        if (reason === null) return;


        if (reason.trim().length < 5) {

            toast(
                "A meaningful administrative reason is required.",
                "warning"
            );

            return;

        }


        if (!window.confirm(

            `Confirm ${action} for this monetization configuration?`

        )) {

            return;

        }


        try {

            const result = await request(

                `${CONFIG.API}/${endpoint}/${safePath(reference)}/${action}`,

                {

                    method: "POST",

                    body: {

                        reason: reason.trim()

                    }

                }

            );


            toast(

                result?.message ||

                `Configuration ${action} request completed.`,

                "success"

            );


            await Promise.allSettled([

                loadCollection(type),

                loadOverview(),

                loadCollection("history")

            ]);


        } catch (error) {

            toast(
                error.message,
                "error"
            );

        }

    }


    /* =====================================================
       36. TABLE ACTIONS
    ===================================================== */

    function initializeTableActions() {

        document.addEventListener("click", event => {

            const button = event.target.closest(
                "[data-action]"
            );


            if (!button) return;


            const action =
                button.dataset.action;


            const type =
                button.dataset.type;


            const reference =
                button.dataset.reference;


            if (!reference) {

                toast(
                    "Record reference is unavailable.",
                    "error"
                );

                return;

            }


            if (action === "view") {

                openRecordDetails(
                    type,
                    reference
                );

                return;

            }


            if (action === "edit") {

                openEditEditor(
                    type,
                    reference
                );

                return;

            }


            if (
                [
                    "publish",
                    "suspend",
                    "retire",
                    "activate"
                ].includes(action)
            ) {

                executeConfigurationAction(

                    type,

                    reference,

                    action

                );

            }

        });

    }


    /* =====================================================
       37. CREATE CONFIGURATION BUTTONS
    ===================================================== */

    function initializeCreateButtons() {

        $$("[data-create]").forEach(button => {

            button.addEventListener("click", () => {

                const type =
                    button.dataset.create;


                if (!EDITOR_FIELDS[type]) {

                    toast(
                        "Configuration type is unavailable.",
                        "error"
                    );

                    return;

                }


                openEditorModal(type);

            });

        });

    }


    /* =====================================================
       38. ANALYTICS REPORT ACTIONS
    ===================================================== */

    async function openAnalyticsReport(type) {

        if (!authorized()) return;


        const filters = overviewFilters();


        const query = queryString({

            type,

            ...filters

        });


        try {

            const result = await request(

                `${CONFIG.API}/analytics?${query}`

            );


            const report =
                result?.report || result;


            setText(

                "record-title",

                `${pretty(type)} Analytics`

            );


            renderDetails(report);


            show(
                byId("record-modal")
            );


        } catch (error) {

            toast(
                error.message,
                "error"
            );

        }

    }


    function initializeAnalytics() {

        $$("[data-analytics]").forEach(button => {

            button.addEventListener("click", () => {

                openAnalyticsReport(
                    button.dataset.analytics
                );

            });

        });


        byId("refresh-analytics-button")
            ?.addEventListener("click", () => {

                loadCollection("analytics");

            });

    }


    /* =====================================================
       39. CSV EXPORT
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


        const csv = [

            headers.map(csvSafe).join(","),

            ...rows.map(row =>

                row.map(csvSafe).join(",")

            )

        ].join("\r\n");


        const blob = new Blob(

            ["\uFEFF" + csv],

            {

                type: "text/csv;charset=utf-8;"

            }

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
            "CSV export prepared from currently loaded records.",
            "success"
        );

    }


    function exportOverview() {

        const metrics =
            state.metrics || {};


        const currency =
            state.overview?.currency || "";


        const rows = [

            ["Active Subscription Plans", metrics.activePlanCount],

            ["Active Subscriptions", metrics.activeSubscriptionCount],

            ["Recurring Revenue", metrics.recurringRevenue],

            ["Monetization Revenue", metrics.monetizationRevenue],

            ["Paid Service Adoption", metrics.paidServiceAdoption],

            ["Active Revenue Rules", metrics.activeRuleCount]

        ].map(([label, value]) => {

            let amount = value;

            let code = currency;


            if (
                value &&
                typeof value === "object"
            ) {

                amount =
                    value.amount ?? value.value ?? "";

                code =
                    value.currency || currency;

            }


            return [

                label,

                amount ?? "",

                code

            ];

        });


        downloadCSV(

            "talvora-monetization-overview.csv",

            [

                "Metric",

                "Value",

                "Currency"

            ],

            rows

        );

    }


    function exportCollection(key) {

        const items =
            state.collections[key] || [];


        if (!items.length) {

            toast(
                "There are no loaded records to export.",
                "warning"
            );

            return;

        }


        const columns = {

            plans: [

                "reference",

                "name",

                "portal",

                "billingModelReference",

                "status",

                "effectiveFrom",

                "effectiveTo"

            ],

            pricing: [

                "reference",

                "name",

                "targetType",

                "planReference",

                "serviceReference",

                "countryCode",

                "currency",

                "amount",

                "billingInterval",

                "status"

            ],

            billing: [

                "reference",

                "name",

                "portal",

                "structure",

                "frequency",

                "status"

            ],

            fees: [

                "reference",

                "name",

                "feeType",

                "appliesTo",

                "calculationValue",

                "currency",

                "countryCode",

                "status"

            ],

            services: [

                "reference",

                "name",

                "portal",

                "pricingReference",

                "accessModel",

                "status"

            ],

            rules: [

                "reference",

                "name",

                "triggerKey",

                "targetReference",

                "priority",

                "status"

            ],

            analytics: [

                "reference",

                "type",

                "periodStart",

                "periodEnd",

                "generatedBy",

                "generatedAt",

                "status"

            ],

            history: [

                "createdAt",

                "administratorName",

                "action",

                "entityType",

                "entityReference",

                "reason"

            ]

        };


        const fields =
            columns[key] || [];


        const rows = items.map(record =>

            fields.map(field => {

                const value =
                    record[field];


                if (
                    value &&
                    typeof value === "object"
                ) {

                    return JSON.stringify(value);

                }


                return value ?? "";

            })

        );


        downloadCSV(

            `talvora-${key}.csv`,

            fields,

            rows

        );

    }


    /* =====================================================
       40. NOTIFICATIONS
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

                    "No monetization notifications received."

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
                "◈"
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

                    "Monetization notification"

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

                    formatDateTime(item.createdAt)

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

                `${CONFIG.NOTIFICATIONS}?scope=monetization`

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
                    formatNumber(unread)
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
       41. MODAL CONTROLS
    ===================================================== */

    function initializeModals() {

        byId("configuration-form")
            ?.addEventListener(
                "submit",
                saveConfiguration
            );


        $$("[data-close-editor]").forEach(button => {

            button.addEventListener(
                "click",
                closeEditor
            );

        });


        $$("[data-close-record]").forEach(button => {

            button.addEventListener(
                "click",
                closeRecordDetails
            );

        });


        byId("configuration-modal")
            ?.addEventListener("click", event => {

                if (
                    event.target.id ===
                    "configuration-modal"
                ) {

                    closeEditor();

                }

            });


        byId("record-modal")
            ?.addEventListener("click", event => {

                if (
                    event.target.id ===
                    "record-modal"
                ) {

                    closeRecordDetails();

                }

            });


        byId("drawer-close")
            ?.addEventListener("click", () => {

                hide(
                    byId("notification-drawer")
                );

            });

    }


    /* =====================================================
       42. SIDEBAR
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
       43. GLOBAL CONTROLS
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


        byId("export-analytics-button")
            ?.addEventListener("click", () => {

                exportCollection("analytics");

            });


        byId("export-history-button")
            ?.addEventListener("click", () => {

                exportCollection("history");

            });


        byId("notification-button")
            ?.addEventListener(
                "click",
                openNotifications
            );

    }


    /* =====================================================
       44. KEYBOARD ACCESSIBILITY
    ===================================================== */

    function initializeKeyboard() {

        document.addEventListener("keydown", event => {

            if (event.key !== "Escape") return;


            closeEditor();

            closeRecordDetails();

            closeSidebar();

            hide(
                byId("notification-drawer")
            );

        });

    }


    /* =====================================================
       45. SECURITY & GOVERNANCE
    ===================================================== */

    function initializeSecurity() {

        /*
         * TALVORA MONETIZATION SECURITY
         *
         * ADMINISTRATION
         *
         * - Require verified Super Admin authentication.
         * - All ten authorized Super Admin accounts use
         *   the central administrative authority model.
         * - The backend independently validates every action.
         *
         * SUBSCRIPTION PLANS
         *
         * - Plans are separate from their pricing configurations.
         * - Entitlements must be explicitly defined.
         * - Published plans must not be silently rewritten.
         *
         * PRICING
         *
         * - Preserve original amount and currency.
         * - Use country-specific pricing where configured.
         * - Maintain effective dates and version history.
         * - Do not automatically convert or overwrite currencies.
         *
         * BILLING
         *
         * - Billing models define obligations, not payment execution.
         * - Actual collection is handled by the financial backend.
         * - Existing customer agreements require appropriate
         *   treatment when a pricing version changes.
         *
         * FEES AND COMMISSIONS
         *
         * - No charge exists unless an approved rule defines it.
         * - Calculation parameters require server-side validation.
         * - Rules must have explicit eligibility conditions.
         *
         * PREMIUM SERVICES
         *
         * - Access requires valid entitlement checks.
         * - Service availability must be synchronized across portals.
         *
         * REVENUE RULES
         *
         * - Rules must reference valid configurations.
         * - The backend must prevent conflicting or duplicate charges.
         * - Policy evaluation must be deterministic and auditable.
         *
         * CHANGE MANAGEMENT
         *
         * - Published configurations are versioned.
         * - Changes create new drafts.
         * - Publication must follow server-side validation.
         * - Effective dates must be respected.
         * - Retirement must preserve historical records.
         *
         * AUDIT
         *
         * - Record administrator identity.
         * - Record configuration reference and version.
         * - Record before-and-after states.
         * - Record action, reason and timestamp.
         * - Keep audit records read-only in this interface.
         *
         * SECURITY
         *
         * - Never expose billing credentials in browser code.
         * - Never trust client-side pricing calculations.
         * - Validate all configuration fields on the server.
         * - Prevent unauthorized access to other tenants' data.
         * - Protect state-changing requests against CSRF.
         *
         */

    }


    /* =====================================================
       46. REFRESH
    ===================================================== */

    async function refreshAll() {

        if (!authorized()) return;


        if (state.refreshing) return;


        state.refreshing = true;


        const button = byId(
            "refresh-button"
        );


        if (button) button.disabled = true;


        const tasks = [

            loadOverview()

        ];


        if (state.activeTab !== "overview") {

            tasks.push(

                loadCollection(state.activeTab)

            );

        }


        await Promise.allSettled(tasks);


        state.refreshing = false;


        if (button) button.disabled = false;


        toast(
            "Monetization refresh completed.",
            "success"
        );

    }


    /* =====================================================
       47. APPLICATION INITIALIZATION
    ===================================================== */

    async function initialize() {

        initializeSidebar();

        initializeTabs();

        initializeFilters();

        initializeTableActions();

        initializeCreateButtons();

        initializeAnalytics();

        initializeModals();

        initializeControls();

        initializeKeyboard();

        initializeSecurity();


        const authenticated =
            await verifySession();


        if (!authenticated) return;


        await loadOverview().catch(() => { });


        console.info(

            "TALVORA Subscription & Monetization Centre initialized."

        );

    }


    /* =====================================================
       48. APPLICATION ENTRY POINT
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
