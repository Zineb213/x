import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './FormateurDashboard.css';

const FormateurDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recentResources, setRecentResources] = useState([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const statsRes = await api.get('/formateur/stats');
            if (statsRes.data.success) {
                setStats(statsRes.data.data);
                setRecentResources(statsRes.data.data.recentResources || []);
            }
        } catch (error) {
            console.error('Error fetching dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        { title: 'Modules assignés', value: stats?.totalModules || 0, icon: '📚', color: 'blue' },
        { title: 'Ressources', value: stats?.totalResources || 0, icon: '📄', color: 'green' },
        { title: 'Étudiants', value: stats?.totalStudents || 0, icon: '👨‍🎓', color: 'orange' },
        { title: 'Téléchargements', value: stats?.totalDownloads || 0, icon: '📥', color: 'purple' }
    ];

    if (loading) return <div className="loading-text">Chargement...</div>;

    return (
        <div className="formateur-dashboard fade-in">
            <div className="welcome-banner">
                <h1>Tableau de bord Formateur</h1>
                <p>Bienvenue sur votre espace d'enseignement</p>
            </div>

            <div className="stats-grid">
                {statCards.map((stat, index) => (
                    <div key={index} className="stat-card">
                        <div className={`stat-icon ${stat.color}`}>
                            <span>{stat.icon}</span>
                        </div>
                        <div className="stat-info">
                            <h3>{stat.value}</h3>
                            <p>{stat.title}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="recent-section">
                <h2>Dernières ressources ajoutées</h2>
                {recentResources.length === 0 ? (
                    <div className="empty-state">
                        <p>Aucune ressource récente</p>
                    </div>
                ) : (
                    <div className="resources-list">
                        {recentResources.map((resource) => (
                            <div key={resource.id} className="resource-item">
                                <div className="resource-info">
                                    <h4>{resource.titre}</h4>
                                    <p>{resource.module_nom}</p>
                                    <small>Ajouté le {new Date(resource.created_at).toLocaleDateString()}</small>
                                </div>
                                <span className={`category-badge ${resource.category?.toLowerCase()}`}>
                                    {resource.category}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="quick-actions">
                <h2>Actions rapides</h2>
                <div className="action-buttons">
                    <button onClick={() => window.location.href = '/formateur/upload'}>
                        📤 Ajouter une ressource
                    </button>
                    <button onClick={() => window.location.href = '/formateur/resources'}>
                        📚 Voir mes ressources
                    </button>
                    <button onClick={() => window.location.href = '/formateur/students'}>
                        👨‍🎓 Voir mes étudiants
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FormateurDashboard;
