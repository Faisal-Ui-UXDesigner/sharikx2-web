import {capturePurchaseDebtReview} from './purchase-debt-review.js';
import {escape,money} from './ui.js';

export function purchaseDebtReviewMarkup(review){
 if(!review?.amounts||!review.payload||!Object.isFrozen(review)||!Object.isFrozen(review.amounts)||!Object.isFrozen(review.payload))throw new Error('لقطة مراجعة الفاتورة غير صالحة');
 const {total,paid,debt}=review.amounts;
 return `<h2>تسجيل الباقي ديناً للمورد؟</h2><div class="purchase-debt-review-summary">
  <p>إجمالي الفاتورة: <b data-purchase-review-total>${escape(money(total,2))}</b></p>
  <p>المدفوع الآن للمورد: <b data-purchase-review-paid>${escape(money(paid,2))}</b></p>
  <p>المتبقي دين للمورد: <b data-purchase-review-debt>${escape(money(debt,2))}</b></p>
 </div><p>هل تريد اعتماد الفاتورة وإضافة الباقي إلى ديون المورد؟</p>
 <div class="actions"><button type="button" data-confirm-purchase class="primary">نعم، سجّل الدين</button><button type="button" data-back-purchase>رجوع للتعديل</button></div>`;
}

/** One ephemeral confirmation. Host owns locking, journaling, dispatch and recovery. */
export function openPurchaseDebtConfirmation({owner,mode,projectId,payload,isCurrent=()=>true,onClose,onConfirm,returnFocus}){
 if(mode!=='owner')throw new Error('المشاركة للمشاهدة فقط');
 if(!owner?.isConnected||!owner.open||!isCurrent()||document.querySelector('dialog.purchase-debt-confirmation'))return;
 const review=capturePurchaseDebtReview(payload,projectId),dialog=document.createElement('dialog');
 dialog.className='purchase-debt-confirmation';dialog.setAttribute('aria-label','تسجيل الباقي ديناً للمورد؟');
 dialog.innerHTML=purchaseDebtReviewMarkup(review);let ended=false;
 const contextCurrent=()=>owner.isConnected&&owner.open&&isCurrent();
 const current=()=>!ended&&contextCurrent()&&dialog.isConnected&&dialog.open;
 const finish=(confirm=false)=>{
  if(ended)return false;
  const allowed=current(),restore=contextCurrent();ended=true;observer.disconnect();dialog.remove();onClose?.();
  if(confirm&&allowed)onConfirm?.(review.payload);
  else if(restore&&returnFocus?.isConnected&&!returnFocus.disabled)returnFocus.focus();
  return true;
 };
 const observer=new MutationObserver(()=>{if(!current())finish();});
 dialog.querySelector('[data-back-purchase]').onclick=()=>finish();
 dialog.querySelector('[data-confirm-purchase]').onclick=()=>finish(true);
 dialog.oncancel=event=>{event.preventDefault();finish();};dialog.onclose=()=>finish();
 try{
  document.body.append(dialog);dialog.showModal();
  if(!current()){finish();return;}
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 }catch(error){ended=true;observer.disconnect();dialog.remove();throw error;}
 return dialog;
}
