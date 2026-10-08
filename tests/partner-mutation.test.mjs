import test from 'node:test';
import assert from 'node:assert/strict';
import {partnerPayload,updatePartnerState} from '../partner-mutation.js';

test('partner payload trims names and rounds percentage safely',()=>{
  assert.deepEqual(partnerPayload(' شريك ','33.456'),{name:'شريك',share:33.5});
});

test('partner payload rejects invalid names and shares',()=>{
  assert.throws(()=>partnerPayload('','20'));
  assert.throws(()=>partnerPayload('شريك','-1'));
  assert.throws(()=>partnerPayload('شريك','101'));
});

test('partner state updates selected name, rebalances other shares and preserves other fields',()=>{
  const snapshot={revision:4,state:{partners:[{id:'a',name:'أ',capital:100,share:60,active:true},{id:'b',name:'ب',capital:50,share:30,active:true}],other:'kept'}};
  const next=updatePartnerState(snapshot,'a',{name:' أ جديد ',share:'55'});
  assert.deepEqual(next.partners,[{id:'a',name:'أ جديد',capital:100,share:55,active:true},{id:'b',name:'ب',capital:50,share:35,active:true}]);
  assert.equal(next.other,'kept');
  assert.equal(snapshot.state.partners[0].name,'أ');
});

test('partner state rejects totals above one hundred percent',()=>{
  const snapshot={state:{partners:[{id:'a',name:'أ',share:70,active:true},{id:'b',name:'ب',share:20,active:true}]}};
  assert.throws(()=>updatePartnerState(snapshot,'a',{name:'أ جديد',share:91}),/بين/);
});
