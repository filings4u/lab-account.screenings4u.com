/* General-purpose Workforce form validation, without DOT-specific fields. */
(function(){'use strict';
function validate(form){if(!(form instanceof HTMLFormElement))return false;const inputs=[...form.querySelectorAll('input,select,textarea')];for(const el of inputs){if(el.disabled||!el.willValidate)continue;if(el.type==='email'&&el.value)el.value=el.value.trim();if(!el.checkValidity()){el.setAttribute('aria-invalid','true');el.reportValidity();el.focus();return false}el.removeAttribute('aria-invalid')}return true}
document.addEventListener('input',e=>{if(e.target?.matches?.('input,select,textarea'))e.target.removeAttribute('aria-invalid')});
window.S4UValidation=Object.freeze({validate});
})();