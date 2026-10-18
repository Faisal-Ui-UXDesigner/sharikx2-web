import test from 'node:test';
import assert from 'node:assert/strict';
import {salePaymentAccounts,salePaymentAccountsMarkup} from '../sale-payment-ui.js';
const accounts=Array.from({length:6},(_,i)=>({id:`a${i}`,name:`حساب ${i}`,balance:-100}));
test('payment follows native first four in source order and selects the first regardless of balance',()=>{
 const cards=salePaymentAccounts(accounts);assert.deepEqual(cards.map(row=>row.id),['a0','a1','a2','a3']);assert.deepEqual(cards.map(row=>row.selected),[true,false,false,false]);
});
test('payment preserves an explicit saved later account without silently choosing the first',()=>{
 const cards=salePaymentAccounts(accounts,'a5');assert.deepEqual(cards.map(row=>row.id),['a0','a1','a2','a3','a5']);assert.equal(cards.filter(row=>row.selected)[0].id,'a5');
});
test('missing or explicitly empty restored selection needs a real choice, not a substituted account',()=>{
 for(const id of [null,'','missing'])assert.ok(salePaymentAccounts(accounts,id).every(row=>!row.selected));assert.deepEqual(salePaymentAccounts([]),[]);
});
test('payment snapshots are detached, minimal, frozen and do not mutate financial source records',()=>{
 const source=structuredClone(accounts),before=structuredClone(source),cards=salePaymentAccounts(source);assert.ok(Object.isFrozen(cards));assert.ok(cards.every(Object.isFrozen));assert.deepEqual(Object.keys(cards[0]),['id','name','selected']);source[0].name='changed';assert.equal(cards[0].name,'حساب 0');source[0].name=before[0].name;assert.deepEqual(source,before);
});
test('payment fails closed for malformed or ambiguous account identities, even outside the first four',()=>{
 for(const value of [null,{},[{id:''}],[{id:2}],[{id:'x'},{id:'x'}],[...accounts,{id:'a0'}]])assert.throws(()=>salePaymentAccounts(value));
});
test('account labels and identities are escaped without truncating their source values',()=>{
 const html=salePaymentAccountsMarkup([{id:'"<svg>',name:'<img src=x>'}]);assert.ok(html.includes('&lt;img src=x&gt;'));assert.ok(html.includes('&quot;&lt;svg&gt;'));assert.ok(!html.includes('<img'));assert.match(html,/required checked/);
});
test('no-account presentation explains debt path and never invents a payment method',()=>{
 const html=salePaymentAccountsMarkup([]);assert.match(html,/لا توجد حسابات/);assert.match(html,/كدين/);assert.ok(!html.includes('type="radio"'));
});
