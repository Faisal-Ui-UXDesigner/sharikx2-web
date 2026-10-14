import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryDetailsModel,inventoryPurchaseEntries} from '../inventory-details.js';
import {normalizeProduct} from '../inventory.js';
import {productEditorValues} from '../inventory-mutation.js';
const product={id:'a',project_id:'p',name:' سكر ',purchase_unit:'علبة',quantity_pieces:3,pieces_per_purchase_unit:3,weighted_unit_cost:.12345,default_sale_price:.15};
const line=(date,values={})=>({product_id:'a',quantity_pieces:.3,unit_cost:.12345,line_total:.04,purchase:{project_id:'p',purchased_at:date,supplier:{name:' مورد '}},...values});
test('details schema captures native ordered fields and precise purchase-unit prices',()=>{
 const model=inventoryDetailsModel(product,{projectId:'p'});
 assert.deepEqual(model.values.map(row=>row.label),['الباركود','الوحدة','الكمية الحالية','تكلفة الشراء الحالية','سعر البيع المتوقع','عدد مرات البيع خلال 60 يومًا']);
 assert.equal(model.values[3].value,.37035);assert.equal(model.values[3].kind,'unitCost');
 assert.equal(model.values[4].value,.45);assert.equal(model.name,'سكر');
});
test('legacy prices do not divide then multiply merely for display or editor initialization',()=>{
 const row={id:'legacy',quantity:1,piecesPerPurchaseUnit:3,purchasePrice:1.23445,expectedSalePrice:2.345};
 const normalized=normalizeProduct(row),model=inventoryDetailsModel(row);
 assert.equal(model.values[3].value,1.23445);assert.equal(model.values[4].value,2.345);
 assert.equal(productEditorValues(normalized).salePrice,2.345);assert.deepEqual(normalizeProduct(normalized),normalized);
});
test('details preserve explicit server zero prices over old legacy prices',()=>{
 const model=inventoryDetailsModel({...product,weighted_unit_cost:0,default_sale_price:0,purchasePrice:100,expectedSalePrice:200});
 assert.equal(model.values[3].value,0);assert.equal(model.values[4].value,0);
});
test('native category aliases, trimmed notes and positive low-stock purchase units are captured',()=>{
 const row={...product,category:' مواد ',notes:' تذكير ',low_stock_level:6};
 const model=inventoryDetailsModel(row,{aliases:{مواد:'تموين'}});
 assert.equal(model.category,'تموين');assert.equal(model.notes,'تذكير');
 assert.deepEqual(model.values.at(-2),{label:'تنبيه نقص البضاعة عند',kind:'quantity',value:2,unit:'علبة',tone:'primary'});
 assert.equal(inventoryDetailsModel({...product,low_stock_level:0}).values.length,6);
});
test('unavailable popularity is distinct from a verified zero count',()=>{
 assert.equal(inventoryDetailsModel(product).popularityUnavailable,true);
 for(const value of [-1,NaN,1.5,'3'])assert.equal(inventoryDetailsModel(product,{popularityCount:value}).popularityUnavailable,true);
 const model=inventoryDetailsModel(product,{popularityCount:0});
 assert.equal(model.popularityUnavailable,false);assert.equal(model.values.at(-1).value,0);
});
test('detail model is frozen, serializable and cannot freeze or mutate source objects',()=>{
 const row={...product,notes:{nested:true},unit:{nested:true}};const original=JSON.stringify(row);
 const model=inventoryDetailsModel(row);
 assert.ok(Object.isFrozen(model)&&Object.isFrozen(model.values[0]));assert.deepEqual(JSON.parse(JSON.stringify(model)),model);
 assert.equal(Object.isFrozen(row.notes),false);assert.equal(Object.isFrozen(row.unit),false);assert.equal(JSON.stringify(row),original);
});
test('details reject absent identity and explicit foreign project rows',()=>{
 for(const row of [null,[],{}, {...product,project_id:'foreign'}])assert.throws(()=>inventoryDetailsModel(row,{projectId:'p'}));
});
test('purchase entries use native stable lexical date ordering and four-decimal cost kind',()=>{
 const rows=[line('2026-10-12'),line('2026-10-13',{line_total:2}),line('2026-10-13',{line_total:3})];
 const before=JSON.stringify(rows),entries=inventoryPurchaseEntries(rows,{productId:'a',projectId:'p'});
 assert.deepEqual(entries.map(row=>row.values[2].value),[2,3,.04]);
 assert.equal(entries[0].supplierName,'مورد');assert.equal(entries[0].values[1].kind,'unitCost');
 assert.equal(entries[0].values[1].value,.12345);assert.equal(JSON.stringify(rows),before);
 assert.ok(Object.isFrozen(entries)&&Object.isFrozen(entries[0].values));
});
test('history skips native non-object and parentless rows without manufacturing invoices',()=>{
 assert.deepEqual(inventoryPurchaseEntries([null,'bad',{}, {purchase:null}, {purchase:[]}]),[]);
 assert.deepEqual(inventoryPurchaseEntries([]),[]);assert.throws(()=>inventoryPurchaseEntries({}));
});
test('history keeps server line totals rather than repricing historical quantity against current stock',()=>{
 const entry=inventoryPurchaseEntries([line('2026-10-13')])[0];
 assert.equal(entry.values[0].value,.3);assert.equal(entry.values[1].value,.12345);assert.equal(entry.values[2].value,.04);
 assert.equal(entry.values[0].unit,'قطعة');
});
test('malformed money and explicit foreign product/project history cannot become misleading data',()=>{
 for(const row of [line('day',{unit_cost:'bad'}),line('day',{line_total:Infinity}),line('day',{quantity_pieces:true}),line('day',{product_id:'other'}),line('day',{purchase:{project_id:'other'}})])assert.throws(()=>inventoryPurchaseEntries([row],{productId:'a',projectId:'p'}));
});
test('absent supplier/date/money preserve legacy empty display without changing saved values',()=>{
 const model=inventoryPurchaseEntries([{purchase:{created_at:'2026-10-13'},unit_cost:-.1,line_total:-.2}])[0];
 assert.equal(model.date,'2026-10-13');assert.equal(model.supplierName,'');
 assert.deepEqual(model.values.map(row=>row.value),[0,-.1,-.2]);
});
