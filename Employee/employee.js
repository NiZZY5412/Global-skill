(() => {
  "use strict";
  const userConfig = window.TALVORA_EMPLOYEE_CONFIG || {};
  const CONFIG = Object.assign({}, userConfig, {
    apiBaseUrl: userConfig.apiBaseUrl || "/api/employee",
    demoMode: false,
    credentials: userConfig.credentials || "same-origin",
    getAccessToken: userConfig.getAccessToken || (() => sessionStorage.getItem("talvora_employee_access_token") || "")
  });
  const AUTH_URL = "../Auth/auth.html?portal=employee";
  function hasEmployeeSession(){try{return Boolean(sessionStorage.getItem("talvora_employee_access_token"));}catch(_){return false;}}
  const $ = (id) => document.getElementById(id);
  function notify(message,type="info"){
    let host=$("toastContainer");
    if(!host){host=document.createElement("div");host.id="toastContainer";host.className="toast-container";document.body.append(host);}
    const el=document.createElement("div");el.className="toast "+(type==="success"?"success":type==="error"?"error":type==="warning"?"warning":"");el.textContent=message;host.append(el);
    window.setTimeout(()=>el.remove(),4200);
  }
  function escape(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function formatDate(value,opts={}){if(!value)return "—";const d=new Date(value);if(Number.isNaN(d.getTime()))return "—";return d.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric",...opts});}
  function formatDateTime(value){if(!value)return "To be confirmed";const d=new Date(value);if(Number.isNaN(d.getTime()))return "To be confirmed";return d.toLocaleString(undefined,{day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"});}
  function statusClass(value){
    const s=String(value||"").toLowerCase().replace(/\s+/g,"_");
    if(["active","verified","accepted","completed","hired","resolved"].includes(s))return "success";
    if(["pending","submitted","in_review","scheduled","shortlisted","in_progress","invited"].includes(s))return "warning";
    if(["rejected","withdrawn","expired","declined","cancelled"].includes(s))return "danger";
    if(["interview","interviewing","offered"].includes(s))return "info";
    return "";
  }
  function badge(value){const s=String(value||"Not set");return `<span class="pill ${statusClass(s)}">${escape(s.replace(/_/g," "))}</span>`;}
  function unwrap(result,key){let v=result?.data??result??{};if(key&&v&&typeof v==="object"&&!Array.isArray(v)&&key in v)return v[key];return v;}
  function array(result,key){const v=unwrap(result,key);if(Array.isArray(v))return v;if(v&&Array.isArray(v.items))return v.items;return [];}
  function openDialog(id){const el=$(id);if(el&&typeof el.showModal==="function")el.showModal();}
  function closeDialog(id){const el=$(id);if(el)el.close();}
  function setBusy(button,busy,label){if(!button)return;button.disabled=!!busy;if(busy){button.dataset.oldLabel=button.textContent;button.textContent=label||"Please wait…";}else if(button.dataset.oldLabel){button.textContent=button.dataset.oldLabel;delete button.dataset.oldLabel;}}
  function safeInitials(name){return String(name||"Employee").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"E";}
  function safeUrl(value){try{const u=new URL(String(value||""),window.location.href);return ["http:","https:"].includes(u.protocol)?u.href:"";}catch(_){return "";}}
  function renderMode(){
    const pill=$("modePill");
    if(pill) pill.classList.add("hidden");
    let profile={};
    try{profile=JSON.parse(sessionStorage.getItem("talvora_employee_user")||"null")||{};}catch(_){profile={};}
    const name=[profile.preferredName||profile.firstName,profile.lastName].filter(Boolean).join(" ").trim()||profile.name||profile.displayName||"Employee";
    const initials=safeInitials(name);
    const avatar=$("globalAvatar");if(avatar)avatar.textContent=initials;
    const user=$("globalUserName");if(user)user.textContent=name;
  }
  async function request(path,options={}){
        const base=String(CONFIG.apiBaseUrl||"").replace(/\/+$/,"");
    const endpoint=String(path).startsWith("/")?String(path):"/"+path;
    const headers={"Accept":"application/json",...(options.headers||{})};
    const opts={method:options.method||"GET",credentials:CONFIG.credentials||"same-origin",headers};
    if(options.body!==undefined){headers["Content-Type"]="application/json";opts.body=JSON.stringify(options.body);}
    if(typeof CONFIG.getAccessToken==="function"){const token=await CONFIG.getAccessToken();if(token)headers.Authorization=`Bearer ${token}`;}
    if(typeof CONFIG.getCsrfToken==="function"){const token=await CONFIG.getCsrfToken();if(token)headers["X-CSRF-Token"]=token;}
    const response=await fetch(base+endpoint,opts);
    if(response.status===204)return {data:null};
    const raw=await response.text();let payload={};
    try{payload=raw?JSON.parse(raw):{};}catch(_){payload={message:raw||"Unexpected server response"};}
    if(!response.ok){const err=new Error(payload.message||payload.error||`Request failed (${response.status})`);err.status=response.status;err.payload=payload;throw err;}
    return payload;
  }

  async function upload(path,file,fields={}){
    if(!file)throw new Error("Choose a file to upload.");
    const base=String(CONFIG.apiBaseUrl||"").replace(/\/+$/,"");
    const endpoint=String(path).startsWith("/")?String(path):"/"+path;
    const form=new FormData();form.append("file",file);
    Object.entries(fields||{}).forEach(([key,value])=>{if(value!==undefined&&value!==null)form.append(key,String(value));});
    const headers={"Accept":"application/json"};
    if(typeof CONFIG.getAccessToken==="function"){const token=await CONFIG.getAccessToken();if(token)headers.Authorization=`Bearer ${token}`;}
    if(typeof CONFIG.getCsrfToken==="function"){const token=await CONFIG.getCsrfToken();if(token)headers["X-CSRF-Token"]=token;}
    const response=await fetch(base+endpoint,{method:"POST",credentials:CONFIG.credentials||"same-origin",headers,body:form});
    const raw=await response.text();let payload={};try{payload=raw?JSON.parse(raw):{};}catch(_){payload={message:raw||"Unexpected server response"};}
    if(!response.ok){const err=new Error(payload.message||payload.error||`Upload failed (${response.status})`);err.status=response.status;err.payload=payload;throw err;}
    return payload;
  }
  function initCommon(){
    if(!hasEmployeeSession()){window.location.replace(AUTH_URL);return;}
    renderMode();
    const toggle=$("mobileMenuToggle"),sidebar=$("employeeSidebar");
    if(toggle&&sidebar)toggle.addEventListener("click",()=>sidebar.classList.toggle("open"));
    document.addEventListener("click",e=>{if(sidebar&&sidebar.classList.contains("open")&&!sidebar.contains(e.target)&&!toggle?.contains(e.target))sidebar.classList.remove("open");});
    document.querySelectorAll("[data-close-dialog]").forEach(b=>b.addEventListener("click",()=>closeDialog(b.dataset.closeDialog)));
    document.querySelectorAll("dialog.modal").forEach(d=>d.addEventListener("click",e=>{if(e.target===d)d.close();}));
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initCommon);else initCommon();
  window.TALVORA_EMPLOYEE={
    config:CONFIG,request,api:request,upload,notify,escape,formatDate,formatDateTime,statusClass,badge,unwrap,array,openDialog,closeDialog,setBusy,safeInitials,
    safeUrl,getDemoState:()=>null,refreshCommon:renderMode
  };
})();
