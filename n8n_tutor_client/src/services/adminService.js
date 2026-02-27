import axios from 'axios';
import { BACKEND_BASE_URL } from '../constants.js';
import { useAuthStore } from '../stores/auth.js';

// Create a new axios instance with auth header
const createAuthClient = () => {
  const token = localStorage.getItem('token');
  const client = axios.create({
    baseURL: BACKEND_BASE_URL,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  client.interceptors.response.use(
    response => response,
    error => {
      if (error.response && error.response.status === 401) {
        const authStore = useAuthStore();
        authStore.logout();
        // Optionally redirect to login
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );

  return client;
};

export const getAllUsers = async () => {
  try {
    const client = createAuthClient();
    const response = await client.get('/api/admin/users');
    return response.data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const createUser = async (userData) => {
  try {
    const client = createAuthClient();
    const response = await client.post('/api/admin/create-user', userData);
    return response.data;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const bulkCreateUsers = async (usersData) => {
  const client = createAuthClient();
  const results = {
    success: [],
    errors: []
  };

  for (const userData of usersData) {
    try {
      await client.post('/api/admin/create-user', userData);
      results.success.push(userData);
    } catch (error) {
      results.errors.push({ 
        username: userData.username, 
        error: error.response?.data?.message || error.message || 'Unknown error' 
      });
    }
  }
  return results;
};

export const deleteUser = async (username) => {
  try {
    const client = createAuthClient();
    const response = await client.delete(`/api/admin/users/${username}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};
