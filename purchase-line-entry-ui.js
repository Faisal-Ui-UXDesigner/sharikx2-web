import {createPurchaseCartLine} from './purchase-cart-actions.js';
import {createPurchaseProductChoices} from './purchase-product-choice.js';
import {purchaseLineFormMarkup,renderPurchaseLineSelection} from './purchase-line-form-ui.js';
import {openPurchaseProductChoice} from './purchase-product-choice-ui.js';
import {purchaseCalculatorButton,openPurchaseCalculator} from './purchase-calculator-ui.js';

export function openPurchaseLineEntry({mode,projectId,products,selectedId,loadSettings=async()=>({}),isCurrent=()=>true,onAdded,onClose}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 if(!isCurrent()||document.querySelector('dialog.purchase-line-entry'))return;
 if(!Array.isArray(products)||!products.length)throw new Error('أضف صنفًا في البضاعة أولًا');
 const catalog=createPurchaseProductChoices(products,projectId),captured=catalog.products;
 const dialog=document.createElement('dialog');dialog.className='purchase-line-entry';dialog.setAttribute('aria-label','إضافة صنف للفاتورة');dialog.innerHTML=purchaseLineFormMarkup(captured);
 document.body.append(dialog);dialog.showModal();const form=dialog.querySelector('form');if(catalog.get(selectedId))form.elements.product.value=selectedId;let ended=false;
 let choosing=false,choiceDialog=null;
 const current=()=>!ended&&dialog.isConnected&&dialog.open&&isCurrent();
 const finish=()=>{if(ended)return false;ended=true;observer.disconnect();choiceDialog?.remove();dialog.remove();onClose?.();return true;};
 const search=form.querySelector('[data-search-entry-product]');
 const selection=()=>renderPurchaseLineSelection(form,catalog.get(form.elements.product.value));
 form.elements.product.onchange=()=>{if(current()&&!choosing)selection();};selection();
 const lock=value=>{choosing=value;form.querySelectorAll('input,select,button').forEach(control=>{control.disabled=value;});};
 const calculator=(target,input,button)=>{
  if(!current()||choosing)return;
  const baseline=input.value;lock(true);
  const release=()=>{if(current()){lock(false);button.focus();}};
  try{choiceDialog=openPurchaseCalculator({owner:dialog,target,value:baseline,isCurrent:()=>current()&&input.value===baseline,
   onApply:result=>{input.value=result;input.dispatchEvent(new Event('input',{bubbles:true}));},onClose:release});if(!choiceDialog)release();}
  catch(error){release();if(current())form.querySelector('[role=alert]').textContent=error.message;}
 };
 purchaseCalculatorButton(form.elements.quantity,'quantity',calculator);
 purchaseCalculatorButton(form.elements.cost,'cost',calculator);
 search.onclick=()=>{
  if(!current()||choosing||document.querySelector('dialog.purchase-product-choice'))return;
  lock(true);
  const release=()=>{if(current()){lock(false);search.focus();}};
  try{choiceDialog=openPurchaseProductChoice({products:captured,projectId,selectedId:form.elements.product.value,mode,loadSettings,isCurrent:current,onClose:release,onSelected:product=>{if(current()&&catalog.get(product.id)){form.elements.product.value=product.id;selection();}}});if(!choiceDialog)release();}
  catch(error){release();if(current())form.querySelector('[role=alert]').textContent=error.message;}
 };
 const observer=new MutationObserver(()=>{if(!current())finish();});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});dialog.querySelector('[data-cancel-line-entry]').onclick=()=>{if(!choosing)finish();};dialog.oncancel=event=>{event.preventDefault();if(!choosing)finish();};dialog.onclose=finish;
 form.onsubmit=event=>{event.preventDefault();if(!current()||choosing)return;let line;try{if(!form.checkValidity()){form.reportValidity();return;}line=createPurchaseCartLine(catalog.get(form.elements.product.value),form.elements.quantity.value,form.elements.cost.value,projectId);}catch(error){if(current())form.querySelector('[role=alert]').textContent=error.message;return;}if(finish())onAdded?.(line);};
 return dialog;
}
