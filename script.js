const STORAGE_KEY = 'educonnect_state_v3';
const CURRENT_USER_ID_KEY = 'currentUserId';
const BANNED_WORDS = ['insulte', 'spam', 'inapproprié'];

// =====================================================
// API_BASE_URL = adresse du serveur backend
// Toutes les requêtes vont vers http://localhost:5000
// =====================================================
const API_BASE_URL = 'http://localhost:5000/api';

// Fonction utilitaire pour appeler l'API
// method = GET, POST, PUT, DELETE
// body = données à envoyer (optionnel)
async function apiCall(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('jwt_token');
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    // Si on a un token JWT, on l'ajoute dans le header
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    // Si on envoie des données, on les convertit en JSON
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
    let data = null;

    try {
        data = await res.json();
    } catch (_) {
        data = null;
    }

    if (!res.ok) {
        return {
            error: data?.error || `Erreur HTTP ${res.status}`,
            status: res.status
        };
    }

    return data;
}

let state = loadState();
let selectedChatId = null;
let notificationCount = 0;
let pendingPostAttachments = [];
let pendingEntityPhotoDataUrl = '';
let pendingEntityFileMap = {};
let _currentModulePageState = null;
const MAX_POST_ATTACHMENT_SIZE_BYTES = 6 * 1024 * 1024;
let weeklyPlannerConfig = {
    blockSizeHours: 1,
    startMinutes: 8 * 60,
    endMinutes: 20 * 60,
    entries: {}
};

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initNavigation();
    initLevelTabs();
    initResourcesInteractions();
    initSearch();

    // Ne se reconnecte automatiquement que si un token JWT valide est présent
    const jwtToken = localStorage.getItem('jwt_token');
    const currentUser = getCurrentUser();
    if (jwtToken && currentUser) {
        showDashboard(currentUser);
    }

    console.log('🎓 EduConnect v3 - avec Modérateurs et Notifications');
});

function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            return JSON.parse(raw);
        } catch (_) {
            localStorage.removeItem(STORAGE_KEY);
        }
    }
    const initial = buildInitialState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function buildInitialState() {
    const now = new Date().toISOString();
    return {
        communaute: [{ id: 1, nom: 'Communaute Globale', created_at: now }],
        app_user: [
            {
                id: 1,
                username: 'Admin EduConnect',
                email: 'admin@educonnect.local',
                password_hash: null,
                created_at: now,
                photo_url: null,
                bio: 'Administrateur global',
                role_global: 'ADMIN_GLOBAL',
                nom: 'Admin',
                prenom: 'EduConnect',
                matricule: 'admin-0001',
                full_name: 'EduConnect Admin'
            },
            {
                id: 2,
                username: 'Sarah Benali',
                email: null,
                password_hash: null,
                created_at: now,
                photo_url: null,
                bio: null,
                role_global: 'USER',
                nom: 'Benali',
                prenom: 'Sarah',
                matricule: '20210001',
                full_name: 'Sarah Benali'
            },
            {
                id: 3,
                username: 'Ahmed Khelifi',
                email: null,
                password_hash: null,
                created_at: now,
                photo_url: null,
                bio: null,
                role_global: 'MODERATEUR',
                nom: 'Khelifi',
                prenom: 'Ahmed',
                matricule: 'mod-0001',
                full_name: 'Ahmed Khelifi (Modérateur)'
            }
        ],
        notification: [
            {
                id: 1,
                destinataire_id: 2,
                content: 'Nouveau cours disponible : Programmation Web',
                source_type: 'ressource',
                source_id: 1,
                created_at: now,
                is_read: false
            },
            {
                id: 2,
                destinataire_id: 2,
                content: 'Sarah vous a partagé une publication',
                source_type: 'partage',
                source_id: 1,
                created_at: now,
                is_read: false
            },
            {
                id: 3,
                destinataire_id: 2,
                content: 'Nouveau message dans Groupe L3 Info',
                source_type: 'chat',
                source_id: 1,
                created_at: now,
                is_read: true
            }
        ],
        activity: [],
        ressource_pedagogique: [
            {
                id_ressource: 1,
                resource_type: 'COURS',
                titre: 'Programmation Web',
                description: 'Cours complet sur le développement web moderne',
                date_ajout: now,
                niveau: 'L1',
                module: 'Développement Web',
                id_auteur: 3,
                nombre_chapitres: 12,
                is_archived: false
            },
            {
                id_ressource: 2,
                resource_type: 'TD',
                titre: 'TD Programmation - Série 1',
                description: 'Exercices pratiques',
                date_ajout: now,
                niveau: 'L1',
                module: 'Programmation',
                id_auteur: 3,
                numero_serie: 1,
                is_archived: false
            },
            {
                id_ressource: 3,
                resource_type: 'EXAMEN',
                titre: 'Examen Analyse 2024',
                description: '',
                date_ajout: now,
                niveau: 'L2',
                module: 'Analyse',
                id_auteur: 3,
                annee: 2024,
                session: 'Normale',
                is_archived: false
            }
        ],
        ressource_moderator: [
            {
                id: 1,
                moderator_id: 3,
                module: 'Programmation',
                niveau: 'L1',
                assigned_at: now,
                assigned_by: 1
            },
            {
                id: 2,
                moderator_id: 3,
                module: 'Analyse',
                niveau: 'L2',
                assigned_at: now,
                assigned_by: 1
            }
        ],
        moderation_log: [],
        activite_recente: [
            {
                id: 1,
                type: 'COURS',
                date: now,
                ressource: 'Programmation Web',
                module: 'Développement Web',
                niveau: 'L1',
                id_admin: 3
            },
            {
                id: 2,
                type: 'TD',
                date: new Date(Date.now() - 3600000).toISOString(),
                ressource: 'TD Programmation - Série 1',
                module: 'Programmation',
                niveau: 'L1',
                id_admin: 3
            }
        ],
        publication: [
            {
                id: 1,
                communaute_id: 1,
                auteur_id: 2,
                content: 'Bonjour à tous ! 👋 Je cherche des coéquipiers pour le projet de développement web.',
                created_at: now,
                report_count: 0,
                is_deleted: false
            },
            {
                id: 2,
                communaute_id: 1,
                auteur_id: 3,
                content: '📚 Rappel : examen de Bases de Données le 15 novembre à 9h00.',
                created_at: now,
                report_count: 0,
                is_deleted: false
            }
        ],
        attachment: [],
        commentaire: [
            {
                id: 1,
                publication_id: 1,
                auteur_id: 3,
                content: 'Je suis intéressé !',
                created_at: now,
                report_count: 0,
                is_deleted: false
            }
        ],
        vote: [],
        partage: [],
        chat: [
            { id: 1, chat_type: 'GRP', created_at: now, created_by: 1 },
            { id: 2, chat_type: 'PRV', created_at: now, created_by: 2 }
        ],
        chat_prv: [{ chat_id: 2, user_a_id: 2, user_b_id: 3 }],
        chat_grp: [{ chat_id: 1, nom: 'Groupe L3 Info', created_by: 1 }],
        chat_grp_admin: [{ chat_id: 1, user_id: 1 }],
        chat_grp_membre: [
            { chat_id: 1, user_id: 1, joined_at: now },
            { chat_id: 1, user_id: 2, joined_at: now },
            { chat_id: 1, user_id: 3, joined_at: now }
        ],
        message: [
            {
                id: 1,
                chat_id: 1,
                auteur_id: 3,
                content: 'Salut tout le monde !',
                created_at: now,
                report_count: 0,
                is_deleted: false
            },
            {
                id: 2,
                chat_id: 1,
                auteur_id: 2,
                content: 'Bienvenue sur le groupe 👌',
                created_at: now,
                report_count: 0,
                is_deleted: false
            }
        ]
    };
}

function nextId(items) {
    return items.length ? Math.max(...items.map((i) => Number(i.id || i.chat_id || 0))) + 1 : 1;
}

function getCurrentUserId() {
    const raw = localStorage.getItem(CURRENT_USER_ID_KEY);
    return raw ? Number(raw) : null;
}

function getCurrentUser() {
    const id = getCurrentUserId();
    if (!id) return null;
    return state.app_user.find((u) => u.id === id) || null;
}

function isAdminUser(user) {
    const role = String(user?.role_global || '').toUpperCase();
    return role === 'ADMIN_GLOBAL' || role === 'ADMIN';
}

function isModeratorUser(user) {
    const role = String(user?.role_global || '').toUpperCase();
    return role === 'MODERATEUR' || role === 'MODERATOR';
}

async function syncCurrentUserFromApi() {
    const jwtToken = localStorage.getItem('jwt_token');
    const current = getCurrentUser();
    if (!jwtToken || !current) return current;

    try {
        const profile = await apiCall('/auth/profile');
        if (profile?.error || !profile?.id) return current;

        const synced = {
            ...current,
            ...profile,
            full_name: `${profile.prenom || current.prenom || ''} ${profile.nom || current.nom || ''}`.trim() || current.full_name || current.username
        };

        const idx = state.app_user.findIndex((u) => Number(u.id) === Number(synced.id));
        if (idx >= 0) state.app_user[idx] = synced;
        else state.app_user.push(synced);
        saveState();
        return synced;
    } catch (_) {
        return current;
    }
}

function canModifyResource(user, resourceModule, resourceNiveau) {
    if (isAdminUser(user)) return true;
    if (!isModeratorUser(user)) return false;
    return state.ressource_moderator.some(
        (rm) => rm.moderator_id === user.id && rm.module === resourceModule && rm.niveau === resourceNiveau
    );
}

function applyRolePermissions(user) {
    document.body.classList.toggle('is-admin', isAdminUser(user));
    document.body.classList.toggle('is-moderator', isModeratorUser(user));
    document.body.classList.toggle('is-manager', isAdminUser(user) || isModeratorUser(user));
}

function initAuth() {
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');

    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nom      = document.getElementById('nom')?.value.trim();
        const prenom   = document.getElementById('prenom')?.value.trim();
        const matricule = document.getElementById('matricule')?.value.trim();
        const password  = document.getElementById('password')?.value.trim();
        if (!nom || !prenom || !matricule || !password) return;

        // =====================================================
        // AVANT: on cherchait l'user dans localStorage
        // MAINTENANT: on essaie de se connecter via l'API
        // Si l'user n'existe pas, on le crée (register)
        // =====================================================
        showNotification('Connexion en cours...', 'info');

        // 1. Essayer le login
        let result = await apiCall('/auth/login', 'POST', { matricule, password });

        // 2. Si l'user n'existe pas encore → on le crée (register)
        if (result.error) {
            result = await apiCall('/auth/register', 'POST', { nom, prenom, matricule, email: `${matricule}@edu.local`, password });
        }

        // 3. Si erreur → afficher message
        if (result.error) {
            showNotification(result.error, 'error');
            return;
        }

        // 4. Sauvegarder le token JWT dans localStorage
        // Le token permet d'identifier l'user dans chaque requête
        localStorage.setItem('jwt_token', result.token);
        localStorage.setItem(CURRENT_USER_ID_KEY, String(result.user.id));

        // 5. Mettre à jour le state local avec les données de la BD
        const user = {
            ...result.user,
            full_name: `${result.user.prenom} ${result.user.nom}`
        };

        // Synchroniser state local
        const idx = state.app_user.findIndex(u => u.matricule === matricule);
        if (idx >= 0) state.app_user[idx] = user;
        else state.app_user.push(user);
        saveState();

        showDashboard(user);
    });

    logoutBtn?.addEventListener('click', () => {
        if (!confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) return;
        localStorage.removeItem(CURRENT_USER_ID_KEY);
        localStorage.removeItem('jwt_token');
        const loginPage = document.getElementById('login-page');
        const dashboardPage = document.getElementById('dashboard-page');

        dashboardPage?.classList.remove('active');
        loginPage?.classList.add('active');
        loginForm?.reset();
    });
}

