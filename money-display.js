/** Android MoneyDisplayRules.roundedWhole: presentation only, never a transaction amount. */
export function roundedDecimalDisplay(value,decimals=0){
 if(!Number.isInteger(decimals)||decimals<0||decimals>20)throw new Error('دقة عرض المبلغ غير صالحة');
 const number=Number(value);if(!Number.isFinite(number)||number===0)return 0;
 const match=/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(Math.abs(number))),fraction=match[2]||'',scale=fraction.length-Number(match[3]||0),coefficient=BigInt(match[1]+fraction);
 const shift=scale-decimals,divisor=shift>0?10n**BigInt(shift):1n,rounded=shift>0?(coefficient+divisor/2n)/divisor:coefficient*10n**BigInt(-shift);
 // Convert a decimal string, not a huge scaled Number divided by a float.
 const digits=rounded.toString().padStart(decimals+1,'0'),text=decimals?`${digits.slice(0,-decimals)}.${digits.slice(-decimals)}`:digits;
 const result=Number(text)*(number<0?-1:1);return result===0?0:result;
}
export const roundedWholeDisplay=value=>roundedDecimalDisplay(value,0);
/** Native expenseValue: signed presentation only, never rewrite a ledger row. */
export function expenseDisplayValue(value){const number=Number(value);return Number.isFinite(number)&&Math.abs(number)>0?-Math.abs(number):0;}
