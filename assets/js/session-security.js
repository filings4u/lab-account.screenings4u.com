/* Workforce Lab Account session helper. Authorization remains server verified in workforce.js. */
(function(){'use strict';
const auth=window.S4UGetSupabaseClient;
window.S4USessionSecurity=Object.freeze({
 async getAuthenticatedUser(){if(!auth)throw Error('Lab Account config missing');const sb=auth();const {data,error}=await sb.auth.getUser();if(error)throw error;return data?.user||null},
 async signOut(){if(!auth)throw Error('Lab Account config missing');await auth().auth.signOut({scope:'local'});location.replace('/login.html')}
});
})();