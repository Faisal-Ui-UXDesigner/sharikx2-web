import {pinnedIds} from './inventory-pinned.js';
import {inventoryPinChange,applyInventoryPinChange,inventoryPinStateCopy,inventoryPinRevision,inventoryPinChangeMatches} from './inventory-pin-change.js';
export function createInventoryPinOperation({api,projectId,state,mode,isCurrent,onChange=()=>{}}){
 const generation=api.generation,epoch=api.deviceEpoch;
 let view=inventoryPinStateCopy(state),busy=false,pending=null,active=null,error='';
 const current=()=>isCurrent()&&api.generation===generation&&api.deviceEpoch===epoch;
 const model=()=>Object.freeze({state:view,busy,pending,error});
 const emit=()=>{if(current()){try{onChange(model());}catch{/* Presentation failure never becomes a retryable save error. */}}};
 const read=async()=>{const snapshot=await api.financeState(projectId);if(!current())return null;inventoryPinRevision(snapshot);return snapshot;};
 const confirmed=snapshot=>{view=inventoryPinStateCopy(snapshot.state);pending=null;error='';};
 const uncertain=()=>{error='تعذر تأكيد نتيجة التثبيت؛ تحقق من النتيجة قبل إجراء تغيير جديد.';};
 const verify=()=>{
  if(mode!=='owner'||!current())return Promise.resolve(null);
  if(active)return active;if(busy||!pending)return Promise.resolve(model());
  busy=true;error='';emit();
  active=(async()=>{
   try{const snapshot=await read();if(!snapshot)return null;
    if(snapshot.revision>=pending.expectedRevision&&inventoryPinChangeMatches(snapshot.state,pending.change))confirmed(snapshot);else uncertain();
   }catch{uncertain();}
   finally{busy=false;active=null;emit();}
   return model();
  })();return active;
 };
 const toggle=(id,at=Date.now())=>{
  if(mode!=='owner'||!current())return Promise.resolve(null);
  if(active)return active;if(busy||pending)return Promise.resolve(model());
  const target=typeof id==='string'?id.trim():id;
  const change=inventoryPinChange(target,!pinnedIds(view).includes(target),at),previous=view;
  view=applyInventoryPinChange(view,change);busy=true;error='';emit();
  active=(async()=>{
   let dispatched=false;
   try{
    const snapshot=await read();if(!snapshot){view=previous;return null;}
    if(inventoryPinChangeMatches(snapshot.state,change))confirmed(snapshot);
    else{
     const revision=inventoryPinRevision(snapshot),next=applyInventoryPinChange(snapshot.state,change);
     if(revision===Number.MAX_SAFE_INTEGER)throw new Error('إصدار تثبيت الأصناف يتجاوز حد الحفظ المدعوم');
     pending=Object.freeze({change,expectedRevision:revision+1});
     if(!current()){view=previous;pending=null;return null;}
     dispatched=true;const response=await api.saveFinanceState(projectId,next,revision);
     if(!current())return null;
     if(!Number.isSafeInteger(response?.revision)||response.revision!==revision+1)throw new Error('تعذر تأكيد إصدار التثبيت');
     confirmed({state:next,revision:response.revision});
    }
   }catch(cause){
    if(!dispatched||cause?.notDispatched===true){view=previous;pending=null;error=cause?.message||'تعذر حفظ تثبيت الصنف؛ لم يُرسل تغيير جديد';}
    else uncertain();
   }finally{busy=false;active=null;emit();}
   return model();
  })();return active;
 };
 return Object.freeze({model,toggle,verify});
}
