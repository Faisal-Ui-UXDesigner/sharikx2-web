import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
import {ownerState} from './owner-approval-fixture.mjs';

const {chromium,webkit}=createRequire(import.meta.url)('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 for(const engine of (process.env.SHARIK_TEST_ENGINE?[process.env.SHARIK_TEST_ENGINE]:['edge','webkit'])){
  const browser=await(engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
   await page.goto(preview.origin+'/styles.css');
   await page.setContent('<html lang="ar" dir="rtl"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"><link rel="stylesheet" href="/owner-path.css"></head><body><main id="app"></main></body></html>');
   await page.evaluate(async state=>{
    const {mountOwnerPath}=await import('/owner-path-ui.js');
    const {createThemeController}=await import('/theme.js');
    window.theme=createThemeController({document});
    window.calls=[];window.holdDebts=false;window.failPreferences=false;
    const products=[
     {id:'p',name:'شاي',barcode:'001',category:'مشروبات',base_unit:'علبة',quantity_pieces:'54',default_sale_price:'18',weighted_unit_cost:'10'},
     {id:'q',name:'فلفل أسمر',barcode:'002',category:'بهارات',base_unit:'كغم',quantity_pieces:'3.75',default_sale_price:'40',weighted_unit_cost:'18'}
    ];
    state.stock.products=products.map(product=>({product,purchased:true,source_token:'source-'+product.id}));
    state.money={accounts:[{id:'cash',name:'كاش',type:'cash',opening_balance:'100',movement_net:'0'}]};
    window.source=state;
    window.api={config:{url:'https://fixture.invalid'},generation:1,deviceEpoch:1,
     request:async()=>[],
     allRows:async(table,id)=>{if(id!==source.project_id)throw Error('Foreign project');return table==='products'?structuredClone(products):[];},
     rpc:async(name,p)=>{
      calls.push({name,p:structuredClone(p)});
      if(name==='claim_sharikx2_device_control_v1')return {is_active:true};
      if(name==='sharikx2_owner_path_v1'&&p.p_action==='state')return structuredClone(source);
      if(name==='get_sharikx2_inventory_preferences_v2'){
       if(failPreferences)throw Error('Preferences unavailable');
       return {project_id:source.project_id,revision:3,settings:{custom:[],hidden:[],names:[{key:'مشروبات',name:'المشروبات'}]}};
      }
      if(name==='get_sharikx2_debt_balances_v2'){
       if(holdDebts)await new Promise(resolve=>window.releaseDebts=resolve);
       return {customer_debt:4,supplier_debt:0,customers:[{id:'c',name:'زبون',phone:'0591234567',calculated_debt:4}],suppliers:[]};
      }
      throw Error('Unexpected RPC '+name);
     }};
    mountOwnerPath({app:document.querySelector('#app'),api,project:{id:source.project_id,name:'بقالة فيصل',owner_phone:'0595555555',currency:'ILS'},notice:()=>{}});
   },ownerState());
   await page.locator('[data-go=sale]').waitFor();
   assert.equal(await page.locator('.cashier-heading').count(),1);
   assert.equal(await page.locator('.subscription-cta').evaluate(node=>getComputedStyle(node).fontSize),'12px');
   assert.equal(await page.locator('.op-tiles button').count(),4);
   await page.locator('[data-nav=goods]').click();
   await page.locator('.inventory-product-table').waitFor();
   assert.equal(await page.locator('[data-inventory-tab]').count(),0);
   assert.equal(await page.locator('.op-plan,.cashier-heading').count(),0);
   assert.equal(await page.locator('.primary-page-title').innerText(),'البضاعة الحالية');
   assert.equal(await page.locator('[data-heading-actions] button').count(),2);
   assert.equal(await page.locator('.inventory-product-table tbody tr').count(),2);
   await page.locator('[data-inventory-search]').fill('002');
   assert.equal(await page.locator('.inventory-product-table tbody tr').count(),1);
   await page.locator('[data-inventory-search]').fill('');
   await page.locator('[data-inventory-add]').click();
   await page.locator('[data-entry=manual]').click();
   assert.equal(await page.locator('.op-sheet [name=name]').count(),1);
   await page.keyboard.press('Escape');
   await page.locator('[data-heading-actions] [data-category-settings]').click();
   await page.locator('[data-category-row]').first().waitFor();
   await page.locator('[data-category-settings] [data-close]').click();
   await page.locator('[data-nav=cashier]').click();
   await page.locator('[data-go=sale]').click();
   await page.locator('[data-owner-sale-picker]').click();
   await page.locator('[data-pick-row=p] [data-step="1"]').click();
   await page.locator('[data-pick-row=q] [data-step="1"]').click();
   await page.locator('[data-picker-category="بهارات"]').click();
   assert.equal(await page.locator('[data-pick-row]:visible').count(),1);
   await page.locator('[data-sheet-action="1"]').click();
   assert.equal(await page.locator('.op-cart').count(),0);
   await page.locator('[data-owner-sale-picker]').click();
   await page.locator('[data-pick-row=p] [data-step="1"]').click();
   await page.locator('[data-pick-row=q] input').fill('0.125');
   await page.locator('[data-sheet-action="0"]').click();
   await page.locator('.op-cart').first().waitFor();
   assert.equal(await page.locator('.op-cart').count(),2);
   assert.match(await page.locator('[data-total]').innerText(),/23/);
   await page.locator('[data-sale-payment]').click();
   assert.equal(await page.locator('[name=discount]').isVisible(),true);
   await page.locator('[data-sheet-action="1"]').click();
   assert.equal(await page.locator('[name=discount]').isVisible(),false);
   assert.equal(await page.locator('.op-cart').count(),2);
   await page.locator('[data-back]').click();
   await page.evaluate(()=>holdDebts=true);
   await page.locator('[data-debts=customers]').click();
   await page.locator('.list-loading-card').first().waitFor();
   assert.equal(await page.locator('.list-loading-card').count(),5);
   assert.notEqual(await page.locator('.list-loading-card i').first().evaluate(node=>getComputedStyle(node).animationName),'none');
   await page.evaluate(()=>releaseDebts());
   await page.locator('[data-customer-rows] .op-card').waitFor();
   await page.locator('[data-customer-tab=archive]').click();
   assert.equal(await page.locator('[data-customer-rows] .op-card').count(),0);
   await page.locator('[data-back]').click();
   await page.locator('[data-nav=accounts]').click();
   assert.equal(await page.locator('.primary-page-title').innerText(),'الحسابات');
   assert.equal(await page.locator('.op-plan').count(),0);
   await page.locator('[data-nav=profits]').click();
   assert.equal(await page.locator('.primary-page-title').innerText(),'الشركاء');
   await page.locator('[data-nav=goods]').click();
   await page.locator('.inventory-product-table').waitFor();
   await mkdir('tests/screenshots/primary-parity',{recursive:true});
   for(const mode of ['light','dark']){
    await page.evaluate(value=>theme.set(value),mode);
    for(const width of [320,390,1440]){
     await page.setViewportSize({width,height:844});
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:`tests/screenshots/primary-parity/${engine}-${mode}-inventory.png`,fullPage:true});
   }
   await page.locator('[data-nav=cashier]').click();
   await page.screenshot({path:`tests/screenshots/primary-parity/${engine}-cashier.png`,fullPage:true});
   assert.equal(await page.evaluate(()=>calls.some(call=>call.name==='get_sharikx2_finance_state_v1'||call.name==='save_sharikx2_finance_state_v1')),false);
   assert.deepEqual(errors,[]);
   console.log(`PASS ${engine}: native primary headings, daily inventory routing/search/settings, multi-item picker cancel/confirm, payment return, animated loading, debt tabs, RTL light/dark 320/390/1440; synthetic API`);
  }finally{await browser.close();}
 }
}finally{await preview.close();}
