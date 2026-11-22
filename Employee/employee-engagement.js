(()=>{"use strict";
const TE=window.TALVORA_EMPLOYEE,$=id=>document.getElementById(id),state={surveys:[],responses:[],initiatives:[],activeSurvey:null},esc=TE.escape;
function responseFor(id){return state.responses.find(x=>x.surveyId===id)||null;}
function render(){
 const open=state.surveys.filter(x=>x.status==="Open"),pending=open.filter(x=>!responseFor(x.id));
 $("openSurveyCount").textContent=open.length;$("mySurveyCount").textContent=state.responses.length;$("initiativeCount").textContent=state.initiatives.length;$("surveyPendingCount").textContent=pending.length;
 $("surveyGrid").innerHTML=state.surveys.length?state.surveys.map(s=>{const done=!!responseFor(s.id),isOpen=s.status==="Open";return `<article class="survey-card"><div class="course-top"><span class="career-chip">${esc(s.category)}</span>${TE.badge(done?"Submitted":s.status)}</div><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p><div class="policy-meta"><span>${esc(s.audience||"Employees")}</span><span>${Number(s.estimatedMinutes||0)} min</span><span>${s.dueDate?"Due "+TE.formatDate(s.dueDate):"No due date"}</span></div><div class="goal-footer">${done?'<span class="pill success">Response submitted</span>':isOpen?'<span class="pill warning">Your feedback requested</span>':'<span class="pill">Closed</span>'}<button class="btn btn-small ${isOpen&&!done?"btn-primary":""}" data-survey-open="${esc(s.id)}">${isOpen&&!done?"Take survey":"View details"}</button></div></article>`;}).join(""):'<div class="empty-state" style="grid-column:1/-1">No surveys are currently available.</div>';
 $("initiativeGrid").innerHTML=state.initiatives.length?state.initiatives.map(x=>`<article class="team-card"><div class="course-top"><span class="career-chip">${esc(x.category)}</span>${TE.badge(x.status)}</div><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p></article>`).join(""):'<div class="empty-state" style="grid-column:1/-1">No culture initiatives have been published.</div>';
}
async function load(){try{const d=TE.unwrap(await TE.request("/engagement"));state.surveys=d.surveys||[];state.responses=d.responses||[];state.initiatives=d.initiatives||[];render();}catch(e){TE.notify(e.message,"error");$("surveyGrid").innerHTML=`<div class="notice error">${esc(e.message)}</div>`;}}
function openSurvey(id){
 const s=state.surveys.find(x=>x.id===id);if(!s)return;state.activeSurvey=s;
 const existing=responseFor(id);
 $("surveyFormBody").innerHTML=`<span class="career-chip">${esc(s.category)}</span><h2 style="font-size:17px;margin:10px 0 5px">${esc(s.title)}</h2><p class="muted">${esc(s.description)}</p><div class="policy-meta"><span>${esc(s.audience||"Employees")}</span><span>${Number(s.estimatedMinutes||0)} minutes</span><span>Deadline: ${TE.formatDate(s.dueDate)}</span></div>${existing?'<div class="notice success mt-12">You submitted this survey on '+TE.formatDateTime(existing.submittedAt)+'. Your answers are not editable in this demo.</div>':""}<div class="privacy-callout mt-12">Before responding, review your employer's survey privacy notice. This demo does not guarantee anonymous responses. Required questions are marked with an asterisk.</div>${(s.questions||[]).map((q,i)=>`<div class="survey-question"><label for="answer-${esc(q.id)}">${i+1}. ${esc(q.label)} ${q.required?'<span class="required">*</span>':""}</label>${q.type==="rating"?`<small>Choose a rating from 1 (strongly disagree) to 5 (strongly agree).</small><select class="control" id="answer-${esc(q.id)}" name="${esc(q.id)}" ${q.required?"required":""}><option value="">Select a rating</option><option value="1">1 — Strongly disagree</option><option value="2">2 — Disagree</option><option value="3">3 — Neither agree nor disagree</option><option value="4">4 — Agree</option><option value="5">5 — Strongly agree</option></select>`:`<textarea class="control" id="answer-${esc(q.id)}" name="${esc(q.id)}" rows="3" maxlength="1500" placeholder="Share your feedback" ${q.required?"required":""}></textarea>`}</div>`).join("")}`;
 const button=$("submitSurveyButton");button.classList.toggle("hidden",!!existing||s.status!=="Open");button.disabled=!!existing||s.status!=="Open";
 TE.openDialog("surveyDialog");
}
$("surveyGrid").addEventListener("click",e=>{const b=e.target.closest("[data-survey-open]");if(b)openSurvey(b.dataset.surveyOpen);});
$("surveyForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!state.activeSurvey)return;const answers={};for(const q of state.activeSurvey.questions||[]){const el=$(`answer-${q.id}`);answers[q.id]=el?el.value:"";}
 const button=$("submitSurveyButton");TE.setBusy(button,true,"Submitting…");
 try{await TE.request(`/engagement/surveys/${encodeURIComponent(state.activeSurvey.id)}/responses`,{method:"POST",body:{answers}});TE.closeDialog("surveyDialog");TE.notify("Thank you. Your survey response has been submitted.","success");await load();}
 catch(err){TE.notify(err.message,"error");}finally{TE.setBusy(button,false);}
});
$("refreshEngagement").addEventListener("click",load);load();window.TALVORA_ENGAGEMENT={refresh:load};
})();
