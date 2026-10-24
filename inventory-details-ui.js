import {escape,money,timestamp} from './ui.js';
import {inventoryDetailsModel,inventoryPurchaseEntries} from './inventory-details.js';
import {popularityPresentation} from './inventory-popularity.js';
const quantities=new Intl.NumberFormat('ar-u-nu-latn',{maximumFractionDigits:3});
const formats={text:escape,count:value=>String(value),quantity:value=>quantities.format(value),unitCost:value=>money(value,4),money:value=>money(value,2),total:money};
const revisions=new WeakMap();
const tones={primary:'history-tone-primary',muted:'muted','popularity-0':'popularity-0','popularity-1':'popularity-1','popularity-2':'popularity-2','popularity-3':'popularity-3'};
const valueRows=rows=>rows.map(row=>`<div class="row inventory-detail-value"${row.popularity?' data-product-popularity aria-live="polite"':''}><span class="muted">${escape(row.label)}</span><b class="${tones[row.tone]||''}">${formats[row.kind](row.value)}${row.unit?' '+escape(row.unit):''}</b></div>`).join('');
export function updateInventoryPopularity(container,item,count,now=Date.now(),cached=false){
 if(!container?.isConnected)return;
 const row=container.querySelector('[data-product-popularity] b');if(!row)return;
 const status=popularityPresentation(item,count,now);
 row.textContent=status.count===null?'—':String(status.count);row.className=tones[status.tone]||'';
 container.querySelector('[data-popularity-unavailable]')?.remove();
 container.querySelector('[data-popularity-cached]')?.remove();
 if(status.unavailable){const note=document.createElement('p');note.className='muted small';note.dataset.popularityUnavailable='true';note.textContent='بيانات البيع غير متاحة بعد.';container.querySelector('[data-product-popularity]').after(note);}
 else if(cached){const note=document.createElement('p');note.className='muted small';note.dataset.popularityCached='true';note.textContent='العدد حسب آخر تحديث محفوظ.';container.querySelector('[data-product-popularity]').after(note);}
}

export async function renderInventoryDetails({api,projectId,item,container,isCurrent,aliases={},popularityCount=null,popularityCached=false}){
 if(!isCurrent()||!container.isConnected)return;
 const model=inventoryDetailsModel(item,{projectId,aliases,popularityCount});
 const revision=(revisions.get(container)||0)+1;revisions.set(container,revision);
 const current=()=>isCurrent()&&container.isConnected&&revisions.get(container)===revision;
 container.innerHTML=`<h2>${escape(model.name)}</h2><div class="panel" data-product-information>${model.category?`<p class="muted">${escape(model.category)}</p>`:''}${valueRows(model.values)}${model.popularityUnavailable?'<p class="muted small" data-popularity-unavailable>بيانات البيع غير متاحة بعد.</p>':''}${model.notes?`<h3>ملاحظات</h3><p>${escape(model.notes)}</p>`:''}<details data-product-valuation><summary>قيم المخزون</summary>${valueRows(model.valuation)}</details></div><h3>سجل الشراء</h3><section data-product-purchases aria-live="polite"></section>`;
 const history=container.querySelector('[data-product-purchases]');
 updateInventoryPopularity(container,item,popularityCount,Date.now(),popularityCached);
 let loading=false;
 const load=async()=>{
  if(loading||!current())return;
  loading=true;history.innerHTML='<p class="muted">جاري تحميل فواتير الشراء...</p>';
  try{
   const entries=inventoryPurchaseEntries(await api.productPurchaseHistory(projectId,model.id),{productId:model.id,projectId});
   if(!current())return;
   history.innerHTML=entries.map(entry=>`<article class="panel"><b>${escape(entry.date?timestamp(entry.date):'تاريخ غير متوفر')}</b>${entry.supplierName?`<p class="muted">المورد: ${escape(entry.supplierName)}</p>`:''}${valueRows(entry.values)}</article>`).join('')||'<p class="muted">لم يُشترَ هذا الصنف عبر فاتورة شراء بعد.</p>';
  }catch(error){
   if(!current())return;
   history.innerHTML='<p role="alert"></p><button type="button" class="outline" data-purchase-history-retry>إعادة المحاولة</button>';
   history.querySelector('[role=alert]').textContent=error.message||'تعذر تحميل سجل الشراء';
   history.querySelector('[data-purchase-history-retry]').onclick=load;
  }finally{loading=false;}
 };
 await load();
}
