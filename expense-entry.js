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
