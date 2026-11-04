import {createClient} from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"https://lab-account.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const respond=(x:unknown,s=200)=>new Response(JSON.stringify(x),{headers:H,status:s});
Deno.serve(async req=>{
if(req.method==="OPTIONS")return new Response(null,{headers:H,status:204});
if(req.method!=="POST")return respond({error:"Method not allowed"},405);
try{
const url=Deno.env.get("SUPABASE_URL")!,pub=Deno.env.get("SUPABASE_ANON_KEY")!,secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();if(!token)return respond({error:"Sign in required"},401);
const client=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:{user},error}=await client.auth.getUser(token);if(error||!user?.email_confirmed_at)return respond({error:"Verified sign in required"},403);
const ent=await fetch(url+"/functions/v1/lab-account-entitlement",{method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":pub,"Content-Type":"application/json"},body:"{}"});
const grant=await ent.json().catch(()=>({}));if(!ent.ok||grant.authorized!==true)return respond({error:"Lab Account access required"},403);
const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const body=await req.json().catch(()=>({}));const action=String(body.action||'list');if(grant.plan==="lab-account-workflow-test-1"&&action==="update")return respond({error:"The $1 workflow test does not permit editing real testing orders."},403);
if(action==="mark_sent"){
 if(grant.plan==="lab-account-workflow-test-1")return respond({error:"Test purchases cannot submit real specimens."},403);
 const caseId=String(body.id||""),carrier=String(body.carrier||"").trim(),tracking=String(body.tracking_number||"").trim(),trackingURL=String(body.tracking_url||"").trim();
 if(!/^[0-9a-f-]{36}$/i.test(caseId)||carrier.length<2||carrier.length>100||tracking.length<4||tracking.length>180||trackingURL.length>1000||(trackingURL&&!/^https:\/\//i.test(trackingURL)))return respond({error:"Enter a valid collected testing case and shipping information."},400);
 const email=(user.email||"").trim().toLowerCase();
 const [own,matched]=await Promise.all([
  db.from("lab_account_intakes").select("id,order_id").eq("customer_user_id",user.id).eq("account_status","active").eq("status","completed").limit(20),
  db.from("lab_account_intakes").select("id,order_id").ilike("customer_email",email).eq("account_status","active").eq("status","completed").limit(20)
 ]);
 if(own.error||matched.error)throw own.error||matched.error;
 if(!own.data?.length&&!matched.data?.length)return respond({error:"Your C/TPA's House Lab Account must be activated before shipments can be reported."},403);
 const org=await db.from("organizations").select("id").ilike("primary_email",email).neq("status","archived").limit(2);
 if(org.error)throw org.error;
 if(org.data?.length!==1)return respond({error:"Verify your single C/TPA organization first."},403);
 const ctpa=await db.from("ctpas").select("id,status").eq("organization_id",org.data[0].id).maybeSingle();
 if(ctpa.error)throw ctpa.error;
 if(ctpa.data?.status!=="active")return respond({error:"Your C/TPA is still onboarding."},403);
 const shipped=await db.rpc("s4u_report_house_lab_specimen_shipped",{p_case_id:caseId,p_user_id:user.id,p_carrier:carrier,p_tracking_number:tracking,p_tracking_url:trackingURL});
 if(shipped.error)return respond({error:shipped.error.message},409);
 const admin=Deno.env.get("SCREENINGS4U_ADMIN_EMAIL")||"";
 const key=Deno.env.get("RESEND_API_KEY")||"";
 if(admin&&key){
  const esc=(x:string)=>x.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
  const subject="House Lab specimen shipment reported — "+String(shipped.data?.case_number||"Testing case");
  const html='<div style="background:#f2f6fb;padding:25px;font-family:Arial,sans-serif;color:#17365f"><div style="max-width:620px;background:#fff;margin:auto;padding:28px;border-radius:12px"><h1 style="color:#24467f">Screenings4u specimen shipment</h1><p>A C/TPA reported collected specimens shipped. Verify carrier delivery and laboratory accession separately.</p><p><strong>Case:</strong> '+esc(String(shipped.data?.case_number||""))+'</p><p><strong>Carrier:</strong> '+esc(carrier)+'</p><p><strong>Tracking:</strong> '+esc(tracking)+'</p><p><a href="https://app.screenings4u.com/testing-cases.html">Open Testing Management</a></p></div></div>';
  try{const resp=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from:Deno.env.get("SCREENINGS4U_FROM_EMAIL")||"screenings4u <notifications@screenings4u.com>",to:[admin],subject,html})});if(!resp.ok)console.error("Shipment notification failed",resp.status)}catch(error){console.error("Shipment notification failed",error)}
 }
 return respond({ok:true,shipment:shipped.data,lab_receipt:"not_confirmed"});
}
if(action==='update'){const id=String(body.id||'');if(!/^[0-9a-f-]{36}$/i.test(id))return respond({error:"Invalid testing order"},400);const first=String(body.first_name||'').trim(),last=String(body.last_name||'').trim(),reason=String(body.test_reason||'').toUpperCase();if(!first||!last||first.length>100||last.length>100||!["PE","RN","PA","RS","RT","FU","NI"].includes(reason))return respond({error:"Enter valid donor information"},400);const existing=await db.from("testing_cases").select("id,status,metadata").eq("id",id).eq("customer_user_id",user.id).maybeSingle();if(existing.error)throw existing.error;if(!existing.data)return respond({error:"Testing order not found"},404);if(existing.data.status!=="awaiting_schedule")return respond({error:"Only orders awaiting scheduling can be edited"},409);const email=String(body.donor_email||'').trim(),phone=String(body.donor_phone||'').trim(),notes=String(body.notes||'').trim(),dob=String(body.date_of_birth||'').trim(),state=String(body.state_of_residence||'').trim().toUpperCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||phone.length>35||notes.length>1000||!/^[A-Z]{2}$/.test(state)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dob)||Number.isNaN(Date.parse(dob))||new Date(dob)>new Date())return respond({error:"Enter valid donor contact and birthdate information"},400);const metadata={...(existing.data.metadata||{}),donor_date_of_birth:dob,state_of_residence:state,request_notes:notes};const result=await db.from("testing_cases").update({donor_name:first+" "+last,donor_email:email,donor_phone:phone||null,test_reason:reason,metadata,updated_at:new Date().toISOString()}).eq("id",id).eq("customer_user_id",user.id).eq("status","awaiting_schedule").select("id,case_number,donor_name,donor_email,donor_phone,test_reason,status").maybeSingle();if(result.error)throw result.error;if(!result.data)return respond({error:"This order can no longer be edited"},409);return respond({ok:true,order:result.data})}if(action!=="list")return respond({error:"Unsupported action"},400);
const q=await db.from("testing_cases").select("id,case_number,order_id,customer_user_id,donor_name,donor_email,donor_phone,dot_test,dot_agency,notes,metadata,test_type,panel_name,test_reason,priority,status,scheduled_at,collection_deadline,collected_at,result_ready_at,completed_at,created_at,donor_pass_number,collection_site_id").eq("customer_user_id",user.id).order("created_at",{ascending:false}).limit(250);
if(q.error)throw q.error;
return respond({orders:(q.data||[]).map((x:any)=>({id:x.id,case_number:x.case_number,order_id:x.order_id,donor_name:x.donor_name,donor_email:x.donor_email,donor_phone:x.donor_phone,dot_test:x.dot_test,dot_agency:x.dot_agency,notes:x.notes,date_of_birth:x.metadata?.donor_date_of_birth||null,state_of_residence:x.metadata?.state_of_residence||null,request_notes:x.metadata?.request_notes||null,test_type:x.test_type,panel_name:x.panel_name,test_reason:x.test_reason,priority:x.priority,status:x.status,scheduled_at:x.scheduled_at,collection_deadline:x.collection_deadline,collected_at:x.collected_at,result_ready_at:x.result_ready_at,completed_at:x.completed_at,created_at:x.created_at,donor_pass_number:x.donor_pass_number}))});
}catch(e){console.error("lab-account-testing-orders",e);return respond({error:"Unable to retrieve testing orders"},500)}
});