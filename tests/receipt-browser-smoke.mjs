import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
import {supplierHistoryFixture} from './supplier-history-fixtures.mjs';
const require=createRequire(import.meta.url),{chromium,webkit}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 for(const engine of ['edge','webkit']){
  const browser=await (engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block',acceptDownloads:true}),errors=[];
   page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
   await page.goto(preview.origin+'/styles.css');await page.setContent('<html lang="ar" dir="rtl"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body><main id="app"></main></body></html>');
   await page.evaluate(async()=>{
    const {openReceipt}=await import('/receipt-ui.js'),{receiptError}=await import('/receipt.js');
    window.projectId='11111111-1111-4111-8111-111111111111';window.userId='22222222-2222-4222-8222-222222222222';
    window.pathFor=kind=>`${userId}/${projectId}/${({purchase:'purchase-invoices',expense:'expenses',payment:'supplier-payments',old_debt:'supplier-old-debts'})[kind]}/1720000000.png`;
    const canvas=document.createElement('canvas');canvas.width=600;canvas.height=300;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,600,300);ctx.fillStyle='black';ctx.font='25px Arial';ctx.fillText('LOCAL RECEIPT TEST FIXTURE',35,70);ctx.fillText('SharikX2 125.75',35,130);window.image=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    window.current=true;window.hold=false;window.fail=false;window.corrupt=false;window.calls=[];window.writes=0;window.created=[];window.revoked=[];
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});
    const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);created.push(url);return url;};URL.revokeObjectURL=url=>{revoked.push(url);revoke(url);};
    window.api={receiptBlob:async options=>{calls.push({kind:options.kind,path:options.path});if(hold)return new Promise(resolve=>window.release=()=>resolve(image));if(fail)throw receiptError('RECEIPT_ACCESS_FAILED','الخادم لا يسمح لهذا الحساب بقراءة الصورة. قد تكون مرفوعة من حساب Android آخر.',403);return corrupt?new Blob(['<svg/>'],{type:'image/png'}):image;},request:async()=>{writes++;throw Error('Writes forbidden');}};
    window.show=(kind='expense',path=pathFor(kind),container=document.body)=>openReceipt({api,projectId,kind,path,container,isCurrent:()=>current});
   });
   // A closed reader must not create a private object URL for a late response.
   await page.evaluate(()=>{hold=true;show();show();});assert.equal(await page.locator('.receipt-dialog').count(),1);
   await page.keyboard.press('Escape');await page.locator('.receipt-dialog').waitFor({state:'detached'});await page.evaluate(()=>release());
   await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>created.length),0);
   await page.evaluate(()=>{hold=false;fail=true;show();});await page.locator('[data-receipt-retry]').waitFor({state:'visible'});
   assert.match(await page.locator('.receipt-dialog [role=alert]').innerText(),/Android/);assert.equal(await page.locator('.receipt-dialog img').count(),0);
   const beforeRetry=await page.evaluate(()=>calls.length);await page.evaluate(()=>{fail=false;hold=true;document.querySelector('[data-receipt-retry]').click();document.querySelector('[data-receipt-retry]').click();});
   assert.equal(await page.evaluate(()=>calls.length),beforeRetry+1);await page.evaluate(()=>{hold=false;release();});await page.locator('.receipt-dialog img').waitFor();
   assert.equal(await page.locator('[data-receipt-share]').isHidden(),true);
   const downloaded=page.waitForEvent('download');await page.locator('[data-receipt-download]').click();assert.equal((await downloaded).suggestedFilename(),'SharikX2-expenses.png');
   await mkdir(new URL('screenshots/receipts/',import.meta.url),{recursive:true});
   for(const theme of ['dark','light']){
    await page.evaluate(async theme=>{const {createThemeController}=await import('/theme.js');createThemeController({document}).set(theme);},theme);
    for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.locator('.receipt-dialog').evaluate(node=>node.scrollWidth>node.clientWidth),false);}
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:fileURLToPath(new URL(`screenshots/receipts/${engine}-${theme}.png`,import.meta.url))});
   }
   await page.locator('[data-receipt-close]').click();await page.waitForFunction(()=>revoked.length===created.length);
   // Sharing is invoked from the actual click, with a File, never a token/path URL.
   await page.evaluate(()=>{
    window.shares=[];Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{shares.push({name:data.files[0].name,type:data.files[0].type,size:data.files[0].size});}});show('purchase');
   });
   await page.locator('[data-receipt-share]').waitFor({state:'visible'});await page.locator('[data-receipt-share]').click();assert.equal(await page.evaluate(()=>shares[0].name),'SharikX2-purchase-invoices.png');
   await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('Cancelled','AbortError');}}));await page.locator('[data-receipt-share]').click();assert.equal(await page.locator('.receipt-dialog [role=alert]').innerText(),'');
   await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw Error('not supported');}}));await page.locator('[data-receipt-share]').click();assert.match(await page.locator('.receipt-dialog [role=alert]').innerText(),/تعذرت المشاركة/);assert.equal(await page.locator('[data-receipt-download]').isVisible(),true);
   await page.evaluate(()=>{current=false;document.body.append(document.createElement('span'));});await page.locator('.receipt-dialog').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>revoked.length===created.length),true);
   // Foreign/raw URL references and malformed images cannot make an image request.
   const count=await page.evaluate(()=>calls.length);await page.evaluate(()=>{current=true;show('expense','https://evil.invalid/image.png');});await page.locator('[data-receipt-retry]').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>calls.length),count);
   await page.locator('[data-receipt-close]').click();await page.evaluate(()=>{corrupt=true;show();});await page.locator('[data-receipt-retry]').waitFor({state:'visible'});assert.equal(await page.locator('.receipt-dialog img').count(),0);await page.locator('[data-receipt-close]').click();
   // Expense list and cashier activity use the same details/viewer without writes.
   await page.evaluate(async()=>{
    // Activity defaults to today's Palestine day; a fixed calendar date made
    // this viewer integration test silently expire on the following day.
    window.corrupt=false;window.expense={id:'e1',project_id:projectId,description:'مصروف اختبار <img src=x>',category:'operating_expense',amount:1.25,created_at:new Date().toISOString(),account:{name:'نقد'},receipt_path:pathFor('expense')};
    api.rows=async()=>[expense];api.allRows=async kind=>kind==='expenses'?[expense]:[];
    const {renderExpenses}=await import('/expense.js');await renderExpenses({api,projectId,container:document.querySelector('#app'),mode:'viewer',isCurrent:()=>current});
   });
   await page.locator('[data-expense=e1]').click();assert.equal(await page.locator('.expense-details-dialog [data-edit]').count(),0);assert.equal(await page.locator('.expense-details-dialog img').count(),0);
   await page.locator('.expense-details-dialog [data-open-receipt]').click();await page.locator('.receipt-dialog img').waitFor();await page.locator('[data-receipt-close]').click();await page.locator('.expense-details-dialog [data-close]').click();
   await page.evaluate(async()=>{document.querySelector('#app').replaceChildren();const {renderActivity}=await import('/activity.js');await renderActivity({api,projectId,container:document.querySelector('#app'),mode:'viewer',isCurrent:()=>current});});
   await page.locator('.activity-record').click();await page.locator('[data-open-receipt]').click();await page.locator('.receipt-dialog img').waitFor();
   await page.evaluate(()=>document.querySelector('.expense-details-dialog').remove());await page.locator('.receipt-dialog').waitFor({state:'detached'});
   // Actual supplier timeline: invoice, cash payment and old-debt attachments.
   await page.evaluate(async fixture=>{
    window.source=JSON.parse(JSON.stringify(fixture).replaceAll('"pr"',JSON.stringify(projectId)));
    source.purchases[0].receipt_path=pathFor('purchase');source.payments[0].reference=pathFor('payment');source.old_debts[0].receipt_path=pathFor('old_debt');window.original=JSON.stringify(source);
    api.supplierHistory=async()=>structuredClone(source);api.supplierRefundHistory=async()=>[];
    const {openSupplierAccount}=await import('/supplier-account-ui.js');await openSupplierAccount({api,projectId,container:document.querySelector('#app'),person:source.supplier,mode:'viewer',isCurrent:()=>current});
   },supplierHistoryFixture());
   assert.equal(await page.locator('.supplier-account-page [data-open-receipt]').count(),3);
   for(const kind of ['purchase','payment','old_debt']){
    await page.locator(`[data-supplier-movement=${kind}] [data-open-receipt]`).first().click();await page.locator('.receipt-dialog img').waitFor();assert.equal(await page.evaluate(()=>calls.at(-1).kind),kind);await page.locator('[data-receipt-close]').click();
   }
   assert.equal(await page.evaluate(()=>JSON.stringify(source)===original),true);assert.equal(await page.evaluate(()=>writes),0);assert.equal(await page.evaluate(()=>revoked.length===created.length),true);assert.deepEqual(errors,[]);
   await page.locator('.supplier-account-page [data-close]').click();
   // Exercise the actual authenticated fetch/blob transport in the browser too.
   // HTTPS is intercepted locally; this is not Supabase or a production receipt.
   const imageBytes=Buffer.from(await page.evaluate(async()=>Array.from(new Uint8Array(await image.arrayBuffer())))),network=[];let responseStatus=200;
   await page.route('https://receipt-fixture.invalid/**',async route=>{
    const request=route.request();network.push({url:request.url(),method:request.method(),headers:request.headers()});
    const headers={'Access-Control-Allow-Origin':preview.origin,'Access-Control-Allow-Headers':'apikey,authorization','Access-Control-Allow-Methods':'GET,OPTIONS','Cache-Control':'no-store'};
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
    return route.fulfill({status:responseStatus,headers:{...headers,'Content-Type':responseStatus===200?'image/png':'application/json'},body:responseStatus===200?imageBytes:'{"message":"denied"}'});
   });
   await page.evaluate(async()=>{const {Api}=await import('/api.js');window.api=new Api({url:'https://receipt-fixture.invalid',publicKey:'public-fixture'});api.session=async()=>'private-fixture-token';show();});
   await page.locator('.receipt-dialog img').waitFor();const get=network.find(request=>request.method==='GET');assert.equal(get.headers.authorization,'Bearer private-fixture-token');assert.equal(get.url.includes('private-fixture-token'),false);assert.ok(get.url.includes('/storage/v1/object/authenticated/payment-receipts/'));
   assert.match(await page.locator('.receipt-dialog img').getAttribute('src'),/^blob:/);await page.locator('[data-receipt-close]').click();
   responseStatus=403;await page.evaluate(()=>show());await page.locator('[data-receipt-retry]').waitFor({state:'visible'});assert.match(await page.locator('.receipt-dialog [role=alert]').innerText(),/لا يسمح/);assert.equal(await page.locator('.receipt-dialog img').count(),0);await page.locator('[data-receipt-close]').click();
   assert.equal(network.filter(request=>request.method==='GET').length,2);assert.ok(network.every(request=>['GET','OPTIONS'].includes(request.method)));assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.deepEqual(errors,[]);
   console.log(`PASS ${engine}: private receipt viewer/retry/cleanup, safe scope/types, download/file-share, expense and supplier integration, source/no-write guards, RTL mobile/desktop and both themes (synthetic images, no live data)`);
  }finally{await browser.close();}
 }
}finally{await preview.close();}
