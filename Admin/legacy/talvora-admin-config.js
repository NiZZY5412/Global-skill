/**
 * ============================================================================
 * TALVORA TECHNOLOGIES - GSES SYSTEM 001
 * GLOBAL SKILLS-TO-EMPLOYMENT SYSTEM
 * UNIFIED DATA GATEWAY, AUTHENTICATION & INTERCONNECT ENGINE
 *
 * File: talvora-admin-config.js (Root Mirror)
 * ============================================================================
 */

(() => {
    "use strict";

    // 1. Identity, authentication and CSRF values must come from the production API.

    const apiBaseUrl = String(window.TALVORA_API_BASE_URL || "").replace(/\/+$/, "");

    const config = {
        apiBaseUrl,
        timeout: 30000,
        refreshInterval: 30000,
        pageSize: 50,
        credentials: "include",
        user: null,
        csrfToken: null
    };

    window.TALVORA_ADMIN_CONFIG = Object.freeze(config);
    window.TALVORA_CONFIG = window.TALVORA_CONFIG || Object.freeze(config);
    window.TALVORA_SESSION = null;
    // 2. Production API data is loaded at runtime. No seed or mock records are defined here.

    // 3. The fetch gateway below only forwards requests to the configured production API.

    // 4. Hook Window.Fetch to intercept API requests
    if (!window.__TALVORA_GATEWAY_INSTALLED__) {
        const nativeFetch = window.fetch.bind(window);

        window.fetch = async (input, init = {}) => {
            const urlString = typeof input === "string" ? input : (input?.url || "");
            if (!urlString.includes("/api/") || !apiBaseUrl) return nativeFetch(input, init);
            const urlObj = new URL(urlString, window.location.origin);
            return nativeFetch(`${apiBaseUrl}${urlObj.pathname}${urlObj.search}`, init);
        };

        window.__TALVORA_GATEWAY_INSTALLED__ = true;
    }

})();
