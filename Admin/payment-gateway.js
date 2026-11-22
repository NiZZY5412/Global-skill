
(() => {
    "use strict";

    /* =====================================================
       TALVORA GLOBAL PAYMENT GATEWAY & BANKING CENTRE
       ===================================================== */

    const DEFAULT_ENDPOINTS = {
        dashboard: "/api/payment-infrastructure/dashboard",
        referenceData: "/api/payment-infrastructure/reference-data",

        providers: "/api/payment-infrastructure/providers",
        providerProposals: "/api/payment-infrastructure/providers/proposals",

        banks: "/api/payment-infrastructure/bank-integrations",
        bankProposals: "/api/payment-infrastructure/bank-integrations/proposals",

        routing: "/api/payment-infrastructure/routing-rules",
        routingProposals: "/api/payment-infrastructure/routing-rules/proposals",

        payments: "/api/payment-infrastructure/payments",
        mobileMoney: "/api/payment-infrastructure/mobile-money/channels",

        webhooks: "/api/payment-infrastructure/webhooks",
        settlements: "/api/payment-infrastructure/settlements",

        currencies: "/api/payment-infrastructure/currencies",
        fxRates: "/api/payment-infrastructure/fx/rates",
        fxProposals: "/api/payment-infrastructure/fx/policies/proposals",

        credentials: "/api/payment-infrastructure/credentials",

        credentialRotation:
            "/api/payment-infrastructure/credentials",

        health: "/api/payment-infrastructure/health/providers",
        healthRefresh: "/api/payment-infrastructure/health/refresh",

        failover: "/api/payment-infrastructure/failover/policies",
        incidents: "/api/payment-infrastructure/incidents",

        tests: "/api/payment-infrastructure/tests",

        audit: "/api/payment-infrastructure/audit",
        exports: "/api/payment-infrastructure/exports"
    };

    const shared = window.TALVORA_ADMIN_CONFIG || {};
    const supplied = window.TALVORA_PAYMENT_CONFIG || {};

    const CONFIG = {
        apiBaseUrl: supplied.apiBaseUrl || shared.apiBaseUrl || "",
        timeout: Number(supplied.timeout || shared.timeout) || 25000,
        refreshInterval: Number(supplied.refreshInterval || shared.refreshInterval) || 30000,
        pageSize: Number(supplied.pageSize || shared.pageSize) || 25,

        endpoints: {
            ...DEFAULT_ENDPOINTS,
            ...(supplied.endpoints || {})
        }
    };

    const state = {
        section: "overview",

        currencies: [],
        countries: [],
        providers: [],

        banks: [],
        routing: [],
        payments: [],
        mobileMoney: [],
        webhooks: [],
        settlements: [],
        fxRates: [],
        credentials: [],
        health: [],
        failover: [],
        incidents: [],
        tests: [],
        audit: [],

        paymentPage: 1,
        paymentPages: 1,

        activeRecord: null,
        activeRecordType: null,

        pendingAction: null,
        refreshTimer: null
    };

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        [...root.querySelectorAll(selector)];

    /* =====================================================
       1. SAFE UTILITIES
       ===================================================== */

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function humanize(value) {
        if (value === null || value === undefined || value === "") {
            return "—";
        }

        return String(value)
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());
    }

    function safeClass(value) {
        return String(value || "unknown")
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "_");
    }

    function getData(payload) {
        return payload?.data ?? payload ?? {};
    }

    function getRecords(payload, ...keys) {
        if (Array.isArray(payload)) return payload;

        const data = getData(payload);

        if (Array.isArray(data)) return data;

        for (const key of keys) {
            if (Array.isArray(data?.[key])) return data[key];
            if (Array.isArray(payload?.[key])) return payload[key];
        }

        return [];
    }

    function getValue(object, ...keys) {
        for (const key of keys) {
            if (
                object?.[key] !== undefined &&
                object[key] !== null
            ) {
                return object[key];
            }
        }

        return undefined;
    }

    function formatNumber(value) {
        if (value === null || value === undefined || value === "") {
            return "—";
        }

        const number = Number(value);

        return Number.isFinite(number)
            ? new Intl.NumberFormat().format(number)
            : "—";
    }

    function formatMoney(amount, currency) {
        if (amount === null || amount === undefined || amount === "") {
            return "—";
        }

        if (!currency) return "Currency unavailable";

        const value = Number(amount);

        if (!Number.isFinite(value)) return "—";

        try {
            return new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: String(currency).toUpperCase()
            }).format(value);
        } catch {
            return `${String(currency).toUpperCase()} ${formatNumber(value)}`;
        }
    }

    function formatDate(value) {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(date);
    }

    function formatRate(value) {
        if (value === null || value === undefined) return "—";

        const number = Number(value);

        return Number.isFinite(number)
            ? number.toLocaleString(undefined, {
                maximumFractionDigits: 10
            })
            : "—";
    }

    function metric(id, value, suffix = "") {
        const element = document.getElementById(id);

        if (!element) return;

        if (value === null || value === undefined) {
            element.textContent = "—";
            return;
        }

        element.textContent =
            `${typeof value === "number" ? formatNumber(value) : String(value)}${suffix}`;
    }

    function badge(status) {
        return `
      <span class="badge ${safeClass(status)}">
        ${escapeHTML(humanize(status))}
      </span>
    `;
    }

    function emptyRow(columns, message = "No records available.") {
        return `
      <tr>
        <td colspan="${columns}">
          ${escapeHTML(message)}
        </td>
      </tr>
    `;
    }

    function toast(message, type = "info") {
        const region = $("#toastRegion");

        if (!region) return;

        const element = document.createElement("div");

        element.className = `toast ${safeClass(type)}`;
        element.textContent = message;

        region.appendChild(element);

        setTimeout(() => element.remove(), 5000);
    }

    function showModal(id) {
        const modal = document.getElementById(id);

        if (modal) modal.hidden = false;
    }

    function closeModal(modal) {
        if (modal) modal.hidden = true;
    }

    function closeAllModals() {
        $$(".modal-overlay").forEach(closeModal);
    }

    function formValues(form) {
        return Object.fromEntries(
            new FormData(form).entries()
        );
    }

    function splitCodes(value) {
        return String(value || "")
            .split(",")
            .map(item => item.trim().toUpperCase())
            .filter(Boolean);
    }

    function buildQuery(params = {}) {
        const query = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (
                value !== "" &&
                value !== null &&
                value !== undefined
            ) {
                query.set(key, String(value));
            }
        });

        const result = query.toString();

        return result ? `?${result}` : "";
    }

    function endpoint(path) {
        return CONFIG.apiBaseUrl.replace(/\/+$/, "") +
            (path.startsWith("/") ? path : `/${path}`);
    }

    function debounce(callback, delay = 350) {
        let timer;

        return (...args) => {
            clearTimeout(timer);

            timer = setTimeout(
                () => callback(...args),
                delay
            );
        };
    }

    function setConnection(status, message) {
        const element = $("#connectionStatus");

        if (!element) return;

        element.className = `connection-status ${status}`;

        element.innerHTML =
            `<i></i>${escapeHTML(message)}`;
    }

    function setEnvironment(value) {
        const element = $("#environmentBadge");

        if (!element) return;

        const environment = String(value || "unknown").toLowerCase();

        element.className =
            `environment-badge ${safeClass(environment)}`;

        element.textContent =
            `ENVIRONMENT: ${humanize(environment)}`;
    }

    /* =====================================================
       2. SECURE BACKEND API CLIENT
       ===================================================== */

    async function api(path, options = {}) {
        const controller = new AbortController();

        const timeout = setTimeout(
            () => controller.abort(),
            CONFIG.timeout
        );

        const headers = new Headers(options.headers || {});

        headers.set("Accept", "application/json");

        const csrf = $('meta[name="csrf-token"]')?.content;

        if (csrf) {
            headers.set("X-CSRF-Token", csrf);
        }

        let body = options.body;

        if (
            body &&
            !(body instanceof FormData) &&
            typeof body !== "string"
        ) {
            headers.set("Content-Type", "application/json");
            body = JSON.stringify(body);
        }

        try {
            const response = await fetch(endpoint(path), {
                ...options,
                headers,
                body,
                credentials: "include",
                signal: controller.signal
            });

            if (!response.ok) {
                const contentType =
                    response.headers.get("content-type") || "";

                let message =
                    `Payment infrastructure error (${response.status})`;

                if (contentType.includes("application/json")) {
                    const error = await response.json().catch(() => ({}));

                    message =
                        error.message ||
                        error.error ||
                        error.detail ||
                        message;
                } else {
                    const text = await response.text().catch(() => "");

                    if (text) message = text;
                }

                throw new Error(message);
            }

            if (response.status === 204) return null;

            const contentType =
                response.headers.get("content-type") || "";

            if (contentType.includes("application/json")) {
                return response.json();
            }

            return response.text();

        } finally {
            clearTimeout(timeout);
        }
    }

    async function downloadFile(path, filename) {
        try {
            const response = await fetch(endpoint(path), {
                credentials: "include",
                headers: {
                    "Accept": "application/octet-stream",
                    "X-CSRF-Token":
                        $('meta[name="csrf-token"]')?.content || ""
                }
            });

            if (!response.ok) {
                throw new Error(`Export failed (${response.status})`);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");

            link.href = url;
            link.download = filename;

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(url), 1000);

            toast("Export downloaded.", "success");

        } catch (error) {
            toast(error.message, "error");
        }
    }

    function actionHeaders() {
        const headers = {};

        if (window.crypto?.randomUUID) {
            headers["Idempotency-Key"] = window.crypto.randomUUID();
        }

        return headers;
    }

    /* =====================================================
       3. REFERENCE DATA
       ===================================================== */

    async function loadReferenceData() {
        try {
            const payload = await api(CONFIG.endpoints.referenceData);
            const data = getData(payload);

            state.currencies = getRecords(
                data,
                "currencies",
                "supportedCurrencies",
                "supported_currencies"
            );

            state.countries = getRecords(
                data,
                "countries",
                "supportedCountries",
                "supported_countries"
            );

            state.providers = getRecords(
                data,
                "providers",
                "gatewayProviders",
                "gateway_providers"
            );

            populateCurrencies();
            populateCountries();
            populateProviders();

        } catch (error) {
            console.warn(
                "[TALVORA Payments] Reference data unavailable:",
                error.message
            );
        }
    }

    function populateSelect(select, records, getOption) {
        if (!select) return;

        const first = select.options[0]?.cloneNode(true);

        select.innerHTML = "";

        if (first) select.appendChild(first);

        records.forEach(record => {
            const optionData = getOption(record);

            if (!optionData?.value) return;

            const option = document.createElement("option");

            option.value = optionData.value;
            option.textContent = optionData.label;

            select.appendChild(option);
        });
    }

    function populateCurrencies() {
        const selectors = [
            "#paymentCurrency",
            "#settlementCurrency",
            ".currency-options"
        ];

        selectors.forEach(selector => {
            $$(selector).forEach(select => {
                populateSelect(
                    select,
                    state.currencies,
                    item => {
                        const code =
                            item.code || item.currencyCode || item.currency_code;

                        return code ? {
                            value: code,
                            label: `${code} — ${item.name || item.displayName || code}`
                        } : null;
                    }
                );
            });
        });
    }

    function populateCountries() {
        populateSelect(
            $("#bankCountry"),
            state.countries,
            item => {
                const code = item.code || item.iso2 || item.isoCode;

                return code ? {
                    value: code,
                    label: item.name
                        ? `${item.name} (${code})`
                        : code
                } : null;
            }
        );
    }

    function populateProviders() {
        const selectors = [
            "#paymentProvider",
            "#testProvider",
            ".provider-options"
        ];

        selectors.forEach(selector => {
            $$(selector).forEach(select => {
                populateSelect(
                    select,
                    state.providers,
                    item => {
                        const id = item.id || item.providerId || item.provider_id;

                        return id ? {
                            value: id,
                            label: item.name || item.displayName || id
                        } : null;
                    }
                );
            });
        });
    }

    /* =====================================================
       4. DASHBOARD
       ===================================================== */

    async function loadOverview() {
        try {
            const payload = await api(CONFIG.endpoints.dashboard);
            const data = getData(payload);
            const metrics = data.metrics || data.summary || {};

            metric("activeProviders",
                getValue(metrics, "activeProviders", "active_providers"));

            metric("successRate",
                getValue(metrics, "paymentSuccessRate", "payment_success_rate"),
                getValue(metrics, "paymentSuccessRate", "payment_success_rate") === undefined
                    ? ""
                    : "%");

            metric("processingPayments",
                getValue(metrics, "processingPayments", "processing_payments"));

            metric("failedPayments",
                getValue(metrics, "failedPayments", "failed_payments"));

            metric("pendingSettlements",
                getValue(metrics, "pendingSettlements", "pending_settlements"));

            metric("webhookFailures",
                getValue(metrics, "webhookFailures", "webhook_failures"));

            metric("openIncidents",
                getValue(metrics, "openIncidents", "open_incidents"));

            metric("unhealthyIntegrations",
                getValue(metrics, "unhealthyIntegrations", "unhealthy_integrations"));

            renderProviderAvailability(
                getRecords(data, "providerAvailability", "provider_availability")
            );

            renderChannelDistribution(
                getRecords(data, "channelDistribution", "channel_distribution")
            );

            renderInfrastructureAlerts(
                getRecords(data, "alerts", "infrastructureAlerts", "infrastructure_alerts")
            );

            renderRecentPayments(
                getRecords(data, "recentPayments", "recent_payments")
            );

            if (data.environment) {
                setEnvironment(data.environment);
            }

            $("#bannerMessage").textContent =
                data.message || "Payment infrastructure information retrieved.";

            setConnection("connected", "Connected");

        } catch (error) {
            setConnection("error", "Connection issue");

            $("#bannerMessage").textContent =
                "Payment infrastructure dashboard unavailable.";

            console.error("[TALVORA Payments] Dashboard:", error.message);
        }
    }

    function renderProviderAvailability(items) {
        const container = $("#providerAvailability");

        if (!items.length) {
            container.textContent = "No provider health data available.";
            return;
        }

        container.innerHTML = items.map(item => `
      <div class="provider-row">
        <div>
          <strong>${escapeHTML(item.name || item.providerName || item.provider_name || "Provider")}</strong>
          <small>${escapeHTML(item.environment || "—")} · ${escapeHTML(item.latencyMs ?? item.latency_ms ?? "—")} ms</small>
        </div>
        ${badge(item.health || item.status)}
      </div>
    `).join("");
    }

    function renderChannelDistribution(items) {
        const container = $("#channelDistribution");

        if (!items.length) {
            container.textContent = "No payment channel data available.";
            return;
        }

        container.innerHTML = items.map(item => `
      <div class="distribution-row">
        <span>${escapeHTML(humanize(item.channel || item.type))}</span>
        <strong>${escapeHTML(
            item.amount !== undefined
                ? formatMoney(item.amount, item.currency)
                : formatNumber(item.count)
        )}</strong>
      </div>
    `).join("");
    }

    function renderInfrastructureAlerts(items) {
        const container = $("#infrastructureAlerts");

        if (!items.length) {
            container.textContent = "No infrastructure alerts returned.";
            return;
        }

        container.innerHTML = items.map(item => `
      <div class="governance-alert">
        <div>
          <strong>${escapeHTML(item.title || item.category || "Infrastructure alert")}</strong>
          <p>${escapeHTML(item.description || "No additional description.")}</p>
        </div>
        ${badge(item.severity || item.status)}
      </div>
    `).join("");
    }

    function renderRecentPayments(items) {
        $("#recentPayments").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.reference || item.id)}</td>
          <td>${escapeHTML(item.providerName || item.provider_name || "—")}</td>
          <td>${escapeHTML(humanize(item.channel))}</td>
          <td>${escapeHTML(formatMoney(item.amount, item.currency))}</td>
          <td>${escapeHTML(item.currency || "—")}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${badge(item.status)}</td>
        </tr>
      `).join("")
            : emptyRow(7);
    }

    /* =====================================================
       5. PROVIDER MANAGEMENT
       ===================================================== */

    async function loadProviders() {
        try {
            const payload = await api(
                CONFIG.endpoints.providers + buildQuery({
                    search: $("#providerSearch").value.trim(),
                    status: $("#providerStatus").value,
                    environment: $("#providerEnvironment").value
                })
            );

            state.providers = getRecords(
                payload,
                "providers",
                "items"
            );

            renderProviders(state.providers);
            populateProviders();

        } catch (error) {
            $("#providerTable").innerHTML =
                emptyRow(9, "Gateway providers could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderProviders(items) {
        $("#providerTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || item.providerId || item.provider_id)}</td>
          <td>${escapeHTML(item.name || item.displayName || item.display_name)}</td>
          <td>${escapeHTML(humanize(item.channel))}</td>
          <td>${escapeHTML(
                Array.isArray(item.countries)
                    ? item.countries.join(", ")
                    : item.countries || "—"
            )}</td>
          <td>${escapeHTML(
                Array.isArray(item.currencies)
                    ? item.currencies.join(", ")
                    : item.currencies || "—"
            )}</td>
          <td>${badge(item.environment)}</td>
          <td>${badge(item.health || item.healthStatus || item.health_status)}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-detail-type="providers"
                    data-detail-id="${escapeHTML(item.id)}">
              Manage
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(9);
    }

    async function submitProviderProposal(form) {
        const button = form.querySelector('[type="submit"]');
        const values = formValues(form);

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.providerProposals, {
                method: "POST",
                headers: actionHeaders(),
                body: {
                    code: values.code.trim(),
                    name: values.name.trim(),
                    channel: values.channel,
                    environment: values.environment,
                    countries: splitCodes(values.countries),
                    currencies: splitCodes(values.currencies),
                    credentialReference: values.credentialRef.trim() || null,
                    reason: values.reason.trim()
                }
            });

            form.reset();
            closeModal($("#providerModal"));

            toast(
                "Provider registration proposal submitted for review.",
                "success"
            );

            await loadProviders();

        } catch (error) {
            toast(`Provider proposal failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    /* =====================================================
       6. BANKING INTEGRATIONS
       ===================================================== */

    async function loadBanking() {
        try {
            const payload = await api(
                CONFIG.endpoints.banks + buildQuery({
                    search: $("#bankSearch").value.trim(),
                    status: $("#bankStatus").value,
                    country: $("#bankCountry").value
                })
            );

            state.banks = getRecords(
                payload,
                "integrations",
                "banks",
                "items"
            );

            renderBanking(state.banks);

        } catch (error) {
            $("#bankTable").innerHTML =
                emptyRow(9, "Banking integrations could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderBanking(items) {
        $("#bankTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id)}</td>
          <td>${escapeHTML(item.institutionName || item.institution_name || item.name)}</td>
          <td>${escapeHTML(item.country || "—")}</td>
          <td>${escapeHTML(humanize(item.rail || item.transferRail || item.transfer_rail))}</td>
          <td>${escapeHTML(
                Array.isArray(item.currencies)
                    ? item.currencies.join(", ")
                    : item.currencies || "—"
            )}</td>
          <td>${escapeHTML(item.accountReference || item.account_reference || "Protected")}</td>
          <td>${badge(item.settlementStatus || item.settlement_status || "unknown")}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-detail-type="banks"
                    data-detail-id="${escapeHTML(item.id)}">
              Manage
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(9);
    }

    async function submitBankProposal(form) {
        const button = form.querySelector('[type="submit"]');
        const values = formValues(form);

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.bankProposals, {
                method: "POST",
                headers: actionHeaders(),
                body: {
                    institutionName: values.institutionName.trim(),
                    institutionCode: values.institutionCode.trim(),
                    country: values.country.trim().toUpperCase(),
                    rail: values.rail,
                    currencies: splitCodes(values.currencies),
                    accountReference: values.accountRef.trim() || null,
                    credentialReference: values.credentialRef.trim() || null,
                    reason: values.reason.trim()
                }
            });

            form.reset();
            closeModal($("#bankModal"));

            toast(
                "Banking integration proposal submitted.",
                "success"
            );

            await loadBanking();

        } catch (error) {
            toast(`Bank proposal failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    /* =====================================================
       7. PAYMENT ROUTING
       ===================================================== */

    async function loadRouting() {
        try {
            const payload = await api(CONFIG.endpoints.routing);

            const data = getData(payload);
            const metrics = data.metrics || data.summary || {};

            metric("activeRoutingRules",
                getValue(metrics, "activeRules", "active_rules"));

            metric("eligibleProviders",
                getValue(metrics, "eligibleProviders", "eligible_providers"));

            metric("failoverEvents",
                getValue(metrics, "failoverEvents", "failover_events"));

            metric("routingExceptions",
                getValue(metrics, "routingExceptions", "routing_exceptions"));

            state.routing = getRecords(
                payload,
                "rules",
                "routingRules",
                "routing_rules",
                "items"
            );

            renderRouting(state.routing);

        } catch (error) {
            $("#routingTable").innerHTML =
                emptyRow(10, "Routing rules could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderRouting(items) {
        $("#routingTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id)}</td>
          <td>${escapeHTML(item.name)}</td>
          <td>${escapeHTML(item.country || "—")}</td>
          <td>${escapeHTML(humanize(item.channel))}</td>
          <td>${escapeHTML(item.currency || "—")}</td>
          <td>${escapeHTML(item.primaryProviderName || item.primary_provider_name || "—")}</td>
          <td>${escapeHTML(item.fallbackProviderName || item.fallback_provider_name || "None")}</td>
          <td>${escapeHTML(item.priority ?? "—")}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-detail-type="routing"
                    data-detail-id="${escapeHTML(item.id)}">
              Review
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(10);
    }

    async function submitRoutingProposal(form) {
        const button = form.querySelector('[type="submit"]');
        const values = formValues(form);

        if (
            values.fallbackProviderId &&
            values.fallbackProviderId === values.primaryProviderId
        ) {
            toast("Primary and fallback providers must be different.", "error");
            return;
        }

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.routingProposals, {
                method: "POST",
                headers: actionHeaders(),
                body: {
                    name: values.name.trim(),
                    country: values.country.trim().toUpperCase(),
                    channel: values.channel,
                    currency: values.currency,
                    primaryProviderId: values.primaryProviderId,
                    fallbackProviderId: values.fallbackProviderId || null,
                    priority: Number(values.priority),
                    reason: values.reason.trim()
                }
            });

            form.reset();
            closeModal($("#routingModal"));

            toast(
                "Routing policy submitted for validation and approval.",
                "success"
            );

            await loadRouting();

        } catch (error) {
            toast(`Routing proposal failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    /* =====================================================
       8. PAYMENT MONITORING
       ===================================================== */

    async function loadPayments() {
        $("#paymentTable").innerHTML =
            emptyRow(10, "Loading payment records...");

        try {
            const payload = await api(
                CONFIG.endpoints.payments + buildQuery({
                    search: $("#paymentSearch").value.trim(),
                    status: $("#paymentStatus").value,
                    providerId: $("#paymentProvider").value,
                    channel: $("#paymentChannel").value,
                    currency: $("#paymentCurrency").value,
                    from: $("#paymentFrom").value,
                    to: $("#paymentTo").value,
                    page: state.paymentPage,
                    pageSize: CONFIG.pageSize
                })
            );

            state.payments = getRecords(
                payload,
                "payments",
                "items",
                "results"
            );

            const data = getData(payload);
            const pagination =
                data.pagination || data.meta?.pagination || data.meta || {};

            state.paymentPage =
                Number(pagination.page || state.paymentPage);

            state.paymentPages =
                Number(
                    pagination.totalPages ||
                    pagination.total_pages ||
                    1
                );

            renderPayments(state.payments);

            $("#paymentPaginationInfo").textContent =
                `Page ${state.paymentPage} of ${state.paymentPages}`;

            $("#previousPayments").disabled =
                state.paymentPage <= 1;

            $("#nextPayments").disabled =
                state.paymentPage >= state.paymentPages;

        } catch (error) {
            $("#paymentTable").innerHTML =
                emptyRow(10, "Payment records could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderPayments(items) {
        $("#paymentTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id)}</td>
          <td>${escapeHTML(item.reference || "—")}</td>
          <td>${escapeHTML(item.providerName || item.provider_name || "—")}</td>
          <td>${escapeHTML(humanize(item.channel))}</td>
          <td>${escapeHTML(formatMoney(item.amount, item.currency))}</td>
          <td>${escapeHTML(item.currency || "—")}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${badge(item.providerStatus || item.provider_status || "unknown")}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-detail-type="payments"
                    data-detail-id="${escapeHTML(item.id)}">
              Investigate
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(10);
    }

    /* =====================================================
       9. MOBILE MONEY
       ===================================================== */

    async function loadMobileMoney() {
        try {
            const payload = await api(CONFIG.endpoints.mobileMoney);

            state.mobileMoney = getRecords(
                payload,
                "channels",
                "mobileMoney",
                "mobile_money",
                "items"
            );

            $("#mobileMoneyTable").innerHTML = state.mobileMoney.length
                ? state.mobileMoney.map(item => `
          <tr>
            <td>${escapeHTML(item.id)}</td>
            <td>${escapeHTML(item.providerName || item.provider_name || item.name)}</td>
            <td>${escapeHTML(item.country || "—")}</td>
            <td>${escapeHTML(
                    Array.isArray(item.currencies)
                        ? item.currencies.join(", ")
                        : item.currencies || "—"
                )}</td>
            <td>${escapeHTML(
                    Array.isArray(item.methods)
                        ? item.methods.map(humanize).join(", ")
                        : item.methods || "—"
                )}</td>
            <td>${badge(item.health || item.healthStatus || item.health_status)}</td>
            <td>${badge(item.status)}</td>
            <td>
              <button data-detail-type="mobileMoney"
                      data-detail-id="${escapeHTML(item.id)}">
                Review
              </button>
            </td>
          </tr>
        `).join("")
                : emptyRow(8);

        } catch (error) {
            $("#mobileMoneyTable").innerHTML =
                emptyRow(8, "Mobile money channels could not be loaded.");

            toast(error.message, "error");
        }
    }

    /* =====================================================
       10. WEBHOOK MANAGEMENT
       ===================================================== */

    async function loadWebhooks() {
        try {
            const payload = await api(
                CONFIG.endpoints.webhooks + buildQuery({
                    search: $("#webhookSearch").value.trim(),
                    status: $("#webhookStatus").value
                })
            );

            const data = getData(payload);
            const metrics = data.metrics || data.summary || {};

            metric("webhookReceived",
                getValue(metrics, "received", "eventsReceived", "events_received"));

            metric("webhookDelivered",
                getValue(metrics, "delivered"));

            metric("webhookFailed",
                getValue(metrics, "failed"));

            metric("signatureFailures",
                getValue(metrics, "signatureFailures", "signature_failures"));

            state.webhooks = getRecords(
                payload,
                "events",
                "webhooks",
                "items"
            );

            renderWebhooks(state.webhooks);

        } catch (error) {
            $("#webhookTable").innerHTML =
                emptyRow(9, "Webhook events could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderWebhooks(items) {
        $("#webhookTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id)}</td>
          <td>${escapeHTML(item.providerName || item.provider_name || "—")}</td>
          <td>${escapeHTML(item.eventType || item.event_type || "—")}</td>
          <td>${escapeHTML(item.reference || item.resourceReference || item.resource_reference || "—")}</td>
          <td>${badge(item.signatureStatus || item.signature_status || "unknown")}</td>
          <td>${escapeHTML(formatDate(item.receivedAt || item.received_at))}</td>
          <td>${formatNumber(item.attempts)}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-detail-type="webhooks"
                    data-detail-id="${escapeHTML(item.id)}">
              Review
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(9);
    }

    /* =====================================================
       11. SETTLEMENTS
       ===================================================== */

    async function loadSettlements() {
        try {
            const payload = await api(
                CONFIG.endpoints.settlements + buildQuery({
                    search: $("#settlementSearch").value.trim(),
                    status: $("#settlementStatus").value,
                    currency: $("#settlementCurrency").value
                })
            );

            state.settlements = getRecords(
                payload,
                "settlements",
                "batches",
                "items"
            );

            renderSettlements(state.settlements);

        } catch (error) {
            $("#settlementTable").innerHTML =
                emptyRow(10, "Settlement records could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderSettlements(items) {
        $("#settlementTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id)}</td>
          <td>${escapeHTML(item.providerName || item.provider_name || "—")}</td>
          <td>${escapeHTML(item.bankReference || item.bank_reference || "—")}</td>
          <td>${escapeHTML(formatMoney(item.grossAmount ?? item.gross_amount, item.currency))}</td>
          <td>${escapeHTML(formatMoney(item.feeAmount ?? item.fee_amount, item.currency))}</td>
          <td>${escapeHTML(formatMoney(item.netAmount ?? item.net_amount, item.currency))}</td>
          <td>${escapeHTML(item.currency || "—")}</td>
          <td>${escapeHTML(formatDate(item.expectedDate || item.expected_date))}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-detail-type="settlements"
                    data-detail-id="${escapeHTML(item.id)}">
              Review
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(10);
    }

    /* =====================================================
       12. CURRENCY AND FX
       ===================================================== */

    async function loadFX() {
        try {
            const [currencyPayload, fxPayload] = await Promise.all([
                api(CONFIG.endpoints.currencies),
                api(CONFIG.endpoints.fxRates)
            ]);

            const currencies = getRecords(
                currencyPayload,
                "currencies",
                "items"
            );

            state.currencies = currencies;
            populateCurrencies();

            $("#currencyTable").innerHTML = currencies.length
                ? currencies.map(item => `
          <tr>
            <td>${escapeHTML(item.code || item.currencyCode || item.currency_code)}</td>
            <td>${escapeHTML(item.name || item.displayName || item.display_name || "—")}</td>
            <td>${escapeHTML(item.decimalPrecision ?? item.decimal_precision ?? "—")}</td>
            <td>${badge(item.paymentStatus || item.payment_status || "unknown")}</td>
            <td>${badge(item.settlementStatus || item.settlement_status || "unknown")}</td>
            <td>${badge(item.status)}</td>
          </tr>
        `).join("")
                : emptyRow(6);

            state.fxRates = getRecords(
                fxPayload,
                "rates",
                "exchangeRates",
                "exchange_rates",
                "items"
            );

            $("#fxTable").innerHTML = state.fxRates.length
                ? state.fxRates.map(item => `
          <tr>
            <td>${escapeHTML(item.baseCurrency || item.base_currency || "—")}</td>
            <td>${escapeHTML(item.quoteCurrency || item.quote_currency || "—")}</td>
            <td>${escapeHTML(formatRate(item.rate))}</td>
            <td>${escapeHTML(item.source || "—")}</td>
            <td>${escapeHTML(humanize(item.rateType || item.rate_type))}</td>
            <td>${escapeHTML(formatDate(item.effectiveAt || item.effective_at))}</td>
            <td>${badge(item.status)}</td>
          </tr>
        `).join("")
                : emptyRow(7);

        } catch (error) {
            $("#currencyTable").innerHTML =
                emptyRow(6, "Currency register unavailable.");

            $("#fxTable").innerHTML =
                emptyRow(7, "Exchange rate records unavailable.");

            toast(error.message, "error");
        }
    }

    async function submitFxProposal(form) {
        const button = form.querySelector('[type="submit"]');
        const values = formValues(form);

        if (values.baseCurrency === values.quoteCurrency) {
            toast("Base and quote currencies must be different.", "error");
            return;
        }

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.fxProposals, {
                method: "POST",
                headers: actionHeaders(),
                body: {
                    baseCurrency: values.baseCurrency,
                    quoteCurrency: values.quoteCurrency,
                    source: values.source.trim(),
                    rateType: values.rateType,
                    effectiveAt: values.effectiveAt,
                    reason: values.reason.trim()
                }
            });

            form.reset();
            closeModal($("#fxModal"));

            toast(
                "FX policy proposal submitted for approval.",
                "success"
            );

            await loadFX();

        } catch (error) {
            toast(`FX proposal failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    /* =====================================================
       13. CREDENTIAL VAULT
       ===================================================== */

    async function loadCredentials() {
        try {
            const payload = await api(CONFIG.endpoints.credentials);

            const data = getData(payload);

            state.credentials = getRecords(
                payload,
                "credentials",
                "items"
            );

            $("#credentialTable").innerHTML = state.credentials.length
                ? state.credentials.map(item => `
          <tr>
            <td>${escapeHTML(item.reference || item.vaultReference || item.vault_reference || item.id)}</td>
            <td>${escapeHTML(item.providerName || item.provider_name || "—")}</td>
            <td>${escapeHTML(humanize(item.type || item.credentialType || item.credential_type))}</td>
            <td>${badge(item.environment)}</td>
            <td>${escapeHTML(formatDate(item.lastRotatedAt || item.last_rotated_at))}</td>
            <td>${escapeHTML(formatDate(item.expiresAt || item.expires_at))}</td>
            <td>${escapeHTML(item.accessPolicy || item.access_policy || "Restricted")}</td>
            <td>${badge(item.status)}</td>
            <td>
              <button data-detail-type="credentials"
                      data-detail-id="${escapeHTML(item.id)}">
                Manage
              </button>
            </td>
          </tr>
        `).join("")
                : emptyRow(9);

            const indicators = getRecords(
                data,
                "indicators",
                "securityIndicators",
                "security_indicators"
            );

            $("#credentialIndicators").innerHTML = indicators.length
                ? indicators.map(item => `
          <div class="summary-row">
            <span>${escapeHTML(item.name || item.label || "Security indicator")}</span>
            ${badge(item.status || item.value)}
          </div>
        `).join("")
                : "No credential security indicators returned.";

        } catch (error) {
            $("#credentialTable").innerHTML =
                emptyRow(9, "Credential metadata unavailable.");

            toast(error.message, "error");
        }
    }

    /* =====================================================
       14. GATEWAY HEALTH
       ===================================================== */

    async function loadHealth() {
        try {
            const payload = await api(CONFIG.endpoints.health);

            const data = getData(payload);
            const metrics = data.metrics || data.summary || {};

            metric("healthyProviders",
                getValue(metrics, "healthy", "healthyProviders", "healthy_providers"));

            metric("degradedProviders",
                getValue(metrics, "degraded", "degradedProviders", "degraded_providers"));

            metric("unavailableProviders",
                getValue(metrics, "unavailable", "unavailableProviders", "unavailable_providers"));

            const latency =
                getValue(metrics, "averageLatencyMs", "average_latency_ms");

            metric("averageLatency",
                latency === undefined ? undefined : `${latency} ms`);

            state.health = getRecords(
                payload,
                "providers",
                "health",
                "items"
            );

            $("#healthTable").innerHTML = state.health.length
                ? state.health.map(item => `
          <tr>
            <td>${escapeHTML(item.providerName || item.provider_name || item.name)}</td>
            <td>${badge(item.environment)}</td>
            <td>${escapeHTML(item.availability ?? "—")}</td>
            <td>${escapeHTML(
                    item.latencyMs === undefined && item.latency_ms === undefined
                        ? "—"
                        : `${item.latencyMs ?? item.latency_ms} ms`
                )}</td>
            <td>${escapeHTML(item.errorRate ?? item.error_rate ?? "—")}</td>
            <td>${escapeHTML(formatDate(item.lastCheckedAt || item.last_checked_at))}</td>
            <td>${escapeHTML(formatDate(item.lastIncidentAt || item.last_incident_at))}</td>
            <td>${badge(item.health || item.status)}</td>
          </tr>
        `).join("")
                : emptyRow(8);

        } catch (error) {
            $("#healthTable").innerHTML =
                emptyRow(8, "Provider health information unavailable.");

            toast(error.message, "error");
        }
    }

    async function refreshHealth() {
        const button = $("#refreshHealth");

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.healthRefresh, {
                method: "POST",
                headers: actionHeaders(),
                body: {
                    requestedBy: "current_authenticated_administrator"
                }
            });

            toast("Health refresh request submitted.", "success");

            await loadHealth();

        } catch (error) {
            toast(`Health refresh failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    /* =====================================================
       15. FAILOVER AND INCIDENT MANAGEMENT
       ===================================================== */

    async function loadFailover() {
        try {
            const [policyPayload, incidentPayload] = await Promise.all([
                api(CONFIG.endpoints.failover),
                api(CONFIG.endpoints.incidents)
            ]);

            state.failover = getRecords(
                policyPayload,
                "policies",
                "items"
            );

            state.incidents = getRecords(
                incidentPayload,
                "incidents",
                "items"
            );

            renderFailover(state.failover);
            renderIncidents(state.incidents);

        } catch (error) {
            $("#failoverTable").innerHTML =
                emptyRow(8, "Failover policies unavailable.");

            $("#incidentTable").innerHTML =
                emptyRow(8, "Infrastructure incidents unavailable.");

            toast(error.message, "error");
        }
    }

    function renderFailover(items) {
        $("#failoverTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id)}</td>
          <td>${escapeHTML(item.primaryProviderName || item.primary_provider_name || "—")}</td>
          <td>${escapeHTML(item.backupProviderName || item.backup_provider_name || "—")}</td>
          <td>${escapeHTML(item.trigger || "—")}</td>
          <td>${escapeHTML(item.country || "Global")} / ${escapeHTML(humanize(item.channel))}</td>
          <td>${escapeHTML(humanize(item.mode))}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-detail-type="failover"
                    data-detail-id="${escapeHTML(item.id)}">
              Review
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(8);
    }

    function renderIncidents(items) {
        $("#incidentTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id)}</td>
          <td>${escapeHTML(item.providerName || item.provider_name || "—")}</td>
          <td>${badge(item.severity)}</td>
          <td>${escapeHTML(item.description || item.title || "—")}</td>
          <td>${escapeHTML(formatDate(item.openedAt || item.opened_at))}</td>
          <td>${escapeHTML(item.owner || item.assignedTo || item.assigned_to || "—")}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-detail-type="incidents"
                    data-detail-id="${escapeHTML(item.id)}">
              Manage
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(8);
    }

    /* =====================================================
       16. INTEGRATION TESTING
       ===================================================== */

    async function loadTests() {
        try {
            const payload = await api(CONFIG.endpoints.tests);

            const data = getData(payload);

            state.tests = getRecords(
                payload,
                "tests",
                "results",
                "items"
            );

            const latest = state.tests[0];

            $("#testSummary").innerHTML = latest
                ? `
          <div class="summary-row">
            <span>Latest test</span>
            <strong>${escapeHTML(latest.id)}</strong>
          </div>
          <div class="summary-row">
            <span>Provider</span>
            <strong>${escapeHTML(latest.providerName || latest.provider_name || "—")}</strong>
          </div>
          <div class="summary-row">
            <span>Test category</span>
            <strong>${escapeHTML(humanize(latest.testType || latest.test_type))}</strong>
          </div>
          <div class="summary-row">
            <span>Result</span>
            ${badge(latest.status || latest.result)}
          </div>
        `
                : "No test results available.";

            $("#testHistoryTable").innerHTML = state.tests.length
                ? state.tests.map(item => `
          <tr>
            <td>${escapeHTML(item.id)}</td>
            <td>${escapeHTML(item.providerName || item.provider_name || "—")}</td>
            <td>${badge(item.environment)}</td>
            <td>${escapeHTML(humanize(item.testType || item.test_type))}</td>
            <td>${badge(item.result || item.status)}</td>
            <td>${escapeHTML(formatDate(item.executedAt || item.executed_at))}</td>
            <td>${escapeHTML(item.executor || item.executedBy || item.executed_by || "—")}</td>
            <td>
              <button data-detail-type="tests"
                      data-detail-id="${escapeHTML(item.id)}">
                Details
              </button>
            </td>
          </tr>
        `).join("")
                : emptyRow(8);

        } catch (error) {
            $("#testHistoryTable").innerHTML =
                emptyRow(8, "Integration test history unavailable.");

            toast(error.message, "error");
        }
    }

    async function runIntegrationTest(form) {
        const button = form.querySelector('[type="submit"]');
        const values = formValues(form);

        if (
            values.environment === "production_health_check" &&
            values.testType !== "connectivity" &&
            values.testType !== "authentication"
        ) {
            toast(
                "Production is restricted to approved non-monetary health checks.",
                "error"
            );
            return;
        }

        button.disabled = true;

        try {
            const payload = await api(CONFIG.endpoints.tests, {
                method: "POST",
                headers: actionHeaders(),
                body: {
                    providerId: values.providerId,
                    environment: values.environment,
                    testType: values.testType,
                    reason: values.reason.trim()
                }
            });

            const result = getData(payload);

            $("#testSummary").innerHTML = `
        <div class="summary-row">
          <span>Test reference</span>
          <strong>${escapeHTML(result.id || result.reference || "Submitted")}</strong>
        </div>
        <div class="summary-row">
          <span>Result</span>
          ${badge(result.status || result.result || "pending")}
        </div>
        <div class="summary-row">
          <span>Message</span>
          <strong>${escapeHTML(result.message || "Test request submitted.")}</strong>
        </div>
      `;

            toast("Integration test request submitted.", "success");

            form.reset();

            await loadTests();

        } catch (error) {
            toast(`Integration test failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    /* =====================================================
       17. INFRASTRUCTURE AUDIT
       ===================================================== */

    async function loadAudit() {
        try {
            const payload = await api(
                CONFIG.endpoints.audit + buildQuery({
                    search: $("#auditSearch").value.trim(),
                    action: $("#auditAction").value,
                    result: $("#auditResult").value
                })
            );

            state.audit = getRecords(
                payload,
                "records",
                "audit",
                "items"
            );

            $("#auditTable").innerHTML = state.audit.length
                ? state.audit.map(item => `
          <tr>
            <td>${escapeHTML(item.id)}</td>
            <td>${escapeHTML(item.administrator || item.actorName || item.actor_name || "—")}</td>
            <td>${escapeHTML(humanize(item.action || item.operation))}</td>
            <td>${escapeHTML(item.resource || item.resourceId || item.resource_id || "—")}</td>
            <td>${badge(item.environment)}</td>
            <td>${escapeHTML(item.reason || "—")}</td>
            <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
            <td>${badge(item.result || item.status)}</td>
            <td>
              <button data-detail-type="audit"
                      data-detail-id="${escapeHTML(item.id)}">
                Details
              </button>
            </td>
          </tr>
        `).join("")
                : emptyRow(9);

        } catch (error) {
            $("#auditTable").innerHTML =
                emptyRow(9, "Infrastructure audit records unavailable.");

            toast(error.message, "error");
        }
    }

    /* =====================================================
       18. RECORD INVESTIGATION
       ===================================================== */

    const DETAIL_ENDPOINTS = {
        providers: CONFIG.endpoints.providers,
        banks: CONFIG.endpoints.banks,
        routing: CONFIG.endpoints.routing,
        payments: CONFIG.endpoints.payments,
        mobileMoney: CONFIG.endpoints.mobileMoney,
        webhooks: CONFIG.endpoints.webhooks,
        settlements: CONFIG.endpoints.settlements,
        credentials: CONFIG.endpoints.credentials,
        failover: CONFIG.endpoints.failover,
        incidents: CONFIG.endpoints.incidents,
        tests: CONFIG.endpoints.tests,
        audit: CONFIG.endpoints.audit
    };

    const DETAIL_FIELDS = [
        ["Reference", ["reference", "id"]],
        ["Name", ["name", "displayName", "display_name"]],
        ["Provider", ["providerName", "provider_name"]],
        ["Institution", ["institutionName", "institution_name"]],
        ["Country", ["country"]],
        ["Channel", ["channel"]],
        ["Environment", ["environment"]],
        ["Status", ["status"]],
        ["Health", ["health", "healthStatus", "health_status"]],
        ["Currency", ["currency"]],
        ["Supported currencies", ["currencies"]],
        ["Supported countries", ["countries"]],
        ["Amount", ["amount"]],
        ["Payment reference", ["paymentReference", "payment_reference"]],
        ["Provider reference", ["providerReference", "provider_reference"]],
        ["Account reference", ["accountReference", "account_reference"]],
        ["Credential reference", ["credentialReference", "credential_reference"]],
        ["Vault reference", ["vaultReference", "vault_reference"]],
        ["Primary provider", ["primaryProviderName", "primary_provider_name"]],
        ["Fallback provider", ["fallbackProviderName", "fallback_provider_name"]],
        ["Priority", ["priority"]],
        ["Routing trigger", ["trigger"]],
        ["Transfer rail", ["rail", "transferRail", "transfer_rail"]],
        ["Event type", ["eventType", "event_type"]],
        ["Signature status", ["signatureStatus", "signature_status"]],
        ["Attempts", ["attempts"]],
        ["Severity", ["severity"]],
        ["Description", ["description"]],
        ["Reason", ["reason"]],
        ["Owner", ["owner", "assignedTo", "assigned_to"]],
        ["Latency", ["latencyMs", "latency_ms"]],
        ["Error rate", ["errorRate", "error_rate"]],
        ["Last checked", ["lastCheckedAt", "last_checked_at"]],
        ["Last rotated", ["lastRotatedAt", "last_rotated_at"]],
        ["Expiry", ["expiresAt", "expires_at"]],
        ["Effective date", ["effectiveAt", "effective_at"]],
        ["Created", ["createdAt", "created_at"]],
        ["Updated", ["updatedAt", "updated_at"]]
    ];

    function detailDisplay(label, value, record) {
        if (Array.isArray(value)) return value.join(", ");

        if (
            label.toLowerCase().includes("date") ||
            ["Created", "Updated", "Last checked", "Last rotated", "Expiry"]
                .includes(label)
        ) {
            return formatDate(value);
        }

        if (label === "Amount") {
            return formatMoney(value, record.currency);
        }

        if (label === "Latency") {
            return `${value} ms`;
        }

        if (typeof value === "object") {
            return JSON.stringify(value);
        }

        return String(value);
    }

    function renderDetailFields(record) {
        return DETAIL_FIELDS.map(([label, keys]) => {
            const value = getValue(record, ...keys);

            if (value === undefined || value === null || value === "") {
                return "";
            }

            return `
        <div class="detail-row">
          <span>${escapeHTML(label)}</span>
          <strong>${escapeHTML(detailDisplay(label, value, record))}</strong>
        </div>
      `;
        }).join("");
    }

    function protectedButton(label, type, id, action, style = "secondary-button") {
        return `
      <button class="${style}"
              data-protected-action
              data-action-type="${escapeHTML(type)}"
              data-action-id="${escapeHTML(id)}"
              data-action="${escapeHTML(action)}">
        ${escapeHTML(label)}
      </button>
    `;
    }

    function getDetailActions(type, record) {
        const id = record.id;

        if (!id) return "";

        const status = String(record.status || "").toLowerCase();
        const actions = [];

        if (type === "providers") {
            if (["inactive", "pending_approval"].includes(status)) {
                actions.push(
                    protectedButton("Request activation", type, id, "request_activation", "primary-button")
                );
            }

            if (status === "active") {
                actions.push(
                    protectedButton("Request suspension", type, id, "request_suspension", "danger-button")
                );
            }
        }

        if (type === "banks" && status === "active") {
            actions.push(
                protectedButton("Request suspension", type, id, "request_suspension", "danger-button")
            );
        }

        if (type === "routing") {
            if (status !== "active") {
                actions.push(
                    protectedButton("Request activation", type, id, "request_activation", "primary-button")
                );
            } else {
                actions.push(
                    protectedButton("Request deactivation", type, id, "request_deactivation", "danger-button")
                );
            }
        }

        if (type === "webhooks" &&
            ["failed", "retrying"].includes(status)) {
            actions.push(
                protectedButton("Request event replay", type, id, "replay", "primary-button")
            );
        }

        if (type === "settlements" &&
            ["pending", "delayed", "discrepancy"].includes(status)) {
            actions.push(
                protectedButton("Request settlement review", type, id, "request_review")
            );
        }

        if (type === "credentials" &&
            !["revoked", "inactive"].includes(status)) {
            actions.push(
                protectedButton("Request credential rotation", type, id, "rotate", "primary-button")
            );
        }

        if (type === "failover") {
            actions.push(
                protectedButton("Request failover activation", type, id, "activate", "danger-button")
            );
        }

        if (type === "incidents" &&
            !["resolved", "closed"].includes(status)) {
            if (status === "open") {
                actions.push(
                    protectedButton("Acknowledge", type, id, "acknowledge")
                );
            }

            actions.push(
                protectedButton("Escalate", type, id, "escalate"),
                protectedButton("Request resolution", type, id, "resolve", "primary-button")
            );
        }

        return actions.join("");
    }

    async function openRecord(type, id) {
        const base = DETAIL_ENDPOINTS[type];

        if (!base) return;

        try {
            const payload = await api(
                `${base}/${encodeURIComponent(id)}`
            );

            const record = getData(payload);

            state.activeRecord = record;
            state.activeRecordType = type;

            $("#detailTitle").textContent =
                `${humanize(type)} — ${record.reference || record.name || record.id || "Record"}`;

            $("#detailContent").innerHTML =
                renderDetailFields(record);

            $("#detailActions").innerHTML = `
        ${getDetailActions(type, record)}
        <button class="secondary-button" data-close-modal>Close</button>
      `;

            showModal("detailModal");

        } catch (error) {
            toast(`Record could not be retrieved: ${error.message}`, "error");
        }
    }

    /* =====================================================
       19. PROTECTED ACTION WORKFLOW
       ===================================================== */

    const ACTION_ENDPOINTS = {
        providers: CONFIG.endpoints.providers,
        banks: CONFIG.endpoints.banks,
        routing: CONFIG.endpoints.routing,
        webhooks: CONFIG.endpoints.webhooks,
        settlements: CONFIG.endpoints.settlements,
        credentials: CONFIG.endpoints.credentials,
        failover: CONFIG.endpoints.failover,
        incidents: CONFIG.endpoints.incidents
    };

    function requestProtectedAction(action) {
        state.pendingAction = action;

        $("#confirmationTitle").textContent =
            `${humanize(action.action)} — ${humanize(action.type)}`;

        $("#confirmationMessage").textContent =
            action.message ||
            "This operation affects payment infrastructure and requires server authorization.";

        $("#confirmationReason").value = "";
        $("#confirmationText").value = "";

        $("#confirmOperation").disabled = true;

        showModal("confirmationModal");
    }

    function validateConfirmation() {
        const reason = $("#confirmationReason").value.trim();
        const confirmation = $("#confirmationText").value.trim();

        $("#confirmOperation").disabled =
            !reason || confirmation !== "CONFIRM";
    }

    function getActionPath(action) {
        const base = ACTION_ENDPOINTS[action.type];

        if (!base || !action.id) {
            throw new Error("Unsupported infrastructure action.");
        }

        if (action.type === "credentials" && action.action === "rotate") {
            return `${base}/${encodeURIComponent(action.id)}/rotation-requests`;
        }

        if (action.type === "webhooks" && action.action === "replay") {
            return `${base}/${encodeURIComponent(action.id)}/replay`;
        }

        return `${base}/${encodeURIComponent(action.id)}/actions`;
    }

    async function executeProtectedAction() {
        const action = state.pendingAction;

        if (!action) return;

        const reason = $("#confirmationReason").value.trim();

        if (
            !reason ||
            $("#confirmationText").value.trim() !== "CONFIRM"
        ) {
            toast("Enter a justification and type CONFIRM.", "error");
            return;
        }

        const button = $("#confirmOperation");

        button.disabled = true;

        try {
            await api(getActionPath(action), {
                method: "POST",
                headers: actionHeaders(),
                body: {
                    action: action.action,
                    reason,
                    source: "global_payment_gateway_centre",
                    expectedRecordVersion: state.activeRecord?.version
                }
            });

            closeModal($("#confirmationModal"));
            closeModal($("#detailModal"));

            state.pendingAction = null;

            toast(
                "Infrastructure operation submitted. Execution depends on backend authorization and any required independent approvals.",
                "success"
            );

            await refreshCurrentSection();

        } catch (error) {
            toast(`Infrastructure operation failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    /* =====================================================
       20. EXPORTS
       ===================================================== */

    const EXPORT_TYPES = new Set([
        "payment_overview",
        "payments",
        "webhooks",
        "settlements",
        "infrastructure_audit"
    ]);

    async function exportRecords(type) {
        if (!EXPORT_TYPES.has(type)) {
            toast("Unsupported export type.", "error");
            return;
        }

        await downloadFile(
            CONFIG.endpoints.exports + buildQuery({
                type,
                format: "csv"
            }),
            `talvora-${type}.csv`
        );
    }

    /* =====================================================
       21. NAVIGATION AND REFRESH
       ===================================================== */

    const LOADERS = {
        overview: loadOverview,
        providers: loadProviders,
        banking: loadBanking,
        routing: loadRouting,
        payments: loadPayments,
        "mobile-money": loadMobileMoney,
        webhooks: loadWebhooks,
        settlements: loadSettlements,
        fx: loadFX,
        credentials: loadCredentials,
        health: loadHealth,
        failover: loadFailover,
        testing: loadTests,
        audit: loadAudit
    };

    function navigate(section) {
        if (!document.getElementById(section)) return;

        state.section = section;

        $$(".content-section").forEach(element => {
            element.classList.toggle(
                "active",
                element.id === section
            );
        });

        $$(".nav-link[data-section]").forEach(link => {
            link.classList.toggle(
                "active",
                link.dataset.section === section
            );
        });

        $("#sidebar").classList.remove("open");

        if (LOADERS[section]) {
            LOADERS[section]();
        }
    }

    async function refreshCurrentSection() {
        const loader = LOADERS[state.section];

        if (loader) await loader();

        await loadOverview();
    }

    async function refreshAll() {
        await Promise.allSettled([
            loadReferenceData(),
            loadOverview()
        ]);

        const loader = LOADERS[state.section];

        if (loader && state.section !== "overview") {
            await loader();
        }
    }

    /* =====================================================
       22. EVENT BINDING
       ===================================================== */

    function bindEvents() {

        /* Navigation */

        $$(".nav-link[data-section]").forEach(link => {
            link.addEventListener("click", event => {
                event.preventDefault();
                navigate(link.dataset.section);
            });
        });

        $$("[data-navigate]").forEach(button => {
            button.addEventListener("click", () => {
                navigate(button.dataset.navigate);
            });
        });

        $("#menuToggle").addEventListener("click", () => {
            $("#sidebar").classList.toggle("open");
        });

        $("#refreshButton").addEventListener(
            "click",
            refreshCurrentSection
        );

        /* Provider management */

        $("#providerSearch").addEventListener(
            "input",
            debounce(loadProviders)
        );

        $("#providerStatus").addEventListener("change", loadProviders);
        $("#providerEnvironment").addEventListener("change", loadProviders);

        $("#addProviderButton").addEventListener("click", () => {
            $("#providerForm").reset();
            showModal("providerModal");
        });

        $("#providerForm").addEventListener("submit", event => {
            event.preventDefault();
            submitProviderProposal(event.currentTarget);
        });

        /* Banking */

        $("#bankSearch").addEventListener(
            "input",
            debounce(loadBanking)
        );

        $("#bankStatus").addEventListener("change", loadBanking);
        $("#bankCountry").addEventListener("change", loadBanking);

        $("#addBankButton").addEventListener("click", () => {
            $("#bankForm").reset();
            showModal("bankModal");
        });

        $("#bankForm").addEventListener("submit", event => {
            event.preventDefault();
            submitBankProposal(event.currentTarget);
        });

        /* Routing */

        $("#addRoutingButton").addEventListener("click", () => {
            $("#routingForm").reset();
            populateCurrencies();
            populateProviders();
            showModal("routingModal");
        });

        $("#routingForm").addEventListener("submit", event => {
            event.preventDefault();
            submitRoutingProposal(event.currentTarget);
        });

        /* Payments */

        const paymentSearch = debounce(() => {
            state.paymentPage = 1;
            loadPayments();
        });

        $("#paymentSearch").addEventListener("input", paymentSearch);

        [
            "paymentStatus",
            "paymentProvider",
            "paymentChannel",
            "paymentCurrency",
            "paymentFrom",
            "paymentTo"
        ].forEach(id => {
            $("#" + id).addEventListener("change", paymentSearch);
        });

        $("#previousPayments").addEventListener("click", () => {
            if (state.paymentPage > 1) {
                state.paymentPage--;
                loadPayments();
            }
        });

        $("#nextPayments").addEventListener("click", () => {
            if (state.paymentPage < state.paymentPages) {
                state.paymentPage++;
                loadPayments();
            }
        });

        /* Mobile money */

        $("#addMobileMoneyButton").addEventListener("click", () => {
            $("#providerForm").reset();
            $("#providerForm").elements.channel.value = "mobile_money";
            showModal("providerModal");
        });

        /* Webhooks */

        $("#webhookSearch").addEventListener(
            "input",
            debounce(loadWebhooks)
        );

        $("#webhookStatus").addEventListener("change", loadWebhooks);

        /* Settlements */

        $("#settlementSearch").addEventListener(
            "input",
            debounce(loadSettlements)
        );

        $("#settlementStatus").addEventListener("change", loadSettlements);
        $("#settlementCurrency").addEventListener("change", loadSettlements);

        /* FX */

        $("#proposeFxButton").addEventListener("click", () => {
            $("#fxForm").reset();
            populateCurrencies();
            showModal("fxModal");
        });

        $("#fxForm").addEventListener("submit", event => {
            event.preventDefault();
            submitFxProposal(event.currentTarget);
        });

        /* Gateway health */

        $("#refreshHealth").addEventListener("click", refreshHealth);

        /* Integration tests */

        $("#integrationTestForm").addEventListener("submit", event => {
            event.preventDefault();
            runIntegrationTest(event.currentTarget);
        });

        /* Audit */

        $("#auditSearch").addEventListener(
            "input",
            debounce(loadAudit)
        );

        $("#auditAction").addEventListener("change", loadAudit);
        $("#auditResult").addEventListener("change", loadAudit);

        /* Exports */

        $("#exportOverview").addEventListener("click", () => {
            exportRecords("payment_overview");
        });

        $("#exportPayments").addEventListener("click", () => {
            exportRecords("payments");
        });

        $("#exportWebhooks").addEventListener("click", () => {
            exportRecords("webhooks");
        });

        $("#exportSettlements").addEventListener("click", () => {
            exportRecords("settlements");
        });

        $("#exportAudit").addEventListener("click", () => {
            exportRecords("infrastructure_audit");
        });

        /* Confirmation */

        $("#confirmationReason").addEventListener(
            "input",
            validateConfirmation
        );

        $("#confirmationText").addEventListener(
            "input",
            validateConfirmation
        );

        $("#confirmOperation").addEventListener(
            "click",
            executeProtectedAction
        );

        /* Dynamic record details */

        document.addEventListener("click", event => {

            const detailButton =
                event.target.closest("[data-detail-type]");

            if (detailButton) {
                openRecord(
                    detailButton.dataset.detailType,
                    detailButton.dataset.detailId
                );
                return;
            }

            const protectedButton =
                event.target.closest("[data-protected-action]");

            if (protectedButton) {
                const action = protectedButton.dataset.action;
                const type = protectedButton.dataset.actionType;

                const messages = {
                    request_activation:
                        "This requests activation of the selected integration or routing configuration.",
                    request_suspension:
                        "This requests suspension of the selected integration.",
                    request_deactivation:
                        "This requests deactivation of the selected routing policy.",
                    replay:
                        "This requests controlled replay of the selected webhook event. Backend idempotency checks remain mandatory.",
                    request_review:
                        "This requests a formal settlement review.",
                    rotate:
                        "This requests secure credential rotation through the server-side vault.",
                    activate:
                        "This requests activation of the selected failover policy.",
                    acknowledge:
                        "This records an administrator acknowledgement of the incident.",
                    escalate:
                        "This requests escalation of the infrastructure incident.",
                    resolve:
                        "This requests incident resolution following backend validation."
                };

                requestProtectedAction({
                    type,
                    id: protectedButton.dataset.actionId,
                    action,
                    message: messages[action] ||
                        "This operation requires payment infrastructure authorization."
                });
            }
        });

        /* Modal close controls */

        document.addEventListener("click", event => {
            const closeButton =
                event.target.closest("[data-close-modal]");

            if (closeButton) {
                closeModal(closeButton.closest(".modal-overlay"));
            }
        });

        $$(".modal-overlay").forEach(modal => {
            modal.addEventListener("click", event => {
                if (event.target === modal) {
                    closeModal(modal);
                }
            });
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closeAllModals();
            }
        });
    }

    /* =====================================================
       23. INITIALIZATION
       ===================================================== */

    async function initialize() {
        bindEvents();

        setConnection("error", "Connecting");
        setEnvironment("unknown");

        await Promise.allSettled([
            loadReferenceData(),
            loadOverview()
        ]);

        if (state.refreshTimer) {
            clearInterval(state.refreshTimer);
        }

        state.refreshTimer = setInterval(() => {
            if (state.section === "overview") {
                loadOverview();
            }
        }, CONFIG.refreshInterval);
    }

    /* =====================================================
       24. PUBLIC MODULE INTERFACE
       ===================================================== */

    window.TALVORA_PAYMENT_GATEWAY = {
        refresh: refreshAll,
        navigate,

        loadOverview,
        loadProviders,
        loadBanking,
        loadRouting,
        loadPayments,
        loadMobileMoney,
        loadWebhooks,
        loadSettlements,
        loadFX,
        loadCredentials,
        loadHealth,
        loadFailover,
        loadTests,
        loadAudit,

        exportRecords,

        config: CONFIG
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, {
            once: true
        });
    } else {
        initialize();
    }

})();
