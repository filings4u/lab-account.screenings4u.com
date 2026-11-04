import {createClient} from "npm:@supabase/supabase-js@2";
const origins=["https://lab-account.screenings4u.com","https://portal.screenings4u.com","https://filings4u.github.io"];
Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 const headers={"Access-Control-Allow-Origin":origins.includes(origin)?origin:origins[0],"Vary":"Origin","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
 const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return out({error:"Method not allowed"},405);
 try{
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!token)return out({error:"Sign in required"},401);
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await auth.auth.getUser(token);
 if(error||!user?.email_confirmed_at)return out({error:"Verified account required"},403);
 const entitlement=await fetch(url+"/functions/v1/lab-account-entitlement",{method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":anon,"Content-Type":"application/json"},body:"{}"});
 const grant=await entitlement.json().catch(()=>({}));
 if(!entitlement.ok||grant.authorized!==true)return out({error:"Lab Account access required"},403);
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const requestBody=await req.json().catch(()=>({}));
 const invoiceId=String(requestBody.invoice_id||"").trim();
 if(invoiceId&&!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(invoiceId))return out({error:"Valid invoice ID required"},400);
 const email=(user.email||"").trim().toLowerCase();
 const ownFilter="customer_user_id.eq."+user.id+(email?",customer_email.eq."+email.replace(/[^a-z0-9@._+\-]/g,""):"");
 const q=await db.from("invoices").select("id,invoice_number,status,issue_date,due_date,total,amount_paid,amount_due,currency,customer_name,notes,terms,sent_at,paid_at,created_at,customer_user_id,customer_email").or(ownFilter).neq("status","draft").not("sent_at","is",null).order("created_at",{ascending:false}).limit(500);
 if(q.error)throw q.error;
 const invoices=(q.data||[]).filter((i:any)=>i.customer_user_id===user.id|| (!!email&&String(i.customer_email||"").trim().toLowerCase()===email)).map((i:any)=>({id:i.id,invoice_number:i.invoice_number,status:i.status,issue_date:i.issue_date,due_date:i.due_date,total:i.total,amount_paid:i.amount_paid,amount_due:i.amount_due,currency:i.currency,customer_name:i.customer_name,notes:i.notes,terms:i.terms,sent_at:i.sent_at,paid_at:i.paid_at,created_at:i.created_at}));
 if(invoiceId){
   const selected=invoices.find((i:any)=>i.id===invoiceId);
   if(!selected)return out({error:"Invoice not found for this account"},404);
   const qItems=await db.from("invoice_items").select("id,description,quantity,unit_price,discount_amount,tax_amount,line_total").eq("invoice_id",selected.id).order("created_at",{ascending:true});
   if(qItems.error)throw qItems.error;
   return out({invoice:selected,items:qItems.data||[]});
 }
 return out({invoices});
 }catch(e){console.error("lab-account-billing",e);return out({error:"Unable to retrieve invoices"},500)}
});