import test from 'node:test';
import assert from 'node:assert/strict';
import {partnerDirectory} from '../partner-directory.js';

const snapshot={state:{partners:[{id:'a',share:60,capital:100.25},{id:'old',active:false,name:'قديم',capital:12.25,settlementProfit:-3.51}],formerPartners:[{id:'old',name:'نسخة مكررة',settlementBalance:99},{id:'recent',name:'حديث',exitDate:'2026-10-09',capital:999,settlementCapital:20.75,settlementProfit:'3.25',settlementWithdrawn:1.5,settlementReinvestment:2.25,settlementInventory:30.51,settlementBalance:-4.01}],reinvestmentCap:500.75}};
test('directory projects all six authoritative settlement fields newest first without recomputation',()=>{
 const view=partnerDirectory(snapshot);
 assert.deepEqual(view.former.map(row=>row.name),['حديث','قديم']);
 assert.deepEqual(view.former[0].metrics.map(row=>row.value),[20.75,3.25,1.5,2.25,30.51,-4.01]);
 assert.equal(view.current[0].capital,100.25);assert.equal(view.retentionCap,500.75);
 assert.deepEqual(view.former[1].metrics.map(row=>row.value),[12.25,-3.51,0,0,0,0]);
});
test('directory isolates and freezes display data and never rewrites historical amounts',()=>{
 const input=structuredClone(snapshot),copy=structuredClone(input),view=partnerDirectory(input);
 assert.ok(Object.isFrozen(view.former[0].metrics[0]));assert.ok(Object.isFrozen(view.current[0]));
 input.state.formerPartners[1].settlementProfit=100;assert.equal(view.former[0].metrics[1].value,3.25);
 assert.deepEqual(snapshot,copy);assert.throws(()=>{view.former.reverse();});
});
test('historical signs and tones match Android rather than treating negative profit as a new debit',()=>{
 const view=partnerDirectory(snapshot);
 assert.deepEqual(view.former[0].metrics.map(row=>row.tone),['standard','profit','loss','standard','standard','loss']);
 assert.equal(view.former[1].metrics[1].tone,'neutral');assert.equal(view.former[1].metrics[5].tone,'neutral');
 const input=structuredClone(snapshot);input.state.formerPartners[1].settlementBalance=4.01;
 assert.equal(partnerDirectory(input).former[0].metrics[5].tone,'profit');
});
test('missing legacy fields default to zero but malformed stored fields cannot silently display zero',()=>{
 assert.deepEqual(partnerDirectory({state:{}}).former,[]);
 for(const field of ['settlementProfit','settlementWithdrawn','settlementReinvestment','settlementInventory'])for(const value of [null,true,[],{},'',NaN,Infinity,'bad']){
  const input=structuredClone(snapshot);input.state.formerPartners[1][field]=value;assert.throws(()=>partnerDirectory(input));
 }
});
