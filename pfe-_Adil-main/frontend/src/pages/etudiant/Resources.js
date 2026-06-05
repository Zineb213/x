import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Resources.css';

const Resources = () => {
    const [modules, setModules] = useState([]);
    const [resources, setResources] = useState([]);
    const [moduleFormateurs, setModuleFormateurs] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [expandedModules, setExpandedModules] = useState({});
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
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            setMessage({ type: 'error', text: 'Erreur lors du chargement' });
        } finally {
            setLoading(false);
        }
    };

    const toggleModule = (moduleId) => {
        if (!expandedModules[moduleId] && !moduleFormateurs[moduleId]) {
            fetchModuleFormateurs(moduleId);
        }
        setExpandedModules(prev => ({
            ...prev,
            [moduleId]: !prev[moduleId]
        }));
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

    // Calculate total resources count
    const totalResources = modules.reduce((total, module) => {
        return total + getResourcesForModule(module.id).length;
    }, 0);

    if (loading) return <div className="loading-text">Chargement des ressources...</div>;

    return (
        <div className="resources-page-modern fade-in">
            <div className="page-header">
                <h1>Ressources pédagogiques</h1>
                <p>Accédez à toutes vos ressources par module</p>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            {/* Category Filters */}
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

            {/* Results Info */}
            <div className="results-info">
                <span className="results-count">{totalResources} ressource(s) trouvée(s)</span>
                {selectedCategory !== 'all' && (
                    <button className="clear-filters" onClick={() => setSelectedCategory('all')}>
                        Effacer les filtres
                    </button>
                )}
            </div>

            {/* Modules Accordion */}
            {modules.length === 0 ? (
                <div className="empty-state">
                    <i className="fas fa-folder-open"></i>
                    <p>Aucun module trouvé</p>
                    <p className="empty-hint">Rejoignez une communauté pour accéder aux ressources</p>
                </div>
            ) : (
                <div className="modules-accordion">
                    {modules.map(module => {
                        const moduleResources = getResourcesForModule(module.id);
                        const isExpanded = expandedModules[module.id];
                        const resourceCount = moduleResources.length;
                        
                        return (
                            <div key={module.id} className="module-accordion-item">
                                <div 
                                    className={`module-accordion-header ${isExpanded ? 'expanded' : ''}`}
                                    onClick={() => toggleModule(module.id)}
                                >
                                    <div className="module-info">
                                        <div className="module-icon">
                                            {module.category_name === 'Python' ? '🐍' : 
                                             module.category_name === 'PHP' ? '🐘' :
                                             module.category_name === 'Node.js' ? '💚' :
                                             module.category_name === 'React.js' ? '⚛️' : '📚'}
                                        </div>
                                        <div className="module-details">
                                            <div className="module-code">{module.code}</div>
                                            <div className="module-name">{module.nom}</div>
                                            <div className="module-meta">
                                                <span className="module-category">{module.category_name}</span>
                                                <span className="resource-count">{resourceCount} ressources</span>
                                            </div>
                                            {Array.isArray(moduleFormateurs[module.id]) && moduleFormateurs[module.id].length > 0 && (
                                                <div className="module-meta" style={{ marginTop: 8 }}>
                                                    {moduleFormateurs[module.id].map((f) => (
                                                        <button
                                                            key={f.id}
                                                            type="button"
                                                            className="download-btn"
                                                            style={{ padding: '4px 10px', fontSize: 11 }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleContactFormateur(module.id, f.id, f.nom, f.prenom);
                                                            }}
                                                        >
                                                            💬 {f.prenom} {f.nom} {f.assignment_type === 'PRINCIPAL' ? '(Chargé de formation)' : '(Simple)'}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="module-toggle">
                                        <span className="toggle-icon">{isExpanded ? '−' : '+'}</span>
                                    </div>
                                </div>
                                
                                {isExpanded && (
                                    <div className="module-accordion-content">
                                        {resourceCount === 0 ? (
                                            <div className="no-resources">
                                                <p>Aucune ressource pour ce module</p>
                                            </div>
                                        ) : (
                                            <div className="resources-grid-modern">
                                                {moduleResources.map(resource => (
                                                    <div key={resource.id} className="resource-card-modern">
                                                        <div className={`resource-badge ${resource.category.toLowerCase()}`}>
                                                            {getCategoryIcon(resource.category)}
                                                            <span>{resource.category}</span>
                                                        </div>
                                                        <h4 className="resource-title">{resource.titre}</h4>
                                                        {resource.description && (
                                                            <p className="resource-description">{resource.description}</p>
                                                        )}
                                                        <p className="resource-description">
                                                            Posté par: {resource.uploader_prenom || ''} {resource.uploader_nom || 'Inconnu'}
                                                            <br />
                                                            Confirmé par: {resource.approver_prenom || ''} {resource.approver_nom || 'N/A'}
                                                        </p>
                                                        <div className="resource-footer-modern">
                                                            <span className="download-count">
                                                                📥 {resource.download_count || 0} téléchargements
                                                            </span>
                                                            <button 
                                                                className="download-btn"
                                                                onClick={() => handleDownload(resource.id)}
                                                            >
                                                                Télécharger
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
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

export default Resources;
