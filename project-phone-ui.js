import {normalizeProjectPhone,projectPhone,projectPhoneCountries,countryName} from './project-phone.js';
import {projectPhoneRegion} from './project-phone-region.js';
import {escape} from './ui.js';
const bindings=new WeakMap();

export function bindProjectPhone(form,{region=projectPhoneRegion}={}){
 const input=form?.querySelector('input[name="phone"]');if(!input)return;
 const label=document.createElement('label');label.className='project-phone-country';
 label.innerHTML=`بلد رقم الجوال<select data-phone-country required><option value="">جارٍ تحديد البلد…</option>${projectPhoneCountries.map(code=>({code,name:countryName(code)})).sort((a,b)=>a.name.localeCompare(b.name,'ar')).map(({code,name})=>`<option value="${code}">${escape(name)}</option>`).join('')}</select><small class="muted" data-phone-country-status role="status"></small>`;
 input.closest('label').before(label);
 const select=label.querySelector('select'),status=label.querySelector('[role=status]');
 input.inputMode='numeric';input.autocomplete='tel-national';
 const validate=()=>{
  input.value=normalizeProjectPhone(input.value);
  let message='';if(input.value){try{projectPhone(input.value,select.value);}catch(error){message=error.message;}}
  input.setCustomValidity(message);
 };
 const refresh=()=>{
  const {country,source}=region.get();select.value=country||'';
  select.options[0].textContent=country?'اختر البلد':'اختر بلد رقم الجوال';
  input.maxLength=country==='PS'?10:15;input.minLength=country==='PS'?10:1;
  input.pattern=country==='PS'?'[0-9]{10}':'[0-9]{1,15}';
  input.placeholder=country==='PS'?'05xxxxxxxx':'رقم الجوال المحلي';
  input.setAttribute('aria-description',country==='PS'?'رقم جوال المشروع في فلسطين من 10 أرقام':'رقم الجوال المحلي دون رمز الدولة');
  status.textContent=country?(source==='ip'?'تم تحديد البلد حسب IP. يمكنك تغييره عند الحاجة.':'أدخل رقم الجوال المحلي للبلد المختار.'):'تعذّر تحديد البلد تلقائيًا؛ اختر بلد رقم الجوال للمتابعة.';
  if(country==='PS')status.textContent+=' رقم الجوال في فلسطين 10 أرقام فقط.';
  validate();
 };
 select.onchange=()=>{if(select.value){region.choose(select.value);refresh();}};
 input.addEventListener('input',validate);
 const ready=region.ensure().then(()=>{if(input.isConnected)refresh();});
 bindings.set(form,{region,ready,input,select});
 // Remove hard-coded Palestinian limits while the IP request is pending.
 input.maxLength=15;input.minLength=1;input.pattern='[0-9]{1,15}';input.placeholder='رقم الجوال المحلي';
 if(region.get().country)refresh();
}
export async function readProjectPhone(form){
 const binding=bindings.get(form);if(!binding)throw Error('تعذر تهيئة رقم الجوال');
 if(!binding.select.value)await binding.ready;
 const country=binding.select.value;
 return {country,phone:projectPhone(binding.input.value,country)};
}
