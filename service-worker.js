const CACHE='sharikx2-shell-v54';
const SHELL=['./','./index.html','./styles.css','./app.js','./api.js','./pagination.js','./product-contract.js','./ui.js','./reports.js','./report-ui.js','./subscription.js','./operations.js','./expense.js','./expense-mutation.js','./sale.js','./customer.js','./activity.js','./transfer.js','./purchase.js','./payment.js','./collection.js','./return.js','./return-ui.js','./financial.js','./statement.js','./accounts-ui.js','./inventory.js','./inventory-ui.js','./inventory-mutation.js','./onboarding.js','./icons.js','./icon.svg','./manifest.webmanifest','./assets/cairo_regular.ttf','./assets/cairo_semibold.ttf','./assets/cairo_bold.ttf','./assets/icon_cashier_colorful.png','./assets/icon_customer_debt_colorful.png','./assets/icon_supplier_debt_colorful.png','./assets/icon_expense_colorful.png','./assets/icon_purchase_colorful.png'];
SHELL.push('./inventory-history.js','./inventory-history-ui.js','./inventory-category.js','./inventory-category-ui.js','./inventory-popularity.js','./inventory-pinned.js','./barcode-scanner.js','./debt-model.js','./debt-details.js','./supplier-mutation.js','./partner-mutation.js','./customer-mutation.js','./supplier-credit.js','./supplier-old-debt.js','./debt-details-ui.js','./debt-payment.js','./debt-payment-ui.js','./supplier-payment-review.js','./purchase-model.js','./currency.js','./currency-ui.js');
SHELL.push('./theme.js','./theme-ui.js','./theme-bootstrap.js');
SHELL.push('./sale-catalog.js');
SHELL.push('./sale-quantity.js');
SHELL.push('./sale-pricing.js');
SHELL.push('./sale-recovery.js');
SHELL.push('./sale-drafts.js','./sale-drafts-ui.js');
SHELL.push('./partner-shares.js','./partners-ui.js');
SHELL.push('./retention.js','./retention-ui.js','./finance-state-save.js');
SHELL.push('./sale-review.js','./sale-review-ui.js');
SHELL.push('./customer-contract.js','./customer-catalog.js','./sale-customers.js');
SHELL.push('./phone.js','./contact-ui.js','./supplier-contract.js');
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sharikx2-shell-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  // Never cache sessions, financial requests, attachments, or configuration.
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!SHELL.some(path=>new URL(path,self.location.href).pathname===url.pathname))return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));
});
