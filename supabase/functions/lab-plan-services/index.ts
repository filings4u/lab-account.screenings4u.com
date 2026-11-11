import {createClient} from "npm:@supabase/supabase-js@2";
const HEAD={"Access-Control-Allow-Origin":"https://lab-account.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const out=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:HEAD});
const definitions:Record<string,{permission:"consortium"|"compliance_docs",type:string,fields:string[]}> = {
 consortium_enrollment:{permission:"consortium",type:"enrollment",fields:["company_name","program_type","dot_agency","desired_start","notes"]},
 consortium_participant_add:{permission:"consortium",type:"participant_add",fields:["participant_name","company_name","program_type","effective_date","notes"]},
 consortium_participant_remove:{permission:"consortium",type:"participant_remove",fields:["participant_name","company_name","effective_date","reason"]},
 consortium_selection_schedule:{permission:"consortium",type:"selection_schedule",fields:["company_name","program_type","requested_period","notes"]},
 consortium_certificate:{permission:"consortium",type:"certificate",fields:["company_name","certificate_period","notes"]},
 compliance_document:{permission:"compliance_docs",type:"compliance_document",fields:["document_type","company_name","notes"]},
 clearinghouse_setup:{permission:"compliance_docs",type:"clearinghouse_setup",fields:["company_name","dot_number","contact_email","notes"]},
 client_document_template:{permission:"compliance_docs",type:"document_template",fields:["template_type","company_name","notes"]},
 audit_readiness_export:{permission:"compliance_docs",type:"audit_package",fields:["company_name","audit_period","notes"]}
};
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
 if(action==="list"){
  const result=await db.from("lab_plan_service_requests").select("id,feature_code,request_type,title,details,status,staff_notes,document_name,created_at,updated_at,fulfilled_at").eq("customer_user_id",user.id).order("created_at",{ascending:false}).limit(200);
  if(result.error)throw result.error;
  return out({plan:ent.plan,permissions,requests:(result.data||[]).filter((x:any)=>definitions[x.feature_code]?.permission&&permissions[definitions[x.feature_code].permission]),services:Object.entries(definitions).filter(([,d])=>permissions[d.permission]).map(([code,d])=>({code,type:d.type,fields:d.fields}))});
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
  const created=await db.from("lab_plan_service_requests").insert({customer_user_id:user.id,feature_code:feature,request_type:def.type,title,details,status:"submitted"}).select("id,status,created_at").single();
  if(created.error)throw created.error;
  return out({ok:true,request:created.data});
 }
 if(action==="download"){
  const id=String(body.id||"");
  if(!uuid(id))return out({error:"Invalid request ID"},400);
  const record=await db.from("lab_plan_service_requests").select("id,feature_code,status,document_bucket,document_path").eq("id",id).eq("customer_user_id",user.id).maybeSingle();
  if(record.error)throw record.error;
  if(!record.data||!definitions[record.data.feature_code]||!permissions[definitions[record.data.feature_code].permission]||record.data.status!=="completed"||record.data.document_bucket!=="testing-private-documents"||!record.data.document_path)return out({error:"A completed document is not available for this request"},404);
  if(!record.data.document_path.startsWith("lab-plan-services/"+user.id+"/"+id+"/"))return out({error:"Document ownership mismatch"},403);
  const signed=await db.storage.from("testing-private-documents").createSignedUrl(record.data.document_path,120);
  if(signed.error||!signed.data?.signedUrl)throw signed.error||Error("Cannot generate document link");
  return out({download_url:signed.data.signedUrl,expires_in:120});
 }
 return out({error:"Unsupported action"},400);
 }catch(err){console.error("lab-plan-services",err);return out({error:"Unable to process Lab Account service"},500)}
});