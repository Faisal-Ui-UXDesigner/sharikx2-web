import test from 'node:test';
import assert from 'node:assert/strict';
import {capturePurchaseDebtReview} from '../purchase-debt-review.js';
import {purchaseDebtReviewMarkup,openPurchaseDebtConfirmation} from '../purchase-debt-review-ui.js';
import {purchasePayload} from '../purchase-model.js';
import {setCurrency} from '../ui.js';

const source=()=>purchasePayload('pr','s',[{product_id:'p',quantity:1,cost:1.005}],[{account_id:'a',amount:.3}],'  <script>ملاحظة</script>  ');
test('debt review captures canonical per-line total and effective payment without mutating or freezing source',()=>{
 const payload=source(),before=JSON.stringify(payload),review=capturePurchaseDebtReview(payload,'pr');
 assert.deepEqual(review.amounts,{total:1.01,serverTotal:1.01,paid:.3,debt:.71});assert.deepEqual(review.payload,payload);
 assert.notEqual(review.payload,payload);assert.notEqual(review.payload.p_items[0],payload.p_items[0]);assert.notEqual(review.payload.p_payments[0],payload.p_payments[0]);
 assert.equal(JSON.stringify(payload),before);assert.equal(Object.isFrozen(payload),false);assert.equal(Object.isFrozen(payload.p_items[0]),false);
 for(const row of [review,review.amounts,review.payload,review.payload.p_items,review.payload.p_payments,...review.payload.p_items,...review.payload.p_payments])assert.ok(Object.isFrozen(row));
 payload.p_items[0].unit_cost=99;payload.p_payments[0].amount=99;payload.p_note='changed';
 assert.equal(review.payload.p_items[0].unit_cost,1.005);assert.equal(review.payload.p_payments[0].amount,.3);assert.equal(review.payload.p_note,'  <script>ملاحظة</script>  ');
});
test('debt review keeps duplicate purchase lines and source payment order, but no arbitrary request metadata',()=>{
 const payload=purchasePayload('pr','s',[{product_id:'p',quantity:1,cost:.005},{product_id:'p',quantity:1,cost:.005}],[{account_id:'b',amount:.001},{account_id:'a',amount:.002}]);payload.requested=99;
 const review=capturePurchaseDebtReview(payload,'pr');assert.equal(review.amounts.total,.02);assert.equal(review.amounts.paid,.003);assert.equal(review.amounts.debt,.017);
 assert.deepEqual(review.payload.p_payments.map(row=>row.account_id),['b','a']);assert.equal(review.payload.p_items.length,2);assert.ok(!('requested' in review.payload));
});
test('review requires actual debt above the native exact threshold, not the formatted cent value',()=>{
 const payload=source();payload.p_items[0].unit_cost=1;
 for(const paid of [1,.991,.999,1.01]){payload.p_payments[0].amount=paid;assert.throws(()=>capturePurchaseDebtReview(payload,'pr'));}
 payload.p_payments[0].amount=.990999;assert.equal(capturePurchaseDebtReview(payload,'pr').amounts.debt,.009001);
 payload.p_payments=[];assert.equal(capturePurchaseDebtReview(payload,'pr').amounts.debt,1);
});
test('review rejects incomplete foreign scope and malformed identities or financial rows',()=>{
 for(const patch of [{p_project_id:'other'},{p_supplier_id:''},{p_supplier_id:7},{p_items:null},{p_items:[]},{p_items:[null]},{p_items:[{product_id:{},quantity_pieces:1,unit_cost:1}]},{p_payments:null},{p_payments:[null]},{p_payments:[{account_id:7,amount:1}]},{p_payments:[{account_id:'a',amount:-1}]},{p_note:{}},{p_invoice_number:5}])assert.throws(()=>capturePurchaseDebtReview({...source(),...patch},'pr'));
 for(const value of [NaN,Infinity,-1,'1',null]){const payload=source();payload.p_items[0].unit_cost=value;assert.throws(()=>capturePurchaseDebtReview(payload,'pr'));}
 const duplicate=source();duplicate.p_payments.push({...duplicate.p_payments[0]});assert.throws(()=>capturePurchaseDebtReview(duplicate,'pr'));
 assert.throws(()=>capturePurchaseDebtReview(source(),''));assert.throws(()=>capturePurchaseDebtReview(null,'pr'));
});
test('valid empty notes and invoice numbers are retained exactly, not trimmed or reformatted',()=>{
 const payload=source();payload.p_note='';payload.p_invoice_number='  #001  ';const review=capturePurchaseDebtReview(payload,'pr');
 assert.equal(review.payload.p_note,'');assert.equal(review.payload.p_invoice_number,'  #001  ');
});
test('native confirmation markup shows all three captured amounts and explicit consent without personal source HTML',()=>{
 const payload=source();payload.p_supplier_id='<img src=x>';payload.p_payments[0].account_id='a"<svg>';const review=capturePurchaseDebtReview(payload,'pr'),before=JSON.stringify(review);
 setCurrency('ILS');const html=purchaseDebtReviewMarkup(review);
 assert.match(html,/تسجيل الباقي ديناً للمورد؟/);assert.match(html,/data-purchase-review-total>1\.01 /);assert.match(html,/data-purchase-review-paid>0\.3 /);assert.match(html,/data-purchase-review-debt>0\.71 /);
 assert.match(html,/نعم، سجّل الدين/);assert.match(html,/رجوع للتعديل/);assert.match(html,/هل تريد اعتماد الفاتورة وإضافة الباقي إلى ديون المورد؟/);
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('<svg'));assert.equal(JSON.stringify(review),before);
 assert.throws(()=>purchaseDebtReviewMarkup({amounts:review.amounts,payload:review.payload}));assert.throws(()=>purchaseDebtReviewMarkup(null));
});
test('review formatting uses selected currency without changing captured arithmetic or payment data',()=>{
 const review=capturePurchaseDebtReview(source(),'pr'),before=JSON.stringify(review);
 try{setCurrency('JOD');assert.match(purchaseDebtReviewMarkup(review),/د.أ/);setCurrency('USD');assert.match(purchaseDebtReviewMarkup(review),/ USD/);assert.equal(JSON.stringify(review),before);}finally{setCurrency('ILS');}
});
test('viewer cannot create confirmation or inspect DOM before authorization',()=>{
 assert.throws(()=>openPurchaseDebtConfirmation({mode:'viewer'}),/للمشاهدة/);
});
