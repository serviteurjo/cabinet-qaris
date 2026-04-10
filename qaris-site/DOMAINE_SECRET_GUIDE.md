# Domaine Secret Admin - Guide Rapide

## Principe

Utiliser un sous-domaine discret pour l'accès admin:

- Site public: `https://www.ton-domaine.com`
- Admin: `https://secret-admin.ton-domaine.com/admin/pre-login.html`

Le code est identique, seule l'URL d'entrée admin change.

## Configuration DNS

Créer un enregistrement:

- Type: `CNAME`
- Nom: `secret-admin` (ou autre)
- Cible: ton domaine principal (ou cible fournie par ton hébergeur)

## Hébergeur

Ajouter le sous-domaine dans ton hébergeur (Vercel/Netlify/OVH/Hostinger), puis activer HTTPS.

## Recommandations

- Garder `/admin/*` avec `noindex, nofollow` (déjà fait).
- Ne jamais partager publiquement le lien admin.
- Changer le code pre-login avant mise en prod.
