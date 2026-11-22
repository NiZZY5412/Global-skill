
/* ==========================================================
   TALVORA TECHNOLOGIES
   TALVORA GLOBAL — GSES SYSTEM 001

   PRIVACY, CONSENT & DATA PROTECTION
   FILE: consents.js

   ENTERPRISE PRIVACY GOVERNANCE ENGINE

   MODULES:
   01. Authentication
   02. Privacy Dashboard
   03. Consent Register
   04. Data Subject Requests
   05. Privacy Incidents
   06. Data Sharing
   07. Retention Management
   08. Processing Register
   09. Privacy Audit Trail
   10. Record Examination
   11. Administrative Actions
   12. Report Export

   SECURITY:
   - Super Admin authorization
   - Same-origin requests
   - CSRF protection
   - Server-authorized actions
   - No fabricated records
   - No silent consent modification
   - No unauthorized deletion
   - Audit-oriented interventions

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
            "/api/v1/admin/privacy/summary",


        consents:
            "/api/v1/admin/privacy/consents",

        consentDetail: id =>
            "/api/v1/admin/privacy/consents/" +
            encodeURIComponent(id),

        consentActions: id =>
            "/api/v1/admin/privacy/consents/" +
            encodeURIComponent(id) +
            "/actions",


        requests:
            "/api/v1/admin/privacy/requests",

        requestDetail: id =>
            "/api/v1/admin/privacy/requests/" +
            encodeURIComponent(id),

        requestActions: id =>
            "/api/v1/admin/privacy/requests/" +
            encodeURIComponent(id) +
            "/actions",


        incidents:
            "/api/v1/admin/privacy/incidents",

        incidentDetail: id =>
            "/api/v1/admin/privacy/incidents/" +
            encodeURIComponent(id),

        incidentActions: id =>
            "/api/v1/admin/privacy/incidents/" +
            encodeURIComponent(id) +
            "/actions",


        sharing:
            "/api/v1/admin/privacy/sharing",

        sharingDetail: id =>
            "/api/v1/admin/privacy/sharing/" +
            encodeURIComponent(id),

        sharingActions: id =>
            "/api/v1/admin/privacy/sharing/" +
            encodeURIComponent(id) +
            "/actions",


        retention:
            "/api/v1/admin/privacy/retention",

        retentionDetail: id =>
            "/api/v1/admin/privacy/retention/" +
            encodeURIComponent(id),

        retentionActions: id =>
            "/api/v1/admin/privacy/retention/" +
            encodeURIComponent(id) +
            "/actions",


        processing:
            "/api/v1/admin/privacy/processing",

        processingDetail: id =>
            "/api/v1/admin/privacy/processing/" +
            encodeURIComponent(id),

        processingActions: id =>
            "/api/v1/admin/privacy/processing/" +
            encodeURIComponent(id) +
            "/actions",


        activity:
            "/api/v1/admin/privacy/activity",


        export:
            "/api/v1/admin/privacy/export"

    };


    /* ========================================================
       02. MODULE CONFIGURATION
       ======================================================== */

    const PAGE_SIZE = 20;

    const LOCAL_HOSTS = [

        "localhost",

        "127.0.0.1",

        "::1"

    ];


    const IS_LOCAL =

        location.protocol === "file:" ||

        LOCAL_HOSTS.includes(location.hostname);


    const $ = id =>

        document.getElementById(id);


    /* ========================================================
       03. LABEL DEFINITIONS
       ======================================================== */

    const LABELS = {

        consentStatus: {

            active: "Active",

            withdrawn: "Withdrawn",

            expired: "Expired",

            pending: "Pending",

            superseded: "Superseded",

            invalid: "Invalid"

        },


        requestType: {

            access: "Access",

            rectification: "Rectification",

            erasure: "Erasure",

            portability: "Portability",

            objection: "Objection",

            restriction: "Restriction",

            withdrawal: "Consent Withdrawal",

            other: "Other"

        },


        requestStatus: {

            submitted: "Submitted",

            verification_pending: "Verification Pending",

            verified: "Verified",

            under_review: "Under Review",

            awaiting_information: "Awaiting Information",

            in_progress: "In Progress",

            fulfilled: "Fulfilled",

            partially_fulfilled: "Partially Fulfilled",

            rejected: "Rejected",

            closed: "Closed"

        },


        incidentStatus: {

            reported: "Reported",

            assessing: "Assessing",

            investigating: "Investigating",

            contained: "Contained",

            remediating: "Remediating",

            monitoring: "Monitoring",

            closed: "Closed"

        },


        incidentSeverity: {

            critical: "Critical",

            high: "High",

            medium: "Medium",

            low: "Low"

        },


        sharingStatus: {

            active: "Active",

            pending_review: "Pending Review",

            suspended: "Suspended",

            expired: "Expired",

            terminated: "Terminated"

        },


        retentionStatus: {

            active: "Active",

            review_due: "Review Due",

            eligible_for_disposal: "Eligible for Disposal",

            on_hold: "Legal Hold",

            disposed: "Disposed"

        },


        processingStatus: {

            active: "Active",

            under_review: "Under Review",

            suspended: "Suspended",

            retired: "Retired"

        },


        partyType: {

            employee: "Employee",

            employer: "Employer",

            administrator: "Administrator",

            contractor: "Contractor",

            other: "Other"

        },


        legalBasis: {

            consent: "Consent",

            contract: "Contractual Necessity",

            legal_obligation: "Legal Obligation",

            legitimate_interests: "Legitimate Interests",

            vital_interests: "Vital Interests",

            public_task: "Public Task",

            other: "Other"

        }

    };


    /* ========================================================
       04. ACTION DEFINITIONS
       ======================================================== */

    const ACTION_LABELS = {

        /* CONSENT */

        verify_record:
            "Verify Consent Record",

        flag_for_review:
            "Flag for Review",

        record_withdrawal_receipt:
            "Record Withdrawal Receipt",

        request_consent_evidence:
            "Request Consent Evidence",

        restrict_processing:
            "Record Processing Restriction",


        /* DATA SUBJECT REQUESTS */

        acknowledge_request:
            "Acknowledge Request",

        verify_identity:
            "Verify Identity",

        assign_officer:
            "Assign Responsible Officer",

        request_information:
            "Request Additional Information",

        begin_review:
            "Begin Formal Review",

        record_fulfilment:
            "Record Request Fulfilment",

        record_partial_fulfilment:
            "Record Partial Fulfilment",

        record_rejection:
            "Record Reasoned Rejection",

        close_request:
            "Close Request",


        /* INCIDENTS */

        start_assessment:
            "Start Incident Assessment",

        record_containment:
            "Record Containment Measures",

        record_notification_assessment:
            "Record Notification Assessment",

        record_authority_notification:
            "Record Authority Notification",

        record_subject_notification:
            "Record Subject Notification",

        record_remediation:
            "Record Remediation",

        close_incident:
            "Close Incident",


        /* DATA SHARING */

        request_review:
            "Request Formal Review",

        record_safeguards:
            "Record Transfer Safeguards",

        approve_arrangement:
            "Approve Arrangement",

        suspend_arrangement:
            "Suspend Arrangement",

        terminate_arrangement:
            "Terminate Arrangement",


        /* RETENTION */

        place_legal_hold:
            "Place Legal Hold",

        release_legal_hold:
            "Request Legal Hold Release",

        authorize_disposal:
            "Authorize Disposal Review",

        record_disposal:
            "Record Authorized Disposal",


        /* PROCESSING REGISTER */

        approve_processing:
            "Approve Processing Activity",

        suspend_processing:
            "Suspend Processing Activity",

        retire_processing:
            "Retire Processing Activity"

    };


    const DECISION_ACTIONS = [

        "record_fulfilment",

        "record_partial_fulfilment",

        "record_rejection",

        "record_notification_assessment",

        "record_authority_notification",

        "record_subject_notification",

        "record_remediation",

        "record_safeguards",

        "record_disposal"

    ];


    const ASSIGN_ACTIONS = [

        "assign_officer"

    ];


    const DANGEROUS_ACTIONS = [

        "record_rejection",

        "suspend_arrangement",

        "terminate_arrangement",

        "authorize_disposal",

        "record_disposal",

        "suspend_processing",

        "restrict_processing"

    ];


    /* ========================================================
       05. DOM REFERENCES
       ======================================================== */

    const el = {

        app: $("consents-app"),

        locked: $("consents-locked"),

        accessMessage: $("consents-access-message"),


        notice: $("consents-notice"),

        systemStatus: $("consents-system-status"),


        refresh: $("consents-refresh"),

        exportButton: $("consents-export"),


        sidebar: $("sidebar"),

        sidebarOverlay: $("sidebar-overlay"),

        menuToggle: $("menu-toggle"),

        closeSidebar: $("close-sidebar"),


        detailOverlay: $("privacy-detail-overlay"),

        detailTitle: $("privacy-detail-title"),

        detailClose: $("privacy-detail-close"),

        detailContent: $("privacy-detail-content"),

        detailActions: $("privacy-detail-actions"),


        confirmOverlay: $("privacy-confirm-overlay"),

        confirmTitle: $("privacy-confirm-title"),

        confirmDescription: $("privacy-confirm-description"),

        assigneeField: $("privacy-assignee-field"),

        assigneeSelect: $("privacy-assignee-select"),

        decisionField: $("privacy-decision-field"),

        decision: $("privacy-decision"),

        reason: $("privacy-action-reason"),

        confirmCancel: $("privacy-confirm-cancel"),

        confirmSubmit: $("privacy-confirm-submit")

    };


    /* ========================================================
       06. SUMMARY METRIC REFERENCES
       ======================================================== */

    const METRICS = {

        consentsTotal:
            "metric-consents-total",

        activeConsents:
            "metric-consents-active",

        withdrawnConsents:
            "metric-consents-withdrawn",

        openRequests:
            "metric-requests-open",

        overdueRequests:
            "metric-requests-overdue",

        openIncidents:
            "metric-incidents-open",

        retentionDue:
            "metric-retention-due",

        activeSharing:
            "metric-sharing-active"

    };


    /* ========================================================
       07. MODULE DEFINITIONS
       ======================================================== */

    const MODULES = {

        consents: {

            endpoint: API.consents,

            detail: API.consentDetail,

            actions: API.consentActions,

            body: "privacy-consent-body",

            count: "privacy-consent-count",

            pageInfo: "privacy-consent-page-info",

            previous: "privacy-consent-prev",

            next: "privacy-consent-next",

            form: "privacy-consent-filter-form",

            clearButton: "privacy-consent-clear",

            columns: 11,

            filters: {

                search: "privacy-consent-search",

                status: "privacy-consent-status",

                partyType: "privacy-consent-party",

                purpose: "privacy-consent-purpose"

            },

            render: renderConsentRow

        },


        requests: {

            endpoint: API.requests,

            detail: API.requestDetail,

            actions: API.requestActions,

            body: "privacy-request-body",

            count: "privacy-request-count",

            pageInfo: "privacy-request-page-info",

            previous: "privacy-request-prev",

            next: "privacy-request-next",

            form: "privacy-request-filter-form",

            clearButton: "privacy-request-clear",

            columns: 10,

            filters: {

                search: "privacy-request-search",

                status: "privacy-request-status",

                type: "privacy-request-type"

            },

            render: renderRequestRow

        },


        incidents: {

            endpoint: API.incidents,

            detail: API.incidentDetail,

            actions: API.incidentActions,

            body: "privacy-incident-body",

            count: "privacy-incident-count",

            pageInfo: "privacy-incident-page-info",

            previous: "privacy-incident-prev",

            next: "privacy-incident-next",

            form: "privacy-incident-filter-form",

            clearButton: "privacy-incident-clear",

            columns: 10,

            filters: {

                search: "privacy-incident-search",

                status: "privacy-incident-status",

                severity: "privacy-incident-severity"

            },

            render: renderIncidentRow

        },


        sharing: {

            endpoint: API.sharing,

            detail: API.sharingDetail,

            actions: API.sharingActions,

            body: "privacy-sharing-body",

            count: "privacy-sharing-count",

            pageInfo: "privacy-sharing-page-info",

            previous: "privacy-sharing-prev",

            next: "privacy-sharing-next",

            form: "privacy-sharing-filter-form",

            clearButton: "privacy-sharing-clear",

            columns: 11,

            filters: {

                search: "privacy-sharing-search",

                status: "privacy-sharing-status",

                relationship: "privacy-sharing-type"

            },

            render: renderSharingRow

        },


        retention: {

            endpoint: API.retention,

            detail: API.retentionDetail,

            actions: API.retentionActions,

            body: "privacy-retention-body",

            count: "privacy-retention-count",

            pageInfo: "privacy-retention-page-info",

            previous: "privacy-retention-prev",

            next: "privacy-retention-next",

            form: "privacy-retention-filter-form",

            clearButton: "privacy-retention-clear",

            columns: 10,

            filters: {

                search: "privacy-retention-search",

                status: "privacy-retention-status"

            },

            render: renderRetentionRow

        },


        processing: {

            endpoint: API.processing,

            detail: API.processingDetail,

            actions: API.processingActions,

            body: "privacy-processing-body",

            count: "privacy-processing-count",

            pageInfo: "privacy-processing-page-info",

            previous: "privacy-processing-prev",

            next: "privacy-processing-next",

            form: "privacy-processing-filter-form",

            clearButton: "privacy-processing-clear",

            columns: 11,

            filters: {

                search: "privacy-processing-search",

                status: "privacy-processing-status"

            },

            render: renderProcessingRow

        },


        activity: {

            endpoint: API.activity,

            detail: null,

            actions: null,

            body: "privacy-activity-body",

            count: "privacy-activity-count",

            pageInfo: "privacy-activity-page-info",

            previous: "privacy-activity-prev",

            next: "privacy-activity-next",

            form: "privacy-activity-filter-form",

            clearButton: "privacy-activity-clear",

            columns: 8,

            filters: {

                search: "privacy-activity-search",

                category: "privacy-activity-category"

            },

            render: renderActivityRow

        }

    };


    /* ========================================================
       08. APPLICATION STATE
       ======================================================== */

    const state = {

        authorized: false,

        preview: false,

        csrfToken: null,


        selectedPanel: "overview",


        selectedType: null,

        selectedRecord: null,


        pendingAction: null,

        actionInProgress: false,


        previousFocus: null,


        requests: {

            summary: 0,

            detail: 0,

            export: 0,

            consents: 0,

            requests: 0,

            incidents: 0,

            sharing: 0,

            retention: 0,

            processing: 0,

            activity: 0

        },


        pages: {

            consents: {

                page: 1,

                totalPages: 0

            },

            requests: {

                page: 1,

                totalPages: 0

            },

            incidents: {

                page: 1,

                totalPages: 0

            },

            sharing: {

                page: 1,

                totalPages: 0

            },

            retention: {

                page: 1,

                totalPages: 0

            },

            processing: {

                page: 1,

                totalPages: 0

            },

            activity: {

                page: 1,

                totalPages: 0

            }

        },


        cache: {

            consents: [],

            requests: [],

            incidents: [],

            sharing: [],

            retention: [],

            processing: [],

            activity: []

        }

    };


    /* ========================================================
       09. SAFE DOM UTILITIES
       ======================================================== */

    function node(tag, className = "", value = null) {

        const element = document.createElement(tag);


        if (className) {

            element.className = className;

        }


        if (value !== null && value !== undefined) {

            element.textContent = String(value);

        }


        return element;

    }


    function safeValue(value) {

        if (

            value === null ||

            value === undefined ||

            value === ""

        ) {

            return "—";

        }


        if (Array.isArray(value)) {

            return value.length

                ? value.map(item =>

                    typeof item === "object"

                        ? item.label || item.name || "[Record]"

                        : String(item)

                ).join(", ")

                : "—";

        }


        if (typeof value === "object") {

            return value.label ||

                value.name ||

                value.reference ||

                "—";

        }


        return String(value);

    }


    function countValue(value) {

        if (

            !Number.isSafeInteger(value) ||

            value < 0

        ) {

            return "—";

        }


        return new Intl.NumberFormat("en").format(value);

    }


    function percentage(value) {

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


    function displayLabel(map, key) {

        return map[key] || safeValue(key);

    }


    function showNotice(message, type = "") {

        el.notice.className =

            "privacy-notice " + type;


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

            "privacy-fulfilment-rate",

            "privacy-incident-closure-rate",

            "privacy-verification-rate",

            "privacy-overdue-obligations",

            "privacy-performance-updated"

        ].forEach(id => {

            $(id).textContent = "—";

        });

    }


    /* ========================================================
       10. BADGE UTILITIES
       ======================================================== */

    function safeClass(value) {

        return String(value || "")

            .toLowerCase()

            .replace(/[^a-z0-9_-]/g, "");

    }


    function statusBadge(status, label = null) {

        const badge = node(

            "span",

            "privacy-status " + safeClass(status),

            label || safeValue(status)

        );


        return badge;

    }


    function priorityBadge(priority) {

        const allowed =

            ["critical", "high", "medium", "low"];


        const value = allowed.includes(priority)

            ? priority

            : "unknown";


        const labels = {

            critical: "Critical",

            high: "High",

            medium: "Medium",

            low: "Low",

            unknown: "Unavailable"

        };


        return node(

            "span",

            "privacy-priority " + value,

            labels[value]

        );

    }


    function statusCell(status, label) {

        const td = node("td");


        td.append(

            statusBadge(status, label)

        );


        return td;

    }


    function priorityCell(priority) {

        const td = node("td");


        td.append(

            priorityBadge(priority)

        );


        return td;

    }


    /* ========================================================
       11. TABLE UTILITIES
       ======================================================== */

    function addCell(row, value, className = "") {

        const td = node(

            "td",

            className,

            safeValue(value)

        );


        row.append(td);


        return td;

    }


    function addReferenceCell(

        row,

        reference,

        type,

        id

    ) {

        const td = node("td");


        const button = node(

            "button",

            "privacy-reference privacy-reference-button",

            safeValue(reference)

        );


        button.type = "button";


        button.addEventListener(

            "click",

            () => openDetail(type, id)

        );


        td.append(button);


        row.append(td);


        return td;

    }


    function actionCell(row, type, id, label = "View Details") {

        const td = node("td");


        const button = node(

            "button",

            "privacy-view-button",

            label

        );


        button.type = "button";


        button.addEventListener(

            "click",

            () => openDetail(type, id)

        );


        td.append(button);

        row.append(td);


        return td;

    }


    function emptyTable(

        tableId,

        colspan,

        title,

        description

    ) {

        const table = $(tableId);

        const row = node("tr");

        const td = node("td");

        const content = node(

            "div",

            "privacy-empty"

        );


        td.colSpan = colspan;


        if (title) {

            content.append(

                node("h4", "", title)

            );

        }


        content.append(

            node("p", "", description)

        );


        td.append(content);

        row.append(td);


        table.replaceChildren(row);

    }


    function emptyModule(key, message = null) {

        const config = MODULES[key];


        emptyTable(

            config.body,

            config.columns,

            "No records available",

            message ||

            "No records match the current selection."

        );


        $(config.count).textContent =

            "Records unavailable";


        $(config.pageInfo).textContent =

            "No records available";


        $(config.previous).disabled = true;

        $(config.next).disabled = true;

    }


    /* ========================================================
       12. APPLICATION VISIBILITY
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

        state.preview = false;

        state.csrfToken = null;


        invalidateRequests();


        closeAllPanels();


        el.app.hidden = true;

        el.locked.hidden = false;


        el.accessMessage.textContent = message;

    }


    /* ========================================================
       13. LOCAL FRONTEND PREVIEW
       ======================================================== */

    function enterLocalPreview() {

        state.authorized = false;

        state.preview = true;


        showApplication();


        setConnection("Frontend Preview");


        showNotice(

            "Frontend preview only. No actual consent records, " +

            "privacy requests, incidents, sharing arrangements, " +

            "processing records or retention data are connected. " +

            "Administrative actions and exports are unavailable.",

            "warning"

        );


        clearMetrics();


        Object.keys(MODULES).forEach(key => {

            emptyModule(

                key,

                "Connect the authorized privacy backend to retrieve actual records."

            );

        });


        $("privacy-category-list").replaceChildren(

            node(

                "div",

                "privacy-empty-inline",

                "Category statistics unavailable."

            )

        );


        renderOverviewQueues();

    }


    /* ========================================================
       14. API REQUEST HANDLER
       ======================================================== */

    async function requestJSON(url, options = {}) {

        const headers = {

            Accept: "application/json",

            ...options.headers

        };


        if (options.body !== undefined) {

            headers["Content-Type"] =

                "application/json";

        }


        const method =

            (options.method || "GET").toUpperCase();


        if (method !== "GET" && method !== "HEAD") {

            if (!state.csrfToken) {

                throw new Error(

                    "A valid security token is required."

                );

            }


            headers["X-CSRF-Token"] =

                state.csrfToken;

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

                "The privacy management service is unavailable."

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

                // Retain the default message.

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

                "The report service is unavailable."

            );

        }


        if (

            response.status === 401 ||

            response.status === 403

        ) {

            const error = new Error(

                "Report access authorization failed."

            );


            error.status = response.status;


            throw error;

        }


        if (!response.ok) {

            throw new Error(

                "The report could not be retrieved."

            );

        }


        const contentType =

            response.headers.get("content-type") || "";


        if (

            contentType.includes("text/html") ||

            contentType.includes("application/json")

        ) {

            throw new Error(

                "The server did not return a valid report file."

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
       15. DASHBOARD METRICS
       ======================================================== */

    function renderMetrics(metrics) {

        const values = {

            consentsTotal: metrics.consentsTotal,

            activeConsents: metrics.activeConsents,

            withdrawnConsents: metrics.withdrawnConsents,

            openRequests: metrics.openRequests,

            overdueRequests: metrics.overdueRequests,

            openIncidents: metrics.openIncidents,

            retentionDue: metrics.retentionReviewsDue,

            activeSharing: metrics.activeSharingArrangements

        };


        Object.entries(values).forEach(([key, value]) => {

            $(METRICS[key]).textContent =

                countValue(value);

        });

    }


    function renderPerformance(performance = {}) {

        $("privacy-fulfilment-rate").textContent =

            percentage(performance.requestFulfilmentRate);


        $("privacy-incident-closure-rate").textContent =

            percentage(performance.incidentClosureRate);


        $("privacy-verification-rate").textContent =

            percentage(performance.consentVerificationRate);


        $("privacy-overdue-obligations").textContent =

            countValue(performance.overdueObligations);


        $("privacy-performance-updated").textContent =

            formatDateTime(performance.updatedAt);

    }


    /* ========================================================
       16. CONSENT CATEGORY DISTRIBUTION
       ======================================================== */

    function renderCategories(categories) {

        const container = $("privacy-category-list");


        container.replaceChildren();


        if (

            !Array.isArray(categories) ||

            !categories.length

        ) {

            container.append(

                node(

                    "div",

                    "privacy-empty-inline",

                    "No consent category statistics available."

                )

            );


            return;

        }


        categories.forEach(item => {

            if (

                !item ||

                typeof item.count !== "number" ||

                !Number.isSafeInteger(item.count) ||

                item.count < 0

            ) {

                return;

            }


            const wrapper = node(

                "div",

                "privacy-category-item"

            );


            const heading = node(

                "div",

                "privacy-category-heading"

            );


            heading.append(

                node(

                    "span",

                    "",

                    safeValue(item.category)

                ),

                node(

                    "strong",

                    "",

                    countValue(item.count)

                )

            );


            const track = node(

                "div",

                "privacy-category-track"

            );


            const fill = node(

                "div",

                "privacy-category-fill"

            );


            const width =

                typeof item.percentage === "number" &&

                    Number.isFinite(item.percentage)

                    ? Math.max(

                        0,

                        Math.min(100, item.percentage)

                    )

                    : 0;


            fill.style.width = width + "%";


            track.append(fill);


            wrapper.append(heading, track);


            container.append(wrapper);

        });

    }


    /* ========================================================
       17. LOAD SUMMARY
       ======================================================== */

    async function loadSummary() {

        if (!state.authorized) return false;


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

                return false;

            }


            if (!result || !result.metrics) {

                throw new Error(

                    "Invalid privacy summary response."

                );

            }


            renderMetrics(result.metrics);


            renderPerformance(

                result.performance

            );


            renderCategories(

                result.consentCategoryBreakdown

            );


            return true;


        } catch (error) {

            if (requestId !== state.requests.summary) {

                return false;

            }


            if (handleAuthorizationError(error)) {

                return false;

            }


            clearMetrics();


            return false;

        }

    }


    /* ========================================================
       18. FILTER CONSTRUCTION
       ======================================================== */

    function buildModuleQuery(key) {

        const config = MODULES[key];

        const page = state.pages[key];


        const params = new URLSearchParams({

            page: String(page.page),

            limit: String(PAGE_SIZE)

        });


        Object.entries(config.filters).forEach(

            ([parameter, elementId]) => {

                const value =

                    $(elementId).value.trim();


                if (value) {

                    params.set(parameter, value);

                }

            }

        );


        return params;

    }


    /* ========================================================
       19. CONSENT TABLE ROW
       ======================================================== */

    function renderConsentRow(item) {

        const row = node("tr");


        addReferenceCell(

            row,

            item.reference,

            "consents",

            item.id

        );


        const subject = node("td");


        subject.append(

            node(

                "span",

                "privacy-primary-text",

                safeValue(item.subjectReference)

            ),

            node(

                "span",

                "privacy-secondary-text",

                safeValue(item.subjectDisplayLabel)

            )

        );


        row.append(subject);


        addCell(

            row,

            displayLabel(

                LABELS.partyType,

                item.subjectType

            )

        );


        addCell(

            row,

            item.purpose

        );


        addCell(

            row,

            displayLabel(

                LABELS.legalBasis,

                item.legalBasis

            )

        );


        addCell(

            row,

            item.consentVersion

        );


        const status =

            displayLabel(

                LABELS.consentStatus,

                item.status

            );


        row.append(

            statusCell(item.status, status)

        );


        addCell(

            row,

            formatDateTime(item.recordedAt)

        );


        addCell(

            row,

            formatDate(item.expiresAt)

        );


        addCell(

            row,

            item.source

        );


        actionCell(

            row,

            "consents",

            item.id

        );


        return row;

    }


    /* ========================================================
       20. DATA SUBJECT REQUEST ROW
       ======================================================== */

    function renderRequestRow(item) {

        const row = node("tr");


        addReferenceCell(

            row,

            item.reference,

            "requests",

            item.id

        );


        addCell(

            row,

            item.subjectReference,

            "privacy-primary-text"

        );


        addCell(

            row,

            displayLabel(

                LABELS.requestType,

                item.requestType

            )

        );


        row.append(

            statusCell(

                item.identityVerificationStatus,

                safeValue(item.identityVerificationStatus)

            )

        );


        row.append(

            statusCell(

                item.status,

                displayLabel(

                    LABELS.requestStatus,

                    item.status

                )

            )

        );


        addCell(

            row,

            item.assignee?.displayName

        );


        addCell(

            row,

            formatDate(item.submittedAt)

        );


        addCell(

            row,

            formatDate(item.dueAt)

        );


        row.append(

            priorityCell(item.priority)

        );


        actionCell(

            row,

            "requests",

            item.id

        );


        return row;

    }


    /* ========================================================
       21. INCIDENT ROW
       ======================================================== */

    function renderIncidentRow(item) {

        const row = node("tr");


        addReferenceCell(

            row,

            item.reference,

            "incidents",

            item.id

        );


        addCell(

            row,

            item.incidentType

        );


        row.append(

            priorityCell(item.severity)

        );


        row.append(

            statusCell(

                item.status,

                displayLabel(

                    LABELS.incidentStatus,

                    item.status

                )

            )

        );


        addCell(

            row,

            formatDateTime(item.detectedAt)

        );


        addCell(

            row,

            formatDateTime(item.reportedAt)

        );


        addCell(

            row,

            countValue(item.affectedRecordCount)

        );


        addCell(

            row,

            item.notificationAssessment?.status

        );


        addCell(

            row,

            item.responsibleOfficer?.displayName

        );


        actionCell(

            row,

            "incidents",

            item.id

        );


        return row;

    }


    /* ========================================================
       22. DATA SHARING ROW
       ======================================================== */

    function renderSharingRow(item) {

        const row = node("tr");


        addReferenceCell(

            row,

            item.reference,

            "sharing",

            item.id

        );


        addCell(

            row,

            item.recipient?.displayName

        );


        addCell(

            row,

            item.relationship

        );


        addCell(

            row,

            item.purpose

        );


        addCell(

            row,

            item.dataCategories

        );


        addCell(

            row,

            item.jurisdiction

        );


        addCell(

            row,

            item.safeguardStatus

        );


        addCell(

            row,

            item.agreementStatus

        );


        addCell(

            row,

            formatDate(item.nextReviewAt)

        );


        row.append(

            statusCell(

                item.status,

                displayLabel(

                    LABELS.sharingStatus,

                    item.status

                )

            )

        );


        actionCell(

            row,

            "sharing",

            item.id

        );


        return row;

    }


    /* ========================================================
       23. RETENTION ROW
       ======================================================== */

    function renderRetentionRow(item) {

        const row = node("tr");


        addReferenceCell(

            row,

            item.reference,

            "retention",

            item.id

        );


        addCell(

            row,

            item.recordCategory

        );


        addCell(

            row,

            item.department

        );


        addCell(

            row,

            item.retentionRule

        );


        addCell(

            row,

            item.retentionTrigger

        );


        addCell(

            row,

            countValue(item.eligibleRecordCount)

        );


        addCell(

            row,

            countValue(item.legalHoldCount)

        );


        addCell(

            row,

            formatDate(item.nextReviewAt)

        );


        row.append(

            statusCell(

                item.status,

                displayLabel(

                    LABELS.retentionStatus,

                    item.status

                )

            )

        );


        actionCell(

            row,

            "retention",

            item.id

        );


        return row;

    }


    /* ========================================================
       24. PROCESSING REGISTER ROW
       ======================================================== */

    function renderProcessingRow(item) {

        const row = node("tr");


        addReferenceCell(

            row,

            item.reference,

            "processing",

            item.id

        );


        addCell(

            row,

            item.activityName,

            "privacy-primary-text"

        );


        addCell(

            row,

            item.department

        );


        addCell(

            row,

            item.purpose

        );


        addCell(

            row,

            item.dataCategories

        );


        addCell(

            row,

            displayLabel(

                LABELS.legalBasis,

                item.legalBasis

            )

        );


        addCell(

            row,

            item.systemName

        );


        addCell(

            row,

            item.riskAssessment?.status

        );


        addCell(

            row,

            formatDate(item.nextReviewAt)

        );


        row.append(

            statusCell(

                item.status,

                displayLabel(

                    LABELS.processingStatus,

                    item.status

                )

            )

        );


        actionCell(

            row,

            "processing",

            item.id

        );


        return row;

    }


    /* ========================================================
       25. AUDIT ACTIVITY ROW
       ======================================================== */

    function renderActivityRow(item) {

        const row = node("tr");


        addReferenceCell(

            row,

            item.eventReference,

            "activity",

            item.id

        );


        addCell(

            row,

            item.event

        );


        addCell(

            row,

            item.category

        );


        addCell(

            row,

            item.relatedReference

        );


        addCell(

            row,

            item.actor?.displayName

        );


        addCell(

            row,

            item.description

        );


        addCell(

            row,

            formatDateTime(item.timestamp)

        );


        addCell(

            row,

            item.integrityReference

        );


        return row;

    }


    /* ========================================================
       26. PAGINATION
       ======================================================== */

    function updatePagination(key, result) {

        const config = MODULES[key];


        if (

            !result.pagination ||

            !Number.isSafeInteger(result.pagination.total) ||

            result.pagination.total < 0 ||

            !Number.isSafeInteger(result.pagination.totalPages) ||

            result.pagination.totalPages < 0

        ) {

            throw new Error(

                "Invalid pagination response for " + key

            );

        }


        const page = state.pages[key];


        page.totalPages =

            result.pagination.totalPages;


        $(config.count).textContent =

            countValue(result.pagination.total) +

            " records";


        $(config.pageInfo).textContent =

            result.pagination.totalPages > 0

                ? `Page ${page.page} of ${page.totalPages}`

                : "No pages";


        $(config.previous).disabled =

            page.page <= 1;


        $(config.next).disabled =

            page.totalPages === 0 ||

            page.page >= page.totalPages;

    }


    /* ========================================================
       27. RENDER MODULE RESULTS
       ======================================================== */

    function renderModule(key, result) {

        const config = MODULES[key];


        if (

            !result ||

            !Array.isArray(result.items) ||

            !result.pagination

        ) {

            throw new Error(

                "Invalid " + key + " register response."

            );

        }


        const fragment =

            document.createDocumentFragment();


        result.items.forEach(item => {

            if (

                !item ||

                typeof item.id !== "string" ||

                !item.id

            ) {

                return;

            }


            try {

                fragment.append(

                    config.render(item)

                );

            } catch {

                // Ignore malformed individual records.

            }

        });


        if (!fragment.childNodes.length) {

            emptyModule(

                key,

                "No records match the current filters."

            );

        } else {

            $(config.body).replaceChildren(fragment);

        }


        updatePagination(key, result);


        state.cache[key] = result.items;


        if (

            key === "requests" ||

            key === "incidents"

        ) {

            renderOverviewQueues();

        }

    }


    /* ========================================================
       28. LOAD MODULE DATA
       ======================================================== */

    async function loadModule(key) {

        if (!state.authorized) return false;


        const config = MODULES[key];


        if (!config) return false;


        const requestId =

            ++state.requests[key];


        emptyModule(

            key,

            "Retrieving authorized records..."

        );


        try {

            const result = await requestJSON(

                config.endpoint +

                "?" +

                buildModuleQuery(key).toString()

            );


            if (

                requestId !== state.requests[key] ||

                !state.authorized

            ) {

                return false;

            }


            renderModule(key, result);


            return true;


        } catch (error) {

            if (requestId !== state.requests[key]) {

                return false;

            }


            if (handleAuthorizationError(error)) {

                return false;

            }


            emptyModule(

                key,

                "The service could not retrieve these records."

            );


            return false;

        }

    }


    /* ========================================================
       29. OVERVIEW QUEUES
       ======================================================== */

    function renderOverviewQueues() {

        const requestBody =

            $("privacy-overview-requests-body");


        const incidentBody =

            $("privacy-overview-incidents-body");


        requestBody.replaceChildren();

        incidentBody.replaceChildren();


        const requests = state.cache.requests || [];


        const incidents = state.cache.incidents || [];


        const requestFragment =

            document.createDocumentFragment();


        requests.slice(0, 5).forEach(item => {

            const row = node("tr");


            addCell(

                row,

                item.reference,

                "privacy-reference"

            );


            addCell(

                row,

                displayLabel(

                    LABELS.requestType,

                    item.requestType

                )

            );


            row.append(

                statusCell(

                    item.status,

                    displayLabel(

                        LABELS.requestStatus,

                        item.status

                    )

                )

            );


            addCell(

                row,

                formatDate(item.dueAt)

            );


            requestFragment.append(row);

        });


        if (!requestFragment.childNodes.length) {

            const row = node("tr");

            const td = node(

                "td",

                "privacy-loading-cell",

                "No request records loaded."

            );


            td.colSpan = 4;

            row.append(td);


            requestBody.append(row);

        } else {

            requestBody.append(requestFragment);

        }


        const incidentFragment =

            document.createDocumentFragment();


        incidents.slice(0, 5).forEach(item => {

            const row = node("tr");


            addCell(

                row,

                item.reference,

                "privacy-reference"

            );


            row.append(

                priorityCell(item.severity),

                statusCell(

                    item.status,

                    displayLabel(

                        LABELS.incidentStatus,

                        item.status

                    )

                )

            );


            addCell(

                row,

                formatDate(item.reportedAt)

            );


            incidentFragment.append(row);

        });


        if (!incidentFragment.childNodes.length) {

            const row = node("tr");

            const td = node(

                "td",

                "privacy-loading-cell",

                "No incident records loaded."

            );


            td.colSpan = 4;

            row.append(td);


            incidentBody.append(row);

        } else {

            incidentBody.append(incidentFragment);

        }

    }


    /* ========================================================
       30. DETAIL FIELD HELPERS
       ======================================================== */

    function detailField(label, value) {

        const wrapper = node(

            "div",

            "privacy-detail-field"

        );


        wrapper.append(

            node("label", "", label)

        );


        const paragraph = node("p");


        if (value instanceof Node) {

            paragraph.append(value);

        } else {

            paragraph.textContent = safeValue(value);

        }


        wrapper.append(paragraph);


        return wrapper;

    }


    function detailSection(title, fields = []) {

        const section = node(

            "section",

            "privacy-detail-section"

        );


        section.append(

            node("h3", "", title)

        );


        fields.forEach(field => {

            if (field) {

                section.append(field);

            }

        });


        return section;

    }


    function historySection(history) {

        const section = detailSection(

            "Record History & Interventions"

        );


        if (

            !Array.isArray(history) ||

            !history.length

        ) {

            section.append(

                node(

                    "p",

                    "",

                    "No historical events are available."

                )

            );


            return section;

        }


        const timeline = node(

            "div",

            "privacy-timeline"

        );


        history.forEach(event => {

            if (!event) return;


            const item = node(

                "div",

                "privacy-timeline-item"

            );


            item.append(

                node(

                    "strong",

                    "",

                    safeValue(event.event)

                ),

                node(

                    "p",

                    "",

                    safeValue(event.description)

                ),

                node(

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
       31. CONSENT RECORD DETAILS
       ======================================================== */

    function renderConsentDetails(record) {

        const subject = record.subject || {};

        const evidence = record.evidence || {};

        const withdrawal = record.withdrawal || {};


        return [

            detailSection(

                "Consent Event",

                [

                    detailField("Reference", record.reference),

                    detailField("Record Status", displayLabel(LABELS.consentStatus, record.status)),

                    detailField("Consent Version", record.consentVersion),

                    detailField("Event Type", record.eventType),

                    detailField("Recorded At", formatDateTime(record.recordedAt)),

                    detailField("Capture Channel", record.source),

                    detailField("Capture Method", record.captureMethod)

                ]

            ),


            detailSection(

                "Data Subject",

                [

                    detailField("Subject Reference", subject.reference),

                    detailField("Subject Type", displayLabel(LABELS.partyType, subject.type)),

                    detailField("Display Label", subject.displayLabel),

                    detailField("Identity Verification", subject.verificationStatus)

                ]

            ),


            detailSection(

                "Purpose & Legal Basis",

                [

                    detailField("Processing Purpose", record.purpose),

                    detailField("Purpose Description", record.purposeDescription),

                    detailField("Legal Basis", displayLabel(LABELS.legalBasis, record.legalBasis)),

                    detailField("Data Categories", record.dataCategories),

                    detailField("Recipients", record.recipients),

                    detailField("Expiry Date", formatDateTime(record.expiresAt))

                ]

            ),


            detailSection(

                "Consent Evidence & Integrity",

                [

                    detailField("Evidence Reference", evidence.reference),

                    detailField("Evidence Type", evidence.type),

                    detailField("Integrity Status", evidence.integrityStatus),

                    detailField("Captured Version", evidence.capturedVersion),

                    detailField("Verification Status", record.verificationStatus),

                    detailField("Verification Date", formatDateTime(record.verifiedAt))

                ]

            ),


            detailSection(

                "Withdrawal History",

                [

                    detailField("Withdrawal Status", withdrawal.status),

                    detailField("Withdrawal Reference", withdrawal.reference),

                    detailField("Received At", formatDateTime(withdrawal.receivedAt)),

                    detailField("Effective At", formatDateTime(withdrawal.effectiveAt)),

                    detailField("Recorded By", withdrawal.recordedBy),

                    detailField("Processing Consequence", withdrawal.processingConsequence)

                ]

            ),


            historySection(record.history)

        ];

    }


    /* ========================================================
       32. DATA SUBJECT REQUEST DETAILS
       ======================================================== */

    function renderRequestDetails(record) {

        const subject = record.subject || {};

        const identity = record.identityVerification || {};

        const review = record.review || {};

        const response = record.response || {};


        return [

            detailSection(

                "Request Overview",

                [

                    detailField("Request Reference", record.reference),

                    detailField("Request Type", displayLabel(LABELS.requestType, record.requestType)),

                    detailField("Status", displayLabel(LABELS.requestStatus, record.status)),

                    detailField("Submission Date", formatDateTime(record.submittedAt)),

                    detailField("Due Date", formatDateTime(record.dueAt)),

                    detailField("Priority", record.priority),

                    detailField("Source Portal", record.sourcePortal)

                ]

            ),


            detailSection(

                "Data Subject & Identity",

                [

                    detailField("Subject Reference", subject.reference),

                    detailField("Subject Type", displayLabel(LABELS.partyType, subject.type)),

                    detailField("Display Label", subject.displayLabel),

                    detailField("Verification Status", identity.status),

                    detailField("Verification Method", identity.method),

                    detailField("Verified At", formatDateTime(identity.verifiedAt)),

                    detailField("Verified By", identity.verifiedBy)

                ]

            ),


            detailSection(

                "Request Scope",

                [

                    detailField("Request Description", record.description),

                    detailField("Requested Data Categories", record.dataCategories),

                    detailField("Affected Systems", record.affectedSystems),

                    detailField("Requested Outcome", record.requestedOutcome),

                    detailField("Scope Assessment", record.scopeAssessment)

                ]

            ),


            detailSection(

                "Review & Responsibility",

                [

                    detailField("Assigned Officer", record.assignee?.displayName),

                    detailField("Officer Reference", record.assignee?.reference),

                    detailField("Review Started", formatDateTime(review.startedAt)),

                    detailField("Review Findings", review.findings),

                    detailField("Applicable Exemptions", review.exemptions),

                    detailField("Legal Review", review.legalReviewStatus)

                ]

            ),


            detailSection(

                "Response & Outcome",

                [

                    detailField("Response Status", response.status),

                    detailField("Fulfilment Details", response.details),

                    detailField("Response Date", formatDateTime(response.sentAt)),

                    detailField("Decision Reason", response.reason),

                    detailField("Completion Date", formatDateTime(response.completedAt))

                ]

            ),


            historySection(record.history)

        ];

    }


    /* ========================================================
       33. INCIDENT DETAILS
       ======================================================== */

    function renderIncidentDetails(record) {

        const impact = record.impact || {};

        const assessment = record.assessment || {};

        const notification = record.notification || {};

        const containment = record.containment || {};

        const remediation = record.remediation || {};


        return [

            detailSection(

                "Incident Overview",

                [

                    detailField("Incident Reference", record.reference),

                    detailField("Incident Type", record.incidentType),

                    detailField("Severity", record.severity),

                    detailField("Status", displayLabel(LABELS.incidentStatus, record.status)),

                    detailField("Detection Date", formatDateTime(record.detectedAt)),

                    detailField("Reported Date", formatDateTime(record.reportedAt)),

                    detailField("Incident Source", record.source)

                ]

            ),


            detailSection(

                "Impact Assessment",

                [

                    detailField("Incident Description", record.description),

                    detailField("Affected Data Categories", impact.dataCategories),

                    detailField("Affected Systems", impact.systems),

                    detailField("Affected Records", countValue(impact.affectedRecordCount)),

                    detailField("Affected Individuals", countValue(impact.affectedSubjectCount)),

                    detailField("Risk Assessment", impact.riskLevel),

                    detailField("Potential Consequences", impact.consequences)

                ]

            ),


            detailSection(

                "Investigation",

                [

                    detailField("Responsible Officer", record.responsibleOfficer?.displayName),

                    detailField("Investigation Status", assessment.status),

                    detailField("Investigation Findings", assessment.findings),

                    detailField("Root Cause", assessment.rootCause),

                    detailField("Assessment Completed", formatDateTime(assessment.completedAt))

                ]

            ),


            detailSection(

                "Notification Assessment",

                [

                    detailField("Notification Decision", notification.assessmentStatus),

                    detailField("Authority Notification Required", notification.authorityRequired),

                    detailField("Authority Notification Status", notification.authorityStatus),

                    detailField("Authority Notification Date", formatDateTime(notification.authorityNotifiedAt)),

                    detailField("Affected Subject Notification", notification.subjectStatus),

                    detailField("Subject Notification Date", formatDateTime(notification.subjectNotifiedAt)),

                    detailField("Assessment Reason", notification.reason)

                ]

            ),


            detailSection(

                "Containment & Remediation",

                [

                    detailField("Containment Status", containment.status),

                    detailField("Containment Measures", containment.measures),

                    detailField("Contained At", formatDateTime(containment.completedAt)),

                    detailField("Remediation Status", remediation.status),

                    detailField("Remediation Actions", remediation.actions),

                    detailField("Remediation Completed", formatDateTime(remediation.completedAt))

                ]

            ),


            historySection(record.history)

        ];

    }


    /* ========================================================
       34. DATA SHARING DETAILS
       ======================================================== */

    function renderSharingDetails(record) {

        const recipient = record.recipient || {};

        const safeguards = record.safeguards || {};

        const agreement = record.agreement || {};

        const review = record.review || {};


        return [

            detailSection(

                "Sharing Arrangement",

                [

                    detailField("Reference", record.reference),

                    detailField("Status", record.status),

                    detailField("Relationship Type", record.relationship),

                    detailField("Arrangement Purpose", record.purpose),

                    detailField("Start Date", formatDate(record.startDate)),

                    detailField("End Date", formatDate(record.endDate))

                ]

            ),


            detailSection(

                "Recipient Information",

                [

                    detailField("Recipient", recipient.displayName),

                    detailField("Recipient Reference", recipient.reference),

                    detailField("Recipient Role", recipient.role),

                    detailField("Jurisdiction", record.jurisdiction),

                    detailField("Location of Processing", record.processingLocation)

                ]

            ),


            detailSection(

                "Data & Processing Scope",

                [

                    detailField("Data Categories", record.dataCategories),

                    detailField("Data Subjects", record.dataSubjects),

                    detailField("Sharing Purpose", record.purpose),

                    detailField("Processing Instructions", record.processingInstructions),

                    detailField("Access Restrictions", record.accessRestrictions)

                ]

            ),


            detailSection(

                "Transfer Safeguards",

                [

                    detailField("Transfer Mechanism", safeguards.transferMechanism),

                    detailField("Safeguard Status", safeguards.status),

                    detailField("Risk Assessment", safeguards.riskAssessment),

                    detailField("Security Measures", safeguards.securityMeasures),

                    detailField("Subprocessor Controls", safeguards.subprocessorControls),

                    detailField("Transfer Review", safeguards.reviewStatus)

                ]

            ),


            detailSection(

                "Agreement & Review",

                [

                    detailField("Agreement Reference", agreement.reference),

                    detailField("Agreement Type", agreement.type),

                    detailField("Agreement Status", agreement.status),

                    detailField("Agreement Expiry", formatDate(agreement.expiresAt)),

                    detailField("Last Review", formatDate(review.lastReviewedAt)),

                    detailField("Next Review", formatDate(review.nextReviewAt)),

                    detailField("Review Findings", review.findings)

                ]

            ),


            historySection(record.history)

        ];

    }


    /* ========================================================
       35. RETENTION DETAILS
       ======================================================== */

    function renderRetentionDetails(record) {

        const rule = record.rule || {};

        const legalHold = record.legalHold || {};

        const disposal = record.disposal || {};


        return [

            detailSection(

                "Retention Schedule",

                [

                    detailField("Schedule Reference", record.reference),

                    detailField("Record Category", record.recordCategory),

                    detailField("Responsible Department", record.department),

                    detailField("Schedule Status", displayLabel(LABELS.retentionStatus, record.status)),

                    detailField("Record System", record.systemName)

                ]

            ),


            detailSection(

                "Retention Rules",

                [

                    detailField("Retention Period", rule.period),

                    detailField("Retention Trigger", rule.trigger),

                    detailField("Rule Description", rule.description),

                    detailField("Applicable Basis", rule.basis),

                    detailField("Review Date", formatDate(record.nextReviewAt))

                ]

            ),


            detailSection(

                "Record Eligibility",

                [

                    detailField("Total Records", countValue(record.totalRecordCount)),

                    detailField("Eligible for Review", countValue(record.eligibleRecordCount)),

                    detailField("Records Under Hold", countValue(record.legalHoldCount)),

                    detailField("Pending Review", countValue(record.pendingReviewCount))

                ]

            ),


            detailSection(

                "Legal Holds",

                [

                    detailField("Hold Status", legalHold.status),

                    detailField("Hold Reference", legalHold.reference),

                    detailField("Hold Reason", legalHold.reason),

                    detailField("Hold Authority", legalHold.authority),

                    detailField("Hold Commencement", formatDate(legalHold.startedAt)),

                    detailField("Hold Review Date", formatDate(legalHold.reviewAt))

                ]

            ),


            detailSection(

                "Disposal Record",

                [

                    detailField("Disposal Status", disposal.status),

                    detailField("Authorization Reference", disposal.authorizationReference),

                    detailField("Approved By", disposal.approvedBy),

                    detailField("Disposal Method", disposal.method),

                    detailField("Disposal Date", formatDateTime(disposal.completedAt)),

                    detailField("Integrity / Verification Reference", disposal.integrityReference)

                ]

            ),


            historySection(record.history)

        ];

    }


    /* ========================================================
       36. PROCESSING REGISTER DETAILS
       ======================================================== */

    function renderProcessingDetails(record) {

        const risk = record.riskAssessment || {};

        const security = record.security || {};

        const retention = record.retention || {};


        return [

            detailSection(

                "Processing Activity",

                [

                    detailField("Activity Reference", record.reference),

                    detailField("Activity Name", record.activityName),

                    detailField("Responsible Department", record.department),

                    detailField("Processing Status", record.status),

                    detailField("System", record.systemName),

                    detailField("Activity Owner", record.owner?.displayName)

                ]

            ),


            detailSection(

                "Purpose & Legal Basis",

                [

                    detailField("Processing Purpose", record.purpose),

                    detailField("Purpose Description", record.purposeDescription),

                    detailField("Legal Basis", displayLabel(LABELS.legalBasis, record.legalBasis)),

                    detailField("Additional Conditions", record.additionalConditions),

                    detailField("Compatibility Assessment", record.compatibilityAssessment)

                ]

            ),


            detailSection(

                "Personal Data Categories",

                [

                    detailField("Data Categories", record.dataCategories),

                    detailField("Data Subjects", record.dataSubjects),

                    detailField("Special Category Data", record.specialCategoryData),

                    detailField("Source of Data", record.dataSources)

                ]

            ),


            detailSection(

                "Recipients & Transfers",

                [

                    detailField("Recipients", record.recipients),

                    detailField("International Transfers", record.internationalTransfers),

                    detailField("Transfer Safeguards", record.transferSafeguards),

                    detailField("Subprocessors", record.subprocessors)

                ]

            ),


            detailSection(

                "Retention & Security",

                [

                    detailField("Retention Rule", retention.rule),

                    detailField("Retention Period", retention.period),

                    detailField("Access Controls", security.accessControls),

                    detailField("Security Measures", security.measures),

                    detailField("Encryption Status", security.encryptionStatus)

                ]

            ),


            detailSection(

                "Risk & Assessment",

                [

                    detailField("Risk Assessment Status", risk.status),

                    detailField("Risk Level", risk.level),

                    detailField("Assessment Reference", risk.reference),

                    detailField("Assessment Findings", risk.findings),

                    detailField("DPIA Status", risk.dpiaStatus),

                    detailField("Last Review", formatDate(record.lastReviewedAt)),

                    detailField("Next Review", formatDate(record.nextReviewAt))

                ]

            ),


            historySection(record.history)

        ];

    }


    /* ========================================================
       37. ACTIVITY DETAIL
       ======================================================== */

    function renderActivityDetails(record) {

        return [

            detailSection(

                "Audit Event",

                [

                    detailField("Event Reference", record.eventReference),

                    detailField("Event Name", record.event),

                    detailField("Category", record.category),

                    detailField("Related Record", record.relatedReference),

                    detailField("Timestamp", formatDateTime(record.timestamp))

                ]

            ),


            detailSection(

                "Actor & Authorization",

                [

                    detailField("Actor", record.actor?.displayName),

                    detailField("Actor Reference", record.actor?.reference),

                    detailField("Actor Role", record.actor?.role),

                    detailField("Authorization Context", record.authorizationContext),

                    detailField("Session Reference", record.sessionReference)

                ]

            ),


            detailSection(

                "Event Integrity",

                [

                    detailField("Description", record.description),

                    detailField("Integrity Reference", record.integrityReference),

                    detailField("Previous Event Reference", record.previousEventReference),

                    detailField("Verification Status", record.integrityStatus)

                ]

            )

        ];

    }


    /* ========================================================
       38. DETAIL RENDERER
       ======================================================== */

    const DETAIL_RENDERERS = {

        consents: renderConsentDetails,

        requests: renderRequestDetails,

        incidents: renderIncidentDetails,

        sharing: renderSharingDetails,

        retention: renderRetentionDetails,

        processing: renderProcessingDetails,

        activity: renderActivityDetails

    };


    /* ========================================================
       39. OPEN RECORD DETAIL
       ======================================================== */

    async function openDetail(type, id) {

        if (!state.authorized) return;


        const config = MODULES[type];


        if (

            !config ||

            !config.detail ||

            !DETAIL_RENDERERS[type] ||

            typeof id !== "string" ||

            !id

        ) {

            return;

        }


        const requestId = ++state.requests.detail;


        showNotice(

            "Retrieving authorized privacy record..."

        );


        try {

            const record = await requestJSON(

                config.detail(id)

            );


            if (

                requestId !== state.requests.detail ||

                !state.authorized

            ) {

                return;

            }


            if (

                !record ||

                record.id !== id ||

                !Array.isArray(record.availableActions)

            ) {

                throw new Error(

                    "Invalid privacy record response."

                );

            }


            state.previousFocus = document.activeElement;


            state.selectedType = type;

            state.selectedRecord = record;


            el.detailTitle.textContent =

                safeValue(

                    record.reference ||

                    record.eventReference

                );


            el.detailContent.replaceChildren();


            const sections =

                DETAIL_RENDERERS[type](record);


            sections.forEach(section => {

                el.detailContent.append(section);

            });


            renderAvailableActions(record, type);


            el.detailOverlay.hidden = false;


            updateBodyScroll();


            el.detailClose.focus();


            showNotice(

                "Privacy record retrieved successfully.",

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

                "The selected privacy record could not be retrieved.",

                "error"

            );

        }

    }


    /* ========================================================
       40. SERVER-AUTHORIZED ACTIONS
       ======================================================== */

    function renderAvailableActions(record, type) {

        const fragment =

            document.createDocumentFragment();


        fragment.append(

            node(

                "p",

                "privacy-action-note",

                "Only interventions explicitly authorized by the server " +

                "are available. Administrative justification is required " +

                "and every accepted action must be auditable."

            )

        );


        const actions = [

            ...new Set(

                record.availableActions.filter(action =>

                    typeof action === "string" &&

                    Object.hasOwn(ACTION_LABELS, action)

                )

            )

        ];


        actions.forEach(action => {

            const button = node(

                "button",

                DANGEROUS_ACTIONS.includes(action)

                    ? "btn btn-danger"

                    : "btn btn-secondary",

                ACTION_LABELS[action]

            );


            button.type = "button";


            button.addEventListener(

                "click",

                () => requestAction(type, action)

            );


            fragment.append(button);

        });


        if (!actions.length) {

            fragment.append(

                node(

                    "p",

                    "",

                    "No administrative interventions are currently authorized."

                )

            );

        }


        el.detailActions.replaceChildren(fragment);

    }


    /* ========================================================
       41. REQUEST ACTION
       ======================================================== */

    function requestAction(type, action) {

        if (

            !state.authorized ||

            state.actionInProgress ||

            !Object.hasOwn(ACTION_LABELS, action)

        ) {

            return;

        }


        const record = state.selectedRecord;


        if (

            !record ||

            !record.availableActions.includes(action)

        ) {

            return;

        }


        state.pendingAction = {

            type,

            action,

            id: record.id

        };


        el.confirmTitle.textContent =

            "Confirm: " + ACTION_LABELS[action];


        el.confirmDescription.textContent =

            ACTION_LABELS[action] +

            ". Reference: " +

            safeValue(

                record.reference ||

                record.eventReference

            ) +

            ". Review the governance implications before proceeding.";


        el.reason.value = "";

        el.decision.value = "";


        el.assigneeField.hidden = true;

        el.decisionField.hidden =

            !DECISION_ACTIONS.includes(action);


        el.assigneeSelect.replaceChildren(

            new Option(

                "Select authorized officer",

                ""

            )

        );


        if (ASSIGN_ACTIONS.includes(action)) {

            const officers = record.availableOfficers;


            if (

                !Array.isArray(officers) ||

                !officers.length

            ) {

                showNotice(

                    "No authorized officers are available for assignment.",

                    "warning"

                );


                return;

            }


            officers.forEach(officer => {

                if (

                    typeof officer.id === "string" &&

                    officer.id &&

                    typeof officer.displayName === "string"

                ) {

                    el.assigneeSelect.append(

                        new Option(

                            officer.displayName,

                            officer.id

                        )

                    );

                }

            });


            el.assigneeField.hidden = false;

        }


        state.previousFocus = document.activeElement;


        el.confirmSubmit.disabled = true;

        el.confirmCancel.disabled = false;


        el.confirmSubmit.textContent =

            "Confirm Action";


        el.confirmOverlay.hidden = false;


        updateBodyScroll();


        el.reason.focus();

    }


    /* ========================================================
       42. CONFIRMATION VALIDATION
       ======================================================== */

    function updateConfirmationState() {

        if (

            !state.pendingAction ||

            !state.authorized

        ) {

            el.confirmSubmit.disabled = true;

            return;

        }


        const action =

            state.pendingAction.action;


        const reasonValid =

            el.reason.value.trim().length >= 5;


        const decisionValid =

            !DECISION_ACTIONS.includes(action) ||

            el.decision.value.trim().length >= 5;


        const assigneeValid =

            !ASSIGN_ACTIONS.includes(action) ||

            Boolean(el.assigneeSelect.value);


        el.confirmSubmit.disabled =

            !reasonValid ||

            !decisionValid ||

            !assigneeValid;

    }


    /* ========================================================
       43. CLOSE CONFIRMATION
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
       44. EXECUTE ADMINISTRATIVE ACTION
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


        const record = state.selectedRecord;


        if (

            !record ||

            record.id !== pending.id ||

            !record.availableActions.includes(pending.action)

        ) {

            showNotice(

                "The selected record or its authorization has changed. Reload it before continuing.",

                "warning"

            );


            closeConfirmation();

            return;

        }


        const reason =

            el.reason.value.trim();


        const decision =

            el.decision.value.trim();


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

                "Document the decision or intervention outcome.",

                "warning"

            );


            el.decision.focus();


            return;

        }


        const payload = {

            action: pending.action,

            reason,

            outcome: decision || undefined

        };


        if (ASSIGN_ACTIONS.includes(pending.action)) {

            const assigneeId =

                el.assigneeSelect.value;


            if (!assigneeId) {

                showNotice(

                    "Select an authorized officer.",

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


        const endpoint =

            MODULES[pending.type].actions(pending.id);


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


            closeDetail();


            showNotice(

                result?.message ||

                "The administrative intervention was accepted by the server.",

                "success"

            );


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
       45. DETAIL DRAWER MANAGEMENT
       ======================================================== */

    function closeDetail() {

        state.requests.detail++;


        el.detailOverlay.hidden = true;


        state.selectedType = null;

        state.selectedRecord = null;


        el.detailContent.replaceChildren();

        el.detailActions.replaceChildren();


        updateBodyScroll();


        restoreFocus();

    }


    function closeAllPanels() {

        el.detailOverlay.hidden = true;

        el.confirmOverlay.hidden = true;


        el.detailContent.replaceChildren();

        el.detailActions.replaceChildren();


        state.selectedType = null;

        state.selectedRecord = null;

        state.pendingAction = null;

        state.actionInProgress = false;


        updateBodyScroll();

    }


    function updateBodyScroll() {

        const open =

            !el.detailOverlay.hidden ||

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
       46. MODULE NAVIGATION
       ======================================================== */

    function switchPanel(key) {

        if (

            ![

                "overview",

                ...Object.keys(MODULES)

            ].includes(key)

        ) {

            return;

        }


        state.selectedPanel = key;


        document.querySelectorAll(

            ".privacy-module-tab"

        ).forEach(button => {

            const active =

                button.dataset.panelTarget === key;


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


        document.querySelectorAll(

            ".privacy-panel"

        ).forEach(panel => {

            const active =

                panel.id === "privacy-panel-" + key;


            panel.hidden = !active;

            panel.classList.toggle(

                "active",

                active

            );

        });


        if (

            state.authorized &&

            key !== "overview"

        ) {

            loadModule(key);

        }

    }


    /* ========================================================
       47. MODULE FILTERS
       ======================================================== */

    function applyFilters(key) {

        state.pages[key].page = 1;


        loadModule(key);

    }


    function clearFilters(key) {

        const config = MODULES[key];


        $(config.form).reset();


        state.pages[key].page = 1;


        loadModule(key);

    }


    /* ========================================================
       48. PAGINATION CONTROLS
       ======================================================== */

    function changePage(key, direction) {

        if (!state.authorized) return;


        const page = state.pages[key];


        const next = page.page + direction;


        if (

            next < 1 ||

            next > page.totalPages

        ) {

            return;

        }


        page.page = next;


        loadModule(key);

    }


    /* ========================================================
       49. EXPORT PRIVACY REPORT
       ======================================================== */

    async function exportReport() {

        if (!state.authorized) return;


        const requestId = ++state.requests.export;


        const originalText =

            el.exportButton.textContent;


        el.exportButton.disabled = true;

        el.exportButton.textContent =

            "Preparing Report...";


        try {

            const result = await requestFile(

                API.export

            );


            if (

                requestId !== state.requests.export ||

                !state.authorized

            ) {

                return;

            }


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

                : "talvora-privacy-report.csv";


            try {

                filename = decodeURIComponent(filename);

            } catch {

                // Retain the supplied filename.

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

                "The authorized privacy report has been prepared.",

                "success"

            );


        } catch (error) {

            if (!handleAuthorizationError(error)) {

                showNotice(

                    error.message ||

                    "The privacy report could not be exported.",

                    "error"

                );

            }

        } finally {

            el.exportButton.disabled = false;

            el.exportButton.textContent = originalText;

        }

    }


    /* ========================================================
       50. REFRESH ALL MODULES
       ======================================================== */

    async function refreshAll() {

        if (!state.authorized) return;


        showNotice(

            "Refreshing privacy, consent, incident and governance information..."

        );


        const results = await Promise.all([

            loadSummary(),

            ...Object.keys(MODULES).map(key =>

                loadModule(key)

            )

        ]);


        if (!state.authorized) return;


        const successful =

            results.every(Boolean);


        if (successful) {

            showNotice(

                "All privacy management services have been refreshed.",

                "success"

            );

        } else {

            showNotice(

                "Some privacy records could not be refreshed. " +

                "Unavailable information is not represented as zero.",

                "warning"

            );

        }

    }


    /* ========================================================
       51. SIDEBAR
       ======================================================== */

    function openSidebar() {

        el.sidebar.classList.add(

            "sidebar-open"

        );


        el.sidebarOverlay.hidden = false;


        el.menuToggle.setAttribute(

            "aria-expanded",

            "true"

        );

    }


    function closeSidebar() {

        el.sidebar.classList.remove(

            "sidebar-open"

        );


        el.sidebarOverlay.hidden = true;


        el.menuToggle.setAttribute(

            "aria-expanded",

            "false"

        );

    }


    /* ========================================================
       52. EVENT REGISTRATION
       ======================================================== */

    function registerEvents() {


        /* SIDEBAR */

        el.menuToggle.addEventListener(

            "click",

            openSidebar

        );


        el.closeSidebar.addEventListener(

            "click",

            closeSidebar

        );


        el.sidebarOverlay.addEventListener(

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


        /* MODULE TABS */

        const tabs = Array.from(

            document.querySelectorAll(

                ".privacy-module-tab"

            )

        );


        tabs.forEach((button, index) => {

            button.addEventListener(

                "click",

                () => switchPanel(

                    button.dataset.panelTarget

                )

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


                    switchPanel(

                        tabs[target].dataset.panelTarget

                    );

                }

            );

        });


        /* OVERVIEW QUICK LINKS */

        document.querySelectorAll(

            "[data-open-panel]"

        ).forEach(button => {

            button.addEventListener(

                "click",

                () => switchPanel(

                    button.dataset.openPanel

                )

            );

        });


        /* FILTER FORMS */

        Object.entries(MODULES).forEach(

            ([key, config]) => {

                $(config.form).addEventListener(

                    "submit",

                    event => {

                        event.preventDefault();


                        if (!state.authorized) return;


                        applyFilters(key);

                    }

                );

            }

        );


        /* CLEAR FILTERS */

        Object.entries(MODULES).forEach(([key, config]) => {

            const clearButton = $(config.clearButton);


            if (clearButton) {

                clearButton.addEventListener(

                    "click",

                    () => clearFilters(key)

                );

            }

        });


        /* PAGINATION */

        Object.entries(MODULES).forEach(

            ([key, config]) => {

                $(config.previous).addEventListener(

                    "click",

                    () => changePage(key, -1)

                );


                $(config.next).addEventListener(

                    "click",

                    () => changePage(key, 1)

                );

            }

        );


        /* DETAIL DRAWER */

        el.detailClose.addEventListener(

            "click",

            closeDetail

        );


        el.detailOverlay.addEventListener(

            "click",

            event => {

                if (event.target === el.detailOverlay) {

                    closeDetail();

                }

            }

        );


        /* CONFIRMATION INPUTS */

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


        /* CONFIRMATION BUTTONS */

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

                if (event.key === "Escape") {

                    if (!el.confirmOverlay.hidden) {

                        closeConfirmation();

                    } else if (!el.detailOverlay.hidden) {

                        closeDetail();

                    } else {

                        closeSidebar();

                    }

                }

            }

        );

    }


    /* ========================================================
       53. AUTHENTICATION & INITIALIZATION
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

            state.preview = false;


            state.csrfToken =

                typeof session.csrfToken === "string"

                    ? session.csrfToken

                    : null;


            showApplication();


            setConnection("Connecting...");


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

                (

                    !error.status ||

                    error.status === 404 ||

                    error.status === 405

                )

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
       54. START APPLICATION
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
