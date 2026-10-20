import {escape,money} from './ui.js';
import {purchaseAccountPaymentView} from './purchase-payment-options.js';

export function purchasePaymentsMarkup(payments,accounts){
 return payments.map((payment,index)=>`<div class="panel purchase-payment-account">
  <label>الحساب<select data-account="${index}">${accounts.map(account=>`<option value="${escape(account.id)}" ${account.id===payment.account_id?'selected':''}>${escape(account.name)} — المتاح ${money(account.balance,2)}</option>`).join('')}</select></label>
  <p class="muted small" data-purchase-balance-current="${index}"></p>
  <label>مبلغ الدفع<input data-payamount="${index}" type="number" min="0.01" step="0.01" value="${escape(payment.amount)}" required></label>
  <p data-purchase-balance-after="${index}"></p>
  <button type="button" data-removepay="${index}" class="danger">حذف الدفعة</button>
 </div>`).join('')||'<p class="muted">لم تضف دفعات؛ الباقي يصبح دينًا للمورد.</p>';
}

export function renderPurchasePaymentBalances(form,payments,catalog){
 for(const label of form.querySelectorAll('[data-purchase-balance-after]')){
  const index=Number(label.dataset.purchaseBalanceAfter),payment=payments[index],account=catalog.get(payment?.account_id);
  const input=form.querySelector(`[data-payamount="${index}"]`),current=form.querySelector(`[data-purchase-balance-current="${index}"]`);
  input?.setAttribute('aria-label',account?'المبلغ المدفوع للمورد من '+account.name:'المبلغ المدفوع للمورد — الحساب غير متاح');
  try{
   if(!input||input.value==='')throw new Error('أكمل مبلغ الدفع لعرض الرصيد المتبقي');
   const view=purchaseAccountPaymentView(account,input.value);
   current.textContent='الرصيد الحالي: '+money(view.balance,2);
   label.textContent='المتبقي في الحساب: '+money(view.remaining,2)+(view.exceeds?' — المبلغ أكبر من الرصيد؛ صححه قبل التأكيد':'');
   label.classList.toggle('purchase-payment-exceeds',view.exceeds);
  }catch(error){current.textContent=account?'الرصيد الحالي: '+money(account.balance,2):'الحساب المحفوظ غير متاح';label.textContent=error.message;label.classList.remove('purchase-payment-exceeds');}
 }
}
