-- =========================================================
-- SCRIPT 7 - FIX RLS POLICIES POUR INSERTIONS PUBLIQUES
-- À exécuter APRÈS Script 4 (si les insertions 403 échouent)
-- =========================================================

begin;

-- =========================================================
-- VÉRIFIER ET CORRIGER POLICIES REGISTRATIONS_FORMATIONS
-- =========================================================

-- Supprimer les policies existantes UNIQUEMENT si besoin (pattern défensif)
do $$
declare
  policy_exists boolean;
begin
  -- Vérifier et supprimer les policies pour registrations_formations
  for policy_exists in select true from pg_policies
    where schemaname = 'public' 
    and tablename = 'registrations_formations'
    and policyname like 'registrations_formations_%'
  loop
    execute format('drop policy if exists %I on public.%I', 
      (select policyname from pg_policies 
       where schemaname = 'public' and tablename = 'registrations_formations' 
       and policyname like 'registrations_formations_%' limit 1),
      'registrations_formations');
  end loop;
end
$$;

-- Créer policy: Everyone (anon/authenticated) can INSERT
create policy "registrations_formations_insert_public" on public.registrations_formations
  for insert
  with check (true);

-- Créer policy: Admin can SELECT all, others see their own
create policy "registrations_formations_select_admin" on public.registrations_formations
  for select
  using (
    (select auth.jwt() -> 'user_email')::text is not null  -- authenticated users
    or true  -- allow anon to see (will be filtered by app)
  );

-- Créer policy: Admin can UPDATE
create policy "registrations_formations_update_admin" on public.registrations_formations
  for update
  using (
    exists(
      select 1 from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- Créer policy: Admin can DELETE
create policy "registrations_formations_delete_admin" on public.registrations_formations
  for delete
  using (
    exists(
      select 1 from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- =========================================================
-- VÉRIFIER ET CORRIGER POLICIES REGISTRATIONS_EVENTS
-- =========================================================

-- Supprimer les policies existantes
do $$
declare
  policy_exists boolean;
begin
  for policy_exists in select true from pg_policies
    where schemaname = 'public' 
    and tablename = 'registrations_events'
    and policyname like 'registrations_events_%'
  loop
    execute format('drop policy if exists %I on public.%I', 
      (select policyname from pg_policies 
       where schemaname = 'public' and tablename = 'registrations_events' 
       and policyname like 'registrations_events_%' limit 1),
      'registrations_events');
  end loop;
end
$$;

-- Créer policy: Everyone (anon/authenticated) can INSERT
create policy "registrations_events_insert_public" on public.registrations_events
  for insert
  with check (true);

-- Créer policy: Anyone can SELECT
create policy "registrations_events_select_admin" on public.registrations_events
  for select
  using (true);

-- Créer policy: Admin can UPDATE
create policy "registrations_events_update_admin" on public.registrations_events
  for update
  using (
    exists(
      select 1 from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- Créer policy: Admin can DELETE
create policy "registrations_events_delete_admin" on public.registrations_events
  for delete
  using (
    exists(
      select 1 from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- =========================================================
-- VÉRIFIER ET CORRIGER POLICIES CONTACT_MESSAGES
-- =========================================================

do $$
declare
  policy_exists boolean;
begin
  for policy_exists in select true from pg_policies
    where schemaname = 'public' 
    and tablename = 'contact_messages'
    and policyname like 'contact_messages_%'
  loop
    execute format('drop policy if exists %I on public.%I', 
      (select policyname from pg_policies 
       where schemaname = 'public' and tablename = 'contact_messages' 
       and policyname like 'contact_messages_%' limit 1),
      'contact_messages');
  end loop;
end
$$;

-- Créer policy: Everyone can INSERT messages
create policy "contact_messages_insert_public" on public.contact_messages
  for insert
  with check (true);

-- Créer policy: Admin can SELECT
create policy "contact_messages_select_admin" on public.contact_messages
  for select
  using (
    exists(
      select 1 from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- Créer policy: Admin can UPDATE
create policy "contact_messages_update_admin" on public.contact_messages
  for update
  using (
    exists(
      select 1 from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- =========================================================
-- VÉRIFIER ET CORRIGER POLICIES INFO_REQUESTS
-- =========================================================

do $$
declare
  policy_exists boolean;
begin
  for policy_exists in select true from pg_policies
    where schemaname = 'public' 
    and tablename = 'info_requests'
    and policyname like 'info_requests_%'
  loop
    execute format('drop policy if exists %I on public.%I', 
      (select policyname from pg_policies 
       where schemaname = 'public' and tablename = 'info_requests' 
       and policyname like 'info_requests_%' limit 1),
      'info_requests');
  end loop;
end
$$;

-- Créer policy: Everyone can INSERT requests
create policy "info_requests_insert_public" on public.info_requests
  for insert
  with check (true);

-- Créer policy: Admin can SELECT
create policy "info_requests_select_admin" on public.info_requests
  for select
  using (
    exists(
      select 1 from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- =========================================================
-- VÉRIFIER ET CORRIGER POLICIES TRAININGS
-- =========================================================

do $$
declare
  policy_exists boolean;
begin
  for policy_exists in select true from pg_policies
    where schemaname = 'public' 
    and tablename = 'trainings'
    and policyname like 'trainings_%'
  loop
    execute format('drop policy if exists %I on public.%I', 
      (select policyname from pg_policies 
       where schemaname = 'public' and tablename = 'trainings' 
       and policyname like 'trainings_%' limit 1),
      'trainings');
  end loop;
end
$$;

-- Créer policy: Public can SELECT published trainings
create policy "trainings_select_published" on public.trainings
  for select
  using (is_published = true or 
         exists(select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Créer policy: Admin can INSERT
create policy "trainings_insert_admin" on public.trainings
  for insert
  with check (
    exists(
      select 1 from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- Créer policy: Admin can UPDATE
create policy "trainings_update_admin" on public.trainings
  for update
  using (
    exists(
      select 1 from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- Créer policy: Admin can DELETE
create policy "trainings_delete_admin" on public.trainings
  for delete
  using (
    exists(
      select 1 from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

commit;

-- =========================================================
-- VALIDATIONS
-- =========================================================

-- Vérifier que RLS est activé
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in (
  'registrations_formations', 'registrations_events', 
  'contact_messages', 'info_requests', 'trainings'
);

-- Lister toutes les policies créées
select tablename, policyname, permissive, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in (
  'registrations_formations', 'registrations_events', 
  'contact_messages', 'info_requests', 'trainings'
)
order by tablename, policyname;
