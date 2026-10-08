import {currencyCode,currencySymbol} from './currency.js';
let currentCurrency='ILS';export const setCurrency=value=>{currentCurrency=currencyCode(value);};export const currency=()=>currentCurrency;
export const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=(n,decimals=0)=>new Intl.NumberFormat('ar-u-nu-latn',{maximumFractionDigits:decimals}).format(Number(n||0))+' '+currencySymbol(currentCurrency);
export function timestamp(value){const d=new Date(value);return Number.isNaN(d.getTime())?'تاريخ غير متوفر':new Intl.DateTimeFormat('ar-u-nu-latn',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);}
export const status=value=>({completed:'مكتملة',credit:'دين',debt:'دين',partially_returned:'مرتجع جزئي',returned:'مرتجعة',cancelled:'ملغاة',pending:'معلقة'}[value]||value||'غير محدد');
