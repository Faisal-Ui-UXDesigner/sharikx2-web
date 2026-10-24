// Navigation only: no financial payload, arithmetic, persistence or side effects.
export function createSalePaymentStep(){
 let phase='cart';
 return Object.freeze({
  get phase(){return phase;},
  enter(validate){if(phase!=='cart')return false;if(validate()!==true)return false;phase='payment';return true;},
  back(){if(phase!=='payment')return false;phase='cart';return true;},
  recover(){phase='recovery';}
 });
}
