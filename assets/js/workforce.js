(()=>{'use strict';const cfg=window.S4U_ACCESS_CONFIG;const main=document.querySelector('#main');const names={'dashboard':'Dashboard','lab-accounts':'Lab Accounts','results':'Results','billing':'Billing','documents':'Documents','supplies':'Supplies','testing-order':'Testing Orders','order-history':'Order History','client-directory':'Client Directory','ccf-archive':'CCF Archive','result-delivery':'Result Delivery','supply-alerts':'Supply Alerts','analytics':'Testing Analytics','create-testing-order':'Create Testing Order','specimen-shipment':'Send Collected Tests','support':'Support','consortium':'Consortium','compliance-center':'Compliance Center','client-directory':'Client Directory','ccf-archive':'CCF Archive','result-delivery':'Result Delivery','supply-alerts':'Supply Alerts','analytics':'Testing Analytics','store':'Store & Upgrades'};const routes=Object.entries(names).map(([key,label])=>({key,label,url:'/'+key+'.html'}));let current=(document.body.dataset.portalPage||'dashboard');let activeUser=null,activeIntake=null,activeEntitlement=null;const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const dashboardMarkup=intake=>{
 const state=String(intake?.status||'submitted').toLowerCase(),done=['completed','complete','active','approved'].includes(state),label=done?'Setup completed':state==='submitted'?'Intake received':state==='pending'?'Pending review':state.replaceAll('_',' ');
 const date=intake?.submittedAt?new Date(intake.submittedAt).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}):'Not available';
 const tools=[['Lab Accounts','lab-accounts','Account information'],['Testing Orders','testing-order','Manage testing orders'],['Results','results','Laboratory results'],['Billing','billing','Billing and invoices'],['Documents','documents','Business documents'],['Supplies','supplies','Testing materials'],['Order History','order-history','Past testing orders'],...(activeEntitlement?.features?.lab_account&&activeEntitlement?.preview!==true?[['Client Directory','client-directory','Manage customer contacts'],['CCF Archive','ccf-archive','Released chain-of-custody records'],['Result Delivery','result-delivery','Authorized result delivery requests'],['Supply Alerts','supply-alerts','Monitor reorder thresholds'],['Testing Analytics','analytics','View your testing activity']]:[]),...(activeEntitlement?.features?.consortium?[['Consortium','consortium','Manage eligible pools and service requests']]:[]),...(activeEntitlement?.features?.compliance_docs?[['Compliance Center','compliance-center','Request and download compliance documents']]:[]),['Store & Upgrades','store','View packages and add-on services']];
 return '<div class="dash-intro"><div><small>WORKFORCE ACCOUNT OVERVIEW</small><h2>Lab Account Dashboard</h2><p>Track your onboarding progress and workforce testing operations.</p></div><strong class="dash-status">'+escape(label)+'</strong></div>'+
 '<div id="dashPlan" class="dash-card dash-current-plan" aria-live="polite"><div><small>CURRENT MEMBERSHIP</small><h3>Checking your Lab Account plan…</h3><p>Your active services are verified against your account purchases and subscription status.</p></div><a class="dash-action" href="/store.html">View plan & upgrades</a></div>'+ 
 '<div class="dash-kpis"><div class="dash-kpi"><span>Account setup</span><strong>'+escape(label)+'</strong><small>Verified intake status</small></div><div class="dash-kpi"><span>Intake submitted</span><strong>'+escape(date)+'</strong><small>Business details received</small></div></div>'+
 '<div class="dash-columns"><section class="dash-card"><h3>Account setup progress</h3><div class="dash-step"><b>✓</b><div><strong>Account access verified</strong><span>Secure login confirmed</span></div></div><div class="dash-step"><b>✓</b><div><strong>Business intake received</strong><span>Submitted '+escape(date)+'</span></div></div><div class="dash-step"><b>'+(done?'✓':'3')+'</b><div><strong>Laboratory account provisioning</strong><span>'+(done?'Intake marked completed':'Awaiting account setup confirmation')+'</span></div></div><a class="dash-action" href="/lab-accounts.html">Manage lab accounts →</a></section>'+
 '<section class="dash-card"><h3>Your testing workspace</h3><p class="dash-note">Access your actual orders, shipment information and authorized released results.</p><div class="dash-step"><b>✓</b><div><strong>Account intake '+(done?'completed':'received')+'</strong><span>'+escape(date)+' · '+escape(label)+'</span></div></div><a class="dash-action" href="/testing-order.html">View testing orders</a><a class="dash-action" href="/results.html">View released results</a></section></div>'+
 '<section class="dash-card dash-tools"><h3>Quick access</h3><div class="dash-tool-grid">'+tools.map(t=>'<a href="/'+t[1]+'.html"><strong>'+escape(t[0])+' ↗</strong><span>'+escape(t[2])+'</span></a>').join('')+'</div></section>';
};
async function initDashboardPlan(){
 const root=document.getElementById('dashPlan');if(!root)return;
 try{
  const {data:{session}}=await window.labAccountClient.auth.getSession();
  if(!session)throw Error('Secure session required');
  const response=await fetch(cfg.supabaseUrl+'/functions/v1/lab-portal-store',{
   method:'POST',cache:'no-store',
   headers:{'Content-Type':'application/json',apikey:cfg.supabasePublishableKey,Authorization:'Bearer '+session.access_token},
   body:JSON.stringify({action:'catalog'})
  });
  const d=await response.json().catch(()=>({}));
  if(!response.ok||!d.plan_sku)throw Error(d.error||'Plan information unavailable');
  const label=d.plan_names?.[d.plan_sku]||'Lab Account';
  const ready=(d.features||[]).filter(x=>x.available).length;
  const extra=d.consortium_subscription?.active?' · Consortium subscription active':'';
  const title=root.querySelector('h3'),text=root.querySelector('p');
  if(title)title.textContent=label;
  if(text)text.textContent=ready+' currently available plan capabilities'+extra+'. Open Store & Upgrades to review additional options.';
 }catch(e){
  const title=root.querySelector('h3'),text=root.querySelector('p');
  if(title)title.textContent='Lab Account';
  if(text)text.textContent='Your purchased services are available under Store & Upgrades. '+(String(e?.message||''));
 }
}
const labAccountsMarkup=()=>'<div class="lab-overview"><div class="lab-overview-head"><div><h2>Lab Account Information</h2><p>Business intake submissions and laboratory account setup.</p></div><a class="dash-action" href="/lab-account-intake.html">View intake form →</a></div><div id="labAccountsData" aria-live="polite"><p>Loading your account records…</p></div></div>';
async function loadLabAccounts(){const root=document.querySelector('#labAccountsData');if(!root)return;try{const {data:{session}}=await window.labAccountClient.auth.getSession();if(!session)throw Error('Session expired');const res=await fetch(cfg.supabaseUrl+'/functions/v1/lab-account-overview',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.supabasePublishableKey,Authorization:'Bearer '+session.access_token},body:'{}'});const d=await res.json();if(!res.ok)throw Error(d.error||'Account records unavailable');const records=Array.isArray(d.submissions)?d.submissions:[];const formatDate=s=>s?new Date(s).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}):'Not submitted';root.innerHTML='<div class="dash-kpis"><div class="dash-kpi"><span>Intake submissions</span><strong>'+records.length+'</strong><small>Verified records</small></div><div class="dash-kpi"><span>Lab account provisioning</span><strong>'+((d.provisionedAccounts||[]).length)+'</strong><small>Assigned laboratory account numbers</small></div></div>'+(records.length?records.map(x=>'<article class="dash-card lab-record"><div class="lab-record-header"><div><small>BUSINESS ACCOUNT</small><h3>'+escape(x.businessName||'Business information received')+'</h3></div><span class="dash-status">'+escape(x.status||'Received')+'</span></div><div class="lab-detail-grid"><div><span>Reference</span><strong>'+escape(x.reference||'Not assigned')+'</strong></div><div><span>Submitted</span><strong>'+escape(formatDate(x.submittedAt))+'</strong></div><div><span>DBA</span><strong>'+escape(x.dba||'Not provided')+'</strong></div><div><span>Primary contact</span><strong>'+escape(x.contactName||'Not provided')+'</strong></div><div><span>Contact email</span><strong>'+escape(x.contactEmail||'Not provided')+'</strong></div><div><span>Business phone</span><strong>'+escape(x.businessPhone||'Not provided')+'</strong></div><div><span>Business location</span><strong>'+escape([x.city,x.state].filter(Boolean).join(', ')||'Not provided')+'</strong></div><div><span>Account status</span><strong>'+escape(x.status||'Received')+'</strong></div></div></article>').join(''):'<div class="dash-card"><h3>No intake records found</h3><p>Your account is verified, but no matching business intake submission was returned.</p><a class="dash-action" href="/lab-account-intake.html">Open Lab Account intake →</a></div>')+'<section class="dash-card"><h3>Assigned laboratory account numbers</h3><p>Account numbers assigned to your organization by Workforce testing operations.</p>'+(Array.isArray(d.provisionedAccounts)&&d.provisionedAccounts.length?'<div class="lab-detail-grid">'+d.provisionedAccounts.map(a=>'<div><span>'+escape(a.lab_name||'Laboratory')+' · '+escape((a.account_type||'DOT').replaceAll('_',' ').toUpperCase())+'</span><strong>'+escape(a.account_code||'Not issued')+'</strong><small>'+escape(a.status||'pending')+(a.is_primary?' · Primary':'')+'</small></div>').join('')+'</div>':'<p class="dash-note">Laboratory numbers are pending assignment. Our team will update them after reviewing the intake.</p>')+'</section>';}catch(e){root.innerHTML='<div class="dash-card"><h3>Unable to load Lab Accounts</h3><p>'+escape(e.message||'Please retry.')+'</p><button type="button" id="retryLabAccounts" class="signout">Try again</button></div>';document.querySelector('#retryLabAccounts')?.addEventListener('click',loadLabAccounts)}}

const resultsMarkup=()=>'<div class="results-center"><div class="lab-overview-head"><div><h2>Testing Results</h2><p>View NON-DOT testing progress, verified results, and available MRO reports.</p></div><button type="button" id="refreshResults" class="signout">Refresh results</button></div><div id="resultsNotice" class="results-message" role="status" aria-live="polite">Loading results…</div><div id="resultsContent" hidden><div class="results-stages" id="resultsStages"></div><div class="results-controls"><label>Search results<input type="search" id="resultsSearch" placeholder="Search donor, order, stage or result"></label><label>Workflow stage<select id="resultsStage"><option value="">All stages</option><option>Ordered</option><option>Processing</option><option>At Lab</option><option>MRO Confirmation</option><option>Completed</option></select></label></div><div class="results-table-wrap"><table class="results-table"><thead><tr><th>Donor / Order</th><th>Test date</th><th>Service</th><th>Workflow</th><th>Result</th><th>Actions</th></tr></thead><tbody id="resultsRows"></tbody></table></div><section class="dash-card results-mro"><h3>Official MRO reports</h3><p>Published donor reports and available laboratory documents.</p><div class="results-table-wrap"><table class="results-table"><thead><tr><th>Donor</th><th>Test date</th><th>Workflow</th><th>Document</th></tr></thead><tbody id="mroRows"><tr><td colspan="4">Loading reports…</td></tr></tbody></table></div></section></div></div>';
const resultDate=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(+d)?'—':d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})};
const workflowName=x=>x.workflow_label||({'final_result':'Completed','closed':'Completed','mro_review':'MRO Confirmation','laboratory':'At Lab','collected':'Processing','at_collection':'Processing'}[x.status]||'Ordered');
let resultsCache=[];
async function resultCall(action,extra={}){
 const {data:{session}}=await window.labAccountClient.auth.getSession();
 if(!session)throw Error('Please sign in again.');
 const response=await fetch(cfg.supabaseUrl+'/functions/v1/nondot-employer-results',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.supabasePublishableKey,Authorization:'Bearer '+session.access_token},body:JSON.stringify({action,...extra})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.error)throw Error(data.error||'Unable to load results.');
 return data;
}
function drawResults(){
 const search=document.querySelector('#resultsSearch'),stage=document.querySelector('#resultsStage'),body=document.querySelector('#resultsRows');
 if(!body)return;
 const term=(search?.value||'').trim().toLowerCase(),filter=stage?.value||'';
 const list=resultsCache.filter(x=>(!filter||workflowName(x)===filter)&&(!term||[x.order_number,x.employee?.first_name,x.employee?.last_name,x.testing_panel,x.reason,x.result?.final_status,workflowName(x)].some(v=>String(v||'').toLowerCase().includes(term))));
 body.innerHTML=list.map(x=>'<tr><td><strong>'+escape([x.employee?.first_name,x.employee?.last_name].filter(Boolean).join(' ')||'Donor not assigned')+'</strong><small>'+escape(x.order_number||'—')+'</small></td><td>'+escape(resultDate(x.result?.result_date||x.collected_at||x.created_at))+'</td><td>'+escape(x.charge?.service_name||x.testing_panel||'—')+'</td><td><span class="results-label">'+escape(workflowName(x))+'</span></td><td>'+escape(x.result?.final_status||'Pending')+'</td><td><button type="button" class="results-view" data-result-id="'+escape(x.id)+'">View details</button></td></tr>').join('')||'<tr><td colspan="6" class="results-empty">No records match this search or workflow stage.</td></tr>';
 body.querySelectorAll('[data-result-id]').forEach(button=>button.addEventListener('click',()=>location.href='/result-view.html?id='+encodeURIComponent(button.dataset.resultId)));
}
async function loadMroReports(){
 const body=document.querySelector('#mroRows');if(!body)return;
 try{
 const data=await resultCall('mro_list'),records=Array.isArray(data.records)?data.records:[];
 body.innerHTML=records.map(x=>'<tr><td>'+escape(x.donor_name||'—')+'</td><td>'+escape(resultDate(x.test_date))+'</td><td>'+escape(x.workflow_stage||'—')+'</td><td>'+(x.document_name?'<button type="button" class="results-view" data-mro-id="'+escape(x.id)+'">Download PDF</button>':'Not available')+'</td></tr>').join('')||'<tr><td colspan="4" class="results-empty">No published MRO reports.</td></tr>';
 body.querySelectorAll('[data-mro-id]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;try{const file=await resultCall('mro_document',{id:btn.dataset.mroId,download:true});if(!file.url)throw Error('Report unavailable');const downloadUrl=new URL(file.url);if(!/^https:$/.test(downloadUrl.protocol))throw Error('Invalid secure document URL');window.location.assign(downloadUrl.href)}catch(e){btn.insertAdjacentText('afterend',' '+(e.message||'Unavailable'))}finally{btn.disabled=false}}));
 }catch(e){body.innerHTML='<tr><td colspan="4">'+escape(e.message||'MRO reports unavailable')+'</td></tr>'}
}
async function loadResults(){
 const note=document.querySelector('#resultsNotice'),content=document.querySelector('#resultsContent');if(!note||!content)return;
 note.textContent='Loading results…';content.hidden=true;
 const mroTask=loadMroReports();
 try{
 const response=await resultCall('workspace');
 resultsCache=Array.isArray(response.results)?response.results:[];
 const stages=['Ordered','Processing','At Lab','MRO Confirmation','Completed'];
 document.querySelector('#resultsStages').innerHTML=stages.map((stage,i)=>'<button type="button" data-stage="'+stage+'" class="results-stage"><small>0'+(i+1)+'</small><strong>'+stage+'</strong><span>'+resultsCache.filter(x=>workflowName(x)===stage).length+' records</span></button>').join('');
 document.querySelectorAll('[data-stage]').forEach(button=>button.addEventListener('click',()=>{document.querySelector('#resultsStage').value=button.dataset.stage;drawResults()}));
 document.querySelector('#resultsSearch').oninput=drawResults;document.querySelector('#resultsStage').onchange=drawResults;
 content.hidden=false;note.textContent=resultsCache.length+' testing record(s)';drawResults();
 }catch(e){note.textContent=e.message||'Unable to load testing results.';if(/Employer access was not found/i.test(note.textContent))note.textContent='Your login does not have an active NON-DOT employer results workspace linked yet. Results will appear once that access is configured.'}
}

const billingMarkup=()=>'<div class="billing-center"><div class="lab-overview-head"><div><h2>Workforce Invoices</h2><p>Review invoices sent to your account, payment status and outstanding balances.</p></div><button type="button" id="refreshBilling" class="signout">Refresh invoices</button></div><div id="billingNotice" class="results-message" role="status" aria-live="polite">Loading invoices…</div><div id="billingContent" hidden><div class="dash-kpis" id="billingStats"></div><div class="results-controls"><label>Search invoices<input id="billingSearch" type="search" placeholder="Invoice number, status or customer"></label><label>Status<select id="billingStatus"><option value="">All statuses</option><option value="open">Open</option><option value="paid">Paid</option><option value="past_due">Past due</option><option value="partial">Partially paid</option><option value="void">Void</option></select></label></div><div class="results-table-wrap"><table class="results-table"><thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead><tbody id="billingRows"></tbody></table></div></div></div>';
let billingCache=[];
const billMoney=(n,c='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency:/^[A-Z]{3}$/.test(String(c||'').toUpperCase())?String(c).toUpperCase():'USD'}).format(Number(n)||0);
async function billingCall(invoiceId=''){
 const {data:{session}}=await window.labAccountClient.auth.getSession();
 if(!session)throw Error('Please sign in again.');
 const res=await fetch(cfg.supabaseUrl+'/functions/v1/lab-account-billing',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.supabasePublishableKey,Authorization:'Bearer '+session.access_token},body:JSON.stringify(invoiceId?{invoice_id:invoiceId}:{})});
 const data=await res.json().catch(()=>({}));
 if(!res.ok||data.error)throw Error(data.error||'Unable to load invoices.');
 return data;
}
function drawBilling(){
 const rows=document.querySelector('#billingRows');if(!rows)return;
 const term=(document.querySelector('#billingSearch')?.value||'').trim().toLowerCase(),status=document.querySelector('#billingStatus')?.value||'';
 const shown=billingCache.filter(i=>(!status||String(i.status||'').toLowerCase()===status)&&(!term||[i.invoice_number,i.customer_name,i.status].some(v=>String(v||'').toLowerCase().includes(term))));
 rows.innerHTML=shown.map(i=>'<tr><td><strong>'+escape(i.invoice_number||'Invoice')+'</strong><small>'+escape(i.customer_name||'')+'</small></td><td>'+escape(resultDate(i.issue_date||i.created_at))+'</td><td>'+escape(resultDate(i.due_date))+'</td><td>'+escape(billMoney(i.total,i.currency))+'</td><td>'+escape(billMoney(i.amount_paid,i.currency))+'</td><td>'+escape(billMoney(i.amount_due,i.currency))+'</td><td><span class="results-label">'+escape(String(i.status||'Open').replaceAll('_',' '))+'</span></td><td><button type="button" class="results-view" data-bill-id="'+escape(i.id)+'">View invoice</button></td></tr>').join('')||'<tr><td colspan="8" class="results-empty">No invoices match the selected filters.</td></tr>';
 rows.querySelectorAll('[data-bill-id]').forEach(b=>b.addEventListener('click',()=>location.href='/invoice-view.html?id='+encodeURIComponent(b.dataset.billId)));
}
async function loadBilling(){
 const notice=document.querySelector('#billingNotice'),content=document.querySelector('#billingContent');if(!notice||!content)return;
 notice.textContent='Loading invoices…';content.hidden=true;
 try{
 const data=await billingCall();billingCache=Array.isArray(data.invoices)?data.invoices:[];
 const outstanding=billingCache.filter(i=>Number(i.amount_due)>0&& !['void','uncollectible'].includes(String(i.status).toLowerCase()));
 const currency=billingCache[0]?.currency||'USD';
 document.querySelector('#billingStats').innerHTML=[['Invoices received',billingCache.length,'Sent to your account'],['Outstanding invoices',outstanding.length,'Unpaid balances'],['Outstanding balance',billMoney(outstanding.reduce((s,i)=>s+Number(i.amount_due||0),0),currency),'Amount remaining']].map(([label,value,sub])=>'<div class="dash-kpi"><span>'+escape(label)+'</span><strong>'+escape(value)+'</strong><small>'+escape(sub)+'</small></div>').join('');
 document.querySelector('#billingSearch').oninput=drawBilling;document.querySelector('#billingStatus').onchange=drawBilling;
 content.hidden=false;notice.textContent=billingCache.length?billingCache.length+' invoice(s) available':'No invoices have been sent to your account yet.';drawBilling();
 }catch(e){notice.textContent=e.message||'Unable to load invoices.'}
}


