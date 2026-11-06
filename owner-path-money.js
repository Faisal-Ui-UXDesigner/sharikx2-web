import {purchaseRoundedTotal,purchaseAmountExceeds} from './purchase-arithmetic.js';
import {decimalSum} from './decimal-sum.js';

// OwnerPathScreen rounds EACH quantity × unit price HALF_UP, then adds.
// Reuse the existing decimal adapter, not binary multiplication/Math.round.
export function ownerSaleSubtotal(items){
 return purchaseRoundedTotal(items.map(item=>({quantity:item.quantity,cost:item.unit_sale_price})));
}
export function ownerSaleTotal(subtotal,discount='0'){
 if(purchaseAmountExceeds(discount,subtotal))throw new Error('الخصم أكبر من مجموع المبيعة');
 return decimalSum([subtotal,-Number(discount)]);
}
