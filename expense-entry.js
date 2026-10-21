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
