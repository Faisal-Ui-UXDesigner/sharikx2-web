import test from 'node:test';import assert from 'node:assert/strict';import {debtMovementRows,customerDebtTimeline} from '../debt-details.js';
test('debt movement projection uses Android labels and newest-first dates',()=>{const rows=debtMovementRows('customers',[{id:'s',total:12,created_at:'2026-01-01T00:00:00Z',status:'paid'}],[{amount:3,paid_at:'2026-01-02T00:00:00Z'}]);assert.equal(rows[0].label,'دفعة بقيمة 3');assert.equal(rows[1].label,'مبيعة بقيمة 12');assert.equal(rows[1].status,'paid');});
test('supplier movement projection tolerates missing arrays and dates',()=>{assert.deepEqual(debtMovementRows('suppliers',null,[{amount:2}]),[{date:undefined,label:'دفعة بقيمة 2',status:''}]);});
test('customer timeline preserves invoice numbers, items, payment notes and source objects',()=>{
 const sales=[{sale_number:17,total:12.5,status:'debt',created_at:'2026-01-01',items:[{product_name:'سكر',quantity:2,line_total:12.5}]}];const before=structuredClone(sales);
 const rows=customerDebtTimeline(sales,[{amount:3,note:' دفعة أولى ',created_at:'2026-01-02'}]);
 assert.equal(rows[0].note,'دفعة أولى');assert.equal(rows[0].label,'تسديد دفعة 3');assert.equal(rows[1].label,'مبيعة #17 • 12.5');
 assert.deepEqual(rows[1].items,[{name:'سكر',quantity:2,total:12.5}]);assert.deepEqual(sales,before);
});
test('customer timeline handles missing optional fields and stable date ties',()=>{
 const rows=customerDebtTimeline([null,{sale_number:1,created_at:'2026-01-01'},{sale_number:2,created_at:'2026-01-01',items:[null]}]);
 assert.match(rows[0].label,/#1/);assert.match(rows[1].label,/#2/);assert.deepEqual(rows[0].items,[]);
});
test('customer timeline rejects malformed source collections',()=>{
 assert.throws(()=>customerDebtTimeline(null,[]));assert.throws(()=>customerDebtTimeline([],{}));
});
