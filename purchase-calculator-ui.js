import {escape} from './ui.js';
import {icon} from './icons.js';
import {evaluatePurchaseExpression,calculatePurchaseExpression,purchaseCalculatorTarget} from './purchase-calculator.js';

export function purchaseCalculatorButton(input,target,onOpen){
 const model=purchaseCalculatorTarget(target),field=document.createElement('span'),button=document.createElement('button');
 field.className='purchase-calculator-field';input.replaceWith(field);field.append(input);
 button.type='button';button.dataset.purchaseCalculator=target;button.setAttribute('aria-label',model.action);button.innerHTML=icon('accounts',22);field.append(button);
 button.onclick=()=>onOpen(target,input,button);return button;
}

export function openPurchaseCalculator({owner,target,value,isCurrent=()=>true,onApply,onClose}){
 if(!owner?.isConnected||!owner.open||!isCurrent()||document.querySelector('.purchase-calculator'))return;
 const model=purchaseCalculatorTarget(target),dialog=document.createElement('dialog');dialog.className='purchase-calculator';dialog.setAttribute('aria-label',model.title);
 const rows=[['7','8','9','×'],['4','5','6','−'],['1','2','3','+'],['مسح','0','.','÷'],['⌫','=']];
 dialog.innerHTML=`<h2>${model.title}</h2><p class="muted small">احسب بالجمع والطرح والضرب والقسمة. اضغط = لمعاينة النتيجة، ثم إدخال لنقلها إلى ${model.field}.</p><form novalidate><label>العملية الحسابية<input name="expression" type="text" dir="ltr" maxlength="96" inputmode="decimal" autocomplete="off" value="${escape(value)}"></label><output aria-live="polite">اضغط = لعرض النتيجة</output><div class="purchase-calculator-keys" dir="ltr">${rows.map(row=>`<div>${row.map(key=>`<button type="button" data-key="${escape(key)}">${key}</button>`).join('')}</div>`).join('')}</div><p role="alert"></p><div class="actions"><button type="submit" class="primary">Enter — إدخال النتيجة</button><button type="button" data-cancel-calculator>إلغاء</button></div></form>`;
 owner.append(dialog);dialog.showModal();let ended=false;
 const form=dialog.querySelector('form'),input=form.elements.expression,output=form.querySelector('output'),error=form.querySelector('[role=alert]');
 const current=()=>!ended&&dialog.isConnected&&dialog.open&&owner.isConnected&&owner.open&&isCurrent();
 const finish=()=>{if(ended)return;ended=true;observer.disconnect();dialog.remove();onClose?.();};
 const reset=()=>{error.textContent='';output.textContent='اضغط = لعرض النتيجة';};
 const preview=()=>{if(!current())return;try{output.textContent='= '+evaluatePurchaseExpression(input.value);error.textContent='';}catch(failure){output.textContent='تعذر الحساب';error.textContent=failure.message;}};
 input.oninput=reset;input.onkeydown=event=>{if(event.key==='='){event.preventDefault();preview();}};
 for(const button of form.querySelectorAll('[data-key]'))button.onclick=()=>{
  if(!current())return;const key=button.dataset.key;if(key==='='){preview();return;}
  const next=key==='مسح'?'':key==='⌫'?input.value.slice(0,-1):input.value+(key==='−'?'-':key);
  if(next.length<=96){input.value=next;reset();}input.focus();input.setSelectionRange(input.value.length,input.value.length);
 };
 form.onsubmit=event=>{event.preventDefault();event.stopPropagation();if(!current())return;try{const result=calculatePurchaseExpression(input.value);onApply(result);finish();}catch(failure){if(current())error.textContent=failure.message;}};
 form.querySelector('[data-cancel-calculator]').onclick=finish;dialog.oncancel=event=>{event.preventDefault();event.stopPropagation();finish();};dialog.onclose=finish;
 const observer=new MutationObserver(()=>{if(!current())finish();});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 return dialog;
}
