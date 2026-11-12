import {createClient} from "npm:@supabase/supabase-js@2";
const CORS={"Access-Control-Allow-Origin":"https://lab-account.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const send=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:CORS});
const uid=(x:unknown)=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(x||""));
const isEmail=(x:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)&&x.length<=254;
const codes:{[key:string]:string}={directory:"client_directory",ccf:"digital_coc_archive",delivery:"automatic_result_delivery",alerts:"supply_reorder_alerts",analytics:"analytics_reporting"};
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:CORS,status:204});
 if(req.method!=="POST")return send({error:"POST required"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")!,pub=Deno.env.get("SUPABASE_ANON_KEY")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  const auth=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await auth.auth.getUser(token);
  if(authError||!user||!user.email_confirmed_at)return send({error:"Verified Lab Account sign-in required"},401);
  const grant=await fetch(url+"/functions/v1/lab-account-entitlement",{method:"POST",headers:{Authorization:"Bearer "+token,apikey:pub,"Content-Type":"application/json"},body:"{}"});
  const ent=await grant.json().catch(()=>({}));
  if(!grant.ok||!ent.authorized||ent.preview||ent.plan==="lab-account-workflow-test-1")return send({error:"A paid Lab Account is required"},403);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const b=await req.json().catch(()=>({}));
  const feature=String(b.feature||""),action=String(b.action||"list");
  if(!Object.hasOwn(codes,feature))return send({error:"Unknown Lab Account feature"},400);
  if(!Array.isArray(ent.feature_codes)||!ent.feature_codes.includes(codes[feature]))return send({error:"This feature is not currently available with your purchased Lab Account plan"},403);
  const owner=user.id;
  if(feature==="directory"){
   if(action==="list"){
    const q=await db.from("lab_portal_clients").select("id,company_name,contact_name,contact_email,phone,program_type,notes,created_at").eq("customer_user_id",owner).is("archived_at",null).order("created_at",{ascending:false}).limit(300);
    if(q.error)throw q.error;return send({clients:q.data||[]});
   }
   if(action==="save"){
    const company_name=String(b.company_name||"").trim().slice(0,160),contact_name=String(b.contact_name||"").trim().slice(0,160),contact_email=String(b.contact_email||"").trim().toLowerCase(),phone=String(b.phone||"").trim().slice(0,40),notes=String(b.notes||"").trim().slice(0,1500),program_type=String(b.program_type||"non_dot");
    if(company_name.length<2||!["dot","non_dot","both"].includes(program_type)||(contact_email&&!isEmail(contact_email)))return send({error:"Enter a company and valid contact details"},400);
    const values={company_name,contact_name,contact_email:contact_email||null,phone:phone||null,program_type,notes,updated_at:new Date().toISOString()};
    let q:any;
    if(b.id){if(!uid(b.id))return send({error:"Invalid client"},400);q=await db.from("lab_portal_clients").update(values).eq("id",b.id).eq("customer_user_id",owner).is("archived_at",null).select("id").maybeSingle();}
    else q=await db.from("lab_portal_clients").insert({...values,customer_user_id:owner}).select("id").single();
    if(q.error)throw q.error;if(!q.data)return send({error:"Client not found"},404);return send({ok:true,id:q.data.id});
   }
   if(action==="archive"){
    if(!uid(b.id))return send({error:"Invalid client"},400);
    const q=await db.from("lab_portal_clients").update({archived_at:new Date().toISOString()}).eq("customer_user_id",owner).eq("id",b.id).select("id").maybeSingle();
    if(q.error)throw q.error;if(!q.data)return send({error:"Client not found"},404);return send({ok:true});
   }
  }
  if(feature==="alerts"){
   if(action==="list"){
    const q=await db.from("lab_portal_supply_alerts").select("id,supply_name,reorder_threshold,estimated_on_hand,enabled,updated_at").eq("customer_user_id",owner).order("created_at",{ascending:false}).limit(200);
    if(q.error)throw q.error;
    const intakes=await db.from("lab_account_intakes").select("id").eq("customer_user_id",owner).limit(50);
    if(intakes.error)throw intakes.error;
    const ids=(intakes.data||[]).map(x=>x.id);
    const shipments=ids.length?await db.from("house_lab_supply_shipments").select("id,carrier,tracking_number,status,items_description,updated_at").in("intake_id",ids).order("created_at",{ascending:false}).limit(20):{data:[],error:null};
    if(shipments.error)throw shipments.error;
    return send({alerts:(q.data||[]).map(x=>({...x,needs_reorder:x.enabled&&x.estimated_on_hand<=x.reorder_threshold})),shipments:shipments.data||[]});
   }
   if(action==="save"){
    const supply_name=String(b.supply_name||"").trim().slice(0,160),reorder_threshold=Number(b.reorder_threshold),estimated_on_hand=Number(b.estimated_on_hand),enabled=b.enabled!==false;
    if(supply_name.length<2||!Number.isInteger(reorder_threshold)||reorder_threshold<1||reorder_threshold>100000||!Number.isInteger(estimated_on_hand)||estimated_on_hand<0||estimated_on_hand>1000000)return send({error:"Enter a valid supply name and nonnegative quantities"},400);
    const previous=await db.from("lab_portal_supply_alerts").select("id,last_alert_at,estimated_on_hand,reorder_threshold,enabled").eq("customer_user_id",owner).eq("supply_name",supply_name).maybeSingle();
    if(previous.error)throw previous.error;
    const q=await db.from("lab_portal_supply_alerts").upsert({customer_user_id:owner,supply_name,reorder_threshold,estimated_on_hand,enabled,updated_at:new Date().toISOString()},{onConflict:"customer_user_id,supply_name"}).select("id").single();
    if(q.error)throw q.error;
    const low=enabled&&estimated_on_hand<=reorder_threshold;
    const previouslyLow=previous.data?.enabled&&previous.data?.estimated_on_hand<=previous.data?.reorder_threshold;
    const last=previous.data?.last_alert_at?Date.parse(previous.data.last_alert_at):0;
    let emailSent=false;
    if(low&&(!previouslyLow||!last||Date.now()-last>24*60*60*1000)){
      const resend=Deno.env.get("RESEND_API_KEY")||"",from=Deno.env.get("SCREENINGS4U_FROM_EMAIL")||"";
      const customer=String(user.email||"");
      if(resend&&from&&customer){
        const clean=(v:string)=>v.replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]||ch));
        const html='<div style="background:#eef2f7;padding:25px;font:15px Arial,sans-serif;color:#01122F"><div style="margin:auto;max-width:600px;background:#fff;border-radius:12px;padding:28px"><img src="https://workforce.screenings4u.com/images/logo2.png" alt="Workforce" style="width:200px;background:#01122F;padding:15px;border-radius:8px"><h2>Supply reorder alert</h2><p>Your entered inventory estimate for <strong>'+clean(supply_name)+'</strong> is '+estimated_on_hand+' with a reorder threshold of '+reorder_threshold+'.</p><p>Review your inventory and submit an order if more supplies are needed.</p><a href="https://lab-account.screenings4u.com/supply-alerts.html" style="display:inline-block;background:#FDC102;color:#01122F;padding:12px 16px;border-radius:6px;text-decoration:none;font-weight:bold">Review supply alerts</a></div></div>';
        try{
          const resp=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+resend,"Content-Type":"application/json"},body:JSON.stringify({from,to:[customer],subject:"Workforce Lab Account — supply reorder alert",html})});
          if(resp.ok){emailSent=true;await db.from("lab_portal_supply_alerts").update({last_alert_at:new Date().toISOString()}).eq("id",q.data.id).eq("customer_user_id",owner)}
          else console.warn("Supply reminder could not be sent",resp.status);
        }catch(error){console.warn("Supply reminder delivery unavailable",error)}
      }
    }
    return send({ok:true,needs_reorder:low,email_sent:emailSent});
   }
   if(action==="delete"){
    if(!uid(b.id))return send({error:"Invalid alert"},400);
    const q=await db.from("lab_portal_supply_alerts").delete().eq("customer_user_id",owner).eq("id",b.id).select("id").maybeSingle();
    if(q.error)throw q.error;return send({ok:!!q.data});
   }
  }
  if(feature==="analytics"){
   if(action!=="list")return send({error:"Read-only analytics"},400);
   const q=await db.from("testing_cases").select("id,status,dot_test,test_type,created_at,collected_at,received_by_lab_at,released_at").eq("customer_user_id",owner).order("created_at",{ascending:false}).limit(1000);
   if(q.error)throw q.error;
   const cases=q.data||[],monthly=new Map<string,{month:string,orders:number,released:number}>();
   let released=0,dot=0,non_dot=0,turnaroundSum=0,turnaroundN=0;
   for(const c of cases){
    const month=String(c.created_at||"").slice(0,7);if(!monthly.has(month))monthly.set(month,{month,orders:0,released:0});
    const m=monthly.get(month)!;m.orders++;
    if(c.dot_test)dot++;else non_dot++;
    if(c.released_at){released++;m.released++;if(c.collected_at){const hours=(Date.parse(c.released_at)-Date.parse(c.collected_at))/3600000;if(hours>=0&&hours<24*365){turnaroundSum+=hours;turnaroundN++;}}}
   }
   const statuses:Record<string,number>={};for(const c of cases){const st=String(c.status||"unknown");statuses[st]=(statuses[st]||0)+1}
   return send({metrics:{orders:cases.length,released,dot,non_dot,pending:cases.length-released,average_hours_to_release:turnaroundN?Math.round(turnaroundSum/turnaroundN*10)/10:null},monthly:[...monthly.values()].sort((a,b)=>a.month.localeCompare(b.month)).slice(-12),statuses,limit_reached:cases.length===1000});
  }
  if(feature==="ccf"){
   if(action==="list"){
    const cases=await db.from("testing_cases").select("id,case_number,created_at,dot_test,release_recipient").eq("customer_user_id",owner).not("released_at","is",null).order("created_at",{ascending:false}).limit(400);
    if(cases.error)throw cases.error;
    const ids=(cases.data||[]).map(x=>x.id);
    const docs=ids.length?await db.from("testing_case_documents").select("id,testing_case_id,title,document_type,created_at,visibility").in("testing_case_id",ids).is("archived_at",null).limit(700):{data:[],error:null};
    if(docs.error)throw docs.error;
    const related=new Map((cases.data||[]).map(x=>[x.id,x]));
    return send({documents:(docs.data||[]).filter(x=>/\b(ccf|chain.of.custody|custody)\b/i.test(String(x.document_type||"")+" "+String(x.title||""))&&["customer","public","customer_portal","released"].includes(String(x.visibility||"").toLowerCase())).map(x=>({...x,case_number:related.get(x.testing_case_id)?.case_number||"—"}))});
   }
   if(action==="download"){
    if(!uid(b.id))return send({error:"Invalid document"},400);
    const d=await db.from("testing_case_documents").select("id,testing_case_id,document_type,title,visibility,storage_bucket,storage_path").eq("id",b.id).is("archived_at",null).maybeSingle();
    if(d.error)throw d.error;
    if(!d.data||!/\b(ccf|chain.of.custody|custody)\b/i.test(String(d.data.document_type||"")+" "+String(d.data.title||""))||!["customer","public","customer_portal","released"].includes(String(d.data.visibility||"").toLowerCase()))return send({error:"Document not released for customer access"},403);
    const owned=await db.from("testing_cases").select("id").eq("id",d.data.testing_case_id).eq("customer_user_id",owner).not("released_at","is",null).maybeSingle();
    if(owned.error)throw owned.error;if(!owned.data)return send({error:"Document access denied"},403);
    if(!["testing-private-documents","testing-documents","compliance-documents"].includes(d.data.storage_bucket)||!d.data.storage_path)return send({error:"Private document unavailable"},404);
    const signed=await db.storage.from(d.data.storage_bucket).createSignedUrl(d.data.storage_path,120);
    if(signed.error||!signed.data?.signedUrl)throw signed.error||Error("Document link failed");
    return send({url:signed.data.signedUrl,expires_in:120});
   }
  }
  if(feature==="delivery"){
   if(action==="list"){
    const q=await db.from("lab_portal_result_deliveries").select("id,testing_case_id,recipient_email,recipient_name,status,staff_notes,created_at,completed_at").eq("customer_user_id",owner).order("created_at",{ascending:false}).limit(150);
    if(q.error)throw q.error;
    const cases=await db.from("testing_cases").select("id,case_number,released_at").eq("customer_user_id",owner).not("released_at","is",null).order("released_at",{ascending:false}).limit(150);
    if(cases.error)throw cases.error;
    return send({deliveries:q.data||[],released_cases:(cases.data||[]).map(x=>({id:x.id,case_number:x.case_number,released_at:x.released_at}))});
   }
   if(action==="request"){
    const caseId=String(b.testing_case_id||""),email=String(b.recipient_email||"").toLowerCase().trim(),name=String(b.recipient_name||"").trim().slice(0,150);
    if(!uid(caseId)||!isEmail(email))return send({error:"Select a released case and enter a valid authorized recipient"},400);
    const owned=await db.from("testing_cases").select("id").eq("id",caseId).eq("customer_user_id",owner).not("released_at","is",null).maybeSingle();
    if(owned.error)throw owned.error;if(!owned.data)return send({error:"Only your released testing results may be delivered"},403);
    const pending=await db.from("lab_portal_result_deliveries").select("id").eq("customer_user_id",owner).eq("testing_case_id",caseId).eq("recipient_email",email).in("status",["pending_review","approved","delivered"]).limit(1);
    if(pending.error)throw pending.error;if(pending.data?.length)return send({error:"This result has already been requested or delivered to this recipient"},409);
    const q=await db.from("lab_portal_result_deliveries").insert({customer_user_id:owner,testing_case_id:caseId,recipient_email:email,recipient_name:name,status:"pending_review"}).select("id,status").single();
    if(q.error)throw q.error;return send({ok:true,delivery:q.data});
   }
  }
  return send({error:"Unsupported action"},400);
 }catch(e){console.error("lab-advanced-features",e);return send({error:"Unable to process this Lab Account feature"},500)}
});