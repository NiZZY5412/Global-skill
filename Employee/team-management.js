(()=>{"use strict";
const TE=window.TALVORA_EMPLOYEE,$=id=>document.getElementById(id),state={teams:[],employees:[],requests:[],myEmployee:null,myTeam:null},esc=TE.escape;
function personById(id){return state.employees.find(x=>x.id===id)||null;}
function render(){
 const team=state.myTeam||state.teams[0]||null,objectives=team?.objectives||[];
 $("teamCount").textContent=state.teams.length;
 $("myTeamMembers").textContent=team?team.memberIds.length:"0";
 $("teamObjectiveCount").textContent=state.teams.reduce((n,t)=>n+(t.objectives||[]).filter(o=>o.status==="In progress"||o.status==="Proposed").length,0);
 $("teamRequestCount").textContent=state.requests.length;
 if(team){
  const manager=personById(team.managerId);
  $("reportingLine").innerHTML=`<div class="directory-person"><span class="person-avatar">${esc(state.myEmployee?.avatar||"E")}</span><span class="person-main"><strong>${esc(state.myEmployee?.name||"Current employee")}</strong><span>${esc(state.myEmployee?.title||"Employee")} · ${esc(team.name)}</span></span></div><div class="compliance-item mt-12"><span class="compliance-icon">↗</span><div><strong>Reports to ${esc(manager?.name||team.managerName)}</strong><p>${esc(manager?.title||"Team manager")} · ${esc(manager?.department||team.department)}</p>${manager?.email?`<p>${esc(manager.email)}</p>`:""}</div></div><div class="detail-list mt-12"><div class="detail-cell"><span>Department</span><strong>${esc(team.department)}</strong></div><div class="detail-cell"><span>Team location</span><strong>${esc(team.location)}</strong></div><div class="detail-cell"><span>Team members</span><strong>${team.memberIds.length}</strong></div><div class="detail-cell"><span>Manager</span><strong>${esc(team.managerName)}</strong></div></div>`;
  $("myTeamObjectives").innerHTML=objectives.length?objectives.map(o=>`<div class="goal-card"><div class="course-top"><strong>${esc(o.title)}</strong>${TE.badge(o.status)}</div><div class="progress-line mt-12"><span>Progress</span><strong>${Number(o.progress||0)}%</strong></div><div class="progress-track"><span style="width:${Math.max(0,Math.min(100,Number(o.progress||0)))}%"></span></div><p class="panel-note mt-12">Target: ${TE.formatDate(o.dueDate)}</p></div>`).join(""):'<div class="empty-state">No team objectives have been published.</div>';
 }else{$("reportingLine").innerHTML='<div class="empty-state">Your reporting line is not available in the current directory.</div>';$("myTeamObjectives").innerHTML='<div class="empty-state">No team is linked to your profile.</div>';}
 const filter=$("teamDepartmentFilter").value,teams=state.teams.filter(t=>!filter||t.department===filter);
 $("teamGrid").innerHTML=teams.length?teams.map(t=>{const members=t.memberIds.map(personById).filter(Boolean);return `<article class="team-card"><div class="course-top"><span class="career-chip">${esc(t.department)}</span><span class="pill">${members.length} members</span></div><h3>${esc(t.name)}</h3><p>${esc(t.description)}</p><div class="case-meta"><span>Lead: ${esc(t.managerName)}</span><span>${esc(t.location)}</span></div><div class="team-member-list">${members.map(m=>`<div class="team-member"><span class="person-avatar">${esc(m.avatar||m.name.slice(0,1))}</span><span><strong>${esc(m.name)}</strong><small>${esc(m.title)}</small></span>${m.id===state.myEmployee?.id?'<span class="pill info" style="margin-left:auto">You</span>':""}</div>`).join("")}</div><div class="panel-note mt-12">${(t.objectives||[]).length} shared objectives</div></article>`;}).join(""):'<div class="empty-state" style="grid-column:1/-1">No teams match this department.</div>';
 $("teamRequestRows").innerHTML=state.requests.length?state.requests.map(x=>`<tr><td><strong>${esc(x.title)}</strong></td><td>${esc(x.team)}</td><td>${esc(x.kind)}</td><td>${TE.formatDate(x.submittedAt)}</td><td>${TE.badge(x.status)}</td></tr>`).join(""):'<tr><td colspan="5" class="empty-state">No team requests have been submitted.</td></tr>';
}
async function load(){
 try{
  const [teamData,profileData]=await Promise.all([TE.request("/teams"),TE.request("/profile")]);
  const d=TE.unwrap(teamData),p=TE.unwrap(profileData);state.teams=d.teams||[];state.employees=d.employees||[];state.requests=d.requests||[];
  const profile=p.profile||{},fullName=`${profile.firstName||""} ${profile.lastName||""}`.trim();
  state.myEmployee=state.employees.find(x=>x.name.toLowerCase()===fullName.toLowerCase())||state.employees[0]||null;
  state.myTeam=state.teams.find(t=>t.memberIds.includes(state.myEmployee?.id))||state.teams[0]||null;
  const deps=[...new Set(state.teams.map(t=>t.department))],dep=$("teamDepartmentFilter"),old=dep.value;dep.innerHTML='<option value="">All departments</option>'+deps.map(x=>`<option>${esc(x)}</option>`).join("");if(deps.includes(old))dep.value=old;
  const opts=state.teams.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("");$("requestTeam").innerHTML=opts;$("objectiveTeam").innerHTML=opts;
  if(state.myTeam){$("requestTeam").value=state.myTeam.id;$("objectiveTeam").value=state.myTeam.id;}
  render();
 }catch(e){TE.notify(e.message,"error");$("teamGrid").innerHTML=`<div class="notice error">${esc(e.message)}</div>`;}
}
$("newTeamRequest").addEventListener("click",()=>{$("teamRequestForm").reset();if(state.myTeam)$("requestTeam").value=state.myTeam.id;TE.openDialog("teamRequestDialog");});
$("teamRequestForm").addEventListener("submit",async e=>{e.preventDefault();const payload=Object.fromEntries(new FormData(e.currentTarget));const selectedTeam=state.teams.find(t=>t.id===payload.team);payload.team=selectedTeam?.name||payload.team;try{await TE.request("/teams/requests",{method:"POST",body:payload});TE.closeDialog("teamRequestDialog");TE.notify("Your team request has been submitted.","success");await load();}catch(err){TE.notify(err.message,"error");}});
$("proposeObjective").addEventListener("click",()=>{$("objectiveForm").reset();if(state.myTeam)$("objectiveTeam").value=state.myTeam.id;TE.openDialog("objectiveDialog");});
$("objectiveForm").addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),teamId=fd.get("teamId"),payload={title:fd.get("title"),dueDate:fd.get("dueDate")};try{await TE.request(`/teams/${encodeURIComponent(teamId)}/objectives`,{method:"POST",body:payload});TE.closeDialog("objectiveDialog");TE.notify("Your objective suggestion has been submitted for manager review.","success");await load();}catch(err){TE.notify(err.message,"error");}});
$("teamDepartmentFilter").addEventListener("change",render);$("refreshTeams").addEventListener("click",load);load();window.TALVORA_TEAMS={refresh:load};
})();
