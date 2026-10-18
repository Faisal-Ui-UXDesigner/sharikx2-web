import test from 'node:test';import assert from 'node:assert/strict';
import {purchaseFormMarkup,purchaseSummaryMarkup,mountPurchaseFooter} from '../purchase-form-ui.js';
import {purchaseCartReview} from '../purchase-cart-review.js';
test('purchase composition keeps supplier, optional payments, note and separate confirmation footer',()=>{
 const html=purchaseFormMarkup([{id:'s',name:'مورد',phone:'0590000000'}]);
 assert.match(html,/name="supplier" required/);assert.match(html,/<details[^>]+data-purchase-payments>/);assert.ok(!html.includes('data-purchase-payments open'));assert.match(html,/الدفع الآن — اختياري/);assert.match(html,/إرفاق الصورة غير متاح/);assert.ok(html.indexOf('</fieldset>')<html.indexOf('data-purchase-footer'));assert.match(html,/name="note" maxlength="500"/);
});
test('supplier source text and identities are escaped without modifying source',()=>{
 const rows=[{id:'s"<img>',name:'<script>bad</script>',phone:'"&'}],before=JSON.stringify(rows),html=purchaseFormMarkup(rows);
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img>'));assert.match(html,/&lt;script&gt;/);assert.equal(JSON.stringify(rows),before);
});
test('summary consumes existing immutable cart view with precise per-line HALF_UP totals and distinct counts',()=>{
 const items=[{product_id:'p',quantity:1,cost:.005},{product_id:'p',quantity:1,cost:.005}],view=purchaseCartReview(items,[{id:'p',name:'صنف'}]),html=purchaseSummaryMarkup(view);
 assert.ok(Object.isFrozen(view));assert.equal(view.total,.02);assert.equal(view.productCount,1);assert.equal(view.lineCount,2);assert.match(html,/الأصناف: 1 · البنود: 2/);assert.match(html,/data-total>0\.02/);assert.match(html,/purchase-count-badge[^>]+>1/);assert.equal((html.match(/data-total/g)||[]).length,1);
});
test('empty summary remains an explicit zero and a keyboard-capable review button is supplied by host',()=>{
 const html=purchaseSummaryMarkup(purchaseCartReview([],[]));assert.match(html,/الأصناف: 0/);assert.match(html,/data-total>0 /);assert.match(html,/مراجعة الأصناف/);
});
test('footer mounting keeps cancel explicitly non-submitting when moved inside the form',()=>{
 const cancel={},summary={},mounted=[];
 const footer={prepend:value=>mounted.push(value),querySelector:()=>({append:value=>mounted.push(value)})};
 mountPurchaseFooter({querySelector:selector=>selector==='[data-close]'?cancel:footer},summary);
 assert.equal(cancel.type,'button');assert.deepEqual(mounted,[summary,cancel]);
});
