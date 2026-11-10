import {createClient} from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"https://lab-account.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const send=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});
const str=(x:any)=>String(x??"").trim();
const escapeHtml=(x:any)=>str(x).replace(/[&<>"']/g,(v:string)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[v]||v));
const notification=async(db:any,to:string,subject:string,heading:string,body:string,caseId:string,kind:string)=>{
 const key=Deno.env.get("RESEND_API_KEY")||"";
 const from=Deno.env.get("SCREENINGS4U_FROM_EMAIL")||"screenings4u <notifications@screenings4u.com>";
 let status="not_configured",providerId:string|null=null,error:string|null=null;
 if(key&&to){
  const html='<div style="background:#f2f6fb;padding:26px;font-family:Arial,sans-serif;color:#17365f"><div style="max-width:620px;background:#fff;margin:auto;border:1px solid #dce6f0;border-radius:14px;overflow:hidden"><div style="background:#01122f;padding:23px"><img width="220" alt="Workforce by screenings4u" src="https://workforce.screenings4u.com/images/logo.png"></div><div style="padding:28px"><h1 style="font-size:23px;margin:0 0 15px;color:#01122f">'+escapeHtml(heading)+'</h1><p style="line-height:1.65">'+escapeHtml(body)+'</p><a href="https://lab-account.screenings4u.com/order-history.html" style="display:inline-block;margin-top:12px;padding:12px 17px;background:#fdc102;color:#01122f;text-decoration:none;border-radius:8px;font-weight:bold">View Lab Account</a></div></div></div>';
  try{const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from,to:[to],subject,html})});
    const result=await r.json().catch(()=>({}));status=r.ok?"sent":"failed";providerId=result.id||null;error=r.ok?null:str(result.message||("HTTP "+r.status)).slice(0,300);
  }catch(e){status="failed";error=str(e).slice(0,300)}
 }
 const audit=await db.from("testing_email_events").insert({event_type:kind,related_entity_type:"testing_case",related_entity_id:caseId,recipient_email:to,subject,provider:"resend",provider_message_id:providerId,status,error_message:error,sent_at:status==="sent"?new Date().toISOString():null,metadata:{source:"lab_account_portal"}});
 if(audit.error)console.error("Lab Account notification audit",audit.error);
 if(status!=="sent")console.error("Lab Account email notification",kind,status,error||"");
 return status;
};

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:H});
 if(req.method!=="POST")return send({error:"Method not allowed"},405);
 try {
 const url=Deno.env.get("SUPABASE_URL")!,pub=Deno.env.get("SUPABASE_ANON_KEY")!,secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 const auth=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await auth.auth.getUser(token);if(error||!user?.email_confirmed_at)return send({error:"Verified sign in required"},401);
 const grantRes=await fetch(url+"/functions/v1/lab-account-entitlement",{method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":pub,"Content-Type":"application/json"},body:"{}"});
 const grant=await grantRes.json().catch(()=>({}));if(!grantRes.ok||grant.authorized!==true)return send({error:"Lab Account access required"},403);
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const body=await req.json().catch(()=>({})),action=str(body.action||"catalog");
 if(action==="catalog"){
 const q=await db.from("services").select("id,name,sku,slug,description,metadata").eq("active",true).order("name");
 if(q.error)throw q.error;
 return send({services:(q.data||[]).filter((x:any)=>x.metadata?.public_site==="screenings4u"&&x.metadata?.public_catalog===true&&x.metadata?.testing_operation===true).map((x:any)=>({id:x.id,name:x.name,sku:x.sku,description:x.description,labcorp_eligible:x.metadata.labcorp_fulfillment===true,testing_scope:x.metadata.testing_scope||null}))});
 }
 if(action==="create"&&grant.plan==="lab-account-workflow-test-1")return send({error:"This $1 workflow test does not include live testing orders."},403);
 if(action==="create"){
   const email=(user.email||"").trim().toLowerCase();
   const [own,byEmail]=await Promise.all([
     db.from("lab_account_intakes").select("id,order_id,customer_email").eq("customer_user_id",user.id).eq("account_status","active").eq("status","completed").limit(20),
     db.from("lab_account_intakes").select("id,order_id,customer_email").ilike("customer_email",email).eq("account_status","active").eq("status","completed").limit(20)
   ]);
   if(own.error||byEmail.error)throw own.error||byEmail.error;
   const candidates=[...new Map([...(own.data||[]),...(byEmail.data||[])].map(x=>[x.id,x])).values()];
   if(!candidates.length)return send({error:"Your House Lab Account setup has not been activated. Complete onboarding and contact Screenings4U before requesting live tests."},403);
   const orders=await db.from("orders").select("id,payment_status").in("id",candidates.map(x=>x.order_id));
   if(orders.error)throw orders.error;
   if(!(orders.data||[]).some(o=>o.payment_status==="paid"))return send({error:"A paid and active House Lab Account is required."},403);
   const orgs=await db.from("organizations").select("id").ilike("primary_email",email).neq("status","archived").limit(2);
   if(orgs.error)throw orgs.error;
   if(orgs.data?.length!==1)return send({error:"The C/TPA organization needs verification before live testing."},403);
   const ctpa=await db.from("ctpas").select("id,status").eq("organization_id",orgs.data[0].id).maybeSingle();
   if(ctpa.error)throw ctpa.error;
   if(ctpa.data?.status!=="active")return send({error:"C/TPA operational access has not been activated."},403);
   const assigned=await db.from("ctpa_lab_accounts").select("id",{head:true,count:"exact"}).eq("ctpa_id",ctpa.data.id).eq("status","active");
   if(assigned.error)throw assigned.error;
   if(!assigned.count)return send({error:"No active laboratory account numbers are assigned to this C/TPA."},403);
 const id=str(body.service_id),first=str(body.first_name),last=str(body.last_name),email=str(body.donor_email),state=str(body.state_of_residence).toUpperCase(),reason=str(body.reason_for_test).toUpperCase();
 if(!/^[0-9a-f-]{36}$/i.test(id)||!first||!last||first.length>100||last.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/[A-Z]{2}/.test(state)||state.length!==2||!["PE","RN","PA","RS","RT","FU","NI"].includes(reason))return send({error:"Complete the donor and test information"},400);
 const service=await db.from("services").select("id,name,metadata").eq("id",id).eq("active",true).maybeSingle();if(service.error)throw service.error;
 const meta=service.data?.metadata;if(!meta||meta.public_site!=="screenings4u"||meta.public_catalog!==true||meta.testing_operation!==true)return send({error:"Testing service unavailable"},409);
 const authority=str(body.testing_authority).toUpperCase();
 if(meta.testing_scope==="dot"&&!["FMCSA","FAA","FRA","FTA","PHMSA","USCG"].includes(authority))return send({error:"Choose the required DOT authority"},400);
 const dob=str(body.date_of_birth);if(!/^\d{4}-\d{2}-\d{2}$/.test(dob)||Number.isNaN(Date.parse(dob))||new Date(dob)>new Date())return send({error:"Valid donor date of birth required"},400);
 const notes=str(body.notes).slice(0,1000),now=new Date().toISOString();
 const row=await db.from("testing_cases").insert({service_id:id,customer_user_id:user.id,customer_email:user.email,donor_name:first+" "+last,donor_email:email,donor_phone:str(body.donor_phone).slice(0,35)||null,dot_test:meta.testing_scope==="dot",dot_agency:authority||null,test_reason:reason,test_type:service.data.name,panel_name:service.data.name,priority:"normal",status:"awaiting_schedule",metadata:{source:"lab_account_portal",request_status:"submitted_for_management_review",labcorp_eligible:meta.labcorp_fulfillment===true,registration_submitted:false,request_notes:notes,donor_date_of_birth:dob,state_of_residence:state},created_by:user.id,created_at:now,updated_at:now}).select("id,case_number,status").single();if(row.error)throw row.error;
 const event=await db.from("testing_case_events").insert({id:crypto.randomUUID(),testing_case_id:row.data.id,event_type:"case_created",from_status:null,to_status:row.data.status,notes:"Lab Account testing request submitted for management processing",metadata:{source:"lab_account_portal"},actor_user_id:user.id,created_at:now});
 if(event.error)console.error("Case event write failed",event.error);
 // The case has already been committed. Email failures must not create duplicate cases on retries.
 const caseRef=str(row.data.case_number||row.data.id);
 const customerStatus=await notification(db,str(user.email),"Workforce | Testing request received — "+caseRef,"Your testing request was received","Reference: "+caseRef+". We have received your laboratory testing request and it is awaiting review. This is not a collection appointment or issued donor pass.",row.data.id,"lab_account_testing_case_customer");
 const staff=await db.from("staff_business_access").select("user_id").eq("business_unit_code","testing").eq("active",true).limit(50);
 if(staff.error)console.error("Testing admin lookup",staff.error);
 const emails:string[]=[];
 for(const item of staff.data||[]){const u=await db.auth.admin.getUserById(item.user_id);if(u.data?.user?.email)emails.push(u.data.user.email.toLowerCase())}
 const envAdmin=str(Deno.env.get("SCREENINGS4U_ADMIN_EMAIL"));if(envAdmin)emails.push(envAdmin.toLowerCase());
 const adminEmails=[...new Set(emails.filter(x=>x!==str(user.email).toLowerCase()))];
 const adminStatus=await Promise.all(adminEmails.map(email=>notification(db,email,"New Lab Account testing request — "+caseRef,"Testing request needs review","A Lab Account customer submitted a new testing request. Reference: "+caseRef+". Open Testing Management to review and process it.",row.data.id,"lab_account_testing_case_admin")));
 return send({ok:true,case:row.data,labcorp_submission:"not_submitted",donor_pass:"not_issued",notification_status:{customer:customerStatus,admin:adminStatus.length?adminStatus:"no_admin_recipients"}});

 }
 if(action==="passes"){
 const cases=await db.from("testing_cases").select("id").eq("customer_user_id",user.id).order("created_at",{ascending:false}).limit(250);if(cases.error)throw cases.error;
 const ids=(cases.data||[]).map((x:any)=>x.id);if(!ids.length)return send({passes:[]});
 const q=await db.from("testing_donor_passes").select("id,pass_number,status,testing_case_id,donor_name,test_type,collection_site_name,collection_site_address,collection_deadline,issued_at,order_id").in("testing_case_id",ids).eq("customer_user_id",user.id).order("created_at",{ascending:false});if(q.error)throw q.error;
 const issued=(q.data||[]).filter((x:any)=>x.status==="issued");
 return send({passes:issued});
 }
 return send({error:"Unsupported action"},400);
 }catch(e){console.error("Lab Account order creation",e);return send({error:"Unable to process testing request"},500)}
});