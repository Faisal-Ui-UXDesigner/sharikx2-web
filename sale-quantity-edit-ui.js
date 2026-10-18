import {escape,money} from './ui.js';
import {saleQuantityEdit,saleQuantityPreview} from './sale-quantity-edit.js';

export function openSaleQuantityEdit({line,mode,owner,isCurrent=()=>true,onApply,onClose}){
 if(mode!=='owner')throw Error('المشاركة للمشاهدة فقط');
 if(!owner?.isConnected||!isCurrent()||document.querySelector('dialog.sale-quantity-edit'))return;
 const model=saleQuantityEdit(line),dialog=document.createElement('dialog');
 dialog.className='sale-quantity-edit';dialog.setAttribute('aria-label','حاسبة الوزن والكمية');
 dialog.innerHTML=`<h2>حاسبة الوزن والكمية</h2><h3>${escape(model.name)}</h3><p class="sale-quantity-price">${model.priceTitle} الواحد: ${money(model.price,4)}</p><p class="muted small">المتوفر: <bdi dir="ltr">${escape(model.stock)}</bdi> ${escape(model.unit)}</p><form><label>الكمية بـ ${escape(model.unit)}<input name="quantity" type="number" min="0.001" step="0.001" max="${escape(model.stock)}" inputmode="decimal" value="${escape(model.quantity)}" required></label><output data-quantity-preview aria-live="polite"></output><div class="actions sale-quantity-choices">${model.choices.map(choice=>`<button type="button" data-edit-quick="${choice.quantity}">${choice.label} ${escape(model.unit)}</button>`).join('')}</div><p role="alert"></p><div class="actions"><button type="submit" class="primary">اعتماد الكمية</button><button type="button" data-cancel-quantity>إلغاء</button></div></form>`;
 owner.append(dialog);dialog.showModal();let ended=false;
 const form=dialog.querySelector('form'),input=form.elements.quantity,error=form.querySelector('[role=alert]'),preview=form.querySelector('output');
 const current=()=>!ended&&dialog.isConnected&&owner.isConnected&&isCurrent();
 const finish=()=>{if(ended)return;ended=true;observer.disconnect();dialog.remove();onClose?.();};
 const update=()=>{
  if(!current())return;
  try{const next=saleQuantityPreview(model,input.value);input.setCustomValidity('');error.textContent='';preview.textContent='سعر الكمية: '+money(next.total,2);}
  catch(failure){input.setCustomValidity(failure.message);error.textContent=failure.message;preview.textContent='سعر الكمية: —';}
 };
 const observer=new MutationObserver(()=>{if(!current())finish();});observer.observe(document.documentElement,{childList:true,subtree:true});
 input.oninput=update;input.onfocus=()=>input.select();
 form.querySelectorAll('[data-edit-quick]').forEach(button=>button.onclick=()=>{if(current()){input.value=button.dataset.editQuick;update();}});
 form.querySelector('[data-cancel-quantity]').onclick=finish;
 dialog.oncancel=event=>{event.preventDefault();event.stopPropagation();finish();};dialog.onclose=finish;
 form.onsubmit=event=>{
  event.preventDefault();event.stopPropagation();if(!current())return;
  update();if(!form.checkValidity()){form.reportValidity();return;}
  try{const next=saleQuantityPreview(model,input.value);onApply(next);finish();}
  catch(failure){if(current())error.textContent=failure?.message||'تعذر اعتماد الكمية';}
 };
 update();return dialog;
}
