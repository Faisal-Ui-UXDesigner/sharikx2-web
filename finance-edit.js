import {partnerPayload,updatePartnerState} from './partner-edit.js';
import {retentionPayload,updateRetentionState} from './retention.js';
import {capitalEditPayload,updatePartnerCapitalState,verifyPostedCapital} from './partner-capital.js';
import {partnerAddPayload,addPartnerState} from './partner-add.js';
import {distributionPayload,updateDistributionState} from './partner-distribution.js';
import {settlementPayload,archivePartnerState,verifySettlementValuation} from './partner-settlement-state.js';
import {partnerSaveRevision,partnerSaveResult} from './partner-shares.js';
import {financeEditKey,partnerFinanceKey,readPartnerFinanceOperation,createPartnerFinanceOperation} from './partner-finance-operation.js';
export {financeEditKey};
export function financeEditRequest(snapshot,projectId,kind,input){
 financeEditKey(projectId);const revision=partnerSaveRevision(snapshot);if(revision===Number.MAX_SAFE_INTEGER)throw new Error('إصدار المشروع يتجاوز الحد المدعوم');
 let changes,state;
 if(kind==='partner'){
  if(typeof input?.partnerId!=='string'||!input.partnerId.trim())throw new Error('هوية الشريك غير صالحة');
  changes={partnerId:input.partnerId,...partnerPayload(input.name,input.share)};state=updatePartnerState(snapshot,changes.partnerId,changes);
 }else if(kind==='partner-capital'){
  if(typeof input?.partnerId!=='string'||!input.partnerId.trim())throw new Error('هوية الشريك غير صالحة');
  changes={partnerId:input.partnerId,...capitalEditPayload(input)};state=updatePartnerCapitalState(snapshot,changes.partnerId,changes);
 }else if(kind==='partner-add'){
  changes=partnerAddPayload(input);state=addPartnerState(snapshot,changes);
 }else if(kind==='partner-distribution'){
  changes=distributionPayload(input);state=updateDistributionState(snapshot,changes);
 }else if(kind==='partner-settlement'){
  changes=settlementPayload(input);state=archivePartnerState(snapshot,changes);
 }else if(kind==='retention'){
  changes=retentionPayload(input?.share,input?.cap);state=updateRetentionState(snapshot,changes.share,changes.cap);
 }else throw new Error('نوع تعديل الشركاء غير صالح');
 return {version:1,projectId,kind,input:changes,revision,source:structuredClone(snapshot.state),state:structuredClone(state)};
}
function validate(request,projectId){
 if(!request||request.version!==1||request.projectId!==projectId)throw new Error('سجل تعديل الشركاء غير صالح');
 const expected=financeEditRequest({revision:request.revision,state:request.source},projectId,request.kind,request.input);
 if(JSON.stringify(expected)!==JSON.stringify(request))throw new Error('سجل التعديل لا يطابق الحسابات الأصلية');return expected;
}
export const readFinanceEdit=(storage,projectId)=>readPartnerFinanceOperation(storage,financeEditKey(projectId),request=>validate(request,projectId));
export function createFinanceEdit({api,storage,projectId,authorizeFresh=()=>{}}){
 return createPartnerFinanceOperation({api,storage,projectId,key:financeEditKey(projectId),validate:request=>validate(request,projectId),blockingKeys:['create','delete','withdrawal'].map(kind=>partnerFinanceKey(kind,projectId)),dispatch:async request=>{
  const result=partnerSaveResult(await api.saveFinanceState(projectId,structuredClone(request.state),request.revision),request.revision);
  if(capitalEditKind(request.kind))verifyPostedCapital(result,request.state);
 },authorizeFresh:async(fresh,request,isCurrent)=>{if(request.kind==='partner-settlement')await verifySettlementValuation(api,request,isCurrent);await authorizeFresh(fresh,request,isCurrent);},verifySource:(snapshot,request)=>{if(capitalEditKind(request.kind))verifyPostedCapital(snapshot,request.source);},verifyResult:(snapshot,request)=>{if(capitalEditKind(request.kind))verifyPostedCapital(snapshot,request.state);}});
}
const capitalEditKind=kind=>['partner-capital','partner-add','partner-distribution','partner-settlement'].includes(kind);
