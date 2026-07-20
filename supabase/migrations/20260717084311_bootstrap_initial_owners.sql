begin;

update public.profiles
set full_name = 'Francisco Rubens Pereira Bezerra Filho',
    phone_e164 = '+5585982156026',
    updated_at = now()
where id = '1e58edf2-2496-4cd1-b22b-7e8699ee626d';

update public.profiles
set full_name = 'Elizabeth Cristina Sampaio Nascimento',
    phone_e164 = '+5585981994370',
    updated_at = now()
where id = 'c5a4fa75-04b4-4ab2-b830-7544915b1b7c';

insert into public.staff_members(user_id, role, active)
values
  ('1e58edf2-2496-4cd1-b22b-7e8699ee626d', 'owner', true),
  ('c5a4fa75-04b4-4ab2-b830-7544915b1b7c', 'owner', true)
on conflict (user_id) do update
set role = excluded.role, active = true;

insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
values
  ('1e58edf2-2496-4cd1-b22b-7e8699ee626d', 'staff.owner_bootstrap', 'staff_member', '1e58edf2-2496-4cd1-b22b-7e8699ee626d', '{"source":"initial_owners"}'::jsonb),
  ('1e58edf2-2496-4cd1-b22b-7e8699ee626d', 'staff.owner_bootstrap', 'staff_member', 'c5a4fa75-04b4-4ab2-b830-7544915b1b7c', '{"source":"initial_owners"}'::jsonb);

commit;
