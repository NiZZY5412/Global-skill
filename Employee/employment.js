(()=>{"use strict";
const TE=window.TALVORA_EMPLOYEE,$=id=>document.getElementById(id),state={records:[],selectedId:null,view:[]},esc=TE.escape;
function current(){return state.records.find(x=>x.id===state.selectedId)||state.records.find(x=>x.status==="active")||null;}
function render(){
 const q=$("employmentSearch").value.toLowerCase(),status=$("employmentStatusFilter").value;
 state.view=state.records.filter(x=>(!q||`${x.employer} ${x.role} ${x.branch} ${x.location} ${x.employeeNumber}`.toLowerCase().includes(q))&&(!status||x.status===status));
 const active=state.records.filter(x=>x.status==="active"),former=state.records.filter(x=>x.status==="former");
 $("activeEmploymentCount").textContent=active.length;$("concurrentEmployerCount").textContent=new Set(active.map(x=>x.employer)).size;$("formerEmployerCount").textContent=former.length;$("workLocationCount").textContent=new Set(state.records.map(x=>x.location).filter(Boolean)).size;
 const selected=current();
 $("selectedEmployerName").textContent=selected?selected.employer:"No active employment relationship selected";
 $("selectedEmployerMeta").textContent=selected?`${selected.role} · ${selected.branch||selected.location} · ${selected.employmentType}`:"Select an active employer record to set your context";
 $("selectedEmployerStatus").textContent=selected?"Current employment context":"No active context";
 $("selectedEmployerStatus").className="pill "+(selected?"success":"warning");
 $("employmentGrid").innerHTML=state.view.length?state.view.map(x=>`<article class="record-card ${x.id===state.selectedId?"current":""}"><div class="record-card-head"><div style="display:flex;gap:10px;min-width:0"><span class="company-mark">${esc(x.initials||TE.safeInitials(x.employer))}</span><div><h3>${esc(x.role)}</h3><div class="employer">${esc(x.employer)}</div></div></div>${TE.badge(x.status)}</div><div class="record-card-meta"><div><span>Employment type</span><strong>${esc(x.employmentType||"Not specified")}</strong></div><div><span>Department</span><strong>${esc(x.department||"Not specified")}</strong></div><div><span>Branch / location</span><strong>${esc(x.branch||x.location||"Not specified")}</strong></div><div><span>Start date</span><strong>${TE.formatDate(x.startDate)}</strong></div></div><div class="item-meta"><span>Employee no. ${esc(x.employeeNumber||"—")}</span><span>${esc(x.workMode||"")}</span></div><div class="item-actions">${x.status==="active"?(x.id===state.selectedId?'<span class="pill success">Selected context</span>':`<button class="btn btn-small btn-primary" data-select-employment="${esc(x.id)}">Switch context</button>`):'<span class="pill">Historical record</span>'}<button class="btn btn-small" data-view-employment="${esc(x.id)}">View record</button></div></article>`).join(""):'<div class="empty-state" style="grid-column:1/-1"><strong>No employment records found</strong>Try another search or status filter.</div>';
}
async function load(){
 try{const d=TE.unwrap(await TE.request("/employment"));state.records=Array.isArray(d.records)?d.records:[];state.selectedId=d.selectedEmploymentId||state.records.find(x=>x.status==="active")?.id||null;render();}
 catch(e){$("employmentGrid").innerHTML=`<div class="notice error">${esc(e.message)}</div>`;TE.notify(e.message,"error");}
}
function details(id){
 const x=state.records.find(v=>v.id===id);if(!x)return;
 $("employmentDetailBody").innerHTML=`<div style="display:flex;gap:12px;align-items:center"><span class="company-mark">${esc(x.initials||TE.safeInitials(x.employer))}</span><div><h2 style="font-size:18px;margin:0">${esc(x.employer)}</h2><p class="muted" style="margin:3px 0">${esc(x.role)}</p></div></div><div class="detail-list"><div class="detail-cell"><span>Employment status</span><strong>${esc(x.status)}</strong></div><div class="detail-cell"><span>Employment type</span><strong>${esc(x.employmentType||"—")}</strong></div><div class="detail-cell"><span>Department</span><strong>${esc(x.department||"—")}</strong></div><div class="detail-cell"><span>Branch</span><strong>${esc(x.branch||"—")}</strong></div><div class="detail-cell"><span>Work location</span><strong>${esc(x.location||"—")}</strong></div><div class="detail-cell"><span>Work arrangement</span><strong>${esc(x.workMode||"—")}</strong></div><div class="detail-cell"><span>Start date</span><strong>${TE.formatDate(x.startDate)}</strong></div><div class="detail-cell"><span>End date</span><strong>${TE.formatDate(x.endDate)}</strong></div><div class="detail-cell"><span>Employee number</span><strong>${esc(x.employeeNumber||"—")}</strong></div><div class="detail-cell"><span>Manager</span><strong>${esc(x.manager||"—")}</strong></div><div class="detail-cell"><span>Work email</span><strong>${esc(x.workEmail||"Not provided")}</strong></div><div class="detail-cell"><span>Contract reference</span><strong>${esc(x.contractReference||"—")}</strong></div></div><div class="notice">This is a summary of the employment record supplied by the employer. Refer to your official employment agreement for binding terms.</div>`;
 $("employmentDetailActions").innerHTML=`<button class="btn" data-close-dialog="employmentDetailDialog">Close</button>${x.status==="active"&&x.id!==state.selectedId?`<button class="btn btn-primary" data-select-from-detail="${esc(x.id)}">Switch to this employer</button>`:""}`;
 TE.openDialog("employmentDetailDialog");
}
async function selectContext(id){
 const item=state.records.find(x=>x.id===id);if(!item||item.status!=="active")return;
 if(!confirm(`Switch your active workspace context to ${item.employer}? This changes the selected context in this portal; it does not change your employer's records or permissions.`))return;
 try{await TE.request(`/employment/${encodeURIComponent(id)}/select`,{method:"POST",body:{}});state.selectedId=id;TE.closeDialog("employmentDetailDialog");render();TE.notify(`Employment context switched to ${item.employer}.`,"success");}
 catch(e){TE.notify(e.message,"error");}
}
$("employmentGrid").addEventListener("click",e=>{const view=e.target.closest("[data-view-employment]"),select=e.target.closest("[data-select-employment]");if(view)details(view.dataset.viewEmployment);if(select)selectContext(select.dataset.selectEmployment);});
$("employmentDetailActions").addEventListener("click",e=>{const b=e.target.closest("[data-select-from-detail]");if(b)selectContext(b.dataset.selectFromDetail);});
$("employmentSearch").addEventListener("input",render);$("employmentStatusFilter").addEventListener("change",render);$("refreshEmployment").addEventListener("click",load);
load();window.TALVORA_EMPLOYMENT={refresh:load};
})();
