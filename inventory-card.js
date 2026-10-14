import {normalizeProduct} from './inventory.js';
import {display} from './inventory-category.js';
import {isTrending} from './inventory-popularity.js';
export function inventoryCardModel(product,{aliases={},pinned=false,mode='viewer',popularity=null}={}){
 if(!product||typeof product!=='object'||Array.isArray(product)||typeof product.id!=='string'||!product.id.trim())throw new Error('بيانات بطاقة الصنف غير صالحة');
 const item=normalizeProduct(product),text=value=>String(value??'').trim();
 return Object.freeze({id:item.id,name:text(item.name)||'صنف',category:display(aliases,text(item.category)),
  notes:text(item.notes),quantity:item.quantity,unit:String(item.displayUnit),saleUnitPrice:item.saleUnitPrice,
  pinned:Boolean(pinned),canPin:mode==='owner',showPin:mode==='owner'||Boolean(pinned),
  pinLabel:pinned?'إلغاء تثبيت الصنف':'تثبيت الصنف',trending:Number.isInteger(popularity)&&popularity>=0&&isTrending(popularity)});
}
