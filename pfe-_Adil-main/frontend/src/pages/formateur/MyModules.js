import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './FormateurPages.css';
import { sanitizeText } from '../../utils/sanitizeText';

const MyModules = () => {
    const [modules, setModules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedModule, setExpandedModule] = useState(null);
    const [moduleStats, setModuleStats] = useState({});

    useEffect(() => {
        fetchModules();
    }, []);

    const fetchModules = async () => {
        try {
            const response = await api.get('/formateur/modules');
            if (response.data.success) {
                setModules(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching modules:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchModuleStats = async (moduleId) => {
        if (moduleStats[moduleId]) return;
        
        try {
            const response = await api.get(`/formateur/modules/${moduleId}/stats`);
            if (response.data.success) {
                setModuleStats(prev => ({
                    ...prev,
                    [moduleId]: response.data.data
                }));
            }
        } catch (error) {
            console.error('Error fetching module stats:', error);
        }
    };

    const toggleModule = (moduleId) => {
        if (expandedModule === moduleId) {
            setExpandedModule(null);
        } else {
            setExpandedModule(moduleId);
            fetchModuleStats(moduleId);
        }
    };

    const openModuleCommunity = async (moduleId) => {
        try {
            const res = await api.get(`/communities/by-module/${moduleId}`);
            if (res.data.success && res.data.data?.id) {
                window.location.href = `/formateur/communities/${res.data.data.id}/chat`;
            }
        } catch (e) {
            console.error(e);
            alert(e.response?.data?.error || 'Communauté introuvable pour ce module');
        }
    };

    if (loading) return <div className="loading-text">Chargement des modules...</div>;

    return (
        <div className="formateur-page fade-in">
            <div className="page-header">
                <div>
                    <div className="page-kicker">Espace formateur</div>
                    <h1>Mes Modules</h1>
                    <p>Chaque module affiche son périmètre d’accès et ses composants</p>
                </div>
            </div>

            {modules.length === 0 ? (
                <div className="empty-state">
                    <i className="fas fa-book-open"></i>
                    <p>Aucun module assigné</p>
                    <p>Contactez l'administrateur pour obtenir des modules</p>
                </div>
            ) : (
                <div className="modules-list">
                    {modules.map(module => {
                        const stats = moduleStats[module.id];
                        const isExpanded = expandedModule === module.id;
                        
                        return (
                            <div key={module.id} className="module-card">
                                <div className="module-header" onClick={() => toggleModule(module.id)}>
                                    <div className="module-info">
                                        <div className="module-code">{module.code}</div>
                                        <h3>{sanitizeText(module.nom)}</h3>
                                        <div className="module-badges">
                                            <span className="credits-badge">{module.credits} crédits</span>
                                            <span className="credits-badge" style={{ marginLeft: 8 }}>
                                                {module.assignment_type === 'PRINCIPAL'
                                                    ? 'Accès: Tout le module'
                                                    : `Accès: ${(module.component_scope || []).join(', ') || 'Composants non définis'}`}
                                            </span>
                                        </div>
                                        <div className="module-component-strip">
                                            {(Array.isArray(module.components) && module.components.length > 0 ? module.components : ['Cours', 'TD', 'TP']).map((component) => (
                                                <span key={component} className="module-component-chip">{sanitizeText(component)}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="module-toggle">
                                        <span>{isExpanded ? '−' : '+'}</span>
                                    </div>
                                </div>
                                
                                {isExpanded && stats && (
                                    <div className="module-details">
                                        <div className="stats-row">
                                            <div className="stat">
                                                <span className="stat-value">{stats.resourcesCount}</span>
                                                <span className="stat-label">Ressources</span>
                                            </div>
                                            <div className="stat">
                                                <span className="stat-value">{stats.studentsCount}</span>
                                                <span className="stat-label">Étudiants</span>
                                            </div>
                                            <div className="stat">
                                                <span className="stat-value">{stats.totalDownloads}</span>
                                                <span className="stat-label">Téléchargements</span>
                                            </div>
                                        </div>
                                        <div className="module-actions">
                                            <button type="button" onClick={() => openModuleCommunity(module.id)}>
                                                💬 Chat communauté (module)
                                            </button>
                                            <button type="button" onClick={() => window.location.href = `/formateur/upload?moduleId=${module.id}`}>
                                                📤 Ajouter une ressource
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MyModules;