function showDashboard(user) {
    const loginPage = document.getElementById('login-page');
    const dashboardPage = document.getElementById('dashboard-page');
    const userName = document.getElementById('user-name');
    const userMatricule = document.getElementById('user-matricule');

    userName.textContent = user.full_name || user.username;
    userMatricule.textContent = `${user.matricule || '-'} • ${user.role_global}`;

    applyRolePermissions(user);
    updateNotificationBadge();
    loginPage?.classList.remove('active');
    dashboardPage?.classList.add('active');

    initChatModule();
    initSocialModule();
    initNotificationsPanel();
    updateNotificationBadge();
    initWeeklyPlanner(user);

    // Synchronise le role reel depuis la base pour eviter les faux "acces admin refuse"
    syncCurrentUserFromApi().then((freshUser) => {
        if (!freshUser) return;
        userName.textContent = freshUser.full_name || freshUser.username;
        userMatricule.textContent = `${freshUser.matricule || '-'} • ${freshUser.role_global || '-'}`;
        applyRolePermissions(freshUser);

        if (isAdminUser(freshUser) || isModeratorUser(freshUser)) {
            initAdminPanel(freshUser);
        }
    });

    if (isAdminUser(user) || isModeratorUser(user)) {
        initAdminPanel(user);
    }

    loadAndRenderResources('L1', document.getElementById('l1-grid'));
    initUpcomingManager(user);
    loadDashboardStats();
    loadRecentActivities();
    loadUpcomingItems();
}
async function loadDashboardStats() {
    const [allResources, unread, globalStats] = await Promise.all([
        apiCall('/resources'),
        apiCall('/notifications/unread-count'),
        apiCall('/admin/stats')
    ]);

    if (!Array.isArray(allResources)) return;
    const cours   = allResources.filter(r => r.resource_type === 'COURS').length;
    const tdExams = allResources.filter(r => r.resource_type === 'TD' || r.resource_type === 'EXAMEN').length;
    const statCards = document.querySelectorAll('.stat-card .stat-info h3');
    if (statCards[0]) statCards[0].textContent = cours;
    if (statCards[1]) statCards[1].textContent = tdExams;
    if (statCards[2]) statCards[2].textContent = Number(unread?.count || 0);
    if (statCards[3]) statCards[3].textContent = Number(globalStats?.total_users || 0);
}

function initUpcomingManager(user) {
    const btn = document.getElementById('add-upcoming-btn');
    if (!btn) return;
    if (btn.dataset.bound === '1') return;

    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
        const activeUser = getCurrentUser();
        if (!isAdminUser(activeUser) && !isModeratorUser(activeUser)) {
            showNotification('Action réservée aux modérateurs/admins', 'error');
            return;
        }

        const values = await openEntityForm({
            title: 'Ajouter un événement à venir',
            subtitle: 'Remplissez les détails de manière organisée.',
            submitLabel: 'Ajouter',
            fields: [
                { key: 'title', label: 'Titre', type: 'text', required: true, placeholder: 'Ex: Cours de Base de données' },
                { key: 'moduleName', label: 'Module', type: 'text', required: true, placeholder: 'Ex: Programmation' },
                { key: 'niveau', label: 'Niveau', type: 'select', required: true, value: 'L1', options: ['L1', 'L2', 'L3'] },
                { key: 'dateInput', label: 'Date et heure', type: 'datetime-local', required: true },
                { key: 'location', label: 'Lieu (optionnel)', type: 'text', placeholder: 'Amphi A1' },
                { key: 'teacher', label: 'Chargé / intervenant', type: 'text', placeholder: 'Nom du chargé' },
                { key: 'details', label: 'Détails', type: 'textarea', full: true, placeholder: 'Informations complémentaires' },
                { key: 'photo', label: 'Photo (optionnel)', type: 'file', accept: 'image/*', full: true }
            ]
        });

        if (!values) return;

        const title = values.title;
        const moduleName = values.moduleName;
        const niveau = values.niveau;
        const dateInput = values.dateInput;
        const location = [values.location, values.teacher].filter(Boolean).join(' - ');
        const notes = values.details || null;
        const logoUrl = values.photoDataUrl || null;

        if (!['L1', 'L2', 'L3'].includes(niveau)) {
            showNotification('Niveau invalide', 'error');
            return;
        }

        const result = await apiCall('/admin/upcoming', 'POST', {
            title,
            module: moduleName,
            niveau,
            date: dateInput,
            location,
            notes,
            logo_url: logoUrl
        });

        if (result?.error) {
            showNotification(result.error, 'error');
            return;
        }

        showNotification('Événement ajouté avec succès', 'success');
        loadUpcomingItems();
        loadRecentActivities();
    });
}

function initWeeklyPlanner(user) {
    const openBtn = document.getElementById('open-planner-btn');
    const closeBtn = document.getElementById('planner-close-btn');
    const modal = document.getElementById('planner-modal');
    const applyBtn = document.getElementById('planner-apply-btn');
    const blockSizeSelect = document.getElementById('planner-block-size');
    const startInput = document.getElementById('planner-start-hour');
    const endInput = document.getElementById('planner-end-hour');

    if (!openBtn || !closeBtn || !modal || !applyBtn || !blockSizeSelect || !startInput || !endInput) return;
    if (openBtn.dataset.bound === '1') return;
    openBtn.dataset.bound = '1';

    weeklyPlannerConfig = loadWeeklyPlannerConfig(user?.id);
    blockSizeSelect.value = String(weeklyPlannerConfig.blockSizeHours);
    startInput.value = minutesToTimeInput(weeklyPlannerConfig.startMinutes);
    endInput.value = minutesToTimeInput(weeklyPlannerConfig.endMinutes);

    // Hydratation depuis la base de données (fallback local si indisponible)
    fetchWeeklyPlannerFromApi(user?.id).then((loaded) => {
        if (!loaded) return;
        blockSizeSelect.value = String(weeklyPlannerConfig.blockSizeHours);
        startInput.value = minutesToTimeInput(weeklyPlannerConfig.startMinutes);
        endInput.value = minutesToTimeInput(weeklyPlannerConfig.endMinutes);
        loadUpcomingItems();
    });

    applyBtn.addEventListener('click', async () => {
        const block = Number(blockSizeSelect.value || 1);
        const start = timeInputToMinutes(startInput.value);
        const end = timeInputToMinutes(endInput.value);

        if (![1, 2, 3].includes(block)) {
            showNotification('Taille de bloc invalide.', 'error');
            return;
        }
        if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
            showNotification('Heures invalides.', 'error');
            return;
        }
        if ((end - start) < (block * 60)) {
            showNotification('Plage horaire trop petite pour ce bloc.', 'error');
            return;
        }

        weeklyPlannerConfig.blockSizeHours = block;
        weeklyPlannerConfig.startMinutes = start;
        weeklyPlannerConfig.endMinutes = end;
        const persisted = await persistWeeklyPlannerConfig(user?.id);
        if (!persisted) {
            showNotification('Planner sauvegardé localement (API indisponible).', 'error');
        }
        renderWeeklyPlannerGrid();
        loadUpcomingItems();
        showNotification('Planner mis à jour.', 'success');
    });

    openBtn.addEventListener('click', () => {
        renderWeeklyPlannerGrid();
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    });

    closeBtn.addEventListener('click', () => closePlannerModal());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closePlannerModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('open')) {
            closePlannerModal();
        }
    });
}

function closePlannerModal() {
    const modal = document.getElementById('planner-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function getPlannerStorageKey(userId) {
    return `educonnect_weekly_planner_${userId || 'guest'}`;
}

function loadWeeklyPlannerConfig(userId) {
    const key = getPlannerStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) {
        return {
            blockSizeHours: 1,
            startMinutes: 8 * 60,
            endMinutes: 20 * 60,
            entries: {}
        };
    }

    try {
        const parsed = JSON.parse(raw);
        return {
            blockSizeHours: [1, 2, 3].includes(Number(parsed.blockSizeHours)) ? Number(parsed.blockSizeHours) : 1,
            startMinutes: Number.isFinite(Number(parsed.startMinutes)) ? Number(parsed.startMinutes) : 8 * 60,
            endMinutes: Number.isFinite(Number(parsed.endMinutes)) ? Number(parsed.endMinutes) : 20 * 60,
            entries: parsed.entries && typeof parsed.entries === 'object' ? parsed.entries : {}
        };
    } catch {
        return {
            blockSizeHours: 1,
            startMinutes: 8 * 60,
            endMinutes: 20 * 60,
            entries: {}
        };
    }
}

function saveWeeklyPlannerConfig(userId, config) {
    localStorage.setItem(getPlannerStorageKey(userId), JSON.stringify(config));
}

async function fetchWeeklyPlannerFromApi(userId) {
    try {
        const result = await apiCall('/planner');
        if (result?.error || !result?.config) {
            return false;
        }

        weeklyPlannerConfig = {
            blockSizeHours: [1, 2, 3].includes(Number(result.config.blockSizeHours)) ? Number(result.config.blockSizeHours) : 1,
            startMinutes: Number.isFinite(Number(result.config.startMinutes)) ? Number(result.config.startMinutes) : 8 * 60,
            endMinutes: Number.isFinite(Number(result.config.endMinutes)) ? Number(result.config.endMinutes) : 20 * 60,
            entries: result.entries && typeof result.entries === 'object' ? result.entries : {}
        };

        saveWeeklyPlannerConfig(userId, weeklyPlannerConfig);
        return true;
    } catch (_) {
        return false;
    }
}

async function persistWeeklyPlannerConfig(userId) {
    saveWeeklyPlannerConfig(userId, weeklyPlannerConfig);
    try {
        const result = await apiCall('/planner', 'PUT', {
            blockSizeHours: weeklyPlannerConfig.blockSizeHours,
            startMinutes: weeklyPlannerConfig.startMinutes,
            endMinutes: weeklyPlannerConfig.endMinutes,
            entries: weeklyPlannerConfig.entries
        });
        return !result?.error;
    } catch (_) {
        return false;
    }
}

function timeInputToMinutes(value) {
    const parts = String(value || '').split(':');
    if (parts.length !== 2) return NaN;
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
    return h * 60 + m;
}

function minutesToTimeInput(minutes) {
    const safe = Math.max(0, Math.min(23 * 60 + 59, Number(minutes) || 0));
    const h = String(Math.floor(safe / 60)).padStart(2, '0');
    const m = String(safe % 60).padStart(2, '0');
    return `${h}:${m}`;
}

function minutesToLabel(minutes) {
    return minutesToTimeInput(minutes);
}

function buildPlannerSlots() {
    const slots = [];
    const step = weeklyPlannerConfig.blockSizeHours * 60;
    for (let t = weeklyPlannerConfig.startMinutes; t < weeklyPlannerConfig.endMinutes; t += step) {
        const end = Math.min(t + step, weeklyPlannerConfig.endMinutes);
        slots.push({
            start: t,
            end,
            key: `${t}-${end}`,
            label: `${minutesToLabel(t)} - ${minutesToLabel(end)}`
        });
    }
    return slots;
}

function renderWeeklyPlannerGrid() {
    const wrap = document.getElementById('planner-grid-wrap');
    if (!wrap) return;

    const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const slots = buildPlannerSlots();

    if (slots.length === 0) {
        wrap.innerHTML = '<p class="empty-state" style="padding:12px;color:var(--gray-500);">Aucun créneau disponible avec cette configuration.</p>';
        return;
    }

    let html = '<div class="planner-grid">';
    html += '<div class="planner-cell head">Heure</div>';
    dayNames.forEach((d) => { html += `<div class="planner-cell head">${d}</div>`; });

    slots.forEach((slot) => {
        html += `<div class="planner-cell time">${slot.label}</div>`;
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            const entryKey = `${dayIndex}|${slot.key}`;
            const entry = weeklyPlannerConfig.entries[entryKey] || null;
            const hasTask = Boolean(entry?.title);
            html += `<div class="planner-cell planner-slot ${hasTask ? 'has-task' : ''}" data-day="${dayIndex}" data-slot="${slot.key}">
                        ${hasTask ? `<div class="planner-task-title">${escapeHtml(entry.title)}</div><div class="planner-task-meta">${escapeHtml(entry.details || '')}</div>` : '<div class="planner-task-meta">Cliquez pour ajouter</div>'}
                    </div>`;
        }
    });

    html += '</div>';
    wrap.innerHTML = html;

    wrap.querySelectorAll('.planner-slot').forEach((cell) => {
        cell.addEventListener('click', () => {
            const dayIndex = Number(cell.getAttribute('data-day'));
            const slotKey = cell.getAttribute('data-slot');
            editPlannerCell(dayIndex, slotKey);
        });
    });
}

