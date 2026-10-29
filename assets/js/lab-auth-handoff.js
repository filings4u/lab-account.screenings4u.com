(async()=>{'use strict';
const status=document.getElementById('handoff-status'),back=document.getElementById('handoff-return');
const cfg={url:'https://elpbnytpciqnbexiaebp.supabase.co',key:'sb_publishable_xVI6Mjkk1bNVMGHZCPuK6w_8FSHKdkC'};
const params=new URLSearchParams(location.search),code=params.get('code');
history.replaceState(null,'','/auth-handoff.html');
function fail(message){status.textContent=message;back.hidden=false}
if(!code||!/^[a-f0-9]{64}$/i.test(code)){fail('Invalid or missing sign-in handoff. Return to the portal selector.');return}
try{
const r=await fetch(cfg.url+'/functions/v1/portal-session-handoff',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.key},body:JSON.stringify({action:'redeem',code})});
const payload=await r.json().catch(()=>({}));
if(!r.ok||!payload.token_hash)throw Error(payload.error||'Unable to verify your secure portal access.');
if(payload.target_surface!=='lab'||payload.target_portal!=='lab_account')throw Error('This sign-in link is for another portal.');
const next=new URL(payload.next_path||'/dashboard.html',location.origin);
if(next.origin!==location.origin||next.pathname!=='/dashboard.html'||next.search||next.hash)throw Error('Invalid portal destination.');
const sb=window.supabase.createClient(cfg.url,cfg.key,{auth:{storageKey:'s4u_lab_account_auth_v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const {data,error}=await sb.auth.verifyOtp({token_hash:payload.token_hash,type:'magiclink'});
if(error||!data?.session)throw error||Error('Unable to establish secure session.');
status.textContent='Signed in successfully. Opening your Lab Account…';
location.replace('/dashboard.html');
}catch(err){fail(err?.message||'Unable to finish secure sign-in.')}
})();