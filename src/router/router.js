import { createRouter, createWebHistory } from 'vue-router';
import CommentBot from '@/views/CommentBot/CommentBot.vue';
import BCGen from '@/views/BCGen/BCGen.vue';
import Profile from '@/views/Profile/Profile.vue';
import Settings from '@/views/Settings/Settings.vue';
import Dashboard from '@/views/Dashboard/Dashboard.vue';
import VirtualAssistants from '@/views/VirtualAssistants/VirtualAssistants.vue';
import AuthCallback from '@/views/AuthCallback.vue';
import { useAuth } from '@/composables/useAuth';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Profile,
    meta: {
      title: 'Profile',
      requiresAuth: true,
      requiresAccess: false
    }
  },
  {
    path: '/comments',
    name: 'CommentBot',
    component: CommentBot,
    meta: {
      title: 'Comment Bot',
      requiresAuth: true,
      requiresAccess: true,
      requiresSubscription: 'comment_bot'
    }
  },
  {
    path: '/bc-gen',
    name: 'BCGen',
    component: BCGen,
    meta: {
      title: 'BC Gen',
      requiresAuth: true,
      requiresAccess: true,
      requiresSubscription: 'bc_gen'
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
  {
    path: '/settings',
    name: 'Settings',
    component: Settings,
    meta: {
      title: 'Settings',
      requiresAuth: true,
      requiresAccess: false
    }
  },
  {
    path: '/virtual-assistants',
    name: 'VirtualAssistants',
    component: VirtualAssistants,
    meta: {
      title: 'Virtual Assistants',
      requiresAuth: true,
      requiresAccess: true,
      requiresSubscription: 'any'
    }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: {
      title: 'Dashboard',
      requiresAuth: true,
      requiresAccess: true,
      requiresSubscription: 'dashboard'
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
    const { isAuthenticated, hasCommentBotAccess, hasBcGenAccess, hasDashboardAccess, loading, initAuth, showAuthModal } = useAuth();
    
    // Initialize auth if not already done
    if (loading.value) {
      await initAuth();
    }
    
    // Check if user is authenticated
    if (!isAuthenticated.value) {
      // If we're already on the home page, just show the auth modal
      if (to.path === '/') {
        showAuthModal.value = true;
        next();
        return;
      }
      // Otherwise redirect to home and show auth modal
      showAuthModal.value = true;
      next('/');
      return;
    }
    
    // Check subscription-specific requirements
    if (to.meta.requiresSubscription) {
      let hasRequiredAccess = false;
      
      if (to.meta.requiresSubscription === 'comment_bot') {
        hasRequiredAccess = hasCommentBotAccess.value;
      } else if (to.meta.requiresSubscription === 'bc_gen') {
        hasRequiredAccess = hasBcGenAccess.value;
      } else if (to.meta.requiresSubscription === 'dashboard') {
        hasRequiredAccess = hasDashboardAccess.value;
      } else if (to.meta.requiresSubscription === 'any') {
        // Allow access if user has any subscription
        hasRequiredAccess = hasCommentBotAccess.value || hasBcGenAccess.value || hasDashboardAccess.value;
      }
      
      if (!hasRequiredAccess) {
        next('/');
        return;
      }
    }
  }
  
  next();
});

export default router;