async function editPlannerCell(dayIndex, slotKey) {
    const key = `${dayIndex}|${slotKey}`;
    const existing = weeklyPlannerConfig.entries[key] || {};

    const values = await openEntityForm({
        title: 'Modifier un créneau du planner',
        subtitle: 'Laissez le titre vide puis cliquez sur enregistrer pour supprimer la tâche.',
        submitLabel: 'Enregistrer',
        fields: [
            { key: 'title', label: 'Titre de la tâche', type: 'text', value: existing.title || '', placeholder: 'Ex: Révision Algo' },
            { key: 'details', label: 'Détails (optionnel)', type: 'textarea', value: existing.details || '', full: true, placeholder: 'Salle, groupe, notes...' },
            { key: 'teacher', label: 'Chargé / enseignant (optionnel)', type: 'text', value: existing.teacher || '', placeholder: 'Nom enseignant' },
            { key: 'photo', label: 'Photo (optionnel)', type: 'file', accept: 'image/*', full: true }
        ]
    });

    if (values === null) return;

    const trimmedTitle = String(values.title || '').trim();
    if (!trimmedTitle) {
        delete weeklyPlannerConfig.entries[key];
    } else {
        weeklyPlannerConfig.entries[key] = {
            title: trimmedTitle,
            details: String(values.details || '').trim(),
            teacher: String(values.teacher || '').trim(),
            photo: pendingEntityPhotoDataUrl || existing.photo || '',
            updatedAt: new Date().toISOString()
        };
    }

    const user = getCurrentUser();
    const persisted = await persistWeeklyPlannerConfig(user?.id);
    if (!persisted) {
        showNotification('Sauvegarde locale uniquement (API indisponible).', 'error');
    }
    renderWeeklyPlannerGrid();
    loadUpcomingItems();
}

function getPlannerTasksForUpcoming() {
    const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const tasks = [];

    Object.entries(weeklyPlannerConfig.entries || {}).forEach(([key, entry]) => {
        if (!entry || !entry.title) return;
        const [dayStr, slot] = key.split('|');
        const dayIndex = Number(dayStr);
        if (!Number.isFinite(dayIndex) || !slot) return;

        const [start] = slot.split('-');
        tasks.push({
            title: entry.title,
            details: entry.details || '',
            dayName: dayNames[dayIndex] || 'Jour',
            timeLabel: `${minutesToLabel(Number(start || 0))}`,
            sortDay: dayIndex,
            sortTime: Number(start || 0)
        });
    });

    tasks.sort((a, b) => (a.sortDay - b.sortDay) || (a.sortTime - b.sortTime));
    return tasks;
}

