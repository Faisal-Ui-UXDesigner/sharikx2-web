import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionPayload,paymentPayload,debtPaymentRemaining,validateDebtPaymentSnapshot,validateDebtPaymentJournal,verifyDebtPaymentResult,supplierPaymentReview} from '../debt-payment.js';
import {openSupplierPaymentReview} from '../supplier-payment-review.js';
import {openCollection} from '../collection.js';
import {openPayment} from '../payment.js';
const accounts=[{id:'a',balance:5},{id:'b',balance:0}];
test('collection receives into zero balance and follows Android debt tolerance',()=>{
 const payload=collectionPayload('p',{id:'c'},5.005,'b');
 validateDebtPaymentSnapshot(payload,5,accounts);
 assert.throws(()=>validateDebtPaymentSnapshot({...payload,p_amount:5.02},5,accounts),/أكبر من الدين/);
 assert.equal(debtPaymentRemaining(5,5.005),0);
});
test('supplier payment validates unique accounts and total without mutating sources',()=>{
 const sources=[{account_id:'a',amount:3.25},{account_id:'b',amount:0.005}],copy=structuredClone(sources);
 const payload=paymentPayload('p','s',sources,'note');validateDebtPaymentSnapshot(payload,4,accounts);
 assert.deepEqual(sources,copy);assert.notEqual(payload.p_sources[0],sources[0]);
 assert.throws(()=>paymentPayload('p','s',[...sources,sources[0]]));
 for(const invalid of [[],[{amount:1}],[{account_id:'a',amount:NaN}],[null]])assert.throws(()=>paymentPayload('p','s',invalid));
});
test('supplier payments reject excessive balances, unknown accounts and settled or malformed debt',()=>{
 for(const payload of [paymentPayload('p','s',[{account_id:'a',amount:6}]),paymentPayload('p','s',[{account_id:'missing',amount:1}])])assert.throws(()=>validateDebtPaymentSnapshot(payload,10,accounts));
 const payload=collectionPayload('p',{id:'c'},1,'a');for(const debt of [0.009,NaN,undefined])assert.throws(()=>validateDebtPaymentSnapshot(payload,debt,accounts));
});
test('journal scopes project and party while keeping original request payload',()=>{
 const payload=collectionPayload('p',{id:'c'},3.5,'a','original'),saved={payload,requestId:'request'};
 assert.equal(validateDebtPaymentJournal(saved,'customer','p','c'),payload);
 for(const [project,party] of [['other','c'],['p','other']])assert.throws(()=>validateDebtPaymentJournal(saved,'customer',project,party));
 assert.throws(()=>validateDebtPaymentJournal(saved,'supplier','p','c'));
 assert.throws(()=>validateDebtPaymentJournal({...saved,requestId:null},'customer','p','c'));
});
test('payment response must confirm identity and original amount',()=>{
 const payload=paymentPayload('p','s',[{account_id:'a',amount:2},{account_id:'b',amount:3}]);
 verifyDebtPaymentResult({id:'payment',amount:'5',already_confirmed:true},payload);
 for(const result of [null,{}, {id:'payment',amount:NaN},{id:'payment',amount:4}])assert.throws(()=>verifyDebtPaymentResult(result,payload));
});
test('both payment entries reject viewers and stale contexts before DOM access',()=>{
 for(const open of [openCollection,openPayment]){assert.throws(()=>open({mode:'viewer'}),/للمشاهدة/);assert.equal(open({mode:'owner',projectId:'p',customer:{id:'c'},supplier:{id:'s'},isCurrent:()=>false}),undefined);}
});
test('supplier review captures immutable sources, labels, debt and remaining balances',()=>{
 const payload=paymentPayload('p','s',[{account_id:'a',amount:2.5}],'note'),person={id:'s',name:'مورد',calculated_debt:4},rows=[{id:'a',name:'نقد',balance:5}];
 const review=supplierPaymentReview(payload,person,rows);
 payload.p_sources[0].amount=99;person.name='changed';rows[0].name='changed';
 assert.equal(review.amount,2.5);assert.equal(review.remaining,1.5);assert.equal(review.sources[0].remaining,2.5);assert.equal(review.sources[0].name,'نقد');assert.equal(review.name,'مورد');
 assert.throws(()=>review.payload.p_sources[0].amount=10,TypeError);assert.throws(()=>review.sources.push({}),TypeError);
});
test('supplier review rejects wrong party, invalid debt and unavailable sources',()=>{
 const payload=paymentPayload('p','s',[{account_id:'a',amount:2}]);
 for(const person of [{id:'other',calculated_debt:5},{id:'s',calculated_debt:1}])assert.throws(()=>supplierPaymentReview(payload,person,accounts));
 assert.throws(()=>supplierPaymentReview(payload,{id:'s',calculated_debt:5},[]));
});
test('supplier review entry is unavailable to viewers and stale screens',()=>{
 assert.throws(()=>openSupplierPaymentReview({mode:'viewer'}),/للمشاهدة/);
 assert.equal(openSupplierPaymentReview({mode:'owner',isCurrent:()=>false}),undefined);
});
