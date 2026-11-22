
(() => {
    "use strict";

    /* =========================================
       TALVORA GLOBAL AML CONFIGURATION
    ========================================= */

    const DEFAULT_ENDPOINTS = {
        dashboard: "/api/aml/dashboard",
        reference: "/api/aml/reference-data",
        alerts: "/api/aml/alerts",
        cases: "/api/aml/cases",
        rules: "/api/aml/rules",
        screening: "/api/aml/screening",
        screeningChecks: "/api/aml/screening/checks",
        customers: "/api/aml/customers",
        reports: "/api/aml/reports",
        jurisdictions: "/api/aml/jurisdictions",
        audit: "/api/aml/audit",
        exports: "/api/aml/exports"
    };

    const config = window.TALVORA_ADMIN_CONFIG || {};

    const base = String(config.apiBaseUrl || "").replace(/\/+$/, "");

    const endpoints = {
        ...DEFAULT_ENDPOINTS,
        ...(config.amlEndpoints || {})
    };

    const $ = id => document.getElementById(id);

    const state = {
        section: "overview",
        jurisdictions: [],
        currencies: [],
        pendingAction: null,
        refreshTimer: null
    };

    /* =========================================
       COMMON UTILITIES
    ========================================= */

    const esc = value =>
        String(value ?? "—").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);

    const dataOf = payload => payload?.data ?? payload ?? {};

    function records(payload, ...keys) {
        const data = dataOf(payload);

        if (Array.isArray(data)) return data;

        for (const key of keys) {
            if (Array.isArray(data?.[key])) {
                return data[key];
            }
        }

        return [];
    }

    function first(object, ...keys) {
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

    function query(params = {}) {
        const search = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (
                value !== "" &&
                value !== null &&
                value !== undefined
            ) {
                search.set(key, value);
            }
        });

        const result = search.toString();

        return result ? `?${result}` : "";
    }

    function url(path) {
        return base + (path.startsWith("/") ? path : `/${path}`);
    }

    function money(amount, currency) {
        if (amount === null || amount === undefined) {
            return "—";
        }

        const number = Number(amount);

        if (!Number.isFinite(number)) return "—";

        if (!currency) {
            return number.toLocaleString();
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

    function date(value) {
        if (!value) return "—";

        const parsed = new Date(value);

        if (Number.isNaN(parsed.getTime())) {
            return esc(value);
        }

        return new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(parsed);
    }

    function badge(value) {
        const status = String(value || "unknown")
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "_");

        const label = String(value || "Unknown")
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());

        return `<span class="badge ${status}">${esc(label)}</span>`;
    }

    function empty(columns, message) {
        return `
      <tr>
        <td colspan="${columns}" class="empty-state">
          ${esc(message)}
        </td>
      </tr>
    `;
    }

    function metric(id, value) {
        const element = $(id);
        if (!element) return;

        element.textContent =
            value === null || value === undefined
                ? "—"
                : typeof value === "number"
                    ? value.toLocaleString()
                    : String(value);
    }

    function toast(message, type = "info") {
        const region = $("toastRegion");
        if (!region) return;

        const element = document.createElement("div");

        element.className = `toast ${type}`;
        element.textContent = message;

        region.appendChild(element);

        setTimeout(() => element.remove(), 5000);
    }

    function setStatus(status, label) {
        const element = $("apiStatus");
        if (!element) return;

        element.className = `api-status ${status}`;

        element.innerHTML = `
      <i></i>
      ${esc(label)}
    `;
    }

    function idempotencyHeaders() {
        if (!window.crypto?.randomUUID) return {};

        return {
            "Idempotency-Key": window.crypto.randomUUID()
        };
    }

    function debounce(callback, delay = 350) {
        let timer;

        return (...args) => {
            clearTimeout(timer);

            timer = setTimeout(() => {
                callback(...args).catch(error => {
                    toast(error.message, "error");
                });
            }, delay);
        };
    }

    /* =========================================
       CENTRAL API CLIENT
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

                if (response.status === 403) {
                    message = "You are not authorized to perform this operation.";
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
       GLOBAL REFERENCE DATA
    ========================================= */

    function setOptions(
        id,
        items,
        valueFn,
        labelFn,
        placeholder
    ) {
        const element = $(id);
        if (!element) return;

        const current = element.value;

        element.innerHTML =
            `<option value="">${esc(placeholder)}</option>` +
            items.map(item => {
                const value = valueFn(item);

                if (
                    value === undefined ||
                    value === null ||
                    value === ""
                ) {
                    return "";
                }

                return `
          <option value="${esc(value)}">
            ${esc(labelFn(item))}
          </option>
        `;
            }).join("");

        if ([...element.options].some(option => option.value === current)) {
            element.value = current;
        }
    }

    async function loadReferenceData() {
        const payload = await api(endpoints.reference);

        const data = dataOf(payload);

        state.jurisdictions = records(
            data,
            "jurisdictions",
            "countries"
        );

        state.currencies = records(
            data,
            "currencies",
            "supportedCurrencies"
        );

        const jurisdictionValue = item =>
            item.code ||
            item.countryCode ||
            item.country_code ||
            item.id;

        const jurisdictionLabel = item =>
            `${item.name || item.countryName || "Jurisdiction"} (${jurisdictionValue(item) || ""})`;

        [
            "caseJurisdiction",
            "screeningJurisdiction",
            "reportJurisdiction"
        ].forEach(id => {
            setOptions(
                id,
                state.jurisdictions,
                jurisdictionValue,
                jurisdictionLabel,
                "Select jurisdiction"
            );
        });

        const currencies = state.currencies.map(item => ({
            code: item.code || item.currencyCode || item.currency_code,
            name: item.name || item.displayName || ""
        })).filter(item => item.code);

        setOptions(
            "ruleCurrency",
            currencies,
            item => item.code,
            item => item.name
                ? `${item.name} (${item.code})`
                : item.code,
            "Not applicable"
        );
    }

    /* =========================================
       DASHBOARD
    ========================================= */

    async function loadOverview() {
        const results = await Promise.allSettled([
            api(endpoints.dashboard),
            api(endpoints.alerts + query({ limit: 8, pageSize: 8 })),
            api(endpoints.cases + query({
                limit: 8,
                pageSize: 8,
                priority: "high"
            }))
        ]);

        let successful = 0;

        if (results[0].status === "fulfilled") {
            successful++;

            const data = dataOf(results[0].value);

            const summary = data.metrics || data.summary || data;

            metric(
                "mTransactions",
                first(summary, "transactionsMonitored", "transactions_monitored")
            );

            metric(
                "mAlerts",
                first(summary, "activeAlerts", "active_alerts")
            );

            metric(
                "mCases",
                first(summary, "openInvestigations", "open_investigations")
            );

            metric(
                "mCritical",
                first(summary, "criticalRiskExposure", "critical_risk_exposure")
            );

            metric(
                "mScreening",
                first(summary, "potentialScreeningMatches", "potential_screening_matches")
            );

            metric(
                "mEDD",
                first(summary, "activeEDDReviews", "active_edd_reviews")
            );

            metric(
                "mReports",
                first(summary, "pendingReports", "pending_reports")
            );

            metric(
                "mRules",
                first(summary, "activeMonitoringRules", "active_monitoring_rules")
            );

            renderSeverity(
                records(data, "severityDistribution", "severity_distribution", "severity")
            );

            renderScreeningHealth(
                records(data, "screeningHealth", "screening_health", "screeningSummary")
            );

            if (data.environment && $("environmentLabel")) {
                $("environmentLabel").textContent =
                    String(data.environment).toUpperCase();
            }
        }

        if (results[1].status === "fulfilled") {
            successful++;

            renderAlerts(
                records(results[1].value, "alerts", "records", "items"),
                "recentAlerts",
                true
            );
        }

        if (results[2].status === "fulfilled") {
            successful++;

            renderCases(
                records(results[2].value, "cases", "investigations", "records", "items"),
                "priorityCases",
                true
            );
        }

        setStatus(
            successful ? "connected" : "error",
            successful ? "Connected" : "Service unavailable"
        );
    }

    function renderSeverity(items) {
        const element = $("severityDistribution");
        if (!element) return;

        if (!items.length) {
            element.innerHTML =
                '<p class="muted">No severity distribution returned.</p>';
            return;
        }

        const maximum = Math.max(
            1,
            ...items.map(item => Number(item.count ?? item.total ?? 0))
        );

        element.innerHTML = items.map(item => {
            const severity = String(item.severity || item.level || "unknown")
                .toLowerCase();

            const count = Number(item.count ?? item.total ?? 0);

            const percentage = Math.max(
                0,
                Math.min(100, count / maximum * 100)
            );

            return `
        <div class="severity-row">
          <span class="severity-label">${esc(severity)}</span>
          <div class="severity-track">
            <div class="severity-fill ${esc(severity)}"
                 style="width:${percentage}%"></div>
          </div>
          <span class="severity-count">${esc(count)}</span>
        </div>
      `;
        }).join("");
    }

    function renderScreeningHealth(items) {
        const element = $("screeningHealth");
        if (!element) return;

        element.innerHTML = items.length
            ? items.map(item => `
          <div class="health-row">
            <div>
              <strong>${esc(item.name || item.type || item.status)}</strong>
              <small>${esc(item.description || "Screening operations")}</small>
            </div>
            <strong>${esc(item.count ?? item.total ?? "—")}</strong>
          </div>
        `).join("")
            : '<p class="muted">No screening health information returned.</p>';
    }

    /* =========================================
       AML ALERT MANAGEMENT
    ========================================= */

    function renderAlerts(
        items,
        target = "alertTable",
        recent = false
    ) {
        const element = $(target);
        if (!element) return;

        element.innerHTML = items.length
            ? items.map(item => `
          <tr>
            <td>${esc(item.reference || item.alertReference || item.id)}</td>
            <td>${esc(item.category || item.alertCategory || item.type)}</td>
            ${recent ? "" : `
              <td>${esc(item.transactionReference || item.transactionId || "—")}</td>
            `}
            <td>${esc(item.jurisdiction || item.country || "—")}</td>
            <td>${esc(item.riskScore ?? item.risk_score ?? "—")}</td>
            <td>${badge(item.severity)}</td>
            ${recent ? "" : `
              <td>${esc(item.assignedTo || item.owner || "Unassigned")}</td>
            `}
            <td>${esc(date(item.detectedAt || item.createdAt || item.detected_at))}</td>
            <td>${badge(item.status)}</td>
            ${recent ? "" : `
              <td>
                <button data-detail="alerts" data-id="${esc(item.id)}">Inspect</button>
                <button data-action="review-alert" data-id="${esc(item.id)}">Review</button>
                ${!["escalated", "closed"].includes(String(item.status).toLowerCase())
                        ? `<button data-action="escalate-alert" data-id="${esc(item.id)}">Escalate</button>`
                        : ""}
              </td>
            `}
          </tr>
        `).join("")
            : empty(recent ? 7 : 10, "No AML alerts returned.");
    }

    async function loadAlerts() {
        const payload = await api(endpoints.alerts + query({
            search: $("alertSearch")?.value?.trim(),
            severity: $("alertSeverity")?.value,
            status: $("alertStatus")?.value,
            category: $("alertCategory")?.value,
            pageSize: 100
        }));

        renderAlerts(records(payload, "alerts", "records", "items"));
    }

    /* =========================================
       INVESTIGATION CASES
    ========================================= */

    function renderCases(
        items,
        target = "caseTable",
        recent = false
    ) {
        const element = $(target);
        if (!element) return;

        element.innerHTML = items.length
            ? items.map(item => `
          <tr>
            <td>${esc(item.reference || item.caseReference || item.id)}</td>
            <td>${esc(item.category || item.caseType || item.title)}</td>
            ${recent ? "" : `
              <td>${esc(item.relatedAlertCount ?? item.related_alert_count ?? "—")}</td>
            `}
            <td>${badge(item.riskLevel || item.risk_level)}</td>
            <td>${esc(item.jurisdiction || item.country || "—")}</td>
            <td>${esc(item.investigator || item.assignedTo || "Unassigned")}</td>
            <td>${esc(date(item.createdAt || item.openedAt || item.created_at))}</td>
            <td>${badge(item.status)}</td>
            ${recent ? "" : `
              <td>
                <button data-detail="cases" data-id="${esc(item.id)}">Inspect</button>
                <button data-action="review-case" data-id="${esc(item.id)}">Review</button>
                ${!["escalated", "closed"].includes(String(item.status).toLowerCase())
                        ? `<button data-action="escalate-case" data-id="${esc(item.id)}">Escalate</button>`
                        : ""}
              </td>
            `}
          </tr>
        `).join("")
            : empty(recent ? 7 : 9, "No investigation records returned.");
    }

    async function loadCases() {
        const payload = await api(endpoints.cases + query({
            search: $("caseSearch")?.value?.trim(),
            status: $("caseStatus")?.value,
            riskLevel: $("caseRisk")?.value,
            pageSize: 100
        }));

        renderCases(records(payload, "cases", "investigations", "records", "items"));
    }

    async function createCase(form) {
        const button = $("caseSubmit");

        button.disabled = true;
        button.textContent = "Creating investigation...";

        try {
            const values = Object.fromEntries(
                new FormData(form).entries()
            );

            await api(endpoints.cases, {
                method: "POST",
                headers: idempotencyHeaders(),
                body: {
                    title: values.title.trim(),
                    category: values.category,
                    alertReference: values.alertReference.trim() || null,
                    jurisdiction: values.jurisdiction || null,
                    riskLevel: values.riskLevel,
                    summary: values.summary.trim(),
                    evidenceReference: values.evidenceReference.trim() || null,
                    status: "open",
                    source: "talvora_global_aml"
                }
            });

            $("caseModal").hidden = true;
            form.reset();

            toast("Investigation registered successfully.", "success");

            await Promise.allSettled([
                loadCases(),
                loadOverview()
            ]);

        } catch (error) {
            toast(`Investigation creation failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Create Investigation";
        }
    }

    /* =========================================
       MONITORING RULES
    ========================================= */

    async function loadRules() {
        const payload = await api(endpoints.rules + query({
            search: $("ruleSearch")?.value?.trim(),
            status: $("ruleStatus")?.value,
            category: $("ruleCategory")?.value,
            pageSize: 100
        }));

        const items = records(payload, "rules", "monitoringRules", "records", "items");

        $("ruleTable").innerHTML = items.length
            ? items.map(item => `
          <tr>
            <td>${esc(item.reference || item.ruleReference || item.id)}</td>
            <td>${esc(item.name || item.title)}</td>
            <td>${esc(item.category || item.type)}</td>
            <td>${esc(item.scope || item.jurisdiction || "Global")}</td>
            <td>${badge(item.severity)}</td>
            <td>${esc(item.triggerCount ?? item.trigger_count ?? "—")}</td>
            <td>${esc(date(item.lastTriggered || item.last_triggered))}</td>
            <td>${badge(item.status)}</td>
            <td>
              <button data-detail="rules" data-id="${esc(item.id)}">Inspect</button>
              ${String(item.status).toLowerCase() === "draft"
                    ? `<button data-action="request-rule-activation" data-id="${esc(item.id)}">Request activation</button>`
                    : String(item.status).toLowerCase() === "active"
                        ? `<button data-action="request-rule-suspension" data-id="${esc(item.id)}">Request suspension</button>`
                        : `<button data-action="review-rule" data-id="${esc(item.id)}">Review</button>`
                }
            </td>
          </tr>
        `).join("")
            : empty(9, "No monitoring rules returned.");
    }

    async function createRule(form) {
        const button = $("ruleSubmit");

        button.disabled = true;
        button.textContent = "Saving rule...";

        try {
            const values = Object.fromEntries(
                new FormData(form).entries()
            );

            const threshold = values.threshold === ""
                ? null
                : Number(values.threshold);

            if (
                threshold !== null &&
                (!Number.isFinite(threshold) || threshold < 0)
            ) {
                throw new Error("Enter a valid non-negative threshold.");
            }

            await api(endpoints.rules, {
                method: "POST",
                headers: idempotencyHeaders(),
                body: {
                    name: values.name.trim(),
                    category: values.category,
                    scope: values.scope,
                    severity: values.severity,
                    threshold,
                    currency: values.currency || null,
                    description: values.description.trim(),
                    status: "draft",
                    approvalRequired: true,
                    source: "talvora_global_aml"
                }
            });

            $("ruleModal").hidden = true;
            form.reset();

            toast("Monitoring rule saved as a draft.", "success");

            await Promise.allSettled([
                loadRules(),
                loadOverview()
            ]);

        } catch (error) {
            toast(`Rule creation failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Save Rule Draft";
        }
    }

    /* =========================================
       SANCTIONS, PEP AND ADVERSE MEDIA
    ========================================= */

    async function loadScreenings() {
        const payload = await api(endpoints.screening + query({
            search: $("screeningSearch")?.value?.trim(),
            type: $("screeningType")?.value,
            status: $("screeningStatus")?.value,
            pageSize: 100
        }));

        const items = records(
            payload,
            "screenings",
            "checks",
            "records",
            "items"
        );

        $("screeningTable").innerHTML = items.length
            ? items.map(item => `
          <tr>
            <td>${esc(item.reference || item.screeningReference || item.id)}</td>
            <td>${esc(item.subjectType || item.subject_type)}</td>
            <td>${esc(item.screeningType || item.type)}</td>
            <td>${esc(item.jurisdiction || item.country || "—")}</td>
            <td>${esc(item.sourceName || item.source || "—")}</td>
            <td>${esc(item.matchConfidence ?? item.match_confidence ?? "—")}</td>
            <td>${esc(date(item.screenedAt || item.createdAt))}</td>
            <td>${badge(item.result || item.status)}</td>
            <td>
              <button data-detail="screening" data-id="${esc(item.id)}">Inspect</button>
              <button data-action="review-screening" data-id="${esc(item.id)}">Review</button>
            </td>
          </tr>
        `).join("")
            : empty(9, "No screening records returned.");
    }

    async function createScreening(form) {
        const button = $("screeningSubmit");

        button.disabled = true;
        button.textContent = "Submitting screening...";

        try {
            const values = Object.fromEntries(
                new FormData(form).entries()
            );

            await api(endpoints.screeningChecks, {
                method: "POST",
                headers: idempotencyHeaders(),
                body: {
                    subjectType: values.subjectType,
                    subjectName: values.subjectName.trim(),
                    jurisdiction: values.jurisdiction || null,
                    screeningType: values.screeningType,
                    customerReference: values.customerReference.trim() || null,
                    context: values.context.trim() || null,
                    source: "talvora_global_aml"
                }
            });

            $("screeningModal").hidden = true;
            form.reset();

            toast("Screening request submitted.", "success");

            await Promise.allSettled([
                loadScreenings(),
                loadOverview()
            ]);

        } catch (error) {
            toast(`Screening request failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Submit Screening Request";
        }
    }

    /* =========================================
       CUSTOMER DUE DILIGENCE
    ========================================= */

    async function loadCustomers() {
        const payload = await api(endpoints.customers + query({
            search: $("customerSearch")?.value?.trim(),
            riskLevel: $("customerRisk")?.value,
            status: $("customerStatus")?.value,
            pageSize: 100
        }));

        const items = records(payload, "customers", "profiles", "records", "items");

        $("customerTable").innerHTML = items.length
            ? items.map(item => `
          <tr>
            <td>${esc(item.reference || item.customerReference || item.id)}</td>
            <td>${esc(item.customerType || item.type)}</td>
            <td>${esc(item.jurisdiction || item.country || "—")}</td>
            <td>${badge(item.riskLevel || item.riskClassification)}</td>
            <td>${badge(item.kycStatus || item.kyc_status)}</td>
            <td>${badge(item.eddStatus || item.edd_status)}</td>
            <td>${esc(date(item.lastReview || item.last_review))}</td>
            <td>${esc(date(item.nextReview || item.next_review))}</td>
            <td>
              <button data-detail="customers" data-id="${esc(item.id)}">Inspect</button>
              <button data-action="request-cdd-review" data-id="${esc(item.id)}">Request review</button>
            </td>
          </tr>
        `).join("")
            : empty(9, "No customer due diligence records returned.");
    }

    /* =========================================
       SAR / STR REPORTING
    ========================================= */

    async function loadReports() {
        const payload = await api(endpoints.reports + query({
            search: $("reportSearch")?.value?.trim(),
            type: $("reportType")?.value,
            status: $("reportStatus")?.value,
            pageSize: 100
        }));

        const items = records(payload, "reports", "filings", "records", "items");

        $("reportTable").innerHTML = items.length
            ? items.map(item => `
          <tr>
            <td>${esc(item.reference || item.reportReference || item.id)}</td>
            <td>${esc(item.type || item.reportType)}</td>
            <td>${esc(item.jurisdiction || item.country || "—")}</td>
            <td>${esc(item.caseReference || item.case_reference || "—")}</td>
            <td>${esc(item.preparedBy || item.owner || "—")}</td>
            <td>${esc(date(item.deadline || item.reportingDeadline))}</td>
            <td>${esc(date(item.submittedAt || item.submitted_at))}</td>
            <td>${badge(item.status)}</td>
            <td>
              <button data-detail="reports" data-id="${esc(item.id)}">Inspect</button>
              ${["draft", "pending_review"].includes(String(item.status).toLowerCase())
                    ? `<button data-action="request-report-approval" data-id="${esc(item.id)}">Request approval</button>`
                    : ""}
            </td>
          </tr>
        `).join("")
            : empty(9, "No regulatory reporting records returned.");
    }

    async function createReport(form) {
        const button = $("reportSubmit");

        button.disabled = true;
        button.textContent = "Saving confidential draft...";

        try {
            const values = Object.fromEntries(
                new FormData(form).entries()
            );

            await api(endpoints.reports, {
                method: "POST",
                headers: idempotencyHeaders(),
                body: {
                    type: values.type,
                    jurisdiction: values.jurisdiction,
                    caseReference: values.caseReference.trim() || null,
                    deadline: values.deadline || null,
                    summary: values.summary.trim(),
                    status: "draft",
                    source: "talvora_global_aml"
                }
            });

            $("reportModal").hidden = true;
            form.reset();

            toast("Confidential reporting draft saved.", "success");

            await Promise.allSettled([
                loadReports(),
                loadOverview()
            ]);

        } catch (error) {
            toast(`Report creation failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Save Confidential Draft";
        }
    }

    /* =========================================
       GLOBAL JURISDICTIONS
    ========================================= */

    async function loadJurisdictions() {
        const payload = await api(endpoints.jurisdictions + query({
            search: $("jurisdictionSearch")?.value?.trim(),
            status: $("jurisdictionStatus")?.value,
            pageSize: 100
        }));

        const items = records(
            payload,
            "jurisdictions",
            "records",
            "items"
        );

        $("jurisdictionTable").innerHTML = items.length
            ? items.map(item => `
          <tr>
            <td>${esc(item.name || item.countryName)}</td>
            <td>${esc(item.code || item.countryCode || item.country_code)}</td>
            <td>${esc(item.regulatoryAuthority || item.regulator || "—")}</td>
            <td>${badge(item.riskClassification || item.riskLevel)}</td>
            <td>${esc(item.reportingFramework || item.framework || "—")}</td>
            <td>${esc(date(item.lastReview || item.last_review))}</td>
            <td>${esc(date(item.nextReview || item.next_review))}</td>
            <td>${badge(item.status)}</td>
            <td>
              <button data-detail="jurisdictions" data-id="${esc(item.id)}">Inspect</button>
              <button data-action="review-jurisdiction" data-id="${esc(item.id)}">Request review</button>
            </td>
          </tr>
        `).join("")
            : empty(9, "No jurisdiction records returned.");
    }

    /* =========================================
       AUDIT & GOVERNANCE
    ========================================= */

    async function loadAudit() {
        const payload = await api(endpoints.audit + query({
            search: $("auditSearch")?.value?.trim(),
            pageSize: 100
        }));

        const items = records(payload, "audit", "records", "items");

        $("auditTable").innerHTML = items.length
            ? items.map(item => `
          <tr>
            <td>${esc(item.reference || item.id)}</td>
            <td>${esc(item.actorName || item.actor || "—")}</td>
            <td>${esc(item.action || item.operation)}</td>
            <td>${esc(item.resource || item.resourceReference || "—")}</td>
            <td>${esc(item.reason || "—")}</td>
            <td>${esc(item.jurisdiction || item.country || "—")}</td>
            <td>${esc(date(item.createdAt || item.created_at))}</td>
            <td>${badge(item.result || item.status)}</td>
          </tr>
        `).join("")
            : empty(8, "No AML audit records returned.");
    }

    /* =========================================
       AUTHORIZED ACTION WORKFLOWS
    ========================================= */

    const RESOURCE_ENDPOINTS = {
        alerts: endpoints.alerts,
        cases: endpoints.cases,
        rules: endpoints.rules,
        screening: endpoints.screening,
        customers: endpoints.customers,
        reports: endpoints.reports,
        jurisdictions: endpoints.jurisdictions
    };

    const ACTION_MAP = {
        "review-alert": "alerts",
        "escalate-alert": "alerts",

        "review-case": "cases",
        "escalate-case": "cases",

        "request-rule-activation": "rules",
        "request-rule-suspension": "rules",
        "review-rule": "rules",

        "review-screening": "screening",

        "request-cdd-review": "customers",

        "request-report-approval": "reports",

        "review-jurisdiction": "jurisdictions"
    };

    const ACTION_DESCRIPTIONS = {
        "review-alert":
            "Request formal assessment of the AML alert, transaction pattern and supporting evidence.",

        "escalate-alert":
            "Escalate the alert to the designated senior financial crime or compliance authority.",

        "review-case":
            "Request review of the investigation findings, evidence, risk classification and next steps.",

        "escalate-case":
            "Escalate the investigation for higher-level financial crime oversight.",

        "request-rule-activation":
            "Submit the monitoring rule for validation, testing and independent activation approval.",

        "request-rule-suspension":
            "Request a controlled review and suspension decision for this monitoring rule.",

        "review-rule":
            "Request a documented review of the monitoring rule, scope and effectiveness.",

        "review-screening":
            "Request secondary verification of the potential screening match and its source evidence.",

        "request-cdd-review":
            "Request customer due diligence reassessment and review of the applicable risk profile.",

        "request-report-approval":
            "Submit the confidential SAR/STR draft for authorized compliance approval.",

        "review-jurisdiction":
            "Request review of jurisdictional AML requirements and regulatory obligations."
    };

    function requestAction(type, id, action) {
        state.pendingAction = { type, id, action };

        $("actionTitle").textContent = action
            .replace(/-/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());

        $("actionDescription").textContent =
            ACTION_DESCRIPTIONS[action] ||
            "This action requires documented authorization and server-side validation.";

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
                throw new Error("Unsupported AML operation.");
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
                        source: "talvora_global_aml"
                    }
                }
            );

            $("actionModal").hidden = true;
            state.pendingAction = null;

            toast("AML workflow request submitted.", "success");

            await Promise.allSettled([
                loaders[state.section]?.(),
                loadOverview()
            ]);

        } catch (error) {
            toast(`AML action failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Submit Request";
        }
    }

    /* =========================================
       CONTROLLED RECORD DETAILS
    ========================================= */

    async function openDetail(type, id) {
        const resource = RESOURCE_ENDPOINTS[type];

        if (!resource) return;

        try {
            const payload = await api(
                `${resource}/${encodeURIComponent(id)}`
            );

            const record = dataOf(payload);

            $("detailTitle").textContent =
                `${type.toUpperCase()} — ${record.reference || record.id || id}`;

            const sensitiveFields =
                /password|secret|token|credential|private.?key|access.?key|passport|national.?id|biometric|date.?of.?birth|phone|email|home.?address|full.?address|account.?number|iban|card.?number/i;

            $("detailBody").innerHTML = Object.entries(record)
                .filter(([key, value]) =>
                    !sensitiveFields.test(key) &&
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
                '<p class="muted">No additional non-sensitive record details returned.</p>';

            $("detailModal").hidden = false;

        } catch (error) {
            toast(`Unable to retrieve record: ${error.message}`, "error");
        }
    }

    /* =========================================
       AUDIT EXPORT
    ========================================= */

    async function exportAudit() {
        try {
            const csrf = document.querySelector(
                'meta[name="csrf-token"]'
            )?.content;

            const response = await fetch(
                url(endpoints.exports + query({
                    type: "aml_audit",
                    format: "csv"
                })),
                {
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        "Accept": "text/csv",
                        ...(csrf ? { "X-CSRF-Token": csrf } : {})
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
            link.download = "talvora-global-aml-audit.csv";

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

            toast("AML audit export generated.", "success");

        } catch (error) {
            toast(error.message, "error");
        }
    }

    /* =========================================
       NAVIGATION
    ========================================= */

    const loaders = {
        overview: loadOverview,
        alerts: loadAlerts,
        cases: loadCases,
        monitoring: loadRules,
        screening: loadScreenings,
        customers: loadCustomers,
        reports: loadReports,
        jurisdictions: loadJurisdictions,
        audit: loadAudit
    };

    async function navigate(section) {
        if (!loaders[section]) return;

        state.section = section;

        document.querySelectorAll(".aml-section").forEach(element => {
            element.classList.toggle(
                "active",
                element.id === section
            );
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
                if (event.target === overlay) {
                    overlay.hidden = true;
                }
            });
        });

        $("menuToggle")?.addEventListener("click", () => {
            $("sidebar").classList.toggle("open");
        });

        $("refreshAll")?.addEventListener("click", refreshAll);

        $("caseForm")?.addEventListener("submit", event => {
            event.preventDefault();
            createCase(event.currentTarget);
        });

        $("screeningForm")?.addEventListener("submit", event => {
            event.preventDefault();
            createScreening(event.currentTarget);
        });

        $("ruleForm")?.addEventListener("submit", event => {
            event.preventDefault();
            createRule(event.currentTarget);
        });

        $("reportForm")?.addEventListener("submit", event => {
            event.preventDefault();
            createReport(event.currentTarget);
        });

        $("actionReason")?.addEventListener("input", event => {
            $("actionSubmit").disabled =
                event.target.value.trim().length < 10;
        });

        $("actionSubmit")?.addEventListener("click", submitAction);

        $("exportAudit")?.addEventListener("click", exportAudit);

        /* Search and filter controls */

        const bindings = [
            ["alertSearch", "input", loadAlerts],
            ["alertSeverity", "change", loadAlerts],
            ["alertStatus", "change", loadAlerts],
            ["alertCategory", "change", loadAlerts],

            ["caseSearch", "input", loadCases],
            ["caseStatus", "change", loadCases],
            ["caseRisk", "change", loadCases],

            ["ruleSearch", "input", loadRules],
            ["ruleStatus", "change", loadRules],
            ["ruleCategory", "change", loadRules],

            ["screeningSearch", "input", loadScreenings],
            ["screeningType", "change", loadScreenings],
            ["screeningStatus", "change", loadScreenings],

            ["customerSearch", "input", loadCustomers],
            ["customerRisk", "change", loadCustomers],
            ["customerStatus", "change", loadCustomers],

            ["reportSearch", "input", loadReports],
            ["reportType", "change", loadReports],
            ["reportStatus", "change", loadReports],

            ["jurisdictionSearch", "input", loadJurisdictions],
            ["jurisdictionStatus", "change", loadJurisdictions],

            ["auditSearch", "input", loadAudit]
        ];

        bindings.forEach(([id, event, callback]) => {
            const element = $(id);
            if (!element) return;

            element.addEventListener(
                event,
                event === "input" ? debounce(callback) : () => {
                    callback().catch(error => toast(error.message, "error"));
                }
            );
        });

        /* Delegated actions */

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
                const resource = ACTION_MAP[actionType];

                if (resource) {
                    requestAction(
                        resource,
                        action.dataset.id,
                        actionType
                    );
                }
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
       REFRESH
    ========================================= */

    async function refreshAll() {
        setStatus("loading", "Refreshing");

        const results = await Promise.allSettled([
            loadReferenceData(),
            loadOverview()
        ]);

        if (results.every(result => result.status === "rejected")) {
            setStatus("error", "Unavailable");
            toast("AML services could not be reached.", "error");
            return;
        }

        if (state.section !== "overview") {
            try {
                await loaders[state.section]();
            } catch (error) {
                toast(error.message, "error");
            }
        }

        setStatus("connected", "Connected");
    }

    /* =========================================
       INITIALIZATION
    ========================================= */

    async function initialize() {
        bindEvents();

        setStatus("loading", "Connecting");

        const results = await Promise.allSettled([
            loadReferenceData(),
            loadOverview()
        ]);

        if (results.every(result => result.status === "rejected")) {
            setStatus("error", "Unavailable");

            console.error(
                "[TALVORA AML] Initialization failed."
            );
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
                    console.warn("[TALVORA AML]", error);
                });
            }
        }, Number(config.refreshInterval) || 30000);
    }

    /* =========================================
       PUBLIC MODULE INTERFACE
    ========================================= */

    window.TALVORA_AML = {
        refresh: refreshAll,
        navigate,
        loadOverview,
        loadAlerts,
        loadCases,
        loadRules,
        loadScreenings,
        loadCustomers,
        loadReports,
        loadJurisdictions,
        loadAudit,

        config: {
            apiBaseUrl: base,
            endpoints
        }
    };

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
