import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../supabase/33_sharikx2_expense_conflict_guard.sql',import.meta.url),'utf8');
test('expense mutation checks snapshot under row lock before any business write',()=>{
 assert.ok(sql.indexOf('for update;')<sql.indexOf('STALE_EXPENSE'));
 assert.ok(sql.indexOf('STALE_EXPENSE')<sql.indexOf('result:=public.delete_sharikx2_expense_v1'));
 assert.ok(sql.indexOf('STALE_EXPENSE')<sql.indexOf('result:=public.update_sharikx2_expense_v2'));
 assert.match(sql,/p_expected is distinct from current_snapshot/);
});
test('mutation retry checks authorization and immutable payload',()=>{
 assert.ok(sql.indexOf('sharikx2_is_owner')<sql.indexOf('select * into receipt'));
 assert.match(sql,/REQUEST_PAYLOAD_CHANGED/);assert.match(sql,/return receipt.result/);
});
