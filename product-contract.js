// Persisted numeric scales from the existing products table; no schema changes.
const NUMERIC_SCALES={pieces_per_purchase_unit:3,default_sale_price:2,low_stock_level:3};
const TEXT_FIELDS=['id','project_id','name','barcode','category','base_unit','purchase_unit','notes'];

export function requireProductResult(rows,expectedId=null){
 if(!Array.isArray(rows)||rows.length!==1||!rows[0]||typeof rows[0].id!=='string'||!rows[0].id){
  throw new Error('تعذر تأكيد حفظ الصنف؛ أعد تحميل البضاعة قبل إعادة المحاولة');
 }
 if(expectedId!=null&&rows[0].id!==expectedId)throw new Error('رد حفظ الصنف لا يطابق الصنف المطلوب');
 return rows[0];
}

export function productMatchesPayload(row,payload){
 if(!row||row.active!==true)return false;
 if(!TEXT_FIELDS.every(key=>payload[key]===undefined||row[key]===payload[key]))return false;
 return Object.entries(NUMERIC_SCALES).every(([key,scale])=>{
  if(payload[key]===undefined)return true;
  if(row[key]==null||!Number.isFinite(Number(row[key]))||!Number.isFinite(Number(payload[key])))return false;
  const factor=10**scale;
  return Math.round(Number(row[key])*factor)===Math.round(Number(payload[key])*factor);
 });
}
