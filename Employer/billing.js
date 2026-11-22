/* =========================================================
   TALVORA MODULE 10
   EMPLOYER PAYMENTS & BILLING ENGINE
========================================================= */

(() => {
    "use strict";

    const shared = window.TALVORA_EMPLOYER || {};
    const $ = id => document.getElementById(id);

    const state = {
        invoices: [],
        transactions: [],
        methods: [],
        subscription: null,
        account: {},
        filteredInvoices: [],
        filteredTransactions: [],
        loading: false
    };

    /* API CONNECTION */

    function companyId() {
        return typeof shared.getCompanyId === "function"
            ? shared.getCompanyId()
            : $("companySwitcher")?.value;
    }

    function companyPath(path) {
        if (typeof shared.companyPath === "function") {
            return shared.companyPath(path);
        }

        if (!companyId()) {
            throw new Error("Select an organization first.");
        }

        return `/api/employer/companies/${encodeURIComponent(companyId())}${path}`;
    }

    async function request(path, options = {}) {
        if (typeof shared.api === "function") {
            return shared.api(path, options);
        }

        const headers = { ...(options.headers || {}) };
        const config = {
            method: options.method || "GET",
            credentials: "same-origin",
            headers
        };

        if (options.body !== undefined) {
            headers["Content-Type"] = "application/json";
            config.body = JSON.stringify(options.body);
        }

        const response = await fetch(path, config);
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.message || `Request failed (${response.status})`);
        }

        return result;
    }

    function dataOf(result) {
        return result?.data ?? result ?? {};
    }

    function listOf(result, key) {
        const data = dataOf(result);

        if (Array.isArray(data)) return data;
        if (Array.isArray(data[key])) return data[key];
        if (Array.isArray(data.items)) return data.items;

        return [];
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function toast(message, type = "info") {
        const region = $("billingToastRegion");
        if (!region) return;

        const item = document.createElement("div");
        item.className = `toast ${type}`;
        item.textContent = message;
        region.appendChild(item);

        setTimeout(() => item.remove(), 4500);
    }

    function formatDate(value) {
        if (!value) return "—";

        const raw = String(value);
        const d = /^\d{4}-\d{2}-\d{2}$/.test(raw)
            ? new Date(`${raw}T00:00:00`)
            : new Date(raw);

        return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
    }

    function formatMoney(amount, currency = "USD") {
        const value = Number(amount);

        if (!Number.isFinite(value)) return "—";

        try {
            return new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: String(currency || "USD").toUpperCase()
            }).format(value);
        } catch {
            return `${currency} ${value.toLocaleString()}`;
        }
    }

    function safeRedirect(value) {
        if (!value) throw new Error("The payment service did not return a redirect URL.");

        const url = new URL(value, window.location.origin);

        if (
            url.protocol !== "https:" &&
            url.origin !== window.location.origin
        ) {
            throw new Error("The payment provider returned an unsafe URL.");
        }

        window.location.assign(url.href);
    }

    function statusClass(status) {
        const allowed = [
            "paid",
            "pending",
            "overdue",
            "draft",
            "void",
            "cancelled",
            "successful",
            "failed",
            "refunded",
            "active",
            "inactive"
        ];

        return allowed.includes(String(status).toLowerCase())
            ? String(status).toLowerCase()
            : "neutral";
    }

    function setConnection(message, status = "") {
        $("billingConnectionStatus").textContent = message;

        const dot = document.querySelector(".billing-connection .connection-dot");
        if (dot) dot.className = `connection-dot ${status}`;
    }

    /* LOAD BILLING INFORMATION */

    async function load() {
        if (state.loading) return;

        if (!companyId()) {
            setConnection("Select an organization to view billing.", "error");
            return;
        }

        state.loading = true;
        setConnection("Loading billing information...");

        const endpoints = [
            ["/billing/invoices", "invoices"],
            ["/billing/transactions", "transactions"],
            ["/billing/payment-methods", "methods"],
            ["/billing/subscription", "subscription"],
            ["/billing/account", "account"]
        ];

        const results = await Promise.allSettled(
            endpoints.map(([path]) => request(companyPath(path)))
        );

        let successful = 0;

        results.forEach((result, index) => {
            const key = endpoints[index][1];

            if (result.status !== "fulfilled") {
                console.warn(`[TALVORA BILLING] ${key}`, result.reason);
                state[key] = key === "account" || key === "subscription" ? {} : [];
                return;
            }

            successful++;

            const data = dataOf(result.value);

            if (key === "invoices") {
                state.invoices = listOf(result.value, "invoices");
            } else if (key === "transactions") {
                state.transactions = listOf(result.value, "transactions");
            } else if (key === "methods") {
                state.methods = listOf(result.value, "paymentMethods");
            } else if (key === "subscription") {
                state.subscription = data.subscription || data;
            } else if (key === "account") {
                state.account = data.account || data;
            }
        });

        state.filteredInvoices = [...state.invoices];
        state.filteredTransactions = [...state.transactions];

        renderAll();

        if (successful === endpoints.length) {
            setConnection("Billing services connected.", "connected");
        } else if (successful > 0) {
            setConnection("Billing partially loaded. Some services are unavailable.", "");
        } else {
            setConnection("Unable to connect to billing services.", "error");
            toast("Billing data could not be retrieved.", "error");
        }

        $("billingUpdated").textContent =
            `Updated ${new Date().toLocaleTimeString()}`;

        state.loading = false;
    }

    /* KPI CALCULATIONS */

    function renderKPIs() {
        const paid = state.invoices.filter(
            invoice => String(invoice.status).toLowerCase() === "paid"
        );

        const overdue = state.invoices.filter(
            invoice => String(invoice.status).toLowerCase() === "overdue"
        );

        const outstanding = state.invoices
            .filter(invoice =>
                ["pending", "overdue"].includes(
                    String(invoice.status).toLowerCase()
                )
            )
            .reduce((sum, invoice) => {
                return sum + Number(
                    invoice.amountDue ??
                    invoice.balanceDue ??
                    invoice.total ??
                    invoice.amount ??
                    0
                );
            }, 0);

        const currency = state.invoices[0]?.currency || "USD";

        $("totalInvoices").textContent = state.invoices.length;
        $("paidInvoices").textContent = paid.length;
        $("overdueInvoices").textContent = overdue.length;
        $("outstandingAmount").textContent =
            formatMoney(outstanding, currency);
    }

    /* SUBSCRIPTION */

    function renderSubscription() {
        const sub = state.subscription || {};

        $("subscriptionPlan").textContent =
            sub.planName || sub.plan?.name || "No active plan";

        $("subscriptionCycle").textContent =
            sub.billingCycle || sub.interval || "—";

        $("subscriptionNextDate").textContent =
            formatDate(sub.nextBillingDate || sub.currentPeriodEnd);

        $("subscriptionAmount").textContent =
            sub.amount !== undefined
                ? formatMoney(sub.amount, sub.currency)
                : "—";

        const status = String(sub.status || "unknown").toLowerCase();

        $("subscriptionStatus").textContent =
            status.replace(/_/g, " ");

        $("subscriptionStatus").className =
            `billing-status ${statusClass(status)}`;

        if (sub.cancelAtPeriodEnd) {
            $("subscriptionNotice").textContent =
                "Cancellation is scheduled for the end of the current billing period.";
        } else {
            $("subscriptionNotice").textContent =
                "Subscription changes are processed through the secure billing portal.";
        }
    }

    /* INVOICE FILTERS */

    function populateCurrencyFilter() {
        const select = $("invoiceCurrencyFilter");
        const previous = select.value;

        select.replaceChildren(new Option("All Currencies", ""));

        const currencies = [
            ...new Set(
                state.invoices.map(invoice =>
                    String(invoice.currency || "USD").toUpperCase()
                )
            )
        ].sort();

        currencies.forEach(currency => {
            select.add(new Option(currency, currency));
        });

        if (currencies.includes(previous)) select.value = previous;
    }

    function filterInvoices() {
        const query = $("invoiceSearch").value.trim().toLowerCase();
        const status = $("invoiceStatusFilter").value;
        const currency = $("invoiceCurrencyFilter").value;

        state.filteredInvoices = state.invoices.filter(invoice => {
            const number = String(
                invoice.invoiceNumber || invoice.number || invoice.id || ""
            ).toLowerCase();

            return (!query || number.includes(query)) &&
                (!status || String(invoice.status).toLowerCase() === status) &&
                (!currency || String(invoice.currency || "USD").toUpperCase() === currency);
        });

        renderInvoices();
    }

    /* INVOICE TABLE */

    function renderInvoices() {
        const body = $("invoiceTableBody");
        body.replaceChildren();

        const invoices = state.filteredInvoices;

        $("invoiceCount").textContent = `${state.invoices.length} invoices`;
        $("invoiceFooter").textContent =
            `Showing ${invoices.length} of ${state.invoices.length} invoices`;

        if (!invoices.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-cell">
                        No matching invoices found.
                    </td>
                </tr>
            `;
            return;
        }

        invoices.forEach(invoice => {
            const id = invoice.id || invoice._id;
            const status = String(invoice.status || "pending").toLowerCase();

            const amount = invoice.total ??
                invoice.amount ??
                invoice.amountDue ??
                0;

            const row = document.createElement("tr");

            row.innerHTML = `
                <td><strong>${escapeHTML(invoice.invoiceNumber || invoice.number || id || "—")}</strong></td>
                <td>${escapeHTML(formatDate(invoice.issueDate || invoice.createdAt))}</td>
                <td>${escapeHTML(formatDate(invoice.dueDate))}</td>
                <td><strong>${escapeHTML(formatMoney(amount, invoice.currency))}</strong></td>
                <td>${escapeHTML(invoice.currency || "USD")}</td>
                <td><span class="billing-status ${statusClass(status)}">${escapeHTML(status)}</span></td>
                <td>
                    <button class="table-action" data-action="view" data-id="${escapeHTML(id)}">View</button>
                    ${status !== "paid" && !["void", "cancelled"].includes(status)
                    ? `<button class="table-action" data-action="pay" data-id="${escapeHTML(id)}">Pay</button>`
                    : ""}
                    <button class="table-action" data-action="download" data-id="${escapeHTML(id)}">Download</button>
                </td>
            `;

            body.appendChild(row);
        });
    }

    /* VIEW INVOICE */

    function viewInvoice(id) {
        const invoice = state.invoices.find(item =>
            String(item.id || item._id) === String(id)
        );

        if (!invoice) return;

        const content = $("invoiceDetailsContent");

        content.replaceChildren();

        const fields = [
            ["Invoice Number", invoice.invoiceNumber || invoice.number || id],
            ["Status", invoice.status],
            ["Issue Date", formatDate(invoice.issueDate || invoice.createdAt)],
            ["Due Date", formatDate(invoice.dueDate)],
            ["Subtotal", formatMoney(invoice.subtotal, invoice.currency)],
            ["Tax", formatMoney(invoice.tax, invoice.currency)],
            ["Total", formatMoney(invoice.total ?? invoice.amount, invoice.currency)],
            ["Outstanding", formatMoney(invoice.amountDue ?? invoice.balanceDue, invoice.currency)],
            ["Description", invoice.description || "—"]
        ];

        fields.forEach(([name, value]) => {
            const row = document.createElement("p");
            const strong = document.createElement("strong");
            strong.textContent = `${name}: `;
            row.append(strong, document.createTextNode(String(value ?? "—")));
            content.appendChild(row);
        });

        $("invoiceDialog").showModal();
    }

    /* PAY INVOICE THROUGH GATEWAY */

    async function payInvoice(id) {
        const invoice = state.invoices.find(item =>
            String(item.id || item._id) === String(id)
        );

        if (!invoice) {
            toast("Invoice not found.", "error");
            return;
        }

        if (String(invoice.status).toLowerCase() === "paid") {
            toast("This invoice is already paid.", "warning");
            return;
        }

        if (!confirm(
            `Proceed to secure payment for invoice ${invoice.invoiceNumber || invoice.number || id}?`
        )) return;

        try {
            toast("Preparing secure payment...", "info");

            const result = await request(
                companyPath(`/billing/invoices/${encodeURIComponent(id)}/checkout`),
                {
                    method: "POST",
                    body: {
                        returnUrl: window.location.href
                    }
                }
            );

            const data = dataOf(result);

            safeRedirect(
                data.checkoutUrl ||
                data.paymentUrl ||
                data.url
            );

        } catch (error) {
            console.error(error);
            toast(error.message || "Unable to start payment.", "error");
        }
    }

    /* DOWNLOAD INVOICE */

    function downloadInvoice(id) {
        const invoice = state.invoices.find(item =>
            String(item.id || item._id) === String(id)
        );

        if (!invoice) return;

        const url = invoice.downloadUrl || invoice.pdfUrl;

        if (!url) {
            toast("No invoice download is available.", "warning");
            return;
        }

        try {
            const parsed = new URL(url, window.location.origin);

            if (!["https:", "http:"].includes(parsed.protocol)) {
                throw new Error("Invalid invoice URL.");
            }

            window.open(parsed.href, "_blank", "noopener,noreferrer");

        } catch (error) {
            toast(error.message, "error");
        }
    }

    /* PAYMENT METHODS */

    function renderMethods() {
        const container = $("paymentMethodsContainer");
        container.replaceChildren();

        if (!state.methods.length) {
            const empty = document.createElement("p");
            empty.className = "empty-state";
            empty.textContent = "No saved payment methods.";
            container.appendChild(empty);
            return;
        }

        state.methods.forEach(method => {
            const card = document.createElement("article");
            card.className = "payment-method-card";

            const title = method.brand ||
                method.provider ||
                method.type ||
                "Payment Method";

            const lastFour = method.last4
                ? `•••• ${method.last4}`
                : method.maskedReference || "Secure payment reference";

            const expiry = method.expiryMonth && method.expiryYear
                ? `${method.expiryMonth}/${method.expiryYear}`
                : "Expiry not supplied";

            card.innerHTML = `
                <strong>${escapeHTML(title)}</strong>
                <span>${escapeHTML(lastFour)}</span>
                <span>${escapeHTML(expiry)}</span>
                <span>${method.isDefault ? "Default payment method" : "Saved payment method"}</span>
                <span>${escapeHTML(method.status || "Active")}</span>
                ${method.isDefault ? "" : `<button class="table-action" data-remove-method="${escapeHTML(method.id || method._id)}">Remove</button>`}
            `;

            container.appendChild(card);
        });
    }

    async function addPaymentMethod() {
        try {
            const result = await request(
                companyPath("/billing/payment-methods/setup"),
                {
                    method: "POST",
                    body: {
                        returnUrl: window.location.href
                    }
                }
            );

            const data = dataOf(result);

            safeRedirect(
                data.setupUrl ||
                data.checkoutUrl ||
                data.url
            );

        } catch (error) {
            toast(error.message || "Unable to open payment setup.", "error");
        }
    }

    async function removePaymentMethod(id) {
        if (!confirm("Remove this saved payment method?")) return;

        try {
            await request(
                companyPath(`/billing/payment-methods/${encodeURIComponent(id)}`),
                { method: "DELETE" }
            );

            toast("Payment method removed.", "success");
            await load();

        } catch (error) {
            toast(error.message || "Unable to remove payment method.", "error");
        }
    }

    /* TRANSACTIONS */

    function filterTransactions() {
        const query = $("transactionSearch").value.trim().toLowerCase();
        const status = $("transactionStatusFilter").value;

        state.filteredTransactions = state.transactions.filter(item => {
            const searchable = [
                item.reference,
                item.transactionReference,
                item.description,
                item.method,
                item.invoiceNumber
            ].join(" ").toLowerCase();

            return (!query || searchable.includes(query)) &&
                (!status || String(item.status).toLowerCase() === status);
        });

        renderTransactions();
    }

    function renderTransactions() {
        const body = $("transactionTableBody");
        body.replaceChildren();

        if (!state.filteredTransactions.length) {
            body.innerHTML = `
                <tr><td colspan="6" class="empty-cell">No transactions found.</td></tr>
            `;
            return;
        }

        state.filteredTransactions.forEach(transaction => {
            const status = String(transaction.status || "pending").toLowerCase();

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${escapeHTML(transaction.reference || transaction.transactionReference || transaction.id || "—")}</td>
                <td>${escapeHTML(formatDate(transaction.date || transaction.createdAt))}</td>
                <td>${escapeHTML(transaction.description || transaction.invoiceNumber || "Payment")}</td>
                <td>${escapeHTML(transaction.method || transaction.paymentMethod || "—")}</td>
                <td>${escapeHTML(formatMoney(transaction.amount, transaction.currency))}</td>
                <td><span class="billing-status ${statusClass(status)}">${escapeHTML(status)}</span></td>
            `;

            body.appendChild(row);
        });
    }

    /* SUBSCRIPTION PORTAL */

    async function openBillingPortal() {
        try {
            const result = await request(
                companyPath("/billing/customer-portal"),
                {
                    method: "POST",
                    body: {
                        returnUrl: window.location.href
                    }
                }
            );

            const data = dataOf(result);
            safeRedirect(data.portalUrl || data.url);

        } catch (error) {
            toast(error.message || "Unable to open billing portal.", "error");
        }
    }

    /* BILLING ACCOUNT */

    function renderAccount() {
        const account = state.account || {};

        $("billingLegalName").textContent = account.legalName || "—";
        $("billingEmail").textContent = account.billingEmail || "—";
        $("billingCountry").textContent = account.country || "—";
        $("billingTaxReference").textContent = account.taxReference || "—";
        $("billingAddress").textContent = account.billingAddress || "—";
    }

    function openAccountEditor() {
        const form = $("billingDetailsForm");
        form.reset();

        const account = state.account || {};

        form.elements.namedItem("legalName").value = account.legalName || "";
        form.elements.namedItem("billingEmail").value = account.billingEmail || "";
        form.elements.namedItem("country").value = account.country || "";
        form.elements.namedItem("taxReference").value = account.taxReference || "";
        form.elements.namedItem("billingAddress").value = account.billingAddress || "";

        $("billingDetailsDialog").showModal();
    }

    async function saveAccount(event) {
        event.preventDefault();

        const form = $("billingDetailsForm");
        if (!form.reportValidity()) return;

        const payload = Object.fromEntries(new FormData(form).entries());

        const button = $("saveBillingDetailsButton");
        button.disabled = true;

        try {
            const result = await request(
                companyPath("/billing/account"),
                {
                    method: "PATCH",
                    body: payload
                }
            );

            state.account = dataOf(result).account || dataOf(result);

            $("billingDetailsDialog").close();
            renderAccount();
            toast("Billing details updated.", "success");

        } catch (error) {
            toast(error.message || "Billing details could not be saved.", "error");
        } finally {
            button.disabled = false;
        }
    }

    /* RENDER */

    function renderAll() {
        renderKPIs();
        renderSubscription();
        renderMethods();
        renderAccount();
        populateCurrencyFilter();
        filterInvoices();
        filterTransactions();
    }

    /* EVENTS */

    function bind() {
        $("billingRefresh")?.addEventListener("click", load);
        $("refreshMethodsButton")?.addEventListener("click", load);

        $("addPaymentMethodButton")?.addEventListener(
            "click",
            addPaymentMethod
        );

        $("billingPortalButton")?.addEventListener(
            "click",
            openBillingPortal
        );

        $("manageSubscriptionButton")?.addEventListener(
            "click",
            openBillingPortal
        );

        $("editBillingDetailsButton")?.addEventListener(
            "click",
            openAccountEditor
        );

        $("billingDetailsForm")?.addEventListener(
            "submit",
            saveAccount
        );

        $("invoiceSearch")?.addEventListener("input", filterInvoices);
        $("invoiceStatusFilter")?.addEventListener("change", filterInvoices);
        $("invoiceCurrencyFilter")?.addEventListener("change", filterInvoices);

        $("transactionSearch")?.addEventListener("input", filterTransactions);
        $("transactionStatusFilter")?.addEventListener("change", filterTransactions);

        $("clearBillingFilters")?.addEventListener("click", () => {
            $("invoiceSearch").value = "";
            $("invoiceStatusFilter").value = "";
            $("invoiceCurrencyFilter").value = "";
            filterInvoices();
        });

        $("invoiceTableBody")?.addEventListener("click", event => {
            const button = event.target.closest("[data-action]");
            if (!button) return;

            const { action, id } = button.dataset;

            if (action === "view") viewInvoice(id);
            if (action === "pay") payInvoice(id);
            if (action === "download") downloadInvoice(id);
        });

        $("paymentMethodsContainer")?.addEventListener("click", event => {
            const button = event.target.closest("[data-remove-method]");
            if (button) removePaymentMethod(button.dataset.removeMethod);
        });

        document.querySelectorAll("[data-close]").forEach(button => {
            button.addEventListener("click", () => {
                $(button.dataset.close)?.close();
            });
        });

        $("companySwitcher")?.addEventListener("change", load);
    }

    const module = {
        load,
        refresh: load,
        getInvoices: () => [...state.invoices],
        getTransactions: () => [...state.transactions],
        getSubscription: () => state.subscription
    };

    if (typeof shared.registerModule === "function") {
        shared.registerModule("billing", module);
    }

    window.TALVORA_BILLING = module;

    function initialize() {
        bind();
        load();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }

})();