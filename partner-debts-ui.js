import {escape,money} from './ui.js';
import {partnerDebtDirectory} from './partner-debts.js';
import {readPartnerDebtDelete} from './partner-debt-delete.js';
import {openPartnerDebtDelete} from './partner-debt-delete-ui.js';
import {readPartnerDebtCreate} from './partner-debt-create.js';
import {openPartnerDebtCreate} from './partner-debt-create-ui.js';
import {partnerFinanceKey} from './partner-finance-operation.js';

export function openPartnerDebts({api,storage,snapshot,projectId,mode,isCurrent=()=>true,onSaved}){
 if(typeof projectId!=='string'||!projectId.trim())throw new Error('هوية المشروع غير صالحة');
 if(!isCurrent()||document.querySelector('.partner-debts-dialog'))return;
 const groups=partnerDebtDirectory(snapshot),dialog=document.createElement('dialog');dialog.className='partner-debts-dialog';
 dialog.innerHTML=`<h2>ذمم الشركاء</h2><p class="muted">${mode==='owner'?'عرض السجل فقط في هذه المرحلة؛ تسجيل وحذف الذمم غير متاحين بعد.':'يمكنك مشاهدة الذمم فقط. تسجيل الذمة متاح لمنشئ المشروع.'}</p><h3>سجل الذمم</h3>${groups.map(group=>`<section class="panel" data-debt-partner><h3>${escape(group.name)}</h3><p>إجمالي الذمة المتبقية: <b data-partner-outstanding class="${group.outstanding>0?'balance-gold':'settlement-profit'}">${money(group.outstanding,2)}</b></p>${group.items.map(item=>`<article class="panel" data-partner-debt><b>${escape(item.description)}</b>${item.accountName?`<p class="muted">من حساب: ${escape(item.accountName)}</p>`:''}<p class="${item.status==='settled'?'settlement-profit':'muted'}">${escape(item.date)} • ${item.status==='settled'?'تمت التسوية':item.status==='partial'?'متبقي '+money(item.remaining,2):'معلقة'}</p><p>قيمة الذمة: <b data-debt-principal>${money(item.principal,2)}</b></p><p>المسدّد: ${money(item.settled,2)}</p></article>`).join('')}</section>`).join('')||'<p class="muted">لا توجد ذمم مالية مسجلة على الشركاء.</p>'}<button type="button" class="primary" data-close-partner-debts>إغلاق</button>`;
 document.body.append(dialog);dialog.showModal();let ended=false;
 const alert=document.createElement('p');alert.setAttribute('role','alert');dialog.querySelector('h2').after(alert);
 if(mode==='owner'&&api){
  dialog.querySelector('p.muted').textContent='يمكن تسجيل ذمة جديدة أو حذف الذمم غير المسدّدة بعد المراجعة.';
  let pending,pendingCreate,blocked=false;
  try{storage=storage??window.sessionStorage;pending=readPartnerDebtDelete(storage,projectId);pendingCreate=readPartnerDebtCreate(storage,projectId);if(storage.getItem(partnerFinanceKey('withdrawal',projectId))!==null){blocked=true;alert.textContent='يوجد طلب سحب أرباح سابق؛ تحقّق منه من شاشة الشركاء أولًا';}}catch(error){blocked=true;alert.textContent=error.message;}
  const open=debtId=>{if(ended||!dialog.isConnected||!isCurrent())return;try{openPartnerDebtDelete({api,storage,projectId,snapshot,debtId,mode,isCurrent:()=>dialog.isConnected&&isCurrent(),onSaved:()=>{close();onSaved?.();}});}catch(error){alert.textContent=error.message;}};
  if(!blocked&&pending){const verify=document.createElement('button');verify.type='button';verify.textContent='التحقق من حذف ذمة سابق';verify.dataset.verifyDebtDelete='';verify.onclick=()=>open(pending.debtId);alert.after(verify);}
  if(!blocked&&(pendingCreate||!pending)){const button=document.createElement('button');button.type='button';button.textContent=pendingCreate?'التحقق من تسجيل ذمة سابق':'تسجيل ذمة على شريك';button.dataset.createPartnerDebt='';button.onclick=()=>{if(ended||!dialog.isConnected||!isCurrent())return;try{openPartnerDebtCreate({api,storage,projectId,mode,isCurrent:()=>dialog.isConnected&&isCurrent(),onSaved:()=>{close();onSaved?.();}});}catch(error){alert.textContent=error.message;}};alert.after(button);}
  if(!blocked&&!pending&&!pendingCreate){const articles=dialog.querySelectorAll('[data-partner-debt]');let index=0;
   for(const group of groups)for(const item of group.items){const article=articles[index++];if(item.settled>0||!item.id)continue;const button=document.createElement('button');button.type='button';button.textContent='حذف الذمة';button.dataset.deletePartnerDebt=item.id;button.onclick=()=>open(item.id);article.append(button);}
  }
 }
 const close=()=>{if(ended)return;ended=true;observer.disconnect();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!dialog.isConnected||!isCurrent())close();});observer.observe(document.documentElement,{subtree:true,childList:true});dialog.querySelector('[data-close-partner-debts]').onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=close;
 const heading=dialog.querySelector('h2');heading.tabIndex=-1;heading.focus({preventScroll:true});dialog.scrollTop=0;
 return dialog;
}
