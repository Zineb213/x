# Integration Summary — eduplatform (PFE)

Bref aperçu pour comprendre et relier les pièces du projet.

## Vue d'ensemble
- Backend: `pfe-_Adil-main/backend` — Express + PostgreSQL (pg). Entrée principale: `server.js`.
- Frontend: `pfe-_Adil-main/frontend` — React (CRA). Principaux services: `src/services/api.js`, `src/services/authService.js`.
- Database: schema dans `pfe-_Adil-main/schema_full.sql` (table `users`, `schools`, etc.).

## Points d'entrée et composants clés

- Backend
  - `server.js`: configuration d'Express, middleware sécurité, routes et démarrage serveur.
  - `config/database.js`: Pool PG et fonctions `query`, `transaction`, `testConnection`.
  - `routes/`: regroupement des routes exposées (auth, admin, formateur, etudiant, resources, posts, chat, communities, satisfaction, ...).
  - `controllers/`: logique des endpoints (e.g. `authController.js` pour `/api/auth/*`).
  - `models/`: accès à la BDD (e.g. `User.js`, `StudentRegistration.js`).
  - `services/`: logique métier (e.g. `authService.js`, `schoolLevelService.js`, `googleAuthService.js`).
  - `middlewares/`: auth, validation, error handling, rate limiting.

- Frontend
  - `src/services/api.js`: instance Axios configurée (utilise `REACT_APP_API_URL`).
  - `src/services/authService.js`: wrapper des appels d'authentification et gestion `localStorage`.
  - `src/pages/...`: pages par rôle (admin, formateur, etudiant, super-admin).

## Variables d'environnement importantes
- Backend `.env` (ex: `pfe-_Adil-main/backend/.env`):
  - `PORT` (default 5000)
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
  - `JWT_SECRET` (nécessaire au démarrage)
  - `FRONTEND_URL` (optionnel, CORS)

- Frontend `.env` (ex: `pfe-_Adil-main/frontend/.env`):
  - `REACT_APP_API_URL` (ex: `http://localhost:5000/api`)

## Auth & user flows (résumé)
- Login:
  - Frontend envoie POST `/api/auth/login` avec `{ identifier, password }` (`identifier` = matricule ou email).
  - `authController.login` appelle `authService.loginWithMatricule`.
  - `authService` recherche l'utilisateur (`User.findByMatricule` puis `findByEmail`), vérifie le mot de passe, applique règles d'école (suspension/paiement), met à jour `last_login` et renvoie JWT + user.

- Student registration:
  - Public: POST `/api/auth/student-register` → `authController.studentRegister` → crée une `StudentRegistration` en attente d'approbation.

## Base de données — éléments importants
- Table `users`: colonnes clés: `id`, `matricule`, `email`, `password_hash`, `role_global`, `niveau`, `is_active`, `school_id`.
- Table `schools`: logique de suspension et `payment_status` utilisée par `authService`.
- Seed/demo: `schema_full.sql` contient comptes demo (SUPER_ADMIN, ADMIN) et d'autres utilisateurs.

## Mapping PlantUML sequences → code
Le fichier `sequences_eduplatform.puml` contient séquences. Correspondances typiques:

- Login (sequence):
  - Frontend: `src/services/authService.js::login`
  - Route: `routes/authRoutes.js` → `controllers/authController.login`
  - Service: `services/authService.loginWithMatricule`
  - Model: `models/User.js` (findByMatricule / findByEmail / verifyPassword)

- Module creation / assign:
  - Route(s): `routes/admin.js` / `routes/formateurRoutes.js` (selon rôle)
  - Controller(s): `controllers/plannerController.js` / `controllers/resourceController.js`

- Student registration:
  - Route: `POST /api/auth/student-register` → `controllers/authController.studentRegister`
  - Service: `services/schoolLevelService.js`, `models/StudentRegistration.js`

- Resource upload / Live session:
  - Routes: `routes/resourceRoutes.js`, `routes/formateurRoutes.js`
  - Controllers: `resourceController.js`, `plannerController.js`, `live session` handlers (socket logic in `sockets/`)

## Comment démarrer localement (rapide)
1. Backend: copier `.env` minimal dans `pfe-_Adil-main/backend` et définir `DB_*` + `JWT_SECRET`.

```powershell
Set-Location 'c:\Users\HP\x\pfe-_Adil-main\backend'
npm install
npm start
```

2. Frontend: vérifier `REACT_APP_API_URL` puis:

```powershell
Set-Location 'c:\Users\HP\x\pfe-_Adil-main\frontend'
npm install
npm start
```

3. DB: importer `schema_full.sql` dans PostgreSQL (base `eduplatform`) et vérifier séquences sur `users_id_seq` si insertion manuelle.

## Comptes de démonstration (présents dans `schema_full.sql`)
- SUPER_ADMIN: email `demo.superadmin@eduplatform.com`, matricule `2026852253`, mot de passe `yacine77` (hash présent dans le SQL).
- ADMIN: email `demo.admin@eduplatform.com`, matricule `2026606819`, mot de passe `yacine77`.

## Prochaines actions recommandées
1. Intégrer les PlantUML dans le fichier draw.io ou ajouter une page docs avec images.
2. Ajouter un README global au repo racine pointant vers ce fichier et les scripts de démarrage.
3. (Optionnel) Créer migration pour rendre `school_id` et FK cohérents si souhaité.

----
Fichier généré automatiquement pour vous aider à naviguer et relier les composants. Dites-moi quelle action suivante vous voulez: "insérer PlantUML dans draw.io", "générer README racine", ou "ajouter migration DB".