const documentsMarkup=()=>'<div class="results-center"><div class="lab-overview-head"><div><h2>Account documents</h2><p>View and securely download documents available to your Lab Account.</p></div><button type="button" id="refreshDocuments" class="signout">Refresh documents</button></div><div id="documentsNotice" class="results-message" role="status" aria-live="polite">Loading documents…</div><div id="documentsContent" hidden><div class="dash-kpis" id="documentsStats"></div><div class="results-controls"><label>Search documents<input id="documentsSearch" type="search" placeholder="Search title, type or description"></label><label>Document type<select id="documentsType"><option value="">All types</option></select></label></div><div class="results-table-wrap"><table class="results-table"><thead><tr><th>Document</th><th>Type</th><th>Date added</th><th>Size</th><th>Action</th></tr></thead><tbody id="documentsRows"></tbody></table></div></div></div>';
let documentsCache=[];
async function documentsCall(action,extra={}){
 const {data:{session}}=await window.labAccountClient.auth.getSession();if(!session)throw Error('Please sign in again.');
 const response=await fetch(cfg.supabaseUrl+'/functions/v1/lab-account-documents',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.supabasePublishableKey,Authorization:'Bearer '+session.access_token},body:JSON.stringify({action,...extra})});
 const data=await response.json().catch(()=>({}));if(!response.ok||data.error)throw Error(data.error||'Documents unavailable.');return data;
}
const documentSize=v=>{const n=Number(v);return !Number.isFinite(n)||n<0?'—':n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB'};
function drawDocuments(){
 const body=document.querySelector('#documentsRows');if(!body)return;
 const term=(document.querySelector('#documentsSearch')?.value||'').trim().toLowerCase(),type=document.querySelector('#documentsType')?.value||'';
 const list=documentsCache.filter(x=>(!type||String(x.document_type||'General')===type)&&(!term||[x.title,x.description,x.document_type].some(v=>String(v||'').toLowerCase().includes(term))));
 body.innerHTML=list.map(x=>'<tr><td><strong>'+escape(x.title||'Untitled document')+'</strong><small>'+escape(x.description||'')+'</small></td><td>'+escape(x.document_type||'General')+'</td><td>'+escape(resultDate(x.created_at))+'</td><td>'+escape(documentSize(x.file_size))+'</td><td>'+(x.downloadable?'<button type="button" class="results-view" data-document-id="'+escape(x.id)+'">View</button> <button type="button" class="results-view" data-download-id="'+escape(x.id)+'">Download</button>':'File unavailable')+'</td></tr>').join('')||'<tr><td colspan="5" class="results-empty">No documents match this search.</td></tr>';
 body.querySelectorAll('[data-download-id]').forEach(btn=>btn.addEventListener('click',()=>{const target=body.querySelector('[data-document-id="'+btn.dataset.downloadId+'"]');if(target){target.dataset.downloadMode='1';target.click()}}));
 body.querySelectorAll('[data-document-id]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;try{const item=documentsCache.find(x=>x.id===btn.dataset.documentId);const d=await documentsCall(item?.source==='intake'?'intake':'download',{id:btn.dataset.documentId,source:item?.source});if(item?.source==='intake'){const txt=JSON.stringify(d.intake,null,2);const url=URL.createObjectURL(new Blob([txt],{type:'application/json'}));if(btn.dataset.downloadMode==='1'){const a=document.createElement('a');a.href=url;a.download='lab-account-intake.json';a.click()}else window.open(url,'_blank');btn.dataset.downloadMode='';return}if(!d.url)throw Error('Document unavailable');if(btn.dataset.downloadMode==='1'){const a=document.createElement('a');a.href=d.url;a.download=item?.title||'document';a.target='_blank';a.rel='noopener';a.click()}else window.open(d.url,'_blank','noopener,noreferrer');btn.dataset.downloadMode=''}catch(e){const note=document.querySelector('#documentsNotice');if(note)note.textContent=e.message||'Unable to open document'}finally{btn.disabled=false}}));
}
async function loadDocuments(){
 const note=document.querySelector('#documentsNotice'),content=document.querySelector('#documentsContent');if(!note||!content)return;
 note.textContent='Loading documents…';content.hidden=true;
 try{
 const data=await documentsCall('list');documentsCache=Array.isArray(data.documents)?data.documents:[];
 const types=[...new Set(documentsCache.map(x=>String(x.document_type||'General')))].sort();
 const select=document.querySelector('#documentsType');select.innerHTML='<option value="">All types</option>'+types.map(t=>'<option value="'+escape(t)+'">'+escape(t)+'</option>').join('');
 document.querySelector('#documentsStats').innerHTML=[['Documents',documentsCache.length,'Account records'],['Available files',documentsCache.filter(x=>x.downloadable).length,'Ready for viewing'],['Document types',types.length,'Available categories']].map(([a,b,c])=>'<div class="dash-kpi"><span>'+escape(a)+'</span><strong>'+escape(b)+'</strong><small>'+escape(c)+'</small></div>').join('');
 document.querySelector('#documentsSearch').oninput=drawDocuments;select.onchange=drawDocuments;content.hidden=false;note.textContent=documentsCache.length?documentsCache.length+' document(s) available':'No documents are available to your account yet.';drawDocuments();
 }catch(e){note.textContent=e.message||'Unable to load documents.'}
}


const suppliesMarkup=()=>'<div class="supplies-center"><div class="lab-overview-head"><div><h2>Shipping Supplies</h2><p>Request approved testing supplies, check inventory and track shipments.</p></div><button class="signout" id="supplyRefresh" type="button">Refresh</button></div><div class="results-message" id="supplyNotice" role="status">Loading supplies…</div><div id="supplyContent" hidden><div class="dash-kpis" id="supplyStats"></div><section class="dash-card"><h3>House Lab Account setup shipments</h3><p class="dash-note">Shipment details entered by Workforce testing operations are shown here.</p><div id="houseLabShipments"></div></section><div class="dash-columns"><section class="dash-card"><h3>Approved supply catalog</h3><label class="supply-search">Search supplies<input id="supplySearch" type="search" placeholder="Search name or SKU"></label><div id="supplyCatalog"></div><button id="supplyReview" type="button" class="supply-primary">Review supply request</button></section><section class="dash-card"><h3>My current inventory</h3><div id="supplyInventory"></div><p class="dash-note">Supply availability and shipment processing are managed by Workforce testing operations.</p></section></div><section class="dash-card"><div class="lab-overview-head"><div><h3>My orders & shipments</h3><p>Shipment status and tracking details.</p></div><select id="supplyStatus"><option value="">All orders</option><option value="requested">Requested</option><option value="approved">Approved</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></div><div class="results-table-wrap"><table class="results-table"><thead><tr><th>Submitted</th><th>Items</th><th>Status</th><th>Carrier</th><th>Tracking</th><th>Action</th></tr></thead><tbody id="supplyOrders"></tbody></table></div></section></div></div>';
let supplyItems=[],supplyOrders=[],supplyInventory=[],houseShipments=[],supplyCart=new Map();
async function supplyCall(action,other={}){
 const {data:{session}}=await window.labAccountClient.auth.getSession();if(!session)throw Error('Please sign in again.');
 const r=await fetch(cfg.supabaseUrl+'/functions/v1/lab-account-supplies',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.supabasePublishableKey,Authorization:'Bearer '+session.access_token},body:JSON.stringify({action,...other})});
 const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw Error(d.error||'Supply request unavailable');return d;
}
function renderSupplies(){
 const search=(document.querySelector('#supplySearch')?.value||'').toLowerCase(),status=document.querySelector('#supplyStatus')?.value||'';
 document.querySelector('#supplyStats').innerHTML=[['Catalog items',supplyItems.length],['Supply orders',supplyOrders.length],['Pending shipment',supplyOrders.filter(x=>['requested','approved','packing'].includes(x.status)).length],['Shipped / delivered',supplyOrders.filter(x=>['shipped','delivered'].includes(x.status)).length]].map(([label,n])=>'<div class="dash-kpi"><span>'+escape(label)+'</span><strong>'+n+'</strong></div>').join('');
 document.querySelector('#houseLabShipments').innerHTML=houseShipments.length?houseShipments.map(x=>'<div class="supply-stock"><div><strong>'+escape(x.items_description||'House lab supply shipment')+'</strong><small style="display:block">'+escape(x.carrier||'Carrier pending')+' · '+escape(x.status||'preparing')+'</small><span style="display:block">Tracking: '+escape(x.tracking_number||'Not assigned yet')+'</span></div>'+(x.tracking_url&&/^https:\/\//i.test(x.tracking_url)?'<a class="dash-action" href="'+escape(x.tracking_url)+'" target="_blank" rel="noopener noreferrer">Track shipment</a>':'')+(x.status==='shipped'?'<button type="button" class="dash-action" data-house-delivery="'+escape(x.id)+'">Confirm supplies received</button>':'')+'</div>').join(''):'<p class="dash-note">No House Lab Account supplies have been shipped yet.</p>';
 document.querySelector('#supplyCatalog').innerHTML=supplyItems.filter(x=>[x.name,x.sku,x.description].join(' ').toLowerCase().includes(search)).map(x=>'<div class="supply-item"><div><small>'+escape(x.sku||'Supply')+' · '+escape(x.unit||'unit')+'</small><strong>'+escape(x.name)+'</strong><p>'+escape(x.description||'')+'</p></div><label>Quantity<input type="number" min="0" max="1000" step="1" data-supply-qty="'+escape(x.id)+'" value="'+(supplyCart.get(x.id)||0)+'"></label></div>').join('')||'<p>No approved supplies match your search.</p>';
 document.querySelector('#supplyInventory').innerHTML=supplyInventory.map(x=>'<div class="supply-stock"><span>'+escape(supplyItems.find(i=>i.id===x.item_id)?.name||'Supply')+'</span><strong>'+escape(x.quantity_on_hand||0)+' on hand</strong></div>').join('')||'<p>No inventory quantities recorded.</p>';
 document.querySelector('#supplyOrders').innerHTML=supplyOrders.filter(x=>!status||x.status===status).map(x=>'<tr><td>'+escape(resultDate(x.created_at))+'</td><td>'+escape((x.ic_portal_supply_order_lines||[]).map(l=>(supplyItems.find(i=>i.id===l.item_id)?.name||'Supply')+' × '+l.quantity).join(', ')||'Supply order')+'</td><td><span class="results-label">'+escape(x.status||'')+'</span></td><td>'+escape(x.carrier||'—')+'</td><td>'+escape(x.tracking_number||'Not issued')+'</td><td>'+(x.status==='requested'?'<button class="results-view" type="button" data-supply-cancel="'+escape(x.id)+'">Cancel</button>':'—')+'</td></tr>').join('')||'<tr><td class="results-empty" colspan="6">No supply orders found.</td></tr>';
}
async function loadSupplies(){
 const n=document.querySelector('#supplyNotice'),c=document.querySelector('#supplyContent');n.textContent='Loading supplies…';
 try{const d=await supplyCall('workspace');supplyItems=d.supplies||[];supplyOrders=d.orders||[];supplyInventory=d.inventory||[];houseShipments=d.houseShipments||[];renderSupplies();c.hidden=false;n.textContent=supplyItems.length+' approved supply item(s) available.'}catch(e){n.textContent=e.message||'Unable to load supplies'}
}
function initSupplies(){
 const $=id=>document.getElementById(id);$('supplyRefresh').onclick=loadSupplies;$('supplySearch').oninput=renderSupplies;$('supplyStatus').onchange=renderSupplies;
 $('supplyCatalog').onchange=e=>{const i=e.target.closest('[data-supply-qty]');if(!i)return;const q=Number(i.value);if(!Number.isInteger(q)||q<0||q>1000){i.value='0';return}if(q)supplyCart.set(i.dataset.supplyQty,q);else supplyCart.delete(i.dataset.supplyQty)};
 $('supplyReview').onclick=()=>{if(!supplyCart.size){$('supplyNotice').textContent='Choose supply quantities first.';return}sessionStorage.setItem('workforce_supply_request',JSON.stringify([...supplyCart].map(([item_id,quantity])=>({item_id,quantity}))));location.href='/supply-request.html'};

 $('houseLabShipments').onclick=async e=>{
   const button=e.target.closest('[data-house-delivery]');if(!button)return;
   button.disabled=true;
   try{await supplyCall('confirm_house_delivery',{id:button.dataset.houseDelivery});$('supplyNotice').textContent='Supply delivery confirmed. Your House Lab Account shipment status is now Delivered.';await loadSupplies()}
   catch(error){$('supplyNotice').textContent=error.message||'Unable to confirm delivery';button.disabled=false}
 };
 $('supplyOrders').onclick=async e=>{const b=e.target.closest('[data-supply-cancel]');if(!b)return;b.disabled=true;try{await supplyCall('cancel',{id:b.dataset.supplyCancel});await loadSupplies()}catch(err){$('supplyNotice').textContent=err.message;b.disabled=false}};

 loadSupplies();
}


const testingOrdersMarkup=()=>'<div class="results-center"><div class="lab-overview-head"><div><h2>Testing Orders</h2><p>Track testing orders, collection progress and donor passes.</p><a class="dash-action" href="/create-testing-order.html">+ Create Testing Order</a><a class="dash-action" href="/specimen-shipment.html">Report specimen shipment</a></div><button type="button" class="signout" id="refreshTestingOrders">Refresh orders</button></div><div class="results-message" id="testingOrdersNotice" role="status">Loading testing orders…</div><div id="testingOrdersContent" hidden><div class="dash-kpis" id="testingOrdersStats"></div><div class="results-controls"><label>Search orders<input type="search" id="testingOrdersSearch" placeholder="Search donor, order or test"></label><label>Order status<select id="testingOrdersStatus"><option value="">All statuses</option></select></label></div><div class="results-table-wrap"><table class="results-table"><thead><tr><th>Order / donor</th><th>Testing service</th><th>Reason</th><th>Created</th><th>Collection deadline</th><th>Status</th><th>Action</th></tr></thead><tbody id="testingOrdersRows"></tbody></table></div></div></div>';
let testingOrdersCache=[];
async function testingOrdersCall(){
const {data:{session}}=await window.labAccountClient.auth.getSession();if(!session)throw Error('Please sign in again.');
const r=await fetch(cfg.supabaseUrl+'/functions/v1/lab-account-testing-orders',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.supabasePublishableKey,Authorization:'Bearer '+session.access_token},body:'{}'});
const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw Error(d.error||'Testing orders unavailable');return d;
}
function testingStatus(s){return String(s||'Pending').replaceAll('_',' ')}
function drawTestingOrders(){
const q=(document.querySelector('#testingOrdersSearch')?.value||'').trim().toLowerCase(),status=document.querySelector('#testingOrdersStatus')?.value||'',body=document.querySelector('#testingOrdersRows');if(!body)return;
const filtered=testingOrdersCache.filter(x=>(!status||x.status===status)&&(!q||[x.case_number,x.donor_name,x.test_type,x.panel_name,x.test_reason,x.status,x.donor_pass_number].some(v=>String(v||'').toLowerCase().includes(q))));
body.innerHTML=filtered.map(x=>'<tr><td><strong>'+escape(x.case_number||'Order')+'</strong><small>'+escape(x.donor_name||'Donor not assigned')+'</small></td><td>'+escape(x.panel_name||x.test_type||'—')+'</td><td>'+escape(x.test_reason||'—')+'</td><td>'+escape(resultDate(x.created_at))+'</td><td>'+escape(resultDate(x.collection_deadline))+'</td><td><span class="results-label">'+escape(testingStatus(x.status))+'</span></td><td><button type="button" class="results-view" data-testing-id="'+escape(x.id)+'">View details</button></td></tr>').join('')||'<tr><td colspan="7" class="results-empty">No testing orders match this search.</td></tr>';
body.querySelectorAll('[data-testing-id]').forEach(b=>b.onclick=()=>location.href='/testing-order-view.html?id='+encodeURIComponent(b.dataset.testingId));
}
async function loadTestingOrders(){
const note=document.querySelector('#testingOrdersNotice'),content=document.querySelector('#testingOrdersContent');note.textContent='Loading testing orders…';
try{const d=await testingOrdersCall();testingOrdersCache=Array.isArray(d.orders)?d.orders:[];const statuses=[...new Set(testingOrdersCache.map(x=>x.status).filter(Boolean))].sort();document.querySelector('#testingOrdersStatus').innerHTML='<option value="">All statuses</option>'+statuses.map(x=>'<option value="'+escape(x)+'">'+escape(testingStatus(x))+'</option>').join('');document.querySelector('#testingOrdersStats').innerHTML=[['Testing orders',testingOrdersCache.length],['In progress',testingOrdersCache.filter(x=>!['completed','cancelled','closed'].includes(x.status)).length],['Completed',testingOrdersCache.filter(x=>['completed','closed'].includes(x.status)).length]].map(([k,v])=>'<div class="dash-kpi"><span>'+escape(k)+'</span><strong>'+v+'</strong></div>').join('');document.querySelector('#testingOrdersSearch').oninput=drawTestingOrders;document.querySelector('#testingOrdersStatus').onchange=drawTestingOrders;content.hidden=false;note.textContent=testingOrdersCache.length+' testing order(s) available';drawTestingOrders()}catch(e){note.textContent=e.message||'Unable to load testing orders'}
}


