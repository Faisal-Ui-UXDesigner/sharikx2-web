import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const {chromium,webkit}=createRequire(import.meta.url)('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{for(const engine of ['edge','webkit']){
 const browser=await(engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
 try{for(const recovery of ['direct','retry','status']){
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
  await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl" lang="ar"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/owner-path.css"></head><body><main id="app"></main></body></html>');
  await page.evaluate(async recovery=>{
   localStorage.clear();const {mountOwnerPath}=await import('/owner-path-ui.js'),{createThemeController}=await import('/theme.js');window.theme=createThemeController({document});
   window.projectId='11111111-1111-4111-8111-111111111111';window.calls=[];window.contact=null;window.lose=recovery!=='direct';window.receipt=null;
   window.state={project_id:projectId,accounting_version:2,revision:1,opening_locked:true,sections:{money:{status:'done'}},
    money:{accounts:[{id:'cash',name:'كاش',type:'cash',opening_balance:'0.30',movement_net:'-0.10'}]},
    stock:{products:[{product:{id:'p',name:'صنف موزون محفوظ',base_unit:'كغم',quantity_pieces:'10',default_sale_price:'2.00'},source_token:'stock-original',purchased:true}]}};
   const api={config:{url:'https://fixture.invalid'},request:async path=>path.includes('suppliers')?[{id:'supplier',name:'المورد الحالي'},...(contact?[contact]:[])]:[],
    allRows:async()=>[],createSupplier:async(id,value)=>{if(id!==projectId)throw Error('Foreign contact');window.contact=structuredClone(value);},rpc:async(name,p)=>{
     calls.push({name,p:structuredClone(p)});if(name==='claim_sharikx2_device_control_v1')return {is_active:true};
     if(name!=='sharikx2_owner_path_v1')throw Error('Unexpected RPC');
     if(p.p_action==='state')return structuredClone(window.state);
     if(p.p_action==='status')return {status:'confirmed',receipt:structuredClone(window.receipt)};
     if(p.p_action==='purchase'){
      const pending=JSON.parse(localStorage.getItem('owner-path-v2:'+projectId)).pending;if(pending.payload.request_id!==p.p_payload.request_id)throw Error('Journal not retained');
      window.receipt={...window.state,request_id:p.p_payload.request_id,status:'confirmed',action:'purchase',id:'invoice',total:'0.13',paid_amount:'0.10',debt_amount:'0.03'};
      if(lose){lose=false;throw Error('Lost reply');}return structuredClone(window.receipt);
     }throw Error('Unexpected action');
    }};
   window.dispose=mountOwnerPath({app:document.querySelector('#app'),api,project:{id:projectId,name:'محل الاختبار',currency:'ILS'},notice:()=>{},onExit:()=>{}});
  },recovery);
  await page.locator('[data-go=purchase]').click();const form=page.locator('[data-owner-purchase]');await form.locator('[name=qty]').waitFor();
  await form.locator('[name=qty]').fill('٠٫١٢٥');await form.locator('[name=cost]').fill('١٫٠٠٥٠');await form.locator('[name=paid]').fill('٠٫١٠');
  assert.match(await form.locator('[data-purchase-unit]').innerText(),/كغم/);assert.match(await form.locator('[data-purchase-total]').innerText(),/0\.13/);assert.match(await form.locator('[data-purchase-debt]').innerText(),/0\.03/);assert.match(await form.locator('[data-purchase-balance]').innerText(),/0\.2.*0\.1/);
  await page.locator('[data-save-purchase]').click();assert.match(await form.locator('[role=alert]').innerText(),/المورد/);
  await form.locator('[name=supplier]').selectOption('supplier');await form.locator('[name=paid]').fill('0.14');await page.locator('[data-save-purchase]').click();assert.match(await form.locator('[role=alert]').innerText(),/أكبر من قيمة/);
  await form.locator('[name=qty]').fill('1');await form.locator('[name=cost]').fill('1');await form.locator('[name=paid]').fill('0.21');await page.locator('[data-save-purchase]').click();assert.match(await form.locator('[role=alert]').innerText(),/الرصيد/);
  await form.locator('[name=qty]').fill('0.125');await form.locator('[name=cost]').fill('1.0050');await form.locator('[name=paid]').fill('0.10');
  await page.locator('[data-back]').click();await page.locator('[data-go=purchase]').click();await form.locator('[name=qty]').waitFor();assert.equal(await form.locator('[name=cost]').inputValue(),'1.0050');assert.equal(await form.locator('[name=supplier]').inputValue(),'supplier');
  if(recovery==='direct'){
   await form.locator('[data-new-supplier]').click();await page.locator('.op-sheet [name=name]').fill('مورد جديد');await page.locator('.op-sheet [name=phone]').fill('0591234567');await page.locator('.op-sheet [data-sheet-action="0"]').click();await page.locator('.op-sheet').waitFor({state:'detached'});
   assert.equal(await form.locator('[name=cost]').inputValue(),'1.0050');assert.equal(await form.locator('[name=supplier]').inputValue(),await page.evaluate(()=>contact.id));
  }
  for(const mode of ['light','dark']){await page.evaluate(mode=>theme.set(mode),mode);for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}}
  if(recovery==='direct'){await page.setViewportSize({width:390,height:844});await mkdir(new URL('screenshots/owner-purchase/',import.meta.url),{recursive:true});await page.screenshot({path:fileURLToPath(new URL(`screenshots/owner-purchase/${engine}.png`,import.meta.url))});}
  assert.equal(await page.evaluate(()=>calls.filter(call=>call.p?.p_action==='purchase').length),0);
  await page.locator('[data-save-purchase]').click();
  if(recovery!=='direct'){
   await page.locator('[data-retry]').waitFor();const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('owner-path-v2:'+projectId)).pending.payload);
   await page.locator(recovery==='retry'?'[data-retry]':'[data-check]').click();
   assert.deepEqual(await page.evaluate(()=>calls.find(call=>call.p?.p_action==='purchase').p.p_payload),saved);
  }
  await page.locator('[data-search]').waitFor(); // Native returns to the sale page after purchase.
  const result=await page.evaluate(()=>({commands:calls.filter(call=>call.p?.p_action==='purchase'),saved:JSON.parse(localStorage.getItem('owner-path-v2:'+projectId)),supplier:contact?.id||'supplier'}));
  assert.equal(result.commands.length,recovery==='retry'?2:1);if(recovery==='retry')assert.deepEqual(result.commands[0],result.commands[1]);
  assert.deepEqual(result.commands[0].p.p_payload.values,{items:[{product_id:'p',quantity_pieces:'0.125',unit_cost:'1.0050',source_token:'stock-original'}],payments:[{account_id:'cash',amount:'0.10'}],supplier_id:result.supplier});
  assert.equal(result.saved.pending,undefined);assert.equal(result.saved['draft:purchase'],undefined);assert.deepEqual(errors,[]);await page.close();
 }
 console.log(`PASS ${engine}: actual owner single-line purchase, Arabic fractions/HALF_UP, source balance/debt/overpayment validation, supplier creation and durable draft, one journaled request with direct/retry/status recovery to sale, light/dark RTL 320/390/1440; synthetic only`);
 }finally{await browser.close();}
}}finally{await preview.close();}
