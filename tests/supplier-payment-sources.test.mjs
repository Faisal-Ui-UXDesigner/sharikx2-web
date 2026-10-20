import test from 'node:test';
import assert from 'node:assert/strict';
import {supplierPaymentSources,supplierSourceName} from '../supplier-payment-sources.js';
import {supplierHistoryView} from '../supplier-history.js';
import {supplierAccountMarkup} from '../supplier-account-page-ui.js';
import {supplierInvoiceDetailsMarkup} from '../supplier-invoice-details-ui.js';
import {supplierHistoryFixture} from './supplier-history-fixtures.mjs';
const source=()=>({initialPaid:.3,creditUsed:.25,initialSources:[{name:'نقد',amount:.1},{name:'نقد',amount:.2}],laterSources:[{covered:.4,sources:[{name:'نقد',amount:.4}]}]});
test('native source order starts with credit then merges equal account names using exact decimals',()=>{
 assert.deepEqual(supplierPaymentSources(source()),[{name:'رصيد المورد',amount:.25},{name:'نقد',amount:.7}]);
 assert.equal(supplierSourceName(' نقد '),'نقد');for(const value of [null,undefined,'  ',' NuLl ',17])assert.equal(supplierSourceName(value),'حساب الدفع');
 const input=source();input.initialSources[0].name=' نقد ';assert.equal(supplierPaymentSources(input)[1].amount,.7);
});
test('mixed partial invoice share names accounts together rather than inventing per-account allocation',()=>{
 const input=source();input.initialPaid=0;input.creditUsed=0;input.laterSources=[{covered:.11,sources:[{name:'نقد',amount:.1},{name:'بنك',amount:.21},{name:'نقد',amount:.2},{name:'غير مستخدم',amount:0}]}];
 assert.deepEqual(supplierPaymentSources(input),[{name:'نقد / بنك',amount:.11}]);
});
test('empty or zero source totals keep the recorded amount under the native fallback name',()=>{
 for(const list of [[],[{amount:0,name:'نقد'}]])assert.deepEqual(supplierPaymentSources({initialPaid:7.125,creditUsed:0,initialSources:list,laterSources:[]}),[{name:'دفعات مسجلة',amount:7.125}]);
});
test('native zero threshold affects captions only and does not invent a source',()=>{
 const input=source();input.initialPaid=.009;input.creditUsed=.009;input.laterSources=[];assert.deepEqual(supplierPaymentSources(input),[]);
 input.initialPaid=.01;input.initialSources=[{name:'نقد',amount:.01}];assert.equal(supplierPaymentSources(input)[0].amount,.01);
});
test('source coverage tolerance is strictly less than half a cent, without binary cancellation drift',()=>{
 const input={initialPaid:1,creditUsed:0,initialSources:[{name:'نقد',amount:.5},{name:'بنك',amount:.495}],laterSources:[]};
 assert.deepEqual(supplierPaymentSources(input),[{name:'نقد / بنك',amount:1}]);input.initialSources[1].amount=.496;
 assert.deepEqual(supplierPaymentSources(input),[{name:'نقد',amount:.5},{name:'بنك',amount:.496}]);
});
test('frozen source rows detach from mutable records without modifying the source',()=>{
 const input=source(),before=JSON.stringify(input),result=supplierPaymentSources(input);assert.equal(JSON.stringify(input),before);input.initialSources[0].name='changed';assert.equal(result[1].name,'نقد');assert.ok(Object.isFrozen(result));assert.ok(result.every(Object.isFrozen));
});
test('invalid financial inputs or incomplete source lists fail instead of silently showing zero',()=>{
 for(const bad of [null,undefined,'',true,Infinity,NaN,-1]){const input=source();input.initialPaid=bad;assert.throws(()=>supplierPaymentSources(input));}
 for(const change of [s=>s.initialSources=null,s=>s.laterSources=null,s=>s.laterSources[0].covered=null,s=>s.initialSources[0].amount=null]){const input=source();change(input);assert.throws(()=>supplierPaymentSources(input));}
});
test('history captions exclude discounts, preserve raw values and keep fractional account labels grouped',()=>{
 const view=supplierHistoryView(supplierHistoryFixture(),'pr','s'),invoice=view.rows.find(row=>row.number==='104').invoice;
 assert.deepEqual(invoice.sources,[{name:'رصيد المورد',amount:.25},{name:'البنك <script>',amount:100.01},{name:'نقد / بنك',amount:.11}]);assert.equal(invoice.paid,100.37);assert.equal(invoice.remaining,3.69);assert.equal(invoice.discount,.2);
 const markup=supplierAccountMarkup(view),details=supplierInvoiceDetailsMarkup(invoice);
 assert.match(markup,/البنك &lt;script&gt; 100 ₪/);assert.ok(!markup.includes('100.37'));assert.ok(!details.includes('3.69'));assert.match(details,/المتبقي الحالي: 4 ₪/);assert.match(details,/100 ₪/);assert.match(markup,/2\.125/);
});
