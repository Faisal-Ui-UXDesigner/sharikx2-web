import './vendor/libphonenumber-mobile.js';

/** Owner/project identity. Preserve the leading zero and accept Arabic keyboards. */
export function normalizeProjectPhone(value){
 return String(value??'').trim()
  .replace(/[٠-٩]/g,digit=>String(digit.charCodeAt(0)-1632))
  .replace(/[۰-۹]/g,digit=>String(digit.charCodeAt(0)-1776))
  .replace(/[\s().-]/g,'');
}

export const projectPhoneCountries=Object.freeze(globalThis.libphonenumber.getCountries());
export function phoneCountry(value){
 const country=String(value||'').trim().toUpperCase();
 return projectPhoneCountries.includes(country)?country:null;
}
export function countryName(country){
 try{return new Intl.DisplayNames(['ar'],{type:'region'}).of(country)||country;}catch{return country;}
}
export function projectPhone(value,country='PS'){
 const phone=normalizeProjectPhone(value),region=phoneCountry(country);
 if(!region)throw Error('اختر بلد رقم جوال المشروع');
 if(region==='PS'){
  if(!/^[0-9]{10}$/.test(phone))throw Error('رقم جوال المشروع في فلسطين يجب أن يكون 10 أرقام فقط');
 }else{
  const parsed=/^[0-9]{1,15}$/.test(phone)?globalThis.libphonenumber.parsePhoneNumberFromString(phone,region):null;
  if(!parsed?.isPossible()||normalizeProjectPhone(parsed.formatNational()).length!==phone.length)
   throw Error(`أدخل رقم جوال محليًا بطول صحيح لبلد ${countryName(region)}، دون رمز الدولة`);
 }
 return phone;
}
