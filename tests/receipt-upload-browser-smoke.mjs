import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
import {supplierHistoryFixture} from './supplier-history-fixtures.mjs';
const require=createRequire(import.meta.url),{chromium,webkit}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const projectId='11111111-1111-4111-8111-111111111111',recordId='33333333-3333-4333-8333-333333333333',userId='22222222-2222-4222-8222-222222222222';
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 for(const engine of ['edge','webkit']){
  const browser=await (engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[],requests=[],objects=new Map();let record=null,posts=0,patches=0,fail='',releaseUpload=null,held=false;
   page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
   await page.route('https://receipt-upload-fixture.invalid/**',async route=>{
    const request=route.request(),url=new URL(request.url()),method=request.method();requests.push({path:url.pathname,method});
    const headers={'Access-Control-Allow-Origin':preview.origin,'Access-Control-Allow-Headers':'apikey,authorization,content-type,prefer','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'};
    const json=(body,status=200)=>route.fulfill({status,headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(method==='OPTIONS')return route.fulfill({status:204,headers});
    assert.equal(request.headers().authorization,'Bearer fixture-token');
    if(url.pathname==='/auth/v1/user')return json({id:userId});
    if(url.pathname.startsWith('/rest/v1/sharikx2_')){
     assert.ok(['/rest/v1/sharikx2_expenses','/rest/v1/sharikx2_purchases','/rest/v1/sharikx2_supplier_payments','/rest/v1/sharikx2_supplier_old_debts'].includes(url.pathname));
     assert.equal(url.searchParams.get('project_id'),'eq.'+projectId);assert.equal(url.searchParams.get('id'),'eq.'+recordId);
     const field=url.pathname.endsWith('supplier_payments')?'reference':'receipt_path';
     if(method==='PATCH'){
      const payload=request.postDataJSON();assert.deepEqual(Object.keys(payload),[field]);assert.equal(url.searchParams.get(field),record===null?'is.null':'eq.');
      patches++;record=payload[field];if(fail==='linkLost'){fail='';return route.abort('failed');}
     }else assert.equal(method,'GET');
     return json([{id:recordId,project_id:projectId,[field]:record,status:'paid',payment_kind:'cash'}]);
    }
    const prefix='/storage/v1/object/payment-receipts/',read='/storage/v1/object/authenticated/payment-receipts/';
    if(method==='POST'&&url.pathname.startsWith(prefix)){
     posts++;const path=url.pathname.slice(prefix.length);assert.ok(path.startsWith(userId+'/'+projectId+'/'));assert.equal(request.headers()['x-upsert'],undefined);
     if(held)await new Promise(resolve=>{releaseUpload=resolve;});
     // Windows WebKit does not expose Blob POST bodies through Playwright's
     // request.postDataBuffer. In that engine only, inspect the exact Blob
     // supplied to the real fetch call; this is not wire/server byte validation.
     let bytes=request.postDataBuffer();if(!bytes){assert.equal(engine,'webkit');bytes=Buffer.from(await page.evaluate(()=>capturedUpload));}assert.ok(bytes.length>0);objects.set(path,bytes);
     if(fail==='uploadLost'){fail='';return route.abort('failed');}return json({Key:'payment-receipts/'+path});
    }
    if(method==='GET'&&url.pathname.startsWith(read)){
     const bytes=objects.get(url.pathname.slice(read.length));return bytes?route.fulfill({status:200,headers:{...headers,'Content-Type':'image/png'},body:bytes}):json({error:'missing'},404);
    }
    throw Error('Unexpected request '+method+' '+url.pathname);
   });
   const setup=async(reload=false)=>{
    if(reload)await page.reload();else await page.goto(preview.origin+'/styles.css');
    await page.setContent('<html lang="ar" dir="rtl"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body><main id="app"></main></body></html>');
    await page.evaluate(async({projectId,recordId})=>{
     const {Api}=await import('/api.js'),{openReceiptUpload}=await import('/receipt-upload-ui.js');
     window.target={projectId,recordId,kind:'expense'};window.current=true;window.linked=0;window.gates=0;window.deviceAllowed=true;
     window.api=new Api({url:'https://receipt-upload-fixture.invalid',publicKey:'public-fixture'},sessionStorage);api.deviceContext={projectId,mode:'owner'};api.session=async()=>'fixture-token';api.assertDeviceWrite=async()=>{gates++;if(!deviceAllowed)throw Error('التحكم على جهاز آخر');};
     const nativeFetch=window.fetch.bind(window);window.fetch=(url,options)=>{if(String(url).includes('/storage/v1/object/payment-receipts/')&&options?.method==='POST')window.capturedUpload=options.body.arrayBuffer().then(buffer=>Array.from(new Uint8Array(buffer)));return nativeFetch(url,options);};
     window.show=(kind='expense')=>openReceiptUpload({api,target:{...target,kind},mode:'owner',storage:sessionStorage,isCurrent:()=>current,onLinked:()=>linked++});
    },{projectId,recordId});
   };
   await setup();
   const bytes=Buffer.from(await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=600;c.height=400;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,600,400);x.fillStyle='black';x.font='25px Arial';x.fillText('LOCAL RECEIPT UPLOAD TEST',25,70);return Array.from(new Uint8Array(await (await new Promise(resolve=>c.toBlob(resolve,'image/png'))).arrayBuffer()));}));
   const choose=async()=>{await page.locator('[data-receipt-file]').setInputFiles({name:'invoice.png',mimeType:'image/png',buffer:bytes});await page.locator('[data-receipt-preview] img').waitFor();};
   const close=async()=>{await page.locator('[data-close-upload]').click();await page.locator('.receipt-upload-dialog').waitFor({state:'detached'});};
   await page.evaluate(()=>show());assert.equal(await page.locator('[data-receipt-camera]').getAttribute('capture'),'environment');assert.equal(await page.locator('[data-upload-receipt]').isDisabled(),true);
   await page.locator('[data-receipt-file]').setInputFiles({name:'bad.heic',mimeType:'image/heic',buffer:Buffer.from('bad')});await page.waitForFunction(()=>document.querySelector('.receipt-upload-dialog [role=alert]').textContent.includes('JPEG'));assert.equal(posts,0);
   await choose();assert.equal(await page.locator('[data-upload-receipt]').isDisabled(),false);
   await mkdir(new URL('screenshots/receipt-upload/',import.meta.url),{recursive:true});
   for(const theme of ['dark','light']){
    await page.evaluate(async theme=>{(await import('/theme.js')).createThemeController({document}).set(theme);},theme);
    for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.locator('.receipt-upload-dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false);}
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:fileURLToPath(new URL(`screenshots/receipt-upload/${engine}-${theme}.png`,import.meta.url)),timeout:30000});
   }
   // Busy/double-click guards, persisted identity before a held upload and one link.
   held=true;await page.locator('[data-upload-receipt]').click();await page.waitForFunction(()=>!!sessionStorage.getItem('sharikx2-pending-receipt:v1:'+target.projectId+':expense:'+target.recordId));
   for(let attempt=0;!releaseUpload&&attempt<120;attempt++)await page.waitForTimeout(50);assert.ok(releaseUpload,'upload did not reach the intercepted server');
   await page.evaluate(()=>document.querySelector('[data-upload-receipt]').click());await page.keyboard.press('Escape');assert.equal(await page.locator('.receipt-upload-dialog').count(),1);assert.equal(posts,1);
   held=false;releaseUpload();releaseUpload=null;await page.waitForFunction(()=>linked===1);assert.equal(patches,1);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
   // Real reload after a lost upload: no file is retained, original path is verified,
   // then explicit metadata linking happens without a second object POST.
   record=null;fail='uploadLost';await page.evaluate(()=>show());await choose();await page.locator('[data-upload-receipt]').click();await page.locator('[data-verify-receipt]').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('[data-verify-receipt]').disabled);
   const original=await page.evaluate(()=>sessionStorage.getItem('sharikx2-pending-receipt:v1:'+target.projectId+':expense:'+target.recordId));await close();await setup(true);await page.evaluate(()=>show());assert.equal(await page.locator('[data-upload-receipt]').isDisabled(),true);
   const before={posts,patches};await page.locator('[data-verify-receipt]').click();await page.waitForFunction(()=>document.querySelector('[data-upload-status]').textContent.includes('الصورة موجودة'));
   assert.equal(posts,before.posts);assert.equal(patches,before.patches);assert.equal(await page.evaluate(()=>sessionStorage.getItem('sharikx2-pending-receipt:v1:'+target.projectId+':expense:'+target.recordId)),original);
   await page.locator('[data-upload-receipt]').click();await page.waitForFunction(()=>linked===1);assert.equal(posts,before.posts);assert.equal(patches,before.patches+1);assert.equal(record,JSON.parse(original).path);
   // Lost PATCH acknowledgement resolves by reads across another actual reload.
   record=null;fail='linkLost';await page.evaluate(()=>show());await choose();await page.locator('[data-upload-receipt]').click();await page.locator('[data-verify-receipt]').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('[data-verify-receipt]').disabled);await close();await setup(true);await page.evaluate(()=>show());
   const beforeRecovery={posts,patches};await page.locator('[data-verify-receipt]').click();await page.waitForFunction(()=>linked===1);assert.deepEqual({posts,patches},beforeRecovery);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
   // A blocked controlling device cannot write; read-only verification does not renew it.
   record=null;await page.evaluate(()=>{deviceAllowed=false;show();});await choose();await page.locator('[data-upload-receipt]').click();await page.locator('[data-verify-receipt]').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('[data-verify-receipt]').disabled);const noWrite={posts,patches};const gates=await page.evaluate(()=>gates);
   await page.locator('[data-verify-receipt]').click();await page.waitForFunction(()=>document.querySelector('[data-upload-status]').textContent.includes('لم تظهر'));assert.equal(await page.evaluate(()=>gates),gates);assert.deepEqual({posts,patches},noWrite);await close();await page.evaluate(()=>sessionStorage.clear());
   // All native metadata types remain separate from financial confirmations.
   await page.evaluate(()=>deviceAllowed=true);
   for(const kind of ['purchase','payment','old_debt']){record=null;await page.evaluate(kind=>show(kind),kind);await choose();const count=await page.evaluate(()=>linked);await page.locator('[data-upload-receipt]').click();await page.waitForFunction(count=>linked===count+1,count);}
   // Actual expense details exposes owner attachment but not viewer writes.
   record=null;await page.evaluate(async()=>{window.saved=0;const {openExpenseDetails}=await import('/expense-details-ui.js');window.showExpense=mode=>openExpenseDetails({api,projectId:target.projectId,item:{id:target.recordId,project_id:target.projectId,amount:1.25,description:'اختبار',receipt_path:null},mode,storage:sessionStorage,isCurrent:()=>current,onSaved:()=>saved++});showExpense('viewer');});
   assert.equal(await page.locator('[data-attach-receipt]').count(),0);await page.locator('.expense-details-dialog [data-close]').click();await page.evaluate(()=>showExpense('owner'));await page.locator('[data-attach-receipt]').click();await choose();await page.locator('[data-upload-receipt]').click();await page.waitForFunction(()=>saved===1);assert.equal(await page.locator('.expense-details-dialog').count(),0);
   // Actual supplier action/child lock/refresh preserves the financial snapshot.
   record=null;await page.evaluate(async fixture=>{
    window.supplierSource=JSON.parse(JSON.stringify(fixture).replaceAll('"pr"',JSON.stringify(target.projectId)).replaceAll('"a"',JSON.stringify(target.recordId)));window.originalSupplier=JSON.stringify(supplierSource);window.supplierSaved=0;
    api.supplierHistory=async()=>structuredClone(supplierSource);api.supplierRefundHistory=async()=>[];
    const {openSupplierAccount}=await import('/supplier-account-ui.js');await openSupplierAccount({api,projectId:target.projectId,container:document.querySelector('#app'),person:supplierSource.supplier,mode:'owner',storage:sessionStorage,isCurrent:()=>current,onSaved:()=>supplierSaved++});
   },supplierHistoryFixture());
   await page.locator('[data-supplier-movement=purchase] [data-attach-receipt]').first().click();await choose();await page.locator('[data-upload-receipt]').click();await page.waitForFunction(()=>supplierSaved===1);
   assert.equal(await page.locator('.supplier-account-page').count(),0);assert.equal(await page.evaluate(()=>JSON.stringify(supplierSource)===originalSupplier),true);
   assert.equal(await page.evaluate(()=>sessionStorage.length),0);assert.equal(requests.some(request=>request.path.includes('/rpc/')),false);assert.deepEqual(errors,[]);
   console.log(`PASS ${engine}: actual upload/read/hash/conditional-link transport, owner/device guards, immutable journal across real reload/lost upload/lost PATCH, read-only verification, no financial RPCs, expense integration, four record types, rejected HEIC and responsive themes (intercepted server, not live data)`);
  }finally{await browser.close();}
 }
}finally{await preview.close();}
