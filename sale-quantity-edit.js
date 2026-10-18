// CashierLineEditView.showQuantity: local staged quantity only, never a sale.
import {isMeasuredUnit,quantityChoices,setSaleQuantity} from './sale-quantity.js';
import {saleLineTotal,saleUnitPrice} from './sale-pricing.js';

export function measuredPriceTitle(unit){
 const key=String(unit??'').trim().toLowerCase();
 if(['كغم','كيلو','كيلوغرام','kg'].includes(key))return 'سعر الكيلو';
 if(['غرام','جرام','g'].includes(key))return 'سعر الغرام';
 if(['لتر','liter','litre'].includes(key))return 'سعر اللتر';
 if(['مل','ملل','ml'].includes(key))return 'سعر المل';
 return 'سعر الوحدة';
}

export function saleQuantityEdit(line){
 if(!line||typeof line.id!=='string'||!line.id.trim()||!isMeasuredUnit(line.unit))throw Error('الصنف ليس من الأصناف الموزونة');
 const current=setSaleQuantity(line,line.quantity),price=saleUnitPrice(line.price);
 return Object.freeze({id:line.id,name:String(line.name??'الصنف'),unit:line.unit,quantity:current.quantity,stock:current.stock,price,priceTitle:measuredPriceTitle(line.unit),choices:Object.freeze(quantityChoices(line.unit))});
}

export function saleQuantityPreview(model,value){
 const next=setSaleQuantity({id:model.id,unit:model.unit,stock:model.stock,price:model.price},value);
 return Object.freeze({quantity:next.quantity,quantityStep:next.quantityStep,total:saleLineTotal(next)});
}
