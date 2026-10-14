import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'Asia/Tokyo',serviceWorkers:'block'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="fixture"></main></body></html>');
 await page.evaluate(async()=>{
  const {renderInventoryHistory}=await import('/inventory-history-ui.js');
  const item=(quantity=1)=>({name:'سكر',unit:'علبة',quantity,purchasePrice:.1,expectedSalePrice:.3});
  const entry=(id,before,after)=>({historyVersion:2,itemId:id,historyRecordedAt:'2026-10-13 10:00',before,after});
  window.data={state:{inventoryHistory:[entry('changed',item(.1),{...item(.3),name:'<svg>',unit:'صندوق',purchasePrice:.2,expectedSalePrice:.4}),entry('deleted',item(),null),entry('added',null,{...item(),expectedSalePrice:0}),entry('same',item(),item())]}};
  window.original=JSON.stringify(data);window.active=true;window.reads=0;window.writes=0;
  window.api={financeState:async()=>{reads++;if(window.hold)return new Promise(resolve=>window.release=resolve);if(window.fail)throw Error('تعذر التحميل');return structuredClone(data);},saveFinanceState:()=>{writes++;throw Error('forbidden');}};
  window.show=()=>renderInventoryHistory({api,projectId:'fixture',container:document.querySelector('#fixture'),isCurrent:()=>active});await show();
 });
 assert.equal(await page.locator('.inventory-history-card').count(),4);
 assert.equal(await page.locator('.inventory-history-card svg').count(),0);
 const changed=page.locator('.inventory-history-card').first();
 assert.equal(await changed.locator('.badge.history-tone-primary').count(),5);
 assert.match(await changed.innerText(),/الوحدة السابقة/);assert.match(await changed.innerText(),/الوحدة الجديدة/);
 assert.equal(await changed.locator('.history-tone-profit').count(),1);
 assert.equal(await page.locator('.inventory-history-card').nth(1).locator('.badge.history-tone-negative').count(),1);
 assert.equal(await page.locator('.inventory-history-card').nth(2).locator('.history-value b.history-tone-muted').count(),1);
 assert.equal(await page.locator('.inventory-history-card').nth(3).locator('.badge.history-tone-muted').count(),1);
 assert.equal(await changed.locator('.history-badges').evaluate(el=>getComputedStyle(el).flexWrap),'nowrap');
 await changed.locator('.history-badges').focus();assert.equal(await changed.locator('.history-badges').evaluate(el=>el===document.activeElement),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.evaluate(async()=>{window.hold=true;window.pending=show();});await page.waitForFunction(()=>window.release);
 assert.equal(await page.getByRole('status').getAttribute('aria-busy'),'true');
 await page.evaluate(async()=>{window.hold=false;window.data={state:{inventoryHistory:[]}};await show();window.release({state:{inventoryHistory:[{historyVersion:2,itemId:'stale',after:{name:'متأخر'}}]}});await pending;});
 assert.equal(await page.locator('.inventory-history-card').count(),0);assert.match(await page.locator('#fixture').innerText(),/لا توجد تغييرات/);
 await page.evaluate(async()=>{window.fail=true;await show();});await page.locator('[data-retry]').waitFor();
 await page.evaluate(()=>window.fail=false);await page.locator('[data-retry]').click();await page.getByText('لا توجد تغييرات مسجلة على البضاعة حتى الآن.').waitFor();
 assert.equal(await page.evaluate(()=>writes===0&&localStorage.length===0&&sessionStorage.length===0),true);
 await page.evaluate(async()=>{window.data=JSON.parse(original);await show();});
 assert.equal(await page.evaluate(()=>JSON.stringify(data)===original),true);

 // Precision is a display rule, never a rewrite of historical quantities/costs.
 await page.evaluate(async()=>{
  const {setCurrency}=await import('/ui.js');setCurrency('USD');
  window.data={state:{inventoryHistory:[
   {historyVersion:2,itemId:'precise',historyRecordedAt:'2026-10-14 10:00',after:{name:'صنف دقيق',quantity:.1234,purchasePrice:.1001,expectedSalePrice:.3002}},
   {historyVersion:2,itemId:'previous',historyRecordedAt:'2026-10-13 10:00',after:{name:'سابق',quantity:1}},
   {historyVersion:2,itemId:'unknown',after:{name:'اسم'.repeat(100),quantity:2}},
   {historyVersion:2,itemId:'unsafe',historyRecordedAt:'<svg onload=alert(1)>',after:{name:'<img src=x onerror=alert(1)>',quantity:3}}
  ]}};window.preciseOriginal=JSON.stringify(data);await show();
 });
 assert.equal(await page.locator('.inventory-history-day').count(),4);
 assert.deepEqual(await page.locator('.inventory-history-date').allTextContents(),['2026-10-14','2026-10-13','تاريخ غير محدد','<svg onload=alert(1)>'.slice(0,10)]);
 const precise=page.locator('.inventory-history-card').first();
 assert.equal(await precise.locator('.history-value').nth(1).locator('b').innerText(),'0.12');
 assert.match(await precise.locator('.history-value').nth(2).innerText(),/0\.1001 USD/);
 assert.match(await precise.locator('.history-value').nth(3).innerText(),/0\.3 USD/);
 assert.equal(await page.evaluate(()=>JSON.stringify(data)===preciseOriginal),true);
 assert.equal(await page.locator('#fixture img,#fixture svg').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const metrics=await precise.locator('.badge').evaluate(el=>{const style=getComputedStyle(el);return {height:el.getBoundingClientRect().height,size:style.fontSize,weight:style.fontWeight,bg:style.backgroundColor,border:style.borderTopColor};});
 assert.equal(metrics.height,26);assert.equal(metrics.size,'11px');assert.equal(metrics.weight,'700');
 assert.match(metrics.bg,/0\.109/);assert.match(metrics.border,/0\.49/);
 assert.equal(await page.locator('.inventory-history-date').first().evaluate(el=>getComputedStyle(el).fontSize),'16px');
 await page.evaluate(()=>document.documentElement.dataset.theme='light');
 assert.match(await precise.locator('.badge').evaluate(el=>getComputedStyle(el).backgroundColor),/0\.070/);

 // Unknown rejection values still present a retry, and a late failure cannot
 // replace a newer successful response or a disconnected screen.
 await page.evaluate(async()=>{window.api.financeState=async()=>{throw null;};await show();});
 assert.match(await page.getByRole('alert').innerText(),/تعذر قراءة سجل الجرد/);
 await page.evaluate(async()=>{
  window.api.financeState=()=>new Promise((resolve,reject)=>window.rejectLate=reject);window.late=show();
 });
 await page.evaluate(async()=>{window.api.financeState=async()=>({state:{inventoryHistory:[]}});await show();rejectLate(Error('متأخر'));await late;});
 assert.equal(await page.getByRole('alert').count(),0);
 await page.evaluate(async()=>{
  window.api.financeState=()=>new Promise(resolve=>window.detachedResolve=resolve);window.detached=show();
  window.removed=document.querySelector('#fixture');removed.remove();detachedResolve({state:{inventoryHistory:[]}});await detached;
  window.detachedSafe=removed.querySelector('[aria-busy=true]')!==null;document.body.append(removed);
 });
 assert.equal(await page.evaluate(()=>detachedSafe),true);
 assert.equal(await page.evaluate(()=>writes===0&&localStorage.length===0&&sessionStorage.length===0),true);
 await page.evaluate(async()=>{window.active=false;const prior=reads;await show();window.staleSafe=reads===prior;});assert.equal(await page.evaluate(()=>staleSafe),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: native history precision/currency, day sections, light/dark badge dimensions/alpha, safe long names, immutable source, loading/null-error/retry/stale/detached safety and mobile RTL');
}finally{await browser.close();await preview.close();}
