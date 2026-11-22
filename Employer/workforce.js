/* =========================================================
   TALVORA MODULE 9
   EMPLOYEE & WORKFORCE MANAGEMENT ENGINE
========================================================= */

(() => {
    "use strict";

    const shared = window.TALVORA_EMPLOYER || {};

    const $ = id => document.getElementById(id);

    const state = {
        employees: [],
        filtered: [],
        selected: null,
        loading: false,
        initialized: false
    };

    const STATUSES = [
        "active",
        "probation",
        "on_leave",
        "suspended",
        "terminated",
        "offboarded"
    ];

    /* API CONNECTION */

    function getCompanyId() {
        return typeof shared.getCompanyId === "function"
            ? shared.getCompanyId()
            : $("companySwitcher")?.value;
    }

    function companyPath(path) {
        if (typeof shared.companyPath === "function") {
            return shared.companyPath(path);
        }

        const id = getCompanyId();

        if (!id) throw new Error("Select an organization first.");

        return `/api/employer/companies/${encodeURIComponent(id)}${path}`;
    }

    async function request(path, options = {}) {
        if (typeof shared.api === "function") {
            return shared.api(path, options);
        }

        const headers = { ...(options.headers || {}) };

        const config = {
            method: options.method || "GET",
            credentials: "same-origin",
            headers
        };

        if (options.body !== undefined) {
            headers["Content-Type"] = "application/json";
            config.body = JSON.stringify(options.body);
        }

        const response = await fetch(path, config);

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.message || `Request failed (${response.status})`);
        }

        return data;
    }

    function records(result, key = "employees") {
        const data = result?.data ?? result;

        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.[key])) return data[key];
        if (Array.isArray(data?.items)) return data.items;

        return [];
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function toast(message, type = "info") {
        const region = $("toastRegion");
        if (!region) return;

        const item = document.createElement("div");
        item.className = `toast ${type}`;
        item.textContent = message;
        region.appendChild(item);

        setTimeout(() => item.remove(), 4000);
    }

    function today() {
        const d = new Date();
        return [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, "0"),
            String(d.getDate()).padStart(2, "0")
        ].join("-");
    }

    function label(value) {
        return String(value || "Not specified")
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    function date(value) {
        if (!value) return "—";

        const raw = String(value);
        const d = /^\d{4}-\d{2}-\d{2}$/.test(raw)
            ? new Date(`${raw}T00:00:00`)
            : new Date(raw);

        return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
    }

    function idOf(employee) {
        return String(employee.id || employee._id || "");
    }

    function nameOf(employee) {
        return employee.fullName ||
            employee.name ||
            [employee.firstName, employee.lastName].filter(Boolean).join(" ") ||
            "Unnamed Employee";
    }

    function statusOf(employee) {
        return String(employee.employmentStatus || employee.status || "active").toLowerCase();
    }

    function typeOf(employee) {
        return String(employee.employmentType || employee.contractType || "full_time").toLowerCase();
    }

    function departmentOf(employee) {
        return employee.department?.name ||
            employee.departmentName ||
            employee.department ||
            "Unassigned";
    }

    function locationOf(employee) {
        return employee.location?.name ||
            employee.branch?.name ||
            employee.locationName ||
            employee.branchName ||
            employee.location ||
            "Unassigned";
    }

    function positionOf(employee) {
        return employee.jobTitle || employee.position || employee.role || "Unassigned";
    }

    function managerOf(employee) {
        return employee.manager?.name ||
            employee.managerName ||
            employee.manager ||
            "Not assigned";
    }

    function emailOf(employee) {
        return employee.email || employee.workEmail || "";
    }

    function initials(employee) {
        return nameOf(employee)
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0].toUpperCase())
            .join("") || "E";
    }

    function find(id) {
        return state.employees.find(item => idOf(item) === String(id));
    }

    /* LOAD */

    async function load() {
        if (state.loading) return;

        if (!getCompanyId()) {
            setConnection("Select an organization to load workforce records.", "error");
            return;
        }

        state.loading = true;
        setConnection("Loading workforce records...");

        try {
            const result = await request(companyPath("/employees"));

            state.employees = records(result);
            state.filtered = [...state.employees];

            populateFilters();
            renderAll();

            setConnection("Connected to TALVORA", "connected");

            if ($("workforceLastUpdated")) {
                $("workforceLastUpdated").textContent =
                    `Updated ${new Date().toLocaleTimeString()}`;
            }

        } catch (error) {
            console.error("[TALVORA WORKFORCE]", error);
            setConnection("Unable to load employee records.", "error");
            toast(error.message, "error");
            state.employees = [];
            state.filtered = [];
            renderAll();

        } finally {
            state.loading = false;
        }
    }

    function setConnection(message, status = "") {
        if ($("workforceConnectionStatus")) {
            $("workforceConnectionStatus").textContent = message;
        }

        const dot = document.querySelector(".connection-dot");
        if (dot) dot.className = `connection-dot ${status}`;
    }

    /* STATISTICS */

    function countStatus(status) {
        return state.employees.filter(e => statusOf(e) === status).length;
    }

    function renderKPIs() {
        const departments = new Set(
            state.employees.map(departmentOf)
                .filter(value => value !== "Unassigned")
                .map(value => value.toLowerCase())
        );

        const values = {
            totalEmployees: state.employees.length,
            activeEmployees: countStatus("active"),
            onLeaveEmployees: countStatus("on_leave"),
            probationEmployees: countStatus("probation"),
            inactiveEmployees: state.employees.filter(e =>
                ["suspended", "terminated", "offboarded"].includes(statusOf(e))
            ).length,
            departmentsCount: departments.size
        };

        Object.entries(values).forEach(([key, value]) => {
            if ($(key)) $(key).textContent = value.toLocaleString();
        });

        $("employeeCountLabel").textContent =
            `${state.employees.length} employees`;
    }

    /* DEPARTMENT OVERVIEW */

    function renderDepartments() {
        const container = $("departmentOverview");
        container.replaceChildren();

        const groups = {};

        state.employees.forEach(employee => {
            const department = departmentOf(employee);
            groups[department] = (groups[department] || 0) + 1;
        });

        const entries = Object.entries(groups).sort((a, b) => b[1] - a[1]);

        if (!entries.length) {
            container.innerHTML =
                '<p class="overview-empty">No department records available.</p>';
            return;
        }

        entries.slice(0, 9).forEach(([name, count]) => {
            const percentage = Math.round(count / state.employees.length * 100);

            const card = document.createElement("article");
            card.className = "department-card";

            card.innerHTML = `
                <div class="department-card-header">
                    <strong>${escapeHTML(name)}</strong>
                    <span>${count}</span>
                </div>
                <div class="department-progress">
                    <div class="department-progress-fill" style="width:${percentage}%"></div>
                </div>
                <small>${percentage}% of workforce</small>
            `;

            container.appendChild(card);
        });
    }

    /* LIFECYCLE */

    function renderLifecycle() {
        const container = $("lifecycleOverview");
        container.replaceChildren();

        [
            ["Active Employees", "active"],
            ["Probation", "probation"],
            ["On Leave", "on_leave"],
            ["Suspended", "suspended"],
            ["Terminated", "terminated"],
            ["Offboarded", "offboarded"]
        ].forEach(([name, status]) => {
            const item = document.createElement("article");
            item.className = "lifecycle-item";
            item.innerHTML = `
                <strong>${countStatus(status)}</strong>
                <span>${name}</span>
            `;
            container.appendChild(item);
        });
    }

    /* FILTER OPTIONS */

    function fillSelect(id, values, firstLabel) {
        const select = $(id);
        const previous = select.value;

        select.replaceChildren();

        const first = new Option(firstLabel, "");
        select.add(first);

        [...new Set(values)].sort().forEach(value => {
            select.add(new Option(value, value));
        });

        if (values.includes(previous)) select.value = previous;
    }

    function populateFilters() {
        fillSelect(
            "employeeDepartmentFilter",
            state.employees.map(departmentOf).filter(v => v !== "Unassigned"),
            "All Departments"
        );

        fillSelect(
            "employeeLocationFilter",
            state.employees.map(locationOf).filter(v => v !== "Unassigned"),
            "All Locations"
        );
    }

    /* TABLE */

    function renderEmployees() {
        const body = $("employeeTableBody");
        body.replaceChildren();

        if (!state.filtered.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="9" class="table-loading">
                        No matching employee records found.
                    </td>
                </tr>
            `;
        }

        state.filtered.forEach(employee => {
            const id = idOf(employee);
            const status = statusOf(employee);

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>
                    <div class="employee-cell">
                        <div class="employee-mini-avatar">${escapeHTML(initials(employee))}</div>
                        <div>
                            <strong>${escapeHTML(nameOf(employee))}</strong>
                            <small>${escapeHTML(emailOf(employee) || "Email unavailable")}</small>
                        </div>
                    </div>
                </td>
                <td>${escapeHTML(employee.employeeNumber || employee.employeeCode || id || "—")}</td>
                <td>${escapeHTML(departmentOf(employee))}</td>
                <td>${escapeHTML(positionOf(employee))}</td>
                <td>${escapeHTML(locationOf(employee))}</td>
                <td>${escapeHTML(label(typeOf(employee)))}</td>
                <td><span class="status-badge ${STATUSES.includes(status) ? status : "neutral"}">${escapeHTML(label(status))}</span></td>
                <td>${escapeHTML(date(employee.startDate || employee.hireDate))}</td>
                <td>
                    <div class="table-actions">
                        <button class="table-action" data-action="view" data-id="${escapeHTML(id)}">View</button>
                        <button class="table-action" data-action="edit" data-id="${escapeHTML(id)}">Edit</button>
                        <button class="table-action" data-action="assign" data-id="${escapeHTML(id)}">Assign</button>
                        <button class="table-action" data-action="status" data-id="${escapeHTML(id)}">Status</button>
                    </div>
                </td>
            `;

            body.appendChild(row);
        });

        $("workforceTableFooter").textContent =
            `Showing ${state.filtered.length} of ${state.employees.length} employees`;

        $("workforceFilteredCount").textContent =
            `${state.filtered.length} records`;
    }

    /* SEARCH */

    function filterEmployees() {
        const query = $("employeeSearch").value.trim().toLowerCase();
        const status = $("employeeStatusFilter").value;
        const department = $("employeeDepartmentFilter").value;
        const location = $("employeeLocationFilter").value;
        const type = $("employeeTypeFilter").value;

        state.filtered = state.employees.filter(employee => {
            const searchText = [
                nameOf(employee),
                emailOf(employee),
                employee.employeeNumber,
                employee.employeeCode,
                positionOf(employee),
                departmentOf(employee),
                locationOf(employee),
                managerOf(employee)
            ].join(" ").toLowerCase();

            return (!query || searchText.includes(query)) &&
                (!status || statusOf(employee) === status) &&
                (!department || departmentOf(employee) === department) &&
                (!location || locationOf(employee) === location) &&
                (!type || typeOf(employee) === type);
        });

        renderEmployees();
    }

    function clearFilters() {
        [
            "employeeSearch",
            "employeeStatusFilter",
            "employeeDepartmentFilter",
            "employeeLocationFilter",
            "employeeTypeFilter"
        ].forEach(id => $(id).value = "");

        filterEmployees();
    }

    /* FORM HELPERS */

    function formValues(form) {
        return Object.fromEntries(new FormData(form).entries());
    }

    function setForm(form, values) {
        Object.entries(values).forEach(([key, value]) => {
            if (form.elements.namedItem(key)) {
                form.elements.namedItem(key).value = value ?? "";
            }
        });
    }

    function openEmployeeForm(id = "") {
        const form = $("employeeForm");
        form.reset();

        $("employeeId").value = id;

        const employee = id ? find(id) : null;

        $("employeeDialogTitle").textContent =
            employee ? "Edit Employee" : "Add New Employee";

        if (employee) {
            setForm(form, {
                firstName: employee.firstName,
                lastName: employee.lastName,
                email: emailOf(employee),
                phone: employee.phone,
                employeeNumber: employee.employeeNumber,
                identificationReference: employee.identificationReference,
                department: departmentOf(employee),
                jobTitle: positionOf(employee),
                location: locationOf(employee),
                manager: managerOf(employee),
                employmentType: typeOf(employee),
                employmentStatus: statusOf(employee),
                startDate: employee.startDate,
                contractEndDate: employee.contractEndDate,
                notes: employee.notes
            });
        }

        $("employeeDialog").showModal();
    }

    /* SAVE EMPLOYEE */

    async function saveEmployee(event) {
        event.preventDefault();

        const form = $("employeeForm");
        if (!form.reportValidity()) return;

        const id = $("employeeId").value;
        const payload = formValues(form);

        payload.email = payload.email.trim().toLowerCase();
        payload.contractEndDate = payload.contractEndDate || null;

        if (
            payload.startDate &&
            payload.contractEndDate &&
            payload.contractEndDate < payload.startDate
        ) {
            toast("Contract end date cannot be before the start date.", "warning");
            return;
        }

        const button = $("saveEmployeeButton");
        button.disabled = true;
        button.textContent = "Saving...";

        try {
            await request(
                companyPath(id
                    ? `/employees/${encodeURIComponent(id)}`
                    : "/employees"),
                {
                    method: id ? "PATCH" : "POST",
                    body: payload
                }
            );

            $("employeeDialog").close();
            toast(id ? "Employee updated." : "Employee created.", "success");
            await load();

        } catch (error) {
            console.error(error);
            toast(error.message || "Employee save failed.", "error");
        } finally {
            button.disabled = false;
            button.textContent = "Save Employee";
        }
    }

    /* PROFILE */

    function openProfile(id) {
        const employee = find(id);
        if (!employee) return;

        state.selected = employee;

        $("profileAvatar").textContent = initials(employee);
        $("profileEmployeeName").textContent = nameOf(employee);
        $("profileEmployeeNumber").textContent =
            `Employee ID: ${employee.employeeNumber || id}`;

        $("profileEmployeeStatus").innerHTML =
            `<span class="status-badge ${STATUSES.includes(statusOf(employee)) ? statusOf(employee) : "neutral"}">${escapeHTML(label(statusOf(employee)))}</span>`;

        $("profileEmployeeEmail").textContent = emailOf(employee) || "Not provided";
        $("profileEmployeePhone").textContent = employee.phone || "Not provided";

        const identification = employee.identificationReference || "";
        $("profileEmployeeIdentification").textContent =
            identification ? `••••••${identification.slice(-4)}` : "Not provided";

        $("profileEmployeeDepartment").textContent = departmentOf(employee);
        $("profileEmployeePosition").textContent = positionOf(employee);
        $("profileEmployeeLocation").textContent = locationOf(employee);
        $("profileEmployeeManager").textContent = managerOf(employee);
        $("profileEmployeeType").textContent = label(typeOf(employee));
        $("profileEmployeeStartDate").textContent = date(employee.startDate);
        $("profileEmployeeContractEnd").textContent = date(employee.contractEndDate);

        renderHistory(employee);
        $("employeeProfileDialog").showModal();
    }

    function renderHistory(employee) {
        const container = $("profileAssignmentHistory");
        container.replaceChildren();

        const history = employee.assignmentHistory ||
            employee.employmentHistory ||
            employee.history || [];

        if (!Array.isArray(history) || !history.length) {
            container.innerHTML =
                '<p class="overview-empty">No employment history recorded.</p>';
            return;
        }

        history.forEach(item => {
            const entry = document.createElement("article");
            entry.className = "history-item";

            entry.innerHTML = `
                <strong>${escapeHTML(label(item.type || item.action || "Employment Update"))}</strong>
                <p>${escapeHTML(item.reason || item.description || "Employment record updated.")}</p>
                <time>${escapeHTML(date(item.effectiveDate || item.createdAt))}</time>
            `;

            container.appendChild(entry);
        });
    }

    /* ASSIGNMENTS */

    function openAssignment(id) {
        const employee = find(id);
        if (!employee) return;

        if (["terminated", "offboarded"].includes(statusOf(employee))) {
            toast("Exited employees cannot receive new assignments.", "warning");
            return;
        }

        $("assignmentForm").reset();
        $("assignmentEmployeeId").value = id;
        $("assignmentDepartment").value = departmentOf(employee) === "Unassigned" ? "" : departmentOf(employee);
        $("assignmentJobTitle").value = positionOf(employee);
        $("assignmentLocation").value = locationOf(employee) === "Unassigned" ? "" : locationOf(employee);
        $("assignmentManager").value = managerOf(employee) === "Not assigned" ? "" : managerOf(employee);
        $("assignmentEffectiveDate").value = today();

        $("assignmentDialog").showModal();
    }

    async function saveAssignment(event) {
        event.preventDefault();

        const form = $("assignmentForm");
        if (!form.reportValidity()) return;

        const id = $("assignmentEmployeeId").value;
        const payload = formValues(form);
        delete payload.employeeId;

        const button = $("saveAssignmentButton");
        button.disabled = true;

        try {
            await request(
                companyPath(`/employees/${encodeURIComponent(id)}/assignments`),
                { method: "POST", body: payload }
            );

            $("assignmentDialog").close();
            toast("Assignment change recorded.", "success");
            await load();

        } catch (error) {
            toast(error.message || "Assignment update failed.", "error");
        } finally {
            button.disabled = false;
        }
    }

    /* EMPLOYMENT STATUS */

    function openStatus(id) {
        const employee = find(id);
        if (!employee) return;

        $("statusForm").reset();
        $("statusEmployeeId").value = id;
        $("employeeNewStatus").value = statusOf(employee);
        $("statusEffectiveDate").value = today();

        $("statusDialog").showModal();
    }

    async function saveStatus(event) {
        event.preventDefault();

        const form = $("statusForm");
        if (!form.reportValidity()) return;

        const id = $("statusEmployeeId").value;
        const payload = formValues(form);

        if (!STATUSES.includes(payload.employmentStatus)) {
            toast("Invalid employment status.", "error");
            return;
        }

        const employee = find(id);
        const terminal = ["terminated", "offboarded"].includes(payload.employmentStatus);

        if (terminal && !confirm(
            `Confirm changing ${nameOf(employee)} to ${label(payload.employmentStatus)}?`
        )) return;

        const button = $("saveStatusButton");
        button.disabled = true;

        try {
            await request(
                companyPath(`/employees/${encodeURIComponent(id)}/status`),
                { method: "PATCH", body: payload }
            );

            $("statusDialog").close();
            toast("Employment status updated.", "success");
            await load();

        } catch (error) {
            toast(error.message || "Status update failed.", "error");
        } finally {
            button.disabled = false;
        }
    }

    /* EVENTS */

    function bind() {
        if (state.initialized) return;
        state.initialized = true;

        $("refreshWorkforceButton")?.addEventListener("click", load);
        $("createEmployeeButton")?.addEventListener("click", () => openEmployeeForm());

        $("employeeSearch")?.addEventListener("input", filterEmployees);

        [
            "employeeStatusFilter",
            "employeeDepartmentFilter",
            "employeeLocationFilter",
            "employeeTypeFilter"
        ].forEach(id => $(id)?.addEventListener("change", filterEmployees));

        $("clearEmployeeFilters")?.addEventListener("click", clearFilters);

        $("employeeForm")?.addEventListener("submit", saveEmployee);
        $("assignmentForm")?.addEventListener("submit", saveAssignment);
        $("statusForm")?.addEventListener("submit", saveStatus);

        $("employeeTableBody")?.addEventListener("click", event => {
            const button = event.target.closest("[data-action]");
            if (!button) return;

            const { action, id } = button.dataset;

            if (action === "view") openProfile(id);
            if (action === "edit") openEmployeeForm(id);
            if (action === "assign") openAssignment(id);
            if (action === "status") openStatus(id);
        });

        $("profileEditButton")?.addEventListener("click", () => {
            if (!state.selected) return;
            const id = idOf(state.selected);
            $("employeeProfileDialog").close();
            openEmployeeForm(id);
        });

        $("profileAssignmentButton")?.addEventListener("click", () => {
            if (!state.selected) return;
            const id = idOf(state.selected);
            $("employeeProfileDialog").close();
            openAssignment(id);
        });

        $("profileStatusButton")?.addEventListener("click", () => {
            if (!state.selected) return;
            const id = idOf(state.selected);
            $("employeeProfileDialog").close();
            openStatus(id);
        });

        document.querySelectorAll("[data-close]").forEach(button => {
            button.addEventListener("click", () => {
                $(button.dataset.close)?.close();
            });
        });

        $("companySwitcher")?.addEventListener("change", load);
    }

    function renderAll() {
        renderKPIs();
        renderDepartments();
        renderEmployees();
        renderLifecycle();
    }

    const module = {
        load,
        refresh: load,
        render: renderAll,
        getEmployees: () => [...state.employees],
        getEmployee: find,
        openEmployee: openProfile,
        openCreateEmployee: () => openEmployeeForm()
    };

    if (typeof shared.registerModule === "function") {
        shared.registerModule("workforce", module);
    }

    window.TALVORA_WORKFORCE = module;

    function initialize() {
        bind();
        load();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }

})();