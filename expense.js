import {escape,money,expenseMoney,timestamp} from './ui.js';
import {createOperation} from './operations.js';
import {openExpenseDetails} from './expense-details-ui.js';
import {expenseEntryAccounts,expenseEntryType,expensePayload,verifyExpenseResult} from './expense-entry.js';
import {expenseTypeMarkup,expenseEntryMarkup} from './expense-entry-ui.js';
import {mountReceiptPicker} from './receipt-picker-ui.js';
import {openReceiptUpload} from './receipt-upload-ui.js';
import {receiptUploadTarget} from './receipt-upload.js';
export {expensePayload} from './expense-entry.js';
export async function openExpense({api,projectId,mode,container,onSaved,storage,isCurrent=()=>true}){
 if(mode!=='owner')throw new Error('المشاركة للمشاهدة فقط');
 if(!isCurrent()||!container?.isConnected)return;
 if(document.querySelector('dialog.expense-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='expense-dialog';
 dialog.setAttribute('aria-label','مصروف جديد');
 dialog.innerHTML='<h2>اختر نوع الحركة</h2><div class="expense-body"></div><button class="outline close-expense">إلغاء</button>';
 container.append(dialog);dialog.showModal();let busy=false,operation=null,uncertain=false,confirmed=false,pendingPayload=null,accounts=[];
 const journalKey=`sharikx2-pending-expense:${projectId}`;
 const clearJournal=()=>{storage.removeItem(journalKey);if(storage.getItem(journalKey)!==null)throw Error('تعذر إنهاء سجل محاولة المصروف');};
 const current=()=>dialog.isConnected&&dialog.open&&isCurrent();
 const close=()=>{if(!busy)dialog.remove();};dialog.querySelector('.close-expense').onclick=close;
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 const body=dialog.querySelector('.expense-body');let saved=null,loading=false;
 try{
  saved=JSON.parse(storage?.getItem(journalKey)||'null');
  if(saved!==null){if(!saved?.payload||saved.payload.p_project_id!==projectId||!saved.requestId)throw Error('INVALID_PENDING_EXPENSE');expenseEntryType(saved.payload.p_category);}
 }catch{body.innerHTML='<p role="alert">تعذر قراءة العملية السابقة؛ تحقق من السجل قبل تسجيل مصروف بديل.</p>';return;}
 const render=async category=>{if(!current()||loading)return;loading=true;
 try{
  const type=expenseEntryType(category);dialog.querySelector('h2').textContent='إضافة '+type.label;dialog.setAttribute('aria-label','إضافة '+type.label);
  body.innerHTML='<div class="skeleton"></div>';
  const summary=await api.summary(projectId);if(!current())return;accounts=expenseEntryAccounts(summary?.accounts);
  body.innerHTML=expenseEntryMarkup(accounts,type.category);
  const form=body.querySelector('form'),fieldset=form.querySelector('fieldset'),button=form.querySelector('[type=submit]'),errorText=form.querySelector('[role=alert]');
  let receiptPicker;
  const syncConfirmation=()=>{button.disabled=busy||!!receiptPicker?.processing||(!operation&&!accounts.length);};
  const receiptContainer=form.querySelector('[data-expense-receipt]');
  if(!saved)receiptPicker=mountReceiptPicker({container:receiptContainer,isCurrent:current,canEdit:()=>current()&&!busy&&!operation,onChange:syncConfirmation});
  else receiptContainer.textContent='لا تُستعاد الصورة من سجل المحاولة المالية. بعد تأكيد المصروف، يمكن إرفاقها من تفاصيله.';
  const showRemaining=()=>{const raw=form.elements.amount.value,amount=Number(raw),selected=form.elements.account?.value;for(const node of form.querySelectorAll('[data-left]')){const account=accounts.find(account=>account.id===node.dataset.left);node.textContent=raw!==''&&Number.isFinite(amount)&&amount>0&&selected===account.id?`بعد الدفع: ${money(account.balance-amount,2)}`:'';}};
  form.oninput=showRemaining;
  try{if(saved){
   pendingPayload=saved.payload;operation=createOperation('confirm_sharikx2_expense_web_v1',pendingPayload,saved.requestId);uncertain=true;
   form.elements.description.value=saved.payload.p_description;form.elements.amount.value=saved.payload.p_amount;form.elements.category.value=saved.payload.p_category==='daily_wages'?'daily_wage':saved.payload.p_category;
   for(const input of form.querySelectorAll('[name=account]'))input.checked=input.value===saved.payload.p_account_id;
   fieldset.disabled=true;button.disabled=false;button.textContent='التحقق من العملية السابقة';errorText.textContent='هناك عملية لم تتأكد نتيجتها. سنعيد نفس الطلب دون تسجيل مصروف آخر.';
  }}catch{errorText.textContent='تعذر قراءة مسودة العملية السابقة؛ لا تؤكد مصروفًا بديلًا قبل التحقق من السجل.';button.disabled=true;}
  showRemaining();
  form.onsubmit=async e=>{
   e.preventDefault();if(busy||receiptPicker?.processing||!current()||button.disabled)return;let notify=false,attachment=null;
   try{
    if(!operation){const values=Object.fromEntries(new FormData(form)),payload=expensePayload(projectId,values,accounts);
     // Persist before submission: otherwise a reload could turn retry into a new expense.
     if(!storage)throw new Error('يلزم تفعيل تخزين الجلسة لحماية العملية من التكرار');
     const candidate=createOperation('confirm_sharikx2_expense_web_v1',payload);
     const journal=JSON.stringify({requestId:candidate.requestId,payload});storage.setItem(journalKey,journal);
     if(storage.getItem(journalKey)!==journal)throw Error('تعذر تثبيت محاولة المصروف؛ لم يُرسل الطلب');
     pendingPayload=payload;operation=candidate;
    }
    busy=true;fieldset.disabled=true;button.disabled=true;dialog.querySelector('.close-expense').disabled=true;button.textContent=uncertain?'جارٍ التحقق…':'جارٍ الحفظ…';errorText.textContent='';
    const result=await operation.run(api);
    try{verifyExpenseResult(result,pendingPayload);if(receiptPicker?.file)attachment={file:receiptPicker.file,target:receiptUploadTarget({projectId,kind:'expense',recordId:result.id})};}
    catch(error){operation=createOperation('confirm_sharikx2_expense_web_v1',pendingPayload,operation.requestId);throw error;}
    confirmed=true;clearJournal();notify=current();dialog.remove();
   }catch(error){
    errorText.textContent=error.message==='INSUFFICIENT_ACCOUNT_BALANCE'?'تغيّر رصيد الحساب؛ المبلغ المتاح لا يكفي الآن.':error.message;
    const knownRejected=Number(error.status)>=400&&Number(error.status)<500;
    if(knownRejected&&!uncertain&&!confirmed){
     try{clearJournal();operation=null;pendingPayload=null;fieldset.disabled=false;}
     catch{uncertain=true;fieldset.disabled=true;errorText.textContent+=' — تعذر إنهاء سجل الطلب المرفوض؛ احتُفظ بهويته للتحقق الآمن.';}
    }else if(operation){uncertain=true;fieldset.disabled=true;errorText.textContent+=confirmed?' — تأكد حفظ المصروف؛ تعذر إنهاء سجل المحاولة. التحقق لا يسجله مرة أخرى.':' — لا نعرف إن اكتمل الحفظ. اضغط التحقق لإعادة نفس الطلب بأمان.';}
    button.textContent=uncertain?'التحقق وإعادة المحاولة':'تأكيد';
   }finally{busy=false;syncConfirmation();dialog.querySelector('.close-expense').disabled=false;}
   // Image transport and callbacks cannot re-enter the financial retry handler.
   if(notify){
    if(attachment){const child=openReceiptUpload({api,target:attachment.target,initialFile:attachment.file,autoUpload:true,mode,storage,owner:container,isCurrent:()=>container.isConnected&&isCurrent(),onClose:()=>{if(container.isConnected&&isCurrent())onSaved?.();}});if(!child)onSaved?.();}
    else onSaved?.();
   }
  };
 }catch(error){if(current()){body.innerHTML='<p role="alert"></p><button type="button" data-retry-expense>إعادة المحاولة</button>';body.querySelector('[role=alert]').textContent=error.message;body.querySelector('[data-retry-expense]').onclick=()=>render(category);}}
 finally{loading=false;}
 };
 if(saved){await render(saved.payload.p_category);return;}
 body.innerHTML=expenseTypeMarkup();
 body.querySelectorAll('[data-expense-type]').forEach(button=>button.onclick=()=>render(button.dataset.expenseType));
}
export async function renderExpenses({api,projectId,container,isCurrent,mode='viewer',onSaved=()=>{},allowMutations=false,storage}){
 const section=document.createElement('section');container.append(section);section.innerHTML='<h2>آخر المصاريف</h2><div class="skeleton"></div>';
 try{const rows=await api.rows('expenses',projectId,'*,account:sharikx2_accounts(name)');if(!isCurrent()||!section.isConnected)return;
  section.innerHTML='<h2>آخر المصاريف</h2>'+(rows.length?rows.map(x=>`<button class="panel record row" data-expense="${escape(x.id)}"><div><b>${escape(x.description)}</b><p class="muted">${escape(x.account?.name||'حساب غير محدد')}</p><small>${escape(timestamp(x.created_at||x.occurred_at))}</small></div><strong class="expense-amount">${expenseMoney(x.amount)}</strong></button>`).join(''):'<p>لا توجد مصاريف</p>')+(rows.length===20?'<p class="muted small">أحدث 20 مصروفًا</p>':'');
  section.querySelectorAll('[data-expense]').forEach(button=>button.onclick=()=>{
   if(!isCurrent()||!section.isConnected)return;
   openExpenseDetails({item:rows.find(x=>x.id===button.dataset.expense),api,projectId,mode,onSaved,allowMutations,storage,isCurrent:()=>section.isConnected&&isCurrent()});
  });
 }catch(error){if(section.isConnected&&isCurrent())section.textContent=error.message;}
}
