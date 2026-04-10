-- =========================================================
-- SCRIPT 6 - TABLES, COLUMNS, TRIGGERS, INDEXES, MIGRATION
-- Idempotent, defensive, production-ready
-- À exécuter APRÈS Script 4 (RLS + Policies + Storage)
-- =========================================================

begin;

-- =========================================================
-- ÉTAPE 1: CRÉER/ALTÉRER TABLES MÉTIER
-- =========================================================

-- A) Créer registrations_formations si absent
create table if not exists public.registrations_formations (
  id bigserial primary key,
  first_name text,
  last_name text,
  email text,
  phone text,
  contact_info text,
  message text,
  event_id text,
  event_type text default 'formation',
  event_title text,
  formation text,
  amount numeric(12,2) default 0,
  is_free boolean default false,
  payment_required boolean default true,
  payment_reference text,
  payment_status text default 'pending_verification',
  status text default 'pending',
  admin_review_status text default 'pending',
  consent boolean default false,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- B) Créer registrations_events si absent
create table if not exists public.registrations_events (
  id bigserial primary key,
  first_name text,
  last_name text,
  email text,
  phone text,
  contact_info text,
  message text,
  event_id text,
  event_type text default 'evenement',
  event_title text,
  event text,
  amount numeric(12,2) default 0,
  is_free boolean default false,
  payment_required boolean default true,
  payment_reference text,
  payment_status text default 'pending_verification',
  status text default 'pending',
  admin_review_status text default 'pending',
  consent boolean default false,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- C) Ajouter colonnes manquantes à contact_messages
alter table if exists public.contact_messages add column if not exists processed_at timestamptz;

-- D) Ajouter colonnes manquantes à info_requests
alter table if exists public.info_requests add column if not exists status text default 'pending';

-- E) Ajouter colonnes manquantes à trainings
alter table if exists public.trainings add column if not exists start_date date;
alter table if exists public.trainings add column if not exists end_date date;
alter table if exists public.trainings add column if not exists type text;
alter table if exists public.trainings add column if not exists status text default 'active';

-- =========================================================
-- ÉTAPE 2: CRÉER FONCTION TRIGGER set_updated_at()
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' then
    new.updated_at = now();
    return new;
  end if;
  return new;
end;
$$;

-- =========================================================
-- ÉTAPE 3: AJOUTER TRIGGERS updated_at (CREATE IF NOT EXISTS)
-- =========================================================

do $$
declare
  tbl text;
  trg_exists boolean;
begin
  for tbl in select unnest(ARRAY[
    'registrations_formations', 'registrations_events',
    'contact_messages', 'info_requests', 'trainings'
  ]::text[]) loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;

    select exists(
      select 1 from pg_trigger t
      join pg_class c on t.tgrelid = c.oid
      join pg_namespace n on c.relnamespace = n.oid
      where n.nspname = 'public'
        and c.relname = tbl
        and t.tgname = ('trg_' || tbl || '_updated_at')
    ) into trg_exists;

    if not trg_exists then
      execute format(
        'create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
        tbl, tbl
      );
    end if;
  end loop;
end
$$;

-- =========================================================
-- ÉTAPE 4: CRÉER INDEXES PERFORMANCE
-- =========================================================

do $$
declare
  rec record;
  idx_exists boolean;
begin
  for rec in select * from (values
    ('registrations_formations', 'idx_registrations_formations_created_at', 'created_at desc'),
    ('registrations_formations', 'idx_registrations_formations_status', 'status'),
    ('registrations_formations', 'idx_registrations_formations_payment_status', 'payment_status'),
    
    ('registrations_events', 'idx_registrations_events_created_at', 'created_at desc'),
    ('registrations_events', 'idx_registrations_events_status', 'status'),
    ('registrations_events', 'idx_registrations_events_payment_status', 'payment_status'),
    
    ('contact_messages', 'idx_contact_messages_created_at', 'created_at desc'),
    ('contact_messages', 'idx_contact_messages_status', 'status'),
    
    ('info_requests', 'idx_info_requests_created_at', 'created_at desc'),
    
    ('trainings', 'idx_trainings_is_published_created_at', 'is_published, created_at desc')
  ) as t(tbl, idxname, col) loop
    if to_regclass('public.' || rec.tbl) is null then
      continue;
    end if;

    select exists (
      select 1 from pg_indexes
      where schemaname = 'public' and indexname = rec.idxname
    ) into idx_exists;

    if not idx_exists then
      execute format('create index %I on public.%I (%s)', rec.idxname, rec.tbl, rec.col);
    end if;
  end loop;
