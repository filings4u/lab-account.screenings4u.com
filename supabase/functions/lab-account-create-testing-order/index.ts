import {createClient} from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"https://lab-account.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const send=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});
const str=(x:any)=>String(x??"").trim();
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
 return send({ok:true,case:row.data,labcorp_submission:"not_submitted",donor_pass:"not_issued"});
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