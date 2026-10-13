import {approvalDocument} from './approval-document.js';

export function openApprovalDocument({preview,project,projectId,mode,isCurrent=()=>true}){
 if(mode!=='owner'||project?.id!==projectId||!isCurrent()||document.querySelector('.approval-document-dialog'))return;
 const documentData=approvalDocument(preview,{projectName:project.name,currency:project.currency});
 const dialog=document.createElement('dialog');dialog.className='approval-document-dialog';dialog.innerHTML='<h2>نسخة معاينة للطباعة — غير مثبتة</h2><p>التنزيل والطباعة لا يثبتان الحسابات. يحتوي الملف بيانات المشروع المالية.</p><iframe title="معاينة تقرير الحسابات" sandbox="allow-same-origin allow-modals"></iframe><p role="alert"></p><button type="button" data-print-approval-document disabled>طباعة المعاينة</button><button type="button" data-download-approval-document>تنزيل HTML</button><button type="button" data-close-approval-document>إغلاق</button>';
 const frame=dialog.querySelector('iframe'),alert=dialog.querySelector('[role=alert]');let ended=false,ready=false,busy=false;
 const current=()=>!ended&&dialog.isConnected&&isCurrent()&&project.id===projectId;
 const close=()=>{if(ended)return;ended=true;observer.disconnect();frame.onload=null;dialog.remove();};
 const observer=new MutationObserver(()=>{if(!current())close();});
 frame.onload=()=>{if(!current()){close();return;}ready=true;dialog.querySelector('[data-print-approval-document]').disabled=false;};frame.srcdoc=documentData.html;
 dialog.querySelector('[data-print-approval-document]').onclick=()=>{if(!current()){close();return;}if(!ready||busy)return;busy=true;alert.textContent='';try{frame.contentWindow.focus();frame.contentWindow.print();}catch{alert.textContent='تعذرت الطباعة؛ يمكنك تنزيل نسخة HTML وفتحها للطباعة.';}finally{busy=false;}};
 dialog.querySelector('[data-download-approval-document]').onclick=()=>{
  if(!current()){close();return;}if(busy)return;busy=true;alert.textContent='';let url=null,link=null;
  try{url=URL.createObjectURL(new Blob([documentData.html],{type:'text/html;charset=utf-8'}));link=document.createElement('a');link.href=url;link.download=documentData.filename;document.body.append(link);link.click();}
  catch{alert.textContent='تعذر تنزيل المعاينة؛ أعد المحاولة.';}
  finally{link?.remove();if(url)setTimeout(()=>{URL.revokeObjectURL(url);busy=false;},1000);else busy=false;}
 };
 dialog.querySelector('[data-close-approval-document]').onclick=close;dialog.onclose=close;dialog.oncancel=event=>{event.preventDefault();close();};
 document.body.append(dialog);observer.observe(document.documentElement,{childList:true,subtree:true});dialog.showModal();return dialog;
}
