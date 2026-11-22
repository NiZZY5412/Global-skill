(()=>{"use strict";
const TE=window.TALVORA_EMPLOYEE,$=id=>document.getElementById(id),state={cases:[],categories:[],activeCaseId:null,appealCaseId:null},esc=TE.escape;
function render(){
 const open=state.cases.filter(x=>["submitted","in_review","awaiting_employee","appeal_submitted"].includes(x.status));
 $("openCaseCount").textContent=open.length;$("awaitingResponseCount").textContent=state.cases.filter(x=>x.status==="awaiting_employee").length;$("resolvedCaseCount").textContent=state.cases.filter(x=>["resolved","closed"].includes(x.status)).length;
 const filter=$("caseStatusFilter").value,items=state.cases.filter(x=>!filter||x.status===filter);
 $("caseList").innerHTML=items.length?items.map(x=>`<article class="case-card"><div class="course-top"><span class="career-chip">${esc(x.category)}</span>${TE.badge(x.status)}</div><h3>${esc(x.subject)}</h3><p>${esc(x.description).slice(0,170)}${x.description.length>170?"…":""}</p><div class="case-meta"><span>Ref: ${esc(x.reference)}</span><span>Submitted: ${TE.formatDate(x.submittedAt)}</span><span>Priority: ${esc(x.priority)}</span></div><div class="goal-footer"><span>${x.confidential?'<span class="pill warning">Confidential handling requested</span>':""}</span><button class="btn btn-small btn-primary" data-view-case="${esc(x.id)}">View case</button></div></article>`).join(""):'<div class="empty-state">No support cases match this filter.</div>';
 const select=$("supportCategory"),current=select.value;select.innerHTML='<option value="">Choose a category</option>'+state.categories.map(x=>`<option>${esc(x)}</option>`).join("");if(state.categories.includes(current))select.value=current;
}
async function load(){try{const d=TE.unwrap(await TE.request("/support"));state.cases=d.cases||[];state.categories=d.categories||[];render();}catch(e){TE.notify(e.message,"error");$("caseList").innerHTML=`<div class="notice error">${esc(e.message)}</div>`;}}
function showCase(id){
 const x=state.cases.find(v=>v.id===id);if(!x)return;state.activeCaseId=id;
 const messages=x.messages||[];
 $("caseDetailBody").innerHTML=`<div class="course-top"><span class="career-chip">${esc(x.category)}</span>${TE.badge(x.status)}</div><h2 style="font-size:17px;margin:10px 0 5px">${esc(x.subject)}</h2><div class="case-meta"><span>Reference: ${esc(x.reference)}</span><span>Submitted: ${TE.formatDateTime(x.submittedAt)}</span><span>Assigned: ${esc(x.assignedTeam||"Support team")}</span></div><div class="${x.confidential?"confidential-callout":"privacy-callout"}">${x.confidential?"Confidential handling requested.":"This case is handled through the designated employee support process."} Share additional information only when relevant to your case.</div><h3 class="mt-12">Case description</h3><p style="font-size:10px;white-space:pre-wrap">${esc(x.description)}</p><h3 class="mt-12">Case updates</h3>${messages.length?messages.map(m=>`<div class="case-message ${m.from==="Employee"?"":"staff"}"><strong>${esc(m.from)} · ${TE.formatDateTime(m.date)}</strong><p>${esc(m.message)}</p></div>`).join(""):'<p class="panel-note">No case updates yet.</p>'}${x.appeals?.length?`<h3 class="mt-12">Appeals</h3>${x.appeals.map(a=>`<div class="case-message"><strong>Appeal submitted · ${TE.formatDateTime(a.submittedAt)}</strong><p>${esc(a.reason)}</p><span class="pill">${esc(a.status)}</span></div>`).join("")}`:""}${!["closed","withdrawn"].includes(x.status)?`<form id="caseReplyForm" class="mt-12"><div class="field"><label for="caseReplyMessage">Send an update</label><textarea id="caseReplyMessage" name="message" rows="3" maxlength="3000" placeholder="Add relevant information or respond to a support update"></textarea></div><button class="btn btn-primary btn-small" type="submit">Send case update</button></form>`:""}`;
 $("caseDetailActions").innerHTML=`<button class="btn" data-close-dialog="caseDetailDialog">Close</button>${["resolved","closed"].includes(x.status)?`<button class="btn btn-primary" data-appeal-case="${esc(x.id)}">Submit appeal</button>`:""}`;
 TE.openDialog("caseDetailDialog");
}
$("newSupportCase").addEventListener("click",()=>{$("supportCaseForm").reset();TE.openDialog("supportCaseDialog");});
$("supportCaseForm").addEventListener("submit",async e=>{
 e.preventDefault();const fd=new FormData(e.currentTarget),payload={category:fd.get("category"),subject:fd.get("subject"),description:fd.get("description"),priority:fd.get("priority"),confidential:$("supportConfidential").checked};
 const b=$("submitSupportCase");TE.setBusy(b,true,"Submitting…");
 try{const r=TE.unwrap(await TE.request("/support/cases",{method:"POST",body:payload}));TE.closeDialog("supportCaseDialog");TE.notify(`Your request has been submitted. Reference: ${r.case.reference}`,"success");await load();if(r.case)showCase(r.case.id);}
 catch(err){TE.notify(err.message,"error");}finally{TE.setBusy(b,false);}
});
$("caseList").addEventListener("click",e=>{const b=e.target.closest("[data-view-case]");if(b)showCase(b.dataset.viewCase);});
$("caseDetailActions").addEventListener("click",e=>{const b=e.target.closest("[data-appeal-case]");if(!b)return;const x=state.cases.find(v=>v.id===b.dataset.appealCase);if(!x)return;state.appealCaseId=x.id;$("appealCaseRef").textContent=`Case ${x.reference} · ${x.subject}`;$("appealForm").reset();TE.closeDialog("caseDetailDialog");TE.openDialog("appealDialog");});
$("caseDetailBody").addEventListener("submit",async e=>{
 if(e.target.id!=="caseReplyForm")return;e.preventDefault();const message=$("caseReplyMessage").value.trim();if(!message)return;
 try{await TE.request(`/support/cases/${encodeURIComponent(state.activeCaseId)}/messages`,{method:"POST",body:{message}});TE.notify("Your case update was sent.","success");await load();showCase(state.activeCaseId);}
 catch(err){TE.notify(err.message,"error");}
});
$("appealForm").addEventListener("submit",async e=>{e.preventDefault();if(!state.appealCaseId)return;const payload=Object.fromEntries(new FormData(e.currentTarget));try{await TE.request(`/support/cases/${encodeURIComponent(state.appealCaseId)}/appeal`,{method:"POST",body:payload});TE.closeDialog("appealDialog");TE.notify("Your appeal was submitted for review.","success");await load();}catch(err){TE.notify(err.message,"error");}});
$("caseStatusFilter").addEventListener("change",render);$("refreshSupport").addEventListener("click",load);load();window.TALVORA_SUPPORT={refresh:load};
})();
