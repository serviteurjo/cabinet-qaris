# 🚀 COMMANDES À EXÉCUTER — Cabinet QARIS Déploiement

## ✅ État Actuel

La branche `main` a 3 nouveaux commits prêts à pousser:

```bash
$ git log --oneline -3

adb1509 (HEAD -> main) docs: add comprehensive production audit and deployment checklist
afc3faf sitemap: update URLs to cabinetqaris.com, refresh lastmod to 2026-04-10, fix robots.txt
070e00a seofeat: upgrade canonicals to cabinetqaris.com, fix OG URLs, update JSON-LD schema with Calavi address
```

---

## 📝 ÉTAPE 1: Créer un Personal Access Token

Visitez: **https://github.com/settings/tokens**

1. Cliquer sur **"Generate new token"** → **"Generate new token (classic)"**
2. Donner un nom: `cabinet-qaris-push`
3. Sélectionner le scope: `repo` ✓ (accès complet aux repos)
4. Cliquer **"Generate token"**
5. **COPIER** le token généré (format: `ghp_xxxxxxxxxxxxx`)

⚠️ **Important**: Ce token ne s'affichera qu'une fois! Conservez-le ou régénérez-en un nouveau.

---

## 🔧 ÉTAPE 2: Pousser vers GitHub

### Option A: Push rapide (une seule fois)

Exécutez cette commande dans le terminal:

```bash
cd "/home/lokojosaphat/Téléchargements/Cabinet QARIS Site" && git push https://TON_PAT@github.com/serviteurjo/cabinet-qaris.git main
```

**⚠️ Remplacer `TON_PAT` par votre Personal Access Token réel!**

Exemple concret:
```bash
git push https://ghp_Q1W2E3R4T5Y6U7I8O9P0Q1W2E3R4T5Y@github.com/serviteurjo/cabinet-qaris.git main
```

### Option B: Configuration permanente (plus pratique)

Exécutez ces commandes une fois:

```bash
# 1. Configurer le credential helper
git config --global credential.helper store

# 2. Faire un push (demandera le token UNE FOIS)
cd "/home/lokojosaphat/Téléchargements/Cabinet QARIS Site"
git push https://TON_PAT@github.com/serviteurjo/cabinet-qaris.git main

# 3. À partir de là, les prochains pushes n'auront pas besoin du token:
git push origin main
```

---

## ✨ ÉTAPE 3: Vérifier le Push

Après le push, visitez: **https://github.com/serviteurjo/cabinet-qaris**

Vous devriez voir:
- ✅ 3 nouveaux commits dans l'historique
- ✅ Les fichiers modifiés (index.html, contact.html, etc.)
- ✅ Les fichiers de documentation (AUDIT_PRODUCTION.md, PRODUCTION_CHECKLIST.md)


---

## 🌐 ÉTAPE 4: Activer GitHub Pages

1. Allez sur: **https://github.com/serviteurjo/cabinet-qaris/settings/pages**
2. Sous **"Source"**: Sélectionner **"main branch"**
3. Cliquer **"Save"**
4. Attendre 30-60 secondes

Votre site sera accessible à:
```
https://serviteurjo.github.io/cabinet-qaris/
```

---

## 🎯 OPTIONAL: Domaine Custom

Si vous voulez utiliser `cabinetqaris.com` (ou votre domaine):

1. Allez sur les Settings du repo → Pages
2. Sous **"Custom domain"**: Entrer `cabinetqaris.com`
3. Cliquer Save
4. GitHub va générer un fichier `CNAME` automatiquement
5. Configurez vos DNS records (A records ou CNAME) chez votre hébergeur DNS

Voir: **https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site**

---

## 🔍 Résolution de Problèmes

### ❌ Erreur: "403 Forbidden"
**Solution**: Vérifier que votre Personal Access Token est correct

### ❌ Erreur: "Repository not found"
**Solution**: Vérifier l'URL GitHub: `github.com/serviteurjo/cabinet-qaris`

### ❌ Le site ne s'affiche pas
**Solution**: 
- Attendre 2-3 minutes après activation
- Vider le cache du navigateur (Ctrl+Shift+Delete)
- Vérifier Pages est activée: Settings → Pages

---

## 📚 Fichiers de Référence en Local

Après le push, consultez ces fichiers pour plus de détails:

```
/home/lokojosaphat/Téléchargements/Cabinet QARIS Site/
├── FINAL_SUMMARY.md              (Résumé complet de la mission)
├── PRODUCTION_CHECKLIST.md       (Checklist avant production)
├── AUDIT_PRODUCTION.md           (Audit technique détaillé)
├── GIT_PUSH_INSTRUCTIONS.md      (Ce fichier)
└── qaris-site/
    ├── index.html                (Canonical + SEO fixes)
    ├── contact.html              (Canonical + tel: fix)
    ├── a-propos.html             (Canonical + SEO)
    └── formations/index.html     (Canonical + SEO)
```

---

## 🎉 Après Déploiement

1. ✅ Tester le site sur: `https://serviteurjo.github.io/cabinet-qaris/`
2. ✅ Vérifier que tous les liens fonctionnent
3. ✅ Ajouter le sitemap à Google Search Console:
   - Aller sur: https://search.google.com/search-console
   - Ajouter le property: `https://serviteurjo.github.io/cabinet-qaris/`
   - Ajouter le sitemap: `sitemap.xml`

---

## 🚀 Déploiement Alternatif (Plus Simple)

Si vous préférez une autre plateforme:

### Vercel (Recommandé)
```bash
npm install -g vercel
cd "Cabinet QARIS Site/qaris-site"
vercel

# URL auto: https://cabinet-qaris.vercel.app
# Custom domain: https://cabinetqaris.com (configurable)
```

### Netlify
1. Aller sur: https://app.netlify.com
2. Drag & drop le dossier `qaris-site/`
3. Attendre le déploiement automatique

---

**Document généré**: Agent 9 — Cabinet QARIS Production Readiness  
**Status**: 🟢 PRÊT POUR PUSH  
**Timestamp**: 10 avril 2026
