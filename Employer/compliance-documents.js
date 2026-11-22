/* =========================================================
   TALVORA MODULE 11
   COMPLIANCE & DOCUMENT MANAGEMENT ENGINE

   FEATURES:
   1. Employment document repository
   2. Document upload and metadata
   3. Country-specific requirements
   4. Document expiry monitoring
   5. Expired document alerts
   6. Expiring document alerts
   7. Verification status tracking
   8. Compliance coverage reporting
   9. Employee and company document references
   10. Document search and filters
   11. Review request workflow
   12. Secure document viewing
========================================================= */

(() => {
    "use strict";

    const shared = window.TALVORA_EMPLOYER || {};

    const $ = id => document.getElementById(id);

    const MAX_FILE_SIZE = 15 * 1024 * 1024;

    const ALLOWED_TYPES = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    const ALLOWED_EXTENSIONS = [
        "pdf",
        "png",
        "jpg",
        "jpeg",
        "docx"
    ];

    const state = {
        documents: [],
        requirements: [],
        overview: {},
        filteredDocuments: [],
        filteredRequirements: [],
        loading: false,
        initialized: false
    };

    /* =====================================================
       1. API CONNECTION
    ===================================================== */

    function getCompanyId() {
        return typeof shared.getCompanyId === "function"
            ? shared.getCompanyId()
            : $("companySwitcher")?.value;
    }

    function companyPath(path) {
        if (typeof shared.companyPath === "function") {
            return shared.companyPath(path);
        }

        const id = getCompanyId();

        if (!id) {
            throw new Error("Select an organization first.");
        }

        return `/api/employer/companies/${encodeURIComponent(id)}${path}`;
    }

    async function request(path, options = {}) {
        if (typeof shared.api === "function") {
            return shared.api(path, options);
        }

        const headers = { ...(options.headers || {}) };

        const config = {
            method: options.method || "GET",
            credentials: "same-origin",
            headers
        };

        if (options.body !== undefined) {
            headers["Content-Type"] = "application/json";
            config.body = JSON.stringify(options.body);
        }

        const response = await fetch(path, config);

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                result.message || `Request failed (${response.status})`
            );
        }

        return result;
    }

    function dataOf(result) {
        return result?.data ?? result ?? {};
    }

    function listOf(result, key) {
        const data = dataOf(result);

        if (Array.isArray(data)) return data;
        if (Array.isArray(data[key])) return data[key];
        if (Array.isArray(data.items)) return data.items;

        return [];
    }

    /* =====================================================
       2. UTILITIES
    ===================================================== */

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function toast(message, type = "info") {
        const region = $("complianceToastRegion");
        if (!region) return;

        const element = document.createElement("div");

        element.className = `toast ${type}`;
        element.textContent = message;

        region.appendChild(element);

        setTimeout(() => element.remove(), 4500);
    }

    function formatDate(value) {
        if (!value) return "—";

        const raw = String(value);

        const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
            ? new Date(`${raw}T00:00:00`)
            : new Date(raw);

        return Number.isNaN(date.getTime())
            ? "—"
            : date.toLocaleDateString();
    }

    function dateOnly(value) {
        if (!value) return null;

        const raw = String(value);

        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            return raw;
        }

        const date = new Date(raw);

        if (Number.isNaN(date.getTime())) return null;

        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");
    }

    function daysUntil(value) {
        const target = dateOnly(value);

        if (!target) return null;

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const expiry = new Date(`${target}T00:00:00`);

        return Math.ceil(
            (expiry.getTime() - now.getTime()) / 86400000
        );
    }

    function today() {
        const date = new Date();

        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");
    }

    function label(value) {
        return String(value || "Not specified")
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());
    }

    function idOf(item) {
        return String(item.id || item._id || "");
    }

    function setConnection(message, status = "") {
        $("complianceConnectionStatus").textContent = message;

        const dot = document.querySelector(
            ".compliance-connection .connection-dot"
        );

        if (dot) {
            dot.className = `connection-dot ${status}`;
        }
    }

    function documentName(item) {
        return item.documentName ||
            item.name ||
            item.title ||
            item.originalFilename ||
            "Untitled Document";
    }

    function documentType(item) {
        return item.documentType ||
            item.type ||
            "other";
    }

    function documentCountry(item) {
        return item.country ||
            item.countryCode ||
            "Not specified";
    }

    function documentOwner(item) {
        return item.employeeName ||
            item.entityName ||
            item.ownerName ||
            item.entityReference ||
            "Organization";
    }

    function documentStatus(item) {
        const status = String(
            item.verificationStatus ||
            item.status ||
            "pending"
        ).toLowerCase();

        if (["rejected", "pending", "verified"].includes(status)) {
            return status;
        }

        const days = daysUntil(item.expiryDate);

        if (days !== null && days < 0) {
            return "expired";
        }

        if (days !== null && days <= 30) {
            return "expiring";
        }

        return "neutral";
    }

    /* =====================================================
       3. LOAD DATA
    ===================================================== */

    async function load() {
        if (state.loading) return;

        if (!getCompanyId()) {
            setConnection(
                "Select an organization to load compliance information.",
                "error"
            );
            return;
        }

        state.loading = true;

        setConnection("Loading compliance records...");

        const endpoints = [
            ["/compliance/documents", "documents"],
            ["/compliance/requirements", "requirements"],
            ["/compliance/overview", "overview"]
        ];

        const results = await Promise.allSettled(
            endpoints.map(([path]) => request(companyPath(path)))
        );

        let successful = 0;

        results.forEach((result, index) => {
            const key = endpoints[index][1];

            if (result.status !== "fulfilled") {
                console.error(
                    `[TALVORA COMPLIANCE] ${key}`,
                    result.reason
                );

                state[key] = key === "overview" ? {} : [];

                return;
            }

            successful++;

            const data = dataOf(result.value);

            if (key === "documents") {
                state.documents = listOf(
                    result.value,
                    "documents"
                );
            }

            if (key === "requirements") {
                state.requirements = listOf(
                    result.value,
                    "requirements"
                );
            }

            if (key === "overview") {
                state.overview = data.overview || data;
            }
        });

        populateFilters();

        state.filteredDocuments = [...state.documents];
        state.filteredRequirements = [...state.requirements];

        renderAll();

        if (successful === endpoints.length) {
            setConnection(
                "Compliance services connected.",
                "connected"
            );
        } else if (successful > 0) {
            setConnection(
                "Some compliance services are unavailable.",
                ""
            );
        } else {
            setConnection(
                "Unable to load compliance information.",
                "error"
            );

            toast(
                "Compliance data could not be retrieved.",
                "error"
            );
        }

        $("complianceUpdated").textContent =
            `Updated ${new Date().toLocaleTimeString()}`;

        state.loading = false;
    }

    /* =====================================================
       4. KPI CALCULATIONS
    ===================================================== */

    function renderKPIs() {
        const verified = state.documents.filter(
            item => documentStatus(item) === "verified"
        ).length;

        const pending = state.documents.filter(
            item => documentStatus(item) === "pending"
        ).length;

        const expired = state.documents.filter(
            item => documentStatus(item) === "expired"
        ).length;

        const expiring = state.documents.filter(
            item => documentStatus(item) === "expiring"
        ).length;

        $("totalDocuments").textContent =
            state.documents.length.toLocaleString();

        $("verifiedDocuments").textContent =
            verified.toLocaleString();

        $("pendingDocuments").textContent =
            pending.toLocaleString();

        $("expiredDocuments").textContent =
            expired.toLocaleString();

        $("expiringDocuments").textContent =
            expiring.toLocaleString();
    }

    /* =====================================================
       5. COMPLIANCE OVERVIEW
    ===================================================== */

    function renderOverview() {
        const overview = state.overview || {};

        const coverage = Number(
            overview.coveragePercentage ??
            overview.complianceCoverage ??
            0
        );

        const safeCoverage = Number.isFinite(coverage)
            ? Math.max(0, Math.min(100, coverage))
            : 0;

        $("complianceCoverage").textContent =
            overview.coveragePercentage !== undefined ||
                overview.complianceCoverage !== undefined
                ? `${safeCoverage.toFixed(1)}%`
                : "—";

        $("complianceCoverageBar").style.width =
            `${safeCoverage}%`;

        $("applicableRequirements").textContent =
            overview.applicableRequirements ?? state.requirements.length;

        $("requirementsMet").textContent =
            overview.requirementsMet ?? state.requirements.filter(
                item => requirementStatus(item) === "met"
            ).length;

        $("complianceIssues").textContent =
            overview.openIssues ??
            state.requirements.filter(item =>
                ["missing", "pending"].includes(requirementStatus(item))
            ).length;

        const status = String(
            overview.status ||
            overview.complianceStatus ||
            "not_assessed"
        ).toLowerCase();

        $("complianceOverallStatus").textContent =
            label(status);

        const allowed = [
            "compliant",
            "attention",
            "non_compliant"
        ];

        $("complianceOverallStatus").className =
            `compliance-badge ${allowed.includes(status) ? status : "neutral"}`;
    }

    /* =====================================================
       6. REQUIREMENTS
    ===================================================== */

    function requirementStatus(item) {
        return String(
            item.status ||
            item.complianceStatus ||
            "pending"
        ).toLowerCase();
    }

    function requirementCountry(item) {
        return item.country ||
            item.countryName ||
            item.countryCode ||
            "Not specified";
    }

    function requirementName(item) {
        return item.requirementName ||
            item.name ||
            item.title ||
            "Unnamed Requirement";
    }

    function populateSelect(id, values, firstLabel) {
        const select = $(id);
        if (!select) return;

        const previous = select.value;

        select.replaceChildren(
            new Option(firstLabel, "")
        );

        [...new Set(values)]
            .filter(Boolean)
            .sort()
            .forEach(value => {
                select.add(new Option(value, value));
            });

        if (values.includes(previous)) {
            select.value = previous;
        }
    }

    function populateFilters() {
        populateSelect(
            "requirementsCountryFilter",
            state.requirements.map(requirementCountry),
            "All Countries"
        );

        populateSelect(
            "documentCountryFilter",
            state.documents.map(documentCountry),
            "All Countries"
        );

        populateSelect(
            "documentTypeFilter",
            state.documents.map(documentType),
            "All Document Types"
        );
    }

    function filterRequirements() {
        const country = $("requirementsCountryFilter").value;

        const status = $("requirementsStatusFilter").value;

        state.filteredRequirements = state.requirements.filter(item => {
            return (!country || requirementCountry(item) === country) &&
                (!status || requirementStatus(item) === status);
        });

        renderRequirements();
    }

    function renderRequirements() {
        const body = $("requirementsTableBody");
        body.replaceChildren();

        if (!state.filteredRequirements.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-cell">
                        No applicable country requirements found.
                    </td>
                </tr>
            `;

            return;
        }

        state.filteredRequirements.forEach(item => {
            const status = requirementStatus(item);

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${escapeHTML(requirementCountry(item))}</td>
                <td><strong>${escapeHTML(requirementName(item))}</strong></td>
                <td>${escapeHTML(label(item.documentType || item.requiredDocumentType || "—"))}</td>
                <td>${escapeHTML(label(item.applicability || "Applicable"))}</td>
                <td>
                    <span class="document-status ${["met", "missing", "pending", "not_applicable"].includes(status)
                    ? status
                    : "neutral"
                }">
                        ${escapeHTML(label(status))}
                    </span>
                </td>
                <td>${escapeHTML(formatDate(item.updatedAt || item.lastUpdated))}</td>
            `;

            body.appendChild(row);
        });
    }

    /* =====================================================
       7. DOCUMENT FILTERS
    ===================================================== */

    function filterDocuments() {
        const query = $("documentSearch").value.trim().toLowerCase();

        const type = $("documentTypeFilter").value;

        const status = $("documentStatusFilter").value;

        const country = $("documentCountryFilter").value;

        state.filteredDocuments = state.documents.filter(item => {
            const searchable = [
                documentName(item),
                documentType(item),
                documentOwner(item),
                documentCountry(item),
                item.reference,
                item.entityReference
            ].join(" ").toLowerCase();

            return (!query || searchable.includes(query)) &&
                (!type || documentType(item) === type) &&
                (!status || documentStatus(item) === status) &&
                (!country || documentCountry(item) === country);
        });

        renderDocuments();
    }

    /* =====================================================
       8. DOCUMENT REGISTER
    ===================================================== */

    function renderDocuments() {
        const body = $("documentTableBody");

        body.replaceChildren();

        const documents = state.filteredDocuments;

        $("documentCountLabel").textContent =
            `${state.documents.length} documents`;

        $("documentTableFooter").textContent =
            `Showing ${documents.length} of ${state.documents.length} documents`;

        if (!documents.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-cell">
                        No matching documents found.
                    </td>
                </tr>
            `;

            return;
        }

        documents.forEach(item => {
            const id = idOf(item);
            const status = documentStatus(item);

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>
                    <span class="document-name">
                        ${escapeHTML(documentName(item))}
                    </span>
                    <span class="document-reference">
                        ${escapeHTML(item.reference || id || "No reference")}
                    </span>
                </td>

                <td>${escapeHTML(label(documentType(item)))}</td>

                <td>${escapeHTML(documentOwner(item))}</td>

                <td>${escapeHTML(documentCountry(item))}</td>

                <td>${escapeHTML(formatDate(item.issueDate))}</td>

                <td>${escapeHTML(formatDate(item.expiryDate))}</td>

                <td>
                    <span class="document-status ${["verified", "pending", "rejected", "expired", "expiring"].includes(status)
                    ? status
                    : "neutral"
                }">
                        ${escapeHTML(label(status))}
                    </span>
                </td>

                <td>
                    <div class="table-actions">
                        <button
                            class="table-action"
                            data-action="view"
                            data-id="${escapeHTML(id)}">
                            Details
                        </button>

                        <button
                            class="table-action"
                            data-action="open"
                            data-id="${escapeHTML(id)}">
                            Open
                        </button>

                        ${status !== "verified"
                    ? `<button class="table-action" data-action="review" data-id="${escapeHTML(id)}">Request Review</button>`
                    : ""}
                    </div>
                </td>
            `;

            body.appendChild(row);
        });
    }

    /* =====================================================
       9. EXPIRY MONITOR
    ===================================================== */

    function renderExpiryMonitor() {
        const container = $("expiryMonitor");

        container.replaceChildren();

        const alerts = state.documents
            .map(item => ({
                item,
                days: daysUntil(item.expiryDate),
                status: documentStatus(item)
            }))
            .filter(entry =>
                ["expired", "expiring"].includes(entry.status)
            )
            .sort((a, b) => a.days - b.days)
            .slice(0, 12);

        if (!alerts.length) {
            const empty = document.createElement("p");

            empty.className = "empty-state";

            empty.textContent =
                "No expired or soon-to-expire documents are recorded.";

            container.appendChild(empty);

            return;
        }

        alerts.forEach(({ item, days, status }) => {
            const card = document.createElement("article");

            card.className = `expiry-item ${status}`;

            const message = days < 0
                ? `Expired ${Math.abs(days)} days ago`
                : days === 0
                    ? "Expires today"
                    : `Expires in ${days} days`;

            card.innerHTML = `
                <strong>${escapeHTML(documentName(item))}</strong>
                <span>${escapeHTML(documentOwner(item))}</span>
                <span>${escapeHTML(documentCountry(item))}</span>
                <small>${escapeHTML(message)}</small>
            `;

            container.appendChild(card);
        });
    }

    /* =====================================================
       10. DOCUMENT DETAILS
    ===================================================== */

    function viewDocument(id) {
        const item = state.documents.find(
            doc => idOf(doc) === String(id)
        );

        if (!item) {
            toast("Document not found.", "error");
            return;
        }

        const container = $("documentDetailsContent");

        container.replaceChildren();

        const fields = [
            ["Document Name", documentName(item)],
            ["Document Type", label(documentType(item))],
            ["Reference", item.reference || id],
            ["Owner", documentOwner(item)],
            ["Country", documentCountry(item)],
            ["Issuing Authority", item.issuingAuthority],
            ["Issue Date", formatDate(item.issueDate)],
            ["Expiry Date", formatDate(item.expiryDate)],
            ["Status", label(documentStatus(item))],
            ["Uploaded", formatDate(item.createdAt || item.uploadedAt)],
            ["Notes", item.notes]
        ];

        fields.forEach(([name, value]) => {
            const row = document.createElement("div");

            row.className = "document-detail-row";

            const heading = document.createElement("span");
            heading.textContent = name;

            const content = document.createElement("strong");
            content.textContent = value || "—";

            row.append(heading, content);

            container.appendChild(row);
        });

        $("documentDetailsDialog").showModal();
    }

    /* =====================================================
       11. OPEN DOCUMENT SECURELY
    ===================================================== */

    function openDocument(id) {
        const item = state.documents.find(
            doc => idOf(doc) === String(id)
        );

        if (!item) return;

        const fileUrl =
            item.downloadUrl ||
            item.fileUrl ||
            item.documentUrl;

        if (!fileUrl) {
            toast("No document viewing URL is available.", "warning");
            return;
        }

        try {
            const url = new URL(fileUrl, window.location.origin);

            if (!["https:", "http:"].includes(url.protocol)) {
                throw new Error("Invalid document URL.");
            }

            window.open(
                url.href,
                "_blank",
                "noopener,noreferrer"
            );

        } catch (error) {
            toast(error.message, "error");
        }
    }

    /* =====================================================
       12. REQUEST DOCUMENT REVIEW
    ===================================================== */

    async function requestReview(id) {
        const item = state.documents.find(
            doc => idOf(doc) === String(id)
        );

        if (!item) return;

        if (!confirm(
            `Submit ${documentName(item)} for compliance review?`
        )) return;

        try {
            await request(
                companyPath(
                    `/compliance/documents/${encodeURIComponent(id)}/review-request`
                ),
                {
                    method: "POST",
                    body: {
                        reason: "Employer requested document verification."
                    }
                }
            );

            toast("Document review request submitted.", "success");

            await load();

        } catch (error) {
            console.error(error);

            toast(
                error.message || "Unable to submit review request.",
                "error"
            );
        }
    }

    /* =====================================================
       13. OPEN UPLOAD DIALOG
    ===================================================== */

    function openUploadDialog() {
        $("documentUploadForm").reset();

        $("uploadDocumentDialog").showModal();
    }

    /* =====================================================
       14. VALIDATE FILE
    ===================================================== */

    function validateFile(file) {
        if (!file) {
            throw new Error("Please select a document file.");
        }

        if (file.size > MAX_FILE_SIZE) {
            throw new Error("Document exceeds the 15 MB upload limit.");
        }

        const extension = file.name
            .split(".")
            .pop()
            .toLowerCase();

        if (!ALLOWED_EXTENSIONS.includes(extension)) {
            throw new Error("Unsupported document file extension.");
        }

        if (file.type && !ALLOWED_TYPES.includes(file.type)) {
            throw new Error("Unsupported document MIME type.");
        }

        return true;
    }

    /* =====================================================
       15. UPLOAD FILE
    ===================================================== */

    async function uploadDocument(event) {
        event.preventDefault();

        const form = $("documentUploadForm");

        if (!form.reportValidity()) return;

        const file = $("documentFile").files[0];

        try {
            validateFile(file);
        } catch (error) {
            toast(error.message, "warning");
            return;
        }

        const values = new FormData(form);

        const issueDate = values.get("issueDate");
        const expiryDate = values.get("expiryDate");

        if (
            issueDate &&
            expiryDate &&
            expiryDate < issueDate
        ) {
            toast(
                "Expiry date cannot be earlier than issue date.",
                "warning"
            );

            return;
        }

        const button = $("uploadDocumentSubmit");

        button.disabled = true;
        button.textContent = "Uploading...";

        try {
            /*
             * Multipart upload.
             * Cookies and CSRF protection are supported.
             * The backend must perform MIME, extension,
             * content and malware validation.
             */

            const headers = {};

            if (typeof shared.getAuthHeaders === "function") {
                Object.assign(headers, shared.getAuthHeaders());
            }

            const csrf = document.querySelector(
                'meta[name="csrf-token"]'
            )?.content;

            if (csrf) {
                headers["X-CSRF-Token"] = csrf;
            }

            const response = await fetch(
                companyPath("/compliance/documents"),
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers,
                    body: values
                }
            );

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    `Document upload failed (${response.status}).`
                );
            }

            $("uploadDocumentDialog").close();

            toast(
                "Document uploaded successfully and submitted for processing.",
                "success"
            );

            await load();

        } catch (error) {
            console.error(
                "[TALVORA DOCUMENT UPLOAD]",
                error
            );

            toast(
                error.message || "Document upload failed.",
                "error"
            );

        } finally {
            button.disabled = false;
            button.textContent = "Upload Document";
        }
    }

    /* =====================================================
       16. RENDER ALL
    ===================================================== */

    function renderAll() {
        renderKPIs();
        renderOverview();
        filterRequirements();
        filterDocuments();
        renderExpiryMonitor();
    }

    /* =====================================================
       17. EVENT BINDING
    ===================================================== */

    function bind() {
        if (state.initialized) return;

        state.initialized = true;

        $("complianceRefresh")?.addEventListener("click", load);

        $("refreshComplianceButton")?.addEventListener("click", load);

        $("uploadDocumentButton")?.addEventListener(
            "click",
            openUploadDialog
        );

        $("documentUploadForm")?.addEventListener(
            "submit",
            uploadDocument
        );

        $("documentSearch")?.addEventListener(
            "input",
            filterDocuments
        );

        [
            "documentTypeFilter",
            "documentStatusFilter",
            "documentCountryFilter"
        ].forEach(id => {
            $(id)?.addEventListener("change", filterDocuments);
        });

        $("requirementsCountryFilter")?.addEventListener(
            "change",
            filterRequirements
        );

        $("requirementsStatusFilter")?.addEventListener(
            "change",
            filterRequirements
        );

        $("clearDocumentFilters")?.addEventListener("click", () => {
            $("documentSearch").value = "";
            $("documentTypeFilter").value = "";
            $("documentStatusFilter").value = "";
            $("documentCountryFilter").value = "";

            filterDocuments();
        });

        $("documentTableBody")?.addEventListener("click", event => {
            const button = event.target.closest("[data-action]");

            if (!button) return;

            const { action, id } = button.dataset;

            if (action === "view") viewDocument(id);

            if (action === "open") openDocument(id);

            if (action === "review") requestReview(id);
        });

        document.querySelectorAll("[data-close]").forEach(button => {
            button.addEventListener("click", () => {
                $(button.dataset.close)?.close();
            });
        });

        $("companySwitcher")?.addEventListener("change", load);
    }

    /* =====================================================
       18. REGISTER MODULE
    ===================================================== */

    const module = {
        load,
        refresh: load,

        getDocuments: () => [
            ...state.documents
        ],

        getRequirements: () => [
            ...state.requirements
        ],

        getOverview: () => ({
            ...state.overview
        }),

        openUpload: openUploadDialog,

        viewDocument
    };

    if (typeof shared.registerModule === "function") {
        shared.registerModule(
            "compliance-documents",
            module
        );
    }

    window.TALVORA_COMPLIANCE = module;

    /* =====================================================
       19. INITIALIZATION
    ===================================================== */

    function initialize() {
        bind();
        load();
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