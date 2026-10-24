import {escape,money} from './ui.js';
import {icon} from './icons.js';
import {appendContactAction} from './contact-ui.js';
import {debtDirectory} from './debt-directory.js';
import {DEBT_SETTLED_THRESHOLD as threshold} from './debt-model.js';
const tokens=new WeakMap();

function controls(kind,owner){
 const supplier=kind==='suppliers';
 return `<section class="debt-directory"><div class="debt-directory-controls"><div class="debt-directory-heading"><button type="button" data-debt-back class="outline" aria-label="العودة إلى الكاشير">${icon('back',23)}</button><h2>${supplier?'حسابات الموردين':'ديون الزبائن'}</h2></div><div class="tabs"><button type="button" data-tab="active" class="primary" aria-pressed="true">${supplier?'حسابات عالقة':'ديون عالقة'}</button><button type="button" data-tab="archive" aria-pressed="false">أرشيف السداد</button></div></div>
  <section class="panel debt-directory-summary" data-debt-summary hidden></section>
  <label class="debt-directory-search">${supplier?'بحث باسم المورد أو رقم الجوال':'بحث بالاسم أو رقم الجوال'}<span>${icon('search',23)}<input id="search" type="search" placeholder="${supplier?'بحث باسم المورد أو رقم الجوال':'بحث بالاسم أو رقم الجوال'}"></span></label>
  ${owner?`<details class="debt-directory-manage"><summary>إدارة ${supplier?'الموردين':'الزبائن'}</summary><div class="actions"><button type="button" class="primary" ${supplier?'data-add-supplier':'data-add-customer'}>${supplier?'إضافة مورد':'إضافة زبون'}</button>${supplier?'<button type="button" data-new-purchase>تسجيل فاتورة شراء</button>':''}</div></details>`:''}
  <p data-debt-error role="alert"></p><div id="rows" aria-live="polite"></div><button type="button" id="more" class="outline" hidden>تحميل المزيد</button><button type="button" data-debt-retry class="outline" hidden>إعادة المحاولة</button></section>`;
}

function card(row,kind,owner,archived){
 const supplier=kind==='suppliers';
 const caption=row.debt>threshold?money(row.debt,2):row.credit>threshold?'رصيد دائن':money(0);
 const description=supplier?(row.settled?'<span class="positive small">مسدد بالكامل</span>':'')+(row.credit>threshold?`<span class="positive small">رصيد لك لدى المورد: ${money(row.credit,2)}</span>`:''):(archived?'<span class="muted small">الرصيد 0 — اضغط لعرض السجل الكامل</span>':'');
 const actions=`<details class="debt-person-actions"><summary data-person-actions>إجراءات ${escape(row.name)}</summary><div class="actions" data-contact-actions></div>${owner&&!archived?`<div class="actions">${supplier?`<button type="button" data-edit-supplier="${escape(row.id)}">تعديل</button><button type="button" data-archive-supplier="${escape(row.id)}">أرشفة</button>`:`<button type="button" data-edit-customer="${escape(row.id)}">تعديل</button>`}${row.debt>threshold?`<button type="button" data-collect="${escape(row.id)}">${supplier?'تسديد دفعة':'تحصيل دفعة'}</button>`:''}</div>`:''}</details>`;
 return `<article class="panel debt-directory-card ${archived?'debt-archived':''}" data-person="${escape(row.id)}"><button type="button" class="debt-person-open" data-open-person="${escape(row.id)}" aria-label="عرض سجل ${escape(row.name)}"><span class="debt-person-info"><b>${escape(row.name)}</b><span class="muted"><bdi dir="ltr">${escape(row.phone||'بدون رقم جوال')}</bdi></span>${description}</span><strong class="${row.debt>threshold?'negative':'positive'}">${caption}</strong></button>${actions}</article>`;
}

