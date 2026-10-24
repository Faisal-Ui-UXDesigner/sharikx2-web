import {decimalSum} from './decimal-sum.js';
const amount=value=>{if(typeof value!=='number'||!Number.isFinite(value))throw new Error('إحصائيات البضاعة غير صالحة');return value;};
export function inventoryStatisticsModel(totals){
 const purchaseValue=amount(totals?.purchaseValue),saleValue=amount(totals?.saleValue);
 const expectedProfit=decimalSum([saleValue,-purchaseValue]);
 return Object.freeze({purchaseValue,saleValue,expectedProfit,purchaseTone:purchaseValue<0?'negative':'standard',
  rows:Object.freeze([
   Object.freeze({key:'purchase',label:'البضاعة بسعر الشراء',value:purchaseValue,precision:0,tone:'standard'}),
   Object.freeze({key:'sale',label:'قيمة البيع المتوقعة',value:saleValue,precision:0,tone:'standard'}),
   Object.freeze({key:'profit',label:'الربح المتوقع',value:expectedProfit,precision:2,tone:expectedProfit>0?'profit':expectedProfit<0?'negative':'muted'})
  ])});
}
