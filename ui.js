import {currencyCode,currencySymbol} from './currency.js';
import {roundedDecimalDisplay,expenseDisplayValue} from './money-display.js';
import {auditTimestamp} from './date-display.js';
let currentCurrency='ILS';export const setCurrency=value=>{currentCurrency=currencyCode(value);};export const currency=()=>currentCurrency;
export const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const moneyFormats=new Map();
export function money(n,decimals=0){const value=roundedDecimalDisplay(n,decimals);if(!moneyFormats.has(decimals))moneyFormats.set(decimals,new Intl.NumberFormat('ar-u-nu-latn',{maximumFractionDigits:decimals}));return moneyFormats.get(decimals).format(value)+' '+currencySymbol(currentCurrency);}
export function expenseMoney(n,decimals=0){const value=roundedDecimalDisplay(expenseDisplayValue(n),decimals);return (value<0?'−':'')+money(Math.abs(value),decimals);}
export const timestamp=auditTimestamp;
export const status=value=>({completed:'مكتملة',credit:'دين',debt:'دين',partially_returned:'مرتجع جزئي',returned:'مرتجعة',cancelled:'ملغاة',pending:'معلقة'}[value]||value||'غير محدد');
