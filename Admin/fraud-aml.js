
(() => {
    "use strict";

    /* =========================================================
       TALVORA GLOBAL FRAUD PREVENTION & AML CENTRE
       ========================================================= */

    const DEFAULT_ENDPOINTS = {
        dashboard:
            "/api/financial-crime/dashboard",

        referenceData:
            "/api/financial-crime/reference-data",

        health:
            "/api/financial-crime/health",

        alerts:
            "/api/financial-crime/alerts",

        transactions:
            "/api/financial-crime/transactions",

        screening:
            "/api/financial-crime/screening",

        screeningSearch:
            "/api/financial-crime/screening/search",

        rules:
            "/api/financial-crime/rules",

        investigations:
            "/api/financial-crime/investigations",

        cases:
            "/api/financial-crime/cases",

        compliance:
            "/api/financial-crime/compliance/obligations",

        reports:
            "/api/financial-crime/compliance/reports",

        audit:
            "/api/financial-crime/audit",

        exports:
            "/api/financial-crime/exports"
    };


    const supplied =
        window.TALVORA_FRAUD_CONFIG || {};


    const CONFIG = {
        apiBaseUrl: supplied.apiBaseUrl || "",

        timeout: Number(supplied.timeout) || 30000,

        refreshInterval:
            Number(supplied.refreshInterval) || 30000,

        pageSize: Number(supplied.pageSize) || 25,

        endpoints: {
            ...DEFAULT_ENDPOINTS,
            ...(supplied.endpoints || {})
        }
    };


    const state = {

        section: "overview",

        alerts: [],
        transactions: [],
        screenings: [],
        rules: [],
        investigations: [],
        cases: [],
        compliance: [],
        reports: [],
        audit: [],
        health: [],

        countries: [],

        pendingAction: null,

        refreshTimer: null,

        latestScreening: null,

        initialized: false

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

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
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

        if (Array.isArray(payload)) {
            return payload;
        }

        const data = getData(payload);

        if (Array.isArray(data)) {
            return data;
        }

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


    function metric(id, value) {

        const element = document.getElementById(id);

        if (!element) return;

        element.textContent =
            value === null || value === undefined
                ? "—"
                : typeof value === "number"
                    ? new Intl.NumberFormat().format(value)
                    : String(value);

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


    function formatMoney(amount, currency) {

        if (
            amount === null ||
            amount === undefined ||
            amount === ""
        ) {
            return "—";
        }

        const number = Number(amount);

        if (!Number.isFinite(number)) {
            return "—";
        }

        if (!currency) {
            return `${number.toLocaleString()} (currency unavailable)`;
        }

        try {

            return new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: String(currency).toUpperCase()
            }).format(number);

        } catch {

            return `${currency} ${number.toLocaleString()}`;

        }

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
       2. CONNECTION AND ENVIRONMENT STATUS
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

        const value =
            String(environment || "MONITORING").toUpperCase();

        const label = $("#environmentLabel");

        if (label) {

            label.textContent = value.replace(/_/g, " ");

            label.className =
                "environment-badge";

        }

        const sidebar = $("#sidebarEnvironment");

        if (sidebar) {
            sidebar.textContent = humanize(value);
        }

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

        const csrf =
            $('meta[name="csrf-token"]')?.content;

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

                    const error = await response
                        .json()
                        .catch(() => ({}));

                    message =
                        error.message ||
                        error.detail ||
                        error.error ||
                        message;

                } else {

                    const errorText = await response
                        .text()
                        .catch(() => "");

                    if (errorText) {
                        message = errorText;
                    }

                }


                if (response.status === 401) {

                    setApiStatus(
                        "error",
                        "Authentication required"
                    );

                }


                if (response.status === 403) {

                    message =
                        "Your administrator account is not authorized for this operation.";

                }


                throw new Error(message);

            }


            if (response.status === 204) {
                return null;
            }


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

    function populateSelect(element, items, mapper) {

        if (!element) return;

        const previous = element.value;

        const firstOption =
            element.options[0]?.cloneNode(true);

        element.innerHTML = "";

        if (firstOption) {
            element.appendChild(firstOption);
        }

        items.forEach(item => {

            const optionData = mapper(item);

            if (!optionData?.value) return;

            const option = document.createElement("option");

            option.value = optionData.value;

            option.textContent = optionData.label;

            element.appendChild(option);

        });

        if (
            previous &&
            [...element.options].some(
                option => option.value === previous
            )
        ) {

            element.value = previous;

        }

    }


    async function loadReferenceData() {

        try {

            const payload = await api(
                CONFIG.endpoints.referenceData
            );

            const data = getData(payload);

            state.countries = getRecords(
                data,
                "countries",
                "supportedCountries",
                "supported_countries"
            );


            const countryMapper = item => {

                const code =
                    item.code ||
                    item.countryCode ||
                    item.country_code;

                if (!code) return null;

                return {
                    value: code,
                    label: `${item.name || code} (${code})`
                };

            };


            populateSelect(
                $("#screeningCountry"),
                state.countries,
                countryMapper
            );


            populateSelect(
                $("#transactionCountry"),
                state.countries,
                countryMapper
            );


            populateSelect(
                $("#complianceCountry"),
                state.countries,
                countryMapper
            );


        } catch (error) {

            console.warn(
                "[TALVORA Financial Crime] Reference data:",
                error.message
            );

        }

    }


    /* =========================================================
       5. RISK DISTRIBUTION
       ========================================================= */

    function renderRiskDistribution(items) {

        const container = $("#riskDistribution");

        if (!container) return;

        const levels = [
            "critical",
            "high",
            "medium",
            "low"
        ];


        const counts = levels.map(level => {

            const record = items.find(item =>
                String(item.level || item.severity || "")
                    .toLowerCase() === level
            );

            return {
                level,
                count: Number(record?.count ?? record?.total ?? 0)
            };

        });


        const maximum = Math.max(
            ...counts.map(item => item.count),
            1
        );


        container.innerHTML = items.length
            ? counts.map(item => `

        <div class="risk-row">

          <span>${escapeHTML(humanize(item.level))}</span>

          <div class="risk-track">

            <div
              class="risk-fill ${item.level}"
              style="width:${Math.min(
                100,
                (item.count / maximum) * 100
            )}%">
            </div>

          </div>

          <strong>${item.count.toLocaleString()}</strong>

        </div>

      `).join("")
            : `
        <div class="empty-state">
          Risk distribution data is not available.
        </div>
      `;

    }


    /* =========================================================
       6. SECURITY HEALTH
       ========================================================= */

    function renderHealth(items) {

        const container = $("#securityHealth");

        if (!container) return;

        container.innerHTML = items.length
            ? items.map(item => `

        <div class="health-row">

          <div>

            <strong>${escapeHTML(
                item.name ||
                item.component ||
                item.service ||
                "Security service"
            )}</strong>

            <small>
              ${escapeHTML(
                item.lastChecked ||
                item.last_checked ||
                "Health monitoring"
            )}
            </small>

          </div>

          ${badge(item.status || item.health)}

        </div>

      `).join("")
            : `
        <div class="empty-state">
          No health records returned.
        </div>
      `;

    }


    /* =========================================================
       7. ALERT MANAGEMENT
       ========================================================= */

    async function loadAlerts() {

        const payload = await api(
            CONFIG.endpoints.alerts + buildQuery({

                search: $("#alertSearch")?.value?.trim(),

                severity: $("#alertSeverity")?.value,

                status: $("#alertStatus")?.value,

                category: $("#alertCategory")?.value,

                pageSize: CONFIG.pageSize

            })
        );


        const data = getData(payload);

        state.alerts = getRecords(
            payload,
            "alerts",
            "records",
            "items"
        );


        const summary = data.metrics || data.summary || {};


        metric(
            "alertNewCount",
            getValue(summary, "new", "newAlerts", "new_alerts")
        );

        metric(
            "alertReviewCount",
            getValue(summary, "underReview", "under_review", "reviewing")
        );

        metric(
            "alertCriticalCount",
            getValue(summary, "critical", "criticalAlerts", "critical_alerts")
        );

        metric(
            "alertEscalatedCount",
            getValue(summary, "escalated", "escalatedAlerts", "escalated_alerts")
        );


        renderAlerts(state.alerts);

        renderOverviewAlerts(state.alerts);

        return state.alerts;

    }


    function renderOverviewAlerts(items) {

        const container = $("#overviewAlertTable");

        if (!container) return;

        container.innerHTML = items.length
            ? items.slice(0, 7).map(item => `

        <tr>

          <td>${escapeHTML(item.id || item.reference)}</td>

          <td>${escapeHTML(
                humanize(item.category || item.activityType)
            )}</td>

          <td>${escapeHTML(item.country || "—")}</td>

          <td>${badge(item.severity || item.riskLevel)}</td>

          <td>${escapeHTML(
                item.riskScore ?? item.risk_score ?? "—"
            )}</td>

          <td>${escapeHTML(
                formatDate(item.detectedAt || item.detected_at)
            )}</td>

          <td>${badge(item.status)}</td>

          <td>
            <button
              data-detail-type="alerts"
              data-id="${escapeHTML(item.id)}">
              Inspect
            </button>
          </td>

        </tr>

      `).join("")
            : emptyRow(8, "No fraud alerts returned.");

    }


    function renderAlerts(items) {

        const container = $("#alertTable");

        if (!container) return;

        container.innerHTML = items.length
            ? items.map(item => `

        <tr>

          <td>${escapeHTML(item.id || item.reference)}</td>

          <td>${escapeHTML(
                humanize(item.category || item.activityType)
            )}</td>

          <td>${escapeHTML(
                item.entityReference ||
                item.entity_reference ||
                item.accountReference ||
                item.account_reference ||
                "Restricted"
            )}</td>

          <td>${escapeHTML(item.country || "—")}</td>

          <td>${badge(item.severity)}</td>

          <td>${escapeHTML(
                item.riskScore ?? item.risk_score ?? "—"
            )}</td>

          <td>${escapeHTML(
                item.assignedTo ||
                item.assigned_to ||
                "Unassigned"
            )}</td>

          <td>${escapeHTML(
                formatDate(item.detectedAt || item.detected_at)
            )}</td>

          <td>${badge(item.status)}</td>

          <td>

            <button
              data-detail-type="alerts"
              data-id="${escapeHTML(item.id)}">
              Inspect
            </button>

            ${["new", "open"].includes(
                String(item.status).toLowerCase()
            )
                    ? `
                  <button
                    class="success-action"
                    data-action="review-alert"
                    data-id="${escapeHTML(item.id)}">
                    Review
                  </button>
                `
                    : ""
                }

            ${!["resolved", "closed"].includes(
                    String(item.status).toLowerCase()
                )
                    ? `
                  <button
                    class="danger-action"
                    data-action="escalate-alert"
                    data-id="${escapeHTML(item.id)}">
                    Escalate
                  </button>

                  <button
                    data-action="create-case"
                    data-id="${escapeHTML(item.id)}">
                    Case
                  </button>
                `
                    : ""
                }

          </td>

        </tr>

      `).join("")
            : emptyRow(10, "No matching fraud alerts.");

    }


    /* =========================================================
       8. TRANSACTION MONITORING
       ========================================================= */

    async function loadTransactions() {

        const payload = await api(
            CONFIG.endpoints.transactions + buildQuery({

                search: $("#transactionSearch")?.value?.trim(),

                risk: $("#transactionRisk")?.value,

                country: $("#transactionCountry")?.value,

                status: $("#transactionStatus")?.value,

                pageSize: CONFIG.pageSize

            })
        );


        const data = getData(payload);

        const summary = data.metrics || data.summary || {};


        state.transactions = getRecords(
            payload,
            "transactions",
            "records",
            "items"
        );


        metric(
            "transactionReviewed",
            getValue(summary, "reviewed", "transactionsReviewed")
        );

        metric(
            "transactionFlagged",
            getValue(summary, "flagged", "flaggedTransactions")
        );

        metric(
            "transactionHighRisk",
            getValue(summary, "highRisk", "high_risk")
        );

        metric(
            "transactionPending",
            getValue(summary, "pending", "pendingReviews")
        );


        renderTransactions(state.transactions);

        return state.transactions;

    }


    function renderTransactions(items) {

        $("#transactionTable").innerHTML = items.length
            ? items.map(item => `

        <tr>

          <td>${escapeHTML(
                item.reference ||
                item.transactionReference ||
                item.transaction_reference ||
                item.id
            )}</td>

          <td>${escapeHTML(
                item.maskedAccountReference ||
                item.masked_account_reference ||
                item.accountReference ||
                "Restricted"
            )}</td>

          <td>${escapeHTML(
                formatMoney(item.amount, item.currency)
            )}</td>

          <td>${escapeHTML(item.country || "—")}</td>

          <td>${escapeHTML(
                humanize(item.channel || item.paymentChannel)
            )}</td>

          <td>${escapeHTML(
                item.riskScore ?? item.risk_score ?? "—"
            )}</td>

          <td>${badge(item.riskLevel || item.risk_level)}</td>

          <td>${escapeHTML(
                formatDate(item.detectedAt || item.detected_at)
            )}</td>

          <td>${badge(item.status)}</td>

          <td>

            <button
              data-detail-type="transactions"
              data-id="${escapeHTML(item.id)}">
              Inspect
            </button>

          </td>

        </tr>

      `).join("")
            : emptyRow(10, "No matching monitored transactions.");

    }


    /* =========================================================
       9. AML & SANCTIONS SCREENING
       ========================================================= */

    async function loadScreening() {

        const payload = await api(
            CONFIG.endpoints.screening + buildQuery({

                search: $("#screeningSearch")?.value?.trim(),

                status: $("#screeningStatus")?.value,

                pageSize: CONFIG.pageSize

            })
        );


        const data = getData(payload);

        const summary = data.metrics || data.summary || {};


        state.screenings = getRecords(
            payload,
            "screenings",
            "records",
            "items"
        );


        metric(
            "screeningTotal",
            getValue(summary, "total", "totalRequests")
        );

        metric(
            "screeningMatches",
            getValue(summary, "potentialMatches", "potential_matches")
        );

        metric(
            "screeningPending",
            getValue(summary, "pending", "pendingReviews")
        );

        metric(
            "screeningCleared",
            getValue(summary, "cleared", "clearedReviews")
        );


        renderScreenings(state.screenings);

        return state.screenings;

    }


    function renderScreenings(items) {

        $("#screeningTable").innerHTML = items.length
            ? items.map(item => `

        <tr>

          <td>${escapeHTML(item.id || item.reference)}</td>

          <td>${escapeHTML(
                item.subjectDisplay ||
                item.subject_display ||
                item.maskedSubject ||
                item.masked_subject ||
                "Restricted"
            )}</td>

          <td>${escapeHTML(
                humanize(item.subjectType || item.subject_type)
            )}</td>

          <td>${escapeHTML(
                humanize(item.category || item.screeningCategory)
            )}</td>

          <td>${escapeHTML(item.country || "—")}</td>

          <td>${badge(
                item.screeningResult ||
                item.screening_result ||
                item.result
            )}</td>

          <td>${badge(
                item.reviewStatus ||
                item.review_status ||
                item.status
            )}</td>

          <td>${escapeHTML(
                formatDate(item.createdAt || item.created_at)
            )}</td>

          <td>

            <button
              data-detail-type="screening"
              data-id="${escapeHTML(item.id)}">
              Inspect
            </button>

            ${["potential_match", "pending_review"].includes(
                String(
                    item.reviewStatus ||
                    item.review_status ||
                    item.status
                ).toLowerCase()
            )
                    ? `
                  <button
                    class="success-action"
                    data-action="review-screening"
                    data-id="${escapeHTML(item.id)}">
                    Review
                  </button>
                `
                    : ""
                }

          </td>

        </tr>

      `).join("")
            : emptyRow(9, "No screening records returned.");

    }


    async function submitScreening(form) {

        const button = $("#screeningSubmit");

        const values = formValues(form);


        if (
            !values.subjectName?.trim() ||
            !values.country ||
            !values.reason?.trim()
        ) {

            toast(
                "Complete all required screening fields.",
                "error"
            );

            return;

        }


        button.disabled = true;
        button.textContent = "Submitting Screening...";


        try {

            const payload = await api(
                CONFIG.endpoints.screeningSearch,
                {

                    method: "POST",

                    headers: actionHeaders(),

                    body: {

                        subjectName: values.subjectName.trim(),

                        subjectType: values.subjectType,

                        country: values.country,

                        screeningCategory: values.screeningCategory,

                        externalReference:
                            values.externalReference?.trim() || null,

                        reason: values.reason.trim(),

                        source: "talvora_global_fraud_aml_centre"

                    }

                }
            );


            const result = getData(payload);

            state.latestScreening = result;


            toast(
                "Screening request submitted. Retrieve the resulting review status from the screening register.",
                "success"
            );


            await loadScreening();


            if (result.id) {

                await openDetails(
                    "screening",
                    result.id
                );

            }


        } catch (error) {

            toast(
                `Screening request failed: ${error.message}`,
                "error"
            );

        } finally {

            button.disabled = false;

            button.textContent =
                "⌕ Submit Screening Request";

        }

    }


    /* =========================================================
       10. FRAUD RULES MANAGEMENT
       ========================================================= */

    async function loadRules() {

        const payload = await api(
            CONFIG.endpoints.rules + buildQuery({

                search: $("#ruleSearch")?.value?.trim(),

                category: $("#ruleCategory")?.value,

                status: $("#ruleStatus")?.value,

                pageSize: CONFIG.pageSize

            })
        );


        const data = getData(payload);

        const summary = data.metrics || data.summary || {};


        state.rules = getRecords(
            payload,
            "rules",
            "records",
            "items"
        );


        metric(
            "ruleTotal",
            getValue(summary, "total", "totalRules") ??
            state.rules.length
        );

        metric(
            "ruleActive",
            getValue(summary, "active", "activeRules")
        );

        metric(
            "rulePending",
            getValue(summary, "pending", "pendingApprovals")
        );

        metric(
            "ruleModified",
            getValue(summary, "recentlyModified", "recently_modified")
        );


        renderRules(state.rules);

        return state.rules;

    }


    function renderRules(items) {

        $("#ruleTable").innerHTML = items.length
            ? items.map(item => `

        <tr>

          <td>${escapeHTML(item.id || item.reference)}</td>

          <td>${escapeHTML(item.name)}</td>

          <td>${escapeHTML(
                humanize(item.category)
            )}</td>

          <td>${badge(item.severity)}</td>

          <td>${escapeHTML(item.version || "—")}</td>

          <td>${escapeHTML(
                formatDate(item.updatedAt || item.updated_at)
            )}</td>

          <td>${badge(item.status)}</td>

          <td>

            <button
              data-detail-type="rules"
              data-id="${escapeHTML(item.id)}">
              Inspect
            </button>

            ${!["pending_approval", "pending"].includes(
                String(item.status).toLowerCase()
            )
                    ? `
                  <button
                    data-action="toggle-rule"
                    data-id="${escapeHTML(item.id)}"
                    data-enabled="${item.enabled === true ? "true" : "false"}">
                    ${item.enabled === true ? "Disable" : "Enable"}
                  </button>
                `
                    : ""
                }

          </td>

        </tr>

      `).join("")
            : emptyRow(8, "No detection rules found.");

    }


    async function createRule(form) {

        const button = $("#ruleSubmit");

        const values = formValues(form);


        button.disabled = true;
        button.textContent = "Submitting...";


        try {

            await api(CONFIG.endpoints.rules, {

                method: "POST",

                headers: actionHeaders(),

                body: {

                    name: values.name.trim(),

                    category: values.category,

                    severity: values.severity,

                    description: values.description.trim(),

                    profile: values.profile,

                    requestedStatus: "pending_approval",

                    source: "talvora_global_fraud_aml_centre"

                }

            });


            $("#ruleModal").hidden = true;

            form.reset();

            toast(
                "Detection rule submitted for backend registration and approval.",
                "success"
            );


            await loadRules();

        } catch (error) {

            toast(
                `Rule creation failed: ${error.message}`,
                "error"
            );

        } finally {

            button.disabled = false;

            button.textContent =
                "Submit Rule for Registration";

        }

    }


    /* =========================================================
       11. INVESTIGATION CENTRE
       ========================================================= */

    async function loadInvestigations() {

        const payload = await api(
            CONFIG.endpoints.investigations + buildQuery({

                search: $("#investigationSearch")?.value?.trim(),

                status: $("#investigationStatus")?.value,

                priority: $("#investigationPriority")?.value,

                pageSize: CONFIG.pageSize

            })
        );


        const data = getData(payload);

        const summary = data.metrics || data.summary || {};


        state.investigations = getRecords(
            payload,
            "investigations",
            "records",
            "items"
        );


        metric(
            "investigationActive",
            getValue(summary, "active", "activeInvestigations")
        );

        metric(
            "investigationUnassigned",
            getValue(summary, "unassigned", "unassignedInvestigations")
        );

        metric(
            "investigationOverdue",
            getValue(summary, "overdue", "overdueReviews")
        );

        metric(
            "investigationCompleted",
            getValue(summary, "completed", "completedInvestigations")
        );


        renderInvestigations(state.investigations);

        return state.investigations;

    }


    function renderInvestigations(items) {

        $("#investigationTable").innerHTML = items.length
            ? items.map(item => `

        <tr>

          <td>${escapeHTML(item.id || item.reference)}</td>

          <td>${escapeHTML(
                item.subjectReference ||
                item.subject_reference ||
                "Restricted"
            )}</td>

          <td>${escapeHTML(
                humanize(item.type || item.investigationType)
            )}</td>

          <td>${badge(item.priority)}</td>

          <td>${escapeHTML(
                item.assignedInvestigator ||
                item.assigned_investigator ||
                "Unassigned"
            )}</td>

          <td>${escapeHTML(
                formatDate(item.createdAt || item.created_at)
            )}</td>

          <td>${escapeHTML(
                formatDate(item.dueAt || item.due_at)
            )}</td>

          <td>${badge(item.status)}</td>

          <td>

            <button
              data-detail-type="investigations"
              data-id="${escapeHTML(item.id)}">
              Inspect
            </button>

            ${!["completed", "closed"].includes(
                String(item.status).toLowerCase()
            )
                    ? `
                  <button
                    data-action="assign-investigation"
                    data-id="${escapeHTML(item.id)}">
                    Assign
                  </button>
                `
                    : ""
                }

          </td>

        </tr>

      `).join("")
            : emptyRow(9, "No investigation records found.");

    }


    /* =========================================================
       12. FINANCIAL CRIME CASE MANAGEMENT
       ========================================================= */

    async function loadCases() {

        const payload = await api(
            CONFIG.endpoints.cases + buildQuery({

                search: $("#caseSearch")?.value?.trim(),

                category: $("#caseCategory")?.value,

                status: $("#caseStatus")?.value,

                pageSize: CONFIG.pageSize

            })
        );


        const data = getData(payload);

        const summary = data.metrics || data.summary || {};


        state.cases = getRecords(
            payload,
            "cases",
            "records",
            "items"
        );


        metric(
            "caseOpen",
            getValue(summary, "open", "openCases")
        );

        metric(
            "caseHigh",
            getValue(summary, "highPriority", "high_priority")
        );

        metric(
            "casePending",
            getValue(summary, "pendingDecision", "pending_decision")
        );

        metric(
            "caseClosed",
            getValue(summary, "closed", "closedCases")
        );


        renderCases(state.cases);

        return state.cases;

    }


    function renderCases(items) {

        $("#caseTable").innerHTML = items.length
            ? items.map(item => `

        <tr>

          <td>${escapeHTML(item.id || item.reference)}</td>

          <td>${escapeHTML(item.title)}</td>

          <td>${escapeHTML(
                humanize(item.category)
            )}</td>

          <td>${badge(item.severity)}</td>

          <td>${escapeHTML(
                item.leadInvestigator ||
                item.lead_investigator ||
                "Unassigned"
            )}</td>

          <td>${escapeHTML(
                formatDate(item.createdAt || item.created_at)
            )}</td>

          <td>${escapeHTML(
                formatDate(item.updatedAt || item.updated_at)
            )}</td>

          <td>${badge(item.status)}</td>

          <td>

            <button
              data-detail-type="cases"
              data-id="${escapeHTML(item.id)}">
              Inspect
            </button>

            ${!["closed", "resolved"].includes(
                String(item.status).toLowerCase()
            )
                    ? `
                  <button
                    data-action="assign-case"
                    data-id="${escapeHTML(item.id)}">
                    Assign
                  </button>

                  <button
                    class="danger-action"
                    data-action="escalate-case"
                    data-id="${escapeHTML(item.id)}">
                    Escalate
                  </button>

                  <button
                    data-action="close-case"
                    data-id="${escapeHTML(item.id)}">
                    Close
                  </button>
                `
                    : ""
                }

          </td>

        </tr>

      `).join("")
            : emptyRow(9, "No financial crime cases found.");

    }


    async function createCase(form) {

        const button = $("#caseSubmit");

        const values = formValues(form);


        if (
            !values.title?.trim() ||
            !values.description?.trim()
        ) {

            toast(
                "Complete the required case information.",
                "error"
            );

            return;

        }


        button.disabled = true;
        button.textContent = "Creating Case...";


        try {

            await api(CONFIG.endpoints.cases, {

                method: "POST",

                headers: actionHeaders(),

                body: {

                    title: values.title.trim(),

                    category: values.category,

                    severity: values.severity,

                    alertId: values.alertId?.trim() || null,

                    description: values.description.trim(),

                    status: "open",

                    source: "talvora_global_fraud_aml_centre"

                }

            });


            $("#caseModal").hidden = true;

            form.reset();

            toast(
                "Financial crime case submitted successfully.",
                "success"
            );


            await Promise.allSettled([
                loadCases(),
                loadInvestigations(),
                loadAlerts()
            ]);

        } catch (error) {

            toast(
                `Case creation failed: ${error.message}`,
                "error"
            );

        } finally {

            button.disabled = false;

            button.textContent =
                "Create Investigation Case";

        }

    }


    /* =========================================================
       13. REGULATORY COMPLIANCE
       ========================================================= */

    async function loadCompliance() {

        const results = await Promise.allSettled([

            api(
                CONFIG.endpoints.compliance + buildQuery({

                    search: $("#complianceSearch")?.value?.trim(),

                    country: $("#complianceCountry")?.value,

                    status: $("#complianceStatus")?.value,

                    pageSize: CONFIG.pageSize

                })
            ),

            api(
                CONFIG.endpoints.reports + buildQuery({

                    pageSize: CONFIG.pageSize

                })
            )

        ]);


        if (results[0].status === "fulfilled") {

            const payload = results[0].value;

            const data = getData(payload);

            const summary = data.metrics || data.summary || {};


            state.compliance = getRecords(
                payload,
                "obligations",
                "records",
                "items"
            );


            metric(
                "complianceTotal",
                getValue(summary, "total", "totalObligations")
            );

            metric(
                "complianceCompleted",
                getValue(summary, "compliant", "completed")
            );

            metric(
                "complianceUpcoming",
                getValue(summary, "upcoming", "upcomingDeadlines")
            );

            metric(
                "complianceOverdue",
                getValue(summary, "overdue", "overdueObligations")
            );


            renderCompliance(state.compliance);

        }


        if (results[1].status === "fulfilled") {

            state.reports = getRecords(
                results[1].value,
                "reports",
                "submissions",
                "items"
            );

            renderReports(state.reports);

        }


        if (
            results.every(result =>
                result.status === "rejected"
            )
        ) {

            throw new Error(
                "Compliance services are currently unavailable."
            );

        }

    }


    function renderCompliance(items) {

        $("#complianceTable").innerHTML = items.length
            ? items.map(item => `

        <tr>

          <td>${escapeHTML(item.id || item.reference)}</td>

          <td>${escapeHTML(
                item.name ||
                item.title ||
                item.requirement ||
                "—"
            )}</td>

          <td>${escapeHTML(
                item.country || item.jurisdiction || "—"
            )}</td>

          <td>${escapeHTML(item.regulator || "—")}</td>

          <td>${escapeHTML(
                item.reportingPeriod ||
                item.reporting_period ||
                "—"
            )}</td>

          <td>${escapeHTML(
                formatDate(item.dueDate || item.due_date)
            )}</td>

          <td>${escapeHTML(
                item.responsibleTeam ||
                item.responsible_team ||
                "—"
            )}</td>

          <td>${badge(item.status)}</td>

          <td>

            <button
              data-detail-type="compliance"
              data-id="${escapeHTML(item.id)}">
              Inspect
            </button>

          </td>

        </tr>

      `).join("")
            : emptyRow(9, "No compliance obligations returned.");

    }


    function renderReports(items) {

        $("#reportTable").innerHTML = items.length
            ? items.map(item => `

        <tr>

          <td>${escapeHTML(item.id || item.reference)}</td>

          <td>${escapeHTML(
                humanize(item.type || item.reportType)
            )}</td>

          <td>${escapeHTML(
                item.country || item.jurisdiction || "—"
            )}</td>

          <td>${escapeHTML(
                item.reportingPeriod ||
                item.reporting_period ||
                "—"
            )}</td>

          <td>${escapeHTML(
                formatDate(item.submittedAt || item.submitted_at)
            )}</td>

          <td>${escapeHTML(
                item.submissionReference ||
                item.submission_reference ||
                "—"
            )}</td>

          <td>${badge(item.status)}</td>

          <td>

            <button
              data-detail-type="reports"
              data-id="${escapeHTML(item.id)}">
              Inspect
            </button>

          </td>

        </tr>

      `).join("")
            : emptyRow(8, "No regulatory submissions found.");

    }


    /* =========================================================
       14. SECURITY AND AUDIT
       ========================================================= */

    async function loadAudit() {

        const payload = await api(
            CONFIG.endpoints.audit + buildQuery({

                search: $("#auditSearch")?.value?.trim(),

                action: $("#auditAction")?.value,

                pageSize: CONFIG.pageSize

            })
        );


        const data = getData(payload);

        const summary = data.metrics || data.summary || {};


        state.audit = getRecords(
            payload,
            "records",
            "audit",
            "items"
        );


        metric(
            "auditTotal",
            getValue(summary, "total", "totalRecords")
        );

        metric(
            "auditPrivileged",
            getValue(summary, "privileged", "privilegedActions")
        );

        metric(
            "auditExceptions",
            getValue(summary, "exceptions", "securityExceptions")
        );

        metric(
            "auditApprovals",
            getValue(summary, "pendingApprovals", "pending_approvals")
        );


        renderAudit(state.audit);

        return state.audit;

    }


    function renderAudit(items) {

        $("#auditTable").innerHTML = items.length
            ? items.map(item => `

        <tr>

          <td>${escapeHTML(item.id || item.reference)}</td>

          <td>${escapeHTML(
                item.actorName ||
                item.actor_name ||
                item.administrator ||
                "—"
            )}</td>

          <td>${escapeHTML(
                humanize(item.action || item.operation)
            )}</td>

          <td>${escapeHTML(
                item.resource ||
                item.resourceReference ||
                item.resource_reference ||
                "—"
            )}</td>

          <td>${escapeHTML(
                item.jurisdiction ||
                item.country ||
                "—"
            )}</td>

          <td>${escapeHTML(item.reason || "—")}</td>

          <td>${escapeHTML(
                formatDate(item.createdAt || item.created_at)
            )}</td>

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
       15. RECORD DETAILS
       ========================================================= */

    const DETAIL_ENDPOINTS = {

        alerts: CONFIG.endpoints.alerts,

        transactions: CONFIG.endpoints.transactions,

        screening: CONFIG.endpoints.screening,

        rules: CONFIG.endpoints.rules,

        investigations: CONFIG.endpoints.investigations,

        cases: CONFIG.endpoints.cases,

        compliance: CONFIG.endpoints.compliance,

        reports: CONFIG.endpoints.reports,

        audit: CONFIG.endpoints.audit

    };


    function detailValue(value) {

        if (value === null || value === undefined) {
            return "—";
        }

        if (Array.isArray(value)) {
            return value.join(", ");
        }

        if (typeof value === "object") {
            return "Structured information available in secure record";
        }

        return String(value);

    }


    function renderRecordDetails(record) {

        const sensitiveKey =
            /secret|password|token|api.?key|raw.?payload|private.?key|national.?id|passport|date.?of.?birth|full.?address|card.?number|account.?number|document.?content|biometric/i;


        return Object.entries(record)

            .filter(([key, value]) =>

                !sensitiveKey.test(key) &&

                value !== null &&

                value !== undefined &&

                typeof value !== "function"

            )

            .map(([key, value]) => `

        <div class="detail-row">

          <span>${escapeHTML(humanize(key))}</span>

          <strong>${escapeHTML(detailValue(value))}</strong>

        </div>

      `).join("");

    }


    async function openDetails(type, id) {

        const base = DETAIL_ENDPOINTS[type];

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
                `${humanize(type)} — ${record.reference ||
                record.title ||
                record.id ||
                id
                }`;


            $("#detailBody").innerHTML =
                renderRecordDetails(record) ||
                '<div class="empty-state">No additional record details returned.</div>';


            $("#detailModal").hidden = false;


        } catch (error) {

            toast(
                `Unable to retrieve record: ${error.message}`,
                "error"
            );

        }

    }


    /* =========================================================
       16. PROTECTED ADMINISTRATIVE ACTIONS
       ========================================================= */

    function requestAction(action) {

        state.pendingAction = action;


        const descriptions = {

            review_alert:
                "This requests an authorized review of the selected fraud alert. The backend must validate its current status and the administrator's permissions.",

            escalate_alert:
                "This requests escalation to the appropriate financial crime authority. The backend must record the reason and escalation history.",

            review_screening:
                "This requests a documented human review of the screening result. A potential match must not automatically be treated as a confirmed violation.",

            assign_investigation:
                "This requests assignment of the investigation to an authorized investigator.",

            assign_case:
                "This requests reassignment of the financial crime case to an authorized reviewer or investigator.",

            escalate_case:
                "This requests formal escalation of the financial crime case under the applicable approval and reporting process.",

            close_case:
                "This requests case closure. The backend must validate closure eligibility and retain the complete investigation and decision history.",

            enable_rule:
                "This requests activation of the selected detection rule. Production activation must be subject to approval, testing and server-side validation.",

            disable_rule:
                "This requests deactivation of the selected detection rule. The backend must validate authorization and preserve its version history."

        };


        const titles = {

            review_alert: "Review Fraud Alert",

            escalate_alert: "Escalate Fraud Alert",

            review_screening: "Review Screening Result",

            assign_investigation: "Assign Investigation",

            assign_case: "Assign Financial Crime Case",

            escalate_case: "Escalate Financial Crime Case",

            close_case: "Request Case Closure",

            enable_rule: "Request Rule Activation",

            disable_rule: "Request Rule Deactivation"

        };


        $("#actionTitle").textContent =
            titles[action.action] || "Confirm Operation";


        $("#actionDescription").textContent =
            descriptions[action.action] ||
            "This operation requires backend authorization.";


        $("#actionReason").value = "";

        $("#actionAssignee").value =
            action.assignee || "";


        $("#actionConfirm").disabled = true;

        $("#actionModal").hidden = false;

    }


    function validateAction() {

        const reason =
            $("#actionReason").value.trim();

        $("#actionConfirm").disabled =
            reason.length < 10;

    }


    async function executeAction() {

        const action = state.pendingAction;

        if (!action) return;


        const reason =
            $("#actionReason").value.trim();

        const assignee =
            $("#actionAssignee").value.trim();


        if (reason.length < 10) {

            toast(
                "Provide a meaningful administrative justification.",
                "error"
            );

            return;

        }


        const button = $("#actionConfirm");

        button.disabled = true;

        button.textContent = "Submitting...";


        try {

            const body = {

                action: action.action,

                reason,

                assignee: assignee || null,

                source: "talvora_global_fraud_aml_centre"

            };


            let result;


            switch (action.type) {


                case "alert":

                    result = await api(

                        `${CONFIG.endpoints.alerts}/${encodeURIComponent(action.id)}/actions`,

                        {

                            method: "POST",

                            headers: actionHeaders(),

                            body

                        }

                    );

                    break;


                case "screening":

                    result = await api(

                        `${CONFIG.endpoints.screening}/${encodeURIComponent(action.id)}/actions`,

                        {

                            method: "POST",

                            headers: actionHeaders(),

                            body

                        }

                    );

                    break;


                case "investigation":

                    result = await api(

                        `${CONFIG.endpoints.investigations}/${encodeURIComponent(action.id)}/actions`,

                        {

                            method: "POST",

                            headers: actionHeaders(),

                            body

                        }

                    );

                    break;


                case "case":

                    result = await api(

                        `${CONFIG.endpoints.cases}/${encodeURIComponent(action.id)}/actions`,

                        {

                            method: "POST",

                            headers: actionHeaders(),

                            body

                        }

                    );

                    break;


                case "rule":

                    result = await api(

                        `${CONFIG.endpoints.rules}/${encodeURIComponent(action.id)}`,

                        {

                            method: "PATCH",

                            headers: actionHeaders(),

                            body: {

                                enabled: action.enabled,

                                reason,

                                source: "talvora_global_fraud_aml_centre"

                            }

                        }

                    );

                    break;


                default:

                    throw new Error("Unsupported administrative operation.");

            }


            $("#actionModal").hidden = true;

            state.pendingAction = null;


            toast(
                "Administrative request submitted successfully.",
                "success"
            );


            await refreshCurrentSection();


            await loadOverview().catch(() => { });


            return result;


        } catch (error) {

            toast(
                `Operation failed: ${error.message}`,
                "error"
            );

        } finally {

            button.disabled = false;

            button.textContent = "Submit Request";

        }

    }


    /* =========================================================
       17. AUDIT EXPORT
       ========================================================= */

    async function exportAudit() {

        try {

            const url = endpoint(

                CONFIG.endpoints.exports +

                buildQuery({

                    type: "financial_crime_audit",

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

            const downloadURL =
                URL.createObjectURL(blob);


            const link = document.createElement("a");

            link.href = downloadURL;

            link.download = "talvora-financial-crime-audit.csv";


            document.body.appendChild(link);

            link.click();

            link.remove();


            setTimeout(
                () => URL.revokeObjectURL(downloadURL),
                1000
            );


            toast(
                "Financial crime audit export downloaded.",
                "success"
            );


        } catch (error) {

            toast(error.message, "error");

        }

    }


    /* =========================================================
       18. OVERVIEW DASHBOARD
       ========================================================= */

    async function loadOverview() {

        setApiStatus("loading", "Updating");


        const results = await Promise.allSettled([

            api(CONFIG.endpoints.dashboard),

            api(CONFIG.endpoints.alerts),

            api(CONFIG.endpoints.health)

        ]);


        let successful = 0;


        if (results[0].status === "fulfilled") {

            successful++;

            const payload = results[0].value;

            const data = getData(payload);

            const summary = data.metrics || data.summary || data;


            metric(
                "metricActiveAlerts",
                getValue(summary, "activeAlerts", "active_alerts")
            );

            metric(
                "metricHighRisk",
                getValue(summary, "highRiskActivities", "high_risk_activities")
            );

            metric(
                "metricInvestigations",
                getValue(summary, "openInvestigations", "open_investigations")
            );

            metric(
                "metricPendingAML",
                getValue(summary, "pendingAMLReviews", "pending_aml_reviews")
            );

            metric(
                "metricOpenCases",
                getValue(summary, "openCases", "open_cases")
            );

            metric(
                "metricCriticalAlerts",
                getValue(summary, "criticalAlerts", "critical_alerts")
            );

            metric(
                "metricScreeningExceptions",
                getValue(summary, "screeningExceptions", "screening_exceptions")
            );

            metric(
                "metricComplianceDue",
                getValue(summary, "complianceDue", "compliance_due")
            );


            if (data.environment) {

                setEnvironment(data.environment);

            }


            const distribution = getRecords(
                data,
                "riskDistribution",
                "risk_distribution",
                "riskBreakdown",
                "risk_breakdown"
            );

            renderRiskDistribution(distribution);

        }


        if (results[1].status === "fulfilled") {

            successful++;

            state.alerts = getRecords(
                results[1].value,
                "alerts",
                "records",
                "items"
            );

            renderOverviewAlerts(state.alerts);

            const alerts = state.alerts;

            if (results[0].status !== "fulfilled") {

                metric(
                    "metricActiveAlerts",
                    alerts.filter(item =>
                        !["resolved", "closed"].includes(
                            String(item.status).toLowerCase()
                        )
                    ).length
                );

                metric(
                    "metricHighRisk",
                    alerts.filter(item =>
                        ["critical", "high"].includes(
                            String(item.severity).toLowerCase()
                        )
                    ).length
                );

            }

        }


        if (results[2].status === "fulfilled") {

            successful++;

            state.health = getRecords(
                results[2].value,
                "services",
                "health",
                "components",
                "items"
            );

            renderHealth(state.health);

        }


        if (successful > 0) {

            setApiStatus("connected", "Connected");

            setNotice(
                "Financial security services are retrieving monitoring, fraud and AML intelligence."
            );

        } else {

            setApiStatus("error", "Unavailable");

            setNotice(
                "Financial security services could not be reached. Check authentication and backend connectivity."
            );

        }


        return successful;

    }


    /* =========================================================
       19. SECTION NAVIGATION
       ========================================================= */

    const LOADERS = {

        overview: loadOverview,

        alerts: loadAlerts,

        monitoring: loadTransactions,

        screening: loadScreening,

        rules: loadRules,

        investigations: loadInvestigations,

        cases: loadCases,

        compliance: loadCompliance,

        audit: loadAudit

    };


    async function navigate(section) {

        const target =
            document.getElementById(section);

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
       20. REFRESH OPERATIONS
       ========================================================= */

    async function refreshCurrentSection() {

        const loader = LOADERS[state.section];

        if (!loader) return;


        try {

            await loader();

            toast(
                "Section refreshed successfully.",
                "success"
            );

        } catch (error) {

            toast(error.message, "error");

        }

    }


    async function refreshAll() {

        setApiStatus("loading", "Refreshing");


        const results = await Promise.allSettled([

            loadReferenceData(),

            loadOverview(),

            loadAlerts()

        ]);


        const successful = results.filter(
            item => item.status === "fulfilled"
        ).length;


        if (successful === 0) {

            setApiStatus("error", "Unavailable");

            toast(
                "Financial security refresh failed.",
                "error"
            );

            return;

        }


        if (
            state.section !== "overview" &&
            state.section !== "alerts"
        ) {

            const loader = LOADERS[state.section];

            if (loader) {

                await loader().catch(error => {
                    toast(error.message, "error");
                });

            }

        }


        setApiStatus("connected", "Connected");

    }


    /* =========================================================
       21. DEBOUNCE
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
       22. EVENT BINDINGS
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


        /* Quick investigation */

        on("#quickInvestigation", "click", () => {

            $("#caseAlertId").value = "";

            $("#caseModal").hidden = false;

        });


        /* Alert filters */

        const alertSearch = debounce(loadAlerts);

        on("#alertSearch", "input", alertSearch);

        on("#alertSeverity", "change", loadAlerts);

        on("#alertStatus", "change", loadAlerts);

        on("#alertCategory", "change", loadAlerts);


        /* Transaction filters */

        const transactionSearch = debounce(loadTransactions);

        on("#transactionSearch", "input", transactionSearch);

        on("#transactionRisk", "change", loadTransactions);

        on("#transactionCountry", "change", loadTransactions);

        on("#transactionStatus", "change", loadTransactions);


        /* Screening */

        on("#screeningForm", "submit", event => {

            event.preventDefault();

            submitScreening(event.currentTarget);

        });


        const screeningSearch = debounce(loadScreening);

        on("#screeningSearch", "input", screeningSearch);

        on("#screeningStatus", "change", loadScreening);


        /* Fraud rules */

        on("#newRuleButton", "click", () => {

            $("#ruleForm").reset();

            $("#ruleModal").hidden = false;

        });


        on("#ruleForm", "submit", event => {

            event.preventDefault();

            createRule(event.currentTarget);

        });


        const ruleSearch = debounce(loadRules);

        on("#ruleSearch", "input", ruleSearch);

        on("#ruleCategory", "change", loadRules);

        on("#ruleStatus", "change", loadRules);


        /* Investigations */

        const investigationSearch =
            debounce(loadInvestigations);

        on(
            "#investigationSearch",
            "input",
            investigationSearch
        );

        on(
            "#investigationStatus",
            "change",
            loadInvestigations
        );

        on(
            "#investigationPriority",
            "change",
            loadInvestigations
        );


        /* Financial crime cases */

        on("#newCaseButton", "click", () => {

            $("#caseForm").reset();

            $("#caseAlertId").value = "";

            $("#caseModal").hidden = false;

        });


        on("#caseForm", "submit", event => {

            event.preventDefault();

            createCase(event.currentTarget);

        });


        const caseSearch = debounce(loadCases);

        on("#caseSearch", "input", caseSearch);

        on("#caseCategory", "change", loadCases);

        on("#caseStatus", "change", loadCases);


        /* Compliance */

        const complianceSearch =
            debounce(loadCompliance);

        on(
            "#complianceSearch",
            "input",
            complianceSearch
        );

        on(
            "#complianceCountry",
            "change",
            loadCompliance
        );

        on(
            "#complianceStatus",
            "change",
            loadCompliance
        );


        /* Audit */

        const auditSearch = debounce(loadAudit);

        on("#auditSearch", "input", auditSearch);

        on("#auditAction", "change", loadAudit);

        on("#exportAudit", "click", exportAudit);


        /* Action modal */

        on("#actionReason", "input", validateAction);


        on("#actionAssignee", "input", validateAction);


        on("#actionConfirm", "click", executeAction);


        /* Dynamic actions and details */

        document.addEventListener("click", event => {


            const detailButton =
                event.target.closest("[data-detail-type]");


            if (detailButton) {

                openDetails(
                    detailButton.dataset.detailType,
                    detailButton.dataset.id
                );

                return;

            }


            const actionButton =
                event.target.closest("[data-action]");


            if (!actionButton) return;


            const action = actionButton.dataset.action;

            const id = actionButton.dataset.id;


            switch (action) {


                case "review-alert":

                    requestAction({

                        type: "alert",

                        id,

                        action: "review_alert"

                    });

                    break;


                case "escalate-alert":

                    requestAction({

                        type: "alert",

                        id,

                        action: "escalate_alert"

                    });

                    break;


                case "review-screening":

                    requestAction({

                        type: "screening",

                        id,

                        action: "review_screening"

                    });

                    break;


                case "assign-investigation":

                    requestAction({

                        type: "investigation",

                        id,

                        action: "assign_investigation"

                    });

                    break;


                case "assign-case":

                    requestAction({

                        type: "case",

                        id,

                        action: "assign_case"

                    });

                    break;


                case "escalate-case":

                    requestAction({

                        type: "case",

                        id,

                        action: "escalate_case"

                    });

                    break;


                case "close-case":

                    requestAction({

                        type: "case",

                        id,

                        action: "close_case"

                    });

                    break;


                case "toggle-rule": {

                    const currentlyEnabled =
                        actionButton.dataset.enabled === "true";


                    requestAction({

                        type: "rule",

                        id,

                        action: currentlyEnabled
                            ? "disable_rule"
                            : "enable_rule",

                        enabled: !currentlyEnabled

                    });

                    break;

                }


                case "create-case":

                    $("#caseForm").reset();

                    $("#caseAlertId").value = id;

                    $("#caseModal").hidden = false;

                    break;


            }

        });


        /* Modal closing */

        document.addEventListener("click", event => {

            const closeButton =
                event.target.closest("[data-close-modal]");


            if (closeButton) {

                const modal =
                    closeButton.closest(".modal-overlay");

                if (modal) {
                    modal.hidden = true;
                }

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
       23. INITIALIZATION
       ========================================================= */

    async function initialize() {

        if (state.initialized) return;

        state.initialized = true;


        bindEvents();


        setApiStatus("loading", "Connecting");

        setEnvironment("MONITORING");


        await Promise.allSettled([

            loadReferenceData(),

            loadOverview(),

            loadAlerts()

        ]);


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
                        "[TALVORA Financial Crime]",
                        error.message
                    );

                });

            }

        }, CONFIG.refreshInterval);

    }


    /* =========================================================
       24. PUBLIC MODULE INTERFACE
       ========================================================= */

    window.TALVORA_FRAUD_AML = {

        refresh: refreshAll,

        navigate,

        loadOverview,

        loadAlerts,

        loadTransactions,

        loadScreening,

        loadRules,

        loadInvestigations,

        loadCases,

        loadCompliance,

        loadAudit,

        config: CONFIG

    };


    /* =========================================================
       25. START APPLICATION
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
