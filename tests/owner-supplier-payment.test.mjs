import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerSupplierPayment} from '../owner-supplier-payment.js';
import {supplierHistoryFixture} from './supplier-history-fixtures.mjs';
import {supplierHistoryView} from '../supplier-history.js';
import {supplierAccountMarkup} from '../supplier-account-page-ui.js';
const person={id:'supplier',project_id:'project',name:'المورد',calculated_debt:'0.30'},accounts=[{id:'cash',name:'كاش',opening_balance:'0.30',movement_net:'-0.20'},{id:'bank',name:'بنك',opening_balance:'1.00',movement_net:'0'}];
test('owner supplier payment review sums split decimal sources exactly and keeps the bridge payload',()=>{
 const before=JSON.stringify(accounts),review=ownerSupplierPayment(person,[{account_id:'cash',amount:'٠٫١٠'},{account_id:'bank',amount:'0.20'}],accounts,'project',' ملاحظة ');
 assert.equal(review.amount,.3);assert.equal(review.remaining,0);assert.equal(review.sources[0].remaining,0);assert.equal(review.sources[1].remaining,.8);assert.deepEqual(review.payload,{supplier_id:'supplier',sources:[{account_id:'cash',amount:.1},{account_id:'bank',amount:.2}],note:'ملاحظة'});assert.equal(JSON.stringify(accounts),before);assert.ok(Object.isFrozen(review.payload));assert.ok(Object.isFrozen(review.payload.sources));
});
test('payment rejects excess debt/balance, duplicates, missing or foreign identities, malformed money and empty sources',()=>{
 for(const source of [[],[{account_id:'cash',amount:'0.11'}],[{account_id:'bank',amount:'0.31'}],[{account_id:'bank',amount:'0.001'}],[{account_id:'bank',amount:'bad'}],[{account_id:'missing',amount:'0.10'}],[{account_id:'bank',amount:'0'}],[{account_id:'bank',amount:'0.1'},{account_id:'bank',amount:'0.1'}]])assert.throws(()=>ownerSupplierPayment(person,source,accounts,'project'));
 assert.throws(()=>ownerSupplierPayment({...person,project_id:'foreign'},[{account_id:'bank',amount:'0.1'}],accounts,'project'));
 assert.throws(()=>ownerSupplierPayment({...person,calculated_debt:null},[{account_id:'bank',amount:'0.1'}],accounts,'project'));
 assert.throws(()=>ownerSupplierPayment(person,[{account_id:'bank',amount:'0.1'}],[{id:'bank',opening_balance:1}],'project'));
});
test('owner supplier details display exact cents on the existing allocation snapshot without changing it',()=>{
 const source=supplierHistoryFixture(),before=JSON.stringify(source),view=supplierHistoryView(source,'pr','s');
 const markup=supplierAccountMarkup(view,{precise:true});assert.match(markup,/3\.69/);assert.match(markup,/100\.37/);assert.match(markup,/104\.01/);assert.equal(JSON.stringify(source),before);
});
