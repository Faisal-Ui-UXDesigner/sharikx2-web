import {decimalSum,decimalProduct} from './decimal-sum.js';
export const INVENTORY_PAGE_SIZE=40;
const number=value=>Number.isFinite(Number(value))?Number(value):0;

export function normalizeProduct(row={}){
 const piecesPerUnit=Math.max(1,number(row.pieces_per_purchase_unit||row.piecesPerPurchaseUnit||1));
 const pieces=Math.max(0,row.quantity_pieces!=null?number(row.quantity_pieces):decimalProduct(number(row.quantity),piecesPerUnit));
 const unit=row.purchase_unit||row.unit||row.base_unit||'قطعة';
 const cost=row.weighted_unit_cost!=null?number(row.weighted_unit_cost):row.purchasePrice!=null?number(row.purchasePrice)/piecesPerUnit:number(row.unit_cost);
 const salePrice=number(row.default_sale_price??row.expectedSalePrice)/((row.default_sale_price!=null)?1:piecesPerUnit);
 const quantity=row.quantity_pieces==null?Math.max(0,number(row.quantity)):pieces/piecesPerUnit;
 // Value legacy purchase units directly; division into pieces is for display only.
 const valuationQuantity=row.quantity_pieces==null?Math.max(0,number(row.quantity)):quantity;
 const purchaseValue=row.weighted_unit_cost!=null||row.purchasePrice==null?decimalProduct(pieces,cost):decimalProduct(valuationQuantity,number(row.purchasePrice));
 const saleValue=row.default_sale_price!=null?decimalProduct(pieces,salePrice):decimalProduct(valuationQuantity,number(row.expectedSalePrice));
 const purchaseUnitCost=row.weighted_unit_cost!=null||row.purchasePrice==null?decimalProduct(cost,piecesPerUnit):number(row.purchasePrice);
 const saleUnitPrice=row.default_sale_price!=null?decimalProduct(salePrice,piecesPerUnit):number(row.expectedSalePrice);
 return {...row,displayUnit:unit,piecesPerUnit,pieces,quantity,cost,salePrice,purchaseUnitCost,saleUnitPrice,
   lowStockQuantity:row.low_stock_level!=null?number(row.low_stock_level)/piecesPerUnit:number(row.lowStockLevel),
   purchaseValue,saleValue,expectedProfit:decimalSum([saleValue,-purchaseValue])};
}
export function filterProducts(rows,query='',category='الكل'){
 const q=String(query||'').trim().toLocaleLowerCase();
 return rows.filter(item=>{
  const matchesCategory=category==='الكل'||!category||String(item.category||'').trim()===category;
  const haystack=`${item.name||''} ${item.barcode||''}`.toLocaleLowerCase();
  return matchesCategory&&(!q||haystack.includes(q));
 });
}
export function inventorySummary(rows){
 const terms={pieces:[],purchaseValue:[],saleValue:[],expectedProfit:[]};
 for(const row of rows){
  const item=normalizeProduct(row);
  for(const key of Object.keys(terms))terms[key].push(item[key]);
 }
 return {items:rows.length,...Object.fromEntries(Object.entries(terms).map(([key,values])=>[key,decimalSum(values)]))};
}
export function visibleInventoryRows(rows,limit=INVENTORY_PAGE_SIZE){const value=Math.max(0,Number(limit)||0);return (Array.isArray(rows)?rows:[]).slice(0,value);}
const historyTime=value=>{
 const time=Date.parse(value);
 return Number.isFinite(time)?time:Number.NEGATIVE_INFINITY;
};
export function normalizePurchaseHistory(rows){
 return (Array.isArray(rows)?rows:[]).map(row=>{
  const purchase=row.purchase||{};
  return {...row,purchaseDate:purchase.purchased_at||purchase.created_at||'',supplierName:purchase.supplier?.name||'غير محدد'};
 }).sort((a,b)=>{
  const left=historyTime(a.purchaseDate),right=historyTime(b.purchaseDate);
  // Equal or missing dates keep their source order; valid newest dates come first.
  return left===right?0:left>right?-1:1;
 });
}
