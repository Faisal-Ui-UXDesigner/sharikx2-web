import {escape,timestamp,money} from './ui.js';
import {currencySymbol} from './currency.js';
import {ownerApprovalHistory,ownerApprovalText} from './owner-approval-history.js';
import {ownerApprovalWorkbook} from './owner-approval-workbook.js';

export function openOwnerApprovals({owner,state,project,isCurrent=()=>true}){
 if(!owner.isConnected||!isCurrent()||owner.querySelector('.owner-approvals-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='owner-approvals-dialog';
 let ended=false,busy=false,selected=null,list;
 const current=()=>!ended&&owner.isConnected&&dialog.isConnected&&isCurrent();
 const observer=new MutationObserver(()=>{if(!current())close();});
 const close=()=>{if(ended)return;ended=true;observer.disconnect();dialog.remove();};
 const error=message=>{const node=dialog.querySelector('[role=alert]');if(node)node.textContent=message;};
 function draw(){
  if(!current())return;
  dialog.innerHTML='<header><h2>سجل الاعتمادات وتصدير التقرير</h2><button type="button" data-close aria-label="إغلاق">×</button></header><div data-approval-body></div><p role="alert"></p><footer data-approval-actions></footer>';
  dialog.querySelector('[data-close]').onclick=close;
  const body=dialog.querySelector('[data-approval-body]'),actions=dialog.querySelector('[data-approval-actions]');
  if(selected===null){
   try{list=ownerApprovalHistory(state,project.id);}
   catch(value){error(value.message);return;}
   body.innerHTML=list.map((row,index)=>`<button class="outline owner-approval-entry" data-approval-index="${index}">اعتماد · ${escape(timestamp(row.at))}</button>`).join('')||'<p>لا توجد اعتمادات مسجلة بعد.</p>';
   body.querySelectorAll('[data-approval-index]').forEach(button=>button.onclick=()=>{if(current()&&!busy){selected=list[Number(button.dataset.approvalIndex)];draw();}});
   return;
  }
  const row=(label,value)=>`<div class="op-row"><span>${escape(label)}</span><b>${escape(value)}</b></div>`;
  body.innerHTML=`<h3>تفاصيل الاعتماد المحفوظة</h3><section class="op-card">${row('تاريخ الاعتماد',timestamp(selected.at))}${row('الحسابات حتى',selected.cutoff===null?'غير محفوظ':timestamp(selected.cutoff))}</section>${selected.retained===null?'':`<section class="op-card">${row('حصة المحل المتجمعة',money(selected.retained,2))}</section>`}${selected.partners.map(partner=>`<section class="op-card"><h3>${escape(partner.name)}</h3>${partner.values.map(value=>row(value.label,money(value.amount,2))).join('')}</section>`).join('')}<p class="muted">هذه الأرقام محفوظة وقت الاعتماد، وليست الأرصدة الحالية. تنزيل الملف لا ينشئ اعتمادًا أو حركة مالية.</p>`;
  actions.innerHTML='<button type="button" class="primary" data-export-approval>تصدير ملف Excel</button><button type="button" class="outline" data-share-approval>مشاركة التقرير</button><button type="button" class="outline" data-approval-back>الرجوع للسجل</button>';
  actions.querySelector('[data-approval-back]').onclick=()=>{if(current()&&!busy){selected=null;draw();}};
  actions.querySelector('[data-export-approval]').onclick=()=>{
   if(!current()||busy)return;busy=true;error('');let url,link;
   try{
    const file=ownerApprovalWorkbook(selected.event,{projectId:project.id,currency:currencySymbol(project.currency)});
    url=URL.createObjectURL(new Blob([file.content],{type:file.type+';charset=utf-8'}));
    link=document.createElement('a');link.href=url;link.download=file.filename;dialog.append(link);link.click();
   }catch(value){error(value.message||'تعذر تجهيز ملف الاعتماد');}
   finally{link?.remove();if(url)setTimeout(()=>URL.revokeObjectURL(url),2000);busy=false;}
  };
  actions.querySelector('[data-share-approval]').onclick=async()=>{
   if(!current()||busy)return;busy=true;error('');
   const button=actions.querySelector('[data-share-approval]');button.disabled=true;
   try{
    const text=ownerApprovalText(selected,currencySymbol(project.currency));
    if(typeof navigator.share==='function')await navigator.share({title:'اعتماد حسابات الفترة',text});
    else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);if(current())error('تم نسخ التقرير للمشاركة.');}
    else throw Error('المشاركة غير متاحة في هذا المتصفح؛ يمكنك تنزيل ملف Excel.');
   }catch(value){if(current()&&value?.name!=='AbortError')error('تعذرت المشاركة؛ يمكنك تنزيل ملف Excel.');}
   finally{busy=false;if(current())button.disabled=false;}
  };
 }
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',close);
 owner.append(dialog);dialog.showModal();observer.observe(document.documentElement,{childList:true,subtree:true});draw();return dialog;
}