const specimenShipmentMarkup=()=>'<div class="results-center"><div class="lab-overview-head"><div><h2>Report Collected Specimens Shipped</h2><p>Report physical shipment of specimens after collection. Laboratory receipt is verified separately by Workforce testing operations.</p></div><a class="dash-action" href="/testing-order.html">Testing Orders</a></div><p class="results-message" id="specimenShipmentMessage" role="status">Loading eligible collected testing orders…</p><form id="specimenShipmentForm" class="record-form" hidden><div class="record-field-grid"><label>Collected testing order<select name="id" required id="shipmentCaseSelect"><option value="">Select collected testing case</option></select></label><label>Carrier<input name="carrier" required maxlength="100" placeholder="UPS, FedEx, USPS…"></label><label>Tracking number<input name="tracking_number" required minlength="4" maxlength="180"></label><label>Tracking URL (optional, HTTPS only)<input name="tracking_url" type="url" placeholder="https://..." maxlength="1000"></label></div><p class="dash-note">Only cases with confirmed collection can be reported as shipped. This does not generate a Labcorp registration or confirm laboratory receipt.</p><button type="submit" class="dash-action">Report shipment to Workforce</button></form></div>';
async function initSpecimenShipment(){
 const note=document.getElementById('specimenShipmentMessage'),form=document.getElementById('specimenShipmentForm'),select=document.getElementById('shipmentCaseSelect');if(!note||!form||!select)return;
 try{
  const data=await testingOrdersCall();
  const eligible=(data.orders||[]).filter(x=>x.status==='collected'&&x.collected_at);
  select.innerHTML='<option value="">Select collected testing case</option>'+eligible.map(x=>'<option value="'+escape(x.id)+'">'+escape(x.case_number||'Case')+' — '+escape(x.donor_name||'Donor')+' — '+escape(x.panel_name||x.test_type||'Test')+'</option>').join('');
  const requested=new URLSearchParams(location.search).get('id');
  if(requested&&eligible.some(x=>x.id===requested))select.value=requested;
  form.hidden=eligible.length===0;
  note.textContent=eligible.length?eligible.length+' collected testing case(s) ready for shipment reporting.':'No collected testing cases are eligible. Collection must be confirmed before shipment can be recorded.';
  form.onsubmit=async event=>{
   event.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;
   try{
    const {data:{session}}=await window.labAccountClient.auth.getSession();if(!session)throw Error('Please sign in again.');
    const info=Object.fromEntries(new FormData(form).entries());
    const r=await fetch(cfg.supabaseUrl+'/functions/v1/lab-account-testing-orders',{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.supabasePublishableKey,'Authorization':'Bearer '+session.access_token},body:JSON.stringify({action:'mark_sent',...info})});
    const response=await r.json().catch(()=>({}));if(!r.ok||response.error)throw Error(response.error||'Unable to report shipment.');
    form.hidden=true;note.textContent='Shipment reported for '+(response.shipment?.case_number||'testing case')+'. Status: in transit. Laboratory receipt has NOT yet been confirmed.';
   }catch(error){note.textContent=error.message||'Shipment could not be reported';button.disabled=false}
  };
 }catch(error){note.textContent=error.message||'Unable to load collected testing cases'}
}
const orderHistoryMarkup=()=>'<div class="results-center"><div class="lab-overview-head"><div><h2>Order History</h2><p>Review purchases, payment status and order fulfillment.</p></div><button type="button" class="signout" id="refreshOrderHistory">Refresh orders</button></div><div class="results-message" id="orderHistoryNotice" role="status">Loading order history…</div><div id="orderHistoryContent" hidden><div class="dash-kpis" id="orderHistoryStats"></div><div class="results-controls"><label>Search orders<input id="orderHistorySearch" type="search" placeholder="Order number, service or company"></label><label>Order status<select id="orderHistoryStatus"><option value="">All statuses</option></select></label></div><div class="results-table-wrap"><table class="results-table"><thead><tr><th>Order</th><th>Placed</th><th>Services</th><th>Total</th><th>Payment</th><th>Fulfillment</th><th>Action</th></tr></thead><tbody id="orderHistoryRows"></tbody></table></div></div></div>';
let orderHistoryCache=[];
async function orderHistoryCall(){
 const {data:{session}}=await window.labAccountClient.auth.getSession();if(!session)throw Error('Please sign in again.');
 const r=await fetch(cfg.supabaseUrl+'/functions/v1/lab-account-order-history',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.supabasePublishableKey,Authorization:'Bearer '+session.access_token},body:'{}'});
 const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw Error(d.error||'Unable to load order history');return d;
}
function drawOrderHistory(){
 const tbody=document.querySelector('#orderHistoryRows');if(!tbody)return;
 const term=(document.querySelector('#orderHistorySearch')?.value||'').trim().toLowerCase(),status=document.querySelector('#orderHistoryStatus')?.value||'';
 const shown=orderHistoryCache.filter(x=>(!status||x.status===status)&&(!term||[x.order_number,x.company_name,x.status,...(x.items||[]).map(i=>i.name)].some(v=>String(v||'').toLowerCase().includes(term))));
 tbody.innerHTML=shown.map(x=>'<tr><td><strong>'+escape(x.order_number||'Order')+'</strong><small>'+escape(x.company_name||'')+'</small></td><td>'+escape(resultDate(x.created_at))+'</td><td>'+escape((x.items||[]).map(i=>i.name).join(', ')||'—')+'</td><td>'+escape(billMoney(x.total,x.currency))+'</td><td><span class="results-label">'+escape(String(x.payment_status||'Pending').replaceAll('_',' '))+'</span></td><td>'+escape(String(x.fulfillment_status||x.status||'Pending').replaceAll('_',' '))+'</td><td><button type="button" class="results-view" data-history-id="'+escape(x.id)+'">View details</button></td></tr>').join('')||'<tr><td colspan="7" class="results-empty">No orders match this search.</td></tr>';
 tbody.querySelectorAll('[data-history-id]').forEach(b=>b.onclick=()=>location.href='/order-view.html?id='+encodeURIComponent(b.dataset.historyId));
}
async function loadOrderHistory(){
 const note=document.querySelector('#orderHistoryNotice'),content=document.querySelector('#orderHistoryContent');note.textContent='Loading order history…';
 try{const d=await orderHistoryCall();orderHistoryCache=Array.isArray(d.orders)?d.orders:[];const statuses=[...new Set(orderHistoryCache.map(x=>x.status).filter(Boolean))].sort();document.querySelector('#orderHistoryStatus').innerHTML='<option value="">All statuses</option>'+statuses.map(x=>'<option value="'+escape(x)+'">'+escape(x.replaceAll('_',' '))+'</option>').join('');document.querySelector('#orderHistoryStats').innerHTML=[['Total orders',orderHistoryCache.length],['Paid orders',orderHistoryCache.filter(x=>['paid','succeeded'].includes(String(x.payment_status).toLowerCase())).length],['Fulfilled orders',orderHistoryCache.filter(x=>['fulfilled','completed','delivered'].includes(String(x.fulfillment_status).toLowerCase())).length]].map(([k,v])=>'<div class="dash-kpi"><span>'+escape(k)+'</span><strong>'+v+'</strong></div>').join('');document.querySelector('#orderHistorySearch').oninput=drawOrderHistory;document.querySelector('#orderHistoryStatus').onchange=drawOrderHistory;content.hidden=false;note.textContent=orderHistoryCache.length+' order(s) available';drawOrderHistory()}catch(e){note.textContent=e.message||'Unable to load order history'}
}


