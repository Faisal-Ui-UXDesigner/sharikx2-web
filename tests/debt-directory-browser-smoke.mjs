import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:393,height:874},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl" lang="ar"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body><main id="app"></main></body></html>');
 await page.evaluate(async()=>{
  const {appShellMarkup}=await import('/app-shell-ui.js'),{renderDebtDirectory}=await import('/debt-directory-ui.js');
  window.current=true;window.calls=[];window.fail=false;window.hold=false;window.kind='customers';window.mode='owner';window.paymentHeld=false;
  window.source={customer_debt:999,supplier_debt:999,customers:[{id:'customer',name:'فيصل',phone:'0591234567',calculated_debt:12.345},{id:'settled',name:'مسدد <img src=x>',phone:null,calculated_debt:0},...Array.from({length:44},(_,i)=>({id:'c'+i,name:'زبون '+i,phone:'0597654321',calculated_debt:1}))],suppliers:[{id:'credit',name:'مورد برصيد دائن',phone:'0591234567',calculated_debt:0,available_supplier_credit:7.25,created_at:'2026-10-14'},{id:'debt',name:'مورد مديون',phone:'0591234567',calculated_debt:100,available_supplier_credit:2,created_at:'2026-10-13'},{id:'settled',name:'مورد مسدد',phone:null,calculated_debt:0,created_at:'2026-10-12'}]};window.original=JSON.stringify(source);
  window.mount=()=>{app.innerHTML=appShellMarkup({project:{id:'fixture',name:'مشروع',subscription_status:'free'},mode,screen:kind});};
  window.show=()=>renderDebtDirectory({container:document.querySelector('#content'),kind,mode,isCurrent:()=>current,loadSnapshot:async()=>{const data=structuredClone(source);if(hold){hold=false;window.started=true;await new Promise(resolve=>window.release=resolve);}if(fail)throw null;return data;},onBack:()=>calls.push('back'),onOpen:person=>{calls.push('open:'+person.id);person.name='changed';},onAdd:()=>calls.push('add'),onPurchase:()=>calls.push('purchase'),onEdit:person=>calls.push('edit:'+person.id),onArchive:person=>calls.push('archive:'+person.id),onPayment:async person=>{calls.push('pay:'+person.id);if(paymentHeld)await new Promise(resolve=>window.releasePayment=resolve);}});
  mount();await show();
 });
 assert.equal(await page.locator('.app-header').isVisible(),false);assert.equal(await page.locator('nav').isVisible(),false);
 assert.equal(await page.locator('[data-person]').count(),20);assert.match(await page.locator('[data-debt-summary]').innerText(),/56\.35/);
 assert.equal(await page.locator('[data-person]').first().evaluate(node=>getComputedStyle(node).paddingTop),'0px');
 await page.locator('#more').click();assert.equal(await page.locator('[data-person]').count(),40);await page.locator('#more').click();assert.equal(await page.locator('[data-person]').count(),45);
 await page.locator('#search').fill('059 123');assert.equal(await page.locator('[data-person]').count(),1);assert.match(await page.locator('[data-debt-summary]').innerText(),/56\.35/);
 await page.locator('[data-open-person]').focus();await page.keyboard.press('Enter');assert.deepEqual(await page.evaluate(()=>calls),['open:customer']);
 assert.equal(await page.locator('[data-edit-customer]').isVisible(),false);await page.locator('[data-person-actions]').click();await page.locator('[data-edit-customer]').click();
 assert.equal(await page.locator('[data-contact-call]').getAttribute('href'),'tel:0591234567');
 await page.evaluate(()=>paymentHeld=true);await page.locator('[data-collect]').click();await page.locator('[data-collect]').evaluate(button=>button.click());assert.equal(await page.locator('[data-collect]').isDisabled(),true);
 await page.evaluate(()=>{releasePayment();paymentHeld=false;});await page.waitForFunction(()=>!document.querySelector('[data-collect]').disabled);assert.equal(await page.evaluate(()=>calls.filter(value=>value.startsWith('pay')).length),1);
 await page.locator('#search').fill('');await page.locator('.debt-directory-manage>summary').click();await page.locator('[data-add-customer]').click();
 await mkdir('tests/screenshots/native-v125',{recursive:true});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'tests/screenshots/native-v125/customers.png'});
 await page.locator('[data-tab=archive]').click();assert.equal(await page.locator('[data-person]').count(),1);assert.equal(await page.locator('[data-debt-summary]').isVisible(),false);assert.equal(await page.locator('#rows img').count(),0);assert.equal(await page.locator('[data-collect]').count(),0);
 await page.evaluate(async()=>{kind='suppliers';mount();await show();});assert.equal(await page.locator('[data-person]').count(),2);assert.match(await page.locator('[data-person=credit]').innerText(),/رصيد دائن/);assert.match(await page.locator('[data-debt-summary]').innerText(),/100/);
 for(const width of [320,393,720]){await page.setViewportSize({width,height:874});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await page.setViewportSize({width:393,height:874});await page.screenshot({path:'tests/screenshots/native-v125/suppliers.png'});
 await page.locator('[data-tab=archive]').click();assert.match(await page.locator('#rows').innerText(),/مسدد بالكامل/);assert.equal(await page.locator('[data-person]').getAttribute('data-person'),'settled');
 await page.evaluate(async()=>{mode='viewer';mount();await show();});assert.equal(await page.locator('[data-edit-supplier],[data-archive-supplier],[data-collect],[data-add-supplier],[data-new-purchase]').count(),0);
 // Query/tab choices made during a slow load survive its completion.
 await page.evaluate(()=>{hold=true;started=false;window.pending=show();});await page.waitForFunction(()=>started);await page.locator('[data-tab=archive]').click();await page.locator('#search').fill('مسدد');await page.evaluate(async()=>{release();await pending;});assert.equal(await page.locator('[data-person]').count(),1);assert.equal(await page.locator('#search').inputValue(),'مسدد');
 await page.evaluate(async()=>{fail=true;await show();});await page.getByRole('alert').waitFor();assert.equal(await page.locator('[data-person]').count(),0);assert.equal(await page.locator('[data-debt-summary]').isVisible(),false);
 await page.evaluate(()=>fail=false);await page.locator('[data-debt-retry]').click();await page.locator('[data-person]').first().waitFor();
 // A remounted renderer and detached host cannot receive old source results/actions.
 await page.evaluate(()=>{hold=true;started=false;window.pending=show();});await page.waitForFunction(()=>started);await page.evaluate(async()=>{kind='customers';await show();release();await pending;});assert.match(await page.locator('.debt-directory-heading').innerText(),/ديون الزبائن/);
 assert.equal(await page.evaluate(()=>JSON.stringify(source)===original),true);assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
 const count=await page.evaluate(()=>calls.length);await page.evaluate(()=>current=false);await page.locator('[data-open-person]').first().click();assert.equal(await page.evaluate(()=>calls.length),count);
 await page.evaluate(()=>{current=true;hold=true;started=false;window.pending=show();});await page.waitForFunction(()=>started);assert.equal(await page.evaluate(async()=>{const host=document.querySelector('#content');host.remove();const before=host.innerHTML;release();await pending;return host.innerHTML===before;}),true);
 assert.deepEqual(errors,[]);console.log('PASS: native customer/supplier compact lists and back header, debt/credit partition, exact global summaries, 20/40/all paging, keyboard/details/contact callbacks, owner/viewer, busy single-flight, null read/retry, slow query/tab retention, remount/detached/stale guards and 320/393/720px RTL without writes/storage');
}finally{await browser.close();await preview.close();}
