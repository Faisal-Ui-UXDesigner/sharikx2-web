import {inventoryCreationCapacity} from './inventory-capacity.js';
const dialogs=new WeakMap();
export function checkInventoryCreation({container,project,projectId,getCount,isCurrent,onPlans}){
 if(!container.isConnected||!isCurrent())return false;
 let model;
 try{model=inventoryCreationCapacity({count:getCount(),project,projectId});}
 catch(error){
  let message=container.querySelector('[data-inventory-capacity-error]');
  if(!message){message=document.createElement('p');message.dataset.inventoryCapacityError='true';message.setAttribute('role','alert');container.prepend(message);}
  message.textContent=error.message;return false;
 }
 container.querySelector('[data-inventory-capacity-error]')?.remove();
 if(model.allowed)return true;
 const existing=dialogs.get(container);if(existing?.isConnected){existing.focus();return false;}
 const dialog=document.createElement('dialog');dialog.dataset.inventoryCapacity='true';
 dialog.innerHTML='<h2></h2><p></p><div class="actions"><button type="button" data-plans class="primary">الاشتراك الآن</button><button type="button" data-later class="outline">لاحقاً</button></div>';
 dialog.querySelector('h2').textContent=model.title;dialog.querySelector('p').textContent=model.message;
 const close=()=>dialog.remove();dialog.querySelector('[data-later]').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 const plans=dialog.querySelector('[data-plans]');plans.disabled=typeof onPlans!=='function';
 plans.onclick=()=>{if(isCurrent()&&container.isConnected&&dialog.isConnected){close();onPlans?.();}};
 container.append(dialog);dialogs.set(container,dialog);dialog.showModal();return false;
}
