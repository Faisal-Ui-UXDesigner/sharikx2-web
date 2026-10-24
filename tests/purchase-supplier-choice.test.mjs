import test from 'node:test';
import assert from 'node:assert/strict';
import {createPurchaseSupplierChoices} from '../purchase-supplier-choice.js';
import {openPurchaseSupplierChoice} from '../purchase-supplier-choice-ui.js';

test('supplier selection retains frozen source-order identity separately from financial data',()=>{
 const source=[{id:'b',name:'ثاني',balance:99},{id:'a',name:'أول',phone:'0591111111'}],before=JSON.stringify(source),catalog=createPurchaseSupplierChoices(source,'pr');
 assert.deepEqual(catalog.rows,[{id:'b',index:0,name:'ثاني'},{id:'a',index:1,name:'أول'}]);assert.ok(Object.isFrozen(catalog));assert.ok(Object.isFrozen(catalog.rows));assert.ok(Object.isFrozen(catalog.get('b')));assert.equal(JSON.stringify(source),before);
 source[0].name='changed';source[0].id='changed';assert.equal(catalog.get('b').name,'ثاني');assert.equal(catalog.get('changed'),undefined);
});
test('duplicate names do not replace distinct supplier identities and unknown IDs stay unknown',()=>{
 const catalog=createPurchaseSupplierChoices([{id:'a',name:'مورد'},{id:'b',name:'مورد'}],'pr');assert.equal(catalog.rows.length,2);assert.equal(catalog.get('b').index,1);assert.equal(catalog.get('missing'),undefined);
});
test('supplier catalog rejects duplicate inactive foreign or malformed identities',()=>{
 for(const rows of [null,[null],[{name:'مورد'}],[{id:''}],[{id:'a'},{id:'a'}],[{id:'a',active:false}],[{id:'a',project_id:'other'}]])assert.throws(()=>createPurchaseSupplierChoices(rows,'pr'));
 assert.throws(()=>createPurchaseSupplierChoices([],''));assert.deepEqual(createPurchaseSupplierChoices([],'pr').rows,[]);
});
test('captured names remain literal data and missing display names have the native fallback',()=>{
 const catalog=createPurchaseSupplierChoices([{id:'a"<>',name:'<img src=x>'},{id:'b'}],'pr');assert.equal(catalog.get('a"<>').name,'<img src=x>');assert.equal(catalog.get('b').name,'مورد');
});
test('viewer and disconnected-owner guards precede DOM or supplier catalog access',()=>{
 assert.throws(()=>openPurchaseSupplierChoice({mode:'viewer'}),/للمشاهدة/);assert.equal(openPurchaseSupplierChoice({mode:'owner',owner:null}),undefined);
});
