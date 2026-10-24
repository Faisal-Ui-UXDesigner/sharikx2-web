import {escape,money} from './ui.js';
import {partnerHistory} from './partner-history.js';

export function openPartnerHistory({snapshot,partnerId,projectId,isCurrent=()=>true}){
 if(typeof projectId!=='string'||!projectId.trim())throw new Error('هوية المشروع غير صالحة');
 if(!isCurrent()||document.querySelector('dialog.partner-history-dialog'))return;
 const view=partnerHistory(snapshot,partnerId);
 const dialog=document.createElement('dialog');dialog.className='partner-history-dialog';
 dialog.innerHTML=`<h2>سجل مسحوبات ${escape(view.name)}</h2><section class="panel"><p data-history-withdrawn>إجمالي الأرباح المسحوبة: ${money(view.withdrawn,2)}</p><p data-history-settled>إجمالي الذمم المالية المسددة: ${money(view.settledDebt,2)}</p></section><section>${view.items.map(item=>`<article class="panel row" data-history-item><div><b>${escape(item.label)}</b><p class="muted">${escape(item.recordedAt+(item.description?' • '+item.description:''))}</p></div><b>${money(item.amount,2)}</b></article>`).join('')||'<p class="muted">لا توجد مسحوبات أو تسويات مسجلة.</p>'}</section><button type="button" class="primary" data-close-partner-history>إغلاق</button>`;
 document.body.append(dialog);dialog.showModal();
 let ended=false;
 const close=()=>{if(ended)return;ended=true;observer.disconnect();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!dialog.isConnected||!isCurrent())close();});
 observer.observe(document.documentElement,{subtree:true,childList:true});
 dialog.querySelector('[data-close-partner-history]').onclick=close;
 dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=close;
 return dialog;
}