const newTestingOrderMarkup=()=>'<div class="results-center"><div class="lab-overview-head"><div><h2>Create Testing Order</h2><p>Select a testing service and submit donor information for processing by Workforce Testing Management.</p></div><a class="dash-action" href="/testing-order.html">View Testing Orders →</a></div><div id="newOrderNotice" class="results-message" role="status">Loading testing services…</div><form id="newOrderForm" class="new-order-form" hidden><div class="dash-card"><h3>Testing service</h3><label>Available test<select name="service_id" id="newOrderService" required><option value="">Choose a test</option></select></label><p id="newOrderServiceInfo" class="dash-note"></p></div><div class="dash-card"><h3>Donor information</h3><div class="new-order-grid"><label>First name<input name="first_name" required maxlength="100" autocomplete="given-name"></label><label>Last name<input name="last_name" required maxlength="100" autocomplete="family-name"></label><div class="dob-field"><span class="dob-label">Date of birth</span><div class="dob-controls"><select name="birth_month" aria-label="Birth month" required><option value="">Month</option><option value="01">January</option><option value="02">February</option><option value="03">March</option><option value="04">April</option><option value="05">May</option><option value="06">June</option><option value="07">July</option><option value="08">August</option><option value="09">September</option><option value="10">October</option><option value="11">November</option><option value="12">December</option></select><select name="birth_day" aria-label="Birth day" required><option value="">Day</option><option value="01">1</option><option value="02">2</option><option value="03">3</option><option value="04">4</option><option value="05">5</option><option value="06">6</option><option value="07">7</option><option value="08">8</option><option value="09">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option><option value="13">13</option><option value="14">14</option><option value="15">15</option><option value="16">16</option><option value="17">17</option><option value="18">18</option><option value="19">19</option><option value="20">20</option><option value="21">21</option><option value="22">22</option><option value="23">23</option><option value="24">24</option><option value="25">25</option><option value="26">26</option><option value="27">27</option><option value="28">28</option><option value="29">29</option><option value="30">30</option><option value="31">31</option></select><input name="birth_year" aria-label="Four-digit birth year" type="text" inputmode="numeric" autocomplete="bday-year" placeholder="YYYY" maxlength="4" minlength="4" pattern="[0-9]{4}" required></div></div><label>Donor email<input name="donor_email" type="email" required autocomplete="email"></label><label>Donor phone<input name="donor_phone" type="tel" maxlength="35"></label><label>State of residence<input name="state_of_residence" required maxlength="2" pattern="[A-Za-z]{2}" placeholder="IL"></label><label>Reason for test<select name="reason_for_test" required><option value="">Choose reason</option><option value="PE">Pre-employment</option><option value="RN">Random</option><option value="PA">Post-accident</option><option value="RS">Reasonable suspicion</option><option value="RT">Return to duty</option><option value="FU">Follow-up</option><option value="NI">Other / not indicated</option></select></label><label id="newOrderAuthorityField" hidden>DOT authority<select name="testing_authority"><option value="">Choose authority</option><option>FMCSA</option><option>FAA</option><option>FRA</option><option>FTA</option><option>PHMSA</option><option>USCG</option></select></label></div><label>Notes for Testing Management<textarea name="notes" rows="3" maxlength="1000"></textarea></label></div><p>Orders submitted here are reviewed through Workforce testing operations. A donor pass becomes available only after the laboratory registration and issuance process has completed.</p><button type="submit" class="supply-primary" id="newOrderSubmit">Submit testing order</button></form><section class="dash-card"><div class="lab-overview-head"><div><h3>Issued donor passes</h3><p>Download or print passes once issued by Testing Management.</p></div><button class="signout" id="newOrderRefreshPasses" type="button">Refresh passes</button></div><div id="newOrderPasses" aria-live="polite">Loading donor passes…</div></section></div>';
let newOrderCatalog=[];
async function newOrderCall(action,more={}){
 const {data:{session}}=await window.labAccountClient.auth.getSession();if(!session)throw Error('Please sign in again.');
 const r=await fetch(cfg.supabaseUrl+'/functions/v1/lab-account-create-testing-order',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.supabasePublishableKey,Authorization:'Bearer '+session.access_token},body:JSON.stringify({action,...more})});
 const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw Error(d.error||'Testing order unavailable');return d;
}
async function refreshOrderPasses(){
 const host=document.getElementById('newOrderPasses');host.textContent='Loading donor passes…';
 try{const d=await newOrderCall('passes');const a=d.passes||[];host.innerHTML=a.length?a.map(p=>'<article class="new-order-pass"><div><strong>'+escape(p.pass_number||'Issued donor pass')+'</strong><small>'+escape(p.donor_name||'')+' · '+escape(p.test_type||'')+'</small><small>'+escape(p.collection_site_name||'Collection site pending')+'</small></div><button type="button" class="results-view" data-print-pass="'+escape(p.id)+'">Print pass</button></article>').join(''):'<p>No issued donor passes are available yet.</p>';host.querySelectorAll('[data-print-pass]').forEach(b=>b.onclick=()=>location.href='/donor-pass-view.html?id='+encodeURIComponent(b.dataset.printPass))}catch(e){host.textContent=e.message||'Unable to load donor passes'}
}
async function initNewTestingOrder(){
 const notice=document.getElementById('newOrderNotice'),form=document.getElementById('newOrderForm'),select=document.getElementById('newOrderService');
 try{const d=await newOrderCall('catalog');newOrderCatalog=d.services||[];select.innerHTML='<option value="">Choose a test</option>'+newOrderCatalog.map(x=>'<option value="'+escape(x.id)+'">'+escape(x.name)+'</option>').join('');form.hidden=false;notice.textContent=newOrderCatalog.length+' testing services available.'}catch(e){notice.textContent=e.message||'Unable to load test catalog'}
 select.onchange=()=>{const x=newOrderCatalog.find(y=>y.id===select.value);document.getElementById('newOrderServiceInfo').textContent=x?(x.description||'')+(x.labcorp_eligible?' · Labcorp eligible':''):'';const field=document.getElementById('newOrderAuthorityField');field.hidden=x?.testing_scope!=='dot';field.querySelector('select').required=!field.hidden};
 form.elements.namedItem('birth_year').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,4);e.target.setCustomValidity('')});
 form.onsubmit=async e=>{e.preventDefault();const btn=document.getElementById('newOrderSubmit');btn.disabled=true;notice.textContent='Submitting testing order…';try{const d=Object.fromEntries(new FormData(form).entries());const month=String(d.birth_month||''),day=String(d.birth_day||''),year=String(d.birth_year||'');const date=/^\d{4}$/.test(year)&&/^\d{2}$/.test(month)&&/^\d{2}$/.test(day)?new Date(Date.UTC(Number(year),Number(month)-1,Number(day))):null;const valid=date&&Number(year)>=1900&&date.getUTCFullYear()===Number(year)&&date.getUTCMonth()===Number(month)-1&&date.getUTCDate()===Number(day)&&date.getTime()<=Date.now();if(!valid){const input=form.elements.namedItem('birth_year');input.setCustomValidity('Enter a valid birthdate with a four-digit year.');input.reportValidity();return}d.date_of_birth=year+'-'+month+'-'+day;delete d.birth_month;delete d.birth_day;delete d.birth_year;const result=await newOrderCall('create',d);notice.textContent='Testing order '+(result.case?.case_number||'')+' submitted to Testing Management. Labcorp registration and donor pass are pending processing.';form.reset();document.getElementById('newOrderAuthorityField').hidden=true;await refreshOrderPasses()}catch(err){notice.textContent=err.message||'Unable to submit testing order'}finally{btn.disabled=false}};
 document.getElementById('newOrderRefreshPasses').onclick=refreshOrderPasses;refreshOrderPasses();
}


const supportMarkup=()=>'<div class="support-shell"><div class="lab-overview-head"><div><h2>Support Center</h2><p>Submit a request, track progress, and communicate with Workforce Support.</p></div><button class="signout" id="supportRefresh" type="button">Refresh tickets</button></div><div class="results-message" id="supportNotice" role="status">Loading support tickets…</div><div class="support-metrics" id="supportMetrics"></div><div class="support-grid"><section class="dash-card support-request-card"><div class="support-card-header"><div><h3>Create a Support Request</h3><p>Send a detailed request directly to Workforce Support.</p></div><span class="support-tag">Workforce Support</span></div><form id="supportCreate" class="support-form"><div class="support-form-grid"><label>Issue type<select name="category" required><option value="">Choose an issue type</option><option value="portal_access">Portal access / login</option><option value="testing">Testing orders</option><option value="results">Results / compliance</option><option value="documents">Documents / reports</option><option value="billing">Billing / subscription</option><option value="supplies">Supplies</option><option value="technical">Technical error</option><option value="general">Other</option></select></label><label>Priority<select name="priority" required><option value="normal">Normal</option><option value="high">High — blocking work</option><option value="urgent">Urgent — business critical</option><option value="low">Low — question / request</option></select></label><label class="full">Subject<input name="subject" maxlength="180" required></label><label class="full">What happened?<textarea name="message" rows="5" maxlength="5000" required></textarea></label><label>Preferred contact<select name="preferred_contact"><option value="email">Email</option><option value="portal">Portal update</option></select></label><label>Reply-to email<input id="supportReplyEmail" type="email" readonly></label><div class="full support-diagnostics"><strong>Page & Error Details</strong><small>Include details that help support reproduce your issue.</small><label>Page URL<input name="page_url" id="supportPageUrl" placeholder="https://…"></label><label>Console / error message<textarea name="console_error" rows="3" maxlength="2000" placeholder="Paste an error message here"></textarea></label></div></div><p class="dash-note">Do not include passwords, Social Security numbers, or sensitive medical details.</p><button type="submit" class="supply-primary">Submit Support Request</button></form></section><aside class="support-aside"><section class="dash-card"><h3>Quick Help</h3><div class="support-help-list"><a href="https://workforceapps.screenings4u.com/"><strong>Sign-in or session issues</strong><span>Return to Workforce sign in →</span></a><a href="/testing-order.html"><strong>Testing workflow</strong><span>Check testing orders →</span></a><a href="/results.html"><strong>Laboratory results</strong><span>View test results →</span></a><a href="/billing.html"><strong>Billing questions</strong><span>Review invoices →</span></a></div></section><section class="dash-card"><h3>What Happens Next</h3><ol class="support-steps"><li><strong>1 · Ticket created</strong><span>Receive a support ticket number</span></li><li><strong>2 · Support review</strong><span>Our team reviews your account request</span></li><li><strong>3 · Two-way replies</strong><span>Continue the conversation in your ticket</span></li><li><strong>4 · Resolution</strong><span>Track updates until resolved</span></li></ol></section></aside></div><section class="dash-card"><div class="lab-overview-head"><div><h3>Your Workforce Support Requests</h3><p>Review all tickets and responses.</p></div><div class="support-filter"><input type="search" id="supportSearch" placeholder="Search tickets"><select id="supportStatus"><option value="">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="pending">Waiting on you</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></div></div><div class="results-table-wrap"><table class="results-table"><thead><tr><th>Ticket</th><th>Category</th><th>Priority</th><th>Status</th><th>Created</th><th>Updated</th><th>Action</th></tr></thead><tbody id="supportTickets"></tbody></table></div></section></div>';
let supportSelected=null;
async function supportCall(action,more={}){
 const {data:{session}}=await window.labAccountClient.auth.getSession();if(!session)throw Error('Please sign in again.');
 const r=await fetch(cfg.supabaseUrl+'/functions/v1/lab-account-support',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.supabasePublishableKey,Authorization:'Bearer '+session.access_token},body:JSON.stringify({action,...more}),cache:'no-store'});
 const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw Error(d.error||'Support service unavailable');return d;
}
async function loadSupport(){
 const note=document.getElementById('supportNotice'),host=document.getElementById('supportTickets');
 try{const d=await supportCall('list');const tickets=d.tickets||[];
 const counts={open:0,in_progress:0,pending:0,resolved:0};tickets.forEach(t=>{const st=String(t.status||'open');if(['closed','resolved'].includes(st))counts.resolved++;else if(st==='in_progress')counts.in_progress++;else if(st==='pending')counts.pending++;else counts.open++});
 document.getElementById('supportMetrics').innerHTML=[['Open',counts.open,'Awaiting review'],['In progress',counts.in_progress,'Being worked'],['Waiting on you',counts.pending,'Response requested'],['Resolved',counts.resolved,'Completed requests']].map(([label,note,subtitle])=>'<div class="dash-kpi"><span>'+escape(label)+'</span><strong>'+note+'</strong><small>'+escape(subtitle)+'</small></div>').join('');
 const draw=()=>{const q=(document.getElementById('supportSearch').value||'').toLowerCase(),st=document.getElementById('supportStatus').value;const filtered=tickets.filter(t=>(!st||t.status===st)&&(!q||[t.ticket_number,t.subject,t.category,t.priority].some(v=>String(v||'').toLowerCase().includes(q))));
 host.innerHTML=filtered.map(x=>'<tr><td><strong>'+escape(x.ticket_number||'Ticket')+'</strong><small>'+escape(x.subject||'')+'</small></td><td>'+escape(x.category||'General')+'</td><td>'+escape(x.priority||'normal')+'</td><td><span class="results-label">'+escape(x.status||'open')+'</span></td><td>'+escape(resultDate(x.created_at))+'</td><td>'+escape(resultDate(x.last_message_at||x.updated_at))+'</td><td><button type="button" class="results-view" data-ticket-id="'+escape(x.id)+'">View</button></td></tr>').join('')||'<tr><td colspan="7" class="results-empty">No support requests found.</td></tr>';host.querySelectorAll('[data-ticket-id]').forEach(b=>b.onclick=()=>location.href='/support-ticket.html?id='+encodeURIComponent(b.dataset.ticketId))};document.getElementById('supportSearch').oninput=draw;document.getElementById('supportStatus').onchange=draw;draw();note.textContent=tickets.length+' support request(s) available.'}catch(e){note.textContent=e.message||'Unable to load tickets';host.innerHTML='<tr><td colspan="7">Unable to load requests.</td></tr>'}
}
function initSupport(){
 document.getElementById('supportRefresh').onclick=loadSupport;window.labAccountClient.auth.getSession().then(({data})=>{const field=document.getElementById('supportReplyEmail');if(field)field.value=data?.session?.user?.email||'';}).catch(()=>{});document.getElementById('supportPageUrl').value=document.referrer&&document.referrer.startsWith(location.origin)?document.referrer:'';

 document.getElementById('supportCreate').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button[type=submit]');b.disabled=true;try{await supportCall('create',Object.fromEntries(new FormData(f).entries()));f.reset();await loadSupport();document.getElementById('supportNotice').textContent='Support request submitted.'}catch(err){document.getElementById('supportNotice').textContent=err.message}finally{b.disabled=false}};

 loadSupport();
}



const detailSpec={
 'testing-order-view':{type:'testing',title:'Testing order',back:'/testing-order.html',backLabel:'All testing orders',intro:'Track your testing request, donor information and collection progress.'},
 'result-view':{type:'result',title:'Testing result',back:'/results.html',backLabel:'All results',intro:'Review laboratory testing information and the latest available result.'},
 'invoice-view':{type:'invoice',title:'Invoice',back:'/billing.html',backLabel:'All invoices',intro:'Review your invoice, payment summary and billing information.'},
 'order-view':{type:'history',title:'Order',back:'/order-history.html',backLabel:'Order history',intro:'Review purchased services, payment and fulfillment progress.'}
};

