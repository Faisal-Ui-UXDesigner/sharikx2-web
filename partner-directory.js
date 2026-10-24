import {normalizePartnerSnapshot} from './financial.js';

// Historical settlement amounts are authoritative snapshots, not current balances.
const SETTLEMENT_FIELDS=Object.freeze([
 ['settlementCapital','رأس المال عند التصفية'],
 ['settlementProfit','الربح حتى التصفية'],
 ['settlementWithdrawn','إجمالي المسحوبات'],
 ['settlementReinvestment','حصته من المبلغ المتروك للمشروع'],
 ['settlementInventory','حصة البضاعة'],
 ['settlementBalance','صافي التسوية']
]);

function historicalAmount(value){
 if(value===undefined)return 0;
 if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value)))throw new Error('بيانات تسوية الشريك السابق غير صالحة');
 return Number(value);
}

function metricTone(field,value){
 if(field==='settlementBalance')return value>0?'profit':value<0?'loss':'neutral';
 if(field==='settlementProfit')return value>0?'profit':'neutral';
 if(field==='settlementWithdrawn')return value>0?'loss':'neutral';
 return 'standard';
}

export function partnerDirectory(snapshot){
 const normalized=normalizePartnerSnapshot(snapshot);
 const former=normalized.former.slice().reverse().map(row=>Object.freeze({
  name:String(row.name||'شريك سابق'),exitDate:String(row.exitDate||'غير متوفر'),
  metrics:Object.freeze(SETTLEMENT_FIELDS.map(([field,title])=>{
   const value=historicalAmount(row[field]);
   return Object.freeze({field,title,value,tone:metricTone(field,value)});
  }))
 }));
 return Object.freeze({...normalized,current:Object.freeze(normalized.current.map(row=>Object.freeze({...row}))),former:Object.freeze(former)});
}
