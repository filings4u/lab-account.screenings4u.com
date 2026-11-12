import {createClient} from "npm:@supabase/supabase-js@2";
import {PDFDocument,StandardFonts,rgb} from "npm:pdf-lib@1.17.1";
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
 const imageToPdf=async(bucket:string,path:string,mime:string,filename:string)=>{
  const downloaded=await db.storage.from(bucket).download(path);
  if(downloaded.error||!downloaded.data)throw downloaded.error||Error("Unable to access the authorized image");
  const data=new Uint8Array(await downloaded.data.arrayBuffer());
  if(!data.length||data.byteLength>15_000_000)throw Error("This image is too large to convert");
  const pdf=await PDFDocument.create();
  const img=mime==="image/jpeg"?await pdf.embedJpg(data):await pdf.embedPng(data);
  const width=612,height=792,scale=Math.min((width-64)/img.width,(height-64)/img.height);
  const page=pdf.addPage([width,height]);page.drawImage(img,{x:(width-img.width*scale)/2,y:(height-img.height*scale)/2,width:img.width*scale,height:img.height*scale});
  const bytes=await pdf.save(),chunks:string[]=[];
  for(let i=0;i<bytes.length;i+=32768)chunks.push(String.fromCharCode(...bytes.slice(i,i+32768)));
  return out({pdf_base64:btoa(chunks.join("")),filename:filename.replace(/\.[^.]+$/,"")+".pdf",mime_type:"application/pdf"});
 };
 const fields="id,title,description,document_type,mime_type,file_size,created_at,storage_bucket,storage_path";
 const allowedTypes=["lab_account","lab_account_notice","lab_account_setup","lab_account_document","lab_account_compliance","lab_account_guide","lab_account_howto"];
 const issued=()=>db.from("lab_customer_published_documents").select("id,title,description,category,mime_type,file_size,created_at,original_filename").eq("customer_user_id",user.id).eq("is_published",true).is("archived_at",null).order("created_at",{ascending:false}).limit(250);
 const intakeKeys=["lab_account_intake","lab_account_intake_standalone"];
 const ownForms=()=>db.from("standalone_form_submissions").select("id,submission_number,form_title,status,created_at,payload").in("form_key",intakeKeys).or("customer_user_id.eq."+user.id+(user.email?",submitter_email.ilike."+user.email.replace(/[%_,]/g,""):"")).order("created_at",{ascending:false}).limit(150);

 if(action==="list"){
 const [d,published,completed]=await Promise.all([
 db.from("documents").select(fields).eq("owner_user_id",user.id).in("document_type",allowedTypes).is("archived_at",null).order("created_at",{ascending:false}).limit(250),
 issued(),
 db.from("lab_plan_service_requests").select("id,title,feature_code,document_name,document_bucket,document_path,fulfilled_at,created_at").eq("customer_user_id",user.id).eq("status","completed").not("document_path","is",null).order("created_at",{ascending:false}).limit(150)
 ]);
 if(published.error||completed.error)throw published.error||completed.error;
 if(d.error)throw d.error;
 const formResult=await ownForms();if(formResult.error)throw formResult.error;
 const forms=formResult.data||[],formIds=forms.map((x:any)=>x.id);
 const attached=formIds.length?await db.from("standalone_form_submission_files").select("id,submission_id,original_file_name,document_type,mime_type,byte_size,created_at,storage_bucket,storage_path").in("submission_id",formIds).limit(250):{data:[],error:null};
 if(attached.error)throw attached.error;
 const serviceDocs=(completed.data||[]).filter((x:any)=>x.document_bucket==="testing-private-documents"&&String(x.document_path||"").startsWith("lab-plan-services/"+user.id+"/"+x.id+"/")).map((x:any)=>({id:x.id,title:x.title||"Completed service document",description:"Issued by Workforce testing operations",document_type:x.feature_code||"lab_account_document",source:"service",mime_type:"application/pdf",file_size:null,created_at:x.fulfilled_at||x.created_at,downloadable:true}));
 const staffDocs=(published.data||[]).map((x:any)=>({id:x.id,title:x.title,description:x.description,document_type:x.category==="how_to"?"how_to_guide":x.category==="account"?"account_document":x.category==="supplies"?"supply_guide":"compliance_document",category:x.category,source:"published",mime_type:x.mime_type,file_size:x.file_size,created_at:x.created_at,downloadable:true}));
 const ordinary=(d.data||[]).map((x:any)=>({id:x.id,title:x.title,description:x.description,document_type:x.document_type,source:"account",mime_type:x.mime_type,file_size:x.file_size,created_at:x.created_at,downloadable:!!(x.storage_bucket&&x.storage_path)}));
 const intakeDocs=forms.map((x:any)=>({id:x.id,title:x.form_title||"Lab Account Intake",description:"Submitted intake "+x.submission_number,document_type:"intake_form",source:"intake",mime_type:"application/pdf",file_size:null,created_at:x.created_at,downloadable:true}));
 const files=(attached.data||[]).map((x:any)=>({id:x.id,title:x.original_file_name||"Intake attachment",description:"Attached to Lab Account Intake",document_type:x.document_type||"intake_attachment",source:"attachment",mime_type:x.mime_type,file_size:x.byte_size,created_at:x.created_at,downloadable:!!(x.storage_bucket&&x.storage_path)}));
 return out({documents:[...staffDocs,...serviceDocs,...ordinary,...intakeDocs,...files].sort((a:any,b:any)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())});
 }
 if(action==="intake"){
  const id=String(body.id||"");if(!/^[0-9a-f-]{36}$/i.test(id))return out({error:"Invalid intake"},400);
  const q=await ownForms();if(q.error)throw q.error;const row=(q.data||[]).find((x:any)=>x.id===id);
  if(!row)return out({error:"Intake not found"},404);
  if(body.download===true){
   const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
   pdf.setTitle("Workforce Lab Account Intake");pdf.setAuthor("Workforce");
   let page=pdf.addPage([612,792]),y=740;
   const nextPage=()=>{page=pdf.addPage([612,792]);y=740};
   const write=(txt:string,size=11,strong=false)=>{
    const clean=String(txt||"").replace(/[^\x20-\x7E]/g," ").slice(0,20000);
    const f=strong?bold:font;let line="";
    for(const word of clean.split(/\s+/)){
     const candidate=line?line+" "+word:word;
     if(f.widthOfTextAtSize(candidate,size)>510&&line){
      if(y<60)nextPage();page.drawText(line,{x:48,y,size,font:f,color:rgb(.06,.14,.27)});y-=size+7;line=word;
     }else line=candidate;
    }
    if(line){if(y<60)nextPage();page.drawText(line,{x:48,y,size,font:f,color:rgb(.06,.14,.27)});y-=size+7}
   };
   write("WORKFORCE | LAB ACCOUNT",12,true);
   y-=8;write(row.form_title||"Lab Account Intake",19,true);
   y-=10;write("Submission: "+(row.submission_number||"Not assigned"));
   write("Submitted: "+new Date(row.created_at).toLocaleDateString("en-US"));
   y-=14;
   const source=row.payload&&typeof row.payload==="object"&&!Array.isArray(row.payload)?row.payload:{};
   for(const [field,value] of Object.entries(source)){
    if(/(?:captcha|turnstile|token|password|credential|secret|api[_-]?key|authorization|form_started_at)/i.test(field))continue;
    if(y<70)nextPage();write(String(field).replace(/[_-]/g," ").toUpperCase(),10,true);
    const valueText=typeof value==="string"?value:JSON.stringify(value);
    write(String(valueText??"").slice(0,3000),10);
    y-=8;
   }
   const bytes=await pdf.save(),parts:string[]=[];
   for(let i=0;i<bytes.length;i+=0x8000)parts.push(String.fromCharCode(...bytes.slice(i,i+0x8000)));
   return out({pdf_base64:btoa(parts.join("")),filename:"Workforce-Lab-Account-Intake.pdf"});
  }
  return out({intake:{title:row.form_title||"Lab Account Intake",reference:row.submission_number,created_at:row.created_at,payload:row.payload||{}}});
 }
 if(action==="service"){
  const id=String(body.id||"");
  if(!/^[0-9a-f-]{36}$/i.test(id))return out({error:"Invalid service document"},400);
  const record=await db.from("lab_plan_service_requests").select("id,title,status,document_bucket,document_path,document_name").eq("id",id).eq("customer_user_id",user.id).eq("status","completed").maybeSingle();
  if(record.error)throw record.error;
  if(!record.data||record.data.document_bucket!=="testing-private-documents"||!record.data.document_path?.startsWith("lab-plan-services/"+user.id+"/"+id+"/"))return out({error:"Completed document not available for this account"},404);
  const signed=await db.storage.from("testing-private-documents").createSignedUrl(record.data.document_path,120,{download:body.download===true?record.data.document_name||"Workforce-Service-Document.pdf":undefined});
  if(signed.error)throw signed.error;
  return out({url:signed.data.signedUrl,title:record.data.title||"Completed document",mime_type:"application/pdf"});
 }
 if(action==="published"){
  const id=String(body.id||"");
  if(!/^[0-9a-f-]{36}$/i.test(id))return out({error:"Invalid document"},400);
  const record=await db.from("lab_customer_published_documents").select("id,title,storage_bucket,storage_path,original_filename").eq("id",id).eq("customer_user_id",user.id).eq("is_published",true).is("archived_at",null).maybeSingle();
  if(record.error)throw record.error;
  if(!record.data)return out({error:"Document not found for this account"},404);
  const signed=await db.storage.from("testing-private-documents").createSignedUrl(record.data.storage_path,120,{download:body.download===true?record.data.original_filename:undefined});
  if(signed.error)throw signed.error;
  return out({url:signed.data.signedUrl,title:record.data.title,mime_type:"application/pdf"});
 }
 if(action==="download"){
 const id=String(body.id||"");
 if(!/^[0-9a-f-]{36}$/i.test(id))return out({error:"Invalid document"},400);
 if(String(body.source||"")==="attachment"){
  const forms=await ownForms();if(forms.error)throw forms.error;
  const ids=(forms.data||[]).map((x:any)=>x.id);if(!ids.length)return out({error:"File not found"},404);
  const attached=await db.from("standalone_form_submission_files").select("storage_bucket,storage_path,original_file_name,mime_type").eq("id",id).in("submission_id",ids).maybeSingle();
  if(attached.error)throw attached.error;if(!attached.data)return out({error:"File not found"},404);
  if(body.download===true&&["image/jpeg","image/png"].includes(attached.data.mime_type))return await imageToPdf(attached.data.storage_bucket,attached.data.storage_path,attached.data.mime_type,attached.data.original_file_name||"Lab-Account-Image");
  const signed=await db.storage.from(attached.data.storage_bucket).createSignedUrl(attached.data.storage_path,300,{download:body.download===true?String(attached.data.original_file_name||"Lab-Document.pdf").replace(/[\\/\r\n"<>]/g,"_"):undefined});
  if(signed.error)throw signed.error;
  return out({url:signed.data.signedUrl,title:attached.data.original_file_name||"Intake attachment"});
 }
 const q=await db.from("documents").select(fields).eq("id",id).eq("owner_user_id",user.id).is("archived_at",null).maybeSingle();
 if(q.error)throw q.error;
 if(!q.data)return out({error:"Document not found"},404);
 if(!q.data.storage_bucket||!q.data.storage_path)return out({error:"Document file unavailable"},404);
 if(body.download===true&&["image/jpeg","image/png"].includes(q.data.mime_type))return await imageToPdf(q.data.storage_bucket,q.data.storage_path,q.data.mime_type,q.data.title||"Lab-Document");
 const signed=await db.storage.from(q.data.storage_bucket).createSignedUrl(q.data.storage_path,300,{download:body.download===true?String(q.data.title||"Lab-Document.pdf").replace(/[\\/\r\n"<>]/g,"_"):undefined});
 if(signed.error)throw signed.error;
 return out({url:signed.data.signedUrl,title:q.data.title||"Document"});
 }
 return out({error:"Unsupported action"},400);
 }catch(e){console.error("lab-account-documents",e);return out({error:"Unable to retrieve documents"},500)}
});