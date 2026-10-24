// ExpenseTypeRules and ExpenseEntryFormView: display state only, never a payment.
const types=Object.freeze([
 Object.freeze({category:'operating_expense',label:'مصروف',description:'وصف المصروف',amount:'قيمة المصروف'}),
 Object.freeze({category:'daily_wage',label:'يوميات',description:'وصف اليومية',amount:'قيمة اليومية'})
]);
export const expenseEntryTypes=()=>types;
export function expenseEntryType(category){
 const type=types.find(type=>type.category===(category==='daily_wages'?'daily_wage':category));
 if(!type)throw Error('نوع الحركة غير صالح');return type;
}
export function expenseEntryAccounts(accounts){
 if(!Array.isArray(accounts))throw Error('تعذر قراءة حسابات الدفع');
 const ids=new Set(),rows=[];
 for(const account of accounts){
  if(account?.active===false)continue;
  if(!account||typeof account.id!=='string'||!account.id.trim()||ids.has(account.id)||!['string','number'].includes(typeof account.balance)||String(account.balance).trim()===''||!Number.isFinite(Number(account.balance)))throw Error('بيانات حساب الدفع غير صالحة');
  ids.add(account.id);rows.push(Object.freeze({id:account.id,name:String(account.name??'الحساب'),balance:Number(account.balance)}));
 }
 return Object.freeze(rows);
}

// Shared unchanged payment validation; UI controllers must not depend on each other.
export function expensePayload(projectId,values,accounts){
 const amount=Number(values.amount),account=accounts.find(x=>x.id===values.account);
 if(!String(values.description||'').trim())throw new Error('أدخل وصف المصروف');
 if(!Number.isFinite(amount)||amount<=0||Math.round(amount*100)!==amount*100&&Math.abs(Math.round(amount*100)-amount*100)>1e-8)throw new Error('أدخل مبلغًا صحيحًا حتى منزلتين عشريتين');
 if(!account)throw new Error('اختر حساب الدفع');
 if(amount>Number(account.balance))throw new Error('المبلغ أكبر من الرصيد المتاح في الحساب');
 return {p_project_id:projectId,p_category:['daily_wage','daily_wages'].includes(values.category)?'daily_wage':'operating_expense',p_description:String(values.description).trim(),p_amount:amount,p_account_id:account.id};
}

// confirm_expense_v3 returns this row through the existing idempotent wrapper.
// Validate its numeric(14,2) acknowledgement, without rounding/changing the request.
export function verifyExpenseResult(result,payload){
 const validAmount=value=>['number','string'].includes(typeof value)&&/^(?:\d+)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(String(value))&&Number.isFinite(Number(value))&&Number(value)>0&&Math.abs(Number(value)*100-Math.round(Number(value)*100))<=1e-8;
 if(!payload||!result||Array.isArray(result)||typeof result.id!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.id)||!validAmount(result.amount)||!validAmount(payload.p_amount)||Math.round(Number(result.amount)*100)!==Math.round(Number(payload.p_amount)*100)||result.account_id!==payload.p_account_id||result.category!==payload.p_category||result.description!==payload.p_description||Object.hasOwn(result,'project_id')&&result.project_id!==payload.p_project_id)throw Error('تعذر تأكيد بيانات المصروف؛ أعد التحقق بنفس الطلب');
}
