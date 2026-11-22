(()=>{"use strict";
const TE=window.TALVORA_EMPLOYEE,$=id=>document.getElementById(id),state={records:[],open:null,shifts:[],timesheets:[]},esc=TE.escape;
const today=()=>new Date().toISOString().slice(0,10);
function timeNow(){const d=new Date();$("clockDisplay").textContent=d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit",second:"2-digit"});$("clockDate").textContent=d.toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long",year:"numeric"});}
function selectedEmploymentId(){return TE.getDemoState()?.selectedEmploymentId||null;}
function render(){
 const open=state.open;
 $("clockState").textContent=open?"You are currently clocked in":"No active clock-in session";
 $("clockContext").textContent=open?"Session in progress — remember to clock out when your work session ends.":"Clock in when you begin your work session.";
 $("clockAction").textContent=open?"Clock out":"Clock in";
 $("clockAction").className="btn "+(open?"btn-danger":"btn-teal");
 const shift=state.shifts.find(x=>x.date===today());
 $("shiftTodayStatus").textContent=shift?"Scheduled":"No shift listed";
 $("todayShift").innerHTML=shift?`<div class="detail-list"><div class="detail-cell"><span>Shift</span><strong>${esc(shift.label||"Scheduled shift")}</strong></div><div class="detail-cell"><span>Hours</span><strong>${esc(shift.start)} – ${esc(shift.end)}</strong></div><div class="detail-cell"><span>Work location</span><strong>${esc(shift.location||"Not specified")}</strong></div><div class="detail-cell"><span>Date</span><strong>${TE.formatDate(shift.date)}</strong></div></div>`:'<div class="empty-state">No shift has been published for today.</div>';
 const cutoff=new Date();cutoff.setDate(cutoff.getDate()-6);const week=state.records.filter(x=>new Date(x.date)>=cutoff&&x.workedHours).reduce((n,x)=>n+Number(x.workedHours||0),0);
 $("weekHours").textContent=week.toFixed(1);$("attendanceDays").textContent=state.records.filter(x=>x.status!=="leave").length;
 $("pendingTimesheets").textContent=state.timesheets.filter(x=>["draft","returned"].includes(x.status)).length;
 $("overtimeHours").textContent=state.timesheets.reduce((n,x)=>n+Number(x.overtimeHours||0),0).toFixed(1);
 const month=$("attendanceMonth").value;
 const rows=state.records.filter(x=>!month||String(x.date).startsWith(month)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 $("attendanceRows").innerHTML=rows.length?rows.map(x=>`<tr><td>${TE.formatDate(x.date)}</td><td>${esc(x.clockIn||"—")}</td><td>${esc(x.clockOut||"—")}</td><td>${Number(x.breakMinutes||0)} min</td><td>${Number(x.workedHours||0).toFixed(2)}</td><td>${TE.badge(x.status)}</td></tr>`).join(""):'<tr><td colspan="6" class="empty-state">No attendance records for this period.</td></tr>';
 $("shiftList").innerHTML=state.shifts.length?state.shifts.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(x=>`<article class="item-card"><div style="display:flex;justify-content:space-between;gap:8px"><h3>${TE.formatDate(x.date,{weekday:"short",day:"numeric",month:"short"})}</h3>${TE.badge("scheduled")}</div><p>${esc(x.label||"Work shift")}</p><div class="item-meta"><span>◷ ${esc(x.start)}–${esc(x.end)}</span><span>⌖ ${esc(x.location||"Not specified")}</span></div></article>`).join(""):'<div class="empty-state" style="grid-column:1/-1">No shifts have been published.</div>';
 $("timesheetList").innerHTML=state.timesheets.length?state.timesheets.map(x=>`<article class="item-card"><div style="display:flex;justify-content:space-between;gap:8px"><div><h3>${esc(x.period)}</h3><p>${TE.formatDate(x.from)} – ${TE.formatDate(x.to)}</p></div>${TE.badge(x.status)}</div><div class="detail-list"><div class="detail-cell"><span>Regular hours</span><strong>${Number(x.regularHours||0).toFixed(2)}</strong></div><div class="detail-cell"><span>Overtime hours</span><strong>${Number(x.overtimeHours||0).toFixed(2)}</strong></div><div class="detail-cell"><span>Total hours</span><strong>${Number(x.totalHours||0).toFixed(2)}</strong></div><div class="detail-cell"><span>Submitted</span><strong>${TE.formatDate(x.submittedAt)}</strong></div></div>${["draft","returned"].includes(x.status)?`<button class="btn btn-primary btn-small" data-submit-timesheet="${esc(x.id)}">Submit timesheet</button>`:""}</article>`).join(""):'<div class="empty-state">No timesheets are available.</div>';
}
async function load(){
 try{const [a,s,t]=await Promise.all([TE.request("/attendance"),TE.request("/shifts"),TE.request("/timesheets")]);const ad=TE.unwrap(a),sd=TE.unwrap(s),td=TE.unwrap(t);state.records=ad.records||[];state.open=ad.open||null;state.shifts=sd.shifts||ad.shifts||[];state.timesheets=td.timesheets||[];render();}
 catch(e){TE.notify(e.message,"error");$("attendanceRows").innerHTML=`<tr><td colspan="6" class="empty-state">${esc(e.message)}</td></tr>`;}
}
async function clock(){const action=state.open?"clock-out":"clock-in";const btn=$("clockAction");TE.setBusy(btn,true,action==="clock-in"?"Clocking in…":"Clocking out…");try{await TE.request(`/attendance/${action}`,{method:"POST",body:{employmentId:selectedEmploymentId()}});TE.notify(action==="clock-in"?"Clock-in recorded.":"Clock-out recorded.","success");await load();}catch(e){TE.notify(e.message,"error");}finally{TE.setBusy(btn,false);render();}}
async function submitTimesheet(id){if(!confirm("Submit this timesheet to your employer for review?"))return;try{await TE.request(`/timesheets/${encodeURIComponent(id)}/submit`,{method:"POST",body:{}});TE.notify("Timesheet submitted for review.","success");await load();}catch(e){TE.notify(e.message,"error");}}
$("clockAction").addEventListener("click",clock);$("refreshAttendance").addEventListener("click",load);$("attendanceMonth").addEventListener("change",render);$("timesheetList").addEventListener("click",e=>{const b=e.target.closest("[data-submit-timesheet]");if(b)submitTimesheet(b.dataset.submitTimesheet);});
timeNow();window.setInterval(timeNow,1000);load();window.TALVORA_ATTENDANCE={refresh:load};
})();
