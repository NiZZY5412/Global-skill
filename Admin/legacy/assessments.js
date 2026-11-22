
/* ==========================================================
   TALVORA TECHNOLOGIES
   TALVORA GLOBAL — GSES SYSTEM 001

   ASSESSMENTS MANAGEMENT
   FILE: assessments.js

   No demo records.
   No fabricated assessment results.
   No fake employee records.
   All production records come from authorized APIs.
   ========================================================== */

(() => {
    "use strict";


    /* ========================================================
       01. CONFIGURATION
       ======================================================== */

    const API = {

        session: "/api/v1/auth/session",

        summary: "/api/v1/admin/assessments/summary",

        assessments: "/api/v1/admin/assessments",

        detail: id =>
            "/api/v1/admin/assessments/" +
            encodeURIComponent(id),

        action: id =>
            "/api/v1/admin/assessments/" +
            encodeURIComponent(id) + "/actions"

    };


    const $ = id => document.getElementById(id);


    const LOCAL_HOSTS = [
        "localhost",
        "127.0.0.1",
        "::1"
    ];


    const IS_LOCAL =
        location.protocol === "file:" ||
        LOCAL_HOSTS.includes(location.hostname);


    /* ========================================================
       02. SUPPORTED STATUS VALUES
       ======================================================== */

    const STATUS_LABELS = {

        scheduled: "Scheduled",

        in_progress: "In Progress",

        submitted: "Submitted",

        under_review: "Under Review",

        verified: "Verified",

        flagged: "Flagged",

        closed: "Closed",

        cancelled: "Cancelled",

        expired: "Expired",

        invalidated: "Invalidated"

    };


    const TYPE_LABELS = {

        skills: "Skills Assessment",

        competency: "Competency Assessment",

        technical: "Technical Assessment",

        practical: "Practical Assessment",

        knowledge: "Knowledge Assessment",

        language: "Language Assessment",

        other: "Other"

    };


    const OUTCOME_LABELS = {

        passed: "Passed",

        failed: "Not Passed",

        pending: "Pending",

        not_available: "Unavailable"

    };


    /* ========================================================
       03. ADMINISTRATIVE ACTIONS
       ======================================================== */

    const ACTION_LABELS = {

        verify_result: "Verify Results",

        mark_under_review: "Mark Under Review",

        flag: "Flag Assessment",

        clear_flag: "Clear Flag",

        invalidate: "Invalidate Assessment",

        reopen: "Reopen Assessment",

        cancel: "Cancel Assessment",

        close: "Close Assessment"

    };


    const ACTION_DESCRIPTIONS = {

        verify_result:
            "Confirm that the assessment result has been reviewed and verified.",

        mark_under_review:
            "Move this assessment into the review process.",

        flag:
            "Flag this assessment for an administrative integrity investigation.",

        clear_flag:
            "Clear the administrative flag following an appropriate investigation.",

        invalidate:
            "Invalidate this assessment record under the applicable platform policy.",

        reopen:
            "Request reopening of this assessment under the applicable platform policy.",

        cancel:
            "Cancel this assessment according to the applicable platform policy.",

        close:
            "Close this assessment record according to the applicable platform policy."

    };


    /* ========================================================
       04. DOM REFERENCES
       ======================================================== */

    const el = {

        app: $("assessments-app"),

        locked: $("assessments-locked"),

        accessMessage: $("assessments-access-message"),

        notice: $("assessments-notice"),

        systemStatus: $("assessments-system-status"),

        refresh: $("assessments-refresh"),


        search: $("assessment-search"),

        type: $("assessment-type"),

        dateSort: $("assessment-date-sort"),

        flaggedOnly: $("assessment-flagged-only"),

        filterForm: $("assessments-filter-form"),

        clearFilters: $("assessments-clear-filters"),


        tableBody: $("assessments-table-body"),

        recordCount: $("assessments-record-count"),

        pageInfo: $("assessments-page-info"),

        previous: $("assessments-prev"),

        next: $("assessments-next"),


        detailOverlay: $("assessment-detail-overlay"),

        detailTitle: $("assessment-detail-title"),

        detailClose: $("assessment-detail-close"),

        detailContent: $("assessment-detail-content"),

        detailActions: $("assessment-detail-actions"),


        confirmOverlay: $("assessment-confirm-overlay"),

        confirmTitle: $("assessment-confirm-title"),

        confirmDescription: $("assessment-confirm-description"),

        confirmReason: $("assessment-action-reason"),

        confirmCancel: $("assessment-confirm-cancel"),

        confirmSubmit: $("assessment-confirm-submit")

    };


    /* ========================================================
       05. APPLICATION STATE
       ======================================================== */

    const state = {

        authorized: false,

        csrfToken: null,

        status: "all",

        page: 1,

        pageSize: 20,

        totalPages: 0,


        search: "",

        assessmentType: "",

        dateSort: "newest",

        flaggedOnly: false,


        selectedAssessment: null,

        pendingAction: null,

        actionInProgress: false,


        listRequest: 0,

        summaryRequest: 0,

        detailRequest: 0

    };


    /* ========================================================
       06. STATISTICS REFERENCES
       ======================================================== */

    const METRICS = {

        total: "metric-assessments-total",

        scheduled: "metric-assessments-scheduled",

        progress: "metric-assessments-progress",

        submitted: "metric-assessments-submitted",

        review: "metric-assessments-review",

        verified: "metric-assessments-verified",

        flagged: "metric-assessments-flagged",

        alerts: "metric-assessments-alerts"

    };


    /* ========================================================
       07. SAFE DOM HELPERS
       ======================================================== */

    function createElement(tag, className = "", value = null) {

        const element = document.createElement(tag);

        if (className) {

            element.className = className;

        }

        if (value !== null && value !== undefined) {

            element.textContent = String(value);

        }

        return element;

    }


    function setText(id, value) {

        const element = $(id);

        if (element) {

            element.textContent = String(value);

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

            "assessments-notice " + type;

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

    function showEmptyTable(title, description) {

        const row = createElement("tr");

        const cell = createElement("td");

        const empty = createElement(
            "div",
            "assessments-empty"
        );

        cell.colSpan = 9;

        empty.append(

            createElement("h4", "", title),

            createElement("p", "", description)

        );

        cell.append(empty);

        row.append(cell);

        el.tableBody.replaceChildren(row);

        el.recordCount.textContent = "Records unavailable";

        el.pageInfo.textContent = "No records available";

        el.previous.disabled = true;

        el.next.disabled = true;

    }


    /* ========================================================
       09. SCREEN MANAGEMENT
       ======================================================== */

    function showApplication() {

        el.locked.hidden = true;

        el.app.hidden = false;

    }


    function showLocked(message) {

        state.authorized = false;

        state.csrfToken = null;

        state.listRequest++;

        state.summaryRequest++;

        state.detailRequest++;

        el.app.hidden = true;

        el.locked.hidden = false;

        el.accessMessage.textContent = message;

        closeDetails();

    }


    function enterLocalPreview() {

        state.authorized = false;

        showApplication();

        setConnection("Frontend Preview");

        showNotice(

            "Local frontend preview only. No assessment records, " +

            "employee results or administrative actions are connected.",

            "warning"

        );

        showEmptyTable(

            "No assessment records connected",

            "Real assessment records will appear here after the " +

            "authorized backend service is implemented."

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

                    "A valid security token is required for this action."

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

                "The assessment management service is unavailable."

            );

        }


        if (

            response.status === 401 ||

            response.status === 403

        ) {

            const error = new Error(

                "Administrator authorization failed."

            );

            error.status = response.status;

            throw error;

        }


        if (!response.ok) {

            let message =

                "The request could not be completed.";


            try {

                const result = await response.json();

                if (typeof result.message === "string") {

                    message = result.message;

                }

            } catch {

                // Retain the general error.

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
       11. LOAD ASSESSMENT SUMMARY
       ======================================================== */

    async function loadSummary() {

        const requestId = ++state.summaryRequest;

        clearMetrics();


        try {

            const result = await requestJSON(API.summary);


            if (

                requestId !== state.summaryRequest ||

                !state.authorized

            ) {

                return;

            }


            if (!result || !result.metrics) {

                throw new Error(

                    "Invalid assessment summary response."

                );

            }


            const metrics = result.metrics;


            setText(

                METRICS.total,

                validCount(metrics.total)

            );


            setText(

                METRICS.scheduled,

                validCount(metrics.scheduled)

            );


            setText(

                METRICS.progress,

                validCount(metrics.inProgress)

            );


            setText(

                METRICS.submitted,

                validCount(metrics.submitted)

            );


            setText(

                METRICS.review,

                validCount(metrics.underReview)

            );


            setText(

                METRICS.verified,

                validCount(metrics.verified)

            );


            setText(

                METRICS.flagged,

                validCount(metrics.flagged)

            );


            setText(

                METRICS.alerts,

                validCount(metrics.integrityAlerts)

            );


        } catch (error) {

            if (requestId !== state.summaryRequest) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            clearMetrics();

            showNotice(

                "Assessment statistics could not be retrieved.",

                "error"

            );

        }

    }


    /* ========================================================
       12. FILTER CONSTRUCTION
       ======================================================== */

    function buildQuery() {

        const params = new URLSearchParams({

            page: String(state.page),

            limit: String(state.pageSize),

            status: state.status,

            sort: state.dateSort

        });


        if (state.search) {

            params.set(

                "search",

                state.search

            );

        }


        if (state.assessmentType) {

            params.set(

                "type",

                state.assessmentType

            );

        }


        if (state.flaggedOnly) {

            params.set(

                "flagged",

                "true"

            );

        }


        return params;

    }


    function applyFilterValues() {

        state.search = el.search.value.trim();

        state.assessmentType = el.type.value;

        state.dateSort = el.dateSort.value;

        state.flaggedOnly = el.flaggedOnly.checked;

        state.page = 1;

    }


    function enableFilters() {

        [

            el.search,

            el.type,

            el.dateSort,

            el.flaggedOnly,

            el.refresh,

            el.clearFilters,

            $("assessments-apply-filters")

        ].forEach(control => {

            control.disabled = false;

        });

    }


    /* ========================================================
       13. STATUS BADGE
       ======================================================== */

    function createStatusBadge(status) {

        const label =

            STATUS_LABELS[status] || "Unknown";


        return createElement(

            "span",

            "assessment-status " + status,

            label

        );

    }


    /* ========================================================
       14. RESULT DISPLAY
       ======================================================== */

    function createResultDisplay(assessment) {

        const result = assessment.result;


        if (

            assessment.resultSummaryAllowed !== true ||

            !result

        ) {

            return createElement(

                "span",

                "assessment-outcome not_available",

                "Restricted"

            );

        }


        if (

            result.outcome &&

            Object.hasOwn(OUTCOME_LABELS, result.outcome)

        ) {

            return createElement(

                "span",

                "assessment-outcome " + result.outcome,

                OUTCOME_LABELS[result.outcome]

            );

        }


        if (result.status === "pending") {

            return createElement(

                "span",

                "assessment-outcome pending",

                "Pending"

            );

        }


        return createElement(

            "span",

            "assessment-outcome not_available",

            "Not available"

        );

    }


    /* ========================================================
       15. ASSESSMENT TABLE
       ======================================================== */

    function renderAssessments(result) {

        if (

            !result ||

            !Array.isArray(result.items) ||

            !result.pagination

        ) {

            throw new Error(

                "Invalid assessment directory response."

            );

        }


        const fragment =

            document.createDocumentFragment();


        for (const assessment of result.items) {


            if (

                !assessment ||

                typeof assessment.id !== "string" ||

                !assessment.id ||

                !Object.hasOwn(

                    STATUS_LABELS,

                    assessment.status

                )

            ) {

                continue;

            }


            const row = createElement("tr");


            /* ASSESSMENT REFERENCE */

            row.append(

                createElement(

                    "td",

                    "assessment-reference",

                    safeValue(assessment.reference)

                )

            );


            /* EMPLOYEE */

            const employeeCell = createElement("td");


            employeeCell.append(

                createElement(

                    "span",

                    "assessment-employee",

                    assessment.employee?.displayName || "—"

                ),

                createElement(

                    "span",

                    "assessment-secondary",

                    assessment.employee?.reference || ""

                )

            );


            row.append(employeeCell);


            /* ASSESSMENT NAME */

            const nameCell = createElement("td");


            nameCell.append(

                createElement(

                    "span",

                    "assessment-name",

                    assessment.title || "—"

                ),

                createElement(

                    "span",

                    "assessment-secondary",

                    assessment.assessmentReference || ""

                )

            );


            row.append(nameCell);


            /* TYPE */

            row.append(

                createElement(

                    "td",

                    "",

                    TYPE_LABELS[assessment.type] ||

                    "Other"

                )

            );


            /* DATE */

            row.append(

                createElement(

                    "td",

                    "",

                    formatDate(

                        assessment.scheduledAt ||

                        assessment.submittedAt ||

                        assessment.createdAt

                    )

                )

            );


            /* RESULT */

            const resultCell = createElement("td");

            resultCell.append(

                createResultDisplay(assessment)

            );

            row.append(resultCell);


            /* STATUS */

            const statusCell = createElement("td");

            statusCell.append(

                createStatusBadge(assessment.status)

            );

            row.append(statusCell);


            /* FLAG */

            const flagCell = createElement("td");


            if (assessment.flagged === true) {

                flagCell.append(

                    createElement(

                        "span",

                        "assessment-flag-indicator",

                        "Flagged"

                    )

                );

            } else {

                flagCell.append(

                    createElement(

                        "span",

                        "assessment-no-flag",

                        "—"

                    )

                );

            }


            row.append(flagCell);


            /* VIEW ACTION */

            const actionCell = createElement("td");

            const actionGroup = createElement(

                "div",

                "assessment-row-actions"

            );


            const viewButton = createElement(

                "button",

                "assessment-view-button",

                "View Details"

            );


            viewButton.type = "button";


            viewButton.addEventListener(

                "click",

                () => openDetails(assessment.id)

            );


            actionGroup.append(viewButton);

            actionCell.append(actionGroup);

            row.append(actionCell);


            fragment.append(row);

        }


        if (fragment.childNodes.length === 0) {

            showEmptyTable(

                "No matching assessments found",

                "No assessment records match the selected filters."

            );

        } else {

            el.tableBody.replaceChildren(fragment);

        }


        /* PAGINATION */

        const pagination = result.pagination;


        const total = Number.isSafeInteger(

            pagination.total

        )

            ? pagination.total

            : null;


        state.totalPages =

            Number.isSafeInteger(pagination.totalPages) &&

                pagination.totalPages >= 0

                ? pagination.totalPages

                : 0;


        el.recordCount.textContent =

            total === null

                ? "Record count unavailable"

                : validCount(total) + " assessment records";


        el.pageInfo.textContent =

            state.totalPages > 0

                ? `Page ${state.page} of ${state.totalPages}`

                : "No pages";


        el.previous.disabled =

            state.page <= 1;


        el.next.disabled =

            state.totalPages === 0 ||

            state.page >= state.totalPages;

    }


    /* ========================================================
       16. LOAD ASSESSMENTS
       ======================================================== */

    async function loadAssessments() {

        if (!state.authorized) return;


        const requestId = ++state.listRequest;


        showEmptyTable(

            "Loading assessment records",

            "Retrieving authorized assessment records..."

        );


        try {

            const query = buildQuery();


            const result = await requestJSON(

                API.assessments +

                "?" +

                query.toString()

            );


            if (

                requestId !== state.listRequest ||

                !state.authorized

            ) {

                return;

            }


            renderAssessments(result);


        } catch (error) {

            if (requestId !== state.listRequest) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            showEmptyTable(

                "Assessment records unavailable",

                "The assessment service could not provide the requested records."

            );


            showNotice(

                "Assessment records could not be loaded.",

                "error"

            );

        }

    }


    /* ========================================================
       17. REFRESH
       ======================================================== */

    async function refreshAll() {

        if (!state.authorized) return;


        showNotice(

            "Refreshing assessment management records..."

        );


        await Promise.all([

            loadSummary(),

            loadAssessments()

        ]);


        if (state.authorized) {

            showNotice(

                "Assessment management data refreshed.",

                "success"

            );

        }

    }


    /* ========================================================
       18. DETAIL FIELDS
       ======================================================== */

    function detailField(label, value) {

        const wrapper = createElement(

            "div",

            "assessment-detail-field"

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

            "assessment-detail-section"

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
       19. EMPLOYEE INFORMATION
       ======================================================== */

    function renderEmployeeInformation(employee) {

        const fields = [

            detailField(

                "Employee Name",

                employee.displayName

            ),

            detailField(

                "Employee Reference",

                employee.reference

            ),

            detailField(

                "Professional Profile",

                employee.profileSummary

            ),

            detailField(

                "Location",

                employee.location

            )

        ];


        /*
          Contact details are intentionally excluded
          from this module's default view.
          Access to further personal data must be
          separately authorized by the backend.
        */


        return detailSection(

            "Employee Information",

            fields

        );

    }


    /* ========================================================
       20. ASSESSMENT INFORMATION
       ======================================================== */

    function renderAssessmentInformation(assessment) {

        return detailSection(

            "Assessment Information",

            [

                detailField(

                    "Assessment Reference",

                    assessment.reference

                ),

                detailField(

                    "Assessment Title",

                    assessment.title

                ),

                detailField(

                    "Assessment Type",

                    TYPE_LABELS[assessment.type] ||

                    assessment.type

                ),

                detailField(

                    "Assessment Category",

                    assessment.category

                ),

                detailField(

                    "Assessment Description",

                    assessment.description

                ),

                detailField(

                    "Assessment Provider",

                    assessment.provider?.name

                ),

                detailField(

                    "Associated Employer",

                    assessment.employer?.name

                ),

                detailField(

                    "Associated Job",

                    assessment.job?.title

                )

            ]

        );

    }


    /* ========================================================
       21. SESSION INFORMATION
       ======================================================== */

    function renderSessionInformation(assessment) {

        const session = assessment.session || {};


        return detailSection(

            "Assessment Session",

            [

                detailField(

                    "Scheduled Date",

                    formatDateTime(assessment.scheduledAt)

                ),

                detailField(

                    "Session Started",

                    formatDateTime(session.startedAt)

                ),

                detailField(

                    "Submission Date",

                    formatDateTime(assessment.submittedAt)

                ),

                detailField(

                    "Completion Date",

                    formatDateTime(session.completedAt)

                ),

                detailField(

                    "Session Status",

                    session.status

                ),

                detailField(

                    "Duration",

                    session.duration

                ),

                detailField(

                    "Attempt Number",

                    session.attemptNumber

                )

            ]

        );

    }


    /* ========================================================
       22. RESULTS AND SCORES
       ======================================================== */

    function renderResults(assessment) {

        const result = assessment.result || {};


        const section = createElement(

            "section",

            "assessment-detail-section"

        );


        section.append(

            createElement(

                "h3",

                "",

                "Assessment Results"

            )

        );


        /*
          A backend permission decision is required.
          Do not assume Super Admin automatically has
          access to every score or answer.
        */


        if (assessment.resultAccessAllowed !== true) {

            section.append(

                createElement(

                    "div",

                    "assessment-privacy-notice restricted",

                    "Detailed assessment results are restricted. " +

                    "The required administrative access permission " +

                    "has not been confirmed by the server."

                )

            );


            return section;

        }


        section.append(

            detailField(

                "Outcome",

                OUTCOME_LABELS[result.outcome] ||

                result.outcome

            ),

            detailField(

                "Score",

                result.score

            ),

            detailField(

                "Maximum Score",

                result.maximumScore

            ),

            detailField(

                "Percentage",

                result.percentage === null ||

                    result.percentage === undefined

                    ? "—"

                    : String(result.percentage) + "%"

            ),

            detailField(

                "Passing Criteria",

                result.passingCriteria

            ),

            detailField(

                "Assessment Feedback",

                result.feedback

            )

        );


        return section;

    }


    /* ========================================================
       23. SKILLS AND COMPETENCIES
       ======================================================== */

    function renderCompetencies(assessment) {

        const section = createElement(

            "section",

            "assessment-detail-section"

        );


        section.append(

            createElement(

                "h3",

                "",

                "Skills & Competency Evaluation"

            )

        );


        const skills = assessment.competencies;


        if (

            assessment.competencyAccessAllowed !== true

        ) {

            section.append(

                createElement(

                    "div",

                    "assessment-privacy-notice restricted",

                    "Detailed competency evaluation is restricted " +

                    "by the applicable access permissions."

                )

            );


            return section;

        }


        if (!Array.isArray(skills) || skills.length === 0) {

            section.append(

                detailField(

                    "Competency Records",

                    "No competency records were returned."

                )

            );


            return section;

        }


        skills.forEach(skill => {

            if (!skill) return;


            section.append(

                detailField(

                    "Skill / Competency",

                    skill.name

                ),

                detailField(

                    "Evaluation Level",

                    skill.level

                ),

                detailField(

                    "Verification Status",

                    skill.verificationStatus

                )

            );

        });


        return section;

    }


    /* ========================================================
       24. EVIDENCE AND DOCUMENTS
       ======================================================== */

    function renderEvidence(assessment) {

        const evidence = assessment.evidence || {};


        const section = createElement(

            "section",

            "assessment-detail-section"

        );


        section.append(

            createElement(

                "h3",

                "",

                "Supporting Evidence"

            )

        );


        const allowed =

            evidence.accessAllowed === true &&

            evidence.consentGranted === true;


        if (!allowed) {

            section.append(

                createElement(

                    "div",

                    "assessment-privacy-notice restricted",

                    evidence.message ||

                    "Evidence access is restricted. " +

                    "Required authorization or sharing consent " +

                    "has not been confirmed."

                )

            );


            return section;

        }


        section.append(

            createElement(

                "div",

                "assessment-privacy-notice",

                "Evidence access authorized for this record."

            )

        );


        if (Array.isArray(evidence.items)) {

            evidence.items.forEach(item => {

                if (!item) return;


                section.append(

                    detailField(

                        "Evidence Title",

                        item.title

                    ),

                    detailField(

                        "Evidence Type",

                        item.type

                    ),

                    detailField(

                        "Verification Status",

                        item.verificationStatus

                    )

                );

            });

        }


        if (

            !Array.isArray(evidence.items) ||

            evidence.items.length === 0

        ) {

            section.append(

                detailField(

                    "Evidence Records",

                    "No accessible evidence records were returned."

                )

            );

        }


        return section;

    }


    /* ========================================================
       25. INTEGRITY INFORMATION
       ======================================================== */

    function renderIntegrity(assessment) {

        const integrity = assessment.integrity || {};


        const section = createElement(

            "section",

            "assessment-detail-section"

        );


        section.append(

            createElement(

                "h3",

                "",

                "Assessment Integrity"

            )

        );


        section.append(

            detailField(

                "Flagged",

                assessment.flagged === true ? "Yes" : "No"

            ),

            detailField(

                "Integrity Status",

                integrity.status

            ),

            detailField(

                "Integrity Review Status",

                integrity.reviewStatus

            )

        );


        if (assessment.flagged === true) {

            section.append(

                createElement(

                    "div",

                    "assessment-integrity-alert",

                    integrity.flagReason ||

                    "This assessment has been flagged for administrative attention."

                )

            );

        }


        if (Array.isArray(integrity.alerts)) {

            integrity.alerts.forEach(alert => {

                if (!alert) return;


                section.append(

                    detailField(

                        "Integrity Alert",

                        alert.description

                    ),

                    detailField(

                        "Alert Status",

                        alert.status

                    )

                );

            });

        }


        return section;

    }


    /* ========================================================
       26. VERIFICATION INFORMATION
       ======================================================== */

    function renderVerification(assessment) {

        const verification = assessment.verification || {};


        return detailSection(

            "Verification Records",

            [

                detailField(

                    "Verification Status",

                    verification.status

                ),

                detailField(

                    "Verified By",

                    verification.verifiedBy

                ),

                detailField(

                    "Verification Date",

                    formatDateTime(verification.verifiedAt)

                ),

                detailField(

                    "Verification Reference",

                    verification.reference

                ),

                detailField(

                    "Verification Notes",

                    verification.notes

                )

            ]

        );

    }


    /* ========================================================
       27. ASSESSMENT HISTORY
       ======================================================== */

    function renderHistory(history) {

        const section = createElement(

            "section",

            "assessment-detail-section"

        );


        section.append(

            createElement(

                "h3",

                "",

                "Assessment & Administrative History"

            )

        );


        if (!Array.isArray(history) || history.length === 0) {

            section.append(

                createElement(

                    "p",

                    "",

                    "No history records are available."

                )

            );


            return section;

        }


        const list = createElement(

            "div",

            "assessment-history"

        );


        history.forEach(record => {

            if (!record) return;


            const item = createElement(

                "div",

                "assessment-history-item"

            );


            item.append(

                createElement(

                    "strong",

                    "",

                    safeValue(record.action)

                ),

                createElement(

                    "p",

                    "",

                    safeValue(record.description)

                ),

                createElement(

                    "p",

                    "",

                    record.actor

                        ? "Recorded by: " + record.actor

                        : "Actor information restricted or unavailable."

                ),

                createElement(

                    "time",

                    "",

                    formatDateTime(record.timestamp)

                )

            );


            list.append(item);

        });


        section.append(list);


        return section;

    }


    /* ========================================================
       28. AVAILABLE ADMINISTRATIVE ACTIONS
       ======================================================== */

    function renderAvailableActions(assessment) {

        const actions = Array.isArray(

            assessment.availableActions

        )

            ? assessment.availableActions

            : [];


        const fragment =

            document.createDocumentFragment();


        fragment.append(

            createElement(

                "p",

                "assessment-action-note",

                "Actions are supplied by the authorized server " +

                "according to assessment status and administrator permissions."

            )

        );


        const allowed = [

            ...new Set(

                actions.filter(action =>

                    typeof action === "string" &&

                    Object.hasOwn(ACTION_LABELS, action)

                )

            )

        ];


        allowed.forEach(action => {

            const button = createElement(

                "button",

                action === "invalidate"

                    ? "btn btn-danger"

                    : action === "verify_result"

                        ? "btn btn-success"

                        : "btn btn-secondary",

                ACTION_LABELS[action]

            );


            button.type = "button";


            button.addEventListener(

                "click",

                () => requestAdministrativeAction(action)

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
       29. RENDER COMPLETE DETAILS
       ======================================================== */

    function renderDetails(assessment) {

        el.detailTitle.textContent =

            safeValue(assessment.reference);


        el.detailContent.replaceChildren();


        const sections = [

            detailSection(

                "Assessment Overview",

                [

                    detailField(

                        "Assessment Reference",

                        assessment.reference

                    ),

                    detailField(

                        "Current Status",

                        STATUS_LABELS[assessment.status] ||

                        assessment.status

                    ),

                    detailField(

                        "Flagged",

                        assessment.flagged === true ? "Yes" : "No"

                    ),

                    detailField(

                        "Created Date",

                        formatDateTime(assessment.createdAt)

                    ),

                    detailField(

                        "Last Updated",

                        formatDateTime(assessment.updatedAt)

                    )

                ]

            ),

            renderEmployeeInformation(

                assessment.employee || {}

            ),

            renderAssessmentInformation(assessment),

            renderSessionInformation(assessment),

            renderResults(assessment),

            renderCompetencies(assessment),

            renderEvidence(assessment),

            renderIntegrity(assessment),

            renderVerification(assessment),

            renderHistory(assessment.history)

        ];


        sections.forEach(section => {

            el.detailContent.append(section);

        });


        renderAvailableActions(assessment);

    }


    /* ========================================================
       30. OPEN ASSESSMENT DETAILS
       ======================================================== */

    async function openDetails(id) {

        if (!state.authorized) return;


        const requestId = ++state.detailRequest;


        showNotice(

            "Retrieving assessment details..."

        );


        try {

            const assessment = await requestJSON(

                API.detail(id)

            );


            if (

                requestId !== state.detailRequest ||

                !state.authorized

            ) {

                return;

            }


            if (

                !assessment ||

                assessment.id !== id ||

                !Object.hasOwn(

                    STATUS_LABELS,

                    assessment.status

                )

            ) {

                throw new Error(

                    "Invalid assessment detail response."

                );

            }


            state.selectedAssessment = assessment;


            renderDetails(assessment);


            el.detailOverlay.hidden = false;


            document.body.style.overflow = "hidden";


            el.detailClose.focus();


            showNotice(

                "Assessment details retrieved.",

                "success"

            );


        } catch (error) {

            if (requestId !== state.detailRequest) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            showNotice(

                "Unable to retrieve the selected assessment.",

                "error"

            );

        }

    }


    function closeDetails() {

        state.detailRequest++;

        el.detailOverlay.hidden = true;

        state.selectedAssessment = null;

        el.detailContent.replaceChildren();

        el.detailActions.replaceChildren();

        document.body.style.overflow = "";

    }


    /* ========================================================
       31. ADMINISTRATIVE ACTION CONFIRMATION
       ======================================================== */

    function requestAdministrativeAction(action) {

        if (

            !state.authorized ||

            !state.selectedAssessment ||

            state.actionInProgress

        ) {

            return;

        }


        if (

            !Object.hasOwn(ACTION_LABELS, action) ||

            !state.selectedAssessment.availableActions

                ?.includes(action)

        ) {

            return;

        }


        state.pendingAction = action;


        el.confirmTitle.textContent =

            "Confirm: " + ACTION_LABELS[action];


        el.confirmDescription.textContent =

            ACTION_DESCRIPTIONS[action] +

            " Assessment reference: " +

            safeValue(

                state.selectedAssessment.reference

            );


        el.confirmReason.value = "";


        el.confirmSubmit.disabled = true;


        el.confirmSubmit.textContent =

            "Confirm Action";


        el.confirmCancel.disabled = false;


        el.confirmOverlay.hidden = false;


        el.confirmReason.focus();

    }


    function closeConfirmation() {

        if (state.actionInProgress) return;


        el.confirmOverlay.hidden = true;

        state.pendingAction = null;

        el.confirmReason.value = "";

    }


    /* ========================================================
       32. EXECUTE ADMINISTRATIVE ACTION
       ======================================================== */

    async function executeAdministrativeAction() {

        if (

            !state.authorized ||

            !state.selectedAssessment ||

            !state.pendingAction ||

            state.actionInProgress

        ) {

            return;

        }


        const reason =

            el.confirmReason.value.trim();


        if (reason.length < 5) {

            showNotice(

                "A meaningful reason of at least five characters is required.",

                "warning"

            );


            el.confirmReason.focus();


            return;

        }


        if (!state.csrfToken) {

            showNotice(

                "Your security session is invalid. Please sign in again.",

                "error"

            );


            return;

        }


        const action = state.pendingAction;


        const assessmentId =

            state.selectedAssessment.id;


        state.actionInProgress = true;


        el.confirmSubmit.disabled = true;

        el.confirmCancel.disabled = true;


        el.confirmSubmit.textContent =

            "Processing...";


        try {

            const result = await requestJSON(

                API.action(assessmentId),

                {

                    method: "POST",

                    body: JSON.stringify({

                        action,

                        reason

                    })

                }

            );


            if (!state.authorized) return;


            state.actionInProgress = false;


            closeConfirmation();

            closeDetails();


            showNotice(

                result?.message ||

                "The administrative action was accepted by the server.",

                "success"

            );


            state.page = 1;


            await Promise.all([

                loadSummary(),

                loadAssessments()

            ]);


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
       33. STATUS TABS
       ======================================================== */

    function selectStatus(status) {

        const allowed = [

            "all",

            "scheduled",

            "in_progress",

            "submitted",

            "under_review",

            "verified",

            "flagged",

            "closed"

        ];


        if (!allowed.includes(status)) {

            return;

        }


        state.status = status;

        state.page = 1;


        document.querySelectorAll(".assessments-tab")

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


        loadAssessments();

    }


    /* ========================================================
       34. SIDEBAR
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
       35. REGISTER EVENTS
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


        /* FILTER SUBMISSION */

        el.filterForm.addEventListener(

            "submit",

            event => {

                event.preventDefault();


                if (!state.authorized) return;


                applyFilterValues();


                loadAssessments();

            }

        );


        /* CLEAR FILTERS */

        el.clearFilters.addEventListener(

            "click",

            () => {

                el.search.value = "";

                el.type.value = "";

                el.dateSort.value = "newest";

                el.flaggedOnly.checked = false;


                applyFilterValues();


                loadAssessments();

            }

        );


        /* PAGINATION */

        el.previous.addEventListener(

            "click",

            () => {

                if (

                    !state.authorized ||

                    state.page <= 1

                ) {

                    return;

                }


                state.page--;


                loadAssessments();

            }

        );


        el.next.addEventListener(

            "click",

            () => {

                if (

                    !state.authorized ||

                    state.page >= state.totalPages

                ) {

                    return;

                }


                state.page++;


                loadAssessments();

            }

        );


        /* STATUS TABS */

        const tabs = Array.from(

            document.querySelectorAll(".assessments-tab")

        );


        tabs.forEach((button, index) => {


            button.addEventListener(

                "click",

                () => {

                    selectStatus(button.dataset.status);

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


        /* DETAIL DRAWER */

        el.detailClose.addEventListener(

            "click",

            closeDetails

        );


        el.detailOverlay.addEventListener(

            "click",

            event => {

                if (event.target === el.detailOverlay) {

                    closeDetails();

                }

            }

        );


        /* CONFIRMATION */

        el.confirmReason.addEventListener(

            "input",

            () => {

                el.confirmSubmit.disabled =

                    el.confirmReason.value.trim().length < 5 ||

                    !state.authorized;

            }

        );


        el.confirmCancel.addEventListener(

            "click",

            closeConfirmation

        );


        el.confirmSubmit.addEventListener(

            "click",

            executeAdministrativeAction

        );


        /* KEYBOARD */

        document.addEventListener(

            "keydown",

            event => {

                if (event.key !== "Escape") return;


                if (!el.confirmOverlay.hidden) {

                    closeConfirmation();

                } else if (!el.detailOverlay.hidden) {

                    closeDetails();

                } else {

                    closeSidebar();

                }

            }

        );

    }


    /* ========================================================
       36. INITIALIZATION AND AUTHORIZATION
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


            setConnection(

                "Connecting..."

            );


            enableFilters();


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
       37. START APPLICATION
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
