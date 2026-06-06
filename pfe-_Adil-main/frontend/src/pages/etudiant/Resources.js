import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import '../../components/ui/Button.css';
import './Resources.css';
import { sanitizeText } from '../../utils/sanitizeText';

const Resources = () => {
    const [modules, setModules] = useState([]);
    const [resources, setResources] = useState([]);
    const [moduleFormateurs, setModuleFormateurs] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [completedResources, setCompletedResources] = useState(new Set());
    const [selectedModuleId, setSelectedModuleId] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // Fetch enrolled modules
            const modulesRes = await api.get('/etudiant/modules');
            if (modulesRes.data.success) {
                setModules(modulesRes.data.data);
            }
            
            // Fetch resources
            const resourcesRes = await api.get('/etudiant/resources');
            if (resourcesRes.data.success) {
                setResources(resourcesRes.data.data);
                // initialize completed set from resource flags if present
                const completedIds = new Set();
                for (const r of resourcesRes.data.data) {
                    if (r.is_completed || r.completed || r.completed_at || r.user_completed || r.completed_by_user) {
                        completedIds.add(r.id);
                    }
                }
                setCompletedResources(completedIds);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            setMessage({ type: 'error', text: 'Erreur lors du chargement' });
        } finally {
            setLoading(false);
        }
    };

    const selectModule = (moduleId) => {
        const nextSelection = selectedModuleId === moduleId ? null : moduleId;
        setSelectedModuleId(nextSelection);

        if (nextSelection && !moduleFormateurs[nextSelection]) {
            fetchModuleFormateurs(nextSelection);
        }
    };

    const fetchModuleFormateurs = async (moduleId) => {
        try {
            const response = await api.get(`/etudiant/modules/${moduleId}/formateurs`);
            if (response.data.success) {
                setModuleFormateurs((prev) => ({
                    ...prev,
                    [moduleId]: response.data.data
                }));
            }
        } catch (error) {
            console.error('Error fetching module formateurs:', error);
        }
    };

    const getResourcesForModule = (moduleId) => {
        let moduleResources = resources.filter(r => r.module_id === moduleId);
        
        if (selectedCategory !== 'all') {
            moduleResources = moduleResources.filter(r => r.category === selectedCategory);
        }
        
        return moduleResources;
    };

    // use shared sanitizeText util

    const handleDownload = async (resourceId) => {
        try {
            const response = await api.get(`/etudiant/resources/${resourceId}/download`, {
                responseType: 'blob'
            });

            if (response.status >= 200 && response.status < 300) {
                const blob = response.data;
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;

                const contentDisposition = response.headers['content-disposition'];
                let filename = `resource_${resourceId}.pdf`;
                if (contentDisposition) {
                    const match = contentDisposition.match(/filename="?([^"]+)"?/);
                    if (match) filename = match[1];
                }

                a.download = filename;
                document.body.appendChild(a);
                a.click();

                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                setMessage({ type: 'success', text: 'Téléchargement démarré' });
                setTimeout(() => setMessage({ type: '', text: '' }), 2000);
            }
        } catch (error) {
            console.error('Error downloading:', error);
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors du téléchargement' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        }
    };

        const handleContactFormateur = async (moduleId, formateurId, nom, prenom) => {
            try {
                await api.post('/etudiant/chat/formateur', { formateurId, moduleId });
                setMessage({ type: 'success', text: `Conversation ouverte avec ${prenom} ${nom}` });
                setTimeout(() => {
                    window.location.href = '/etudiant/chat';
                }, 500);
            } catch (error) {
                setMessage({ type: 'error', text: error.response?.data?.error || 'Impossible d\'ouvrir le chat' });
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        };

    const categories = [
        { value: 'all', label: 'Tous', icon: '📚' },
        { value: 'Cours', label: 'Cours', icon: '📖' },
        { value: 'TD', label: 'TD', icon: '✏️' },
        { value: 'TP', label: 'TP', icon: '💻' },
        { value: 'Examen', label: 'Examens', icon: '📝' }
    ];

    const getCategoryIcon = (category) => {
        const icons = {
            'Cours': '📖',
            'TD': '✏️',
            'TP': '💻',
            'Examen': '📝'
        };
        return icons[category] || '📄';
    };

    const isResourceCompleted = (resource) => {
        if (!resource) return false;
        return !!(resource.is_completed || resource.completed || resource.completed_at || resource.user_completed || resource.completed_by_user || completedResources.has(resource.id));
    };

    const handleCompleteResource = async (resource) => {
        const id = resource.id;
        // optimistic
        setCompletedResources(prev => new Set(prev).add(id));
        try {
            await api.post('/etudiant/resources/complete', { resourceId: id, moduleId: resource.module_id });
            setMessage({ type: 'success', text: 'Ressource marquée complétée' });
            setTimeout(() => setMessage({ type: '', text: '' }), 2000);
        } catch (err) {
            // revert
            setCompletedResources(prev => {
                const s = new Set(prev);
                s.delete(id);
                return s;
            });
            setMessage({ type: 'error', text: err.response?.data?.error || 'Erreur lors de la mise à jour' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        }
    };

    const selectedModule = modules.find((m) => m.id === selectedModuleId);
    const selectedModuleResources = selectedModuleId ? getResourcesForModule(selectedModuleId) : [];
    const totalResources = resources.length;
    const currentModuleResourceCount = selectedModule ? selectedModuleResources.length : 0;

    if (loading) return <div className="loading-text">Chargement des ressources...</div>;

    return (
        <div className="resources-page-modern fade-in">
            <div className="page-header">
                <h1>Modules assignés</h1>
                <p>Choisissez un module pour afficher les ressources disponibles dans ce module.</p>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            {modules.length === 0 ? (
                <div className="empty-state">
                    <i className="fas fa-folder-open"></i>
                    <p>Aucun module trouvé</p>
                    <p className="empty-hint">Rejoignez une communauté pour accéder aux ressources</p>
                </div>
            ) : (
                <div className="resources-layout">
                    <aside className="module-list-panel">
                        <div className="section-header">
                            <div>
                                <h2>Mes modules</h2>
                                <p className="module-list-summary">{modules.length} module(s) assigné(s)</p>
                            </div>
                            <span className="results-count">{totalResources} ressource(s) totales</span>
                        </div>
                        <div className="module-list">
                            {modules.map((module) => {
                                const moduleResources = getResourcesForModule(module.id);
                                const completedCount = moduleResources.filter(isResourceCompleted).length;
                                const isSelected = selectedModuleId === module.id;

                                return (
                                    <button
                                        key={module.id}
                                        type="button"
                                        className={`module-card ${isSelected ? 'selected' : ''}`}
                                        onClick={() => selectModule(module.id)}
                                    >
                                        <div className="module-card-top">
                                            <div className="module-icon">
                                                {module.category_name === 'Python' ? '🐍' : 
                                                 module.category_name === 'PHP' ? '🐘' :
                                                 module.category_name === 'Node.js' ? '💚' :
                                                 module.category_name === 'React.js' ? '⚛️' : '📚'}
                                            </div>
                                            <div className="module-details">
                                                <div className="module-code">{module.code}</div>
                                                <div className="module-name">{sanitizeText(module.nom)}</div>
                                            </div>
                                        </div>
                                        <div className="module-card-meta">
                                            <span className="module-category">{module.category_name}</span>
                                            <span className="resource-count">{moduleResources.length} ressources</span>
                                            {moduleResources.length > 0 && completedCount === moduleResources.length && (
                                                <span className="badge module-complete">Terminé</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>

                    <section className="module-detail-panel">
                        {!selectedModule ? (
                            <div className="module-placeholder">
                                <h3>Sélectionnez un module pour voir ses ressources</h3>
                                <p>Les ressources sont chargées par module. Cliquez sur un module dans la colonne de gauche pour commencer.</p>
                            </div>
                        ) : (
                            <>
                                <div className="module-detail-header">
                                    <div>
                                        <button className="back-module-btn" type="button" onClick={() => setSelectedModuleId(null)}>
                                            ← Retour aux modules
                                        </button>
                                        <h2>{sanitizeText(selectedModule.nom)}</h2>
                                        <p className="module-detail-meta">
                                            {selectedModule.code} • {selectedModule.category_name} • {currentModuleResourceCount} ressource(s)
                                        </p>
                                    </div>
                                </div>

                                {Array.isArray(moduleFormateurs[selectedModule.id]) && moduleFormateurs[selectedModule.id].length > 0 && (
                                    <div className="module-formateurs-row">
                                        {moduleFormateurs[selectedModule.id].map((f) => (
                                            <button
                                                key={f.id}
                                                type="button"
                                                className="download-btn"
                                                onClick={() => handleContactFormateur(selectedModule.id, f.id, f.nom, f.prenom)}
                                            >
                                                💬 {f.prenom} {f.nom} {f.assignment_type === 'PRINCIPAL' ? '(Chargé de formation)' : ''}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="category-filters-modern">
                                    {categories.map(cat => (
                                        <button
                                            key={cat.value}
                                            className={`filter-chip ${selectedCategory === cat.value ? 'active' : ''}`}
                                            onClick={() => setSelectedCategory(cat.value)}
                                        >
                                            <span className="filter-icon">{cat.icon}</span>
                                            <span>{cat.label}</span>
                                            {selectedCategory !== 'all' && selectedCategory === cat.value && (
                                                <span className="filter-clear" onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedCategory('all');
                                                }}>×</span>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                <div className="results-info">
                                    <span className="results-count">{currentModuleResourceCount} ressource(s) pour ce module</span>
                                    {selectedCategory !== 'all' && (
                                        <button className="clear-filters" onClick={() => setSelectedCategory('all')}>
                                            Effacer les filtres
                                        </button>
                                    )}
                                </div>

                                {currentModuleResourceCount === 0 ? (
                                    <div className="no-resources">
                                        <p>Aucune ressource pour ce module.</p>
                                    </div>
                                ) : (
                                    <div className="resources-grid-modern">
                                        {selectedModuleResources.map(resource => (
                                            <div key={resource.id} className="resource-card-modern">
                                                <div className={`resource-badge ${resource.category?.toLowerCase()}`}>
                                                    {getCategoryIcon(resource.category)}
                                                    <span>{resource.category || 'Autre'}</span>
                                                </div>
                                                <h4 className="resource-title">{sanitizeText(resource.titre)}</h4>
                                                {resource.description && (
                                                    <p className="resource-description">{sanitizeText(resource.description)}</p>
                                                )}
                                                <p className="resource-description">
                                                    Posté par: {resource.uploader_prenom || ''} {resource.uploader_nom || 'Inconnu'}
                                                    <br />
                                                    Confirmé par: {resource.approver_prenom || ''} {resource.approver_nom || 'N/A'}
                                                </p>
                                                <div className="resource-footer-modern">
                                                    <span className="download-count">📥 {resource.download_count || 0} téléchargements</span>
                                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                        <button className="btn btn-primary btn-sm download-btn" onClick={() => handleDownload(resource.id)}>
                                                            Télécharger
                                                        </button>
                                                        {isResourceCompleted(resource) ? (
                                                            <button className="btn btn-primary btn-sm" disabled>Complete</button>
                                                        ) : (
                                                            <button className="btn btn-primary btn-sm" onClick={() => handleCompleteResource(resource)}>✓ Marquer complété</button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </section>
                </div>
            )}
        </div>
    );

};

export default Resources;
