export const INVENTORY_CATEGORY_PLACEHOLDER='اختر التصنيف';
export const INVENTORY_CATEGORY_OTHER='أخرى';
export const INVENTORY_CATEGORY_DEFAULTS=['أجبان','ألبان','بسكويت','بهارات','حبوب وبقوليات','زيوت','شوكولاتة','شيبس','مشروبات','معلبات','مكسرات','منظفات'];
const text=value=>String(value??'').trim();
const key=value=>text(value).toLocaleLowerCase('ar');
const list=value=>Array.isArray(value)?value.map(text).filter(Boolean):[];
const unique=value=>{const seen=new Set();return list(value).filter(item=>{const k=key(item);if(seen.has(k))return false;seen.add(k);return true;});};
const collator=new Intl.Collator('ar',{sensitivity:'base',numeric:true});
export function contains(values,value){const target=key(value);return !!target&&list(values).some(item=>key(item)===target);}
export function isHidden(hidden,value){return contains(hidden,value);}
export function setHidden(hidden,category,hiddenValue=true){const result=unique(hidden),name=text(category);if(!name)return result;const index=result.findIndex(item=>key(item)===key(name));if(hiddenValue&&index<0)result.push(name);if(!hiddenValue&&index>=0)result.splice(index,1);return result;}
export function remember(saved,category){const name=text(category);if(!name||[INVENTORY_CATEGORY_PLACEHOLDER,INVENTORY_CATEGORY_OTHER].some(item=>key(item)===key(name)))return unique(saved);return contains(saved,name)?unique(saved):[...unique(saved),name];}
export function categorySet({customCategories=[],inventoryCategories=[],defaults=INVENTORY_CATEGORY_DEFAULTS}={}){return unique([...defaults,...customCategories,...inventoryCategories]);}
export function categories(options={}){return [...categorySet(options),INVENTORY_CATEGORY_OTHER].filter((item,index,array)=>array.findIndex(x=>key(x)===key(item))===index);}
export function visibleCategories(options={}){const hidden=options.hiddenCategories||options.hidden||[];return categories(options).filter(item=>!isHidden(hidden,item)||key(item)===key(options.requiredCategory));}
export function categoryOptions(options={}){return [INVENTORY_CATEGORY_PLACEHOLDER,...visibleCategories(options)];}
export function display(aliases,keyValue){const target=key(keyValue);const pair=Object.entries(aliases||{}).find(([name])=>key(name)===target);return pair?text(pair[1])||text(keyValue):text(keyValue);}
export function rename(aliases,keyValue,name){const result={...(aliases||{})};const target=key(keyValue);for(const old of Object.keys(result))if(key(old)===target)delete result[old];const next=text(name),original=text(keyValue);if(next&&key(next)!==target)result[original]=next;return result;}
export function ordered(keys,aliases={},newestKey=''){const values=unique(keys).sort((a,b)=>collator.compare(display(aliases,a),display(aliases,b)));const newest=key(newestKey);if(newest){const index=values.findIndex(item=>key(item)===newest);if(index>0)values.unshift(values.splice(index,1)[0]);}return values;}
export function isReserved(value){return ['الكل',INVENTORY_CATEGORY_OTHER,INVENTORY_CATEGORY_PLACEHOLDER].some(item=>key(item)===key(value));}
export function nameExists(aliases,keys,excludedKey,name){const target=key(name),excluded=key(excludedKey);if(!target)return false;return list(keys).some(value=>key(value)!==excluded&&(key(value)===target||key(display(aliases,value))===target));}
export function validateCategoryName(name,{aliases={},keys=[],excludedKey='',maxLength=60}={}){const value=text(name);if(!value)return 'أدخل اسم التصنيف';if(value.length>maxLength)return `اسم التصنيف طويل (الحد ${maxLength} حرفاً)`;if(isReserved(value))return 'هذا الاسم محجوز';if(nameExists(aliases,keys,excludedKey,value))return 'يوجد تصنيف بهذا الاسم';return '';}
export function categoryAliases(source){
 const aliases=Object.create(null);
 const entries=Array.isArray(source)?source.map(row=>[row?.key,row?.name]):Object.entries(source||{});
 for(const [rawKey,rawName] of entries){const name=text(rawName),category=text(rawKey);if(category&&name&&!Object.keys(aliases).some(existing=>key(existing)===key(category)))aliases[category]=name;}
 return {...aliases};
}
export function categorySettingsState(snapshot){const state=snapshot?.state;if(!state||typeof state!=='object'||Array.isArray(state))throw new Error('تعذر قراءة إعدادات التصنيفات');return {customCategories:unique(state.inventoryCustomCategories),hiddenCategories:unique(state.inventoryHiddenCategories),aliases:categoryAliases(state.inventoryCategoryNames)};}
export async function saveCategorySettings(api,projectId,settings){const snapshot=await api.financeState(projectId),state=snapshot?.state;if(!state||typeof state!=='object'||Array.isArray(state))throw new Error('تعذر قراءة إعدادات التصنيفات');const next={...state,inventoryCustomCategories:unique(settings.customCategories),inventoryHiddenCategories:unique(settings.hiddenCategories),inventoryCategoryNames:Object.entries(categoryAliases(settings.aliases)).map(([key,name])=>({key,name}))};const saved=await api.saveFinanceState(projectId,next,Number(snapshot.revision)||0);return {state:next,revision:saved?.revision};}
