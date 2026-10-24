import {escape,money} from './ui.js';
import {purchaseAccountPayable,purchaseFullInvoicePlan,PURCHASE_PAYMENT_TOLERANCE} from './purchase-payment-options.js';
import {decimalSum} from './decimal-sum.js';

/** Stable controls keyed by the captured account catalog. Host owns payment rows and dispatch. */
export function mountPurchaseAccountCards(container,catalog,{canEdit,onPayment,onFull}){
 container.innerHTML=catalog.accounts.map((account,index)=>`<section class="purchase-native-account" data-purchase-account-card="${index}">
  <header><b title="${escape(account.name)}">${escape(account.name)}</b><small class="${account.balance>0?'purchase-available-positive':'muted'}">الرصيد الحالي: ${money(Math.max(0,account.balance),2)}</small></header>
  <label>مبلغ الدفع<input data-purchase-account-amount="${index}" type="number" min="0" step="any" inputmode="decimal" placeholder="مبلغ الدفع" aria-label="${escape('المبلغ المدفوع للمورد من '+account.name)}"></label>
  <p class="small" data-purchase-account-remaining="${index}" aria-live="polite"></p>
  <button type="button" class="outline" data-full-purchase-payment="${index}" aria-label="${escape('دفع كامل قيمة الفاتورة من '+account.name)}"></button>
 </section>`).join('')||'<p class="muted small">لا توجد حسابات متاحة؛ يمكن تسجيل المتبقي دينًا بعد موافقتك.</p>';
 const controls=catalog.accounts.map((account,index)=>({account,input:container.querySelector(`[data-purchase-account-amount="${index}"]`),remaining:container.querySelector(`[data-purchase-account-remaining="${index}"]`),full:container.querySelector(`[data-full-purchase-payment="${index}"]`)}));
 const controlsById=new Map(controls.map(row=>[row.account.id,row]));
 let lastPayments='',requests=new Set();
 for(const {account,input,full} of controls){
  input.oninput=()=>{
   if(!canEdit())return;
   try{
    const view=purchaseAccountPayable(account,input.value);
    requests.add(account.id);
    // Set before host re-entry so sync retains this typed, potentially capped request.
    const payments=onPayment(account.id,view.payment);
    lastPayments=JSON.stringify(payments);
    renderRemaining();
   }catch(error){input.setCustomValidity(error.message);input.reportValidity();}
  };
  full.onclick=()=>{
   if(!canEdit())return;
   const plan=onFull(account);
   if(!plan)return;
   requests=new Set([account.id]);input.value=String(plan.requested);renderRemaining();
  };
 }
 function renderRemaining(){
  for(const {account,input,remaining} of controls){
   try{
    const view=purchaseAccountPayable(account,input.value);input.setCustomValidity('');
    const exceeds=view.excess>PURCHASE_PAYMENT_TOLERANCE;
    remaining.textContent='المتبقي في الحساب: '+money(view.remaining,2)+(exceeds?' • الزائد '+money(view.excess,2)+' غير مدفوع':'');
    remaining.classList.toggle('danger-text',exceeds);
   }catch(error){remaining.textContent=error.message;remaining.classList.add('danger-text');}
  }
 }
 return {sync(payments,items,{preserveRequests=false}={}){
  const fingerprint=JSON.stringify(payments);
  if(!preserveRequests&&fingerprint!==lastPayments)requests=new Set();
  lastPayments=fingerprint;
  const byAccount=new Map();
  for(const row of payments){if(!byAccount.has(row.account_id))byAccount.set(row.account_id,[]);byAccount.get(row.account_id).push(row.amount);}
  for(const {account,input,full} of controls){
   const saved=byAccount.get(account.id),value=saved?String(decimalSum(saved)):'';
   if(!requests.has(account.id))input.value=value;
   try{purchaseFullInvoicePlan(items,account);full.disabled=false;full.textContent='دفع كامل الفاتورة من هذا الحساب';}
   catch(error){full.disabled=true;full.textContent=error.message;}
  }
  renderRemaining();
 },focus(accountId){controlsById.get(accountId)?.input.focus();}};
}
