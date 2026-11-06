import test from 'node:test';
import assert from 'node:assert/strict';
import {approvalDetails,approvalPartnerName,ownerApprovalHistory,ownerApprovalText,approvalNumber} from '../owner-approval-history.js';
import {ownerApprovalWorkbook} from '../owner-approval-workbook.js';
import {projectId,approvalFixture,ownerState} from './owner-approval-fixture.mjs';

test('saved approval uses saved names, then unique opening evidence, never current names',()=>{
 const state=ownerState(),before=JSON.stringify(state),details=ownerApprovalHistory(state,projectId)[0];
 assert.equal(details.partners[0].name,'الاسم وقت الاعتماد');
 state.finance_events[0].snapshot.result.partners[0].name='الاسم المسجل في النتيجة';
 assert.equal(ownerApprovalHistory(state,projectId)[0].partners[0].name,'الاسم المسجل في النتيجة');
 delete state.finance_events[0].snapshot.result.partners[0].name;delete state.finance_events[0].snapshot.partner_names;
 assert.equal(ownerApprovalHistory(state,projectId)[0].partners[0].name,'اسم البداية · اسم البداية');
 state.locked_snapshot.partners.push({id:'p',name:'اسم متعارض'});
 assert.match(ownerApprovalHistory(state,projectId)[0].partners[0].name,/الاسم غير محفوظ/);
 assert.equal(details.partners[0].values[0].amount,'1013.00');assert.equal(Object.isFrozen(details.event.snapshot.result.partners),true);
 assert.equal(JSON.stringify(ownerState()),before);
});
test('history distinguishes missing source, empty history, foreign records, duplicates and malformed receipts',()=>{
 const state=ownerState();delete state.finance_events;assert.throws(()=>ownerApprovalHistory(state,projectId),/غير متاح/);
 state.finance_events=[];assert.deepEqual(ownerApprovalHistory(state,projectId),[]);
 state.finance_events=[approvalFixture()];assert.throws(()=>ownerApprovalHistory(state,'other'),/لا يخص/);
 state.finance_events[0].project_id='other';assert.throws(()=>ownerApprovalHistory(state,projectId),/محلًا آخر/);
 state.finance_events=[approvalFixture(),approvalFixture()];assert.throws(()=>ownerApprovalHistory(state,projectId),/تكرر/);
 const invalid=approvalFixture();invalid.snapshot.result.partners[0].capital='NaN';assert.throws(()=>approvalDetails(invalid));
});
test('approval text uses unchanged receipt values and precision without recalculating current balances',()=>{
 const details=approvalDetails(approvalFixture()),text=ownerApprovalText(details,'₪');
 assert.match(text,/رأس المال: 1013\.00 ₪/);assert.match(text,/2026-11-06T12:00:00.123456Z/);
 assert.equal(approvalNumber('1.005e-4'),'0.0001005');assert.equal(approvalNumber('-1.250e3'),'-1250');
 assert.throws(()=>approvalNumber(Infinity));assert.throws(()=>approvalNumber('1e9999'));
});
test('native workbook has eighteen sheets, typed text barcodes, original split payments and precise numbers',()=>{
 const event=approvalFixture(),before=JSON.stringify(event),file=ownerApprovalWorkbook(event,{projectId,currency:'₪'});
 assert.equal(file.sheetNames.length,18);assert.equal(file.type,'application/vnd.ms-excel');assert.match(file.filename,/\.xls$/);
 assert.ok(file.sheetNames.includes('مدفوعات المبيعات'));assert.ok(file.sheetNames.includes('مصدر الحسابات'));
 assert.match(file.content,/<Data ss:Type="String">00123<\/Data>/);assert.match(file.content,/<Data ss:Type="Number">1.0050<\/Data>/);
 assert.match(file.content,/صنف &amp; &lt;آمن&gt;/);assert.match(file.content,/غير محفوظ/);assert.equal(JSON.stringify(event),before);
});
test('legacy approval exports only four honest sheets, never invented operational rows or zero placeholders',()=>{
 const event=approvalFixture({operational:false});delete event.snapshot.result.partners[0].reserved_profit;
 const file=ownerApprovalWorkbook(event,{projectId,currency:'₪'});
 assert.deepEqual(file.sheetNames,['ملخص الاعتماد','أرصدة الشركاء','لقطة الخادم','اكتمال البيانات']);
 assert.match(file.content,/لا نستبدلها بالأرصدة الحالية/);
 assert.equal(approvalDetails(event).partners[0].values.some(row=>row.key==='reserved_profit'),false);
});
test('workbook refuses foreign or cutoff-mismatched export source, missing arrays and invalid amounts',()=>{
 for(const alter of [e=>e.snapshot.export_data.project_id='other',e=>e.snapshot.export_data.state.project_id='other',e=>e.snapshot.export_data.cutoff_at='2026-11-05T12:00:00Z',e=>delete e.snapshot.export_data.sales,e=>e.snapshot.export_data.sales[0].total='=SUM(A1)']){
  const event=approvalFixture();alter(event);assert.throws(()=>ownerApprovalWorkbook(event,{projectId,currency:'₪'}));
 }
});
test('workbook keeps dangerous text typed as String and captures optional writeoff/action sheets without mutation',()=>{
 const event=approvalFixture();event.snapshot.export_data.state.stock.products[0].product.name='=1+1\u0001';
 event.snapshot.debt_writeoffs=[{amount:'0.01',reason:'<script>&'}];event.snapshot.debt_actions=[];
 const file=ownerApprovalWorkbook(event,{projectId,currency:'₪'});
 assert.equal(file.sheetNames.length,20);assert.match(file.content,/<Data ss:Type="String">=1\+1�<\/Data>/);
 assert.doesNotMatch(file.content,/ss:Formula=/);assert.match(file.content,/&lt;script&gt;&amp;/);
});