async function updateTestingOrder(id,payload){
 const {data:{session}}=await window.labAccountClient.auth.getSession();if(!session)throw Error('Please sign in again.');
 const r=await fetch(cfg.supabaseUrl+'/functions/v1/lab-account-testing-orders',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.supabasePublishableKey,Authorization:'Bearer '+session.access_token},body:JSON.stringify({action:'update',id,...payload})});
 const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw Error(d.error||'Unable to save testing order');return d;
}
const testingOrderEditMarkup=()=>'<div class="order-editor"><div class="record-toolbar"><a id="editOrderBack" href="/testing-order.html">← Back to order</a><strong>EDIT ORDER</strong></div><header class="order-editor-header"><h1 id="editOrderHeading">Edit testing order</h1><p>Edit donor details and testing requirements</p></header><p id="editOrderNotice" class="results-message">Loading order…</p><form id="editOrderForm" hidden><section class="order-editor-panel"><h2>Order information</h2><div class="order-editor-grid"><label>Order reference<input id="editRef" readonly></label><label>Testing service<input id="editService" readonly></label><label>Status<input id="editStatus" readonly></label><label>Created<input id="editCreated" readonly></label></div></section><section class="order-editor-panel"><h2>Donor information</h2><div class="order-editor-grid"><label>First name<input name="first_name" required maxlength="100"></label><label>Last name<input name="last_name" required maxlength="100"></label><label>Email<input name="donor_email" type="email" required></label><label>Phone<input name="donor_phone" type="tel" maxlength="35"></label><label>Date of birth<input name="date_of_birth" type="date" required></label><label>State of residence<input name="state_of_residence" maxlength="2" pattern="[A-Za-z]{2}" required></label></div></section><section class="order-editor-panel"><h2>Testing details</h2><div class="order-editor-grid"><label>Reason for testing<select name="test_reason" required><option value="PE">Pre-employment</option><option value="RN">Random</option><option value="PA">Post-accident</option><option value="RS">Reasonable suspicion</option><option value="RT">Return to duty</option><option value="FU">Follow-up</option><option value="NI">Other</option></select></label><label>DOT authority<input id="editAuthority" readonly></label><label class="order-editor-wide">Instructions / notes<textarea name="notes" rows="4" maxlength="1000"></textarea></label></div></section><section class="order-editor-panel"><h2>Collection status</h2><div class="order-editor-grid"><label>Appointment<input id="editAppointment" readonly></label><label>Collection deadline<input id="editDeadline" readonly></label><label>Donor pass<input id="editPass" readonly></label></div></section><div class="order-editor-actions"><a id="editOrderCancel" href="/testing-order.html">Cancel</a><button type="submit" class="supply-primary">Save order changes</button></div></form></div>';
async function initTestingOrderEdit(){
 const id=new URLSearchParams(location.search).get('id'),notice=document.getElementById('editOrderNotice'),form=document.getElementById('editOrderForm');if(!id){notice.textContent='Select an order first';return}
 const back='/testing-order-view.html?id='+encodeURIComponent(id);document.getElementById('editOrderBack').href=back;document.getElementById('editOrderCancel').href=back;
 try{const d=await testingOrdersCall(),x=(d.orders||[]).find(o=>String(o.id)===id);if(!x)throw Error('Order not found');
 document.getElementById('editOrderHeading').textContent='Edit '+x.case_number;
 if(x.status!=='awaiting_schedule'){notice.textContent='This order cannot be edited after scheduling starts.';return}
 const n=String(x.donor_name||'').trim().split(/\s+/);form.elements.first_name.value=n.shift()||'';form.elements.last_name.value=n.join(' ');for(const k of ['donor_email','donor_phone','date_of_birth','state_of_residence','test_reason'])form.elements[k].value=x[k]||'';form.elements.notes.value=x.request_notes||'';
 const fields={editRef:x.case_number,editService:x.panel_name||x.test_type,editStatus:testingStatus(x.status),editCreated:resultDate(x.created_at),editAuthority:x.dot_agency||'N/A',editAppointment:resultDate(x.scheduled_at),editDeadline:resultDate(x.collection_deadline),editPass:x.donor_pass_number||'Not issued'};for(const [k,v] of Object.entries(fields))document.getElementById(k).value=v||'—';
 form.hidden=false;notice.hidden=true;
 form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;notice.hidden=false;notice.textContent='Saving…';try{await updateTestingOrder(id,Object.fromEntries(new FormData(form).entries()));location.href=back}catch(err){notice.textContent=err.message||'Save failed';button.disabled=false}};
 }catch(err){notice.textContent=err.message||'Unable to load order'}
}

const detailMarkup=()=>{
 const spec=detailSpec[current];
 if(spec.type==='testing')return '<article class="order-sheet"><div class="order-sheet-top"><a href="/testing-order.html">← Testing orders</a><a id="editOrderLink" class="order-edit-btn" hidden>Edit order</a></div><header class="order-sheet-header"><div><img src="https://workforce.screenings4u.com/images/logo.png" alt="Workforce"><span>TESTING ORDER</span><h1 id="recordHeading">Loading order…</h1><p>Order information and collection status</p></div><div class="order-sheet-status"><small>Order status</small><strong id="recordStatus">Loading…</strong></div></header><p id="recordMessage" class="results-message">Retrieving your testing order…</p><div id="recordContent" hidden><div id="recordSummary" class="order-sheet-summary"></div><div id="recordSections" class="order-sheet-sections"></div></div><footer class="order-sheet-footer">Workforce · Testing Order</footer></article>';
 return '<div class="workforce-record"><div class="record-toolbar"><a class="record-back" href="'+spec.back+'">← '+spec.backLabel+'</a><span class="record-view-tag">VIEW DETAILS</span></div><div class="record-overview"><div><span class="record-eyebrow">WORKFORCE</span><h2 id="recordHeading">'+spec.title+'</h2><p>'+spec.intro+'</p></div><div id="recordStatus" class="record-status">Retrieving status…</div></div><p id="recordMessage" class="results-message">Loading your record…</p><div id="recordContent" hidden><div class="record-summary" id="recordSummary"></div><div class="record-sections" id="recordSections"></div></div></div>';
};
async function loadRecordDetail(){
 const spec=detailSpec[current],id=new URLSearchParams(location.search).get('id'),note=document.getElementById('recordMessage');
 if(!id){note.textContent='No record was selected. Return to the listing and choose View details.';return}
 const cell=(label,value)=>'<div class="record-field"><span>'+escape(label)+'</span><strong>'+escape(value===null||value===undefined||value===''?'—':String(value))+'</strong></div>';
 const section=(heading,subtitle,items)=>'<section class="record-section"><div class="record-section-heading"><h3>'+heading+'</h3><p>'+subtitle+'</p></div><div class="record-field-grid">'+items.map(([k,v])=>cell(k,v)).join('')+'</div></section>';
 const card=(label,value)=>'<div class="record-highlight"><span>'+escape(label)+'</span><strong>'+escape(value||'—')+'</strong></div>';
 try{
  let sections=[],summary=[],ref='',status='';
  if(spec.type==='testing'){
   const d=await testingOrdersCall(),x=(d.orders||[]).find(o=>String(o.id)===id);if(!x)throw Error('Testing order not found for this account.');
   ref=x.case_number||'Testing order';status=testingStatus(x.status);const edit=document.getElementById('editOrderLink');if(edit&&x.status==='awaiting_schedule'){edit.href='/testing-order-edit.html?id='+encodeURIComponent(id);edit.hidden=false}
   summary=[['Testing service',x.panel_name||x.test_type],['Order submitted',resultDate(x.created_at)],['Status',status]];
   sections.push(section('Donor & test','Who is being tested and what was ordered',[['Donor',x.donor_name],['Test',x.test_type],['Panel',x.panel_name],['Reason for testing',x.test_reason],['Priority',x.priority]]));
   sections.push(section('Collection timeline','Scheduling and specimen milestones',[['Order created',resultDate(x.created_at)],['Scheduled appointment',resultDate(x.scheduled_at)],['Collection deadline',resultDate(x.collection_deadline)],['Collected',resultDate(x.collected_at)],['Completed',resultDate(x.completed_at)]]));
   sections.push(section('Donor pass','Details are shown when a pass has been issued',[['Pass number',x.donor_pass_number]]));
  }
  if(spec.type==='result'){
   const d=await resultCall('detail',{id}),x=d.record||{},r=x.result||{},e=x.employee||{};
   ref=x.order_number||'Testing result';status=r.final_status||workflowName(x);
   summary=[['Order reference',ref],['Testing stage',workflowName(x)],['Result',status]];
   sections.push(section('Donor & service','Testing information for this record',[['Donor name',[e.first_name,e.last_name].filter(Boolean).join(' ')],['Testing service',x.charge?.service_name||x.testing_panel],['Testing reason',x.reason],['Order number',x.order_number]]));
   sections.push(section('Laboratory results','Most recently published result information',[['Final result',r.final_status],['MRO review',r.mro_status],['Result date',resultDate(r.result_date||r.finalized_at)]]));
   sections.push('<p class="record-note">Official laboratory documents are available only after they have been published to your authorized account. <a href="/documents.html">Go to Documents</a></p>');
  }
  if(spec.type==='invoice'){
   const d=await billingCall(id),x=d.invoice;if(!x)throw Error('Invoice not found for this account.');
   ref=x.invoice_number||'Invoice';status=String(x.status||'Open').replaceAll('_',' ');
   summary=[['Invoice amount',billMoney(x.total,x.currency)],['Amount paid',billMoney(x.amount_paid,x.currency)],['Balance due',billMoney(x.amount_due,x.currency)]];
   sections.push(section('Invoice information','Billing details and payment terms',[['Invoice number',x.invoice_number],['Billed to',x.customer_name],['Date issued',resultDate(x.issue_date||x.created_at)],['Payment due',resultDate(x.due_date)],['Payment status',status],['Payment terms',x.terms]]));
   if((d.items||[]).length)sections.push(section('Invoice line items','Services billed on this invoice',(d.items||[]).map(item=>[String(item.description||'Service')+' × '+Number(item.quantity||0),billMoney(item.line_total,x.currency)])));
   if(x.notes)sections.push(section('Notes','Information supplied with this invoice',[['Invoice notes',x.notes]]));
  }
  if(spec.type==='history'){
   const d=await orderHistoryCall(),x=(d.orders||[]).find(o=>String(o.id)===id);if(!x)throw Error('Order not found for this account.');
   ref=x.order_number||'Order';status=String(x.fulfillment_status||x.status||'Pending').replaceAll('_',' ');
   summary=[['Order total',billMoney(x.total,x.currency)],['Payment status',String(x.payment_status||'Pending').replaceAll('_',' ')],['Fulfillment',status]];
   sections.push(section('Order information','Your purchase and company details',[['Order number',x.order_number],['Company',x.company_name],['Placed on',resultDate(x.created_at)],['Paid on',resultDate(x.paid_at)],['Fulfilled on',resultDate(x.fulfilled_at)],['Tracking number',x.tracking_number]]));
   sections.push('<section class="record-section"><div class="record-section-heading"><h3>Purchased services</h3><p>Items included in this order</p></div><div class="record-item-list">'+(x.items||[]).map(i=>'<div class="record-item"><div><strong>'+escape(i.name||'Service')+'</strong><span>Quantity '+escape(i.quantity||1)+'</span></div><strong>'+escape(billMoney(i.line_total,x.currency))+'</strong></div>').join('')+'</div></section>');
  }
  document.getElementById('recordHeading').textContent=ref;
  document.getElementById('recordStatus').textContent=status;
  document.getElementById('recordSummary').innerHTML=summary.map(([k,v])=>card(k,v)).join('');
  document.getElementById('recordSections').innerHTML=sections.join('');
  document.getElementById('recordContent').hidden=false;note.hidden=true;
 }catch(e){note.textContent=e.message||'Unable to load this record.'}
}


const supplyRequestMarkup=()=>'<div class="workforce-record"><div class="record-toolbar"><a class="record-back" href="/supplies.html">← Back to supplies</a><span class="record-view-tag">NEW REQUEST</span></div><div class="record-overview"><div><span class="record-eyebrow">WORKFORCE SUPPLIES</span><h2>Review supply request</h2><p>Confirm selected supplies and provide a delivery address.</p></div></div><p id="requestNotice" class="results-message" role="status">Loading selected supplies…</p><form id="requestForm" class="supply-form" hidden><section class="record-section"><div class="record-section-heading"><h3>Your supplies</h3><p>Items and quantities for this request</p></div><div id="requestItems"></div></section><section class="record-section"><div class="record-section-heading"><h3>Delivery address</h3><p>Where your approved supplies should be shipped</p></div><div class="supply-fields"><label>Recipient<input name="recipient" required maxlength="180"></label><label>Address line 1<input name="line1" required maxlength="180"></label><label>Address line 2<input name="line2" maxlength="180"></label><label>City<input name="city" required maxlength="180"></label><label>State<input name="state" required maxlength="2" pattern="[A-Za-z]{2}"></label><label>ZIP<input name="postal_code" required pattern="[0-9]{5}(-[0-9]{4})?"></label></div><label>Delivery notes<textarea name="notes" maxlength="1000" rows="3"></textarea></label></section><button class="supply-primary" type="submit">Submit supply request</button></form></div>';
async function initSupplyRequest(){
 const notice=document.getElementById('requestNotice'),form=document.getElementById('requestForm');let saved=[];
 try{saved=JSON.parse(sessionStorage.getItem('workforce_supply_request')||'[]');if(!Array.isArray(saved)||!saved.length)throw Error('No supplies selected. Return to Supplies and choose the quantities you need.');
 const d=await supplyCall('workspace'),available=d.supplies||[];
 const lines=saved.filter(x=>Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<=1000&&available.some(a=>String(a.id)===String(x.item_id)));
 if(!lines.length)throw Error('The selected supplies are no longer available. Return to Supplies and select approved items.');
 document.getElementById('requestItems').innerHTML=lines.map(x=>{const item=available.find(a=>String(a.id)===String(x.item_id));return '<div class="record-item"><div><strong>'+escape(item.name)+'</strong><span>'+escape(item.sku||'Approved supply')+'</span></div><strong>Qty '+x.quantity+'</strong></div>'}).join('');
 form.hidden=false;notice.hidden=true;
 form.onsubmit=async e=>{e.preventDefault();const btn=form.querySelector('[type=submit]');btn.disabled=true;notice.hidden=false;notice.textContent='Submitting supply request…';try{const d=Object.fromEntries(new FormData(form).entries());await supplyCall('create',{lines,shipping_address:{recipient:d.recipient,line1:d.line1,line2:d.line2,city:d.city,state:d.state,postal_code:d.postal_code},notes:d.notes});sessionStorage.removeItem('workforce_supply_request');location.assign('/supplies.html')}catch(e){notice.textContent=e.message||'Unable to submit request';btn.disabled=false}};
 }catch(e){notice.textContent=e.message||'Unable to open supply request'}
}
const supportTicketMarkup=()=>'<div class="workforce-record"><div class="record-toolbar"><a class="record-back" href="/support.html">← Back to support</a><span class="record-view-tag">SUPPORT REQUEST</span></div><div class="record-overview"><div><span class="record-eyebrow">WORKFORCE SUPPORT</span><h2 id="ticketHeading">Support ticket</h2><p id="ticketSubtitle">View the conversation and reply to your support team.</p></div><span class="record-status" id="ticketStatus">Loading…</span></div><p id="ticketNotice" class="results-message" role="status">Loading support request…</p><div id="ticketContent" hidden><section class="record-section"><div class="record-section-heading"><h3>Conversation</h3><p>Updates and replies for this request</p></div><div id="ticketMessages" class="support-messages"></div></section><section class="record-section" id="ticketReplySection"><div class="record-section-heading"><h3>Send a reply</h3><p>Continue the conversation with Workforce Support</p></div><form id="ticketReplyForm" class="support-form"><label>Your message<textarea name="message" maxlength="5000" rows="5" required></textarea></label><button type="submit" class="supply-primary">Send reply</button></form></section></div></div>';
async function initSupportTicket(){
 const id=new URLSearchParams(location.search).get('id'),note=document.getElementById('ticketNotice');if(!id){note.textContent='No support request selected.';return}
 try{const d=await supportCall('detail',{ticket_id:id}),t=d.ticket||{};if(!t.id)throw Error('Support request not found');document.getElementById('ticketHeading').textContent=t.ticket_number||'Support ticket';document.getElementById('ticketSubtitle').textContent=t.subject||'Support conversation';document.getElementById('ticketStatus').textContent=String(t.status||'open').replaceAll('_',' ');
 document.getElementById('ticketMessages').innerHTML=(d.messages||[]).map(m=>'<article class="support-message"><strong>'+escape(m.sender_type==='customer'?'You':'Workforce Support')+'</strong><small>'+escape(resultDate(m.created_at))+'</small><p>'+escape(m.body||'')+'</p></article>').join('')||'<p>No messages yet.</p>';
 document.getElementById('ticketReplySection').hidden=t.status==='closed';document.getElementById('ticketContent').hidden=false;note.hidden=true;
 document.getElementById('ticketReplyForm').onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;try{await supportCall('reply',{ticket_id:id,...Object.fromEntries(new FormData(e.currentTarget).entries())});await initSupportTicket()}catch(e){note.hidden=false;note.textContent=e.message||'Unable to send reply';b.disabled=false}};
 }catch(e){note.textContent=e.message||'Unable to open support request'}
}


