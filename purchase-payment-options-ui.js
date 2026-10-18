import {escape,money} from './ui.js';
import {purchaseFullInvoicePayment,purchaseAccountPaymentView} from './purchase-payment-options.js';

export function purchasePaymentsMarkup(payments,accounts){
 return payments.map((payment,index)=>`<div class="panel purchase-payment-account">
  <label>الحساب<select data-account="${index}">${accounts.map(account=>`<option value="${escape(account.id)}" ${account.id===payment.account_id?'selected':''}>${escape(account.name)} — المتاح ${money(account.balance,2)}</option>`).join('')}</select></label>
  <p class="muted small" data-purchase-balance-current="${index}"></p>
  <label>مبلغ الدفع<input data-payamount="${index}" type="number" min="0.01" step="0.01" value="${escape(payment.amount)}" required></label>
  <p data-purchase-balance-after="${index}"></p>
  <button type="button" data-removepay="${index}" class="danger">حذف الدفعة</button>
 </div>`).join('')||'<p class="muted">لم تضف دفعات؛ الباقي يصبح دينًا للمورد.</p>';
}

export function mountPurchaseFullPayments(container,catalog,onChoose){
 container.innerHTML=`<h3>دفع كامل الفاتورة من حساب واحد</h3><p class="muted small">اختيار الحساب يستبدل الدفعات الحالية بقيمة الفاتورة كاملة، دون إرسالها.</p>${catalog.accounts.map((account,index)=>`<div class="purchase-full-account"><div><b>${escape(account.name)}</b><small>الرصيد الحالي: ${money(account.balance,2)}</small></div><button type="button" class="outline" data-full-purchase-payment="${index}" aria-label="${escape('دفع كامل قيمة الفاتورة من '+account.name)}"></button></div>`).join('')||'<p class="muted small">لا توجد حسابات متاحة؛ يمكن تسجيل المتبقي دينًا بعد موافقتك.</p>'}`;
 const buttons=[...container.querySelectorAll('[data-full-purchase-payment]')];
 buttons.forEach((button,index)=>{button.onclick=()=>onChoose(catalog.accounts[index]);});
 return items=>buttons.forEach((button,index)=>{
  try{purchaseFullInvoicePayment(items,catalog.accounts[index]);button.disabled=false;button.textContent='دفع كامل الفاتورة من هذا الحساب';}
  catch(error){button.disabled=true;button.textContent=error.message;}
 });
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
