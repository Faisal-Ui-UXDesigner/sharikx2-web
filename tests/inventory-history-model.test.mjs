import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {historyProfit,historyChanges,historyCardModel,inventoryHistorySummaries} from '../inventory-history.js';
const item=(quantity=1)=>({id:'a',name:'سكر',unit:'علبة',quantity,purchasePrice:.1,expectedSalePrice:.3});
const change=(before,after,extra={})=>({historyVersion:2,itemId:'a',historyRecordedAt:'2026-10-13 10:00',before,after,...extra});
test('history profit and change differences preserve exact decimal native equations',()=>{
 assert.equal(historyProfit(item(.3)),.06);
 const result=historyChanges({before:item(.1),after:item(.3)});
 assert.equal(result.rows.find(row=>row.kind==='quantity').difference,.2);
 assert.equal(result.rows.find(row=>row.kind==='profit').difference,.04);
 assert.equal(historyProfit({...item(.3),purchasePrice:.3,expectedSalePrice:.1}),-.06);
});
test('addition and deletion expose native captions, precision kinds and badge tones',()=>{
 const added=historyCardModel({...change(null,item()),count:1});
 assert.equal(added.caption,'القيمة عند الإضافة');assert.deepEqual(added.badges,[{label:'صنف جديد',tone:'primary'}]);
 assert.deepEqual(added.values.map(row=>row.kind),['text','quantity','unitCost','money','money']);
 assert.equal(added.values.at(-1).tone,'profit');
 const deleted=historyCardModel({...change(item(),null),count:1});
 assert.equal(deleted.caption,'القيمة عند الحذف');assert.equal(deleted.badges[0].tone,'negative');
});
test('native current-value loss stays muted while a negative change impact is red',()=>{
 const loss={...item(),expectedSalePrice:0};
 assert.equal(historyCardModel(change(null,loss)).values.at(-1).tone,'muted');
 assert.equal(historyCardModel(change(item(),loss)).changes.find(row=>row.kind==='profit').tone,'negative');
 assert.equal(historyCardModel(change(loss,item())).changes.find(row=>row.kind==='profit').tone,'profit');
});
test('legacy display preserves saved quantity, omits inferred profit and uses muted action',()=>{
 const summary=inventoryHistorySummaries([{...item(-1),historyAction:'قديم'}])[0];
 const model=historyCardModel(summary);
 assert.equal(model.values[1].value,-1);assert.equal(model.values.length,4);
 assert.deepEqual(model.badges,[{label:'قديم',tone:'muted'}]);
});
test('native tolerance hides immaterial field differences without rounding saved values',()=>{
 const before=Object.freeze(item()),after=Object.freeze({...item(),quantity:1.00001});
 const model=historyCardModel(change(before,after));
 assert.deepEqual(model.badges,[{label:'تم تأكيد الجرد',tone:'muted'}]);assert.deepEqual(model.changes,[]);
 assert.equal(after.quantity,1.00001);
});
test('text labels and badge order match native name/unit/quantity/purchase/sale sequence',()=>{
 const model=historyCardModel(change(item(),{...item(2),name:'<svg>',unit:'صندوق',purchasePrice:.2,expectedSalePrice:.4}));
 assert.deepEqual(model.badges.map(row=>row.label),['تغير الاسم','تغيرت الوحدة','تغيرت الكمية','تغير سعر الشراء','تغير سعر البيع']);
 assert.deepEqual(model.changes.slice(0,2).map(row=>[row.beforeLabel,row.afterLabel]),[['الاسم السابق','الاسم الجديد'],['الوحدة السابقة','الوحدة الجديدة']]);
 assert.equal(model.name,'<svg>');assert.ok(model.badges.every(row=>row.tone==='primary'));
});
test('history card schema is serializable and detached from raw records',()=>{
 const raw=Object.freeze(change(Object.freeze(item()),Object.freeze(item(2))));
 const before=JSON.stringify(raw),model=historyCardModel(raw);
 assert.deepEqual(JSON.parse(JSON.stringify(model)),model);
 model.badges[0].label='changed';model.changes[0].before=99;
 assert.equal(JSON.stringify(raw),before);
});
test('shared audit parser sorts offset-bearing and native stamps without changing grouping dates',()=>{
 const rows=inventoryHistorySummaries([
  change(null,item(),{itemId:'native',historyRecordedAt:'2026-10-13 10:00'}),
  change(null,item(),{itemId:'api',historyRecordedAt:'2026-10-13T08:30:00Z'}),
  change(null,item(),{itemId:'invalid',historyRecordedAt:'2026-02-30 11:00'})
 ]);
 assert.deepEqual(rows.map(row=>row.itemKey),['api','native','invalid']);
 assert.equal(rows[1].timestamp,Date.parse('2026-10-13T07:00:00Z'));assert.equal(rows[2].timestamp,0);
 assert.equal(rows[2].date,'2026-02-30');
});
test('audit history order is independent of viewer process zone',()=>{
 const module=new URL('../inventory-history.js',import.meta.url).href;
 const code=`import {inventoryHistorySummaries} from ${JSON.stringify(module)};console.log(JSON.stringify(inventoryHistorySummaries([{historyVersion:2,itemId:'a',historyRecordedAt:'2026-10-13 10:00',after:{name:'a'}}])));`;
 const results=['UTC','America/Los_Angeles','Asia/Tokyo'].map(TZ=>execFileSync(process.execPath,['--input-type=module','-e',code],{env:{...process.env,TZ},encoding:'utf8'}));
 assert.equal(results[0],results[1]);assert.equal(results[0],results[2]);
});
test('bulk daily grouping preserves first before and final after per identity',()=>{
 const source=Array.from({length:5000},(_,index)=>change(item(index),item(index+1),{itemId:String(index%500)}));
 const rows=inventoryHistorySummaries(source);
 assert.equal(rows.length,500);assert.ok(rows.every(row=>row.count===10));
 assert.equal(rows[0].before.quantity,0);assert.equal(rows[0].after.quantity,4501);
});
