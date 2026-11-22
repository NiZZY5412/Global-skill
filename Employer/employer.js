
/* ============================================================
   TALVORA GLOBAL EMPLOYER ENTERPRISE PORTAL
   SHARED JAVASCRIPT CONTROL ENGINE

   CORE MODULES:
   1. Employer Dashboard
   2. Company Profile & Verification
   3. Global Branches & Work Locations

   SHARED SERVICES:
   - API communication
   - Company selection
   - Authentication integration
   - Navigation
   - Notifications
   - Form validation
   - Error handling
   - CSV exports
   - Module routing

   MODULE 3:
   - Branch management
   - Subsidiaries
   - Corporate hierarchy
   - Departments
   - Workplace allocation
   - Location managers
   - Access permissions
   - Geographic analytics

   SECURITY:
   All authorization and permission enforcement must
   be implemented and validated by the backend.
============================================================ */

(() => {
    "use strict";

    /* ========================================================
       1. GLOBAL CONFIGURATION
    ======================================================== */

    const CONFIG = Object.assign({}, window.TALVORA_CONFIG || {}, {
        getAccessToken: window.TALVORA_CONFIG?.getAccessToken ||
            (() => sessionStorage.getItem("talvora_employer_access_token") || "")
    });

    const AUTH_URL = "../Auth/auth.html?portal=employer";

    function hasEmployerSession() {
        try {
            return Boolean(sessionStorage.getItem("talvora_employer_access_token"));
        } catch (_) {
            return false;
        }
    }

    const MODULE =
        document.body.dataset.module ||
        "dashboard";

    const SELECTED_COMPANY_KEY =
        "talvora_employer_company_id";

    const state = {
        initialized: false,
        companyId: null,
        companies: [],
        user: null,
        module: MODULE,
        loading: false
    };

    const moduleRegistry = Object.create(null);

    const $ = id => document.getElementById(id);

    function getRegisteredUser() {
        try {
            return JSON.parse(sessionStorage.getItem("talvora_employer_user") || "null") || {};
        } catch (_) {
            return {};
        }
    }

    function registeredUserName(user = getRegisteredUser()) {
        const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
        return name || user.name || user.displayName || "Employer";
    }

    function renderRegisteredUser(user = getRegisteredUser()) {
        const name = registeredUserName(user);
        setText("welcomeName", name);
        setText("userName", name);
        setText("userAvatar", name.charAt(0).toUpperCase());
    }


    /* ========================================================
       2. SAFE UTILITIES
    ======================================================== */

    function escapeText(value, fallback = "—") {
        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {
            return fallback;
        }

        return String(value);
    }

    function formatNumber(value) {
        const number = Number(value);

        return Number.isFinite(number)
            ? number.toLocaleString()
            : "—";
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
            .replace(/\b\w/g, char => char.toUpperCase());
    }

    function getData(response) {
        return response?.data ?? response ?? {};
    }

    function createElement(tag, className = "", value) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (value !== undefined) {
            element.textContent = String(value);
        }

        return element;
    }

    function setText(id, value) {
        const element = $(id);

        if (element) {
            element.textContent = escapeText(value);
        }
    }

    function showToast(message, type = "info") {
        const region = $("toastRegion");

        if (!region) {
            console.log("[TALVORA]", message);
            return;
        }

        const toast = createElement(
            "div",
            `toast ${type}`,
            message
        );

        toast.setAttribute("role", "status");

        region.appendChild(toast);

        window.setTimeout(() => {
            toast.remove();
        }, 4500);
    }

    function statusClass(status) {
        const value = String(status || "").toLowerCase();

        if ([
            "active",
            "approved",
            "verified",
            "operational",
            "completed"
        ].includes(value)) {
            return "verified";
        }

        if ([
            "pending",
            "processing",
            "under_review"
        ].includes(value)) {
            return "pending";
        }

        if ([
            "suspended",
            "closed",
            "rejected",
            "inactive",
            "failed"
        ].includes(value)) {
            return "rejected";
        }

        return "neutral";
    }

    function makeBadge(status) {
        return createElement(
            "span",
            `status-badge ${statusClass(status)}`,
            formatLabel(status)
        );
    }

    function showEmpty(container, message) {
        if (!container) return;

        container.replaceChildren();

        const empty = createElement(
            "div",
            "location-empty"
        );

        empty.appendChild(
            createElement("p", "", message)
        );

        container.appendChild(empty);
    }

    function showTableEmpty(container, columns, message) {
        if (!container) return;

        container.replaceChildren();

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = columns;
        cell.textContent = message;

        row.appendChild(cell);
        container.appendChild(row);
    }

    function setConnection(message, status = "") {
        const label = $("connectionStatus");

        const indicator = document.querySelector(
            ".locations-connection .status-indicator"
        );

        if (label) {
            label.textContent = message;
        }

        if (indicator) {
            indicator.className =
                `status-indicator ${status}`;
        }
    }

    function setButtonLoading(button, loading, label) {
        if (!button) return;

        if (loading) {
            if (!button.dataset.originalText) {
                button.dataset.originalText =
                    button.textContent;
            }

            button.disabled = true;
            button.textContent = label;

        } else {
            button.disabled = false;

            button.textContent =
                button.dataset.originalText || label;

            delete button.dataset.originalText;
        }
    }

    function formObject(form) {
        const result = {};

        new FormData(form).forEach((value, key) => {
            if (value instanceof File) return;

            result[key] = value;
        });

        return result;
    }


    /* ========================================================
       3. CENTRAL API COMMUNICATION ENGINE
    ======================================================== */

    async function api(endpoint, options = {}) {
        const baseURL =
            CONFIG.apiBaseUrl || "";

        const url =
            /^https?:\/\//i.test(endpoint)
                ? endpoint
                : baseURL.replace(/\/$/, "") +
                endpoint;

        const headers = new Headers(
            options.headers || {}
        );

        headers.set("Accept", "application/json");

        let body = options.body;

        if (
            body !== undefined &&
            body !== null &&
            !(body instanceof FormData) &&
            !(body instanceof Blob) &&
            typeof body !== "string"
        ) {
            headers.set(
                "Content-Type",
                "application/json"
            );

            body = JSON.stringify(body);
        }

        const csrf = document.querySelector(
            'meta[name="csrf-token"]'
        )?.content;

        if (csrf) {
            headers.set("X-CSRF-Token", csrf);
        }

        if (typeof CONFIG.getAccessToken === "function") {
            const token = await CONFIG.getAccessToken();

            if (token) {
                headers.set(
                    "Authorization",
                    `Bearer ${token}`
                );
            }
        }

        const response = await fetch(url, {
            method: options.method || "GET",
            headers,
            body,
            credentials: CONFIG.credentials || "include",
            signal: options.signal
        });

        if (response.status === 204) {
            return {};
        }

        const raw = await response.text();

        let result = {};

        if (raw) {
            try {
                result = JSON.parse(raw);
            } catch {
                result = {
                    message: raw
                };
            }
        }

        if (!response.ok || result.success === false) {
            throw new Error(
                result.message ||
                result.error ||
                `Request failed (${response.status})`
            );
        }

        return result;
    }


    /* ========================================================
       4. COMPANY CONTEXT
    ======================================================== */

    function getCompanyId() {
        return (
            state.companyId ||
            CONFIG.companyId ||
            document.body.dataset.companyId ||
            null
        );
    }

    function companyPath(suffix = "") {
        const id = getCompanyId();

        if (!id) {
            throw new Error(
                "Select an organization before continuing."
            );
        }

        return (
            "/api/employer/companies/" +
            encodeURIComponent(id) +
            suffix
        );
    }

    function setCompanyId(id) {
        state.companyId = id ? String(id) : null;

        try {
            if (state.companyId) {
                localStorage.setItem(
                    SELECTED_COMPANY_KEY,
                    state.companyId
                );
            } else {
                localStorage.removeItem(
                    SELECTED_COMPANY_KEY
                );
            }
        } catch (error) {
            console.warn(
                "Company selection could not be persisted.",
                error
            );
        }
    }

    async function loadCompanies() {
        const selector = $("companySwitcher");

        if (!selector) return;

        try {
            const result = await api(
                "/api/employer/companies"
            );

            const data = getData(result);

            const companies =
                Array.isArray(data)
                    ? data
                    : data.companies ||
                    data.items ||
                    [];

            state.companies = companies;

            let stored = null;

            try {
                stored = localStorage.getItem(
                    SELECTED_COMPANY_KEY
                );
            } catch {
                stored = null;
            }

            const preferred =
                CONFIG.companyId ||
                document.body.dataset.companyId ||
                stored;

            const exists = companies.some(item =>
                String(item.id) === String(preferred)
            );

            if (exists) {
                setCompanyId(preferred);

            } else if (companies.length) {
                setCompanyId(companies[0].id);

            } else {
                setCompanyId(null);
            }

            selector.replaceChildren();

            if (!companies.length) {
                const option = createElement(
                    "option",
                    "",
                    "No organizations available"
                );

                option.value = "";
                selector.appendChild(option);

                return;
            }

            companies.forEach(company => {
                const option = createElement(
                    "option",
                    "",
                    company.legalName ||
                    company.name ||
                    "Organization"
                );

                option.value = company.id;

                selector.appendChild(option);
            });

            selector.value = getCompanyId() || "";

        } catch (error) {
            console.error(
                "Organization loading failed:",
                error
            );

            selector.replaceChildren();

            const option = createElement(
                "option",
                "",
                "Unable to load organizations"
            );

            option.value = "";

            selector.appendChild(option);

            showToast(
                "Unable to load organizations. Check your connection.",
                "error"
            );
        }
    }


    /* ========================================================
       5. SHARED NAVIGATION & WORKSPACE
    ======================================================== */

    function bindSharedNavigation() {
        $("menuToggle")?.addEventListener(
            "click",
            () => {
                $("sidebar")?.classList.toggle("is-open");
            }
        );

        document.querySelectorAll(
            ".sidebar-navigation .nav-link"
        ).forEach(link => {
            link.addEventListener("click", () => {
                $("sidebar")?.classList.remove("is-open");
            });
        });

        $("notificationToggle")?.addEventListener(
            "click",
            () => {
                const panel = $("notificationPanel");

                if (panel) {
                    panel.hidden = !panel.hidden;
                }
            }
        );

        $("companySwitcher")?.addEventListener(
            "change",
            async event => {
                const id = event.target.value;

                if (!id) return;

                setCompanyId(id);

                try {
                    await loadActiveModule();
                } catch (error) {
                    showToast(error.message, "error");
                }
            }
        );

        $("currentYear")?.replaceChildren(
            document.createTextNode(
                String(new Date().getFullYear())
            )
        );

        const search = $("globalSearch");

        search?.addEventListener("input", event => {
            const query =
                event.target.value.trim().toLowerCase();

            document.querySelectorAll(
                ".sidebar-navigation .nav-link"
            ).forEach(link => {
                link.hidden =
                    query.length > 0 &&
                    !link.textContent.toLowerCase().includes(query);
            });
        });

        document.addEventListener("click", event => {
            const panel = $("notificationPanel");

            if (
                panel &&
                !panel.hidden &&
                !panel.contains(event.target) &&
                !$("notificationToggle")?.contains(event.target)
            ) {
                panel.hidden = true;
            }
        });
    }


    /* ========================================================
       6. DASHBOARD MODULE INTEGRATION
    ======================================================== */

    async function loadDashboard() {
        if (!getCompanyId()) return;

        const result = await api(
            "/api/employer/dashboard?companyId=" +
            encodeURIComponent(getCompanyId())
        );

        const data = getData(result);

        const fields = {
            totalJobs: data.totalJobs,
            activeJobs: data.activeJobs,
            totalApplications: data.totalApplications,
            totalEmployees: data.totalEmployees,
            pendingApplications: data.pendingApplications,
            interviewsScheduled: data.interviewsScheduled
        };

        Object.entries(fields).forEach(([id, value]) => {
            if (value !== undefined) {
                setText(id, formatNumber(value));
            }
        });

        const user = data.user || {};

        if (user.name) {
            setText("userName", user.name);

            setText(
                "userAvatar",
                user.name.charAt(0).toUpperCase()
            );
        }

        if (user.role) {
            setText("userRole", formatLabel(user.role));
        }
    }


    /* ========================================================
       7. COMPANY PROFILE MODULE INTEGRATION
    ======================================================== */

    async function loadCompanyProfile() {
        if (!getCompanyId()) return;

        const result = await api(
            companyPath()
        );

        const data = getData(result);

        const company =
            data.company || data;

        state.currentCompany = company;

        const fields = [
            "legalName",
            "name",
            "registrationNumber",
            "taxNumber",
            "industry",
            "website",
            "email",
            "phone",
            "country",
            "city",
            "address",
            "postalCode",
            "description",
            "verificationStatus"
        ];

        fields.forEach(field => {
            const element = $(field);

            if (!element) return;

            const value = company[field] ?? "";

            if (
                element instanceof HTMLInputElement ||
                element instanceof HTMLTextAreaElement ||
                element instanceof HTMLSelectElement
            ) {
                element.value = value;
            } else {
                element.textContent = escapeText(value);
            }
        });

        const status = $("companyVerificationStatus");

        if (status) {
            status.replaceChildren(
                makeBadge(company.verificationStatus)
            );
        }
    }


    async function saveCompanyProfile(event) {
        event.preventDefault();

        const form = $("companyProfileForm");

        if (!form || !form.reportValidity()) return;

        const button = form.querySelector(
            '[type="submit"]'
        );

        setButtonLoading(
            button,
            true,
            "Saving..."
        );

        try {
            await api(companyPath(), {
                method: "PATCH",
                body: formObject(form)
            });

            showToast(
                "Company profile updated successfully.",
                "success"
            );

            await loadCompanyProfile();

        } catch (error) {
            showToast(error.message, "error");

        } finally {
            setButtonLoading(
                button,
                false,
                "Save Changes"
            );
        }
    }


    /* ========================================================
       8. MODULE REGISTRY & ROUTING
    ======================================================== */

    function registerModule(name, module) {
        moduleRegistry[name] = module;
    }

    async function loadActiveModule() {
        if (!getCompanyId()) {
            if (MODULE === "locations") {
                renderNoCompany();
            }

            return;
        }

        if (moduleRegistry[MODULE]) {
            return moduleRegistry[MODULE].load();
        }

        if (MODULE === "dashboard") {
            return loadDashboard();
        }

        if (MODULE === "company-profile") {
            return loadCompanyProfile();
        }

        console.info(
            `[TALVORA] No page-specific loader registered for ${MODULE}.`
        );
    }


    /* ========================================================
       9. SHARED INITIALIZATION
    ======================================================== */

    async function initialize() {
        if (state.initialized) return;

        if (!hasEmployerSession()) {
            window.location.replace(AUTH_URL);
            return;
        }

        state.initialized = true;

        renderRegisteredUser();

        bindSharedNavigation();

        $("companyProfileForm")?.addEventListener(
            "submit",
            saveCompanyProfile
        );

        try {
            await loadCompanies();

            if (MODULE === "locations") {
                locationsModule.bind();
            }

            await loadActiveModule();

        } catch (error) {
            console.error(
                "[TALVORA] Module initialization error:",
                error
            );

            showToast(error.message, "error");
        }
    }


    /* ========================================================
       10. PUBLIC SHARED ENGINE
    ======================================================== */

    window.TALVORA_EMPLOYER = {
        api,
        getCompanyId,
        setCompanyId,
        companyPath,
        registerModule,
        loadActiveModule,
        getModule: () => MODULE,
        getCompanies: () => [...state.companies]
    };


    /* ============================================================
       MODULE 3
       GLOBAL BRANCHES, SUBSIDIARIES & WORK LOCATIONS
    ============================================================ */

    const locationsState = {
        initialized: false,
        loading: false,
        company: null,
        locations: [],
        subsidiaries: [],
        departments: [],
        managers: [],
        analytics: {},
        filteredLocations: [],
        selectedLocationId: null
    };


    /* ========================================================
       11. LOCATION HELPERS
    ======================================================== */

    function locationName(item) {
        return (
            item.name ||
            item.displayName ||
            item.locationName ||
            "Unnamed Location"
        );
    }

    function locationStatus(item) {
        return String(
            item.status ||
            item.operationalStatus ||
            "unknown"
        ).toLowerCase();
    }

    function locationCountry(item) {
        return item.country || "";
    }

    function locationWorkforce(item) {
        const value =
            item.workforceCount ??
            item.employeeCount ??
            item.metrics?.workforce ??
            item.metrics?.employees;

        if (value === undefined || value === null) {
            return null;
        }

        const parsed = Number(value);

        return Number.isFinite(parsed) ? parsed : null;
    }

    function locationJobs(item) {
        const value =
            item.openJobs ??
            item.openJobsCount ??
            item.metrics?.openJobs;

        if (value === undefined || value === null) {
            return null;
        }

        const parsed = Number(value);

        return Number.isFinite(parsed) ? parsed : null;
    }

    function locationManager(item) {
        if (typeof item.manager === "string") {
            return item.manager;
        }

        return (
            item.manager?.name ||
            item.manager?.fullName ||
            item.managerName ||
            "Not assigned"
        );
    }


    /* ========================================================
       12. LOAD GLOBAL LOCATIONS
    ======================================================== */

    async function loadLocations() {
        if (locationsState.loading) return;

        if (!getCompanyId()) {
            renderNoCompany();
            return;
        }

        locationsState.loading = true;

        setConnection(
            "Loading global organization data..."
        );

        try {
            const result = await api(
                companyPath(
                    "/locations?include=departments,managers,analytics,group"
                )
            );

            const data = getData(result);

            locationsState.company =
                data.company || locationsState.company;

            locationsState.locations =
                Array.isArray(data.locations)
                    ? data.locations
                    : [];

            locationsState.subsidiaries =
                Array.isArray(data.subsidiaries)
                    ? data.subsidiaries
                    : [];

            locationsState.departments =
                Array.isArray(data.departments)
                    ? data.departments
                    : [];

            locationsState.managers =
                Array.isArray(data.managers)
                    ? data.managers
                    : [];

            locationsState.analytics =
                data.analytics || {};

            renderAllLocations();

            setConnection(
                "Connected to TALVORA",
                "connected"
            );

            const updated = $("locationsLastUpdated");

            if (updated) {
                updated.textContent =
                    `Updated ${new Date().toLocaleTimeString()}`;
            }

        } catch (error) {
            setConnection(
                "Unable to load location data",
                "error"
            );

            renderLocationErrors();

            showToast(error.message, "error");

        } finally {
            locationsState.loading = false;
        }
    }


    function renderNoCompany() {
        const targets = [
            ["locationTableBody", 8],
            ["subsidiaryTableBody", 5],
            ["departmentTableBody", 6],
            ["managerTableBody", 7],
            ["overviewRecentLocations", 5]
        ];

        targets.forEach(([id, columns]) => {
            showTableEmpty(
                $(id),
                columns,
                "Select an organization to view records."
            );
        });

        showEmpty(
            $("corporateGroupTree"),
            "Select an organization to view its corporate structure."
        );

        setConnection("No organization selected");
    }


    function renderLocationErrors() {
        [
            ["locationTableBody", 8],
            ["subsidiaryTableBody", 5],
            ["departmentTableBody", 6],
            ["managerTableBody", 7]
        ].forEach(([id, columns]) => {
            showTableEmpty(
                $(id),
                columns,
                "Unable to load records. Please try again."
            );
        });
    }


    /* ========================================================
       13. LOCATION KPI STATISTICS
    ======================================================== */

    function renderLocationKPIs() {
        const records = locationsState.locations;

        const active = records.filter(item =>
            locationStatus(item) === "active"
        ).length;

        const countries = new Set(
            records
                .map(locationCountry)
                .filter(Boolean)
                .map(value => value.toLowerCase())
        );

        const workforceValues = records
            .map(locationWorkforce)
            .filter(value => value !== null);

        const jobValues = records
            .map(locationJobs)
            .filter(value => value !== null);

        const workforce = workforceValues.length
            ? workforceValues.reduce((a, b) => a + b, 0)
            : null;

        const jobs = jobValues.length
            ? jobValues.reduce((a, b) => a + b, 0)
            : null;

        setText("totalLocations", formatNumber(records.length));
        setText("activeLocations", formatNumber(active));
        setText("locationCountries", formatNumber(countries.size));
        setText("locationWorkforce", formatNumber(workforce));
        setText("locationOpenJobs", formatNumber(jobs));
    }


    /* ========================================================
       14. LOCATION STATUS DISTRIBUTION
    ======================================================== */

    function renderLocationStatus() {
        const container = $("overviewStatus");

        if (!container) return;

        container.replaceChildren();

        const statuses = [
            ["Active", "active"],
            ["Pending", "pending"],
            ["Suspended", "suspended"],
            ["Closed", "closed"]
        ];

        const total = locationsState.locations.length;

        if (!total) {
            showEmpty(
                container,
                "No location statistics available."
            );
            return;
        }

        statuses.forEach(([label, key]) => {
            const count = locationsState.locations.filter(
                item => locationStatus(item) === key
            ).length;

            const percentage = count / total * 100;

            const wrapper = createElement(
                "div",
                "overview-status-item"
            );

            const heading = createElement(
                "div",
                "overview-status-row"
            );

            heading.append(
                createElement("span", "", label),
                createElement(
                    "strong",
                    "",
                    `${count} (${Math.round(percentage)}%)`
                )
            );

            const track = createElement(
                "div",
                "overview-status-track"
            );

            const fill = createElement(
                "div",
                "overview-status-fill"
            );

            fill.style.width = `${percentage}%`;

            track.appendChild(fill);

            wrapper.append(heading, track);

            container.appendChild(wrapper);
        });
    }


    /* ========================================================
       15. CORPORATE OVERVIEW
    ======================================================== */

    function renderOverviewStructure() {
        const container = $("overviewStructure");

        if (!container) return;

        container.replaceChildren();

        const company = locationsState.company || {};

        const items = [
            {
                name:
                    company.legalName ||
                    company.name ||
                    "Selected Organization",
                detail: "Parent organization",
                icon: "▤"
            },
            {
                name: "Subsidiaries",
                detail:
                    `${locationsState.subsidiaries.length} registered entities`,
                icon: "◇"
            },
            {
                name: "Operating Locations",
                detail:
                    `${locationsState.locations.length} registered locations`,
                icon: "⌖"
            }
        ];

        items.forEach(item => {
            const row = createElement(
                "div",
                "overview-structure-item"
            );

            row.appendChild(
                createElement(
                    "span",
                    "overview-structure-icon",
                    item.icon
                )
            );

            const content = document.createElement("div");

            content.append(
                createElement("strong", "", item.name),
                createElement("small", "", item.detail)
            );

            row.appendChild(content);

            container.appendChild(row);
        });
    }


    /* ========================================================
       16. LOCATION FILTERS
    ======================================================== */

    function populateCountryFilter() {
        const select = $("locationCountryFilter");

        if (!select) return;

        const selected = select.value;

        const countries = [
            ...new Set(
                locationsState.locations
                    .map(locationCountry)
                    .filter(Boolean)
            )
        ].sort((a, b) => a.localeCompare(b));

        select.replaceChildren();

        const all = createElement(
            "option",
            "",
            "All countries"
        );

        all.value = "";

        select.appendChild(all);

        countries.forEach(country => {
            const option = createElement(
                "option",
                "",
                country
            );

            option.value = country;
            select.appendChild(option);
        });

        select.value = countries.includes(selected)
            ? selected
            : "";
    }


    function filterLocations() {
        const search =
            ($("locationSearch")?.value || "")
                .trim()
                .toLowerCase();

        const status =
            $("locationStatusFilter")?.value || "";

        const type =
            $("locationTypeFilter")?.value || "";

        const country =
            $("locationCountryFilter")?.value || "";

        locationsState.filteredLocations =
            locationsState.locations.filter(item => {
                const searchable = [
                    locationName(item),
                    item.code,
                    item.city,
                    item.country,
                    item.address,
                    locationManager(item)
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                return (
                    (!search || searchable.includes(search)) &&
                    (!status || locationStatus(item) === status) &&
                    (!type || item.type === type) &&
                    (!country || item.country === country)
                );
            });

        renderLocationTable();
    }


    /* ========================================================
       17. LOCATION TABLE HELPERS
    ======================================================== */

    function createLocationCell(main, secondary) {
        const cell = document.createElement("td");

        cell.appendChild(
            createElement(
                "div",
                "location-primary-text",
                main
            )
        );

        if (secondary) {
            cell.appendChild(
                createElement(
                    "div",
                    "location-secondary-text",
                    secondary
                )
            );
        }

        return cell;
    }


    function createLocationAction(label, action, id, danger = false) {
        const button = createElement(
            "button",
            `location-action ${danger ? "danger" : ""}`,
            label
        );

        button.type = "button";
        button.dataset.locationAction = action;
        button.dataset.id = id;

        return button;
    }


    /* ========================================================
       18. RENDER BRANCH TABLE
    ======================================================== */

    function renderLocationTable() {
        const container = $("locationTableBody");

        if (!container) return;

        container.replaceChildren();

        const records =
            locationsState.filteredLocations;

        setText(
            "locationCountLabel",
            `${locationsState.locations.length} registered locations`
        );

        setText(
            "filteredLocationCount",
            `${records.length} records`
        );

        setText(
            "locationTableFooter",
            `Showing ${records.length} of ${locationsState.locations.length} locations`
        );

        if (!records.length) {
            showTableEmpty(
                container,
                8,
                "No locations match the selected filters."
            );
            return;
        }

        records.forEach(item => {
            const row = document.createElement("tr");

            const id = String(item.id || "");

            row.append(
                createLocationCell(
                    locationName(item),
                    item.code
                        ? `Reference: ${item.code}`
                        : "No reference code"
                ),

                createLocationCell(
                    formatLabel(item.type),
                    item.legalEntityName || ""
                ),

                createLocationCell(
                    escapeText(item.country),
                    item.city || item.region || ""
                ),

                createLocationCell(
                    locationManager(item)
                ),

                createLocationCell(
                    formatNumber(locationWorkforce(item))
                ),

                createLocationCell(
                    formatNumber(locationJobs(item))
                )
            );

            const statusCell = document.createElement("td");

            statusCell.appendChild(
                makeBadge(locationStatus(item))
            );

            row.appendChild(statusCell);

            const actionCell = document.createElement("td");

            const actions = createElement(
                "div",
                "location-action-group"
            );

            actions.appendChild(
                createLocationAction("Edit", "edit", id)
            );

            const status = locationStatus(item);

            if (status === "active") {
                actions.appendChild(
                    createLocationAction(
                        "Suspend",
                        "suspend",
                        id,
                        true
                    )
                );
            } else if (
                status === "suspended" ||
                status === "pending"
            ) {
                actions.appendChild(
                    createLocationAction(
                        "Activate",
                        "activate",
                        id
                    )
                );
            }

            if (
                status !== "closed" &&
                status !== "unknown"
            ) {
                actions.appendChild(
                    createLocationAction(
                        "Close",
                        "close",
                        id,
                        true
                    )
                );
            }

            actionCell.appendChild(actions);
            row.appendChild(actionCell);

            container.appendChild(row);
        });
    }


    /* ========================================================
       19. RECENT LOCATIONS
    ======================================================== */

    function renderRecentLocations() {
        const container = $("overviewRecentLocations");

        if (!container) return;

        container.replaceChildren();

        const records = [...locationsState.locations]
            .sort((a, b) => {
                const dateA = new Date(
                    a.updatedAt || a.createdAt || 0
                ).getTime();

                const dateB = new Date(
                    b.updatedAt || b.createdAt || 0
                ).getTime();

                return dateB - dateA;
            })
            .slice(0, 5);

        if (!records.length) {
            showTableEmpty(
                container,
                5,
                "No location records available."
            );
            return;
        }

        records.forEach(item => {
            const row = document.createElement("tr");

            row.append(
                createLocationCell(
                    locationName(item),
                    item.code || ""
                ),
                createLocationCell(item.country),
                createLocationCell(formatLabel(item.type)),
                createLocationCell(
                    formatNumber(locationWorkforce(item))
                )
            );

            const status = document.createElement("td");

            status.appendChild(
                makeBadge(locationStatus(item))
            );

            row.appendChild(status);
            container.appendChild(row);
        });
    }


    /* ========================================================
       20. CORPORATE GROUP HIERARCHY
    ======================================================== */

    function renderGroupNode(company, depth = 0, visited = new Set()) {
        const id = company.id
            ? String(company.id)
            : `anonymous-${depth}`;

        if (visited.has(id) || depth > 10) {
            return null;
        }

        visited.add(id);

        const node = createElement(
            "div",
            `group-company-node ${depth === 0 ? "root-node" : "child-node"
            }`
        );

        const main = createElement(
            "div",
            "group-node-main"
        );

        main.appendChild(
            createElement(
                "span",
                "group-node-icon",
                "▤"
            )
        );

        const identity = document.createElement("div");

        identity.append(
            createElement(
                "strong",
                "",
                company.legalName ||
                company.name ||
                company.displayName ||
                "Unnamed Entity"
            ),

            createElement(
                "small",
                "",
                [
                    formatLabel(company.entityType),
                    company.country ||
                    company.incorporationCountry
                ].filter(Boolean).join(" · ")
            )
        );

        main.appendChild(identity);
        node.appendChild(main);

        const meta = createElement(
            "div",
            "group-node-meta"
        );

        meta.append(
            createElement(
                "span",
                "",
                `Relationship: ${formatLabel(
                    company.relationship ||
                    (depth === 0 ? "Parent Company" : "Subsidiary")
                )}`
            ),

            createElement(
                "span",
                "",
                `Status: ${formatLabel(company.status)}`
            )
        );

        node.appendChild(meta);

        const children =
            Array.isArray(company.subsidiaries)
                ? company.subsidiaries
                : [];

        if (children.length) {
            const group = createElement(
                "div",
                "group-children"
            );

            children.forEach(child => {
                const childNode = renderGroupNode(
                    child,
                    depth + 1,
                    new Set(visited)
                );

                if (childNode) {
                    group.appendChild(childNode);
                }
            });

            node.appendChild(group);
        }

        return node;
    }


    function renderCorporateStructure() {
        const container = $("corporateGroupTree");

        if (!container) return;

        container.replaceChildren();

        const company = locationsState.company || {};

        const root = {
            ...company,
            subsidiaries:
                locationsState.subsidiaries.length
                    ? locationsState.subsidiaries
                    : company.subsidiaries || []
        };

        if (!root.id && !root.name && !root.legalName) {
            showEmpty(
                container,
                "Corporate hierarchy information unavailable."
            );
            return;
        }

        const tree = renderGroupNode(root);

        if (tree) {
            container.appendChild(tree);
        }

        renderSubsidiaryTable();
    }


    /* ========================================================
       21. SUBSIDIARY REGISTER
    ======================================================== */

    function renderSubsidiaryTable() {
        const container = $("subsidiaryTableBody");

        if (!container) return;

        container.replaceChildren();

        const records = locationsState.subsidiaries;

        setText(
            "subsidiaryCount",
            `${records.length} entities`
        );

        if (!records.length) {
            showTableEmpty(
                container,
                5,
                "No subsidiaries registered."
            );
            return;
        }

        records.forEach(item => {
            const row = document.createElement("tr");

            row.append(
                createLocationCell(
                    item.legalName || item.name,
                    item.entityType
                        ? formatLabel(item.entityType)
                        : ""
                ),

                createLocationCell(item.registrationNumber),

                createLocationCell(
                    item.incorporationCountry || item.country
                ),

                createLocationCell(
                    item.parentCompanyName ||
                    locationsState.company?.legalName ||
                    "Parent organization"
                )
            );

            const status = document.createElement("td");

            status.appendChild(
                makeBadge(item.status)
            );

            row.appendChild(status);
            container.appendChild(row);
        });
    }


    /* ========================================================
       22. DEPARTMENT MANAGEMENT
    ======================================================== */

    function renderDepartments() {
        const container = $("departmentTableBody");

        if (!container) return;

        container.replaceChildren();

        const departments = locationsState.departments;

        const assigned = new Set(
            departments
                .map(item => item.locationId)
                .filter(Boolean)
        );

        const unassigned = departments.filter(
            item => !item.locationId
        ).length;

        setText(
            "departmentTotal",
            formatNumber(departments.length)
        );

        setText(
            "locationsWithDepartments",
            formatNumber(assigned.size)
        );

        setText(
            "unassignedDepartments",
            formatNumber(unassigned)
        );

        if (!departments.length) {
            showTableEmpty(
                container,
                6,
                "No departments have been registered."
            );

            renderWorkplaceAllocation();
            return;
        }

        departments.forEach(item => {
            const location = locationsState.locations.find(
                record =>
                    String(record.id) === String(item.locationId)
            );

            const row = document.createElement("tr");

            row.append(
                createLocationCell(
                    item.name,
                    item.description || ""
                ),

                createLocationCell(item.code),

                createLocationCell(
                    location
                        ? locationName(location)
                        : "Not assigned"
                ),

                createLocationCell(
                    item.headName ||
                    item.headEmail ||
                    "Not assigned"
                ),

                createLocationCell(
                    formatNumber(
                        item.workforceCount ??
                        item.employeeCount
                    )
                )
            );

            const status = document.createElement("td");

            status.appendChild(
                makeBadge(item.status || "unknown")
            );

            row.appendChild(status);
            container.appendChild(row);
        });

        renderWorkplaceAllocation();
    }


    function renderWorkplaceAllocation() {
        const container = $("workplaceAllocation");

        if (!container) return;

        container.replaceChildren();

        if (!locationsState.departments.length) {
            showEmpty(
                container,
                "Allocation data will appear after departments are registered."
            );
            return;
        }

        const allocations = new Map();

        locationsState.departments.forEach(department => {
            const key = department.locationId || "unassigned";

            if (!allocations.has(key)) {
                const location = locationsState.locations.find(
                    item => String(item.id) === String(key)
                );

                allocations.set(key, {
                    name: key === "unassigned"
                        ? "Unassigned Departments"
                        : locationName(location || {}),
                    departments: []
                });
            }

            allocations.get(key).departments.push(
                department.name
            );
        });

        allocations.forEach(item => {
            const card = createElement(
                "div",
                "workplace-allocation-item"
            );

            card.append(
                createElement("strong", "", item.name),
                createElement(
                    "small",
                    "",
                    `${item.departments.length} department(s): ${item.departments.join(", ")}`
                )
            );

            container.appendChild(card);
        });
    }


    /* ========================================================
       23. LOCATION MANAGERS & PERMISSIONS
    ======================================================== */

    function renderManagers() {
        const container = $("managerTableBody");

        if (!container) return;

        container.replaceChildren();

        const managers = locationsState.managers;

        const administrators = managers.filter(
            item =>
                String(item.role).toLowerCase() ===
                "location_admin"
        ).length;

        const managed = new Set(
            managers
                .filter(item =>
                    !["revoked", "inactive"].includes(
                        String(item.status).toLowerCase()
                    )
                )
                .map(item => String(item.locationId))
        );

        const unmanaged = locationsState.locations.filter(
            item => !managed.has(String(item.id))
        ).length;

        setText("managerTotal", formatNumber(managers.length));
        setText("locationAdminTotal", formatNumber(administrators));
        setText("unmanagedLocations", formatNumber(unmanaged));

        if (!managers.length) {
            showTableEmpty(
                container,
                7,
                "No location managers assigned."
            );
            return;
        }

        managers.forEach(manager => {
            const location = locationsState.locations.find(
                item =>
                    String(item.id) ===
                    String(manager.locationId)
            );

            const row = document.createElement("tr");

            row.append(
                createLocationCell(
                    manager.name ||
                    manager.fullName ||
                    manager.email
                ),

                createLocationCell(manager.email),

                createLocationCell(
                    location
                        ? locationName(location)
                        : manager.locationName || "Unknown location"
                ),

                createLocationCell(formatLabel(manager.role)),

                createLocationCell(
                    Array.isArray(manager.permissions)
                        ? manager.permissions
                            .map(formatLabel)
                            .join(", ")
                        : "Role-based"
                )
            );

            const status = document.createElement("td");

            status.appendChild(
                makeBadge(manager.status || "active")
            );

            row.appendChild(status);

            const actionCell = document.createElement("td");

            const revoke = createLocationAction(
                "Revoke",
                "revoke-manager",
                manager.id,
                true
            );

            revoke.dataset.locationId =
                manager.locationId || "";

            actionCell.appendChild(revoke);
            row.appendChild(actionCell);

            container.appendChild(row);
        });
    }


    /* ========================================================
       24. GEOGRAPHIC ANALYTICS
    ======================================================== */

    function renderAnalyticsBars(
        targetId,
        records,
        valueField,
        labelField
    ) {
        const container = $(targetId);

        if (!container) return;

        container.replaceChildren();

        if (!Array.isArray(records) || !records.length) {
            showEmpty(
                container,
                "No analytics data returned by the server."
            );
            return;
        }

        const values = records
            .map(item => Number(item[valueField]))
            .filter(Number.isFinite);

        const maximum = Math.max(...values, 0);

        records.forEach(item => {
            const value = Number(item[valueField]);

            const wrapper = createElement(
                "div",
                "analytics-bar-item"
            );

            const heading = createElement(
                "div",
                "analytics-bar-heading"
            );

            heading.append(
                createElement(
                    "span",
                    "",
                    item[labelField] || "Unnamed"
                ),

                createElement(
                    "strong",
                    "",
                    formatNumber(value)
                )
            );

            const track = createElement(
                "div",
                "analytics-track"
            );

            const fill = createElement(
                "div",
                "analytics-fill"
            );

            const percentage =
                Number.isFinite(value) && maximum > 0
                    ? value / maximum * 100
                    : 0;

            fill.style.width = `${percentage}%`;

            track.appendChild(fill);
            wrapper.append(heading, track);

            container.appendChild(wrapper);
        });
    }


    function renderCountryAnalytics() {
        const container = $("countryAnalyticsTable");

        if (!container) return;

        container.replaceChildren();

        const records =
            locationsState.analytics.countrySummary || [];

        if (!records.length) {
            showTableEmpty(
                container,
                5,
                "Country analytics are not yet available."
            );
            return;
        }

        records.forEach(item => {
            const row = document.createElement("tr");

            row.append(
                createLocationCell(item.country),
                createLocationCell(formatNumber(item.locationCount)),
                createLocationCell(formatNumber(item.workforce)),
                createLocationCell(formatNumber(item.openJobs)),
                createLocationCell(formatNumber(item.applications))
            );

            container.appendChild(row);
        });
    }


    /* ========================================================
       25. DIALOG SELECT POPULATION
    ======================================================== */

    function populateSelect(
        id,
        records,
        placeholder,
        valueField,
        labelFunction
    ) {
        const select = $(id);

        if (!select) return;

        const previous = select.value;

        select.replaceChildren();

        const first = createElement(
            "option",
            "",
            placeholder
        );

        first.value = "";

        select.appendChild(first);

        records.forEach(record => {
            if (!record[valueField]) return;

            const option = createElement(
                "option",
                "",
                labelFunction(record)
            );

            option.value = record[valueField];

            select.appendChild(option);
        });

        if (records.some(item =>
            String(item[valueField]) === String(previous)
        )) {
            select.value = previous;
        }
    }


    function populateLocationDialogSelects() {
        const entities = [];

        if (locationsState.company?.id) {
            entities.push({
                id: locationsState.company.id,
                legalName:
                    locationsState.company.legalName ||
                    locationsState.company.name ||
                    "Parent Company"
            });
        } else {
            const company = state.companies.find(
                item => String(item.id) === String(getCompanyId())
            );

            if (company) {
                entities.push({
                    id: company.id,
                    legalName: company.legalName || company.name
                });
            }
        }

        locationsState.subsidiaries.forEach(item => {
            if (item.id) entities.push(item);
        });

        populateSelect(
            "locationLegalEntity",
            entities,
            "Select legal entity",
            "id",
            item => item.legalName || item.name
        );

        populateSelect(
            "parentLocation",
            locationsState.locations.filter(
                item =>
                    String(item.id) !==
                    String(locationsState.selectedLocationId || "")
            ),
            "No parent location",
            "id",
            locationName
        );

        const activeLocations =
            locationsState.locations.filter(
                item => locationStatus(item) !== "closed"
            );

        populateSelect(
            "departmentLocation",
            activeLocations,
            "Select location",
            "id",
            item => `${locationName(item)} — ${item.country || ""}`
        );

        populateSelect(
            "managerLocation",
            activeLocations,
            "Select location",
            "id",
            item => `${locationName(item)} — ${item.country || ""}`
        );
    }


    /* ========================================================
       26. RENDER ALL LOCATION SECTIONS
    ======================================================== */

    function renderAllLocations() {
        renderLocationKPIs();

        renderOverviewStructure();

        renderLocationStatus();

        populateCountryFilter();

        locationsState.filteredLocations = [
            ...locationsState.locations
        ];

        renderLocationTable();

        renderRecentLocations();

        renderCorporateStructure();

        renderDepartments();

        renderManagers();

        renderAnalyticsBars(
            "workforceByLocation",
            locationsState.analytics.workforceByLocation,
            "employeeCount",
            "locationName"
        );

        renderAnalyticsBars(
            "recruitmentByLocation",
            locationsState.analytics.jobsByLocation,
            "openJobs",
            "locationName"
        );

        renderCountryAnalytics();

        populateLocationDialogSelects();
    }


    /* ========================================================
       27. TABS
    ======================================================== */

    function activateLocationTab(name) {
        document.querySelectorAll(
            "[data-location-tab]"
        ).forEach(button => {
            const active =
                button.dataset.locationTab === name;

            button.classList.toggle("active", active);

            button.setAttribute(
                "aria-selected",
                String(active)
            );
        });

        document.querySelectorAll(
            "[data-location-panel]"
        ).forEach(panel => {
            const active =
                panel.dataset.locationPanel === name;

            panel.hidden = !active;

            panel.classList.toggle("active", active);
        });
    }


    /* ========================================================
       28. DIALOG CONTROL
    ======================================================== */

    function openDialog(id) {
        const dialog = $(id);

        if (!dialog) return;

        if (typeof dialog.showModal === "function") {
            if (!dialog.open) dialog.showModal();
        } else {
            dialog.setAttribute("open", "");
        }
    }

    function closeDialog(id) {
        const dialog = $(id);

        if (!dialog) return;

        if (typeof dialog.close === "function") {
            if (dialog.open) dialog.close();
        } else {
            dialog.removeAttribute("open");
        }
    }

    function bindDialogClosers() {
        document.querySelectorAll(
            "[data-close-dialog]"
        ).forEach(button => {
            button.addEventListener("click", () => {
                closeDialog(button.dataset.closeDialog);
            });
        });
    }


    /* ========================================================
       29. NEW LOCATION FORM
    ======================================================== */

    function openNewLocation() {
        const form = $("locationForm");

        if (!form) return;

        locationsState.selectedLocationId = null;

        form.reset();

        $("locationId").value = "";

        setText(
            "locationDialogTitle",
            "Register New Location"
        );

        $("locationDialogTitle").textContent =
            "Register New Location";

        populateLocationDialogSelects();

        if (getCompanyId()) {
            $("locationLegalEntity").value =
                String(getCompanyId());
        }

        openDialog("locationDialog");
    }


    /* ========================================================
       30. EDIT LOCATION
    ======================================================== */

    function openEditLocation(id) {
        const item = locationsState.locations.find(
            record => String(record.id) === String(id)
        );

        if (!item) {
            showToast("Location record not found.", "error");
            return;
        }

        const form = $("locationForm");

        if (!form) return;

        form.reset();

        locationsState.selectedLocationId = item.id;

        populateLocationDialogSelects();

        const fields = [
            "name",
            "code",
            "type",
            "legalEntityId",
            "country",
            "region",
            "city",
            "postalCode",
            "address",
            "timezone",
            "phone",
            "email",
            "parentLocationId"
        ];

        fields.forEach(field => {
            const input = form.elements.namedItem(field);

            if (input) {
                input.value = item[field] ?? "";
            }
        });

        $("locationId").value = item.id;

        $("locationDialogTitle").textContent =
            "Edit Location";

        $("saveLocationButton").textContent =
            "Update Location";

        openDialog("locationDialog");
    }


    /* ========================================================
       31. SAVE LOCATION
    ======================================================== */

    async function saveLocation(event) {
        event.preventDefault();

        const form = $("locationForm");

        const button = $("saveLocationButton");

        if (!form || !form.reportValidity()) return;

        const payload = formObject(form);

        const locationId = payload.locationId;

        delete payload.locationId;

        if (
            locationId &&
            payload.parentLocationId &&
            String(locationId) === String(payload.parentLocationId)
        ) {
            showToast(
                "A location cannot be its own parent.",
                "error"
            );
            return;
        }

        const editing = Boolean(locationId);

        const endpoint = editing
            ? companyPath(
                `/locations/${encodeURIComponent(locationId)}`
            )
            : companyPath("/locations");

        setButtonLoading(
            button,
            true,
            editing ? "Updating..." : "Saving..."
        );

        try {
            await api(endpoint, {
                method: editing ? "PATCH" : "POST",
                body: payload
            });

            showToast(
                editing
                    ? "Location updated successfully."
                    : "Location registered successfully.",
                "success"
            );

            closeDialog("locationDialog");

            locationsState.selectedLocationId = null;

            await loadLocations();

        } catch (error) {
            showToast(error.message, "error");

        } finally {
            setButtonLoading(
                button,
                false,
                editing ? "Update Location" : "Save Location"
            );
        }
    }


    /* ========================================================
       32. LOCATION STATUS MANAGEMENT
    ======================================================== */

    async function changeLocationStatus(id, newStatus) {
        const item = locationsState.locations.find(
            record => String(record.id) === String(id)
        );

        if (!item) return;

        const name = locationName(item);

        const messages = {
            active: `Activate ${name}?`,
            suspended: `Suspend ${name}?`,
            closed: `Permanently close ${name}?`
        };

        if (!window.confirm(messages[newStatus])) {
            return;
        }

        const reason = window.prompt(
            `Enter the reason for this ${newStatus} action:`
        );

        if (reason === null) return;

        if (!reason.trim()) {
            showToast(
                "A reason is required for this status change.",
                "error"
            );
            return;
        }

        try {
            await api(
                companyPath(
                    `/locations/${encodeURIComponent(id)}/status`
                ),
                {
                    method: "POST",
                    body: {
                        status: newStatus,
                        reason: reason.trim()
                    }
                }
            );

            showToast(
                `${name} status updated successfully.`,
                "success"
            );

            await loadLocations();

        } catch (error) {
            showToast(error.message, "error");
        }
    }


    /* ========================================================
       33. REGISTER SUBSIDIARY
    ======================================================== */

    function openSubsidiaryDialog() {
        $("subsidiaryForm")?.reset();

        openDialog("subsidiaryDialog");
    }


    async function createSubsidiary(event) {
        event.preventDefault();

        const form = $("subsidiaryForm");
        const button = $("saveSubsidiaryButton");

        if (!form || !form.reportValidity()) return;

        const payload = formObject(form);

        payload.parentCompanyId = getCompanyId();

        payload.relationship =
            payload.relationship || "subsidiary";

        if (payload.ownershipPercentage === "") {
            delete payload.ownershipPercentage;

        } else {
            const percentage =
                Number(payload.ownershipPercentage);

            if (
                !Number.isFinite(percentage) ||
                percentage < 0 ||
                percentage > 100
            ) {
                showToast(
                    "Ownership must be between 0 and 100.",
                    "error"
                );
                return;
            }

            payload.ownershipPercentage = percentage;
        }

        setButtonLoading(
            button,
            true,
            "Registering..."
        );

        try {
            await api(
                "/api/employer/companies",
                {
                    method: "POST",
                    body: payload
                }
            );

            showToast(
                "Subsidiary registration submitted.",
                "success"
            );

            closeDialog("subsidiaryDialog");

            form.reset();

            await loadLocations();

            await loadCompanies();

        } catch (error) {
            showToast(error.message, "error");

        } finally {
            setButtonLoading(
                button,
                false,
                "Register Subsidiary"
            );
        }
    }


    /* ========================================================
       34. REGISTER DEPARTMENT
    ======================================================== */

    async function createDepartment(event) {
        event.preventDefault();

        const form = $("departmentForm");
        const button = $("saveDepartmentButton");

        if (!form || !form.reportValidity()) return;

        const payload = formObject(form);

        setButtonLoading(button, true, "Saving...");

        try {
            await api(
                companyPath("/departments"),
                {
                    method: "POST",
                    body: payload
                }
            );

            showToast(
                "Department created successfully.",
                "success"
            );

            closeDialog("departmentDialog");

            form.reset();

            await loadLocations();

        } catch (error) {
            showToast(error.message, "error");

        } finally {
            setButtonLoading(
                button,
                false,
                "Save Department"
            );
        }
    }


    /* ========================================================
       35. LOCATION MANAGER ASSIGNMENT
    ======================================================== */

    function openManagerDialog() {
        $("managerForm")?.reset();

        populateLocationDialogSelects();

        openDialog("managerDialog");
    }


    async function assignManager(event) {
        event.preventDefault();

        const form = $("managerForm");
        const button = $("saveManagerButton");

        if (!form || !form.reportValidity()) return;

        const formData = new FormData(form);

        const locationId = formData.get("locationId");

        const payload = {
            email: formData.get("email"),
            role: formData.get("role"),
            permissions: formData.getAll("permissions")
        };

        if (!locationId) {
            showToast("Select a location.", "error");
            return;
        }

        setButtonLoading(button, true, "Assigning...");

        try {
            await api(
                companyPath(
                    `/locations/${encodeURIComponent(locationId)}/managers`
                ),
                {
                    method: "POST",
                    body: payload
                }
            );

            showToast(
                "Manager assignment submitted successfully.",
                "success"
            );

            closeDialog("managerDialog");

            form.reset();

            await loadLocations();

        } catch (error) {
            showToast(error.message, "error");

        } finally {
            setButtonLoading(
                button,
                false,
                "Assign Manager"
            );
        }
    }


    /* ========================================================
       36. REVOKE LOCATION MANAGER
    ======================================================== */

    async function revokeManager(managerId, locationId) {
        if (!managerId || !locationId) {
            showToast(
                "Manager assignment reference is incomplete.",
                "error"
            );
            return;
        }

        if (!window.confirm(
            "Revoke this manager's location access?"
        )) {
            return;
        }

        try {
            await api(
                companyPath(
                    `/locations/${encodeURIComponent(locationId)}/managers/${encodeURIComponent(managerId)}`
                ),
                {
                    method: "DELETE"
                }
            );

            showToast(
                "Manager access revoked successfully.",
                "success"
            );

            await loadLocations();

        } catch (error) {
            showToast(error.message, "error");
        }
    }


    /* ========================================================
       37. CSV LOCATION EXPORT
    ======================================================== */

    function escapeCSV(value) {
        return `"${String(value ?? "").replace(/"/g, '""')}"`;
    }


    function exportLocations() {
        const records =
            locationsState.filteredLocations;

        if (!records.length) {
            showToast(
                "There are no location records to export.",
                "warning"
            );
            return;
        }

        const headers = [
            "Location ID",
            "Location Name",
            "Reference Code",
            "Type",
            "Country",
            "Region",
            "City",
            "Address",
            "Manager",
            "Workforce",
            "Open Jobs",
            "Status",
            "Created At"
        ];

        const rows = records.map(item => [
            item.id,
            locationName(item),
            item.code,
            item.type,
            item.country,
            item.region,
            item.city,
            item.address,
            locationManager(item),
            locationWorkforce(item),
            locationJobs(item),
            locationStatus(item),
            item.createdAt
        ]);

        const csv = [
            headers,
            ...rows
        ].map(row =>
            row.map(escapeCSV).join(",")
        ).join("\r\n");

        const blob = new Blob(
            ["\uFEFF" + csv],
            {
                type: "text/csv;charset=utf-8;"
            }
        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;

        link.download =
            "talvora-global-locations.csv";

        document.body.appendChild(link);

        link.click();

        link.remove();

        URL.revokeObjectURL(url);

        showToast(
            "Location report exported successfully.",
            "success"
        );
    }


    /* ========================================================
       38. CLEAR LOCATION FILTERS
    ======================================================== */

    function clearLocationFilters() {
        [
            "locationSearch",
            "locationStatusFilter",
            "locationTypeFilter",
            "locationCountryFilter"
        ].forEach(id => {
            const element = $(id);

            if (element) {
                element.value = "";
            }
        });

        filterLocations();
    }


    /* ========================================================
       39. LOCATION EVENT DELEGATION
    ======================================================== */

    function bindLocationActions() {
        $("locationTableBody")?.addEventListener(
            "click",
            event => {
                const button = event.target.closest(
                    "[data-location-action]"
                );

                if (!button) return;

                const id = button.dataset.id;
                const action = button.dataset.locationAction;

                if (action === "edit") {
                    openEditLocation(id);

                } else if ([
                    "activate",
                    "suspend",
                    "close"
                ].includes(action)) {
                    changeLocationStatus(
                        id,
                        action === "activate"
                            ? "active"
                            : action === "suspend"
                                ? "suspended"
                                : "closed"
                    );
                }
            }
        );

        $("managerTableBody")?.addEventListener(
            "click",
            event => {
                const button = event.target.closest(
                    '[data-location-action="revoke-manager"]'
                );

                if (!button) return;

                revokeManager(
                    button.dataset.id,
                    button.dataset.locationId
                );
            }
        );
    }


    /* ========================================================
       40. LOCATION TAB EVENTS
    ======================================================== */

    function bindLocationTabs() {
        document.querySelectorAll(
            "[data-location-tab]"
        ).forEach(button => {
            button.addEventListener("click", () => {
                activateLocationTab(
                    button.dataset.locationTab
                );
            });
        });

        document.querySelectorAll(
            "[data-switch-location-tab]"
        ).forEach(button => {
            button.addEventListener("click", () => {
                activateLocationTab(
                    button.dataset.switchLocationTab
                );
            });
        });
    }


    /* ========================================================
       41. LOCATION FILTER EVENTS
    ======================================================== */

    function bindLocationFilters() {
        $("locationSearch")?.addEventListener(
            "input",
            filterLocations
        );

        [
            "locationStatusFilter",
            "locationTypeFilter",
            "locationCountryFilter"
        ].forEach(id => {
            $(id)?.addEventListener(
                "change",
                filterLocations
            );
        });

        $("clearLocationFilters")?.addEventListener(
            "click",
            clearLocationFilters
        );
    }


    /* ========================================================
       42. LOCATION FORM EVENTS
    ======================================================== */

    function bindLocationForms() {
        $("addLocationButton")?.addEventListener(
            "click",
            openNewLocation
        );

        $("branchAddButton")?.addEventListener(
            "click",
            openNewLocation
        );

        $("locationForm")?.addEventListener(
            "submit",
            saveLocation
        );

        $("addSubsidiaryButton")?.addEventListener(
            "click",
            openSubsidiaryDialog
        );

        $("subsidiaryForm")?.addEventListener(
            "submit",
            createSubsidiary
        );

        $("addDepartmentButton")?.addEventListener(
            "click",
            () => {
                $("departmentForm")?.reset();

                populateLocationDialogSelects();

                openDialog("departmentDialog");
            }
        );

        $("departmentForm")?.addEventListener(
            "submit",
            createDepartment
        );

        $("assignManagerButton")?.addEventListener(
            "click",
            openManagerDialog
        );

        $("managerForm")?.addEventListener(
            "submit",
            assignManager
        );

        $("exportLocationsButton")?.addEventListener(
            "click",
            exportLocations
        );
    }


    /* ========================================================
       43. COMPLETE LOCATION MODULE BINDING
    ======================================================== */

    function bindLocations() {
        if (locationsState.initialized) return;

        locationsState.initialized = true;

        bindLocationTabs();

        bindDialogClosers();

        bindLocationActions();

        bindLocationFilters();

        bindLocationForms();
    }


    /* ========================================================
       44. REGISTER LOCATION MODULE
    ======================================================== */

    const locationsModule = {
        bind: bindLocations,
        load: loadLocations,
        refresh: loadLocations,

        getLocations: () =>
            [...locationsState.locations],

        getDepartments: () =>
            [...locationsState.departments],

        getManagers: () =>
            [...locationsState.managers],

        getCompany: () =>
            locationsState.company
    };

    registerModule("locations", locationsModule);

    window.TALVORA_LOCATIONS = locationsModule;


    /* ========================================================
       45. START APPLICATION
    ======================================================== */

    function startApplication() {
        initialize();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            startApplication,
            { once: true }
        );
    } else {
        startApplication();
    }

})();