async function loadRecentActivities() {
    const list = document.getElementById('recent-activities-list');
    if (!list) return;

    list.innerHTML = '<p class="loading-text"><i class="fas fa-spinner fa-spin"></i> Chargement...</p>';
    const logs = await apiCall('/admin/moderation-log');

    if (!Array.isArray(logs) || logs.length === 0) {
        list.innerHTML = '<p class="empty-state" style="padding:12px;color:var(--gray-500);">Aucune activité récente pour le moment.</p>';
        return;
    }

    const actionToColor = {
        CREATE: 'blue',
        CREATE_COURS: 'blue',
        EDIT: 'green',
        ARCHIVE: 'orange',
        CREATE_UPCOMING: 'purple'
    };

    list.innerHTML = logs.slice(0, 12).map((log) => {
        const color = actionToColor[log.action] || 'blue';
        const actor = `${log.prenom || ''} ${log.nom || ''}`.trim() || `User ${log.moderator_id}`;
        return `
            <div class="activity-item">
                <div class="activity-icon ${color}"><i class="fas fa-history"></i></div>
                <div class="activity-content">
                    <p><strong>${escapeHtml(log.action)}</strong></p>
                    <small>${escapeHtml(log.raison || `${log.contenu_type} #${log.contenu_id}`)} • ${escapeHtml(actor)}</small>
                    <span class="time">${escapeHtml(formatRelative(log.created_at))}</span>
                </div>
            </div>`;
    }).join('');
}

async function loadUpcomingItems() {
    const list = document.getElementById('upcoming-list');
    if (!list) return;

    list.innerHTML = '<p class="loading-text"><i class="fas fa-spinner fa-spin"></i> Chargement...</p>';
    const user = getCurrentUser();
    const plannerTasks = getPlannerTasksForUpcoming();
    let remoteUpcoming = [];

    if (isAdminUser(user) || isModeratorUser(user)) {
        const remote = await apiCall('/admin/upcoming');
        if (Array.isArray(remote)) {
            remoteUpcoming = remote;
        }
    }

    if (plannerTasks.length === 0 && remoteUpcoming.length === 0) {
        list.innerHTML = '<p class="empty-state" style="padding:12px;color:var(--gray-500);">Aucun élément à venir. Ouvrez le planner semaine pour commencer.</p>';
        return;
    }

    const plannerHtml = plannerTasks.slice(0, 14).map((task) => {
        return `
            <div class="upcoming-item">
                <div class="date-badge">
                    <span class="day"><i class="fas fa-clock"></i></span>
                    <span class="month">${escapeHtml(task.timeLabel)}</span>
                </div>
                <div class="upcoming-content">
                    <p><strong>${escapeHtml(task.title)}</strong></p>
                    <small>${escapeHtml(task.dayName)}${task.details ? ` - ${escapeHtml(task.details)}` : ''}</small>
                </div>
            </div>`;
    }).join('');

    const remoteHtml = remoteUpcoming.slice(0, 8).map((item) => {
        const d = new Date(item.date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
        const moduleNiveau = [item.module, item.niveau].filter(Boolean).join(' - ');
        const location = item.location ? ` - ${item.location}` : '';
        const logo = item.logo_url ? `<img class="upcoming-logo" src="${escapeHtml(item.logo_url)}" alt="Logo ${escapeHtml(item.title || 'Evenement')}">` : '';

        return `
            <div class="upcoming-item">
                <div class="date-badge">
                    <span class="day">${day}</span>
                    <span class="month">${escapeHtml(month)}</span>
                </div>
                <div class="upcoming-content">
                    ${logo}
                    <p><strong>${escapeHtml(item.title || 'Événement')}</strong></p>
                    <small>${escapeHtml(moduleNiveau + location)}${item.notes ? ` - ${escapeHtml(item.notes)}` : ''}</small>
                </div>
            </div>`;
    }).join('');

    list.innerHTML = `
        ${plannerHtml}
        ${remoteHtml ? '<div class="planner-task-meta" style="padding:6px 10px;">Événements équipe / admin</div>' : ''}
        ${remoteHtml}
    `;
}

function initAdminPanel(user) {
    const resourcesSection = document.getElementById('resources-section');
    if (!resourcesSection) return;
    if (resourcesSection.dataset.adminBound === '1') return;
    resourcesSection.dataset.adminBound = '1';

    document.getElementById('add-module-btn')?.addEventListener('click', () => adminAddModule(getCurrentUser()));
    document.getElementById('assign-moderator-btn')?.addEventListener('click', () => adminAssignModerator());
}

async function adminAddModule(user) {
    const values = await openEntityForm({
        title: 'Créer un module',
        subtitle: 'Créez le module d abord, puis ajoutez les ressources dedans.',
        submitLabel: 'Créer module',
        fields: [
            { key: 'nom', label: 'Nom du module', type: 'text', required: true, placeholder: 'Ex: Systèmes d’exploitation' },
            { key: 'niveau', label: 'Niveau', type: 'select', required: true, value: 'L1', options: ['L1', 'L2', 'L3'] },
            { key: 'description', label: 'Description (optionnel)', type: 'textarea', full: true, placeholder: 'Résumé du module' },
            { key: 'logo', label: 'Logo module (optionnel)', type: 'file', accept: 'image/*', full: true }
        ]
    });

    if (!values) return;

    const result = await apiCall('/admin/modules', 'POST', {
        nom: values.nom,
        niveau: values.niveau,
        description: values.description || null,
        logo_url: values.logoDataUrl || null
    });
    if (result?.error) {
        showNotification(result.error, 'error');
        return;
    }

    showNotification('Module créé avec succès !', 'success');
    const grid = document.getElementById(`l${String(values.niveau).slice(1).toLowerCase()}-grid`);
    if (grid) loadAndRenderResources(values.niveau, grid);
}

function getQuickTypeLabel(type) {
    return {
        COURS: 'Cours',
        TD: 'TD',
        TP: 'TP',
        EXAMEN: 'Examen',
        CORRIGE: 'Corrigé',
        PLAYLIST: 'Playlist'
    }[type] || type;
}

async function adminAddResource(user, options = {}) {
    const presetModule = options.moduleName || '';
    const presetNiveau = options.niveau || 'L1';
    const presetType = options.type || 'COURS';
    const presetCorrectionTarget = options.correctionTarget || '';

    const values = await openEntityForm({
        title: 'Ajouter une ressource pédagogique',
        subtitle: 'Créez une fiche claire avec responsable et illustration.',
        submitLabel: 'Créer la ressource',
        fields: [
            { key: 'titre', label: 'Nom de la ressource', type: 'text', required: true, placeholder: 'Ex: Cours Réseau 1' },
            { key: 'moduleName', label: 'Module', type: 'text', required: true, value: presetModule, placeholder: 'Ex: Réseaux' },
            { key: 'niveau', label: 'Niveau', type: 'select', required: true, value: presetNiveau, options: ['L1', 'L2', 'L3'] },
            { key: 'type', label: 'Type', type: 'select', required: true, value: presetType, options: ['COURS', 'TD', 'TP', 'EXAMEN', 'CORRIGE', 'PLAYLIST'] },
            { key: 'correctionTarget', label: 'Type de corrigé', type: 'select', value: presetCorrectionTarget, options: ['', 'TD', 'TP', 'EXAMEN'] },
            { key: 'teacher', label: 'Chargé de la matière', type: 'text', placeholder: 'Nom du chargé' },
            { key: 'description', label: 'Description', type: 'textarea', full: true, placeholder: 'Résumé rapide de la ressource' },
            { key: 'logo', label: 'Logo/Photo du cours (optionnel)', type: 'file', accept: 'image/*', full: true },
            { key: 'courseFile', label: 'Fichier du cours (PDF/DOC) (optionnel)', type: 'file', accept: '.pdf,.doc,.docx,.ppt,.pptx,.txt', full: true },
            { key: 'videoLink', label: 'Lien vidéo / playlist (optionnel)', type: 'url', placeholder: 'https://youtube.com/...' }
        ]
    });

    if (!values) return;

    const titre = values.titre;
    const moduleName = values.moduleName;
    const niveau = values.niveau;
    const type = values.type;
    const descriptionParts = [values.description, values.teacher ? `Chargé: ${values.teacher}` : null].filter(Boolean);
    const description = descriptionParts.join('\n');
    const logoUrl = values.logoDataUrl || null;
    const courseFileUrl = values.courseFileDataUrl || null;
    const videoLink = values.videoLink || null;
    const nombreChapitres = type === 'COURS' ? 1 : null;
    const nombreVideos = type === 'PLAYLIST' ? 1 : null;
    const correctionTarget = type === 'CORRIGE'
        ? (values.correctionTarget || presetCorrectionTarget || null)
        : null;

    if (!['L1', 'L2', 'L3'].includes(niveau)) { showNotification('Niveau invalide', 'error'); return; }
    if (!['COURS', 'TD', 'TP', 'EXAMEN', 'CORRIGE', 'PLAYLIST'].includes(type)) { showNotification('Type invalide', 'error'); return; }
    if (type === 'PLAYLIST' && !videoLink) { showNotification('Lien vidéo requis pour une PLAYLIST', 'error'); return; }
    if (type === 'CORRIGE' && correctionTarget && !['TD', 'TP', 'EXAMEN'].includes(correctionTarget)) {
        showNotification('Type de corrigé invalide.', 'error');
        return;
    }

    const result = await apiCall('/resources', 'POST', {
        titre,
        module: moduleName,
        niveau,
        resource_type: type,
        correction_target: correctionTarget,
        description,
        logo_url: logoUrl,
        fichier_pdf: courseFileUrl,
        url_youtube: videoLink,
        nombre_chapitres: nombreChapitres,
        nombre_videos: nombreVideos
    });
    if (result?.error) { showNotification(result.error, 'error'); return; }
    showNotification(`Ressource "${titre}" créée avec succès !`, 'success');
    const detailSectionActive = document.getElementById('module-detail-section');
    if (detailSectionActive?.classList.contains('active')) {
        reloadCurrentModulePage();
    } else {
        const grid = document.getElementById(`l${niveau.slice(1).toLowerCase()}-grid`);
        if (grid) loadAndRenderResources(niveau, grid);
    }
    loadDashboardStats();
    loadRecentActivities();
}

async function adminEditResource(user, resourceId, prefill = {}) {
    const values = await openEntityForm({
        title: 'Modifier la ressource',
        subtitle: 'Mettez à jour les informations de la ressource.',
        submitLabel: 'Enregistrer',
        fields: [
            { key: 'titre', label: 'Titre', type: 'text', required: true, value: prefill.titre || '' },
            { key: 'moduleName', label: 'Module', type: 'text', value: prefill.module || '', placeholder: 'Nom du module' },
            { key: 'niveau', label: 'Niveau', type: 'select', value: prefill.niveau || 'L1', options: ['L1', 'L2', 'L3'] },
            { key: 'description', label: 'Description', type: 'textarea', full: true, value: prefill.description || '' },
            { key: 'videoLink', label: 'Lien vidéo (optionnel)', type: 'url', value: prefill.url_youtube || '', placeholder: 'https://youtube.com/...' },
            { key: 'courseFile', label: 'Nouveau fichier (optionnel)', type: 'file', accept: '.pdf,.doc,.docx,.ppt,.pptx,.txt', full: true },
            { key: 'logo', label: 'Nouveau logo (optionnel)', type: 'file', accept: 'image/*', full: true }
        ]
    });
    if (!values) return;

    const body = {
        titre: values.titre,
        module: values.moduleName || undefined,
        niveau: values.niveau || undefined,
        description: values.description || undefined,
        url_youtube: values.videoLink || prefill.url_youtube || undefined
    };
    if (values.courseFileDataUrl) body.fichier_pdf = values.courseFileDataUrl;
    if (values.logoDataUrl) body.logo_url = values.logoDataUrl;

    const result = await apiCall(`/resources/${resourceId}`, 'PUT', body);
    if (result?.error) { showNotification(result.error, 'error'); return; }
    showNotification('Ressource mise à jour !', 'success');
    if (document.getElementById('module-detail-section')?.classList.contains('active')) {
        reloadCurrentModulePage();
    } else {
        ['L1', 'L2', 'L3'].forEach(n => {
            const grid = document.getElementById(`l${n.slice(1).toLowerCase()}-grid`);
            if (grid && grid.children.length > 0) loadAndRenderResources(n, grid);
        });
    }
    loadRecentActivities();
}

async function adminDeleteResource(user, resourceId, titre) {
    const confirmed = await openEntityForm({
        title: 'Archiver la ressource',
        subtitle: `Voulez-vous archiver « ${titre} » ? Elle ne sera plus visible.`,
        submitLabel: 'Archiver',
        fields: []
    });
    if (!confirmed) return;

    const result = await apiCall(`/resources/${resourceId}`, 'DELETE', {});
    if (result?.error) { showNotification(result.error, 'error'); return; }
    showNotification('Ressource archivée.', 'success');
    if (document.getElementById('module-detail-section')?.classList.contains('active')) {
        reloadCurrentModulePage();
    } else {
        ['L1', 'L2', 'L3'].forEach(n => {
            const grid = document.getElementById(`l${n.slice(1).toLowerCase()}-grid`);
            if (grid && grid.children.length > 0) loadAndRenderResources(n, grid);
        });
    }
    loadDashboardStats();
    loadRecentActivities();
}

async function adminAssignModerator() {
    const matricule = prompt('Matricule de l\'utilisateur à désigner modérateur :');
    if (!matricule) return;
    const moduleName = prompt('Module (ex: Programmation) :');
    if (!moduleName) return;
    const niveau = prompt('Niveau (L1, L2, L3) :', 'L1');
    if (!['L1', 'L2', 'L3'].includes(niveau)) { showNotification('Niveau invalide', 'error'); return; }

    const searchRes = await apiCall(`/admin/search?q=${encodeURIComponent(matricule)}`);
    const users = searchRes?.results?.users;
    const found = Array.isArray(users) ? users.find((u) => u.matricule === matricule) : null;
    if (!found) { showNotification('Utilisateur non trouvé', 'error'); return; }

    const result = await apiCall('/admin/moderateurs/assign', 'POST', { moderator_id: found.id, module: moduleName, niveau });
    if (result?.error) { showNotification(result.error, 'error'); return; }
    showNotification(`${found.prenom} ${found.nom} assigné(e) modérateur de ${moduleName} - ${niveau} !`, 'success');
}

function handleAdminAction(action, user) {
    // Conservé pour rétrocompatibilité
    console.log('handleAdminAction:', action);
}

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');

    // Clic logo → retour Ressources si on est dans la page détail d'un module
    const navBrand = document.getElementById('navbar-brand-btn');
    navBrand?.addEventListener('click', () => {
        const detailSection = document.getElementById('module-detail-section');
        if (detailSection?.classList.contains('active')) {
            _currentModulePageState = null;
            navItems.forEach(n => n.classList.remove('active'));
            document.querySelector('.nav-item[data-section="resources"]')?.classList.add('active');
            contentSections.forEach(s => s.classList.remove('active'));
            document.getElementById('resources-section')?.classList.add('active');
        }
    });

    navItems.forEach((item) => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSection = item.getAttribute('data-section');

            navItems.forEach((nav) => nav.classList.remove('active'));
            item.classList.add('active');

            contentSections.forEach((section) => section.classList.remove('active'));
            document.getElementById(`${targetSection}-section`)?.classList.add('active');
        });
    });
}

function buildEntityFormField(field) {
    const requiredMark = field.required ? ' *' : '';
    const fullClass = field.full ? ' full' : '';
    const name = escapeHtml(field.key);
    const label = escapeHtml(field.label || field.key);

    if (field.type === 'select') {
        const options = (field.options || []).map((opt) => {
            const selected = String(field.value || '') === String(opt) ? 'selected' : '';
            return `<option value="${escapeHtml(String(opt))}" ${selected}>${escapeHtml(String(opt))}</option>`;
        }).join('');

        return `
            <div class="entity-field${fullClass}">
                <label for="entity_${name}">${label}${requiredMark}</label>
                <select id="entity_${name}" name="${name}" ${field.required ? 'required' : ''}>${options}</select>
            </div>
        `;
    }

    if (field.type === 'textarea') {
        return `
            <div class="entity-field${fullClass}">
                <label for="entity_${name}">${label}${requiredMark}</label>
                <textarea id="entity_${name}" name="${name}" ${field.required ? 'required' : ''} placeholder="${escapeHtml(field.placeholder || '')}">${escapeHtml(field.value || '')}</textarea>
            </div>
        `;
    }

    if (field.type === 'file') {
        return `
            <div class="entity-field${fullClass}">
                <label for="entity_${name}">${label}${requiredMark}</label>
                <input id="entity_${name}" name="${name}" type="file" data-file-key="${name}" accept="${escapeHtml(field.accept || 'image/*')}" ${field.required ? 'required' : ''}>
                <small>Optionnel. Format image recommandé: PNG/JPG.</small>
                <img id="entity_preview_${name}" class="entity-photo-preview" alt="Aperçu fichier">
            </div>
        `;
    }

    return `
        <div class="entity-field${fullClass}">
            <label for="entity_${name}">${label}${requiredMark}</label>
            <input id="entity_${name}" name="${name}" type="${escapeHtml(field.type || 'text')}" value="${escapeHtml(field.value || '')}" placeholder="${escapeHtml(field.placeholder || '')}" ${field.required ? 'required' : ''}>
        </div>
    `;
}

async function openEntityForm(config) {
    const modal = document.getElementById('entity-form-modal');
    const panel = document.getElementById('entity-form-content');
    const titleEl = document.getElementById('entity-form-title');
    const subtitleEl = document.getElementById('entity-form-subtitle');
    const closeBtn = document.getElementById('entity-form-close');

    if (!modal || !panel || !titleEl || !subtitleEl || !closeBtn) {
        showNotification('Interface de formulaire indisponible.', 'error');
        return null;
    }

    pendingEntityPhotoDataUrl = '';
    pendingEntityFileMap = {};
    titleEl.innerHTML = `<i class="fas fa-pen"></i> ${escapeHtml(config.title || 'Formulaire')}`;
    subtitleEl.textContent = config.subtitle || '';

    panel.innerHTML = `
        <div class="entity-form-grid">
            ${(config.fields || []).map(buildEntityFormField).join('')}
        </div>
        <div class="entity-form-actions">
            <button type="button" class="entity-secondary-btn" id="entity-form-cancel">Annuler</button>
            <button type="submit" class="entity-primary-btn">${escapeHtml(config.submitLabel || 'Valider')}</button>
        </div>
    `;

    const cleanup = () => {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        pendingEntityPhotoDataUrl = '';
        pendingEntityFileMap = {};
    };

    const bindImagePreview = () => {
        const fileInputs = panel.querySelectorAll('input[type="file"][data-file-key]');
        if (!fileInputs.length) return;

        fileInputs.forEach((fileInput) => {
            fileInput.addEventListener('change', async () => {
                const file = fileInput.files?.[0];
                const key = fileInput.getAttribute('data-file-key') || 'file';
                const preview = document.getElementById(`entity_preview_${key}`);

                if (!file) {
                    delete pendingEntityFileMap[key];
                    if (preview) {
                        preview.style.display = 'none';
                        preview.removeAttribute('src');
                    }
                    return;
                }

                const dataUrl = await fileToDataUrl(file);
                pendingEntityFileMap[key] = dataUrl;

                if (preview && file.type.startsWith('image/')) {
                    preview.src = dataUrl;
                    preview.style.display = 'block';
                } else if (preview) {
                    preview.style.display = 'none';
                    preview.removeAttribute('src');
                }
            });
        });
    };

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    bindImagePreview();

    return new Promise((resolve) => {
        const cancelBtn = document.getElementById('entity-form-cancel');

        const onClose = () => {
            cleanup();
            resolve(null);
        };

        const onSubmit = (e) => {
            e.preventDefault();
            const values = {};
            const fields = config.fields || [];
            for (const field of fields) {
                const element = panel.querySelector(`[name="${CSS.escape(field.key)}"]`);
                if (!element) continue;
                if (field.type === 'file') continue;
                values[field.key] = String(element.value || '').trim();
                if (field.required && !values[field.key]) {
                    showNotification(`Champ requis: ${field.label}`, 'error');
                    element.focus();
                    return;
                }
            }

            Object.entries(pendingEntityFileMap).forEach(([key, dataUrl]) => {
                values[`${key}DataUrl`] = dataUrl;
            });

            cleanup();
            resolve(values);
        };

        closeBtn.onclick = onClose;
        cancelBtn.onclick = onClose;
        modal.onclick = (ev) => {
            if (ev.target === modal) onClose();
        };
        panel.onsubmit = onSubmit;
    });
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function initLevelTabs() {
    const levelTabs = document.querySelectorAll('.level-tab');

    levelTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const targetLevel = tab.getAttribute('data-level');
            levelTabs.forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.level-panel').forEach((p) => p.classList.remove('active'));
            const panel = document.getElementById(`${targetLevel}-content`);
            if (panel) panel.classList.add('active');

            // Charger les ressources depuis l'API si pas déjà fait
            const niveauMap = { l1: 'L1', l2: 'L2', l3: 'L3' };
            const niveau = niveauMap[targetLevel];
            const grid = document.getElementById(`${targetLevel}-grid`);
            if (grid && grid.children.length === 0) {
                loadAndRenderResources(niveau, grid);
            }
        });
    });
}

function initResourcesInteractions() {
    // Les interactions sont attachées dynamiquement dans loadAndRenderResources
}

function classifyResourceSection(resource) {
    const type = String(resource?.resource_type || '').toUpperCase();
    const corr = String(resource?.correction_target || '').toUpperCase();
    if (type === 'COURS') return 'COURS';
    if (type === 'TD') return 'TD';
    if (type === 'TP') return 'TP';
    if (type === 'EXAMEN') return 'EXAMEN';
    if (type === 'PLAYLIST') return 'PLAYLIST';
    if (type === 'CORRIGE') {
        if (corr === 'TD') return 'CORRIGE_TD';
        if (corr === 'TP') return 'CORRIGE_TP';
        if (corr === 'EXAMEN') return 'CORRIGE_EXAMEN';

        const text = `${resource?.titre || ''} ${resource?.description || ''}`.toUpperCase();
        if (text.includes('TD')) return 'CORRIGE_TD';
        if (text.includes('TP')) return 'CORRIGE_TP';
        if (text.includes('EXAMEN')) return 'CORRIGE_EXAMEN';
    }
    return 'AUTRE';
}

function getModuleSections() {
    return [
        { key: 'COURS', title: 'Cours', type: 'COURS' },
        { key: 'TD', title: 'TD', type: 'TD' },
        { key: 'TP', title: 'TP', type: 'TP' },
        { key: 'CORRIGE_TD', title: 'Corrigés TD', type: 'CORRIGE', correctionTarget: 'TD' },
        { key: 'CORRIGE_TP', title: 'Corrigés TP', type: 'CORRIGE', correctionTarget: 'TP' },
        { key: 'EXAMEN', title: 'Examens', type: 'EXAMEN' },
        { key: 'CORRIGE_EXAMEN', title: 'Corrigés Examens', type: 'CORRIGE', correctionTarget: 'EXAMEN' },
        { key: 'PLAYLIST', title: 'Playlists', type: 'PLAYLIST' }
    ];
}

function renderResourceRow(resource, canManage = false) {
    const typeConfig = {
        COURS:    { icon: 'fa-book-open',      label: 'Cours' },
        TD:       { icon: 'fa-file-alt',       label: 'TD' },
        TP:       { icon: 'fa-flask',          label: 'TP' },
        EXAMEN:   { icon: 'fa-clipboard-list', label: 'Examen' },
        CORRIGE:  { icon: 'fa-check-circle',   label: 'Corrigé' },
        PLAYLIST: { icon: 'fa-youtube',        label: 'Playlist', brand: true }
    };
    const cfg = typeConfig[resource.resource_type] || { icon: 'fa-file', label: resource.resource_type };
    const iconClass = cfg.brand ? `fab ${cfg.icon}` : `fas ${cfg.icon}`;
    const logo = resource.logo_url ? `<img class="resource-logo" src="${escapeHtml(resource.logo_url)}" alt="Logo ${escapeHtml(resource.titre)}">` : '';
    const openFileBtn = resource.fichier_pdf ? `<button class="resource-chip" type="button" data-action="open-file" data-url="${escapeHtml(resource.fichier_pdf)}"><i class="fas fa-file-arrow-down"></i> Fichier</button>` : '';
    const openVideoBtn = resource.url_youtube ? `<button class="resource-chip" type="button" data-action="open-video" data-url="${escapeHtml(resource.url_youtube)}"><i class="fab fa-youtube"></i> Vidéo</button>` : '';
    const editBtn = canManage ? `<button class="resource-chip resource-chip-edit" type="button" data-action="edit"><i class="fas fa-pen"></i></button>` : '';
    const deleteBtn = canManage ? `<button class="resource-chip resource-chip-delete" type="button" data-action="delete"><i class="fas fa-trash"></i></button>` : '';

    return `
        <div class="resource-item" data-id="${resource.id_ressource}" data-type="${resource.resource_type}"
             data-titre="${escapeHtml(resource.titre)}"
             data-module="${escapeHtml(resource.module || '')}"
             data-niveau="${escapeHtml(resource.niveau || '')}"
             data-description="${escapeHtml(resource.description || '')}"
             data-url-youtube="${escapeHtml(resource.url_youtube || '')}">
            <div class="resource-main">
                <i class="${iconClass}"></i>
                ${logo}
                <div class="resource-main-text">
                    <span class="resource-title">${escapeHtml(resource.titre)}</span>
                    <small class="resource-meta">${escapeHtml(cfg.label)}${resource.description ? ` - ${escapeHtml(String(resource.description).slice(0, 90))}` : ''}</small>
                </div>
            </div>
            <div class="resource-actions-inline">
                ${openFileBtn}
                ${openVideoBtn}
                ${editBtn}
                ${deleteBtn}
            </div>
        </div>`;
}

// =====================================================
// Chargement dynamique des ressources depuis l'API
// =====================================================
async function loadAndRenderResources(niveau, grid) {
    if (!grid) grid = document.getElementById(`l${niveau.slice(1).toLowerCase()}-grid`);
    if (!grid) return;

    grid.innerHTML = '<p class="loading-text"><i class="fas fa-spinner fa-spin"></i> Chargement...</p>';

    const resources = await apiCall(`/resources?niveau=${niveau}`);
    const modulesApi = await apiCall('/admin/modules');
    const modulesCatalog = Array.isArray(modulesApi)
        ? modulesApi.filter((m) => String(m.niveau || '').toUpperCase() === String(niveau).toUpperCase())
        : [];

    if ((!Array.isArray(resources) || resources.length === 0) && modulesCatalog.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-500);">
                <i class="fas fa-folder-open" style="font-size:48px;margin-bottom:12px;display:block;"></i>
                <p>Aucune ressource disponible pour ce niveau.</p>
                <small>Un administrateur peut en ajouter via le panneau de gestion.</small>
            </div>`;
        return;
    }

    // Grouper par module (catalogue + ressources)
    const byModule = {};
    modulesCatalog.forEach((m) => {
        const key = String(m.nom || '').trim();
        if (!key) return;
        byModule[key] = {
            moduleInfo: m,
            items: []
        };
    });

    (Array.isArray(resources) ? resources : []).forEach((r) => {
        const key = String(r.module || '').trim();
        if (!key) return;
        if (!byModule[key]) {
            byModule[key] = { moduleInfo: null, items: [] };
        }
        byModule[key].items.push(r);
    });

    grid.innerHTML = '';
    Object.entries(byModule).forEach(([moduleName, bucket]) => {
        const moduleLogo = bucket.moduleInfo?.logo_url
            ? `<img class="resource-logo" src="${escapeHtml(bucket.moduleInfo.logo_url)}" alt="Logo module ${escapeHtml(moduleName)}">`
            : '';
        const moduleDesc = bucket.moduleInfo?.description ? `<small class="resource-meta">${escapeHtml(bucket.moduleInfo.description)}</small>` : '';
        const itemCount = (bucket.items || []).length;

        const card = document.createElement('div');
        card.className = 'module-card module-card-nav';
        card.innerHTML = `
            <button class="module-header module-toggle" type="button">
                <div class="module-icon"><i class="fas fa-book"></i></div>
                <h3>${escapeHtml(moduleName)}</h3>
                ${moduleLogo}
                ${moduleDesc}
                <span class="module-resource-count">${itemCount} ressource${itemCount !== 1 ? 's' : ''}</span>
                <span class="module-nav-arrow"><i class="fas fa-chevron-right"></i></span>
            </button>`;
        card.querySelector('.module-toggle').addEventListener('click', () => {
            showModulePage(moduleName, niveau, bucket);
        });
        grid.appendChild(card);
    });
}

function showModulePage(moduleName, niveau, bucket) {
    _currentModulePageState = { moduleName, niveau, bucket };
    const detailSection = document.getElementById('module-detail-section');
    const page = document.getElementById('module-detail-page');
    if (!detailSection || !page) return;
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    detailSection.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    _renderModulePage(page, moduleName, niveau, bucket);
}

function _renderModulePage(page, moduleName, niveau, bucket) {
    const user = getCurrentUser();
    const canManage = isAdminUser(user) || isModeratorUser(user);
    const items = bucket.items || [];
    const sections = getModuleSections();
    const itemsBySection = {};
    sections.forEach(s => { itemsBySection[s.key] = []; });
    items.forEach(r => {
        const key = classifyResourceSection(r);
        if (!itemsBySection[key]) itemsBySection[key] = [];
        itemsBySection[key].push(r);
    });

    const moduleLogo = bucket.moduleInfo?.logo_url
        ? `<img class="module-detail-hero-logo" src="${escapeHtml(bucket.moduleInfo.logo_url)}" alt="Logo ${escapeHtml(moduleName)}">`
        : `<div class="module-detail-hero-logo module-detail-logo-placeholder"><i class="fas fa-book"></i></div>`;
    const moduleDesc = bucket.moduleInfo?.description ? `<p>${escapeHtml(bucket.moduleInfo.description)}</p>` : '';

    const sectionsHtml = sections.map(section => {
        const sectionItems = itemsBySection[section.key] || [];
        const addBtn = canManage
            ? `<button class="module-quick-btn module-detail-add-btn" type="button"
                data-module="${escapeHtml(moduleName)}"
                data-niveau="${escapeHtml(niveau)}"
                data-quick-type="${section.type}"
                data-correction-target="${escapeHtml(section.correctionTarget || '')}">
                <i class="fas fa-plus"></i> Ajouter
               </button>`
            : '';
        const resourcesHtml = sectionItems.length
            ? sectionItems.map(r => renderResourceRow(r, canManage)).join('')
            : `<p class="module-detail-empty"><i class="fas fa-folder-open"></i> Aucune ressource</p>`;

        return `
            <div class="module-detail-section-card">
                <div class="module-detail-section-header">
                    <h3><i class="fas ${getSectionIcon(section.key)}"></i> ${escapeHtml(section.title)}</h3>
                    ${addBtn}
                </div>
                <div class="module-detail-section-body">
                    ${resourcesHtml}
                </div>
            </div>`;
    }).join('');

    page.innerHTML = `
        <div class="module-detail-hero">
            ${moduleLogo}
            <div class="module-detail-hero-text">
                <h2>${escapeHtml(moduleName)}</h2>
                ${moduleDesc}
                <span class="module-detail-level-badge">${escapeHtml(niveau)}</span>
            </div>
        </div>
        <div class="module-detail-sections">
            ${sectionsHtml}
        </div>`;

    page.querySelectorAll('.module-detail-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            adminAddResource(getCurrentUser(), {
                moduleName: btn.getAttribute('data-module') || '',
                niveau: btn.getAttribute('data-niveau') || niveau,
                type: btn.getAttribute('data-quick-type') || 'COURS',
                correctionTarget: btn.getAttribute('data-correction-target') || ''
            });
        });
    });

    page.querySelectorAll('.resource-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const action = chip.getAttribute('data-action');
            const url = chip.getAttribute('data-url') || '';
            if (action === 'open-video' && url) window.open(url, '_blank', 'noopener');
            if (action === 'open-file' && url) openAttachmentUrl(url);
            if (action === 'edit') {
                const item = chip.closest('.resource-item');
                adminEditResource(getCurrentUser(), item.dataset.id, {
                    titre: item.dataset.titre,
                    module: item.dataset.module,
                    niveau: item.dataset.niveau,
                    description: item.dataset.description,
                    url_youtube: item.dataset.urlYoutube
                });
            }
            if (action === 'delete') {
                const item = chip.closest('.resource-item');
                adminDeleteResource(getCurrentUser(), item.dataset.id, item.dataset.titre);
            }
        });
    });
}

