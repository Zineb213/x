import axios from 'axios';

const getApiUrl = () => {
    if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
    }

    if (typeof window !== 'undefined' && window.location?.hostname) {
        return `${window.location.protocol}//${window.location.hostname}:5000/api`;
    }

    return 'http://localhost:5000/api';
};

const API_URL = getApiUrl();

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
    },
});

// Request interceptor to add token
api.interceptors.request.use(
    (config) => {
        const token = sessionStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const url = error?.config?.url || '';
        const isLoginCall = url.includes('/auth/login');

        if (error.response?.status === 401 && !isLoginCall) {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
