(async()=>{'use strict';const cfg=window.S4U_ACCESS_CONFIG, root=document.querySelector('#cards'),summary=document.querySelector('#accountSummary'),count=document.querySelector('#count'),search=document.querySelector('#search'),message=document.querySelector('#selectorMessage');let rows=[];
const empty=(title,detail)=>{root.replaceChildren();const box=document.createElement('div');box.className='empty';const a=document.createElement('strong');a.textContent=title;box.append(a,document.createTextNode(detail));root.append(box)};
if(!cfg?.supabaseUrl||!cfg?.supabasePublishableKey){empty('Configuration required','Central authentication has not been configured.');document.documentElement.classList.remove('s4u-session-pending');return}
const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{storageKey:cfg.authStorageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const {data:{session}}=await sb.auth.getSession();if(!session){root.replaceChildren();location.replace('/?reason=session');return}document.documentElement.classList.remove('s4u-session-pending');
document.querySelector('#signout').addEventListener('click',async()=>{await sb.auth.signOut({scope:'local'});location.replace('/')});
function paint(){const q=search.value.trim().toLowerCase();const subset=rows.filter(r=>[r.title,r.organization,r.plan,r.portal_type].some(s=>String(s||'').toLowerCase().includes(q)));count.textContent=subset.length+' shown';if(!subset.length){empty(rows.length?'No matches found':'No authorized subscriptions','Your account has no matching workspaces.');return}root.replaceChildren();for(const p of subset){const card=document.createElement('article');card.className='portal-card';const head=document.createElement('div');head.className='card-head';const symbol=document.createElement('div');symbol.className='card-symbol';symbol.textContent=(p.title||p.portal_type||'P').slice(0,2).toUpperCase();const titlewrap=document.createElement('div');const title=document.createElement('h4');title.textContent=p.title||'Workspace';const business=document.createElement('p');business.textContent=p.organization||'Authorized organization';const hostline=document.createElement('small');hostline.className='portal-hostname';hostline.textContent=new URL(p.launch_url).hostname;titlewrap.append(title,business,hostline);head.append(symbol,titlewrap);const meta=document.createElement('div');meta.className='card-meta';for(const v of [p.portal_type,p.plan])if(v){const tag=document.createElement('span');tag.className='tag';tag.textContent=v;meta.append(tag)}const a=document.createElement('a');a.className='enter';a.textContent=p.setup_only?'Open portal (setup) →':'Open portal →';a.href=p.launch_url;a.rel='noopener noreferrer';if(p.setup_only){a.removeAttribute('href');a.setAttribute('aria-disabled','true');a.style.cursor='not-allowed';a.title='Awaiting authorized employer assignment';a.textContent='Awaiting access assignment';a.addEventListener('click',event=>{event.preventDefault();message.textContent='This portal is registered but this account does not yet have a verified subscription or employer membership for it.';message.className='notice error'});}// Use the central handoff for every supported portal instead of navigating without a session.
if(!p.setup_only){
 const destinations={
 'lab-account.screenings4u.com':'lab_account',
 'ctpa-dot.screenings4u.com':'ctpa_dot',
 'ctpa-employer-dot.screenings4u.com':'ctpa_employer_dot',
 'ctpa-employee-dot.screenings4u.com':'ctpa_employee_dot',
 'ctpa-driver-dot.screenings4u.com':'ctpa_driver_dot',
 'fmcsa-employer-dot.screenings4u.com':'employer_dot',
 'fmcsa-driver-dot.screenings4u.com':'driver_dot',
 'fmcsa-employee-dot.screenings4u.com':'employee_dot',
 'owner-operator.screenings4u.com':'owner_operator',
 'fmcsa-dot.screenings4u.com':'fmcsa_dot',
 'faa-dot.screenings4u.com':'faa_dot',
 'fra-dot.screenings4u.com':'fra_dot',
 'fta-dot.screenings4u.com':'fta_dot',
 'phmsa-dot.screenings4u.com':'phmsa_dot',
 'uscg-dot.screenings4u.com':'uscg_dot',
 'faa-employer-dot.screenings4u.com':'faa_employer_dot',
 'fra-employer-dot.screenings4u.com':'fra_employer_dot',
 'fta-employer-dot.screenings4u.com':'fta_employer_dot',
 'phmsa-employer-dot.screenings4u.com':'phmsa_employer_dot',
 'uscg-employer-dot.screenings4u.com':'uscg_employer_dot',
 'faa-employee-dot.screenings4u.com':'faa_employee_dot',
 'fra-employee-dot.screenings4u.com':'fra_employee_dot',
 'fta-employee-dot.screenings4u.com':'fta_employee_dot',
 'phmsa-employee-dot.screenings4u.com':'phmsa_employee_dot',
 'uscg-employee-dot.screenings4u.com':'uscg_employee_dot',
 'ctpa-non-dot.screenings4u.com':'ctpa_workforce',

 'employee-non-dot.screenings4u.com':'employee_workforce',
 'employer-non-dot.screenings4u.com':'employer_workforce',

 'ctpa-employer-non-dot.screenings4u.com':'ctpa_employer_workforce',
 'ctpa-employee-non-dot.screenings4u.com':'ctpa_employee_workforce',
 'ctpa-driver-non-dot.screenings4u.com':'ctpa_driver_workforce'
 };
 const dest=new URL(p.launch_url);
 const portal=dest.hostname==='independent-contractor.screenings4u.com'?'independent_contractor':destinations[dest.hostname];
 if(portal){
 a.addEventListener('click',async event=>{
 event.preventDefault();event.stopImmediatePropagation();
 if(a.dataset.busy==='1')return;
 a.dataset.busy='1';a.textContent='Connecting securely…';message.textContent='';
 try{
 const {data:{session:current},error:sessionError}=await sb.auth.getSession();
 if(sessionError||!current)throw Error('Session expired. Sign in again.');
 const surface=portal==='lab_account'?'lab':portal.endsWith('_workforce')?'workforce':'dot';
 const payload={action:'create',surface,portal_code:portal,next:'/dashboard.html'};
 if(p.membership_id)payload.membership_id=p.membership_id;
 if(p.employee_id)payload.employee_id=p.employee_id;
 if(p.assignment_id)payload.assignment_id=p.assignment_id;
 // Handoff pages require the exact verified workspace identifiers selected here.
 // Never manufacture IDs or infer access from URL parameters.
 if(portal==='ctpa_workforce'&&p.ctpa_id&&p.subscription_id&&p.membership_id){
  const q=new URLSearchParams({ctpa_id:String(p.ctpa_id),subscription_id:String(p.subscription_id),membership_id:String(p.membership_id)});
  if(p.organization_id)q.set('organization_id',String(p.organization_id));
  payload.next='/dashboard.html?'+q.toString();
 }
 if(portal==='employer_dot'&&p.membership_id){
  payload.next='/dashboard.html?'+new URLSearchParams({membership_id:String(p.membership_id)}).toString();
 }
 if(portal==='ctpa_dot'&&p.ctpa_id&&p.subscription_id)payload.next='/workspace.html?ctpa_id='+encodeURIComponent(p.ctpa_id)+'&subscription_id='+encodeURIComponent(p.subscription_id);
 if(portal==='ctpa_employer_dot'&&p.membership_id&&p.subscription_id)payload.next='/dashboard.html?membership_id='+encodeURIComponent(p.membership_id)+'&subscription_id='+encodeURIComponent(p.subscription_id);
 const response=await fetch(cfg.supabaseUrl+'/functions/v1/portal-session-handoff',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+current.access_token,apikey:cfg.supabasePublishableKey},body:JSON.stringify(payload)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.redirect_url)throw Error(result.error||'Unable to open this portal.');
 const target=new URL(result.redirect_url);
 if(target.protocol!=='https:'||target.hostname!==dest.hostname||target.pathname!=='/auth-handoff.html')throw Error('Portal destination does not match the authorized workspace.');
 location.assign(target.href);
 }catch(error){message.textContent=error.message||'Unable to open portal.';message.className='notice error';a.dataset.busy='0';a.textContent='Open portal →'}
 },true);
 }
}
card.append(head,meta,a);root.append(card)}}
let loading=false;async function load(force=false){if(loading)return;loading=true;const refreshButton=document.querySelector('#refresh');refreshButton.disabled=true;refreshButton.textContent='↻ Refreshing…';if(!cfg.selectorEndpoint){summary.textContent='Awaiting central subscription service';empty('Access directory not connected','Connect the central subscription authorization endpoint before going live.');return}const cacheKey='s4u_selector_v19_'+session.user.id;if(force){try{sessionStorage.removeItem(cacheKey)}catch{}}let hadCache=false;try{const cached=JSON.parse(sessionStorage.getItem(cacheKey)||'null');if(false&&cached&&Date.now()-cached.time<300000&&Array.isArray(cached.portals)){rows=cached.portals;hadCache=true;summary.textContent=rows.length+' authorized subscriptions';paint();}}catch{}if(!hadCache){summary.textContent='Checking your assigned subscriptions…';empty('Loading workspaces','Verifying your account access.');}try{const {data:{session:latest}}=await sb.auth.getSession();if(!latest)throw Error('Session expired. Please sign in again.');const url=new URL(cfg.selectorEndpoint,location.origin);if(url.protocol!=='https:'&&url.hostname!=='localhost')throw Error('Secure endpoint required.');const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+latest.access_token,'apikey':cfg.supabasePublishableKey},body:JSON.stringify({action:'list_authorized_portals'})});const payload=await res.json();if(!res.ok)throw Error(payload.error||'Unable to verify portal access.');if(!Array.isArray(payload.portals))throw Error('Invalid authorization response.');rows=payload.portals.filter(p=>p&&typeof p==='object'&&typeof p.launch_url==='string'&&/^https:\/\//.test(p.launch_url)&&new URL(p.launch_url).hostname.endsWith('.screenings4u.com'));try{sessionStorage.setItem(cacheKey,JSON.stringify({time:Date.now(),portals:rows}))}catch{}summary.textContent=rows.length+' authorized subscription'+(rows.length===1?'':'s');message.textContent='';paint()}catch(err){rows=[];try{sessionStorage.removeItem(cacheKey)}catch{}summary.textContent='Unable to verify subscriptions';empty('Access temporarily unavailable','No portals will be displayed until authorization is verified.');message.textContent=err.message||'Please retry.';message.className='notice error'}finally{loading=false;refreshButton.disabled=false;refreshButton.textContent='↻ Refresh accounts'}}
search.addEventListener('input',paint);document.querySelector('#refresh').addEventListener('click',()=>load(true));window.addEventListener('focus',()=>load(true));document.addEventListener('visibilitychange',()=>{if(!document.hidden)load(true)});sb.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){rows=[];root.replaceChildren();summary.textContent='Signed out';count.textContent='0 shown';try{sessionStorage.removeItem('s4u_selector_v18_'+session.user.id)}catch{}location.replace('/?reason=session')}});load();})();