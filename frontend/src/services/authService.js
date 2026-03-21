import api from './api';

const authService = {
  async login(username, password) {
    const response = await api.post('/auth/login/', { username, password });
    const { access, refresh, user } = response.data;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  },

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  },

  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated() {
    return !!localStorage.getItem('access_token');
  },

  async getProfile() {
    const response = await api.get('/auth/me/');
    return response.data;
  },

  async changePassword(oldPassword, newPassword) {
    return api.put('/auth/change-password/', {
      old_password: oldPassword,
      new_password: newPassword,
    });
  },
};

export default authService;
