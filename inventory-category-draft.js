import {categorySettingsState,categorySet,ordered,display,isHidden,rename,remember,setHidden,validateCategoryName} from './inventory-category.js';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export function categoryDraft(snapshot,inventoryCategories=[]){
 return freeze({settings:categorySettingsState(snapshot),inventoryCategories:[...inventoryCategories].map(value=>String(value)),newest:''});
}
export function categoryDraftRows(draft){
 const keys=categorySet({...draft.settings,inventoryCategories:draft.inventoryCategories});
 return freeze(ordered(keys,draft.settings.aliases,draft.newest).map(key=>({key,label:display(draft.settings.aliases,key),visible:!isHidden(draft.settings.hiddenCategories,key)})));
}
export function changeCategoryDraft(draft,action){
 const keys=categoryDraftRows(draft).map(row=>row.key),settings=draft.settings;
 if(action.type==='add'){
  const error=validateCategoryName(action.name,{aliases:settings.aliases,keys});if(error)throw new Error(error);
  const name=String(action.name).trim();
  return freeze({...draft,newest:name,settings:{...settings,customCategories:remember(settings.customCategories,name),hiddenCategories:setHidden(settings.hiddenCategories,name,false)}});
 }
 if(!keys.includes(action.key))throw new Error('التصنيف غير متاح');
 if(action.type==='rename'){
  const error=validateCategoryName(action.name,{aliases:settings.aliases,keys,excludedKey:action.key});if(error)throw new Error(error);
  return freeze({...draft,settings:{...settings,aliases:rename(settings.aliases,action.key,action.name)}});
 }
 if(action.type==='visibility')return freeze({...draft,settings:{...settings,hiddenCategories:setHidden(settings.hiddenCategories,action.key,!action.visible)}});
 throw new Error('تعديل التصنيف غير صالح');
}
