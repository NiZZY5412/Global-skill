
(() => {
    "use strict";

    /* =========================================
       TALVORA GLOBAL KYC / KYB CONFIGURATION
    ========================================= */

    const DEFAULT_ENDPOINTS = {
        dashboard: "/api/kyc/dashboard",
        reference: "/api/kyc/reference-data",
        individuals: "/api/kyc/individuals",
        businesses: "/api/kyc/businesses",
        verifications: "/api/kyc/verifications",
        documents: "/api/kyc/documents",
        documentUpload: "/api/kyc/documents/upload",
        beneficialOwners: "/api/kyc/beneficial-owners",
        reviews: "/api/kyc/reviews",
        appeals: "/api/kyc/appeals",
        audit: "/api/kyc/audit",
        exports: "/api/kyc/exports"
    };

    const config = window.TALVORA_ADMIN_CONFIG || {};

    const base = String(config.apiBaseUrl || "").replace(/\/+$/, "");

    const endpoints = {
        ...DEFAULT_ENDPOINTS,
        ...(config.kycEndpoints || {})
    };

    const $ = id => document.getElementById(id);

    const state = {
        section: "overview",
        jurisdictions: [],
        pendingAction: null,
        refreshTimer: null
    };

    /* =========================================
       GENERAL UTILITIES
    ========================================= */

    function esc(value) {
        return String(value ?? "—").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function dataOf(payload) {
        return payload?.data ?? payload ?? {};
    }

    function records(payload, ...keys) {
        const data = dataOf(payload);

        if (Array.isArray(data)) return data;

        for (const key of keys) {
            if (Array.isArray(data?.[key])) {
                return data[key];
            }
        }

        return [];
    }

    function first(object, ...keys) {
        for (const key of keys) {
            if (
                object?.[key] !== undefined &&
                object[key] !== null
            ) {
                return object[key];
            }
        }

        return undefined;
    }

    function query(params = {}) {
        const search = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (
                value !== "" &&
                value !== null &&
                value !== undefined
            ) {
                search.set(key, value);
            }
        });

        const result = search.toString();

        return result ? `?${result}` : "";
    }

    function url(path) {
        return base + (path.startsWith("/") ? path : `/${path}`);
    }

    function date(value) {
        if (!value) return "—";

        const parsed = new Date(value);

        if (Number.isNaN(parsed.getTime())) {
            return esc(value);
        }

        return new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(parsed);
    }

    function badge(value) {
        const status = String(value || "unknown")
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "_");

        const label = String(value || "Unknown")
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());

        return `
      <span class="badge ${esc(status)}">
        ${esc(label)}
      </span>
    `;
    }

    function empty(columns, message) {
        return `
      <tr>
        <td colspan="${columns}" class="empty-state">
          ${esc(message)}
        </td>
      </tr>
    `;
    }

    function metric(id, value) {
        const element = $(id);

        if (!element) return;

        element.textContent =
            value === null || value === undefined
                ? "—"
                : typeof value === "number"
                    ? value.toLocaleString()
                    : String(value);
    }

    function toast(message, type = "info") {
        const region = $("toastRegion");

        if (!region) return;

        const element = document.createElement("div");

        element.className = `toast ${type}`;
        element.textContent = message;

        region.appendChild(element);

        setTimeout(() => element.remove(), 5000);
    }

    function setStatus(status, label) {
        const element = $("apiStatus");

        if (!element) return;

        element.className = `api-status ${status}`;

        element.innerHTML = `
      <i></i>
      ${esc(label)}
    `;
    }

    function debounce(callback, delay = 350) {
        let timer;

        return (...args) => {
            clearTimeout(timer);

            timer = setTimeout(() => {
                callback(...args).catch(error => {
                    toast(error.message, "error");
                });
            }, delay);
        };
    }

    function idempotencyHeaders() {
        if (!window.crypto?.randomUUID) {
            throw new Error(
                "Secure request identification is unavailable in this browser."
            );
        }

        return {
            "Idempotency-Key": window.crypto.randomUUID()
        };
    }

    /* =========================================
       CENTRAL API CLIENT
    ========================================= */

    async function api(path, options = {}) {
        const controller = new AbortController();

        const timeout = setTimeout(
            () => controller.abort(),
            Number(config.timeout) || 30000
        );

        const headers = new Headers(options.headers || {});

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
            headers.set("Content-Type", "application/json");
            body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url(path), {
                ...options,
                headers,
                body,
                credentials: "include",
                cache: "no-store",
                signal: controller.signal
            });

            if (!response.ok) {
                let message = `Request failed (${response.status})`;

                try {
                    const error = await response.json();

                    message =
                        error.message ||
                        error.detail ||
                        error.error ||
                        message;
                } catch { }

                if (response.status === 401) {
                    setStatus("error", "Authentication required");
                }

                if (response.status === 403) {
                    message = "You are not authorized to perform this operation.";
                }

                if (response.status === 409) {
                    message = "This request conflicts with the current record state.";
                }

                throw new Error(message);
            }

            if (response.status === 204) return null;

            const contentType =
                response.headers.get("content-type") || "";

            return contentType.includes("application/json")
                ? response.json()
                : response.text();

        } finally {
            clearTimeout(timeout);
        }
    }

    /* =========================================
       REFERENCE DATA
    ========================================= */

    function setOptions(
        id,
        items,
        valueFn,
        labelFn,
        placeholder
    ) {
        const element = $(id);

        if (!element) return;

        const current = element.value;

        element.innerHTML =
            `<option value="">${esc(placeholder)}</option>` +
            items.map(item => {
                const value = valueFn(item);

                if (
                    value === undefined ||
                    value === null ||
                    value === ""
                ) {
                    return "";
                }

                return `
          <option value="${esc(value)}">
            ${esc(labelFn(item))}
          </option>
        `;
            }).join("");

        if ([...element.options].some(option => option.value === current)) {
            element.value = current;
        }
    }

    async function loadReferenceData() {
        const payload = await api(endpoints.reference);

        const data = dataOf(payload);

        state.jurisdictions = records(
            data,
            "jurisdictions",
            "countries"
        );

        const valueFn = item =>
            item.code ||
            item.countryCode ||
            item.country_code ||
            item.id;

        const labelFn = item =>
            `${item.name || item.countryName || "Jurisdiction"} (${valueFn(item) || ""})`;

        const jurisdictionFields = [
            "verifyJurisdiction",
            "documentJurisdiction",
            "ownerJurisdiction",
            "individualJurisdiction",
            "businessJurisdiction"
        ];

        jurisdictionFields.forEach(id => {
            setOptions(
                id,
                state.jurisdictions,
                valueFn,
                labelFn,
                "All jurisdictions"
            );
        });
    }

    /* =========================================
       DASHBOARD
    ========================================= */

    function normalizeDistribution(value) {
        if (Array.isArray(value)) return value;

        if (value && typeof value === "object") {
            return Object.entries(value).map(([name, count]) => ({
                name,
                count
            }));
        }

        return [];
    }

    function renderDistribution(target, values) {
        const element = $(target);

        if (!element) return;

        const items = normalizeDistribution(values);

        if (!items.length) {
            element.innerHTML =
                '<p class="muted">No distribution information returned.</p>';
            return;
        }

        const maximum = Math.max(
            1,
            ...items.map(item =>
                Number(item.count ?? item.total ?? 0)
            )
        );

        element.innerHTML = items.map(item => {
            const name = String(
                item.name || item.status || item.riskLevel || "Unknown"
            ).toLowerCase();

            const count = Number(item.count ?? item.total ?? 0);

            const percentage = Math.max(
                0,
                Math.min(100, count / maximum * 100)
            );

            const safeClass = name.replace(
                /[^a-z0-9_-]/g,
                "_"
            );

            return `
        <div class="distribution-row">

          <span class="distribution-label">
            ${esc(name.replace(/[_-]/g, " "))}
          </span>

          <div class="distribution-track">
            <div
              class="distribution-fill ${esc(safeClass)}"
              style="width:${percentage}%"
            ></div>
          </div>

          <span class="distribution-count">
            ${esc(count)}
          </span>

        </div>
      `;
        }).join("");
    }

    async function loadOverview() {
        const results = await Promise.allSettled([
            api(endpoints.dashboard),

            api(endpoints.verifications + query({
                pageSize: 8,
                limit: 8
            })),

            api(endpoints.reviews + query({
                pageSize: 8,
                limit: 8,
                priority: "high"
            }))
        ]);

        let successful = 0;

        /* Dashboard metrics */

        if (results[0].status === "fulfilled") {
            successful++;

            const data = dataOf(results[0].value);

            const summary =
                data.metrics ||
                data.summary ||
                data;

            metric(
                "mIndividuals",
                first(summary, "individualProfiles", "individual_profiles")
            );

            metric(
                "mBusinesses",
                first(summary, "businessProfiles", "business_profiles")
            );

            metric(
                "mPending",
                first(summary, "pendingVerifications", "pending_verifications")
            );

            metric(
                "mHighRisk",
                first(summary, "highRiskProfiles", "high_risk_profiles")
            );

            metric(
                "mDocuments",
                first(summary, "documentsAwaitingReview", "documents_awaiting_review")
            );

            metric(
                "mOwners",
                first(summary, "beneficialOwnershipReviews", "beneficial_ownership_reviews")
            );

            metric(
                "mReviews",
                first(summary, "activeEDDReviews", "active_edd_reviews")
            );

            metric(
                "mAppeals",
                first(summary, "pendingAppeals", "pending_appeals")
            );

            renderDistribution(
                "verificationDistribution",
                first(
                    data,
                    "verificationDistribution",
                    "verification_distribution"
                )
            );

            renderDistribution(
                "riskDistribution",
                first(
                    data,
                    "riskDistribution",
                    "risk_distribution"
                )
            );
        }

        /* Recent verification queue */

        if (results[1].status === "fulfilled") {
            successful++;

            renderQueue(
                records(
                    results[1].value,
                    "verifications",
                    "requests",
                    "records",
                    "items"
                ),
                "dashboardQueue",
                true
            );
        }

        /* Priority reviews */

        if (results[2].status === "fulfilled") {
            successful++;

            renderReviews(
                records(
                    results[2].value,
                    "reviews",
                    "records",
                    "items"
                ),
                "dashboardReviews",
                true
            );
        }

        setStatus(
            successful ? "connected" : "error",
            successful ? "Connected" : "Unavailable"
        );
    }

    /* =========================================
       INDIVIDUAL KYC
    ========================================= */

    function renderIndividuals(items) {
        const element = $("individualTable");

        if (!element) return;

        element.innerHTML = items.length
            ? items.map(item => `
          <tr>

            <td>
              ${esc(item.reference || item.profileReference || item.id)}
            </td>

            <td>
              ${esc(
                item.maskedName ||
                item.displayNameMasked ||
                item.displayReference ||
                item.reference ||
                "Restricted"
            )}
            </td>

            <td>
              ${esc(item.jurisdiction || item.countryCode || "—")}
            </td>

            <td>
              ${badge(item.kycStatus || item.verificationStatus)}
            </td>

            <td>
              ${badge(item.riskLevel || item.riskClassification)}
            </td>

            <td>
              ${esc(date(item.lastVerified || item.lastReview))}
            </td>

            <td>
              ${esc(date(item.nextReview || item.nextReviewDate))}
            </td>

            <td>
              <button
                data-detail="individuals"
                data-id="${esc(item.id)}"
              >Inspect</button>

              <button
                data-action="request-reverification"
                data-id="${esc(item.id)}"
              >Re-verify</button>

              <button
                data-action="request-risk-review"
                data-id="${esc(item.id)}"
              >Risk review</button>
            </td>

          </tr>
        `).join("")
            : empty(8, "No individual KYC records returned.");
    }

    async function loadIndividuals() {
        const payload = await api(endpoints.individuals + query({
            search: $("individualSearch")?.value?.trim(),
            status: $("individualStatus")?.value,
            riskLevel: $("individualRisk")?.value,
            jurisdiction: $("individualJurisdiction")?.value,
            pageSize: 100
        }));

        renderIndividuals(
            records(payload, "individuals", "profiles", "records", "items")
        );
    }

    /* =========================================
       BUSINESS KYB
    ========================================= */

    function renderBusinesses(items) {
        const element = $("businessTable");

        if (!element) return;

        element.innerHTML = items.length
            ? items.map(item => `
          <tr>

            <td>
              ${esc(item.reference || item.businessReference || item.id)}
            </td>

            <td>
              ${esc(item.legalName || item.businessName || item.displayName)}
            </td>

            <td>
              ${esc(item.jurisdiction || item.countryCode || "—")}
            </td>

            <td>
              ${esc(item.registrationReference || item.registrationNumberMasked || "—")}
            </td>

            <td>
              ${badge(item.kybStatus || item.verificationStatus)}
            </td>

            <td>
              ${badge(item.riskLevel || item.riskClassification)}
            </td>

            <td>
              ${esc(item.beneficialOwnerCount ?? item.beneficial_owner_count ?? "—")}
            </td>

            <td>
              <button
                data-detail="businesses"
                data-id="${esc(item.id)}"
              >Inspect</button>

              <button
                data-action="request-kyb-refresh"
                data-id="${esc(item.id)}"
              >Re-verify</button>

              <button
                data-action="request-ownership-review"
                data-id="${esc(item.id)}"
              >Ownership review</button>
            </td>

          </tr>
        `).join("")
            : empty(8, "No business KYB records returned.");
    }

    async function loadBusinesses() {
        const payload = await api(endpoints.businesses + query({
            search: $("businessSearch")?.value?.trim(),
            status: $("businessStatus")?.value,
            riskLevel: $("businessRisk")?.value,
            jurisdiction: $("businessJurisdiction")?.value,
            pageSize: 100
        }));

        renderBusinesses(
            records(payload, "businesses", "companies", "records", "items")
        );
    }

    /* =========================================
       VERIFICATION QUEUE
    ========================================= */

    function renderQueue(
        items,
        target = "queueTable",
        recent = false
    ) {
        const element = $(target);

        if (!element) return;

        element.innerHTML = items.length
            ? items.map(item => `
          <tr>

            <td>
              ${esc(item.reference || item.verificationReference || item.id)}
            </td>

            <td>
              ${esc(item.subjectType || item.subject_type)}
            </td>

            <td>
              ${esc(item.subjectReference || item.subject_reference || "—")}
            </td>

            <td>
              ${esc(item.verificationType || item.type)}
            </td>

            <td>
              ${esc(item.jurisdiction || item.country || "—")}
            </td>

            <td>
              ${badge(item.priority)}
            </td>

            ${recent ? "" : `
              <td>
                ${esc(item.assignedTo || item.assignee || "Unassigned")}
              </td>
            `}

            <td>
              ${esc(date(item.submittedAt || item.createdAt || item.created_at))}
            </td>

            <td>
              ${badge(item.status)}
            </td>

            ${recent ? "" : `
              <td>

                <button
                  data-detail="verifications"
                  data-id="${esc(item.id)}"
                >Inspect</button>

                <button
                  data-action="request-verification-approval"
                  data-id="${esc(item.id)}"
                >Review</button>

                <button
                  data-action="request-additional-information"
                  data-id="${esc(item.id)}"
                >Request info</button>

                <button
                  data-action="escalate-verification"
                  data-id="${esc(item.id)}"
                >Escalate</button>

              </td>
            `}

          </tr>
        `).join("")
            : empty(recent ? 7 : 10, "No verification requests returned.");
    }

    async function loadQueue() {
        const payload = await api(endpoints.verifications + query({
            search: $("queueSearch")?.value?.trim(),
            subjectType: $("queueSubjectType")?.value,
            status: $("queueStatus")?.value,
            priority: $("queuePriority")?.value,
            pageSize: 100
        }));

        renderQueue(
            records(payload, "verifications", "requests", "records", "items")
        );
    }

    async function createVerification(form) {
        const button = $("verifySubmit");

        button.disabled = true;
        button.textContent = "Submitting request...";

        try {
            const values = Object.fromEntries(
                new FormData(form).entries()
            );

            await api(endpoints.verifications, {
                method: "POST",
                headers: idempotencyHeaders(),
                body: {
                    subjectType: values.subjectType,
                    subjectReference: values.subjectReference.trim(),
                    verificationType: values.verificationType,
                    jurisdiction: values.jurisdiction,
                    priority: values.priority,
                    reason: values.reason.trim(),
                    source: "talvora_global_kyc"
                }
            });

            $("verifyModal").hidden = true;
            form.reset();

            toast("Verification request submitted.", "success");

            await Promise.allSettled([
                loadQueue(),
                loadOverview()
            ]);

        } catch (error) {
            toast(`Verification request failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Submit Verification Request";
        }
    }

    /* =========================================
       DOCUMENT MANAGEMENT
    ========================================= */

    function renderDocuments(items) {
        const element = $("documentTable");

        if (!element) return;

        element.innerHTML = items.length
            ? items.map(item => `
          <tr>

            <td>
              ${esc(item.reference || item.documentReference || item.id)}
            </td>

            <td>
              ${esc(item.subjectReference || item.subject_reference)}
            </td>

            <td>
              ${esc(item.documentType || item.type)}
            </td>

            <td>
              ${esc(item.issuingJurisdiction || item.jurisdiction || "—")}
            </td>

            <td>
              ${esc(date(item.submittedAt || item.createdAt))}
            </td>

            <td>
              ${esc(date(item.expiryDate || item.expiry_date))}
            </td>

            <td>
              ${badge(item.status || item.reviewStatus)}
            </td>

            <td>

              <button
                data-detail="documents"
                data-id="${esc(item.id)}"
              >Inspect</button>

              <button
                data-action="request-document-review"
                data-id="${esc(item.id)}"
              >Review</button>

              <button
                data-action="flag-document"
                data-id="${esc(item.id)}"
              >Flag</button>

            </td>

          </tr>
        `).join("")
            : empty(8, "No document records returned.");
    }

    async function loadDocuments() {
        const payload = await api(endpoints.documents + query({
            search: $("documentSearch")?.value?.trim(),
            type: $("documentType")?.value,
            status: $("documentStatus")?.value,
            pageSize: 100
        }));

        renderDocuments(
            records(payload, "documents", "records", "items")
        );
    }

    function validateDocument(file) {
        if (!file) {
            throw new Error("Select a document before uploading.");
        }

        const allowedExtensions = [
            "pdf",
            "png",
            "jpg",
            "jpeg"
        ];

        const extension = file.name
            .split(".")
            .pop()
            .toLowerCase();

        if (!allowedExtensions.includes(extension)) {
            throw new Error("Only PDF, PNG and JPEG files are permitted.");
        }

        if (file.size <= 0) {
            throw new Error("The selected document is empty.");
        }

        const maxSize = 10 * 1024 * 1024;

        if (file.size > maxSize) {
            throw new Error("The document exceeds the 10 MB upload limit.");
        }

        const allowedMimeTypes = [
            "application/pdf",
            "image/png",
            "image/jpeg"
        ];

        if (
            file.type &&
            !allowedMimeTypes.includes(file.type)
        ) {
            throw new Error("The document MIME type is not supported.");
        }
    }

    async function uploadDocument(form) {
        const button = $("uploadSubmit");

        button.disabled = true;
        button.textContent = "Uploading securely...";

        try {
            const formData = new FormData(form);

            const file = formData.get("file");

            validateDocument(file);

            const response = await api(endpoints.documentUpload, {
                method: "POST",
                headers: idempotencyHeaders(),
                body: formData
            });

            $("documentModal").hidden = true;
            form.reset();

            toast("Document uploaded for verification.", "success");

            await Promise.allSettled([
                loadDocuments(),
                loadOverview()
            ]);

            return response;

        } catch (error) {
            toast(`Document upload failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Upload Securely";
        }
    }

    /* =========================================
       BENEFICIAL OWNERSHIP / UBO
    ========================================= */

    function renderOwners(items) {
        const element = $("ownerTable");

        if (!element) return;

        element.innerHTML = items.length
            ? items.map(item => `
          <tr>

            <td>
              ${esc(item.reference || item.ownershipReference || item.id)}
            </td>

            <td>
              ${esc(item.businessReference || item.business_reference)}
            </td>

            <td>
              ${esc(item.maskedOwnerReference || item.ownerReference || "Restricted")}
            </td>

            <td>
              ${esc(item.ownershipPercentage ?? item.ownership_percentage ?? "—")}%
            </td>

            <td>
              ${esc(item.controlType || item.control_type)}
            </td>

            <td>
              ${esc(item.jurisdiction || "—")}
            </td>

            <td>
              ${badge(item.status || item.verificationStatus)}
            </td>

            <td>

              <button
                data-detail="beneficialOwners"
                data-id="${esc(item.id)}"
              >Inspect</button>

              <button
                data-action="request-owner-verification"
                data-id="${esc(item.id)}"
              >Verify</button>

              <button
                data-action="flag-ownership"
                data-id="${esc(item.id)}"
              >Flag</button>

            </td>

          </tr>
        `).join("")
            : empty(8, "No beneficial ownership records returned.");
    }

    async function loadOwners() {
        const payload = await api(endpoints.beneficialOwners + query({
            search: $("ownerSearch")?.value?.trim(),
            status: $("ownerStatus")?.value,
            controlType: $("ownerType")?.value,
            pageSize: 100
        }));

        renderOwners(
            records(payload, "beneficialOwners", "owners", "records", "items")
        );
    }

    async function createOwner(form) {
        const button = $("ownerSubmit");

        button.disabled = true;
        button.textContent = "Registering record...";

        try {
            const values = Object.fromEntries(
                new FormData(form).entries()
            );

            const percentage = Number(values.ownershipPercentage);

            if (
                !Number.isFinite(percentage) ||
                percentage <= 0 ||
                percentage > 100
            ) {
                throw new Error("Enter an ownership percentage between 0.01 and 100.");
            }

            await api(endpoints.beneficialOwners, {
                method: "POST",
                headers: idempotencyHeaders(),
                body: {
                    businessReference: values.businessReference.trim(),
                    ownerReference: values.ownerReference.trim(),
                    ownershipPercentage: percentage,
                    controlType: values.controlType,
                    jurisdiction: values.jurisdiction,
                    description: values.description.trim(),
                    source: "talvora_global_kyc"
                }
            });

            $("ownerModal").hidden = true;
            form.reset();

            toast("Ownership record submitted for verification.", "success");

            await Promise.allSettled([
                loadOwners(),
                loadOverview()
            ]);

        } catch (error) {
            toast(`Ownership registration failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Register Ownership Record";
        }
    }

    /* =========================================
       RISK AND EDD REVIEWS
    ========================================= */

    function renderReviews(
        items,
        target = "reviewTable",
        recent = false
    ) {
        const element = $(target);

        if (!element) return;

        element.innerHTML = items.length
            ? items.map(item => `
          <tr>

            <td>
              ${esc(item.reference || item.reviewReference || item.id)}
            </td>

            <td>
              ${esc(item.subjectReference || item.subject_reference)}
            </td>

            <td>
              ${esc(item.reviewType || item.type)}
            </td>

            <td>
              ${badge(item.riskLevel || item.riskClassification)}
            </td>

            <td>
              ${esc(item.jurisdiction || item.country || "—")}
            </td>

            <td>
              ${esc(item.assignedTo || item.assignee || "Unassigned")}
            </td>

            <td>
              ${recent ? "" : esc(date(item.createdAt || item.created_at))}
            </td>

            <td>
              ${badge(item.status)}
            </td>

            ${recent ? "" : `
              <td>

                <button
                  data-detail="reviews"
                  data-id="${esc(item.id)}"
                >Inspect</button>

                <button
                  data-action="request-review-approval"
                  data-id="${esc(item.id)}"
                >Review</button>

                <button
                  data-action="escalate-review"
                  data-id="${esc(item.id)}"
                >Escalate</button>

              </td>
            `}

          </tr>
        `).join("")
            : empty(recent ? 7 : 9, "No risk review records returned.");
    }

    async function loadReviews() {
        const payload = await api(endpoints.reviews + query({
            search: $("reviewSearch")?.value?.trim(),
            type: $("reviewType")?.value,
            riskLevel: $("reviewRisk")?.value,
            status: $("reviewStatus")?.value,
            pageSize: 100
        }));

        renderReviews(
            records(payload, "reviews", "assessments", "records", "items")
        );
    }

    /* =========================================
       VERIFICATION APPEALS
    ========================================= */

    function renderAppeals(items) {
        const element = $("appealTable");

        if (!element) return;

        element.innerHTML = items.length
            ? items.map(item => `
          <tr>

            <td>
              ${esc(item.reference || item.appealReference || item.id)}
            </td>

            <td>
              ${esc(item.subjectType || item.subject_type)}
            </td>

            <td>
              ${esc(item.subjectReference || item.subject_reference)}
            </td>

            <td>
              ${esc(item.decisionReference || item.decision_reference)}
            </td>

            <td>
              ${esc(item.reason || item.appealReason || "—")}
            </td>

            <td>
              ${esc(date(item.submittedAt || item.createdAt))}
            </td>

            <td>
              ${esc(item.assignedTo || item.assignee || "Unassigned")}
            </td>

            <td>
              ${badge(item.status)}
            </td>

            <td>

              <button
                data-detail="appeals"
                data-id="${esc(item.id)}"
              >Inspect</button>

              <button
                data-action="request-appeal-review"
                data-id="${esc(item.id)}"
              >Review</button>

            </td>

          </tr>
        `).join("")
            : empty(9, "No verification appeals returned.");
    }

    async function loadAppeals() {
        const payload = await api(endpoints.appeals + query({
            search: $("appealSearch")?.value?.trim(),
            status: $("appealStatus")?.value,
            pageSize: 100
        }));

        renderAppeals(
            records(payload, "appeals", "records", "items")
        );
    }

    async function createAppeal(form) {
        const button = $("appealSubmit");

        button.disabled = true;
        button.textContent = "Submitting appeal...";

        try {
            const values = Object.fromEntries(
                new FormData(form).entries()
            );

            await api(endpoints.appeals, {
                method: "POST",
                headers: idempotencyHeaders(),
                body: {
                    subjectType: values.subjectType,
                    subjectReference: values.subjectReference.trim(),
                    decisionReference: values.decisionReference.trim(),
                    reason: values.reason.trim(),
                    evidenceReference: values.evidenceReference.trim() || null,
                    source: "talvora_global_kyc"
                }
            });

            $("appealModal").hidden = true;
            form.reset();

            toast("Verification appeal registered.", "success");

            await Promise.allSettled([
                loadAppeals(),
                loadOverview()
            ]);

        } catch (error) {
            toast(`Appeal submission failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Submit Appeal";
        }
    }

    /* =========================================
       AUDIT AND GOVERNANCE
    ========================================= */

    function renderAudit(items) {
        const element = $("auditTable");

        if (!element) return;

        element.innerHTML = items.length
            ? items.map(item => `
          <tr>

            <td>
              ${esc(item.reference || item.id)}
            </td>

            <td>
              ${esc(item.actorName || item.actor || "—")}
            </td>

            <td>
              ${esc(item.action || item.operation)}
            </td>

            <td>
              ${esc(item.resource || item.resourceReference || "—")}
            </td>

            <td>
              ${esc(item.reason || "—")}
            </td>

            <td>
              ${esc(item.jurisdiction || "—")}
            </td>

            <td>
              ${esc(date(item.createdAt || item.timestamp))}
            </td>

            <td>
              ${badge(item.result || item.status)}
            </td>

          </tr>
        `).join("")
            : empty(8, "No verification audit records returned.");
    }

    async function loadAudit() {
        const payload = await api(endpoints.audit + query({
            search: $("auditSearch")?.value?.trim(),
            pageSize: 100
        }));

        renderAudit(
            records(payload, "audit", "records", "items")
        );
    }

    /* =========================================
       ACTION WORKFLOW CONFIGURATION
    ========================================= */

    const RESOURCE_ENDPOINTS = {
        individuals: endpoints.individuals,
        businesses: endpoints.businesses,
        verifications: endpoints.verifications,
        documents: endpoints.documents,
        beneficialOwners: endpoints.beneficialOwners,
        reviews: endpoints.reviews,
        appeals: endpoints.appeals
    };

    const ACTION_MAP = {
        "request-reverification": "individuals",
        "request-risk-review": "individuals",

        "request-kyb-refresh": "businesses",
        "request-ownership-review": "businesses",

        "request-verification-approval": "verifications",
        "request-additional-information": "verifications",
        "escalate-verification": "verifications",

        "request-document-review": "documents",
        "flag-document": "documents",

        "request-owner-verification": "beneficialOwners",
        "flag-ownership": "beneficialOwners",

        "request-review-approval": "reviews",
        "escalate-review": "reviews",

        "request-appeal-review": "appeals"
    };

    const ACTION_DESCRIPTIONS = {
        "request-reverification":
            "Submit this individual profile for a new identity verification assessment.",

        "request-risk-review":
            "Request a reassessment of the individual's identity risk classification.",

        "request-kyb-refresh":
            "Request an updated corporate identity and business verification assessment.",

        "request-ownership-review":
            "Request an examination of the business ownership structure and supporting evidence.",

        "request-verification-approval":
            "Submit this verification request for authorized review and decision.",

        "request-additional-information":
            "Request additional documentation or information from the relevant subject.",

        "escalate-verification":
            "Escalate the verification request to the designated senior authority.",

        "request-document-review":
            "Request a controlled examination of this identity document.",

        "flag-document":
            "Flag the document for further authenticity, quality or consistency examination.",

        "request-owner-verification":
            "Submit the beneficial owner record for identity and ownership verification.",

        "flag-ownership":
            "Flag this ownership record for further investigation and supporting evidence.",

        "request-review-approval":
            "Submit the risk assessment for independent review and authorized approval.",

        "escalate-review":
            "Escalate this enhanced due diligence or risk assessment case.",

        "request-appeal-review":
            "Request independent reconsideration of the verification decision."
    };

    function requestAction(resource, id, action) {
        state.pendingAction = {
            resource,
            id,
            action
        };

        $("actionTitle").textContent = action
            .replace(/-/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());

        $("actionDescription").textContent =
            ACTION_DESCRIPTIONS[action] ||
            "This operation requires documented authorization.";

        $("actionReason").value = "";
        $("actionEvidence").value = "";

        $("actionSubmit").disabled = true;

        $("actionModal").hidden = false;
    }

    async function submitAction() {
        const pending = state.pendingAction;

        const reason = $("actionReason").value.trim();

        if (!pending || reason.length < 10) return;

        const button = $("actionSubmit");

        button.disabled = true;
        button.textContent = "Submitting...";

        try {
            const resource = RESOURCE_ENDPOINTS[pending.resource];

            if (!resource) {
                throw new Error("Unsupported verification operation.");
            }

            await api(
                `${resource}/${encodeURIComponent(pending.id)}/actions`,
                {
                    method: "POST",
                    headers: idempotencyHeaders(),
                    body: {
                        action: pending.action,
                        reason,
                        evidenceReference:
                            $("actionEvidence").value.trim() || null,
                        source: "talvora_global_kyc"
                    }
                }
            );

            $("actionModal").hidden = true;

            state.pendingAction = null;

            toast("Verification workflow request submitted.", "success");

            await Promise.allSettled([
                loaders[state.section]?.(),
                loadOverview()
            ]);

        } catch (error) {
            toast(`Verification action failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Submit Request";
        }
    }

    /* =========================================
       CONTROLLED RECORD DETAILS
    ========================================= */

    const SENSITIVE_FIELDS =
        /password|secret|token|credential|private.?key|access.?key|full.?name|first.?name|last.?name|subject.?name|email|phone|mobile|date.?of.?birth|dob|passport.?number|national.?id|identity.?number|tax.?id|account.?number|iban|card.?number|home.?address|residential.?address|document.?url|file.?url|storage.?key|signed.?url|raw.?payload|biometric/i;

    async function openDetail(resourceType, id) {
        const resource = RESOURCE_ENDPOINTS[resourceType];

        if (!resource) return;

        try {
            const payload = await api(
                `${resource}/${encodeURIComponent(id)}`
            );

            const record = dataOf(payload);

            $("detailTitle").textContent =
                `${resourceType.replace(/([A-Z])/g, " $1").toUpperCase()} — ${record.reference || record.id || id}`;

            const fields = Object.entries(record)
                .filter(([key, value]) =>
                    !SENSITIVE_FIELDS.test(key) &&
                    value !== null &&
                    value !== undefined &&
                    typeof value !== "object"
                );

            $("detailBody").innerHTML = fields.length
                ? fields.map(([key, value]) => `
            <div class="detail-row">
              <span>${esc(key.replace(/([A-Z])/g, " $1"))}</span>
              <strong>${esc(value)}</strong>
            </div>
          `).join("")
                : `
            <p class="muted">
              No additional non-sensitive record details returned.
            </p>
          `;

            $("detailModal").hidden = false;

        } catch (error) {
            toast(`Unable to retrieve record: ${error.message}`, "error");
        }
    }

    /* =========================================
       AUDIT EXPORT
    ========================================= */

    async function exportAudit() {
        try {
            const csrf = document.querySelector(
                'meta[name="csrf-token"]'
            )?.content;

            const response = await fetch(
                url(endpoints.exports + query({
                    type: "kyc_audit",
                    format: "csv"
                })),
                {
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        "Accept": "text/csv",
                        ...(csrf ? { "X-CSRF-Token": csrf } : {})
                    }
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Audit export failed (${response.status})`
                );
            }

            const blob = await response.blob();

            const objectUrl = URL.createObjectURL(blob);

            const link = document.createElement("a");

            link.href = objectUrl;
            link.download = "talvora-kyc-verification-audit.csv";

            document.body.appendChild(link);

            link.click();

            link.remove();

            setTimeout(() => {
                URL.revokeObjectURL(objectUrl);
            }, 1000);

            toast("Verification audit export generated.", "success");

        } catch (error) {
            toast(error.message, "error");
        }
    }

    /* =========================================
       NAVIGATION
    ========================================= */

    const loaders = {
        overview: loadOverview,
        individuals: loadIndividuals,
        businesses: loadBusinesses,
        queue: loadQueue,
        documents: loadDocuments,
        ownership: loadOwners,
        reviews: loadReviews,
        appeals: loadAppeals,
        audit: loadAudit
    };

    async function navigate(section) {
        if (!loaders[section]) return;

        state.section = section;

        document.querySelectorAll(".kyc-section").forEach(element => {
            element.classList.toggle(
                "active",
                element.id === section
            );
        });

        document.querySelectorAll(".nav-link").forEach(element => {
            element.classList.toggle(
                "active",
                element.dataset.section === section
            );
        });

        $("sidebar")?.classList.remove("open");

        try {
            await loaders[section]();
        } catch (error) {
            toast(error.message, "error");
        }
    }

    /* =========================================
       EVENT BINDINGS
    ========================================= */

    function bindEvents() {

        /* Main navigation */

        document.querySelectorAll("[data-section]").forEach(link => {
            link.addEventListener("click", event => {
                event.preventDefault();

                navigate(link.dataset.section);
            });
        });

        /* Dashboard navigation buttons */

        document.querySelectorAll("[data-navigate]").forEach(button => {
            button.addEventListener("click", () => {
                navigate(button.dataset.navigate);
            });
        });

        /* Open modals */

        document.querySelectorAll("[data-open]").forEach(button => {
            button.addEventListener("click", () => {
                const modal = $(button.dataset.open);

                if (modal) {
                    modal.hidden = false;
                }
            });
        });

        /* Close modals */

        document.querySelectorAll("[data-close]").forEach(button => {
            button.addEventListener("click", () => {
                button.closest(".overlay").hidden = true;
            });
        });

        document.querySelectorAll(".overlay").forEach(overlay => {
            overlay.addEventListener("click", event => {
                if (event.target === overlay) {
                    overlay.hidden = true;
                }
            });
        });

        /* Mobile navigation */

        $("menuToggle")?.addEventListener("click", () => {
            $("sidebar").classList.toggle("open");
        });

        /* Refresh */

        $("refreshAll")?.addEventListener("click", refreshAll);

        /* Forms */

        $("verifyForm")?.addEventListener("submit", event => {
            event.preventDefault();

            createVerification(event.currentTarget);
        });

        $("documentForm")?.addEventListener("submit", event => {
            event.preventDefault();

            uploadDocument(event.currentTarget);
        });

        $("ownerForm")?.addEventListener("submit", event => {
            event.preventDefault();

            createOwner(event.currentTarget);
        });

        $("appealForm")?.addEventListener("submit", event => {
            event.preventDefault();

            createAppeal(event.currentTarget);
        });

        /* Action validation */

        $("actionReason")?.addEventListener("input", event => {
            $("actionSubmit").disabled =
                event.target.value.trim().length < 10;
        });

        $("actionSubmit")?.addEventListener("click", submitAction);

        /* Audit export */

        $("exportAudit")?.addEventListener("click", exportAudit);

        /* Search and filters */

        const bindings = [

            ["individualSearch", "input", loadIndividuals],
            ["individualStatus", "change", loadIndividuals],
            ["individualRisk", "change", loadIndividuals],
            ["individualJurisdiction", "change", loadIndividuals],

            ["businessSearch", "input", loadBusinesses],
            ["businessStatus", "change", loadBusinesses],
            ["businessRisk", "change", loadBusinesses],
            ["businessJurisdiction", "change", loadBusinesses],

            ["queueSearch", "input", loadQueue],
            ["queueSubjectType", "change", loadQueue],
            ["queueStatus", "change", loadQueue],
            ["queuePriority", "change", loadQueue],

            ["documentSearch", "input", loadDocuments],
            ["documentType", "change", loadDocuments],
            ["documentStatus", "change", loadDocuments],

            ["ownerSearch", "input", loadOwners],
            ["ownerStatus", "change", loadOwners],
            ["ownerType", "change", loadOwners],

            ["reviewSearch", "input", loadReviews],
            ["reviewType", "change", loadReviews],
            ["reviewRisk", "change", loadReviews],
            ["reviewStatus", "change", loadReviews],

            ["appealSearch", "input", loadAppeals],
            ["appealStatus", "change", loadAppeals],

            ["auditSearch", "input", loadAudit]

        ];

        bindings.forEach(([id, event, callback]) => {
            const element = $(id);

            if (!element) return;

            element.addEventListener(
                event,
                event === "input"
                    ? debounce(callback)
                    : () => {
                        callback().catch(error => {
                            toast(error.message, "error");
                        });
                    }
            );
        });

        /* Delegated table actions */

        document.addEventListener("click", event => {

            const detail = event.target.closest("[data-detail]");

            if (detail) {
                openDetail(
                    detail.dataset.detail,
                    detail.dataset.id
                );

                return;
            }

            const action = event.target.closest("[data-action]");

            if (action) {
                const actionType = action.dataset.action;

                const resource = ACTION_MAP[actionType];

                if (resource) {
                    requestAction(
                        resource,
                        action.dataset.id,
                        actionType
                    );
                }
            }

        });

        /* Keyboard modal control */

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                document.querySelectorAll(".overlay").forEach(element => {
                    element.hidden = true;
                });
            }
        });

    }

    /* =========================================
       REFRESH MANAGEMENT
    ========================================= */

    async function refreshAll() {
        setStatus("loading", "Refreshing");

        const results = await Promise.allSettled([
            loadReferenceData(),
            loadOverview()
        ]);

        if (results.every(result => result.status === "rejected")) {
            setStatus("error", "Unavailable");

            toast(
                "KYC services could not be reached.",
                "error"
            );

            return;
        }

        if (state.section !== "overview") {
            try {
                await loaders[state.section]();
            } catch (error) {
                toast(error.message, "error");
            }
        }

        setStatus("connected", "Connected");
    }

    /* =========================================
       INITIALIZATION
    ========================================= */

    async function initialize() {
        bindEvents();

        setStatus("loading", "Connecting");

        const results = await Promise.allSettled([
            loadReferenceData(),
            loadOverview()
        ]);

        if (results.every(result => result.status === "rejected")) {
            setStatus("error", "Unavailable");

            console.error(
                "[TALVORA KYC] Initialization failed."
            );
        }

        if (state.refreshTimer) {
            clearInterval(state.refreshTimer);
        }

        state.refreshTimer = setInterval(() => {

            if (
                document.visibilityState === "visible" &&
                state.section === "overview"
            ) {
                loadOverview().catch(error => {
                    console.warn("[TALVORA KYC]", error);
                });
            }

        }, Number(config.refreshInterval) || 30000);

    }

    /* =========================================
       PUBLIC MODULE INTERFACE
    ========================================= */

    window.TALVORA_KYC = {

        refresh: refreshAll,

        navigate,

        loadOverview,
        loadIndividuals,
        loadBusinesses,
        loadQueue,
        loadDocuments,
        loadOwners,
        loadReviews,
        loadAppeals,
        loadAudit,

        config: {
            apiBaseUrl: base,
            endpoints
        }

    };

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