function getSectionIcon(key) {
    const icons = {
        COURS: 'fa-book-open', TD: 'fa-file-alt', TP: 'fa-flask',
        CORRIGE_TD: 'fa-check-circle', CORRIGE_TP: 'fa-check-circle',
        EXAMEN: 'fa-clipboard-list', CORRIGE_EXAMEN: 'fa-check-double', PLAYLIST: 'fa-youtube'
    };
    return icons[key] || 'fa-folder';
}

async function reloadCurrentModulePage() {
    if (!_currentModulePageState) return;
    const { moduleName, niveau } = _currentModulePageState;
    const [resources, modulesApi] = await Promise.all([
        apiCall(`/resources?niveau=${niveau}`),
        apiCall('/admin/modules')
    ]);
    const modulesCatalog = Array.isArray(modulesApi) ? modulesApi : [];
    const moduleInfo = modulesCatalog.find(m => String(m.nom || '').trim() === moduleName) || null;
    const items = Array.isArray(resources) ? resources.filter(r => String(r.module || '').trim() === moduleName) : [];
    const bucket = { moduleInfo, items };
    _currentModulePageState.bucket = bucket;
    const page = document.getElementById('module-detail-page');
    if (page) _renderModulePage(page, moduleName, niveau, bucket);
}

function initSearch() {
    document.querySelectorAll('.search-box input').forEach((input) => {
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            performSearch(query);
        });
    });
}

