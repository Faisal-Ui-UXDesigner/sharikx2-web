import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../supabase/31_sharikx2_web_operation_safety.sql',import.meta.url),'utf8');
test('web wrappers authorize before returning operation receipts',()=>{
 for(const name of ['sale','expense']){
 const body=sql.split(`create or replace function public.confirm_sharikx2_${name}_web_v1`)[1].split('end; $$;')[0];
 assert.ok(body.indexOf('sharikx2_is_owner')<body.indexOf('select * into v_existing'));
 assert.match(body,/pg_advisory_xact_lock/);assert.match(body,/REQUEST_PAYLOAD_CHANGED/);
 assert.ok(body.indexOf('v_result:=public.confirm_sharikx2_')<body.indexOf('insert into public.sharikx2_operation_receipts'));
 }
});
test('new wrappers do not replace Android functions',()=>{
 assert.doesNotMatch(sql,/create or replace function public\.confirm_sharikx2_sale_v2\(/);
 assert.doesNotMatch(sql,/create or replace function public\.confirm_sharikx2_expense_v3\(/);
 assert.match(sql,/primary key\(project_id,request_id\)/);
});
