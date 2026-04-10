# Cabinet QARIS — Site Web

Site web statique et moderne du Cabinet QARIS — accompagnement couples, familles, jeunes et formations.

## 📋 Description

Le projet **Cabinet QARIS** est un site web présentant les services d'accompagnement et de formations du Cabinet QARIS. Il inclut :

- **Pages publiques** : Accueil, À propos, Événements/Formations, Contact
- **Admin panel** : Tableau de bord d'authentification et gestion (à Supabase)
- **Backend** : Intégration optionnelle avec Supabase pour les formulaires et authentification

## 🗂️ Structure du Projet

```
qaris-site/
├── index.html                    # Page d'accueil
├── a-propos.html                 # À propos du Cabinet
├── contact.html                  # Formulaire de contact
├── formations/
│   └── index.html               # Événements et formations
├── admin/
│   ├── pre-login.html           # Pré-vérification d'accès admin (code)
│   ├── login.html               # Page de connexion admin
│   └── dashboard.html           # Tableau de bord admin
├── css/
│   └── styles.css               # Feuille de styles principale
├── js/
│   ├── config.js                # Configuration (Supabase credentials à configurer)
│   ├── supabaseClient.js         # Client Supabase (initialisation ESM)
│   ├── contact.js               # Gestion du formulaire contact
│   ├── registrations.js          # Gestion des inscriptions aux événements
│   ├── trainings.js             # Gestion des événements/formations
│   ├── pre-login.js             # Logique du pré-login admin
│   ├── adminAuth.js             # Authentification admin
│   └── adminDashboard.js        # Logique du dashboard admin
├── assets/
│   ├── images/                  # Images du site (logos, photos, etc.)
│   └── ressources/              # Ressources (branding, mockups)
├── robots.txt                    # Configuration SEO (moteurs de recherche)
├── sitemap.xml                   # Plan du site XML
└── README.md                     # Ce fichier
```

## 🚀 Installation Locale

### Prérequis

- Navigateur moderne (Chrome, Firefox, Safari, Edge)
- Éditeur de code (VS Code recommandé)
- Extension **Live Server** ou similaire pour servir les fichiers localement

### Étapes

1. **Cloner/Télécharger** le projet

```bash
git clone <URL_REPO> qaris-site
cd qaris-site
```

2. **Lancer en local** avec Live Server (VS Code)

- Installer l'extension [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)
- Clic droit sur `index.html` → "Open with Live Server"
- Le navigateur devrait s'ouvrir sur `http://127.0.0.1:5500`

**Ou** avec un autre serveur HTTP :

```bash
# Python 3
python -m http.server 8000

# Node.js (avec http-server)
npx http-server -p 8000
```

Puis accéder à `http://localhost:8000`

## ⚙️ Configuration

### Supabase (Optionnel)

Le site fonctionne **sans Supabase en mode fallback** (simulations locales). Pour activer les vraies soumissions :