async function performSearch(query) {
    if (!query) return;

    const res = await apiCall(`/admin/search?q=${encodeURIComponent(query)}`);
    const results = res?.results || { ressources: [], publications: [], users: [] };

    console.log('🔍 Résultats de recherche:', results);
    showNotification(`Recherche: ${results.ressources?.length || 0} ressource(s), ${results.publications?.length || 0} publication(s)`, 'info');
}

// ===================== NOTIFICATIONS =====================
async function updateNotificationBadge() {
    const data = await apiCall('/notifications/unread-count');
    const count = Number(data?.count || 0);
    notificationCount = count;
    const badge = document.getElementById('notification-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
}

async function loadNotificationsList() {
    const list = document.getElementById('notification-list');
    if (!list) return;

    list.innerHTML = '<p style="padding:12px;color:var(--gray-500);font-size:13px;"><i class="fas fa-spinner fa-spin"></i> Chargement...</p>';

    const notifications = await apiCall('/notifications');

    if (!Array.isArray(notifications) || notifications.length === 0) {
        list.innerHTML = '<p style="padding:16px;text-align:center;color:var(--gray-500);">Aucune notification.</p>';
        return;
    }

    list.innerHTML = notifications.map(n => `
        <div class="notification-item${n.is_read ? '' : ' unread'}" data-id="${n.id}" style="padding:12px 16px;border-bottom:1px solid #f1f5f9;cursor:pointer;${n.is_read ? '' : 'background:#f0f4ff;'}">
            <p style="margin:0;font-size:14px;color:#374151;">${escapeHtml(n.content || '')}</p>
            <small style="color:var(--gray-500);">${formatRelative(n.created_at)}</small>
        </div>
    `).join('');

    // Marquer comme lu au clic
    list.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', async () => {
            const id = item.dataset.id;
            await apiCall(`/notifications/${id}/read`, 'PUT', {});
            item.classList.remove('unread');
            item.style.background = '';
            updateNotificationBadge();
        });
    });
}

function initNotificationsPanel() {
    const btn = document.getElementById('notifications-btn');
    const panel = document.getElementById('notification-panel');
    const markAllBtn = document.getElementById('mark-all-read-btn');

    if (!btn || !panel) return;
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = panel.classList.toggle('open');
        if (isOpen) loadNotificationsList();
    });

    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && e.target !== btn) {
            panel.classList.remove('open');
        }
    });

    markAllBtn?.addEventListener('click', async () => {
        await apiCall('/notifications/read-all', 'PUT', {});
        updateNotificationBadge();
        loadNotificationsList();
        showNotification('Toutes les notifications marquées comme lues.', 'success');
    });
}

async function markNotificationAsRead(notificationId) {
    await apiCall(`/notifications/${notificationId}/read`, 'PUT', {});
    updateNotificationBadge();
}

async function markAllNotificationsAsRead() {
    await apiCall('/notifications/read-all', 'PUT', {});
    updateNotificationBadge();
}

// ===================== MODÉRATION =====================
function logModerationAction(moderatorId, contenuType, contenuId, action, raison) {
    state.moderation_log.push({
        id: nextId(state.moderation_log),
        moderator_id: moderatorId,
        contenu_type: contenuType,
        contenu_id: contenuId,
        action: action,
        raison: raison,
        created_at: new Date().toISOString()
    });
    saveState();
}

// ===================== CHAT =====================
function initChatModule() {
    const newChatBtn = document.getElementById('new-chat-btn');
    const sendBtn = document.querySelector('.btn-send');
    const chatInput = document.querySelector('.chat-input input');
    const chatAttachmentBtn = document.getElementById('chat-attachment-btn');

    // Créer input file caché pour chat
    createHiddenFileInput('chat-attachment-input', 'image/*, video/*, .pdf, .doc, .docx');

    renderChatList();

    newChatBtn?.addEventListener('click', () => {
        const name = prompt('Nom du nouveau chat groupe :');
        if (!name || !name.trim()) return;
        createChatGroup(name.trim());
        renderChatList();
        showNotification('Chat groupe créé (créateur admin par défaut).', 'success');
    });

    sendBtn?.addEventListener('click', sendCurrentMessage);
    chatInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendCurrentMessage();
    });

    chatAttachmentBtn?.addEventListener('click', () => {
        document.getElementById('chat-attachment-input')?.click();
    });

    document.getElementById('chat-attachment-input')?.addEventListener('change', (e) => {
        handleChatAttachment(e.target.files);
    });
}

function handleChatAttachment(files) {
    if (!files || files.length === 0) return;

    const file = files[0];
    const preview = document.getElementById('chat-attachment-preview');
    if (!preview) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        
        preview.innerHTML = `
            <div style="padding: 8px; background: #f1f5f9; border-radius: 6px; font-size: 12px;">
                <i class="fas fa-file"></i> ${file.name}
                <button type="button" class="btn-icon" onclick="clearAttachment('chat')" style="float: right;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Stocker temporairement
        window.chatAttachmentData = { name: file.name, data: dataUrl };
    };
    reader.readAsDataURL(file);
}

function getChatDisplayName(chat) {
    if (chat.chat_type === 'GRP') {
        return state.chat_grp.find((g) => g.chat_id === chat.id)?.nom || `Groupe ${chat.id}`;
    }

    const row = state.chat_prv.find((r) => r.chat_id === chat.id);
    const currentUserId = getCurrentUserId();
    if (!row) return `Chat privé ${chat.id}`;
    const otherId = row.user_a_id === currentUserId ? row.user_b_id : row.user_a_id;
    return getUserLabel(otherId);
}

function getUserLabel(userId) {
    const user = state.app_user.find((u) => u.id === userId);
    return user?.full_name || user?.username || `User ${userId}`;
}

async function renderChatList() {
    const chatList = document.querySelector('.chat-list');
    if (!chatList) return;

    chatList.innerHTML = '<p style="padding:12px;color:var(--gray-500);font-size:13px;"><i class="fas fa-spinner fa-spin"></i> Chargement...</p>';

    const chats = await apiCall('/chat');

    if (!Array.isArray(chats) || chats.length === 0) {
        chatList.innerHTML = '<p style="padding:12px;color:var(--gray-500);font-size:13px;">Aucune conversation. Créez-en une !</p>';
        return;
    }

    if (!selectedChatId) selectedChatId = chats[0].id;

    chatList.innerHTML = '';
    chats.forEach((chat) => {
        const item = document.createElement('div');
        item.className = `chat-item${chat.id === selectedChatId ? ' active' : ''}`;
        const icon = chat.type === 'GROUPE' ? 'fa-users' : 'fa-user';
        const name = chat.nom || `Chat ${chat.id}`;
        const lastMsg = chat.dernier_message ? escapeHtml(chat.dernier_message.substring(0, 40)) : 'Aucun message';
        const lastTime = chat.dernier_message_at ? formatHour(chat.dernier_message_at) : '-';

        item.innerHTML = `
            <div class="chat-avatar"><i class="fas ${icon}"></i></div>
            <div class="chat-info">
                <h4>${escapeHtml(name)}</h4>
                <p>${lastMsg}</p>
            </div>
            <div class="chat-meta"><span class="time">${lastTime}</span></div>
        `;

        item.addEventListener('click', () => {
            selectedChatId = chat.id;
            document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            loadChatMessages(chat);
        });
        chatList.appendChild(item);
    });

    // Charger les messages du chat actif
    const activeChat = chats.find((c) => c.id === selectedChatId) || chats[0];
    loadChatMessages(activeChat);
}

async function loadChatMessages(chat) {
    const wrapper = document.querySelector('.chat-messages');
    if (!wrapper) return;

    const headerTitle = document.getElementById('chat-header-title') || document.querySelector('.chat-header-info h3');
    const headerSub = document.getElementById('chat-header-sub') || document.querySelector('.chat-header-info small');

    const name = chat.nom || `Chat ${chat.id}`;
    if (headerTitle) headerTitle.textContent = name;
    if (headerSub) headerSub.textContent = chat.type === 'GROUPE' ? 'Groupe' : 'Conversation privée';

    wrapper.innerHTML = '<div class="message-date">Chargement...</div>';

    const messages = await apiCall(`/chat/${chat.id}/messages`);

    wrapper.innerHTML = '<div class="message-date">Aujourd\'hui</div>';

    if (!Array.isArray(messages) || messages.length === 0) {
        const empty = document.createElement('p');
        empty.style.cssText = 'text-align:center;padding:20px;color:var(--gray-500);';
        empty.textContent = 'Aucun message. Soyez le premier à écrire !';
        wrapper.appendChild(empty);
    } else {
        const currentUserId = getCurrentUserId();
        messages.forEach((msg) => {
            const isSent = msg.auteur_id === currentUserId;
            const node = document.createElement('div');
            node.className = `message ${isSent ? 'sent' : 'received'}`;
            const senderName = `${msg.prenom || ''} ${msg.nom || ''}`.trim() || 'Utilisateur';

            if (isSent) {
                node.innerHTML = `
                    <div class="message-content">
                        <div class="message-header"><span class="message-time">${formatHour(msg.created_at)}</span></div>
                        <div class="message-text">${escapeHtml(msg.content)}</div>
                    </div>`;
            } else {
                node.innerHTML = `
                    <div class="message-avatar"><i class="fas fa-user"></i></div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="sender-name">${escapeHtml(senderName)}</span>
                            <span class="message-time">${formatHour(msg.created_at)}</span>
                        </div>
                        <div class="message-text">${escapeHtml(msg.content)}</div>
                    </div>`;
            }
            wrapper.appendChild(node);
        });
    }

    const notice = document.createElement('div');
    notice.className = 'moderation-notice';
    notice.innerHTML = '<i class="fas fa-shield-alt"></i><span>Messages modérés automatiquement</span>';
    wrapper.appendChild(notice);
    wrapper.scrollTop = wrapper.scrollHeight;
}

async function sendCurrentMessage() {
    const input = document.querySelector('.chat-input input');
    const text = input?.value.trim();
    const content = text || (window.chatAttachmentData ? `📎 ${window.chatAttachmentData.name}` : '');
    if (!content || !selectedChatId) {
        showNotification('Message vide ou aucune conversation sélectionnée', 'error');
        return;
    }

    const result = await apiCall(`/chat/${selectedChatId}/messages`, 'POST', { content });
    if (result?.error) { showNotification(result.error, 'error'); return; }

    input.value = '';
    window.chatAttachmentData = null;
    clearAttachment('chat');

    // Recharger les messages
    const chats = await apiCall('/chat');
    const currentChat = Array.isArray(chats) ? chats.find(c => c.id === selectedChatId) : null;
    if (currentChat) loadChatMessages(currentChat);
}

async function createChatGroup(name) {
    const result = await apiCall('/chat/groupe', 'POST', { nom: name });
    if (result?.error) { showNotification(result.error, 'error'); return; }
    selectedChatId = result.chat?.id;
    renderChatList();
}

// ===================== SOCIAL / PUBLICATIONS =====================
function initSocialModule() {
    const publishBtn = document.getElementById('publish-btn');
    const postInput = document.getElementById('post-input');
    const postMediaBtn = document.getElementById('post-media-btn');
    const postDocumentBtn = document.getElementById('post-document-btn');
    const pollBtn = document.getElementById('poll-btn');

    // Créer inputs file cachés
    createHiddenFileInput('post-media-input', 'image/*, video/*');
    createHiddenFileInput('post-document-input', '.pdf, .doc, .docx, .xls, .xlsx');

    renderPostsFeed();

    publishBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        createPublicationFromInput(postInput);
    });
    postInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            createPublicationFromInput(postInput);
        }
    });

    postMediaBtn?.addEventListener('click', () => {
        document.getElementById('post-media-input')?.click();
    });

    postDocumentBtn?.addEventListener('click', () => {
        document.getElementById('post-document-input')?.click();
    });

    pollBtn?.addEventListener('click', async () => {
        const question = prompt('Question du sondage :');
        if (!question || !question.trim()) return;
        const optionsRaw = prompt('Options du sondage (séparées par ; )\nEx: Oui;Non;Peut-être');
        if (!optionsRaw || !optionsRaw.trim()) return;
        const options = optionsRaw
            .split(';')
            .map((o) => o.trim())
            .filter(Boolean)
            .slice(0, 6);
        if (options.length < 2) {
            showNotification('Ajoutez au moins 2 options pour le sondage.', 'error');
            return;
        }

        const pollContent = `📊 SONDAGE\n${question.trim()}\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`;
        const result = await apiCall('/publications', 'POST', { content: pollContent });
        if (result?.error) {
            showNotification(result.error, 'error');
            return;
        }
        showNotification('Sondage publié !', 'success');
        renderPostsFeed();
    });

    // Listeners pour inputs file
    document.getElementById('post-media-input')?.addEventListener('change', (e) => {
        handlePostAttachment(e.target.files, 'media');
    });

    document.getElementById('post-document-input')?.addEventListener('change', (e) => {
        handlePostAttachment(e.target.files, 'document');
    });
}

function createHiddenFileInput(id, accept) {
    if (document.getElementById(id)) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.id = id;
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);
}

function handlePostAttachment(files, type) {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > MAX_POST_ATTACHMENT_SIZE_BYTES) {
        showNotification('Fichier trop volumineux (max 6 MB).', 'error');
        return;
    }

    const preview = document.getElementById('post-attachment-preview');
    if (!preview) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const inferredType = type === 'media'
            ? (file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE')
            : (ext === 'pdf' ? 'PDF' : 'DOCUMENT');
        
        preview.innerHTML = `
            <div style="padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 12px; display: flex; align-items: center; gap: 12px;">
                <i class="fas ${type === 'media' ? 'fa-image' : 'fa-file'}"></i>
                <span>${file.name} (${(file.size / 1024).toFixed(1)} KB)</span>
                <button type="button" class="btn-icon" onclick="clearAttachment('post')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Stockage temporaire avant publication
        pendingPostAttachments = [
            {
                name: file.name,
                data: dataUrl,
                file_type: inferredType
            }
        ];
    };
    reader.readAsDataURL(file);
}

