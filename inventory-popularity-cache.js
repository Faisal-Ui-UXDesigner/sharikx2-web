import {popularityDailyCounts,popularityWindow} from './inventory-popularity.js';
export const POPULARITY_REFRESH_MS=60000;
const caches=new WeakMap();
const clock=now=>{if(typeof now!=='number'||!Number.isFinite(now)||now<=0)throw new Error('وقت تحديث الرواج غير صالح');return now;};
const project=id=>{if(typeof id!=='string'||!id.trim())throw new Error('مشروع الرواج غير صالح');return id;};
const scope=api=>JSON.stringify([api.generation??0,api.config?.url??'',api.deviceContext?.mode??'']);
function bucket(api){
 const key=scope(api);let saved=caches.get(api);
 if(!saved||saved.scope!==key){saved={scope:key,projects:new Map()};caches.set(api,saved);}
 return saved;
}
export function popularitySnapshot(projectId,sales,now=Date.now()){
 project(projectId);clock(now);if(!Array.isArray(sales))throw new Error('بيانات رواج الأصناف غير صالحة');
 const dailyCounts=[...popularityDailyCounts(sales,now)].map(([id,days])=>Object.freeze([id,Object.freeze([...days].map(entry=>Object.freeze(entry)))]));
 return Object.freeze({projectId,loadedAt:now,dailyCounts:Object.freeze(dailyCounts)});
}
export function snapshotPopularityCounts(snapshot,now=Date.now()){
 clock(now);const {startDay,today}=popularityWindow(now),counts=new Map();
 for(const [id,days] of snapshot.dailyCounts){
  let total=0;for(const [day,count] of days)if(day>=startDay&&day<=today)total+=count;
  counts.set(id,Math.min(2147483647,total));
 }
 return counts;
}
const expired=(snapshot,now)=>!snapshot||now<snapshot.loadedAt||now-snapshot.loadedAt>=POPULARITY_REFRESH_MS;
export function readInventoryPopularity(api,projectId,{now=Date.now(),online=globalThis.navigator?.onLine!==false}={}){
 clock(now);project(projectId);const snapshot=bucket(api).projects.get(projectId)?.snapshot;
 return {counts:snapshot?snapshotPopularityCounts(snapshot,now):null,loadedAt:snapshot?.loadedAt??null,cached:!!snapshot&&(!online||expired(snapshot,now)),needsRefresh:expired(snapshot,now)};
}
export async function refreshInventoryPopularity(api,projectId,{now=Date.now(),online=globalThis.navigator?.onLine!==false}={}){
 const initial=readInventoryPopularity(api,projectId,{now,online});
 if(!online||!initial.needsRefresh)return initial;
 const saved=bucket(api),key=saved.scope;
 let entry=saved.projects.get(projectId);if(!entry){entry={snapshot:null,pending:null};saved.projects.set(projectId,entry);}
 if(!entry.pending){
  const pending=(async()=>{
   try{
    const sales=await api.allRows('sales',projectId,'id,status,completed_at,created_at,items:sharikx2_sale_items(product_id)',{});
    if(scope(api)!==key||caches.get(api)!==saved)throw new Error('تغيّرت جلسة رواج الأصناف');
    const snapshot=popularitySnapshot(projectId,sales,now);
    entry.snapshot=snapshot;
    return readInventoryPopularity(api,projectId,{now,online});
   }catch(error){
    if(scope(api)!==key||caches.get(api)!==saved)throw error;
    return {...readInventoryPopularity(api,projectId,{now,online}),cached:!!entry.snapshot,error};
   }
  })().finally(()=>{if(entry.pending===pending)entry.pending=null;});entry.pending=pending;
 }
 return entry.pending;
}
