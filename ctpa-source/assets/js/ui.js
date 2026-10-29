(()=>{'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function close(backdrop,value,resolve){backdrop.remove();resolve(value)}
function dialog(opts={}){
  return new Promise(resolve=>{
    const title=opts.title||'screenings4u';
    const message=opts.message||'';
    const fields=Array.isArray(opts.fields)?opts.fields:[];
    const backdrop=document.createElement('div');
    backdrop.className='modal-backdrop s4u-dialog-backdrop';
    const fieldHtml=fields.map(f=>{
      const type=f.type||'text';
      const control=type==='textarea'
        ?`<textarea name="${esc(f.name)}" rows="${esc(f.rows||5)}" ${f.required?'required':''} placeholder="${esc(f.placeholder||'')}">${esc(f.value||'')}</textarea>`
        :`<input type="${esc(type)}" name="${esc(f.name)}" value="${esc(f.value||'')}" ${f.required?'required':''} placeholder="${esc(f.placeholder||'')}">`;
      return `<label class="field ${f.full?'full':''}"><span>${esc(f.label||'')}</span>${control}</label>`;
    }).join('');
    backdrop.innerHTML=`<form class="modal s4u-dialog ${opts.wide?'s4u-dialog-wide':''}"><div class="s4u-dialog-head"><div><span class="s4u-dialog-kicker">screenings4u</span><h2>${esc(title)}</h2></div><button type="button" class="modal-x" data-ui-close aria-label="Close">×</button></div>${message?`<p class="s4u-dialog-message">${esc(message)}</p>`:''}${fields.length?`<div class="modal-grid s4u-dialog-fields">${fieldHtml}</div>`:''}<div class="modal-actions">${opts.mode==='alert'?'':`<button type="button" class="btn ghost" data-ui-cancel>${esc(opts.cancelText||'Cancel')}</button>`}<button type="submit" class="btn ${opts.danger?'danger':'primary'}">${esc(opts.confirmText||'OK')}</button></div></form>`;
    document.body.appendChild(backdrop);
    const form=backdrop.querySelector('form');
    const cancel=()=>close(backdrop,opts.mode==='confirm'?false:null,resolve);
    backdrop.querySelector('[data-ui-close]').onclick=cancel;
    const cancelButton=backdrop.querySelector('[data-ui-cancel]');if(cancelButton)cancelButton.onclick=cancel;
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)cancel()});
    form.addEventListener('submit',e=>{
      e.preventDefault();
      if(opts.mode==='confirm')return close(backdrop,true,resolve);
      if(opts.mode==='prompt'){
        const values=Object.fromEntries(new FormData(form).entries());
        return close(backdrop,fields.length===1?values[fields[0].name]:values,resolve);
      }
      close(backdrop,true,resolve);
    });
    const first=form.querySelector('input,textarea,select,button[type=submit]');
    setTimeout(()=>first?.focus(),0);
  });
}
function alertBox(message,options={}){
  return dialog({mode:'alert',title:options.title||'Notice',message,confirmText:options.confirmText||'Close',cancelText:'Close'});
}
function confirmBox(message,options={}){
  return dialog({mode:'confirm',title:options.title||'Please Confirm',message,confirmText:options.confirmText||'Confirm',cancelText:options.cancelText||'Cancel',danger:!!options.danger});
}
function promptBox(message,options={}){
  return dialog({mode:'prompt',title:options.title||'Information Required',message,confirmText:options.confirmText||'Continue',cancelText:options.cancelText||'Cancel',fields:[{name:'value',label:options.label||'Details',type:options.type||'text',value:options.value||'',placeholder:options.placeholder||'',required:options.required!==false,full:true,rows:options.rows||5}]});
}
function toast(message,type='good'){
  let stack=document.querySelector('.s4u-toast-stack');
  if(!stack){stack=document.createElement('div');stack.className='s4u-toast-stack';document.body.appendChild(stack)}
  const el=document.createElement('div');el.className=`s4u-toast ${type==='bad'?'bad':type==='warn'?'warn':'good'}`;el.textContent=message;stack.appendChild(el);
  setTimeout(()=>{el.classList.add('leaving');setTimeout(()=>el.remove(),180)},3400);
}
window.PortalUI={dialog,alert:alertBox,confirm:confirmBox,prompt:promptBox,toast};
})();
