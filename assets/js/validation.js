/* isolated validation for ctpa_dot */
(()=>{'use strict';
const PORTAL_CODE="ctpa_dot";
const q=(form,name)=>form.querySelector(`[name="${CSS.escape(name)}"]`);
const setReq=(form,name)=>{const el=q(form,name);if(el){el.required=true;el.setAttribute('aria-required','true')}};
const first=(form,names)=>names.map(n=>q(form,n)).find(Boolean);
function markProfile(form){
  const names=new Set([...form.querySelectorAll('[name]')].map(x=>x.name));
  if(names.has('legal_name')){
    ['legal_name','primary_contact_name','primary_contact_email','phone','address_line1','city','postal_code','country'].forEach(n=>setReq(form,n));
    if(names.has('state'))setReq(form,'state'); if(names.has('state_region'))setReq(form,'state_region'); if(names.has('applicable_dot_agency'))setReq(form,'applicable_dot_agency');
  }
  if(names.has('first_name')&&names.has('last_name')&&(names.has('employee_number')||names.has('workforce_worker_type')||names.has('dot_agency'))){
    ['first_name','last_name'].forEach(n=>setReq(form,n));
    if(names.has('email'))setReq(form,'email');
    if(names.has('mobile'))setReq(form,'mobile'); else if(names.has('phone'))setReq(form,'phone');
    if(names.has('workforce_worker_type'))setReq(form,'workforce_worker_type');
    if(names.has('dot_agency'))setReq(form,'dot_agency');
    if(names.has('employment_status'))setReq(form,'employment_status');
  }
  if(names.has('program_type')||names.has('testing_panel')){
    ['name','dot_agency','testing_panel','testing_method','effective_date'].forEach(n=>{if(names.has(n))setReq(form,n)});
  }
  if(names.has('pool_type')||names.has('drug_testing_rate')){
    ['name','dot_agency','effective_date','selection_schedule','drug_testing_rate'].forEach(n=>{if(names.has(n))setReq(form,n)});
  }
  if(names.has('test_type')&&(names.has('employee_id')||names.has('program_id'))){
    ['employee_id','program_id','reason','test_type'].forEach(n=>{if(names.has(n))setReq(form,n)});
  }
  if(names.has('recipient_email')&&names.has('due_at')){setReq(form,'recipient_email');setReq(form,'due_at')}
}
function validateField(el){
  el.setCustomValidity(''); const v=String(el.value||'').trim();
  if(el.required&&!v){el.setCustomValidity('This field is required.');return false}
  if(v&&el.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){el.setCustomValidity('Enter a valid email address.');return false}
  if(v&&(el.type==='tel'||/phone|mobile/i.test(el.name))&&v.replace(/\D/g,'').length<10){el.setCustomValidity('Enter a complete phone number.');return false}
  if(v&&/postal_code|zip/i.test(el.name)&&String(first(el.form||document,['country'])?.value||'US').toUpperCase()==='US'&&!/^\d{5}(-?\d{4})?$/.test(v)){el.setCustomValidity('Enter a valid 5-digit or ZIP+4 code.');return false}
  if(v&&/(drug|alcohol).*rate/i.test(el.name)){const n=Number(v);if(!Number.isFinite(n)||n<0||n>100){el.setCustomValidity('Rate must be between 0 and 100.');return false}}
  return true;
}
function validateForm(form){
  markProfile(form); let ok=true,firstBad=null;
  for(const el of form.querySelectorAll('input,select,textarea')){if(el.disabled)continue;if(!validateField(el)||!el.checkValidity()){ok=false;if(!firstBad)firstBad=el}el.toggleAttribute('aria-invalid',!el.checkValidity())}
  if(!ok){firstBad?.focus();form.reportValidity();}
  return ok;
}
function bind(form){if(form.dataset.s4uValidated)return;form.dataset.s4uValidated='1';markProfile(form);form.addEventListener('submit',e=>{if(!validateForm(form)){e.preventDefault();e.stopImmediatePropagation()}},true);form.addEventListener('input',e=>{if(e.target.matches('input,select,textarea'))validateField(e.target)},true)}
function scan(root=document){root.querySelectorAll?.('form').forEach(bind)}
document.addEventListener('click',e=>{const btn=e.target.closest('button,input[type=submit]');if(!btn)return;const label=String(btn.textContent||btn.value||'').toLowerCase();if(!/(save|create|submit|send|invite|add|update|run|publish|assign|record|ship|order)/.test(label))return;const form=btn.form||btn.closest('form')||document.querySelector(btn.getAttribute('form')?`#${CSS.escape(btn.getAttribute('form'))}`:'__none__');if(form&&!validateForm(form)){e.preventDefault();e.stopImmediatePropagation()}},true);
const start=()=>{scan();new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.matches?.('form'))bind(n);scan(n)}}))).observe(document.body,{subtree:true,childList:true})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.S4UValidateForm=validateForm;window.S4U_VALIDATION_PORTAL=PORTAL_CODE;
})();