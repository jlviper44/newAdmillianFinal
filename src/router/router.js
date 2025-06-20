import { createRouter, createWebHistory } from 'vue-router';
import CommentBot from '@/views/CommentBot/CommentBot.vue';
import Profile from '@/views/Profile/Profile.vue';
import AuthCallback from '@/views/AuthCallback.vue';
import { useAuth } from '@/composables/useAuth';

const routes = [
  {
    path: '/',
    name: 'CommentBot',
    component: CommentBot,
    meta: {
      title: 'Comment Bot',
      requiresAuth: true,
      requiresAccess: true
    }
  },
  {
    path: '/comments',
    name: 'CommentBotAlias',
    component: CommentBot,
    meta: {
      title: 'Comment Bot',
      requiresAuth: true,
      requiresAccess: true
    }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: Profile,
    meta: {
      title: 'Profile',
      requiresAuth: true,
      requiresAccess: false
    }
  },
  // Auth callback route
  {
    path: '/auth/callback/:provider',
    name: 'AuthCallback',
    component: AuthCallback,
    meta: {
      title: 'Authenticating...',
      requiresAuth: false
    }
  },
  // Catch all route for unknown routes
  {
    path: '/:catchAll(.*)',
    name: 'NotFound',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Navigation guard for authentication
router.beforeEach(async (to, from, next) => {
  // Update document title
  document.title = to.meta.title || 'Comment Bot';
  
  // Skip auth check for auth callback routes
  if (to.path.startsWith('/api/auth')) {
    next();
    return;
  }
  
  // Check authentication requirements
  if (to.meta.requiresAuth) {
    const { isAuthenticated, hasCommentBotAccess, loading, initAuth } = useAuth();
    
    // Initialize auth if not already done
    if (loading.value) {
      await initAuth();
    }
    
    // If route requires access and user doesn't have it, redirect to profile
    if (to.meta.requiresAccess && !hasCommentBotAccess.value && isAuthenticated.value) {
      next('/profile');
      return;
    }
  }
  
  next();
});

export default router;