import {escape,money,currency} from './ui.js';
import {currencySymbol} from './currency.js';
import {number} from './owner-path-store.js';
import {ownerPurchaseAccounts,ownerPurchaseAmounts,ownerPurchasePlan,ownerPurchaseLine} from './owner-purchase.js';
import {purchaseAccountPayable,purchaseFullInvoicePlan} from './purchase-payment-options.js';
import {purchaseLineTotal} from './purchase-arithmetic.js';
import {openPurchaseProductChoice} from './purchase-product-choice-ui.js';
import {purchaseCalculatorButton,openPurchaseCalculator} from './purchase-calculator-ui.js';
import {openOwnerPurchaseDebt} from './owner-purchase-review-ui.js';
import {productListContent} from './product-list-ui.js';
import {showToast} from './toast-ui.js';

export function renderOwnerPurchase({container,actions,projectId,products,suppliers,accounts:sourceAccounts,draft,saveDraft,isCurrent=()=>true,onSubmit,onNewProduct,onNewSupplier}){
 const current=()=>container.isConnected&&isCurrent();let child=null,accounts;
 const fail=error=>{if(current()){const alert=container.querySelector('[role=alert]');if(alert){alert.textContent=error.message||'راجع بيانات الفاتورة';alert.hidden=false;alert.scrollIntoView({block:'nearest'});}}};
 try{accounts=ownerPurchaseAccounts(sourceAccounts,projectId);}catch(error){container.innerHTML='<p role="alert"></p>';fail(error);return;}
 const data={version:2,items:structuredClone(draft.items||[]),supplier_id:draft.supplier_id||'',payments:structuredClone(draft.payments||[]),
  entry:structuredClone(draft.entry||{product_id:draft.product_id||'',quantity:draft.quantity||'',unit_cost:draft.unit_cost||''})};
 if(!draft.payments&&draft.paid)data.payments=[{account_id:draft.account_id||accounts.find(a=>a.type==='cash')?.id||accounts[0]?.id,amount:draft.paid}];
 const editable=()=>current()&&!child?.isConnected;
 const persist=()=>{if(!current())return false;try{saveDraft(structuredClone(data));return true;}catch(error){fail(error);return false;}};
 const field=(name,label,value)=>`<label class="op-field">${escape(label)}<input name="${name}" aria-label="${escape(label)}" inputmode="decimal" dir="ltr" value="${escape(value)}" autocomplete="off"></label>`;
 container.innerHTML=`<p class="muted">اختر الأصناف وأدخل الكمية وسعر الشراء لكل صنف.</p><button type="button" class="outline owner-product-select" data-choose-owner-product>اختر صنفًا — بحث وتصنيفات</button><div data-owner-entry hidden><div class="owner-purchase-fields">${field('qty','الكمية',data.entry.quantity)}${field('cost',`سعر شراء الوحدة (${currencySymbol(currency())})`,data.entry.unit_cost)}</div><p class="muted small" data-purchase-unit></p><button type="button" class="outline" data-add-owner-line>إضافة صنف آخر</button></div><button type="button" class="ghost" data-new-product>+ صنف جديد في البضاعة</button><h3>أصناف الفاتورة</h3><div data-owner-purchase-lines></div><label class="op-field">المورد<select name="supplier"><option value="">بدون مورد — دفع كامل</option>${suppliers.map(row=>`<option value="${escape(row.id)}">${escape(row.name)}</option>`).join('')}</select></label><button type="button" class="ghost" data-new-supplier>+ إضافة مورد</button><h3>حسابات الدفع</h3><div class="owner-purchase-accounts">${accounts.map((row,index)=>`<article class="op-card"><b>${escape(row.name)}</b><p class="muted small">الرصيد المتاح: ${escape(money(Math.max(0,row.balance),2))}</p>${field(`pay-${index}`,`المبلغ المدفوع من ${row.name}`,data.payments.find(p=>p.account_id===row.id)?.amount||'')}<p class="small" data-balance-after="${index}"></p><button type="button" class="outline" data-full-owner-payment="${index}">دفع كامل الفاتورة من هذا الحساب</button></article>`).join('')||'<p class="muted">لا توجد حسابات دفع متاحة.</p>'}</div><article class="op-card owner-purchase-summary" aria-live="polite"><div class="op-row"><span>إجمالي الفاتورة</span><b data-purchase-total>—</b></div><div class="op-row"><span>المدفوع الآن</span><b data-purchase-paid>—</b></div><div class="op-row"><span>الباقي قبل أرصدة المورد الدائنة</span><b data-purchase-debt>—</b></div></article><p class="op-error" role="alert" hidden></p>`;
 const input=name=>container.querySelector(`[name="${name}"]`),entry=container.querySelector('[data-owner-entry]');
 const supplier=input('supplier');if(data.supplier_id&&!suppliers.some(row=>row.id===data.supplier_id))supplier.add(new Option('المورد المحفوظ غير متاح — اختر بديلًا',data.supplier_id));supplier.value=data.supplier_id;
 const submit=document.createElement('button');submit.type='button';submit.className='primary';submit.dataset.savePurchase='';submit.textContent='تأكيد فاتورة الشراء';if(actions)actions.replaceChildren(submit);else container.append(submit);
 function paymentRows(){return accounts.flatMap((account,index)=>{
  const raw=input(`pay-${index}`).value.trim();if(!raw)return [];
  const requested=number(raw,2,'1000000000000'),view=purchaseAccountPayable(account,requested);
  return view.payment>0?[{account_id:account.id,amount:String(view.payment)}]:[];
 });}
 function read(){data.entry.quantity=input('qty').value;data.entry.unit_cost=input('cost').value;data.supplier_id=supplier.value;data.payments=accounts.flatMap((row,index)=>{const amount=input(`pay-${index}`).value;return amount?[{account_id:row.id,amount}]:[];});}
 function previewItems(){
  const items=[...data.items];if(data.entry.product_id&&(input('qty').value.trim()||input('cost').value.trim())){
   const line=ownerPurchaseLine({...data.entry,quantity:input('qty').value,unit_cost:input('cost').value},products,projectId),index=items.findIndex(row=>row.product_id===line.product_id);
   if(index<0)items.push(line);else items[index]=line;
  }return items;
 }
 function redraw(){
  const product=products.find(row=>row.product.id===data.entry.product_id)?.product;
  entry.hidden=!data.entry.product_id;container.querySelector('[data-choose-owner-product]').innerHTML=product?productListContent(product):'اختر صنفًا — بحث وتصنيفات';
  container.querySelector('[data-purchase-unit]').textContent=`الكمية بوحدة ${product?.base_unit||'وحدة'}`;
  const list=container.querySelector('[data-owner-purchase-lines]');
  list.innerHTML=data.items.map((line,index)=>{const p=products.find(row=>row.product.id===line.product_id)?.product||{name:'صنف غير متاح'};return `<article class="op-card">${productListContent(p)}<p>${escape(line.quantity_pieces)} ${escape(p.base_unit||'')} × ${escape(money(line.unit_cost,4))} = <b>${escape(money(purchaseLineTotal(line.quantity_pieces,line.unit_cost),2))}</b></p><div class="op-row"><button type="button" class="outline" data-edit-owner-line="${index}">تعديل</button><button type="button" class="outline" data-delete-owner-line="${index}">حذف</button></div></article>`;}).join('')||'<p class="muted">لم تُضف أصناف للفاتورة بعد.</p>';
  for(const button of list.querySelectorAll('[data-edit-owner-line]'))button.onclick=()=>{if(editable())select(data.items[Number(button.dataset.editOwnerLine)].product_id);};
  for(const button of list.querySelectorAll('[data-delete-owner-line]'))button.onclick=()=>{if(!editable())return;const removed=data.items.splice(Number(button.dataset.deleteOwnerLine),1)[0];if(data.entry.product_id===removed.product_id)resetEntry();persist();redraw();};
  totals();
 }
 function totals(){
  try{const values=ownerPurchaseAmounts({items:previewItems(),payments:paymentRows()});for(const [key,value] of [['total',values.total],['paid',values.paid],['debt',values.debt]])container.querySelector(`[data-purchase-${key}]`).textContent=money(value,2);}
  catch{for(const key of ['total','paid','debt'])container.querySelector(`[data-purchase-${key}]`).textContent='—';}
  accounts.forEach((account,index)=>{const target=container.querySelector(`[data-balance-after="${index}"]`);try{const raw=input(`pay-${index}`).value,view=purchaseAccountPayable(account,raw?number(raw,2,'1000000000000'):'0');target.textContent=`المتبقي في الحساب: ${money(view.remaining,2)}`+(view.excess>0?` · الزائد ${money(view.excess,2)} غير مدفوع`:'');target.classList.toggle('negative',view.excess>0);}catch{target.textContent='راجع مبلغ الدفع';}});
 }
 function resetEntry(){data.entry={product_id:'',quantity:'',unit_cost:''};input('qty').value='';input('cost').value='';}
 function select(id){
  const saved=data.items.find(line=>line.product_id===id);data.entry={product_id:id,quantity:saved?.quantity_pieces||'',unit_cost:saved?.unit_cost||''};
  input('qty').value=data.entry.quantity;input('cost').value=data.entry.unit_cost;container.querySelector('[data-add-owner-line]').textContent=saved?'حفظ التعديل وإضافة صنف آخر':'إضافة صنف آخر';persist();redraw();input('qty').focus();
 }
 function choose(){if(!editable())return;read();if(!persist())return;
  child=openPurchaseProductChoice({products:products.map(row=>row.product),projectId,selectedId:data.entry.product_id,mode:'owner',loadSettings:async()=>({}),isCurrent:current,onClose:()=>{child=null;},onSelected:row=>{if(current())select(row.id);}});
 }
 function addEntry(){
  read();if(!data.entry.product_id)return;
  const line=ownerPurchaseLine(data.entry,products,projectId),index=data.items.findIndex(row=>row.product_id===line.product_id);
  if(index<0)data.items.push(line);else data.items[index]=line;
  resetEntry();if(!persist())throw Error('تعذر حفظ مسودة الفاتورة');redraw();
 }
 input('qty').oninput=input('cost').oninput=()=>{if(editable()){read();persist();totals();}};
 for(const [name,target] of [['qty','quantity'],['cost','cost']])purchaseCalculatorButton(input(name),target,(_,field)=>{
  if(!editable())return;const baseline=field.value;
  child=openPurchaseCalculator({owner:container,target,value:baseline,isCurrent:()=>current()&&field.isConnected&&field.value===baseline,onClose:()=>{child=null;},onApply:value=>{field.value=value;read();persist();totals();}});
 });
 supplier.onchange=()=>{if(editable()){read();persist();}};
 accounts.forEach((account,index)=>{
  input(`pay-${index}`).oninput=()=>{if(editable()){read();persist();totals();}};
  container.querySelector(`[data-full-owner-payment="${index}"]`).onclick=()=>{if(!editable())return;try{
   const plan=purchaseFullInvoicePlan(previewItems().map(row=>({quantity:row.quantity_pieces,cost:row.unit_cost})),account);
   accounts.forEach((_,i)=>input(`pay-${i}`).value=i===index?String(plan.payment.amount):'');read();persist();totals();
  }catch(error){showToast(error.message);}};
 });
 container.querySelector('[data-choose-owner-product]').onclick=()=>{if(!editable())return;try{if(data.entry.product_id&&(input('qty').value.trim()||input('cost').value.trim()))addEntry();choose();}catch(error){fail(error);}};
 container.querySelector('[data-add-owner-line]').onclick=()=>{if(!editable())return;try{addEntry();choose();}catch(error){fail(error);}};
 container.querySelector('[data-new-product]').onclick=()=>{if(!editable())return;try{if(data.entry.product_id&&(input('qty').value.trim()||input('cost').value.trim()))addEntry();read();if(persist())onNewProduct?.();}catch(error){fail(error);}};
 container.querySelector('[data-new-supplier]').onclick=()=>{if(editable()){read();if(persist())onNewSupplier?.();}};
 submit.onclick=()=>{if(!editable())return;try{
  if(data.entry.product_id)addEntry();read();if(!persist())return;
  const values=ownerPurchasePlan({draft:{...data,payments:paymentRows()},products,suppliers,accounts,projectId}),amounts=ownerPurchaseAmounts(values);
  if(amounts.debt>0)child=openOwnerPurchaseDebt({owner:container,values,amounts,supplierName:suppliers.find(row=>row.id===values.supplier_id)?.name||'المورد',isCurrent:current,onClose:()=>{child=null;},onConfirm:onSubmit});
  else onSubmit(values);
 }catch(error){fail(error);}};
 redraw();
}
