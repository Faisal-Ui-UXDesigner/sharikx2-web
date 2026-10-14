import {escape,money} from './ui.js';
export function openSaleReview({review,mode,isCurrent=()=>true,onConfirm,onClose}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 if(!isCurrent()||document.querySelector('dialog.sale-review'))return;
 const dialog=document.createElement('dialog');dialog.className='sale-review';
 dialog.innerHTML=`<h2>مراجعة وتأكيد المبيعة</h2><div class="panel"><p>الزبون: ${escape(review.customerName)}</p>${review.customerPhone?`<p>رقم الجوال: ${escape(review.customerPhone)}</p>`:''}<p>حساب استلام المبلغ: <b>${escape(review.accountName)}</b></p></div>${review.lines.map(line=>`<article class="panel"><b>${escape(line.name)}</b><p>${line.quantity} ${escape(line.unit)} × ${money(line.price,4)}</p><p>إجمالي السطر: ${money(line.total,2)}</p></article>`).join('')}<div class="panel"><p>إجمالي الأندرويد: <b>${money(review.androidTotal,2)}</b></p><p>الإجمالي المتوقع من الخادم: <b>${money(review.serverTotal,2)}</b></p>${review.androidTotal!==review.serverTotal?'<p class="muted">يوجد فرق بسبب تقريب كل سطر في عقد الخادم الحالي.</p>':''}</div><p class="muted small">لا تُرسل المبيعة إلا عند الضغط على تأكيد الاستلام.</p><div class="actions"><button type="button" data-confirm-sale class="primary">تأكيد الاستلام وتسجيل المبيعة</button><button type="button" data-back-sale-review>رجوع للتعديل</button></div>`;
 document.body.append(dialog);dialog.showModal();let finished=false;
 const finish=()=>{if(finished)return false;finished=true;observer.disconnect();dialog.remove();onClose?.();return true;};
 const observer=new MutationObserver(()=>{if(!dialog.isConnected||!isCurrent())finish();});observer.observe(document.documentElement,{childList:true,subtree:true});
 dialog.querySelector('[data-back-sale-review]').onclick=finish;dialog.oncancel=event=>{event.preventDefault();finish();};dialog.onclose=finish;
 dialog.querySelector('[data-confirm-sale]').onclick=()=>{const allowed=dialog.isConnected&&isCurrent();if(finish()&&allowed)onConfirm(review);};
 return dialog;
}
