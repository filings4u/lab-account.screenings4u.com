(()=>{'use strict';
const C=window.PORTAL_CONFIG;
const sb=window.S4UGetSupabaseClient();
const FONT_KEY='s4u_ctpa_font_size';
const FONT_DEFAULT=14, FONT_MIN=12, FONT_MAX=18;
function readFontSize(){const n=Number(localStorage.getItem(FONT_KEY));return Number.isFinite(n)?Math.min(FONT_MAX,Math.max(FONT_MIN,n)):FONT_DEFAULT}
function applyFontSize(n){const v=Math.min(FONT_MAX,Math.max(FONT_MIN,Number(n)||FONT_DEFAULT));document.documentElement.style.setProperty('--portal-font-root',v+'px');localStorage.setItem(FONT_KEY,String(v));const label=document.getElementById('fontSizeValue');if(label)label.textContent=v===FONT_DEFAULT?'Default':String(v);return v}
let portalFontSize=readFontSize();applyFontSize(portalFontSize);
function updatePortalClock(){
  const dateEl=document.getElementById('portalClockDate'),timeEl=document.getElementById('portalClockTime');
  if(!dateEl||!timeEl)return;
  const now=new Date();
  dateEl.textContent=new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(now);
  timeEl.textContent=new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true}).format(now);
}
function startPortalClock(){updatePortalClock();clearInterval(window.__s4uPortalClockTimer);window.__s4uPortalClockTimer=setInterval(updatePortalClock,1000)}
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').toLowerCase().replaceAll('-','_');
const pretty=v=>String(v??'—').replaceAll('_',' ').replace(/\b\w/g,x=>x.toUpperCase());
const fmt=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?esc(v):new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(d)};
const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v||0));
const statusClass=v=>/active|complete|completed|paid|eligible|final|negative|acknowledged|available|enabled/i.test(String(v))?'good':/cancel|inactive|terminated|positive|suspended|overdue|failed|closed/i.test(String(v))?'bad':'warn';
const badge=v=>`<span class="badge ${statusClass(v)}">${esc(pretty(v))}</span>`;
const page=()=>norm(document.body?.dataset?.portalPage||location.pathname.split('/').pop()?.replace('.html','')||'dashboard');
const W=window.S4UCTPAWorkspace;
const workspace=()=>W.read();
const storedSubscription=()=>workspace()?.subscription_id||'';
const SUPPORT_CTX_KEY='s4u_support_context';
function supportCtxRead(){try{return JSON.parse(sessionStorage.getItem(SUPPORT_CTX_KEY)||'{}')||{}}catch{return{}}}
function supportCtxWrite(patch={}){try{sessionStorage.setItem(SUPPORT_CTX_KEY,JSON.stringify({...supportCtxRead(),...patch}))}catch{}}
function rememberSupportPage(){if(page()==='support')return;supportCtxWrite({page_url:location.href,page_title:document.title,page_id:page(),captured_at:new Date().toISOString()})}
function rememberSupportError(message,source='page'){const m=String(message||'').trim();if(!m||m.length<2)return;supportCtxWrite({error_message:m.slice(0,12000),error_source:source,error_at:new Date().toISOString(),page_url:location.href,page_title:document.title,page_id:page()})}
function installSupportDiagnostics(){
  window.addEventListener('error',e=>rememberSupportError(e?.message||e?.error?.message||'JavaScript error','window.error'),true);
  window.addEventListener('unhandledrejection',e=>rememberSupportError(e?.reason?.message||e?.reason||'Unhandled promise rejection','unhandledrejection'));
  const scan=()=>{if(page()==='support')return;const sels=['#error','[data-error]','.testing-modal-error','.documents-error','.selection-error','.employer-modal-error','[role="alert"]'];for(const el of document.querySelectorAll(sels.join(','))){const t=String(el.textContent||'').trim();if(t&&!el.hidden&&t.length>1){rememberSupportError(t,'page-message');break}}};
  const start=()=>{rememberSupportPage();scan();const mo=new MutationObserver(scan);mo.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','class']});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
installSupportDiagnostics();
const stored=()=>workspace()?.membership_id||'';
const storedCtpa=()=>workspace()?.ctpa_id||'';
const saveMid=()=>{};
let NAV=[];
function buildNavigation(ctx={}){
  const e=ctx.entitlements||{};
  const items=[
    ['dashboard','Dashboard','⌂',null],
    ['employers','1. Employers','▣','employer_management'],['people','2. People','●','employee_management'],['programs','3. Programs','◎','programs'],
    ['pools','4. Pools','◉','consortium_pools'],['selections','5. Selections','↻','random_selections'],['testing','6. Testing','◆','testing_orders'],['results','7. Results','✓','results_summary'],
['compliance','Compliance','◇','compliance'],['new-entrant-audits','New Entrant Audits','☑',null],['documents','Documents','▤','documents'],['reports','Reports','▥','standard_reports'],['notifications','Employer Messages','✉','notifications','enterprise'],
    ['create-order','Create Order','＋',null],['price-list','Testing Price List','$',null],['order-services','Add Features','＋',null],['order-history','Order History','≡',null],['subscription','Subscription','◫',null],['billing','screenings4u Billing','$','billing_tools'],['employer-billing','Employer Billing','$','client_invoicing'],
    ['branding','Branding','◐','white_label'],['integrations','Integrations','↔','integrations'],['locations','Locations','⌖','locations'],['lab-accounts','Lab Accounts','⌬',null],['users-roles','Users & Roles','♙','team_users'],['audit-history','Audit & Log History','◷','audit_history'],['schedule-demo','Schedule Demo','◫',null],['attend-demo','Attend Demo','▶',null],['support','Support','? ',null]
  ];
  const enterprise=String(ctx?.plan?.code||ctx?.subscription?.plan_code||'').toLowerCase()==='dot_ctpa_enterprise';
  return items.filter(x=>(!x[3]||e[x[3]]===true)&&(!x[4]||enterprise)).map(x=>({id:x[0],label:x[1],icon:x[2],href:`/${x[0]}.html`}));
}
const cfgPage=id=>NAV.find(x=>norm(x.id)===norm(id))||{id,label:pretty(id),icon:'•',href:`/${id}.html`};

async function getSession(){const {data:{session},error}=await sb.auth.getSession();if(error)throw error;return session}
function ctpaPayload(body={}){const w=workspace();return C.kind==='ctpa'?{ctpa_id:w?.ctpa_id,subscription_id:w?.subscription_id,membership_id:w?.membership_id,...body}:body}
async function invoke(name,body={}){
  const s=await getSession();if(!s)throw Object.assign(new Error('AUTH_REQUIRED'),{status:401});
  const w=workspace();if(!w?.ctpa_id||!w?.subscription_id)throw Object.assign(new Error('C/TPA workspace selection is required.'),{status:409});
  const payload={...body,legacy_endpoint:name,ctpa_id:w.ctpa_id,subscription_id:w.subscription_id,membership_id:w.membership_id||undefined};
  const endpoint=name==='ctpa-new-entrant-audits'?`${C.workforceUrl}/functions/v1/ctpa-new-entrant-audits`:`${C.workforceUrl}/functions/v1/ctpa-dot?forceFunctionRegion=ca-central-1`;
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${s.access_token}`,'apikey':C.workforceKey},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));const em=typeof d.error==='string'?d.error:(d.error?.message||d.message||d.details||d.hint||'');if(!r.ok||d.error)throw Object.assign(new Error(em||`Request failed (${r.status}).`),{status:r.status,payload:d});return d;
}
async function access(){if(window.S4UCTPAVerifiedContext)return window.S4UCTPAVerifiedContext;if(window.S4UCTPAAuthReady)return await window.S4UCTPAAuthReady;throw Object.assign(new Error('Authentication verification is unavailable.'),{status:500})}

function shell(ctx){
  const current=page();
  NAV=buildNavigation(ctx);
  const planLabel=ctx?.plan?.name||ctx?.subscription?.plan_name||C.label;
  const links=NAV.map(x=>`<a href="${esc(x.href||('/'+x.id+'.html'))}" class="${(current===norm(x.id)||(norm(x.id)==='people'&&current==='people_company')||(norm(x.id)==='pools'&&(current==='pool_detail'||current==='pool_form'))||(norm(x.id)==='locations'&&current==='location_form')||(norm(x.id)==='users_roles'&&['staff_form','staff_view','staff_invite','staff_delete'].includes(current)))?'active':''}"><span class="ico">${esc(x.icon||'•')}</span><span>${esc(x.label||pretty(x.id))}</span></a>`).join('');
  document.title=`${cfgPage(current).label} | ${planLabel}`;
  if(current!=='support')supportCtxWrite({page_url:location.href,page_title:document.title,page_id:current,captured_at:new Date().toISOString()});
  document.body.className='';
  document.body.innerHTML=`<div class="app"><aside class="side" id="side"><div class="brand"><img src="images/logo.png" alt="${esc(C.label)}"></div><nav class="nav"><div class="nav-title">${esc(planLabel)}</div>${links}</nav><div class="side-foot"><div style="font-size:0.5625rem;color:#9fb3c7">Portal</div><div style="font-size:0.6875rem;font-weight:800;color:#fff;margin-top:3px">${esc(C.domain)}</div></div></aside><main class="main"><header class="top"><div class="top-left"><button class="menu" id="menu" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="mobileNav"><span class="menu-bars" aria-hidden="true"><span></span><span></span><span></span></span></button><div class="top-context"><span class="top-eyebrow">${esc(planLabel)}</span><span class="crumb">${esc(cfgPage(current).label)}</span></div></div><div class="top-right"><div class="top-utility-group top-time-group"><div class="portal-clock" aria-label="Current date and time"><span id="portalClockDate" class="portal-clock-date"></span><strong id="portalClockTime" class="portal-clock-time"></strong></div></div><div class="top-utility-group top-accessibility-group"><span class="top-utility-label">Text size</span><div class="font-sizer" role="group" aria-label="Page font size"><button type="button" id="fontDown" aria-label="Decrease font size" title="Decrease font size">A−</button><button type="button" class="font-reset" id="fontSizeValue" aria-label="Reset font size to default" title="Reset font size">${portalFontSize===FONT_DEFAULT?'Default':portalFontSize}</button><button type="button" id="fontUp" aria-label="Increase font size" title="Increase font size">A+</button></div></div><div class="top-utility-group top-action-group"><span class="pill">${esc(C.kind==='self'?'Self Service':'Management')}</span>${C.agency?`<span class="pill">${esc(C.agency)}</span>`:''}<button class="top-support${current==='support'?' active':''}" id="supportShortcut" type="button"${current==='support'?' aria-current="page"':''}>Support</button><a href="https://portal.screenings4u.com/selector.html" id="s4uSwitchPortal" aria-label="Switch portal" style="display:inline-flex;align-items:center;justify-content:center;padding:9px 13px;border-radius:9px;background:#ff6b00;color:#fff;font-size:12px;font-weight:800;text-decoration:none;white-space:nowrap">↔ Switch Portal</a><button class="signout" id="logout">Sign out</button></div></div></header><section class="mobile-nav" id="mobileNav" aria-hidden="true" aria-label="Portal navigation"><div class="mobile-nav-inner"><div class="mobile-nav-head"><div><span>Portal navigation</span><strong>${esc(planLabel)}</strong></div><span class="mobile-nav-current">${esc(cfgPage(current).label)}</span></div><nav class="mobile-nav-links">${links}</nav><div class="mobile-nav-foot"><span>${esc(C.domain)}</span><small>Select a page to close this menu.</small></div></div></section><div class="content"><div id="error"></div><section class="hero"><span class="hero-kicker">${esc(planLabel)}</span><h1>${esc(cfgPage(current).label)}</h1><p id="subtitle">C/TPA DOT workspace.</p><div class="hero-actions" id="actions"></div></section><section class="section" id="content"></section></div></main></div>`;
  requestAnimationFrame(()=>{const nav=document.querySelector('.side .nav'),active=nav?.querySelector('a.active');if(nav&&active){const top=active.offsetTop-nav.clientHeight/2+active.clientHeight/2;nav.scrollTop=Math.max(0,top)}});
  const menuBtn=$('#menu'),mobileNav=$('#mobileNav');
  const setMobileNav=open=>{
    const isMobile=window.matchMedia('(max-width: 820px)').matches;
    const next=!!open&&isMobile;
    mobileNav?.classList.toggle('open',next);
    document.body.classList.toggle('mobile-nav-open',next);
    menuBtn?.classList.toggle('open',next);
    menuBtn?.setAttribute('aria-expanded',String(next));
    menuBtn?.setAttribute('aria-label',next?'Close navigation':'Open navigation');
    mobileNav?.setAttribute('aria-hidden',String(!next));
  };
  if(menuBtn&&mobileNav){
    menuBtn.onclick=()=>setMobileNav(!mobileNav.classList.contains('open'));
    mobileNav.addEventListener('click',e=>{if(e.target.closest('a'))setMobileNav(false)});
    window.addEventListener('resize',()=>{if(window.innerWidth>820)setMobileNav(false)},{passive:true});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')setMobileNav(false)});
  }
  startPortalClock();
  const fontDown=$('#fontDown'),fontUp=$('#fontUp'),fontReset=$('#fontSizeValue');
  if(fontDown)fontDown.onclick=()=>{portalFontSize=applyFontSize(portalFontSize-1)};
  if(fontUp)fontUp.onclick=()=>{portalFontSize=applyFontSize(portalFontSize+1)};
  if(fontReset)fontReset.onclick=()=>{portalFontSize=applyFontSize(FONT_DEFAULT)};
  const supportShortcut=$('#supportShortcut');
  if(supportShortcut)supportShortcut.onclick=()=>{
    if(current!=='support')supportCtxWrite({page_url:location.href,page_title:document.title,page_id:current,captured_at:new Date().toISOString(),opened_from:'top_support'});
    if(current!=='support')location.href='/support.html';
  };
  $('#logout').onclick=async()=>{try{if(C.kind==='ctpa')await invoke('workforce-ctpa-admin',{action:'log_portal_event',event_type:'auth.logout',summary:'User signed out',resource_type:'user',resource_id:window.portalCtx?.user?.id||null,user_agent:navigator.userAgent})}catch(_){}W.clear();await clearPageCache();await sb.auth.signOut({scope:'local'});location.replace('https://portal.screenings4u.com/')};
}
function metric(label,value,note=''){return `<div class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(note)}</span></div>`}
function read(o,keys){for(const k of keys){let v=o;for(const p of k.split('.'))v=v?.[p];if(v!==undefined&&v!==null&&v!=='')return v}return'—'}
const dateCell=v=>fmt(v),moneyCell=v=>money(v),badgeCell=v=>badge(v);
const COLS={
  employers:[['Employer',['legal_name','workforce_display_name']],['Status',['status'],badgeCell],['USDOT',['dot_number']],['Contact',['primary_contact_email']],['State',['state']]],
  employees:[['Name',['display_name','first_name']],['Employee #',['employee_number']],['Position',['job_title']],['Agency',['dot_agency']],['Status',['employment_status'],badgeCell]],
  programs:[['Program',['name']],['Type',['program_type'],badgeCell],['Agency',['dot_agency']],['Category',['regulatory_category']],['Status',['status'],badgeCell]],
  pools:[['Pool',['name']],['Type',['pool_type']],['Agency',['dot_agency']],['Drug Rate',['drug_random_rate']],['Status',['status'],badgeCell]],
  selections:[['Date',['selection_date','selected_at'],dateCell],['Type',['selection_type']],['Population',['population_size']],['Drug',['drug_selection_count','drug_selected']],['Status',['status'],badgeCell]],
  testing:[['Order',['order_number']],['Reason',['reason']],['Type',['test_type']],['Program',['programs.name','program_type']],['Status',['status'],badgeCell]],
  results:[['Order',['testing_orders.order_number','order_number']],['Result',['final_status','verified_result'],badgeCell],['Date',['result_date','finalized_at'],dateCell],['MRO',['mro_status'],badgeCell],['Status',['notification_status'],badgeCell]],
  compliance:[['Case',['case_number']],['Event',['event_type']],['Priority',['priority'],badgeCell],['Opened',['opened_at','created_at'],dateCell],['Status',['status'],badgeCell]],
  documents:[['File',['file_name','title']],['Type',['document_type']],['Uploaded',['uploaded_at','created_at'],dateCell],['Expires',['expires_at'],dateCell],['Access',['access_level'],badgeCell]],
  notifications:[['Subject',['subject','event_type']],['Channel',['channel']],['Status',['status'],badgeCell],['Queued',['queued_at'],dateCell]],
  invoices:[['Invoice',['invoice_number']],['Status',['status'],badgeCell],['Total',['total'],moneyCell],['Paid',['amount_paid'],moneyCell],['Due',['amount_due'],moneyCell]],
  credentials:[['Credential',['credential_type']],['Number',['credential_number']],['State',['issuing_state']],['Expires',['expires_at'],dateCell],['Status',['status'],badgeCell]],
  training:[['Training',['training_title','title']],['Provider',['provider']],['Status',['status'],badgeCell],['Completed',['completed_at'],dateCell],['Expires',['expires_at'],dateCell]],
  policies:[['Policy',['policy_name','ctpa_policy_documents.title']],['Status',['status'],badgeCell],['Distributed',['distributed_at'],dateCell],['Acknowledged',['acknowledged_at'],dateCell]],
  accidents:[['Occurred',['occurred_at'],dateCell],['Type',['accident_type']],['Required',['testing_required'],v=>badge(v===true?'required':v===false?'not required':'pending')],['Drug',['drug_test_required'],v=>badge(v===true?'required':'—')],['Alcohol',['alcohol_test_required'],v=>badge(v===true?'required':'—')]],
  members:[['User',['profiles.display_name','profiles.first_name','user_id']],['Role',['roles.name','roles.code']],['Status',['status'],badgeCell],['Primary',['is_primary'],v=>badge(v===true?'yes':'no')]]
};
function table(title,rows,cols){
  const body=rows.length?rows.map(r=>`<tr>${cols.map(c=>`<td>${c[2]?c[2](read(r,c[1])):esc(read(r,c[1]))}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${cols.length}"><div class="empty">No records available.</div></td></tr>`;
  return `<div class="panel"><div class="panel-head"><div><h2>${esc(title)}</h2></div><span class="badge">${rows.length} record${rows.length===1?'':'s'}</span></div><div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div></div>`;
}
function modal(title,fields,onSave){
  const b=document.createElement('div');b.className='modal-backdrop';
  const fieldHtml=fields.map(f=>{const input=f.type==='select'?`<select name="${esc(f.name)}" ${f.required?'required':''}>${(f.options||[]).map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(f.value??'')?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`:`<input type="${esc(f.type||'text')}" name="${esc(f.name)}" value="${esc(f.value||'')}" ${f.required?'required':''}>`;return `<div class="field ${f.full?'full':''}"><label>${esc(f.label)}</label>${input}</div>`}).join('');
  b.innerHTML=`<form class="modal"><h2>${esc(title)}</h2><div class="modal-grid">${fieldHtml}</div><div class="modal-actions"><button type="button" class="btn ghost" data-cancel>Cancel</button><button type="submit" class="btn primary">Save</button></div></form>`;
  document.body.appendChild(b);b.querySelector('[data-cancel]').onclick=()=>b.remove();
  b.querySelector('form').onsubmit=async e=>{e.preventDefault();try{const v=Object.fromEntries(new FormData(e.currentTarget).entries());await onSave(v);b.remove();await render(window.portalCtx)}catch(err){window.S4UDialog.alert(err.message||String(err))}};
}
function setSubtitle(v){$('#subtitle').textContent=v}
function addAction(label,fn,secondary=false){const b=document.createElement('button');b.className=`btn ${secondary?'secondary':'primary'}`;b.textContent=label;b.onclick=fn;$('#actions').appendChild(b)}

function isUtilityPage(p){return ['integrations','audit-history','locations','users-roles'].includes(norm(p).replaceAll('_','-'))}
async function utilityData(p){
  p=norm(p).replaceAll('_','-');
  if(C.kind==='self'){
    const a={integrations:'portal_integrations','audit-history':'audit_history',locations:'locations','users-roles':'users_roles'}[p];
    return invoke('workforce-employee-portal',{action:a,membership_id:stored()});
  }
  if(C.kind==='ctpa'){
    if(p==='integrations')return invoke('workforce-ctpa-admin',{action:'workspace',scope:'integrations'}).catch(e=>({integrations:[],not_enabled:true,message:e.message||String(e),access_mode:'view_only'}));
    if(p==='audit-history'){const eventId=new URLSearchParams(location.search).get('event_id');return eventId?invoke('workforce-ctpa-admin',{action:'audit_detail',event_id:eventId}):invoke('workforce-ctpa-admin',{action:'workspace',scope:'audit'});}
    if(p==='locations')return invoke('workforce-ctpa-locations',{action:'workspace'});
  if(p==='lab_accounts')return invoke('workforce-ctpa-lab-accounts',{action:'workspace'});
  if(p==='schedule_demo'||p==='attend_demo')return invoke('workforce-ctpa-demos',{action:'workspace'});
    if(p==='users-roles')return invoke('workforce-ctpa-admin',{action:'workspace',scope:'staff'}).then(x=>({...x,access_mode:x.can_manage?'manage':'view_only'})).catch(e=>({members:[],roles:[],not_enabled:true,message:e.message||String(e),access_mode:'view_only'}));
  }
  if(p==='integrations')return invoke('workforce-employer-advanced',{action:'integrations'}).catch(e=>({integrations:[],not_enabled:true,message:e.message||String(e),access_mode:'view_only'}));
  if(p==='audit-history')return invoke('workforce-employer-management',{action:'audit'});
  if(p==='locations')return invoke('workforce-employer-management',{action:'locations'});
  if(p==='users-roles')return invoke('workforce-employer-management',{action:'members'}).then(x=>({...x,access_mode:window.portalCtx?.membership?.role_code==='employer_admin'?'manage':'limited'}));
  return {};
}
function utilityPersonName(m){const p=m?.profile||m?.profiles||m?.actor_profile||{};return p.full_name||p.display_name||[p.first_name,p.last_name].filter(Boolean).join(' ')||m?.user_id||m?.actor_user_id||'Portal user'}
function utilityIntegrationsView(d){
  if(d?.not_enabled)return `<div class="notice"><strong>Integrations</strong><br>${esc(d.message||'Integrations are not enabled for this account yet.')}</div>`;
  const catalog=d.catalog||[],enable=d.enablements||[],legacy=d.integrations||[];
  const em=new Map(enable.map(x=>[String(x.integration_catalog_id),x]));
  const cards=catalog.map(x=>{const e=em.get(String(x.id)),on=e?.enabled===true||['active','enabled','connected'].includes(norm(e?.status));return `<article class="card utility-card"><div class="panel-head"><div><h3>${esc(x.name||x.code)}</h3><p>${esc(x.provider||x.category||'Integration')}</p></div>${badge(on?'enabled':(e?.status||'available'))}</div><p>${esc(x.description||'Connect this service to your DOT workspace.')}</p><small>${esc(x.category||'Integration')}</small></article>`}).join('');
  const rows=legacy.map(x=>`<tr><td><strong>${esc(x.name||x.provider||'Integration')}</strong><small>${esc(x.provider||x.integration_type||'')}</small></td><td>${badge(x.status||'unknown')}</td><td>${fmt(x.last_sync_at)}</td><td>${fmt(x.updated_at)}</td>${d.can_manage?`<td><button class="mini-btn" data-integration-id="${esc(x.id)}">Manage</button></td>`:''}</tr>`).join('');
  return `${cards?`<div class="cards utility-grid">${cards}</div>`:'<div class="panel"><div class="empty">No integration catalog entries are available.</div></div>'}${legacy.length?`<div class="section panel"><div class="panel-head"><div><h2>Connected Integrations</h2><p>Current tenant-level integration connections.</p></div></div><div class="table-wrap"><table><thead><tr><th>Integration</th><th>Status</th><th>Last Sync</th><th>Updated</th>${d.can_manage?'<th></th>':''}</tr></thead><tbody>${rows}</tbody></table></div></div>`:''}`;
}
function utilityAuditView(d){
  if(d?.event){const x=d.event,p=x.actor_profile||{},em=x.employer||null;const before=x.before_data?`<pre class="audit-json">${esc(JSON.stringify(x.before_data,null,2))}</pre>`:'<div class="empty">No prior-state snapshot.</div>';const after=x.after_data?`<pre class="audit-json">${esc(JSON.stringify(x.after_data,null,2))}</pre>`:'<div class="empty">No resulting-state snapshot.</div>';const details=x.details&&Object.keys(x.details).length?`<pre class="audit-json">${esc(JSON.stringify(x.details,null,2))}</pre>`:'<div class="empty">No additional metadata.</div>';return `<div class="panel audit-detail-panel"><div class="panel-head"><div><h2>Audit Event Details</h2><p>Complete activity record for this event.</p></div><a class="mini-btn" href="/audit-history.html">Back to Audit & Log History</a></div><div class="detail-grid"><div><small>Date / Time</small><strong>${fmt(x.occurred_at||x.event_at)}</strong></div><div><small>Event</small><strong>${esc(pretty(x.event_type||x.action||'activity'))}</strong></div><div><small>Actor</small><strong>${esc([p.first_name,p.last_name].filter(Boolean).join(' ')||x.actor_name||x.actor_email||'System')}</strong></div><div><small>Actor Type</small><strong>${esc(pretty(x.actor_type||'system'))}</strong></div><div><small>Customer</small><strong>${esc(em?.dba_name||em?.legal_name||'C/TPA Account')}</strong></div><div><small>Portal</small><strong>${esc(pretty(x.source_portal||'unknown'))}</strong></div><div><small>Resource</small><strong>${esc(pretty(x.resource_type||'record'))}</strong><small>${esc(x.resource_id||'')}</small></div><div><small>Summary</small><strong>${esc(x.summary||pretty(x.action||'activity'))}</strong></div></div><div class="audit-snapshot-grid"><section><h3>Before</h3>${before}</section><section><h3>After</h3>${after}</section></div><div class="section audit-details-section"><h3>Additional Details</h3>${details}</div></div>`}
  const rows=d.audit_events||d.events||[],s=d.summary||{},types=d.event_types||[...new Set(rows.map(x=>x.event_type).filter(Boolean))].sort();
  const body=rows.map(x=>{const actor=x.actor_profile||{},em=x.employer||null,actorType=String(x.actor_type||'system'),eventType=String(x.event_type||x.action||'activity');return `<tr data-actor-type="${esc(actorType)}" data-event-type="${esc(eventType)}"><td class="audit-date">${fmt(x.occurred_at||x.event_at)}</td><td><strong>${esc(pretty(eventType))}</strong><small>${esc(x.summary||'')}</small></td><td><strong>${esc(utilityPersonName({...x,actor_profile:actor}))}</strong><small>${esc(pretty(actorType))}</small></td><td>${esc(em?.dba_name||em?.legal_name||(actorType==='ctpa_staff'?'C/TPA Account':'—'))}</td><td><strong>${esc(pretty(x.resource_type||'record'))}</strong><small>${esc(x.resource_id||'')}</small></td><td class="audit-actions"><a class="mini-btn" href="/audit-history.html?event_id=${encodeURIComponent(x.id)}">View</a></td></tr>`}).join('');
  const typeOptions=types.map(t=>`<option value="${esc(String(t))}">${esc(pretty(t))}</option>`).join('');
  return `<div class="metrics audit-metrics"><div class="metric"><small>Total Activity</small><strong>${s.total??rows.length}</strong><span>Current audit scope</span></div><div class="metric"><small>Customer Activity</small><strong>${s.customer_activity??rows.filter(x=>x.actor_type==='customer').length}</strong><span>Employer and Owner-Operator activity</span></div><div class="metric"><small>C/TPA Activity</small><strong>${s.ctpa_activity??rows.filter(x=>x.actor_type==='ctpa_staff').length}</strong><span>Internal portal changes</span></div><div class="metric"><small>Logins</small><strong>${s.logins??rows.filter(x=>x.event_type==='auth.login').length}</strong><span>Recorded sign-ins</span></div></div><div class="panel section audit-panel"><div class="panel-head"><div><h2>Audit & Log History</h2><p>Customer activity, staff changes, documents, messages, testing, compliance, billing, integrations, and sign-ins.</p></div><div class="table-actions"><span class="badge good">Live</span><span class="badge">${rows.length} event${rows.length===1?'':'s'}</span></div></div><div class="audit-toolbar"><div class="audit-search-wrap"><label for="auditSearch">Search</label><input id="auditSearch" type="search" placeholder="Search activity, actor, customer, resource…"></div><div><label for="auditActorFilter">Actor</label><select id="auditActorFilter"><option value="">All actors</option><option value="customer">Customer</option><option value="ctpa_staff">C/TPA staff</option><option value="system">System</option></select></div><div><label for="auditTypeFilter">Event</label><select id="auditTypeFilter"><option value="">All event types</option>${typeOptions}</select></div></div><div class="table-wrap audit-table-wrap"><table id="auditTable"><thead><tr><th>Date / Time</th><th>Activity</th><th>Actor</th><th>Customer</th><th>Resource</th><th>Actions</th></tr></thead><tbody>${body||'<tr class="audit-empty-row"><td colspan="6"><div class="empty"><strong>No audit events found.</strong><br>New customer and C/TPA activity will appear here automatically.</div></td></tr>'}</tbody></table></div></div>`;
}
function utilityLocationsView(d){
  const rows=d.locations||[],manage=d.access_mode==='manage'||d.can_manage===true;
  const body=rows.map(x=>{const owner=x.owner_name||x.employer?.dba_name||x.employer?.legal_name||'';const ownerType=x.owner_type==='ctpa'?'C/TPA':x.owner_type==='owner_operator'?'Owner-Operator':'Employer';const addr=[x.address_line1,x.address_line2,x.city,x.state,x.postal_code].filter(Boolean).join(', ');const edit=manage&&C.kind==='ctpa'?`<td><a class="mini-btn" href="/location-form.html?id=${encodeURIComponent(x.id)}&target_type=${encodeURIComponent(x.owner_type==='ctpa'?'ctpa':'employer')}&owner_id=${encodeURIComponent(x.owner_id||x.employer_id||'')}">Edit</a></td>`:(manage?`<td><button class="mini-btn" data-location-id="${esc(x.id)}">Edit</button></td>`:'');return `<tr><td><strong>${esc(x.name||'Location')}</strong><small>${esc(pretty(x.location_type||'worksite'))}</small></td><td><strong>${esc(owner||'—')}</strong><small>${esc(ownerType)}</small></td><td>${esc(addr||'—')}</td><td>${esc(x.phone||'—')}</td><td>${badge(x.status||'active')}</td><td>${x.is_primary?'<span class="badge good">Primary</span>':'—'}</td>${edit}</tr>`}).join('');
  const note=d.assigned_only?'<div class="notice">This page shows the location currently assigned to your employee record.</div>':'';
  return `${note}<div class="metrics"><div class="metric"><small>All Locations</small><strong>${rows.length}</strong><span>C/TPA, Employer, and Owner-Operator locations</span></div><div class="metric"><small>C/TPA</small><strong>${rows.filter(x=>x.owner_type==='ctpa').length}</strong><span>Your own offices and worksites</span></div><div class="metric"><small>Employer</small><strong>${rows.filter(x=>x.owner_type==='employer').length}</strong><span>Managed Employer locations</span></div><div class="metric"><small>Owner-Operator</small><strong>${rows.filter(x=>x.owner_type==='owner_operator').length}</strong><span>Owner-Operator locations</span></div></div><div class="panel section"><div class="panel-head"><div><h2>Locations</h2><p>${C.kind==='ctpa'?'All locations across your C/TPA account, Employers, and Owner-Operators.':'Company work sites and operating locations.'}</p></div><span class="badge">${rows.length} location${rows.length===1?'':'s'}</span></div><div class="table-wrap"><table><thead><tr><th>Location</th><th>Account</th><th>Address</th><th>Phone</th><th>Status</th><th>Primary</th>${manage?'<th>Actions</th>':''}</tr></thead><tbody>${body||'<tr><td colspan="7"><div class="empty">No locations are configured yet.</div></td></tr>'}</tbody></table></div></div>`;
}
function utilityUsersRolesView(d){
  if(d?.not_enabled)return `<div class="notice"><strong>Users & Roles</strong><br>${esc(d.message||'User management is not enabled for this account yet.')}</div>`;
  if(C.kind==='ctpa'&&window.CtpaStaff)return window.CtpaStaff.list(d);
  const rows=d.members||[];return table('Users & Roles',rows,COLS.members);
}
function renderUtilityPage(p,d){
  p=norm(p).replaceAll('_','-');
  if(p==='integrations')return utilityIntegrationsView(d);
  if(p==='audit-history')return utilityAuditView(d);
  if(p==='locations')return utilityLocationsView(d);
  if(p==='users-roles')return utilityUsersRolesView(d);
  return '<div class="panel"><div class="empty">No utility data available.</div></div>';
}
function bindUtilityPage(p,d,ctx){
  if(p==='audit_history'&&C.kind==='ctpa'){setSubtitle(new URLSearchParams(location.search).get('event_id')?'Detailed audit event record including actor, account, resource, before/after changes, and metadata.':'Review customer activity, C/TPA portal changes, sign-ins, documents, messages, testing, billing, and other operational logs.')}
  if(p==='locations'&&d.access_mode==='manage'&&C.kind==='ctpa'){
    const actions=document.querySelector('#actions');if(actions)actions.innerHTML='<a class="btn primary" href="/location-form.html">Add Location</a>';
  }
  p=norm(p).replaceAll('_','-');
  if(p==='locations'&&d.access_mode==='manage'&&C.kind!=='ctpa'&&C.kind!=='self'){
    const openLocation=(x={})=>modal(x.id?'Edit Location':'Add Location',[
      {name:'name',label:'Location name',value:x.name||'',required:true},{name:'location_type',label:'Location type',value:x.location_type||'work_site'},
      {name:'address_line1',label:'Address line 1',value:x.address_line1||'',full:true},{name:'address_line2',label:'Address line 2',value:x.address_line2||'',full:true},
      {name:'city',label:'City',value:x.city||''},{name:'state',label:'State',value:x.state||''},{name:'postal_code',label:'ZIP / postal code',value:x.postal_code||''},
      {name:'phone',label:'Phone',type:'tel',value:x.phone||''},{name:'timezone',label:'Timezone',value:x.timezone||''},
      {name:'status',label:'Status',type:'select',value:x.status||'active',options:[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'}]},
      {name:'is_primary',label:'Primary location',type:'select',value:x.is_primary?'true':'false',options:[{value:'false',label:'No'},{value:'true',label:'Yes'}]}
    ],async v=>invoke('workforce-employer-management',{action:'save_location',location:{...v,id:x.id||undefined,is_primary:String(v.is_primary)==='true'}}));
    addAction('Add Location',()=>openLocation({}));
    document.querySelectorAll('[data-location-id]').forEach(b=>b.onclick=()=>{const x=(d.locations||[]).find(y=>String(y.id)===String(b.dataset.locationId));if(x)openLocation(x)});
  }
  if(p==='audit-history'){
    const search=document.getElementById('auditSearch'),actor=document.getElementById('auditActorFilter'),type=document.getElementById('auditTypeFilter');
    const apply=()=>{const q=String(search?.value||'').trim().toLowerCase(),a=String(actor?.value||''),t=String(type?.value||'');document.querySelectorAll('#auditTable tbody tr[data-actor-type]').forEach(tr=>{const txt=String(tr.textContent||'').toLowerCase(),actorMatch=!a||String(tr.dataset.actorType||'')===a,typeMatch=!t||String(tr.dataset.eventType||'')===t,searchMatch=!q||txt.includes(q);tr.hidden=!(actorMatch&&typeMatch&&searchMatch)})};
    if(search)search.oninput=apply;if(actor)actor.onchange=apply;if(type)type.onchange=apply;
  }
  if(p==='users-roles'&&C.kind==='ctpa'){
    const actions=document.querySelector('#actions');
    if(actions)actions.innerHTML='<a class="btn primary" href="/staff-form.html">Add Staff Member</a>';
  }
  if(p==='integrations'&&d.can_manage&&C.kind==='ctpa'){
    document.querySelectorAll('[data-integration-id]').forEach(b=>b.onclick=()=>{const x=(d.integrations||[]).find(y=>String(y.id)===String(b.dataset.integrationId));if(!x)return;modal('Manage Integration',[{name:'status',label:'Status',type:'select',value:x.status||'inactive',options:[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'},{value:'disabled',label:'Disabled'}]}],async v=>invoke('workforce-ctpa-admin',{action:'save_integration_status',integration:{id:x.id,status:v.status}}))});
  }
}

async function ctpaData(p){
  if(p==='employers'||p==='employer_form')return invoke('workforce-ctpa-employers',{action:'workspace'});
  if(p==='owner_operators')return invoke('workforce-ctpa-owner-operators',{action:'workspace'});
  if(p==='new_entrant_audits'){const id=new URLSearchParams(location.search).get('id')||'';return invoke('ctpa-new-entrant-audits',id?{action:'audit',audit_id:id}:{action:'workspace'});}
  if(p==='people'||p==='people_form'||p==='people_company'||p==='programs'||p==='program_form'||p==='program_detail')return invoke('workforce-ctpa-employees-programs',{action:'workspace'});
  if(p==='pools'||p==='pool_detail'||p==='pool_form')return invoke('workforce-ctpa-pools',{action:'workspace'});
  if(p==='selections'||p==='selection_detail')return invoke('workforce-ctpa-selections',{action:'workspace'});
  if(p==='testing'||p==='testing_order')return invoke('workforce-ctpa-testing',{action:'workspace'});
  if(p==='results')return invoke('workforce-ctpa-results',{action:'workspace'});
  if(p==='result_detail'){const id=new URLSearchParams(location.search).get('id')||'';return invoke('workforce-ctpa-results',{action:'get_report',report_id:id});}
  if(p==='compliance')return invoke('workforce-ctpa-compliance',{action:'workspace'});
  if(p==='documents')return invoke('workforce-ctpa-documents',{action:'workspace'});
  if(p==='reports'||p==='report_generate')return invoke('workforce-ctpa-reports',{action:'workspace'});
  if(p==='report_view'||p==='report_archive'){const id=new URLSearchParams(location.search).get('id')||'';return invoke('workforce-ctpa-reports',{action:'get_report',report_id:id});}
  if(p==='notifications')return invoke('workforce-ctpa-notifications',{action:'workspace'});
  if(p==='order_history')return invoke('workforce-ctpa-admin',{action:'workspace',scope:'order-history'});
  if(p==='subscription')return invoke('workforce-ctpa-admin',{action:'workspace',scope:'subscription'});
  if(p==='billing')return invoke('workforce-ctpa-admin',{action:'workspace',scope:'account_billing'});
  if(['employer_billing','employer_invoice_form','employer_invoice_view','employer_invoice_send','employer_invoice_delete','employer_remittance'].includes(p))return invoke('workforce-ctpa-admin',{action:'workspace',scope:'billing'});
  if(p==='branding')return invoke('workforce-ctpa-portal',{action:'workspace',scope:'branding'});
  if(p==='integrations')return invoke('workforce-ctpa-integrations',{action:'workspace'});
  if(p==='integration_connect'){const id=new URLSearchParams(location.search).get('integration_id')||'';return invoke('workforce-ctpa-integrations',{action:'detail',integration_id:id});}
  if(p==='integration_workspace'){const id=new URLSearchParams(location.search).get('id')||'';return invoke('workforce-ctpa-integrations',{action:'detail',connection_id:id});}
  if(p==='locations')return invoke('workforce-ctpa-locations',{action:'workspace'});
  if(p==='lab_accounts')return invoke('workforce-ctpa-lab-accounts',{action:'workspace'});
  if(p==='schedule_demo'||p==='attend_demo')return invoke('workforce-ctpa-demos',{action:'workspace'});
  if(p==='location_form'){const q=new URLSearchParams(location.search),id=q.get('id')||'';return id?invoke('workforce-ctpa-locations',{action:'get_location',location_id:id,target_type:q.get('target_type')||'employer'}):invoke('workforce-ctpa-locations',{action:'workspace'});}
  if(p==='users_roles')return invoke('workforce-ctpa-admin',{action:'workspace',scope:'staff'});
  if(p==='staff_form')return invoke('workforce-ctpa-admin',{action:'workspace',scope:'staff'});
  if(['staff_view','staff_invite','staff_delete'].includes(p)){const id=new URLSearchParams(location.search).get('id')||'';return invoke('workforce-ctpa-admin',{action:'get_staff',membership_id:id});}
  if(p==='support'){const id=new URLSearchParams(location.search).get('ticket_id')||'';return id?invoke('workforce-support',{action:'thread',ticket_id:id}):invoke('workforce-support',{action:'workspace'});}
  if(p==='create_order'&&window.CtpaStoreOrders)return window.CtpaStoreOrders.load();
  if(p==='price_list'&&window.CtpaPriceList)return window.CtpaPriceList.load();
  if(p==='order_services')return invoke('workforce-ctpa-features',{action:'workspace'});
  const scope={dashboard:'dashboard',employers:'all',selections:'selections',results:'results',reports:'reports'}[p]||'dashboard';
  return invoke('workforce-ctpa-portal',{action:'workspace',scope});
}
async function employerData(p){
  if(C.kind==='agency')return invoke('workforce-employer-management',{action:'agency_workspace',agency_code:C.agency});
  if(p==='testing')return invoke('workforce-employer-testing',{action:'list'}).catch(()=>invoke('workforce-employer-management',{action:'overview'}));
  if(p==='pools')return invoke('workforce-employer-pools',{action:'workspace'});
  if(p==='selections')return invoke('workforce-employer-pools',{action:'selection_history'}).catch(()=>invoke('workforce-employer-management',{action:'selection_history'}));
  if(p==='documents')return invoke('workforce-employer-documents',{action:'workspace'});
  if(p==='results')return invoke('workforce-employer-results',{action:'workspace'}).catch(()=>invoke('workforce-employer-management',{action:'results'}));
  if(p==='notifications')return invoke('workforce-employer-notifications',{action:'workspace'}).catch(()=>invoke('workforce-employer-management',{action:'notifications'}));
  const map={dashboard:'overview',company:'settings',people:'overview',programs:'overview',pools:'overview',selections:'selection_history',compliance:'compliance_detail',reports:'reports',billing:'subscription',team:'members','post-accident':'overview'};
  return invoke('workforce-employer-management',{action:map[p]||'overview'});
}
async function selfData(){return invoke('workforce-employee-portal',{action:'workspace',membership_id:stored()})}
async function serviceCatalog(){const r=await fetch(`${C.workforceUrl}/functions/v1/ctpa-dot?forceFunctionRegion=ca-central-1`,{method:'POST',headers:{'Content-Type':'application/json','apikey':C.workforceKey,'Authorization':`Bearer ${(await getSession())?.access_token||''}`},body:JSON.stringify(window.S4UCTPAPayload({legacy_endpoint:'portal-order-catalog',action:'workspace'}))});const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw new Error(d.error||'Unable to load services.');return d}

function dashboard(ctx,d){
  if(C.kind==='self'){
    const m=[['Testing',(d.testing_orders||[]).length,'My testing orders'],['Results',(d.results||d.result_reports||[]).length,'My available results'],['Documents',(d.documents||[]).length,'My documents'],['Training',(d.training||[]).length,'My training records']];
    return `<div class="metrics">${m.map(x=>metric(...x)).join('')}</div>`;
  }
  if(C.kind!=='ctpa'){
    const m=[['People',(d.employees||[]).length,'Company roster'],['Programs',(d.programs||[]).length,'Programs'],['Testing',(d.testing_orders||d.orders||[]).length,'Orders'],['Compliance',(d.compliance_cases||d.cases||[]).filter(x=>!['closed','resolved'].includes(norm(x.status))).length,'Open cases']];
    return `<div class="metrics">${m.map(x=>metric(...x)).join('')}</div>`;
  }

  const employers=d.employers||[],employees=d.employees||[],programs=d.programs||[],pools=d.pools||[],selections=d.selection_events||[],tests=d.testing_orders||[],results=d.results||[],cases=d.compliance_cases||[],notes=d.notifications||[],invoices=d.client_invoices||[];
  const activePrograms=programs.filter(x=>['active','enabled'].includes(norm(x.status))).length;
  const activePools=pools.filter(x=>!['inactive','archived','closed'].includes(norm(x.status))).length;
  const openTests=tests.filter(x=>!['complete','completed','cancelled','canceled','final','closed'].includes(norm(x.status))).length;
  const pendingSelections=selections.filter(x=>!['complete','completed','closed','cancelled','canceled'].includes(norm(x.status))).length;
  const openCases=cases.filter(x=>!['closed','resolved','complete','completed'].includes(norm(x.status))).length;
  const criticalCases=cases.filter(x=>!['closed','resolved','complete','completed'].includes(norm(x.status))&&['critical','high','urgent'].includes(norm(x.priority))).length;
  const unreadNotes=notes.filter(x=>!['read','acknowledged','completed','sent'].includes(norm(x.status))).length;
  const outstanding=invoices.reduce((n,x)=>n+Number(x.amount_due||0),0);
  const overdueInvoices=invoices.filter(x=>Number(x.amount_due||0)>0&&x.due_at&&new Date(x.due_at)<new Date()).length;
  const entitlement=d.entitlements||{};

  const metrics=[
    ['Employers',employers.length,'Managed client companies'],
    ['Covered People',employees.length,'Drivers and employees'],
    ['Active Programs',activePrograms,'DOT testing programs'],
    ['Active Pools',activePools,'Random pools'],
    ['Open Testing',openTests,'Orders still in progress'],
    ['Pending Randoms',pendingSelections,'Selection events requiring action'],
    ['Open Compliance',openCases,criticalCases?`${criticalCases} high priority`:'No high-priority cases'],
    ['Outstanding Invoices',money(outstanding),overdueInvoices?`${overdueInvoices} overdue`:'No overdue invoices']
  ];

  const byEmployer=employers.map(e=>{
    const eid=e.id,workerCount=employees.filter(x=>x.employer_id===eid).length,programCount=programs.filter(x=>x.employer_id===eid).length,testOpen=tests.filter(x=>x.employer_id===eid&&!['complete','completed','cancelled','canceled','final','closed'].includes(norm(x.status))).length,caseOpen=cases.filter(x=>x.employer_id===eid&&!['closed','resolved','complete','completed'].includes(norm(x.status))).length;
    const health=caseOpen?`${caseOpen} open compliance`:(testOpen?`${testOpen} tests in progress`:'Good standing');
    const healthClass=caseOpen?'bad':testOpen?'warn':'good';
    return `<tr><td><strong>${esc(e.legal_name||e.dba_name||'Employer')}</strong><small>${esc(e.dot_number?`USDOT ${e.dot_number}`:(e.state||''))}</small></td><td>${workerCount}</td><td>${programCount}</td><td>${testOpen}</td><td><span class="badge ${healthClass}">${esc(health)}</span></td><td><a class="snapshot-link" href="/employers.html">Open</a></td></tr>`;
  }).join('')||`<tr><td colspan="6"><div class="empty">No employers have been added yet.</div></td></tr>`;

  const attention=[];
  if(criticalCases)attention.push([`${criticalCases} high-priority compliance case${criticalCases===1?'':'s'}`,'/compliance.html','Review compliance']);
  if(openTests)attention.push([`${openTests} testing order${openTests===1?'':'s'} still in progress`,'/testing.html','Review testing']);
  if(pendingSelections)attention.push([`${pendingSelections} random selection event${pendingSelections===1?'':'s'} requiring action`,'/selections.html','Review selections']);
  if(overdueInvoices)attention.push([`${overdueInvoices} overdue client invoice${overdueInvoices===1?'':'s'}`,'/employer-billing.html','Review Employer billing']);
  if(entitlement.notifications&&unreadNotes)attention.push([`${unreadNotes} notification${unreadNotes===1?'':'s'} requiring attention`,'/notifications.html','Open notifications']);
  if(!attention.length)attention.push(['No urgent items need attention right now.','#','Company is current']);

  const recentTests=tests.slice(0,6).map(x=>`<tr><td>${esc(x.order_number||'—')}</td><td>${esc((employers.find(e=>e.id===x.employer_id)||{}).legal_name||'—')}</td><td>${esc(pretty(x.reason||'—'))}</td><td>${badge(x.status)}</td></tr>`).join('')||`<tr><td colspan="4"><div class="empty">No recent testing activity.</div></td></tr>`;
  const recentResults=results.slice(0,6).map(x=>`<tr><td>${esc(x.testing_order_id||x.id||'—')}</td><td>${badge(x.final_status||x.verified_result||x.status||'available')}</td><td>${fmt(x.result_date||x.finalized_at||x.created_at)}</td></tr>`).join('')||`<tr><td colspan="3"><div class="empty">No recent results.</div></td></tr>`;
  const recentActivity=[...tests.map(x=>({type:'Testing',label:x.order_number||pretty(x.reason),date:x.updated_at||x.created_at,status:x.status})),...cases.map(x=>({type:'Compliance',label:x.case_number||pretty(x.event_type),date:x.updated_at||x.created_at,status:x.status})),...selections.map(x=>({type:'Random',label:pretty(x.selection_type||'Selection event'),date:x.updated_at||x.selection_date||x.created_at,status:x.status}))].sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).slice(0,8);

  return `<div class="metrics snapshot-metrics">${metrics.map(x=>metric(...x)).join('')}</div>
  <div class="section snapshot-grid">
    <div class="panel"><div class="panel-head"><div><h2>Attention Required</h2><p>Items that may need action today.</p></div></div><div class="snapshot-attention">${attention.map(([label,href,action])=>href==='#'?`<div class="attention-row good"><div><strong>${esc(label)}</strong><span>${esc(action)}</span></div></div>`:`<a class="attention-row" href="${href}"><div><strong>${esc(label)}</strong><span>${esc(action)}</span></div><span>→</span></a>`).join('')}</div></div>
    <div class="panel"><div class="panel-head"><div><h2>Plan Snapshot</h2><p>Current subscription and enabled premium services.</p></div></div><div class="snapshot-plan"><strong>${esc(d.subscription?.plans?.name||'DOT C/TPA Plan')}</strong><span>${esc(d.subscription?.status?pretty(d.subscription.status):'Active')}</span><div class="plan-chips">${[['Advanced Reports','advanced_reports'],['Employer Portal Delivery','customer_portal_delivery'],['White Label','white_label'],['Branded Email','branded_email'],['Payment Processing','client_payments']].filter(([,k])=>entitlement[k]).map(([l])=>`<span>${esc(l)}</span>`).join('')||'<span>Core C/TPA Management</span>'}</div></div></div>
  </div>
  <div class="section"><div class="panel"><div class="panel-head"><div><h2>Employer Health</h2><p>Operational snapshot across every managed client.</p></div><a class="snapshot-link" href="/employers.html">Manage Employers</a></div><div class="table-wrap"><table><thead><tr><th>Employer</th><th>People</th><th>Programs</th><th>Open Tests</th><th>Health</th><th></th></tr></thead><tbody>${byEmployer}</tbody></table></div></div></div>
  <div class="section snapshot-grid">
    <div class="panel"><div class="panel-head"><div><h2>Recent Testing</h2><p>Latest testing activity across client employers.</p></div><a class="snapshot-link" href="/testing.html">View Testing</a></div><div class="table-wrap"><table><thead><tr><th>Order</th><th>Employer</th><th>Reason</th><th>Status</th></tr></thead><tbody>${recentTests}</tbody></table></div></div>
    ${entitlement.results_summary?`<div class="panel"><div class="panel-head"><div><h2>Recent Results</h2><p>Most recently posted result records.</p></div><a class="snapshot-link" href="/results.html">View Results</a></div><div class="table-wrap"><table><thead><tr><th>Order / Result</th><th>Result</th><th>Date</th></tr></thead><tbody>${recentResults}</tbody></table></div></div>`:''}
  </div>
  <div class="section"><div class="panel"><div class="panel-head"><div><h2>Recent Activity</h2><p>Latest testing, compliance, and random-selection changes.</p></div></div><div class="activity-list">${recentActivity.length?recentActivity.map(x=>`<div class="activity-row"><span class="activity-type">${esc(x.type)}</span><div><strong>${esc(x.label||'Activity')}</strong><small>${fmt(x.date)}</small></div>${badge(x.status||'updated')}</div>`).join(''):'<div class="empty">No recent activity yet.</div>'}</div></div></div>`;
}
function profileView(d){const x=d.employee||d.employer||{};return `<div class="metrics">${metric('Name',x.legal_name||[x.first_name,x.last_name].filter(Boolean).join(' ')||'—')}${metric('Email',x.email||x.primary_contact_email||'—')}${metric('Phone',x.mobile||x.phone||'—')}${metric('Status',pretty(x.employment_status||x.status||'—'))}</div>`}
function pickManagementRows(p,d){
  if(C.kind==='ctpa'){
    if(p==='employers')return[d.employers||[],'employers'];
    if(p==='people')return[d.employees||[],'employees'];
    if(p==='programs')return[d.programs||[],'programs'];
    if(p==='pools')return[d.pools||[],'pools'];
    if(p==='selections')return[d.selection_members||d.selection_events||[],'selections'];
    if(p==='testing')return[d.orders||d.testing_orders||[],'testing'];
    if(p==='results')return[d.results||[],'results'];
    if(p==='compliance')return[d.compliance_cases||d.cases||[],'compliance'];
    if(p==='documents')return[d.documents||[],'documents'];
    if(p==='notifications')return[d.notifications||[],'notifications'];
    if(p==='billing')return[d.invoices||[],'invoices'];
  }
  if(C.kind==='agency'){
    if(['drivers','covered-workers','mariners'].includes(p))return[d.employees||[],'employees'];
    if(p==='programs')return[d.programs||[],'programs'];
    if(p==='randoms')return[d.selections||[],'selections'];
    if(p==='testing')return[d.testing_orders||[],'testing'];
    if(['post-accident','serious-marine-incident','toxicology'].includes(p))return[d.post_accident_events||[],'accidents'];
    if(p==='compliance')return[d.compliance_cases||[],'compliance'];
    if(p==='documents')return[d.documents||[],'documents'];
  }
  if(p==='people')return[d.employees||[],'employees'];
  if(p==='programs')return[d.programs||[],'programs'];
  if(p==='pools')return[d.pools||[],'pools'];
  if(p==='selections')return[d.selection_members||[],'selections'];
  if(p==='testing')return[d.orders||d.testing_orders||[],'testing'];
  if(p==='results')return[d.results||[],'results'];
  if(p==='compliance')return[d.cases||d.compliance_cases||[],'compliance'];
  if(p==='documents')return[d.documents||[],'documents'];
  if(p==='notifications')return[d.notifications||[],'notifications'];
  if(p==='billing')return[d.invoices||[],'invoices'];
  if(p==='team')return[d.members||[],'members'];
  return[[],null];
}

function wireSelfActions(p,d,ctx){
  if(p==='consents'){
    const pending=(d.policies||[]).find(x=>!x.acknowledged_at);
    if(pending)addAction('Acknowledge Required Policy',()=>modal('Acknowledge Policy',[{name:'acknowledged_name',label:'Type your full name',required:true}],async v=>invoke('workforce-employee-portal',{action:'acknowledge_policy',membership_id:stored(),acknowledgment_id:pending.id,acknowledged_name:v.acknowledged_name})));
  }
  if(p==='credentials')addAction('Submit Credential',()=>modal('Submit Credential',[{name:'credential_type',label:'Credential type',required:true},{name:'credential_number',label:'Credential number'},{name:'issuing_state',label:'Issuing state'},{name:'expires_at',label:'Expiration date',type:'date'}],async v=>invoke('workforce-employee-portal',{action:'save_credential',membership_id:stored(),credential:v})));
}
function wireManagementActions(p,d,ctx){
  if(C.kind==='agency'){
    if(p==='agency-configuration'||['authorizations','contractors','random-plan','policy','anti-drug-plan','alcohol-misuse-plan','periodic-testing'].includes(p)){
      const r=(d.registrations||[])[0]||{},cfg=r.configuration||{};
      addAction('Edit Agency Configuration',()=>modal(`${C.agency} Configuration`,[{name:'account_identifier',label:'Agency account / identifier',value:r.account_identifier||''},{name:'employee_category',label:'Regulated category',value:r.employee_category||'general'},{name:'effective_date',label:'Effective date',type:'date',value:r.effective_date||new Date().toISOString().slice(0,10)}],async v=>invoke('workforce-employer-management',{action:'save_agency_registration',agency_code:C.agency,registration:{agency_code:C.agency,...v,configuration:cfg,status:'active'}})));
    }
    if(p==='programs')addAction('Add Program',()=>modal(`Add ${C.agency} Program`,[{name:'name',label:'Program name',required:true},{name:'regulatory_category',label:'Regulatory category'},{name:'testing_method',label:'Testing method',value:'Urine / Breath'},{name:'effective_date',label:'Effective date',type:'date',value:new Date().toISOString().slice(0,10)}],async v=>invoke('workforce-employer-management',{action:'save_agency_program',agency_code:C.agency,program:{dot_agency:C.agency,...v,status:'active'}})));
    if(['drivers','covered-workers','mariners'].includes(p))addAction('Add Covered Worker',()=>modal('Add Covered Worker',[{name:'first_name',label:'First name',required:true},{name:'last_name',label:'Last name',required:true},{name:'employee_number',label:'Employee number'},{name:'email',label:'Email',type:'email'},{name:'job_title',label:'Safety-sensitive position'}],async v=>invoke('workforce-employer-management',{action:'save_employee',employee:{...v,dot_covered:true,dot_agency:C.agency,safety_sensitive:true,employment_status:'active'}})));
    return;
  }
  if(p==='people'&&C.kind==='ctpa'){addAction('Add Person',()=>{location.href='/people-form.html'});return;}
  if(p==='people')addAction(C.surface==='dot'?'Add Covered Worker':'Add Employee',()=>{
    const fields=[];
    if(C.kind==='ctpa')fields.push({name:'employer_id',label:'Client Employer',type:'select',required:true,options:(d.employers||[]).map(x=>({value:x.id,label:x.legal_name||x.dba_name||x.id}))});
    fields.push({name:'first_name',label:'First name',required:true},{name:'last_name',label:'Last name',required:true},{name:'employee_number',label:'Employee number'},{name:'email',label:'Email',type:'email'});
    if(C.surface==='dot'){
      fields.push({name:'dot_agency',label:'DOT Agency',type:'select',value:'FMCSA',options:['FMCSA','FAA','FRA','FTA','PHMSA','USCG'].map(x=>({value:x,label:x}))});
      fields.push({name:'dot_position_id',label:'Safety-sensitive / covered position',type:'select',required:true,options:[{value:'',label:'Choose position'},...(d.position_catalog||[]).map(x=>({value:x.id,label:`${x.agency_code} — ${x.title}`}))]});
      fields.push({name:'cdl_number',label:'CDL number (when required)'},{name:'cdl_state',label:'CDL state'});
    } else fields.push({name:'job_title',label:'Job title'});
    modal('Add Covered Worker',fields,async v=>{
      if(C.kind==='ctpa')return invoke('workforce-ctpa-employees-programs',{action:'save_employee',employee:{...v,dot_covered:C.surface==='dot',employment_status:'active',safety_sensitive:C.surface==='dot'}});
      return invoke('workforce-employer-management',{action:'save_employee',employee:{...v,dot_covered:C.surface==='dot',employment_status:'active',safety_sensitive:C.surface==='dot'}});
    });
  });
  if(p==='programs')addAction('Add Program',()=>{
    const fields=[];
    if(C.kind==='ctpa')fields.push({name:'employer_id',label:'Client Employer',type:'select',required:true,options:(d.employers||[]).map(x=>({value:x.id,label:x.legal_name||x.dba_name||x.id}))});
    fields.push({name:'name',label:'Program name',required:true},{name:'testing_method',label:'Testing method'},{name:'effective_date',label:'Effective date',type:'date',value:new Date().toISOString().slice(0,10)});
    if(C.surface==='dot')fields.push({name:'dot_agency',label:'DOT Agency',type:'select',value:'FMCSA',options:['FMCSA','FAA','FRA','FTA','PHMSA','USCG'].map(x=>({value:x,label:x}))});
    modal('Add Program',fields,async v=>{
      const program={...v,program_type:C.surface==='dot'?'DOT':'NON_DOT',status:'active'};
      if(C.kind==='ctpa')return invoke('workforce-ctpa-employees-programs',{action:'save_program',program});
      return invoke('workforce-employer-management',{action:'save_program',program});
    });
  });
  if(p==='pools'&&!window.PortalPools)addAction('Add Pool',()=>{
    const fields=[];
    if(C.kind==='ctpa')fields.push({name:'employer_id',label:'Client Employer',type:'select',options:(d.employers||[]).map(x=>({value:x.id,label:x.legal_name||x.id}))});
    fields.push({name:'name',label:'Pool name',required:true},{name:'pool_type',label:'Pool type',type:'select',value:C.kind==='ctpa'?'consortium':'employer',options:[{value:'employer',label:'Employer Pool'},{value:'consortium',label:'Consortium'}]},{name:'program_type',label:'Program type',type:'select',value:C.surface==='dot'?'DOT':'NON_DOT',options:[{value:'DOT',label:'DOT'},{value:'NON_DOT',label:'NON-DOT'}]});
    if(C.surface==='dot')fields.push({name:'dot_agency',label:'DOT Agency',type:'select',value:'FMCSA',options:['FMCSA','FAA','FRA','FTA','PHMSA','USCG'].map(x=>({value:x,label:x}))});
    modal('Add Pool',fields,async v=>{
      if(C.kind==='ctpa')return invoke('workforce-ctpa-pools',{action:'save_pool',pool:v});
      return invoke('workforce-employer-pools',{action:'save_pool',pool:v});
    });
  });
}

const PAGE_CACHE_NAME='s4u-ctpa-page-data-v5';
const PAGE_CACHE_MAX_AGE=60*60*1000;
function cacheIdentity(p,search=location.search){const w=workspace()||{};const q=String(search||'');return `${String(w.user_id||'u')}|${String(w.ctpa_id||'c')}|${String(w.subscription_id||'s')}|${norm(p)}|${q}`}
function cacheUrl(p,search=location.search){const id=cacheIdentity(p,search);let h=2166136261;for(let i=0;i<id.length;i++){h^=id.charCodeAt(i);h=Math.imul(h,16777619)}return `${location.origin}/__s4u_cache__/page/${(h>>>0).toString(36)}`}
function isDynamicPage(p){return ['lab_accounts','schedule_demo','attend_demo','notifications','billing','employer_billing'].includes(norm(p))}
async function readPageCache(p,search=location.search){try{if(isDynamicPage(p)||!('caches'in window))return null;const c=await caches.open(PAGE_CACHE_NAME),r=await c.match(cacheUrl(p,search));if(!r)return null;const x=await r.json();if(!x||Date.now()-Number(x.saved_at||0)>PAGE_CACHE_MAX_AGE)return null;return x.data}catch{return null}}
async function writePageCache(p,data,search=location.search){try{if(isDynamicPage(p)||!('caches'in window)||data===undefined)return;const c=await caches.open(PAGE_CACHE_NAME);await c.put(cacheUrl(p,search),new Response(JSON.stringify({saved_at:Date.now(),data}),{headers:{'Content-Type':'application/json'}}))}catch{}}
async function clearPageCache(){PAGE_MEMORY.clear();PAGE_INFLIGHT.clear();try{if('caches'in window)await caches.delete(PAGE_CACHE_NAME)}catch{}}
const PAGE_MEMORY=new Map();
const PAGE_INFLIGHT=new Map();
function memoryCacheKey(p,search=location.search){return cacheIdentity(p,search)}
async function getCachedPageData(p,search=location.search){
  const key=memoryCacheKey(p,search),m=PAGE_MEMORY.get(key);
  if(m&&Date.now()-m.saved_at<PAGE_CACHE_MAX_AGE)return m.data;
  const d=await readPageCache(p,search);
  if(d!==null)PAGE_MEMORY.set(key,{saved_at:Date.now(),data:d});
  return d;
}
async function setCachedPageData(p,data,search=location.search){
  const key=memoryCacheKey(p,search);PAGE_MEMORY.set(key,{saved_at:Date.now(),data});
  await writePageCache(p,data,search);
}
async function loadPageDataCached(p,search=location.search,{force=false}={}){
  const key=memoryCacheKey(p,search);
  if(!force){const cached=await getCachedPageData(p,search);if(cached!==null)return cached;}
  if(PAGE_INFLIGHT.has(key))return PAGE_INFLIGHT.get(key);
  const task=(async()=>{const d=await loadPageData(p);await setCachedPageData(p,d,search);return d})().finally(()=>PAGE_INFLIGHT.delete(key));
  PAGE_INFLIGHT.set(key,task);return task;
}
function schedulePortalPrefetch(){} // Deliberately disabled. Bulk prefetching overloaded the backend.
async function loadPageData(p){
  let d;
  if(C.kind==='self')d=await selfData();else if(C.kind==='ctpa')d=await ctpaData(p);else d=await employerData(p);
  if(isUtilityPage(p)&&!(C.kind==='ctpa'&&p==='integrations'&&window.CtpaIntegrations))d=await utilityData(p);
  return d;
}
async function render(ctx,prefetched){
  $('#actions').innerHTML='';const p=page();
  const d=prefetched!==undefined?prefetched:await loadPageData(p);
  if(C.kind==='self')setSubtitle('View your own records and complete only the actions assigned to you.');
  else if(C.kind==='agency')setSubtitle(`${C.agency} company management workspace. Changes apply only to your company.`);
  else setSubtitle(p==='dashboard'?'Company-wide snapshot of employers, testing, randoms, compliance, billing, and recent activity.':'Manage your company records, people, programs, testing and compliance.');
  let html='';
  if(C.kind==='ctpa'&&p==='integrations'&&window.CtpaIntegrations){setSubtitle('Connect enterprise business systems to your C/TPA account.');html=window.CtpaIntegrations.renderCatalog(d,ctx);}
  else if(C.kind==='ctpa'&&p==='integration_connect'&&window.CtpaIntegrations){setSubtitle('Connect this integration using your business credentials or API access.');html=window.CtpaIntegrations.renderConnect(d,ctx);}
  else if(C.kind==='ctpa'&&p==='integration_workspace'&&window.CtpaIntegrations){setSubtitle('Manage, test, and use this connected integration.');html=window.CtpaIntegrations.renderWorkspace(d,ctx);}
  else if(C.kind==='ctpa'&&p==='location_form'&&window.CtpaLocations){setSubtitle('Add or edit a location for your C/TPA, an Employer, or an Owner-Operator.');html=window.CtpaLocations.renderForm(d,ctx);}
  else if(C.kind==='ctpa'&&p==='lab_accounts'&&window.CtpaLabAccounts){setSubtitle('View the laboratory accounts and account numbers configured for your C/TPA.');html=window.CtpaLabAccounts.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='schedule_demo'&&window.CtpaDemos){setSubtitle('Choose a date and time for a live screenings4u DOT platform demonstration.');html=window.CtpaDemos.renderSchedule(d,ctx);}
  else if(C.kind==='ctpa'&&p==='attend_demo'&&window.CtpaDemos){setSubtitle('View your confirmed demonstration and join it from your portal on the scheduled day.');html=window.CtpaDemos.renderAttend(d,ctx);}
  else if(C.kind==='ctpa'&&p==='staff_form'&&window.CtpaStaff){setSubtitle('Add an internal C/TPA staff member and assign their roles.');html=window.CtpaStaff.form(d,ctx);}
  else if(C.kind==='ctpa'&&p==='staff_view'&&window.CtpaStaff){setSubtitle('View and manage this internal C/TPA staff member and their assigned roles.');html=window.CtpaStaff.view(d,ctx);}
  else if(C.kind==='ctpa'&&p==='staff_invite'&&window.CtpaStaff){setSubtitle('Send this staff member their portal invitation and password-creation link.');html=window.CtpaStaff.invite(d,ctx);}
  else if(C.kind==='ctpa'&&p==='staff_delete'&&window.CtpaStaff){setSubtitle('Permanently remove this internal staff member from the C/TPA account.');html=window.CtpaStaff.del(d,ctx);}
  else if(isUtilityPage(p))html=renderUtilityPage(p,d);
  else if(p==='dashboard')html=dashboard(ctx,d);
  else if(C.kind==='ctpa'&&p==='create_order'&&window.CtpaStoreOrders){setSubtitle('Create a screenings4u order for supplies and approved testing products.');html=window.CtpaStoreOrders.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='price_list'&&window.CtpaPriceList){setSubtitle('View the testing prices assigned to your C/TPA account.');html=window.CtpaPriceList.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='order_services'&&window.CtpaFeatures){setSubtitle('Review available account features and submit requests for screenings4u approval.');html=window.CtpaFeatures.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='order_history'&&window.AccountOrderHistory){setSubtitle('View and download receipts for your screenings4u DOT C/TPA account.');html=window.AccountOrderHistory.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='subscription'&&window.AccountSubscription){setSubtitle('Review your current screenings4u DOT C/TPA software subscription.');html=window.AccountSubscription.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='billing'&&window.AccountBilling){setSubtitle('View, download, and pay invoices issued to your C/TPA account by screenings4u.');html=window.AccountBilling.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='employer_billing'&&window.CtpaBilling){setSubtitle('Create, manage, download, and send invoices to your client Employers.');html=window.CtpaBilling.render(d,ctx);}
  else if(C.kind==='ctpa'&&['employer_invoice_form','employer_invoice_view','employer_invoice_send','employer_invoice_delete','employer_remittance'].includes(p)&&window.CtpaInvoicePages){setSubtitle('Manage Employer and Owner-Operator invoices and remittance information.');html=window.CtpaInvoicePages.render(p,d,ctx);}
  else if(C.kind==='ctpa'&&p==='employers'&&window.CtpaEmployers){setSubtitle('Manage every client Employer, its DOT company record, and who can access its Employer Portal.');html=window.CtpaEmployers.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='employer_form'&&window.CtpaEmployerForm){setSubtitle('Create or edit an Employer record.');html=window.CtpaEmployerForm.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='people'&&window.CtpaPeople){setSubtitle('View every employee, driver, staff member, and contractor across managed Employers.');html=window.CtpaPeople.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='people_form'&&window.CtpaPeopleForm){setSubtitle('Add a person to a managed Employer.');html=window.CtpaPeopleForm.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='people_company'&&window.CtpaPeopleCompany){setSubtitle('View employees, drivers, staff, and contractors for this Employer.');html=window.CtpaPeopleCompany.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='programs'&&window.CtpaPrograms){setSubtitle('Create C/TPA DOT programs and assign Employers to them.');html=window.CtpaPrograms.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='program_form'&&window.CtpaProgramForm){setSubtitle('Create or edit a C/TPA DOT program.');html=window.CtpaProgramForm.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='program_detail'&&window.CtpaProgramDetail){setSubtitle('Manage Employers assigned to this DOT program.');html=window.CtpaProgramDetail.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='testing_order'&&window.CtpaTestingOrder){setSubtitle('Create a screenings4u DOT testing order.');html=window.CtpaTestingOrder.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='testing_document_edit'&&window.CtpaTestingDocumentEdit){setSubtitle('Edit a C/TPA-owned testing document.');html=window.CtpaTestingDocumentEdit.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='result_detail'&&window.CtpaResultDetail){setSubtitle('View read-only finalized result details and download the official report.');html=window.CtpaResultDetail.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='owner_operators'&&window.CtpaOwnerOperators){setSubtitle('Manage Owner-Operator customers sponsored by this C/TPA.');html=window.CtpaOwnerOperators.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='new_entrant_audits'&&window.CtpaNewEntrantAudits){setSubtitle('Prepare Owner-Operators for the FMCSA New Entrant Safety Audit with a documented readiness workflow.');html=window.CtpaNewEntrantAudits.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='selections'&&window.CtpaSelections){setSubtitle('Run auditable random selections by consortium pool, create testing orders, export records, and deliver selections to Employer portals.');html=window.CtpaSelections.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='selection_detail'&&window.CtpaSelectionDetail){setSubtitle('Review the locked selection population, selected people, testing orders, and Employer notices.');html=window.CtpaSelectionDetail.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='testing'&&window.CtpaTesting){setSubtitle('Create and monitor DOT testing orders and their screenings4u fulfillment handoffs.');html=window.CtpaTesting.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='results'&&window.CtpaResults){setSubtitle('View finalized screenings4u results and download official reports.');html=window.CtpaResults.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='compliance'&&window.CtpaCompliance){setSubtitle('Monitor Employer compliance health, cases, documents, events, and communicate with client Employers.');html=window.CtpaCompliance.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='documents'&&window.CtpaDocuments){setSubtitle('Upload private documents or send PDFs to Employer and Owner-Operator portals.');html=window.CtpaDocuments.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='reports'&&window.CtpaReports){setSubtitle('Generate and manage DOT compliance reports across your entire C/TPA account.');html=window.CtpaReports.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='report_generate'&&window.CtpaReportGenerate){setSubtitle('Generate a DOT compliance report from the live C/TPA records.');html=window.CtpaReportGenerate.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='report_view'&&window.CtpaReportView){setSubtitle('View this generated report.');html=window.CtpaReportView.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='report_archive'&&window.CtpaReportArchive){setSubtitle('Archive this generated report.');html=window.CtpaReportArchive.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='notifications'&&window.CtpaLiveChat){setSubtitle('Direct conversations with your managed Employers and Owner-Operators.');html=window.CtpaLiveChat.render(d,ctx,'employer');}
  else if(C.kind==='ctpa'&&p==='support'&&window.CtpaSupport){setSubtitle('Get help, create support requests, track ticket status, and find answers for common portal issues.');html=window.CtpaSupport.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='pool_form'&&window.CtpaPoolForm){setSubtitle('Configure the consortium Pool created from its Program.');html=window.CtpaPoolForm.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='pool_detail'&&window.CtpaPoolDetail){setSubtitle('View and manage people in this random pool.');html=window.CtpaPoolDetail.render(d,ctx);}
  else if(p==='pools'&&window.PortalPools){setSubtitle(C.kind==='ctpa'?'Create consortium pools and manage eligible pool membership.':'Manage random pools and pool participation for this Employer.');html=window.PortalPools.render(d,ctx);}
  else if(C.kind==='ctpa'&&p==='branding'&&window.CtpaBranding){setSubtitle('Control the logo and colors your sponsored Employers see in the DOT Employer portal.');html=window.CtpaBranding.render(d,ctx);}
  else if(C.kind==='self'){
    if(p==='profile')html=profileView(d);
    else if(p==='my-testing')html=table('My Testing',d.testing_orders||[],COLS.testing);
    else if(p==='my-results')html=table('My Results',d.results||d.result_reports||[],COLS.results);
    else if(p==='documents')html=table('My Documents',d.documents||[],COLS.documents);
    else if(p==='credentials')html=table('My Credentials',d.credentials||[],COLS.credentials);
    else if(p==='training')html=table('Training Records',d.training||[],COLS.training)+`<div class="section"><a class="btn primary" href="https://training.screenings4u.com/" target="_blank" rel="noopener">Open Training Portal</a></div>`;
    else if(p==='consents')html=table('Consents & Acknowledgments',d.policies||[],COLS.policies);
    else if(p==='medical')html=`<div class="notice">Medical records are view-only here. Use Order Services to purchase a DOT physical from screenings4u, LLC.</div><div class="section">${table('Credentials',d.credentials||[],COLS.credentials)}</div>`;
    else html=dashboard(ctx,d);
    wireSelfActions(p,d,ctx);
  }
  else if(C.kind==='agency'){
    if(p==='company')html=profileView(d);
    else if(p==='agency-configuration'||['authorizations','contractors','random-plan','policy','anti-drug-plan','alcohol-misuse-plan','periodic-testing'].includes(p)){
      const r=(d.registrations||[])[0]||{};
      html=`<div class="panel"><div class="panel-head"><div><h2>${esc(C.agency)} Configuration</h2><p>${esc(d.agency?.primary_regulation||'Agency configuration')}</p></div></div><div style="padding:16px"><div class="metrics">${metric('Account',r.account_identifier||'—')}${metric('Category',pretty(r.employee_category||'—'))}${metric('Status',pretty(r.status||'Not configured'))}${metric('Effective',fmt(r.effective_date))}</div><div class="section notice">${esc(d.agency?.metadata?.covered_workforce||'Agency-specific employer configuration.')}</div></div></div>`;
    }
    else if(p==='mis-reports'||p==='reports')html=`<div class="metrics">${metric('Testing',(d.testing_orders||[]).length)}${metric('Programs',(d.programs||[]).length)}${metric('Random Events',(d.selections||[]).length)}${metric('Compliance',(d.compliance_cases||[]).length)}</div>`;
    else {const [rows,key]=pickManagementRows(p,d);html=key?table(cfgPage(p).label,rows,COLS[key]):`<div class="panel"><div class="empty">No records available.</div></div>`}
    wireManagementActions(p,d,ctx);
  }
  else {
    if(p==='company')html=profileView(d);
    else if(p==='reports')html=`<div class="metrics">${metric('Testing',(d.testing||d.testing_orders||[]).length)}${metric('Programs',(d.program_enrollment||d.programs||[]).length)}${metric('Pools',(d.pool_membership||d.pools||[]).length)}${metric('Compliance',(d.compliance||d.cases||[]).length)}</div>`;
    else if(p==='post-accident')html=`<div class="notice">Post-accident activity is managed through Testing and Compliance. DOT service purchases are available from Order Services.</div><div class="section">${table('Post-Accident Testing',(d.testing_orders||[]).filter(x=>norm(x.reason)==='post_accident'),COLS.testing)}</div>`;
    else {const [rows,key]=pickManagementRows(p,d);html=key?table(cfgPage(p).label,rows,COLS[key]):`<div class="panel"><div class="empty">No records available.</div></div>`}
    wireManagementActions(p,d,ctx);
  }
  $('#content').innerHTML=html||`<div class="panel"><div class="empty">No data available.</div></div>`;
  if(isUtilityPage(p)&&!(C.kind==='ctpa'&&p==='integrations'&&window.CtpaIntegrations))bindUtilityPage(p,d,ctx);
  if(C.kind==='ctpa'&&['integrations','integration_connect','integration_workspace'].includes(p)&&window.CtpaIntegrations)window.CtpaIntegrations.bind(p,d,ctx);
  if(C.kind==='ctpa'&&p==='location_form'&&window.CtpaLocations)window.CtpaLocations.bindForm(d,ctx);
  if(C.kind==='ctpa'&&p==='schedule_demo'&&window.CtpaDemos)window.CtpaDemos.bindSchedule(d,ctx);
  if(C.kind==='ctpa'&&p==='attend_demo'&&window.CtpaDemos)window.CtpaDemos.bindAttend(d,ctx);
  if(C.kind==='ctpa'&&['staff_form','staff_view','staff_invite','staff_delete'].includes(p)&&window.CtpaStaff)window.CtpaStaff.bind(p,d,ctx);
  if(p==='order_history'&&window.AccountOrderHistory)window.AccountOrderHistory.bind(d,ctx);
  if(p==='subscription'&&window.AccountSubscription)window.AccountSubscription.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='billing'&&window.AccountBilling)window.AccountBilling.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='employer_billing'&&window.CtpaBilling)window.CtpaBilling.bind(d,ctx);
  if(C.kind==='ctpa'&&['employer_invoice_form','employer_invoice_view','employer_invoice_send','employer_invoice_delete','employer_remittance'].includes(p)&&window.CtpaInvoicePages)window.CtpaInvoicePages.bind(p,d,ctx);
  if(C.kind==='ctpa'&&p==='employers'&&window.CtpaEmployers)window.CtpaEmployers.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='employer_form'&&window.CtpaEmployerForm)window.CtpaEmployerForm.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='people'&&window.CtpaPeople)window.CtpaPeople.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='people_form'&&window.CtpaPeopleForm)window.CtpaPeopleForm.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='people_company'&&window.CtpaPeopleCompany)window.CtpaPeopleCompany.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='programs'&&window.CtpaPrograms)window.CtpaPrograms.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='program_form'&&window.CtpaProgramForm)window.CtpaProgramForm.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='program_detail'&&window.CtpaProgramDetail)window.CtpaProgramDetail.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='testing_order'&&window.CtpaTestingOrder)window.CtpaTestingOrder.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='testing_document_edit'&&window.CtpaTestingDocumentEdit)window.CtpaTestingDocumentEdit.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='result_detail'&&window.CtpaResultDetail)window.CtpaResultDetail.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='owner_operators'&&window.CtpaOwnerOperators)window.CtpaOwnerOperators.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='new_entrant_audits'&&window.CtpaNewEntrantAudits)window.CtpaNewEntrantAudits.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='selections'&&window.CtpaSelections)window.CtpaSelections.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='selection_detail'&&window.CtpaSelectionDetail)window.CtpaSelectionDetail.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='testing'&&window.CtpaTesting)window.CtpaTesting.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='results'&&window.CtpaResults)window.CtpaResults.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='compliance'&&window.CtpaCompliance)window.CtpaCompliance.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='documents'&&window.CtpaDocuments)window.CtpaDocuments.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='reports'&&window.CtpaReports)window.CtpaReports.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='report_generate'&&window.CtpaReportGenerate)window.CtpaReportGenerate.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='report_view'&&window.CtpaReportView)window.CtpaReportView.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='report_archive'&&window.CtpaReportArchive)window.CtpaReportArchive.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='notifications'&&window.CtpaLiveChat)window.CtpaLiveChat.bind(d,ctx,'employer');
  if(C.kind==='ctpa'&&p==='support'&&window.CtpaSupport)window.CtpaSupport.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='create_order'&&window.CtpaStoreOrders)window.CtpaStoreOrders.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='order_services'&&window.CtpaFeatures)window.CtpaFeatures.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='pool_form'&&window.CtpaPoolForm)window.CtpaPoolForm.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='pool_detail'&&window.CtpaPoolDetail)window.CtpaPoolDetail.bind(d,ctx);
  if(p==='pools'&&window.PortalPools)window.PortalPools.bind(d,ctx);
  if(C.kind==='ctpa'&&p==='branding'&&window.CtpaBranding)window.CtpaBranding.bind(d,ctx);
}


