import test from 'node:test';
import assert from 'node:assert/strict';
import {Api} from '../api.js';
function memory(){const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
test('reloading reuses the tab auth identity without storing passwords',async()=>{
 const storage=memory(),config={url:'https://example.invalid',publicKey:'public'};
 const first=new Api(config,storage);first.fetch=async()=>({access_token:'token',refresh_token:'refresh',expires_in:3600,user:{email:'not-stored'}});
 await first.session();const second=new Api(config,storage);second.fetch=()=>{throw new Error('new signup must not happen');};
 assert.equal(await second.session(),'token');assert.equal(second.auth.user,undefined);
 second.clearSession();assert.equal(new Api(config,storage).auth,null);
});
test('parallel callers share one auth refresh',async()=>{
 let calls=0;const api=new Api({});api.fetch=async()=>{calls++;return {access_token:'token',refresh_token:'refresh',expires_in:3600};};
 await Promise.all([api.session(),api.session()]);assert.equal(calls,1);
});

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
const authResponse=token=>({access_token:token,refresh_token:'refresh-'+token,expires_in:3600});

test('logout separates refresh generations and old cleanup never clears a new refresh',async()=>{
 const api=new Api({}),old=deferred(),fresh=deferred();let calls=0;
 api.fetch=()=>++calls===1?old.promise:fresh.promise;
 const previous=api.session(),rejected=assert.rejects(previous,/SESSION_CLOSED/);
 api.clearSession();
 const current=api.session(),currentRefresh=api.refreshing;
 old.resolve(authResponse('old'));await rejected;
 assert.equal(api.auth,null);assert.equal(api.refreshing,currentRefresh);
 const joined=api.session();assert.equal(calls,2);
 fresh.resolve(authResponse('fresh'));
 assert.deepEqual(await Promise.all([current,joined]),['fresh','fresh']);
 assert.equal(api.auth.access_token,'fresh');assert.equal(api.refreshing,null);
});

test('logout during authentication prevents the business request from being dispatched',async()=>{
 const api=new Api({});
 api.session=async()=>{api.clearSession();return 'old';};
 api.fetch=()=>assert.fail('stale token must not send a request');
 await assert.rejects(api.request('/rest/v1/sharikx2_products'),/SESSION_CLOSED/);
});

test('logout while a business request is in flight discards its late response',async()=>{
 const api=new Api({}),started=deferred(),response=deferred();
 api.auth={access_token:'old',refresh_token:'refresh',expires_at:Date.now()/1000+3600};
 api.fetch=()=>{started.resolve();return response.promise;};
 const pending=api.request('/rest/v1/sharikx2_products');
 const rejected=assert.rejects(pending,/SESSION_CLOSED/);
 await started.promise;api.clearSession();response.resolve([{id:'old-project'}]);
 await rejected;assert.equal(api.auth,null);
});

test('invalid stored sessions are ignored and restored sessions retain only auth fields',()=>{
 const config={url:'fixture'};
 for(const value of ['bad JSON',JSON.stringify({access_token:[],refresh_token:'r',expires_at:1}),JSON.stringify({access_token:'a',refresh_token:'r',expires_at:-1})]){
  assert.equal(new Api(config,{getItem:()=>value}).auth,null);
 }
 const saved={access_token:'a',refresh_token:'r',expires_at:1,password:'must not retain',user:{}};
 assert.deepEqual(new Api(config,{getItem:()=>JSON.stringify(saved)}).auth,{access_token:'a',refresh_token:'r',expires_at:1});
});

test('malformed refresh tokens and lifetimes never create or persist a session',async()=>{
 for(const change of [{access_token:[]},{refresh_token:{}},{expires_in:'bad'},{expires_in:0},{expires_in:-1},{expires_in:Infinity}]){
  const api=new Api({}, {setItem:()=>assert.fail('must not persist invalid auth')});
  api.fetch=async()=>({...authResponse('a'),...change});
  await assert.rejects(api.session(),/INVALID_AUTH_RESPONSE/);
  assert.equal(api.auth,null);assert.equal(api.refreshing,null);
 }
});

test('failed refresh remains retryable using the same existing identity',async()=>{
 const api=new Api({});let calls=0;
 api.auth={access_token:'expired',refresh_token:'existing',expires_at:1};
 api.fetch=async(path,options)=>{
  assert.match(path,/grant_type=refresh_token/);
  assert.deepEqual(JSON.parse(options.body),{refresh_token:'existing'});
  if(++calls===1)throw new Error('network');return authResponse('renewed');
 };
 await assert.rejects(api.session(),/network/);
 assert.equal(await api.session(),'renewed');assert.equal(calls,2);
});

test('blocked browser storage does not break sign-in or logout',async()=>{
 const fail=()=>{throw new Error('storage blocked');};
 const api=new Api({}, {getItem:fail,setItem:fail,removeItem:fail});
 api.fetch=async()=>authResponse('a');
 assert.equal(await api.session(),'a');
 assert.doesNotThrow(()=>api.clearSession());assert.equal(api.auth,null);
});
