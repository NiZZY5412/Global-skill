
/* =========================================================
   TALVORA EMPLOYER PORTAL
   MODULE 6: SKILLS PASSPORT & CANDIDATE MATCHING ENGINE

   INTEGRATIONS:
   - Shared employer.js
   - Jobs Management
   - Applications & Recruitment
   - Candidate Skills Passport
   - Candidate Verification
   - TALVORA Matching Service
========================================================= */

(() => {
    "use strict";

    const shared = window.TALVORA_EMPLOYER;

    if (!shared) {
        console.error("TALVORA employer.js must load before skills-matching.js.");
        return;
    }

    const state = {
        initialized: false,
        loading: false,
        passports: [],
        matches: [],
        jobs: [],
        filtered: [],
        selectedPassport: null
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

    function number(value) {
        const result = Number(value);
        return Number.isFinite(result) ? result : 0;
    }

    function formatNumber(value) {
        return number(value).toLocaleString();
    }

    function formatLabel(value) {
        if (!value) return "Unknown";

        return String(value)
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());
    }

    function toast(message, type = "info") {
        const region = $("toastRegion");

        if (!region) {
            console.log("[TALVORA SKILLS]", message);
            return;
        }

        const element = document.createElement("div");
        element.className = `toast ${type}`;
        element.textContent = message;
        element.setAttribute("role", "status");

        region.appendChild(element);

        setTimeout(() => element.remove(), 4500);
    }

    function setConnection(message, status = "") {
        const text = $("skillsConnectionStatus");
        const dot = document.querySelector(
            ".skills-matching-page .connection-dot"
        );

        if (text) text.textContent = message;

        if (dot) {
            dot.className = `connection-dot ${status}`;
        }
    }

    function createElement(tag, className = "", text) {
        const element = document.createElement(tag);

        if (className) element.className = className;
        if (text !== undefined) element.textContent = String(text);

        return element;
    }

    function recordValue(record, ...keys) {
        for (const key of keys) {
            const result = record?.[key];

            if (result !== undefined && result !== null) {
                return result;
            }
        }

        return null;
    }


    /* =====================================================
       2. CANDIDATE AND PASSPORT DATA
    ===================================================== */

    function candidateOf(passport) {
        return passport.candidate ||
            passport.applicant ||
            passport.profile ||
            {};
    }

    function candidateId(passport) {
        const candidate = candidateOf(passport);

        return recordValue(
            passport,
            "candidateId",
            "userId"
        ) || candidate.id;
    }

    function candidateName(passport) {
        const candidate = candidateOf(passport);

        return candidate.fullName ||
            candidate.name ||
            passport.candidateName ||
            [
                candidate.firstName,
                candidate.middleName,
                candidate.lastName
            ].filter(Boolean).join(" ") ||
            "Unnamed Candidate";
    }

    function candidateEmail(passport) {
        const candidate = candidateOf(passport);

        return candidate.email ||
            passport.email ||
            "Email unavailable";
    }

    function passportSkills(passport) {
        const skills = passport.skills ||
            passport.competencies ||
            passport.verifiedSkills ||
            [];

        return Array.isArray(skills) ? skills : [];
    }

    function skillName(skill) {
        if (typeof skill === "string") return skill;

        return skill.name ||
            skill.title ||
            skill.skillName ||
            "Unnamed Skill";
    }

    function passportQualifications(passport) {
        const records = passport.qualifications ||
            passport.certifications ||
            passport.education ||
            [];

        return Array.isArray(records) ? records : [];
    }

    function passportExperience(passport) {
        const records = passport.experience ||
            passport.workExperience ||
            passport.employmentHistory ||
            [];

        return Array.isArray(records) ? records : [];
    }

    function passportEvidence(passport) {
        const records = passport.evidence ||
            passport.documents ||
            passport.credentials ||
            [];

        return Array.isArray(records) ? records : [];
    }

    function verificationStatus(passport) {
        return String(
            passport.verificationStatus ||
            passport.verification?.status ||
            passport.status ||
            "unverified"
        ).toLowerCase();
    }

    function isVerified(passport) {
        return verificationStatus(passport) === "verified";
    }

    function qualificationName(record) {
        if (typeof record === "string") return record;

        return record.title ||
            record.name ||
            record.qualification ||
            record.certificateName ||
            "Qualification";
    }


    /* =====================================================
       3. MATCH DATA
    ===================================================== */

    function matchCandidateId(match) {
        return match.candidateId ||
            match.candidate?.id ||
            match.userId;
    }

    function matchJobId(match) {
        return match.jobId ||
            match.job?.id;
    }

    function matchScore(match) {
        const score = number(
            match.matchScore ??
            match.compatibilityScore ??
            match.score ??
            match.percentage
        );

        return score >= 0 && score <= 100
            ? score
            : null;
    }

    function matchesForPassport(passport) {
        const id = candidateId(passport);

        if (!id) return [];

        return state.matches.filter(match =>
            String(matchCandidateId(match)) === String(id)
        );
    }

    function bestMatch(passport, jobId = "") {
        const matches = matchesForPassport(passport)
            .filter(match =>
                !jobId ||
                String(matchJobId(match)) === String(jobId)
            )
            .filter(match => matchScore(match) !== null)
            .sort((a, b) =>
                matchScore(b) - matchScore(a)
            );

        return matches[0] || null;
    }


    /* =====================================================
       4. LOAD DATA
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
        setConnection("Loading skills and matching data...");

        try {
            const results = await Promise.allSettled([
                api(companyPath("/skills-passports")),
                api(companyPath("/jobs")),
                api(companyPath("/candidate-matches"))
            ]);

            if (results[0].status === "rejected") {
                throw results[0].reason;
            }

            state.passports = listOf(
                results[0].value,
                "passports"
            );

            state.jobs = results[1].status === "fulfilled"
                ? listOf(results[1].value, "jobs")
                : [];

            state.matches = results[2].status === "fulfilled"
                ? listOf(results[2].value, "matches")
                : [];

            populateJobSelects();

            state.filtered = [...state.passports];

            renderAll();

            setConnection("Connected to TALVORA", "connected");

            if (results[2].status === "rejected") {
                $("matchingStatus").textContent =
                    "Passport data loaded. Matching results are currently unavailable.";
            }

            if ($("skillsLastUpdated")) {
                $("skillsLastUpdated").textContent =
                    `Updated ${new Date().toLocaleTimeString()}`;
            }

        } catch (error) {
            console.error("[TALVORA SKILLS]", error);
            setConnection("Unable to load Skills Passports", "error");
            toast(error.message, "error");
            renderEmpty();

        } finally {
            state.loading = false;
        }
    }

    function renderEmpty() {
        const body = $("skillsTableBody");
        if (!body) return;

        body.replaceChildren();

        const row = createElement("tr");
        const td = createElement(
            "td",
            "table-loading",
            "Unable to load Skills Passports. Please refresh and try again."
        );

        td.colSpan = 6;
        row.appendChild(td);
        body.appendChild(row);
    }


    /* =====================================================
       5. POPULATE JOB FILTERS
    ===================================================== */

    function populateJobSelects() {
        [
            $("matchingJobSelect"),
            $("skillsJobFilter")
        ].forEach(select => {
            if (!select) return;

            const previous = select.value;
            const isMatching = select.id === "matchingJobSelect";

            select.replaceChildren();

            const first = createElement(
                "option",
                "",
                isMatching
                    ? "Choose a published job"
                    : "All matching jobs"
            );

            first.value = "";
            select.appendChild(first);

            state.jobs
                .filter(job =>
                    !isMatching || job.status === "published"
                )
                .forEach(job => {
                    const option = createElement(
                        "option",
                        "",
                        job.title || "Untitled Job"
                    );

                    option.value = job.id;
                    select.appendChild(option);
                });

            if (
                Array.from(select.options).some(option =>
                    option.value === previous
                )
            ) {
                select.value = previous;
            }
        });
    }


    /* =====================================================
       6. KPI STATISTICS
    ===================================================== */

    function renderKPIs() {
        const verified = state.passports.filter(isVerified);

        const totalSkills = state.passports.reduce(
            (total, passport) =>
                total + passportSkills(passport).length,
            0
        );

        const highMatches = state.matches.filter(match => {
            const score = matchScore(match);
            return score !== null && score >= 80;
        });

        const values = {
            totalPassports: state.passports.length,
            verifiedPassports: verified.length,
            totalRecordedSkills: totalSkills,
            totalMatches: state.matches.length,
            highMatches: highMatches.length
        };

        Object.entries(values).forEach(([id, value]) => {
            if ($(id)) {
                $(id).textContent = formatNumber(value);
            }
        });
    }


    /* =====================================================
       7. VERIFICATION BADGES
    ===================================================== */

    function badge(status) {
        const classes = {
            verified: "verified",
            pending: "pending",
            rejected: "rejected",
            unverified: "neutral"
        };

        return createElement(
            "span",
            `status-badge ${classes[status] || "neutral"}`,
            formatLabel(status)
        );
    }


    /* =====================================================
       8. CANDIDATE TABLE
    ===================================================== */

    function renderSkillsCell(passport) {
        const td = createElement("td");
        const skills = passportSkills(passport).slice(0, 3);

        if (!skills.length) {
            td.textContent = "No skills recorded";
            return td;
        }

        skills.forEach(skill => {
            td.appendChild(
                createElement(
                    "span",
                    "skill-chip",
                    skillName(skill)
                )
            );
        });

        if (passportSkills(passport).length > 3) {
            td.appendChild(
                createElement(
                    "span",
                    "skill-chip",
                    `+${passportSkills(passport).length - 3} more`
                )
            );
        }

        return td;
    }

    function renderCandidateCell(passport) {
        const td = createElement("td");

        td.append(
            createElement(
                "div",
                "candidate-primary",
                candidateName(passport)
            ),
            createElement(
                "small",
                "candidate-secondary",
                candidateEmail(passport)
            )
        );

        return td;
    }

    function renderMatchCell(passport) {
        const td = createElement("td");
        const selectedJob = $("skillsJobFilter")?.value || "";
        const match = bestMatch(passport, selectedJob);
        const score = match ? matchScore(match) : null;

        if (score === null) {
            td.textContent = "Not matched";
            return td;
        }

        const wrapper = createElement("div", "match-score");
        const percentage = createElement(
            "span",
            "",
            `${Math.round(score)}%`
        );

        const track = createElement("div", "match-score-track");
        const fill = createElement("div", "match-score-fill");

        fill.style.width = `${score}%`;
        track.appendChild(fill);
        wrapper.append(percentage, track);
        td.appendChild(wrapper);

        return td;
    }

    function renderTable() {
        const body = $("skillsTableBody");
        if (!body) return;

        body.replaceChildren();

        const records = state.filtered;

        if ($("passportCountLabel")) {
            $("passportCountLabel").textContent =
                `${state.passports.length} candidate profiles`;
        }

        if ($("skillsTableFooter")) {
            $("skillsTableFooter").textContent =
                `Showing ${records.length} of ${state.passports.length} candidates`;
        }

        if ($("skillsFilteredCount")) {
            $("skillsFilteredCount").textContent =
                `${records.length} records`;
        }

        if (!records.length) {
            const row = createElement("tr");
            const td = createElement(
                "td",
                "table-loading",
                "No candidate profiles match your filters."
            );

            td.colSpan = 6;
            row.appendChild(td);
            body.appendChild(row);
            return;
        }

        records.forEach(passport => {
            const row = createElement("tr");

            row.appendChild(renderCandidateCell(passport));
            row.appendChild(renderSkillsCell(passport));

            row.appendChild(
                createElement(
                    "td",
                    "",
                    passportQualifications(passport).length
                        ? passportQualifications(passport)
                            .map(qualificationName)
                            .slice(0, 2)
                            .join(", ")
                        : "Not provided"
                )
            );

            const statusCell = createElement("td");
            statusCell.appendChild(
                badge(verificationStatus(passport))
            );

            row.appendChild(statusCell);
            row.appendChild(renderMatchCell(passport));

            const actionCell = createElement("td");
            const button = createElement(
                "button",
                "table-action",
                "View Passport"
            );

            button.type = "button";
            button.dataset.passportId = passport.id;

            actionCell.appendChild(button);
            row.appendChild(actionCell);

            body.appendChild(row);
        });
    }


    /* =====================================================
       9. SEARCH AND FILTERS
    ===================================================== */

    function filterPassports() {
        const query = ($("skillsSearch")?.value || "")
            .trim()
            .toLowerCase();

        const verification =
            $("skillsVerificationFilter")?.value || "";

        const jobId = $("skillsJobFilter")?.value || "";

        const minimumScore =
            $("skillsScoreFilter")?.value || "";

        state.filtered = state.passports.filter(passport => {
            const searchable = [
                candidateName(passport),
                candidateEmail(passport),
                ...passportSkills(passport).map(skillName),
                ...passportQualifications(passport).map(qualificationName)
            ].join(" ").toLowerCase();

            const match = bestMatch(passport, jobId);
            const score = match ? matchScore(match) : null;

            return (
                (!query || searchable.includes(query)) &&
                (!verification ||
                    verificationStatus(passport) === verification) &&
                (!jobId || Boolean(match)) &&
                (!minimumScore ||
                    (score !== null && score >= Number(minimumScore)))
            );
        });

        renderTable();
    }

    function clearFilters() {
        [
            "skillsSearch",
            "skillsVerificationFilter",
            "skillsJobFilter",
            "skillsScoreFilter"
        ].forEach(id => {
            if ($(id)) $(id).value = "";
        });

        filterPassports();
    }


    /* =====================================================
       10. SKILLS DISTRIBUTION
    ===================================================== */

    function renderDistribution() {
        const container = $("skillsDistribution");
        if (!container) return;

        container.replaceChildren();

        const counts = new Map();

        state.passports.forEach(passport => {
            passportSkills(passport).forEach(skill => {
                const name = skillName(skill);
                counts.set(name, (counts.get(name) || 0) + 1);
            });
        });

        const records = [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 7);

        if (!records.length) {
            container.appendChild(
                createElement("p", "empty-record", "No skill records available.")
            );
            return;
        }

        const maximum = Math.max(...records.map(item => item[1]), 1);

        records.forEach(([name, count]) => {
            const item = createElement("div", "distribution-item");
            const heading = createElement("div", "distribution-heading");

            heading.append(
                createElement("span", "", name),
                createElement("strong", "", count)
            );

            const track = createElement("div", "distribution-track");
            const fill = createElement("div", "distribution-fill");

            fill.style.width = `${count / maximum * 100}%`;
            track.appendChild(fill);

            item.append(heading, track);
            container.appendChild(item);
        });
    }


    /* =====================================================
       11. VERIFICATION OVERVIEW
    ===================================================== */

    function renderVerification() {
        const container = $("verificationOverview");
        if (!container) return;

        container.replaceChildren();

        const statuses = [
            "verified",
            "pending",
            "rejected",
            "unverified"
        ];

        statuses.forEach(status => {
            const count = state.passports.filter(
                passport => verificationStatus(passport) === status
            ).length;

            const item = createElement("div", "verification-item");

            item.append(
                createElement("span", "", formatLabel(status)),
                createElement("strong", "", formatNumber(count))
            );

            container.appendChild(item);
        });
    }


    /* =====================================================
       12. SECURE DOCUMENT LINKS
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


    /* =====================================================
       13. PASSPORT DETAIL RECORDS
    ===================================================== */

    function renderRecords(containerId, records, type) {
        const container = $(containerId);
        if (!container) return;

        container.replaceChildren();

        if (!records.length) {
            container.appendChild(
                createElement(
                    "p",
                    "empty-record",
                    "No records available."
                )
            );
            return;
        }

        records.forEach(record => {
            const item = createElement("div", "passport-record");

            if (typeof record === "string") {
                item.appendChild(
                    createElement("strong", "", record)
                );
            } else {
                const title = type === "experience"
                    ? record.position || record.title || record.role
                    : type === "evidence"
                        ? record.name || record.title || record.fileName
                        : qualificationName(record);

                const description = [
                    record.institution,
                    record.organization,
                    record.issuer,
                    record.qualificationLevel,
                    record.fieldOfStudy,
                    record.startDate,
                    record.endDate,
                    record.description
                ].filter(Boolean).join(" • ");

                item.appendChild(
                    createElement(
                        "strong",
                        "",
                        title || formatLabel(type)
                    )
                );

                if (description) {
                    item.appendChild(
                        createElement("p", "", description)
                    );
                }

                if (type === "evidence") {
                    const url = safeUrl(
                        record.url ||
                        record.fileUrl ||
                        record.documentUrl
                    );

                    if (url) {
                        const link = createElement("a", "", "View Evidence ↗");
                        link.href = url;
                        link.target = "_blank";
                        link.rel = "noopener noreferrer";
                        item.appendChild(link);
                    }
                }
            }

            container.appendChild(item);
        });
    }


    /* =====================================================
       14. OPEN SKILLS PASSPORT
    ===================================================== */

    function openPassport(id) {
        const passport = state.passports.find(
            item => String(item.id) === String(id)
        );

        if (!passport) {
            toast("Skills Passport not found.", "error");
            return;
        }

        state.selectedPassport = passport;

        const candidate = candidateOf(passport);
        const name = candidateName(passport);

        $("passportDialogTitle").textContent =
            "Candidate Skills Passport";

        $("passportCandidateName").textContent = name;
        $("passportCandidateEmail").textContent =
            candidateEmail(passport);

        $("passportCandidateReference").textContent =
            `Reference: ${passport.reference || passport.id || "Unavailable"}`;

        $("passportAvatar").textContent =
            name.charAt(0).toUpperCase();

        const statusContainer = $("passportVerificationBadge");
        statusContainer.replaceChildren();
        statusContainer.appendChild(
            badge(verificationStatus(passport))
        );

        const skillsContainer = $("passportSkills");
        skillsContainer.replaceChildren();

        const skills = passportSkills(passport);

        if (!skills.length) {
            skillsContainer.appendChild(
                createElement("p", "empty-record", "No skills recorded.")
            );
        } else {
            skills.forEach(skill => {
                skillsContainer.appendChild(
                    createElement(
                        "span",
                        "passport-tag",
                        skillName(skill)
                    )
                );
            });
        }

        renderRecords(
            "passportQualifications",
            passportQualifications(passport),
            "qualification"
        );

        renderRecords(
            "passportExperience",
            passportExperience(passport),
            "experience"
        );

        renderRecords(
            "passportEvidence",
            passportEvidence(passport),
            "evidence"
        );

        renderRecords(
            "passportMatches",
            matchesForPassport(passport).map(match => {
                const job = state.jobs.find(
                    item => String(item.id) ===
                        String(matchJobId(match))
                );

                return {
                    title: job?.title || match.jobTitle || "Job Match",
                    description: matchScore(match) === null
                        ? "Compatibility score unavailable"
                        : `Compatibility: ${Math.round(matchScore(match))}%`
                };
            }),
            "match"
        );

        const dialog = $("passportDialog");

        if (dialog && !dialog.open) {
            dialog.showModal();
        }
    }


    /* =====================================================
       15. RUN MATCHING ENGINE
    ===================================================== */

    async function runMatching() {
        const jobId = $("matchingJobSelect")?.value;

        if (!jobId) {
            toast("Select a published job first.", "warning");
            return;
        }

        const job = state.jobs.find(
            item => String(item.id) === String(jobId)
        );

        if (!job || job.status !== "published") {
            toast("Only published jobs can be matched.", "warning");
            return;
        }

        const button = $("runMatchingButton");
        const status = $("matchingStatus");

        button.disabled = true;
        button.textContent = "Matching candidates...";

        status.textContent =
            "Submitting job requirements to the TALVORA matching service...";

        try {
            await api(
                companyPath("/candidate-matches/run"),
                {
                    method: "POST",
                    body: { jobId }
                }
            );

            status.textContent =
                "Matching request completed. Refreshing results...";

            await load();

            if ($("skillsJobFilter")) {
                $("skillsJobFilter").value = jobId;
                filterPassports();
            }

            status.textContent =
                "Matching results refreshed successfully.";

            toast("Candidate matching completed.", "success");

        } catch (error) {
            status.textContent =
                "The matching service could not complete the request.";

            toast(error.message, "error");

        } finally {
            button.disabled = false;
            button.textContent = "✧ Find Matching Candidates";
        }
    }


    /* =====================================================
       16. RENDER ALL
    ===================================================== */

    function renderAll() {
        renderKPIs();
        renderTable();
        renderDistribution();
        renderVerification();
    }


    /* =====================================================
       17. EVENT BINDING
    ===================================================== */

    function bind() {
        if (state.initialized) return;

        state.initialized = true;

        $("refreshSkillsButton")?.addEventListener(
            "click",
            load
        );

        $("runMatchingButton")?.addEventListener(
            "click",
            runMatching
        );

        $("clearSkillsFilters")?.addEventListener(
            "click",
            clearFilters
        );

        $("skillsSearch")?.addEventListener(
            "input",
            filterPassports
        );

        [
            "skillsVerificationFilter",
            "skillsJobFilter",
            "skillsScoreFilter"
        ].forEach(id => {
            $(id)?.addEventListener("change", filterPassports);
        });

        $("skillsTableBody")?.addEventListener(
            "click",
            event => {
                const button = event.target.closest(
                    "[data-passport-id]"
                );

                if (button) {
                    openPassport(button.dataset.passportId);
                }
            }
        );

        document.querySelectorAll(
            '[data-close-dialog="passportDialog"]'
        ).forEach(button => {
            button.addEventListener("click", () => {
                $("passportDialog")?.close();
            });
        });

        $("passportDialog")?.addEventListener(
            "click",
            event => {
                if (event.target === $("passportDialog")) {
                    $("passportDialog").close();
                }
            }
        );
    }


    /* =====================================================
       18. REGISTER MODULE
    ===================================================== */

    const module = {
        load,
        bind,
        refresh: load,
        getPassports: () => [...state.passports],
        getMatches: () => [...state.matches],
        getJobs: () => [...state.jobs]
    };

    shared.registerModule("skills-matching", module);

    window.TALVORA_SKILLS_MATCHING = module;

})();