function clearAttachment(source) {
    if (source === 'post') {
        document.getElementById('post-attachment-preview').innerHTML = '';
        document.getElementById('post-media-input').value = '';
        document.getElementById('post-document-input').value = '';
        pendingPostAttachments = [];
    } else if (source === 'chat') {
        document.getElementById('chat-attachment-preview').innerHTML = '';
    }
}

async function createPublicationFromInput(postInput) {
    const content = postInput?.value.trim() || '';
    if (!content && pendingPostAttachments.length === 0) return;

    const payload = {
        content: content || 'Publication avec pièce jointe',
        attachments: pendingPostAttachments
    };
    const result = await apiCall('/publications', 'POST', payload);
    if (result?.error) { showNotification(result.error, 'error'); return; }
    postInput.value = '';
    clearAttachment('post');
    showNotification('Publication créée !', 'success');
    renderPostsFeed();
}

async function renderPostsFeed() {
    const feed = document.querySelector('.posts-feed');
    if (!feed) return;

    feed.innerHTML = '<p class="loading-text"><i class="fas fa-spinner fa-spin"></i> Chargement...</p>';

    const posts = await apiCall('/publications');

    if (!Array.isArray(posts) || posts.length === 0) {
        feed.innerHTML = `
            <div class="empty-state" style="text-align:center;padding:40px;color:var(--gray-500);">
                <i class="fas fa-newspaper" style="font-size:48px;margin-bottom:12px;display:block;"></i>
                <p>Aucune publication pour le moment.</p>
                <small>Soyez le premier à partager quelque chose !</small>
            </div>`;
        return;
    }

    feed.innerHTML = '';
    const currentUserId = getCurrentUserId();
    const currentUser = getCurrentUser();

    posts.forEach((post) => {
        const authorName = `${post.prenom || ''} ${post.nom || ''}`.trim() || 'Utilisateur';
        const score = Number(post.nb_upvotes || 0) - Number(post.nb_downvotes || 0);
        const nbComments = Number(post.nb_commentaires || 0);
        const canDelete = post.auteur_id === currentUserId || isAdminUser(currentUser);
        const attachments = Array.isArray(post.attachments) ? post.attachments : [];
        const attachmentsHtml = attachments.map((a, index) => {
            const url = escapeHtml(String(a.file_url || ''));
            const type = String(a.file_type || 'DOCUMENT');
            if (type === 'IMAGE') {
                const encodedImgUrl = encodeURIComponent(String(a.file_url || ''));
                return `<img src="${url}" alt="Pièce jointe" class="js-open-image-lightbox" data-url="${encodedImgUrl}" style="cursor:zoom-in;width:100%;max-width:100%;max-height:420px;object-fit:contain;background:#f8fafc;border-radius:10px;margin-top:8px;" />`;
            }
            if (type === 'VIDEO') {
                return `<video controls style="width:100%;max-width:100%;max-height:420px;border-radius:10px;margin-top:8px;"><source src="${url}"></video>`;
            }
            const ext = type === 'PDF' ? 'pdf' : 'bin';
            const fileName = `document-${post.id || 'post'}-${index + 1}.${ext}`;
            const encodedUrl = encodeURIComponent(String(a.file_url || ''));
            return `
                <div style="display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap;">
                    <button type="button" class="post-action-btn js-open-attachment" data-url="${encodedUrl}" style="display:inline-flex;align-items:center;gap:8px;">
                        <i class="fas fa-eye"></i> Ouvrir
                    </button>
                    <button type="button" class="post-action-btn js-download-attachment" data-url="${encodedUrl}" data-filename="${escapeHtml(fileName)}" style="display:inline-flex;align-items:center;gap:8px;">
                        <i class="fas fa-download"></i> Télécharger
                    </button>
                </div>`;
        }).join('');

        // Détection sondage : content commence par "📊 SONDAGE\n"
        const isPoll = post.content.startsWith('📊 SONDAGE\n');
        let pollHtml = '';
        let pollOptions = [];
        if (isPoll) {
            const lines = post.content.split('\n');
            const question = lines[1] || '';
            pollOptions = lines.slice(2).filter(l => l.match(/^\d+\./)).map(l => l.replace(/^\d+\.\s*/, '').trim());
            const savedVote = localStorage.getItem(`poll_vote_${post.id}`);
            // Compter les votes depuis les commentaires API (asynchrone au reload suivant)
            const pollVoteCounts = {};
            pollOptions.forEach((_, idx) => { pollVoteCounts[idx] = 0; });
            const pollOptHtmlFn = (savedVoteIdx) => pollOptions.map((opt, idx) => {
                const voted = savedVoteIdx === String(idx);
                return `<button type="button" class="post-action-btn js-poll-option ${voted ? 'active' : ''}" data-idx="${idx}" style="width:100%;text-align:left;margin:3px 0;${voted ? 'background:var(--primary-color,#4f46e5);color:#fff;' : ''}">
                    ${voted ? '<i class="fas fa-check-circle"></i> ' : '<i class="far fa-circle"></i> '}${escapeHtml(opt)}
                </button>`;
            }).join('');
            const optionsHtml = pollOptHtmlFn(savedVote);
            pollHtml = `<div class="poll-block" style="background:#f8faff;border:1px solid #e0e7ff;border-radius:10px;padding:14px;margin-top:8px;">
                <p style="font-weight:600;margin-bottom:10px;">📊 ${escapeHtml(question)}</p>
                ${optionsHtml}
                ${savedVote !== null ? `<small style="color:#6b7280;margin-top:8px;display:block;">Vous avez voté</small>` : ''}
            </div>`;
        }

        const card = document.createElement('div');
        card.className = 'post-card';
        card.dataset.userVote = 'NONE';
        card.innerHTML = `
            <div class="post-header">
                <div class="post-author">
                    <div class="author-avatar"><i class="fas fa-user"></i></div>
                    <div class="author-info">
                        <h4>${escapeHtml(authorName)}</h4>
                        <small>${formatRelative(post.created_at)}</small>
                    </div>
                </div>
            </div>
            <div class="post-content">
                ${isPoll ? pollHtml : `<p>${escapeHtml(post.content)}</p>${attachmentsHtml}`}
            </div>
            <div class="post-stats">
                <span><i class="fas fa-thumbs-up"></i> Score <span class="js-score-value">${score}</span></span>
                <span>${nbComments} Commentaires</span>
            </div>
            <div class="post-actions">
                ${!isPoll ? `<button type="button" class="post-action-btn js-like"><i class="far fa-thumbs-up"></i> Upvote</button>
                <button type="button" class="post-action-btn js-dislike"><i class="far fa-thumbs-down"></i> Downvote</button>` : ''}
                <button type="button" class="post-action-btn js-comment-toggle"><i class="far fa-comment"></i> Commenter</button>
                <button type="button" class="post-action-btn js-share"><i class="fas fa-share"></i> Partager</button>
                ${canDelete ? `<button type="button" class="post-action-btn danger js-delete"><i class="fas fa-trash"></i> Supprimer</button>` : ''}
            </div>
            <div class="post-comments" style="display:none;">
                <div class="add-comment">
                    <div class="comment-avatar"><i class="fas fa-user"></i></div>
                    <input type="text" placeholder="Écrivez un commentaire...">
                    <button type="button" class="btn-icon js-comment-send"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
        `;

        card.querySelectorAll('.js-download-attachment').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const encodedUrl = btn.getAttribute('data-url') || '';
                const fileName = btn.getAttribute('data-filename') || 'document.bin';
                const decodedUrl = decodeURIComponent(encodedUrl);
                downloadDataUrl(decodedUrl, fileName);
            });
        });

        card.querySelectorAll('.js-open-attachment').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const encodedUrl = btn.getAttribute('data-url') || '';
                const decodedUrl = decodeURIComponent(encodedUrl);
                openAttachmentUrl(decodedUrl);
            });
        });

        card.querySelectorAll('.js-open-image-lightbox').forEach((img) => {
            img.addEventListener('click', (e) => {
                e.preventDefault();
                const encodedUrl = img.getAttribute('data-url') || '';
                const decodedUrl = decodeURIComponent(encodedUrl);
                openImageLightbox(decodedUrl);
            });
        });

        // Listeners options sondage
        if (isPoll) {
            card.querySelectorAll('.js-poll-option').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const idx = btn.dataset.idx;
                    const alreadyVoted = localStorage.getItem(`poll_vote_${post.id}`);
                    if (alreadyVoted !== null) { showNotification('Vous avez déjà voté.', 'error'); return; }
                    localStorage.setItem(`poll_vote_${post.id}`, idx);
                    // Enregistrer via commentaire discret
                    const voteRes = await apiCall(`/publications/${post.id}/comments`, 'POST', { content: `🗳️ VOTE: ${pollOptions[idx]}` });
                    if (voteRes?.error) { showNotification(voteRes.error, 'error'); return; }
                    card.querySelectorAll('.js-poll-option').forEach((optionBtn) => {
                        optionBtn.disabled = true;
                        optionBtn.style.opacity = '0.85';
                    });
                    btn.classList.add('active');
                    btn.style.background = 'var(--primary-color,#4f46e5)';
                    btn.style.color = '#fff';
                    const pollBlock = card.querySelector('.poll-block');
                    if (pollBlock && !pollBlock.querySelector('.js-voted-note')) {
                        const note = document.createElement('small');
                        note.className = 'js-voted-note';
                        note.style.color = '#6b7280';
                        note.style.marginTop = '8px';
                        note.style.display = 'block';
                        note.textContent = 'Vous avez voté';
                        pollBlock.appendChild(note);
                    }
                });
            });
        }

        const commentsPanel = card.querySelector('.post-comments');
        card.querySelector('.js-comment-toggle')?.addEventListener('click', async () => {
            const visible = commentsPanel.style.display === 'block';
            if (visible) { commentsPanel.style.display = 'none'; return; }
            commentsPanel.style.display = 'block';
            const addComment = commentsPanel.querySelector('.add-comment');
            const comments = await apiCall(`/publications/${post.id}/comments`);
            commentsPanel.innerHTML = '';
            if (Array.isArray(comments) && comments.length > 0) {
                // Filtrer les votes de sondage (internes) des vrais commentaires
                const visibleComments = comments.filter(c => !String(c.content || '').startsWith('🗳️ VOTE:'));
                visibleComments.forEach(c => {
                    const name = `${c.prenom || ''} ${c.nom || ''}`.trim() || 'Utilisateur';
                    const div = document.createElement('div');
                    div.className = 'comment';
                    div.innerHTML = `
                        <div class="comment-avatar"><i class="fas fa-user"></i></div>
                        <div class="comment-content">
                            <div class="comment-header"><h5>${escapeHtml(name)}</h5><small>${formatRelative(c.created_at)}</small></div>
                            <p>${escapeHtml(c.content)}</p>
                        </div>`;
                    commentsPanel.appendChild(div);
                });
            }
            commentsPanel.appendChild(addComment);
        });

        card.querySelector('.js-like')?.addEventListener('click', async () => {
            const voteRes = await apiCall(`/publications/${post.id}/vote`, 'POST', { type: 'UPVOTE' });
            if (voteRes?.error) { showNotification(voteRes.error, 'error'); return; }
            applyLocalPostVote(card, 'UPVOTE');
        });

        card.querySelector('.js-dislike')?.addEventListener('click', async () => {
            const voteRes = await apiCall(`/publications/${post.id}/vote`, 'POST', { type: 'DOWNVOTE' });
            if (voteRes?.error) { showNotification(voteRes.error, 'error'); return; }
            applyLocalPostVote(card, 'DOWNVOTE');
        });

        card.querySelector('.js-comment-send')?.addEventListener('click', async () => {
            const input = commentsPanel.querySelector('input');
            const text = input?.value.trim();
            if (!text) return;
            const r = await apiCall(`/publications/${post.id}/comments`, 'POST', { content: text });
            if (r?.error) { showNotification(r.error, 'error'); return; }
            input.value = '';
            showNotification('Commentaire ajouté !', 'success');
            // Reload comments
            card.querySelector('.js-comment-toggle')?.click();
            card.querySelector('.js-comment-toggle')?.click();
        });

        card.querySelector('.js-share')?.addEventListener('click', async () => {
            await apiCall(`/publications/${post.id}/share`, 'POST', {});
            showNotification('Publication partagée !', 'success');
        });

        card.querySelector('.js-delete')?.addEventListener('click', async () => {
            if (!confirm('Supprimer cette publication ?')) return;
            const r = await apiCall(`/publications/${post.id}`, 'DELETE', {});
            if (r?.error) { showNotification(r.error, 'error'); return; }
            showNotification('Publication supprimée.', 'success');
            card.remove();
        });

        feed.appendChild(card);
    });
}

