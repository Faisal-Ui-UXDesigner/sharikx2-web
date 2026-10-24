import {createSalePaymentStep} from './sale-payment-step.js';

export function bindSalePaymentStep({owner,form,entry,confirm,canNavigate,validateCart,onError}){
 const state=createSalePaymentStep(),cart=form.querySelector('.sale-cart-section'),sections=[...form.querySelectorAll('.sale-payment-section,.sale-customer-section')],title=owner.querySelector(':scope>h2'),fields=form.querySelector('fieldset');
 const back=document.createElement('button');back.type='button';back.className='outline sale-payment-back';back.dataset.backSalePayment='';back.textContent='الرجوع إلى السلة';confirm.after(back);
 let cartScroll=0,armed=false;
 const current=()=>owner.isConnected&&owner.open&&canNavigate();
 const sync=()=>{
  const payment=state.phase==='payment',recovery=state.phase==='recovery';
  owner.dataset.saleStep=state.phase;owner.dataset.salePaymentReady=String(payment&&armed);entry.hidden=payment||recovery;cart.hidden=payment;cart.inert=payment||recovery;
  sections.forEach(section=>{section.hidden=!payment&&!recovery;section.inert=!payment&&!recovery;});
  for(const toolbar of owner.querySelectorAll('.sale-draft-tools,.sale-draft-list'))toolbar.hidden=payment||recovery;
  back.hidden=!payment;back.disabled=fields.disabled||!current();title.textContent=recovery?'التحقق من المبيعة':payment?'تأكيد العملية':'مبيعة جديدة';
  if(!recovery){confirm.textContent=payment?(form.elements.asDebt.checked?'تسجيل المبيعة كدين':'مراجعة وتأكيد المبيعة'):'متابعة إلى الدفع';confirm.toggleAttribute('data-continue-sale',!payment);}
  else confirm.removeAttribute('data-continue-sale');
 };
 const open=()=>{
  if(!current())return false;
  try{if(!state.enter(validateCart))return false;armed=false;cartScroll=owner.scrollTop;sync();onError(null);title.tabIndex=-1;title.focus({preventScroll:true});owner.scrollTop=0;requestAnimationFrame(()=>{if(current()&&state.phase==='payment'){armed=true;sync();}});return true;}
  catch(error){onError(error);return false;}
 };
 const leave=()=>{
  if(!current()||!state.back())return false;armed=false;sync();onError(null);owner.scrollTop=cartScroll;confirm.focus({preventScroll:true});return true;
 };
 back.onclick=leave;
 // Busy state belongs to the sale transaction; navigation reflects that lock.
 const observer=new MutationObserver(()=>{back.disabled=fields.disabled||!current();});observer.observe(fields,{attributes:true,attributeFilter:['disabled']});
 sync();
 return Object.freeze({get active(){return state.phase==='payment';},get ready(){return state.phase==='payment'&&armed;},get phase(){return state.phase;},open,back:leave,sync,recover(){armed=false;state.recover();sync();confirm.textContent='التحقق من المبيعة السابقة';}});
}
