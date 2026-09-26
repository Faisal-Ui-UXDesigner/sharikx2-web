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
