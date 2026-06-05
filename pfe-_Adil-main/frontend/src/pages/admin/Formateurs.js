import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import './AdminPages.css';

const Formateurs = () => {
    const [formateurs, setFormateurs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        nom: '',
        prenom: '',
        password: ''
    });
    const [message, setMessage] = useState({ type: '', text: '' });
    const [filterNiveau, setFilterNiveau] = useState('');
    // formateurId → Set<niveau>
    const [formateurNiveauxMap, setFormateurNiveauxMap] = useState({});

    useEffect(() => {
        fetchFormateurs();
    }, []);

    const fetchFormateurs = async () => {
        try {
            const [usersRes, assignmentsRes, modulesRes] = await Promise.all([
                api.get('/admin/users'),
                api.get('/admin/assignments'),
                api.get('/admin/modules')
            ]);

            if (usersRes.data.success) {
                const formateurList = usersRes.data.data.filter(u => ['FORMATEUR', 'FORMATEUR_SIMPLE'].includes(u.role_global));
                setFormateurs(formateurList);
            }

            // Construire map moduleId → niveau
            const moduleNiveauMap = {};
            if (modulesRes.data.success) {
                for (const m of modulesRes.data.data) {
                    moduleNiveauMap[m.id] = m.niveau;
                }
            }

            // Construire map formateurId → Set<niveau>
            const niveauxMap = {};
            if (assignmentsRes.data.success) {
                for (const a of assignmentsRes.data.data) {
                    const niv = moduleNiveauMap[a.module_id];
                    if (!niv) continue;
                    if (!niveauxMap[a.formateur_id]) niveauxMap[a.formateur_id] = new Set();
                    niveauxMap[a.formateur_id].add(niv);
                }
            }
            setFormateurNiveauxMap(niveauxMap);
        } catch (error) {
            console.error('Error fetching formateurs:', error);
        } finally {
            setLoading(false);
        }
    };

    const availableNiveaux = useMemo(() => {
        const s = new Set();
        for (const levels of Object.values(formateurNiveauxMap)) {
            for (const n of levels) s.add(n);
        }
        return [...s].sort();
    }, [formateurNiveauxMap]);

    const filteredFormateurs = useMemo(() => {
        if (!filterNiveau) return formateurs;
        return formateurs.filter(f => {
            const levels = formateurNiveauxMap[f.id];
            return levels && levels.has(filterNiveau);
        });
    }, [formateurs, filterNiveau, formateurNiveauxMap]);

    const handleCreateFormateur = async (e) => {
        e.preventDefault();
        if (!formData.email || !formData.nom || !formData.prenom || !formData.password) {
            setMessage({ type: 'error', text: 'Tous les champs sont requis' });
            return;
        }
        if (formData.password.length < 6) {
            setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères' });
            return;
        }

        try {
            const response = await api.post('/admin/formateurs', formData);
            if (response.data.success) {
                setMessage({ type: 'success', text: `Formateur créé! Matricule: ${response.data.data.matricule}` });
                setShowCreateModal(false);
                setFormData({ email: '', nom: '', prenom: '', password: '' });
                fetchFormateurs();
                setTimeout(() => setMessage({ type: '', text: '' }), 5000);
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la création' });
        }
    };

    if (loading) {
        return <div className="loading-text">Chargement des formateurs...</div>;
    }

    return (
        <div className="admin-page fade-in">
            <div className="page-header">
                <h1>Gestion des Formateurs</h1>
                <p>Créez et gérez les formateurs de la plateforme</p>
                <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
                    + Nouveau Formateur
                </button>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="formateurs-stats">
                <div className="stat-badge">
                    Total formateurs: <strong>{formateurs.length}</strong>
                </div>
                {filterNiveau && (
                    <div className="stat-badge">
                        Niveau <strong>{filterNiveau}</strong> : <strong>{filteredFormateurs.length}</strong>
                    </div>
                )}
            </div>

            <div className="table-container">
                <div className="filters-bar">
                    {availableNiveaux.length > 0 && (
                        <>
                            <label>Filtrer par niveau :</label>
                            <select
                                className="filter-select"
                                value={filterNiveau}
                                onChange={e => setFilterNiveau(e.target.value)}
                            >
                                <option value="">Tous les niveaux</option>
                                {availableNiveaux.map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </>
                    )}
                    {filterNiveau && (
                        <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: 13 }}
                            onClick={() => setFilterNiveau('')}
                        >
                            Réinitialiser
                        </button>
                    )}
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Matricule</th>
                            <th>Nom complet</th>
                            <th>Email</th>
                            <th>Niveaux enseignés</th>
                            <th>Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredFormateurs.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: 24 }}>
                                    {filterNiveau
                                        ? `Aucun formateur pour le niveau ${filterNiveau}.`
                                        : 'Aucun formateur pour le moment.'}
                                </td>
                            </tr>
                        ) : (
                            filteredFormateurs.map((formateur) => {
                                const niveaux = formateurNiveauxMap[formateur.id];
                                return (
                                    <tr key={formateur.id}>
                                        <td><code>{formateur.matricule}</code></td>
                                        <td><strong>{formateur.nom} {formateur.prenom}</strong></td>
                                        <td>{formateur.email}</td>
                                        <td>
                                            {niveaux && niveaux.size > 0
                                                ? [...niveaux].sort().map(n => (
                                                    <span key={n} className="badge" style={{ background: '#6366f1', marginRight: 4 }}>{n}</span>
                                                ))
                                                : <span style={{ color: 'var(--gray-400)' }}>Non assigné</span>
                                            }
                                        </td>
                                        <td>
                                            <span className="badge badge-formateur">
                                                Formateur
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Formateur Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Créer un nouveau formateur</h3>
                            <button className="modal-close" onClick={() => setShowCreateModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleCreateFormateur}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Email *</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                        placeholder="formateur@example.com"
                                        required
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Nom *</label>
                                        <input
                                            type="text"
                                            value={formData.nom}
                                            onChange={(e) => setFormData({...formData, nom: e.target.value})}
                                            placeholder="Dupont"
                                            required
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Prénom *</label>
                                        <input
                                            type="text"
                                            value={formData.prenom}
                                            onChange={(e) => setFormData({...formData, prenom: e.target.value})}
                                            placeholder="Jean"
                                            required
                                            className="form-input"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Mot de passe temporaire *</label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                                        placeholder="Minimum 6 caractères"
                                        required
                                        className="form-input"
                                    />
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
        </div>
    );
};

export default Formateurs;
