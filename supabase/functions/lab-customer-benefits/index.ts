import {createClient} from "npm:@supabase/supabase-js@2";
import {PDFDocument,StandardFonts,rgb} from "npm:pdf-lib@1.17.1";
const HEAD={"Access-Control-Allow-Origin":"https://lab-account.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:HEAD});
const validUUID=(s:unknown)=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(s||""));
const clip=(v:unknown,max=200)=>String(v??"").trim().slice(0,max);
const dateValid=(v:unknown)=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||""))&&!Number.isNaN(Date.parse(String(v)));
const steps=["register_account","verify_employer_information","designate_consortium","review_driver_queries","confirm_account_access"];
const cap=(lines:string[])=>lines.flatMap(x=>{let value=x.slice(0,1800),out:string[]=[];while(value.length>91){let cut=value.lastIndexOf(" ",91);if(cut<15)cut=91;out.push(value.slice(0,cut));value=value.slice(cut).trimStart()}out.push(value);return out});
const makePdf=async(title:string,subtitle:string,lines:string[])=>{
 const pdf=await PDFDocument.create();
 const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const navy=rgb(1/255,18/255,47/255),gold=rgb(253/255,193/255,2/255);
 let page=pdf.addPage([612,792]),y=742;
 const newPage=()=>{page=pdf.addPage([612,792]);y=742};
 const draw=(value:string,fontSize=10,font=regular,color=navy)=>{
  for(const part of cap([value.replace(/[^\x20-\x7E]/g," ")])){
   if(y<60)newPage();
   page.drawText(part,{x:45,y,size:fontSize,font,color});y-=fontSize+7;
  }
 };
 page.drawRectangle({x:0,y:766,width:612,height:26,color:navy});
 page.drawRectangle({x:45,y:713,width:54,height:4,color:gold});
 draw("WORKFORCE LAB ACCOUNT",11,bold);y-=10;
 draw(title.slice(0,120),17,bold);y-=10;draw(subtitle,9);
 y-=20;
 for(const line of lines.slice(0,500)){draw(line,10);y-=line?3:7}
 y-=15;draw("Generated "+new Date().toISOString()+" UTC",8);
 draw("Customer-managed account record. Not government certification, verified selection history, or a laboratory result.",8);
 const bytes=await pdf.save();return new Uint8Array(bytes);
};
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEAD});
 if(req.method!=="POST")return reply({error:"POST required"},405);
 try{
 const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!url||!anon||!key)return reply({error:"Service not configured"},503);
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!token)return reply({error:"Sign-in required"},401);
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(token);
 if(authError||!user?.email_confirmed_at)return reply({error:"Verified sign-in required"},401);
 const entitled=await fetch(url+"/functions/v1/lab-account-entitlement",{method:"POST",headers:{Authorization:"Bearer "+token,apikey:anon,"Content-Type":"application/json"},body:"{}"});
 const ent=await entitled.json().catch(()=>({}));
 if(!entitled.ok||!ent.authorized||ent.preview===true||!Array.isArray(ent.feature_codes))return reply({error:"Active purchased Lab Account access required"},403);
 const rights=new Set<string>(ent.feature_codes);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const b=await req.json().catch(()=>({})),action=clip(b.action||"overview",50),owner=user.id;
 const need=(code:string)=>rights.has(code);
 const ownPool=async(id:unknown)=>{
  if(!validUUID(id))return null;
  const res=await db.from("lab_customer_consortiums").select("id,name,program_type,dot_agency,status,effective_date,selection_schedule").eq("id",id).eq("owner_user_id",owner).maybeSingle();
  if(res.error)throw res.error;return res.data;
 };
 const fileResponse=async(kind:"consortium_certificate"|"client_template"|"audit_package",title:string,rows:string[])=>{
  const id=crypto.randomUUID();
  const path="lab-benefits/"+owner+"/"+id+".pdf";
  const bytes=await makePdf(title,"Customer-generated account document",rows);
  const up=await db.storage.from("testing-private-documents").upload(path,bytes,{contentType:"application/pdf",cacheControl:"0",upsert:false});
  if(up.error)throw up.error;
  const saved=await db.from("lab_customer_generated_documents").insert({id,customer_user_id:owner,document_type:kind,title,storage_bucket:"testing-private-documents",storage_path:path}).select("id,title,document_type,created_at").single();
  if(saved.error){await db.storage.from("testing-private-documents").remove([path]);throw saved.error}
  const signed=await db.storage.from("testing-private-documents").createSignedUrl(path,120);
  if(signed.error||!signed.data?.signedUrl)throw signed.error||Error("Unable to generate document download");
  return reply({document:saved.data,download_url:signed.data.signedUrl,expires_in:120});
 };
 if(action==="overview"){
  const [programs,schedule,setup,docs]=await Promise.all([
   need("consortium_pools")?db.from("lab_customer_consortiums").select("id,name,program_type,status").eq("owner_user_id",owner).order("created_at",{ascending:false}).limit(200):Promise.resolve({data:[],error:null}),
   need("random_selection_calendar")?db.from("lab_customer_selection_schedules").select("id,consortium_id,selection_type,scheduled_for,status,created_at").eq("customer_user_id",owner).order("scheduled_for",{ascending:true}).limit(200):Promise.resolve({data:[],error:null}),
   need("clearinghouse_setup")?db.from("lab_customer_clearinghouse_setups").select("id,company_name,dot_number,steps,status,updated_at").eq("customer_user_id",owner).order("created_at",{ascending:false}).limit(30):Promise.resolve({data:[],error:null}),
   db.from("lab_customer_generated_documents").select("id,document_type,title,created_at").eq("customer_user_id",owner).order("created_at",{ascending:false}).limit(100)
  ]);
  for(const x of [programs,schedule,setup,docs])if(x.error)throw x.error;
  return reply({feature_codes:[...rights],programs:programs.data||[],schedules:schedule.data||[],clearinghouse_setups:setup.data||[],documents:(docs.data||[]).filter((x:any)=>rights.has(({consortium_certificate:"consortium_certificates",client_template:"client_document_templates",audit_package:"audit_readiness_export"} as any)[x.document_type]))});
 }
 if(action==="schedule_create"||action==="schedule_cancel"){
  if(!need("random_selection_calendar")||!need("consortium_pools"))return reply({error:"Consortium scheduling is not included in your purchased plan"},403);
  if(action==="schedule_cancel"){
   if(!validUUID(b.id))return reply({error:"Invalid schedule"},400);
   const q=await db.from("lab_customer_selection_schedules").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",b.id).eq("customer_user_id",owner).eq("status","scheduled").select("id").maybeSingle();
   if(q.error)throw q.error;return q.data?reply({ok:true}):reply({error:"Schedule not found"},404);
  }
  const pool=await ownPool(b.consortium_id),kind=clip(b.selection_type,30),when=clip(b.scheduled_for,40);
  if(!pool||pool.status!=="active")return reply({error:"Select one of your active consortium programs"},400);
  if(!["drug","alcohol"].includes(kind)||!dateValid(when)||Date.parse(when+"T12:00:00Z")<Date.now()-86400000||Date.parse(when+"T12:00:00Z")>Date.now()+366*86400000)return reply({error:"Select a valid upcoming date and selection type"},400);
  if(kind==="alcohol"&&pool.program_type==="NON-DOT")return reply({error:"Select a supported testing schedule for this program"},400);
  const q=await db.from("lab_customer_selection_schedules").insert({consortium_id:pool.id,customer_user_id:owner,selection_type:kind,scheduled_for:when,status:"scheduled"}).select("id,scheduled_for,status").single();
  if(q.error)throw q.error;return reply({schedule:q.data,notice:"Selection date recorded. This does not perform a random draw or issue a test order."});
 }
 if(action==="clearinghouse_save"){
  if(!need("clearinghouse_setup"))return reply({error:"Clearinghouse setup tools are not in your purchased plan"},403);
  const company=clip(b.company_name,160),dot=clip(b.dot_number,30),input=b.steps||{};
  if(company.length<2||!/^[0-9]{0,10}$/.test(dot)||typeof input!=="object"||Array.isArray(input))return reply({error:"Enter a valid company name and USDOT number"},400);
  const complete:Record<string,boolean>={};
  for(const key of steps)complete[key]=input[key]===true;
  const status=steps.every(key=>complete[key])?"self_reported_complete":"in_progress";
  const payload={company_name:company,dot_number:dot,steps:complete,status,updated_at:new Date().toISOString()};
  let q:any;
  if(b.id){if(!validUUID(b.id))return reply({error:"Invalid record"},400);q=await db.from("lab_customer_clearinghouse_setups").update(payload).eq("id",b.id).eq("customer_user_id",owner).select("id,status").maybeSingle()}
  else q=await db.from("lab_customer_clearinghouse_setups").insert({...payload,customer_user_id:owner}).select("id,status").single();
  if(q.error)throw q.error;if(!q.data)return reply({error:"Setup record not found"},404);
  return reply({record:q.data,notice:"Checklist saved. FMCSA registration and authorization are not verified by Workforce."});
 }
 if(action==="create_template"){
  if(!need("client_document_templates"))return reply({error:"Document templates not included in your purchased plan"},403);
  const company=clip(b.company_name,160),contact=clip(b.contact_name,120),email=clip(b.contact_email,180),type=clip(b.template_type,50);
  if(company.length<2||!["client_intake","testing_instructions","collection_checklist"].includes(type)||email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:"Enter valid template details"},400);
  const labels:{[key:string]:string}={client_intake:"Client Intake Worksheet",testing_instructions:"Testing Order Instructions",collection_checklist:"Collection Readiness Checklist"};
  const rows=["Company: "+company,"Primary contact: "+contact,"Contact email: "+email,"","Instructions:",...(type==="client_intake"?["Record company and account information.","Confirm DOT or NON-DOT program type.","Verify authorized contacts before placing orders."]:type==="testing_instructions"?["Select the correct testing service.","Enter accurate donor details.","Follow laboratory collection and chain-of-custody instructions."]:["Confirm specimen collection instructions.","Confirm sealed kit and required labels.","Document carrier shipment and retain tracking information."]),"","This is an editable-workflow reference, not a regulatory approval or laboratory report."];
  return fileResponse("client_template",labels[type]+" - "+company,rows);
 }
 if(action==="certificate_create"){
  if(!need("consortium_certificates")||!need("consortium_pools"))return reply({error:"Consortium records not included in your purchased plan"},403);
  const pool=await ownPool(b.consortium_id);if(!pool||pool.status!=="active")return reply({error:"Select one of your active programs"},400);
  const members=await db.from("lab_customer_consortium_members").select("first_name,last_name,eligibility_status,employment_status").eq("consortium_id",pool.id).eq("owner_user_id",owner).limit(500);
  if(members.error)throw members.error;
  const active=(members.data||[]).filter((m:any)=>m.eligibility_status==="eligible"&&m.employment_status==="active");
  return fileResponse("consortium_certificate","Consortium Participation Record",["Customer-managed program: "+pool.name,"Program category: "+pool.program_type,"DOT agency: "+(pool.dot_agency||"Not applicable"),"Effective date: "+pool.effective_date,"Active eligible participants: "+active.length,"","This document records customer-maintained roster information only.","It is NOT verification of official random selections, testing compliance, or enrollment with an external C/TPA."]);
 }
 if(action==="audit_create"){
  if(!need("audit_readiness_export"))return reply({error:"Audit package not in your purchased plan"},403);
  const [programs,cases,docs]=await Promise.all([
   db.from("lab_customer_consortiums").select("id,name,program_type,status").eq("owner_user_id",owner).limit(250),
   db.from("testing_cases").select("id,status,dot_test,released_at").eq("customer_user_id",owner).limit(2000),
   db.from("lab_customer_generated_documents").select("id,title,document_type").eq("customer_user_id",owner).limit(200)
  ]);
  for(const x of [programs,cases,docs])if(x.error)throw x.error;
  const c=cases.data||[];
  const rows=["ACCOUNT RECORD INVENTORY","Consortium programs: "+(programs.data||[]).length,...(programs.data||[]).map((p:any)=>"Program: "+p.name+" | "+p.program_type+" | "+p.status),"","Testing case count: "+c.length,"Released case count: "+c.filter((x:any)=>!!x.released_at).length,"DOT case count: "+c.filter((x:any)=>x.dot_test===true).length,"Customer generated documents: "+(docs.data||[]).length,"","Important: This is an inventory summary, not an official DOT compliance audit, verified MRO report, or a complete regulatory evidence archive. Review supporting original records separately."];
  return fileResponse("audit_package","Lab Account Records Inventory / Audit Preparation",rows);
 }
 if(action==="download"){
  if(!validUUID(b.id))return reply({error:"Invalid document"},400);
  const q=await db.from("lab_customer_generated_documents").select("id,document_type,storage_bucket,storage_path").eq("id",b.id).eq("customer_user_id",owner).maybeSingle();
  if(q.error)throw q.error;if(!q.data)return reply({error:"Document not found"},404);
  const code=({consortium_certificate:"consortium_certificates",client_template:"client_document_templates",audit_package:"audit_readiness_export"} as any)[q.data.document_type];
  if(!need(code)||q.data.storage_bucket!=="testing-private-documents"||!q.data.storage_path.startsWith("lab-benefits/"+owner+"/"))return reply({error:"Not authorized to access this document"},403);
  const signed=await db.storage.from("testing-private-documents").createSignedUrl(q.data.storage_path,120);
  if(signed.error||!signed.data?.signedUrl)throw signed.error||Error("Cannot access document");return reply({download_url:signed.data.signedUrl,expires_in:120});
 }
 return reply({error:"Unknown benefit operation"},400);
 }catch(e){console.error("Lab customer benefits",e);return reply({error:"Unable to process account benefit"},500)}
});