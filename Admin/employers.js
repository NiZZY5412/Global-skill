
/* ==========================================================
   GSES SYSTEM 001
   EMPLOYER MANAGEMENT

   FILE: employers.js
   PORTAL: SUPER ADMIN

   LIVE DATA ONLY
   NO HARDCODED ADMIN CREDENTIALS
   NO FAKE EMPLOYERS
   NO SIMULATED ACCOUNT ACTIONS
   ========================================================== */

(() => {
  "use strict";

  /* ========================================================
     01. API CONFIGURATION
     ======================================================== */

  const API = {
    session: "/api/v1/auth/session",
    employers: "/api/v1/admin/employers"
  };

  const $ = (id) => document.getElementById(id);


  /* ========================================================
     02. DOM ELEMENTS
     ======================================================== */

  const el = {
    notice: $("employer-notice"),
    table: $("employers-table-body"),
    total: $("employer-count"),

    form: $("employer-filters"),
    search: $("employer-search"),
    status: $("employer-status"),
    verification: $("verification-filter"),
    sort: $("employer-sort"),

    refresh: $("refresh-employers"),
    searchButton: $("search-employers"),
    reset: $("reset-employer-filters"),

    prev: $("previous-employer-page"),
    next: $("next-employer-page"),
    pageInfo: $("employer-page-information"),

    dialog: $("employer-dialog"),
    heading: $("employer-detail-heading"),
    email: $("employer-detail-email"),
    detail: $("employer-detail-content"),

    actionDialog: $("employer-action-dialog"),
    actionForm: $("employer-action-form"),
    actionHeading: $("employer-action-heading"),
    actionDescription: $("employer-action-description"),
    reason: $("employer-action-reason"),
    confirmName: $("employer-confirm-name"),
    actionError: $("employer-action-error"),
    confirm: $("confirm-employer-action"),
    cancel: $("cancel-employer-action"),

    sidebar: $("sidebar"),
    overlay: $("sidebar-overlay"),
    menu: $("menu-toggle")
  };


  /* ========================================================
     03. APPLICATION STATE
     ======================================================== */

  const state = {
    authorized: false,
    csrfToken: null,

    employer: null,
    permissions: {},

    page: 1,
    totalPages: 0,
    pageSize: 20,

    listRequest: 0,
    detailRequest: 0,

    tab: "overview",

    action: null,
    busy: false
  };


  /* ========================================================
     04. ADMINISTRATIVE ACTION DEFINITIONS
     ======================================================== */

  const ACTIONS = Object.freeze({

    suspend: {
      label: "Suspend Organization",
      field: "status",
      target: "suspended",
      permission: "canSuspend",
      button: "suspend-employer"
    },

    restrict: {
      label: "Restrict Organization",
      field: "status",
      target: "restricted",
      permission: "canRestrict",
      button: "restrict-employer"
    },

    reactivate: {
      label: "Reactivate Organization",
      field: "status",
      target: "active",
      permission: "canReactivate",
      button: "reactivate-employer"
    },

    approve: {
      label: "Approve Business Verification",
      field: "verificationStatus",
      target: "verified",
      permission: "canApproveVerification",
      button: "verify-employer"
    },

    reject: {
      label: "Reject Business Verification",
      field: "verificationStatus",
      target: "rejected",
      permission: "canRejectVerification",
      button: "reject-verification"
    }

  });


  /* ========================================================
     05. SAFE DOM HELPERS
     ======================================================== */

  function text(id, value) {
    const element = $(id);

    if (element) {
      element.textContent = String(value);
    }
  }


  function node(tag, className, value) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (value !== undefined && value !== null) {
      element.textContent = String(value);
    }

    return element;
  }


  function display(value) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return "Not provided";
    }

    return String(value);
  }


  function number(value) {
    if (
      !Number.isSafeInteger(value) ||
      value < 0
    ) {
      return "—";
    }

    return new Intl.NumberFormat("en").format(value);
  }


  function date(value) {
    if (!value) return "Not available";

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return "Not available";
    }

    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(parsed);
  }


  function location(value) {
    if (!value || typeof value !== "object") {
      return "Not provided";
    }

    const parts = [
      value.city,
      value.region,
      value.country
    ].filter(part =>
      typeof part === "string" &&
      part.trim()
    );

    return parts.join(", ") || "Not provided";
  }


  function safeWebsite(value) {
    if (typeof value !== "string") return null;

    try {
      const url = new URL(value);

      if (
        url.protocol !== "https:" &&
        url.protocol !== "http:"
      ) {
        return null;
      }

      return url.href;

    } catch {
      return null;
    }
  }


  /* ========================================================
     06. NOTIFICATIONS AND EMPTY STATES
     ======================================================== */

  function notice(message, tone = "") {
    el.notice.textContent = message;
    el.notice.className = "employer-notice " + tone;
  }


  function empty(
    container,
    title,
    description,
    columnSpan = 0
  ) {

    const box = node("div", "empty-state");

    box.append(
      node("h3", "", title),
      node("p", "", description)
    );

    if (columnSpan > 0) {

      const row = node("tr");
      const cell = node("td");

      cell.colSpan = columnSpan;
      cell.append(box);
      row.append(cell);

      container.replaceChildren(row);

    } else {

      container.replaceChildren(box);

    }

  }


  function connection(label, connected = false) {

    text("system-status", label);

    const badge = document.querySelector(
      ".connection-status"
    );

    if (badge) {
      badge.classList.toggle(
        "connected",
        connected
      );

      badge.classList.toggle(
        "disconnected",
        !connected
      );
    }

  }


  /* ========================================================
     07. ENABLE AND DISABLE CONTROLS
     ======================================================== */

  function controls(enabled) {

    [
      el.search,
      el.status,
      el.verification,
      el.sort,
      el.refresh,
      el.searchButton,
      el.reset
    ].forEach(control => {
      control.disabled = !enabled;
    });

    if (!enabled) {
      el.prev.disabled = true;
      el.next.disabled = true;
    }

  }


  function resetStatistics() {

    [
      "stat-total",
      "stat-active",
      "stat-verified",
      "stat-pending",
      "stat-suspended",
      "stat-restricted"
    ].forEach(id => text(id, "—"));

    el.total.textContent = "Count unavailable";

    el.pageInfo.textContent =
      "Page information unavailable";

    el.prev.disabled = true;
    el.next.disabled = true;

  }


  /* ========================================================
     08. API REQUEST HANDLER
     ======================================================== */

  async function request(url, options = {}) {

    const method = options.method || "GET";

    const headers = {
      Accept: "application/json"
    };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (method !== "GET") {

      if (!state.csrfToken) {
        throw new Error(
          "Secure account actions are not configured."
        );
      }

      headers["X-CSRF-Token"] = state.csrfToken;

    }

    let response;

    try {

      response = await fetch(url, {
        method,
        headers,
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",

        body: options.body === undefined
          ? undefined
          : JSON.stringify(options.body)
      });

    } catch {

      throw new Error(
        "Cannot connect to the GSES backend."
      );

    }

    if (!response.ok) {

      const error = new Error(
        response.status === 403
          ? "Access denied by the server."
          : "The server rejected this request."
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
        "Invalid server response format."
      );
    }

    try {
      return await response.json();
    } catch {
      throw new Error(
        "Invalid JSON returned by the server."
      );
    }

  }


  /* ========================================================
     09. INVALIDATE ACCESS
     ======================================================== */

  function invalidateAccess(message) {

    state.authorized = false;
    state.csrfToken = null;

    state.employer = null;
    state.permissions = {};

    ++state.listRequest;
    ++state.detailRequest;

    controls(false);
    resetStatistics();
    hideActions();

    if (el.actionDialog.open) {
      el.actionDialog.close();
    }

    if (el.dialog.open) {
      el.dialog.close();
    }

    empty(
      el.table,
      "Administrator access required",
      "Sign in using an authorized GSES " +
      "Super Admin account.",
      7
    );

    connection("Not Connected");
    notice(message, "warning");

  }


  /* ========================================================
     10. VERIFY ADMINISTRATOR SESSION
     ======================================================== */

  async function authorize() {

    controls(false);
    resetStatistics();

    connection("Connecting...");

    notice(
      "Checking administrator authorization..."
    );

    try {

      const session = await request(API.session);

      if (
        session?.authenticated !== true ||
        !session.user?.id ||
        session.user.role !== "super_admin"
      ) {

        invalidateAccess(
          "An authorized Super Admin session is required."
        );

        return;
      }

      state.authorized = true;

      state.csrfToken =
        typeof session.csrfToken === "string" &&
        session.csrfToken
          ? session.csrfToken
          : null;

      const adminName =
        session.user.displayName || "Super Admin";

      text("admin-name", adminName);

      const initials = adminName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0])
        .join("")
        .toUpperCase();

      text("admin-avatar", initials || "SA");

      controls(true);
      connection("Connected", true);

      notice(
        state.csrfToken
          ? "Administrator session verified."
          : "Session verified. Account actions " +
            "require CSRF configuration.",
        state.csrfToken
          ? "success"
          : "warning"
      );

      await loadEmployers();

    } catch (error) {

      invalidateAccess(
        error.message ||
        "Authentication service is unavailable."
      );

    }

  }


  /* ========================================================
     11. RENDER EMPLOYER STATISTICS
     ======================================================== */

  function renderStats(summary) {

    if (!summary || typeof summary !== "object") {

      [
        "stat-total",
        "stat-active",
        "stat-verified",
        "stat-pending",
        "stat-suspended",
        "stat-restricted"
      ].forEach(id => text(id, "—"));

      return;
    }

    text("stat-total", number(summary.total));

    text("stat-active", number(summary.active));

    text(
      "stat-verified",
      number(summary.verified)
    );

    text(
      "stat-pending",
      number(summary.pendingVerification)
    );

    text(
      "stat-suspended",
      number(summary.suspended)
    );

    text(
      "stat-restricted",
      number(summary.restricted)
    );

  }


  /* ========================================================
     12. STATUS BADGES
     ======================================================== */

  function badge(status) {

    const value = typeof status === "string"
      ? status.toLowerCase()
      : "unknown";

    const known = [
      "active",
      "pending",
      "restricted",
      "suspended",
      "closed",
      "verified",
      "unverified",
      "rejected"
    ].includes(value);

    const kind = known ? value : "unknown";

    const label = kind.charAt(0).toUpperCase() +
      kind.slice(1);

    return node(
      "span",
      "employer-status-badge employer-status-" + kind,
      label
    );

  }


  /* ========================================================
     13. RENDER EMPLOYER DIRECTORY
     ======================================================== */

  function renderEmployers(items) {

    if (items.length === 0) {

      empty(
        el.table,
        "No employers found",
        "No organization records match the " +
        "selected filters.",
        7
      );

      return;
    }

    const fragment = document.createDocumentFragment();

    items.forEach(employer => {

      if (!employer || employer.id == null) {
        return;
      }

      const row = node("tr");

      // Organization identity

      const organizationCell = node("td");

      const identity = node(
        "div",
        "employer-name-cell"
      );

      const avatar = node(
        "div",
        "employer-avatar",
        (employer.name || "?")
          .trim()
          .charAt(0)
          .toUpperCase()
      );

      const identityText = node(
        "div",
        "employer-identity"
      );

      identityText.append(
        node(
          "strong",
          "",
          display(employer.name)
        ),
        node(
          "small",
          "",
          display(employer.contactEmail)
        )
      );

      identity.append(avatar, identityText);
      organizationCell.append(identity);

      // Status cells

      const statusCell = node("td");
      statusCell.append(badge(employer.status));

      const verificationCell = node("td");

      verificationCell.append(
        badge(employer.verificationStatus)
      );

      // Action cell

      const actionCell = node("td");

      const viewButton = node(
        "button",
        "btn btn-secondary employer-view-button",
        "View Details"
      );

      viewButton.type = "button";

      viewButton.addEventListener("click", () => {
        openEmployer(employer.id);
      });

      actionCell.append(viewButton);

      row.append(
        organizationCell,
        statusCell,
        verificationCell,

        node(
          "td",
          "",
          location(employer.declaredLocation)
        ),

        node(
          "td",
          "",
          number(employer.activeJobs)
        ),

        node(
          "td",
          "",
          date(employer.createdAt)
        ),

        actionCell
      );

      fragment.append(row);

    });

    if (!fragment.childNodes.length) {

      empty(
        el.table,
        "No valid employer records",
        "The server did not return valid " +
        "organization entries.",
        7
      );

      return;
    }

    el.table.replaceChildren(fragment);

  }


  /* ========================================================
     14. LOAD EMPLOYERS FROM BACKEND
     ======================================================== */

  async function loadEmployers() {

    if (!state.authorized) return;

    const sequence = ++state.listRequest;

    empty(
      el.table,
      "Loading organizations",
      "Retrieving authorized employer records...",
      7
    );

    el.prev.disabled = true;
    el.next.disabled = true;

    const query = new URLSearchParams({
      page: String(state.page),
      limit: String(state.pageSize),
      search: el.search.value.trim(),
      status: el.status.value,
      verification: el.verification.value,
      sort: el.sort.value
    });

    try {

      const data = await request(
        API.employers + "?" + query.toString()
      );

      if (
        sequence !== state.listRequest ||
        !state.authorized
      ) {
        return;
      }

      if (!data || !Array.isArray(data.items)) {
        throw new Error(
          "Invalid employer directory response."
        );
      }

      renderStats(data.summary);
      renderEmployers(data.items);

      const pagination = data.pagination || {};

      state.totalPages =
        Number.isSafeInteger(pagination.totalPages) &&
        pagination.totalPages > 0
          ? pagination.totalPages
          : 0;

      el.total.textContent =
        Number.isSafeInteger(pagination.total) &&
        pagination.total >= 0
          ? number(pagination.total) + " organizations"
          : "Count unavailable";

      el.pageInfo.textContent =
        state.totalPages > 0
          ? "Page " + state.page +
            " of " + state.totalPages
          : "Pagination unavailable";

      el.prev.disabled = state.page <= 1;

      el.next.disabled =
        !state.totalPages ||
        state.page >= state.totalPages;

    } catch (error) {

      if (sequence !== state.listRequest) {
        return;
      }

      if (error.status === 401) {

        invalidateAccess(
          "Administrator session expired. " +
          "Sign in again."
        );

        return;
      }

      resetStatistics();

      notice(
        "Employer records could not be loaded: " +
        error.message,
        "error"
      );

      empty(
        el.table,
        "Unable to load employers",
        "Live records are unavailable from " +
        "the administration service.",
        7
      );

    }

  }


  /* ========================================================
     15. ACCOUNT ACTION VISIBILITY
     ======================================================== */

  function hideActions() {

    Object.values(ACTIONS).forEach(config => {

      const button = $(config.button);

      button.hidden = true;
      button.disabled = true;

    });

  }


  function actionEligible(key, employer) {

    if (!employer) return false;

    const account = employer.status;

    if (key === "suspend") {
      return [
        "active",
        "pending",
        "restricted"
      ].includes(account);
    }

    if (key === "restrict") {
      return account === "active";
    }

    if (key === "reactivate") {
      return [
        "suspended",
        "restricted"
      ].includes(account);
    }

    if (
      key === "approve" ||
      key === "reject"
    ) {
      return employer.verificationStatus === "pending";
    }

    return false;

  }


  function updateActions() {

    hideActions();

    if (!state.authorized || !state.employer) {
      return;
    }

    Object.entries(ACTIONS).forEach(
      ([key, config]) => {

        const button = $(config.button);

        const allowed =
          state.permissions[config.permission] === true &&
          actionEligible(key, state.employer);

        button.hidden = !allowed;

        button.disabled =
          !allowed ||
          !state.csrfToken ||
          state.busy;

      }
    );

  }


  /* ========================================================
     16. DETAIL FIELD COMPONENT
     ======================================================== */

  function field(label, value, website = false) {

    const box = node(
      "div",
      "employer-detail-field"
    );

    box.append(node("span", "", label));

    if (website && safeWebsite(value)) {

      const link = node("a", "", value);

      link.href = safeWebsite(value);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.referrerPolicy = "no-referrer";

      box.append(link);

    } else {

      box.append(
        node("strong", "", display(value))
      );

    }

    return box;

  }


  /* ========================================================
     17. EMPLOYER OVERVIEW
     ======================================================== */

  function renderOverview() {

    const employer = state.employer;

    if (!employer) return;

    const grid = node(
      "div",
      "employer-detail-grid"
    );

    [
      field("Organization Name", employer.name),

      field(
        "Contact Email",
        employer.contactEmail
      ),

      field(
        "Account Status",
        employer.status
      ),

      field(
        "Verification Status",
        employer.verificationStatus
      ),

      field(
        "Declared Location",
        location(employer.declaredLocation)
      ),

      field(
        "Registration Number",
        employer.registrationNumber
      ),

      field(
        "Website",
        employer.website,
        true
      ),

      field(
        "Registered",
        date(employer.createdAt)
      ),

      field(
        "Last Activity",
        date(employer.lastActivityAt)
      ),

      field(
        "Team Members",
        number(employer.memberCount)
      ),

      field(
        "Active Jobs",
        number(employer.activeJobs)
      ),

      field(
        "Organization ID",
        employer.id
      )

    ].forEach(item => grid.append(item));

    el.detail.replaceChildren(grid);

  }


  /* ========================================================
     18. RELATED RECORD DISPLAY CONFIGURATION
     ======================================================== */

  function recordFields(tab, item) {

    if (tab === "team") {

      return [
        item.displayName,
        display(item.role) + " · " +
          display(item.email),
        item.status
      ];

    }

    if (tab === "jobs") {

      return [
        item.title,
        "Status: " + display(item.status),
        date(item.createdAt)
      ];

    }

    if (tab === "applications") {

      return [
        item.roleTitle,
        "Applicant reference: " +
          display(item.candidateReference),
        "Stage: " + display(item.status)
      ];

    }

    if (tab === "activity") {

      return [
        item.action,
        item.description,
        date(item.occurredAt)
      ];

    }

    if (tab === "verification") {

      return [
        item.checkType,
        item.status,
        date(item.reviewedAt)
      ];

    }

    if (tab === "security") {

      return [
        item.eventType,
        item.description,
        date(item.occurredAt)
      ];

    }

    return [
      "Record",
      "Details unavailable",
      ""
    ];

  }


  /* ========================================================
     19. RENDER RELATED RECORDS
     ======================================================== */

  function renderRecords(tab, items) {

    if (items.length === 0) {

      empty(
        el.detail,
        "No records available",
        "No authorized " + tab +
        " records were returned."
      );

      return;
    }

    const list = node(
      "div",
      "employer-record-list"
    );

    items.forEach(item => {

      if (!item || typeof item !== "object") {
        return;
      }

      const [
        title,
        description,
        metadata
      ] = recordFields(tab, item);

      const card = node(
        "article",
        "employer-record"
      );

      card.append(
        node("h4", "", display(title)),
        node("p", "", display(description)),
        node(
          "div",
          "employer-record-meta",
          display(metadata)
        )
      );

      list.append(card);

    });

    if (!list.children.length) {

      empty(
        el.detail,
        "No records available",
        "The server returned no valid records."
      );

      return;
    }

    el.detail.replaceChildren(list);

  }


  /* ========================================================
     20. DETAIL TABS
     ======================================================== */

  async function selectTab(tab) {

    if (!state.employer) return;

    state.tab = tab;

    document.querySelectorAll(
      ".employer-tab"
    ).forEach(button => {

      const active = button.dataset.tab === tab;

      button.classList.toggle(
        "active",
        active
      );

      button.setAttribute(
        "aria-selected",
        String(active)
      );

      button.tabIndex = active ? 0 : -1;

      if (active) {

        el.detail.setAttribute(
          "aria-labelledby",
          button.id
        );

      }

    });

    const sequence = ++state.detailRequest;

    if (tab === "overview") {
      renderOverview();
      return;
    }

    empty(
      el.detail,
      "Loading records",
      "Retrieving authorized " + tab +
      " records..."
    );

    try {

      const id = encodeURIComponent(
        String(state.employer.id)
      );

      const result = await request(
        API.employers + "/" + id + "/" + tab
      );

      if (
        sequence !== state.detailRequest ||
        !state.employer
      ) {
        return;
      }

      if (
        !result ||
        !Array.isArray(result.items)
      ) {
        throw new Error(
          "Invalid related-record response."
        );
      }

      renderRecords(tab, result.items);

    } catch (error) {

      if (sequence !== state.detailRequest) {
        return;
      }

      if (error.status === 401) {

        invalidateAccess(
          "Administrator session expired. Sign in again."
        );

        return;
      }

      empty(
        el.detail,
        "Records unavailable",
        error.status === 403
          ? "You are not authorized to review these records."
          : "This section could not be loaded."
      );

    }

  }


  /* ========================================================
     21. OPEN EMPLOYER DETAILS
     ======================================================== */

  async function openEmployer(id) {

    if (!state.authorized) return;

    const sequence = ++state.detailRequest;

    state.employer = null;
    state.permissions = {};

    hideActions();

    el.heading.textContent = "Employer Details";
    el.email.textContent = "";

    empty(
      el.detail,
      "Loading organization",
      "Retrieving authorized employer details..."
    );

    if (!el.dialog.open) {
      el.dialog.showModal();
    }

    try {

      const result = await request(
        API.employers + "/" +
        encodeURIComponent(String(id))
      );

      if (
        sequence !== state.detailRequest ||
        !el.dialog.open
      ) {
        return;
      }

      if (
        !result ||
        !result.employer ||
        result.employer.id == null
      ) {
        throw new Error(
          "Invalid organization detail response."
        );
      }

      state.employer = result.employer;

      state.permissions =
        result.permissions &&
        typeof result.permissions === "object"
          ? result.permissions
          : {};

      el.heading.textContent =
        display(state.employer.name);

      el.email.textContent =
        display(state.employer.contactEmail);

      updateActions();

      await selectTab("overview");

    } catch (error) {

      if (sequence !== state.detailRequest) {
        return;
      }

      if (error.status === 401) {

        invalidateAccess(
          "Administrator session expired. Sign in again."
        );

        return;
      }

      empty(
        el.detail,
        "Organization unavailable",
        error.status === 403
          ? "Access to this organization is restricted."
          : "Organization information could not be retrieved."
      );

    }

  }


  /* ========================================================
     22. OPEN ADMINISTRATIVE ACTION DIALOG
     ======================================================== */

  function startAction(key) {

    const config = ACTIONS[key];

    if (
      !config ||
      !state.authorized ||
      !state.csrfToken ||
      !state.employer ||
      state.permissions[config.permission] !== true ||
      !actionEligible(key, state.employer) ||
      state.busy
    ) {
      return;
    }

    state.action = key;

    el.actionHeading.textContent =
      config.label;

    el.actionDescription.textContent =
      "You are about to " +
      config.label.toLowerCase() +
      " for " +
      display(state.employer.name) +
      ". Provide a reason and type the " +
      "exact organization name. The backend " +
      "must authorize and audit this action.";

    el.reason.value = "";
    el.confirmName.value = "";
    el.actionError.textContent = "";

    el.confirm.textContent = "Confirm Action";
    el.confirm.disabled = false;
    el.cancel.disabled = false;

    if (!el.actionDialog.open) {
      el.actionDialog.showModal();
    }

    el.reason.focus();

  }


  /* ========================================================
     23. SUBMIT ADMINISTRATIVE ACTION
     ======================================================== */

  async function submitAction(event) {

    event.preventDefault();

    if (
      state.busy ||
      !state.action ||
      !state.employer ||
      !state.authorized
    ) {
      return;
    }

    const key = state.action;
    const config = ACTIONS[key];
    const employer = state.employer;

    if (
      state.permissions[config.permission] !== true ||
      !actionEligible(key, employer)
    ) {

      el.actionError.textContent =
        "This action is not currently authorized.";

      return;
    }

    const reason = el.reason.value.trim();

    if (reason.length < 10) {

      el.actionError.textContent =
        "Enter a reason of at least 10 characters.";

      return;
    }

    const expectedName =
      String(employer.name || "").trim();

    if (
      el.confirmName.value.trim() !== expectedName
    ) {

      el.actionError.textContent =
        "The organization name does not match.";

      return;
    }

    state.busy = true;
    updateActions();

    el.confirm.disabled = true;
    el.cancel.disabled = true;
    el.confirm.textContent = "Processing...";
    el.actionError.textContent = "";

    let mutationAttempted = false;

    try {

      const base =
        API.employers + "/" +
        encodeURIComponent(String(employer.id));

      const suffix =
        config.field === "status"
          ? "status"
          : "verification";

      mutationAttempted = true;

      await request(
        base + "/" + suffix,
        {
          method: "PATCH",
          body: {
            status: config.target,
            reason
          }
        }
      );

      /*
       * Do not optimistically update the screen.
       * Retrieve the stored record to confirm
       * the server actually applied the action.
       */

      const result = await request(base);

      if (
        !result?.employer ||
        result.employer[config.field] !== config.target
      ) {

        throw new Error(
          "The server did not confirm the requested " +
          "change. Refresh the organization before " +
          "attempting another action."
        );

      }

      state.employer = result.employer;

      state.permissions =
        result.permissions &&
        typeof result.permissions === "object"
          ? result.permissions
          : {};

      el.actionDialog.close();
      state.action = null;

      el.heading.textContent =
        display(state.employer.name);

      el.email.textContent =
        display(state.employer.contactEmail);

      await selectTab("overview");

      notice(
        "The organization change was confirmed " +
        "by the server.",
        "success"
      );

      await loadEmployers();

    } catch (error) {

      if (error.status === 401) {

        invalidateAccess(
          "Administrator session expired. Sign in again."
        );

        return;
      }

      if (mutationAttempted) {

        /*
         * A failed connection after a PATCH may
         * leave the result uncertain. Prevent a
         * blind repeat of the operation.
         */

        el.actionError.textContent =
          "The action could not be fully confirmed. " +
          "Close this dialog and refresh the " +
          "organization before trying again. " +
          error.message;

        el.confirm.disabled = true;

      } else {

        el.actionError.textContent =
          error.message;

      }

    } finally {

      state.busy = false;

      el.cancel.disabled = false;

      if (!el.confirm.disabled) {
        el.confirm.textContent = "Confirm Action";
      } else {
        el.confirm.textContent =
          "Refresh Required";
      }

      updateActions();

    }

  }


  /* ========================================================
     24. MOBILE SIDEBAR
     ======================================================== */

  function closeSidebar() {

    el.sidebar.classList.remove(
      "sidebar-open"
    );

    el.overlay.hidden = true;

    el.menu.setAttribute(
      "aria-expanded",
      "false"
    );

  }


  function openSidebar() {

    el.sidebar.classList.add(
      "sidebar-open"
    );

    el.overlay.hidden = false;

    el.menu.setAttribute(
      "aria-expanded",
      "true"
    );

  }


  /* ========================================================
     25. EVENT LISTENERS
     ======================================================== */

  function bindEvents() {

    // Search and filter

    el.form.addEventListener(
      "submit",
      event => {

        event.preventDefault();

        state.page = 1;
        loadEmployers();

      }
    );

    el.reset.addEventListener(
      "click",
      () => {

        el.form.reset();

        state.page = 1;
        loadEmployers();

      }
    );

    el.refresh.addEventListener(
      "click",
      () => loadEmployers()
    );


    // Pagination

    el.prev.addEventListener(
      "click",
      () => {

        if (state.page <= 1) return;

        --state.page;
        loadEmployers();

      }
    );

    el.next.addEventListener(
      "click",
      () => {

        if (
          !state.totalPages ||
          state.page >= state.totalPages
        ) {
          return;
        }

        ++state.page;
        loadEmployers();

      }
    );


    // Details dialog

    $("close-employer-dialog").addEventListener(
      "click",
      () => el.dialog.close()
    );

    $("close-employer-details").addEventListener(
      "click",
      () => el.dialog.close()
    );

    el.dialog.addEventListener(
      "close",
      () => {

        ++state.detailRequest;

        state.employer = null;
        state.permissions = {};

        hideActions();

      }
    );


    // Detail tabs

    document.querySelectorAll(
      ".employer-tab"
    ).forEach(tab => {

      tab.addEventListener(
        "click",
        () => selectTab(tab.dataset.tab)
      );

      tab.addEventListener(
        "keydown",
        event => {

          if (
            ![
              "ArrowLeft",
              "ArrowRight",
              "Home",
              "End"
            ].includes(event.key)
          ) {
            return;
          }

          event.preventDefault();

          const tabs = [
            ...document.querySelectorAll(
              ".employer-tab"
            )
          ];

          const index = tabs.indexOf(tab);

          let nextIndex;

          if (event.key === "Home") {

            nextIndex = 0;

          } else if (event.key === "End") {

            nextIndex = tabs.length - 1;

          } else {

            const direction =
              event.key === "ArrowRight"
                ? 1
                : -1;

            nextIndex =
              (
                index +
                direction +
                tabs.length
              ) % tabs.length;

          }

          tabs[nextIndex].focus();

          selectTab(
            tabs[nextIndex].dataset.tab
          );

        }
      );

    });


    // Account actions

    Object.entries(ACTIONS).forEach(
      ([key, config]) => {

        $(config.button).addEventListener(
          "click",
          () => startAction(key)
        );

      }
    );

    el.actionForm.addEventListener(
      "submit",
      submitAction
    );

    el.cancel.addEventListener(
      "click",
      () => {

        if (!state.busy) {
          el.actionDialog.close();
        }

      }
    );

    el.actionDialog.addEventListener(
      "cancel",
      event => {

        if (state.busy) {
          event.preventDefault();
        }

      }
    );

    el.actionDialog.addEventListener(
      "close",
      () => {

        if (!state.busy) {
          state.action = null;
        }

      }
    );


    // Mobile navigation

    el.menu.addEventListener(
      "click",
      openSidebar
    );

    $("close-sidebar").addEventListener(
      "click",
      closeSidebar
    );

    el.overlay.addEventListener(
      "click",
      closeSidebar
    );

    document.addEventListener(
      "keydown",
      event => {

        if (event.key === "Escape") {
          closeSidebar();
        }

      }
    );

  }


  /* ========================================================
     26. INITIALIZE
     ======================================================== */

  async function initialize() {

    text(
      "footer-year",
      new Date().getFullYear()
    );

    bindEvents();

    controls(false);
    resetStatistics();
    hideActions();

    empty(
      el.table,
      "Employer records unavailable",
      "Administrator authorization and live " +
      "backend services are required.",
      7
    );

    await authorize();

  }


  /* ========================================================
     27. START APPLICATION
     ======================================================== */

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
