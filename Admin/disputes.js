
(() => {
    'use strict';

    /* =====================================================
       TALVORA GLOBAL DISPUTE RESOLUTION CENTRE
       Central API integration and interface controller
    ===================================================== */

    const config = window.TALVORA_DISPUTES_CONFIG || {};

    const API_BASE = (config.apiBaseUrl || '/api/super-admin')
        .replace(/\/+$/, '');

    const ENDPOINTS = {
        dashboard: `${API_BASE}/disputes/dashboard`,
        cases: `${API_BASE}/disputes`,
        categories: `${API_BASE}/disputes/categories`,
        countries: `${API_BASE}/reference/countries`,
        admins: `${API_BASE}/administrators?scope=disputes`,
        assignments: `${API_BASE}/disputes/assignments`,
        caseAssignment: `${API_BASE}/disputes/:id/assignment`,
        autoAssign: `${API_BASE}/disputes/assignments/auto`,
        investigations: `${API_BASE}/disputes/investigations`,
        mediations: `${API_BASE}/disputes/mediations`,
        appeals: `${API_BASE}/disputes/appeals`,
        evidence: `${API_BASE}/disputes/evidence`,
        decisions: `${API_BASE}/disputes/decisions`,
        notifications: `${API_BASE}/disputes/notifications`,
        audit: `${API_BASE}/disputes/audit`,
        reports: `${API_BASE}/disputes/reports`,
        settings: `${API_BASE}/disputes/assignment-settings`,

        decisionReview: `${API_BASE}/disputes/decisions/:id/review`,
        appealReview: `${API_BASE}/disputes/appeals/:id/review`,
        evidenceReview: `${API_BASE}/disputes/evidence/:id/review`,
        notificationAcknowledge:
            `${API_BASE}/disputes/notifications/:id/acknowledge`,

        ...config.endpoints
    };


    /* =====================================================
       CATEGORY TAXONOMY
    ===================================================== */

    const CATEGORIES = [
        ['employment', 'Employment Disputes'],
        ['employer_employee', 'Employer–Employee Disputes'],
        ['recruitment', 'Recruitment & Placement'],
        ['financial', 'Financial & Payment Disputes'],
        ['identity', 'Identity & Verification'],
        ['account', 'Account Restrictions & Appeals'],
        ['conduct', 'Conduct & Misconduct'],
        ['compliance', 'Compliance & Regulatory'],
        ['privacy', 'Privacy & Data Protection'],
        ['fraud', 'Fraud & Forgery'],
        ['cross_border', 'Cross-Border Disputes'],
        ['platform', 'Platform Complaints'],
        ['workplace_harassment', 'Workplace Harassment'],
        ['discrimination', 'Discrimination & Unfair Treatment'],
        ['contract_violation', 'Employment Contract Violations'],
        ['salary_benefits', 'Salary & Benefits'],
        ['agency_misconduct', 'Recruitment Agency Misconduct'],
        ['data_privacy', 'Personal Data Complaints'],
        ['impersonation', 'Impersonation & Identity Fraud'],
        ['document_authenticity', 'Document Authenticity'],
        ['unfair_treatment', 'Unfair Treatment'],
        ['cross_border_employment', 'International Employment'],
        ['regulatory_complaint', 'Regulatory Complaints'],
        ['administrative_appeal', 'Administrative Decision Appeals'],
        ['other', 'Other Global Disputes']
    ].map(([value, label]) => ({ value, label }));


    /* =====================================================
       APPLICATION STATE
    ===================================================== */

    const state = {
        activeView: 'overview',

        dashboard: null,
        cases: [],
        admins: [],
        countries: [],
        investigations: [],
        mediations: [],
        appeals: [],
        evidence: [],
        decisions: [],
        notifications: [],
        audit: [],
        reports: [],
        assignments: {},
        settings: {},

        activeCase: null,
        activeCritical: null,

        globalFilters: {},
        notificationDrawerOpen: false,

        seenCriticalAlerts: new Set(),
        loading: new Set()
    };


    /* =====================================================
       DOM HELPERS
    ===================================================== */

    const $ = id => document.getElementById(id);

    const all = selector =>
        [...document.querySelectorAll(selector)];

    function setText(id, value) {
        const element = $(id);
        if (element) {
            element.textContent =
                value === undefined || value === null || value === ''
                    ? '—'
                    : String(value);
        }
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        })[character]);
    }

    function safeId(value) {
        return encodeURIComponent(String(value ?? ''));
    }

    function unwrap(response) {
        if (!response || typeof response !== 'object') {
            return response;
        }

        return response.data !== undefined
            ? response.data
            : response.result !== undefined
                ? response.result
                : response;
    }

    function asList(response) {
        const data = unwrap(response);

        if (Array.isArray(data)) return data;

        if (Array.isArray(data?.items)) return data.items;
        if (Array.isArray(data?.results)) return data.results;
        if (Array.isArray(data?.records)) return data.records;

        return [];
    }

    function firstValue(object, keys, fallback = undefined) {
        for (const key of keys) {
            if (object?.[key] !== undefined &&
                object?.[key] !== null) {
                return object[key];
            }
        }

        return fallback;
    }

    function formatDate(value) {
        if (!value) return '—';

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return new Intl.DateTimeFormat(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(date);
    }

    function formatDateTime(value) {
        if (!value) return '—';

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return new Intl.DateTimeFormat(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    function formatStatus(value) {
        if (!value) return 'Unknown';

        return String(value)
            .replace(/[_-]/g, ' ')
            .replace(/\b\w/g, letter => letter.toUpperCase());
    }

    function statusClass(value) {
        return String(value || 'unknown')
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_');
    }

    function statusBadge(value) {
        return `
            <span class="td-status ${statusClass(value)}">
                ${escapeHTML(formatStatus(value))}
            </span>
        `;
    }

    function severityBadge(value) {
        return `
            <span class="td-severity ${statusClass(value)}">
                ${escapeHTML(formatStatus(value))}
            </span>
        `;
    }

    function actionButton(action, id, label = 'View') {
        return `
            <button
                type="button"
                class="td-row-action"
                data-action="${escapeHTML(action)}"
                data-id="${escapeHTML(id)}">
                ${escapeHTML(label)}
            </button>
        `;
    }

    function renderEmpty(id, columns, message = 'No records available.') {
        const body = $(id);

        if (!body) return;

        body.innerHTML = `
            <tr>
                <td colspan="${columns}" class="td-table-empty">
                    ${escapeHTML(message)}
                </td>
            </tr>
        `;
    }


    /* =====================================================
       NOTIFICATIONS AND FEEDBACK
    ===================================================== */

    function toast(message, type = 'success') {
        const region = $('td-toast-region');

        if (!region) return;

        const element = document.createElement('div');

        element.className = `td-toast ${type}`;
        element.textContent = message;
        element.setAttribute('role', 'status');

        region.appendChild(element);

        window.setTimeout(() => {
            element.remove();
        }, 4500);
    }

    function setNotice(message, type = 'info') {
        const notice = $('td-system-notice');

        if (!notice) return;

        const colors = {
            info: ['#f5f2ff', '#6354a4', '#e6e1ff'],
            success: ['#eaf8f2', '#18805f', '#ccefe0'],
            warning: ['#fff8e9', '#947023', '#f2e4bd'],
            error: ['#fff0f2', '#b43e50', '#f4cbd1']
        };

        const [background, color, border] =
            colors[type] || colors.info;

        notice.style.background = background;
        notice.style.color = color;
        notice.style.borderColor = border;

        setText('td-system-notice-text', message);
    }

    function updateLastUpdated() {
        const now = new Date();

        setText(
            'td-last-updated',
            `Last updated: ${now.toLocaleTimeString()}`
        );
    }


    /* =====================================================
       CENTRAL API SERVICE
    ===================================================== */

    function buildPath(key, id = null) {
        let path = ENDPOINTS[key];

        if (!path) {
            throw new Error(`API endpoint not configured: ${key}`);
        }

        if (id !== null) {
            path = path.replace(':id', safeId(id));
        }

        return path;
    }

    function appendQuery(path, query = {}) {
        const params = new URLSearchParams();

        Object.entries(query).forEach(([key, value]) => {
            if (
                value === undefined ||
                value === null ||
                value === ''
            ) return;

            if (Array.isArray(value)) {
                value.forEach(item => params.append(key, item));
            } else {
                params.append(key, value);
            }
        });

        const queryString = params.toString();

        if (!queryString) return path;

        return `${path}${path.includes('?') ? '&' : '?'}${queryString}`;
    }

    async function request(path, options = {}) {
        const method = options.method || 'GET';

        const headers = {
            Accept: 'application/json',
            ...config.headers
        };

        if (options.body !== undefined) {
            headers['Content-Type'] = 'application/json';
        }

        if (typeof config.getAccessToken === 'function') {
            const token = await config.getAccessToken();

            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }
        }

        const csrfToken = document.querySelector(
            'meta[name="csrf-token"]'
        )?.content;

        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }

        Object.assign(headers, options.headers || {});

        const response = await fetch(
            appendQuery(path, options.query),
            {
                method,
                headers,
                credentials: 'include',
                signal: options.signal,
                body: options.body === undefined
                    ? undefined
                    : JSON.stringify(options.body)
            }
        );

        let result = null;

        if (response.status !== 204) {
            const contentType =
                response.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
                result = await response.json();
            } else {
                result = await response.text();
            }
        }

        if (!response.ok) {
            const message =
                result?.message ||
                result?.error ||
                `Request failed (${response.status})`;

            const error = new Error(message);
            error.status = response.status;
            error.response = result;

            if (response.status === 401) {
                window.dispatchEvent(
                    new CustomEvent('talvora:authentication-required')
                );
            }

            if (response.status === 403) {
                window.dispatchEvent(
                    new CustomEvent('talvora:access-denied')
                );
            }

            throw error;
        }

        if (result && result.success === false) {
            throw new Error(
                result.message || 'The operation was not completed.'
            );
        }

        return result;
    }

    async function apiGet(key, query = {}, id = null) {
        return request(buildPath(key, id), {
            method: 'GET',
            query
        });
    }

    async function apiPost(key, body, id = null) {
        return request(buildPath(key, id), {
            method: 'POST',
            body
        });
    }

    async function apiUpdate(key, body) {
        return request(buildPath(key), {
            method: 'PUT',
            body
        });
    }

    function handleError(error, context = 'Operation') {
        console.error(`TALVORA ${context}:`, error);

        if (error.status === 401) {
            toast('Your session has expired. Please sign in again.', 'error');
            return;
        }

        if (error.status === 403) {
            toast('You are not authorized to perform this action.', 'error');
            return;
        }

        toast(
            error.message || `${context} could not be completed.`,
            'error'
        );
    }


    /* =====================================================
       SELECT INPUT POPULATION
    ===================================================== */

    function populateCategories() {
        [
            'td-intake-category',
            'td-case-category-filter'
        ].forEach(id => {
            const select = $(id);

            if (!select) return;

            const placeholder = id === 'td-intake-category'
                ? 'Select category'
                : 'All categories';

            select.innerHTML = `
                <option value="">${placeholder}</option>
                ${CATEGORIES.map(category => `
                    <option value="${escapeHTML(category.value)}">
                        ${escapeHTML(category.label)}
                    </option>
                `).join('')}
            `;
        });
    }

    async function loadCountries() {
        try {
            const response = await apiGet('countries');

            state.countries = asList(response);

            const options = state.countries.map(country => {
                const value = typeof country === 'string'
                    ? country
                    : firstValue(country, ['code', 'isoCode', 'id', 'name']);

                const label = typeof country === 'string'
                    ? country
                    : firstValue(country, ['name', 'label'], value);

                return { value, label };
            }).filter(item => item.value);

            ['td-country-filter', 'td-intake-country'].forEach(id => {
                const select = $(id);

                if (!select) return;

                const placeholder = id === 'td-country-filter'
                    ? 'All countries'
                    : 'Select country';

                select.innerHTML = `
                    <option value="">${placeholder}</option>
                    ${options.map(item => `
                        <option value="${escapeHTML(item.value)}">
                            ${escapeHTML(item.label)}
                        </option>
                    `).join('')}
                `;
            });

        } catch (error) {
            console.warn('Country reference service unavailable:', error);
        }
    }

    async function loadAdmins() {
        try {
            const response = await apiGet('admins');

            const data = unwrap(response);

            state.admins = asList(response);

            if (!state.admins.length && Array.isArray(data?.administrators)) {
                state.admins = data.administrators;
            }

            const selects = [
                'td-assignment-admin',
                'td-investigation-admin',
                'td-mediation-admin'
            ];

            selects.forEach(id => {
                const select = $(id);

                if (!select) return;

                select.innerHTML = `
                    <option value="">Select administrator</option>
                    ${state.admins.map(admin => {
                    const idValue = firstValue(admin, ['id', 'adminId']);
                    const name = firstValue(
                        admin,
                        ['name', 'fullName', 'displayName'],
                        'Administrator'
                    );

                    return `
                            <option value="${escapeHTML(idValue)}">
                                ${escapeHTML(name)}
                            </option>
                        `;
                }).join('')}
                `;
            });

        } catch (error) {
            console.warn('Administrator service unavailable:', error);
        }
    }


    /* =====================================================
       GLOBAL FILTERS
    ===================================================== */

    function getGlobalFilters() {
        return {
            from: $('td-date-from')?.value,
            to: $('td-date-to')?.value,
            country: $('td-country-filter')?.value,
            severity: $('td-severity-filter')?.value
        };
    }

    function applyGlobalFilters() {
        state.globalFilters = getGlobalFilters();

        loadView(state.activeView);
        toast('Filters applied.', 'success');
    }

    function clearGlobalFilters() {
        [
            'td-date-from',
            'td-date-to',
            'td-country-filter',
            'td-severity-filter',
            'td-case-search',
            'td-case-status-filter',
            'td-case-category-filter',
            'td-case-priority-filter'
        ].forEach(id => {
            const element = $(id);

            if (element) element.value = '';
        });

        state.globalFilters = {};

        loadView(state.activeView);
    }


    /* =====================================================
       DASHBOARD
    ===================================================== */

    function setKpi(id, value) {
        setText(
            id,
            value === undefined || value === null
                ? '—'
                : Number(value).toLocaleString()
        );
    }

    function renderBars(containerId, rows, color = '') {
        const container = $(containerId);

        if (!container) return;

        if (!Array.isArray(rows) || !rows.length) {
            container.innerHTML = `
                <div class="td-empty-chart">
                    No analytics data available.
                </div>
            `;
            return;
        }

        const max = Math.max(
            1,
            ...rows.map(item => Number(item.value ?? item.count ?? 0))
        );

        container.innerHTML = `
            <div class="td-chart-bars">
                ${rows.map(item => {
            const value = Number(item.value ?? item.count ?? 0);
            const percentage = Math.max(
                0,
                Math.min(100, (value / max) * 100)
            );

            return `
                        <div class="td-chart-bar-row">
                            <span class="td-chart-bar-label">
                                ${escapeHTML(item.label || item.name || 'Other')}
                            </span>

                            <div class="td-bar-track">
                                <div class="td-bar-fill ${color}"
                                     style="width:${percentage}%"></div>
                            </div>

                            <span class="td-chart-value">
                                ${value.toLocaleString()}
                            </span>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    }

    function renderDashboard(data) {
        if (!data) return;

        state.dashboard = data;

        const metrics = data.kpis || data.metrics || data;

        setKpi('td-kpi-total', firstValue(metrics, [
            'totalCases', 'totalDisputes', 'total'
        ]));

        setKpi('td-kpi-open', firstValue(metrics, [
            'openCases', 'openDisputes', 'open'
        ]));

        setKpi('td-kpi-critical', firstValue(metrics, [
            'criticalCases', 'criticalDisputes', 'critical'
        ]));

        setKpi('td-kpi-overdue', firstValue(metrics, [
            'overdueCases', 'overdueDisputes', 'overdue'
        ]));

        setKpi('td-kpi-appeals', firstValue(metrics, [
            'pendingAppeals', 'appealsPending'
        ]));

        setKpi('td-kpi-decisions', firstValue(metrics, [
            'pendingDecisions', 'awaitingDecisions'
        ]));

        setKpi('td-kpi-investigations', firstValue(metrics, [
            'activeInvestigations', 'investigationsActive'
        ]));

        setKpi('td-kpi-resolved', firstValue(metrics, [
            'resolvedCases', 'resolvedDisputes', 'resolved'
        ]));

        setText(
            'td-case-count',
            firstValue(metrics, ['totalCases', 'totalDisputes'], '—')
        );

        setText(
            'td-appeal-count',
            firstValue(metrics, ['pendingAppeals'], '—')
        );

        renderBars(
            'td-dispute-trend',
            data.trends || data.disputeTrends || []
        );

        const severity = data.severityBreakdown || data.severity || [];

        renderBars(
            'td-severity-chart',
            Array.isArray(severity)
                ? severity
                : Object.entries(severity).map(([label, value]) => ({
                    label: formatStatus(label),
                    value
                })),
            'red'
        );

        renderBars(
            'td-country-chart',
            data.countryBreakdown || data.countryActivity || []
        );

        renderCategoryCounts(
            data.categoryBreakdown || data.categories || []
        );

        updateLastUpdated();
    }

    function renderCategoryCounts(data) {
        const categories = {
            employment: 'td-cat-employment',
            employer_employee: 'td-cat-employer-employee',
            recruitment: 'td-cat-recruitment',
            financial: 'td-cat-financial',
            identity: 'td-cat-identity',
            account: 'td-cat-account',
            conduct: 'td-cat-conduct',
            compliance: 'td-cat-compliance',
            privacy: 'td-cat-privacy',
            fraud: 'td-cat-fraud',
            cross_border: 'td-cat-cross-border',
            platform: 'td-cat-platform'
        };

        const counts = Array.isArray(data)
            ? Object.fromEntries(data.map(item => [
                item.category || item.key,
                item.count ?? item.value ?? 0
            ]))
            : data;

        Object.entries(categories).forEach(([key, elementId]) => {
            const value = counts?.[key];

            setText(
                elementId,
                value === undefined ? '— cases' : `${value} cases`
            );
        });
    }

    async function loadOverview() {
        const results = await Promise.allSettled([
            apiGet('dashboard'),
            apiGet('cases', {
                ...state.globalFilters,
                limit: 8,
                sort: 'createdAt:desc'
            })
        ]);

        const dashboardResult = results[0];
        const casesResult = results[1];

        if (dashboardResult.status === 'fulfilled') {
            renderDashboard(unwrap(dashboardResult.value));
        }

        if (casesResult.status === 'fulfilled') {
            const data = unwrap(casesResult.value);
            const cases = asList(casesResult.value);

            state.cases = cases;

            renderRecentCases(cases);

            if (data?.pagination?.total !== undefined) {
                setText(
                    'td-case-count',
                    Number(data.pagination.total).toLocaleString()
                );
            }
        }

        if (
            dashboardResult.status === 'rejected' &&
            casesResult.status === 'rejected'
        ) {
            setNotice(
                'Unable to load dispute data. Check the API connection and administrator session.',
                'error'
            );

            renderRecentCases([]);
        }
    }


    /* =====================================================
       CASE MANAGEMENT
    ===================================================== */

    function getCaseCategoryLabel(value) {
        return CATEGORIES.find(item => item.value === value)?.label ||
            formatStatus(value);
    }

    function renderRecentCases(cases) {
        const body = $('td-recent-cases');

        if (!body) return;

        if (!cases.length) {
            renderEmpty('td-recent-cases', 8, 'No recent disputes available.');
            return;
        }

        body.innerHTML = cases.map(item => `
            <tr>
                <td class="td-table-reference">
                    ${escapeHTML(item.reference || item.caseReference || item.id)}
                </td>

                <td class="td-table-primary">
                    ${escapeHTML(item.title)}
                </td>

                <td>${escapeHTML(getCaseCategoryLabel(item.category))}</td>
                <td>${escapeHTML(item.country || '—')}</td>
                <td>${severityBadge(item.severity)}</td>
                <td>${statusBadge(item.status)}</td>
                <td>${formatDate(item.createdAt || item.submittedAt)}</td>

                <td>
                    ${actionButton('view-case', item.id)}
                </td>
            </tr>
        `).join('');
    }

    function getCaseQuery() {
        return {
            ...state.globalFilters,
            search: $('td-case-search')?.value,
            status: $('td-case-status-filter')?.value,
            category: $('td-case-category-filter')?.value,
            priority: $('td-case-priority-filter')?.value
        };
    }

    function renderCasesTable(cases) {
        const body = $('td-cases-table');

        if (!body) return;

        if (!cases.length) {
            renderEmpty('td-cases-table', 10, 'No matching dispute records.');
            return;
        }

        body.innerHTML = cases.map(item => `
            <tr>
                <td class="td-table-reference">
                    ${escapeHTML(item.reference || item.caseReference || item.id)}
                </td>

                <td class="td-table-primary">
                    ${escapeHTML(item.title)}
                </td>

                <td>
                    ${escapeHTML(item.complainantName || item.complainantReference || '—')}
                </td>

                <td>
                    ${escapeHTML(item.respondentName || item.respondentReference || '—')}
                </td>

                <td>${escapeHTML(item.country || '—')}</td>

                <td>${escapeHTML(getCaseCategoryLabel(item.category))}</td>

                <td>${severityBadge(item.severity)}</td>

                <td>
                    ${escapeHTML(item.assignedAdminName || item.assignedAdministrator?.name || 'Unassigned')}
                </td>

                <td>${statusBadge(item.status)}</td>

                <td>${actionButton('view-case', item.id)}</td>
            </tr>
        `).join('');

        setText('td-case-count', cases.length);
    }

    async function loadCases() {
        const response = await apiGet('cases', getCaseQuery());

        const data = unwrap(response);
        state.cases = asList(response);

        renderCasesTable(state.cases);

        if (data?.pagination?.total !== undefined) {
            setText(
                'td-case-count',
                Number(data.pagination.total).toLocaleString()
            );
        }

        updateLastUpdated();
    }

    async function showCaseDetails(id) {
        let item = state.cases.find(
            record => String(record.id) === String(id)
        );

        if (!item) {
            const response = await request(
                `${buildPath('cases')}/${safeId(id)}`
            );

            item = unwrap(response);
        }

        if (!item) {
            toast('Dispute record could not be found.', 'error');
            return;
        }

        state.activeCase = item;

        setText(
            'td-case-modal-reference',
            item.reference || item.caseReference || item.id
        );

        setText('td-detail-title', item.title);
        setText('td-detail-category', getCaseCategoryLabel(item.category));
        setText('td-detail-country', item.country);
        setText('td-detail-jurisdiction', item.jurisdiction);

        setText(
            'td-detail-complainant',
            item.complainantName || item.complainantReference
        );

        setText(
            'td-detail-respondent',
            item.respondentName || item.respondentReference
        );

        setText('td-detail-severity', formatStatus(item.severity));

        setText(
            'td-detail-admin',
            item.assignedAdminName || item.assignedAdministrator?.name || 'Unassigned'
        );

        setText('td-detail-status', formatStatus(item.status));
        setText('td-detail-deadline', formatDate(item.deadline));
        setText('td-detail-description', item.description);
        setText('td-detail-outcome', item.requestedOutcome);

        openModal('td-case-modal');
    }


    /* =====================================================
       CASE ASSIGNMENT
    ===================================================== */

    function renderAdminWorkload(admins) {
        const body = $('td-admin-workload');

        if (!body) return;

        if (!admins.length) {
            renderEmpty('td-admin-workload', 6, 'Administrator records unavailable.');
            return;
        }

        body.innerHTML = admins.map(admin => {
            const assigned = Number(admin.assignedCases ?? admin.totalAssigned ?? 0);
            const active = Number(admin.activeCases ?? 0);
            const overdue = Number(admin.overdueCases ?? 0);
            const workload = Number(admin.workloadPercentage ?? 0);

            return `
                <tr>
                    <td class="td-table-primary">
                        ${escapeHTML(admin.name || admin.fullName || admin.id)}
                    </td>

                    <td>${assigned}</td>
                    <td>${active}</td>
                    <td>${overdue}</td>

                    <td>
                        <div class="td-bar-track" style="min-width:90px">
                            <div class="td-bar-fill"
                                 style="width:${Math.max(0, Math.min(100, workload))}%">
                            </div>
                        </div>
                        ${workload}%
                    </td>

                    <td>${statusBadge(admin.status || 'active')}</td>
                </tr>
            `;
        }).join('');
    }

    function renderUnassigned(cases) {
        const body = $('td-unassigned-table');

        if (!body) return;

        if (!cases.length) {
            renderEmpty('td-unassigned-table', 7, 'No unassigned disputes.');
            return;
        }

        body.innerHTML = cases.map(item => `
            <tr>
                <td class="td-table-reference">
                    ${escapeHTML(item.reference || item.id)}
                </td>

                <td class="td-table-primary">${escapeHTML(item.title)}</td>
                <td>${escapeHTML(getCaseCategoryLabel(item.category))}</td>
                <td>${severityBadge(item.severity)}</td>
                <td>${escapeHTML(item.country || '—')}</td>
                <td>${formatDate(item.createdAt)}</td>

                <td>
                    ${actionButton('assign-case', item.id, 'Assign')}
                </td>
            </tr>
        `).join('');
    }

    async function loadAssignments() {
        const [assignmentResult, casesResult] = await Promise.allSettled([
            apiGet('assignments'),
            apiGet('cases', { status: 'unassigned' })
        ]);

        if (assignmentResult.status === 'fulfilled') {
            state.assignments = unwrap(assignmentResult.value) || {};

            const data = state.assignments;

            const admins = data.administrators || data.admins || state.admins;
            const unassigned = data.unassignedCases || [];

            renderAdminWorkload(admins);
            renderUnassigned(unassigned);

            setKpi('td-assignment-unassigned', data.unassignedCount);
            setKpi('td-assignment-assigned', data.assignedCount);
            setKpi('td-assignment-overloaded', data.overloadedCount);
            setKpi(
                'td-assignment-admins',
                data.activeAdministratorCount ?? admins.length
            );
        } else if (casesResult.status === 'fulfilled') {
            renderUnassigned(asList(casesResult.value));
        }

        if (assignmentResult.status === 'rejected' &&
            casesResult.status === 'rejected') {
            throw assignmentResult.reason;
        }
    }

    function openAssignmentModal(caseId) {
        if (!caseId) {
            toast('Select a case before assigning an administrator.', 'warning');
            return;
        }

        if (!state.admins.length) {
            toast('Administrator records are not available.', 'error');
            return;
        }

        $('td-assignment-case-id').value = caseId;

        openModal('td-assignment-modal');
    }

    async function submitAssignment(event) {
        event.preventDefault();

        const caseId = $('td-assignment-case-id').value;

        const body = {
            administratorId: $('td-assignment-admin').value,
            reason: $('td-assignment-reason').value.trim()
        };

        if (!body.administratorId || !body.reason) {
            toast('Complete all assignment fields.', 'warning');
            return;
        }

        await apiPost('caseAssignment', body, caseId);

        closeModal('td-assignment-modal');
        $('td-assignment-form').reset();

        toast('Case assignment submitted successfully.');
        await loadAssignments();
        await loadOverview();
    }

    async function autoAssign() {
        if (!window.confirm(
            'Proceed with automatic assignment of eligible unassigned cases?'
        )) return;

        await apiPost('autoAssign', {
            mode: 'hybrid',
            respectWorkload: true,
            respectCountryAndCategory: true
        });

        toast('Automatic assignment request completed.');
        await loadAssignments();
        await loadOverview();
    }


    /* =====================================================
       INVESTIGATIONS
    ===================================================== */

    function renderInvestigations(records) {
        const body = $('td-investigations-table');

        if (!body) return;

        if (!records.length) {
            renderEmpty('td-investigations-table', 9);
            return;
        }

        body.innerHTML = records.map(item => `
            <tr>
                <td class="td-table-reference">
                    ${escapeHTML(item.id)}
                </td>

                <td>${escapeHTML(item.caseReference || item.caseId)}</td>
                <td>${escapeHTML(item.investigatorName || '—')}</td>
                <td>${escapeHTML(item.country || '—')}</td>
                <td>${severityBadge(item.severity)}</td>
                <td>${formatDate(item.startDate)}</td>
                <td>${formatDate(item.deadline)}</td>
                <td>${statusBadge(item.status)}</td>
                <td>${actionButton('view-investigation', item.id)}</td>
            </tr>
        `).join('');
    }

    async function loadInvestigations() {
        const response = await apiGet('investigations', {
            status: $('td-investigation-status-filter')?.value,
            ...state.globalFilters
        });

        state.investigations = asList(response);

        renderInvestigations(state.investigations);

        const summary = unwrap(response)?.summary || {};

        setKpi('td-invest-active', summary.active);
        setKpi('td-invest-evidence', summary.awaitingEvidence);
        setKpi('td-invest-escalated', summary.escalated);
        setKpi('td-invest-completed', summary.completed);
    }

    async function submitInvestigation(event) {
        event.preventDefault();

        const body = {
            caseId: $('td-investigation-case').value,
            investigatorId: $('td-investigation-admin').value,
            scope: $('td-investigation-scope').value.trim(),
            deadline: $('td-investigation-deadline').value
        };

        await apiPost('investigations', body);

        closeModal('td-investigation-modal');
        $('td-investigation-form').reset();

        toast('Investigation created successfully.');
        await loadInvestigations();
        await loadCases();
    }


    /* =====================================================
       MEDIATION
    ===================================================== */

    function renderMediations(records) {
        const body = $('td-mediation-table');

        if (!body) return;

        if (!records.length) {
            renderEmpty('td-mediation-table', 9);
            return;
        }

        body.innerHTML = records.map(item => `
            <tr>
                <td class="td-table-reference">${escapeHTML(item.id)}</td>
                <td>${escapeHTML(item.caseReference || item.caseId)}</td>
                <td>${escapeHTML(item.parties || '—')}</td>
                <td>${escapeHTML(item.mediatorName || '—')}</td>
                <td>${escapeHTML(item.country || '—')}</td>
                <td>${formatDateTime(item.scheduledAt)}</td>
                <td>${escapeHTML(item.outcome || 'Pending')}</td>
                <td>${statusBadge(item.status)}</td>
                <td>${actionButton('view-mediation', item.id)}</td>
            </tr>
        `).join('');
    }

    async function loadMediations() {
        const response = await apiGet('mediations', state.globalFilters);

        state.mediations = asList(response);
        renderMediations(state.mediations);
    }

    async function submitMediation(event) {
        event.preventDefault();

        const body = {
            caseId: $('td-mediation-case').value,
            mediatorId: $('td-mediation-admin').value,
            scheduledAt: $('td-mediation-date').value,
            notes: $('td-mediation-notes').value.trim()
        };

        await apiPost('mediations', body);

        closeModal('td-mediation-modal');
        $('td-mediation-form').reset();

        toast('Mediation session scheduled.');
        await loadMediations();
    }


    /* =====================================================
       APPEALS
    ===================================================== */

    function renderAppeals(records) {
        const body = $('td-appeals-table');

        if (!body) return;

        if (!records.length) {
            renderEmpty('td-appeals-table', 9);
            return;
        }

        body.innerHTML = records.map(item => `
            <tr>
                <td class="td-table-reference">
                    ${escapeHTML(item.reference || item.id)}
                </td>

                <td>${escapeHTML(item.caseReference || item.caseId)}</td>
                <td>${escapeHTML(item.appellantName || item.appellantReference)}</td>
                <td>${escapeHTML(item.contestedDecision || '—')}</td>
                <td>${escapeHTML(item.country || '—')}</td>
                <td>${formatDate(item.submittedAt)}</td>
                <td>${formatDate(item.reviewDeadline)}</td>
                <td>${statusBadge(item.status)}</td>

                <td>
                    ${actionButton('review-appeal', item.id, 'Review')}
                </td>
            </tr>
        `).join('');
    }

    async function loadAppeals() {
        const response = await apiGet('appeals', {
            status: $('td-appeal-status-filter')?.value,
            ...state.globalFilters
        });

        state.appeals = asList(response);

        renderAppeals(state.appeals);

        const summary = unwrap(response)?.summary || {};

        setKpi('td-appeal-total', summary.total);
        setKpi('td-appeal-pending', summary.pending);
        setKpi('td-appeal-review', summary.underReview);
        setKpi('td-appeal-decided', summary.decided);

        setText('td-appeal-count', summary.pending ?? '—');
    }

    function openAppealReview(id) {
        $('td-appeal-id').value = id;
        openModal('td-appeal-modal');
    }

    async function submitAppealReview(event) {
        event.preventDefault();

        const id = $('td-appeal-id').value;

        const body = {
            outcome: $('td-appeal-outcome').value,
            reasoning: $('td-appeal-reason').value.trim()
        };

        await apiPost('appealReview', body, id);

        closeModal('td-appeal-modal');
        $('td-appeal-form').reset();

        toast('Appeal review submitted.');
        await loadAppeals();
        await loadDecisions();
    }


    /* =====================================================
       EVIDENCE AND DOCUMENTS
    ===================================================== */

    function renderEvidence(records) {
        const body = $('td-evidence-table');

        if (!body) return;

        if (!records.length) {
            renderEmpty('td-evidence-table', 8);
            return;
        }

        body.innerHTML = records.map(item => `
            <tr>
                <td class="td-table-reference">${escapeHTML(item.id)}</td>
                <td>${escapeHTML(item.caseReference || item.caseId)}</td>
                <td>${escapeHTML(item.documentType || item.type)}</td>
                <td>${escapeHTML(item.submitterName || item.submittedBy)}</td>
                <td>${escapeHTML(item.country || '—')}</td>
                <td>${formatDate(item.submittedAt)}</td>
                <td>${statusBadge(item.status)}</td>
                <td>${actionButton('review-evidence', item.id, 'Review')}</td>
            </tr>
        `).join('');
    }

    async function loadEvidence() {
        const response = await apiGet('evidence', {
            status: $('td-evidence-status-filter')?.value,
            ...state.globalFilters
        });

        state.evidence = asList(response);

        renderEvidence(state.evidence);

        const summary = unwrap(response)?.summary || {};

        setKpi('td-evidence-total', summary.total);
        setKpi('td-evidence-pending', summary.pending);
        setKpi('td-evidence-verified', summary.verified);
        setKpi('td-evidence-flagged', summary.flagged);
    }

    function openEvidenceReview(id) {
        const item = state.evidence.find(
            record => String(record.id) === String(id)
        );

        if (!item) {
            toast('Evidence record not found.', 'error');
            return;
        }

        setText('td-evidence-reference', item.id);
        setText('td-evidence-type', item.documentType || item.type);
        setText('td-evidence-submitter', item.submitterName || item.submittedBy);
        setText('td-evidence-case', item.caseReference || item.caseId);

        $('td-evidence-id').value = id;

        openModal('td-evidence-modal');
    }

    async function submitEvidenceReview(event) {
        event.preventDefault();

        const id = $('td-evidence-id').value;

        const body = {
            outcome: $('td-evidence-outcome').value,
            notes: $('td-evidence-notes').value.trim()
        };

        await apiPost('evidenceReview', body, id);

        closeModal('td-evidence-modal');
        $('td-evidence-form').reset();

        toast('Evidence review submitted.');
        await loadEvidence();
    }


    /* =====================================================
       ADMINISTRATIVE DECISIONS
    ===================================================== */

    function renderDecisions(records) {
        const body = $('td-decisions-table');

        if (!body) return;

        if (!records.length) {
            renderEmpty('td-decisions-table', 8);
            return;
        }

        body.innerHTML = records.map(item => `
            <tr>
                <td class="td-table-reference">${escapeHTML(item.id)}</td>
                <td>${escapeHTML(item.caseReference || item.caseId)}</td>
                <td>${escapeHTML(item.decisionType || '—')}</td>
                <td>${escapeHTML(item.recommendingAdminName || '—')}</td>
                <td>${escapeHTML(item.approvalLevel || 'Standard')}</td>
                <td>${formatDate(item.submittedAt)}</td>
                <td>${statusBadge(item.status)}</td>
                <td>${actionButton('review-decision', item.id, 'Review')}</td>
            </tr>
        `).join('');
    }

    async function loadDecisions() {
        const response = await apiGet('decisions', state.globalFilters);

        state.decisions = asList(response);

        renderDecisions(state.decisions);

        const summary = unwrap(response)?.summary || {};

        setKpi('td-decision-pending', summary.pending);
        setKpi('td-decision-approval', summary.awaitingApproval);
        setKpi('td-decision-approved', summary.approved);
        setKpi('td-decision-returned', summary.returned);
    }

    function openDecisionReview(id) {
        $('td-decision-id').value = id;
        openModal('td-decision-modal');
    }

    async function submitDecision(event) {
        event.preventDefault();

        const id = $('td-decision-id').value;

        const body = {
            outcome: $('td-decision-outcome').value,
            reasoning: $('td-decision-reason').value.trim()
        };

        await apiPost('decisionReview', body, id);

        closeModal('td-decision-modal');
        $('td-decision-form').reset();

        toast('Decision review submitted. Approval rules will be enforced by the server.');

        await loadDecisions();
        await loadCases();
    }


    /* =====================================================
       NOTIFICATIONS AND CRITICAL ALERTS
    ===================================================== */

    function renderNotifications(records) {
        const body = $('td-notifications-table');
        const list = $('td-notification-list');

        if (body) {
            body.innerHTML = records.length
                ? records.map(item => `
                    <tr>
                        <td class="td-table-reference">${escapeHTML(item.id)}</td>
                        <td>${escapeHTML(item.title || item.type)}</td>
                        <td>${escapeHTML(item.recipientName || item.recipient || '—')}</td>
                        <td>${escapeHTML(item.caseReference || item.caseId || '—')}</td>
                        <td>${escapeHTML(item.channel || '—')}</td>
                        <td>${formatDateTime(item.createdAt)}</td>
                        <td>${statusBadge(item.deliveryStatus || item.status)}</td>
                    </tr>
                `).join('')
                : `
                    <tr>
                        <td colspan="7" class="td-table-empty">
                            No notification records available.
                        </td>
                    </tr>
                `;
        }

        if (list) {
            list.innerHTML = records.length
                ? records.map(item => `
                    <div class="td-notification-item">
                        <span class="td-notification-indicator"></span>

                        <div>
                            <strong>${escapeHTML(item.title || formatStatus(item.type))}</strong>

                            <p>${escapeHTML(item.message || item.description || '')}</p>

                            <small>${formatDateTime(item.createdAt)}</small>

                            ${item.caseId ? actionButton(
                    'view-notification',
                    item.id,
                    'View related case'
                ) : ''}
                        </div>
                    </div>
                `).join('')
                : `
                    <div class="td-empty-state">
                        <strong>No notifications available</strong>
                        <span>New dispute events will appear here.</span>
                    </div>
                `;
        }

        const unread = records.filter(item =>
            item.readAt == null && item.acknowledged !== true
        ).length;

        setText('td-notification-badge', unread);

        const critical = records.filter(item =>
            String(item.severity).toLowerCase() === 'critical' &&
            !item.acknowledged &&
            !item.acknowledgedAt
        );

        setKpi('td-notify-pending', unread);
        setKpi('td-notify-critical', critical.length);

        const overdue = records.filter(item =>
            item.type === 'escalation' && item.status === 'overdue'
        ).length;

        const failed = records.filter(item =>
            ['failed', 'undelivered'].includes(
                String(item.deliveryStatus || item.status).toLowerCase()
            )
        ).length;

        setKpi('td-notify-overdue', overdue);
        setKpi('td-notify-failed', failed);

        checkCriticalAlerts(critical);
    }

    function checkCriticalAlerts(alerts) {
        const item = alerts.find(alert =>
            !state.seenCriticalAlerts.has(String(alert.id))
        );

        if (!item) return;

        state.seenCriticalAlerts.add(String(item.id));
        state.activeCritical = item;

        setText('td-critical-reference', item.caseReference || item.caseId);
        setText('td-critical-category', getCaseCategoryLabel(item.category));
        setText('td-critical-country', item.country);
        setText('td-critical-date', formatDateTime(item.createdAt));
        setText('td-critical-description', item.message || item.description);

        openModal('td-critical-modal');

        $('td-live-region').textContent =
            `Critical dispute alert: ${item.reference || item.caseReference}`;
    }

    async function loadNotifications() {
        const response = await apiGet('notifications', {
            type: $('td-notification-type-filter')?.value,
            ...state.globalFilters
        });

        state.notifications = asList(response);

        renderNotifications(state.notifications);
    }

    async function acknowledgeCritical() {
        const item = state.activeCritical;

        if (!item) return;

        await apiPost(
            'notificationAcknowledge',
            { acknowledged: true },
            item.id
        );

        state.activeCritical = null;

        closeModal('td-critical-modal');

        toast('Critical alert acknowledgement recorded.');

        await loadNotifications();
    }

    async function openRelatedCriticalCase() {
        const item = state.activeCritical;

        if (!item?.caseId) {
            toast('No related case reference is available.', 'warning');
            return;
        }

        closeModal('td-critical-modal');
        navigate('cases');

        await showCaseDetails(item.caseId);
    }


    /* =====================================================
       AUDIT AND ACCOUNTABILITY
    ===================================================== */

    function renderAudit(records) {
        const body = $('td-audit-table');

        if (!body) return;

        if (!records.length) {
            renderEmpty('td-audit-table', 7);
            return;
        }

        body.innerHTML = records.map(item => `
            <tr>
                <td class="td-table-reference">${escapeHTML(item.id)}</td>
                <td>${escapeHTML(item.administratorName || item.adminName || '—')}</td>
                <td>${escapeHTML(formatStatus(item.action))}</td>
                <td>${escapeHTML(item.caseReference || item.caseId || '—')}</td>
                <td>${escapeHTML(item.approvalStatus || '—')}</td>
                <td>${formatDateTime(item.createdAt)}</td>
                <td>${statusBadge(item.outcome || item.status)}</td>
            </tr>
        `).join('');
    }

    async function loadAudit() {
        const response = await apiGet('audit', {
            search: $('td-audit-search')?.value,
            ...state.globalFilters
        });

        state.audit = asList(response);

        renderAudit(state.audit);
    }


    /* =====================================================
       REPORTS AND ANALYTICS
    ===================================================== */

    function renderReportHistory(records) {
        const body = $('td-report-history');

        if (!body) return;

        if (!records.length) {
            renderEmpty('td-report-history', 6);
            return;
        }

        body.innerHTML = records.map(item => `
            <tr>
                <td class="td-table-reference">${escapeHTML(item.id)}</td>
                <td>${escapeHTML(formatStatus(item.type))}</td>
                <td>${escapeHTML(item.generatedBy || '—')}</td>
                <td>${formatDateTime(item.createdAt)}</td>
                <td>${statusBadge(item.status)}</td>
                <td>
                    ${item.downloadUrl
                ? `<a class="td-row-action"
                              href="${escapeHTML(item.downloadUrl)}"
                              target="_blank"
                              rel="noopener noreferrer">Download</a>`
                : '—'}
                </td>
            </tr>
        `).join('');
    }

    async function loadReports() {
        const response = await apiGet('reports', state.globalFilters);

        state.reports = asList(response);

        renderReportHistory(state.reports);

        const data = unwrap(response);

        if (data?.countryBreakdown) {
            renderBars('td-country-chart', data.countryBreakdown);
        }
    }

    function downloadCSV(filename, rows) {
        if (!rows.length) {
            toast('There are no loaded records to export.', 'warning');
            return;
        }

        const columns = [...new Set(
            rows.flatMap(row => Object.keys(row))
        )];

        const csv = [
            columns.join(','),
            ...rows.map(row => columns.map(column => {
                const value = String(row[column] ?? '')
                    .replace(/"/g, '""');

                return `"${value}"`;
            }).join(','))
        ].join('\r\n');

        const blob = new Blob(
            ['\uFEFF', csv],
            { type: 'text/csv;charset=utf-8;' }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = filename;
        link.click();

        URL.revokeObjectURL(url);
    }

    async function generateReport(type) {
        if (type === 'cases') {
            downloadCSV('talvora-dispute-register.csv', state.cases);
            return;
        }

        if (type === 'audit') {
            downloadCSV('talvora-dispute-audit.csv', state.audit);
            return;
        }

        if (type === 'notifications') {
            downloadCSV('talvora-dispute-notifications.csv', state.notifications);
            return;
        }

        const response = await apiPost('reports', {
            type,
            filters: state.globalFilters,
            format: 'csv'
        });

        const data = unwrap(response);

        if (data?.downloadUrl) {
            const link = document.createElement('a');
            link.href = data.downloadUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.click();
        } else {
            toast('Report generation request submitted.');
        }

        await loadReports();
    }


    /* =====================================================
       MODAL MANAGEMENT
    ===================================================== */

    function openModal(id) {
        const modal = $(id);

        if (!modal) return;

        modal.hidden = false;
        document.body.style.overflow = 'hidden';

        const focusable = modal.querySelector(
            'input:not([type=hidden]), select, textarea, button'
        );

        focusable?.focus();
    }

    function closeModal(id) {
        const modal = $(id);

        if (!modal) return;

        modal.hidden = true;

        if (!document.querySelector(
            '.td-modal-overlay:not([hidden])'
        )) {
            document.body.style.overflow = '';
        }
    }

    function closeAllModals() {
        all('.td-modal-overlay').forEach(modal => {
            modal.hidden = true;
        });

        document.body.style.overflow = '';
    }

    function toggleNotifications() {
        const drawer = $('td-notification-drawer');

        if (!drawer) return;

        drawer.hidden = !drawer.hidden;
        state.notificationDrawerOpen = !drawer.hidden;

        if (!drawer.hidden) {
            loadNotifications().catch(error =>
                handleError(error, 'Notifications')
            );
        }
    }


    /* =====================================================
       ASSIGNMENT SETTINGS
    ===================================================== */

    async function openAssignmentSettings() {
        const response = await apiGet('settings');

        state.settings = unwrap(response) || {};

        $('td-assignment-mode').value =
            state.settings.mode || 'hybrid';

        $('td-workload-limit').value =
            state.settings.workloadLimit ?? '';

        $('td-escalation-threshold').value =
            state.settings.escalationThreshold || 'both';

        openModal('td-settings-modal');
    }

    async function submitSettings(event) {
        event.preventDefault();

        const body = {
            mode: $('td-assignment-mode').value,
            workloadLimit: Number($('td-workload-limit').value),
            escalationThreshold: $('td-escalation-threshold').value
        };

        await apiUpdate('settings', body);

        closeModal('td-settings-modal');

        toast('Assignment settings updated.');

        await loadAssignments();
    }


    /* =====================================================
       VIEW NAVIGATION
    ===================================================== */

    const VIEW_LOADERS = {
        overview: loadOverview,
        cases: loadCases,
        assignment: loadAssignments,
        investigations: loadInvestigations,
        mediation: loadMediations,
        appeals: loadAppeals,
        evidence: loadEvidence,
        decisions: loadDecisions,
        notifications: loadNotifications,
        reports: loadReports,
        audit: loadAudit
    };

    async function navigate(view) {
        if (!$(`td-view-${view}`)) return;

        state.activeView = view;

        all('.td-view').forEach(section => {
            section.classList.toggle(
                'active',
                section.id === `td-view-${view}`
            );
        });

        all('.td-nav-link').forEach(link => {
            link.classList.toggle(
                'active',
                link.dataset.view === view
            );
        });

        closeSidebar();

        const loader = VIEW_LOADERS[view];

        if (loader) {
            try {
                await loader();
            } catch (error) {
                handleError(error, `${formatStatus(view)} loading`);
            }
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function loadView(view) {
        const loader = VIEW_LOADERS[view];

        if (!loader) return;

        try {
            await loader();
        } catch (error) {
            handleError(error, `${formatStatus(view)} loading`);
        }
    }

    function openSidebar() {
        $('td-sidebar')?.classList.add('open');
        $('td-sidebar-overlay')?.classList.add('active');
    }

    function closeSidebar() {
        $('td-sidebar')?.classList.remove('open');
        $('td-sidebar-overlay')?.classList.remove('active');
    }


    /* =====================================================
       CASE AND ADMINISTRATOR DROPDOWNS
    ===================================================== */

    async function populateCaseDropdowns() {
        try {
            const response = await apiGet('cases', {
                status: 'eligible_for_investigation,eligible_for_mediation'
            });

            const cases = asList(response);

            ['td-investigation-case', 'td-mediation-case'].forEach(id => {
                const select = $(id);

                if (!select) return;

                select.innerHTML = `
                    <option value="">Select dispute case</option>

                    ${cases.map(item => `
                        <option value="${escapeHTML(item.id)}">
                            ${escapeHTML(item.reference || item.id)}
                            — ${escapeHTML(item.title || '')}
                        </option>
                    `).join('')}
                `;
            });

        } catch (error) {
            console.warn('Case selection data unavailable:', error);
        }
    }


    /* =====================================================
       EVENT HANDLERS
    ===================================================== */

    function bindEvents() {

        /* Navigation */

        all('[data-view]').forEach(button => {
            button.addEventListener('click', () => {
                navigate(button.dataset.view);
            });
        });

        all('[data-go-view]').forEach(button => {
            button.addEventListener('click', () => {
                navigate(button.dataset.goView);
            });
        });

        $('td-menu-button')?.addEventListener('click', openSidebar);
        $('td-sidebar-close')?.addEventListener('click', closeSidebar);
        $('td-sidebar-overlay')?.addEventListener('click', closeSidebar);


        /* Global filters */

        $('td-apply-filters')?.addEventListener(
            'click',
            applyGlobalFilters
        );

        $('td-clear-filters')?.addEventListener(
            'click',
            clearGlobalFilters
        );

        $('td-refresh')?.addEventListener('click', () => {
            loadView(state.activeView);
        });

        $('td-trend-period')?.addEventListener('change', async event => {
            try {
                const response = await apiGet('dashboard', {
                    trendPeriod: event.target.value
                });

                renderDashboard(unwrap(response));
            } catch (error) {
                handleError(error, 'Trend refresh');
            }
        });


        /* Case registration */

        $('td-create-case')?.addEventListener(
            'click',
            () => navigate('intake')
        );

        $('td-register-case')?.addEventListener(
            'click',
            () => navigate('intake')
        );

        $('td-intake-form')?.addEventListener('submit', async event => {
            event.preventDefault();

            const form = event.currentTarget;

            const body = Object.fromEntries(
                new FormData(form).entries()
            );

            Object.keys(body).forEach(key => {
                if (typeof body[key] === 'string') {
                    body[key] = body[key].trim();
                }
            });

            try {
                await apiPost('cases', body);

                form.reset();

                toast('Dispute successfully registered.');

                await loadOverview();
                await navigate('cases');

            } catch (error) {
                handleError(error, 'Dispute registration');
            }
        });


        /* Case searching */

        let caseSearchTimer;

        $('td-case-search')?.addEventListener('input', () => {
            window.clearTimeout(caseSearchTimer);

            caseSearchTimer = window.setTimeout(() => {
                loadCases().catch(error =>
                    handleError(error, 'Case search')
                );
            }, 350);
        });

        [
            'td-case-status-filter',
            'td-case-category-filter',
            'td-case-priority-filter'
        ].forEach(id => {
            $(id)?.addEventListener('change', () => {
                loadCases().catch(error =>
                    handleError(error, 'Case filtering')
                );
            });
        });


        /* Case assignment */

        $('td-assignment-form')?.addEventListener(
            'submit',
            event => {
                submitAssignment(event).catch(error =>
                    handleError(error, 'Case assignment')
                );
            }
        );

        $('td-auto-assign')?.addEventListener('click', () => {
            autoAssign().catch(error =>
                handleError(error, 'Automatic assignment')
            );
        });

        $('td-assignment-settings')?.addEventListener('click', () => {
            openAssignmentSettings().catch(error =>
                handleError(error, 'Assignment settings')
            );
        });

        $('td-settings-form')?.addEventListener('submit', event => {
            submitSettings(event).catch(error =>
                handleError(error, 'Settings update')
            );
        });


        /* Investigations */

        $('td-new-investigation')?.addEventListener('click', async () => {
            await populateCaseDropdowns();
            openModal('td-investigation-modal');
        });

        $('td-investigation-form')?.addEventListener('submit', event => {
            submitInvestigation(event).catch(error =>
                handleError(error, 'Investigation')
            );
        });

        $('td-investigation-status-filter')?.addEventListener(
            'change',
            () => loadInvestigations().catch(error =>
                handleError(error, 'Investigation filtering')
            )
        );


        /* Mediation */

        $('td-new-mediation')?.addEventListener('click', async () => {
            await populateCaseDropdowns();
            openModal('td-mediation-modal');
        });

        $('td-mediation-form')?.addEventListener('submit', event => {
            submitMediation(event).catch(error =>
                handleError(error, 'Mediation')
            );
        });


        /* Appeals */

        $('td-appeal-status-filter')?.addEventListener(
            'change',
            () => loadAppeals().catch(error =>
                handleError(error, 'Appeal filtering')
            )
        );

        $('td-appeal-form')?.addEventListener('submit', event => {
            submitAppealReview(event).catch(error =>
                handleError(error, 'Appeal review')
            );
        });


        /* Evidence */

        $('td-evidence-status-filter')?.addEventListener(
            'change',
            () => loadEvidence().catch(error =>
                handleError(error, 'Evidence filtering')
            )
        );

        $('td-evidence-form')?.addEventListener('submit', event => {
            submitEvidenceReview(event).catch(error =>
                handleError(error, 'Evidence review')
            );
        });


        /* Decisions */

        $('td-decision-form')?.addEventListener('submit', event => {
            submitDecision(event).catch(error =>
                handleError(error, 'Administrative decision')
            );
        });


        /* Notifications */

        $('td-notification-button')?.addEventListener(
            'click',
            toggleNotifications
        );

        $('td-close-notifications')?.addEventListener('click', () => {
            $('td-notification-drawer').hidden = true;
            state.notificationDrawerOpen = false;
        });

        $('td-notification-type-filter')?.addEventListener(
            'change',
            () => loadNotifications().catch(error =>
                handleError(error, 'Notification filtering')
            )
        );

        $('td-critical-acknowledge')?.addEventListener('click', () => {
            acknowledgeCritical().catch(error =>
                handleError(error, 'Critical alert acknowledgement')
            );
        });

        $('td-critical-view')?.addEventListener('click', () => {
            openRelatedCriticalCase().catch(error =>
                handleError(error, 'Critical case review')
            );
        });


        /* Audit search */

        $('td-audit-search')?.addEventListener('change', () => {
            loadAudit().catch(error =>
                handleError(error, 'Audit search')
            );
        });


        /* Exports */

        all('[data-report]').forEach(button => {
            button.addEventListener('click', () => {
                generateReport(button.dataset.report).catch(error =>
                    handleError(error, 'Report generation')
                );
            });
        });


        /* Category cards */

        all('.td-category-card').forEach(button => {
            button.addEventListener('click', () => {
                const category = button.dataset.category;

                if ($('td-case-category-filter')) {
                    $('td-case-category-filter').value = category;
                }

                navigate('cases');
            });
        });


        /* Case detail assignment */

        $('td-case-assign-button')?.addEventListener('click', () => {
            const caseId = state.activeCase?.id;

            closeModal('td-case-modal');
            openAssignmentModal(caseId);
        });


        /* Modal close buttons */

        all('[data-close-modal]').forEach(button => {
            button.addEventListener('click', () => {
                closeModal(button.dataset.closeModal);
            });
        });

        all('.td-modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', event => {
                if (event.target === overlay) {
                    closeModal(overlay.id);
                }
            });
        });

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                closeAllModals();

                if (state.notificationDrawerOpen) {
                    $('td-notification-drawer').hidden = true;
                    state.notificationDrawerOpen = false;
                }

                closeSidebar();
            }
        });


        /* Dynamic table actions */

        document.addEventListener('click', event => {
            const button = event.target.closest('[data-action]');

            if (!button) return;

            const { action, id } = button.dataset;

            if (!id) return;

            switch (action) {
                case 'view-case':
                    showCaseDetails(id).catch(error =>
                        handleError(error, 'Case details')
                    );
                    break;

                case 'assign-case':
                    openAssignmentModal(id);
                    break;

                case 'review-appeal':
                    openAppealReview(id);
                    break;

                case 'review-evidence':
                    openEvidenceReview(id);
                    break;

                case 'review-decision':
                    openDecisionReview(id);
                    break;

                case 'view-notification': {
                    const notification = state.notifications.find(
                        item => String(item.id) === String(id)
                    );

                    if (notification?.caseId) {
                        showCaseDetails(notification.caseId).catch(error =>
                            handleError(error, 'Related case')
                        );
                    }
                    break;
                }

                case 'view-investigation':
                case 'view-mediation':
                    toast(
                        'Open the associated case to review its full history.',
                        'info'
                    );
                    break;

                default:
                    console.warn('Unknown action:', action);
            }
        });
    }


    /* =====================================================
       INITIALIZATION
    ===================================================== */

    async function init() {
        populateCategories();
        bindEvents();

        setNotice(
            'Connecting to TALVORA dispute management services...',
            'info'
        );

        await Promise.allSettled([
            loadCountries(),
            loadAdmins()
        ]);

        await Promise.allSettled([
            loadOverview(),
            loadNotifications()
        ]);

        setNotice(
            'Dispute management workspace initialized. Case data and permissions are supplied by the connected TALVORA services.',
            'success'
        );

        updateLastUpdated();
    }


    /* =====================================================
       PUBLIC INTERFACE
    ===================================================== */

    window.TALVORA_DISPUTES = Object.freeze({
        navigate,
        refresh: () => loadView(state.activeView),
        loadCases,
        loadOverview,
        loadNotifications,
        openCase: showCaseDetails,
        openAssignment: openAssignmentModal,

        getState: () => ({
            activeView: state.activeView,
            caseCount: state.cases.length,
            administratorCount: state.admins.length
        })
    });

    init().catch(error => {
        handleError(error, 'Workspace initialization');

        setNotice(
            'The dispute workspace could not fully initialize. Check the service connection and try refreshing.',
            'error'
        );
    });

})();
