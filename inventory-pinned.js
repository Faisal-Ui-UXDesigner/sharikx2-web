import {orderInventoryRows} from './inventory-order.js';
const ids=value=>Array.isArray(value)?value.map(item=>String(item||'').trim()).filter(Boolean):[];
export function pinnedIds(state){return [...new Set(ids(state?.inventoryPinnedIds))];}
export function isPinned(state,id){return pinnedIds(state).includes(String(id));}
export function togglePinned(state,id,now=Date.now()){
 const next={...(state||{})},target=String(id||'').trim(),current=pinnedIds(next);if(!target)return {state:next,pinned:false};
 const index=current.indexOf(target);if(index>=0){current.splice(index,1);next.inventoryPinnedIds=current;return {state:next,pinned:false};}
 next.inventoryPinnedIds=[...current,target];next.inventoryPinnedAt={...(next.inventoryPinnedAt||{}),[target]:Number(now)||Date.now()};return {state:next,pinned:true};
}
export function sortPinnedRows(rows,state){
 const timestamps=state?.inventoryPinnedAt&&typeof state.inventoryPinnedAt==='object'&&!Array.isArray(state.inventoryPinnedAt)?state.inventoryPinnedAt:{};
 return orderInventoryRows(rows,{pinnedIds:pinnedIds(state),timestamps});
}
export async function savePinnedState(api,projectId,state){const snapshot=await api.financeState(projectId);if(!snapshot?.state||typeof snapshot.state!=='object'||Array.isArray(snapshot.state))throw new Error('تعذر قراءة تثبيت الأصناف');const saved=await api.saveFinanceState(projectId,{...snapshot.state,inventoryPinnedIds:pinnedIds(state),inventoryPinnedAt:state.inventoryPinnedAt||{}},Number(snapshot.revision)||0);return saved;}
