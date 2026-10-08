// Ordered labels and symbols from Android MainActivity.showCurrencyDialog.
export const PROJECT_CURRENCIES=Object.freeze([
 ['ILS','₪','فلسطين','شيكل'],['JOD','د.أ','الأردن','دينار'],['SAR','ر.س','السعودية','ريال'],['AED','د.إ','الإمارات','درهم'],['EGP','ج.م','مصر','جنيه'],['LBP','ل.ل','لبنان','ليرة'],['QAR','ر.ق','قطر','ريال'],['KWD','د.ك','الكويت','دينار'],['BHD','د.ب','البحرين','دينار'],['OMR','ر.ع','عُمان','ريال'],['MAD','د.م','المغرب','درهم'],['TND','د.ت','تونس','دينار'],['DZD','دج','الجزائر','دينار'],['IQD','ع.ع','العراق','دينار'],['YER','ر.ي','اليمن','ريال'],['SDG','ج.س','السودان','جنيه']
].map(([code,symbol,country,name])=>Object.freeze({code,symbol,label:`${country} — ${symbol} ${name}`})));
const byCode=new Map(PROJECT_CURRENCIES.map(currency=>[currency.code,currency]));
export function currencyCode(value){const code=String(value||'ILS').trim().toUpperCase();return /^[A-Z]{3}$/.test(code)?code:'ILS';}
export function currencySymbol(value){const code=currencyCode(value);return byCode.get(code)?.symbol||({LYD:'ل.د',SYP:'ل.س'}[code])||code;}
export function projectCurrencyPayload(projectId,value){
 const code=String(value||'').trim().toUpperCase();
 if(typeof projectId!=='string'||!projectId)throw new Error('بيانات المشروع غير مكتملة');
 if(!byCode.has(code))throw new Error('اختر عملة من قائمة عملات المشروع');
 return {currency:code};
}
export function projectCurrencyResult(rows,projectId,expected){
 if(!Array.isArray(rows)||rows.length!==1||rows[0]?.id!==projectId||rows[0].currency!==expected)throw new Error('تعذر تأكيد حفظ العملة؛ ربما تغيرت بيانات المشروع. أعد تحميل الحسابات');
 return rows[0];
}
