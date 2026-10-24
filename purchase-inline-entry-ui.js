import {createPurchaseProductChoices} from './purchase-product-choice.js';
import {createPurchaseCartLine} from './purchase-cart-actions.js';
import {purchaseLineFieldsMarkup,renderPurchaseLineSelection} from './purchase-line-form-ui.js';
import {openPurchaseProductChoice} from './purchase-product-choice-ui.js';
import {purchaseCalculatorButton,openPurchaseCalculator} from './purchase-calculator-ui.js';

/** Unsent entry only. Host owns the invoice, child lock, totals, drafts and dispatch. */
export function mountPurchaseInlineEntry({owner,container,products,projectId,loadSettings,isCurrent,canEdit,lockChild,onAdded,onSelected,onError}){
 const catalog=createPurchaseProductChoices(products,projectId);
 container.innerHTML=purchaseLineFieldsMarkup(catalog.products,{inline:true})+'<button type="button" class="primary" data-enter-purchase-line>إضافة الصنف</button>';
 const product=container.querySelector('[name=product]'),quantity=container.querySelector('[name=quantity]'),cost=container.querySelector('[name=cost]');
 const add=container.querySelector('[data-enter-purchase-line]'),search=container.querySelector('[data-search-entry-product]');
 let ended=false,child=null,choosing=false;
 const current=()=>!ended&&owner.isConnected&&owner.open&&container.isConnected&&isCurrent();
 const selection=()=>renderPurchaseLineSelection(container,catalog.get(product.value));
 const hasPending=()=>quantity.value!==''||cost.value!==''||quantity.validity.badInput||cost.validity.badInput;
 const select=id=>{product.value=catalog.get(id)?id:'';selection();};
 const close=()=>{if(ended)return;ended=true;observer.disconnect();child?.remove();};
 const launch=(trigger,open)=>{
  if(!current()||choosing||!canEdit())return;
  choosing=true;lockChild(true);
  const release=()=>{choosing=false;if(current()){lockChild(false);trigger.focus();}};
  try{child=open(release);if(!child)release();}catch(error){release();if(current())onError(error.message);}
 };
 const calculator=(target,input,trigger)=>{
  const baseline=input.value;
  launch(trigger,release=>openPurchaseCalculator({owner,target,value:baseline,isCurrent:()=>current()&&input.value===baseline,
   onClose:release,onApply:value=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}}));
 };
 purchaseCalculatorButton(quantity,'quantity',calculator);purchaseCalculatorButton(cost,'cost',calculator);
 search.onclick=()=>launch(search,release=>openPurchaseProductChoice({products:catalog.products,projectId,selectedId:product.value,mode:'owner',loadSettings,isCurrent:current,onClose:release,
  onSelected:row=>{if(current()&&catalog.get(row.id)){select(row.id);onSelected(row.id);}}}));
 product.onchange=()=>{if(current()&&!choosing&&canEdit()){selection();onSelected(product.value);}};
 add.onclick=()=>{
  if(!current()||choosing||!canEdit())return;
  try{
   const invalid=[quantity,cost].find(input=>input.value===''||!input.checkValidity());
   if(invalid){onError(invalid===quantity?'أدخل كمية صحيحة أكبر من صفر':'أدخل تكلفة وحدة صحيحة');invalid.focus();return;}
   const line=createPurchaseCartLine(catalog.get(product.value),quantity.value,cost.value,projectId);
   onAdded(line);quantity.value='';cost.value='';onError('');
  }catch(error){onError(error.message);}
 };
 const observer=new MutationObserver(()=>{if(!current())close();});
 observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 if(catalog.products.length){select(catalog.products[0].id);}else{select(null);add.disabled=true;search.disabled=true;}
 return Object.freeze({select,hasPending,
  assertComplete:()=>{if(hasPending()){quantity.focus();throw new Error('أضف الصنف المدخل إلى الفاتورة أو امسح الكمية والتكلفة أولًا');}},close});
}
