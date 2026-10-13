import {purchaseCartChange} from './purchase-cart-review.js';

export function createPurchaseCartLine(product,quantity,cost,projectId){
 if(!projectId||!product||typeof product.id!=='string'||!product.id||product.active===false||(product.project_id!==undefined&&product.project_id!==projectId))throw new Error('اختر صنفًا متاحًا في المشروع');
 const values=purchaseCartChange(quantity,cost);return Object.freeze({product_id:product.id,...values});
}
/** Object identity, not product ID: duplicate purchase lines are independent. */
export function purchaseUndoIndex(items,lastAdded){
 if(!Array.isArray(items))throw new Error('تعذر قراءة أصناف الفاتورة');return lastAdded?items.indexOf(lastAdded):-1;
}
