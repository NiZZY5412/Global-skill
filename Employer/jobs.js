
/* =========================================================
   TALVORA EMPLOYER PORTAL
   MODULE 4: GLOBAL JOBS MANAGEMENT ENGINE
========================================================= */

(() => {
    "use strict";

    const shared = window.TALVORA_EMPLOYER;

    if (!shared) {
        console.error(
            "TALVORA shared employer.js must load before jobs.js."
        );
        return;
    }

    const state = {
        initialized: false,
        loading: false,
        jobs: [],
        locations: [],
        filtered: []
    };

    const $ = id => document.getElementById(id);

    const api = shared.api;

    const companyPath = suffix =>
        shared.companyPath(suffix);


    /* =====================================================
       1. UTILITIES
    ===================================================== */

    function dataOf(response) {
        return response?.data ?? response ?? {};
    }

    function listOf(response, key) {
        const data = dataOf(response);

        if (Array.isArray(data)) return data;

        return Array.isArray(data[key])
            ? data[key]
            : Array.isArray(data.items)
                ? data.items
                : [];
    }

    function value(item, ...keys) {
        for (const key of keys) {
            if (item[key] !== undefined && item[key] !== null) {
                return item[key];
            }
        }

        return null;
    }

    function formatNumber(input) {
        const number = Number(input);

        return Number.isFinite(number)
            ? number.toLocaleString()
            : "—";
    }

    function formatDate(input) {
        if (!input) return "—";

        const date = new Date(input);

        return Number.isNaN(date.getTime())
            ? "—"
            : date.toLocaleDateString();
    }

    function label(input) {
        if (!input) return "Unknown";

        return String(input)
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    function status(item) {
        return String(item.status || "draft").toLowerCase();
    }

    function locationName(item) {
        if (item.location && typeof item.location === "object") {
            return item.location.name ||
                item.location.displayName ||
                "Unknown location";
        }

        const location = state.locations.find(
            record =>
                String(record.id) === String(item.locationId)
        );

        return location?.name ||
            item.locationName ||
            "Not assigned";
    }

    function jobApplications(item) {
        return Number(
            item.applicationCount ??
            item.applicationsCount ??
            item.metrics?.applications ??
            0
        ) || 0;
    }

    function toast(message, type = "info") {
        const region = $("toastRegion");

        if (!region) {
            console.log("[TALVORA JOBS]", message);
            return;
        }

        const element = document.createElement("div");

        element.className = `toast ${type}`;
        element.textContent = message;
        element.setAttribute("role", "status");

        region.appendChild(element);

        setTimeout(() => element.remove(), 4500);
    }

    function badge(statusValue) {
        const classes = {
            published: "verified",
            active: "verified",
            draft: "pending",
            pending: "pending",
            closed: "rejected",
            archived: "neutral",
            expired: "rejected"
        };

        const element = document.createElement("span");

        element.className =
            `status-badge ${classes[statusValue] || "neutral"}`;

        element.textContent = label(statusValue);

        return element;
    }

    function cell(primary, secondary = "") {
        const td = document.createElement("td");

        const main = document.createElement("div");
        main.className = "job-primary";
        main.textContent = primary ?? "—";

        td.appendChild(main);

        if (secondary) {
            const sub = document.createElement("small");

            sub.className = "job-secondary";
            sub.textContent = secondary;

            td.appendChild(sub);
        }

        return td;
    }

    function actionButton(text, action, id, danger = false) {
        const button = document.createElement("button");

        button.type = "button";
        button.className =
            `job-action ${danger ? "danger" : ""}`;

        button.textContent = text;
        button.dataset.jobAction = action;
        button.dataset.id = id;

        return button;
    }

    function setConnection(message, statusValue = "") {
        const text = $("jobsConnectionStatus");
        const dot = document.querySelector(
            ".jobs-page .connection-dot"
        );

        if (text) text.textContent = message;

        if (dot) {
            dot.className =
                `connection-dot ${statusValue}`;
        }
    }


    /* =====================================================
       2. LOAD JOBS AND LOCATIONS
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

        setConnection("Loading recruitment data...");

        try {
            const [jobsResult, locationsResult] =
                await Promise.all([
                    api(
                        companyPath(
                            "/jobs?include=location,metrics"
                        )
                    ),
                    api(companyPath("/locations"))
                        .catch(() => [])
                ]);

            state.jobs = listOf(jobsResult, "jobs");

            state.locations = listOf(
                locationsResult,
                "locations"
            );

            populateLocationFilters();

            state.filtered = [...state.jobs];

            renderAll();

            setConnection("Connected to TALVORA", "connected");

            const updated = $("jobsLastUpdated");

            if (updated) {
                updated.textContent =
                    `Updated ${new Date().toLocaleTimeString()}`;
            }

        } catch (error) {
            console.error("[TALVORA JOBS]", error);

            setConnection("Unable to load job listings", "error");

            toast(error.message, "error");

            renderEmpty();

        } finally {
            state.loading = false;
        }
    }


    function renderEmpty() {
        const body = $("jobsTableBody");

        if (!body) return;

        body.replaceChildren();

        const row = document.createElement("tr");
        const td = document.createElement("td");

        td.colSpan = 8;
        td.textContent =
            "Unable to load job listings. Please refresh and try again.";

        row.appendChild(td);
        body.appendChild(row);
    }


    /* =====================================================
       3. KPI STATISTICS
    ===================================================== */

    function renderKPIs() {
        const jobs = state.jobs;

        const published = jobs.filter(
            item => status(item) === "published"
        );

        const drafts = jobs.filter(
            item => status(item) === "draft"
        );

        const closed = jobs.filter(
            item => ["closed", "expired", "archived"]
                .includes(status(item))
        );

        const applications = jobs.reduce(
            (total, item) =>
                total + jobApplications(item),
            0
        );

        const vacancies = jobs.reduce(
            (total, item) =>
                total + (Number(item.vacancies) || 0),
            0
        );

        const set = (id, number) => {
            if ($(id)) {
                $(id).textContent = formatNumber(number);
            }
        };

        set("jobsTotal", jobs.length);
        set("jobsPublished", published.length);
        set("jobsDrafts", drafts.length);
        set("jobsClosed", closed.length);
        set("jobsApplications", applications);

        set("activityPublished", published.length);
        set("activityVacancies", vacancies);
        set("activityApplications", applications);
    }


    /* =====================================================
       4. PUBLICATION OVERVIEW
    ===================================================== */

    function renderStatusOverview() {
        const container = $("jobsStatusOverview");

        if (!container) return;

        container.replaceChildren();

        const total = state.jobs.length;

        const statuses = [
            ["Published", "published"],
            ["Draft", "draft"],
            ["Closed", "closed"],
            ["Archived", "archived"]
        ];

        if (!total) {
            const empty = document.createElement("p");

            empty.textContent =
                "No job listings are available.";

            container.appendChild(empty);
            return;
        }

        statuses.forEach(([name, key]) => {
            const count = state.jobs.filter(
                item => status(item) === key
            ).length;

            const percent = count / total * 100;

            const wrapper = document.createElement("div");

            wrapper.className = "job-status-item";

            const heading = document.createElement("div");

            heading.className = "job-status-heading";

            const title = document.createElement("span");
            title.textContent = name;

            const number = document.createElement("strong");
            number.textContent =
                `${count} (${Math.round(percent)}%)`;

            heading.append(title, number);

            const track = document.createElement("div");
            track.className = "job-progress";

            const fill = document.createElement("div");
            fill.className = "job-progress-fill";
            fill.style.width = `${percent}%`;

            track.appendChild(fill);

            wrapper.append(heading, track);

            container.appendChild(wrapper);
        });
    }


    /* =====================================================
       5. LOCATION SELECTS
    ===================================================== */

    function populateLocationSelects() {
        const selects = [
            $("jobLocation"),
            $("jobLocationFilter")
        ];

        selects.forEach(select => {
            if (!select) return;

            const previous = select.value;

            select.replaceChildren();

            const first = document.createElement("option");

            first.value = "";
            first.textContent =
                select.id === "jobLocationFilter"
                    ? "All locations"
                    : "Select location";

            select.appendChild(first);

            state.locations.forEach(location => {
                const option = document.createElement("option");

                option.value = location.id;
                option.textContent =
                    `${location.name || location.displayName} — ${location.country || ""}`;

                select.appendChild(option);
            });

            if (
                state.locations.some(item =>
                    String(item.id) === String(previous)
                )
            ) {
                select.value = previous;
            }
        });
    }

    function populateLocationFilters() {
        populateLocationSelects();
    }


    /* =====================================================
       6. SEARCH AND FILTERS
    ===================================================== */

    function filterJobs() {
        const query =
            ($("jobSearch")?.value || "")
                .trim()
                .toLowerCase();

        const selectedStatus =
            $("jobStatusFilter")?.value || "";

        const selectedType =
            $("jobTypeFilter")?.value || "";

        const selectedLocation =
            $("jobLocationFilter")?.value || "";

        state.filtered = state.jobs.filter(job => {
            const searchable = [
                job.title,
                job.reference,
                job.department,
                job.category,
                job.description,
                job.locationName
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return (
                (!query || searchable.includes(query)) &&
                (!selectedStatus || status(job) === selectedStatus) &&
                (!selectedType ||
                    job.employmentType === selectedType) &&
                (!selectedLocation ||
                    String(job.locationId) === selectedLocation)
            );
        });

        renderTable();
    }


    /* =====================================================
       7. JOB TABLE
    ===================================================== */

    function renderTable() {
        const body = $("jobsTableBody");

        if (!body) return;

        body.replaceChildren();

        const jobs = state.filtered;

        const countLabel = $("jobCountLabel");

        if (countLabel) {
            countLabel.textContent =
                `${state.jobs.length} job listings`;
        }

        if ($("jobsTableFooter")) {
            $("jobsTableFooter").textContent =
                `Showing ${jobs.length} of ${state.jobs.length} jobs`;
        }

        if ($("jobsFilteredCount")) {
            $("jobsFilteredCount").textContent =
                `${jobs.length} records`;
        }

        if (!jobs.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 8;
            cell.textContent =
                "No jobs match your filters.";

            row.appendChild(cell);
            body.appendChild(row);

            return;
        }

        jobs.forEach(job => {
            const row = document.createElement("tr");

            const id = String(job.id || "");

            row.append(
                cell(
                    job.title || "Untitled Job",
                    job.reference
                        ? `Reference: ${job.reference}`
                        : "No reference"
                ),

                cell(
                    locationName(job),
                    job.department || ""
                ),

                cell(
                    label(job.employmentType),
                    label(job.workMode)
                ),

                cell(formatNumber(job.vacancies)),

                cell(formatNumber(jobApplications(job))),

                cell(formatDate(job.applicationDeadline))
            );

            const statusCell =
                document.createElement("td");

            statusCell.appendChild(
                badge(status(job))
            );

            row.appendChild(statusCell);

            const actionCell =
                document.createElement("td");

            const actions =
                document.createElement("div");

            actions.className = "job-action-group";

            actions.appendChild(
                actionButton("Edit", "edit", id)
            );

            if (status(job) === "draft") {
                actions.appendChild(
                    actionButton("Publish", "publish", id)
                );
            }

            if (status(job) === "published") {
                actions.appendChild(
                    actionButton("Close", "close", id, true)
                );
            }

            if (status(job) === "closed") {
                actions.appendChild(
                    actionButton("Reopen", "reopen", id)
                );
            }

            actionCell.appendChild(actions);

            row.appendChild(actionCell);

            body.appendChild(row);
        });
    }


    /* =====================================================
       8. RECENTLY UPDATED JOBS
    ===================================================== */

    function renderRecentJobs() {
        const body = $("recentJobsBody");

        if (!body) return;

        body.replaceChildren();

        const jobs = [...state.jobs]
            .sort((a, b) =>
                new Date(
                    b.updatedAt || b.createdAt || 0
                ) -
                new Date(
                    a.updatedAt || a.createdAt || 0
                )
            )
            .slice(0, 5);

        if (!jobs.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 4;
            cell.textContent = "No recent job activity.";

            row.appendChild(cell);
            body.appendChild(row);
            return;
        }

        jobs.forEach(job => {
            const row = document.createElement("tr");

            row.append(
                cell(job.title),
                cell(job.reference),
                cell(formatDate(job.updatedAt || job.createdAt))
            );

            const statusCell =
                document.createElement("td");

            statusCell.appendChild(
                badge(status(job))
            );

            row.appendChild(statusCell);

            body.appendChild(row);
        });
    }


    /* =====================================================
       9. RENDER ALL
    ===================================================== */

    function renderAll() {
        renderKPIs();
        renderStatusOverview();
        renderTable();
        renderRecentJobs();
    }


    /* =====================================================
       10. JOB DIALOG
    ===================================================== */

    function openDialog() {
        const dialog = $("jobDialog");

        if (dialog && !dialog.open) {
            dialog.showModal();
        }
    }

    function closeDialog() {
        const dialog = $("jobDialog");

        if (dialog?.open) {
            dialog.close();
        }
    }

    function resetJobForm() {
        const form = $("jobForm");

        if (!form) return;

        form.reset();

        $("jobId").value = "";

        $("jobDialogTitle").textContent =
            "Create New Job";

        $("saveJobButton").textContent =
            "Save Job";

        const deadline = $("jobDeadline");

        if (deadline) {
            deadline.min =
                new Date().toISOString().split("T")[0];
        }

        populateLocationSelects();
    }


    function openNewJob() {
        resetJobForm();
        openDialog();
    }


    function openEditJob(id) {
        const job = state.jobs.find(
            item => String(item.id) === String(id)
        );

        if (!job) {
            toast("Job record not found.", "error");
            return;
        }

        resetJobForm();

        const form = $("jobForm");

        const fields = [
            "title",
            "reference",
            "employmentType",
            "department",
            "workMode",
            "locationId",
            "category",
            "vacancies",
            "salaryCurrency",
            "salaryMin",
            "salaryMax",
            "applicationDeadline",
            "status",
            "description",
            "requirements"
        ];

        fields.forEach(name => {
            const input = form.elements.namedItem(name);

            if (!input) return;

            let value = job[name];

            if (
                name === "salaryCurrency" &&
                value === undefined
            ) {
                value = job.currency;
            }

            if (name === "applicationDeadline" && value) {
                value = String(value).slice(0, 10);
            }

            if (
                value === undefined &&
                name === "locationId"
            ) {
                value = job.location?.id;
            }

            if (value !== undefined && value !== null) {
                input.value = value;
            }
        });

        $("jobId").value = job.id;

        $("jobDialogTitle").textContent =
            "Edit Job Listing";

        $("saveJobButton").textContent =
            "Update Job";

        openDialog();
    }


    /* =====================================================
       11. SAVE JOB
    ===================================================== */

    async function saveJob(event) {
        event.preventDefault();

        const form = $("jobForm");
        const button = $("saveJobButton");

        if (!form || !form.reportValidity()) return;

        const payload = {};

        new FormData(form).forEach((value, key) => {
            if (key === "jobId") return;

            payload[key] = value;
        });

        payload.vacancies =
            Number(payload.vacancies);

        [
            "salaryMin",
            "salaryMax"
        ].forEach(field => {
            payload[field] =
                payload[field] === ""
                    ? null
                    : Number(payload[field]);
        });

        if (
            payload.salaryMin !== null &&
            payload.salaryMax !== null &&
            payload.salaryMax < payload.salaryMin
        ) {
            toast(
                "Maximum salary cannot be lower than minimum salary.",
                "error"
            );
            return;
        }

        if (payload.locationId === "") {
            payload.locationId = null;
        }

        const id = $("jobId").value;

        const editing = Boolean(id);

        const endpoint = editing
            ? companyPath(`/jobs/${encodeURIComponent(id)}`)
            : companyPath("/jobs");

        setConnection("Saving job listing...");

        button.disabled = true;

        button.textContent =
            editing ? "Updating..." : "Saving...";

        try {
            await api(endpoint, {
                method: editing ? "PATCH" : "POST",
                body: payload
            });

            toast(
                editing
                    ? "Job updated successfully."
                    : "Job created successfully.",
                "success"
            );

            closeDialog();

            await load();

        } catch (error) {
            toast(error.message, "error");

        } finally {
            button.disabled = false;

            button.textContent =
                editing ? "Update Job" : "Save Job";
        }
    }


    /* =====================================================
       12. PUBLISH / CLOSE / REOPEN JOB
    ===================================================== */

    async function changeStatus(id, newStatus) {
        const job = state.jobs.find(
            item => String(item.id) === String(id)
        );

        if (!job) return;

        const messages = {
            published: `Publish "${job.title}"?`,
            closed: `Close "${job.title}"?`,
            draft: `Move "${job.title}" back to draft?`
        };

        if (!window.confirm(messages[newStatus])) {
            return;
        }

        try {
            await api(
                companyPath(
                    `/jobs/${encodeURIComponent(id)}/status`
                ),
                {
                    method: "POST",
                    body: {
                        status: newStatus
                    }
                }
            );

            toast(
                `Job ${newStatus} successfully.`,
                "success"
            );

            await load();

        } catch (error) {
            toast(error.message, "error");
        }
    }


    /* =====================================================
       13. CSV EXPORT
    ===================================================== */

    function csvValue(value) {
        return `"${String(value ?? "").replace(/"/g, '""')}"`;
    }

    function exportJobs() {
        if (!state.filtered.length) {
            toast("No job listings to export.", "warning");
            return;
        }

        const headers = [
            "Job ID",
            "Title",
            "Reference",
            "Department",
            "Employment Type",
            "Work Arrangement",
            "Location",
            "Vacancies",
            "Applications",
            "Salary Currency",
            "Minimum Salary",
            "Maximum Salary",
            "Deadline",
            "Status"
        ];

        const rows = state.filtered.map(job => [
            job.id,
            job.title,
            job.reference,
            job.department,
            job.employmentType,
            job.workMode,
            locationName(job),
            job.vacancies,
            jobApplications(job),
            job.salaryCurrency || job.currency,
            job.salaryMin,
            job.salaryMax,
            job.applicationDeadline,
            status(job)
        ]);

        const csv = [
            headers,
            ...rows
        ].map(row =>
            row.map(csvValue).join(",")
        ).join("\r\n");

        const blob = new Blob(
            ["\uFEFF" + csv],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;
        link.download = "talvora-jobs-report.csv";

        document.body.appendChild(link);

        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        toast("Jobs report exported.", "success");
    }


    /* =====================================================
       14. CLEAR FILTERS
    ===================================================== */

    function clearFilters() {
        [
            "jobSearch",
            "jobStatusFilter",
            "jobTypeFilter",
            "jobLocationFilter"
        ].forEach(id => {
            if ($(id)) $(id).value = "";
        });

        filterJobs();
    }


    /* =====================================================
       15. EVENT BINDING
    ===================================================== */

    function bind() {
        if (state.initialized) return;

        state.initialized = true;

        $("addJobButton")?.addEventListener(
            "click",
            openNewJob
        );

        $("refreshJobsButton")?.addEventListener(
            "click",
            load
        );

        $("jobForm")?.addEventListener(
            "submit",
            saveJob
        );

        $("exportJobsButton")?.addEventListener(
            "click",
            exportJobs
        );

        $("clearJobFilters")?.addEventListener(
            "click",
            clearFilters
        );

        $("jobSearch")?.addEventListener(
            "input",
            filterJobs
        );

        [
            "jobStatusFilter",
            "jobTypeFilter",
            "jobLocationFilter"
        ].forEach(id => {
            $(id)?.addEventListener(
                "change",
                filterJobs
            );
        });

        document.querySelectorAll(
            '[data-close-dialog="jobDialog"]'
        ).forEach(button => {
            button.addEventListener(
                "click",
                closeDialog
            );
        });

        $("jobsTableBody")?.addEventListener(
            "click",
            event => {
                const button = event.target.closest(
                    "[data-job-action]"
                );

                if (!button) return;

                const id = button.dataset.id;
                const action = button.dataset.jobAction;

                if (action === "edit") {
                    openEditJob(id);
                }

                if (action === "publish") {
                    changeStatus(id, "published");
                }

                if (action === "close") {
                    changeStatus(id, "closed");
                }

                if (action === "reopen") {
                    changeStatus(id, "published");
                }
            }
        );

        $("jobDialog")?.addEventListener(
            "click",
            event => {
                if (event.target === $("jobDialog")) {
                    closeDialog();
                }
            }
        );
    }


    /* =====================================================
       16. REGISTER WITH SHARED TALVORA ENGINE
    ===================================================== */

    const module = {
        load,
        bind,
        refresh: load,

        getJobs: () => [...state.jobs],

        getLocations: () => [...state.locations]
    };

    shared.registerModule("jobs", module);

    window.TALVORA_JOBS = module;

})();