let liveChannel=null,liveRenderTimer=null;
function scheduleLiveRender(){
  if(liveRenderTimer)clearTimeout(liveRenderTimer);
  liveRenderTimer=setTimeout(async()=>{
    if(!window.portalCtx)return;
    const y=window.scrollY,active=document.activeElement,activeId=active?.id||null,selection=(active&&typeof active.selectionStart==='number')?[active.selectionStart,active.selectionEnd]:null;
    try{await render(window.portalCtx)}catch(e){console.warn('Realtime render failed',e)}
    requestAnimationFrame(()=>{window.scrollTo(0,y);if(activeId){const n=document.getElementById(activeId);if(n){n.focus({preventScroll:true});if(selection&&typeof n.setSelectionRange==='function')try{n.setSelectionRange(selection[0],selection[1])}catch{}}}});
  },120);
}
function startRealtime(ctx){
  try{if(liveChannel){sb.removeChannel(liveChannel);liveChannel=null}const ctpaId=ctx?.ctpa?.id||ctx?.ctpa_id||ctx?.subscription?.ctpa_id;if(!ctpaId)return;
    liveChannel=sb.channel('ctpa-live-'+ctpaId).on('postgres_changes',{event:'INSERT',schema:'public',table:'ctpa_activity_events',filter:'ctpa_id=eq.'+ctpaId},()=>scheduleLiveRender()).subscribe();
  }catch(e){console.warn('Realtime unavailable',e)}
}
async function refreshCurrent({force=true}={}){
  if(!window.portalCtx)return;
  const p=page(),search=location.search;
  const d=await loadPageDataCached(p,search,{force});
  await render(window.portalCtx,d);
}

