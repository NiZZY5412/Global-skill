
/* ==========================================================
   TALVORA TECHNOLOGIES
   TALVORA GLOBAL — GSES SYSTEM 001

   SKILLS & EVIDENCE MANAGEMENT
   FILE: evidence.js

   No demo records.
   No fabricated credentials.
   No fake employee or skills records.
   No local storage of sensitive information.

   All production data comes from authorized APIs.
   ========================================================== */

(() => {
    "use strict";


    /* ========================================================
       01. API CONFIGURATION
       ======================================================== */

    const API = {

        session: "/api/v1/auth/session",

        summary: "/api/v1/admin/evidence/summary",

        evidence: "/api/v1/admin/evidence",

        evidenceDetail: id =>
            "/api/v1/admin/evidence/" +
            encodeURIComponent(id),

        evidenceAction: id =>
            "/api/v1/admin/evidence/" +
            encodeURIComponent(id) +
            "/actions",

        documentAccess: id =>
            "/api/v1/admin/evidence/" +
            encodeURIComponent(id) +
            "/document-access",

        skills: "/api/v1/admin/skills",

        skillDetail: id =>
            "/api/v1/admin/skills/" +
            encodeURIComponent(id),

        skillAction: id =>
            "/api/v1/admin/skills/" +
            encodeURIComponent(id) +
            "/actions"

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


    /* ========================================================
       03. EVIDENCE STATUS DEFINITIONS
       ======================================================== */

    const EVIDENCE_STATUS = {

        pending: "Pending Verification",

        verified: "Verified",

        rejected: "Rejected",

        expired: "Expired",

        disputed: "Disputed",

        flagged: "Flagged",

        restricted: "Restricted",

        under_review: "Under Review",

        revoked: "Revoked",

        archived: "Archived"

    };


    const EVIDENCE_TYPES = {

        certificate: "Certificate",

        academic: "Academic Qualification",

        professional: "Professional Qualification",

        licence: "Professional Licence",

        experience: "Work Experience",

        portfolio: "Portfolio",

        training: "Training Record",

        assessment: "Assessment Evidence",

        other: "Other"

    };


    const SKILL_VERIFICATION = {

        verified: "Verified",

        pending: "Pending",

        unverified: "Unverified",

        disputed: "Disputed"

    };


    /* ========================================================
       04. ADMINISTRATIVE ACTION DEFINITIONS
       ======================================================== */

    const EVIDENCE_ACTIONS = {

        verify: "Verify Evidence",

        reject: "Reject Evidence",

        request_review: "Request Further Review",

        flag: "Flag Evidence",

        clear_flag: "Clear Evidence Flag",

        dispute: "Mark as Disputed",

        resolve_dispute: "Resolve Dispute",

        restrict_sharing: "Restrict Evidence Sharing",

        restore_sharing: "Restore Evidence Sharing",

        revoke: "Revoke Credential",

        reopen: "Reopen Verification",

        archive: "Archive Evidence"

    };


    const EVIDENCE_ACTION_DESCRIPTIONS = {

        verify:
            "Confirm that this evidence has passed the required verification process.",

        reject:
            "Reject this evidence following the applicable verification procedure.",

        request_review:
            "Request additional review of this evidence record.",

        flag:
            "Flag this evidence for administrative investigation.",

        clear_flag:
            "Clear the administrative flag following appropriate review.",

        dispute:
            "Record a formal dispute concerning this evidence.",

        resolve_dispute:
            "Record the resolution of the existing evidence dispute.",

        restrict_sharing:
            "Restrict sharing of this evidence in accordance with applicable privacy rules.",

        restore_sharing:
            "Request restoration of evidence sharing, subject to valid consent and authorization.",

        revoke:
            "Revoke the credential record according to the applicable platform policy.",

        reopen:
            "Reopen the evidence verification process.",

        archive:
            "Archive this evidence record according to the applicable retention policy."

    };


    const SKILL_ACTIONS = {

        verify_skill: "Verify Skill",

        request_skill_review: "Request Skill Review",

        flag_skill: "Flag Skill",

        dispute_skill: "Dispute Skill",

        clear_skill_flag: "Clear Skill Flag",

        revoke_skill_verification: "Revoke Skill Verification"

    };


    const SKILL_ACTION_DESCRIPTIONS = {

        verify_skill:
            "Verify this employee skill following the applicable verification procedure.",

        request_skill_review:
            "Request additional review of this skill record.",

        flag_skill:
            "Flag this skill for administrative review.",

        dispute_skill:
            "Record a formal dispute concerning this skill.",

        clear_skill_flag:
            "Clear the administrative flag following appropriate review.",

        revoke_skill_verification:
            "Revoke the current skill verification according to platform policy."

    };


    /* ========================================================
       05. DOM REFERENCES
       ======================================================== */

    const el = {

        app: $("evidence-app"),

        locked: $("evidence-locked"),

        accessMessage: $("evidence-access-message"),

        notice: $("evidence-notice"),

        systemStatus: $("evidence-system-status"),

        refresh: $("evidence-refresh"),


        evidenceSearch: $("evidence-search"),

        evidenceType: $("evidence-type"),

        evidenceDateSort: $("evidence-date-sort"),

        evidenceFlagged: $("evidence-flagged-only"),

        evidenceFilterForm: $("evidence-filter-form"),

        evidenceClearFilters: $("evidence-clear-filters"),


        evidenceTable: $("evidence-table-body"),

        evidenceRecordCount: $("evidence-record-count"),

        evidencePageInfo: $("evidence-page-info"),

        evidencePrevious: $("evidence-prev"),

        evidenceNext: $("evidence-next"),


        skillsSearch: $("skills-search"),

        skillsVerification: $("skills-verification"),

        skillsFilterForm: $("skills-filter-form"),

        skillsTable: $("skills-table-body"),

        skillsRecordCount: $("skills-record-count"),

        skillsPageInfo: $("skills-page-info"),

        skillsPrevious: $("skills-prev"),

        skillsNext: $("skills-next"),


        evidenceDetailOverlay: $("evidence-detail-overlay"),

        evidenceDetailTitle: $("evidence-detail-title"),

        evidenceDetailClose: $("evidence-detail-close"),

        evidenceDetailContent: $("evidence-detail-content"),

        evidenceDetailActions: $("evidence-detail-actions"),


        skillDetailOverlay: $("skill-detail-overlay"),

        skillDetailTitle: $("skill-detail-title"),

        skillDetailClose: $("skill-detail-close"),

        skillDetailContent: $("skill-detail-content"),

        skillDetailActions: $("skill-detail-actions"),


        confirmOverlay: $("evidence-confirm-overlay"),

        confirmTitle: $("evidence-confirm-title"),

        confirmDescription: $("evidence-confirm-description"),

        confirmReason: $("evidence-action-reason"),

        confirmCancel: $("evidence-confirm-cancel"),

        confirmSubmit: $("evidence-confirm-submit")

    };


    /* ========================================================
       06. APPLICATION STATE
       ======================================================== */

    const state = {

        authorized: false,

        csrfToken: null,


        evidence: {

            status: "all",

            page: 1,

            totalPages: 0,

            search: "",

            type: "",

            dateSort: "newest",

            flaggedOnly: false

        },


        skills: {

            page: 1,

            totalPages: 0,

            search: "",

            verification: ""

        },


        selectedEvidence: null,

        selectedSkill: null,


        pendingAction: null,

        actionInProgress: false,


        listRequest: 0,

        summaryRequest: 0,

        detailRequest: 0,

        skillListRequest: 0,

        skillDetailRequest: 0,


        activeDialog: null,

        previousFocus: null

    };


    /* ========================================================
       07. STATISTICS REFERENCES
       ======================================================== */

    const METRICS = {

        total: "metric-evidence-total",

        pending: "metric-evidence-pending",

        verified: "metric-evidence-verified",

        rejected: "metric-evidence-rejected",

        expired: "metric-evidence-expired",

        disputed: "metric-evidence-disputed",

        skills: "metric-evidence-skills",

        expiring: "metric-evidence-expiring"

    };


    /* ========================================================
       08. SAFE DOM UTILITIES
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

            "evidence-notice " + type;

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
       09. EMPTY STATES
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

            "evidence-empty"

        );


        cell.colSpan = colspan;


        empty.append(

            createElement("h4", "", title),

            createElement("p", "", description)

        );


        cell.append(empty);

        row.append(cell);

        table.replaceChildren(row);

    }


    function showEvidenceEmpty(title, description) {

        showEmptyTable(

            el.evidenceTable,

            9,

            title,

            description

        );


        el.evidenceRecordCount.textContent =

            "Records unavailable";


        el.evidencePageInfo.textContent =

            "No records available";


        el.evidencePrevious.disabled = true;

        el.evidenceNext.disabled = true;

    }


    function showSkillsEmpty(title, description) {

        showEmptyTable(

            el.skillsTable,

            8,

            title,

            description

        );


        el.skillsRecordCount.textContent =

            "Records unavailable";


        el.skillsPageInfo.textContent =

            "No records available";


        el.skillsPrevious.disabled = true;

        el.skillsNext.disabled = true;

    }


    /* ========================================================
       10. SCREEN MANAGEMENT
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

        state.skillListRequest++;

        state.skillDetailRequest++;


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

            "Local frontend preview only. No real credentials, " +

            "employee skills, documents or administrative actions " +

            "are connected.",

            "warning"

        );


        showEvidenceEmpty(

            "No evidence records connected",

            "Real evidence records will appear after the authorized " +

            "backend service is implemented."

        );


        showSkillsEmpty(

            "No skills records connected",

            "Real employee skills will appear after the authorized " +

            "skills service is implemented."

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

                "The skills and evidence management service is unavailable."

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
       12. ENABLE CONTROLS
       ======================================================== */

    function enableControls() {

        [

            el.evidenceSearch,

            el.evidenceType,

            el.evidenceDateSort,

            el.evidenceFlagged,

            el.evidenceClearFilters,

            $("evidence-apply-filters"),

            el.skillsSearch,

            el.skillsVerification,

            $("skills-apply-filters"),

            el.refresh

        ].forEach(control => {

            if (control) {

                control.disabled = false;

            }

        });

    }


    /* ========================================================
       13. SUMMARY STATISTICS
       ======================================================== */

    async function loadSummary() {

        const requestId = ++state.summaryRequest;


        clearMetrics();


        try {

            const result = await requestJSON(

                API.summary

            );


            if (

                requestId !== state.summaryRequest ||

                !state.authorized

            ) {

                return;

            }


            if (!result || !result.metrics) {

                throw new Error(

                    "Invalid evidence summary response."

                );

            }


            const metrics = result.metrics;


            setText(

                METRICS.total,

                validCount(metrics.total)

            );


            setText(

                METRICS.pending,

                validCount(metrics.pending)

            );


            setText(

                METRICS.verified,

                validCount(metrics.verified)

            );


            setText(

                METRICS.rejected,

                validCount(metrics.rejected)

            );


            setText(

                METRICS.expired,

                validCount(metrics.expired)

            );


            setText(

                METRICS.disputed,

                validCount(metrics.disputed)

            );


            setText(

                METRICS.skills,

                validCount(metrics.registeredSkills)

            );


            setText(

                METRICS.expiring,

                validCount(metrics.expiringSoon)

            );


            /* GOVERNANCE SUMMARY */

            const governance = result.governance || {};


            setText(

                "governance-consent-status",

                governance.consentStatus || "Data unavailable"

            );


            setText(

                "governance-employer-status",

                governance.employerAccessStatus ||

                "Data unavailable"

            );


            setText(

                "governance-verification-status",

                governance.verificationStatus ||

                "Data unavailable"

            );


            setText(

                "governance-history-status",

                governance.accessHistoryStatus ||

                "Data unavailable"

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

                "Evidence statistics could not be retrieved.",

                "error"

            );

        }

    }


    /* ========================================================
       14. EVIDENCE QUERY CONSTRUCTION
       ======================================================== */

    function buildEvidenceQuery() {

        const params = new URLSearchParams({

            page: String(state.evidence.page),

            limit: String(PAGE_SIZE),

            status: state.evidence.status,

            sort: state.evidence.dateSort

        });


        if (state.evidence.search) {

            params.set(

                "search",

                state.evidence.search

            );

        }


        if (state.evidence.type) {

            params.set(

                "type",

                state.evidence.type

            );

        }


        if (state.evidence.flaggedOnly) {

            params.set(

                "flagged",

                "true"

            );

        }


        return params;

    }


    function applyEvidenceFilters() {

        state.evidence.search =

            el.evidenceSearch.value.trim();


        state.evidence.type =

            el.evidenceType.value;


        state.evidence.dateSort =

            el.evidenceDateSort.value;


        state.evidence.flaggedOnly =

            el.evidenceFlagged.checked;


        state.evidence.page = 1;

    }


    /* ========================================================
       15. SKILLS QUERY CONSTRUCTION
       ======================================================== */

    function buildSkillsQuery() {

        const params = new URLSearchParams({

            page: String(state.skills.page),

            limit: String(PAGE_SIZE)

        });


        if (state.skills.search) {

            params.set(

                "search",

                state.skills.search

            );

        }


        if (state.skills.verification) {

            params.set(

                "verification",

                state.skills.verification

            );

        }


        return params;

    }


    function applySkillsFilters() {

        state.skills.search =

            el.skillsSearch.value.trim();


        state.skills.verification =

            el.skillsVerification.value;


        state.skills.page = 1;

    }


    /* ========================================================
       16. STATUS BADGES
       ======================================================== */

    function createEvidenceStatusBadge(status) {

        return createElement(

            "span",

            "evidence-status " + status,

            EVIDENCE_STATUS[status] || "Unknown"

        );

    }


    function createSkillVerificationBadge(status) {

        return createElement(

            "span",

            "skill-verification " + status,

            SKILL_VERIFICATION[status] || "Unknown"

        );

    }


    /* ========================================================
       17. EXPIRY DISPLAY
       ======================================================== */

    function createExpiryDisplay(value) {

        const wrapper = createElement(

            "span",

            "evidence-expiry"

        );


        if (!value) {

            wrapper.textContent = "No expiry date";

            return wrapper;

        }


        const date = new Date(value);


        if (Number.isNaN(date.getTime())) {

            wrapper.textContent = "—";

            return wrapper;

        }


        wrapper.textContent = formatDate(value);


        const now = new Date();

        now.setHours(0, 0, 0, 0);


        const expiry = new Date(date);

        expiry.setHours(0, 0, 0, 0);


        const days = Math.ceil(

            (expiry.getTime() - now.getTime()) /

            86400000

        );


        if (days < 0) {

            wrapper.classList.add("expired");

        } else if (days <= 30) {

            wrapper.classList.add("expiring");

        }


        return wrapper;

    }


    /* ========================================================
       18. EVIDENCE DIRECTORY
       ======================================================== */

    function renderEvidence(result) {

        if (

            !result ||

            !Array.isArray(result.items) ||

            !result.pagination

        ) {

            throw new Error(

                "Invalid evidence directory response."

            );

        }


        const fragment =

            document.createDocumentFragment();


        for (const item of result.items) {


            if (

                !item ||

                typeof item.id !== "string" ||

                !item.id ||

                !Object.hasOwn(

                    EVIDENCE_STATUS,

                    item.status

                )

            ) {

                continue;

            }


            const row = createElement("tr");


            /* EVIDENCE REFERENCE */

            row.append(

                createElement(

                    "td",

                    "evidence-reference",

                    safeValue(item.reference)

                )

            );


            /* EMPLOYEE */

            const employeeCell = createElement("td");


            employeeCell.append(

                createElement(

                    "span",

                    "evidence-employee",

                    item.employee?.displayName || "—"

                ),

                createElement(

                    "span",

                    "evidence-secondary",

                    item.employee?.reference || ""

                )

            );


            row.append(employeeCell);


            /* CREDENTIAL */

            const credentialCell = createElement("td");


            credentialCell.append(

                createElement(

                    "span",

                    "evidence-name",

                    item.title || "—"

                ),

                createElement(

                    "span",

                    "evidence-secondary",

                    item.credentialNumber

                        ? "Credential: " + item.credentialNumber

                        : ""

                )

            );


            row.append(credentialCell);


            /* TYPE */

            row.append(

                createElement(

                    "td",

                    "",

                    EVIDENCE_TYPES[item.type] || "Other"

                )

            );


            /* ISSUER */

            row.append(

                createElement(

                    "td",

                    "evidence-issuer",

                    item.issuer?.name || "—"

                )

            );


            /* EXPIRY */

            const expiryCell = createElement("td");

            expiryCell.append(

                createExpiryDisplay(item.expiresAt)

            );

            row.append(expiryCell);


            /* STATUS */

            const statusCell = createElement("td");

            statusCell.append(

                createEvidenceStatusBadge(item.status)

            );

            row.append(statusCell);


            /* FLAG */

            const flagCell = createElement("td");


            if (item.flagged === true) {

                flagCell.append(

                    createElement(

                        "span",

                        "evidence-flag-indicator",

                        "Flagged"

                    )

                );

            } else {

                flagCell.append(

                    createElement(

                        "span",

                        "evidence-no-flag",

                        "—"

                    )

                );

            }


            row.append(flagCell);


            /* VIEW */

            const actionCell = createElement("td");

            const actionGroup = createElement(

                "div",

                "evidence-row-actions"

            );


            const viewButton = createElement(

                "button",

                "evidence-view-button",

                "View Details"

            );


            viewButton.type = "button";


            viewButton.addEventListener(

                "click",

                () => openEvidenceDetails(item.id)

            );


            actionGroup.append(viewButton);

            actionCell.append(actionGroup);

            row.append(actionCell);


            fragment.append(row);

        }


        if (fragment.childNodes.length === 0) {

            showEvidenceEmpty(

                "No matching evidence found",

                "No evidence records match the selected filters."

            );

        } else {

            el.evidenceTable.replaceChildren(fragment);

        }


        updatePagination(

            result.pagination,

            state.evidence,

            el.evidenceRecordCount,

            el.evidencePageInfo,

            el.evidencePrevious,

            el.evidenceNext,

            "evidence"

        );

    }


    /* ========================================================
       19. SHARED PAGINATION
       ======================================================== */

    function updatePagination(

        pagination,

        sectionState,

        countElement,

        pageElement,

        previousButton,

        nextButton,

        sectionName

    ) {

        const total = Number.isSafeInteger(

            pagination.total

        )

            ? pagination.total

            : null;


        sectionState.totalPages =

            Number.isSafeInteger(pagination.totalPages) &&

                pagination.totalPages >= 0

                ? pagination.totalPages

                : 0;


        countElement.textContent =

            total === null

                ? "Record count unavailable"

                : validCount(total) + " " + sectionName + " records";


        pageElement.textContent =

            sectionState.totalPages > 0

                ? `Page ${sectionState.page} of ${sectionState.totalPages}`

                : "No pages";


        previousButton.disabled =

            sectionState.page <= 1;


        nextButton.disabled =

            sectionState.totalPages === 0 ||

            sectionState.page >= sectionState.totalPages;

    }


    /* ========================================================
       20. LOAD EVIDENCE RECORDS
       ======================================================== */

    async function loadEvidence() {

        if (!state.authorized) return;


        const requestId = ++state.listRequest;


        showEvidenceEmpty(

            "Loading evidence records",

            "Retrieving authorized employee evidence records..."

        );


        try {

            const query = buildEvidenceQuery();


            const result = await requestJSON(

                API.evidence +

                "?" +

                query.toString()

            );


            if (

                requestId !== state.listRequest ||

                !state.authorized

            ) {

                return;

            }


            renderEvidence(result);


        } catch (error) {

            if (requestId !== state.listRequest) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            showEvidenceEmpty(

                "Evidence records unavailable",

                "The evidence service could not provide the requested records."

            );


            showNotice(

                "Evidence records could not be loaded.",

                "error"

            );

        }

    }


    /* ========================================================
       21. EMPLOYEE SKILLS DIRECTORY
       ======================================================== */

    function renderSkills(result) {

        if (

            !result ||

            !Array.isArray(result.items) ||

            !result.pagination

        ) {

            throw new Error(

                "Invalid skills registry response."

            );

        }


        const fragment =

            document.createDocumentFragment();


        for (const skill of result.items) {


            if (

                !skill ||

                typeof skill.id !== "string" ||

                !skill.id ||

                !Object.hasOwn(

                    SKILL_VERIFICATION,

                    skill.verificationStatus

                )

            ) {

                continue;

            }


            const row = createElement("tr");


            /* SKILL REFERENCE */

            row.append(

                createElement(

                    "td",

                    "skill-reference",

                    safeValue(skill.reference)

                )

            );


            /* EMPLOYEE */

            const employeeCell = createElement("td");


            employeeCell.append(

                createElement(

                    "span",

                    "skill-employee",

                    skill.employee?.displayName || "—"

                ),

                createElement(

                    "span",

                    "evidence-secondary",

                    skill.employee?.reference || ""

                )

            );


            row.append(employeeCell);


            /* SKILL NAME */

            row.append(

                createElement(

                    "td",

                    "skill-name",

                    safeValue(skill.name)

                )

            );


            /* CATEGORY */

            row.append(

                createElement(

                    "td",

                    "",

                    safeValue(skill.category)

                )

            );


            /* PROFICIENCY */

            const proficiencyCell = createElement("td");


            proficiencyCell.append(

                createElement(

                    "span",

                    "skill-proficiency",

                    safeValue(skill.proficiency)

                )

            );


            row.append(proficiencyCell);


            /* VERIFICATION */

            const verificationCell = createElement("td");


            verificationCell.append(

                createSkillVerificationBadge(

                    skill.verificationStatus

                )

            );


            row.append(verificationCell);


            /* LINKED EVIDENCE */

            const evidenceCount =

                Number.isSafeInteger(skill.linkedEvidenceCount) &&

                    skill.linkedEvidenceCount >= 0

                    ? skill.linkedEvidenceCount

                    : null;


            row.append(

                createElement(

                    "td",

                    "skill-evidence-count",

                    evidenceCount === null

                        ? "—"

                        : validCount(evidenceCount)

                )

            );


            /* ACTION */

            const actionCell = createElement("td");

            const actionGroup = createElement(

                "div",

                "skill-row-actions"

            );


            const viewButton = createElement(

                "button",

                "skill-view-button",

                "View Details"

            );


            viewButton.type = "button";


            viewButton.addEventListener(

                "click",

                () => openSkillDetails(skill.id)

            );


            actionGroup.append(viewButton);

            actionCell.append(actionGroup);

            row.append(actionCell);


            fragment.append(row);

        }


        if (fragment.childNodes.length === 0) {

            showSkillsEmpty(

                "No matching skills found",

                "No employee skill records match the selected filters."

            );

        } else {

            el.skillsTable.replaceChildren(fragment);

        }


        updatePagination(

            result.pagination,

            state.skills,

            el.skillsRecordCount,

            el.skillsPageInfo,

            el.skillsPrevious,

            el.skillsNext,

            "skill"

        );

    }


    /* ========================================================
       22. LOAD SKILLS
       ======================================================== */

    async function loadSkills() {

        if (!state.authorized) return;


        const requestId = ++state.skillListRequest;


        showSkillsEmpty(

            "Loading employee skills",

            "Retrieving authorized skills registry records..."

        );


        try {

            const query = buildSkillsQuery();


            const result = await requestJSON(

                API.skills +

                "?" +

                query.toString()

            );


            if (

                requestId !== state.skillListRequest ||

                !state.authorized

            ) {

                return;

            }


            renderSkills(result);


        } catch (error) {

            if (requestId !== state.skillListRequest) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            showSkillsEmpty(

                "Skills records unavailable",

                "The skills service could not provide the requested records."

            );

        }

    }


    /* ========================================================
       23. DETAIL FIELD HELPERS
       ======================================================== */

    function detailField(label, value, className = "") {

        const wrapper = createElement(

            "div",

            className || "evidence-detail-field"

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


    function detailSection(title, fields, type = "evidence") {

        const section = createElement(

            "section",

            type === "skill"

                ? "skill-detail-section"

                : "evidence-detail-section"

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
       24. EVIDENCE OWNER INFORMATION
       ======================================================== */

    function renderEvidenceOwner(item) {

        const employee = item.employee || {};


        return detailSection(

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

                    "Employee Account Reference",

                    employee.id

                ),

                detailField(

                    "Professional Profile",

                    employee.profileSummary

                ),

                detailField(

                    "Location",

                    employee.location

                )

            ]

        );

    }


    /* ========================================================
       25. CREDENTIAL INFORMATION
       ======================================================== */

    function renderCredentialInformation(item) {

        const issuer = item.issuer || {};


        return detailSection(

            "Credential & Evidence Information",

            [

                detailField(

                    "Evidence Reference",

                    item.reference

                ),

                detailField(

                    "Credential Title",

                    item.title

                ),

                detailField(

                    "Evidence Type",

                    EVIDENCE_TYPES[item.type] || item.type

                ),

                detailField(

                    "Credential Number",

                    item.credentialNumber

                ),

                detailField(

                    "Issuing Organization",

                    issuer.name

                ),

                detailField(

                    "Issuing Country",

                    issuer.country

                ),

                detailField(

                    "Issue Date",

                    formatDate(item.issuedAt)

                ),

                detailField(

                    "Expiry Date",

                    formatDate(item.expiresAt)

                ),

                detailField(

                    "Registration Date",

                    formatDateTime(item.createdAt)

                ),

                detailField(

                    "Last Updated",

                    formatDateTime(item.updatedAt)

                )

            ]

        );

    }


    /* ========================================================
       26. DOCUMENT ACCESS AND PRIVACY
       ======================================================== */

    function renderDocumentAccess(item) {

        const access = item.documentAccess || {};


        const section = createElement(

            "section",

            "evidence-detail-section"

        );


        section.append(

            createElement(

                "h3",

                "",

                "Document Access & Privacy"

            )

        );


        const permitted =

            access.allowed === true &&

            access.consentValid === true;


        if (!permitted) {

            section.append(

                createElement(

                    "div",

                    "evidence-privacy-notice restricted",

                    access.message ||

                    "Document content is restricted. " +

                    "The required authorization and valid sharing " +

                    "consent have not been confirmed."

                )

            );


            return section;

        }


        section.append(

            createElement(

                "div",

                "evidence-privacy-notice",

                "The server has confirmed that document access " +

                "may be requested under the current permissions."

            )

        );


        const file = item.file || {};


        section.append(

            detailField(

                "Original File Name",

                file.originalName

            ),

            detailField(

                "File Type",

                file.mimeType

            ),

            detailField(

                "File Size",

                file.sizeLabel

            ),

            detailField(

                "Document Access",

                "Available through an authorized access request."

            )

        );


        const accessButton = createElement(

            "button",

            "btn btn-secondary",

            "Request Secure Document Access"

        );


        accessButton.type = "button";


        accessButton.addEventListener(

            "click",

            () => requestSecureDocumentAccess(item.id)

        );


        const wrapper = createElement(

            "div",

            "evidence-file-access"

        );


        wrapper.append(

            createElement(

                "p",

                "",

                "Document access will be re-authorized by the server " +

                "when requested. Access may be denied if consent " +

                "has changed."

            ),

            accessButton

        );


        section.append(wrapper);


        return section;

    }


    /* ========================================================
       27. VERIFICATION INFORMATION
       ======================================================== */

    function renderVerification(item) {

        const verification = item.verification || {};


        return detailSection(

            "Verification Information",

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

                    "Verification Method",

                    verification.method

                ),

                detailField(

                    "Verification Notes",

                    verification.notes

                ),

                detailField(

                    "Rejection Reason",

                    verification.rejectionReason

                )

            ]

        );

    }


    /* ========================================================
       28. LINKED SKILLS AND APPLICATIONS
       ======================================================== */

    function renderLinkedRecords(item) {

        const linked = item.linkedRecords || {};


        return detailSection(

            "Linked Platform Records",

            [

                detailField(

                    "Associated Skills",

                    linked.skillsSummary

                ),

                detailField(

                    "Related Assessments",

                    linked.assessmentsSummary

                ),

                detailField(

                    "Related Applications",

                    linked.applicationsSummary

                ),

                detailField(

                    "Related Jobs",

                    linked.jobsSummary

                )

            ]

        );

    }


    /* ========================================================
       29. SHARING AND CONSENT
       ======================================================== */

    function renderSharingInformation(item) {

        const sharing = item.sharing || {};


        const section = createElement(

            "section",

            "evidence-detail-section"

        );


        section.append(

            createElement(

                "h3",

                "",

                "Sharing & Consent Information"

            )

        );


        const valid =

            sharing.consentStatus === "granted" &&

            sharing.consentValid === true;


        section.append(

            detailField(

                "Consent Status",

                sharing.consentStatus

            ),

            detailField(

                "Sharing Status",

                sharing.sharingStatus

            ),

            detailField(

                "Consent Reference",

                sharing.consentReference

            ),

            detailField(

                "Consent Granted",

                formatDateTime(sharing.consentGrantedAt)

            ),

            detailField(

                "Consent Expiry",

                formatDateTime(sharing.consentExpiresAt)

            ),

            detailField(

                "Permitted Audience",

                sharing.permittedAudience

            ),

            detailField(

                "Authorized Employer",

                sharing.authorizedEmployer

            )

        );


        if (!valid) {

            section.append(

                createElement(

                    "div",

                    "evidence-privacy-notice restricted",

                    "Current consent does not confirm valid evidence " +

                    "sharing. Sharing must remain restricted unless " +

                    "the server authorizes otherwise."

                )

            );

        }


        return section;

    }


    /* ========================================================
       30. DISPUTES AND INTEGRITY
       ======================================================== */

    function renderIntegrity(item) {

        const integrity = item.integrity || {};


        const section = createElement(

            "section",

            "evidence-detail-section"

        );


        section.append(

            createElement(

                "h3",

                "",

                "Disputes & Integrity"

            )

        );


        section.append(

            detailField(

                "Flagged",

                item.flagged === true ? "Yes" : "No"

            ),

            detailField(

                "Integrity Status",

                integrity.status

            ),

            detailField(

                "Investigation Status",

                integrity.investigationStatus

            ),

            detailField(

                "Dispute Reference",

                integrity.disputeReference

            )

        );


        if (item.flagged === true || item.status === "disputed") {

            section.append(

                createElement(

                    "div",

                    "evidence-integrity-alert",

                    integrity.message ||

                    "This record requires appropriate administrative attention."

                )

            );

        }


        return section;

    }


    /* ========================================================
       31. EVIDENCE HISTORY
       ======================================================== */

    function renderEvidenceHistory(history) {

        const section = createElement(

            "section",

            "evidence-detail-section"

        );


        section.append(

            createElement(

                "h3",

                "",

                "Verification & Administrative History"

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

            "evidence-history"

        );


        history.forEach(record => {

            if (!record) return;


            const item = createElement(

                "div",

                "evidence-history-item"

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
       32. EVIDENCE ADMINISTRATIVE ACTIONS
       ======================================================== */

    function renderEvidenceActions(item) {

        const actions = Array.isArray(item.availableActions)

            ? item.availableActions

            : [];


        const fragment =

            document.createDocumentFragment();


        fragment.append(

            createElement(

                "p",

                "evidence-action-note",

                "Actions are supplied by the authorized server " +

                "according to evidence status, administrator " +

                "permissions and current consent conditions."

            )

        );


        const allowed = [

            ...new Set(

                actions.filter(action =>

                    typeof action === "string" &&

                    Object.hasOwn(EVIDENCE_ACTIONS, action)

                )

            )

        ];


        allowed.forEach(action => {

            const dangerActions = [

                "reject",

                "revoke",

                "restrict_sharing",

                "archive"

            ];


            const successActions = [

                "verify",

                "clear_flag",

                "resolve_dispute",

                "restore_sharing"

            ];


            const button = createElement(

                "button",

                dangerActions.includes(action)

                    ? "btn btn-danger"

                    : successActions.includes(action)

                        ? "btn btn-success"

                        : "btn btn-secondary",

                EVIDENCE_ACTIONS[action]

            );


            button.type = "button";


            button.addEventListener(

                "click",

                () => requestAction(

                    "evidence",

                    action

                )

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


        el.evidenceDetailActions.replaceChildren(fragment);

    }


    /* ========================================================
       33. RENDER EVIDENCE DETAILS
       ======================================================== */

    function renderEvidenceDetails(item) {

        el.evidenceDetailTitle.textContent =

            safeValue(item.reference);


        el.evidenceDetailContent.replaceChildren();


        const sections = [

            detailSection(

                "Evidence Overview",

                [

                    detailField(

                        "Evidence Reference",

                        item.reference

                    ),

                    detailField(

                        "Current Status",

                        EVIDENCE_STATUS[item.status]

                    ),

                    detailField(

                        "Flagged",

                        item.flagged === true ? "Yes" : "No"

                    ),

                    detailField(

                        "Created Date",

                        formatDateTime(item.createdAt)

                    ),

                    detailField(

                        "Last Updated",

                        formatDateTime(item.updatedAt)

                    )

                ]

            ),

            renderEvidenceOwner(item),

            renderCredentialInformation(item),

            renderDocumentAccess(item),

            renderVerification(item),

            renderLinkedRecords(item),

            renderSharingInformation(item),

            renderIntegrity(item),

            renderEvidenceHistory(item.history)

        ];


        sections.forEach(section => {

            el.evidenceDetailContent.append(section);

        });


        renderEvidenceActions(item);

    }


    /* ========================================================
       34. OPEN EVIDENCE DETAILS
       ======================================================== */

    async function openEvidenceDetails(id) {

        if (!state.authorized) return;


        const requestId = ++state.detailRequest;


        showNotice(

            "Retrieving evidence details..."

        );


        try {

            const item = await requestJSON(

                API.evidenceDetail(id)

            );


            if (

                requestId !== state.detailRequest ||

                !state.authorized

            ) {

                return;

            }


            if (

                !item ||

                item.id !== id ||

                !Object.hasOwn(

                    EVIDENCE_STATUS,

                    item.status

                )

            ) {

                throw new Error(

                    "Invalid evidence detail response."

                );

            }


            state.selectedEvidence = item;


            state.previousFocus = document.activeElement;


            renderEvidenceDetails(item);


            el.evidenceDetailOverlay.hidden = false;


            document.body.style.overflow = "hidden";


            el.evidenceDetailClose.focus();


            showNotice(

                "Evidence details retrieved.",

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

                "Unable to retrieve the selected evidence record.",

                "error"

            );

        }

    }


    /* ========================================================
       35. SECURE DOCUMENT ACCESS
       ======================================================== */

    async function requestSecureDocumentAccess(id) {

        if (!state.authorized || !state.selectedEvidence) {

            return;

        }


        if (state.selectedEvidence.id !== id) {

            return;

        }


        showNotice(

            "Requesting secure document authorization..."

        );


        try {

            const result = await requestJSON(

                API.documentAccess(id),

                {

                    method: "POST",

                    body: JSON.stringify({

                        purpose: "super_admin_evidence_review"

                    })

                }

            );


            if (!state.authorized) return;


            if (

                !result ||

                typeof result.url !== "string" ||

                !result.url

            ) {

                throw new Error(

                    "The server did not authorize document access."

                );

            }


            const documentURL = new URL(

                result.url,

                location.origin

            );


            if (

                documentURL.protocol !== "https:" &&

                documentURL.origin !== location.origin

            ) {

                throw new Error(

                    "The returned document address is not secure."

                );

            }


            if (

                documentURL.username ||

                documentURL.password

            ) {

                throw new Error(

                    "The document address is invalid."

                );

            }


            const link = document.createElement("a");


            link.href = documentURL.href;

            link.target = "_blank";

            link.rel = "noopener noreferrer";

            link.referrerPolicy = "no-referrer";


            document.body.append(link);

            link.click();

            link.remove();


            showNotice(

                "Document access was authorized. The secure document request was opened.",

                "success"

            );


        } catch (error) {

            if (handleAuthorizationError(error)) {

                return;

            }


            showNotice(

                error.message ||

                "Secure document access could not be authorized.",

                "error"

            );

        }

    }


    /* ========================================================
       36. SKILL DETAIL INFORMATION
       ======================================================== */

    function renderSkillInformation(skill) {

        return detailSection(

            "Employee Skill Information",

            [

                detailField(

                    "Skill Reference",

                    skill.reference,

                    "skill-detail-field"

                ),

                detailField(

                    "Employee",

                    skill.employee?.displayName,

                    "skill-detail-field"

                ),

                detailField(

                    "Employee Reference",

                    skill.employee?.reference,

                    "skill-detail-field"

                ),

                detailField(

                    "Skill / Competency",

                    skill.name,

                    "skill-detail-field"

                ),

                detailField(

                    "Description",

                    skill.description,

                    "skill-detail-field"

                ),

                detailField(

                    "Category",

                    skill.category,

                    "skill-detail-field"

                ),

                detailField(

                    "Proficiency",

                    skill.proficiency,

                    "skill-detail-field"

                ),

                detailField(

                    "Years of Experience",

                    skill.yearsExperience,

                    "skill-detail-field"

                ),

                detailField(

                    "Verification Status",

                    SKILL_VERIFICATION[skill.verificationStatus],

                    "skill-detail-field"

                ),

                detailField(

                    "Last Updated",

                    formatDateTime(skill.updatedAt),

                    "skill-detail-field"

                )

            ],

            "skill"

        );

    }


    /* ========================================================
       37. SKILL LINKED EVIDENCE
       ======================================================== */

    function renderSkillEvidence(skill) {

        const section = createElement(

            "section",

            "skill-detail-section"

        );


        section.append(

            createElement(

                "h3",

                "",

                "Supporting Evidence"

            )

        );


        if (skill.evidenceAccessAllowed !== true) {

            section.append(

                createElement(

                    "div",

                    "evidence-privacy-notice restricted",

                    "Supporting evidence is restricted. " +

                    "The required access permission and consent " +

                    "have not been confirmed."

                )

            );


            return section;

        }


        const linked = skill.linkedEvidence;


        if (!Array.isArray(linked) || linked.length === 0) {

            section.append(

                createElement(

                    "p",

                    "",

                    "No accessible linked evidence records were returned."

                )

            );


            return section;

        }


        linked.forEach(item => {

            if (!item) return;


            section.append(

                detailField(

                    "Evidence Reference",

                    item.reference,

                    "skill-detail-field"

                ),

                detailField(

                    "Evidence Title",

                    item.title,

                    "skill-detail-field"

                ),

                detailField(

                    "Verification Status",

                    item.status,

                    "skill-detail-field"

                )

            );

        });


        return section;

    }


    /* ========================================================
       38. SKILL VERIFICATION AND HISTORY
       ======================================================== */

    function renderSkillVerification(skill) {

        const verification = skill.verification || {};


        return detailSection(

            "Skill Verification",

            [

                detailField(

                    "Verification Status",

                    verification.status,

                    "skill-detail-field"

                ),

                detailField(

                    "Verified By",

                    verification.verifiedBy,

                    "skill-detail-field"

                ),

                detailField(

                    "Verification Date",

                    formatDateTime(verification.verifiedAt),

                    "skill-detail-field"

                ),

                detailField(

                    "Verification Reference",

                    verification.reference,

                    "skill-detail-field"

                ),

                detailField(

                    "Verification Notes",

                    verification.notes,

                    "skill-detail-field"

                )

            ],

            "skill"

        );

    }


    function renderSkillHistory(history) {

        const section = createElement(

            "section",

            "skill-detail-section"

        );


        section.append(

            createElement(

                "h3",

                "",

                "Skill History"

            )

        );


        if (!Array.isArray(history) || history.length === 0) {

            section.append(

                createElement(

                    "p",

                    "",

                    "No skill history records are available."

                )

            );


            return section;

        }


        const list = createElement(

            "div",

            "skill-history"

        );


        history.forEach(record => {

            if (!record) return;


            const item = createElement(

                "div",

                "skill-history-item"

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
       39. SKILL ADMINISTRATIVE ACTIONS
       ======================================================== */

    function renderSkillActions(skill) {

        const actions = Array.isArray(skill.availableActions)

            ? skill.availableActions

            : [];


        const fragment =

            document.createDocumentFragment();


        fragment.append(

            createElement(

                "p",

                "evidence-action-note",

                "Skill actions are supplied by the server " +

                "according to current verification status and " +

                "administrator permissions."

            )

        );


        const allowed = [

            ...new Set(

                actions.filter(action =>

                    typeof action === "string" &&

                    Object.hasOwn(SKILL_ACTIONS, action)

                )

            )

        ];


        allowed.forEach(action => {

            const button = createElement(

                "button",

                action === "revoke_skill_verification"

                    ? "btn btn-danger"

                    : action === "verify_skill"

                        ? "btn btn-success"

                        : "btn btn-secondary",

                SKILL_ACTIONS[action]

            );


            button.type = "button";


            button.addEventListener(

                "click",

                () => requestAction(

                    "skill",

                    action

                )

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


        el.skillDetailActions.replaceChildren(fragment);

    }


    /* ========================================================
       40. RENDER SKILL DETAILS
       ======================================================== */

    function renderSkillDetails(skill) {

        el.skillDetailTitle.textContent =

            safeValue(skill.reference);


        el.skillDetailContent.replaceChildren();


        const sections = [

            renderSkillInformation(skill),

            renderSkillEvidence(skill),

            renderSkillVerification(skill),

            renderSkillHistory(skill.history)

        ];


        sections.forEach(section => {

            el.skillDetailContent.append(section);

        });


        renderSkillActions(skill);

    }


    /* ========================================================
       41. OPEN SKILL DETAILS
       ======================================================== */

    async function openSkillDetails(id) {

        if (!state.authorized) return;


        const requestId = ++state.skillDetailRequest;


        showNotice(

            "Retrieving employee skill details..."

        );


        try {

            const skill = await requestJSON(

                API.skillDetail(id)

            );


            if (

                requestId !== state.skillDetailRequest ||

                !state.authorized

            ) {

                return;

            }


            if (

                !skill ||

                skill.id !== id ||

                !Object.hasOwn(

                    SKILL_VERIFICATION,

                    skill.verificationStatus

                )

            ) {

                throw new Error(

                    "Invalid skill detail response."

                );

            }


            state.selectedSkill = skill;


            state.previousFocus = document.activeElement;


            renderSkillDetails(skill);


            el.skillDetailOverlay.hidden = false;


            document.body.style.overflow = "hidden";


            el.skillDetailClose.focus();


            showNotice(

                "Employee skill details retrieved.",

                "success"

            );


        } catch (error) {

            if (requestId !== state.skillDetailRequest) {

                return;

            }


            if (handleAuthorizationError(error)) {

                return;

            }


            showNotice(

                "Unable to retrieve the selected skill record.",

                "error"

            );

        }

    }


    /* ========================================================
       42. CLOSE DRAWERS
       ======================================================== */

    function closeEvidenceDetails() {

        state.detailRequest++;

        el.evidenceDetailOverlay.hidden = true;

        state.selectedEvidence = null;

        el.evidenceDetailContent.replaceChildren();

        el.evidenceDetailActions.replaceChildren();


        if (el.skillDetailOverlay.hidden) {

            document.body.style.overflow = "";

        }


        restoreFocus();

    }


    function closeSkillDetails() {

        state.skillDetailRequest++;

        el.skillDetailOverlay.hidden = true;

        state.selectedSkill = null;

        el.skillDetailContent.replaceChildren();

        el.skillDetailActions.replaceChildren();


        if (el.evidenceDetailOverlay.hidden) {

            document.body.style.overflow = "";

        }


        restoreFocus();

    }


    function closeAllDrawers() {

        el.evidenceDetailOverlay.hidden = true;

        el.skillDetailOverlay.hidden = true;

        el.evidenceDetailContent.replaceChildren();

        el.skillDetailContent.replaceChildren();

        el.evidenceDetailActions.replaceChildren();

        el.skillDetailActions.replaceChildren();


        state.selectedEvidence = null;

        state.selectedSkill = null;


        document.body.style.overflow = "";

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
       43. ADMINISTRATIVE ACTION CONFIRMATION
       ======================================================== */

    function requestAction(resourceType, action) {

        if (

            !state.authorized ||

            state.actionInProgress

        ) {

            return;

        }


        const resource =

            resourceType === "evidence"

                ? state.selectedEvidence

                : state.selectedSkill;


        if (!resource) return;


        const actionMap =

            resourceType === "evidence"

                ? EVIDENCE_ACTIONS

                : SKILL_ACTIONS;


        if (

            !Object.hasOwn(actionMap, action) ||

            !resource.availableActions?.includes(action)

        ) {

            return;

        }


        state.pendingAction = {

            resourceType,

            resourceId: resource.id,

            action

        };


        const descriptionMap =

            resourceType === "evidence"

                ? EVIDENCE_ACTION_DESCRIPTIONS

                : SKILL_ACTION_DESCRIPTIONS;


        const reference = resource.reference || resource.id;


        el.confirmTitle.textContent =

            "Confirm: " + actionMap[action];


        el.confirmDescription.textContent =

            descriptionMap[action] +

            " Record reference: " +

            reference;


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
       44. EXECUTE ADMINISTRATIVE ACTION
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

                "A meaningful administrative reason of at least five characters is required.",

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


        const pending = state.pendingAction;


        const endpoint =

            pending.resourceType === "evidence"

                ? API.evidenceAction(pending.resourceId)

                : API.skillAction(pending.resourceId);


        state.actionInProgress = true;


        el.confirmSubmit.disabled = true;

        el.confirmCancel.disabled = true;


        el.confirmSubmit.textContent =

            "Processing...";


        try {

            const result = await requestJSON(

                endpoint,

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


            const resourceType = pending.resourceType;


            el.confirmOverlay.hidden = true;

            state.pendingAction = null;

            state.activeDialog = null;


            closeAllDrawers();


            showNotice(

                result?.message ||

                "The administrative action was accepted by the server.",

                "success"

            );


            if (resourceType === "evidence") {

                state.evidence.page = 1;

            } else {

                state.skills.page = 1;

            }


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
       45. STATUS TABS
       ======================================================== */

    function selectEvidenceStatus(status) {

        const allowed = [

            "all",

            "pending",

            "verified",

            "rejected",

            "expired",

            "disputed",

            "flagged",

            "restricted"

        ];


        if (!allowed.includes(status)) return;


        state.evidence.status = status;

        state.evidence.page = 1;


        document.querySelectorAll(".evidence-tab")

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


        loadEvidence();

    }


    /* ========================================================
       46. SIDEBAR
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
       47. REFRESH ALL MODULE DATA
       ======================================================== */

    async function refreshAll() {

        if (!state.authorized) return;


        showNotice(

            "Refreshing skills and evidence management records..."

        );


        await Promise.all([

            loadSummary(),

            loadEvidence(),

            loadSkills()

        ]);


        if (state.authorized) {

            showNotice(

                "Skills and evidence records refreshed.",

                "success"

            );

        }

    }


    /* ========================================================
       48. EVENT REGISTRATION
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


        /* EVIDENCE FILTER FORM */

        el.evidenceFilterForm.addEventListener(

            "submit",

            event => {

                event.preventDefault();


                if (!state.authorized) return;


                applyEvidenceFilters();


                loadEvidence();

            }

        );


        /* CLEAR EVIDENCE FILTERS */

        el.evidenceClearFilters.addEventListener(

            "click",

            () => {

                el.evidenceSearch.value = "";

                el.evidenceType.value = "";

                el.evidenceDateSort.value = "newest";

                el.evidenceFlagged.checked = false;


                applyEvidenceFilters();


                loadEvidence();

            }

        );


        /* SKILLS FILTER FORM */

        el.skillsFilterForm.addEventListener(

            "submit",

            event => {

                event.preventDefault();


                if (!state.authorized) return;


                applySkillsFilters();


                loadSkills();

            }

        );


        /* EVIDENCE PAGINATION */

        el.evidencePrevious.addEventListener(

            "click",

            () => {

                if (

                    !state.authorized ||

                    state.evidence.page <= 1

                ) {

                    return;

                }


                state.evidence.page--;


                loadEvidence();

            }

        );


        el.evidenceNext.addEventListener(

            "click",

            () => {

                if (

                    !state.authorized ||

                    state.evidence.page >= state.evidence.totalPages

                ) {

                    return;

                }


                state.evidence.page++;


                loadEvidence();

            }

        );


        /* SKILLS PAGINATION */

        el.skillsPrevious.addEventListener(

            "click",

            () => {

                if (

                    !state.authorized ||

                    state.skills.page <= 1

                ) {

                    return;

                }


                state.skills.page--;


                loadSkills();

            }

        );


        el.skillsNext.addEventListener(

            "click",

            () => {

                if (

                    !state.authorized ||

                    state.skills.page >= state.skills.totalPages

                ) {

                    return;

                }


                state.skills.page++;


                loadSkills();

            }

        );


        /* EVIDENCE STATUS TABS */

        const tabs = Array.from(

            document.querySelectorAll(".evidence-tab")

        );


        tabs.forEach((button, index) => {


            button.addEventListener(

                "click",

                () => {

                    selectEvidenceStatus(

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


                    selectEvidenceStatus(

                        tabs[target].dataset.status

                    );

                }

            );

        });


        /* DETAIL DRAWERS */

        el.evidenceDetailClose.addEventListener(

            "click",

            closeEvidenceDetails

        );


        el.skillDetailClose.addEventListener(

            "click",

            closeSkillDetails

        );


        el.evidenceDetailOverlay.addEventListener(

            "click",

            event => {

                if (event.target === el.evidenceDetailOverlay) {

                    closeEvidenceDetails();

                }

            }

        );


        el.skillDetailOverlay.addEventListener(

            "click",

            event => {

                if (event.target === el.skillDetailOverlay) {

                    closeSkillDetails();

                }

            }

        );


        /* CONFIRMATION REASON */

        el.confirmReason.addEventListener(

            "input",

            () => {

                el.confirmSubmit.disabled =

                    el.confirmReason.value.trim().length < 5 ||

                    !state.authorized;

            }

        );


        /* CONFIRMATION BUTTONS */

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

                } else if (!el.evidenceDetailOverlay.hidden) {

                    closeEvidenceDetails();

                } else if (!el.skillDetailOverlay.hidden) {

                    closeSkillDetails();

                } else {

                    closeSidebar();

                }

            }

        );

    }


    /* ========================================================
       49. INITIALIZATION AND ADMIN AUTHORIZATION
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
       50. START APPLICATION
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
