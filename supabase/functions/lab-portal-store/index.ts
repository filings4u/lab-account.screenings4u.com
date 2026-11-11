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
   db.from("lab_portal_upgrade_paths").select("current_plan_sku,target_plan_sku,offer_title,checkout_service_sku,checkout_enabled,status").eq("current_plan_sku",plan)
  ]);
  for(const q of [f,p,o,u])if(q.error)throw q.error;
  const subscription=await db.from("lab_consortium_subscriptions").select("status,last_invoice_paid_at,stripe_subscription_id").eq("user_id",user.id).maybeSingle();
  if(subscription.error)throw subscription.error;
  const addonActive=plan==="lab-account"&&subscription.data?.status==="active"&&!!subscription.data?.last_invoice_paid_at;
  const memberships=await db.from("organization_memberships").select("organization_id").eq("user_id",user.id).eq("status","active").limit(100);
  if(memberships.error)throw memberships.error;
  let otherConsortium=false;
  if(memberships.data?.length){
   const existing=await db.from("subscriptions").select("id,status").in("organization_id",memberships.data.map((x:any)=>x.organization_id)).in("status",["active","trialing"]).limit(1);
   if(existing.error)throw existing.error;
   otherConsortium=Boolean(existing.data?.length);
  }
  const included=new Set((p.data||[]).filter(x=>x.plan_sku===plan).map(x=>x.feature_code));
  if(addonActive)for(const x of (p.data||[]).filter(x=>x.plan_sku==="lab-account-random-consortium"))included.add(x.feature_code);
  const safeOffers=(o.data||[]).filter(x=>(plan==="lab-account"||x.offer_code!=="consortium_125")).map(x=>({offer_code:x.offer_code,title:x.title,description:x.description,category:x.category,price_cents:x.price_cents,currency:x.currency,billing_interval:x.billing_interval,state:x.state,feature_code:x.feature_code,ready:x.offer_code==="consortium_125"?plan==="lab-account"&&!addonActive&&!otherConsortium:x.state==="live"&&!!x.stripe_price_id}));
  const codes=(u.data||[]).map(x=>x.checkout_service_sku).filter(Boolean);
  const prod=codes.length?await db.from("services").select("id,sku").in("sku",codes).eq("active",true):{data:[],error:null};
  if(prod.error)throw prod.error;
  const ids=(prod.data||[]).map(x=>x.id);
  const price=ids.length?await db.from("service_prices").select("service_id,amount,currency,billing_interval,effective_from,effective_to").in("service_id",ids).eq("active",true).lte("effective_from",new Date().toISOString()).order("effective_from",{ascending:false}):{data:[],error:null};
  if(price.error)throw price.error;
  const moneyBySku=new Map((prod.data||[]).map(x=>{const p=(price.data||[]).find(z=>z.service_id===x.id&&(!z.effective_to||new Date(z.effective_to)>new Date()));return [x.sku,p?Math.round(Number(p.amount)*100):null]}));
  const upgrades=(u.data||[]).map(x=>({current_plan_sku:x.current_plan_sku,target_plan_sku:x.target_plan_sku,offer_title:x.offer_title,price_cents:moneyBySku.get(x.checkout_service_sku)||null,ready:x.checkout_enabled===true&&!!moneyBySku.get(x.checkout_service_sku)}));
  const features=(f.data||[]).map(x=>({...x,included:included.has(x.feature_code),available:included.has(x.feature_code)&&x.delivery_status==="available"}));
  if(action==="catalog"){
   const own=await db.from("lab_portal_upgrade_requests").select("id,current_plan_sku,target_plan_sku,status,created_at").eq("user_id",user.id).in("status",["checkout_pending"]).order("created_at",{ascending:false}).limit(25);
   if(own.error)throw own.error;
   return send({plan_sku:plan,plan_names:{"lab-account":"Lab Account","lab-account-random-consortium":"Lab Account + Consortium","lab-account-random-consortium-docs":"Lab Account + Consortium + Docs"},plan_feature_codes:Object.fromEntries(SKUS.map(sku=>[sku,(p.data||[]).filter(x=>x.plan_sku===sku).map(x=>x.feature_code)])),features,offers:safeOffers,consortium_subscription:{active:addonActive,status:subscription.data?.status||"none",already_covered:otherConsortium||plan!=="lab-account"},upgrades,requests:own.data||[],commercial_checkout_enabled:upgrades.some(x=>x.ready)||safeOffers.some(x=>x.ready)});
  }
  if(action==="begin_addon"){
   if(String(payload.offer_code||"")!=="consortium_125")return send({error:"Unsupported add-on"},400);
   if(plan!=="lab-account"||addonActive||otherConsortium)return send({error:"Consortium access is already included or currently active for this account."},409);
   if(subscription.data?.stripe_subscription_id && !["canceled","incomplete_expired"].includes(subscription.data.status))return send({error:"A consortium subscription already exists. Manage the existing subscription before purchasing again."},409);
   const offer=(o.data||[]).find(x=>x.offer_code==="consortium_125");
   if(!offer||offer.price_cents!==12500||offer.billing_interval!=="month")return send({error:"Consortium offer configuration is incomplete"},409);
   const raw=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v=>v.toString(16).padStart(2,"0")).join("");
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)))).map(v=>v.toString(16).padStart(2,"0")).join("");
   const expires=new Date(Date.now()+30*60*1000).toISOString();
   const up=await db.from("lab_consortium_subscriptions").upsert({user_id:user.id,status:"checkout_pending",checkout_token_hash:hash,checkout_expires_at:expires,updated_at:new Date().toISOString()},{onConflict:"user_id"});
   if(up.error)throw up.error;
   return send({checkout_url:"https://screenings4u.com/checkout.html?lab_addon=consortium_125&addon_token="+encodeURIComponent(raw),status:"checkout_pending"});
  }
  if(action==="begin_checkout"){
   const target=String(payload.target_plan_sku||"");
   if(!SKUS.includes(target)||SKUS.indexOf(target)<=SKUS.indexOf(plan))return send({error:"Select a higher eligible plan"},400);
   const path=(u.data||[]).find(x=>x.target_plan_sku===target&&x.current_plan_sku===plan);
   if(!path?.checkout_enabled||!path.checkout_service_sku||!moneyBySku.get(path.checkout_service_sku))return send({error:"This plan upgrade is not yet available for checkout"},409);
   const completed=await db.from("lab_portal_upgrade_requests").select("id").eq("user_id",user.id).eq("target_plan_sku",target).eq("status","completed").limit(1);
   if(completed.error)throw completed.error;
   if(completed.data?.length)return send({error:"This upgrade is already purchased"},409);
   const pending=await db.from("lab_portal_upgrade_requests").select("id,order_id,checkout_expires_at").eq("user_id",user.id).eq("target_plan_sku",target).eq("status","checkout_pending").order("created_at",{ascending:false}).limit(1);
   if(pending.error)throw pending.error;
   if(pending.data?.[0]?.order_id)return send({error:"Payment for this upgrade has already started. Check the receipt or payment status before trying again."},409);
   const random=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v=>v.toString(16).padStart(2,"0")).join("");
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(random)))).map(v=>v.toString(16).padStart(2,"0")).join("");
   const expiry=new Date(Date.now()+30*60*1000).toISOString();
   let write:any;
   if(pending.data?.length){
    write=await db.from("lab_portal_upgrade_requests").update({current_plan_sku:plan,checkout_token_hash:hash,checkout_expires_at:expiry,updated_at:new Date().toISOString()}).eq("id",pending.data[0].id).eq("status","checkout_pending").is("order_id",null);
   }else{
    write=await db.from("lab_portal_upgrade_requests").insert({user_id:user.id,current_plan_sku:plan,target_plan_sku:target,status:"checkout_pending",checkout_token_hash:hash,checkout_expires_at:expiry});
   }
   if(write.error)throw write.error;
   const url=new URL("https://screenings4u.com/checkout.html");
   url.searchParams.set("service",path.checkout_service_sku);
   url.searchParams.set("upgrade_token",random);
   return send({ok:true,checkout_url:url.toString(),price_cents:moneyBySku.get(path.checkout_service_sku),status:"checkout_pending"});
  }
  return send({error:"Unsupported action"},400);
 }catch(e){console.error("lab-portal-store",e);return send({error:"Unable to load the Lab Account store"},500)}
});
