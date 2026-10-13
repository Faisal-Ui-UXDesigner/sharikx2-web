import {escape} from './ui.js';
import {saveCategorySettings} from './inventory-category.js';
import {categoryDraft,categoryDraftRows,changeCategoryDraft} from './inventory-category-draft.js';
const dialogs=new WeakMap();

export async function openInventoryCategorySettings({api,projectId,container,isCurrent,inventoryCategories=[],onSaved,mode='owner'}){
 if(mode!=='owner')throw new Error('إعدادات التصنيفات متاحة للمالك فقط');
 if(!isCurrent()||!container.isConnected)return null;
 const existing=dialogs.get(container);if(existing?.isConnected){existing.focus();return existing;}
 const generation=api.generation,epoch=api.deviceEpoch;
 const dialog=document.createElement('dialog');dialog.dataset.categorySettings='true';
 dialog.innerHTML='<h2>إعدادات تصنيفات البضاعة</h2><p class="muted">يمكنك إخفاء التصنيفات غير المناسبة. الأصناف المخفية تبقى محفوظة وتظهر ضمن الكل.</p><form data-category-add class="input-pair"><label>تصنيف جديد<input name="name" maxlength="60" required></label><button class="outline">إضافة</button></form><p role="alert"></p><div data-category-rows></div><div class="actions"><button data-save class="primary">حفظ</button><button data-close class="outline">إلغاء</button></div>';
 container.append(dialog);dialogs.set(container,dialog);dialog.showModal();
 let draft=null,saving=false,loading=false,child=null;
 const current=()=>isCurrent()&&container.isConnected&&dialog.isConnected&&api.generation===generation&&api.deviceEpoch===epoch;
 const canEdit=()=>current()&&!saving&&!loading&&!child?.isConnected&&draft!==null;
 const alert=dialog.querySelector('[role=alert]'),form=dialog.querySelector('[data-category-add]'),rows=dialog.querySelector('[data-category-rows]');
 const lock=()=>{dialog.querySelectorAll('button,input').forEach(control=>control.disabled=control.hasAttribute('data-close')?saving||!!child?.isConnected:saving||loading||!!child?.isConnected||!draft);};
 const close=()=>{if(saving)return;child?.remove();dialog.remove();};
 dialog.querySelector('[data-close]').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 const draw=()=>{
  rows.innerHTML=categoryDraftRows(draft).map(row=>'<div class="panel row" data-category-row="'+escape(row.key)+'"><label class="choice"><input type="checkbox" role="switch" data-category-visible '+(row.visible?'checked':'')+'><span>'+escape(row.label)+'</span></label><button type="button" class="outline" data-category-rename>إعادة تسمية</button></div>').join('');
  lock();
 };
 const apply=action=>{draft=changeCategoryDraft(draft,action);alert.textContent='';draw();};
 rows.onchange=event=>{
  if(!canEdit())return;
  const row=event.target.closest('[data-category-row]');
  if(row&&event.target.matches('[data-category-visible]'))apply({type:'visibility',key:row.dataset.categoryRow,visible:event.target.checked});
 };
 rows.onclick=event=>{
  const button=event.target.closest('[data-category-rename]');if(!button||!canEdit())return;
  const key=button.closest('[data-category-row]').dataset.categoryRow,label=categoryDraftRows(draft).find(row=>row.key===key).label;
  child=document.createElement('dialog');child.dataset.categoryRename='true';
  child.innerHTML='<h2>تغيير اسم التصنيف</h2><form><label>اسم التصنيف<input name="name" maxlength="60" required></label><p class="muted small">يتغير اسم التصنيف فقط؛ تبقى أصنافه وكمياتها كما هي. اضغط حفظ في إعدادات البضاعة لاعتماد التغييرات.</p><p role="alert"></p><div class="actions"><button class="primary">حفظ</button><button type="button" data-close class="outline">إلغاء</button></div></form>';
  container.append(child);child.showModal();child.querySelector('input').value=label;lock();
  const renameDialog=child,finish=()=>{renameDialog.remove();child=null;if(current()){lock();dialog.focus();}};
  child.querySelector('[data-close]').onclick=finish;child.addEventListener('cancel',event=>{event.preventDefault();finish();});
  child.querySelector('form').onsubmit=event=>{
   event.preventDefault();if(!current()||saving||!renameDialog.isConnected)return;
   try{apply({type:'rename',key,name:renameDialog.querySelector('input').value});finish();}
   catch(error){renameDialog.querySelector('[role=alert]').textContent=error.message;}
  };
 };
 form.onsubmit=event=>{
  event.preventDefault();if(!canEdit())return;
  try{apply({type:'add',name:form.elements.name.value});form.elements.name.value='';}
  catch(error){alert.textContent=error.message;}
 };
 dialog.querySelector('[data-save]').onclick=async()=>{
  if(!canEdit())return;
  const captured=draft.settings;saving=true;lock();alert.textContent='';
  try{
   await saveCategorySettings(api,projectId,captured,{isCurrent:current});
  }catch(error){
   saving=false;if(current()){alert.textContent=error.message;lock();}return;
  }
  saving=false;if(!current())return;dialog.remove();
  // A callback failure must not turn a confirmed save into a retryable write.
  try{onSaved?.();}catch(error){console.error('Category refresh failed after confirmed save',error);}
 };
 const load=async()=>{
  if(loading||!current())return;
  loading=true;lock();alert.textContent='';rows.innerHTML='<div class="skeleton"></div>';
  try{
   const snapshot=await api.financeState(projectId);if(!current())return;
   draft=categoryDraft(snapshot,inventoryCategories);draw();
  }catch(error){
   if(!current())return;alert.textContent=error.message;rows.innerHTML='<button type="button" data-category-retry class="outline">إعادة المحاولة</button>';
   rows.querySelector('[data-category-retry]').onclick=load;
  }finally{loading=false;if(current()){lock();rows.querySelector('[data-category-retry]')?.removeAttribute('disabled');}}
 };
 await load();return dialog;
}
