
/* =========================================================
   TALVORA EMPLOYER PORTAL
   MODULE 5: APPLICATIONS & RECRUITMENT ENGINE

   FEATURES:
   1. Applicant tracking
   2. Job-linked applications
   3. Branch and location tracking
   4. Candidate profile review
   5. Application screening
   6. Candidate shortlisting
   7. Recruitment stage management
   8. Candidate ratings
   9. Internal recruitment notes
   10. CV and resume access
   11. Hiring and rejection decisions
   12. Recruitment analytics
   13. CSV reporting

   INTEGRATES WITH:
   - TALVORA shared employer.js
   - Jobs Management
   - Company Management
   - Global Locations
========================================================= */

(() => {

    "use strict";

    const shared = window.TALVORA_EMPLOYER;

    if (!shared) {
        console.error(
            "TALVORA shared employer.js must load before applications.js."
        );
        return;
    }

    /* =====================================================
       1. MODULE STATE
    ===================================================== */

    const state = {

        initialized: false,

        loading: false,

        applications: [],

        jobs: [],

        locations: [],

        filtered: [],

        selectedApplication: null

    };

    const $ = id => document.getElementById(id);

    const api = shared.api;

    const companyPath = suffix =>
        shared.companyPath(suffix);


    /* =====================================================
       2. GENERAL UTILITIES
    ===================================================== */

    function dataOf(response) {

        return response?.data ?? response ?? {};

    }


    function listOf(response, key) {

        const data = dataOf(response);

        if (Array.isArray(data)) {
            return data;
        }

        if (Array.isArray(data[key])) {
            return data[key];
        }

        if (Array.isArray(data.items)) {
            return data.items;
        }

        return [];
    }


    function formatNumber(value) {

        const parsed = Number(value);

        return Number.isFinite(parsed)
            ? parsed.toLocaleString()
            : "0";

    }


    function formatDate(value) {

        if (!value) return "—";

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? "—"
            : date.toLocaleDateString();

    }


    function formatLabel(value) {

        if (!value) return "Unknown";

        return String(value)
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, letter =>
                letter.toUpperCase()
            );

    }


    function stageOf(application) {

        return String(
            application.stage ||
            application.status ||
            "new"
        ).toLowerCase();

    }


    function toast(message, type = "info") {

        const region = $("toastRegion");

        if (!region) {
            console.log(
                "[TALVORA APPLICATIONS]",
                message
            );

            return;
        }

        const element =
            document.createElement("div");

        element.className = `toast ${type}`;

        element.textContent = message;

        element.setAttribute("role", "status");

        region.appendChild(element);

        window.setTimeout(() => {
            element.remove();
        }, 4500);

    }


    function setConnection(message, status = "") {

        const text =
            $("applicationsConnectionStatus");

        const dot = document.querySelector(
            ".applications-page .connection-dot"
        );

        if (text) {
            text.textContent = message;
        }

        if (dot) {
            dot.className =
                `connection-dot ${status}`;
        }

    }


    function createElement(
        tag,
        className = "",
        content
    ) {

        const element =
            document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (content !== undefined) {
            element.textContent = String(content);
        }

        return element;

    }


    /* =====================================================
       3. CANDIDATE INFORMATION HELPERS
    ===================================================== */

    function candidateOf(application) {

        return (
            application.candidate ||
            application.applicant ||
            {}
        );

    }


    function candidateName(application) {

        const candidate =
            candidateOf(application);

        const fullName =
            candidate.fullName ||
            candidate.name ||
            application.applicantName;

        if (fullName) return fullName;

        const combined = [
            candidate.firstName,
            candidate.middleName,
            candidate.lastName
        ].filter(Boolean).join(" ");

        return combined || "Unnamed Applicant";

    }


    function candidateEmail(application) {

        const candidate =
            candidateOf(application);

        return (
            candidate.email ||
            application.email ||
            application.applicantEmail ||
            "Email unavailable"
        );

    }


    function candidatePhone(application) {

        const candidate =
            candidateOf(application);

        return (
            candidate.phone ||
            candidate.phoneNumber ||
            application.phone ||
            application.applicantPhone ||
            "Phone unavailable"
        );

    }


    function jobOf(application) {

        if (
            application.job &&
            typeof application.job === "object"
        ) {
            return application.job;
        }

        return state.jobs.find(job =>
            String(job.id) ===
            String(application.jobId)
        ) || {};

    }


    function jobTitle(application) {

        const job = jobOf(application);

        return (
            job.title ||
            application.jobTitle ||
            "Unknown Job"
        );

    }


    function locationOf(application) {

        if (
            application.location &&
            typeof application.location === "object"
        ) {
            return application.location;
        }

        const job = jobOf(application);

        const locationId =
            application.locationId ||
            job.locationId;

        return state.locations.find(location =>
            String(location.id) ===
            String(locationId)
        ) || {};

    }


    function locationName(application) {

        const location =
            locationOf(application);

        return (
            location.name ||
            location.displayName ||
            application.locationName ||
            jobOf(application).locationName ||
            "Not assigned"
        );

    }


    function applicationDate(application) {

        return (
            application.appliedAt ||
            application.submittedAt ||
            application.createdAt ||
            application.applicationDate ||
            null
        );

    }


    function candidateRating(application) {

        const rating =
            Number(application.rating);

        return Number.isFinite(rating) &&
            rating >= 1 &&
            rating <= 5
            ? rating
            : null;

    }


    function applicationReference(application) {

        return (
            application.reference ||
            application.applicationNumber ||
            application.id ||
            "—"
        );

    }


    /* =====================================================
       4. STATUS BADGES
    ===================================================== */

    function statusClass(stage) {

        const classes = {

            new: "pending",

            screening: "pending",

            shortlisted: "verified",

            interview: "verified",

            assessment: "pending",

            offer: "verified",

            hired: "verified",

            rejected: "rejected",

            withdrawn: "neutral"

        };

        return classes[stage] || "neutral";

    }


    function makeBadge(stage) {

        const element =
            createElement(
                "span",
                `status-badge ${statusClass(stage)}`,
                formatLabel(stage)
            );

        return element;

    }


    /* =====================================================
       5. LOAD APPLICATIONS, JOBS AND LOCATIONS
    ===================================================== */

    async function load() {

        bind();

        if (state.loading) return;

        if (!shared.getCompanyId()) {

            setConnection(
                "No organization selected",
                "error"
            );

            renderEmpty();

            return;
        }

        state.loading = true;

        setConnection(
            "Loading recruitment information..."
        );

        try {

            const [
                applicationsResult,
                jobsResult,
                locationsResult
            ] = await Promise.all([

                api(
                    companyPath(
                        "/applications?include=job,location,candidate"
                    )
                ),

                api(
                    companyPath("/jobs")
                ).catch(() => []),

                api(
                    companyPath("/locations")
                ).catch(() => [])

            ]);

            state.applications =
                listOf(
                    applicationsResult,
                    "applications"
                );

            state.jobs =
                listOf(jobsResult, "jobs");

            state.locations =
                listOf(locationsResult, "locations");

            populateFilters();

            state.filtered = [
                ...state.applications
            ];

            renderAll();

            setConnection(
                "Connected to TALVORA",
                "connected"
            );

            const updated =
                $("applicationsLastUpdated");

            if (updated) {

                updated.textContent =
                    `Updated ${new Date().toLocaleTimeString()}`;

            }

        } catch (error) {

            console.error(
                "[TALVORA APPLICATIONS]",
                error
            );

            setConnection(
                "Unable to load applications",
                "error"
            );

            toast(error.message, "error");

            renderEmpty();

        } finally {

            state.loading = false;

        }

    }


    function renderEmpty() {

        const body =
            $("applicationsTableBody");

        if (!body) return;

        body.replaceChildren();

        const row =
            document.createElement("tr");

        const cell =
            document.createElement("td");

        cell.colSpan = 7;

        cell.textContent =
            "Unable to load applications. Please refresh and try again.";

        row.appendChild(cell);

        body.appendChild(row);

    }


    /* =====================================================
       6. RECRUITMENT KPI STATISTICS
    ===================================================== */

    function renderKPIs() {

        const applications =
            state.applications;

        const count = stage =>
            applications.filter(item =>
                stageOf(item) === stage
            ).length;

        const statistics = {

            totalApplications:
                applications.length,

            newApplications:
                count("new"),

            shortlistedApplications:
                count("shortlisted"),

            interviewApplications:
                count("interview"),

            offerApplications:
                count("offer"),

            hiredApplications:
                count("hired")

        };

        Object.entries(statistics).forEach(
            ([id, value]) => {

                const element = $(id);

                if (element) {
                    element.textContent =
                        formatNumber(value);
                }

            }
        );

    }


    /* =====================================================
       7. RECRUITMENT PIPELINE
    ===================================================== */

    function renderPipeline() {

        const container =
            $("recruitmentPipeline");

        if (!container) return;

        container.replaceChildren();

        const stages = [

            ["New", "new"],

            ["Screening", "screening"],

            ["Shortlisted", "shortlisted"],

            ["Interview", "interview"],

            ["Assessment", "assessment"],

            ["Offer", "offer"],

            ["Hired", "hired"],

            ["Rejected", "rejected"],

            ["Withdrawn", "withdrawn"]

        ];

        stages.forEach(([name, key]) => {

            const count =
                state.applications.filter(item =>
                    stageOf(item) === key
                ).length;

            const card =
                createElement(
                    "div",
                    "pipeline-stage"
                );

            card.append(

                createElement(
                    "strong",
                    "",
                    formatNumber(count)
                ),

                createElement(
                    "span",
                    "",
                    name
                )

            );

            container.appendChild(card);

        });

    }


    /* =====================================================
       8. FILTER SELECTS
    ===================================================== */

    function populateFilters() {

        populateJobFilter();

        populateLocationFilter();

    }


    function populateJobFilter() {

        const select =
            $("applicationJobFilter");

        if (!select) return;

        const previous = select.value;

        select.replaceChildren();

        const all =
            createElement(
                "option",
                "",
                "All job listings"
            );

        all.value = "";

        select.appendChild(all);

        state.jobs.forEach(job => {

            const option =
                createElement(
                    "option",
                    "",
                    job.title || "Untitled Job"
                );

            option.value = job.id;

            select.appendChild(option);

        });

        if (state.jobs.some(job =>
            String(job.id) === String(previous)
        )) {
            select.value = previous;
        }

    }


    function populateLocationFilter() {

        const select =
            $("applicationLocationFilter");

        if (!select) return;

        const previous = select.value;

        select.replaceChildren();

        const all =
            createElement(
                "option",
                "",
                "All locations"
            );

        all.value = "";

        select.appendChild(all);

        state.locations.forEach(location => {

            const option =
                createElement(
                    "option",
                    "",
                    location.name ||
                    location.displayName ||
                    "Unnamed Location"
                );

            option.value = location.id;

            select.appendChild(option);

        });

        if (state.locations.some(location =>
            String(location.id) === String(previous)
        )) {
            select.value = previous;
        }

    }


    /* =====================================================
       9. APPLICATION SEARCH AND FILTERS
    ===================================================== */

    function filterApplications() {

        const search =
            ($("applicationSearch")?.value || "")
                .trim()
                .toLowerCase();

        const selectedStage =
            $("applicationStageFilter")?.value || "";

        const selectedJob =
            $("applicationJobFilter")?.value || "";

        const selectedLocation =
            $("applicationLocationFilter")?.value || "";

        state.filtered =
            state.applications.filter(application => {

                const searchable = [

                    candidateName(application),

                    candidateEmail(application),

                    candidatePhone(application),

                    jobTitle(application),

                    locationName(application),

                    applicationReference(application)

                ].join(" ").toLowerCase();

                const job =
                    jobOf(application);

                const location =
                    locationOf(application);

                return (

                    (!search ||
                        searchable.includes(search)) &&

                    (!selectedStage ||
                        stageOf(application) === selectedStage) &&

                    (!selectedJob ||
                        String(
                            application.jobId || job.id
                        ) === selectedJob) &&

                    (!selectedLocation ||
                        String(
                            application.locationId || location.id
                        ) === selectedLocation)

                );

            });

        renderApplicationTable();

    }


    /* =====================================================
       10. APPLICATION TABLE HELPERS
    ===================================================== */

    function applicantCell(application) {

        const td =
            document.createElement("td");

        const main =
            createElement(
                "div",
                "applicant-primary",
                candidateName(application)
            );

        const secondary =
            createElement(
                "small",
                "applicant-secondary",
                candidateEmail(application)
            );

        td.append(main, secondary);

        return td;

    }


    function normalCell(primary, secondary = "") {

        const td =
            document.createElement("td");

        td.appendChild(
            createElement(
                "div",
                "applicant-primary",
                primary
            )
        );

        if (secondary) {

            td.appendChild(
                createElement(
                    "small",
                    "applicant-secondary",
                    secondary
                )
            );

        }

        return td;

    }


    function actionButton(
        text,
        action,
        id,
        danger = false
    ) {

        const button =
            createElement(
                "button",
                `application-action ${danger ? "danger" : ""}`,
                text
            );

        button.type = "button";

        button.dataset.applicationAction = action;

        button.dataset.id = id;

        return button;

    }


    /* =====================================================
       11. RENDER APPLICATION TABLE
    ===================================================== */

    function renderApplicationTable() {

        const body =
            $("applicationsTableBody");

        if (!body) return;

        body.replaceChildren();

        const applications =
            state.filtered;

        if ($("applicationCountLabel")) {

            $("applicationCountLabel").textContent =
                `${state.applications.length} applications`;

        }

        if ($("applicationsTableFooter")) {

            $("applicationsTableFooter").textContent =
                `Showing ${applications.length} of ${state.applications.length} applications`;

        }

        if ($("applicationsFilteredCount")) {

            $("applicationsFilteredCount").textContent =
                `${applications.length} records`;

        }

        if (!applications.length) {

            const row =
                document.createElement("tr");

            const cell =
                document.createElement("td");

            cell.colSpan = 7;

            cell.textContent =
                "No applications match your filters.";

            row.appendChild(cell);

            body.appendChild(row);

            return;

        }


        applications.forEach(application => {

            const row =
                document.createElement("tr");

            const id =
                String(application.id || "");

            row.append(

                applicantCell(application),

                normalCell(
                    jobTitle(application)
                ),

                normalCell(
                    locationName(application)
                ),

                normalCell(
                    formatDate(
                        applicationDate(application)
                    )
                )

            );


            const stageCell =
                document.createElement("td");

            stageCell.appendChild(
                makeBadge(stageOf(application))
            );

            row.appendChild(stageCell);


            const rating =
                candidateRating(application);

            row.appendChild(
                normalCell(
                    rating
                        ? `${rating}/5`
                        : "Not rated"
                )
            );


            const actionsCell =
                document.createElement("td");

            const actions =
                createElement(
                    "div",
                    "application-action-group"
                );

            actions.appendChild(
                actionButton(
                    "Review",
                    "view",
                    id
                )
            );

            const currentStage =
                stageOf(application);

            if (![
                "shortlisted",
                "interview",
                "assessment",
                "offer",
                "hired",
                "rejected",
                "withdrawn"
            ].includes(currentStage)) {

                actions.appendChild(
                    actionButton(
                        "Shortlist",
                        "shortlist",
                        id
                    )
                );

            }

            if (![
                "hired",
                "rejected",
                "withdrawn"
            ].includes(currentStage)) {

                actions.appendChild(
                    actionButton(
                        "Reject",
                        "reject",
                        id,
                        true
                    )
                );

            }

            actionsCell.appendChild(actions);

            row.appendChild(actionsCell);

            body.appendChild(row);

        });

    }


    /* =====================================================
       12. RECENT APPLICATIONS
    ===================================================== */

    function renderRecentApplications() {

        const body =
            $("recentApplicationsBody");

        if (!body) return;

        body.replaceChildren();

        const records =
            [...state.applications]
                .sort((a, b) =>
                    new Date(
                        applicationDate(b) || 0
                    ).getTime() -
                    new Date(
                        applicationDate(a) || 0
                    ).getTime()
                )
                .slice(0, 6);

        if (!records.length) {

            const row =
                document.createElement("tr");

            const cell =
                document.createElement("td");

            cell.colSpan = 4;

            cell.textContent =
                "No applications received yet.";

            row.appendChild(cell);

            body.appendChild(row);

            return;

        }

        records.forEach(application => {

            const row =
                document.createElement("tr");

            row.append(

                normalCell(
                    candidateName(application),
                    candidateEmail(application)
                ),

                normalCell(
                    jobTitle(application)
                ),

                normalCell(
                    formatDate(
                        applicationDate(application)
                    )
                )

            );

            const statusCell =
                document.createElement("td");

            statusCell.appendChild(
                makeBadge(stageOf(application))
            );

            row.appendChild(statusCell);

            body.appendChild(row);

        });

    }


    /* =====================================================
       13. RENDER ALL
    ===================================================== */

    function renderAll() {

        renderKPIs();

        renderPipeline();

        renderApplicationTable();

        renderRecentApplications();

    }


    /* =====================================================
       14. DIALOG HELPERS
    ===================================================== */

    function openDialog() {

        const dialog =
            $("applicationDialog");

        if (dialog && !dialog.open) {
            dialog.showModal();
        }

    }


    function closeDialog() {

        const dialog =
            $("applicationDialog");

        if (dialog?.open) {
            dialog.close();
        }

    }


    /* =====================================================
       15. SAFE RESUME URL
    ===================================================== */

    function validResumeUrl(value) {

        if (!value || typeof value !== "string") {
            return null;
        }

        try {

            const url = new URL(
                value,
                window.location.origin
            );

            if (!["http:", "https:"].includes(url.protocol)) {
                return null;
            }

            return url.href;

        } catch {

            return null;

        }

    }


    function getResumeUrl(application) {

        const candidate =
            candidateOf(application);

        return (
            application.resumeUrl ||
            candidate.resumeUrl ||
            application.resume?.url ||
            candidate.resume?.url ||
            null
        );

    }


    /* =====================================================
       16. OPEN APPLICANT REVIEW
    ===================================================== */

    function openApplication(id) {

        const application =
            state.applications.find(item =>
                String(item.id) === String(id)
            );

        if (!application) {

            toast(
                "Application record not found.",
                "error"
            );

            return;

        }

        state.selectedApplication =
            application;

        const candidate =
            candidateOf(application);

        const name =
            candidateName(application);

        $("applicationId").value =
            application.id;

        $("applicationDialogTitle").textContent =
            "Applicant Review";

        $("candidateName").textContent =
            name;

        $("candidateEmail").textContent =
            candidateEmail(application);

        $("candidatePhone").textContent =
            candidatePhone(application);

        $("candidateAvatar").textContent =
            name.charAt(0).toUpperCase();

        $("candidateJob").textContent =
            jobTitle(application);

        $("candidateLocation").textContent =
            locationName(application);

        $("candidateAppliedAt").textContent =
            formatDate(applicationDate(application));

        $("candidateReference").textContent =
            applicationReference(application);


        $("applicationStage").value =
            stageOf(application);

        $("applicationRating").value =
            candidateRating(application) || "";

        $("applicationNotes").value =
            application.internalNotes ||
            application.recruitmentNotes ||
            "";


        const resumeLink =
            $("candidateResumeLink");

        const resumeUnavailable =
            $("candidateResumeUnavailable");

        const resumeUrl =
            validResumeUrl(getResumeUrl(application));

        if (resumeUrl) {

            resumeLink.href = resumeUrl;

            resumeLink.hidden = false;

            resumeUnavailable.hidden = true;

        } else {

            resumeLink.removeAttribute("href");

            resumeLink.hidden = true;

            resumeUnavailable.hidden = false;

        }

        openDialog();

    }


    /* =====================================================
       17. SAVE APPLICATION EVALUATION
    ===================================================== */

    async function saveApplication(event) {

        event.preventDefault();

        const form =
            $("applicationForm");

        const button =
            $("saveApplicationButton");

        if (!form || !form.reportValidity()) return;

        const id =
            $("applicationId").value;

        if (!id) {

            toast(
                "Application reference is missing.",
                "error"
            );

            return;

        }

        const payload = {

            stage:
                $("applicationStage").value,

            rating:
                $("applicationRating").value
                    ? Number($("applicationRating").value)
                    : null,

            internalNotes:
                $("applicationNotes").value.trim()

        };

        button.disabled = true;

        button.textContent = "Saving...";

        try {

            await api(
                companyPath(
                    `/applications/${encodeURIComponent(id)}`
                ),
                {
                    method: "PATCH",
                    body: payload
                }
            );

            toast(
                "Candidate evaluation updated successfully.",
                "success"
            );

            closeDialog();

            state.selectedApplication = null;

            await load();

        } catch (error) {

            toast(error.message, "error");

        } finally {

            button.disabled = false;

            button.textContent =
                "Save Evaluation";

        }

    }


    /* =====================================================
       18. QUICK RECRUITMENT STAGE CHANGE
    ===================================================== */

    async function changeStage(id, newStage) {

        const application =
            state.applications.find(item =>
                String(item.id) === String(id)
            );

        if (!application) return;

        const name =
            candidateName(application);

        const messages = {

            shortlisted:
                `Shortlist ${name}?`,

            rejected:
                `Reject ${name}'s application?`

        };

        if (
            messages[newStage] &&
            !window.confirm(messages[newStage])
        ) {
            return;
        }

        try {

            await api(
                companyPath(
                    `/applications/${encodeURIComponent(id)}`
                ),
                {
                    method: "PATCH",
                    body: {
                        stage: newStage
                    }
                }
            );

            toast(
                `${name} moved to ${formatLabel(newStage)}.`,
                "success"
            );

            await load();

        } catch (error) {

            toast(error.message, "error");

        }

    }


    /* =====================================================
       19. CSV REPORTING
    ===================================================== */

    function csvValue(value) {

        return `"${String(value ?? "")
            .replace(/"/g, '""')}"`;

    }


    function exportApplications() {

        if (!state.filtered.length) {

            toast(
                "No application records to export.",
                "warning"
            );

            return;

        }

        const headers = [

            "Application ID",

            "Application Reference",

            "Candidate Name",

            "Candidate Email",

            "Candidate Phone",

            "Job Title",

            "Location",

            "Application Date",

            "Recruitment Stage",

            "Candidate Rating"

        ];

        const rows =
            state.filtered.map(application => [

                application.id,

                applicationReference(application),

                candidateName(application),

                candidateEmail(application),

                candidatePhone(application),

                jobTitle(application),

                locationName(application),

                applicationDate(application),

                stageOf(application),

                candidateRating(application)

            ]);

        const csv = [

            headers,

            ...rows

        ].map(row =>

            row.map(csvValue).join(",")

        ).join("\r\n");


        const blob = new Blob(

            ["\uFEFF" + csv],

            {
                type: "text/csv;charset=utf-8;"
            }

        );

        const url =
            URL.createObjectURL(blob);

        const link =
            document.createElement("a");

        link.href = url;

        link.download =
            "talvora-applications-report.csv";

        document.body.appendChild(link);

        link.click();

        link.remove();

        URL.revokeObjectURL(url);

        toast(
            "Applications report exported successfully.",
            "success"
        );

    }


    /* =====================================================
       20. CLEAR FILTERS
    ===================================================== */

    function clearFilters() {

        [

            "applicationSearch",

            "applicationStageFilter",

            "applicationJobFilter",

            "applicationLocationFilter"

        ].forEach(id => {

            const element = $(id);

            if (element) {
                element.value = "";
            }

        });

        filterApplications();

    }


    /* =====================================================
       21. EVENT DELEGATION
    ===================================================== */

    function bindTableActions() {

        $("applicationsTableBody")?.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "[data-application-action]"
                    );

                if (!button) return;

                const id =
                    button.dataset.id;

                const action =
                    button.dataset.applicationAction;

                if (action === "view") {

                    openApplication(id);

                } else if (action === "shortlist") {

                    changeStage(
                        id,
                        "shortlisted"
                    );

                } else if (action === "reject") {

                    changeStage(
                        id,
                        "rejected"
                    );

                }

            }
        );

    }


    /* =====================================================
       22. FILTER EVENT BINDING
    ===================================================== */

    function bindFilters() {

        $("applicationSearch")?.addEventListener(
            "input",
            filterApplications
        );

        [

            "applicationStageFilter",

            "applicationJobFilter",

            "applicationLocationFilter"

        ].forEach(id => {

            $(id)?.addEventListener(
                "change",
                filterApplications
            );

        });

        $("clearApplicationFilters")?.addEventListener(
            "click",
            clearFilters
        );

    }


    /* =====================================================
       23. DIALOG EVENT BINDING
    ===================================================== */

    function bindDialog() {

        $("applicationForm")?.addEventListener(
            "submit",
            saveApplication
        );

        document.querySelectorAll(
            '[data-close-dialog="applicationDialog"]'
        ).forEach(button => {

            button.addEventListener(
                "click",
                closeDialog
            );

        });

        $("applicationDialog")?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    $("applicationDialog")
                ) {
                    closeDialog();
                }

            }
        );

    }


    /* =====================================================
       24. MAIN EVENT BINDING
    ===================================================== */

    function bind() {

        if (state.initialized) return;

        state.initialized = true;

        $("refreshApplicationsButton")?.addEventListener(
            "click",
            load
        );

        $("exportApplicationsButton")?.addEventListener(
            "click",
            exportApplications
        );

        bindTableActions();

        bindFilters();

        bindDialog();

    }


    /* =====================================================
       25. PUBLIC MODULE INTERFACE
    ===================================================== */

    const module = {

        load,

        bind,

        refresh: load,

        getApplications: () =>
            [...state.applications],

        getJobs: () =>
            [...state.jobs],

        getLocations: () =>
            [...state.locations]

    };


    /* =====================================================
       26. REGISTER MODULE WITH SHARED ENGINE
    ===================================================== */

    shared.registerModule(
        "applications",
        module
    );

    window.TALVORA_APPLICATIONS =
        module;


})();
