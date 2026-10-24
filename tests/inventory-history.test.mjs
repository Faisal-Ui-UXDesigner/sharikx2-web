import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryHistorySummaries,historyChanges,historyQuantity,historyProfit,loadInventoryHistory} from '../inventory-history.js';
const item=(quantity=1)=>({id:'a',name:'سكر',unit:'علبة',quantity,purchasePrice:2,expectedSalePrice:5});
const change=(before,after,date='2026-10-07 10:00')=>({historyVersion:2,itemId:'a',historyRecordedAt:date,before,after});

test('Android history groups a day per item, preserving first before and last after in source order',()=>{
 const source=[change(item(1),item(2)),change(item(2),item(3),'2026-10-07 11:00'),change(item(3),item(4),'2026-10-08 10:00')],before=JSON.stringify(source);
 const rows=inventoryHistorySummaries(source);
 assert.equal(rows.length,2);assert.equal(rows[0].date,'2026-10-08');assert.equal(rows[1].count,2);
 assert.equal(rows[1].before.quantity,1);assert.equal(rows[1].after.quantity,3);
 rows[1].before.name='changed';assert.equal(JSON.stringify(source),before);
});

test('legacy history infers its after state from the next matching record or current inventory',()=>{
 const legacy={...item(1),historyRecordedAt:'2026-10-07 09:00'};
 const rows=inventoryHistorySummaries([legacy,change(item(2),item(3),'2026-10-08 10:00')]);
 assert.equal(rows[1].legacy,false);assert.equal(rows[1].after.quantity,2);
 const current=inventoryHistorySummaries([legacy],[item(4)]);
 assert.equal(current[0].after.quantity,4);
 const unresolved=inventoryHistorySummaries([legacy]);assert.equal(unresolved[0].legacy,true);
 assert.equal(historyChanges(unresolved[0]).kind,'legacy');
});

test('legacy deletion is a real deletion and grouping distinguishes items and days',()=>{
 const deleted={...item(1),historyAction:'حذف الصنف',historyRecordedAt:'2026-10-07 09:00'};
 const rows=inventoryHistorySummaries([deleted,change(null,{...item(),id:'b'},'2026-10-07 11:00')]);
 assert.equal(rows.length,1); // Same itemId intentionally groups deletion and addition.
 assert.equal(rows[0].before.quantity,1);
 const separate=inventoryHistorySummaries([deleted,{...change(null,item()),itemId:'b'}]);
 assert.equal(separate.length,2);
 assert.equal(historyChanges(separate[1]).kind,'deleted');
});

test('history field changes use Android tolerance and expected-profit equation',()=>{
 const diff=historyChanges({before:item(1),after:{...item(3),name:'جديد',unit:'صندوق'},legacy:false});
 assert.deepEqual(diff.badges,['تغير الاسم','تغيرت الوحدة','تغيرت الكمية']);
 assert.equal(diff.rows.at(-1).difference,6);
 assert.equal(historyProfit({quantity:0,quantity_pieces:6,piecesPerPurchaseUnit:3,purchasePrice:2,expectedSalePrice:5}),6);
 assert.equal(historyQuantity({quantity:4,quantity_pieces:100}),4);
 const unchanged=historyChanges({before:item(),after:item(1.00001),legacy:false});
 assert.deepEqual(unchanged.badges,['تم تأكيد الجرد']);
 assert.equal(historyChanges({before:null,after:item(),legacy:false}).kind,'added');
});

test('null records and invalid timestamps are safe and legacy entries without identities remain separate',()=>{
 const rows=inventoryHistorySummaries([null,'invalid',{name:'a'},{name:'b'}]);
 assert.equal(rows.length,2);assert.equal(rows[0].timestamp,0);assert.equal(rows[1].legacy,true);
 assert.notEqual(rows[0].itemKey,rows[1].itemKey);
});

test('shared history loader rejects malformed snapshots but accepts absent and empty state',async()=>{
 const api={financeState:async()=>({state:{inventoryHistory:[change(null,item())]}})};
 assert.equal((await loadInventoryHistory(api,'p')).length,1);
 for(const response of [null,{}, {state:[]},{state:{inventoryHistory:{}}},{state:{inventory:'bad'}}]){
  api.financeState=async()=>response;await assert.rejects(loadInventoryHistory(api,'p'),/سجل الجرد/);
 }
 api.financeState=async()=>({state:null});assert.deepEqual(await loadInventoryHistory(api,'p'),[]);
});
