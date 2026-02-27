<template>
  <header class="bg-white border-b border-gray-100 px-6 py-3" style="height: 7vh;">
    <div class="flex items-center justify-between h-full">
      <div class="flex items-center space-x-3">
        <div class="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
          <BookOpen class="w-4 h-4 text-white" />
        </div>
        <h1 class="text-lg font-medium text-gray-900">{{ t('header.title') }}</h1>
      </div>

      <nav class="flex items-center space-x-4">
        <router-link to="/chat" class="text-sm font-medium text-gray-600 hover:text-blue-600">
          Chat
        </router-link>
        <router-link v-if="authStore.isAdmin" to="/admin/users" class="text-sm font-medium text-gray-600 hover:text-blue-600">
          User Management
        </router-link>
        <button @click="handleLogout" class="text-sm font-medium text-gray-600 hover:text-blue-600">
          Logout
        </button>
      </nav>
    </div>
  </header>
</template>

<script setup>
import { BookOpen } from 'lucide-vue-next';
import { useI18n } from '../composables/useI18n';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';

const { t } = useI18n();
const authStore = useAuthStore();
const router = useRouter();

const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};
</script>