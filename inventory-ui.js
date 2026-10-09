import {escape,money,timestamp} from './ui.js';
import {normalizeProduct,filterProducts,inventorySummary,normalizePurchaseHistory,visibleInventoryRows} from './inventory.js';
import {openProductEditor,assertProductArchiveAllowed} from './inventory-mutation.js';
import {renderInventoryHistory} from './inventory-history-ui.js';
import {categorySet,visibleCategories,categorySettingsState,display} from './inventory-category.js';
import {openInventoryCategorySettings} from './inventory-category-ui.js';
import {loadInventoryPopularity,isTrending} from './inventory-popularity.js';
import {pinnedIds,isPinned,togglePinned,sortPinnedRows,savePinnedState} from './inventory-pinned.js';

const number=value=>Number.isFinite(Number(value))?Number(value):0;

function productCard(item,popularity=0,pinned=false,mode='viewer'){
 return '<button type="button" class="panel inventory-card" data-product-id="'+escape(item.id)+'"><div class="row"><span><b>'+escape(item.name||'صنف')+'</b>'+(isTrending(popularity)?'<span class="badge">رائج</span>':'')+'<small class="muted">'+escape(item.category||'بدون تصنيف')+' · '+escape(item.barcode||'بدون باركود')+'</small></span><span class="inventory-pin" data-pin-id="'+escape(item.id)+'" role="button" tabindex="0" aria-label="'+(pinned?'إلغاء تثبيت الصنف':'تثبيت الصنف')+'">'+(pinned?'📌':'📍')+'</span><strong>'+money(item.saleValue)+'</strong></div><div class="metrics"><span>الكمية<br><b>'+item.quantity.toLocaleString('ar-u-nu-latn',{maximumFractionDigits:3})+' '+escape(item.displayUnit)+'</b></span><span>تكلفة الوحدة<br><b>'+money(item.cost*item.piecesPerUnit,4)+'</b></span><span>سعر البيع<br><b>'+money(item.salePrice*item.piecesPerUnit,2)+'</b></span></div></button>';
}
function detailsMarkup(item,history,popularityCount=null){
 const historyRows=normalizePurchaseHistory(history).map(row=>'<article class="panel"><b>'+escape(row.purchaseDate?timestamp(row.purchaseDate):'تاريخ غير متوفر')+'</b><p class="muted">المورد: '+escape(row.supplierName)+'</p><p>الكمية: '+number(row.quantity_pieces).toLocaleString('ar-u-nu-latn')+' قطعة · تكلفة القطعة: '+money(row.unit_cost,2)+'</p><strong>'+money(row.line_total)+'</strong></article>').join('')||'<p class="muted">لم يُسجّل شراء لهذا الصنف عبر فاتورة.</p>';
 return '<h2>'+escape(item.name||'صنف')+'</h2><div class="panel"><p>التصنيف: '+escape(item.category||'بدون تصنيف')+'</p><p>الباركود: '+escape(item.barcode||'—')+'</p><p>الوحدة: '+escape(item.displayUnit)+'</p><p>الكمية الحالية: <b>'+item.quantity.toLocaleString('ar-u-nu-latn',{maximumFractionDigits:3})+' '+escape(item.displayUnit)+'</b></p><p>تكلفة الشراء الحالية: <b>'+money(item.cost*item.piecesPerUnit,4)+'</b></p><p>سعر البيع المتوقع: <b>'+money(item.salePrice*item.piecesPerUnit,2)+'</b></p><p>قيمة الشراء: <b>'+money(item.purchaseValue)+'</b></p><p>قيمة البيع المتوقعة: <b>'+money(item.saleValue)+'</b></p><p>الربح المتوقع: <b>'+money(item.expectedProfit)+'</b></p>'+(item.lowStockQuantity>0?'<p>تنبيه نقص البضاعة عند: '+item.lowStockQuantity+' '+escape(item.displayUnit)+'</p>':'')+(popularityCount!=null?'<p>عدد مرات البيع خلال 60 يومًا: <b>'+popularityCount+'</b></p>':'<p class="muted">بيانات البيع غير متاحة بعد.</p>')+(item.notes?'<p>ملاحظات: '+escape(item.notes)+'</p>':'')+'</div><h3>سجل الشراء</h3>'+historyRows;
}
export async function renderInventory(options){
 const {container,isCurrent}=options;
 container.innerHTML='<div class="tabs"><button data-inventory-tab="current" class="primary" aria-pressed="true">البضاعة الحالية</button><button data-inventory-tab="history" aria-pressed="false">سجل الجرد</button></div><section data-inventory-body></section>';
 const body=container.querySelector('[data-inventory-body]');
 let generation=0;
 const show=async tab=>{
  if(!isCurrent()||!container.isConnected)return;
  const revision=++generation;
  const current=()=>isCurrent()&&container.isConnected&&revision===generation;
  // Close an editor owned by the outgoing inventory screen.
  document.querySelectorAll('dialog.inventory-editor').forEach(dialog=>dialog.remove());
  body.innerHTML='<div class="skeleton"></div>';
  container.querySelectorAll('[data-inventory-tab]').forEach(button=>{
   const selected=button.dataset.inventoryTab===tab;
   button.classList.toggle('primary',selected);button.setAttribute('aria-pressed',String(selected));
  });
  const args={...options,container:body,isCurrent:current};
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
 await show('current');
}

async function renderCurrentInventory({api,projectId,container,isCurrent,mode,onSaved}){
 const rows=(await api.allRows('products',projectId,'*',{active:'eq.true'})).map(normalizeProduct);
 if(!isCurrent()||!container.isConnected)return;
 const productsById=new Map(rows.map(row=>[String(row.id),row]));
 let totals=inventorySummary(rows);
 let popularity=new Map(),popularityLoaded=false;
 let visibleLimit=20;
 let settings={customCategories:[],hiddenCategories:[],aliases:{}},financeState={};
 try{const snapshot=await api.financeState(projectId);settings=categorySettingsState(snapshot);financeState=snapshot.state||{};}catch(error){if(mode==='owner')throw error;}
 const inventoryCategories=rows.map(row=>String(row.category||'').trim()).filter(Boolean);
 let pinned= new Set(pinnedIds(financeState));
 const categories=visibleCategories({customCategories:settings.customCategories,hiddenCategories:settings.hiddenCategories,inventoryCategories});
 container.innerHTML='<h2>البضاعة</h2><div class="actions">'+(mode==='owner'?'<button class="primary" data-add-product>إضافة صنف</button><button class="outline" data-category-settings>إعدادات التصنيفات</button>':'')+'</div><div data-inventory-summary></div><div class="input-pair"><label>بحث<input data-inventory-search type="search" placeholder="اسم الصنف أو الباركود"></label><label>التصنيف<select data-inventory-category><option value="الكل">الكل</option>'+categories.map(x=>'<option value="'+escape(x)+'">'+escape(display(settings.aliases,x))+'</option>').join('')+'</select></label></div><div data-inventory-list></div>';
 const summary=container.querySelector('[data-inventory-summary]'),list=container.querySelector('[data-inventory-list]'),search=container.querySelector('[data-inventory-search]'),category=container.querySelector('[data-inventory-category]');
 const current=()=>isCurrent()&&container.isConnected;
 const editProduct=product=>openProductEditor({api,projectId,mode,product,rows,onSaved,isCurrent:current,categoryOptions:visibleCategories({customCategories:settings.customCategories,hiddenCategories:settings.hiddenCategories,inventoryCategories,requiredCategory:product?.category}),categoryLabels:settings.aliases});
 container.querySelector('[data-category-settings]')?.addEventListener('click',()=>openInventoryCategorySettings({api,projectId,container,isCurrent:current,inventoryCategories,onSaved:()=>onSaved?.()}));
 const openDetails=async item=>{
  if(!item||!current())return;
  const dialog=document.createElement('dialog');dialog.innerHTML='<div class="details"><div class="skeleton"></div></div><div class="actions">'+(mode==='owner'?'<button data-edit class="outline">تعديل</button><button data-archive class="outline">حذف الصنف</button>':'')+'<button data-close class="primary">إغلاق</button></div>';container.append(dialog);dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>dialog.remove();
  dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.remove();});
  dialog.querySelector('[data-edit]')?.addEventListener('click',()=>{dialog.remove();editProduct(item);});
  let archiving=false;
  const showError=message=>{
   let alert=dialog.querySelector('[role=alert]');
   if(!alert){alert=document.createElement('p');alert.setAttribute('role','alert');dialog.insertBefore(alert,dialog.querySelector('.actions'));}
   alert.textContent=message;
  };
  dialog.querySelector('[data-archive]')?.addEventListener('click',async()=>{
   if(archiving||!current())return;
   try{assertProductArchiveAllowed(mode,item);}catch(error){showError(error.message);return;}
   if(!window.confirm('هل تريد حذف '+(item.name||'هذا الصنف')+' من البضاعة؟'))return;
   archiving=true;
   const button=dialog.querySelector('[data-archive]');button.disabled=true;
   try{await api.archiveProduct(item.id);}
   catch(error){showError(error.message||'تعذر حذف الصنف؛ لم تتغير بيانات المخزون');archiving=false;button.disabled=false;return;}
   dialog.remove();
   const index=rows.indexOf(item);
   if(index>=0)rows.splice(index,1);
   productsById.delete(String(item.id));
   totals=inventorySummary(rows);
   if(current()){draw();onSaved?.();}
  });
  try{const history=await api.productPurchaseHistory(projectId,item.id);if(current()&&dialog.isConnected)dialog.querySelector('.details').innerHTML=detailsMarkup(item,history,popularityLoaded?(popularity.get(String(item.id))||0):null);}catch(error){if(current()&&dialog.isConnected)dialog.querySelector('.details').textContent=error.message;}
 };
 const draw=()=>{
  const filtered=filterProducts(sortPinnedRows(rows,{...financeState,inventoryPinnedIds:[...pinned]}),search.value,category.value),visible=visibleInventoryRows(filtered,visibleLimit);
  summary.innerHTML=`<div class="metrics panel inventory-summary-card" role="button" tabindex="0" aria-label="البضاعة بسعر الشراء، اضغط لعرض الإحصائيات">
   <span>عدد الأصناف<br><b>${totals.items}</b></span>
   <span>قيمة الشراء<br><b>${money(totals.purchaseValue)}</b></span>
   <span>الربح المتوقع<br><b>${money(totals.expectedProfit)}</b></span>
  </div>`;
  list.innerHTML=visible.map(item=>productCard(item,popularity.get(String(item.id))||0,pinned.has(String(item.id)),mode)).join('')||'<div class="panel"><p class="muted">لا توجد أصناف مطابقة.</p></div>';
  if(filtered.length>visible.length){const more=document.createElement('button');more.type='button';more.className='outline';more.dataset.inventoryMore='true';more.textContent=`عرض المزيد من الأصناف (${filtered.length-visible.length})`;more.onclick=()=>{const top=container.scrollTop;visibleLimit+=20;draw();container.scrollTop=top;};list.append(more);}
 };
 const showStatistics=()=>{const dialog=document.createElement('dialog');dialog.dataset.inventoryStatistics='true';dialog.innerHTML='<h2>إحصائيات البضاعة</h2><div class="panel"><p>البضاعة بسعر الشراء<br><b data-purchase-total></b></p><p>قيمة البيع المتوقعة<br><b data-sale-total></b></p><p>الربح المتوقع<br><b data-profit-total></b></p></div><button data-close class="primary">إغلاق</button>';container.append(dialog);dialog.showModal();dialog.querySelector('[data-purchase-total]').textContent=money(totals.purchaseValue);dialog.querySelector('[data-sale-total]').textContent=money(totals.saleValue);dialog.querySelector('[data-profit-total]').textContent=money(totals.expectedProfit);dialog.querySelector('[data-close]').onclick=()=>dialog.remove();dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.remove();});};
 summary.onclick=showStatistics;summary.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();showStatistics();}};
 // Delegate list clicks once; filtering does not rebuild event handlers.
 list.addEventListener('click',event=>{
  const pin=event.target.closest('[data-pin-id]');
  if(pin&&list.contains(pin)){event.preventDefault();event.stopPropagation();if(mode!=='owner')return;const id=pin.dataset.pinId,previous=new Set(pinned),result=togglePinned({...financeState,inventoryPinnedIds:[...pinned]},id);financeState=result.state;pinned=new Set(pinnedIds(result.state));draw();savePinnedState(api,projectId,result.state).catch(error=>{pinned=previous;financeState={...financeState,inventoryPinnedIds:[...previous]};draw();const alert=document.createElement('p');alert.setAttribute('role','alert');alert.textContent=error.message;container.prepend(alert);});return;}
  const button=event.target.closest('[data-product-id]');
  if(button&&list.contains(button))openDetails(productsById.get(button.dataset.productId));
 });
 search.oninput=()=>{visibleLimit=20;draw();};
 category.onchange=()=>{visibleLimit=20;draw();};
 container.querySelector('[data-add-product]')?.addEventListener('click',()=>editProduct(null));
 draw();
 loadInventoryPopularity(api,projectId).then(counts=>{if(!current())return;popularity=counts;popularityLoaded=true;draw();}).catch(()=>{});
}
