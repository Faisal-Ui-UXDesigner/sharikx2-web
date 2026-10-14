import {openDebtPayment} from './debt-payment-ui.js';
export {collectionPayload} from './debt-payment.js';
export function openCollection({customer,...options}){
 return openDebtPayment({...options,person:customer,kind:'customer'});
}
