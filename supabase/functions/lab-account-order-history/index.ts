import {createClient} from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"https://lab-account.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:H});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:H});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
 const url=Deno.env.get("SUPABASE_URL")!,pub=Deno.env.get("SUPABASE_ANON_KEY")!,svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!token)return reply({error:"Sign in required"},401);
 const auth=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await auth.auth.getUser(token);
 if(error||!user?.email_confirmed_at)return reply({error:"Verified sign in required"},403);
 const ent=await fetch(url+"/functions/v1/lab-account-entitlement",{method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":pub,"Content-Type":"application/json"},body:"{}"});
 const grant=await ent.json().catch(()=>({}));
 if(!ent.ok||grant.authorized!==true)return reply({error:"Lab Account access required"},403);
 const db=createClient(url,svc,{auth:{persistSession:false,autoRefreshToken:false}});
 const email=String(user.email||"").trim().toLowerCase();
 const filter="user_id.eq."+user.id+(email?",customer_email.eq."+email.replace(/[^a-z0-9@._+\-]/g,""):"");
 const rows=await db.from("orders").select("id,order_number,user_id,customer_email,company_name,status,payment_status,total,currency,created_at,paid_at,fulfilled_at,fulfillment_status,tracking_number,order_items(quantity,unit_price,line_total,metadata,services(name,sku))").or(filter).order("created_at",{ascending:false}).limit(200);
 if(rows.error)throw rows.error;
 const labSkus=new Set(["lab-account","lab-account-random-consortium","lab-account-random-consortium-docs","lab-account-workflow-test-1","lab-upgrade-consortium","lab-upgrade-consortium-docs","lab-upgrade-docs"]);
 const own=(rows.data||[]).filter((x:any)=>x.user_id===user.id||String(x.customer_email||"").trim().toLowerCase()===email);
 const intake=await db.from("lab_account_intakes").select("order_id,service_sku").or("customer_user_id.eq."+user.id+(email?",customer_email.eq."+email.replace(/[^a-z0-9@._+\\-]/g,""):"")).limit(100);
 if(intake.error)throw intake.error;
 const intakeSkus=new Map((intake.data||[]).filter((i:any)=>labSkus.has(String(i.service_sku||"").toLowerCase())).map((i:any)=>[i.order_id,i.service_sku]));
 const orders=own.map((x:any)=>{
   const items=(x.order_items||[]).map((i:any)=>({name:i.services?.name||i.metadata?.service_name||"Service",sku:String(i.services?.sku||i.metadata?.service_sku||"").toLowerCase(),quantity:i.quantity,unit_price:i.unit_price,line_total:i.line_total}));
   let selected=items.filter((i:any)=>labSkus.has(i.sku));
   if(!selected.length&&intakeSkus.has(x.id)&&items.length===1&&items[0].sku==="")selected=[{...items[0],sku:intakeSkus.get(x.id)}];
   if(!selected.length)return null;
   const scopedTotal=selected.reduce((total:number,i:any)=>total+Number(i.line_total??Number(i.unit_price||0)*Number(i.quantity||1)),0);
   return {id:x.id,order_number:x.order_number,company_name:x.company_name,status:x.status,payment_status:x.payment_status,total:scopedTotal,currency:x.currency,created_at:x.created_at,paid_at:x.paid_at,fulfilled_at:x.fulfilled_at,fulfillment_status:x.fulfillment_status,tracking_number:x.tracking_number,items:selected};
 }).filter(Boolean);
 return reply({orders});
 }catch(e){console.error("lab-account-order-history",e);return reply({error:"Unable to load order history"},500)}
});