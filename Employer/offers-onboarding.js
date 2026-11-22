
/* =========================================================
   TALVORA EMPLOYER PORTAL
   MODULE 8: OFFERS, CONTRACTS & ONBOARDING ENGINE

   FEATURES:
   1. Employment offer creation
   2. Employment compensation management
   3. Employment terms and benefits
   4. Offer issuance
   5. Offer response tracking
   6. Contract reference management
   7. Secure contract document links
   8. Candidate acceptance tracking
   9. Onboarding initiation
   10. Employee onboarding checklist
   11. Task creation and completion
   12. Onboarding progress tracking
   13. Workforce transition

   INTEGRATIONS:
   - Shared employer.js
   - Applications & Recruitment
   - Jobs Management
   - Interviews & Communication
   - Workforce Management
========================================================= */

(() => {
    "use strict";

    const shared = window.TALVORA_EMPLOYER;

    if (!shared) {
        console.error("TALVORA employer.js must load before offers-onboarding.js.");
        return;
    }

    const state = {
        initialized: false,
        loading: false,
        offers: [],
        onboarding: [],
        applications: [],
        jobs: [],
        filteredOffers: [],
        filteredOnboarding: [],
        selectedOnboarding: null
    };

    const $ = id => document.getElementById(id);
    const api = shared.api;
    const companyPath = suffix => shared.companyPath(suffix);


    /* =====================================================
       1. GENERAL UTILITIES
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
        const number = Number(value);
        return Number.isFinite(number)
            ? number.toLocaleString()
            : "0";
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

    function toast(message, type = "info") {
        const region = $("toastRegion");

        if (!region) {
            console.log("[TALVORA OFFERS]", message);
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
        if ($("offersConnectionStatus")) {
            $("offersConnectionStatus").textContent = message;
        }

        const dot = document.querySelector(
            ".offers-page .connection-dot"
        );

        if (dot) dot.className = `connection-dot ${status}`;
    }


    /* =====================================================
       2. CANDIDATE AND JOB HELPERS
    ===================================================== */

    function applicationOfOffer(offer) {
        return offer.application ||
            state.applications.find(application =>
                String(application.id) ===
                String(offer.applicationId)
            ) ||
            {};
    }

    function candidateOfApplication(application) {
        return application.candidate ||
            application.applicant ||
            {};
    }

    function candidateName(application) {
        const candidate =
            candidateOfApplication(application);

        return candidate.fullName ||
            candidate.name ||
            application.applicantName ||
            [
                candidate.firstName,
                candidate.lastName
            ].filter(Boolean).join(" ") ||
            "Unnamed Candidate";
    }

    function candidateEmail(application) {
        const candidate =
            candidateOfApplication(application);

        return candidate.email ||
            application.applicantEmail ||
            application.email ||
            "";
    }

    function jobOfApplication(application) {
        return application.job ||
            state.jobs.find(job =>
                String(job.id) ===
                String(application.jobId)
            ) ||
            {};
    }

    function jobTitle(application) {
        return jobOfApplication(application).title ||
            application.jobTitle ||
            "Unknown Position";
    }

    function offerStatus(offer) {
        return String(offer.status || "draft").toLowerCase();
    }

    function onboardingStatus(record) {
        return String(record.status || "not_started").toLowerCase();
    }

    function offerCandidate(offer) {
        return candidateName(applicationOfOffer(offer));
    }

    function offerJob(offer) {
        return jobTitle(applicationOfOffer(offer));
    }


    /* =====================================================
       3. LOAD OFFERS AND ONBOARDING DATA
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
        setConnection("Loading employment and onboarding data...");

        try {
            const results = await Promise.allSettled([
                api(companyPath("/offers")),
                api(companyPath("/onboarding")),
                api(companyPath("/applications")),
                api(companyPath("/jobs"))
            ]);

            if (results[0].status === "rejected") {
                throw results[0].reason;
            }

            state.offers = listOf(
                results[0].value,
                "offers"
            );

            state.onboarding = results[1].status === "fulfilled"
                ? listOf(results[1].value, "onboarding")
                : [];

            state.applications = results[2].status === "fulfilled"
                ? listOf(results[2].value, "applications")
                : [];

            state.jobs = results[3].status === "fulfilled"
                ? listOf(results[3].value, "jobs")
                : [];

            populateApplicationSelect();

            state.filteredOffers = [...state.offers];
            state.filteredOnboarding = [...state.onboarding];

            renderAll();

            setConnection("Connected to TALVORA", "connected");

            if (results[1].status === "rejected") {
                toast(
                    "Offers loaded, but onboarding records are unavailable.",
                    "warning"
                );
            }

            if ($("offersLastUpdated")) {
                $("offersLastUpdated").textContent =
                    `Updated ${new Date().toLocaleTimeString()}`;
            }

        } catch (error) {
            console.error("[TALVORA OFFERS]", error);

            setConnection("Unable to load employment records", "error");
            toast(error.message, "error");

            renderEmpty();

        } finally {
            state.loading = false;
        }
    }


    function renderEmpty() {
        const body = $("offersTableBody");
        if (!body) return;

        body.replaceChildren();

        const row = createElement("tr");
        const td = createElement(
            "td",
            "table-loading",
            "Unable to load employment offers. Please refresh and try again."
        );

        td.colSpan = 8;
        row.appendChild(td);
        body.appendChild(row);
    }


    /* =====================================================
       4. APPLICATION SELECT
    ===================================================== */

    function populateApplicationSelect() {
        const select = $("offerApplication");
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
                `${candidateName(application)} — ${jobTitle(application)}`
            );

            option.value = application.id;
            select.appendChild(option);
        });

        if (Array.from(select.options).some(option =>
            option.value === previous
        )) {
            select.value = previous;
        }
    }


    /* =====================================================
       5. KPI STATISTICS
    ===================================================== */

    function renderKPIs() {
        const countOffers = status =>
            state.offers.filter(
                offer => offerStatus(offer) === status
            ).length;

        const activeOnboarding = state.onboarding.filter(
            record =>
                !["completed", "on_hold"].includes(
                    onboardingStatus(record)
                )
        ).length;

        const unsuccessful =
            state.offers.filter(offer =>
                ["declined", "expired", "withdrawn"].includes(
                    offerStatus(offer)
                )
            ).length;

        const completed = state.onboarding.filter(
            record => onboardingStatus(record) === "completed"
        ).length;

        const values = {
            totalOffers: state.offers.length,
            pendingOffers: countOffers("sent"),
            acceptedOffers: countOffers("accepted"),
            activeOnboarding,
            completedOnboarding: completed,
            unsuccessfulOffers: unsuccessful
        };

        Object.entries(values).forEach(([id, value]) => {
            if ($(id)) {
                $(id).textContent = formatNumber(value);
            }
        });
    }


    /* =====================================================
       6. OFFER PIPELINE
    ===================================================== */

    function renderOfferPipeline() {
        const container = $("offerPipeline");
        if (!container) return;

        container.replaceChildren();

        const stages = [
            ["Draft", "draft"],
            ["Sent", "sent"],
            ["Accepted", "accepted"],
            ["Declined", "declined"],
            ["Expired", "expired"]
        ];

        stages.forEach(([name, key]) => {
            const count = state.offers.filter(
                offer => offerStatus(offer) === key
            ).length;

            const card = createElement("div", "pipeline-card");

            card.append(
                createElement("strong", "", formatNumber(count)),
                createElement("span", "", name)
            );

            container.appendChild(card);
        });
    }


    /* =====================================================
       7. STATUS BADGES
    ===================================================== */

    function badge(status) {
        const classes = {
            draft: "neutral",
            sent: "pending",
            accepted: "verified",
            completed: "verified",
            in_progress: "pending",
            not_started: "neutral",
            declined: "rejected",
            expired: "rejected",
            withdrawn: "rejected",
            on_hold: "pending"
        };

        return createElement(
            "span",
            `status-badge ${classes[status] || "neutral"}`,
            formatLabel(status)
        );
    }


    /* =====================================================
       8. CONTRACT LINK
    ===================================================== */

    function safeUrl(value) {
        if (!value || typeof value !== "string") return null;

        try {
            const url = new URL(value, window.location.origin);

            if (!["http:", "https:"].includes(url.protocol)) {
                return null;
            }

            return url.href;

        } catch {
            return null;
        }
    }

    function contractLink(offer) {
        const url = safeUrl(
            offer.contractUrl ||
            offer.contract?.url ||
            offer.contractDocumentUrl
        );

        if (!url) {
            return createElement(
                "span",
                "secondary-text",
                "Not available"
            );
        }

        const link = createElement(
            "a",
            "table-action",
            "View Contract ↗"
        );

        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        return link;
    }


    /* =====================================================
       9. OFFER COMPENSATION
    ===================================================== */

    function compensation(offer) {
        const amount = Number(offer.salary);

        if (!Number.isFinite(amount)) {
            return "Not specified";
        }

        const currency = String(
            offer.currency || ""
        ).toUpperCase();

        const frequency = formatLabel(
            offer.salaryFrequency || "monthly"
        );

        return `${currency} ${amount.toLocaleString()} / ${frequency}`;
    }


    /* =====================================================
       10. OFFER TABLE
    ===================================================== */

    function renderOffers() {
        const body = $("offersTableBody");
        if (!body) return;

        body.replaceChildren();

        const records = state.filteredOffers;

        if ($("offerCountLabel")) {
            $("offerCountLabel").textContent =
                `${state.offers.length} offers`;
        }

        if ($("offersTableFooter")) {
            $("offersTableFooter").textContent =
                `Showing ${records.length} of ${state.offers.length} offers`;
        }

        if ($("offersFilteredCount")) {
            $("offersFilteredCount").textContent =
                `${records.length} records`;
        }

        if (!records.length) {
            const row = createElement("tr");
            const td = createElement(
                "td",
                "table-loading",
                "No employment offers match your filters."
            );

            td.colSpan = 8;
            row.appendChild(td);
            body.appendChild(row);
            return;
        }

        records.forEach(offer => {
            const row = createElement("tr");
            const id = String(offer.id || "");
            const status = offerStatus(offer);

            const candidateCell = createElement("td");

            candidateCell.append(
                createElement(
                    "div",
                    "primary-text",
                    offerCandidate(offer)
                ),
                createElement(
                    "small",
                    "secondary-text",
                    candidateEmail(applicationOfOffer(offer))
                )
            );

            row.appendChild(candidateCell);

            row.appendChild(
                createElement(
                    "td",
                    "primary-text",
                    offerJob(offer)
                )
            );

            row.appendChild(
                createElement(
                    "td",
                    "",
                    compensation(offer)
                )
            );

            row.appendChild(
                createElement(
                    "td",
                    "",
                    formatDate(offer.startDate)
                )
            );

            row.appendChild(
                createElement(
                    "td",
                    "",
                    formatDate(offer.expiryDate)
                )
            );

            const statusCell = createElement("td");
            statusCell.appendChild(badge(status));
            row.appendChild(statusCell);

            const contractCell = createElement("td");
            contractCell.appendChild(contractLink(offer));
            row.appendChild(contractCell);

            const actionCell = createElement("td");
            const actions = createElement("div", "table-actions");

            if (status === "draft") {
                actions.append(
                    actionButton("Edit", "edit", id),
                    actionButton("Send", "send", id)
                );
            }

            if (status === "sent") {
                actions.append(
                    actionButton("Withdraw", "withdraw", id, true)
                );
            }

            if (status === "accepted") {
                const existing = state.onboarding.find(
                    record =>
                        String(record.offerId) === id ||
                        String(record.applicationId) ===
                        String(offer.applicationId)
                );

                if (existing) {
                    actions.append(
                        actionButton(
                            "View Onboarding",
                            "onboarding",
                            String(existing.id)
                        )
                    );
                } else {
                    actions.append(
                        actionButton(
                            "Start Onboarding",
                            "start-onboarding",
                            id
                        )
                    );
                }
            }

            if (["declined", "expired", "withdrawn"].includes(status)) {
                actions.append(
                    createElement(
                        "span",
                        "secondary-text",
                        "Closed"
                    )
                );
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
       11. OFFER SEARCH AND FILTERS
    ===================================================== */

    function filterOffers() {
        const query = ($("offerSearch")?.value || "")
            .trim()
            .toLowerCase();

        const status = $("offerStatusFilter")?.value || "";
        const type = $("offerTypeFilter")?.value || "";

        state.filteredOffers = state.offers.filter(offer => {
            const searchable = [
                offerCandidate(offer),
                offerJob(offer),
                offer.reference,
                offer.contractReference
            ].filter(Boolean).join(" ").toLowerCase();

            return (
                (!query || searchable.includes(query)) &&
                (!status || offerStatus(offer) === status) &&
                (!type || offer.employmentType === type)
            );
        });

        renderOffers();
    }

    function clearOfferFilters() {
        [
            "offerSearch",
            "offerStatusFilter",
            "offerTypeFilter"
        ].forEach(id => {
            if ($(id)) $(id).value = "";
        });

        filterOffers();
    }


    /* =====================================================
       12. OPEN OFFER DIALOG
    ===================================================== */

    function openOfferDialog(id = null) {
        const form = $("offerForm");
        form.reset();

        $("offerId").value = "";

        $("offerDialogTitle").textContent =
            "Create Employment Offer";

        $("saveOfferButton").textContent =
            "Save Employment Offer";

        $("offerApplication").disabled = false;

        if (id) {
            const offer = state.offers.find(
                item => String(item.id) === String(id)
            );

            if (!offer) {
                toast("Offer record not found.", "error");
                return;
            }

            if (offerStatus(offer) !== "draft") {
                toast("Only draft offers can be edited.", "warning");
                return;
            }

            $("offerId").value = offer.id;

            $("offerDialogTitle").textContent =
                "Edit Employment Offer";

            $("saveOfferButton").textContent =
                "Update Employment Offer";

            const fields = [
                "applicationId",
                "employmentType",
                "workLocation",
                "currency",
                "salary",
                "salaryFrequency",
                "startDate",
                "expiryDate",
                "contractDuration",
                "benefits",
                "contractReference",
                "contractUrl",
                "terms",
                "status"
            ];

            fields.forEach(name => {
                const input = form.elements.namedItem(name);
                if (!input) return;

                let value = name === "applicationId"
                    ? offer.applicationId
                    : offer[name];

                if (
                    ["startDate", "expiryDate"].includes(name) &&
                    value
                ) {
                    value = String(value).slice(0, 10);
                }

                if (value !== undefined && value !== null) {
                    input.value = value;
                }
            });
        }

        $("offerDialog").showModal();
    }


    /* =====================================================
       13. SAVE OFFER
    ===================================================== */

    async function saveOffer(event) {
        event.preventDefault();

        const form = $("offerForm");

        if (!form.reportValidity()) return;

        const id = $("offerId").value;
        const editing = Boolean(id);

        const payload = {};

        new FormData(form).forEach((value, key) => {
            if (key !== "offerId") {
                payload[key] = value;
            }
        });

        payload.salary = Number(payload.salary);
        payload.currency = payload.currency.trim().toUpperCase();

        if (
            !Number.isFinite(payload.salary) ||
            payload.salary < 0
        ) {
            toast("Enter a valid salary amount.", "warning");
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const expiry = new Date(payload.expiryDate + "T00:00:00");
        const start = new Date(payload.startDate + "T00:00:00");

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(expiry.getTime()) ||
            start < today ||
            expiry < today
        ) {
            toast("Start date and response deadline must be valid future dates.", "warning");
            return;
        }

        if (expiry >= start) {
            toast("The offer response deadline must be before the employment start date.", "warning");
            return;
        }

        if (!payload.applicationId) {
            toast("Select a candidate application.", "warning");
            return;
        }

        const button = $("saveOfferButton");

        button.disabled = true;
        button.textContent = editing ? "Updating..." : "Saving...";

        try {
            await api(
                editing
                    ? companyPath(`/offers/${encodeURIComponent(id)}`)
                    : companyPath("/offers"),
                {
                    method: editing ? "PATCH" : "POST",
                    body: payload
                }
            );

            $("offerDialog").close();

            toast(
                editing
                    ? "Employment offer updated."
                    : payload.status === "sent"
                        ? "Employment offer submitted for issuance."
                        : "Employment offer saved as draft.",
                "success"
            );

            await load();

        } catch (error) {
            toast(error.message, "error");

        } finally {
            button.disabled = false;
            button.textContent = editing
                ? "Update Employment Offer"
                : "Save Employment Offer";
        }
    }


    /* =====================================================
       14. CHANGE OFFER STATUS
    ===================================================== */

    async function changeOfferStatus(id, newStatus) {
        const offer = state.offers.find(
            item => String(item.id) === String(id)
        );

        if (!offer) return;

        const allowedTransitions = {
            draft: ["sent"],
            sent: ["withdrawn"]
        };

        if (!allowedTransitions[offerStatus(offer)]?.includes(newStatus)) {
            toast("This offer status transition is not permitted.", "warning");
            return;
        }

        const message = newStatus === "sent"
            ? `Issue the employment offer to ${offerCandidate(offer)}?`
            : `Withdraw the offer issued to ${offerCandidate(offer)}?`;

        if (!window.confirm(message)) return;

        try {
            await api(
                companyPath(`/offers/${encodeURIComponent(id)}`),
                {
                    method: "PATCH",
                    body: { status: newStatus }
                }
            );

            toast(
                newStatus === "sent"
                    ? "Offer submitted for issuance."
                    : "Offer withdrawal submitted.",
                "success"
            );

            await load();

        } catch (error) {
            toast(error.message, "error");
        }
    }


    /* =====================================================
       15. ONBOARDING HELPERS
    ===================================================== */

    function onboardingApplication(record) {
        return record.application ||
            state.applications.find(application =>
                String(application.id) ===
                String(record.applicationId)
            ) ||
            {};
    }

    function onboardingCandidate(record) {
        return record.employee?.fullName ||
            record.candidate?.fullName ||
            record.employee?.name ||
            candidateName(onboardingApplication(record));
    }

    function onboardingJob(record) {
        return record.job?.title ||
            jobTitle(onboardingApplication(record)) ||
            record.position ||
            "Position unavailable";
    }

    function onboardingTasks(record) {
        return Array.isArray(record.tasks)
            ? record.tasks
            : Array.isArray(record.checklist)
                ? record.checklist
                : [];
    }

    function taskCompleted(task) {
        return (
            task.status === "completed" ||
            task.completed === true
        );
    }

    function onboardingProgress(record) {
        const tasks = onboardingTasks(record);

        if (record.progress !== undefined &&
            record.progress !== null) {
            const explicit = Number(record.progress);

            if (Number.isFinite(explicit)) {
                return Math.max(0, Math.min(100, explicit));
            }
        }

        if (!tasks.length) return 0;

        const completed = tasks.filter(taskCompleted).length;

        return Math.round(completed / tasks.length * 100);
    }


    /* =====================================================
       16. START ONBOARDING
    ===================================================== */

    async function startOnboarding(offerId) {
        const offer = state.offers.find(
            item => String(item.id) === String(offerId)
        );

        if (!offer || offerStatus(offer) !== "accepted") {
            toast("Only accepted offers can start onboarding.", "warning");
            return;
        }

        const existing = state.onboarding.find(
            record =>
                String(record.offerId) === String(offerId) ||
                String(record.applicationId) ===
                String(offer.applicationId)
        );

        if (existing) {
            openOnboarding(existing.id);
            return;
        }

        if (!window.confirm(
            `Create an onboarding record for ${offerCandidate(offer)}?`
        )) {
            return;
        }

        try {
            const response = await api(
                companyPath("/onboarding"),
                {
                    method: "POST",
                    body: {
                        offerId: offer.id,
                        applicationId: offer.applicationId
                    }
                }
            );

            toast("Onboarding initiation submitted.", "success");

            await load();

            const created = dataOf(response);

            if (created.id) {
                openOnboarding(created.id);
            }

        } catch (error) {
            toast(error.message, "error");
        }
    }


    /* =====================================================
       17. ONBOARDING TABLE
    ===================================================== */

    function renderOnboarding() {
        const body = $("onboardingTableBody");
        if (!body) return;

        body.replaceChildren();

        const records = state.filteredOnboarding;

        if ($("onboardingCountLabel")) {
            $("onboardingCountLabel").textContent =
                `${state.onboarding.length} onboarding records`;
        }

        if ($("onboardingTableFooter")) {
            $("onboardingTableFooter").textContent =
                `Showing ${records.length} of ${state.onboarding.length} records`;
        }

        if ($("onboardingFilteredCount")) {
            $("onboardingFilteredCount").textContent =
                `${records.length} records`;
        }

        if (!records.length) {
            const row = createElement("tr");
            const td = createElement(
                "td",
                "table-loading",
                "No onboarding records match your filters."
            );

            td.colSpan = 7;
            row.appendChild(td);
            body.appendChild(row);
            return;
        }

        records.forEach(record => {
            const row = createElement("tr");

            const tasks = onboardingTasks(record);
            const completed = tasks.filter(taskCompleted).length;
            const progress = onboardingProgress(record);

            const candidateCell = createElement("td");

            candidateCell.append(
                createElement(
                    "div",
                    "primary-text",
                    onboardingCandidate(record)
                ),
                createElement(
                    "small",
                    "secondary-text",
                    record.reference || `ID: ${record.id}`
                )
            );

            row.appendChild(candidateCell);

            row.appendChild(
                createElement(
                    "td",
                    "primary-text",
                    onboardingJob(record)
                )
            );

            row.appendChild(
                createElement(
                    "td",
                    "",
                    formatDate(record.startDate)
                )
            );

            row.appendChild(
                createElement(
                    "td",
                    "",
                    `${completed} / ${tasks.length}`
                )
            );

            const progressCell = createElement("td", "progress-cell");

            const heading = createElement("div", "progress-heading");

            heading.append(
                createElement("span", "", "Completion"),
                createElement("strong", "", `${progress}%`)
            );

            const track = createElement("div", "progress-track");
            const fill = createElement("div", "progress-fill");

            fill.style.width = `${progress}%`;

            track.appendChild(fill);
            progressCell.append(heading, track);

            row.appendChild(progressCell);

            const statusCell = createElement("td");

            statusCell.appendChild(
                badge(onboardingStatus(record))
            );

            row.appendChild(statusCell);

            const actionCell = createElement("td");
            const button = actionButton(
                "Manage",
                "manage-onboarding",
                record.id
            );

            actionCell.appendChild(button);
            row.appendChild(actionCell);

            body.appendChild(row);
        });
    }


    /* =====================================================
       18. ONBOARDING SEARCH AND FILTERS
    ===================================================== */

    function filterOnboarding() {
        const query = ($("onboardingSearch")?.value || "")
            .trim()
            .toLowerCase();

        const status = $("onboardingStatusFilter")?.value || "";

        state.filteredOnboarding = state.onboarding.filter(record => {
            const searchable = [
                onboardingCandidate(record),
                onboardingJob(record),
                record.reference
            ].filter(Boolean).join(" ").toLowerCase();

            return (
                (!query || searchable.includes(query)) &&
                (!status || onboardingStatus(record) === status)
            );
        });

        renderOnboarding();
    }

    function clearOnboardingFilters() {
        $("onboardingSearch").value = "";
        $("onboardingStatusFilter").value = "";

        filterOnboarding();
    }


    /* =====================================================
       19. ONBOARDING DETAILS DIALOG
    ===================================================== */

    function openOnboarding(id) {
        const record = state.onboarding.find(
            item => String(item.id) === String(id)
        );

        if (!record) {
            toast("Onboarding record not found.", "error");
            return;
        }

        state.selectedOnboarding = record;

        const name = onboardingCandidate(record);
        const progress = onboardingProgress(record);

        $("onboardingDialogTitle").textContent =
            "Employee Onboarding";

        $("onboardingEmployeeName").textContent = name;
        $("onboardingEmployeePosition").textContent =
            onboardingJob(record);

        $("onboardingStartDate").textContent =
            `Start date: ${formatDate(record.startDate)}`;

        $("onboardingAvatar").textContent =
            name.charAt(0).toUpperCase();

        $("onboardingProgressText").textContent =
            `${progress}%`;

        $("onboardingProgressFill").style.width =
            `${progress}%`;

        renderTasks(record);

        $("onboardingDialog").showModal();
    }


    /* =====================================================
       20. RENDER ONBOARDING TASKS
    ===================================================== */

    function renderTasks(record) {
        const container = $("onboardingTasks");
        if (!container) return;

        container.replaceChildren();

        const tasks = onboardingTasks(record);

        if (!tasks.length) {
            container.appendChild(
                createElement(
                    "p",
                    "secondary-text",
                    "No onboarding tasks have been assigned."
                )
            );

            return;
        }

        tasks.forEach(task => {
            const item = createElement("div", "onboarding-task");

            const details = createElement("div");

            details.append(
                createElement(
                    "strong",
                    "",
                    task.title || task.name || "Onboarding Task"
                ),
                createElement(
                    "small",
                    "",
                    task.dueDate
                        ? `Due: ${formatDate(task.dueDate)}`
                        : formatLabel(task.status || "pending")
                )
            );

            const button = createElement(
                "button",
                `task-status-button ${taskCompleted(task) ? "completed" : ""}`,
                taskCompleted(task) ? "Completed ✓" : "Mark Complete"
            );

            button.type = "button";
            button.disabled = taskCompleted(task);
            button.dataset.taskId = task.id;

            item.append(details, button);
            container.appendChild(item);
        });
    }


    /* =====================================================
       21. UPDATE ONBOARDING TASK
    ===================================================== */

    async function completeTask(taskId) {
        const record = state.selectedOnboarding;

        if (!record) return;

        const task = onboardingTasks(record).find(
            item => String(item.id) === String(taskId)
        );

        if (!task || taskCompleted(task)) return;

        if (!window.confirm(
            `Mark "${task.title || task.name}" as completed?`
        )) {
            return;
        }

        try {
            await api(
                companyPath(
                    `/onboarding/${encodeURIComponent(record.id)}/tasks/${encodeURIComponent(taskId)}`
                ),
                {
                    method: "PATCH",
                    body: { status: "completed" }
                }
            );

            toast("Onboarding task completed.", "success");

            await load();

            const updated = state.onboarding.find(
                item => String(item.id) === String(record.id)
            );

            if (updated) {
                openOnboarding(updated.id);
            }

        } catch (error) {
            toast(error.message, "error");
        }
    }


    /* =====================================================
       22. ADD ONBOARDING TASK
    ===================================================== */

    async function addTask(event) {
        event.preventDefault();

        const record = state.selectedOnboarding;

        if (!record) {
            toast("Select an onboarding record first.", "warning");
            return;
        }

        const title = $("newOnboardingTask").value.trim();

        if (!title) return;

        const button = $("addTaskButton");

        button.disabled = true;
        button.textContent = "Adding...";

        try {
            await api(
                companyPath(
                    `/onboarding/${encodeURIComponent(record.id)}/tasks`
                ),
                {
                    method: "POST",
                    body: { title }
                }
            );

            $("newOnboardingTask").value = "";

            toast("Onboarding task added.", "success");

            await load();

            const updated = state.onboarding.find(
                item => String(item.id) === String(record.id)
            );

            if (updated) {
                openOnboarding(updated.id);
            }

        } catch (error) {
            toast(error.message, "error");

        } finally {
            button.disabled = false;
            button.textContent = "+ Add Task";
        }
    }


    /* =====================================================
       23. ONBOARDING OVERVIEW
    ===================================================== */

    function renderOnboardingOverview() {
        const container = $("onboardingOverview");
        if (!container) return;

        container.replaceChildren();

        const totalTasks = state.onboarding.reduce(
            (total, record) =>
                total + onboardingTasks(record).length,
            0
        );

        const completedTasks = state.onboarding.reduce(
            (total, record) =>
                total + onboardingTasks(record).filter(taskCompleted).length,
            0
        );

        const averageProgress = state.onboarding.length
            ? Math.round(
                state.onboarding.reduce(
                    (total, record) =>
                        total + onboardingProgress(record),
                    0
                ) / state.onboarding.length
            )
            : 0;

        const items = [
            ["Total Onboarding Records", state.onboarding.length],
            ["Completed Tasks", `${completedTasks} / ${totalTasks}`],
            ["Average Completion", `${averageProgress}%`]
        ];

        items.forEach(([name, value]) => {
            const item = createElement("div", "overview-item");

            item.append(
                createElement("strong", "", value),
                createElement("span", "", name)
            );

            container.appendChild(item);
        });
    }


    /* =====================================================
       24. RENDER ALL
    ===================================================== */

    function renderAll() {
        renderKPIs();
        renderOfferPipeline();
        renderOffers();
        renderOnboarding();
        renderOnboardingOverview();
    }


    /* =====================================================
       25. TABLE ACTIONS
    ===================================================== */

    function bindTableActions() {
        $("offersTableBody")?.addEventListener(
            "click",
            event => {
                const button = event.target.closest("[data-action]");
                if (!button) return;

                const id = button.dataset.id;
                const action = button.dataset.action;

                if (action === "edit") {
                    openOfferDialog(id);
                } else if (action === "send") {
                    changeOfferStatus(id, "sent");
                } else if (action === "withdraw") {
                    changeOfferStatus(id, "withdrawn");
                } else if (action === "start-onboarding") {
                    startOnboarding(id);
                } else if (action === "onboarding") {
                    openOnboarding(id);
                }
            }
        );

        $("onboardingTableBody")?.addEventListener(
            "click",
            event => {
                const button = event.target.closest("[data-action]");
                if (!button) return;

                if (button.dataset.action === "manage-onboarding") {
                    openOnboarding(button.dataset.id);
                }
            }
        );

        $("onboardingTasks")?.addEventListener(
            "click",
            event => {
                const button = event.target.closest("[data-task-id]");
                if (!button) return;

                completeTask(button.dataset.taskId);
            }
        );
    }


    /* =====================================================
       26. DIALOG EVENTS
    ===================================================== */

    function bindDialogs() {
        $("offerForm")?.addEventListener(
            "submit",
            saveOffer
        );

        $("addOnboardingTaskForm")?.addEventListener(
            "submit",
            addTask
        );

        document.querySelectorAll(
            '[data-close-dialog="offerDialog"]'
        ).forEach(button => {
            button.addEventListener("click", () => {
                $("offerDialog").close();
            });
        });

        document.querySelectorAll(
            '[data-close-dialog="onboardingDialog"]'
        ).forEach(button => {
            button.addEventListener("click", () => {
                $("onboardingDialog").close();
            });
        });

        ["offerDialog", "onboardingDialog"].forEach(id => {
            $(id)?.addEventListener("click", event => {
                if (event.target === $(id)) {
                    $(id).close();
                }
            });
        });
    }


    /* =====================================================
       27. MAIN EVENT BINDING
    ===================================================== */

    function bind() {
        if (state.initialized) return;

        state.initialized = true;

        $("refreshOffersButton")?.addEventListener(
            "click",
            load
        );

        $("createOfferButton")?.addEventListener(
            "click",
            () => openOfferDialog()
        );

        $("clearOfferFilters")?.addEventListener(
            "click",
            clearOfferFilters
        );

        $("offerSearch")?.addEventListener(
            "input",
            filterOffers
        );

        [
            "offerStatusFilter",
            "offerTypeFilter"
        ].forEach(id => {
            $(id)?.addEventListener("change", filterOffers);
        });

        $("clearOnboardingFilters")?.addEventListener(
            "click",
            clearOnboardingFilters
        );

        $("onboardingSearch")?.addEventListener(
            "input",
            filterOnboarding
        );

        $("onboardingStatusFilter")?.addEventListener(
            "change",
            filterOnboarding
        );

        bindTableActions();
        bindDialogs();
    }


    /* =====================================================
       28. PUBLIC MODULE INTERFACE
    ===================================================== */

    const module = {
        load,
        bind,
        refresh: load,

        getOffers: () => [...state.offers],

        getOnboarding: () => [...state.onboarding],

        getApplications: () => [...state.applications]
    };


    /* =====================================================
       29. REGISTER WITH TALVORA SHARED ENGINE
    ===================================================== */

    shared.registerModule("offers-onboarding", module);

    window.TALVORA_OFFERS_ONBOARDING = module;

})();
