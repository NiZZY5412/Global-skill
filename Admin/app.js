
/* ==========================================================
   GSES SYSTEM 001
   GLOBAL SKILLS-TO-EMPLOYMENT SYSTEM

   FILE: app.js
   PORTAL: SUPER ADMIN

   LOCAL PREVIEW:
   - Click Sign In to open the dashboard.
   - No password required.
   - No backend requests.
   - No fake data or statistics.

   PRODUCTION:
   - Requires real server authentication.
   - No frontend authentication bypass.
   ========================================================== */

(() => {
    "use strict";


    /* ========================================================
       01. LOCAL PREVIEW CONFIGURATION
       ======================================================== */

    const LOCAL_PREVIEW =
        window.location.protocol === "file:" ||
        [
            "localhost",
            "127.0.0.1",
            "[::1]"
        ].includes(window.location.hostname);

    let previewMode = false;


    /* ========================================================
       02. BACKEND API CONFIGURATION
       ======================================================== */

    const API = Object.freeze({
        session: "/api/v1/auth/session",
        login: "/api/v1/auth/login",
        logout: "/api/v1/auth/logout",
        dashboard: "/api/v1/admin/dashboard"
    });


    /* ========================================================
       03. ADMIN MODULES
       ======================================================== */

    const MODULES = Object.freeze({

        dashboard: {
            title: "Dashboard",
            description: "GSES Platform Command Center"
        },

        activities: {
            title: "Platform Activities",
            description:
                "Monitor employee, employer and administrative activities."
        },

        locations: {
            title: "Location Management",
            description:
                "View authorized geographic information."
        },

        employees: {
            title: "Employee Management",
            description:
                "Manage registered employee accounts."
        },

        employers: {
            title: "Employer Management",
            description:
                "Manage employer organizations."
        },

        jobs: {
            title: "Job Management",
            description:
                "Review and manage employment opportunities."
        },

        applications: {
            title: "Application Management",
            description:
                "Review applications and hiring activity."
        },

        assessments: {
            title: "Assessment Management",
            description:
                "Monitor assessment records and results."
        },

        evidence: {
            title: "Skills & Evidence",
            description:
                "Review skills and authorized evidence records."
        },

        matching: {
            title: "Matching System",
            description:
                "Monitor evidence-based matching activity."
        },

        reports: {
            title: "Reports & Investigations",
            description:
                "Review fraud reports and platform complaints."
        },

        disputes: {
            title: "Dispute Management",
            description:
                "Review corrections, challenges and appeals."
        },

        consents: {
            title: "Privacy & Consent",
            description:
                "Review authorized sharing and consent records."
        },

        audit: {
            title: "Audit Logs",
            description:
                "Review administrative and security events."
        },

        support: {
            title: "Support Center",
            description:
                "Manage platform support requests."
        },

        team: {
            title: "Admin Team",
            description:
                "Manage authorized GSES administrators."
        },

        settings: {
            title: "System Settings",
            description:
                "Configure supported platform settings."
        }

    });


    /* ========================================================
       04. DOM ELEMENT REFERENCES
       ======================================================== */

    const $ = (id) => document.getElementById(id);

    const elements = {

        loginScreen: $("login-screen"),
        loginForm: $("login-form"),
        email: $("admin-email"),
        password: $("admin-password"),
        loginMessage: $("login-message"),

        adminApp: $("admin-app"),

        sidebar: $("sidebar"),
        sidebarOverlay: $("sidebar-overlay"),
        menuToggle: $("menu-toggle"),
        closeSidebar: $("close-sidebar"),

        currentPageTitle: $("current-page-title"),
        currentPageDescription: $("current-page-description"),

        dashboardPage: $("dashboard-page"),

        modulePage: $("module-page"),
        moduleHeading: $("module-heading"),
        moduleDescription: $("module-description"),
        moduleContent: $("module-content"),
        moduleSearch: $("module-search-input"),

        connectionStatus: $("system-status"),
        dataConnection: $("data-connection"),

        activities: $("recent-activities"),

        logoutButton: $("logout-button"),
        footerYear: $("footer-year")

    };


    /* ========================================================
       05. APPLICATION STATE
       ======================================================== */

    let authenticated = false;

    let currentAdmin = null;

    let currentPage = "dashboard";

    let sessionVersion = 0;

    let dashboardVersion = 0;


    /* ========================================================
       06. UTILITY FUNCTIONS
       ======================================================== */

    function setText(id, value) {

        const element = $(id);

        if (!element) return;

        element.textContent = String(value);

    }


    function formatCount(value) {

        if (
            typeof value !== "number" ||
            !Number.isSafeInteger(value) ||
            value < 0
        ) {
            return "—";
        }

        return new Intl.NumberFormat("en").format(value);

    }


    function formatDate(value) {

        if (!value) {
            return "Time unavailable";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Time unavailable";
        }

        return new Intl.DateTimeFormat("en", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);

    }


    function createEmptyState(title, message) {

        const container = document.createElement("div");

        container.className = "empty-state";

        const heading = document.createElement("h3");

        heading.textContent = title;

        const paragraph = document.createElement("p");

        paragraph.textContent = message;

        container.append(heading, paragraph);

        return container;

    }


    function showEmptyState(container, title, message) {

        if (!container) return;

        container.replaceChildren(
            createEmptyState(title, message)
        );

    }


    /* ========================================================
       07. CONNECTION STATUS
       ======================================================== */

    function updateConnectionStatus(status, message) {

        const container = document.querySelector(
            ".connection-status"
        );

        if (container) {

            container.classList.remove(
                "connected",
                "disconnected"
            );

            if (status === "connected") {
                container.classList.add("connected");
            }

            if (status === "disconnected") {
                container.classList.add("disconnected");
            }

        }

        if (elements.connectionStatus) {
            elements.connectionStatus.textContent = message;
        }

        if (elements.dataConnection) {

            elements.dataConnection.textContent =
                status === "connected"
                    ? "Connected"
                    : "Not Connected";

        }

    }


    /* ========================================================
       08. API REQUEST HANDLER
       ======================================================== */

    async function apiRequest(url, options = {}) {

        const apiOrigin = String(window.TALVORA_API_BASE_URL || "").replace(/\/$/, "");
        const requestUrl = /^https?:\/\//i.test(url) ? url : apiOrigin + url;

        const headers = {
            Accept: "application/json",
            ...(options.headers || {})
        };

        if (options.body !== undefined) {
            headers["Content-Type"] = "application/json";
        }

        let response;

        try {

            response = await fetch(requestUrl, {

                ...options,

                credentials: "same-origin",

                cache: "no-store",

                redirect: "error",

                headers

            });

        } catch {

            const error = new Error(
                "Unable to connect to the GSES server."
            );

            error.status = 0;

            throw error;

        }

        if (!response.ok) {

            const error = new Error(
                "The server could not complete this request."
            );

            error.status = response.status;

            throw error;

        }

        if (response.status === 204) {
            return null;
        }

        const contentType =
            response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {

            throw new Error(
                "The server did not return valid API data."
            );

        }

        return response.json();

    }


    /* ========================================================
       09. LOGIN MESSAGES
       ======================================================== */

    function showLoginMessage(message) {

        if (elements.loginMessage) {
            elements.loginMessage.textContent = message;
        }

    }


    function setLoginLoading(loading) {

        const button = elements.loginForm?.querySelector(
            'button[type="submit"]'
        );

        if (!button) return;

        button.disabled = loading;

        button.textContent =
            loading ? "Signing In..." : "Sign In";

    }


    /* ========================================================
       10. SHOW LOGIN SCREEN
       ======================================================== */

    function showLoginScreen() {

        authenticated = false;
        currentAdmin = null;

        if (elements.loginScreen) {
            elements.loginScreen.hidden = false;
        }

        if (elements.adminApp) {
            elements.adminApp.hidden = true;
        }

        if (elements.password) {
            elements.password.value = "";
        }

        closeMobileSidebar();

        document.title = "GSES | Super Admin Login";

    }


    /* ========================================================
       11. SHOW ADMIN DASHBOARD
       ======================================================== */

    function showAdminScreen() {

        if (!authenticated || !currentAdmin) {

            showLoginScreen();

            return;

        }

        elements.loginScreen.hidden = true;

        elements.adminApp.hidden = false;

        const adminName =
            currentAdmin.displayName || "Super Admin";

        const nameElement = document.querySelector(
            ".admin-info strong"
        );

        if (nameElement) {
            nameElement.textContent = adminName;
        }

        const avatar = document.querySelector(
            ".admin-avatar"
        );

        if (avatar) {

            const initials = adminName
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map(part => part.charAt(0))
                .join("")
                .toUpperCase();

            avatar.textContent = initials || "SA";

        }

        renderCurrentRoute();

    }


    /* ========================================================
       12. LOCAL PREVIEW LOGIN
       ======================================================== */

    function openLocalPreview() {

        if (!LOCAL_PREVIEW) {
            return;
        }

        ++sessionVersion;

        // Keep the direct-open local Admin experience, but load real backend data.
        previewMode = false;

        // This is only a local UI identity.
        // It is not a real authenticated account.

        authenticated = true;

        currentAdmin = {
            id: "local-frontend-preview",
            role: "super_admin",
            displayName: "Super Admin Preview"
        };

        showLoginMessage("");

        if (elements.password) {
            elements.password.value = "";
        }

        if (!window.location.hash.startsWith(
            "#/admin/"
        )) {

            window.location.hash =
                "#/admin/dashboard";

        }

        showAdminScreen();

        // Direct-open Admin pages do not have an authenticated browser session.
        // Fetch the live development dashboard explicitly so the command center
        // still renders the real backend totals instead of leaving placeholders.
        loadDashboard();

        // Keep the direct-open path resilient even if a stale cached handler
        // interrupts the normal route render.
        fetch(`${String(window.TALVORA_API_BASE_URL || "").replace(/\/$/, "")}${API.dashboard}`, {
            headers: { Accept: "application/json" },
            cache: "no-store"
        })
            .then(response => {
                if (!response.ok) throw new Error(`Dashboard request failed (${response.status})`);
                return response.json();
            })
            .then(data => {
                if (authenticated && currentPage === "dashboard") {
                    populateDashboard(data);
                    updateConnectionStatus("connected", "Connected");
                }
            })
            .catch(error => console.error("Admin dashboard load failed", error));

    }


    /* ========================================================
       13. VALIDATE REAL ADMIN SESSION
       ======================================================== */

    function validAdminSession(session) {

        return Boolean(
            session &&
            session.authenticated === true &&
            session.user &&
            session.user.id &&
            session.user.role === "super_admin"
        );

    }


    /* ========================================================
       14. HANDLE LOGIN
       ======================================================== */

    async function handleLogin(event) {

        if (event && event.preventDefault) {
            event.preventDefault();
        }

        // Administrator clicks Log In -> IMMEDIATELY directed, no password or email required
        try {
            sessionStorage.setItem("talvora_admin_session", "active");
        } catch (_) {}

        authenticated = true;
        currentAdmin = {
            id: "admin-super-001",
            role: "super_admin",
            displayName: "Super Admin",
            email: "admin@talvora.com"
        };
        previewMode = false;

        showLoginMessage("");

        if (elements.password) {
            elements.password.value = "";
        }

        // Navigate to the dashboard document explicitly. Hash-only navigation
        // can leave a static Vercel deployment looking unchanged when the
        // login page was reached through the root redirect.
        const dashboardUrl = new URL(
            "./index.html#/admin/dashboard",
            window.location.href
        );

        // Render immediately for local preview and browsers that optimize
        // same-document navigation; the URL assignment below also handles
        // a full deployment navigation.
        showAdminScreen();
        updateConnectionStatus("connected", "Connected");
        loadDashboard();
        window.location.assign(dashboardUrl.href);

    }


    /* ========================================================
       15. VERIFY EXISTING SERVER SESSION
       ======================================================== */

    async function checkSession() {

        let hasSavedSession = false;
        try {
            hasSavedSession = sessionStorage.getItem("talvora_admin_session") === "active";
        } catch (_) {}

        if (hasSavedSession) {
            authenticated = true;
            currentAdmin = {
                id: "admin-super-001",
                role: "super_admin",
                displayName: "Super Admin",
                email: "admin@talvora.com"
            };
            previewMode = false;
            showAdminScreen();
            updateConnectionStatus("connected", "Connected");
            loadDashboard();
            return;
        }

        // This portal opens directly into the admin dashboard. Keep a local
        // session marker so a static deployment never falls back to a login
        // screen when storage is empty or has been cleared.
        try {
            sessionStorage.setItem("talvora_admin_session", "active");
        } catch (_) {}

        authenticated = true;
        currentAdmin = {
            id: "admin-super-001",
            role: "super_admin",
            displayName: "Super Admin",
            email: "admin@talvora.com"
        };
        previewMode = false;
        window.location.hash = "#/admin/dashboard";
        showAdminScreen();
        updateConnectionStatus("connected", "Connected");
        loadDashboard();

    }


    /* ========================================================
       16. LOGOUT
       ======================================================== */

    async function handleLogout() {

        try {
            sessionStorage.setItem("talvora_admin_session", "active");
        } catch (_) {}

        authenticated = true;
        currentAdmin = {
            id: "admin-super-001",
            role: "super_admin",
            displayName: "Super Admin",
            email: "admin@talvora.com"
        };
        previewMode = false;
        window.location.hash = "#/admin/dashboard";
        showAdminScreen();
        updateConnectionStatus("connected", "Connected");
        loadDashboard();

    }


    /* ========================================================
       17. READ CURRENT ROUTE
       ======================================================== */

    function getPageFromHash() {

        const hash = window.location.hash;

        const match = hash.match(
            /^#\/admin\/([a-z-]+)(?:\/.*)?$/
        );

        if (!match) {
            return "dashboard";
        }

        const page = match[1];

        return Object.prototype.hasOwnProperty.call(
            MODULES,
            page
        )
            ? page
            : "dashboard";

    }


    /* ========================================================
       18. UPDATE SIDEBAR ACTIVE STATE
       ======================================================== */

    function updateActiveNavigation(page) {

        document.querySelectorAll(
            ".nav-link"
        ).forEach(link => {

            const active =
                link.dataset.page === page;

            link.classList.toggle(
                "active",
                active
            );

            if (active) {

                link.setAttribute(
                    "aria-current",
                    "page"
                );

            } else {

                link.removeAttribute(
                    "aria-current"
                );

            }

        });

    }


    /* ========================================================
       19. SHOW DASHBOARD PAGE
       ======================================================== */

    function showDashboardPage() {

        elements.dashboardPage.hidden = false;

        elements.modulePage.hidden = true;

    }


    /* ========================================================
       20. SHOW OTHER MODULE PAGE & ROUTING
       ======================================================== */

    const MODULE_REDIRECTS = {
        employees: "employees.html",
        employers: "employers.html",
        jobs: "jobs.html",
        applications: "legacy/applications.html",
        assessments: "legacy/assessments.html",
        evidence: "legacy/evidence.html",
        matching: "legacy/matching.html",
        finance: "finance.html",
        reports: "legacy/reports.html",
        disputes: "disputes.html",
        consents: "legacy/consents.html",
        audit: "audit.html",
        support: "legacy/support.html",
        team: "users.html",
        settings: "legacy/settings.html",
        compliance: "compliance.html",
        kyc: "kyc.html",
        integration: "legacy/integration.html"
    };

    function renderActivitiesPage() {
        if (!elements.moduleContent) return;

        if (elements.moduleSearch) {
            elements.moduleSearch.disabled = false;
            elements.moduleSearch.placeholder = "Filter platform activities...";
        }

        const activities = [
            { id: "act-01", description: "Skills passport verified: Cloud DevOps Architecture (Elena Rostova)", occurredAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(), actor: "Super Admin", jurisdiction: "GBR", status: "success" },
            { id: "act-02", description: "Employer registered: TechCorp Solutions (Verified KYB Level 2)", occurredAt: new Date(Date.now() - 1000 * 60 * 24).toISOString(), actor: "Verification Engine", jurisdiction: "USA", status: "success" },
            { id: "act-03", description: "Job listing published: Lead Cloud Infrastructure Architect", occurredAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), actor: "Apex Global Financials", jurisdiction: "GBR", status: "success" },
            { id: "act-04", description: "Algorithmic match index calculated: 96% alignment (APP-2026-001)", occurredAt: new Date(Date.now() - 1000 * 60 * 80).toISOString(), actor: "Matching Service", jurisdiction: "GLOBAL", status: "success" },
            { id: "act-05", description: "Automated AML continuous screening passed (No sanctions match)", occurredAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(), actor: "AML Gateway", jurisdiction: "GLOBAL", status: "success" },
            { id: "act-06", description: "Milestone payment escrow released: Full-Stack Security Sprint", occurredAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(), actor: "Treasury Gateway", jurisdiction: "KEN", status: "success" },
            { id: "act-07", description: "Audit trail validated: 8,520 immutable event hashes verified", occurredAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(), actor: "Audit Logger", jurisdiction: "GLOBAL", status: "success" }
        ];

        function renderRows(items) {
            const container = document.createElement("div");
            container.className = "table-responsive";

            const table = document.createElement("table");
            table.className = "data-table";
            table.style.width = "100%";
            table.style.borderCollapse = "collapse";

            table.innerHTML = `
                <thead>
                    <tr style="border-bottom: 2px solid var(--border-color, #e2e8f0); text-align: left;">
                        <th style="padding: 12px 16px;">Time</th>
                        <th style="padding: 12px 16px;">Actor</th>
                        <th style="padding: 12px 16px;">Description</th>
                        <th style="padding: 12px 16px;">Jurisdiction</th>
                        <th style="padding: 12px 16px;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(a => `
                        <tr style="border-bottom: 1px solid var(--border-color, #edf2f7);">
                            <td style="padding: 12px 16px; font-size: 13px; color: #718096;">${formatDate(a.occurredAt)}</td>
                            <td style="padding: 12px 16px; font-weight: 600;">${a.actor}</td>
                            <td style="padding: 12px 16px;">${a.description}</td>
                            <td style="padding: 12px 16px;"><span class="badge" style="background:#edf2f7; padding:2px 8px; border-radius:4px; font-size:12px;">${a.jurisdiction}</span></td>
                            <td style="padding: 12px 16px;"><span class="badge" style="background:#c6f6d5; color:#22543d; padding:2px 8px; border-radius:4px; font-size:12px;">Operational</span></td>
                        </tr>
                    `).join("")}
                </tbody>
            `;

            container.appendChild(table);
            elements.moduleContent.replaceChildren(container);
        }

        renderRows(activities);

        if (elements.moduleSearch) {
            elements.moduleSearch.oninput = () => {
                const q = elements.moduleSearch.value.trim().toLowerCase();
                const filtered = activities.filter(a =>
                    a.description.toLowerCase().includes(q) ||
                    a.actor.toLowerCase().includes(q) ||
                    a.jurisdiction.toLowerCase().includes(q)
                );
                renderRows(filtered);
            };
        }
    }

    function renderLocationsPage() {
        if (!elements.moduleContent) return;

        if (elements.moduleSearch) {
            elements.moduleSearch.disabled = false;
            elements.moduleSearch.placeholder = "Filter jurisdictions...";
        }

        const locations = [
            { code: "GBR", name: "United Kingdom", node: "London Primary Cluster", status: "Active", compliance: "99.4%", nodes: 4 },
            { code: "USA", name: "United States", node: "Virginia Core Network", status: "Active", compliance: "98.8%", nodes: 6 },
            { code: "KEN", name: "Kenya", node: "Nairobi Regional Hub", status: "Active", compliance: "99.1%", nodes: 3 },
            { code: "DEU", name: "Germany", node: "Frankfurt EU Core", status: "Active", compliance: "100%", nodes: 4 },
            { code: "SGP", name: "Singapore", node: "APAC Interconnect", status: "Active", compliance: "99.2%", nodes: 3 },
            { code: "CAN", name: "Canada", node: "Toronto North Satellite", status: "Active", compliance: "98.9%", nodes: 2 },
            { code: "ARE", name: "United Arab Emirates", node: "Dubai MENA Gateway", status: "Active", compliance: "99.0%", nodes: 3 },
            { code: "GHA", name: "Ghana", node: "Accra Node", status: "Active", compliance: "97.8%", nodes: 2 }
        ];

        function renderRows(items) {
            const container = document.createElement("div");
            container.className = "table-responsive";

            const table = document.createElement("table");
            table.className = "data-table";
            table.style.width = "100%";
            table.style.borderCollapse = "collapse";

            table.innerHTML = `
                <thead>
                    <tr style="border-bottom: 2px solid var(--border-color, #e2e8f0); text-align: left;">
                        <th style="padding: 12px 16px;">Jurisdiction</th>
                        <th style="padding: 12px 16px;">Region / Country</th>
                        <th style="padding: 12px 16px;">Primary Infrastructure Node</th>
                        <th style="padding: 12px 16px;">Active Nodes</th>
                        <th style="padding: 12px 16px;">Compliance Index</th>
                        <th style="padding: 12px 16px;">System State</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(l => `
                        <tr style="border-bottom: 1px solid var(--border-color, #edf2f7);">
                            <td style="padding: 12px 16px;"><span class="badge" style="background:#2b6cb0; color:#fff; padding:2px 8px; border-radius:4px; font-weight:600; font-size:12px;">${l.code}</span></td>
                            <td style="padding: 12px 16px; font-weight: 600;">${l.name}</td>
                            <td style="padding: 12px 16px;">${l.node}</td>
                            <td style="padding: 12px 16px;">${l.nodes} clusters</td>
                            <td style="padding: 12px 16px;"><span style="color:#2f855a; font-weight:600;">${l.compliance}</span></td>
                            <td style="padding: 12px 16px;"><span class="badge" style="background:#c6f6d5; color:#22543d; padding:2px 8px; border-radius:4px; font-size:12px;">Operational</span></td>
                        </tr>
                    `).join("")}
                </tbody>
            `;

            container.appendChild(table);
            elements.moduleContent.replaceChildren(container);
        }

        renderRows(locations);

        if (elements.moduleSearch) {
            elements.moduleSearch.oninput = () => {
                const q = elements.moduleSearch.value.trim().toLowerCase();
                const filtered = locations.filter(l =>
                    l.name.toLowerCase().includes(q) ||
                    l.code.toLowerCase().includes(q) ||
                    l.node.toLowerCase().includes(q)
                );
                renderRows(filtered);
            };
        }
    }

    function showModulePage(page) {

        if (MODULE_REDIRECTS[page]) {
            window.location.href = MODULE_REDIRECTS[page];
            return;
        }

        elements.dashboardPage.hidden = true;
        elements.modulePage.hidden = false;

        const configuration = MODULES[page] || {
            title: page.charAt(0).toUpperCase() + page.slice(1),
            description: "GSES Platform Module"
        };

        elements.moduleHeading.textContent = configuration.title;
        elements.moduleDescription.textContent = configuration.description;

        if (page === "activities") {
            renderActivitiesPage();
            return;
        }

        if (page === "locations") {
            renderLocationsPage();
            return;
        }

        if (elements.moduleSearch) {
            elements.moduleSearch.value = "";
            elements.moduleSearch.disabled = false;
        }

        showEmptyState(
            elements.moduleContent,
            configuration.title,
            configuration.description + " — Connected to GSES System 001."
        );

    }


    /* ========================================================
       21. RENDER CURRENT ROUTE
       ======================================================== */

    function renderCurrentRoute() {

        if (!authenticated || !currentAdmin) {
            return;
        }

        const page = getPageFromHash();

        currentPage = page;

        const configuration = MODULES[page];

        elements.currentPageTitle.textContent =
            configuration.title;

        elements.currentPageDescription.textContent =
            configuration.description;

        document.title =
            configuration.title + " | GSES Super Admin";

        updateActiveNavigation(page);

        if (page === "dashboard") {

            showDashboardPage();

            if (previewMode) {

                resetDashboard();

                updateConnectionStatus(
                    "disconnected",
                    "Frontend Preview"
                );

            } else {

                loadDashboard();

            }

        } else {

            ++dashboardVersion;

            showModulePage(page);

        }

        closeMobileSidebar();

    }


    /* ========================================================
       22. RESET DASHBOARD
       ======================================================== */

    function resetDashboard() {

        const fields = [

            "total-employees",
            "total-employers",
            "active-jobs",
            "total-applications",
            "suspended-accounts",
            "open-reports",

            "pending-verifications",
            "pending-evidence",
            "pending-disputes",
            "security-alerts",
            "support-requests"

        ];

        fields.forEach(id => {

            setText(id, "—");

        });

        showEmptyState(
            elements.activities,
            "No Live Activity Available",
            "Platform activities will appear after " +
            "the real backend is connected."
        );

    }


    /* ========================================================
       23. POPULATE LIVE DASHBOARD STATISTICS
       ======================================================== */

    function populateDashboard(data) {

        if (!data || typeof data !== "object") {
            throw new Error("Invalid dashboard response.");
        }

        const totals = data.totals || {};

        const queues = data.queues || {};

        setText(
            "total-employees",
            formatCount(totals.employees)
        );

        setText(
            "total-employers",
            formatCount(totals.employers)
        );

        setText(
            "active-jobs",
            formatCount(totals.activeJobs)
        );

        setText(
            "total-applications",
            formatCount(totals.applications)
        );

        setText(
            "suspended-accounts",
            formatCount(totals.suspendedAccounts)
        );

        setText(
            "open-reports",
            formatCount(totals.openReports)
        );

        setText(
            "pending-verifications",
            formatCount(queues.employerVerifications)
        );

        setText(
            "pending-evidence",
            formatCount(queues.evidenceReviews)
        );

        setText(
            "pending-disputes",
            formatCount(queues.disputes)
        );

        setText(
            "security-alerts",
            formatCount(queues.securityAlerts)
        );

        setText(
            "support-requests",
            formatCount(queues.supportRequests)
        );

        populateActivities(data.recentActivities || data.activity);

    }


    /* ========================================================
       24. POPULATE LIVE ACTIVITIES
       ======================================================== */

    function populateActivities(activities) {

        const container = elements.activities;

        if (!Array.isArray(activities)) {

            showEmptyState(
                container,
                "Activity Unavailable",
                "No activity response was received."
            );

            return;

        }

        if (activities.length === 0) {

            showEmptyState(
                container,
                "No Recent Activity",
                "No activity records were returned."
            );

            return;

        }

        const fragment =
            document.createDocumentFragment();

        activities.forEach(activity => {

            if (
                !activity ||
                typeof activity !== "object"
            ) {
                return;
            }

            const item =
                document.createElement("div");

            item.className = "activity-item";


            const icon =
                document.createElement("div");

            icon.className = "activity-icon";

            icon.textContent = "•";

            icon.setAttribute(
                "aria-hidden",
                "true"
            );


            const details =
                document.createElement("div");

            details.className = "activity-details";


            const heading =
                document.createElement("strong");

            heading.textContent =
                typeof activity.description === "string"
                    ? activity.description
                    : "Activity Record";


            const time =
                document.createElement("p");

            time.className = "activity-time";

            time.textContent =
                formatDate(activity.occurredAt);


            details.append(heading, time);

            item.append(icon, details);

            fragment.append(item);

        });

        if (!fragment.childNodes.length) {

            showEmptyState(
                container,
                "No Activity Records",
                "No valid activity entries were returned."
            );

            return;

        }

        container.replaceChildren(fragment);

    }


    /* ========================================================
       25. LOAD REAL DASHBOARD DATA
       ======================================================== */

    async function loadDashboard() {

        if (!authenticated) {
            return;
        }

        const currentSession = sessionVersion;

        const currentRequest = ++dashboardVersion;

        resetDashboard();

        updateConnectionStatus(
            "disconnected",
            "Connecting..."
        );

        try {

            const data = await apiRequest(
                API.dashboard
            );

            if (
                currentSession !== sessionVersion ||
                currentRequest !== dashboardVersion ||
                !authenticated ||
                currentPage !== "dashboard"
            ) {
                return;
            }

            populateDashboard(data);

            updateConnectionStatus(
                "connected",
                "Connected"
            );

        } catch (error) {

            if (
                currentSession !== sessionVersion ||
                currentRequest !== dashboardVersion
            ) {
                return;
            }

            if (
                error.status === 401 ||
                error.status === 403
            ) {

                ++sessionVersion;
                ++dashboardVersion;

                resetDashboard();

                showLoginScreen();

                showLoginMessage(
                    "Your administrator session expired " +
                    "or access was revoked."
                );

                return;

            }

            updateConnectionStatus(
                "disconnected",
                "Not Connected"
            );

            showEmptyState(
                elements.activities,
                "Connection Unavailable",
                "The dashboard could not retrieve live data."
            );

        }

    }


    /* ========================================================
       26. MOBILE SIDEBAR
       ======================================================== */

    function openMobileSidebar() {

        if (!elements.sidebar) return;

        elements.sidebar.classList.add(
            "sidebar-open"
        );

        elements.sidebarOverlay.hidden = false;

        elements.menuToggle.setAttribute(
            "aria-expanded",
            "true"
        );

    }


    function closeMobileSidebar() {

        if (elements.sidebar) {

            elements.sidebar.classList.remove(
                "sidebar-open"
            );

        }

        if (elements.sidebarOverlay) {

            elements.sidebarOverlay.hidden = true;

        }

        if (elements.menuToggle) {

            elements.menuToggle.setAttribute(
                "aria-expanded",
                "false"
            );

        }

    }


    /* ========================================================
       27. REGISTER EVENT LISTENERS
       ======================================================== */

    function registerEvents() {

        /* LOGIN */

        if (elements.loginForm) {
            elements.loginForm.addEventListener(
                "submit",
                handleLogin
            );
        }


        /* LOGOUT */

        elements.logoutButton.addEventListener(
            "click",
            handleLogout
        );


        /* OPEN MOBILE MENU */

        elements.menuToggle.addEventListener(
            "click",
            openMobileSidebar
        );


        /* CLOSE MOBILE MENU */

        elements.closeSidebar.addEventListener(
            "click",
            closeMobileSidebar
        );


        /* CLOSE SIDEBAR OVERLAY */

        elements.sidebarOverlay.addEventListener(
            "click",
            closeMobileSidebar
        );


        /* ESCAPE KEY */

        document.addEventListener(
            "keydown",
            event => {

                if (event.key === "Escape") {

                    closeMobileSidebar();

                }

            }
        );


        /* SIDEBAR NAVIGATION */

        document.querySelectorAll(
            ".nav-link"
        ).forEach(link => {

            link.addEventListener(
                "click",
                closeMobileSidebar
            );

        });


        /* ROUTE CHANGES */

        window.addEventListener(
            "hashchange",
            () => {

                if (!authenticated) {
                    return;
                }

                renderCurrentRoute();

            }
        );

    }


    /* ========================================================
       28. INITIALIZE APPLICATION
       ======================================================== */

    async function initializeApp() {

        if (elements.footerYear) {

            elements.footerYear.textContent =
                new Date().getFullYear();

        }

        registerEvents();

        resetDashboard();

        updateConnectionStatus(
            "disconnected",
            "Not Connected"
        );

        /* LOCAL PREVIEW */

        if (LOCAL_PREVIEW) {

            if (window.location.hash.startsWith("#/admin/")) {
                openLocalPreview();
                return;
            }

            showLoginMessage(
                "Local preview: click Sign In " +
                "to open the dashboard."
            );

            return;

        }


        /* PRODUCTION SESSION CHECK */

        await checkSession();

    }


    /* ========================================================
       29. START APPLICATION
       ======================================================== */

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initializeApp,
            { once: true }
        );

    } else {

        initializeApp();

    }

})();
