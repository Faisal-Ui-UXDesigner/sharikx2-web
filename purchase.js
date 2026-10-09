import {escape,money} from './ui.js';
import {createOperation} from './operations.js';
import {supplierCreditSummary} from './supplier-credit.js';
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
 let busy=false,operation=null,pendingPayload=null,pendingView=null,blocked=false,reviewDialog=null;
 const close=()=>{if(!busy){reviewDialog?.remove();dialog.remove();}};dialog.querySelector('[data-close]').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 try{const saved=JSON.parse(storage?.getItem(key)||'null');if(saved){pendingPayload=purchaseJournalPayload(saved,projectId);pendingView=saved.view;operation=createOperation('confirm_sharikx2_purchase_v3',pendingPayload,saved.requestId);}}catch{blocked=true;}
 const render=({products,suppliers,accounts})=>{
  if(!current())return;
  let items=pendingPayload?.p_items.map(item=>({product_id:item.product_id,quantity:item.quantity_pieces,cost:item.unit_cost}))||[],payments=pendingPayload?.p_payments.map(payment=>({...payment}))||[],creditRevision=0;
  dialog.querySelector('.body').innerHTML=`<form><fieldset><label>المورد<select name="supplier" required><option value="">اختر المورد</option>${suppliers.map(supplier=>`<option value="${escape(supplier.id)}">${escape(supplier.name)} — ${escape(supplier.phone||'بدون رقم')}</option>`).join('')}</select></label><div class="panel supplier-credit" data-credit hidden></div><h3>الأصناف</h3><div data-items></div><button type="button" data-add class="outline">إضافة صنف</button><h3>الدفعات الحالية للمورد</h3><div data-payments></div><button type="button" data-pay class="outline">إضافة دفعة</button><label>ملاحظات اختيارية<textarea name="note" maxlength="500"></textarea></label></fieldset><p>إجمالي الفاتورة: <b data-total></b></p><p>المتبقي قبل تطبيق أي رصيد دائن: <b data-debt></b></p><p role="alert"></p><button type="submit" class="primary">تأكيد الفاتورة</button></form>`;
  const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),error=form.querySelector('[role=alert]'),submit=form.querySelector('[type=submit]');
  const totals=()=>{const total=items.reduce((sum,item)=>sum+item.quantity*item.cost,0),paid=payments.reduce((sum,payment)=>sum+payment.amount,0);form.querySelector('[data-total]').textContent=money(total,2);form.querySelector('[data-debt]').textContent=money(Math.max(0,total-paid),2);};
  const drawItems=()=>{
   form.querySelector('[data-items]').innerHTML=items.map((item,index)=>`<div class="panel"><label>الصنف<select data-product="${index}">${products.map(product=>`<option value="${escape(product.id)}" ${product.id===item.product_id?'selected':''}>${escape(product.name)}</option>`).join('')}</select></label><div class="input-pair"><label>الكمية بالقطعة<input data-qty="${index}" type="number" min="0.001" step="0.001" value="${escape(item.quantity)}" required></label><label>تكلفة القطعة<input data-cost="${index}" type="number" min="0" step="0.01" value="${escape(item.cost)}" required></label></div><button type="button" data-remove="${index}" class="danger">حذف الصنف</button></div>`).join('')||'<p class="muted">لم تضف أصنافًا بعد</p>';
   form.querySelectorAll('[data-product]').forEach(input=>input.onchange=()=>items[+input.dataset.product].product_id=input.value);
   form.querySelectorAll('[data-qty],[data-cost]').forEach(input=>input.oninput=()=>{const index=+(input.dataset.qty??input.dataset.cost);items[index][input.dataset.qty!==undefined?'quantity':'cost']=Number(input.value);totals();});
   form.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{items.splice(+button.dataset.remove,1);drawItems();totals();});
  };
  const drawPayments=()=>{
   form.querySelector('[data-payments]').innerHTML=payments.map((payment,index)=>`<div class="panel"><label>الحساب<select data-account="${index}">${accounts.map(account=>`<option value="${escape(account.id)}" ${account.id===payment.account_id?'selected':''}>${escape(account.name)} — المتاح ${money(account.balance,2)}</option>`).join('')}</select></label><label>المبلغ<input data-payamount="${index}" type="number" min="0.01" step="0.01" value="${escape(payment.amount)}" required></label><button type="button" data-removepay="${index}" class="danger">حذف الدفعة</button></div>`).join('')||'<p class="muted">لم تضف دفعات؛ الباقي يصبح دينًا للمورد.</p>';
   form.querySelectorAll('[data-account]').forEach(input=>input.onchange=()=>payments[+input.dataset.account].account_id=input.value);
   form.querySelectorAll('[data-payamount]').forEach(input=>input.oninput=()=>{payments[+input.dataset.payamount].amount=Number(input.value);totals();});
   form.querySelectorAll('[data-removepay]').forEach(button=>button.onclick=()=>{payments.splice(+button.dataset.removepay,1);drawPayments();totals();});
  };
  form.querySelector('[data-add]').onclick=()=>{if(!products.length){error.textContent='أضف صنفًا في البضاعة أولًا';return;}items.push({product_id:products[0].id,quantity:1,cost:Number(products[0].weighted_unit_cost||0)});drawItems();totals();};
  form.querySelector('[data-pay]').onclick=()=>{const account=accounts.find(account=>!payments.some(payment=>payment.account_id===account.id));if(!account){error.textContent='لا يوجد حساب إضافي متاح';return;}payments.push({account_id:account.id,amount:0});drawPayments();totals();};
  form.elements.supplier.onchange=async()=>{
   const box=form.querySelector('[data-credit]'),supplierId=form.elements.supplier.value,revision=++creditRevision;box.hidden=!supplierId;
   if(!supplierId)return;box.textContent='جارٍ قراءة الرصيد الدائن…';
   try{const summary=supplierCreditSummary(await api.supplierCredits(projectId,supplierId));if(!current()||revision!==creditRevision)return;box.hidden=summary.available<=0;box.textContent=`رصيد دائن لدى المورد: ${money(summary.available,2)} — التطبيق النهائي حسب تأكيد الخادم`;}
   catch(errorValue){if(current()&&revision===creditRevision){box.hidden=false;box.textContent='تعذر قراءة الرصيد الدائن: '+errorValue.message;}}
  };
  drawItems();drawPayments();totals();
  if(pendingPayload){form.elements.supplier.value=pendingPayload.p_supplier_id;form.elements.note.value=pendingPayload.p_note||'';fields.disabled=true;submit.textContent='التحقق من الفاتورة السابقة';error.textContent='توجد فاتورة معلّقة؛ سنعيد نفس الطلب دون إضافة المخزون مرتين.';}
  if(blocked){fields.disabled=true;submit.disabled=true;error.textContent='تعذر قراءة الفاتورة السابقة؛ تحقق من السجل قبل تسجيل بديل.';}
  const save=async payload=>{
   if(busy||blocked||!current())return;let notify=false;
   try{
    if(!operation){
     validatePurchaseSnapshot(payload,{products,suppliers,accounts});
     if(!storage)throw new Error('تخزين الجلسة مطلوب لحماية إعادة المحاولة');
     const candidate=createOperation('confirm_sharikx2_purchase_v3',payload);
     const view={supplier:suppliers.find(supplier=>supplier.id===payload.p_supplier_id),products:products.filter(product=>payload.p_items.some(item=>item.product_id===product.id)).map(product=>({id:product.id,name:product.name})),accounts:accounts.filter(account=>payload.p_payments.some(payment=>payment.account_id===account.id)).map(account=>({id:account.id,name:account.name,balance:account.balance}))};
     storage.setItem(key,JSON.stringify({payload,requestId:candidate.requestId,view}));pendingPayload=payload;operation=candidate;
    }
    busy=true;fields.disabled=true;submit.disabled=true;dialog.querySelector('[data-close]').disabled=true;error.textContent='';submit.textContent='جارٍ اعتماد الفاتورة…';
    const result=await operation.run(api);try{verifyPurchaseResult(result,pendingPayload);}catch(errorValue){operation=createOperation('confirm_sharikx2_purchase_v3',pendingPayload,operation.requestId);throw errorValue;}
    storage.removeItem(key);notify=current();dialog.remove();
   }catch(errorValue){error.textContent=(errorValue.message||'تعذر تسجيل الفاتورة')+(operation?' — أعد التحقق بنفس الطلب بأمان':'');}
   finally{busy=false;submit.disabled=false;dialog.querySelector('[data-close]').disabled=false;submit.textContent=operation?'التحقق وإعادة المحاولة':'تأكيد الفاتورة';}
   if(notify)onSaved?.();
  };
  form.onsubmit=event=>{
   event.preventDefault();if(busy||blocked||!current()||reviewDialog?.isConnected)return;
   try{
    if(operation){save();return;}
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
