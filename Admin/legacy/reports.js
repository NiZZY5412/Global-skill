
/* ==========================================================
   TALVORA TECHNOLOGIES
   TALVORA GLOBAL — GSES SYSTEM 001

   REPORTS & INVESTIGATIONS
   FILE: reports.js

   PRODUCTION PRINCIPLES

   - No demo reports or fabricated statistics.
   - No invented investigation records.
   - No fabricated evidence.
   - All case records come from authorized services.
   - All sensitive evidence requires server authorization.
   - Administrative actions require server authorization.
   - Every investigation action must be auditable.
   - Allegations are not automatically established facts.
   ========================================================== */

(() => {

    "use strict";


    /* ========================================================
       01. API CONFIGURATION
       ======================================================== */

    const API = {

        session:
            "/api/v1/auth/session",

        summary:
            "/api/v1/admin/investigations/summary",

        cases:
            "/api/v1/admin/investigations/cases",

        caseDetail: id =>
            "/api/v1/admin/investigations/cases/" +
            encodeURIComponent(id),

        caseAction: id =>
            "/api/v1/admin/investigations/cases/" +
            encodeURIComponent(id) +
            "/actions",

        evidence: (caseId, evidenceId) =>
            "/api/v1/admin/investigations/cases/" +
            encodeURIComponent(caseId) +
            "/evidence/" +
            encodeURIComponent(evidenceId) +
            "/content",

        activity:
            "/api/v1/admin/investigations/activity",

        export:
            "/api/v1/admin/investigations/export"

    };


    /* ========================================================
       02. CONFIGURATION
       ======================================================== */

    const $ = id => document.getElementById(id);


    const LOCAL_HOSTS = [

        "localhost",

        "127.0.0.1",

        "::1"

    ];


    const IS_LOCAL =

        location.protocol === "file:" ||

        LOCAL_HOSTS.includes(location.hostname);


    const PAGE_SIZE = 20;


    /* ========================================================
       03. STATUS DEFINITIONS
       ======================================================== */

    const CASE_STATUSES = {

        new: "New",

        open: "Open",

        investigating: "Investigating",

        escalated: "Escalated",

        awaiting_information: "Awaiting Information",

        resolved: "Resolved",

        closed: "Closed",

        reopened: "Reopened",

        dismissed: "Dismissed"

    };


    const SEVERITIES = {

        critical: "Critical",

        high: "High",

        medium: "Medium",

        low: "Low"

    };


    const CATEGORIES = {

        fraud: "Fraud",

        suspicious_activity: "Suspicious Activity",

        policy_violation: "Policy Violation",

        security_incident: "Security Incident",

        harassment: "Harassment",

        misconduct: "Misconduct",

        identity_concern: "Identity Concern",

        data_privacy: "Data Privacy",

        other: "Other"

    };


    const SOURCES = {

        employee: "Employee Portal",

        employer: "Employer Portal",

        super_admin: "Super Admin",

        system: "Platform System"

    };


    const ACTIONS = {

        assign: "Assign Investigator",

        start_investigation: "Start Investigation",

        request_information: "Request Information",

        escalate: "Escalate Case",

        resolve: "Resolve Case",

        close: "Close Case",

        reopen: "Reopen Case",

        dismiss: "Dismiss Report",

        flag: "Flag for Further Review",

        clear_flag: "Clear Review Flag"

    };


    const ACTION_DESCRIPTIONS = {

        assign:
            "Assign this investigation to an authorized administrator.",

        start_investigation:
            "Move this case into formal investigation.",

        request_information:
            "Record a request for additional information.",

        escalate:
            "Escalate this case to the appropriate higher administrative level.",

        resolve:
            "Record an investigation resolution with supporting justification.",

        close:
            "Close this case following the applicable review procedure.",

        reopen:
            "Reopen this previously resolved or closed investigation.",

        dismiss:
            "Dismiss this report following an appropriate review.",

        flag:
            "Flag this case for additional administrative attention.",

        clear_flag:
            "Clear the review flag following an authorized assessment."

    };


    /* ========================================================
       04. DOM REFERENCES
       ======================================================== */

    const el = {

        app: $("reports-app"),

        locked: $("reports-locked"),

        accessMessage: $("reports-access-message"),

        notice: $("reports-notice"),

        systemStatus: $("reports-system-status"),


        refresh: $("reports-refresh"),

        exportButton: $("reports-export"),


        filterForm: $("reports-filter-form"),

        search: $("reports-search"),

        categoryFilter: $("reports-category-filter"),

        severityFilter: $("reports-severity-filter"),

        portalFilter: $("reports-portal-filter"),

        dateSort: $("reports-date-sort"),

        clearFilters: $("reports-clear-filters"),


        table: $("reports-table-body"),

        recordCount: $("reports-record-count"),

        pageInfo: $("reports-page-info"),

        previous: $("reports-prev"),

        next: $("reports-next"),


        priorityTable: $("reports-priority-body"),

        priorityCount: $("reports-priority-count"),


        assignmentTable: $("reports-assignment-body"),

        assignmentCount: $("reports-assignment-count"),


        activityTable: $("reports-activity-body"),

        activityCount: $("reports-activity-count"),


        categoryList: $("reports-category-list"),


        detailOverlay: $("reports-detail-overlay"),

        detailTitle: $("reports-detail-title"),

        detailClose: $("reports-detail-close"),

        detailContent: $("reports-detail-content"),

        detailActions: $("reports-detail-actions"),


        evidenceOverlay: $("reports-evidence-overlay"),

        evidenceClose: $("reports-evidence-close"),

        evidenceTitle: $("reports-evidence-title"),

        evidenceContent: $("reports-evidence-content"),


        confirmOverlay: $("reports-confirm-overlay"),

        confirmTitle: $("reports-confirm-title"),

        confirmDescription: $("reports-confirm-description"),

        confirmReason: $("reports-action-reason"),

        confirmCancel: $("reports-confirm-cancel"),

        confirmSubmit: $("reports-confirm-submit")

    };


    /* ========================================================
       05. METRIC REFERENCES
       ======================================================== */

    const METRICS = {

        total: "metric-reports-total",

        open: "metric-reports-open",

        investigating: "metric-reports-investigating",

        high: "metric-reports-high",

        escalated: "metric-reports-escalated",

        unassigned: "metric-reports-unassigned",

        resolved: "metric-reports-resolved",

        overdue: "metric-reports-overdue"

    };


    /* ========================================================
       06. APPLICATION STATE
       ======================================================== */

    const state = {

        authorized: false,

        csrfToken: null,


        cases: {

            status: "all",

            page: 1,

            totalPages: 0,

            search: "",

            category: "",

            severity: "",

            source: "",

            sort: "newest"

        },


        selectedCase: null,

        selectedEvidence: null,

        pendingAction: null,

        actionInProgress: false,

        activeDialog: null,

        previousFocus: null,


        requests: {

            summary: 0,

            cases: 0,

            detail: 0,

            activity: 0,

            export: 0

        }

    };


    /* ========================================================
       07. SAFE DOM UTILITIES
       ======================================================== */

    function createElement(

        tag,

        className = "",

        value = null

    ) {

        const node = document.createElement(tag);


        if (className) {

            node.className = className;

        }


        if (value !== null && value !== undefined) {

            node.textContent = String(value);

        }


        return node;

    }


    function setText(id, value) {

        const node = $(id);


        if (node) {

            node.textContent = String(value);

        }

    }


    function safeValue(value) {

        if (

            value === null ||

            value === undefined ||

            value === ""

        ) {

            return "—";

        }


        return String(value);

    }


    function validCount(value) {

        if (

            !Number.isSafeInteger(value) ||

            value < 0

        ) {

            return "—";

        }


        return new Intl.NumberFormat("en").format(value);

    }


    function formatDate(value) {

        if (!value) return "—";


        const date = new Date(value);


        if (Number.isNaN(date.getTime())) {

            return "—";

        }


        return new Intl.DateTimeFormat("en", {

            day: "2-digit",

            month: "short",

            year: "numeric"

        }).format(date);

    }


    function formatDateTime(value) {

        if (!value) return "—";


        const date = new Date(value);


        if (Number.isNaN(date.getTime())) {

            return "—";

        }


        return new Intl.DateTimeFormat("en", {

            day: "2-digit",

            month: "short",

            year: "numeric",

            hour: "2-digit",

            minute: "2-digit"

        }).format(date);

    }


    function showNotice(message, type = "") {

        el.notice.className =

            "reports-notice " + type;


        el.notice.textContent = message;

    }


    function setConnection(message, connected = false) {

        el.systemStatus.textContent = message;


        const container = document.querySelector(

            ".connection-status"

        );


        container?.classList.toggle(

            "connected",

            connected

        );


        container?.classList.toggle(

            "disconnected",

            !connected

        );

    }


    function clearMetrics() {

        Object.values(METRICS).forEach(id => {

            setText(id, "—");

        });

    }


    /* ========================================================
       08. EMPTY STATES
       ======================================================== */

    function showEmptyTable(

        table,

        colspan,

        title,

        description

    ) {

        const row = createElement("tr");

        const cell = createElement("td");

        const empty = createElement(

            "div",

            "reports-empty"

        );


        cell.colSpan = colspan;


        if (title) {

            empty.append(

                createElement("h4", "", title)

            );

        }


        empty.append(

            createElement("p", "", description)

        );


        cell.append(empty);

        row.append(cell);

        table.replaceChildren(row);

    }


    function emptyCases(title, description) {

        showEmptyTable(

            el.table,

            10,

            title,

            description

        );


        el.recordCount.textContent =

            "Records unavailable";


        el.pageInfo.textContent =

            "No records available";


        el.previous.disabled = true;

        el.next.disabled = true;

    }


    function emptyPriority() {

        showEmptyTable(

            el.priorityTable,

            5,

            "",

            "No priority case records are available."

        );


        el.priorityCount.textContent =

            "Records unavailable";

    }


    function emptyAssignments() {

        showEmptyTable(

            el.assignmentTable,

            6,

            "",

            "Investigator assignment records are unavailable."

        );


        el.assignmentCount.textContent =

            "Records unavailable";

    }


    function emptyActivity() {

        showEmptyTable(

            el.activityTable,

            6,

            "",

            "Investigation activity records are unavailable."

        );


        el.activityCount.textContent =

            "Records unavailable";

    }


    /* ========================================================
       09. SCREEN MANAGEMENT
       ======================================================== */

    function invalidateRequests() {

        Object.keys(state.requests).forEach(key => {

            state.requests[key]++;

        });

    }


    function showApplication() {

        el.locked.hidden = true;

        el.app.hidden = false;

    }


    function showLocked(message) {

        state.authorized = false;

        state.csrfToken = null;


        invalidateRequests();


        closeAllPanels();


        el.confirmOverlay.hidden = true;


        el.app.hidden = true;

        el.locked.hidden = false;


        el.accessMessage.textContent = message;

    }


    function enterLocalPreview() {

        state.authorized = false;


        showApplication();


        setConnection("Frontend Preview");


        showNotice(

            "Frontend preview only. No reports, incidents, " +

            "investigations, evidence, assignments or statistics " +

            "are connected. No administrative actions are enabled.",

            "warning"

        );


        clearMetrics();


        emptyCases(

            "No investigation records connected",

            "Real reports will appear after the authorized investigations service is implemented."

        );


        emptyPriority();

        emptyAssignments();

        emptyActivity();


        el.categoryList.replaceChildren(

            createElement(

                "div",

                "reports-empty-inline",

                "Category data unavailable."

            )

        );

    }


    /* ========================================================
       10. API REQUEST HANDLER
       ======================================================== */

    async function requestJSON(url, options = {}) {

        const headers = {

            Accept: "application/json",

            ...options.headers

        };


        if (options.body) {

            headers["Content-Type"] = "application/json";

        }


        if (

            options.method &&

            options.method !== "GET"

        ) {

            if (!state.csrfToken) {

                throw new Error(

                    "A valid security token is required."

                );

            }


            headers["X-CSRF-Token"] = state.csrfToken;

        }


        let response;


        try {

            response = await fetch(url, {

                credentials: "same-origin",

                cache: "no-store",

                redirect: "error",

                ...options,

                headers

            });

        } catch {

            throw new Error(

                "The investigations service is currently unavailable."

            );

        }


        if (

            response.status === 401 ||

            response.status === 403

        ) {

            const error = new Error(

                "Super Admin authorization failed."

            );


            error.status = response.status;


            throw error;

        }


        if (!response.ok) {

            let message =

                "The requested operation could not be completed.";


            try {

                const result = await response.json();


                if (typeof result.message === "string") {

                    message = result.message;

                }

            } catch {

                // Keep the default message.

            }


            const error = new Error(message);


            error.status = response.status;


            throw error;

        }


        if (response.status === 204) {

            return null;

        }


        if (

            !(response.headers.get("content-type") || "")

                .includes("application/json")

        ) {

            throw new Error(

                "The server returned an invalid response."

            );

        }


        return response.json();

    }


    async function requestExport(url) {

        let response;


        try {

            response = await fetch(url, {

                method: "GET",

                credentials: "same-origin",

                cache: "no-store",

                redirect: "error",

                headers: {

                    Accept: "text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream"

                }

            });

        } catch {

            throw new Error(

                "The investigations export service is unavailable."

            );

        }


        if (

            response.status === 401 ||

            response.status === 403

        ) {

            const error = new Error(

                "Report export authorization failed."

            );


            error.status = response.status;


            throw error;

        }


        if (!response.ok) {

            throw new Error(

                "The investigation report could not be exported."

            );

        }


        const contentType =

            response.headers.get("content-type") || "";


        if (

            contentType.includes("text/html") ||

            contentType.includes("application/json")

        ) {

            throw new Error(

                "The server did not return an export file."

            );

        }


        return {

            blob: await response.blob(),

            filename: response.headers.get(

                "Content-Disposition"

            )

        };

    }


    function handleAuthorizationError(error) {

        if (

            error.status === 401 ||

            error.status === 403

        ) {

            showLocked(

                "Your Super Admin session is no longer authorized. Please sign in again."

            );


            return true;

        }


        return false;

    }


    /* ========================================================
       11. ENABLE CONTROLS
       ======================================================== */

    function enableControls() {

        [

            el.refresh,

            el.exportButton,

            el.search,

            el.categoryFilter,

            el.severityFilter,

            el.portalFilter,

            el.dateSort,

            el.clearFilters,

            $("reports-apply-filters")

        ].forEach(control => {

            if (control) {

                control.disabled = false;

            }

        });

    }


    /* ========================================================
       12. METRIC VALIDATION
       ======================================================== */

    function updateMetrics(metrics) {

        const mapping = {

            total: metrics.total,

            open: metrics.open,

            investigating: metrics.investigating,

            high: metrics.highPriority,

            escalated: metrics.escalated,

            unassigned: metrics.unassigned,

            resolved: metrics.resolved,

            overdue: metrics.overdue

        };


        Object.entries(mapping).forEach(([key, value]) => {

            setText(

                METRICS[key],

                validCount(value)

            );

        });

    }


    /* ========================================================
       13. CATEGORY DISTRIBUTION
       ======================================================== */

    function renderCategoryDistribution(categories) {

        el.categoryList.replaceChildren();


        if (

            !Array.isArray(categories) ||

            categories.length === 0

        ) {

            el.categoryList.append(

                createElement(

                    "div",

                    "reports-empty-inline",

                    "No category statistics available."

                )

            );


            return;

        }


        categories.forEach(category => {

            if (

                !category ||

                typeof category.count !== "number" ||

                !Number.isSafeInteger(category.count) ||

                category.count < 0

            ) {

                return;

            }


            const item = createElement(

                "div",

                "reports-category-item"

            );


            const heading = createElement(

                "div",

                "reports-category-heading"

            );


            heading.append(

                createElement(

                    "span",

                    "",

                    CATEGORIES[category.category] ||

                    safeValue(category.label)

                ),

                createElement(

                    "strong",

                    "",

                    validCount(category.count)

                )

            );


            const track = createElement(

                "div",

                "reports-category-track"

            );


            const fill = createElement(

                "div",

                "reports-category-fill"

            );


            const percentage =

                typeof category.percentage === "number" &&

                    Number.isFinite(category.percentage)

                    ? Math.max(0, Math.min(100, category.percentage))

                    : 0;


            fill.style.width = percentage + "%";


            track.append(fill);


            item.append(heading, track);


            el.categoryList.append(item);

        });

    }


    /* ========================================================
       14. WORKLOAD MONITORING
       ======================================================== */

    function renderWorkload(workload = {}) {

        setText(

            "workload-assigned",

            validCount(workload.assigned)

        );


        setText(

            "workload-unassigned",

            validCount(workload.unassigned)

        );


        setText(

            "workload-investigators",

            validCount(workload.activeInvestigators)

        );


        setText(

            "workload-attention",

            validCount(workload.requiringAttention)

        );


        setText(

            "workload-updated",

            formatDateTime(workload.updatedAt)

        );


        const investigators = workload.investigators;


        el.assignmentTable.replaceChildren();


        if (

            !Array.isArray(investigators) ||

            investigators.length === 0

        ) {

            emptyAssignments();

            return;

        }


        const fragment =

            document.createDocumentFragment();


        investigators.forEach(person => {

            if (

                !person ||

                typeof person.id !== "string" ||

                !person.id

            ) {

                return;

            }


            const row = createElement("tr");


            row.append(

                createElement(

                    "td",

                    "reports-title-text",

                    safeValue(person.displayName)

                ),

                createElement(

                    "td",

                    "",

                    safeValue(person.reference)

                ),

                createElement(

                    "td",

                    "",

                    validCount(person.assignedCases)

                ),

                createElement(

                    "td",

                    "",

                    validCount(person.activeCases)

                ),

                createElement(

                    "td",

                    "",

                    validCount(person.overdueCases)

                ),

                createElement(

                    "td",

                    "",

                    formatDateTime(person.lastActivityAt)

                )

            );


            fragment.append(row);

        });


        if (fragment.childNodes.length === 0) {

            emptyAssignments();

            return;

        }


        el.assignmentTable.replaceChildren(fragment);


        el.assignmentCount.textContent =

            validCount(investigators.length) +

            " investigators";

    }


    /* ========================================================
       15. SECURITY MONITORING
       ======================================================== */

    function renderSecurity(security = {}) {

        setText(

            "security-incident-count",

            validCount(security.incidents)

        );


        setText(

            "security-suspicious-count",

            validCount(security.suspiciousActivity)

        );


        setText(

            "security-identity-count",

            validCount(security.identityConcerns)

        );


        setText(

            "security-privacy-count",

            validCount(security.privacyIncidents)

        );

    }


    /* ========================================================
       16. LOAD DASHBOARD SUMMARY
       ======================================================== */

    async function loadSummary() {

        const requestId = ++state.requests.summary;


        clearMetrics();


        try {

            const result = await requestJSON(

                API.summary

            );


            if (

                requestId !== state.requests.summary ||

                !state.authorized

            ) {

                return;

            }


            if (!result || !result.metrics) {

                throw new Error(

                    "Invalid investigation summary response."

                );

            }


            updateMetrics(result.metrics);


            renderCategoryDistribution(

                result.categoryBreakdown

            );


            renderWorkload(

                result.workload

            );


            renderSecurity(

                result.security

            );


        } catch (error) {

            if (requestId !== state.requests.summary) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            clearMetrics();


            showNotice(

                "Investigation statistics could not be retrieved.",

                "error"

            );

        }

    }


    /* ========================================================
       17. CASE QUERY CONSTRUCTION
       ======================================================== */

    function buildCaseQuery() {

        const params = new URLSearchParams({

            page: String(state.cases.page),

            limit: String(PAGE_SIZE),

            status: state.cases.status,

            sort: state.cases.sort

        });


        if (state.cases.search) {

            params.set(

                "search",

                state.cases.search

            );

        }


        if (state.cases.category) {

            params.set(

                "category",

                state.cases.category

            );

        }


        if (state.cases.severity) {

            params.set(

                "severity",

                state.cases.severity

            );

        }


        if (state.cases.source) {

            params.set(

                "source",

                state.cases.source

            );

        }


        return params;

    }


    function applyFilters() {

        state.cases.search =

            el.search.value.trim();


        state.cases.category =

            el.categoryFilter.value;


        state.cases.severity =

            el.severityFilter.value;


        state.cases.source =

            el.portalFilter.value;


        state.cases.sort =

            el.dateSort.value;


        state.cases.page = 1;

    }


    /* ========================================================
       18. STATUS AND SEVERITY BADGES
       ======================================================== */

    function createStatusBadge(status) {

        return createElement(

            "span",

            "report-status " + status,

            CASE_STATUSES[status] || "Unknown"

        );

    }


    function createSeverityBadge(severity) {

        const valid = Object.hasOwn(

            SEVERITIES,

            severity

        );


        return createElement(

            "span",

            "report-severity " +

            (valid ? severity : "unknown"),

            valid ? SEVERITIES[severity] : "Unavailable"

        );

    }


    /* ========================================================
       19. PAGINATION
       ======================================================== */

    function updatePagination(result) {

        const pagination = result.pagination;


        if (

            !pagination ||

            !Number.isSafeInteger(pagination.total) ||

            pagination.total < 0 ||

            !Number.isSafeInteger(pagination.totalPages) ||

            pagination.totalPages < 0

        ) {

            throw new Error(

                "Invalid case pagination information."

            );

        }


        state.cases.totalPages =

            pagination.totalPages;


        el.recordCount.textContent =

            validCount(pagination.total) +

            " investigation records";


        el.pageInfo.textContent =

            pagination.totalPages > 0

                ? `Page ${state.cases.page} of ${pagination.totalPages}`

                : "No pages";


        el.previous.disabled =

            state.cases.page <= 1;


        el.next.disabled =

            pagination.totalPages === 0 ||

            state.cases.page >= pagination.totalPages;

    }


    /* ========================================================
       20. CASE TABLE RENDERING
       ======================================================== */

    function renderCases(result) {

        if (

            !result ||

            !Array.isArray(result.items) ||

            !result.pagination

        ) {

            throw new Error(

                "Invalid investigation directory response."

            );

        }


        const fragment =

            document.createDocumentFragment();


        result.items.forEach(report => {

            if (

                !report ||

                typeof report.id !== "string" ||

                !report.id ||

                !Object.hasOwn(

                    CASE_STATUSES,

                    report.status

                )

            ) {

                return;

            }


            const row = createElement("tr");


            /* REFERENCE */

            row.append(

                createElement(

                    "td",

                    "reports-reference",

                    safeValue(report.reference)

                )

            );


            /* TITLE */

            const titleCell = createElement("td");


            titleCell.append(

                createElement(

                    "span",

                    "reports-title-text",

                    safeValue(report.title)

                ),

                createElement(

                    "span",

                    "reports-secondary-text",

                    safeValue(report.descriptionSummary)

                )

            );


            row.append(titleCell);


            /* CATEGORY */

            row.append(

                createElement(

                    "td",

                    "",

                    CATEGORIES[report.category] ||

                    safeValue(report.categoryLabel)

                )

            );


            /* REPORTER */

            const reporter = report.reporter || {};


            const reporterCell = createElement("td");


            reporterCell.append(

                createElement(

                    "span",

                    "reports-reporter",

                    safeValue(reporter.displayName)

                ),

                createElement(

                    "span",

                    "reports-secondary-text",

                    SOURCES[report.source] ||

                    safeValue(reporter.portal)

                )

            );


            row.append(reporterCell);


            /* INVOLVED PARTY */

            const involved = report.involvedParty || {};


            const involvedCell = createElement("td");


            involvedCell.append(

                createElement(

                    "span",

                    "reports-involved-party",

                    safeValue(involved.displayName)

                ),

                createElement(

                    "span",

                    "reports-secondary-text",

                    safeValue(involved.reference)

                )

            );


            row.append(involvedCell);


            /* SEVERITY */

            const severityCell = createElement("td");


            severityCell.append(

                createSeverityBadge(report.severity)

            );


            row.append(severityCell);


            /* STATUS */

            const statusCell = createElement("td");


            statusCell.append(

                createStatusBadge(report.status)

            );


            row.append(statusCell);


            /* ASSIGNEE */

            row.append(

                createElement(

                    "td",

                    "",

                    report.assignee?.displayName ||

                    "Unassigned"

                )

            );


            /* DATE */

            row.append(

                createElement(

                    "td",

                    "",

                    formatDate(report.createdAt)

                )

            );


            /* ACTION */

            const actionCell = createElement("td");


            const button = createElement(

                "button",

                "reports-view-button",

                "View Case"

            );


            button.type = "button";


            button.addEventListener(

                "click",

                () => openCaseDetails(report.id)

            );


            actionCell.append(button);


            row.append(actionCell);


            fragment.append(row);

        });


        if (fragment.childNodes.length === 0) {

            emptyCases(

                "No investigation records found",

                "No records match the current search and filters."

            );

        } else {

            el.table.replaceChildren(fragment);

        }


        updatePagination(result);

    }


    /* ========================================================
       21. LOAD INVESTIGATION REGISTER
       ======================================================== */

    async function loadCases() {

        if (!state.authorized) return;


        const requestId = ++state.requests.cases;


        emptyCases(

            "Loading investigation records",

            "Retrieving authorized platform reports..."

        );


        try {

            const query = buildCaseQuery();


            const result = await requestJSON(

                API.cases +

                "?" +

                query.toString()

            );


            if (

                requestId !== state.requests.cases ||

                !state.authorized

            ) {

                return;

            }


            renderCases(result);


        } catch (error) {

            if (requestId !== state.requests.cases) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            emptyCases(

                "Investigation records unavailable",

                "The investigations service could not provide the requested records."

            );


            showNotice(

                "The central investigation register could not be loaded.",

                "error"

            );

        }

    }


    /* ========================================================
       22. PRIORITY CASES
       ======================================================== */

    function renderPriorityCases(cases) {

        el.priorityTable.replaceChildren();


        if (!Array.isArray(cases) || cases.length === 0) {

            emptyPriority();

            return;

        }


        const fragment =

            document.createDocumentFragment();


        cases.forEach(report => {

            if (

                !report ||

                typeof report.id !== "string" ||

                !report.id ||

                !Object.hasOwn(

                    CASE_STATUSES,

                    report.status

                ) ||

                !["critical", "high"].includes(report.severity)

            ) {

                return;

            }


            const row = createElement("tr");


            const referenceCell = createElement("td");


            referenceCell.append(

                createElement(

                    "span",

                    "reports-reference",

                    safeValue(report.reference)

                ),

                createElement(

                    "span",

                    "reports-secondary-text",

                    safeValue(report.title)

                )

            );


            row.append(referenceCell);


            const severityCell = createElement("td");


            severityCell.append(

                createSeverityBadge(report.severity)

            );


            row.append(severityCell);


            const statusCell = createElement("td");


            statusCell.append(

                createStatusBadge(report.status)

            );


            row.append(statusCell);


            row.append(

                createElement(

                    "td",

                    "",

                    formatDate(report.createdAt)

                )

            );


            const actionCell = createElement("td");


            const button = createElement(

                "button",

                "reports-view-button",

                "Review"

            );


            button.type = "button";


            button.addEventListener(

                "click",

                () => openCaseDetails(report.id)

            );


            actionCell.append(button);


            row.append(actionCell);


            fragment.append(row);

        });


        if (fragment.childNodes.length === 0) {

            emptyPriority();

            return;

        }


        el.priorityTable.replaceChildren(fragment);


        el.priorityCount.textContent =

            validCount(fragment.childNodes.length) +

            " priority cases";

    }


    /* ========================================================
       23. DETAIL FIELD HELPERS
       ======================================================== */

    function detailField(label, value) {

        const wrapper = createElement(

            "div",

            "reports-detail-field"

        );


        wrapper.append(

            createElement(

                "label",

                "",

                label

            ),

            createElement(

                "p",

                "",

                safeValue(value)

            )

        );


        return wrapper;

    }


    function detailSection(title, fields) {

        const section = createElement(

            "section",

            "reports-detail-section"

        );


        section.append(

            createElement(

                "h3",

                "",

                title

            )

        );


        fields.forEach(field => {

            if (field) {

                section.append(field);

            }

        });


        return section;

    }


    /* ========================================================
       24. CASE HISTORY
       ======================================================== */

    function renderTimeline(history) {

        const section = detailSection(

            "Investigation Timeline",

            []

        );


        if (!Array.isArray(history) || history.length === 0) {

            section.append(

                createElement(

                    "p",

                    "",

                    "No investigation history is available."

                )

            );


            return section;

        }


        const timeline = createElement(

            "div",

            "reports-timeline"

        );


        history.forEach(event => {

            if (!event) return;


            const item = createElement(

                "div",

                "reports-timeline-item"

            );


            item.append(

                createElement(

                    "strong",

                    "",

                    safeValue(event.event)

                ),

                createElement(

                    "p",

                    "",

                    safeValue(event.description)

                ),

                createElement(

                    "time",

                    "",

                    formatDateTime(event.timestamp)

                )

            );


            timeline.append(item);

        });


        section.append(timeline);


        return section;

    }


    /* ========================================================
       25. EVIDENCE REGISTER
       ======================================================== */

    function renderEvidence(evidence) {

        const section = detailSection(

            "Evidence Register",

            []

        );


        if (!Array.isArray(evidence) || evidence.length === 0) {

            section.append(

                createElement(

                    "p",

                    "",

                    "No evidence records are attached to this case."

                )

            );


            return section;

        }


        const button = createElement(

            "button",

            "reports-view-button",

            "Open Evidence Register (" +

            evidence.length +

            ")"

        );


        button.type = "button";


        button.addEventListener(

            "click",

            () => openEvidenceRegister(evidence)

        );


        section.append(button);


        return section;

    }


    /* ========================================================
       26. OPEN EVIDENCE REGISTER
       ======================================================== */

    function openEvidenceRegister(evidence) {

        if (!state.authorized) return;


        state.selectedEvidence = evidence;


        state.previousFocus = document.activeElement;


        el.evidenceContent.replaceChildren();


        evidence.forEach(item => {

            if (

                !item ||

                typeof item.id !== "string" ||

                !item.id

            ) {

                return;

            }


            const wrapper = createElement(

                "div",

                "reports-evidence-item"

            );


            const icon = createElement(

                "div",

                "reports-evidence-icon",

                "\u25A3"

            );


            const information = createElement(

                "div",

                "reports-evidence-info"

            );


            information.append(

                createElement(

                    "strong",

                    "",

                    safeValue(item.displayName)

                ),

                createElement(

                    "p",

                    "",

                    "Reference: " + safeValue(item.reference)

                ),

                createElement(

                    "p",

                    "",

                    "Type: " + safeValue(item.mimeType)

                ),

                createElement(

                    "p",

                    "",

                    "Uploaded: " + formatDateTime(item.uploadedAt)

                ),

                createElement(

                    "p",

                    "",

                    "Integrity status: " + safeValue(item.integrityStatus)

                ),

                createElement(

                    "p",

                    "",

                    "Access status: " +

                    safeValue(item.accessStatus)

                )

            );


            const access = createElement(

                "div",

                "reports-evidence-access"

            );


            if (

                item.accessAuthorized === true &&

                item.integrityStatus !== "compromised"

            ) {

                const button = createElement(

                    "button",

                    "",

                    "Open Evidence"

                );


                button.type = "button";


                button.addEventListener(

                    "click",

                    () => openEvidenceContent(item.id)

                );


                access.append(button);

            } else {

                access.append(

                    createElement(

                        "span",

                        "reports-secondary-text",

                        "Access restricted"

                    )

                );

            }


            wrapper.append(

                icon,

                information,

                access

            );


            el.evidenceContent.append(wrapper);

        });


        el.evidenceTitle.textContent =

            "Evidence Register";


        el.evidenceOverlay.hidden = false;


        updateBodyScroll();


        el.evidenceClose.focus();

    }


    /* ========================================================
       27. SECURE EVIDENCE ACCESS
       ======================================================== */

    async function openEvidenceContent(evidenceId) {

        if (

            !state.authorized ||

            !state.selectedCase ||

            !state.csrfToken

        ) {

            return;

        }


        const caseId = state.selectedCase.id;


        const evidence =

            state.selectedEvidence?.find(

                item => item.id === evidenceId

            );


        if (

            !evidence ||

            evidence.accessAuthorized !== true ||

            evidence.integrityStatus === "compromised"

        ) {

            showNotice(

                "Evidence access is not authorized.",

                "warning"

            );


            return;

        }


        let response;


        try {

            response = await fetch(

                API.evidence(caseId, evidenceId),

                {

                    method: "GET",

                    credentials: "same-origin",

                    cache: "no-store",

                    redirect: "error",

                    headers: {

                        Accept: "application/octet-stream"

                    }

                }

            );


            if (

                response.status === 401 ||

                response.status === 403

            ) {

                const error = new Error(

                    "Evidence access authorization failed."

                );


                error.status = response.status;


                throw error;

            }


            if (!response.ok) {

                throw new Error(

                    "Evidence could not be retrieved."

                );

            }


            const contentType =

                response.headers.get("content-type") || "";


            if (

                contentType.includes("text/html") ||

                contentType.includes("application/json")

            ) {

                throw new Error(

                    "The evidence service returned an invalid file."

                );

            }


            const blob = await response.blob();


            if (!state.authorized) return;


            const objectURL = URL.createObjectURL(blob);


            const link = document.createElement("a");


            link.href = objectURL;


            const filename =

                evidence.displayName || "investigation-evidence";


            link.download = filename.replace(

                /[\\/:*?"<>|]/g,

                "_"

            );


            link.rel = "noopener noreferrer";


            document.body.append(link);

            link.click();

            link.remove();


            setTimeout(() => {

                URL.revokeObjectURL(objectURL);

            }, 30000);


            showNotice(

                "Authorized evidence retrieval completed.",

                "success"

            );


        } catch (error) {

            if (handleAuthorizationError(error)) {

                return;

            }


            showNotice(

                error.message ||

                "Evidence could not be retrieved.",

                "error"

            );

        }

    }


    /* ========================================================
       28. CASE DETAIL RENDERING
       ======================================================== */

    function renderCaseDetails(report) {

        const reporter = report.reporter || {};

        const involved = report.involvedParty || {};

        const assignment = report.assignment || {};

        const investigation = report.investigation || {};

        const privacy = report.privacy || {};


        el.detailTitle.textContent =

            safeValue(report.reference);


        el.detailContent.replaceChildren();


        /* CASE OVERVIEW */

        const overview = detailSection(

            "Case Overview",

            [

                detailField(

                    "Case Reference",

                    report.reference

                ),

                detailField(

                    "Report Title",

                    report.title

                ),

                detailField(

                    "Category",

                    CATEGORIES[report.category] ||

                    report.categoryLabel

                ),

                detailField(

                    "Severity",

                    SEVERITIES[report.severity]

                ),

                detailField(

                    "Status",

                    CASE_STATUSES[report.status]

                ),

                detailField(

                    "Date Reported",

                    formatDateTime(report.createdAt)

                ),

                detailField(

                    "Last Updated",

                    formatDateTime(report.updatedAt)

                ),

                detailField(

                    "Due Date",

                    formatDateTime(report.dueAt)

                ),

                detailField(

                    "Escalation Status",

                    report.escalated === true ? "Escalated" : "Not escalated"

                )

            ]

        );


        /* REPORT DETAILS */

        const reportSection = detailSection(

            "Report Information",

            [

                detailField(

                    "Report Description",

                    report.description

                ),

                detailField(

                    "Source Portal",

                    SOURCES[report.source]

                ),

                detailField(

                    "Report Type",

                    report.reportType

                ),

                detailField(

                    "Report Reference",

                    report.originalReference

                ),

                detailField(

                    "Reported By",

                    reporter.displayName

                ),

                detailField(

                    "Reporter Reference",

                    reporter.reference

                ),

                detailField(

                    "Reporter Portal",

                    reporter.portal

                )

            ]

        );


        /* INVOLVED PARTY */

        const involvedSection = detailSection(

            "Involved Party",

            [

                detailField(

                    "Name",

                    involved.displayName

                ),

                detailField(

                    "Reference",

                    involved.reference

                ),

                detailField(

                    "Portal",

                    involved.portal

                ),

                detailField(

                    "Relationship to Report",

                    involved.relationship

                )

            ]

        );


        /* ASSIGNMENT */

        const assignmentSection = detailSection(

            "Investigation Assignment",

            [

                detailField(

                    "Assigned Investigator",

                    assignment.displayName

                ),

                detailField(

                    "Administrator Reference",

                    assignment.reference

                ),

                detailField(

                    "Assigned Date",

                    formatDateTime(assignment.assignedAt)

                ),

                detailField(

                    "Investigation Started",

                    formatDateTime(investigation.startedAt)

                ),

                detailField(

                    "Investigation Due Date",

                    formatDateTime(investigation.dueAt)

                )

            ]

        );


        /* INVESTIGATION FINDINGS */

        const findings = detailSection(

            "Investigation Findings",

            [

                detailField(

                    "Investigation Summary",

                    investigation.summary

                ),

                detailField(

                    "Findings",

                    investigation.findings

                ),

                detailField(

                    "Actions Taken",

                    investigation.actionsTaken

                ),

                detailField(

                    "Outcome",

                    investigation.outcome

                ),

                detailField(

                    "Resolution Reason",

                    investigation.resolutionReason

                ),

                detailField(

                    "Resolved By",

                    investigation.resolvedBy

                ),

                detailField(

                    "Resolved Date",

                    formatDateTime(investigation.resolvedAt)

                )

            ]

        );


        /* PRIVACY */

        const privacySection = detailSection(

            "Privacy & Evidence Access",

            [

                detailField(

                    "Confidentiality Classification",

                    privacy.classification

                ),

                detailField(

                    "Consent Status",

                    privacy.consentStatus

                ),

                detailField(

                    "Access Authorization",

                    privacy.accessAuthorization

                ),

                detailField(

                    "Data Retention Status",

                    privacy.retentionStatus

                )

            ]

        );


        /* EVIDENCE */

        const evidenceSection = renderEvidence(

            report.evidence

        );


        /* HISTORY */

        const historySection = renderTimeline(

            report.history

        );


        [

            overview,

            reportSection,

            involvedSection,

            assignmentSection,

            findings,

            evidenceSection,

            privacySection,

            historySection

        ].forEach(section => {

            el.detailContent.append(section);

        });


        renderCaseActions(report);

    }


    /* ========================================================
       29. AUTHORIZED CASE ACTIONS
       ======================================================== */

    function renderCaseActions(report) {

        const available = Array.isArray(

            report.availableActions

        )

            ? report.availableActions

            : [];


        const allowed = [

            ...new Set(

                available.filter(action =>

                    typeof action === "string" &&

                    Object.hasOwn(ACTIONS, action)

                )

            )

        ];


        const fragment =

            document.createDocumentFragment();


        fragment.append(

            createElement(

                "p",

                "reports-action-note",

                "Only interventions authorized by the server " +

                "are available. Every action requires a documented " +

                "justification and an auditable record."

            )

        );


        allowed.forEach(action => {

            const button = createElement(

                "button",

                [

                    "resolve",

                    "close",

                    "dismiss",

                    "escalate"

                ].includes(action)

                    ? "btn btn-danger"

                    : "btn btn-secondary",

                ACTIONS[action]

            );


            button.type = "button";


            button.addEventListener(

                "click",

                () => requestAction(action)

            );


            fragment.append(button);

        });


        if (allowed.length === 0) {

            fragment.append(

                createElement(

                    "p",

                    "",

                    "No administrative actions are currently available."

                )

            );

        }


        el.detailActions.replaceChildren(fragment);

    }


    /* ========================================================
       30. OPEN CASE DETAILS
       ======================================================== */

    async function openCaseDetails(id) {

        if (!state.authorized) return;


        const requestId = ++state.requests.detail;


        showNotice(

            "Retrieving investigation details..."

        );


        try {

            const report = await requestJSON(

                API.caseDetail(id)

            );


            if (

                requestId !== state.requests.detail ||

                !state.authorized

            ) {

                return;

            }


            if (

                !report ||

                report.id !== id ||

                !Object.hasOwn(

                    CASE_STATUSES,

                    report.status

                )

            ) {

                throw new Error(

                    "Invalid investigation detail response."

                );

            }


            state.selectedCase = report;


            state.previousFocus = document.activeElement;


            renderCaseDetails(report);


            el.detailOverlay.hidden = false;


            updateBodyScroll();


            el.detailClose.focus();


            showNotice(

                "Investigation details retrieved.",

                "success"

            );


        } catch (error) {

            if (requestId !== state.requests.detail) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            showNotice(

                "The selected investigation could not be retrieved.",

                "error"

            );

        }

    }


    /* ========================================================
       31. REQUEST ADMINISTRATIVE ACTION
       ======================================================== */

    function requestAction(action) {

        if (

            !state.authorized ||

            state.actionInProgress ||

            !state.selectedCase

        ) {

            return;

        }


        if (

            !Object.hasOwn(ACTIONS, action) ||

            !state.selectedCase.availableActions?.includes(action)

        ) {

            return;

        }


        state.pendingAction = {

            caseId: state.selectedCase.id,

            action

        };


        el.confirmTitle.textContent =

            "Confirm: " + ACTIONS[action];


        el.confirmDescription.textContent =

            ACTION_DESCRIPTIONS[action] +

            " Case reference: " +

            safeValue(state.selectedCase.reference);


        el.confirmReason.value = "";


        el.confirmSubmit.disabled = true;

        el.confirmCancel.disabled = false;


        el.confirmSubmit.textContent =

            "Confirm Action";


        state.activeDialog = "confirmation";


        el.confirmOverlay.hidden = false;


        updateBodyScroll();


        el.confirmReason.focus();

    }


    /* ========================================================
       32. CLOSE CONFIRMATION
       ======================================================== */

    function closeConfirmation() {

        if (state.actionInProgress) return;


        el.confirmOverlay.hidden = true;


        state.pendingAction = null;

        state.activeDialog = null;


        el.confirmReason.value = "";


        updateBodyScroll();


        restoreFocus();

    }


    /* ========================================================
       33. EXECUTE ADMINISTRATIVE ACTION
       ======================================================== */

    async function executeAction() {

        if (

            !state.authorized ||

            !state.pendingAction ||

            state.actionInProgress

        ) {

            return;

        }


        const reason =

            el.confirmReason.value.trim();


        if (reason.length < 5) {

            showNotice(

                "Provide a meaningful administrative justification.",

                "warning"

            );


            el.confirmReason.focus();


            return;

        }


        if (!state.csrfToken) {

            showNotice(

                "Your security session is invalid.",

                "error"

            );


            return;

        }


        const pending = state.pendingAction;


        if (

            !state.selectedCase ||

            state.selectedCase.id !== pending.caseId

        ) {

            showNotice(

                "The selected case has changed. Reload the record before continuing.",

                "warning"

            );


            closeConfirmation();

            return;

        }


        state.actionInProgress = true;


        el.confirmSubmit.disabled = true;

        el.confirmCancel.disabled = true;


        el.confirmSubmit.textContent =

            "Processing...";


        try {

            const result = await requestJSON(

                API.caseAction(pending.caseId),

                {

                    method: "POST",

                    body: JSON.stringify({

                        action: pending.action,

                        reason

                    })

                }

            );


            if (!state.authorized) return;


            state.actionInProgress = false;


            el.confirmOverlay.hidden = true;


            state.pendingAction = null;

            state.activeDialog = null;


            closeAllPanels();


            showNotice(

                result?.message ||

                "The administrative intervention was accepted by the server.",

                "success"

            );


            state.cases.page = 1;


            await refreshAll();


        } catch (error) {

            if (!handleAuthorizationError(error)) {

                showNotice(

                    error.message ||

                    "The investigation action could not be completed.",

                    "error"

                );

            }

        } finally {

            state.actionInProgress = false;


            el.confirmCancel.disabled = false;

            el.confirmSubmit.disabled = true;


            el.confirmSubmit.textContent =

                "Confirm Action";

        }

    }


    /* ========================================================
       34. RECENT INVESTIGATION ACTIVITY
       ======================================================== */

    function renderActivity(result) {

        if (

            !result ||

            !Array.isArray(result.items)

        ) {

            throw new Error(

                "Invalid investigation activity response."

            );

        }


        const fragment =

            document.createDocumentFragment();


        result.items.forEach(event => {

            if (!event) return;


            const row = createElement("tr");


            row.append(

                createElement(

                    "td",

                    "reports-event-reference",

                    safeValue(event.reference)

                ),

                createElement(

                    "td",

                    "",

                    safeValue(event.event)

                ),

                createElement(

                    "td",

                    "",

                    safeValue(event.caseReference)

                ),

                createElement(

                    "td",

                    "",

                    safeValue(event.actor)

                ),

                createElement(

                    "td",

                    "reports-event-description",

                    safeValue(event.description)

                ),

                createElement(

                    "td",

                    "",

                    formatDateTime(event.timestamp)

                )

            );


            fragment.append(row);

        });


        if (fragment.childNodes.length === 0) {

            emptyActivity();

        } else {

            el.activityTable.replaceChildren(fragment);


            el.activityCount.textContent =

                validCount(result.items.length) +

                " events returned";

        }

    }


    /* ========================================================
       35. LOAD INVESTIGATION ACTIVITY
       ======================================================== */

    async function loadActivity() {

        if (!state.authorized) return;


        const requestId = ++state.requests.activity;


        emptyActivity();


        try {

            const result = await requestJSON(

                API.activity +

                "?limit=15"

            );


            if (

                requestId !== state.requests.activity ||

                !state.authorized

            ) {

                return;

            }


            renderActivity(result);


        } catch (error) {

            if (requestId !== state.requests.activity) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            emptyActivity();

        }

    }


    /* ========================================================
       36. EXPORT INVESTIGATION REPORT
       ======================================================== */

    async function exportReport() {

        if (!state.authorized) return;


        const originalText =

            el.exportButton.textContent;


        el.exportButton.disabled = true;

        el.exportButton.textContent =

            "Preparing Report...";


        try {

            const result = await requestExport(

                API.export

            );


            if (!state.authorized) return;


            const objectURL = URL.createObjectURL(

                result.blob

            );


            const link = document.createElement("a");


            link.href = objectURL;


            const disposition = result.filename || "";


            const match = disposition.match(

                /filename\*?=(?:UTF-8''|")?([^";\r\n]+)"?/i

            );


            let filename = match

                ? match[1]

                : "talvora-investigation-report.csv";


            try {

                filename = decodeURIComponent(filename);

            } catch {

                // Retain server-provided filename.

            }


            filename = filename.replace(

                /[\\/:*?"<>|]/g,

                "_"

            );


            link.download = filename;

            link.style.display = "none";


            document.body.append(link);

            link.click();

            link.remove();


            setTimeout(() => {

                URL.revokeObjectURL(objectURL);

            }, 1000);


            showNotice(

                "The authorized investigation report has been prepared.",

                "success"

            );


        } catch (error) {

            if (!handleAuthorizationError(error)) {

                showNotice(

                    error.message ||

                    "The investigation report could not be exported.",

                    "error"

                );

            }

        } finally {

            el.exportButton.disabled = false;

            el.exportButton.textContent = originalText;

        }

    }


    /* ========================================================
       37. STATUS TABS
       ======================================================== */

    function selectStatus(status) {

        const allowed = [

            "all",

            "new",

            "open",

            "investigating",

            "escalated",

            "resolved",

            "closed"

        ];


        if (!allowed.includes(status)) return;


        state.cases.status = status;

        state.cases.page = 1;


        document.querySelectorAll(".reports-tab")

            .forEach(button => {

                const active =

                    button.dataset.status === status;


                button.classList.toggle(

                    "active",

                    active

                );


                button.setAttribute(

                    "aria-selected",

                    String(active)

                );


                button.tabIndex = active ? 0 : -1;

            });


        loadCases();

    }


    /* ========================================================
       38. PAGINATION
       ======================================================== */

    function changePage(direction) {

        if (!state.authorized) return;


        const nextPage =

            state.cases.page + direction;


        if (

            nextPage < 1 ||

            nextPage > state.cases.totalPages

        ) {

            return;

        }


        state.cases.page = nextPage;


        loadCases();

    }


    /* ========================================================
       39. PANEL MANAGEMENT
       ======================================================== */

    function closeCaseDetails() {

        state.requests.detail++;


        el.detailOverlay.hidden = true;


        state.selectedCase = null;

        state.selectedEvidence = null;


        el.detailContent.replaceChildren();

        el.detailActions.replaceChildren();


        updateBodyScroll();


        restoreFocus();

    }


    function closeEvidenceRegister() {

        el.evidenceOverlay.hidden = true;


        state.selectedEvidence = null;


        el.evidenceContent.replaceChildren();


        updateBodyScroll();


        restoreFocus();

    }


    function closeAllPanels() {

        el.detailOverlay.hidden = true;

        el.evidenceOverlay.hidden = true;


        el.detailContent.replaceChildren();

        el.detailActions.replaceChildren();

        el.evidenceContent.replaceChildren();


        state.selectedCase = null;

        state.selectedEvidence = null;


        updateBodyScroll();

    }


    function updateBodyScroll() {

        const anyOpen =

            !el.detailOverlay.hidden ||

            !el.evidenceOverlay.hidden ||

            !el.confirmOverlay.hidden;


        document.body.style.overflow =

            anyOpen ? "hidden" : "";

    }


    function restoreFocus() {

        if (

            state.previousFocus &&

            document.contains(state.previousFocus)

        ) {

            state.previousFocus.focus();

        }


        state.previousFocus = null;

    }


    /* ========================================================
       40. SIDEBAR
       ======================================================== */

    function openSidebar() {

        $("sidebar").classList.add(

            "sidebar-open"

        );


        $("sidebar-overlay").hidden = false;


        $("menu-toggle").setAttribute(

            "aria-expanded",

            "true"

        );

    }


    function closeSidebar() {

        $("sidebar").classList.remove(

            "sidebar-open"

        );


        $("sidebar-overlay").hidden = true;


        $("menu-toggle").setAttribute(

            "aria-expanded",

            "false"

        );

    }


    /* ========================================================
       41. REFRESH ALL DATA
       ======================================================== */

    async function refreshAll() {

        if (!state.authorized) return;


        showNotice(

            "Refreshing reports, investigations and security information..."

        );


        await Promise.all([

            loadSummary(),

            loadCases(),

            loadActivity()

        ]);


        if (!state.authorized) return;


        showNotice(

            "Investigation oversight data refreshed.",

            "success"

        );

    }


    /* ========================================================
       42. EVENT REGISTRATION
       ======================================================== */

    function registerEvents() {


        /* SIDEBAR */

        $("menu-toggle").addEventListener(

            "click",

            openSidebar

        );


        $("close-sidebar").addEventListener(

            "click",

            closeSidebar

        );


        $("sidebar-overlay").addEventListener(

            "click",

            closeSidebar

        );


        /* REFRESH */

        el.refresh.addEventListener(

            "click",

            refreshAll

        );


        /* EXPORT */

        el.exportButton.addEventListener(

            "click",

            exportReport

        );


        /* FILTER SUBMISSION */

        el.filterForm.addEventListener(

            "submit",

            event => {

                event.preventDefault();


                if (!state.authorized) return;


                applyFilters();


                loadCases();

            }

        );


        /* CLEAR FILTERS */

        el.clearFilters.addEventListener(

            "click",

            () => {

                el.search.value = "";

                el.categoryFilter.value = "";

                el.severityFilter.value = "";

                el.portalFilter.value = "";

                el.dateSort.value = "newest";


                applyFilters();


                loadCases();

            }

        );


        /* PAGINATION */

        el.previous.addEventListener(

            "click",

            () => changePage(-1)

        );


        el.next.addEventListener(

            "click",

            () => changePage(1)

        );


        /* STATUS TABS */

        const tabs = Array.from(

            document.querySelectorAll(".reports-tab")

        );


        tabs.forEach((button, index) => {


            button.addEventListener(

                "click",

                () => {

                    selectStatus(

                        button.dataset.status

                    );

                }

            );


            button.addEventListener(

                "keydown",

                event => {

                    let target = index;


                    if (event.key === "ArrowRight") {

                        target =

                            (index + 1) % tabs.length;

                    } else if (event.key === "ArrowLeft") {

                        target =

                            (index - 1 + tabs.length) %

                            tabs.length;

                    } else if (event.key === "Home") {

                        target = 0;

                    } else if (event.key === "End") {

                        target = tabs.length - 1;

                    } else {

                        return;

                    }


                    event.preventDefault();


                    tabs[target].focus();


                    selectStatus(

                        tabs[target].dataset.status

                    );

                }

            );

        });


        /* CLOSE DRAWERS */

        el.detailClose.addEventListener(

            "click",

            closeCaseDetails

        );


        el.evidenceClose.addEventListener(

            "click",

            closeEvidenceRegister

        );


        /* BACKDROP */

        [

            [el.detailOverlay, closeCaseDetails],

            [el.evidenceOverlay, closeEvidenceRegister]

        ].forEach(([overlay, close]) => {

            overlay.addEventListener(

                "click",

                event => {

                    if (event.target === overlay) {

                        close();

                    }

                }

            );

        });


        /* ACTION REASON */

        el.confirmReason.addEventListener(

            "input",

            () => {

                el.confirmSubmit.disabled =

                    el.confirmReason.value.trim().length < 5 ||

                    !state.authorized;

            }

        );


        /* ACTION CONFIRMATION */

        el.confirmCancel.addEventListener(

            "click",

            closeConfirmation

        );


        el.confirmSubmit.addEventListener(

            "click",

            executeAction

        );


        /* KEYBOARD */

        document.addEventListener(

            "keydown",

            event => {

                if (event.key !== "Escape") return;


                if (!el.confirmOverlay.hidden) {

                    closeConfirmation();

                } else if (!el.evidenceOverlay.hidden) {

                    closeEvidenceRegister();

                } else if (!el.detailOverlay.hidden) {

                    closeCaseDetails();

                } else {

                    closeSidebar();

                }

            }

        );

    }


    /* ========================================================
       43. INITIALIZATION
       ======================================================== */

    async function initialize() {

        clearMetrics();


        registerEvents();


        try {

            const session = await requestJSON(

                API.session

            );


            if (

                session?.authenticated !== true ||

                !session.user?.id ||

                session.user.role !== "super_admin"

            ) {

                showLocked(

                    "Please sign in using an authorized Super Admin account."

                );


                return;

            }


            state.authorized = true;


            state.csrfToken =

                typeof session.csrfToken === "string"

                    ? session.csrfToken

                    : null;


            showApplication();


            setConnection("Connecting...");


            enableControls();


            await refreshAll();


            if (state.authorized) {

                setConnection(

                    "Connected",

                    true

                );

            }


        } catch (error) {


            if (

                IS_LOCAL &&

                !error.status

            ) {

                enterLocalPreview();

                return;

            }


            showLocked(

                error.message ||

                "Administrator authorization could not be verified."

            );

        }

    }


    /* ========================================================
       44. START APPLICATION
       ======================================================== */

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
