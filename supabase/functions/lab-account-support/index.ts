import {createClient} from "npm:@supabase/supabase-js@2";
const H={"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"https://lab-account.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
const reply=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
const customerAcknowledgment=async(email:string,reference:string)=>{
 const key=Deno.env.get("RESEND_API_KEY")||"";if(!key||!email)return "not_configured";
 const html='<div style="background:#f2f6fb;padding:26px;font-family:Arial,sans-serif;color:#01122f"><div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden"><div style="background:#01122f;color:white;padding:24px;font-size:20px;font-weight:bold">Workforce by screenings4u</div><div style="padding:26px"><h1 style="font-size:21px">Support request received</h1><p>Your Lab Account support request '+reference+' has been received. Our team will review it and reply in your portal.</p><a href="https://lab-account.screenings4u.com/support.html" style="display:inline-block;background:#fdc102;color:#01122f;padding:12px 16px;text-decoration:none;border-radius:8px">View Support</a></div></div></div>';
 try{const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from:Deno.env.get("SCREENINGS4U_FROM_EMAIL")||"screenings4u <notifications@screenings4u.com>",to:[email],subject:"Workforce | Support request received — "+reference,html})});if(!r.ok)console.error("Lab support customer email",r.status);return r.ok?"sent":"failed"}catch(e){console.error("Lab support customer acknowledgment",e);return "failed"}
};
const alertManagement=async(db:any,customer:string,ticketNumber:string,subject:string,description:string)=>{
 const admin=Deno.env.get("SCREENINGS4U_ADMIN_EMAIL")||"";
 const key=Deno.env.get("RESEND_API_KEY")||"";
 if(!key||!admin){console.error("Lab Account admin email not configured");return "not_configured"}
 const esc=(v:string)=>String(v).replace(/[&<>"]/g,k=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[k]||k));
 const html='<div style="padding:25px;background:#f2f6fb;font-family:Arial,sans-serif;color:#01122f"><div style="max-width:620px;background:#fff;margin:auto;padding:25px;border-radius:12px;border-top:5px solid #fdc102"><h1>Workforce | New Lab Account Support</h1><p><b>Ticket:</b> '+esc(ticketNumber)+'</p><p><b>Customer:</b> '+esc(customer)+'</p><p><b>Subject:</b> '+esc(subject)+'</p><p>'+esc(description.slice(0,1000))+'</p><p>Open Testing Support in Workforce Management to respond.</p></div></div>';
 try{const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from:Deno.env.get("SCREENINGS4U_FROM_EMAIL")||"screenings4u <notifications@screenings4u.com>",to:[admin],subject:"Lab Account support — "+ticketNumber,html})});if(!r.ok)console.error("Lab Account admin support email failed",r.status);return r.ok?"sent":"failed"}catch(e){console.error("Lab Account support notification failed",e);return "failed"}
};

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:H});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await auth.auth.getUser(token);if(error||!user?.email_confirmed_at)return reply({error:"Sign in required"},401);
 const ent=await fetch(url+"/functions/v1/lab-account-entitlement",{method:"POST",headers:{"authorization":"Bearer "+token,"apikey":anon,"Content-Type":"application/json"},body:"{}"});
 const grant=await ent.json().catch(()=>({}));if(!ent.ok||grant.authorized!==true)return reply({error:"Lab Account access required"},403);
 const db=createClient(url,svc,{auth:{persistSession:false,autoRefreshToken:false}});
 const b=await req.json().catch(()=>({})),action=String(b.action||"list"),uid=user.id;
 if(action==="list"){
 const t=await db.from("support_tickets").select("id,ticket_number,subject,status,priority,category,created_at,updated_at,last_message_at").eq("customer_user_id",uid).order("created_at",{ascending:false}).limit(100);
 if(t.error)throw t.error;
 return reply({tickets:t.data||[]});
 }
 if(action==="detail"){
 const id=String(b.ticket_id||"");if(!/^[0-9a-f-]{36}$/i.test(id))return reply({error:"Invalid ticket"},400);
 const t=await db.from("support_tickets").select("id,ticket_number,subject,status,priority,category,created_at").eq("id",id).eq("customer_user_id",uid).maybeSingle();if(t.error)throw t.error;if(!t.data)return reply({error:"Ticket not found"},404);
 const m=await db.from("support_ticket_messages").select("id,body,sender_type,created_at").eq("ticket_id",id).eq("is_internal_note",false).order("created_at",{ascending:true});if(m.error)throw m.error;
 return reply({ticket:t.data,messages:m.data||[]});
 }
 if(action==="create"){
 const subject=String(b.subject||"").trim(),message=String(b.message||"").trim(),category=String(b.category||"general");
 if(!subject||subject.length>180||!message||message.length>5000||!["general","billing","testing","results","supplies","technical","portal_access","documents"].includes(category))return reply({error:"Please complete the support request"},400);
 const priority=String(b.priority||"normal");if(!["low","normal","high","urgent"].includes(priority))return reply({error:"Invalid priority"},400);
 const timestamp=new Date().toISOString(),id=crypto.randomUUID();
 const ticket=await db.from("support_tickets").insert({id,ticket_number:"SUP-"+Date.now().toString(36).toUpperCase()+"-"+id.slice(0,5).toUpperCase(),subject,status:"open",priority,category,customer_user_id:uid,requester_name:String(user.user_metadata?.full_name||user.email||"").slice(0,180),requester_email:user.email,source:"lab_account_portal",created_by:uid,last_message_at:timestamp,created_at:timestamp,updated_at:timestamp,metadata:{portal:"lab_account"}}).select("id,ticket_number").single();if(ticket.error)throw ticket.error;
 const msg=await db.from("support_ticket_messages").insert({id:crypto.randomUUID(),ticket_id:id,sender_user_id:uid,sender_type:"customer",body:message,is_internal_note:false,metadata:{portal:"lab_account"},created_at:timestamp});
 if(msg.error){await db.from("support_tickets").delete().eq("id",id).eq("customer_user_id",uid);throw msg.error;}
 const notification_status={admin:await alertManagement(db,user.email||"",ticket.data.ticket_number,subject,message),customer:await customerAcknowledgment(user.email||"",ticket.data.ticket_number)};
 return reply({ticket:ticket.data,notification_status});
 }
 if(action==="reply"){
 const id=String(b.ticket_id||""),message=String(b.message||"").trim();if(!/^[0-9a-f-]{36}$/i.test(id)||!message||message.length>5000)return reply({error:"Invalid reply"},400);
 const ticket=await db.from("support_tickets").select("id,status").eq("id",id).eq("customer_user_id",uid).maybeSingle();if(ticket.error)throw ticket.error;if(!ticket.data)return reply({error:"Ticket not found"},404);
 if(ticket.data.status==="closed")return reply({error:"This ticket is closed"},409);
 const timestamp=new Date().toISOString();const m=await db.from("support_ticket_messages").insert({id:crypto.randomUUID(),ticket_id:id,sender_user_id:uid,sender_type:"customer",body:message,is_internal_note:false,metadata:{portal:"lab_account"},created_at:timestamp});if(m.error)throw m.error;
 const update=await db.from("support_tickets").update({last_message_at:timestamp,updated_at:timestamp}).eq("id",id);if(update.error)throw update.error;
 const notice=await alertManagement(db,user.email||"","Existing ticket",ticket.data.id,"New customer reply received.");return reply({ok:true,notification_status:notice});
 }
 return reply({error:"Unsupported action"},400);
 }catch(e){console.error("lab-account-support",e);return reply({error:"Support service unavailable"},500)}
});