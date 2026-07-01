import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,           // 15 s — fail fast rather than hang indefinitely
  withCredentials: false,   // JWT in Authorization header, not cookie
});

// ─── Request interceptor — attach access token ───────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    try {
      const schoolSettings = JSON.parse(localStorage.getItem('schoolSettings') || '{}');
      const selectedEcoleId = schoolSettings.selectedEcoleId;
      if (selectedEcoleId && !config.params?.ecole) {
        config.params = { ...(config.params || {}), ecole: selectedEcoleId };
      }
    } catch {
      // ignore invalid localStorage state
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor — refresh on 401, queue concurrent requests ────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // No response — network error
    if (!error.response) {
      error.userMessage = 'Impossible de joindre le serveur. Vérifiez votre connexion.';
      return Promise.reject(error);
    }

    const { status } = error.response;

    // 401 — try token refresh once, queue concurrent requests
    if (status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        isRefreshing = false;
        _redirectToLogin();
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
          refresh: refreshToken,
        }, { timeout: 10000 });

        const { access } = res.data;
        localStorage.setItem('access_token', access);
        api.defaults.headers.common.Authorization = `Bearer ${access}`;
        processQueue(null, access);
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        _redirectToLogin();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Attach friendly user messages
    if (status === 429) {
      error.userMessage = 'Trop de requêtes. Veuillez patienter avant de réessayer.';
    } else if (status === 403) {
      error.userMessage = 'Accès non autorisé. Droits insuffisants.';
    } else if (status >= 500) {
      error.userMessage = 'Erreur serveur. Contactez l\'administrateur si le problème persiste.';
    }

    return Promise.reject(error);
  }
);

function _redirectToLogin() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

export default api;
