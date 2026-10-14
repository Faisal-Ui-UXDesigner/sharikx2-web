import {escape,money} from './ui.js';
import {salePriceTotals} from './sale-pricing.js';
import {readSaleDrafts,removeSaleDraft} from './sale-drafts.js';
export function showSaleDrafts({container,storage,projectId,isCurrent,onResume,onDeleted}){
 const area=document.createElement('section');area.className='panel sale-draft-list';container.querySelector('.sale-draft-list')?.remove();container.prepend(area);
 const current=()=>area.isConnected&&isCurrent();
 const draw=()=>{if(!current())return;try{const rows=readSaleDrafts(storage,projectId);area.innerHTML=`<h2>المبيعات غير المكتملة</h2><p class="muted small">مسودات غير مُرسلة، محفوظة في جلسة هذا المتصفح فقط.</p>${rows.map((row,index)=>`<article class="panel"><button type="button" data-resume-draft="${escape(row.id)}">مبيعة ${index+1} · ${money(salePriceTotals(row.cart).subtotal,2)} · ${row.cart.length} أصناف</button><button type="button" data-delete-draft="${escape(row.id)}">حذف</button></article>`).join('')||'<p>لا توجد مبيعات غير مكتملة</p>'}<p role="alert"></p><button type="button" data-close-drafts>إغلاق القائمة</button>`;
  area.querySelector('[data-close-drafts]').onclick=()=>area.remove();
  area.querySelectorAll('[data-resume-draft]').forEach(button=>button.onclick=()=>{if(!current())return;try{onResume(rows.find(row=>row.id===button.dataset.resumeDraft));area.remove();}catch(e){area.querySelector('[role=alert]').textContent=e.message;}});
  area.querySelectorAll('[data-delete-draft]').forEach(button=>button.onclick=()=>{if(!current())return;const id=button.dataset.deleteDraft;button.textContent='تأكيد حذف المسودة؟';button.onclick=()=>{if(!current())return;try{removeSaleDraft(storage,projectId,id);onDeleted?.(id);draw();}catch(e){area.querySelector('[role=alert]').textContent=e.message;}};});
 }catch(e){area.innerHTML='<h2>المبيعات غير المكتملة</h2><p role="alert"></p><button type="button">إغلاق القائمة</button>';area.querySelector('p').textContent=e.message;area.querySelector('button').onclick=()=>area.remove();}};
 draw();return area;
}
