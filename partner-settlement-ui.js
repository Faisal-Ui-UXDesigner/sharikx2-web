import {escape,money} from './ui.js';
import {normalizePartnerSnapshot} from './financial.js';
import {financeEditDialogOpen,financeEditStorage,openFinanceEditRecovery} from './finance-edit-ui.js';
import {loadPartnerSettlementReview,partnerSettlementReview} from './partner-settlement.js';
import {settlementValuation,settlementCashPreview} from './partner-settlement-state.js';
import {createFinanceEdit,financeEditRequest} from './finance-edit.js';
function reviewMarkup(data){
 return `<h3>${escape(data.name)}</h3>${[['operatingBalance','حصة الشريك من النقد الحالي'],['inventoryShare','حصة البضاعة بسعر الشراء'],['expectedInventoryProfit','ربح البضاعة المتوقع'],['withdrawn','إجمالي السحوبات'],['balance','صافي التسوية']].map(([key,title])=>`<p>${title}: <b data-settlement-field="${key}">${['inventoryShare','expectedInventoryProfit'].includes(key)&&!data.inventoryAvailable?'لم يتم الجرد':money(data[key],2)}</b></p>`).join('')}<p>صافي التسوية = النقد الحالي + البضاعة بسعر الشراء + ربح البضاعة المتوقع. السحوبات معروضة للتوضيح لأنها محسوبة مسبقًا ضمن النقد الحالي.</p>`;
}
export function openPartnerSettlementReview({api,storage,projectId,snapshot,mode,isCurrent=()=>true,onSaved}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 if(!isCurrent()||financeEditDialogOpen())return;
 storage=financeEditStorage(storage);const attempt=createFinanceEdit({api,storage,projectId});
 if(attempt.pending())return openFinanceEditRecovery({api,storage,projectId,mode,isCurrent,onSaved});
 const partners=normalizePartnerSnapshot(snapshot).current;if(partners.length<=1)throw new Error('لا يمكن إخراج آخر شريك حالي');
 const dialog=document.createElement('dialog');dialog.className='partner-settlement-review';
 dialog.innerHTML=`<h2>مراجعة تصفية الشريك</h2><label data-settlement-selection>اختر الشريك<select data-settlement-partner>${partners.map(row=>`<option value="${escape(row.id)}">${escape(row.name)}</option>`).join('')}</select></label><section data-settlement-content></section><p>المراجعة والمتابعة لا تحفظان شيئًا. الأرشفة لا تُنفّذ إلا بعد التأكيد النهائي؛ الحسابات السابقة تبقى محفوظة.</p><button type="button" data-close>إغلاق</button>`;document.body.append(dialog);dialog.showModal();
 let ended=false,busy=false,saving=false,captured=null,request=null;
 const current=()=>!ended&&dialog.isConnected&&isCurrent();
 const close=()=>{if(ended||saving)return;ended=true;observer.disconnect();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!current()&&!saving)close();});observer.observe(document.documentElement,{childList:true,subtree:true});
 const cancel=dialog.querySelector('[data-close]');cancel.onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=close;
 const select=dialog.querySelector('select'),content=dialog.querySelector('[data-settlement-content]'),selection=dialog.querySelector('[data-settlement-selection]');
 const renderReview=(exitDate=captured.review.exitDate)=>{
  selection.hidden=false;select.disabled=false;dialog.querySelector('h2').textContent='مراجعة تصفية الشريك';
  const data=partnerSettlementReview(captured.snapshot,select.value,captured.inventory,exitDate);
  content.innerHTML=reviewMarkup(data)+`<label>تاريخ الخروج<input type="date" data-settlement-date value="${data.exitDate}"></label><p role="alert"></p><button type="button" class="primary" data-continue-settlement>متابعة</button>`;
  const date=content.querySelector('input'),alert=content.querySelector('[role=alert]');
  date.oninput=()=>{if(!current())return;try{partnerSettlementReview(captured.snapshot,select.value,captured.inventory,date.value);alert.textContent='';}catch(error){alert.textContent=error.message;}};
  content.querySelector('[data-continue-settlement]').onclick=()=>{
   if(!current()||busy)return;
   try{
    request=financeEditRequest(captured.sourceSnapshot,projectId,'partner-settlement',{partnerId:select.value,exitDate:date.value,valuation:settlementValuation(captured)});
    const cash=settlementCashPreview(captured.sourceSnapshot,request.input);
    selection.hidden=true;select.disabled=true;dialog.querySelector('h2').textContent='تأكيد نهائي';
    content.innerHTML=reviewMarkup({...data,exitDate:request.input.exitDate})+`<p>تاريخ الخروج: ${escape(request.input.exitDate)}</p><p>سيتم أرشفة الشريك وإيقاف دخوله في الحسابات الجديدة، مع حفظ أرباح الشركاء الباقين.</p><p>تغيّر الكاش بفرق رأس المال: <b data-settlement-cash>${money(cash.delta,2)}</b>. هذا ليس صرف صافي التسوية كاملاً.</p><p role="alert"></p><div class="actions"><button type="button" class="danger" data-confirm-settlement>تأكيد التصفية</button><button type="button" data-back-settlement>رجوع للمراجعة</button></div>`;
    content.querySelector('[data-back-settlement]').onclick=()=>{if(current()&&!saving)renderReview(request.input.exitDate);};
    const confirm=content.querySelector('[data-confirm-settlement]'),back=content.querySelector('[data-back-settlement]');
    confirm.onclick=async()=>{
     if(!current()||saving)return;saving=true;confirm.disabled=true;back.disabled=true;cancel.disabled=true;let notify=false;content.querySelector('[role=alert]').textContent='';
     try{await attempt.run(attempt.pending()?null:request,current);notify=current();saving=false;close();}
     catch(error){if(current())content.querySelector('[role=alert]').textContent=error.message+(attempt.pending()?' — الطلب الأصلي محفوظ؛ التحقق يقرأ النتيجة فقط ولن يكرر الأرشفة أو حركة الكاش.':'');}
     finally{saving=false;confirm.disabled=false;back.disabled=attempt.pending();cancel.disabled=false;confirm.textContent=attempt.pending()?'التحقق من التصفية السابقة':'تأكيد التصفية';if(!current())close();}
     if(notify)onSaved?.();
    };
   }catch(error){if(current())alert.textContent=error.message;}
  };
 };
 const load=async()=>{
  if(!current()||busy)return;busy=true;captured=null;request=null;select.disabled=true;content.innerHTML='<div class="skeleton"></div>';const partnerId=select.value;
  try{const result=await loadPartnerSettlementReview(api,projectId,partnerId,current);if(current()){captured=result;renderReview();}}
  catch(error){if(current()){content.innerHTML='<p role="alert"></p><button type="button" data-retry-settlement>إعادة المحاولة</button>';content.querySelector('p').textContent=error.message;content.querySelector('button').onclick=load;}}
  finally{busy=false;select.disabled=false;}
 };select.onchange=load;load();return dialog;
}
