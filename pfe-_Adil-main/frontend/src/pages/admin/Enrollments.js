import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import './AdminPages.css';

const Enrollments = () => {
    const [students, setStudents] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStudent, setSelectedStudent] = useState('');
    const [selectedModule, setSelectedModule] = useState('');
    const [studentQuery, setStudentQuery] = useState('');
    const [moduleQuery, setModuleQuery] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });

    // Filtres
    const [filterModule, setFilterModule] = useState('');
    const [filterNiveau, setFilterNiveau] = useState('');
    const [filterYear, setFilterYear] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const modulesFromAssignments = useMemo(() => {
        const byId = new Map();
        for (const a of assignments) {
            if (!a.module_id || byId.has(a.module_id)) continue;
            byId.set(a.module_id, {
                id: a.module_id,
                code: a.module_code,
                nom: a.module_nom,
                formateurLabel: `${a.formateur_nom || ''} ${a.formateur_prenom || ''}`.trim()
            });
        }
        return Array.from(byId.values()).sort((x, y) =>
            String(x.code).localeCompare(String(y.code))
        );
    }, [assignments]);

    const studentOptions = useMemo(() => {
        return students
            .map((s) => ({
                id: String(s.id),
                label: `${s.nom} ${s.prenom} (${s.matricule || s.email})`
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [students]);

    const moduleOptions = useMemo(() => {
        return modulesFromAssignments
            .map((m) => ({
                id: String(m.id),
                label: `${m.code} — ${m.nom}${m.formateurLabel ? ` (${m.formateurLabel})` : ''}`
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [modulesFromAssignments]);

    // Valeurs disponibles pour les filtres (dérivées des inscriptions existantes)
    const availableEnrollmentNiveaux = useMemo(() => {
        const s = new Set(enrollments.map(e => e.student_niveau).filter(Boolean));
        return [...s].sort();
    }, [enrollments]);

    const availableEnrollmentYears = useMemo(() => {
        const s = new Set(enrollments.map(e => new Date(e.enrolled_at).getFullYear()).filter(Boolean));
        return [...s].sort((a, b) => b - a);
    }, [enrollments]);

    const filteredEnrollments = useMemo(() => {
        return enrollments.filter(e => {
            if (filterModule && String(e.module_id) !== String(filterModule)) return false;
            if (filterNiveau && e.student_niveau !== filterNiveau) return false;
            if (filterYear && String(new Date(e.enrolled_at).getFullYear()) !== String(filterYear)) return false;
            return true;
        });
    }, [enrollments, filterModule, filterNiveau, filterYear]);

    const fetchData = async () => {
        try {
            const [usersRes, assignmentsRes] = await Promise.all([
                api.get('/admin/users'),
                api.get('/admin/assignments')
            ]);

            const studentList = usersRes.data.data.filter((u) => u.role_global === 'ETUDIANT');
            setStudents(studentList);

            if (assignmentsRes.data.success) {
                setAssignments(assignmentsRes.data.data || []);
            }

            const enrollmentsRes = await api.get('/admin/enrollments');
            if (enrollmentsRes.data.success) {
                setEnrollments(enrollmentsRes.data.data);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            setMessage({ type: 'error', text: 'Erreur lors du chargement des données' });
        } finally {
            setLoading(false);
        }
    };

    const handleEnroll = async (e) => {
        e.preventDefault();
        let studentId = selectedStudent;
        let moduleId = selectedModule;

        if (!studentId) {
            const match = studentOptions.find((o) => o.label === studentQuery);
            studentId = match?.id || '';
        }
        if (!moduleId) {
            const match = moduleOptions.find((o) => o.label === moduleQuery);
            moduleId = match?.id || '';
        }

        if (!studentId || !moduleId) {
            setMessage({ type: 'error', text: 'Veuillez sélectionner un étudiant et un module valides.' });
            return;
        }

        try {
            const response = await api.post('/admin/enrollments', {
                etudiantId: parseInt(studentId, 10),
                moduleId: parseInt(moduleId, 10)
            });

            if (response.data.success) {
                setMessage({ type: 'success', text: 'Étudiant inscrit au module avec succès!' });
                setSelectedStudent('');
                setSelectedModule('');
                setStudentQuery('');
                setModuleQuery('');
                fetchData();
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de l\'inscription' });
        }
    };

    const handleDeleteEnrollment = async (enrollmentId, studentName, moduleName) => {
        if (window.confirm(`Désinscrire "${studentName}" du module "${moduleName}" ?`)) {
            try {
                await api.delete(`/admin/enrollments/${enrollmentId}`);
                setMessage({ type: 'success', text: 'Désinscription effectuée avec succès' });
                fetchData();
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            } catch (error) {
                setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la désinscription' });
            }
        }
    };

    if (loading) {
        return <div className="loading-text">Chargement...</div>;
    }

    return (
        <div className="admin-page fade-in">
            <div className="page-header">
                <h1>Inscriptions des Étudiants</h1>
                <p>Inscrivez les étudiants aux modules qui ont un formateur assigné</p>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="assignment-form">
                <h2>Nouvelle inscription</h2>
                <form onSubmit={handleEnroll}>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="student-search">Étudiant</label>
                            <input
                                id="student-search"
                                list="students-list"
                                className="form-input"
                                placeholder="Rechercher un étudiant..."
                                value={studentQuery}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setStudentQuery(value);
                                    const match = studentOptions.find((o) => o.label === value);
                                    setSelectedStudent(match?.id || '');
                                }}
                                required
                                autoComplete="off"
                            />
                            <datalist id="students-list">
                                {studentOptions.map((option) => (
                                    <option key={option.id} value={option.label} />
                                ))}
                            </datalist>
                        </div>
                        <div className="form-group">
                            <label htmlFor="module-search">Module (avec formateur)</label>
                            <input
                                id="module-search"
                                list="modules-list"
                                className="form-input"
                                placeholder={modulesFromAssignments.length === 0 ? 'Aucun module assigné — utilisez Assignations d’abord' : 'Rechercher un module...'}
                                value={moduleQuery}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setModuleQuery(value);
                                    const match = moduleOptions.find((o) => o.label === value);
                                    setSelectedModule(match?.id || '');
                                }}
                                required
                                disabled={modulesFromAssignments.length === 0}
                                autoComplete="off"
                            />
                            <datalist id="modules-list">
                                {moduleOptions.map((option) => (
                                    <option key={option.id} value={option.label} />
                                ))}
                            </datalist>
                        </div>
                        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button type="submit" className="btn-primary" disabled={modulesFromAssignments.length === 0}>
                                Inscrire
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            <div className="enrollments-list">
                <h2>Inscriptions existantes ({enrollments.length})</h2>
                <div className="table-container">
                    <div className="filters-bar">
                        <label>Module :</label>
                        <select
                            className="filter-select"
                            value={filterModule}
                            onChange={e => setFilterModule(e.target.value)}
                        >
                            <option value="">Tous</option>
                            {modulesFromAssignments.map(m => (
                                <option key={m.id} value={m.id}>{m.code} — {m.nom}</option>
                            ))}
                        </select>
                        {availableEnrollmentNiveaux.length > 0 && (
                            <>
                                <label>Niveau :</label>
                                <select
                                    className="filter-select"
                                    value={filterNiveau}
                                    onChange={e => setFilterNiveau(e.target.value)}
                                >
                                    <option value="">Tous</option>
                                    {availableEnrollmentNiveaux.map(n => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>
                            </>
                        )}
                        {availableEnrollmentYears.length > 0 && (
                            <>
                                <label>Année :</label>
                                <select
                                    className="filter-select"
                                    value={filterYear}
                                    onChange={e => setFilterYear(e.target.value)}
                                >
                                    <option value="">Toutes</option>
                                    {availableEnrollmentYears.map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </>
                        )}
                        {(filterModule || filterNiveau || filterYear) && (
                            <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '6px 12px', fontSize: 13 }}
                                onClick={() => { setFilterModule(''); setFilterNiveau(''); setFilterYear(''); }}
                            >
                                Réinitialiser
                            </button>
                        )}
                    </div>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Étudiant</th>
                                <th>Niveau</th>
                                <th>Module</th>
                                <th>Date d&apos;inscription</th>
                                <th>Statut</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEnrollments.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: 24 }}>
                                        Aucune inscription pour ces filtres.
                                    </td>
                                </tr>
                            ) : (
                                filteredEnrollments.map((e) => (
                                    <tr key={e.enrollment_id}>
                                        <td>{e.student_nom} {e.student_prenom}</td>
                                        <td>{e.student_niveau || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                                        <td>{e.module_code} - {e.module_nom}</td>
                                        <td>{new Date(e.enrolled_at).toLocaleDateString()}</td>
                                        <td>
                                            <span className="badge badge-success">{e.status}</span>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="btn-icon btn-danger"
                                                onClick={() =>
                                                    handleDeleteEnrollment(
                                                        e.enrollment_id,
                                                        `${e.student_nom} ${e.student_prenom}`,
                                                        e.module_nom
                                                    )
                                                }
                                                title="Désinscrire"
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
        </div>
    );
};

export default Enrollments;
