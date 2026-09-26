begin;
alter table public.sharikx2_supplier_payments add column if not exists client_request_id uuid;
create unique index if not exists sharikx2_supplier_payment_request_uq on public.sharikx2_supplier_payments(project_id,client_request_id) where client_request_id is not null;
create or replace function public.pay_sharikx2_supplier_web_v1(p_project_id uuid,p_supplier_id uuid,p_sources jsonb,p_note text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_old public.sharikx2_supplier_payments;v_payload jsonb;v_result jsonb;
begin
 if not public.sharikx2_is_owner(p_project_id) then raise exception 'OWNER_REQUIRED';end if;
 if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED';end if;
 v_payload=jsonb_build_object('supplier',p_supplier_id,'sources',p_sources,'note',p_note);
 perform pg_advisory_xact_lock(hashtextextended(p_project_id::text||p_request_id::text,0));
 select * into v_old from public.sharikx2_supplier_payments where project_id=p_project_id and client_request_id=p_request_id;
 if found then if v_old.note is distinct from nullif(trim(p_note),'') then raise exception 'REQUEST_PAYLOAD_CHANGED';end if;return jsonb_build_object('id',v_old.id,'amount',v_old.amount,'already_confirmed',true);end if;
 v_result=public.pay_sharikx2_supplier_multi_v2(p_project_id,p_supplier_id,p_sources,p_note);
 update public.sharikx2_supplier_payments set client_request_id=p_request_id where id=(v_result->>'id')::uuid;
 return v_result||jsonb_build_object('already_confirmed',false);
end;$$;
revoke all on function public.pay_sharikx2_supplier_web_v1(uuid,uuid,jsonb,text,uuid) from public,anon;grant execute on function public.pay_sharikx2_supplier_web_v1(uuid,uuid,jsonb,text,uuid) to authenticated;
commit;
