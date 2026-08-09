-- ============================================================================
-- pioneers-egy :: development seed
-- ============================================================================
-- Runs on `pnpm db:reset` against the LOCAL stack only. Never run against
-- production — it writes known passwords.
--
-- Accounts (password for all four: Pioneers@2026)
--   admin@pioneers-egy.com     admin
--   manager@pioneers-egy.com   manager
--   ahmed@pioneers-egy.com     inspector
--   sara@pioneers-egy.com      inspector
--
-- The on_auth_user_created trigger derives public.profiles from the metadata
-- below, so profiles are not inserted directly here.
-- ============================================================================

do $$
declare
  u record;
begin
  for u in
    select *
    from (values
      ('11111111-1111-1111-1111-111111111111'::uuid, 'admin@pioneers-egy.com',   'Youssef Hakim',  'admin',     '+20 100 000 0001'),
      ('22222222-2222-2222-2222-222222222222'::uuid, 'manager@pioneers-egy.com', 'Nadia Fouad',    'manager',   '+20 100 000 0002'),
      ('33333333-3333-3333-3333-333333333333'::uuid, 'ahmed@pioneers-egy.com',   'Ahmed Sami',     'inspector', '+20 100 000 0003'),
      ('44444444-4444-4444-4444-444444444444'::uuid, 'sara@pioneers-egy.com',    'Sara Mahmoud',   'inspector', '+20 100 000 0004')
    ) as t(id, email, full_name, role, phone)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      u.id,
      'authenticated',
      'authenticated',
      u.email,
      extensions.crypt('Pioneers@2026', extensions.gen_salt('bf')),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', u.full_name, 'role', u.role, 'phone', u.phone),
      now(), now(),
      '', '', '', ''
    )
    on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    )
    values (
      gen_random_uuid(),
      u.id,
      u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email',
      now(), now(), now()
    )
    on conflict (provider, provider_id) do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Sample inspection jobs
-- ---------------------------------------------------------------------------
-- Deliberately seeded WITHOUT task_photos: photo rows would point at R2 object
-- keys that do not exist, and the gallery would render broken images. Upload
-- photos through the app to exercise that path.

insert into public.jobs (id, client_id, project_name, company_name, visit_date, status, created_by, submitted_at, notes)
values
  ('aaaaaaa1-0000-4000-8000-000000000001', gen_random_uuid(), 'Damietta Port Crane Overhaul', 'Delta Marine Services',   current_date - 6, 'submitted', '33333333-3333-3333-3333-333333333333', now() - interval '6 days', 'Annual statutory lifting inspection.'),
  ('aaaaaaa1-0000-4000-8000-000000000002', gen_random_uuid(), 'Suez Refinery Pipeline Loop 4', 'Horizon Petrochemicals', current_date - 3, 'submitted', '33333333-3333-3333-3333-333333333333', now() - interval '3 days', 'Weld integrity survey across 4 spools.'),
  ('aaaaaaa1-0000-4000-8000-000000000003', gen_random_uuid(), '6th of October Warehouse Fit-out', 'Nile Logistics Group',  current_date - 1, 'draft',     '44444444-4444-4444-4444-444444444444', null,                      'Pre-commissioning checks in progress.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Sample tasks
-- ---------------------------------------------------------------------------
-- `data` keys must match the Zod schemas in packages/core/src/schemas/task.ts.

insert into public.job_tasks (id, client_id, job_id, category, subtype, sort_order, data)
values
  -- Job 1 :: lifting + testing
  ('bbbbbbb1-0000-4000-8000-000000000001', gen_random_uuid(), 'aaaaaaa1-0000-4000-8000-000000000001', 'inspection', 'lifting', 0,
   '{"quantity": 12, "notes": "Two shackles rejected for thread wear; replacements fitted on site.", "description": "Gantry crane lifting tackle: 8 slings, 4 shackles."}'::jsonb),

  ('bbbbbbb1-0000-4000-8000-000000000002', gen_random_uuid(), 'aaaaaaa1-0000-4000-8000-000000000001', 'inspection', 'testing', 1,
   '{"test_name": "Load test @ 125% SWL", "result": "pass", "item_description": "Main hoist rated 25 t, tested to 31.25 t for 10 minutes.", "quantity": 1}'::jsonb),

  -- Job 2 :: NDT x2
  ('bbbbbbb1-0000-4000-8000-000000000003', gen_random_uuid(), 'aaaaaaa1-0000-4000-8000-000000000002', 'inspection', 'ndt', 0,
   '{"method": "ut", "item_description": "Butt welds on spools 4A-4D, 8 inch schedule 40.", "percent_complete": 100, "notes": "No recordable indications.", "quantity": 24}'::jsonb),

  ('bbbbbbb1-0000-4000-8000-000000000004', gen_random_uuid(), 'aaaaaaa1-0000-4000-8000-000000000002', 'inspection', 'ndt', 1,
   '{"method": "pt", "item_description": "Socket welds at manifold tie-in.", "percent_complete": 60, "notes": "Remaining 40% blocked by scaffold removal.", "quantity": 10}'::jsonb),

  -- Job 3 :: draft, mixed categories
  ('bbbbbbb1-0000-4000-8000-000000000005', gen_random_uuid(), 'aaaaaaa1-0000-4000-8000-000000000003', 'inspection', 'testing', 0,
   '{"test_name": "Fire pump flow verification", "result": "fail", "item_description": "Jockey pump failed to maintain 7 bar standby pressure.", "quantity": 1}'::jsonb),

  ('bbbbbbb1-0000-4000-8000-000000000006', gen_random_uuid(), 'aaaaaaa1-0000-4000-8000-000000000003', 'environmental', 'env_option_1', 1,
   '{"notes": "Placeholder environmental assessment - form fields pending specification."}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Sample certificates
-- ---------------------------------------------------------------------------
-- NOTE: r2_key values below are placeholders. The rows exist so the list,
-- search and QR-sharing flows can be demonstrated, but downloading them will
-- 404 until a real PDF is uploaded through the app.

insert into public.certificates (
  id, client_id, title, file_name, r2_key, size_bytes,
  company_name, certificate_number, issue_date, expiry_date, job_id, uploaded_by
)
values
  ('ccccccc1-0000-4000-8000-000000000001', gen_random_uuid(),
   'Gantry Crane Load Test Certificate', 'delta-marine-crane-load-test.pdf',
   'certificates/ccccccc1-0000-4000-8000-000000000001/seed-placeholder.pdf', 284512,
   'Delta Marine Services', 'PE-LIF-2026-0041', current_date - 6, current_date + 359,
   'aaaaaaa1-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111'),

  ('ccccccc1-0000-4000-8000-000000000002', gen_random_uuid(),
   'UT Weld Examination Report', 'horizon-loop4-ut-report.pdf',
   'certificates/ccccccc1-0000-4000-8000-000000000002/seed-placeholder.pdf', 512874,
   'Horizon Petrochemicals', 'PE-NDT-2026-0112', current_date - 3, current_date + 27,
   'aaaaaaa1-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111'),

  ('ccccccc1-0000-4000-8000-000000000003', gen_random_uuid(),
   'Lifting Accessories Register', 'nile-logistics-lifting-register.pdf',
   'certificates/ccccccc1-0000-4000-8000-000000000003/seed-placeholder.pdf', 148003,
   'Nile Logistics Group', 'PE-LIF-2025-0987', current_date - 400, current_date - 35,
   null, '22222222-2222-2222-2222-222222222222')
on conflict (id) do nothing;