end
$$;

-- =========================================================
-- ÉTAPE 5: MIGRATION CONSERVATIVE DES DONNÉES LEGACY
-- =========================================================

do $$
declare
  has_legacy boolean;
  form_count bigint := 0;
  event_count bigint := 0;
  has_amount_col boolean;
  has_payment_status_col boolean;
  has_status_col boolean;
  has_consent_col boolean;
  has_created_at_col boolean;
  has_updated_at_col boolean;
begin
  -- Vérifier si legacy table existe
  has_legacy := to_regclass('public.registrations') is not null;
  if not has_legacy then
    raise notice 'No legacy table [public.registrations] found — skipping migration.';
    return;
  end if;

  -- Vérifier quelles colonnes existent dans la table legacy
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='registrations' and column_name='amount')
    into has_amount_col;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='registrations' and column_name='payment_status')
    into has_payment_status_col;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='registrations' and column_name='status')
    into has_status_col;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='registrations' and column_name='consent')
    into has_consent_col;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='registrations' and column_name='created_at')
    into has_created_at_col;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='registrations' and column_name='updated_at')
    into has_updated_at_col;

  raise notice 'Legacy columns: amount=%, payment_status=%, status=%, consent=%, created_at=%, updated_at=%',
    has_amount_col, has_payment_status_col, has_status_col, has_consent_col, has_created_at_col, has_updated_at_col;

  -- Compter les lignes existantes dans les tables cibles
  if to_regclass('public.registrations_formations') is not null then
    select count(*) into form_count from public.registrations_formations;
  end if;
  if to_regclass('public.registrations_events') is not null then
    select count(*) into event_count from public.registrations_events;
  end if;

  raise notice 'Migration legacy: existing registrations_formations=%, registrations_events=%', form_count, event_count;

  -- Si registrations_formations vide, copier formations depuis legacy
  if form_count = 0 and to_regclass('public.registrations_formations') is not null then
    declare
      sql_migrations text;
    begin
      -- Construire SELECT dynamique selon colonnes disponibles
      sql_migrations := 'insert into public.registrations_formations ('
        || 'first_name, last_name, email, phone, event_id, event_type, amount, payment_status, status, consent, created_at, updated_at'
        || ') select '
        || 'first_name, last_name, email, phone, event_id, event_type, '
        || (case when has_amount_col then 'amount' else '0' end) || '::numeric(12,2), '
        || (case when has_payment_status_col then 'payment_status' else '''pending_verification''' end) || ', '
        || (case when has_status_col then 'status' else '''pending''' end) || ', '
        || (case when has_consent_col then 'consent' else 'false' end) || ', '
        || (case when has_created_at_col then 'created_at' else 'now()' end) || ', '
        || (case when has_updated_at_col then 'updated_at' else 'now()' end)
        || ' from public.registrations r '
        || 'where lower(coalesce(r.event_type,'''')) in (''formation'',''formations'',''atelier'',''training'',''cours'')';
      
      execute sql_migrations;
      get diagnostics form_count = row_count;
      raise notice 'Migrated % rows to registrations_formations', form_count;
    end;
  end if;

  -- Si registrations_events vide, copier events depuis legacy
  if event_count = 0 and to_regclass('public.registrations_events') is not null then
    declare
      sql_migrations text;
    begin
      -- Construire SELECT dynamique selon colonnes disponibles
      sql_migrations := 'insert into public.registrations_events ('
        || 'first_name, last_name, email, phone, event_id, event_type, amount, payment_status, status, consent, created_at, updated_at'
        || ') select '
        || 'first_name, last_name, email, phone, event_id, event_type, '
        || (case when has_amount_col then 'amount' else '0' end) || '::numeric(12,2), '
        || (case when has_payment_status_col then 'payment_status' else '''pending_verification''' end) || ', '
        || (case when has_status_col then 'status' else '''pending''' end) || ', '
        || (case when has_consent_col then 'consent' else 'false' end) || ', '
        || (case when has_created_at_col then 'created_at' else 'now()' end) || ', '
        || (case when has_updated_at_col then 'updated_at' else 'now()' end)
        || ' from public.registrations r '
        || 'where lower(coalesce(r.event_type,'''')) in (''event'',''events'',''evenement'',''événement'',''évènements'')';
      
      execute sql_migrations;
      get diagnostics event_count = row_count;
      raise notice 'Migrated % rows to registrations_events', event_count;
    end;
  end if;

  raise notice 'Migration legacy complete.';
