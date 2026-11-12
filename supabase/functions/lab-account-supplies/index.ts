import {createClient} from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"https://lab-account.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const reply=(x:unknown,s=200)=>new Response(JSON.stringify(x),{headers:H,status:s});
const safe=(v:any)=>String(v??"").replace(/[&<>"']/g,(k:string)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[k]||k));
const sendRequestEmail=async(db:any,to:string,subject:string,heading:string,body:string,id:string,kind:string,admin:boolean)=>{
 const key=Deno.env.get("RESEND_API_KEY")||"";let status="not_configured",messageId:string|null=null,reason:string|null=null;
 if(key&&to){
  const url=admin?"https://testing-portal.screenings4u.com/lab-supply-requests.html":"https://lab-account.screenings4u.com/supplies.html";
  const html='<div style="padding:26px;background:#f2f6fb;font-family:Arial,sans-serif;color:#01122f"><div style="max-width:610px;margin:auto;border:1px solid #dce6ef;background:#fff;border-radius:12px;overflow:hidden"><div style="background:#01122f;padding:20px 25px"><img src="https://workforce.screenings4u.com/images/logo2.png" alt="Workforce by screenings4u" width="210"></div><div style="padding:25px"><h1 style="font-size:22px">'+safe(heading)+'</h1><p style="white-space:pre-wrap;line-height:1.65">'+safe(body)+'</p><a href="'+url+'" style="display:inline-block;background:#fdc102;color:#01122f;text-decoration:none;font-weight:bold;border-radius:8px;padding:12px 18px">View '+(admin?"Supply Management":"Your Supplies")+'</a></div></div></div>';
  try{const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from:Deno.env.get("SCREENINGS4U_FROM_EMAIL")||"Workforce <notifications@screenings4u.com>",to:[to],subject,html})});const j=await r.json().catch(()=>({}));status=r.ok?"sent":"failed";messageId=j.id||null;reason=r.ok?null:String(j.message||"HTTP "+r.status).slice(0,300)}
  catch(e){status="failed";reason=String(e).slice(0,300)}
 }
 const audit=await db.from("testing_email_events").insert({event_type:kind,related_entity_type:"supply_order",related_entity_id:id,recipient_email:to,subject,provider:"resend",provider_message_id:messageId,status,error_message:reason,sent_at:status==="sent"?new Date().toISOString():null,metadata:{source:"lab_account_supplies"}});
 if(audit.error)console.error("Supply email audit error",audit.error);
 if(status!=="sent")console.error("Supply notification",kind,status,reason||"");
 return status;
};

