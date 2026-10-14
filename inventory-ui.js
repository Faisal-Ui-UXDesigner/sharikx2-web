import {normalizeProduct,filterProducts,inventorySummary,visibleInventoryRows} from './inventory.js';
import {renderInventoryDetails,updateInventoryPopularity} from './inventory-details-ui.js';
import {openProductEditor,assertProductArchiveAllowed} from './inventory-mutation.js';
import {renderInventoryHistory} from './inventory-history-ui.js';
import {visibleCategories,categorySettingsState} from './inventory-category.js';
import {openInventoryCategorySettings} from './inventory-category-ui.js';
import {inventoryCardMarkup} from './inventory-card-ui.js';
import {renderInventoryCategoryBar} from './inventory-category-bar-ui.js';
import {renderInventorySummary,openInventoryStatistics} from './inventory-statistics-ui.js';
import {readInventoryPopularity,refreshInventoryPopularity} from './inventory-popularity-cache.js';
import {pinnedIds,sortPinnedRows} from './inventory-pinned.js';
import {createInventoryPinOperation} from './inventory-pin-operation.js';
import {createInventoryViewStore} from './inventory-view-state.js';
import {openInventoryProductEntry} from './inventory-product-entry-ui.js';
import {icon} from './icons.js';
const activeRenders=new WeakMap();


export async function renderInventory(options){
 const {container,isCurrent}=options;
 if(!isCurrent()||!container.isConnected)return;
 const token={};activeRenders.set(container,token);
 const screenCurrent=()=>isCurrent()&&container.isConnected&&activeRenders.get(container)===token;
 const view=(options.viewStore||createInventoryViewStore()).forScope(options.projectId,options.mode);
 container.innerHTML='<div class="tabs"><button data-inventory-tab="current" class="primary" aria-pressed="true">البضاعة الحالية</button><button data-inventory-tab="history" aria-pressed="false">سجل الجرد</button></div><section data-inventory-body></section>';
 const body=container.querySelector('[data-inventory-body]');
 let generation=0;
 const show=async tab=>{
  if(!screenCurrent())return;
  view.dispatch({type:'tab',value:tab});
  const revision=++generation;
  const current=()=>screenCurrent()&&revision===generation;
  // Close an editor owned by the outgoing inventory screen.
  document.querySelectorAll('dialog.inventory-editor').forEach(dialog=>dialog.remove());
  body.innerHTML='<div class="skeleton"></div>';
  container.querySelectorAll('[data-inventory-tab]').forEach(button=>{
   const selected=button.dataset.inventoryTab===tab;
   button.classList.toggle('primary',selected);button.setAttribute('aria-pressed',String(selected));
  });
  const args={...options,container:body,isCurrent:current,view};
  try{
   if(tab==='history')await renderInventoryHistory(args);
   else await renderCurrentInventory(args);
  }catch(error){
   if(!current())return;
   body.innerHTML='<p role="alert"></p><button data-retry class="outline">إعادة المحاولة</button>';
   body.querySelector('[role=alert]').textContent=error.message;
   body.querySelector('[data-retry]').onclick=()=>show(tab);
  }
 };
 container.querySelectorAll('[data-inventory-tab]').forEach(button=>button.onclick=()=>show(button.dataset.inventoryTab));
 await show(view.getState().tab);
}

