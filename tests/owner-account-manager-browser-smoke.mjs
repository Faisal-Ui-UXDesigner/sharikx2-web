import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
import {ownerState} from './owner-approval-fixture.mjs';
const {chromium,webkit}=createRequire(import.meta.url)('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 for(const engine of ['edge','webkit']){
  const browser=await(engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
   await page.goto(preview.origin+'/styles.css');await page.setContent('<html lang="ar" dir="rtl"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/owner-path.css"></head><body><main id="app"></main></body></html>');
   await page.evaluate(async state=>{
    const {mountOwnerPath}=await import('/owner-path-ui.js'),{createThemeController}=await import('/theme.js');window.theme=createThemeController({document});
    window.cash='22222222-2222-4222-8222-222222222222';window.bank='33333333-3333-4333-8333-333333333333';
    window.rows=[{id:cash,project_id:state.project_id,name:'كاش',active:true,opening_balance:'12.34'},{id:bank,project_id:state.project_id,name:'بنك',active:true,opening_balance:'0'}];
    state.profit.summary.accounts=[{id:cash,name:'كاش',balance:'100'},{id:bank,name:'بنك',balance:'0'}];window.state=state;
    window.mutations=[];window.receipts=new Map();window.applied=0;window.lose=false;window.controls=true;
    const api={config:{url:'https://fixture.invalid',transfers:true},request:async()=>[],sharingProject:async()=>({}),allRows:async table=>table==='accounts'?structuredClone(rows):[],summary:async()=>({accounts:structuredClone(state.profit.summary.accounts)}),rpc:async(name,p)=>{
     if(name==='claim_sharikx2_device_control_v1')return {is_active:controls};
     if(name==='sharikx2_owner_path_v1'&&p.p_action==='state')return structuredClone(state);
     mutations.push({name,p:structuredClone(p)});
     if(name==='update_sharikx2_account_v2'){if(p.p_opening_balance!=='12.34')throw Error('Opening amount changed');rows[0].name=p.p_name;state.profit.summary.accounts[0].name=p.p_name;return {...rows[0]};}
     if(name==='transfer_sharikx2_account_web_v1'){
      if(receipts.has(p.p_request_id))return receipts.get(p.p_request_id);
      applied++;state.profit.summary.accounts[0].balance='87.66';state.profit.summary.accounts[1].balance='12.34';const result={id:crypto.randomUUID(),amount:p.p_amount};receipts.set(p.p_request_id,result);
      if(lose){lose=false;throw Error('انقطع الاتصال بعد التنفيذ');}return result;
     }throw Error('Unexpected mutation');
    }};
    mountOwnerPath({app:document.querySelector('#app'),api,project:{id:state.project_id,name:'المحل',currency:'ILS'},notice:()=>{}});
   },ownerState());
   await page.locator('[data-nav=accounts]').click();await page.locator('[data-owner-manage-accounts]').click();await page.locator('[data-account-rename]').first().waitFor();
   await page.locator('[data-account-rename]').first().click();await page.locator('[name=accountName]').fill('كاش جديد');await page.locator('.owner-account-manager form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
   await page.locator('[data-account-statement]').filter({hasText:'كاش جديد'}).waitFor();assert.equal(await page.evaluate(()=>mutations.length),1);assert.equal(await page.evaluate(()=>rows[0].opening_balance),'12.34');
   await page.locator('[data-owner-manage-accounts]').click();await page.locator('[data-account-transfer]').first().click();await page.locator('[name=amount]').fill('1000');await page.locator('.owner-account-manager [type=submit]').click();await page.locator('.owner-account-manager [role=alert]').filter({hasText:'غير كاف'}).waitFor();assert.equal(await page.evaluate(()=>mutations.length),1);
   await page.locator('[name=amount]').fill('١٢.٣٤');await page.evaluate(()=>{lose=true;});await page.locator('.owner-account-manager [type=submit]').click();await page.locator('[data-pending-transfer]').waitFor();
   assert.equal(await page.locator('[name=amount]').isDisabled(),true);assert.equal(await page.evaluate(()=>applied),1);
   await page.locator('[data-account-close]').click();await page.locator('[data-owner-manage-accounts]').click();await page.locator('[data-pending-transfer]').waitFor();await page.locator('.owner-account-manager [type=submit]').click();
   await page.waitForFunction(()=>!document.querySelector('.owner-account-manager'));assert.equal(await page.evaluate(()=>applied),1);
   const ids=await page.evaluate(()=>mutations.filter(row=>row.name==='transfer_sharikx2_account_web_v1').map(row=>row.p.p_request_id));assert.equal(ids.length,2);assert.equal(ids[0],ids[1]);
   await page.locator('[data-nav=cashier]').click();await page.locator('[data-menu]').click();await page.locator('[data-s=accounts]').click();await page.locator('[data-account-rename]').first().waitFor();
   for(const mode of ['light','dark']){await page.evaluate(async mode=>{const {createThemeController}=await import('/theme.js');createThemeController({document}).set(mode);},mode);for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.locator('.owner-account-manager').evaluate(node=>node.scrollWidth>node.clientWidth),false);}}
   await page.setViewportSize({width:390,height:844});await mkdir('tests/screenshots/account-manager',{recursive:true});await page.screenshot({path:`tests/screenshots/account-manager/${engine}.png`});
   await page.locator('[data-account-rename]').first().click();await page.locator('[name=accountName]').fill('اسم ممنوع');await page.evaluate(()=>{controls=false;});await page.locator('.owner-account-manager [type=submit]').click();await page.locator('.owner-account-manager [role=alert]').filter({hasText:'لا يتحكم'}).waitFor();assert.equal(await page.evaluate(()=>mutations.length),3);
   assert.deepEqual(errors,[]);console.log(`PASS ${engine}: real owner accounts/settings entries, rename keeps opening balance, double-submit prevention, funds check, Arabic amount, lost-response persisted transfer replay exactly once, device denial, RTL 320/390/1440 light/dark; synthetic RPC only`);
  }finally{await browser.close();}
 }
}finally{await preview.close();}
