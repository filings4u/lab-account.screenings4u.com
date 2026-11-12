import {createClient} from "npm:@supabase/supabase-js@2";
const allowed=["https://lab-account.screenings4u.com","https://portal.screenings4u.com","https://filings4u.github.io"];
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin")||"";
 const headers={"Access-Control-Allow-Origin":allowed.includes(origin)?origin:"https://lab-account.screenings4u.com","Vary":"Origin","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
 const output=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return output({error:"Method not allowed"},405);
 try{
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!token)return output({error:"Sign in required"},401);
 const url=Deno.env.get("SUPABASE_URL")||"",pub=Deno.env.get("SUPABASE_ANON_KEY")||"",key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!url||!pub||!key)return output({error:"Service configuration unavailable"},503);
 const auth=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(token);
 if(authError||!user||!user.email_confirmed_at)return output({error:"Verified account required"},403);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const featureCodesFor=async(plan:string,addon=false)=>{
  const skus=[plan];
  if(addon&&plan==="lab-account")skus.push("lab-account-random-consortium");
  const links=await db.from("lab_portal_plan_features").select("feature_code").in("plan_sku",skus);
  if(links.error)throw links.error;
  const found=[...new Set((links.data||[]).map((r:any)=>r.feature_code))];
  if(!found.length)return [];
  const catalog=await db.from("lab_portal_feature_catalog").select("feature_code,delivery_status").in("feature_code",found);
  if(catalog.error)throw catalog.error;
  return (catalog.data||[]).filter((r:any)=>r.delivery_status==="available").map((r:any)=>r.feature_code);
 };
 const grant=await db.from("testing_customer_portal_access").select("status,metadata").eq("user_id",user.id).maybeSingle();
 if(grant.error)throw grant.error;
 // Explicit, customer-scoped evaluation grant. Not a paid purchase and never a staff role.
 // Only the named user with active customer access receives feature testing.
 if(user.id==="fc427ef7-16fa-4e36-a1ba-4e760035b32f"&&grant.data?.status==="active"&&grant.data?.metadata?.lab_account_customer_test_access===true)
   return output({authorized:true,plan:"lab-account-random-consortium-docs",features:{lab_account:true,workflow_test:false,consortium:true,consortium_addon_active:false,compliance_docs:true},feature_codes:await featureCodesFor("lab-account-random-consortium-docs"),preview:false,customer_test_access:true,order_history:[]});
 if(grant.data?.status==="active"&&grant.data?.metadata?.lab_account_customer_preview===true)
   return output({authorized:true,plan:"lab-account",features:{lab_account:true,workflow_test:true,consortium:false,compliance_docs:false},feature_codes:[],preview:true,order_history:[]});
 const q=await db.from("orders").select("id,order_number,paid_at,payment_status,user_id,customer_email").or("user_id.eq."+user.id+",customer_email.eq."+user.email!.toLowerCase()).order("created_at",{ascending:false}).limit(100);
 if(q.error)throw q.error;
 const paid=(q.data||[]).filter(x=>x.paid_at!==null||["paid","succeeded"].includes(String(x.payment_status||"").toLowerCase()));
 if(!paid.length)return output({authorized:false,plan:null});
 const items=await db.from("order_items").select("order_id,service_id").in("order_id",paid.map(x=>x.id));
 if(items.error)throw items.error;
 const ids=[...new Set((items.data||[]).map(x=>x.service_id).filter(Boolean))];
 if(!ids.length)return output({authorized:false,plan:null});
 const services=await db.from("services").select("id,sku,slug").in("id",ids);
 if(services.error)throw services.error;
 const sku=new Map((services.data||[]).map(x=>[x.id,String(x.sku||x.slug||"").toLowerCase().replaceAll("_","-")]));
 const tiers=["lab-account-workflow-test-1","lab-account","lab-account-random-consortium","lab-account-random-consortium-docs"];
 const matches=(items.data||[]).filter(x=>sku.has(x.service_id)&&tiers.includes(sku.get(x.service_id)!)).map(x=>sku.get(x.service_id)!);
 if(!matches.length)return output({authorized:false,plan:null});
 const paidPlan=tiers.slice().reverse().find(x=>matches.includes(x))!;
 const upgrades=await db.from("lab_portal_upgrade_requests").select("target_plan_sku,order_id").eq("user_id",user.id).eq("status","completed");
 if(upgrades.error)throw upgrades.error;
 const verifiedOrderIds=(upgrades.data||[]).map((x:any)=>x.order_id).filter(Boolean);
 let verifiedUpgrades:any[]=[];
 if(verifiedOrderIds.length){
  const uq=await db.from("orders").select("id,payment_status,paid_at,user_id").in("id",verifiedOrderIds).eq("user_id",user.id);
  if(uq.error)throw uq.error;
  const actuallyPaid=new Set((uq.data||[]).filter((x:any)=>x.paid_at&&["paid","succeeded"].includes(String(x.payment_status).toLowerCase())).map((x:any)=>x.id));
  verifiedUpgrades=(upgrades.data||[]).filter((x:any)=>actuallyPaid.has(x.order_id)&&tiers.includes(x.target_plan_sku));
 }
 const plan=tiers.slice().reverse().find(x=>x===paidPlan||verifiedUpgrades.some((y:any)=>y.target_plan_sku===x))!;
 const addon=await db.from("lab_consortium_subscriptions").select("status,last_invoice_paid_at,current_period_end").eq("user_id",user.id).maybeSingle();
 if(addon.error)throw addon.error;
 const consortiumAddonActive=plan==="lab-account"&&addon.data?.status==="active"&&!!addon.data.last_invoice_paid_at&&(!addon.data.current_period_end||Date.parse(addon.data.current_period_end)>Date.now());
 const labOrderIds=new Set((items.data||[]).filter(x=>tiers.includes(sku.get(x.service_id)!)).map(x=>x.order_id));
 const orderHistory=paid.filter(o=>labOrderIds.has(o.id)).map(o=>({order_number:o.order_number,paid_at:o.paid_at,payment_status:o.payment_status})); 
 return output({authorized:true,plan,features:{lab_account:plan!=="lab-account-workflow-test-1",workflow_test:plan==="lab-account-workflow-test-1",consortium:consortiumAddonActive||["lab-account-random-consortium","lab-account-random-consortium-docs"].includes(plan),consortium_addon_active:consortiumAddonActive,compliance_docs:plan==="lab-account-random-consortium-docs"},feature_codes:await featureCodesFor(plan,consortiumAddonActive),subscription_status:addon.data?.status||"none",order_history:orderHistory});
 }catch(e){console.error("lab account access check",e);return output({error:"Unable to verify account access"},500)}
});