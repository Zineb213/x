import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './FormateurPages.css';

const FormateurProfile = () => {
    const [user, setUser] = useState(null);
    const [formData, setFormData] = useState({
        nom: '',
        prenom: '',
        email: ''
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await api.get('/auth/me');
            if (response.data.success) {
                setUser(response.data.data);
                setFormData({
                    nom: response.data.data.nom || '',
                    prenom: response.data.data.prenom || '',
                    email: response.data.data.email || ''
                });
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const response = await api.put('/users/profile', {
                nom: formData.nom,
                prenom: formData.prenom
            });
            if (response.data.success) {
                setMessage({ type: 'success', text: 'Profil mis à jour avec succès' });
                fetchProfile();
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Erreur lors de la mise à jour' });
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas' });
            return;
        }
        if (passwordData.newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères' });
            return;
        }
        
        setSaving(true);
        try {
            const response = await api.post('/users/change-password', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });
            if (response.data.success) {
                setMessage({ type: 'success', text: 'Mot de passe modifié avec succès' });
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="loading-text">Chargement...</div>;

    return (
        <div className="formateur-page fade-in">
            <div className="page-header">
                <h1>Mon Profil</h1>
                <p>Gérez vos informations personnelles</p>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="profile-grid">
                {/* Profile Info */}
                <div className="profile-card">
                    <div className="profile-avatar">
                        <div className="avatar-placeholder">
                            {user?.prenom?.charAt(0)}{user?.nom?.charAt(0)}
                        </div>
                    </div>
                    <div className="profile-stats">
                        <div className="stat">
                            <span className="stat-label">Matricule</span>
                            <span className="stat-value">{user?.matricule}</span>
                        </div>
                        <div className="stat">
                            <span className="stat-label">Rôle</span>
                            <span className="stat-value">Formateur</span>
                        </div>
                    </div>
                </div>

                {/* Edit Profile Form */}
                <div className="profile-card">
                    <h3>Informations personnelles</h3>
                    <form onSubmit={handleUpdateProfile}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Nom</label>
                                <input
                                    type="text"
                                    value={formData.nom}
                                    onChange={(e) => setFormData({...formData, nom: e.target.value})}
                                    className="form-input"
                                />
                            </div>
                            <div className="form-group">
                                <label>Prénom</label>
                                <input
                                    type="text"
                                    value={formData.prenom}
                                    onChange={(e) => setFormData({...formData, prenom: e.target.value})}
                                    className="form-input"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Email</label>
                            <input type="email" value={formData.email} disabled className="form-input" />
                            <small>L'email ne peut pas être modifié</small>
                        </div>
                        <button type="submit" className="btn-primary" disabled={saving}>
                            {saving ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                    </form>
                </div>

                {/* Change Password Form */}
                <div className="profile-card">
                    <h3>Changer le mot de passe</h3>
                    <form onSubmit={handleChangePassword}>
                        <div className="form-group">
                            <label>Mot de passe actuel</label>
                            <input
                                type="password"
                                value={passwordData.currentPassword}
                                onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                                className="form-input"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Nouveau mot de passe</label>
                            <input
                                type="password"
                                value={passwordData.newPassword}
                                onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                                className="form-input"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Confirmer</label>
                            <input
                                type="password"
                                value={passwordData.confirmPassword}
                                onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                                className="form-input"
                                required
                            />
                        </div>
                        <button type="submit" className="btn-primary" disabled={saving}>
                            {saving ? 'Changement...' : 'Changer le mot de passe'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default FormateurProfile;
