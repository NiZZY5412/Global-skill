
(() => {
    "use strict";

    /* ==========================================
       TALVORA GLOBAL FINANCIAL OPERATIONS
       ========================================== */

    const DEFAULT_ENDPOINTS = {
        dashboard: "/api/finance/dashboard",
        referenceData: "/api/finance/reference-data",

        transactions: "/api/finance/transactions",
        revenue: "/api/finance/revenue",
        fees: "/api/finance/fee-schedules",
        feeProposals: "/api/finance/fee-schedules/proposals",

        payouts: "/api/finance/payouts",
        refunds: "/api/finance/refunds",
        disputes: "/api/finance/disputes",

        reconciliation: "/api/finance/reconciliation",
        reconciliationPreview: "/api/finance/reconciliation/preview",
        reconciliationCommit: "/api/finance/reconciliation/commit",
        statementPreview: "/api/finance/reconciliation/statements/preview",

        invoices: "/api/finance/invoices",
        controls: "/api/finance/controls",

        reports: "/api/finance/reports",
        reportHistory: "/api/finance/reports/history",

        audit: "/api/finance/audit",
        exports: "/api/finance/exports"
    };

    const shared = window.TALVORA_ADMIN_CONFIG || {};
    const supplied = window.TALVORA_FINANCE_CONFIG || {};

    const CONFIG = {
        apiBaseUrl: supplied.apiBaseUrl || shared.apiBaseUrl || "",
        timeout: supplied.timeout || shared.timeout || 25000,
        refreshInterval: supplied.refreshInterval || shared.refreshInterval || 30000,
        pageSize: supplied.pageSize || shared.pageSize || 25,

        endpoints: {
            ...DEFAULT_ENDPOINTS,
            ...(supplied.endpoints || {})
        }
    };

    const state = {
        section: "overview",

        currencies: [],
        providers: [],

        transactions: [],
        revenue: [],
        fees: [],
        payouts: [],
        refunds: [],
        disputes: [],
        reconciliations: [],
        invoices: [],
        controls: [],
        reports: [],
        audit: [],

        activeRecord: null,
        activeRecordType: null,

        pendingAction: null,
        reconciliationPreview: null,

        transactionPage: 1,
        transactionPages: 1,

        refreshTimer: null
    };

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        [...root.querySelectorAll(selector)];

    /* ==========================================
       1. SAFE UTILITIES
       ========================================== */

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

        if (!currency) {
            return "Currency unavailable";
        }

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

    function metricMoney(value) {
        if (value === null || value === undefined) return "—";

        if (typeof value === "object") {
            if (value.displayValue) return String(value.displayValue);

            return formatMoney(
                value.amount ?? value.value,
                value.currency
            );
        }

        // Monetary figures must include their currency.
        return "Currency unavailable";
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

    function buildQuery(params = {}) {
        const query = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value !== "" && value !== null && value !== undefined) {
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

    function badge(status) {
        return `
      <span class="badge ${safeClass(status)}">
        ${escapeHTML(humanize(status))}
      </span>
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

    function setMetric(id, value, type = "number") {
        const element = document.getElementById(id);

        if (!element) return;

        element.textContent = type === "money"
            ? metricMoney(value)
            : formatNumber(value);
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

    function showModal(id) {
        const modal = document.getElementById(id);

        if (!modal) return;

        modal.hidden = false;
    }

    function closeModal(modal) {
        if (modal) modal.hidden = true;
    }

    function closeAllModals() {
        $$(".modal-overlay").forEach(closeModal);
    }

    function setConnection(status, message) {
        const element = $("#connectionStatus");

        if (!element) return;

        element.className = `connection-status ${status}`;

        element.innerHTML =
            `<i></i>${escapeHTML(message)}`;
    }

    function formValues(form) {
        return Object.fromEntries(
            new FormData(form).entries()
        );
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

    /* ==========================================
       2. SECURE API CLIENT
       ========================================== */

    async function api(path, options = {}) {
        const controller = new AbortController();

        const timeout = setTimeout(
            () => controller.abort(),
            CONFIG.timeout
        );

        const headers = new Headers(options.headers || {});

        headers.set("Accept", "application/json");

        const csrfToken = $('meta[name="csrf-token"]')?.content;

        if (csrfToken) {
            headers.set("X-CSRF-Token", csrfToken);
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
                signal: options.signal || controller.signal
            });

            if (!response.ok) {
                const contentType =
                    response.headers.get("content-type") || "";

                let message =
                    `Financial service error (${response.status})`;

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
                throw new Error(`Download failed (${response.status})`);
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

            toast("Financial export downloaded.", "success");

        } catch (error) {
            toast(`Export error: ${error.message}`, "error");
        }
    }

    /* ==========================================
       3. REFERENCE DATA
       ========================================== */

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

            state.providers = getRecords(
                data,
                "providers",
                "paymentProviders",
                "payment_providers"
            );

            populateCurrencyOptions();
            populateProviderOptions();

        } catch (error) {
            console.warn(
                "[TALVORA Finance] Reference data unavailable:",
                error.message
            );
        }
    }

    function populateCurrencyOptions() {
        const selectors = [
            "#transactionCurrency",
            "#revenueCurrency",
            "#payoutCurrency",
            "#reportCurrency",
            ".currency-options",
            "#reconciliationForm [name='currency']",
            "#statementForm [name='currency']"
        ];

        selectors.forEach(selector => {
            $$(selector).forEach(select => {
                const first = select.options[0];

                select.innerHTML = "";

                if (first) {
                    select.appendChild(first.cloneNode(true));
                }

                state.currencies.forEach(item => {
                    const code = item.code || item.currencyCode ||
                        item.currency_code;

                    if (!code) return;

                    const option = document.createElement("option");

                    option.value = code;
                    option.textContent =
                        `${code} — ${item.name || item.displayName || code}`;

                    select.appendChild(option);
                });
            });
        });
    }

    function populateProviderOptions() {
        const selectors = [
            "#reconciliationForm [name='provider']",
            "#statementForm [name='provider']"
        ];

        selectors.forEach(selector => {
            $$(selector).forEach(select => {
                const first = select.options[0];

                select.innerHTML = "";

                if (first) {
                    select.appendChild(first.cloneNode(true));
                }

                state.providers.forEach(item => {
                    const id = item.id || item.code || item.name;

                    if (!id) return;

                    const option = document.createElement("option");

                    option.value = id;
                    option.textContent = item.name || item.displayName || id;

                    select.appendChild(option);
                });
            });
        });
    }

    /* ==========================================
       4. GLOBAL FINANCIAL DASHBOARD
       ========================================== */

    async function loadOverview() {
        try {
            const payload = await api(CONFIG.endpoints.dashboard);

            const data = getData(payload);

            const metrics = data.metrics || data.summary || {};

            setMetric(
                "grossVolume",
                getValue(metrics, "grossVolume", "gross_volume"),
                "money"
            );

            setMetric(
                "netRevenue",
                getValue(metrics, "netRevenue", "net_revenue"),
                "money"
            );

            setMetric(
                "platformFees",
                getValue(metrics, "platformFees", "platform_fees"),
                "money"
            );

            setMetric(
                "pendingPayouts",
                getValue(metrics, "pendingPayouts", "pending_payouts"),
                "money"
            );

            setMetric(
                "refundExposure",
                getValue(metrics, "refundExposure", "refund_exposure"),
                "money"
            );

            setMetric(
                "chargebackExposure",
                getValue(metrics, "chargebackExposure", "chargeback_exposure"),
                "money"
            );

            setMetric(
                "unreconciledTransactions",
                getValue(metrics, "unreconciledTransactions", "unreconciled_transactions")
            );

            setMetric(
                "outstandingInvoices",
                getValue(metrics, "outstandingInvoices", "outstanding_invoices"),
                "money"
            );

            renderCurrencyBreakdown(
                getRecords(data, "revenueByCurrency", "revenue_by_currency")
            );

            renderFinancialHealth(
                getRecords(data, "financialHealth", "financial_health")
            );

            renderRecentTransactions(
                getRecords(data, "recentTransactions", "recent_transactions")
            );

            renderAlerts(
                getRecords(data, "alerts", "exceptions")
            );

            $("#bannerMessage").textContent =
                data.message ||
                "Financial dashboard information retrieved.";

            setConnection("connected", "Connected");

        } catch (error) {
            setConnection("error", "Connection issue");

            $("#bannerMessage").textContent =
                "Financial dashboard data could not be retrieved.";

            console.error("[TALVORA Finance] Dashboard:", error.message);
        }
    }

    function renderCurrencyBreakdown(items) {
        const container = $("#revenueByCurrency");

        if (!items.length) {
            container.textContent =
                "No revenue breakdown available.";
            return;
        }

        container.innerHTML = items.map(item => `
      <div class="distribution-row">
        <span>
          ${escapeHTML(item.currency || "Unknown currency")}
        </span>

        <strong>
          ${escapeHTML(formatMoney(
            item.amount ?? item.revenue,
            item.currency
        ))}
        </strong>
      </div>
    `).join("");
    }

    function renderFinancialHealth(items) {
        const container = $("#financialHealth");

        if (!items.length) {
            container.textContent =
                "No financial health indicators returned.";
            return;
        }

        container.innerHTML = items.map(item => `
      <div class="summary-row">
        <span>${escapeHTML(item.label || item.name || "Indicator")}</span>
        ${badge(item.status || item.value)}
      </div>
    `).join("");
    }

    function renderRecentTransactions(items) {
        $("#recentTransactions").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.reference || item.id)}</td>
          <td>${escapeHTML(item.accountName || item.account_name || "—")}</td>
          <td>${escapeHTML(humanize(item.type))}</td>
          <td>${escapeHTML(formatMoney(item.amount, item.currency))}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${badge(item.status)}</td>
        </tr>
      `).join("")
            : emptyRow(6);
    }

    function renderAlerts(items) {
        const container = $("#financialAlerts");

        if (!items.length) {
            container.textContent =
                "No financial alerts were returned.";
            return;
        }

        container.innerHTML = items.map(item => `
      <div class="governance-alert">
        <div>
          <strong>${escapeHTML(item.title || item.category || "Financial alert")}</strong>
          <p>${escapeHTML(item.description || "No additional description.")}</p>
        </div>
        ${badge(item.severity || item.status)}
      </div>
    `).join("");
    }

    /* ==========================================
       5. NAVIGATION
       ========================================== */

    const LOADERS = {
        overview: loadOverview,
        transactions: loadTransactions,
        revenue: loadRevenue,
        fees: loadFees,
        payouts: loadPayouts,
        refunds: loadRefunds,
        chargebacks: loadDisputes,
        reconciliation: loadReconciliation,
        invoices: loadInvoices,
        controls: loadControls,
        reports: loadReports,
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

    /* ==========================================
       6. TRANSACTION MANAGEMENT
       ========================================== */

    async function loadTransactions() {
        $("#transactionTable").innerHTML =
            emptyRow(9, "Loading transactions...");

        try {
            const payload = await api(
                CONFIG.endpoints.transactions + buildQuery({
                    search: $("#transactionSearch").value.trim(),
                    status: $("#transactionStatus").value,
                    type: $("#transactionType").value,
                    currency: $("#transactionCurrency").value,
                    from: $("#transactionFrom").value,
                    to: $("#transactionTo").value,
                    page: state.transactionPage,
                    pageSize: CONFIG.pageSize
                })
            );

            state.transactions = getRecords(
                payload,
                "transactions",
                "items",
                "results"
            );

            const data = getData(payload);

            const pagination =
                data.pagination || data.meta?.pagination || data.meta || {};

            state.transactionPage =
                Number(pagination.page || state.transactionPage);

            state.transactionPages =
                Number(
                    pagination.totalPages ||
                    pagination.total_pages ||
                    1
                );

            renderTransactions(state.transactions);

            $("#transactionPaginationInfo").textContent =
                `Page ${state.transactionPage} of ${state.transactionPages}`;

            $("#previousTransactions").disabled =
                state.transactionPage <= 1;

            $("#nextTransactions").disabled =
                state.transactionPage >= state.transactionPages;

        } catch (error) {
            $("#transactionTable").innerHTML =
                emptyRow(9, "Transactions could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderTransactions(items) {
        $("#transactionTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.reference || item.id)}</td>
          <td>${escapeHTML(item.accountName || item.account_name || "—")}</td>
          <td>${escapeHTML(humanize(item.type))}</td>
          <td>${escapeHTML(formatMoney(item.amount, item.currency))}</td>
          <td>${escapeHTML(item.currency || "—")}</td>
          <td>${escapeHTML(item.providerName || item.provider_name || item.provider || "—")}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-detail-type="transactions"
                    data-detail-id="${escapeHTML(item.id)}">
              View
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(9, "No matching transactions.");
    }

    /* ==========================================
       7. REVENUE MANAGEMENT
       ========================================== */

    async function loadRevenue() {
        try {
            const payload = await api(
                CONFIG.endpoints.revenue + buildQuery({
                    search: $("#revenueSearch").value.trim(),
                    status: $("#revenueStatus").value,
                    currency: $("#revenueCurrency").value
                })
            );

            const data = getData(payload);
            const metrics = data.metrics || data.summary || {};

            setMetric("grossRevenue",
                getValue(metrics, "grossRevenue", "gross_revenue"), "money");

            setMetric("recognizedRevenue",
                getValue(metrics, "recognizedRevenue", "recognized_revenue"), "money");

            setMetric("deferredRevenue",
                getValue(metrics, "deferredRevenue", "deferred_revenue"), "money");

            setMetric("revenueAdjustments",
                getValue(metrics, "adjustments", "revenueAdjustments", "revenue_adjustments"), "money");

            state.revenue = getRecords(
                payload,
                "revenue",
                "ledger",
                "items"
            );

            renderRevenue(state.revenue);

        } catch (error) {
            $("#revenueTable").innerHTML =
                emptyRow(7, "Revenue records could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderRevenue(items) {
        $("#revenueTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.reference || item.id)}</td>
          <td>${escapeHTML(item.sourceReference || item.source_reference || "—")}</td>
          <td>${escapeHTML(humanize(item.category || item.type))}</td>
          <td>${escapeHTML(formatMoney(item.amount, item.currency))}</td>
          <td>${escapeHTML(item.currency || "—")}</td>
          <td>${escapeHTML(formatDate(item.accountingDate || item.accounting_date))}</td>
          <td>${badge(item.status)}</td>
        </tr>
      `).join("")
            : emptyRow(7);
    }

    /* ==========================================
       8. FEES AND COMMISSIONS
       ========================================== */

    async function loadFees() {
        try {
            const payload = await api(CONFIG.endpoints.fees);

            state.fees = getRecords(
                payload,
                "feeSchedules",
                "fee_schedules",
                "items"
            );

            renderFees(state.fees);

        } catch (error) {
            $("#feeScheduleTable").innerHTML =
                emptyRow(9, "Fee schedules could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderFees(items) {
        $("#feeScheduleTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id)}</td>
          <td>${escapeHTML(item.name)}</td>
          <td>${escapeHTML(humanize(item.transactionType || item.transaction_type))}</td>
          <td>${escapeHTML(item.currency || "—")}</td>
          <td>${escapeHTML(item.percentageRate ?? item.percentage_rate ?? "—")}%</td>
          <td>${escapeHTML(formatMoney(item.fixedFee ?? item.fixed_fee, item.currency))}</td>
          <td>${escapeHTML(formatDate(item.effectiveDate || item.effective_date))}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-propose-fee="${escapeHTML(item.id)}">
              Propose revision
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(9);
    }

    function openFeeModal(item = null) {
        const form = $("#feeForm");

        form.reset();

        $("#feeModalTitle").textContent =
            item ? "Propose Fee Schedule Revision" : "Propose Fee Schedule";

        if (item) {
            form.elements.feeId.value = item.id;
            form.elements.name.value = item.name || "";
            form.elements.transactionType.value =
                item.transactionType || item.transaction_type || "";
            form.elements.currency.value = item.currency || "";
            form.elements.percentageRate.value =
                item.percentageRate ?? item.percentage_rate ?? "";
            form.elements.fixedFee.value =
                item.fixedFee ?? item.fixed_fee ?? "";
            form.elements.effectiveDate.value =
                (item.effectiveDate || item.effective_date || "").slice(0, 10);
        }

        showModal("feeModal");
    }

    async function saveFeeProposal(form) {
        const button = form.querySelector('[type="submit"]');
        const values = formValues(form);

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.feeProposals, {
                method: "POST",
                body: {
                    feeScheduleId: values.feeId || null,
                    name: values.name,
                    transactionType: values.transactionType,
                    currency: values.currency,
                    percentageRate: Number(values.percentageRate),
                    fixedFee: Number(values.fixedFee),
                    effectiveDate: values.effectiveDate,
                    reason: values.reason
                }
            });

            form.reset();
            closeModal($("#feeModal"));

            toast(
                "Fee policy proposal submitted for independent approval.",
                "success"
            );

            await loadFees();

        } catch (error) {
            toast(`Fee proposal failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    /* ==========================================
       9. PAYOUT MANAGEMENT
       ========================================== */

    async function loadPayouts() {
        try {
            const payload = await api(
                CONFIG.endpoints.payouts + buildQuery({
                    search: $("#payoutSearch").value.trim(),
                    status: $("#payoutStatus").value,
                    currency: $("#payoutCurrency").value
                })
            );

            state.payouts = getRecords(
                payload,
                "payouts",
                "items"
            );

            renderPayouts(state.payouts);

        } catch (error) {
            $("#payoutTable").innerHTML =
                emptyRow(8, "Payout records could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderPayouts(items) {
        $("#payoutTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.reference || item.id)}</td>
          <td>${escapeHTML(item.beneficiaryName || item.beneficiary_name || "—")}</td>
          <td>${escapeHTML(formatMoney(item.amount, item.currency))}</td>
          <td>${escapeHTML(item.currency || "—")}</td>
          <td>${escapeHTML(item.destinationLabel || item.destination_label || "Protected destination")}</td>
          <td>${escapeHTML(formatDate(item.requestedAt || item.requested_at))}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-detail-type="payouts"
                    data-detail-id="${escapeHTML(item.id)}">
              Review
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(8);
    }

    /* ==========================================
       10. REFUND MANAGEMENT
       ========================================== */

    async function loadRefunds() {
        try {
            const payload = await api(
                CONFIG.endpoints.refunds + buildQuery({
                    search: $("#refundSearch").value.trim(),
                    status: $("#refundStatus").value
                })
            );

            state.refunds = getRecords(
                payload,
                "refunds",
                "items"
            );

            renderRefunds(state.refunds);

        } catch (error) {
            $("#refundTable").innerHTML =
                emptyRow(9, "Refund records could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderRefunds(items) {
        $("#refundTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.reference || item.id)}</td>
          <td>${escapeHTML(item.originalTransaction || item.original_transaction || "—")}</td>
          <td>${escapeHTML(item.accountName || item.account_name || "—")}</td>
          <td>${escapeHTML(formatMoney(item.amount, item.currency))}</td>
          <td>${escapeHTML(item.currency || "—")}</td>
          <td>${escapeHTML(item.reason || "—")}</td>
          <td>${escapeHTML(formatDate(item.requestedAt || item.requested_at))}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-detail-type="refunds"
                    data-detail-id="${escapeHTML(item.id)}">
              Review
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(9);
    }

    /* ==========================================
       11. CHARGEBACKS AND DISPUTES
       ========================================== */

    async function loadDisputes() {
        try {
            const payload = await api(
                CONFIG.endpoints.disputes + buildQuery({
                    search: $("#disputeSearch").value.trim(),
                    status: $("#disputeStatus").value
                })
            );

            const data = getData(payload);
            const metrics = data.metrics || data.summary || {};

            state.disputes = getRecords(
                payload,
                "disputes",
                "cases",
                "items"
            );

            setMetric("openDisputes",
                getValue(metrics, "openDisputes", "open_disputes"));

            setMetric("disputedAmount",
                getValue(metrics, "disputedAmount", "disputed_amount"), "money");

            setMetric("evidenceRequired",
                getValue(metrics, "evidenceRequired", "evidence_required"));

            setMetric("disputeDeadlines",
                getValue(metrics, "upcomingDeadlines", "upcoming_deadlines"));

            renderDisputes(state.disputes);

        } catch (error) {
            $("#disputeTable").innerHTML =
                emptyRow(8, "Dispute records could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderDisputes(items) {
        $("#disputeTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.reference || item.id)}</td>
          <td>${escapeHTML(item.transactionReference || item.transaction_reference || "—")}</td>
          <td>${escapeHTML(formatMoney(item.amount, item.currency))}</td>
          <td>${escapeHTML(item.currency || "—")}</td>
          <td>${escapeHTML(item.reason || "—")}</td>
          <td>${escapeHTML(formatDate(item.deadline || item.dueAt || item.due_at))}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-detail-type="disputes"
                    data-detail-id="${escapeHTML(item.id)}">
              Investigate
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(8);
    }

    /* ==========================================
       12. RECONCILIATION
       ========================================== */

    async function loadReconciliation() {
        try {
            const payload = await api(CONFIG.endpoints.reconciliation);

            state.reconciliations = getRecords(
                payload,
                "reconciliations",
                "runs",
                "items"
            );

            renderReconciliations(state.reconciliations);

        } catch (error) {
            $("#reconciliationTable").innerHTML =
                emptyRow(8, "Reconciliation history could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderReconciliations(items) {
        $("#reconciliationTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || item.reference)}</td>
          <td>${escapeHTML(item.providerName || item.provider_name || item.provider || "—")}</td>
          <td>${escapeHTML(item.period || "—")}</td>
          <td>${escapeHTML(item.currency || "—")}</td>
          <td>${formatNumber(item.matched ?? item.matchedCount ?? item.matched_count)}</td>
          <td>${formatNumber(item.unmatched ?? item.unmatchedCount ?? item.unmatched_count)}</td>
          <td>${formatNumber(item.discrepancies ?? item.discrepancyCount ?? item.discrepancy_count)}</td>
          <td>${badge(item.status)}</td>
        </tr>
      `).join("")
            : emptyRow(8);
    }

    function validateDateRange(from, to) {
        if (!from || !to) {
            throw new Error("Both reconciliation dates are required.");
        }

        if (from > to) {
            throw new Error("The start date cannot be after the end date.");
        }

        if (to > new Date().toISOString().slice(0, 10)) {
            throw new Error("The end date cannot be in the future.");
        }
    }

    async function runReconciliation(form) {
        const button = form.querySelector('[type="submit"]');
        const values = formValues(form);

        try {
            validateDateRange(values.fromDate, values.toDate);
        } catch (error) {
            toast(error.message, "error");
            return;
        }

        button.disabled = true;

        try {
            const payload = await api(
                CONFIG.endpoints.reconciliationPreview,
                {
                    method: "POST",
                    body: values
                }
            );

            const data = getData(payload);

            state.reconciliationPreview = data;

            renderReconciliationPreview(data);

            showModal("reconciliationModal");

        } catch (error) {
            toast(`Reconciliation preview failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    function renderReconciliationPreview(data) {
        const fields = [
            ["Preview reference", data.previewId || data.preview_id || data.id],
            ["Provider", data.providerName || data.provider_name || data.provider],
            ["Period", data.period],
            ["Currency", data.currency],
            ["Total entries", data.totalEntries ?? data.total_entries],
            ["Matched entries", data.matched ?? data.matchedCount ?? data.matched_count],
            ["Unmatched entries", data.unmatched ?? data.unmatchedCount ?? data.unmatched_count],
            ["Discrepancies", data.discrepancies ?? data.discrepancyCount ?? data.discrepancy_count],
            ["Total difference", data.difference === undefined
                ? undefined
                : formatMoney(data.difference, data.currency)],
            ["Approval required", data.approvalRequired ?? data.approval_required]
        ];

        $("#reconciliationPreview").innerHTML = `
      <div class="summary-list">
        ${fields.filter(([, value]) => value !== undefined && value !== null)
                .map(([label, value]) => `
            <div class="summary-row">
              <span>${escapeHTML(label)}</span>
              <strong>${escapeHTML(
                    typeof value === "boolean"
                        ? (value ? "Yes" : "No")
                        : value
                )}</strong>
            </div>
          `).join("")}
      </div>
    `;

        let reasonField = $("#reconciliationReason");

        if (!reasonField) {
            const wrapper = document.createElement("label");

            wrapper.innerHTML = `
        Submission reason *
        <textarea id="reconciliationReason" rows="3"
                  placeholder="Explain the reconciliation submission"></textarea>
      `;

            $("#reconciliationModal").querySelector(".modal-note")
                .before(wrapper);

            reasonField = $("#reconciliationReason");
        }

        reasonField.value = "";

        const previewId =
            data.previewId || data.preview_id || data.id;

        $("#submitReconciliation").disabled =
            !previewId ||
            data.valid === false ||
            data.canSubmit === false ||
            data.can_submit === false;
    }

    async function submitReconciliation() {
        const data = state.reconciliationPreview;

        if (!data) return;

        const previewId =
            data.previewId || data.preview_id || data.id;

        const reason = $("#reconciliationReason")?.value.trim();

        if (!previewId || !reason) {
            toast("A valid preview and submission reason are required.", "error");
            return;
        }

        const button = $("#submitReconciliation");

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.reconciliationCommit, {
                method: "POST",
                body: {
                    previewId,
                    previewToken: data.previewToken || data.preview_token,
                    reason
                }
            });

            closeModal($("#reconciliationModal"));

            state.reconciliationPreview = null;

            toast(
                "Reconciliation submitted for financial approval.",
                "success"
            );

            await Promise.all([
                loadReconciliation(),
                loadOverview()
            ]);

        } catch (error) {
            toast(`Reconciliation submission failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    async function previewStatement(form) {
        const button = form.querySelector('[type="submit"]');
        const file = $("#statementFile").files[0];

        if (!file) {
            toast("Select a financial statement file.", "error");
            return;
        }

        const allowedExtensions = [".csv", ".xlsx", ".ofx"];

        const extension =
            file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

        if (!allowedExtensions.includes(extension)) {
            toast("Unsupported statement format.", "error");
            return;
        }

        const values = formValues(form);
        const body = new FormData();

        body.append("statement", file);
        body.append("provider", values.provider);
        body.append("currency", values.currency);
        body.append("period", values.period);

        button.disabled = true;

        try {
            const payload = await api(CONFIG.endpoints.statementPreview, {
                method: "POST",
                body
            });

            const data = getData(payload);

            state.reconciliationPreview = {
                ...data,
                importType: "statement"
            };

            renderReconciliationPreview(state.reconciliationPreview);

            showModal("reconciliationModal");

        } catch (error) {
            toast(`Statement validation failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    /* ==========================================
       13. INVOICING AND BILLING
       ========================================== */

    async function loadInvoices() {
        try {
            const payload = await api(
                CONFIG.endpoints.invoices + buildQuery({
                    search: $("#invoiceSearch").value.trim(),
                    status: $("#invoiceStatus").value
                })
            );

            state.invoices = getRecords(
                payload,
                "invoices",
                "items"
            );

            renderInvoices(state.invoices);

        } catch (error) {
            $("#invoiceTable").innerHTML =
                emptyRow(9, "Invoice records could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderInvoices(items) {
        $("#invoiceTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.reference || item.invoiceNumber || item.invoice_number || item.id)}</td>
          <td>${escapeHTML(item.accountName || item.account_name || "—")}</td>
          <td>${escapeHTML(formatDate(item.issueDate || item.issue_date))}</td>
          <td>${escapeHTML(formatDate(item.dueDate || item.due_date))}</td>
          <td>${escapeHTML(formatMoney(item.total, item.currency))}</td>
          <td>${escapeHTML(formatMoney(item.paidAmount ?? item.paid_amount, item.currency))}</td>
          <td>${escapeHTML(formatMoney(item.balance, item.currency))}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-detail-type="invoices"
                    data-detail-id="${escapeHTML(item.id)}">
              View
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(9);
    }

    /* ==========================================
       14. FINANCIAL CONTROLS
       ========================================== */

    async function loadControls() {
        try {
            const payload = await api(CONFIG.endpoints.controls);

            const data = getData(payload);

            state.controls = getRecords(
                data,
                "approvalMatrix",
                "approval_matrix",
                "policies"
            );

            renderApprovalMatrix(state.controls);

            renderControlIndicators(
                getRecords(data, "indicators", "financialControls", "financial_controls")
            );

        } catch (error) {
            $("#approvalMatrix").innerHTML =
                emptyRow(6, "Financial authorization policies unavailable.");

            toast(error.message, "error");
        }
    }

    function renderApprovalMatrix(items) {
        $("#approvalMatrix").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(humanize(item.operation || item.action))}</td>
          <td>${escapeHTML(item.initiationRole || item.initiation_role || "—")}</td>
          <td>${escapeHTML(item.firstApprovalRole || item.first_approval_role || "—")}</td>
          <td>${escapeHTML(item.secondApprovalRole || item.second_approval_role || "—")}</td>
          <td>
            ${item.limitAmount !== undefined || item.limit_amount !== undefined
                    ? escapeHTML(formatMoney(
                        item.limitAmount ?? item.limit_amount,
                        item.currency
                    ))
                    : "—"}
          </td>
          <td>${badge(item.status)}</td>
        </tr>
      `).join("")
            : emptyRow(6);
    }

    function renderControlIndicators(items) {
        const container = $("#financialControls");

        container.innerHTML = items.length
            ? items.map(item => `
        <div class="summary-row">
          <span>${escapeHTML(item.name || item.label || "Financial control")}</span>
          ${badge(item.status || item.value)}
        </div>
      `).join("")
            : "No financial control indicators returned.";
    }

    /* ==========================================
       15. FINANCIAL REPORTS
       ========================================== */

    async function loadReports() {
        try {
            const payload = await api(CONFIG.endpoints.reportHistory);

            state.reports = getRecords(
                payload,
                "reports",
                "items"
            );

            renderReportHistory(state.reports);

        } catch (error) {
            $("#reportHistoryTable").innerHTML =
                emptyRow(7, "Report history could not be loaded.");
        }
    }

    function renderReportHistory(items) {
        $("#reportHistoryTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || item.reference)}</td>
          <td>${escapeHTML(humanize(item.type || item.reportType || item.report_type))}</td>
          <td>${escapeHTML(item.period || "—")}</td>
          <td>${escapeHTML(item.requestedBy || item.requested_by || "—")}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${badge(item.status)}</td>
          <td>
            ${item.status === "completed"
                    ? `<button data-download-report="${escapeHTML(item.id)}">Download</button>`
                    : "—"}
          </td>
        </tr>
      `).join("")
            : emptyRow(7);
    }

    async function generateReport(form) {
        const button = form.querySelector('[type="submit"]');
        const values = formValues(form);

        try {
            validateDateRange(values.fromDate, values.toDate);
        } catch (error) {
            toast(error.message, "error");
            return;
        }

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.reports, {
                method: "POST",
                body: values
            });

            toast(
                "Financial report generation submitted.",
                "success"
            );

            await loadReports();

        } catch (error) {
            toast(`Report generation failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    /* ==========================================
       16. FINANCIAL AUDIT
       ========================================== */

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

            renderAudit(state.audit);

        } catch (error) {
            $("#auditTable").innerHTML =
                emptyRow(9, "Financial audit records could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderAudit(items) {
        $("#auditTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || item.reference)}</td>
          <td>${escapeHTML(item.administrator || item.actorName || item.actor_name || "—")}</td>
          <td>${escapeHTML(humanize(item.action || item.operation))}</td>
          <td>${escapeHTML(item.financialReference || item.financial_reference || "—")}</td>
          <td>${escapeHTML(formatMoney(item.amount, item.currency))}</td>
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
    }

    /* ==========================================
       17. FINANCIAL RECORD DETAILS
       ========================================== */

    const DETAIL_ENDPOINTS = {
        transactions: CONFIG.endpoints.transactions,
        payouts: CONFIG.endpoints.payouts,
        refunds: CONFIG.endpoints.refunds,
        disputes: CONFIG.endpoints.disputes,
        invoices: CONFIG.endpoints.invoices,
        audit: CONFIG.endpoints.audit,
        fees: CONFIG.endpoints.fees
    };

    const DETAIL_FIELDS = [
        ["Reference", ["reference", "id"]],
        ["Transaction reference", ["transactionReference", "transaction_reference"]],
        ["Account", ["accountName", "account_name"]],
        ["Beneficiary", ["beneficiaryName", "beneficiary_name"]],
        ["Type", ["type", "category"]],
        ["Status", ["status"]],
        ["Amount", ["amount"]],
        ["Currency", ["currency"]],
        ["Gross amount", ["grossAmount", "gross_amount"]],
        ["Net amount", ["netAmount", "net_amount"]],
        ["Fee amount", ["feeAmount", "fee_amount"]],
        ["Provider", ["providerName", "provider_name", "provider"]],
        ["Provider reference", ["providerReference", "provider_reference"]],
        ["Reason", ["reason"]],
        ["Description", ["description"]],
        ["Approval status", ["approvalStatus", "approval_status"]],
        ["Requested date", ["requestedAt", "requested_at"]],
        ["Settlement date", ["settledAt", "settled_at"]],
        ["Due date", ["dueAt", "due_at"]],
        ["Created", ["createdAt", "created_at"]],
        ["Accounting date", ["accountingDate", "accounting_date"]],
        ["Period", ["period"]],
        ["Effective date", ["effectiveDate", "effective_date"]]
    ];

    function detailValue(record, keys) {
        return getValue(record, ...keys);
    }

    function renderDetailFields(record) {
        return DETAIL_FIELDS.map(([label, keys]) => {
            const value = detailValue(record, keys);

            if (value === undefined || value === null || value === "") {
                return "";
            }

            let display = value;

            if (label === "Amount" ||
                label === "Gross amount" ||
                label === "Net amount" ||
                label === "Fee amount") {
                display = formatMoney(value, record.currency);
            } else if (
                label.includes("date") ||
                label === "Created" ||
                label === "Requested date" ||
                label === "Settlement date" ||
                label === "Due date"
            ) {
                display = formatDate(value);
            } else if (label === "Type" || label === "Status" || label === "Approval status") {
                display = humanize(value);
            }

            return `
        <div class="detail-row">
          <span>${escapeHTML(label)}</span>
          <strong>${escapeHTML(display)}</strong>
        </div>
      `;
        }).join("");
    }

    function detailActionButton(label, kind, id, action, style = "secondary-button") {
        return `
      <button class="${style}"
              data-protected-action
              data-action-kind="${escapeHTML(kind)}"
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

        if (type === "payouts") {
            const actions = [];

            if (["pending", "under_review"].includes(status)) {
                actions.push(
                    detailActionButton("Approve payout", "payout", id, "approve", "primary-button"),
                    detailActionButton("Hold payout", "payout", id, "hold", "danger-button"),
                    detailActionButton("Reject payout", "payout", id, "reject")
                );
            }

            if (status === "approved") {
                actions.push(
                    detailActionButton("Release payout", "payout", id, "release", "primary-button"),
                    detailActionButton("Hold payout", "payout", id, "hold", "danger-button")
                );
            }

            return actions.join("");
        }

        if (type === "refunds" &&
            ["pending", "under_review"].includes(status)) {
            return [
                detailActionButton("Approve refund", "refund", id, "approve", "primary-button"),
                detailActionButton("Reject refund", "refund", id, "reject", "danger-button")
            ].join("");
        }

        if (type === "disputes" &&
            !["won", "lost", "closed"].includes(status)) {
            return [
                detailActionButton("Submit evidence", "dispute", id, "submit_evidence"),
                detailActionButton("Contest dispute", "dispute", id, "contest", "primary-button"),
                detailActionButton("Accept dispute", "dispute", id, "accept", "danger-button")
            ].join("");
        }

        return "";
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

            const title =
                record.reference ||
                record.invoiceNumber ||
                record.invoice_number ||
                record.name ||
                record.id ||
                "Financial record";

            $("#detailTitle").textContent =
                `${humanize(type)} — ${title}`;

            $("#detailContent").innerHTML =
                renderDetailFields(record);

            $("#detailActions").innerHTML = `
        ${getDetailActions(type, record)}
        <button class="secondary-button" data-close-modal>Close</button>
      `;

            showModal("detailModal");

        } catch (error) {
            toast(`Financial record unavailable: ${error.message}`, "error");
        }
    }

    /* ==========================================
       18. PROTECTED FINANCIAL ACTIONS
       ========================================== */

    function requestProtectedAction(action) {
        state.pendingAction = action;

        $("#confirmationTitle").textContent =
            action.title || "Confirm financial operation";

        $("#confirmationMessage").textContent =
            action.message ||
            "This financial operation will be submitted to backend authorization.";

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

    function actionEndpoint(action) {
        const routes = {
            payout: CONFIG.endpoints.payouts,
            refund: CONFIG.endpoints.refunds,
            dispute: CONFIG.endpoints.disputes
        };

        const base = routes[action.kind];

        if (!base || !action.id) {
            throw new Error("Unsupported financial action.");
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
            toast("A reason and exact confirmation are required.", "error");
            return;
        }

        const button = $("#confirmOperation");

        button.disabled = true;

        try {
            const headers = {};

            if (window.crypto?.randomUUID) {
                headers["Idempotency-Key"] = window.crypto.randomUUID();
            }

            await api(actionEndpoint(action), {
                method: "POST",
                headers,
                body: {
                    action: action.action,
                    reason,
                    source: "global_financial_operations",
                    expectedRecordVersion: action.recordVersion
                }
            });

            closeModal($("#confirmationModal"));
            closeModal($("#detailModal"));

            state.pendingAction = null;

            toast(
                "Financial operation submitted. Final execution depends on backend authorization and required approvals.",
                "success"
            );

            await refreshCurrentSection();

        } catch (error) {
            toast(`Financial operation failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    /* ==========================================
       19. EXPORTS AND REPORT DOWNLOADS
       ========================================== */

    const EXPORT_TYPES = new Set([
        "financial_overview",
        "transactions",
        "revenue",
        "payouts",
        "financial_audit"
    ]);

    async function exportRecords(type) {
        if (!EXPORT_TYPES.has(type)) {
            toast("Unsupported financial export type.", "error");
            return;
        }

        const filename = `talvora-${type}.csv`;

        await downloadFile(
            CONFIG.endpoints.exports + buildQuery({
                type,
                format: "csv"
            }),
            filename
        );
    }

    async function downloadReport(id) {
        if (!id) return;

        try {
            await downloadFile(
                `${CONFIG.endpoints.reports}/${encodeURIComponent(id)}/download`,
                `talvora-financial-report-${id}`
            );
        } catch (error) {
            toast(`Report download failed: ${error.message}`, "error");
        }
    }

    /* ==========================================
       20. REFRESH
       ========================================== */

    async function refreshCurrentSection() {
        const loader = LOADERS[state.section];

        if (loader) {
            await loader();
        }

        await loadOverview();
    }

    async function refreshAll() {
        setConnection("error", "Refreshing");

        await Promise.allSettled([
            loadOverview(),
            loadReferenceData()
        ]);

        const loader = LOADERS[state.section];

        if (loader && state.section !== "overview") {
            await loader();
        }
    }

    /* ==========================================
       21. EVENT BINDING
       ========================================== */

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

        /* Refresh */

        $("#refreshButton").addEventListener(
            "click",
            refreshCurrentSection
        );

        /* Transactions */

        const transactionSearch = debounce(() => {
            state.transactionPage = 1;
            loadTransactions();
        });

        $("#transactionSearch").addEventListener("input", transactionSearch);

        [
            "transactionStatus",
            "transactionType",
            "transactionCurrency",
            "transactionFrom",
            "transactionTo"
        ].forEach(id => {
            $("#" + id).addEventListener("change", transactionSearch);
        });

        $("#previousTransactions").addEventListener("click", () => {
            if (state.transactionPage > 1) {
                state.transactionPage--;
                loadTransactions();
            }
        });

        $("#nextTransactions").addEventListener("click", () => {
            if (state.transactionPage < state.transactionPages) {
                state.transactionPage++;
                loadTransactions();
            }
        });

        /* Revenue */

        $("#revenueSearch").addEventListener(
            "input",
            debounce(loadRevenue)
        );

        $("#revenueStatus").addEventListener("change", loadRevenue);
        $("#revenueCurrency").addEventListener("change", loadRevenue);

        /* Fees */

        $("#createFeeButton").addEventListener("click", () => {
            openFeeModal();
        });

        $("#feeForm").addEventListener("submit", event => {
            event.preventDefault();
            saveFeeProposal(event.currentTarget);
        });

        /* Payouts */

        $("#payoutSearch").addEventListener(
            "input",
            debounce(loadPayouts)
        );

        $("#payoutStatus").addEventListener("change", loadPayouts);
        $("#payoutCurrency").addEventListener("change", loadPayouts);

        /* Refunds */

        $("#refundSearch").addEventListener(
            "input",
            debounce(loadRefunds)
        );

        $("#refundStatus").addEventListener("change", loadRefunds);

        /* Disputes */

        $("#disputeSearch").addEventListener(
            "input",
            debounce(loadDisputes)
        );

        $("#disputeStatus").addEventListener("change", loadDisputes);

        /* Reconciliation */

        $("#reconciliationForm").addEventListener("submit", event => {
            event.preventDefault();
            runReconciliation(event.currentTarget);
        });

        $("#statementForm").addEventListener("submit", event => {
            event.preventDefault();
            previewStatement(event.currentTarget);
        });

        $("#submitReconciliation").addEventListener(
            "click",
            submitReconciliation
        );

        /* Invoices */

        $("#invoiceSearch").addEventListener(
            "input",
            debounce(loadInvoices)
        );

        $("#invoiceStatus").addEventListener("change", loadInvoices);

        /* Reports */

        $("#reportForm").addEventListener("submit", event => {
            event.preventDefault();
            generateReport(event.currentTarget);
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
            exportRecords("financial_overview");
        });

        $("#exportTransactions").addEventListener("click", () => {
            exportRecords("transactions");
        });

        $("#exportRevenue").addEventListener("click", () => {
            exportRecords("revenue");
        });

        $("#exportPayouts").addEventListener("click", () => {
            exportRecords("payouts");
        });

        $("#exportAudit").addEventListener("click", () => {
            exportRecords("financial_audit");
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

        /* Dynamic controls */

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

            const feeButton =
                event.target.closest("[data-propose-fee]");

            if (feeButton) {
                const item = state.fees.find(
                    fee => String(fee.id) === String(feeButton.dataset.proposeFee)
                );

                if (item) openFeeModal(item);
                return;
            }

            const protectedButton =
                event.target.closest("[data-protected-action]");

            if (protectedButton) {
                const kind = protectedButton.dataset.actionKind;
                const action = protectedButton.dataset.action;

                const messages = {
                    approve: "This requests financial approval. Additional approval may be required.",
                    release: "This requests payout release through the authorized payment workflow.",
                    hold: "This requests a hold on the selected financial operation.",
                    reject: "This requests rejection of the financial operation.",
                    contest: "This requests submission of a dispute response.",
                    accept: "This requests acceptance of the dispute outcome.",
                    submit_evidence: "This requests submission of supporting dispute evidence."
                };

                requestProtectedAction({
                    kind,
                    id: protectedButton.dataset.actionId,
                    action,
                    recordVersion: state.activeRecord?.version,
                    title: `${humanize(action)} ${humanize(kind)}`,
                    message: messages[action] || "This operation requires financial authorization."
                });

                return;
            }

            const reportButton =
                event.target.closest("[data-download-report]");

            if (reportButton) {
                downloadReport(reportButton.dataset.downloadReport);
            }
        });

        /* Modal closing */

        document.addEventListener("click", event => {
            const closeButton = event.target.closest("[data-close-modal]");

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

    /* ==========================================
       22. INITIALIZATION
       ========================================== */

    async function initialize() {
        bindEvents();

        setConnection("error", "Connecting");

        await Promise.allSettled([
            loadOverview(),
            loadReferenceData()
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

    /* ==========================================
       23. PUBLIC MODULE INTERFACE
       ========================================== */

    window.TALVORA_FINANCE = {
        refresh: refreshAll,
        navigate,

        loadOverview,
        loadTransactions,
        loadRevenue,
        loadFees,
        loadPayouts,
        loadRefunds,
        loadDisputes,
        loadReconciliation,
        loadInvoices,
        loadControls,
        loadReports,
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
