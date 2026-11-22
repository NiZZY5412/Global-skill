
/* ==========================================================
   TALVORA TECHNOLOGIES
   TALVORA GLOBAL — GSES SYSTEM 001

   DISPUTES & APPEALS MANAGEMENT
   FILE: disputes.js

   IMPORTANT:
   No demo records.
   No fabricated disputes.
   No fake financial or performance figures.
   All records must come from authorized backend services.

   Administrative decisions are server-authorized.
   Evidence access is server-authorized.
   All actions require auditable justification.
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
            "/api/v1/admin/disputes/summary",

        cases:
            "/api/v1/admin/disputes/cases",

        caseDetail: id =>
            "/api/v1/admin/disputes/cases/" +
            encodeURIComponent(id),

        caseAction: id =>
            "/api/v1/admin/disputes/cases/" +
            encodeURIComponent(id) +
            "/actions",

        appeals:
            "/api/v1/admin/disputes/appeals",

        appealDetail: id =>
            "/api/v1/admin/disputes/appeals/" +
            encodeURIComponent(id),

        appealAction: id =>
            "/api/v1/admin/disputes/appeals/" +
            encodeURIComponent(id) +
            "/actions",

        escalations:
            "/api/v1/admin/disputes/escalations",

        mediation:
            "/api/v1/admin/disputes/mediation",

        assignments:
            "/api/v1/admin/disputes/assignments",

        activity:
            "/api/v1/admin/disputes/activity",

        communications: id =>
            "/api/v1/admin/disputes/cases/" +
            encodeURIComponent(id) +
            "/communications",

        evidence: (caseId, evidenceId) =>
            "/api/v1/admin/disputes/cases/" +
            encodeURIComponent(caseId) +
            "/evidence/" +
            encodeURIComponent(evidenceId) +
            "/content",

        export:
            "/api/v1/admin/disputes/export"

    };


    /* ========================================================
       02. CONFIGURATION
       ======================================================== */

    const $ = id => document.getElementById(id);

    const PAGE_SIZE = 20;

    const LOCAL_HOSTS = [
        "localhost",
        "127.0.0.1",
        "::1"
    ];

    const IS_LOCAL =
        location.protocol === "file:" ||
        LOCAL_HOSTS.includes(location.hostname);


    /* ========================================================
       03. DISPUTE STATUS DEFINITIONS
       ======================================================== */

    const STATUSES = {

        submitted: "Submitted",

        under_review: "Under Review",

        awaiting_response: "Awaiting Response",

        mediation: "In Mediation",

        escalated: "Escalated",

        appealed: "Appealed",

        awaiting_review: "Awaiting Review",

        resolved: "Resolved",

        closed: "Closed",

        rejected: "Rejected",

        withdrawn: "Withdrawn"

    };


    const PRIORITIES = {

        critical: "Critical",

        high: "High",

        medium: "Medium",

        low: "Low"

    };


    const CATEGORIES = {

        recruitment: "Recruitment",

        application: "Application",

        employment: "Employment",

        payment: "Payment",

        contract: "Contract",

        assessment: "Assessment",

        matching: "Matching",

        identity: "Identity",

        conduct: "Conduct",

        other: "Other"

    };


    const PARTY_TYPES = {

        employee: "Employee",

        employer: "Employer",

        both: "Both Parties"

    };


    const ACTIONS = {

        acknowledge:
            "Acknowledge Dispute",

        assign:
            "Assign Reviewer",

        start_review:
            "Start Formal Review",

        request_response:
            "Request Party Response",

        request_evidence:
            "Request Additional Evidence",

        start_mediation:
            "Start Mediation",

        schedule_mediation:
            "Schedule Mediation",

        escalate:
            "Escalate Dispute",

        propose_resolution:
            "Propose Resolution",

        resolve:
            "Record Resolution",

        reject:
            "Reject Dispute",

        close:
            "Close Dispute",

        reopen:
            "Reopen Dispute",

        withdraw:
            "Record Withdrawal",

        accept_appeal:
            "Accept Appeal for Review",

        reject_appeal:
            "Reject Appeal",

        uphold_decision:
            "Uphold Original Decision",

        overturn_decision:
            "Overturn Original Decision",

        modify_decision:
            "Modify Original Decision",

        close_appeal:
            "Close Appeal"

    };


    const ACTION_DESCRIPTIONS = {

        acknowledge:
            "Acknowledge receipt of the submitted dispute.",

        assign:
            "Assign this dispute to an authorized reviewer.",

        start_review:
            "Begin the formal review of the dispute.",

        request_response:
            "Request a formal response from the relevant party.",

        request_evidence:
            "Request additional supporting information or evidence.",

        start_mediation:
            "Refer the dispute to the mediation process.",

        schedule_mediation:
            "Record a mediation scheduling intervention.",

        escalate:
            "Escalate this dispute for higher administrative attention.",

        propose_resolution:
            "Record a proposed resolution for review.",

        resolve:
            "Record a formal dispute resolution.",

        reject:
            "Record a reasoned decision rejecting the dispute.",

        close:
            "Close the dispute following the applicable procedure.",

        reopen:
            "Reopen a previously resolved or closed dispute.",

        withdraw:
            "Record the withdrawal of the dispute.",

        accept_appeal:
            "Accept the appeal for further review.",

        reject_appeal:
            "Record a reasoned decision on the appeal.",

        uphold_decision:
            "Uphold the original decision following appeal review.",

        overturn_decision:
            "Overturn the original decision following appeal review.",

        modify_decision:
            "Modify the original decision following appeal review.",

        close_appeal:
            "Close the appeal after the applicable review."

    };


    const DECISION_ACTIONS = [

        "propose_resolution",

        "resolve",

        "reject",

        "uphold_decision",

        "overturn_decision",

        "modify_decision",

        "reject_appeal"

    ];


    /* ========================================================
       04. DOM REFERENCES
       ======================================================== */

    const el = {

        app: $("disputes-app"),

        locked: $("disputes-locked"),

        accessMessage: $("disputes-access-message"),

        notice: $("disputes-notice"),

        systemStatus: $("disputes-system-status"),


        refresh: $("disputes-refresh"),

        exportButton: $("disputes-export"),


        filterForm: $("disputes-filter-form"),

        search: $("disputes-search"),

        typeFilter: $("disputes-type-filter"),

        priorityFilter: $("disputes-priority-filter"),

        partyFilter: $("disputes-party-filter"),

        sort: $("disputes-sort"),

        clearFilters: $("disputes-clear"),


        table: $("disputes-table-body"),

        recordCount: $("disputes-record-count"),

        pageInfo: $("disputes-page-info"),

        previous: $("disputes-prev"),

        next: $("disputes-next"),


        appealTable: $("disputes-appeal-body"),

        appealCount: $("disputes-appeal-count"),


        escalationTable: $("disputes-escalation-body"),

        escalationCount: $("disputes-escalation-count"),


        mediationTable: $("disputes-mediation-body"),

        mediationCount: $("disputes-mediation-count"),


        assignmentTable: $("disputes-assignment-body"),

        assignmentCount: $("disputes-assignment-count"),


        activityTable: $("disputes-activity-body"),

        activityCount: $("disputes-activity-count"),


        categoryList: $("disputes-category-list"),


        detailOverlay: $("disputes-detail-overlay"),

        detailTitle: $("disputes-detail-title"),

        detailClose: $("disputes-detail-close"),

        detailContent: $("disputes-detail-content"),

        detailActions: $("disputes-detail-actions"),


        evidenceOverlay: $("disputes-evidence-overlay"),

        evidenceTitle: $("disputes-evidence-title"),

        evidenceClose: $("disputes-evidence-close"),

        evidenceContent: $("disputes-evidence-content"),


        communicationOverlay: $("disputes-communication-overlay"),

        communicationTitle: $("disputes-communication-title"),

        communicationClose: $("disputes-communication-close"),

        communicationContent: $("disputes-communication-content"),


        confirmOverlay: $("disputes-confirm-overlay"),

        confirmTitle: $("disputes-confirm-title"),

        confirmDescription: $("disputes-confirm-description"),

        assigneeField: $("disputes-assignee-field"),

        assigneeSelect: $("disputes-assignee-select"),

        decisionField: $("disputes-decision-field"),

        decision: $("disputes-decision"),

        reason: $("disputes-action-reason"),

        confirmCancel: $("disputes-confirm-cancel"),

        confirmSubmit: $("disputes-confirm-submit")

    };


    /* ========================================================
       05. METRIC REFERENCES
       ======================================================== */

    const METRICS = {

        total: "metric-disputes-total",

        new: "metric-disputes-new",

        review: "metric-disputes-review",

        response: "metric-disputes-response",

        mediation: "metric-disputes-mediation",

        appeals: "metric-disputes-appeals",

        resolved: "metric-disputes-resolved",

        overdue: "metric-disputes-overdue"

    };


    /* ========================================================
       06. APPLICATION STATE
       ======================================================== */

    const state = {

        authorized: false,

        csrfToken: null,


        filters: {

            status: "all",

            page: 1,

            totalPages: 0,

            search: "",

            type: "",

            priority: "",

            party: "",

            sort: "newest"

        },


        selectedCase: null,

        selectedAppeal: null,

        selectedEvidence: null,

        selectedResourceType: null,


        pendingAction: null,

        actionInProgress: false,

        previousFocus: null,


        requests: {

            summary: 0,

            cases: 0,

            appeals: 0,

            escalations: 0,

            mediation: 0,

            assignments: 0,

            activity: 0,

            detail: 0,

            communication: 0,

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


    function validPercentage(value) {

        if (

            typeof value !== "number" ||

            !Number.isFinite(value) ||

            value < 0 ||

            value > 100

        ) {

            return "—";

        }


        return value.toFixed(1) + "%";

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

            "disputes-notice " + type;


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

            $(id).textContent = "—";

        });


        [

            "performance-resolution-rate",

            "performance-resolution-time",

            "performance-appeal-rate",

            "performance-unassigned"

        ].forEach(id => {

            $(id).textContent = "—";

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

            "disputes-empty"

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

            11,

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


    function emptyAppeals() {

        showEmptyTable(

            el.appealTable,

            5,

            "",

            "Appeal records are not available."

        );


        el.appealCount.textContent =

            "Records unavailable";

    }


    function emptyEscalations() {

        showEmptyTable(

            el.escalationTable,

            5,

            "",

            "Escalation records are not available."

        );


        el.escalationCount.textContent =

            "Records unavailable";

    }


    function emptyMediation() {

        showEmptyTable(

            el.mediationTable,

            7,

            "",

            "Mediation records are not available."

        );


        el.mediationCount.textContent =

            "Records unavailable";

    }


    function emptyAssignments() {

        showEmptyTable(

            el.assignmentTable,

            6,

            "",

            "Reviewer allocation records are not available."

        );


        el.assignmentCount.textContent =

            "Records unavailable";

    }


    function emptyActivity() {

        showEmptyTable(

            el.activityTable,

            6,

            "",

            "Dispute activity records are not available."

        );


        el.activityCount.textContent =

            "Records unavailable";

    }


    /* ========================================================
       09. REQUEST INVALIDATION
       ======================================================== */

    function invalidateRequests() {

        Object.keys(state.requests).forEach(key => {

            state.requests[key]++;

        });

    }


    /* ========================================================
       10. APPLICATION VISIBILITY
       ======================================================== */

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

            "Frontend preview only. No dispute records, " +

            "appeals, mediation sessions, communications, " +

            "evidence or statistics are connected. " +

            "Administrative actions are disabled.",

            "warning"

        );


        clearMetrics();


        emptyCases(

            "No dispute records connected",

            "Actual platform disputes will appear when the authorized backend is implemented."

        );


        emptyAppeals();

        emptyEscalations();

        emptyMediation();

        emptyAssignments();

        emptyActivity();


        el.categoryList.replaceChildren(

            createElement(

                "div",

                "disputes-empty-inline",

                "Category data unavailable."

            )

        );

    }


    /* ========================================================
       11. API REQUEST HANDLER
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

                "The dispute management service is currently unavailable."

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

                // Keep default message.

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


    async function requestFile(url) {

        let response;


        try {

            response = await fetch(url, {

                method: "GET",

                credentials: "same-origin",

                cache: "no-store",

                redirect: "error"

            });

        } catch {

            throw new Error(

                "The requested file service is unavailable."

            );

        }


        if (

            response.status === 401 ||

            response.status === 403

        ) {

            const error = new Error(

                "File access authorization failed."

            );


            error.status = response.status;


            throw error;

        }


        if (!response.ok) {

            throw new Error(

                "The requested file could not be retrieved."

            );

        }


        const contentType =

            response.headers.get("content-type") || "";


        if (

            contentType.includes("text/html") ||

            contentType.includes("application/json")

        ) {

            throw new Error(

                "The service did not return a valid file."

            );

        }


        return {

            blob: await response.blob(),

            disposition: response.headers.get(

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
       12. ENABLE CONTROLS
       ======================================================== */

    function enableControls() {

        [

            el.refresh,

            el.exportButton,

            el.search,

            el.typeFilter,

            el.priorityFilter,

            el.partyFilter,

            el.sort,

            el.clearFilters,

            $("disputes-apply")

        ].forEach(control => {

            if (control) {

                control.disabled = false;

            }

        });

    }


    /* ========================================================
       13. DASHBOARD METRICS
       ======================================================== */

    function updateMetrics(metrics) {

        const mapping = {

            total: metrics.total,

            new: metrics.new,

            review: metrics.underReview,

            response: metrics.awaitingResponse,

            mediation: metrics.mediation,

            appeals: metrics.pendingAppeals,

            resolved: metrics.resolved,

            overdue: metrics.overdue

        };


        Object.entries(mapping).forEach(([key, value]) => {

            $(METRICS[key]).textContent =

                validCount(value);

        });

    }


    function renderPerformance(performance = {}) {

        $("performance-resolution-rate").textContent =

            validPercentage(performance.resolutionRate);


        $("performance-resolution-time").textContent =

            typeof performance.averageResolutionDays === "number" &&

                Number.isFinite(performance.averageResolutionDays) &&

                performance.averageResolutionDays >= 0

                ? performance.averageResolutionDays.toFixed(1) + " days"

                : "—";


        $("performance-appeal-rate").textContent =

            validPercentage(performance.appealRate);


        $("performance-unassigned").textContent =

            validCount(performance.unassigned);


        $("performance-updated").textContent =

            formatDateTime(performance.updatedAt);

    }


    /* ========================================================
       14. CATEGORY DISTRIBUTION
       ======================================================== */

    function renderCategories(categories) {

        el.categoryList.replaceChildren();


        if (!Array.isArray(categories) || !categories.length) {

            el.categoryList.append(

                createElement(

                    "div",

                    "disputes-empty-inline",

                    "No category statistics available."

                )

            );


            return;

        }


        categories.forEach(item => {

            if (

                !item ||

                !Number.isSafeInteger(item.count) ||

                item.count < 0

            ) {

                return;

            }


            const wrapper = createElement(

                "div",

                "disputes-category-item"

            );


            const heading = createElement(

                "div",

                "disputes-category-heading"

            );


            heading.append(

                createElement(

                    "span",

                    "",

                    CATEGORIES[item.category] ||

                    safeValue(item.label)

                ),

                createElement(

                    "strong",

                    "",

                    validCount(item.count)

                )

            );


            const track = createElement(

                "div",

                "disputes-category-track"

            );


            const fill = createElement(

                "div",

                "disputes-category-fill"

            );


            const percentage =

                typeof item.percentage === "number" &&

                    Number.isFinite(item.percentage)

                    ? Math.max(0, Math.min(100, item.percentage))

                    : 0;


            fill.style.width = percentage + "%";


            track.append(fill);


            wrapper.append(heading, track);


            el.categoryList.append(wrapper);

        });

    }


    /* ========================================================
       15. LOAD DASHBOARD SUMMARY
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

                    "Invalid dispute summary response."

                );

            }


            updateMetrics(result.metrics);


            renderCategories(

                result.categoryBreakdown

            );


            renderPerformance(

                result.performance

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

                "Dispute statistics could not be retrieved.",

                "error"

            );

        }

    }


    /* ========================================================
       16. FILTER CONSTRUCTION
       ======================================================== */

    function buildCaseQuery() {

        const params = new URLSearchParams({

            page: String(state.filters.page),

            limit: String(PAGE_SIZE),

            status: state.filters.status,

            sort: state.filters.sort

        });


        if (state.filters.search) {

            params.set(

                "search",

                state.filters.search

            );

        }


        if (state.filters.type) {

            params.set(

                "type",

                state.filters.type

            );

        }


        if (state.filters.priority) {

            params.set(

                "priority",

                state.filters.priority

            );

        }


        if (state.filters.party) {

            params.set(

                "party",

                state.filters.party

            );

        }


        return params;

    }


    function applyFilters() {

        state.filters.search =

            el.search.value.trim();


        state.filters.type =

            el.typeFilter.value;


        state.filters.priority =

            el.priorityFilter.value;


        state.filters.party =

            el.partyFilter.value;


        state.filters.sort =

            el.sort.value;


        state.filters.page = 1;

    }


    /* ========================================================
       17. STATUS BADGES
       ======================================================== */

    function statusBadge(status) {

        return createElement(

            "span",

            "dispute-status " + status,

            STATUSES[status] || "Unknown"

        );

    }


    function priorityBadge(priority) {

        const valid = Object.hasOwn(

            PRIORITIES,

            priority

        );


        return createElement(

            "span",

            "dispute-priority " +

            (valid ? priority : "unknown"),

            valid ? PRIORITIES[priority] : "Unavailable"

        );

    }


    /* ========================================================
       18. PAGINATION
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

                "Invalid dispute pagination information."

            );

        }


        state.filters.totalPages =

            pagination.totalPages;


        el.recordCount.textContent =

            validCount(pagination.total) +

            " dispute records";


        el.pageInfo.textContent =

            pagination.totalPages > 0

                ? `Page ${state.filters.page} of ${pagination.totalPages}`

                : "No pages";


        el.previous.disabled =

            state.filters.page <= 1;


        el.next.disabled =

            pagination.totalPages === 0 ||

            state.filters.page >= pagination.totalPages;

    }


    /* ========================================================
       19. DISPUTE REGISTER RENDERING
       ======================================================== */

    function renderCases(result) {

        if (

            !result ||

            !Array.isArray(result.items) ||

            !result.pagination

        ) {

            throw new Error(

                "Invalid dispute register response."

            );

        }


        const fragment =

            document.createDocumentFragment();


        result.items.forEach(dispute => {

            if (

                !dispute ||

                typeof dispute.id !== "string" ||

                !dispute.id ||

                !Object.hasOwn(STATUSES, dispute.status)

            ) {

                return;

            }


            const row = createElement("tr");


            /* REFERENCE */

            row.append(

                createElement(

                    "td",

                    "disputes-reference",

                    safeValue(dispute.reference)

                )

            );


            /* SUBJECT */

            const subjectCell = createElement("td");


            subjectCell.append(

                createElement(

                    "span",

                    "disputes-title-text",

                    safeValue(dispute.title)

                ),

                createElement(

                    "span",

                    "disputes-secondary-text",

                    safeValue(dispute.descriptionSummary)

                )

            );


            row.append(subjectCell);


            /* CATEGORY */

            row.append(

                createElement(

                    "td",

                    "",

                    CATEGORIES[dispute.category] ||

                    safeValue(dispute.categoryLabel)

                )

            );


            /* CLAIMANT */

            const claimant = dispute.claimant || {};

            const claimantCell = createElement("td");


            claimantCell.append(

                createElement(

                    "span",

                    "disputes-party-name",

                    safeValue(claimant.displayName)

                ),

                createElement(

                    "span",

                    "disputes-secondary-text",

                    safeValue(claimant.reference)

                )

            );


            row.append(claimantCell);


            /* RESPONDENT */

            const respondent = dispute.respondent || {};

            const respondentCell = createElement("td");


            respondentCell.append(

                createElement(

                    "span",

                    "disputes-party-name",

                    safeValue(respondent.displayName)

                ),

                createElement(

                    "span",

                    "disputes-secondary-text",

                    safeValue(respondent.reference)

                )

            );


            row.append(respondentCell);


            /* PRIORITY */

            const priorityCell = createElement("td");


            priorityCell.append(

                priorityBadge(dispute.priority)

            );


            row.append(priorityCell);


            /* STATUS */

            const statusCell = createElement("td");


            statusCell.append(

                statusBadge(dispute.status)

            );


            row.append(statusCell);


            /* REVIEWER */

            row.append(

                createElement(

                    "td",

                    "",

                    dispute.assignee?.displayName ||

                    "Unassigned"

                )

            );


            /* SUBMISSION DATE */

            row.append(

                createElement(

                    "td",

                    "",

                    formatDate(dispute.createdAt)

                )

            );


            /* DEADLINE */

            row.append(

                createElement(

                    "td",

                    "",

                    formatDate(dispute.dueAt)

                )

            );


            /* VIEW */

            const actionCell = createElement("td");


            const button = createElement(

                "button",

                "disputes-view-button",

                "View Case"

            );


            button.type = "button";


            button.addEventListener(

                "click",

                () => openCaseDetails(dispute.id)

            );


            actionCell.append(button);


            row.append(actionCell);


            fragment.append(row);

        });


        if (!fragment.childNodes.length) {

            emptyCases(

                "No dispute records found",

                "No records match the current filters."

            );

        } else {

            el.table.replaceChildren(fragment);

        }


        updatePagination(result);

    }


    /* ========================================================
       20. LOAD DISPUTE REGISTER
       ======================================================== */

    async function loadCases() {

        if (!state.authorized) return;


        const requestId = ++state.requests.cases;


        emptyCases(

            "Loading dispute records",

            "Retrieving authorized dispute information..."

        );


        try {

            const result = await requestJSON(

                API.cases +

                "?" +

                buildCaseQuery().toString()

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

                "Dispute records unavailable",

                "The dispute service could not provide the requested records."

            );


            showNotice(

                "The dispute register could not be loaded.",

                "error"

            );

        }

    }


    /* ========================================================
       21. DETAIL FIELD HELPERS
       ======================================================== */

    function detailField(label, value) {

        const wrapper = createElement(

            "div",

            "disputes-detail-field"

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


    function detailSection(title, fields = []) {

        const section = createElement(

            "section",

            "disputes-detail-section"

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
       22. CASE TIMELINE
       ======================================================== */

    function renderTimeline(history) {

        const section = detailSection(

            "Dispute History",

            []

        );


        if (!Array.isArray(history) || !history.length) {

            section.append(

                createElement(

                    "p",

                    "",

                    "No dispute history is available."

                )

            );


            return section;

        }


        const timeline = createElement(

            "div",

            "disputes-timeline"

        );


        history.forEach(event => {

            if (!event) return;


            const item = createElement(

                "div",

                "disputes-timeline-item"

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
       23. EVIDENCE REGISTER
       ======================================================== */

    function renderEvidence(evidence) {

        const section = detailSection(

            "Supporting Evidence",

            []

        );


        if (!Array.isArray(evidence) || !evidence.length) {

            section.append(

                createElement(

                    "p",

                    "",

                    "No supporting evidence is attached to this dispute."

                )

            );


            return section;

        }


        const button = createElement(

            "button",

            "disputes-view-button",

            "Review Evidence (" + evidence.length + ")"

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
       24. OPEN EVIDENCE REGISTER
       ======================================================== */

    function openEvidenceRegister(evidence) {

        if (!state.authorized || !state.selectedCase) return;


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

                "disputes-evidence-item"

            );


            const icon = createElement(

                "div",

                "disputes-evidence-icon",

                "\u25A3"

            );


            const information = createElement(

                "div",

                "disputes-evidence-info"

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

                    "Evidence reference: " + safeValue(item.reference)

                ),

                createElement(

                    "p",

                    "",

                    "Type: " + safeValue(item.mimeType)

                ),

                createElement(

                    "p",

                    "",

                    "Submitted by: " + safeValue(item.submittedBy)

                ),

                createElement(

                    "p",

                    "",

                    "Submitted: " + formatDateTime(item.uploadedAt)

                ),

                createElement(

                    "p",

                    "",

                    "Integrity status: " + safeValue(item.integrityStatus)

                ),

                createElement(

                    "p",

                    "",

                    "Access: " + safeValue(item.accessStatus)

                )

            );


            const access = createElement(

                "div",

                "disputes-evidence-access"

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

                        "disputes-secondary-text",

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


        el.evidenceOverlay.hidden = false;


        updateBodyScroll();


        el.evidenceClose.focus();

    }


    /* ========================================================
       25. SECURE EVIDENCE RETRIEVAL
       ======================================================== */

    async function openEvidenceContent(evidenceId) {

        if (

            !state.authorized ||

            !state.selectedCase

        ) {

            return;

        }


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


        try {

            const result = await requestFile(

                API.evidence(

                    state.selectedCase.id,

                    evidenceId

                )

            );


            if (!state.authorized) return;


            const objectURL = URL.createObjectURL(

                result.blob

            );


            const link = document.createElement("a");


            link.href = objectURL;


            link.download =

                safeValue(evidence.displayName)

                    .replace(/[\\/:*?"<>|]/g, "_");


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

            if (!handleAuthorizationError(error)) {

                showNotice(

                    error.message ||

                    "Evidence retrieval failed.",

                    "error"

                );

            }

        }

    }


    /* ========================================================
       26. FORMAL COMMUNICATIONS
       ======================================================== */

    async function openCommunications(caseId) {

        if (!state.authorized) return;


        const requestId = ++state.requests.communication;


        state.previousFocus = document.activeElement;


        el.communicationContent.replaceChildren(

            createElement(

                "div",

                "disputes-empty",

                "Loading communication history..."

            )

        );


        el.communicationOverlay.hidden = false;


        el.communicationTitle.textContent =

            "Case Communications";


        updateBodyScroll();


        el.communicationClose.focus();


        try {

            const result = await requestJSON(

                API.communications(caseId)

            );


            if (

                requestId !== state.requests.communication ||

                !state.authorized

            ) {

                return;

            }


            if (!Array.isArray(result.items)) {

                throw new Error(

                    "Invalid communication response."

                );

            }


            el.communicationContent.replaceChildren();


            if (!result.items.length) {

                el.communicationContent.append(

                    createElement(

                        "div",

                        "disputes-empty",

                        "No communications are available for this case."

                    )

                );


                return;

            }


            result.items.forEach(message => {

                if (!message) return;


                const card = createElement(

                    "article",

                    "disputes-message"

                );


                const header = createElement(

                    "div",

                    "disputes-message-header"

                );


                header.append(

                    createElement(

                        "strong",

                        "",

                        safeValue(message.sender)

                    ),

                    createElement(

                        "time",

                        "",

                        formatDateTime(message.createdAt)

                    )

                );


                card.append(

                    header,

                    createElement(

                        "p",

                        "",

                        safeValue(message.body)

                    ),

                    createElement(

                        "span",

                        "disputes-message-visibility",

                        safeValue(message.visibility)

                    )

                );


                el.communicationContent.append(card);

            });


        } catch (error) {

            if (requestId !== state.requests.communication) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            el.communicationContent.replaceChildren(

                createElement(

                    "div",

                    "disputes-empty",

                    "Communication history could not be retrieved."

                )

            );

        }

    }


    /* ========================================================
       27. CASE DETAIL RENDERING
       ======================================================== */

    function renderCaseDetails(dispute) {

        const claimant = dispute.claimant || {};

        const respondent = dispute.respondent || {};

        const assignment = dispute.assignment || {};

        const review = dispute.review || {};

        const mediation = dispute.mediation || {};

        const resolution = dispute.resolution || {};

        const privacy = dispute.privacy || {};


        el.detailTitle.textContent =

            safeValue(dispute.reference);


        el.detailContent.replaceChildren();


        /* CASE OVERVIEW */

        const overview = detailSection(

            "Dispute Overview",

            [

                detailField("Reference", dispute.reference),

                detailField("Subject", dispute.title),

                detailField(

                    "Dispute Category",

                    CATEGORIES[dispute.category] ||

                    dispute.categoryLabel

                ),

                detailField(

                    "Priority",

                    PRIORITIES[dispute.priority]

                ),

                detailField(

                    "Status",

                    STATUSES[dispute.status]

                ),

                detailField(

                    "Submitted",

                    formatDateTime(dispute.createdAt)

                ),

                detailField(

                    "Last Updated",

                    formatDateTime(dispute.updatedAt)

                ),

                detailField(

                    "Review Deadline",

                    formatDateTime(dispute.dueAt)

                ),

                detailField(

                    "Originating Portal",

                    dispute.sourcePortal

                )

            ]

        );


        /* CLAIMANT */

        const claimantSection = detailSection(

            "Claimant Information",

            [

                detailField("Name", claimant.displayName),

                detailField("Reference", claimant.reference),

                detailField("Portal", claimant.portal),

                detailField("Country", claimant.country),

                detailField("Contact Reference", claimant.contactReference)

            ]

        );


        /* RESPONDENT */

        const respondentSection = detailSection(

            "Respondent Information",

            [

                detailField("Name", respondent.displayName),

                detailField("Reference", respondent.reference),

                detailField("Portal", respondent.portal),

                detailField("Country", respondent.country),

                detailField("Contact Reference", respondent.contactReference)

            ]

        );


        /* DISPUTE CLAIM */

        const claimSection = detailSection(

            "Dispute Statement",

            [

                detailField("Description", dispute.description),

                detailField("Claim Details", dispute.claimDetails),

                detailField("Requested Outcome", dispute.requestedOutcome),

                detailField("Claimant's Position", dispute.claimantPosition),

                detailField("Respondent's Position", dispute.respondentPosition)

            ]

        );


        /* ASSIGNMENT */

        const assignmentSection = detailSection(

            "Administrative Review",

            [

                detailField(

                    "Assigned Reviewer",

                    assignment.displayName

                ),

                detailField(

                    "Reviewer Reference",

                    assignment.reference

                ),

                detailField(

                    "Assigned Date",

                    formatDateTime(assignment.assignedAt)

                ),

                detailField(

                    "Review Started",

                    formatDateTime(review.startedAt)

                ),

                detailField(

                    "Review Status",

                    review.status

                ),

                detailField(

                    "Review Summary",

                    review.summary

                )

            ]

        );


        /* MEDIATION */

        const mediationSection = detailSection(

            "Mediation Details",

            [

                detailField("Mediation Status", mediation.status),

                detailField("Mediator", mediation.mediator),

                detailField(

                    "Scheduled Session",

                    formatDateTime(mediation.sessionAt)

                ),

                detailField(

                    "Mediation Summary",

                    mediation.summary

                ),

                detailField(

                    "Mediation Outcome",

                    mediation.outcome

                )

            ]

        );


        /* RESOLUTION */

        const resolutionSection = detailSection(

            "Resolution & Decision",

            [

                detailField("Decision", resolution.decision),

                detailField("Outcome", resolution.outcome),

                detailField("Decision Reason", resolution.reason),

                detailField("Decision Recorded By", resolution.decidedBy),

                detailField(

                    "Decision Date",

                    formatDateTime(resolution.decidedAt)

                ),

                detailField(

                    "Effective Date",

                    formatDateTime(resolution.effectiveAt)

                ),

                detailField("Closure Reason", resolution.closureReason)

            ]

        );


        /* APPEALS */

        const appealsSection = detailSection(

            "Appeal Information",

            [

                detailField(

                    "Appeal Status",

                    dispute.appeal?.status

                ),

                detailField(

                    "Appeal Reference",

                    dispute.appeal?.reference

                ),

                detailField(

                    "Appeal Submitted",

                    formatDateTime(dispute.appeal?.createdAt)

                ),

                detailField(

                    "Appeal Grounds",

                    dispute.appeal?.grounds

                )

            ]

        );


        /* PRIVACY */

        const privacySection = detailSection(

            "Privacy & Access Controls",

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

                    "Retention Status",

                    privacy.retentionStatus

                )

            ]

        );


        /* EVIDENCE */

        const evidenceSection = renderEvidence(

            dispute.evidence

        );


        /* HISTORY */

        const historySection = renderTimeline(

            dispute.history

        );


        [

            overview,

            claimantSection,

            respondentSection,

            claimSection,

            assignmentSection,

            mediationSection,

            resolutionSection,

            appealsSection,

            evidenceSection,

            privacySection,

            historySection

        ].forEach(section => {

            el.detailContent.append(section);

        });


        /* COMMUNICATION BUTTON */

        const communicationSection = detailSection(

            "Formal Communications",

            []

        );


        const communicationButton = createElement(

            "button",

            "disputes-view-button",

            "View Communication History"

        );


        communicationButton.type = "button";


        communicationButton.addEventListener(

            "click",

            () => openCommunications(dispute.id)

        );


        communicationSection.append(

            communicationButton

        );


        el.detailContent.append(

            communicationSection

        );


        state.selectedResourceType = "case";

        state.selectedCase = dispute;

        state.selectedAppeal = null;


        renderActions(dispute, "case");

    }


    /* ========================================================
       28. CASE DETAILS
       ======================================================== */

    async function openCaseDetails(id) {

        if (!state.authorized) return;


        const requestId = ++state.requests.detail;


        showNotice(

            "Retrieving dispute details..."

        );


        try {

            const dispute = await requestJSON(

                API.caseDetail(id)

            );


            if (

                requestId !== state.requests.detail ||

                !state.authorized

            ) {

                return;

            }


            if (

                !dispute ||

                dispute.id !== id ||

                !Object.hasOwn(STATUSES, dispute.status)

            ) {

                throw new Error(

                    "Invalid dispute detail response."

                );

            }


            state.previousFocus = document.activeElement;


            renderCaseDetails(dispute);


            el.detailOverlay.hidden = false;


            updateBodyScroll();


            el.detailClose.focus();


            showNotice(

                "Dispute details retrieved.",

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

                "The selected dispute could not be retrieved.",

                "error"

            );

        }

    }


    /* ========================================================
       29. APPEAL DETAIL
       ======================================================== */

    async function openAppealDetails(id) {

        if (!state.authorized) return;


        const requestId = ++state.requests.detail;


        try {

            const appeal = await requestJSON(

                API.appealDetail(id)

            );


            if (

                requestId !== state.requests.detail ||

                !state.authorized

            ) {

                return;

            }


            if (

                !appeal ||

                appeal.id !== id

            ) {

                throw new Error(

                    "Invalid appeal response."

                );

            }


            state.previousFocus = document.activeElement;


            state.selectedAppeal = appeal;

            state.selectedCase = null;

            state.selectedResourceType = "appeal";


            el.detailTitle.textContent =

                safeValue(appeal.reference);


            el.detailContent.replaceChildren();


            const sections = [

                detailSection(

                    "Appeal Overview",

                    [

                        detailField("Appeal Reference", appeal.reference),

                        detailField("Original Case", appeal.disputeReference),

                        detailField("Appeal Status", appeal.status),

                        detailField("Submitted By", appeal.submittedBy),

                        detailField("Submission Date", formatDateTime(appeal.createdAt)),

                        detailField("Due Date", formatDateTime(appeal.dueAt))

                    ]

                ),

                detailSection(

                    "Original Decision",

                    [

                        detailField("Original Decision", appeal.originalDecision),

                        detailField("Decision Date", formatDateTime(appeal.originalDecisionAt)),

                        detailField("Decision Maker", appeal.originalDecisionMaker)

                    ]

                ),

                detailSection(

                    "Appeal Grounds",

                    [

                        detailField("Grounds for Appeal", appeal.grounds),

                        detailField("Supporting Argument", appeal.argument),

                        detailField("Requested Outcome", appeal.requestedOutcome)

                    ]

                ),

                detailSection(

                    "Appeal Review",

                    [

                        detailField("Assigned Reviewer", appeal.assignee?.displayName),

                        detailField("Review Summary", appeal.review?.summary),

                        detailField("Findings", appeal.review?.findings),

                        detailField("Final Decision", appeal.decision?.outcome),

                        detailField("Decision Reason", appeal.decision?.reason),

                        detailField("Decision Date", formatDateTime(appeal.decision?.decidedAt))

                    ]

                ),

                renderTimeline(appeal.history)

            ];


            sections.forEach(section => {

                el.detailContent.append(section);

            });


            renderActions(appeal, "appeal");


            el.detailOverlay.hidden = false;


            updateBodyScroll();


            el.detailClose.focus();


        } catch (error) {

            if (requestId !== state.requests.detail) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            showNotice(

                "The selected appeal could not be retrieved.",

                "error"

            );

        }

    }


    /* ========================================================
       30. RENDER SERVER-AUTHORIZED ACTIONS
       ======================================================== */

    function renderActions(record, resourceType) {

        const available = Array.isArray(

            record.availableActions

        )

            ? record.availableActions

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

                "disputes-action-note",

                "Only actions authorized by the server are available. " +

                "All interventions require appropriate justification " +

                "and an auditable record."

            )

        );


        allowed.forEach(action => {

            const button = createElement(

                "button",

                [

                    "resolve",

                    "reject",

                    "reject_appeal",

                    "escalate",

                    "overturn_decision"

                ].includes(action)

                    ? "btn btn-danger"

                    : "btn btn-secondary",

                ACTIONS[action]

            );


            button.type = "button";


            button.addEventListener(

                "click",

                () => requestAction(action, resourceType)

            );


            fragment.append(button);

        });


        if (!allowed.length) {

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
       31. ADMINISTRATIVE ACTION REQUEST
       ======================================================== */

    function requestAction(action, resourceType) {

        if (

            !state.authorized ||

            state.actionInProgress ||

            !Object.hasOwn(ACTIONS, action)

        ) {

            return;

        }


        const record = resourceType === "appeal"

            ? state.selectedAppeal

            : state.selectedCase;


        if (

            !record ||

            !record.availableActions?.includes(action)

        ) {

            return;

        }


        state.pendingAction = {

            action,

            resourceType,

            resourceId: record.id

        };


        el.confirmTitle.textContent =

            "Confirm: " + ACTIONS[action];


        el.confirmDescription.textContent =

            ACTIONS[action] +

            ". " +

            ACTION_DESCRIPTIONS[action] +

            " Reference: " +

            safeValue(record.reference);


        el.reason.value = "";

        el.decision.value = "";


        el.assigneeField.hidden = true;

        el.decisionField.hidden =

            !DECISION_ACTIONS.includes(action);


        el.assigneeSelect.replaceChildren(

            new Option("Select authorized reviewer", "")

        );


        if (action === "assign") {

            const reviewers = record.availableReviewers;


            if (

                !Array.isArray(reviewers) ||

                !reviewers.length

            ) {

                showNotice(

                    "No authorized reviewers are available for assignment.",

                    "warning"

                );


                return;

            }


            reviewers.forEach(person => {

                if (

                    typeof person.id === "string" &&

                    person.id &&

                    typeof person.displayName === "string"

                ) {

                    el.assigneeSelect.append(

                        new Option(

                            person.displayName,

                            person.id

                        )

                    );

                }

            });


            el.assigneeField.hidden = false;

        }


        el.confirmSubmit.disabled = true;

        el.confirmCancel.disabled = false;


        el.confirmSubmit.textContent =

            "Confirm Action";


        state.previousFocus = document.activeElement;


        el.confirmOverlay.hidden = false;


        updateBodyScroll();


        el.reason.focus();

    }


    /* ========================================================
       32. CLOSE ACTION DIALOG
       ======================================================== */

    function closeConfirmation() {

        if (state.actionInProgress) return;


        el.confirmOverlay.hidden = true;


        state.pendingAction = null;


        el.reason.value = "";

        el.decision.value = "";


        el.assigneeField.hidden = true;

        el.decisionField.hidden = true;


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


        const pending = state.pendingAction;


        const reason = el.reason.value.trim();

        const decision = el.decision.value.trim();


        if (reason.length < 5) {

            showNotice(

                "Provide a meaningful administrative justification.",

                "warning"

            );


            el.reason.focus();


            return;

        }


        if (

            DECISION_ACTIONS.includes(pending.action) &&

            decision.length < 5

        ) {

            showNotice(

                "Provide the decision or resolution details.",

                "warning"

            );


            el.decision.focus();


            return;

        }


        const record = pending.resourceType === "appeal"

            ? state.selectedAppeal

            : state.selectedCase;


        if (

            !record ||

            record.id !== pending.resourceId ||

            !record.availableActions?.includes(pending.action)

        ) {

            showNotice(

                "The selected record or authorization has changed. Reload it before continuing.",

                "warning"

            );


            closeConfirmation();

            return;

        }


        const payload = {

            action: pending.action,

            reason,

            decision: decision || undefined

        };


        if (pending.action === "assign") {

            const assigneeId =

                el.assigneeSelect.value;


            if (!assigneeId) {

                showNotice(

                    "Select an authorized reviewer.",

                    "warning"

                );


                el.assigneeSelect.focus();


                return;

            }


            payload.assigneeId = assigneeId;

        }


        state.actionInProgress = true;


        el.confirmSubmit.disabled = true;

        el.confirmCancel.disabled = true;


        el.confirmSubmit.textContent =

            "Processing...";


        const endpoint = pending.resourceType === "appeal"

            ? API.appealAction(pending.resourceId)

            : API.caseAction(pending.resourceId);


        try {

            const result = await requestJSON(

                endpoint,

                {

                    method: "POST",

                    body: JSON.stringify(payload)

                }

            );


            if (!state.authorized) return;


            state.actionInProgress = false;


            el.confirmOverlay.hidden = true;


            state.pendingAction = null;


            closeAllPanels();


            showNotice(

                result?.message ||

                "The administrative action was accepted by the server.",

                "success"

            );


            state.filters.page = 1;


            await refreshAll();


        } catch (error) {

            if (!handleAuthorizationError(error)) {

                showNotice(

                    error.message ||

                    "The administrative action could not be completed.",

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
       34. APPEAL QUEUE
       ======================================================== */

    function renderAppeals(result) {

        if (

            !result ||

            !Array.isArray(result.items)

        ) {

            throw new Error(

                "Invalid appeal register response."

            );

        }


        const fragment =

            document.createDocumentFragment();


        result.items.forEach(appeal => {

            if (

                !appeal ||

                typeof appeal.id !== "string" ||

                !appeal.id

            ) {

                return;

            }


            const row = createElement("tr");


            row.append(

                createElement(

                    "td",

                    "disputes-reference",

                    safeValue(appeal.reference)

                ),

                createElement(

                    "td",

                    "",

                    safeValue(appeal.disputeReference)

                )

            );


            const statusCell = createElement("td");


            if (Object.hasOwn(STATUSES, appeal.status)) {

                statusCell.append(

                    statusBadge(appeal.status)

                );

            } else {

                statusCell.textContent = "—";

            }


            row.append(statusCell);


            row.append(

                createElement(

                    "td",

                    "",

                    formatDate(appeal.createdAt)

                )

            );


            const actionCell = createElement("td");


            const button = createElement(

                "button",

                "disputes-view-button",

                "Review Appeal"

            );


            button.type = "button";


            button.addEventListener(

                "click",

                () => openAppealDetails(appeal.id)

            );


            actionCell.append(button);


            row.append(actionCell);


            fragment.append(row);

        });


        if (!fragment.childNodes.length) {

            emptyAppeals();

        } else {

            el.appealTable.replaceChildren(fragment);


            el.appealCount.textContent =

                validCount(fragment.childNodes.length) +

                " appeals returned";

        }

    }


    async function loadAppeals() {

        if (!state.authorized) return;


        const requestId = ++state.requests.appeals;


        emptyAppeals();


        try {

            const result = await requestJSON(

                API.appeals + "?limit=10&status=pending"

            );


            if (

                requestId !== state.requests.appeals ||

                !state.authorized

            ) {

                return;

            }


            renderAppeals(result);


        } catch (error) {

            if (requestId !== state.requests.appeals) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            emptyAppeals();

        }

    }


    /* ========================================================
       35. ESCALATIONS
       ======================================================== */

    function renderEscalations(result) {

        if (

            !result ||

            !Array.isArray(result.items)

        ) {

            throw new Error(

                "Invalid escalation response."

            );

        }


        const fragment =

            document.createDocumentFragment();


        result.items.forEach(item => {

            if (

                !item ||

                typeof item.disputeId !== "string" ||

                !item.disputeId

            ) {

                return;

            }


            const row = createElement("tr");


            row.append(

                createElement(

                    "td",

                    "disputes-reference",

                    safeValue(item.reference)

                )

            );


            const priorityCell = createElement("td");


            priorityCell.append(

                priorityBadge(item.priority)

            );


            row.append(priorityCell);


            row.append(

                createElement(

                    "td",

                    "",

                    safeValue(item.reason)

                ),

                createElement(

                    "td",

                    "",

                    formatDate(item.escalatedAt)

                )

            );


            const actionCell = createElement("td");


            const button = createElement(

                "button",

                "disputes-view-button",

                "Review"

            );


            button.type = "button";


            button.addEventListener(

                "click",

                () => openCaseDetails(item.disputeId)

            );


            actionCell.append(button);


            row.append(actionCell);


            fragment.append(row);

        });


        if (!fragment.childNodes.length) {

            emptyEscalations();

        } else {

            el.escalationTable.replaceChildren(fragment);


            el.escalationCount.textContent =

                validCount(fragment.childNodes.length) +

                " escalations";

        }

    }


    async function loadEscalations() {

        if (!state.authorized) return;


        const requestId = ++state.requests.escalations;


        emptyEscalations();


        try {

            const result = await requestJSON(

                API.escalations + "?limit=10"

            );


            if (

                requestId !== state.requests.escalations ||

                !state.authorized

            ) {

                return;

            }


            renderEscalations(result);


        } catch (error) {

            if (requestId !== state.requests.escalations) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            emptyEscalations();

        }

    }


    /* ========================================================
       36. MEDIATION MANAGEMENT
       ======================================================== */

    function renderMediation(result) {

        if (

            !result ||

            !Array.isArray(result.items)

        ) {

            throw new Error(

                "Invalid mediation response."

            );

        }


        const fragment =

            document.createDocumentFragment();


        result.items.forEach(item => {

            if (

                !item ||

                typeof item.disputeId !== "string" ||

                !item.disputeId

            ) {

                return;

            }


            const row = createElement("tr");


            row.append(

                createElement(

                    "td",

                    "disputes-reference",

                    safeValue(item.reference)

                ),

                createElement(

                    "td",

                    "",

                    safeValue(item.partiesSummary)

                ),

                createElement(

                    "td",

                    "",

                    safeValue(item.mediator)

                ),

                createElement(

                    "td",

                    "",

                    formatDateTime(item.sessionAt)

                ),

                createElement(

                    "td",

                    "",

                    safeValue(item.status)

                ),

                createElement(

                    "td",

                    "",

                    safeValue(item.outcome)

                )

            );


            const actionCell = createElement("td");


            const button = createElement(

                "button",

                "disputes-view-button",

                "View Case"

            );


            button.type = "button";


            button.addEventListener(

                "click",

                () => openCaseDetails(item.disputeId)

            );


            actionCell.append(button);


            row.append(actionCell);


            fragment.append(row);

        });


        if (!fragment.childNodes.length) {

            emptyMediation();

        } else {

            el.mediationTable.replaceChildren(fragment);


            el.mediationCount.textContent =

                validCount(fragment.childNodes.length) +

                " mediation records";

        }

    }


    async function loadMediation() {

        if (!state.authorized) return;


        const requestId = ++state.requests.mediation;


        emptyMediation();


        try {

            const result = await requestJSON(

                API.mediation + "?limit=15"

            );


            if (

                requestId !== state.requests.mediation ||

                !state.authorized

            ) {

                return;

            }


            renderMediation(result);


        } catch (error) {

            if (requestId !== state.requests.mediation) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            emptyMediation();

        }

    }


    /* ========================================================
       37. REVIEWER ASSIGNMENTS
       ======================================================== */

    function renderAssignments(result) {

        if (

            !result ||

            !Array.isArray(result.items)

        ) {

            throw new Error(

                "Invalid reviewer assignment response."

            );

        }


        const fragment =

            document.createDocumentFragment();


        result.items.forEach(person => {

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

                    "disputes-title-text",

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


        if (!fragment.childNodes.length) {

            emptyAssignments();

        } else {

            el.assignmentTable.replaceChildren(fragment);


            el.assignmentCount.textContent =

                validCount(fragment.childNodes.length) +

                " reviewers";

        }

    }


    async function loadAssignments() {

        if (!state.authorized) return;


        const requestId = ++state.requests.assignments;


        emptyAssignments();


        try {

            const result = await requestJSON(

                API.assignments

            );


            if (

                requestId !== state.requests.assignments ||

                !state.authorized

            ) {

                return;

            }


            renderAssignments(result);


        } catch (error) {

            if (requestId !== state.requests.assignments) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            emptyAssignments();

        }

    }


    /* ========================================================
       38. DISPUTE ACTIVITY
       ======================================================== */

    function renderActivity(result) {

        if (

            !result ||

            !Array.isArray(result.items)

        ) {

            throw new Error(

                "Invalid dispute activity response."

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

                    "disputes-event-reference",

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

                    safeValue(event.disputeReference)

                ),

                createElement(

                    "td",

                    "",

                    safeValue(event.actor)

                ),

                createElement(

                    "td",

                    "disputes-event-description",

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


        if (!fragment.childNodes.length) {

            emptyActivity();

        } else {

            el.activityTable.replaceChildren(fragment);


            el.activityCount.textContent =

                validCount(fragment.childNodes.length) +

                " events returned";

        }

    }


    async function loadActivity() {

        if (!state.authorized) return;


        const requestId = ++state.requests.activity;


        emptyActivity();


        try {

            const result = await requestJSON(

                API.activity + "?limit=15"

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
       39. EXPORT DISPUTE REPORT
       ======================================================== */

    async function exportReport() {

        if (!state.authorized) return;


        const originalText =

            el.exportButton.textContent;


        el.exportButton.disabled = true;

        el.exportButton.textContent =

            "Preparing Report...";


        try {

            const result = await requestFile(

                API.export

            );


            if (!state.authorized) return;


            const objectURL = URL.createObjectURL(

                result.blob

            );


            const link = document.createElement("a");


            link.href = objectURL;


            const disposition =

                result.disposition || "";


            const match = disposition.match(

                /filename\*?=(?:UTF-8''|")?([^";\r\n]+)"?/i

            );


            let filename = match

                ? match[1]

                : "talvora-disputes-report.csv";


            try {

                filename = decodeURIComponent(filename);

            } catch {

                // Retain server filename.

            }


            filename = filename.replace(

                /[\\/:*?"<>|]/g,

                "_"

            );


            link.download = filename;


            document.body.append(link);

            link.click();

            link.remove();


            setTimeout(() => {

                URL.revokeObjectURL(objectURL);

            }, 1000);


            showNotice(

                "The authorized dispute report has been prepared.",

                "success"

            );


        } catch (error) {

            if (!handleAuthorizationError(error)) {

                showNotice(

                    error.message ||

                    "The dispute report could not be exported.",

                    "error"

                );

            }

        } finally {

            el.exportButton.disabled = false;

            el.exportButton.textContent = originalText;

        }

    }


    /* ========================================================
       40. STATUS TABS
       ======================================================== */

    function selectStatus(status) {

        const allowed = [

            "all",

            "submitted",

            "under_review",

            "awaiting_response",

            "mediation",

            "escalated",

            "appealed",

            "resolved",

            "closed"

        ];


        if (!allowed.includes(status)) return;


        state.filters.status = status;

        state.filters.page = 1;


        document.querySelectorAll(".disputes-tab")

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
       41. PAGINATION
       ======================================================== */

    function changePage(direction) {

        if (!state.authorized) return;


        const page = state.filters.page + direction;


        if (

            page < 1 ||

            page > state.filters.totalPages

        ) {

            return;

        }


        state.filters.page = page;


        loadCases();

    }


    /* ========================================================
       42. DRAWER MANAGEMENT
       ======================================================== */

    function closeCaseDetails() {

        state.requests.detail++;


        el.detailOverlay.hidden = true;


        state.selectedCase = null;

        state.selectedAppeal = null;

        state.selectedResourceType = null;


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


    function closeCommunications() {

        state.requests.communication++;


        el.communicationOverlay.hidden = true;


        el.communicationContent.replaceChildren();


        updateBodyScroll();


        restoreFocus();

    }


    function closeAllPanels() {

        el.detailOverlay.hidden = true;

        el.evidenceOverlay.hidden = true;

        el.communicationOverlay.hidden = true;


        el.detailContent.replaceChildren();

        el.detailActions.replaceChildren();

        el.evidenceContent.replaceChildren();

        el.communicationContent.replaceChildren();


        state.selectedCase = null;

        state.selectedAppeal = null;

        state.selectedEvidence = null;

        state.selectedResourceType = null;


        updateBodyScroll();

    }


    function updateBodyScroll() {

        const open =

            !el.detailOverlay.hidden ||

            !el.evidenceOverlay.hidden ||

            !el.communicationOverlay.hidden ||

            !el.confirmOverlay.hidden;


        document.body.style.overflow =

            open ? "hidden" : "";

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
       43. SIDEBAR
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
       44. REFRESH ALL MODULE DATA
       ======================================================== */

    async function refreshAll() {

        if (!state.authorized) return;


        showNotice(

            "Refreshing dispute, appeal, mediation and review information..."

        );


        await Promise.all([

            loadSummary(),

            loadCases(),

            loadAppeals(),

            loadEscalations(),

            loadMediation(),

            loadAssignments(),

            loadActivity()

        ]);


        if (!state.authorized) return;


        showNotice(

            "Dispute management data refresh completed.",

            "success"

        );

    }


    /* ========================================================
       45. EVENT REGISTRATION
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


        /* FILTER FORM */

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

                el.typeFilter.value = "";

                el.priorityFilter.value = "";

                el.partyFilter.value = "";

                el.sort.value = "newest";


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

            document.querySelectorAll(".disputes-tab")

        );


        tabs.forEach((button, index) => {

            button.addEventListener(

                "click",

                () => selectStatus(button.dataset.status)

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


        el.communicationClose.addEventListener(

            "click",

            closeCommunications

        );


        /* DRAWER BACKDROPS */

        [

            [el.detailOverlay, closeCaseDetails],

            [el.evidenceOverlay, closeEvidenceRegister],

            [el.communicationOverlay, closeCommunications]

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


        /* ACTION INPUT VALIDATION */

        [

            el.reason,

            el.decision

        ].forEach(field => {

            field.addEventListener(

                "input",

                updateConfirmationState

            );

        });


        el.assigneeSelect.addEventListener(

            "change",

            updateConfirmationState

        );


        /* CONFIRMATION */

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

                } else if (!el.communicationOverlay.hidden) {

                    closeCommunications();

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
       46. CONFIRMATION VALIDATION
       ======================================================== */

    function updateConfirmationState() {

        if (

            !state.pendingAction ||

            !state.authorized

        ) {

            el.confirmSubmit.disabled = true;

            return;

        }


        const action = state.pendingAction.action;


        const reasonValid =

            el.reason.value.trim().length >= 5;


        const decisionValid =

            !DECISION_ACTIONS.includes(action) ||

            el.decision.value.trim().length >= 5;


        const assigneeValid =

            action !== "assign" ||

            Boolean(el.assigneeSelect.value);


        el.confirmSubmit.disabled =

            !reasonValid ||

            !decisionValid ||

            !assigneeValid;

    }


    /* ========================================================
       47. INITIALIZATION
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
       48. START MODULE
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
