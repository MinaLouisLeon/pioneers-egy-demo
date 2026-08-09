-- ============================================================================
-- pioneers-egy :: auth.users -> public.profiles synchronisation
-- ============================================================================
-- Accounts are created exclusively by an admin through /api/admin/users, which
-- calls auth.admin.inviteUserByEmail() with { full_name, role, phone } in the
-- user metadata. These triggers turn that into a profiles row and keep email
-- in sync afterwards.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
  v_raw_role text;
begin
  v_raw_role := new.raw_user_meta_data ->> 'role';

  -- Never cast unvalidated metadata straight to the enum: a bad value would
  -- raise and abort the whole signup. Unknown/absent roles fall back to the
  -- least-privileged role.
  if v_raw_role in ('admin', 'manager', 'inspector') then
    v_role := v_raw_role::public.user_role;
  else
    v_role := 'inspector';
  end if;

  insert into public.profiles (id, email, full_name, role, phone)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    v_role,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Keep profiles.email aligned when a user changes their address.
-- ---------------------------------------------------------------------------

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = new.email
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_change on auth.users;
create trigger on_auth_user_email_change
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();
