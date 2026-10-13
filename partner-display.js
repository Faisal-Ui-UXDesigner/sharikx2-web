// Mirrors FinancialNumberRules.tenthPercent and MainActivity.pctFmt.
// Presentation only: never feed the formatted value back into financial state.
const percentFormat=new Intl.NumberFormat('ar-u-nu-latn',{maximumFractionDigits:1});
export function partnerPercent(value){
 const input=Number(value),finite=Number.isFinite(input)?input:0;
 const rounded=Math.max(0,Math.round(finite*10)/10);
 if(!Number.isFinite(rounded))return '0%';
 return percentFormat.format(rounded)+'%';
}
