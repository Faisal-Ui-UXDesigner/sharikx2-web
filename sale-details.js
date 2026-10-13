const text=value=>String(value??'').trim();
function amount(value){if(!['string','number'].includes(typeof value)||text(value)===''||!Number.isFinite(Number(value))||Number(value)<0)throw new Error('بيانات مبالغ أو كميات المبيعة غير مكتملة');return Number(value);}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
/** Stored line/refund amounts are authoritative, not quantity × today's price. */
export function saleDetailsSnapshot(sale,projectId,saleId){
 if(!sale||sale.id!==saleId||(sale.project_id!==undefined&&sale.project_id!==projectId)||!Array.isArray(sale.items)||!Array.isArray(sale.returns||[]))throw new Error('بيانات المبيعة غير متطابقة');
 const byId=new Map(),items=sale.items.map(item=>{if(!item?.id||byId.has(item.id))throw new Error('هوية صنف المبيعة غير متطابقة');const row={id:item.id,name:text(item.product_name??item.name)||'صنف',quantity:amount(item.quantity_pieces??item.quantity),price:amount(item.unit_price??item.unit_sale_price),total:amount(item.line_total)};byId.set(row.id,row);return row;});
 const returns=(sale.returns||[]).map(row=>{if(!row||!Array.isArray(row.items||[])||(row.sale_id!==undefined&&row.sale_id!==saleId))throw new Error('بيانات سجل المرتجعات غير متطابقة');return {total:amount(row.total),date:row.created_at,items:(row.items||[]).map(item=>({name:byId.get(item.sale_item_id)?.name||'صنف',quantity:amount(item.quantity_pieces??item.quantity),refund:amount(item.refund_amount)}))};});
 return freeze(JSON.parse(JSON.stringify({sale,total:amount(sale.total),customerName:text(sale.customer_name)||text(sale.customer?.name)||'زبون غير محدد',customerPhone:text(sale.customer_phone)||text(sale.customer?.phone)||'بدون رقم جوال',accountName:text(sale.payment_account?.name),date:sale.created_at,items,returns})));
}