const CORE_SCRIPT_RE=/\/(?:config|dialogs|session-security|app|validation)\.js(?:\?|$)/;
const loadedAssets=new Set([...document.querySelectorAll('script[src],link[rel="stylesheet"][href]')].map(n=>n.src||n.href));
async function ensureAsset(src,type){
  const u=new URL(src,location.origin).href;if(loadedAssets.has(u)||CORE_SCRIPT_RE.test(new URL(u).pathname))return;
  if(type==='style'){await new Promise((resolve,reject)=>{const l=document.createElement('link');l.rel='stylesheet';l.href=u;l.onload=resolve;l.onerror=reject;document.head.appendChild(l)});loadedAssets.add(u);return;}
  await new Promise((resolve,reject)=>{const x=document.createElement('script');x.src=u;x.async=false;x.onload=resolve;x.onerror=reject;document.head.appendChild(x)});loadedAssets.add(u);
}
const HTML_PREFETCH=new Map();
async function fetchPageDocument(url){
  const u=new URL(url,location.href);u.hash='';const key=u.pathname+u.search;
  if(HTML_PREFETCH.has(key))return HTML_PREFETCH.get(key);
  const task=fetch(u.href,{credentials:'same-origin',cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error('Unable to load page.');return r.text()}).then(t=>new DOMParser().parseFromString(t,'text/html')).finally(()=>setTimeout(()=>HTML_PREFETCH.delete(key),30000));
  HTML_PREFETCH.set(key,task);return task;
}
async function prepareTarget(url){
  const u=new URL(url,location.href),doc=await fetchPageDocument(u.href);
  await Promise.all([...doc.querySelectorAll('link[rel="stylesheet"][href]')].map(l=>ensureAsset(l.getAttribute('href'),'style')));
  for(const sc of [...doc.querySelectorAll('script[src]')])await ensureAsset(sc.getAttribute('src'),'script');
  return {doc,u,targetPage:norm(doc.body?.dataset?.portalPage||u.pathname.split('/').pop()?.replace('.html','')||'dashboard')};
}
function updateActiveNavigation(){
  const cur=page();document.querySelectorAll('.nav a,.mobile-nav-links a').forEach(a=>{const u=new URL(a.href,location.href),id=norm(u.pathname.split('/').pop()?.replace('.html','')||'');a.classList.toggle('active',id===cur||(id==='people'&&cur==='people_company')||(id==='pools'&&['pool_detail','pool_form'].includes(cur))||(id==='locations'&&cur==='location_form')||(id==='users_roles'&&['staff_form','staff_view','staff_invite','staff_delete'].includes(cur)))});
}
async function navigatePortal(url,{replace=false,pop=false}={}){
  const u=new URL(url,location.href);
  if(u.origin!==location.origin||!u.pathname.endsWith('.html')){location.href=u.href;return}
  const prepared=await prepareTarget(u.href);
  const targetPage=prepared.targetPage,targetSearch=u.search;
  const cached=await getCachedPageData(targetPage,targetSearch);
  if(!pop){if(replace)history.replaceState({s4u:true},'',u.pathname+u.search+u.hash);else history.pushState({s4u:true},'',u.pathname+u.search+u.hash)}
  document.body.dataset.portalPage=targetPage;
  shell(window.portalCtx);updateActiveNavigation();
  if(cached!==null){await render(window.portalCtx,cached);loadPageDataCached(targetPage,targetSearch,{force:true}).then(d=>{if(page()===targetPage&&location.search===targetSearch)render(window.portalCtx,d)}).catch(console.warn);return}
  // Keep navigation chrome responsive; no spinner. Usually this request has already started on hover.
  const d=await loadPageDataCached(targetPage,targetSearch,{force:false});
  if(page()===targetPage)await render(window.portalCtx,d);
}
function installFastNavigation(){
  document.addEventListener('click',e=>{const a=e.target.closest?.('a[href]');if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target||a.hasAttribute('download'))return;const u=new URL(a.href,location.href);if(u.origin!==location.origin||!u.pathname.endsWith('.html'))return;e.preventDefault();navigatePortal(u.href).catch(err=>{console.warn('Soft navigation fallback',err);location.href=u.href})},true);
  const pre=e=>{const a=e.target.closest?.('a[href]');if(!a)return;const u=new URL(a.href,location.href);if(u.origin!==location.origin||!u.pathname.endsWith('.html'))return;prepareTarget(u.href).then(({targetPage,u})=>loadPageDataCached(targetPage,u.search,{force:false})).catch(()=>{})};
  document.addEventListener('pointerenter',pre,true);document.addEventListener('focusin',pre,true);document.addEventListener('touchstart',pre,{capture:true,passive:true});
  addEventListener('popstate',()=>navigatePortal(location.href,{pop:true}).catch(()=>location.reload()));
}
async function init(){
  try{
    const ctx=await access();if(!ctx?.has_access)throw new Error(ctx?.reason||'Portal access denied.');
    window.portalCtx=ctx;shell(ctx);installFastNavigation();
    const p=page(),search=location.search,cached=await getCachedPageData(p,search);
    if(cached!==null){await render(ctx,cached);loadPageDataCached(p,search,{force:true}).then(d=>{if(page()===p&&location.search===search)render(ctx,d)}).catch(console.warn)}
    else {const d=await loadPageDataCached(p,search,{force:false});await render(ctx,d)}
    startRealtime(ctx);
  }
  catch(e){if(e?.status===401||e?.message==='AUTH_REQUIRED'){W.clear();await clearPageCache();try{await sb.auth.signOut({scope:'local'})}catch{};location.replace('https://portal.screenings4u.com/');return}if(e?.status===402)return;document.body.className='login-page';document.body.innerHTML=`<main class="login-card"><img class="login-logo" src="images/logo.png"><h1>Portal unavailable</h1><p>${esc(e.message||String(e))}</p><a class="btn primary" href="https://portal.screenings4u.com/selector.html">Choose C/TPA Account</a></main>`}
}
window.Portal={invoke,sb,refresh:async()=>{if(!window.portalCtx)return;const p=page(),search=location.search;PAGE_MEMORY.delete(memoryCacheKey(p,search));await refreshCurrent({force:true})},navigate:navigatePortal,liveRefresh:scheduleLiveRender};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
