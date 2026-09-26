-- Disposable data lives only inside a PL/pgSQL subtransaction, rolled back.
-- Existing projects are never updated. Identity sequences may advance (normal).
create temporary table sharikx2_smoke_results(check_name text,result text) on commit drop;
do $$
declare
 u uuid; p uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); product uuid:=gen_random_uuid();
 expense_request uuid:=gen_random_uuid(); sale_request uuid:=gen_random_uuid();
 first_result jsonb; second_result jsonb; checks jsonb:='[]'; items jsonb; failure text;
begin
 select id into u from auth.users order by created_at limit 1;
 if u is null then raise exception 'A test auth identity is required'; end if;
 begin
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  insert into public.sharikx2_projects(id,owner_id,name,owner_phone,project_number,subscription_status)
    values(p,u,'Temporary safety test','099'||lpad(floor(random()*10000000)::bigint::text,7,'0'),p::text,'active');
  insert into public.sharikx2_members(project_id,user_id,role) values(p,u,'owner');
  insert into public.sharikx2_accounts(id,project_id,name,account_type,opening_balance)
    values(a,p,'Test cash','cash',100);
  insert into public.sharikx2_products(id,project_id,barcode,name,quantity_pieces,default_sale_price,weighted_unit_cost)
    values(product,p,product::text,'Test product',2,10,4);
  first_result:=public.confirm_sharikx2_expense_web_v1(p,'operating_expense','Test',30,a,expense_request);
  second_result:=public.confirm_sharikx2_expense_web_v1(p,'operating_expense','Test',30,a,expense_request);
  if first_result<>second_result or (select count(*) from public.sharikx2_expenses where project_id=p)<>1
    then raise exception 'Expense duplicate'; end if;
  checks:=checks||jsonb_build_array('expense retry creates one expense');
  begin
    perform public.confirm_sharikx2_expense_web_v1(p,'operating_expense','Test',31,a,expense_request);
    raise exception 'Changed payload was accepted';
  exception when others then if sqlerrm<>'REQUEST_PAYLOAD_CHANGED' then raise; end if; end;
  checks:=checks||jsonb_build_array('changed request payload rejected');
  begin
    perform public.confirm_sharikx2_expense_web_v1(p,'operating_expense','Too much',71,a,gen_random_uuid());
    raise exception 'Overspend was accepted';
  exception when others then if sqlerrm<>'INSUFFICIENT_ACCOUNT_BALANCE' then raise; end if; end;
  checks:=checks||jsonb_build_array('insufficient balance rejected');
  items:=jsonb_build_array(jsonb_build_object('product_id',product,'quantity',1,'unit_sale_price',10));
  first_result:=public.confirm_sharikx2_sale_web_v1(p,items,0,null,a,false,sale_request);
  second_result:=public.confirm_sharikx2_sale_web_v1(p,items,0,null,a,false,sale_request);
  if first_result<>second_result or (select count(*) from public.sharikx2_sales where project_id=p)<>1
    or (select quantity_pieces from public.sharikx2_products where id=product)<>1
    then raise exception 'Sale duplicate'; end if;
  checks:=checks||jsonb_build_array('sale retry creates one sale and stock deduction');
  begin
    perform public.confirm_sharikx2_sale_web_v1(p,jsonb_build_array(jsonb_build_object('product_id',product,'quantity',2,'unit_sale_price',10)),0,null,a,false,gen_random_uuid());
    raise exception 'Oversell was accepted';
  exception when others then if sqlerrm not like 'OUT_OF_STOCK:%' then raise; end if; end;
  checks:=checks||jsonb_build_array('insufficient stock rejected');
  if (select count(*) from public.sharikx2_operation_receipts where project_id=p)<>2 then raise exception 'Failed operation left a receipt'; end if;
  checks:=checks||jsonb_build_array('failed operations leave no receipts');
  raise exception using errcode='ZX001',message='ROLLBACK_DISPOSABLE_TEST';
 exception when sqlstate 'ZX001' then null;
 end;
 if exists(select 1 from public.sharikx2_projects where id=p) then raise exception 'Test cleanup failed'; end if;
 insert into sharikx2_smoke_results select value,'PASS' from jsonb_array_elements_text(checks);
 insert into sharikx2_smoke_results values('disposable project and all its rows rolled back','PASS');
end $$;
select * from sharikx2_smoke_results;
