import {escape,money} from './ui.js';
import {partnerPercent} from './partner-display.js';
import {loadPartnerOperatingAccount} from './partner-settlement.js';
function metric(field,title,value){return `<article class="panel"><p>${title}: <b data-operating-field="${field}" class="${value<0?'settlement-loss':value>0?'settlement-profit':'settlement-neutral'}">${money(value,2)}</b></p></article>`;}
function markup(data){
 return `<h2>${escape(data.name)}</h2><section class="panel"><p>إجمالي رصيد الشريك الحالي</p><h2 data-operating-total class="${data.balance<0?'settlement-loss':'settlement-profit'}">${money(data.balance,2)}</h2><p>النسبة الأصلية: ${partnerPercent(data.share)} — نسبة توزيع النشاط بين الشركاء: ${partnerPercent(data.ratio*100)}</p><p class="muted">هذا رصيد تشغيلي وفق حسابات التطبيق، وليس رصيد الحساب البنكي أو مبلغًا مضمونًا للسحب. البضاعة والربح المتوقع ليسا نقدًا جاهزًا.</p></section>`+
 metric('initialCapital','رأس المال الأساسي',data.initialCapital)+metric('profit','الربح المتراكم حسب توزيع النشاط',data.profit)+metric('withdrawn','إجمالي السحوبات',data.withdrawn)+metric('outstandingDebt','الذمة المعلقة',data.outstandingDebt)+
 `<button type="button" data-toggle-operating-details aria-expanded="false" aria-controls="operating-account-details">إظهار التفاصيل</button><section id="operating-account-details" hidden>`+
 metric('operatingBalance','حصة الشريك من الرصيد النقدي',data.operatingBalance)+
 (data.inventoryAvailable?metric('inventoryShare','حصة البضاعة بسعر الشراء',data.inventoryShare)+metric('expectedInventoryProfit','حصته من ربح البضاعة المتوقع',data.expectedInventoryProfit):'<p data-operating-inventory-missing>بيانات المخزون غير متاحة</p>')+
 metric('debtPrincipal','أصل الذمم المالية',data.debtPrincipal)+metric('settledDebt','الذمم المسددة من الأرباح',data.settledDebt)+metric('unwithdrawnProfit','الربح المعتمد غير المسحوب',data.unwithdrawnProfit)+metric('reinvestmentShare','حصته من المتروك للمشروع',data.reinvestmentShare)+metric('reinvestmentCashShare','الجزء النقدي من المتروك للمشروع',data.reinvestmentCashShare)+
 '<p class="muted">الرصيد النقدي = رأس المال + حصة صافي النشاط − السحوبات − أصل الذمم. الإجمالي = الرصيد النقدي + البضاعة بسعر الشراء + ربح البضاعة المتوقع. السحوبات والذمم محسوبة بالفعل؛ لا تُخصم مرة ثانية. الربح المعتمد والمتروك للمشروع للتوضيح ولا يُضافان مرة ثانية إلى الإجمالي.</p></section>';
}
export function openPartnerOperatingAccount({api,projectId,partnerId,isCurrent=()=>true}){
 if(!isCurrent()||document.querySelector('dialog.partner-operating-account'))return;
 const dialog=document.createElement('dialog');dialog.className='partner-operating-account';dialog.innerHTML='<h2>كشف حساب الشريك</h2><section data-operating-content></section><button type="button" data-close-operating>فهمت</button>';document.body.append(dialog);dialog.showModal();
 let ended=false,busy=false;const current=()=>!ended&&dialog.isConnected&&isCurrent();
 const close=()=>{if(ended)return;ended=true;observer.disconnect();dialog.remove();};const observer=new MutationObserver(()=>{if(!current())close();});observer.observe(document.documentElement,{childList:true,subtree:true});dialog.querySelector('[data-close-operating]').onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=close;
 const load=async()=>{
  if(!current()||busy)return;busy=true;const content=dialog.querySelector('[data-operating-content]');content.innerHTML='<div class="skeleton"></div>';
  try{const data=await loadPartnerOperatingAccount(api,projectId,partnerId,current);if(current()){
   content.innerHTML=markup(data);const toggle=content.querySelector('[data-toggle-operating-details]'),details=content.querySelector('#operating-account-details');toggle.onclick=()=>{if(!current())return;details.hidden=!details.hidden;toggle.setAttribute('aria-expanded',String(!details.hidden));toggle.textContent=details.hidden?'إظهار التفاصيل':'إخفاء التفاصيل';};
  }}catch(error){if(current()){content.innerHTML='<p role="alert"></p><button type="button" data-retry-operating>إعادة المحاولة</button>';content.querySelector('p').textContent=error.message;content.querySelector('button').onclick=load;}}
  finally{busy=false;}
 };load();return dialog;
}
