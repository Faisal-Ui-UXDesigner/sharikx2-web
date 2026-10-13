import {normalizePhone} from './phone.js';
import {loadCustomerCatalog} from './customer-catalog.js';
export function paidCustomerInput(name,phone){
 const input=Object.freeze({name:String(name??'').trim(),phone:normalizePhone(phone)});
 if(!input.name&&!input.phone)return null;
 if(input.name.length<2||!/^[0-9]{10}$/.test(input.phone))throw new Error('أكمل اسم الزبون ورقم جواله، أو اترك الحقلين فارغين');
 return input;
}
export async function resolvePaidCustomer(api,projectId,input,isCurrent=()=>true){
 if(!isCurrent())throw new Error('CUSTOMER_SCREEN_CLOSED');
 const value=paidCustomerInput(input?.name,input?.phone);if(!value)return Object.freeze({kind:'none',customer:null,input:null});
 const catalog=await loadCustomerCatalog(api,projectId,isCurrent),customer=catalog.customers.find(row=>normalizePhone(row.phone)===value.phone);
 return Object.freeze({kind:customer?'existing':'create',customer:customer||null,input:value});
}
