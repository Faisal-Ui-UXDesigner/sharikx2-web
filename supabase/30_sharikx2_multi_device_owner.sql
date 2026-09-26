-- SharikX2 only. Apply after migration 24 (paid sharing) and 29 (deletion).
-- No changes to Android binaries, old tables, balances, or owner_id.
begin;

create table if not exists public.sharikx2_owner_sessions (
  project_id uuid not null references public.sharikx2_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_hash text not null,
  verified_at timestamptz not null default now(),
  primary key(project_id,user_id)
);
alter table public.sharikx2_owner_sessions enable row level security;
revoke all on public.sharikx2_owner_sessions from public,anon,authenticated;

create or replace function public.sharikx2_is_owner(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.sharikx2_projects p
    where p.id=p_project_id and p.archived_at is null
      and (p.owner_id=auth.uid() or exists (
        select 1 from public.sharikx2_owner_sessions s
        where s.project_id=p.id and s.user_id=auth.uid()
          and s.credential_hash=p.owner_password_hash
      ))
  );
$$;
revoke all on function public.sharikx2_is_owner(uuid) from public,anon;
grant execute on function public.sharikx2_is_owner(uuid) to authenticated;

create or replace function public.sharikx2_is_member(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.sharikx2_is_owner(p_project_id) or exists (
    select 1 from public.sharikx2_members m
    where m.project_id=p_project_id and m.user_id=auth.uid()
      and public.sharikx2_paid_sharing_enabled_v1(p_project_id)
  );
$$;
revoke all on function public.sharikx2_is_member(uuid) from public,anon;
grant execute on function public.sharikx2_is_member(uuid) to authenticated;

create or replace function public.restore_sharikx2_owner_project_v2(
  p_owner_phone text,p_owner_password text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_project public.sharikx2_projects; v_phone text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_phone:=regexp_replace(coalesce(p_owner_phone,''),'[^0-9]','','g');
  if v_phone !~ '^[0-9]{9,15}$' then raise exception 'INVALID_OWNER_PHONE'; end if;
  if coalesce(p_owner_password,'') !~ '^[0-9]{4}$' then raise exception 'INVALID_OWNER_PASSWORD'; end if;
  select * into v_project from public.sharikx2_projects where owner_phone=v_phone for update;
  if v_project.id is null then raise exception 'OWNER_PHONE_NOT_REGISTERED'; end if;
  if v_project.owner_password_hash is null or
    extensions.crypt(p_owner_password,v_project.owner_password_hash)<>v_project.owner_password_hash
    then raise exception 'OWNER_LOGIN_INVALID'; end if;
  if v_project.archived_at is not null then raise exception 'PROJECT_ARCHIVED'; end if;
  if v_project.subscription_status='suspended' then raise exception 'PROJECT_SUSPENDED'; end if;
  insert into public.sharikx2_owner_sessions(project_id,user_id,credential_hash)
    values(v_project.id,auth.uid(),v_project.owner_password_hash)
    on conflict(project_id,user_id) do update
      set credential_hash=excluded.credential_hash,verified_at=now();
  insert into public.sharikx2_members(project_id,user_id,role,display_name)
    values(v_project.id,auth.uid(),'owner','منشئ المشروع')
    on conflict(project_id,user_id) do update set role='owner',display_name='منشئ المشروع';
  return jsonb_build_object('id',v_project.id,'name',v_project.name,
    'project_number',v_project.project_number,'wallet_1_name',v_project.wallet_1_name,
    'wallet_2_name',v_project.wallet_2_name,'subscription_status',v_project.subscription_status,
    'subscription_expires_at',v_project.subscription_expires_at,'role','owner');
end; $$;
revoke all on function public.restore_sharikx2_owner_project_v2(text,text) from public,anon;
grant execute on function public.restore_sharikx2_owner_project_v2(text,text) to authenticated;

create or replace function public.join_sharikx2_project_v1(p_share_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_project public.sharikx2_projects;v_pin text;v_owner boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_pin:=regexp_replace(coalesce(p_share_pin,''),'[^0-9]','','g');
  if v_pin !~ '^[0-9]{4}$' then raise exception 'INVALID_SHARE_PIN'; end if;
  select * into v_project from public.sharikx2_projects
    where share_pin=v_pin and archived_at is null limit 1;
  if v_project.id is null then raise exception 'PROJECT_NOT_FOUND'; end if;
  v_owner:=public.sharikx2_is_owner(v_project.id);
  if not v_owner and not public.sharikx2_paid_sharing_enabled_v1(v_project.id)
    then raise exception 'SHARIKX2_SHARING_REQUIRES_SUBSCRIPTION'; end if;
  insert into public.sharikx2_members(project_id,user_id,role,display_name)
    values(v_project.id,auth.uid(),case when v_owner then 'owner' else 'viewer' end,
      case when v_owner then 'منشئ المشروع' else 'مشاهد' end)
    on conflict(project_id,user_id) do update set role=excluded.role;
  return jsonb_build_object('id',v_project.id,'name',v_project.name,
    'project_number',v_project.project_number,'subscription_status',v_project.subscription_status,
    'subscription_expires_at',v_project.subscription_expires_at,
    'role',case when v_owner then 'owner' else 'viewer' end);
end; $$;
revoke all on function public.join_sharikx2_project_v1(text) from public,anon;
grant execute on function public.join_sharikx2_project_v1(text) to authenticated;

drop policy if exists "sharikx2 owner updates project" on public.sharikx2_projects;
create policy "sharikx2 owner updates project" on public.sharikx2_projects
  for update to authenticated using(public.sharikx2_is_owner(id))
  with check(public.sharikx2_is_owner(id));

-- Keep deletion's phone/password check, replacing only its single-device gate.
do $$
declare definition text;
begin
  if to_regprocedure('public.delete_sharikx2_project_v1(uuid,text,text)') is null
    then raise exception 'Migration 29 must be applied first'; end if;
  select pg_get_functiondef('public.delete_sharikx2_project_v1(uuid,text,text)'::regprocedure)
    into definition;
  if position('and owner_id = auth.uid()' in definition)>0 then
    definition:=replace(definition,'and owner_id = auth.uid()',
      'and public.sharikx2_is_owner(p_project_id)');
    execute definition;
  elsif position('and public.sharikx2_is_owner(p_project_id)' in definition)=0 then
    raise exception 'Unexpected deletion definition; review before migrating';
  end if;
end; $$;

commit;
