import {createClient} from "npm:@supabase/supabase-js@2";
const origin="https://lab-account.screenings4u.com";
Deno.serve(async(req:Request)=>{
 const H={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
 const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:H});
 if(req.method!=="POST")return out({error:"Method not allowed"},405);
 try{
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!token)return out({error:"Sign in required"},401);
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await auth.auth.getUser(token);
 if(error||!user?.email_confirmed_at)return out({error:"Verified sign in required"},403);
 const grantRes=await fetch(url+"/functions/v1/lab-account-entitlement",{method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":anon,"Content-Type":"application/json"},body:"{}"});
 const grant=await grantRes.json().catch(()=>({}));
 if(!grantRes.ok||grant.authorized!==true)return out({error:"Lab Account access required"},403);
 const db=createClient(url,svc,{auth:{persistSession:false,autoRefreshToken:false}});
 const body=await req.json().catch(()=>({}));
 const action=String(body.action||"list");
 const fields="id,title,description,document_type,mime_type,file_size,created_at,storage_bucket,storage_path";
 const intakeKeys=["lab_account_intake","lab_account_intake_standalone"];
 const ownForms=()=>db.from("standalone_form_submissions").select("id,submission_number,form_title,status,created_at,payload").in("form_key",intakeKeys).or("customer_user_id.eq."+user.id+(user.email?",submitter_email.ilike."+user.email.replace(/[%_,]/g,""):"")).order("created_at",{ascending:false}).limit(150);

 if(action==="list"){
 const d=await db.from("documents").select(fields).eq("owner_user_id",user.id).is("archived_at",null).order("created_at",{ascending:false}).limit(250);
 if(d.error)throw d.error;
 const formResult=await ownForms();if(formResult.error)throw formResult.error;
 const forms=formResult.data||[],formIds=forms.map((x:any)=>x.id);
 const attached=formIds.length?await db.from("standalone_form_submission_files").select("id,submission_id,original_file_name,document_type,mime_type,byte_size,created_at,storage_bucket,storage_path").in("submission_id",formIds).limit(250):{data:[],error:null};
 if(attached.error)throw attached.error;
 const ordinary=(d.data||[]).map((x:any)=>({id:x.id,title:x.title,description:x.description,document_type:x.document_type,source:"account",mime_type:x.mime_type,file_size:x.file_size,created_at:x.created_at,downloadable:!!(x.storage_bucket&&x.storage_path)}));
 const intakeDocs=forms.map((x:any)=>({id:x.id,title:x.form_title||"Lab Account Intake",description:"Submitted intake "+x.submission_number,document_type:"intake_form",source:"intake",mime_type:"text/html",file_size:null,created_at:x.created_at,downloadable:true}));
 const files=(attached.data||[]).map((x:any)=>({id:x.id,title:x.original_file_name||"Intake attachment",description:"Attached to Lab Account Intake",document_type:x.document_type||"intake_attachment",source:"attachment",mime_type:x.mime_type,file_size:x.byte_size,created_at:x.created_at,downloadable:!!(x.storage_bucket&&x.storage_path)}));
 return out({documents:[...ordinary,...intakeDocs,...files].sort((a:any,b:any)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())});
 }
 if(action==="intake"){
  const id=String(body.id||"");if(!/^[0-9a-f-]{36}$/i.test(id))return out({error:"Invalid intake"},400);
  const q=await ownForms();if(q.error)throw q.error;const row=(q.data||[]).find((x:any)=>x.id===id);
  if(!row)return out({error:"Intake not found"},404);
  return out({intake:{title:row.form_title||"Lab Account Intake",reference:row.submission_number,created_at:row.created_at,payload:row.payload||{}}});
 }
 if(action==="download"){
 const id=String(body.id||"");
 if(!/^[0-9a-f-]{36}$/i.test(id))return out({error:"Invalid document"},400);
 if(String(body.source||"")==="attachment"){
  const forms=await ownForms();if(forms.error)throw forms.error;
  const ids=(forms.data||[]).map((x:any)=>x.id);if(!ids.length)return out({error:"File not found"},404);
  const attached=await db.from("standalone_form_submission_files").select("storage_bucket,storage_path,original_file_name").eq("id",id).in("submission_id",ids).maybeSingle();
  if(attached.error)throw attached.error;if(!attached.data)return out({error:"File not found"},404);
  const signed=await db.storage.from(attached.data.storage_bucket).createSignedUrl(attached.data.storage_path,300,{download:body.download===true?String(attached.data.original_file_name||"Lab-Document.pdf").replace(/[\\/\r\n"<>]/g,"_"):undefined});
  if(signed.error)throw signed.error;
  return out({url:signed.data.signedUrl,title:attached.data.original_file_name||"Intake attachment"});
 }
 const q=await db.from("documents").select(fields).eq("id",id).eq("owner_user_id",user.id).is("archived_at",null).maybeSingle();
 if(q.error)throw q.error;
 if(!q.data)return out({error:"Document not found"},404);
 if(!q.data.storage_bucket||!q.data.storage_path)return out({error:"Document file unavailable"},404);
 const signed=await db.storage.from(q.data.storage_bucket).createSignedUrl(q.data.storage_path,300,{download:body.download===true?String(q.data.title||"Lab-Document.pdf").replace(/[\\/\r\n"<>]/g,"_"):undefined});
 if(signed.error)throw signed.error;
 return out({url:signed.data.signedUrl,title:q.data.title||"Document"});
 }
 return out({error:"Unsupported action"},400);
 }catch(e){console.error("lab-account-documents",e);return out({error:"Unable to retrieve documents"},500)}
});