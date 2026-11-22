
(() => {
    "use strict";

    const DEFAULTS = {
        dashboard: "/api/financial-reconciliation/dashboard",
        reference: "/api/financial-reconciliation/reference-data",
        runs: "/api/financial-reconciliation/runs",
        transactions: "/api/financial-reconciliation/transactions",
        settlements: "/api/financial-reconciliation/settlements",
        statements: "/api/financial-reconciliation/statements",
        statementLines: "/api/financial-reconciliation/statement-lines",
        providers: "/api/financial-reconciliation/providers",
        exceptions: "/api/financial-reconciliation/exceptions",
        fees: "/api/financial-reconciliation/fees",
        fx: "/api/financial-reconciliation/fx",
        ledger: "/api/financial-reconciliation/ledger",
        reports: "/api/financial-reconciliation/reports",
        audit: "/api/financial-reconciliation/audit",
        exports: "/api/financial-reconciliation/exports",
        matchCandidates: "/api/financial-reconciliation/matching-candidates",
        matches: "/api/financial-reconciliation/matches"
    };

    const config = window.TALVORA_ADMIN_CONFIG || {};
    const base = (config.apiBaseUrl || "").replace(/\/+$/, "");
    const endpoints = {
        ...DEFAULTS,
        ...(config.reconciliationEndpoints || {})
    };

    const $ = id => document.getElementById(id);

    const state = {
        section: "overview",
        accounts: [],
        currencies: [],
        providers: [],
        pendingAction: null,
        refreshTimer: null
    };

    /* =========================================
       UTILITIES
    ========================================= */

    const esc = value => String(value ?? "—").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
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

    const first = (object, ...keys) => {
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

    const url = path =>
        base + (path.startsWith("/") ? path : `/${path}`);

    function toast(message, type = "info") {
        const region = $("toastRegion");
        if (!region) return;

        const node = document.createElement("div");
        node.className = `toast ${type}`;
        node.textContent = message;

        region.appendChild(node);
        setTimeout(() => node.remove(), 5000);
    }

    function metric(id, value) {
        if (!$(id)) return;

        $(id).textContent =
            value === null || value === undefined
                ? "—"
                : typeof value === "number"
                    ? value.toLocaleString()
                    : String(value);
    }

    function money(amount, currency) {
        if (amount === null || amount === undefined) return "—";

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

        return Number.isNaN(d.getTime())
            ? esc(value)
            : new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short"
            }).format(d);
    }

    function badge(value) {
        const status = String(value || "unknown")
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "_");

        const label = String(value || "Unknown")
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase());

        return `<span class="badge ${status}">${esc(label)}</span>`;
    }

    function empty(columns, message) {
        return `<tr><td colspan="${columns}" class="empty-state">${esc(message)}</td></tr>`;
    }

    function setStatus(status, label) {
        const element = $("apiStatus");
        if (!element) return;

        element.className = `connection ${status}`;
        element.innerHTML = `<i></i>${esc(label)}`;
    }

    function idempotencyHeaders() {
        return window.crypto?.randomUUID
            ? { "Idempotency-Key": window.crypto.randomUUID() }
            : {};
    }

    function debounce(callback, delay = 350) {
        let timer;

        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => callback(...args), delay);
        };
    }

    /* =========================================
       API CLIENT
    ========================================= */

    async function api(path, options = {}) {
        const controller = new AbortController();

        const timeout = setTimeout(
            () => controller.abort(),
            Number(config.timeout) || 30000
        );

        const headers = new Headers(options.headers || {});

        headers.set("Accept", "application/json");

        const csrf = document.querySelector(
            'meta[name="csrf-token"]'
        )?.content;

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

                    message =
                        error.message ||
                        error.detail ||
                        error.error ||
                        message;
                } catch { }

                if (response.status === 401) {
                    setStatus("error", "Authentication required");
                }

                throw new Error(message);
            }

            if (response.status === 204) return null;

            const contentType =
                response.headers.get("content-type") || "";

            return contentType.includes("application/json")
                ? response.json()
                : response.text();

        } finally {
            clearTimeout(timeout);
        }
    }

    /* =========================================
       REFERENCE DATA
    ========================================= */

    function setOptions(id, items, valueFn, labelFn, placeholder) {
        const element = $(id);
        if (!element) return;

        const current = element.value;

        element.innerHTML =
            `<option value="">${esc(placeholder)}</option>` +
            items.map(item => {
                const value = valueFn(item);
                const label = labelFn(item);

                if (!value) return "";

                return `<option value="${esc(value)}">${esc(label)}</option>`;
            }).join("");

        if ([...element.options].some(o => o.value === current)) {
            element.value = current;
        }
    }

    async function loadReference() {
        const payload = await api(endpoints.reference);
        const data = dataOf(payload);

        state.accounts = records(data, "accounts", "bankAccounts");
        state.currencies = records(data, "currencies", "supportedCurrencies");
        state.providers = records(data, "providers", "paymentProviders");

        const accountValue = x => x.id || x.accountId;

        const accountLabel = x => {
            const name = x.bankName || x.provider || "Financial account";
            const number =
                x.maskedAccount ||
                x.accountReference ||
                x.reference ||
                x.id;

            return `${name} — ${number} (${x.currency || ""})`;
        };

        [
            "runAccount",
            "statementImportAccount",
            "statementAccount"
        ].forEach(id => {
            setOptions(
                id,
                state.accounts,
                accountValue,
                accountLabel,
                id === "runAccount"
                    ? "All eligible accounts / providers"
                    : "All accounts"
            );
        });

        const currencies = state.currencies.map(x => ({
            code: x.code || x.currencyCode || x.currency_code,
            name: x.name || x.displayName || ""
        })).filter(x => x.code);

        const currencyLabel = x =>
            `${x.name ? x.name + " — " : ""}${x.code}`;

        ["runCurrency", "transactionCurrency", "ledgerCurrency"].forEach(id => {
            setOptions(
                id,
                currencies,
                x => x.code,
                currencyLabel,
                "All currencies"
            );
        });

        const providers = state.providers;

        setOptions(
            "settlementProvider",
            providers,
            x => x.id || x.providerId,
            x => x.name || x.displayName || x.providerName || x.id,
            "All providers"
        );
    }

    /* =========================================
       DASHBOARD
    ========================================= */

    async function loadOverview() {
        const results = await Promise.allSettled([
            api(endpoints.dashboard),
            api(endpoints.runs + query({ limit: 8, pageSize: 8 })),
            api(endpoints.exceptions + query({
                severity: "critical",
                status: "open",
                limit: 8
            }))
        ]);

        let success = 0;

        if (results[0].status === "fulfilled") {
            success++;

            const data = dataOf(results[0].value);
            const summary = data.metrics || data.summary || data;

            metric("rVolume", money(
                first(summary, "transactionVolume", "transaction_volume"),
                summary.reportingCurrency || summary.reporting_currency
            ));

            metric("rMatched", first(
                summary,
                "matchedTransactions",
                "matched_transactions"
            ));

            metric("rUnmatched", first(
                summary,
                "unmatchedTransactions",
                "unmatched_transactions"
            ));

            metric("rExceptions", first(
                summary,
                "openExceptions",
                "open_exceptions"
            ));

            metric("rSettled", money(
                first(summary, "settledAmount", "settled_amount"),
                summary.reportingCurrency || summary.reporting_currency
            ));

            metric("rPending", first(
                summary,
                "pendingSettlements",
                "pending_settlements"
            ));

            metric("rFailed", first(
                summary,
                "failedSettlements",
                "failed_settlements"
            ));

            metric("rVariance", money(
                first(summary, "outstandingVariance", "outstanding_variance"),
                summary.reportingCurrency || summary.reporting_currency
            ));

            renderMatchingHealth(records(
                data,
                "matchingHealth",
                "matching_health",
                "matchingSummary"
            ));

            renderSettlementHealth(records(
                data,
                "settlementHealth",
                "settlement_health",
                "settlementSummary"
            ));

            if (data.environment && $("environmentLabel")) {
                $("environmentLabel").textContent =
                    String(data.environment).toUpperCase();
            }
        }

        if (results[1].status === "fulfilled") {
            success++;

            renderRuns(
                records(results[1].value, "runs", "records", "items"),
                "recentRuns",
                true
            );
        }

        if (results[2].status === "fulfilled") {
            success++;

            renderExceptions(
                records(results[2].value, "exceptions", "records", "items"),
                "criticalExceptions",
                true
            );
        }

        setStatus(
            success ? "connected" : "error",
            success ? "Connected" : "Service unavailable"
        );
    }

    function renderMatchingHealth(items) {
        const element = $("matchingHealth");
        if (!element) return;

        element.innerHTML = items.length ? items.map(item => `
      <div class="health-row">
        <div>
          <strong>${esc(item.name || item.category || item.source)}</strong>
          <small>${esc(item.description || "Transaction matching")}</small>
        </div>
        <strong>${esc(item.count ?? item.percentage ?? "—")}</strong>
      </div>
    `).join("") : '<p class="muted">No matching statistics returned.</p>';
    }

    function renderSettlementHealth(items) {
        const element = $("settlementHealth");
        if (!element) return;

        element.innerHTML = items.length ? items.map(item => `
      <div class="health-row">
        <div>
          <strong>${esc(item.status || item.name)}</strong>
          <small>${esc(item.description || "Settlement monitoring")}</small>
        </div>
        <strong>${esc(item.count ?? item.amount ?? "—")}</strong>
      </div>
    `).join("") : '<p class="muted">No settlement health information returned.</p>';
    }

    /* =========================================
       RECONCILIATION RUNS
    ========================================= */

    function renderRuns(items, target = "runTable", recent = false) {
        const element = $(target);
        if (!element) return;

        element.innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.reference || item.runReference || item.id)}</td>
        <td>${esc(item.source || item.type)}</td>
        <td>${esc(item.accountName || item.providerName || item.account || "Global")}</td>
        <td>${esc(date(item.periodStart || item.period_start))}</td>
        <td>${esc(date(item.periodEnd || item.period_end))}</td>
        <td>${esc(item.transactionCount ?? item.transaction_count ?? "—")}</td>
        <td>${esc(item.matchedCount ?? item.matched_count ?? "—")}</td>
        <td>${esc(money(item.variance, item.currency))}</td>
        <td>${badge(item.status)}</td>
        ${recent ? "" : `
          <td>
            <button data-detail="runs" data-id="${esc(item.id)}">Inspect</button>
            <button data-action="review-run" data-id="${esc(item.id)}">Review</button>
          </td>
        `}
      </tr>
    `).join("") : empty(recent ? 9 : 10, "No reconciliation runs returned.");
    }

    async function loadRuns() {
        const payload = await api(endpoints.runs + query({
            search: $("runSearch")?.value?.trim(),
            status: $("runStatus")?.value,
            type: $("runType")?.value,
            pageSize: 100
        }));

        renderRuns(records(payload, "runs", "records", "items"));
    }

    async function createRun(form) {
        const button = $("runSubmit");
        button.disabled = true;
        button.textContent = "Submitting...";

        try {
            const values = Object.fromEntries(
                new FormData(form).entries()
            );

            if (values.periodEnd < values.periodStart) {
                throw new Error("Period end cannot be earlier than period start.");
            }

            await api(endpoints.runs, {
                method: "POST",
                headers: idempotencyHeaders(),
                body: {
                    type: values.type,
                    accountId: values.accountId || null,
                    currency: values.currency || null,
                    periodStart: values.periodStart,
                    periodEnd: values.periodEnd,
                    notes: values.notes.trim(),
                    status: "queued",
                    source: "talvora_global_reconciliation"
                }
            });

            $("runModal").hidden = true;
            form.reset();

            toast("Reconciliation run submitted successfully.", "success");

            await Promise.allSettled([
                loadRuns(),
                loadOverview()
            ]);

        } catch (error) {
            toast(`Unable to start reconciliation: ${error.message}`, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Start Reconciliation";
        }
    }

    /* =========================================
       FINANCIAL TRANSACTIONS
    ========================================= */

    async function loadTransactions() {
        const payload = await api(endpoints.transactions + query({
            search: $("transactionSearch")?.value?.trim(),
            status: $("transactionStatus")?.value,
            currency: $("transactionCurrency")?.value,
            source: $("transactionSource")?.value,
            pageSize: 100
        }));

        const items = records(payload, "transactions", "records", "items");

        $("transactionTable").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.reference || item.transactionReference || item.id)}</td>
        <td>${esc(item.externalReference || item.external_reference || "—")}</td>
        <td>${esc(date(item.transactionDate || item.transaction_date || item.createdAt))}</td>
        <td>${esc(item.source || item.channel)}</td>
        <td>${esc(item.type || item.transactionType)}</td>
        <td>${esc(money(item.amount, item.currency))}</td>
        <td>${esc(money(item.fee, item.feeCurrency || item.currency))}</td>
        <td>${esc(item.currency)}</td>
        <td>${badge(item.matchStatus || item.match_status || item.status)}</td>
        <td>
          <button data-detail="transactions" data-id="${esc(item.id)}">Inspect</button>
          ${String(item.matchStatus || item.status).toLowerCase() === "unmatched"
                ? `<button data-action="investigate-transaction" data-id="${esc(item.id)}">Review</button>`
                : ""}
        </td>
      </tr>
    `).join("") : empty(10, "No financial transactions returned.");
    }

    /* =========================================
       SETTLEMENTS
    ========================================= */

    async function loadSettlements() {
        const payload = await api(endpoints.settlements + query({
            search: $("settlementSearch")?.value?.trim(),
            status: $("settlementStatus")?.value,
            provider: $("settlementProvider")?.value,
            pageSize: 100
        }));

        const items = records(payload, "settlements", "batches", "records", "items");

        $("settlementTable").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.reference || item.batchReference || item.id)}</td>
        <td>${esc(item.providerName || item.provider)}</td>
        <td>${esc(item.jurisdiction || item.country || "—")}</td>
        <td>${esc(item.transactionCount ?? item.transaction_count ?? "—")}</td>
        <td>${esc(money(item.grossAmount ?? item.gross_amount, item.currency))}</td>
        <td>${esc(money(item.fees, item.currency))}</td>
        <td>${esc(money(item.netAmount ?? item.net_amount, item.currency))}</td>
        <td>${esc(date(item.settlementDate || item.settlement_date))}</td>
        <td>${badge(item.status)}</td>
        <td>
          <button data-detail="settlements" data-id="${esc(item.id)}">Inspect</button>
          <button data-action="review-settlement" data-id="${esc(item.id)}">Review</button>
        </td>
      </tr>
    `).join("") : empty(10, "No settlement batches returned.");
    }

    /* =========================================
       BANK STATEMENTS
    ========================================= */

    async function loadStatements() {
        const payload = await api(endpoints.statements + query({
            search: $("statementSearch")?.value?.trim(),
            status: $("statementStatus")?.value,
            accountId: $("statementAccount")?.value,
            pageSize: 100
        }));

        const items = records(payload, "statements", "records", "items");

        $("statementTable").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.reference || item.statementReference || item.id)}</td>
        <td>${esc(item.bankName || item.providerName || item.provider)}</td>
        <td>${esc(item.maskedAccount || item.accountReference || "—")}</td>
        <td>${esc(item.currency)}</td>
        <td>${esc(date(item.periodStart || item.period_start))}</td>
        <td>${esc(date(item.periodEnd || item.period_end))}</td>
        <td>${esc(money(item.openingBalance, item.currency))}</td>
        <td>${esc(money(item.closingBalance, item.currency))}</td>
        <td>${badge(item.status)}</td>
        <td>
          <button data-detail="statements" data-id="${esc(item.id)}">Inspect</button>
          <button data-view-lines="${esc(item.id)}">View lines</button>
        </td>
      </tr>
    `).join("") : empty(10, "No bank statements returned.");
    }

    async function loadStatementLines(statementId) {
        const payload = await api(endpoints.statementLines + query({
            statementId,
            search: $("statementLineSearch")?.value?.trim(),
            status: $("statementLineStatus")?.value,
            pageSize: 100
        }));

        const items = records(payload, "lines", "statementLines", "records", "items");

        $("statementLineTable").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.reference || item.lineReference || item.id)}</td>
        <td>${esc(item.statementReference || item.statementId || "—")}</td>
        <td>${esc(date(item.transactionDate || item.transaction_date))}</td>
        <td>${esc(item.description || item.narrative || "—")}</td>
        <td>${esc(item.externalReference || item.referenceNumber || "—")}</td>
        <td>${esc(money(item.amount, item.currency))}</td>
        <td>${esc(item.currency)}</td>
        <td>${badge(item.status)}</td>
        <td>
          <button data-detail="statementLines" data-id="${esc(item.id)}">Inspect</button>
        </td>
      </tr>
    `).join("") : empty(9, "No statement lines returned.");
    }

    async function importStatement(form) {
        const button = $("statementSubmit");
        button.disabled = true;
        button.textContent = "Uploading...";

        try {
            const file = form.elements.statementFile.files[0];

            if (!file) throw new Error("Select a statement file.");

            if (file.size > 25 * 1024 * 1024) {
                throw new Error("Statement file exceeds the 25 MB upload limit.");
            }

            const values = Object.fromEntries(
                new FormData(form).entries()
            );

            if (values.periodEnd < values.periodStart) {
                throw new Error("Period end cannot be earlier than period start.");
            }

            const formData = new FormData();

            formData.append("accountId", values.accountId);
            formData.append("periodStart", values.periodStart);
            formData.append("periodEnd", values.periodEnd);
            formData.append("format", values.format);
            formData.append("notes", values.notes.trim());
            formData.append("statementFile", file);

            await api(endpoints.statements + "/import", {
                method: "POST",
                headers: idempotencyHeaders(),
                body: formData
            });

            $("statementModal").hidden = true;
            form.reset();

            toast("Statement upload submitted for processing.", "success");

            await Promise.allSettled([
                loadStatements(),
                loadOverview()
            ]);

        } catch (error) {
            toast(`Statement upload failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Upload Statement";
        }
    }

    /* =========================================
       MATCHING CANDIDATES
    ========================================= */

    async function loadMatchCandidates() {
        const payload = await api(endpoints.matchCandidates + query({
            status: "unmatched",
            pageSize: 100
        }));

        const data = dataOf(payload);

        const transactions = records(
            data,
            "transactions",
            "internalTransactions"
        );

        const lines = records(
            data,
            "statementLines",
            "externalTransactions",
            "lines"
        );

        setOptions(
            "matchTransaction",
            transactions,
            x => x.id,
            x => `${x.reference || x.id} — ${money(x.amount, x.currency)} — ${x.currency || ""}`,
            "Select unmatched transaction"
        );

        setOptions(
            "matchStatementLine",
            lines,
            x => x.id,
            x => `${x.reference || x.id} — ${money(x.amount, x.currency)} — ${x.currency || ""}`,
            "Select unmatched statement line"
        );
    }

    async function submitManualMatch(form) {
        const button = $("matchSubmit");
        button.disabled = true;
        button.textContent = "Submitting...";

        try {
            const values = Object.fromEntries(
                new FormData(form).entries()
            );

            if (values.transactionId === values.statementLineId) {
                throw new Error("Select a transaction and a separate statement line.");
            }

            await api(endpoints.matches, {
                method: "POST",
                headers: idempotencyHeaders(),
                body: {
                    transactionId: values.transactionId,
                    statementLineId: values.statementLineId,
                    reason: values.reason.trim(),
                    requestedStatus: "pending_approval",
                    source: "talvora_global_reconciliation"
                }
            });

            $("matchModal").hidden = true;
            form.reset();

            toast("Manual matching request submitted for verification.", "success");

            await Promise.allSettled([
                loadTransactions(),
                loadStatementLines(),
                loadOverview()
            ]);

        } catch (error) {
            toast(`Manual matching failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Submit Match Request";
        }
    }

    /* =========================================
       PROVIDERS
    ========================================= */

    async function loadProviders() {
        const payload = await api(endpoints.providers + query({
            search: $("providerSearch")?.value?.trim(),
            status: $("providerStatus")?.value,
            type: $("providerType")?.value,
            pageSize: 100
        }));

        const items = records(payload, "providers", "integrations", "records", "items");

        $("providerTable").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.name || item.providerName)}</td>
        <td>${esc(item.type || item.providerType)}</td>
        <td>${esc(item.jurisdiction || item.country || "—")}</td>
        <td>${esc(Array.isArray(item.currencies) ? item.currencies.join(", ") : item.currencies || "—")}</td>
        <td>${badge(item.integrationStatus || item.integration_status)}</td>
        <td>${esc(date(item.lastSync || item.last_sync))}</td>
        <td>${badge(item.settlementStatus || item.settlement_status)}</td>
        <td>${badge(item.status)}</td>
        <td>
          <button data-detail="providers" data-id="${esc(item.id)}">Inspect</button>
          <button data-action="review-provider" data-id="${esc(item.id)}">Review</button>
        </td>
      </tr>
    `).join("") : empty(9, "No provider integrations returned.");
    }

    /* =========================================
       EXCEPTIONS
    ========================================= */

    function renderExceptions(items, target = "exceptionTable", recent = false) {
        const element = $(target);
        if (!element) return;

        element.innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.reference || item.id)}</td>
        <td>${esc(item.type || item.exceptionType)}</td>
        <td>${esc(item.transactionReference || item.transactionId || "—")}</td>
        <td>${esc(item.description || item.message || "—")}</td>
        <td>${esc(money(item.expectedAmount, item.currency))}</td>
        <td>${esc(money(item.actualAmount, item.currency))}</td>
        <td>${esc(money(item.variance, item.currency))}</td>
        <td>${badge(item.severity)}</td>
        <td>${badge(item.status)}</td>
        ${recent ? "" : `
          <td>
            <button data-detail="exceptions" data-id="${esc(item.id)}">Inspect</button>
            <button data-action="investigate-exception" data-id="${esc(item.id)}">Investigate</button>
          </td>
        `}
      </tr>
    `).join("") : empty(recent ? 9 : 10, "No reconciliation exceptions returned.");
    }

    async function loadExceptions() {
        const payload = await api(endpoints.exceptions + query({
            search: $("exceptionSearch")?.value?.trim(),
            type: $("exceptionType")?.value,
            severity: $("exceptionSeverity")?.value,
            status: $("exceptionStatus")?.value,
            pageSize: 100
        }));

        renderExceptions(
            records(payload, "exceptions", "records", "items")
        );
    }

    /* =========================================
       FEES AND FOREIGN EXCHANGE
    ========================================= */

    async function loadFees() {
        const payload = await api(endpoints.fees + query({
            search: $("feeSearch")?.value?.trim(),
            type: $("feeType")?.value,
            status: $("feeStatus")?.value,
            pageSize: 100
        }));

        const data = dataOf(payload);
        const summary = data.metrics || data.summary || {};

        metric("fRecorded", money(
            first(summary, "recordedFees", "recorded_fees"),
            summary.currency
        ));

        metric("fExpected", money(
            first(summary, "expectedFees", "expected_fees"),
            summary.currency
        ));

        metric("fVariance", money(
            first(summary, "feeVariance", "fee_variance"),
            summary.currency
        ));

        metric("fFxExceptions", first(
            summary,
            "fxExceptions",
            "fx_exceptions"
        ));

        const items = records(payload, "fees", "records", "items");

        $("feeTable").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.reference || item.id)}</td>
        <td>${esc(item.provider || item.providerName)}</td>
        <td>${esc(item.transactionReference || item.transactionId || "—")}</td>
        <td>${esc(item.type || item.feeType)}</td>
        <td>${esc(item.currency)}</td>
        <td>${esc(money(item.expectedFee, item.currency))}</td>
        <td>${esc(money(item.actualFee, item.currency))}</td>
        <td>${esc(money(item.variance, item.currency))}</td>
        <td>${badge(item.status)}</td>
        <td>
          <button data-detail="fees" data-id="${esc(item.id)}">Inspect</button>
          <button data-action="review-fee" data-id="${esc(item.id)}">Review</button>
        </td>
      </tr>
    `).join("") : empty(10, "No fee records returned.");

        await loadFX();
    }

    async function loadFX() {
        const payload = await api(endpoints.fx + query({
            status: $("fxStatus")?.value,
            pageSize: 100
        }));

        const items = records(payload, "fx", "conversions", "records", "items");

        $("fxTable").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.reference || item.id)}</td>
        <td>${esc(item.fromCurrency)}</td>
        <td>${esc(item.toCurrency)}</td>
        <td>${esc(item.transactionRate ?? "—")}</td>
        <td>${esc(item.settlementRate ?? "—")}</td>
        <td>${esc(money(item.expectedAmount, item.toCurrency))}</td>
        <td>${esc(money(item.actualAmount, item.toCurrency))}</td>
        <td>${esc(money(item.variance, item.toCurrency))}</td>
        <td>${badge(item.status)}</td>
      </tr>
    `).join("") : empty(9, "No FX reconciliation records returned.");
    }

    /* =========================================
       GENERAL LEDGER
    ========================================= */

    async function loadLedger() {
        const payload = await api(endpoints.ledger + query({
            search: $("ledgerSearch")?.value?.trim(),
            status: $("ledgerStatus")?.value,
            currency: $("ledgerCurrency")?.value,
            pageSize: 100
        }));

        const items = records(payload, "entries", "ledger", "records", "items");

        $("ledgerTable").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.journalReference || item.reference || item.id)}</td>
        <td>${esc(item.transactionReference || item.transactionId || "—")}</td>
        <td>${esc(item.accountCode || item.account_code)}</td>
        <td>${esc(item.accountName || item.account_name)}</td>
        <td>${esc(money(item.debit, item.currency))}</td>
        <td>${esc(money(item.credit, item.currency))}</td>
        <td>${esc(item.currency)}</td>
        <td>${esc(date(item.postingDate || item.posting_date))}</td>
        <td>${badge(item.status)}</td>
        <td>
          <button data-detail="ledger" data-id="${esc(item.id)}">Inspect</button>
          <button data-action="review-ledger" data-id="${esc(item.id)}">Review</button>
        </td>
      </tr>
    `).join("") : empty(10, "No general ledger entries returned.");
    }

    /* =========================================
       REPORTS
    ========================================= */

    async function loadReports() {
        const payload = await api(endpoints.reports + query({ pageSize: 100 }));

        const items = records(payload, "reports", "records", "items");

        $("reportTable").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.name || item.title || item.reference)}</td>
        <td>${esc(item.type || item.reportType)}</td>
        <td>${esc(item.jurisdiction || item.country || "Global")}</td>
        <td>${esc(item.currency || "Multiple")}</td>
        <td>${esc(item.reportingPeriod || item.period || "—")}</td>
        <td>${esc(date(item.generatedAt || item.generated_at))}</td>
        <td>${esc(item.owner || item.responsibleTeam || "—")}</td>
        <td>${badge(item.status)}</td>
        <td>
          <button data-detail="reports" data-id="${esc(item.id)}">Inspect</button>
        </td>
      </tr>
    `).join("") : empty(9, "No reconciliation reports returned.");
    }

    /* =========================================
       AUDIT
    ========================================= */

    async function loadAudit() {
        const payload = await api(endpoints.audit + query({
            search: $("auditSearch")?.value?.trim(),
            pageSize: 100
        }));

        const items = records(payload, "audit", "records", "items");

        $("auditTable").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${esc(item.reference || item.id)}</td>
        <td>${esc(item.actorName || item.actor || "—")}</td>
        <td>${esc(item.action || item.operation)}</td>
        <td>${esc(item.resource || item.resourceReference || "—")}</td>
        <td>${esc(item.transactionReference || item.transaction_reference || "—")}</td>
        <td>${esc(item.reason || "—")}</td>
        <td>${esc(date(item.createdAt || item.created_at))}</td>
        <td>${badge(item.result || item.status)}</td>
      </tr>
    `).join("") : empty(8, "No reconciliation audit records returned.");
    }

    /* =========================================
       WORKFLOW ACTIONS
    ========================================= */

    const RESOURCE_ENDPOINTS = {
        runs: endpoints.runs,
        transactions: endpoints.transactions,
        settlements: endpoints.settlements,
        statements: endpoints.statements,
        statementLines: endpoints.statementLines,
        providers: endpoints.providers,
        exceptions: endpoints.exceptions,
        fees: endpoints.fees,
        ledger: endpoints.ledger
    };

    const ACTION_DESCRIPTIONS = {
        "review-run":
            "Requests a documented review of the reconciliation run and its matching results.",

        "investigate-transaction":
            "Requests investigation of the unmatched financial transaction.",

        "review-settlement":
            "Requests review of the settlement batch, payout confirmation and outstanding financial differences.",

        "review-statement":
            "Requests verification of the imported bank statement and its account and period information.",

        "review-provider":
            "Requests review of the banking or payment provider integration and its reconciliation performance.",

        "investigate-exception":
            "Requests investigation of the financial discrepancy. Resolution requires documented evidence and authorized approval.",

        "review-fee":
            "Requests verification of the fee calculation against the applicable provider terms and recorded transaction.",

        "review-ledger":
            "Requests review of the accounting entry and its reconciliation against the originating transaction."
    };

    function requestAction(type, id, action) {
        state.pendingAction = { type, id, action };

        $("actionTitle").textContent = action
            .replace(/-/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase());

        $("actionDescription").textContent =
            ACTION_DESCRIPTIONS[action] ||
            "This financial workflow action requires backend authorization.";

        $("actionReason").value = "";
        $("actionEvidence").value = "";
        $("actionSubmit").disabled = true;

        $("actionModal").hidden = false;
    }

    async function submitAction() {
        const pending = state.pendingAction;
        const reason = $("actionReason").value.trim();

        if (!pending || reason.length < 10) return;

        const button = $("actionSubmit");
        button.disabled = true;
        button.textContent = "Submitting...";

        try {
            const resource = RESOURCE_ENDPOINTS[pending.type];

            if (!resource) {
                throw new Error("Unsupported financial operation.");
            }

            await api(
                `${resource}/${encodeURIComponent(pending.id)}/actions`,
                {
                    method: "POST",
                    headers: idempotencyHeaders(),
                    body: {
                        action: pending.action,
                        reason,
                        evidenceReference:
                            $("actionEvidence").value.trim() || null,
                        source: "talvora_global_reconciliation"
                    }
                }
            );

            $("actionModal").hidden = true;
            state.pendingAction = null;

            toast("Financial review request submitted.", "success");

            await Promise.allSettled([
                loaders[state.section]?.(),
                loadOverview()
            ]);

        } catch (error) {
            toast(`Financial action failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Submit Request";
        }
    }

    /* =========================================
       RECORD DETAILS
    ========================================= */

    async function openDetail(type, id) {
        const resource = RESOURCE_ENDPOINTS[type];

        if (!resource) {
            const reportResource = type === "reports"
                ? endpoints.reports
                : null;

            if (!reportResource) return;
        }

        const path = resource || endpoints.reports;

        try {
            const payload = await api(
                `${path}/${encodeURIComponent(id)}`
            );

            const record = dataOf(payload);

            $("detailTitle").textContent =
                `${type.toUpperCase()} — ${record.reference || record.id || id}`;

            const sensitive = /password|secret|token|credential|private.?key|access.?key|account.?number|iban|swift|card.?number/i;

            $("detailBody").innerHTML = Object.entries(record)
                .filter(([key, value]) =>
                    !sensitive.test(key) &&
                    value !== null &&
                    value !== undefined &&
                    typeof value !== "object"
                )
                .map(([key, value]) => `
          <div class="detail-row">
            <span>${esc(key.replace(/([A-Z])/g, " $1"))}</span>
            <strong>${esc(value)}</strong>
          </div>
        `).join("") ||
                '<p class="muted">No additional record details returned.</p>';

            $("detailModal").hidden = false;

        } catch (error) {
            toast(`Unable to retrieve financial record: ${error.message}`, "error");
        }
    }

    /* =========================================
       AUDIT EXPORT
    ========================================= */

    async function exportAudit() {
        try {
            const response = await fetch(
                url(endpoints.exports + query({
                    type: "financial_reconciliation_audit",
                    format: "csv"
                })),
                {
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        "Accept": "text/csv",
                        "X-CSRF-Token":
                            document.querySelector('meta[name="csrf-token"]')?.content || ""
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Audit export failed (${response.status})`);
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = objectUrl;
            link.download = "talvora-financial-reconciliation-audit.csv";
            link.click();

            URL.revokeObjectURL(objectUrl);

            toast("Financial reconciliation audit exported.", "success");

        } catch (error) {
            toast(error.message, "error");
        }
    }

    /* =========================================
       NAVIGATION
    ========================================= */

    const loaders = {
        overview: loadOverview,
        runs: loadRuns,
        transactions: loadTransactions,
        settlements: loadSettlements,
        statements: loadStatements,
        integrations: loadProviders,
        exceptions: loadExceptions,
        fees: loadFees,
        ledger: loadLedger,
        reports: loadReports,
        audit: loadAudit
    };

    async function navigate(section) {
        if (!loaders[section]) return;

        state.section = section;

        document.querySelectorAll(".section").forEach(element => {
            element.classList.toggle("active", element.id === section);
        });

        document.querySelectorAll(".nav-link").forEach(element => {
            element.classList.toggle(
                "active",
                element.dataset.section === section
            );
        });

        $("sidebar")?.classList.remove("open");

        try {
            await loaders[section]();
        } catch (error) {
            toast(error.message, "error");
        }
    }

    /* =========================================
       EVENT BINDINGS
    ========================================= */

    function bindEvents() {

        document.querySelectorAll("[data-section]").forEach(link => {
            link.addEventListener("click", event => {
                event.preventDefault();
                navigate(link.dataset.section);
            });
        });

        document.querySelectorAll("[data-navigate]").forEach(button => {
            button.addEventListener("click", () => {
                navigate(button.dataset.navigate);
            });
        });

        document.querySelectorAll("[data-open]").forEach(button => {
            button.addEventListener("click", () => {
                $(button.dataset.open).hidden = false;

                if (button.dataset.open === "matchModal") {
                    loadMatchCandidates().catch(error => toast(error.message, "error"));
                }
            });
        });

        document.querySelectorAll("[data-close]").forEach(button => {
            button.addEventListener("click", () => {
                button.closest(".overlay").hidden = true;
            });
        });

        document.querySelectorAll(".overlay").forEach(overlay => {
            overlay.addEventListener("click", event => {
                if (event.target === overlay) {
                    overlay.hidden = true;
                }
            });
        });

        $("menuToggle")?.addEventListener("click", () => {
            $("sidebar").classList.toggle("open");
        });

        $("refreshAll")?.addEventListener("click", refreshAll);

        $("runForm")?.addEventListener("submit", event => {
            event.preventDefault();
            createRun(event.currentTarget);
        });

        $("statementForm")?.addEventListener("submit", event => {
            event.preventDefault();
            importStatement(event.currentTarget);
        });

        $("matchForm")?.addEventListener("submit", event => {
            event.preventDefault();
            submitManualMatch(event.currentTarget);
        });

        $("actionReason")?.addEventListener("input", event => {
            $("actionSubmit").disabled =
                event.target.value.trim().length < 10;
        });

        $("actionSubmit")?.addEventListener("click", submitAction);

        $("exportAudit")?.addEventListener("click", exportAudit);

        /* Search and filter controls */

        const bindings = [
            ["runSearch", "input", loadRuns],
            ["runStatus", "change", loadRuns],
            ["runType", "change", loadRuns],

            ["transactionSearch", "input", loadTransactions],
            ["transactionStatus", "change", loadTransactions],
            ["transactionCurrency", "change", loadTransactions],
            ["transactionSource", "change", loadTransactions],

            ["settlementSearch", "input", loadSettlements],
            ["settlementStatus", "change", loadSettlements],
            ["settlementProvider", "change", loadSettlements],

            ["statementSearch", "input", loadStatements],
            ["statementStatus", "change", loadStatements],
            ["statementAccount", "change", loadStatements],

            ["statementLineSearch", "input", () => loadStatementLines()],
            ["statementLineStatus", "change", () => loadStatementLines()],

            ["providerSearch", "input", loadProviders],
            ["providerStatus", "change", loadProviders],
            ["providerType", "change", loadProviders],

            ["exceptionSearch", "input", loadExceptions],
            ["exceptionType", "change", loadExceptions],
            ["exceptionSeverity", "change", loadExceptions],
            ["exceptionStatus", "change", loadExceptions],

            ["feeSearch", "input", loadFees],
            ["feeType", "change", loadFees],
            ["feeStatus", "change", loadFees],
            ["fxStatus", "change", loadFX],

            ["ledgerSearch", "input", loadLedger],
            ["ledgerStatus", "change", loadLedger],
            ["ledgerCurrency", "change", loadLedger],

            ["auditSearch", "input", loadAudit]
        ];

        bindings.forEach(([id, event, callback]) => {
            $(id)?.addEventListener(
                event,
                event === "input" ? debounce(callback) : callback
            );
        });

        /* Delegated record actions */

        document.addEventListener("click", event => {

            const detail = event.target.closest("[data-detail]");

            if (detail) {
                openDetail(
                    detail.dataset.detail,
                    detail.dataset.id
                );
                return;
            }

            const action = event.target.closest("[data-action]");

            if (action) {
                const actionType = action.dataset.action;

                const resourceMap = {
                    "review-run": "runs",
                    "investigate-transaction": "transactions",
                    "review-settlement": "settlements",
                    "review-statement": "statements",
                    "review-provider": "providers",
                    "investigate-exception": "exceptions",
                    "review-fee": "fees",
                    "review-ledger": "ledger"
                };

                const resource = resourceMap[actionType];

                if (resource) {
                    requestAction(resource, action.dataset.id, actionType);
                }

                return;
            }

            const viewLines = event.target.closest("[data-view-lines]");

            if (viewLines) {
                loadStatementLines(viewLines.dataset.viewLines)
                    .catch(error => toast(error.message, "error"));

                $("statementLineTable")?.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                document.querySelectorAll(".overlay").forEach(element => {
                    element.hidden = true;
                });
            }
        });
    }

    /* =========================================
       REFRESH & INITIALIZATION
    ========================================= */

    async function refreshAll() {
        setStatus("loading", "Refreshing");

        const results = await Promise.allSettled([
            loadReference(),
            loadOverview()
        ]);

        if (results.every(result => result.status === "rejected")) {
            setStatus("error", "Unavailable");
            toast("Reconciliation services could not be reached.", "error");
            return;
        }

        if (state.section !== "overview") {
            await loaders[state.section]?.().catch(error => {
                toast(error.message, "error");
            });
        }

        setStatus("connected", "Connected");
    }

    async function initialize() {
        bindEvents();

        setStatus("loading", "Connecting");

        const results = await Promise.allSettled([
            loadReference(),
            loadOverview()
        ]);

        if (results.every(result => result.status === "rejected")) {
            setStatus("error", "Unavailable");
            console.error("[TALVORA Reconciliation] Initialization failed.");
        }

        if (state.refreshTimer) {
            clearInterval(state.refreshTimer);
        }

        state.refreshTimer = setInterval(() => {
            if (
                document.visibilityState === "visible" &&
                state.section === "overview"
            ) {
                loadOverview().catch(error => {
                    console.warn("[TALVORA Reconciliation]", error);
                });
            }
        }, Number(config.refreshInterval) || 30000);
    }

    /* =========================================
       PUBLIC MODULE INTERFACE
    ========================================= */

    window.TALVORA_RECONCILIATION = {
        refresh: refreshAll,
        navigate,
        loadOverview,
        loadRuns,
        loadTransactions,
        loadSettlements,
        loadStatements,
        loadStatementLines,
        loadProviders,
        loadExceptions,
        loadFees,
        loadFX,
        loadLedger,
        loadReports,
        loadAudit,
        loadMatchCandidates,
        config: {
            apiBaseUrl: base,
            endpoints
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, {
            once: true
        });
    } else {
        initialize();
    }

})();
