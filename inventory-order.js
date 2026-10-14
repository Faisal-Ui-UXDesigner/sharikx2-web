import {auditInstant} from './date-display.js';
const MAX_LONG=9223372036854775807n,MIN_LONG=-9223372036854775808n;
function nativeLong(value){
 if(typeof value==='number')return Number.isFinite(value)&&Number.isSafeInteger(Math.trunc(value))?BigInt(Math.trunc(value)):null;
 if(typeof value!=='string'||!/^[-+]?\d+$/.test(value.trim()))return null;
 const canonical=value.trim().replace(/^([-+])?0+(?=\d)/,'$1');
 if(canonical.replace(/^[-+]/,'').length>19)return null;
 const parsed=BigInt(canonical);return parsed>=MIN_LONG&&parsed<=MAX_LONG?parsed:null;
}
export function inventoryCreationOrder(row){
 const millis=nativeLong(row?.createdAtMs);
 if(millis!==null&&millis>0n)return millis;
 // Server created_at maps to native cloud creation. Legacy wall dates use the
 // project's zone instead of the viewer OS. Invalid dates retain ID fallback.
 const instant=auditInstant(row?.created_at||row?.createdAt);
 if(instant!==null)return BigInt(Math.trunc(instant));
 return nativeLong(String(row?.id??'0'))??0n;
}
export function inventoryPinOrder(value){const stamp=nativeLong(value);return stamp!==null&&stamp>0n?stamp:0n;}
export function orderInventoryRows(rows,{pinnedIds=[],timestamps={}}={}){
 const pinned=new Set(pinnedIds);
 const decorated=(Array.isArray(rows)?rows:[]).map((row,index)=>{
  const id=String(row?.id??''),isPinned=pinned.has(id);
  const own=Object.hasOwn(timestamps,id)?timestamps[id]:0;
  return {row,index,isPinned,pin:isPinned?inventoryPinOrder(own):0n,created:inventoryCreationOrder(row)};
 });
 decorated.sort((left,right)=>{
  if(left.isPinned!==right.isPinned)return left.isPinned?-1:1;
  if(left.pin!==right.pin)return left.pin>right.pin?-1:1;
  if(left.created!==right.created)return left.created>right.created?-1:1;
  return left.index-right.index;
 });
 return decorated.map(entry=>entry.row);
}