1. **Créer un compte** sur [supabase.io](https://supabase.io)
2. **Créer un projet** et récupérer :
   - `URL du projet` (ex: `https://xxx.supabase.co`)
   - `Clé publique anon` (ex: `eyJhbGc...`)
3. **Mettre à jour** `js/config.js` :

```javascript
export const SUPABASE_URL = 'https://votre-projet.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'votre-cle-anon-publique';
```

**⚠️ IMPORTANT** : Ne commitez JAMAIS de vraies clés dans Git. Utilisez `.env` ou variables d'environnement en production.

### Tables Supabase Requises

Si vous activez Supabase, créer les tables suivantes :

```sql
-- Formulaires de contact
CREATE TABLE contact_messages (
  id BIGSERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  consent BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inscriptions aux événements
CREATE TABLE registrations (
  id BIGSERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  event_id TEXT,
  event_type TEXT,
  consent BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Demandes d'information
CREATE TABLE info_requests (
  id BIGSERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  event_id TEXT,
  event_type TEXT,
  consent BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Formations/événements
CREATE TABLE trainings (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  location TEXT,
  max_participants INT,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profils utilisateurs (pour contrôle d'accès admin)
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 📖 Utilisation

### Pages Principales

- **Accueil** (`index.html`) : Présentation et services du Cabinet
- **À propos** (`a-propos.html`) : Valeurs, approche et équipe
- **Événements** (`formations/index.html`) : Formations et ateliers proposés
- **Contact** (`contact.html`) : Formulaire de contact et informations

### Admin (Panel Interne)

- **Pré-login** (`admin/pre-login.html`) : Étape de vérification avant login
- **Login** (`admin/login.html`) : Authentification admin (Supabase + rôle)
- **Dashboard** (`admin/dashboard.html`) : Gestion des inscriptions et demandes (avec Supabase)

## 🌐 Déploiement

### Services Recommandés

- [Netlify](https://netlify.com) — Déploiement facile (Git + formulaires Netlify)
- [Vercel](https://vercel.com) — Optimisé pour projets web modernes
- [GitHub Pages](https://pages.github.com) — Gratuit, hébergement Git natif
- [Firebase Hosting](https://firebase.google.com/products/hosting) — Avec intégration Supabase possible

### Checklist avant Déploiement

- [ ] Vérifier que `robots.txt` et `sitemap.xml` sont corrects
- [ ] Confirmer les **URLs Supabase en production** dans `config.js`
- [ ] Tester tous les formulaires en mode fallback et mode Supabase
- [ ] Vérifier responsive design (mobile, tablette, desktop)
- [ ] Évaluer performance (images optimisées, CSS/JS minifiés si nécessaire)
- [ ] Tester console navigateur (pas d'erreurs, secrets non exposés)

## 🔐 Sécurité

- ✅ **Clés publiques uniquement** : Seule la clé `anonKey` est utilisée (pas de clé privée)
- ✅ **RLS Supabase** : Row-Level Security activée sur les tables
- ✅ **Pas de secrets en Git** : Utiliser `.env` ou secrets déployeur
- ✅ **HTTPS requis** : En production, toujours utiliser HTTPS

## 📝 Git Workflow

### Branches

- `main` — Production prête (déploiement)
- `develop` — Développement (si applicable)

### Commits

Format conseillé :

```bash
git commit -m "type(scope): description courte

- Détail 1
- Détail 2"
```

Exemples :

```bash
git commit -m "fix: corriger lien cassé formations page"
git commit -m "feat: ajouter section testimonies"
git commit -m "chore: mettre à jour config Supabase"
```

## 🐛 Dépannage

### Console affiche "Supabase not configured"

- Normal en mode développement sans Supabase configuré
- Les formulaires utilisent le mode fallback (simulation)
- Configurer Supabase dans `js/config.js` pour activer

### Images ne chargent pas

- Vérifier que les chemins dans HTML commencent par `assets/images/`
- Vérifier les permissions des dossiers
- Recharger la page (Ctrl+Shift+R / Cmd+Shift+R)

### Formulaires ne s'envoient pas

- Vérifier la console navigateur (F12 → Console)
- Vérifier que Supabase est configuré (ou mode fallback fonctionne)
- Tester avec un serveur HTTP local (pas `file://`)

## 📦 Dépendances

- **Frontend** : HTML5, CSS3, ES6 JavaScript (aucun framework)
- **Backend optionnel** : [Supabase](https://supabase.io) (SDK ESM via CDN)
- **Icons** : [Font Awesome 6.5.0](https://fontawesome.com) (via CDN)

## 📄 Licence

À définir (à compléter selon licence du projet)

## 📧 Contact

Pour des questions sur le site web :
- **Email** : contact@qaris.fr
- **Téléphone** : +33 1 23 45 67 89

---

**Version du projet** : 1.0.0  
**Dernière mise à jour** : Février 2026
