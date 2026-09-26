begin;
alter table public.sharikx2_sale_returns add column if not exists client_request_id uuid;
create unique index if not exists sharikx2_sale_return_request_uq on public.sharikx2_sale_returns(project_id,client_request_id) where client_request_id is not null;
create or replace function public.return_sharikx2_sale_web_v1(p_project_id uuid,p_sale_id uuid,p_items jsonb,p_refund_account_id uuid,p_reason text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_old public.sharikx2_sale_returns;v_result jsonb;
begin
 if not public.sharikx2_is_owner(p_project_id) then raise exception 'OWNER_REQUIRED';end if;if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_project_id::text||p_request_id::text,0));select * into v_old from public.sharikx2_sale_returns where project_id=p_project_id and client_request_id=p_request_id;
 if found then return jsonb_build_object('id',v_old.id,'total',v_old.total,'already_confirmed',true);end if;
 v_result=public.return_sharikx2_sale_v2(p_project_id,p_sale_id,p_items,p_refund_account_id,p_reason);update public.sharikx2_sale_returns set client_request_id=p_request_id where id=(v_result->>'id')::uuid;return v_result||jsonb_build_object('already_confirmed',false);
end;$$;
revoke all on function public.return_sharikx2_sale_web_v1(uuid,uuid,jsonb,uuid,text,uuid) from public,anon;grant execute on function public.return_sharikx2_sale_web_v1(uuid,uuid,jsonb,uuid,text,uuid) to authenticated;
commit;
