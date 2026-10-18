import {escape,money,expenseMoney,timestamp} from './ui.js';
import {createOperation} from './operations.js';
import {editExpense,deleteExpense} from './expense-mutation.js';
import {expenseEntryAccounts,expenseEntryType} from './expense-entry.js';
import {expenseTypeMarkup,expenseEntryMarkup} from './expense-entry-ui.js';
export function expensePayload(projectId,values,accounts){
 const amount=Number(values.amount),account=accounts.find(x=>x.id===values.account);
 if(!String(values.description||'').trim())throw new Error('أدخل وصف المصروف');
 if(!Number.isFinite(amount)||amount<=0||Math.round(amount*100)!==amount*100&&Math.abs(Math.round(amount*100)-amount*100)>1e-8)throw new Error('أدخل مبلغًا صحيحًا حتى منزلتين عشريتين');
 if(!account)throw new Error('اختر حساب الدفع');
 if(amount>Number(account.balance))throw new Error('المبلغ أكبر من الرصيد المتاح في الحساب');
 return {p_project_id:projectId,p_category:['daily_wage','daily_wages'].includes(values.category)?'daily_wage':'operating_expense',p_description:String(values.description).trim(),p_amount:amount,p_account_id:account.id};
}
export async function openExpense({api,projectId,mode,container,onSaved,storage,isCurrent=()=>true}){
 if(mode!=='owner')throw new Error('المشاركة للمشاهدة فقط');
 if(!isCurrent()||!container?.isConnected)return;
 if(document.querySelector('dialog.expense-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='expense-dialog';
 dialog.setAttribute('aria-label','مصروف جديد');
 dialog.innerHTML='<h2>اختر نوع الحركة</h2><div class="expense-body"></div><button class="outline close-expense">إلغاء</button>';
 container.append(dialog);dialog.showModal();let busy=false,operation=null,uncertain=false,accounts=[];
 const journalKey=`sharikx2-pending-expense:${projectId}`;
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
  const showRemaining=()=>{const raw=form.elements.amount.value,amount=Number(raw),selected=form.elements.account?.value;for(const node of form.querySelectorAll('[data-left]')){const account=accounts.find(account=>account.id===node.dataset.left);node.textContent=raw!==''&&Number.isFinite(amount)&&amount>0&&selected===account.id?`بعد الدفع: ${money(account.balance-amount,2)}`:'';}};
  form.oninput=showRemaining;
  try{if(saved){
   operation=createOperation('confirm_sharikx2_expense_web_v1',saved.payload,saved.requestId);uncertain=true;
   form.elements.description.value=saved.payload.p_description;form.elements.amount.value=saved.payload.p_amount;form.elements.category.value=saved.payload.p_category==='daily_wages'?'daily_wage':saved.payload.p_category;
   for(const input of form.querySelectorAll('[name=account]'))input.checked=input.value===saved.payload.p_account_id;
   fieldset.disabled=true;button.disabled=false;button.textContent='التحقق من العملية السابقة';errorText.textContent='هناك عملية لم تتأكد نتيجتها. سنعيد نفس الطلب دون تسجيل مصروف آخر.';
  }}catch{errorText.textContent='تعذر قراءة مسودة العملية السابقة؛ لا تؤكد مصروفًا بديلًا قبل التحقق من السجل.';button.disabled=true;}
  showRemaining();
  form.onsubmit=async e=>{
   e.preventDefault();if(busy||!current()||button.disabled)return;
   try{
    if(!operation){const values=Object.fromEntries(new FormData(form)),payload=expensePayload(projectId,values,accounts);
     // Persist before submission: otherwise a reload could turn retry into a new expense.
     if(!storage)throw new Error('يلزم تفعيل تخزين الجلسة لحماية العملية من التكرار');
     const candidate=createOperation('confirm_sharikx2_expense_web_v1',payload);
     storage.setItem(journalKey,JSON.stringify({requestId:candidate.requestId,payload}));operation=candidate;
    }
    busy=true;fieldset.disabled=true;button.disabled=true;dialog.querySelector('.close-expense').disabled=true;button.textContent=uncertain?'جارٍ التحقق…':'جارٍ الحفظ…';errorText.textContent='';
    await operation.run(api);storage.removeItem(journalKey);const notify=current();dialog.remove();if(notify)onSaved?.();
   }catch(error){
    errorText.textContent=error.message==='INSUFFICIENT_ACCOUNT_BALANCE'?'تغيّر رصيد الحساب؛ المبلغ المتاح لا يكفي الآن.':error.message;
    const knownRejected=Number(error.status)>=400&&Number(error.status)<500;
    if(knownRejected){storage?.removeItem(journalKey);operation=null;uncertain=false;fieldset.disabled=false;}else if(operation){uncertain=true;fieldset.disabled=true;errorText.textContent+=' — لا نعرف إن اكتمل الحفظ. اضغط التحقق لإعادة نفس الطلب بأمان.';}
    button.textContent=uncertain?'التحقق وإعادة المحاولة':'تأكيد';
   }finally{busy=false;button.disabled=false;dialog.querySelector('.close-expense').disabled=false;}
  };
 }catch(error){if(current()){body.innerHTML='<p role="alert"></p><button type="button" data-retry-expense>إعادة المحاولة</button>';body.querySelector('[role=alert]').textContent=error.message;body.querySelector('[data-retry-expense]').onclick=()=>render(category);}}
 finally{loading=false;}
 };
 if(saved){await render(saved.payload.p_category);return;}
 body.innerHTML=expenseTypeMarkup();
 body.querySelectorAll('[data-expense-type]').forEach(button=>button.onclick=()=>render(button.dataset.expenseType));
}
export async function renderExpenses({api,projectId,container,isCurrent,mode='viewer',onSaved=()=>{},allowMutations=false}){
 const section=document.createElement('section');container.append(section);section.innerHTML='<h2>آخر المصاريف</h2><div class="skeleton"></div>';
 try{const rows=await api.rows('expenses',projectId,'*,account:sharikx2_accounts(name)');if(!isCurrent()||!section.isConnected)return;
  section.innerHTML='<h2>آخر المصاريف</h2>'+(rows.length?rows.map(x=>`<button class="panel record row" data-expense="${escape(x.id)}"><div><b>${escape(x.description)}</b><p class="muted">${escape(x.account?.name||'حساب غير محدد')}</p><small>${escape(timestamp(x.created_at||x.occurred_at))}</small></div><strong class="expense-amount">${expenseMoney(x.amount)}</strong></button>`).join(''):'<p>لا توجد مصاريف</p>')+(rows.length===20?'<p class="muted small">أحدث 20 مصروفًا</p>':'');
  section.querySelectorAll('[data-expense]').forEach(button=>button.onclick=()=>{
   const item=rows.find(x=>x.id===button.dataset.expense),dialog=document.createElement('dialog');
   dialog.innerHTML=`<h2>تفاصيل المصروف</h2><div class="panel row"><div><b>${escape(item.description)}</b><p>${['daily_wage','daily_wages'].includes(item.category)?'يوميات':'مصروف'}</p><p class="muted">${escape(timestamp(item.created_at||item.occurred_at))}</p></div><strong class="expense-amount">${expenseMoney(item.amount)}</strong></div><div class="panel row"><span>الدفع من</span><b>${escape(item.account?.name||'غير محدد')}</b></div><p class="muted small">إرفاق الفاتورة قيد الاستكمال.</p><div class="actions">${mode==='owner'&&allowMutations?'<button data-edit>تعديل</button><button data-delete class="danger">حذف</button>':''}<button data-close class="primary">إغلاق</button></div>`;
   document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>dialog.remove();
   const options={api,projectId,item,mode,onSaved:()=>{dialog.remove();onSaved();}};
   dialog.querySelector('[data-edit]')?.addEventListener('click',()=>editExpense(options));
   dialog.querySelector('[data-delete]')?.addEventListener('click',()=>deleteExpense(options));
  });
 }catch(error){if(section.isConnected&&isCurrent())section.textContent=error.message;}
}
