import {escape,expenseMoney,timestamp} from './ui.js';
import {editExpense,deleteExpense} from './expense-mutation.js';
import {mountReceiptAction} from './receipt-ui.js';
import {recordedReceiptPath} from './receipt.js';
import {openReceiptUpload,receiptUploadAction} from './receipt-upload-ui.js';

export function openExpenseDetails({item,api,projectId,mode,allowMutations,onSaved,storage=api?.storage,isCurrent=()=>true}){
 if(!item||!isCurrent()||document.querySelector('.expense-details-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='expense-details-dialog';dialog.setAttribute('aria-label','تفاصيل المصروف');
 dialog.innerHTML=`<h2>تفاصيل المصروف</h2><div class="panel row"><div><b>${escape(item.description)}</b><p>${['daily_wage','daily_wages'].includes(item.category)?'يوميات':'مصروف'}</p><small>${escape(timestamp(item.created_at||item.occurred_at))}</small></div><strong class="expense-amount">${expenseMoney(item.amount)}</strong></div><div class="panel row"><span>الدفع من</span><b>${escape(item.account?.name||'غير محدد')}</b></div><div data-expense-receipt></div><div class="actions">${mode==='owner'&&allowMutations?'<button data-edit>تعديل</button><button data-delete class="danger">حذف</button>':''}<button data-close class="primary">إغلاق</button></div>`;
 let ended=false,child=null;
 const current=()=>!ended&&dialog.isConnected&&dialog.open&&isCurrent();
 const close=()=>{if(ended||child?.isConnected)return;ended=true;observer.disconnect();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!current()){child?.remove();child=null;close();}});
 document.body.append(dialog);dialog.showModal();observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 dialog.querySelector('[data-close]').onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};dialog.addEventListener('close',close);
 const path=recordedReceiptPath(item,'expense'),host=dialog.querySelector('[data-expense-receipt]');
 if(path)mountReceiptAction(host,{api,projectId,kind:'expense',path,container:dialog,isCurrent:current});else host.textContent='لا توجد صورة مرفقة بهذا المصروف.';
 const target={projectId,kind:'expense',recordId:item.id},label=receiptUploadAction({mode,storage,existingValue:item.receipt_path,target});
 if(label){
  const attach=document.createElement('button');attach.type='button';attach.className='outline';attach.dataset.attachReceipt='';attach.textContent=label;host.append(attach);
  attach.onclick=()=>{
   if(!current()||child?.isConnected)return;dialog.querySelectorAll('button').forEach(button=>button.disabled=true);
   child=openReceiptUpload({api,target,mode,storage,owner:dialog,isCurrent:current,onClose:()=>{child=null;if(current())dialog.querySelectorAll('button').forEach(button=>button.disabled=false);},onLinked:()=>{const notify=current();close();if(notify)onSaved?.();}});
   if(!child)dialog.querySelectorAll('button').forEach(button=>button.disabled=false);
  };
 }
 const options={api,projectId,item,mode,onSaved:()=>{const notify=current();close();if(notify)onSaved?.();}};
 dialog.querySelector('[data-edit]')?.addEventListener('click',()=>{if(current())editExpense(options);});
 dialog.querySelector('[data-delete]')?.addEventListener('click',()=>{if(current())deleteExpense(options);});
 return dialog;
}
