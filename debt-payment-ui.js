import {escape,money} from './ui.js';
import {createOperation} from './operations.js';
import {collectionPayload,paymentPayload,debtPaymentRemaining,validateDebtPaymentSnapshot,validateDebtPaymentJournal,verifyDebtPaymentResult,supplierPaymentReview} from './debt-payment.js';
import {openSupplierPaymentReview} from './supplier-payment-review.js';
import {mountReceiptPicker} from './receipt-picker-ui.js';
import {createSupplierPaymentReceipt} from './supplier-payment-receipt.js';
import {receiptUuid} from './receipt-upload.js';
import {openReceiptUpload} from './receipt-upload-ui.js';

// Shared lifecycle and recovery; each domain retains its own RPC contract.
export function openDebtPayment({api,projectId,person,kind,mode,storage,onSaved,isCurrent=()=>true}){
 if(mode!=='owner')throw new Error('المشاركة للمشاهدة فقط');
 if(!projectId||!person?.id)throw new Error('بيانات الحساب غير مكتملة');
 if(!isCurrent())return;
 const supplier=kind==='supplier',rpc=supplier?'pay_sharikx2_supplier_web_v1':'collect_sharikx2_customer_debt_web_v1';
 const key=`sharikx2-pending-${supplier?'supplier-payment':'customer-collection'}:${projectId}:${person.id}`;
 if([...document.querySelectorAll('dialog[data-payment-key]')].some(dialog=>dialog.dataset.paymentKey===key))return;
 const dialog=document.createElement('dialog');dialog.className=supplier?'payment-dialog':'collection-dialog';
 dialog.dataset.paymentKey=key;
 dialog.innerHTML=`<h2>${supplier?'تسديد دفعة للمورد':'تسديد دفعة من'} ${escape(person.name)}</h2><div class="body"><div class="skeleton"></div></div><button data-close class="outline">إلغاء</button>`;
 document.body.append(dialog);dialog.showModal();
 const current=()=>isCurrent()&&dialog.isConnected&&dialog.open;
 let busy=false,operation=null,pendingPayload=null,blocked=false,receiptRequired=false,confirmedPayment=null,receiptPicker=null,attachmentDialog=null,reviewDialog=null,ended=false;
 const observer=new MutationObserver(()=>{if(!current())dispose();});
 const dispose=()=>{if(ended)return;ended=true;observer.disconnect();receiptPicker?.dispose();reviewDialog?.remove();attachmentDialog?.remove();dialog.remove();};
 const finish=()=>{const notify=current();dispose();if(notify)onSaved?.();};
 observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 const close=()=>{if(!busy&&!attachmentDialog&&!reviewDialog?.isConnected){if(confirmedPayment)finish();else dispose();}};dialog.querySelector('[data-close]').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 try{
  const saved=JSON.parse(storage?.getItem(key)||'null');
  if(saved){pendingPayload=validateDebtPaymentJournal(saved,kind,projectId,person.id);operation=createOperation(rpc,pendingPayload,saved.requestId);if(Object.hasOwn(saved,'receiptRequired')&&typeof saved.receiptRequired!=='boolean')throw Error('INVALID_RECEIPT_DRAFT');receiptRequired=saved.receiptRequired===true;if(receiptRequired&&!supplier)throw Error('INVALID_RECEIPT_DOMAIN');if(saved.confirmedPayment){if(!receiptRequired||!receiptUuid(saved.confirmedPayment.id))throw Error('INVALID_PAYMENT_RECEIPT');verifyDebtPaymentResult(saved.confirmedPayment,pendingPayload);confirmedPayment={id:saved.confirmedPayment.id,amount:Number(saved.confirmedPayment.amount)};}}
 }catch{blocked=true;}
 const render=accounts=>{
  if(!current())return;
  dialog.querySelector('.body').innerHTML=`<form><fieldset><p>الدين الحالي ${money(person.calculated_debt)}</p>${supplier?'<div data-sources></div><button type="button" data-add class="outline">إضافة حساب</button>':`<label>حساب الاستلام<select name="account" required>${accounts.map(a=>`<option value="${escape(a.id)}">${escape(a.name)} — الرصيد ${money(a.balance,2)}</option>`).join('')}</select></label><label>قيمة الدفعة<input name="amount" type="number" min="0.01" step="0.01" required></label><button type="button" data-full class="outline">تسديد كامل الدين</button>`}<label>ملاحظة اختيارية<textarea name="note"></textarea></label></fieldset><p data-payment-total></p><p data-remaining></p><p role="alert"></p><button type="submit" class="primary">${supplier?'تسجيل الدفعة':'تسجيل التحصيل'}</button></form>`;
  const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),error=form.querySelector('[role=alert]'),submit=form.querySelector('[type=submit]');
  const sync=()=>{submit.disabled=blocked||busy||!!receiptPicker?.processing||!!attachmentDialog||!!reviewDialog?.isConnected;dialog.querySelector('[data-close]').disabled=busy||!!attachmentDialog;};
  if(supplier){
   const section=document.createElement('section');section.className='panel payment-receipt-section';section.innerHTML='<h3>فاتورة السداد — اختياري</h3><div data-payment-receipt></div>';fields.append(section);
   if(!blocked&&(!operation||receiptRequired&&!confirmedPayment))receiptPicker=mountReceiptPicker({container:section.querySelector('div'),isCurrent:current,canEdit:()=>current()&&!busy&&!reviewDialog?.isConnected&&!confirmedPayment, onChange:sync,hint:'JPEG أو PNG أو WebP حتى 6 ميجابايت. يُرفع الإيصال ويُتحقق منه قبل إرسال الدفعة، كما في Android. عند الاسترجاع أعد اختيار نفس الملف إن لم يصل؛ الصورة لا تُحفظ محليًا.'});
   else section.querySelector('div').textContent=confirmedPayment?'الدفعة محفوظة؛ يجري استكمال ربط الإيصال فقط.':'لا توجد صورة محفوظة في هذه المحاولة؛ يمكن إرفاقها من السجل بعد تأكيد الدفعة.';
   // Original money fields stay locked during recovery; the original file may
   // still be reselected without changing captured accounts/amounts.
   if(operation&&receiptRequired&&!confirmedPayment)fields.after(section);
  }
  let sources=pendingPayload?.p_sources?.map(source=>({...source}))||[];
  const updateTotals=()=>{
   const amount=supplier?sources.reduce((sum,x)=>sum+Number(x.amount||0),0):Number(form.elements.amount.value||0);
   form.querySelector('[data-payment-total]').textContent=`إجمالي الدفعة: ${money(amount,2)}`;
   form.querySelector('[data-remaining]').textContent=`المتبقي بعد السداد: ${money(debtPaymentRemaining(person.calculated_debt,amount),2)}`;
  };
  const drawSources=()=>{
   form.querySelector('[data-sources]').innerHTML=sources.map((source,index)=>`<div class="panel"><label>الحساب<select data-account="${index}">${accounts.map(account=>`<option value="${escape(account.id)}" ${account.id===source.account_id?'selected':''}>${escape(account.name)} — المتاح ${money(account.balance,2)}</option>`).join('')}</select></label><label>المبلغ<input data-amount="${index}" type="number" min="0.01" step="0.01" value="${escape(source.amount)}" required></label><button type="button" data-remove="${index}" class="danger">حذف</button></div>`).join('')||'<p class="muted">لم تضف دفعة</p>';
   form.querySelectorAll('[data-account]').forEach(input=>input.onchange=()=>sources[+input.dataset.account].account_id=input.value);
   form.querySelectorAll('[data-amount]').forEach(input=>input.oninput=()=>{sources[+input.dataset.amount].amount=Number(input.value);updateTotals();});
   form.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{sources.splice(+button.dataset.remove,1);drawSources();});updateTotals();
  };
  if(supplier){drawSources();form.querySelector('[data-add]').onclick=()=>{const account=accounts.find(a=>!sources.some(source=>source.account_id===a.id));if(!account){error.textContent='لا يوجد حساب إضافي متاح';return;}sources.push({account_id:account.id,amount:0});drawSources();};}
  else{
   if(pendingPayload){form.elements.amount.value=pendingPayload.p_amount;form.elements.account.value=pendingPayload.p_account_id;}
   form.elements.amount.oninput=updateTotals;
   form.querySelector('[data-full]').onclick=()=>{form.elements.amount.value=Math.max(0,Number(person.calculated_debt));updateTotals();};updateTotals();
  }
  if(pendingPayload){form.elements.note.value=pendingPayload.p_note||'';fields.disabled=true;error.textContent='توجد دفعة معلّقة؛ سنُعيد نفس الطلب دون إنشاء دفعة أخرى.';submit.textContent='التحقق من الدفعة السابقة';}
  if(blocked){fields.disabled=true;submit.disabled=true;error.textContent='تعذر قراءة الدفعة السابقة؛ تحقق من السجل قبل تسجيل بديل.';}
  const initialLabel=supplier?'مراجعة الدفعة':'تسجيل التحصيل';
  if(!operation&&!blocked)submit.textContent=initialLabel;
  const savePayment=async payload=>{
   if(busy||blocked||receiptPicker?.processing||attachmentDialog||!current())return;
   let saved=false,attachmentTarget=null;
   const persistFinancial=()=>{const value={payload:pendingPayload,requestId:operation.requestId,...(receiptRequired?{receiptRequired:true,...(confirmedPayment?{confirmedPayment}: {})}:{})},json=JSON.stringify(value);storage.setItem(key,json);if(storage.getItem(key)!==json)throw Error('تعذر تثبيت محاولة السداد؛ لم يُرسل طلب جديد');};
   try{
    if(!operation){
     validateDebtPaymentSnapshot(payload,person.calculated_debt,accounts);
     if(!storage)throw new Error('تخزين الجلسة مطلوب لحماية إعادة المحاولة');
     const candidate=createOperation(rpc,payload);receiptRequired=supplier&&!!receiptPicker?.file;
     const json=JSON.stringify({payload,requestId:candidate.requestId,...(receiptRequired?{receiptRequired:true}:{})});storage.setItem(key,json);if(storage.getItem(key)!==json)throw Error('تعذر تثبيت محاولة السداد؛ لم تُرسل الدفعة');pendingPayload=payload;operation=candidate;
    }
    busy=true;fields.disabled=true;submit.disabled=true;dialog.querySelector('[data-close]').disabled=true;submit.textContent='جارٍ الحفظ…';error.textContent='';
    const receipt=receiptRequired?createSupplierPaymentReceipt({api,storage,scope:{projectId,supplierId:person.id,requestId:operation.requestId},isCurrent:current}):null;
    if(receipt&&!confirmedPayment){submit.textContent='جارٍ التحقق من رفع الإيصال قبل السداد…';await receipt.prepare(receiptPicker?.file);if(!current())return;}
    const result=confirmedPayment||await operation.run(api);
    try{verifyDebtPaymentResult(result,pendingPayload);if(receiptRequired&&!receiptUuid(result.id))throw Error('تعذر تأكيد هوية الدفعة');}catch(error){operation=createOperation(rpc,pendingPayload,operation.requestId);throw error;}
    if(receipt){confirmedPayment={id:result.id,amount:Number(result.amount)};persistFinancial();attachmentTarget=await receipt.adopt(result.id,Number(result.amount));if(!current())return;}
    storage.removeItem(key);if(storage.getItem(key)!==null)throw Error('تعذر إنهاء سجل محاولة السداد');saved=current();
   }catch(errorValue){error.textContent=(errorValue.message||'تعذر تسجيل الدفعة')+(confirmedPayment?' — الدفعة محفوظة؛ استكمل الإيصال دون سداد جديد.':operation?' — أعد التحقق بنفس الطلب بأمان':'');}
   finally{busy=false;sync();submit.textContent=confirmedPayment?'استكمال إيصال الدفعة المحفوظة':operation?'التحقق وإعادة المحاولة':initialLabel;if(!current())dispose();}
   // A callback failure is not a payment failure and must not prompt a new write.
   if(saved){
    if(attachmentTarget){attachmentDialog=openReceiptUpload({api,target:attachmentTarget,mode,storage,owner:dialog,isCurrent:current,autoResume:true,onClose:()=>{attachmentDialog=null;finish();}});if(attachmentDialog)sync();else finish();}
    else finish();
   }
  };
  form.onsubmit=event=>{
   event.preventDefault();if(busy||blocked||receiptPicker?.processing||attachmentDialog||!current()||reviewDialog?.isConnected)return;
   try{
    if(operation){savePayment();return;}
    const payload=supplier?paymentPayload(projectId,person.id,sources,form.elements.note.value.trim()):collectionPayload(projectId,person,Number(form.elements.amount.value),form.elements.account.value,form.elements.note.value);
    validateDebtPaymentSnapshot(payload,person.calculated_debt,accounts);
    if(!supplier){savePayment(payload);return;}
    const review=supplierPaymentReview(payload,person,accounts);error.textContent='';fields.disabled=true;
    reviewDialog=openSupplierPaymentReview({review,mode,isCurrent:current,hasReceipt:!!receiptPicker?.file,onConfirm:savePayment,onClose:()=>{reviewDialog=null;if(current()&&!operation)fields.disabled=false;sync();}});sync();
   }catch(errorValue){error.textContent=errorValue.message||'تعذر مراجعة الدفعة';}
  };
  sync();
 };
 if(blocked)render([]);
 else if(pendingPayload){
  // A retry must not be checked against balances/debt that may already reflect it.
  const ids=supplier?pendingPayload.p_sources.map(source=>source.account_id):[pendingPayload.p_account_id];
  render(ids.map(id=>({id,name:'الحساب المحدد في الدفعة السابقة',balance:0})));
 }else{
  const load=()=>Promise.resolve().then(()=>api.summary(projectId)).then(summary=>render(summary.accounts||[])).catch(error=>{
   if(!current())return;
   dialog.querySelector('.body').innerHTML='<p role="alert"></p><button type="button" data-retry>إعادة تحميل الحسابات</button>';
   dialog.querySelector('[role=alert]').textContent=error.message;
   dialog.querySelector('[data-retry]').onclick=()=>{dialog.querySelector('[data-retry]').disabled=true;load();};
  });load();
 }
 return dialog;
}
