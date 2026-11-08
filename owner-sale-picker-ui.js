import {escape,money} from './ui.js';
import {number} from './owner-path-store.js';
import {icon} from './icons.js';
import {decimalSum} from './decimal-sum.js';
import {ownerSaleSubtotal} from './owner-path-money.js';

export function openOwnerSalePicker({rows,cart,sheet,closeSheet,isCurrent,onConfirm}){
 const available=rows.filter(({product,confirmation,purchased})=>(confirmation||purchased)&&Number(product.quantity_pieces)>0);
 const saved=new Map(cart.map(line=>[line.product_id,line]));
 const sources=new Map(available.map(row=>[row.product.id,row]));
 const categories=[...new Set(available.map(({product})=>String(product.category||'').trim()).filter(Boolean))];
 const originalPrice=product=>saved.get(product.id)?.unit_sale_price??product.default_sale_price??'0';
 let category='';
 let selected=[];
 const dialog=sheet('اختيار الأصناف',`
  <label class="op-search debt-search">${icon('search',22)}<input type="search" data-picker-search aria-label="ابحث باسم الصنف أو الباركود" placeholder="ابحث باسم الصنف أو الباركود"></label>
  <div class="op-chips scroll" aria-label="تصنيفات الأصناف">${['',...categories].map(name=>`<button type="button" class="op-chip" data-picker-category="${escape(name)}">${escape(name||'الكل')}</button>`).join('')}</div>
  ${available.length?`<table class="inventory-product-table sale-picker-table"><thead><tr><th scope="col">الاسم</th><th scope="col">التصنيف</th><th scope="col">الكمية</th><th scope="col">سعر البيع</th><th scope="col" aria-label="الكمية المختارة"></th></tr></thead><tbody>
  ${available.map(({product})=>`<tr data-pick-row="${escape(product.id)}"><th scope="row" title="${escape(product.name)}">${escape(product.name)}</th><td>${escape(product.category||'—')}</td><td><bdi>${escape(product.quantity_pieces)}</bdi></td><td><bdi>${escape(money(originalPrice(product),4))}</bdi></td><td><div class="sale-picker-stepper" dir="ltr">
   <button type="button" data-step="1" aria-label="زيادة كمية ${escape(product.name)}">+</button><input inputmode="decimal" aria-label="كمية ${escape(product.name)}" value="${escape(saved.get(product.id)?.quantity??'0')}"><button type="button" data-step="-1" aria-label="إنقاص كمية ${escape(product.name)}">−</button>
  </div></td></tr>`).join('')}</tbody></table>`:'<p class="muted">لا توجد أصناف مؤكدة ومتاحة للبيع حالياً.</p>'}
  <p class="op-error" data-picker-feedback role="status"></p>`,[
  ['تأكيد الأصناف',()=>{if(isCurrent())onConfirm(selected);}],['إلغاء',closeSheet]
 ]);
 const search=dialog.querySelector('[data-picker-search]');
 const feedback=dialog.querySelector('[data-picker-feedback]');
 const confirm=dialog.querySelector('[data-sheet-action="0"]');
 const tabs=[...dialog.querySelectorAll('[data-picker-category]')];
 const rendered=[...dialog.querySelectorAll('[data-pick-row]')];
 const read=input=>number(input.value.trim()||'0',3,'100000000000',true);
 function refresh(){
  let valid=true;
  const next=[];
  for(const row of rendered){
   const {product,source_token}=sources.get(row.dataset.pickRow);
   const input=row.querySelector('input');
   let quantity='0',readable=true;
   try{quantity=read(input);}catch{valid=false;readable=false;}
   const count=Number(quantity);
   if(count<0||count>Number(product.quantity_pieces))valid=false;
   input.classList.toggle('is-empty',readable&&count===0&&input.ownerDocument.activeElement!==input);
   row.querySelector('[data-step="-1"]').classList.toggle('is-empty',count<=0);
   if(count>0)next.push({...saved.get(product.id),product_id:product.id,name:product.name,quantity,
    unit_sale_price:originalPrice(product),source_token});
  }
  let total=0;
  try{total=ownerSaleSubtotal(next);}catch{valid=false;}
  selected=[...next,...cart.filter(line=>!sources.has(line.product_id))];
  if(confirm.disabled===valid)confirm.disabled=!valid;
  const label=`تأكيد الأصناف (${money(total,2)})`;
  if(confirm.textContent!==label)confirm.textContent=label;
  feedback.textContent=valid?'':'راجع الكميات؛ لا تتجاوز المتاح.';
 }
 function filter(){
  const needle=search.value.trim().toLocaleLowerCase();
  for(const row of rendered){
   const {product}=sources.get(row.dataset.pickRow);
   row.hidden=Boolean(category&&String(product.category||'').trim()!==category)||
     !`${product.name} ${product.barcode||''}`.toLocaleLowerCase().includes(needle);
  }
  tabs.forEach(button=>{
   const active=button.dataset.pickerCategory===category;
   button.classList.toggle('on',active);
   button.setAttribute('aria-pressed',String(active));
  });
 }
 for(const row of rendered){
  const input=row.querySelector('input');
  const {product}=sources.get(row.dataset.pickRow);
  input.oninput=refresh;
  input.onfocus=()=>{input.classList.remove('is-empty');input.select();};
  input.onblur=refresh;
  row.querySelectorAll('[data-step]').forEach(button=>button.onclick=()=>{
   if(!isCurrent())return;
   let count;
   try{count=Math.max(0,decimalSum([read(input),Number(button.dataset.step)]));}
   catch{feedback.textContent='راجع الكمية';return;}
   if(count>Number(product.quantity_pieces)){feedback.textContent='الكمية المطلوبة أكثر من المتاح';return;}
   input.value=String(count);refresh();
  });
 }
 tabs.forEach(button=>button.onclick=()=>{category=button.dataset.pickerCategory;filter();});
 search.oninput=filter;
 dialog.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.matches('input'))event.preventDefault();});
 filter();refresh();
 return dialog;
}
