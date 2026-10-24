import {chooseSaleProduct,openSalePayment,backToSaleCart,submitSalePayment,fillSaleLine,openSaleLineDetails} from './sale-picker-actions.mjs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:393,height:874},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl" lang="ar"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body></body></html>');
 await page.evaluate(async()=>{
  const {openSale}=await import('/sale.js');window.current=true;window.writes=0;window.products=[{id:'kg',name:'سكر <img src=x>',barcode:'0001',purchase_unit:'كغم',quantity_pieces:2,default_sale_price:4,weighted_unit_cost:2,category:'مواد'},...Array.from({length:30},(_,i)=>({id:'p'+i,name:'صنف '+i,barcode:'B'+i,purchase_unit:'قطعة',quantity_pieces:5,default_sale_price:1.25,weighted_unit_cost:1,category:'تصنيف '+i}))];window.original=JSON.stringify(products);
  const api={allRows:async()=>structuredClone(products),summary:async()=>({accounts:[{id:'bank',name:'البنك',balance:0}]}),rpc:()=>{writes++;throw Error('No writes allowed');}};
  window.show=()=>openSale({api,projectId:'fixture',mode:'owner',storage:sessionStorage,isCurrent:()=>current});await show();
 });
 assert.equal(await page.locator('[data-picker-decrease=kg]').isDisabled(),true);await chooseSaleProduct(page,'[data-picker-increase=kg]');await chooseSaleProduct(page,'[data-picker-increase=kg]');
 assert.equal(await page.locator('[data-picker-quantity=kg]').innerText(),'2');assert.equal(await page.locator('[data-picker-increase=kg]').isDisabled(),true);assert.equal(await page.locator('[data-increase=kg]').isDisabled(),true);
 await chooseSaleProduct(page,'[data-picker-decrease=kg]');await chooseSaleProduct(page,'[data-picker-decrease=kg]');assert.equal(await page.locator('[data-line=kg]').count(),0);
 await chooseSaleProduct(page,'[data-picker-increase=kg]');await backToSaleCart(page);await fillSaleLine(page,'[data-qty=kg]','.25');assert.equal(await page.locator('[data-picker-quantity=kg]').innerText(),'0.25');
 await chooseSaleProduct(page,'[data-picker-increase=kg]');assert.equal(await page.locator('[data-qty=kg]').inputValue(),'0.5');
 await page.locator('[data-barcode-scan]').fill('0001');await page.locator('[data-barcode-scan]').press('Enter');assert.equal(await page.locator('[data-qty=kg]').inputValue(),'0.75');
 await backToSaleCart(page);await fillSaleLine(page,'[data-price=kg]','3.3333');assert.match(await page.locator('[data-line-amount=kg]').innerText(),/2\.5/);assert.equal(await page.locator('[data-price=kg]').inputValue(),'3.3333');
 await backToSaleCart(page);await fillSaleLine(page,'[data-line-total=kg]','1.23');assert.equal(await page.locator('[data-price=kg]').inputValue(),'1.64');assert.match(await page.locator('[data-line-amount=kg]').innerText(),/1\.23/);assert.equal(await page.locator('[data-warning=kg]').isVisible(),true);
 assert.equal(await page.locator('[data-line=kg] img').count(),0);assert.match(await page.locator('[data-line=kg]').innerText(),/0001/);
 await backToSaleCart(page);await fillSaleLine(page,'[data-qty=kg]','2');assert.equal(await page.locator('[data-increase=kg]').isDisabled(),true);await backToSaleCart(page);await fillSaleLine(page,'[data-qty=kg]','2.001');assert.equal(await page.locator('[data-qty=kg]').evaluate(node=>node.checkValidity()),false);
 await backToSaleCart(page);await fillSaleLine(page,'[data-qty=kg]','.375');assert.equal(await page.locator('[data-increase=kg]').isDisabled(),false);
 // Selection updates preserve the actual picker nodes, focus and independent scroll.
 await page.locator('[data-open-sale-picker]').click();
 await page.evaluate(()=>{const list=document.querySelector('.product-picker');list.scrollTop=0;window.selectedButton=document.querySelector('[data-picker-increase=p0]');selectedButton.focus();});
 await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.querySelector('[data-picker-increase=p0]')===selectedButton&&document.activeElement===selectedButton),true);
 await page.locator('[data-search]').fill('B0');assert.equal(await page.locator('[data-product]').count(),1);assert.equal(await page.locator('[data-picker-quantity=p0]').innerText(),'1');await page.locator('[data-search]').fill('');
 for(const width of [320,393,720]){await page.setViewportSize({width,height:874});const overflow=await page.locator('.sale-dialog').evaluate(root=>{const edge=root.getBoundingClientRect();return [...root.querySelectorAll('*')].filter(node=>{const box=node.getBoundingClientRect();return box.width&&(box.right>edge.right+1||box.left<edge.left-1)&&!node.closest('[data-sale-categories]');}).map(node=>({tag:node.tagName,class:node.className,width:node.getBoundingClientRect().width,text:node.textContent.slice(0,45)})).slice(0,10);});assert.equal(await page.locator('.sale-dialog').evaluate(node=>node.scrollWidth>node.clientWidth),false,JSON.stringify({width,overflow}));}
 await mkdir('tests/screenshots/native-v126',{recursive:true});await page.setViewportSize({width:393,height:874});await page.evaluate(async()=>{await document.fonts.ready;document.querySelector('.sale-dialog').scrollTop=0;});await page.screenshot({path:'tests/screenshots/native-v126/sale-picker.png'});
 await page.locator('[data-apply-sale-picker]').click();
 await page.locator('[data-line=kg]').scrollIntoViewIfNeeded();await page.screenshot({path:'tests/screenshots/native-v126/sale-cart.png'});
 await openSalePayment(page);await page.locator('[name=account]').check();await submitSalePayment(page);await page.locator('.sale-review').waitFor();assert.equal(await page.evaluate(()=>writes),0);await page.locator('[data-back-sale-review]').click();assert.equal(await page.locator('[data-qty=kg]').inputValue(),'0.375');
 await page.setViewportSize({width:720,height:420});assert.equal(await page.locator('.sale-confirmation').evaluate(node=>getComputedStyle(node).position),'static');await page.setViewportSize({width:393,height:874});
 await page.evaluate(()=>current=false);await page.locator('[data-picker-increase=p0]').evaluate(button=>button.click());assert.equal(await page.locator('[data-qty=p0]').inputValue(),'1');assert.equal(await page.evaluate(()=>JSON.stringify(products)===original),true);assert.equal(await page.evaluate(()=>writes),0);assert.equal(await page.evaluate(()=>sessionStorage.getItem('sharikx2-pending-sale:fixture')),null);assert.deepEqual(errors,[]);
 console.log('PASS: native sale picker quantities/stock caps, measured steps/barcodes, exact editable price and live line amounts, safe barcode/name metadata, stable nodes/focus, 320/393/720px and short landscape, review-back retention and stale/source/no-dispatch safety');
}finally{await browser.close();await preview.close();}
