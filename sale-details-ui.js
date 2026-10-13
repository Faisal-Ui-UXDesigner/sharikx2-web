import {escape,money,timestamp,status} from './ui.js';
import {roundedWholeDisplay} from './money-display.js';
import {saleDetailsSnapshot} from './sale-details.js';
import {canReturnSale,hasPendingReturn} from './return.js';

export function openSaleDetails({api,container=document.body,projectId,saleId,mode,storage,isCurrent=()=>true,onReturn}){
 if(!projectId||!saleId)throw new Error('بيانات المبيعة غير مكتملة');
 if(!isCurrent()||[...document.querySelectorAll('.sale-details-dialog')].some(dialog=>dialog.dataset.project===projectId&&dialog.dataset.sale===saleId))return;
 const dialog=document.createElement('dialog');dialog.className='sale-details-dialog';dialog.dataset.project=projectId;dialog.dataset.sale=saleId;dialog.innerHTML='<h2>تفاصيل المبيعة</h2><div class="details"><div class="skeleton"></div></div><div class="actions"><button type="button" data-return hidden disabled>إرجاع مبيعة</button><button type="button" data-close-sale-details class="primary">إغلاق</button></div>';container.append(dialog);dialog.showModal();
 let ended=false,loading=false,revision=0;
 const current=()=>!ended&&dialog.isConnected&&isCurrent();
 const close=()=>{if(ended)return;ended=true;revision++;observer.disconnect();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!current())close();});observer.observe(document.documentElement,{subtree:true,childList:true});dialog.querySelector('[data-close-sale-details]').onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=close;
 const load=async()=>{
  if(!current()||loading)return;loading=true;const attempt=++revision,details=dialog.querySelector('.details'),returnButton=dialog.querySelector('[data-return]');returnButton.hidden=true;returnButton.disabled=true;details.innerHTML='<div class="skeleton"></div>';
  try{const source=await api.sale(projectId,saleId);if(!current()||attempt!==revision)return;const view=saleDetailsSnapshot(source,projectId,saleId);
   details.innerHTML=`<div class="panel row"><div><b>${escape(view.customerName)}</b><p>${escape(view.customerPhone)}</p><small>${escape(timestamp(view.date))}</small></div><div><small>إجمالي المبيعة الحالي</small><h2 data-details-total>${money(roundedWholeDisplay(view.total))}</h2></div></div><p>الحالة: ${escape(status(view.sale.status))}${view.accountName?` · الاستلام: ${escape(view.accountName)}`:''}</p><h2>أصناف المبيعة</h2>${view.items.map(item=>`<div class="panel row"><div><b>${escape(item.name)}</b><p class="muted">الكمية ${escape(item.quantity)} × سعر القطعة ${money(item.price,2)}</p></div><b data-details-line-total>${money(item.total,2)}</b></div>`).join('')||'<p class="muted">لا توجد أصناف مسجلة لهذه المبيعة.</p>'}${view.returns.length?'<h2>سجل المرتجعات</h2>':''}${view.returns.map(row=>`<article class="panel"><h3>مرتجع · ${escape(timestamp(row.date))}</h3><p data-details-refund>قيمة الإرجاع: ${money(row.total,2)}</p>${row.items.map(item=>`<p>${escape(item.name)} · الكمية المرتجعة: ${escape(item.quantity)} · ${money(item.refund,2)}</p>`).join('')}</article>`).join('')}`;
   returnButton.hidden=mode!=='owner'||!onReturn||(!hasPendingReturn(storage,projectId,saleId)&&!canReturnSale(view.sale));returnButton.disabled=returnButton.hidden;
   returnButton.onclick=()=>{if(!current()||returnButton.disabled||mode!=='owner')return;returnButton.disabled=true;try{onReturn?.(view.sale);close();}catch(error){if(current()){let alert=details.querySelector('[role=alert]');if(!alert){alert=document.createElement('p');alert.setAttribute('role','alert');details.append(alert);}alert.textContent=error.message;returnButton.disabled=false;}}};
  }catch(error){if(current()&&attempt===revision){details.innerHTML='<p role="alert"></p><button type="button" data-retry-sale-details>إعادة المحاولة</button>';details.querySelector('[role=alert]').textContent=error.message;details.querySelector('[data-retry-sale-details]').onclick=load;}}
  finally{loading=false;}
 };
 load();return dialog;
}
