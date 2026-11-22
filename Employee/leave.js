(()=>{"use strict";
const TE=window.TALVORA_EMPLOYEE,$=id=>document.getElementById(id),state={balances:[],requests:[]},esc=TE.escape;
function render(){
 $("leaveBalances").innerHTML=state.balances.length?state.balances.map(x=>`<article class="balance-card"><div class="balance-name">${esc(x.name)}</div><div class="balance-value">${Number(x.available||0)} <span style="font-size:11px;color:var(--muted)">days</span></div><div class="balance-sub">${Number(x.used||0)} used of ${Number(x.entitlement||0)} entitlement</div><div class="progress mt-12"><span style="width:${x.entitlement?Math.min(100,Number(x.used||0)/Number(x.entitlement)*100):0}%"></span></div></article>`).join(""):'<div class="empty-state">No leave balances are available for this employment relationship.</div>';
 const filter=$("leaveStatusFilter").value,items=state.requests.filter(x=>!filter||x.status===filter);
 $("leaveRows").innerHTML=items.length?items.map(x=>`<tr><td><strong>${esc(x.type)}</strong></td><td>${TE.formatDate(x.startDate)}</td><td>${TE.formatDate(x.endDate)}</td><td>${Number(x.days||0)}</td><td>${TE.formatDate(x.submittedAt)}</td><td>${TE.badge(x.status)}</td><td>${x.status==="pending"?`<button class="btn btn-small btn-danger" data-cancel-leave="${esc(x.id)}">Cancel</button>`:"—"}</td></tr>`).join(""):'<tr><td colspan="7" class="empty-state">No leave requests match this filter.</td></tr>';
}
async function load(){
 try{const [b,r,e]=await Promise.all([TE.request("/leave"),TE.request("/leave-requests"),TE.request("/employment")]);state.balances=TE.array(b,"balances");state.requests=TE.array(r,"requests");const emp=TE.unwrap(e);const selected=(emp.records||[]).find(x=>x.id===emp.selectedEmploymentId);$("leaveEmployerName").textContent=selected?`${selected.employer} · ${selected.role}`:"No selected employer";render();}
 catch(e){TE.notify(e.message,"error");$("leaveRows").innerHTML=`<tr><td colspan="7" class="empty-state">${esc(e.message)}</td></tr>`;}
}
$("newLeaveRequest").onclick=()=>{$("leaveForm").reset();$("leaveStart").min=new Date().toISOString().slice(0,10);$("leaveEnd").min=new Date().toISOString().slice(0,10);TE.openDialog("leaveDialog");};
$("leaveStart").addEventListener("change",()=>{$("leaveEnd").min=$("leaveStart").value;});
$("leaveForm").addEventListener("submit",async e=>{
 e.preventDefault();const payload=Object.fromEntries(new FormData(e.currentTarget));
 if(new Date(payload.endDate)<new Date(payload.startDate)){TE.notify("End date must be on or after the start date.","warning");return;}
 const btn=$("submitLeave");TE.setBusy(btn,true,"Submitting…");
 try{await TE.request("/leave-requests",{method:"POST",body:payload});TE.closeDialog("leaveDialog");TE.notify("Leave request submitted. It is pending employer review.","success");await load();}
 catch(err){TE.notify(err.message,"error");}finally{TE.setBusy(btn,false);}
});
$("leaveRows").addEventListener("click",async e=>{
 const b=e.target.closest("[data-cancel-leave]");if(!b)return;
 if(!confirm("Cancel this pending leave request?"))return;
 try{await TE.request(`/leave-requests/${encodeURIComponent(b.dataset.cancelLeave)}/cancel`,{method:"POST",body:{}});TE.notify("Leave request cancelled.","success");await load();}
 catch(err){TE.notify(err.message,"error");}
});
$("leaveStatusFilter").addEventListener("change",render);load();window.TALVORA_LEAVE={refresh:load};
})();
