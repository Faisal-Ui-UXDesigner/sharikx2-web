import {escape,money} from './ui.js';
import {loadInventoryHistory,historyChanges,historyQuantity,historyUnit,historyProfit} from './inventory-history.js';

const quantity=value=>Number(value||0).toLocaleString('ar-u-nu-latn',{maximumFractionDigits:3});
const valueRow=(label,value)=>`<div class="row history-value"><span class="muted">${escape(label)}</span><b>${value}</b></div>`;
function values(item,legacy){
 if(!item)return '';
 return valueRow('الوحدة',escape(historyUnit(item)))+
  valueRow('الكمية',quantity(legacy?item.quantity:Math.max(0,historyQuantity(item))))+
  valueRow('سعر الشراء',money(item.purchasePrice,4))+
  valueRow('سعر البيع المتوقع',money(item.expectedSalePrice,2))+
  (legacy?'':valueRow('الربح المتوقع',money(historyProfit(item),2)));
}
function card(change){
 const details=historyChanges(change),source=change.after||change.before;
 let content='';
 if(details.kind==='legacy')content='<p class="muted small">سجل سابق يعرض القيم التي كانت محفوظة قبل التحديث.</p>'+values(details.item,true);
 else if(['added','deleted'].includes(details.kind))content='<p class="muted small">'+(details.kind==='added'?'القيمة عند الإضافة':'القيمة عند الحذف')+'</p>'+values(details.item,false);
 else content=details.rows.map(row=>{
  if(row.kind==='text')return valueRow(row.label+' السابق',escape(row.before))+valueRow(row.label+' الجديد',escape(row.after));
  const format=row.kind==='quantity'?quantity:value=>money(value,2);
  return valueRow(row.label,`${format(row.before)} ← ${format(row.after)}، ${row.difference>0?'زيادة':'نقص'} ${format(Math.abs(row.difference))}`);
 }).join('');
 return `<article class="panel inventory-history-card"><div class="row"><h3>${escape(source?.name??'صنف')}</h3>${change.count>1?`<small class="muted">${change.count} تعديلات</small>`:''}</div><div class="history-badges">${details.badges.map(label=>`<span class="badge">${escape(label)}</span>`).join('')}</div>${content}</article>`;
}

export async function renderInventoryHistory({api,projectId,container,isCurrent}){
 container.innerHTML='<h2>سجل الجرد</h2><div class="skeleton"></div>';
 try{
  const rows=await loadInventoryHistory(api,projectId);
  if(!isCurrent()||!container.isConnected)return;
  let date=null;
  const markup=rows.map(change=>{
   const heading=change.date!==date?`<h3><bdi dir="ltr">${escape(change.date||'تاريخ غير متوفر')}</bdi></h3>`:'';
   date=change.date;return heading+card(change);
  }).join('')||'<p class="muted">لا توجد تغييرات مسجلة على البضاعة حتى الآن.</p>';
  container.innerHTML='<h2>سجل الجرد</h2><p class="muted small">يعرض تغييرات الجرد المتزامنة من حالة المشروع؛ العمليات غير المتزامنة من الأجهزة لا تظهر هنا. هذا السجل منفصل عن سجل فواتير الشراء.</p>'+markup;
 }catch(error){
  if(!isCurrent()||!container.isConnected)return;
  container.innerHTML='<h2>سجل الجرد</h2><p role="alert"></p><button data-retry class="outline">إعادة المحاولة</button>';
  container.querySelector('[role=alert]').textContent=error.message;
  container.querySelector('[data-retry]').onclick=()=>{if(isCurrent())renderInventoryHistory({api,projectId,container,isCurrent});};
 }
}
