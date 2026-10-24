import test from 'node:test';
import assert from 'node:assert/strict';
import {subscriptionNotice,monthCloseNotice,projectNotices,notificationSignature,loadProjectNotices} from '../project-notifications.js';
const now=Date.parse('2026-10-22T12:00:00Z'),day=86400000;
test('native subscription notification uses five ceil days, not three-day renewal UI threshold',()=>{
 const project={subscription_status:'active'};for(const expires of [null,0,-1])assert.equal(subscriptionNotice({...project,subscription_expires_at:expires},now),null);
 assert.equal(subscriptionNotice({...project,subscription_expires_at:now+5*day+1},now),null);assert.match(subscriptionNotice({...project,subscription_expires_at:now+5*day},now).message,/5 أيام/);assert.match(subscriptionNotice({...project,subscription_expires_at:now+1},now).message,/1 أيام/);assert.equal(subscriptionNotice({...project,subscription_expires_at:now},now).title,'الاشتراك منتهي');assert.equal(subscriptionNotice({subscription_status:'trial'},now),null);assert.throws(()=>subscriptionNotice({...project,subscription_expires_at:'bad'},now));
});
test('native month-close two final days and first seven-day approval window retain precedence',()=>{
 const base={lastDay:31,currentApproved:false,previousCanApprove:true,periodLabel:'من 2026-09-01 إلى 2026-10-01'};
 for(const value of [30,31])assert.equal(monthCloseNotice({...base,day:value}).title,'نقترب من نهاية الشهر');for(const value of [1,7])assert.equal(monthCloseNotice({...base,day:value}).title,'فترة مالية بانتظار الاعتماد');for(const value of [8,29])assert.equal(monthCloseNotice({...base,day:value}),null);assert.equal(monthCloseNotice({...base,day:31,currentApproved:true}),null);assert.throws(()=>monthCloseNotice({...base,day:32}));
});
test('inventory notification means empty catalog only, no stale-age or zero-stock inference',()=>{
 const input={project:{id:'project'},snapshot:{state:{approvedMonths:{}}},products:[],days:[],mode:'owner',now};const empty=projectNotices(input);assert.equal(empty[0].key,'inventory_stale');assert.equal(projectNotices({...input,products:[{id:'p',quantity:0,created_at:'2000-01-01'}]}).length,0);assert.deepEqual(projectNotices({...input,mode:'viewer'}),[]);assert.ok(Object.isFrozen(empty));assert.ok(Object.isFrozen(empty[0]));assert.equal(notificationSignature(empty),notificationSignature(empty.map(row=>({...row,createdAt:0,message:'other'}))));
});
test('Palestine month end/leap day and saved approval suppress only the correct reminder',()=>{
 const input={project:{},snapshot:{state:{approvedMonths:{}}},products:[{}],days:[],mode:'owner',now:Date.parse('2024-02-28T12:00:00Z')};assert.equal(projectNotices(input)[0].title,'نقترب من نهاية الشهر');assert.equal(projectNotices({...input,snapshot:{state:{approvedMonths:{'2024-02':{}}}}}).length,0);
 const early=projectNotices({...input,now:Date.parse('2026-10-07T12:00:00Z'),days:['2026-09-01']});assert.match(early[0].message,/من 2026-09-01 إلى 2026-10-06/);assert.equal(projectNotices({...input,project:{created_at:'2026-10-01T00:00:00Z'},now:Date.parse('2026-10-07T12:00:00Z')}).length,0);
});
function fixture(){let calls=0;const snapshot={revision:1,state:{approvedMonths:{}}};return {snapshot,get calls(){return calls;},api:{sharingProject:async id=>({id,subscription_status:'trial'}),projectCreatedAt:async()=> '2026-09-01T00:00:00Z',financeState:async()=>{calls++;return structuredClone(snapshot);},allRows:async(table,id,fields,filters)=>{assert.equal(id,'project');if(table==='products'){assert.equal(fields,'id');assert.deepEqual(filters,{active:'eq.true'});}else assert.ok(fields.includes('created_at'));return [];}}};}
test('loader is scoped/read-only, checks approval revision and never turns failures into empty success',async()=>{
 const f=fixture(),before=JSON.stringify(f.snapshot),rows=await loadProjectNotices({api:f.api,project:{id:'project'},mode:'owner',now});assert.equal(rows[0].key,'inventory_stale');assert.equal(f.calls,2);assert.equal(JSON.stringify(f.snapshot),before);
 f.api.allRows=async()=>{throw Error('failed source');};await assert.rejects(loadProjectNotices({api:f.api,project:{id:'project'},mode:'owner',now}),/failed source/);
 const drift=fixture();let n=0;drift.api.financeState=async()=>({revision:++n,state:{}});await assert.rejects(loadProjectNotices({api:drift.api,project:{id:'project'},mode:'owner',now}),/تغيرت/);
});
test('viewer does not read remote state and stale or malformed activity fails closed',async()=>{
 assert.deepEqual(await loadProjectNotices({api:{},project:{},mode:'viewer'}),[]);const f=fixture();await assert.rejects(loadProjectNotices({api:f.api,project:{id:'project'},mode:'owner',isCurrent:()=>false}));f.api.allRows=async table=>table==='sales'?[{created_at:'bad'}]:[];await assert.rejects(loadProjectNotices({api:f.api,project:{id:'project'},mode:'owner',now:Date.parse('2026-10-07T12:00:00Z')}),/تاريخ/);
});
test('early-month approval label includes the original non-cash supplier discount day',async()=>{
 const f=fixture();f.api.allRows=async table=>table==='supplier_payments'?[{id:'d',project_id:'project',amount:1,paid_at:'2026-09-03T10:00:00Z',payment_kind:'discount'}]:table==='products'?[{id:'p'}]:[];
 const rows=await loadProjectNotices({api:f.api,project:{id:'project'},mode:'owner',now:Date.parse('2026-10-07T12:00:00Z')});assert.match(rows[0].message,/من 2026-09-03 إلى 2026-10-06/);
});
test('approval notice days reconcile server-linked activity and exclude cancelled or pending sales',async()=>{
 const f=fixture();f.snapshot.state.revenues=[{id:'cashier-old',sharikx2SaleId:'old',date:'2020-01-01',amount:2},{id:'queued',pendingSync:true,date:'2021-01-01',amount:3}];
 f.api.allRows=async table=>table==='sales'?[{id:'old',status:'cancelled',created_at:'2020-01-01T12:00:00Z'},{id:'draft',status:'pending',created_at:'2022-01-01T12:00:00Z'},{id:'confirmed',status:'completed',created_at:'2026-09-04T12:00:00Z'}]:[];
 const rows=await loadProjectNotices({api:f.api,project:{id:'project'},mode:'owner',now:Date.parse('2026-10-07T12:00:00Z')});assert.match(rows.find(row=>row.key==='month_close').message,/من 2026-09-04 إلى 2026-10-06/);
});
