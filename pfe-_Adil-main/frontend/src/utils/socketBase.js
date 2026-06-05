/** Socket.IO origin (no /api suffix). Matches HTTP API host when possible. */
export function getSocketBaseUrl() {
    if (process.env.REACT_APP_SOCKET_URL) {
        return process.env.REACT_APP_SOCKET_URL.replace(/\/$/, '');
    }
    const api = process.env.REACT_APP_API_URL || '';
    if (api) {
        return api.replace(/\/api\/?$/, '').replace(/\/$/, '');
    }

    if (typeof window !== 'undefined' && window.location?.hostname) {
        return `${window.location.protocol}//${window.location.hostname}:5000`;
    }

    return 'http://localhost:5000';
}
