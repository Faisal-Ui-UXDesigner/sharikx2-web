import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url);
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 for(const engine of ['edge','webkit']){
  const browser=await (engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
  try{
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
   const page=await context.newPage(),errors=[],requests=[];page.setDefaultTimeout(10000);
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>{
    requests.push(route.request().url());return new URL(route.request().url()).origin===preview.origin?route.continue():route.abort();
   });
   await page.goto(preview.origin+'/styles.css');
   await page.setContent('<html lang="ar" dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><aside id="install-action"></aside><main id="app"></main><div id="notice"></div></body></html>');
   // Decode real pixels with the shipped fallback, not a mocked decoder. EAN fixture
   // bars are independently assembled from the standard left/right digit patterns.
   const decoded=await page.evaluate(async()=>{
    delete window.BarcodeDetector;
    const {createBarcodeReader}=await import('/barcode-reader.js');const reader=await createBarcodeReader();
    const left=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
    const inverse=bits=>[...bits].map(bit=>bit==='1'?'0':'1').join('');
    const draw=bits=>{
     const canvas=document.createElement('canvas');canvas.width=(bits.length+40)*3;canvas.height=180;
     const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='black';
     [...bits].forEach((bit,i)=>{if(bit==='1')ctx.fillRect((i+20)*3,10,3,160);});return canvas;
    };
    const ean8='96385074',bits8='101'+[...ean8.slice(0,4)].map(d=>left[+d]).join('')+'01010'+[...ean8.slice(4)].map(d=>inverse(left[+d])).join('')+'101';
    const ean13='4006381333931',parity='LGLLGG';
    const bits13='101'+[...ean13.slice(1,7)].map((d,i)=>parity[i]==='L'?left[+d]:inverse([...left[+d]].reverse().join(''))).join('')+'01010'+[...ean13.slice(7)].map(d=>inverse(left[+d])).join('')+'101';
    const blank=document.createElement('canvas');blank.width=200;blank.height=100;blank.getContext('2d').fillRect(0,0,200,100);
    return {ean8:await reader.detect(draw(bits8)),ean13:await reader.detect(draw(bits13)),blank:await reader.detect(blank)};
   });
   assert.equal(decoded.ean8[0]?.rawValue,'96385074');assert.equal(decoded.ean13[0]?.rawValue,'4006381333931');assert.deepEqual(decoded.blank,[]);
   // No BarcodeDetector: acquire media, load local reader, keep manual fallback
   // operable, and release the owned stream on close. Camera hardware is mocked.
   await page.evaluate(async()=>{
    const {openBarcodeScanner}=await import('/barcode-scanner.js');window.values=[];window.stops=0;
    HTMLMediaElement.prototype.play=async()=>{};
    Object.defineProperty(HTMLMediaElement.prototype,'srcObject',{configurable:true,get(){return this.fixtureStream;},set(value){this.fixtureStream=value;}});
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>window.stops++}]})}});
    await openBarcodeScanner({onDetected:value=>window.values.push(value)});
   });
   assert.match(await page.locator('[data-scanner-status]').innerText(),/وجّه/);
   await page.locator('[data-manual-barcode]').fill('001234');await page.locator('[data-manual]').click();
   assert.equal(await page.evaluate(()=>stops),1);assert.deepEqual(await page.evaluate(()=>values),['001234']);
   await page.evaluate(async()=>{
    const {bindPwaInstall}=await import('/pwa-install.js');
    window.installHost=new EventTarget();installHost.navigator={userAgent:'iPhone',standalone:false};installHost.matchMedia=()=>({matches:false});
    window.releaseInstall=bindPwaInstall({root:document.querySelector('#install-action'),host:installHost});
   });
   await page.locator('#install-action button').click();assert.match(await page.locator('dialog').innerText(),/الشاشة الرئيسية/);
   await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});
   await page.evaluate(()=>document.querySelector('#notice').textContent='رسالة عملية');assert.equal(await page.locator('#install-action button').count(),1);
   await page.evaluate(()=>{
    window.prompts=0;const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{window.prompts++;};event.userChoice=Promise.resolve({outcome:'dismissed'});installHost.dispatchEvent(event);
   });
   await page.locator('#install-action button').click();await page.waitForFunction(()=>prompts===1);
   await page.evaluate(()=>installHost.dispatchEvent(new Event('appinstalled')));assert.equal(await page.locator('#install-action button').count(),0);
   await page.evaluate(async()=>{
    releaseInstall();installHost.navigator.standalone=true;window.releaseInstall2=null;
    const {bindPwaInstall}=await import('/pwa-install.js');window.releaseStandalone=bindPwaInstall({root:document.querySelector('#install-action'),host:installHost});
   });
   assert.equal(await page.locator('#install-action button').count(),0);
   await page.evaluate(()=>releaseStandalone());
   assert.equal(requests.every(url=>new URL(url).origin===preview.origin),true);
   for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
    await page.setViewportSize(viewport);await page.evaluate(async()=>{
     const {bindPwaInstall}=await import('/pwa-install.js');releaseInstall2?.();installHost.navigator.standalone=false;releaseInstall2=bindPwaInstall({root:document.querySelector('#install-action'),host:installHost});
    });
    await page.locator('#install-action button').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.locator('[data-close-install]').click();await page.locator('dialog').waitFor({state:'detached'});
   }
   assert.deepEqual(errors,[]);await context.close();
   // Load the real entry point, not only a component fixture. Requests remain
   // local and config has no public key: no login or financial write is attempted.
   const entry=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
   const entryErrors=[];entry.on('pageerror',error=>entryErrors.push(error.message));
   await entry.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
   await entry.goto(preview.origin+'/');await entry.locator('#app button').first().waitFor();
   await mkdir(new URL('screenshots/',import.meta.url),{recursive:true});
   for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
    await entry.setViewportSize(viewport);
    for(const theme of ['dark','light']){
     await entry.evaluate(async theme=>{
      const {themeController}=await import('/theme-bootstrap.js');themeController.set(theme);await document.fonts.ready;
     },theme);
     assert.equal(await entry.evaluate(()=>getComputedStyle(document.body).backgroundColor),theme==='dark'?'rgb(8, 11, 23)':'rgb(239, 242, 246)');
     assert.equal(await entry.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
     if(viewport.width===390)await entry.screenshot({path:fileURLToPath(new URL(`screenshots/iphone-foundation-${engine}-${theme}.png`,import.meta.url)),fullPage:true});
    }
   }
   assert.deepEqual(entryErrors,[]);await entry.close();
   const offlineContext=await browser.newContext({viewport:{width:390,height:844}}),offlinePage=await offlineContext.newPage(),offlineErrors=[];
   offlinePage.on('pageerror',error=>offlineErrors.push(error.message));
   await offlinePage.goto(preview.origin+'/');
   await offlinePage.evaluate(async()=>{await navigator.serviceWorker.ready;});
   await offlinePage.reload();await offlinePage.waitForFunction(()=>!!navigator.serviceWorker.controller);
   const cached=await offlinePage.evaluate(async()=>{
    const names=await caches.keys(),keys=await (await caches.open(names.find(name=>name.startsWith('sharikx2-shell-')))).keys();return keys.map(request=>new URL(request.url).pathname);
   });
   assert.ok(cached.includes('/vendor/zxing.min.js'));assert.equal(cached.includes('/config.js'),false);
   assert.equal(cached.some(path=>/auth|rest\/|receipt/.test(path)&&!path.endsWith('.js')),false);
   // This Windows WebKit build reports an internal navigation error when
   // context.setOffline(true) is combined with a controlling service worker.
   // Its service-worker-owned network requests also bypass route interception.
   // Test missing-config startup in a fresh non-SW WebKit context instead.
   if(engine==='edge'){
    await offlineContext.route('**/config.js',route=>route.abort());await offlineContext.setOffline(true);
    await offlinePage.reload();await offlinePage.locator('#app button').first().waitFor();
    assert.match(await offlinePage.locator('#notice').innerText(),/إعدادات الاتصال/);
    assert.equal(await offlinePage.evaluate(()=>window.SHARIKX2_CONFIG),undefined);
   }else{
    const missing=await browser.newContext({serviceWorkers:'block'}),page=await missing.newPage();
    page.on('pageerror',error=>offlineErrors.push(error.message));
    await missing.route('**/config.js',route=>route.abort());await page.goto(preview.origin+'/');
    await page.locator('#app button').first().waitFor();assert.equal(await page.evaluate(()=>window.SHARIKX2_CONFIG),undefined);
    // SW registration may replace the visible notice with its unavailable warning.
    assert.equal(await page.locator('#app button').count()>0,true);await missing.close();
   }
   assert.deepEqual(offlineErrors,[]);await offlineContext.close();
   console.log(engine==='edge'?'PASS edge: actual offline cached-shell reload, no cached config, safe missing-config startup':'PASS webkit: actual shell installation/cache audit and missing-config startup; offline navigation NOT verified (Windows WebKit limitation)');
   console.log(`PASS ${engine}: real local EAN-8/EAN-13 decode, no-native camera/manual/cleanup, install guide/prompt/notifications isolation, mobile/desktop overflow (synthetic media; no live data)`);
  }finally{await browser.close();}
 }
}finally{await preview.close();}
