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

export const getAgentId = async () => {
  try {
    const client = createAuthClient();
    const response = await client.get('/api/agent');
    return response.data.agent_id;
  } catch (error) {
    console.error('Error fetching agent ID:', error);
    throw error;
  }
};

export const getSessionsForAgent = async (agentId) => {
  try {
    const client = createAuthClient();
    const response = await client.get(`/api/agents/${agentId}/sessions`);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching sessions:', error);
    throw error;
  }
};

export const getFullSession = async (agentId, sessionId) => {
  try {
    const client = createAuthClient();
    const response = await client.get(`/api/agents/${agentId}/sessions/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching session messages:', error);
    throw error;
  }
};

export const createNewSession = async (agentId, username) => {
  try {
    const client = createAuthClient();

    const response = await client.post(
      `/api/agents/${agentId}/sessions`,
      {
        user_id: username
      }
    );

    return response.data; // The created session info from the backend
  } catch (error) {
    console.error('Error creating new session:', error);
    throw error;
  }
};
