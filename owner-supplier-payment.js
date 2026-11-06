import {number} from './owner-path-store.js';
import {decimalSum} from './decimal-sum.js';
import {purchaseAmountExceeds,purchaseRemaining} from './purchase-arithmetic.js';
import {ownerPurchaseAccounts} from './owner-purchase.js';

export function ownerSupplierPayment(person,requests,sourceAccounts,projectId,note=''){
 if(!person?.id||person.project_id!==undefined&&person.project_id!==projectId||person.active===false)throw Error('المورد غير متاح');
 const debt=person.calculated_debt;if(!['number','string'].includes(typeof debt)||String(debt).trim()===''||!Number.isFinite(Number(debt))||Number(debt)<=.009)throw Error('لا يوجد دين مستحق لهذا المورد');
 const accounts=ownerPurchaseAccounts(sourceAccounts,projectId),byId=new Map(accounts.map(row=>[row.id,row])),seen=new Set();
 const sources=requests.map(row=>{
  const account=byId.get(row.account_id);if(!account||seen.has(row.account_id))throw Error('راجع حسابات الدفع');seen.add(row.account_id);
  const amount=number(row.amount,2,'1000000000000');if(Number(amount)<=0)throw Error('أدخل مبلغًا أكبر من صفر');
  if(account.balance<0||purchaseAmountExceeds(amount,account.balance))throw Error(`المبلغ أكبر من الرصيد المتاح في ${account.name}`);
  return {account_id:account.id,amount:Number(amount)};
 });
 if(!sources.length)throw Error('اكتب المبلغ المدفوع');
 const amount=decimalSum(sources.map(row=>row.amount));if(purchaseAmountExceeds(amount,debt))throw Error('المجموع أكبر من الدين الحالي');
 const payload={supplier_id:person.id,sources,note:String(note).trim()};sources.forEach(Object.freeze);Object.freeze(sources);Object.freeze(payload);
 return Object.freeze({payload,name:String(person.name||'المورد'),debt:Number(debt),amount,remaining:purchaseRemaining(debt,amount),note:payload.note,
  sources:Object.freeze(sources.map(row=>Object.freeze({id:row.account_id,name:byId.get(row.account_id).name,amount:row.amount,remaining:purchaseRemaining(byId.get(row.account_id).balance,row.amount)})))});
}