async function renderCurrentInventory({api,projectId,project,container,isCurrent,mode,onSaved,onPlans,view}){
 const rows=(await api.allRows('products',projectId,'*',{active:'eq.true'})).map(normalizeProduct);
 if(!isCurrent()||!container.isConnected)return;
 const productsById=new Map(rows.map(row=>[String(row.id),row]));
 let totals=inventorySummary(rows);
 const cachedPopularity=readInventoryPopularity(api,projectId);
 let popularity=cachedPopularity.counts||new Map(),popularityLoaded=cachedPopularity.counts!==null,popularityCached=cachedPopularity.cached;
 let settings={customCategories:[],hiddenCategories:[],aliases:{}},financeState={};
 try{const snapshot=await api.financeState(projectId);settings=categorySettingsState(snapshot);financeState=snapshot.state||{};}catch(error){if(mode==='owner')throw error;}
 if(!isCurrent()||!container.isConnected)return;
 const inventoryCategories=rows.map(row=>String(row.category||'').trim()).filter(Boolean);
 let pinned= new Set(pinnedIds(financeState));
 const categories=visibleCategories({customCategories:settings.customCategories,hiddenCategories:settings.hiddenCategories,inventoryCategories});
 container.innerHTML='<h2>البضاعة</h2><div data-inventory-summary></div>'+(mode==='owner'?'<button type="button" class="outline inventory-category-settings" data-category-settings>'+icon('filter',20)+'إعدادات البضاعة</button>':'')+'<div class="inventory-sticky-controls" data-inventory-controls><div class="inventory-search-wrap">'+icon('search',23)+'<input data-inventory-search type="search" aria-label="ابحث باسم الصنف أو الباركود" placeholder="ابحث باسم الصنف أو الباركود" enterkeyhint="search"></div>'+(mode==='owner'?'<div class="actions inventory-add-actions"><button type="button" class="primary" data-scan-add-product>'+icon('scan',22)+'<span>مسح باركود</span></button><button type="button" class="outline" data-add-product>'+icon('plus',22)+'<span>إضافة يدوياً</span></button></div>':'')+'<div class="inventory-category-bar" data-inventory-category-bar></div></div><h3 class="inventory-results-title">الأصناف الحالية</h3><div data-inventory-list></div>';
 const summary=container.querySelector('[data-inventory-summary]'),list=container.querySelector('[data-inventory-list]'),search=container.querySelector('[data-inventory-search]'),categoryBar=container.querySelector('[data-inventory-category-bar]');
 search.value=view.getState().query;
 let selectedCategory=view.getState().category;
 const current=()=>isCurrent()&&container.isConnected;
 const editorOptions=product=>({api,projectId,project,mode,product,rows,onSaved,onPlans,container,isCurrent:current,categoryOptions:visibleCategories({customCategories:settings.customCategories,hiddenCategories:settings.hiddenCategories,inventoryCategories,requiredCategory:product?.category}),categoryLabels:settings.aliases});
 const editProduct=product=>{if(current())return openProductEditor(editorOptions(product));};
 container.querySelector('[data-category-settings]')?.addEventListener('click',()=>openInventoryCategorySettings({api,projectId,container,isCurrent:current,inventoryCategories,mode,onSaved:()=>onSaved?.()}));
 let detailsDialog=null;
 const openDetails=async item=>{
  if(!item||!current())return;
  if(detailsDialog?.isConnected){detailsDialog.focus();return;}
  const dialog=document.createElement('dialog');dialog.innerHTML='<div class="details"><div class="skeleton"></div></div><div class="actions">'+(mode==='owner'?'<button data-edit class="outline">تعديل</button><button data-archive class="outline">حذف الصنف</button>':'')+'<button data-close class="primary">إغلاق</button></div>';container.append(dialog);dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>dialog.remove();
  detailsDialog=dialog;
  dialog.dataset.productDetailsId=String(item.id);
  dialog.querySelector('[data-close]').onclick=()=>{if(!archiving)dialog.remove();};
  dialog.addEventListener('cancel',event=>{event.preventDefault();if(!archiving)dialog.remove();});
  dialog.querySelector('[data-edit]')?.addEventListener('click',()=>{if(archiving||!current()||!dialog.isConnected)return;dialog.remove();editProduct(item);});
  let archiving=false;
  const showError=message=>{
   let alert=dialog.querySelector('[data-archive-error]');
   if(!alert){alert=document.createElement('p');alert.setAttribute('role','alert');alert.dataset.archiveError='true';dialog.insertBefore(alert,dialog.querySelector('.actions'));}
   alert.textContent=message;
  };
  dialog.querySelector('[data-archive]')?.addEventListener('click',async()=>{
   if(archiving||!current()||!dialog.isConnected)return;
   try{assertProductArchiveAllowed(mode,item);}catch(error){showError(error.message);return;}
   if(!window.confirm('هل تريد حذف '+(item.name||'هذا الصنف')+' من البضاعة؟'))return;
   archiving=true;
   const buttons=[...dialog.querySelectorAll('.actions button')];buttons.forEach(button=>button.disabled=true);
   try{await api.archiveProduct(item.id);}
   catch(error){if(current()&&dialog.isConnected){showError(error.message||'تعذر حذف الصنف؛ لم تتغير بيانات المخزون');buttons.forEach(button=>button.disabled=false);}archiving=false;return;}
   dialog.remove();
   const index=rows.indexOf(item);
   if(index>=0)rows.splice(index,1);
   productsById.delete(String(item.id));
   totals=inventorySummary(rows);
   if(current()){draw();onSaved?.();}
  });
  await renderInventoryDetails({api,projectId,item,container:dialog.querySelector('.details'),isCurrent:()=>current()&&dialog.isConnected,aliases:settings.aliases,popularityCount:popularityLoaded?(popularity.get(String(item.id))||0):null,popularityCached});
 };
 const draw=()=>{
  const filtered=filterProducts(sortPinnedRows(rows,{...financeState,inventoryPinnedIds:[...pinned]}),search.value,selectedCategory),visible=visibleInventoryRows(filtered,view.getState().visibleLimit);
  renderInventorySummary(summary,totals);
  const pinState=pinOperation.model();
  list.innerHTML=visible.map(item=>inventoryCardMarkup(item,{aliases:settings.aliases,popularity:popularityLoaded?(popularity.get(String(item.id))||0):null,pinned:pinned.has(String(item.id)),mode,pinDisabled:pinState.busy||!!pinState.pending})).join('')||'<p class="muted">'+(search.value.trim()?'لا توجد أصناف مطابقة للبحث.':'لا توجد أصناف في هذا التصنيف.')+'</p>';
  if(filtered.length>visible.length){const more=document.createElement('button');more.type='button';more.className='outline';more.dataset.inventoryMore='true';more.textContent=`عرض المزيد من الأصناف (${filtered.length-visible.length})`;more.onclick=()=>{if(!current())return;const top=window.scrollY;view.dispatch({type:'more'});draw();window.scrollTo({top,behavior:'instant'});};list.append(more);}
 };
 const pinStatus=document.createElement('section');pinStatus.dataset.inventoryPinStatus='true';summary.after(pinStatus);
 const pinOperation=createInventoryPinOperation({api,projectId,state:financeState,mode,isCurrent:current,onChange:result=>{
  financeState=result.state;pinned=new Set(pinnedIds(financeState));draw();pinStatus.replaceChildren();
  if(result.busy){const message=document.createElement('p');message.setAttribute('role','status');message.textContent=result.pending?'جارٍ التحقق من نتيجة التثبيت…':'جارٍ حفظ تثبيت الصنف…';pinStatus.append(message);}
  if(result.error){const message=document.createElement('p');message.setAttribute('role','alert');message.textContent=result.error;pinStatus.append(message);}
  if(result.pending&&!result.busy){const verify=document.createElement('button');verify.type='button';verify.className='outline';verify.dataset.verifyInventoryPin='true';verify.textContent='التحقق من نتيجة التثبيت';verify.onclick=()=>{if(current())void pinOperation.verify();};pinStatus.append(verify);}
 }});
 const showStatistics=()=>openInventoryStatistics({container,totals,isCurrent:current});
 summary.onclick=showStatistics;
 // Delegate list clicks once; filtering does not rebuild event handlers.
 list.addEventListener('click',event=>{
  const pin=event.target.closest('[data-pin-id]');
  if(pin&&list.contains(pin)){event.preventDefault();event.stopPropagation();if(mode!=='owner'||!current()||!productsById.has(pin.dataset.pinId))return;void pinOperation.toggle(pin.dataset.pinId);return;}
  const button=event.target.closest('[data-product-id]');
  if(button&&list.contains(button))openDetails(productsById.get(button.dataset.productId));
 });
 search.oninput=()=>{if(!current())return;view.dispatch({type:'query',value:search.value});draw();};
 search.onkeydown=event=>{if(event.key==='Enter'&&current()){event.preventDefault();search.blur();}};
 selectedCategory=renderInventoryCategoryBar({container:categoryBar,categories,aliases:settings.aliases,selected:selectedCategory,isCurrent:current,onSelect:value=>{selectedCategory=value;view.dispatch({type:'category',value});draw();}});
 view.dispatch({type:'restore-category',value:selectedCategory});
 categoryBar.scrollLeft=view.getState().categoryScroll;
 categoryBar.onscroll=()=>{if(current())view.dispatch({type:'scroll',value:categoryBar.scrollLeft});};
 container.querySelector('[data-add-product]')?.addEventListener('click',()=>openInventoryProductEntry({...editorOptions(null),entryMode:'manual'}));
 container.querySelector('[data-scan-add-product]')?.addEventListener('click',()=>openInventoryProductEntry({...editorOptions(null),entryMode:'scan'}));
 draw();
 refreshInventoryPopularity(api,projectId).then(result=>{
  if(!current()||result.counts===null)return;
  popularity=result.counts;popularityLoaded=true;popularityCached=result.cached;draw();
  if(detailsDialog?.isConnected){const item=productsById.get(detailsDialog.dataset.productDetailsId);if(item)updateInventoryPopularity(detailsDialog.querySelector('.details'),item,popularity.get(String(item.id))||0,Date.now(),popularityCached);}
 }).catch(()=>{});
}
