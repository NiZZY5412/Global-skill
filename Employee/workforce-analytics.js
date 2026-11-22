(()=>{"use strict";
const TE=window.TALVORA_EMPLOYEE,$=id=>document.getElementById(id),state={data:null},esc=TE.escape;
function bars(targetId,items){
 const host=$(targetId);if(!items?.length){host.innerHTML='<div class="empty-state">No aggregated data available.</div>';return;}
 const max=Math.max(1,...items.map(x=>Number(x.count||0)));
 host.innerHTML=items.map(x=>`<div class="metric-bar-row"><span class="metric-name">${esc(x.name)}</span><span class="metric-track"><span style="width:${Math.max(2,Number(x.count||0)/max*100)}%"></span></span><strong class="metric-value">${Number(x.count||0).toLocaleString()}</strong></div>`).join("");
}
function render(){
 const d=state.data;if(!d)return;const s=d.summary||{};
 $("metricHeadcount").textContent=Number(s.headcount||0).toLocaleString();$("metricActive").textContent=Number(s.active||0).toLocaleString();$("metricHires").textContent=Number(s.newHiresYtd||0).toLocaleString();$("metricDepartures").textContent=Number(s.departuresYtd||0).toLocaleString();
 $("metricOnLeave").textContent=Number(s.onLeave||0).toLocaleString();$("metricRetention").textContent=Number(s.retentionRate||0).toFixed(1)+"%";$("metricTenure").textContent=Number(s.averageTenureYears||0).toFixed(1)+" yrs";$("metricOther").textContent=Number(s.otherStatus||0).toLocaleString();
 $("analyticsSnapshot").textContent=`Snapshot ${TE.formatDate(d.snapshotDate)} · ${d.period==="30d"?"Last 30 days":d.period==="90d"?"Last 90 days":"Last 12 months"}`;
 bars("departmentBars",d.byDepartment);bars("locationBars",d.byLocation);bars("workModeBars",d.byWorkMode);bars("employmentTypeBars",d.byEmploymentType);
 const trend=d.monthlyTrend||[],max=Math.max(1,...trend.map(x=>Number(x.headcount||0))),min=Math.min(...trend.map(x=>Number(x.headcount||0)));
 $("headcountTrend").innerHTML=trend.length?trend.map(x=>{const h=Math.max(12,Number(x.headcount||0)/max*100);return `<div class="trend-column" title="${esc(x.month)}: ${Number(x.headcount)} employees"><strong>${Number(x.headcount)}</strong><div class="trend-bar" style="height:${h}%"></div><small>${esc(x.month)}</small></div>`;}).join(""):'<div class="empty-state">No headcount trend available.</div>';
}
async function load(){const period=$("analyticsPeriod").value;try{const d=TE.unwrap(await TE.request(`/workforce-analytics?period=${encodeURIComponent(period)}`));state.data=d;render();}catch(e){TE.notify(e.message,"error");$("headcountTrend").innerHTML=`<div class="notice error">${esc(e.message)}</div>`;}}
$("analyticsPeriod").addEventListener("change",load);$("refreshAnalytics").addEventListener("click",load);load();window.TALVORA_ANALYTICS={refresh:load};
})();
