
/* ==========================================================
   TALVORA TECHNOLOGIES
   TALVORA GLOBAL — GSES SYSTEM 001

   APPLICATIONS & HIRING MANAGEMENT
   FILE: applications.js

   No demo records.
   No fabricated employees or employers.
   No local application storage.
   All production records come from authorized APIs.
   ========================================================== */

(() => {
    "use strict";

    /* ========================================================
       01. CONFIGURATION
       ======================================================== */

    const API = {
        session: "/api/v1/auth/session",

        summary: "/api/v1/admin/applications/summary",

        applications: "/api/v1/admin/applications",

        detail: id =>
            "/api/v1/admin/applications/" +
            encodeURIComponent(id),

        action: id =>
            "/api/v1/admin/applications/" +
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

    const STATUS_LABELS = {
        submitted: "New Application",
        screening: "Under Screening",
        shortlisted: "Shortlisted",
        interview: "Interview",
        offered: "Offer Issued",
        hired: "Hired",
        rejected: "Rejected",
        withdrawn: "Withdrawn",
        on_hold: "On Hold"
    };

    const ACTION_LABELS = {
        start_screening: "Start Screening",
        shortlist: "Shortlist Candidate",
        move_to_interview: "Move to Interview",
        issue_offer: "Record Offer Issued",
        mark_hired: "Mark as Hired",
        reject: "Reject Application",
        reopen: "Reopen Application",
        place_on_hold: "Place on Hold",
        resume_review: "Resume Review",
        flag: "Flag Application",
        clear_flag: "Clear Flag"
    };

    const ACTION_DESCRIPTIONS = {
        start_screening:
            "Move this application into the screening stage.",

        shortlist:
            "Record this candidate as shortlisted.",

        move_to_interview:
            "Move this application to the interview stage.",

        issue_offer:
            "Record that an employment offer has been issued.",

        mark_hired:
            "Record the successful hiring outcome.",

        reject:
            "Reject this application. A documented reason is required.",

        reopen:
            "Reopen this application for further consideration.",

        place_on_hold:
            "Place this application on administrative hold.",

        resume_review:
            "Resume the review of this application.",

        flag:
            "Flag this application for administrative investigation.",

        clear_flag:
            "Remove the administrative flag after appropriate review."
    };


    /* ========================================================
       02. ELEMENT REFERENCES
       ======================================================== */

    const el = {
        app: $("applications-app"),
        locked: $("applications-locked"),
        accessMessage: $("applications-access-message"),

        notice: $("applications-notice"),
        systemStatus: $("applications-system-status"),

        refresh: $("applications-refresh"),

        search: $("application-search"),
        workMode: $("application-work-mode"),
        dateSort: $("application-date-sort"),
        flaggedOnly: $("application-flagged-only"),

        filterForm: $("applications-filter-form"),
        clearFilters: $("applications-clear-filters"),

        tableBody: $("applications-table-body"),
        recordCount: $("applications-record-count"),
        pageInfo: $("applications-page-info"),

        previous: $("applications-prev"),
        next: $("applications-next"),

        detailOverlay: $("application-detail-overlay"),
        detailTitle: $("application-detail-title"),
        detailClose: $("application-detail-close"),
        detailContent: $("application-detail-content"),
        detailActions: $("application-detail-actions"),

        confirmOverlay: $("application-confirm-overlay"),
        confirmTitle: $("application-confirm-title"),
        confirmDescription: $("application-confirm-description"),
        confirmReason: $("application-action-reason"),
        confirmCancel: $("application-confirm-cancel"),
        confirmSubmit: $("application-confirm-submit")
    };


    /* ========================================================
       03. APPLICATION STATE
       ======================================================== */

    const state = {
        authorized: false,

        csrfToken: null,

        status: "all",

        page: 1,
        pageSize: 20,
        totalPages: 0,

        search: "",
        workMode: "",
        dateSort: "newest",
        flaggedOnly: false,

        selectedApplication: null,

        pendingAction: null,
        actionInProgress: false,

        listRequest: 0,
        summaryRequest: 0,
        detailRequest: 0
    };


    /* ========================================================
       04. STATISTICS REFERENCES
       ======================================================== */

    const METRICS = {
        total: "metric-applications-total",
        submitted: "metric-applications-submitted",
        screening: "metric-applications-screening",
        shortlisted: "metric-applications-shortlisted",
        interview: "metric-applications-interview",
        offered: "metric-applications-offered",
        hired: "metric-applications-hired",
        flagged: "metric-applications-flagged"
    };


    /* ========================================================
       05. SAFE DOM HELPERS
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
            "applications-notice " + type;

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
       06. EMPTY STATES
       ======================================================== */

    function showEmptyTable(title, description) {

        const row = createElement("tr");
        const cell = createElement("td");
        const empty = createElement(
            "div",
            "applications-empty"
        );

        cell.colSpan = 8;

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
       07. SCREEN MANAGEMENT
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
            "Local frontend preview only. No application records, " +
            "candidate details or administrative actions are connected.",
            "warning"
        );

        showEmptyTable(
            "No application records connected",
            "Real applications will appear here after the authorized " +
            "backend service is implemented."
        );

    }


    /* ========================================================
       08. API REQUEST HANDLER
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
                "The application management service is unavailable."
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
       09. APPLICATION SUMMARY
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
                    "Invalid application summary response."
                );

            }

            const metrics = result.metrics;

            setText(
                METRICS.total,
                validCount(metrics.total)
            );

            setText(
                METRICS.submitted,
                validCount(metrics.submitted)
            );

            setText(
                METRICS.screening,
                validCount(metrics.screening)
            );

            setText(
                METRICS.shortlisted,
                validCount(metrics.shortlisted)
            );

            setText(
                METRICS.interview,
                validCount(metrics.interview)
            );

            setText(
                METRICS.offered,
                validCount(metrics.offered)
            );

            setText(
                METRICS.hired,
                validCount(metrics.hired)
            );

            setText(
                METRICS.flagged,
                validCount(metrics.flagged)
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
                "Application statistics could not be retrieved.",
                "error"
            );

        }

    }


    /* ========================================================
       10. FILTER CONSTRUCTION
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


        if (state.workMode) {

            params.set(
                "workMode",
                state.workMode
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

        state.workMode = el.workMode.value;

        state.dateSort = el.dateSort.value;

        state.flaggedOnly = el.flaggedOnly.checked;

        state.page = 1;

    }


    function enableFilters() {

        [

            el.search,

            el.workMode,

            el.dateSort,

            el.flaggedOnly,

            el.refresh,

            el.clearFilters,

            $("applications-apply-filters")

        ].forEach(control => {

            control.disabled = false;

        });

    }


    /* ========================================================
       11. APPLICATION STATUS
       ======================================================== */

    function createStatusBadge(status) {

        const label =
            STATUS_LABELS[status] || "Unknown";

        return createElement(
            "span",
            "application-status " + status,
            label
        );

    }


    /* ========================================================
       12. APPLICATION TABLE
       ======================================================== */

    function renderApplications(result) {

        if (
            !result ||
            !Array.isArray(result.items) ||
            !result.pagination
        ) {

            throw new Error(
                "Invalid application directory response."
            );

        }


        const fragment =
            document.createDocumentFragment();


        for (const application of result.items) {

            if (
                !application ||
                typeof application.id !== "string" ||
                !application.id ||
                !Object.hasOwn(
                    STATUS_LABELS,
                    application.status
                )
            ) {

                continue;

            }


            const row = createElement("tr");


            /* APPLICATION REFERENCE */

            const reference = createElement(
                "td",
                "application-reference",
                safeValue(application.reference)
            );

            row.append(reference);


            /* CANDIDATE */

            const candidateCell = createElement("td");

            candidateCell.append(

                createElement(
                    "span",
                    "application-candidate",
                    application.candidate?.displayName || "—"
                ),

                createElement(
                    "span",
                    "application-secondary",
                    application.candidate?.reference || ""
                )

            );

            row.append(candidateCell);


            /* JOB */

            const jobCell = createElement("td");

            jobCell.append(

                createElement(
                    "span",
                    "application-job-title",
                    application.job?.title || "—"
                ),

                createElement(
                    "span",
                    "application-secondary",
                    application.job?.reference || ""
                )

            );

            row.append(jobCell);


            /* EMPLOYER */

            const employerCell = createElement(
                "td",
                "application-employer",
                application.employer?.name || "—"
            );

            row.append(employerCell);


            /* SUBMISSION DATE */

            row.append(
                createElement(
                    "td",
                    "",
                    formatDate(application.submittedAt)
                )
            );


            /* STATUS */

            const statusCell = createElement("td");

            statusCell.append(
                createStatusBadge(application.status)
            );

            row.append(statusCell);


            /* FLAG */

            const flagCell = createElement("td");

            if (application.flagged === true) {

                flagCell.append(
                    createElement(
                        "span",
                        "application-flag-indicator",
                        "Flagged"
                    )
                );

            } else {

                flagCell.append(
                    createElement(
                        "span",
                        "application-no-flag",
                        "—"
                    )
                );

            }

            row.append(flagCell);


            /* ACTION */

            const actionCell = createElement("td");

            const actionGroup = createElement(
                "div",
                "application-row-actions"
            );

            const viewButton = createElement(
                "button",
                "application-view-button",
                "View Details"
            );

            viewButton.type = "button";

            viewButton.addEventListener(
                "click",
                () => openDetails(application.id)
            );

            actionGroup.append(viewButton);
            actionCell.append(actionGroup);
            row.append(actionCell);


            fragment.append(row);

        }


        if (fragment.childNodes.length === 0) {

            showEmptyTable(
                "No matching applications found",
                "There are no application records matching the selected filters."
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

                : validCount(total) + " application records";


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
       13. LOAD APPLICATION RECORDS
       ======================================================== */

    async function loadApplications() {

        if (!state.authorized) return;

        const requestId = ++state.listRequest;

        showEmptyTable(
            "Loading application records",
            "Retrieving authorized employee application records..."
        );


        try {

            const query = buildQuery();

            const result = await requestJSON(

                API.applications +
                "?" +
                query.toString()

            );


            if (
                requestId !== state.listRequest ||
                !state.authorized
            ) {

                return;

            }


            renderApplications(result);


        } catch (error) {

            if (requestId !== state.listRequest) {
                return;
            }

            if (handleAuthorizationError(error)) {
                return;
            }

            showEmptyTable(
                "Application records unavailable",
                "The application service could not provide the requested records."
            );

            showNotice(
                "Application records could not be loaded.",
                "error"
            );

        }

    }


    /* ========================================================
       14. REFRESH ALL DATA
       ======================================================== */

    async function refreshAll() {

        if (!state.authorized) return;

        showNotice(
            "Refreshing application management records..."
        );

        await Promise.all([

            loadSummary(),

            loadApplications()

        ]);


        if (state.authorized) {

            showNotice(
                "Application management data refreshed.",
                "success"
            );

        }

    }


    /* ========================================================
       15. APPLICATION DETAIL FIELD
       ======================================================== */

    function detailField(label, value) {

        const wrapper = createElement(
            "div",
            "application-detail-field"
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
            "application-detail-section"
        );

        section.append(
            createElement("h3", "", title)
        );

        fields.forEach(field => {

            if (field) {
                section.append(field);
            }

        });

        return section;

    }


    /* ========================================================
       16. CANDIDATE INFORMATION
       ======================================================== */

    function renderCandidateInformation(candidate) {

        const fields = [

            detailField(
                "Candidate Name",
                candidate.displayName
            ),

            detailField(
                "Candidate Reference",
                candidate.reference
            ),

            detailField(
                "Candidate Location",
                candidate.location
            ),

            detailField(
                "Professional Summary",
                candidate.profileSummary
            )

        ];


        /*
          Contact details are only displayed when the
          backend explicitly confirms both authorization
          and the required sharing consent.
        */

        if (
            candidate.contactAccess === true &&
            candidate.contactConsent === true
        ) {

            fields.push(

                detailField(
                    "Email Address",
                    candidate.email
                ),

                detailField(
                    "Telephone",
                    candidate.phone
                )

            );

        } else {

            fields.push(

                detailField(
                    "Contact Information",
                    "Restricted by privacy and sharing permissions."
                )

            );

        }


        return detailSection(
            "Employee / Candidate Information",
            fields
        );

    }


    /* ========================================================
       17. JOB AND EMPLOYER INFORMATION
       ======================================================== */

    function renderJobInformation(application) {

        const job = application.job || {};

        return detailSection(
            "Job Information",
            [

                detailField(
                    "Job Reference",
                    job.reference
                ),

                detailField(
                    "Job Title",
                    job.title
                ),

                detailField(
                    "Work Arrangement",
                    job.workMode
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

    }


    function renderEmployerInformation(application) {

        const employer = application.employer || {};

        return detailSection(
            "Employer Information",
            [

                detailField(
                    "Employer Name",
                    employer.name
                ),

                detailField(
                    "Employer Reference",
                    employer.reference
                ),

                detailField(
                    "Employer Account Reference",
                    employer.id
                )

            ]
        );

    }


    /* ========================================================
       18. APPLICATION CONTENT
       ======================================================== */

    function renderApplicationContent(application) {

        return detailSection(
            "Application Submission",
            [

                detailField(
                    "Application Reference",
                    application.reference
                ),

                detailField(
                    "Submission Date",
                    formatDateTime(application.submittedAt)
                ),

                detailField(
                    "Current Status",
                    STATUS_LABELS[application.status] ||
                    application.status
                ),

                detailField(
                    "Cover Letter",
                    application.coverLetter
                ),

                ...renderApplicationAnswers(
                    application.answers
                )

            ]
        );

    }


    function renderApplicationAnswers(answers) {

        if (!Array.isArray(answers)) {
            return [];
        }

        return answers

            .filter(answer =>
                answer &&
                typeof answer.question === "string"
            )

            .map(answer =>
                detailField(
                    answer.question,
                    answer.answer
                )
            );

    }


    /* ========================================================
       19. SKILLS AND EVIDENCE
       ======================================================== */

    function renderEvidence(application) {

        const evidence = application.evidence || {};

        const section = createElement(
            "section",
            "application-detail-section"
        );

        section.append(
            createElement(
                "h3",
                "",
                "Skills & Supporting Evidence"
            )
        );


        const permitted =

            evidence.accessAllowed === true &&
            evidence.consentGranted === true;


        if (!permitted) {

            const notice = createElement(
                "div",
                "application-evidence-notice restricted",

                evidence.message ||
                "Evidence access is restricted. The required " +
                "authorization or sharing consent has not been confirmed."
            );

            section.append(notice);

            return section;

        }


        section.append(

            createElement(
                "div",
                "application-evidence-notice",
                "Evidence access authorized for this application."
            )

        );


        if (Array.isArray(evidence.items)) {

            evidence.items.forEach(item => {

                if (!item) return;

                const fields = [

                    detailField(
                        "Evidence",
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

                ];

                fields.forEach(field => {
                    section.append(field);
                });

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
       20. APPLICATION HISTORY
       ======================================================== */

    function renderHistory(history) {

        const section = createElement(
            "section",
            "application-detail-section"
        );

        section.append(
            createElement(
                "h3",
                "",
                "Application & Administrative History"
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
            "application-history"
        );


        history.forEach(record => {

            if (!record) return;

            const item = createElement(
                "div",
                "application-history-item"
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
       21. DETAIL ACTIONS
       ======================================================== */

    function renderAvailableActions(application) {

        const actions = Array.isArray(
            application.availableActions
        )
            ? application.availableActions
            : [];


        const fragment =
            document.createDocumentFragment();


        const note = createElement(
            "p",
            "application-action-note",

            "Actions are supplied by the authorized server " +
            "according to the current application state and " +
            "administrator permissions."
        );

        fragment.append(note);


        const allowed = [
            ...new Set(actions.filter(action =>
                typeof action === "string" &&
                Object.hasOwn(ACTION_LABELS, action)
            ))
        ];


        allowed.forEach(action => {

            const button = createElement(
                "button",
                action === "reject" ? "btn btn-danger" :
                    action === "mark_hired" ? "btn btn-success" :
                        "btn btn-secondary",

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
       22. RENDER APPLICATION DETAILS
       ======================================================== */

    function renderDetails(application) {

        el.detailTitle.textContent =
            safeValue(application.reference);

        el.detailContent.replaceChildren();


        const sections = [

            detailSection(
                "Application Overview",
                [

                    detailField(
                        "Application Reference",
                        application.reference
                    ),

                    detailField(
                        "Current Status",
                        STATUS_LABELS[application.status] ||
                        application.status
                    ),

                    detailField(
                        "Flagged",
                        application.flagged === true ? "Yes" : "No"
                    ),

                    detailField(
                        "Last Updated",
                        formatDateTime(application.updatedAt)
                    )

                ]
            ),

            renderCandidateInformation(
                application.candidate || {}
            ),

            renderJobInformation(application),

            renderEmployerInformation(application),

            renderApplicationContent(application),

            renderEvidence(application),

            renderHistory(application.history)

        ];


        sections.forEach(section => {

            el.detailContent.append(section);

        });


        renderAvailableActions(application);

    }


    /* ========================================================
       23. OPEN APPLICATION DETAILS
       ======================================================== */

    async function openDetails(id) {

        if (!state.authorized) return;

        const requestId = ++state.detailRequest;

        showNotice(
            "Retrieving application details..."
        );


        try {

            const application = await requestJSON(
                API.detail(id)
            );


            if (
                requestId !== state.detailRequest ||
                !state.authorized
            ) {

                return;

            }


            if (
                !application ||
                application.id !== id ||
                !Object.hasOwn(
                    STATUS_LABELS,
                    application.status
                )
            ) {

                throw new Error(
                    "Invalid application detail response."
                );

            }


            state.selectedApplication = application;

            renderDetails(application);

            el.detailOverlay.hidden = false;

            document.body.style.overflow = "hidden";

            el.detailClose.focus();

            showNotice(
                "Application details retrieved.",
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
                "Unable to retrieve the selected application.",
                "error"
            );

        }

    }


    function closeDetails() {

        state.detailRequest++;

        el.detailOverlay.hidden = true;

        state.selectedApplication = null;

        el.detailContent.replaceChildren();
        el.detailActions.replaceChildren();

        document.body.style.overflow = "";

    }


    /* ========================================================
       24. ADMINISTRATIVE ACTION CONFIRMATION
       ======================================================== */

    function requestAdministrativeAction(action) {

        if (
            !state.authorized ||
            !state.selectedApplication ||
            state.actionInProgress
        ) {

            return;

        }


        if (
            !Object.hasOwn(ACTION_LABELS, action) ||
            !state.selectedApplication.availableActions
                ?.includes(action)
        ) {

            return;

        }


        state.pendingAction = action;


        el.confirmTitle.textContent =
            "Confirm: " + ACTION_LABELS[action];


        el.confirmDescription.textContent =

            ACTION_DESCRIPTIONS[action] +

            " Application reference: " +

            safeValue(
                state.selectedApplication.reference
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
       25. EXECUTE ADMINISTRATIVE ACTION
       ======================================================== */

    async function executeAdministrativeAction() {

        if (

            !state.authorized ||

            !state.selectedApplication ||

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

        const applicationId =
            state.selectedApplication.id;


        state.actionInProgress = true;

        el.confirmSubmit.disabled = true;

        el.confirmCancel.disabled = true;

        el.confirmSubmit.textContent =
            "Processing...";


        try {

            const result = await requestJSON(

                API.action(applicationId),

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

                loadApplications()

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
       26. STATUS TABS
       ======================================================== */

    function selectStatus(status) {

        const permitted = [

            "all",

            "submitted",

            "screening",

            "shortlisted",

            "interview",

            "offered",

            "hired",

            "closed"

        ];


        if (!permitted.includes(status)) {
            return;
        }


        state.status = status;

        state.page = 1;


        document.querySelectorAll(".applications-tab")
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


        loadApplications();

    }


    /* ========================================================
       27. SIDEBAR
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
       28. EVENT REGISTRATION
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

                loadApplications();

            }
        );


        /* CLEAR FILTERS */

        el.clearFilters.addEventListener(
            "click",
            () => {

                el.search.value = "";

                el.workMode.value = "";

                el.dateSort.value = "newest";

                el.flaggedOnly.checked = false;

                applyFilterValues();

                loadApplications();

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

                loadApplications();

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

                loadApplications();

            }
        );


        /* STATUS TABS */

        const tabs = Array.from(
            document.querySelectorAll(".applications-tab")
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
       29. INITIALIZATION AND ADMIN AUTHORIZATION
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
       30. START APPLICATION
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
