import {saleUnitPrice,salePriceTotals} from './sale-pricing.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const saleDraftKey=projectId=>`sharikx2-unsent-sales-v1:${projectId}`;
export function validateSaleDraft(draft,projectId){
 if(!draft||draft.version!==1||draft.projectId!==projectId||typeof draft.id!=='string'||!uuid.test(draft.id)||!Array.isArray(draft.cart)||!draft.cart.length||typeof draft.asDebt!=='boolean')throw new Error('مسودة المبيعة غير صالحة');
 const ids=new Set();
 for(const line of draft.cart){
  if(!line||typeof line.id!=='string'||!line.id||ids.has(line.id)||typeof line.name!=='string'||!Number.isFinite(line.quantity)||line.quantity<=0||!Number.isFinite(line.stock)||line.stock<0||!Number.isFinite(line.cost)||line.cost<0)throw new Error('بيانات أصناف المسودة غير صالحة');
  ids.add(line.id);saleUnitPrice(line.price);
 }
 if(draft.customer!==null&&(!draft.customer||typeof draft.customer.id!=='string'||!draft.customer.id||typeof draft.customer.name!=='string'||typeof draft.customer.phone!=='string'))throw new Error('بيانات زبون المسودة غير صالحة');
 if(draft.accountId!==null&&(typeof draft.accountId!=='string'||!draft.accountId))throw new Error('حساب المسودة غير صالح');
 salePriceTotals(draft.cart);return JSON.parse(JSON.stringify(draft));
}
export function readSaleDrafts(storage,projectId){
 if(!storage)throw new Error('تخزين الجلسة غير متاح لحفظ المسودات');
 const raw=storage.getItem(saleDraftKey(projectId));if(raw===null)return [];
 const rows=JSON.parse(raw);if(!Array.isArray(rows))throw new Error('تعذر قراءة قائمة المسودات');
 const ids=new Set();return rows.map(row=>{const draft=validateSaleDraft(row,projectId);if(ids.has(draft.id))throw new Error('هوية المسودة مكررة');ids.add(draft.id);return draft;});
}
export function saveSaleDraft(storage,projectId,draft){
 const validated=validateSaleDraft(draft,projectId),rows=readSaleDrafts(storage,projectId),index=rows.findIndex(row=>row.id===draft.id);
 if(index<0)rows.push(validated);else rows[index]=validated;
 storage.setItem(saleDraftKey(projectId),JSON.stringify(rows));return validated;
}
export function removeSaleDraft(storage,projectId,id){
 const rows=readSaleDrafts(storage,projectId);storage.setItem(saleDraftKey(projectId),JSON.stringify(rows.filter(row=>row.id!==id)));
}
export function restoreSaleDraft(draft,projectId,catalog){
 const saved=validateSaleDraft(draft,projectId),unavailable=[];
 const cart=saved.cart.map(line=>{const product=catalog.get(line.id);if(!product||Number(product.quantity_pieces)<line.quantity)unavailable.push(line.name);return {...line,stock:product?Number(product.quantity_pieces):0,cost:product?Number(product.weighted_unit_cost):line.cost};});
 return {...saved,cart,unavailable};
}
