// Ephemeral screen preferences only. Never stock, finance, credentials or storage.
import {INVENTORY_PAGE_SIZE} from './inventory.js';
export {INVENTORY_PAGE_SIZE};
export function createInventoryViewState(){
 return Object.freeze({tab:'current',query:'',category:'الكل',visibleLimit:INVENTORY_PAGE_SIZE,categoryScroll:0});
}
export function changeInventoryViewState(state,action){
 switch(action?.type){
  case 'tab':
   if(!['current','history'].includes(action.value))throw new Error('تبويب البضاعة غير صالح');
   return state.tab===action.value?state:Object.freeze({...state,tab:action.value});
  case 'query':{
   if(typeof action.value!=='string')throw new Error('بحث البضاعة غير صالح');
   return state.query===action.value?state:Object.freeze({...state,query:action.value,visibleLimit:INVENTORY_PAGE_SIZE});
  }
  case 'category':case 'restore-category':{
   if(typeof action.value!=='string'||!action.value.trim())throw new Error('تصنيف البضاعة غير صالح');
   return state.category===action.value?state:Object.freeze({...state,category:action.value,visibleLimit:action.type==='category'?INVENTORY_PAGE_SIZE:state.visibleLimit});
  }
  case 'more':return Object.freeze({...state,visibleLimit:Math.min(Number.MAX_SAFE_INTEGER,state.visibleLimit+INVENTORY_PAGE_SIZE)});
  case 'scroll':
   if(typeof action.value!=='number'||!Number.isFinite(action.value))throw new Error('موضع التصنيفات غير صالح');
   return state.categoryScroll===action.value?state:Object.freeze({...state,categoryScroll:action.value});
  default:throw new Error('إجراء البضاعة غير صالح');
 }
}
export function createInventoryViewStore(){
 let scope=null,handle=null;
 return Object.freeze({forScope(projectId,mode){
  const next=JSON.stringify([String(projectId),mode]);
  if(next!==scope){
   scope=next;let state=createInventoryViewState();
   const bound=Object.freeze({getState:()=>state,dispatch:action=>{
    if(handle!==bound)return state; // Returning to an old scope never revives its handle.
    state=changeInventoryViewState(state,action);return state;
   }});
   handle=bound;
  }
  return handle;
 }});
}
