import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:393,height:874},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());await page.goto(preview.origin+'/styles.css');
 await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body><main id="app"></main></body></html>');
 await page.evaluate(async()=>{
  const {appShellMarkup}=await import('/app-shell-ui.js'),{bindAppShellLayout}=await import('/app-shell-layout.js');
  window.mount=(name='تجريبي')=>{window.dispose?.();document.querySelector('#app').innerHTML=appShellMarkup({project:{name,project_number:83733,owner_phone:'0590000000'},mode:'owner',screen:'products'});window.root=document.querySelector('.native-app');window.dispose=bindAppShellLayout(root);};
  mount();document.querySelector('#content').innerHTML='<h2>البضاعة</h2><div style="height:150px"></div><div class="inventory-sticky-controls"><input aria-label="بحث" placeholder="بحث"><div class="inventory-category-bar"><button>الكل</button><button>ألبان</button></div></div><div data-inventory-list>'+Array.from({length:60},(_,index)=>'<button type="button" style="display:block;width:100%;height:65px" data-row="'+index+'">صنف '+index+'</button>').join('')+'</div>';
  await document.fonts.ready;
 });
 await page.waitForFunction(()=>parseFloat(root.style.getPropertyValue('--native-controls-height'))>0);
 const bounds=()=>page.evaluate(()=>{const h=root.querySelector('.app-header').getBoundingClientRect(),c=root.querySelector('.inventory-sticky-controls')?.getBoundingClientRect(),n=root.querySelector('nav').getBoundingClientRect();return {headerTop:h.top,headerBottom:h.bottom,headerHeight:h.height,controlsTop:c?.top,navTop:n.top,navBottom:n.bottom};});
 await page.evaluate(()=>window.scrollTo(0,700));
 let state=await bounds();assert.ok(Math.abs(state.headerTop)<1);assert.ok(Math.abs(state.controlsTop-state.headerBottom)<2);assert.ok(state.navBottom<874);
 await page.locator('[data-row="30"]').click();assert.ok(await page.locator('[data-row="30"]').evaluate(el=>{const rect=el.getBoundingClientRect(),header=document.querySelector('.app-header').getBoundingClientRect(),controls=document.querySelector('.inventory-sticky-controls').getBoundingClientRect();return rect.top>=Math.max(header.bottom,controls.bottom)-1;}));
 await mkdir('tests/screenshots/native-v123',{recursive:true});await page.screenshot({path:'tests/screenshots/native-v123/inventory-scroll.png'});
 await page.evaluate(()=>{document.querySelector('.project-heading h1').firstChild.textContent='اسم مشروع طويل جداً لفحص التفاف النص وتغيير حجم الهيدر';});
 await page.waitForFunction(()=>Math.abs(parseFloat(root.style.getPropertyValue('--native-header-height'))-Math.ceil(root.querySelector('.app-header').getBoundingClientRect().height))<1);
 state=await bounds();assert.ok(Math.abs(state.controlsTop-state.headerBottom)<2);
 await page.setViewportSize({width:320,height:650});await page.waitForFunction(()=>Math.abs(parseFloat(root.style.getPropertyValue('--native-header-height'))-Math.ceil(root.querySelector('.app-header').getBoundingClientRect().height))<1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.setViewportSize({width:720,height:420});await page.waitForFunction(()=>getComputedStyle(document.querySelector('.inventory-sticky-controls')).position==='static');
 assert.ok((await bounds()).headerHeight<=420*.35+1);
 await page.setViewportSize({width:393,height:874});
 await page.evaluate(()=>{document.querySelector('.inventory-sticky-controls').remove();});await page.waitForFunction(()=>root.style.getPropertyValue('--native-controls-height')==='0px');
 await page.evaluate(()=>{window.previous=root;window.before=root.style.cssText;dispose();dispose();root.querySelector('h1').textContent='Detached observers';window.dispatchEvent(new Event('resize'));});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await page.evaluate(()=>previous.style.cssText===before),true);
 await page.evaluate(()=>{mount('مشروع آخر');document.querySelector('#content').innerHTML='<div style="height:2000px"></div>';window.scrollTo(0,500);});await page.waitForFunction(()=>root.style.getPropertyValue('--native-header-height')!=='');
 state=await bounds();assert.ok(Math.abs(state.headerTop)<1);assert.equal(await page.evaluate(()=>previous.style.cssText===before),true);
 await page.evaluate(()=>{dispose();document.querySelector('#app').innerHTML='<h1>خروج</h1>';window.dispatchEvent(new Event('resize'));});
 assert.deepEqual(errors,[]);console.log('PASS: pinned native header/nav, measured inventory offset and unobscured click, long-name/font/resize/short viewport handling, removed controls, idempotent observer cleanup and remount isolation');
}finally{await browser.close();await preview.close();}
