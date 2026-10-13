import {visibleCategories,ordered,display,INVENTORY_CATEGORY_OTHER} from './inventory-category.js';

const text=value=>String(value??'');
const key=value=>text(value).trim().toLowerCase();
const matchesCategory=(value,category)=>category==='الكل'||(category===INVENTORY_CATEGORY_OTHER?value===''||value===INVENTORY_CATEGORY_OTHER:key(value)===key(category));

/** Immutable source-order identities: filtering never changes which invoice product is chosen. */
export function createPurchaseProductChoices(products,projectId,settings={}){
 if(typeof projectId!=='string'||!projectId||!Array.isArray(products))throw new Error('تعذر قراءة أصناف فاتورة الشراء');
 const byId=new Map(),rows=products.map((product,index)=>{
  if(!product||typeof product.id!=='string'||!product.id||byId.has(product.id)||product.active===false||(product.project_id!==undefined&&product.project_id!==projectId))throw new Error('بيانات أصناف فاتورة الشراء غير متطابقة');
  const row=Object.freeze({id:product.id,index,name:text(product.name)||'صنف',barcode:text(product.barcode),category:text(product.category).trim()});byId.set(row.id,row);return row;
 });
 const aliases=Object.freeze({...settings.aliases});
 const categories=Object.freeze(['الكل',...ordered(visibleCategories({...settings,inventoryCategories:rows.map(row=>row.category)}).filter(category=>key(category)!==key(INVENTORY_CATEGORY_OTHER)&&category!=='الكل'),aliases),INVENTORY_CATEGORY_OTHER]);
 return Object.freeze({products:Object.freeze(rows),categories,get:id=>byId.get(id),label:category=>display(aliases,category),search:(query='',category='الكل')=>{
  const q=key(query);return rows.filter(row=>
   matchesCategory(row.category,category)&&
   (!q||`${row.name} ${row.barcode}`.toLowerCase().includes(q)));
 }});
}
