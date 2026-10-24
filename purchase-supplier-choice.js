/** Source-order display identities only; supplier financial data stays with the purchase host. */
export function createPurchaseSupplierChoices(suppliers,projectId){
 if(!Array.isArray(suppliers)||typeof projectId!=='string'||!projectId)throw new Error('تعذر قراءة موردي فاتورة الشراء');
 const byId=new Map();
 const rows=suppliers.map((supplier,index)=>{
  if(!supplier||typeof supplier.id!=='string'||!supplier.id||byId.has(supplier.id)||supplier.active===false||supplier.project_id!==undefined&&supplier.project_id!==projectId)throw new Error('بيانات موردي فاتورة الشراء غير متطابقة');
  const row=Object.freeze({id:supplier.id,index,name:String(supplier.name||'مورد')});
  byId.set(row.id,row);return row;
 });
 return Object.freeze({rows:Object.freeze(rows),get:id=>byId.get(id)});
}
