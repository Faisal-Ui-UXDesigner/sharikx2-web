import test from 'node:test';
import assert from 'node:assert/strict';
import {supplierHistoryFixture} from './supplier-history-fixtures.mjs';
import {supplierHistoryView} from '../supplier-history.js';
import {supplierAccountMarkup} from '../supplier-account-page-ui.js';
import {supplierInvoiceDetailsMarkup} from '../supplier-invoice-details-ui.js';
const view=source=>supplierHistoryView(source,'pr','s');
const invoice=(value,number='104')=>value.rows.find(row=>row.number===number).invoice;

test('stored links preserve exact cents and separate discount from paid cash and credit',()=>{
 const value=view(supplierHistoryFixture()),a=invoice(value);
 assert.equal(value.identity.debt,15);assert.equal(value.identity.credit,.4);
 assert.equal(a.remaining,3.69);assert.equal(a.paid,100.37);assert.equal(a.discount,.2);assert.equal(a.creditUsed,.25);
 assert.equal(a.laterPayments.length,1);assert.equal(a.laterPayments[0].amount,.11);assert.deepEqual(a.laterPayments[0].accounts,['نقد','بنك']);
 assert.equal(invoice(value,'7').remaining,6.8);assert.equal(value.rows.find(row=>row.kind==='old_debt').remaining,4.61);
});
test('immutable detached nested invoice items sources and associations never annotate input',()=>{
 const source=supplierHistoryFixture(),before=JSON.stringify(source),value=view(source),a=invoice(value);
 assert.equal(JSON.stringify(source),before);source.purchases[0].items[0].product.name='changed';source.payments[0].sources[0].account.name='changed';
 assert.equal(a.items[0].name,'بسكويت <img src=x>');assert.equal(a.laterPayments[0].accounts[0],'نقد');
 for(const object of [value,value.rows,value.identity,a,a.items,a.items[0],a.initialSources,a.initialSources[0],a.laterPayments[0].accounts])assert.ok(Object.isFrozen(object));
});
test('return after payment clamps only remaining and never reallocates stored links to another invoice',()=>{
 const source=supplierHistoryFixture();source.purchases[0].debt_amount=0;source.purchases[0].total=50;source.purchases[0].status='returned';
 const value=view(source),a=invoice(value);assert.equal(a.remaining,0);assert.equal(a.initialPaid,100.01);assert.equal(a.laterPayments[0].amount,.11);assert.equal(a.discount,.2);assert.equal(invoice(value,'7').remaining,6.8);
 assert.equal(value.identity.credit,.4);assert.ok(!Object.hasOwn(a,'cashRefund'));
});
test('created return credit is historical and not current available credit',()=>{
 const value=view(supplierHistoryFixture()),b=invoice(value,'7');assert.equal(b.returnedTotal,3);assert.equal(b.returnCreditCreated,2);assert.equal(value.identity.credit,.4);
});
test('legacy and unallocated links stay explicit, without fabricating an invoice association',()=>{
 const payment=view(supplierHistoryFixture()).rows.find(row=>row.legacy);assert.equal(payment.unallocated,.1);assert.deepEqual(payment.allocations.map(row=>row.kind),['old_debt']);assert.equal(payment.allocations[0].amount,.4);
 assert.match(supplierAccountMarkup(view(supplierHistoryFixture())),/ليس ربطًا تاريخيًا مؤكدًا/);
});
test('snapshot validation rejects incomplete ledgers wrong version and missing or mismatched payment totals',()=>{
 const changes=[s=>s.allocation_snapshot=null,s=>s.allocation_snapshot.version=2,s=>s.allocation_snapshot.allocations.pop(),s=>s.allocation_snapshot.allocations[0].payment_id='missing',s=>s.allocation_snapshot.allocations[0].purchase_id='missing',s=>s.purchases=null,s=>s.payments=null,s=>s.old_debts=null,s=>s.credits=null,s=>s.purchase_returns=null];
 for(const change of changes){const source=supplierHistoryFixture();change(source);assert.throws(()=>view(source));}
});
test('foreign scope duplicate identities invalid target and nonlegacy excess fail closed',()=>{
 const changes=[s=>s.supplier.project_id='other',s=>s.payments[0].supplier_id='other',s=>s.allocation_snapshot.allocations[0].project_id='other',s=>s.purchases.push(s.purchases[0]),s=>s.allocation_snapshot.allocations[1].id='1',s=>s.allocation_snapshot.allocations[0].target_type='unknown',s=>s.allocation_snapshot.allocations.at(-1).legacy=false,s=>s.allocation_snapshot.allocations[0].old_debt_id='o',s=>s.purchases[0].items[0].purchase_id='b',s=>s.payments[0].payment_kind='unknown'];
 for(const change of changes){const source=supplierHistoryFixture();change(source);assert.throws(()=>view(source));}
});
test('missing malformed and negative financial values never silently become zero',()=>{
 for(const bad of [null,undefined,'',true,NaN,Infinity,-.01]){
  for(const change of [s=>s.supplier.opening_debt=bad,s=>s.purchases[0].debt_amount=bad,s=>s.purchases[0].paid_amount=bad,s=>s.purchases[0].items[0].line_total=bad,s=>s.credits[0].remaining_amount=bad,s=>s.allocation_snapshot.allocations[0].amount=bad]){const source=supplierHistoryFixture();change(source);assert.throws(()=>view(source));}
 }
});
test('allocation boundary uses native HALF_UP cents, while raw account debt remains fractional',()=>{
 const source=supplierHistoryFixture();source.payments[0].amount=.305;source.allocation_snapshot.allocations[0].amount=.105;
 const value=view(source);assert.equal(invoice(value).laterPayments[0].amount,.11);assert.equal(invoice(value).remaining,3.69);assert.equal(value.identity.debt,15.005);
});
test('opening links affect payment distribution without double counting old debt',()=>{
 const source=supplierHistoryFixture();source.allocation_snapshot.allocations[3]={id:'4',payment_id:'l',target_type:'opening',amount:.4,legacy:true};
 const value=view(source);assert.equal(value.identity.debt,15);assert.equal(value.rows.find(row=>row.kind==='old_debt').remaining,5.01);assert.equal(value.rows.find(row=>row.legacy).allocations[0].kind,'opening');
});
test('invoice detail and timeline escape all source labels and keep discount cash semantics',()=>{
 const value=view(supplierHistoryFixture()),html=supplierInvoiceDetailsMarkup(invoice(value)),timeline=supplierAccountMarkup(value);
 for(const markup of [html,timeline]){assert.ok(!markup.includes('<img'));assert.ok(!markup.includes('<script>'));}
 assert.match(html,/خصومات من الدين، وليست دفعات/);assert.match(html,/استخدام رصيد سابق/);assert.match(html,/100 ₪/);assert.match(html,/المتبقي الحالي: 4 ₪/);assert.match(timeline,/أصناف الفاتورة/);assert.match(timeline,/2\.125/);assert.match(timeline,/تخفيض للدين دون حركة نقدية/);
});
test('draft cancelled and returned invoices cannot show residual payable debt',()=>{
 for(const status of ['draft','cancelled','returned']){const source=supplierHistoryFixture();source.purchases[0].status=status;assert.equal(invoice(view(source)).remaining,0);}
});
