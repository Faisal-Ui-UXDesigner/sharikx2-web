import {escape,money,currency} from './ui.js';
import {currencySymbol} from './currency.js';
import {ownerPurchaseAccounts,ownerPurchaseAmounts,ownerPurchasePlan} from './owner-purchase.js';
import {decimalSum} from './decimal-sum.js';

const options=(rows,selected,blank)=>`${blank!==undefined?`<option value="">${escape(blank)}</option>`:''}${selected&&!rows.some(row=>row.id===selected)?`<option value="${escape(selected)}" selected>الاختيار المحفوظ غير متاح — اختر بديلًا</option>`:''}${rows.map(row=>`<option value="${escape(row.id)}" ${row.id===selected?'selected':''}>${escape(row.name)}</option>`).join('')}`;
const field=(name,label,value,scale)=>`<label class="op-field">${escape(label)}${name==='qty'?'':` (${escape(currencySymbol(currency()))})`}<input name="${name}" aria-label="${escape(label)}" inputmode="decimal" dir="ltr" autocomplete="off" value="${escape(value??'')}" data-scale="${scale}"></label>`;

export function renderOwnerPurchase({container,actions,projectId,products,suppliers,accounts:sourceAccounts,draft,saveDraft,isCurrent=()=>true,onSubmit,onNewProduct,onNewSupplier}){
 const current=()=>container.isConnected&&isCurrent();
 const fail=error=>{if(current()){const alert=container.querySelector('[role=alert]');alert.textContent=error.message||'راجع بيانات الفاتورة';alert.hidden=false;alert.scrollIntoView({block:'nearest'});}};
 let accounts;try{accounts=ownerPurchaseAccounts(sourceAccounts,projectId);}catch(error){container.innerHTML='<p role="alert"></p>';fail(error);return;}
 const productRows=products.map(row=>({id:row.product.id,name:row.product.name}));
 const selected=draft.product_id||(productRows[0]?.id||''),cash=accounts.find(row=>row.type==='cash')||accounts[0];
 container.innerHTML=`<p class="muted">البضاعة التي اشتريتها من مورد تدخل كفاتورة شراء، ولا تغيّر أرقام البداية.</p><label class="op-field">الصنف<select name="product">${options(productRows,selected,productRows.length?undefined:'لا توجد أصناف')}</select></label><button type="button" class="ghost" data-new-product>+ صنف جديد</button><div class="owner-purchase-fields">${field('qty','الكمية',draft.quantity,3)}${field('cost','سعر شراء الوحدة',draft.unit_cost,4)}</div><p class="muted small" data-purchase-unit></p><label class="op-field">المورد<select name="supplier">${options(suppliers,draft.supplier_id,'بدون مورد — دفع كامل')}</select></label><button type="button" class="ghost" data-new-supplier>+ إضافة مورد</button><label class="op-field">الحساب الذي دفعت منه<select name="account">${options(accounts,draft.account_id||cash?.id,accounts.length?undefined:'لا توجد حسابات')}</select></label>${field('paid','المبلغ المدفوع',draft.paid??'0',2)}<p class="muted small" data-purchase-balance></p><article class="op-card" aria-live="polite"><div class="op-row"><span>قيمة الفاتورة</span><b data-purchase-total>—</b></div><div class="op-row"><span>المتبقي للمورد قبل الأرصدة الدائنة</span><b data-purchase-debt>—</b></div><p class="muted small">التكلفة بأربع منازل عشرية والإجمالي مقرب لكل بند إلى منزلتين. هذه معاينة؛ الدين النهائي بعد أرصدة المورد واعتماد المخزون من الخادم.</p></article><p class="op-error" role="alert" hidden></p><button type="button" class="primary" data-save-purchase>تسجيل فاتورة شراء</button>`;
 const input=name=>container.querySelector(`[name=${name}]`),read=()=>({product_id:input('product').value,supplier_id:input('supplier').value,account_id:input('account').value,quantity:input('qty').value,unit_cost:input('cost').value,paid:input('paid').value});
 function preserve(){if(!current())return false;try{saveDraft(read());return true;}catch(error){fail(error);return false;}}
 function redraw(){
  const value=read(),product=products.find(row=>row.product.id===value.product_id)?.product,account=accounts.find(row=>row.id===value.account_id);
  const unit=product?.base_unit||'وحدة';input('qty').setAttribute('aria-label',`الكمية (${unit})`);container.querySelector('[data-purchase-unit]').textContent=`الكمية بوحدة ${unit}`;
  container.querySelector('[data-purchase-balance]').textContent=account?`الرصيد المتاح: ${money(account.balance,2)}`:'';
  try{const amounts=ownerPurchaseAmounts(value);container.querySelector('[data-purchase-total]').textContent=money(amounts.total,2);container.querySelector('[data-purchase-debt]').textContent=money(amounts.debt,2);
   if(account)container.querySelector('[data-purchase-balance]').textContent+=` · بعد الدفع: ${money(decimalSum([account.balance,-Number(amounts.paid)]),2)}`;
  }catch{container.querySelector('[data-purchase-total]').textContent='—';container.querySelector('[data-purchase-debt]').textContent='—';}
 }
 container.querySelectorAll('input,select').forEach(node=>{const changed=()=>{if(!current())return;container.querySelector('[role=alert]').hidden=true;redraw();preserve();};node.addEventListener('input',changed);node.addEventListener('change',changed);});
 container.querySelector('[data-new-product]').onclick=()=>{if(preserve())onNewProduct?.();};
 container.querySelector('[data-new-supplier]').onclick=()=>{if(preserve())onNewSupplier?.();};
 const submit=container.querySelector('[data-save-purchase]');
 submit.onclick=()=>{if(!current()||!preserve())return;try{onSubmit(ownerPurchasePlan({draft:read(),products,suppliers,accounts,projectId}));}catch(error){fail(error);}};
 if(actions)actions.append(submit);
 redraw();
}
