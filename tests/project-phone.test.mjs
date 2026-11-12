import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPhone} from '../project-phone.js';
import {Api} from '../api.js';
import {createOpeningProject} from '../owner-path-store.js';
import {ownerApprovalAvailability} from '../owner-approval-availability.js';
import {ownerPartnersMarkup} from '../owner-partners-ui.js';

test('project phone accepts exactly ten normalized digits including Arabic keyboards',()=>{
 for(const value of ['0591234567','٠٥٩١٢٣٤٥٦٧','۰۵۹۱۲۳۴۵۶۷','059 123-4567']){
  assert.equal(projectPhone(value),'0591234567');
 }
 for(const value of ['059123456','05912345678','+970591234567','059123456a','',null]){
  assert.throws(()=>projectPhone(value),/10 أرقام/);
 }
});
test('invalid project phone is rejected before login or creation dispatch',async()=>{
 const api=new Api({url:'https://fixture.invalid',publicKey:''});
 let calls=0;api.rpc=async()=>{calls++;};
 assert.throws(()=>api.restore('123456789','1234'),/10 أرقام/);
 assert.throws(()=>api.createProject('محل','12345678901','1234'),/10 أرقام/);
 const values=new Map();
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const flow=createOpeningProject({api,storage,device:'test-device'});
 await assert.rejects(flow.create('محل','12345678901','1234'),/10 أرقام/);
 assert.equal(calls,0);
});
test('approval display honors explicit server availability and native reminder fallback',()=>{
 const base={opening_locked:true,finance_bridge:1,started_at:'2026-10-01T00:00:00Z',finance_events:[]};
 assert.equal(ownerApprovalAvailability({...base,approval_available:false},'2026-11-12').available,false);
 assert.equal(ownerApprovalAvailability({...base,approval_available:true},'2026-11-12').available,true);
 assert.equal(ownerApprovalAvailability(base,'2026-11-12').available,true);
 assert.equal(ownerApprovalAvailability({...base,local_only:true},'2026-11-12').available,false);
 assert.equal(ownerApprovalAvailability({...base,finance_events:[{kind:'approve',occurred_at:'2026-11-01T12:00:00Z'}]},'2026-11-12').reminderStart,'2026-11-29');
});
test('partner markup shows exact combined debt and reconciled totals without mutating state',()=>{
 const state={finance_bridge:1,opening_locked:true,approval_available:true,profit:{allocation_complete:true,
  summary:{net_project_value:'0.3'},partners:[{id:'p',name:'<شريك>',share:'100',total:'0.3',debt:'0.1',cash_debt:'0.2'}]}};
 const before=JSON.stringify(state),html=ownerPartnersMarkup(state);
 assert.match(html,/&lt;شريك&gt;/);assert.match(html,/مجموع حسابات الشركاء/);assert.match(html,/يساوي قيمة محلك اليوم/);
 assert.match(html,/دين عليه للمحل/);assert.match(html,/0.3/);
 assert.equal(JSON.stringify(state),before);
});
