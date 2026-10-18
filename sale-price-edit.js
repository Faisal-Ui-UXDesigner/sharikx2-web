// CashierLineEditView.showPrice: a captured local line, never a catalog update.
import {saleUnitPrice,salePriceForTotal,saleLineTotal,salePriceTotals} from './sale-pricing.js';
import {measuredPriceTitle} from './sale-quantity-edit.js';
import {isMeasuredUnit} from './sale-quantity.js';

export function salePriceEdit(line){
 if(!line||typeof line.id!=='string'||!line.id.trim()||typeof line.quantity!=='number'||!Number.isFinite(line.quantity)||line.quantity<=0||typeof line.cost!=='number'||!Number.isFinite(line.cost)||line.cost<0)throw Error('بيانات الصنف غير صالحة');
 const price=saleUnitPrice(line.price);salePriceTotals([{quantity:line.quantity,price}]);
 return Object.freeze({id:line.id,name:String(line.name??'الصنف'),quantity:line.quantity,price,cost:line.cost,priceTitle:isMeasuredUnit(line.unit)?measuredPriceTitle(line.unit):'سعر القطعة الواحدة'});
}

export function salePricePreview(model,{price,total=''}){
 const hasTotal=String(total??'').trim()!=='';
 if(hasTotal&&((typeof total!=='string'&&typeof total!=='number')||!Number.isFinite(Number(total))||Number(total)<0))throw Error('أدخل إجماليًا صحيحًا أو اتركه فارغًا');
 const usesTotal=hasTotal&&Number(total)>0;
 const next=usesTotal?salePriceForTotal(total,model.quantity):saleUnitPrice(price);
 if(next<=0)throw Error('أدخل سعر القطعة أو إجمالي الكمية');
 const line={quantity:model.quantity,price:next};salePriceTotals([line]);
 return Object.freeze({price:next,total:saleLineTotal(line),belowCost:next<model.cost,usesTotal});
}
