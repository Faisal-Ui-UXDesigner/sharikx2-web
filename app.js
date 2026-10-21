import {Api} from './api.js';
import {appShellMarkup} from './app-shell-ui.js';
import {bindAppShellLayout} from './app-shell-layout.js';
import {escape,money,timestamp,status,setCurrency} from './ui.js';
import {openExpense,renderExpenses} from './expense.js';
import {openSale} from './sale.js';
import {renderActivity} from './activity.js';
import {openTransfer} from './transfer.js';
import {openPurchase} from './purchase.js';
import {openPayment} from './payment.js';
import {openCollection} from './collection.js';
import {openReturn} from './return-ui.js';
import {openSaleDetails} from './sale-details-ui.js';
import {openOnboarding} from './onboarding.js';
import {promptOpeningDistribution} from './opening-distribution-ui.js';
import {createReportState,renderReports} from './report-ui.js';
import {renderPartners} from './partners-ui.js';
import {renderFinancialAccounts} from './accounts-ui.js';
import {renderCurrencySettings} from './currency-ui.js';
import {themeController} from './theme-bootstrap.js';
import {renderThemeSettings} from './theme-ui.js';
import {renderFaq} from './faq-ui.js';
import {renderProjectSharing} from './project-sharing-ui.js';
import {renderDeviceControl} from './device-control-ui.js';
import {renderDeviceBanner} from './device-banner-ui.js';
import {renderInventory} from './inventory-ui.js';
import {createInventoryViewStore} from './inventory-view-state.js';
import {renderDebtDirectory} from './debt-directory-ui.js';
import {openDebtDetails} from './debt-details-ui.js';
import {openSupplierEditor} from './supplier-mutation.js';
import {openSupplierCreate} from './supplier-create-ui.js';
import {openCustomer} from './customer.js';
import {openCustomerEditor} from './customer-mutation.js';
import {bindPwaInstall} from './pwa-install.js';
let sessionStore=null;try{sessionStore=window.sessionStorage;}catch{}
let identityStore=null;try{identityStore=window.localStorage;}catch{}
// Configuration is deliberately not cached. Offline shell startup must not crash
// or invent a backend/session when config.js cannot be loaded.
const api=new Api(window.SHARIKX2_CONFIG??{url:'',publicKey:''},sessionStore),app=document.querySelector('#app');
let project=null,mode='owner',screen='cashier',epoch=0,accountPeriod='month';
let reportState=createReportState();
let inventoryViewStore=createInventoryViewStore();
let releaseShellLayout=()=>{};
bindPwaInstall({root:document.querySelector('#install-action')});
function notice(message){document.querySelector('#notice').textContent=message;}
function entry(){releaseShellLayout();releaseShellLayout=()=>{};epoch++;api.clearDeviceContext();project=null;setCurrency('ILS');reportState=createReportState();inventoryViewStore=createInventoryViewStore();openOnboarding({app,api,storage:sessionStore,onOpen:(opened,role)=>{project=opened;mode=role;setCurrency(project.currency);screen='cashier';shell();void promptOpeningDistribution({api,storage:sessionStore,projectId:opened.id,mode:role,isCurrent:()=>project?.id===opened.id&&mode===role,onComplete:shell}).catch(error=>{if(project?.id===opened.id)notice(error.message);});}});}
function shell(){
 releaseShellLayout();
 const revision=++epoch;
 api.setDeviceContext({projectId:project.id,mode,identityStorage:identityStore});
 app.innerHTML=appShellMarkup({project,mode,screen});
 releaseShellLayout=bindAppShellLayout(app.querySelector('.native-app'));
 app.querySelector('[data-menu]').onclick=()=>{const dialog=document.createElement('dialog');dialog.innerHTML=`<h2>القائمة</h2><div class="menu-list"><button data-go="settings">الإعدادات</button><button data-go="accounts">الحسابات</button><button data-go="cashier">الكاشير</button><button data-go="products">البضاعة</button><button data-go="partners">الشركاء</button><button data-go="reports">التقارير</button><button data-logout>تسجيل الخروج</button></div><button data-close class="outline">إغلاق</button>`;app.append(dialog);dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>dialog.remove();dialog.querySelector('[data-logout]').onclick=()=>{api.clearSession();dialog.remove();entry();};dialog.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{screen=b.dataset.go;dialog.remove();shell();});};
 app.querySelector('[data-notifications]').onclick=()=>{const d=document.createElement('dialog');d.innerHTML='<h2>الإشعارات</h2><p class="muted">لا توجد إشعارات لعرضها حاليًا.</p><button class="primary">إغلاق</button>';app.append(d);d.showModal();d.querySelector('button').onclick=()=>d.remove();};
 app.querySelector('[data-plan]').onclick=()=>{const d=document.createElement('dialog');d.innerHTML=`<h2>حالة الحساب</h2><div class="panel">${mode==='viewer'?'المشروع متاح للمشاهدة فقط':project.subscription_status==='active'?'الاشتراك فعّال':'الخطة المجانية فعّالة'}</div><button class="primary">فهمت</button>`;app.append(d);d.showModal();d.querySelector('button').onclick=()=>d.remove();};
 app.querySelector('[data-subscribe]')?.addEventListener('click',()=>{screen='plans';shell();});
 app.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{screen=b.dataset.page;shell();});
 const content=app.querySelector('#content');content.innerHTML='<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';window.scrollTo({top:0,behavior:'instant'});load(content,revision);
 renderDeviceBanner({api,container:app.querySelector('.workspace'),project,mode,identityStorage:identityStore,isCurrent:()=>revision===epoch});
}
async function load(content,revision){try{
 if(screen==='settings'){
  content.innerHTML='<h2>الإعدادات</h2>';
  renderThemeSettings({container:content,controller:themeController,isCurrent:()=>revision===epoch});
  renderProjectSharing({api,container:content,project,mode,isCurrent:()=>revision===epoch});
  renderDeviceControl({api,container:content,project,mode,isCurrent:()=>revision===epoch});
  renderCurrencySettings({api,container:content,project,mode,isCurrent:()=>revision===epoch,onSaved:shell});
  const faq=document.createElement('button');faq.type='button';faq.className='outline';faq.dataset.openFaq='';faq.textContent='الأسئلة الشائعة';content.append(faq);faq.onclick=()=>{if(revision===epoch&&content.isConnected){screen='faq';shell();}};
 }else if(screen==='faq'){
  renderFaq({container:content,isCurrent:()=>revision===epoch,onBack:()=>{screen='settings';shell();}});
 }else if(screen==='accounts'){
  await renderFinancialAccounts({api,project,container:content,isCurrent:()=>revision===epoch,periodMode:accountPeriod,onPeriodChange:value=>{accountPeriod=value;shell();},mode,onTransfer:mode==='owner'&&window.SHARIKX2_CONFIG.transfers===true?()=>openTransfer({api,projectId:project.id,mode,storage:sessionStore,onSaved:shell}):undefined});
  if(revision!==epoch)return;
  renderCurrencySettings({api,container:content,project,mode,isCurrent:()=>revision===epoch,onSaved:shell});
 }else if(['customers','suppliers'].includes(screen)){
  const kind=screen,projectId=project.id,current=()=>revision===epoch;
  const options={api,projectId,mode,storage:sessionStore,isCurrent:current,onSaved:shell};
  await renderDebtDirectory({container:content,kind,mode,isCurrent:current,loadSnapshot:()=>api.debts(projectId),
   onBack:()=>{screen='cashier';shell();},onOpen:person=>personDetails(kind,person),
   onAdd:()=>kind==='customers'?openCustomer(options):openSupplierCreate(options),onPurchase:()=>openPurchase(options),
   onEdit:person=>kind==='customers'?openCustomerEditor({...options,customer:person}):openSupplierEditor({...options,supplier:person}),
   onPayment:person=>personPayment(kind,person,revision,projectId),
   onArchive:async person=>{if(window.confirm('هل تريد أرشفة المورد؟')){await api.archiveSupplier(projectId,person.id);if(current())shell();}}
  });
 }else if(screen==='cashier'){
  content.innerHTML=`<section class="cashier-intro"><h2>الكاشير</h2><p class="muted">سجّل المبيعات والديون والمصروفات من مكان واحد</p></section><div class="cashier-grid"><button data-sale><span class="action-icon"><img src="./assets/icon_cashier_colorful.png" alt=""></span><b>مبيعة جديدة</b></button><button data-customers><span class="action-icon"><img src="./assets/icon_customer_debt_colorful.png" alt=""></span><b>ديون الزبائن</b></button><button data-suppliers><span class="action-icon"><img src="./assets/icon_supplier_debt_colorful.png" alt=""></span><b>حسابات الموردين</b></button><button data-expense><span class="action-icon"><img src="./assets/icon_expense_colorful.png" alt=""></span><b>مصروف جديد</b></button></div><button class="purchase-action" data-purchase><img src="./assets/icon_purchase_colorful.png" alt=""><span>تسجيل فاتورة شراء</span></button><section data-activity></section>`;
  content.querySelector('[data-customers]').onclick=()=>{screen='customers';shell();};content.querySelector('[data-suppliers]').onclick=()=>{screen='suppliers';shell();};
  if(mode==='owner'){content.querySelector('[data-sale]').onclick=()=>openSale({api,projectId:project.id,mode,storage:sessionStore,isCurrent:()=>revision===epoch,onSaved:shell});content.querySelector('[data-expense]').onclick=()=>openExpense({api,projectId:project.id,mode,container:app,storage:sessionStore,isCurrent:()=>revision===epoch,onSaved:shell});content.querySelector('[data-purchase]').onclick=()=>openPurchase({api,projectId:project.id,mode,storage:sessionStore,isCurrent:()=>revision===epoch,onSaved:shell});}else{content.querySelectorAll('[data-sale],[data-expense],[data-purchase]').forEach(b=>{b.disabled=true;b.title='المشروع للمشاهدة فقط';});}
  await renderActivity({api,projectId:project.id,container:content.querySelector('[data-activity]'),isCurrent:()=>revision===epoch,mode,onSaved:shell,storage:sessionStore,allowMutations:window.SHARIKX2_CONFIG.expenseMutations===true,onSale:saleDetails});
 }else if(screen==='plans'){
  const features=[['حفظ المعلومات والحسابات','دائم','دائم'],['عدد الشركاء','2','غير محدود'],['المبيعات اليومية','100','غير محدود'],['أصناف البضاعة','25','غير محدود'],['عدد الموردين','5','غير محدود'],['تقارير شاملة','غير متاح','متاح'],['مشاركة المشروع','غير متاح','غير محدود']];
  content.innerHTML=`<section class="plans-screen"><h2>أهلًا وسهلًا بك</h2><p class="muted">استمتع باستخدام كامل المزايا بالنسخة المدفوعة</p><div class="plans-table"><div class="plan-head"><b>وجه المقارنة</b><b>المجاني</b><b>المدفوع ♛</b></div>${features.map(([title,free,paid])=>`<div class="plan-row"><span>${escape(title)}</span><span>${escape(free)}</span><span>${escape(paid)}</span></div>`).join('')}</div><div class="panel plan-price"><small>سعر الاشتراك الشهري</small><strong>30 ₪</strong><p class="muted">جميع المزايا الكاملة بدون قيود</p></div></section>`;
 }else if(screen==='reports'){
  await renderReports({api,project,container:content,state:reportState,isCurrent:()=>revision===epoch,onAccounts:()=>{screen='accounts';shell();},onPlans:()=>{screen='plans';shell();}});
 }else if(screen==='partners'){
  await renderPartners({api,projectId:project.id,project,storage:sessionStore,container:content,mode,isCurrent:()=>revision===epoch,onSaved:shell,onPlans:()=>{screen='plans';shell();}});
 }else if(screen==='products'){
  await renderInventory({api,projectId:project.id,project,container:content,isCurrent:()=>revision===epoch,mode,onSaved:shell,onPlans:()=>{screen='plans';shell();},viewStore:inventoryViewStore});
 }else{
  const table=screen==='cashier'?'sales':'products';const select=table==='sales'?'*,customer:sharikx2_customers(name,phone)':'*';let rows=await api.rows(table,project.id,select,0,table==='products'?{active:'eq.true'}:{});if(revision!==epoch)return;let offset=rows.length,hasMore=rows.length===20;
  content.innerHTML=`<h2>${table==='sales'?'سجل المبيعات':'البضاعة'}</h2><p class="muted small">عرض للقراءة فقط — عمليات الإضافة والتعديل قيد التنفيذ.</p><label>بحث في السجلات المحملة<input id="search" type="search" placeholder="ابحث بالاسم أو الرقم"></label><div id="rows"></div><p id="list-error" role="alert"></p><button id="more" class="outline">تحميل المزيد</button>`;
  if(table==='sales'){renderExpenses({api,projectId:project.id,container:content,isCurrent:()=>revision===epoch,mode,onSaved:shell,allowMutations:window.SHARIKX2_CONFIG.expenseMutations===true});if(mode==='owner'){const actions=document.createElement('div');actions.className='actions';actions.innerHTML='<button class="primary" data-new-sale>مبيعة جديدة</button><button data-new-expense>مصروف جديد</button>';content.prepend(actions);actions.querySelector('[data-new-sale]').onclick=()=>openSale({api,projectId:project.id,mode,storage:sessionStore,isCurrent:()=>revision===epoch,onSaved:()=>{notice('تم اعتماد المبيعة وإضافة المبلغ للحساب');shell();}});actions.querySelector('[data-new-expense]').onclick=()=>openExpense({api,projectId:project.id,mode,container:app,isCurrent:()=>revision===epoch,onSaved:()=>{notice('تم تسجيل المصروف وخصمه من الحساب');shell();},storage:sessionStore});}}
  const draw=()=>{const q=content.querySelector('#search').value;const shown=rows.filter(x=>`${x.name||''} ${x.customer?.name||''} ${x.sale_number||''}`.includes(q));content.querySelector('#rows').innerHTML=shown.map(x=>table==='sales'?`<button class="panel row record" data-sale="${escape(x.id)}"><div><b>مبيعة #${escape(x.sale_number)}</b><p>${escape(x.customer?.name||'زبون غير محدد')}</p><p class="muted">${escape(x.customer?.phone||'بدون رقم جوال')}</p><small>${escape(timestamp(x.created_at))}</small></div><div><strong>${money(x.total)}</strong><span class="badge">${escape(status(x.status))}</span></div></button>`:`<article class="panel"><p class="eyebrow">${escape(x.category||'بدون تصنيف')}</p><h2>${escape(x.name)}</h2><div class="metrics"><span>الوحدة<br><b>${escape(x.unit||'قطعة')}</b></span><span>سعر البيع<br><b>${money(x.sale_price,2)}</b></span></div><p class="muted">${escape(x.notes||'')}</p></article>`).join('')||'<div class="panel">لا توجد نتائج</div>';content.querySelector('#more').hidden=!hasMore;content.querySelectorAll('[data-sale]').forEach(b=>b.onclick=()=>saleDetails(b.dataset.sale));};
  content.querySelector('#search').oninput=draw;content.querySelector('#more').onclick=async e=>{const b=e.target;b.disabled=true;b.textContent='جارٍ التحميل…';try{const next=await api.rows(table,project.id,select,offset,table==='products'?{active:'eq.true'}:{});if(revision!==epoch)return;rows.push(...next);offset+=next.length;hasMore=next.length===20;draw();}catch(error){content.querySelector('#list-error').textContent=error.message;}finally{b.disabled=false;b.textContent='تحميل المزيد';}};draw();
 }
}catch(error){if(revision!==epoch)return;content.innerHTML='<div class="panel"><p role="alert"></p><button class="outline">إعادة المحاولة</button></div>';content.querySelector('p').textContent=error.message;content.querySelector('button').onclick=shell;}}
function saleDetails(id){const revision=epoch,projectId=project.id;return openSaleDetails({api,container:app,projectId,saleId:id,mode,storage:sessionStore,isCurrent:()=>revision===epoch,onReturn:sale=>openReturn({api,projectId,mode,sale,storage:sessionStore,isCurrent:()=>revision===epoch,onSaved:()=>shell()})});}
function personPayment(kind,person,revision=epoch,projectId=project.id){
 if(revision!==epoch)return;
 const options={api,projectId,mode,storage:sessionStore,isCurrent:()=>revision===epoch,onSaved:shell};
 return kind==='customers'?openCollection({...options,customer:person}):openPayment({...options,supplier:person});
}
function personDetails(kind,person){const revision=epoch,projectId=project.id;return openDebtDetails({api,container:app,projectId,kind,person,mode,storage:sessionStore,isCurrent:()=>revision===epoch,onSaved:shell,onDebtSale:customer=>openSale({api,projectId,mode,storage:sessionStore,initialCustomer:customer,isCurrent:()=>revision===epoch,onSaved:shell}),onCollect:person=>personPayment(kind,person,revision,projectId)});}
document.addEventListener('click',event=>{if(event.target.closest?.('#logout'))api.clearSession();},true);
entry();
if(!window.SHARIKX2_CONFIG)notice('تعذر تحميل إعدادات الاتصال؛ اتصل بالإنترنت ثم أعد تحميل التطبيق. لا يمكن تسجيل عمليات مالية دون اتصال.');
if('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').then(reg=>{reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller){const button=document.createElement('button');button.className='primary';button.textContent='تحديث التطبيق الآن';button.onclick=()=>{worker.postMessage({type:'SKIP_WAITING'});location.reload();};document.querySelector('#notice')?.append(button);}});});}).catch(()=>notice('تعذر تهيئة التثبيت؛ يمكنك الاستمرار باستخدام المتصفح'));
