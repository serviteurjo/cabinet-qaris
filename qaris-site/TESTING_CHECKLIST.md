# Testing Checklist - Admin QARIS

## A. Pré-login

- [ ] `admin/pre-login.html` s'affiche correctement
- [ ] Mauvais code => erreur affichée, pas de redirection
- [ ] Bon code => redirection vers `admin/login.html`

## B. Authentification

- [ ] Accès direct à `admin/login.html` sans pré-login => redirection vers `pre-login.html`
- [ ] Compte non-admin => accès refusé
- [ ] Compte admin => redirection vers `dashboard.html`

## C. Dashboard

- [ ] Rafraîchir `dashboard.html` garde la session admin valide
- [ ] Bouton déconnexion fonctionne
- [ ] Après déconnexion => retour `pre-login.html`
- [ ] Upload image événement fonctionne (fichier image → URL stockée)
- [ ] Bouton `Actualiser le catalogue` synchronise bien la publication (`status` ↔ `is_published`)

## D. Notifications

- [ ] Fonction `notify-admin-login` déployée
- [ ] Connexion admin réussie envoie un email
- [ ] Vérifier logs Supabase Functions en cas d'erreur

## E. Données

- [ ] Inscriptions visibles dans l'admin
- [ ] Demandes d'info visibles
- [ ] Messages contact visibles
- [ ] Ajout/modification/suppression événement sans erreur
