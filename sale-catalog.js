import {normalizeBarcode} from './barcode-scanner.js';

export function createSaleCatalog(rows,projectId){
 if(typeof projectId!=='string'||!projectId||!Array.isArray(rows))throw new Error('تعذر قراءة بضاعة المشروع');
 const byId=new Map(),byBarcode=new Map();
 const products=rows.map(row=>{
  if(!row||typeof row.id!=='string'||!row.id||byId.has(row.id)||row.active===false||(row.project_id!==undefined&&row.project_id!==projectId))throw new Error('بيانات بضاعة المشروع غير متطابقة');
  for(const key of ['quantity_pieces','default_sale_price','weighted_unit_cost']){
   if(row[key]===null||row[key]===undefined||row[key]===''||!Number.isFinite(Number(row[key]))||Number(row[key])<0)throw new Error('بيانات كمية أو سعر الصنف غير صالحة');
  }
  const product=Object.freeze({...row}),barcode=normalizeBarcode(row.barcode);
  byId.set(row.id,product);
  if(barcode){if(byBarcode.has(barcode))throw new Error('الباركود مكرر في بضاعة المشروع');byBarcode.set(barcode,product);}
  return product;
 });
 return Object.freeze({products:Object.freeze(products),get:id=>byId.get(id),barcode:value=>byBarcode.get(normalizeBarcode(value))});
}
export async function loadSaleCatalog(api,projectId,isCurrent=()=>true){
 if(!isCurrent())return null;
 const rows=await api.allRows('products',projectId,'*',{active:'eq.true'});
 if(!isCurrent())return null;
 return createSaleCatalog(rows,projectId);
}
