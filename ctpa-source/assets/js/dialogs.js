(()=>{"use strict";
const ID="s4u-branded-dialog";
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
function remove(){document.getElementById(ID)?.remove()}
function open({title="Screenings4u",message="",kind="alert",confirmText="Continue",cancelText="Cancel",label="",value="",danger=false}={}){
  remove();
  return new Promise(resolve=>{
    const o=document.createElement("div");o.id=ID;o.style.cssText="position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;padding:24px;background:rgba(16,47,85,.76);backdrop-filter:blur(3px);font-family:Inter,Arial,sans-serif";
    const d=document.createElement("section");d.setAttribute("role",kind==="alert"?"alertdialog":"dialog");d.setAttribute("aria-modal","true");d.style.cssText="width:min(480px,100%);background:#fff;border-radius:16px;border-top:5px solid #ef6c00;box-shadow:0 24px 70px rgba(0,0,0,.3);padding:28px";
    const input=kind==="prompt"?`<label style="display:block;margin-top:16px;color:#183653;font-size:0.75rem;font-weight:800">${esc(label||"Response")}</label><input data-s4u-dialog-input value="${esc(value)}" style="width:100%;margin-top:7px;min-height:44px;border:1px solid #ccd8e6;border-radius:9px;padding:0 12px;color:#183653;outline:none">`:"";
    d.innerHTML=`<div style="display:flex;align-items:center;margin-bottom:16px"><img src="images/logo.png" alt="screenings4u DOT" style="display:block;max-width:190px;width:auto;height:auto;max-height:48px"></div><h2 style="margin:0 0 10px;color:#102f55;font-size:1.375rem;line-height:1.2">${esc(title)}</h2><p style="margin:0;color:#667892;line-height:1.55;font-size:0.875rem;white-space:pre-wrap">${esc(message)}</p>${input}<div data-s4u-dialog-actions style="display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:22px"></div>`;
    const actions=d.querySelector("[data-s4u-dialog-actions]");
    const button=(text,primary,fn)=>{const b=document.createElement("button");b.type="button";b.textContent=text;b.style.cssText=`min-height:42px;padding:0 16px;border-radius:9px;border:1px solid ${primary?(danger?"#a72d2d":"#ef6c00"):"#cfd9e5"};background:${primary?(danger?"#a72d2d":"#ef6c00"):"#fff"};color:${primary?"#fff":"#24467f"};font:800 13px Inter,Arial,sans-serif;cursor:pointer`;b.onclick=fn;return b};
    const done=v=>{remove();resolve(v)};
    if(kind==="confirm"||kind==="prompt")actions.append(button(cancelText,false,()=>done(kind==="prompt"?null:false)));
    actions.append(button(kind==="alert"?"OK":confirmText,true,()=>{if(kind==="prompt")done(d.querySelector("[data-s4u-dialog-input]")?.value??"");else done(true)}));
    o.onclick=e=>{if(e.target===o&&kind!=="alert")done(kind==="prompt"?null:false)};
    o.addEventListener("keydown",e=>{if(e.key==="Escape"&&kind!=="alert")done(kind==="prompt"?null:false);if(e.key==="Enter"&&kind==="prompt"){e.preventDefault();done(d.querySelector("[data-s4u-dialog-input]")?.value??"")}});
    o.append(d);document.body.append(o);
    setTimeout(()=>{const target=kind==="prompt"?d.querySelector("[data-s4u-dialog-input]"):actions.querySelector("button:last-child");target?.focus()},0);
  })
}
window.S4UDialog={
  alert:(message,opts={})=>open({...opts,kind:"alert",message,title:opts.title||"Notice"}),
  confirm:(message,opts={})=>open({...opts,kind:"confirm",message,title:opts.title||"Confirm action",confirmText:opts.confirmText||"Continue"}),
  prompt:(message,opts={})=>open({...opts,kind:"prompt",message,title:opts.title||"Information required",confirmText:opts.confirmText||"Continue"})
};
/* Global portal rule: browser alert boxes are never shown. */
window.alert=(message)=>{window.S4UDialog.alert(String(message??""),{title:"screenings4u"});};
})();
