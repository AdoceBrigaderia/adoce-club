\set ON_ERROR_STOP on

begin;

select pg_advisory_xact_lock(
  hashtextextended('adoce:homologation:permissive-policy-audit', 0)
);

\echo 'ADOCE_POLICY_AUDIT_SUMMARY'
with expanded_policies as (
  select
    policy.schemaname,
    policy.tablename,
    policy.policyname,
    lower(policy.cmd) as command,
    role_name::text as role_name,
    coalesce(policy.qual, '') as using_expression,
    coalesce(policy.with_check, '') as check_expression
  from pg_policies policy
  cross join lateral unnest(policy.roles) as role_name
  where policy.schemaname = 'public'
    and policy.permissive = 'PERMISSIVE'
), duplicate_groups as (
  select
    schemaname,
    tablename,
    role_name,
    command,
    count(*) as policy_count,
    count(distinct using_expression || E'\n--CHECK--\n' || check_expression) as expression_count
  from expanded_policies
  group by schemaname, tablename, role_name, command
  having count(*) > 1
)
select
  count(*) as duplicate_groups,
  count(*) filter (
    where role_name in ('anon', 'public')
      and command in ('all', 'insert', 'update', 'delete')
  ) as critical_anon_write_groups,
  count(*) filter (
    where role_name = 'authenticated'
      and command in ('all', 'insert', 'update', 'delete')
  ) as high_authenticated_write_groups,
  count(*) filter (where command = 'select') as read_groups,
  count(*) filter (where expression_count = 1) as exact_duplicate_groups,
  count(*) filter (where expression_count > 1) as overlapping_expression_groups
from duplicate_groups;

\echo 'ADOCE_POLICY_AUDIT_DUPLICATE_GROUPS'
with expanded_policies as (
  select
    policy.schemaname,
    policy.tablename,
    policy.policyname,
    lower(policy.cmd) as command,
    role_name::text as role_name,
    coalesce(policy.qual, '') as using_expression,
    coalesce(policy.with_check, '') as check_expression
  from pg_policies policy
  cross join lateral unnest(policy.roles) as role_name
  where policy.schemaname = 'public'
    and policy.permissive = 'PERMISSIVE'
), duplicate_groups as (
  select
    schemaname,
    tablename,
    role_name,
    command,
    count(*) as policy_count,
    count(distinct using_expression || E'\n--CHECK--\n' || check_expression) as expression_count,
    array_agg(policyname order by policyname) as policy_names
  from expanded_policies
  group by schemaname, tablename, role_name, command
  having count(*) > 1
)
select
  case
    when role_name in ('anon', 'public')
      and command in ('all', 'insert', 'update', 'delete') then 'critical'
    when role_name = 'authenticated'
      and command in ('all', 'insert', 'update', 'delete') then 'high'
    when expression_count = 1 then 'medium_exact_duplicate'
    else 'medium_overlap'
  end as severity,
  schemaname,
  tablename,
  role_name,
  command,
  policy_count,
  expression_count,
  policy_names
from duplicate_groups
order by
  case
    when role_name in ('anon', 'public')
      and command in ('all', 'insert', 'update', 'delete') then 1
    when role_name = 'authenticated'
      and command in ('all', 'insert', 'update', 'delete') then 2
    when expression_count = 1 then 3
    else 4
  end,
  schemaname,
  tablename,
  role_name,
  command;

\echo 'ADOCE_POLICY_AUDIT_POLICY_DETAILS'
with expanded_policies as (
  select
    policy.schemaname,
    policy.tablename,
    policy.policyname,
    lower(policy.cmd) as command,
    role_name::text as role_name,
    coalesce(policy.qual, '') as using_expression,
    coalesce(policy.with_check, '') as check_expression
  from pg_policies policy
  cross join lateral unnest(policy.roles) as role_name
  where policy.schemaname = 'public'
    and policy.permissive = 'PERMISSIVE'
), duplicate_keys as (
  select schemaname, tablename, role_name, command
  from expanded_policies
  group by schemaname, tablename, role_name, command
  having count(*) > 1
)
select
  policy.schemaname,
  policy.tablename,
  policy.role_name,
  policy.command,
  policy.policyname,
  md5(policy.using_expression) as using_expression_hash,
  md5(policy.check_expression) as check_expression_hash,
  policy.using_expression,
  policy.check_expression
from expanded_policies policy
join duplicate_keys duplicate_key
  using (schemaname, tablename, role_name, command)
order by
  policy.schemaname,
  policy.tablename,
  policy.role_name,
  policy.command,
  policy.policyname;

rollback;
