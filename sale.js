import {escape,money} from './ui.js';
import {createOperation} from './operations.js';
import {openCustomer} from './customer.js';
export function cartTotal(cart){return cart.reduce((sum,x)=>sum+Number(x.quantity)*Number(x.price),0);}
export function salePayload(projectId,cart,accountId,accounts,{asDebt=false,customer=null}={}){
 if(!cart.length)throw new Error('أضف صنفًا واحدًا على الأقل');
 if(!asDebt&&!accounts.some(a=>a.id===accountId))throw new Error('اختر حساب استلام المبلغ');
 if(asDebt&&(!customer?.id||!customer.name?.trim()||!/^\d{10}$/.test(customer.phone||'')))throw new Error('البيع بالدين يتطلب زبونًا باسمه ورقم جواله المكوّن من 10 أرقام');
 const ids=new Set();
 const items=cart.map(x=>{
  if(ids.has(x.id))throw new Error('الصنف مكرر');ids.add(x.id);
  if(!Number.isFinite(x.quantity)||x.quantity<=0||x.quantity>Number(x.stock))throw new Error('الكمية غير صحيحة أو أكبر من المخزون');
  if(!Number.isInteger(x.price)||x.price<0)throw new Error('سعر البيع يجب أن يكون رقمًا صحيحًا غير سالب');
  return {product_id:x.id,quantity:x.quantity,unit_sale_price:x.price};
 });
 // Receiving funds never checks available balance: zero balance is valid.
 return {p_project_id:projectId,p_items:items,p_discount:0,p_customer_id:customer?.id||null,p_account_id:asDebt?null:accountId,p_as_debt:asDebt};
}
export async function openSale({api,projectId,mode,storage,onSaved}){
 if(mode!=='owner')throw new Error('المشاركة للمشاهدة فقط');
 if(document.querySelector('dialog.sale-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='sale-dialog';dialog.innerHTML='<h2>مبيعة جديدة</h2><div class="body"><div class="skeleton"></div></div><button data-close class="outline">إلغاء</button>';document.body.append(dialog);dialog.showModal();
 let busy=false,operation=null,cart=[],products=[],offset=0,more=true,uncertain=false;
 const journalKey=`sharikx2-pending-sale:${projectId}`;
 dialog.querySelector('[data-close]').onclick=()=>{if(!busy)dialog.remove();};dialog.oncancel=e=>{if(busy)e.preventDefault();};
 try{
  const [page,summary]=await Promise.all([api.rows('products',projectId,'*',0,{active:'eq.true'}),api.summary(projectId)]);if(!dialog.isConnected)return;
  products=page;offset=page.length;more=page.length===20;const accounts=summary.accounts||[];
  dialog.querySelector('.body').innerHTML=`<section data-picker><label>بحث في الأصناف المحملة<input type="search" data-search placeholder="اسم الصنف أو الباركود"></label><div class="product-picker"></div><button data-more class="outline">تحميل المزيد</button></section><form><fieldset><h2>أصناف المبيعة</h2><div data-cart></div><div class="panel row"><span>إجمالي المبيعة</span><strong data-total>0 ₪</strong></div><h2>طريقة استلام المبلغ</h2><p class="muted small">يضاف إليه مبلغ المبيعة — لا يُخصم من رصيده</p><div class="account-choices">${accounts.map(a=>`<label class="choice"><input type="radio" name="account" value="${escape(a.id)}" required><span>${escape(a.name)}</span></label>`).join('')}</div><p class="muted small">هذه المرحلة تدعم البيع المدفوع لزبون غير محدد. اختيار الزبون والبيع بالدين والمسح بالكاميرا قيد الاستكمال.</p></fieldset><p role="alert"></p><button class="primary" type="submit">تأكيد المبيعة</button></form>`;
  const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),error=form.querySelector('[role=alert]'),confirm=form.querySelector('[type=submit]'),picker=dialog.querySelector('[data-picker]');
  confirm.before(form.querySelector('[data-total]').closest('.panel'));
  const customerBox=document.createElement('section');customerBox.innerHTML='<h2>معلومات الزبون</h2><label class="choice"><input type="checkbox" name="asDebt">بيع بالدين</label><p class="muted small">اختيار الزبون اختياري للمبيعة المدفوعة، وإلزامي للدين مع اسم ورقم جوال صحيح.</p><label>الزبون<select name="customer"><option value="">زبون غير محدد</option></select></label><button type="button" data-customers-more class="outline">تحميل الزبائن</button><p data-customer-status class="muted small"></p>';
  fields.append(customerBox);
  fields.querySelectorAll('p').forEach(p=>{if(p.textContent.includes('هذه المرحلة تدعم'))p.textContent='إضافة زبون جديد والمسح بالكاميرا قيد الاستكمال.';});
  let customers=[],customerOffset=0;
  const customerSelect=form.elements.customer,debtInput=form.elements.asDebt,accountChoices=fields.querySelector('.account-choices');
  const updatePayment=()=>{accountChoices.hidden=debtInput.checked;form.querySelectorAll('[name=account]').forEach(x=>x.required=!debtInput.checked);customerSelect.required=debtInput.checked;};
  debtInput.onchange=updatePayment;
  const addCustomer=document.createElement('button');addCustomer.type='button';addCustomer.className='outline';addCustomer.textContent='إضافة زبون';customerBox.append(addCustomer);
  addCustomer.onclick=()=>openCustomer({api,projectId,onSaved:c=>{if(!customers.some(x=>x.id===c.id)){customers.push(c);const option=document.createElement('option');option.value=c.id;option.textContent=`${c.name} — ${c.phone}`;customerSelect.append(option);}customerSelect.value=c.id;customerBox.querySelector('[data-customer-status]').textContent='تم اختيار الزبون المضاف';}});
  fields.querySelectorAll('p').forEach(p=>{if(p.textContent.includes('إضافة زبون جديد والمسح'))p.textContent='المسح بالكاميرا قيد الاستكمال.';});
  customerBox.querySelector('[data-customers-more]').onclick=async e=>{const button=e.target;button.disabled=true;button.textContent='جارٍ تحميل الزبائن…';try{const next=await api.rows('customers',projectId,'*',customerOffset,{active:'eq.true'});if(!dialog.isConnected)return;customers.push(...next);customerOffset+=next.length;next.forEach(c=>{const option=document.createElement('option');option.value=c.id;option.textContent=`${c.name} — ${c.phone||'بدون رقم'}`;customerSelect.append(option);});customerBox.querySelector('[data-customer-status]').textContent=customers.length?'':'لا يوجد زبائن حتى الآن';button.hidden=next.length<20;}catch(e){error.textContent=e.message;}finally{button.disabled=false;button.textContent='تحميل المزيد من الزبائن';}};
  const totals=()=>form.querySelector('[data-total]').textContent=money(cartTotal(cart));
  const drawCart=()=>{form.querySelector('[data-cart]').innerHTML=cart.length?cart.map(x=>`<article class="panel" data-line="${escape(x.id)}"><div class="row"><b>${escape(x.name)}</b><button type="button" data-remove="${escape(x.id)}">إزالة</button></div><div class="input-pair"><label>الكمية<input data-qty="${escape(x.id)}" type="number" inputmode="decimal" min="0.001" step="0.001" max="${escape(x.stock)}" value="${escape(x.quantity)}" required></label><label>سعر البيع<input data-price="${escape(x.id)}" type="number" inputmode="numeric" step="1" min="0" value="${escape(x.price)}" required></label></div><p class="price-warning" data-warning="${escape(x.id)}" ${x.price<x.cost?'':'hidden'}>تنبيه: سعر البيع أقل من تكلفة الشراء ${money(x.cost,2)}</p></article>`).join(''):'<p class="muted">لم تُضف أصنافًا بعد</p>';
   form.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{cart=cart.filter(x=>x.id!==b.dataset.remove);drawCart();});
   form.querySelectorAll('[data-qty],[data-price]').forEach(input=>input.oninput=()=>{const id=input.dataset.qty||input.dataset.price,item=cart.find(x=>x.id===id);if(input.dataset.qty)item.quantity=Number(input.value);else{item.price=Number(input.value);form.querySelector(`[data-warning="${id}"]`).hidden=item.price>=item.cost;}totals();});totals();
  };
  const drawProducts=()=>{const q=dialog.querySelector('[data-search]').value;picker.querySelector('.product-picker').innerHTML=products.filter(p=>`${p.name} ${p.barcode}`.includes(q)).map(p=>`<button type="button" class="panel row" data-product="${escape(p.id)}" ${Number(p.quantity_pieces)<=0?'disabled':''}><span>${escape(p.name)}</span><small>المتوفر ${escape(p.quantity_pieces)}</small></button>`).join('')||'<p>لا توجد نتائج</p>';picker.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>{const p=products.find(x=>x.id===b.dataset.product),found=cart.find(x=>x.id===p.id);if(found){if(found.quantity+1>Number(p.quantity_pieces)){error.textContent='لا تكفي الكمية المتاحة';return;}found.quantity++;}else cart.push({id:p.id,name:p.name,quantity:Math.min(1,Number(p.quantity_pieces)),stock:Number(p.quantity_pieces),price:Number(p.default_sale_price),cost:Number(p.weighted_unit_cost)});drawCart();});picker.querySelector('[data-more]').hidden=!more;};
  dialog.querySelector('[data-search]').oninput=drawProducts;
  picker.querySelector('[data-more]').onclick=async e=>{e.target.disabled=true;try{const next=await api.rows('products',projectId,'*',offset,{active:'eq.true'});if(!dialog.isConnected)return;products.push(...next);offset+=next.length;more=next.length===20;drawProducts();}catch(e){error.textContent=e.message;}finally{picker.querySelector('[data-more]').disabled=false;}};
  try{const saved=JSON.parse(storage?.getItem(journalKey)||'null');if(saved?.payload?.p_project_id===projectId){cart=saved.cart;operation=createOperation('confirm_sharikx2_sale_web_v1',saved.payload,saved.requestId);uncertain=true;fields.disabled=true;picker.hidden=true;form.elements.account.value=saved.payload.p_account_id;confirm.textContent='التحقق من المبيعة السابقة';error.textContent='سنُعيد نفس الطلب دون إنشاء مبيعة أخرى.';}}catch{error.textContent='تعذر قراءة مسودة المبيعة السابقة. تحقق من السجل قبل إنشاء بديل.';confirm.disabled=true;}
  drawProducts();drawCart();
  if(operation){const saved=JSON.parse(storage.getItem(journalKey));debtInput.checked=!!saved.payload.p_as_debt;updatePayment();if(saved.payload.p_customer_id){const option=document.createElement('option');option.value=saved.payload.p_customer_id;option.textContent='الزبون المحدد في المبيعة السابقة';customerSelect.append(option);customerSelect.value=option.value;}}
  form.onsubmit=async e=>{e.preventDefault();if(busy)return;try{
   if(!operation){const payload=salePayload(projectId,cart,form.elements.account.value,accounts,{asDebt:debtInput.checked,customer:customers.find(c=>c.id===customerSelect.value)});if(!storage)throw new Error('تخزين الجلسة مطلوب لحماية إعادة المحاولة');const candidate=createOperation('confirm_sharikx2_sale_web_v1',payload);storage.setItem(journalKey,JSON.stringify({requestId:candidate.requestId,payload,cart}));operation=candidate;}
   busy=true;fields.disabled=true;picker.hidden=true;confirm.disabled=true;dialog.querySelector('[data-close]').disabled=true;confirm.textContent='جارٍ اعتماد المبيعة…';error.textContent='';
   await operation.run(api);storage.removeItem(journalKey);dialog.remove();onSaved();
  }catch(e){error.textContent=e.message.startsWith('OUT_OF_STOCK')?'تغيّر المخزون؛ الكمية المطلوبة لم تعد متاحة.':e.message;
   if(e.status>=400&&e.status<500){operation=null;uncertain=false;storage?.removeItem(journalKey);fields.disabled=false;picker.hidden=false;}else if(operation){uncertain=true;error.textContent+=' — اضغط التحقق لإعادة نفس الطلب بأمان.';}
  }finally{busy=false;confirm.disabled=false;dialog.querySelector('[data-close]').disabled=false;confirm.textContent=uncertain?'التحقق وإعادة المحاولة':'تأكيد المبيعة';}};
 }catch(e){if(dialog.isConnected)dialog.querySelector('.body').textContent=e.message;}
}
