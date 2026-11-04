import {createClient} from "npm:@supabase/supabase-js@2";
const origin="https://lab-account.screenings4u.com";
Deno.serve(async(req:Request)=>{
 const headers={"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
 const respond=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return respond({error:"Method not allowed"},405);
 try{
 const url=Deno.env.get("SUPABASE_URL")!,pub=Deno.env.get("SUPABASE_ANON_KEY")!,secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token)return respond({error:"Sign in required"},401);
 const auth=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await auth.auth.getUser(token);
 if(error||!user||!user.email_confirmed_at)return respond({error:"Verified sign-in required"},401);
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const address=user.email?.trim().toLowerCase()||"";
 const [a,b,c]=await Promise.all([
 db.from("lab_account_intakes").select("id,status,submitted_at,completed_at,intake_data,order_number,created_at").eq("customer_user_id",user.id).order("created_at",{ascending:false}).limit(10),
 db.from("standalone_form_submissions").select("id,submission_number,status,submitted_at,completed_at,payload,created_at").eq("form_key","lab_account_intake_standalone").eq("customer_user_id",user.id).order("created_at",{ascending:false}).limit(10),
 address?db.from("standalone_form_submissions").select("id,submission_number,status,submitted_at,completed_at,payload,created_at").eq("form_key","lab_account_intake_standalone").ilike("submitter_email",address).order("created_at",{ascending:false}).limit(10):Promise.resolve({data:[],error:null})
 ]);
 if(a.error||b.error||c.error)throw Error("Unable to retrieve lab account submissions");
 const rows=[...(a.data||[]).map(x=>({...x,details:x.intake_data,reference:x.order_number,source:"purchase"})),...(b.data||[]).map(x=>({...x,details:x.payload,reference:x.submission_number,source:"standalone"})),...(c.data||[]).map(x=>({...x,details:x.payload,reference:x.submission_number,source:"standalone"}))];
 const unique=[...new Map(rows.map(x=>[x.id,x])).values()].sort((x,y)=>new Date(y.submitted_at||y.created_at).getTime()-new Date(x.submitted_at||x.created_at).getTime());
 const clean=unique.map(x=>{const d=x.details&&typeof x.details==="object"?x.details:{};return {id:x.id,reference:x.reference||null,status:x.status||"received",submittedAt:x.submitted_at||x.created_at,completedAt:x.completed_at||null,businessName:String(d.legal_business_name||d.business_name||"Business information received").slice(0,180),dba:String(d.dba_name||"").slice(0,180),businessPhone:String(d.business_phone||"").slice(0,60),contactName:String([d.primary_contact_first_name,d.primary_contact_last_name].filter(Boolean).join(" ")||d.primary_contact_name||"").slice(0,180),contactEmail:String(d.primary_contact_email||"").slice(0,180),city:String(d.physical_city||"").slice(0,120),state:String(d.physical_state||"").slice(0,30),source:x.source}});
 const membership=await db.from("organization_memberships").select("organization_id").eq("user_id",user.id).eq("status","active");
 if(membership.error)throw membership.error;
 const ownership=address?await db.from("organizations").select("id").ilike("primary_email",address):{data:[],error:null};
 if(ownership.error)throw ownership.error;
 const ids=[...new Set([...(membership.data||[]).map(x=>x.organization_id),...(ownership.data||[]).map(x=>x.id)].filter(Boolean))];
 let provisionedAccounts:any[]=[];
 if(ids.length){
   const c=await db.from("ctpas").select("id").in("organization_id",ids);
   if(c.error)throw c.error;
   const ctpaIds=(c.data||[]).map(x=>x.id);
   if(ctpaIds.length){
     const acc=await db.from("ctpa_lab_accounts").select("id,ctpa_id,lab_name,account_code,is_primary,status,config,updated_at").in("ctpa_id",ctpaIds).order("created_at",{ascending:false});
     if(acc.error)throw acc.error;
     provisionedAccounts=(acc.data||[]).map((x:any)=>({id:x.id,lab_name:x.lab_name,account_code:x.account_code,is_primary:x.is_primary,status:x.status,account_type:x.config?.account_type||"dot",updated_at:x.updated_at}));
   }
 }
 return respond({submissions:clean,provisionedAccounts,provisioningConnected:ids.length>0});
 }catch(e){console.error("lab-account overview",e);return respond({error:"Unable to load your lab account details"},500)}
});