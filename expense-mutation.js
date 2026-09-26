import {escape,money} from './ui.js';
import {expensePayload} from './expense.js';
import {createOperation} from './operations.js';
export function expenseSnapshot(item){return {account_id:item.account_id??null,amount:Number(item.amount),description:item.description??null,category:item.category??null};}
export function editAccounts(accounts,item){return accounts.map(a=>({...a,balance:Number(a.balance)+(a.id===item.account_id?Number(item.amount):0)}));}
export async function editExpense({api,item,projectId,mode,onSaved,storage}){
 if(mode!=='owner')throw new Error('المشاركة للمشاهدة فقط');
 const dialog=document.createElement('dialog');dialog.innerHTML='<h2>تعديل المصروف</h2><div class="body"><div class="skeleton"></div></div>';document.body.append(dialog);dialog.showModal();let busy=false,operation=null;
 dialog.oncancel=e=>{if(busy)e.preventDefault();};
 try{const summary=await api.summary(projectId);if(!dialog.isConnected)return;const accounts=editAccounts(summary.accounts||[],item);
  dialog.querySelector('.body').innerHTML=`<form><fieldset><label>الوصف<input name="description" value="${escape(item.description)}" required maxlength="500"></label><label>المبلغ<input name="amount" type="number" inputmode="decimal" step="0.01" min="0.01" value="${escape(item.amount)}" required></label><legend>الدفع من</legend>${accounts.map(a=>`<label class="choice account-choice"><input type="radio" name="account" value="${escape(a.id)}" ${a.id===item.account_id?'checked':''} required><span>${escape(a.name)}</span><span>${money(a.balance,2)}</span></label>`).join('')}<p class="muted small">الرصيد المعروض للحساب الأصلي يشمل استرجاع قيمة المصروف قبل خصم قيمته الجديدة.</p></fieldset><p role="alert"></p><div class="actions"><button class="primary">حفظ التعديل</button><button type="button">إلغاء</button></div></form>`;
  const form=dialog.querySelector('form'),error=form.querySelector('[role=alert]'),button=form.querySelector('.primary'),cancel=form.querySelector('[type=button]'),fields=form.querySelector('fieldset');cancel.onclick=()=>{if(!busy)dialog.remove();};
  form.onsubmit=async e=>{e.preventDefault();if(busy)return;try{
   if(!operation){const values=Object.fromEntries(new FormData(form));values.category=item.category;const valid=expensePayload(projectId,values,accounts);
    operation=createOperation('mutate_sharikx2_expense_web_v1',{p_project_id:projectId,p_expense_id:item.id,p_action:'update',p_expected:expenseSnapshot(item),p_changes:{account_id:valid.p_account_id,amount:valid.p_amount,description:valid.p_description,category:valid.p_category}});
   }
   busy=true;fields.disabled=true;button.disabled=true;cancel.disabled=true;button.textContent='جارٍ الحفظ…';
   await operation.run(api);dialog.remove();onSaved();
  }catch(e){error.textContent=e.message==='STALE_EXPENSE'?'تغيّر المصروف من جهاز آخر. أغلق النافذة وحدّث السجل قبل التعديل.':e.message;
   if(e.status>=400&&e.status<500){operation=null;fields.disabled=false;}else if(operation){error.textContent+=' — أعد المحاولة بنفس الطلب للتحقق من النتيجة.';}
  }finally{busy=false;button.disabled=false;cancel.disabled=false;button.textContent=operation?'التحقق وإعادة المحاولة':'حفظ التعديل';}};
 }catch(e){dialog.querySelector('.body').textContent=e.message;}
}
export function deleteExpense({api,item,projectId,mode,onSaved}){
 if(mode!=='owner')throw new Error('المشاركة للمشاهدة فقط');
 const dialog=document.createElement('dialog');dialog.innerHTML=`<h2>حذف المصروف؟</h2><p>سيُحذف «${escape(item.description)}» وتُسترجع قيمته ${money(item.amount)} إلى الحساب الذي دُفع منه.</p><p role="alert"></p><div class="actions"><button class="danger">تأكيد الحذف</button><button>إلغاء</button></div>`;document.body.append(dialog);dialog.showModal();const buttons=dialog.querySelectorAll('button');let busy=false;
 const op=createOperation('mutate_sharikx2_expense_web_v1',{p_project_id:projectId,p_expense_id:item.id,p_action:'delete',p_expected:expenseSnapshot(item),p_changes:{}});
 buttons[1].onclick=()=>{if(!busy)dialog.remove();};dialog.oncancel=e=>{if(busy)e.preventDefault();};
 buttons[0].onclick=async()=>{if(busy)return;busy=true;buttons.forEach(b=>b.disabled=true);buttons[0].textContent='جارٍ الحذف…';try{await op.run(api);dialog.remove();onSaved();}catch(e){dialog.querySelector('[role=alert]').textContent=e.message==='STALE_EXPENSE'?'تغيّر المصروف؛ حدّث السجل قبل الحذف.':e.message;buttons[0].textContent='التحقق وإعادة المحاولة';}finally{busy=false;buttons.forEach(b=>b.disabled=false);}};
}
