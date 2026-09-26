import test from 'node:test';
import assert from 'node:assert/strict';
import {assertIsolatedPath,netMonthlySales,Api} from '../api.js';
test('allows new tables and RPCs only',()=>{
 for(const p of ['/rest/v1/sharikx2_products?limit=20','/rest/v1/rpc/restore_sharikx2_owner_project_v2'])assert.doesNotThrow(()=>assertIsolatedPath(p));
 for(const p of ['/rest/v1/projects','/rest/v1/rpc/delete_account','/rest/v1/sharikx2_products/../projects'])assert.throws(()=>assertIsolatedPath(p));
});
test('net sales do not subtract a partial return twice',()=>assert.equal(netMonthlySales([{status:'partially_returned',total:9,returned_total:3},{status:'completed',total:4},{status:'cancelled',total:100}]),13));
test('legacy access is blocked before authentication',async()=>{
 const api=new Api({publicKey:''});await assert.rejects(api.request('/rest/v1/projects'),/BLOCKED_LEGACY_ENDPOINT/);
});
