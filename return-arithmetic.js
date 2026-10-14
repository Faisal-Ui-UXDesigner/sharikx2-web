// Return quantities are not price/quantity-normalized: retained payload values stay unchanged.
const pow=scale=>10n**BigInt(scale);
function decimal(value,signed=false){
 if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))||(!signed&&Number(value)<0))throw new Error('تحقق من كميات وأسعار المرتجع');
 const match=/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(Number(value)));if(!match)throw new Error('قيمة المرتجع غير صالحة');
 const fraction=match[3]||'',scale=fraction.length-Number(match[4]||0),n=BigInt(match[2]+fraction)*(match[1]?-1n:1n);return scale<0?{n:n*pow(-scale),scale:0}:{n,scale};
}
function number({n,scale}){const digits=n.toString().padStart(scale+1,'0'),value=Number(scale?`${digits.slice(0,-scale)}.${digits.slice(-scale)}`:digits);if(!Number.isFinite(value))throw new Error('قيمة المرتجع أكبر من الحد المدعوم');return value;}
function sum(rows){const scale=Math.max(0,...rows.map(row=>row.scale));return {n:rows.reduce((n,row)=>n+row.n*pow(scale-row.scale),0n),scale};}
function subtract(a,b){const scale=Math.max(a.scale,b.scale),n=a.n*pow(scale-a.scale)-b.n*pow(scale-b.scale);return {n:n>0n?n:0n,scale};}
export const returnNumber=value=>number(decimal(value));
export function returnAvailable(sold,returned){return number(subtract(decimal(sold),sum(returned.map(value=>decimal(value)))));}
export function returnStep(current,delta,available){const next=sum([decimal(current),decimal(delta,true)]),limit=decimal(available),scale=Math.max(next.scale,limit.scale),n=next.n*pow(scale-next.scale),max=limit.n*pow(scale-limit.scale);return number({n:n<0n?0n:n>max?max:n,scale});}
function products(items){return items.map(item=>{const q=decimal(item.quantity),p=decimal(item.unit_price);return {n:q.n*p.n,scale:q.scale+p.scale};});}
export function returnRawTotals(items,saleTotal){const total=sum(products(items));return {refund:number(total),remaining:number(subtract(decimal(saleTotal),total))};}
export function returnRoundedRefund(items){
 const cents=products(items).reduce((total,row)=>total+(row.scale<=2?row.n*pow(2-row.scale):(row.n+pow(row.scale-2)/2n)/pow(row.scale-2)),0n);
 if(cents>99999999999999n)throw new Error('قيمة المرتجع أكبر من الحد المالي المدعوم');return number({n:cents,scale:2});
}
