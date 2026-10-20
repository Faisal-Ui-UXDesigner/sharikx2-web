import test from 'node:test';
import assert from 'node:assert/strict';
import {supplierAccountView} from '../supplier-account-view.js';
import {supplierAccountMarkup,supplierAccountShell} from '../supplier-account-page-ui.js';

const input=()=>({projectId:'pr',person:{id:'s',name:'مورد',phone:'0591111111',calculated_debt:7.125},creditAvailable:.375,
 purchases:[{id:'i',project_id:'pr',supplier_id:'s',total:'104.005',paid_amount:100.005,created_at:'2026-10-15T08:00:00Z'}],
 payments:[{id:'p',supplier_id:'s',amount:.125,created_at:'2026-10-15T09:00:00Z',paid_at:'2026-10-16T08:00:00Z',note:'دفعة'}],
 oldDebts:[{amount:2.005,description:'قديم',created_at:'2026-10-14T08:00:00Z'}]});
test('supplier display retains authoritative debt credit and fractional recorded values without debt reconstruction',()=>{
 const source=input(),before=JSON.stringify(source),view=supplierAccountView(source);
 assert.equal(view.identity.debt,7.125);assert.equal(view.identity.credit,.375);assert.equal(view.rows[1].amount,104.005);assert.equal(view.rows[1].initialPaid,100.005);assert.equal(view.rows[0].amount,.125);assert.equal(JSON.stringify(source),before);
 assert.ok(Object.isFrozen(view));assert.ok(Object.isFrozen(view.identity));assert.ok(Object.isFrozen(view.rows));assert.ok(Object.isFrozen(view.rows[0]));
});
test('supplier timeline uses paid-at precedence newest first and preserves stable equal dates',()=>{
 const source=input();source.oldDebts[0].created_at=source.payments[0].paid_at;const view=supplierAccountView(source);
 assert.deepEqual(view.rows.map(row=>row.kind),['payment','old_debt','purchase']);assert.equal(view.rows[0].date,'2026-10-16T08:00:00Z');
 source.payments[0].note='changed';assert.equal(view.rows[0].note,'دفعة');
});
test('invalid or absent monetary source fails instead of displaying invented zeros',()=>{
 for(const value of [null,undefined,'',NaN,Infinity,-1,true]){const source=input();source.purchases[0].total=value;assert.throws(()=>supplierAccountView(source));}
 const source=input();source.person.calculated_debt=null;assert.throws(()=>supplierAccountView(source));source.person.calculated_debt=0;source.creditAvailable=null;assert.throws(()=>supplierAccountView(source));
});
test('foreign records and incomplete ledgers fail closed while missing optional initial payment stays unknown',()=>{
 for(const field of ['purchases','payments','oldDebts']){const source=input();source[field]=null;assert.throws(()=>supplierAccountView(source));}
 for(const scope of [{supplier_id:'other'},{project_id:'other'}]){const source=input();Object.assign(source.purchases[0],scope);assert.throws(()=>supplierAccountView(source));}
 const source=input();delete source.purchases[0].paid_amount;const view=supplierAccountView(source);assert.equal(view.rows[1].initialPaid,null);assert.ok(!supplierAccountMarkup(view).includes('المدفوع عند تسجيل الفاتورة'));
});
test('nested payment account labels become detached frozen data, not mutable financial rows',()=>{
 const source=input();source.payments[0].sources=[{account:{name:'البنك'}},{account:{name:'النقد'}}];const view=supplierAccountView(source);source.payments[0].sources[0].account.name='changed';assert.deepEqual(view.rows[0].accounts,['البنك','النقد']);assert.ok(Object.isFrozen(view.rows[0].accounts));
});
test('supplier markup escapes all identity and movement metadata and labels initial payments honestly',()=>{
 const source=input();source.person.name='<img src=x>';source.purchases[0].invoice_number='<script>1</script>';source.payments[0].note='"<img>';const html=supplierAccountMarkup(supplierAccountView(source));
 assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/المدفوع عند تسجيل الفاتورة/);assert.match(html,/لا يُعاد جمعها/);assert.ok(!html.includes('المتبقي الحالي:'));
});
test('empty supplier ledger is explicit and header back cannot submit',()=>{
 const source=input();source.purchases=[];source.payments=[];source.oldDebts=[];source.person.calculated_debt=0;source.creditAvailable=0;assert.match(supplierAccountMarkup(supplierAccountView(source)),/لا توجد حركات/);
 const header=supplierAccountShell();assert.match(header,/حساب المورد/);assert.match(header,/type="button"[^>]+data-supplier-back/);assert.ok(!header.includes('type="submit"'));
});
test('a returned invoice may have original paid amount above current total without inventing debt or cash',()=>{
 const source=input();source.purchases[0].total=50;source.purchases[0].paid_amount=100;source.purchases[0].status='partially_returned';
 const view=supplierAccountView(source),invoice=view.rows.find(row=>row.kind==='purchase');assert.equal(invoice.amount,50);assert.equal(invoice.initialPaid,100);assert.equal(view.identity.debt,7.125);assert.equal(view.identity.credit,.375);assert.ok(!Object.hasOwn(invoice,'remaining'));
});
