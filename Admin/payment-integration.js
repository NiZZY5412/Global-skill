
(() => {
    "use strict";

    /* =========================================================
       TALVORA GLOBAL PAYMENT INTEGRATION & TESTING CENTRE
       ========================================================= */

    const DEFAULT_ENDPOINTS = {
        dashboard:
            "/api/payment-infrastructure/dashboard",

        referenceData:
            "/api/payment-infrastructure/reference-data",

        providers:
            "/api/payment-infrastructure/providers",

        banks:
            "/api/payment-infrastructure/bank-integrations",

        mobileMoney:
            "/api/payment-infrastructure/mobile-money/channels",

        health:
            "/api/payment-infrastructure/health/providers",

        journeys:
            "/api/payment-infrastructure/integration-center/journeys",

        tests:
            "/api/payment-infrastructure/tests",

        webhooks:
            "/api/payment-infrastructure/webhooks",

        settlements:
            "/api/payment-infrastructure/settlements",

        reconciliation:
            "/api/financial-operations/reconciliation",

        reconciliationRuns:
            "/api/financial-operations/reconciliation/runs",

        audit:
            "/api/payment-infrastructure/audit",

        exports:
            "/api/payment-infrastructure/exports"
    };

    const shared = window.TALVORA_ADMIN_CONFIG || {};
    const supplied =
        window.TALVORA_INTEGRATION_CONFIG || {};

    const CONFIG = {
        apiBaseUrl: supplied.apiBaseUrl || shared.apiBaseUrl || "",
        timeout: Number(supplied.timeout || shared.timeout) || 30000,
        refreshInterval:
            Number(supplied.refreshInterval || shared.refreshInterval) || 30000,
        pageSize: Number(supplied.pageSize || shared.pageSize) || 25,

        endpoints: {
            ...DEFAULT_ENDPOINTS,
            ...(supplied.endpoints || {})
        }
    };

    const state = {
        section: "overview",

        connections: [],
        providers: [],
        banks: [],
        mobileMoney: [],
        health: [],
        journeys: [],
        tests: [],
        webhooks: [],
        reconciliation: [],
        audit: [],

        currencies: [],
        countries: [],

        latestTest: null,
        pendingAction: null,

        refreshTimer: null,
        controller: null
    };


    /* =========================================================
       1. DOM UTILITIES
       ========================================================= */

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        [...root.querySelectorAll(selector)];

    function on(selector, event, callback) {
        const element = $(selector);

        if (element) {
            element.addEventListener(event, callback);
        }
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
            if (Array.isArray(data?.[key])) {
                return data[key];
            }

            if (Array.isArray(payload?.[key])) {
                return payload[key];
            }
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
        if (
            amount === null ||
            amount === undefined ||
            amount === ""
        ) {
            return "—";
        }

        if (!currency) return "Currency unavailable";

        const number = Number(amount);

        if (!Number.isFinite(number)) return "—";

        try {
            return new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: String(currency).toUpperCase()
            }).format(number);

        } catch {
            return `${currency} ${formatNumber(number)}`;
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

    function formatDuration(value) {
        if (value === null || value === undefined) {
            return "—";
        }

        const milliseconds = Number(value);

        if (!Number.isFinite(milliseconds)) return "—";

        if (milliseconds < 1000) {
            return `${milliseconds} ms`;
        }

        return `${(milliseconds / 1000).toFixed(2)} sec`;
    }

    function metric(id, value) {
        const element = document.getElementById(id);

        if (!element) return;

        element.textContent =
            value === null || value === undefined
                ? "—"
                : typeof value === "number"
                    ? formatNumber(value)
                    : String(value);
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
        <td colspan="${columns}" class="empty-state">
          ${escapeHTML(message)}
        </td>
      </tr>
    `;
    }

    function buildQuery(params = {}) {
        const query = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (
                value !== undefined &&
                value !== null &&
                value !== ""
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

    function formValues(form) {
        return Object.fromEntries(
            new FormData(form).entries()
        );
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


    /* =========================================================
       2. CONNECTION STATUS
       ========================================================= */

    function setApiStatus(status, message) {
        const element = $("#apiStatus");

        if (!element) return;

        element.className = `api-status ${status}`;

        element.innerHTML = `
      <span class="status-dot"></span>
      ${escapeHTML(message)}
    `;
    }

    function setNotice(message) {
        const element = $("#noticeMessage");

        if (element) {
            element.textContent = message;
        }
    }

    function setEnvironment(environment) {
        const element = $("#environmentLabel");

        if (!element) return;

        const value = String(environment || "SANDBOX").toUpperCase();

        element.textContent = value.replace(/_/g, " ");

        element.className =
            `environment-badge ${value.includes("PRODUCTION")
                ? "production-badge"
                : value.includes("SANDBOX")
                    ? "sandbox-badge"
                    : ""
            }`;
    }


    /* =========================================================
       3. AUTHENTICATED API CLIENT
       ========================================================= */

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
                cache: "no-store",
                signal: controller.signal
            });

            if (!response.ok) {
                const contentType =
                    response.headers.get("content-type") || "";

                let message =
                    `Request failed (${response.status})`;

                if (contentType.includes("application/json")) {
                    const error = await response.json().catch(() => ({}));

                    message =
                        error.message ||
                        error.detail ||
                        error.error ||
                        message;

                } else {
                    const text = await response.text().catch(() => "");

                    if (text) message = text;
                }

                if (response.status === 401) {
                    setApiStatus("error", "Authentication required");
                }

                if (response.status === 403) {
                    message =
                        "Your administrator account is not authorized for this operation.";
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

    function actionHeaders() {
        const headers = {};

        if (window.crypto?.randomUUID) {
            headers["Idempotency-Key"] =
                window.crypto.randomUUID();
        }

        return headers;
    }


    /* =========================================================
       4. REFERENCE DATA
       ========================================================= */

    function populateSelect(element, items, getOption) {
        if (!element) return;

        const previousValue = element.value;

        const firstOption = element.options[0]?.cloneNode(true);

        element.innerHTML = "";

        if (firstOption) {
            element.appendChild(firstOption);
        }

        items.forEach(item => {
            const data = getOption(item);

            if (!data?.value) return;

            const option = document.createElement("option");

            option.value = data.value;
            option.textContent = data.label;

            element.appendChild(option);
        });

        if (
            previousValue &&
            [...element.options].some(
                option => option.value === previousValue
            )
        ) {
            element.value = previousValue;
        }
    }

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

            populateSelect(
                $("#testCurrency"),
                state.currencies,
                item => {
                    const code =
                        item.code ||
                        item.currencyCode ||
                        item.currency_code;

                    return code ? {
                        value: code,
                        label: `${code} — ${item.name || code}`
                    } : null;
                }
            );

        } catch (error) {
            console.warn(
                "[TALVORA Integration] Reference data:",
                error.message
            );
        }
    }

    function populateProviderSelect() {
        populateSelect(
            $("#testProvider"),
            state.providers,
            item => {
                const id =
                    item.id ||
                    item.providerId ||
                    item.provider_id;

                return id ? {
                    value: id,
                    label: item.name || item.displayName || id
                } : null;
            }
        );
    }


    /* =========================================================
       5. CONNECTION REGISTRY
       ========================================================= */

    function normalizeConnection(item, type) {
        return {
            ...item,

            connectionType: type,

            id: item.id ||
                item.providerId ||
                item.provider_id ||
                item.integrationId ||
                item.integration_id,

            displayName:
                item.name ||
                item.displayName ||
                item.display_name ||
                item.institutionName ||
                item.institution_name ||
                "Unnamed connection",

            health:
                item.health ||
                item.healthStatus ||
                item.health_status ||
                item.status ||
                "unknown"
        };
    }

    async function loadConnections() {
        const results = await Promise.allSettled([
            api(CONFIG.endpoints.providers),
            api(CONFIG.endpoints.banks),
            api(CONFIG.endpoints.mobileMoney)
        ]);

        state.providers = results[0].status === "fulfilled"
            ? getRecords(results[0].value, "providers", "items")
            : [];

        state.banks = results[1].status === "fulfilled"
            ? getRecords(results[1].value, "integrations", "banks", "items")
            : [];

        state.mobileMoney = results[2].status === "fulfilled"
            ? getRecords(results[2].value, "channels", "mobileMoney", "mobile_money", "items")
            : [];

        state.connections = [
            ...state.providers.map(item =>
                normalizeConnection(item, "gateway")
            ),

            ...state.banks.map(item =>
                normalizeConnection(item, "bank")
            ),

            ...state.mobileMoney.map(item =>
                normalizeConnection(item, "mobile_money")
            )
        ];

        populateProviderSelect();

        renderConnections(state.connections);

        metric("metricTotalConnections", state.connections.length);
        metric("metricGateways", state.providers.length);
        metric("metricBanks", state.banks.length);
        metric("metricMobileMoney", state.mobileMoney.length);

        const unhealthy = state.connections.filter(item =>
            ["failed", "unavailable", "degraded", "critical"]
                .includes(String(item.health).toLowerCase())
        ).length;

        metric("metricUnhealthy", unhealthy);

        if (results.every(result => result.status === "rejected")) {
            throw new Error("Connection registry endpoints are unavailable.");
        }

        return state.connections;
    }

    function renderConnections(items) {
        const search =
            ($("#connectionSearch")?.value || "").toLowerCase();

        const type = $("#connectionFilter")?.value || "";
        const status = $("#connectionStatus")?.value || "";

        const filtered = items.filter(item => {
            const searchable = [
                item.displayName,
                item.id,
                item.country,
                item.connectionType
            ].join(" ").toLowerCase();

            const matchesSearch = searchable.includes(search);

            const matchesType =
                !type || item.connectionType === type;

            const matchesStatus =
                !status ||
                String(item.status || "").toLowerCase() === status;

            return matchesSearch && matchesType && matchesStatus;
        });

        $("#connectionTable").innerHTML = filtered.length
            ? filtered.map(item => `
        <tr>
          <td>
            ${escapeHTML(item.displayName)}
            <br>
            <small>${escapeHTML(item.id || "—")}</small>
          </td>

          <td>${badge(item.connectionType)}</td>

          <td>${escapeHTML(
                Array.isArray(item.countries)
                    ? item.countries.join(", ")
                    : item.country || item.countries || "—"
            )}</td>

          <td>${escapeHTML(
                Array.isArray(item.currencies)
                    ? item.currencies.join(", ")
                    : item.currencies || "—"
            )}</td>

          <td>${badge(item.environment)}</td>

          <td>${badge(item.health)}</td>

          <td>${badge(item.status)}</td>

          <td>
            <button
              data-detail-type="connections"
              data-id="${escapeHTML(item.id)}"
              data-connection-type="${escapeHTML(item.connectionType)}">
              Inspect
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(8, "No matching connections found.");
    }


    /* =========================================================
       6. INFRASTRUCTURE HEALTH
       ========================================================= */

    function updateArchitectureHealth(items) {
        const mapping = {
            providers: ["gateway"],
            banking: ["bank"],
            mobile_money: ["mobile_money"],
            orchestration: ["orchestration"],
            fx: ["fx"],
            financial_operations: ["financial_operations"]
        };

        Object.entries(mapping).forEach(([key, types]) => {
            const element =
                $(`[data-health="${key}"]`);

            if (!element) return;

            const item = items.find(record =>
                types.includes(
                    String(record.component || record.type || "").toLowerCase()
                )
            );

            if (!item) {
                element.className = "node-state unknown";
                return;
            }

            const status = String(
                item.health || item.status || "unknown"
            ).toLowerCase();

            element.className =
                `node-state ${["healthy", "active", "connected"].includes(status)
                    ? "healthy"
                    : ["degraded", "warning"].includes(status)
                        ? "degraded"
                        : ["failed", "unavailable", "critical"].includes(status)
                            ? "unavailable"
                            : "unknown"
                }`;
        });
    }

    function renderHealthOverview(items) {
        const container = $("#overviewHealth");

        if (!container) return;

        if (!items.length) {
            container.innerHTML =
                '<div class="empty-state">No infrastructure health records returned.</div>';
            return;
        }

        container.innerHTML = items.map(item => `
      <div class="health-row">
        <div>
          <strong>${escapeHTML(
            item.name ||
            item.providerName ||
            item.provider_name ||
            item.component ||
            "Infrastructure component"
        )}</strong>

          <small>
            ${escapeHTML(item.latencyMs ?? item.latency_ms ?? "—")} ms
            · ${escapeHTML(item.environment || "—")}
          </small>
        </div>

        ${badge(item.health || item.status)}
      </div>
    `).join("");
    }

    async function loadHealth() {
        const payload = await api(CONFIG.endpoints.health);

        state.health = getRecords(
            payload,
            "providers",
            "health",
            "components",
            "items"
        );

        renderHealthOverview(state.health);
        updateArchitectureHealth(state.health);

        return state.health;
    }


    /* =========================================================
       7. OVERVIEW DASHBOARD
       ========================================================= */

    function renderOverviewRuns(items) {
        const container = $("#overviewRunTable");

        if (!container) return;

        container.innerHTML = items.length
            ? items.slice(0, 8).map(item => `
        <tr>
          <td>${escapeHTML(item.id || item.reference)}</td>

          <td>${escapeHTML(
                humanize(item.testType || item.test_type)
            )}</td>

          <td>${escapeHTML(
                item.providerName || item.provider_name || "—"
            )}</td>

          <td>${badge(item.environment)}</td>

          <td>${escapeHTML(
                formatDate(item.startedAt || item.started_at || item.createdAt)
            )}</td>

          <td>${escapeHTML(
                formatDuration(item.durationMs ?? item.duration_ms)
            )}</td>

          <td>${badge(item.result || item.status)}</td>

          <td>
            <button
              data-detail-type="tests"
              data-id="${escapeHTML(item.id)}">
              Details
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(8, "No test executions have been recorded.");
    }

    async function loadOverview() {
        setApiStatus("loading", "Updating");

        const results = await Promise.allSettled([
            api(CONFIG.endpoints.dashboard),
            api(CONFIG.endpoints.health),
            api(CONFIG.endpoints.tests),
            api(CONFIG.endpoints.reconciliation)
        ]);

        let successful = 0;

        if (results[0].status === "fulfilled") {
            successful++;

            const data = getData(results[0].value);

            if (data.environment) {
                setEnvironment(data.environment);
            }
        }

        if (results[1].status === "fulfilled") {
            successful++;

            state.health = getRecords(
                results[1].value,
                "providers",
                "health",
                "components",
                "items"
            );

            renderHealthOverview(state.health);
            updateArchitectureHealth(state.health);
        }

        if (results[2].status === "fulfilled") {
            successful++;

            state.tests = getRecords(
                results[2].value,
                "tests",
                "results",
                "items"
            );

            renderOverviewRuns(state.tests);

            const failed = state.tests.filter(item =>
                ["failed", "error"].includes(
                    String(item.result || item.status).toLowerCase()
                )
            ).length;

            metric("metricFailedTests", failed);
        }

        if (results[3].status === "fulfilled") {
            successful++;

            const data = getData(results[3].value);

            const metrics =
                data.metrics || data.summary || {};

            const exceptions = getRecords(
                results[3].value,
                "exceptions",
                "records",
                "items"
            );

            const exceptionCount = getValue(
                metrics,
                "openExceptions",
                "open_exceptions",
                "exceptionCount",
                "exception_count"
            );

            metric(
                "metricOpenExceptions",
                exceptionCount ??
                exceptions.filter(item =>
                    !["resolved", "closed", "matched"].includes(
                        String(item.status).toLowerCase()
                    )
                ).length
            );
        }

        metric("metricTotalConnections", state.connections.length);

        if (successful > 0) {
            setApiStatus("connected", "Connected");

            setNotice(
                "Integration monitoring is retrieving live payment infrastructure data."
            );
        } else {
            setApiStatus("error", "Unavailable");

            setNotice(
                "Dashboard services could not be reached. Check authentication and backend connectivity."
            );
        }

        return successful;
    }


    /* =========================================================
       8. PAYMENT LIFECYCLE
       ========================================================= */

    async function loadJourneys() {
        const payload = await api(CONFIG.endpoints.journeys);

        state.journeys = getRecords(
            payload,
            "journeys",
            "traces",
            "payments",
            "items"
        );

        renderJourneys(state.journeys);

        return state.journeys;
    }

    function renderJourneys(items) {
        $("#journeyTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.traceReference || item.trace_reference || item.id)}</td>

          <td>${escapeHTML(item.paymentReference || item.payment_reference || "—")}</td>

          <td>${escapeHTML(item.country || "—")}</td>

          <td>${escapeHTML(item.currency || "—")}</td>

          <td>${escapeHTML(item.providerName || item.provider_name || "—")}</td>

          <td>${badge(item.currentStage || item.current_stage || item.stage)}</td>

          <td>${badge(item.ledgerStatus || item.ledger_status)}</td>

          <td>${badge(item.settlementStatus || item.settlement_status)}</td>

          <td>
            <button
              data-detail-type="journeys"
              data-id="${escapeHTML(item.id)}">
              Trace
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(9, "No payment lifecycle records returned.");
    }


    /* =========================================================
       9. INTEGRATION TEST EXECUTION
       ========================================================= */

    function renderTestResult(record) {
        const notice = $("#testResultNotice");
        const details = $("#testResultDetails");

        if (!record) return;

        if (notice) notice.hidden = true;

        if (!details) return;

        details.hidden = false;

        const result = record.result || record.status || "pending";

        details.innerHTML = `
      <div class="result-summary">

        <h4>Integration Test Result</h4>

        <div class="result-line">
          <span>Execution Reference</span>
          <strong>${escapeHTML(record.id || record.reference || "—")}</strong>
        </div>

        <div class="result-line">
          <span>Test Suite</span>
          <strong>${escapeHTML(humanize(record.testType || record.test_type))}</strong>
        </div>

        <div class="result-line">
          <span>Provider</span>
          <strong>${escapeHTML(record.providerName || record.provider_name || "—")}</strong>
        </div>

        <div class="result-line">
          <span>Environment</span>
          <strong>${escapeHTML(humanize(record.environment))}</strong>
        </div>

        <div class="result-line">
          <span>Duration</span>
          <strong>${escapeHTML(formatDuration(record.durationMs ?? record.duration_ms))}</strong>
        </div>

        <div class="result-line">
          <span>Result</span>
          ${badge(result)}
        </div>

        <div class="result-line">
          <span>Message</span>
          <strong>${escapeHTML(record.message || "Awaiting detailed execution results.")}</strong>
        </div>

        <div class="result-line">
          <span>Completed</span>
          <strong>${escapeHTML(formatDate(record.completedAt || record.completed_at))}</strong>
        </div>

      </div>
    `;
    }

    async function runIntegrationTest(form) {
        const button = $("#testRunButton");

        const values = formValues(form);

        if (
            !values.providerId ||
            !values.reason?.trim() ||
            !values.country?.trim()
        ) {
            toast("Complete the required test configuration.", "error");
            return;
        }

        const environment = values.environment;
        const testType = values.testType;

        if (
            environment === "production_health_check" &&
            !["connectivity", "authentication"].includes(testType)
        ) {
            toast(
                "Production permits only approved non-monetary connectivity and authentication checks.",
                "error"
            );
            return;
        }

        if (
            environment === "production_health_check" &&
            values.scenario !== "standard_success"
        ) {
            toast(
                "Production health checks cannot use payment failure or transaction simulation scenarios.",
                "error"
            );
            return;
        }

        if (testType === "full_e2e" && !values.currency) {
            toast("Select a currency for the full end-to-end test.", "error");
            return;
        }

        button.disabled = true;
        button.textContent = "Submitting Test...";

        setApiStatus("loading", "Test executing");

        try {
            const payload = await api(CONFIG.endpoints.tests, {
                method: "POST",
                headers: actionHeaders(),

                body: {
                    providerId: values.providerId,

                    testType,

                    environment,

                    country: values.country.trim().toUpperCase(),

                    currency: values.currency || null,

                    channel: values.channel,

                    scenario: values.scenario,

                    reason: values.reason.trim(),

                    source: "talvora_global_integration_centre",

                    executionMode:
                        environment === "sandbox"
                            ? "sandbox"
                            : "non_monetary_health_check"
                }
            });

            const record = getData(payload);

            state.latestTest = record;

            renderTestResult(record);

            toast(
                "Integration test submitted. Check execution status for the final result.",
                "success"
            );

            await loadTests();

            await loadOverview();

        } catch (error) {
            toast(
                `Integration test could not be submitted: ${error.message}`,
                "error"
            );

            setApiStatus("error", "Test submission failed");

        } finally {
            button.disabled = false;
            button.textContent = "▶ Execute Integration Test";
        }
    }


    /* =========================================================
       10. TEST HISTORY
       ========================================================= */

    async function loadTests() {
        const payload = await api(
            CONFIG.endpoints.tests + buildQuery({
                search: $("#historySearch")?.value?.trim(),
                status: $("#historyStatus")?.value,
                pageSize: CONFIG.pageSize
            })
        );

        state.tests = getRecords(
            payload,
            "tests",
            "results",
            "items"
        );

        renderHistory(state.tests);

        return state.tests;
    }

    function renderHistory(items) {
        $("#historyTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || item.reference)}</td>

          <td>${escapeHTML(
                humanize(item.testType || item.test_type)
            )}</td>

          <td>${escapeHTML(item.providerName || item.provider_name || "—")}</td>

          <td>${badge(item.environment)}</td>

          <td>${escapeHTML(item.executor || item.executedBy || item.executed_by || "—")}</td>

          <td>${escapeHTML(formatDate(item.startedAt || item.started_at || item.createdAt))}</td>

          <td>${escapeHTML(formatDuration(item.durationMs ?? item.duration_ms))}</td>

          <td>${badge(item.result || item.status)}</td>

          <td>
            <button
              data-detail-type="tests"
              data-id="${escapeHTML(item.id)}">
              Investigate
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(9, "No matching execution records.");
    }


    /* =========================================================
       11. WEBHOOK VERIFICATION
       ========================================================= */

    async function loadWebhooks() {
        const payload = await api(
            CONFIG.endpoints.webhooks + buildQuery({
                search: $("#webhookSearch")?.value?.trim(),
                status: $("#webhookStatus")?.value
            })
        );

        const data = getData(payload);

        const metrics = data.metrics || data.summary || {};

        state.webhooks = getRecords(
            payload,
            "events",
            "webhooks",
            "items"
        );

        metric(
            "metricWebhookReceived",
            getValue(metrics, "received", "receivedEvents", "received_events")
        );

        metric(
            "metricWebhookVerified",
            getValue(metrics, "verified", "verifiedEvents", "verified_events")
        );

        metric(
            "metricWebhookFailed",
            getValue(metrics, "failed", "failedDeliveries", "failed_deliveries")
        );

        metric(
            "metricWebhookSignatures",
            getValue(metrics, "signatureFailures", "signature_failures")
        );

        renderWebhooks(state.webhooks);

        return state.webhooks;
    }

    function renderWebhooks(items) {
        $("#webhookTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id)}</td>

          <td>${escapeHTML(item.providerName || item.provider_name || "—")}</td>

          <td>${escapeHTML(item.eventType || item.event_type || "—")}</td>

          <td>${escapeHTML(item.paymentReference || item.payment_reference || item.reference || "—")}</td>

          <td>${badge(item.signatureStatus || item.signature_status)}</td>

          <td>${escapeHTML(formatDate(item.receivedAt || item.received_at))}</td>

          <td>${escapeHTML(formatNumber(item.attempts))}</td>

          <td>${badge(item.status)}</td>

          <td>
            <button
              data-detail-type="webhooks"
              data-id="${escapeHTML(item.id)}">
              Inspect
            </button>

            ${["failed", "retrying"].includes(
                String(item.status).toLowerCase()
            )
                    ? `
                  <button
                    class="danger-action"
                    data-action="replay-webhook"
                    data-id="${escapeHTML(item.id)}">
                    Replay
                  </button>
                `
                    : ""
                }
          </td>
        </tr>
      `).join("")
            : emptyRow(9, "No webhook events found.");
    }


    /* =========================================================
       12. FINANCIAL RECONCILIATION
       ========================================================= */

    async function loadReconciliation() {
        const payload = await api(CONFIG.endpoints.reconciliation);

        const data = getData(payload);

        const metrics = data.metrics || data.summary || {};

        state.reconciliation = getRecords(
            payload,
            "exceptions",
            "records",
            "reconciliation",
            "items"
        );

        metric(
            "reconPending",
            getValue(metrics, "pending", "pendingReconciliation", "pending_reconciliation")
        );

        metric(
            "reconMatched",
            getValue(metrics, "matched", "matchedRecords", "matched_records")
        );

        const exceptions = getValue(
            metrics,
            "exceptions",
            "exceptionCount",
            "exception_count"
        );

        metric(
            "reconExceptions",
            exceptions ?? state.reconciliation.length
        );

        const unmatchedValue = getValue(
            metrics,
            "unmatchedValue",
            "unmatched_value"
        );

        const currency = getValue(
            metrics,
            "currency",
            "reportingCurrency",
            "reporting_currency"
        );

        metric(
            "reconValue",
            unmatchedValue === undefined
                ? undefined
                : formatMoney(unmatchedValue, currency)
        );

        renderReconciliation(state.reconciliation);

        return state.reconciliation;
    }

    function renderReconciliation(items) {
        $("#reconciliationTable").innerHTML = items.length
            ? items.map(item => {
                const settlementAmount =
                    getValue(item, "settlementAmount", "settlement_amount");

                const ledgerAmount =
                    getValue(item, "ledgerAmount", "ledger_amount");

                const difference =
                    getValue(item, "difference", "amountDifference", "amount_difference");

                return `
            <tr>
              <td>${escapeHTML(item.reference || item.id)}</td>

              <td>${escapeHTML(item.providerName || item.provider_name || "—")}</td>

              <td>${escapeHTML(formatMoney(settlementAmount, item.currency))}</td>

              <td>${escapeHTML(formatMoney(ledgerAmount, item.currency))}</td>

              <td>${escapeHTML(formatMoney(difference, item.currency))}</td>

              <td>${escapeHTML(item.currency || "—")}</td>

              <td>${escapeHTML(formatDate(item.detectedAt || item.detected_at))}</td>

              <td>${badge(item.status)}</td>

              <td>
                <button
                  data-detail-type="reconciliation"
                  data-id="${escapeHTML(item.id)}">
                  Investigate
                </button>
              </td>
            </tr>
          `;
            }).join("")
            : emptyRow(9, "No reconciliation exceptions returned.");
    }


    /* =========================================================
       13. INTEGRATION AUDIT
       ========================================================= */

    async function loadAudit() {
        const payload = await api(
            CONFIG.endpoints.audit + buildQuery({
                search: $("#auditSearch")?.value?.trim(),
                action: $("#auditAction")?.value,
                pageSize: CONFIG.pageSize
            })
        );

        state.audit = getRecords(
            payload,
            "records",
            "audit",
            "items"
        );

        renderAudit(state.audit);

        return state.audit;
    }

    function renderAudit(items) {
        $("#auditTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id)}</td>

          <td>${escapeHTML(
                item.administrator ||
                item.actorName ||
                item.actor_name ||
                "—"
            )}</td>

          <td>${escapeHTML(
                humanize(item.action || item.operation)
            )}</td>

          <td>${escapeHTML(
                item.resource || item.resourceId || item.resource_id || "—"
            )}</td>

          <td>${badge(item.environment)}</td>

          <td>${escapeHTML(item.reason || "—")}</td>

          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>

          <td>${badge(item.result || item.status)}</td>

          <td>
            <button
              data-detail-type="audit"
              data-id="${escapeHTML(item.id)}">
              Inspect
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(9, "No audit records found.");
    }


    /* =========================================================
       14. RECORD DETAILS
       ========================================================= */

    const DETAIL_ENDPOINTS = {
        tests: CONFIG.endpoints.tests,
        webhooks: CONFIG.endpoints.webhooks,
        journeys: CONFIG.endpoints.journeys,
        reconciliation: CONFIG.endpoints.reconciliation,
        audit: CONFIG.endpoints.audit
    };

    function getConnectionEndpoint(type) {
        if (type === "gateway") return CONFIG.endpoints.providers;

        if (type === "bank") return CONFIG.endpoints.banks;

        if (type === "mobile_money") return CONFIG.endpoints.mobileMoney;

        return null;
    }

    function detailValue(value) {
        if (value === null || value === undefined) return "—";

        if (Array.isArray(value)) {
            return value.join(", ");
        }

        if (typeof value === "object") {
            return JSON.stringify(value);
        }

        return String(value);
    }

    function renderRecordDetails(record) {
        return Object.entries(record)
            .filter(([key, value]) =>
                ![
                    "rawPayload",
                    "raw_payload",
                    "secret",
                    "password",
                    "accessToken",
                    "access_token",
                    "apiKey",
                    "api_key"
                ].includes(key) &&
                value !== null &&
                value !== undefined &&
                typeof value !== "function"
            )
            .map(([key, value]) => `
        <div class="detail-row">
          <span>${escapeHTML(humanize(key))}</span>
          <strong>${escapeHTML(detailValue(value))}</strong>
        </div>
      `)
            .join("");
    }

    async function openDetails(type, id, connectionType) {
        let base = DETAIL_ENDPOINTS[type];

        if (type === "connections") {
            base = getConnectionEndpoint(connectionType);
        }

        if (!base) {
            toast("Unsupported record type.", "error");
            return;
        }

        try {
            const payload = await api(
                `${base}/${encodeURIComponent(id)}`
            );

            const record = getData(payload);

            $("#detailTitle").textContent =
                `${humanize(type)} — ${record.reference || record.name || record.id || id}`;

            $("#detailBody").innerHTML =
                renderRecordDetails(record);

            $("#detailActions").innerHTML = `
        <button class="secondary-button" data-close-modal>
          Close
        </button>
      `;

            if (
                type === "webhooks" &&
                ["failed", "retrying"].includes(
                    String(record.status).toLowerCase()
                )
            ) {
                $("#detailActions").insertAdjacentHTML(
                    "afterbegin",
                    `
            <button
              class="danger-button"
              data-action="replay-webhook"
              data-id="${escapeHTML(id)}">
              Request Webhook Replay
            </button>
          `
                );
            }

            $("#detailModal").hidden = false;

        } catch (error) {
            toast(
                `Unable to retrieve record: ${error.message}`,
                "error"
            );
        }
    }


    /* =========================================================
       15. PROTECTED OPERATION WORKFLOW
       ========================================================= */

    function requestAction(action) {
        state.pendingAction = action;

        const title = action.type === "webhook"
            ? "Request Webhook Replay"
            : "Request Financial Reconciliation";

        const description = action.type === "webhook"
            ? "The server must verify event authenticity, replay eligibility, event idempotency and the provider's original transaction outcome before authorizing replay."
            : "This requests a read-only reconciliation run across the configured financial records. Any discrepancies must be reported for controlled investigation.";

        $("#actionTitle").textContent = title;
        $("#actionDescription").textContent = description;
        $("#actionReason").value = "";

        $("#actionConfirm").disabled = true;

        $("#actionModal").hidden = false;
    }

    function validateAction() {
        const reason = $("#actionReason").value.trim();

        $("#actionConfirm").disabled = reason.length < 10;
    }

    async function executeAction() {
        const action = state.pendingAction;

        if (!action) return;

        const reason = $("#actionReason").value.trim();

        if (reason.length < 10) {
            toast(
                "Provide a meaningful operational justification.",
                "error"
            );
            return;
        }

        const button = $("#actionConfirm");

        button.disabled = true;
        button.textContent = "Submitting...";

        try {
            if (action.type === "webhook") {
                await api(
                    `${CONFIG.endpoints.webhooks}/${encodeURIComponent(action.id)}/replay`,
                    {
                        method: "POST",
                        headers: actionHeaders(),
                        body: {
                            reason,
                            source: "talvora_integration_centre",
                            mode: "controlled_replay"
                        }
                    }
                );

                toast(
                    "Webhook replay request submitted for backend validation.",
                    "success"
                );

                await loadWebhooks();

            } else if (action.type === "reconciliation") {
                await api(CONFIG.endpoints.reconciliationRuns, {
                    method: "POST",
                    headers: actionHeaders(),
                    body: {
                        reason,
                        scope: "payment_infrastructure",
                        mode: "read_only",
                        source: "talvora_integration_centre"
                    }
                });

                toast(
                    "Reconciliation request submitted.",
                    "success"
                );

                await loadReconciliation();
            }

            $("#actionModal").hidden = true;

            state.pendingAction = null;

        } catch (error) {
            toast(
                `Operation request failed: ${error.message}`,
                "error"
            );

        } finally {
            button.disabled = false;
            button.textContent = "Submit Request";
        }
    }


    /* =========================================================
       16. AUDIT EXPORT
       ========================================================= */

    async function exportAudit() {
        try {
            const url = endpoint(
                CONFIG.endpoints.exports +
                buildQuery({
                    type: "integration_audit",
                    format: "csv"
                })
            );

            const response = await fetch(url, {
                method: "GET",
                credentials: "include",
                cache: "no-store",
                headers: {
                    "Accept": "text/csv",
                    "X-CSRF-Token":
                        $('meta[name="csrf-token"]')?.content || ""
                }
            });

            if (!response.ok) {
                throw new Error(
                    `Audit export failed (${response.status})`
                );
            }

            const blob = await response.blob();

            const downloadURL = URL.createObjectURL(blob);

            const link = document.createElement("a");

            link.href = downloadURL;
            link.download = "talvora-integration-audit.csv";

            document.body.appendChild(link);

            link.click();
            link.remove();

            setTimeout(
                () => URL.revokeObjectURL(downloadURL),
                1000
            );

            toast("Audit export downloaded.", "success");

        } catch (error) {
            toast(error.message, "error");
        }
    }


    /* =========================================================
       17. NAVIGATION
       ========================================================= */

    const LOADERS = {
        overview: loadOverview,
        integrations: loadConnections,
        journeys: loadJourneys,
        "test-lab": loadTests,
        webhooks: loadWebhooks,
        reconciliation: loadReconciliation,
        history: loadTests,
        audit: loadAudit
    };

    async function navigate(section) {
        const target = document.getElementById(section);

        if (!target) return;

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

        $("#sidebar")?.classList.remove("open");

        if (LOADERS[section]) {
            try {
                await LOADERS[section]();
            } catch (error) {
                toast(error.message, "error");
            }
        }
    }


    /* =========================================================
       18. REFRESH MANAGEMENT
       ========================================================= */

    async function refreshCurrentSection() {
        const loader = LOADERS[state.section];

        if (!loader) return;

        try {
            await loader();

            toast("Section refreshed.", "success");

        } catch (error) {
            toast(error.message, "error");
        }
    }

    async function refreshAll() {
        setApiStatus("loading", "Refreshing");

        const results = await Promise.allSettled([
            loadReferenceData(),
            loadConnections(),
            loadOverview()
        ]);

        const successful = results.filter(
            result => result.status === "fulfilled"
        ).length;

        if (successful === 0) {
            setApiStatus("error", "Unavailable");
            toast("Infrastructure refresh failed.", "error");
            return;
        }

        const loader = LOADERS[state.section];

        if (loader && state.section !== "overview" &&
            state.section !== "integrations") {
            await loader().catch(error => {
                toast(error.message, "error");
            });
        }

        setApiStatus("connected", "Connected");
    }


    /* =========================================================
       19. EVENT BINDINGS
       ========================================================= */

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

        on("#navToggle", "click", () => {
            $("#sidebar")?.classList.toggle("open");
        });


        /* Refresh */

        on("#refreshAll", "click", refreshAll);

        $$("[data-refresh]").forEach(button => {
            button.addEventListener(
                "click",
                refreshCurrentSection
            );
        });


        /* Quick test */

        on("#runTestQuick", "click", () => {
            navigate("test-lab");

            setTimeout(() => {
                $("#testType")?.focus();
            }, 100);
        });


        /* Connection filters */

        on("#connectionSearch", "input", () => {
            renderConnections(state.connections);
        });

        on("#connectionFilter", "change", () => {
            renderConnections(state.connections);
        });

        on("#connectionStatus", "change", () => {
            renderConnections(state.connections);
        });

        on("#connectionReset", "click", () => {
            $("#connectionSearch").value = "";
            $("#connectionFilter").value = "";
            $("#connectionStatus").value = "";

            renderConnections(state.connections);
        });


        /* Test laboratory */

        on("#testForm", "submit", event => {
            event.preventDefault();

            runIntegrationTest(event.currentTarget);
        });


        /* Test environment protection */

        on("#testEnvironment", "change", event => {
            const production =
                event.target.value === "production_health_check";

            const testType = $("#testType");

            if (production && testType.value === "full_e2e") {
                testType.value = "connectivity";
            }

            $$("#testType option").forEach(option => {
                if (
                    production &&
                    !["connectivity", "authentication"].includes(option.value)
                ) {
                    option.disabled = true;
                } else {
                    option.disabled = false;
                }
            });

            const scenario = $("#testScenario");

            if (production) {
                scenario.value = "standard_success";
                scenario.disabled = true;
            } else {
                scenario.disabled = false;
            }

            toast(
                production
                    ? "Production testing is restricted to non-monetary health checks."
                    : "Sandbox testing is selected.",
                "info"
            );
        });


        /* Webhook filters */

        const webhookSearch = debounce(
            loadWebhooks,
            350
        );

        on("#webhookSearch", "input", webhookSearch);

        on("#webhookStatus", "change", loadWebhooks);


        /* Test history filters */

        const historySearch = debounce(
            loadTests,
            350
        );

        on("#historySearch", "input", historySearch);

        on("#historyStatus", "change", loadTests);


        /* Audit filters */

        const auditSearch = debounce(
            loadAudit,
            350
        );

        on("#auditSearch", "input", auditSearch);

        on("#auditAction", "change", loadAudit);


        /* Reconciliation */

        on("#runReconciliation", "click", () => {
            requestAction({
                type: "reconciliation"
            });
        });


        /* Action confirmation */

        on("#actionReason", "input", validateAction);

        on("#actionConfirm", "click", executeAction);


        /* Audit export */

        on("#exportAudit", "click", exportAudit);


        /* Dynamic record inspection */

        document.addEventListener("click", event => {

            const detailButton =
                event.target.closest("[data-detail-type]");

            if (detailButton) {
                openDetails(
                    detailButton.dataset.detailType,
                    detailButton.dataset.id,
                    detailButton.dataset.connectionType
                );

                return;
            }

            const actionButton =
                event.target.closest("[data-action]");

            if (actionButton) {
                const action = actionButton.dataset.action;

                if (action === "replay-webhook") {
                    requestAction({
                        type: "webhook",
                        id: actionButton.dataset.id
                    });
                }
            }

        });


        /* Modal controls */

        document.addEventListener("click", event => {

            const closeButton =
                event.target.closest("[data-close-modal]");

            if (closeButton) {
                const modal =
                    closeButton.closest(".modal-overlay");

                if (modal) modal.hidden = true;
            }

        });


        $$(".modal-overlay").forEach(modal => {
            modal.addEventListener("click", event => {
                if (event.target === modal) {
                    modal.hidden = true;
                }
            });
        });


        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                $$(".modal-overlay").forEach(modal => {
                    modal.hidden = true;
                });
            }
        });

    }


    /* =========================================================
       20. DEBOUNCE
       ========================================================= */

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


    /* =========================================================
       21. APPLICATION INITIALIZATION
       ========================================================= */

    async function initialize() {
        bindEvents();

        setApiStatus("loading", "Connecting");

        setEnvironment("SANDBOX");

        await Promise.allSettled([
            loadReferenceData(),
            loadConnections()
        ]);

        await loadOverview().catch(error => {
            setApiStatus("error", "Connection issue");

            setNotice(error.message);
        });

        if (state.refreshTimer) {
            clearInterval(state.refreshTimer);
        }

        state.refreshTimer = setInterval(() => {
            if (
                document.visibilityState === "visible" &&
                state.section === "overview"
            ) {
                loadOverview().catch(error => {
                    console.warn(
                        "[TALVORA Integration]",
                        error.message
                    );
                });
            }
        }, CONFIG.refreshInterval);

    }


    /* =========================================================
       22. PUBLIC MODULE INTERFACE
       ========================================================= */

    window.TALVORA_PAYMENT_INTEGRATION = {

        refresh: refreshAll,

        navigate,

        loadOverview,
        loadConnections,
        loadHealth,
        loadJourneys,
        loadTests,
        loadWebhooks,
        loadReconciliation,
        loadAudit,

        runIntegrationTest,

        config: CONFIG

    };


    /* =========================================================
       23. START APPLICATION
       ========================================================= */

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
