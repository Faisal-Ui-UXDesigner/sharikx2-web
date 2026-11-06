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
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
  await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl" lang="ar"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/owner-path.css"></head><body><main id="app"></main></body></html>');
  await page.evaluate(async recovery=>{
   localStorage.clear();const {mountOwnerPath}=await import('/owner-path-ui.js'),{createThemeController}=await import('/theme.js');window.theme=createThemeController({document});
   window.projectId='11111111-1111-4111-8111-111111111111';window.calls=[];window.lose=recovery!=='direct';window.receipt=null;
   window.state={project_id:projectId,accounting_version:2,revision:1,opening_locked:true,sections:{money:{status:'done'}},money:{accounts:[{id:'cash',name:'كاش',type:'cash',opening_balance:'1.30',movement_net:'-0.30'},{id:'bank',name:'البنك',type:'bank',opening_balance:'5.00',movement_net:'0'}]},stock:{products:[{product:{id:'p',name:'حليب محفوظ',category:'ألبان',barcode:'00123',base_unit:'كغم',quantity_pieces:'10',default_sale_price:'2.00'},source_token:'stock-original',purchased:true},{product:{id:'q',name:'بهار محفوظ',category:'بهارات',barcode:'00456',base_unit:'كغم',quantity_pieces:'2',default_sale_price:'3.00'},source_token:'second-source',purchased:true}]}};
   const api={config:{url:'https://fixture.invalid'},request:async path=>path.includes('suppliers')?[{id:'supplier',name:'المورد الحالي'}]:[],allRows:async()=>[],rpc:async(name,p)=>{
    calls.push({name,p:structuredClone(p)});if(name==='claim_sharikx2_device_control_v1')return {is_active:true};if(name!=='sharikx2_owner_path_v1')throw Error('Unexpected RPC');
    if(p.p_action==='state')return structuredClone(window.state);if(p.p_action==='status')return {status:'confirmed',receipt:structuredClone(window.receipt)};
    if(p.p_action==='purchase'){const pending=JSON.parse(localStorage.getItem('owner-path-v2:'+projectId)).pending;if(pending.payload.request_id!==p.p_payload.request_id)throw Error('Journal not retained');window.receipt={...window.state,request_id:p.p_payload.request_id,status:'confirmed',action:'purchase',id:'invoice',total:'1.13',paid_amount:'0.90',debt_amount:'0.23'};if(lose){lose=false;throw Error('Lost reply');}return structuredClone(window.receipt);}throw Error('Unexpected action');
   }};
   window.dispose=mountOwnerPath({app:document.querySelector('#app'),api,project:{id:projectId,name:'محل الاختبار',currency:'ILS'},notice:()=>{},onExit:()=>{}});
  },recovery);
  await page.locator('[data-go=purchase]').click();const form=page.locator('[data-owner-purchase]');await form.locator('[data-choose-owner-product]').click();
  const picker=page.locator('.purchase-product-choice');await picker.locator('[data-choice-product]').first().waitFor();
  await picker.locator('[data-choice-category="ألبان"]').click();assert.equal(await picker.locator('[data-choice-product]').count(),1);assert.match(await picker.locator('[data-choice-results]').innerText(),/حليب محفوظ/);
  await picker.locator('[data-purchase-product-search]').fill('00123');await picker.locator('[data-choice-product="p"]').click();
  await form.locator('[data-purchase-calculator=quantity]').click();const calc=page.locator('.purchase-calculator');await calc.locator('[name=expression]').fill('1÷2');await calc.locator('[type=submit]').click();assert.equal(await form.locator('[name=qty]').inputValue(),'0.5');
  await form.locator('[data-purchase-calculator=cost]').click();await calc.locator('[name=expression]').fill('1+1');await calc.locator('[type=submit]').click();assert.equal(await form.locator('[name=cost]').inputValue(),'2');
  await form.locator('[data-add-owner-line]').click();await picker.locator('[data-choice-product="q"]').click();await form.locator('[name=qty]').fill('٠٫١٢٥');await form.locator('[name=cost]').fill('١٫٠٠٥٠');await form.locator('[data-add-owner-line]').click();await picker.locator('[data-cancel-choice]').click();
  assert.equal(await form.locator('[data-edit-owner-line]').count(),2);assert.match(await form.locator('[data-purchase-total]').innerText(),/1\.13/);
  // Editing keeps product identity; deleting/re-adding restores the same invoice.
  await form.locator('[data-edit-owner-line="0"]').click();await form.locator('[name=qty]').fill('1');await form.locator('[data-add-owner-line]').click();await picker.locator('[data-cancel-choice]').click();assert.match(await form.locator('[data-purchase-total]').innerText(),/2\.13/);
  await form.locator('[data-edit-owner-line="0"]').click();await form.locator('[name=qty]').fill('0.5');await form.locator('[data-choose-owner-product]').click();await picker.locator('[data-cancel-choice]').click();assert.match(await form.locator('[data-purchase-total]').innerText(),/1\.13/);
  await form.locator('[data-delete-owner-line="1"]').click();assert.equal(await form.locator('[data-edit-owner-line]').count(),1);
  await form.locator('[data-choose-owner-product]').click();await picker.locator('[data-choice-product="q"]').click();await form.locator('[name=qty]').fill('0.125');await form.locator('[name=cost]').fill('1.0050');await form.locator('[data-add-owner-line]').click();await picker.locator('[data-cancel-choice]').click();
  for(let i=0;i<4;i++)await form.locator('[data-full-owner-payment="0"]').click();assert.equal(await page.locator('[data-app-toast]').count(),1);assert.match(await page.locator('[data-app-toast]').innerText(),/لا يكفي/);assert.equal(await form.locator('[data-full-owner-payment]').count(),2);
  await form.locator('[data-full-owner-payment="1"]').click();assert.equal(await form.locator('[name="pay-1"]').inputValue(),'1.13');assert.equal(await form.locator('[name="pay-0"]').inputValue(),'');
  await form.locator('[name="pay-1"]').fill('');await form.locator('[name="pay-0"]').fill('2.00');assert.match(await form.locator('[data-balance-after="0"]').innerText(),/الزائد.*1.*غير مدفوع/);assert.match(await form.locator('[data-purchase-debt]').innerText(),/0\.13/);
  await form.locator('[name="pay-0"]').fill('0.40');await form.locator('[name="pay-1"]').fill('0.50');await form.locator('[name=supplier]').selectOption('supplier');
  assert.match(await form.locator('[data-purchase-paid]').innerText(),/0\.9/);assert.match(await form.locator('[data-purchase-debt]').innerText(),/0\.23/);
  await page.locator('[data-back]').click();await page.locator('[data-go=purchase]').click();assert.equal(await form.locator('[data-edit-owner-line]').count(),2);assert.equal(await form.locator('[name="pay-1"]').inputValue(),'0.50');
  await page.locator('[data-save-purchase]').click();const debt=page.locator('.owner-purchase-debt');await debt.waitFor();assert.match(await debt.innerText(),/0\.23/);assert.equal(await page.evaluate(()=>calls.filter(call=>call.p?.p_action==='purchase').length),0);await debt.locator('[data-back-owner-debt]').click();
  for(const mode of ['light','dark']){await page.evaluate(mode=>theme.set(mode),mode);for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}}
  if(recovery==='direct'){await page.setViewportSize({width:390,height:844});await mkdir(new URL('screenshots/owner-purchase/',import.meta.url),{recursive:true});await page.screenshot({path:fileURLToPath(new URL(`screenshots/owner-purchase/${engine}-multi.png`,import.meta.url)),fullPage:true});}
  await page.locator('[data-save-purchase]').click();await debt.locator('[data-confirm-owner-debt]').evaluate(button=>{button.click();button.click();});
  if(recovery!=='direct'){await page.locator('[data-retry]').waitFor();await page.locator(recovery==='retry'?'[data-retry]':'[data-check]').click();}
  await page.locator('[data-search]').waitFor();const result=await page.evaluate(()=>({commands:calls.filter(call=>call.p?.p_action==='purchase'),saved:JSON.parse(localStorage.getItem('owner-path-v2:'+projectId))}));
  assert.equal(result.commands.length,recovery==='retry'?2:1);if(recovery==='retry')assert.deepEqual(result.commands[0],result.commands[1]);
  assert.deepEqual(result.commands[0].p.p_payload.values,{items:[{product_id:'p',quantity_pieces:'0.5',unit_cost:'2',source_token:'stock-original'},{product_id:'q',quantity_pieces:'0.125',unit_cost:'1.0050',source_token:'second-source'}],payments:[{account_id:'cash',amount:'0.4'},{account_id:'bank',amount:'0.5'}],supplier_id:'supplier'});
  assert.equal(result.saved.pending,undefined);assert.equal(result.saved['draft:purchase'],undefined);assert.deepEqual(errors,[]);await page.close();
 }
 console.log(`PASS ${engine}: multi-item owner purchase, shared category/search picker and quantity/price calculator, exact totals/split payments, one full-payment button per account and deduplicated toast, debt consent/cancel, durable draft and identical retry/status recovery, RTL 320/390/1440 light/dark; synthetic only`);
 }finally{await browser.close();}
}}finally{await preview.close();}
