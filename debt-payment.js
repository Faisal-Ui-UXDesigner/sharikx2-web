export const DEBT_PAYMENT_EPSILON=0.009;
export const debtPaymentRemaining=(debt,amount)=>Math.max(0,Number(debt)-Number(amount));
const positive=value=>Number.isFinite(value)&&value>0;
export function collectionPayload(projectId,customer,amount,accountId,note=''){
 if(!projectId||!customer?.id||!positive(amount)||!accountId)throw new Error('تحقق من الزبون والمبلغ والحساب');
 return {p_project_id:projectId,p_customer_id:customer.id,p_amount:amount,p_account_id:accountId,p_note:note||null};
}
export function paymentPayload(projectId,supplierId,sources,note=''){
 if(!projectId||!supplierId||!Array.isArray(sources)||!sources.length)throw new Error('اختر المورد والحساب');
 if(sources.some(x=>!x?.account_id||!positive(x.amount))||new Set(sources.map(x=>x.account_id)).size!==sources.length)throw new Error('تحقق من الدفعات');
 return {p_project_id:projectId,p_supplier_id:supplierId,p_sources:sources.map(x=>({account_id:x.account_id,amount:x.amount})),p_note:note||null};
}
export function debtPaymentTotal(payload){return payload.p_sources?payload.p_sources.reduce((sum,x)=>sum+x.amount,0):payload.p_amount;}
export function validateDebtPaymentSnapshot(payload,debt,accounts){
 const amount=debtPaymentTotal(payload),current=Number(debt);
 if(!Number.isFinite(amount)||!Number.isFinite(current)||current<=DEBT_PAYMENT_EPSILON)throw new Error('لا يوجد دين مستحق');
 if(amount>current+DEBT_PAYMENT_EPSILON)throw new Error('قيمة الدفعة أكبر من الدين الحالي');
 const byId=new Map(accounts.map(account=>[account.id,account]));
 const sources=payload.p_sources||[{account_id:payload.p_account_id,amount}];
 for(const source of sources){
  const account=byId.get(source.account_id);if(!account)throw new Error('اختر حسابًا متاحًا');
  // Receiving customer money does not require funds in the receiving account.
  if(payload.p_sources&&(!Number.isFinite(Number(account.balance))||source.amount>Math.max(0,Number(account.balance))+DEBT_PAYMENT_EPSILON))throw new Error('إحدى الدفعات أكبر من الرصيد المتاح');
 }
}
export function validateDebtPaymentJournal(saved,kind,projectId,personId){
 const payload=saved?.payload,supplier=kind==='supplier',party=supplier?'p_supplier_id':'p_customer_id';
 if(payload?.p_project_id!==projectId||payload[party]!==personId||!saved.requestId)throw new Error('INVALID_DRAFT');
 if(supplier)paymentPayload(projectId,personId,payload.p_sources,payload.p_note);
 else collectionPayload(projectId,{id:personId},payload.p_amount,payload.p_account_id,payload.p_note);
 return payload;
}
export function verifyDebtPaymentResult(result,payload){
 const amount=Number(result?.amount);
 if(!result?.id||!Number.isFinite(amount)||Math.abs(amount-debtPaymentTotal(payload))>DEBT_PAYMENT_EPSILON)throw new Error('تعذر تأكيد الدفعة؛ أعد التحقق بنفس الطلب');
}
export function supplierPaymentReview(payload,person,accounts){
 if(payload?.p_supplier_id!==person?.id)throw new Error('بيانات المورد غير مكتملة');
 const captured=paymentPayload(payload.p_project_id,person.id,payload.p_sources,payload.p_note);
 validateDebtPaymentSnapshot(captured,person.calculated_debt,accounts);
 captured.p_sources.forEach(Object.freeze);Object.freeze(captured.p_sources);Object.freeze(captured);
 const amount=debtPaymentTotal(captured),debt=Number(person.calculated_debt),byId=new Map(accounts.map(account=>[account.id,account]));
 const sources=captured.p_sources.map(source=>Object.freeze({id:source.account_id,name:String(byId.get(source.account_id).name||'الحساب'),amount:source.amount,remaining:debtPaymentRemaining(byId.get(source.account_id).balance,source.amount)}));
 return Object.freeze({payload:captured,name:String(person.name||'المورد'),debt,amount,remaining:debtPaymentRemaining(debt,amount),sources:Object.freeze(sources),note:String(captured.p_note||'')});
}
