import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryHistoryScreenModel,inventoryHistorySummaries} from '../inventory-history.js';

const item={name:'سكر',unit:'علبة',quantity:.1234,purchasePrice:.1001,expectedSalePrice:.3002};
const row=(date,name='سكر')=>({date,before:null,after:{...item,name},count:1});

test('history screen preserves ordered contiguous day runs without sorting or collapsing dates',()=>{
 const source=[row('2026-10-14','a'),row('2026-10-14','b'),row('2026-10-13','c'),row('2026-10-14','d')];
 const model=inventoryHistoryScreenModel(source);
 assert.equal(model.empty,false);
 assert.deepEqual(model.sections.map(section=>section.date),['2026-10-14','2026-10-13','2026-10-14']);
 assert.deepEqual(model.sections.map(section=>section.cards.map(card=>card.name)),[['a','b'],['c'],['d']]);
});

test('history screen includes one explicit unknown-date section and preserves invalid audit labels',()=>{
 const model=inventoryHistoryScreenModel([row(''),row(''),row('2026-02-30'),row('<svg>')]);
 assert.deepEqual(model.sections.map(section=>section.label),['تاريخ غير محدد','2026-02-30','<svg>']);
 assert.equal(model.sections[0].cards.length,2);
});

test('history screen is deeply frozen, serializable and detached from mutable source arrays',()=>{
 const source=[row('2026-10-14')],before=JSON.stringify(source),model=inventoryHistoryScreenModel(source);
 for(const value of [model,model.sections,model.sections[0],model.sections[0].cards,model.sections[0].cards[0],model.sections[0].cards[0].values,model.sections[0].cards[0].values[0],model.sections[0].cards[0].badges[0]])assert.equal(Object.isFrozen(value),true);
 assert.throws(()=>{model.sections[0].cards[0].values[0].value='tampered';},TypeError);
 assert.equal(JSON.stringify(source),before);
 source[0].after.name='changed';source.length=0;
 assert.equal(model.sections[0].cards[0].name,'سكر');
 assert.deepEqual(JSON.parse(JSON.stringify(model)),model);
});

test('history screen retains precise quantity, four-place cost and unrounded profit for presentation',()=>{
 const card=inventoryHistoryScreenModel([row('2026-10-14')]).sections[0].cards[0];
 assert.equal(card.values[1].value,.1234);assert.equal(card.values[2].value,.1001);
 assert.equal(card.values.at(-1).value,.02469234);
 assert.deepEqual(card.values.map(value=>value.kind),['text','quantity','unitCost','money','money']);
});

test('history screen freezes exact change deltas without changing source or grouped counts',()=>{
 const source=[{historyVersion:2,itemId:'a',historyRecordedAt:'2026-10-14 10:00',before:{...item,quantity:.1},after:{...item,quantity:.2}},
 {historyVersion:2,itemId:'a',historyRecordedAt:'2026-10-14 11:00',before:{...item,quantity:.2},after:{...item,quantity:.3}}];
 const before=JSON.stringify(source),model=inventoryHistoryScreenModel(inventoryHistorySummaries(source));
 const card=model.sections[0].cards[0];assert.equal(card.count,2);
 assert.equal(card.changes[0].difference,.2);assert.equal(Object.isFrozen(card.changes[0]),true);
 assert.equal(JSON.stringify(source),before);
});

test('empty history screen exposes no fabricated dates or cards',()=>{
 assert.deepEqual(inventoryHistoryScreenModel(),{empty:true,sections:[]});
 assert.equal(Object.isFrozen(inventoryHistoryScreenModel().sections),true);
});
