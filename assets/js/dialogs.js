/* Shared accessible dialogs for Workforce Lab Account. */
(function(){'use strict';
function ask({title='Screenings4u Workforce',message='',kind='alert',confirmText='Continue',cancelText='Cancel',danger=false}={}){
 return new Promise(resolve=>{
 const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;background:rgba(16,47,85,.72);padding:20px';
 const panel=document.createElement('section');panel.setAttribute('role','alertdialog');panel.setAttribute('aria-modal','true');panel.style.cssText='max-width:460px;width:100%;background:#fff;color:#143455;border-radius:14px;padding:24px;font:14px system-ui,sans-serif;box-shadow:0 16px 60px #0015';
 const heading=document.createElement('h2');heading.textContent=title;heading.style.cssText='margin:0 0 12px;font-size:20px';const body=document.createElement('p');body.textContent=message;body.style.cssText='line-height:1.6;white-space:pre-wrap';
 const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:end;gap:10px;margin-top:20px';
 const previouslyFocused=document.activeElement;
 function close(value){document.removeEventListener('keydown',onKey);overlay.remove();previouslyFocused?.focus?.();resolve(value)}
 function btn(text,primary,value){const b=document.createElement('button');b.type='button';b.textContent=text;b.style.cssText='border-radius:8px;border:1px solid #c9d8e5;padding:10px 16px;cursor:pointer;background:'+(primary?(danger?'#b42318':'#102f55'):'#fff')+';color:'+(primary?'#fff':'#102f55');b.addEventListener('click',()=>close(value));return b}
 if(kind==='confirm')actions.append(btn(cancelText,false,false));const ok=btn(confirmText,true,true);actions.append(ok);panel.append(heading,body,actions);overlay.append(panel);document.body.append(overlay);ok.focus();
 function onKey(e){if(e.key==='Escape'){e.preventDefault();close(false)}if(e.key==='Tab'){const items=[...actions.querySelectorAll('button')];const i=items.indexOf(document.activeElement);if(e.shiftKey&&i===0){e.preventDefault();items.at(-1).focus()}else if(!e.shiftKey&&i===items.length-1){e.preventDefault();items[0].focus()}}}
 document.addEventListener('keydown',onKey);
 });
}
window.S4UDialogs=Object.freeze({alert:message=>ask({message}),confirm:(message,options={})=>ask({message,kind:'confirm',...options}),open:ask});
})();