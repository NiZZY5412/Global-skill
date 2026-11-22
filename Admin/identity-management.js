
(() => {
    "use strict";

    /* ==========================================
       TALVORA GLOBAL IDENTITY MANAGEMENT
       ========================================== */

    const DEFAULT_ENDPOINTS = {
        dashboard: "/api/identity-management/dashboard",
        users: "/api/identity-management/users",
        employees: "/api/identity-management/employees",
        employers: "/api/identity-management/employers",
        administrators: "/api/identity-management/administrators",
        countries: "/api/platform-control/localization/jurisdictions",

        verification: "/api/identity-management/verification",
        verificationSummary: "/api/identity-management/verification/summary",

        roles: "/api/identity-management/roles",
        permissions: "/api/identity-management/permissions",
        assignments: "/api/identity-management/role-assignments",

        suspensions: "/api/identity-management/suspensions",
        lifecycle: "/api/identity-management/lifecycle",
        risks: "/api/identity-management/risks",

        activity: "/api/identity-management/activity",
        sessions: "/api/identity-management/sessions",

        bulkPreview: "/api/identity-management/bulk/preview",
        bulkActions: "/api/identity-management/bulk/actions",
        bulkImportPreview: "/api/identity-management/bulk/import/preview",
        bulkImportCommit: "/api/identity-management/bulk/import/commit",
        bulkHistory: "/api/identity-management/bulk/history",

        audit: "/api/identity-management/audit",
        exports: "/api/identity-management/exports"
    };

    const supplied = window.TALVORA_IDENTITY_CONFIG || {};

    const CONFIG = {
        apiBaseUrl: supplied.apiBaseUrl || "",
        timeout: supplied.timeout || 20000,
        refreshInterval: supplied.refreshInterval || 30000,
        pageSize: supplied.pageSize || 25,
        endpoints: {
            ...DEFAULT_ENDPOINTS,
            ...(supplied.endpoints || {})
        }
    };

    const state = {
        currentSection: "overview",

        users: [],
        employees: [],
        employers: [],
        administrators: [],

        verifications: [],
        roles: [],
        permissions: [],
        assignments: [],

        suspensions: [],
        lifecycle: [],
        risks: [],

        activity: [],
        sessions: [],

        countries: [],
        auditRecords: [],

        selectedUserIds: new Set(),

        currentPage: 1,
        totalPages: 1,
        totalRecords: 0,

        activeUser: null,
        activeVerification: null,
        activeRole: null,

        pendingAction: null,
        bulkPreview: null,

        refreshTimer: null
    };

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        [...root.querySelectorAll(selector)];

    /* ==========================================
       UTILITIES
       ========================================== */

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function humanize(value) {
        if (value === null || value === undefined || value === "") {
            return "—";
        }

        return String(value)
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());
    }

    function formatNumber(value) {
        if (value === null || value === undefined || value === "") {
            return "—";
        }

        const number = Number(value);

        return Number.isFinite(number)
            ? new Intl.NumberFormat().format(number)
            : "—";
    }

    function formatDate(value) {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(date);
    }

    function safeClass(value) {
        return String(value || "unknown")
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "_");
    }

    function badge(value) {
        return `
      <span class="badge ${safeClass(value)}">
        ${escapeHTML(humanize(value))}
      </span>
    `;
    }

    function emptyRow(columns, message = "No records available.") {
        return `
      <tr>
        <td colspan="${columns}">
          ${escapeHTML(message)}
        </td>
      </tr>
    `;
    }

    function setMetric(id, value) {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = formatNumber(value);
        }
    }

    function getData(payload) {
        return payload?.data ?? payload ?? {};
    }

    function getRecords(payload, ...keys) {
        if (Array.isArray(payload)) return payload;

        const data = getData(payload);

        if (Array.isArray(data)) return data;

        for (const key of keys) {
            if (Array.isArray(data?.[key])) return data[key];
            if (Array.isArray(payload?.[key])) return payload[key];
        }

        return [];
    }

    function getValue(object, ...keys) {
        for (const key of keys) {
            if (object?.[key] !== undefined && object[key] !== null) {
                return object[key];
            }
        }

        return undefined;
    }

    function buildQuery(params = {}) {
        const query = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value !== "" && value !== null && value !== undefined) {
                query.set(key, String(value));
            }
        });

        const result = query.toString();

        return result ? `?${result}` : "";
    }

    function endpoint(path) {
        return CONFIG.apiBaseUrl.replace(/\/+$/, "") +
            (path.startsWith("/") ? path : `/${path}`);
    }

    function toast(message, type = "info") {
        const region = $("#toastRegion");

        if (!region) return;

        const item = document.createElement("div");

        item.className = `toast ${safeClass(type)}`;
        item.textContent = message;

        region.appendChild(item);

        setTimeout(() => item.remove(), 4500);
    }

    function setConnection(status, message) {
        const element = $("#connectionStatus");

        if (!element) return;

        element.className = `connection-status ${status}`;
        element.innerHTML = `<i></i>${escapeHTML(message)}`;
    }

    function showModal(id) {
        const modal = document.getElementById(id);

        if (!modal) return;

        modal.hidden = false;

        const focusable = $("input, select, textarea, button", modal);

        if (focusable) focusable.focus();
    }

    function closeModal(modal) {
        if (modal) modal.hidden = true;
    }

    function closeAllModals() {
        $$(".modal-overlay").forEach(closeModal);
    }

    function formValues(form) {
        return Object.fromEntries(
            new FormData(form).entries()
        );
    }

    function fillForm(form, values = {}) {
        Object.entries(values).forEach(([name, value]) => {
            const field = form.elements.namedItem(name);

            if (!field) return;

            if (field.type === "checkbox") {
                field.checked = value === true || value === 1;
            } else if (field.type !== "file") {
                field.value = value ?? "";
            }
        });
    }

    function getPagination(payload) {
        const data = getData(payload);

        return (
            data.pagination ||
            data.meta?.pagination ||
            data.meta ||
            {}
        );
    }

    function identityCell(name, email) {
        const safeName = escapeHTML(name || "Unnamed account");
        const safeEmail = escapeHTML(email || "—");

        const initial = escapeHTML(
            String(name || "U").trim().charAt(0).toUpperCase()
        );

        return `
      <div class="identity-cell">
        <div class="identity-avatar">${initial}</div>
        <div>
          <strong>${safeName}</strong>
          <small>${safeEmail}</small>
        </div>
      </div>
    `;
    }

    function setEmpty(elementId, message) {
        const element = document.getElementById(elementId);

        if (element) {
            element.innerHTML = `<p>${escapeHTML(message)}</p>`;
        }
    }

    /* ==========================================
       API CLIENT
       ========================================== */

    async function api(path, options = {}) {
        const controller = new AbortController();

        const timeout = setTimeout(
            () => controller.abort(),
            CONFIG.timeout
        );

        const headers = new Headers(options.headers || {});

        headers.set("Accept", "application/json");

        const csrfToken = $('meta[name="csrf-token"]')?.content;

        if (csrfToken) {
            headers.set("X-CSRF-Token", csrfToken);
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
            const response = await fetch(endpoint(path), {
                ...options,
                headers,
                body,
                credentials: "include",
                signal: options.signal || controller.signal
            });

            if (!response.ok) {
                const contentType = response.headers.get("content-type") || "";

                let message = `Request failed (${response.status})`;

                if (contentType.includes("application/json")) {
                    const error = await response.json().catch(() => ({}));

                    message =
                        error.message ||
                        error.error ||
                        error.detail ||
                        message;
                } else {
                    const text = await response.text().catch(() => "");

                    if (text) message = text;
                }

                throw new Error(message);
            }

            if (response.status === 204) return null;

            const contentType = response.headers.get("content-type") || "";

            if (contentType.includes("application/json")) {
                return response.json();
            }

            return response.text();

        } finally {
            clearTimeout(timeout);
        }
    }

    async function downloadFile(path, filename) {
        try {
            const headers = new Headers();

            const csrfToken = $('meta[name="csrf-token"]')?.content;

            if (csrfToken) {
                headers.set("X-CSRF-Token", csrfToken);
            }

            const response = await fetch(endpoint(path), {
                method: "GET",
                credentials: "include",
                headers
            });

            if (!response.ok) {
                throw new Error(`Download failed (${response.status})`);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");

            link.href = url;
            link.download = filename;

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(url), 1000);

            toast("Export downloaded successfully.", "success");

        } catch (error) {
            toast(`Export failed: ${error.message}`, "error");
        }
    }

    /* ==========================================
       NAVIGATION
       ========================================== */

    const LOADERS = {
        overview: loadOverview,
        directory: loadDirectory,
        employees: loadEmployees,
        employers: loadEmployers,
        administrators: loadAdministrators,
        verification: loadVerification,
        permissions: loadPermissions,
        suspensions: loadSuspensions,
        lifecycle: loadLifecycle,
        risks: loadRisks,
        activity: loadActivity,
        bulk: loadBulkHistory,
        audit: loadAudit
    };

    function navigate(section) {
        if (!document.getElementById(section)) return;

        state.currentSection = section;

        $$(".content-section").forEach(item => {
            item.classList.toggle("active", item.id === section);
        });

        $$(".nav-link[data-section]").forEach(link => {
            link.classList.toggle(
                "active",
                link.dataset.section === section
            );
        });

        $("#sidebar").classList.remove("open");

        if (LOADERS[section]) {
            LOADERS[section]();
        }
    }

    /* ==========================================
       COUNTRY OPTIONS
       ========================================== */

    async function loadCountries() {
        try {
            const payload = await api(CONFIG.endpoints.countries);

            state.countries = getRecords(
                payload,
                "jurisdictions",
                "countries",
                "items"
            );

            populateCountrySelects();

        } catch (error) {
            console.warn(
                "[TALVORA Identity] Country options unavailable:",
                error.message
            );
        }
    }

    function populateCountrySelects() {
        const selects = [
            $("#userCountryFilter"),
            $("#employeeCountry"),
            $("#createUserCountry")
        ].filter(Boolean);

        selects.forEach(select => {
            const original = select.options[0];

            select.innerHTML = "";

            if (original) {
                select.appendChild(original.cloneNode(true));
            }

            state.countries
                .filter(country => country.status !== "inactive")
                .forEach(country => {
                    const option = document.createElement("option");

                    option.value = country.code || country.id || country.name;
                    option.textContent = country.name || country.country || country.code;

                    select.appendChild(option);
                });
        });
    }

    /* ==========================================
       1. GLOBAL IDENTITY OVERVIEW
       ========================================== */

    async function loadOverview() {
        try {
            const payload = await api(CONFIG.endpoints.dashboard);

            const data = getData(payload);
            const metrics = data.metrics || data.summary || data;

            setMetric("totalUsers",
                getValue(metrics, "totalUsers", "total_users"));

            setMetric("activeUsers",
                getValue(metrics, "activeUsers", "active_users"));

            setMetric("employeeUsers",
                getValue(metrics, "employeeUsers", "employee_users"));

            setMetric("employerUsers",
                getValue(metrics, "employerUsers", "employer_users"));

            setMetric("administratorUsers",
                getValue(metrics, "administratorUsers", "administrator_users"));

            setMetric("pendingVerification",
                getValue(metrics, "pendingVerification", "pending_verification"));

            setMetric("suspendedUsers",
                getValue(metrics, "suspendedUsers", "suspended_users"));

            setMetric("identityRisks",
                getValue(metrics, "identityRisks", "identity_risks"));

            renderDistribution(
                getRecords(data, "accountDistribution", "account_distribution")
            );

            renderVerificationSummary(
                data.verificationSummary ||
                data.verification_summary ||
                {}
            );

            renderRecentOperations(
                getRecords(data, "recentOperations", "recent_operations")
            );

            renderGovernanceAlerts(
                getRecords(data, "alerts", "governanceAlerts", "governance_alerts")
            );

            $("#bannerMessage").textContent =
                data.message ||
                "Identity management information retrieved.";

            setConnection("connected", "Connected");

        } catch (error) {
            setConnection("error", "Connection issue");

            $("#bannerMessage").textContent =
                "Identity management data could not be retrieved.";

            console.error("[TALVORA Identity] Dashboard unavailable:", error.message);
        }
    }

    function renderDistribution(items) {
        const container = $("#accountDistribution");

        if (!items.length) {
            container.textContent = "No account distribution information available.";
            return;
        }

        const total = items.reduce(
            (sum, item) => sum + Number(item.count || 0),
            0
        );

        container.innerHTML = items.map(item => {
            const count = Number(item.count || 0);

            const percentage = total > 0
                ? Math.min(100, count / total * 100)
                : 0;

            return `
        <div>
          <div class="distribution-row">
            <span>${escapeHTML(humanize(item.type || item.category))}</span>
            <strong>${formatNumber(count)}</strong>
          </div>
          <div class="distribution-bar">
            <span style="width:${percentage}%"></span>
          </div>
        </div>
      `;
        }).join("");
    }

    function renderVerificationSummary(data) {
        const items = [
            ["Pending", getValue(data, "pending", "pendingCount", "pending_count")],
            ["Under review", getValue(data, "underReview", "under_review")],
            ["Verified", getValue(data, "verified", "verifiedCount", "verified_count")],
            ["Rejected", getValue(data, "rejected", "rejectedCount", "rejected_count")],
            ["Requires information", getValue(data, "requiresInformation", "requires_information")]
        ];

        $("#verificationSummary").innerHTML = items.map(([label, value]) => `
      <div class="summary-row">
        <span>${escapeHTML(label)}</span>
        <strong>${formatNumber(value)}</strong>
      </div>
    `).join("");
    }

    function renderRecentOperations(items) {
        $("#recentIdentityOperations").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.reference || item.id || "—")}</td>
          <td>${escapeHTML(item.accountName || item.account_name || "—")}</td>
          <td>${escapeHTML(humanize(item.operation || item.action))}</td>
          <td>${escapeHTML(item.administrator || item.actorName || "—")}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${badge(item.status)}</td>
        </tr>
      `).join("")
            : emptyRow(6);
    }

    function renderGovernanceAlerts(items) {
        const container = $("#governanceAlerts");

        if (!items.length) {
            container.textContent = "No governance alerts were returned.";
            return;
        }

        container.innerHTML = items.map(item => `
      <div class="governance-alert">
        <div>
          <strong>${escapeHTML(item.title || item.category || "Identity alert")}</strong>
          <p>${escapeHTML(item.description || "No additional description.")}</p>
        </div>
        ${badge(item.severity || item.status)}
      </div>
    `).join("");
    }

    /* ==========================================
       2. GLOBAL USER DIRECTORY
       ========================================== */

    async function loadDirectory() {
        const body = $("#userDirectoryTable");

        body.innerHTML = emptyRow(9, "Loading user directory...");

        try {
            const payload = await api(
                CONFIG.endpoints.users + buildQuery({
                    search: $("#userSearch").value.trim(),
                    accountType: $("#userTypeFilter").value,
                    status: $("#userStatusFilter").value,
                    country: $("#userCountryFilter").value,
                    page: state.currentPage,
                    pageSize: CONFIG.pageSize
                })
            );

            state.users = getRecords(
                payload,
                "users",
                "items",
                "results"
            );

            const pagination = getPagination(payload);

            state.currentPage = Number(
                pagination.page || pagination.currentPage || state.currentPage
            );

            state.totalPages = Number(
                pagination.totalPages ||
                pagination.total_pages ||
                1
            );

            state.totalRecords = Number(
                pagination.total ||
                pagination.totalRecords ||
                pagination.total_records ||
                state.users.length
            );

            renderDirectory(state.users);
            updatePagination();
            updateSelection();

        } catch (error) {
            body.innerHTML = emptyRow(
                9,
                "The global user directory could not be loaded."
            );

            toast(`User directory error: ${error.message}`, "error");
        }
    }

    function renderDirectory(items) {
        $("#userDirectoryTable").innerHTML = items.length
            ? items.map(user => {
                const id = user.id || user.userId || user.user_id;

                return `
          <tr>
            <td>
              <input
                type="checkbox"
                data-select-user="${escapeHTML(id)}"
                ${state.selectedUserIds.has(String(id)) ? "checked" : ""}
                aria-label="Select account ${escapeHTML(id)}"
              >
            </td>

            <td>${escapeHTML(id || "—")}</td>

            <td>
              ${identityCell(
                    user.fullName || user.full_name || user.name,
                    user.email
                )}
            </td>

            <td>${escapeHTML(humanize(user.accountType || user.account_type))}</td>
            <td>${escapeHTML(user.countryName || user.country_name || user.country || "—")}</td>
            <td>${badge(user.verificationStatus || user.verification_status)}</td>
            <td>${badge(user.status)}</td>
            <td>${escapeHTML(formatDate(user.lastActivity || user.last_activity))}</td>

            <td>
              <button data-view-user="${escapeHTML(id)}">View</button>
            </td>
          </tr>
        `;
            }).join("")
            : emptyRow(9, "No matching accounts were found.");
    }

    function updatePagination() {
        $("#userPaginationInfo").textContent =
            `Page ${state.currentPage} of ${state.totalPages} · ${formatNumber(state.totalRecords)} records`;

        $("#previousUsers").disabled = state.currentPage <= 1;
        $("#nextUsers").disabled = state.currentPage >= state.totalPages;
    }

    function updateSelection() {
        $("#selectedUserCount").textContent =
            `${state.selectedUserIds.size} accounts selected`;

        const checkboxes = $$("[data-select-user]");

        const selectedOnPage = checkboxes.filter(
            input => input.checked
        ).length;

        const master = $("#selectPageCheckbox");

        if (master) {
            master.checked =
                checkboxes.length > 0 &&
                selectedOnPage === checkboxes.length;

            master.indeterminate =
                selectedOnPage > 0 &&
                selectedOnPage < checkboxes.length;
        }
    }

    function toggleSelectedUser(id, selected) {
        const key = String(id);

        if (selected) {
            state.selectedUserIds.add(key);
        } else {
            state.selectedUserIds.delete(key);
        }

        updateSelection();
    }

    /* ==========================================
       EMPLOYEE MANAGEMENT
       ========================================== */

    async function loadEmployees() {
        try {
            const payload = await api(
                CONFIG.endpoints.employees + buildQuery({
                    search: $("#employeeSearch").value.trim(),
                    status: $("#employeeStatus").value,
                    country: $("#employeeCountry").value
                })
            );

            const data = getData(payload);

            state.employees = getRecords(
                payload,
                "employees",
                "items",
                "results"
            );

            const metrics = data.metrics || data.summary || {};

            setMetric(
                "employeeTotal",
                metrics.total ?? metrics.totalEmployees ?? metrics.total_employees ?? data.total
            );

            setMetric(
                "activeEmployeeTotal",
                getValue(metrics, "active", "activeEmployees", "active_employees")
            );

            setMetric(
                "pendingEmployeeTotal",
                getValue(metrics, "pendingVerification", "pending_verification")
            );

            renderEmployeeTable(state.employees);

        } catch (error) {
            $("#employeeTable").innerHTML = emptyRow(8, "Employee records could not be loaded.");
            toast(error.message, "error");
        }
    }

    function renderEmployeeTable(items) {
        $("#employeeTable").innerHTML = items.length
            ? items.map(user => `
        <tr>
          <td>${escapeHTML(user.employeeId || user.employee_id || user.id)}</td>
          <td>${identityCell(user.fullName || user.full_name || user.name, user.email)}</td>
          <td>${escapeHTML(user.email || "—")}</td>
          <td>${escapeHTML(user.countryName || user.country_name || user.country || "—")}</td>
          <td>${badge(user.verificationStatus || user.verification_status)}</td>
          <td>${badge(user.status)}</td>
          <td>${escapeHTML(formatDate(user.createdAt || user.created_at))}</td>
          <td><button data-view-user="${escapeHTML(user.id)}">View</button></td>
        </tr>
      `).join("")
            : emptyRow(8);
    }

    /* ==========================================
       EMPLOYER MANAGEMENT
       ========================================== */

    async function loadEmployers() {
        try {
            const payload = await api(
                CONFIG.endpoints.employers + buildQuery({
                    search: $("#employerSearch").value.trim(),
                    status: $("#employerStatus").value,
                    verificationStatus: $("#employerVerification").value
                })
            );

            state.employers = getRecords(
                payload,
                "employers",
                "organizations",
                "items"
            );

            renderEmployerTable(state.employers);

        } catch (error) {
            $("#employerTable").innerHTML = emptyRow(8, "Employer records could not be loaded.");
            toast(error.message, "error");
        }
    }

    function renderEmployerTable(items) {
        $("#employerTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || item.organizationId || item.organization_id)}</td>
          <td>${escapeHTML(item.organizationName || item.organization_name || item.name || "—")}</td>
          <td>${escapeHTML(item.representative || item.representativeName || "—")}</td>
          <td>${escapeHTML(item.countryName || item.country_name || item.country || "—")}</td>
          <td>${badge(item.verificationStatus || item.verification_status)}</td>
          <td>${badge(item.status)}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td><button data-view-user="${escapeHTML(item.userId || item.user_id || item.id)}">View</button></td>
        </tr>
      `).join("")
            : emptyRow(8);
    }

    /* ==========================================
       ADMINISTRATOR MANAGEMENT
       ========================================== */

    async function loadAdministrators() {
        try {
            const payload = await api(
                CONFIG.endpoints.administrators + buildQuery({
                    search: $("#adminSearch").value.trim(),
                    role: $("#adminRole").value,
                    status: $("#adminStatus").value
                })
            );

            const data = getData(payload);

            state.administrators = getRecords(
                payload,
                "administrators",
                "admins",
                "items"
            );

            const metrics = data.metrics || data.summary || {};

            setMetric(
                "superAdminTotal",
                getValue(metrics, "superAdmins", "super_admins")
            );

            setMetric(
                "countryAdminTotal",
                getValue(metrics, "countryAdmins", "country_admins")
            );

            setMetric(
                "otherAdminTotal",
                getValue(metrics, "otherAdmins", "other_admins")
            );

            renderAdministrators(state.administrators);

        } catch (error) {
            $("#administratorTable").innerHTML =
                emptyRow(8, "Administrator records could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderAdministrators(items) {
        $("#administratorTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.id || item.userId || item.user_id)}</td>

          <td>
            ${identityCell(
                item.fullName || item.full_name || item.name,
                item.email
            )}
          </td>

          <td>${badge(item.role || item.accountType || item.account_type)}</td>
          <td>${escapeHTML(item.scopeName || item.scope_name || item.scope || "—")}</td>
          <td>${badge(item.mfaStatus || item.mfa_status)}</td>
          <td>${badge(item.status)}</td>
          <td>${escapeHTML(formatDate(item.lastActivity || item.last_activity))}</td>

          <td>
            <button data-view-user="${escapeHTML(item.userId || item.user_id || item.id)}">
              Manage
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(8);
    }

    /* ==========================================
       ACCOUNT DETAILS
       ========================================== */

    async function openUserDetails(id) {
        try {
            const payload = await api(
                `${CONFIG.endpoints.users}/${encodeURIComponent(id)}`
            );

            const user = getData(payload);

            state.activeUser = user;

            $("#detailTitle").textContent =
                user.fullName || user.full_name || user.name || "Account details";

            const fields = [
                ["Account ID", user.id],
                ["Full name", user.fullName || user.full_name || user.name],
                ["Email address", user.email],
                ["Phone number", user.phone],
                ["Account category", humanize(user.accountType || user.account_type)],
                ["Organization", user.organization],
                ["Country", user.countryName || user.country_name || user.country],
                ["Administrative scope", user.administrativeScope || user.administrative_scope],
                ["Assigned role", user.role || user.roleName || user.role_name],
                ["Verification status", humanize(user.verificationStatus || user.verification_status)],
                ["MFA status", humanize(user.mfaStatus || user.mfa_status)],
                ["Account status", humanize(user.status)],
                ["Registration date", formatDate(user.createdAt || user.created_at)],
                ["Last activity", formatDate(user.lastActivity || user.last_activity)]
            ];

            $("#detailContent").innerHTML = fields
                .filter(([, value]) => value !== null && value !== undefined && value !== "")
                .map(([label, value]) => `
          <div class="detail-row">
            <span>${escapeHTML(label)}</span>
            <strong>${escapeHTML(value)}</strong>
          </div>
        `).join("");

            const buttons = [];

            if (user.status === "active") {
                buttons.push(
                    '<button class="danger-button" data-detail-action="suspend">Suspend account</button>',
                    '<button class="secondary-button" data-detail-action="deactivate">Deactivate</button>'
                );
            }

            if (user.status === "suspended" || user.status === "deactivated") {
                buttons.push(
                    '<button class="primary-button" data-detail-action="reinstate">Request reinstatement</button>'
                );
            }

            if (user.status !== "closed") {
                buttons.push(
                    '<button class="secondary-button" data-detail-action="revoke_sessions">Revoke sessions</button>'
                );
            }

            if (user.role || user.accountType?.includes("admin")) {
                buttons.push(
                    '<button class="secondary-button" data-detail-action="assign_role">Manage role</button>'
                );
            }

            $("#detailActions").innerHTML = `
        ${buttons.join("")}
        <button class="secondary-button" data-close-modal>Close</button>
      `;

            showModal("detailModal");

        } catch (error) {
            toast(`Account details unavailable: ${error.message}`, "error");
        }
    }

    /* ==========================================
       ROLE ASSIGNMENT MODAL
       ========================================== */

    function ensureAssignmentModal() {
        if ($("#assignmentModal")) return;

        const modal = document.createElement("div");

        modal.id = "assignmentModal";
        modal.className = "modal-overlay";
        modal.hidden = true;

        modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div>
            <small>ROLE ASSIGNMENT GOVERNANCE</small>
            <h2>Assign account role</h2>
          </div>
          <button class="close-modal" data-close-modal>×</button>
        </div>

        <form id="assignmentForm">
          <input type="hidden" name="accountId">

          <label>Account
            <input name="accountName" readonly>
          </label>

          <label>Role *
            <select name="roleId" id="assignmentRoleSelect" required>
              <option value="">Select role</option>
            </select>
          </label>

          <label>Permission scope *
            <select name="scope" required>
              <option value="self">Self only</option>
              <option value="organization">Organization</option>
              <option value="country">Country</option>
              <option value="regional">Regional</option>
              <option value="global">Global</option>
            </select>
          </label>

          <label>Reason for assignment *
            <textarea name="reason" rows="3" required></textarea>
          </label>

          <div class="modal-note">
            The backend will verify role eligibility, scope,
            approval requirements and the administrator's authority.
          </div>

          <div class="modal-actions">
            <button type="button" class="secondary-button" data-close-modal>
              Cancel
            </button>
            <button type="submit" class="primary-button">
              Submit role assignment
            </button>
          </div>
        </form>
      </div>
    `;

        document.body.appendChild(modal);

        modal.querySelector("form").addEventListener("submit", event => {
            event.preventDefault();
            saveAssignment(event.currentTarget);
        });

        modal.querySelectorAll("[data-close-modal]").forEach(button => {
            button.addEventListener("click", () => closeModal(modal));
        });
    }

    function openAssignmentModal(user) {
        ensureAssignmentModal();

        const form = $("#assignmentForm");
        const select = $("#assignmentRoleSelect");

        select.innerHTML = `
      <option value="">Select role</option>
      ${state.roles.map(role => `
        <option value="${escapeHTML(role.id)}">
          ${escapeHTML(role.name)}
        </option>
      `).join("")}
    `;

        fillForm(form, {
            accountId: user.id || user.accountId || user.account_id,
            accountName: user.fullName || user.full_name || user.name || user.email
        });

        closeModal($("#detailModal"));
        showModal("assignmentModal");
    }

    async function saveAssignment(form) {
        const button = form.querySelector('[type="submit"]');
        const payload = formValues(form);

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.assignments, {
                method: "POST",
                body: payload
            });

            form.reset();
            closeModal($("#assignmentModal"));

            toast(
                "Role assignment submitted for server-side authorization.",
                "success"
            );

            await Promise.all([
                loadPermissions(),
                loadAdministrators()
            ]);

        } catch (error) {
            toast(`Role assignment failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    /* ==========================================
       6. IDENTITY VERIFICATION
       ========================================== */

    async function loadVerification() {
        try {
            const [casesPayload, summaryPayload] = await Promise.all([
                api(CONFIG.endpoints.verification + buildQuery({
                    search: $("#verificationSearch").value.trim(),
                    accountType: $("#verificationType").value,
                    status: $("#verificationStatus").value
                })),
                api(CONFIG.endpoints.verificationSummary)
            ]);

            state.verifications = getRecords(
                casesPayload,
                "cases",
                "verifications",
                "items"
            );

            const summary = getData(summaryPayload);

            setMetric("verificationPendingTotal",
                getValue(summary, "pending", "pendingCount", "pending_count"));

            setMetric("verificationReviewTotal",
                getValue(summary, "underReview", "under_review"));

            setMetric("verificationCompletedTotal",
                getValue(summary, "completed", "completedCount", "completed_count"));

            renderVerification(state.verifications);

        } catch (error) {
            $("#verificationTable").innerHTML =
                emptyRow(8, "Verification cases could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderVerification(items) {
        $("#verificationTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.reference || item.id)}</td>
          <td>${escapeHTML(item.accountName || item.account_name || item.email || "—")}</td>
          <td>${escapeHTML(humanize(item.accountType || item.account_type))}</td>
          <td>${escapeHTML(item.country || "—")}</td>
          <td>${escapeHTML(humanize(item.method || item.verificationMethod))}</td>
          <td>${escapeHTML(formatDate(item.submittedAt || item.submitted_at))}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-view-verification="${escapeHTML(item.id)}">Review</button>
          </td>
        </tr>
      `).join("")
            : emptyRow(8);
    }

    function validSecureUrl(value) {
        if (!value) return null;

        try {
            const url = new URL(value, window.location.origin);

            if (
                url.protocol === "https:" ||
                url.origin === window.location.origin
            ) {
                return url.href;
            }
        } catch {
            return null;
        }

        return null;
    }

    async function openVerification(id) {
        try {
            const payload = await api(
                `${CONFIG.endpoints.verification}/${encodeURIComponent(id)}`
            );

            const item = getData(payload);

            state.activeVerification = item;

            const fields = [
                ["Case reference", item.reference || item.id],
                ["Account", item.accountName || item.account_name],
                ["Email", item.email],
                ["Account type", humanize(item.accountType || item.account_type)],
                ["Country", item.country],
                ["Verification method", humanize(item.method || item.verificationMethod)],
                ["Submitted", formatDate(item.submittedAt || item.submitted_at)],
                ["Status", humanize(item.status)],
                ["Review notes", item.reviewNotes || item.review_notes]
            ];

            $("#verificationDetails").innerHTML = fields
                .filter(([, value]) => value !== null && value !== undefined && value !== "")
                .map(([label, value]) => `
          <div class="detail-row">
            <span>${escapeHTML(label)}</span>
            <strong>${escapeHTML(value)}</strong>
          </div>
        `).join("");

            const secureUrl = validSecureUrl(
                item.secureReviewUrl || item.secure_review_url
            );

            if (secureUrl) {
                const link = document.createElement("a");

                link.href = secureUrl;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.className = "secondary-button";
                link.textContent = "Open secure verification review";

                $("#verificationDetails").appendChild(link);
            }

            $("#verificationActions").innerHTML = `
        <button class="secondary-button"
                data-verification-action="request_information">
          Request more information
        </button>
        <button class="danger-button"
                data-verification-action="reject">
          Reject
        </button>
        <button class="primary-button"
                data-verification-action="approve">
          Approve verification
        </button>
      `;

            if (
                !["pending", "under_review", "requires_information"].includes(item.status)
            ) {
                $("#verificationActions").innerHTML = `
          ${badge(item.status)}
          <button class="secondary-button" data-close-modal>Close</button>
        `;
            }

            showModal("verificationModal");

        } catch (error) {
            toast(`Verification details unavailable: ${error.message}`, "error");
        }
    }

    /* ==========================================
       7. ACCESS AND PERMISSIONS
       ========================================== */

    async function loadPermissions() {
        try {
            const [rolesPayload, permissionsPayload, assignmentsPayload] =
                await Promise.all([
                    api(CONFIG.endpoints.roles),
                    api(CONFIG.endpoints.permissions),
                    api(CONFIG.endpoints.assignments)
                ]);

            state.roles = getRecords(rolesPayload, "roles", "items");
            state.permissions = getRecords(
                permissionsPayload,
                "permissions",
                "items"
            );

            state.assignments = getRecords(
                assignmentsPayload,
                "assignments",
                "items"
            );

            renderRoles(state.roles);
            renderPermissionCatalogue(state.permissions);
            renderAssignments(state.assignments);

        } catch (error) {
            $("#roleTable").innerHTML = emptyRow(7, "Roles could not be loaded.");
            $("#permissionTable").innerHTML = emptyRow(4);
            $("#assignmentTable").innerHTML = emptyRow(7);

            toast(`Access management error: ${error.message}`, "error");
        }
    }

    function renderRoles(items) {
        $("#roleTable").innerHTML = items.length
            ? items.map(role => `
        <tr>
          <td>${escapeHTML(role.id)}</td>
          <td>${escapeHTML(role.name)}</td>
          <td>${escapeHTML(humanize(role.scope))}</td>
          <td>${formatNumber(role.assignedAccounts ?? role.assigned_accounts)}</td>
          <td>${formatNumber(role.permissionCount ?? role.permission_count)}</td>
          <td>${badge(role.status)}</td>
          <td>
            <button data-edit-role="${escapeHTML(role.id)}">Manage</button>
          </td>
        </tr>
      `).join("")
            : emptyRow(7);
    }

    function renderPermissionCatalogue(items) {
        $("#permissionTable").innerHTML = items.length
            ? items.map(permission => `
        <tr>
          <td>${escapeHTML(permission.key || permission.code || permission.name)}</td>
          <td>${escapeHTML(permission.description || "—")}</td>
          <td>${escapeHTML(humanize(permission.category))}</td>
          <td>${badge(permission.riskLevel || permission.risk_level)}</td>
        </tr>
      `).join("")
            : emptyRow(4);
    }

    function renderAssignments(items) {
        $("#assignmentTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.accountName || item.account_name || item.accountId || "—")}</td>
          <td>${escapeHTML(item.roleName || item.role_name || "—")}</td>
          <td>${escapeHTML(item.scopeName || item.scope_name || item.scope || "—")}</td>
          <td>${escapeHTML(item.assignedBy || item.assigned_by || "—")}</td>
          <td>${escapeHTML(formatDate(item.assignedAt || item.assigned_at))}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-edit-assignment="${escapeHTML(item.id)}">Manage</button>
          </td>
        </tr>
      `).join("")
            : emptyRow(7);
    }

    function openRoleModal(role = null) {
        state.activeRole = role;

        const form = $("#roleForm");

        form.reset();

        $("#roleModalTitle").textContent =
            role ? "Edit platform role" : "Create platform role";

        const select = $("#rolePermissions");

        select.innerHTML = state.permissions.map(permission => `
      <option value="${escapeHTML(permission.id || permission.key)}">
        ${escapeHTML(permission.name || permission.key || permission.code)}
      </option>
    `).join("");

        if (role) {
            fillForm(form, {
                roleId: role.id,
                name: role.name,
                description: role.description,
                scope: role.scope
            });

            const selected = new Set(
                role.permissions || role.permissionIds || role.permission_ids || []
            );

            [...select.options].forEach(option => {
                option.selected = selected.has(option.value);
            });
        }

        showModal("roleModal");
    }

    async function saveRole(form) {
        const button = form.querySelector('[type="submit"]');

        const payload = formValues(form);

        payload.permissions = [
            ...$("#rolePermissions").selectedOptions
        ].map(option => option.value);

        const roleId = payload.roleId;

        delete payload.roleId;

        button.disabled = true;

        try {
            if (roleId) {
                await api(
                    `${CONFIG.endpoints.roles}/${encodeURIComponent(roleId)}`,
                    {
                        method: "PATCH",
                        body: payload
                    }
                );
            } else {
                await api(CONFIG.endpoints.roles, {
                    method: "POST",
                    body: payload
                });
            }

            closeModal($("#roleModal"));

            toast("Role change submitted.", "success");

            await loadPermissions();

        } catch (error) {
            toast(`Role update failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    async function editAssignment(id) {
        try {
            const payload = await api(
                `${CONFIG.endpoints.assignments}/${encodeURIComponent(id)}`
            );

            const assignment = getData(payload);

            const user = {
                id: assignment.accountId || assignment.account_id,
                fullName: assignment.accountName || assignment.account_name
            };

            openAssignmentModal(user);

            $("#assignmentRoleSelect").value =
                assignment.roleId || assignment.role_id || "";

            $("#assignmentForm").elements.scope.value =
                assignment.scope || "self";

        } catch (error) {
            toast(`Assignment details unavailable: ${error.message}`, "error");
        }
    }

    /* ==========================================
       8. ACCOUNT SUSPENSIONS
       ========================================== */

    async function loadSuspensions() {
        try {
            const payload = await api(
                CONFIG.endpoints.suspensions + buildQuery({
                    search: $("#suspensionSearch").value.trim(),
                    status: $("#suspensionStatus").value,
                    type: $("#suspensionType").value
                })
            );

            state.suspensions = getRecords(
                payload,
                "suspensions",
                "items"
            );

            renderSuspensions(state.suspensions);

        } catch (error) {
            $("#suspensionTable").innerHTML =
                emptyRow(9, "Suspension records could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderSuspensions(items) {
        $("#suspensionTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.reference || item.id)}</td>
          <td>${escapeHTML(item.accountName || item.account_name || item.accountId || "—")}</td>
          <td>${escapeHTML(humanize(item.type))}</td>
          <td>${escapeHTML(humanize(item.reasonCategory || item.reason_category))}</td>
          <td>${escapeHTML(formatDate(item.startAt || item.start_at))}</td>
          <td>${escapeHTML(formatDate(item.endAt || item.end_at))}</td>
          <td>${badge(item.appealStatus || item.appeal_status)}</td>
          <td>${badge(item.status)}</td>
          <td>
            ${item.status === "active" || item.status === "under_appeal"
                    ? `<button data-suspension-action="reinstate" data-suspension-id="${escapeHTML(item.id)}">Review</button>`
                    : "—"}
          </td>
        </tr>
      `).join("")
            : emptyRow(9);
    }

    /* ==========================================
       9. ACCOUNT LIFECYCLE
       ========================================== */

    async function loadLifecycle() {
        try {
            const payload = await api(
                CONFIG.endpoints.lifecycle + buildQuery({
                    search: $("#lifecycleSearch").value.trim(),
                    status: $("#lifecycleStatus").value
                })
            );

            state.lifecycle = getRecords(
                payload,
                "lifecycle",
                "accounts",
                "items"
            );

            renderLifecycle(state.lifecycle);

        } catch (error) {
            $("#lifecycleTable").innerHTML =
                emptyRow(8, "Lifecycle records could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderLifecycle(items) {
        $("#lifecycleTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.accountId || item.account_id || item.id)}</td>
          <td>${escapeHTML(item.accountName || item.account_name || item.email || "—")}</td>
          <td>${escapeHTML(humanize(item.accountType || item.account_type))}</td>
          <td>${escapeHTML(humanize(item.stage || item.status))}</td>
          <td>${escapeHTML(formatDate(item.lastTransition || item.last_transition))}</td>
          <td>${escapeHTML(item.requestedBy || item.requested_by || "—")}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-view-user="${escapeHTML(item.accountId || item.account_id || item.id)}">
              View
            </button>
          </td>
        </tr>
      `).join("")
            : emptyRow(8);
    }

    /* ==========================================
       10. IDENTITY RISK MONITORING
       ========================================== */

    async function loadRisks() {
        try {
            const payload = await api(
                CONFIG.endpoints.risks + buildQuery({
                    search: $("#riskSearch").value.trim(),
                    severity: $("#riskSeverity").value,
                    status: $("#riskStatus").value
                })
            );

            const data = getData(payload);

            state.risks = getRecords(
                payload,
                "risks",
                "alerts",
                "items"
            );

            const metrics = data.metrics || data.summary || {};

            setMetric(
                "criticalRiskTotal",
                getValue(metrics, "critical", "criticalCount", "critical_count")
            );

            setMetric(
                "highRiskTotal",
                getValue(metrics, "high", "highCount", "high_count")
            );

            setMetric(
                "openInvestigationTotal",
                getValue(metrics, "openInvestigations", "open_investigations")
            );

            renderRisks(state.risks);

        } catch (error) {
            $("#riskTable").innerHTML =
                emptyRow(8, "Identity risk information could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderRisks(items) {
        $("#riskTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.reference || item.id)}</td>
          <td>${escapeHTML(item.accountName || item.account_name || item.accountId || "—")}</td>
          <td>${escapeHTML(humanize(item.category || item.type))}</td>
          <td>${badge(item.severity)}</td>
          <td>${escapeHTML(item.country || "—")}</td>
          <td>${escapeHTML(formatDate(item.detectedAt || item.detected_at))}</td>
          <td>${badge(item.status)}</td>
          <td>
            <button data-view-risk="${escapeHTML(item.id)}">Investigate</button>
          </td>
        </tr>
      `).join("")
            : emptyRow(8);
    }

    async function openRisk(id) {
        try {
            const payload = await api(
                `${CONFIG.endpoints.risks}/${encodeURIComponent(id)}`
            );

            const item = getData(payload);

            const fields = [
                ["Risk reference", item.reference || item.id],
                ["Account", item.accountName || item.account_name],
                ["Risk category", humanize(item.category || item.type)],
                ["Severity", humanize(item.severity)],
                ["Country", item.country],
                ["Description", item.description],
                ["Detected", formatDate(item.detectedAt || item.detected_at)],
                ["Investigation status", humanize(item.status)]
            ];

            $("#detailTitle").textContent = "Identity risk investigation";

            $("#detailContent").innerHTML = fields
                .filter(([, value]) => value !== null && value !== undefined && value !== "")
                .map(([label, value]) => `
          <div class="detail-row">
            <span>${escapeHTML(label)}</span>
            <strong>${escapeHTML(value)}</strong>
          </div>
        `).join("");

            $("#detailActions").innerHTML = `
        <button class="secondary-button" data-risk-action="dismiss"
                data-risk-id="${escapeHTML(id)}">
          Dismiss
        </button>
        <button class="primary-button" data-risk-action="resolve"
                data-risk-id="${escapeHTML(id)}">
          Resolve investigation
        </button>
        <button class="secondary-button" data-close-modal>Close</button>
      `;

            showModal("detailModal");

        } catch (error) {
            toast(`Risk investigation unavailable: ${error.message}`, "error");
        }
    }

    /* ==========================================
       11. ACCOUNT ACTIVITY AND SESSIONS
       ========================================== */

    async function loadActivity() {
        try {
            const [activityPayload, sessionsPayload] = await Promise.all([
                api(CONFIG.endpoints.activity + buildQuery({
                    search: $("#activitySearch").value.trim(),
                    type: $("#activityType").value,
                    result: $("#activityResult").value
                })),
                api(CONFIG.endpoints.sessions)
            ]);

            const activityData = getData(activityPayload);
            const sessionData = getData(sessionsPayload);

            state.activity = getRecords(
                activityPayload,
                "activity",
                "events",
                "items"
            );

            state.sessions = getRecords(
                sessionsPayload,
                "sessions",
                "items"
            );

            const metrics = activityData.metrics || activityData.summary || {};

            setMetric(
                "activeSessionTotal",
                getValue(
                    sessionData,
                    "total",
                    "activeSessions",
                    "active_sessions"
                ) ?? state.sessions.length
            );

            setMetric(
                "failedLoginTotal",
                getValue(metrics, "failedLogins", "failed_logins")
            );

            setMetric(
                "privilegedActivityTotal",
                getValue(metrics, "privilegedActivity", "privileged_activity")
            );

            renderActivity(state.activity);
            renderSessions(state.sessions);

        } catch (error) {
            $("#activityTable").innerHTML =
                emptyRow(8, "Account activity could not be loaded.");

            $("#sessionTable").innerHTML = emptyRow(8);

            toast(error.message, "error");
        }
    }

    function renderActivity(items) {
        $("#activityTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.reference || item.id)}</td>
          <td>${escapeHTML(item.accountName || item.account_name || item.email || "—")}</td>
          <td>${escapeHTML(humanize(item.type || item.event))}</td>
          <td>${escapeHTML(item.ipAddress || item.ip_address || "—")}</td>
          <td>${escapeHTML(item.location || "—")}</td>
          <td>${escapeHTML(item.device || "—")}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${badge(item.result || item.status)}</td>
        </tr>
      `).join("")
            : emptyRow(8);
    }

    function renderSessions(items) {
        $("#sessionTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.reference || item.id)}</td>
          <td>${escapeHTML(item.accountName || item.account_name || item.accountId || "—")}</td>
          <td>${escapeHTML(item.device || "—")}</td>
          <td>${escapeHTML(item.ipAddress || item.ip_address || "—")}</td>
          <td>${escapeHTML(formatDate(item.startedAt || item.started_at))}</td>
          <td>${escapeHTML(formatDate(item.expiresAt || item.expires_at))}</td>
          <td>${badge(item.status)}</td>
          <td>
            ${item.status === "active"
                    ? `<button data-revoke-session="${escapeHTML(item.id)}">Revoke</button>`
                    : "—"}
          </td>
        </tr>
      `).join("")
            : emptyRow(8);
    }

    /* ==========================================
       12. BULK OPERATIONS
       ========================================== */

    async function loadBulkHistory() {
        try {
            const payload = await api(CONFIG.endpoints.bulkHistory);

            const items = getRecords(
                payload,
                "batches",
                "operations",
                "items"
            );

            $("#bulkHistoryTable").innerHTML = items.length
                ? items.map(item => `
          <tr>
            <td>${escapeHTML(item.id || item.batchId || item.batch_id)}</td>
            <td>${escapeHTML(humanize(item.operation || item.action))}</td>
            <td>${formatNumber(item.affectedAccounts ?? item.affected_accounts)}</td>
            <td>${escapeHTML(item.submittedBy || item.submitted_by || "—")}</td>
            <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
            <td>${badge(item.approvalStatus || item.approval_status)}</td>
            <td>${badge(item.status)}</td>
          </tr>
        `).join("")
                : emptyRow(7);

        } catch (error) {
            $("#bulkHistoryTable").innerHTML =
                emptyRow(7, "Bulk operation history unavailable.");
        }
    }

    function parseAccountIds(value) {
        return [...new Set(
            String(value || "")
                .split(/[\n,;\s]+/)
                .map(item => item.trim())
                .filter(Boolean)
        )];
    }

    async function previewBulkAction(form) {
        const button = form.querySelector('[type="submit"]');
        const values = formValues(form);

        const ids = parseAccountIds(values.userIds);

        if (!ids.length) {
            toast("Provide at least one account ID.", "error");
            return;
        }

        button.disabled = true;

        try {
            const payload = await api(CONFIG.endpoints.bulkPreview, {
                method: "POST",
                body: {
                    action: values.action,
                    userIds: ids,
                    reason: values.reason
                }
            });

            state.bulkPreview = {
                kind: "action",
                original: {
                    action: values.action,
                    userIds: ids,
                    reason: values.reason
                },
                response: getData(payload)
            };

            renderBulkPreview(state.bulkPreview);
            showModal("bulkPreviewModal");

        } catch (error) {
            toast(`Bulk preview failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    async function previewBulkImport(form) {
        const button = form.querySelector('[type="submit"]');
        const file = $("#bulkFile").files[0];

        if (!file) {
            toast("Select a CSV file first.", "error");
            return;
        }

        if (!file.name.toLowerCase().endsWith(".csv")) {
            toast("Only CSV files are supported.", "error");
            return;
        }

        const values = formValues(form);
        const data = new FormData();

        data.append("file", file);
        data.append("mode", values.mode);
        data.append("reason", values.reason);

        button.disabled = true;

        try {
            const payload = await api(CONFIG.endpoints.bulkImportPreview, {
                method: "POST",
                body: data
            });

            state.bulkPreview = {
                kind: "import",
                original: {
                    mode: values.mode,
                    reason: values.reason
                },
                response: getData(payload)
            };

            renderBulkPreview(state.bulkPreview);
            showModal("bulkPreviewModal");

        } catch (error) {
            toast(`Import validation failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    function renderBulkPreview(preview) {
        const data = preview.response;

        const fields = [
            ["Preview reference", data.previewId || data.preview_id || data.id],
            ["Operation", humanize(data.action || preview.original.action || preview.original.mode)],
            ["Total submitted", data.totalSubmitted ?? data.total_submitted],
            ["Eligible accounts", data.eligible ?? data.eligibleAccounts ?? data.eligible_accounts],
            ["Rejected records", data.rejected ?? data.rejectedRecords ?? data.rejected_records],
            ["Potentially affected", data.affected ?? data.affectedAccounts ?? data.affected_accounts],
            ["Approval required", data.approvalRequired ?? data.approval_required]
        ];

        const records = getRecords(data, "issues", "errors", "invalidRows", "invalid_rows");

        $("#bulkPreviewContent").innerHTML = `
      <div class="summary-list">
        ${fields.filter(([, value]) => value !== undefined && value !== null)
                .map(([label, value]) => `
            <div class="summary-row">
              <span>${escapeHTML(label)}</span>
              <strong>${escapeHTML(
                    typeof value === "boolean" ? (value ? "Yes" : "No") : value
                )}</strong>
            </div>
          `).join("")}
      </div>

      <h3>Validation findings</h3>

      ${records.length
                ? `<ul>${records.slice(0, 30).map(item => `
            <li>${escapeHTML(
                    typeof item === "string"
                        ? item
                        : item.message || item.error || JSON.stringify(item)
                )}</li>
          `).join("")}</ul>`
                : "<p>No validation findings were returned.</p>"}
    `;

        const previewId = data.previewId || data.preview_id || data.id;

        $("#submitBulkOperation").disabled =
            !previewId ||
            data.valid === false ||
            data.canSubmit === false ||
            data.can_submit === false;

        $("#submitBulkOperation").textContent =
            preview.kind === "import"
                ? "Submit validated import"
                : "Submit for authorization";
    }

    async function submitBulkOperation() {
        const preview = state.bulkPreview;

        if (!preview) return;

        const data = preview.response;

        const previewId =
            data.previewId || data.preview_id || data.id;

        if (!previewId) {
            toast("The server did not provide a valid preview reference.", "error");
            return;
        }

        const button = $("#submitBulkOperation");

        button.disabled = true;

        try {
            const payload = {
                previewId,
                previewToken: data.previewToken || data.preview_token,
                reason: preview.original.reason
            };

            if (preview.kind === "action") {
                await api(CONFIG.endpoints.bulkActions, {
                    method: "POST",
                    body: payload
                });
            } else {
                if (preview.original.mode === "validate_only") {
                    closeModal($("#bulkPreviewModal"));
                    toast("CSV validation completed. No accounts were changed.", "success");
                    return;
                }

                await api(CONFIG.endpoints.bulkImportCommit, {
                    method: "POST",
                    body: {
                        ...payload,
                        mode: preview.original.mode
                    }
                });
            }

            closeModal($("#bulkPreviewModal"));

            state.bulkPreview = null;
            state.selectedUserIds.clear();

            toast(
                "Bulk operation submitted. Server-side authorization and approval workflows apply.",
                "success"
            );

            await Promise.all([
                loadBulkHistory(),
                loadOverview(),
                loadDirectory()
            ]);

        } catch (error) {
            toast(`Bulk operation failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    /* ==========================================
       13. IDENTITY AUDIT CENTRE
       ========================================== */

    async function loadAudit() {
        try {
            const payload = await api(
                CONFIG.endpoints.audit + buildQuery({
                    search: $("#auditSearch").value.trim(),
                    action: $("#auditAction").value,
                    result: $("#auditResult").value
                })
            );

            state.auditRecords = getRecords(
                payload,
                "audit",
                "records",
                "items"
            );

            renderAudit(state.auditRecords);

        } catch (error) {
            $("#auditTable").innerHTML =
                emptyRow(8, "Identity audit records could not be loaded.");

            toast(error.message, "error");
        }
    }

    function renderAudit(items) {
        $("#auditTable").innerHTML = items.length
            ? items.map(item => `
        <tr>
          <td>${escapeHTML(item.reference || item.id)}</td>
          <td>${escapeHTML(item.administrator || item.actorName || item.actor_name || "—")}</td>
          <td>${escapeHTML(item.targetAccount || item.target_account || "—")}</td>
          <td>${escapeHTML(humanize(item.action || item.operation))}</td>
          <td>${escapeHTML(item.reason || "—")}</td>
          <td>${escapeHTML(formatDate(item.createdAt || item.created_at))}</td>
          <td>${badge(item.result || item.status)}</td>
          <td>
            <button data-audit-detail="${escapeHTML(item.id)}">Details</button>
          </td>
        </tr>
      `).join("")
            : emptyRow(8);
    }

    async function openAuditDetail(id) {
        try {
            const payload = await api(
                `${CONFIG.endpoints.audit}/${encodeURIComponent(id)}`
            );

            const item = getData(payload);

            const fields = [
                ["Audit reference", item.id || item.reference],
                ["Administrator", item.administrator || item.actorName || item.actor_name],
                ["Target account", item.targetAccount || item.target_account],
                ["Operation", humanize(item.action || item.operation)],
                ["Reason", item.reason],
                ["Previous state", item.previousState || item.previous_state],
                ["New state", item.newState || item.new_state],
                ["Result", humanize(item.result || item.status)],
                ["Timestamp", formatDate(item.createdAt || item.created_at)],
                ["Approval reference", item.approvalReference || item.approval_reference]
            ];

            $("#detailTitle").textContent = "Identity audit record";

            $("#detailContent").innerHTML = fields
                .filter(([, value]) => value !== null && value !== undefined && value !== "")
                .map(([label, value]) => `
          <div class="detail-row">
            <span>${escapeHTML(label)}</span>
            <strong>${escapeHTML(value)}</strong>
          </div>
        `).join("");

            $("#detailActions").innerHTML =
                '<button class="secondary-button" data-close-modal>Close</button>';

            showModal("detailModal");

        } catch (error) {
            toast(`Audit details unavailable: ${error.message}`, "error");
        }
    }

    /* ==========================================
       PROTECTED OPERATIONS
       ========================================== */

    function requestProtectedAction(action) {
        state.pendingAction = action;

        $("#confirmationTitle").textContent =
            action.title || "Confirm protected operation";

        $("#confirmationMessage").textContent =
            action.message || "This operation requires authorization and will be recorded.";

        $("#confirmationReason").value = "";
        $("#confirmationText").value = "";

        $("#confirmOperation").disabled = true;

        showModal("confirmationModal");
    }

    function validateConfirmation() {
        const reason = $("#confirmationReason").value.trim();

        const confirmation =
            $("#confirmationText").value.trim();

        $("#confirmOperation").disabled =
            !reason || confirmation !== "CONFIRM";
    }

    async function executeProtectedAction() {
        const action = state.pendingAction;

        if (!action) return;

        const reason = $("#confirmationReason").value.trim();

        if (!reason || $("#confirmationText").value.trim() !== "CONFIRM") {
            toast("Provide a reason and type CONFIRM.", "error");
            return;
        }

        const button = $("#confirmOperation");

        button.disabled = true;

        try {
            const body = {
                action: action.action,
                decision: action.decision,
                reason,
                source: "global_identity_management"
            };

            let path;

            switch (action.kind) {
                case "user":
                    path = `${CONFIG.endpoints.users}/${encodeURIComponent(action.id)}/actions`;
                    break;

                case "verification":
                    path = `${CONFIG.endpoints.verification}/${encodeURIComponent(action.id)}/decision`;
                    break;

                case "suspension":
                    path = `${CONFIG.endpoints.suspensions}/${encodeURIComponent(action.id)}/actions`;
                    break;

                case "session":
                    path = `${CONFIG.endpoints.sessions}/${encodeURIComponent(action.id)}/revoke`;
                    break;

                case "risk":
                    path = `${CONFIG.endpoints.risks}/${encodeURIComponent(action.id)}/actions`;
                    break;

                default:
                    throw new Error("Unsupported protected operation.");
            }

            await api(path, {
                method: "POST",
                body
            });

            closeModal($("#confirmationModal"));
            closeModal($("#detailModal"));
            closeModal($("#verificationModal"));

            state.pendingAction = null;

            toast(
                "Operation submitted successfully. The server determines its final authorization and execution status.",
                "success"
            );

            await refreshCurrentSection();

        } catch (error) {
            toast(`Protected operation failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    /* ==========================================
       REFRESH AND EXPORT
       ========================================== */

    async function refreshCurrentSection() {
        const loader = LOADERS[state.currentSection];

        if (loader) {
            await loader();
        }

        await loadOverview();
    }

    async function refreshAll() {
        setConnection("error", "Refreshing");

        await Promise.allSettled([
            loadOverview(),
            loadCountries()
        ]);

        const loader = LOADERS[state.currentSection];

        if (loader && state.currentSection !== "overview") {
            await loader();
        }

        setConnection("connected", "Connected");
    }

    async function exportRecords(type) {
        await downloadFile(
            CONFIG.endpoints.exports + buildQuery({
                type,
                format: "csv"
            }),
            `talvora-${type}.csv`
        );
    }

    /* ==========================================
       SEARCH DEBOUNCING
       ========================================== */

    function debounce(callback, delay = 350) {
        let timer;

        return (...args) => {
            clearTimeout(timer);

            timer = setTimeout(() => {
                callback(...args);
            }, delay);
        };
    }

    /* ==========================================
       ACCOUNT REGISTRATION
       ========================================== */

    async function createAccount(form) {
        const button = form.querySelector('[type="submit"]');
        const payload = formValues(form);

        button.disabled = true;

        try {
            await api(CONFIG.endpoints.users, {
                method: "POST",
                body: payload
            });

            form.reset();
            closeModal($("#createUserModal"));

            toast(
                "Account registration submitted for server-side validation.",
                "success"
            );

            await Promise.all([
                loadDirectory(),
                loadOverview()
            ]);

        } catch (error) {
            toast(`Account registration failed: ${error.message}`, "error");
        } finally {
            button.disabled = false;
        }
    }

    /* ==========================================
       EVENT BINDING
       ========================================== */

    function bindEvents() {

        /* Navigation */

        $$(".nav-link[data-section]").forEach(link => {
            link.addEventListener("click", event => {
                event.preventDefault();
                navigate(link.dataset.section);
            });
        });

        $$("[data-navigate]").forEach(button => {
            button.addEventListener("click", () => {
                navigate(button.dataset.navigate);
            });
        });

        $("#menuToggle").addEventListener("click", () => {
            $("#sidebar").classList.toggle("open");
        });

        /* Main actions */

        $("#refreshButton").addEventListener("click", refreshCurrentSection);

        $("#notificationButton").addEventListener("click", () => {
            navigate("risks");
        });

        $("#createUserButton").addEventListener("click", () => {
            showModal("createUserModal");
        });

        $("#createUserForm").addEventListener("submit", event => {
            event.preventDefault();
            createAccount(event.currentTarget);
        });

        /* User directory */

        const refreshDirectory = debounce(() => {
            state.currentPage = 1;
            loadDirectory();
        });

        $("#userSearch").addEventListener("input", refreshDirectory);
        $("#userTypeFilter").addEventListener("change", refreshDirectory);
        $("#userStatusFilter").addEventListener("change", refreshDirectory);
        $("#userCountryFilter").addEventListener("change", refreshDirectory);

        $("#clearUserFilters").addEventListener("click", () => {
            $("#userSearch").value = "";
            $("#userTypeFilter").value = "";
            $("#userStatusFilter").value = "";
            $("#userCountryFilter").value = "";

            state.currentPage = 1;

            loadDirectory();
        });

        $("#previousUsers").addEventListener("click", () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                loadDirectory();
            }
        });

        $("#nextUsers").addEventListener("click", () => {
            if (state.currentPage < state.totalPages) {
                state.currentPage++;
                loadDirectory();
            }
        });

        $("#selectAllUsers").addEventListener("click", () => {
            state.users.forEach(user => {
                const id = String(user.id || user.userId || user.user_id);

                state.selectedUserIds.add(id);
            });

            renderDirectory(state.users);
            updateSelection();
        });

        $("#selectPageCheckbox").addEventListener("change", event => {
            state.users.forEach(user => {
                const id = String(user.id || user.userId || user.user_id);

                if (event.target.checked) {
                    state.selectedUserIds.add(id);
                } else {
                    state.selectedUserIds.delete(id);
                }
            });

            renderDirectory(state.users);
            updateSelection();
        });

        $("#openBulkOperations").addEventListener("click", () => {
            const ids = [...state.selectedUserIds];

            if (!ids.length) {
                toast("Select at least one account first.", "error");
                return;
            }

            $("#bulkUserIds").value = ids.join("\n");

            navigate("bulk");
        });

        /* Employees */

        $("#employeeSearch").addEventListener(
            "input",
            debounce(loadEmployees)
        );

        $("#employeeStatus").addEventListener("change", loadEmployees);
        $("#employeeCountry").addEventListener("change", loadEmployees);

        /* Employers */

        $("#employerSearch").addEventListener(
            "input",
            debounce(loadEmployers)
        );

        $("#employerStatus").addEventListener("change", loadEmployers);
        $("#employerVerification").addEventListener("change", loadEmployers);

        /* Administrators */

        $("#adminSearch").addEventListener(
            "input",
            debounce(loadAdministrators)
        );

        $("#adminRole").addEventListener("change", loadAdministrators);
        $("#adminStatus").addEventListener("change", loadAdministrators);

        /* Verification */

        $("#verificationSearch").addEventListener(
            "input",
            debounce(loadVerification)
        );

        $("#verificationType").addEventListener("change", loadVerification);
        $("#verificationStatus").addEventListener("change", loadVerification);

        /* Permissions */

        $("#createRoleButton").addEventListener("click", () => {
            openRoleModal();
        });

        $("#roleForm").addEventListener("submit", event => {
            event.preventDefault();
            saveRole(event.currentTarget);
        });

        $("#assignmentSearch").addEventListener(
            "input",
            debounce(() => {
                loadPermissions();
            })
        );

        /* Suspensions */

        $("#suspensionSearch").addEventListener(
            "input",
            debounce(loadSuspensions)
        );

        $("#suspensionStatus").addEventListener("change", loadSuspensions);
        $("#suspensionType").addEventListener("change", loadSuspensions);

        /* Lifecycle */

        $("#lifecycleSearch").addEventListener(
            "input",
            debounce(loadLifecycle)
        );

        $("#lifecycleStatus").addEventListener("change", loadLifecycle);

        /* Risks */

        $("#riskSearch").addEventListener(
            "input",
            debounce(loadRisks)
        );

        $("#riskSeverity").addEventListener("change", loadRisks);
        $("#riskStatus").addEventListener("change", loadRisks);

        /* Activity */

        $("#activitySearch").addEventListener(
            "input",
            debounce(loadActivity)
        );

        $("#activityType").addEventListener("change", loadActivity);
        $("#activityResult").addEventListener("change", loadActivity);

        /* Bulk operations */

        $("#bulkActionForm").addEventListener("submit", event => {
            event.preventDefault();
            previewBulkAction(event.currentTarget);
        });

        $("#bulkImportForm").addEventListener("submit", event => {
            event.preventDefault();
            previewBulkImport(event.currentTarget);
        });

        $("#submitBulkOperation").addEventListener(
            "click",
            submitBulkOperation
        );

        /* Audit */

        $("#auditSearch").addEventListener(
            "input",
            debounce(loadAudit)
        );

        $("#auditAction").addEventListener("change", loadAudit);
        $("#auditResult").addEventListener("change", loadAudit);

        $("#exportAudit").addEventListener("click", () => {
            exportRecords("identity_audit");
        });

        $("#exportOverview").addEventListener("click", () => {
            exportRecords("identity_overview");
        });

        /* Confirmation */

        $("#confirmationReason").addEventListener(
            "input",
            validateConfirmation
        );

        $("#confirmationText").addEventListener(
            "input",
            validateConfirmation
        );

        $("#confirmOperation").addEventListener(
            "click",
            executeProtectedAction
        );

        /* Dynamic account and operation controls */

        document.addEventListener("change", event => {
            const checkbox = event.target.closest("[data-select-user]");

            if (checkbox) {
                toggleSelectedUser(
                    checkbox.dataset.selectUser,
                    checkbox.checked
                );
            }
        });

        document.addEventListener("click", event => {

            const viewUser = event.target.closest("[data-view-user]");

            if (viewUser) {
                openUserDetails(viewUser.dataset.viewUser);
                return;
            }

            const detailAction = event.target.closest("[data-detail-action]");

            if (detailAction) {
                const action = detailAction.dataset.detailAction;
                const user = state.activeUser;

                if (!user) return;

                if (action === "assign_role") {
                    openAssignmentModal(user);
                    return;
                }

                const messages = {
                    suspend: "This may restrict the account from accessing TALVORA.",
                    deactivate: "This will request account deactivation.",
                    reinstate: "This will request account reinstatement.",
                    revoke_sessions: "This will request revocation of the account's active sessions."
                };

                requestProtectedAction({
                    kind: "user",
                    id: user.id,
                    action,
                    title: humanize(action) + " account",
                    message: messages[action]
                });

                return;
            }

            const viewVerification =
                event.target.closest("[data-view-verification]");

            if (viewVerification) {
                openVerification(viewVerification.dataset.viewVerification);
                return;
            }

            const verificationAction =
                event.target.closest("[data-verification-action]");

            if (verificationAction) {
                const item = state.activeVerification;

                if (!item) return;

                const decision = verificationAction.dataset.verificationAction;

                const messages = {
                    approve: "Approving this case records a verification decision.",
                    reject: "Rejecting this case records a verification rejection.",
                    request_information: "This will request additional identity information."
                };

                requestProtectedAction({
                    kind: "verification",
                    id: item.id,
                    decision,
                    title: humanize(decision) + " verification",
                    message: messages[decision]
                });

                return;
            }

            const suspensionAction =
                event.target.closest("[data-suspension-action]");

            if (suspensionAction) {
                const id = suspensionAction.dataset.suspensionId;

                requestProtectedAction({
                    kind: "suspension",
                    id,
                    action: "reinstate",
                    title: "Review account reinstatement",
                    message: "This requests a review of the existing account suspension."
                });

                return;
            }

            const viewRisk = event.target.closest("[data-view-risk]");

            if (viewRisk) {
                openRisk(viewRisk.dataset.viewRisk);
                return;
            }

            const riskAction = event.target.closest("[data-risk-action]");

            if (riskAction) {
                const id = riskAction.dataset.riskId;

                requestProtectedAction({
                    kind: "risk",
                    id,
                    action: riskAction.dataset.riskAction,
                    title: "Update identity risk investigation",
                    message: "This action will change the investigation status and be recorded."
                });

                return;
            }

            const revokeSession = event.target.closest("[data-revoke-session]");

            if (revokeSession) {
                requestProtectedAction({
                    kind: "session",
                    id: revokeSession.dataset.revokeSession,
                    action: "revoke",
                    title: "Revoke account session",
                    message: "The selected authenticated session will be submitted for revocation."
                });

                return;
            }

            const editRole = event.target.closest("[data-edit-role]");

            if (editRole) {
                const role = state.roles.find(
                    item => String(item.id) === String(editRole.dataset.editRole)
                );

                if (role) openRoleModal(role);

                return;
            }

            const editAssignment =
                event.target.closest("[data-edit-assignment]");

            if (editAssignment) {
                editAssignment(editAssignment.dataset.editAssignment);
                return;
            }

            const auditDetail = event.target.closest("[data-audit-detail]");

            if (auditDetail) {
                openAuditDetail(auditDetail.dataset.auditDetail);
            }
        });

        /* Modal closing */

        document.addEventListener("click", event => {
            const closeButton = event.target.closest("[data-close-modal]");

            if (closeButton) {
                closeModal(closeButton.closest(".modal-overlay"));
            }
        });

        $$(".modal-overlay").forEach(modal => {
            modal.addEventListener("click", event => {
                if (event.target === modal) {
                    closeModal(modal);
                }
            });
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closeAllModals();
            }
        });
    }

    /* ==========================================
       INITIALIZATION
       ========================================== */

    async function initialize() {
        bindEvents();
        ensureAssignmentModal();

        setConnection("error", "Connecting");

        await Promise.allSettled([
            loadOverview(),
            loadCountries()
        ]);

        if (state.refreshTimer) {
            clearInterval(state.refreshTimer);
        }

        state.refreshTimer = setInterval(() => {
            if (state.currentSection === "overview") {
                loadOverview();
            }
        }, CONFIG.refreshInterval);
    }

    /* ==========================================
       PUBLIC MODULE INTERFACE
       ========================================== */

    window.TALVORA_IDENTITY = {
        refresh: refreshAll,
        navigate,
        loadOverview,
        loadDirectory,
        loadEmployees,
        loadEmployers,
        loadAdministrators,
        loadVerification,
        loadPermissions,
        loadSuspensions,
        loadLifecycle,
        loadRisks,
        loadActivity,
        loadBulkHistory,
        loadAudit,
        openUserDetails,
        exportRecords,
        config: CONFIG
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, {
            once: true
        });
    } else {
        initialize();
    }

})();
