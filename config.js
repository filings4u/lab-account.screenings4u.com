/* Lab Account authentication: public client values only. Configure Turnstile hostname in Cloudflare. */
window.S4U_ACCESS_CONFIG=Object.freeze({
 supabaseUrl:'https://elpbnytpciqnbexiaebp.supabase.co',
 supabasePublishableKey:'sb_publishable_xVI6Mjkk1bNVMGHZCPuK6w_8FSHKdkC',
 authStorageKey:'s4u_lab_account_auth',
 turnstileSiteKey:'0x4AAAAAAE4-F43E-viFsKat',
 selectorEndpoint:'https://elpbnytpciqnbexiaebp.supabase.co/functions/v1/central-portal-selector',
 redirectAfterSignIn:'/selector.html'
});
