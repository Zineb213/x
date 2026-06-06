import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './AdminPages.css';

const Users = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showResetModal, setShowResetModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [pendingRegistrations, setPendingRegistrations] = useState([]);
    const [processingRequestId, setProcessingRequestId] = useState(null);
    const [editFormData, setEditFormData] = useState({
        nom: '',
        prenom: '',
        email: ''
    });

    // Filtres
    const [filterPendingNiveau, setFilterPendingNiveau] = useState('');
    const [filterNiveau, setFilterNiveau] = useState('');
    const [filterRole, setFilterRole] = useState('');

    useEffect(() => {
        fetchUsers();

        // lightweight polling to keep pending registrations up-to-date
        const iv = setInterval(() => {
            fetchRegistrations();
        }, 10000);

        return () => clearInterval(iv);
    }, []);

    useEffect(() => {
        const flash = location.state?.flash;
        if (flash?.text) {
            setMessage({ type: flash.type || 'success', text: flash.text });
            navigate(location.pathname, { replace: true, state: {} });
            const t = setTimeout(() => setMessage({ type: '', text: '' }), 5000);
            return () => clearTimeout(t);
        }
    }, [location.state, location.pathname, navigate]);

    // Niveaux disponibles dérivés des données
    const pendingNiveaux = useMemo(() => {
        const s = new Set(pendingRegistrations.map(r => r.niveau).filter(Boolean));
        return [...s].sort();
    }, [pendingRegistrations]);

    const userNiveaux = useMemo(() => {
        const s = new Set(users.map(u => u.niveau).filter(Boolean));
        return [...s].sort();
    }, [users]);

    // Données filtrées
    const filteredPending = useMemo(() => {
        if (!filterPendingNiveau) return pendingRegistrations;
        return pendingRegistrations.filter(r => r.niveau === filterPendingNiveau);
    }, [pendingRegistrations, filterPendingNiveau]);

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            if (filterRole && u.role_global !== filterRole) return false;
            if (filterNiveau && u.niveau !== filterNiveau) return false;
            return true;
        });
    }, [users, filterRole, filterNiveau]);

    const fetchRegistrations = async () => {
        try {
            const res = await api.get('/admin/student-registrations?status=PENDING');
            if (res.data?.success) setPendingRegistrations(res.data.data);
        } catch (err) {
            console.error('Error fetching registrations', err);
        }
    };

    const fetchUsers = async () => {
        try {
            const usersResponse = await api.get('/admin/users/password-status');
            if (usersResponse.data.success) {
                setUsers(usersResponse.data.data);
            }

            // ensure registrations are fetched even if users call is slow/fails
            await fetchRegistrations();
        } catch (error) {
            console.error('Error fetching users:', error);
            setMessage({ type: 'error', text: 'Erreur lors du chargement des utilisateurs' });
        } finally {
            setLoading(false);
        }
    };

    const handleApproveRegistration = async (request) => {
        setProcessingRequestId(request.id);
        try {
            const response = await api.post(`/admin/student-registrations/${request.id}/approve`);
            if (response.data.success) {
                setMessage({
                    type: 'success',
                    text: `Inscription acceptee: ${request.nom} ${request.prenom}`
                });
                await fetchUsers();
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        } catch (error) {
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Erreur lors de la validation'
            });
        } finally {
            setProcessingRequestId(null);
        }
    };

    const handleRejectRegistration = async (request) => {
        const reason = window.prompt('Raison du refus (optionnel):', '') || '';
        setProcessingRequestId(request.id);
        try {
            const response = await api.post(`/admin/student-registrations/${request.id}/reject`, {
                reason
            });
            if (response.data.success) {
                setMessage({
                    type: 'success',
                    text: `Inscription refusee: ${request.nom} ${request.prenom}`
                });
                await fetchUsers();
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        } catch (error) {
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Erreur lors du refus'
            });
        } finally {
            setProcessingRequestId(null);
        }
    };

    const handleResetPassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères' });
            return;
        }

        try {
            const response = await api.post('/admin/users/reset-password', {
                userId: selectedUser.id,
                newPassword: newPassword
            });

            if (response.data.success) {
                setMessage({ type: 'success', text: `Mot de passe réinitialisé pour ${selectedUser.nom} ${selectedUser.prenom}` });
                setShowResetModal(false);
                setNewPassword('');
                fetchUsers();
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la réinitialisation' });
        }
    };

    const handleDeleteUser = async (userId, userName) => {
        if (window.confirm(`Êtes-vous sûr de vouloir désactiver l'utilisateur ${userName} ?`)) {
            try {
                await api.delete(`/admin/users/${userId}`);
                setMessage({ type: 'success', text: 'Utilisateur désactivé avec succès' });
                fetchUsers();
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            } catch (error) {
                setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la suppression' });
            }
        }
    };

    const handleEditUser = (user) => {
        setEditingUser(user);
        setEditFormData({
            nom: user.nom,
            prenom: user.prenom,
            email: user.email
        });
        setShowEditModal(true);
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        try {
            const endpoint = editingUser.role_global === 'FORMATEUR' 
                ? `/admin/formateurs/${editingUser.id}`
                : `/admin/students/${editingUser.id}`;
            
            const response = await api.put(endpoint, editFormData);
            if (response.data.success) {
                setMessage({ type: 'success', text: 'Utilisateur mis à jour avec succès' });
                setShowEditModal(false);
                fetchUsers();
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la mise à jour' });
        }
    };

    const getRoleBadgeClass = (role) => {
        switch(role) {
            case 'ADMIN': return 'badge-admin';
            case 'FORMATEUR': return 'badge-formateur';
            case 'ETUDIANT': return 'badge-etudiant';
            default: return 'badge-default';
        }
    };

    const getRoleLabel = (role) => {
        switch(role) {
            case 'ADMIN': return 'Administrateur';
            case 'FORMATEUR': return 'Formateur';
            case 'ETUDIANT': return 'Étudiant';
            default: return role;
        }
    };

    if (loading) {
        return <div className="loading-text">Chargement des utilisateurs...</div>;
    }

    return (
        <div className="admin-page fade-in">
            <div className="page-header">
                <h1>Gestion des Utilisateurs</h1>
                <p>Gérez tous les utilisateurs de la plateforme</p>
                <button type="button" className="btn-primary" style={{ marginLeft: 12 }} onClick={fetchUsers}>Rafraîchir</button>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="users-stats">
                <div className="stat-badge">
                    Inscriptions en attente: <strong>{pendingRegistrations.length}</strong>
                </div>
            </div>

            <div className="table-container">
                <h3 style={{ marginBottom: '1rem' }}>Demandes d'inscription etudiant</h3>
                {pendingNiveaux.length > 0 && (
                    <div className="filters-bar">
                        <label>Filtrer par niveau :</label>
                        <select
                            className="filter-select"
                            value={filterPendingNiveau}
                            onChange={e => setFilterPendingNiveau(e.target.value)}
                        >
                            <option value="">Tous les niveaux</option>
                            {pendingNiveaux.map(n => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
                    </div>
                )}
                {filteredPending.length === 0 ? (
                    <p style={{ padding: '16px' }}>Aucune demande{filterPendingNiveau ? ` pour le niveau ${filterPendingNiveau}` : ' en attente'}.</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Nom complet</th>
                                <th>Email</th>
                                <th>Niveau</th>
                                <th>Date demande</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPending.map((request) => (
                                <tr key={request.id}>
                                    <td><strong>{request.nom} {request.prenom}</strong></td>
                                    <td>{request.email}</td>
                                    <td>{request.niveau}</td>
                                    <td>{new Date(request.requested_at).toLocaleString()}</td>
                                    <td className="actions-cell">
                                        <button
                                            className="btn-icon"
                                            disabled={processingRequestId === request.id}
                                            onClick={() => handleApproveRegistration(request)}
                                            title="Accepter inscription"
                                        >
                                            ✅
                                        </button>
                                        <button
                                            className="btn-icon btn-danger"
                                            disabled={processingRequestId === request.id}
                                            onClick={() => handleRejectRegistration(request)}
                                            title="Refuser inscription"
                                        >
                                            ❌
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="users-stats">
                <div className="stat-badge">
                    Total: <strong>{users.length}</strong> utilisateurs
                </div>
                <div className="stat-badge">
                    Admins: <strong>{users.filter(u => u.role_global === 'ADMIN').length}</strong>
                </div>
                <div className="stat-badge">
                    Formateurs: <strong>{users.filter(u => u.role_global === 'FORMATEUR').length}</strong>
                </div>
                <div className="stat-badge">
                    Étudiants: <strong>{users.filter(u => u.role_global === 'ETUDIANT').length}</strong>
                </div>
            </div>

            <div className="table-container">
                <div className="filters-bar">
                    <label>Rôle :</label>
                    <select
                        className="filter-select"
                        value={filterRole}
                        onChange={e => { setFilterRole(e.target.value); setFilterNiveau(''); }}
                    >
                        <option value="">Tous les rôles</option>
                        <option value="ADMIN">Administrateur</option>
                        <option value="FORMATEUR">Formateur</option>
                        <option value="ETUDIANT">Étudiant</option>
                    </select>
                    {userNiveaux.length > 0 && (
                        <>
                            <label>Niveau :</label>
                            <select
                                className="filter-select"
                                value={filterNiveau}
                                onChange={e => setFilterNiveau(e.target.value)}
                            >
                                <option value="">Tous les niveaux</option>
                                {userNiveaux.map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </>
                    )}
                    {(filterRole || filterNiveau) && (
                        <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: 13 }}
                            onClick={() => { setFilterRole(''); setFilterNiveau(''); }}
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
                            <th>Rôle</th>
                            <th>Niveau</th>
                            <th>Mot de passe</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: 24 }}>
                                    Aucun utilisateur pour ces filtres.
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map((user) => (
                                <tr key={user.id}>
                                    <td><code>{user.matricule || '-'}</code></td>
                                    <td><strong>{user.nom} {user.prenom}</strong></td>
                                    <td>{user.email}</td>
                                    <td>
                                        <span className={`badge ${getRoleBadgeClass(user.role_global)}`}>
                                            {getRoleLabel(user.role_global)}
                                        </span>
                                    </td>
                                    <td>{user.niveau || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                                    <td>
                                        <span className={`password-status ${user.password_status === 'Yes' ? 'has-password' : 'no-password'}`}>
                                            {user.password_status === 'Yes' ? '✅ Défini' : user.password_status === 'Google OAuth' ? '🔐 Google' : '❌ Non défini'}
                                        </span>
                                    </td>
                                    <td className="actions-cell">
                                        <button 
                                            className="btn-icon"
                                            onClick={() => {
                                                setSelectedUser(user);
                                                setShowResetModal(true);
                                            }}
                                            title="Réinitialiser le mot de passe"
                                        >
                                            🔑
                                        </button>
                                        <button 
                                            className="btn-icon"
                                            onClick={() => handleEditUser(user)}
                                            title="Modifier l'utilisateur"
                                        >
                                            ✏️
                                        </button>
                                        <button 
                                            className="btn-icon btn-danger"
                                            onClick={() => handleDeleteUser(user.id, `${user.nom} ${user.prenom}`)}
                                            title="Désactiver l'utilisateur"
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

            {/* Reset Password Modal */}
            {showResetModal && selectedUser && (
                <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Réinitialiser le mot de passe</h3>
                            <button className="modal-close" onClick={() => setShowResetModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <p>Utilisateur: <strong>{selectedUser.nom} {selectedUser.prenom}</strong></p>
                            <p>Email: {selectedUser.email}</p>
                            <div className="form-group">
                                <label>Nouveau mot de passe</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Minimum 6 caractères"
                                    className="form-input"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowResetModal(false)}>Annuler</button>
                            <button className="btn-primary" onClick={handleResetPassword}>Réinitialiser</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && editingUser && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Modifier {editingUser.role_global === 'FORMATEUR' ? 'le formateur' : "l'étudiant"}</h3>
                            <button className="modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleUpdateUser}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Nom</label>
                                        <input
                                            type="text"
                                            value={editFormData.nom}
                                            onChange={(e) => setEditFormData({...editFormData, nom: e.target.value})}
                                            className="form-input"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Prénom</label>
                                        <input
                                            type="text"
                                            value={editFormData.prenom}
                                            onChange={(e) => setEditFormData({...editFormData, prenom: e.target.value})}
                                            className="form-input"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        value={editFormData.email}
                                        onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                                        className="form-input"
                                        required
                                    />
                                </div>
                                {editingUser.role_global === 'FORMATEUR' && (
                                    <div className="form-group">
                                        <label>Matricule (non modifiable)</label>
                                        <input
                                            type="text"
                                            value={editingUser.matricule || '-'}
                                            disabled
                                            className="form-input"
                                        />
                                    </div>
                                )}
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

export default Users;