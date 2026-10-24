import test from 'node:test';
import assert from 'node:assert/strict';
import {Api} from '../api.js';
import {subscriptionRequestRows} from '../subscription-requests.js';
const projectId='11111111-1111-4111-8111-111111111111',userId='22222222-2222-4222-8222-222222222222';
const id=n=>`33333333-3333-4333-8333-${String(n).padStart(12,'0')}`;
const row=(n=1)=>({id:id(n),project_id:projectId,requester_id:userId,project_number:'00123',amount:'12.50',currency:'USD',status:'pending',created_at:'2026-10-22T12:00:00Z',reviewed_at:null,receipt_path:'not-exposed'});
function api(){const value=new Api({});value.setDeviceContext({projectId,mode:'owner'});value.session=async()=> 'fixture-token';value.fetch=async(path,options)=>{assert.equal(path,'/auth/v1/user');assert.equal(options.method,'GET');return {id:userId};};return value;}
test('request DTOs are scoped immutable, safely sorted and never carry private image paths',()=>{
 const rows=[row(1),{...row(2),status:'approved',created_at:'2026-10-22T13:00:00Z',reviewed_at:'2026-10-22T14:00:00Z'}],before=JSON.stringify(rows),value=subscriptionRequestRows(rows,projectId,userId);
 assert.equal(value[0].id,id(2));assert.equal(value[0].amount,12.5);assert.equal(value[0].projectNumber,'00123');assert.ok(Object.isFrozen(value));assert.ok(value.every(Object.isFrozen));assert.equal(value[0].receipt_path,undefined);assert.equal(JSON.stringify(rows),before);
});
test('legacy unrecorded currency stays unknown, never inferred from current USD pricing',()=>{
 for(const currency of [null,undefined])assert.equal(subscriptionRequestRows([{...row(),currency}],projectId,userId)[0].currency,null);
 assert.throws(()=>subscriptionRequestRows([{...row(),currency:'ILS'}],projectId,userId));
});
test('foreign identities malformed values duplicate rows and unknown states fail closed',()=>{
 for(const change of [{project_id:userId},{requester_id:projectId},{id:'bad'},{status:'active'},{amount:null},{amount:true},{amount:''},{amount:Infinity},{amount:-1},{project_number:123},{created_at:'bad'},{reviewed_at:'bad'}])assert.throws(()=>subscriptionRequestRows([{...row(),...change}],projectId,userId));
 assert.throws(()=>subscriptionRequestRows([row(),row()],projectId,userId));assert.throws(()=>subscriptionRequestRows({},projectId,userId));
});
test('request history API verifies auth identity, owner context and every page with exact GET filters',async()=>{
 const value=api(),paths=[];value.request=async(path,options)=>{paths.push(path);assert.equal(options.cache,'no-store');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.method,undefined);const url=new URL(path,'https://fixture.invalid'),q=url.searchParams;assert.equal(url.pathname,'/rest/v1/sharikx2_subscription_requests');assert.equal(q.get('project_id'),'eq.'+projectId);assert.equal(q.get('requester_id'),'eq.'+userId);assert.equal(q.get('order'),'created_at.desc,id.desc');assert.ok(!q.get('select').includes('receipt'));return q.get('offset')==='0'?Array.from({length:20},(_,n)=>row(n+1)):[row(21)];};
 const result=await value.subscriptionRequests(projectId);assert.equal(result.length,21);assert.equal(paths.length,2);
});
test('viewer foreign project and missing auth identity cannot query private request rows',async()=>{
 const value=api();let reads=0;value.request=async()=>{reads++;return [];};value.setDeviceContext({projectId,mode:'viewer'});await assert.rejects(value.subscriptionRequests(projectId));value.setDeviceContext({projectId,mode:'owner'});await assert.rejects(value.subscriptionRequests(userId));value.fetch=async()=>({id:'bad'});await assert.rejects(value.subscriptionRequests(projectId));assert.equal(reads,0);
});
test('partial reads, repeated pages and session or device changes cannot yield stale history',async()=>{
 const value=api();value.request=async()=>{value.clearSession();return [row()];};await assert.rejects(value.subscriptionRequests(projectId),/SESSION_CLOSED/);
 const next=api();next.request=async()=>{next.clearDeviceContext();return [];};await assert.rejects(next.subscriptionRequests(projectId));
 const repeat=api();repeat.request=async()=>Array.from({length:20},(_,n)=>row(n+1));await assert.rejects(repeat.subscriptionRequests(projectId),/ترتيب/);
 const partial=api();let pages=0;partial.request=async()=>{if(pages++)throw Error('page failed');return Array.from({length:20},(_,n)=>row(n+1));};await assert.rejects(partial.subscriptionRequests(projectId),/page failed/);
});
