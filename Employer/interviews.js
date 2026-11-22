
/* =========================================================
   TALVORA EMPLOYER PORTAL
   MODULE 7: INTERVIEWS & COMMUNICATION ENGINE

   FEATURES:
   - Interview scheduling and rescheduling
   - Interviewer and panel assignments
   - Virtual, physical and telephone interviews
   - Interview status management
   - Interview feedback and evaluation
   - Candidate communication
   - Application-linked message history
   - Recruitment notifications through backend
========================================================= */

(() => {
    "use strict";

    const shared = window.TALVORA_EMPLOYER;

    if (!shared) {
        console.error("TALVORA employer.js must load before interviews.js.");
        return;
    }

    const state = {
        initialized: false,
        loading: false,
        interviews: [],
        applications: [],
        jobs: [],
        filtered: [],
        messages: [],
        selectedApplicationId: null,
        messageLoading: false
    };

    const $ = id => document.getElementById(id);
    const api = shared.api;
    const companyPath = suffix => shared.companyPath(suffix);


    /* =====================================================
       1. UTILITIES
    ===================================================== */

    function dataOf(response) {
        return response?.data ?? response ?? {};
    }

    function listOf(response, key) {
        const data = dataOf(response);

        if (Array.isArray(data)) return data;
        if (Array.isArray(data[key])) return data[key];
        if (Array.isArray(data.items)) return data.items;

        return [];
    }

    function formatNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n.toLocaleString() : "0";
    }

    function formatLabel(value) {
        if (!value) return "Unknown";

        return String(value)
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());
    }

    function formatDate(value) {
        if (!value) return "—";

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? "—"
            : date.toLocaleDateString();
    }

    function formatDateTime(value) {
        if (!value) return "—";

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? "—"
            : date.toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short"
            });
    }

    function toast(message, type = "info") {
        const region = $("toastRegion");

        if (!region) {
            console.log("[TALVORA INTERVIEWS]", message);
            return;
        }

        const element = document.createElement("div");
        element.className = `toast ${type}`;
        element.textContent = message;
        element.setAttribute("role", "status");

        region.appendChild(element);

        setTimeout(() => element.remove(), 4500);
    }

    function createElement(tag, className = "", text) {
        const element = document.createElement(tag);

        if (className) element.className = className;
        if (text !== undefined) element.textContent = String(text);

        return element;
    }

    function setConnection(message, status = "") {
        if ($("interviewsConnectionStatus")) {
            $("interviewsConnectionStatus").textContent = message;
        }

        const dot = document.querySelector(
            ".interviews-page .connection-dot"
        );

        if (dot) dot.className = `connection-dot ${status}`;
    }


    /* =====================================================
       2. APPLICATION AND CANDIDATE HELPERS
    ===================================================== */

    function candidateOf(application) {
        return application.candidate ||
            application.applicant ||
            {};
    }

    function candidateName(application) {
        const candidate = candidateOf(application);

        return candidate.fullName ||
            candidate.name ||
            application.applicantName ||
            [
                candidate.firstName,
                candidate.lastName
            ].filter(Boolean).join(" ") ||
            "Unnamed Candidate";
    }

    function applicationOf(interview) {
        return interview.application ||
            state.applications.find(application =>
                String(application.id) ===
                String(interview.applicationId)
            ) ||
            {};
    }

    function candidateForInterview(interview) {
        const application = applicationOf(interview);
        const candidate = interview.candidate ||
            application.candidate ||
            application.applicant ||
            {};

        return candidate.fullName ||
            candidate.name ||
            application.applicantName ||
            "Unknown Candidate";
    }

    function jobForApplication(application) {
        return application.job ||
            state.jobs.find(job =>
                String(job.id) ===
                String(application.jobId)
            ) ||
            {};
    }

    function jobForInterview(interview) {
        const application = applicationOf(interview);

        return interview.job?.title ||
            jobForApplication(application).title ||
            interview.jobTitle ||
            "Unknown Job";
    }

    function applicationDateTime(interview) {
        return interview.scheduledAt ||
            interview.startAt ||
            interview.interviewDate ||
            null;
    }

    function interviewStatus(interview) {
        return String(interview.status || "scheduled").toLowerCase();
    }

    function interviewMode(interview) {
        return String(interview.mode || interview.interviewMode || "onsite").toLowerCase();
    }


    /* =====================================================
       3. LOAD INTERVIEW DATA
    ===================================================== */

    async function load() {
        bind();

        if (state.loading) return;

        if (!shared.getCompanyId()) {
            setConnection("No organization selected", "error");
            renderEmpty();
            return;
        }

        state.loading = true;
        setConnection("Loading interview and communication data...");

        try {
            const results = await Promise.allSettled([
                api(companyPath("/interviews")),
                api(companyPath("/applications")),
                api(companyPath("/jobs"))
            ]);

            if (results[0].status === "rejected") {
                throw results[0].reason;
            }

            state.interviews = listOf(
                results[0].value,
                "interviews"
            );

            state.applications = results[1].status === "fulfilled"
                ? listOf(results[1].value, "applications")
                : [];

            state.jobs = results[2].status === "fulfilled"
                ? listOf(results[2].value, "jobs")
                : [];

            populateApplicationSelects();

            state.filtered = [...state.interviews];

            renderAll();

            setConnection("Connected to TALVORA", "connected");

            if ($("interviewsLastUpdated")) {
                $("interviewsLastUpdated").textContent =
                    `Updated ${new Date().toLocaleTimeString()}`;
            }

        } catch (error) {
            console.error("[TALVORA INTERVIEWS]", error);

            setConnection("Unable to load interview records", "error");
            toast(error.message, "error");

            renderEmpty();

        } finally {
            state.loading = false;
        }
    }

    function renderEmpty() {
        const body = $("interviewsTableBody");
        if (!body) return;

        body.replaceChildren();

        const row = createElement("tr");
        const td = createElement(
            "td",
            "table-loading",
            "Unable to load interviews. Please refresh and try again."
        );

        td.colSpan = 8;
        row.appendChild(td);
        body.appendChild(row);
    }


    /* =====================================================
       4. APPLICATION SELECTS
    ===================================================== */

    function populateApplicationSelects() {
        [
            $("interviewApplication"),
            $("messageApplicationSelect")
        ].forEach(select => {
            if (!select) return;

            const previous = select.value;
            select.replaceChildren();

            const first = createElement(
                "option",
                "",
                "Select candidate application"
            );

            first.value = "";
            select.appendChild(first);

            state.applications.forEach(application => {
                const option = createElement(
                    "option",
                    "",
                    `${candidateName(application)} — ${jobForApplication(application).title || "Job"}`
                );

                option.value = application.id;
                select.appendChild(option);
            });

            if (Array.from(select.options).some(option =>
                option.value === previous
            )) {
                select.value = previous;
            }
        });
    }


    /* =====================================================
       5. STATISTICS
    ===================================================== */

    function renderKPIs() {
        const records = state.interviews;

        const count = predicate =>
            records.filter(predicate).length;

        const now = Date.now();

        const upcoming = count(interview => {
            const date = new Date(applicationDateTime(interview)).getTime();

            return (
                Number.isFinite(date) &&
                date >= now &&
                ["scheduled", "confirmed", "rescheduled"]
                    .includes(interviewStatus(interview))
            );
        });

        const completed = count(
            interview => interviewStatus(interview) === "completed"
        );

        const virtual = count(
            interview => interviewMode(interview) === "virtual"
        );

        const pendingFeedback = count(interview =>
            interviewStatus(interview) === "completed" &&
            !interview.outcome &&
            !interview.feedback
        );

        const values = {
            totalInterviews: records.length,
            scheduledInterviews: upcoming,
            completedInterviews: completed,
            virtualInterviews: virtual,
            pendingFeedback
        };

        Object.entries(values).forEach(([id, value]) => {
            if ($(id)) {
                $(id).textContent = formatNumber(value);
            }
        });

        if ($("upcomingInterviewCount")) {
            $("upcomingInterviewCount").textContent =
                `${upcoming} upcoming`;
        }
    }


    /* =====================================================
       6. STATUS BADGES
    ===================================================== */

    function statusBadge(status) {
        const classes = {
            scheduled: "pending",
            confirmed: "verified",
            completed: "verified",
            cancelled: "rejected",
            rescheduled: "pending"
        };

        return createElement(
            "span",
            `status-badge ${classes[status] || "neutral"}`,
            formatLabel(status)
        );
    }


    /* =====================================================
       7. UPCOMING INTERVIEWS
    ===================================================== */

    function renderUpcoming() {
        const container = $("upcomingInterviews");
        if (!container) return;

        container.replaceChildren();

        const now = Date.now();

        const upcoming = [...state.interviews]
            .filter(interview => {
                const date = new Date(
                    applicationDateTime(interview)
                ).getTime();

                return (
                    Number.isFinite(date) &&
                    date >= now &&
                    ["scheduled", "confirmed", "rescheduled"]
                        .includes(interviewStatus(interview))
                );
            })
            .sort((a, b) =>
                new Date(applicationDateTime(a)) -
                new Date(applicationDateTime(b))
            )
            .slice(0, 6);

        if (!upcoming.length) {
            container.appendChild(
                createElement(
                    "p",
                    "empty-record",
                    "No upcoming interviews scheduled."
                )
            );
            return;
        }

        upcoming.forEach(interview => {
            const card = createElement("article", "upcoming-card");

            card.append(
                createElement(
                    "strong",
                    "",
                    candidateForInterview(interview)
                ),
                createElement(
                    "p",
                    "",
                    jobForInterview(interview)
                ),
                createElement(
                    "p",
                    "",
                    `${formatLabel(interviewMode(interview))} • ${formatLabel(interview.interviewType)}`
                ),
                createElement(
                    "time",
                    "",
                    formatDateTime(applicationDateTime(interview))
                )
            );

            container.appendChild(card);
        });
    }


    /* =====================================================
       8. INTERVIEW TABLE
    ===================================================== */

    function renderTable() {
        const body = $("interviewsTableBody");
        if (!body) return;

        body.replaceChildren();

        const records = state.filtered;

        if ($("interviewCountLabel")) {
            $("interviewCountLabel").textContent =
                `${state.interviews.length} interviews`;
        }

        if ($("interviewsTableFooter")) {
            $("interviewsTableFooter").textContent =
                `Showing ${records.length} of ${state.interviews.length} interviews`;
        }

        if ($("interviewsFilteredCount")) {
            $("interviewsFilteredCount").textContent =
                `${records.length} records`;
        }

        if (!records.length) {
            const row = createElement("tr");
            const td = createElement(
                "td",
                "table-loading",
                "No interviews match your filters."
            );

            td.colSpan = 8;
            row.appendChild(td);
            body.appendChild(row);
            return;
        }

        records.forEach(interview => {
            const row = createElement("tr");

            const candidateCell = createElement("td");

            candidateCell.append(
                createElement(
                    "div",
                    "primary-text",
                    candidateForInterview(interview)
                ),
                createElement(
                    "small",
                    "secondary-text",
                    interview.applicationReference ||
                    applicationOf(interview).reference ||
                    "Application"
                )
            );

            row.appendChild(candidateCell);

            const jobCell = createElement(
                "td",
                "primary-text",
                jobForInterview(interview)
            );

            row.appendChild(jobCell);

            row.appendChild(
                createElement(
                    "td",
                    "",
                    formatLabel(interview.interviewType)
                )
            );

            row.appendChild(
                createElement(
                    "td",
                    "",
                    formatDateTime(applicationDateTime(interview))
                )
            );

            row.appendChild(
                createElement(
                    "td",
                    "",
                    interview.interviewerName || "Not assigned"
                )
            );

            row.appendChild(
                createElement(
                    "td",
                    "",
                    formatLabel(interviewMode(interview))
                )
            );

            const statusCell = createElement("td");
            statusCell.appendChild(
                statusBadge(interviewStatus(interview))
            );

            row.appendChild(statusCell);

            const actionCell = createElement("td");
            const actions = createElement("div", "table-actions");

            const id = String(interview.id || "");
            const status = interviewStatus(interview);

            if (["scheduled", "confirmed", "rescheduled"].includes(status)) {
                actions.append(
                    actionButton("Reschedule", "edit", id),
                    actionButton("Feedback", "feedback", id),
                    actionButton("Cancel", "cancel", id, true)
                );
            } else if (status === "completed" && !interview.feedback) {
                actions.append(
                    actionButton("Feedback", "feedback", id)
                );
            }

            if (interview.meetingUrl && status !== "cancelled") {
                const url = safeUrl(interview.meetingUrl);

                if (url) {
                    const link = createElement(
                        "a",
                        "table-action",
                        "Meeting ↗"
                    );

                    link.href = url;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    actions.appendChild(link);
                }
            }

            actionCell.appendChild(actions);
            row.appendChild(actionCell);

            body.appendChild(row);
        });
    }

    function actionButton(text, action, id, danger = false) {
        const button = createElement(
            "button",
            `table-action ${danger ? "danger" : ""}`,
            text
        );

        button.type = "button";
        button.dataset.action = action;
        button.dataset.id = id;

        return button;
    }


    /* =====================================================
       9. SEARCH AND FILTERS
    ===================================================== */

    function filterInterviews() {
        const query = ($("interviewSearch")?.value || "")
            .trim()
            .toLowerCase();

        const status = $("interviewStatusFilter")?.value || "";
        const mode = $("interviewModeFilter")?.value || "";

        state.filtered = state.interviews.filter(interview => {
            const searchable = [
                candidateForInterview(interview),
                jobForInterview(interview),
                interview.interviewerName,
                interview.interviewType
            ].filter(Boolean).join(" ").toLowerCase();

            return (
                (!query || searchable.includes(query)) &&
                (!status || interviewStatus(interview) === status) &&
                (!mode || interviewMode(interview) === mode)
            );
        });

        renderTable();
    }

    function clearFilters() {
        [
            "interviewSearch",
            "interviewStatusFilter",
            "interviewModeFilter"
        ].forEach(id => {
            if ($(id)) $(id).value = "";
        });

        filterInterviews();
    }


    /* =====================================================
       10. SAFE URL VALIDATION
    ===================================================== */

    function safeUrl(value) {
        if (!value || typeof value !== "string") return null;

        try {
            const url = new URL(value, window.location.origin);

            return ["http:", "https:"].includes(url.protocol)
                ? url.href
                : null;
        } catch {
            return null;
        }
    }


    /* =====================================================
       11. SCHEDULE / RESCHEDULE DIALOG
    ===================================================== */

    function openScheduleDialog(id = null) {
        const form = $("interviewForm");
        if (!form) return;

        form.reset();

        $("interviewId").value = "";

        const button = $("saveInterviewButton");

        if (!id) {
            $("interviewDialogTitle").textContent =
                "Schedule Interview";

            button.textContent = "Schedule Interview";
            $("interviewApplication").disabled = false;

        } else {
            const interview = state.interviews.find(
                item => String(item.id) === String(id)
            );

            if (!interview) {
                toast("Interview record not found.", "error");
                return;
            }

            $("interviewDialogTitle").textContent =
                "Reschedule Interview";

            $("interviewId").value = interview.id;

            $("interviewApplication").value =
                interview.applicationId || "";

            $("interviewApplication").disabled = true;

            form.elements.namedItem("interviewType").value =
                interview.interviewType || "screening";

            $("interviewMode").value =
                interviewMode(interview);

            const date = new Date(applicationDateTime(interview));

            if (!Number.isNaN(date.getTime())) {
                const local = new Date(
                    date.getTime() - date.getTimezoneOffset() * 60000
                ).toISOString().slice(0, 16);

                $("interviewScheduledAt").value = local;
            }

            form.elements.namedItem("durationMinutes").value =
                interview.durationMinutes || 60;

            form.elements.namedItem("interviewerName").value =
                interview.interviewerName || "";

            form.elements.namedItem("interviewerEmail").value =
                interview.interviewerEmail || "";

            form.elements.namedItem("meetingUrl").value =
                interview.meetingUrl || "";

            form.elements.namedItem("physicalLocation").value =
                interview.physicalLocation || "";

            form.elements.namedItem("instructions").value =
                interview.instructions || "";

            button.textContent = "Update Schedule";
        }

        $("interviewApplication").disabled = false;

        $("interviewDialog").showModal();
    }


    /* =====================================================
       12. SAVE INTERVIEW
    ===================================================== */

    async function saveInterview(event) {
        event.preventDefault();

        const form = $("interviewForm");
        if (!form.reportValidity()) return;

        const id = $("interviewId").value;
        const editing = Boolean(id);

        const scheduledAt =
            form.elements.namedItem("scheduledAt").value;

        const date = new Date(scheduledAt);

        if (
            Number.isNaN(date.getTime()) ||
            date.getTime() <= Date.now()
        ) {
            toast("Choose a valid future interview date and time.", "warning");
            return;
        }

        const mode = $("interviewMode").value;

        const payload = {
            applicationId:
                form.elements.namedItem("applicationId").value,

            interviewType:
                form.elements.namedItem("interviewType").value,

            mode,

            scheduledAt: date.toISOString(),

            durationMinutes: Number(
                form.elements.namedItem("durationMinutes").value
            ),

            interviewerName:
                form.elements.namedItem("interviewerName").value.trim(),

            interviewerEmail:
                form.elements.namedItem("interviewerEmail").value.trim(),

            meetingUrl:
                form.elements.namedItem("meetingUrl").value.trim(),

            physicalLocation:
                form.elements.namedItem("physicalLocation").value.trim(),

            instructions:
                form.elements.namedItem("instructions").value.trim()
        };

        if (!payload.applicationId) {
            toast("Select a candidate application.", "warning");
            return;
        }

        if (mode === "virtual" && !payload.meetingUrl) {
            toast("A meeting link is required for virtual interviews.", "warning");
            return;
        }

        if (mode === "onsite" && !payload.physicalLocation) {
            toast("Provide the physical interview location.", "warning");
            return;
        }

        const button = $("saveInterviewButton");
        button.disabled = true;
        button.textContent = editing ? "Updating..." : "Scheduling...";

        try {
            await api(
                editing
                    ? companyPath(`/interviews/${encodeURIComponent(id)}`)
                    : companyPath("/interviews"),
                {
                    method: editing ? "PATCH" : "POST",
                    body: {
                        ...payload,
                        status: editing ? "rescheduled" : "scheduled"
                    }
                }
            );

            $("interviewDialog").close();

            toast(
                editing
                    ? "Interview schedule updated."
                    : "Interview scheduled successfully.",
                "success"
            );

            await load();

        } catch (error) {
            toast(error.message, "error");

        } finally {
            button.disabled = false;
            button.textContent = editing
                ? "Update Schedule"
                : "Schedule Interview";

            $("interviewApplication").disabled = false;
        }
    }


    /* =====================================================
       13. CANCEL INTERVIEW
    ===================================================== */

    async function cancelInterview(id) {
        const interview = state.interviews.find(
            item => String(item.id) === String(id)
        );

        if (!interview) return;

        if (!window.confirm(
            `Cancel the interview for ${candidateForInterview(interview)}?`
        )) {
            return;
        }

        try {
            await api(
                companyPath(`/interviews/${encodeURIComponent(id)}`),
                {
                    method: "PATCH",
                    body: { status: "cancelled" }
                }
            );

            toast("Interview cancelled.", "success");
            await load();

        } catch (error) {
            toast(error.message, "error");
        }
    }


    /* =====================================================
       14. FEEDBACK DIALOG
    ===================================================== */

    function openFeedback(id) {
        const interview = state.interviews.find(
            item => String(item.id) === String(id)
        );

        if (!interview) {
            toast("Interview record not found.", "error");
            return;
        }

        $("feedbackForm").reset();

        $("feedbackInterviewId").value = id;

        $("feedbackOutcome").value =
            interview.outcome || "";

        $("feedbackRating").value =
            interview.rating || "";

        $("feedbackNotes").value =
            interview.feedback || "";

        $("feedbackDialog").showModal();
    }


    async function saveFeedback(event) {
        event.preventDefault();

        const id = $("feedbackInterviewId").value;

        const outcome = $("feedbackOutcome").value;
        const notes = $("feedbackNotes").value.trim();

        if (!outcome || !notes) {
            toast("Provide the interview outcome and feedback.", "warning");
            return;
        }

        const button = $("saveFeedbackButton");

        button.disabled = true;
        button.textContent = "Saving...";

        try {
            await api(
                companyPath(`/interviews/${encodeURIComponent(id)}`),
                {
                    method: "PATCH",
                    body: {
                        status: "completed",
                        outcome,
                        rating: $("feedbackRating").value
                            ? Number($("feedbackRating").value)
                            : null,
                        feedback: notes
                    }
                }
            );

            $("feedbackDialog").close();

            toast("Interview feedback saved.", "success");

            await load();

        } catch (error) {
            toast(error.message, "error");

        } finally {
            button.disabled = false;
            button.textContent = "Save Feedback";
        }
    }


    /* =====================================================
       15. LOAD CANDIDATE CONVERSATION
    ===================================================== */

    async function loadMessages() {
        const applicationId =
            $("messageApplicationSelect")?.value;

        if (!applicationId) {
            state.selectedApplicationId = null;
            state.messages = [];

            $("conversationCandidate").textContent =
                "No candidate selected";

            $("conversationJob").textContent =
                "Select an application to begin";

            $("conversationStatus").textContent =
                "Not connected";

            renderMessages();
            return;
        }

        state.selectedApplicationId = applicationId;

        const application = state.applications.find(
            item => String(item.id) === String(applicationId)
        );

        $("conversationCandidate").textContent =
            application ? candidateName(application) : "Candidate";

        $("conversationJob").textContent =
            application
                ? jobForApplication(application).title || "Application"
                : "Application";

        $("conversationStatus").textContent =
            "Loading conversation...";

        state.messageLoading = true;

        try {
            const result = await api(
                companyPath(
                    `/messages?applicationId=${encodeURIComponent(applicationId)}`
                )
            );

            state.messages = listOf(result, "messages");

            $("conversationStatus").textContent =
                "Conversation loaded";

            renderMessages();

        } catch (error) {
            console.error("[TALVORA MESSAGES]", error);

            state.messages = [];

            $("conversationStatus").textContent =
                "Unable to load messages";

            renderMessages();

            toast(error.message, "error");

        } finally {
            state.messageLoading = false;
        }
    }


    /* =====================================================
       16. RENDER MESSAGES
    ===================================================== */

    function renderMessages() {
        const container = $("messageThread");
        if (!container) return;

        container.replaceChildren();

        if (!state.selectedApplicationId) {
            container.appendChild(
                createElement(
                    "p",
                    "empty-record",
                    "Select a candidate application to view its conversation."
                )
            );
            return;
        }

        if (!state.messages.length) {
            container.appendChild(
                createElement(
                    "p",
                    "empty-record",
                    "No messages have been recorded for this application."
                )
            );
            return;
        }

        state.messages.forEach(message => {
            const senderType = String(
                message.senderType ||
                message.direction ||
                "candidate"
            ).toLowerCase();

            const sent = [
                "employer",
                "outgoing",
                "sent",
                "admin"
            ].includes(senderType);

            const bubble = createElement(
                "div",
                `message-bubble ${sent ? "sent" : ""}`
            );

            const sender = createElement(
                "strong",
                "",
                message.senderName ||
                (sent ? "Employer" : "Candidate")
            );

            const body = createElement(
                "div",
                "",
                message.body ||
                message.content ||
                message.message ||
                ""
            );

            const time = createElement(
                "time",
                "",
                formatDateTime(message.createdAt || message.sentAt)
            );

            bubble.append(sender, body, time);
            container.appendChild(bubble);
        });

        container.scrollTop = container.scrollHeight;
    }


    /* =====================================================
       17. SEND CANDIDATE MESSAGE
    ===================================================== */

    async function sendMessage(event) {
        event.preventDefault();

        const applicationId =
            $("messageApplicationSelect").value;

        const message =
            $("messageText").value.trim();

        if (!applicationId) {
            toast("Select a candidate application first.", "warning");
            return;
        }

        if (!message) {
            toast("Enter a message before sending.", "warning");
            return;
        }

        const button = $("sendMessageButton");

        button.disabled = true;
        button.textContent = "Sending...";

        try {
            await api(
                companyPath("/messages"),
                {
                    method: "POST",
                    body: {
                        applicationId,
                        channel: "platform",
                        body: message
                    }
                }
            );

            $("messageText").value = "";
            updateMessageCount();

            toast("Message submitted successfully.", "success");

            await loadMessages();

        } catch (error) {
            toast(error.message, "error");

        } finally {
            button.disabled = false;
            button.textContent = "Send Message →";
        }
    }


    function updateMessageCount() {
        const count = $("messageText")?.value.length || 0;

        if ($("messageCharacterCount")) {
            $("messageCharacterCount").textContent =
                `${count} / 5000`;
        }
    }


    /* =====================================================
       18. RENDER ALL
    ===================================================== */

    function renderAll() {
        renderKPIs();
        renderUpcoming();
        renderTable();
    }


    /* =====================================================
       19. TABLE EVENT DELEGATION
    ===================================================== */

    function bindTableActions() {
        $("interviewsTableBody")?.addEventListener(
            "click",
            event => {
                const button = event.target.closest("[data-action]");
                if (!button) return;

                const id = button.dataset.id;
                const action = button.dataset.action;

                if (action === "edit") {
                    openScheduleDialog(id);
                } else if (action === "feedback") {
                    openFeedback(id);
                } else if (action === "cancel") {
                    cancelInterview(id);
                }
            }
        );
    }


    /* =====================================================
       20. DIALOG BINDING
    ===================================================== */

    function bindDialogs() {
        $("interviewForm")?.addEventListener(
            "submit",
            saveInterview
        );

        $("feedbackForm")?.addEventListener(
            "submit",
            saveFeedback
        );

        document.querySelectorAll(
            '[data-close-dialog="interviewDialog"]'
        ).forEach(button => {
            button.addEventListener("click", () => {
                $("interviewDialog").close();
                $("interviewApplication").disabled = false;
            });
        });

        document.querySelectorAll(
            '[data-close-dialog="feedbackDialog"]'
        ).forEach(button => {
            button.addEventListener("click", () => {
                $("feedbackDialog").close();
            });
        });

        ["interviewDialog", "feedbackDialog"].forEach(id => {
            $(id)?.addEventListener("click", event => {
                if (event.target === $(id)) {
                    $(id).close();
                }
            });
        });
    }


    /* =====================================================
       21. EVENT BINDING
    ===================================================== */

    function bind() {
        if (state.initialized) return;

        state.initialized = true;

        $("refreshInterviewsButton")?.addEventListener(
            "click",
            load
        );

        $("scheduleInterviewButton")?.addEventListener(
            "click",
            () => openScheduleDialog()
        );

        $("clearInterviewFilters")?.addEventListener(
            "click",
            clearFilters
        );

        $("interviewSearch")?.addEventListener(
            "input",
            filterInterviews
        );

        [
            "interviewStatusFilter",
            "interviewModeFilter"
        ].forEach(id => {
            $(id)?.addEventListener("change", filterInterviews);
        });

        $("messageApplicationSelect")?.addEventListener(
            "change",
            loadMessages
        );

        $("refreshMessagesButton")?.addEventListener(
            "click",
            loadMessages
        );

        $("messageForm")?.addEventListener(
            "submit",
            sendMessage
        );

        $("messageText")?.addEventListener(
            "input",
            updateMessageCount
        );

        bindTableActions();
        bindDialogs();
    }


    /* =====================================================
       22. REGISTER MODULE
    ===================================================== */

    const module = {
        load,
        bind,
        refresh: load,
        loadMessages,
        getInterviews: () => [...state.interviews],
        getApplications: () => [...state.applications]
    };

    shared.registerModule("interviews", module);

    window.TALVORA_INTERVIEWS = module;

})();
