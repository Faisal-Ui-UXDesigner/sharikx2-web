import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProduct,inventorySummary,filterProducts,normalizePurchaseHistory,visibleInventoryRows} from '../inventory.js';
test('inventory visible limit preserves source order and handles invalid limits',()=>{const rows=Array.from({length:25},(_,i)=>({id:String(i)}));assert.deepEqual(visibleInventoryRows(rows,20).map(x=>x.id),Array.from({length:20},(_,i)=>String(i)));assert.deepEqual(visibleInventoryRows(rows,'bad'),[]);});
import {Api} from '../api.js';
import {assertUniqueBarcode,productPayload,openProductEditor,productEditorValues,assertProductArchiveAllowed} from '../inventory-mutation.js';

test('purchase-unit legacy data and server pieces have equal valuation without changing inputs',()=>{
 const remote={quantity_pieces:12,pieces_per_purchase_unit:3,weighted_unit_cost:2,default_sale_price:4,low_stock_level:6};
 const legacy={quantity:4,piecesPerPurchaseUnit:3,purchasePrice:6,expectedSalePrice:12,lowStockLevel:2};
 const snapshot=JSON.stringify([remote,legacy]);
 for(const input of [remote,legacy]){
   const product=normalizeProduct(input);
   assert.equal(product.quantity,4);
   assert.equal(product.lowStockQuantity,2);
   assert.equal(product.purchaseValue,24);
   assert.equal(product.saleValue,48);
   assert.deepEqual(inventorySummary([product]),inventorySummary([input]));
 }
 assert.equal(JSON.stringify([remote,legacy]),snapshot);
});

test('purchase history pages use parent project scope and fail rather than truncate',async()=>{
 const api=new Api({});
 const queries=[];
 api.request=async path=>{const query=new URL('https://fixture.invalid'+path).searchParams;queries.push(query);return Number(query.get('offset'))===0?Array.from({length:20},()=>({unit_cost:2})):[];};
 assert.equal((await api.productPurchaseHistory('project','product')).length,20);
 assert.deepEqual(queries.map(query=>query.get('offset')),['0','20']);
 assert.ok(queries.every(query=>query.get('purchase.project_id')==='eq.project'&&!query.has('project_id')));
 api.request=async path=>{if(path.includes('offset=20'))throw new Error('network');return Array(20).fill({});};
 await assert.rejects(api.productPurchaseHistory('project','product'),/network/);
});

test('inventory editor payload preserves Android unit conversion and barcode uniqueness',()=>{
 const payload=productPayload('project',{name:'سكر',barcode:'100',category:'مواد',unit:'كرتونة',piecesPerUnit:'3',salePrice:'12',lowStock:'2',notes:'مهم'});
 assert.deepEqual(payload,{project_id:'project',name:'سكر',barcode:'100',category:'مواد',base_unit:'قطعة',purchase_unit:'كرتونة',pieces_per_purchase_unit:3,default_sale_price:4,low_stock_level:6,notes:'مهم'});
 assert.throws(()=>assertUniqueBarcode([{id:'a',barcode:'100'}],'100'),/باركود/);
 assert.doesNotThrow(()=>assertUniqueBarcode([{id:'a',barcode:'100'}],'100','a'));
 assert.throws(()=>productPayload('p',{name:'',barcode:'1',category:'x',unit:'قطعة',piecesPerUnit:1,salePrice:1}),/اسم/);
});

test('archiving atomically requires empty active stock and only deactivates the product',async()=>{
 const api=new Api({});
 api.request=async(path,options)=>{
  const q=new URL('https://fixture.invalid'+path).searchParams;
  assert.equal(q.get('quantity_pieces'),'eq.0');assert.equal(q.get('active'),'eq.true');
  assert.equal(q.get('id'),'eq.a/b');assert.equal(options.method,'PATCH');
  assert.deepEqual(JSON.parse(options.body),{active:false});return [{id:'a/b',active:false}];
 };
 assert.equal((await api.archiveProduct('a/b')).active,false);
 api.request=async()=>[];
 await assert.rejects(api.archiveProduct('a'),/كمية المخزون/);
});

