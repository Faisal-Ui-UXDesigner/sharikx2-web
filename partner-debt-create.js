import {normalizePartnerSnapshot,palestineDate} from './financial.js';
import {partnerDebtDirectory} from './partner-debts.js';
import {partnerProfitOffsets} from './partner-balance.js';
import {partnerDecimalSum} from './partner-history.js';
import {partnerFinanceKey,readPartnerFinanceOperation,createPartnerFinanceOperation,dispatchPartnerCashMovement} from './partner-finance-operation.js';

import {partnerCashUuid as uuid,partnerCashDate as validDate,partnerCashNumber as numeric,partnerCashCreatedAt as partnerDebtCreatedAt,partnerCashAccounts as partnerDebtAccounts} from './partner-cash-input.js';
export {partnerDebtCreatedAt,partnerDebtAccounts};
export const partnerDebtCreateKey=projectId=>partnerFinanceKey('create',projectId);
export function partnerDebtCreateRequest(snapshot,projectId,input){
 if(!uuid(projectId))throw new Error('هوية المشروع غير صالحة');
 partnerDebtDirectory(snapshot);
 if(!Number.isSafeInteger(snapshot?.revision)||snapshot.revision<0||snapshot.revision===Number.MAX_SAFE_INTEGER)throw new Error('إصدار بيانات الشركاء غير صالح');
 const partner=normalizePartnerSnapshot(snapshot).current.find(row=>row.id===input.partnerId);
 if(!partner)throw new Error('اختر الشريك الحالي');
 const account=partnerDebtAccounts({accounts:[input.account]},projectId)[0],amount=numeric(input.amount);
 if(!account)throw new Error('اختر حساب الدفع');
 if(amount<=0||amount>1000000000)throw new Error('أدخل مبلغًا موجبًا لا يتجاوز الحد المدعوم');
 if(amount>account.balance)throw new Error('الرصيد في الحساب المحدد غير كافٍ');
 const date=input.date??palestineDate(),createdAt=input.createdAt??partnerDebtCreatedAt(),debtId=input.debtId??crypto.randomUUID();
 if(!validDate(date)||typeof createdAt!=='string'||!/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d$/.test(createdAt)||!validDate(createdAt.slice(0,10)))throw new Error('تاريخ الذمة غير صالح');
 if(!uuid(debtId)||(snapshot.state.partnerDebts||[]).some(row=>row?.id===debtId))throw new Error('هوية الذمة غير صالحة أو مكررة');
 if(input.description!==undefined&&typeof input.description!=='string')throw new Error('وصف الذمة غير صالح');
 const description=(input.description??'').trim(),offsets=partnerProfitOffsets(snapshot,partner.id);
 const availableBefore=Math.max(0,partnerDecimalSum([offsets.unwithdrawnProfit,-offsets.outstandingDebt]));
 const settledNow=Math.min(amount,availableBefore),remainingDebt=Math.max(0,partnerDecimalSum([amount,-settledNow])),availableAfter=Math.max(0,partnerDecimalSum([availableBefore,-settledNow]));
 const state=structuredClone(snapshot.state);state.partnerDebts=[...(state.partnerDebts||[]),{
  id:debtId,partnerId:partner.id,amount,settledAmount:settledNow,date,description,accountId:account.id,accountName:account.name,createdAt,
  settlements:settledNow>.0001?[{month:createdAt.slice(0,7),amount:settledNow,settledAt:createdAt,source:'approved_profit'}]:[]
 }];
 return {version:1,projectId,debtId,revision:snapshot.revision,source:structuredClone(snapshot.state),state,partnerId:partner.id,name:String(partner.name||'شريك'),account,accountId:account.id,amount,date,createdAt,description,availableBefore,settledNow,remainingDebt,availableAfter};
}
function validated(request,projectId){
 if(!request||request.version!==1||request.projectId!==projectId)throw new Error('سجل تسجيل الذمة غير صالح');
 const expected=partnerDebtCreateRequest({revision:request.revision,state:request.source},projectId,request);
 if(JSON.stringify(expected)!==JSON.stringify(request))throw new Error('سجل تسجيل الذمة غير متوافق');
 return expected;
}
export function readPartnerDebtCreate(storage,projectId){return readPartnerFinanceOperation(storage,partnerDebtCreateKey(projectId),request=>validated(request,projectId));}
export function createPartnerDebtCreate({api,storage,projectId}){
 return createPartnerFinanceOperation({api,storage,projectId,key:partnerDebtCreateKey(projectId),validate:request=>validated(request,projectId),blockingKeys:[partnerFinanceKey('delete',projectId),partnerFinanceKey('withdrawal',projectId)],dispatch:request=>dispatchPartnerCashMovement(api,request,'out','partner_debt')});
}
