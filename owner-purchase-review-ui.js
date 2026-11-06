import {escape,money} from './ui.js';
export function openOwnerPurchaseDebt({owner,values,amounts,supplierName,isCurrent,onConfirm,onClose}){
 if(!owner.isConnected||!isCurrent()||document.querySelector('.owner-purchase-debt'))return;
 const captured=structuredClone(values),dialog=document.createElement('dialog');dialog.className='owner-purchase-debt';
 dialog.setAttribute('aria-label','تسجيل الباقي دينًا للمورد؟');
 dialog.innerHTML=`<h2>تسجيل الباقي دينًا للمورد؟</h2><p>${escape(supplierName)}</p><div class="panel"><p>إجمالي الفاتورة: <b>${escape(money(amounts.total,2))}</b></p><p>المدفوع الآن: <b>${escape(money(amounts.paid,2))}</b></p><p>المتبقي قبل أي رصيد دائن: <b>${escape(money(amounts.debt,2))}</b></p></div><p>هل توافق على تسجيل الباقي دينًا للمورد؟</p><button type="button" class="primary" data-confirm-owner-debt>نعم، سجّل الدين واعتمد الفاتورة</button><button type="button" class="outline" data-back-owner-debt>رجوع للتعديل</button>`;
 let ended=false;const current=()=>!ended&&owner.isConnected&&dialog.isConnected&&isCurrent();
 const finish=(confirm=false)=>{if(ended)return;const valid=current();ended=true;observer.disconnect();dialog.remove();onClose?.();if(confirm&&valid)onConfirm(captured);};
 const observer=new MutationObserver(()=>{if(!current())finish();});
 dialog.querySelector('[data-confirm-owner-debt]').onclick=()=>finish(true);dialog.querySelector('[data-back-owner-debt]').onclick=()=>finish();
 dialog.oncancel=event=>{event.preventDefault();finish();};dialog.onclose=()=>finish();
 document.body.append(dialog);dialog.showModal();observer.observe(document.documentElement,{childList:true,subtree:true});return dialog;
}
