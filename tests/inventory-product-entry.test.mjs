import test from 'node:test';import assert from 'node:assert/strict';
import {inventoryProductEntry,inventoryUnitChoice,changeInventoryUnitChoice,selectedInventoryUnit,entryBarcode,INVENTORY_UNITS,CUSTOM_INVENTORY_UNIT} from '../inventory-product-entry.js';
import {productPayload} from '../inventory-mutation.js';
import {inventoryProductForm} from '../inventory-product-form.js';
test('manual native entry permits an optional editable barcode and one piece per chosen unit',()=>{
 assert.deepEqual(inventoryProductEntry(),{kind:'manual',barcode:'',barcodeEditable:true,barcodeOptional:true,piecesPerUnit:1});
});
test('scan entry captures trimmed barcode and locks editing',()=>{
 const entry=inventoryProductEntry({entryMode:'scan',barcode:' 00123 '});assert.equal(entry.barcode,'00123');assert.equal(entry.barcodeEditable,false);assert.equal(entryBarcode(entry,'tampered','MANUAL-1'),'00123');
});
test('editing preserves original barcode and fractional unit conversion without mutating source',()=>{
 const product={id:'a',barcode:'001',piecesPerUnit:1.5},before=JSON.stringify(product),entry=inventoryProductEntry({product});assert.equal(entry.piecesPerUnit,1.5);assert.equal(entryBarcode(entry,'changed','MANUAL-1'),'001');assert.equal(JSON.stringify(product),before);
});
test('manual fallback is explicit stable and retains actual entered barcodes',()=>{
 const entry=inventoryProductEntry();assert.equal(entryBarcode(entry,' ','MANUAL-123'),'MANUAL-123');assert.equal(entryBarcode(entry,' 009 ','MANUAL-123'),'009');assert.throws(()=>entryBarcode(entry,'','random'));
});
test('invalid entry modes empty scan and invalid conversions fail before creating a form',()=>{
 for(const options of [{entryMode:'bad'},{entryMode:'scan'},{product:{piecesPerUnit:NaN}},{product:{piecesPerUnit:.5}},{product:{piecesPerUnit:Infinity}}])assert.throws(()=>inventoryProductEntry(options));
});
test('native unit options are frozen and custom legacy units map to other without renaming',()=>{
 assert.ok(Object.isFrozen(INVENTORY_UNITS));assert.equal(INVENTORY_UNITS.length,11);assert.equal(inventoryUnitChoice('كغم').selected,'كغم');assert.deepEqual(inventoryUnitChoice('علبة'),{selected:CUSTOM_INVENTORY_UNIT,customUnit:'علبة'});
 const original=inventoryUnitChoice('علبة'),standard=changeInventoryUnitChoice(original,{type:'select',value:'كغم'}),custom=changeInventoryUnitChoice(standard,{type:'select',value:CUSTOM_INVENTORY_UNIT});
 assert.equal(selectedInventoryUnit(custom),'علبة');assert.ok(Object.isFrozen(custom));assert.equal(original.selected,CUSTOM_INVENTORY_UNIT);assert.throws(()=>changeInventoryUnitChoice(original,{type:'select',value:'bad'}));
 assert.throws(()=>selectedInventoryUnit(inventoryUnitChoice('')));assert.equal(selectedInventoryUnit(changeInventoryUnitChoice(original,{type:'custom',value:' وحدة '})),'وحدة');
});
test('entry and unit models are frozen serializable objects',()=>{
 for(const model of [inventoryProductEntry(),inventoryUnitChoice('قطعة')]){assert.ok(Object.isFrozen(model));assert.deepEqual(JSON.parse(JSON.stringify(model)),model);}
 const markup=inventoryProductForm({categoryOptions:['<svg>'],categoryLabels:{'<svg>':'<img>'}});
 assert.ok(!markup.includes('<svg>')&&!markup.includes('<img>'));assert.match(markup,/data-choose-category/);assert.match(markup,/name="piecesPerUnit" type="hidden"/);
 assert.ok(markup.indexOf('name="barcode"')<markup.indexOf('name="name"'));assert.match(inventoryProductForm({editing:true}),/تعديل بيانات الصنف/);
});
test('payload preserves fractional native unit equations and excludes stock and project edits',()=>{
 const payload=productPayload('p',{name:'سكر',barcode:'a',category:'مواد',unit:'كغم',piecesPerUnit:1.5,salePrice:3,lowStock:.1},{id:'a'});
 assert.equal(payload.default_sale_price,2);assert.equal(payload.low_stock_level,.15);assert.equal(payload.pieces_per_purchase_unit,1.5);assert.equal('quantity_pieces' in payload,false);assert.equal('project_id' in payload,false);
});
test('overflow or underflow in converted product prices/low stock fails rather than sending invalid money',()=>{
 const values={name:'سكر',barcode:'a',category:'مواد',unit:'قطعة',piecesPerUnit:2,salePrice:1,lowStock:1};
 assert.throws(()=>productPayload('p',{...values,lowStock:Number.MAX_VALUE}));assert.throws(()=>productPayload('p',{...values,salePrice:Number.MIN_VALUE,piecesPerUnit:Number.MAX_VALUE}));
});
