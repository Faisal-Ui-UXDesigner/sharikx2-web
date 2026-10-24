import {hasActiveSubscription} from './subscription.js';

export const SUBSCRIPTION_SETTINGS_PATH='/rest/v1/sharikx2_payment_settings?id=eq.1&select=subscription_price_usd,bank_name,bank_account_number,bank_iban,bank_phone,wallet_name,wallet_phone&limit=1';
export const SUBSCRIPTION_FEATURES=Object.freeze([
 ['حفظ المعلومات والحسابات','دائم','دائم'],['عدد الشركاء','2','غير محدود'],
 ['المبيعات اليومية','100','غير محدود'],['أصناف البضاعة','25','غير محدود'],
 ['عدد الموردين','5','غير محدود'],['تقارير شاملة','غير متاح','متاح'],['مشاركة المشروع','غير متاح','غير محدود']
].map(row=>Object.freeze(row)));
const invalid=()=>Error('تعذر التحقق من بيانات الاشتراك؛ أعد تحميلها قبل التحويل');
export function subscriptionPaymentSettings(rows){
 if(!Array.isArray(rows)||rows.length>1)throw invalid();
 const row=rows.length?rows[0]:{};if(!row||typeof row!=='object'||Array.isArray(row))throw invalid();
 const value=row.subscription_price_usd;
 if(value!==undefined&&value!==null&&(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))))throw invalid();
 const price=Number(value)>0?Number(value):10,settings={price,currency:'USD'};
 for(const name of ['bank_name','bank_account_number','bank_iban','bank_phone','wallet_name','wallet_phone']){
  const text=row[name];if(text!==undefined&&text!==null&&typeof text!=='string')throw invalid();settings[name]=(text??'').trim();
 }
 return Object.freeze(settings);
}
// Subscription prices are USD, independently of the project's accounting currency.
export const subscriptionPrice=settings=>new Intl.NumberFormat('en-US',{useGrouping:false,maximumFractionDigits:2}).format(settings.price)+' $';
export function subscriptionStatus(project,now=Date.now()){
 if(!project||typeof project!=='object'||Array.isArray(project)||!Number.isFinite(now))throw invalid();
 const value=project.subscription_expires_at,expires=value===null||value===undefined||value===''?0:typeof value==='number'?value:Date.parse(value);
 if(!Number.isFinite(expires)||!Number.isFinite(new Date(expires).getTime()))throw invalid();
 const active=hasActiveSubscription(project,now),expired=project.subscription_status==='active'&&!active;
 const daysLeft=expires<=0?0:Math.max(0,Math.ceil((expires-now)/86400000)),nearExpiry=active&&daysLeft<=3;
 return Object.freeze({active,expired,daysLeft,nearExpiry,expires,showExpiry:active&&expires>0,
  title:expired?'انتهى الاشتراك وعاد الحساب مجانياً':nearExpiry?'اشتراكك أوشك على الانتهاء':active?'اشتراكك فعال حالياً':'الخطة المجانية فعالة',
  side:active?`متبقي ${daysLeft} يوم`:'استخدام مستمر',
  action:expired?'إعادة الاشتراك':active?(nearExpiry?'تجديد الاشتراك':''):'عرض المزايا والاشتراك'});
}
export function subscriptionLimits(active){
 return Object.freeze([
  ['الشركاء',active?'غير محدود':'2'],['أصناف البضاعة',active?'غير محدود':'25'],
  ['المبيعات اليومية',active?'غير محدود':'100'],['الموردون',active?'غير محدود':'5'],
  ['ديون الزبائن',active?'غير محدود':'10 زبائن'],['مشاركة المشروع',active?'متاحة':'غير متاحة'],
  ['التقارير الشاملة',active?'متاحة':'غير متاحة']
 ].map(row=>Object.freeze(row)));
}
