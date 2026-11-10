import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async req=>{
 const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"https://lab-account.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers});
 try{
 const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_ANON_KEY")!,secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const bearer=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!bearer)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers});
 const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await sb.auth.getUser(bearer);
 if(error||!user)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers});
 const admin=createClient(url,secret,{auth:{persistSession:false}});
 const grant=await admin.from("testing_customer_portal_access").select("status,metadata").eq("user_id",user.id).maybeSingle();
 if(grant.error)throw grant.error;
 if(grant.data?.status==="active"&&grant.data?.metadata?.lab_account_customer_preview===true)
   return new Response(JSON.stringify({intakeSubmitted:true,status:"preview",submittedAt:null,preview:true}),{headers});
 const [a,b,c]=await Promise.all([ admin.from("lab_account_intakes").select("id,status,submitted_at").eq("customer_user_id",user.id).not("submitted_at","is",null).limit(1),
 admin.from("standalone_form_submissions").select("id,status,submitted_at").eq("form_key","lab_account_intake_standalone").eq("customer_user_id",user.id).limit(1),
 user.email?admin.from("standalone_form_submissions").select("id,status,submitted_at").eq("form_key","lab_account_intake_standalone").ilike("submitter_email",user.email).limit(1):Promise.resolve({data:[],error:null})]);
 if(a.error||b.error||c.error)throw Error("Intake lookup failed");
 const record=a.data?.[0]||b.data?.[0]||c.data?.[0]||null;return new Response(JSON.stringify({intakeSubmitted:!!record,status:record?.status||null,submittedAt:record?.submitted_at||null}),{headers});
 }catch{return new Response(JSON.stringify({error:"Intake status unavailable"}),{status:500,headers})}
});