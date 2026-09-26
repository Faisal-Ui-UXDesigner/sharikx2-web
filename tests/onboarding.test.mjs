import test from 'node:test';
import assert from 'node:assert/strict';
import {Api} from '../api.js';

test('project creation and capital setup use only isolated SharikX2 RPCs',async()=>{
  const calls=[];
  const api=new Api({url:'https://example.supabase.co',publicKey:'public'});
  api.rpc=async(name,body)=>{calls.push({name,body});return {id:'project-id',revision:1};};
  await api.createProject('مشروع','0591234567','1234');
  await api.saveFinanceState('project-id',{partners:[{name:'شريك',capital:100,share:50,active:true}]},0);
  await api.transferOpening('project-id','cash-id','bank-id',40);
  assert.deepEqual(calls.map(x=>x.name),['create_sharikx2_project_v3','save_sharikx2_finance_state_v1','transfer_sharikx2_account_v2']);
  assert.equal(calls[0].body.p_wallet_1_name,'بال باي');
  assert.equal(calls[1].body.p_expected_revision,0);
  assert.equal(calls[2].body.p_amount,40);
});
