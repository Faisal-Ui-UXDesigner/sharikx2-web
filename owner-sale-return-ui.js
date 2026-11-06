import {escape,money} from './ui.js';
import {ownerReturnModel,ownerReturnValues,ownerReturnTotals,ownerReturnStep,ownerReturnQuantity} from './owner-sale-return.js';

export function openOwnerSaleReturn({sale,projectId,saleId,accounts,sheet,sheetError,onSubmit}){
 const model=ownerReturnModel(sale,projectId,saleId);
 const body=`<article class="op-card"><small class="muted">إجمالي المبيعة</small><p class="op-big">${escape(money(model.total,2))}</p></article><h3>الأصناف المراد إرجاعها</h3>${model.items.map(item=>`<article class="op-card"><b>${escape(item.name)}</b><p class="muted small">الكمية المباعة: ${escape(item.sold)} · سعر القطعة: ${escape(money(item.unit_price,2))}<br>المتاح للإرجاع الآن: ${escape(item.max)}</p><div class="owner-return-stepper" dir="ltr"><button type="button" class="outline" data-return-step="-1" data-item="${escape(item.id)}" aria-label="تقليل كمية ${escape(item.name)}">−</button><input name="ret-${escape(item.id)}" data-return-id="${escape(item.id)}" aria-label="كمية مرتجع ${escape(item.name)}" inputmode="decimal" value="0" ${item.max<=0?'disabled':''}><button type="button" class="outline" data-return-step="1" data-item="${escape(item.id)}" aria-label="زيادة كمية ${escape(item.name)}">+</button></div></article>`).join('')}<button type="button" class="outline" data-return-all>اختيار كامل الكمية المتاحة للإرجاع</button>${model.unpaid?'<p class="op-banner">هذه مبيعة بالدين. الإرجاع سيخفض دين الزبون ويعيد الكمية للمخزون، دون رد مبلغ من أي حساب.</p>':`<label class="op-field">حساب رد المبلغ<select name="account">${accounts.map(account=>`<option value="${escape(account.id)}">${escape(account.name)}</option>`).join('')}</select></label>`}<label class="op-field">السبب (اختياري)<input name="reason"></label><article class="op-card" aria-live="polite"><p>قيمة المرتجع: <b class="negative" data-return-refund></b></p><p>قيمة المبيعة بعد المرتجع: <b data-return-after></b></p><small class="muted">معاينة قبل التأكيد؛ القيم النهائية واعتماد المخزون والدين من الخادم.</small></article>`;
 const d=sheet(`مرتجع جزئي · المبيعة ${sale.sale_number??''}`,body,[['تأكيد المرتجع',()=>{
  try{onSubmit(ownerReturnValues(model,selection(),d.querySelector('[name=account]')?.value,accounts,d.querySelector('[name=reason]').value));}
  catch(error){sheetError(d,error.message);}
 }],['إلغاء',()=>{d.close();}]]);
 const inputs=new Map([...d.querySelectorAll('[data-return-id]')].map(input=>[input.dataset.returnId,input]));
 function selection(){return model.items.flatMap(item=>{const raw=inputs.get(item.id).value.trim(),quantity=ownerReturnQuantity(raw||'0');if(quantity>item.max)throw Error('الكمية أكثر من المتاح للإرجاع');return quantity>0?[{sale_item_id:item.id,quantity}]:[];});}
 function redraw(){try{
  const selected=new Map(selection().map(row=>[row.sale_item_id,row.quantity]));
  const totals=ownerReturnTotals(model.items.map(item=>({...item,quantity:selected.get(item.id)||0})),model.total);
  d.querySelector('[data-return-refund]').textContent=money(totals.refund,2);d.querySelector('[data-return-after]').textContent=money(totals.remaining,2);
  d.querySelector('[data-sheet-error]').hidden=true;
 }catch(error){d.querySelector('[data-return-refund]').textContent='—';d.querySelector('[data-return-after]').textContent='—';sheetError(d,error.message);}}
 for(const input of inputs.values())input.addEventListener('input',redraw);
 d.querySelectorAll('[data-return-step]').forEach(button=>{
  const item=model.items.find(row=>row.id===button.dataset.item);button.disabled=item.max<=0;
  button.onclick=()=>{try{const input=inputs.get(item.id);input.value=ownerReturnStep(ownerReturnQuantity(input.value||'0'),Number(button.dataset.returnStep),item.max);redraw();}catch(error){sheetError(d,error.message);}};
 });
 d.querySelector('[data-return-all]').onclick=()=>{for(const item of model.items)inputs.get(item.id).value=item.max;redraw();};
 d.querySelector('[data-sheet-action="0"]').disabled=!model.items.some(item=>item.max>0);
 redraw();return d;
}
