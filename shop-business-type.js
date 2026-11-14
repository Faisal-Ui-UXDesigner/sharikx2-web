/** Android ShopBusinessType: device-local presentation choices, never financial data. */
export const SHOP_BUSINESS_TYPES=Object.freeze([
 {id:'grocery',label:'دكانة',suggestions:['الألبان والثلاجة','البقوليات والحبوب','المعلبات والزيوت','المشروبات والضيافة','التسالي والحلويات','البهارات والعطارة','المنظفات والورقيات','العناية الشخصية']},
 {id:'pharmacy',label:'صيدلية',suggestions:['أدوية','فيتامينات ومكمّلات','عناية بالبشرة','عناية بالشعر','عناية بالفم والأسنان','أم وطفل','إسعافات أولية','أجهزة ومستلزمات طبية']},
 {id:'bookshop',label:'مكتبة',suggestions:['كتب','دفاتر وورق','أقلام وأدوات كتابة','أدوات مدرسية','أدوات مكتبية','رسم وأشغال يدوية','قرطاسية وهدايا']},
 {id:'other',label:'أخرى',suggestions:[]}
].map(type=>Object.freeze({...type,suggestions:Object.freeze(type.suggestions)})));
export const businessType=id=>SHOP_BUSINESS_TYPES.find(type=>type.id===id)||null;
export function browserPreferenceStorage(){try{return globalThis.localStorage||null;}catch{return null;}}
export function readBusinessType(projectId,storage){try{return businessType(storage?.getItem(`shopBusinessType:${projectId}`));}catch{return null;}}
export function saveBusinessType(projectId,id,storage){
 if(typeof projectId!=='string'||!projectId.trim()||!businessType(id))throw Error('نوع النشاط غير صالح');
 if(!storage)throw Error('تعذر حفظ نوع النشاط على هذا الجهاز');
 try{const key=`shopBusinessType:${projectId}`;storage.setItem(key,id);if(storage.getItem(key)!==id)throw Error('Not persisted');}catch{throw Error('تعذر حفظ نوع النشاط على هذا الجهاز');}
 return businessType(id);
}
/** InventoryCategoryRules.itemOptions: actual assignments first; suggestions never seed list filters. */
export function businessCategoryOptions({type=null,products=[],saved=[],hidden=[],current=''}={}){
 const candidates=[],seen=new Set(),key=value=>String(value??'').trim().toLocaleLowerCase('ar');
 for(const raw of [...products.map(row=>(row?.product||row)?.category),...saved,current,...(type?.suggestions||[])]){
  const value=String(raw??'').trim(),normalized=key(value);
  if(!normalized||['الكل','أخرى','اختر التصنيف','بدون تصنيف','+ إضافة تصنيف جديد','null'].includes(normalized)||seen.has(normalized))continue;
  seen.add(normalized);if(hidden.some(name=>key(name)===normalized)&&normalized!==key(current))continue;candidates.push(value);
 }
 return Object.freeze(candidates);
}
