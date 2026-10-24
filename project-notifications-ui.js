import {escape,timestamp} from './ui.js';
import {loadProjectNotices,notificationSignature} from './project-notifications.js';

export function openProjectNotifications({api,project,mode,owner=document.body,isCurrent=()=>true,onSeen,loadNotices=loadProjectNotices}){
 if(!isCurrent()||!owner.isConnected||document.querySelector('.project-notifications-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='project-notifications-dialog';dialog.innerHTML='<h2>الإشعارات</h2><p class="muted">تنبيهات داخل التطبيق عند فتح واجهة المشروع أو هذه الصفحة، وليست إشعارات خلفية للجهاز. تُحفظ حالة القراءة داخل جلسة المشروع المفتوحة فقط.</p><div data-project-notices></div><p role="alert"></p><button data-refresh-notices class="outline">تحديث</button><button data-close-notices class="outline">إغلاق</button>';
 owner.append(dialog);dialog.showModal();let busy=false,ended=false;
 const current=()=>!ended&&isCurrent()&&owner.isConnected&&dialog.isConnected&&dialog.open;
 const finish=()=>{if(ended)return;ended=true;observer.disconnect();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!current())finish();});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 dialog.querySelector('[data-close-notices]').onclick=finish;dialog.addEventListener('cancel',event=>{event.preventDefault();finish();});dialog.addEventListener('close',finish);
 const host=dialog.querySelector('[data-project-notices]'),error=dialog.querySelector('[role=alert]'),refresh=dialog.querySelector('[data-refresh-notices]');
 async function load(){
  if(!current()||busy)return;busy=true;refresh.disabled=true;host.innerHTML='<p role="status">جارٍ قراءة الإشعارات…</p>';error.textContent='';
  try{
   const rows=await loadNotices({api,project,mode,isCurrent:current});if(!current())return;
   host.innerHTML=[...rows].reverse().map(row=>`<article class="panel" data-notice-key="${escape(row.key)}"><div class="row"><h3>${escape(row.title)}</h3><span class="notice-severity">تنبيه</span></div><p class="muted">${escape(row.message)}</p><small class="muted">تاريخ الإشعار: ${escape(timestamp(row.createdAt))}</small></article>`).join('')||'<div class="panel">لا توجد إشعارات حالياً</div>';
   onSeen?.(notificationSignature(rows));
  }catch(value){if(current()){host.replaceChildren();error.textContent=value?.message||'تعذر تحميل الإشعارات';}}
  finally{busy=false;if(current())refresh.disabled=false;}
 }
 refresh.onclick=load;void load();return dialog;
}
