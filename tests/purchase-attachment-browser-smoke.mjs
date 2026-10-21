import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
import {openPurchasePayments,selectPurchaseSupplier} from './purchase-form-actions.mjs';
const require=createRequire(import.meta.url),{chromium,webkit}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 for(const engine of ['edge','webkit']){
  const browser=await(engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
   await page.goto(preview.origin+'/styles.css');
   await page.evaluate(()=>{window.activeUrls=new Set();const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);activeUrls.add(url);return url;};URL.revokeObjectURL=url=>{activeUrls.delete(url);return revoke(url);};});
   const setup=async()=>{
    await page.setContent('<html lang="ar" dir="rtl"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body></body></html>');
    await page.evaluate(async()=>{
     sessionStorage.clear();window.current=true;window.saved=0;window.calls=[];window.uploads=0;window.links=0;window.object=null;window.path=null;window.failFinance=false;window.failUpload=false;window.badId=false;window.holdUpload=false;
     window.projectId='11111111-1111-4111-8111-111111111111';window.recordId='33333333-3333-4333-8333-333333333333';
     const {openPurchase}=await import('/purchase.js');
     window.api={allRows:async table=>table==='products'?[{id:'p',name:'صنف اصطناعي',weighted_unit_cost:1}]:[{id:'s',name:'مورد اصطناعي'}],summary:async()=>({accounts:[{id:'a',name:'نقد اختبار',balance:20}]}),supplierCredits:async()=>[],
      rpc:async(name,payload)=>{calls.push({name,payload:structuredClone(payload)});if(failFinance)throw Error('Lost financial reply');return {id:badId?'invalid':recordId,total:1,paid_amount:1,debt_amount:0};},
      receiptOwner:async()=>{if(!calls.length)throw Error('Attachment before financial save');return '22222222-2222-4222-8222-222222222222';},receiptRecord:async target=>{if(target.recordId!==recordId)throw Error('Wrong record');return {value:path};},
      receiptBlob:async()=>{if(object)return object;throw Object.assign(Error('missing'),{status:404});},
      uploadReceiptObject:async(intent,blob)=>{uploads++;assertFinancialJournalGone();if(holdUpload)await new Promise(resolve=>window.releaseUpload=resolve);object=blob;if(failUpload)throw Error('Lost image reply');},
      linkReceipt:async intent=>{links++;path=intent.path;return {value:path};}};
     window.assertFinancialJournalGone=()=>{if(sessionStorage.getItem('sharikx2-pending-purchase:'+projectId))throw Error('Financial journal still present');};
     window.show=()=>openPurchase({api,projectId,mode:'owner',storage:sessionStorage,isCurrent:()=>current,onSaved:()=>saved++});show();
    });
    await page.locator('.purchase-dialog form').waitFor();
   };
   await setup();
   const bytes=Buffer.from(await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=160;c.height=100;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,160,100);x.fillStyle='black';x.fillText('SYNTHETIC',10,30);return [...new Uint8Array(await(await new Promise(resolve=>c.toBlob(resolve,'image/png'))).arrayBuffer())];}));
   const choose=async()=>{await page.locator('[data-image-file]').setInputFiles({name:'<invoice>.png',mimeType:'image/png',buffer:bytes});await page.locator('[data-image-preview] img').waitFor();};
   const prepare=async()=>{await selectPurchaseSupplier(page,'s');await page.locator('[data-add]').click();await openPurchasePayments(page);await page.locator('[data-pay]').click();await page.locator('[data-payamount]').fill('1');};
   const submit=()=>page.locator('.purchase-dialog form').evaluate(node=>node.dispatchEvent(new Event('submit',{cancelable:true})));
   await choose();assert.equal(await page.locator('[data-image-name]').textContent(),'<invoice>.png');assert.equal(await page.evaluate(()=>calls.length+uploads+sessionStorage.length),0);
   assert.equal(await page.locator('[data-image-camera]').getAttribute('capture'),'environment');
   await mkdir(new URL('screenshots/purchase-attachment/',import.meta.url),{recursive:true});
   for(const theme of ['dark','light']){
    await page.evaluate(async theme=>(await import('/theme.js')).createThemeController({document}).set(theme),theme);
    for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.locator('.purchase-dialog').evaluate(node=>node.scrollWidth>node.clientWidth),false);}
    await page.setViewportSize({width:390,height:844});await page.locator('[data-purchase-receipt]').scrollIntoViewIfNeeded();await page.evaluate(async()=>{await document.fonts.ready;await document.querySelector('[data-image-preview] img').decode();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
    await page.screenshot({path:fileURLToPath(new URL(`screenshots/purchase-attachment/${engine}-${theme}.png`,import.meta.url)),timeout:30000});
   }
   await page.locator('[data-image-file]').setInputFiles({name:'bad.heic',mimeType:'image/heic',buffer:Buffer.from('bad')});await page.waitForFunction(()=>document.querySelector('[data-image-error]').textContent.includes('HEIC'));assert.equal(await page.locator('[data-image-preview] img').count(),0);
   await choose();await page.locator('[data-clear-image]').click();assert.equal(await page.locator('[data-image-preview] img').count(),0);await choose();await prepare();await submit();await page.waitForFunction(()=>saved===1);assert.deepEqual(await page.evaluate(()=>[calls.length,uploads,links,sessionStorage.length]),[1,1,1,0]);
   const payload=await page.evaluate(()=>calls[0].payload);assert.equal(payload.p_items[0].unit_cost,1);assert.equal(payload.p_payments[0].amount,1);assert.equal(Object.keys(payload).some(key=>/image|receipt|file/i.test(key)),false);
   // Lost image reply cannot make the already-saved financial operation retry.
   await setup();await choose();await prepare();await page.evaluate(()=>failUpload=true);await submit();await page.waitForFunction(()=>document.querySelector('[data-verify-receipt]')?.hidden===false);assert.deepEqual(await page.evaluate(()=>[calls.length,uploads,links,saved]),[1,1,0,0]);await page.locator('[data-verify-receipt]').click();await page.waitForFunction(()=>document.querySelector('[data-upload-receipt]')?.textContent.includes('تأكيد ربط'));assert.equal(await page.evaluate(()=>calls.length),1);await page.locator('[data-upload-receipt]').click();await page.waitForFunction(()=>saved===1);assert.deepEqual(await page.evaluate(()=>[calls.length,uploads,links]),[1,1,1]);
   // A lost financial reply retains the original ID and selected memory-only file.
   await setup();await choose();await prepare();await page.evaluate(()=>failFinance=true);await submit();await page.waitForFunction(()=>document.querySelector('.purchase-footer [role=alert]').textContent.includes('Lost financial'));assert.equal(await page.evaluate(()=>uploads),0);const captured=await page.evaluate(()=>calls[0]);await page.evaluate(()=>failFinance=false);await submit();await page.waitForFunction(()=>saved===1);assert.deepEqual(await page.evaluate(()=>calls[1]),captured);assert.equal(await page.evaluate(()=>uploads),1);
   // A malformed saved ID is never used as an attachment target; same request recovers.
   await setup();await choose();await prepare();await page.evaluate(()=>badId=true);await submit();await page.waitForFunction(()=>document.querySelector('.purchase-footer [role=alert]').textContent.length>0);assert.deepEqual(await page.evaluate(()=>[uploads,saved]),[0,0]);await page.evaluate(()=>badId=false);await submit();await page.waitForFunction(()=>saved===1);assert.equal(await page.evaluate(()=>calls[0].payload.p_request_id===calls[1].payload.p_request_id),true);
   // Reopening an uncertain financial journal must not invent a restored image.
   await setup();await choose();await prepare();await page.evaluate(()=>failFinance=true);await submit();await page.waitForFunction(()=>document.querySelector('.purchase-footer [role=alert]').textContent.includes('Lost financial'));await page.locator('.purchase-footer [data-close]').click();await page.evaluate(()=>{failFinance=false;show();});await page.locator('.purchase-dialog form').waitFor();assert.equal(await page.locator('[data-image-file]').count(),0);await submit();await page.waitForFunction(()=>saved===1);assert.deepEqual(await page.evaluate(()=>[uploads,links]),[0,0]);assert.equal(await page.evaluate(()=>calls[0].payload.p_request_id===calls[1].payload.p_request_id),true);
   // Drafts never serialize image bytes; replacing a draft clears an old selection.
   await setup();await choose();await prepare();await page.locator('[data-save-purchase-draft]').click();const draft=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('sharikx2-unsent-purchase-v1:'+projectId)));assert.ok(draft);assert.equal(draft.items.length,1);assert.doesNotMatch(JSON.stringify(draft),/invoice|image|receipt|base64/i);await page.locator('[data-resume-purchase-draft]').click();await page.locator('[data-resume-purchase-draft]').click();assert.equal(await page.locator('[data-image-preview] img').count(),0);await submit();await page.waitForFunction(()=>saved===1);assert.equal(await page.evaluate(()=>uploads),0);
   // Decoding is asynchronous: even synthetic submit cannot race a partial selection.
   await setup();await prepare();await page.evaluate(()=>{window.nativeDecode=Image.prototype.decode;Image.prototype.decode=function(){return new Promise(resolve=>window.releaseDecode=resolve);};});await page.locator('[data-image-file]').setInputFiles({name:'wait.png',mimeType:'image/png',buffer:bytes});await page.waitForFunction(()=>typeof releaseDecode==='function');assert.equal(await page.locator('.purchase-footer [type=submit]').isDisabled(),true);await submit();assert.equal(await page.evaluate(()=>calls.length),0);await page.keyboard.press('Escape');await page.evaluate(()=>{Image.prototype.decode=nativeDecode;releaseDecode();});await page.waitForFunction(()=>activeUrls.size===0);
   // No selection remains the original financial-only path; cancellation never writes.
   await setup();await prepare();await submit();await page.waitForFunction(()=>saved===1);assert.deepEqual(await page.evaluate(()=>[calls.length,uploads,links]),[1,0,0]);
   await setup();await choose();await page.locator('.purchase-footer [data-close]').click();assert.equal(await page.evaluate(()=>calls.length+uploads+sessionStorage.length),0);
   // Stale project while attachment is in flight: keep its journal, no link or callback.
   await setup();await choose();await prepare();await page.evaluate(()=>holdUpload=true);await submit();await page.waitForFunction(()=>typeof releaseUpload==='function');await page.keyboard.press('Escape');assert.equal(await page.locator('.receipt-upload-dialog').count(),1);await page.evaluate(()=>{current=false;releaseUpload();});await page.locator('.receipt-upload-dialog').waitFor({state:'detached'});assert.deepEqual(await page.evaluate(()=>[calls.length,uploads,links,saved]),[1,1,0,0]);assert.equal(await page.evaluate(()=>sessionStorage.length),1);
   await page.waitForFunction(()=>activeUrls.size===0);
   assert.deepEqual(errors,[]);console.log(`PASS ${engine}: purchase image selection/preview/remove/invalid formats, dark/light 320/390/1440, financial-before-image ordering, isolated lost image reply, original financial retry, malformed ID recovery, no-image/cancel/stale/busy guards; synthetic backend only`);
  }finally{await browser.close();}
 }
}finally{await preview.close();}
