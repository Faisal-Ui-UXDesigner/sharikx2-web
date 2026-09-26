const CACHE='sharikx2-shell-v14';
const SHELL=['./','./index.html','./styles.css','./app.js','./api.js','./ui.js','./operations.js','./expense.js','./expense-mutation.js','./sale.js','./customer.js','./activity.js','./transfer.js','./purchase.js','./payment.js','./collection.js','./return.js','./return-ui.js','./onboarding.js','./icons.js','./icon.svg','./manifest.webmanifest','./assets/cairo_regular.ttf','./assets/cairo_semibold.ttf','./assets/cairo_bold.ttf','./assets/icon_cashier_colorful.png','./assets/icon_customer_debt_colorful.png','./assets/icon_supplier_debt_colorful.png','./assets/icon_expense_colorful.png','./assets/icon_purchase_colorful.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sharikx2-shell-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  // Never cache sessions, financial requests, attachments, or configuration.
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!SHELL.some(path=>new URL(path,self.location.href).pathname===url.pathname))return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));
});
