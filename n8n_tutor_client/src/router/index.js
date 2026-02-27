import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import Login from '../views/Login.vue';
import MainLayout from '../views/MainLayout.vue';
import ChatView from '../views/ChatView.vue';
import AdminUserManagement from '../views/AdminUserManagement.vue';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresGuest: true },
  },
  {
    path: '/',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: 'chat',
        name: 'Chat',
        component: ChatView,
      },
      {
        path: 'admin/users',
        name: 'AdminUserManagement',
        component: AdminUserManagement,
        meta: { requiresAdmin: true },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  
  // Ensure auth is initialized before checking routes
  if (!authStore.isInitialized) {
    await authStore.initializeAuth();
  }
  
  const isAuthenticated = authStore.isAuthenticated;
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const requiresGuest = to.matched.some(record => record.meta.requiresGuest);
  const requiresAdmin = to.matched.some(record => record.meta.requiresAdmin);

  // Handle root path redirect based on auth status
  if (to.path === '/') {
    if (isAuthenticated) {
      return next('/chat');
    } else {
      return next('/login');
    }
  }

  if (requiresAuth && !isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } });
  } else if (requiresGuest && isAuthenticated) {
    next('/chat');
  } else if (requiresAdmin) {
    if (!authStore.isAdmin) {
      // Redirect non-admin users to chat
      next('/chat');
    } else {
      next();
    }
  } else {
    next();
  }
});

export default router;