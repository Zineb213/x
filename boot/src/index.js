const axios = require('axios');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const dotenv = require('dotenv');
const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const path = require('path');

dotenv.config();

const config = {
  apiPort: Number(process.env.API_PORT || 7070),
  jwtSecret: process.env.JWT_SECRET,
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL,
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD,
  targetUrl: process.env.TARGET_URL,
  checkIntervalSeconds: Number(process.env.CHECK_INTERVAL_SECONDS || 90),
  availabilityRegex: process.env.AVAILABILITY_REGEX || '(rendez\\-vous|appointment\\s+available|disponible)',
  noSlotRegex: process.env.NO_SLOT_REGEX || '(aucun\\s+rendez\\-vous\\s+disponible|no\\s+appointments?\\s+available|complet)',
  enableTelegramBot: String(process.env.ENABLE_TELEGRAM_BOT || 'false').toLowerCase() === 'true',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramFallbackChatId: process.env.TELEGRAM_CHAT_ID,
  telegramAdminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID,
  enableCall: String(process.env.ENABLE_CALL || 'false').toLowerCase() === 'true',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER,
  userPhoneNumber: process.env.USER_PHONE_NUMBER,
  twilioTwimlUrl: process.env.TWILIO_TWIML_URL,
  alertCooldownMinutes: Number(process.env.ALERT_COOLDOWN_MINUTES || 20),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 15000)
};

let lastAlertAt = 0;
let lastHtmlDigest = null;
const usersFilePath = path.join(__dirname, '..', 'data', 'users.json');

function ensureDataStore() {
  const dataDir = path.dirname(usersFilePath);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(usersFilePath)) {
    fs.writeFileSync(usersFilePath, JSON.stringify({ users: [] }, null, 2), 'utf8');
  }
}

function readUsers() {
  ensureDataStore();
  const raw = fs.readFileSync(usersFilePath, 'utf8');
  return JSON.parse(raw).users || [];
}

function writeUsers(users) {
  ensureDataStore();
  fs.writeFileSync(usersFilePath, JSON.stringify({ users }, null, 2), 'utf8');
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    telegramChatId: user.telegramChatId || null,
    active: user.active,
    plan: user.plan,
    expiresAt: user.expiresAt,
    apiKey: user.apiKey,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function isSubscriptionActive(user) {
  if (!user.active) {
    return false;
  }

  if (!user.expiresAt) {
    return true;
  }

  const expiry = new Date(user.expiresAt).getTime();
  if (Number.isNaN(expiry)) {
    return false;
  }

  return expiry >= Date.now();
}

function getAlertRecipients() {
  const users = readUsers();
  const recipients = users
    .filter((user) => user.role === 'CLIENT' && user.telegramChatId && isSubscriptionActive(user))
    .map((user) => ({ chatId: user.telegramChatId, user }));

  if (recipients.length === 0 && config.telegramFallbackChatId) {
    return [{ chatId: config.telegramFallbackChatId, user: null }];
  }

  return recipients;
}

function createApiKey() {
  return crypto.randomBytes(20).toString('hex');
}

async function ensureSuperAdmin() {
  const users = readUsers();
  const existing = users.find((u) => u.email.toLowerCase() === config.superAdminEmail.toLowerCase());

  if (existing) {
    return;
  }

  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(config.superAdminPassword, 12);

  users.push({
    id: crypto.randomUUID(),
    email: config.superAdminEmail,
    passwordHash,
    role: 'ADMIN',
    displayName: 'Super Admin',
    active: true,
    plan: 'owner',
    expiresAt: null,
    apiKey: createApiKey(),
    createdAt: now,
    updatedAt: now
  });

  writeUsers(users);
  console.log(`[${now}] compte admin cree: ${config.superAdminEmail}`);
}

function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization || '';

  if (!authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = authorization.slice('Bearer '.length).trim();

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = payload;
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acces refuse' });
  }

  return next();
}

function startApiServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (_req, res) => {
    res.json({
      service: 'visa-alert-boot',
      status: 'ok',
      message: 'Utilisez /api/health puis les routes /api/auth et /api/admin.'
    });
  });

  app.get('/api', (_req, res) => {
    res.json({
      routes: [
        'GET /api/health',
        'POST /api/auth/login',
        'GET /api/auth/me',
        'GET /api/admin/users',
        'POST /api/admin/users',
        'PATCH /api/admin/users/:id',
        'POST /api/admin/users/:id/reset-password',
        'POST /api/admin/users/:id/rotate-key',
        'POST /api/admin/access/grant',
        'POST /api/admin/access/revoke'
      ]
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'visa-alert-boot' });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'email et password sont obligatoires' });
    }

    const users = readUsers();
    const user = users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);

    if (!ok) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const token = jwt.sign({ sub: user.id, role: user.role, email: user.email }, config.jwtSecret, {
      expiresIn: '12h'
    });

    return res.json({ token, user: publicUser(user) });
  });

  app.get('/api/auth/me', authMiddleware, (req, res) => {
    const users = readUsers();
    const user = users.find((u) => u.id === req.user.sub);

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    return res.json({ user: publicUser(user) });
  });

  app.get('/api/admin/users', authMiddleware, requireAdmin, (_req, res) => {
    const users = readUsers();
    return res.json({ users: users.map(publicUser) });
  });

  app.post('/api/admin/users', authMiddleware, requireAdmin, async (req, res) => {
    const { email, password, displayName, plan, expiresAt, telegramChatId } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'email et password sont obligatoires' });
    }

    const users = readUsers();
    const alreadyExists = users.some((u) => u.email.toLowerCase() === String(email).toLowerCase());

    if (alreadyExists) {
      return res.status(409).json({ error: 'Compte deja existant' });
    }

    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(password, 12);

    const user = {
      id: crypto.randomUUID(),
      email: String(email).trim(),
      passwordHash,
      role: 'CLIENT',
      displayName: displayName || '',
      telegramChatId: telegramChatId ? String(telegramChatId) : null,
      active: true,
      plan: plan || 'monthly',
      expiresAt: expiresAt || null,
      apiKey: createApiKey(),
      createdAt: now,
      updatedAt: now
    };

    users.push(user);
    writeUsers(users);

    return res.status(201).json({ user: publicUser(user) });
  });

  app.patch('/api/admin/users/:id', authMiddleware, requireAdmin, (req, res) => {
    const users = readUsers();
    const index = users.findIndex((u) => u.id === req.params.id);

    if (index < 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const { active, plan, expiresAt, displayName, telegramChatId } = req.body || {};
    const updated = {
      ...users[index],
      updatedAt: new Date().toISOString()
    };

    if (typeof active === 'boolean') {
      updated.active = active;
    }

    if (typeof plan === 'string' && plan.trim()) {
      updated.plan = plan.trim();
    }

    if (typeof displayName === 'string') {
      updated.displayName = displayName;
    }

    if (expiresAt === null || typeof expiresAt === 'string') {
      updated.expiresAt = expiresAt;
    }

    if (telegramChatId === null || typeof telegramChatId === 'string' || typeof telegramChatId === 'number') {
      updated.telegramChatId = telegramChatId === null ? null : String(telegramChatId);
    }

    users[index] = updated;
    writeUsers(users);

    return res.json({ user: publicUser(updated) });
  });

  app.post('/api/admin/users/:id/reset-password', authMiddleware, requireAdmin, async (req, res) => {
    const { password } = req.body || {};

    if (!password) {
      return res.status(400).json({ error: 'password est obligatoire' });
    }

    const users = readUsers();
    const index = users.findIndex((u) => u.id === req.params.id);

    if (index < 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    users[index].passwordHash = await bcrypt.hash(password, 12);
    users[index].updatedAt = new Date().toISOString();
    writeUsers(users);

    return res.json({ success: true });
  });

  app.post('/api/admin/users/:id/rotate-key', authMiddleware, requireAdmin, (req, res) => {
    const users = readUsers();
    const index = users.findIndex((u) => u.id === req.params.id);

    if (index < 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    users[index].apiKey = createApiKey();
    users[index].updatedAt = new Date().toISOString();
    writeUsers(users);

    return res.json({ user: publicUser(users[index]) });
  });

  app.post('/api/admin/access/grant', authMiddleware, requireAdmin, (req, res) => {
    const { email, telegramChatId, durationDays, plan } = req.body || {};

    if (!email || !telegramChatId) {
      return res.status(400).json({ error: 'email et telegramChatId sont obligatoires' });
    }

    const users = readUsers();
    const index = users.findIndex((u) => u.email.toLowerCase() === String(email).toLowerCase());

    if (index < 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const days = Number(durationDays || 30);
    const expiresAt = new Date(Date.now() + Math.max(days, 1) * 24 * 60 * 60 * 1000).toISOString();

    users[index].active = true;
    users[index].telegramChatId = String(telegramChatId);
    users[index].plan = typeof plan === 'string' && plan.trim() ? plan.trim() : users[index].plan;
    users[index].expiresAt = expiresAt;
    users[index].updatedAt = new Date().toISOString();
    writeUsers(users);

    return res.json({ user: publicUser(users[index]) });
  });

  app.post('/api/admin/access/revoke', authMiddleware, requireAdmin, (req, res) => {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: 'email est obligatoire' });
    }

    const users = readUsers();
    const index = users.findIndex((u) => u.email.toLowerCase() === String(email).toLowerCase());

    if (index < 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    users[index].active = false;
    users[index].updatedAt = new Date().toISOString();
    writeUsers(users);

    return res.json({ user: publicUser(users[index]) });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Route introuvable' });
  });

  app.listen(config.apiPort, () => {
    console.log(`API admin demarree sur http://localhost:${config.apiPort}`);
  });
}

function validateConfig() {
  const required = [
    'apiPort',
    'jwtSecret',
    'superAdminEmail',
    'superAdminPassword',
    'targetUrl',
    'telegramBotToken'
  ];
  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(`Variables manquantes: ${missing.join(', ')}`);
  }

  if (config.enableTelegramBot && !/^\d+:[A-Za-z0-9_-]{20,}$/.test(String(config.telegramBotToken))) {
    throw new Error('TELEGRAM_BOT_TOKEN invalide. Mettez le vrai token fourni par BotFather.');
  }

  if (config.enableCall) {
    const callRequired = [
      'twilioAccountSid',
      'twilioAuthToken',
      'twilioFromNumber',
      'userPhoneNumber',
      'twilioTwimlUrl'
    ];

    const callMissing = callRequired.filter((key) => !config[key]);
    if (callMissing.length > 0) {
      throw new Error(`ENABLE_CALL=true mais variables Twilio manquantes: ${callMissing.join(', ')}`);
    }
  }
}

