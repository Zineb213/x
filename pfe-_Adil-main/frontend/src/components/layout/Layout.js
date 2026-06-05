import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

const Layout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
     const location = useLocation();

    const getNavItems = () => {
        const role = user?.role_global;
        if (role === 'SUPER_ADMIN') {
            return [
                { path: '/super-admin/schools', label: 'Ecoles & Admins', icon: '🏫' }
            ];
        }
        if (['ADMIN', 'ADMIN_GLOBAL'].includes(role)) {
            return [
                { path: '/admin', label: 'Dashboard', icon: '📊' },
                { path: '/admin/users', label: 'Utilisateurs', icon: '👥' },
                { path: '/admin/modules', label: 'Modules', icon: '📚' },
                { path: '/admin/formateurs', label: 'Formateurs', icon: '👨‍🏫' },
                { path: '/admin/assignments', label: 'Assignations', icon: '🔗' },
                { path: '/admin/enrollments', label: 'Inscriptions', icon: '📝' },
            ];
        }
        if (['FORMATEUR', 'FORMATEUR_SIMPLE', 'MODERATEUR'].includes(role)) {
            return [
                { path: '/formateur', label: 'Dashboard', icon: '📊' },
        { path: '/formateur/modules', label: 'Mes Modules', icon: '📚' },
        { path: '/formateur/resources', label: 'Mes Ressources', icon: '📄' },
        { path: '/formateur/upload', label: 'Upload', icon: '⬆️' },
        { path: '/formateur/students', label: 'Étudiants', icon: '👨‍🎓' },
        { path: '/formateur/chat', label: 'Chat', icon: '💬' },
        { path: '/formateur/profile', label: 'Profil', icon: '👤' },
            { path: '/formateur/live', label: 'Live', icon: '🔴' },
            ];
        }
        return [
            { path: '/etudiant', label: 'Accueil', icon: '🏠' },
            { path: '/etudiant/resources', label: 'Ressources', icon: '📚' },
            { path: '/etudiant/communities', label: 'Communauté', icon: '📝' },
            { path: '/etudiant/chat', label: 'Chat', icon: '💬' },
            { path: '/etudiant/bot', label: 'Assistant IA', icon: '🤖' },
            { path: '/etudiant/profile', label: 'Profil', icon: '👤' },
        ];
    };

    const navItems = getNavItems();

    return (
        <div className="layout">
            <nav className="navbar">
                <div className="navbar-brand" onClick={() => navigate('/')}>
                    <i className="fas fa-graduation-cap"></i>
                    <span>EduPlatform</span>
                </div>
                <div className="navbar-menu">
                    {navItems.map((item) => (
                        <button
                            key={item.path}
                            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                            onClick={() => navigate(item.path)}
                        >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
                <div className="navbar-user">
                    <div className="user-info">
                        <span>{user?.prenom} {user?.nom}</span>
                        <small>{user?.role_global}</small>
                    </div>
                    <button className="btn-logout" onClick={logout}>
                        <i className="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            </nav>
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
