
const API="https://elpbnytpciqnbexiaebp.supabase.co/functions/v1/public-form-submit";
const form=document.getElementById("form");
let authenticatedUser=null;
(async()=>{try{const c=window.S4U_ACCESS_CONFIG;if(!c||!window.supabase)throw Error("Sign-in configuration unavailable");const sb=window.supabase.createClient(c.supabaseUrl,c.supabasePublishableKey,{auth:{storageKey:c.authStorageKey,persistSession:true,autoRefreshToken:true}});const {data:{user}}=await sb.auth.getUser();if(!user){location.replace("/login.html");return}authenticatedUser=user;const email=form.elements.primary_contact_email;if(email&&!email.value)email.value=user.email||"";}catch(e){document.getElementById("msg").textContent=e.message||"Authentication unavailable";document.getElementById("submitBtn").disabled=true}})();
const msg=document.getElementById("msg");
const submitBtn=document.getElementById("submitBtn");
const formStartedAt=Date.now();
const intakeParams=new URLSearchParams(location.search);
const intakeHashParams=new URLSearchParams(String(location.hash||"").replace(/^#/,""));
const intakeToken=(intakeParams.get("token")||intakeParams.get("intake_token")||intakeHashParams.get("token")||intakeHashParams.get("intake_token")||"").trim();
const PO_BOX_RE=/\bP(?:OST)?\.?\s*O(?:FFICE)?\.?\s*BOX\b|\bP\.?\s*O\.?\s*BOX\b|\bPOBOX\b/i;

function copyPhysicalAddress(prefix,checked){
  const map={address_line1:"physical_address_line1",address_line2:"physical_address_line2",city:"physical_city",state:"physical_state",postal_code:"physical_postal_code"};
  for(const [suffix,source] of Object.entries(map)){
    const target=form.elements[`${prefix}_${suffix}`];
    if(!target) continue;
    target.value=checked ? (form.elements[source]?.value || "") : target.value;
    target.readOnly=checked;
  }
}

document.querySelectorAll("[data-copy-address]").forEach(box=>{
  box.addEventListener("change",()=>copyPhysicalAddress(box.dataset.copyAddress,box.checked));
});

form.querySelectorAll("[name^='physical_']").forEach(el=>{
  el.addEventListener("input",()=>document.querySelectorAll("[data-copy-address]:checked").forEach(box=>copyPhysicalAddress(box.dataset.copyAddress,true)));
});

function collectIntake(){
  const fd=new FormData(form),data={};
  for(const [k,v] of fd.entries()){
    if(k==="websiteTrap") continue;
    data[k]=v;
  }
  for(const n of ["billing_same_as_physical","shipping_same_as_physical","mailing_same_as_physical"]){
    data[n]=!!form.elements[n]?.checked;
  }
  return data;
}

function validateNoPoBoxes(){
  for(const input of form.querySelectorAll("[data-no-po-box]")){
    input.setCustomValidity(PO_BOX_RE.test(input.value) ? "P.O. Boxes are not allowed. Enter a physical street address." : "");
    if(!input.checkValidity()){input.reportValidity();input.focus();return false;}
  }
  return true;
}

form.querySelectorAll("[data-no-po-box]").forEach(input=>input.addEventListener("input",()=>{
  input.setCustomValidity(PO_BOX_RE.test(input.value) ? "P.O. Boxes are not allowed. Enter a physical street address." : "");
}));

form.addEventListener("submit",async e=>{

  e.preventDefault();
  if(!authenticatedUser){msg.textContent="Please sign in to continue.";return;}
  if(!validateNoPoBoxes()||!form.reportValidity()) return;
  submitBtn.disabled=true;
  msg.textContent="Submitting…";
  msg.className="msg";
  try{
    let security={};
    try{security=window.Screenings4uFormSecurity?.payload(form)||{};}catch(err){console.warn("Form security is still initializing.",err);}
    const response=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({formKey:"lab_account_intake",intakeToken,turnstileToken:security.turnstileToken||"",formStartedAt:security.formStartedAt||formStartedAt,websiteTrap:security.websiteTrap||form.elements.websiteTrap?.value||"",sourceUrl:location.href,payload:collectIntake()})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result.error){try{window.Screenings4uFormSecurity?.reset(form);}catch{}throw new Error(result.error||"Unable to submit the lab account intake.");}
    msg.textContent=`Your intake has been received. Submission ${result.submissionNumber||""}`.trim();
    msg.className="msg success";
    const link=document.createElement("a");link.href="/dashboard.html";link.className="btn secondary";link.textContent="Continue to dashboard";submitBtn.insertAdjacentElement("afterend",link);
    if(result.portalUrl){document.getElementById("portalLink")?.remove();const link=document.createElement("a");link.id="portalLink";link.className="btn secondary";link.href=result.portalUrl;link.textContent="Open Customer Portal";link.style.textDecoration="none";submitBtn.parentElement.appendChild(link);}
  }catch(e){msg.textContent=e?.message||"Unable to submit the lab account intake.";msg.className="msg error";}finally{submitBtn.disabled=false;}
});
