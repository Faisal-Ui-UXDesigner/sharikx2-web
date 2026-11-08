import {categoryAliases} from './inventory-category.js';

export function ownerInventoryPreferences(api,projectId,device){
 function snapshot(result){
  const settings=result?.settings;
  if(result?.project_id!==projectId||!Number.isSafeInteger(result.revision)||result.revision<0||
     ![settings?.custom,settings?.hidden,settings?.names].every(Array.isArray)){
   throw Error('تعذر قراءة إعدادات البضاعة لهذا المشروع');
  }
  return {revision:result.revision,state:{
   inventoryCustomCategories:settings.custom,
   inventoryHiddenCategories:settings.hidden,
   inventoryCategoryNames:settings.names
  }};
 }
 return {
  async load(){return snapshot(await api.rpc('get_sharikx2_inventory_preferences_v2',{p_project:projectId}));},
  async save(settings,revision){
   const names=Object.entries(categoryAliases(settings.aliases)).map(([key,name])=>({key,name}));
   return snapshot(await api.rpc('save_sharikx2_inventory_preferences_v2',{
    p_project:projectId,p_device:device,p_revision:revision,
    p_settings:{custom:settings.customCategories,hidden:settings.hiddenCategories,names}
   }));
  }
 };
}
