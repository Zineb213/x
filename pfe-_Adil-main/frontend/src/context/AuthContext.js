import React, { createContext, useState, useEffect, useContext } from 'react';
import authService from '../services/authService';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false); // Added this

    useEffect(() => {
        const loadUser = async () => {
            try {
                const storedUser = authService.getUser();
                const hasToken = authService.isAuthenticated();
                
                if (storedUser && hasToken) {
                    setUser(storedUser);
                    setIsAuthenticated(true); // Set to true when user is authenticated
                } else {
                    setIsAuthenticated(false); // Set to false when not authenticated
                }
            } catch (error) {
                console.error('Error loading user:', error);
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('user');
                setIsAuthenticated(false);
            } finally {
                setLoading(false);
            }
        };
        loadUser();
    }, []);

    const login = async (matricule, password) => {
        try {
            const result = await authService.login(matricule, password);
            if (result.success) {
                setUser(result.user);
                setIsAuthenticated(true); // Set to true on successful login
            }
            return result;
        } catch (error) {
            return {
                success: false,
                error: error?.response?.data?.error || 'Erreur réseau. Vérifiez que le serveur backend est bien lancé.'
            };
        }
    };

    const googleLogin = async (credential) => {
        try {
            const result = await authService.googleLogin(credential);
            if (result.success) {
                setUser(result.user);
                setIsAuthenticated(true); // Set to true on successful Google login
            }
            return result;
        } catch (error) {
            return {
                success: false,
                error: error?.response?.data?.error || 'Erreur réseau pendant la connexion Google.'
            };
        }
    };

    const logout = () => {
        authService.logout();
        setUser(null);
        setIsAuthenticated(false); // Set to false on logout
    };

    const value = {
        user,
        loading,
        isAuthenticated, // Now properly maintained
        login,
        googleLogin,
        logout,
        isSuperAdmin: user?.role_global === 'SUPER_ADMIN',
        isAdmin: ['ADMIN', 'ADMIN_GLOBAL'].includes(user?.role_global),
        isFormateur: ['FORMATEUR', 'FORMATEUR_SIMPLE', 'MODERATEUR'].includes(user?.role_global),
        isEtudiant: user?.role_global === 'ETUDIANT'
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
