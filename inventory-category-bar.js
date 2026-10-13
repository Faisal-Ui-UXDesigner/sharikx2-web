import {ordered,display,INVENTORY_CATEGORY_OTHER} from './inventory-category.js';
export function inventoryCategoryBarModel(categories=[],aliases={},selected='الكل'){
 const keys=['الكل',...ordered(categories.filter(key=>!['الكل',INVENTORY_CATEGORY_OTHER].includes(key)),aliases),INVENTORY_CATEGORY_OTHER];
 const current=keys.includes(selected)?selected:'الكل';
 return Object.freeze({selected:current,tabs:Object.freeze(keys.map(key=>Object.freeze({key,label:display(aliases,key),selected:key===current})))});
}
