import {escape,money} from './ui.js';
import {salePriceEdit,salePricePreview} from './sale-price-edit.js';

export function openSalePriceEdit({line,mode,owner,isCurrent=()=>true,onApply,onClose}){
 if(mode!=='owner')throw Error('المشاركة للمشاهدة فقط');
 if(!owner?.isConnected||!owner.open||!isCurrent()||document.querySelector('dialog.sale-price-edit'))return;
 const model=salePriceEdit(line),dialog=document.createElement('dialog');dialog.className='sale-price-edit';dialog.setAttribute('aria-label','تعديل سعر البيع');
 dialog.innerHTML=`<h2>تعديل سعر البيع</h2><h3>${escape(model.name)}</h3><p class="muted small">سيُطبّق هذا السعر على هذه المبيعة فقط ولن يغيّر سعر الصنف في البضاعة.</p><form novalidate><label>${escape(model.priceTitle)}<input name="price" type="number" min="0" step="0.0001" inputmode="decimal" value="${escape(model.price)}"></label><label>إجمالي سعر الكمية<input name="total" type="number" min="0" step="0.01" inputmode="decimal" placeholder="أدخل إجمالي سعر الكمية"></label><p class="muted small">اختياري — استخدمه للعروض مثل 3 قطع بـ 10. عند إدخال إجمالي أكبر من صفر سيُعتمد بدل سعر الوحدة.</p><output data-price-preview aria-live="polite"></output><p class="price-warning" data-editor-cost-warning hidden>تنبيه: سعر البيع أقل من تكلفة الشراء (${money(model.cost,4)}). ستُسجّل هذه الكمية بخسارة.</p><p role="alert"></p><div class="actions"><button type="submit" class="primary">حفظ السعر</button><button type="button" data-cancel-price>إلغاء</button></div></form>`;
 owner.append(dialog);dialog.showModal();let ended=false;
 const form=dialog.querySelector('form'),error=form.querySelector('[role=alert]'),preview=form.querySelector('output'),warning=form.querySelector('[data-editor-cost-warning]');
 const current=()=>!ended&&dialog.isConnected&&dialog.open&&owner.isConnected&&owner.open&&isCurrent();
 const finish=()=>{if(ended)return;ended=true;observer.disconnect();dialog.remove();onClose?.();};
 const value=()=>{if(form.elements.total.validity.badInput)throw Error('أدخل إجماليًا صحيحًا أو اتركه فارغًا');return salePricePreview(model,{price:form.elements.price.value,total:form.elements.total.value});};
 const update=()=>{
  if(!current())return;
  try{const next=value();error.textContent='';warning.hidden=!next.belowCost;preview.textContent=`سعر الوحدة: ${money(next.price,4)} • إجمالي الكمية: ${money(next.total,2)}`;return next;}
  catch(failure){error.textContent=failure.message;warning.hidden=true;preview.textContent='إجمالي الكمية: —';return null;}
 };
 const observer=new MutationObserver(()=>{if(!current())finish();});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 for(const input of [form.elements.price,form.elements.total]){input.oninput=update;input.onfocus=()=>input.select();}
 form.querySelector('[data-cancel-price]').onclick=finish;dialog.onclose=finish;
 dialog.oncancel=event=>{event.preventDefault();event.stopPropagation();finish();};
 form.onsubmit=event=>{event.preventDefault();event.stopPropagation();if(!current())return;const next=update();if(!next)return;try{onApply(next);finish();}catch(failure){if(current())error.textContent=failure?.message||'تعذر تعديل السعر';}};
 update();return dialog;
}
