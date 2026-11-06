import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerPurchaseAmounts,ownerPurchaseAccounts,ownerPurchasePlan} from '../owner-purchase.js';
const projectId='project';
function fixture(){return {projectId,draft:{product_id:'p',supplier_id:'supplier',account_id:'cash',quantity:'0.125',unit_cost:'1.0050',paid:'0.10'},products:[{product:{id:'p',project_id:projectId,name:'صنف',base_unit:'كغم'},source_token:'source-original'}],suppliers:[{id:'supplier',name:'مورد'}],accounts:[{id:'cash',balance:1}]};}
test('owner purchase preserves four-place cost, three-place quantity and native payload source token',()=>{
 const f=fixture(),before=structuredClone(f);assert.deepEqual(ownerPurchaseAmounts(f.draft),{quantity:'0.125',cost:'1.0050',paid:'0.10',total:0.13,debt:0.03});
 assert.deepEqual(ownerPurchasePlan(f),{items:[{product_id:'p',quantity_pieces:'0.125',unit_cost:'1.0050',source_token:'source-original'}],payments:[{account_id:'cash',amount:'0.10'}],supplier_id:'supplier'});assert.deepEqual(f,before);
});
test('purchase preview matches native/server per-line HALF_UP including binary-sensitive halves',()=>{
 assert.equal(ownerPurchaseAmounts({...fixture().draft,quantity:'1.005',unit_cost:'1.0000',paid:0}).total,1.01);
 assert.equal(ownerPurchaseAmounts({...fixture().draft,quantity:'0.001',unit_cost:'5',paid:0}).total,0.01);
 const f=fixture();Object.assign(f.draft,{quantity:'٠٫١٢٥',unit_cost:'١٫٠٠٥٠',paid:'٠٫١٠'});assert.equal(ownerPurchasePlan(f).payments[0].amount,'0.10');
});
test('overpayment and any debt without supplier fail before creating a journal or RPC',()=>{
 const f=fixture();f.draft.paid='0.14';assert.throws(()=>ownerPurchasePlan(f),/أكبر من قيمة/);
 f.draft.paid='0.10';f.draft.supplier_id='';assert.throws(()=>ownerPurchasePlan(f),/المورد/);
 f.draft.paid='0.13';assert.equal(ownerPurchasePlan(f).supplier_id,'');
 f.draft.paid='0.12';assert.throws(()=>ownerPurchasePlan(f),/المورد/);
});
test('account availability is exact opening balance plus captured movement net, not zero or opening alone',()=>{
 const rows=[{id:'cash',project_id:projectId,opening_balance:'0.30',movement_net:'-0.10'}],before=structuredClone(rows);
 assert.equal(ownerPurchaseAccounts(rows,projectId)[0].balance,0.2);assert.deepEqual(rows,before);
 for(const row of [{id:'cash',opening_balance:1},{id:'cash',opening_balance:1,movement_net:'bad'},{...rows[0],project_id:'foreign'}])assert.throws(()=>ownerPurchaseAccounts([row],projectId));
 assert.throws(()=>ownerPurchaseAccounts([rows[0],rows[0]],projectId));
});
test('paid amount needs a current available account and cannot exceed its balance',()=>{
 const f=fixture();f.accounts[0].balance='0.09';assert.throws(()=>ownerPurchasePlan(f),/الرصيد/);
 f.accounts[0].balance='0.10';assert.equal(ownerPurchasePlan(f).payments.length,1);
 f.draft.account_id='missing';assert.throws(()=>ownerPurchasePlan(f),/الحساب/);
 f.draft.paid='0';assert.deepEqual(ownerPurchasePlan(f).payments,[]);
});
test('stale/missing/foreign product, supplier and source identities never fall back to another row',()=>{
 for(const mutate of [f=>f.draft.product_id='missing',f=>f.products[0].product.project_id='foreign',f=>f.products[0].product.active=false,f=>delete f.products[0].source_token,f=>f.draft.supplier_id='missing',f=>f.suppliers[0].project_id='foreign',f=>f.accounts[0].project_id='foreign',f=>f.products.push(f.products[0])]){
  const f=fixture();mutate(f);assert.throws(()=>ownerPurchasePlan(f));
 }
});
test('invalid precision and empty/negative fields are rejected rather than rounded or changed to zero',()=>{
 for(const [key,value] of [['quantity','0'],['quantity','0.0001'],['quantity',''],['quantity','-1'],['unit_cost','1.00001'],['unit_cost',''],['paid','0.001'],['paid','bad']]){
  const f=fixture();f.draft[key]=value;assert.throws(()=>ownerPurchasePlan(f));
 }
 // Zero cost is allowed by the new-model server; do not import the legacy >0 cost rule.
 const f=fixture();f.draft.unit_cost='0';f.draft.paid='0';assert.equal(ownerPurchasePlan(f).items[0].unit_cost,'0');
});
