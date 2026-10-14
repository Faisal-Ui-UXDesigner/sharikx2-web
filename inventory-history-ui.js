import {escape,money} from './ui.js';
import {loadInventoryHistory,inventoryHistoryScreenModel} from './inventory-history.js';

// Native history uses money.format / quantityDisplayValue (two decimals), not
// the three-decimal entry precision. Presentation never changes stored values.
const quantityFormat=new Intl.NumberFormat('ar-u-nu-latn',{maximumFractionDigits:2});
const formats={text:escape,quantity:value=>quantityFormat.format(value),unitCost:value=>money(value,4),money:value=>money(value,2),profit:value=>money(value,2)};
const revisions=new WeakMap();
const valueRow=(label,value,tone='standard')=>`<div class="row history-value"><span class="muted">${escape(label)}</span><b class="history-tone-${tone}">${value}</b></div>`;
function card(model){
 let content=model.caption?`<p class="muted small">${escape(model.caption)}</p>`:'';
 content+=model.values.map(row=>valueRow(row.label,formats[row.kind](row.value),row.tone)).join('');
 content+=model.changes.map(row=>{
  if(row.kind==='text')return valueRow(row.beforeLabel,escape(row.before))+valueRow(row.afterLabel,escape(row.after));
  const format=formats[row.kind];
  return valueRow(row.label,`${format(row.before)} ← ${format(row.after)}، ${row.difference>0?'زيادة':'نقص'} ${format(Math.abs(row.difference))}`,row.tone);
 }).join('');
 return `<article class="panel inventory-history-card"><div class="row"><h3>${escape(model.name)}</h3>${model.count>1?`<small class="muted">${model.count} تعديلات</small>`:''}</div><div class="history-badges" tabindex="0" aria-label="أنواع تغييرات الجرد">${model.badges.map(badge=>`<span class="badge history-tone-${badge.tone}">${escape(badge.label)}</span>`).join('')}</div>${content}</article>`;
}

export async function renderInventoryHistory({api,projectId,container,isCurrent}){
 if(!isCurrent()||!container.isConnected)return;
 const revision=(revisions.get(container)||0)+1;revisions.set(container,revision);
 const current=()=>isCurrent()&&container.isConnected&&revisions.get(container)===revision;
 container.innerHTML='<h2>سجل الجرد</h2><div role="status" aria-label="جارٍ تحميل سجل الجرد" aria-busy="true" class="skeleton"></div>';
 try{
  const rows=await loadInventoryHistory(api,projectId);
  if(!current())return;
  const model=inventoryHistoryScreenModel(rows);
  const markup=model.empty?'<p class="muted">لا توجد تغييرات مسجلة على البضاعة حتى الآن.</p>':model.sections.map(section=>
   `<section class="inventory-history-day"><h3 class="inventory-history-date"><bdi dir="ltr">${escape(section.label)}</bdi></h3>${section.cards.map(card).join('')}</section>`).join('');
  container.innerHTML='<h2>سجل الجرد</h2><p class="muted small">يعرض تغييرات الجرد المتزامنة من حالة المشروع؛ العمليات غير المتزامنة من الأجهزة لا تظهر هنا. هذا السجل منفصل عن سجل فواتير الشراء.</p>'+markup;
 }catch(error){
  if(!current())return;
  container.innerHTML='<h2>سجل الجرد</h2><p role="alert"></p><button data-retry class="outline">إعادة المحاولة</button>';
  container.querySelector('[role=alert]').textContent=typeof error?.message==='string'&&error.message.trim()?error.message:'تعذر قراءة سجل الجرد. أعد المحاولة.';
  container.querySelector('[data-retry]').onclick=()=>{if(current())renderInventoryHistory({api,projectId,container,isCurrent});};
 }
}
