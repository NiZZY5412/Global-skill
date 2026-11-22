
(() => {
    "use strict";

    const DEFAULTS = {
        dashboard: "/api/treasury/dashboard",
        reference: "/api/treasury/reference-data",
        liquidity: "/api/treasury/liquidity",
        accounts: "/api/treasury/accounts",
        transfers: "/api/treasury/transfers",
        fxQuotes: "/api/treasury/fx/quotes",
        fxOrders: "/api/treasury/fx/orders",
        forecasts: "/api/treasury/forecasts",
        exposures: "/api/treasury/exposures",
        reports: "/api/treasury/reports",
        audit: "/api/treasury/audit",
        exports: "/api/treasury/exports"
    };

    const config = window.TALVORA_ADMIN_CONFIG || {};
    const apiBase = (config.apiBaseUrl || "").replace(/\/+$/, "");
    const endpoints = { ...DEFAULTS, ...(config.treasuryEndpoints || {}) };
    const $ = id => document.getElementById(id);

    const state = {
        section: "overview",
        currencies: [],
        accounts: [],
        transfers: [],
        fxQuote: null,
        pendingAction: null,
        refreshTimer: null
    };

    const esc = value => String(value ?? "—").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);

    const dataOf = payload => payload?.data ?? payload ?? {};

    const records = (payload, ...keys) => {
        const data = dataOf(payload);
        if (Array.isArray(data)) return data;
        for (const key of keys) {
            if (Array.isArray(data?.[key])) return data[key];
        }
        return [];
    };

    const valueOf = (object, ...keys) => {
        for (const key of keys) {
            if (object?.[key] !== undefined && object[key] !== null) {
                return object[key];
            }
        }
        return undefined;
    };

    const query = params => {
        const q = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== "" && value !== null && value !== undefined) {
                q.set(key, value);
            }
        });
        const result = q.toString();
        return result ? `?${result}` : "";
    };

    const url = path => apiBase + (path.startsWith("/") ? path : `/${path}`);

    function toast(message, type = "info") {
        const region = $("toastRegion");
        if (!region) return;
        const node = document.createElement("div");
        node.className = `toast ${type}`;
        node.textContent = message;
        region.appendChild(node);
        setTimeout(() => node.remove(), 5000);
    }

    function setMetric(id, value) {
        if ($(id)) {
            $(id).textContent =
                value === undefined || value === null
                    ? "—"
                    : typeof value === "number"
                        ? value.toLocaleString()
                        : String(value);
        }
    }

    function money(amount, currency) {
        if (amount === undefined || amount === null) return "—";
        const number = Number(amount);
        if (!Number.isFinite(number)) return "—";
        if (!currency) return number.toLocaleString();
        try {
            return new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: String(currency).toUpperCase()
            }).format(number);
        } catch {
            return `${currency} ${number.toLocaleString()}`;
        }
    }

    function date(value) {
        if (!value) return "—";
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? esc(value) :
            new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short"
            }).format(d);
    }

    function badge(status) {
        const name = String(status || "unknown").toLowerCase()
            .replace(/[^a-z0-9_-]/g, "_");
        const label = String(status || "Unknown")
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase());
        return `<span class="badge ${name}">${esc(label)}</span>`;
    }

    function empty(columns, message) {
        return `<tr><td colspan="${columns}" class="empty-state">${esc(message)}</td></tr>`;
    }

    async function api(path, options = {}) {
        const controller = new AbortController();
        const timer = setTimeout(
            () => controller.abort(),
            Number(config.timeout) || 30000
        );

        const headers = new Headers(options.headers || {});
        headers.set("Accept", "application/json");

        const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
        if (csrf) headers.set("X-CSRF-Token", csrf);

        let body = options.body;
        if (body && !(body instanceof FormData) && typeof body !== "string") {
            headers.set("Content-Type", "application/json");
            body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url(path), {
                ...options,
                headers,
                body,
                credentials: "include",
                cache: "no-store",
                signal: controller.signal
            });

            if (!response.ok) {
                let message = `Request failed (${response.status})`;
                try {
                    const error = await response.json();
                    message = error.message || error.detail || error.error || message;
                } catch { }
                if (response.status === 401) {
                    setConnection("error", "Authentication required");
                }
                throw new Error(message);
            }

            if (response.status === 204) return null;

            const type = response.headers.get("content-type") || "";
            return type.includes("application/json")
                ? response.json()
                : response.text();

        } finally {
            clearTimeout(timer);
        }
    }

    function setConnection(status, label) {
        const el = $("apiStatus");
        if (!el) return;
        el.className = `connection ${status}`;
        el.innerHTML = `<i></i>${esc(label)}`;
    }

    function idempotencyHeaders() {
        return window.crypto?.randomUUID
            ? { "Idempotency-Key": crypto.randomUUID() }
            : {};
    }

    function populateCurrencyOptions(items) {
        const options = items.map(item => {
            const code = item.code || item.currencyCode || item.currency_code;
            if (!code) return "";
            const name = item.name || item.displayName || code;
            return `<option value="${esc(code)}">${esc(name)} (${esc(code)})</option>`;
        }).join("");

        ["fxFrom", "fxTo"].forEach(id => {
            if ($(id)) $(id).innerHTML = '<option value="">Select currency</option>' + options;
        });

        document.querySelectorAll(".currency-options").forEach(select => {
            select.innerHTML = '<option value="">Select currency</option>' + options;
        });

        if ($("forecastCurrency")) {
            $("forecastCurrency").innerHTML =
                '<option value="">All currencies</option>' + options;
        }
    }

    async function loadReference() {
        const payload = await api(endpoints.reference);
        const data = dataOf(payload);

        state.currencies = records(data, "currencies", "supportedCurrencies");
        state.accounts = records(data, "accounts", "bankAccounts");

        populateCurrencyOptions(state.currencies);

        if ($("transferSource")) {
            $("transferSource").innerHTML =
                '<option value="">Select source account</option>' +
                state.accounts.map(account => `
          <option value="${esc(account.id)}">
            ${esc(account.bankName || account.bank_name || "Bank")} —
            ${esc(account.maskedAccount || account.masked_account || account.reference || account.id)}
            (${esc(account.currency || "")})
          </option>
        `).join("");
        }
    }

    function renderCurrencyDistribution(items) {
        const container = $("currencyDistribution");
        if (!container) return;

        if (!items.length) {
            container.innerHTML = '<p class="muted">No currency positions returned.</p>';
            return;
        }

        const max = Math.max(...items.map(x => Number(x.available || x.balance || 0)), 1);

        container.innerHTML = items.map(item => {
            const amount = Number(item.available ?? item.balance ?? 0);
            return `
        <div class="currency-row">
          <strong>${esc(item.currency || item.code)}</strong>
          <div class="currency-track">
            <i style="width:${Math.min(100, Math.max(0, amount / max * 100))}%"></i>
          </div>
          <span>${esc(money(amount, item.currency))}</span>
        </div>
      `;
        }).join("");
    }

    function renderHealth(items) {
        const container = $("treasuryHealth");
        if (!container) return;

        container.innerHTML = items.length ? items.map(item => `
      <div class="health-row">
        <div>
          <strong>${esc(item.name || item.service || item.component)}</strong>
          <small>${esc(item.description || item.lastChecked || "Service monitoring")}</small>
        </div>
        ${badge(item.status || item.health)}
      </div>
    `).join("") : '<p class="muted">No health information available.</p>';
    }

    async function loadOverview() {
        const results = await Promise.allSettled([
            api(endpoints.dashboard),
            api(endpoints.transfers + query({ limit: 8, pageSize: 8 }))
        ]);

        let success = 0;

        if (results[0].status === "fulfilled") {
            success++;
            const data = dataOf(results[0].value);
            const m = data.metrics || data.summary || data;

            setMetric("tCash", money(
                valueOf(m, "totalBalance", "total_balance", "treasuryBalance"),
                m.reportingCurrency || m.reporting_currency
            ));
            setMetric("tAvailable", money(
                valueOf(m, "availableLiquidity", "available_liquidity"),
                m.reportingCurrency || m.reporting_currency
            ));
            setMetric("tPending", valueOf(m, "pendingTransfers", "pending_transfers"));
            setMetric("tExposure", money(
                valueOf(m, "currencyExposure", "currency_exposure"),
                m.reportingCurrency || m.reporting_currency
            ));

            renderCurrencyDistribution(records(data,
                "currencyPositions", "currency_positions", "liquidityByCurrency"));
            renderHealth(records(data, "health", "services", "components"));

            if (data.environment && $("environmentLabel")) {
                $("environmentLabel").textContent = String(data.environment).toUpperCase();
            }
        }

        if (results[1].status === "fulfilled") {
            success++;
            const items = records(results[1].value, "transfers", "records", "items");
            renderTransfers(items, "recentTransfers", true);
        }

        if (success) setConnection("connected", "Connected");
        else setConnection("error", "Service unavailable");
    }

    async function loadLiquidity() {
        const payload = await api(endpoints.liquidity + query({
            currency: $("forecastCurrency")?.value
        }));
        const data = dataOf(payload);
        const summary = data.metrics || data.summary || {};

        setMetric("lAvailable", valueOf(summary, "available", "availableLiquidity"));
        setMetric("lRestricted", valueOf(summary, "restricted", "restrictedFunds"));
        setMetric("lCommitted", valueOf(summary, "committed", "committedFunds"));
        setMetric("lShortfalls", valueOf(summary, "shortfalls", "liquidityShortfalls"));

        const items = records(payload, "positions", "liquidity", "records", "items");
        $("liquidityTable").innerHTML = items.length ? items.map(x => `
      <tr>
        <td>${esc(x.country || x.jurisdiction)}</td>
        <td>${esc(x.currency)}</td>
        <td>${esc(money(x.available, x.currency))}</td>
        <td>${esc(money(x.restricted, x.currency))}</td>
        <td>${esc(money(x.committed, x.currency))}</td>
        <td>${esc(money(x.minimumReserve || x.minimum_reserve, x.currency))}</td>
        <td>${badge(x.status)}</td>
      </tr>
    `).join("") : empty(7, "No liquidity positions returned.");
    }

    async function loadAccounts() {
        const payload = await api(endpoints.accounts + query({
            search: $("accountSearch")?.value?.trim(),
            status: $("accountStatus")?.value,
            pageSize: 50
        }));

        const items = records(payload, "accounts", "records", "items");
        state.accounts = items;

        $("accountTable").innerHTML = items.length ? items.map(x => `
      <tr>
        <td>${esc(x.maskedAccount || x.masked_account || x.reference || x.id)}</td>
        <td>${esc(x.bankName || x.bank_name)}</td>
        <td>${esc(x.country || x.jurisdiction)}</td>
        <td>${esc(x.currency)}</td>
        <td>${esc(money(x.balance, x.currency))}</td>
        <td>${esc(money(x.availableBalance ?? x.available_balance, x.currency))}</td>
        <td>${badge(x.status)}</td>
        <td><button data-detail="accounts" data-id="${esc(x.id)}">Inspect</button></td>
      </tr>
    `).join("") : empty(8, "No bank accounts returned.");
    }

    function renderTransfers(items, target = "transferTable", recent = false) {
        const container = $(target);
        if (!container) return;

        container.innerHTML = items.length ? items.map(x => `
      <tr>
        <td>${esc(x.reference || x.id)}</td>
        <td>${esc(x.sourceCountry || x.source_country || x.origin || "—")}</td>
        <td>${esc(x.destinationCountry || x.destination_country || x.destination || "—")}</td>
        <td>${esc(money(x.amount, x.currency))}</td>
        <td>${esc(money(x.fee, x.feeCurrency || x.currency))}</td>
        <td>${esc(date(x.createdAt || x.created_at))}</td>
        <td>${badge(x.status)}</td>
        ${recent ? "" : `<td>
          <button data-detail="transfers" data-id="${esc(x.id)}">Inspect</button>
          ${["pending", "pending_approval"].includes(String(x.status).toLowerCase())
                    ? `<button data-action="approve-transfer" data-id="${esc(x.id)}">Request approval</button>` : ""}
        </td>`}
      </tr>
    `).join("") : empty(recent ? 6 : 8, "No transfer records returned.");
    }

    async function loadTransfers() {
        const payload = await api(endpoints.transfers + query({
            search: $("transferSearch")?.value?.trim(),
            status: $("transferStatus")?.value,
            pageSize: 50
        }));
        state.transfers = records(payload, "transfers", "records", "items");
        renderTransfers(state.transfers);
    }

    async function submitTransfer(form) {
        const button = $("transferSubmit");
        button.disabled = true;
        button.textContent = "Submitting...";

        try {
            const values = Object.fromEntries(new FormData(form).entries());

            await api(endpoints.transfers, {
                method: "POST",
                headers: idempotencyHeaders(),
                body: {
                    sourceAccountId: values.sourceAccountId,
                    destinationCountry: values.destinationCountry.trim(),
                    currency: values.currency,
                    amount: Number(values.amount),
                    beneficiaryReference: values.beneficiaryReference.trim(),
                    purpose: values.purpose.trim(),
                    requestedStatus: "pending_approval",
                    source: "talvora_global_treasury"
                }
            });

            $("transferModal").hidden = true;
            form.reset();
            toast("Transfer request submitted for authorization.", "success");
            await Promise.allSettled([loadTransfers(), loadOverview(), loadLiquidity()]);
        } catch (error) {
            toast(`Transfer request failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Submit for Approval";
        }
    }

    async function loadFX() {
        const payload = await api(endpoints.fxOrders + query({ pageSize: 50 }));
        const items = records(payload, "orders", "fxOrders", "records", "items");

        $("fxTable").innerHTML = items.length ? items.map(x => `
      <tr>
        <td>${esc(x.reference || x.id)}</td>
        <td>${esc(x.fromCurrency)} / ${esc(x.toCurrency)}</td>
        <td>${esc(money(x.sellAmount, x.fromCurrency))}</td>
        <td>${esc(money(x.buyAmount, x.toCurrency))}</td>
        <td>${esc(x.rate ?? "—")}</td>
        <td>${esc(date(x.createdAt || x.created_at))}</td>
        <td>${badge(x.status)}</td>
      </tr>
    `).join("") : empty(7, "No FX orders returned.");
    }

    async function requestFxQuote(form) {
        const button = $("fxQuoteButton");
        button.disabled = true;
        button.textContent = "Requesting quote...";

        try {
            const values = Object.fromEntries(new FormData(form).entries());

            if (values.fromCurrency === values.toCurrency) {
                throw new Error("Select two different currencies.");
            }

            const payload = await api(endpoints.fxQuotes, {
                method: "POST",
                headers: idempotencyHeaders(),
                body: {
                    fromCurrency: values.fromCurrency,
                    toCurrency: values.toCurrency,
                    amount: Number(values.amount),
                    purpose: values.purpose.trim()
                }
            });

            const quote = dataOf(payload);
            if (!quote.quoteId && !quote.id) {
                throw new Error("The FX provider did not return a quote reference.");
            }

            state.fxQuote = quote;

            $("fxQuoteResult").hidden = false;
            $("fxQuoteResult").innerHTML = `
        <strong>Quote reference:</strong> ${esc(quote.quoteId || quote.id)}<br>
        <strong>Exchange rate:</strong> ${esc(quote.rate ?? "—")}<br>
        <strong>Estimated destination amount:</strong>
        ${esc(money(quote.destinationAmount ?? quote.buyAmount, values.toCurrency))}<br>
        <strong>Expiry:</strong> ${esc(date(quote.expiresAt || quote.expires_at))}
      `;

            $("fxConfirmButton").hidden = false;
            toast("FX quote received. Review the quote before submitting an order.", "success");
        } catch (error) {
            toast(`FX quote failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Request Exchange Quote";
        }
    }

    async function submitFxOrder() {
        if (!state.fxQuote) return;

        const button = $("fxConfirmButton");
        button.disabled = true;

        try {
            await api(endpoints.fxOrders, {
                method: "POST",
                headers: idempotencyHeaders(),
                body: {
                    quoteId: state.fxQuote.quoteId || state.fxQuote.id,
                    requestedStatus: "pending_approval",
                    source: "talvora_global_treasury"
                }
            });

            state.fxQuote = null;
            $("fxQuoteResult").hidden = true;
            button.hidden = true;
            $("fxForm").reset();
            toast("FX order submitted for authorization.", "success");
            await loadFX();
        } catch (error) {
            toast(`FX order failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    async function loadForecasts() {
        const payload = await api(endpoints.forecasts + query({
            period: $("forecastPeriod")?.value,
            currency: $("forecastCurrency")?.value,
            pageSize: 50
        }));

        const items = records(payload, "forecasts", "records", "items");
        $("forecastTable").innerHTML = items.length ? items.map(x => `
      <tr>
        <td>${esc(x.period || x.forecastPeriod)}</td>
        <td>${esc(x.country || x.jurisdiction)}</td>
        <td>${esc(x.currency)}</td>
        <td>${esc(money(x.openingBalance, x.currency))}</td>
        <td>${esc(money(x.inflows, x.currency))}</td>
        <td>${esc(money(x.outflows, x.currency))}</td>
        <td>${esc(money(x.projectedClosingBalance ?? x.projected_closing_balance, x.currency))}</td>
        <td>${badge(x.status)}</td>
      </tr>
    `).join("") : empty(8, "No cash forecasts returned.");
    }

    async function loadRisk() {
        const payload = await api(endpoints.exposures + query({ pageSize: 50 }));
        const data = dataOf(payload);
        const summary = data.metrics || data.summary || {};

        setMetric("rAlerts", valueOf(summary, "openAlerts", "open_alerts"));
        setMetric("rBreaches", valueOf(summary, "limitBreaches", "limit_breaches"));
        setMetric("rCounterparties", valueOf(summary, "counterparties"));
        setMetric("rUnhedged", valueOf(summary, "unhedgedExposure", "unhedged_exposure"));

        const items = records(payload, "exposures", "risks", "records", "items");

        $("exposureTable").innerHTML = items.length ? items.map(x => `
      <tr>
        <td>${esc(x.reference || x.id)}</td>
        <td>${esc(x.type || x.riskType)}</td>
        <td>${esc(x.currency || "—")}</td>
        <td>${esc(money(x.exposure, x.currency))}</td>
        <td>${esc(money(x.limit, x.currency))}</td>
        <td>${badge(x.severity)}</td>
        <td>${badge(x.status)}</td>
        <td><button data-detail="exposures" data-id="${esc(x.id)}">Inspect</button></td>
      </tr>
    `).join("") : empty(8, "No treasury exposures returned.");
    }

    async function loadReports() {
        const payload = await api(endpoints.reports + query({ pageSize: 50 }));
        const items = records(payload, "reports", "records", "items");

        $("reportTable").innerHTML = items.length ? items.map(x => `
      <tr>
        <td>${esc(x.name || x.title || x.reference)}</td>
        <td>${esc(x.type)}</td>
        <td>${esc(x.period || x.reportingPeriod)}</td>
        <td>${esc(x.jurisdiction || x.country || "Global")}</td>
        <td>${esc(date(x.generatedAt || x.created_at))}</td>
        <td>${badge(x.status)}</td>
        <td><button data-detail="reports" data-id="${esc(x.id)}">Inspect</button></td>
      </tr>
    `).join("") : empty(7, "No treasury reports returned.");
    }

    async function loadAudit() {
        const payload = await api(endpoints.audit + query({
            search: $("auditSearch")?.value?.trim(),
            pageSize: 100
        }));
        const items = records(payload, "records", "audit", "items");

        $("auditTable").innerHTML = items.length ? items.map(x => `
      <tr>
        <td>${esc(x.reference || x.id)}</td>
        <td>${esc(x.actorName || x.actor || "—")}</td>
        <td>${esc(x.action || x.operation)}</td>
        <td>${esc(x.resource || x.resourceReference || "—")}</td>
        <td>${esc(x.reason || "—")}</td>
        <td>${esc(date(x.createdAt || x.created_at))}</td>
        <td>${badge(x.result || x.status)}</td>
      </tr>
    `).join("") : empty(7, "No treasury audit records returned.");
    }

    const loaders = {
        overview: loadOverview,
        liquidity: loadLiquidity,
        accounts: loadAccounts,
        transfers: loadTransfers,
        fx: loadFX,
        forecast: loadForecasts,
        risk: loadRisk,
        reports: loadReports,
        audit: loadAudit
    };

    async function navigate(section) {
        if (!loaders[section]) return;
        state.section = section;

        document.querySelectorAll(".section").forEach(el => {
            el.classList.toggle("active", el.id === section);
        });
        document.querySelectorAll(".nav-link").forEach(el => {
            el.classList.toggle("active", el.dataset.section === section);
        });

        $("sidebar")?.classList.remove("open");

        try {
            await loaders[section]();
        } catch (error) {
            toast(error.message, "error");
        }
    }

    function openAction(type, id, action) {
        state.pendingAction = { type, id, action };
        $("actionTitle").textContent = "Confirm Treasury Action";
        $("actionDescription").textContent =
            "This submits a treasury operation for server-side authorization. The backend must verify permissions, financial limits and required approvals.";
        $("actionReason").value = "";
        $("actionSubmit").disabled = true;
        $("actionModal").hidden = false;
    }

    async function submitAction() {
        const action = state.pendingAction;
        const reason = $("actionReason").value.trim();
        if (!action || reason.length < 10) return;

        const button = $("actionSubmit");
        button.disabled = true;

        try {
            const base = action.type === "transfers"
                ? endpoints.transfers
                : action.type === "accounts"
                    ? endpoints.accounts
                    : endpoints.exposures;

            await api(`${base}/${encodeURIComponent(action.id)}/actions`, {
                method: "POST",
                headers: idempotencyHeaders(),
                body: {
                    action: action.action,
                    reason,
                    source: "talvora_global_treasury"
                }
            });

            $("actionModal").hidden = true;
            state.pendingAction = null;
            toast("Treasury action request submitted.", "success");
            await Promise.allSettled([loaders[state.section](), loadOverview()]);
        } catch (error) {
            toast(error.message, "error");
        } finally {
            button.disabled = false;
        }
    }

    async function detail(type, id) {
        const base = {
            accounts: endpoints.accounts,
            transfers: endpoints.transfers,
            exposures: endpoints.exposures,
            reports: endpoints.reports
        }[type];

        if (!base) return;

        try {
            const payload = await api(`${base}/${encodeURIComponent(id)}`);
            const record = dataOf(payload);

            $("detailTitle").textContent = `${type.toUpperCase()} — ${record.reference || record.id || id}`;

            const sensitive = /token|secret|password|account.?number|iban|swift|private.?key|credential/i;

            $("detailBody").innerHTML = Object.entries(record)
                .filter(([key, value]) => !sensitive.test(key) && value !== null && typeof value !== "object")
                .map(([key, value]) => `
          <div class="detail-row">
            <span>${esc(key.replace(/([A-Z])/g, " $1"))}</span>
            <strong>${esc(value)}</strong>
          </div>
        `).join("") || '<p class="muted">No additional details available.</p>';

            $("detailModal").hidden = false;
        } catch (error) {
            toast(`Unable to retrieve details: ${error.message}`, "error");
        }
    }

    async function exportAudit() {
        try {
            const response = await fetch(url(endpoints.exports + query({ type: "treasury_audit", format: "csv" })), {
                credentials: "include",
                cache: "no-store",
                headers: {
                    "Accept": "text/csv",
                    "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || ""
                }
            });

            if (!response.ok) throw new Error(`Export failed (${response.status})`);

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = objectUrl;
            a.download = "talvora-treasury-audit.csv";
            a.click();
            URL.revokeObjectURL(objectUrl);
            toast("Audit export downloaded.", "success");
        } catch (error) {
            toast(error.message, "error");
        }
    }

    function debounce(fn, wait = 350) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), wait);
        };
    }

    function bindEvents() {
        document.querySelectorAll("[data-section]").forEach(link => {
            link.addEventListener("click", event => {
                event.preventDefault();
                navigate(link.dataset.section);
            });
        });

        document.querySelectorAll("[data-navigate]").forEach(button => {
            button.addEventListener("click", () => navigate(button.dataset.navigate));
        });

        document.querySelectorAll("[data-open]").forEach(button => {
            button.addEventListener("click", () => {
                const modal = $(button.dataset.open);
                if (modal) modal.hidden = false;
            });
        });

        document.querySelectorAll("[data-close]").forEach(button => {
            button.addEventListener("click", () => {
                button.closest(".overlay").hidden = true;
            });
        });

        document.querySelectorAll(".overlay").forEach(overlay => {
            overlay.addEventListener("click", event => {
                if (event.target === overlay) overlay.hidden = true;
            });
        });

        $("menuToggle")?.addEventListener("click", () => $("sidebar").classList.toggle("open"));
        $("refreshAll")?.addEventListener("click", refreshAll);

        document.querySelectorAll("[data-refresh]").forEach(button => {
            button.addEventListener("click", () => loaders[state.section]?.().catch(e => toast(e.message, "error")));
        });

        $("transferForm")?.addEventListener("submit", event => {
            event.preventDefault();
            submitTransfer(event.currentTarget);
        });

        $("fxForm")?.addEventListener("submit", event => {
            event.preventDefault();
            requestFxQuote(event.currentTarget);
        });

        $("fxConfirmButton")?.addEventListener("click", submitFxOrder);

        $("actionReason")?.addEventListener("input", event => {
            $("actionSubmit").disabled = event.target.value.trim().length < 10;
        });

        $("actionSubmit")?.addEventListener("click", submitAction);
        $("exportAudit")?.addEventListener("click", exportAudit);

        $("accountSearch")?.addEventListener("input", debounce(loadAccounts));
        $("accountStatus")?.addEventListener("change", loadAccounts);
        $("transferSearch")?.addEventListener("input", debounce(loadTransfers));
        $("transferStatus")?.addEventListener("change", loadTransfers);
        $("forecastPeriod")?.addEventListener("change", loadForecasts);
        $("forecastCurrency")?.addEventListener("change", loadForecasts);
        $("auditSearch")?.addEventListener("input", debounce(loadAudit));

        document.addEventListener("click", event => {
            const detailButton = event.target.closest("[data-detail]");
            if (detailButton) {
                detail(detailButton.dataset.detail, detailButton.dataset.id);
                return;
            }

            const actionButton = event.target.closest("[data-action]");
            if (actionButton) {
                openAction("transfers", actionButton.dataset.id, actionButton.dataset.action);
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                document.querySelectorAll(".overlay").forEach(el => el.hidden = true);
            }
        });
    }

    async function refreshAll() {
        setConnection("loading", "Refreshing");
        const results = await Promise.allSettled([
            loadReference(),
            loadOverview(),
            loadLiquidity()
        ]);

        if (results.every(result => result.status === "rejected")) {
            setConnection("error", "Unavailable");
            toast("Treasury services could not be reached.", "error");
            return;
        }

        if (state.section !== "overview" && loaders[state.section]) {
            await loaders[state.section]().catch(error => toast(error.message, "error"));
        }

        setConnection("connected", "Connected");
    }

    async function initialize() {
        bindEvents();
        setConnection("loading", "Connecting");

        await Promise.allSettled([
            loadReference(),
            loadOverview()
        ]);

        if (state.refreshTimer) clearInterval(state.refreshTimer);

        state.refreshTimer = setInterval(() => {
            if (document.visibilityState === "visible" && state.section === "overview") {
                loadOverview().catch(error => console.warn("[TALVORA Treasury]", error));
            }
        }, Number(config.refreshInterval) || 30000);
    }

    window.TALVORA_TREASURY = {
        refresh: refreshAll,
        navigate,
        loadOverview,
        loadLiquidity,
        loadAccounts,
        loadTransfers,
        loadFX,
        loadForecasts,
        loadRisk,
        loadReports,
        loadAudit,
        config: { apiBase, endpoints }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})();
