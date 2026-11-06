-- READ-ONLY: which web server updates (30–39) are already on the server. Changes nothing.
select item, ok from (values
 ('30 multi-device owner',           exists(select 1 from pg_tables where schemaname='public' and tablename='sharikx2_owner_sessions')),
 ('31 sale/expense web (functions)', to_regprocedure('public.confirm_sharikx2_sale_web_v1(uuid,text,jsonb)') is not null
                                     or exists(select 1 from pg_proc where proname='confirm_sharikx2_sale_web_v1')),
 ('31 expenses.client_request_id',   exists(select 1 from information_schema.columns where table_schema='public' and table_name='sharikx2_expenses' and column_name='client_request_id')),
 ('33 expense edit/delete',          exists(select 1 from pg_proc where proname='mutate_sharikx2_expense_web_v1')),
 ('34 account transfer',             exists(select 1 from pg_proc where proname='transfer_sharikx2_account_web_v1')),
 ('36 supplier payment',             exists(select 1 from pg_proc where proname='pay_sharikx2_supplier_web_v1')),
 ('37 customer collection',          exists(select 1 from pg_proc where proname='collect_sharikx2_customer_debt_web_v1')),
 ('38 sale return',                  exists(select 1 from pg_proc where proname='return_sharikx2_sale_web_v1')),
 ('39 supplier credit',              exists(select 1 from pg_proc where proname='create_sharikx2_supplier_credit_v1'))
) as t(item, ok);