test('product edits exclude project and stock fields and reject fractional piece factors',()=>{
 const values={name:'سكر',barcode:'100',category:'مواد',unit:'علبة',piecesPerUnit:3,salePrice:12};
 const payload=productPayload('p',values,{id:'a'});
 assert.equal('project_id' in payload,false);assert.equal('quantity_pieces' in payload,false);
 assert.throws(()=>productPayload('p',{...values,piecesPerUnit:1.5}),/عدد القطع/);
 assert.throws(()=>openProductEditor({mode:'viewer'}),/للمشاهدة/);
});

test('editor values round trip purchase units without mutating the product',()=>{
 const product=normalizeProduct({id:'a',name:'سكر',barcode:'100',category:'مواد',purchase_unit:'كرتونة',pieces_per_purchase_unit:3,default_sale_price:4,low_stock_level:6});
 const before=JSON.stringify(product);
 const values=productEditorValues(product);
 assert.equal(values.unit,'كرتونة');assert.equal(values.salePrice,12);assert.equal(values.lowStock,2);
 const payload=productPayload('p',values,{id:'a'});
 assert.equal(payload.default_sale_price,4);assert.equal(payload.low_stock_level,6);
 assert.equal(JSON.stringify(product),before);
 assert.deepEqual(productEditorValues(null),{unit:'قطعة',piecesPerUnit:1});
});

test('archive policy rejects viewers, unknown quantities and nonempty stock',()=>{
 assert.throws(()=>assertProductArchiveAllowed('viewer',{pieces:0}),/للمشاهدة/);
 assert.throws(()=>assertProductArchiveAllowed('owner',{}),/التحقق/);
 assert.throws(()=>assertProductArchiveAllowed('owner',{pieces:-1}),/التحقق/);
 assert.throws(()=>assertProductArchiveAllowed('owner',{pieces:0.001}),/تسوية/);
 assert.doesNotThrow(()=>assertProductArchiveAllowed('owner',{pieces:0}));
});

test('filters preserve row identity and source order without reading financial fields',()=>{
 const rows=[{id:'a',name:' سكر ',barcode:'001',category:' مواد '},{id:'b',name:'زيت',barcode:'002',category:'مواد'}];
 Object.defineProperty(rows[0],'quantity_pieces',{get(){throw new Error('unnecessary normalization');}});
 assert.deepEqual(filterProducts(rows,' 001 ','مواد'),[rows[0]]);
 assert.deepEqual(filterProducts(rows,'','مواد'),rows);
 assert.equal(filterProducts(rows,'سكر')[0],rows[0]);
});

test('inventory totals are independent new objects and never mutate their sources',()=>{
 const rows=[{quantity_pieces:2,weighted_unit_cost:3,default_sale_price:4}];
 Object.freeze(rows[0]);Object.freeze(rows);
 const first=inventorySummary(rows),second=inventorySummary(rows);
 assert.notEqual(first,second);
 assert.deepEqual(first,{items:1,pieces:2,purchaseValue:6,saleValue:8,expectedProfit:2});
 first.purchaseValue=100;
 assert.equal(second.purchaseValue,6);
});

test('history sorts valid dates first and preserves stable ties and missing-date order',()=>{
 const rows=[{id:'missing',purchase:{}},{id:'old',purchase:{created_at:'2026-10-01T00:00:00Z'}},{id:'invalid',purchase:{purchased_at:'invalid'}},{id:'new',purchase:{purchased_at:'2026-10-02T00:00:00Z'}},{id:'tie',purchase:{purchased_at:'2026-10-02T00:00:00Z'}}];
 const before=JSON.stringify(rows);
 assert.deepEqual(normalizePurchaseHistory(rows).map(row=>row.id),['new','tie','old','missing','invalid']);
 assert.equal(JSON.stringify(rows),before);
 assert.deepEqual(normalizePurchaseHistory(null),[]);
});
