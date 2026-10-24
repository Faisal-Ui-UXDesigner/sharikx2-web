export const INVENTORY_UNITS=Object.freeze(['قطعة','كرتونة','صندوق','كيس','عبوة','باكيت','كغم','غرام','لتر','مل','متر']);
export const CUSTOM_INVENTORY_UNIT='__OTHER__';
export function inventoryUnitChoice(value='قطعة'){
 const unit=String(value).trim();
 return Object.freeze({selected:INVENTORY_UNITS.includes(unit)?unit:CUSTOM_INVENTORY_UNIT,customUnit:INVENTORY_UNITS.includes(unit)?'':unit});
}
export function changeInventoryUnitChoice(state,action){
 if(action?.type==='select'&&(action.value===CUSTOM_INVENTORY_UNIT||INVENTORY_UNITS.includes(action.value)))return Object.freeze({...state,selected:action.value});
 if(action?.type==='custom'&&state.selected===CUSTOM_INVENTORY_UNIT&&typeof action.value==='string')return Object.freeze({...state,customUnit:action.value});
 throw new Error('اختيار وحدة غير صالح');
}
export function selectedInventoryUnit(state){
 const value=state.selected===CUSTOM_INVENTORY_UNIT?state.customUnit.trim():state.selected;
 if(!value)throw new Error('ادخل وحدة الصنف');return value;
}
export function inventoryProductEntry({product=null,entryMode='manual',barcode=''}={}){
 const kind=product?'edit':entryMode;
 if(!['edit','manual','scan'].includes(kind))throw new Error('طريقة إضافة الصنف غير صالحة');
 const value=String(product?product.barcode??'':barcode).trim();
 if(kind==='scan'&&!value)throw new Error('لم تتم قراءة باركود الصنف');
 const factor=product?Number(product.piecesPerUnit??product.pieces_per_purchase_unit??product.piecesPerPurchaseUnit??1):1;
 if(!Number.isFinite(factor)||factor<1)throw new Error('معامل تحويل الوحدة غير صالح');
 return Object.freeze({kind,barcode:value,barcodeEditable:kind==='manual',barcodeOptional:kind==='manual',piecesPerUnit:factor});
}
export function entryBarcode(entry,value,manualFallback){
 if(!entry.barcodeEditable)return entry.barcode;
 const entered=String(value??'').trim();if(entered)return entered;
 if(typeof manualFallback!=='string'||!/^MANUAL-\d+$/.test(manualFallback))throw new Error('تعذر توليد باركود الصنف اليدوي');
 return manualFallback;
}
