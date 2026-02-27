<template>
  <div class="admin-container">
    <div class="admin-content">
      <!-- Header Section -->
      <div class="header">
        <div class="header-title">
          <h1>User Management</h1>
          <p class="header-subtitle">Manage application users and permissions</p>
        </div>
        <div class="header-actions">
          <button @click="showCreateForm = true" class="btn btn-primary">
            <Plus class="w-4 h-4" />
            Add User
          </button>
          <button @click="showBulkCreateForm = true" class="btn btn-secondary">
            <Plus class="w-4 h-4" />
            Bulk Add
          </button>
          <button 
            v-if="selectedUsers.length > 0"
            @click="confirmBulkDelete"
            class="btn btn-danger"
            :disabled="deleting"
          >
            <X class="w-4 h-4" />
            Delete ({{ selectedUsers.length }})
          </button>
        </div>
      </div>

      <!-- Users Section -->
      <div class="users-section">
        <div class="section-header">
          <div class="section-title">
            <h2>Users</h2>
            <span class="user-count">{{ users.length }} total</span>
          </div>
          <div v-if="users.length > 0" class="select-all-container">
            <label class="checkbox-label">
              <input 
                type="checkbox"
                :checked="isAllSelected"
                :indeterminate="isIndeterminate"
                @change="toggleSelectAll"
                :disabled="deleting"
                class="checkbox-input"
              />
              <span class="checkbox-custom"></span>
              Select All
            </label>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
          <div class="loading-spinner"></div>
          <span class="text-sm text-gray-600">Loading users...</span>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="error-state">
          <span class="text-sm text-red-600">{{ error }}</span>
        </div>

        <!-- Users List -->
        <div v-else class="users-list">
          <div v-if="users.length === 0" class="empty-state">
            <div class="text-center py-8 text-gray-500">
              <div class="w-12 h-12 mx-auto mb-3 text-gray-300">👥</div>
              <p class="text-sm font-medium text-gray-900 mb-1">No users found</p>
              <p class="text-sm text-gray-500 mb-4">Get started by creating your first user</p>
              <button @click="showCreateForm = true" class="btn btn-primary">
                <Plus class="w-4 h-4" />
                Create First User
              </button>
            </div>
          </div>
          
          <div v-for="user in users" :key="user.id" class="user-card">
            <div class="user-selection">
              <label class="checkbox-label">
                <input 
                  type="checkbox"
                  :value="user.username"
                  v-model="selectedUsers"
                  :disabled="deleting || user.is_admin"
                  class="checkbox-input"
                />
                <span class="checkbox-custom" :class="{ disabled: user.is_admin }"></span>
              </label>
            </div>
            
            <div class="user-info">
              <div class="user-header">
                <h3 class="user-name">{{ user.username }}</h3>
                <span class="user-badge" :class="{ admin: user.is_admin }">
                  {{ user.is_admin ? 'Admin' : 'User' }}
                </span>
              </div>
              <div class="user-meta">
                <span class="user-detail">
                  <span class="meta-label">Created:</span>
                  {{ formatDate(user.created_at) }}
                </span>
                <span class="user-detail">
                  <span class="meta-label">Agent ID:</span>
                  {{ user.agent_id || 'N/A' }}
                </span>
              </div>
            </div>
            
            <div class="user-actions">
              <button 
                v-if="!user.is_admin"
                @click="confirmSingleDelete(user.username)"
                class="btn-icon btn-danger"
                :disabled="deleting"
                title="Delete user"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Create User Modal -->
      <div v-if="showCreateForm" class="modal-overlay" @click="closeModal">
        <div class="modal" @click.stop>
          <div class="modal-header">
            <h3>Create New User</h3>
            <button @click="closeModal" class="btn-icon btn-ghost">
              <X class="w-4 h-4" />
            </button>
          </div>
          
          <div class="modal-body">
            <form @submit.prevent="handleCreateUser" class="space-y-4">
              <div class="form-group">
                <label for="username" class="form-label">Username</label>
                <input 
                  type="text"
                  id="username"
                  v-model="newUser.username"
                  required
                  :disabled="creating"
                  placeholder="Enter username"
                  class="form-input"
                />
              </div>
              
              <div class="form-group">
                <label for="password" class="form-label">Password</label>
                <input 
                  type="password"
                  id="password"
                  v-model="newUser.password"
                  required
                  :disabled="creating"
                  placeholder="Enter password"
                  class="form-input"
                />
              </div>
              
              <div class="form-group">
                <label for="dataset_id" class="form-label">Dataset ID</label>
                <input 
                  type="text"
                  id="dataset_id"
                  v-model="newUser.dataset_id"
                  required
                  :disabled="creating"
                  placeholder="Enter RAGFlow dataset ID"
                  class="form-input"
                />
              </div>
              
              <div v-if="createError" class="error-message">
                {{ createError }}
              </div>
            </form>
          </div>
          
          <div class="modal-footer">
            <button type="button" @click="closeModal" :disabled="creating" class="btn btn-ghost">
              Cancel
            </button>
            <button 
              @click="handleCreateUser" 
              :disabled="creating || !isFormValid" 
              class="btn btn-primary"
            >
              <div v-if="creating" class="loading-spinner small"></div>
              {{ creating ? 'Creating...' : 'Create User' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Bulk Create Modal -->
      <div v-if="showBulkCreateForm" class="modal-overlay" @click="closeBulkModal">
        <div class="modal" @click.stop>
          <div class="modal-header">
            <h3>Bulk Create Users</h3>
            <button @click="closeBulkModal" class="btn-icon btn-ghost">
              <X class="w-4 h-4" />
            </button>
          </div>
          
          <div class="modal-body">
            <form @submit.prevent="handleBulkCreate" class="space-y-4">
              <div class="form-group">
                <label for="numUsers" class="form-label">Number of Users</label>
                <input 
                  type="number"
                  id="numUsers"
                  v-model.number="bulkCreateData.count"
                  required
                  min="1"
                  :disabled="bulkCreating"
                  placeholder="e.g., 10"
                  class="form-input"
                />
              </div>
              
              <div class="form-group">
                <label for="bulk_dataset_id" class="form-label">Dataset ID</label>
                <input 
                  type="text"
                  id="bulk_dataset_id"
                  v-model="bulkCreateData.dataset_id"
                  required
                  :disabled="bulkCreating"
                  placeholder="Enter RAGFlow dataset ID"
                  class="form-input"
                />
              </div>
              
              <div v-if="bulkCreating" class="progress-container">
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: bulkProgress + '%' }"></div>
                </div>
                <span class="progress-text">{{ bulkProgress }}%</span>
              </div>
              
              <div v-if="bulkCreateError" class="error-message">
                {{ bulkCreateError }}
              </div>
            </form>
          </div>
          
          <div class="modal-footer">
            <button type="button" @click="closeBulkModal" :disabled="bulkCreating" class="btn btn-ghost">
              Cancel
            </button>
            <button 
              @click="handleBulkCreate" 
              :disabled="bulkCreating || !isBulkFormValid" 
              class="btn btn-primary"
            >
              <div v-if="bulkCreating" class="loading-spinner small"></div>
              {{ bulkCreating ? 'Creating...' : 'Generate Users' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div v-if="showDeleteConfirm" class="modal-overlay" @click="cancelDelete">
        <div class="modal" @click.stop>
          <div class="modal-header">
            <h3>Confirm Deletion</h3>
            <button @click="cancelDelete" class="btn-icon btn-ghost">
              <X class="w-4 h-4" />
            </button>
          </div>
          
          <div class="modal-body">
            <div class="text-center py-4">
              <div class="text-4xl mb-4">⚠️</div>
              <div class="space-y-2">
                <p v-if="deleteTarget.type === 'single'" class="text-sm text-gray-900">
                  Are you sure you want to delete user <strong>{{ deleteTarget.username }}</strong>?
                </p>
                <p v-else class="text-sm text-gray-900">
                  Are you sure you want to delete <strong>{{ deleteTarget.usernames.length }} users</strong>?
                </p>
                <p class="text-xs text-red-600">This action cannot be undone. The user's agent will also be deleted from RAGFlow.</p>
              </div>
            </div>
            
            <div v-if="deleteError" class="error-message">
              {{ deleteError }}
            </div>
          </div>
          
          <div class="modal-footer">
            <button @click="cancelDelete" :disabled="deleting" class="btn btn-ghost">
              Cancel
            </button>
            <button @click="executeDelete" :disabled="deleting" class="btn btn-danger">
              <div v-if="deleting" class="loading-spinner small"></div>
              {{ deleting ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { Plus, X } from 'lucide-vue-next';
import { getAllUsers, createUser, bulkCreateUsers, deleteUser } from '../services/adminService';

const users = ref([]);
const loading = ref(true);
const error = ref(null);
const showCreateForm = ref(false);
const creating = ref(false);
const createError = ref(null);

// Bulk create state
const showBulkCreateForm = ref(false);
const bulkCreating = ref(false);
const bulkCreateError = ref(null);
const bulkProgress = ref(0);
const bulkCreateData = ref({
  count: null,
  dataset_id: ''
});

const newUser = ref({
  username: '',
  password: '',
  dataset_id: ''
});

// Delete state
const selectedUsers = ref([]);
const showDeleteConfirm = ref(false);
const deleting = ref(false);
const deleteError = ref(null);
const deleteTarget = ref({ type: 'single', username: '', usernames: [] });

const isFormValid = computed(() => {
  return newUser.value.username.trim() && 
         newUser.value.password.trim() && 
         newUser.value.dataset_id.trim();
});

const isBulkFormValid = computed(() => {
  return bulkCreateData.value.count > 0 && bulkCreateData.value.dataset_id.trim();
});

const isAllSelected = computed(() => {
  const selectableUsers = users.value.filter(u => !u.is_admin);
  return selectableUsers.length > 0 && selectedUsers.value.length === selectableUsers.length;
});

const isIndeterminate = computed(() => {
  const selectableUsers = users.value.filter(u => !u.is_admin);
  return selectedUsers.value.length > 0 && selectedUsers.value.length < selectableUsers.length;
});

const loadUsers = async () => {
  try {
    loading.value = true;
    error.value = null;
    users.value = await getAllUsers();
  } catch (err) {
    console.error('Error loading users:', err);
    error.value = err.message || 'Failed to load users';
  } finally {
    loading.value = false;
  }
};

const handleCreateUser = async () => {
  if (!isFormValid.value || creating.value) return;
  
  try {
    creating.value = true;
    createError.value = null;
    
    await createUser({
      username: newUser.value.username.trim(),
      password: newUser.value.password,
      dataset_id: newUser.value.dataset_id.trim()
    });
    
    newUser.value = { username: '', password: '', dataset_id: '' };
    showCreateForm.value = false;
    await loadUsers();
  } catch (err) {
    console.error('Error creating user:', err);
    createError.value = err.message || 'Failed to create user';
  } finally {
    creating.value = false;
  }
};

const generateRandomString = (length) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const downloadCSV = (data, filename) => {
  const csvContent = "data:text/csv;charset=utf-8," 
    + "username,password\n"
    + data.map(u => `${u.username},${u.password}`).join("\n");
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const handleBulkCreate = async () => {
  if (!isBulkFormValid.value || bulkCreating.value) return;

  try {
    bulkCreating.value = true;
    bulkCreateError.value = null;
    bulkProgress.value = 0;

    const { count, dataset_id } = bulkCreateData.value;
    const usersToCreate = [];

    for (let i = 0; i < count; i++) {
      usersToCreate.push({
        username: `user_${generateRandomString(8)}`,
        password: generateRandomString(12),
        dataset_id: dataset_id.trim()
      });
    }

    const createdUsers = [];
    const creationErrors = [];

    for (let i = 0; i < usersToCreate.length; i++) {
      try {
        await createUser(usersToCreate[i]);
        createdUsers.push(usersToCreate[i]);
      } catch (err) {
        creationErrors.push({ username: usersToCreate[i].username, error: err.message });
      }
      bulkProgress.value = Math.round(((i + 1) / count) * 100);
    }

    if (createdUsers.length > 0) {
      downloadCSV(createdUsers, `new_users_${new Date().toISOString().split('T')[0]}.csv`);
    }

    if (creationErrors.length > 0) {
      const errorMessages = creationErrors.map(e => `${e.username}: ${e.error}`).join('; ');
      bulkCreateError.value = `Some users could not be created. ${creationErrors.length} failed. Errors: ${errorMessages}`;
    } else {
      closeBulkModal();
    }

    await loadUsers();
  } catch (err) {
    console.error('Error in bulk create process:', err);
    bulkCreateError.value = err.message || 'An unexpected error occurred during bulk creation.';
  } finally {
    bulkCreating.value = false;
  }
};

const toggleSelectAll = () => {
  const selectableUsers = users.value.filter(u => !u.is_admin);
  if (isAllSelected.value) {
    selectedUsers.value = [];
  } else {
    selectedUsers.value = selectableUsers.map(u => u.username);
  }
};

const confirmSingleDelete = (username) => {
  deleteTarget.value = { type: 'single', username, usernames: [] };
  showDeleteConfirm.value = true;
  deleteError.value = null;
};

const confirmBulkDelete = () => {
  deleteTarget.value = { type: 'bulk', username: '', usernames: [...selectedUsers.value] };
  showDeleteConfirm.value = true;
  deleteError.value = null;
};

const cancelDelete = () => {
  if (!deleting.value) {
    showDeleteConfirm.value = false;
    deleteError.value = null;
    deleteTarget.value = { type: 'single', username: '', usernames: [] };
  }
};

const executeDelete = async () => {
  if (deleting.value) return;

  try {
    deleting.value = true;
    deleteError.value = null;

    if (deleteTarget.value.type === 'single') {
      await deleteUser(deleteTarget.value.username);
    } else {
      const errors = [];
      for (const username of deleteTarget.value.usernames) {
        try {
          await deleteUser(username);
        } catch (err) {
          errors.push(`${username}: ${err.message}`);
        }
      }
      
      if (errors.length > 0) {
        deleteError.value = `Some deletions failed: ${errors.join('; ')}`;
        await loadUsers();
        selectedUsers.value = [];
        return;
      }
    }

    showDeleteConfirm.value = false;
    selectedUsers.value = [];
    await loadUsers();
  } catch (err) {
    console.error('Error deleting user(s):', err);
    deleteError.value = err.response?.data?.detail || err.message || 'Failed to delete user(s)';
  } finally {
    deleting.value = false;
  }
};

const closeModal = () => {
  if (!creating.value) {
    showCreateForm.value = false;
    createError.value = null;
    newUser.value = { username: '', password: '', dataset_id: '' };
  }
};

const closeBulkModal = () => {
  if (!bulkCreating.value) {
    showBulkCreateForm.value = false;
    bulkCreateError.value = null;
    bulkCreateData.value = { count: null, dataset_id: '' };
    bulkProgress.value = 0;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown';
  return new Date(dateString).toLocaleDateString();
};

onMounted(() => {
  loadUsers();
});
</script>

<style scoped>
/* Base Layout */
.admin-container {
  min-height: 100vh;
  background-color: #f8f9fa;
  padding: 1.5rem;
}

.admin-content {
  max-width: 1200px;
  margin: 0 auto;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  gap: 1.5rem;
}

.header-title h1 {
  font-size: 1.875rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.25rem 0;
}

.header-subtitle {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  text-decoration: none;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
  border-color: #2563eb;
}

.btn-secondary {
  background-color: #f3f4f6;
  color: #374151;
  border-color: #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #e5e7eb;
  border-color: #9ca3af;
}

.btn-danger {
  background-color: #ef4444;
  color: white;
  border-color: #ef4444;
}

.btn-danger:hover:not(:disabled) {
  background-color: #dc2626;
  border-color: #dc2626;
}

.btn-ghost {
  background-color: transparent;
  color: #6b7280;
  border-color: #d1d5db;
}

.btn-ghost:hover:not(:disabled) {
  background-color: #f9fafb;
  color: #374151;
}

.btn-icon {
  padding: 0.5rem;
  border-radius: 0.375rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
}

/* Users Section */
.users-section {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #f3f4f6;
  background-color: #f9fafb;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.section-title h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.user-count {
  background-color: #e5e7eb;
  color: #374151;
  padding: 0.125rem 0.5rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
}

/* Checkbox Styles */
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: #374151;
}

.checkbox-input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
}

.checkbox-custom {
  width: 1rem;
  height: 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  position: relative;
  transition: all 0.15s ease;
}

.checkbox-input:checked + .checkbox-custom {
  background-color: #3b82f6;
  border-color: #3b82f6;
}

.checkbox-input:checked + .checkbox-custom::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 0.625rem;
  font-weight: bold;
}

.checkbox-custom.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Loading and Error States */
.loading-state, .error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 1.5rem;
}

.loading-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner.small {
  width: 0.875rem;
  height: 0.875rem;
  border-width: 1.5px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Users List */
.users-list {
  padding: 1.5rem;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #f3f4f6;
  border-radius: 0.5rem;
  margin-bottom: 0.75rem;
  transition: all 0.15s ease;
}

.user-card:hover {
  border-color: #e5e7eb;
  background-color: #fafafa;
}

.user-card:last-child {
  margin-bottom: 0;
}

.user-selection {
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.user-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.user-badge {
  padding: 0.125rem 0.5rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: #f3f4f6;
  color: #374151;
}

.user-badge.admin {
  background-color: #dcfce7;
  color: #166534;
}

.user-meta {
  display: flex;
  gap: 1rem;
}

.user-detail {
  font-size: 0.75rem;
  color: #6b7280;
}

.meta-label {
  font-weight: 500;
  color: #374151;
}

.user-actions {
  flex-shrink: 0;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1rem;
}

.modal {
  background: white;
  border-radius: 0.75rem;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #f3f4f6;
}

.modal-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.modal-body {
  padding: 1.5rem;
  max-height: 60vh;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid #f3f4f6;
  background-color: #f9fafb;
}

/* Form Styles */
.form-group {
  margin-bottom: 1rem;
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

/* Progress Bar */
.progress-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.progress-bar {
  flex: 1;
  background-color: #e5e7eb;
  border-radius: 0.5rem;
  height: 0.5rem;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #3b82f6;
  border-radius: 0.5rem;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.75rem;
  font-weight: 500;
  color: #374151;
  min-width: 2.5rem;
}

/* Error Message */
.error-message {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .admin-container {
    padding: 1rem;
  }
  
  .header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  
  .header-actions {
    justify-content: flex-start;
  }
  
  .section-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  
  .user-card {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
  
  .user-header {
    justify-content: space-between;
  }
  
  .user-meta {
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .modal {
    margin: 1rem;
    max-width: none;
  }
  
  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 1rem;
  }
}

@media (max-width: 480px) {
  .header-title h1 {
    font-size: 1.5rem;
  }
  
  .btn {
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
  }
  
  .user-meta {
    gap: 0.125rem;
  }
}
</style>