import {createClient} from "npm:@supabase/supabase-js@2";
const ORIGIN="https://lab-account.screenings4u.com";
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const send=(body:unknown,status=200)=>new Response(JSON.stringify(body),{headers:cors,status});
const SKUS=["lab-account","lab-account-random-consortium","lab-account-random-consortium-docs"];
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return send({error:"Method not allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")!,pub=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return send({error:"Sign in required"},401);
  const auth=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await auth.auth.getUser(token);
  if(error||!user||!user.email_confirmed_at)return send({error:"Verified sign in required"},401);
  const verified=await fetch(url+"/functions/v1/lab-account-entitlement",{method:"POST",headers:{authorization:"Bearer "+token,apikey:pub,"Content-Type":"application/json"},body:"{}"});
  const ent=await verified.json().catch(()=>({}));
  if(!verified.ok||ent.authorized!==true)return send({error:"Lab Account access required"},403);
  if(ent.preview===true)return send({error:"Preview-only Lab Accounts cannot request commercial upgrades"},403);
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const payload=await req.json().catch(()=>({}));
  const action=String(payload.action||"catalog");
  const plan=SKUS.includes(ent.plan)?ent.plan:null;
  if(!plan)return send({error:"A paid commercial Lab Account plan is required for upgrades",plan_type:"workflow_test"},403);
  const [f,p,o,u]=await Promise.all([
   db.from("lab_portal_feature_catalog").select("feature_code,title,description,category,delivery_status,display_order").order("display_order"),
   db.from("lab_portal_plan_features").select("plan_sku,feature_code"),
   db.from("lab_portal_store_offers").select("offer_code,title,description,category,price_cents,currency,billing_interval,stripe_price_id,state,feature_code,display_order").neq("state","archived").order("display_order"),
   db.from("lab_portal_upgrade_paths").select("current_plan_sku,target_plan_sku,offer_title,one_time_price_cents,recurring_price_cents,status").eq("current_plan_sku",plan)
  ]);
  for(const q of [f,p,o,u])if(q.error)throw q.error;
  const included=new Set((p.data||[]).filter(x=>x.plan_sku===plan).map(x=>x.feature_code));
  const safeOffers=(o.data||[]).map(x=>({offer_code:x.offer_code,title:x.title,description:x.description,category:x.category,price_cents:x.price_cents,currency:x.currency,billing_interval:x.billing_interval,state:x.state,feature_code:x.feature_code,ready:x.state==="live"&&!!x.stripe_price_id}));
  const upgrades=(u.data||[]).map(x=>({...x,ready:x.status==="live"}));
  const features=(f.data||[]).map(x=>({...x,included:included.has(x.feature_code),available:included.has(x.feature_code)&&x.delivery_status==="available"}));
  if(action==="catalog"){
   const own=await db.from("lab_portal_upgrade_requests").select("id,current_plan_sku,target_plan_sku,status,created_at").eq("user_id",user.id).in("status",["requested","quoted","checkout_pending"]).order("created_at",{ascending:false}).limit(25);
   if(own.error)throw own.error;
   return send({plan_sku:plan,plan_names:{"lab-account":"Lab Account","lab-account-random-consortium":"Lab Account + Consortium","lab-account-random-consortium-docs":"Lab Account + Consortium + Docs"},plan_feature_codes:Object.fromEntries(SKUS.map(sku=>[sku,(p.data||[]).filter(x=>x.plan_sku===sku).map(x=>x.feature_code)])),features,offers:safeOffers,upgrades,requests:own.data||[],commercial_checkout_enabled:upgrades.some(x=>x.ready)||safeOffers.some(x=>x.ready)});
  }
  if(action==="request_upgrade"){
   const target=String(payload.target_plan_sku||"");
   if(!SKUS.includes(target)||SKUS.indexOf(target)<=SKUS.indexOf(plan))return send({error:"Select a higher eligible plan"},400);
   const path=upgrades.find(x=>x.target_plan_sku===target);
   if(!path)return send({error:"Upgrade path is unavailable"},400);
   const pending=await db.from("lab_portal_upgrade_requests").select("id,status").eq("user_id",user.id).eq("target_plan_sku",target).in("status",["requested","quoted","checkout_pending"]).limit(1);
   if(pending.error)throw pending.error;
   if(pending.data?.length)return send({ok:true,already_requested:true,status:pending.data[0].status});
   const insert=await db.from("lab_portal_upgrade_requests").insert({user_id:user.id,current_plan_sku:plan,target_plan_sku:target,status:"requested"}).select("id,status").single();
   if(insert.error)throw insert.error;
   return send({ok:true,status:insert.data.status});
  }
  return send({error:"Unsupported action"},400);
 }catch(e){console.error("lab-portal-store",e);return send({error:"Unable to load the Lab Account store"},500)}
});
