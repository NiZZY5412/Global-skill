/* Shared production authentication and API configuration. */
// Local development uses the separate FastAPI process. On Vercel the
// frontend and the Python Function share one origin, so relative /api URLs
// are required; localhost would point at the visitor's own computer.
const TALVORA_API_ORIGIN = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
    ? "http://localhost:8000"
    : "";
window.TALVORA_API_BASE_URL = TALVORA_API_ORIGIN;
window.TALVORA_CONFIG = Object.freeze({ apiBaseUrl: TALVORA_API_ORIGIN });
window.TALVORA_EMPLOYEE_CONFIG = Object.freeze({ apiBaseUrl: `${TALVORA_API_ORIGIN}/api/employee` });
window.TALVORA_APP_CONFIG = Object.freeze({
    apiOrigin: TALVORA_API_ORIGIN,
    authApiBase: "/api/auth",
    frontendOnly: false,
    employeeDashboardUrl: "../Employee/employee-dashboard.html",
    employerDashboardUrl: "../Employer/employer-dashboard.html"
});