function upsertVotePublication(publicationId, type) {
    const userId = getCurrentUserId();
    if (!userId) return;

    const existing = state.vote.find((v) => v.user_id === userId && v.publication_id === publicationId);
    if (!existing) {
        state.vote.push({
            id: nextId(state.vote),
            user_id: userId,
            publication_id: publicationId,
            commentaire_id: null,
            type,
            created_at: new Date().toISOString()
        });
    } else if (existing.type === type) {
        state.vote = state.vote.filter((v) => v !== existing);
    } else {
        existing.type = type;
        existing.created_at = new Date().toISOString();
    }
    saveState();
}

function openSharePrompt(publicationId) {
    if (!getCurrentUserId()) return;

    const mode = prompt('Partager vers: user ou chatgrp ?');
    if (!mode) return;

    if (mode.toLowerCase() === 'user') {
        const matricule = prompt('Matricule utilisateur destinataire :');
        if (!matricule) return;
        // Résoudre le matricule via l'API de recherche
        apiCall(`/admin/search?q=${encodeURIComponent(matricule.trim())}`)
            .then(res => {
                const found = res?.results?.users?.find(u => u.matricule === matricule.trim());
                if (!found) { showNotification('Utilisateur introuvable.', 'error'); return; }
                return apiCall(`/publications/${publicationId}/share`, 'POST', { destinataire_user_id: found.id });
            })
            .then(result => {
                if (result?.error) { showNotification(result.error, 'error'); return; }
                if (result) { updateNotificationBadge(); showNotification('Publication partagée vers utilisateur.', 'success'); }
            });
        return;
    }

    if (mode.toLowerCase() === 'chatgrp') {
        const chatId = prompt('ID du chat groupe destinataire :');
        if (!chatId || isNaN(Number(chatId))) { showNotification('ID invalide.', 'error'); return; }
        apiCall(`/publications/${publicationId}/share`, 'POST', { destinataire_chat_id: Number(chatId) })
            .then(result => {
                if (result?.error) { showNotification(result.error, 'error'); return; }
                showNotification('Publication partagée vers chat groupe.', 'success');
            });
        return;
    }

    showNotification('Mode de partage non reconnu.', 'error');
}

// ===================== UTILITAIRES =====================
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 90px;
        right: 30px;
        background: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 300px;
        animation: slideInRight 0.3s ease;
    `;

    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    const color = type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#4F46E5';

    notification.innerHTML = `
        <div style="width: 40px; height: 40px; border-radius: 50%; background: ${color}; color: white; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">${icon}</div>
        <span style="flex: 1; color: #374151;">${escapeHtml(message)}</span>
    `;

    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2500);
}

const style = document.createElement('style');
style.textContent = `
@keyframes slideInRight {
    from { opacity: 0; transform: translateX(100px); }
    to { opacity: 1; transform: translateX(0); }
}
@keyframes slideOutRight {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(100px); }
}`;
document.head.appendChild(style);

function formatHour(dateString) {
    const date = new Date(dateString);
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

function formatRelative(dateString) {
    const then = new Date(dateString).getTime();
    const diffMin = Math.max(1, Math.floor((Date.now() - then) / 60000));
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH} h`;
    const diffD = Math.floor(diffH / 24);
    return `Il y a ${diffD} j`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function applyLocalPostVote(card, voteType) {
    const scoreEl = card.querySelector('.js-score-value');
    if (!scoreEl) return;
    const currentScore = Number(scoreEl.textContent || 0);
    const prevVote = card.dataset.userVote || 'NONE';
    let nextScore = currentScore;

    if (voteType === 'UPVOTE') {
        if (prevVote === 'UPVOTE') {
            nextScore -= 1;
            card.dataset.userVote = 'NONE';
        } else if (prevVote === 'DOWNVOTE') {
            nextScore += 2;
            card.dataset.userVote = 'UPVOTE';
        } else {
            nextScore += 1;
            card.dataset.userVote = 'UPVOTE';
        }
    } else if (voteType === 'DOWNVOTE') {
        if (prevVote === 'DOWNVOTE') {
            nextScore += 1;
            card.dataset.userVote = 'NONE';
        } else if (prevVote === 'UPVOTE') {
            nextScore -= 2;
            card.dataset.userVote = 'DOWNVOTE';
        } else {
            nextScore -= 1;
            card.dataset.userVote = 'DOWNVOTE';
        }
    }

    scoreEl.textContent = String(nextScore);
}

function openAttachmentUrl(dataUrl) {
    try {
        const raw = String(dataUrl || '');
        if (!raw.startsWith('data:')) {
            window.open(raw, '_blank', 'noopener');
            return;
        }

        const splitIndex = raw.indexOf(',');
        if (splitIndex < 0) {
            showNotification('Fichier invalide.', 'error');
            return;
        }

        const header = raw.slice(0, splitIndex);
        const base64 = raw.slice(splitIndex + 1);
        const mimeMatch = header.match(/data:([^;]+);base64/i);
        const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        const newTab = window.open(blobUrl, '_blank', 'noopener');
        if (!newTab) {
            // Popup bloquée: fallback téléchargement
            downloadDataUrl(raw, 'document.bin');
            return;
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
        console.error('Erreur ouverture pièce jointe:', err);
        showNotification('Impossible d\'ouvrir ce document.', 'error');
    }
}

function openImageLightbox(imageUrl) {
    const src = String(imageUrl || '').trim();
    if (!src) return;

    let modal = document.getElementById('image-lightbox-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'image-lightbox-modal';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.background = 'rgba(2, 6, 23, 0.88)';
        modal.style.display = 'none';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.padding = '24px';
        modal.style.zIndex = '9999';

        modal.innerHTML = `
            <button type="button" id="image-lightbox-close" aria-label="Fermer" style="position:absolute;top:16px;right:16px;border:none;background:rgba(255,255,255,0.15);color:#fff;width:40px;height:40px;border-radius:999px;cursor:pointer;font-size:20px;line-height:1;">×</button>
            <img id="image-lightbox-content" alt="Aperçu" style="max-width:min(96vw,1400px);max-height:90vh;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,0.35);object-fit:contain;background:#0f172a;" />
        `;

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }
        });

        document.body.appendChild(modal);

        const closeBtn = document.getElementById('image-lightbox-close');
        closeBtn?.addEventListener('click', () => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
    }

    const img = document.getElementById('image-lightbox-content');
    if (!img) return;

    img.setAttribute('src', src);
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function downloadDataUrl(dataUrl, fileName) {
    try {
        const raw = String(dataUrl || '');
        if (!raw.startsWith('data:')) {
            window.open(raw, '_blank', 'noopener');
            return;
        }

        const splitIndex = raw.indexOf(',');
        if (splitIndex < 0) {
            showNotification('Fichier invalide.', 'error');
            return;
        }

        const header = raw.slice(0, splitIndex);
        const base64 = raw.slice(splitIndex + 1);
        const mimeMatch = header.match(/data:([^;]+);base64/i);
        const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName || 'document.bin';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
        console.error('Erreur téléchargement pièce jointe:', err);
        showNotification('Impossible de télécharger ce document.', 'error');
    }
}
