import {verifiedReceiptBlob} from './receipt.js';

// Memory-only selection: never put image bytes or names in a financial journal.
export function mountReceiptPicker({container,isCurrent=()=>true,canEdit=()=>true,onChange=()=>{},hint}){
 container.classList.add('receipt-picker');
 container.innerHTML='<p class="muted small">JPEG أو PNG أو WebP، حتى 6 ميجابايت. لا تُحفظ الصورة في المسودة؛ تُرفع بعد تأكيد الحفظ المالي، دون تكرار العملية.</p><div class="actions"><button type="button" data-pick-image>اختيار صورة</button><button type="button" data-capture-image>التقاط صورة</button><button type="button" data-clear-image hidden>إزالة الاختيار</button></div><input type="file" data-image-file accept="image/jpeg,image/png,image/webp" hidden><input type="file" data-image-camera accept="image/jpeg,image/png,image/webp" capture="environment" hidden><p data-image-name dir="auto"></p><div data-image-preview></div><p data-image-error role="status"></p>';
 if(hint)container.querySelector('p').textContent=hint;
 let file=null,url=null,processing=false,revision=0,ended=false;
 const current=()=>!ended&&container.isConnected&&isCurrent();
 const name=container.querySelector('[data-image-name]'),preview=container.querySelector('[data-image-preview]'),error=container.querySelector('[data-image-error]'),clear=container.querySelector('[data-clear-image]');
 const release=()=>{file=null;if(url)URL.revokeObjectURL(url);url=null;};
 const sync=()=>{container.querySelectorAll('button,input').forEach(node=>node.disabled=processing);clear.hidden=!file;onChange();};
 const dispose=()=>{if(ended)return;ended=true;revision++;release();observer.disconnect();};
 const observer=new MutationObserver(()=>{if(!current())dispose();});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 const reset=()=>{release();preview.replaceChildren();name.textContent='';error.textContent='';};
 clear.onclick=()=>{if(!current()||!canEdit()||processing)return;revision++;reset();sync();};
 for(const [button,input] of [['[data-pick-image]','[data-image-file]'],['[data-capture-image]','[data-image-camera]']])container.querySelector(button).onclick=()=>{if(current()&&canEdit()&&!processing)container.querySelector(input).click();};
 container.querySelectorAll('input[type=file]').forEach(input=>input.onchange=async()=>{
  const selected=input.files?.[0];input.value='';if(!selected||!current()||!canEdit()||processing)return;
  const token=++revision;processing=true;reset();sync();let candidate=null;
  try{
   const blob=await verifiedReceiptBlob(selected);if(!current()||token!==revision)return;
   candidate=URL.createObjectURL(blob);const image=new Image();image.alt='معاينة الصورة المختارة';image.src=candidate;await image.decode();
   if(!current()||token!==revision)return;file=blob;url=candidate;candidate=null;preview.replaceChildren(image);name.textContent=selected.name;
  }catch{if(current()&&token===revision)error.textContent='تعذر قراءة الصورة. اختر JPEG أو PNG أو WebP صالحة حتى 6 ميجابايت؛ HEIC وPDF غير مدعومين.';}
  finally{if(candidate)URL.revokeObjectURL(candidate);if(token===revision){processing=false;if(current())sync();else dispose();}}
 });
 return Object.freeze({get file(){return file;},get processing(){return processing;},clear:()=>{if(current()&&!processing){revision++;reset();sync();}},dispose});
}
