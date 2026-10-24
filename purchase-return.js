import {decimalSum} from './decimal-sum.js';
import {purchaseLineTotal} from './purchase-arithmetic.js';
import {returnRawTotals} from './return-arithmetic.js';

export const PURCHASE_RETURN_RPC='return_sharikx2_purchase_v1';
const invalid=()=>new Error('تعذر التحقق من أصناف ومرتجعات الفاتورة؛ أعد تحميل حساب المورد');
const identity=value=>typeof value==='string'&&value.trim()!=='';
const freeze=Object.freeze;
function number(value){if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>=1e12)throw invalid();return Number(value);}
function keys(value,names){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name));}
function captured(snapshot){
 if(!keys(snapshot,['projectId','supplierId','purchaseId','supplierName','lines'])||![snapshot.projectId,snapshot.supplierId,snapshot.purchaseId].every(identity)||typeof snapshot.supplierName!=='string'||!Array.isArray(snapshot.lines)||!snapshot.lines.length)throw invalid();
 const ids=new Set(),stocks=new Map();
 const lines=snapshot.lines.map(line=>{
  if(!keys(line,['id','productId','name','remainingQuantity','remainingValue','unitCost','stock'])||!identity(line.id)||ids.has(line.id)||!identity(line.productId)||typeof line.name!=='string')throw invalid();ids.add(line.id);
  for(const key of ['remainingQuantity','remainingValue','unitCost','stock'])if(typeof line[key]!=='number')throw invalid();
  const result={id:line.id,productId:line.productId,name:line.name,remainingQuantity:number(line.remainingQuantity),remainingValue:number(line.remainingValue),unitCost:number(line.unitCost),stock:number(line.stock)};
  if(purchaseLineTotal(1,result.remainingValue)!==result.remainingValue||stocks.has(line.productId)&&stocks.get(line.productId)!==result.stock)throw invalid();stocks.set(line.productId,result.stock);return freeze(result);
 });
 return freeze({...snapshot,lines:freeze(lines)});
}
/** One atomic native supplier-history snapshot, not separately timed stock/return reads. */
export function purchaseReturnSnapshot(history,projectId,supplierId,purchaseId){
 if(history?.supplier?.id!==supplierId||history.supplier.project_id!==projectId||!Array.isArray(history.purchases)||!Array.isArray(history.purchase_returns))throw invalid();
 const invoices=history.purchases.filter(row=>row?.id===purchaseId),invoice=invoices[0];
 if(invoices.length!==1||invoice.project_id!==projectId||invoice.supplier_id!==supplierId||!['completed','paid','received','partially_returned','debt','credit'].includes(invoice.status)||!Array.isArray(invoice.items)||!invoice.items.length)throw new Error('لا توجد أصناف قابلة للإرجاع في هذه الفاتورة');
 const itemIds=new Set(invoice.items.map(row=>row?.id)),returned=new Map(),returnIds=new Set(),returnItemIds=new Set();
 if(itemIds.size!==invoice.items.length||[...itemIds].some(id=>!identity(id)))throw invalid();
 for(const record of history.purchase_returns){
  if(!identity(record?.id)||returnIds.has(record.id))throw invalid();returnIds.add(record.id);
  if(record.purchase_id!==purchaseId)continue;
  if(record.project_id!==projectId||record.supplier_id!==supplierId||!Array.isArray(record.items))throw invalid();
  for(const line of record.items){
   if(!identity(line?.id)||returnItemIds.has(line.id)||line.return_id!==record.id||!itemIds.has(line.purchase_item_id))throw invalid();returnItemIds.add(line.id);
   const q=number(line.quantity_pieces),value=number(line.refund_amount);if(q<=0||purchaseLineTotal(1,value)!==value)throw invalid();
   const sums=returned.get(line.purchase_item_id)||{quantities:[],values:[],products:[]};sums.quantities.push(q);sums.values.push(value);sums.products.push(line.product_id);returned.set(line.purchase_item_id,sums);
  }
 }
 const lines=invoice.items.map(row=>{
  if(row.purchase_id!==purchaseId||!identity(row.product_id)||row.product?.id!==row.product_id||row.product.project_id!==projectId)throw invalid();
  const quantity=number(row.quantity_pieces),total=number(row.line_total),cost=number(row.unit_cost),stock=number(row.product.quantity_pieces),prior=returned.get(row.id);
  if(quantity<=0||purchaseLineTotal(1,total)!==total||prior?.products.some(id=>id!==row.product_id))throw invalid();
  const used=decimalSum(prior?.quantities||[]),refunded=decimalSum(prior?.values||[]);if(used>quantity||refunded>total)throw invalid();
  return {id:row.id,productId:row.product_id,name:String(row.product.name||'صنف'),remainingQuantity:decimalSum([quantity,-used]),remainingValue:decimalSum([total,-refunded]),unitCost:cost,stock};
 });
 return captured({projectId,supplierId,purchaseId,supplierName:String(history.supplier.name||'المورد'),lines});
}
export function purchaseReturnDraft(snapshot,quantities){
 const source=captured(snapshot);if(!Array.isArray(quantities)||quantities.length!==source.lines.length)throw invalid();
 const selected=[],raw=[],values=[],usedStock=new Map();
 source.lines.forEach((line,index)=>{
  const quantity=quantities[index]===''?0:number(quantities[index]);if(!quantity)return;
  // Recorded return quantities are numeric(14,3); never silently round stock movement.
  const canonical=/^\d+(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(quantity));
  if(!canonical||(canonical[1]||'').length-Number(canonical[2]||0)>3||quantity>=1e11)throw new Error('كمية الإرجاع تدعم ثلاث منازل عشرية كحد أقصى');
  const totalStock=decimalSum([usedStock.get(line.productId)||0,quantity]);
  if(quantity>line.remainingQuantity||totalStock>line.stock)throw new Error('الكمية تتجاوز المتاح للإرجاع');usedStock.set(line.productId,totalStock);
  selected.push(freeze({purchase_item_id:line.id,quantity_pieces:quantity,product_id:line.productId}));raw.push({quantity,unit_price:line.unitCost});
  values.push(quantity===line.remainingQuantity?line.remainingValue:Math.min(purchaseLineTotal(quantity,line.unitCost),line.remainingValue));
 });
 if(!selected.length)throw new Error('حدد صنفًا واحدًا على الأقل');
 const expectedTotal=decimalSum(values);if(expectedTotal<=0||expectedTotal>=1e12)throw new Error('قيمة المرتجع غير مدعومة');
 const previewTotal=returnRawTotals(raw,0).refund;
 return freeze({snapshot:source,previewTotal,expectedTotal,payload:freeze({p_project_id:source.projectId,p_purchase_id:source.purchaseId,p_items:freeze(selected)})});
}
export function purchaseReturnKey(projectId){if(!identity(projectId))throw invalid();return 'sharikx2-pending-purchase-return-v1:'+encodeURIComponent(projectId);}
export function validatePurchaseReturnJournal(saved,projectId){
 if(!keys(saved,['version','requestId','snapshot','payload','expectedTotal','previewTotal'])||saved.version!==1||typeof saved.requestId!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(saved.requestId))throw invalid();
 const source=captured(saved.snapshot),p=saved.payload;if(source.projectId!==projectId||!keys(p,['p_project_id','p_purchase_id','p_items'])||p.p_project_id!==projectId||p.p_purchase_id!==source.purchaseId||!Array.isArray(p.p_items))throw invalid();
 const selected=new Map();for(const line of p.p_items){if(!keys(line,['purchase_item_id','quantity_pieces','product_id'])||selected.has(line.purchase_item_id)||typeof line.quantity_pieces!=='number')throw invalid();selected.set(line.purchase_item_id,line);}
 const draft=purchaseReturnDraft(source,source.lines.map(line=>selected.get(line.id)?.quantity_pieces||0));
 if(JSON.stringify(draft.payload)!==JSON.stringify(p)||draft.expectedTotal!==saved.expectedTotal||draft.previewTotal!==saved.previewTotal)throw invalid();
 return freeze({version:1,requestId:saved.requestId,...draft});
}
export function purchaseReturnJournal(draft,requestId){return validatePurchaseReturnJournal({version:1,requestId,...draft},draft?.snapshot?.projectId);}
export function readPurchaseReturn(storage,projectId){if(!storage)throw new Error('تخزين الجلسة مطلوب لحماية إعادة محاولة الإرجاع');const raw=storage.getItem(purchaseReturnKey(projectId));return raw==null?null:validatePurchaseReturnJournal(JSON.parse(raw),projectId);}
export function persistPurchaseReturn(storage,projectId,value){const saved=validatePurchaseReturnJournal(value,projectId);if(readPurchaseReturn(storage,projectId))throw new Error('هناك إرجاع لم يتأكد؛ افتح الفاتورة الأصلية أولًا');storage.setItem(purchaseReturnKey(projectId),JSON.stringify(saved));if(JSON.stringify(readPurchaseReturn(storage,projectId))!==JSON.stringify(saved))throw invalid();return saved;}
export function clearPurchaseReturn(storage,projectId,value){const expected=validatePurchaseReturnJournal(value,projectId);if(JSON.stringify(readPurchaseReturn(storage,projectId))!==JSON.stringify(expected))throw invalid();storage.removeItem(purchaseReturnKey(projectId));if(storage.getItem(purchaseReturnKey(projectId))!=null)throw invalid();}
export function purchaseReturnAction(storage,projectId,purchase){try{const pending=readPurchaseReturn(storage,projectId),retry=pending?.snapshot.purchaseId===purchase.id;return freeze({retry,visible:retry||!['draft','cancelled','returned'].includes(purchase.status)});}catch{return freeze({retry:false,visible:true});}}
export function verifyPurchaseReturn(result,journal){
 if(!identity(result?.id)||number(result.return_total)!==journal.expectedTotal)throw invalid();
 if(result.project_id!==undefined&&result.project_id!==journal.snapshot.projectId||result.purchase_id!==undefined&&result.purchase_id!==journal.snapshot.purchaseId)throw invalid();
 if(result.already_returned===true)return;
 if(!['returned','partially_returned'].includes(result.status))throw invalid();
 const debt=number(result.debt_reduction),credit=number(result.credit_added),discount=number(result.discount_reversal),remaining=number(result.purchase_total);
 if(decimalSum([debt,credit,discount])!==journal.expectedTotal||[debt,credit,discount,remaining].some(value=>purchaseLineTotal(1,value)!==value))throw invalid();
}
