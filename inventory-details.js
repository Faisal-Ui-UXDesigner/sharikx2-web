import {normalizeProduct} from './inventory.js';
import {display} from './inventory-category.js';
import {popularityPresentation} from './inventory-popularity.js';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=value=>String(value??'').trim();
const invalid=()=>new Error('تعذر قراءة تفاصيل شراء الصنف');
const amount=value=>{if(value==null)return 0;if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value)))throw invalid();return Number(value);};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

export function inventoryDetailsModel(product,{projectId,aliases={},popularityCount=null,now=Date.now()}={}){
 if(!object(product)||!text(product.id)||(projectId&&product.project_id&&product.project_id!==projectId))throw new Error('تعذر قراءة بيانات الصنف');
 const item=normalizeProduct(product),unit=String(item.displayUnit);
 const values=[{label:'الباركود',kind:'text',value:text(item.barcode)||'—'},
  {label:'الوحدة',kind:'text',value:unit},
  {label:'الكمية الحالية',kind:'quantity',value:item.quantity,unit},
  {label:'تكلفة الشراء الحالية',kind:'unitCost',value:item.purchaseUnitCost},
  {label:'سعر البيع المتوقع',kind:'money',value:item.saleUnitPrice}];
 if(item.lowStockQuantity>0)values.push({label:'تنبيه نقص البضاعة عند',kind:'quantity',value:item.lowStockQuantity,unit,tone:'primary'});
 const popularity=popularityPresentation(item,popularityCount,now),count=popularity.count;
 values.push({label:'عدد مرات البيع خلال 60 يومًا',kind:count===null?'text':'count',value:count??'—',tone:popularity.tone,popularity:true});
 return freeze({id:text(item.id),name:text(item.name)||'صنف',category:display(aliases,item.category),notes:text(item.notes),
  popularityUnavailable:count===null,values,valuation:[
   {label:'قيمة الشراء',kind:'total',value:item.purchaseValue},
   {label:'قيمة البيع المتوقعة',kind:'total',value:item.saleValue},
   {label:'الربح المتوقع',kind:'total',value:item.expectedProfit}
  ]});
}

export function inventoryPurchaseEntries(rows,{productId,projectId}={}){
 if(!Array.isArray(rows))throw invalid();
 const entries=[];
 for(const row of rows){
  if(!object(row)||!object(row.purchase))continue;
  const purchase=row.purchase;
  if((productId&&row.product_id&&row.product_id!==productId)||(projectId&&purchase.project_id&&purchase.project_id!==projectId))throw invalid();
  entries.push({date:String(purchase.purchased_at||purchase.created_at||''),supplierName:text(purchase.supplier?.name),
   values:[{label:'الكمية المشتراة',kind:'quantity',value:amount(row.quantity_pieces),unit:'قطعة'},
    {label:'تكلفة القطعة',kind:'unitCost',value:amount(row.unit_cost)},
    {label:'إجمالي الصنف',kind:'money',value:amount(row.line_total),tone:'primary'}]});
 }
 // Native InventoryPurchaseHistoryQueries orders original date text, stably.
 entries.sort((a,b)=>a.date===b.date?0:a.date>b.date?-1:1);
 return freeze(entries);
}
