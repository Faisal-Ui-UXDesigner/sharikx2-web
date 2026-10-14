import {openBarcodeScanner,normalizeBarcode} from './barcode-scanner.js';
import {decimalProduct} from './decimal-sum.js';
import {inventoryProductEntry,entryBarcode,inventoryUnitChoice,changeInventoryUnitChoice,selectedInventoryUnit,CUSTOM_INVENTORY_UNIT,INVENTORY_UNITS} from './inventory-product-entry.js';
import {inventoryProductForm} from './inventory-product-form.js';
import {inventoryCategoryChoice,changeInventoryCategoryChoice,selectedInventoryCategory,inventoryChoiceRows} from './inventory-choice.js';
import {openInventoryChoice} from './inventory-choice-ui.js';
const editors=new WeakMap();
export function productPayload(projectId,values,{id=null}={}){
 const name=String(values.name||'').trim(),barcode=String(values.barcode||'').trim(),category=String(values.category||'').trim(),unit=String(values.unit||'').trim();
 const pieces=Number(values.piecesPerUnit),sale=Number(values.salePrice),low=Number(values.lowStock||0);
 if(!name)throw new Error('أدخل اسم الصنف');
 if(!barcode)throw new Error('أدخل باركود الصنف');
 if(!category)throw new Error('أدخل تصنيف الصنف');
 if(!unit)throw new Error('أدخل وحدة الصنف');
 if(!Number.isFinite(pieces)||pieces<1)throw new Error('عدد القطع داخل الوحدة غير صحيح');
 if(!Number.isFinite(sale)||sale<=0)throw new Error('أدخل سعر البيع المتوقع');
 if(!Number.isFinite(low)||low<0)throw new Error('حد التنبيه غير صحيح');
 const pieceSalePrice=sale/pieces;if(!Number.isFinite(pieceSalePrice)||pieceSalePrice<=0)throw new Error('سعر البيع المحوّل غير صالح');
 const payload={name,barcode,category,base_unit:'قطعة',purchase_unit:unit,pieces_per_purchase_unit:pieces,default_sale_price:pieceSalePrice,low_stock_level:decimalProduct(low,pieces),notes:String(values.notes||'').trim()};
 if(!id)payload.project_id=projectId;
 return payload;
}
export function assertUniqueBarcode(rows,barcode,currentId=''){
 const normalized=String(barcode||'').trim();
 if(rows.some(row=>String(row.barcode||'').trim()===normalized&&String(row.id)!==String(currentId)))throw new Error('هذا الباركود مسجل لصنف آخر');
}
export function assertProductArchiveAllowed(mode,product){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 const pieces=Number(product?.pieces);
 if(!Number.isFinite(pieces)||pieces<0)throw new Error('تعذر التحقق من كمية المخزون');
 if(pieces>0)throw new Error('لا يمكن حذف صنف له كمية في المخزون؛ يجب تسوية الكمية أولاً');
}

export function productEditorValues(product){
 if(!product)return {unit:'قطعة',piecesPerUnit:1};
 return {
  name:product.name,barcode:product.barcode,category:product.category,
  unit:product.displayUnit,piecesPerUnit:product.piecesPerUnit,
  salePrice:product.saleUnitPrice??Number(product.salePrice)*Number(product.piecesPerUnit||1),
  lowStock:Number(product.lowStockQuantity||0),notes:product.notes
 };
}

