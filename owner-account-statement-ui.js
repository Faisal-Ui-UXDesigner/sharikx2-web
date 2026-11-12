import {escape,money} from './ui.js';
import {financialPeriod,palestineDate} from './financial.js';
import {ownerStatement,ownerStatementText} from './owner-account-statement.js';
import {listSkeleton} from './primary-page-ui.js';

const dialogs=new WeakMap();
const row=(title,value,tone='')=>`<div class="owner-statement-row"><span>${escape(title)}</span><b class="${tone}">${escape(money(value,2))}</b></div>`;
const movement=value=>`<article class="owner-statement-movement"><span>${escape(value.accountName)} · ${escape(value.typeName)}<small class="muted"><bdi>${escape(value.date)}</bdi></small></span><b dir="ltr" class="${value.incoming?'positive':'negative'}">${value.incoming?'+':'−'}${escape(money(value.amount,2))}</b></article>`;

export function openOwnerAccountStatement({owner,api,project,state,accountId='',isCurrent=()=>true}){
 if(!owner?.isConnected||!isCurrent())return;
 const existing=dialogs.get(owner);if(existing?.isConnected){existing.focus();return existing;}
 const summary=structuredClone(state.profit?.summary),accounts=summary?.accounts||[];
 const dialog=document.createElement('dialog');dialog.className='owner-statement-dialog';
 dialog.innerHTML=`<header class="owner-statement-heading"><h2 tabindex="-1">كشف الحساب</h2><button type="button" class="outline" data-statement-close aria-label="إغلاق">×</button></header>
 <div class="op-chips scroll" role="group" aria-label="فترة كشف الحساب">${[['today','اليوم'],['month','هذا الشهر'],['all','كل الوقت']].map(([id,title])=>`<button type="button" class="op-chip" data-statement-period="${id}">${title}</button>`).join('')}</div>
 <label class="op-field">الحساب<select data-statement-account><option value="">كل الحسابات</option>${accounts.map(account=>`<option value="${escape(account.id)}">${escape(account.name)}</option>`).join('')}</select></label>
 <div data-statement-content aria-live="polite"></div><p role="alert" data-statement-error></p><p role="status" data-statement-status></p>
 <footer class="owner-statement-actions"><button type="button" class="outline" data-statement-download disabled>تنزيل الكشف</button>${typeof navigator.share==='function'?'<button type="button" class="outline" data-statement-share disabled>مشاركة الكشف</button>':''}${navigator.clipboard?.writeText?'<button type="button" class="outline" data-statement-copy disabled>نسخ الكشف</button>':''}</footer>`;
 owner.append(dialog);dialogs.set(owner,dialog);dialog.showModal();dialog.querySelector('h2').focus({preventScroll:true});
 let generation=0,mode='month',loaded=null,snapshot=null,actionBusy=false;
 const current=()=>dialog.isConnected&&isCurrent();
 const content=dialog.querySelector('[data-statement-content]'),error=dialog.querySelector('[data-statement-error]'),status=dialog.querySelector('[data-statement-status]'),selector=dialog.querySelector('select');
 selector.value=accountId;
 const close=()=>{generation++;dialog.remove();dialogs.delete(owner);};
 dialog.querySelector('[data-statement-close]').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 const exportsDisabled=value=>dialog.querySelectorAll('footer button').forEach(button=>button.disabled=value||actionBusy);
 function draw(){
  if(!current()||!loaded)return;
  try{
   snapshot=ownerStatement(summary,loaded.activity,{accountId:selector.value,mode,today:loaded.today});
   const {account,model,rows}=snapshot;
   content.innerHTML=`<p class="muted small">${escape(snapshot.period)}</p>${account?row('الرصيد الحالي — '+account.name,account.balance):row('صافي قيمة المشروع',model.netProjectValue)+row('الأموال الداخلة',model.cashIn,'positive')+row('الأموال الخارجة',model.cashOut,'negative')}
    <h3>سجل حركة الحسابات</h3>${model.possiblyLimited?'<p class="owner-statement-limit">يعرض الخادم آخر 200 حركة للمشروع؛ قد توجد حركات أقدم. إجماليات الفترة من الخادم وتشمل الحركات الأقدم.</p>':''}<div data-statement-rows></div><button type="button" class="outline" data-statement-more>عرض المزيد من الحركات</button>`;
   const list=content.querySelector('[data-statement-rows]'),more=content.querySelector('[data-statement-more]');let offset=0;
   const next=()=>{if(!current())return;const until=Math.min(rows.length,offset+50);list.insertAdjacentHTML('beforeend',rows.slice(offset,until).map(movement).join(''));offset=until;more.hidden=offset>=rows.length;};
   if(!rows.length)list.innerHTML='<p class="muted">لا توجد حركات لهذا الحساب خلال الفترة المحددة.</p>';
   more.onclick=next;next();exportsDisabled(false);
  }catch(failure){loaded=null;snapshot=null;content.innerHTML='';error.textContent=failure.message;exportsDisabled(true);}
 }
 async function load(){
  const request=++generation;loaded=null;snapshot=null;error.textContent='';status.textContent='';exportsDisabled(true);
  content.innerHTML=listSkeleton('جارٍ تحميل كشف الحساب');
  dialog.querySelectorAll('[data-statement-period]').forEach(button=>{const selected=button.dataset.statementPeriod===mode;button.classList.toggle('on',selected);button.setAttribute('aria-pressed',String(selected));});
  try{
   const today=palestineDate(),range=financialPeriod(mode,today),activity=await api.financialActivity(project.id,range.from,range.to);
   if(!current()||request!==generation)return;
   loaded={activity,today};draw();
  }catch(failure){if(!current()||request!==generation)return;content.innerHTML='<p class="muted">تعذر تحميل كشف الحساب.</p><button type="button" class="outline" data-statement-retry>إعادة المحاولة</button>';error.textContent=failure?.message||'تحقق من الاتصال وحاول مجددًا';content.querySelector('button').onclick=load;}
 }
 dialog.querySelectorAll('[data-statement-period]').forEach(button=>button.onclick=()=>{if(current()&&mode!==button.dataset.statementPeriod){mode=button.dataset.statementPeriod;void load();}});
 selector.onchange=()=>{if(current()){error.textContent='';draw();}};
 const action=(attribute,run)=>dialog.querySelector(attribute)?.addEventListener('click',async()=>{
  if(!current()||!snapshot||actionBusy)return;actionBusy=true;exportsDisabled(true);error.textContent='';status.textContent='';
  try{await run(ownerStatementText(project,snapshot,value=>money(value,2)));}catch(failure){if(current()&&failure?.name!=='AbortError')error.textContent=failure?.message||'تعذر مشاركة الكشف';}
  finally{actionBusy=false;if(current())exportsDisabled(!snapshot);}
 });
 action('[data-statement-download]',text=>{const url=URL.createObjectURL(new Blob(['\ufeff',text],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='SharikX2-statement.txt';dialog.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 action('[data-statement-copy]',async text=>{await navigator.clipboard.writeText(text);if(current())status.textContent='تم نسخ الكشف';});
 action('[data-statement-share]',text=>navigator.share({title:'كشف حساب '+(project.name||''),text}));
 void load();return dialog;
}
