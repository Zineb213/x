import api from './api';

const authService = {
    // Login with matricule/password
    login: async (matricule, password) => {
        const response = await api.post('/auth/login', { identifier: matricule, password });
        if (response.data.success) {
            const { token, user } = response.data.data;
            // store in sessionStorage for current-tab session; keep localStorage as fallback compatibility
            sessionStorage.setItem('token', token);
            sessionStorage.setItem('user', JSON.stringify(user));
            try {
                // keep compatibility with older clients that used localStorage
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(user));
            } catch (e) {
                // ignore if localStorage not available
            }
            return { success: true, user };
        }
        return { success: false, error: response.data.error };
    },

    // Google OAuth login
    googleLogin: async (credential) => {
        const response = await api.post('/auth/google', { token: credential });
        if (response.data.success) {
            const { token, user } = response.data.data;
            sessionStorage.setItem('token', token);
            sessionStorage.setItem('user', JSON.stringify(user));
            return { success: true, user };
        }
        return { success: false, error: response.data.error };
    },

    resolveSchoolCode: async (schoolCode) => {
        const response = await api.get('/auth/schools/resolve', {
            params: { code: schoolCode }
        });
        return response.data;
    },

    // Public student registration request (pending admin approval)
    studentRegister: async ({ email, nom, prenom, niveau, password, school_code }) => {
        const response = await api.post('/auth/student-register', {
            email,
            nom,
            prenom,
            niveau,
            password,
            school_code
        });
        return response.data;
    },

    // Get current user
    getCurrentUser: async () => {
        const response = await api.get('/auth/me');
        if (response.data.success) {
            return response.data.data;
        }
        return null;
    },

    // Forgot password
    forgotPassword: async (identifier) => {
        const response = await api.post('/auth/forgot-password', { identifier });
        return response.data;
    },

    // Reset password
    resetPassword: async (token, newPassword) => {
        const response = await api.post('/auth/reset-password', { token, new_password: newPassword });
        return response.data;
    },

    // Logout
    logout: () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch (e) {}
        window.location.href = '/login';
    },

    // Check if authenticated
    isAuthenticated: () => {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        return !!token;
    },

    // Get user from sessionStorage
    getUser: () => {
        const user = sessionStorage.getItem('user') || localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },

    // Get user role
    getUserRole: () => {
        const user = authService.getUser();
        return user?.role_global || null;
    }
};

export default authService;
