
/* =========================================================
   TALVORA GLOBAL ADMIN
   UNIFIED INTEGRATION & COMPLETION ENGINE

   File: ../talvora-integration.js

   All API requests use authenticated same-origin sessions.
   No access tokens are stored in browser storage.
   All integration checks are read-only.
========================================================= */

(() => {
    "use strict";

    if (!document.body.hasAttribute("data-integration-centre")) {
        return;
    }


    /* =====================================================
       1. CONFIGURATION
    ===================================================== */

    const sharedConfig = window.TALVORA_ADMIN_CONFIG || {};
    const API = `${String(sharedConfig.apiBaseUrl || "").replace(/\/+$/, "")}/api/admin`;

    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

    const $$ = (selector, parent = document) =>
        [...parent.querySelectorAll(selector)];


    const MODULES = [
        ["employers", "Global Employers", "/api/v1/admin/employers"],
        ["disputes", "Dispute Resolution & Appeals", "/api/super-admin/disputes/dashboard"],
        ["support", "Support & Customer Experience", "/api/v1/admin/support"],
        ["identity", "User & Identity Management", "/api/identity-management/dashboard"],
        ["finance", "Financial Operations & Revenue", "/api/finance/dashboard"],
        ["payment-gateway", "Payment Gateway & Banking", "/api/payment-infrastructure/dashboard"],
        ["payment-integration", "Payment Integration & Testing", "/api/payment-infrastructure/dashboard"],
        ["fraud-aml", "Fraud Prevention & AML", "/api/financial-crime/dashboard"],
        ["treasury", "Treasury & Liquidity", "/api/treasury/dashboard"],
        ["compliance", "Financial Compliance & Reporting", "/api/compliance/dashboard"],
        ["continuity", "Security & Business Continuity", "/api/financial-resilience/dashboard"],
        ["reconciliation", "Reconciliation & Settlement", "/api/financial-reconciliation/dashboard"],
        ["aml", "Transaction Monitoring & AML", "/api/aml/dashboard"],
        ["jobs", "Jobs, Applications & Recruitment", "/api/v1/admin/jobs/summary"],
        ["skills", "Skills Passport, Evidence & Matching", "/api/v1/admin/evidence/summary"],
        ["kyc", "KYC, KYB & Identity Verification", `${API}/kyc/dashboard`],
        ["privacy", "Privacy, Consent & Data Protection", `${API}/privacy/dashboard`],
        ["trust-safety", "Trust, Safety & Moderation", `${API}/trust-safety/dashboard`],
        ["integration", "Unified Admin Integration", `${API}/integration/health`]
    ].map(([key, name, endpoint]) => ({ key, name, endpoint }));


    const ENDPOINTS = {

        session: `${API}/auth/session`,

        health: `${API}/integration/health`,

        notifications: `${API}/integration/notifications?limit=50`,

        audit: `${API}/integration/audit-events?limit=100`,

        workflows: `${API}/integration/workflows`

    };


    const TESTS = [

        {
            key: "session",
            name: "Administrator Authentication",
            endpoint: ENDPOINTS.session
        },

        {
            key: "health",
            name: "Integration Health Service",
            endpoint: ENDPOINTS.health
        },

        ...MODULES.map(module => ({
            key: module.key,
            name: module.name,
            endpoint: module.endpoint
        })),

        {
            key: "notifications",
            name: "Notification Service",
            endpoint: ENDPOINTS.notifications
        },

        {
            key: "audit",
            name: "Audit Trail Service",
            endpoint: ENDPOINTS.audit
        },

        {
            key: "workflows",
            name: "Workflow Monitoring Service",
            endpoint: ENDPOINTS.workflows
        }

    ];


    let currentSession = null;
    let currentHealth = null;

    let auditRecords = [];
    let notificationRecords = [];
    let workflowRecords = [];

    let testResults = [];

    let isRefreshing = false;
    let isTesting = false;


    /* =====================================================
       2. SAFE API COMMUNICATION
    ===================================================== */

    async function apiGet(endpoint, timeout = 15000) {

        const url = new URL(endpoint, window.location.origin);

        if (url.origin !== window.location.origin) {
            throw new Error("External API origin rejected.");
        }

        const controller = new AbortController();

        const timeoutId = setTimeout(
            () => controller.abort(),
            timeout
        );

        try {

            const response = await fetch(
                url.pathname + url.search,
                {
                    method: "GET",

                    credentials: "same-origin",

                    cache: "no-store",

                    headers: {
                        "Accept": "application/json"
                    },

                    signal: controller.signal
                }
            );


            if (response.status === 204) {

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                return {};
            }


            const contentType =
                response.headers.get("content-type") || "";


            if (!contentType.includes("application/json")) {

                throw new Error(
                    `Expected JSON response. HTTP ${response.status}`
                );

            }


            const data = await response.json();


            if (!response.ok) {

                if (response.status === 401) {
                    throw new Error("Authentication required.");
                }

                if (response.status === 403) {
                    throw new Error("Permission denied.");
                }

                throw new Error(`HTTP ${response.status}`);

            }


            if (
                data &&
                typeof data === "object" &&
                data.success === false
            ) {
                throw new Error(
                    data.message || "The API reported an unsuccessful response."
                );
            }


            return data;

        } catch (error) {

            if (error.name === "AbortError") {
                throw new Error("Request timed out.");
            }

            throw error;

        } finally {

            clearTimeout(timeoutId);

        }

    }


    async function safeGet(endpoint) {

        try {

            return {
                ok: true,
                data: await apiGet(endpoint),
                error: null
            };

        } catch (error) {

            return {
                ok: false,
                data: null,
                error: error.message
            };

        }

    }


    /* =====================================================
       3. DATA NORMALIZATION
    ===================================================== */

    function unwrap(payload) {

        if (
            payload &&
            typeof payload === "object" &&
            !Array.isArray(payload) &&
            payload.data &&
            typeof payload.data === "object"
        ) {
            return payload.data;
        }

        return payload;

    }


    function getItems(payload) {

        const data = unwrap(payload);

        if (Array.isArray(data)) {
            return data;
        }

        if (!data || typeof data !== "object") {
            return [];
        }

        if (Array.isArray(data.items)) return data.items;

        if (Array.isArray(data.results)) return data.results;

        if (Array.isArray(data.records)) return data.records;

        if (Array.isArray(data.events)) return data.events;

        return [];

    }


    function getText(value, fallback = "—") {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return fallback;
        }

        if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
        ) {
            return String(value);
        }

        return fallback;

    }


    function getStatus(value) {

        const status = String(value || "").toLowerCase();

        if (
            ["healthy", "ok", "online", "connected", "operational", "passed"].includes(status)
        ) {
            return "healthy";
        }

        if (
            ["degraded", "warning", "partial", "delayed"].includes(status)
        ) {
            return "degraded";
        }

        if (
            ["offline", "down", "unavailable", "failed", "error"].includes(status)
        ) {
            return "offline";
        }

        if (
            ["running", "checking", "in_progress"].includes(status)
        ) {
            return "running";
        }

        return "unknown";

    }


    function statusLabel(value) {

        const status = getStatus(value);

        const labels = {
            healthy: "Healthy",
            degraded: "Degraded",
            offline: "Unavailable",
            running: "Running",
            unknown: "Unknown"
        };

        return labels[status];

    }


    function formatDate(value) {

        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return date.toLocaleString();

    }


    function formatDuration(value) {

        if (
            typeof value !== "number" ||
            !Number.isFinite(value)
        ) {
            return "—";
        }

        return `${Math.round(value)} ms`;

    }


    function createCell(value) {

        const cell = document.createElement("td");

        cell.textContent = getText(value);

        return cell;

    }


    function createBadge(value) {

        const badge = document.createElement("span");

        const status = getStatus(value);

        badge.className = `health-state status-${status}`;

        badge.textContent = statusLabel(value);

        return badge;

    }


    function setText(selector, value) {

        const element = $(selector);

        if (element) {
            element.textContent = getText(value);
        }

    }


    function setMetric(name, value) {

        const element = $(
            `[data-integration-metric="${name}"]`
        );

        if (element) {
            element.textContent = getText(value);
        }

    }


    /* =====================================================
       4. NAVIGATION
    ===================================================== */

    function showSection(sectionId) {

        const section = document.getElementById(sectionId);

        if (
            !section ||
            !section.classList.contains("module-section")
        ) {
            return;
        }


        $$(".module-section").forEach(item => {

            item.classList.toggle(
                "active",
                item === section
            );

        });


        $$("[data-section]").forEach(link => {

            link.classList.toggle(
                "active",
                link.dataset.section === sectionId
            );

        });


        history.replaceState(
            null,
            "",
            `#${sectionId}`
        );

    }


    $$("[data-section]").forEach(link => {

        link.addEventListener("click", event => {

            event.preventDefault();

            showSection(link.dataset.section);

            $("#sidebar")?.classList.remove("sidebar-open");

        });

    });


    $$("[data-go]").forEach(button => {

        button.addEventListener("click", () => {

            showSection(button.dataset.go);

        });

    });


    const initialSection =
        location.hash.replace("#", "") || "overview";

    showSection(initialSection);


    $("#menuToggle")?.addEventListener("click", () => {

        $("#sidebar")?.classList.toggle("sidebar-open");

    });


    /* =====================================================
       5. CONNECTION STATUS
    ===================================================== */

    function updateConnection(sessionResult, healthResult) {

        const element = $("#connectionStatus");

        if (!element) return;


        const authenticated =
            sessionResult?.ok &&
            unwrap(sessionResult.data)?.authenticated === true;


        const healthAvailable = healthResult?.ok === true;


        let label;
        let state;


        if (authenticated && healthAvailable) {

            label = "Connected";
            state = "healthy";

        } else if (!authenticated && sessionResult?.ok) {

            label = "Authentication required";
            state = "degraded";

        } else {

            label = "Connection issue";
            state = "offline";

        }


        const indicator =
            element.querySelector("i") ||
            document.createElement("i");


        element.replaceChildren(
            indicator,
            document.createTextNode(label)
        );


        element.dataset.status = state;

    }


    /* =====================================================
       6. AUTHENTICATION & PERMISSIONS
    ===================================================== */

    function renderSession(result) {

        const session = result?.ok
            ? unwrap(result.data)
            : null;


        currentSession = session;


        if (!session) {

            setText("#sessionStatus", "Unavailable");

            setText("#adminDisplayName", "Administrator");

            setText("#adminRole", "Session unavailable");

            setText("#sessionName", "—");

            setText("#sessionRole", "—");

            setText("#sessionExpiry", "—");

            setText("#sessionJurisdiction", "—");

            setText("#permissionCount", "—");

            setText("#globalPermission", "Not verified");

            const permissionList = $("#permissionList");

            if (permissionList) {
                permissionList.textContent =
                    result?.error || "Authentication information unavailable.";
            }

            return;

        }


        const authenticated =
            session.authenticated === true;


        const user = session.user || {};


        const permissions = Array.isArray(session.permissions)
            ? session.permissions
            : Array.isArray(user.permissions)
                ? user.permissions
                : [];


        const displayName =
            user.displayName ||
            user.name ||
            user.reference ||
            "Authenticated administrator";


        const role =
            user.role ||
            session.role ||
            "Administrator";


        const jurisdiction =
            Array.isArray(session.jurisdictionScope)
                ? session.jurisdictionScope.join(", ")
                : session.jurisdictionScope;


        setText(
            "#sessionStatus",
            authenticated ? "Authenticated" : "Not authenticated"
        );


        setText(
            "#adminDisplayName",
            authenticated ? displayName : "Administrator"
        );


        setText("#adminRole", role);

        setText("#sessionName", authenticated ? displayName : "—");

        setText("#sessionRole", role);

        setText("#sessionExpiry", formatDate(session.expiresAt));

        setText("#sessionJurisdiction", jurisdiction || "Not provided");

        setText("#permissionCount", permissions.length);


        const hasGlobalPermission = permissions.some(permission => {

            const name =
                typeof permission === "string"
                    ? permission
                    : permission?.name || permission?.code;

            return [
                "*",
                "admin:global",
                "super_admin"
            ].includes(String(name || "").toLowerCase());

        });


        setText(
            "#globalPermission",
            hasGlobalPermission ? "Present" : "Not established"
        );


        const permissionList = $("#permissionList");

        if (!permissionList) return;


        permissionList.replaceChildren();


        if (!permissions.length) {

            permissionList.textContent =
                "No permission list returned by the server.";

            return;

        }


        permissions.forEach(permission => {

            const name =
                typeof permission === "string"
                    ? permission
                    : permission?.name || permission?.code;


            if (!name) return;


            const chip = document.createElement("span");

            chip.className = "permission-chip";

            chip.textContent = name;

            permissionList.append(chip);

        });

    }


    /* =====================================================
       7. MODULE HEALTH
    ===================================================== */

    function renderModuleHealth(health, results = []) {

        const backendModules =
            getItems(health?.modules);


        const backendMap = new Map(
            backendModules.map(item => [
                String(item.key || item.module || "").toLowerCase(),
                item
            ])
        );


        const testMap = new Map(
            results.map(item => [item.key, item])
        );


        const body = $("#moduleHealthTable");

        if (!body) return;


        body.replaceChildren();


        const statuses = [];


        MODULES.forEach(module => {

            const backendRecord =
                backendMap.get(module.key);


            const testRecord =
                testMap.get(module.key);


            let status = backendRecord?.status;


            if (!status && testRecord) {

                status = testRecord.ok
                    ? "healthy"
                    : "offline";

            }


            status = status || "unknown";


            const normalized = getStatus(status);

            statuses.push(normalized);


            const row = document.createElement("tr");


            row.append(
                createCell(module.name),
                createCell(
                    backendRecord?.apiStatus ||
                    statusLabel(status)
                ),
                createCell(
                    formatDuration(
                        backendRecord?.latencyMs ??
                        testRecord?.duration
                    )
                ),
                createCell(
                    formatDate(
                        backendRecord?.checkedAt
                    ) === "—"
                        ? testRecord?.checkedAt
                        : formatDate(backendRecord?.checkedAt)
                )
            );


            const statusCell = document.createElement("td");

            statusCell.append(createBadge(status));

            row.append(statusCell);

            body.append(row);


            const cardLabel = $(
                `[data-module-health="${module.key}"]`
            );


            if (cardLabel) {

                cardLabel.textContent =
                    statusLabel(status);

                cardLabel.className =
                    `module-health-label status-${normalized}`;

            }

        });


        setMetric("totalModules", MODULES.length);

        setMetric(
            "healthyModules",
            statuses.filter(s => s === "healthy").length
        );

        setMetric(
            "degradedModules",
            statuses.filter(s => s === "degraded").length
        );

        setMetric(
            "offlineModules",
            statuses.filter(s => s === "offline").length
        );

    }

    const MODULE_LINKS = {
        employers: "../employers.html",
        disputes: "../disputes.html",
        support: "../../support.html",
        identity: "../identity-management.html",
        finance: "../financial-operations.html",
        "payment-gateway": "../payment-gateway.html",
        "payment-integration": "../payment-integration.html",
        "fraud-aml": "../fraud-aml.html",
        treasury: "../treasury.html",
        compliance: "../compliance.html",
        continuity: "../continuity.html",
        reconciliation: "../reconciliation.html",
        aml: "../aml.html",
        jobs: "../../jobs.html",
        skills: "skills.html",
        kyc: "kyc.html",
        privacy: "privacy.html",
        "trust-safety": "trust-safety.html",
        integration: "integration.html"
    };

    function renderModuleCards() {
        const grid = $(".integration-module-grid");
        if (!grid) return;

        grid.innerHTML = MODULES.map((module, index) => `
            <a href="${MODULE_LINKS[module.key] || "#"}" class="integration-module-card">
                <span class="integration-module-number">${String(index + 1).padStart(2, "0")}</span>
                <h3>${module.name}</h3>
                <p>Connected centre and monitored administrative service.</p>
                <span class="module-health-label" data-module-health="${module.key}">Checking...</span>
            </a>
        `).join("");
    }


    /* =====================================================
       8. NOTIFICATIONS
    ===================================================== */

    function renderNotifications(payload) {

        notificationRecords = getItems(payload);


        const container = $("#notificationList");

        if (!container) return;


        container.replaceChildren();


        const unread = notificationRecords.filter(item =>
            item.read !== true &&
            item.isRead !== true
        );


        setMetric("notifications", unread.length);


        if (!notificationRecords.length) {

            container.textContent =
                "No notification records were returned.";

            return;

        }


        notificationRecords.forEach(item => {

            const card = document.createElement("article");

            const severity =
                String(item.severity || item.priority || "info")
                    .toLowerCase();


            card.className =
                `integration-notification severity-${severity}`;


            const heading = document.createElement("strong");

            heading.textContent =
                getText(item.title, "Platform notification");


            const message = document.createElement("p");

            message.textContent =
                getText(item.message || item.description);


            const timestamp = document.createElement("small");

            timestamp.textContent =
                formatDate(item.createdAt || item.timestamp);


            card.append(heading, message, timestamp);

            container.append(card);

        });

    }


    /* =====================================================
       9. AUDIT TRAIL
    ===================================================== */

    function renderAudit() {

        const body = $("#auditTable");

        const recentBody = $("#recentAuditTable");


        if (!body) return;


        const search =
            ($("#auditSearch")?.value || "")
                .trim()
                .toLowerCase();


        const moduleFilter =
            ($("#auditModuleFilter")?.value || "")
                .toLowerCase();


        const filtered = auditRecords.filter(item => {

            const text = [
                item.reference,
                item.actorReference,
                item.module,
                item.action,
                item.resourceReference,
                item.result
            ].join(" ").toLowerCase();


            const matchesSearch =
                !search || text.includes(search);


            const matchesModule =
                !moduleFilter ||
                String(item.module || "").toLowerCase() === moduleFilter;


            return matchesSearch && matchesModule;

        });


        body.replaceChildren();


        if (!filtered.length) {

            const row = document.createElement("tr");

            const cell = createCell(
                "No matching audit records were returned."
            );

            cell.colSpan = 7;
            cell.className = "empty-cell";

            row.append(cell);

            body.append(row);

        } else {

            filtered.forEach(item => {

                const row = document.createElement("tr");


                row.append(
                    createCell(item.reference),
                    createCell(item.actorReference),
                    createCell(item.module),
                    createCell(item.action),
                    createCell(item.resourceReference),
                    createCell(item.result),
                    createCell(formatDate(item.createdAt))
                );


                body.append(row);

            });

        }


        setText("#auditCount", `${filtered.length} records`);

        setMetric("auditEvents", auditRecords.length);


        if (recentBody) {

            recentBody.replaceChildren();


            filtered.slice(0, 5).forEach(item => {

                const row = document.createElement("tr");

                row.append(
                    createCell(item.reference),
                    createCell(item.module),
                    createCell(item.action),
                    createCell(item.result),
                    createCell(formatDate(item.createdAt))
                );

                recentBody.append(row);

            });


            if (!filtered.length) {

                const row = document.createElement("tr");

                const cell = createCell("No audit activity available.");

                cell.colSpan = 5;
                cell.className = "empty-cell";

                row.append(cell);

                recentBody.append(row);

            }

        }

    }


    /* =====================================================
       10. WORKFLOW MONITORING
    ===================================================== */

    function renderWorkflows(payload) {

        workflowRecords = getItems(payload);


        const workflowMap = new Map(
            workflowRecords.map(item => [
                item.key || item.reference || item.name,
                item
            ])
        );


        const exceptions = workflowRecords.filter(item => {

            const status =
                String(item.status || "").toLowerCase();

            return [
                "failed",
                "error",
                "blocked",
                "exception",
                "degraded"
            ].includes(status);

        });


        setMetric(
            "workflowExceptions",
            workflowRecords.length
                ? exceptions.length
                : "—"
        );


        $$("[data-workflow-status]").forEach(element => {

            const record = workflowMap.get(
                element.dataset.workflowStatus
            );


            if (!record) {

                element.textContent =
                    "Not reported by API";

                return;

            }


            element.textContent =
                statusLabel(record.status);

            element.className =
                `status-${getStatus(record.status)}`;

        });


        if (workflowRecords.length) {

            setText(
                "[data-workflow-status]",
                statusLabel(workflowRecords[0].status)
            );

        }

    }


    /* =====================================================
       11. GLOBAL HEALTH METRICS
    ===================================================== */

    function renderHealthMetrics(healthResult) {

        const health = healthResult?.ok
            ? unwrap(healthResult.data)
            : null;


        currentHealth = health;


        setMetric(
            "apiAvailability",
            health ? statusLabel(health.status || "healthy") : "Unavailable"
        );


        if (!health) {

            renderModuleHealth(null);

            return;

        }


        renderModuleHealth(health);

    }


    /* =====================================================
       12. API CONNECTIVITY TABLE
    ===================================================== */

    function renderApiTable(results) {

        const body = $("#apiHealthTable");

        if (!body) return;


        body.replaceChildren();


        results.forEach(result => {

            const row = document.createElement("tr");


            row.append(
                createCell(result.name),
                createCell(result.endpoint),
                createCell("GET")
            );


            const statusCell = document.createElement("td");

            statusCell.append(
                createBadge(result.ok ? "healthy" : "offline")
            );


            row.append(
                statusCell,
                createCell(formatDuration(result.duration))
            );


            body.append(row);

        });

    }


    /* =====================================================
       13. INTEGRATION TEST RESULTS
    ===================================================== */

    function renderTestResults(results) {

        const body = $("#integrationTestTable");

        if (!body) return;


        body.replaceChildren();


        let passed = 0;
        let failed = 0;


        results.forEach(result => {

            if (result.ok) {
                passed++;
            } else {
                failed++;
            }


            const row = document.createElement("tr");


            row.append(
                createCell(result.name),
                createCell(result.endpoint)
            );


            const statusCell = document.createElement("td");

            statusCell.append(
                createBadge(
                    result.ok ? "healthy" : "offline"
                )
            );


            row.append(
                statusCell,
                createCell(formatDuration(result.duration)),
                createCell(result.details)
            );


            body.append(row);

        });


        setText("#testsPassed", passed);

        setText("#testsFailed", failed);

        setText("#testsPending", 0);


        setMetric(
            "apiAvailability",
            passed > 0
                ? `${passed}/${results.length} responding`
                : "Unavailable"
        );


        renderApiTable(results);

        renderModuleHealth(currentHealth, results);

    }


    async function runIntegrationTests() {

        if (isTesting) return;


        isTesting = true;


        const button = $("#runIntegrationTests");

        if (button) {

            button.disabled = true;

            button.textContent = "Running checks...";

        }


        setText("#testsPassed", 0);

        setText("#testsFailed", 0);

        setText("#testsPending", TESTS.length);


        const results = await Promise.all(

            TESTS.map(async test => {

                const start = performance.now();

                try {

                    const data = unwrap(
                        await apiGet(test.endpoint)
                    );


                    if (
                        test.key === "session" &&
                        data?.authenticated !== true
                    ) {
                        throw new Error(
                            "No authenticated administrator session."
                        );
                    }


                    return {

                        ...test,

                        ok: true,

                        duration: performance.now() - start,

                        checkedAt: new Date().toISOString(),

                        details: "Endpoint responded successfully."

                    };

                } catch (error) {

                    return {

                        ...test,

                        ok: false,

                        duration: performance.now() - start,

                        checkedAt: new Date().toISOString(),

                        details: error.message

                    };

                }

            })

        );


        testResults = results;


        renderTestResults(results);


        const failed = results.filter(item => !item.ok);


        if (failed.length === 0) {

            showToast(
                "All integration endpoints responded successfully.",
                "success"
            );

        } else {

            showToast(
                `${failed.length} integration checks require attention.`,
                "warning"
            );

        }


        isTesting = false;


        if (button) {

            button.disabled = false;

            button.textContent = "▶ Run All Checks";

        }

    }


    /* =====================================================
       14. GLOBAL REFRESH
    ===================================================== */

    async function refreshAll() {

        if (isRefreshing) return;


        isRefreshing = true;


        const button = $("#refreshButton");

        if (button) {

            button.disabled = true;

            button.textContent = "Refreshing...";

        }


        try {

            const [
                sessionResult,
                healthResult,
                notificationResult,
                auditResult,
                workflowResult

            ] = await Promise.all([

                safeGet(ENDPOINTS.session),

                safeGet(ENDPOINTS.health),

                safeGet(ENDPOINTS.notifications),

                safeGet(ENDPOINTS.audit),

                safeGet(ENDPOINTS.workflows)

            ]);


            renderSession(sessionResult);


            renderHealthMetrics(healthResult);


            updateConnection(
                sessionResult,
                healthResult
            );


            if (notificationResult.ok) {

                renderNotifications(
                    notificationResult.data
                );

            } else {

                renderNotifications(null);

            }


            if (auditResult.ok) {

                auditRecords = getItems(
                    auditResult.data
                );

                renderAudit();

            } else {

                auditRecords = [];

                renderAudit();

            }


            if (workflowResult.ok) {

                renderWorkflows(
                    workflowResult.data
                );

            } else {

                renderWorkflows(null);

            }


            setText(
                "#lastUpdated",
                `Last checked: ${new Date().toLocaleTimeString()}`
            );


            if (
                !sessionResult.ok ||
                !healthResult.ok
            ) {

                showToast(
                    "Some platform services could not be reached.",
                    "warning"
                );

            }

        } finally {

            isRefreshing = false;


            if (button) {

                button.disabled = false;

                button.textContent = "↻ Refresh";

            }

        }

    }


    /* =====================================================
       15. INDIVIDUAL REFRESH ACTIONS
    ===================================================== */

    async function refreshAudit() {

        const result = await safeGet(ENDPOINTS.audit);


        if (!result.ok) {

            showToast(result.error, "warning");

            return;

        }


        auditRecords = getItems(result.data);

        renderAudit();

        showToast("Audit records refreshed.", "success");

    }


    async function refreshNotifications() {

        const result = await safeGet(
            ENDPOINTS.notifications
        );


        if (!result.ok) {

            showToast(result.error, "warning");

            return;

        }


        renderNotifications(result.data);

        showToast("Notifications refreshed.", "success");

    }


    /* =====================================================
       16. NOTIFICATIONS
    ===================================================== */

    function showToast(message, type = "info") {

        const region = $("#toastRegion");

        if (!region) return;


        const toast = document.createElement("div");

        toast.className = `integration-toast toast-${type}`;

        toast.textContent = message;


        region.append(toast);


        setTimeout(() => {

            toast.remove();

        }, 5000);

    }


    /* =====================================================
       17. EVENT LISTENERS
    ===================================================== */

    $("#refreshButton")?.addEventListener(
        "click",
        async () => {

            await refreshAll();

            await runIntegrationTests();

        }
    );


    $("#runIntegrationTests")?.addEventListener(
        "click",
        runIntegrationTests
    );


    $("#refreshNotifications")?.addEventListener(
        "click",
        refreshNotifications
    );


    $("#refreshAudit")?.addEventListener(
        "click",
        refreshAudit
    );


    $("#auditSearch")?.addEventListener(
        "input",
        renderAudit
    );


    $("#auditModuleFilter")?.addEventListener(
        "change",
        renderAudit
    );


    window.addEventListener("online", () => {

        refreshAll();

    });


    /* =====================================================
       18. STARTUP
    ===================================================== */

    renderModuleCards();

    setMetric("totalModules", MODULES.length);

    setMetric("healthyModules", "—");

    setMetric("degradedModules", "—");

    setMetric("offlineModules", "—");

    setMetric("notifications", "—");

    setMetric("auditEvents", "—");

    setMetric("workflowExceptions", "—");

    setMetric("apiAvailability", "Checking...");


    setText("#testsPending", TESTS.length);


    refreshAll().then(() => {

        runIntegrationTests();

    });


})();
