(()=>{"use strict";
const TE=window.TALVORA_EMPLOYEE,$=id=>document.getElementById(id),state={documents:[],requirements:[],view:[]},esc=TE.escape;
function daysUntil(date){if(!date)return null;const d=new Date(date+"T00:00:00"),n=new Date();n.setHours(0,0,0,0);return Math.ceil((d-n)/86400000);}
function render(){
 const now=state.documents.filter(x=>x.expiryDate).map(x=>daysUntil(x.expiryDate));
 $("documentCount").textContent=state.documents.length;$("verifiedDocumentCount").textContent=state.documents.filter(x=>x.status==="verified").length;
 $("expiringDocumentCount").textContent=state.documents.filter(x=>{const d=daysUntil(x.expiryDate);return d!==null&&d>=0&&d<=60;}).length;
 $("complianceActionCount").textContent=state.requirements.filter(x=>["action_required","renewal_requested","non_compliant"].includes(x.status)).length;
 $("complianceGrid").innerHTML=state.requirements.length?state.requirements.map(x=>`<article class="compliance-item"><span class="compliance-icon">✓</span><div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><strong>${esc(x.name)}</strong>${TE.badge(x.status)}</div><p>${esc(x.description||"")}</p><div class="item-meta"><span>Jurisdiction: ${esc(x.country||"Not specified")}</span><span>${x.dueDate?"Due / expiry: "+TE.formatDate(x.dueDate):"No due date supplied"}</span></div>${["action_required","non_compliant"].includes(x.status)?`<button class="btn btn-small" data-renewal="${esc(x.id)}">Request review / renewal</button>`:""}</div></article>`).join(""):'<div class="empty-state" style="grid-column:1/-1">No compliance requirements have been assigned.</div>';
 const q=$("documentSearch").value.toLowerCase(),status=$("documentStatusFilter").value,type=$("documentTypeFilter").value;
 state.view=state.documents.filter(x=>(!q||`${x.name} ${x.fileName} ${x.employer}`.toLowerCase().includes(q))&&(!status||x.status===status)&&(!type||x.type===type));
 $("documentList").innerHTML=state.view.length?state.view.map(x=>`<div class="doc-row"><span class="doc-icon">${esc((x.type||"FILE").slice(0,4).toUpperCase())}</span><div class="doc-info"><strong>${esc(x.name)}</strong><span>${esc(x.fileName||"File not specified")} · ${esc(x.employer||"Employee profile")} · Added ${TE.formatDate(x.uploadedAt)}</span><span>${x.expiryDate?"Expires "+TE.formatDate(x.expiryDate):"No expiry date recorded"}</span></div>${TE.badge(x.status)}<button class="btn btn-small" data-view-document="${esc(x.id)}">Details</button></div>`).join(""):'<div class="empty-state"><strong>No documents found</strong>Try changing your filters or upload a document.</div>';
}
async function load(){
 try{const [d,c]=await Promise.all([TE.request("/documents"),TE.request("/compliance")]);state.documents=TE.array(d,"documents");state.requirements=TE.array(c,"requirements");render();}
 catch(e){TE.notify(e.message,"error");$("documentList").innerHTML=`<div class="notice error">${esc(e.message)}</div>`;}
}
function showDocument(id){
 const x=state.documents.find(v=>v.id===id);if(!x)return;
 $("documentDetailBody").innerHTML=`<h2 style="font-size:17px;margin:0 0 5px">${esc(x.name)}</h2><p class="muted">${esc(x.fileName||"File name not recorded")}</p><div class="detail-list"><div class="detail-cell"><span>Document type</span><strong>${esc(x.type||"Other")}</strong></div><div class="detail-cell"><span>Review status</span><strong>${esc(x.status)}</strong></div><div class="detail-cell"><span>Uploaded</span><strong>${TE.formatDate(x.uploadedAt)}</strong></div><div class="detail-cell"><span>Expiry date</span><strong>${TE.formatDate(x.expiryDate)}</strong></div><div class="detail-cell"><span>Employer / record</span><strong>${esc(x.employer||"Employee profile")}</strong></div><div class="detail-cell"><span>File size</span><strong>${x.size?`${(Number(x.size)/1024).toFixed(0)} KB`:"Not recorded"}</strong></div></div>${TE.safeUrl(x.secureUrl)?`<a class="btn btn-primary" href="${esc(TE.safeUrl(x.secureUrl))}" target="_blank" rel="noopener noreferrer">Open secure document ↗</a>`:'<div class="notice">No secure download link is available for this demo record.</div>'}<p class="panel-note mt-12">A document marked verified has been reviewed by an authorized process. Uploading a file alone does not verify its authenticity or compliance status.</p>`;
 $("documentDetailActions").innerHTML='<button class="btn" data-close-dialog="documentDetailDialog">Close</button>';TE.openDialog("documentDetailDialog");
}
$("openUpload").addEventListener("click",()=>{$("documentUploadForm").reset();TE.openDialog("documentUploadDialog");});
$("documentUploadForm").addEventListener("submit",async e=>{
 e.preventDefault();const file=$("documentFile").files[0];if(!file){TE.notify("Choose a document file.","warning");return;}
 const allowed=["application/pdf","image/png","image/jpeg","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
 const ext=file.name.split(".").pop().toLowerCase();
 if(file.size>10*1024*1024){TE.notify("File exceeds the 10 MB upload limit.","warning");return;}
 if(!allowed.includes(file.type)&&!["pdf","png","jpg","jpeg","docx"].includes(ext)){TE.notify("Unsupported file type. Use PDF, PNG, JPG or DOCX.","warning");return;}
 if(!$("documentDeclaration").checked){TE.notify("Please confirm the document declaration.","warning");return;}
 const fields={documentName:$("documentName").value.trim(),documentType:$("documentType").value,expiryDate:$("documentExpiry").value};
 const btn=$("uploadDocumentBtn");TE.setBusy(btn,true,"Uploading…");
 try{const result=TE.unwrap(await TE.upload("/documents/upload",file,fields));TE.closeDialog("documentUploadDialog");if(result.notice)TE.notify(result.notice,"warning");else TE.notify("Document uploaded for review.","success");await load();}
 catch(err){TE.notify(err.message,"error");}finally{TE.setBusy(btn,false);}
});
$("documentList").addEventListener("click",e=>{const b=e.target.closest("[data-view-document]");if(b)showDocument(b.dataset.viewDocument);});
$("complianceGrid").addEventListener("click",async e=>{const b=e.target.closest("[data-renewal]");if(!b)return;if(!confirm("Send a review or renewal request for this compliance requirement?"))return;try{await TE.request(`/compliance/${encodeURIComponent(b.dataset.renewal)}/renewal-request`,{method:"POST",body:{}});TE.notify("Review / renewal request recorded.","success");await load();}catch(err){TE.notify(err.message,"error");}});
["documentSearch","documentStatusFilter","documentTypeFilter"].forEach(id=>$(id).addEventListener(id==="documentSearch"?"input":"change",render));
load();window.TALVORA_DOCUMENTS={refresh:load};
})();
