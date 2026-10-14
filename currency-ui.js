import {PROJECT_CURRENCIES,currencyCode,currencySymbol,projectCurrencyPayload,projectCurrencyResult} from './currency.js';
import {escape,setCurrency} from './ui.js';

export function renderCurrencySettings({api,container,project,mode,isCurrent=()=>true,onSaved}){
 if(!isCurrent())return;
 const projectId=project.id,currentCode=currencyCode(project.currency);
 let sourceCurrency=project.currency;
 const panel=document.createElement('section');panel.className='panel currency-settings';
 if(mode!=='owner'){
  panel.innerHTML=`<p>عملة المشروع: <b>${escape(currencySymbol(currentCode))}</b></p>`;container.append(panel);return panel;
 }
 const unknown=!PROJECT_CURRENCIES.some(currency=>currency.code===currentCode);
 panel.innerHTML=`<form><label>عملة المشروع<select name="currency" required>${unknown?`<option value="${escape(currentCode)}">${escape(currentCode)} — العملة الحالية</option>`:''}${PROJECT_CURRENCIES.map(currency=>`<option value="${currency.code}">${escape(currency.label)}</option>`).join('')}</select></label><p class="muted">تغيير العملة يغيّر رمز العرض فقط، ولا يحوّل المبالغ أو الأرصدة.</p><button type="submit" class="primary">حفظ العملة</button><p role="alert"></p></form>`;
 container.append(panel);
 const form=panel.querySelector('form'),select=form.elements.currency,save=form.querySelector('button'),error=form.querySelector('[role=alert]');
 select.value=currentCode;let busy=false;
 const current=()=>isCurrent()&&panel.isConnected;
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!current())return;
  let saved=false;
  try{
   const payload=projectCurrencyPayload(projectId,select.value);busy=true;select.disabled=true;save.disabled=true;save.textContent='جارٍ الحفظ…';error.textContent='';
   const result=await api.updateCurrency(projectId,payload.currency,sourceCurrency);
   projectCurrencyResult([result],projectId,payload.currency);
   if(current()){sourceCurrency=result.currency;project.currency=result.currency;setCurrency(result.currency);saved=true;}
  }catch(errorValue){if(current())error.textContent=errorValue.message||'تعذر حفظ عملة المشروع';}
  finally{busy=false;select.disabled=false;save.disabled=false;save.textContent='حفظ العملة';}
  if(saved)onSaved?.();
 };
 return panel;
}
