// Decimal coefficients mirror BigDecimal.valueOf and PostgreSQL numeric, not binary products.
const error=()=>new Error('تحقق من كمية وتكلفة الأصناف والدفعات');
const pow=scale=>10n**BigInt(scale);
function decimal(value){
 if((typeof value!=='number'&&typeof value!=='string')||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0)throw error();
 const match=/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(Number(value)));if(!match)throw error();
 const fraction=match[2]||'',scale=fraction.length-Number(match[3]||0),n=BigInt(match[1]+fraction);
 return scale<0?{n:n*pow(-scale),scale:0}:{n,scale};
}
function number({n,scale}){
 const digits=n.toString().padStart(scale+1,'0'),result=Number(scale?`${digits.slice(0,-scale)}.${digits.slice(-scale)}`:digits);if(!Number.isFinite(result)||result>999999999999.99)throw new Error('القيمة أكبر من الحد المالي المدعوم');return result;
}
function sum(values){
 const rows=values.map(decimal),scale=Math.max(0,...rows.map(row=>row.scale));return {n:rows.reduce((total,row)=>total+row.n*pow(scale-row.scale),0n),scale};
}
function cents(quantity,cost){
 const q=decimal(quantity),c=decimal(cost);if(q.n===0n)throw error();const n=q.n*c.n,scale=q.scale+c.scale;
 return scale<=2?n*pow(2-scale):(n+pow(scale-2)/2n)/pow(scale-2);
}
export function purchaseLineTotal(quantity,cost){return number({n:cents(quantity,cost),scale:2});}
export function purchaseRoundedTotal(items){
 if(!Array.isArray(items))throw error();return number({n:items.reduce((total,item)=>total+cents(item.quantity,item.cost),0n),scale:2});
}
export function purchasePaymentTotal(payments){if(!Array.isArray(payments))throw error();return number(sum(payments.map(payment=>payment.amount)));}
export function purchaseRemaining(total,paid){
 const a=decimal(total),b=decimal(paid),scale=Math.max(a.scale,b.scale),difference=a.n*pow(scale-a.scale)-b.n*pow(scale-b.scale);return number({n:difference>0n?difference:0n,scale});
}
export function purchaseAmountExceeds(value,limit){const a=decimal(value),b=decimal(limit),scale=Math.max(a.scale,b.scale);return a.n*pow(scale-a.scale)>b.n*pow(scale-b.scale);}
/** Presentation only: never substitute this value for an invoice amount. */
export function purchaseWholeDisplay(value){const row=decimal(value);return number({n:row.scale?(row.n+pow(row.scale)/2n)/pow(row.scale):row.n,scale:0});}