end
$$;

-- =========================================================
-- ÉTAPE 6: CRÉER VUE ADMIN SUMMARY (ROBUSTE)
-- =========================================================

do $$
declare
  has_form boolean := to_regclass('public.registrations_formations') is not null;
  has_event boolean := to_regclass('public.registrations_events') is not null;
  sql text;
begin
  -- Si aucune table source, créer vue vide
  if not has_form and not has_event then
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on c.relnamespace = n.oid
      where n.nspname = 'public' and c.relname = 'admin_registrations_summary'
    ) then
      execute 'create view admin_registrations_summary as '
        || 'select null::text as event_type, 0::bigint as last_30_days, '
        || '0::bigint as total_count, 0::bigint as confirmed_count '
        || 'where false';
    end if;
    return;
  end if;

  -- Construire requête dynamique
  sql := 'select coalesce(event_type, ''unknown'') as event_type, '
       || 'count(*) filter (where created_at > now() - interval ''30 days'') as last_30_days, '
       || 'count(*) as total_count, '
       || 'count(*) filter (where status = ''confirmed'') as confirmed_count '
       || 'from (';

  if has_form then
    sql := sql || 'select event_type, status, created_at from public.registrations_formations ';
  end if;

  if has_form and has_event then
    sql := sql || 'union all ';
  end if;

  if has_event then
    sql := sql || 'select event_type, status, created_at from public.registrations_events ';
  end if;

  sql := sql || ') s group by event_type';

  -- Créer ou remplacer vue
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on c.relnamespace = n.oid
    where n.nspname = 'public' and c.relname = 'admin_registrations_summary'
  ) then
    execute 'create view admin_registrations_summary as ' || sql;
    raise notice 'Created view admin_registrations_summary';
  else
    execute 'drop view if exists admin_registrations_summary';
    execute 'create view admin_registrations_summary as ' || sql;
    raise notice 'Recreated view admin_registrations_summary';
  end if;
end
$$;

commit;

-- =========================================================
-- ÉTAPE 7: VALIDATIONS POST-MIGRATION
-- =========================================================

-- Vérifier tables créées
select tablename as table_name, 'OK' as status
from pg_tables
where schemaname = 'public' and tablename in (
  'registrations_formations', 'registrations_events', 'contact_messages', 'info_requests', 'trainings'
)
order by tablename;

-- Vérifier triggers présents
select c.relname as table_name, t.tgname as trigger_name
from pg_trigger t
join pg_class c on t.tgrelid = c.oid
join pg_namespace n on c.relnamespace = n.oid
where n.nspname = 'public' and (t.tgname like 'trg_%_updated_at' or t.tgname like 'trg_%')
order by c.relname, t.tgname;

-- Vérifier indexes créés
select indexname, tablename
from pg_indexes
where schemaname = 'public' and indexname like 'idx_%'
order by tablename, indexname;

-- Compter migrations effectuées
select 'registrations_formations' as table_name, count(*) as rows
from public.registrations_formations
union all
select 'registrations_events', count(*) from public.registrations_events
union all
select 'registrations (legacy)', count(*) from public.registrations
union all
select 'contact_messages', count(*) from public.contact_messages
union all
select 'info_requests', count(*) from public.info_requests
union all
select 'trainings', count(*) from public.trainings;

-- Vérifier structure registrations_formations
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'registrations_formations'
order by ordinal_position;

-- Vérifier structure registrations_events
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'registrations_events'
order by ordinal_position;

-- Vérifier la vue admin_registrations_summary
select table_schema, table_name, 'OK' as view_status
from information_schema.views
where table_schema = 'public' and table_name = 'admin_registrations_summary';
