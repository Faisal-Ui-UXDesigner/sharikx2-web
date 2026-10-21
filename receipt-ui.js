import {receiptFileName,verifiedReceiptBlob,receiptReference} from './receipt.js';

export function openReceipt({api,projectId,kind,path,container=document.body,isCurrent=()=>true}){
 if(!path||!isCurrent()||!container?.isConnected||document.querySelector('.receipt-dialog'))return;
 const dialog=document.createElement('dialog'),previous=document.activeElement;
 dialog.className='receipt-dialog';dialog.setAttribute('aria-label','صورة المرفق');
 dialog.innerHTML='<h2>صورة المرفق</h2><div data-receipt-content></div><p role="alert"></p><div class="actions"><button type="button" data-receipt-retry hidden>إعادة المحاولة</button><button type="button" data-receipt-download hidden>تنزيل الصورة</button><button type="button" data-receipt-share hidden>مشاركة</button><button type="button" data-receipt-close class="primary">إغلاق</button></div>';
 let ended=false,loading=false,url=null,file=null,controller=null;
 const current=()=>!ended&&dialog.isConnected&&dialog.open&&container.isConnected&&isCurrent();
 const release=()=>{if(url){URL.revokeObjectURL(url);url=null;}file=null;};
 const close=()=>{if(ended)return;ended=true;observer.disconnect();controller?.abort();release();dialog.remove();if(previous?.isConnected&&isCurrent())previous.focus();};
 const observer=new MutationObserver(()=>{if(!current())close();});
 const content=dialog.querySelector('[data-receipt-content]'),alert=dialog.querySelector('[role=alert]'),retry=dialog.querySelector('[data-receipt-retry]'),download=dialog.querySelector('[data-receipt-download]'),share=dialog.querySelector('[data-receipt-share]');
 dialog.querySelector('[data-receipt-close]').onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};dialog.addEventListener('close',close);
 container.append(dialog);dialog.showModal();observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 const load=async()=>{
  if(!current()||loading)return;loading=true;release();retry.hidden=true;download.hidden=true;share.hidden=true;alert.textContent='';content.innerHTML='<p role="status">جارٍ تحميل صورة المرفق…</p>';content.setAttribute('aria-busy','true');controller=new AbortController();
  try{
   receiptReference({projectId,kind,path});
   const blob=await verifiedReceiptBlob(await api.receiptBlob({projectId,kind,path,signal:controller.signal}));
   if(!current()){close();return;}
   url=URL.createObjectURL(blob);const image=new Image();image.alt='صورة الفاتورة أو الإيصال';image.src=url;await image.decode();
   if(!current()){close();return;}
   file=new File([blob],receiptFileName(kind,blob.type),{type:blob.type});content.replaceChildren(image);download.hidden=false;
   try{share.hidden=!(typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file]}));}catch{share.hidden=true;}
  }catch(error){
   release();if(!current()){close();return;}content.replaceChildren();alert.textContent=error?.code?error.message:'تعذر تحميل صورة المرفق. تحقق من الاتصال والصلاحيات ثم أعد المحاولة.';retry.hidden=false;
  }finally{loading=false;if(current())content.removeAttribute('aria-busy');}
 };
 retry.onclick=load;
 download.onclick=()=>{if(!current()||!file||!url)return;const link=document.createElement('a');link.href=url;link.download=file.name;link.rel='noopener';document.body.append(link);link.click();link.remove();};
 share.onclick=async()=>{
  if(!current()||!file||share.disabled)return;share.disabled=true;alert.textContent='';
  try{await navigator.share({files:[file],title:'مرفق SharikX2'});}catch(error){if(error?.name!=='AbortError'&&current())alert.textContent='تعذرت المشاركة؛ يمكنك تنزيل الصورة بدلًا منها.';}finally{if(current())share.disabled=false;}
 };
 void load();return dialog;
}

export function mountReceiptAction(host,{path,...options}){
 if(!host||!path)return;
 const button=document.createElement('button');button.type='button';button.className='outline receipt-open';button.textContent='عرض صورة المرفق';button.dataset.openReceipt='';
 button.onclick=()=>{if(button.isConnected&&options.isCurrent?.()!==false)openReceipt({...options,path});};host.append(button);
 return button;
}
