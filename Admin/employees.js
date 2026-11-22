
/* ========================================================
   GSES SYSTEM 001 — EMPLOYEE MANAGEMENT

   FILE: employees.js
   No demo data or hardcoded credentials.
   Real account operations require the backend.
   ======================================================== */

(() => {
  "use strict";

  /* ======================================================
     01. CONFIGURATION
     ====================================================== */

  const API = {
    session: "/api/v1/auth/session",
    employees: "/api/v1/admin/employees"
  };

  const $ = (id) => document.getElementById(id);

  const state = {
    authorized: false,
    csrfToken: null,
    selectedEmployee: null,
    activeTab: "overview",
    page: 1,
    pageSize: 20,
    totalPages: 1,
    requestVersion: 0,
    detailVersion: 0,
    pendingAction: null,
    actionBusy: false
  };

  const elements = {
    notice: $("employee-notice"),
    table: $("employees-table-body"),
    count: $("employee-count"),
    filters: $("employee-filters"),
    search: $("employee-search"),
    status: $("employee-status-filter"),
    sort: $("employee-sort"),
    refresh: $("refresh-employees"),
    searchButton: $("search-button"),
    previous: $("previous-page"),
    next: $("next-page"),
    pageInformation: $("page-information"),

    dialog: $("employee-dialog"),
    detailContent: $("employee-detail-content"),
    detailHeading: $("employee-detail-heading"),
    detailEmail: $("employee-detail-email"),

    suspend: $("suspend-employee"),
    restrict: $("restrict-employee"),
    reactivate: $("reactivate-employee"),

    actionDialog: $("employee-action-dialog"),
    actionForm: $("employee-action-form"),
    actionHeading: $("action-dialog-heading"),
    actionDescription: $("action-description"),
    actionReason: $("action-reason"),
    actionError: $("action-error"),
    confirmAction: $("confirm-action"),
    cancelAction: $("cancel-action"),

    sidebar: $("sidebar"),
    sidebarOverlay: $("sidebar-overlay"),
    menuToggle: $("menu-toggle"),
    closeSidebar: $("close-sidebar")
  };


  /* ======================================================
     02. API REQUESTS
     ====================================================== */

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
        credentials: "same-origin",
        cache: "no-store",
        headers,
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
        "The server rejected the request."
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
        "The server returned an invalid API response."
      );
    }

    return response.json();
  }


  /* ======================================================
     03. HELPERS
     ====================================================== */

  function text(id, value) {
    const element = $(id);

    if (element) {
      element.textContent = value;
    }
  }

  function createElement(tag, className, content) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (content !== undefined && content !== null) {
      element.textContent = String(content);
    }

    return element;
  }

  function formatCount(value) {
    return Number.isSafeInteger(value) && value >= 0
      ? new Intl.NumberFormat("en").format(value)
      : "—";
  }

  function formatDate(value) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Not available";
    }

    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(date);
  }

  function formatLocation(location) {
    if (!location || typeof location !== "object") {
      return "Not provided";
    }

    const parts = [
      location.city,
      location.region,
      location.country
    ].filter(value =>
      typeof value === "string" && value.trim()
    );

    return parts.join(", ") || "Not provided";
  }

  function display(value) {
    if (value === null || value === undefined ||
        value === "") {
      return "Not provided";
    }

    return String(value);
  }

  function showNotice(message, type = "") {
    elements.notice.textContent = message;
    elements.notice.className =
      "employee-notice " + type;
  }

  function showTableMessage(title, message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 6;

    const empty = createElement(
      "div", "empty-state"
    );

    empty.append(
      createElement("h3", "", title),
      createElement("p", "", message)
    );

    cell.append(empty);
    row.append(cell);

    elements.table.replaceChildren(row);
  }

  function showDetailMessage(title, message) {
    const empty = createElement(
      "div", "empty-state"
    );

    empty.append(
      createElement("h3", "", title),
      createElement("p", "", message)
    );

    elements.detailContent.replaceChildren(empty);
  }

  function resetStatistics() {
    [
      "stat-total",
      "stat-active",
      "stat-suspended",
      "stat-restricted",
      "stat-pending"
    ].forEach(id => text(id, "—"));

    elements.count.textContent =
      "Count unavailable";

    elements.pageInformation.textContent =
      "No page information available";

    elements.previous.disabled = true;
    elements.next.disabled = true;
  }

  function setControlsEnabled(enabled) {
    [
      elements.search,
      elements.status,
      elements.sort,
      elements.refresh,
      elements.searchButton
    ].forEach(control => {
      if (control) control.disabled = !enabled;
    });
  }


  /* ======================================================
     04. SESSION AUTHORIZATION
     ====================================================== */

  async function checkAuthorization() {

    resetStatistics();
    setControlsEnabled(false);

    showNotice(
      "Checking administrator authorization..."
    );

    try {
      const session = await request(API.session);

      if (
        session?.authenticated !== true ||
        session?.user?.id == null ||
        session?.user?.role !== "super_admin"
      ) {
        throw new Error(
          "An authorized Super Admin session is required."
        );
      }

      state.authorized = true;

      state.csrfToken =
        typeof session.csrfToken === "string"
          ? session.csrfToken
          : null;

      text(
        "admin-name",
        session.user.displayName || "Super Admin"
      );

      const dashboardLink =
        document.querySelector(".header-right .logout-button");

      if (dashboardLink) {
        dashboardLink.textContent = "Dashboard";
        dashboardLink.href =
          "index.html#/admin/dashboard";
      }

      setControlsEnabled(true);

      showNotice(
        state.csrfToken
          ? "Administrator session verified."
          : "Administrator session verified. " +
            "Account actions require CSRF configuration.",
        state.csrfToken ? "success" : "warning"
      );

      await loadEmployees();

    } catch (error) {

      state.authorized = false;
      state.csrfToken = null;
      setControlsEnabled(false);

      const message = error.status === 401 ||
        error.status === 403
          ? "Administrator sign-in is required."
          : error.message;

      showNotice(message, "warning");

      showTableMessage(
        "Employee records unavailable",
        "Connect the backend and sign in with " +
        "an authorized Super Admin account."
      );

    }
  }


  /* ======================================================
     05. EMPLOYEE STATISTICS
     ====================================================== */

  function renderStatistics(summary) {

    if (!summary || typeof summary !== "object") {
      resetStatistics();
      return;
    }

    text("stat-total", formatCount(summary.total));
    text("stat-active", formatCount(summary.active));

    text(
      "stat-suspended",
      formatCount(summary.suspended)
    );

    text(
      "stat-restricted",
      formatCount(summary.restricted)
    );

    text(
      "stat-pending",
      formatCount(summary.pending)
    );

  }


  /* ======================================================
     06. EMPLOYEE LIST
     ====================================================== */

  async function loadEmployees() {

    if (!state.authorized) return;

    const version = ++state.requestVersion;

    showTableMessage(
      "Loading employees",
      "Retrieving authorized employee records..."
    );

    const parameters = new URLSearchParams({
      page: String(state.page),
      limit: String(state.pageSize),
      search: elements.search.value.trim(),
      status: elements.status.value,
      sort: elements.sort.value
    });

    try {

      const data = await request(
        API.employees + "?" + parameters.toString()
      );

      if (version !== state.requestVersion) {
        return;
      }

      if (!data || !Array.isArray(data.items)) {
        throw new Error(
          "Invalid employee directory response."
        );
      }

      renderStatistics(data.summary);
      renderEmployees(data.items);

      const pagination = data.pagination || {};

      state.totalPages =
        Number.isSafeInteger(pagination.totalPages) &&
        pagination.totalPages > 0
          ? pagination.totalPages
          : 1;

      const total = pagination.total;

      elements.count.textContent =
        Number.isSafeInteger(total)
          ? formatCount(total) + " employees"
          : "Count unavailable";

      elements.pageInformation.textContent =
        "Page " + state.page +
        " of " + state.totalPages;

      elements.previous.disabled =
        state.page <= 1;

      elements.next.disabled =
        state.page >= state.totalPages;

    } catch (error) {

      if (version !== state.requestVersion) {
        return;
      }

      if (error.status === 401) {
        state.authorized = false;
        state.csrfToken = null;
        setControlsEnabled(false);
      }

      resetStatistics();

      showNotice(
        "Employee records could not be loaded: " +
        error.message,
        "error"
      );

      showTableMessage(
        "Unable to load employees",
        "Employee information is not available " +
        "from the administration service."
      );

    }

  }


  /* ======================================================
     07. RENDER EMPLOYEE ROWS
     ====================================================== */

  function renderEmployees(employees) {

    if (employees.length === 0) {

      showTableMessage(
        "No employee records found",
        "There are no records matching " +
        "the current search and filters."
      );

      return;
    }

    const fragment = document.createDocumentFragment();

    employees.forEach(employee => {

      if (!employee || employee.id == null) {
        return;
      }

      const row = document.createElement("tr");

      // Identity

      const identityCell = document.createElement("td");

      const identity = createElement(
        "div", "employee-name-cell"
      );

      const avatar = createElement(
        "div",
        "employee-avatar",
        (employee.displayName || "?")
          .trim()
          .charAt(0)
          .toUpperCase()
      );

      const identityText = createElement(
        "div", "employee-identity"
      );

      identityText.append(
        createElement(
          "strong",
          "",
          employee.displayName || "Name unavailable"
        ),
        createElement(
          "small",
          "",
          employee.email || "Email unavailable"
        )
      );

      identity.append(avatar, identityText);
      identityCell.append(identity);

      // Status

      const statusCell = document.createElement("td");

      const status = String(
        employee.status || "unknown"
      ).toLowerCase();

      const badge = createElement(
        "span",
        "status-badge status-" + (
          /^[a-z-]+$/.test(status)
            ? status
            : "inactive"
        ),
        status
      );

      statusCell.append(badge);

      // Location

      const locationCell = createElement(
        "td",
        "",
        formatLocation(employee.declaredLocation)
      );

      // Dates

      const registeredCell = createElement(
        "td", "", formatDate(employee.createdAt)
      );

      const activityCell = createElement(
        "td", "", formatDate(employee.lastActiveAt)
      );

      // View button

      const actionCell = document.createElement("td");

      const viewButton = createElement(
        "button",
        "btn btn-secondary employee-view-button",
        "View Details"
      );

      viewButton.type = "button";

      viewButton.addEventListener("click", () => {
        openEmployee(employee.id);
      });

      actionCell.append(viewButton);

      row.append(
        identityCell,
        statusCell,
        locationCell,
        registeredCell,
        activityCell,
        actionCell
      );

      fragment.append(row);

    });

    elements.table.replaceChildren(fragment);
  }


  /* ======================================================
     08. OPEN EMPLOYEE DETAILS
     ====================================================== */

  async function openEmployee(employeeId) {

    if (!state.authorized) return;

    const version = ++state.detailVersion;

    state.selectedEmployee = null;

    elements.detailHeading.textContent =
      "Employee Details";

    elements.detailEmail.textContent = "";

    hideAccountActions();

    showDetailMessage(
      "Loading employee",
      "Retrieving authorized employee information..."
    );

    if (!elements.dialog.open) {
      elements.dialog.showModal();
    }

    try {

      const data = await request(
        API.employees + "/" +
        encodeURIComponent(employeeId)
      );

      if (version !== state.detailVersion) {
        return;
      }

      if (!data?.employee ||
          data.employee.id == null) {
        throw new Error(
          "Employee details are unavailable."
        );
      }

      state.selectedEmployee = data.employee;

      elements.detailHeading.textContent =
        data.employee.displayName ||
        "Employee Details";

      elements.detailEmail.textContent =
        data.employee.email || "";

      updateAccountActions();

      await selectTab("overview");

    } catch (error) {

      if (version !== state.detailVersion) {
        return;
      }

      showDetailMessage(
        "Unable to access employee",
        error.status === 403
          ? "Access to this record is restricted."
          : error.message
      );

    }
  }


  /* ======================================================
     09. DETAIL TABS
     ====================================================== */

  async function selectTab(tab) {

    if (!state.selectedEmployee) return;

    state.activeTab = tab;

    document.querySelectorAll(
      ".employee-tab"
    ).forEach(button => {

      const active = button.dataset.tab === tab;

      button.classList.toggle("active", active);

      button.setAttribute(
        "aria-selected",
        String(active)
      );

      button.tabIndex = active ? 0 : -1;

    });

    const version = ++state.detailVersion;

    if (tab === "overview") {
      renderOverview(state.selectedEmployee);
      return;
    }

    showDetailMessage(
      "Loading information",
      "Retrieving authorized " + tab + " records..."
    );

    try {

      const id = encodeURIComponent(
        state.selectedEmployee.id
      );

      const data = await request(
        API.employees + "/" + id + "/" + tab
      );

      if (version !== state.detailVersion) {
        return;
      }

      if (!data || !Array.isArray(data.items)) {
        throw new Error(
          "The server did not provide valid records."
        );
      }

      renderRelatedRecords(tab, data.items);

    } catch (error) {

      if (version !== state.detailVersion) {
        return;
      }

      showDetailMessage(
        "Records unavailable",
        error.status === 403
          ? "Access to these records is restricted."
          : "The requested information could not be loaded."
      );

    }
  }


  /* ======================================================
     10. EMPLOYEE OVERVIEW
     ====================================================== */

  function renderOverview(employee) {

    const grid = createElement(
      "div", "employee-detail-grid"
    );

    const fields = [
      ["Full Name", employee.displayName],
      ["Email", employee.email],
      ["Phone", employee.phone],
      ["Account Status", employee.status],
      [
        "Declared Location",
        formatLocation(employee.declaredLocation)
      ],
      ["Registration Date", formatDate(employee.createdAt)],
      ["Last Activity", formatDate(employee.lastActiveAt)],
      ["Employee ID", employee.id]
    ];

    fields.forEach(([label, value]) => {

      const field = createElement(
        "div", "employee-detail-field"
      );

      field.append(
        createElement("span", "", label),
        createElement("strong", "", display(value))
      );

      grid.append(field);

    });

    elements.detailContent.replaceChildren(grid);
  }


  /* ======================================================
     11. RELATED EMPLOYEE RECORDS
     ====================================================== */

  function renderRelatedRecords(tab, items) {

    if (items.length === 0) {

      showDetailMessage(
        "No records",
        "No " + tab + " records were returned."
      );

      return;
    }

    const fields = {

      skills: {
        title: "name",
        description: "proficiency",
        detail: "claimStatus"
      },

      evidence: {
        title: "title",
        description: "type",
        detail: "verificationStatus"
      },

      applications: {
        title: "roleTitle",
        description: "employerName",
        detail: "status"
      },

      activity: {
        title: "action",
        description: "description",
        detail: "occurredAt"
      },

      security: {
        title: "eventType",
        description: "description",
        detail: "occurredAt"
      }

    };

    const config = fields[tab];

    if (!config) return;

    const container = createElement(
      "div", "employee-record-list"
    );

    items.forEach(item => {

      if (!item || typeof item !== "object") {
        return;
      }

      const record = createElement(
        "article", "employee-record"
      );

      const title = createElement(
        "h4", "", display(item[config.title])
      );

      const description = createElement(
        "p", "", display(item[config.description])
      );

      const detailValue = item[config.detail];

      const meta = createElement(
        "div",
        "employee-record-meta",
        config.detail === "occurredAt"
          ? formatDate(detailValue)
          : display(detailValue)
      );

      record.append(title, description, meta);

      container.append(record);

    });

    elements.detailContent.replaceChildren(container);
  }


  /* ======================================================
     12. ACCOUNT ACTION BUTTONS
     ====================================================== */

  function hideAccountActions() {

    [
      elements.suspend,
      elements.restrict,
      elements.reactivate
    ].forEach(button => {

      button.hidden = true;
      button.disabled = true;

    });

  }


  function updateAccountActions() {

    hideAccountActions();

    const employee = state.selectedEmployee;

    if (!employee || !state.authorized) return;

    const status = employee.status;

    if (status === "active" ||
        status === "pending") {

      elements.restrict.hidden = false;
      elements.suspend.hidden = false;

    } else if (status === "restricted") {

      elements.suspend.hidden = false;
      elements.reactivate.hidden = false;

    } else if (status === "suspended") {

      elements.reactivate.hidden = false;

    }

    [
      elements.suspend,
      elements.restrict,
      elements.reactivate
    ].forEach(button => {

      if (!button.hidden) {
        button.disabled = !state.csrfToken;
      }

    });

  }


  /* ======================================================
     13. OPEN CONFIRMATION DIALOG
     ====================================================== */

  function openAccountAction(action) {

    if (
      !state.authorized ||
      !state.csrfToken ||
      !state.selectedEmployee
    ) {
      return;
    }

    state.pendingAction = action;

    const labels = {
      suspended: "Suspend Account",
      restricted: "Restrict Account",
      active: "Reactivate Account"
    };

    elements.actionHeading.textContent =
      labels[action] || "Account Action";

    elements.actionDescription.textContent =
      "This action will change the account status " +
      "of " +
      display(state.selectedEmployee.displayName) +
      ". A reason is required and the backend " +
      "must record the administrative action.";

    elements.actionReason.value = "";
    elements.actionError.textContent = "";

    elements.confirmAction.disabled = false;
    elements.cancelAction.disabled = false;

    if (!elements.actionDialog.open) {
      elements.actionDialog.showModal();
    }

  }


  /* ======================================================
     14. SUBMIT ACCOUNT ACTION
     ====================================================== */

  async function submitAccountAction(event) {

    event.preventDefault();

    if (
      state.actionBusy ||
      !state.pendingAction ||
      !state.selectedEmployee ||
      !state.authorized
    ) {
      return;
    }

    const reason = elements.actionReason.value.trim();

    if (reason.length < 10) {

      elements.actionError.textContent =
        "Please provide a reason of at least 10 characters.";

      return;
    }

    state.actionBusy = true;

    elements.confirmAction.disabled = true;
    elements.cancelAction.disabled = true;

    elements.confirmAction.textContent =
      "Processing...";

    const employeeId = state.selectedEmployee.id;
    const desiredStatus = state.pendingAction;

    try {

      const endpoint =
        API.employees + "/" +
        encodeURIComponent(employeeId);

      // Request the change from the authorized backend.
      // The backend must validate the transition,
      // enforce permissions and record an audit event.

      await request(endpoint + "/status", {
        method: "PATCH",
        body: {
          status: desiredStatus,
          reason
        }
      });

      // Confirm the actual stored account status.
      // Do not assume the request changed the account.

      const confirmation = await request(endpoint);

      if (
        !confirmation?.employee ||
        confirmation.employee.status !== desiredStatus
      ) {
        throw new Error(
          "The server did not confirm the account status change."
        );
      }

      state.selectedEmployee = confirmation.employee;

      elements.actionDialog.close();

      elements.detailHeading.textContent =
        confirmation.employee.displayName ||
        "Employee Details";

      updateAccountActions();

      await selectTab("overview");

      showNotice(
        "The account status change was confirmed " +
        "by the server.",
        "success"
      );

      await loadEmployees();

    } catch (error) {

      elements.actionError.textContent =
        error.status === 403
          ? "You are not authorized to perform this action."
          : error.message;

    } finally {

      state.actionBusy = false;

      elements.confirmAction.disabled = false;
      elements.cancelAction.disabled = false;

      elements.confirmAction.textContent =
        "Confirm Action";

      if (!elements.actionDialog.open) {
  state.pendingAction = null;
}

    }
  }


  /* ======================================================
     15. PAGINATION
     ====================================================== */

  function nextPage() {

    if (state.page >= state.totalPages) return;

    state.page++;
    loadEmployees();

  }


  function previousPage() {

    if (state.page <= 1) return;

    state.page--;
    loadEmployees();

  }


  /* ======================================================
     16. MOBILE SIDEBAR
     ====================================================== */

  function openSidebar() {

    elements.sidebar.classList.add(
      "sidebar-open"
    );

    elements.sidebarOverlay.hidden = false;

    elements.menuToggle.setAttribute(
      "aria-expanded",
      "true"
    );

  }


  function closeSidebar() {

    elements.sidebar.classList.remove(
      "sidebar-open"
    );

    elements.sidebarOverlay.hidden = true;

    elements.menuToggle.setAttribute(
      "aria-expanded",
      "false"
    );

  }


  /* ======================================================
     17. REGISTER EVENTS
     ====================================================== */

  function registerEvents() {

    elements.filters.addEventListener(
      "submit",
      event => {

        event.preventDefault();

        state.page = 1;
        loadEmployees();

      }
    );

    elements.refresh.addEventListener(
      "click",
      loadEmployees
    );

    elements.previous.addEventListener(
      "click",
      previousPage
    );

    elements.next.addEventListener(
      "click",
      nextPage
    );

    $("close-employee-dialog").addEventListener(
      "click",
      () => elements.dialog.close()
    );

    $("done-employee").addEventListener(
      "click",
      () => elements.dialog.close()
    );

    elements.dialog.addEventListener(
      "close",
      () => {

        ++state.detailVersion;

        state.selectedEmployee = null;
        hideAccountActions();

      }
    );

    document.querySelectorAll(
      ".employee-tab"
    ).forEach(button => {

      button.addEventListener("click", () => {
        selectTab(button.dataset.tab);
      });

    });

    elements.suspend.addEventListener(
      "click",
      () => openAccountAction("suspended")
    );

    elements.restrict.addEventListener(
      "click",
      () => openAccountAction("restricted")
    );

    elements.reactivate.addEventListener(
      "click",
      () => openAccountAction("active")
    );

    elements.actionForm.addEventListener(
      "submit",
      submitAccountAction
    );

    elements.cancelAction.addEventListener(
      "click",
      () => {

        if (!state.actionBusy) {
          elements.actionDialog.close();
        }

      }
    );

    elements.actionDialog.addEventListener(
      "cancel",
      event => {

        if (state.actionBusy) {
          event.preventDefault();
        }

      }
    );

    elements.menuToggle.addEventListener(
      "click",
      openSidebar
    );

    elements.closeSidebar.addEventListener(
      "click",
      closeSidebar
    );

    elements.sidebarOverlay.addEventListener(
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


  /* ======================================================
     18. INITIALIZE
     ====================================================== */

  async function initialize() {

    text(
      "footer-year",
      new Date().getFullYear()
    );

    registerEvents();

    resetStatistics();
    hideAccountActions();

    showTableMessage(
      "Employee records unavailable",
      "Waiting for the administration service."
    );

    await checkAuthorization();

  }


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
