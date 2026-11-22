(()=>{"use strict";
const TE=window.TALVORA_EMPLOYEE,$=id=>document.getElementById(id),state={employees:[],departments:[],locations:[],orgUnits:[]},esc=TE.escape;
function initials(name){return String(name||"").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"E";}
function render(){
 const q=$("directorySearch").value.toLowerCase().trim(),dep=$("directoryDepartment").value,loc=$("directoryLocation").value,status=$("directoryStatus").value;
 const rows=state.employees.filter(x=>(!q||`${x.name} ${x.title} ${x.department} ${x.team} ${x.email} ${x.employeeNumber}`.toLowerCase().includes(q))&&(!dep||x.department===dep)&&(!loc||x.location===loc)&&(!status||x.status===status));
 $("directoryCount").textContent=rows.length;$("departmentCount").textContent=state.departments.length;$("locationCount").textContent=state.locations.length;$("activeDirectoryCount").textContent=rows.filter(x=>x.status==="Active").length;
 $("directoryRows").innerHTML=rows.length?rows.map(x=>`<tr><td><div class="directory-person"><span class="person-avatar">${esc(x.avatar||initials(x.name))}</span><span class="person-main"><strong>${esc(x.name)}</strong><span>${esc(x.title)} · ${esc(x.employeeNumber)}</span></span></div></td><td><strong>${esc(x.department)}</strong><div class="panel-note">${esc(x.team)}</div></td><td>${esc(x.location)}</td><td>${esc(x.managerName||"Executive leadership")}</td><td>${esc(x.workMode)}<div class="panel-note">${esc(x.employmentType)}</div></td><td>${TE.badge(x.status)}</td><td><button class="btn btn-small" data-employee-detail="${esc(x.id)}">View</button></td></tr>`).join(""):'<tr><td colspan="7" class="empty-state">No employees match your search or filters.</td></tr>';
 $("orgStructure").innerHTML=state.orgUnits.length?state.orgUnits.map(x=>`<article class="org-unit"><div class="org-unit-head"><strong>${esc(x.name)}</strong><span class="pill">${Number(x.headcount||0)} in sample unit</span></div><p class="panel-note mt-12">Lead: ${esc(x.lead||"Not listed")}</p><div class="org-children">${(x.children||[]).map(c=>`<span>${esc(c)}</span>`).join("")}</div></article>`).join(""):'<div class="empty-state">Organizational structure is not available.</div>';
}
async function load(){
 try{
  const d=TE.unwrap(await TE.request("/directory"));state.employees=d.employees||[];state.departments=d.departments||[];state.locations=d.locations||[];state.orgUnits=d.orgUnits||[];
  const dep=$("directoryDepartment"),loc=$("directoryLocation"),oldDep=dep.value,oldLoc=loc.value;
  dep.innerHTML='<option value="">All departments</option>'+state.departments.map(x=>`<option>${esc(x)}</option>`).join("");
  loc.innerHTML='<option value="">All locations</option>'+state.locations.map(x=>`<option>${esc(x)}</option>`).join("");
  if(state.departments.includes(oldDep))dep.value=oldDep;if(state.locations.includes(oldLoc))loc.value=oldLoc;
  render();
 }catch(e){TE.notify(e.message,"error");$("directoryRows").innerHTML=`<tr><td colspan="7" class="empty-state">${esc(e.message)}</td></tr>`;}
}
function showEmployee(id){
 const x=state.employees.find(v=>v.id===id);if(!x)return;
 $("employeeDetailBody").innerHTML=`<div class="directory-person"><span class="person-avatar" style="width:48px;height:48px;font-size:13px">${esc(x.avatar||initials(x.name))}</span><span class="person-main"><strong style="font-size:14px">${esc(x.name)}</strong><span>${esc(x.title)}</span></span></div><div class="detail-list mt-12"><div class="detail-cell"><span>Employee number</span><strong>${esc(x.employeeNumber)}</strong></div><div class="detail-cell"><span>Status</span><strong>${esc(x.status)}</strong></div><div class="detail-cell"><span>Department</span><strong>${esc(x.department)}</strong></div><div class="detail-cell"><span>Team</span><strong>${esc(x.team)}</strong></div><div class="detail-cell"><span>Manager</span><strong>${esc(x.managerName||"Executive leadership")}</strong></div><div class="detail-cell"><span>Location</span><strong>${esc(x.location)}</strong></div><div class="detail-cell"><span>Work arrangement</span><strong>${esc(x.workMode)}</strong></div><div class="detail-cell"><span>Employment type</span><strong>${esc(x.employmentType)}</strong></div><div class="detail-cell"><span>Start date</span><strong>${TE.formatDate(x.startDate)}</strong></div><div class="detail-cell"><span>Work email</span><strong>${esc(x.email)}</strong></div></div><div class="privacy-callout mt-12">Only information authorized for employee directory display should be shown in production. Sensitive HR, payroll, identity and case records belong in restricted systems.</div>`;
 TE.openDialog("employeeDetailDialog");
}
$("directoryRows").addEventListener("click",e=>{const b=e.target.closest("[data-employee-detail]");if(b)showEmployee(b.dataset.employeeDetail);});
["directorySearch","directoryDepartment","directoryLocation","directoryStatus"].forEach(id=>$(id).addEventListener(id==="directorySearch"?"input":"change",render));
$("refreshDirectory").addEventListener("click",load);load();window.TALVORA_DIRECTORY={refresh:load};
})();
