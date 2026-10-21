import test from 'node:test';
import assert from 'node:assert/strict';
import {Api,assertIsolatedPath} from '../api.js';
import {RECEIPT_MAX_BYTES} from '../receipt.js';
const projectId='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222';
const options=()=>({projectId,kind:'expense',path:`${user}/${projectId}/expenses/1720000000.png`});
const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
function client(){const api=new Api({url:'https://fixture.invalid',publicKey:'public-fixture-key'});api.session=async()=>'fixture-token';return api;}
test('receipt transport is GET-only, authenticated, non-cacheable, redirect-safe and separate from the JSON gateway',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async(url,request)=>{calls.push({url,request});return new Response(png,{headers:{'Content-Type':'image/png'}});});
 const api=client(),result=await api.receiptBlob({...options(),method:'POST',body:'ignored',endpoint:'https://evil.invalid'});assert.equal(result.type,'image/png');assert.equal(calls.length,1);
 const {url,request}=calls[0];assert.equal(url,'https://fixture.invalid/storage/v1/object/authenticated/payment-receipts/'+options().path);
 assert.equal(request.method,'GET');assert.equal(request.cache,'no-store');assert.equal(request.redirect,'error');assert.equal(request.credentials,'omit');assert.equal(request.referrerPolicy,'no-referrer');
 assert.equal(request.headers.Authorization,'Bearer fixture-token');assert.ok(!url.includes('fixture-token'));assert.equal(request.body,undefined);assert.throws(()=>assertIsolatedPath('/storage/v1/object/authenticated/payment-receipts/x'));
});
test('invalid path or config and foreign open project fail before auth or network',async t=>{
 let reads=0,auth=0;t.mock.method(globalThis,'fetch',async()=>{reads++;throw Error('unexpected');});const api=client();api.session=async()=>{auth++;return 'token';};
 await assert.rejects(api.receiptBlob({...options(),path:'https://evil.invalid/picture.png'}));
 api.deviceContext={projectId:user};await assert.rejects(api.receiptBlob(options()));api.deviceContext=null;
 for(const url of ['http://fixture.invalid','https://fixture.invalid/path','https://user:pass@fixture.invalid','https://fixture.invalid?key=x']){api.config.url=url;await assert.rejects(api.receiptBlob(options()));}
 api.config.publicKey='';await assert.rejects(api.receiptBlob(options()));assert.equal(reads,0);assert.equal(auth,0);
});
test('server denial is surfaced without public/signed fallback or retry',async t=>{
 for(const status of [401,403,404,500]){
  let count=0;t.mock.method(globalThis,'fetch',async()=>{count++;return new Response('private',{status});});
  await assert.rejects(client().receiptBlob(options()),error=>error.status===status&&error.code==='RECEIPT_ACCESS_FAILED');assert.equal(count,1);t.mock.restoreAll();
 }
});
test('session and device changes invalidate reads before dispatch and after response',async t=>{
 let reads=0;const api=client();t.mock.method(globalThis,'fetch',async()=>{reads++;return new Response(png,{headers:{'Content-Type':'image/png'}});});
 api.session=async()=>{api.clearSession();return 'old-token';};await assert.rejects(api.receiptBlob(options()),/SESSION_CLOSED/);assert.equal(reads,0);
 api.session=async()=>'token';t.mock.restoreAll();t.mock.method(globalThis,'fetch',async()=>{api.clearDeviceContext();return new Response(png,{headers:{'Content-Type':'image/png'}});});
 await assert.rejects(api.receiptBlob(options()),/المشروع/);
});
test('cancelled reads never authenticate or fetch',async t=>{
 let reads=0;const api=client();api.session=async()=>{reads++;return 'token';};t.mock.method(globalThis,'fetch',async()=>{reads++;});
 const controller=new AbortController();controller.abort();await assert.rejects(api.receiptBlob({...options(),signal:controller.signal}),error=>error.name==='AbortError');assert.equal(reads,0);
 let release;api.session=()=>new Promise(resolve=>{release=resolve;});const late=new AbortController();
 const pending=api.receiptBlob({...options(),signal:late.signal});late.abort();release('token');await assert.rejects(pending,error=>error.name==='AbortError');assert.equal(reads,0);
});
test('HTML/SVG, mismatched signatures, empty files and declared oversize are rejected',async t=>{
 for(const response of [new Response('<svg/>',{headers:{'Content-Type':'image/svg+xml'}}),new Response('HTML',{headers:{'Content-Type':'image/png'}}),new Response(png,{headers:{'Content-Type':'image/jpeg'}}),new Response(null,{headers:{'Content-Type':'image/png'}}),new Response(png,{headers:{'Content-Type':'image/png','Content-Length':String(RECEIPT_MAX_BYTES+1)}})]){
  t.mock.method(globalThis,'fetch',async()=>response);await assert.rejects(client().receiptBlob(options()));t.mock.restoreAll();
 }
});
test('streamed size limit cancels an oversized body without buffering an unbounded response',async t=>{
 let cancelled=false;const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(RECEIPT_MAX_BYTES));controller.enqueue(new Uint8Array(1));},cancel(){cancelled=true;}});
 t.mock.method(globalThis,'fetch',async()=>new Response(body,{headers:{'Content-Type':'image/png'}}));
 await assert.rejects(client().receiptBlob(options()),error=>error.code==='INVALID_RECEIPT_SIZE');assert.equal(cancelled,true);
});
