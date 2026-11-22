/* Shared production authentication and API configuration. */
const TALVORA_API_ORIGIN = "http://localhost:8000";
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
