# 🎓 EduConnect Backend

Backend Node.js + Express pour la plateforme EduConnect

## 📦 Installation

### 1. Installer les dépendances
```bash
cd backend
npm install
```

### 2. Configurer la Base de Données PostgreSQL
```bash
# Créer la base de données
createdb educonnect

# Charger le schéma SQL
psql -U postgres -d educonnect -f ../database_postgres.sql
```

### 3. Configurer les variables d'environnement
Éditez le fichier `.env`:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=educonnect
DB_USER=postgres
DB_PASSWORD=votre_password

PORT=5000
JWT_SECRET=votre_secret_jwt
```

### 4. Lancer le serveur
```bash
npm start          # Production
npm run dev        # Développement (avec nodemon)
```

---

## 🔌 API Endpoints

### **Authentification** (`/api/auth`)
- `POST /register` - Créer un compte
- `POST /login` - Se connecter
- `GET /profile` - Récupérer le profil (auth required)
- `PUT /profile` - Mettre à jour le profil (auth required)

### **Ressources** (`/api/resources`)
- `GET /` - Lister les ressources (filtrable par niveau, module)
- `GET /:id` - Récupérer une ressource
- `POST /` - Créer une ressource (moderator+)
- `PUT /:id` - Modifier une ressource (moderator+)
- `DELETE /:id` - Archiver une ressource (moderator+)

---

## 🔐 Authentification JWT

1. Envoyer `Authorization: Bearer <token>` dans les headers

Exemple:
```bash
curl -H "Authorization: Bearer eyJhbGc..." \
     http://localhost:5000/api/auth/profile
```

---

## 📝 Exemples de Requêtes

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Ahmed",
    "prenom": "Moderator",
    "matricule": "mod-0001",
    "email": "ahmed@educonnect.local",
    "password": "password123"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "matricule": "mod-0001",
    "password": "password123"
  }'
```

### Créer une Ressource
```bash
curl -X POST http://localhost:5000/api/resources \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "titre": "Programmation Web",
    "description": "Cours complet",
    "niveau": "L1",
    "module": "Programmation",
    "resource_type": "COURS"
  }'
```

---

## 🏗️ Structure du Projet

```
backend/
├── server.js                    # Point d'entrée
├── package.json                 # Dépendances
├── .env                         # Variables d'environnement
├── config/
│   └── database.js             # Connection PostgreSQL
├── controllers/
│   ├── authController.js       # Logique authentification
│   └── resourceController.js   # Logique ressources
├── routes/
│   ├── auth.js                 # Routes auth
│   └── resources.js            # Routes ressources
└── middleware/
    └── authMiddleware.js       # JWT + permissions
```

---

## 🔒 Rôles et Permissions

| Action | ADMIN_GLOBAL | MODERATEUR | USER |
|--------|-------------|-----------|------|
| Créer ressource | ✅ | ✅ (module assigné) | ❌ |
| Modifier ressource | ✅ | ✅ (module assigné) | ❌ |
| Archiver ressource | ✅ | ✅ (module assigné) | ❌ |
| Voir ressources | ✅ | ✅ | ✅ |
| Créer publication | ✅ | ✅ | ✅ |
| Supprimer publication (autre) | ✅ | ✅ | ❌ |

---

## 🚀 Next Steps

1. ✅ Backend API créé
2. ⏳ Connecter le frontend au backend
3. ⏳ Ajouter WebSockets pour chat en temps réel
4. ⏳ Ajouter upload de fichiers
5. ⏳ Déployer en production

---

## 📞 Support

Pour toute question ou problème: contact@educonnect.local
