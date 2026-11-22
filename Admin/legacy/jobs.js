
/* ==========================================================
   TALVORA TECHNOLOGIES
   TALVORA GLOBAL — GSES SYSTEM 001

   JOB MANAGEMENT
   FILE: jobs.js

   No demo records.
   No fabricated statistics.
   All production data comes from authorized APIs.
   ========================================================== */

(() => {
    "use strict";

    const LOCAL_PREVIEW =
        location.protocol === "file:" ||
        ["localhost", "127.0.0.1", "[::1]"]
            .includes(location.hostname);

    const API = {
        session: "/api/v1/auth/session",
        jobs: "/api/v1/admin/jobs",
        metrics: "/api/v1/admin/jobs/summary",
        action: id =>
            "/api/v1/admin/jobs/" +
            encodeURIComponent(id) + "/moderation"
    };

    const $ = id => document.getElementById(id);

    const el = {
        app: $("jobs-app"),
        locked: $("jobs-locked"),
        accessMessage: $("jobs-access-message"),
        notice: $("jobs-notice"),
        systemStatus: $("jobs-system-status"),
        refresh: $("jobs-refresh"),

        search: $("jobs-search"),
        type: $("jobs-type"),
        workMode: $("jobs-work-mode"),
        dateSort: $("jobs-date-sort"),
        filterForm: $("jobs-filter-form"),
        clearFilters: $("jobs-clear-filters"),

        tableBody: $("jobs-table-body"),
        recordCount: $("jobs-record-count"),
        pageInfo: $("jobs-page-info"),
        previous: $("jobs-prev"),
        next: $("jobs-next"),

        detailOverlay: $("job-detail-overlay"),
        detailContent: $("job-detail-content"),
        detailTitle: $("job-detail-title"),
        detailClose: $("job-detail-close"),
        detailActions: $("job-detail-actions"),

        confirmOverlay: $("job-confirm-overlay"),
        confirmTitle: $("job-confirm-title"),
        confirmDescription: $("job-confirm-description"),
        confirmReason: $("job-action-reason"),
        confirmCancel: $("job-confirm-cancel"),
        confirmSubmit: $("job-confirm-submit")
    };

    const state = {
        authorized: false,
        csrfToken: null,

        status: "all",
        page: 1,
        pageSize: 20,
        totalPages: 0,

        selectedJob: null,
        pendingAction: null,

        search: "",
        employmentType: "",
        workMode: "",
        dateSort: "newest",

        jobsRequest: 0,
        metricsRequest: 0,
        actionInProgress: false
    };

    const STAT_IDS = {
        total: "metric-total",
        pendingReview: "metric-pending",
        published: "metric-published",
        closed: "metric-closed",
        flagged: "metric-flagged",
        removed: "metric-removed"
    };

    const STATUS_LABELS = {
        pending_review: "Pending Review",
        published: "Published",
        closed: "Closed",
        flagged: "Flagged",
        removed: "Removed",
        draft: "Draft"
    };

    const ACTIONS = {
        approve: {
            label: "Approve",
            description:
                "Approve this job listing for publication."
        },
        reject: {
            label: "Reject",
            description:
                "Reject this job listing. The reason must be recorded."
        },
        close: {
            label: "Close Listing",
            description:
                "Close this published job listing."
        },
        restore: {
            label: "Restore Listing",
            description:
                "Request restoration of this removed or closed listing."
        },
        remove: {
            label: "Remove Listing",
            description:
                "Remove this listing from active platform visibility."
        }
    };

    /* -------------------------------------------------------
       SAFE DOM HELPERS
       ------------------------------------------------------- */

    function create(tag, className = "", text = null) {
        const element = document.createElement(tag);

        if (className) element.className = className;

        if (text !== null && text !== undefined) {
            element.textContent = String(text);
        }

        return element;
    }

    function setText(id, value) {
        const element = $(id);
        if (element) element.textContent = String(value);
    }

    function safeValue(value) {
        if (value === null || value === undefined || value === "") {
            return "—";
        }
        return String(value);
    }

    function validCount(value) {
        return Number.isSafeInteger(value) && value >= 0
            ? new Intl.NumberFormat("en").format(value)
            : "—";
    }

    function formatDate(value) {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "—";

        return new Intl.DateTimeFormat("en", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }).format(date);
    }

    function notice(message, tone = "") {
        el.notice.className = "jobs-notice " + tone;
        el.notice.textContent = message;
    }

    function setConnection(message, connected = false) {
        el.systemStatus.textContent = message;

        const container = document.querySelector(
            ".connection-status"
        );

        container?.classList.toggle("connected", connected);
        container?.classList.toggle("disconnected", !connected);
    }

    function clearMetrics() {
        Object.values(STAT_IDS).forEach(id => {
            setText(id, "—");
        });
    }

    function emptyTable(title, description) {
        const row = create("tr");
        const cell = create("td");
        const box = create("div", "jobs-empty");

        cell.colSpan = 8;

        box.append(
            create("h4", "", title),
            create("p", "", description)
        );

        cell.append(box);
        row.append(cell);

        el.tableBody.replaceChildren(row);

        el.recordCount.textContent = "Records unavailable";
        el.pageInfo.textContent = "No records available";

        el.previous.disabled = true;
        el.next.disabled = true;
    }

    function showApplication() {
        el.locked.hidden = true;
        el.app.hidden = false;
    }

    function showLocked(message) {
        state.authorized = false;
        state.csrfToken = null;

        ++state.jobsRequest;
        ++state.metricsRequest;

        el.app.hidden = true;
        el.locked.hidden = false;
        el.accessMessage.textContent = message;

        closeDetails();
    }

    /* -------------------------------------------------------
       API REQUESTS
       ------------------------------------------------------- */

    async function requestJSON(url, options = {}) {
        const headers = {
            Accept: "application/json",
            ...options.headers
        };

        if (options.body) {
            headers["Content-Type"] = "application/json";
        }

        if (state.csrfToken && options.method &&
            options.method !== "GET") {
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
            throw new Error("The job management service is unavailable.");
        }

        if (response.status === 401 || response.status === 403) {
            const error = new Error("Administrator access denied.");
            error.status = response.status;
            throw error;
        }

        if (!response.ok) {
            let message = "The request could not be completed.";

            try {
                const result = await response.json();
                if (typeof result.message === "string") {
                    message = result.message;
                }
            } catch {
                // Keep the generic error message.
            }

            const error = new Error(message);
            error.status = response.status;
            throw error;
        }

        if (response.status === 204) return null;

        if (!(response.headers.get("content-type") || "")
            .includes("application/json")) {
            throw new Error("Invalid server response.");
        }

        return response.json();
    }

    function handleAuthorizationError(error) {
        if (error.status === 401 || error.status === 403) {
            showLocked("Your administrator session is not authorized.");
            return true;
        }
        return false;
    }

    /* -------------------------------------------------------
       METRICS
       ------------------------------------------------------- */

    async function loadMetrics() {
        const requestId = ++state.metricsRequest;

        clearMetrics();

        try {
            const data = await requestJSON(API.metrics);

            if (
                requestId !== state.metricsRequest ||
                !state.authorized
            ) return;

            if (!data || !data.metrics) {
                throw new Error("Invalid job summary.");
            }

            const metrics = data.metrics;

            setText(
                STAT_IDS.total,
                validCount(metrics.total)
            );

            setText(
                STAT_IDS.pending,
                validCount(metrics.pendingReview)
            );

            setText(
                STAT_IDS.published,
                validCount(metrics.published)
            );

            setText(
                STAT_IDS.closed,
                validCount(metrics.closed)
            );

            setText(
                STAT_IDS.flagged,
                validCount(metrics.flagged)
            );

            setText(
                STAT_IDS.removed,
                validCount(metrics.removed)
            );

        } catch (error) {
            if (requestId !== state.metricsRequest) return;

            if (handleAuthorizationError(error)) return;

            clearMetrics();
            notice(
                "Job statistics could not be retrieved.",
                "error"
            );
        }
    }

    /* -------------------------------------------------------
       FILTERS
       ------------------------------------------------------- */

    function buildQuery() {
        const params = new URLSearchParams({
            page: String(state.page),
            limit: String(state.pageSize),
            status: state.status,
            sort: state.dateSort
        });

        if (state.search) {
            params.set("search", state.search);
        }

        if (state.employmentType) {
            params.set("employmentType", state.employmentType);
        }

        if (state.workMode) {
            params.set("workMode", state.workMode);
        }

        return params;
    }

    function applyFilterValues() {
        state.search = el.search.value.trim();
        state.employmentType = el.type.value;
        state.workMode = el.workMode.value;
        state.dateSort = el.dateSort.value;
        state.page = 1;
    }

    function enableFilters() {
        [
            el.search,
            el.type,
            el.workMode,
            el.dateSort,
            el.refresh,
            el.clearFilters,
            $("jobs-apply-filters")
        ].forEach(control => {
            control.disabled = false;
        });
    }

    /* -------------------------------------------------------
       JOB TABLE
       ------------------------------------------------------- */

    function createStatusBadge(status) {
        const badge = create(
            "span",
            "job-status " + status,
            STATUS_LABELS[status] || "Unknown"
        );

        return badge;
    }

    function createJobCell(value, className = "") {
        return create("td", className, safeValue(value));
    }

    function renderJobs(data) {
        if (
            !data ||
            !Array.isArray(data.items) ||
            !data.pagination
        ) {
            throw new Error("Invalid job directory response.");
        }

        const fragment = document.createDocumentFragment();

        for (const job of data.items) {
            if (
                !job ||
                typeof job.id !== "string" ||
                !job.id ||
                typeof job.status !== "string" ||
                !Object.hasOwn(STATUS_LABELS, job.status)
            ) continue;

            const row = create("tr");

            row.append(
                createJobCell(job.reference, "job-reference"),
                createJobCell(job.title, "job-title-cell")
            );

            const employer = create("td");
            employer.append(
                create("span", "jobs-employer-name",
                    job.employer?.name || "—"),
                create("span", "jobs-muted",
                    job.employer?.reference || "")
            );
            row.append(employer);

            row.append(
                createJobCell(
                    [job.location?.city, job.location?.country]
                        .filter(Boolean).join(", ")
                ),
                createJobCell(job.employmentType),
                createJobCell(formatDate(job.createdAt))
            );

            const statusCell = create("td");
            statusCell.append(createStatusBadge(job.status));
            row.append(statusCell);

            const actionsCell = create("td");
            const actionGroup = create("div", "job-row-actions");

            const viewButton = create(
                "button",
                "job-view-button",
                "View Details"
            );

            viewButton.type = "button";
            viewButton.addEventListener("click", () => {
                openDetails(job.id);
            });

            actionGroup.append(viewButton);
            actionsCell.append(actionGroup);
            row.append(actionsCell);

            fragment.append(row);
        }

        if (fragment.childNodes.length === 0) {
            emptyTable(
                "No matching jobs found",
                "No job listings were returned for the selected filters."
            );
        } else {
            el.tableBody.replaceChildren(fragment);
        }

        const pagination = data.pagination;

        const total = Number.isSafeInteger(pagination.total)
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
                : validCount(total) + " job records";

        el.pageInfo.textContent =
            state.totalPages > 0
                ? `Page ${state.page} of ${state.totalPages}`
                : "No pages";

        el.previous.disabled = state.page <= 1;

        el.next.disabled =
            state.totalPages === 0 ||
            state.page >= state.totalPages;
    }

    async function loadJobs() {
        if (!state.authorized) return;

        const requestId = ++state.jobsRequest;

        emptyTable(
            "Loading job records",
            "Retrieving authorized platform job listings..."
        );

        try {
            const query = buildQuery();

            const data = await requestJSON(
                API.jobs + "?" + query.toString()
            );

            if (
                requestId !== state.jobsRequest ||
                !state.authorized
            ) return;

            renderJobs(data);

        } catch (error) {
            if (requestId !== state.jobsRequest) return;

            if (handleAuthorizationError(error)) return;

            emptyTable(
                "Job records unavailable",
                "The job service could not provide the requested records."
            );

            notice(
                "Job records could not be loaded.",
                "error"
            );
        }
    }

    async function refreshAll() {
        if (!state.authorized) return;

        notice("Refreshing job management records...");

        await Promise.all([
            loadMetrics(),
            loadJobs()
        ]);

        if (state.authorized) {
            notice("Job management data refreshed.", "success");
        }
    }

    /* -------------------------------------------------------
       JOB DETAILS
       ------------------------------------------------------- */

    function detailField(label, value) {
        const wrapper = create("div", "job-detail-field");

        wrapper.append(
            create("label", "", label),
            create("p", "", safeValue(value))
        );

        return wrapper;
    }

    function detailSection(title, fields) {
        const section = create("section", "job-detail-section");

        section.append(create("h3", "", title));

        fields.forEach(field => {
            section.append(field);
        });

        return section;
    }

    function renderDetails(job) {
        el.detailTitle.textContent = safeValue(job.title);
        el.detailContent.replaceChildren();

        el.detailContent.append(
            detailSection("Job Information", [
                detailField("Job Reference", job.reference),
                detailField("Job Title", job.title),
                detailField("Current Status",
                    STATUS_LABELS[job.status] || job.status),
                detailField("Employment Type", job.employmentType),
                detailField("Work Arrangement", job.workMode),
                detailField("Workplace Location",
                    [job.location?.city, job.location?.region,
                    job.location?.country].filter(Boolean).join(", ")),
                detailField("Number of Vacancies", job.vacancies),
                detailField("Posted Date", formatDate(job.createdAt)),
                detailField("Closing Date", formatDate(job.closesAt))
            ]),

            detailSection("Employer Information", [
                detailField("Employer Name", job.employer?.name),
                detailField("Employer Reference", job.employer?.reference),
                detailField("Employer ID", job.employer?.id)
            ]),

            detailSection("Job Description", [
                detailField("Description", job.description),
                detailField("Responsibilities", job.responsibilities),
                detailField("Qualifications", job.qualifications),
                detailField("Required Skills", job.requiredSkills),
                detailField("Experience Requirements",
                    job.experienceRequirements)
            ]),

            detailSection("Compensation", [
                detailField("Compensation Type", job.compensation?.type),
                detailField("Minimum Amount", job.compensation?.minimum),
                detailField("Maximum Amount", job.compensation?.maximum),
                detailField("Currency", job.compensation?.currency),
                detailField("Compensation Period", job.compensation?.period)
            ]),

            detailSection("Moderation Information", [
                detailField("Flag Reason", job.flagReason),
                detailField("Last Modified", formatDate(job.updatedAt)),
                detailField("Moderation History",
                    job.moderationSummary)
            ])
        );
    }

    function availableActions(status) {
        switch (status) {
            case "pending_review":
                return ["approve", "reject", "remove"];

            case "published":
                return ["close", "remove"];

            case "closed":
                return ["restore", "remove"];

            case "flagged":
                return ["approve", "reject", "remove"];

            case "removed":
                return ["restore"];

            default:
                return [];
        }
    }

    function updateDetailActions(status) {
        const available = availableActions(status);

        const ids = {
            approve: "job-approve",
            reject: "job-reject",
            close: "job-close",
            restore: "job-restore",
            remove: "job-remove"
        };

        for (const [action, id] of Object.entries(ids)) {
            const button = $(id);
            const permitted = available.includes(action);

            button.hidden = !permitted;
            button.disabled = !permitted || !state.authorized;
        }
    }

    async function openDetails(id) {
        if (!state.authorized) return;

        notice("Loading job details...");

        try {
            const job = await requestJSON(
                API.jobs + "/" + encodeURIComponent(id)
            );

            if (!state.authorized) return;

            if (!job || job.id !== id ||
                !Object.hasOwn(STATUS_LABELS, job.status)) {
                throw new Error("Invalid job detail response.");
            }

            state.selectedJob = job;

            renderDetails(job);
            updateDetailActions(job.status);

            el.detailOverlay.hidden = false;
            document.body.style.overflow = "hidden";

            el.detailClose.focus();

            notice("Job details loaded.", "success");

        } catch (error) {
            if (handleAuthorizationError(error)) return;

            notice(
                "Unable to retrieve this job's details.",
                "error"
            );
        }
    }

    function closeDetails() {
        el.detailOverlay.hidden = true;
        state.selectedJob = null;
        document.body.style.overflow = "";
    }

    /* -------------------------------------------------------
       MODERATION ACTIONS
       ------------------------------------------------------- */

    function requestAction(action) {
        if (
            !state.authorized ||
            !state.selectedJob ||
            state.actionInProgress ||
            !Object.hasOwn(ACTIONS, action)
        ) return;

        if (
            !availableActions(state.selectedJob.status)
                .includes(action)
        ) return;

        state.pendingAction = action;

        const config = ACTIONS[action];

        el.confirmTitle.textContent =
            "Confirm: " + config.label;

        el.confirmDescription.textContent =
            config.description + " Job reference: " +
            safeValue(state.selectedJob.reference);

        el.confirmReason.value = "";
        el.confirmSubmit.disabled = true;
        el.confirmSubmit.textContent = "Confirm Action";

        el.confirmOverlay.hidden = false;
        el.confirmReason.focus();

    }

    function closeConfirmation() {
        if (state.actionInProgress) return;

        el.confirmOverlay.hidden = true;
        state.pendingAction = null;
        el.confirmReason.value = "";
    }

    async function executeAction() {
        if (
            !state.authorized ||
            !state.selectedJob ||
            !state.pendingAction ||
            state.actionInProgress
        ) return;

        const reason = el.confirmReason.value.trim();

        if (reason.length < 5) {
            notice(
                "Please enter a meaningful reason of at least five characters.",
                "warning"
            );
            el.confirmReason.focus();
            return;
        }

        const action = state.pendingAction;
        const jobId = state.selectedJob.id;

        state.actionInProgress = true;
        el.confirmSubmit.disabled = true;
        el.confirmCancel.disabled = true;
        el.confirmSubmit.textContent = "Processing...";

        try {
            const result = await requestJSON(
                API.action(jobId),
                {
                    method: "POST",
                    body: JSON.stringify({
                        action,
                        reason
                    })
                }
            );

            if (!state.authorized) return;

            closeConfirmation();
            closeDetails();

            notice(
                result?.message ||
                "The moderation request was accepted by the server.",
                "success"
            );

            state.page = 1;

            await Promise.all([
                loadMetrics(),
                loadJobs()
            ]);

        } catch (error) {
            if (!handleAuthorizationError(error)) {
                notice(
                    error.message ||
                    "The moderation action could not be completed.",
                    "error"
                );
            }
        } finally {
            state.actionInProgress = false;
            el.confirmCancel.disabled = false;
            el.confirmSubmit.disabled = true;
            el.confirmSubmit.textContent = "Confirm Action";
        }
    }

    /* -------------------------------------------------------
       TABS
       ------------------------------------------------------- */

    function selectStatus(status) {
        const allowed = [
            "all",
            "pending_review",
            "published",
            "closed",
            "flagged",
            "removed"
        ];

        if (!allowed.includes(status)) return;

        state.status = status;
        state.page = 1;

        document.querySelectorAll(".jobs-tab")
            .forEach(button => {
                const active = button.dataset.status === status;

                button.classList.toggle("active", active);
                button.setAttribute("aria-selected", String(active));
                button.tabIndex = active ? 0 : -1;
            });

        loadJobs();
    }

    /* -------------------------------------------------------
       SIDEBAR
       ------------------------------------------------------- */

    function openSidebar() {
        $("sidebar").classList.add("sidebar-open");
        $("sidebar-overlay").hidden = false;
        $("menu-toggle").setAttribute("aria-expanded", "true");
    }

    function closeSidebar() {
        $("sidebar").classList.remove("sidebar-open");
        $("sidebar-overlay").hidden = true;
        $("menu-toggle").setAttribute("aria-expanded", "false");
    }

    /* -------------------------------------------------------
       EVENTS
       ------------------------------------------------------- */

    function registerEvents() {
        $("menu-toggle").addEventListener("click", openSidebar);
        $("close-sidebar").addEventListener("click", closeSidebar);
        $("sidebar-overlay").addEventListener("click", closeSidebar);

        $("jobs-refresh").addEventListener("click", refreshAll);

        el.filterForm.addEventListener("submit", event => {
            event.preventDefault();

            if (!state.authorized) return;

            applyFilterValues();
            loadJobs();
        });

        el.clearFilters.addEventListener("click", () => {
            el.search.value = "";
            el.type.value = "";
            el.workMode.value = "";
            el.dateSort.value = "newest";

            applyFilterValues();
            loadJobs();
        });

        el.previous.addEventListener("click", () => {
            if (!state.authorized || state.page <= 1) return;

            state.page--;
            loadJobs();
        });

        el.next.addEventListener("click", () => {
            if (
                !state.authorized ||
                state.page >= state.totalPages
            ) return;

            state.page++;
            loadJobs();
        });

        document.querySelectorAll(".jobs-tab")
            .forEach((button, index, buttons) => {

                button.addEventListener("click", () => {
                    selectStatus(button.dataset.status);
                });

                button.addEventListener("keydown", event => {
                    let target = index;

                    if (event.key === "ArrowRight") {
                        target = (index + 1) % buttons.length;
                    } else if (event.key === "ArrowLeft") {
                        target = (index - 1 + buttons.length) %
                            buttons.length;
                    } else if (event.key === "Home") {
                        target = 0;
                    } else if (event.key === "End") {
                        target = buttons.length - 1;
                    } else {
                        return;
                    }

                    event.preventDefault();
                    buttons[target].focus();
                    selectStatus(buttons[target].dataset.status);
                });
            });

        el.detailClose.addEventListener("click", closeDetails);

        el.detailOverlay.addEventListener("click", event => {
            if (event.target === el.detailOverlay) closeDetails();
        });

        el.confirmReason.addEventListener("input", () => {
            el.confirmSubmit.disabled =
                el.confirmReason.value.trim().length < 5 ||
                !state.authorized;
        });

        el.confirmCancel.addEventListener(
            "click",
            closeConfirmation
        );

        el.confirmSubmit.addEventListener(
            "click",
            executeAction
        );

        $("job-approve").addEventListener(
            "click", () => requestAction("approve")
        );

        $("job-reject").addEventListener(
            "click", () => requestAction("reject")
        );

        $("job-close").addEventListener(
            "click", () => requestAction("close")
        );

        $("job-restore").addEventListener(
            "click", () => requestAction("restore")
        );

        $("job-remove").addEventListener(
            "click", () => requestAction("remove")
        );

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                if (!el.confirmOverlay.hidden) {
                    closeConfirmation();
                } else if (!el.detailOverlay.hidden) {
                    closeDetails();
                } else {
                    closeSidebar();
                }
            }
        });
    }

    /* -------------------------------------------------------
       INITIALIZATION
       ------------------------------------------------------- */

    async function initialize() {
        clearMetrics();
        registerEvents();

        try {
            const session = await requestJSON(API.session);

            if (
                session?.authenticated !== true ||
                !session.user?.id ||
                session.user.role !== "super_admin"
            ) {
                showLocked("Sign in using an authorized Super Admin account.");
                return;
            }

            state.authorized = true;

            state.csrfToken =
                typeof session.csrfToken === "string"
                    ? session.csrfToken
                    : null;

            showApplication();
            setConnection("Connecting...");

            enableFilters();

            await refreshAll();

            if (state.authorized) {
                setConnection("Connected", true);
            }

        } catch (error) {
            if (!state.authorized) {
                showLocked(
                    "Administrator authorization could not be verified."
                );
            } else {
                setConnection("Not Connected");
                notice(
                    "The job management service is unavailable.",
                    "error"
                );
            }
        }
    }

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
