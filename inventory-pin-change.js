import {pinnedIds} from './inventory-pinned.js';
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
export function inventoryPinMetadata(state){
 if(!record(state))throw new Error('تعذر قراءة تثبيت الأصناف');
 if(state.inventoryPinnedIds!==undefined&&(!Array.isArray(state.inventoryPinnedIds)||state.inventoryPinnedIds.some(id=>!['string','number'].includes(typeof id)||(typeof id==='number'&&!Number.isFinite(id)))))throw new Error('بيانات تثبيت الأصناف غير صالحة');
 const timestamps=state.inventoryPinnedAt;
 if(timestamps!==undefined&&!record(timestamps))throw new Error('تواريخ تثبيت الأصناف غير صالحة');
 return Object.freeze({ids:Object.freeze(pinnedIds(state)),timestamps:Object.freeze({...timestamps})});
}
export function inventoryPinChange(id,pinned,at=Date.now()){
 if(typeof id!=='string'||!id.trim()||typeof pinned!=='boolean')throw new Error('تغيير تثبيت الصنف غير صالح');
 if(pinned&&(!Number.isSafeInteger(at)||at<=0))throw new Error('وقت تثبيت الصنف غير صالح');
 return Object.freeze({id:id.trim(),pinned,at:pinned?at:null});
}
const freezeCopy=source=>{
 const copy=structuredClone(source),queue=[copy],seen=new Set();
 while(queue.length){const value=queue.pop();if(!value||typeof value!=='object'||seen.has(value))continue;seen.add(value);for(const child of Object.values(value))queue.push(child);Object.freeze(value);}
 return copy;
};
export function inventoryPinStateCopy(state){inventoryPinMetadata(state);return freezeCopy(state);}
export function applyInventoryPinChange(state,change){
 const metadata=inventoryPinMetadata(state),ids=metadata.ids.filter(id=>id!==change.id);
 if(change.pinned)ids.push(change.id);
 const timestamps={...metadata.timestamps};delete timestamps[change.id];
 const nextTimestamps=change.pinned?{...timestamps,[change.id]:change.at}:timestamps;
 return freezeCopy({...state,inventoryPinnedIds:ids,inventoryPinnedAt:nextTimestamps});
}
export function inventoryPinChangeMatches(state,change){
 const metadata=inventoryPinMetadata(state),pinned=metadata.ids.includes(change.id);
 return change.pinned?pinned&&Object.hasOwn(metadata.timestamps,change.id)&&Number(metadata.timestamps[change.id])===change.at:!pinned&&!Object.hasOwn(metadata.timestamps,change.id);
}
export function inventoryPinRevision(snapshot){
 if(!Number.isSafeInteger(snapshot?.revision)||snapshot.revision<0)throw new Error('إصدار تثبيت الأصناف غير صالح');
 inventoryPinMetadata(snapshot.state);return snapshot.revision;
}
