-- ============================================================================
-- pioneers-egy :: row level security
-- ============================================================================
-- Role matrix
--
--                     admin     manager            inspector
--   profiles          CRUD      read all           read self
--   jobs              CRUD all  read all           CRUD own
--   job_tasks/photos  CRUD all  read all           CRUD own job's
--   certificates      CRUD all  read all + create  read all + create own
--   share links       CRUD all  CRUD               CRUD own
--
-- Reading a role means reading public.profiles, which is itself RLS-protected.
-- Doing that inside a profiles policy would recurse infinitely, so role lookups
-- go through SECURITY DEFINER helpers that bypass RLS. They are STABLE so
-- Postgres evaluates them once per statement rather than once per row.
--
-- ---------------------------------------------------------------------------
-- IMPORTANT: soft deletes cannot go through these policies
-- ---------------------------------------------------------------------------
-- `jobs` and `certificates` are soft-deleted by setting `deleted_at`, and their
-- SELECT policies below only expose rows where `deleted_at is null`.
--
-- PostgREST issues its UPDATE with a RETURNING clause, and Postgres applies
-- SELECT policies to returned rows. The instant `deleted_at` is set the row
-- stops satisfying the SELECT policy, so the statement fails with
-- "new row violates row-level security policy" — for the owner and for an
-- administrator alike. There is no combination of roles that makes it work.
--
-- Soft deletes are therefore performed with the service role in the relevant
-- server action (see deleteJob / deleteCertificate), which checks permission in
-- application code first. If you add another soft-deletable table, it needs the
-- same treatment — do not expect an ordinary UPDATE to work.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Deactivated accounts resolve to NULL, which fails every policy below.
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_role() = 'admin'
$$;

-- "Staff" = anyone who may see the whole company's data (admin or manager).
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_role() in ('admin', 'manager')
$$;

-- Any active account, regardless of role.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_role() is not null
$$;

revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_active_user() from public, anon;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_active_user() to authenticated;

-- ---------------------------------------------------------------------------
-- Ownership helper: may the current user write to this job?
-- ---------------------------------------------------------------------------

create or replace function public.can_write_job(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.jobs j
    where j.id = p_job_id
      and j.deleted_at is null
      and (j.created_by = (select auth.uid()) or public.is_admin())
  )
$$;

create or replace function public.can_read_job(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.jobs j
    where j.id = p_job_id
      and j.deleted_at is null
      and (j.created_by = (select auth.uid()) or public.is_staff())
  )
$$;

revoke execute on function public.can_write_job(uuid) from public, anon;
revoke execute on function public.can_read_job(uuid) from public, anon;
grant execute on function public.can_write_job(uuid) to authenticated;
grant execute on function public.can_read_job(uuid) to authenticated;

-- ===========================================================================
-- profiles
-- ===========================================================================

alter table public.profiles enable row level security;

-- A user can always read their own profile (needed to resolve their own role
-- in the UI); admins and managers can read the whole directory.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_staff());

-- Writes are admin-only. In practice the app routes these through
-- /api/admin/users with the service role so auth.users stays in sync, but the
-- policy is the real boundary.
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (public.is_admin());

create policy profiles_update on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy profiles_delete on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- ===========================================================================
-- jobs
-- ===========================================================================

alter table public.jobs enable row level security;

create policy jobs_select on public.jobs
  for select to authenticated
  using (
    deleted_at is null
    and (created_by = (select auth.uid()) or public.is_staff())
  );

-- You may only create jobs attributed to yourself.
create policy jobs_insert on public.jobs
  for insert to authenticated
  with check (
    public.is_active_user()
    and created_by = (select auth.uid())
  );

create policy jobs_update on public.jobs
  for update to authenticated
  using (
    deleted_at is null
    and (created_by = (select auth.uid()) or public.is_admin())
  )
  with check (created_by = (select auth.uid()) or public.is_admin());

create policy jobs_delete on public.jobs
  for delete to authenticated
  using (public.is_admin());

-- ===========================================================================
-- job_tasks
-- ===========================================================================

alter table public.job_tasks enable row level security;

create policy job_tasks_select on public.job_tasks
  for select to authenticated
  using (public.can_read_job(job_id));

create policy job_tasks_insert on public.job_tasks
  for insert to authenticated
  with check (public.can_write_job(job_id));

create policy job_tasks_update on public.job_tasks
  for update to authenticated
  using (public.can_write_job(job_id))
  with check (public.can_write_job(job_id));

create policy job_tasks_delete on public.job_tasks
  for delete to authenticated
  using (public.can_write_job(job_id));

-- ===========================================================================
-- task_photos
-- ===========================================================================

alter table public.task_photos enable row level security;

create policy task_photos_select on public.task_photos
  for select to authenticated
  using (
    exists (
      select 1 from public.job_tasks t
      where t.id = task_id and public.can_read_job(t.job_id)
    )
  );

create policy task_photos_insert on public.task_photos
  for insert to authenticated
  with check (
    exists (
      select 1 from public.job_tasks t
      where t.id = task_id and public.can_write_job(t.job_id)
    )
  );

create policy task_photos_update on public.task_photos
  for update to authenticated
  using (
    exists (
      select 1 from public.job_tasks t
      where t.id = task_id and public.can_write_job(t.job_id)
    )
  )
  with check (
    exists (
      select 1 from public.job_tasks t
      where t.id = task_id and public.can_write_job(t.job_id)
    )
  );

create policy task_photos_delete on public.task_photos
  for delete to authenticated
  using (
    exists (
      select 1 from public.job_tasks t
      where t.id = task_id and public.can_write_job(t.job_id)
    )
  );

-- ===========================================================================
-- certificates
--
-- Certificates are a company-wide register: every active employee can look one
-- up. Editing is restricted to the uploader (or an admin), deletion to admins.
-- ===========================================================================

alter table public.certificates enable row level security;

create policy certificates_select on public.certificates
  for select to authenticated
  using (deleted_at is null and public.is_active_user());

create policy certificates_insert on public.certificates
  for insert to authenticated
  with check (
    public.is_active_user()
    and uploaded_by = (select auth.uid())
  );

create policy certificates_update on public.certificates
  for update to authenticated
  using (
    deleted_at is null
    and (uploaded_by = (select auth.uid()) or public.is_admin())
  )
  with check (uploaded_by = (select auth.uid()) or public.is_admin());

create policy certificates_delete on public.certificates
  for delete to authenticated
  using (public.is_admin());

-- ===========================================================================
-- certificate_share_links
--
-- NOTE: there is deliberately no `anon` policy. The public /verify/[token]
-- route resolves tokens with the service role, so a token cannot be brute
-- forced or enumerated through the public API, and revocation is authoritative.
-- ===========================================================================

alter table public.certificate_share_links enable row level security;

create policy certificate_share_links_select on public.certificate_share_links
  for select to authenticated
  using (public.is_active_user());

create policy certificate_share_links_insert on public.certificate_share_links
  for insert to authenticated
  with check (
    public.is_active_user()
    and created_by = (select auth.uid())
  );

create policy certificate_share_links_update on public.certificate_share_links
  for update to authenticated
  using (created_by = (select auth.uid()) or public.is_staff())
  with check (created_by = (select auth.uid()) or public.is_staff());

create policy certificate_share_links_delete on public.certificate_share_links
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_admin());

-- ===========================================================================
-- certificate_access_log
--
-- Written only by the service role (the public verify route). Staff can read it
-- to see who downloaded a certificate.
-- ===========================================================================

alter table public.certificate_access_log enable row level security;

create policy certificate_access_log_select on public.certificate_access_log
  for select to authenticated
  using (public.is_active_user());
