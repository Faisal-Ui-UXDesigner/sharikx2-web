import {escape,money} from './ui.js';
import {createOperation} from './operations.js';
import {bindSaleCustomers} from './sale-customers.js';
import {categorySet,ordered,display,INVENTORY_CATEGORY_OTHER} from './inventory-category.js';
import {openBarcodeScanner} from './barcode-scanner.js';
import {loadSaleCatalog} from './sale-catalog.js';
import {isMeasuredUnit,quantityChoices,setSaleQuantity,changeSaleQuantity,newSaleLine,canAddSaleProduct} from './sale-quantity.js';
import {saleUnitPrice,salePriceForTotal,saleLineTotal,salePriceTotals} from './sale-pricing.js';
import {validatePendingSale,confirmSaleResult,saleExpectedTotal} from './sale-recovery.js';
import {saveSaleDraft,removeSaleDraft,restoreSaleDraft} from './sale-drafts.js';
import {showSaleDrafts} from './sale-drafts-ui.js';
import {createSaleReview} from './sale-review.js';
import {openSaleReview} from './sale-review-ui.js';
import {validPhone} from './phone.js';
export function cartTotal(cart){return salePriceTotals(cart).subtotal;}
function validDebtCustomer(customer){return !!customer?.id&&String(customer.name||'').trim().length>=2&&validPhone(customer.phone);}
export function filterSaleProducts(products,query='',category='الكل'){
 const q=String(query||'').trim().toLocaleLowerCase('ar');
 return (Array.isArray(products)?products:[]).filter(product=>
  (category==='الكل'||String(product?.category||'').trim().localeCompare(String(category||''),'ar',{sensitivity:'base'})===0) &&
  `${product?.name||''} ${product?.barcode||''}`.toLocaleLowerCase('ar').includes(q));
}
export function salePayload(projectId,cart,accountId,accounts,{asDebt=false,customer=null}={}){
 if(!cart.length)throw new Error('أضف صنفًا واحدًا على الأقل');
 if(!asDebt&&!accounts.some(a=>a.id===accountId))throw new Error('اختر حساب استلام المبلغ');
 if(asDebt&&!validDebtCustomer(customer))throw new Error('البيع بالدين يتطلب زبونًا باسمه ورقم جواله المكوّن من 10 أرقام');
 const ids=new Set();
 const items=cart.map(x=>{
  if(ids.has(x.id))throw new Error('الصنف مكرر');ids.add(x.id);
  if(!Number.isFinite(x.quantity)||x.quantity<=0||x.quantity>Number(x.stock))throw new Error('الكمية غير صحيحة أو أكبر من المخزون');
  const price=saleUnitPrice(x.price);
  return {product_id:x.id,quantity:x.quantity,unit_sale_price:price};
 });
 // Receiving funds never checks available balance: zero balance is valid.
 return {p_project_id:projectId,p_items:items,p_discount:0,p_customer_id:customer?.id||null,p_account_id:asDebt?null:accountId,p_as_debt:asDebt};
}
export async function openSale({api,projectId,mode,storage,onSaved,initialCustomer=null,isCurrent=()=>true}){
 if(mode!=='owner')throw new Error('المشاركة للمشاهدة فقط');
 if(initialCustomer&&!validDebtCustomer(initialCustomer))throw new Error('أكمل اسم الزبون ورقم جواله الصحيح قبل البيع بالدين');
 if(!isCurrent())return;
 if(document.querySelector('dialog.sale-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='sale-dialog';dialog.innerHTML='<h2>مبيعة جديدة</h2><div class="body"><div class="skeleton"></div></div><button data-close class="outline">إلغاء</button>';document.body.append(dialog);dialog.showModal();
 let busy=false,reviewing=false,customerEditing=false,operation=null,cart=[],products=[],uncertain=false,blocked=false,selectedCategory='الكل';
 const journalKey=`sharikx2-pending-sale:${projectId}`;
 let closeAction=()=>{if(!busy)dialog.remove();};
 dialog.querySelector('[data-close]').onclick=()=>closeAction();dialog.oncancel=e=>{e.preventDefault();closeAction();};
 try{
  let pending=null,pendingError=null;try{const raw=storage?.getItem(journalKey),saved=raw===null||raw===undefined?null:JSON.parse(raw);if(saved!==null)pending=validatePendingSale(saved,projectId);}catch(e){pendingError=e;}
  const [catalog,summary]=pending||pendingError?[{products:[]},{accounts:[]}]:await Promise.all([loadSaleCatalog(api,projectId,()=>dialog.isConnected&&isCurrent()),api.summary(projectId)]);if(!dialog.isConnected||!isCurrent()){dialog.remove();return;}
  products=catalog.products;const accounts=summary.accounts||[];
  const pickerCategories=ordered([...categorySet({inventoryCategories:products.map(p=>p.category)}),INVENTORY_CATEGORY_OTHER]);
  dialog.querySelector('.body').innerHTML=`<section data-picker><label>بحث في جميع أصناف المشروع<input type="search" data-search placeholder="اسم الصنف أو الباركود"></label><div class="input-pair"><label>إدخال الباركود<input data-barcode-scan inputmode="numeric" autocomplete="off" placeholder="امسح أو اكتب الباركود ثم Enter"></label><button type="button" data-camera-scan class="outline">مسح بالكاميرا</button></div><div class="tabs" data-sale-categories><button type="button" class="primary" data-sale-category="الكل">الكل</button>${pickerCategories.map(x=>`<button type="button" data-sale-category="${escape(x)}">${escape(display({},x))}</button>`).join('')}</div><div class="product-picker"></div></section><form><fieldset><h2>أصناف المبيعة</h2><div data-cart></div><div class="panel row"><span>إجمالي المبيعة</span><strong data-total>0 ₪</strong></div><h2>طريقة استلام المبلغ</h2><p class="muted small">يضاف إليه مبلغ المبيعة — لا يُخصم من رصيده</p><div class="account-choices">${accounts.map(a=>`<label class="choice"><input type="radio" name="account" value="${escape(a.id)}" required><span>${escape(a.name)}</span></label>`).join('')}</div><p class="muted small">هذه المرحلة تدعم البيع المدفوع لزبون غير محدد. اختيار الزبون والبيع بالدين.</p></fieldset><p role="alert"></p><button class="primary" type="submit">مراجعة وتأكيد المبيعة</button></form>`;
  const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),error=form.querySelector('[role=alert]'),confirm=form.querySelector('[type=submit]'),picker=dialog.querySelector('[data-picker]');
  let draftId=pending?pending.draftId||null:crypto.randomUUID();
  confirm.before(form.querySelector('[data-total]').closest('.panel'));
  const customerBox=document.createElement('section');customerBox.innerHTML='<h2>معلومات الزبون</h2><label class="choice"><input type="checkbox" name="asDebt">بيع بالدين</label><p class="muted small">اختيار الزبون اختياري للمبيعة المدفوعة، وإلزامي للدين مع اسم ورقم جوال صحيح.</p><label>الزبون<select name="customer"><option value="">زبون غير محدد</option></select></label><button type="button" data-customers-more class="outline">تحميل الزبائن</button><p data-customer-status class="muted small"></p>';
  fields.append(customerBox);
  fields.querySelectorAll('p').forEach(p=>{if(p.textContent.includes('هذه المرحلة تدعم'))p.remove();});
  const customerSelect=form.elements.customer,debtInput=form.elements.asDebt,accountChoices=fields.querySelector('.account-choices');
  const customerEntry=bindSaleCustomers({api,projectId,container:customerBox,select:customerSelect,mode,storage,isCurrent:()=>dialog.isConnected&&isCurrent(),canEdit:()=>!busy&&!reviewing&&!uncertain&&!blocked,onError:e=>{error.textContent=e?.message||'';},onEditing:editing=>{customerEditing=editing;if(dialog.isConnected){fields.disabled=editing||!!operation||blocked;confirm.disabled=editing||blocked;picker.hidden=editing||!!operation||blocked;dialog.querySelector('[data-close]').disabled=editing;}}});
  const registerCustomer=customerEntry.register;
  const updatePayment=()=>{accountChoices.hidden=debtInput.checked;form.querySelectorAll('[name=account]').forEach(x=>x.required=!debtInput.checked);customerSelect.required=debtInput.checked;if(!operation)confirm.textContent=debtInput.checked?'تسجيل المبيعة كدين':'مراجعة وتأكيد المبيعة';};
  debtInput.onchange=()=>{if(!busy&&!reviewing&&!customerEditing&&!uncertain&&!blocked&&dialog.isConnected&&isCurrent())updatePayment();};
  const roundingNote=document.createElement('p');roundingNote.className='muted small';form.querySelector('[data-total]').closest('.panel').after(roundingNote);
  const totals=()=>{try{if(operation&&pending){form.querySelector('[data-total]').textContent=money(saleExpectedTotal(pending.payload),2);roundingNote.textContent='إجمالي الطلب المحفوظ للتحقق، وليس حسابًا جديدًا على المخزون الحالي.';return;}const total=salePriceTotals(cart);form.querySelector('[data-total]').textContent=money(total.subtotal,2);roundingNote.textContent=total.subtotal!==total.serverSubtotal?`تقدير الخادم بعد تقريب كل سطر: ${money(total.serverSubtotal,2)}؛ قد يختلف عن مجموع الأندرويد بسبب التقريب.`:'';}catch{form.querySelector('[data-total]').textContent='أكمل السعر والكمية';}};
  const drawCart=()=>{form.querySelector('[data-cart]').innerHTML=cart.length?cart.map(x=>`<article class="panel" data-line="${escape(x.id)}"><div class="row"><b>${escape(x.name)}</b><button type="button" data-remove="${escape(x.id)}">إزالة</button></div><p class="muted">${escape(x.unit||'قطعة')}</p><div class="actions"><button type="button" data-decrease="${escape(x.id)}" aria-label="إنقاص الكمية">−</button><button type="button" data-increase="${escape(x.id)}" aria-label="زيادة الكمية">+</button></div>${isMeasuredUnit(x.unit)?`<div class="actions">${quantityChoices(x.unit).map(choice=>`<button type="button" data-quick="${escape(x.id)}" data-value="${choice.quantity}" ${choice.quantity>Number(x.stock)?'disabled':''}>${choice.label}</button>`).join('')}</div>`:''}<div class="input-pair"><label>الكمية<input data-qty="${escape(x.id)}" type="number" inputmode="decimal" min="0.001" step="0.001" max="${escape(x.stock)}" value="${escape(x.quantity)}" required></label><label>سعر البيع<input data-price="${escape(x.id)}" type="number" inputmode="decimal" step="0.0001" min="0" value="${escape(x.price)}" required></label></div><label>إجمالي السطر (عرض خاص)<input data-line-total="${escape(x.id)}" type="number" min="0" step="0.01" inputmode="decimal" value="${saleLineTotal(x)}"></label><p class="price-warning" data-warning="${escape(x.id)}" ${x.price<x.cost?'':'hidden'}>تنبيه: سعر البيع أقل من تكلفة الشراء ${money(x.cost,2)}</p></article>`).join(''):'<p class="muted">لم تُضف أصنافًا بعد</p>';
   form.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{if(busy||reviewing||customerEditing||uncertain||blocked||!dialog.isConnected||!isCurrent())return;cart=cart.filter(x=>x.id!==b.dataset.remove);drawCart();});
   form.querySelectorAll('[data-qty],[data-price],[data-line-total]').forEach(input=>input.oninput=()=>{if(busy||reviewing||customerEditing||uncertain||blocked||!dialog.isConnected||!isCurrent())return;const id=input.dataset.qty||input.dataset.price||input.dataset.lineTotal,index=cart.findIndex(x=>x.id===id),item=cart[index];if(input.dataset.qty){try{cart[index]=setSaleQuantity(item,input.value);input.setCustomValidity('');error.textContent='';}catch(e){input.setCustomValidity(e.message);error.textContent=e.message;}}else{try{item.price=input.dataset.lineTotal?salePriceForTotal(input.value,item.quantity):saleUnitPrice(input.value);input.setCustomValidity('');error.textContent='';if(input.dataset.lineTotal)input.closest('[data-line]').querySelector('[data-price]').value=item.price;input.closest('[data-line]').querySelector('[data-warning]').hidden=item.price>=item.cost;}catch(e){input.setCustomValidity(e.message);error.textContent=e.message;}}if(!input.dataset.lineTotal)input.closest('[data-line]').querySelector('[data-line-total]').value=saleLineTotal(cart[index]);totals();});
   form.querySelectorAll('[data-increase],[data-decrease],[data-quick]').forEach(button=>button.onclick=()=>{if(busy||reviewing||customerEditing||uncertain||blocked||!dialog.isConnected||!isCurrent())return;const id=button.dataset.increase||button.dataset.decrease||button.dataset.quick,index=cart.findIndex(x=>x.id===id);try{const next=button.dataset.quick?setSaleQuantity(cart[index],button.dataset.value):changeSaleQuantity(cart[index],button.dataset.increase?1:-1);if(next)cart[index]=next;else cart.splice(index,1);error.textContent='';drawCart();}catch(e){error.textContent=e.message;}});totals();
  };
  const addProduct=p=>{if(!p||busy||reviewing||customerEditing||uncertain||blocked||!dialog.isConnected||!isCurrent())return false;try{const index=cart.findIndex(x=>x.id===p.id);if(index>=0)cart[index]=changeSaleQuantity(cart[index],1);else cart.push(newSaleLine(p));error.textContent='';drawCart();return true;}catch(e){error.textContent=e.message;return false;}};
  const drawProducts=()=>{const visible=filterSaleProducts(products,dialog.querySelector('[data-search]').value,selectedCategory);picker.querySelector('.product-picker').innerHTML=visible.map(p=>`<button type="button" class="panel row" data-product="${escape(p.id)}" ${!canAddSaleProduct(p,cart.find(x=>x.id===p.id))?'disabled':''}><span>${escape(p.name)}</span><small>${escape(p.category||'بدون تصنيف')} · المتوفر ${escape(p.quantity_pieces)}</small></button>`).join('')||'<p>لا توجد نتائج</p>';picker.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>addProduct(catalog.get(b.dataset.product)));};
  dialog.querySelector('[data-search]').oninput=drawProducts;
  const addBarcode=value=>{if(busy||reviewing||customerEditing||uncertain||blocked||!dialog.isConnected||!isCurrent())return false;const product=catalog.barcode(value);if(!product){error.textContent='لم يُعثر على صنف بهذا الباركود';return false;}if(Number(product.quantity_pieces)<=0){error.textContent='الصنف غير متوفر في المخزون';return false;}if(!addProduct(product))return false;error.textContent='';return true;};
  dialog.querySelector('[data-barcode-scan]').onkeydown=event=>{if(event.key!=='Enter')return;event.preventDefault();if(addBarcode(event.currentTarget.value))event.currentTarget.value='';};
  dialog.querySelector('[data-camera-scan]').onclick=()=>openBarcodeScanner({isCurrent:()=>dialog.isConnected&&isCurrent()&&!busy&&!reviewing&&!customerEditing&&!uncertain&&!blocked,onDetected:addBarcode});
  dialog.querySelectorAll('[data-sale-category]').forEach(button=>button.onclick=()=>{selectedCategory=button.dataset.saleCategory;dialog.querySelectorAll('[data-sale-category]').forEach(item=>{const active=item===button;item.classList.toggle('primary',active);item.setAttribute('aria-pressed',String(active));});drawProducts();});

  let savedSale=null;
  try{if(pendingError)throw pendingError;const saved=pending;if(saved){if(saved.payload?.p_project_id!==projectId||!Array.isArray(saved.cart)||!saved.requestId)throw new Error('INVALID_DRAFT');savedSale=saved;operation=createOperation('confirm_sharikx2_sale_web_v1',saved.payload,saved.requestId);cart=saved.cart;uncertain=true;fields.disabled=true;picker.hidden=true;form.querySelectorAll('[name=account]').forEach(input=>input.checked=input.value===saved.payload.p_account_id);confirm.textContent='التحقق من المبيعة السابقة';error.textContent='سنُعيد نفس الطلب دون إنشاء مبيعة أخرى.';}}catch{blocked=true;error.textContent='تعذر قراءة مسودة المبيعة السابقة. تحقق من السجل قبل إنشاء بديل.';confirm.disabled=true;fields.disabled=true;picker.hidden=true;}
  drawProducts();drawCart();
  if(operation){const saved=savedSale;debtInput.checked=!!saved.payload.p_as_debt;updatePayment();if(!saved.payload.p_as_debt){accountChoices.innerHTML=`<p class="muted">حساب الاستلام المحفوظ: ${escape(saved.payload.p_account_id)}</p>`;}if(saved.payload.p_customer_id){const option=document.createElement('option');option.value=saved.payload.p_customer_id;option.textContent='الزبون المحدد في المبيعة السابقة';customerSelect.append(option);customerSelect.value=option.value;}}
  else if(initialCustomer&&!blocked){registerCustomer(initialCustomer);customerSelect.value=initialCustomer.id;debtInput.checked=true;updatePayment();customerBox.querySelector('[data-customer-status]').textContent='تم تحديد الزبون من حساب الدين';}
  const draftCurrent=()=>!busy&&!reviewing&&!customerEditing&&!blocked&&!operation&&dialog.isConnected&&isCurrent();
  const persistDraft=()=>{
   if(!cart.length)return;
   if([...form.querySelectorAll('[data-qty],[data-price],[data-line-total]')].some(input=>!input.checkValidity()))throw new Error('صحح الكمية والسعر قبل حفظ المسودة');
   return saveSaleDraft(storage,projectId,{version:1,id:draftId,projectId,cart,asDebt:debtInput.checked,customer:customerEntry.get(customerSelect.value)||null,accountId:form.querySelector('[name=account]:checked')?.value||null});
  };
  if(!operation&&!blocked){
   const toolbar=document.createElement('section');toolbar.className='panel sale-draft-tools';toolbar.innerHTML='<div class="actions"><button type="button" data-save-draft>حفظ السلة</button><button type="button" data-new-draft>سلة جديدة</button><button type="button" data-show-drafts>المبيعات غير المكتملة</button></div><button type="button" data-close-unsaved hidden>إغلاق دون حفظ التعديلات</button><p class="muted small">الحفظ هنا لا يعتمد المبيعة ولا يغيّر المخزون. يبقى في جلسة هذا المتصفح.</p>';picker.before(toolbar);
   const resetDraft=()=>{draftId=crypto.randomUUID();cart=[];customerSelect.value='';debtInput.checked=false;form.querySelectorAll('[name=account]').forEach(input=>input.checked=false);updatePayment();drawCart();};
   toolbar.querySelector('[data-save-draft]').onclick=()=>{if(!draftCurrent())return;try{if(!cart.length)throw new Error('أضف صنفًا قبل الحفظ');persistDraft();error.textContent='تم حفظ السلة دون إرسال مبيعة';}catch(e){error.textContent=e.message;}};
   toolbar.querySelector('[data-new-draft]').onclick=()=>{if(!draftCurrent())return;try{persistDraft();resetDraft();error.textContent='';}catch(e){error.textContent=e.message;}};
   toolbar.querySelector('[data-show-drafts]').onclick=()=>{if(!draftCurrent())return;try{persistDraft();showSaleDrafts({container:dialog.querySelector('.body'),storage,projectId,isCurrent:draftCurrent,onDeleted:id=>{if(id===draftId)resetDraft();},onResume:selected=>{const restored=restoreSaleDraft(selected,projectId,catalog);draftId=restored.id;cart=restored.cart;debtInput.checked=restored.asDebt;if(restored.customer)registerCustomer(restored.customer);customerSelect.value=restored.customer?.id||'';form.querySelectorAll('[name=account]').forEach(input=>input.checked=input.value===restored.accountId);updatePayment();drawCart();error.textContent=restored.unavailable.length?`راجع المخزون الحالي للأصناف: ${restored.unavailable.join('، ')}`:'';}});}catch(e){error.textContent=e.message;}};
   closeAction=()=>{if(busy||reviewing||customerEditing)return;if(!isCurrent()){dialog.remove();return;}if(operation||blocked){dialog.remove();return;}try{persistDraft();dialog.remove();}catch(e){error.textContent=e.message;toolbar.querySelector('[data-close-unsaved]').hidden=false;}};
   dialog.querySelector('[data-close]').textContent='رجوع وحفظ السلة';
   let discardConfirmed=false;toolbar.querySelector('[data-close-unsaved]').onclick=()=>{if(!draftCurrent())return;if(!discardConfirmed){discardConfirmed=true;toolbar.querySelector('[data-close-unsaved]').textContent='تأكيد الإغلاق وفقد التعديلات غير المحفوظة؟';return;}dialog.remove();};
  }
  const dispatch=async reviewed=>{if(busy||reviewing||customerEditing||blocked||!isCurrent()||!dialog.isConnected)return;let notify=false;try{
   if(!operation){const payload=reviewed?.payload||salePayload(projectId,cart,form.querySelector('[name=account]:checked')?.value||null,accounts,{asDebt:debtInput.checked,customer:customerEntry.get(customerSelect.value)});if(!storage)throw new Error('تخزين الجلسة مطلوب لحماية إعادة المحاولة');const candidate=createOperation('confirm_sharikx2_sale_web_v1',payload);const journal=validatePendingSale({requestId:candidate.requestId,payload,cart:reviewed?.cart||cart,draftId},projectId);storage.setItem(journalKey,JSON.stringify(journal));operation=candidate;dialog.querySelector('.sale-draft-tools')?.remove();dialog.querySelector('.sale-draft-list')?.remove();}
   busy=true;fields.disabled=true;picker.hidden=true;confirm.disabled=true;dialog.querySelector('[data-close]').disabled=true;confirm.textContent='جارٍ اعتماد المبيعة…';error.textContent='';
   await operation.run({rpc:async(name,payload)=>confirmSaleResult(await api.rpc(name,payload),payload)});if(draftId)removeSaleDraft(storage,projectId,draftId);storage.removeItem(journalKey);notify=isCurrent()&&dialog.isConnected;dialog.remove();
  }catch(e){error.textContent=e.message.startsWith('OUT_OF_STOCK')?'تغيّر المخزون؛ الكمية المطلوبة لم تعد متاحة.':e.message;
   if(operation){uncertain=true;fields.disabled=true;picker.hidden=true;error.textContent+=' — سنحتفظ بنفس الطلب حتى تأكيد النتيجة.';}
  }finally{busy=false;confirm.disabled=blocked;dialog.querySelector('[data-close]').disabled=false;confirm.textContent=uncertain?'التحقق وإعادة المحاولة':debtInput.checked?'تسجيل المبيعة كدين':'مراجعة وتأكيد المبيعة';}if(notify)onSaved?.();};
  form.onsubmit=event=>{
   event.preventDefault();if(busy||reviewing||customerEditing||blocked||!isCurrent()||!dialog.isConnected)return;
   if(operation)return dispatch();
   if(!form.checkValidity()){form.reportValidity();return;}
   if(debtInput.checked)return dispatch();
   try{
    const customer=customerEntry.get(customerSelect.value),payload=salePayload(projectId,cart,form.querySelector('[name=account]:checked')?.value||null,accounts,{customer});
    const review=createSaleReview({payload,cart,accounts,customer});reviewing=true;confirm.disabled=true;fields.disabled=true;picker.hidden=true;dialog.querySelector('[data-close]').disabled=true;
    openSaleReview({review,mode,isCurrent:()=>dialog.isConnected&&isCurrent(),onClose:()=>{reviewing=false;if(dialog.isConnected){confirm.disabled=blocked;fields.disabled=!!operation||blocked;picker.hidden=!!operation||blocked;dialog.querySelector('[data-close]').disabled=false;}},onConfirm:dispatch});
   }catch(e){error.textContent=e.message;reviewing=false;confirm.disabled=blocked;fields.disabled=!!operation||blocked;picker.hidden=!!operation||blocked;dialog.querySelector('[data-close]').disabled=false;}
  };
 }catch(e){if(dialog.isConnected&&isCurrent()){dialog.querySelector('.body').innerHTML='<p role="alert"></p><button type="button" data-load-retry class="outline">إعادة المحاولة</button>';dialog.querySelector('[data-load-retry]').onclick=()=>{if(!dialog.isConnected||!isCurrent())return;dialog.remove();openSale({api,projectId,mode,storage,onSaved,initialCustomer,isCurrent});};dialog.querySelector('[role=alert]').textContent=e.message;}}
}
