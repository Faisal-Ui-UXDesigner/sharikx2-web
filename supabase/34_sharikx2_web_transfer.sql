-- Additive web wrapper. No old tables or Android signatures are changed.
begin;
create or replace function public.transfer_sharikx2_account_web_v1(
 p_project_id uuid,p_from_account_id uuid,p_to_account_id uuid,p_amount numeric,p_note text,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_payload jsonb;v_existing public.sharikx2_operation_receipts;v_result jsonb;
begin
 if not public.sharikx2_is_owner(p_project_id) then raise exception 'OWNER_REQUIRED'; end if;
 if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
 v_payload:=jsonb_build_object('from',p_from_account_id,'to',p_to_account_id,'amount',p_amount,'note',p_note);
 perform pg_advisory_xact_lock(hashtextextended(p_project_id::text||p_request_id::text,0));
 select * into v_existing from public.sharikx2_operation_receipts where project_id=p_project_id and request_id=p_request_id;
 if found then
  if v_existing.operation_type<>'transfer' or v_existing.payload<>v_payload then raise exception 'REQUEST_PAYLOAD_CHANGED'; end if;
  return v_existing.result;
 end if;
 -- v2 locks both accounts in stable order and validates actual available funds.
 v_result:=public.transfer_sharikx2_account_v2(p_project_id,p_from_account_id,p_to_account_id,p_amount,p_note);
 insert into public.sharikx2_operation_receipts(project_id,request_id,operation_type,payload,result)
 values(p_project_id,p_request_id,'transfer',v_payload,v_result);
 return v_result;
end; $$;
revoke all on function public.transfer_sharikx2_account_web_v1(uuid,uuid,uuid,numeric,text,uuid) from public,anon;
grant execute on function public.transfer_sharikx2_account_web_v1(uuid,uuid,uuid,numeric,text,uuid) to authenticated;
commit;
