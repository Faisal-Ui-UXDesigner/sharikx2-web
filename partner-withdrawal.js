import {normalizePartnerSnapshot} from './financial.js';
import {partnerProfitOffsets,partnerApprovedProfit} from './partner-balance.js';
import {canWithdrawProfits} from './subscription.js';
import {partnerDecimalSum} from './partner-history.js';
import {partnerDebtDirectory} from './partner-debts.js';
import {partnerCashUuid,partnerCashDate,partnerCashNumber,partnerCashCreatedAt,partnerCashAccounts} from './partner-cash-input.js';
import {partnerFinanceKey,readPartnerFinanceOperation,createPartnerFinanceOperation,dispatchPartnerCashMovement} from './partner-finance-operation.js';

export function partnerWithdrawableProfit(snapshot,partnerId){
 const value=partnerProfitOffsets(snapshot,partnerId);
 return Math.max(0,partnerDecimalSum([value.unwithdrawnProfit,-value.outstandingDebt]));
}
export const partnerWithdrawalKey=projectId=>partnerFinanceKey('withdrawal',projectId);
export function partnerWithdrawalLimit(snapshot,partnerId,entry='precise'){
 if(!['precise','summary'].includes(entry))throw new Error('مسار سحب الأرباح غير صالح');
 const available=partnerWithdrawableProfit(snapshot,partnerId);
 return entry==='summary'?(partnerApprovedProfit(snapshot,partnerId)>0?Math.floor(available):0):available;
}
export function partnerWithdrawalAccess(storage,projectId,project,mode){
 if(mode!=='owner'||project?.id!==projectId)return Object.freeze({pending:null,allowed:false});
 const pending=readPartnerWithdrawal(storage,projectId),blocked=['create','delete'].some(kind=>storage.getItem(partnerFinanceKey(kind,projectId))!==null);
 return Object.freeze({pending,allowed:!pending&&!blocked&&canWithdrawProfits(project)});
}
export function partnerWithdrawalRequest(snapshot,projectId,input){
 if(!partnerCashUuid(projectId))throw new Error('هوية المشروع غير صالحة');partnerDebtDirectory(snapshot);
 if(!Number.isSafeInteger(snapshot?.revision)||snapshot.revision<0||snapshot.revision===Number.MAX_SAFE_INTEGER)throw new Error('إصدار بيانات الشركاء غير صالح');
 const partner=normalizePartnerSnapshot(snapshot).current.find(row=>row.id===input.partnerId);if(!partner)throw new Error('الشريك الحالي غير موجود');
 const available=partnerWithdrawalLimit(snapshot,partner.id,input.entry),account=partnerCashAccounts({accounts:[input.account]},projectId)[0],amount=partnerCashNumber(input.amount);
 if(!account)throw new Error('اختر حساب السحب');
 if(amount<=0||amount>1000000000)throw new Error('أدخل مبلغ سحب موجبًا لا يتجاوز الحد المدعوم');
 if(amount>available)throw new Error('المبلغ أكبر من المتاح للسحب');
 // Native form allows 0.009 tolerance. The existing atomic server still enforces its exact account balance.
 if(amount>account.balance+.009)throw new Error('رصيد الحساب غير كافٍ');
 const createdAt=input.createdAt??partnerCashCreatedAt(),date=input.date??createdAt.slice(0,10),month=input.month??createdAt.slice(0,7),withdrawalId=input.withdrawalId??crypto.randomUUID();
 if(!partnerCashDate(date)||typeof createdAt!=='string'||!/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d$/.test(createdAt)||!partnerCashDate(createdAt.slice(0,10))||month!==createdAt.slice(0,7)||date!==createdAt.slice(0,10))throw new Error('تاريخ سحب الأرباح غير صالح');
 if(!partnerCashUuid(withdrawalId)||(snapshot.state.withdrawals||[]).some(row=>row?.id===withdrawalId))throw new Error('هوية السحب غير صالحة أو مكررة');
 const state=structuredClone(snapshot.state);state.withdrawals=[...(state.withdrawals||[]),{id:withdrawalId,partnerId:partner.id,date,month,amount,accountId:account.id,accountName:account.name,createdAt}];
 return {version:1,...(input.entry==='summary'?{entry:'summary'}:{}),projectId,withdrawalId,revision:snapshot.revision,source:structuredClone(snapshot.state),state,partnerId:partner.id,name:String(partner.name||'شريك'),account,accountId:account.id,amount,available,remaining:Math.max(0,partnerDecimalSum([available,-amount])),date,month,createdAt};
}
function validated(request,projectId){
 if(!request||request.version!==1||request.projectId!==projectId)throw new Error('سجل سحب الأرباح غير صالح');
 const expected=partnerWithdrawalRequest({revision:request.revision,state:request.source},projectId,request);
 if(JSON.stringify(expected)!==JSON.stringify(request))throw new Error('سجل سحب الأرباح غير متوافق');return expected;
}
export function readPartnerWithdrawal(storage,projectId){return readPartnerFinanceOperation(storage,partnerWithdrawalKey(projectId),request=>validated(request,projectId));}
export function createPartnerWithdrawal({api,storage,projectId,mayWithdraw=()=>false}){
 const attempt=createPartnerFinanceOperation({api,storage,projectId,key:partnerWithdrawalKey(projectId),validate:request=>validated(request,projectId),blockingKeys:[partnerFinanceKey('create',projectId),partnerFinanceKey('delete',projectId)],dispatch:request=>dispatchPartnerCashMovement(api,request,'out','partner_profit_withdrawal')});
 return Object.freeze({...attempt,run(candidate,isCurrent=()=>true){
  if(attempt.pending())return attempt.run(candidate,isCurrent);
  if(!mayWithdraw())return Promise.reject(new Error('سحب الأرباح غير متاح لهذا الاشتراك'));
  return attempt.run(candidate,()=>isCurrent()&&mayWithdraw());
 }});
}
