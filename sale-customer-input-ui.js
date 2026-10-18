export function bindPaidCustomerInput(container,{isCurrent,onChange}){
 const section=document.createElement('section');section.dataset.paidCustomerInput='';section.innerHTML='<div data-paid-customer-fields><label>اسم الزبون<input data-paid-customer-name maxlength="120" autocomplete="name" placeholder="اختياري"></label><label>رقم جوال الزبون<input data-paid-customer-phone type="tel" inputmode="tel" maxlength="64" autocomplete="tel" placeholder="اختياري" dir="ltr"></label><p class="muted small">اترك الحقلين فارغين لمبيعة دون زبون، أو أكمل الاسم والجوال. نبحث بالجوال دون تغيير اسم الزبون الموجود.</p></div>';
 container.append(section);const name=section.querySelector('[data-paid-customer-name]'),phone=section.querySelector('[data-paid-customer-phone]');
 let debt=false;
 const draw=()=>{section.hidden=debt;name.disabled=phone.disabled=debt;};
 const changed=()=>{if(section.isConnected&&isCurrent())onChange();};name.oninput=phone.oninput=changed;draw();
 return Object.freeze({active:()=>!debt&&!!(name.value.trim()||phone.value.trim()),value:()=>({name:name.value,phone:phone.value}),setDebt:value=>{debt=!!value;draw();},clear:()=>{name.value=phone.value='';draw();},restore:value=>{name.value=value?.name||'';phone.value=value?.phone||'';draw();}});
}