const donorPassMarkup=()=>'<div class="workforce-record"><div class="record-toolbar"><a class="record-back" href="/create-testing-order.html">← Back to testing orders</a><span class="record-view-tag">DONOR PASS</span></div><div class="record-overview"><div><span class="record-eyebrow">WORKFORCE</span><h2 id="passNumber">Donor pass</h2><p>Authorized collection information for your issued donor pass.</p></div></div><p id="passMessage" class="results-message">Loading issued donor pass…</p><section class="record-section" id="passContent" hidden><div id="passFields" class="record-field-grid"></div><button type="button" class="supply-primary" id="printPass">Print this page</button></section></div>';
async function initDonorPass(){
 const id=new URLSearchParams(location.search).get('id'),note=document.getElementById('passMessage');if(!id){note.textContent='Choose an issued donor pass first.';return}
 try{const d=await newOrderCall('passes'),p=(d.passes||[]).find(x=>String(x.id)===id);if(!p)throw Error('Issued donor pass not found for this account.');
 document.getElementById('passNumber').textContent=p.pass_number||'Donor pass';
 const details=[['Donor',p.donor_name],['Test type',p.test_type],['Collection site',p.collection_site_name],['Site address',p.collection_site_address],['Collection deadline',resultDate(p.collection_deadline)],['Pass status',p.status]];
 document.getElementById('passFields').innerHTML=details.map(([k,v])=>'<div class="record-field"><span>'+escape(k)+'</span><strong>'+escape(v||'—')+'</strong></div>').join('');
 document.getElementById('passContent').hidden=false;note.hidden=true;document.getElementById('printPass').onclick=()=>window.print();
 }catch(e){note.textContent=e.message||'Unable to load donor pass'}
}


const storeMarkup=()=>'<div class="lab-store"><div class="lab-store-intro"><h2>Plans, features & upgrades</h2><p>Compare what your account includes, request an upgrade without losing your existing laboratory records, and explore optional services. Upgrades are paid purchases. Your plan changes only after payment is verified.</p></div><div id="labStoreNotice" class="results-message" role="status">Loading your verified plan and store catalog…</div><div id="labStorePlans"></div><div id="labStoreFeatures"></div><div id="labStoreOffers"></div></div>';
async function initLabStore(){
 const notice=document.querySelector('#labStoreNotice'),plans=document.querySelector('#labStorePlans'),features=document.querySelector('#labStoreFeatures'),offers=document.querySelector('#labStoreOffers');if(!notice||!plans||!features||!offers)return;
 const sb=window.labAccountClient;
 const request=async body=>{const {data:{session}}=await sb.auth.getSession();if(!session)throw Error('Session expired. Sign in again.');const res=await fetch(cfg.supabaseUrl+'/functions/v1/lab-portal-store',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.supabasePublishableKey,Authorization:'Bearer '+session.access_token},body:JSON.stringify(body)});const payload=await res.json().catch(()=>({}));if(!res.ok||payload.error)throw Error(payload.error||'Unable to load the store');return payload};
 try{
  const d=await request({action:'catalog'}),order=['lab-account','lab-account-random-consortium','lab-account-random-consortium-docs'],name=k=>d.plan_names?.[k]||k;
  const pending=new Set((d.requests||[]).filter(x=>x.status==='checkout_pending').map(x=>x.target_plan_sku));
  const featureByCode=new Map((d.features||[]).map(f=>[f.feature_code,f]));
  const planFeatures=sku=>(d.plan_feature_codes?.[sku]||[]).map(code=>featureByCode.get(code)).filter(Boolean);
  const params=new URLSearchParams(location.search);
  notice.textContent=params.get('consortium')==='return'?'Your consortium subscription is being verified. Active access will appear after Stripe confirms the first payment.':params.get('upgrade')==='success'?'Payment confirmation received. Your current verified plan is '+name(d.plan_sku)+'. If payment was just completed and features are still processing, refresh shortly.':'Your current plan is '+name(d.plan_sku)+'. Existing account records are preserved when upgrading.';
  if(params.get('consortium')==='return'&&!d.consortium_subscription?.active){
   let checks=0;
   const poll=window.setInterval(async()=>{
    checks++;
    try{
     const update=await request({action:'catalog'});
     if(update.consortium_subscription?.active){
      window.clearInterval(poll);
      location.replace('store.html?consortium=active');
     }else if(checks>=15){
      window.clearInterval(poll);
      notice.textContent='Your subscription payment is still being confirmed. Refresh this page later if the entitlement has not appeared.';
     }
    }catch(e){if(checks>=15)window.clearInterval(poll)}
   },2000);
  }
  if(params.get('consortium')==='active')notice.textContent='Your consortium subscription is active and eligible features are now available in your Lab Account.';
  plans.innerHTML='<h3>Choose your Lab Account plan</h3><div class="lab-store-plan-grid">'+order.map((sku,i)=>{const current=sku===d.plan_sku,higher=i>order.indexOf(d.plan_sku),path=(d.upgrades||[]).find(x=>x.target_plan_sku===sku),requested=pending.has(sku);
   const text=current?'Your current plan':higher?'Upgrade to this plan':'Included in your current plan';
   const action=current?'<span class="lab-store-state">Current plan</span>':higher?(requested?'<span class="lab-store-state">Payment pending</span>':path?.ready?'<button class="lab-store-upgrade" type="button" data-upgrade="'+escape(sku)+'">Purchase upgrade · '+(Number(path.price_cents||0)/100).toLocaleString('en-US',{style:'currency',currency:'USD'})+'</button>':'<span class="lab-store-state">Checkout unavailable</span>'):'<span class="lab-store-state">Included</span>';
   const added=planFeatures(sku).filter(f=>!d.plan_feature_codes?.[d.plan_sku]?.includes(f.feature_code));
   const benefits=added.length?'<ul class="lab-store-benefits">'+added.map(f=>'<li>'+escape(f.title)+(f.delivery_status==='planned'?' <small>(coming soon)</small>':'')+'</li>').join('')+'</ul>':'<p class="lab-store-plan-note">Core laboratory operations and customer support</p>';
   return '<article class="lab-store-plan'+(current?' is-current':'')+'"><div class="lab-store-plan-header"><small>PLAN '+(i+1)+'</small><h4>'+escape(name(sku))+'</h4></div><p>'+escape(text)+'</p>'+benefits+'<p class="lab-store-plan-note">'+(path?.ready?'One-time secure checkout. Your existing Lab Account is retained.':'One-time upgrade price is calculated from the current plan catalog.')+'</p>'+action+'</article>';
  }).join('')+'</div>';
  const visible=(d.features||[]).filter(x=>x.included);
  features.innerHTML='<h3>Your plan includes</h3><div class="lab-store-feature-grid">'+visible.map(x=>'<div class="lab-store-feature"><span class="lab-store-feature-icon">'+(x.available?'✓':'◷')+'</span><div><strong>'+escape(x.title)+'</strong><p>'+escape(x.description)+'</p><small>'+(x.available?'Included in your plan':'Planned feature — not yet available')+'</small></div></div>').join('')+'</div>';
  const list=d.offers||[];
  const includedCodes=new Set((d.features||[]).filter(x=>x.included).map(x=>x.feature_code));
  offers.innerHTML='<h3>Additional services</h3><p class="lab-store-explainer">Add-on purchases require a verified payment price and active billing integration. Features already included in your plan will not be offered as duplicate purchases.</p><div class="lab-store-offer-grid">'+list.map(x=>'<article class="lab-store-offer"><small>'+escape(x.category)+'</small><h4>'+escape(x.title)+'</h4><p>'+escape(x.description)+'</p><strong>'+(x.price_cents!==null&&x.price_cents!==undefined?(x.ready?'':'Proposed ')+(Number(x.price_cents)/100).toLocaleString('en-US',{style:'currency',currency:x.currency||'USD'})+(x.billing_interval==='month'?'/month':''):'Pricing to be confirmed')+'</strong><span class="lab-store-state">'+(includedCodes.has(x.feature_code)?'Included with your plan':x.offer_code==='consortium_125'&&x.ready?'Available for subscription':x.ready?'Billing setup pending':'Coming soon')+'</span>'+(x.offer_code==='consortium_125'&&x.ready&&!includedCodes.has(x.feature_code)?'<button type="button" class="lab-store-upgrade" data-buy-addon="'+escape(x.offer_code)+'">Subscribe · $125/month</button>':'')+'</article>').join('')+'</div>';
  if(d.consortium_subscription?.active){
   const sub=d.consortium_subscription;
   const extra=document.createElement('div');extra.className='lab-store-subscription-status';
   const till=sub.current_period_end?new Date(sub.current_period_end).toLocaleDateString():null;
   const p=document.createElement('p');
   p.textContent=sub.cancel_at_period_end?'Consortium subscription scheduled to end'+(till?' on '+till:'')+'. Access stays available through the paid period.':'Consortium membership is active at $125/month'+(till?' · Current paid period ends '+till:'')+'.';
   extra.append(p);
   if(!sub.cancel_at_period_end){
    const stop=document.createElement('button');stop.type='button';stop.className='lab-store-cancel';stop.textContent='Cancel future renewals';extra.append(stop);
    stop.onclick=async()=>{
     if(!window.confirm('Cancel consortium auto-renewal at the end of your current paid period? Your Lab Account remains active.'))return;
     stop.disabled=true;
     try{await request({action:'cancel_addon'});p.textContent='Renewal cancellation scheduled. Your consortium access stays active through the current paid period.';stop.remove()}
     catch(e){stop.disabled=false;notice.textContent=e.message||'Could not update the subscription.'}
    };
   }
   offers.prepend(extra);
  }
  offers.querySelectorAll('[data-buy-addon]').forEach(btn=>btn.addEventListener('click',async()=>{
   btn.disabled=true;const original=btn.textContent;btn.textContent='Opening secure checkout…';
   try{
    const result=await request({action:'begin_addon',offer_code:btn.dataset.buyAddon});
    if(!result.checkout_url)throw Error('The subscription checkout was not initialized.');
    const url=new URL(result.checkout_url);
    if(url.origin!=='https://screenings4u.com'||url.pathname!=='/checkout.html')throw Error('Unexpected subscription checkout destination.');
    location.assign(url.href);
   }catch(e){btn.disabled=false;btn.textContent=original;notice.textContent=e.message||'Unable to start subscription checkout.';}
  }));
  plans.querySelectorAll('[data-upgrade]').forEach(btn=>btn.addEventListener('click',async()=>{
   btn.disabled=true;const original=btn.textContent;btn.textContent='Connecting to checkout…';notice.textContent='Opening secure checkout…';
   try{const result=await request({action:'begin_checkout',target_plan_sku:btn.dataset.upgrade});if(!result.checkout_url)throw Error('Secure checkout was not created.');const url=new URL(result.checkout_url);if(url.origin!=='https://screenings4u.com'||url.pathname!=='/checkout.html')throw Error('Unexpected checkout destination.');location.assign(url.href);}
   catch(e){btn.disabled=false;btn.textContent=original;notice.textContent=e.message||'Unable to begin purchase.';}
  }));
 }catch(e){notice.textContent=e.message||'The store is temporarily unavailable.'}
}

