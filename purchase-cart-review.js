import {purchaseLineTotal,purchaseRoundedTotal} from './purchase-arithmetic.js';

export function purchaseCartChange(quantity,cost){
 if([quantity,cost].some(value=>typeof value!=='number'&&(typeof value!=='string'||!/^\d*\.?\d+(?:e[+-]?\d+)?$/i.test(value.trim()))))throw new Error('أدخل كمية موجبة وسعر شراء صحيحًا');
 if(String(quantity??'').trim()===''||String(cost??'').trim()==='')throw new Error('أدخل كمية موجبة وسعر شراء صحيحًا');
 const next=Object.freeze({quantity:Number(quantity),cost:Number(cost)});
 purchaseLineTotal(next.quantity,next.cost);return next;
}
export function purchaseCartReview(items,products){
 if(!Array.isArray(items)||!Array.isArray(products))throw new Error('تعذر قراءة أصناف الفاتورة');
 const byId=new Map(products.map(product=>[product.id,product]));
 const lines=items.map((item,index)=>{
  if(!item||typeof item.product_id!=='string'||!byId.has(item.product_id))throw new Error('اختر أصنافًا متاحة');
  const values=purchaseCartChange(item.quantity,item.cost);
  return Object.freeze({index,productId:item.product_id,name:String(byId.get(item.product_id).name||'صنف'),...values,total:purchaseLineTotal(values.quantity,values.cost)});
 });
 const total=purchaseRoundedTotal(items),productCount=new Set(lines.map(line=>line.productId)).size;
 return Object.freeze({lines:Object.freeze(lines),total,displayTotal:total,productCount,lineCount:lines.length});
}
