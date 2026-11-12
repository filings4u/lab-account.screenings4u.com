import { createClient } from "npm:@supabase/supabase-js@2";
const origin="https://lab-account.screenings4u.com";
const H={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const send=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:H});
const text=(x:unknown,max=250)=>String(x??"").trim().slice(0,max);
const guid=(x:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x??""));
const validDate=(x:unknown)=>/^\d{4}-\d{2}-\d{2}$/.test(String(x??""))&&!Number.isNaN(Date.parse(String(x)));
const agencies=new Set(["FMCSA","FAA","FRA","FTA","PHMSA","USCG"]);
const schedules=new Set(["monthly","quarterly","semiannual","annual"]);
const statuses=new Set(["draft","active","paused"]);
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:H});
 if(req.method!=="POST")return send({error:"POST required"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")!,pub=Deno.env.get("SUPABASE_ANON_KEY")!,secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if(!url||!pub||!secret)return send({error:"Consortium service configuration unavailable"},503);
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return send({error:"Sign in required"},401);
  const auth=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await auth.auth.getUser(token);
  if(authError||!user?.email_confirmed_at)return send({error:"Verified sign in required"},401);
  const entitlementResponse=await fetch(url+"/functions/v1/lab-account-entitlement",{method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":pub,"Content-Type":"application/json"},body:"{}"});
  const entitlement=await entitlementResponse.json().catch(()=>({}));
  if(!entitlementResponse.ok||entitlement.authorized!==true||entitlement.features?.consortium!==true)return send({error:"An active Lab Account consortium entitlement is required"},403);
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const body=await req.json().catch(()=>({})),action=text(body.action||"list",40),uid=user.id;
  const own=async(id:unknown)=>{
   if(!guid(id))return null;
   const q=await db.from("lab_customer_consortiums").select("*").eq("id",id).eq("owner_user_id",uid).maybeSingle();
   if(q.error)throw q.error;
   return q.data;
  };
  const record=async(id:string,type:string,summary:string)=>{
   const e=await db.from("lab_customer_consortium_events").insert({consortium_id:id,owner_user_id:uid,event_type:type,summary});
   if(e.error)console.error("Consortium audit entry error",e.error);
  };
  const activeRule=async(agency:string,date:string)=>{
    const q=await db.from("regulatory_rules").select("dot_agency,effective_date,end_date,drug_rate,alcohol_rate,version,status")
     .eq("dot_agency",agency).eq("status","active").lte("effective_date",date)
     .order("effective_date",{ascending:false}).order("version",{ascending:false}).limit(30);
    if(q.error)throw q.error;
    return (q.data||[]).find((r:any)=>!r.end_date||r.end_date>=date)||null;
  };
  if(action==="rules"){
    const today=new Date().toISOString().slice(0,10);
    const q=await db.from("regulatory_rules").select("dot_agency,effective_date,end_date,drug_rate,alcohol_rate,version,status")
      .eq("status","active").lte("effective_date",today).order("effective_date",{ascending:false}).limit(100);
    if(q.error)throw q.error;
    const byAgency=new Map<string,any>();
    for(const item of q.data||[])if(agencies.has(item.dot_agency)&&(!item.end_date||item.end_date>=today)&&!byAgency.has(item.dot_agency))byAgency.set(item.dot_agency,item);
    return send({rules:[...byAgency.values()]});
  }
  if(action==="list"){
   const [p,m]=await Promise.all([
    db.from("lab_customer_consortiums").select("*").eq("owner_user_id",uid).order("created_at",{ascending:false}).limit(150),
    db.from("lab_customer_consortium_members").select("id,consortium_id,eligibility_status").eq("owner_user_id",uid).limit(5000)
   ]);
   if(p.error||m.error)throw p.error||m.error;
   return send({programs:(p.data||[]).map((x:any)=>({...x,member_count:(m.data||[]).filter((y:any)=>y.consortium_id===x.id).length,eligible_count:(m.data||[]).filter((y:any)=>y.consortium_id===x.id&&y.eligibility_status==="eligible").length}))});
  }
  if(action==="create"||action==="update"){
   const p=body.program||{},name=text(p.name,161),type=text(p.program_type,20).toUpperCase(),agency=type==="DOT"?text(p.dot_agency,10).toUpperCase():null,schedule=text(p.selection_schedule,30),status=text(p.status||"draft",20),date=text(p.effective_date,30),notes=text(p.notes,1000);
   if(name.length<2||name.length>160||!["DOT","NON-DOT"].includes(type)||type==="DOT"&&!agencies.has(agency||"")||!schedules.has(schedule)||!statuses.has(status)||!validDate(date))return send({error:"Complete the required program name, testing category, agency, effective date and schedule"},400);
   if(type==="DOT"&&!(await activeRule(agency!,date)))return send({error:"No active DOT regulatory rule is available for this agency and effective date"},409);
   const values={name,program_type:type,dot_agency:agency,selection_schedule:schedule,effective_date:date,status,notes,updated_at:new Date().toISOString()};
   if(action==="create"){
    const q=await db.from("lab_customer_consortiums").insert({...values,owner_user_id:uid}).select("*").single();
    if(q.error)throw q.error;
    await record(q.data.id,"program_created","Customer created the consortium program");
    return send({program:q.data});
   }
   const existing=await own(body.id);
   if(!existing)return send({error:"Program not found"},404);
   const changedRegulatory=existing.program_type!==type||existing.dot_agency!==agency||existing.selection_schedule!==schedule||existing.effective_date!==date;
   if(changedRegulatory){
    const count=await db.from("lab_customer_consortium_members").select("id",{head:true,count:"exact"}).eq("consortium_id",existing.id).eq("owner_user_id",uid);
    if(count.error)throw count.error;
    if((count.count||0)>0)return send({error:"This program has current participants. Remove them before changing its agency, program type, effective date or selection schedule."},409);
   }
   const q=await db.from("lab_customer_consortiums").update({...values,last_exported_at:null}).eq("id",existing.id).eq("owner_user_id",uid).select("*").single();
   if(q.error)throw q.error;
   await record(existing.id,"program_updated","Customer updated the consortium program");
   return send({program:q.data});
  }
  if(action==="detail"||action==="export"){
   const p=await own(body.id);if(!p)return send({error:"Program not found"},404);
   const [members,events]=await Promise.all([
    db.from("lab_customer_consortium_members").select("*").eq("consortium_id",p.id).eq("owner_user_id",uid).order("created_at",{ascending:true}).limit(5000),
    db.from("lab_customer_consortium_events").select("*").eq("consortium_id",p.id).eq("owner_user_id",uid).order("created_at",{ascending:true}).limit(10000)
   ]);
   if(members.error||events.error)throw members.error||events.error;
   if(action==="export"){
    const update=await db.from("lab_customer_consortiums").update({last_exported_at:new Date().toISOString()}).eq("id",p.id).eq("owner_user_id",uid);
    if(update.error)throw update.error;
   }
   const rule=p.program_type==="DOT"?await activeRule(p.dot_agency,p.effective_date):null;
   return send({program:p,members:members.data||[],events:events.data||[],regulatory_rule:rule,exported:action==="export",export_note:"Official laboratory results, regulatory selection histories and financial records maintained separately are not included and are not deleted with this customer-managed program."});
  }
  if(action==="add_member"){
   const p=await own(body.id);if(!p)return send({error:"Program not found"},404);
   const m=body.member||{},first=text(m.first_name,101),last=text(m.last_name,101),email=text(m.email,200),ref=text(m.employee_reference,100),joined=text(m.joined_on,30),eligibility=text(m.eligibility_status||"eligible",20),dotCovered=m.dot_covered===true||m.dot_covered==="on",safetySensitive=m.safety_sensitive===true||m.safety_sensitive==="on",employment=text(m.employment_status||"active",20);
   if(!first||!last||first.length>100||last.length>100||email&& !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!validDate(joined)||!["eligible","inactive"].includes(eligibility)||!["active","inactive"].includes(employment))return send({error:"Complete valid participant information"},400);
   if(p.program_type==="DOT"&&eligibility==="eligible"&&(!dotCovered||!safetySensitive||employment!=="active"))return send({error:"For DOT pool eligibility, confirm DOT coverage, safety-sensitive duties and active employment"},400);
   const q=await db.from("lab_customer_consortium_members").insert({consortium_id:p.id,owner_user_id:uid,first_name:first,last_name:last,email,employee_reference:ref,joined_on:joined,eligibility_status:eligibility,dot_covered:dotCovered,safety_sensitive:safetySensitive,employment_status:employment}).select("*").single();
   if(q.error)throw q.error;
   await record(p.id,"participant_added","Participant added: "+first+" "+last);
   await db.from("lab_customer_consortiums").update({last_exported_at:null}).eq("id",p.id).eq("owner_user_id",uid);
   return send({member:q.data});
  }
  if(action==="update_member"||action==="remove_member"){
   const p=await own(body.id);if(!p)return send({error:"Program not found"},404);
   if(!guid(body.member_id))return send({error:"Valid participant required"},400);
   const prior=await db.from("lab_customer_consortium_members").select("*").eq("id",body.member_id).eq("consortium_id",p.id).eq("owner_user_id",uid).maybeSingle();
   if(prior.error)throw prior.error;if(!prior.data)return send({error:"Participant not found"},404);
   if(action==="remove_member"){
    const d=await db.from("lab_customer_consortium_members").delete().eq("id",prior.data.id).eq("consortium_id",p.id).eq("owner_user_id",uid);
    if(d.error)throw d.error;
    await record(p.id,"participant_removed","Participant removed: "+prior.data.first_name+" "+prior.data.last_name);
   }else{
    const m=body.member||{},first=text(m.first_name,101),last=text(m.last_name,101),email=text(m.email,200),eligibility=text(m.eligibility_status,20),joined=text(m.joined_on,30),dotCovered=m.dot_covered===true||m.dot_covered==="on",safetySensitive=m.safety_sensitive===true||m.safety_sensitive==="on",employment=text(m.employment_status||"active",20);
    if(!first||!last||first.length>100||last.length>100||email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!["eligible","inactive"].includes(eligibility)||!validDate(joined)||!["active","inactive"].includes(employment))return send({error:"Valid participant information required"},400);
    if(p.program_type==="DOT"&&eligibility==="eligible"&&(!dotCovered||!safetySensitive||employment!=="active"))return send({error:"For DOT pool eligibility, confirm DOT coverage, safety-sensitive duties and active employment"},400);
    const u=await db.from("lab_customer_consortium_members").update({first_name:first,last_name:last,email,employee_reference:text(m.employee_reference,100),eligibility_status:eligibility,dot_covered:dotCovered,safety_sensitive:safetySensitive,employment_status:employment,joined_on:joined,updated_at:new Date().toISOString()}).eq("id",prior.data.id).eq("consortium_id",p.id).eq("owner_user_id",uid);
    if(u.error)throw u.error;
    await record(p.id,"participant_updated","Participant updated: "+first+" "+last);
   }
   await db.from("lab_customer_consortiums").update({last_exported_at:null}).eq("id",p.id).eq("owner_user_id",uid);
   return send({ok:true});
  }
  if(action==="delete"){
   const p=await own(body.id);if(!p)return send({error:"Program not found"},404);
   if(text(body.confirm,300)!=="DELETE "+p.name)return send({error:"Type DELETE followed by the complete program name to confirm"},400);
   if(!p.last_exported_at||Date.now()-Date.parse(p.last_exported_at)>15*60*1000)return send({error:"Export all program records as CSV before permanently deleting this program (export expires after 15 minutes)"},409);
   const q=await db.from("lab_customer_consortiums").delete().eq("id",p.id).eq("owner_user_id",uid).select("id").maybeSingle();
   if(q.error)throw q.error;if(!q.data)return send({error:"Program could not be deleted"},409);
   return send({ok:true,deleted_id:p.id,notice:"Customer-managed program, participants and activity events deleted. Separate regulated test history and required compliance records were not deleted."});
  }
  return send({error:"Unsupported action"},400);
 }catch(e){
  console.error("Lab customer consortium error",e);
  return send({error:"Unable to process the consortium request"},500);
 }
});