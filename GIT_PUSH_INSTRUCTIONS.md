# 🚀 INSTRUCTIONS POUR POUSSER LE CODE SUR GITHUB

## Vue d'ensemble des commits

Vous avez 3 commits prêts à pousser:

```
adb1509 (HEAD -> main) docs: add comprehensive production audit and deployment checklist
afc3faf sitemap: update URLs to cabinetqaris.com, refresh lastmod to 2026-04-10
070e00a seofeat: upgrade canonicals to cabinetqaris.com, fix OG URLs, update JSON-LD schema
```

## Commande à copier-coller dans le terminal

```bash
# Copier-coller cette commande (remplacer TON_TOKEN par ton PAT GitHub)
git push https://TON_TOKEN@github.com/serviteurjo/cabinet-qaris.git main
```

## Où trouver ton Personal Access Token (PAT)

1. Va sur: https://github.com/settings/tokens
2. Clique sur "Generate new token" → "Generate new token (classic)"
3. Donne un nom: `cabinet-qaris-push`
4. Sélectionne les scopes: `repo` (accès complet)
5. Clique "Generate token" et **copie le code** (exemple: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

## Commande complète (exemple)

```bash
git push https://ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx@github.com/serviteurjo/cabinet-qaris.git main
```

---

## Après le push

Une fois le push terminé:
1. Aller sur https://github.com/serviteurjo/cabinet-qaris
2. Vérifier que les commits apparaissent
3. Activer GitHub Pages: Settings → Pages → Deploy from main branch
4. URL du site: https://serviteurjo.github.io/cabinet-qaris/

---

## Alternative: Configurer credential helper (plus sûr pour les futurs pushes)

```bash
# 1. Configure le credential helper pour ne pas répéter le token
git config --global credential.helper store

# 2. Fais un push (qui demandera le token une fois)
git push https://TON_TOKEN@github.com/serviteurjo/cabinet-qaris.git main

# 3. Désormais, les prochains pushes ne demanderont plus le token
git push origin main  # (sans besoin du token)
```

---

Document généré: Agent 9 - Cabinet QARIS Production Readiness  
Status: 🟢 PRÊT POUR PUSH
