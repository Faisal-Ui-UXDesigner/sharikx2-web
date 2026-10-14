import {escape,money,expenseMoney,timestamp,status} from './ui.js';
import {editExpense,deleteExpense} from './expense-mutation.js';
import {icon} from './icons.js';
import {collectPages} from './pagination.js';
import {cashierHistoryCards,cashierHistorySelection} from './cashier-history.js';
export function compareActivity(a,b){const delta=(Date.parse(b.row.created_at)||0)-(Date.parse(a.row.created_at)||0);return delta||`${a.kind}:${a.row.id}`.localeCompare(`${b.kind}:${b.row.id}`);}
export function createActivityFeed(fetchPage){
 const sources=['sales','expenses'].map(kind=>({kind,offset:0,buffer:[],done:false}));let running=null;
 async function next(){const snapshot=sources.map(s=>({...s,buffer:[...s.buffer]}));try{const result=[];while(result.length<20){const loads=await Promise.allSettled(sources.filter(s=>!s.done&&!s.buffer.length).map(async s=>{const rows=await fetchPage(s.kind,s.offset);s.offset+=rows.length;s.done=rows.length<20;s.buffer.push(...rows.map(row=>({kind:s.kind,row})));}));const failure=loads.find(x=>x.status==='rejected');if(failure)throw failure.reason;const heads=sources.filter(s=>s.buffer.length).sort((a,b)=>compareActivity(a.buffer[0],b.buffer[0]));if(!heads.length)break;result.push(heads[0].buffer.shift());}return result;}catch(e){sources.forEach((s,i)=>Object.assign(s,snapshot[i]));throw e;}}
 return {next(){if(!running)running=next().finally(()=>running=null);return running;},hasMore(){return sources.some(s=>!s.done||s.buffer.length);}};
}
function expenseDetails({item,api,projectId,mode,allowMutations,onSaved}){
 const dialog=document.createElement('dialog');dialog.innerHTML=`<h2>تفاصيل المصروف</h2><div class="panel row"><div><b>${escape(item.description)}</b><p>${['daily_wage','daily_wages'].includes(item.category)?'يوميات':'مصروف'}</p><small>${escape(timestamp(item.created_at))}</small></div><strong class="expense-amount">${expenseMoney(item.amount)}</strong></div><div class="panel row"><span>الدفع من</span><b>${escape(item.account?.name||'غير محدد')}</b></div><p class="muted small">إرفاق الفاتورة قيد الاستكمال.</p><div class="actions">${mode==='owner'&&allowMutations?'<button data-edit>تعديل</button><button data-delete class="danger">حذف</button>':''}<button data-close class="primary">إغلاق</button></div>`;document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>dialog.remove();const options={api,projectId,item,mode,onSaved:()=>{dialog.remove();onSaved();}};dialog.querySelector('[data-edit]')?.addEventListener('click',()=>editExpense(options));dialog.querySelector('[data-delete]')?.addEventListener('click',()=>deleteExpense(options));
}
const activityRenders=new WeakMap();
export async function renderActivity({api,projectId,container,isCurrent,mode,onSaved,allowMutations,onSale}){
 if(!isCurrent()||!container.isConnected)return;
 const token={};activityRenders.set(container,token);
 const current=()=>isCurrent()&&container.isConnected&&activityRenders.get(container)===token;
 container.innerHTML='<h2>سجل العمليات</h2><label class="activity-search"><input type="search" data-search aria-label="بحث برقم العملية أو رقم جوال الزبون" placeholder="بحث برقم العملية أو رقم جوال الزبون"><span aria-hidden="true">'+icon('search',24)+'</span></label><div data-records><div class="skeleton" role="status" aria-label="جارٍ تحميل سجل العمليات"></div></div><p role="alert"></p><button data-retry-activity class="outline" hidden>إعادة تحميل سجل العمليات</button><button data-more class="outline" hidden>تحميل المزيد</button>';
 const search=container.querySelector('[data-search]'),records=container.querySelector('[data-records]'),alert=container.querySelector('[role=alert]'),more=container.querySelector('[data-more]'),retry=container.querySelector('[data-retry-activity]');
 let cards=Object.freeze([]),source=new Map(),limit=20,busy=false;
 const draw=()=>{
  if(!current())return;
  const model=cashierHistorySelection(cards,{query:search.value,limit});
  records.innerHTML=model.rows.map((card,index)=>{
   const amount=card.kind==='sales'?'+ '+money(card.amount):expenseMoney(card.amount);
   return `<button type="button" class="panel row record activity-record" data-index="${index}"><div><b>${escape(card.title)}</b><p>${escape(card.subtitle)}</p><small>${escape(card.account?card.account+'  •  '+card.date:card.date)}</small></div><div class="activity-amount"><strong class="${card.kind==='expenses'?'expense-amount':''}"><bdi dir="ltr">${amount}</bdi></strong>${card.status?`<span class="badge activity-status-${card.statusTone}">${escape(card.status)}</span>`:''}</div></button>`;
  }).join('')||'<p class="muted">'+model.emptyText+'</p>';
  more.hidden=model.remaining===0;
  records.querySelectorAll('[data-index]').forEach(button=>button.onclick=()=>{
   if(!current()||!button.isConnected)return;
   const card=model.rows[Number(button.dataset.index)],item=source.get(card.kind+':'+card.id);
   if(card.kind==='sales')onSale?.(card.id);else expenseDetails({item,api,projectId,mode,onSaved,allowMutations});
  });
 };
 const load=async()=>{
  if(!current()||busy)return;busy=true;retry.hidden=true;alert.textContent='';
  const fetch=async kind=>{
   const select=kind==='sales'?'*,customer:sharikx2_customers(name,phone)':'*,account:sharikx2_accounts(name)';
   return typeof api.allRows==='function'?api.allRows(kind,projectId,select):collectPages(offset=>api.rows(kind,projectId,select,offset));
  };
  try{
   const [sales,expenses]=await Promise.all([fetch('sales'),fetch('expenses')]);if(!current())return;
   const next=cashierHistoryCards(sales,expenses),nextSource=new Map();
   for(const [kind,rows] of [['sales',sales],['expenses',expenses]])for(const row of rows)if(row&&typeof row==='object'&&!Array.isArray(row)&&!nextSource.has(kind+':'+row.id))nextSource.set(kind+':'+row.id,structuredClone(row));
   cards=next;source=nextSource;draw();
  }catch(error){if(current()){records.replaceChildren();alert.textContent=error?.message||'تعذر تحميل سجل العمليات';retry.hidden=false;more.hidden=true;}}
  finally{busy=false;}
 };
 search.oninput=()=>{if(current()){limit=20;if(!busy)draw();}};
 search.onkeydown=event=>{if(event.key==='Enter'&&current()){event.preventDefault();search.blur();}};
 more.onclick=()=>{if(current()&&!busy){const top=window.scrollY;limit+=20;draw();window.scrollTo({top,behavior:'instant'});}};
 retry.onclick=load;await load();
}
