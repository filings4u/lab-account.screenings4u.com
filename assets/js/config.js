/* Workforce Lab Account compatibility configuration. No secrets here. */
(function(){'use strict';
const base=window.S4U_ACCESS_CONFIG;
if(!base){console.error('Lab Account config missing: load /config.js before /assets/js/config.js');return;}
window.PORTAL_CONFIG=Object.freeze({
 domain:'lab-account.screenings4u.com',
 portalCode:'workforce_lab_account',
 label:'screenings4u Workforce Lab Account',
 kind:'workforce',
 surface:'workforce',
 workforceUrl:base.supabaseUrl,
 workforceKey:base.supabasePublishableKey,
 authStorageKey:base.authStorageKey,
 selectorEndpoint:base.selectorEndpoint
});
window.S4UGetSupabaseClient=function(){
 if(window.labAccountClient)return window.labAccountClient;
 if(!window.supabase?.createClient)throw Error('Supabase library not loaded');
 window.labAccountClient=window.supabase.createClient(base.supabaseUrl,base.supabasePublishableKey,{auth:{storageKey:base.authStorageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 return window.labAccountClient;
};
})();