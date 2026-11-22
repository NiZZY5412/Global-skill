# TALVORA Employee Portal — Phase 4
## Employee Administration & Organizational Intelligence

Phase 4 adds five employee-facing organizational modules to the TALVORA Employee Portal. It extends the shared `employee.css` and `employee.js` architecture and is designed to integrate with Phases 1–3.

## Modules delivered

17. **Employee Directory & Organizational Structure** — `employee-directory.html` + `employee-directory.js`
   - Search employees by name, role, department, team, email or employee number
   - Department, location and employment-status filters
   - Employee profile summary modal
   - Department leads and organizational unit overview
   - Work location, work mode, reporting line and employment type display

18. **Manager & Team Management** — `team-management.html` + `team-management.js`
   - Team directory, department and team lead information
   - Employee's reporting line and manager information
   - Team rosters and team objectives
   - Objective suggestions marked as proposed for manager review
   - Team support, access and workplace-improvement requests
   - Manager-only actions are not granted by this employee-facing frontend

19. **HR Policies, Procedures & Employee Handbook** — `hr-policies.html` + `hr-policies.js`
   - Searchable policy and procedure library
   - Category and status filters
   - Policy details, version, owner, effective date and review date
   - Version-specific employee acknowledgement records
   - Pending acknowledgement tracking

20. **Employee Engagement, Surveys & Workplace Culture** — `employee-engagement.html` + `employee-engagement.js`
   - Open and closed employee surveys
   - Pulse checks and learning experience surveys
   - Required rating and optional written feedback questions
   - Employee response submission and participation tracking
   - Workplace culture and engagement initiatives
   - Privacy and survey transparency guidance

21. **Workforce Analytics & Employee Insights** — `workforce-analytics.html` + `workforce-analytics.js`
   - Aggregated headcount, active employees, leave and other statuses
   - New hires and departures year-to-date
   - Retention and average tenure indicators
   - Department, country/location, work arrangement and employment-type breakdowns
   - Monthly headcount trend with 30-day, 90-day and 12-month views
   - Data governance and aggregation guidance

## Shared files

- `employee.css` — extended TALVORA responsive design system with Phase 4 directory, team, policy, survey and analytics components.
- `employee.js` — shared production API client, endpoint adapter and common UI helpers.

## Phase 4 API routes

All routes are relative to `apiBaseUrl`.

### Employee directory

| Method | Route | Purpose |
|---|---|---|
| GET | `/directory` | Directory records, departments, locations and org units |
| GET | `/directory/:employeeId` | Retrieve one employee directory record |

Supported query parameters on GET `/directory`:
- `q` — search name, role, team, department, email or employee number
- `department` — filter by department
- `status` — filter by employment status
- `location` — filter by work location

### Teams and manager workspace

| Method | Route | Purpose |
|---|---|---|
| GET | `/teams` | Teams, directory employee records and team requests |
| POST | `/teams/requests` | Submit a team support, access or improvement request |
| POST | `/teams/:teamId/objectives` | Propose a team objective for authorized manager review |

### HR policies

| Method | Route | Purpose |
|---|---|---|
| GET | `/policies` | Policy library and employee acknowledgement records |
| POST | `/policies/:policyId/acknowledge` | Acknowledge a current policy version |

### Engagement and surveys

| Method | Route | Purpose |
|---|---|---|
| GET | `/engagement` | Surveys, employee responses and culture initiatives |
| POST | `/engagement/surveys/:surveyId/responses` | Submit a survey response |

### Workforce analytics

| Method | Route | Purpose |
|---|---|---|
| GET | `/workforce-analytics?period=30d` | 30-day view |
| GET | `/workforce-analytics?period=90d` | 90-day view |
| GET | `/workforce-analytics?period=12m` | 12-month view |

## Suggested API response shapes

The shared client accepts a direct JSON response or a `{ "data": ... }` envelope.

- Directory: `{ "data": { "employees": [], "departments": [], "locations": [], "orgUnits": [] } }`
- Teams: `{ "data": { "teams": [], "employees": [], "requests": [] } }`
- Policies: `{ "data": { "policies": [], "acknowledgements": [] } }`
- Engagement: `{ "data": { "surveys": [], "responses": [], "initiatives": [] } }`
- Workforce analytics: `{ "data": { "snapshotDate": "...", "summary": {}, "byDepartment": [], "byLocation": [], "byWorkMode": [], "byEmploymentType": [], "monthlyTrend": [] } }`

