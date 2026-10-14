import {escape,money} from './ui.js';
import {loadPartnerBalance} from './partner-balance.js';
import {partnerPercent} from './partner-display.js';

function row(field,title,value,note,tone='settlement-standard'){return `<article class="panel"><p>${escape(title)}: <b class="${tone}" data-balance-field="${field}">${money(value,2)}</b></p><p class="muted small">${escape(note)}</p></article>`;}
function markup(data){
 return `<h2>${escape(data.name)}</h2><section class="panel"><p>صافي حصة الشريك</p><h2 class="${data.netShare<0?'negative':'partner-net-positive'}" data-balance-net>${money(data.netShare,2)}</h2><p class="muted small">الأصول وديون الزبائن حسب النسبة الأصلية للشريك، بينما ديون الموردين موزعة بالكامل على الشركاء فقط.</p></section>`+
 row('liquidity','حصة الشريك من السيولة',data.liquidity,'من رصيد الكاش والبنك والمحافظ المتاح فعلياً.')+
 row('inventory','حصة البضاعة بسعر الشراء',data.inventory,'قيمة البضاعة الحالية حسب تكلفة الشراء.')+
 row('expectedProfit','ربح البضاعة المتوقع',data.expectedProfit,'فرق سعر البيع المتوقع عن سعر الشراء حسب نسبة الشريك.',data.expectedProfit>=0?'settlement-profit':'settlement-loss')+
 row('customerDebt','حصة من ديون الزبائن',data.customerDebt,'ضمن صافي الحصة، لكنها ليست سيولة حتى يتم تحصيلها.','balance-gold')+
 row('supplierDebt','حصة من ديون الموردين',-data.supplierDebt,`التزام يُطرح من صافي الحصة وموزع 100% على الشركاء (نسبتك المعادلة ${partnerPercent(data.supplierDebtRatio*100)}).`,'settlement-loss')+
 row('outstandingDebt','ذمة مالية معلقة',data.outstandingDebt,'تُعرض للتوضيح ولا تُضاف مرة ثانية إلى صافي الحصة.',data.outstandingDebt>0?'balance-gold':'settlement-neutral')+
 row('unwithdrawnProfit','ربح غير مسحوب',data.unwithdrawnProfit,'جزء من قيمة المشروع الحالية، ولا يُضاف مرة ثانية إلى صافي الحصة.',data.unwithdrawnProfit>0?'settlement-profit':'settlement-neutral')+
 row('settledDebt','إجمالي الذمم المالية المسددة',data.settledDebt,'إجمالي ما تم خصمه سابقاً من أرباح الشريك لتسوية ذممه.')+
 row('withdrawn','إجمالي الأرباح المسحوبة',data.withdrawn,'إجمالي الأرباح التي سحبها الشريك فعلياً.');
}

export function openPartnerBalance({api,projectId,partnerId,isCurrent=()=>true}){
 if(!isCurrent()||document.querySelector('dialog.partner-balance-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='partner-balance-dialog';dialog.innerHTML='<h2>تفاصيل حصة الشريك</h2><section data-balance-content></section><button type="button" class="primary" data-close-partner-balance>فهمت</button>';document.body.append(dialog);dialog.showModal();
 let ended=false,busy=false;
 const current=()=>!ended&&dialog.isConnected&&isCurrent();
 const close=()=>{if(ended)return;ended=true;observer.disconnect();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!current())close();});observer.observe(document.documentElement,{subtree:true,childList:true});
 dialog.querySelector('[data-close-partner-balance]').onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=close;
 const load=async()=>{
  if(!current()||busy)return;busy=true;const content=dialog.querySelector('[data-balance-content]');content.innerHTML='<div class="skeleton"></div>';
  try{const data=await loadPartnerBalance(api,projectId,partnerId,current);if(current())content.innerHTML=markup(data);}
  catch(error){if(current()){content.innerHTML='<p role="alert"></p><button type="button" data-retry-partner-balance>إعادة المحاولة</button>';content.querySelector('[role=alert]').textContent=error.message;content.querySelector('button').onclick=load;}}
  finally{busy=false;}
 };
 load();return dialog;
}