const ADVANCED_FEATURES={
 'client-directory':{feature:'directory',label:'Client Directory',intro:'Organize the employers and clients you serve. Your directory is private to your Lab Account.'},
 'ccf-archive':{feature:'ccf',label:'CCF Archive',intro:'Access authorized customer-visible chain-of-custody files attached to your released testing cases.'},
 'result-delivery':{feature:'delivery',label:'Secure Result Delivery',intro:'Request delivery of released MRO reports to authorized recipients. Testing staff must verify recipient authorization before any disclosure.'},
 'supply-alerts':{feature:'alerts',label:'Supply Reorder Alerts',intro:'Track supplies on hand and receive low-stock indicators in your portal. This is your inventory estimate, not laboratory stock.'},
 'analytics':{feature:'analytics',label:'Testing Analytics',intro:'Review testing activity from your verified Lab Account cases, with real totals and monthly trends.'}
};
const advancedMarkup=()=>{
 const f=ADVANCED_FEATURES[current];if(!f)return '';
 return '<div class="premium-workspace advanced-feature-workspace"><div class="lab-overview-head"><div><h2>'+escape(f.label)+'</h2><p>'+escape(f.intro)+'</p></div><a href="/store.html" class="dash-action">My plan</a></div><p role="status" id="advancedNotice" class="results-message">Loading your account data…</p><section id="advancedContent" class="dash-card">Loading…</section></div>';
};
async function initAdvancedFeature(){
 const config=ADVANCED_FEATURES[current];if(!config||activeEntitlement?.preview===true||activeEntitlement?.features?.lab_account!==true)return;
 const root=document.querySelector('.advanced-feature-workspace');if(!root)return;
 const area=root.querySelector('#advancedContent'),notice=root.querySelector('#advancedNotice');
 const request=async payload=>{
  const {data:{session}}=await window.labAccountClient.auth.getSession();
  if(!session)throw Error('Session expired. Please sign in again.');
  const response=await fetch(cfg.supabaseUrl+'/functions/v1/lab-advanced-features',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',apikey:cfg.supabasePublishableKey,Authorization:'Bearer '+session.access_token},body:JSON.stringify({feature:config.feature,...payload})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.error)throw Error(data.error||'Feature unavailable');
  return data;
 };
 const escapeAttr=escape, money=v=>Number(v).toLocaleString('en-US');
 const refresh=async()=>{
  area.textContent='Loading verified information…';
  try{const data=await request({action:'list'});notice.textContent='Updated from your Lab Account records.';
   if(config.feature==='directory'){
    area.innerHTML='<h3>Saved client contacts</h3><form id="advClientForm" class="advanced-form"><input type="hidden" name="id"><label>Company name<input name="company_name" required maxlength="160"></label><label>Contact person<input name="contact_name" maxlength="160"></label><label>Email<input type="email" name="contact_email" maxlength="254"></label><label>Phone<input name="phone" maxlength="40"></label><label>Testing program<select name="program_type"><option value="non_dot">NON-DOT</option><option value="dot">DOT</option><option value="both">DOT & NON-DOT</option></select></label><label class="full">Notes<textarea name="notes" maxlength="1500" rows="2"></textarea></label><button type="submit" class="dash-action">Save client</button><button type="reset" class="signout">Clear</button></form><h3>My clients</h3><div id="advancedRows"></div>';
    const rows=area.querySelector('#advancedRows');
    if(!(data.clients||[]).length)rows.textContent='No clients have been added yet.';
    for(const c of data.clients||[]){
     const div=document.createElement('article');div.className='premium-request';
     const title=document.createElement('strong');title.textContent=c.company_name;
     const p=document.createElement('p');p.textContent=[c.contact_name,c.contact_email,c.phone,c.program_type?.replace('_','-')].filter(Boolean).join(' · ');
     const edit=document.createElement('button');edit.type='button';edit.className='signout';edit.textContent='Edit';
     edit.onclick=()=>{const f=area.querySelector('#advClientForm');for(const key of ['id','company_name','contact_name','contact_email','phone','program_type','notes'])if(f.elements[key])f.elements[key].value=c[key]??'';f.scrollIntoView({behavior:'smooth',block:'start'})};
     const archive=document.createElement('button');archive.type='button';archive.className='signout';archive.textContent='Archive';archive.onclick=async()=>{if(!window.confirm('Archive this client contact?'))return;try{await request({action:'archive',id:c.id});await refresh()}catch(e){notice.textContent=e.message}};
     div.append(title,p,edit,archive);rows.append(div);
    }
    area.querySelector('#advClientForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;try{const values=Object.fromEntries(new FormData(form));await request({action:'save',...values});notice.textContent='Client saved.';await refresh()}catch(e){notice.textContent=e.message}finally{button.disabled=false}};
   }
   if(config.feature==='ccf'){
    area.innerHTML='<h3>Authorized CCF documents</h3><p class="dash-note">Only customer-visible documents attached to released cases appear here.</p><div id="advancedRows"></div>';
    const rows=area.querySelector('#advancedRows');
    if(!(data.documents||[]).length)rows.textContent='No released CCF documents are available for your account.';
    for(const doc of data.documents||[]){
     const div=document.createElement('article');div.className='premium-request';const title=document.createElement('strong');title.textContent=doc.title||'Chain-of-custody document';const p=document.createElement('p');p.textContent='Case '+(doc.case_number||'—')+' · '+new Date(doc.created_at).toLocaleDateString();const button=document.createElement('button');button.type='button';button.className='dash-action';button.textContent='Download CCF';button.onclick=async()=>{button.disabled=true;try{const x=await request({action:'download',id:doc.id});if(!x.url)throw Error('Download unavailable');window.location.assign(x.url)}catch(e){notice.textContent=e.message}finally{button.disabled=false}};div.append(title,p,button);rows.append(div);
    }
   }
   if(config.feature==='delivery'){
    area.innerHTML='<h3>Request authorized delivery</h3><form id="advDeliveryForm" class="advanced-form"><label class="full">Released testing case<select name="testing_case_id" required><option value="">Choose a released case</option></select></label><label>Recipient name<input name="recipient_name" maxlength="150"></label><label>Authorized recipient email<input name="recipient_email" type="email" required maxlength="254"></label><p class="full dash-note">Submitting this request does not send a report. Testing staff verify authorization before releasing sensitive results.</p><button type="submit" class="dash-action">Request secure delivery</button></form><h3>Delivery requests</h3><div id="advancedRows"></div>';
    const select=area.querySelector('[name="testing_case_id"]');
    for(const c of data.released_cases||[]){const opt=document.createElement('option');opt.value=c.id;opt.textContent=c.case_number||'Released case';select.append(opt)}
    const rows=area.querySelector('#advancedRows');if(!(data.deliveries||[]).length)rows.textContent='No delivery requests have been submitted.';
    for(const d of data.deliveries||[]){const div=document.createElement('article');div.className='premium-request';const strong=document.createElement('strong');strong.textContent=d.recipient_email;const p=document.createElement('p');p.textContent=d.status.replaceAll('_',' ')+' · '+new Date(d.created_at).toLocaleDateString();div.append(strong,p);if(d.staff_notes){const notes=document.createElement('p');notes.textContent=d.staff_notes;div.append(notes)}rows.append(div)}
    area.querySelector('#advDeliveryForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,btn=form.querySelector('button');btn.disabled=true;try{await request({action:'request',...Object.fromEntries(new FormData(form))});notice.textContent='Your delivery request has been sent for authorization review.';await refresh()}catch(err){notice.textContent=err.message}finally{btn.disabled=false}};
   }
   if(config.feature==='alerts'){
    area.innerHTML='<h3>Supply thresholds</h3><form id="advAlertForm" class="advanced-form"><label>Supply item<input name="supply_name" required maxlength="160" placeholder="Collection kits"></label><label>Reorder when stock reaches<input type="number" min="1" max="100000" name="reorder_threshold" value="5" required></label><label>Estimated on hand<input type="number" min="0" max="1000000" name="estimated_on_hand" value="0" required></label><button type="submit" class="dash-action">Save supply alert</button></form><h3>Inventory alerts</h3><div id="advancedRows"></div><h3>Recent supply shipments</h3><div id="advancedShipments"></div>';
    const rows=area.querySelector('#advancedRows');if(!(data.alerts||[]).length)rows.textContent='No supply reorder alerts configured.';
    for(const item of data.alerts||[]){const div=document.createElement('article');div.className='premium-request';const strong=document.createElement('strong');strong.textContent=item.supply_name+(item.needs_reorder?' · Reorder recommended':'');const p=document.createElement('p');p.textContent='Estimated stock: '+money(item.estimated_on_hand)+' · Reorder threshold: '+money(item.reorder_threshold);const remove=document.createElement('button');remove.className='signout';remove.type='button';remove.textContent='Remove';remove.onclick=async()=>{try{await request({action:'delete',id:item.id});await refresh()}catch(e){notice.textContent=e.message}};div.append(strong,p,remove);rows.append(div)}
    const ships=area.querySelector('#advancedShipments');if(!(data.shipments||[]).length)ships.textContent='No shipment records found.';
    for(const shipment of data.shipments||[]){const p=document.createElement('p');p.className='dash-note';p.textContent=[shipment.items_description,shipment.status,shipment.carrier,shipment.tracking_number].filter(Boolean).join(' · ');ships.append(p)}
    area.querySelector('#advAlertForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,btn=form.querySelector('button');btn.disabled=true;try{await request({action:'save',...Object.fromEntries(new FormData(form))});notice.textContent='Supply threshold saved.';await refresh()}catch(e){notice.textContent=e.message}finally{btn.disabled=false}};
   }
   if(config.feature==='analytics'){
    const m=data.metrics||{};area.replaceChildren();
    const heading=document.createElement('h3');heading.textContent='Your testing activity';area.append(heading);
    const grid=document.createElement('div');grid.className='advanced-metrics';
    for(const [label,num] of [['Testing cases',m.orders],['Released',m.released],['Awaiting release',m.pending],['DOT',m.dot],['NON-DOT',m.non_dot],['Avg. collection to release',m.average_hours_to_release===null?'N/A':m.average_hours_to_release+' hours']]){
     const card=document.createElement('article');card.className='premium-request';const v=document.createElement('strong');v.textContent=String(num??0);const name=document.createElement('p');name.textContent=label;card.append(v,name);grid.append(card);
    }area.append(grid);
    const h=document.createElement('h3');h.textContent='Monthly activity';area.append(h);
    const table=document.createElement('table');table.className='advanced-data-table';const thead=document.createElement('thead');thead.innerHTML='<tr><th>Month</th><th>Cases</th><th>Released</th></tr>';table.append(thead);const tbody=document.createElement('tbody');
    for(const x of data.monthly||[]){const tr=document.createElement('tr');for(const val of [x.month,x.orders,x.released]){const td=document.createElement('td');td.textContent=String(val);tr.append(td)}tbody.append(tr)}
    table.append(tbody);area.append(table);
    if(data.limit_reached){const warn=document.createElement('p');warn.className='dash-note';warn.textContent='Showing the latest 1,000 testing cases. Contact support for a full historical export.';area.append(warn)}
    const exportButton=document.createElement('button');exportButton.className='signout';exportButton.type='button';exportButton.textContent='Download monthly CSV';exportButton.onclick=()=>{const lines=[['Month','Cases','Released'],...(data.monthly||[]).map(x=>[x.month,x.orders,x.released])];const blob=new Blob([lines.map(row=>row.join(',')).join('\n')],{type:'text/csv'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='workforce-testing-activity.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)};area.append(exportButton);
   }
  }catch(e){notice.textContent=e.message||'Unable to load account data';area.textContent='This feature could not be loaded. Your other Lab Account services are unaffected.'}
 };
 await refresh();
}

const PREMIUM_SERVICES={
 consortium:{
  heading:'Consortium Services',
  intro:'Submit pool enrollment requests, request changes to participants, schedule random-selection services, and request participation certificates. Workforce testing staff perform required operations in the testing system.',
  types:[
   ['consortium_enrollment','Consortium enrollment','Request enrollment for a DOT or NON-DOT pool.'],
   ['consortium_participant_add','Add a participant','Request an eligible participant to be added to a managed pool.'],
   ['consortium_participant_remove','Remove a participant','Request a participant to be removed from a managed pool.'],
   ['consortium_selection_schedule','Random testing schedule','Request the next selection period from your testing administrator.'],
   ['consortium_certificate','Enrollment certificate','Request documentation of verified participation.']
  ]
 },
 'compliance-center':{
  heading:'Compliance Document Services',
  intro:'Request your purchased compliance document services. Official documents, completed setup work and audit packages are issued by authorized testing staff and made available for secure download.',
  types:[
   ['compliance_document','Compliance document','Request a specific compliance document or agreement.'],
   ['clearinghouse_setup','Clearinghouse setup assistance','Request staff assistance with account and designation requirements.'],
   ['client_document_template','Client document template','Request a business document template.'],
   ['audit_readiness_export','Audit readiness package','Request preparation of an audit document package.']
  ]
 }
};
const premiumFields={
 company_name:'Company or employer name',program_type:'Testing program (DOT or NON-DOT)',
 dot_agency:'DOT agency (if applicable)',desired_start:'Requested start date',notes:'Additional details',
 participant_name:'Participant full name',effective_date:'Effective date',
 reason:'Reason for change',requested_period:'Selection period',certificate_period:'Certificate period',
 document_type:'Document type',contact_email:'Contact email',dot_number:'USDOT number (if applicable)',
 template_type:'Template type',audit_period:'Audit period'
};
const premiumMarkup=()=>{
 const config=PREMIUM_SERVICES[current];
 const allowed=activeEntitlement?.features?.[current==='consortium'?'consortium':'compliance_docs']===true;
 if(!allowed)return '<div class="premium-locked"><h2>'+escape(config.heading)+'</h2><p>This feature is available to customers with the corresponding purchased plan or active consortium add-on. Your existing Lab Account services remain accessible.</p><a class="dash-action" href="/store.html">View eligible plan upgrades</a></div>';
 return '<div class="premium-workspace"><div class="lab-overview-head"><div><h2>'+escape(config.heading)+'</h2><p>'+escape(config.intro)+'</p></div><a class="dash-action" href="/store.html">My plan</a></div>'+(current==='consortium'?'<section class="dash-card" id="premiumPoolOverview" style="margin-top:18px"><h3>Managed consortium pools</h3><p>Loading your authorized pool information…</p></section>':'')+'<div class="premium-layout"><section class="dash-card"><h3>Request a service</h3><div class="premium-service-grid">'+config.types.map((x,i)=>'<button type="button" class="premium-service-choice" data-premium-type="'+escape(x[0])+'" aria-pressed="'+(i===0?'true':'false')+'"><strong>'+escape(x[1])+'</strong><span>'+escape(x[2])+'</span></button>').join('')+'</div><form id="premiumRequestForm"><h4 id="premiumFormHeading">Service details</h4><div id="premiumFormFields"></div><button type="submit" class="dash-action">Submit service request</button></form><p class="results-message" id="premiumNotice" role="status"></p></section><section class="dash-card"><div class="lab-overview-head"><div><h3>My service requests</h3><p>Track fulfillment and retrieve issued documents.</p></div><button type="button" id="premiumRefresh" class="signout">Refresh</button></div><div id="premiumHistory">Loading authorized records…</div></section></div></div>';
};
async function initPremiumServices(){
 const config=PREMIUM_SERVICES[current];if(!config||activeEntitlement?.features?.[current==='consortium'?'consortium':'compliance_docs']!==true)return;
 const root=document.querySelector('.premium-workspace');if(!root)return;
 const notice=root.querySelector('#premiumNotice'),fields=root.querySelector('#premiumFormFields'),history=root.querySelector('#premiumHistory');
 const serviceMap=new Map(config.types.map(x=>[x[0],x]));
 let active=config.types[0][0],nonce=0;
 const request=async body=>{
  const {data:{session}}=await window.labAccountClient.auth.getSession();
  if(!session)throw Error('Your session expired. Sign in again.');
  const r=await fetch(cfg.supabaseUrl+'/functions/v1/lab-plan-services',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',apikey:cfg.supabasePublishableKey,Authorization:'Bearer '+session.access_token},body:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw Error(d.error||'Service request unavailable');return d;
 };
 if(current==='consortium'){
  const poolRoot=root.querySelector('#premiumPoolOverview');
  if(poolRoot){
   request({action:'overview'}).then(d=>{
    if(!poolRoot.isConnected)return;
    poolRoot.replaceChildren();
    const title=document.createElement('h3');title.textContent='Managed consortium pools';poolRoot.append(title);
    if(!Array.isArray(d.pools)||!d.pools.length){const p=document.createElement('p');p.className='dash-note';p.textContent='No managed pool has been assigned to your organization yet. Use the enrollment request below to contact testing operations.';poolRoot.append(p);return}
    const wrap=document.createElement('div');wrap.className='premium-pool-grid';
    for(const x of d.pools){
      const card=document.createElement('article');card.className='premium-pool';
      const heading=document.createElement('strong');heading.textContent=x.name||'Consortium pool';card.append(heading);
      const items=[['Program',x.program_type||x.pool_type||'—'],['Status',x.status||'Pending'],['Agency',x.dot_agency||'Not applicable'],['Selection schedule',x.selection_schedule||'Not scheduled'],['Active participants',String(x.active_participant_count??0)]];
      for(const [label,value] of items){const p=document.createElement('p');p.textContent=label+': '+value;card.append(p)}
      wrap.append(card);
    }poolRoot.append(wrap);
   }).catch(e=>{poolRoot.querySelector('p').textContent=e.message||'Pool information is unavailable.'});
  }
 }
 const fieldMap={
  consortium_enrollment:['company_name','program_type','dot_agency','desired_start','notes'],
  consortium_participant_add:['participant_name','company_name','program_type','effective_date','notes'],
  consortium_participant_remove:['participant_name','company_name','effective_date','reason'],
  consortium_selection_schedule:['company_name','program_type','requested_period','notes'],
  consortium_certificate:['company_name','certificate_period','notes'],
  compliance_document:['document_type','company_name','notes'],
  clearinghouse_setup:['company_name','dot_number','contact_email','notes'],
  client_document_template:['template_type','company_name','notes'],
  audit_readiness_export:['company_name','audit_period','notes']
 };
 const drawForm=()=>{
  fields.replaceChildren();root.querySelector('#premiumFormHeading').textContent=serviceMap.get(active)[1];
  for(const key of fieldMap[active]||[]){
   const label=document.createElement('label');label.className='premium-form-field';label.textContent=premiumFields[key]||key;
   const el=key==='notes'?document.createElement('textarea'):document.createElement('input');
   el.name=key;el.maxLength=key==='notes'?1200:180;el.required=key==='company_name'||key==='participant_name'||key==='document_type'||key==='template_type'||key==='requested_period';
   el.autocomplete='off';if(el.tagName==='INPUT'){el.type=key==='contact_email'?'email':key==='desired_start'||key==='effective_date'?'date':'text'}
   label.append(el);fields.append(label);
  }
  root.querySelectorAll('[data-premium-type]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.premiumType===active)));
 };
 const refresh=async()=>{
  const n=++nonce;history.textContent='Loading your requests…';
  try{
   const data=await request({action:'list'});if(n!==nonce)return;
   const codes=new Set(config.types.map(x=>x[0]));
   const rows=(data.requests||[]).filter(x=>codes.has(x.service_code));
   if(!rows.length){history.innerHTML='<p class="dash-note">You have not submitted any requests in this category.</p>';return}
   history.replaceChildren();
   for(const x of rows){
    const card=document.createElement('article');card.className='premium-request';
    const title=document.createElement('strong');title.textContent=x.title;card.append(title);
    const p=document.createElement('p');p.textContent=(x.status||'submitted').replaceAll('_',' ')+' · '+new Date(x.created_at).toLocaleDateString();card.append(p);
    if(x.staff_notes){const n=document.createElement('p');n.textContent='Update: '+x.staff_notes;card.append(n)}
    if(x.status==='completed'&&x.document_name){
     const button=document.createElement('button');button.type='button';button.className='signout';button.textContent='Download '+x.document_name;
     button.onclick=async()=>{button.disabled=true;try{const d=await request({action:'download',id:x.id});if(!d.download_url)throw Error('Document unavailable');window.location.assign(d.download_url)}catch(e){notice.textContent=e.message||'Download unavailable'}finally{button.disabled=false}};
     card.append(button);
    }history.append(card);
   }
  }catch(e){history.textContent=e.message||'Cannot load requests'}
 };
 root.querySelectorAll('[data-premium-type]').forEach(b=>b.onclick=()=>{active=b.dataset.premiumType;drawForm()});
 root.querySelector('#premiumRefresh').onclick=refresh;
 root.querySelector('#premiumRequestForm').onsubmit=async e=>{
  e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;notice.textContent='Submitting securely…';
  try{
   const details=Object.fromEntries(new FormData(form).entries());
   await request({action:'create',feature_code:active,title:serviceMap.get(active)[1],details});
   form.reset();notice.textContent='Your service request was submitted to the testing team.';await refresh();
  }catch(e){notice.textContent=e.message||'Unable to submit request'}finally{button.disabled=false}
 };
 drawForm();await refresh();
}

const render=(user,intake={})=>{
 document.body.classList.remove('loading');document.documentElement.classList.remove('s4u-auth-pending');
 const page=names[current]||'Workforce';
 const icons={'dashboard':'⌂','lab-accounts':'⌬','results':'✓','billing':'$','documents':'▤','supplies':'▣','testing-order':'◆','order-history':'≡','client-directory':'▣','ccf-archive':'▤','result-delivery':'↗','supply-alerts':'◷','analytics':'▥','consortium':'◉','compliance-center':'▧','store':'▦'};
 const permittedRoutes=routes.filter(r=>(r.key!=='consortium'&&r.key!=='compliance-center'||activeEntitlement?.features?.[r.key==='consortium'?'consortium':'compliance_docs']===true)&&(!ADVANCED_FEATURES[r.key]||(activeEntitlement?.features?.lab_account===true&&activeEntitlement?.preview!==true)));
 const links=permittedRoutes.map(r=>'<a href="'+r.url+'"'+(r.key===current?' class="active" aria-current="page"':'')+'><span class="ico">'+(icons[r.key]||'•')+'</span><span>'+escape(r.label)+'</span></a>').join('');
 document.querySelector('#workspace').innerHTML='<div class="app"><aside class="side" id="side"><div class="brand"><img src="https://workforce.screenings4u.com/images/logo2.png" alt="Workforce"></div><nav class="nav" id="sideNavigation" aria-label="Workforce navigation"><div class="nav-title">Workforce · Lab Account</div>'+links+'</nav><div class="side-foot"><small>Portal</small><strong>Workforce Lab Account</strong></div></aside><button id="sidebarToggle" class="sidebar-toggle" type="button" aria-controls="side" aria-expanded="true" title="Hide sidebar">‹<span class="sr-only">Hide sidebar</span></button><div class="main"><header class="top"><div class="top-left"><button type="button" class="menu" id="menu" aria-label="Open navigation" aria-controls="mobileNav" aria-expanded="false">☰</button><div class="top-context"><span class="top-eyebrow">Workforce · Lab Account</span><span class="crumb">'+escape(page)+'</span></div></div><div class="top-right"><div class="portal-clock"><span id="portalClockDate"></span><strong id="portalClockTime"></strong></div><div class="top-utility-group"><span class="top-utility-label">Text size</span><div class="font-sizer"><button id="fontDown" type="button" aria-label="Decrease text size">A−</button><button class="font-reset" id="fontSizeValue" type="button" aria-label="Reset text size">Default</button><button id="fontUp" type="button" aria-label="Increase text size">A+</button></div></div><span class="pill">Workforce</span><a href="https://workforceapps.screenings4u.com/selector.html" class="switch-portal">↔ Switch Portal</a><button id="logout" class="signout" type="button">Sign out</button></div></header><section class="mobile-nav" id="mobileNav" aria-hidden="true"><nav class="mobile-nav-links" aria-label="Mobile Workforce navigation">'+links+'</nav></section><div class="content"><section class="hero"><span class="hero-kicker">Workforce · Lab Account</span><h1>'+escape(page)+'</h1><p>Manage your Lab Account workspace securely.</p></section><section class="section"><div class="panel"><div class="panel-head"><h2>'+escape(page)+'</h2></div><div class="panel-body">'+(current==='donor-pass-view'?donorPassMarkup():current==='supply-request'?supplyRequestMarkup():current==='support-ticket'?supportTicketMarkup():current==='testing-order-edit'?testingOrderEditMarkup():detailSpec[current]?detailMarkup():current==='dashboard'?dashboardMarkup(intake):current==='lab-accounts'?labAccountsMarkup():current==='results'?resultsMarkup():current==='billing'?billingMarkup():current==='documents'?documentsMarkup():current==='supplies'?suppliesMarkup():current==='testing-order'?testingOrdersMarkup():current==='specimen-shipment'?specimenShipmentMarkup():current==='order-history'?orderHistoryMarkup():current==='create-testing-order'?newTestingOrderMarkup():current==='support'?supportMarkup():current==='store'?storeMarkup():PREMIUM_SERVICES[current]?premiumMarkup():ADVANCED_FEATURES[current]?advancedMarkup():'<p>This section is ready for account-specific data and workflows.</p><a href="/dashboard.html">Return to dashboard</a>')+'</div></div></section></div></div></div>';
 if(current==='donor-pass-view')initDonorPass();if(current==='supply-request')initSupplyRequest();if(current==='support-ticket')initSupportTicket();if(current==='testing-order-edit')initTestingOrderEdit();if(detailSpec[current])loadRecordDetail();if(current==='store')initLabStore();if(PREMIUM_SERVICES[current])initPremiumServices();if(ADVANCED_FEATURES[current])initAdvancedFeature();if(current==='dashboard')initDashboardPlan();if(current==='lab-accounts')loadLabAccounts();if(current==='support')initSupport();if(current==='create-testing-order')initNewTestingOrder();if(current==='order-history'){loadOrderHistory();document.querySelector('#refreshOrderHistory')?.addEventListener('click',loadOrderHistory)}if(current==='specimen-shipment')initSpecimenShipment();if(current==='testing-order'){loadTestingOrders();document.querySelector('#refreshTestingOrders')?.addEventListener('click',loadTestingOrders)}if(current==='supplies')initSupplies();if(current==='documents'){loadDocuments();document.querySelector('#refreshDocuments')?.addEventListener('click',loadDocuments)}if(current==='billing'){loadBilling();document.querySelector('#refreshBilling')?.addEventListener('click',loadBilling)}if(current==='results'){loadResults();document.querySelector('#refreshResults')?.addEventListener('click',loadResults)}
 // Keep the selected route visible even when the navigation exceeds screen height.
 const side=document.querySelector('#side'),sideNav=document.querySelector('#sideNavigation'),sideToggle=document.querySelector('#sidebarToggle');
 const navActive=sideNav?.querySelector('a[aria-current="page"]');
 if(sideNav&&navActive){
  const center=navActive.offsetTop-sideNav.offsetTop-sideNav.clientHeight/2+navActive.offsetHeight/2;
  sideNav.scrollTop=Math.max(0,center);
 }
 const collapsedKey='workforce_lab_sidebar_collapsed';
 let sideCollapsed=false;
 try{sideCollapsed=localStorage.getItem(collapsedKey)==='1'}catch{}
 const setSidebar=collapsed=>{
  sideCollapsed=collapsed;
  document.body.classList.toggle('sidebar-collapsed',collapsed);
  sideToggle.setAttribute('aria-expanded',String(!collapsed));
  sideToggle.setAttribute('aria-label',collapsed?'Show sidebar':'Hide sidebar');
  sideToggle.title=collapsed?'Show sidebar':'Hide sidebar';
  sideToggle.innerHTML=collapsed?'›<span class="sr-only">Show sidebar</span>':'‹<span class="sr-only">Hide sidebar</span>';
  side.inert=collapsed;
  if(!collapsed&&sideNav&&navActive){
   sideNav.scrollTop=Math.max(0,navActive.offsetTop-sideNav.offsetTop-sideNav.clientHeight/2+navActive.offsetHeight/2);
  }
  try{localStorage.setItem(collapsedKey,collapsed?'1':'0')}catch{}
 };
 sideToggle.addEventListener('click',()=>setSidebar(!sideCollapsed));
 setSidebar(sideCollapsed);
 const logout=document.querySelector('#logout');logout.addEventListener('click',async()=>{await window.labAccountClient.auth.signOut({scope:'local'});location.replace('https://workforceapps.screenings4u.com/')});
 const menu=document.querySelector('#menu'),mobile=document.querySelector('#mobileNav');const close=()=>{mobile.classList.remove('open');menu.setAttribute('aria-expanded','false');mobile.setAttribute('aria-hidden','true')};menu.addEventListener('click',()=>{const open=mobile.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));mobile.setAttribute('aria-hidden',String(!open))});mobile.addEventListener('click',e=>{if(e.target.closest('a'))close()});document.onkeydown=e=>{if(e.key==='Escape')close()};window.onresize=()=>{if(window.innerWidth>820)close()};
 const key='s4u_lab_account_font_size';const setFont=n=>{const v=Math.min(18,Math.max(12,n));document.documentElement.style.setProperty('--portal-font-root',v+'px');try{localStorage.setItem(key,String(v))}catch{}document.querySelector('#fontSizeValue').textContent=v===14?'Default':String(v);return v};let font=14;try{font=Number(localStorage.getItem(key))||14}catch{}font=setFont(font);document.querySelector('#fontDown').onclick=()=>{font=setFont(font-1)};document.querySelector('#fontUp').onclick=()=>{font=setFont(font+1)};document.querySelector('#fontSizeValue').onclick=()=>{font=setFont(14)};
 const clock=()=>{const d=new Date();document.querySelector('#portalClockDate').textContent=new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(d);document.querySelector('#portalClockTime').textContent=new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',hour12:true}).format(d)};clock();if(window.__workforceLabClockTimer)clearInterval(window.__workforceLabClockTimer);window.__workforceLabClockTimer=setInterval(clock,60000);
};
function navigateToPortalPage(path,push=true){
 if(!activeUser||!activeIntake)return false;
 const route=routes.find(r=>r.url===path);
 if(!route)return false;
 if(current===route.key)return true;
 current=route.key;document.body.dataset.portalPage=current;
 if(push)history.pushState({portalPage:current},'',path);
 document.title=route.label+' | Workforce Lab Account';
 render(activeUser,activeIntake);window.scrollTo(0,0);return true;
}
document.addEventListener('click',event=>{
 if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const a=event.target.closest('a[href]');if(!a||a.target&&a.target!=='_self'||a.hasAttribute('download'))return;
 const url=new URL(a.href,location.href);if(url.origin!==location.origin||url.search||url.hash)return;
 if(activeUser&&routes.some(r=>r.url===url.pathname)){event.preventDefault();navigateToPortalPage(url.pathname);}
});
window.addEventListener('popstate',()=>{navigateToPortalPage(location.pathname,false)});
async function boot(){try{if(!cfg?.supabaseUrl||!cfg?.supabasePublishableKey||!window.supabase?.createClient)throw Error('Authentication configuration unavailable');const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{storageKey:cfg.authStorageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});window.labAccountClient=sb;const {data:{session},error:sessionError}=await sb.auth.getSession();if(sessionError||!session?.access_token||!session.user){location.replace('https://workforceapps.screenings4u.com/');return}const user=session.user;const headers={'Content-Type':'application/json',apikey:cfg.supabasePublishableKey,Authorization:'Bearer '+session.access_token};
const [entitlementResponse,intakeResponse]=await Promise.all([
 fetch(cfg.supabaseUrl+'/functions/v1/lab-account-entitlement',{method:'POST',headers,body:'{}'}),
 fetch(cfg.supabaseUrl+'/functions/v1/lab-account-intake-status',{method:'POST',headers,body:'{}'})
]);
const [entitlement,intake]=await Promise.all([entitlementResponse.json().catch(()=>({})),intakeResponse.json().catch(()=>({}))]);
if(!entitlementResponse.ok||entitlement.authorized!==true)throw Error('Your Lab Account access could not be verified. Return to the selector or contact support.');
if(!intakeResponse.ok)throw Error('Unable to check Lab Account intake status. Please try again.');
if(intake.intakeSubmitted!==true){location.replace('/lab-account-intake.html');return}
activeUser=user;activeIntake=intake;activeEntitlement=entitlement;render(user,intake)}catch(e){document.body.classList.remove('loading');document.documentElement.classList.remove('s4u-auth-pending');document.querySelector('#workspace').innerHTML='<main class="workforce-error"><h1>Lab Account access unavailable</h1><p>'+escape(e.message||'Unable to open this workspace.')+'</p><a href="https://workforceapps.screenings4u.com/selector.html">Return to Workforce portal selector</a></main>'}}boot()})();