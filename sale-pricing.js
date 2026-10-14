// Decimal arithmetic mirrors Android SalePricingRules without binary rounding drift.
function decimal(value,limit=1e10){
 if((typeof value!=='number'&&typeof value!=='string')||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0)throw new Error('السعر أو الكمية غير صالح');
 const number=Number(value);if(number>limit)throw new Error('القيمة أكبر من الحد المدعوم');
 const match=/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(number));
 if(!match)throw new Error('أدخل رقمًا عشريًا صالحًا');
 const fraction=match[2]||'',scale=fraction.length-Number(match[3]||0),n=BigInt(match[1]+fraction);return scale<0?{n:n*pow(-scale),scale:0}:{n,scale};
}
const pow=scale=>10n**BigInt(scale);
const rounded=(n,divisor)=>(n+divisor/2n)/divisor;
function scaled(value,scale,limit=1e10){const d=decimal(value,limit);return d.scale<=scale?d.n*pow(scale-d.scale):rounded(d.n,pow(d.scale-scale));}
function moneyNumber(cents){if(cents>99999999999999n)throw new Error('القيمة أكبر من الحد المالي المدعوم');return Number(cents)/100;}
export function saleUnitPrice(value){return Number(scaled(value,4))/10000;}
export function salePriceForTotal(total,quantity){
 const t=decimal(total),q=decimal(quantity);if(t.n<=0n||q.n<=0n)throw new Error('إجمالي السطر والكمية يجب أن يكونا أكبر من صفر');
 return saleUnitPrice(Number(rounded(t.n*pow(q.scale+4),q.n*pow(t.scale)))/10000);
}
export function saleLineTotal(line){const quantity=scaled(line.quantity,3);return Number(rounded(scaled(line.price,4)*quantity,100000n))/100;}
export function salePriceTotals(cart){
 let exact=0n,server=0n;for(const line of cart){const value=scaled(line.price,4)*scaled(line.quantity,3);exact+=value;server+=rounded(value,100000n);}
 return {subtotal:moneyNumber(rounded(exact,100000n)),serverSubtotal:moneyNumber(server)};
}
/** Captured server discounts are subtracted before rounding; never rewrite a pending payload. */
export function saleDiscountedTotal(subtotal,discount){
 const a=decimal(subtotal,Infinity),b=decimal(discount,Infinity),scale=Math.max(a.scale,b.scale),remaining=a.n*pow(scale-a.scale)-b.n*pow(scale-b.scale);
 if(remaining<0n)throw new Error('الخصم أكبر من إجمالي المبيعة');
 return moneyNumber(scale<=2?remaining*pow(2-scale):rounded(remaining,pow(scale-2)));
}
