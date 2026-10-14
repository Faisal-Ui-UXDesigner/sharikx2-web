import test from 'node:test';import assert from 'node:assert/strict';
import {createCustomerCatalog,loadCustomerCatalog} from '../customer-catalog.js';
const rows=Array.from({length:45},(_,i)=>({id:`c${i}`,project_id:'project',active:true,name:`زبون ${i}`,phone:`059${String(i).padStart(7,'0')}`}));
test('customer catalog indexes immutable identities and searches all names and leading-zero phones',()=>{
 const catalog=createCustomerCatalog(rows,'project');rows[44].name='متغير';assert.equal(catalog.get('c44').name,'زبون 44');rows[44].name='زبون 44';
 assert.equal(catalog.search(' 0590000044 ')[0].id,'c44');assert.equal(catalog.search('زبون 44')[0].id,'c44');assert.equal(catalog.search('').length,45);assert.equal(Object.isFrozen(catalog.customers),true);
});
test('customer catalog rejects repeated identity, inactive or foreign rows but retains invalid legacy debt details for display',()=>{
 for(const source of [null,[rows[0],rows[0]],[{...rows[0],active:false}],[{...rows[0],project_id:'other'}],[{name:'no id'}]])assert.throws(()=>createCustomerCatalog(source,'project'));
 const catalog=createCustomerCatalog([{id:'legacy',name:'أ',phone:'123'}],'project');assert.equal(catalog.get('legacy').phone,'123');
});
test('customer loading reads all pages with active/project scoping and stable offsets',async()=>{
 const calls=[],catalog=await loadCustomerCatalog({rows:async(...args)=>{calls.push(args);return rows.slice(args[3],args[3]+20);}},'project');
 assert.equal(catalog.customers.length,45);assert.deepEqual(calls.map(args=>args[3]),[0,20,40]);assert.ok(calls.every(args=>args[0]==='customers'&&args[1]==='project'&&args[4].active==='eq.true'));
});
test('customer loading rejects a failed middle page and retries from the beginning, never returning partial rows',async()=>{
 let fail=true;const offsets=[],api={rows:async(table,project,select,offset)=>{offsets.push(offset);if(offset===20&&fail)throw Error('network');return rows.slice(offset,offset+20);}};
 await assert.rejects(loadCustomerCatalog(api,'project'),/network/);fail=false;assert.equal((await loadCustomerCatalog(api,'project')).customers.length,45);assert.deepEqual(offsets,[0,20,0,20,40]);
});
test('customer pagination rejects repeated pages, missing identities and stale reads',async()=>{
 await assert.rejects(loadCustomerCatalog({rows:async()=>rows.slice(0,20)},'project'),/ترتيب/);
 await assert.rejects(loadCustomerCatalog({rows:async()=>[{name:'bad'}]},'project'),/متطابقة/);
 let current=true,calls=0;await assert.rejects(loadCustomerCatalog({rows:async()=>{calls++;current=false;return rows.slice(0,20);}},'project',()=>current),/CLOSED/);assert.equal(calls,1);
});
