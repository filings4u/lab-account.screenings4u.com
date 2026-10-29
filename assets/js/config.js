window.PORTAL_CONFIG=Object.freeze({
  domain:"ctpa-dot.screenings4u.com",
  portalCode:"ctpa_dot",
  label:"screenings4u DOT C/TPA",
  kind:"ctpa",
  surface:"dot",
  workforceUrl:"https://elpbnytpciqnbexiaebp.supabase.co",
  workforceKey:"sb_publishable_xVI6Mjkk1bNVMGHZCPuK6w_8FSHKdkC"
});
(()=>{'use strict';
 const C=window.PORTAL_CONFIG;
 const WORKSPACE_KEY='s4u_ctpa_dot_workspace_v1';
 const AUTH_KEY='s4u_ctpa_dot_auth';
 const LEGACY_KEYS=['s4u_ctpa_dot_membership','s4u_ctpa_dot_subscription'];
 const LEGACY_SUPABASE_PREFIX='sb-elpbnytpciqnbexiaebp-';
 function clearLegacyWorkspace(){try{for(const k of LEGACY_KEYS)localStorage.removeItem(k)}catch{}}
 function readWorkspace(){try{const x=JSON.parse(localStorage.getItem(WORKSPACE_KEY)||'null');if(!x||typeof x!=='object')return null;if(!x.ctpa_id||!x.subscription_id)return null;return x}catch{return null}}
 function writeWorkspace(x){if(!x?.ctpa_id||!x?.subscription_id)throw new Error('A complete C/TPA workspace selection is required.');const clean={user_id:x.user_id||null,ctpa_id:String(x.ctpa_id),organization_id:x.organization_id?String(x.organization_id):null,membership_id:x.membership_id?String(x.membership_id):null,subscription_id:String(x.subscription_id),plan_code:x.plan_code||null,plan_name:x.plan_name||null,organization_name:x.organization_name||null,powered_by:x.powered_by||null,selected_at:new Date().toISOString()};localStorage.setItem(WORKSPACE_KEY,JSON.stringify(clean));clearLegacyWorkspace();return clean}
 function clearWorkspace(){try{localStorage.removeItem(WORKSPACE_KEY);clearLegacyWorkspace()}catch{}}
 function clearLegacyAuth(){try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i)||'';if(k.startsWith(LEGACY_SUPABASE_PREFIX))localStorage.removeItem(k)}}catch{}}
 window.S4UCTPAWorkspace=Object.freeze({key:WORKSPACE_KEY,read:readWorkspace,set:writeWorkspace,clear:clearWorkspace,clearLegacyAuth});
 window.S4UGetSupabaseClient=function(){
   if(window.__S4U_CTPA_CLIENT__)return window.__S4U_CTPA_CLIENT__;
   if(!window.supabase?.createClient)throw new Error('Supabase client library is not loaded.');
   window.__S4U_CTPA_CLIENT__=window.supabase.createClient(C.workforceUrl,C.workforceKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:AUTH_KEY}});
   return window.__S4U_CTPA_CLIENT__;
 };
 window.S4UCTPAPayload=function(body={}){const w=readWorkspace();return {...body,ctpa_id:body.ctpa_id||w?.ctpa_id||undefined,subscription_id:body.subscription_id||w?.subscription_id||undefined,membership_id:body.membership_id||w?.membership_id||undefined}};
 clearLegacyWorkspace();
 if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{}),{once:true})}
})();
