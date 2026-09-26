export function customerInput(name,phone,id){
 const cleanName=name.trim(),cleanPhone=phone.trim();
 if(!cleanName)throw new Error('أدخل اسم الزبون');
 if(!/^\d{10}$/.test(cleanPhone))throw new Error('رقم الجوال يجب أن يتكوّن من 10 أرقام');
 return {id,name:cleanName,phone:cleanPhone};
}
export function openCustomer({api,projectId,onSaved}){
 const dialog=document.createElement('dialog');dialog.innerHTML='<h2>إضافة زبون</h2><form><fieldset><label>اسم الزبون<input name="name" required maxlength="120" autocomplete="name"></label><label>رقم الجوال<input name="phone" type="tel" inputmode="numeric" required maxlength="10" pattern="[0-9]{10}" autocomplete="tel"></label></fieldset><p role="alert"></p><div class="actions"><button class="primary" type="submit">حفظ الزبون</button><button type="button" data-close>إلغاء</button></div></form>';document.body.append(dialog);dialog.showModal();
 const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),save=form.querySelector('[type=submit]'),close=form.querySelector('[data-close]');let busy=false,payload=null;const id=crypto.randomUUID();
 close.onclick=()=>{if(!busy)dialog.remove();};dialog.oncancel=e=>{if(busy)e.preventDefault();};
 form.onsubmit=async e=>{e.preventDefault();if(busy)return;try{payload??=customerInput(form.elements.name.value,form.elements.phone.value,id);busy=true;fields.disabled=true;save.disabled=true;close.disabled=true;save.textContent='جارٍ الحفظ…';form.querySelector('[role=alert]').textContent='';const customer=await api.createCustomer(projectId,payload);dialog.remove();onSaved(customer);}catch(error){form.querySelector('[role=alert]').textContent=error.message;if(error.status>=400&&error.status<500||!busy){payload=null;fields.disabled=false;}}finally{busy=false;save.disabled=false;close.disabled=false;save.textContent=payload?'التحقق وإعادة المحاولة':'حفظ الزبون';}};
}
