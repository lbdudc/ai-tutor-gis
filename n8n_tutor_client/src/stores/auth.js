import { defineStore } from 'pinia';
import axios from 'axios';
import { BACKEND_BASE_URL } from '../constants.js';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user')) || null,
    isInitialized: false,
    isAdmin: false,
  }),
  getters: {
    isAuthenticated: (state) => !!state.token && state.isInitialized,
  },
  actions: {
    async login(username, password) {
      try {
        const response = await axios.post(`${BACKEND_BASE_URL}/api/login`, { username, password });
        
        if (!response.data || !response.data.access_token) {
          throw new Error('Invalid response from server');
        }
        
        this.token = response.data.access_token;
        this.user = response.data.user || { username };
        localStorage.setItem('token', response.data.access_token);
        localStorage.setItem('user', JSON.stringify(this.user));
        
        // Set the default Authorization header for future requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
        
        // Fetch user profile to get admin status
        await this.fetchUserProfile();
        this.isInitialized = true;
        
        return { success: true };
      } catch (error) {
        // Clear any existing token on login failure
        this.token = null;
        this.user = null;
        this.isAdmin = false;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
        
        const errorMessage = error.response?.data?.message || 
                           error.response?.data?.error || 
                           error.message || 
                           'Login failed';
        throw new Error(errorMessage);
      }
    },
    logout() {
      this.token = null;
      this.user = null;
      this.isAdmin = false;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];
      this.isInitialized = true; // Set to true to avoid re-initialization loop
    },
    async initializeAuth() {
      if (this.token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
        // Test the token validity and fetch user profile
        const isValid = await this.validateToken();
        if (isValid) {
          await this.fetchUserProfile();
        }
      }
      this.isInitialized = true;
    },
    async validateToken() {
      if (!this.token) return false;
      
      try {
        // Use the /api/agent endpoint to validate the token
        const response = await axios.get(`${BACKEND_BASE_URL}/api/agent`);
        return true;
      } catch (error) {
        if (error.response && error.response.status === 401) {
          // Token is invalid, log out
          this.logout();
        }
        return false;
      }
    },
    async fetchUserProfile() {
      try {
        const response = await axios.get(`${BACKEND_BASE_URL}/api/user/profile`);
        this.isAdmin = response.data.is_admin || false;
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
        this.isAdmin = false;
      }
    }
  },
});