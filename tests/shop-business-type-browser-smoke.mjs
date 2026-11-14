// Device-local preferences and synthetic inventory only. No production access.
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
   await page.goto(preview.origin+'/styles.css');await page.setContent('<html lang="ar" dir="rtl"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"><link rel="stylesheet" href="/owner-path.css"></head><body><main id="app"></main></body></html>');
   await page.evaluate(async state=>{
    const {mountOwnerPath}=await import('/owner-path-ui.js'),{createThemeController}=await import('/theme.js');window.theme=createThemeController({document});window.updates=[];window.writeCalls=[];
    window.products=[{id:'p',name:'صنف دواء',barcode:'001',category:'أدوية',base_unit:'قطعة',quantity_pieces:'5',default_sale_price:'10',weighted_unit_cost:'4'},{id:'q',name:'صنف قديم',barcode:'002',category:'قديم',base_unit:'قطعة',quantity_pieces:'2',default_sale_price:'3',weighted_unit_cost:'1'}];
    state.stock.products=products.map(product=>({product}));window.source=state;
    const api={config:{url:'https://fixture.invalid'},generation:1,deviceEpoch:1,request:async()=>[],sharingProject:async()=>({}),allRows:async table=>table==='products'?structuredClone(products):[],updateProduct:async(id,values,options)=>{updates.push({id,values,options});Object.assign(products.find(row=>row.id===id),values);},rpc:async(name,p)=>{
     if(name==='claim_sharikx2_device_control_v1')return {is_active:true};
     if(name==='sharikx2_owner_path_v1'&&p.p_action==='state')return structuredClone(state);
     if(name==='get_sharikx2_inventory_preferences_v2')return {project_id:state.project_id,revision:1,settings:{custom:['مخصص غير مستخدم'],hidden:['أدوية'],names:[]}};
     writeCalls.push({name,p});throw Error('Unexpected mutation');
    }};
    mountOwnerPath({app:document.querySelector('#app'),api,project:{id:state.project_id,name:'محل الاختبار'},notice:()=>{}});
   },ownerState());
   await page.locator('[data-menu]').click();await page.locator('[data-s=business]').click();assert.equal(await page.locator('[data-business-type]').count(),4);
   await page.locator('[data-business-type=pharmacy]').click();assert.match(await page.locator('[data-s=business]').innerText(),/صيدلية/);assert.equal(await page.evaluate(()=>writeCalls.length+updates.length),0);
   await page.locator('[data-s=business]').click();assert.equal(await page.locator('[data-business-type=pharmacy]').getAttribute('aria-pressed'),'true');
   for(const mode of ['light','dark']){await page.evaluate(mode=>theme.set(mode),mode);for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.locator('.business-type-dialog').evaluate(node=>node.scrollWidth>node.clientWidth),false);}}
   await page.setViewportSize({width:390,height:844});await mkdir('tests/screenshots/business-type',{recursive:true});await page.screenshot({path:`tests/screenshots/business-type/${engine}.png`});
   await page.locator('[data-business-close]').click();await page.locator('[data-sback]').click();await page.locator('[data-nav=goods]').click();await page.locator('.inventory-product-table').waitFor();
   assert.equal(await page.locator('[data-inventory-category="عناية بالبشرة"]').count(),0);assert.equal(await page.locator('[data-inventory-category="مخصص غير مستخدم"]').count(),0);
   assert.equal(await page.locator('[data-inventory-category="قديم"]').count(),1);
   await page.locator('[data-edit-product=p]').click();await page.locator('[data-choose-category]').click();
   const picker=page.locator('[data-inventory-choice]');await picker.waitFor();
   assert.equal(await picker.getByRole('option',{name:'أدوية',exact:true}).count(),1);assert.equal(await picker.getByRole('option',{name:'عناية بالبشرة',exact:true}).count(),1);assert.equal(await picker.getByRole('option',{name:'أجبان',exact:true}).count(),0);
   await picker.getByRole('option',{name:'بدون تصنيف',exact:true}).click();await page.locator('dialog:has([data-choose-category]) form button.primary').click();
   await page.waitForFunction(()=>updates.length===1);assert.equal(await page.evaluate(()=>updates[0].values.category),'');assert.deepEqual(await page.evaluate(()=>Object.keys(updates[0].values).sort()),['category','default_sale_price','low_stock_level','name','notes']);
   await page.locator('.inventory-product-table').waitFor();await page.locator('[data-heading-actions] [data-category-settings]').click();await page.locator('[data-category-row]').first().waitFor();
   assert.equal(await page.locator('[data-category-row="أجبان"]').count(),0);assert.equal(await page.locator('[data-category-row="عناية بالبشرة"]').count(),0);await page.locator('dialog[data-category-settings] [data-close]').click();
   await page.evaluate(async()=>{const {openBusinessType}=await import('/shop-business-type-ui.js');openBusinessType({owner:document.querySelector('#app'),projectId:source.project_id,storage:{getItem:()=>null,setItem(){throw Error('blocked');}}});});
   await page.locator('[data-business-type=bookshop]').click();assert.match(await page.locator('.business-type-dialog [role=alert]').innerText(),/تعذر حفظ/);assert.equal(await page.locator('.business-type-dialog').count(),1);assert.equal(await page.evaluate(()=>writeCalls.length),0);
   assert.deepEqual(errors,[]);console.log(`PASS ${engine}: native device-local activity selector, persistence/blocked storage, pharmacy suggestions, actual-only filters, hidden current choice, uncategorized metadata save only, no financial RPC, RTL light/dark 320/390/1440`);
  }finally{await browser.close();}
 }
}finally{await preview.close();}
