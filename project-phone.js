/** Owner/project identity. Preserve the leading zero and accept Arabic keyboards. */
export function normalizeProjectPhone(value){
 return String(value??'').trim()
  .replace(/[٠-٩]/g,digit=>String(digit.charCodeAt(0)-1632))
  .replace(/[۰-۹]/g,digit=>String(digit.charCodeAt(0)-1776))
  .replace(/[\s().-]/g,'');
}

export function projectPhone(value){
 const phone=normalizeProjectPhone(value);
 if(!/^[0-9]{10}$/.test(phone))throw Error('رقم جوال المشروع يجب أن يكون 10 أرقام فقط');
 return phone;
}

export function bindProjectPhone(form){
 const input=form?.querySelector('input[name="phone"]');
 if(!input)return;
 input.maxLength=10;input.minLength=10;input.pattern='[0-9]{10}';
 input.inputMode='numeric';input.autocomplete='tel-national';
 input.setAttribute('aria-description','رقم جوال المشروع من 10 أرقام');
 input.addEventListener('input',()=>{
  input.value=normalizeProjectPhone(input.value);
  input.setCustomValidity(input.value&&!/^[0-9]{10}$/.test(input.value)
   ?'رقم جوال المشروع يجب أن يكون 10 أرقام فقط':'');
 });
}
