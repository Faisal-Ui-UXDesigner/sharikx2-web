import {collectPages} from './pagination.js';
import {matchesContactSearch} from './phone.js';
export function createCustomerCatalog(rows,projectId){
 if(typeof projectId!=='string'||!projectId||!Array.isArray(rows))throw new Error('تعذر قراءة قائمة الزبائن');
 const byId=new Map(),customers=rows.map(row=>{
  if(!row||typeof row.id!=='string'||!row.id||byId.has(row.id)||row.active===false||(row.project_id!==undefined&&row.project_id!==projectId))throw new Error('بيانات قائمة الزبائن غير متطابقة');
  const customer=Object.freeze({...row,name:String(row.name||''),phone:String(row.phone||'')});byId.set(row.id,customer);return customer;
 });
 return Object.freeze({customers:Object.freeze(customers),get:id=>byId.get(id),search:query=>{
  return customers.filter(row=>matchesContactSearch(row.name,row.phone,query));
 }});
}
export async function loadCustomerCatalog(api,projectId,isCurrent=()=>true){
 const assertCurrent=()=>{if(!isCurrent())throw new Error('CUSTOMER_SCREEN_CLOSED');};
 const rows=await collectPages(offset=>api.rows('customers',projectId,'*',offset,{active:'eq.true'}),{assertCurrent});
 return createCustomerCatalog(rows,projectId);
}
