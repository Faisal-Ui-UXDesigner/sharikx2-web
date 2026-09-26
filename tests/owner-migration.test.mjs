import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../supabase/30_sharikx2_multi_device_owner.sql',import.meta.url),'utf8');
test('restoration never transfers ownership or demotes another session',()=>{
 const body=sql.split('create or replace function public.restore_sharikx2_owner_project_v2')[1].split('create or replace function public.join_sharikx2_project_v1')[0];
 assert.doesNotMatch(body,/set\s+owner_id|v_previous_owner|set\s+role\s*=\s*'viewer'/i);
 assert.match(body,/extensions\.crypt/);assert.match(body,/insert into public\.sharikx2_owner_sessions/);
});
test('owner grants are protected and tied to the current credential',()=>{
 assert.match(sql,/revoke all on public\.sharikx2_owner_sessions from public,anon,authenticated/);
 assert.match(sql,/s\.credential_hash=p\.owner_password_hash/);
 assert.doesNotMatch(sql,/create policy[^;]+sharikx2_owner_sessions/is);
});
test('sharing alone does not create a verified owner grant',()=>{
 const join=sql.split('create or replace function public.join_sharikx2_project_v1')[1];
 assert.doesNotMatch(join,/insert into public\.sharikx2_owner_sessions/);
 assert.match(join,/case when v_owner then 'owner' else 'viewer' end/);
});
