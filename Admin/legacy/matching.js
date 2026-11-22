
/* ==========================================================
   TALVORA TECHNOLOGIES
   TALVORA GLOBAL — GSES SYSTEM 001

   INTELLIGENT MATCHING OVERSIGHT
   FILE: matching.js

   Production principles:
   - No demo records.
   - No fabricated matching scores.
   - No fake employees or vacancies.
   - No client-side authorization decisions.
   - No automatic employment decisions.
   - All administrative actions require server authorization.
   - All sensitive profile information is server-controlled.
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
            "/api/v1/admin/matching/summary",

        matches:
            "/api/v1/admin/matching",

        matchDetail: id =>
            "/api/v1/admin/matching/" +
            encodeURIComponent(id),

        matchAction: id =>
            "/api/v1/admin/matching/" +
            encodeURIComponent(id) +
            "/actions",

        employees:
            "/api/v1/admin/matching/unmatched-employees",

        employeeDetail: id =>
            "/api/v1/admin/matching/employees/" +
            encodeURIComponent(id),

        jobs:
            "/api/v1/admin/matching/unfilled-jobs",

        jobDetail: id =>
            "/api/v1/admin/matching/jobs/" +
            encodeURIComponent(id),

        history:
            "/api/v1/admin/matching/activity",

        export:
            "/api/v1/admin/matching/export"

    };


    /* ========================================================
       02. GENERAL CONFIGURATION
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

    const EXCEPTION_PAGE_SIZE = 10;


    /* ========================================================
       03. MATCH STATUS DEFINITIONS
       ======================================================== */

    const MATCH_STATUSES = {

        pending: "Pending Review",

        active: "Active",

        accepted: "Accepted",

        declined: "Declined",

        successful: "Successful",

        flagged: "Flagged",

        expired: "Expired",

        rejected: "Rejected",

        under_review: "Under Review",

        paused: "Paused",

        withdrawn: "Withdrawn",

        closed: "Closed"

    };


    const MATCH_ACTIONS = {

        request_review: "Request Further Review",

        flag: "Flag Match",

        clear_flag: "Clear Match Flag",

        pause: "Pause Recommendation",

        resume: "Resume Recommendation",

        rerun: "Request Reassessment",

        resolve_review: "Resolve Review"

    };


    const MATCH_ACTION_DESCRIPTIONS = {

        request_review:
            "Request an additional review of this matching recommendation.",

        flag:
            "Flag this matching record for administrative investigation.",

        clear_flag:
            "Clear the administrative flag following an appropriate review.",

        pause:
            "Pause this recommendation according to platform policy.",

        resume:
            "Request restoration of this recommendation, subject to current eligibility and authorization.",

        rerun:
            "Request a fresh matching assessment using the current authorized platform records.",

        resolve_review:
            "Record the resolution of the outstanding matching review."

    };


    /* ========================================================
       04. DOM REFERENCES
       ======================================================== */

    const el = {

        app: $("matching-app"),

        locked: $("matching-locked"),

        accessMessage: $("matching-access-message"),

        notice: $("matching-notice"),

        systemStatus: $("matching-system-status"),

        refresh: $("matching-refresh"),

        exportButton: $("matching-export"),


        filterForm: $("matching-filter-form"),

        search: $("matching-search"),

        scoreFilter: $("matching-score-filter"),

        locationFilter: $("matching-location-filter"),

        dateSort: $("matching-date-sort"),

        clearFilters: $("matching-clear-filters"),


        table: $("matching-table-body"),

        recordCount: $("matching-record-count"),

        pageInfo: $("matching-page-info"),

        previous: $("matching-prev"),

        next: $("matching-next"),


        unmatchedSearch: $("unmatched-employee-search"),

        unmatchedTable: $("unmatched-employee-body"),

        unmatchedCount: $("unmatched-employee-count"),

        unmatchedPageInfo: $("unmatched-employee-page-info"),

        unmatchedPrevious: $("unmatched-employee-prev"),

        unmatchedNext: $("unmatched-employee-next"),


        unfilledSearch: $("unfilled-job-search"),

        unfilledTable: $("unfilled-job-body"),

        unfilledCount: $("unfilled-job-count"),

        unfilledPageInfo: $("unfilled-job-page-info"),

        unfilledPrevious: $("unfilled-job-prev"),

        unfilledNext: $("unfilled-job-next"),


        historyTable: $("matching-history-body"),

        historyCount: $("matching-history-count"),


        matchOverlay: $("matching-detail-overlay"),

        matchTitle: $("matching-detail-title"),

        matchClose: $("matching-detail-close"),

        matchContent: $("matching-detail-content"),

        matchActions: $("matching-detail-actions"),


        employeeOverlay: $("matching-employee-overlay"),

        employeeTitle: $("matching-employee-title"),

        employeeClose: $("matching-employee-close"),

        employeeContent: $("matching-employee-content"),


        jobOverlay: $("matching-job-overlay"),

        jobTitle: $("matching-job-title"),

        jobClose: $("matching-job-close"),

        jobContent: $("matching-job-content"),


        confirmOverlay: $("matching-confirm-overlay"),

        confirmTitle: $("matching-confirm-title"),

        confirmDescription: $("matching-confirm-description"),

        confirmReason: $("matching-action-reason"),

        confirmCancel: $("matching-confirm-cancel"),

        confirmSubmit: $("matching-confirm-submit")

    };


    /* ========================================================
       05. METRIC REFERENCES
       ======================================================== */

    const METRICS = {

        total: "metric-matches-total",

        high: "metric-matches-high",

        pending: "metric-matches-pending",

        active: "metric-matches-active",

        unmatchedEmployees: "metric-matches-unmatched-employees",

        unfilledJobs: "metric-matches-unfilled-jobs",

        successful: "metric-matches-successful",

        flagged: "metric-matches-flagged"

    };


    /* ========================================================
       06. APPLICATION STATE
       ======================================================== */

    const state = {

        authorized: false,

        csrfToken: null,


        matches: {

            status: "all",

            page: 1,

            totalPages: 0,

            search: "",

            score: "",

            location: "",

            sort: "newest"

        },


        unmatched: {

            page: 1,

            totalPages: 0,

            search: ""

        },


        unfilled: {

            page: 1,

            totalPages: 0,

            search: ""

        },


        selectedMatch: null,

        selectedEmployee: null,

        selectedJob: null,


        pendingAction: null,

        actionInProgress: false,


        activeDialog: null,

        previousFocus: null,


        requests: {

            summary: 0,

            matches: 0,

            matchDetail: 0,

            unmatched: 0,

            employeeDetail: 0,

            unfilled: 0,

            jobDetail: 0,

            history: 0

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

            "matching-notice " + type;


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

            "matching-empty"

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


    function emptyMatches(title, description) {

        showEmptyTable(

            el.table,

            9,

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


    function emptyUnmatched(title, description) {

        showEmptyTable(

            el.unmatchedTable,

            5,

            title,

            description

        );


        el.unmatchedCount.textContent =

            "Unavailable";


        el.unmatchedPageInfo.textContent =

            "No records available";


        el.unmatchedPrevious.disabled = true;

        el.unmatchedNext.disabled = true;

    }


    function emptyUnfilled(title, description) {

        showEmptyTable(

            el.unfilledTable,

            5,

            title,

            description

        );


        el.unfilledCount.textContent =

            "Unavailable";


        el.unfilledPageInfo.textContent =

            "No records available";


        el.unfilledPrevious.disabled = true;

        el.unfilledNext.disabled = true;

    }


    function emptyHistory() {

        showEmptyTable(

            el.historyTable,

            6,

            "",

            "Matching activity records are unavailable."

        );


        el.historyCount.textContent =

            "Records unavailable";

    }


    /* ========================================================
       09. SCREEN MANAGEMENT
       ======================================================== */

    function showApplication() {

        el.locked.hidden = true;

        el.app.hidden = false;

    }


    function invalidateRequests() {

        Object.keys(state.requests).forEach(key => {

            state.requests[key]++;

        });

    }


    function showLocked(message) {

        state.authorized = false;

        state.csrfToken = null;


        invalidateRequests();


        closeAllDrawers();


        el.app.hidden = true;

        el.locked.hidden = false;

        el.accessMessage.textContent = message;

    }


    function enterLocalPreview() {

        state.authorized = false;


        showApplication();


        setConnection("Frontend Preview");


        showNotice(

            "Local frontend preview only. No matching engine, " +

            "employee records, employer vacancies, compatibility " +

            "scores or administrative actions are connected.",

            "warning"

        );


        emptyMatches(

            "No matching records connected",

            "Real matching recommendations will appear after " +

            "the authorized matching service is implemented."

        );


        emptyUnmatched(

            "No employee records connected",

            "Real unmatched employee records will appear after " +

            "the matching service is connected."

        );


        emptyUnfilled(

            "No vacancy records connected",

            "Real unfilled vacancies will appear after " +

            "the matching service is connected."

        );


        emptyHistory();

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

                "The matching service is currently unavailable."

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


    async function requestFile(url) {

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

                "The matching report service is unavailable."

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

                "The matching report could not be exported."

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

                "Your Super Admin session is no longer authorized. " +

                "Please sign in again."

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

            el.scoreFilter,

            el.locationFilter,

            el.dateSort,

            el.clearFilters,

            $("matching-apply-filters"),

            el.unmatchedSearch,

            el.unfilledSearch

        ].forEach(control => {

            if (control) {

                control.disabled = false;

            }

        });

    }


    /* ========================================================
       12. SUMMARY STATISTICS
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

                    "Invalid matching summary response."

                );

            }


            const metrics = result.metrics;


            setText(

                METRICS.total,

                validCount(metrics.total)

            );


            setText(

                METRICS.high,

                validCount(metrics.highCompatibility)

            );


            setText(

                METRICS.pending,

                validCount(metrics.pendingReview)

            );


            setText(

                METRICS.active,

                validCount(metrics.active)

            );


            setText(

                METRICS.unmatchedEmployees,

                validCount(metrics.unmatchedEmployees)

            );


            setText(

                METRICS.unfilledJobs,

                validCount(metrics.unfilledJobs)

            );


            setText(

                METRICS.successful,

                validCount(metrics.successfulOutcomes)

            );


            setText(

                METRICS.flagged,

                validCount(metrics.flagged)

            );


            /* PERFORMANCE */

            const performance = result.performance || {};


            setText(

                "performance-success-rate",

                validPercentage(performance.successRate)

            );


            setText(

                "performance-average-score",

                typeof performance.averageCompatibility === "number" &&

                    Number.isFinite(performance.averageCompatibility) &&

                    performance.averageCompatibility >= 0 &&

                    performance.averageCompatibility <= 100

                    ? performance.averageCompatibility.toFixed(1) + "%"

                    : "—"

            );


            setText(

                "performance-processing-time",

                typeof performance.averageProcessingTimeMs === "number" &&

                    Number.isFinite(performance.averageProcessingTimeMs) &&

                    performance.averageProcessingTimeMs >= 0

                    ? performance.averageProcessingTimeMs.toFixed(0) + " ms"

                    : "—"

            );


            setText(

                "performance-acceptance-rate",

                validPercentage(performance.acceptanceRate)

            );


            setText(

                "performance-last-updated",

                formatDateTime(result.updatedAt)

            );


            /* ENGINE */

            const engine = result.engine || {};


            const engineStatus =

                typeof engine.status === "string"

                    ? engine.status

                    : "unavailable";


            const engineIndicator = document.querySelector(

                ".engine-status-indicator"

            );


            engineIndicator.className =

                "engine-status-indicator";


            if (engineStatus === "connected") {

                engineIndicator.classList.add("connected");

            } else if (engineStatus === "degraded") {

                engineIndicator.classList.add("degraded");

            } else if (engineStatus === "error") {

                engineIndicator.classList.add("error");

            }


            setText(

                "matching-engine-status",

                engine.label || "Data unavailable"

            );


            setText(

                "matching-engine-description",

                engine.description ||

                "No engine description is available."

            );


            setText(

                "matching-engine-version",

                engine.version

            );


            setText(

                "matching-engine-last-run",

                formatDateTime(engine.lastSuccessfulRun)

            );


            setText(

                "matching-engine-queue",

                validCount(engine.pendingProcessing)

            );


            setText(

                "matching-engine-failed",

                validCount(engine.failedProcessing)

            );


            /* FAIRNESS */

            const fairness = result.fairness || {};


            setText(

                "fairness-monitoring-status",

                fairness.monitoringStatus || "Data unavailable"

            );


            setText(

                "fairness-explainability-status",

                fairness.explainabilityStatus || "Data unavailable"

            );


            setText(

                "fairness-integrity-status",

                fairness.integrityStatus || "Data unavailable"

            );


            setText(

                "fairness-alert-count",

                validCount(fairness.alertCount)

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

                "Matching statistics and engine information could not be retrieved.",

                "error"

            );

        }

    }


    /* ========================================================
       13. MATCH QUERY CONSTRUCTION
       ======================================================== */

    function buildMatchQuery() {

        const params = new URLSearchParams({

            page: String(state.matches.page),

            limit: String(PAGE_SIZE),

            status: state.matches.status,

            sort: state.matches.sort

        });


        if (state.matches.search) {

            params.set(

                "search",

                state.matches.search

            );

        }


        if (state.matches.score) {

            params.set(

                "scoreBand",

                state.matches.score

            );

        }


        if (state.matches.location) {

            params.set(

                "location",

                state.matches.location

            );

        }


        return params;

    }


    function applyMatchFilters() {

        state.matches.search =

            el.search.value.trim();


        state.matches.score =

            el.scoreFilter.value;


        state.matches.location =

            el.locationFilter.value.trim();


        state.matches.sort =

            el.dateSort.value;


        state.matches.page = 1;

    }


    /* ========================================================
       14. MATCH STATUS BADGES
       ======================================================== */

    function createMatchStatus(status) {

        return createElement(

            "span",

            "match-status " + status,

            MATCH_STATUSES[status] || "Unknown"

        );

    }


    /* ========================================================
       15. COMPATIBILITY SCORE DISPLAY
       ======================================================== */

    function createMatchScore(compatibility) {

        const score = compatibility?.score;

        const band = compatibility?.band;


        if (

            typeof score !== "number" ||

            !Number.isFinite(score) ||

            score < 0 ||

            score > 100

        ) {

            return createElement(

                "span",

                "match-score unavailable",

                "Unavailable"

            );

        }


        const validBands = [

            "high",

            "medium",

            "low"

        ];


        const className =

            validBands.includes(band)

                ? band

                : "";


        return createElement(

            "span",

            "match-score " + className,

            score.toFixed(1) + "%"

        );

    }


    /* ========================================================
       16. PAGINATION
       ======================================================== */

    function updatePagination(

        pagination,

        sectionState,

        countElement,

        pageElement,

        previousButton,

        nextButton,

        label

    ) {

        if (!pagination) {

            throw new Error(

                "Missing pagination information."

            );

        }


        const total = pagination.total;


        if (

            !Number.isSafeInteger(total) ||

            total < 0 ||

            !Number.isSafeInteger(pagination.totalPages) ||

            pagination.totalPages < 0

        ) {

            throw new Error(

                "Invalid pagination response."

            );

        }


        sectionState.totalPages =

            pagination.totalPages;


        countElement.textContent =

            validCount(total) + " " + label + " records";


        pageElement.textContent =

            pagination.totalPages > 0

                ? `Page ${sectionState.page} of ${pagination.totalPages}`

                : "No pages";


        previousButton.disabled =

            sectionState.page <= 1;


        nextButton.disabled =

            pagination.totalPages === 0 ||

            sectionState.page >= pagination.totalPages;

    }


    /* ========================================================
       17. RENDER MATCHING RECORDS
       ======================================================== */

    function renderMatches(result) {

        if (

            !result ||

            !Array.isArray(result.items) ||

            !result.pagination

        ) {

            throw new Error(

                "Invalid matching directory response."

            );

        }


        const fragment =

            document.createDocumentFragment();


        result.items.forEach(match => {

            if (

                !match ||

                typeof match.id !== "string" ||

                !match.id ||

                !Object.hasOwn(

                    MATCH_STATUSES,

                    match.status

                )

            ) {

                return;

            }


            const row = createElement("tr");


            /* MATCH REFERENCE */

            row.append(

                createElement(

                    "td",

                    "match-reference",

                    safeValue(match.reference)

                )

            );


            /* EMPLOYEE */

            const employeeCell = createElement("td");


            employeeCell.append(

                createElement(

                    "span",

                    "match-employee",

                    match.employee?.displayName || "—"

                ),

                createElement(

                    "span",

                    "match-secondary",

                    match.employee?.reference || ""

                )

            );


            row.append(employeeCell);


            /* JOB */

            const jobCell = createElement("td");


            jobCell.append(

                createElement(

                    "span",

                    "match-job",

                    match.job?.title || "—"

                ),

                createElement(

                    "span",

                    "match-secondary",

                    match.job?.reference || ""

                )

            );


            row.append(jobCell);


            /* EMPLOYER */

            row.append(

                createElement(

                    "td",

                    "match-employer",

                    match.employer?.name || "—"

                )

            );


            /* LOCATION */

            row.append(

                createElement(

                    "td",

                    "match-location",

                    match.location || "—"

                )

            );


            /* COMPATIBILITY */

            const scoreCell = createElement("td");


            scoreCell.append(

                createMatchScore(match.compatibility)

            );


            row.append(scoreCell);


            /* STATUS */

            const statusCell = createElement("td");


            statusCell.append(

                createMatchStatus(match.status)

            );


            row.append(statusCell);


            /* CREATED DATE */

            row.append(

                createElement(

                    "td",

                    "",

                    formatDate(match.createdAt)

                )

            );


            /* ACTION */

            const actionCell = createElement("td");


            const button = createElement(

                "button",

                "match-view-button",

                "View Details"

            );


            button.type = "button";


            button.addEventListener(

                "click",

                () => openMatchDetails(match.id)

            );


            actionCell.append(button);

            row.append(actionCell);


            fragment.append(row);

        });


        if (fragment.childNodes.length === 0) {

            emptyMatches(

                "No matching records found",

                "There are no matching records for the selected filters."

            );

        } else {

            el.table.replaceChildren(fragment);

        }


        updatePagination(

            result.pagination,

            state.matches,

            el.recordCount,

            el.pageInfo,

            el.previous,

            el.next,

            "matching"

        );

    }


    /* ========================================================
       18. LOAD MATCH DIRECTORY
       ======================================================== */

    async function loadMatches() {

        if (!state.authorized) return;


        const requestId = ++state.requests.matches;


        emptyMatches(

            "Loading matching records",

            "Retrieving authorized employee-to-job matching records..."

        );


        try {

            const query = buildMatchQuery();


            const result = await requestJSON(

                API.matches +

                "?" +

                query.toString()

            );


            if (

                requestId !== state.requests.matches ||

                !state.authorized

            ) {

                return;

            }


            renderMatches(result);


        } catch (error) {

            if (requestId !== state.requests.matches) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            emptyMatches(

                "Matching records unavailable",

                "The matching service could not provide the requested records."

            );


            showNotice(

                "The matching directory could not be loaded.",

                "error"

            );

        }

    }


    /* ========================================================
       19. DETAIL FIELD HELPERS
       ======================================================== */

    function detailField(label, value) {

        const wrapper = createElement(

            "div",

            "matching-detail-field"

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

            "matching-detail-section"

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
       20. MATCHING COMPATIBILITY BREAKDOWN
       ======================================================== */

    function renderBreakdown(components) {

        const section = createElement(

            "section",

            "matching-detail-section"

        );


        section.append(

            createElement(

                "h3",

                "",

                "Compatibility Breakdown"

            )

        );


        if (

            !Array.isArray(components) ||

            components.length === 0

        ) {

            section.append(

                createElement(

                    "p",

                    "",

                    "No component-level explanation is available."

                )

            );


            return section;

        }


        components.forEach(component => {

            if (

                !component ||

                typeof component.name !== "string" ||

                typeof component.score !== "number" ||

                !Number.isFinite(component.score) ||

                component.score < 0 ||

                component.score > 100

            ) {

                return;

            }


            const item = createElement(

                "div",

                "matching-breakdown-item"

            );


            const heading = createElement(

                "div",

                "matching-breakdown-heading"

            );


            heading.append(

                createElement(

                    "span",

                    "",

                    component.name

                ),

                createElement(

                    "strong",

                    "",

                    component.score.toFixed(1) + "%"

                )

            );


            const track = createElement(

                "div",

                "matching-breakdown-track"

            );


            const fill = createElement(

                "div",

                "matching-breakdown-fill"

            );


            fill.style.width = component.score + "%";


            track.append(fill);


            item.append(heading, track);


            if (component.explanation) {

                item.append(

                    createElement(

                        "p",

                        "matching-secondary",

                        component.explanation

                    )

                );

            }


            section.append(item);

        });


        return section;

    }


    /* ========================================================
       21. MATCH HISTORY TIMELINE
       ======================================================== */

    function renderTimeline(history) {

        const section = createElement(

            "section",

            "matching-detail-section"

        );


        section.append(

            createElement(

                "h3",

                "",

                "Matching History"

            )

        );


        if (!Array.isArray(history) || history.length === 0) {

            section.append(

                createElement(

                    "p",

                    "",

                    "No matching history is available."

                )

            );


            return section;

        }


        const timeline = createElement(

            "div",

            "matching-timeline"

        );


        history.forEach(event => {

            if (!event) return;


            const item = createElement(

                "div",

                "matching-timeline-item"

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
       22. MATCH DETAIL SECTIONS
       ======================================================== */

    function renderMatchDetails(match) {

        const employee = match.employee || {};

        const job = match.job || {};

        const employer = match.employer || {};

        const compatibility = match.compatibility || {};

        const explanation = match.explanation || {};


        el.matchTitle.textContent =

            safeValue(match.reference);


        el.matchContent.replaceChildren();


        const overview = detailSection(

            "Matching Overview",

            [

                detailField(

                    "Match Reference",

                    match.reference

                ),

                detailField(

                    "Matching Status",

                    MATCH_STATUSES[match.status]

                ),

                detailField(

                    "Created Date",

                    formatDateTime(match.createdAt)

                ),

                detailField(

                    "Last Updated",

                    formatDateTime(match.updatedAt)

                ),

                detailField(

                    "Recommendation Source",

                    match.source

                ),

                detailField(

                    "Flagged",

                    match.flagged === true ? "Yes" : "No"

                )

            ]

        );


        const employeeSection = detailSection(

            "Employee Information",

            [

                detailField(

                    "Employee Name",

                    employee.displayName

                ),

                detailField(

                    "Employee Reference",

                    employee.reference

                ),

                detailField(

                    "Employee Location",

                    employee.location

                ),

                detailField(

                    "Professional Category",

                    employee.professionalCategory

                )

            ]

        );


        const jobSection = detailSection(

            "Job & Employer Information",

            [

                detailField(

                    "Job Title",

                    job.title

                ),

                detailField(

                    "Job Reference",

                    job.reference

                ),

                detailField(

                    "Employer",

                    employer.name

                ),

                detailField(

                    "Employer Reference",

                    employer.reference

                ),

                detailField(

                    "Job Location",

                    job.location

                ),

                detailField(

                    "Employment Type",

                    job.employmentType

                )

            ]

        );


        const compatibilitySection = detailSection(

            "Overall Compatibility",

            [

                detailField(

                    "Engine Score",

                    typeof compatibility.score === "number" &&

                        Number.isFinite(compatibility.score) &&

                        compatibility.score >= 0 &&

                        compatibility.score <= 100

                        ? compatibility.score.toFixed(1) + "%"

                        : "Unavailable"

                ),

                detailField(

                    "Compatibility Band",

                    compatibility.band

                ),

                detailField(

                    "Scoring Method",

                    compatibility.method

                ),

                detailField(

                    "Scoring Version",

                    compatibility.version

                ),

                detailField(

                    "Assessment Timestamp",

                    formatDateTime(compatibility.calculatedAt)

                )

            ]

        );


        const explanationSection = detailSection(

            "Recommendation Explanation",

            [

                detailField(

                    "Recommendation Summary",

                    explanation.summary

                ),

                detailField(

                    "Relevant Skills",

                    explanation.relevantSkills

                ),

                detailField(

                    "Qualification Alignment",

                    explanation.qualificationAlignment

                ),

                detailField(

                    "Experience Alignment",

                    explanation.experienceAlignment

                ),

                detailField(

                    "Location Compatibility",

                    explanation.locationCompatibility

                ),

                detailField(

                    "Requirements Not Met",

                    explanation.requirementsNotMet

                ),

                detailField(

                    "Explanation Limitations",

                    explanation.limitations

                )

            ]

        );


        const breakdown = renderBreakdown(

            compatibility.components

        );


        const recruitmentSection = detailSection(

            "Recruitment Progress",

            [

                detailField(

                    "Employee Response",

                    match.employeeResponse

                ),

                detailField(

                    "Employer Response",

                    match.employerResponse

                ),

                detailField(

                    "Application Reference",

                    match.applicationReference

                ),

                detailField(

                    "Recruitment Outcome",

                    match.outcome

                ),

                detailField(

                    "Outcome Date",

                    formatDateTime(match.outcomeAt)

                )

            ]

        );


        const privacySection = detailSection(

            "Privacy & Access Controls",

            [

                detailField(

                    "Employee Profile Access",

                    match.privacy?.employeeProfileAccess

                ),

                detailField(

                    "Employer Profile Access",

                    match.privacy?.employerProfileAccess

                ),

                detailField(

                    "Consent Status",

                    match.privacy?.consentStatus

                ),

                detailField(

                    "Data Sharing Status",

                    match.privacy?.sharingStatus

                )

            ]

        );


        const history = renderTimeline(

            match.history

        );


        [

            overview,

            employeeSection,

            jobSection,

            compatibilitySection,

            explanationSection,

            breakdown,

            recruitmentSection,

            privacySection,

            history

        ].forEach(section => {

            el.matchContent.append(section);

        });


        renderMatchActions(match);

    }


    /* ========================================================
       23. MATCH ADMINISTRATIVE ACTIONS
       ======================================================== */

    function renderMatchActions(match) {

        const available = Array.isArray(

            match.availableActions

        )

            ? match.availableActions

            : [];


        const allowed = [

            ...new Set(

                available.filter(action =>

                    typeof action === "string" &&

                    Object.hasOwn(MATCH_ACTIONS, action)

                )

            )

        ];


        const fragment =

            document.createDocumentFragment();


        fragment.append(

            createElement(

                "p",

                "matching-action-note",

                "Only actions explicitly authorized by the server " +

                "for this record are available. All interventions " +

                "require a documented reason."

            )

        );


        allowed.forEach(action => {

            const danger = [

                "pause",

                "flag"

            ].includes(action);


            const positive = [

                "resume",

                "clear_flag",

                "resolve_review"

            ].includes(action);


            const button = createElement(

                "button",

                danger

                    ? "btn btn-danger"

                    : positive

                        ? "btn btn-success"

                        : "btn btn-secondary",

                MATCH_ACTIONS[action]

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


        el.matchActions.replaceChildren(fragment);

    }


    /* ========================================================
       24. OPEN MATCH DETAILS
       ======================================================== */

    async function openMatchDetails(id) {

        if (!state.authorized) return;


        const requestId = ++state.requests.matchDetail;


        showNotice(

            "Retrieving matching details..."

        );


        try {

            const match = await requestJSON(

                API.matchDetail(id)

            );


            if (

                requestId !== state.requests.matchDetail ||

                !state.authorized

            ) {

                return;

            }


            if (

                !match ||

                match.id !== id ||

                !Object.hasOwn(

                    MATCH_STATUSES,

                    match.status

                )

            ) {

                throw new Error(

                    "Invalid matching detail response."

                );

            }


            state.selectedMatch = match;


            state.previousFocus = document.activeElement;


            renderMatchDetails(match);


            el.matchOverlay.hidden = false;


            document.body.style.overflow = "hidden";


            el.matchClose.focus();


            showNotice(

                "Matching details retrieved.",

                "success"

            );


        } catch (error) {

            if (requestId !== state.requests.matchDetail) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            showNotice(

                "The selected matching record could not be retrieved.",

                "error"

            );

        }

    }


    /* ========================================================
       25. EXCEPTION QUERY
       ======================================================== */

    function buildExceptionQuery(sectionState) {

        const params = new URLSearchParams({

            page: String(sectionState.page),

            limit: String(EXCEPTION_PAGE_SIZE)

        });


        if (sectionState.search) {

            params.set(

                "search",

                sectionState.search

            );

        }


        return params;

    }


    /* ========================================================
       26. UNMATCHED EMPLOYEE DIRECTORY
       ======================================================== */

    function renderUnmatchedEmployees(result) {

        if (

            !result ||

            !Array.isArray(result.items) ||

            !result.pagination

        ) {

            throw new Error(

                "Invalid unmatched employee response."

            );

        }


        const fragment =

            document.createDocumentFragment();


        result.items.forEach(employee => {

            if (

                !employee ||

                typeof employee.id !== "string" ||

                !employee.id

            ) {

                return;

            }


            const row = createElement("tr");


            const nameCell = createElement("td");


            nameCell.append(

                createElement(

                    "span",

                    "match-employee",

                    employee.displayName || "—"

                ),

                createElement(

                    "span",

                    "match-secondary",

                    employee.reference || ""

                )

            );


            row.append(nameCell);


            row.append(

                createElement(

                    "td",

                    "",

                    safeValue(employee.skillProfileSummary)

                )

            );


            row.append(

                createElement(

                    "td",

                    "match-location",

                    safeValue(employee.location)

                )

            );


            row.append(

                createElement(

                    "td",

                    "",

                    formatDate(employee.lastReviewedAt)

                )

            );


            const actionCell = createElement("td");


            const button = createElement(

                "button",

                "match-view-button",

                "View"

            );


            button.type = "button";


            button.addEventListener(

                "click",

                () => openEmployeeDetails(employee.id)

            );


            actionCell.append(button);

            row.append(actionCell);


            fragment.append(row);

        });


        if (fragment.childNodes.length === 0) {

            emptyUnmatched(

                "No unmatched employees found",

                "No employee records match the current search."

            );

        } else {

            el.unmatchedTable.replaceChildren(fragment);

        }


        updatePagination(

            result.pagination,

            state.unmatched,

            el.unmatchedCount,

            el.unmatchedPageInfo,

            el.unmatchedPrevious,

            el.unmatchedNext,

            "employee"

        );

    }


    /* ========================================================
       27. LOAD UNMATCHED EMPLOYEES
       ======================================================== */

    async function loadUnmatchedEmployees() {

        if (!state.authorized) return;


        const requestId = ++state.requests.unmatched;


        emptyUnmatched(

            "Loading unmatched employees",

            "Retrieving authorized employee records..."

        );


        try {

            const query = buildExceptionQuery(

                state.unmatched

            );


            const result = await requestJSON(

                API.employees +

                "?" +

                query.toString()

            );


            if (

                requestId !== state.requests.unmatched ||

                !state.authorized

            ) {

                return;

            }


            renderUnmatchedEmployees(result);


        } catch (error) {

            if (requestId !== state.requests.unmatched) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            emptyUnmatched(

                "Employee records unavailable",

                "The unmatched employee service could not be reached."

            );

        }

    }


    /* ========================================================
       28. EMPLOYEE DETAIL DRAWER
       ======================================================== */

    async function openEmployeeDetails(id) {

        if (!state.authorized) return;


        const requestId = ++state.requests.employeeDetail;


        try {

            const employee = await requestJSON(

                API.employeeDetail(id)

            );


            if (

                requestId !== state.requests.employeeDetail ||

                !state.authorized

            ) {

                return;

            }


            if (

                !employee ||

                employee.id !== id

            ) {

                throw new Error(

                    "Invalid employee matching profile."

                );

            }


            state.selectedEmployee = employee;

            state.previousFocus = document.activeElement;


            el.employeeTitle.textContent =

                safeValue(employee.reference);


            el.employeeContent.replaceChildren();


            const profile = detailSection(

                "Employee Matching Profile",

                [

                    detailField(

                        "Employee Name",

                        employee.displayName

                    ),

                    detailField(

                        "Employee Reference",

                        employee.reference

                    ),

                    detailField(

                        "Professional Category",

                        employee.professionalCategory

                    ),

                    detailField(

                        "Location",

                        employee.location

                    ),

                    detailField(

                        "Availability",

                        employee.availability

                    ),

                    detailField(

                        "Profile Status",

                        employee.profileStatus

                    ),

                    detailField(

                        "Last Reviewed",

                        formatDateTime(employee.lastReviewedAt)

                    )

                ]

            );


            const skills = detailSection(

                "Skills & Qualifications",

                [

                    detailField(

                        "Skills Summary",

                        employee.skillsSummary

                    ),

                    detailField(

                        "Verified Qualifications",

                        employee.verifiedQualificationsSummary

                    ),

                    detailField(

                        "Assessment Summary",

                        employee.assessmentSummary

                    ),

                    detailField(

                        "Experience Summary",

                        employee.experienceSummary

                    )

                ]

            );


            const matching = detailSection(

                "Matching Activity",

                [

                    detailField(

                        "Current Suitable Matches",

                        employee.currentSuitableMatches

                    ),

                    detailField(

                        "Previous Matching Activity",

                        employee.previousMatchingActivity

                    ),

                    detailField(

                        "Matching Eligibility",

                        employee.matchingEligibility

                    ),

                    detailField(

                        "Reason for No Current Match",

                        employee.unmatchedReason

                    )

                ]

            );


            const privacy = detailSection(

                "Privacy & Consent",

                [

                    detailField(

                        "Profile Visibility",

                        employee.privacy?.profileVisibility

                    ),

                    detailField(

                        "Consent Status",

                        employee.privacy?.consentStatus

                    ),

                    detailField(

                        "Administrative Access",

                        employee.privacy?.adminAccessStatus

                    )

                ]

            );


            [

                profile,

                skills,

                matching,

                privacy

            ].forEach(section => {

                el.employeeContent.append(section);

            });


            el.employeeOverlay.hidden = false;


            document.body.style.overflow = "hidden";


            el.employeeClose.focus();


        } catch (error) {

            if (requestId !== state.requests.employeeDetail) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            showNotice(

                "Employee matching details could not be retrieved.",

                "error"

            );

        }

    }


    /* ========================================================
       29. UNFILLED JOB DIRECTORY
       ======================================================== */

    function renderUnfilledJobs(result) {

        if (

            !result ||

            !Array.isArray(result.items) ||

            !result.pagination

        ) {

            throw new Error(

                "Invalid unfilled job response."

            );

        }


        const fragment =

            document.createDocumentFragment();


        result.items.forEach(job => {

            if (

                !job ||

                typeof job.id !== "string" ||

                !job.id

            ) {

                return;

            }


            const row = createElement("tr");


            const titleCell = createElement("td");


            titleCell.append(

                createElement(

                    "span",

                    "match-job",

                    job.title || "—"

                ),

                createElement(

                    "span",

                    "match-secondary",

                    job.reference || ""

                )

            );


            row.append(titleCell);


            row.append(

                createElement(

                    "td",

                    "match-employer",

                    job.employer?.name || "—"

                )

            );


            row.append(

                createElement(

                    "td",

                    "match-location",

                    safeValue(job.location)

                )

            );


            row.append(

                createElement(

                    "td",

                    "",

                    formatDate(job.publishedAt)

                )

            );


            const actionCell = createElement("td");


            const button = createElement(

                "button",

                "match-view-button",

                "View"

            );


            button.type = "button";


            button.addEventListener(

                "click",

                () => openJobDetails(job.id)

            );


            actionCell.append(button);

            row.append(actionCell);


            fragment.append(row);

        });


        if (fragment.childNodes.length === 0) {

            emptyUnfilled(

                "No unfilled vacancies found",

                "No published vacancies match the current search."

            );

        } else {

            el.unfilledTable.replaceChildren(fragment);

        }


        updatePagination(

            result.pagination,

            state.unfilled,

            el.unfilledCount,

            el.unfilledPageInfo,

            el.unfilledPrevious,

            el.unfilledNext,

            "vacancy"

        );

    }


    /* ========================================================
       30. LOAD UNFILLED JOBS
       ======================================================== */

    async function loadUnfilledJobs() {

        if (!state.authorized) return;


        const requestId = ++state.requests.unfilled;


        emptyUnfilled(

            "Loading unfilled vacancies",

            "Retrieving authorized employer vacancy records..."

        );


        try {

            const query = buildExceptionQuery(

                state.unfilled

            );


            const result = await requestJSON(

                API.jobs +

                "?" +

                query.toString()

            );


            if (

                requestId !== state.requests.unfilled ||

                !state.authorized

            ) {

                return;

            }


            renderUnfilledJobs(result);


        } catch (error) {

            if (requestId !== state.requests.unfilled) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            emptyUnfilled(

                "Vacancy records unavailable",

                "The unfilled vacancy service could not be reached."

            );

        }

    }


    /* ========================================================
       31. JOB DETAIL DRAWER
       ======================================================== */

    async function openJobDetails(id) {

        if (!state.authorized) return;


        const requestId = ++state.requests.jobDetail;


        try {

            const job = await requestJSON(

                API.jobDetail(id)

            );


            if (

                requestId !== state.requests.jobDetail ||

                !state.authorized

            ) {

                return;

            }


            if (

                !job ||

                job.id !== id

            ) {

                throw new Error(

                    "Invalid vacancy response."

                );

            }


            state.selectedJob = job;

            state.previousFocus = document.activeElement;


            el.jobTitle.textContent =

                safeValue(job.reference);


            el.jobContent.replaceChildren();


            const overview = detailSection(

                "Vacancy Information",

                [

                    detailField(

                        "Job Title",

                        job.title

                    ),

                    detailField(

                        "Job Reference",

                        job.reference

                    ),

                    detailField(

                        "Employer",

                        job.employer?.name

                    ),

                    detailField(

                        "Employer Reference",

                        job.employer?.reference

                    ),

                    detailField(

                        "Location",

                        job.location

                    ),

                    detailField(

                        "Employment Type",

                        job.employmentType

                    ),

                    detailField(

                        "Publication Date",

                        formatDate(job.publishedAt)

                    ),

                    detailField(

                        "Vacancy Status",

                        job.status

                    )

                ]

            );


            const requirements = detailSection(

                "Job Requirements",

                [

                    detailField(

                        "Required Skills",

                        job.requirements?.skillsSummary

                    ),

                    detailField(

                        "Qualifications",

                        job.requirements?.qualificationsSummary

                    ),

                    detailField(

                        "Experience Requirements",

                        job.requirements?.experienceSummary

                    ),

                    detailField(

                        "Other Requirements",

                        job.requirements?.otherRequirements

                    )

                ]

            );


            const matching = detailSection(

                "Matching Activity",

                [

                    detailField(

                        "Suitable Candidates",

                        job.suitableCandidates

                    ),

                    detailField(

                        "Matching Eligibility",

                        job.matchingEligibility

                    ),

                    detailField(

                        "Reason for No Suitable Match",

                        job.unfilledReason

                    ),

                    detailField(

                        "Last Matching Run",

                        formatDateTime(job.lastMatchingRun)

                    )

                ]

            );


            [

                overview,

                requirements,

                matching

            ].forEach(section => {

                el.jobContent.append(section);

            });


            el.jobOverlay.hidden = false;


            document.body.style.overflow = "hidden";


            el.jobClose.focus();


        } catch (error) {

            if (requestId !== state.requests.jobDetail) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            showNotice(

                "Vacancy matching details could not be retrieved.",

                "error"

            );

        }

    }


    /* ========================================================
       32. MATCHING ACTIVITY HISTORY
       ======================================================== */

    function renderHistory(result) {

        if (

            !result ||

            !Array.isArray(result.items)

        ) {

            throw new Error(

                "Invalid matching activity response."

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

                    "matching-event-reference",

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

                    safeValue(event.relatedRecord)

                ),

                createElement(

                    "td",

                    "",

                    safeValue(event.actor)

                ),

                createElement(

                    "td",

                    "matching-event-description",

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

            emptyHistory();

        } else {

            el.historyTable.replaceChildren(fragment);

            el.historyCount.textContent =

                validCount(result.items.length) +

                " events returned";

        }

    }


    /* ========================================================
       33. LOAD MATCHING HISTORY
       ======================================================== */

    async function loadHistory() {

        if (!state.authorized) return;


        const requestId = ++state.requests.history;


        emptyHistory();


        try {

            const result = await requestJSON(

                API.history +

                "?limit=10"

            );


            if (

                requestId !== state.requests.history ||

                !state.authorized

            ) {

                return;

            }


            renderHistory(result);


        } catch (error) {

            if (requestId !== state.requests.history) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            emptyHistory();

        }

    }


    /* ========================================================
       34. ADMINISTRATIVE ACTION CONFIRMATION
       ======================================================== */

    function requestAction(action) {

        if (

            !state.authorized ||

            state.actionInProgress ||

            !state.selectedMatch

        ) {

            return;

        }


        if (

            !Object.hasOwn(MATCH_ACTIONS, action) ||

            !state.selectedMatch.availableActions?.includes(action)

        ) {

            return;

        }


        state.pendingAction = {

            matchId: state.selectedMatch.id,

            action

        };


        el.confirmTitle.textContent =

            "Confirm: " + MATCH_ACTIONS[action];


        el.confirmDescription.textContent =

            MATCH_ACTION_DESCRIPTIONS[action] +

            " Match reference: " +

            safeValue(state.selectedMatch.reference);


        el.confirmReason.value = "";


        el.confirmSubmit.disabled = true;


        el.confirmSubmit.textContent =

            "Confirm Action";


        el.confirmCancel.disabled = false;


        state.activeDialog = "confirmation";


        el.confirmOverlay.hidden = false;


        el.confirmReason.focus();

    }


    function closeConfirmation() {

        if (state.actionInProgress) return;


        el.confirmOverlay.hidden = true;


        state.pendingAction = null;

        state.activeDialog = null;


        el.confirmReason.value = "";


        restoreFocus();

    }


    /* ========================================================
       35. EXECUTE ADMINISTRATIVE ACTION
       ======================================================== */

    async function executeAdministrativeAction() {

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

                "Enter a meaningful administrative justification.",

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

            !state.selectedMatch ||

            state.selectedMatch.id !== pending.matchId

        ) {

            showNotice(

                "The selected matching record has changed. Reload it before continuing.",

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

                API.matchAction(pending.matchId),

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


            closeAllDrawers();


            showNotice(

                result?.message ||

                "The administrative intervention was accepted by the server.",

                "success"

            );


            state.matches.page = 1;


            await refreshAll();


        } catch (error) {

            if (!handleAuthorizationError(error)) {

                showNotice(

                    error.message ||

                    "The administrative intervention could not be completed.",

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
       36. EXPORT MATCHING REPORT
       ======================================================== */

    async function exportReport() {

        if (

            !state.authorized ||

            !el.exportButton

        ) {

            return;

        }


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


            const disposition = result.filename || "";


            const match = disposition.match(

                /filename\*?=(?:UTF-8''|")?([^";\r\n]+)"?/i

            );


            let filename = match

                ? match[1]

                : "talvora-matching-report.csv";


            try {

                filename = decodeURIComponent(filename);

            } catch {

                // Retain the returned filename.

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

                "The authorized matching report has been prepared.",

                "success"

            );


        } catch (error) {

            if (!handleAuthorizationError(error)) {

                showNotice(

                    error.message ||

                    "The matching report could not be exported.",

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

    function selectMatchStatus(status) {

        const allowed = [

            "all",

            "pending",

            "active",

            "accepted",

            "declined",

            "successful",

            "flagged",

            "expired"

        ];


        if (!allowed.includes(status)) return;


        state.matches.status = status;

        state.matches.page = 1;


        document.querySelectorAll(".matching-tab")

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


        loadMatches();

    }


    /* ========================================================
       38. PAGINATION HANDLERS
       ======================================================== */

    function changePage(section, direction) {

        if (!state.authorized) return;


        const sectionState = state[section];


        if (!sectionState) return;


        const nextPage =

            sectionState.page + direction;


        if (

            nextPage < 1 ||

            nextPage > sectionState.totalPages

        ) {

            return;

        }


        sectionState.page = nextPage;


        if (section === "matches") {

            loadMatches();

        } else if (section === "unmatched") {

            loadUnmatchedEmployees();

        } else if (section === "unfilled") {

            loadUnfilledJobs();

        }

    }


    /* ========================================================
       39. DRAWER MANAGEMENT
       ======================================================== */

    function closeMatchDetails() {

        state.requests.matchDetail++;


        el.matchOverlay.hidden = true;


        state.selectedMatch = null;


        el.matchContent.replaceChildren();

        el.matchActions.replaceChildren();


        updateBodyScroll();


        restoreFocus();

    }


    function closeEmployeeDetails() {

        state.requests.employeeDetail++;


        el.employeeOverlay.hidden = true;


        state.selectedEmployee = null;


        el.employeeContent.replaceChildren();


        updateBodyScroll();


        restoreFocus();

    }


    function closeJobDetails() {

        state.requests.jobDetail++;


        el.jobOverlay.hidden = true;


        state.selectedJob = null;


        el.jobContent.replaceChildren();


        updateBodyScroll();


        restoreFocus();

    }


    function closeAllDrawers() {

        el.matchOverlay.hidden = true;

        el.employeeOverlay.hidden = true;

        el.jobOverlay.hidden = true;


        el.matchContent.replaceChildren();

        el.matchActions.replaceChildren();

        el.employeeContent.replaceChildren();

        el.jobContent.replaceChildren();


        state.selectedMatch = null;

        state.selectedEmployee = null;

        state.selectedJob = null;


        updateBodyScroll();

    }


    function updateBodyScroll() {

        const anyOpen =

            !el.matchOverlay.hidden ||

            !el.employeeOverlay.hidden ||

            !el.jobOverlay.hidden ||

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
       41. REFRESH ALL MATCHING DATA
       ======================================================== */

    async function refreshAll() {

        if (!state.authorized) return;


        showNotice(

            "Refreshing matching, engine and recruitment information..."

        );


        await Promise.all([

            loadSummary(),

            loadMatches(),

            loadUnmatchedEmployees(),

            loadUnfilledJobs(),

            loadHistory()

        ]);


        if (state.authorized) {

            showNotice(

                "Matching oversight data refreshed.",

                "success"

            );

        }

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


        /* MATCH FILTERS */

        el.filterForm.addEventListener(

            "submit",

            event => {

                event.preventDefault();


                if (!state.authorized) return;


                applyMatchFilters();


                loadMatches();

            }

        );


        /* CLEAR FILTERS */

        el.clearFilters.addEventListener(

            "click",

            () => {

                el.search.value = "";

                el.scoreFilter.value = "";

                el.locationFilter.value = "";

                el.dateSort.value = "newest";


                applyMatchFilters();


                loadMatches();

            }

        );


        /* MATCH PAGINATION */

        el.previous.addEventListener(

            "click",

            () => changePage("matches", -1)

        );


        el.next.addEventListener(

            "click",

            () => changePage("matches", 1)

        );


        /* UNMATCHED EMPLOYEE SEARCH */

        el.unmatchedSearch.addEventListener(

            "input",

            () => {

                if (!state.authorized) return;


                state.unmatched.search =

                    el.unmatchedSearch.value.trim();


                state.unmatched.page = 1;


                loadUnmatchedEmployees();

            }

        );


        /* UNFILLED JOB SEARCH */

        el.unfilledSearch.addEventListener(

            "input",

            () => {

                if (!state.authorized) return;


                state.unfilled.search =

                    el.unfilledSearch.value.trim();


                state.unfilled.page = 1;


                loadUnfilledJobs();

            }

        );


        /* EXCEPTION PAGINATION */

        el.unmatchedPrevious.addEventListener(

            "click",

            () => changePage("unmatched", -1)

        );


        el.unmatchedNext.addEventListener(

            "click",

            () => changePage("unmatched", 1)

        );


        el.unfilledPrevious.addEventListener(

            "click",

            () => changePage("unfilled", -1)

        );


        el.unfilledNext.addEventListener(

            "click",

            () => changePage("unfilled", 1)

        );


        /* MATCH STATUS TABS */

        const tabs = Array.from(

            document.querySelectorAll(".matching-tab")

        );


        tabs.forEach((button, index) => {


            button.addEventListener(

                "click",

                () => {

                    selectMatchStatus(

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


                    selectMatchStatus(

                        tabs[target].dataset.status

                    );

                }

            );

        });


        /* DRAWER CLOSE BUTTONS */

        el.matchClose.addEventListener(

            "click",

            closeMatchDetails

        );


        el.employeeClose.addEventListener(

            "click",

            closeEmployeeDetails

        );


        el.jobClose.addEventListener(

            "click",

            closeJobDetails

        );


        /* CLOSE DRAWERS ON BACKDROP */

        [

            [el.matchOverlay, closeMatchDetails],

            [el.employeeOverlay, closeEmployeeDetails],

            [el.jobOverlay, closeJobDetails]

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


        /* CONFIRMATION REASON */

        el.confirmReason.addEventListener(

            "input",

            () => {

                el.confirmSubmit.disabled =

                    el.confirmReason.value.trim().length < 5 ||

                    !state.authorized;

            }

        );


        /* CONFIRMATION */

        el.confirmCancel.addEventListener(

            "click",

            closeConfirmation

        );


        el.confirmSubmit.addEventListener(

            "click",

            executeAdministrativeAction

        );


        /* KEYBOARD ACCESS */

        document.addEventListener(

            "keydown",

            event => {

                if (event.key !== "Escape") return;


                if (!el.confirmOverlay.hidden) {

                    closeConfirmation();

                } else if (!el.matchOverlay.hidden) {

                    closeMatchDetails();

                } else if (!el.employeeOverlay.hidden) {

                    closeEmployeeDetails();

                } else if (!el.jobOverlay.hidden) {

                    closeJobDetails();

                } else {

                    closeSidebar();

                }

            }

        );

    }


    /* ========================================================
       43. INITIALIZATION AND AUTHORIZATION
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
