import {escape,money} from './ui.js';

export function openSupplierPaymentReview({review,mode,isCurrent,onConfirm,onClose}){
 if(mode!=='owner')throw new Error('المشاركة للمشاهدة فقط');
 if(!isCurrent())return;
 const dialog=document.createElement('dialog');dialog.className='supplier-payment-review';
 dialog.innerHTML=`<h2>تأكيد دفعة المورد</h2><div class="panel"><p>المورد: <b>${escape(review.name)}</b></p><p>الدين قبل الدفعة: <b>${money(review.debt,2)}</b></p><p>قيمة الدفعة: <b>${money(review.amount,2)}</b></p><p>المتبقي بعد الدفعة: <b>${money(review.remaining,2)}</b></p></div><h3>الحسابات</h3>${review.sources.map(source=>`<div class="panel"><b>${escape(source.name)}</b><p>قيمة الدفعة: ${money(source.amount,2)}</p><p>المتبقي في الحساب: ${money(source.remaining,2)}</p></div>`).join('')}${review.note?`<p data-review-note>${escape(review.note)}</p>`:''}<p class="muted">فاتورة السداد: غير مرفقة</p><div class="actions"><button type="button" data-confirm-payment class="primary">تأكيد السداد</button><button type="button" data-back-payment class="outline">رجوع</button></div>`;
 document.body.append(dialog);dialog.showModal();
 let finished=false;
 const finish=()=>{if(finished)return false;finished=true;dialog.remove();onClose?.();return true;};
 dialog.querySelector('[data-back-payment]').onclick=finish;
 dialog.addEventListener('cancel',event=>{event.preventDefault();finish();});
 dialog.querySelector('[data-confirm-payment]').onclick=()=>{const allowed=isCurrent()&&dialog.isConnected;if(finish()&&allowed)onConfirm(review.payload);};
 return dialog;
}
