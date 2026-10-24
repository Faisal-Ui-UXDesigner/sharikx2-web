import {escape,money} from './ui.js';
import {inventoryStatisticsModel} from './inventory-statistics.js';
const dialogs=new WeakMap();
export function renderInventorySummary(container,totals){
 const model=inventoryStatisticsModel(totals);
 container.innerHTML=`<button type="button" class="panel inventory-summary-card" aria-label="البضاعة بسعر الشراء، اضغط لعرض الإحصائيات"><span>البضاعة بسعر الشراء</span><b class="history-tone-${model.purchaseTone}">${money(model.purchaseValue)}</b><span class="inventory-summary-info muted" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3C16.97 3 21 7.03 21 12C21 16.97 16.97 21 12 21Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 11V16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="8.2" r="1.1" fill="currentColor"/></svg></span></button>`;
}
export function openInventoryStatistics({container,totals,isCurrent}){
 if(!isCurrent()||!container.isConnected)return null;
 const existing=dialogs.get(container);if(existing?.isConnected){existing.focus();return existing;}
 const model=inventoryStatisticsModel(totals),dialog=document.createElement('dialog');dialog.dataset.inventoryStatistics='true';
 dialog.innerHTML='<h2>إحصائيات البضاعة</h2><div class="panel">'+model.rows.map(row=>`<div class="row inventory-statistic"><span>${escape(row.label)}</span><b data-${row.key}-total class="history-tone-${row.tone}">${money(row.value,row.precision)}</b></div>`).join('')+'</div><button type="button" data-close class="primary">إغلاق</button>';
 container.append(dialog);dialogs.set(container,dialog);dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>dialog.remove();dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.remove();});return dialog;
}
