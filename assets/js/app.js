/* Legacy-page compatibility bootstrap: load the existing Workforce application. */
(function(){'use strict';
if(window.__s4uWorkforceBootstrapped)return;
const page=document.body?.dataset?.portalPage||'dashboard';
const supported=new Set(['dashboard','lab-accounts','results','billing','documents','supplies','testing-order','order-history']);
if(!supported.has(page)){console.warn('Unsupported Lab Account page:',page);return}
if(!document.querySelector('#workspace')){const root=document.createElement('div');root.id='workspace';root.setAttribute('aria-live','polite');document.body.replaceChildren(root)}
if(!document.querySelector('link[href^="/assets/css/workforce.css"]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/css/workforce.css';document.head.append(css)}
if(document.querySelector('script[src^="/assets/js/workforce.js"]'))return;
window.__s4uWorkforceBootstrapped=true;
const s=document.createElement('script');s.src='/assets/js/workforce.js';s.defer=true;document.body.append(s);
})();