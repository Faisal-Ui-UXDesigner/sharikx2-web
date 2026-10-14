import {escape,money} from './ui.js';
import {createOperation} from './operations.js';
import {supplierCreditSummary} from './supplier-credit.js';
import {openSupplierCreate} from './supplier-create-ui.js';
import {openPurchaseProductChoice} from './purchase-product-choice-ui.js';
import {categorySettingsState} from './inventory-category.js';
import {openPurchaseCartReview} from './purchase-cart-review-ui.js';
import {purchaseCartReview} from './purchase-cart-review.js';
import {openPurchaseLineEntry} from './purchase-line-entry-ui.js';
import {createPurchaseCartLine,purchaseUndoIndex} from './purchase-cart-actions.js';
import {readPurchaseDraft,savePurchaseDraft,removePurchaseDraft,restorePurchaseDraft} from './purchase-drafts.js';
import {purchaseLineTotal,purchaseRoundedTotal,purchasePaymentTotal,purchaseRemaining} from './purchase-arithmetic.js';
import {purchasePayload,purchaseAmounts,validatePurchaseSnapshot,purchaseJournalPayload,verifyPurchaseResult} from './purchase-model.js';
export {purchasePayload,purchaseTotal} from './purchase-model.js';

export function openPurchase({api,projectId,mode,storage,onSaved,isCurrent=()=>true}){
 if(mode!=='owner')throw new Error('المشاركة للمشاهدة فقط');
 if(!projectId)throw new Error('بيانات المشروع غير مكتملة');
 if(!isCurrent()||document.querySelector('.purchase-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='purchase-dialog';
 dialog.innerHTML='<h2>فاتورة شراء جديدة</h2><div class="body"><div class="skeleton"></div></div><button data-close class="outline">إلغاء</button>';
 document.body.append(dialog);dialog.showModal();
 const key=`sharikx2-pending-purchase:${projectId}`,current=()=>dialog.isConnected&&isCurrent();
 let busy=false,creatingSupplier=false,choosingProduct=false,reviewingCart=false,enteringLine=false,operation=null,pendingPayload=null,pendingView=null,blocked=false,reviewDialog=null;
 const close=()=>{if(!busy&&!creatingSupplier&&!choosingProduct&&!reviewingCart&&!enteringLine){reviewDialog?.remove();dialog.remove();}};dialog.querySelector('[data-close]').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 try{const saved=JSON.parse(storage?.getItem(key)||'null');if(saved){pendingPayload=purchaseJournalPayload(saved,projectId);pendingView=saved.view;operation=createOperation('confirm_sharikx2_purchase_v3',pendingPayload,saved.requestId);}}catch{blocked=true;}
 const render=({products,suppliers,accounts})=>{
  if(!current())return;
  let items=pendingPayload?.p_items.map(item=>({product_id:item.product_id,quantity:item.quantity_pieces,cost:item.unit_cost}))||[],payments=pendingPayload?.p_payments.map(payment=>({...payment}))||[],creditRevision=0;
  dialog.querySelector('.body').innerHTML=`<form><fieldset><label>المورد<select name="supplier" required><option value="">اختر المورد</option>${suppliers.map(supplier=>`<option value="${escape(supplier.id)}">${escape(supplier.name)} — ${escape(supplier.phone||'بدون رقم')}</option>`).join('')}</select></label><div class="panel supplier-credit" data-credit hidden></div><h3>الأصناف</h3><div data-items></div><button type="button" data-add class="outline">إضافة صنف</button><h3>الدفعات الحالية للمورد</h3><div data-payments></div><button type="button" data-pay class="outline">إضافة دفعة</button><label>ملاحظات اختيارية<textarea name="note" maxlength="500"></textarea></label></fieldset><p>إجمالي الفاتورة: <b data-total></b></p><p>المتبقي قبل تطبيق أي رصيد دائن: <b data-debt></b></p><p role="alert"></p><button type="submit" class="primary">تأكيد الفاتورة</button></form>`;
  const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),error=form.querySelector('[role=alert]'),submit=form.querySelector('[type=submit]');
  const editable=()=>current()&&!busy&&!creatingSupplier&&!choosingProduct&&!reviewingCart&&!enteringLine&&!operation&&!blocked&&!reviewDialog?.isConnected;
  let lastAdded=null,lastSelectedProduct=products[0]?.id,draftId=crypto.randomUUID(),savedDraft=null,submittedDraft=null;
  const draftTools=document.createElement('section');draftTools.className='panel purchase-draft-tools';draftTools.hidden=!!operation||blocked;draftTools.innerHTML='<div class="actions"><button type="button" data-save-purchase-draft>حفظ الفاتورة غير المكتملة</button><button type="button" data-resume-purchase-draft>استعادة المسودة</button><button type="button" data-delete-purchase-draft>حذف المسودة المحفوظة</button></div><p class="muted small">الحفظ لا يسجل فاتورة ولا يغيّر المخزون أو الحسابات. مسودة واحدة للمشروع في جلسة هذه التبويبة فقط. الإغلاق العادي لا يحفظ التعديلات تلقائيًا.</p><p role="status" data-purchase-draft-status></p>';fields.before(draftTools);
  const draftStatus=draftTools.querySelector('[data-purchase-draft-status]');
  const readDraft=()=>{savedDraft=readPurchaseDraft(storage,projectId);draftStatus.textContent=savedDraft?'توجد مسودة محفوظة؛ الاستعادة تعيد البنود والدفعات وفق البيانات الحالية.':'لا توجد مسودة محفوظة';};
  if(!operation&&!blocked){try{readDraft();}catch(errorValue){draftStatus.textContent=errorValue.message;}}
  const hasLocalWork=()=>items.length||payments.length||form.elements.supplier.value||form.elements.note.value;
  draftTools.querySelector('[data-save-purchase-draft]').onclick=()=>{if(!editable())return;try{if(!hasLocalWork())throw new Error('أدخل بيانات فاتورة قبل حفظ المسودة');if([...fields.querySelectorAll('[data-qty],[data-cost]')].some(input=>!input.checkValidity()))throw new Error('صحح الكمية والتكلفة قبل حفظ المسودة');if([...fields.querySelectorAll('[data-payamount]')].some(input=>input.value===''||!Number.isFinite(Number(input.value))||Number(input.value)<0))throw new Error('أكمل مبالغ الدفعات قبل الحفظ');savedDraft=savePurchaseDraft(storage,projectId,{version:1,id:draftId,projectId,items,payments,supplierId:form.elements.supplier.value||null,selectedProductId:lastSelectedProduct||null,note:form.elements.note.value},savedDraft);draftStatus.textContent='تم حفظ المسودة دون إرسال فاتورة';}catch(errorValue){draftStatus.textContent=errorValue.message;}};
  let resumeConfirmed=false,deleteConfirmed=false;
  draftTools.querySelector('[data-resume-purchase-draft]').onclick=()=>{if(!editable())return;try{const draft=readPurchaseDraft(storage,projectId);if(!draft)throw new Error('لا توجد مسودة محفوظة');if(hasLocalWork()&&!resumeConfirmed){resumeConfirmed=true;draftStatus.textContent='الاستعادة تستبدل التعديلات الحالية غير المحفوظة؛ اضغط الاستعادة ثانية للتأكيد';return;}const restored=restorePurchaseDraft(draft,projectId,{products,suppliers,accounts});savedDraft=draft;draftId=restored.id;items=restored.items;payments=restored.payments;lastAdded=null;lastSelectedProduct=restored.selectedProductId;form.elements.note.value=restored.note;if(restored.supplierId&&![...form.elements.supplier.options].some(option=>option.value===restored.supplierId))form.elements.supplier.append(new Option('المورد المحفوظ غير متاح',restored.supplierId));form.elements.supplier.value=restored.supplierId||'';creditRevision++;form.querySelector('[data-credit]').hidden=true;drawItems();drawPayments();totals();refreshNotice();resumeConfirmed=false;deleteConfirmed=false;draftStatus.textContent=restored.unavailable.products.length||restored.unavailable.accounts.length||restored.unavailable.supplier?'تمت الاستعادة؛ اختر بدائل للهويات غير المتاحة وراجع أرصدة الحسابات قبل التأكيد.':'تمت الاستعادة؛ راجع الدفعات والأرصدة الحالية قبل التأكيد';}catch(errorValue){draftStatus.textContent=errorValue.message;}};
  draftTools.querySelector('[data-delete-purchase-draft]').onclick=()=>{if(!editable())return;try{const draft=readPurchaseDraft(storage,projectId);if(!draft)throw new Error('لا توجد مسودة محفوظة');if(!deleteConfirmed){deleteConfirmed=true;savedDraft=draft;draftStatus.textContent='اضغط حذف المسودة ثانية للتأكيد؛ لن تُحذف بنود الفاتورة الحالية';return;}if(!removePurchaseDraft(storage,projectId,savedDraft))throw new Error('تغيّرت المسودة المحفوظة؛ راجعها قبل الحذف');savedDraft=null;deleteConfirmed=false;draftStatus.textContent='حُذفت المسودة المحلية فقط؛ بيانات الفاتورة الحالية باقية';}catch(errorValue){deleteConfirmed=false;draftStatus.textContent=errorValue.message;}};
  const entryButton=document.createElement('button');entryButton.type='button';entryButton.className='primary';entryButton.dataset.enterPurchaseLine='';entryButton.textContent='إدخال صنف بالكمية والتكلفة';entryButton.hidden=!!operation||blocked;fields.querySelector('[data-add]').after(entryButton);
  const notice=document.createElement('section');notice.className='panel row purchase-added-notice';notice.hidden=true;notice.innerHTML='<span data-added-purchase-message role="status"></span><button type="button" data-undo-purchase-line class="outline">تراجع</button>';entryButton.after(notice);
  const refreshNotice=()=>{const index=purchaseUndoIndex(items,lastAdded);notice.hidden=index<0||!!operation||blocked;if(index>=0)notice.querySelector('[data-added-purchase-message]').textContent='تمت إضافة: '+String(products.find(product=>product.id===lastAdded.product_id)?.name||'صنف');};
  notice.querySelector('[data-undo-purchase-line]').onclick=()=>{if(!editable())return;const index=purchaseUndoIndex(items,lastAdded);if(index<0){refreshNotice();return;}items.splice(index,1);lastAdded=null;drawItems();totals();refreshNotice();};
  const appendLine=line=>{const added={...line};items.push(added);lastAdded=added;lastSelectedProduct=added.product_id;drawItems();totals();refreshNotice();error.textContent='';};
  entryButton.onclick=()=>{
   if(!editable()||document.querySelector('dialog.purchase-line-entry'))return;enteringLine=true;fields.disabled=true;submit.disabled=true;dialog.querySelector('[data-close]').disabled=true;
   const finish=()=>{enteringLine=false;if(current()){fields.disabled=!!operation||blocked;submit.disabled=blocked;dialog.querySelector('[data-close]').disabled=false;}};
   try{const child=openPurchaseLineEntry({mode,projectId,products,selectedId:lastSelectedProduct,loadSettings:async()=>categorySettingsState(await api.financeState(projectId)),isCurrent:()=>current()&&!busy&&!operation&&!blocked,onClose:finish,onAdded:line=>{if(editable())appendLine(line);}});if(!child)finish();}
   catch(errorValue){finish();if(current())error.textContent=errorValue.message;}
  };
  const cartSummary=document.createElement('button');cartSummary.type='button';cartSummary.className='panel purchase-cart-summary';cartSummary.dataset.reviewPurchaseCart='';cartSummary.hidden=!!operation||blocked;fields.querySelector('[data-add]').after(cartSummary);
  cartSummary.onclick=()=>{
   if(!editable()||document.querySelector('dialog.purchase-cart-review'))return;
   if([...fields.querySelectorAll('[data-qty],[data-cost]')].some(input=>!input.checkValidity())){error.textContent='صحح الكمية والتكلفة قبل مراجعة الأصناف';return;}
   reviewingCart=true;fields.disabled=true;submit.disabled=true;dialog.querySelector('[data-close]').disabled=true;
   const finish=()=>{reviewingCart=false;if(current()){fields.disabled=!!operation||blocked;submit.disabled=blocked;dialog.querySelector('[data-close]').disabled=false;}};
   const assertLine=(source,index)=>{if(!current()||!reviewingCart||busy||operation||blocked||items[index]!==source)throw new Error('تغيّرت الفاتورة؛ راجع بيانات البند');};
   try{const child=openPurchaseCartReview({mode,products,getItems:()=>items,isCurrent:()=>current()&&!busy&&!operation&&!blocked,onClose:finish,onEdit:(source,index,values)=>{assertLine(source,index);Object.assign(source,values);drawItems();totals();refreshNotice();},onDelete:(source,index)=>{assertLine(source,index);items.splice(index,1);drawItems();totals();refreshNotice();}});if(!child)finish();}
   catch(errorValue){finish();if(current())error.textContent=errorValue.message;}
  };
  const addSupplier=document.createElement('button');addSupplier.type='button';addSupplier.className='outline';addSupplier.dataset.addPurchaseSupplier='';addSupplier.textContent='إضافة مورد جديد';form.elements.supplier.closest('label').after(addSupplier);addSupplier.hidden=!!operation||blocked;
  addSupplier.onclick=()=>{
   if(!editable()||document.querySelector('dialog.supplier-create'))return;creatingSupplier=true;creditRevision++;fields.disabled=true;submit.disabled=true;dialog.querySelector('[data-close]').disabled=true;
   const finish=()=>{creatingSupplier=false;if(current()){fields.disabled=!!operation||blocked;submit.disabled=blocked;dialog.querySelector('[data-close]').disabled=false;}};
   try{const child=openSupplierCreate({api,projectId,mode,storage,isCurrent:()=>current()&&!busy&&!operation&&!blocked&&!reviewDialog?.isConnected,onClose:finish,onSaved:supplier=>{if(!editable())return;suppliers=[...suppliers.filter(row=>row.id!==supplier.id),supplier];let option=[...form.elements.supplier.options].find(row=>row.value===supplier.id);if(!option){option=new Option('',supplier.id);form.elements.supplier.append(option);}option.textContent=`${supplier.name} — ${supplier.phone||'بدون رقم'}`;form.elements.supplier.value=supplier.id;form.elements.supplier.dispatchEvent(new Event('change'));error.textContent='تم اختيار المورد المضاف؛ لم تُسجل الفاتورة بعد.';}});if(!child)finish();}
   catch(e){finish();if(current())error.textContent=e.message;}
  };
  const totals=()=>{try{const total=purchaseRoundedTotal(items),paid=purchasePaymentTotal(payments);form.querySelector('[data-total]').textContent=money(total,2);form.querySelector('[data-debt]').textContent=money(purchaseRemaining(total,paid),2);form.querySelectorAll('[data-line-purchase-total]').forEach(label=>{const item=items[+label.dataset.linePurchaseTotal];try{label.textContent=money(purchaseLineTotal(item.quantity,item.cost),2);}catch{label.textContent='أكمل الكمية والتكلفة';}});const view=purchaseCartReview(items,products);cartSummary.textContent=`الأصناف: ${view.productCount}${view.lineCount!==view.productCount?` · البنود: ${view.lineCount}`:''} · الإجمالي: ${money(view.displayTotal,2)} — اضغط للمراجعة والتعديل`;cartSummary.setAttribute('aria-label',`مراجعة ${view.lineCount} بند في فاتورة الشراء؛ القيمة الدقيقة ${money(total,2)}`);}catch{cartSummary.textContent='صحح الكمية والتكلفة قبل مراجعة الأصناف';form.querySelector('[data-total]').textContent=form.querySelector('[data-debt]').textContent='أكمل الكمية والتكلفة والدفعات';}};
  const drawItems=()=>{
   form.querySelector('[data-items]').innerHTML=items.map((item,index)=>`<div class="panel"><label>الصنف<select data-product="${index}">${products.map(product=>`<option value="${escape(product.id)}" ${product.id===item.product_id?'selected':''}>${escape(product.name)}</option>`).join('')}</select></label><div class="input-pair"><label>الكمية بالقطعة<input data-qty="${index}" type="number" min="0.001" step="0.001" value="${escape(item.quantity)}" required></label><label>تكلفة القطعة<input data-cost="${index}" type="number" min="0" step="0.01" value="${escape(item.cost)}" required></label></div><button type="button" data-remove="${index}" class="danger">حذف الصنف</button></div>`).join('')||'<p class="muted">لم تضف أصنافًا بعد</p>';
   form.querySelectorAll('[data-product]').forEach(input=>{const lineTotal=document.createElement('p');lineTotal.className='muted small';lineTotal.textContent='إجمالي البند بعد التقريب: ';const amount=document.createElement('b');amount.dataset.linePurchaseTotal=input.dataset.product;lineTotal.append(amount);input.closest('.panel').append(lineTotal);input.onchange=()=>{if(editable()){items[+input.dataset.product].product_id=input.value;totals();}};});
   form.querySelectorAll('[data-product]').forEach(select=>{
    if(operation||blocked)return;
    const choose=document.createElement('button');choose.type='button';choose.className='outline';choose.dataset.choosePurchaseProduct=select.dataset.product;choose.textContent='بحث واختيار الصنف';select.closest('label').after(choose);
    choose.onclick=()=>{
     if(!editable()||document.querySelector('dialog.purchase-product-choice'))return;const line=items[+select.dataset.product];if(!line)return;
     choosingProduct=true;fields.disabled=true;submit.disabled=true;dialog.querySelector('[data-close]').disabled=true;
     const finish=()=>{choosingProduct=false;if(current()){fields.disabled=!!operation||blocked;submit.disabled=blocked;dialog.querySelector('[data-close]').disabled=false;}};
     try{const child=openPurchaseProductChoice({products,projectId,selectedId:line.product_id,mode,loadSettings:async()=>categorySettingsState(await api.financeState(projectId)),isCurrent:()=>current()&&!busy&&!operation&&!blocked&&!reviewDialog?.isConnected,onClose:finish,onSelected:product=>{if(!editable()||!items.includes(line))return;line.product_id=product.id;select.value=product.id;totals();error.textContent='';}});if(!child)finish();}
     catch(errorValue){finish();if(current())error.textContent=errorValue.message;}
    };
   });
   form.querySelectorAll('[data-qty],[data-cost]').forEach(input=>input.oninput=()=>{if(!editable())return;const index=+(input.dataset.qty??input.dataset.cost);items[index][input.dataset.qty!==undefined?'quantity':'cost']=Number(input.value);totals();});
   form.querySelectorAll('[data-cost]').forEach(input=>input.step='0.0001');
   form.querySelectorAll('[data-product]').forEach(select=>{const id=items[+select.dataset.product].product_id;if(![...select.options].some(option=>option.value===id)){select.append(new Option('الصنف المحفوظ غير متاح',id));select.value=id;}});
   form.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{if(!editable())return;items.splice(+button.dataset.remove,1);drawItems();totals();refreshNotice();});
  };
  const drawPayments=()=>{
   form.querySelector('[data-payments]').innerHTML=payments.map((payment,index)=>`<div class="panel"><label>الحساب<select data-account="${index}">${accounts.map(account=>`<option value="${escape(account.id)}" ${account.id===payment.account_id?'selected':''}>${escape(account.name)} — المتاح ${money(account.balance,2)}</option>`).join('')}</select></label><label>المبلغ<input data-payamount="${index}" type="number" min="0.01" step="0.01" value="${escape(payment.amount)}" required></label><button type="button" data-removepay="${index}" class="danger">حذف الدفعة</button></div>`).join('')||'<p class="muted">لم تضف دفعات؛ الباقي يصبح دينًا للمورد.</p>';
   form.querySelectorAll('[data-account]').forEach(input=>input.onchange=()=>{if(editable())payments[+input.dataset.account].account_id=input.value;});
   form.querySelectorAll('[data-account]').forEach(select=>{const id=payments[+select.dataset.account].account_id;if(![...select.options].some(option=>option.value===id)){select.append(new Option('الحساب المحفوظ غير متاح',id));select.value=id;}});
   form.querySelectorAll('[data-payamount]').forEach(input=>input.oninput=()=>{if(!editable())return;payments[+input.dataset.payamount].amount=Number(input.value);totals();});
   form.querySelectorAll('[data-removepay]').forEach(button=>button.onclick=()=>{if(!editable())return;payments.splice(+button.dataset.removepay,1);drawPayments();totals();});
  };
  form.querySelector('[data-add]').textContent='إضافة سريعة ثم تعديل البند';
  form.querySelector('[data-add]').onclick=()=>{if(!editable())return;try{appendLine(createPurchaseCartLine(products[0],1,Number(products[0]?.weighted_unit_cost||0),projectId));}catch(errorValue){error.textContent=errorValue.message;}};
  form.querySelector('[data-pay]').onclick=()=>{if(!editable())return;const account=accounts.find(account=>!payments.some(payment=>payment.account_id===account.id));if(!account){error.textContent='لا يوجد حساب إضافي متاح';return;}payments.push({account_id:account.id,amount:0});drawPayments();totals();};
  form.elements.supplier.onchange=async()=>{
   if(!editable())return;
   const box=form.querySelector('[data-credit]'),supplierId=form.elements.supplier.value,revision=++creditRevision;box.hidden=!supplierId;
   if(!supplierId)return;box.textContent='جارٍ قراءة الرصيد الدائن…';
   try{const summary=supplierCreditSummary(await api.supplierCredits(projectId,supplierId));if(!current()||revision!==creditRevision)return;box.hidden=summary.available<=0;box.textContent=`رصيد دائن لدى المورد: ${money(summary.available,2)} — التطبيق النهائي حسب تأكيد الخادم`;}
   catch(errorValue){if(current()&&revision===creditRevision){box.hidden=false;box.textContent='تعذر قراءة الرصيد الدائن: '+errorValue.message;}}
  };
  drawItems();drawPayments();totals();
  if(pendingPayload){form.elements.supplier.value=pendingPayload.p_supplier_id;form.elements.note.value=pendingPayload.p_note||'';fields.disabled=true;submit.textContent='التحقق من الفاتورة السابقة';error.textContent='توجد فاتورة معلّقة؛ سنعيد نفس الطلب دون إضافة المخزون مرتين.';}
  if(blocked){fields.disabled=true;submit.disabled=true;error.textContent='تعذر قراءة الفاتورة السابقة؛ تحقق من السجل قبل تسجيل بديل.';}
  const save=async payload=>{
   if(busy||creatingSupplier||choosingProduct||reviewingCart||enteringLine||blocked||!current())return;let notify=false;
   try{
    if(!operation){
     validatePurchaseSnapshot(payload,{products,suppliers,accounts});
     if(!storage)throw new Error('تخزين الجلسة مطلوب لحماية إعادة المحاولة');
     const candidate=createOperation('confirm_sharikx2_purchase_v3',payload);
     const view={supplier:suppliers.find(supplier=>supplier.id===payload.p_supplier_id),products:products.filter(product=>payload.p_items.some(item=>item.product_id===product.id)).map(product=>({id:product.id,name:product.name})),accounts:accounts.filter(account=>payload.p_payments.some(payment=>payment.account_id===account.id)).map(account=>({id:account.id,name:account.name,balance:account.balance}))};
     submittedDraft=savedDraft?.id===draftId?savedDraft:null;
     storage.setItem(key,JSON.stringify({payload,requestId:candidate.requestId,view,unsentDraft:submittedDraft}));pendingPayload=payload;operation=candidate;addSupplier.hidden=true;entryButton.hidden=true;draftTools.hidden=true;refreshNotice();
    }
    busy=true;fields.disabled=true;submit.disabled=true;dialog.querySelector('[data-close]').disabled=true;error.textContent='';submit.textContent='جارٍ اعتماد الفاتورة…';
    const result=await operation.run(api);try{verifyPurchaseResult(result,pendingPayload);}catch(errorValue){operation=createOperation('confirm_sharikx2_purchase_v3',pendingPayload,operation.requestId);throw errorValue;}
    if(submittedDraft)removePurchaseDraft(storage,projectId,submittedDraft);else if(operation){const journal=JSON.parse(storage.getItem(key)||'null');if(journal?.unsentDraft)removePurchaseDraft(storage,projectId,journal.unsentDraft);}
    storage.removeItem(key);notify=current();dialog.remove();
   }catch(errorValue){error.textContent=(errorValue.message||'تعذر تسجيل الفاتورة')+(operation?' — أعد التحقق بنفس الطلب بأمان':'');}
   finally{busy=false;submit.disabled=false;dialog.querySelector('[data-close]').disabled=false;submit.textContent=operation?'التحقق وإعادة المحاولة':'تأكيد الفاتورة';}
   if(notify)onSaved?.();
  };
  form.onsubmit=event=>{
   event.preventDefault();if(busy||creatingSupplier||choosingProduct||reviewingCart||enteringLine||blocked||!current()||reviewDialog?.isConnected)return;
   try{
    if(operation){save();return;}
    if(!form.checkValidity()){form.reportValidity();return;}
    const payload=purchasePayload(projectId,form.elements.supplier.value,items,payments,form.elements.note.value.trim());validatePurchaseSnapshot(payload,{products,suppliers,accounts});
    const amounts=purchaseAmounts(payload);if(amounts.debt<=0.009){save(payload);return;}
    const captured=JSON.parse(JSON.stringify(payload));fields.disabled=true;reviewDialog=document.createElement('dialog');reviewDialog.className='purchase-debt-confirmation';
    reviewDialog.innerHTML=`<h2>تأكيد الفاتورة بالدين</h2><p>المتبقي كدين للمورد: <b>${money(amounts.debt,2)}</b></p><div class="actions"><button type="button" data-confirm-purchase class="primary">تأكيد بالدين</button><button type="button" data-back-purchase>رجوع للتعديل</button></div>`;
    document.body.append(reviewDialog);reviewDialog.showModal();
    let finished=false;const finish=()=>{if(finished)return false;finished=true;reviewDialog.remove();reviewDialog=null;if(current()&&!operation)fields.disabled=false;return true;};
    reviewDialog.querySelector('[data-back-purchase]').onclick=finish;reviewDialog.addEventListener('cancel',event=>{event.preventDefault();finish();});
    reviewDialog.querySelector('[data-confirm-purchase]').onclick=()=>{const allowed=current();if(finish()&&allowed)save(captured);};
   }catch(errorValue){error.textContent=errorValue.message;}
  };
 };
 if(blocked)render({products:[],suppliers:[],accounts:[]});
 else if(pendingPayload){
  const viewProducts=Array.isArray(pendingView?.products)?pendingView.products:[],viewAccounts=Array.isArray(pendingView?.accounts)?pendingView.accounts:[];
  const products=[...new Set(pendingPayload.p_items.map(item=>item.product_id))].map(id=>({id,name:viewProducts.find(product=>product?.id===id)?.name||'الصنف في الفاتورة السابقة'}));
  const suppliers=[{id:pendingPayload.p_supplier_id,name:pendingView?.supplier?.name||'المورد في الفاتورة السابقة'}];
  const accounts=pendingPayload.p_payments.map(payment=>({id:payment.account_id,name:viewAccounts.find(account=>account?.id===payment.account_id)?.name||'الحساب في الفاتورة السابقة',balance:viewAccounts.find(account=>account?.id===payment.account_id)?.balance||0}));
  render({products,suppliers,accounts});
 }else{
  const load=()=>Promise.all([api.allRows('products',projectId,'*',{active:'eq.true'}),api.allRows('suppliers',projectId,'*',{active:'eq.true'}),api.summary(projectId)]).then(([products,suppliers,summary])=>render({products,suppliers,accounts:summary.accounts||[]})).catch(errorValue=>{
   if(!current())return;dialog.querySelector('.body').innerHTML='<p role="alert"></p><button type="button" data-retry-purchase>إعادة المحاولة</button>';dialog.querySelector('[role=alert]').textContent=errorValue.message;dialog.querySelector('[data-retry-purchase]').onclick=()=>{dialog.querySelector('[data-retry-purchase]').disabled=true;load();};
  });load();
 }
 return dialog;
}
