import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="fixture"></main></body></html>');
 await page.evaluate(async()=>{
  const {renderInventory}=await import('/inventory-ui.js'),{openInventoryProductEntry}=await import('/inventory-product-entry-ui.js');
  delete window.BarcodeDetector;window.active=true;window.calls=[];window.saved=0;window.hold=false;window.fail=false;
  window.rows=[{id:'a',name:'سكر',barcode:'001',category:'مواد',purchase_unit:'علبة',pieces_per_purchase_unit:1.5,quantity_pieces:3,weighted_unit_cost:1,default_sale_price:2}];window.original=JSON.stringify(rows);
  window.api={allRows:async table=>table==='products'?structuredClone(rows):[],financeState:async()=>({state:{},revision:1}),productPurchaseHistory:async()=>[],createProduct:async payload=>{
   calls.push(structuredClone(payload));if(hold)await new Promise(resolve=>window.release=resolve);if(fail){fail=false;throw Error('فشل الحفظ التجريبي');}return payload;
  },updateProduct:async(id,payload)=>{calls.push({id,...payload});return {id,...payload};}};
  window.show=mode=>renderInventory({api,projectId:'p',mode,container:document.querySelector('#fixture'),isCurrent:()=>active,onSaved:()=>saved++});
  window.entry=mode=>openInventoryProductEntry({api,projectId:'p',mode,container:document.querySelector('[data-inventory-body]'),rows,isCurrent:()=>active});await show('owner');
 });
 const editor=page.locator('dialog.inventory-editor'),scanner=page.locator('dialog[data-barcode-scanner]');
 const choose=async(kind,label)=>{await editor.locator(`[data-choose-${kind}]`).click();await page.locator('[data-inventory-choice]').getByRole('option',{name:label,exact:true}).click();};
 assert.equal(await page.locator('[data-inventory-controls] [data-add-product]').count(),1);assert.equal(await page.locator('[data-inventory-controls] [data-scan-add-product]').count(),1);
 await page.locator('[data-scan-add-product]').click();await scanner.locator('[data-manual-barcode]').fill('001');await scanner.locator('[data-manual]').click();
 assert.equal(await editor.count(),0);assert.equal(await page.locator('[data-product-entry-error]').innerText(),'هذا الصنف مسجل مسبقاً في البضاعة');
 await page.locator('[data-scan-add-product]').click();await scanner.locator('[data-manual-barcode]').fill('002');await scanner.locator('[data-manual]').click();
 assert.equal(await editor.locator('[name=barcode]').inputValue(),'002');assert.equal(await editor.locator('[name=barcode]').getAttribute('readonly'),'');assert.equal(await editor.locator('[data-camera-scan]').isVisible(),false);
 await page.keyboard.press('Escape');await page.locator('[data-add-product]').click();
 await page.evaluate(()=>entry('owner'));assert.equal(await editor.count(),1);assert.equal(await editor.locator('[name=barcode]').getAttribute('required'),null);
 assert.equal(await editor.locator('[name=piecesPerUnit]').isVisible(),false);assert.equal(await editor.locator('[name=piecesPerUnit]').inputValue(),'1');
 await editor.locator('[name=name]').fill('صنف يدوي');await choose('category','مواد');await editor.locator('[name=salePrice]').fill('3.25');
 await choose('unit','أخرى');await editor.locator('[name=unit]').fill('وحدة خاصة');await choose('unit','كغم');await choose('unit','أخرى');assert.equal(await editor.locator('[name=unit]').inputValue(),'وحدة خاصة');
 await page.evaluate(()=>{hold=true;fail=true;});await editor.locator('button.primary').click();await page.waitForFunction(()=>typeof release==='function');
 assert.equal(await editor.locator('[data-close]').isDisabled(),true);await page.keyboard.press('Escape');assert.equal(await editor.count(),1);
 await page.evaluate(()=>document.querySelector('dialog.inventory-editor form').dispatchEvent(new Event('submit',{cancelable:true})));assert.equal(await page.evaluate(()=>calls.length),1);
 await page.evaluate(()=>{hold=false;release();});await editor.getByText('فشل الحفظ التجريبي').waitFor();await editor.locator('button.primary').click();await page.waitForFunction(()=>saved===1);
 const attempts=await page.evaluate(()=>calls);assert.equal(attempts.length,2);assert.deepEqual(attempts[0],attempts[1]);assert.match(attempts[0].barcode,/^MANUAL-\d+$/);assert.equal(attempts[0].pieces_per_purchase_unit,1);assert.equal(attempts[0].default_sale_price,3.25);assert.equal(attempts[0].purchase_unit,'وحدة خاصة');assert.equal('quantity_pieces' in attempts[0],false);
 await page.locator('[data-product-id=a]').click();await page.locator('dialog [data-edit]').click();assert.equal(await editor.locator('[name=piecesPerUnit]').inputValue(),'1.5');assert.equal(await editor.locator('[name=unit]').inputValue(),'علبة');
 await page.evaluate(()=>{document.querySelector('dialog.inventory-editor [name=barcode]').value='tampered';document.querySelector('dialog.inventory-editor [name=piecesPerUnit]').value='100';});
 await editor.locator('button.primary').click();await page.waitForFunction(()=>saved===2);const edit=await page.evaluate(()=>calls.at(-1));assert.equal(edit.barcode,'001');assert.equal(edit.pieces_per_purchase_unit,1.5);assert.equal(edit.default_sale_price,2);assert.equal('quantity_pieces' in edit,false);
 await page.locator('[data-add-product]').click();await editor.locator('[name=name]').fill('متأخر');await choose('category','مواد');await editor.locator('[name=salePrice]').fill('2');
 await page.evaluate(()=>{hold=true;window.pendingSave=document.querySelector('dialog.inventory-editor form').onsubmit({preventDefault(){}});});await page.waitForFunction(()=>calls.length===4);
 await page.evaluate(async()=>{document.querySelector('dialog.inventory-editor').remove();hold=false;release();await pendingSave;});assert.equal(await page.evaluate(()=>saved),2);
 await page.evaluate(()=>show('viewer'));assert.equal(await page.locator('[data-add-product],[data-scan-add-product]').count(),0);
 assert.equal(await page.evaluate(()=>{try{entry('viewer');return false;}catch{return true;}}),true);
 await page.evaluate(()=>{active=false;});assert.equal(await page.evaluate(()=>entry('owner')===null),true);
 assert.equal(await page.evaluate(()=>JSON.stringify(rows)===original&&localStorage.length+sessionStorage.length===0),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: owner sticky scan/manual actions, duplicate barcode before creation, read-only scanned/edit identity, native unit choice/custom retention and one-piece creation, stable manual barcode/UUID retry, single busy save/Escape, preserved fractional legacy conversion, viewer/stale guards, unchanged stock and RTL/mobile');
}finally{await browser.close();await preview.close();}
