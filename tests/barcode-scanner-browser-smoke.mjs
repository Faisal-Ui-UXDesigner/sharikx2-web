import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).origin===preview.origin?r.continue():r.abort());await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body></body></html>');
 await page.evaluate(async()=>{
  const {openBarcodeScanner}=await import('/barcode-scanner.js');window.values=[];window.stops=0;window.current=true;window.open=()=>openBarcodeScanner({isCurrent:()=>current,onDetected:value=>values.push(value)});
  Object.defineProperty(window,'BarcodeDetector',{configurable:true,value:undefined});delete window.BarcodeDetector;
 });
 await page.evaluate(()=>open());await page.evaluate(()=>open());assert.equal(await page.locator('dialog').count(),1);
 await page.locator('[data-manual]').click();assert.match(await page.locator('[data-scanner-status]').innerText(),/أدخل/);
 await page.locator('[data-manual-barcode]').fill(' 00123 ');await page.locator('[data-manual-barcode]').press('Enter');assert.deepEqual(await page.evaluate(()=>values),['00123']);assert.equal(await page.locator('dialog').count(),0);
 await page.evaluate(()=>{
  HTMLMediaElement.prototype.play=async()=>{};
  Object.defineProperty(HTMLMediaElement.prototype,'srcObject',{configurable:true,get(){return this.fixtureStream;},set(value){this.fixtureStream=value;}});
  window.BarcodeDetector=class{detect(){return new Promise(resolve=>window.detectRelease=resolve);}};
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>new Promise(resolve=>window.cameraRelease=()=>resolve({getTracks:()=>[{stop:()=>stops++}]}))}});
  window.pending=open();
 });
 await page.locator('[data-close]').click();await page.evaluate(()=>cameraRelease());await page.waitForFunction(()=>stops===1);assert.equal(await page.locator('dialog').count(),0);
 // Acquisition succeeds, then Escape cleans up even with detection still pending.
 await page.evaluate(()=>{window.pending=open();});await page.evaluate(()=>cameraRelease());await page.waitForFunction(()=>typeof detectRelease==='function');await page.keyboard.press('Escape');await page.evaluate(()=>detectRelease([{rawValue:'late'}]));await page.waitForFunction(()=>stops===2);assert.deepEqual(await page.evaluate(()=>values),['00123']);
 // A detached parent cleans up acquired media, without relying on another detection.
 await page.evaluate(()=>{window.detectRelease=null;window.pending=open();});await page.evaluate(()=>cameraRelease());await page.waitForFunction(()=>typeof detectRelease==='function');await page.evaluate(()=>document.querySelector('dialog').remove());await page.waitForFunction(()=>stops===3);await page.evaluate(()=>detectRelease([{rawValue:'removed'}]));
 // Detector construction failure releases camera and keeps manual fallback usable.
 await page.evaluate(()=>{window.BarcodeDetector=class{constructor(){throw Error('unsupported formats');}};window.pending=open();});await page.evaluate(()=>cameraRelease());await page.waitForFunction(()=>stops===4);assert.match(await page.locator('[data-scanner-status]').innerText(),/تعذر تشغيل/);
 await page.locator('[data-manual-barcode]').fill('abc');await page.locator('[data-manual]').click();assert.deepEqual(await page.evaluate(()=>values),['00123','abc']);
 // Callback errors cannot leak media or leave a duplicate scanner open.
 await page.evaluate(async()=>{window.BarcodeDetector=class{detect(){return Promise.resolve([{rawValue:'automatic'}]);}};window.pending=open();cameraRelease();await pending;});await page.waitForFunction(()=>values.includes('automatic'));assert.equal(await page.locator('dialog').count(),0);assert.equal(await page.evaluate(()=>stops),5);
 await page.evaluate(()=>{window.current=false;return open();});assert.equal(await page.locator('dialog').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: manual fallback/Enter, duplicate scanner, late camera acquisition, Escape/detached cleanup, late detection suppression, detector failure cleanup, successful detection and stale entry');
}finally{await browser.close();await preview.close();}
