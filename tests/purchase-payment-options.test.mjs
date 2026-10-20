import test from 'node:test';
import assert from 'node:assert/strict';
import {createPurchasePaymentAccounts,purchaseAccountPaymentView,purchaseFullInvoicePlan} from '../purchase-payment-options.js';
import {purchasePaymentsMarkup} from '../purchase-payment-options-ui.js';

test('payment accounts preserve source order and signed fractional balances in frozen detached records',()=>{
 const source=[{id:'b',name:'بنك',balance:'0.3'},{id:'a',name:'نقد',balance:-1.005}];
 const catalog=createPurchasePaymentAccounts(source,'pr');source[0].balance=99;source[0].name='changed';
 assert.deepEqual(catalog.accounts.map(row=>row.id),['b','a']);assert.equal(catalog.get('b').balance,.3);assert.equal(catalog.get('a').balance,-1.005);
 assert.ok(Object.isFrozen(catalog));assert.ok(Object.isFrozen(catalog.accounts));assert.ok(Object.isFrozen(catalog.get('b')));assert.equal(catalog.get('unknown'),undefined);
});
test('payment catalogs reject malformed duplicate inactive foreign or nonnumeric accounts',()=>{
 for(const rows of [null,[null],[{id:'a',balance:null}],[{id:'a',balance:''}],[{id:'a',balance:Infinity}],[{id:'a',balance:true}],[{id:'',balance:1}],[{id:'a',balance:1},{id:'a',balance:2}],[{id:'a',balance:1,active:false}],[{id:'a',balance:1,project_id:'other'}]])assert.throws(()=>createPurchasePaymentAccounts(rows,'pr'));
 assert.throws(()=>createPurchasePaymentAccounts([],''));assert.deepEqual(createPurchasePaymentAccounts([],'pr').accounts,[]);
});
test('account remaining preview subtracts canonical decimals without binary residuals or clamping',()=>{
 const view=purchaseAccountPaymentView({balance:.3},.1);assert.deepEqual(view,{balance:.3,payment:.1,remaining:.2,exceeds:false});assert.ok(Object.isFrozen(view));
 assert.equal(purchaseAccountPaymentView({balance:1.005},.005).remaining,1);
 assert.deepEqual(purchaseAccountPaymentView({balance:.3},.4),{balance:.3,payment:.4,remaining:-.1,exceeds:true});
 assert.equal(purchaseAccountPaymentView({balance:-1.005},0).remaining,-1.005);
});
test('account previews reject invalid manual amounts instead of displaying invented balances',()=>{
 for(const value of ['',null,undefined,NaN,Infinity,true,-.1])assert.throws(()=>purchaseAccountPaymentView({balance:1},value));assert.throws(()=>purchaseAccountPaymentView(undefined,1));
});
test('full payment uses existing per-line HALF_UP invoice total and frozen single account allocation',()=>{
 const items=[{quantity:1,cost:.005},{quantity:1,cost:.005}],before=JSON.stringify(items),account={id:'cash',balance:1};
 const plan=purchaseFullInvoicePlan(items,account);assert.deepEqual(plan,{requested:.02,payment:{account_id:'cash',amount:.02}});assert.ok(Object.isFrozen(plan));assert.ok(Object.isFrozen(plan.payment));assert.equal(JSON.stringify(items),before);assert.equal(account.balance,1);
 assert.equal(purchaseFullInvoicePlan([{quantity:1,cost:1.005}],{id:'a',balance:1.01}).payment.amount,1.01);
});
test('full payment rejects empty zero malformed and insufficient invoices beyond native tolerance',()=>{
 for(const items of [[],[{quantity:1,cost:0}],[{quantity:0,cost:1}],[{quantity:1,cost:NaN}]])assert.throws(()=>purchaseFullInvoicePlan(items,{id:'a',balance:10}));
 assert.throws(()=>purchaseFullInvoicePlan([{quantity:1,cost:.3}],{id:'a',balance:.2909}),/لا يكفي/);
 assert.throws(()=>purchaseFullInvoicePlan([{quantity:1,cost:.01}],{id:'a',balance:-1}),/لا يكفي/);assert.throws(()=>purchaseFullInvoicePlan([{quantity:1,cost:1}],undefined));
});
test('full payment is independent from previous split rows and does not add old amounts',()=>{
 const prior=[{account_id:'b',amount:.1},{account_id:'c',amount:.2}],before=JSON.stringify(prior);
 const replacement=purchaseFullInvoicePlan([{quantity:1,cost:.3}],{id:'a',balance:.3});assert.equal(replacement.payment.amount,.3);assert.equal(JSON.stringify(prior),before);
});
test('payment markup escapes account names identities and values without changing original records',()=>{
 const accounts=[{id:'a"<>',name:'<img src=x>',balance:.3}],payments=[{account_id:'a"<>',amount:.1}],before=JSON.stringify({accounts,payments});
 const html=purchasePaymentsMarkup(payments,accounts);assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);assert.match(html,/data-purchase-balance-after="0"/);assert.match(html,/value="0.1"/);assert.equal(JSON.stringify({accounts,payments}),before);
});