Deno.serve(async req=>{
if(req.method==="OPTIONS")return new Response(null,{status:204,headers:H});if(req.method!=="POST")return reply({error:"Method not allowed"},405);
try{
const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:{user},error}=await auth.auth.getUser(token);
if(error||!user?.email_confirmed_at)return reply({error:"Verified sign in required"},401);
const entitlement=await fetch(url+"/functions/v1/lab-account-entitlement",{method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":anon,"Content-Type":"application/json"},body:"{}"});
const grant=await entitlement.json().catch(()=>({}));
if(!entitlement.ok||grant.authorized!==true)return reply({error:"Lab Account access required"},403);
const db=createClient(url,svc,{auth:{persistSession:false,autoRefreshToken:false}});
const b=await req.json().catch(()=>({}));const action=String(b.action||"workspace");
const list=async()=>{
const [catalog,orders,inventory]=await Promise.all([
db.from("ic_portal_supply_items").select("id,sku,name,description,unit").eq("active",true).order("name"),
db.from("ic_portal_supply_orders").select("id,status,carrier,tracking_number,shipping_address,created_at,ic_portal_supply_order_lines(item_id,quantity)").eq("contractor_user_id",user.id).order("created_at",{ascending:false}).limit(100),
db.from("ic_portal_supply_inventory").select("item_id,quantity_on_hand,reorder_level").eq("contractor_user_id",user.id)
]);if(catalog.error||orders.error||inventory.error)throw catalog.error||orders.error||inventory.error;
// Use the portal marker and existing notification audit to distinguish Lab orders from other portals.
const candidateIds=(orders.data||[]).map((x:any)=>x.id);
const labEventIds=new Set<string>();
if(candidateIds.length){
 const provenance=await db.from("testing_email_events").select("related_entity_id").eq("related_entity_type","supply_order").eq("event_type","lab_account_supply_customer").in("related_entity_id",candidateIds).limit(500);
 if(provenance.error)throw provenance.error;
 for(const row of provenance.data||[])labEventIds.add(String(row.related_entity_id));
}
const labOrders=(orders.data||[]).filter((x:any)=>x.shipping_address?.source_portal==="lab_account"||labEventIds.has(String(x.id)));
const [owned,emailed]=await Promise.all([
 db.from("lab_account_intakes").select("id").eq("customer_user_id",user.id),
 user.email?db.from("lab_account_intakes").select("id").ilike("customer_email",user.email):Promise.resolve({data:[],error:null})
]);
if(owned.error||emailed.error)throw owned.error||emailed.error;
const ids=[...new Set([...(owned.data||[]),...(emailed.data||[])].map((x:any)=>x.id))];
let houseShipments:any[]=[];
if(ids.length){const sh=await db.from("house_lab_supply_shipments").select("id,intake_id,carrier,tracking_number,tracking_url,status,items_description,created_at,updated_at").in("intake_id",ids).order("created_at",{ascending:false}).limit(200);if(sh.error)throw sh.error;houseShipments=sh.data||[];}
return {supplies:catalog.data||[],orders:labOrders,inventory:inventory.data||[],houseShipments};
};
if(action==="workspace")return reply(await list());
if(action==="confirm_house_delivery"){
 if(grant.plan==="lab-account-workflow-test-1")return reply({error:"Test plans cannot receive physical shipments"},403);
 const shipmentId=String(b.id||"");
 if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(shipmentId))return reply({error:"Valid shipment required"},400);
 const shipment=await db.from("house_lab_supply_shipments").select("id,intake_id,status,notes").eq("id",shipmentId).maybeSingle();
 if(shipment.error)throw shipment.error;
 if(!shipment.data)return reply({error:"Shipment not found"},404);
 const purchase=await db.from("lab_account_intakes").select("id,customer_user_id,customer_email,service_sku").eq("id",shipment.data.intake_id).maybeSingle();
 if(purchase.error)throw purchase.error;
 const own=purchase.data&&(purchase.data.customer_user_id===user.id||String(purchase.data.customer_email||"").toLowerCase()===String(user.email||"").toLowerCase());
 if(!own||purchase.data.service_sku==="lab-account-workflow-test-1")return reply({error:"Shipment does not belong to your lab account"},403);
 if(shipment.data.status!=="shipped")return reply({error:"Only shipped supply orders can be confirmed received"},409);
 const now=new Date().toISOString(),oldNotes=String(shipment.data.notes||"").slice(0,3000);
 const updated=await db.from("house_lab_supply_shipments").update({
   status:"delivered",updated_at:now,
   notes:oldNotes+(oldNotes?"\n":"")+"Customer confirmed physical delivery via Lab Account portal at "+now
 }).eq("id",shipmentId).eq("intake_id",purchase.data.id).eq("status","shipped").select("id,status,updated_at").maybeSingle();
 if(updated.error)throw updated.error;
 if(!updated.data)return reply({error:"Shipment status changed before confirmation"},409);
 return reply({ok:true,shipment:updated.data});
}

if(grant.plan==="lab-account-workflow-test-1"&&["create","cancel"].includes(action))return reply({error:"The $1 workflow test does not include physical supply requests."},403);
if(action==="create"){
 const email=String(user.email||"").trim().toLowerCase();
 const verified=await db.from("lab_account_intakes").select("id,order_id,account_status,status").ilike("customer_email",email).eq("account_status","active").eq("status","completed").limit(10);
 if(verified.error)throw verified.error;
 if(!verified.data?.length)return reply({error:"Your laboratory account must finish onboarding and be activated before requesting physical testing supplies."},403);
 const org=await db.from("organizations").select("id").ilike("primary_email",email).neq("status","archived").limit(2);
 if(org.error)throw org.error;
 if(org.data?.length!==1)return reply({error:"Your C/TPA organization must be verified before ordering physical supplies."},403);
 const ctpa=await db.from("ctpas").select("id,status").eq("organization_id",org.data[0].id).maybeSingle();
 if(ctpa.error)throw ctpa.error;
 if(ctpa.data?.status!=="active")return reply({error:"Your C/TPA is still onboarding. Supply requests become available after activation."},403);
 const lines=Array.isArray(b.lines)?b.lines:[];if(!lines.length||lines.length>40)return reply({error:"Select supply quantities"},400);
const uniq=new Set<string>();for(const l of lines){if(!/^[0-9a-f-]{36}$/i.test(String(l.item_id))||!Number.isInteger(l.quantity)||l.quantity<1||l.quantity>1000||uniq.has(l.item_id))return reply({error:"Invalid supply quantities"},400);uniq.add(l.item_id)}
const active=await db.from("ic_portal_supply_items").select("id").in("id",[...uniq]).eq("active",true);if(active.error)throw active.error;if(active.data?.length!==uniq.size)return reply({error:"Supply item unavailable"},409);
const addr=b.shipping_address||{};for(const field of ["recipient","line1","city","state","postal_code"]){if(typeof addr[field]!=="string"||!addr[field].trim()||addr[field].length>180)return reply({error:"Complete the shipping address"},400)}
if(!/^[A-Za-z]{2}$/.test(addr.state)||!/^[0-9]{5}(-[0-9]{4})?$/.test(addr.postal_code)||String(b.notes||"").length>1000)return reply({error:"Invalid address or notes"},400);
const insert=await db.from("ic_portal_supply_orders").insert({contractor_user_id:user.id,status:"requested",shipping_address:{recipient:addr.recipient.trim(),line1:addr.line1.trim(),line2:String(addr.line2||"").slice(0,180),city:addr.city.trim(),state:addr.state.toUpperCase(),postal_code:addr.postal_code,source_portal:"lab_account"},notes:String(b.notes||"").trim()}).select("id").single();if(insert.error)throw insert.error;
const rows=await db.from("ic_portal_supply_order_lines").insert(lines.map((l:any)=>({order_id:insert.data.id,item_id:l.item_id,quantity:l.quantity})));if(rows.error){await db.from("ic_portal_supply_orders").delete().eq("id",insert.data.id).eq("contractor_user_id",user.id);throw rows.error}
const orderRef=String(insert.data.id).slice(0,8).toUpperCase();
 const units=lines.reduce((sum:number,item:any)=>sum+Number(item.quantity||0),0);
 const summary="Supply request "+orderRef+" for "+units+" item(s). Your order is received and is pending processing. No shipping date has been assigned.";
 const customerStatus=await sendRequestEmail(db,String(user.email||""),"Workforce | Supply request received — "+orderRef,"Supply request received",summary,insert.data.id,"lab_account_supply_customer",false);
 const staff=await db.from("staff_business_access").select("user_id").eq("business_unit_code","testing").eq("active",true).limit(30);
 if(staff.error)console.error("Supply staff recipient lookup",staff.error);
 const recipients:string[]=[];
 for(const item of staff.data||[]){const u=await db.auth.admin.getUserById(item.user_id);if(u.data?.user?.email)recipients.push(u.data.user.email.toLowerCase())}
 const setting=String(Deno.env.get("SCREENINGS4U_ADMIN_EMAIL")||Deno.env.get("SCREENINGS4U_PURCHASE_ALERT_EMAIL")||"orders@screenings4u.com").trim().toLowerCase();
 if(setting)recipients.push(setting);
 const statuses=await Promise.all([...new Set(recipients.filter(x=>x&&x!==String(user.email||"").toLowerCase()))].map(to=>sendRequestEmail(db,to,"New Lab Account supply request — "+orderRef,"New supply request for review","A customer submitted "+units+" supply item(s). Request: "+orderRef+". Open Lab Supply Management for item details and shipment processing.",insert.data.id,"lab_account_supply_admin",true)));
 return reply({ok:true,id:insert.data.id,notification_status:{customer:customerStatus,admin:statuses.length?statuses:"no_admin_recipients"}});
}
if(action==="cancel"){
const id=String(b.id||"");if(!/^[0-9a-f-]{36}$/i.test(id))return reply({error:"Invalid order"},400);
const row=await db.from("ic_portal_supply_orders").select("id,shipping_address").eq("id",id).eq("contractor_user_id",user.id).maybeSingle();
if(row.error)throw row.error;
if(!row.data)return reply({error:"Supply order not found"},404);
let isLab=row.data.shipping_address?.source_portal==="lab_account";
if(!isLab){
 const event=await db.from("testing_email_events").select("related_entity_id").eq("related_entity_type","supply_order").eq("related_entity_id",id).eq("event_type","lab_account_supply_customer").limit(1);
 if(event.error)throw event.error;
 isLab=Boolean(event.data?.length);
}
if(!isLab)return reply({error:"This order is not associated with your Lab Account"},403);
const q=await db.from("ic_portal_supply_orders").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",id).eq("contractor_user_id",user.id).eq("status","requested").select("id").maybeSingle();if(q.error)throw q.error;if(!q.data)return reply({error:"Order cannot be cancelled"},409);return reply({ok:true});
}
return reply({error:"Unsupported action"},400);
}catch(e){console.error("lab-account-supplies",e);return reply({error:"Supply operation unavailable"},500)}
});