// Decimal arithmetic mirrors Android SalePricingRules without binary rounding drift.
function decimal(value){
 if((typeof value!=='number'&&typeof value!=='string')||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0)throw new Error('السعر أو الكمية غير صالح');
 const number=Number(value);if(number>1e10)throw new Error('القيمة أكبر من الحد المدعوم');
 const raw=/e/i.test(String(value))?number.toFixed(12):String(value).trim(),text=raw.startsWith('.')?'0'+raw:raw;const match=/^(\d+)(?:\.(\d*))?$/.exec(text);
 if(!match)throw new Error('أدخل رقمًا عشريًا صالحًا');
 const fraction=match[2]||'';return {n:BigInt(match[1]+fraction),scale:fraction.length};
}
const pow=scale=>10n**BigInt(scale);
const rounded=(n,divisor)=>(n+divisor/2n)/divisor;
function scaled(value,scale){const d=decimal(value);return d.scale<=scale?d.n*pow(scale-d.scale):rounded(d.n,pow(d.scale-scale));}
export function saleUnitPrice(value){return Number(scaled(value,4))/10000;}
export function salePriceForTotal(total,quantity){
 const t=decimal(total),q=decimal(quantity);if(t.n<=0n||q.n<=0n)throw new Error('إجمالي السطر والكمية يجب أن يكونا أكبر من صفر');
 return Number(rounded(t.n*pow(q.scale+4),q.n*pow(t.scale)))/10000;
}
export function saleLineTotal(line){const quantity=scaled(line.quantity,3);return Number(rounded(scaled(line.price,4)*quantity,100000n))/100;}
export function salePriceTotals(cart){
 let exact=0n,server=0n;for(const line of cart){const value=scaled(line.price,4)*scaled(line.quantity,3);exact+=value;server+=rounded(value,100000n);}
 return {subtotal:Number(rounded(exact,100000n))/100,serverSubtotal:Number(server)/100};
}
