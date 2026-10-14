import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 // Match the native 14dp side inset (~26 image pixels) and capture at the
 // supplied 720x1600 image size without emulating Android system chrome.
 const page=await browser.newPage({viewport:{width:393,height:874},deviceScaleFactor:720/393,serviceWorkers:'block'}),errors=[];
 page.setDefaultTimeout(7000);page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.clock.setFixedTime(new Date('2026-10-14T14:08:00Z'));
 await page.goto(preview.origin+'/styles.css');
 await page.setContent('<html lang="ar" dir="rtl"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body><main id="app"></main><div id="notice"></div></body></html>');
 await page.evaluate(async()=>{
  const {Api}=await import('/api.js');window.SHARIKX2_CONFIG={url:'https://fixture.invalid',publicKey:''};window.writes=0;window.failHome=false;
  const project={id:'11111111-1111-4111-8111-111111111111',name:'تجريبي',owner_phone:'0590000000',project_number:83733,currency:'ILS',subscription_status:'free'};
  const sales=[{id:'s2',sale_number:2,status:'written_off',total:10,cost_total:8,created_at:'2026-10-14T13:51:00Z',customer:{name:'فيصل',phone:'0590000001'}},{id:'s1',sale_number:1,status:'completed',total:40,cost_total:35,created_at:'2026-10-14T04:08:00Z'}];
  const expenses=[{id:'e',description:'مصروف',amount:10,category:'operating_expense',created_at:'2026-10-14T08:00:00Z',occurred_at:'2026-10-14T08:00:00Z'}];
  const products=[{id:'product',name:'بهار رز',category:'بهارات',quantity:3.75,unit:'كغم',purchasePrice:18.133333333333333,expectedSalePrice:40,active:true}];
  window.source={revision:1,state:{partners:[{id:'a',name:'فيصل',share:45,capital:1000},{id:'b',name:'محمد',share:45,capital:1000}],customCategories:['أجبان','ألبان','بسكويت','بهارات'],inventoryPinnedIds:['product'],revenues:[]}};
  window.original=JSON.stringify(source);
  const identity='web-v1-22222222-2222-4222-8222-222222222222';localStorage.setItem('sharikx2-device:v1:'+encodeURIComponent(SHARIKX2_CONFIG.url),identity);
  Api.prototype.restore=async()=>structuredClone(project);Api.prototype.deviceControl=async()=>({project_id:project.id,active_device_id:identity,active_device_name:'متصفح',generation:1,last_seen_at:'2026-10-14T14:08:00Z',requested_device_id:null,requested_device_name:null,requested_at:null});Api.prototype.financeState=async()=>structuredClone(source);
  Api.prototype.rows=async(table)=>table==='sales'?structuredClone(sales):table==='expenses'?[]:[];
  Api.prototype.allRows=async(table)=>{if(window.failHome&&table==='debt_writeoffs')throw Error('خطأ تجريبي في قراءة الملخص');return structuredClone(({products,sales,expenses,purchases:[],debt_writeoffs:[],supplier_payments:[],purchase_returns:[]})[table]||[]);};
  Api.prototype.summary=async()=>({customer_debt:0,supplier_debt:100,liquidity:1972,net_project_value:1940,inventory_cost:68,accounts:[{id:'cash',name:'النقد',balance:1972}]});
  Api.prototype.financialActivity=async()=>({sales:50,purchases:170,expenses:10,movements:[]});
  Api.prototype.request=async()=>{writes++;throw Error('No external requests permitted');};
  await import('/app.js');
 });
 await page.locator('[data-login]').click();await page.locator('[name=phone]').fill('0590000000');await page.locator('[name=password]').fill('1234');
 await page.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));
 await page.locator('[data-records] .activity-record').first().waitFor();await page.evaluate(()=>document.fonts.ready);
 await mkdir('tests/screenshots/native-v121',{recursive:true});
 const capture=async name=>{await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflow');const clip=page.viewportSize().width===393?{x:0,y:0,width:393,height:1600*393/720}:undefined;await page.screenshot({path:`tests/screenshots/native-v121/${name}.png`,clip});};
 assert.deepEqual(await page.locator('nav [data-page]').evaluateAll(nodes=>nodes.map(node=>node.dataset.page)),['accounts','products','cashier','partners','reports']);
 assert.match(await page.locator('.project-heading').innerText(),/0590000000/);
 const positions=await page.locator('nav [data-page]').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().x));assert.ok(positions[0]>positions[4]);
 assert.equal(await page.locator('.cashier-nav .nav-icon').evaluate(el=>Math.round(el.getBoundingClientRect().width)),55);
 assert.equal(await page.locator('.cashier-grid .action-icon').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
 assert.match(await page.locator('.activity-record').first().innerText(),/فيصل ▪ 0590000001/);
 assert.match(await page.locator('.activity-record').first().innerText(),/دين مشطوب/);
 await capture('cashier');
 await page.locator('[data-page=products]').click();await page.locator('[data-product-id]').waitFor();
 assert.equal(await page.locator('[data-inventory-search]').isVisible(),true);assert.equal(await page.locator('[data-category-settings] svg').count(),1);
 await capture('inventory');
 await page.locator('[data-page=partners]').click();await page.locator('.partner-directory-card').waitFor();
 assert.equal(await page.locator('.partner-directory-row').count(),2);assert.equal(await page.locator('.partner-main-actions [data-partner-debts]').count(),1);
 assert.equal(await page.locator('.partner-secondary').getAttribute('open'),null);assert.equal(await page.locator('.project-sharing').isVisible(),true);
 assert.equal(await page.locator('[data-open-sharing]').innerText(),'الاشتراك للمشاركة');
 await capture('partners');
 await page.locator('[data-open-sharing]').click();await page.locator('.plans-screen').waitFor();assert.equal(await page.locator('.project-sharing-dialog').count(),0);
 await page.locator('[data-page=partners]').click();await page.locator('.partner-directory-card').waitFor();
 await page.locator('[data-partner-tab=former]').click();assert.equal(await page.locator('.partner-directory-card').isVisible(),false);assert.equal(await page.locator('.partner-secondary').getAttribute('open'),'');
 await page.locator('[data-partner-tab=current]').click();assert.equal(await page.locator('.partner-directory-card').isVisible(),true);
 await page.locator('[data-page=accounts]').click();await page.locator('.home-statistics-grid').first().waitFor();
 assert.deepEqual((await page.locator('.home-statistic strong').allTextContents()).map(text=>text.replace(/\u200e/g,'')),['50 ₪','10 ₪','43 ₪','-3 ₪','0 ₪','100 ₪']);
 assert.equal(await page.locator('details.account-details').getAttribute('open'),null);await capture('accounts');
 await page.locator('[data-account=cash]').click();await page.locator('dialog').waitFor();await page.keyboard.press('Escape');
 await page.evaluate(()=>window.failHome=true);await page.locator('[data-page=accounts]').click();await page.locator('[data-retry-home]').waitFor();
 assert.equal(await page.locator('.home-statistic').count(),0);await page.evaluate(()=>window.failHome=false);await page.locator('[data-retry-home]').click();await page.locator('.home-statistic').first().waitFor();
 await page.locator('[data-page=reports]').click();await page.locator('.report-summary').waitFor();
 assert.equal(await page.locator('.report-summary .report-metrics').evaluate(el=>getComputedStyle(el).flexDirection),'column');
 await capture('reports');
 // A held daily read cannot replace the outgoing screen after navigation.
 await page.evaluate(async()=>{
  const {Api}=await import('/api.js');window.readAll=Api.prototype.allRows;
  Api.prototype.allRows=async function(table,...args){if(table==='debt_writeoffs')return new Promise(resolve=>window.releaseDaily=resolve);return readAll.call(this,table,...args);};
 });
 await page.locator('[data-page=accounts]').click();await page.waitForFunction(()=>window.releaseDaily);
 await page.locator('[data-page=products]').click();await page.locator('[data-product-id]').waitFor();
 await page.evaluate(async()=>{releaseDaily([]);(await import('/api.js')).Api.prototype.allRows=readAll;});
 assert.equal(await page.locator('.home-statistic').count(),0);
 for(const width of [320,360,720]){await page.setViewportSize({width,height:874});await page.locator('[data-page=cashier]').click();await page.locator('[data-records] .activity-record').first().waitFor();await capture('cashier-'+width);}
 assert.equal(await page.locator('[data-device-banner]').isVisible(),false);
 await page.evaluate(async()=>{(await import('/api.js')).Api.prototype.deviceControl=async()=>null;document.querySelector('[data-banner-refresh]').click();});
 await page.locator('[data-device-banner]').waitFor();assert.match(await page.locator('[data-device-banner-message]').innerText(),/يلزم تسجيل/);
 assert.equal(await page.locator('.app-header').evaluate(el=>el.nextElementSibling.hasAttribute('data-device-banner')),true);
 assert.equal(await page.evaluate(()=>JSON.stringify(source)===original),true);assert.equal(await page.evaluate(()=>writes),0);assert.deepEqual(errors,[]);
 console.log('PASS: real app five native-layout screens, shared RTL chrome, source-isolated daily sale-cost/return calculations, visible actions, statement access, retry, native dimensions, 320/360/393/720px and 720px-wide reference captures without external writes');
}finally{await browser.close();await preview.close();}
