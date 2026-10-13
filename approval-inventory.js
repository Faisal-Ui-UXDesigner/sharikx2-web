import {partnerCashNumber} from './partner-cash-input.js';
import {partnerDecimalSum} from './partner-history.js';

const sum=partnerDecimalSum;
function nonnegative(value){const result=partnerCashNumber(value);if(result<0)throw new Error('مبالغ أو كمية المخزون غير صالحة');return result;}
function text(value,fallback=''){if(value===undefined||value===null)return fallback;if(typeof value!=='string')throw new Error('تفاصيل صنف المخزون غير صالحة');return value;}
function finite(value){return partnerCashNumber(value);}
// All active server products, including zero stock and hidden categories.
// Prices are per-piece on the server, per-purchase-unit in native display.
export function approvalInventoryReport(products,projectId,summary){
 if(!Array.isArray(products)||typeof projectId!=='string'||!projectId.trim())throw new Error('سجل المخزون الكامل غير متاح');
 if(!summary||typeof summary!=='object'||Array.isArray(summary)||summary.project_id!==undefined&&summary.project_id!==projectId)throw new Error('ملخص المخزون لا يخص المشروع');
 const ids=new Set(),items=[];
 for(const row of products){
  if(!row||typeof row.id!=='string'||!row.id.trim()||ids.has(row.id)||row.project_id!==projectId||typeof row.active!=='boolean')throw new Error('هوية أو نطاق صنف المخزون غير صالح');ids.add(row.id);
  if(!row.active)continue;
  const name=text(row.name).trim();if(!name)throw new Error('اسم صنف المخزون غير صالح');
  const pieces=nonnegative(row.quantity_pieces),piecesPerUnit=Math.max(1,nonnegative(row.pieces_per_purchase_unit===undefined?1:row.pieces_per_purchase_unit));
  const pieceCost=nonnegative(row.weighted_unit_cost),pieceSale=nonnegative(row.default_sale_price);
  const quantity=finite(pieces/piecesPerUnit),purchasePrice=finite(pieceCost*piecesPerUnit),salePrice=finite(pieceSale*piecesPerUnit);
  const purchaseValue=finite(pieces*pieceCost),saleValue=finite(pieces*pieceSale),expectedProfit=finite(pieces*sum([pieceSale,-pieceCost]));
  const unit=text(row.purchase_unit,text(row.base_unit,text(row.unit,'وحدة'))).trim()||'وحدة';
  items.push(Object.freeze({id:row.id,name,unit,pieces,piecesPerUnit,quantity,purchasePrice,salePrice,purchaseValue,saleValue,expectedProfit,updatedAt:text(row.updated_at)}));
 }
 const totals=Object.freeze({items:items.length,pieces:sum(items.map(row=>row.pieces)),purchaseValue:sum(items.map(row=>row.purchaseValue)),saleValue:sum(items.map(row=>row.saleValue)),expectedProfit:sum(items.map(row=>row.expectedProfit))});
 // Native sameNumber threshold, not a cent-rounded or clamped comparison.
 if(Math.abs(totals.purchaseValue-nonnegative(summary.inventory_cost))>=.0001)throw new Error('تغيّرت قيمة المخزون أثناء القراءة؛ أعد المحاولة');
 if(summary.inventory_sale_value!==undefined&&Math.abs(totals.saleValue-nonnegative(summary.inventory_sale_value))>=.0001)throw new Error('قيمة بيع المخزون لا تطابق تفاصيل الأصناف؛ أعد المحاولة');
 return Object.freeze({items:Object.freeze(items),totals});
}
