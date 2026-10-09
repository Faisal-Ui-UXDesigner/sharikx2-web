const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(row,key,fallback='')=>row?.[key]==null?fallback:String(row[key]);
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const copy=value=>object(value)?JSON.parse(JSON.stringify(value)):null;
const modern=row=>number(row.historyVersion)>=2;
const recordItemId=row=>text(row,modern(row)?'itemId':'id');

export function historyQuantity(item){
 if(!item)return 0;
 const saved=number(item.quantity);
 return saved>0||!Object.hasOwn(item,'quantity_pieces')?saved:number(item.quantity_pieces)/Math.max(1,number(item.piecesPerPurchaseUnit));
}
export function historyUnit(item){return item?text(item,'unit','وحدة').trim()||'وحدة':'وحدة';}
export function historyProfit(item){return historyQuantity(item)*(number(item?.expectedSalePrice)-number(item?.purchasePrice));}
export const sameHistoryNumber=(a,b)=>Math.abs(number(a)-number(b))<0.0001;

function summary(row,index){
 const recordedAt=text(row,'historyRecordedAt'),legacy=!modern(row);
 const before=legacy?copy(row):copy(row.before),after=legacy?null:copy(row.after);
 const source=after||before;
 const key=legacy?'legacy-'+text(row,'historyId',String(index)):
  text(row,'itemId')||(source?text(source,'id',text(source,'name')):text(row,'historyId'));
 const parsed=Date.parse(recordedAt.replace(' ','T')+'Z');
 return {itemKey:key,date:recordedAt.length>=10?recordedAt.slice(0,10):'',recordedAt,
  action:text(row,'historyAction','تحديث الجرد'),legacy,before,after,count:1,timestamp:Number.isFinite(parsed)?parsed:0};
}

export function inventoryHistorySummaries(history=[],inventory=[]){
 const source=(Array.isArray(history)?history:[]),current=new Map();
 for(const item of Array.isArray(inventory)?inventory:[])if(object(item)&&!current.has(text(item,'id')))current.set(text(item,'id'),item);
 // Capture the immediately following record for each ID in one backward pass.
 const nextRecords=new Map(),nextAt=new Map();
 for(let index=source.length-1;index>=0;index--){
  const row=source[index];if(!object(row))continue;
  const id=recordItemId(row);
  if(id){nextAt.set(index,nextRecords.get(id));nextRecords.set(id,row);}
 }
 const result=[],groups=new Map();
 source.forEach((row,index)=>{
  if(!object(row))return;
  const incoming=summary(row,index);
  if(incoming.legacy){
   const id=text(row,'id');if(id)incoming.itemKey=id;
   if(incoming.action==='حذف الصنف'){incoming.legacy=false;}
   else{
    const next=nextAt.get(index);
    const state=next?(modern(next)?(object(next.before)?next.before:next.after):next):null;
    const after=object(state)?state:(id?current.get(id):null);
    if(after){incoming.legacy=false;incoming.after=copy(after);}
   }
  }
  const groupKey=JSON.stringify([incoming.date,incoming.itemKey]);
  const target=!incoming.legacy?groups.get(groupKey):null;
  if(target){
   target.after=incoming.after;target.action=incoming.action;
   target.recordedAt=incoming.recordedAt;target.timestamp=incoming.timestamp;target.count+=incoming.count;
  }else{
   result.push(incoming);if(!incoming.legacy)groups.set(groupKey,incoming);
  }
 });
 return result.sort((a,b)=>b.timestamp-a.timestamp);
}

export function historyChanges(change){
 const {before,after}=change;
 if(change.legacy)return {kind:'legacy',badges:[change.action],item:before,rows:[]};
 if(!before)return {kind:'added',badges:['صنف جديد'],item:after,rows:[]};
 if(!after)return {kind:'deleted',badges:['تم حذف الصنف'],item:before,rows:[]};
 const rows=[],badges=[];
 for(const [key,label,badge] of [['name','الاسم','تغير الاسم'],['unit','الوحدة','تغيرت الوحدة']]){
  const left=key==='unit'?historyUnit(before):text(before,key),right=key==='unit'?historyUnit(after):text(after,key);
  if(left!==right){badges.push(badge);rows.push({kind:'text',label,before:left,after:right});}
 }
 for(const [key,label,badge] of [['quantity','الكمية','تغيرت الكمية'],['purchasePrice','سعر الشراء','تغير سعر الشراء'],['expectedSalePrice','سعر البيع المتوقع','تغير سعر البيع']]){
  const left=number(before[key]),right=number(after[key]);
  if(!sameHistoryNumber(left,right)){badges.push(badge);rows.push({kind:key==='quantity'?'quantity':'money',label,before:left,after:right,difference:right-left});}
 }
 const left=historyProfit(before),right=historyProfit(after);
 if(!sameHistoryNumber(left,right))rows.push({kind:'profit',label:'تأثير التعديل على الربح المتوقع',before:left,after:right,difference:right-left});
 return {kind:'changed',badges:badges.length?badges:['تم تأكيد الجرد'],rows};
}

export async function loadInventoryHistory(api,projectId){
 const snapshot=await api.financeState(projectId);
 if(!object(snapshot)||!Object.hasOwn(snapshot,'state')||(snapshot.state!==null&&!object(snapshot.state)))throw new Error('تعذر قراءة سجل الجرد');
 const state=snapshot.state||{};
 for(const key of ['inventoryHistory','inventory'])if(state[key]!=null&&!Array.isArray(state[key]))throw new Error('تعذر قراءة سجل الجرد');
 return inventoryHistorySummaries(state.inventoryHistory,state.inventory);
}
