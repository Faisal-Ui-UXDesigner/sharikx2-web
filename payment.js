import {openDebtPayment} from './debt-payment-ui.js';
export {paymentPayload} from './debt-payment.js';
export function openPayment({supplier,...options}){
 return openDebtPayment({...options,person:supplier,kind:'supplier'});
}
