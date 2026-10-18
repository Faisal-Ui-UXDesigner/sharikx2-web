// Native cashier presentation only. Quantity/pricing rules remain authoritative.
import {canAddSaleProduct,isMeasuredUnit,quantityChoices} from './sale-quantity.js';
import {saleLineTotal} from './sale-pricing.js';
export function salePickerCards(products,cart){
 const selected=new Map(cart.map(line=>[line.id,line]));
 return Object.freeze(products.map(product=>{
  const line=selected.get(product.id);
  return Object.freeze({id:product.id,name:String(product.name??''),stock:Number(product.quantity_pieces),price:Number(product.default_sale_price),quantity:line?.quantity??0,canIncrease:canAddSaleProduct(product,line),canDecrease:!!line});
 }));
}
export function saleCartCards(cart){
 return Object.freeze(cart.map(line=>Object.freeze({id:line.id,name:line.name,barcode:String(line.barcode??''),unit:line.unit||'قطعة',quantity:line.quantity,stock:line.stock,price:line.price,cost:line.cost,total:saleLineTotal(line),belowCost:line.price<line.cost,canIncrease:canAddSaleProduct({},line),measured:isMeasuredUnit(line.unit),choices:Object.freeze(isMeasuredUnit(line.unit)?quantityChoices(line.unit):[])})));
}
