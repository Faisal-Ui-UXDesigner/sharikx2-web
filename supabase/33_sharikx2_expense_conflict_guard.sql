-- Additive web API. Android signatures and legacy tables are unchanged.
begin;
create or replace function public.mutate_sharikx2_expense_web_v1(
 p_project_id uuid,p_expense_id uuid,p_action text,p_expected jsonb,
 p_changes jsonb,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_row public.sharikx2_expenses; current_snapshot jsonb;
 payload jsonb; receipt public.sharikx2_operation_receipts; result jsonb;
begin
 if not public.sharikx2_is_owner(p_project_id) then raise exception 'OWNER_REQUIRED'; end if;
 if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
 if p_action is null or p_action not in ('update','delete') then raise exception 'INVALID_ACTION'; end if;
 payload:=jsonb_build_object('expense',p_expense_id,'action',p_action,'expected',p_expected,'changes',p_changes);
 perform pg_advisory_xact_lock(hashtextextended(p_project_id::text||p_request_id::text,0));
 select * into receipt from public.sharikx2_operation_receipts
 where project_id=p_project_id and request_id=p_request_id;
 if found then
  if receipt.operation_type<>'expense_mutation' or receipt.payload<>payload
    then raise exception 'REQUEST_PAYLOAD_CHANGED'; end if;
  return receipt.result;
 end if;
 select * into old_row from public.sharikx2_expenses
 where id=p_expense_id and project_id=p_project_id for update;
 if old_row.id is null then raise exception 'EXPENSE_NOT_FOUND'; end if;
 current_snapshot:=jsonb_build_object('account_id',old_row.account_id,
  'amount',old_row.amount,'description',old_row.description,'category',old_row.category);
 if p_expected is distinct from current_snapshot then raise exception 'STALE_EXPENSE'; end if;
 if p_action='delete' then
  -- Synchronize with expense/account writers before restoring the debit.
  perform 1 from public.sharikx2_accounts where id=old_row.account_id and project_id=p_project_id for update;
  result:=public.delete_sharikx2_expense_v1(p_project_id,p_expense_id);
 else
  result:=public.update_sharikx2_expense_v2(p_project_id,p_expense_id,
   p_changes->>'category',p_changes->>'description',(p_changes->>'amount')::numeric,
   (p_changes->>'account_id')::uuid);
 end if;
 insert into public.sharikx2_operation_receipts(project_id,request_id,operation_type,payload,result)
 values(p_project_id,p_request_id,'expense_mutation',payload,result);
 return result;
end; $$;
revoke all on function public.mutate_sharikx2_expense_web_v1(uuid,uuid,text,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.mutate_sharikx2_expense_web_v1(uuid,uuid,text,jsonb,jsonb,uuid) to authenticated;
commit;
