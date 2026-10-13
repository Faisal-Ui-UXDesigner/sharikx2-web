import test from 'node:test';import assert from 'node:assert/strict';
import {prepareMonthlyApproval,validateMonthlyApproval,approvalStateAudit} from '../approval-state.js';
import {approvalPreview} from '../approval-preview.js';
import {monthlyApprovalFinancials} from '../approval-financials.js';
import {partnerProfitOffsets} from '../partner-balance.js';
const month='2026-09',options={today:'2026-10-10',approvedAt:'2026-10-10 12:01',settledAt:'2026-10-10 12:00',inventoryCost:30};
const source=()=>({revision:4,capital_posted:100,state:{partners:[{id:'a',name:'<svg>',share:80,capital:100}],approvedMonths:{},revenues:[{date:'2026-09-01',amount:50}],expenses:[{date:'2026-09-01',amount:10}],withdrawals:[{partnerId:'a',date:'2026-09-02',amount:5}],partnerDebts:[{id:'one',partnerId:'a',date:'2026-09-02',amount:10,settledAmount:2,settlements:[{month:'2026-08',amount:2,settledAt:'2026-09-01 11:00'}]},{id:'two',partnerId:'a',date:'2026-09-02',amount:10}],opaque:{keep:[1,{value:'original'}]}}});
const build=(snapshot=source(),extra={})=>prepareMonthlyApproval(snapshot,month,{...options,...extra});
test('native complete record and debt settlement stamps preserve source and existing histories',()=>{
 const snapshot=source(),before=structuredClone(snapshot),request=build(snapshot);
 assert.equal(request.record.approvedAt,options.approvedAt);assert.equal(request.record.periodEnd,'2026-10-09');
 assert.deepEqual(request.record.partnerDebtSettlements,{a:18});assert.equal(request.record.closingInventoryValue,30);
 assert.deepEqual(request.state.partnerDebts[0].settlements,[...before.state.partnerDebts[0].settlements,{month,amount:8,settledAt:options.settledAt}]);
 assert.deepEqual(request.state.partnerDebts[1].settlements,[{month,amount:10,settledAt:options.settledAt}]);
 assert.equal(request.state.partnerDebts[0].settledAmount,10);assert.deepEqual(snapshot,before);assert.equal(request.revision,4);
 assert.equal(request.state.approvedMonths[month],request.record);assert.equal(Object.hasOwn(request.state,'capital_posted'),false);
});
test('approval never posts cash, changes capital or rewrites withdrawals, original principal and opaque data',()=>{
 const snapshot=source(),request=build(snapshot);for(const key of ['partners','withdrawals','revenues','expenses','opaque'])assert.deepEqual(request.state[key],snapshot.state[key]);
 assert.deepEqual(request.state.partnerDebts.map(row=>row.amount),[10,10]);assert.equal(Object.hasOwn(request.state,'cash_movements'),false);
 assert.deepEqual(Object.keys(request.state).sort(),Object.keys(snapshot.state).sort());
});
test('saved financials reopen from captured approval rather than current inventory or live capital',()=>{
 const request=build(),saved={revision:5,state:structuredClone(request.state)};saved.state.partners[0].capital=999;
 const reopened=monthlyApprovalFinancials(saved,month,{projectAssets:999999});
 for(const key of ['projectAssets','protectedBefore','protectedAfter','distributableProfit','reinvestmentAmount','deficit'])assert.equal(reopened[key],request.record[key]);
 assert.throws(()=>build(saved),/مثبتة/);
});
test('source and nested candidate maps are deeply isolated and frozen',()=>{
 const snapshot=source(),request=build(snapshot);snapshot.state.partnerDebts[0].settlements[0].amount=99;snapshot.state.opaque.keep[1].value='changed';
 assert.equal(request.state.partnerDebts[0].settlements[0].amount,2);assert.equal(request.sourceState.opaque.keep[1].value,'original');
 for(const item of [request,request.record,request.state,request.sourceState,request.state.partnerDebts,request.state.partnerDebts[0].settlements[0],request.record.partnerShares])assert.ok(Object.isFrozen(item));
});
test('exact candidate reconstruction survives JSON restoration without regenerating timestamps',()=>{
 const request=build(),restored=JSON.parse(JSON.stringify(request));assert.deepEqual(validateMonthlyApproval(restored,source()),request);
 assert.equal(validateMonthlyApproval(restored).settledAt,options.settledAt);
});
test('tampered amounts, retained balances, timestamps, source, revision and extra fields fail reconstruction',()=>{
 const original=build();for(const change of [r=>r.state.partnerDebts[0].settledAmount++,r=>r.state.partnerDebts[0].settlements[1].amount++,r=>r.record.protectedAfter++,r=>r.state.approvedMonths[month].approvedAt='2026-10-10 13:00',r=>r.sourceState.partners[0].capital++,r=>r.revision=-1,r=>r.extra=true,r=>r.activity={partners:[]}]){
  const request=JSON.parse(JSON.stringify(original));change(request);assert.throws(()=>validateMonthlyApproval(request));
 }
});
test('fresh same-revision source changes or different revision cannot validate original candidate',()=>{
 const request=build();for(const change of [s=>s.revision++,s=>s.state.opaque.keep.push(2),s=>s.state.withdrawals[0].amount++]){const snapshot=source();change(snapshot);assert.throws(()=>validateMonthlyApproval(request,snapshot),/تغيّرت/);}
 const reordered=source();reordered.state=Object.fromEntries(Object.entries(reordered.state).reverse());assert.deepEqual(validateMonthlyApproval(request,reordered),request);
});
test('reconciled remote activity calculates approval without replacing original linked local arrays',()=>{
 const snapshot=source();snapshot.state.revenues=[{id:'cashier-remote',date:'2026-09-01',amount:999}];
 const activity={revenues:[{id:'remote',date:'2026-09-01',amount:50}],expenses:[{date:'2026-09-01',amount:10}],entries:[]};
 const request=build(snapshot,{activity}),normal=build();assert.deepEqual(request.record,normal.record);assert.deepEqual(request.state.revenues,snapshot.state.revenues);assert.deepEqual(validateMonthlyApproval(JSON.parse(JSON.stringify(request))),request);
 activity.revenues[0].amount=0;assert.equal(request.activity.revenues[0].amount,50);
});
test('activity scope cannot smuggle metadata, approval histories, withdrawals or debt mutations',()=>{
 for(const key of ['partners','approvedMonths','withdrawals','partnerDebts','inventory','__proto__'])assert.throws(()=>build(source(),{activity:JSON.parse(`{"${key}":[]}`)}),/نطاق/);
 for(const activity of [null,[],false,{revenues:[{date:'invalid',amount:1}]},{expenses:[{date:'2026-09-01',amount:null}]}])assert.throws(()=>build(source(),{activity}));
});
test('calendar timestamps require native minute precision and the actual calculation day',()=>{
 for(const approvedAt of [undefined,null,'2026-02-30 12:00','2026-10-09 12:00','2026-10-10 24:00','2026-10-10 12:60','2026-10-10T12:00:00Z','2026-10-10 12:00:01'])assert.throws(()=>build(source(),{approvedAt}),/وقت/);
 assert.throws(()=>build(source(),{settledAt:'2026-10-11 12:00'}),/وقت/);
 const request=build(source(),{settledAt:undefined});assert.equal(request.settledAt,options.approvedAt);
});
test('loss absorbs old profit AFTER settling debt and excludes newly recorded profit',()=>{
 const snapshot=source();snapshot.state.partners[0].share=100;snapshot.state.approvedMonths={'2026-08':{partnerShares:{a:40},distributableProfit:40,periodEnd:'2026-08-31'}};
 snapshot.state.revenues=[];snapshot.state.expenses=[{date:'2026-09-01',amount:10}];snapshot.state.withdrawals=[];snapshot.state.partnerDebts=[{id:'d',partnerId:'a',date:'2026-09-01',amount:10}];
 const request=build(snapshot,{inventoryCost:0});assert.deepEqual(request.record.partnerDebtSettlements,{a:10});assert.deepEqual(request.record.absorbedPartnerProfits,{a:30});assert.equal(request.record.distributableProfit,0);assert.equal(partnerProfitOffsets({state:request.state},'a').unwithdrawnProfit,0);
});
test('101 cent-level nested settlements retain exact total and do not round the saved approval',()=>{
 for(let cents=0;cents<=100;cents++){
  const snapshot=source();snapshot.state.partners[0].share=100;snapshot.state.partnerDebts=[{partnerId:'a',date:'2026-09-01',amount:cents/100}];snapshot.state.withdrawals=[];
  const request=build(snapshot);assert.equal(request.state.partnerDebts[0].settledAmount??0,cents/100);
  if(cents)assert.equal(request.state.partnerDebts[0].settlements[0].amount,cents/100);
  assert.equal(request.record.partnerDebtSettlements.a??0,cents/100);assert.deepEqual(validateMonthlyApproval(JSON.parse(JSON.stringify(request))),request);
 }
});
test('legacy missing settlement history is created only when used; unused tiny debt remains unchanged',()=>{
 const snapshot=source();delete snapshot.state.partnerDebts[0].settlements;snapshot.state.partnerDebts.push({partnerId:'a',amount:.0001});
 const request=build(snapshot);assert.equal(request.state.partnerDebts[0].settlements.length,1);assert.deepEqual(request.state.partnerDebts[2],snapshot.state.partnerDebts[2]);
});
test('malformed history cannot produce partially mutated source',()=>{
 for(const settlements of [{},null,false]){const snapshot=source();snapshot.state.partnerDebts[1].settlements=settlements;const before=structuredClone(snapshot);assert.throws(()=>build(snapshot));assert.deepEqual(snapshot,before);}
});
test('inactive historical membership and saved prior approvals are preserved without new settlement',()=>{
 const snapshot=source();snapshot.state.partners.push({id:'old',name:'Old',share:10,capital:20,active:false,exitDate:'2026-08-01'});snapshot.state.partnerDebts.push({id:'old-debt',partnerId:'old',date:'2026-09-01',amount:10});snapshot.state.approvedMonths['2026-08']={partnerShares:{old:20},periodEnd:'2026-08-31'};
 const request=build(snapshot);assert.deepEqual(request.state.partnerDebts[2],snapshot.state.partnerDebts[2]);assert.deepEqual(request.state.approvedMonths['2026-08'],snapshot.state.approvedMonths['2026-08']);
});
test('audit exposes exact before-plus-settlement-after and zero cash, never a persistable approval',()=>{
 const preview=approvalPreview(source(),month,options),audit=approvalStateAudit(preview);assert.equal(audit.debtChanges.length,2);assert.deepEqual(audit.debtChanges[0],{partnerId:'a',name:'<svg>',debtId:'one',index:0,before:2,amount:8,after:10});assert.equal(audit.settled,18);assert.equal(audit.cashMovement,0);
 for(const key of ['state','sourceState','approvedAt','settledAt','revision'])assert.equal(Object.hasOwn(audit,key),false);assert.ok(Object.isFrozen(audit.debtChanges[0]));
});
test('approval only prepares previous month and cannot repeat within same current month',()=>{
 for(const selected of ['2026-08','2026-10','2026-11'])assert.throws(()=>prepareMonthlyApproval(source(),selected,options));
 const snapshot=source();snapshot.state.approvedMonths['2026-08']={approvedAt:'2026-10-01 09:00',periodEnd:'2026-09-30'};
 assert.throws(()=>build(snapshot),/غير متاحة/);
 assert.throws(()=>build(source(),{settledAt:'2026-10-10 12:02'}),/وقت تسوية/);
});
test('year-boundary previous month and leap day stamps stay calendar-correct',()=>{
 const snapshot=source();snapshot.state.revenues=[{date:'2025-12-01',amount:50}];snapshot.state.expenses=[];
 const january=prepareMonthlyApproval(snapshot,'2025-12',{inventoryCost:0,today:'2026-01-01',approvedAt:'2026-01-01 00:00'});assert.equal(january.record.periodEnd,'2025-12-31');
 assert.throws(()=>build(source(),{today:'2026-02-29',approvedAt:'2026-02-29 12:00'}),/وقت/);
});
test('prototype-shaped partner identities remain own saved map keys after JSON recreation',()=>{
 const snapshot=source();snapshot.state.partners[0].id='__proto__';snapshot.state.withdrawals[0].partnerId='__proto__';snapshot.state.partnerDebts.forEach(row=>row.partnerId='__proto__');
 const request=build(snapshot);assert.equal(Object.hasOwn(request.record.partnerShares,'__proto__'),true);assert.equal(Object.hasOwn(request.record.partnerDebtSettlements,'__proto__'),true);assert.deepEqual(validateMonthlyApproval(JSON.parse(JSON.stringify(request))),request);
});
