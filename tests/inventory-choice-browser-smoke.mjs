import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="fixture"></main></body></html>');
 await page.evaluate(async()=>{
  const {openProductEditor}=await import('/inventory-mutation.js');window.active=true;window.writes=[];window.saved=0;
  window.options=['مواد','مخفي','<svg>'];window.aliases={مواد:'تموين','<svg>':'<img> '+'اسم طويل '.repeat(30)};window.original=JSON.stringify([options,aliases]);
  window.api={createProduct:async payload=>{writes.push(payload);return payload;},updateProduct:async(id,payload)=>{writes.push({id,...payload});return {id,...payload};}};
  window.open=product=>openProductEditor({api,projectId:'p',mode:'owner',product,container:document.querySelector('#fixture'),categoryOptions:options,categoryLabels:aliases,isCurrent:()=>active,onSaved:()=>saved++});open();
 });
 const editor=page.locator('dialog.inventory-editor'),picker=page.locator('[data-inventory-choice]');
 const choose=async(kind,label)=>{await editor.locator(`[data-choose-${kind}]`).click();await picker.getByRole('option',{name:label,exact:true}).click();};
 await editor.locator('[name=name]').fill('صنف');await editor.locator('[name=salePrice]').fill('7.25');await editor.locator('[name=notes]').fill('ملاحظات محفوظة');
 await editor.locator('[data-choose-category]').focus();await page.keyboard.press('Enter');assert.equal(await picker.count(),1);
 assert.equal(await picker.getByRole('option').count(),4);assert.equal(await picker.getByRole('option',{name:'اختر التصنيف',exact:true}).count(),0);assert.equal(await picker.locator('img,svg').count(),0);
 assert.equal(await editor.locator('fieldset').evaluate(el=>el.disabled),true);assert.equal(await editor.locator('[name=name]').isDisabled(),true);assert.equal(await editor.locator('button.primary').isDisabled(),true);
 await page.evaluate(()=>document.querySelector('dialog.inventory-editor form').dispatchEvent(new Event('submit',{cancelable:true})));assert.equal(await page.evaluate(()=>writes.length),0);
 await page.keyboard.press('Escape');assert.equal(await editor.count(),1);assert.equal(await picker.count(),0);assert.equal(await editor.locator('[name=notes]').inputValue(),'ملاحظات محفوظة');assert.equal(await editor.locator('[data-choose-category]').evaluate(el=>el===document.activeElement),true);
 await choose('category','تموين');assert.equal(await editor.locator('[name=category]').inputValue(),'مواد');
 await editor.locator('[data-choose-category]').click();assert.equal(await picker.getByRole('option',{name:'تموين',exact:true}).getAttribute('aria-selected'),'true');
 await page.keyboard.press('End');await page.keyboard.press('Space');assert.equal(await editor.locator('[name=customCategory]').isVisible(),true);assert.equal(await editor.locator('[name=customCategory]').inputValue(),'');
 await editor.locator('button.primary').click();await editor.getByText('اكتب تصنيف الصنف').waitFor();assert.equal(await page.evaluate(()=>writes.length),0);
 await editor.locator('[name=customCategory]').fill(' تصنيف خاص ');await choose('category','تموين');await choose('category','أخرى');assert.equal(await editor.locator('[name=customCategory]').inputValue(),'');
 await editor.locator('[name=customCategory]').fill(' تصنيف خاص ');await editor.locator('[data-choose-unit]').click();await page.keyboard.press('Escape');assert.equal(await editor.locator('[name=customCategory]').inputValue(),' تصنيف خاص ');
 await choose('unit','أخرى');await editor.locator('[name=unit]').fill('وحدة قديمة');await choose('unit','كغم');await choose('unit','أخرى');assert.equal(await editor.locator('[name=unit]').inputValue(),'وحدة قديمة');
 await page.evaluate(()=>{document.querySelector('dialog.inventory-editor [name=category]').value='tampered';document.querySelector('dialog.inventory-editor [name=unitChoice]').value='tampered';});await editor.locator('button.primary').click();await page.waitForFunction(()=>saved===1);
 const payload=await page.evaluate(()=>writes[0]);assert.equal(payload.category,'تصنيف خاص');assert.equal(payload.purchase_unit,'وحدة قديمة');assert.equal(payload.default_sale_price,7.25);assert.equal(payload.notes,'ملاحظات محفوظة');assert.equal('quantity_pieces' in payload,false);
 await page.evaluate(()=>open({id:'a',name:'قديم',barcode:'001',category:'غير متاح',displayUnit:'علبة',piecesPerUnit:1.5,saleUnitPrice:3,lowStockQuantity:0}));
 assert.equal(await editor.locator('[name=customCategory]').inputValue(),'غير متاح');assert.equal(await editor.locator('[data-choose-category]').innerText(),'أخرى');await editor.locator('[data-choose-category]').click();assert.equal(await picker.getByRole('option',{name:'أخرى',exact:true}).getAttribute('aria-selected'),'true');await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 await page.evaluate(()=>open({id:'a',name:'قديم',barcode:'001',category:'مخفي',displayUnit:'قطعة',piecesPerUnit:1,saleUnitPrice:3,lowStockQuantity:0}));assert.equal(await editor.locator('[data-choose-category]').innerText(),'مخفي');
 await editor.locator('[data-choose-category]').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await picker.evaluate(el=>el.scrollWidth>el.clientWidth),false);
 await page.evaluate(()=>document.querySelector('dialog.inventory-editor').remove());await page.waitForFunction(()=>!document.querySelector('[data-inventory-choice]'));
 await page.evaluate(()=>{active=false;});assert.equal(await page.evaluate(()=>open()===null),true);
 assert.equal(await page.evaluate(()=>JSON.stringify([options,aliases])===original&&localStorage.length+sessionStorage.length===0),true);assert.deepEqual(errors,[]);
 console.log('PASS: shared native unit/category modal, positional aliases and hidden/unknown saved category, custom validation/clearing vs unit retention, locked no-write parent, Enter/Space/End/Escape/focus return, preserved fields, safe long labels, captured category/unit payload, detached/stale cleanup and mobile RTL');
}finally{await browser.close();await preview.close();}
