import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const displays=[];
 for(const timezoneId of ['America/Los_Angeles','Asia/Tokyo']){
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId,serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
  await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="fixture"></main><section id="values"></section></body></html>');
  await page.evaluate(async()=>{
   const ui=await import('/ui.js');window.data=[{id:'one',description:'<svg>',amount:-2.5,created_at:'2026-10-11T22:30:00Z',account:{name:'Cash'}},{id:'two',description:'Native date',amount:.49,created_at:'2026-10-12 12:00'},{id:'three',description:'Invalid date',amount:0,created_at:'2026-02-30T12:00:00Z'}];window.original=JSON.stringify(data);window.writes=0;
   const api={rows:async()=>structuredClone(data),rpc:()=>{writes++;throw Error('forbidden');}};
   await (await import('/expense.js')).renderExpenses({api,projectId:'project',mode:'viewer',container:document.querySelector('#fixture'),onSaved:()=>{},isCurrent:()=>true});
   const values=document.querySelector('#values');values.innerHTML='<p data-local></p><p data-cross></p><p data-money></p><p data-zero></p>';
   values.querySelector('[data-local]').textContent=ui.timestamp('2026-10-12 12:00');values.querySelector('[data-cross]').textContent=ui.timestamp('2026-10-11T22:30:00Z');values.querySelector('[data-money]').textContent=ui.money(-1.005,2);values.querySelector('[data-zero]').textContent=ui.money(-.004,2);
  });
  assert.equal(await page.locator('[data-expense=one] .expense-amount').innerText(),'−3 ₪');assert.equal(await page.locator('[data-expense=two] .expense-amount').innerText(),'0 ₪');assert.equal(await page.locator('[data-expense=three] .expense-amount').innerText(),'0 ₪');assert.match(await page.locator('[data-expense=one]').innerText(),/12.*10.*2026/);
  assert.match(await page.locator('[data-expense=three]').innerText(),/تاريخ غير متوفر/);assert.match(await page.locator('[data-local]').innerText(),/12:00/);assert.match(await page.locator('[data-money]').innerText(),/1\.01/);assert.equal(await page.locator('[data-zero]').innerText(),'0 ₪');
  await page.locator('[data-expense=one]').click();assert.equal(await page.locator('dialog .expense-amount').innerText(),'−3 ₪');assert.equal(await page.locator('dialog svg').count(),0);assert.equal(await page.locator('dialog [data-edit],dialog [data-delete]').count(),0);await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>JSON.stringify(data)===original),true);assert.equal(await page.evaluate(()=>writes),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);displays.push(await page.locator('#values').innerText());await context.close();
 }
 assert.equal(displays[0],displays[1]);
 console.log('PASS: shared Palestine financial dates in US/Japan browser zones, native expense sign/whole rounding/zero, exact decimal display, invalid dates, viewer details and safe RTL/mobile, unchanged raw amounts and no writes');
}finally{await browser.close();await preview.close();}
