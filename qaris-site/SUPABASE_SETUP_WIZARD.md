# Supabase Setup Wizard (Option Recommandée)

Objectif: activer les notifications email admin via Edge Function sans casser le projet.

## Prérequis

- Projet Supabase existant
- Compte Resend + clé API
- `project ref`: `wnfvubxnynlhwifanicl`

## Étape 1: Secrets

Dans Supabase Dashboard > Settings > Edge Functions > Secrets:

1. `RESEND_API_KEY`
2. (optionnel) `ADMIN_ALERT_EMAIL`
3. (optionnel) `ADMIN_ALERT_FROM`

## Étape 2: Table de logs

Exécuter dans SQL Editor:

```sql
create table if not exists public.admin_login_attempts (
  id bigserial primary key,
  email text not null,
  success boolean not null default false,
  reason text,
  attempted_at timestamptz not null default now(),
  user_agent text,
  pathname text,
  created_at timestamptz not null default now()
);
```

## Étape 3: Déployer l'Edge Function

Depuis la racine du projet:

```bash
npx --yes supabase functions deploy notify-admin-login --project-ref wnfvubxnynlhwifanicl
```

Si non connecté:

```bash
npx --yes supabase login
```

## Étape 4: Vérifier le rôle admin

Ton utilisateur doit avoir `role = 'admin'` dans `profiles` (ou `admin_users`).

Exemple:

```sql
update public.profiles
set role = 'admin'
where email = 'votre-email-admin@exemple.com';
```

## Étape 5: Test rapide

1. Ouvrir `/admin/pre-login.html`
2. Entrer le code d'accès
3. Se connecter avec un compte admin
4. Vérifier réception email d'alerte
