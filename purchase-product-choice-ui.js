import {createPurchaseProductChoices} from './purchase-product-choice.js';
import {escape} from './ui.js';

export function openPurchaseProductChoice({products,projectId,selectedId,mode,loadSettings,isCurrent=()=>true,onSelected,onClose}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 if(!isCurrent()||document.querySelector('dialog.purchase-product-choice'))return;
 const captured=createPurchaseProductChoices(products,projectId).products;
 const dialog=document.createElement('dialog');dialog.className='purchase-product-choice';
 dialog.innerHTML='<h2>اختر صنف فاتورة الشراء</h2><div data-choice-body></div><button type="button" data-cancel-choice class="outline">إلغاء</button>';
 document.body.append(dialog);dialog.showModal();let ended=false,loading=false,revision=0;
 const current=()=>!ended&&dialog.isConnected&&isCurrent();
 const finish=()=>{if(ended)return false;ended=true;revision++;observer.disconnect();dialog.remove();onClose?.();return true;};
 const observer=new MutationObserver(()=>{if(!current())finish();});observer.observe(document.documentElement,{childList:true,subtree:true});
 dialog.querySelector('[data-cancel-choice]').onclick=finish;dialog.oncancel=event=>{event.preventDefault();finish();};dialog.onclose=finish;
 const render=catalog=>{
  const body=dialog.querySelector('[data-choice-body]');body.innerHTML=`<label>ابحث باسم الصنف أو الباركود<input type="search" data-purchase-product-search autocomplete="off"></label><div class="tabs purchase-choice-categories" data-choice-categories>${catalog.categories.map(category=>`<button type="button" data-choice-category="${escape(category)}" aria-pressed="${category==='الكل'}" class="${category==='الكل'?'primary':''}">${escape(catalog.label(category))}</button>`).join('')}</div><p class="muted small" role="status" data-choice-count></p><div class="purchase-choice-results" data-choice-results></div>`;
  const search=body.querySelector('[data-purchase-product-search]'),tabs=body.querySelector('[data-choice-categories]'),list=body.querySelector('[data-choice-results]');let category='الكل';
  const draw=()=>{if(!current())return;const rows=catalog.search(search.value,category);list.innerHTML=rows.map(row=>`<button type="button" class="panel purchase-choice-product" data-choice-product="${escape(row.id)}" ${row.id===selectedId?'aria-current="true"':''}><b>${row.id===selectedId?'✓ ':''}${escape(row.name)}</b><small>${escape(catalog.label(row.category||'أخرى'))} · ${escape(row.barcode)}</small></button>`).join('')||'<p class="muted">لا توجد أصناف تطابق البحث والتصنيف</p>';body.querySelector('[data-choice-count]').textContent=`عدد النتائج: ${rows.length}`;list.scrollTop=0;};
  search.oninput=draw;
  tabs.onclick=event=>{if(!current())return;const button=event.target.closest('[data-choice-category]');if(!button||!tabs.contains(button)||button.dataset.choiceCategory===category)return;category=button.dataset.choiceCategory;tabs.querySelectorAll('button').forEach(tab=>{const selected=tab===button;tab.classList.toggle('primary',selected);tab.setAttribute('aria-pressed',String(selected));});draw();};
  list.onclick=event=>{if(!current())return;const button=event.target.closest('[data-choice-product]');if(!button||!list.contains(button))return;const product=catalog.get(button.dataset.choiceProduct);if(product&&finish())onSelected?.(product);};
  draw();search.focus();
 };
 const load=async()=>{
  if(loading||!current())return;loading=true;const attempt=++revision,body=dialog.querySelector('[data-choice-body]');body.innerHTML='<p role="status">جارٍ قراءة إعدادات التصنيفات…</p>';
  try{const settings=await loadSettings();if(current()&&attempt===revision)render(createPurchaseProductChoices(captured,projectId,settings));}
  catch(error){if(current()&&attempt===revision){body.innerHTML='<p role="alert"></p><button type="button" data-retry-choice class="outline">إعادة المحاولة</button>';body.querySelector('[role=alert]').textContent=error.message||'تعذر قراءة إعدادات التصنيفات';body.querySelector('[data-retry-choice]').onclick=load;}}
  finally{loading=false;}
 };
 load();return dialog;
}
