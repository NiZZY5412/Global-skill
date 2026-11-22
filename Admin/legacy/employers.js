
/* =========================================================
   TALVORA TECHNOLOGIES
   GSES SYSTEM 001
   EMPLOYER MANAGEMENT MODULE

   FRONTEND APPLICATION
   BACKEND CONTRACT: /api/v1/admin/employers

   NO MOCK EMPLOYERS
   NO FABRICATED METRICS
   NO CLIENT-SIDE PRIVILEGE GRANTS
========================================================= */

"use strict";

(() => {

    /* =====================================================
       01. CONFIGURATION
    ===================================================== */

    const CONFIG = Object.freeze({

        API: "/api/v1/admin/employers",

        SESSION: "/api/v1/auth/session",

        NOTIFICATIONS: "/api/v1/admin/notifications",

        PAGE_SIZE: 25,

        REQUEST_TIMEOUT: 20000

    });


    /* =====================================================
       02. APPLICATION STATE
    ===================================================== */

    const state = {

        authenticated: false,

        administrator: null,

        csrfToken: null,

        employers: [],

        metrics: {},

        page: 1,

        totalPages: 1,

        totalItems: 0,

        selectedEmployer: null,

        filters: {},

        loading: false

    };


    /* =====================================================
       03. DOM HELPERS
    ===================================================== */

    const $ = (selector, parent = document) =>
        parent.querySelector(selector);


    function byId(id) {

        return document.getElementById(id);

    }


    function create(tag, className = "", content = null) {

        const element = document.createElement(tag);


        if (className) {

            element.className = className;

        }


        if (content !== null && content !== undefined) {

            element.textContent = String(content);

        }


        return element;

    }


    function setText(id, value) {

        const element = byId(id);

        if (!element) return;


        element.textContent =

            value === null ||
                value === undefined ||
                value === ""

                ? "—"
                : String(value);

    }


    function show(element) {

        if (element) element.hidden = false;

    }


    function hide(element) {

        if (element) element.hidden = true;

    }


    function number(value) {

        if (
            typeof value !== "number" ||
            !Number.isFinite(value)
        ) {

            return "—";

        }


        return new Intl.NumberFormat().format(value);

    }


    function dateTime(value) {

        if (!value) return "—";


        const date = new Date(value);


        if (Number.isNaN(date.getTime())) {

            return "—";

        }


        return new Intl.DateTimeFormat(undefined, {

            dateStyle: "medium",

            timeStyle: "short"

        }).format(date);

    }


    function normalize(value) {

        return String(value || "unknown")

            .trim()

            .toLowerCase()

            .replace(/[\s-]+/g, "_");

    }


    function pretty(value) {

        if (!value) return "Unknown";


        return String(value)

            .replace(/[_-]/g, " ")

            .replace(/\b\w/g, character =>
                character.toUpperCase()
            );

    }


    function getReference(employer) {

        return (

            employer?.reference ||

            employer?.id ||

            null

        );

    }


    function safePath(reference) {

        if (!reference) {

            throw new Error(
                "A valid employer reference is required."
            );

        }


        return `${CONFIG.API}/${encodeURIComponent(reference)}`;

    }


    /* =====================================================
       04. USER FEEDBACK
    ===================================================== */

    function toast(message, type = "info") {

        const container = byId("toast-container");

        if (!container) return;


        const element = create(
            "div",
            `toast ${type}`,
            message
        );


        element.setAttribute("role", "status");

        container.appendChild(element);


        window.setTimeout(() => {

            element.remove();

        }, 5000);

    }


    function notice(message, type = "info") {

        const element = byId("global-notice");

        if (!element) return;


        element.className = `notice ${type}`;

        element.textContent = message;

        show(element);

    }


    function clearNotice() {

        const element = byId("global-notice");

        if (!element) return;


        element.textContent = "";

        hide(element);

    }


    /* =====================================================
       05. API REQUEST ENGINE
    ===================================================== */

    async function request(path, options = {}) {

        const controller = new AbortController();


        const timeout = window.setTimeout(() => {

            controller.abort();

        }, CONFIG.REQUEST_TIMEOUT);


        const method = options.method || "GET";


        const headers = {

            Accept: "application/json",

            ...options.headers

        };


        const fetchOptions = {

            method,

            credentials: "same-origin",

            headers,

            signal: controller.signal

        };


        if (options.body !== undefined) {

            headers["Content-Type"] = "application/json";

            fetchOptions.body =
                JSON.stringify(options.body);

        }


        if (
            state.csrfToken &&
            !["GET", "HEAD", "OPTIONS"].includes(method)
        ) {

            headers["X-CSRF-Token"] =
                state.csrfToken;

        }


        try {

            const response = await fetch(
                path,
                fetchOptions
            );


            const contentType =
                response.headers.get("content-type") || "";


            let result = null;


            if (contentType.includes("application/json")) {

                result = await response.json();

            } else if (response.status !== 204) {

                result = await response.text();

            }


            if (response.status === 401) {

                state.authenticated = false;

                throw new Error(
                    "Your administrator session has expired."
                );

            }


            if (response.status === 403) {

                throw new Error(
                    "The server denied this administrative action."
                );

            }


            if (!response.ok) {

                throw new Error(

                    result?.message ||

                    result?.error ||

                    `Server request failed (${response.status}).`

                );

            }


            return result;

        } catch (error) {

            if (error.name === "AbortError") {

                throw new Error(
                    "The server request timed out."
                );

            }


            if (error instanceof TypeError) {

                throw new Error(
                    "Unable to connect to the employer management service."
                );

            }


            throw error;

        } finally {

            window.clearTimeout(timeout);

        }

    }


    /* =====================================================
       06. SUPER ADMIN AUTHENTICATION
    ===================================================== */

    async function verifySession() {

        try {

            const result = await request(
                CONFIG.SESSION
            );


            if (
                result?.authenticated !== true ||

                normalize(result?.user?.role) !== "super_admin"
            ) {

                throw new Error(
                    "A verified TALVORA Super Admin session is required."
                );

            }


            state.administrator = result.user;

            state.csrfToken =
                result.csrfToken || null;

            state.authenticated = true;


            const name =

                result.user.displayName ||

                result.user.name ||

                "Super Administrator";


            setText("admin-name", name);

            setText("admin-email", result.user.email);


            setText(

                "admin-avatar",

                name.split(/\s+/)

                    .filter(Boolean)

                    .slice(0, 2)

                    .map(part => part[0])

                    .join("")

                    .toUpperCase()

            );


            setConnection(
                "online",
                "Administrator session verified"
            );


            return true;

        } catch (error) {

            state.authenticated = false;


            setConnection(
                "offline",
                "Authentication required"
            );


            notice(
                error.message,
                "error"
            );


            return false;

        }

    }


    function authorized() {

        if (!state.authenticated) {

            toast(
                "Super Admin authorization required.",
                "error"
            );

            return false;

        }


        return true;

    }


    function setConnection(status, message) {

        const dot = byId("connection-dot");

        if (dot) {

            dot.className =
                `status-dot ${status}`;

        }


        setText(
            "connection-label",
            message
        );

    }


    /* =====================================================
       07. EMPLOYER DATA LOADING
    ===================================================== */

    async function loadEmployers() {

        if (!authorized()) return;


        if (state.loading) return;


        state.loading = true;


        const refreshButton =
            byId("refresh-button");


        if (refreshButton) {

            refreshButton.disabled = true;

        }


        try {

            const params = new URLSearchParams({

                page: String(state.page),

                pageSize: String(CONFIG.PAGE_SIZE)

            });


            Object.entries(state.filters).forEach(
                ([key, value]) => {

                    if (
                        value !== null &&
                        value !== undefined &&
                        value !== ""
                    ) {

                        params.set(key, value);

                    }

                }
            );


            const result = await request(

                `${CONFIG.API}?${params.toString()}`

            );


            if (
                !Array.isArray(result?.items)
            ) {

                throw new Error(
                    "The employer service returned an unexpected response."
                );

            }


            state.employers = result.items;

            state.metrics = result.metrics || {};


            const pagination =
                result.pagination || {};


            state.page =
                Number(pagination.page) || state.page;


            state.totalPages =
                Math.max(
                    1,
                    Number(pagination.totalPages) || 1
                );


            state.totalItems =
                Number(pagination.totalItems) || 0;


            renderMetrics(state.metrics);

            renderEmployerDirectory(state.employers);

            renderPagination(pagination);


            setConnection(
                "online",
                "Employer management connected"
            );


            setText(
                "last-updated",
                dateTime(new Date().toISOString())
            );


            setText(
                "employer-sync",
                dateTime(result.lastSyncedAt)
            );


            clearNotice();


        } catch (error) {

            setConnection(
                "warning",
                "Employer service unavailable"
            );


            notice(
                error.message,
                "error"
            );


            renderEmployerDirectory([]);


        } finally {

            state.loading = false;


            if (refreshButton) {

                refreshButton.disabled = false;

            }

        }

    }


    /* =====================================================
       08. METRIC RENDERING
    ===================================================== */

    function renderMetrics(metrics) {

        const mapping = {

            "employer-total": "total",

            "employer-active": "active",

            "employer-pending": "pendingVerification",

            "employer-suspended": "suspended",

            "employer-registrations": "registrationSubmissions",

            "employer-verified": "verified",

            "employer-rejected": "rejected",

            "employer-attention": "requiringAttention",

            "employer-recent": "recentlyRegistered"

        };


        Object.entries(mapping).forEach(
            ([id, key]) => {

                const value = metrics[key];


                setText(

                    id,

                    typeof value === "number"

                        ? number(value)

                        : "—"

                );

            }
        );


        setText(

            "employer-sync",

            dateTime(metrics.lastSyncedAt)

        );

    }


    /* =====================================================
       09. EMPLOYER DIRECTORY
    ===================================================== */

    function createCell(row, value, bold = false) {

        const td = create("td");


        const content =

            value === null ||
                value === undefined ||
                value === ""

                ? "—"
                : String(value);


        if (bold) {

            td.appendChild(
                create("strong", "", content)
            );

        } else {

            td.textContent = content;

        }


        row.appendChild(td);

        return td;

    }


    function createStatusCell(row, value) {

        const td = create("td");


        td.appendChild(

            create(

                "span",

                `status-badge ${normalize(value)}`,

                pretty(value)

            )

        );


        row.appendChild(td);

    }


    function createAction(label, action, reference) {

        const button = create(
            "button",
            "row-button",
            label
        );


        button.type = "button";

        button.dataset.action = action;

        button.dataset.reference = reference || "";


        return button;

    }


    function renderEmployerDirectory(employers) {

        const body = byId(
            "employer-table-body"
        );


        if (!body) return;


        body.replaceChildren();


        if (!employers.length) {

            const row = create("tr");

            const cell = create(

                "td",

                "empty-cell",

                state.loading

                    ? "Loading employer records..."

                    : "No employer records match the current filters."

            );


            cell.colSpan = 8;

            row.appendChild(cell);

            body.appendChild(row);

            return;

        }


        employers.forEach(employer => {

            const row = create("tr");


            /* EMPLOYER */

            const nameCell = create("td");


            const name = create(

                "strong",

                "",

                employer.name || "Unnamed employer"

            );


            const email = create(

                "small",

                "",

                employer.email || "Contact information unavailable"

            );


            nameCell.append(name, email);

            row.appendChild(nameCell);


            /* REFERENCE */

            createCell(
                row,
                employer.reference || employer.id
            );


            /* COUNTRY */

            createCell(
                row,
                employer.country
            );


            /* VERIFICATION */

            createStatusCell(
                row,
                employer.verificationStatus
            );


            /* ACCOUNT STATUS */

            createStatusCell(
                row,
                employer.status
            );


            /* REGISTRATION DATE */

            createCell(
                row,
                dateTime(employer.createdAt)
            );


            /* LAST ACTIVITY */

            createCell(
                row,
                dateTime(employer.lastActivityAt)
            );


            /* ACTIONS */

            const actionsCell = create("td");

            const actions = create(
                "div",
                "row-actions"
            );


            const reference =
                getReference(employer);


            actions.appendChild(

                createAction(
                    "View",
                    "view",
                    reference
                )

            );


            actions.appendChild(

                createAction(
                    "Manage",
                    "manage",
                    reference
                )

            );


            actionsCell.appendChild(actions);

            row.appendChild(actionsCell);


            body.appendChild(row);

        });

    }


    /* =====================================================
       10. PAGINATION
    ===================================================== */

    function renderPagination(pagination) {

        const start =

            state.totalItems === 0

                ? 0

                : ((state.page - 1) * CONFIG.PAGE_SIZE) + 1;


        const end = Math.min(

            state.page * CONFIG.PAGE_SIZE,

            state.totalItems

        );


        setText(

            "pagination-information",

            `Showing ${number(start)}–${number(end)} of ${number(state.totalItems)} employers`

        );


        const previous = byId("previous-page");

        const next = byId("next-page");


        if (previous) {

            previous.disabled =
                state.page <= 1 || state.loading;

        }


        if (next) {

            next.disabled =

                state.page >= state.totalPages ||

                state.loading;

        }

    }


    async function changePage(direction) {

        const nextPage =
            state.page + direction;


        if (
            nextPage < 1 ||
            nextPage > state.totalPages
        ) {

            return;

        }


        state.page = nextPage;

        await loadEmployers();

    }


    /* =====================================================
       11. SEARCH AND FILTERS
    ===================================================== */

    function initializeFilters() {

        const form = byId(
            "employer-filter-form"
        );


        form?.addEventListener("submit", event => {

            event.preventDefault();


            state.filters = {

                search:
                    byId("employer-search").value.trim(),

                status:
                    byId("employer-status-filter").value,

                verificationStatus:
                    byId("employer-verification-filter").value,

                country:
                    byId("employer-country-filter").value.trim()

            };


            state.page = 1;

            loadEmployers();

        });


        byId("clear-employer-filters")
            ?.addEventListener("click", event => {

                event.preventDefault();


                form.reset();

                state.filters = {};

                state.page = 1;

                loadEmployers();

            });

    }


    /* =====================================================
       12. REGISTER EMPLOYER
    ===================================================== */

    function openRegistration() {

        if (!authorized()) return;


        const form = byId("employer-form");

        form?.reset();


        show(
            byId("employer-modal")
        );


        $('input[name="name"]', form)?.focus();

    }


    function closeRegistration() {

        hide(
            byId("employer-modal")
        );

    }


    function serializeForm(form) {

        const data = new FormData(form);

        const payload = {};


        for (const [key, value] of data.entries()) {

            if (
                value !== "" &&
                key !== "reviewAcknowledged"
            ) {

                payload[key] =
                    typeof value === "string"
                        ? value.trim()
                        : value;

            }

        }


        return payload;

    }


    function validateWebsite(value) {

        if (!value) return;


        let parsed;

        try {

            parsed = new URL(value);

        } catch {

            throw new Error(
                "Enter a valid organization website address."
            );

        }


        if (parsed.protocol !== "https:") {

            throw new Error(
                "Organization website addresses must use HTTPS."
            );

        }

    }


    async function submitRegistration(event) {

        event.preventDefault();


        if (!authorized()) return;


        const form = event.currentTarget;


        if (!form.reportValidity()) return;


        const button = $(
            'button[type="submit"]',
            form
        );


        try {

            const payload =
                serializeForm(form);


            validateWebsite(payload.website);


            if (
                !payload.name ||
                !payload.email ||
                !payload.country
            ) {

                throw new Error(
                    "Employer name, email and country are required."
                );

            }


            if (!window.confirm(

                "Submit this employer registration for administrative review?"

            )) {

                return;

            }


            if (button) button.disabled = true;


            const result = await request(

                CONFIG.API,

                {

                    method: "POST",

                    body: payload

                }

            );


            toast(

                result?.message ||

                "Employer registration request submitted.",

                "success"

            );


            closeRegistration();


            state.page = 1;

            await loadEmployers();

        } catch (error) {

            toast(
                error.message,
                "error"
            );

        } finally {

            if (button) button.disabled = false;

        }

    }


    /* =====================================================
       13. EMPLOYER DETAILS
    ===================================================== */

    function addDetail(container, label, value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            value = "Not provided";

        }


        const wrapper = create("div");

        const dt = create("dt", "", label);

        const dd = create("dd", "", value);


        wrapper.append(dt, dd);

        container.appendChild(wrapper);

    }


    function renderEmployerDetails(employer) {

        const container = byId(
            "employer-details"
        );


        container.replaceChildren();


        const fields = [

            ["Employer Name", employer.name],

            ["Employer Reference", getReference(employer)],

            ["Contact Person", employer.contactName],

            ["Contact Email", employer.email],

            ["Country", employer.country],

            ["Registration Reference", employer.registrationReference],

            ["Industry", employer.industry],

            ["Website", employer.website],

            ["Verification Status", pretty(employer.verificationStatus)],

            ["Account Status", pretty(employer.status)],

            ["Registration Date", dateTime(employer.createdAt)],

            ["Last Activity", dateTime(employer.lastActivityAt)],

            ["Last Reviewed", dateTime(employer.lastReviewedAt)],

            ["Administrative Notes", employer.administrativeNotes]

        ];


        fields.forEach(([label, value]) => {

            addDetail(
                container,
                label,
                value
            );

        });


        const status =
            normalize(employer.status);


        const statusField = $(
            "dd",
            container
        );


        if (statusField) {

            statusField.classList.add(
                `employer-status-${status}`
            );

        }


        const manageButton = byId(
            "open-status-button"
        );


        manageButton.disabled =
            !getReference(employer);

    }


    async function viewEmployer(reference) {

        if (!authorized()) return;


        try {

            const result = await request(
                safePath(reference)
            );


            const employer =
                result?.employer || result;


            if (
                !getReference(employer)
            ) {

                throw new Error(
                    "The employer record could not be verified."
                );

            }


            state.selectedEmployer = employer;


            renderEmployerDetails(employer);


            show(
                byId("employer-details-modal")
            );


        } catch (error) {

            toast(
                error.message,
                "error"
            );

        }

    }


    function closeDetails() {

        hide(
            byId("employer-details-modal")
        );

    }


    /* =====================================================
       14. ACCOUNT STATUS MANAGEMENT
    ===================================================== */

    function openStatusManagement() {

        if (!authorized()) return;


        const employer =
            state.selectedEmployer;


        if (!employer) {

            toast(
                "Select an employer record first.",
                "warning"
            );

            return;

        }


        const reference =
            getReference(employer);


        if (!reference) {

            toast(
                "The employer reference is missing.",
                "error"
            );

            return;

        }


        const form = byId(
            "employer-status-form"
        );


        form.reset();


        form.elements.reference.value =
            reference;


        form.elements.status.value =
            normalize(employer.status);


        closeDetails();


        show(
            byId("employer-status-modal")
        );

    }


    function closeStatusManagement() {

        hide(
            byId("employer-status-modal")
        );

    }


    async function submitStatusChange(event) {

        event.preventDefault();


        if (!authorized()) return;


        const form = event.currentTarget;


        if (!form.reportValidity()) return;


        const reference =
            form.elements.reference.value;


        const status =
            form.elements.status.value;


        const reason =
            form.elements.reason.value.trim();


        if (
            !reference ||
            !status ||
            reason.length < 10
        ) {

            toast(
                "A valid employer, status and detailed reason are required.",
                "error"
            );

            return;

        }


        const previousStatus =
            normalize(state.selectedEmployer?.status);


        if (status === previousStatus) {

            toast(
                "The selected status is already assigned to this employer.",
                "warning"
            );

            return;

        }


        const confirmed = window.confirm(

            `Confirm the requested account status change to ${pretty(status)}?`

        );


        if (!confirmed) return;


        const button = $(
            'button[type="submit"]',
            form
        );


        try {

            if (button) button.disabled = true;


            const result = await request(

                `${safePath(reference)}/status`,

                {

                    method: "PATCH",

                    body: {

                        status,

                        reason

                    }

                }

            );


            toast(

                result?.message ||

                "Employer status change submitted to the server.",

                "success"

            );


            closeStatusManagement();


            state.selectedEmployer = null;


            await loadEmployers();

        } catch (error) {

            toast(
                error.message,
                "error"
            );

        } finally {

            if (button) button.disabled = false;

        }

    }


    /* =====================================================
       15. EMPLOYER ACTION DELEGATION
    ===================================================== */

    function initializeActions() {

        document.addEventListener("click", event => {

            const button = event.target.closest(
                "[data-action]"
            );


            if (!button) return;


            const action =
                button.dataset.action;


            const reference =
                button.dataset.reference;


            if (!reference) {

                toast(
                    "Employer reference is unavailable.",
                    "error"
                );

                return;

            }


            switch (action) {

                case "view":

                case "manage":

                    viewEmployer(reference);

                    break;


                default:

                    break;

            }

        });

    }


    /* =====================================================
       16. NOTIFICATIONS
    ===================================================== */

    function renderNotifications(items) {

        const container = byId(
            "notification-feed"
        );


        container.replaceChildren();


        if (!items.length) {

            container.appendChild(

                create(
                    "div",
                    "empty-state",
                    "No employer administration notifications received."
                )

            );

            return;

        }


        items.forEach(item => {

            const wrapper = create(
                "div",
                "event-item"
            );


            const icon = create(
                "div",
                "event-icon",
                "♧"
            );


            const details = create(
                "div",
                "event-info"
            );


            details.appendChild(

                create(
                    "strong",
                    "",
                    item.title || item.message || "Administrator notification"
                )

            );


            details.appendChild(

                create(
                    "p",
                    "",
                    item.description || item.message || ""
                )

            );


            details.appendChild(

                create(
                    "small",
                    "",
                    dateTime(item.createdAt)
                )

            );


            wrapper.append(icon, details);

            container.appendChild(wrapper);

        });

    }


    async function openNotifications() {

        if (!authorized()) return;


        show(
            byId("notification-drawer")
        );


        try {

            const result = await request(
                `${CONFIG.NOTIFICATIONS}?scope=employers`
            );


            renderNotifications(
                Array.isArray(result?.items)
                    ? result.items
                    : []
            );


            const unread =
                result?.unreadCount;


            if (
                typeof unread === "number" &&
                unread > 0
            ) {

                setText(
                    "notification-count",
                    number(unread)
                );

                show(
                    byId("notification-count")
                );

            } else {

                hide(
                    byId("notification-count")
                );

            }

        } catch (error) {

            toast(
                error.message,
                "error"
            );

        }

    }


    /* =====================================================
       17. MODAL INITIALIZATION
    ===================================================== */

    function initializeModals() {

        byId("add-employer-button")
            ?.addEventListener(
                "click",
                openRegistration
            );


        byId("employer-form")
            ?.addEventListener(
                "submit",
                submitRegistration
            );


        byId("open-status-button")
            ?.addEventListener(
                "click",
                openStatusManagement
            );


        byId("employer-status-form")
            ?.addEventListener(
                "submit",
                submitStatusChange
            );


        $$("[data-close-modal]").forEach(button => {

            button.addEventListener(
                "click",
                closeRegistration
            );

        });


        $$("[data-close-details]").forEach(button => {

            button.addEventListener(
                "click",
                closeDetails
            );

        });


        $$("[data-close-status]").forEach(button => {

            button.addEventListener(
                "click",
                closeStatusManagement
            );

        });


        const modalPairs = [

            ["employer-modal", closeRegistration],

            ["employer-details-modal", closeDetails],

            ["employer-status-modal", closeStatusManagement]

        ];


        modalPairs.forEach(([id, close]) => {

            byId(id)?.addEventListener("click", event => {

                if (event.target.id === id) {

                    close();

                }

            });

        });

    }


    /* =====================================================
       18. SIDEBAR
    ===================================================== */

    function initializeSidebar() {

        byId("menu-button")
            ?.addEventListener("click", () => {

                byId("sidebar")?.classList.add("open");

                show(
                    byId("sidebar-overlay")
                );

            });


        byId("sidebar-close")
            ?.addEventListener("click", closeSidebar);


        byId("sidebar-overlay")
            ?.addEventListener("click", closeSidebar);

    }


    function closeSidebar() {

        byId("sidebar")?.classList.remove("open");

        hide(
            byId("sidebar-overlay")
        );

    }


    /* =====================================================
       19. REFRESH AND PAGINATION CONTROLS
    ===================================================== */

    function initializeControls() {

        byId("refresh-button")
            ?.addEventListener(
                "click",
                loadEmployers
            );


        byId("directory-refresh")
            ?.addEventListener(
                "click",
                loadEmployers
            );


        byId("previous-page")
            ?.addEventListener("click", () => {

                changePage(-1);

            });


        byId("next-page")
            ?.addEventListener("click", () => {

                changePage(1);

            });


        byId("notification-button")
            ?.addEventListener(
                "click",
                openNotifications
            );


        byId("drawer-close")
            ?.addEventListener("click", () => {

                hide(
                    byId("notification-drawer")
                );

            });

    }


    /* =====================================================
       20. KEYBOARD ACCESSIBILITY
    ===================================================== */

    function initializeKeyboard() {

        document.addEventListener("keydown", event => {

            if (event.key !== "Escape") return;


            closeRegistration();

            closeDetails();

            closeStatusManagement();

            closeSidebar();

            hide(
                byId("notification-drawer")
            );

        });

    }


    /* =====================================================
       21. SECURITY AND DATA GOVERNANCE
    ===================================================== */

    function initializeSecurity() {

        /*
         * TALVORA EMPLOYER MANAGEMENT SECURITY
         *
         * 1. All employer data must be retrieved from
         *    the authenticated backend.
         *
         * 2. Only verified Super Admin users may access
         *    privileged employer administration routes.
         *
         * 3. Backend authorization must be checked on
         *    every request, not just at login.
         *
         * 4. Employer registration does not constitute
         *    automatic verification or approval.
         *
         * 5. Account status changes require a recorded
         *    administrative justification.
         *
         * 6. Suspension, reinstatement and activation
         *    are controlled by backend policy.
         *
         * 7. All administrative changes must generate
         *    permanent audit events.
         *
         * 8. Employer records must remain subject to
         *    applicable privacy and retention rules.
         *
         * 9. Tenant boundaries and employer data access
         *    must be enforced server-side.
         *
         * 10. Client-side JavaScript cannot grant roles,
         *     verify organizations or bypass restrictions.
         *
         * 11. Registration references must be validated
         *     against approved authoritative evidence.
         *
         * 12. Account actions must preserve the identity
         *     of the requesting administrator.
         *
         */

    }


    /* =====================================================
       22. STARTUP
    ===================================================== */

    async function initialize() {

        initializeSidebar();

        initializeFilters();

        initializeActions();

        initializeModals();

        initializeControls();

        initializeKeyboard();

        initializeSecurity();


        const authenticated =
            await verifySession();


        if (!authenticated) return;


        await loadEmployers();


        console.info(
            "TALVORA Employer Management initialized."
        );

    }


    /* =====================================================
       23. APPLICATION ENTRY POINT
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
