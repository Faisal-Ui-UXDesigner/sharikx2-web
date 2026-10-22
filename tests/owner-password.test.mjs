import test from 'node:test';
import assert from 'node:assert/strict';
import {Api} from '../api.js';
import {ownerPasswordPayload,passwordFailure} from '../owner-password.js';
const projectId='11111111-1111-4111-8111-111111111111';
test('native exact four ASCII digits preserve leading zeros and capture only approved RPC fields',()=>{
 const payload=ownerPasswordPayload(projectId,'0012','0034','0034');assert.deepEqual(payload,{p_project_id:projectId,p_current_password:'0012',p_new_password:'0034'});assert.ok(Object.isFrozen(payload));
});
test('native current/new/confirmation and unchanged validation never trims normalizes or coerces secrets',()=>{
 for(const current of ['','123','12345','1234\n',' 1234','١٢٣٤',1234])assert.throws(()=>ownerPasswordPayload(projectId,current,'5678','5678'));
 for(const next of ['','567','56789','5678\n','٥٦٧٨',5678])assert.throws(()=>ownerPasswordPayload(projectId,'1234',next,next));
 assert.throws(()=>ownerPasswordPayload(projectId,'1234','5678','5679'));assert.throws(()=>ownerPasswordPayload(projectId,'1234','1234','1234'));assert.throws(()=>ownerPasswordPayload('bad','1234','5678','5678'));
});
test('only exact recognized server failures permit correction; unknown/malformed replies never expose raw errors',()=>{
 for(const code of ['CURRENT_PASSWORD_INVALID','PASSWORD_UNCHANGED','INVALID_PASSWORD_FORMAT','OWNER_REQUIRED','PROJECT_NOT_FOUND'])assert.equal(passwordFailure(Error(code)).uncertain,false);
 for(const value of [Error('secret-0012'),Error('HTTP 500'),{},Error('PASSWORD_CHANGE_UNCONFIRMED')]){const failure=passwordFailure(value);assert.equal(failure.uncertain,true);assert.ok(!failure.message.includes('0012'));}
 assert.equal(passwordFailure({notDispatched:true}).uncertain,false);
});
test('owner password API uses the existing isolated RPC, no-store POST and exact changed acknowledgement',async()=>{
 const api=new Api({});api.setDeviceContext({projectId,mode:'owner'});const before=api.auth;let writes=0;api.request=async(path,options)=>{writes++;assert.equal(path,'/rest/v1/rpc/change_sharikx2_owner_password_v1');assert.equal(options.method,'POST');assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');assert.deepEqual(JSON.parse(options.body),{p_project_id:projectId,p_current_password:'0012',p_new_password:'0034'});return {status:'changed'};};
 assert.deepEqual(await api.changeOwnerPassword(projectId,'0012','0034','0034'),{status:'changed'});assert.equal(writes,1);assert.equal(api.auth,before);
 api.request=async()=>({status:'pending'});await assert.rejects(api.changeOwnerPassword(projectId,'0012','0034','0034'),/UNCONFIRMED/);
});
test('viewer foreign or missing owner context and malformed input never reach the password RPC',async()=>{
 const api=new Api({});let calls=0;api.request=async()=>{calls++;return {status:'changed'};};await assert.rejects(api.changeOwnerPassword(projectId,'0012','0034','0034'));api.setDeviceContext({projectId,mode:'viewer'});await assert.rejects(api.changeOwnerPassword(projectId,'0012','0034','0034'));api.setDeviceContext({projectId:'22222222-2222-4222-8222-222222222222',mode:'owner'});await assert.rejects(api.changeOwnerPassword(projectId,'0012','0034','0034'));api.setDeviceContext({projectId,mode:'owner'});await assert.rejects(api.changeOwnerPassword(projectId,'0012','bad','bad'));assert.equal(calls,0);
});
test('real central password write gate retains device and session protections without secret persistence',async()=>{
 const storage={getItem:()=>null,setItem:()=>{throw Error('No credential storage');},removeItem:()=>{}},api=new Api({url:'https://fixture.invalid'},storage);api.setDeviceContext({projectId,mode:'owner'});api.session=async()=> 'synthetic';let calls=0,gates=0;api.assertDeviceWrite=async id=>{assert.equal(id,projectId);gates++;};api.fetch=async()=>{calls++;return {status:'changed'};};await api.changeOwnerPassword(projectId,'0012','0034','0034');assert.equal(gates,1);assert.equal(calls,1);
 api.assertDeviceWrite=async()=>{throw Object.assign(Error('Device blocked'),{notDispatched:true});};await assert.rejects(api.changeOwnerPassword(projectId,'0012','0034','0034'));assert.equal(calls,1);
 api.assertDeviceWrite=async()=>{};api.fetch=async()=>{api.clearSession();return {status:'changed'};};await assert.rejects(api.changeOwnerPassword(projectId,'0012','0034','0034'),/SESSION_CLOSED/);
});
