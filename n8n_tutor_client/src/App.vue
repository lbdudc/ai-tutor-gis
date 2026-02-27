<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from './stores/auth';

const authStore = useAuthStore();

onMounted(async () => {
  await authStore.initializeAuth();
});
</script>

<style>
/* Global styles can remain here or be moved to a separate CSS file */
.prose { color: inherit; }
.prose :where(a):not(:where([class~="not-prose"] *)),
.prose :where(strong):not(:where([class~="not-prose"] *)),
.prose :where(code):not(:where([class~="not-prose"] *)) { color: inherit; }

/* Custom scrollbar styles */
.overflow-y-auto::-webkit-scrollbar,
.overflow-auto::-webkit-scrollbar { width: 6px; height: 6px; }
.overflow-y-auto::-webkit-scrollbar-track,
.overflow-auto::-webkit-scrollbar-track { background: #f1f1f1; }
.overflow-y-auto::-webkit-scrollbar-thumb,
.overflow-auto::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
.overflow-y-auto::-webkit-scrollbar-thumb:hover,
.overflow-auto::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
</style>