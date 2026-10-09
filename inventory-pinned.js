const ids=value=>Array.isArray(value)?value.map(item=>String(item||'').trim()).filter(Boolean):[];
export function pinnedIds(state){return [...new Set(ids(state?.inventoryPinnedIds))];}
export function isPinned(state,id){return pinnedIds(state).includes(String(id));}
export function togglePinned(state,id,now=Date.now()){
 const next={...(state||{})},target=String(id||'').trim(),current=pinnedIds(next);if(!target)return {state:next,pinned:false};
 const index=current.indexOf(target);if(index>=0){current.splice(index,1);next.inventoryPinnedIds=current;return {state:next,pinned:false};}
 next.inventoryPinnedIds=[...current,target];next.inventoryPinnedAt={...(next.inventoryPinnedAt||{}),[target]:Number(now)||Date.now()};return {state:next,pinned:true};
}
export function sortPinnedRows(rows,state){const pinned=new Set(pinnedIds(state)),timestamps=state?.inventoryPinnedAt&&typeof state.inventoryPinnedAt==='object'?state.inventoryPinnedAt:{};return [...(Array.isArray(rows)?rows:[])].sort((a,b)=>{const aid=String(a?.id||''),bid=String(b?.id||''),ap=pinned.has(aid),bp=pinned.has(bid);if(ap!==bp)return bp-ap;if(ap&&Number(timestamps[aid])!==Number(timestamps[bid]))return Number(timestamps[bid]||0)-Number(timestamps[aid]||0);const ad=Date.parse(a?.created_at||a?.createdAt||'')||0,bd=Date.parse(b?.created_at||b?.createdAt||'')||0;return bd-ad;});}
export async function savePinnedState(api,projectId,state){const snapshot=await api.financeState(projectId);if(!snapshot?.state||typeof snapshot.state!=='object'||Array.isArray(snapshot.state))throw new Error('تعذر قراءة تثبيت الأصناف');const saved=await api.saveFinanceState(projectId,{...snapshot.state,inventoryPinnedIds:pinnedIds(state),inventoryPinnedAt:state.inventoryPinnedAt||{}},Number(snapshot.revision)||0);return saved;}
