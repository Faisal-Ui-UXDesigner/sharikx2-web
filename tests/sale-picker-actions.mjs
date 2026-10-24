// Shared real UI action, not a DOM bypass: open, choose, explicitly apply.
export async function chooseSaleProduct(page,selector='[data-product]'){
 await backToSaleCart(page);
 await page.locator('[data-open-sale-picker]').click();
 await page.locator(selector).click();
 await page.locator('[data-apply-sale-picker]').click();
}

export async function backToSaleCart(page){
 if(await page.locator('.sale-dialog').getAttribute('data-sale-step')==='payment')await page.locator('[data-back-sale-payment]').click();
}

export async function openSaleLineDetails(page,selector){
 await backToSaleCart(page);
 const details=page.locator(selector).locator('xpath=ancestor::details[1]');
 if(await details.evaluate(node=>!node.open))await details.locator('summary').click();
}

export async function fillSaleLine(page,selector,value){
 await openSaleLineDetails(page,selector);await page.locator(selector).fill(value);
}

export async function openSalePayment(page){
 if(await page.locator('.sale-dialog').getAttribute('data-sale-step')==='cart')await page.locator('[data-continue-sale]').click();
 if(await page.locator('.sale-dialog').getAttribute('data-sale-step')==='payment')await page.waitForFunction(()=>document.querySelector('.sale-dialog')?.dataset.salePaymentReady==='true');
}

export async function submitSalePayment(page,{twice=false}={}){
 await openSalePayment(page);
 const phase=await page.locator('.sale-dialog').getAttribute('data-sale-step');if(phase!=='payment'&&phase!=='recovery')return;
 await page.locator('.sale-dialog>.body form').evaluate((form,repeat)=>{form.dispatchEvent(new Event('submit',{cancelable:true}));if(repeat)form.dispatchEvent(new Event('submit',{cancelable:true}));},twice);
}
