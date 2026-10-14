import {display,INVENTORY_CATEGORY_PLACEHOLDER,INVENTORY_CATEGORY_OTHER} from './inventory-category.js';
export function inventoryChoiceRows(options,firstPosition,selectedPosition){
 if(!Array.isArray(options)||!Number.isInteger(firstPosition)||firstPosition<0||firstPosition>options.length)throw new Error('خيارات الصنف غير صالحة');
 return Object.freeze(options.slice(firstPosition).map((option,index)=>Object.freeze({position:firstPosition+index,key:option.key,label:option.label,selected:firstPosition+index===selectedPosition})));
}
export function inventoryCategoryChoice(categories=[],aliases={},savedCategory=''){
 const keys=[...new Set(categories.map(value=>String(value).trim()).filter(value=>value&&value!==INVENTORY_CATEGORY_PLACEHOLDER&&value!==INVENTORY_CATEGORY_OTHER))];
 const options=Object.freeze([{key:'',label:INVENTORY_CATEGORY_PLACEHOLDER},...keys.map(key=>({key,label:display(aliases,key)})),{key:INVENTORY_CATEGORY_OTHER,label:display(aliases,INVENTORY_CATEGORY_OTHER)}].map(Object.freeze));
 const saved=String(savedCategory??'').trim(),found=options.findIndex((option,index)=>index>0&&index<options.length-1&&option.key===saved);
 return Object.freeze({options,selectedPosition:found>0?found:saved?options.length-1:0,customCategory:found>0?'':saved});
}
export function changeInventoryCategoryChoice(state,action){
 if(action?.type==='select'){
  const position=action.position;
  if(!Number.isInteger(position)||position<1||position>=state.options.length)throw new Error('تصنيف الصنف غير متاح');
  return Object.freeze({...state,selectedPosition:position,customCategory:position===state.options.length-1?state.customCategory:''});
 }
 if(action?.type==='custom'&&typeof action.value==='string'&&state.selectedPosition===state.options.length-1)return Object.freeze({...state,customCategory:action.value});
 throw new Error('اختيار تصنيف غير صالح');
}
export function selectedInventoryCategory(state){
 if(state.selectedPosition<=0)throw new Error('اختر تصنيف الصنف');
 const value=state.selectedPosition===state.options.length-1?state.customCategory.trim():state.options[state.selectedPosition].key;
 if(!value)throw new Error('اكتب تصنيف الصنف');return value;
}
