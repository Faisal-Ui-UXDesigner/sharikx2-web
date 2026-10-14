import {contactTarget} from './phone.js';
export function appendContactAction(container,{phone,isCurrent=()=>true}){
 const target=contactTarget(phone),control=document.createElement(target?'a':'button');
 control.className='contact-call outline';control.dataset.contactCall='';control.textContent='اتصال';
 if(target){control.href=target;control.setAttribute('aria-label',`اتصال على ${target.slice(4)}`);control.onclick=event=>{event.stopPropagation();if(!container.isConnected||!isCurrent())event.preventDefault();};}
 else{control.type='button';control.disabled=true;control.title='لا يوجد رقم جوال صالح';}
 container.append(control);return control;
}
