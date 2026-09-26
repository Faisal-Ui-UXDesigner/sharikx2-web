-- Additive API for web. Android's existing signatures remain unchanged.
-- Apply and test on a dedicated test project before enabling web writes.
begin;
create table if not exists public.sharikx2_operation_receipts (
 project_id uuid not null references public.sharikx2_projects(id) on delete cascade,
 request_id uuid not null,
 operation_type text not null,
 payload jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(project_id,request_id)
);
alter table public.sharikx2_operation_receipts enable row level security;
revoke all on public.sharikx2_operation_receipts from public,anon,authenticated;

create or replace function public.confirm_sharikx2_sale_web_v1(
 p_project_id uuid,p_items jsonb,p_discount numeric,p_customer_id uuid,
 p_account_id uuid,p_as_debt boolean,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_payload jsonb;v_existing public.sharikx2_operation_receipts;v_result jsonb;
begin
 if not public.sharikx2_is_owner(p_project_id) then raise exception 'OWNER_REQUIRED'; end if;
 if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
 v_payload:=jsonb_build_object('items',p_items,'discount',p_discount,
   'customer',p_customer_id,'account',p_account_id,'debt',p_as_debt);
 perform pg_advisory_xact_lock(hashtextextended(p_project_id::text||p_request_id::text,0));
 select * into v_existing from public.sharikx2_operation_receipts
   where project_id=p_project_id and request_id=p_request_id;
 if found then
   if v_existing.operation_type<>'sale' or v_existing.payload<>v_payload
     then raise exception 'REQUEST_PAYLOAD_CHANGED'; end if;
   return v_existing.result;
 end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)=0
   then raise exception 'SALE_ITEMS_REQUIRED'; end if;
 -- All products in stable order: unlike client order, this avoids inverted locks
 -- between two web baskets. Existing v2 then rechecks stock under these locks.
 perform p.id from public.sharikx2_products p
   where p.project_id=p_project_id and p.id in
     (select (x->>'product_id')::uuid from jsonb_array_elements(p_items) x)
   order by p.id for update;
 -- Duplicate product lines are rejected rather than checked independently.
 if exists(select 1 from jsonb_array_elements(p_items) x
   group by x->>'product_id' having count(*)>1)
   then raise exception 'DUPLICATE_PRODUCT_LINES'; end if;
 v_result:=public.confirm_sharikx2_sale_v2(p_project_id,p_items,p_discount,
   p_customer_id,p_account_id,p_as_debt);
 insert into public.sharikx2_operation_receipts
   (project_id,request_id,operation_type,payload,result)
   values(p_project_id,p_request_id,'sale',v_payload,v_result);
 return v_result;
end; $$;
revoke all on function public.confirm_sharikx2_sale_web_v1(uuid,jsonb,numeric,uuid,uuid,boolean,uuid) from public,anon;
grant execute on function public.confirm_sharikx2_sale_web_v1(uuid,jsonb,numeric,uuid,uuid,boolean,uuid) to authenticated;

create or replace function public.confirm_sharikx2_expense_web_v1(
 p_project_id uuid,p_category text,p_description text,p_amount numeric,
 p_account_id uuid,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_payload jsonb;v_existing public.sharikx2_operation_receipts;v_result jsonb;
begin
 if not public.sharikx2_is_owner(p_project_id) then raise exception 'OWNER_REQUIRED'; end if;
 if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
 v_payload:=jsonb_build_object('category',p_category,'description',p_description,
   'amount',p_amount,'account',p_account_id);
 perform pg_advisory_xact_lock(hashtextextended(p_project_id::text||p_request_id::text,0));
 select * into v_existing from public.sharikx2_operation_receipts
   where project_id=p_project_id and request_id=p_request_id;
 if found then
   if v_existing.operation_type<>'expense' or v_existing.payload<>v_payload
     then raise exception 'REQUEST_PAYLOAD_CHANGED'; end if;
   return v_existing.result;
 end if;
 -- Existing v3 locks the payment account and checks its actual server balance.
 v_result:=public.confirm_sharikx2_expense_v3(p_project_id,p_category,
   p_description,p_amount,p_account_id);
 insert into public.sharikx2_operation_receipts
   (project_id,request_id,operation_type,payload,result)
   values(p_project_id,p_request_id,'expense',v_payload,v_result);
 return v_result;
end; $$;
revoke all on function public.confirm_sharikx2_expense_web_v1(uuid,text,text,numeric,uuid,uuid) from public,anon;
grant execute on function public.confirm_sharikx2_expense_web_v1(uuid,text,text,numeric,uuid,uuid) to authenticated;
commit;
