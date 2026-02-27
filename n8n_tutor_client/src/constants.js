// Debug logging to see what environment variables are loaded
console.log('Environment variables from import.meta.env:', {
  VITE_BACKEND_BASE_URL: import.meta.env.VITE_BACKEND_BASE_URL,
  VITE_N8N_WEBHOOK_URL: import.meta.env.VITE_N8N_WEBHOOK_URL,
  MODE: import.meta.env.MODE,
  DEV: import.meta.env.DEV,
  BASE_URL: import.meta.env.BASE_URL,
  PROD: import.meta.env.PROD
});

// Use hardcoded values as fallbacks only when environment variables are not available
const backendUrl = import.meta.env.VITE_BACKEND_BASE_URL;
const n8nWebhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;

export const BACKEND_BASE_URL = backendUrl || 'http://localhost:8000';
export const N8N_WEBHOOK_URL = n8nWebhookUrl || 'http://localhost:5680/webhook/b38b102d-7b8d-4178-a932-85ead6dd09a5';

// Additional debug logging
console.log('Constants resolved to:', {
  BACKEND_BASE_URL,
  N8N_WEBHOOK_URL
});