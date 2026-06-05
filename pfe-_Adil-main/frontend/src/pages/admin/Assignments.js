import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import './AdminPages.css';

const Assignments = () => {
    const [formateurs, setFormateurs] = useState([]);
    const [modules, setModules] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedFormateur, setSelectedFormateur] = useState('');
    const [selectedModule, setSelectedModule] = useState('');
    const [selectedAssignmentType, setSelectedAssignmentType] = useState('PRINCIPAL');
    const [selectedComponents, setSelectedComponents] = useState([]);
    const [message, setMessage] = useState({ type: '', text: '' });
    
    // Edit modal states
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState(null);
    const [editModuleId, setEditModuleId] = useState('');

    // Filtres liste assignations
    const [filterAsgFormateur, setFilterAsgFormateur] = useState('');
    const [filterAsgModule, setFilterAsgModule] = useState('');
    const [filterAsgType, setFilterAsgType] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            
            // Fetch users to get formateurs
            const usersRes = await api.get('/admin/users');
            const formateurList = usersRes.data.data.filter(u => ['FORMATEUR', 'FORMATEUR_SIMPLE'].includes(u.role_global));
            setFormateurs(formateurList);
            
            // Fetch modules
            const modulesRes = await api.get('/admin/modules');
            if (modulesRes.data.success) {
                setModules(modulesRes.data.data);
            } else {
                // Fallback to get from stats
                const statsRes = await api.get('/admin/stats');
                if (statsRes.data.success && statsRes.data.data.modules) {
                    setModules(statsRes.data.data.modules);
                }
            }
            
            // Fetch existing assignments
            const assignmentsRes = await api.get('/admin/assignments');
            if (assignmentsRes.data.success) {
                setAssignments(assignmentsRes.data.data);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            setMessage({ type: 'error', text: 'Erreur lors du chargement des données' });
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (e) => {
        e.preventDefault();
        if (!selectedFormateur || !selectedModule) {
            setMessage({ type: 'error', text: 'Veuillez sélectionner un formateur et un module' });
            return;
        }

        if (selectedAssignmentType === 'SIMPLE' && selectedComponents.length === 0) {
            setMessage({ type: 'error', text: 'Choisissez au moins un composant pour le formateur simple' });
            return;
        }

        try {
            const response = await api.post('/admin/assignments', {
                formateurId: parseInt(selectedFormateur),
                moduleId: parseInt(selectedModule),
                assignmentType: selectedAssignmentType,
                componentScope: selectedAssignmentType === 'SIMPLE' ? selectedComponents : null
            });

            if (response.data.success) {
                setMessage({ type: 'success', text: 'Formateur assigné au module avec succès!' });
                setSelectedFormateur('');
                setSelectedModule('');
                setSelectedAssignmentType('PRINCIPAL');
                setSelectedComponents([]);
                fetchData();
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de l\'assignation' });
        }
    };

    const handleDeleteAssignment = async (assignmentId, formateurName, moduleName) => {
        if (window.confirm(`Retirer l'assignation de "${formateurName}" au module "${moduleName}" ?`)) {
            try {
                await api.delete(`/admin/assignments/${assignmentId}`);
                setMessage({ type: 'success', text: 'Assignation retirée avec succès' });
                fetchData();
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            } catch (error) {
                setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la suppression' });
            }
        }
    };

    const handleEditAssignment = (assignment) => {
        setEditingAssignment(assignment);
        setEditModuleId(assignment.module_id.toString());
        setShowEditModal(true);
    };

    const handleUpdateAssignment = async (e) => {
        e.preventDefault();
        try {
            const response = await api.put(`/admin/assignments/${editingAssignment.id}`, {
                moduleId: parseInt(editModuleId)
            });
            if (response.data.success) {
                setMessage({ type: 'success', text: 'Assignation mise à jour avec succès' });
                setShowEditModal(false);
                fetchData();
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la mise à jour' });
        }
    };

    const modulesSorted = [...modules].sort((a, b) =>
        String(a.code).localeCompare(String(b.code))
    );

    const filteredAssignments = useMemo(() => {
        return assignments.filter(a => {
            if (filterAsgFormateur && String(a.formateur_id) !== String(filterAsgFormateur)) return false;
            if (filterAsgModule && String(a.module_id) !== String(filterAsgModule)) return false;
            if (filterAsgType && a.assignment_type !== filterAsgType) return false;
            return true;
        });
    }, [assignments, filterAsgFormateur, filterAsgModule, filterAsgType]);

    const selectedModuleData = modules.find((m) => String(m.id) === String(selectedModule));
    const moduleComponents = Array.isArray(selectedModuleData?.components) && selectedModuleData.components.length > 0
        ? selectedModuleData.components
        : ['Cours', 'TD', 'TP'];

    const toggleComponent = (component) => {
        setSelectedComponents((prev) =>
            prev.includes(component)
                ? prev.filter((c) => c !== component)
                : [...prev, component]
        );
    };

    if (loading) {
        return <div className="loading-text">Chargement...</div>;
    }

    return (
        <div className="admin-page fade-in">
            <div className="page-header">
                <h1>Assignation des Formateurs</h1>
                <p>Assignez des formateurs aux modules</p>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="assignment-form">
                <h2>Nouvelle assignation</h2>
                <form onSubmit={handleAssign}>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Formateur</label>
                            <select
                                value={selectedFormateur}
                                onChange={(e) => {
                                    setSelectedFormateur(e.target.value);
                                    setSelectedComponents([]);
                                }}
                                className="form-select"
                                required
                            >
                                <option value="">Sélectionner un formateur</option>
                                {formateurs.map(f => (
                                    <option key={f.id} value={f.id}>
                                        {f.nom} {f.prenom} ({f.matricule})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Module</label>
                            <select
                                value={selectedModule}
                                onChange={(e) => {
                                    setSelectedModule(e.target.value);
                                    setSelectedComponents([]);
                                }}
                                className="form-select"
                                required
                            >
                                <option value="">Sélectionner un module</option>
                                {modulesSorted.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.code} — {m.nom}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Type d'assignation</label>
                            <select
                                value={selectedAssignmentType}
                                onChange={(e) => {
                                    setSelectedAssignmentType(e.target.value);
                                    setSelectedComponents([]);
                                }}
                                className="form-select"
                                required
                            >
                                <option value="PRINCIPAL">Chargé de formation</option>
                                <option value="SIMPLE">Formateur simple</option>
                            </select>
                        </div>
                        {selectedAssignmentType === 'SIMPLE' && (
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 260 }}>
                                <label>Composants assignés (formateur simple)</label>
                                {moduleComponents.map((component) => (
                                    <label key={component}>
                                        <input
                                            type="checkbox"
                                            checked={selectedComponents.includes(component)}
                                            onChange={() => toggleComponent(component)}
                                        />{' '}
                                        {component}
                                    </label>
                                ))}
                            </div>
                        )}
                        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button type="submit" className="btn-primary">Assigner</button>
                        </div>
                    </div>
                </form>
            </div>

            <div className="assignments-list">
                <h2>Assignations existantes ({assignments.length})</h2>
                <div className="table-container">
                    <div className="filters-bar">
                        <label>Formateur :</label>
                        <select
                            className="filter-select"
                            value={filterAsgFormateur}
                            onChange={e => setFilterAsgFormateur(e.target.value)}
                        >
                            <option value="">Tous</option>
                            {formateurs.map(f => (
                                <option key={f.id} value={f.id}>{f.nom} {f.prenom}</option>
                            ))}
                        </select>
                        <label>Module :</label>
                        <select
                            className="filter-select"
                            value={filterAsgModule}
                            onChange={e => setFilterAsgModule(e.target.value)}
                        >
                            <option value="">Tous</option>
                            {modulesSorted.map(m => (
                                <option key={m.id} value={m.id}>{m.code} — {m.nom}</option>
                            ))}
                        </select>
                        <label>Type :</label>
                        <select
                            className="filter-select"
                            value={filterAsgType}
                            onChange={e => setFilterAsgType(e.target.value)}
                        >
                            <option value="">Tous</option>
                            <option value="PRINCIPAL">Chargé de formation</option>
                            <option value="SIMPLE">Formateur simple</option>
                        </select>
                        {(filterAsgFormateur || filterAsgModule || filterAsgType) && (
                            <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '6px 12px', fontSize: 13 }}
                                onClick={() => { setFilterAsgFormateur(''); setFilterAsgModule(''); setFilterAsgType(''); }}
                            >
                                Réinitialiser
                            </button>
                        )}
                    </div>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Formateur</th>
                                <th>Module</th>
                                <th>Statut</th>
                                <th>Date d'assignation</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAssignments.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: 24 }}>
                                        Aucune assignation pour ces filtres.
                                    </td>
                                </tr>
                            ) : (
                                filteredAssignments.map((a) => (
                                    <tr key={a.id}>
                                        <td>
                                            <strong>{a.formateur_nom} {a.formateur_prenom}</strong>
                                            <br />
                                            <small>{a.formateur_matricule}</small>
                                            <br />
                                            <small>{a.role_global === 'FORMATEUR' ? 'Formateur principal' : 'Formateur simple'}</small>
                                        </td>
                                        <td>
                                            <strong>{a.module_code}</strong>
                                            <br />
                                            <small>{a.module_nom}</small>
                                        </td>
                                        <td>
                                            <span className="badge" style={{ background: a.assignment_type === 'PRINCIPAL' ? '#6366f1' : '#0ea5e9' }}>
                                                {a.assignment_type === 'PRINCIPAL' ? 'Chargé de formation' : 'Formateur simple'}
                                            </span>
                                            {a.assignment_type === 'SIMPLE' && (
                                                <>
                                                    <br />
                                                    <small>
                                                        {Array.isArray(a.component_scope) && a.component_scope.length > 0
                                                            ? a.component_scope.join(', ')
                                                            : 'Composants non définis'}
                                                    </small>
                                                </>
                                            )}
                                        </td>
                                        <td>{new Date(a.assigned_at).toLocaleDateString()}</td>
                                        <td className="actions-cell">
                                            <button 
                                                className="btn-icon"
                                                onClick={() => handleEditAssignment(a)}
                                                title="Modifier l'assignation"
                                            >
                                                ✏️
                                            </button>
                                            <button 
                                                className="btn-icon btn-danger"
                                                onClick={() => handleDeleteAssignment(a.id, `${a.formateur_nom} ${a.formateur_prenom}`, a.module_nom)}
                                                title="Retirer l'assignation"
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Assignment Modal */}
            {showEditModal && editingAssignment && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Modifier l'assignation</h3>
                            <button className="modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleUpdateAssignment}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Formateur</label>
                                    <input 
                                        type="text" 
                                        value={`${editingAssignment.formateur_nom} ${editingAssignment.formateur_prenom}`} 
                                        disabled 
                                        className="form-input" 
                                    />
                                    <small className="form-hint">{editingAssignment.formateur_matricule}</small>
                                </div>
                                <div className="form-group">
                                    <label>Module actuel</label>
                                    <input 
                                        type="text" 
                                        value={`${editingAssignment.module_code} - ${editingAssignment.module_nom}`} 
                                        disabled 
                                        className="form-input" 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Nouveau module</label>
                                    <select
                                        value={editModuleId}
                                        onChange={(e) => setEditModuleId(e.target.value)}
                                        className="form-select"
                                        required
                                    >
                                        <option value="">Sélectionner un module</option>
                                        {modulesSorted.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.code} — {m.nom}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>Annuler</button>
                                <button type="submit" className="btn-primary">Mettre à jour</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Assignments;