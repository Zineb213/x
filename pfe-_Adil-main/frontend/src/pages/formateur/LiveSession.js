import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import './FormateurPages.css';
import './LiveSession.css';

const STATUS_LABELS = {
    SCHEDULED: 'Programmé',
    LIVE: '🔴 EN DIRECT',
    ENDED: 'Terminé'
};

const STATUS_CLASS = {
    SCHEDULED: 'live-status-scheduled',
    LIVE: 'live-status-live',
    ENDED: 'live-status-ended'
};

const LiveSession = () => {
    const [lives, setLives] = useState([]);
    const [modules, setModules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        title: '',
        description: '',
        meetingLink: '',
        moduleId: '',
        scheduledAt: ''
    });

    const fetchData = useCallback(async () => {
        try {
            const [livesRes, modulesRes] = await Promise.all([
                api.get('/formateur/live'),
                api.get('/formateur/modules')
            ]);
            if (livesRes.data.success) setLives(livesRes.data.data);
            if (modulesRes.data.success) setModules(modulesRes.data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const showMsg = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.meetingLink.trim()) {
            showMsg('error', 'Le titre et le lien de réunion sont requis.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await api.post('/formateur/live', {
                title: form.title.trim(),
                description: form.description.trim() || undefined,
                meetingLink: form.meetingLink.trim(),
                moduleId: form.moduleId ? parseInt(form.moduleId) : undefined,
                scheduledAt: form.scheduledAt || undefined
            });
            if (res.data.success) {
                showMsg('success', 'Session créée avec succès !');
                setForm({ title: '', description: '', meetingLink: '', moduleId: '', scheduledAt: '' });
                setShowForm(false);
                fetchData();
            }
        } catch (err) {
            showMsg('error', err.response?.data?.error || 'Erreur lors de la création.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleStart = async (id) => {
        try {
            await api.patch(`/formateur/live/${id}/start`);
            showMsg('success', 'Session démarrée — vous êtes en direct !');
            fetchData();
        } catch (err) {
            showMsg('error', err.response?.data?.error || 'Erreur');
        }
    };

    const handleEnd = async (id) => {
        try {
            await api.patch(`/formateur/live/${id}/end`);
            showMsg('success', 'Session terminée.');
            fetchData();
        } catch (err) {
            showMsg('error', err.response?.data?.error || 'Erreur');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Supprimer cette session ?')) return;
        try {
            await api.delete(`/formateur/live/${id}`);
            showMsg('success', 'Session supprimée.');
            fetchData();
        } catch (err) {
            showMsg('error', err.response?.data?.error || 'Erreur');
        }
    };

    const activeLives = lives.filter(l => l.status === 'LIVE');
    const upcomingLives = lives.filter(l => l.status === 'SCHEDULED');
    const pastLives = lives.filter(l => l.status === 'ENDED');

    if (loading) return <div className="loading-text">Chargement...</div>;

    return (
        <div className="formateur-page fade-in">
            <div className="page-header">
                <div>
                    <h1>🎥 Sessions Live</h1>
                    <p>Partagez un lien Zoom, Meet ou Teams avec vos étudiants</p>
                </div>
                <button className="btn-primary" onClick={() => setShowForm(v => !v)}>
                    {showForm ? 'Annuler' : '+ Nouvelle session'}
                </button>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`}>{message.text}</div>
            )}

            {/* Formulaire création */}
            {showForm && (
                <div className="live-form-card">
                    <h3>Créer une nouvelle session</h3>
                    <form onSubmit={handleCreate}>
                        <div className="form-group">
                            <label>Titre *</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="ex: Cours Algèbre - Chapitre 4"
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Description (optionnel)</label>
                            <textarea
                                className="form-textarea"
                                rows="2"
                                placeholder="Sujet abordé, consignes..."
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Lien de réunion * (Zoom, Meet, Teams…)</label>
                            <input
                                type="url"
                                className="form-input"
                                placeholder="https://zoom.us/j/..."
                                value={form.meetingLink}
                                onChange={e => setForm({ ...form, meetingLink: e.target.value })}
                                required
                            />
                        </div>
                        <div className="live-form-row">
                            <div className="form-group">
                                <label>Module (optionnel)</label>
                                <select
                                    className="form-select"
                                    value={form.moduleId}
                                    onChange={e => setForm({ ...form, moduleId: e.target.value })}
                                >
                                    <option value="">Tous mes modules</option>
                                    {modules.map(m => (
                                        <option key={m.id} value={m.id}>{m.code} — {m.nom}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Date &amp; heure (optionnel)</label>
                                <input
                                    type="datetime-local"
                                    className="form-input"
                                    value={form.scheduledAt}
                                    onChange={e => setForm({ ...form, scheduledAt: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="live-form-actions">
                            <button type="submit" className="btn-primary" disabled={submitting}>
                                {submitting ? 'Création...' : 'Créer la session'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* EN DIRECT */}
            {activeLives.length > 0 && (
                <section className="live-section">
                    <h2 className="live-section-title live-section-active">🔴 En direct maintenant</h2>
                    <div className="live-cards">
                        {activeLives.map(l => (
                            <LiveCard
                                key={l.id}
                                live={l}
                                onStart={handleStart}
                                onEnd={handleEnd}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* PROGRAMMÉS */}
            {upcomingLives.length > 0 && (
                <section className="live-section">
                    <h2 className="live-section-title">🗓️ Programmés</h2>
                    <div className="live-cards">
                        {upcomingLives.map(l => (
                            <LiveCard
                                key={l.id}
                                live={l}
                                onStart={handleStart}
                                onEnd={handleEnd}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* TERMINÉS */}
            {pastLives.length > 0 && (
                <section className="live-section">
                    <h2 className="live-section-title live-section-ended">Terminés</h2>
                    <div className="live-cards">
                        {pastLives.map(l => (
                            <LiveCard
                                key={l.id}
                                live={l}
                                onStart={handleStart}
                                onEnd={handleEnd}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                </section>
            )}

            {lives.length === 0 && !showForm && (
                <div className="live-empty">
                    <div className="live-empty-icon">🎥</div>
                    <h3>Aucune session live</h3>
                    <p>Créez votre première session pour partager un lien avec vos étudiants.</p>
                    <button className="btn-primary" onClick={() => setShowForm(true)}>
                        + Créer une session
                    </button>
                </div>
            )}
        </div>
    );
};

const LiveCard = ({ live, onStart, onEnd, onDelete }) => {
    const isLive = live.status === 'LIVE';
    const isScheduled = live.status === 'SCHEDULED';
    const isEnded = live.status === 'ENDED';

    return (
        <div className={`live-card ${isLive ? 'live-card--active' : ''} ${isEnded ? 'live-card--ended' : ''}`}>
            <div className="live-card-header">
                <span className={`live-badge ${STATUS_CLASS[live.status]}`}>
                    {STATUS_LABELS[live.status]}
                </span>
                {live.module_code && (
                    <span className="live-module-tag">{live.module_code}</span>
                )}
            </div>
            <h3 className="live-card-title">{live.title}</h3>
            {live.description && <p className="live-card-desc">{live.description}</p>}
            {live.scheduled_at && (
                <p className="live-card-time">
                    📅 {new Date(live.scheduled_at).toLocaleString('fr-FR', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    })}
                </p>
            )}
            {isLive && live.started_at && (
                <p className="live-card-time">
                    ▶️ Démarré à {new Date(live.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
            )}
            <div className="live-card-link">
                <a
                    href={live.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`btn-link-join ${isEnded ? 'btn-link-disabled' : ''}`}
                >
                    🔗 {isEnded ? 'Lien (session terminée)' : 'Ouvrir le lien'}
                </a>
            </div>
            <div className="live-card-actions">
                {isScheduled && (
                    <button className="btn-start-live" onClick={() => onStart(live.id)}>
                        ▶ Démarrer maintenant
                    </button>
                )}
                {isLive && (
                    <button className="btn-end-live" onClick={() => onEnd(live.id)}>
                        ⏹ Terminer la session
                    </button>
                )}
                {!isLive && (
                    <button className="btn-icon btn-danger" onClick={() => onDelete(live.id)} title="Supprimer">
                        🗑️
                    </button>
                )}
            </div>
        </div>
    );
};

export default LiveSession;
