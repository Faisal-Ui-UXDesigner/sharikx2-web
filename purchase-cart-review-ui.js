import {purchaseCartReview,purchaseCartChange} from './purchase-cart-review.js';
import {escape,money} from './ui.js';

/** In-memory cart editing only. Caller owns invoice state and financial submission. */
export function openPurchaseCartReview({mode,products,getItems,onEdit,onDelete,isCurrent=()=>true,onClose}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 if(!isCurrent()||document.querySelector('dialog.purchase-cart-review'))return;
 purchaseCartReview(getItems(),products);
 const dialog=document.createElement('dialog');dialog.className='purchase-cart-review';document.body.append(dialog);dialog.showModal();let ended=false,editor=null;
 const current=()=>!ended&&dialog.isConnected&&isCurrent();
 const finish=()=>{if(ended)return false;ended=true;observer.disconnect();editor?.remove();dialog.remove();onClose?.();return true;};
 const observer=new MutationObserver(()=>{if(!current())finish();});observer.observe(document.documentElement,{childList:true,subtree:true});
 const render=()=>{
  if(!current())return;const sources=[...getItems()],view=purchaseCartReview(sources,products);
  dialog.innerHTML=`<h2>أصناف فاتورة الشراء</h2><p class="muted small">اضغط على الصنف لتعديل كميته وسعر شرائه. الحذف يزيل البند من هذه الفاتورة فقط.</p><div class="purchase-cart-lines">${view.lines.map(line=>`<article class="panel"><button type="button" class="outline purchase-cart-detail" data-edit-cart-line="${line.index}"><b>${escape(line.name)}</b><span>الكمية: ${line.quantity} · سعر شراء الوحدة: ${money(line.cost,2)}</span><span>إجمالي البند: ${money(line.total,2)}</span><small>اضغط للتعديل</small></button><button type="button" class="danger" data-delete-cart-line="${line.index}" aria-label="حذف بند ${escape(line.name)}">حذف البند</button></article>`).join('')||'<p class="muted">لا توجد أصناف مضافة بعد</p>'}</div><p data-cart-count>الأصناف: ${view.productCount}${view.lineCount!==view.productCount?` · البنود: ${view.lineCount}`:''}</p><p>إجمالي الفاتورة الدقيق: <b data-cart-review-total>${money(view.total,2)}</b></p><p role="alert"></p><button type="button" data-close-cart-review class="outline">رجوع للفاتورة</button>`;
  dialog.querySelector('[data-close-cart-review]').onclick=finish;
  dialog.querySelectorAll('[data-delete-cart-line]').forEach(button=>button.onclick=()=>{if(!current()||editor?.isConnected)return;const index=+button.dataset.deleteCartLine;try{onDelete(sources[index],index);render();}catch(error){dialog.querySelector('[role=alert]').textContent=error.message;}});
  dialog.querySelectorAll('[data-edit-cart-line]').forEach(button=>button.onclick=()=>{
   if(!current()||editor?.isConnected)return;const index=+button.dataset.editCartLine,line=view.lines[index],source=sources[index];editor=document.createElement('dialog');editor.className='purchase-cart-edit';editor.innerHTML=`<h2>تعديل صنف الفاتورة</h2><p>${escape(line.name)}</p><form><label>الكمية<input name="quantity" type="number" min="0.001" step="0.001" required value="${line.quantity}"></label><label>سعر شراء الوحدة<input name="cost" type="number" min="0" step="0.0001" required value="${line.cost}"></label><p class="muted small">سعر الوحدة محفوظ بدقته؛ يُقرّب إجمالي البند إلى منزلتين.</p><p role="alert"></p><div class="actions"><button type="submit" class="primary">حفظ التعديل</button><button type="button" data-cancel-cart-edit>إلغاء</button></div></form>`;document.body.append(editor);editor.showModal();
   const child=editor,form=child.querySelector('form');let saved=false;
   const closeEdit=()=>{child.remove();if(editor===child)editor=null;};child.querySelector('[data-cancel-cart-edit]').onclick=closeEdit;child.oncancel=event=>{event.preventDefault();closeEdit();};child.onclose=closeEdit;
   form.onsubmit=event=>{event.preventDefault();if(saved||!current()||!child.isConnected)return;try{if(!form.checkValidity()){form.reportValidity();return;}const values=purchaseCartChange(form.elements.quantity.value,form.elements.cost.value);onEdit(source,index,values);saved=true;closeEdit();render();}catch(error){form.querySelector('[role=alert]').textContent=error.message;}};
  });
 };
 dialog.oncancel=event=>{event.preventDefault();if(!editor?.isConnected)finish();};dialog.onclose=finish;render();return dialog;
}
