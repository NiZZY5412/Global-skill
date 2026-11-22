(()=>{"use strict";
const TE=window.TALVORA_EMPLOYEE,$=id=>document.getElementById(id),state={policies:[],acknowledgements:[],view:[]},esc=TE.escape;
function acknowledged(policy){return state.acknowledgements.some(a=>a.policyId===policy.id&&a.version===policy.version);}
function render(){
 const current=state.policies.filter(x=>x.status==="Current"),required=current.filter(x=>x.acknowledgementRequired),done=required.filter(acknowledged);
 $("policyCount").textContent=current.length;$("policyAckRequired").textContent=required.length;$("policyAckDone").textContent=done.length;$("policyAckPending").textContent=required.length-done.length;
 const q=$("policySearch").value.toLowerCase().trim(),cat=$("policyCategory").value,status=$("policyStatus").value;
 state.view=state.policies.filter(x=>(!q||`${x.title} ${x.summary} ${x.category} ${x.owner}`.toLowerCase().includes(q))&&(!cat||x.category===cat)&&(!status||x.status===status));
 $("policyGrid").innerHTML=state.view.length?state.view.map(p=>{const ack=acknowledged(p),pending=p.acknowledgementRequired&&!ack;return `<article class="policy-card"><div class="course-top"><span class="career-chip">${esc(p.category)}</span>${TE.badge(p.status)}</div><h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p><div class="policy-meta"><span>Version ${esc(p.version)}</span><span>Effective ${TE.formatDate(p.effectiveDate)}</span><span>Owner: ${esc(p.owner)}</span></div><div class="goal-footer">${pending?'<span class="pill warning">Acknowledgement required</span>':p.acknowledgementRequired?'<span class="pill success">Acknowledged</span>':'<span class="pill">Reference policy</span>'}<button class="btn btn-small btn-primary" data-policy-detail="${esc(p.id)}">Read policy</button></div></article>`;}).join(""):'<div class="empty-state" style="grid-column:1/-1">No policies match your search.</div>';
 const ackRows=state.acknowledgements.map(a=>({ack:a,policy:state.policies.find(p=>p.id===a.policyId)})).filter(x=>x.policy);
 $("policyAckRows").innerHTML=ackRows.length?ackRows.map(x=>`<tr><td><strong>${esc(x.policy.title)}</strong></td><td>${esc(x.ack.version)}</td><td>${TE.formatDateTime(x.ack.acknowledgedAt)}</td><td><span class="pill success">Recorded</span></td></tr>`).join(""):'<tr><td colspan="4" class="empty-state">No policy acknowledgements have been recorded.</td></tr>';
}
async function load(){
 try{const d=TE.unwrap(await TE.request("/policies"));state.policies=d.policies||[];state.acknowledgements=d.acknowledgements||[];const cats=[...new Set(state.policies.map(p=>p.category))],select=$("policyCategory"),old=select.value;select.innerHTML='<option value="">All categories</option>'+cats.map(x=>`<option>${esc(x)}</option>`).join("");if(cats.includes(old))select.value=old;render();}
 catch(e){TE.notify(e.message,"error");$("policyGrid").innerHTML=`<div class="notice error">${esc(e.message)}</div>`;}
}
function showPolicy(id){
 const p=state.policies.find(x=>x.id===id);if(!p)return;const ack=acknowledged(p);
 $("policyDetailBody").innerHTML=`<div class="course-top"><span class="career-chip">${esc(p.category)}</span>${TE.badge(p.status)}</div><h2 style="font-size:17px;margin:10px 0 5px">${esc(p.title)}</h2><div class="policy-meta"><span>Version ${esc(p.version)}</span><span>Effective: ${TE.formatDate(p.effectiveDate)}</span><span>Review: ${TE.formatDate(p.reviewDate)}</span><span>Owner: ${esc(p.owner)}</span></div><p class="mt-12">${esc(p.summary)}</p><h3 class="mt-12">Policy guidance</h3><ol class="policy-content">${(p.content||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ol>${p.acknowledgementRequired?ack?'<div class="notice success mt-12">You have acknowledged this version of the policy.</div>':'<div class="notice warning mt-12">This current policy version requires your acknowledgement.</div>':'<div class="notice mt-12">This policy is provided as reference guidance and does not require acknowledgement in this demo.</div>'}`;
 $("policyDetailActions").innerHTML=`<button class="btn" data-close-dialog="policyDetailDialog">Close</button>${p.acknowledgementRequired&&!ack&&p.status==="Current"?`<button class="btn btn-primary" data-ack-policy="${esc(p.id)}">Acknowledge version ${esc(p.version)}</button>`:""}`;
 TE.openDialog("policyDetailDialog");
}
async function acknowledge(id){
 try{await TE.request(`/policies/${encodeURIComponent(id)}/acknowledge`,{method:"POST",body:{}});TE.closeDialog("policyDetailDialog");TE.notify("Policy acknowledgement recorded for this version.","success");await load();}
 catch(e){TE.notify(e.message,"error");}
}
$("policyGrid").addEventListener("click",e=>{const b=e.target.closest("[data-policy-detail]");if(b)showPolicy(b.dataset.policyDetail);});
$("policyDetailActions").addEventListener("click",e=>{const close=e.target.closest("[data-close-dialog]");if(close){TE.closeDialog(close.dataset.closeDialog);return;}const b=e.target.closest("[data-ack-policy]");if(b)acknowledge(b.dataset.ackPolicy);});
["policySearch","policyCategory","policyStatus"].forEach(id=>$(id).addEventListener(id==="policySearch"?"input":"change",render));
$("refreshPolicies").addEventListener("click",load);load();window.TALVORA_POLICIES={refresh:load};
})();
