
/* =========================================================
   TALVORA GLOBAL SUPER ADMIN
   SHARED JAVASCRIPT CONTROL ENGINE

   MODULES:
   1. Jobs & Recruitment
   2. Skills Passport & Matching
   3. KYC & KYB Verification
   4. Privacy & Data Protection
   5. Trust, Safety & Moderation
========================================================= */

(() => {
    "use strict";

    /* =====================================================
       1. MODULE CONFIGURATIONS
    ===================================================== */

    const MODULES = {

        /* MODULE 1 — JOBS & RECRUITMENT */

        jobs: {
            title: "Jobs & Recruitment",
            dashboard: "/api/admin/jobs/dashboard",
            dashboardResource: "jobs",

            metrics: [
                "activeJobs",
                "totalApplications",
                "pendingApplications",
                "openModerationCases",
                "verifiedEmployers",
                "filledJobs",
                "suspendedJobs",
                "countriesActive"
            ],

            distributions: [
                "jobStatus",
                "applicationStatus"
            ],

            resources: {
                jobs: {
                    endpoint: "/api/admin/jobs/listings",
                    columns: [
                        ["reference", "Job ref."],
                        ["title", "Position"],
                        ["employerReference", "Employer ref."],
                        ["category", "Category"],
                        ["jurisdiction", "Jurisdiction"],
                        ["status", "Status", "badge"],
                        ["priority", "Priority", "badge"],
                        ["updatedAt", "Updated", "date"]
                    ],
                    actions: [
                        ["approve-listing", "Approve"],
                        ["reject-listing", "Reject"],
                        ["suspend-listing", "Suspend"],
                        ["flag-listing", "Flag"]
                    ]
                },

                applications: {
                    endpoint: "/api/admin/jobs/applications",
                    columns: [
                        ["reference", "Application ref."],
                        ["jobReference", "Job ref."],
                        ["profileReference", "Employee ref."],
                        ["employerReference", "Employer ref."],
                        ["stage", "Stage", "badge"],
                        ["jurisdiction", "Jurisdiction"],
                        ["submittedAt", "Submitted", "date"]
                    ],
                    actions: [
                        ["shortlist-application", "Shortlist"],
                        ["request-application-information", "Request info"],
                        ["reject-application", "Reject"],
                        ["escalate-application", "Escalate"]
                    ]
                },

                employers: {
                    endpoint: "/api/admin/jobs/employer-activity",
                    columns: [
                        ["employerReference", "Employer ref."],
                        ["displayName", "Display name"],
                        ["jurisdiction", "Jurisdiction"],
                        ["activeListings", "Active listings", "number"],
                        ["applicationCount", "Applications", "number"],
                        ["reportedHires", "Hires reported", "number"],
                        ["accountStatus", "Account status", "badge"]
                    ],
                    actions: []
                },

                moderation: {
                    endpoint: "/api/admin/jobs/moderation",
                    columns: [
                        ["reference", "Case ref."],
                        ["itemReference", "Reported item"],
                        ["reportType", "Report type"],
                        ["reasonSummary", "Reason"],
                        ["jurisdiction", "Jurisdiction"],
                        ["priority", "Priority", "badge"],
                        ["status", "Status", "badge"]
                    ],
                    actions: [
                        ["resolve-moderation-case", "Resolve"],
                        ["dismiss-moderation-case", "Dismiss"],
                        ["escalate-moderation-case", "Escalate"],
                        ["restrict-reported-listing", "Restrict listing"]
                    ]
                }
            }
        },

        /* MODULE 2 — SKILLS PASSPORT & MATCHING */

        skills: {
            title: "Skills Passport & Matching",
            dashboard: "/api/admin/skills/dashboard",
            dashboardResource: "passports",

            metrics: [
                "totalPassports",
                "verifiedSkills",
                "pendingEvidence",
                "activeAssessments",
                "completedAssessments",
                "activeMatches",
                "openQualityCases",
                "jurisdictionsCovered"
            ],

            distributions: [
                "passportStatus",
                "evidenceStatus"
            ],

            resources: {
                passports: {
                    endpoint: "/api/admin/skills/passports",
                    columns: [
                        ["reference", "Passport ref."],
                        ["profileReference", "Profile ref."],
                        ["skillsTotal", "Skills total", "number"],
                        ["verifiedSkills", "Verified skills", "number"],
                        ["jurisdiction", "Jurisdiction"],
                        ["status", "Status", "badge"],
                        ["updatedAt", "Updated", "date"]
                    ],
                    actions: [
                        ["request-passport-review", "Request review"],
                        ["request-passport-reverification", "Re-verify"],
                        ["flag-passport", "Flag record"]
                    ]
                },

                evidence: {
                    endpoint: "/api/admin/skills/evidence",
                    columns: [
                        ["reference", "Evidence ref."],
                        ["passportReference", "Passport ref."],
                        ["skillReference", "Skill ref."],
                        ["evidenceType", "Evidence type"],
                        ["issuerReference", "Issuer ref."],
                        ["submittedAt", "Submitted", "date"],
                        ["status", "Status", "badge"]
                    ],
                    actions: [
                        ["request-evidence-review", "Review evidence"],
                        ["flag-evidence", "Flag evidence"],
                        ["request-secure-evidence-access", "Request access"]
                    ]
                },

                assessments: {
                    endpoint: "/api/admin/skills/assessments",
                    columns: [
                        ["reference", "Assessment ref."],
                        ["profileReference", "Profile ref."],
                        ["skillReference", "Skill ref."],
                        ["assessmentType", "Assessment type"],
                        ["assessorReference", "Assessor ref."],
                        ["result", "Result"],
                        ["status", "Status", "badge"]
                    ],
                    actions: [
                        ["request-assessment-review", "Review assessment"],
                        ["request-reassessment", "Reassess"],
                        ["flag-assessment", "Flag assessment"]
                    ]
                },

                matching: {
                    endpoint: "/api/admin/skills/matches",
                    columns: [
                        ["reference", "Match ref."],
                        ["jobReference", "Job ref."],
                        ["passportReference", "Passport ref."],
                        ["skillCoverage", "Skill coverage"],
                        ["matchScore", "Match score", "percent"],
                        ["jurisdiction", "Jurisdiction"],
                        ["status", "Status", "badge"]
                    ],
                    actions: [
                        ["review-match-explanation", "Review explanation"],
                        ["flag-match-for-fairness-review", "Fairness review"]
                    ]
                },

                quality: {
                    endpoint: "/api/admin/skills/quality-cases",
                    columns: [
                        ["reference", "Case ref."],
                        ["recordReference", "Record ref."],
                        ["caseType", "Case type"],
                        ["reasonSummary", "Reason"],
                        ["jurisdiction", "Jurisdiction"],
                        ["priority", "Priority", "badge"],
                        ["status", "Status", "badge"]
                    ],
                    actions: [
                        ["resolve-skills-quality-case", "Resolve"],
                        ["escalate-skills-quality-case", "Escalate"],
                        ["dismiss-skills-quality-case", "Dismiss"]
                    ]
                }
            }
        },

        /* MODULE 3 — KYC & KYB */

        kyc: {
            title: "KYC & KYB Verification",
            dashboard: "/api/admin/kyc/dashboard",
            dashboardResource: "individuals",

            metrics: [
                "totalIndividuals",
                "verifiedIndividuals",
                "pendingVerifications",
                "totalBusinesses",
                "verifiedBusinesses",
                "pendingDocuments",
                "openScreeningAlerts",
                "openCases"
            ],

            distributions: [
                "individualStatus",
                "businessStatus"
            ],

            resources: {
                individuals: {
                    endpoint: "/api/admin/kyc/individuals",
                    columns: [
                        ["reference", "Verification ref."],
                        ["profileReference", "Profile ref."],
                        ["jurisdiction", "Jurisdiction"],
                        ["verificationLevel", "Verification level"],
                        ["status", "Status", "badge"],
                        ["updatedAt", "Updated", "date"]
                    ],
                    actions: [
                        ["request-kyc-review", "Review"],
                        ["approve-individual-kyc", "Approve"],
                        ["reject-individual-kyc", "Reject"],
                        ["request-kyc-reverification", "Re-verify"]
                    ]
                },

                businesses: {
                    endpoint: "/api/admin/kyc/businesses",
                    columns: [
                        ["reference", "KYB ref."],
                        ["businessReference", "Business ref."],
                        ["legalEntityReference", "Legal entity ref."],
                        ["jurisdiction", "Jurisdiction"],
                        ["verificationLevel", "Verification level"],
                        ["status", "Status", "badge"],
                        ["updatedAt", "Updated", "date"]
                    ],
                    actions: [
                        ["request-business-review", "Review"],
                        ["approve-business-kyb", "Approve"],
                        ["flag-business-record", "Flag"],
                        ["request-business-reverification", "Re-verify"]
                    ]
                },

                documents: {
                    endpoint: "/api/admin/kyc/documents",
                    columns: [
                        ["reference", "Document ref."],
                        ["subjectReference", "Subject ref."],
                        ["documentType", "Document type"],
                        ["issuerReference", "Issuer ref."],
                        ["jurisdiction", "Jurisdiction"],
                        ["submittedAt", "Submitted", "date"],
                        ["status", "Status", "badge"]
                    ],
                    actions: [
                        ["request-document-review", "Review"],
                        ["flag-document", "Flag"],
                        ["request-secure-document-access", "Request access"]
                    ]
                },

                screening: {
                    endpoint: "/api/admin/kyc/screening-alerts",
                    columns: [
                        ["reference", "Alert ref."],
                        ["subjectReference", "Subject ref."],
                        ["screeningType", "Screening type"],
                        ["matchReference", "Match ref."],
                        ["jurisdiction", "Jurisdiction"],
                        ["priority", "Priority", "badge"],
                        ["status", "Status", "badge"]
                    ],
                    actions: [
                        ["request-screening-review", "Review"],
                        ["escalate-screening-alert", "Escalate"],
                        ["dismiss-screening-alert", "Dismiss"]
                    ]
                },

                cases: {
                    endpoint: "/api/admin/kyc/cases",
                    columns: [
                        ["reference", "Case ref."],
                        ["subjectReference", "Subject ref."],
                        ["caseType", "Case type"],
                        ["reasonSummary", "Reason"],
                        ["jurisdiction", "Jurisdiction"],
                        ["priority", "Priority", "badge"],
                        ["status", "Status", "badge"]
                    ],
                    actions: [
                        ["resolve-kyc-case", "Resolve"],
                        ["escalate-kyc-case", "Escalate"],
                        ["dismiss-kyc-case", "Dismiss"]
                    ]
                }
            }
        },

        /* MODULE 4 — PRIVACY & DATA PROTECTION */

        privacy: {
            title: "Privacy & Data Protection",
            dashboard: "/api/admin/privacy/dashboard",
            dashboardResource: "consents",

            metrics: [
                "totalConsentRecords",
                "activeConsents",
                "pendingRequests",
                "overdueRequests",
                "processingActivities",
                "openPrivacyIncidents",
                "recordsDueForReview",
                "jurisdictionsCovered"
            ],

            distributions: [
                "consentStatus",
                "requestStatus"
            ],

            resources: {
                consents: {
                    endpoint: "/api/admin/privacy/consents",
                    columns: [
                        ["reference", "Consent ref."],
                        ["subjectReference", "Subject ref."],
                        ["purpose", "Purpose"],
                        ["lawfulBasis", "Lawful basis"],
                        ["jurisdiction", "Jurisdiction"],
                        ["status", "Status", "badge"],
                        ["updatedAt", "Updated", "date"]
                    ],
                    actions: [
                        ["review-consent-record", "Review"],
                        ["request-consent-correction", "Correction review"],
                        ["review-consent-withdrawal", "Withdrawal review"]
                    ]
                },

                requests: {
                    endpoint: "/api/admin/privacy/requests",
                    columns: [
                        ["reference", "Request ref."],
                        ["subjectReference", "Subject ref."],
                        ["requestType", "Request type"],
                        ["receivedAt", "Received", "date"],
                        ["dueAt", "Due date", "date"],
                        ["jurisdiction", "Jurisdiction"],
                        ["status", "Status", "badge"]
                    ],
                    actions: [
                        ["review-privacy-request", "Review"],
                        ["resolve-privacy-request", "Resolve"],
                        ["escalate-privacy-request", "Escalate"],
                        ["request-privacy-information", "Request info"]
                    ]
                },

                processing: {
                    endpoint: "/api/admin/privacy/processing-activities",
                    columns: [
                        ["reference", "Activity ref."],
                        ["activityName", "Activity"],
                        ["controllerReference", "Controller ref."],
                        ["purpose", "Purpose"],
                        ["lawfulBasis", "Lawful basis"],
                        ["jurisdiction", "Jurisdiction"],
                        ["status", "Status", "badge"]
                    ],
                    actions: [
                        ["review-processing-activity", "Review"],
                        ["flag-processing-activity", "Flag"],
                        ["request-processing-update", "Request update"]
                    ]
                },

                incidents: {
                    endpoint: "/api/admin/privacy/incidents",
                    columns: [
                        ["reference", "Incident ref."],
                        ["incidentType", "Incident type"],
                        ["severity", "Severity", "badge"],
                        ["affectedSystem", "Affected system"],
                        ["jurisdiction", "Jurisdiction"],
                        ["reportedAt", "Reported", "date"],
                        ["status", "Status", "badge"]
                    ],
                    actions: [
                        ["review-privacy-incident", "Review"],
                        ["escalate-privacy-incident", "Escalate"],
                        ["resolve-privacy-incident", "Resolve"]
                    ]
                },

                retention: {
                    endpoint: "/api/admin/privacy/retention-policies",
                    columns: [
                        ["reference", "Policy ref."],
                        ["recordCategory", "Record category"],
                        ["retentionRule", "Retention rule"],
                        ["ownerReference", "Owner ref."],
                        ["jurisdiction", "Jurisdiction"],
                        ["nextReviewAt", "Next review", "date"],
                        ["status", "Status", "badge"]
                    ],
                    actions: [
                        ["review-retention-policy", "Review"],
                        ["request-retention-review", "Request review"],
                        ["flag-retention-policy", "Flag"]
                    ]
                }
            }
        },

        /* MODULE 5 — TRUST, SAFETY & MODERATION */

        trustSafety: {
            title: "Trust, Safety & Moderation",
            dashboard: "/api/admin/trust-safety/dashboard",
            dashboardResource: "reports",

            metrics: [
                "openReports",
                "pendingModeration",
                "restrictedAccounts",
                "openAppeals",
                "escalatedCases",
                "activeRiskSignals",
                "resolvedReports",
                "jurisdictionsCovered"
            ],

            distributions: [
                "reportStatus",
                "moderationStatus"
            ],

            resources: {
                reports: {
                    endpoint: "/api/admin/trust-safety/reports",
                    columns: [
                        ["reference", "Report ref."],
                        ["reportedItemReference", "Item ref."],
                        ["reportCategory", "Category"],
                        ["reasonSummary", "Reason"],
                        ["jurisdiction", "Jurisdiction"],
                        ["priority", "Priority", "badge"],
                        ["status", "Status", "badge"]
                    ],
                    actions: [
                        ["review-user-report", "Review"],
                        ["escalate-user-report", "Escalate"],
                        ["resolve-user-report", "Resolve"],
                        ["dismiss-user-report", "Dismiss"]
                    ]
                },

                moderation: {
                    endpoint: "/api/admin/trust-safety/moderation",
                    columns: [
                        ["reference", "Case ref."],
                        ["itemReference", "Item ref."],
                        ["policyCategory", "Policy category"],
                        ["assignedTeam", "Assigned team"],
                        ["jurisdiction", "Jurisdiction"],
                        ["priority", "Priority", "badge"],
                        ["status", "Status", "badge"]
                    ],
                    actions: [
                        ["review-moderation-case", "Review"],
                        ["escalate-moderation-case", "Escalate"],
                        ["resolve-moderation-case", "Resolve"],
                        ["dismiss-moderation-case", "Dismiss"]
                    ]
                },

                accounts: {
                    endpoint: "/api/admin/trust-safety/accounts",
                    columns: [
                        ["reference", "Review ref."],
                        ["accountReference", "Account ref."],
                        ["accountType", "Account type"],
                        ["riskLevel", "Risk level", "badge"],
                        ["jurisdiction", "Jurisdiction"],
                        ["reviewedAt", "Reviewed", "date"],
                        ["status", "Status", "badge"]
                    ],
                    actions: [
                        ["review-account-enforcement", "Review"],
                        ["request-account-restriction", "Restrict"],
                        ["request-account-reinstatement", "Reinstate"],
                        ["escalate-account-review", "Escalate"]
                    ]
                },

                appeals: {
                    endpoint: "/api/admin/trust-safety/appeals",
                    columns: [
                        ["reference", "Appeal ref."],
                        ["decisionReference", "Decision ref."],
                        ["appealType", "Appeal type"],
                        ["submittedAt", "Submitted", "date"],
                        ["jurisdiction", "Jurisdiction"],
                        ["priority", "Priority", "badge"],
                        ["status", "Status", "badge"]
                    ],
                    actions: [
                        ["review-appeal", "Review"],
                        ["uphold-appeal-decision", "Uphold decision"],
                        ["overturn-appeal-decision", "Overturn decision"],
                        ["escalate-appeal", "Escalate"]
                    ]
                },

                risk: {
                    endpoint: "/api/admin/trust-safety/risk-signals",
                    columns: [
                        ["reference", "Signal ref."],
                        ["subjectReference", "Subject ref."],
                        ["signalType", "Signal type"],
                        ["riskLevel", "Risk level", "badge"],
                        ["jurisdiction", "Jurisdiction"],
                        ["detectedAt", "Detected", "date"],
                        ["status", "Status", "badge"]
                    ],
                    actions: [
                        ["review-risk-signal", "Review"],
                        ["escalate-risk-signal", "Escalate"],
                        ["resolve-risk-signal", "Resolve"],
                        ["dismiss-risk-signal", "Dismiss"]
                    ]
                }
            }
        }
    };


    /* =====================================================
       2. INITIALIZATION AND CONFIGURATION
    ===================================================== */

    const rawModuleKey =
        document.body.dataset.module || "";

    const moduleAliases = {
        "trust-safety": "trustSafety",
        "trust_safety": "trustSafety"
    };

    const moduleKey =
        moduleAliases[rawModuleKey] || rawModuleKey;

    const moduleConfig = MODULES[moduleKey];

    if (!moduleConfig) {
        console.error(
            "[TALVORA] Unknown administrative module:",
            moduleKey
        );
        return;
    }

    const globalConfig =
        window.TALVORA_ADMIN_CONFIG || {};

    const apiBase = String(
        globalConfig.apiBaseUrl || ""
    ).replace(/\/+$/, "");

    const timeoutMs =
        Number(globalConfig.timeout) || 30000;

    const refreshInterval =
        Number(globalConfig.refreshInterval) || 45000;

    const $ = id =>
        document.getElementById(id);

    const state = {
        section: "overview",
        pendingAction: null,
        refreshTimer: null,
        requestControllers: new Set()
    };


    /* =====================================================
       3. SECURITY AND DATA HELPERS
    ===================================================== */

    function escapeHTML(value) {
        return String(value ?? "—").replace(
            /[&<>"']/g,
            character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            })[character]
        );
    }

    function dataOf(payload) {
        return payload?.data ?? payload ?? {};
    }

    function getArray(payload, keys = []) {
        const data = dataOf(payload);

        if (Array.isArray(data)) {
            return data;
        }

        for (const key of keys) {
            if (Array.isArray(data?.[key])) {
                return data[key];
            }
        }

        return [];
    }

    function apiUrl(path) {
        const base = apiBase
            ? new URL(apiBase, window.location.origin)
            : new URL(window.location.origin);

        const url = new URL(path, base);

        if (url.origin !== window.location.origin) {
            throw new Error(
                "Administrative API requests must use the same origin."
            );
        }

        return url.toString();
    }

    function createIdempotencyKey() {
        if (!window.crypto?.randomUUID) {
            throw new Error(
                "Secure request identification is unavailable."
            );
        }

        return window.crypto.randomUUID();
    }


    /* =====================================================
       4. API REQUEST ENGINE
    ===================================================== */

    async function api(path, options = {}) {
        const controller = new AbortController();

        state.requestControllers.add(controller);

        const timer = setTimeout(
            () => controller.abort(),
            timeoutMs
        );

        const headers = new Headers(
            options.headers || {}
        );

        headers.set("Accept", "application/json");

        const csrf = document.querySelector(
            'meta[name="csrf-token"]'
        )?.content;

        if (csrf) {
            headers.set("X-CSRF-Token", csrf);
        }

        let body = options.body;

        if (
            body &&
            !(body instanceof FormData) &&
            typeof body !== "string"
        ) {
            headers.set(
                "Content-Type",
                "application/json"
            );

            body = JSON.stringify(body);
        }

        try {
            const response = await fetch(
                apiUrl(path),
                {
                    ...options,
                    headers,
                    body,
                    credentials: "include",
                    cache: "no-store",
                    signal: controller.signal
                }
            );

            if (!response.ok) {
                let message =
                    `Request failed (${response.status})`;

                try {
                    const error = await response.json();

                    message =
                        error.message ||
                        error.detail ||
                        error.error ||
                        message;
                } catch {
                    // Retain the HTTP status message.
                }

                if (response.status === 401) {
                    setConnection(
                        "error",
                        "Authentication required"
                    );
                }

                if (response.status === 403) {
                    message =
                        "You are not authorized to perform this action.";
                }

                if (response.status === 409) {
                    message =
                        "This record has changed. Refresh and try again.";
                }

                throw new Error(message);
            }

            if (response.status === 204) {
                return null;
            }

            const contentType =
                response.headers.get("content-type") || "";

            return contentType.includes("application/json")
                ? await response.json()
                : await response.text();

        } catch (error) {
            if (error.name === "AbortError") {
                throw new Error(
                    "The request timed out. Please try again."
                );
            }

            throw error;

        } finally {
            clearTimeout(timer);
            state.requestControllers.delete(controller);
        }
    }


    /* =====================================================
       5. CONNECTION STATUS
    ===================================================== */

    function setConnection(status, label) {
        const element = $("connectionStatus");

        if (!element) return;

        element.className =
            `connection-pill ${status}`;

        const indicator =
            document.createElement("i");

        element.replaceChildren(
            indicator,
            document.createTextNode(label)
        );
    }


    /* =====================================================
       6. NOTIFICATION SYSTEM
    ===================================================== */

    function toast(message, type = "info") {
        const region = $("toastRegion");

        if (!region) return;

        const notification =
            document.createElement("div");

        notification.className = `toast ${type}`;
        notification.textContent = message;

        notification.setAttribute("role", "status");

        region.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }


    /* =====================================================
       7. QUERY AND FILTER MANAGEMENT
    ===================================================== */

    function queryString(parameters) {
        const search = new URLSearchParams();

        Object.entries(parameters).forEach(
            ([key, value]) => {
                if (
                    value !== "" &&
                    value !== null &&
                    value !== undefined
                ) {
                    search.set(key, value);
                }
            }
        );

        const result = search.toString();

        return result ? `?${result}` : "";
    }

    function filtersFor(resourceKey) {
        const wrapper = document.querySelector(
            `[data-filter-for="${CSS.escape(resourceKey)}"]`
        );

        const filters = {
            page: 1,
            pageSize: 50
        };

        if (!wrapper) return filters;

        wrapper.querySelectorAll(
            "[data-query]"
        ).forEach(control => {
            const value = control.value.trim();

            if (value) {
                filters[control.dataset.query] = value;
            }
        });

        return filters;
    }


    /* =====================================================
       8. DASHBOARD METRICS
    ===================================================== */

    function setMetric(key, value) {
        const element = document.querySelector(
            `[data-metric="${CSS.escape(key)}"]`
        );

        if (!element) return;

        if (value === null || value === undefined) {
            element.textContent = "—";
            return;
        }

        element.textContent =
            typeof value === "number"
                ? value.toLocaleString()
                : String(value);
    }


    /* =====================================================
       9. DISTRIBUTION VISUALIZATION
    ===================================================== */

    function renderDistribution(key, source) {
        const target = document.querySelector(
            `[data-distribution="${CSS.escape(key)}"]`
        );

        if (!target) return;

        let rows = [];

        if (Array.isArray(source)) {
            rows = source;
        } else if (
            source &&
            typeof source === "object"
        ) {
            rows = Object.entries(source).map(
                ([label, count]) => ({
                    label,
                    count
                })
            );
        }

        if (!rows.length) {
            target.innerHTML = `
                <p class="empty-cell">
                    No distribution data returned.
                </p>
            `;
            return;
        }

        const values = rows.map(row =>
            Number(
                row.count ??
                row.total ??
                row.value ??
                0
            )
        );

        const maximum = Math.max(1, ...values);

        target.innerHTML = rows.map(row => {
            const label = String(
                row.label ??
                row.name ??
                row.status ??
                "Other"
            );

            const count = Number(
                row.count ??
                row.total ??
                row.value ??
                0
            );

            const width = Math.max(
                0,
                Math.min(100, count / maximum * 100)
            );

            const className =
                label.toLowerCase().replace(
                    /[^a-z0-9_-]/g,
                    "_"
                );

            return `
                <div class="distribution-row">
                    <span class="distribution-label">
                        ${escapeHTML(label.replace(/[_-]/g, " "))}
                    </span>

                    <div class="distribution-track">
                        <div
                            class="distribution-fill ${escapeHTML(className)}"
                            style="width:${width}%">
                        </div>
                    </div>

                    <span class="distribution-count">
                        ${escapeHTML(count.toLocaleString())}
                    </span>
                </div>
            `;
        }).join("");
    }


    /* =====================================================
       10. TABLE CELL FORMATTING
    ===================================================== */

    function formatCell(value, format) {
        if (format === "badge") {
            const raw =
                String(value ?? "unknown").toLowerCase();

            const className =
                raw.replace(/[^a-z0-9_-]/g, "_");

            const label =
                raw.replace(/[_-]/g, " ")
                    .replace(/\b\w/g, char =>
                        char.toUpperCase()
                    );

            return `
                <span class="badge ${escapeHTML(className)}">
                    ${escapeHTML(label)}
                </span>
            `;
        }

        if (format === "date") {
            if (!value) return "—";

            const parsed = new Date(value);

            if (Number.isNaN(parsed.getTime())) {
                return escapeHTML(value);
            }

            return escapeHTML(
                new Intl.DateTimeFormat(
                    undefined,
                    { dateStyle: "medium" }
                ).format(parsed)
            );
        }

        if (format === "number") {
            const number = Number(value);

            return Number.isFinite(number)
                ? escapeHTML(number.toLocaleString())
                : "—";
        }

        if (format === "percent") {
            const number = Number(value);

            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {
                return "—";
            }

            return Number.isFinite(number)
                ? `${escapeHTML(number)}%`
                : escapeHTML(value);
        }

        return escapeHTML(value);
    }


    /* =====================================================
       11. TABLE RENDERING
    ===================================================== */

    function renderTable(
        resourceKey,
        items,
        targetOverride = null,
        compact = false
    ) {
        const resource =
            moduleConfig.resources[resourceKey];

        const target = targetOverride ||
            document.querySelector(
                `[data-table-body="${CSS.escape(resourceKey)}"]`
            );

        if (!resource || !target) return;

        const columns = compact
            ? resource.columns.slice(0, 6)
            : resource.columns;

        if (!items.length) {
            target.innerHTML = `
                <tr>
                    <td
                        colspan="${columns.length + (compact ? 0 : 1)}"
                        class="empty-cell">
                        No records were returned by the platform.
                    </td>
                </tr>
            `;
            return;
        }

        target.innerHTML = items.map(item => {
            const recordId =
                item.id ??
                item.recordId ??
                item.reference ??
                "";

            const cells = columns.map(
                ([key, label, format]) => `
                    <td>
                        ${formatCell(item[key], format)}
                    </td>
                `
            ).join("");

            if (compact) {
                return `<tr>${cells}</tr>`;
            }

            const inspectButton = recordId
                ? `
                    <button
                        type="button"
                        class="row-action"
                        data-record-detail="${escapeHTML(resourceKey)}"
                        data-id="${escapeHTML(recordId)}">
                        Inspect
                    </button>
                `
                : "";

            const actions = resource.actions.map(
                ([action, label]) => {
                    if (!recordId) return "";

                    return `
                        <button
                            type="button"
                            class="row-action"
                            data-record-action="${escapeHTML(action)}"
                            data-resource="${escapeHTML(resourceKey)}"
                            data-id="${escapeHTML(recordId)}">
                            ${escapeHTML(label)}
                        </button>
                    `;
                }
            ).join("");

            return `
                <tr>
                    ${cells}
                    <td>
                        <div class="row-actions">
                            ${inspectButton}
                            ${actions}
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }


    /* =====================================================
       12. LOAD DASHBOARD
    ===================================================== */

    async function loadDashboard() {
        const payload = await api(
            moduleConfig.dashboard
        );

        const data = dataOf(payload);

        const metrics =
            data.metrics ||
            data.summary ||
            data;

        moduleConfig.metrics.forEach(key => {
            setMetric(key, metrics[key]);
        });

        moduleConfig.distributions.forEach(key => {
            renderDistribution(
                key,
                data.distributions?.[key] ??
                data[key]
            );
        });

        const resourceKey =
            moduleConfig.dashboardResource;

        const recent =
            data.recentRecords ||
            data.recentJobs ||
            data.recentPassports ||
            data.recentItems ||
            [];

        const target = document.querySelector(
            `[data-dashboard-table="${CSS.escape(resourceKey)}"]`
        );

        if (target) {
            renderTable(
                resourceKey,
                Array.isArray(recent) ? recent : [],
                target,
                true
            );
        }

        const updated = $("lastUpdated");

        if (updated) {
            updated.textContent =
                `Updated ${new Intl.DateTimeFormat(
                    undefined,
                    { timeStyle: "short" }
                ).format(new Date())}`;
        }
    }


    /* =====================================================
       13. LOAD INDIVIDUAL MODULE RESOURCES
    ===================================================== */

    async function loadResource(resourceKey) {
        const resource =
            moduleConfig.resources[resourceKey];

        if (!resource) return;

        const target = document.querySelector(
            `[data-table-body="${CSS.escape(resourceKey)}"]`
        );

        if (target) {
            target.innerHTML = `
                <tr>
                    <td
                        colspan="${resource.columns.length + 1}"
                        class="empty-cell">
                        Loading records...
                    </td>
                </tr>
            `;
        }

        try {
            const payload = await api(
                resource.endpoint +
                queryString(filtersFor(resourceKey))
            );

            const rows = getArray(
                payload,
                [
                    resourceKey,
                    "records",
                    "items",
                    "results"
                ]
            );

            renderTable(resourceKey, rows);

            const count = document.querySelector(
                `[data-result-count="${CSS.escape(resourceKey)}"]`
            );

            if (count) {
                count.textContent =
                    `${rows.length.toLocaleString()} records shown`;
            }

            return rows;

        } catch (error) {
            if (target) {
                target.innerHTML = `
                    <tr>
                        <td
                            colspan="${resource.columns.length + 1}"
                            class="empty-cell">
                            ${escapeHTML(error.message)}
                        </td>
                    </tr>
                `;
            }

            throw error;
        }
    }


    /* =====================================================
       14. MODULE NAVIGATION
    ===================================================== */

    function showSection(section) {
        if (
            section !== "overview" &&
            !moduleConfig.resources[section]
        ) {
            return;
        }

        state.section = section;

        document.querySelectorAll(
            ".module-section"
        ).forEach(element => {
            element.classList.toggle(
                "active",
                element.dataset.view === section
            );
        });

        document.querySelectorAll(
            ".nav-link"
        ).forEach(element => {
            element.classList.toggle(
                "active",
                element.dataset.section === section
            );
        });

        $("sidebar")?.classList.remove("open");

        history.replaceState(
            null,
            "",
            `#${section}`
        );

        const task = section === "overview"
            ? loadDashboard()
            : loadResource(section);

        task.catch(error => {
            toast(error.message, "error");
        });
    }


    /* =====================================================
       15. REFRESH CONTROL
    ===================================================== */

    async function refreshCurrent() {
        const button = $("refreshButton");

        if (button) {
            button.disabled = true;
            button.textContent = "Refreshing...";
        }

        setConnection("", "Refreshing");

        try {
            await loadDashboard();

            if (state.section !== "overview") {
                await loadResource(state.section);
            }

            setConnection("connected", "Connected");

            toast(
                "Platform information refreshed.",
                "success"
            );

        } catch (error) {
            setConnection("error", "Connection issue");

            toast(error.message, "error");

        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = "↻ Refresh";
            }
        }
    }


    /* =====================================================
       16. PROTECTED RECORD FIELDS
    ===================================================== */

    const sensitiveField =
        /password|secret|token|credential|private.?key|access.?key|full.?name|first.?name|last.?name|legal.?name|registered.?name|email|phone|mobile|date.?of.?birth|birth.?date|dob|passport.?number|national.?id|identity.?number|tax.?id|registration.?number|account.?number|iban|card.?number|home.?address|residential.?address|beneficial.?owner|ultimate.?beneficial.?owner|ubo|document.?url|file.?url|storage.?key|signed.?url|biometric|raw.?payload|data.?subject|ip.?address|device.?identifier|access.?credential/i;


    /* =====================================================
       17. RECORD DETAILS
    ===================================================== */

    async function showDetails(resourceKey, id) {
        const resource =
            moduleConfig.resources[resourceKey];

        if (!resource || !id) return;

        try {
            const payload = await api(
                `${resource.endpoint}/${encodeURIComponent(id)}`
            );

            const record = dataOf(payload);

            $("detailTitle").textContent =
                `${moduleConfig.title} · ${record.reference ||
                record.id ||
                "Record details"
                }`;

            const fields = Object.entries(record).filter(
                ([key, value]) =>
                    !sensitiveField.test(key) &&
                    value !== null &&
                    value !== undefined &&
                    [
                        "string",
                        "number",
                        "boolean"
                    ].includes(typeof value)
            );

            $("detailContent").innerHTML = fields.length
                ? fields.map(([key, value]) => `
                    <div class="detail-item">
                        <span>
                            ${escapeHTML(
                    key.replace(/([A-Z])/g, " $1")
                )}
                        </span>
                        <strong>
                            ${escapeHTML(value)}
                        </strong>
                    </div>
                `).join("")
                : `
                    <p class="empty-cell">
                        No additional non-sensitive details were returned.
                    </p>
                `;

            $("detailModal").hidden = false;

        } catch (error) {
            toast(
                `Unable to load record: ${error.message}`,
                "error"
            );
        }
    }


    /* =====================================================
       18. ADMINISTRATIVE ACTION DESCRIPTIONS
    ===================================================== */

    const actionDescriptions = {

        /* JOBS */

        "approve-listing":
            "Submit this listing for an authorized publication decision.",

        "reject-listing":
            "Record a reasoned rejection decision for this listing.",

        "suspend-listing":
            "Request a listing suspension under the applicable platform policy.",

        "flag-listing":
            "Flag this listing for further integrity review.",

        "shortlist-application":
            "Submit a shortlist workflow action. The hiring employer remains responsible for its recruitment decision.",

        "request-application-information":
            "Request additional information through the authorized recruitment workflow.",

        "reject-application":
            "Submit an application workflow decision with a documented reason.",

        "escalate-application":
            "Escalate this application record for additional review.",

        "resolve-moderation-case":
            "Submit a resolution for this moderation case.",

        "dismiss-moderation-case":
            "Submit a reasoned dismissal request for this report.",

        "escalate-moderation-case":
            "Escalate this case to the designated authority.",

        "restrict-reported-listing":
            "Request a restriction of the reported listing.",

        /* SKILLS */

        "request-passport-review":
            "Request a review of this skills passport.",

        "request-passport-reverification":
            "Request re-verification of the passport record.",

        "flag-passport":
            "Flag this passport for a quality review.",

        "request-evidence-review":
            "Request an authorized review of the evidence record.",

        "flag-evidence":
            "Flag the evidence record for additional examination.",

        "request-secure-evidence-access":
            "Request controlled, audited access to protected evidence.",

        "request-assessment-review":
            "Request review of the assessment process and recorded outcome.",

        "request-reassessment":
            "Request an authorized reassessment workflow.",

        "flag-assessment":
            "Flag the assessment record for quality review.",

        "review-match-explanation":
            "Request review of the matching criteria and explanation.",

        "flag-match-for-fairness-review":
            "Submit the match for fairness and bias review.",

        "resolve-skills-quality-case":
            "Submit a documented resolution for this quality case.",

        "escalate-skills-quality-case":
            "Escalate this quality case to the appropriate authority.",

        "dismiss-skills-quality-case":
            "Submit a reasoned dismissal request for this case.",

        /* KYC & KYB */

        "request-kyc-review":
            "Submit this identity verification record for authorized review.",

        "approve-individual-kyc":
            "Submit an individual identity verification approval request.",

        "reject-individual-kyc":
            "Submit a reasoned identity verification rejection request.",

        "request-kyc-reverification":
            "Request a new identity verification assessment.",

        "request-business-review":
            "Submit this business verification record for review.",

        "approve-business-kyb":
            "Submit a business verification approval request.",

        "flag-business-record":
            "Flag this business verification record for further examination.",

        "request-business-reverification":
            "Request additional business verification.",

        "request-document-review":
            "Request an authorized review of the submitted document.",

        "flag-document":
            "Flag the document for additional verification.",

        "request-secure-document-access":
            "Request controlled and audited access to the protected document.",

        "request-screening-review":
            "Request a contextual review of the screening alert.",

        "escalate-screening-alert":
            "Escalate the screening alert to an authorized reviewer.",

        "dismiss-screening-alert":
            "Submit a reasoned dismissal request for the screening alert.",

        "resolve-kyc-case":
            "Submit a documented resolution for the verification case.",

        "escalate-kyc-case":
            "Escalate the verification case.",

        "dismiss-kyc-case":
            "Submit a reasoned dismissal request for the verification case.",

        /* PRIVACY */

        "review-consent-record":
            "Review the consent record and its associated processing purpose.",

        "request-consent-correction":
            "Request a documented review of the consent record.",

        "review-consent-withdrawal":
            "Review the user's consent withdrawal request.",

        "review-privacy-request":
            "Review the data subject request and applicable response requirements.",

        "resolve-privacy-request":
            "Submit a documented resolution for the privacy request.",

        "escalate-privacy-request":
            "Escalate the privacy request to the responsible authority.",

        "request-privacy-information":
            "Request additional information needed to assess the privacy request.",

        "review-processing-activity":
            "Review the processing activity and its documented lawful basis.",

        "flag-processing-activity":
            "Flag the processing activity for privacy governance review.",

        "request-processing-update":
            "Request an update to the processing activity record.",

        "review-privacy-incident":
            "Review the privacy incident and its documented impact assessment.",

        "escalate-privacy-incident":
            "Escalate the privacy incident for appropriate response.",

        "resolve-privacy-incident":
            "Submit a documented resolution for the privacy incident.",

        "review-retention-policy":
            "Review the applicable record retention policy.",

        "request-retention-review":
            "Request a review of the retention period and legal requirements.",

        "flag-retention-policy":
            "Flag the retention policy for further governance review.",

        /* TRUST & SAFETY */

        "review-user-report":
            "Review the submitted user report and supporting information.",

        "escalate-user-report":
            "Escalate the report to the designated safety authority.",

        "resolve-user-report":
            "Submit a documented resolution for the user report.",

        "dismiss-user-report":
            "Submit a reasoned dismissal request for the user report.",

        "review-account-enforcement":
            "Review the account enforcement record and its supporting rationale.",

        "request-account-restriction":
            "Submit an account restriction request for authorized assessment.",

        "request-account-reinstatement":
            "Submit an account reinstatement request for authorized assessment.",

        "escalate-account-review":
            "Escalate the account review to the appropriate authority.",

        "review-appeal":
            "Review the appeal grounds, original decision and supporting evidence.",

        "uphold-appeal-decision":
            "Submit a reasoned request to uphold the original decision.",

        "overturn-appeal-decision":
            "Submit a reasoned request to overturn the original decision.",

        "escalate-appeal":
            "Escalate the appeal for additional or independent review.",

        "review-risk-signal":
            "Review the risk indicator in its full contextual circumstances.",

        "escalate-risk-signal":
            "Escalate the risk signal for further investigation.",

        "resolve-risk-signal":
            "Submit a documented resolution for the risk signal.",

        "dismiss-risk-signal":
            "Submit a reasoned dismissal request for the risk signal."
    };


    /* =====================================================
       19. OPEN ADMIN ACTION POPUP
    ===================================================== */

    function openAction(resource, id, action) {
        if (!moduleConfig.resources[resource] || !id) {
            return;
        }

        const requiredElements = [
            "actionTitle",
            "actionDescription",
            "actionReason",
            "actionEvidence",
            "submitAction",
            "actionModal"
        ];

        if (requiredElements.some(
            elementId => !$(elementId)
        )) {
            toast(
                "The administrative action dialog is incomplete in this HTML page.",
                "error"
            );
            return;
        }

        state.pendingAction = {
            resource,
            id,
            action
        };

        $("actionTitle").textContent =
            action.replace(/-/g, " ")
                .replace(/\b\w/g, char =>
                    char.toUpperCase()
                );

        $("actionDescription").textContent =
            actionDescriptions[action] ||
            "Submit this operation to the authorized platform workflow.";

        $("actionReason").value = "";
        $("actionEvidence").value = "";

        $("submitAction").disabled = true;

        $("actionModal").hidden = false;
        $("actionReason").focus();
    }


    /* =====================================================
       20. SUBMIT ADMINISTRATIVE ACTION
    ===================================================== */

    async function submitAction() {
        const pending = state.pendingAction;

        const reason =
            $("actionReason").value.trim();

        if (!pending || reason.length < 10) {
            return;
        }

        const resource =
            moduleConfig.resources[pending.resource];

        if (!resource) return;

        const button = $("submitAction");

        button.disabled = true;
        button.textContent = "Submitting...";

        try {
            await api(
                `${resource.endpoint}/${encodeURIComponent(pending.id)}/actions`,
                {
                    method: "POST",

                    headers: {
                        "Idempotency-Key":
                            createIdempotencyKey()
                    },

                    body: {
                        action: pending.action,
                        reason,

                        evidenceReference:
                            $("actionEvidence").value.trim() || null,

                        source:
                            `talvora_super_admin_${moduleKey}`
                    }
                }
            );

            $("actionModal").hidden = true;
            state.pendingAction = null;

            toast(
                "Action request submitted to the platform.",
                "success"
            );

            await Promise.allSettled([
                loadResource(pending.resource),
                loadDashboard()
            ]);

        } catch (error) {
            toast(
                `Action was not submitted: ${error.message}`,
                "error"
            );

        } finally {
            button.disabled = false;
            button.textContent = "Submit Action";
        }
    }


    /* =====================================================
       21. EVENT LISTENERS
    ===================================================== */

    function bindEvents() {

        /* Navigation */

        document.querySelectorAll(
            "[data-section]"
        ).forEach(link => {
            link.addEventListener(
                "click",
                event => {
                    event.preventDefault();

                    showSection(
                        link.dataset.section
                    );
                }
            );
        });

        /* View all buttons */

        document.querySelectorAll(
            "[data-go]"
        ).forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    showSection(
                        button.dataset.go
                    );
                }
            );
        });

        /* Mobile sidebar */

        $("menuToggle")?.addEventListener(
            "click",
            () => {
                $("sidebar")?.classList.toggle("open");
            }
        );

        /* Refresh */

        $("refreshButton")?.addEventListener(
            "click",
            refreshCurrent
        );

        /* Close modal buttons */

        document.querySelectorAll(
            "[data-close-modal]"
        ).forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    const modal = button.closest(
                        ".modal-backdrop"
                    );

                    if (modal) {
                        modal.hidden = true;
                    }
                }
            );
        });

        /* Close modal on backdrop click */

        document.querySelectorAll(
            ".modal-backdrop"
        ).forEach(modal => {
            modal.addEventListener(
                "click",
                event => {
                    if (event.target === modal) {
                        modal.hidden = true;
                    }
                }
            );
        });

        /* Validate administrative reason */

        $("actionReason")?.addEventListener(
            "input",
            event => {
                $("submitAction").disabled =
                    event.target.value.trim().length < 10;
            }
        );

        /* Submit action */

        $("submitAction")?.addEventListener(
            "click",
            submitAction
        );

        /* Table action delegation */

        document.addEventListener(
            "click",
            event => {
                const detail = event.target.closest(
                    "[data-record-detail]"
                );

                if (detail) {
                    showDetails(
                        detail.dataset.recordDetail,
                        detail.dataset.id
                    );
                    return;
                }

                const action = event.target.closest(
                    "[data-record-action]"
                );

                if (action) {
                    openAction(
                        action.dataset.resource,
                        action.dataset.id,
                        action.dataset.recordAction
                    );
                }
            }
        );

        /* Search and filters */

        document.querySelectorAll(
            "[data-filter-for]"
        ).forEach(wrapper => {
            const resourceKey =
                wrapper.dataset.filterFor;

            let timer;

            wrapper.querySelectorAll(
                "[data-query]"
            ).forEach(control => {
                const eventName =
                    control.matches("input")
                        ? "input"
                        : "change";

                control.addEventListener(
                    eventName,
                    () => {
                        clearTimeout(timer);

                        timer = setTimeout(
                            () => {
                                loadResource(
                                    resourceKey
                                ).catch(error => {
                                    toast(
                                        error.message,
                                        "error"
                                    );
                                });
                            },
                            control.matches("input")
                                ? 350
                                : 0
                        );
                    }
                );
            });
        });

        /* Keyboard accessibility */

        document.addEventListener(
            "keydown",
            event => {
                if (event.key === "Escape") {
                    document.querySelectorAll(
                        ".modal-backdrop"
                    ).forEach(modal => {
                        modal.hidden = true;
                    });
                }
            }
        );
    }


    /* =====================================================
       22. APPLICATION INITIALIZATION
    ===================================================== */

    async function initialize() {
        bindEvents();

        setConnection(
            "",
            "Connecting"
        );

        const requested =
            location.hash.slice(1);

        const section =
            document.querySelector(
                `[data-view="${CSS.escape(requested)}"]`
            )
                ? requested
                : "overview";

        try {
            await loadDashboard();

            setConnection(
                "connected",
                "Connected"
            );

        } catch (error) {
            setConnection(
                "error",
                "API unavailable"
            );

            toast(
                `Dashboard could not be loaded: ${error.message}`,
                "error"
            );
        }

        if (section !== "overview") {
            state.section = section;

            document.querySelectorAll(
                ".module-section"
            ).forEach(element => {
                element.classList.toggle(
                    "active",
                    element.dataset.view === section
                );
            });

            document.querySelectorAll(
                ".nav-link"
            ).forEach(element => {
                element.classList.toggle(
                    "active",
                    element.dataset.section === section
                );
            });

            loadResource(section).catch(error => {
                toast(error.message, "error");
            });
        }

        /* Automatic dashboard refresh */

        state.refreshTimer = setInterval(
            () => {
                if (
                    document.visibilityState === "visible" &&
                    state.section === "overview"
                ) {
                    loadDashboard().catch(error => {
                        console.warn(
                            "[TALVORA]",
                            error
                        );
                    });
                }
            },
            refreshInterval
        );
    }


    /* =====================================================
       23. SHARED MODULE PUBLIC INTERFACE
    ===================================================== */

    window.TALVORA_ADMIN_MODULE = Object.freeze({
        module: moduleKey,
        refresh: refreshCurrent,
        navigate: showSection,
        load: loadResource
    });


    /* =====================================================
       24. START APPLICATION
    ===================================================== */

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