The frontend displays backend error messages and expects useful JSON error responses with appropriate HTTP status codes.

## Run Phase 4 with an existing Phase 1–3 installation

1. Extract the Phase 4 ZIP.
2. Copy its five new HTML files and five module JavaScript files into the existing employee portal directory.
3. Replace the existing shared `employee.css` and `employee.js` with the Phase 4 versions.
4. Open `employee-dashboard.html` from the existing Phase 1–3 installation.
5. Use the sidebar to access modules 17–21.

The Phase 4-only ZIP includes the shared CSS and JS files updated for Phase 4. Do not overwrite them with older Phase 1–3 versions after installation.

## Production configuration

Before loading `employee.js`, configure the frontend:

```html
<script>
window.TALVORA_EMPLOYEE_CONFIG = {
  apiBaseUrl: "/api/employee",
  credentials: "same-origin",
  getAccessToken: async () => null,
  getCsrfToken: async () => null
};
</script>
<script src="employee.js"></script>
```

Replace the token functions with the application's authenticated token and CSRF providers. Do not place secrets or long-lived credentials in frontend source code.

The frontend always sends requests to `apiBaseUrl` and never falls back to sample data. The backend must implement all production endpoints and authorization.

## Production safeguards

This package is a frontend client, not a production HRIS, organization directory authority or analytics warehouse. Implement these controls server-side before production use:

1. **Identity and authorization:** authenticate every request. Restrict employee details, team records, policy acknowledgements, survey responses and workforce analytics by user, employer, role and business need.
2. **Employer and tenant isolation:** scope every record to the correct employer and employment relationship. Never trust employee, manager, department or tenant IDs supplied by the browser.
3. **Directory privacy:** expose only approved directory attributes. Do not return identity documents, home addresses, private phone numbers, health data, compensation, payroll, performance notes or confidential case details through directory endpoints.
4. **Manager permissions:** verify reporting relationships and manager authority on the server. Manager-only employee changes, approvals and restricted team information must not be enabled by a client-side flag.
5. **Organization structure:** validate department, team, manager and reporting-line changes through authorized HR workflows. Prevent circular reporting relationships and unauthorized access to other teams.
6. **Policy governance:** publish only approved policies. Keep immutable version history, effective dates, review dates, superseded status and responsible owners. Record acknowledgements with authenticated employee identity, policy version, timestamp and audit metadata.
7. **Acknowledgement semantics:** clearly explain what an acknowledgement means. Do not treat a simple acknowledgement as a legally valid signature or acceptance of contractual changes unless a separate approved process establishes that.
8. **Survey privacy:** disclose survey purpose, controller, access, anonymity or confidentiality limits, retention, recipients and aggregation rules. Do not promise anonymity unless the backend architecture and process genuinely provide it.
9. **Survey integrity:** prevent duplicate or late submissions where required, validate question types and keep a protected audit trail. Restrict raw responses to authorized reviewers.
10. **Workforce analytics:** use documented metric definitions, reliable HR source systems and reproducible reporting periods. Apply minimum cohort thresholds and suppress small groups where re-identification could occur.
11. **Sensitive attributes:** do not expose protected or sensitive personal characteristics in analytics without a lawful purpose, appropriate safeguards and authorized access.
12. **Data quality:** reconcile headcount, hires, departures, retention, tenure and employment status against authoritative HR records. Clearly label snapshot dates, time zones and calculation rules.
13. **Security and audit:** apply encryption in transit and at rest, least-privilege access, rate limiting, input validation, output encoding, security logging and retention controls.
14. **Accessibility:** validate keyboard navigation, labels, focus management, responsive behavior and screen-reader announcements across all modules.

## Data source guarantee

Directory employees, reporting lines, teams, policies, survey records, engagement initiatives and workforce metrics are loaded from authorized production APIs. Empty or unavailable API responses remain empty and are not replaced with sample records.

## Design system

The shared design system retains the TALVORA palette:
- Navy `#102B46`
- Blue `#1769A1`
- Teal `#16877C`
- Canvas `#F3F6FA`
- Border `#D5E0EA`

The UI supports desktop, tablet and mobile layouts, responsive navigation, tables, cards, filters, dialogs, forms and status indicators.
