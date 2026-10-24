import {loadProjectNotices} from './project-notifications.js';
import {openProjectNotifications} from './project-notifications-ui.js';

// One mounted shell owns its reads. The small read-state object survives only
// navigation within the same opened project, never a new login or restoration.
export function bindProjectNotificationBell({button,api,project,mode,readState,owner,isCurrent=()=>true}){
 let ended=false,pending=null,rows=null;
 const current=()=>!ended&&button.isConnected&&owner.isConnected&&isCurrent();
 function draw(state){
  if(!current())return;
  const unread=rows!==null&&readState.hasUnread(rows);
  button.dataset.noticeState=state;
  button.classList.toggle('has-unread-notices',unread);
  const label=state==='loading'?'الإشعارات، جارٍ التحقق':state==='error'?'الإشعارات، تعذر التحقق':unread?'الإشعارات، توجد تنبيهات غير مقروءة':'الإشعارات، لا توجد تنبيهات غير مقروءة';
  button.setAttribute('aria-label',label);
  button.title=label;
 }
 function load({isCurrent:dialogCurrent=()=>true}={}){
  if(!current()||!dialogCurrent())return Promise.reject(new Error('SESSION_CLOSED'));
  if(!pending){
   draw('loading');
   pending=loadProjectNotices({api,project,mode,isCurrent:current}).then(value=>{
    if(current()){rows=value;draw('ready');}return value;
   }).catch(error=>{draw('error');throw error;}).finally(()=>{pending=null;});
  }
  return pending;
 }
 button.onclick=()=>{
  if(!current())return;
  openProjectNotifications({api,project,mode,owner,isCurrent:current,loadNotices:load,onSeen:signature=>{
   if(!current())return;readState.markSeen(signature);draw('ready');
  }});
 };
 void load().catch(()=>{}); // Visible error state, never a false empty result.
 return ()=>{ended=true;button.onclick=null;};
}