/* =========================================================
   TALVORA — GLOBAL MODULE NAVIGATION
   Shared across all five administrative modules
========================================================= */

(() => {
    "use strict";

    const sidebar =
        document.querySelector(".sidebar");

    if (
        !sidebar ||
        sidebar.dataset.globalModulesAdded
    ) {
        return;
    }

    sidebar.dataset.globalModulesAdded = "true";

    const modules = [
        {
            file: "jobs.html",
            icon: "▣",
            name: "Jobs & Recruitment"
        },
        {
            file: "skills.html",
            icon: "◈",
            name: "Skills Passport"
        },
        {
            file: "kyc.html",
            icon: "♙",
            name: "KYC & KYB"
        },
        {
            file: "privacy.html",
            icon: "⬡",
            name: "Privacy & Data"
        },
        {
            file: "trust-safety.html",
            icon: "⚑",
            name: "Trust & Safety"
        },
        {
            file: "integration.html",
            icon: "⌘",
            name: "Integration Centre"
        }
    ];

    const currentPage =
        window.location.pathname.split("/").pop();

    const label =
        document.createElement("div");

    label.className =
        "sidebar-label global-module-nav";

    label.textContent =
        "GLOBAL PLATFORM MODULES";

    const navigation =
        document.createElement("nav");

    navigation.className =
        "side-nav global-module-nav";

    navigation.setAttribute(
        "aria-label",
        "Global TALVORA modules"
    );

    modules.forEach(module => {
        const link =
            document.createElement("a");

        link.className = "nav-link";
        link.href = module.file;

        if (currentPage === module.file) {
            link.classList.add("active");
        }

        const icon =
            document.createElement("span");

        icon.className = "nav-icon";
        icon.textContent = module.icon;

        const name =
            document.createElement("span");

        name.textContent = module.name;

        link.append(icon, name);
        navigation.append(link);
    });

    const bottom =
        sidebar.querySelector(".sidebar-bottom");

    if (bottom) {
        sidebar.insertBefore(label, bottom);
        sidebar.insertBefore(navigation, bottom);
    } else {
        sidebar.append(label, navigation);
    }

})();
