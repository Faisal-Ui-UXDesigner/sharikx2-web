// Canonical decimal accumulation: preserve fractional inputs, signed offsets
// and exact cancellation. Currency rounding belongs to display/dispatch rules.
function decimalTerm(value){
  if(!['number','string'].includes(typeof value)||!Number.isFinite(Number(value)))throw new Error('مبلغ الجمع غير صالح');
  const match=/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(value));
  if(!match)throw new Error('مبلغ الجمع غير صالح');
  const fraction=match[3]||'',scale=fraction.length-Number(match[4]||0);
  if(Math.abs(scale)>1000)throw new Error('دقة الجمع تتجاوز الحد المدعوم');
  const coefficient=BigInt(match[2]+fraction)*(match[1]?-1n:1n);
  return scale<0?{coefficient:coefficient*10n**BigInt(-scale),scale:0}:{coefficient,scale};
}
function decimalResult(total,scale){
 if(Math.abs(scale)>1000)throw new Error('دقة الجمع تتجاوز الحد المدعوم');
 if(scale<0){total*=10n**BigInt(-scale);scale=0;}
 const digits=(total<0n?-total:total).toString().padStart(scale+1,'0');
 const result=Number((total<0n?'-':'')+(scale?`${digits.slice(0,-scale)}.${digits.slice(-scale)}`:digits));
 if(!Number.isFinite(result))throw new Error('الإجمالي أكبر من الحد المدعوم');
 return result===0?0:result;
}
export function decimalSum(values){
 if(!Array.isArray(values))throw new Error('قائمة المبالغ غير صالحة');
 const terms=values.map(decimalTerm);
 const scale=terms.reduce((max,term)=>Math.max(max,term.scale),0);
 const total=terms.reduce((sum,term)=>sum+term.coefficient*10n**BigInt(scale-term.scale),0n);
 return decimalResult(total,scale);
}
// Exact multiplication of canonical finite decimal inputs, without currency rounding.
export function decimalProduct(first,second){
 const left=decimalTerm(first),right=decimalTerm(second);
 return decimalResult(left.coefficient*right.coefficient,left.scale+right.scale);
}
