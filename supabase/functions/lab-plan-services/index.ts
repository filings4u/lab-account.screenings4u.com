import {createClient} from "npm:@supabase/supabase-js@2";
const HEAD={"Access-Control-Allow-Origin":"https://lab-account.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const out=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:HEAD});
const definitions:Record<string,{catalog:string,permission:"consortium"|"compliance_docs",type:string,fields:string[]}> = {
 consortium_enrollment:{catalog:"consortium_pools",permission:"consortium",type:"enrollment",fields:["company_name","program_type","dot_agency","desired_start","notes"]},
 consortium_participant_add:{catalog:"consortium_participants",permission:"consortium",type:"participant_add",fields:["participant_name","company_name","program_type","effective_date","notes"]},
 consortium_participant_remove:{catalog:"consortium_participants",permission:"consortium",type:"participant_remove",fields:["participant_name","company_name","effective_date","reason"]},
 consortium_selection_schedule:{catalog:"random_selection_calendar",permission:"consortium",type:"selection_schedule",fields:["company_name","program_type","requested_period","notes"]},
 consortium_certificate:{catalog:"consortium_certificates",permission:"consortium",type:"certificate",fields:["company_name","certificate_period","notes"]},
 compliance_document:{catalog:"compliance_documents",permission:"compliance_docs",type:"compliance_document",fields:["document_type","company_name","notes"]},
 clearinghouse_setup:{catalog:"clearinghouse_setup",permission:"compliance_docs",type:"clearinghouse_setup",fields:["company_name","dot_number","contact_email","notes"]},
 client_document_template:{catalog:"client_document_templates",permission:"compliance_docs",type:"document_template",fields:["template_type","company_name","notes"]},
 audit_readiness_export:{catalog:"audit_readiness_export",permission:"compliance_docs",type:"audit_package",fields:["company_name","audit_period","notes"]}
};
const serviceOf=(feature:string,type:string)=>Object.entries(definitions).find(([,d])=>d.catalog===feature&&d.type===type)?.[0]||null;
const uuid=(v:unknown)=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(v||""));
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEAD});
 if(req.method!=="POST")return out({error:"POST required"},405);
 try{
 const url=Deno.env.get("SUPABASE_URL")!,pub=Deno.env.get("SUPABASE_ANON_KEY")!,secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token)return out({error:"Sign-in required"},401);
 const auth=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(token);
 if(authError||!user||!user.email_confirmed_at)return out({error:"Verified sign-in required"},401);
 const verified=await fetch(url+"/functions/v1/lab-account-entitlement",{method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":pub,"Content-Type":"application/json"},body:"{}"});
 const ent=await verified.json().catch(()=>({}));
 if(!verified.ok||!ent.authorized||ent.preview===true)return out({error:"An active purchased Lab Account is required"},403);
 const permissions={consortium:ent.features?.consortium===true,compliance_docs:ent.features?.compliance_docs===true};
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const body=await req.json().catch(()=>({}));
 const action=String(body.action||"list");
 if(action==="overview"){
  if(!permissions.consortium)return out({error:"Consortium access is not included in your paid plan"},403);
  const org=await db.from("organization_memberships").select("organization_id").eq("user_id",user.id).eq("status","active").limit(100);
  if(org.error)throw org.error;
  const orgIds=[...new Set((org.data||[]).map((x:any)=>x.organization_id).filter(Boolean))];
  if(!orgIds.length)return out({pools:[],status:"awaiting_provisioning"});
  const ctpas=await db.from("ctpas").select("id,tenant_id").in("organization_id",orgIds).limit(100);
  if(ctpas.error)throw ctpas.error;
  const ctpaIds=(ctpas.data||[]).map((x:any)=>x.id);
  if(!ctpaIds.length)return out({pools:[],status:"awaiting_provisioning"});
  const pools=await db.from("random_pools").select("id,name,program_type,pool_type,dot_agency,selection_schedule,status,effective_date,tenant_id,ctpa_id").in("ctpa_id",ctpaIds).order("created_at",{ascending:false}).limit(100);
  if(pools.error)throw pools.error;
  const permittedTenants=new Map((ctpas.data||[]).map((x:any)=>[x.id,x.tenant_id]));
  const own=(pools.data||[]).filter((x:any)=>permittedTenants.get(x.ctpa_id)===x.tenant_id);
  const ids=own.map((x:any)=>x.id);
  const members=ids.length?await db.from("pool_memberships").select("pool_id,tenant_id,removed_at,eligibility_status").in("pool_id",ids).is("removed_at",null).limit(4000):{data:[],error:null};
  if(members.error)throw members.error;
  const count=new Map<string,number>();
  for(const x of members.data||[]){if(own.some((p:any)=>p.id===x.pool_id&&p.tenant_id===x.tenant_id)&&String(x.eligibility_status).toLowerCase()!=="ineligible")count.set(x.pool_id,(count.get(x.pool_id)||0)+1)}
  return out({pools:own.map((x:any)=>({name:x.name,program_type:x.program_type,pool_type:x.pool_type,dot_agency:x.dot_agency,selection_schedule:x.selection_schedule,status:x.status,effective_date:x.effective_date,active_participant_count:count.get(x.id)||0})),status:own.length?"provisioned":"awaiting_provisioning"});
 }
 if(action==="list"){
  const result=await db.from("lab_plan_service_requests").select("id,feature_code,request_type,title,details,status,staff_notes,document_name,created_at,updated_at,fulfilled_at").eq("customer_user_id",user.id).order("created_at",{ascending:false}).limit(200);
  if(result.error)throw result.error;
  return out({plan:ent.plan,permissions,requests:(result.data||[]).map((x:any)=>({...x,service_code:serviceOf(x.feature_code,x.request_type)})).filter((x:any)=>x.service_code&&permissions[definitions[x.service_code].permission]),services:Object.entries(definitions).filter(([,d])=>permissions[d.permission]).map(([code,d])=>({code,type:d.type,fields:d.fields}))});
 }
 if(action==="create"){
  const feature=String(body.feature_code||""),def=definitions[feature];
  if(!def||!permissions[def.permission])return out({error:"This service is not included in your purchased plan"},403);
  const source=(body.details&&typeof body.details==="object"&&!Array.isArray(body.details))?body.details:{};
  const details:Record<string,string>={};
  for(const key of def.fields){
   const raw=source[key];
   if(raw!==undefined&&raw!==null){if(typeof raw!=="string")return out({error:"Invalid field: "+key},400);details[key]=raw.trim().slice(0,key==="notes"?1200:180);}
  }
  if(!Object.values(details).some(Boolean))return out({error:"Add details to submit this request"},400);
  const title=String(body.title||feature.replaceAll("_"," ")).trim().slice(0,180);
  if(title.length<3)return out({error:"A descriptive title is required"},400);
  const created=await db.from("lab_plan_service_requests").insert({customer_user_id:user.id,feature_code:def.catalog,request_type:def.type,title,details,status:"submitted"}).select("id,status,created_at").single();
  if(created.error)throw created.error;
  return out({ok:true,request:created.data});
 }
 if(action==="download"){
  const id=String(body.id||"");
  if(!uuid(id))return out({error:"Invalid request ID"},400);
  const record=await db.from("lab_plan_service_requests").select("id,feature_code,request_type,status,document_bucket,document_path").eq("id",id).eq("customer_user_id",user.id).maybeSingle();
  if(record.error)throw record.error;
  if(!record.data||!serviceOf(record.data.feature_code,record.data.request_type)||!permissions[definitions[serviceOf(record.data.feature_code,record.data.request_type)!].permission]||record.data.status!=="completed"||record.data.document_bucket!=="testing-private-documents"||!record.data.document_path)return out({error:"A completed document is not available for this request"},404);
  if(!record.data.document_path.startsWith("lab-plan-services/"+user.id+"/"+id+"/"))return out({error:"Document ownership mismatch"},403);
  const signed=await db.storage.from("testing-private-documents").createSignedUrl(record.data.document_path,120);
  if(signed.error||!signed.data?.signedUrl)throw signed.error||Error("Cannot generate document link");
  return out({download_url:signed.data.signedUrl,expires_in:120});
 }
 return out({error:"Unsupported action"},400);
 }catch(err){console.error("lab-plan-services",err);return out({error:"Unable to process Lab Account service"},500)}
});