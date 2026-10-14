import test from 'node:test';
import assert from 'node:assert/strict';
import {distributionPayload,distributionShares,updateDistributionState,distributionPreview} from '../partner-distribution.js';
import {financeEditRequest,createFinanceEdit,financeEditKey,readFinanceEdit} from '../finance-edit.js';
import {openPartnerDistribution} from '../partner-distribution-ui.js';
const projectId='project';
const base=()=>({revision:4,capital_posted:151,state:{partners:[{id:'a',name:'الأول',capital:100.25,share:60,joinedAt:'2026-01-01 12:00',opaque:1},{id:'old',name:'سابق',capital:50,share:10,active:false},{id:'b',name:'الثاني',capital:50.75,share:30}],reinvestmentCap:1500,approvedMonths:{'2026-09':{keep:true}},opaque:{keep:true}}});
const input=()=>({partners:[{partnerId:'a',name:' أ ',capital:'100.5',share:'33.35'},{partnerId:'b',name:'ب',capital:'50.5',share:'33.35'}]});
function store(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}
test('bulk native assignments change project remainder without proportional rebalancing or losing history',()=>{
 const snapshot=base(),before=structuredClone(snapshot),result=distributionPreview(snapshot,input());
 assert.deepEqual(result.state.partners.filter(p=>p.active!==false).map(p=>p.share),[33.4,33.4]);assert.equal(result.remaining,33.2);assert.equal(result.delta,0);assert.equal(result.after,151);
 assert.equal(result.state.partners[0].name,'أ');assert.equal(result.state.partners[0].joinedAt,'2026-01-01 12:00');assert.equal(result.state.partners[0].opaque,1);assert.deepEqual(result.state.partners[1],snapshot.state.partners[1]);assert.deepEqual(result.state.approvedMonths,snapshot.state.approvedMonths);assert.equal(result.state.reinvestmentCap,1500);assert.deepEqual(snapshot,before);
});
test('all 1001 tenth pairs conserve exactly 100 percent and do not rebalance entered values',()=>{
 for(let i=0;i<=1000;i++){const values=input();values.partners[0].share=i/10;values.partners[1].share=(1000-i)/10;const result=distributionPreview(base(),values);assert.equal(result.remaining,0);assert.equal(result.state.partners[0].share,i/10);assert.equal(result.state.partners[2].share,(1000-i)/10);}
});
test('blank/negative shares clamp to native zero and empty capital means zero',()=>{
 const values=input();values.partners[0].share='';values.partners[1].share=-1;values.partners[0].capital='';values.partners[1].capital=0;
 const result=distributionPreview(base(),values);assert.equal(result.after,0);assert.equal(result.delta,-151);assert.equal(result.remaining,100);assert.deepEqual(result.state.partners.filter(p=>p.active!==false).map(p=>p.share),[0,0]);
});
test('round each before sum: excess becomes visible and blocks serialization',()=>{
 const values=input();values.partners[0].share='50.05';values.partners[1].share='50.05';assert.equal(distributionShares(values).total,100.2);assert.equal(distributionShares(values).valid,false);assert.throws(()=>financeEditRequest(base(),projectId,'partner-distribution',values),/100/);
});
test('exact signed cent deltas and no per-partner binary drift',()=>{
 for(let cents=0;cents<100;cents++){const values=input();values.partners[0].capital=(10025+cents)/100;values.partners[1].capital=50.75;assert.equal(distributionPreview(base(),values).delta,cents/100);}
 const values=input();values.partners[0].capital=100;values.partners[1].capital=50.75;assert.equal(distributionPreview(base(),values).delta,-.25);
});
test('missing extra duplicate foreign reordered and former identities fail instead of editing a partial list',()=>{
 const values=input();for(const rows of [[],values.partners.slice(0,1),[...values.partners,values.partners[0]],values.partners.toReversed(),[values.partners[0],{...values.partners[1],partnerId:'old'}],[values.partners[0],{...values.partners[1],partnerId:'foreign'}]])assert.throws(()=>updateDistributionState(base(),{partners:rows}));
});
test('invalid names monetary precision aggregate bounds and nonfinite shares fail closed',()=>{
 for(const changes of [{name:''},{capital:-1},{capital:.001},{capital:Infinity},{capital:null},{capital:1e9},{share:NaN},{share:Infinity},{share:101}]){const values=input();Object.assign(values.partners[0],changes);assert.throws(()=>updateDistributionState(base(),values));}
 assert.throws(()=>distributionPayload({partners:null}));
});
test('lost response retains original complete distribution, recreated recovery never saves again',async()=>{
 const storage=store();let snapshot=base(),writes=0;const values=input();values.partners[0].capital=100.75;
 const api={financeState:async()=>structuredClone(snapshot),saveFinanceState:async(id,state,revision)=>{writes++;snapshot={revision:revision+1,state:structuredClone(state),capital_posted:151.25};throw Error('lost');}};
 const request=financeEditRequest(snapshot,projectId,'partner-distribution',values);await assert.rejects(createFinanceEdit({api,storage,projectId}).run(request));values.partners[0].capital=999;assert.equal(readFinanceEdit(storage,projectId).input.partners[0].capital,100.75);await createFinanceEdit({api,storage,projectId}).run(null);assert.equal(writes,1);assert.equal(storage.getItem(financeEditKey(projectId)),null);
});
test('fresh source and posted capital mismatches block before persistence or save',async()=>{
 for(const change of [s=>s.revision++,s=>s.state.partners[0].name='changed',s=>s.capital_posted=150]){
  const original=base(),storage=store(),fresh=base();change(fresh);let writes=0;const api={financeState:async()=>fresh,saveFinanceState:async()=>writes++};await assert.rejects(createFinanceEdit({api,storage,projectId}).run(financeEditRequest(original,projectId,'partner-distribution',input())));assert.equal(writes,0);assert.equal(storage.getItem(financeEditKey(projectId)),null);
 }
});
test('wrong posted total retains journal until matching read, without repeated cash',async()=>{
 const storage=store();let snapshot=base(),writes=0;const api={financeState:async()=>structuredClone(snapshot),saveFinanceState:async(id,state,revision)=>{writes++;snapshot={revision:revision+1,state,capital_posted:150};return {revision:revision+1,capital_posted:150};}};
 await assert.rejects(createFinanceEdit({api,storage,projectId}).run(financeEditRequest(snapshot,projectId,'partner-distribution',input())));await assert.rejects(createFinanceEdit({api,storage,projectId}).run(null));snapshot.capital_posted=151;await createFinanceEdit({api,storage,projectId}).run(null);assert.equal(writes,1);
});
test('captured distribution tampering and concurrent newer revisions cannot be accepted',async()=>{
 const storage=store(),request=financeEditRequest(base(),projectId,'partner-distribution',input());request.state.partners[0].capital=99;storage.setItem(financeEditKey(projectId),JSON.stringify(request));assert.throws(()=>readFinanceEdit(storage,projectId));
 const valid=financeEditRequest(base(),projectId,'partner-distribution',input());storage.setItem(financeEditKey(projectId),JSON.stringify(valid));await assert.rejects(createFinanceEdit({api:{financeState:async()=>({revision:6,state:valid.state,capital_posted:151})},storage,projectId}).run(null));assert.notEqual(storage.getItem(financeEditKey(projectId)),null);
});
test('viewer protection precedes DOM, even for bulk editing',()=>{assert.throws(()=>openPartnerDistribution({mode:'viewer'}),/للمشاهدة/);});
