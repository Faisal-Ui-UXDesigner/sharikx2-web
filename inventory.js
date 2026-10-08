const number=value=>Number.isFinite(Number(value))?Number(value):0;

export function normalizeProduct(row={}){
 const piecesPerUnit=Math.max(1,number(row.pieces_per_purchase_unit||row.piecesPerPurchaseUnit||1));
 const pieces=Math.max(0,row.quantity_pieces!=null?number(row.quantity_pieces):number(row.quantity)*piecesPerUnit);
 const unit=row.purchase_unit||row.unit||row.base_unit||'قطعة';
 const cost=row.weighted_unit_cost!=null?number(row.weighted_unit_cost):row.purchasePrice!=null?number(row.purchasePrice)/piecesPerUnit:number(row.unit_cost);
 const salePrice=number(row.default_sale_price??row.expectedSalePrice)/((row.default_sale_price!=null)?1:piecesPerUnit);
 return {...row,displayUnit:unit,piecesPerUnit,pieces,quantity:pieces/piecesPerUnit,cost,salePrice,
   lowStockQuantity:row.low_stock_level!=null?number(row.low_stock_level)/piecesPerUnit:number(row.lowStockLevel),
   purchaseValue:pieces*cost,saleValue:pieces*salePrice,expectedProfit:pieces*(salePrice-cost)};
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
 const totals={items:0,pieces:0,purchaseValue:0,saleValue:0,expectedProfit:0};
 for(const row of rows){
  const item=normalizeProduct(row);
  totals.items++;
  totals.pieces+=item.pieces;
  totals.purchaseValue+=item.purchaseValue;
  totals.saleValue+=item.saleValue;
  totals.expectedProfit+=item.expectedProfit;
 }
 return totals;
}
export function visibleInventoryRows(rows,limit=20){const value=Math.max(0,Number(limit)||0);return (Array.isArray(rows)?rows:[]).slice(0,value);}
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
