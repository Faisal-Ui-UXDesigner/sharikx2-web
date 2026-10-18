import {escape,money} from './ui.js';
import {createOperation} from './operations.js';
import {bindSaleCustomers} from './sale-customers.js';
import {categorySet,ordered,INVENTORY_CATEGORY_OTHER} from './inventory-category.js';
import {saleFormMarkup,saleCartMarkup,salePickerMarkup,syncSalePicker,syncSaleCart} from './sale-form-ui.js';
import {openBarcodeScanner} from './barcode-scanner.js';
import {loadSaleCatalog} from './sale-catalog.js';
import {setSaleQuantity,changeSaleQuantity,newSaleLine} from './sale-quantity.js';
import {saleUnitPrice,salePriceForTotal,saleLineTotal,salePriceTotals} from './sale-pricing.js';
import {validatePendingSale,confirmSaleResult,saleExpectedTotal} from './sale-recovery.js';
import {saveSaleDraft,removeSaleDraft,restoreSaleDraft} from './sale-drafts.js';
import {showSaleDrafts} from './sale-drafts-ui.js';
import {createSaleReview} from './sale-review.js';
import {openSaleReview} from './sale-review-ui.js';
import {validPhone,normalizePhone} from './phone.js';
import {paidCustomerInput,resolvePaidCustomer} from './sale-customer-input.js';
import {bindPaidCustomerInput} from './sale-customer-input-ui.js';
import {openSaleQuantityEdit} from './sale-quantity-edit-ui.js';
import {openSalePriceEdit} from './sale-price-edit-ui.js';
import {bindSalePickerSession} from './sale-picker-session-ui.js';
import {bindSalePaymentAccounts} from './sale-payment-ui.js';
import {bindSalePaymentStep} from './sale-payment-step-ui.js';
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
 salePriceTotals(items.map(item=>({quantity:item.quantity,price:item.unit_sale_price})));
 return {p_project_id:projectId,p_items:items,p_discount:0,p_customer_id:customer?.id||null,p_account_id:asDebt?null:accountId,p_as_debt:asDebt};
}
export async function openSale({api,projectId,mode,storage,onSaved,initialCustomer=null,isCurrent=()=>true}){
 if(mode!=='owner')throw new Error('المشاركة للمشاهدة فقط');
 if(initialCustomer&&!validDebtCustomer(initialCustomer))throw new Error('أكمل اسم الزبون ورقم جواله الصحيح قبل البيع بالدين');
 if(!isCurrent())return;
 if(document.querySelector('dialog.sale-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='sale-dialog';dialog.innerHTML='<h2>مبيعة جديدة</h2><div class="body"><div class="skeleton"></div></div><button data-close class="outline">إلغاء</button>';document.body.append(dialog);dialog.showModal();
 let busy=false,reviewing=false,customerEditing=false,resolvingCustomer=false,lineEditing=false,productPicking=false,operation=null,cart=[],products=[],uncertain=false,blocked=false,selectedCategory='الكل';
 const journalKey=`sharikx2-pending-sale:${projectId}`;
 let closeAction=()=>{if(!busy&&!lineEditing&&!productPicking)dialog.remove();};
 dialog.querySelector('[data-close]').onclick=()=>closeAction();dialog.oncancel=e=>{e.preventDefault();closeAction();};
 try{
  let pending=null,pendingError=null;try{const raw=storage?.getItem(journalKey),saved=raw===null||raw===undefined?null:JSON.parse(raw);if(saved!==null)pending=validatePendingSale(saved,projectId);}catch(e){pendingError=e;}
  const [catalog,summary]=pending||pendingError?[{products:[]},{accounts:[]}]:await Promise.all([loadSaleCatalog(api,projectId,()=>dialog.isConnected&&isCurrent()),api.summary(projectId)]);if(!dialog.isConnected||!isCurrent()){dialog.remove();return;}
  products=catalog.products;const accounts=summary.accounts||[];
  const pickerCategories=ordered([...categorySet({inventoryCategories:products.map(p=>p.category)}),INVENTORY_CATEGORY_OTHER]);
  dialog.querySelector('.body').innerHTML=saleFormMarkup(accounts,pickerCategories);
  const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),error=form.querySelector('[role=alert]'),confirm=form.querySelector('[type=submit]'),picker=dialog.querySelector('[data-picker]');
  const productDialog=dialog.querySelector('.sale-product-picker-dialog'),entry=dialog.querySelector('[data-sale-entry]');dialog.append(productDialog);
  let paymentStep=null;
  const guardParentEdit=event=>{if(productPicking||lineEditing||(paymentStep?.active&&event.target.closest('.sale-cart-section'))){event.preventDefault();event.stopImmediatePropagation();}};
  for(const type of ['click','input','change'])form.addEventListener(type,guardParentEdit,true);
  let draftId=pending?pending.draftId||null:crypto.randomUUID();
  confirm.before(form.querySelector('[data-total]').closest('.panel'));
  const customerBox=document.createElement('section');customerBox.className='sale-customer-section';customerBox.innerHTML='<h2 data-customer-title>معلومات الزبون (اختياري)</h2><div data-paid-customer-slot></div><label class="choice sale-debt-choice"><input type="checkbox" name="asDebt">تسجيل المبيعة كدين</label><details data-sale-customer-directory><summary data-saved-customer-toggle>اختيار زبون محفوظ (اختياري)</summary><h3 data-debtor-title hidden>اختر المدين</h3><p class="muted small" data-customer-hint>أو اختر زبونًا محفوظًا (اختياري)</p><label>الزبون<select name="customer"><option value="">زبون غير محدد</option></select></label><button type="button" data-customers-more class="outline">تحميل الزبائن</button><p data-customer-status class="muted small" role="status"></p></details>';
  fields.append(customerBox);
  const customerSelect=form.elements.customer,debtInput=form.elements.asDebt,accountChoices=fields.querySelector('.account-choices');
  const paymentAccounts=bindSalePaymentAccounts(accountChoices,accounts);
  const paymentEditable=()=>!!paymentStep?.active&&!productPicking&&!lineEditing&&!busy&&!reviewing&&!resolvingCustomer&&!uncertain&&!blocked&&dialog.isConnected&&dialog.open&&isCurrent();
  const customerEntry=bindSaleCustomers({api,projectId,container:customerBox.querySelector('[data-sale-customer-directory]'),select:customerSelect,mode,storage,isCurrent:()=>dialog.isConnected&&isCurrent(),canEdit:paymentEditable,onError:e=>{error.textContent=e?.message||'';},onEditing:editing=>{customerEditing=editing;if(dialog.isConnected){fields.disabled=editing||!!operation||blocked;confirm.disabled=editing||blocked;picker.hidden=editing||!!operation||blocked;dialog.querySelector('[data-close]').disabled=editing;}}});
  const registerCustomer=customerEntry.register;
  const paidInput=bindPaidCustomerInput(customerBox.querySelector('[data-paid-customer-slot]'),{isCurrent:()=>paymentEditable()&&!customerEditing,onChange:()=>updatePayment()});
  const updatePayment=()=>{
   const debt=debtInput.checked,directory=customerBox.querySelector('[data-sale-customer-directory]');
   paidInput.setDebt(debt);customerSelect.disabled=paidInput.active();customerSelect.required=debt;paymentAccounts.setDebt(debt);
   customerBox.querySelector('[data-customer-title]').hidden=debt;customerBox.querySelector('[data-debtor-title]').hidden=!debt;
   directory.open=debt||(!paidInput.active()&&!!customerSelect.value);directory.querySelector('summary').hidden=debt;
   customerBox.querySelector('[data-customer-hint]').textContent=debt?'البيع بالدين يتطلب اسم المدين ورقم جواله الصحيح.':'أو اختر زبونًا محفوظًا (اختياري)';
   paymentStep?.sync();
  };
  updatePayment();
  form.noValidate=true;
  paymentStep=bindSalePaymentStep({owner:dialog,form,entry,confirm,
   canNavigate:()=>isCurrent()&&!busy&&!reviewing&&!customerEditing&&!resolvingCustomer&&!lineEditing&&!productPicking&&!operation&&!blocked,
   validateCart:()=>{if(!cart.length)throw new Error('أضف صنفًا واحدًا على الأقل');const invalid=[...form.querySelectorAll('[data-qty],[data-price],[data-line-total]')].find(input=>!input.checkValidity());if(invalid){invalid.closest('details').open=true;invalid.reportValidity();throw new Error('صحح الكمية والسعر قبل المتابعة');}salePriceTotals(cart);return true;},
   onError:failure=>{error.textContent=failure?.message||'';}
  });
  debtInput.onchange=()=>{if(paymentEditable()&&!customerEditing)updatePayment();};
  const roundingNote=document.createElement('p');roundingNote.className='muted small';form.querySelector('[data-total]').closest('.panel').after(roundingNote);
  const displayTotal=value=>form.querySelectorAll('[data-total],[data-payment-total]').forEach(output=>output.textContent=value);
  const totals=()=>{try{
   entry.hidden=paymentStep.active||!!operation||blocked;
   syncSalePicker(picker,products,cart);
   syncSaleCart(form,cart);
   if(operation&&pending){displayTotal(money(saleExpectedTotal(pending.payload),2));roundingNote.textContent='إجمالي الطلب المحفوظ للتحقق، وليس حسابًا جديدًا على المخزون الحالي.';return;}
   const total=salePriceTotals(cart);displayTotal(money(total.subtotal,2));roundingNote.textContent=total.subtotal!==total.serverSubtotal?`تقدير الخادم بعد تقريب كل سطر: ${money(total.serverSubtotal,2)}؛ قد يختلف عن مجموع الأندرويد بسبب التقريب.`:'';
  }catch{displayTotal('أكمل السعر والكمية');}};
  const editLine=(button,key,openEditor,applyLine)=>{
    if(paymentStep.active||productPicking||lineEditing||busy||reviewing||customerEditing||resolvingCustomer||uncertain||blocked||!button.isConnected||!dialog.isConnected||!isCurrent())return;
    const selected=cart.find(line=>line.id===button.dataset[key]);if(!selected)return;
    const baseline=JSON.stringify(cart),body=dialog.querySelector('.body'),close=dialog.querySelector('[data-close]');
    const previous={fields:fields.disabled,confirm:confirm.disabled,picker:picker.hidden,close:close.disabled,inert:body.inert};
    lineEditing=true;fields.disabled=true;confirm.disabled=true;picker.hidden=true;close.disabled=true;body.inert=true;
    const release=()=>{lineEditing=false;if(dialog.isConnected){fields.disabled=previous.fields;confirm.disabled=previous.confirm;picker.hidden=previous.picker;close.disabled=previous.close;body.inert=previous.inert;const target=[...form.querySelectorAll('[data-edit-quantity],[data-edit-price]')].find(control=>control.dataset[key]===selected.id);target?.focus();}};
    try{
     const editor=openEditor({line:selected,mode,owner:dialog,isCurrent:()=>dialog.isConnected&&dialog.open&&isCurrent()&&!busy&&!reviewing&&!operation&&!blocked&&JSON.stringify(cart)===baseline,
      onApply:next=>{const index=cart.indexOf(selected);if(index<0)throw Error('تغير الصنف؛ أعد فتح المحرّر');cart[index]=applyLine(selected,next);drawCart();},onClose:release});
     if(!editor)release();
    }catch(failure){release();error.textContent=failure.message;}
  };
  const drawCart=()=>{form.querySelector('[data-cart]').innerHTML=saleCartMarkup(cart);
   form.querySelectorAll('[data-edit-quantity]').forEach(button=>button.onclick=()=>editLine(button,'editQuantity',openSaleQuantityEdit,(line,next)=>({...line,quantity:next.quantity,quantityStep:next.quantityStep})));
   form.querySelectorAll('[data-edit-price]').forEach(button=>button.onclick=()=>editLine(button,'editPrice',openSalePriceEdit,(line,next)=>({...line,price:next.price})));
   form.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{if(busy||reviewing||customerEditing||resolvingCustomer||uncertain||blocked||!dialog.isConnected||!isCurrent())return;cart=cart.filter(x=>x.id!==b.dataset.remove);drawCart();});
   form.querySelectorAll('[data-qty],[data-price],[data-line-total]').forEach(input=>input.oninput=()=>{if(busy||reviewing||customerEditing||resolvingCustomer||uncertain||blocked||!dialog.isConnected||!isCurrent())return;const id=input.dataset.qty||input.dataset.price||input.dataset.lineTotal,index=cart.findIndex(x=>x.id===id),item=cart[index];if(input.dataset.qty){try{cart[index]=setSaleQuantity(item,input.value);input.setCustomValidity('');error.textContent='';}catch(e){input.setCustomValidity(e.message);error.textContent=e.message;}}else{try{item.price=input.dataset.lineTotal?salePriceForTotal(input.value,item.quantity):saleUnitPrice(input.value);input.setCustomValidity('');error.textContent='';if(input.dataset.lineTotal)input.closest('[data-line]').querySelector('[data-price]').value=item.price;input.closest('[data-line]').querySelector('[data-warning]').hidden=item.price>=item.cost;}catch(e){input.setCustomValidity(e.message);error.textContent=e.message;}}if(!input.dataset.lineTotal)input.closest('[data-line]').querySelector('[data-line-total]').value=saleLineTotal(cart[index]);totals();});
   form.querySelectorAll('[data-increase],[data-decrease],[data-quick]').forEach(button=>button.onclick=()=>{if(busy||reviewing||customerEditing||resolvingCustomer||uncertain||blocked||!dialog.isConnected||!isCurrent())return;const id=button.dataset.increase||button.dataset.decrease||button.dataset.quick,index=cart.findIndex(x=>x.id===id);try{const next=button.dataset.quick?setSaleQuantity(cart[index],button.dataset.value):changeSaleQuantity(cart[index],button.dataset.increase?1:-1);if(next)cart[index]=next;else cart.splice(index,1);error.textContent='';drawCart();}catch(e){error.textContent=e.message;}});totals();syncSalePicker(picker,products,cart);
  };
  const addProduct=p=>{if(!p||paymentStep.active||busy||reviewing||customerEditing||resolvingCustomer||uncertain||blocked||!dialog.isConnected||!isCurrent())return false;try{const index=cart.findIndex(x=>x.id===p.id);if(index>=0)cart[index]=changeSaleQuantity(cart[index],1);else cart.push({...newSaleLine(p),barcode:String(p.barcode??'')});error.textContent='';drawCart();return true;}catch(e){error.textContent=e.message;return false;}};
  const drawProducts=()=>{
   const list=picker.querySelector('.product-picker'),previousScroll=list.scrollTop,visible=filterSaleProducts(products,dialog.querySelector('[data-search]').value,selectedCategory);
   list.innerHTML=salePickerMarkup(visible,cart);list.scrollTop=previousScroll;
   picker.querySelectorAll('[data-product],[data-picker-increase]').forEach(button=>button.onclick=()=>{if(button.isConnected&&!button.disabled)addProduct(catalog.get(button.dataset.product||button.dataset.pickerIncrease));});
   picker.querySelectorAll('[data-picker-decrease]').forEach(button=>button.onclick=()=>{
    if(busy||reviewing||customerEditing||resolvingCustomer||uncertain||blocked||!button.isConnected||button.disabled||!dialog.isConnected||!isCurrent())return;
    const index=cart.findIndex(line=>line.id===button.dataset.pickerDecrease);if(index<0)return;
    try{const next=changeSaleQuantity(cart[index],-1);if(next)cart[index]=next;else cart.splice(index,1);error.textContent='';drawCart();}catch(failure){error.textContent=failure.message;}
   });
  };
  dialog.querySelector('[data-search]').oninput=()=>{if(!busy&&!reviewing&&!customerEditing&&!resolvingCustomer&&!uncertain&&!blocked&&dialog.isConnected&&isCurrent())drawProducts();};
  const addBarcode=value=>{if(paymentStep.active||busy||reviewing||customerEditing||resolvingCustomer||uncertain||blocked||!dialog.isConnected||!isCurrent())return false;const product=catalog.barcode(value);if(!product){error.textContent='لم يُعثر على صنف بهذا الباركود';return false;}if(Number(product.quantity_pieces)<=0){error.textContent='الصنف غير متوفر في المخزون';return false;}if(!addProduct(product))return false;error.textContent='';return true;};
  dialog.querySelector('[data-barcode-scan]').onkeydown=event=>{if(event.key!=='Enter')return;event.preventDefault();if(addBarcode(event.currentTarget.value))event.currentTarget.value='';};
  dialog.querySelector('[data-camera-scan]').onclick=()=>openBarcodeScanner({isCurrent:()=>!paymentStep.active&&dialog.isConnected&&isCurrent()&&!busy&&!reviewing&&!customerEditing&&!resolvingCustomer&&!uncertain&&!blocked,onDetected:addBarcode});
  dialog.querySelectorAll('[data-sale-category]').forEach(button=>button.onclick=()=>{if(busy||reviewing||customerEditing||resolvingCustomer||uncertain||blocked||!button.isConnected||!dialog.isConnected||!isCurrent())return;selectedCategory=button.dataset.saleCategory;dialog.querySelectorAll('[data-sale-category]').forEach(item=>{const active=item===button;item.classList.toggle('primary',active);item.setAttribute('aria-pressed',String(active));});drawProducts();});
  let pickerLock=null;
  bindSalePickerSession({owner:dialog,dialog:productDialog,opener:entry.querySelector('[data-open-sale-picker]'),readCart:()=>cart,
   isCurrent:()=>!paymentStep.active&&dialog.isConnected&&isCurrent()&&!busy&&!reviewing&&!lineEditing&&!customerEditing&&!resolvingCustomer&&!uncertain&&!blocked&&!operation,
   restoreCart:original=>{cart=original;if(dialog.isConnected)drawCart();},
   onOpen:()=>{selectedCategory='الكل';dialog.querySelector('[data-search]').value='';productDialog.querySelector('.sale-picker-error').textContent='';picker.hidden=false;dialog.querySelectorAll('[data-sale-category]').forEach(button=>{const selected=button.dataset.saleCategory==='الكل';button.classList.toggle('primary',selected);button.setAttribute('aria-pressed',String(selected));});drawProducts();picker.querySelector('.product-picker').scrollTop=0;picker.querySelector('[data-sale-categories]').scrollLeft=0;},
   onLock:locked=>{const body=dialog.querySelector('.body'),close=dialog.querySelector('[data-close]');productPicking=locked;if(locked){pickerLock={inert:body.inert,fields:fields.disabled,confirm:confirm.disabled,close:close.disabled};body.inert=true;fields.disabled=true;confirm.disabled=true;close.disabled=true;}else if(dialog.isConnected&&pickerLock){body.inert=pickerLock.inert;fields.disabled=pickerLock.fields;confirm.disabled=pickerLock.confirm;close.disabled=pickerLock.close;pickerLock=null;}},
   onError:failure=>{error.textContent=failure?.message||'تعذر اختيار الأصناف';}
  });

  let savedSale=null;
  try{if(pendingError)throw pendingError;const saved=pending;if(saved){if(saved.payload?.p_project_id!==projectId||!Array.isArray(saved.cart)||!saved.requestId)throw new Error('INVALID_DRAFT');savedSale=saved;operation=createOperation('confirm_sharikx2_sale_web_v1',saved.payload,saved.requestId);cart=saved.cart;uncertain=true;fields.disabled=true;picker.hidden=true;form.querySelectorAll('[name=account]').forEach(input=>input.checked=input.value===saved.payload.p_account_id);confirm.textContent='التحقق من المبيعة السابقة';error.textContent='سنُعيد نفس الطلب دون إنشاء مبيعة أخرى.';}}catch{blocked=true;error.textContent='تعذر قراءة مسودة المبيعة السابقة. تحقق من السجل قبل إنشاء بديل.';confirm.disabled=true;fields.disabled=true;picker.hidden=true;}
  drawProducts();drawCart();
  if(operation){const saved=savedSale;debtInput.checked=!!saved.payload.p_as_debt;updatePayment();if(!saved.payload.p_as_debt){accountChoices.innerHTML=`<p class="muted">حساب الاستلام المحفوظ: ${escape(saved.payload.p_account_id)}</p>`;}if(saved.payload.p_customer_id){const option=document.createElement('option');option.value=saved.payload.p_customer_id;option.textContent='الزبون المحدد في المبيعة السابقة';customerSelect.append(option);customerSelect.value=option.value;}}
  else if(initialCustomer&&!blocked){registerCustomer(initialCustomer);customerSelect.value=initialCustomer.id;debtInput.checked=true;updatePayment();customerBox.querySelector('[data-customer-status]').textContent='تم تحديد الزبون من حساب الدين';}
  if(operation||blocked)paymentStep.recover();
  const draftCurrent=()=>!paymentStep.active&&!productPicking&&!lineEditing&&!busy&&!reviewing&&!customerEditing&&!resolvingCustomer&&!blocked&&!operation&&dialog.isConnected&&isCurrent();
  const persistDraft=()=>{
   if(!cart.length)return;
   if([...form.querySelectorAll('[data-qty],[data-price],[data-line-total]')].some(input=>!input.checkValidity()))throw new Error('صحح الكمية والسعر قبل حفظ المسودة');
   return saveSaleDraft(storage,projectId,{version:1,id:draftId,projectId,cart,asDebt:debtInput.checked,customer:customerEntry.get(customerSelect.value)||null,customerInput:paidInput.active()?paidInput.value():null,accountId:form.querySelector('[name=account]:checked')?.value||null});
  };
  if(!operation&&!blocked){
   const toolbar=document.createElement('section');toolbar.className='panel sale-draft-tools';toolbar.innerHTML='<div class="actions"><button type="button" data-save-draft>حفظ السلة</button><button type="button" data-new-draft>سلة جديدة</button><button type="button" data-show-drafts>المبيعات غير المكتملة</button></div><button type="button" data-close-unsaved hidden>إغلاق دون حفظ التعديلات</button><p class="muted small">الحفظ هنا لا يعتمد المبيعة ولا يغيّر المخزون. يبقى في جلسة هذا المتصفح.</p>';entry.before(toolbar);
   const resetDraft=()=>{draftId=crypto.randomUUID();cart=[];customerSelect.value='';debtInput.checked=false;paidInput.clear();paymentAccounts.select();updatePayment();drawCart();};
   toolbar.querySelector('[data-save-draft]').onclick=()=>{if(!draftCurrent())return;try{if(!cart.length)throw new Error('أضف صنفًا قبل الحفظ');persistDraft();error.textContent='تم حفظ السلة دون إرسال مبيعة';}catch(e){error.textContent=e.message;}};
   toolbar.querySelector('[data-new-draft]').onclick=()=>{if(!draftCurrent())return;try{persistDraft();resetDraft();error.textContent='';}catch(e){error.textContent=e.message;}};
   toolbar.querySelector('[data-show-drafts]').onclick=()=>{if(!draftCurrent())return;try{persistDraft();showSaleDrafts({container:dialog.querySelector('.body'),storage,projectId,isCurrent:draftCurrent,onDeleted:id=>{if(id===draftId)resetDraft();},onResume:selected=>{const restored=restoreSaleDraft(selected,projectId,catalog);draftId=restored.id;cart=restored.cart;debtInput.checked=restored.asDebt;paidInput.restore(restored.customerInput);if(restored.customer)registerCustomer(restored.customer);customerSelect.value=restored.customer?.id||'';paymentAccounts.select(restored.accountId);updatePayment();drawCart();error.textContent=restored.unavailable.length?`راجع المخزون الحالي للأصناف: ${restored.unavailable.join('، ')}`:'';}});}catch(e){error.textContent=e.message;}};
   closeAction=()=>{if(productPicking||lineEditing||busy||reviewing||customerEditing||resolvingCustomer)return;if(!isCurrent()){dialog.remove();return;}if(paymentStep.active){paymentStep.back();return;}if(operation||blocked){dialog.remove();return;}try{persistDraft();dialog.remove();}catch(e){error.textContent=e.message;toolbar.querySelector('[data-close-unsaved]').hidden=false;}};
   dialog.querySelector('[data-close]').textContent='رجوع وحفظ السلة';
   let discardConfirmed=false;toolbar.querySelector('[data-close-unsaved]').onclick=()=>{if(!draftCurrent())return;if(!discardConfirmed){discardConfirmed=true;toolbar.querySelector('[data-close-unsaved]').textContent='تأكيد الإغلاق وفقد التعديلات غير المحفوظة؟';return;}dialog.remove();};
  }
  const dispatch=async reviewed=>{if(busy||reviewing||customerEditing||resolvingCustomer||blocked||!isCurrent()||!dialog.isConnected)return;let notify=false;try{
   if(!operation){const payload=reviewed?.payload||salePayload(projectId,cart,form.querySelector('[name=account]:checked')?.value||null,accounts,{asDebt:debtInput.checked,customer:customerEntry.get(customerSelect.value)});if(!storage)throw new Error('تخزين الجلسة مطلوب لحماية إعادة المحاولة');const candidate=createOperation('confirm_sharikx2_sale_web_v1',payload);const journal=validatePendingSale({requestId:candidate.requestId,payload,cart:reviewed?.cart||cart,draftId},projectId);storage.setItem(journalKey,JSON.stringify(journal));operation=candidate;dialog.querySelector('.sale-draft-tools')?.remove();dialog.querySelector('.sale-draft-list')?.remove();}
   paymentStep.recover();busy=true;fields.disabled=true;picker.hidden=true;confirm.disabled=true;dialog.querySelector('[data-close]').disabled=true;confirm.textContent='جارٍ اعتماد المبيعة…';error.textContent='';
   await operation.run({rpc:async(name,payload)=>confirmSaleResult(await api.rpc(name,payload),payload)});if(draftId)removeSaleDraft(storage,projectId,draftId);storage.removeItem(journalKey);notify=isCurrent()&&dialog.isConnected;dialog.remove();
  }catch(e){error.textContent=e.message.startsWith('OUT_OF_STOCK')?'تغيّر المخزون؛ الكمية المطلوبة لم تعد متاحة.':e.message;
   if(operation){uncertain=true;fields.disabled=true;picker.hidden=true;error.textContent+=' — سنحتفظ بنفس الطلب حتى تأكيد النتيجة.';}
  }finally{busy=false;confirm.disabled=blocked;dialog.querySelector('[data-close]').disabled=false;confirm.textContent=uncertain?'التحقق وإعادة المحاولة':debtInput.checked?'تسجيل المبيعة كدين':'مراجعة وتأكيد المبيعة';}if(notify)onSaved?.();};
  const showPaidReview=(customer,snapshot,accountId)=>{
   if(busy||reviewing||customerEditing||resolvingCustomer||blocked||!isCurrent()||!dialog.isConnected)return;
   const payload=salePayload(projectId,snapshot,accountId,accounts,{customer}),review=createSaleReview({payload,cart:snapshot,accounts,customer});reviewing=true;confirm.disabled=true;fields.disabled=true;picker.hidden=true;dialog.querySelector('[data-close]').disabled=true;
   openSaleReview({review,mode,isCurrent:()=>dialog.isConnected&&isCurrent(),onClose:()=>{reviewing=false;if(dialog.isConnected){confirm.disabled=blocked;fields.disabled=!!operation||blocked;picker.hidden=!!operation||blocked;dialog.querySelector('[data-close]').disabled=false;}},onConfirm:dispatch});
  };
  const finishResolution=()=>{resolvingCustomer=false;if(dialog.isConnected){fields.disabled=!!operation||blocked||reviewing||customerEditing;confirm.disabled=blocked||reviewing||customerEditing;picker.hidden=!!operation||blocked||reviewing||customerEditing;dialog.querySelector('[data-close]').disabled=reviewing||customerEditing;}};
  form.onsubmit=async event=>{
   if(productPicking||lineEditing){event.preventDefault();return;}
   event.preventDefault();if(busy||reviewing||customerEditing||resolvingCustomer||blocked||!isCurrent()||!dialog.isConnected||!dialog.open)return;
   if(operation)return dispatch();
   if(!paymentStep.active){paymentStep.open();return;}
   if(!paymentStep.ready)return;
   if(!form.checkValidity()){form.reportValidity();return;}
   if(debtInput.checked)return dispatch();
   try{
    let customer=customerEntry.get(customerSelect.value);const snapshot=JSON.parse(JSON.stringify(cart)),accountId=form.querySelector('[name=account]:checked')?.value||null;
    salePayload(projectId,snapshot,accountId,accounts);
    if(paidInput.active()){
     const input=paidCustomerInput(paidInput.value().name,paidInput.value().phone);customer=null;
     if(input){
      resolvingCustomer=true;fields.disabled=true;confirm.disabled=true;picker.hidden=true;dialog.querySelector('[data-close]').disabled=true;error.textContent='جارٍ البحث عن الزبون برقم الجوال…';
      const pendingCustomer=storage?.getItem(`sharikx2-pending-customer:${projectId}`),resolution=pendingCustomer!==null&&pendingCustomer!==undefined?{kind:'create',input}:await resolvePaidCustomer(api,projectId,input,()=>dialog.isConnected&&isCurrent());
      if(!dialog.isConnected||!isCurrent())return;finishResolution();error.textContent='';
      if(resolution.kind==='create'){customerEntry.create(resolution.input,created=>{if(normalizePhone(created.phone)!==input.phone){error.textContent='تم التحقق من طلب زبون سابق؛ راجع البيانات المدخلة قبل المتابعة.';return;}paidInput.clear();updatePayment();showPaidReview(created,snapshot,accountId);});return;}
      customer=resolution.customer;if(customer){registerCustomer(customer);customerSelect.value=customer.id;}
     }
    }
    showPaidReview(customer,snapshot,accountId);
   }catch(e){if(dialog.isConnected&&isCurrent())error.textContent=e.message;}
   finally{if(resolvingCustomer)finishResolution();}
  };
 }catch(e){if(dialog.isConnected&&isCurrent()){dialog.querySelector('.body').innerHTML='<p role="alert"></p><button type="button" data-load-retry class="outline">إعادة المحاولة</button>';dialog.querySelector('[data-load-retry]').onclick=()=>{if(!dialog.isConnected||!isCurrent())return;dialog.remove();openSale({api,projectId,mode,storage,onSaved,initialCustomer,isCurrent});};dialog.querySelector('[role=alert]').textContent=e.message;}}
}
