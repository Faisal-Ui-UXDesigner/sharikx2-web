import {escape,money} from './ui.js';
import {createOperation} from './operations.js';
import {collectionPayload,paymentPayload,debtPaymentRemaining,validateDebtPaymentSnapshot,validateDebtPaymentJournal,verifyDebtPaymentResult,supplierPaymentReview} from './debt-payment.js';
import {openSupplierPaymentReview} from './supplier-payment-review.js';

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
 const current=()=>isCurrent()&&dialog.isConnected;
 let busy=false,operation=null,pendingPayload=null,blocked=false;
 const close=()=>{if(!busy)dialog.remove();};dialog.querySelector('[data-close]').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 try{
  const saved=JSON.parse(storage?.getItem(key)||'null');
  if(saved){pendingPayload=validateDebtPaymentJournal(saved,kind,projectId,person.id);operation=createOperation(rpc,pendingPayload,saved.requestId);}
 }catch{blocked=true;}
 const render=accounts=>{
  if(!current())return;
  dialog.querySelector('.body').innerHTML=`<form><fieldset><p>الدين الحالي ${money(person.calculated_debt)}</p>${supplier?'<div data-sources></div><button type="button" data-add class="outline">إضافة حساب</button>':`<label>حساب الاستلام<select name="account" required>${accounts.map(a=>`<option value="${escape(a.id)}">${escape(a.name)} — الرصيد ${money(a.balance,2)}</option>`).join('')}</select></label><label>قيمة الدفعة<input name="amount" type="number" min="0.01" step="0.01" required></label><button type="button" data-full class="outline">تسديد كامل الدين</button>`}<label>ملاحظة اختيارية<textarea name="note"></textarea></label></fieldset><p data-payment-total></p><p data-remaining></p><p role="alert"></p><button type="submit" class="primary">${supplier?'تسجيل الدفعة':'تسجيل التحصيل'}</button></form>`;
  const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),error=form.querySelector('[role=alert]'),submit=form.querySelector('[type=submit]');
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
  let reviewDialog=null;
  const initialLabel=supplier?'مراجعة الدفعة':'تسجيل التحصيل';
  if(!operation&&!blocked)submit.textContent=initialLabel;
  const savePayment=async payload=>{
   if(busy||blocked||!current())return;
   let saved=false;
   try{
    if(!operation){
     validateDebtPaymentSnapshot(payload,person.calculated_debt,accounts);
     if(!storage)throw new Error('تخزين الجلسة مطلوب لحماية إعادة المحاولة');
     const candidate=createOperation(rpc,payload);storage.setItem(key,JSON.stringify({payload,requestId:candidate.requestId}));pendingPayload=payload;operation=candidate;
    }
    busy=true;fields.disabled=true;submit.disabled=true;dialog.querySelector('[data-close]').disabled=true;submit.textContent='جارٍ الحفظ…';error.textContent='';
    const result=await operation.run(api);
    try{verifyDebtPaymentResult(result,pendingPayload);}catch(error){operation=createOperation(rpc,pendingPayload,operation.requestId);throw error;}
    storage.removeItem(key);saved=current();dialog.remove();
   }catch(errorValue){error.textContent=(errorValue.message||'تعذر تسجيل الدفعة')+(operation?' — أعد التحقق بنفس الطلب بأمان':'');}
   finally{busy=false;submit.disabled=false;dialog.querySelector('[data-close]').disabled=false;submit.textContent=operation?'التحقق وإعادة المحاولة':initialLabel;}
   // A callback failure is not a payment failure and must not prompt a new write.
   if(saved)onSaved?.();
  };
  form.onsubmit=event=>{
   event.preventDefault();if(busy||blocked||!current()||reviewDialog?.isConnected)return;
   try{
    if(operation){savePayment();return;}
    const payload=supplier?paymentPayload(projectId,person.id,sources,form.elements.note.value.trim()):collectionPayload(projectId,person,Number(form.elements.amount.value),form.elements.account.value,form.elements.note.value);
    validateDebtPaymentSnapshot(payload,person.calculated_debt,accounts);
    if(!supplier){savePayment(payload);return;}
    const review=supplierPaymentReview(payload,person,accounts);error.textContent='';fields.disabled=true;
    reviewDialog=openSupplierPaymentReview({review,mode,isCurrent:current,onConfirm:savePayment,onClose:()=>{reviewDialog=null;if(current()&&!operation)fields.disabled=false;}});
   }catch(errorValue){error.textContent=errorValue.message||'تعذر مراجعة الدفعة';}
  };
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