export function openProductEditor({api,projectId,mode,product=null,rows=[],onSaved,isCurrent=()=>true,categoryOptions=[],categoryLabels={},container=null,entryMode='manual',initialBarcode='',authorizeCreate=()=>true}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 container??=document.body;
 if(!isCurrent()||!container.isConnected)return null;
 const existing=editors.get(container);if(existing?.isConnected){existing.focus();return existing;}
 const entry=inventoryProductEntry({product,entryMode,barcode:initialBarcode});
 const d=document.createElement('dialog');d.className='inventory-editor';
 d.innerHTML=inventoryProductForm({editing:!!product});
 container.append(d);editors.set(container,d);d.showModal();
 const f=d.querySelector('form'),error=f.querySelector('[role=alert]'),button=f.querySelector('button.primary');
 const current=()=>d.isConnected&&container.isConnected&&isCurrent();
 d.querySelector('[data-camera-scan]').hidden=!entry.barcodeEditable;
 d.querySelector('[data-camera-scan]').onclick=()=>{if(current()&&!saving)openBarcodeScanner({container:d,isCurrent:()=>current()&&!saving,onDetected:value=>{if(current()&&!saving)f.elements.barcode.value=normalizeBarcode(value);}});};
 const normalized=productEditorValues(product);
 for(const key of ['name','barcode','category','unit','piecesPerUnit','salePrice','lowStock','notes'])if(normalized[key]!=null)f.elements[key].value=normalized[key];
 f.elements.barcode.value=entry.barcode;f.elements.barcode.readOnly=!entry.barcodeEditable;f.elements.barcode.required=!entry.barcodeOptional;
 f.elements.barcode.placeholder=entry.barcodeOptional?'رقم الباركود (اختياري)':'رقم الباركود';
 f.elements.piecesPerUnit.value=entry.piecesPerUnit;
 let unit=inventoryUnitChoice(normalized.unit);const unitSelect=f.elements.unitChoice;
 const showUnit=()=>{unitSelect.value=unit.selected;f.elements.unit.hidden=unit.selected!==CUSTOM_INVENTORY_UNIT;f.elements.unit.value=unit.selected===CUSTOM_INVENTORY_UNIT?unit.customUnit:unit.selected;d.querySelector('[data-choose-unit]').textContent=unit.selected===CUSTOM_INVENTORY_UNIT?'أخرى':unit.selected;};
 f.elements.unit.oninput=()=>{if(current()&&!saving&&!activePicker?.isConnected&&unit.selected===CUSTOM_INVENTORY_UNIT)unit=changeInventoryUnitChoice(unit,{type:'custom',value:f.elements.unit.value});};showUnit();
 let category=inventoryCategoryChoice(categoryOptions,categoryLabels,normalized.category||'');
 const showCategory=()=>{const custom=category.selectedPosition===category.options.length-1;f.elements.customCategory.hidden=!custom;f.elements.customCategory.value=category.customCategory;f.elements.category.value=category.options[category.selectedPosition].key;const trigger=d.querySelector('[data-choose-category]');trigger.textContent=category.options[category.selectedPosition].label;trigger.classList.toggle('muted',category.selectedPosition===0);};
 f.elements.customCategory.oninput=()=>{if(current()&&!saving&&!activePicker?.isConnected&&category.selectedPosition===category.options.length-1)category=changeInventoryCategoryChoice(category,{type:'custom',value:f.elements.customCategory.value});};showCategory();
 let activePicker=null;
 const choose=(trigger,title,options,firstPosition,selectedPosition,onSelect)=>{
  if(!current()||saving||activePicker?.isConnected)return;
  trigger.setAttribute('aria-expanded','true');
  const controls=[f.querySelector('fieldset'),button,d.querySelector('[data-close]')],disabled=controls.map(control=>control.disabled);controls.forEach(control=>control.disabled=true);
  activePicker=openInventoryChoice({container:d,title,rows:inventoryChoiceRows(options,firstPosition,selectedPosition),isCurrent:current,onSelect,onClose:()=>{activePicker=null;if(current()){trigger.setAttribute('aria-expanded','false');controls.forEach((control,index)=>control.disabled=disabled[index]);trigger.focus();}}});
 };
 d.querySelector('[data-choose-category]').onclick=()=>choose(d.querySelector('[data-choose-category]'),'اختر التصنيف',category.options,1,category.selectedPosition,position=>{category=changeInventoryCategoryChoice(category,{type:'select',position});showCategory();});
 const unitOptions=[...INVENTORY_UNITS.map(key=>({key,label:key})),{key:CUSTOM_INVENTORY_UNIT,label:'أخرى'}];
 d.querySelector('[data-choose-unit]').onclick=()=>choose(d.querySelector('[data-choose-unit]'),'اختر الوحدة',unitOptions,0,unitOptions.findIndex(option=>option.key===unit.selected),position=>{unit=changeInventoryUnitChoice(unit,{type:'select',value:unitOptions[position].key});showUnit();});
 if(Number(normalized.lowStock||0)===0)f.elements.lowStock.value='';
 let saving=false;
 const creationId=product?null:crypto.randomUUID();
 const manualFallback='MANUAL-'+Date.now();
 const close=()=>{if(!saving&&!activePicker?.isConnected)d.remove();};
 d.querySelector('[data-close]').onclick=close;
 d.addEventListener('cancel',event=>{event.preventDefault();close();});
 f.onsubmit=async event=>{
  event.preventDefault();
  if(saving||activePicker?.isConnected||!current())return;
  error.textContent='';
  try{
   const values=Object.fromEntries(new FormData(f));
   values.barcode=entryBarcode(entry,values.barcode,manualFallback);values.piecesPerUnit=entry.piecesPerUnit;
   values.category=selectedInventoryCategory(category);
   values.unit=selectedInventoryUnit(unit);
   assertUniqueBarcode(rows,values.barcode,product?.id);
   const payload=productPayload(projectId,values,{id:product?.id});
   if(!product&&!authorizeCreate())return;
   saving=true;
   f.querySelector('fieldset').disabled=true;
   button.disabled=true;d.querySelector('[data-close]').disabled=true;
   if(product)await api.updateProduct(product.id,payload);
   else await api.createProduct({...payload,id:creationId});
  }catch(e){
   if(current())error.textContent=e.message||'تعذر حفظ الصنف';
   return;
  }finally{
   saving=false;
   f.querySelector('fieldset').disabled=false;
   button.disabled=false;
   d.querySelector('[data-close]').disabled=false;
  }
  const notify=current();close();
  if(notify)onSaved?.();
 };
 return d;
}
