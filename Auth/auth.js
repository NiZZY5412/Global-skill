
/* ==========================================================
   TALVORA UNIFIED AUTHENTICATION ENGINE

   ONE AUTHENTICATION SYSTEM
   TWO ACCOUNT TYPES:
       1. EMPLOYEE
       2. EMPLOYER

   FEATURES:
       - Login
       - Registration
       - Account type switching
       - Form validation
       - API integration
       - Session management
       - Dashboard redirection

   NO PUBLIC ADMIN ACCOUNT TYPE
========================================================== */

(() => {

    "use strict";


    /* ======================================================
       1. CONFIGURATION
    ====================================================== */

    const CONFIG = window.TALVORA_APP_CONFIG || {};

    const API_ORIGIN = String(CONFIG.apiOrigin || "")
        .replace(/\/+$/, "");

    const AUTH_API = CONFIG.authApiBase || "/api/auth";

    const DASHBOARDS = {

        employee:
            CONFIG.employeeDashboardUrl ||
            "../Employee/employee-dashboard.html",

        employer:
            CONFIG.employerDashboardUrl ||
            "../Employer/employer-dashboard.html"

    };


    /* ======================================================
       2. STATE
    ====================================================== */

    const state = {

        portal: "employee",

        mode: "login",

        loading: false

    };


    /* ======================================================
       3. ELEMENT REFERENCES
    ====================================================== */

    const form = document.getElementById("authForm");

    if (!form) return;


    const elements = {

        title:
            document.getElementById("authTitle"),

        subtitle:
            document.getElementById("authSubtitle"),

        submit:
            document.getElementById("submitButton"),

        message:
            document.getElementById("authMessage"),

        switchMessage:
            document.getElementById("switchMessage"),

        switchMode:
            document.getElementById("switchMode"),

        email:
            document.getElementById("email"),

        password:
            document.getElementById("password"),

        confirmPassword:
            document.getElementById("confirmPassword"),

        firstName:
            document.getElementById("firstName"),

        lastName:
            document.getElementById("lastName"),

        companyName:
            document.getElementById("companyName"),

        companyCode:
            document.getElementById("companyCode"),

        invitationCode:
            document.getElementById("invitationCode"),

        acceptTerms:
            document.getElementById("acceptTerms")

    };


    /* ======================================================
       4. FIELD VISIBILITY CONTROL
    ====================================================== */

    function setGroup(id, visible, required = false) {

        const group = document.getElementById(id);

        if (!group) return;

        group.hidden = !visible;

        const fields = group.querySelectorAll(
            "input, select, textarea"
        );

        fields.forEach(field => {

            field.disabled = !visible;

            field.required = visible && required;

        });

    }


    /* ======================================================
       5. FEEDBACK CONTROL
    ====================================================== */

    function showMessage(message, type = "error") {

        elements.message.textContent = message;

        elements.message.className =
            "auth-message " + type;

        elements.message.hidden = false;

    }


    function clearMessage() {

        elements.message.textContent = "";

        elements.message.className = "auth-message";

        elements.message.hidden = true;

    }


    /* ======================================================
       6. ACCOUNT TYPE SWITCHING
    ====================================================== */

    function setPortal(portal) {

        if (!["employee", "employer"].includes(portal)) {
            return;
        }

        state.portal = portal;

        document.querySelectorAll("[data-portal]")
            .forEach(button => {

                const active =
                    button.dataset.portal === portal;

                button.classList.toggle("active", active);

                button.setAttribute(
                    "aria-pressed",
                    String(active)
                );

            });

        clearMessage();

        updateInterface();

    }


    /* ======================================================
       7. LOGIN / REGISTRATION SWITCHING
    ====================================================== */

    function setMode(mode) {

        if (!["login", "signup"].includes(mode)) {
            return;
        }

        state.mode = mode;

        document.querySelectorAll("[data-mode]")
            .forEach(button => {

                const active =
                    button.dataset.mode === mode;

                button.classList.toggle("active", active);

                button.setAttribute(
                    "aria-pressed",
                    String(active)
                );

            });

        clearMessage();

        updateInterface();

    }


    /* ======================================================
       8. UPDATE AUTHENTICATION INTERFACE
    ====================================================== */

    function updateInterface() {

        const portal = state.portal;

        const signup = state.mode === "signup";

        const employee = portal === "employee";

        /* ----------------------------------------------
           HEADINGS
        ---------------------------------------------- */

        if (!signup) {

            elements.title.textContent =
                "Welcome back";

            elements.subtitle.textContent = employee

                ? "Sign in to access your employee workspace."

                : "Sign in to manage your organization and workforce.";

        } else {

            elements.title.textContent = employee

                ? "Create your employee account"

                : "Register your organization";

            elements.subtitle.textContent = employee

                ? "Create your employee account to search for jobs, or use an employer invitation code if you have one."

                : "Create your organization account and get started with TALVORA.";

        }


        /* ----------------------------------------------
           REGISTRATION FIELDS
        ---------------------------------------------- */

        setGroup(
            "companyNameGroup",
            signup && !employee,
            true
        );

        setGroup(
            "firstNameGroup",
            signup,
            true
        );

        setGroup(
            "lastNameGroup",
            signup,
            true
        );

        setGroup(
            "invitationGroup",
            signup && employee,
            true
        );

        setGroup(
            "confirmPasswordGroup",
            signup,
            true
        );

        setGroup(
            "termsGroup",
            signup,
            true
        );


        /* ----------------------------------------------
           COMPANY CODE
        ---------------------------------------------- */

        setGroup(
            "companyCodeGroup",
            !signup,
            false
        );


        /* ----------------------------------------------
           PASSWORD REQUIREMENTS
        ---------------------------------------------- */

        elements.password.minLength =
            signup ? 12 : 0;

        elements.password.autocomplete =
            signup ? "new-password" : "current-password";

        elements.confirmPassword.autocomplete =
            "new-password";

        document.getElementById("passwordHelp").hidden =
            !signup;


        /* ----------------------------------------------
           BUTTON LABELS
        ---------------------------------------------- */

        if (!signup) {

            elements.submit.textContent = employee

                ? "Sign In to Employee Portal"

                : "Sign In to Employer Portal";

            elements.switchMessage.innerHTML =
                'New to TALVORA? ';

            elements.switchMode.textContent =
                "Create an account";

        } else {

            elements.submit.textContent = employee

                ? "Create Employee Account"

                : "Register Employer Account";

            elements.switchMessage.innerHTML =
                "Already have an account? ";

            elements.switchMode.textContent =
                "Sign in";

        }

    }


    /* ======================================================
       9. PASSWORD VISIBILITY
    ====================================================== */

    document.querySelectorAll(".password-toggle")
        .forEach(button => {

            button.addEventListener("click", () => {

                const targetId =
                    button.dataset.target;

                const input =
                    document.getElementById(targetId);

                if (!input) return;

                const show =
                    input.type === "password";

                input.type = show
                    ? "text"
                    : "password";

                button.textContent =
                    show ? "Hide" : "Show";

            });

        });


    /* ======================================================
       10. PASSWORD VALIDATION
    ====================================================== */

    function validateForm() {

        if (!form.reportValidity()) {
            return false;
        }

        const password =
            elements.password.value;

        if (state.mode === "signup") {

            if (password.length < 12) {

                showMessage(
                    "Your password must contain at least 12 characters."
                );

                return false;

            }

            if (
                password !==
                elements.confirmPassword.value
            ) {

                showMessage(
                    "Your passwords do not match."
                );

                elements.confirmPassword.focus();

                return false;

            }

            if (!elements.acceptTerms.checked) {

                showMessage(
                    "Please accept the Terms of Service and Privacy Policy."
                );

                return false;

            }

        }

        return true;

    }


    /* ======================================================
       11. CREATE REQUEST PAYLOAD
    ====================================================== */

    function createPayload() {

        const payload = {

            email: elements.email.value
                .trim()
                .toLowerCase(),

            password: elements.password.value

        };


        if (state.mode === "login") {

            const companyCode =
                elements.companyCode.value.trim();

            if (companyCode) {

                payload.companyCode =
                    companyCode;

            }

            return payload;

        }


        payload.firstName =
            elements.firstName.value.trim();

        payload.lastName =
            elements.lastName.value.trim();

        payload.acceptTerms = true;


        if (state.portal === "employer") {

            payload.companyName =
                elements.companyName.value.trim();

        }


        if (state.portal === "employee") {

            payload.invitationCode =
                elements.invitationCode.value.trim();

        }

        return payload;

    }


    /* ======================================================
       12. API ENDPOINT
    ====================================================== */

    function getEndpoint() {

        const action =
            state.mode === "login"
                ? "login"
                : "register";

        return (
            API_ORIGIN +
            AUTH_API +
            "/" +
            state.portal +
            "/" +
            action
        );

    }


    /* ======================================================
       13A. FRONTEND-ONLY PREVIEW AUTHENTICATION
       Temporary bridge until the real API is available.
       It stores only accounts created in this browser and
       never seeds users or business data.
    ====================================================== */

    const LOCAL_ACCOUNTS_KEY = "talvora_frontend_accounts_v1";

    async function hashPassword(password) {
        if (window.crypto?.subtle && window.TextEncoder) {
            const bytes = new TextEncoder().encode(password);
            const digest = await window.crypto.subtle.digest("SHA-256", bytes);
            return Array.from(new Uint8Array(digest))
                .map(byte => byte.toString(16).padStart(2, "0"))
                .join("");
        }

        return btoa(unescape(encodeURIComponent(password)));
    }

    function readLocalAccounts() {
        try {
            const value = JSON.parse(localStorage.getItem(LOCAL_ACCOUNTS_KEY) || "[]");
            return Array.isArray(value) ? value : [];
        } catch (_) {
            return [];
        }
    }

    function writeLocalAccounts(accounts) {
        localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
    }

    function createLocalToken() {
        return `local-${state.portal}-${window.crypto?.randomUUID?.() || Date.now()}`;
    }

    async function authenticateLocally() {
        const payload = createPayload();
        const accounts = readLocalAccounts();
        const email = payload.email;
        const existing = accounts.find(account =>
            account.portal === state.portal && account.email === email
        );

        if (state.mode === "signup") {
            if (existing) {
                throw new Error("An account with this email already exists in this browser.");
            }

            const account = {
                id: `local-${state.portal}-${Date.now()}`,
                portal: state.portal,
                email,
                passwordHash: await hashPassword(payload.password),
                firstName: payload.firstName,
                lastName: payload.lastName,
                companyName: payload.companyName || "",
                invitationCode: payload.invitationCode || "",
                createdAt: new Date().toISOString()
            };

            accounts.push(account);
            writeLocalAccounts(accounts);

            return {
                data: {
                    accessToken: createLocalToken(),
                    user: { ...account, passwordHash: undefined }
                }
            };
        }

        if (!existing || existing.passwordHash !== await hashPassword(payload.password)) {
            throw new Error("No matching local account was found. Create an account first or connect the backend API.");
        }

        return {
            data: {
                accessToken: createLocalToken(),
                user: { ...existing, passwordHash: undefined }
            }
        };
    }


    /* ======================================================
       13. SESSION MANAGEMENT
    ====================================================== */

    function saveSession(data) {

        const accessToken = data?.accessToken || data?.access_token;

        if (!accessToken) {

            throw new Error(
                "The authentication service did not return a valid session."
            );

        }

        const tokenKey =
            state.portal === "employee"

                ? "talvora_employee_access_token"

                : "talvora_employer_access_token";


        const otherTokenKey =
            state.portal === "employee"

                ? "talvora_employer_access_token"

                : "talvora_employee_access_token";


        /* Keep the two portal sessions separate. */

        sessionStorage.removeItem(otherTokenKey);

        sessionStorage.setItem(
            tokenKey,
            accessToken
        );


        if (data.user) {

            sessionStorage.setItem(
                "talvora_" + state.portal + "_user",
                JSON.stringify(data.user)
            );

        }

    }


    /* ======================================================
       14. FORM SUBMISSION
    ====================================================== */

    async function submitAuthentication(event) {

        event.preventDefault();

        if (state.loading) return;

        clearMessage();

        if (!validateForm()) return;


        state.loading = true;

        const originalButtonText =
            elements.submit.textContent;

        elements.submit.disabled = true;

        elements.submit.textContent =
            state.mode === "login"

                ? "Verifying your account..."

                : "Creating your account...";


        try {
            let result;

            if (CONFIG.frontendOnly) {
                result = await authenticateLocally();
            } else {
                const response = await fetch(getEndpoint(), {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    credentials: "same-origin",
                    body: JSON.stringify(createPayload())
                });

                result = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(
                        result.message ||
                        "Unable to complete your request. Please try again."
                    );
                }
            }


            const data =
                result.data || result.session || result;


            /* ------------------------------------------
               REGISTRATION RESPONSE
            ------------------------------------------ */

            if (state.mode === "signup") {

                /*
                   If registration returns a token,
                   automatically open the correct workspace.
                */

                if (data.accessToken) {

                    saveSession(data);

                    showMessage(
                        "Account created successfully. Opening your workspace...",
                        "success"
                    );

                    window.location.assign(
                        DASHBOARDS[state.portal]
                    );

                    return;

                }


                /*
                   Some registrations may require
                   email or organization verification.
                */

                showMessage(

                    result.message ||

                    "Your registration has been received. Follow the verification instructions to activate your account.",

                    "success"

                );

                form.reset();

                return;

            }


            /* ------------------------------------------
               LOGIN RESPONSE
            ------------------------------------------ */

            saveSession(data);

            showMessage(
                "Authentication successful. Opening your workspace...",
                "success"
            );

            window.location.assign(
                DASHBOARDS[state.portal]
            );


        } catch (error) {

            showMessage(
                error.message ||
                "Something went wrong. Please try again."
            );

        } finally {

            state.loading = false;

            elements.submit.disabled = false;

            elements.submit.textContent =
                originalButtonText;

        }

    }


    /* ======================================================
       15. EVENT LISTENERS
    ====================================================== */

    document.querySelectorAll("[data-portal]")
        .forEach(button => {

            button.addEventListener("click", () => {

                setPortal(button.dataset.portal);

            });

        });


    document.querySelectorAll("[data-mode]")
        .forEach(button => {

            button.addEventListener("click", () => {

                setMode(button.dataset.mode);

            });

        });


    elements.switchMode.addEventListener(
        "click",
        () => {

            setMode(
                state.mode === "login"
                    ? "signup"
                    : "login"
            );

        }
    );


    form.addEventListener(
        "submit",
        submitAuthentication
    );


    /* ======================================================
       16. INITIALIZATION
    ====================================================== */

    function initialize() {
        const requestedPortal =
            new URLSearchParams(window.location.search).get("portal");

        setPortal(
            ["employee", "employer"].includes(requestedPortal)
                ? requestedPortal
                : "employee"
        );

        setMode("login");

    }


    initialize();


})();
