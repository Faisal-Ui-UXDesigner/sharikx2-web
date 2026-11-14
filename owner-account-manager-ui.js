import {escape,money} from './ui.js';
import {createOwnerAccountManager} from './owner-account-manager.js';
import {listSkeleton} from './primary-page-ui.js';
const dialogs=new WeakMap();
const actionIcon=kind=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${kind==='edit'?'<path d="m16 3 5 5L9 20H4v-5L16 3Zm-2 2 5 5"/>':'<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>'}</svg>`;
export function openOwnerAccountManager({owner,api,project,beforeWrite,onSaved,isCurrent=()=>true,storage}){
 if(!owner?.isConnected||!isCurrent())return;
 const previous=dialogs.get(owner);if(previous?.isConnected){previous.focus();return previous;}
 if(storage===undefined){try{storage=window.localStorage;}catch{storage=null;}}
 const dialog=document.createElement('dialog');dialog.className='owner-account-manager';
 dialog.innerHTML='<header><h2 tabindex="-1">حسابات الدفع</h2><button type="button" class="outline" data-account-close aria-label="إغلاق">×</button></header><div data-account-body></div><p role="alert"></p>';
 owner.append(dialog);dialogs.set(owner,dialog);dialog.showModal();dialog.querySelector('h2').focus({preventScroll:true});
 const body=dialog.querySelector('[data-account-body]'),error=dialog.querySelector('[role=alert]');let busy=false,generation=0,accounts=[];
 const current=()=>dialog.isConnected&&isCurrent();
 const manager=createOwnerAccountManager({api,projectId:project.id,storage,beforeWrite:async()=>{await beforeWrite();if(!current())throw Error('تغيّرت الشاشة؛ لم يُرسل تعديل الحساب');}});
 const close=()=>{if(!busy){generation++;dialog.remove();dialogs.delete(owner);}};
 dialog.querySelector('[data-account-close]').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 function message(failure){const text=String(failure?.message||'تعذر إكمال الطلب');error.textContent=/DEVICE_CONTROL_REQUIRED|DEVICE_CONTROL_CHANGED|DEVICE_NOT_ACTIVE/.test(text)?'هذا المتصفح لا يتحكم بالمحل حاليًا؛ راجع إعدادات التحكم بالجهاز':text.includes('ACCOUNT_NAME_ALREADY_EXISTS')?'اسم الحساب مستخدم مسبقًا':text.includes('INSUFFICIENT_ACCOUNT_BALANCE')?'الرصيد في الحساب غير كافٍ':/[؀-ۿ]/.test(text)?text:'تعذر إكمال الطلب؛ تحقق من الاتصال وحاول مجددًا';}
 async function run(work){
  if(busy||!current())return;busy=true;error.textContent='';dialog.querySelectorAll('button,input,select').forEach(node=>node.disabled=true);
  try{await work();if(current()){dialog.remove();dialogs.delete(owner);await onSaved?.();}}
  catch(failure){if(current()){let pending;try{pending=manager.pending();}catch(problem){message(problem);return;}if(pending||body.querySelector('[data-pending-transfer]'))transferForm();message(failure);}}
  finally{busy=false;if(current()){dialog.querySelectorAll('button,input,select').forEach(node=>node.disabled=false);}}
 }
 function renameForm(id){
  const account=accounts.find(row=>row.id===id);if(!account)return;
  dialog.querySelector('h2').textContent='تعديل الحساب';
  body.innerHTML=`<form><label class="op-field">اسم الحساب<input name="accountName" value="${escape(account.name)}" maxlength="60" required></label><p class="muted small">يتغير اسم الحساب فقط. الرصيد الافتتاحي محفوظ كما هو.</p><button class="primary" type="submit">حفظ</button><button type="button" class="outline" data-account-back>رجوع</button></form>`;
  body.querySelector('form').onsubmit=event=>{event.preventDefault();const name=body.querySelector('input').value;void run(()=>manager.rename(id,name));};body.querySelector('[data-account-back]').onclick=list;
 }
 function transferForm(){
  error.textContent='';const saved=manager.pending(),payload=saved?.payload;
  const choices=selected=>accounts.map(row=>`<option value="${escape(row.id)}" ${selected===row.id?'selected':''}>${escape(row.name)} · الرصيد الحالي ${escape(money(row.balance,2))}</option>`).join('');
  dialog.querySelector('h2').textContent='تحويل بين الحسابات';
  body.innerHTML=`<form ${saved?'data-pending-transfer':''}><fieldset ${saved?'disabled':''}><label class="op-field">من الحساب<select name="from">${choices(payload?.p_from_account_id||accounts[0]?.id)}</select></label><label class="op-field">إلى الحساب<select name="to">${choices(payload?.p_to_account_id||accounts[1]?.id)}</select></label><label class="op-field">مبلغ التحويل<input name="amount" inputmode="decimal" dir="ltr" value="${escape(payload?.p_amount||'')}" required></label><label class="op-field">ملاحظة (اختياري)<input name="note" value="${escape(payload?.p_note||'')}"></label></fieldset>${saved?'<p class="op-warn">يوجد تحويل لم تتأكد نتيجته. أعد التحقق بنفس الطلب؛ لن يُنشأ تحويل جديد.</p>':''}<button type="submit" class="primary">${saved?'التحقق من التحويل السابق':'تحويل'}</button>${saved?'':'<button type="button" class="outline" data-account-back>رجوع</button>'}</form>`;
  body.querySelector('form').onsubmit=event=>{event.preventDefault();const form=event.target;void run(()=>manager.transfer({from:form.elements.from.value,to:form.elements.to.value,amount:form.elements.amount.value,note:form.elements.note.value}));};body.querySelector('[data-account-back]')?.addEventListener('click',list);
 }
 async function list(){
  const request=++generation;body.innerHTML=listSkeleton('جارٍ تحديث أرصدة الحسابات');error.textContent='';
  try{accounts=await manager.load();if(!current()||generation!==request)return;
   if(manager.pending()){transferForm();return;}
   dialog.querySelector('h2').textContent='حسابات الدفع';
   body.innerHTML=accounts.map(row=>`<article class="op-card owner-managed-account"><div><b>${escape(row.name)}</b><p class="muted">الرصيد الحالي: <bdi>${escape(money(row.balance,2))}</bdi></p></div><button type="button" class="outline" data-account-rename="${escape(row.id)}" aria-label="تعديل اسم ${escape(row.name)}">${actionIcon('edit')}</button>${api.config?.transfers&&accounts.length>1?`<button type="button" class="outline" data-account-transfer aria-label="تحويل بين الحسابات">${actionIcon('transfer')}</button>`:''}</article>`).join('')||'<p class="muted">لا توجد حسابات متاحة.</p>';
   body.querySelectorAll('[data-account-rename]').forEach(button=>button.onclick=()=>renameForm(button.dataset.accountRename));body.querySelectorAll('[data-account-transfer]').forEach(button=>button.onclick=()=>{void loadTransfer();});
  }catch(failure){if(current()&&generation===request){body.innerHTML='<button type="button" class="outline" data-account-retry>إعادة المحاولة</button>';message(failure);body.querySelector('button').onclick=list;}}
 }
 async function loadTransfer(){
  const request=++generation;body.innerHTML=listSkeleton('جارٍ تحديث الأرصدة');
  try{accounts=await manager.load();if(current()&&generation===request)transferForm();}
  catch(failure){if(current()&&generation===request){message(failure);body.innerHTML='<button class="outline" data-account-retry>إعادة المحاولة</button>';body.querySelector('button').onclick=loadTransfer;}}
 }
 void list();return dialog;
}
