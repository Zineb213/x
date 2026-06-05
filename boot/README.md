# Boot Visa Espagne (Alerte Legale)

Ce projet est un assistant de surveillance et notification.
Il n'automatise pas la reservation, le captcha, l'OTP, ni le paiement.

## Fonctionnalites

- Verification periodique d'une URL officielle.
- Detection d'un texte indicateur de disponibilite.
- Alerte Telegram immediate (uniquement aux clients actifs).
- Activation/revocation d'acces client par admin.
- Bot Telegram avec commandes `/start`, `/status`, `/chatid`.
- Appel vocal optionnel via Twilio.
- Anti-spam avec cooldown pour eviter les notifications en boucle.
- API admin (login + gestion des comptes clients).

## Installation

```bash
cd boot
npm install
```

## Configuration

1. Copier l'exemple:

```bash
copy .env.example .env
```

2. Remplir les variables dans `.env`:
- `API_PORT`
- `JWT_SECRET`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`
- `TARGET_URL`
- `ENABLE_TELEGRAM_BOT` (`false` pour lancer sans Telegram, `true` avec vrai token)
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID` (fallback)
- `TELEGRAM_ADMIN_CHAT_ID` (votre chat Telegram admin)
- `AVAILABILITY_REGEX` (texte qui indique une disponibilite)
- `NO_SLOT_REGEX` (texte qui indique qu'il n'y a pas de disponibilite)
- Optionnel Twilio (`ENABLE_CALL=true` + variables Twilio)

## Lancement

```bash
npm start
```

Au premier lancement, le compte admin est cree automatiquement avec:
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

## API Admin

Base URL: `http://localhost:7070` (ou la valeur de `API_PORT`)

1. Login admin

```bash
curl -X POST http://localhost:7070/api/auth/login \
	-H "Content-Type: application/json" \
	-d '{"email":"admin@boot.local","password":"ChangeMe123!"}'
```

2. Creer un compte client

```bash
curl -X POST http://localhost:7070/api/admin/users \
	-H "Authorization: Bearer <TOKEN_ADMIN>" \
	-H "Content-Type: application/json" \
	-d '{"email":"client1@example.com","password":"clientPass123","plan":"monthly","expiresAt":"2026-12-31"}'
```

3. Lister les comptes

```bash
curl -H "Authorization: Bearer <TOKEN_ADMIN>" \
	http://localhost:7070/api/admin/users
```

4. Modifier un compte (actif/plan/date/chat Telegram)

```bash
curl -X PATCH http://localhost:7070/api/admin/users/<USER_ID> \
  -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{"active":true,"plan":"weekly","expiresAt":"2026-08-31","telegramChatId":"123456789"}'
```

5. Autoriser un client paye (grant)

```bash
curl -X POST http://localhost:7070/api/admin/access/grant \
  -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{"email":"client1@example.com","telegramChatId":"123456789","durationDays":30,"plan":"monthly"}'
```

6. Revoquer l'acces d'un client non paye

```bash
curl -X POST http://localhost:7070/api/admin/access/revoke \
  -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{"email":"client1@example.com"}'
```

## Notes importantes

- Garder une frequence raisonnable (`CHECK_INTERVAL_SECONDS` >= 60).
- Utiliser uniquement des flux autorises par les conditions officielles.
- L'outil est concu comme assistant de notification, pas comme bot de contournement.
