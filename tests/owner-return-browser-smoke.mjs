import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
import {ownerState} from './owner-approval-fixture.mjs';
import {historyFixture} from './owner-history-fixture.mjs';
const {chromium,webkit}=createRequire(import.meta.url)('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{for(const engine of ['edge','webkit']){
 const browser=await(engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
 try{for(const unpaid of [false,true]){
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
  await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl" lang="ar"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/owner-path.css"></head><body><main id="app"></main></body></html>');
  await page.evaluate(async({source,state,unpaid})=>{
   localStorage.clear();const {mountOwnerPath}=await import('/owner-path-ui.js'),{createThemeController}=await import('/theme.js');window.theme=createThemeController({document});
   if(unpaid){source.detail.debt_amount='5.01';source.detail.paid_amount='0';}
   window.calls=[];window.state={...state,return_bridge:1,money:{accounts:[{id:'cash',name:'كاش',balance:'1011.50'}]}};window.source=source;window.before=JSON.stringify(source);
   const api={config:{url:'https://fixture.invalid'},request:async()=>[],rpc:async(name,p)=>{
    calls.push({name,p:structuredClone(p)});if(name==='claim_sharikx2_device_control_v1')return {is_active:true};
    if(name!=='sharikx2_owner_path_v1')throw Error('Unexpected RPC');
    if(p.p_action==='state')return structuredClone(window.state);
    if(p.p_action==='sale_return'){await new Promise(resolve=>setTimeout(resolve,50));return {...window.state,request_id:p.p_payload.request_id,status:'confirmed',action:'sale_return'};}
    throw Error('Unexpected action');
   },allRows:async(table)=>structuredClone(source[table]||[]),sale:async()=>structuredClone(source.detail)};
   window.dispose=mountOwnerPath({app:document.querySelector('#app'),api,project:{id:state.project_id,name:'محل الاختبار',currency:'ILS'},notice:()=>{},onExit:()=>{}});
  },{source:historyFixture(),state:ownerState(),unpaid});
  await page.locator('[data-go=history]').click();const full=page.locator('[data-owner-history]');await full.locator('input').waitFor();await full.locator('input').fill('زبون 1');
  await full.locator('[data-owner-operation]').filter({hasText:'مبيعة #1'}).first().click();await page.locator('[data-operation-return]').click();
  const sheet=page.locator('.op-sheet'),input=sheet.locator('[name="ret-si"]');await input.waitFor();
  assert.equal(await sheet.locator('[name=account]').count(),unpaid?0:1);
  if(unpaid)assert.match(await sheet.innerText(),/دون رد مبلغ من أي حساب/);
  await sheet.locator('[data-sheet-action="0"]').click();assert.match(await sheet.locator('[data-sheet-error]').innerText(),/صنف واحد/);
  await input.fill('0.506');assert.match(await sheet.locator('[data-sheet-error]').innerText(),/أكثر من المتاح/);assert.equal(await sheet.locator('[data-return-refund]').innerText(),'—');
  await input.fill('0');await sheet.locator('[data-return-step="1"]').click();assert.equal(await input.inputValue(),'0.505');
  await sheet.locator('[data-return-step="-1"]').click();assert.equal(await input.inputValue(),'0');
  await sheet.locator('[data-return-all]').click();assert.equal(await input.inputValue(),'0.505');assert.match(await sheet.locator('[data-return-refund]').innerText(),/0\.51/);assert.match(await sheet.locator('[data-return-after]').innerText(),/4\.51/);
  for(const mode of ['light','dark']){await page.evaluate(mode=>theme.set(mode),mode);for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await sheet.evaluate(node=>node.scrollWidth>node.clientWidth),false);}}
  await sheet.locator('[name=reason]').fill(' سبب محفوظ ');
  await sheet.locator('[data-sheet-action="0"]').click();await sheet.waitFor({state:'detached'});await page.locator('[data-owner-history] input').waitFor();
  const commands=await page.evaluate(()=>calls.filter(call=>call.p?.p_action==='sale_return'));
  assert.equal(commands.length,1);assert.deepEqual(commands[0].p.p_payload.values,{sale_id:'sale-0',items:[{sale_item_id:'si',quantity:0.505}],account_id:unpaid?'':'cash',reason:'سبب محفوظ'});
  assert.ok(commands[0].p.p_payload.request_id);assert.equal(await page.evaluate(()=>JSON.stringify(source)===before),true);assert.deepEqual(errors,[]);
  await page.close();
 }
 console.log(`PASS ${engine}: actual owner return bridge, paid/unpaid account rules, prior fractional returns, clamped controls/select-all/live preview, invalid/empty submission, exact single journaled payload, RTL 320/390/1440 light/dark; synthetic only`);
 }finally{await browser.close();}
}}finally{await preview.close();}
