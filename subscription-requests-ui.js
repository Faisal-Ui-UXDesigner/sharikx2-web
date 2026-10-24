import {escape,timestamp} from './ui.js';
const amount=row=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(row.amount)+(row.currency==='USD'?' $':' — العملة غير مسجلة');

// Request state is not an entitlement. The project's subscription remains the
// authoritative source; this read-only dialog never mutates it or resends proof.
export function openSubscriptionRequests({api,projectId,mode,owner=document.body,isCurrent=()=>true}){
 if(mode!=='owner'||!isCurrent()||!owner.isConnected||document.querySelector('.subscription-requests-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='subscription-requests-dialog';dialog.innerHTML='<h2>حالة طلبات الاشتراك</h2><p class="muted">طلبات هذا المشروع المرتبطة بحساب الدخول الحالي فقط. طلبات حساب Android الآخر قد لا تظهر؛ لا تعِد إرسال طلب لمجرد غيابه هنا.</p><p class="muted">الموافقة على طلب ليست تحققًا من صلاحية الاشتراك الحالية؛ راجع تفاصيل الخطة.</p><div data-subscription-requests></div><p role="alert"></p><button class="outline" data-refresh-requests>تحديث الحالة</button><button class="outline" data-close-requests>إغلاق</button>';
 owner.append(dialog);dialog.showModal();let ended=false,busy=false;
 const current=()=>!ended&&isCurrent()&&owner.isConnected&&dialog.isConnected&&dialog.open;
 const finish=()=>{if(ended)return;ended=true;observer.disconnect();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!current())finish();});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 dialog.querySelector('[data-close-requests]').onclick=finish;dialog.addEventListener('cancel',event=>{event.preventDefault();finish();});dialog.addEventListener('close',finish);
 const host=dialog.querySelector('[data-subscription-requests]'),error=dialog.querySelector('[role=alert]'),refresh=dialog.querySelector('[data-refresh-requests]');
 async function load(){
  if(!current()||busy)return;busy=true;refresh.disabled=true;error.textContent='';host.innerHTML='<p role="status">جارٍ قراءة الطلبات…</p>';
  try{
   const rows=await api.subscriptionRequests(projectId);if(!current())return;
   host.innerHTML=rows.map(row=>`<article class="panel" data-request-status="${escape(row.status)}"><h3>${escape(row.label)}</h3><p><bdi dir="ltr">${escape(amount(row))}</bdi></p><p>رقم المشروع: <bdi dir="ltr">${escape(row.projectNumber)}</bdi></p><p class="muted">تاريخ الطلب: ${escape(timestamp(row.createdAt))}</p>${row.reviewedAt===null?'':`<p class="muted">تاريخ المراجعة: ${escape(timestamp(row.reviewedAt))}</p>`}</article>`).join('')||'<p>لا توجد طلبات ظاهرة لهذا الحساب والمشروع.</p>';
  }catch(value){if(current()){host.replaceChildren();error.textContent=value.message||'تعذر قراءة طلبات الاشتراك';}}
  finally{busy=false;if(current())refresh.disabled=false;}
 }
 refresh.onclick=load;void load();return dialog;
}
