import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 for(const engine of ['edge','webkit']){
  const browser=await(engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[],committed=new Map();
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
   // Synthetic financial backend survives a real page reload. No live API is used.
   await page.exposeFunction('confirmSyntheticExpense',payload=>{
    if(committed.has(payload.p_request_id))assert.deepEqual(payload,committed.get(payload.p_request_id));
    else committed.set(payload.p_request_id,structuredClone(payload));
    return {id:'33333333-3333-4333-8333-333333333333',account_id:payload.p_account_id,category:payload.p_category,description:payload.p_description,amount:payload.p_amount};
   });
   const setup=async({preserve=false,category='operating_expense'}={})=>{
    if(preserve)await page.reload();else{committed.clear();await page.goto(preview.origin+'/styles.css');}
    await page.setContent('<html lang="ar" dir="rtl"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body><main id="fixture"></main></body></html>');
    await page.evaluate(async({preserve})=>{
     if(!preserve)sessionStorage.clear();
     window.current=true;window.saved=0;window.calls=[];window.uploads=0;window.links=0;window.object=null;window.path=null;window.rejectStatus=0;window.failReply=false;window.failImage=false;window.badResult=null;window.holdWrite=false;window.holdImage=false;window.noopStorage=false;window.failCleanup=false;
     window.projectId='11111111-1111-4111-8111-111111111111';window.key='sharikx2-pending-expense:'+projectId;
     window.accounts=[{id:'44444444-4444-4444-8444-444444444444',name:'نقد اختبار',balance:50.99}];
     window.storage={getItem:key=>sessionStorage.getItem(key),setItem:(name,value)=>{if(!noopStorage)sessionStorage.setItem(name,value);},removeItem:name=>{if(failCleanup&&name===key){if(failCleanup==='noop')return;throw Error('Local cleanup failed');}sessionStorage.removeItem(name);}};
     window.api={summary:async()=>({accounts}),rpc:async(name,payload)=>{
      if(name!=='confirm_sharikx2_expense_web_v1')throw Error('Unexpected financial call');calls.push(structuredClone(payload));
      if(!sessionStorage.getItem(key))throw Error('Missing durable financial journal');
      if(holdWrite)await new Promise(resolve=>window.releaseWrite=resolve);
      if(rejectStatus)throw Object.assign(Error('Rejected by fixture'),{status:rejectStatus});
      const result=await confirmSyntheticExpense(payload);if(failReply)throw Error('Lost financial reply');return {...result,...badResult};
     },receiptOwner:async()=>{if(!calls.length)throw Error('Image before expense');return '22222222-2222-4222-8222-222222222222';},receiptRecord:async()=>({value:path}),
      receiptBlob:async()=>{if(object)return object;throw Object.assign(Error('missing'),{status:404});},
      uploadReceiptObject:async(intent,blob)=>{if(sessionStorage.getItem(key))throw Error('Unresolved financial journal');uploads++;if(holdImage)await new Promise(resolve=>window.releaseImage=resolve);object=blob;if(failImage)throw Error('Lost image reply');},
      linkReceipt:async intent=>{links++;path=intent.path;return {value:path};}};
     const {openExpense}=await import('/expense.js');window.show=()=>openExpense({api,projectId,mode:'owner',container:document.querySelector('#fixture'),storage,isCurrent:()=>current,onSaved:()=>saved++});await show();
    },{preserve});
    if(await page.locator('[data-expense-type]').count())await page.locator(`[data-expense-type="${category}"]`).click();
    await page.locator('.expense-dialog form').waitFor();
   };
   await setup();
   const bytes=Buffer.from(await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=300;c.height=140;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,300,140);x.fillStyle='black';x.font='18px Arial';x.fillText('SYNTHETIC EXPENSE',25,65);return [...new Uint8Array(await(await new Promise(resolve=>c.toBlob(resolve,'image/png'))).arrayBuffer())];}));
   const choose=async()=>{await page.locator('[data-image-file]').setInputFiles({name:'<receipt>.png',mimeType:'image/png',buffer:bytes});await page.locator('[data-image-preview] img').waitFor();};
   const prepare=async()=>{await page.locator('[name=description]').fill('مصروف اختبار');await page.locator('[name=amount]').fill('12.34');};
   const submit=()=>page.locator('.expense-dialog form').evaluate(node=>node.dispatchEvent(new Event('submit',{cancelable:true})));
   const verifyFinancialError=()=>page.waitForFunction(()=>document.querySelector('.form-error')?.textContent.length>0);
   await choose();assert.equal(await page.evaluate(()=>calls.length+uploads+sessionStorage.length),0);assert.equal(await page.locator('[data-image-name]').textContent(),'<receipt>.png');assert.equal(await page.locator('[data-image-camera]').getAttribute('capture'),'environment');
   await prepare();assert.match(await page.locator('[data-left]').textContent(),/38\.65/);
   await mkdir(new URL('screenshots/expense-attachment/',import.meta.url),{recursive:true});
   for(const theme of ['dark','light']){
    await page.evaluate(async theme=>(await import('/theme.js')).createThemeController({document}).set(theme),theme);
    for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.locator('.expense-dialog').evaluate(node=>node.scrollWidth>node.clientWidth),false);}
    await page.setViewportSize({width:390,height:844});await page.locator('[data-expense-receipt]').scrollIntoViewIfNeeded();await page.evaluate(async()=>{await document.fonts.ready;await document.querySelector('[data-image-preview] img').decode();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});await page.screenshot({path:fileURLToPath(new URL(`screenshots/expense-attachment/${engine}-${theme}.png`,import.meta.url)),timeout:30000});
   }
   for(const selector of ['.expense-body [type=submit]','.close-expense']){await page.locator(selector).scrollIntoViewIfNeeded();const box=await page.locator(selector).boundingBox();assert.ok(box.y>=0&&box.y+box.height<=845,'confirmation/cancel must remain reachable after preview');}
   await page.locator('[data-image-file]').setInputFiles({name:'bad.heic',mimeType:'image/heic',buffer:Buffer.from('bad')});await page.waitForFunction(()=>document.querySelector('[data-image-error]').textContent.includes('HEIC'));assert.equal(await page.locator('[data-image-preview] img').count(),0);await choose();await page.locator('[data-clear-image]').click();assert.equal(await page.locator('[data-image-preview] img').count(),0);await choose();
   // One financial write, then one image attempt. Both waits lock Escape/double submit.
   await page.evaluate(()=>{holdWrite=true;holdImage=true;});await submit();await page.waitForFunction(()=>typeof releaseWrite==='function');await submit();await page.keyboard.press('Escape');assert.equal(await page.locator('.expense-dialog').count(),1);assert.equal(await page.evaluate(()=>calls.length),1);assert.equal(await page.evaluate(()=>uploads),0);await page.evaluate(()=>{holdWrite=false;releaseWrite();});await page.waitForFunction(()=>typeof releaseImage==='function');assert.equal(committed.size,1);assert.equal(await page.evaluate(()=>sessionStorage.getItem(key)),null);await page.keyboard.press('Escape');assert.equal(await page.locator('.receipt-upload-dialog').count(),1);assert.match(await page.locator('[data-close-upload]').textContent(),/المصروف محفوظ/);await page.evaluate(()=>{holdImage=false;releaseImage();});await page.waitForFunction(()=>saved===1);assert.deepEqual(await page.evaluate(()=>[calls.length,uploads,links,sessionStorage.length]),[1,1,1,0]);assert.equal(Object.keys([...committed.values()][0]).some(key=>/receipt|image|file/i.test(key)),false);
   // Wage category uses the same exact amount and its native category, not a sale.
   await setup({category:'daily_wage'});await choose();await prepare();await submit();await page.waitForFunction(()=>saved===1);assert.equal([...committed.values()][0].p_category,'daily_wage');assert.equal([...committed.values()][0].p_amount,12.34);
   // Missing image reply resolves by reading and linking only, never re-expensing.
   await setup();await choose();await prepare();await page.evaluate(()=>failImage=true);await submit();await page.waitForFunction(()=>document.querySelector('[data-verify-receipt]')?.hidden===false);assert.equal(committed.size,1);await page.locator('[data-verify-receipt]').click();await page.waitForFunction(()=>document.querySelector('[data-upload-receipt]').textContent.includes('تأكيد ربط'));await page.locator('[data-upload-receipt]').click();await page.waitForFunction(()=>saved===1);assert.deepEqual(await page.evaluate(()=>[calls.length,uploads,links]),[1,1,1]);
   // Unknown finance followed by 401 must preserve its original ID, not unlock a new expense.
   await setup();await choose();await prepare();await page.evaluate(()=>failReply=true);await submit();await verifyFinancialError();const original=await page.evaluate(()=>calls[0]);await page.evaluate(()=>{failReply=false;rejectStatus=401;});await submit();await page.waitForFunction(()=>calls.length===2);await verifyFinancialError();assert.equal(await page.locator('fieldset').evaluate(node=>node.disabled),true);assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem(key)).requestId),original.p_request_id);await page.evaluate(()=>rejectStatus=0);await submit();await page.waitForFunction(()=>saved===1);assert.equal(committed.size,1);assert.deepEqual(await page.evaluate(()=>calls[2]),original);
   // Malformed response is not accepted even without selecting an image.
   for(const bad of [{id:'wrong'},{amount:12.35},{account_id:'foreign'},{description:'changed'},{category:'other'}]){
    await setup();await prepare();await page.evaluate(bad=>badResult=bad,bad);await submit();await verifyFinancialError();assert.equal(await page.evaluate(()=>saved+uploads),0);const original=await page.evaluate(()=>calls[0]);await page.evaluate(()=>badResult=null);await submit();await page.waitForFunction(()=>saved===1);assert.deepEqual(await page.evaluate(()=>calls[1]),original);assert.equal(committed.size,1);
   }
   // Cleanup failure reuses the cached confirmed result, with no second RPC or financial write.
   await setup();await choose();await prepare();await page.evaluate(()=>failCleanup=true);await submit();await verifyFinancialError();assert.match(await page.locator('.form-error').textContent(),/تأكد حفظ المصروف/);assert.equal(await page.evaluate(()=>uploads),0);await page.evaluate(()=>failCleanup=false);await submit();await page.waitForFunction(()=>saved===1);assert.equal(await page.evaluate(()=>calls.length),1);assert.equal(committed.size,1);
   await setup();await choose();await prepare();await page.evaluate(()=>failCleanup='noop');await submit();await verifyFinancialError();assert.equal(await page.evaluate(()=>saved+uploads),0);await page.evaluate(()=>failCleanup=false);await submit();await page.waitForFunction(()=>saved===1);assert.equal(await page.evaluate(()=>calls.length),1);
   // A first explicit server rejection may edit again, but cleanup failure never drops its identity.
   await setup();await prepare();await page.evaluate(()=>{rejectStatus=400;failCleanup=true;});await submit();await verifyFinancialError();assert.equal(committed.size,0);assert.equal(await page.locator('fieldset').evaluate(node=>node.disabled),true);const rejected=await page.evaluate(()=>calls[0]);await page.evaluate(()=>{rejectStatus=0;failCleanup=false;});await submit();await page.waitForFunction(()=>saved===1);assert.deepEqual(await page.evaluate(()=>calls[1]),rejected);
   await setup();await prepare();await page.evaluate(()=>rejectStatus=400);await submit();await verifyFinancialError();assert.equal(await page.locator('fieldset').evaluate(node=>node.disabled),false);assert.equal(await page.evaluate(()=>sessionStorage.getItem(key)),null);const firstRejected=await page.evaluate(()=>calls[0].p_request_id);await page.evaluate(()=>rejectStatus=0);await page.locator('[name=amount]').fill('12.35');await submit();await page.waitForFunction(()=>saved===1);assert.equal(committed.size,1);assert.notEqual(await page.evaluate(()=>calls[1].p_request_id),firstRejected);
   // Real reload preserves financial identity, but cannot restore memory-only image bytes.
   await setup();await choose();await prepare();await page.evaluate(()=>failReply=true);await submit();await verifyFinancialError();const beforeReload=await page.evaluate(()=>calls[0]);await setup({preserve:true});assert.equal(await page.locator('[data-image-file]').count(),0);await submit();await page.waitForFunction(()=>saved===1);assert.deepEqual(await page.evaluate(()=>calls[0]),beforeReload);assert.equal(committed.size,1);assert.equal(await page.evaluate(()=>uploads),0);
   // Non-durable storage fails before dispatch; absent accounts stay non-submittable.
   await setup();await prepare();await page.evaluate(()=>noopStorage=true);await submit();await verifyFinancialError();assert.equal(await page.evaluate(()=>calls.length),0);assert.equal(committed.size,0);
   await setup();await page.locator('.close-expense').click();await page.evaluate(()=>{accounts=[];return show();});await page.locator('[data-expense-type="operating_expense"]').click();await choose();assert.equal(await page.locator('.expense-body [type=submit]').isDisabled(),true);await submit();assert.equal(await page.evaluate(()=>calls.length+uploads),0);
   // Decode cancellation and project drift suppress late callbacks and object linking.
   await setup();await prepare();await page.evaluate(()=>{window.nativeDecode=Image.prototype.decode;Image.prototype.decode=function(){return new Promise(resolve=>window.releaseDecode=resolve);};});await page.locator('[data-image-file]').setInputFiles({name:'wait.png',mimeType:'image/png',buffer:bytes});await page.waitForFunction(()=>typeof releaseDecode==='function');await submit();assert.equal(await page.evaluate(()=>calls.length),0);await page.keyboard.press('Escape');await page.evaluate(()=>{Image.prototype.decode=nativeDecode;releaseDecode();});
   await setup();await choose();await prepare();await page.evaluate(()=>holdImage=true);await submit();await page.waitForFunction(()=>typeof releaseImage==='function');await page.evaluate(()=>{current=false;releaseImage();});await page.locator('.receipt-upload-dialog').waitFor({state:'detached'});assert.deepEqual(await page.evaluate(()=>[uploads,links,saved]),[1,0,0]);assert.equal(await page.evaluate(()=>sessionStorage.length),1);
   assert.deepEqual(errors,[]);console.log(`PASS ${engine}: expense/wage in-form receipts, exact native acknowledgement, financial-before-image, original ID after unknown/401/malformed replies and actual reload, durable-journal/cleanup/busy/stale/empty-account guards, synthetic one-write backend, RTL themes and decode cancellation; no live data`);
  }finally{await browser.close();}
 }
}finally{await preview.close();}
