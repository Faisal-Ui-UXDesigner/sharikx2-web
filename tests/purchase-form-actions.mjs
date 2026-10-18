export async function openPurchasePayments(page){
 const details=page.locator('.purchase-dialog [data-purchase-payments]');
 if(await details.evaluate(node=>!node.open))await details.locator('summary').click();
}
