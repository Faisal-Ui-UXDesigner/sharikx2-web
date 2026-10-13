export function bindPaidCustomerInput(container,{isCurrent,onChange}){
 const section=document.createElement('section');section.dataset.paidCustomerInput='';section.innerHTML='<label class="choice"><input type="checkbox" data-type-paid-customer>إدخال بيانات الزبون مباشرة (اختياري)</label><div data-paid-customer-fields hidden><label>اسم الزبون<input data-paid-customer-name maxlength="120" autocomplete="name"></label><label>رقم جوال الزبون<input data-paid-customer-phone type="tel" inputmode="tel" maxlength="64" autocomplete="tel"></label><p class="muted small">نبحث برقم الجوال قبل إنشاء زبون. الاسم الموجود لا يُستبدل بالاسم المدخل، ولا تُسجل المبيعة قبل التأكيد النهائي.</p></div>';
 container.append(section);const check=section.querySelector('[data-type-paid-customer]'),fields=section.querySelector('[data-paid-customer-fields]'),name=section.querySelector('[data-paid-customer-name]'),phone=section.querySelector('[data-paid-customer-phone]');
 let debt=false;
 const draw=()=>{section.hidden=debt;fields.hidden=debt||!check.checked;name.disabled=phone.disabled=debt||!check.checked;};
 check.onchange=()=>{if(section.isConnected&&isCurrent()){draw();onChange();}};draw();
 return Object.freeze({active:()=>!debt&&check.checked,value:()=>({name:name.value,phone:phone.value}),setDebt:value=>{debt=!!value;draw();},clear:()=>{check.checked=false;name.value=phone.value='';draw();},restore:value=>{check.checked=!!value;name.value=value?.name||'';phone.value=value?.phone||'';draw();}});
}
