// Native CashierProductPickerState + pre-picker draft restoration. Memory only.
export function createSalePickerSession(cart){
 if(!Array.isArray(cart))throw Error('تعذر قراءة السلة');
 const seen=new Set();
 for(const line of cart){
  if(!line||typeof line.id!=='string'||!line.id||seen.has(line.id))throw Error('تعذر قراءة أصناف السلة');
  seen.add(line.id);
  for(const key of ['quantity','stock','price','cost'])if(typeof line[key]!=='number'||!Number.isFinite(line[key])||line[key]<0)throw Error('تعذر قراءة قيم السلة');
  if(line.quantity<=0)throw Error('كمية الصنف غير صالحة');
 }
 const original=structuredClone(cart);let phase='editing';
 return Object.freeze({get phase(){return phase;},commit(){if(phase!=='editing')return false;phase='committed';return true;},cancel(){if(phase!=='editing')return null;phase='cancelled';return structuredClone(original);}});
}
