import test from 'node:test';
import assert from 'node:assert/strict';
import {decimalProduct,decimalSum} from '../decimal-sum.js';
import {normalizeProduct,inventorySummary,filterProducts} from '../inventory.js';

test('decimal multiplication preserves cents, signs and scientific notation without rounding',()=>{
 assert.equal(decimalProduct(.1,.2),.02);
 assert.equal(decimalProduct(3,.1),.3);
 assert.equal(decimalProduct(-.3,.2),-.06);
 assert.equal(decimalProduct('1e-7','2e3'),.0002);
 assert.equal(Object.is(decimalProduct(-0,3),-0),false);
 assert.equal(decimalProduct(.123456,.2),.0246912);
});
test('decimal multiplication rejects noncanonical, nonfinite and overflowing results',()=>{
 for(const value of [null,undefined,true,'', ' 1 ',Infinity,NaN,'0x10','1e-1001'])assert.throws(()=>decimalProduct(value,1));
 assert.throws(()=>decimalProduct(1e308,2));
 assert.throws(()=>decimalProduct('0.'+'0'.repeat(599)+'1','0.'+'0'.repeat(599)+'1'));
});
test('legacy three-piece unit prices are valued before display-only conversion',()=>{
 const row=Object.freeze({quantity:.1,piecesPerPurchaseUnit:3,purchasePrice:.3,expectedSalePrice:.6});
 const value=normalizeProduct(row);
 assert.equal(value.pieces,.3);assert.equal(value.quantity,.1);
 assert.equal(value.purchaseValue,.03);assert.equal(value.saleValue,.06);assert.equal(value.expectedProfit,.03);
 assert.deepEqual(normalizeProduct(value),value);
});
test('server per-piece stock and equivalent native purchase units have identical valuations',()=>{
 for(let cents=0;cents<=200;cents++){
  const quantity=cents/100;
  const native=normalizeProduct({quantity,piecesPerPurchaseUnit:3,purchasePrice:.3,expectedSalePrice:.6});
  const remote=normalizeProduct({quantity_pieces:decimalProduct(quantity,3),pieces_per_purchase_unit:3,weighted_unit_cost:.1,default_sale_price:.2});
  for(const key of ['pieces','purchaseValue','saleValue','expectedProfit'])assert.equal(native[key],remote[key],`${key} at ${cents}`);
 }
});
test('server zero cost and price override stale legacy values',()=>{
 const row=normalizeProduct({quantity_pieces:3,pieces_per_purchase_unit:3,quantity:99,weighted_unit_cost:0,purchasePrice:100,default_sale_price:0,expectedSalePrice:200});
 assert.equal(row.purchaseValue,0);assert.equal(row.saleValue,0);assert.equal(row.expectedProfit,0);
});
test('native losses remain signed and zero spread produces no fractional profit',()=>{
 assert.equal(normalizeProduct({quantity_pieces:3,weighted_unit_cost:.2,default_sale_price:.1}).expectedProfit,-.3);
 assert.equal(normalizeProduct({quantity_pieces:.3,weighted_unit_cost:.1,default_sale_price:.1}).expectedProfit,0);
});
test('mixed legacy/server totals sum original fractional values without per-row currency rounding',()=>{
 const rows=Object.freeze([
  Object.freeze({quantity:1,piecesPerPurchaseUnit:3,purchasePrice:.1,expectedSalePrice:.2}),
  Object.freeze({quantity_pieces:1,weighted_unit_cost:.2,default_sale_price:.4})
 ]);
 const before=JSON.stringify(rows);
 assert.deepEqual(inventorySummary(rows),{items:2,pieces:4,purchaseValue:.3,saleValue:.6,expectedProfit:.3});
 assert.deepEqual(inventorySummary(rows.map(normalizeProduct)),inventorySummary(rows));
 assert.equal(JSON.stringify(rows),before);
});
test('summary supports large catalogs without spread argument limits or source changes',()=>{
 const row=Object.freeze({quantity_pieces:.1,weighted_unit_cost:.1,default_sale_price:.2});
 const rows=Array(150000).fill(row);
 assert.deepEqual(inventorySummary(rows),{items:150000,pieces:15000,purchaseValue:1500,saleValue:3000,expectedProfit:1500});
 assert.equal(rows[0],row);
});
test('filtering does not mutate the complete-stock summary and input order cannot alter cents',()=>{
 const rows=[{name:'A',category:'x',quantity_pieces:1,weighted_unit_cost:.1,default_sale_price:.2},{name:'B',category:'y',quantity_pieces:1,weighted_unit_cost:.2,default_sale_price:.1}];
 const before=inventorySummary(rows);
 assert.equal(filterProducts(rows,'A').length,1);
 assert.deepEqual(inventorySummary(rows),before);assert.deepEqual(inventorySummary([...rows].reverse()),before);
 assert.equal(before.expectedProfit,0);assert.equal(before.purchaseValue,.3);
});
test('empty catalogs and zero stock retain existing zero semantics',()=>{
 assert.deepEqual(inventorySummary([]),{items:0,pieces:0,purchaseValue:0,saleValue:0,expectedProfit:0});
 assert.equal(normalizeProduct({quantity:-2,purchasePrice:10,expectedSalePrice:20}).purchaseValue,0);
 assert.equal(decimalSum([decimalProduct(.1,3),-.3]),0);
});
