import {escape,money} from './ui.js';
import {createOperation} from './operations.js';
import {returnPayload,unpaidCreditSale,returnItems,returnTotals,stepReturnQuantity,canReturnSale,validateReturnSelection,returnJournalPayload,verifyReturnResult,expectedReturnRefund} from './return.js';

export function openReturn({api,projectId,mode,sale,storage,onSaved,isCurrent=()=>true}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 if(!projectId||!sale?.id)throw new Error('بيانات المبيعة غير مكتملة');
 if(!isCurrent())return;
 const key=`sharikx2-pending-return:${projectId}:${sale.id}`;
 if([...document.querySelectorAll('dialog[data-return-key]')].some(dialog=>dialog.dataset.returnKey===key))return;
 const dialog=document.createElement('dialog');dialog.className='return-dialog';dialog.dataset.returnKey=key;
 dialog.innerHTML='<h2>مرتجع جزئي</h2><div class="body"><div class="skeleton"></div></div><button data-close class="outline">إلغاء</button>';
 document.body.append(dialog);dialog.showModal();
 let busy=false,operation=null,pendingPayload=null,blocked=false,expectedRefund=null;
 const current=()=>dialog.isConnected&&isCurrent(),close=()=>{if(!busy)dialog.remove();};
 dialog.querySelector('[data-close]').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 try{const saved=JSON.parse(storage?.getItem(key)||'null');if(saved){pendingPayload=returnJournalPayload(saved,projectId,sale.id);if(saved.expectedRefund!==undefined){if(!Number.isFinite(saved.expectedRefund)||saved.expectedRefund<=0)throw new Error('INVALID_DRAFT');expectedRefund=saved.expectedRefund;}operation=createOperation('return_sharikx2_sale_web_v1',pendingPayload,saved.requestId);}}catch{blocked=true;}
 const render=(items,accounts)=>{
  if(!current())return;
  const credit=pendingPayload?pendingPayload.p_refund_account_id===null:unpaidCreditSale(sale);
  dialog.querySelector('.body').innerHTML=`<form><fieldset><p>إجمالي المبيعة الحالي: ${money(sale.total,2)}</p><div data-items>${items.map((item,index)=>`<article class="panel"><b>${escape(item.product_name||item.name||'صنف')}</b><p class="muted">${pendingPayload?`الكمية في المرتجع المعلّق: ${escape(item.quantity)}`:`المباع ${escape(item.sold)} · المتاح للإرجاع ${escape(item.max)} · سعر الوحدة ${money(item.unit_price,2)}`}</p><div class="row"><button type="button" data-minus="${index}" aria-label="تقليل كمية المرتجع">−</button><input data-qty="${index}" aria-label="كمية مرتجع ${escape(item.product_name||item.name||'صنف')}" type="number" min="0" max="${escape(item.max)}" step="any" value="${escape(item.quantity)}" ${item.max?'':'disabled'}><button type="button" data-plus="${index}" aria-label="زيادة كمية المرتجع" ${item.max?'':'disabled'}>+</button></div></article>`).join('')}</div>${credit?'<p class="muted">هذه مبيعة بالدين. سيخفض المرتجع دين الزبون ويعيد الكمية للمخزون دون رد مبلغ من حساب.</p>':`<label>حساب رد المبلغ<select name="account" required>${accounts.map(account=>`<option value="${escape(account.id)}">${escape(account.name)}</option>`).join('')}</select></label>`}<label>السبب اختياري<textarea name="reason"></textarea></label></fieldset><p>قيمة المرتجع: <b data-total></b></p><p data-after-label>قيمة المبيعة بعد المرتجع: <b data-after></b></p><p role="alert"></p><button type="submit" class="primary">تأكيد المرتجع</button></form>`;
  const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),error=form.querySelector('[role=alert]'),submit=form.querySelector('[type=submit]');
  const totals=()=>{const total=returnTotals(items,sale.total);form.querySelector('[data-total]').textContent=pendingPayload?(expectedRefund!==null?money(expectedRefund,2):total.refund>0?money(total.refund,2):'غير متاح — الطلب محفوظ'):money(total.refund,2);form.querySelector('[data-after-label]').hidden=!!pendingPayload;form.querySelector('[data-after]').textContent=money(total.remaining,2);};
  const setQuantity=(index,value)=>{items[index].quantity=value;form.querySelector(`[data-qty="${index}"]`).value=value;totals();};
  form.querySelectorAll('[data-qty]').forEach(input=>input.oninput=()=>setQuantity(+input.dataset.qty,Math.max(0,Math.min(items[+input.dataset.qty].max,Number(input.value)||0))));
  form.querySelectorAll('[data-plus],[data-minus]').forEach(button=>button.onclick=()=>{const index=+(button.dataset.plus??button.dataset.minus);setQuantity(index,stepReturnQuantity(items[index].quantity,button.dataset.plus!==undefined?1:-1,items[index].max));});
  totals();
  if(pendingPayload){fields.disabled=true;form.elements.reason.value=pendingPayload.p_reason||'';if(!credit)form.elements.account.value=pendingPayload.p_refund_account_id;submit.textContent='التحقق من المرتجع السابق';error.textContent='توجد عملية معلّقة؛ سنُعيد نفس الطلب دون إنشاء مرتجع آخر.';}
  if(blocked){fields.disabled=true;submit.disabled=true;error.textContent='تعذر قراءة المرتجع السابق؛ تحقق من سجل المبيعة قبل تسجيل بديل.';}
  form.onsubmit=async event=>{
   event.preventDefault();if(busy||blocked||!current())return;
   let notify=false;
   try{
    if(!operation){
     if(!canReturnSale(sale))throw new Error('المبيعة غير قابلة للإرجاع');
     const selected=items.filter(item=>item.quantity>0).map(item=>({sale_item_id:item.id,quantity:item.quantity}));
     const payload=returnPayload(projectId,sale.id,selected,credit?null:form.elements.account.value,form.elements.reason.value.trim(),{unpaidCredit:credit});
     validateReturnSelection(payload,items,accounts);
     if(!storage)throw new Error('تخزين الجلسة مطلوب لحماية إعادة المحاولة');
     const amount=expectedReturnRefund(payload,items);if(!Number.isFinite(amount)||amount<=0)throw new Error('قيمة المرتجع يجب أن تكون موجبة');
     const candidate=createOperation('return_sharikx2_sale_web_v1',payload);storage.setItem(key,JSON.stringify({payload,requestId:candidate.requestId,expectedRefund:amount}));expectedRefund=amount;pendingPayload=payload;operation=candidate;
    }
    busy=true;fields.disabled=true;submit.disabled=true;dialog.querySelector('[data-close]').disabled=true;submit.textContent='جارٍ اعتماد المرتجع…';error.textContent='';
    const result=await operation.run(api);
    try{verifyReturnResult(result,expectedRefund);}catch(error){operation=createOperation('return_sharikx2_sale_web_v1',pendingPayload,operation.requestId);throw error;}
    storage.removeItem(key);notify=current();dialog.remove();
   }catch(errorValue){error.textContent=(errorValue.message||'تعذر تسجيل المرتجع')+(operation?' — أعد التحقق بنفس الطلب بأمان':'');}
   finally{busy=false;submit.disabled=false;dialog.querySelector('[data-close]').disabled=false;submit.textContent=operation?'التحقق وإعادة المحاولة':'تأكيد المرتجع';}
   if(notify)onSaved?.();
  };
 };
 if(blocked)render([],[]);
 else if(pendingPayload){
  // Server stock, sale status and prior returns may already include this request.
  const items=pendingPayload.p_items.map(selected=>{const source=(sale.items||[]).find(item=>item.id===selected.sale_item_id)||{};return {...source,id:selected.sale_item_id,sold:source.quantity_pieces??source.quantity??selected.quantity,max:selected.quantity,quantity:selected.quantity,unit_price:Number(source.unit_price??source.unit_sale_price)||0};});
  render(items,pendingPayload.p_refund_account_id?[{id:pendingPayload.p_refund_account_id,name:'الحساب المحدد في المرتجع السابق'}]:[]);
 }else{
  const load=()=>Promise.resolve().then(()=>{if(!canReturnSale(sale))throw new Error('المبيعة غير قابلة للإرجاع');return api.summary(projectId);}).then(summary=>render(returnItems(sale),summary.accounts||[])).catch(error=>{
   if(!current())return;dialog.querySelector('.body').innerHTML='<p role="alert"></p><button type="button" data-retry-return>إعادة المحاولة</button>';dialog.querySelector('[role=alert]').textContent=error.message;dialog.querySelector('[data-retry-return]').onclick=()=>{dialog.querySelector('[data-retry-return]').disabled=true;load();};
  });load();
 }
 return dialog;
}
