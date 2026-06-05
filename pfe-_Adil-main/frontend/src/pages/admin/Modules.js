import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import './AdminPages.css';

const Modules = () => {
    const [modules, setModules] = useState([]);
    const [moduleResources, setModuleResources] = useState({});
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({
        code: '',
        nom: '',
        description: '',
        credits: 6,
        coeff: 2.0,
        components: ['Cours', 'TD', 'TP']
    });
    const [message, setMessage] = useState({ type: '', text: '' });
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingModule, setEditingModule] = useState(null);
    const [editFormData, setEditFormData] = useState({
        nom: '',
        description: '',
        credits: 6,
        coeff: 2.0,
        components: ['Cours', 'TD', 'TP']
    });
    const [newComponentName, setNewComponentName] = useState('');
    const [newEditComponentName, setNewEditComponentName] = useState('');

    useEffect(() => {
        fetchModules();
    }, []);

    const sortedModules = useMemo(
        () => [...modules].sort((a, b) => String(a.code).localeCompare(String(b.code))),
        [modules]
    );

    useEffect(() => {
        if (!sortedModules.length) return;
        let cancelled = false;
        (async () => {
            const next = {};
            await Promise.all(
                sortedModules.map(async (m) => {
                    try {
                        const res = await api.get(`/admin/modules/${m.id}/resources`);
                        if (res.data.success) next[m.id] = res.data.data || [];
                    } catch (e) {
                        console.error(e);
                        next[m.id] = [];
                    }
                })
            );
            if (!cancelled) setModuleResources(next);
        })();
        return () => { cancelled = true; };
    }, [sortedModules]);

    const fetchModules = async () => {
        try {
            const response = await api.get('/admin/modules');
            if (response.data.success) {
                setModules(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching modules:', error);
            try {
                const statsResponse = await api.get('/admin/stats');
                if (statsResponse.data.success && statsResponse.data.data.modules) {
                    setModules(statsResponse.data.data.modules || []);
                }
            } catch (statsError) {
                console.error('Stats error:', statsError);
            }
        } finally {
            setLoading(false);
        }
    };

    const countByCategory = (resources, cat) =>
        (resources || []).filter((r) => r.category === cat).length;

    const handleCreateModule = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/admin/modules', formData);
            if (response.data.success) {
                setMessage({ type: 'success', text: 'Module créé avec succès!' });
                setShowCreateModal(false);
                setFormData({ code: '', nom: '', description: '', credits: 6, coeff: 2.0, components: ['Cours', 'TD', 'TP'] });
                fetchModules();
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la création' });
        }
    };

    const handleDeleteModule = async (moduleId, moduleName) => {
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer le module "${moduleName}" ?`)) {
            try {
                await api.delete(`/admin/modules/${moduleId}`);
                setMessage({ type: 'success', text: 'Module supprimé avec succès' });
                fetchModules();
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            } catch (error) {
                setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la suppression' });
            }
        }
    };

    const handleEditModule = (module) => {
        setEditingModule(module);
        setEditFormData({
            nom: module.nom,
            description: module.description || '',
            credits: module.credits,
            coeff: module.coeff,
            components: Array.isArray(module.components) && module.components.length > 0
                ? module.components
                : ['Cours', 'TD', 'TP']
        });
        setShowEditModal(true);
    };

    const addCreateComponent = () => {
        const value = newComponentName.trim();
        if (!value || formData.components.includes(value)) return;
        setFormData({ ...formData, components: [...formData.components, value] });
        setNewComponentName('');
    };

    const removeCreateComponent = (component) => {
        const next = formData.components.filter((c) => c !== component);
        if (next.length === 0) return;
        setFormData({ ...formData, components: next });
    };

    const addEditComponent = () => {
        const value = newEditComponentName.trim();
        if (!value || editFormData.components.includes(value)) return;
        setEditFormData({ ...editFormData, components: [...editFormData.components, value] });
        setNewEditComponentName('');
    };

    const removeEditComponent = (component) => {
        const next = editFormData.components.filter((c) => c !== component);
        if (next.length === 0) return;
        setEditFormData({ ...editFormData, components: next });
    };

    const handleUpdateModule = async (e) => {
        e.preventDefault();
        try {
            const response = await api.put(`/admin/modules/${editingModule.id}`, editFormData);
            if (response.data.success) {
                setMessage({ type: 'success', text: 'Module mis à jour avec succès' });
                setShowEditModal(false);
                fetchModules();
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la mise à jour' });
        }
    };

    if (loading) {
        return <div className="loading-text">Chargement des modules...</div>;
    }

    return (
        <div className="admin-page fade-in">
            <div className="page-header">
                <div>
                    <div className="page-kicker">Administration pédagogique</div>
                    <h1>Gestion des Modules</h1>
                    <p>Modules, composants et ressources, affichés de manière plus claire</p>
                </div>
                <button type="button" className="btn-primary" onClick={() => setShowCreateModal(true)}>
                    + Nouveau Module
                </button>
            </div>

            <div className="module-overview-strip">
                <div className="overview-card">
                    <span className="overview-value">{sortedModules.length}</span>
                    <span className="overview-label">Modules visibles</span>
                </div>
                <div className="overview-card">
                    <span className="overview-value">3</span>
                    <span className="overview-label">Composants par défaut</span>
                </div>
                <div className="overview-card">
                    <span className="overview-value">Cours / TD / TP</span>
                    <span className="overview-label">Affichage par composant</span>
                </div>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="modules-admin-grid">
                {sortedModules.length === 0 ? (
                    <p className="loading-text">Aucun module pour le moment.</p>
                ) : (
                    sortedModules.map((module) => {
                        const resList = moduleResources[module.id] || [];
                        return (
                            <div key={module.id} className="module-card admin-module-detail">
                                <div className="module-card-accent" />
                                <div className="module-card-head">
                                    <div>
                                        <div className="module-code">{module.code}</div>
                                        <h3 className="module-name">{module.nom}</h3>
                                        {module.description && (
                                            <div className="module-desc">{module.description}</div>
                                        )}
                                        <div className="module-meta">
                                            <span>Crédits: {module.credits}</span>
                                            <span>Coeff: {module.coeff}</span>
                                        </div>
                                        <div className="component-chip-row">
                                            {(Array.isArray(module.components) && module.components.length > 0 ? module.components : ['Cours', 'TD', 'TP']).map((c) => (
                                                <span key={c} className="component-chip">{c}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="module-actions">
                                        <button
                                            type="button"
                                            className="btn-icon"
                                            onClick={() => handleEditModule(module)}
                                            title="Modifier"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-icon btn-danger"
                                            onClick={() => handleDeleteModule(module.id, module.nom)}
                                            title="Supprimer"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                <div className="resource-type-grid">
                                    {(Array.isArray(module.components) && module.components.length > 0 ? module.components : ['Cours', 'TD', 'TP']).map((cat) => (
                                        <div key={cat} className="resource-type-cell">
                                            <span className="resource-type-label">{cat}</span>
                                            <span className="resource-type-count">{countByCategory(resList, cat)}</span>
                                        </div>
                                    ))}
                                </div>
                                {resList.length > 0 && (
                                    <ul className="resource-mini-list">
                                        {resList.map((r) => (
                                            <li key={r.id}>
                                                <span className="r-cat">{r.category || '—'}</span>
                                                {r.titre}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Créer un nouveau module</h3>
                            <button type="button" className="modal-close" onClick={() => setShowCreateModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleCreateModule}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Code du module *</label>
                                    <input
                                        type="text"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        placeholder="ex: INFO-101"
                                        required
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Nom du module *</label>
                                    <input
                                        type="text"
                                        value={formData.nom}
                                        onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                                        placeholder="ex: Introduction à la Programmation"
                                        required
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Description du module..."
                                        rows="3"
                                        className="form-textarea"
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Crédits</label>
                                        <input
                                            type="number"
                                            value={formData.credits}
                                            onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value, 10) })}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Coefficient</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={formData.coeff}
                                            onChange={(e) => setFormData({ ...formData, coeff: parseFloat(e.target.value) })}
                                            className="form-input"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Composants du module</label>
                                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                        <input
                                            type="text"
                                            value={newComponentName}
                                            onChange={(e) => setNewComponentName(e.target.value)}
                                            placeholder="Ajouter un composant (ex: Projet)"
                                            className="form-input"
                                        />
                                        <button type="button" className="btn-secondary" onClick={addCreateComponent}>Ajouter</button>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {formData.components.map((component) => (
                                            <button
                                                key={component}
                                                type="button"
                                                className="badge"
                                                style={{ background: '#0284c7', border: 'none', cursor: 'pointer' }}
                                                onClick={() => removeCreateComponent(component)}
                                                title="Supprimer ce composant"
                                            >
                                                {component} ×
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Annuler</button>
                                <button type="submit" className="btn-primary">Créer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showEditModal && editingModule && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Modifier le module</h3>
                            <button type="button" className="modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleUpdateModule}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Code du module</label>
                                    <input
                                        type="text"
                                        value={editingModule.code}
                                        disabled
                                        className="form-input"
                                    />
                                    <small className="form-hint">Le code n&apos;est pas modifiable</small>
                                </div>
                                <div className="form-group">
                                    <label>Nom du module *</label>
                                    <input
                                        type="text"
                                        value={editFormData.nom}
                                        onChange={(e) => setEditFormData({ ...editFormData, nom: e.target.value })}
                                        className="form-input"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                        value={editFormData.description}
                                        onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                        className="form-textarea"
                                        rows="3"
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Crédits</label>
                                        <input
                                            type="number"
                                            value={editFormData.credits}
                                            onChange={(e) => setEditFormData({ ...editFormData, credits: parseInt(e.target.value, 10) })}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Coefficient</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={editFormData.coeff}
                                            onChange={(e) => setEditFormData({ ...editFormData, coeff: parseFloat(e.target.value) })}
                                            className="form-input"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Composants du module</label>
                                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                        <input
                                            type="text"
                                            value={newEditComponentName}
                                            onChange={(e) => setNewEditComponentName(e.target.value)}
                                            placeholder="Ajouter un composant"
                                            className="form-input"
                                        />
                                        <button type="button" className="btn-secondary" onClick={addEditComponent}>Ajouter</button>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {editFormData.components.map((component) => (
                                            <button
                                                key={component}
                                                type="button"
                                                className="badge"
                                                style={{ background: '#0284c7', border: 'none', cursor: 'pointer' }}
                                                onClick={() => removeEditComponent(component)}
                                                title="Supprimer ce composant"
                                            >
                                                {component} ×
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>Annuler</button>
                                <button type="submit" className="btn-primary">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Modules;
