<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>Sign In</h1>
        <p class="login-subtitle">Enter your credentials to access your account</p>
      </div>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username" class="form-label">Username</label>
          <input 
            type="text"
            id="username"
            v-model="username"
            required
            :disabled="isLoading"
            autocomplete="username"
            @input="clearError"
            class="form-input"
            placeholder="Enter your username"
          />
        </div>
        
        <div class="form-group">
          <label for="password" class="form-label">Password</label>
          <input 
            type="password"
            id="password"
            v-model="password"
            required
            :disabled="isLoading"
            autocomplete="current-password"
            @input="clearError"
            class="form-input"
            placeholder="Enter your password"
          />
        </div>
        
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
        
        <button 
          type="submit" 
          :disabled="isLoading || !username.trim() || !password.trim()"
          class="login-button"
        >
          <div v-if="isLoading" class="loading-spinner"></div>
          {{ isLoading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>
      
      <div class="login-footer">
        <p class="help-text">Need help? Contact your system administrator</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const username = ref('');
const password = ref('');
const error = ref(null);
const isLoading = ref(false);
const router = useRouter();
const authStore = useAuthStore();

const clearError = () => {
  if (error.value) {
    error.value = null;
  }
};

const handleLogin = async () => {
  if (isLoading.value || !username.value.trim() || !password.value.trim()) {
    return;
  }
  
  error.value = null;
  isLoading.value = true;
  
  try {
    await authStore.login(username.value.trim(), password.value);
    await router.push('/chat');
  } catch (err) {
    console.error('Login error:', err);
    error.value = err.message || 'Login failed. Please check your credentials.';
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  error.value = null;
  const usernameInput = document.getElementById('username');
  if (usernameInput) {
    usernameInput.focus();
  }
});
</script>

<style scoped>
/* Container */
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f8f9fa;
  padding: 1.5rem;
}

/* Login Card */
.login-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  width: 100%;
  max-width: 400px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

/* Header */
.login-header {
  padding: 2rem 2rem 1rem 2rem;
  text-align: center;
  border-bottom: 1px solid #f3f4f6;
  background-color: #fafafa;
}

.login-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.login-subtitle {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
  line-height: 1.4;
}

/* Form */
.login-form {
  padding: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  color: #374151;
  font-weight: 500;
  font-size: 0.875rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  transition: all 0.15s ease;
  background-color: white;
}

.form-input::placeholder {
  color: #9ca3af;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input:disabled {
  background-color: #f9fafb;
  cursor: not-allowed;
  opacity: 0.7;
}

/* Button */
.login-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  background-color: #3b82f6;
  color: white;
  border: 1px solid #3b82f6;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-top: 0.5rem;
}

.login-button:hover:not(:disabled) {
  background-color: #2563eb;
  border-color: #2563eb;
}

.login-button:disabled {
  background-color: #9ca3af;
  border-color: #9ca3af;
  cursor: not-allowed;
}

/* Loading Spinner */
.loading-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Error Message */
.error-message {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
  text-align: center;
}

/* Footer */
.login-footer {
  padding: 1rem 2rem 2rem 2rem;
  text-align: center;
  border-top: 1px solid #f3f4f6;
  background-color: #fafafa;
}

.help-text {
  color: #6b7280;
  font-size: 0.75rem;
  margin: 0;
}

/* Responsive Design */
@media (max-width: 480px) {
  .login-container {
    padding: 1rem;
  }
  
  .login-header {
    padding: 1.5rem 1.5rem 1rem 1.5rem;
  }
  
  .login-header h1 {
    font-size: 1.25rem;
  }
  
  .login-form {
    padding: 1.5rem;
  }
  
  .login-footer {
    padding: 1rem 1.5rem 1.5rem 1.5rem;
  }
}

/* Focus visible for accessibility */
.form-input:focus-visible,
.login-button:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .login-card {
    border-width: 2px;
  }
  
  .form-input {
    border-width: 2px;
  }
  
  .login-button {
    border-width: 2px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .form-input,
  .login-button {
    transition: none;
  }
  
  .loading-spinner {
    animation: none;
  }
}
</style>