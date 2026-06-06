import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import FirstLoginSetupModal from '../../components/admin/FirstLoginSetupModal';
import api from '../../services/api';
import './AdminDashboard.css';
import './AdminPages.css';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [studentForm, setStudentForm] = useState({
        nom: '',
        prenom: '',
        email: '',
        password: ''
    });
    const { user } = useAuth();
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [studentMessage, setStudentMessage] = useState({ type: '', text: '' });
    const [creatingStudent, setCreatingStudent] = useState(false);

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        if (user?.is_first_login && user?.role_global === 'ADMIN') {
            setShowSetupModal(true);
        }
    }, [user]);

    const fetchStats = async () => {
        try {
            const response = await api.get('/admin/stats');
            if (response.data.success) {
                setStats(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const resetStudentForm = () => {
        setStudentForm({
            nom: '',
            prenom: '',
            email: '',
            password: ''
        });
        setStudentMessage({ type: '', text: '' });
    };

    const handleCreateStudent = async (e) => {
        e.preventDefault();
        setStudentMessage({ type: '', text: '' });

        if (!studentForm.email || !studentForm.nom || !studentForm.prenom || !studentForm.password) {
            setStudentMessage({ type: 'error', text: 'Tous les champs obligatoires doivent être remplis.' });
            return;
        }
        if (studentForm.password.length < 6) {
            setStudentMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères.' });
            return;
        }

        setCreatingStudent(true);
        try {
            const payload = {
                nom: studentForm.nom.trim(),
                prenom: studentForm.prenom.trim(),
                email: studentForm.email.trim(),
                password: studentForm.password
            };

            const response = await api.post('/admin/students', payload);
            if (response.data.success) {
                const matricule = response.data.data?.matricule;
                setShowStudentModal(false);
                resetStudentForm();
                navigate('/admin/users', {
                    state: {
                        flash: {
                            type: 'success',
                            text: matricule
                                ? `Étudiant créé. Matricule : ${matricule} (connexion avec matricule ou email).`
                                : 'Étudiant créé avec succès.'
                        }
                    }
                });
            }
        } catch (error) {
            setStudentMessage({
                type: 'error',
                text: error.response?.data?.error || error.response?.data?.message || 'Erreur lors de la création'
            });
        } finally {
            setCreatingStudent(false);
        }
    };

    const statCards = [
        { title: 'Utilisateurs', value: stats?.totalUsers || 0, icon: '👥', color: 'blue' },
        { title: 'Admins', value: stats?.totalAdmins || 0, icon: '👑', color: 'purple' },
        { title: 'Formateurs', value: stats?.totalFormateurs || 0, icon: '👨‍🏫', color: 'green' },
        { title: 'Étudiants', value: stats?.totalEtudiants || 0, icon: '🎓', color: 'orange' },
        { title: 'Modules', value: stats?.totalModules || 0, icon: '📚', color: 'teal' },
    ];

    if (loading) {
        return <div className="loading-text">Chargement...</div>;
    }

    return (
        <div className="admin-dashboard fade-in">
            <div className="welcome-banner">
                <div className="welcome-kicker">Espace de pilotage</div>
                <h1>Tableau de bord Administrateur</h1>
                <p>Vue synthétique des utilisateurs, modules, formateurs et étudiants</p>
                <div className="banner-pills">
                    <span>Gestion multi-école</span>
                    <span>Accès rapide</span>
                    <span>Suivi pédagogique</span>
                </div>
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

            <div className="admin-actions">
                <h2>Actions rapides</h2>
                <div className="action-buttons">
                    <button type="button" onClick={() => window.location.href = '/admin/formateurs'}>
                        ➕ Créer un formateur
                    </button>
                    <button type="button" onClick={() => window.location.href = '/admin/modules'}>
                        📚 Créer un module
                    </button>
                    <button type="button" onClick={() => { resetStudentForm(); setShowStudentModal(true); }}>
                        🎓 Créer un étudiant
                    </button>
                    <button type="button" onClick={() => window.location.href = '/admin/enrollments'}>
                        📝 Inscrire un étudiant
                    </button>
                </div>
            </div>

            {showStudentModal && (
                <div className="modal-overlay" onClick={() => { setShowStudentModal(false); resetStudentForm(); }}>
                    <div className="modal-content" onClick={(ev) => ev.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Créer un étudiant</h3>
                            <button
                                type="button"
                                className="modal-close"
                                onClick={() => { setShowStudentModal(false); resetStudentForm(); }}
                            >
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleCreateStudent}>
                            <div className="modal-body">
                                {studentMessage.text && (
                                    <div className={`alert alert-${studentMessage.type}`} style={{ marginBottom: '12px' }}>
                                        {studentMessage.text}
                                    </div>
                                )}
                                <p style={{ color: 'var(--gray-600)', fontSize: '14px', marginBottom: '16px' }}>
                                    Un matricule sera généré automatiquement. L’étudiant pourra se connecter avec ce matricule ou son email.
                                </p>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Nom</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={studentForm.nom}
                                            onChange={(ev) => setStudentForm({ ...studentForm, nom: ev.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Prénom</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={studentForm.prenom}
                                            onChange={(ev) => setStudentForm({ ...studentForm, prenom: ev.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        value={studentForm.email}
                                        onChange={(ev) => setStudentForm({ ...studentForm, email: ev.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Mot de passe</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        value={studentForm.password}
                                        onChange={(ev) => setStudentForm({ ...studentForm, password: ev.target.value })}
                                        placeholder="Minimum 6 caractères"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => { setShowStudentModal(false); resetStudentForm(); }}
                                >
                                    Annuler
                                </button>
                                <button type="submit" className="btn-primary" disabled={creatingStudent}>
                                    {creatingStudent ? 'Création…' : 'Créer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showSetupModal && (
                <FirstLoginSetupModal onClose={() => {
                    // mark locally as dismissed so it doesn't keep showing
                    const stored = JSON.parse(sessionStorage.getItem('user') || '{}');
                    stored.is_first_login = false;
                    sessionStorage.setItem('user', JSON.stringify(stored));
                    try { localStorage.setItem('user', JSON.stringify(stored)); } catch (e) {}
                    setShowSetupModal(false);
                }} />
            )}
        </div>
    );
};

export default AdminDashboard;
