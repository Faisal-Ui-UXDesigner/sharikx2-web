import {partnerFinanceKey,readPartnerFinanceOperation,createPartnerFinanceOperation,dispatchPartnerCashMovement} from './partner-finance-operation.js';
import {palestineDate} from './financial.js';
import {partnerDebtDirectory} from './partner-debts.js';

const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const partnerDebtDeleteKey=projectId=>partnerFinanceKey('delete',projectId);
export function partnerDebtDeleteRequest(snapshot,projectId,debtId,date=palestineDate()){
 partnerDebtDeleteKey(projectId);partnerDebtDirectory(snapshot);
 if(!Number.isSafeInteger(snapshot?.revision)||snapshot.revision<0||snapshot.revision===Number.MAX_SAFE_INTEGER)throw new Error('إصدار بيانات الشركاء غير صالح');
 if(typeof debtId!=='string'||!debtId.trim())throw new Error('هوية الذمة غير صالحة');
 const matches=(snapshot.state.partnerDebts||[]).filter(row=>row?.id===debtId);
 if(matches.length!==1)throw new Error('تعذر تحديد الذمة');
 const target=matches[0],group=partnerDebtDirectory(snapshot).find(row=>row.items.some(item=>item.id===debtId)),item=group.items.find(row=>row.id===debtId);
 if(target.settlements!==undefined&&(!Array.isArray(target.settlements)||target.settlements.some(row=>row&&(!['number','string'].includes(typeof row.amount)||String(row.amount).trim()===''||!Number.isFinite(Number(row.amount))))))throw new Error('سجل التسويات غير صالح');
 if(item.settled>0||(target.settlements||[]).some(row=>row&&Number(row.amount)>0))throw new Error('لا يمكن حذف ذمة لها تسويات مسجلة');
 const account=target.accountId??'';if(typeof account!=='string')throw new Error('حساب الذمة غير صالح');
 const cash=account!==''&&item.principal>0;
 if(cash&&(!uuid(projectId)||!uuid(debtId)||!uuid(account)||item.principal>1000000000))throw new Error('بيانات عكس حركة الذمة غير صالحة');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new Error('تاريخ عكس الذمة غير صالح');
 const state=structuredClone(snapshot.state);state.partnerDebts=state.partnerDebts.filter(row=>row?.id!==debtId);
 return {version:1,projectId,debtId,revision:snapshot.revision,source:structuredClone(snapshot.state),state,cash,accountId:account,amount:item.principal,date,name:group.name,description:item.description};
}
function validated(request,projectId){
 if(!request||request.version!==1||request.projectId!==projectId)throw new Error('سجل حذف الذمة غير صالح؛ لا تحذفه قبل المراجعة');
 const expected=partnerDebtDeleteRequest({revision:request.revision,state:request.source},projectId,request.debtId,request.date);
 if(JSON.stringify(expected)!==JSON.stringify(request))throw new Error('سجل حذف الذمة غير متوافق؛ يلزم المراجعة');
 return expected;
}
export function readPartnerDebtDelete(storage,projectId){
 return readPartnerFinanceOperation(storage,partnerDebtDeleteKey(projectId),request=>validated(request,projectId));
}
export function createPartnerDebtDelete({api,storage,projectId}){
 return createPartnerFinanceOperation({api,storage,projectId,key:partnerDebtDeleteKey(projectId),validate:request=>validated(request,projectId),blockingKeys:[partnerFinanceKey('create',projectId),partnerFinanceKey('withdrawal',projectId)],
  dispatch:request=>request.cash?dispatchPartnerCashMovement(api,request,'in','partner_debt_reversal'):api.saveFinanceState(projectId,structuredClone(request.state),request.revision)});
}