function hashSnippet(text) {
  if (!text) {
    return '0';
  }

  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

function canSendAlert() {
  const cooldownMs = config.alertCooldownMinutes * 60 * 1000;
  return Date.now() - lastAlertAt >= cooldownMs;
}

async function sendTelegramMessage(chatId, message) {
  const telegramUrl = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;

  await axios.post(telegramUrl, {
    chat_id: chatId,
    text: message,
    disable_web_page_preview: true
  }, {
    timeout: config.requestTimeoutMs
  });
}

async function startTelegramBot() {
  let offset = 0;
  let pollingEnabled = true;

  const poll = async () => {
    if (!pollingEnabled) {
      return;
    }

    try {
      const updatesUrl = `https://api.telegram.org/bot${config.telegramBotToken}/getUpdates`;
      const response = await axios.get(updatesUrl, {
        params: { timeout: 15, offset },
        timeout: 20000
      });

      const updates = response.data?.result || [];

      for (const update of updates) {
        offset = Math.max(offset, update.update_id + 1);
        const message = update.message;
        const text = message?.text;
        const chatId = message?.chat?.id;

        if (!text || !chatId) {
          continue;
        }

        if (text === '/start') {
          await sendTelegramMessage(chatId, 'Bienvenue. Envoyez /status pour verifier votre acces.');
          continue;
        }

        if (text === '/status') {
          const users = readUsers();
          const user = users.find((u) => String(u.telegramChatId || '') === String(chatId));

          if (!user) {
            await sendTelegramMessage(chatId, 'Acces non autorise. Contactez l\'administrateur.');
            continue;
          }

          if (!isSubscriptionActive(user)) {
            await sendTelegramMessage(chatId, 'Votre abonnement est inactif ou expire. Contactez l\'administrateur.');
            continue;
          }

          const expiry = user.expiresAt ? `Expire le: ${new Date(user.expiresAt).toLocaleString('fr-FR')}` : 'Pas de date d\'expiration';
          await sendTelegramMessage(chatId, `Acces actif. Plan: ${user.plan}. ${expiry}`);
          continue;
        }

        if (text.startsWith('/chatid')) {
          await sendTelegramMessage(chatId, `Votre chat_id est: ${chatId}`);
          continue;
        }

        if (String(chatId) === String(config.telegramAdminChatId) && text === '/help') {
          await sendTelegramMessage(chatId, 'Commandes: /status, /chatid');
        }
      }
    } catch (error) {
      const status = error.response?.status;
      const detail = status ? `HTTP ${status}` : error.message;
      if (status === 404 || status === 401) {
        pollingEnabled = false;
        console.error(
          `[${new Date().toISOString()}] bot telegram arrete: ${detail}. Verifiez TELEGRAM_BOT_TOKEN dans le fichier .env puis redemarrez.`
        );
        return;
      }

      console.error(`[${new Date().toISOString()}] bot telegram: ${detail}`);
    } finally {
      if (pollingEnabled) {
        setTimeout(poll, 1500);
      }
    }
  };

  poll();
}

async function triggerCall() {
  if (!config.enableCall) {
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Calls.json`;
  const body = new URLSearchParams({
    To: config.userPhoneNumber,
    From: config.twilioFromNumber,
    Url: config.twilioTwimlUrl
  });

  await axios.post(url, body.toString(), {
    auth: {
      username: config.twilioAccountSid,
      password: config.twilioAuthToken
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    timeout: config.requestTimeoutMs
  });
}

async function checkAvailability() {
  const startedAt = new Date().toISOString();

  try {
    // Crée une nouvelle instance axios sans cookies à chaque requête
    const axiosInstance = axios.create();
    const response = await axiosInstance.get(config.targetUrl, {
      timeout: config.requestTimeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VisaAlertAssistant/1.0; +https://example.local)',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
      },
      // Ne pas envoyer de cookies, ne pas suivre les cookies reçus
      withCredentials: false
    });

    const html = String(response.data || '');
    const htmlDigest = hashSnippet(html.slice(0, 2500));
    const availabilityRegex = new RegExp(config.availabilityRegex, 'i');
    const noSlotRegex = new RegExp(config.noSlotRegex, 'i');
    const matchedAvailability = availabilityRegex.test(html);
    const matchedNoSlot = noSlotRegex.test(html);
    const matched = matchedAvailability && !matchedNoSlot;

    const changed = lastHtmlDigest !== null && htmlDigest !== lastHtmlDigest;
    lastHtmlDigest = htmlDigest;

    console.log(
      `[${startedAt}] verification OK | status=${response.status} | changed=${changed} | availability=${matchedAvailability} | no_slot=${matchedNoSlot} | matched=${matched}`
    );

    if (!matched || !canSendAlert()) {
      return;
    }

    lastAlertAt = Date.now();
    const alertMessage = [
      'ALERTE VISA ESPAGNE',
      'Un indicateur de disponibilite a ete detecte.',
      `URL: ${config.targetUrl}`,
      `Heure: ${new Date().toLocaleString('fr-FR')}`,
      'Ouvrez le site officiel et finalisez manuellement la reservation.'
    ].join('\n');

    const recipients = getAlertRecipients();

    if (recipients.length === 0) {
      console.log(`[${new Date().toISOString()}] alerte detectee mais aucun utilisateur Telegram actif`);
      return;
    }

    for (const recipient of recipients) {
      await sendTelegramMessage(recipient.chatId, alertMessage);
    }

    await triggerCall();

    console.log(
      `[${new Date().toISOString()}] alerte envoyee a ${recipients.length} destinataire(s) (Telegram${config.enableCall ? ' + appel' : ''})`
    );
  } catch (error) {
    const status = error.response?.status;
    const detail = status ? `HTTP ${status}` : error.message;
    console.error(`[${startedAt}] verification echouee: ${detail}`);
  }
}

async function main() {
  validateConfig();
  // DEBUG: Affiche la config Telegram au démarrage
  console.log('[DEBUG] enableTelegramBot =', config.enableTelegramBot);
  console.log('[DEBUG] telegramBotToken =', config.telegramBotToken);
  await ensureSuperAdmin();
  startApiServer();
  if (config.enableTelegramBot) {
    console.log('[DEBUG] Lancement du bot Telegram...');
    startTelegramBot();
  } else {
    console.log('Bot Telegram desactive (ENABLE_TELEGRAM_BOT=false).');
  }

  console.log('Visa Alert Assistant demarre.');
  console.log(`Cible: ${config.targetUrl}`);
  console.log(`Intervalle: ${config.checkIntervalSeconds}s`);

  // Boucle de surveillance avec intervalle aléatoire (5 à 10 min)
  async function loop() {
    await checkAvailability();
    // Intervalle aléatoire entre 5 et 10 minutes (en ms)
    const min = 5 * 60 * 1000;
    const max = 10 * 60 * 1000;
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    setTimeout(loop, delay);
  }
  loop();
}

main().catch((error) => {
  console.error('Erreur de demarrage:', error.message);
  process.exit(1);
});
