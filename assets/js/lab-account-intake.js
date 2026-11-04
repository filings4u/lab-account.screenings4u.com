
const API="https://elpbnytpciqnbexiaebp.supabase.co/functions/v1/public-form-submit";
const form=document.getElementById("form");
let authenticatedUser=null;
(async()=>{try{const c=window.S4U_ACCESS_CONFIG;if(!c||!window.supabase)throw Error("Sign-in configuration unavailable");const sb=window.supabase.createClient(c.supabaseUrl,c.supabasePublishableKey,{auth:{storageKey:c.authStorageKey,persistSession:true,autoRefreshToken:true}});const {data:{user}}=await sb.auth.getUser();if(!user){const next="/lab-account-intake.html"+location.search;location.replace("/login.html?next="+encodeURIComponent(next));return}authenticatedUser=user;const email=form.elements.primary_contact_email;if(email&&!email.value)email.value=user.email||"";}catch(e){document.getElementById("msg").textContent=e.message||"Authentication unavailable";document.getElementById("submitBtn").disabled=true}})();
const msg=document.getElementById("msg");
const submitBtn=document.getElementById("submitBtn");
const formStartedAt=Date.now();
const intakeParams=new URLSearchParams(location.search);
const intakeHashParams=new URLSearchParams(String(location.hash||"").replace(/^#/,""));
const intakeToken=(intakeParams.get("token")||intakeParams.get("intake_token")||intakeHashParams.get("token")||intakeHashParams.get("intake_token")||"").trim();
if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(intakeToken)){
 document.addEventListener("DOMContentLoaded",()=>{
  const out=document.getElementById("msg"),submit=document.getElementById("submitBtn");
  if(out){out.textContent="Open this intake from the secure link in your Workforce Lab Account purchase email. A valid purchase intake token is required.";out.className="msg error"}
  if(submit)submit.disabled=true;
 });
}
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

const websiteField=form.elements.website;
if(websiteField){
  const normalizeWebsite=()=>{const value=websiteField.value.trim();if(!value||value==="https://")return;websiteField.value=/^https?:\/\//i.test(value)?value:"https://"+value.replace(/^\/+/, "");};
  websiteField.addEventListener("blur",normalizeWebsite);
  websiteField.addEventListener("focus",()=>{if(!websiteField.value.trim())websiteField.value="https://";});
}
function collectIntake(){
  const fd=new FormData(form),data={};
  for(const [k,v] of fd.entries()){
    if(k==="websiteTrap") continue;
    data[k]=k==="website" && String(v).trim()==="https://" ? "" : v;
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
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(intakeToken)){msg.textContent="The secure purchase intake link is missing or invalid.";msg.className="msg error";return;}
  if(websiteField){const v=websiteField.value.trim();if(v&&v!=="https://"&&!/^https?:\/\//i.test(v))websiteField.value="https://"+v;}
  if(!validateNoPoBoxes()||!form.reportValidity()) return;
  submitBtn.disabled=true;
  msg.textContent="Submitting…";
  msg.className="msg";
  try{
    let security={};
    try{security=window.Screenings4uFormSecurity?.payload(form)||{};}catch(err){console.error("Security verification unavailable.",err);}
    if(!security.turnstileToken){msg.textContent="Complete the security verification before submitting.";msg.className="msg error";document.querySelector(".s4u-form-security")?.scrollIntoView({behavior:"smooth",block:"center"});return;}
    const response=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({formKey:"lab_account_intake",intakeToken,turnstileToken:security.turnstileToken||"",formStartedAt:security.formStartedAt||formStartedAt,websiteTrap:security.websiteTrap||form.elements.websiteTrap?.value||"",sourceUrl:location.href,payload:collectIntake()})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result.error){try{window.Screenings4uFormSecurity?.reset(form);}catch{}throw new Error(result.error||"Unable to submit the lab account intake.");}
    msg.textContent=`Your intake has been received. Submission ${result.submissionNumber||""}`.trim();
    msg.className="msg success";
    submitBtn.hidden=true;
    const link=document.createElement("a");
    link.href="https://lab-account.screenings4u.com/dashboard.html";
    link.className="btn secondary";
    link.style.textDecoration="none";
    link.textContent="Continue to dashboard";
    submitBtn.insertAdjacentElement("afterend",link);
  }catch(e){msg.textContent=e?.message||"Unable to submit the lab account intake.";msg.className="msg error";}finally{submitBtn.disabled=false;}
});
