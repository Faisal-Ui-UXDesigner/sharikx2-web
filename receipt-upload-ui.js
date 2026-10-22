import {verifiedReceiptBlob} from './receipt.js';
import {createReceiptUpload,receiptUploadTarget,receiptUploadKey} from './receipt-upload.js';

export function receiptUploadAction({mode,storage,existingValue,target,eligible=true}){
 if(mode!=='owner')return null;
 try{receiptUploadTarget(target);}catch{return null;}
 try{if(storage?.getItem(receiptUploadKey(target))!=null)return 'التحقق من ربط صورة سابقة';}catch{return 'مراجعة محاولة إرفاق الصورة';}
 if(!eligible)return null;
 return existingValue===null||existingValue===undefined||existingValue===''?'إرفاق صورة للسجل المحفوظ':null;
}

export function openReceiptUpload({api,target,mode,storage,owner=document.body,isCurrent=()=>true,onLinked,onClose,initialFile=null,autoUpload=false}){
 if(mode!=='owner'||!isCurrent()||!owner?.isConnected||document.querySelector('.receipt-upload-dialog'))return;
 target=receiptUploadTarget(target);
 const dialog=document.createElement('dialog');dialog.className='receipt-upload-dialog';dialog.setAttribute('aria-label','إرفاق صورة للسجل المحفوظ');
 dialog.innerHTML='<h2>إرفاق صورة للسجل المحفوظ</h2><p class="muted">المصروف أو الفاتورة محفوظ أصلًا. هذه الخطوة ترفع الصورة فقط، ولا تسجل عملية مالية جديدة.</p><p class="muted small">JPEG أو PNG أو WebP، بحد أقصى 6 ميجابايت. HEIC وPDF غير مدعومين في المخزن الحالي.</p><div class="actions"><button type="button" data-pick-receipt>اختيار صورة</button><button type="button" data-camera-receipt>التقاط صورة</button></div><input type="file" data-receipt-file accept="image/jpeg,image/png,image/webp" hidden><input type="file" data-receipt-camera accept="image/jpeg,image/png,image/webp" capture="environment" hidden><p data-receipt-file-name></p><div data-receipt-preview></div><p role="status" data-upload-status></p><p role="alert"></p><div class="actions"><button type="button" data-upload-receipt class="primary">رفع الصورة وربطها</button><button type="button" data-verify-receipt hidden>التحقق من المحاولة السابقة</button><button type="button" data-close-upload>إلغاء</button></div>';
 let ended=false,busy=false,processing=false,file=null,url=null,revision=0,phase='new',operation=null;
 const current=()=>!ended&&dialog.isConnected&&dialog.open&&owner.isConnected&&isCurrent();
 const cleanup=()=>{if(url){URL.revokeObjectURL(url);url=null;}file=null;};
 const finish=linked=>{if(ended)return;const notify=current();ended=true;observer.disconnect();revision++;cleanup();dialog.remove();onClose?.();if(linked&&notify)onLinked?.();};
 const observer=new MutationObserver(()=>{if(!current())finish(false);});
 const close=dialog.querySelector('[data-close-upload]'),submit=dialog.querySelector('[data-upload-receipt]'),verify=dialog.querySelector('[data-verify-receipt]'),status=dialog.querySelector('[data-upload-status]'),alert=dialog.querySelector('[role=alert]'),preview=dialog.querySelector('[data-receipt-preview]');
 if(initialFile)close.textContent=target.kind==='expense'?'متابعة — المصروف محفوظ':'متابعة — الفاتورة محفوظة';
 const lock=()=>{
  const pending=phase!=='new';submit.disabled=busy||processing||phase==='pending'||phase==='blocked'||(!file&&phase!=='uploaded');verify.hidden=!pending;verify.disabled=busy||processing||phase==='blocked';close.disabled=busy||processing;
  dialog.querySelectorAll('[data-pick-receipt],[data-camera-receipt],input').forEach(node=>node.disabled=busy||processing||['pending','blocked','uploaded'].includes(phase));
  submit.textContent=phase==='uploaded'?'تأكيد ربط الصورة المرفوعة':'رفع الصورة وربطها';
 };
 close.onclick=()=>{if(!busy&&!processing)finish(false);};dialog.oncancel=event=>{event.preventDefault();if(!busy&&!processing)finish(false);};dialog.addEventListener('close',()=>finish(false));
 document.body.append(dialog);dialog.showModal();observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 try{operation=createReceiptUpload({api,target,mode,storage,isCurrent:current});if(operation.pending()){phase='pending';status.textContent='توجد محاولة محفوظة؛ تحقّق من نتيجتها قبل أي رفع أو ربط جديد.';}}
 catch(error){phase='blocked';alert.textContent=error.message;}lock();
 for(const [button,input] of [['[data-pick-receipt]','[data-receipt-file]'],['[data-camera-receipt]','[data-receipt-camera]']])dialog.querySelector(button).onclick=()=>{if(!busy&&!processing&&!dialog.querySelector(button).disabled)dialog.querySelector(input).click();};
 const selectFile=async selected=>{
  if(!current()||busy||['pending','uploaded','blocked'].includes(phase))return;
  if(!selected)return;const token=++revision;processing=true;cleanup();preview.replaceChildren();dialog.querySelector('[data-receipt-file-name]').textContent='';alert.textContent='';lock();
  let candidateUrl=null;
  try{
   const blob=await verifiedReceiptBlob(selected);if(!current()||token!==revision)return;
   candidateUrl=URL.createObjectURL(blob);const image=new Image();image.alt='معاينة الصورة المختارة';image.src=candidateUrl;await image.decode();
   if(!current()||token!==revision)return;cleanup();file=blob;url=candidateUrl;candidateUrl=null;preview.replaceChildren(image);dialog.querySelector('[data-receipt-file-name]').textContent=selected.name||'صورة الفاتورة المختارة';
  }catch{if(current()&&token===revision)alert.textContent='تعذر قراءة الصورة. اختر JPEG أو PNG أو WebP صالحة لا تتجاوز 6 ميجابايت.';}
  finally{if(candidateUrl)URL.revokeObjectURL(candidateUrl);if(token===revision){processing=false;if(current())lock();}}
 };
 dialog.querySelectorAll('input[type=file]').forEach(input=>input.onchange=()=>{const selected=input.files?.[0];input.value='';return selectFile(selected);});
 const attempt=async readOnly=>{
  if(!current()||busy||processing||phase==='blocked')return;busy=true;alert.textContent='';status.textContent=readOnly?'جارٍ التحقق دون رفع أو تعديل جديد…':'جارٍ رفع الصورة والتحقق منها وربطها…';lock();
  try{
   const result=await (readOnly?operation.verify():operation.run(file));if(!current())return;
   if(result.state==='linked'){status.textContent='تم تأكيد ربط الصورة؛ لم تُسجّل عملية مالية جديدة.';finish(true);return;}
   phase=result.state;status.textContent=phase==='uploaded'?'الصورة موجودة ومطابقة؛ اضغط تأكيد ربط الصورة.':'لم تظهر الصورة في المخزن؛ اختر نفس الصورة لإعادة الرفع بنفس الهوية.';
  }catch(error){
   if(!current())return;alert.textContent=error?.message||'تعذر تأكيد ربط الصورة';
   try{phase=operation.pending()?'pending':'new';}catch{phase='blocked';}
   if(phase==='pending')status.textContent='المحاولة الأصلية محفوظة. استخدم التحقق؛ لا تعِد تسجيل المصروف أو الفاتورة.';
  }finally{busy=false;if(current())lock();else finish(false);}
 };
 submit.onclick=()=>{if(!submit.disabled)void attempt(false);};verify.onclick=()=>{if(!verify.disabled)void attempt(true);};
 if(initialFile&&phase==='new')void selectFile(initialFile).then(()=>{if(current()&&file&&autoUpload&&phase==='new')return attempt(false);});
 return dialog;
}
