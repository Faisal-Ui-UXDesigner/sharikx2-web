export async function openPurchasePayments(page){
 const details=page.locator('.purchase-dialog [data-purchase-payments]');
 if(await details.evaluate(node=>!node.open))await details.locator(':scope > summary').click();
 const advanced=page.locator('.purchase-dialog [data-purchase-advanced-payments]');
 if(await advanced.evaluate(node=>!node.open))await advanced.locator('summary').click();
}
export async function selectPurchaseSupplier(page,id){
 const select=page.locator('.purchase-dialog [name=supplier]');
 const index=await select.evaluate((node,id)=>[...node.options].filter(option=>option.value!=='').findIndex(option=>option.value===id),id);
 if(index<0)throw new Error('Fixture supplier is unavailable: '+id);
 await page.locator('[data-choose-purchase-supplier]').click();
 await page.locator(`[data-purchase-supplier-index="${index}"]`).click();
}
