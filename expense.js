import {escape,money,timestamp} from './ui.js';
import {createOperation} from './operations.js';
import {editExpense,deleteExpense} from './expense-mutation.js';
export function expensePayload(projectId,values,accounts){
 const amount=Number(values.amount),account=accounts.find(x=>x.id===values.account);
 if(!String(values.description||'').trim())throw new Error('أدخل وصف المصروف');
 if(!Number.isFinite(amount)||amount<=0||Math.round(amount*100)!==amount*100&&Math.abs(Math.round(amount*100)-amount*100)>1e-8)throw new Error('أدخل مبلغًا صحيحًا حتى منزلتين عشريتين');
 if(!account)throw new Error('اختر حساب الدفع');
 if(amount>Number(account.balance))throw new Error('المبلغ أكبر من الرصيد المتاح في الحساب');
 return {p_project_id:projectId,p_category:values.category==='daily_wages'?'daily_wages':'operating_expense',p_description:String(values.description).trim(),p_amount:amount,p_account_id:account.id};
}
export async function openExpense({api,projectId,mode,container,onSaved,storage}){
 if(mode!=='owner')throw new Error('المشاركة للمشاهدة فقط');
 if(document.querySelector('dialog.expense-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='expense-dialog';
 dialog.innerHTML='<h2>مصروف جديد</h2><div class="expense-body"><div class="skeleton"></div></div><button class="outline close-expense">إلغاء</button>';
 container.append(dialog);dialog.showModal();let busy=false,operation=null,uncertain=false,accounts=[];
 const journalKey=`sharikx2-pending-expense:${projectId}`;
 const close=()=>{if(!busy)dialog.remove();};dialog.querySelector('.close-expense').onclick=close;
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 try{
  const summary=await api.summary(projectId);if(!dialog.isConnected)return;accounts=summary.accounts||[];
  const body=dialog.querySelector('.expense-body');body.innerHTML=`<form><fieldset><legend>نوع المصروف</legend><div class="tabs"><label class="choice"><input type="radio" name="category" value="operating_expense" checked>مصروف</label><label class="choice"><input type="radio" name="category" value="daily_wages">يوميات</label></div><label>وصف المصروف<input name="description" maxlength="500" required placeholder="مثل: مواصلات أو أجرة عامل"></label><label>قيمة المصروف<div class="money-input"><input name="amount" type="number" inputmode="decimal" step="0.01" min="0.01" required placeholder="0"><span>₪</span></div></label><legend>الدفع من الحساب</legend><div class="account-choices">${accounts.map(a=>`<label class="choice account-choice"><input type="radio" name="account" value="${escape(a.id)}" required><span>${escape(a.name)}</span><span class="muted">المتاح ${money(a.balance,2)}<small data-left="${escape(a.id)}"></small></span></label>`).join('')}</div><p class="muted small">سيُخصم المبلغ من الحساب المختار. إرفاق الفاتورة لم يُنفّذ في الويب بعد.</p></fieldset><p class="form-error" role="alert"></p><button class="primary" type="submit">تأكيد المصروف</button></form>`;
  const form=body.querySelector('form'),fieldset=form.querySelector('fieldset'),button=form.querySelector('[type=submit]'),errorText=form.querySelector('[role=alert]');
  const showRemaining=()=>{const amount=Number(form.elements.amount.value)||0,selected=form.elements.account.value;accounts.forEach(a=>{form.querySelector(`[data-left="${a.id}"]`).textContent=selected===a.id?`بعد الدفع: ${money(Number(a.balance)-amount,2)}`:'';});};
  form.oninput=showRemaining;
  try{const saved=JSON.parse(storage?.getItem(journalKey)||'null');if(saved?.payload?.p_project_id===projectId){
   operation=createOperation('confirm_sharikx2_expense_web_v1',saved.payload,saved.requestId);uncertain=true;
   form.elements.description.value=saved.payload.p_description;form.elements.amount.value=saved.payload.p_amount;form.elements.category.value=saved.payload.p_category;form.elements.account.value=saved.payload.p_account_id;
   fieldset.disabled=true;button.textContent='التحقق من العملية السابقة';errorText.textContent='هناك عملية لم تتأكد نتيجتها. سنعيد نفس الطلب دون تسجيل مصروف آخر.';
  }}catch{errorText.textContent='تعذر قراءة مسودة العملية السابقة؛ لا تؤكد مصروفًا بديلًا قبل التحقق من السجل.';button.disabled=true;}
  showRemaining();
  form.onsubmit=async e=>{
   e.preventDefault();if(busy)return;
   try{
    if(!operation){const values=Object.fromEntries(new FormData(form)),payload=expensePayload(projectId,values,accounts);
     // Persist before submission: otherwise a reload could turn retry into a new expense.
     if(!storage)throw new Error('يلزم تفعيل تخزين الجلسة لحماية العملية من التكرار');
     const candidate=createOperation('confirm_sharikx2_expense_web_v1',payload);
     storage.setItem(journalKey,JSON.stringify({requestId:candidate.requestId,payload}));operation=candidate;
    }
    busy=true;fieldset.disabled=true;button.disabled=true;dialog.querySelector('.close-expense').disabled=true;button.textContent=uncertain?'جارٍ التحقق…':'جارٍ الحفظ…';errorText.textContent='';
    await operation.run(api);storage.removeItem(journalKey);dialog.remove();onSaved();
   }catch(error){
    errorText.textContent=error.message==='INSUFFICIENT_ACCOUNT_BALANCE'?'تغيّر رصيد الحساب؛ المبلغ المتاح لا يكفي الآن.':error.message;
    const knownRejected=Number(error.status)>=400&&Number(error.status)<500;
    if(knownRejected){storage?.removeItem(journalKey);operation=null;uncertain=false;fieldset.disabled=false;}else if(operation){uncertain=true;fieldset.disabled=true;errorText.textContent+=' — لا نعرف إن اكتمل الحفظ. اضغط التحقق لإعادة نفس الطلب بأمان.';}
    button.textContent=uncertain?'التحقق وإعادة المحاولة':'تأكيد المصروف';
   }finally{busy=false;button.disabled=false;dialog.querySelector('.close-expense').disabled=false;}
  };
 }catch(error){if(dialog.isConnected)dialog.querySelector('.expense-body').textContent=error.message;}
}
export async function renderExpenses({api,projectId,container,isCurrent,mode='viewer',onSaved=()=>{},allowMutations=false}){
 const section=document.createElement('section');container.append(section);section.innerHTML='<h2>آخر المصاريف</h2><div class="skeleton"></div>';
 try{const rows=await api.rows('expenses',projectId,'*,account:sharikx2_accounts(name)');if(!isCurrent()||!section.isConnected)return;
  section.innerHTML='<h2>آخر المصاريف</h2>'+(rows.length?rows.map(x=>`<button class="panel record row" data-expense="${escape(x.id)}"><div><b>${escape(x.description)}</b><p class="muted">${escape(x.account?.name||'حساب غير محدد')}</p><small>${escape(timestamp(x.created_at||x.occurred_at))}</small></div><strong class="expense-amount">−${money(x.amount)}</strong></button>`).join(''):'<p>لا توجد مصاريف</p>')+(rows.length===20?'<p class="muted small">أحدث 20 مصروفًا</p>':'');
  section.querySelectorAll('[data-expense]').forEach(button=>button.onclick=()=>{
   const item=rows.find(x=>x.id===button.dataset.expense),dialog=document.createElement('dialog');
   dialog.innerHTML=`<h2>تفاصيل المصروف</h2><div class="panel row"><div><b>${escape(item.description)}</b><p>${item.category==='daily_wages'?'يوميات':'مصروف'}</p><p class="muted">${escape(timestamp(item.created_at||item.occurred_at))}</p></div><strong class="expense-amount">−${money(item.amount)}</strong></div><div class="panel row"><span>الدفع من</span><b>${escape(item.account?.name||'غير محدد')}</b></div><p class="muted small">إرفاق الفاتورة قيد الاستكمال.</p><div class="actions">${mode==='owner'&&allowMutations?'<button data-edit>تعديل</button><button data-delete class="danger">حذف</button>':''}<button data-close class="primary">إغلاق</button></div>`;
   document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>dialog.remove();
   const options={api,projectId,item,mode,onSaved:()=>{dialog.remove();onSaved();}};
   dialog.querySelector('[data-edit]')?.addEventListener('click',()=>editExpense(options));
   dialog.querySelector('[data-delete]')?.addEventListener('click',()=>deleteExpense(options));
  });
 }catch(error){if(section.isConnected&&isCurrent())section.textContent=error.message;}
}
