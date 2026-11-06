import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerHistoryCards,ownerHistorySelection,loadOwnerHistory,loadOwnerSaleDetails,loadOwnerPurchaseDetails} from '../owner-operation-history.js';
import {historyFixture,projectId} from './owner-history-fixture.mjs';

test('new-model history merges three sources with stable identities and stored amount signs',()=>{
 const source=historyFixture(),before=JSON.stringify(source),cards=ownerHistoryCards(source,projectId);
 assert.equal(cards.length,27);assert.equal(cards[0].kind,'purchases');assert.equal(cards[0].amount,0.13);
 assert.equal(cards[1].amount,-1.25);assert.equal(cards.filter(c=>c.kind==='sales').every(c=>c.amount===5.01),true);
 assert.equal(Object.isFrozen(cards[0]),true);assert.equal(JSON.stringify(source),before);
});
test('history search reaches older records, invoices and expense descriptions, independently of paging',()=>{
 const cards=ownerHistoryCards(historyFixture(),projectId);
 assert.equal(ownerHistorySelection(cards).rows.length,20);assert.equal(ownerHistorySelection(cards).remaining,7);
 assert.equal(ownerHistorySelection(cards,{query:' 0599999999 '}).rows[0].id,'sale-24');
 assert.equal(ownerHistorySelection(cards,{query:'77'}).rows[0].kind,'purchases');
 assert.equal(ownerHistorySelection(cards,{query:'كهرباء'}).rows[0].kind,'expenses');
 assert.equal(ownerHistorySelection(cards,{day:'2026-11-06'}).remaining,6);
 assert.equal(ownerHistorySelection(cards,{day:'2026-11-06',query:'0599999999'}).rows.length,1);
});
test('full history dates sales by completion while inline cashier retains its native creation date',()=>{
 const source=historyFixture();source.sales[0].completed_at='2026-11-05T10:00:00Z';
 assert.equal(ownerHistoryCards(source,projectId).find(row=>row.id==='sale-0').day,'2026-11-05');
 assert.equal(ownerHistoryCards(source,projectId,{completionDates:false}).find(row=>row.id==='sale-0').day,'2026-11-06');
});
test('foreign/partial/duplicate data fails closed, internal phone IDs are hidden, drafts excluded',()=>{
 const source=historyFixture();source.sales[0].customer.phone='manual-private-id';source.purchases.push({...source.purchases[0],id:'draft',status:'draft'});
 assert.equal(ownerHistoryCards(source,projectId).some(c=>c.search.includes('manual-private-id')),false);
 assert.equal(ownerHistoryCards(source,projectId).some(c=>c.id==='draft'),false);
 source.sales.push(source.sales[0]);assert.throws(()=>ownerHistoryCards(source,projectId));source.sales.pop();
 source.sales[0].project_id='foreign';assert.throws(()=>ownerHistoryCards(source,projectId));
 assert.throws(()=>ownerHistoryCards({sales:[],expenses:null},projectId));
});
test('loader requests all scoped pages through existing gateway, rejects failed source without partial display',async()=>{
 const source=historyFixture(),calls=[];
 const api={allRows:async(table,id,select)=>{calls.push({table,id,select});return source[table];}};
 const result=await loadOwnerHistory(api,projectId);assert.equal(result.cards.length,27);assert.equal(calls.length,3);assert.ok(calls.every(c=>c.id===projectId));
 assert.equal(Object.isFrozen(result.records.get('expenses:expense')),true);
 api.allRows=async table=>{if(table==='purchases')throw Error('failed');return source[table];};await assert.rejects(loadOwnerHistory(api,projectId),/failed/);
 assert.equal((await loadOwnerHistory(api,projectId,{purchases:false})).cards.length,26);
});
test('sale details keep saved line/refund values and original receipt payments, not a new allocation',async()=>{
 const source=historyFixture(),before=JSON.stringify(source),calls=[];
 const model=await loadOwnerSaleDetails({sale:async()=>source.detail,allRows:async(...args)=>{calls.push(args);return source.payments;}},projectId,'sale-0');
 assert.equal(model.view.items[0].quantity,1.005);assert.equal(model.view.items[0].total,1.01);assert.equal(model.view.returns[0].total,.5);assert.equal(model.payments[0].amount,'3.51');
 assert.deepEqual(calls[0][3],{reference_type:'eq.sale',reference_id:'eq.sale-0',direction:'eq.in'});
 assert.equal(JSON.stringify(source),before);assert.equal(Object.isFrozen(model.payments),true);
 source.payments[0].reference_id='other';await assert.rejects(loadOwnerSaleDetails({sale:async()=>source.detail,allRows:async()=>source.payments},projectId,'sale-0'));
});
test('purchase details preserve historical fractional cost/quantity and label current product names',async()=>{
 const source=historyFixture(),before=JSON.stringify(source),calls=[];
 const api={rows:async(...args)=>{calls.push(args);return source.purchases;}};
 const model=await loadOwnerPurchaseDetails(api,projectId,'purchase');
 assert.equal(model.items[0].cost,'1.0050');assert.equal(model.items[0].quantity,'0.125');assert.equal(model.items[0].total,'0.13');assert.equal(model.items[0].currentName,true);assert.equal(model.debt,'0.03');
 assert.deepEqual(calls[0][4],{id:'eq.purchase'});assert.equal(JSON.stringify(source),before);
 source.purchases[0].items[0].purchase_id='foreign';await assert.rejects(loadOwnerPurchaseDetails(api,projectId,'purchase'));
});
