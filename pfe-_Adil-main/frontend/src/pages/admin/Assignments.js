import React, { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import api from '../../services/api';
import './AdminPages.css';
import { sanitizeText } from '../../utils/sanitizeText';

const Assignments = () => {
    const [formateurs, setFormateurs] = useState([]);
    const [modules, setModules] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedFormateur, setSelectedFormateur] = useState(null);
    const [selectedModule, setSelectedModule] = useState(null);
    const [selectedAssignmentType, setSelectedAssignmentType] = useState({ value: 'PRINCIPAL', label: 'Chargé de formation' });
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

        if (selectedAssignmentType?.value === 'SIMPLE' && selectedComponents.length === 0) {
            setMessage({ type: 'error', text: 'Choisissez au moins un composant pour le formateur simple' });
            return;
        }

        try {
            const response = await api.post('/admin/assignments', {
                formateurId: parseInt(selectedFormateur.value),
                moduleId: parseInt(selectedModule.value),
                assignmentType: selectedAssignmentType.value,
                componentScope: selectedAssignmentType.value === 'SIMPLE' ? selectedComponents : null
            });

            if (response.data.success) {
                setMessage({ type: 'success', text: 'Formateur assigné au module avec succès!' });
                setSelectedFormateur(null);
                setSelectedModule(null);
                setSelectedAssignmentType({ value: 'PRINCIPAL', label: 'Chargé de formation' });
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
                            <Select
                                options={formateurs.map(f => ({ value: String(f.id), label: `${f.nom} ${f.prenom} (${f.matricule})` }))}
                                value={selectedFormateur}
                                onChange={(opt) => { setSelectedFormateur(opt); setSelectedComponents([]); }}
                                className="react-select"
                                placeholder="Sélectionner un formateur"
                                isClearable
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Module</label>
                            <Select
                                options={modulesSorted.map(m => ({ value: String(m.id), label: `${m.code} — ${m.nom}` }))}
                                value={selectedModule}
                                onChange={(opt) => { setSelectedModule(opt); setSelectedComponents([]); }}
                                className="react-select"
                                placeholder="Sélectionner un module"
                                isClearable
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Type d'assignation</label>
                            <Select
                                options={[{ value: 'PRINCIPAL', label: 'Chargé de formation' }, { value: 'SIMPLE', label: 'Formateur simple' }]}
                                value={selectedAssignmentType}
                                onChange={(opt) => { setSelectedAssignmentType(opt); setSelectedComponents([]); }}
                                className="react-select"
                                placeholder="Type d'assignation"
                                isClearable={false}
                            />
                        </div>
                        {selectedAssignmentType?.value === 'SIMPLE' && (
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
                        <div style={{ width: 220 }}>
                            <Select
                                options={[{ value: '', label: 'Tous' }, ...formateurs.map(f => ({ value: String(f.id), label: `${f.nom} ${f.prenom}` }))]}
                                value={filterAsgFormateur ? { value: String(filterAsgFormateur), label: formateurs.find(f => String(f.id) === String(filterAsgFormateur)) ? `${formateurs.find(f => String(f.id) === String(filterAsgFormateur)).nom} ${formateurs.find(f => String(f.id) === String(filterAsgFormateur)).prenom}` : '' } : null}
                                onChange={(opt) => setFilterAsgFormateur(opt ? opt.value : '')}
                                isClearable
                                className="react-select"
                                placeholder="Tous"
                            />
                        </div>
                        <label>Module :</label>
                        <div style={{ width: 260 }}>
                            <Select
                                options={[{ value: '', label: 'Tous' }, ...modulesSorted.map(m => ({ value: String(m.id), label: `${m.code} — ${m.nom}` }))]}
                                value={filterAsgModule ? { value: String(filterAsgModule), label: modulesSorted.find(m => String(m.id) === String(filterAsgModule)) ? `${modulesSorted.find(m => String(m.id) === String(filterAsgModule)).code} — ${modulesSorted.find(m => String(m.id) === String(filterAsgModule)).nom}` : '' } : null}
                                onChange={(opt) => setFilterAsgModule(opt ? opt.value : '')}
                                isClearable
                                className="react-select"
                                placeholder="Tous"
                            />
                        </div>
                        <label>Type :</label>
                        <div style={{ width: 220 }}>
                            <Select
                                options={[{ value: '', label: 'Tous' }, { value: 'PRINCIPAL', label: 'Chargé de formation' }, { value: 'SIMPLE', label: 'Formateur simple' }]}
                                value={filterAsgType ? { value: filterAsgType, label: filterAsgType === 'PRINCIPAL' ? 'Chargé de formation' : 'Formateur simple' } : null}
                                onChange={(opt) => setFilterAsgType(opt ? opt.value : '')}
                                isClearable
                                className="react-select"
                                placeholder="Tous"
                            />
                        </div>
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
                                            <small>{sanitizeText(a.module_nom)}</small>
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
                                        <Select
                                            options={modulesSorted.map(m => ({ value: String(m.id), label: `${m.code} — ${m.nom}` }))}
                                            value={editModuleId ? { value: String(editModuleId), label: modulesSorted.find(m => String(m.id) === String(editModuleId)) ? `${modulesSorted.find(m => String(m.id) === String(editModuleId)).code} — ${modulesSorted.find(m => String(m.id) === String(editModuleId)).nom}` : '' } : null}
                                            onChange={(opt) => setEditModuleId(opt ? opt.value : '')}
                                            className="react-select"
                                            placeholder="Sélectionner un module"
                                            isClearable
                                            required
                                        />
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