// Caller supplies loading and authorized domain actions. This module owns no API,
// storage, financial mutations or permission escalation.
export async function renderDebtDirectory({container,kind,mode,loadSnapshot,isCurrent=()=>true,onBack,onOpen,onAdd,onPurchase,onEdit,onArchive,onPayment}){
 if(!['customers','suppliers'].includes(kind))throw Error('قائمة الديون غير صالحة');
 const token=Symbol('directory');tokens.set(container,token);
 const current=()=>container.isConnected&&tokens.get(container)===token&&isCurrent();
 if(!current())return;
 const owner=mode==='owner';let source=null,archived=false,limit=20,generation=0;
 container.innerHTML=controls(kind,owner);
 const list=container.querySelector('#rows'),search=container.querySelector('#search'),summary=container.querySelector('[data-debt-summary]'),more=container.querySelector('#more'),error=container.querySelector('[data-debt-error]'),retry=container.querySelector('[data-debt-retry]');
 const invoke=async(callback,person,button,write=false)=>{
  if(!current()||write&&!owner||typeof callback!=='function'||button&&(!button.isConnected||button.disabled))return;
  if(button)button.disabled=true;
  try{await callback(person);}catch(failure){if(current())error.textContent=failure?.message||'تعذر إتمام الإجراء؛ أعد المحاولة';}
  finally{if(current()&&button?.isConnected)button.disabled=false;}
 };
 function draw(){
  if(!current()||!source)return;
  const model=debtDirectory(source,kind,{query:search.value,archived,limit});
  summary.hidden=archived;
  summary.innerHTML=`<div><small>${kind==='suppliers'?'إجمالي ديون الموردين':'إجمالي ديون الزبائن'}</small><strong class="negative">${money(model.total,2)}</strong></div><div><small>${kind==='suppliers'?'عدد الموردين':'عدد المدينين'}</small><strong>${model.count}</strong></div>`;
  list.innerHTML=model.rows.map(row=>card(row,kind,owner,archived)).join('')||`<p class="muted debt-directory-empty">${model.empty}</p>`;
  more.hidden=!model.remaining;more.textContent=`تحميل المزيد (${model.remaining})`;
  const captured=new Map(source[kind].map(row=>[String(row.id),row]));
  for(const element of list.querySelectorAll('[data-person]')){
   const row=captured.get(element.dataset.person),person=()=>structuredClone(row);
   element.querySelector('[data-open-person]').onclick=event=>invoke(onOpen,person(),event.currentTarget);
   appendContactAction(element.querySelector('[data-contact-actions]'),{phone:row.phone,isCurrent:current});
   const bindings=[['[data-edit-customer],[data-edit-supplier]',onEdit],['[data-archive-supplier]',onArchive],['[data-collect]',onPayment]];
   for(const [selector,callback] of bindings){const button=element.querySelector(selector);if(button)button.onclick=()=>invoke(callback,person(),button,true);}
  }
 }
 async function load(){
  if(!current())return;
  const request=++generation;source=null;summary.hidden=true;more.hidden=true;retry.hidden=true;error.textContent='';
  list.innerHTML='<div class="skeleton" role="status" aria-label="جاري تحميل الحسابات"></div><div class="skeleton"></div>';list.setAttribute('aria-busy','true');
  try{
   const snapshot=structuredClone(await loadSnapshot());if(!current()||request!==generation)return;
   debtDirectory(snapshot,kind);source=snapshot;draw();
  }catch(failure){if(!current()||request!==generation)return;list.innerHTML='';error.textContent=failure?.message||'تعذر تحميل الحسابات؛ أعد المحاولة';retry.hidden=false;}
  finally{if(current()&&request===generation)list.setAttribute('aria-busy','false');}
 }
 container.querySelector('[data-debt-back]').onclick=event=>invoke(onBack,undefined,event.currentTarget);
 container.querySelector('[data-add-customer],[data-add-supplier]')?.addEventListener('click',event=>invoke(onAdd,undefined,event.currentTarget,true));
 container.querySelector('[data-new-purchase]')?.addEventListener('click',event=>invoke(onPurchase,undefined,event.currentTarget,true));
 container.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{
  if(!current())return;archived=button.dataset.tab==='archive';limit=20;
  container.querySelectorAll('[data-tab]').forEach(tab=>{tab.classList.toggle('primary',tab===button);tab.setAttribute('aria-pressed',String(tab===button));});draw();
 });
 search.oninput=()=>{if(current()){limit=20;draw();}};search.onkeydown=event=>{if(current()&&event.key==='Enter'){event.preventDefault();search.blur();}};
 more.onclick=()=>{if(current()){limit+=20;draw();}};retry.onclick=load;
 await load();
}
