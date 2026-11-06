import {escape,money} from './ui.js';
import {loadOwnerHistory,ownerHistorySelection} from './owner-operation-history.js';
import {openOwnerOperationDetails} from './owner-operation-details-ui.js';
import {openExpenseDetails} from './expense-details-ui.js';
import {palestineDate} from './financial.js';
const versions=new WeakMap();

export async function renderOwnerHistory({api,projectId,container,owner,isCurrent=()=>true,onReturn,inline=false}){
 const version=Symbol();versions.set(container,version);
 const current=()=>versions.get(container)===version&&container.isConnected&&owner.isConnected&&isCurrent();if(!current())return;
 container.innerHTML='<label class="op-field">بحث في سجل العمليات<input type="search" data-owner-history-search placeholder="رقم العملية، الاسم، الجوال أو وصف المصروف"></label><p class="muted small">'+(inline?'مبيعات ومصاريف اليوم؛ البحث يشمل السجلات السابقة التي اكتملت قراءتها.':'السجل يشمل المبيعات والمصاريف وفواتير الشراء. البحث في جميع السجلات التي اكتملت قراءتها.')+'</p><div data-owner-records></div><p role="alert"></p><button class="outline" data-owner-history-retry hidden>إعادة تحميل السجل</button><button class="outline" data-owner-history-more hidden>تحميل المزيد</button>';
 const search=container.querySelector('input'),records=container.querySelector('[data-owner-records]'),alert=container.querySelector('[role=alert]'),retry=container.querySelector('[data-owner-history-retry]'),more=container.querySelector('[data-owner-history-more]');
 let data=null,limit=20,busy=false;
 function draw(){
  if(!current()||!data)return;const selected=ownerHistorySelection(data.cards,{query:search.value,limit,day:inline?palestineDate():null});
  records.innerHTML=selected.rows.map((card,index)=>`<button type="button" class="op-card owner-operation-card" data-owner-operation="${index}"><span class="op-row"><b>${escape(card.title)}</b><strong class="${card.kind==='expenses'?'negative':''}">${escape(money(card.amount,2))}</strong></span><span>${escape(card.subtitle)}</span><small class="muted">${escape(card.date)}</small>${card.status?`<span class="op-pill history-status-${escape(card.statusTone)}">${escape(card.status)}</span>`:''}</button>`).join('')||`<p class="muted">${escape(selected.empty)}</p>`;
  more.hidden=selected.remaining===0;
  records.querySelectorAll('[data-owner-operation]').forEach(button=>button.onclick=()=>{
   if(!current()||busy)return;const card=selected.rows[Number(button.dataset.ownerOperation)];
   if(card.kind==='expenses')openExpenseDetails({api,projectId,item:data.records.get('expenses:'+card.id),mode:'owner',allowMutations:false,allowAttachments:false,isCurrent:current});
   else openOwnerOperationDetails({api,owner,projectId,kind:card.kind,id:card.id,isCurrent:current,onReturn});
  });
 }
 async function load(){
  if(!current()||busy)return;busy=true;data=null;retry.hidden=true;more.hidden=true;alert.textContent='';records.innerHTML='<p role="status">جارٍ تحميل سجل العمليات…</p>';
  try{const next=await loadOwnerHistory(api,projectId,{purchases:!inline});if(!current())return;data=next;draw();}
  catch(error){if(current()){records.replaceChildren();alert.textContent=error?.message||'تعذر تحميل السجل';retry.hidden=false;}}
  finally{busy=false;}
 }
 search.oninput=()=>{limit=20;draw();};search.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();search.blur();}};
 more.onclick=()=>{if(current()&&!busy){limit+=20;draw();}};retry.onclick=load;await load();
}
