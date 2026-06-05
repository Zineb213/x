import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import LevelProgress from '../../components/progress/LevelProgress';
import BadgeList from '../../components/progress/BadgeList';
import './StudentDashboard.css';
import '../formateur/LiveSession.css';

const StudentDashboard = () => {
    const [progress, setProgress] = useState(null);
    const [badges, setBadges] = useState([]);
    const [recentResources, setRecentResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [activeLives, setActiveLives] = useState([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [userRes, progressRes, badgesRes, resourcesRes, livesRes] = await Promise.all([
                api.get('/auth/me'),
                api.get('/etudiant/progress'),
                api.get('/etudiant/badges'),
                api.get('/etudiant/resources/recent'),
                api.get('/etudiant/lives')
            ]);
            
            if (userRes.data.success) setUser(userRes.data.data);
            if (progressRes.data.success) setProgress(progressRes.data.data);
            if (badgesRes.data.success) setBadges(badgesRes.data.data);
            if (resourcesRes.data.success) setRecentResources(resourcesRes.data.data);
            if (livesRes.data.success) setActiveLives(livesRes.data.data);
        } catch (error) {
            console.error('Error fetching dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteResource = async (resourceId, moduleId) => {
        try {
            const response = await api.post('/etudiant/resources/complete', {
                resourceId,
                moduleId
            });
            
            if (response.data.success) {
                const xp = response.data.data?.xpEarned;
                if (xp?.leveledUp) {
                    alert(`🎉 +${xp.xpEarned || ''} XP — progression enregistrée !`);
                }
                fetchDashboardData();
            }
        } catch (error) {
            console.error('Error completing resource:', error);
        }
    };

    if (loading) return <div className="loading-text">Chargement...</div>;

    return (
        <div className="student-dashboard fade-in">
            {/* Welcome Banner */}
            <div className="welcome-banner">
                <h1>Bonjour, {user?.prenom} {user?.nom}!</h1>
                <p>Continuez votre apprentissage module par module</p>
            </div>

            {/* XP track 0 → Expert */}
            {progress && (
                <LevelProgress
                    rank={progress.rank}
                    totalXp={progress.level?.total_xp || 0}
                />
            )}

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon blue">📚</div>
                    <div className="stat-info">
                        <h3>{progress?.stats?.completed_resources || 0}</h3>
                        <p>Ressources complétées</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green">📖</div>
                    <div className="stat-info">
                        <h3>{progress?.stats?.completed_modules || 0}</h3>
                        <p>Modules complétés</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon orange">🎯</div>
                    <div className="stat-info">
                        <h3>{progress?.level?.total_xp || 0}</h3>
                        <p>XP total</p>
                    </div>
                </div>
            </div>

            {/* Badges */}
            {badges.length > 0 && <BadgeList badges={badges} />}

            {/* Live sessions */}
            {activeLives.length > 0 && (
                <div className="live-banner-section">
                    <h2 className="live-banner-title">🔴 Sessions live de vos formateurs</h2>
                    <div className="live-banner-cards">
                        {activeLives.map(live => (
                            <div
                                key={live.id}
                                className={`live-banner-card ${live.status === 'LIVE' ? 'live-banner-card--active' : ''}`}
                            >
                                <div className="live-banner-info">
                                    <span className={`live-banner-badge ${live.status === 'LIVE' ? 'live-banner-badge--live' : 'live-banner-badge--scheduled'}`}>
                                        {live.status === 'LIVE' ? '🔴 EN DIRECT' : '🗓️ Programmé'}
                                    </span>
                                    <p className="live-banner-card-title">{live.title}</p>
                                    <p className="live-banner-formateur">
                                        {live.formateur_prenom} {live.formateur_nom}
                                        {live.module_code && <span className="live-banner-module"> · {live.module_code}</span>}
                                    </p>
                                    {live.scheduled_at && live.status === 'SCHEDULED' && (
                                        <p className="live-banner-time">
                                            📅 {new Date(live.scheduled_at).toLocaleString('fr-FR', {
                                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </p>
                                    )}
                                </div>
                                <a
                                    href={live.meeting_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`btn-join-live ${live.status === 'SCHEDULED' ? 'btn-join-scheduled' : ''}`}
                                >
                                    {live.status === 'LIVE' ? '▶ Rejoindre' : '🔗 Lien'}
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Resources */}
            <div className="recent-section">
                <h2>Ressources récentes</h2>
                <div className="resources-list">
                    {recentResources.map((resource) => (
                        <div key={resource.id} className="resource-item">
                            <div className="resource-info">
                                <h4>{resource.titre}</h4>
                                <p>{resource.description}</p>
                                <small>Module: {resource.module_nom}</small>
                            </div>
                            <button 
                                className="btn-primary btn-sm"
                                onClick={() => handleCompleteResource(resource.id, resource.module_id)}
                            >
                                ✓ Marquer complété
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StudentDashboard;
