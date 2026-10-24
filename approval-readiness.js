import {partnerCashNumber,partnerCashDate} from './partner-cash-input.js';
import {partnerApprovalActionMonth} from './partner-profit-summary.js';

const messages=Object.freeze({NO_PROJECT:'أنشئ المشروع واربطه أولًا قبل اعتماد الحسابات',OWNER_REQUIRED:'اعتماد الحسابات متاح لمالك المشروع فقط',READ_ONLY:'اطلب التحكم بهذا الجهاز قبل اعتماد الحسابات',OFFLINE:'اتصل بالإنترنت للتحقق من المخزون قبل اعتماد الحسابات',PENDING_SYNC:'أكمل مزامنة العمليات وبيانات المشروع قبل اعتماد الحسابات',BUSY:'انتظر اكتمال العملية الحالية ثم اعتمد الحسابات',JOURNAL_UNAVAILABLE:'تعذر التحقق من سجلات العمليات المعلقة في هذا المتصفح'});
// Native ApprovalReadinessRules order; this pure check is NOT a server grant.
export function approvalReadinessBlock({project,owner,readOnly,online,pending,pendingCloud,busy}){
 if(!project)return 'NO_PROJECT';if(!owner)return 'OWNER_REQUIRED';if(readOnly)return 'READ_ONLY';if(!online)return 'OFFLINE';if(pending>0||pendingCloud)return 'PENDING_SYNC';return busy?'BUSY':'NONE';
}
function array(value){if(value===undefined)return [];if(!Array.isArray(value))throw new Error('سجل المزامنة غير صالح');return value;}
function flag(value){if(value===undefined)return false;if(typeof value!=='boolean')throw new Error('حالة المزامنة غير صالحة');return value;}
export function assertApprovalInventorySync(state,inventory){
 const remote=new Set(inventory.items.map(row=>row.id));
 for(const row of array(state?.inventory)){
  if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('سجل المخزون المحلي غير صالح');
  const saved=partnerCashNumber(row.quantity===undefined?0:row.quantity);
  const quantity=saved>0||!Object.hasOwn(row,'quantity_pieces')?saved:partnerCashNumber(row.quantity_pieces)/Math.max(1,partnerCashNumber(row.piecesPerPurchaseUnit===undefined?1:row.piecesPerPurchaseUnit));
  if(quantity!==0&&!remote.has(row.sharikx2ProductId))throw new Error('يوجد مخزون محلي غير مطابق للأصناف المعادة من الخادم؛ لم تُجهّز المعاينة');
 }
}
const prefixes=['sharikx2-device-registration','sharikx2-device-transfer','sharikx2-initial-finance','sharikx2-opening-distribution','sharikx2-finance-edit','sharikx2-pending-sale','sharikx2-pending-purchase','sharikx2-pending-return','sharikx2-pending-expense','sharikx2-pending-transfer','sharikx2-pending-customer','sharikx2-pending-customer-edit','sharikx2-pending-supplier','sharikx2-pending-supplier-old-debt','sharikx2-pending-supplier-payment','sharikx2-pending-customer-collection','sharikx2-partner-debt-create','sharikx2-partner-debt-delete','sharikx2-partner-withdrawal'];
export function approvalPendingJournalCount(storage,projectId){
 if(!storage||!Number.isSafeInteger(storage.length)||storage.length<0||typeof storage.key!=='function')throw new Error('JOURNAL_UNAVAILABLE');
 const roots=[...new Set([projectId,encodeURIComponent(projectId)])].flatMap(id=>prefixes.map(prefix=>`${prefix}:${id}`));let count=0;
 // Only inspect scoped journal KEY names. Never read auth tokens or payloads.
 for(let index=0;index<storage.length;index++){const key=storage.key(index);if(typeof key!=='string')throw new Error('JOURNAL_UNAVAILABLE');if(roots.some(root=>key===root||key.startsWith(root+':')))count++;}
 return count;
}
export function approvalReadinessStatus(snapshot,{projectId,project,mode,month,today,storage,online=true,readOnly=false,busy=false}){
 if(!partnerCashDate(today))throw new Error('تاريخ التحقق غير صالح');
 const date=new Date(today.slice(0,7)+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()-1);const previous=date.toISOString().slice(0,7);
 const monthEligible=month===previous&&partnerApprovalActionMonth(snapshot,project,today)===previous;
 const state=snapshot.state,queued=array(state.offlineSaleQueue).length+array(state.offlineExpenseQueue).length;
 const pendingSnapshot=[...array(state.revenues),...array(state.expenses)].some(row=>row&&flag(row.pendingSync));
 const pendingCloud=flag(state.pendingCloudSync);let journals=0,storageUnavailable=false;
 const hasProject=!!projectId&&project?.id===projectId,owner=mode==='owner';
 if(hasProject&&owner&&!readOnly&&online)try{journals=approvalPendingJournalCount(storage,projectId);}catch{storageUnavailable=true;}
 let block=approvalReadinessBlock({project:hasProject,owner,readOnly,online,pending:queued+journals,pendingCloud:pendingCloud||pendingSnapshot,busy});
 if(block==='NONE'&&storageUnavailable)block='JOURNAL_UNAVAILABLE';
 return Object.freeze({monthEligible,block,message:messages[block]||'',queued,journals,pendingSnapshot,pendingCloud,storageUnavailable,canExecute:false});
}
