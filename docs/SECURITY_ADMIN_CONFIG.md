# Configuration Sécurité Admin (QARIS)

Ce document décrit la configuration attendue pour le flux admin désormais implémenté:

1. `admin/pre-login.html` (code d'accès mezzanine)
2. `admin/login.html` (auth Supabase + contrôle rôle `admin`)
3. `admin/dashboard.html` (zone protégée)
4. Notification Edge Function `notify-admin-login`

## 1) Variables côté front (`js/config.js`)

Vérifier dans `ADMIN_SECURITY_CONFIG`:

- `preLogin.enabled`: `true`
- `preLogin.accessCode`: changer la valeur par défaut avant production
- `auth.requiredRole`: `admin`
- `notifications.enabled`: `true`
- `notifications.edgeFunctionName`: `notify-admin-login`

## 2) Secrets Supabase (obligatoire)

Dans Supabase Dashboard > Project Settings > Edge Functions > Secrets:

- `RESEND_API_KEY` = clé API Resend

Optionnels:

- `ADMIN_ALERT_EMAIL` (défaut: `cabinetqaris@gmail.com`)
- `ADMIN_ALERT_FROM` (défaut: `Cabinet QARIS <onboarding@resend.dev>`)
- `ADMIN_LOGIN_LOG_TABLE` (défaut: `admin_login_attempts`)

## 3) SQL recommandé

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

Pour le rôle admin, le code cherche d'abord `profiles`, puis `admin_users`, et lit la colonne `role`.

## 4) Notes importantes

- Le pré-login est une couche d'obfuscation, pas un remplacement d'une vraie auth.
- Le contrôle d'accès réel reste Supabase + rôle admin.
- L'Edge Function est en `verify_jwt = true` (sécurisé): les appels sans session valide sont rejetés.

## 5) Upload image événements (Storage)

Le formulaire admin envoie les images dans le bucket Supabase:

- Nom bucket par défaut: `event-images`
- Configurable dans `js/config.js` > `ADMIN_SECURITY_CONFIG.catalog.storageBucket`

Vérifier côté Supabase Storage:

1. Bucket `event-images` existe
2. Policy d'upload autorisée pour les utilisateurs authentifiés admin
3. Policy de lecture publique (ou équivalent) si les images doivent être visibles sur le site public
