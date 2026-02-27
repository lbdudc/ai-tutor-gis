<template>
  <div class="min-h-screen bg-gray-50 flex flex-col">
    <AppHeader />
    <main class="flex-1 flex flex-col overflow-hidden">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import AppHeader from '../components/AppHeader.vue';
</script>
