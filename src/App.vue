<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useTheme } from 'vuetify';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { usersApi } from '@/services/api';
import UserMenu from '@/components/UserMenu.vue';

const router = useRouter();
const route = useRoute();
const theme = useTheme();
const isDarkMode = ref(false);
const scrollY = ref(0);

// Mobile navigation state
const mobileMenuOpen = ref(false);
const mobileActiveTab = ref('dashboard');
const activePopupMenu = ref(null);

// Authentication
const { initAuth, isAuthenticated, hasCommentBotAccess, hasBcGenAccess, hasDashboardAccess, user, signOut, isAssistingUser, getTargetUserId } = useAuth();

// Computed property for admin status (excludes virtual assistants)
const isAdmin = computed(() => {
  const isAdminUser = user.value?.isAdmin === true;
  const isVA = user.value?.isVirtualAssistant === true;
  return isAdminUser && !isVA;
});

// Dashboard tab permissions for Virtual Assistants
const canViewMetrics = computed(() => {
  if (!user.value?.isVirtualAssistant) return true;
  return user.value?.vaPermissions?.dashboardMetrics === true;
});

const canViewCampaigns = computed(() => {
  if (!user.value?.isVirtualAssistant) return true;
  return user.value?.vaPermissions?.dashboardCampaigns === true;
});

const canViewSparks = computed(() => {
  if (!user.value?.isVirtualAssistant) return true;
  return user.value?.vaPermissions?.dashboardSparks === true;
});

const canViewTemplates = computed(() => {
  if (!user.value?.isVirtualAssistant) return true;
  return user.value?.vaPermissions?.dashboardTemplates === true;
});

const canViewShopify = computed(() => {
  if (!user.value?.isVirtualAssistant) return true;
  return user.value?.vaPermissions?.dashboardShopify === true;
});

const canViewLogs = computed(() => {
  if (!user.value?.isVirtualAssistant) return true;
  return user.value?.vaPermissions?.dashboardLogs === true;
});

const canViewLinkSplitter = computed(() => {
  if (!user.value?.isVirtualAssistant) return true;
  return user.value?.vaPermissions?.dashboardLinkSplitter === true;
});

// Check if we should show navigation (hide on LinkRedirect page)
const shouldShowNavigation = computed(() => {
  return isAuthenticated.value && route.name !== 'LinkRedirect';
});


// All routes
const allRoutes = [
  { 
    title: 'Dashboard', 
    icon: 'mdi-view-dashboard', 
    path: '/dashboard',
    requiresSubscription: 'dashboard'
  },
  { 
    title: 'Link Splitter', 
    icon: 'mdi-link-variant', 
    path: '/link-splitter',
    requiresSubscription: 'dashboard'
  },
  { 
    title: 'Comment Bot', 
    icon: 'mdi-comment-multiple', 
    path: '/comments',
    requiresSubscription: 'comment_bot'
  },
  { 
    title: 'BC Gen', 
    icon: 'mdi-account-multiple-plus', 
    path: '/bc-gen',
    requiresSubscription: 'bc_gen'
  },
  { 
    title: 'Profile', 
    icon: 'mdi-account', 
    path: '/profile',
    requiresSubscription: null,
    hideForVirtualAssistant: true
  },
  { 
    title: 'Settings', 
    icon: 'mdi-cog', 
    path: '/settings',
    requiresAdmin: true // Only show for admin users
  },
];

// Filtered routes based on user access
const visibleRoutes = computed(() => {
  if (!isAuthenticated.value) return [];
  
  
  return allRoutes.filter(route => {
    // Hide routes marked as hideForVirtualAssistant
    if (route.hideForVirtualAssistant && user.value?.isVirtualAssistant) return false;
    
    // Check if route requires admin access (excluding virtual assistants)
    if (route.requiresAdmin && !isAdmin.value) return false;
    
    // Always show routes without subscription requirements (unless they require admin or are hidden for VA)
    if (!route.requiresSubscription) return true;
    
    // Check specific subscription requirements
    if (route.requiresSubscription === 'comment_bot') return hasCommentBotAccess.value;
    if (route.requiresSubscription === 'bc_gen') return hasBcGenAccess.value;
    if (route.requiresSubscription === 'dashboard') return hasDashboardAccess.value;
    if (route.requiresSubscription === 'any') {
      // Show if user has any subscription or is admin
      return hasCommentBotAccess.value || hasBcGenAccess.value || hasDashboardAccess.value || user.value?.isAdmin;
    }
    
    return false;
  });
});

// Function to toggle dark mode
const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value;
  theme.global.name.value = isDarkMode.value ? 'dark' : 'light';
  
  // Dispatch theme change event for the rest of the app
  window.dispatchEvent(new CustomEvent('themeChange', {
    detail: { darkMode: isDarkMode.value }
  }));
  
  // Save preference to localStorage
  localStorage.setItem('darkMode', isDarkMode.value ? 'true' : 'false');
};

// Navigation drawer state
const drawer = ref(true);
const toggleDrawer = () => {
  drawer.value = !drawer.value;
};

// Stop assisting
const stopAssisting = async () => {
  try {
    const response = await usersApi.endVirtualAssistantMode()
    
    // Reload the page to refresh all data with the normal session context
    window.location.reload()
  } catch (error) {
    console.error('Failed to exit virtual assistant mode:', error)
    alert('Failed to exit virtual assistant mode. Please try again.')
  }
};

// List group opened state
const opened = ref([]);

// Active route for highlighting current page using Vue Router
const activeRoute = computed(() => {
  return router.currentRoute.value.path;
});

// Update opened groups based on current route
const updateOpenedGroups = () => {
  const path = router.currentRoute.value.path;
  const newOpened = [];
  
  if (path.includes('/dashboard') || path.includes('/link-splitter')) {
    newOpened.push('dashboard');
  }
  if (path.includes('/comments')) {
    newOpened.push('comments');
  }
  if (path.includes('/bc-gen')) {
    newOpened.push('bcgen');
  }
  if (path.includes('/virtual-assistants')) {
    newOpened.push('virtual-assistants');
  }
  if (path.includes('/settings')) {
    newOpened.push('settings');
  }
  
  opened.value = newOpened;
};

// Check if a tab is currently active
const isTabActive = (path, tab) => {
  const currentRoute = router.currentRoute.value;
  const isActive = currentRoute.path === path && currentRoute.query.tab === tab;
  return isActive;
};

// Mobile navigation methods
const navigateTo = (path) => {
  router.push(path);
};

const navigateAndClose = (path) => {
  router.push(path);
  mobileMenuOpen.value = false;
};

const togglePopupMenu = (menu) => {
  if (activePopupMenu.value === menu) {
    activePopupMenu.value = null;
  } else {
    activePopupMenu.value = menu;
  }
};

const handleDashboardClick = () => {
  const currentPath = router.currentRoute.value.path;
  if (currentPath === '/dashboard') {
    // If already on dashboard, toggle popup menu
    togglePopupMenu('dashboard');
  } else {
    // If not on dashboard, navigate to default dashboard tab
    // Virtual assistants go to campaigns instead of metrics
    const defaultTab = user.value?.isVirtualAssistant ? 'campaigns' : 'metrics';
    router.push(`/dashboard?tab=${defaultTab}`);
  }
};

const handleSettingsClick = () => {
  const currentPath = router.currentRoute.value.path;
  if (currentPath === '/settings') {
    // If already on settings, toggle popup menu
    togglePopupMenu('settings');
  } else {
    // If not on settings, navigate to default settings tab
    // Check if user has any subscription and is not assisting
    const hasAnySubscription = hasCommentBotAccess.value || hasBcGenAccess.value || hasDashboardAccess.value;
    const defaultTab = (hasAnySubscription && !isAssistingUser.value) ? 'virtual-assistants' : 'teams';
    router.push(`/settings?tab=${defaultTab}`);
  }
};

const navigateToAndClose = (path) => {
  router.push(path);
  activePopupMenu.value = null;
};

const handleLogout = async () => {
  // Close the mobile menu
  mobileMenuOpen.value = false;
  activePopupMenu.value = null;
  
  try {
    await signOut();
    // Navigate to home page after logout
    router.push('/');
  } catch (error) {
    console.error('Logout error:', error);
  }
};

const getCurrentPageTitle = () => {
  const route = router.currentRoute.value;
  const path = route.path;
  const tab = route.query.tab;
  
  if (path === '/dashboard') {
    return 'Dashboard';
  }
  
  if (path === '/link-splitter') return 'Link Splitter';
  if (path === '/comments') return 'Comment Bot';
  if (path === '/bc-gen') return 'BC Gen';
  if (path === '/virtual-assistants') return 'Virtual Assistants';
  if (path === '/profile') return 'Profile';
  if (path === '/settings') return 'Settings';
  
  return 'MILLIAN AI';
};

// Update mobile active tab based on route
const updateMobileActiveTab = () => {
  const path = router.currentRoute.value.path;
  if (path.includes('/dashboard') || path.includes('/link-splitter')) mobileActiveTab.value = 'dashboard';
  else if (path.includes('/comments')) mobileActiveTab.value = 'comments';
  else if (path.includes('/bc-gen')) mobileActiveTab.value = 'bcgen';
  else if (path.includes('/profile')) mobileActiveTab.value = 'profile';
  else if (path.includes('/settings')) mobileActiveTab.value = 'settings';
  
  // Close popup menu when route changes
  activePopupMenu.value = null;
};

// Handle scroll for parallax effect
const handleScroll = () => {
  scrollY.value = window.scrollY;
};

// Watch route changes to update mobile active tab and opened groups
router.afterEach(() => {
  updateMobileActiveTab();
  updateOpenedGroups();
});

// Initialize theme on component mount
onMounted(async () => {
  // Initialize authentication
  await initAuth();
  
  // Get theme from localStorage or default to system preference
  const storedTheme = localStorage.getItem('darkMode');
  if (storedTheme !== null) {
    isDarkMode.value = storedTheme === 'true';
  } else {
    isDarkMode.value = window.matchMedia && 
      window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  
  // Apply initial theme
  theme.global.name.value = isDarkMode.value ? 'dark' : 'light';
  
  // Add scroll listener for parallax effect
  window.addEventListener('scroll', handleScroll);
  
  // Update mobile active tab and opened groups
  updateMobileActiveTab();
  updateOpenedGroups();
});

// Clean up scroll listener
onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<template>
  <v-app>
    <!-- Mobile App Bar - Simplified and Clean -->
    <v-app-bar
      v-if="shouldShowNavigation && $vuetify.display.smAndDown"
      elevation="0"
      :height="56"
      class="mobile-app-bar"
      :style="{
        background: isDarkMode ? '#1a1a2e' : '#ffffff',
        borderBottom: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)'
      }"
    >
      <v-app-bar-title class="mobile-title">
        <v-icon size="24" :color="isDarkMode ? 'primary' : 'primary'">mdi-robot-excited</v-icon>
        <span class="ml-2">{{ getCurrentPageTitle() }}</span>
      </v-app-bar-title>
      
      <v-spacer></v-spacer>
      
      <v-btn icon variant="text" @click="mobileMenuOpen = true">
        <v-icon>mdi-dots-vertical</v-icon>
      </v-btn>
    </v-app-bar>

    <!-- Desktop App Bar - Keep existing futuristic design -->
    <v-app-bar
      v-if="shouldShowNavigation && $vuetify.display.mdAndUp"
      elevation="0"
      height="70"
      class="futuristic-app-bar header-entrance"
      :style="{
        background: isDarkMode 
          ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 33%, #0f3460 66%, #533483 100%)' 
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%)',
        backdropFilter: 'blur(10px)',
        borderBottom: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: isDarkMode ? '0 4px 30px rgba(83, 52, 131, 0.3)' : '0 4px 30px rgba(0, 0, 0, 0.1)'
      }"
    >
      <!-- Background Pattern -->
      <div class="app-bar-pattern"></div>
      
      <!-- Floating Particles Animation -->
      <div class="particles-container" :style="{ transform: `translateY(${scrollY * 0.3}px)` }">
        <div v-for="i in 15" :key="`particle-${i}`" :class="`particle particle-${i}`"></div>
      </div>
      
      <!-- Animated Border Gradient -->
      <div class="animated-border"></div>
      
      <!-- Glowing Orbs Background -->
      <div class="orb-container">
        <div class="orb orb-1" :style="{ transform: `translateY(${scrollY * 0.5}px)` }"></div>
        <div class="orb orb-2" :style="{ transform: `translateY(${scrollY * 0.3}px)` }"></div>
        <div class="orb orb-3" :style="{ transform: `translateY(${scrollY * 0.4}px)` }"></div>
      </div>
      
      <!-- Menu toggle for responsive design -->
      <v-app-bar-nav-icon 
        @click="toggleDrawer"
        :color="isDarkMode ? 'grey-lighten-2' : 'white'"
        style="z-index: 2;"
      ></v-app-bar-nav-icon>
      
      <v-app-bar-title 
        class="font-weight-bold app-bar-title" 
        :class="isDarkMode ? 'text-grey-lighten-2' : 'text-white'"
        :style="{ transform: `translateX(${scrollY * -0.2}px)` }"
      >
        <v-icon 
          size="30" 
          class="mr-2"
          :color="isDarkMode ? 'grey-lighten-2' : 'white'"
          style="opacity: 0.9;"
        >
          mdi-robot-excited
        </v-icon>
        <span style="letter-spacing: 1px; font-size: 1.3rem;">MILLIAN AI</span>
      </v-app-bar-title>
      
      <v-spacer></v-spacer>
      
      <!-- User Menu -->
      <UserMenu />
      
      <!-- Dark Mode Toggle with futuristic style -->
      <v-btn 
        icon 
        @click="toggleDarkMode" 
        class="mx-1"
        variant="text"
        style="z-index: 2;"
      >
        <v-icon 
          :color="isDarkMode ? 'amber' : 'white'"
          size="24"
        >
          {{ isDarkMode ? 'mdi-weather-sunny' : 'mdi-weather-night' }}
        </v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ isDarkMode ? 'Light Mode' : 'Dark Mode' }}
        </v-tooltip>
      </v-btn>
    </v-app-bar>

    <!-- Mobile Bottom Navigation -->
    <v-bottom-navigation
      v-if="shouldShowNavigation && $vuetify.display.smAndDown"
      v-model="mobileActiveTab"
      :bg-color="isDarkMode ? '#1a1a2e' : '#ffffff'"
      grow
      class="mobile-bottom-nav"
    >
      <v-btn 
        v-if="hasDashboardAccess" 
        value="dashboard" 
        @click="handleDashboardClick()"
        :class="{ 'v-btn--active': activePopupMenu === 'dashboard' || mobileActiveTab === 'dashboard' }"
      >
        <v-icon>mdi-view-dashboard</v-icon>
        <span class="text-caption">Dashboard</span>
      </v-btn>
      
      <v-btn 
        v-if="hasCommentBotAccess" 
        value="comments" 
        @click="togglePopupMenu('comments')"
        :class="{ 'v-btn--active': activePopupMenu === 'comments' }"
      >
        <v-icon>mdi-comment-multiple</v-icon>
        <span class="text-caption">Comments</span>
      </v-btn>
      
      <v-btn 
        v-if="hasBcGenAccess" 
        value="bcgen" 
        @click="togglePopupMenu('bcgen')"
        :class="{ 'v-btn--active': activePopupMenu === 'bcgen' }"
      >
        <v-icon>mdi-account-multiple-plus</v-icon>
        <span class="text-caption">BC Gen</span>
      </v-btn>
      
      <v-btn value="profile" @click="togglePopupMenu('more')" :class="{ 'v-btn--active': activePopupMenu === 'more' }">
        <v-icon>mdi-dots-horizontal</v-icon>
        <span class="text-caption">More</span>
      </v-btn>
    </v-bottom-navigation>

    <!-- Mobile Popup Menus -->
    <v-slide-y-reverse-transition>
      <div 
        v-if="activePopupMenu && $vuetify.display.smAndDown"
        class="mobile-popup-container"
      >
        <!-- Backdrop -->
        <div 
          class="mobile-popup-backdrop"
          @click="activePopupMenu = null"
        ></div>
        
        <!-- Popup Card -->
        <v-card class="mobile-popup-card" :theme="isDarkMode ? 'dark' : 'light'">
          <!-- Dashboard Menu -->
          <v-list v-if="activePopupMenu === 'dashboard'" density="comfortable">
            <v-list-item
              v-if="canViewMetrics"
              @click="navigateToAndClose('/dashboard?tab=metrics')"
              prepend-icon="mdi-chart-areaspline"
              title="Metrics"
              class="mobile-popup-item"
            ></v-list-item>
            <v-list-item
              v-if="canViewCampaigns"
              @click="navigateToAndClose('/dashboard?tab=campaigns')"
              prepend-icon="mdi-bullhorn"
              title="Campaigns"
              class="mobile-popup-item"
            ></v-list-item>
            <v-list-item
              v-if="canViewSparks"
              @click="navigateToAndClose('/dashboard?tab=sparks')"
              prepend-icon="mdi-lightning-bolt"
              title="Sparks"
              class="mobile-popup-item"
            ></v-list-item>
            <v-list-item
              v-if="canViewTemplates"
              @click="navigateToAndClose('/dashboard?tab=templates')"
              prepend-icon="mdi-file-document-multiple"
              title="Templates"
              class="mobile-popup-item"
            ></v-list-item>
            <v-list-item
              v-if="canViewShopify"
              @click="navigateToAndClose('/dashboard?tab=shopify')"
              prepend-icon="mdi-shopping"
              title="Shopify Stores"
              class="mobile-popup-item"
            ></v-list-item>
            <v-list-item
              v-if="canViewLogs"
              @click="navigateToAndClose('/dashboard?tab=logs')"
              prepend-icon="mdi-format-list-bulleted"
              title="Logs"
              class="mobile-popup-item"
            ></v-list-item>
            <v-list-item
              v-if="canViewLinkSplitter"
              @click="navigateToAndClose('/dashboard?tab=linksplitter')"
              prepend-icon="mdi-link-variant"
              title="Link Splitter"
              class="mobile-popup-item"
            ></v-list-item>
          </v-list>

          <!-- Comments Menu -->
          <v-list v-if="activePopupMenu === 'comments'" density="comfortable">
            <v-list-item
              @click="navigateToAndClose('/comments?tab=orders')"
              prepend-icon="mdi-format-list-bulleted"
              title="Orders"
              :active="isTabActive('/comments', 'orders')"
              class="mobile-popup-item"
            ></v-list-item>
            <v-list-item
              @click="navigateToAndClose('/comments?tab=credits')"
              prepend-icon="mdi-wallet"
              title="Credits"
              :active="isTabActive('/comments', 'credits')"
              class="mobile-popup-item"
            ></v-list-item>
            <v-list-item
              v-if="isAdmin"
              @click="navigateToAndClose('/comments?tab=logs')"
              prepend-icon="mdi-file-document-outline"
              :active="isTabActive('/comments', 'logs')"
              class="mobile-popup-item"
            >
              <v-list-item-title class="d-flex align-center">
                Logs
                <v-chip size="x-small" variant="flat" class="ml-2 admin-chip">
                  <v-icon start size="x-small">mdi-crown</v-icon>
                  Admin
                </v-chip>
              </v-list-item-title>
            </v-list-item>
          </v-list>

          <!-- BC Gen Menu -->
          <v-list v-if="activePopupMenu === 'bcgen'" density="comfortable">
            <v-list-item
              @click="navigateToAndClose('/bc-gen?tab=orders')"
              prepend-icon="mdi-cart-plus"
              title="Place Order"
              :active="isTabActive('/bc-gen', 'orders')"
              class="mobile-popup-item"
            ></v-list-item>
            <v-list-item
              @click="navigateToAndClose('/bc-gen?tab=my-orders')"
              prepend-icon="mdi-format-list-bulleted"
              title="My Orders"
              :active="isTabActive('/bc-gen', 'my-orders')"
              class="mobile-popup-item"
            ></v-list-item>
            <v-list-item
              @click="navigateToAndClose('/bc-gen?tab=credits')"
              prepend-icon="mdi-wallet"
              title="Credits"
              :active="isTabActive('/bc-gen', 'credits')"
              class="mobile-popup-item"
            ></v-list-item>
            <v-list-item
              @click="navigateToAndClose('/bc-gen?tab=refunds')"
              prepend-icon="mdi-cash-refund"
              title="Refunds"
              :active="isTabActive('/bc-gen', 'refunds')"
              class="mobile-popup-item"
            ></v-list-item>
            <v-list-item
              v-if="isAdmin"
              @click="navigateToAndClose('/bc-gen?tab=bcgen-refunds')"
              prepend-icon="mdi-cash-refund"
              class="mobile-popup-item"
            >
              <v-list-item-title class="d-flex align-center">
                BCGen Refunds
                <v-chip size="x-small" variant="flat" class="ml-2 admin-chip">
                  <v-icon start size="x-small">mdi-crown</v-icon>
                  Admin
                </v-chip>
              </v-list-item-title>
            </v-list-item>
          </v-list>
          <!-- Settings Menu -->
          <v-list v-if="activePopupMenu === 'settings'" density="comfortable">
            <v-list-item
              v-if="(hasCommentBotAccess || hasBcGenAccess || hasDashboardAccess) && !isAssistingUser"
              @click="navigateToAndClose('/settings?tab=virtual-assistants')"
              prepend-icon="mdi-assistant"
              title="Virtual Assistants"
              class="mobile-popup-item"
            ></v-list-item>
            <v-list-item
              v-if="isAdmin"
              @click="navigateToAndClose('/settings?tab=teams')"
              prepend-icon="mdi-account-group"
              class="mobile-popup-item"
            >
              <v-list-item-title class="d-flex align-center">
                Teams
                <v-chip size="x-small" variant="flat" class="ml-2 admin-chip">
                  <v-icon start size="x-small">mdi-crown</v-icon>
                  Admin
                </v-chip>
              </v-list-item-title>
            </v-list-item>
          </v-list>
          <!-- More Menu -->
          <v-list v-if="activePopupMenu === 'more'" density="comfortable">
            <v-list-item
              @click="navigateToAndClose('/profile')"
              prepend-icon="mdi-account"
              title="Profile"
              class="mobile-popup-item"
            ></v-list-item>
            <!-- Virtual Assistants -->
            <v-list-item
              v-if="(hasCommentBotAccess || hasBcGenAccess || hasDashboardAccess) && !isAssistingUser"
              @click="activePopupMenu = 'virtual-assistants'"
              prepend-icon="mdi-robot"
              class="mobile-popup-item"
            >
              <v-list-item-title class="d-flex align-center justify-space-between">
                Virtual Assistants
                <v-icon size="small">mdi-chevron-right</v-icon>
              </v-list-item-title>
            </v-list-item>
            <!-- Settings -->
            <v-list-item
              v-if="isAdmin"
              @click="activePopupMenu = 'settings'"
              prepend-icon="mdi-cog"
              class="mobile-popup-item"
            >
              <v-list-item-title class="d-flex align-center justify-space-between">
                Settings
                <v-icon size="small">mdi-chevron-right</v-icon>
              </v-list-item-title>
            </v-list-item>
            <v-divider class="my-2"></v-divider>
            <v-list-item
              @click="handleLogout"
              prepend-icon="mdi-logout"
              title="Sign Out"
              class="mobile-popup-item text-error"
            ></v-list-item>
          </v-list>
          <!-- Virtual Assistants Menu -->
          <v-list v-if="activePopupMenu === 'virtual-assistants'" density="comfortable">
            <v-list-item
              @click="navigateToAndClose('/virtual-assistants?tab=configure')"
              prepend-icon="mdi-cog"
              title="Configure"
              class="mobile-popup-item"
            ></v-list-item>
            <v-list-item
              @click="navigateToAndClose('/virtual-assistants?tab=credits')"
              prepend-icon="mdi-wallet"
              title="Credits"
              class="mobile-popup-item"
            ></v-list-item>
          </v-list>
        </v-card>
      </div>
    </v-slide-y-reverse-transition>

    <!-- Mobile Menu Overlay -->
    <v-overlay
      v-model="mobileMenuOpen"
      v-if="$vuetify.display.smAndDown"
      class="mobile-menu-overlay"
      @click="mobileMenuOpen = false"
    >
      <transition name="slide-down">
        <v-card v-if="mobileMenuOpen" class="mobile-menu-card" @click.stop>
        <v-card-title class="d-flex align-center pa-4">
          <span>Menu</span>
          <v-spacer></v-spacer>
          <v-btn icon variant="text" @click="mobileMenuOpen = false" size="small">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        
        <v-card-text class="pa-0">
          <v-list>
            <!-- Theme Toggle -->
            <v-list-item @click="toggleDarkMode">
              <template v-slot:prepend>
                <v-icon>{{ isDarkMode ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
              </template>
              <v-list-item-title>{{ isDarkMode ? 'Light Mode' : 'Dark Mode' }}</v-list-item-title>
            </v-list-item>

            <!-- Profile -->
            <v-list-item @click="navigateAndClose('/profile')" prepend-icon="mdi-account" title="Profile"></v-list-item>

            <!-- Logout -->
            <v-list-item @click="handleLogout" prepend-icon="mdi-logout" title="Logout"></v-list-item>
          </v-list>
        </v-card-text>
        </v-card>
      </transition>
    </v-overlay>
    
    <!-- Virtual Assistant Mode Banner -->
    <v-banner
      v-if="isAssistingUser"
      class="virtual-assistant-banner"
      :style="{
        position: 'fixed',
        top: isAuthenticated && $vuetify.display.mdAndUp ? '70px' : '56px',
        left: $vuetify.display.mdAndUp ? (drawer ? '256px' : '56px') : '0',
        right: 0,
        zIndex: 1998,
        background: 'linear-gradient(90deg, #4CAF50 0%, #45a049 100%)',
        color: 'white',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'left 0.2s'
      }"
    >
      <div class="d-flex align-center">
        <v-icon class="mr-2">mdi-account-eye</v-icon>
        <span class="font-weight-medium">
          You are currently assisting: {{ user?.assistingFor || user?.email || `User #${getTargetUserId()}` }}
        </span>
      </div>
      <v-btn
        variant="outlined"
        size="small"
        color="white"
        @click="stopAssisting"
        class="ml-4"
      >
        <v-icon start small>mdi-close</v-icon>
        Stop Assisting
      </v-btn>
    </v-banner>
    
    <!-- Desktop Navigation Drawer -->
    <v-navigation-drawer
      v-if="shouldShowNavigation && $vuetify.display.mdAndUp"
      v-model="drawer"
      :rail="!drawer"
      permanent
      :expand-on-hover="true"
      :class="isDarkMode ? 'drawer-dark' : 'drawer-light'"
    >
      <!-- Navigation list -->
      <v-list nav density="compact" class="pt-20" v-model:opened="opened">
        <!-- Dashboard -->
        <v-list-group v-if="hasDashboardAccess" value="dashboard" :value="opened.includes('dashboard')">
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              prepend-icon="mdi-view-dashboard"
              title="Dashboard"
              :active="activeRoute.includes('/dashboard')"
              rounded="lg"
            ></v-list-item>
          </template>
          
          <v-list-item
            v-if="canViewMetrics"
            to="/dashboard?tab=metrics"
            prepend-icon="mdi-chart-areaspline"
            title="Metrics"
            :active="isTabActive('/dashboard', 'metrics')"
            class="ml-2"
            rounded="lg"
          ></v-list-item>
          
          <v-list-item
            v-if="canViewCampaigns"
            to="/dashboard?tab=campaigns"
            prepend-icon="mdi-bullhorn"
            title="Campaigns"
            :active="isTabActive('/dashboard', 'campaigns')"
            class="ml-2"
            rounded="lg"
          ></v-list-item>
          
          <v-list-item
            v-if="canViewSparks"
            to="/dashboard?tab=sparks"
            prepend-icon="mdi-lightning-bolt"
            title="Sparks"
            :active="isTabActive('/dashboard', 'sparks')"
            class="ml-2"
            rounded="lg"
          ></v-list-item>
          
          <v-list-item
            v-if="canViewTemplates"
            to="/dashboard?tab=templates"
            prepend-icon="mdi-file-document-multiple"
            title="Templates"
            :active="isTabActive('/dashboard', 'templates')"
            class="ml-2"
            rounded="lg"
          ></v-list-item>
          
          <v-list-item
            v-if="canViewShopify"
            to="/dashboard?tab=shopify"
            prepend-icon="mdi-shopping"
            title="Shopify Stores"
            :active="isTabActive('/dashboard', 'shopify')"
            class="ml-2"
            rounded="lg"
          ></v-list-item>
          
          <v-list-item
            v-if="canViewLogs"
            to="/dashboard?tab=logs"
            prepend-icon="mdi-format-list-bulleted"
            title="Logs"
            :active="isTabActive('/dashboard', 'logs')"
            class="ml-2"
            rounded="lg"
          ></v-list-item>
          
          <v-list-item
            v-if="canViewLinkSplitter"
            to="/dashboard?tab=linksplitter"
            prepend-icon="mdi-link-variant"
            title="Link Splitter"
            :active="isTabActive('/dashboard', 'linksplitter')"
            class="ml-2"
            rounded="lg"
          ></v-list-item>
        </v-list-group>

        <!-- Comment Bot -->
        <v-list-group v-if="hasCommentBotAccess" value="comments" :value="opened.includes('comments')">
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              prepend-icon="mdi-comment-multiple"
              title="Comment Bot"
              :active="activeRoute.includes('/comments')"
              rounded="lg"
            ></v-list-item>
          </template>
          
          <v-list-item
            to="/comments?tab=orders"
            prepend-icon="mdi-format-list-bulleted"
            title="Orders"
            :active="isTabActive('/comments', 'orders')"
            class="ml-2"
            rounded="lg"
          ></v-list-item>
          
          <v-list-item
            to="/comments?tab=credits"
            prepend-icon="mdi-wallet"
            title="Credits"
            :active="isTabActive('/comments', 'credits')"
            class="ml-2"
            rounded="lg"
          ></v-list-item>
          
          <v-list-item
            v-if="isAdmin"
            to="/comments?tab=logs"
            prepend-icon="mdi-file-document-outline"
            :active="isTabActive('/comments', 'logs')"
            class="ml-2"
            rounded="lg"
          >
            <v-list-item-title class="d-flex align-center">
              Logs
              <v-chip size="x-small" variant="flat" class="ml-2 admin-chip">
                <v-icon start size="x-small">mdi-crown</v-icon>
                Admin
              </v-chip>
            </v-list-item-title>
          </v-list-item>
        </v-list-group>

        <!-- BC Gen -->
        <v-list-group v-if="hasBcGenAccess" value="bcgen" :value="opened.includes('bcgen')">
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              prepend-icon="mdi-account-multiple-plus"
              title="BC Gen"
              :active="activeRoute.includes('/bc-gen')"
              rounded="lg"
            ></v-list-item>
          </template>
          
          <v-list-item
            to="/bc-gen?tab=orders"
            prepend-icon="mdi-shopping-outline"
            title="Place Order"
            :active="isTabActive('/bc-gen', 'orders')"
            class="ml-2"
            rounded="lg"
          ></v-list-item>
          
          <v-list-item
            to="/bc-gen?tab=my-orders"
            prepend-icon="mdi-format-list-bulleted"
            title="My Orders"
            :active="isTabActive('/bc-gen', 'my-orders')"
            class="ml-2"
            rounded="lg"
          ></v-list-item>
          
          <v-list-item
            to="/bc-gen?tab=credits"
            prepend-icon="mdi-wallet"
            title="Credits"
            :active="isTabActive('/bc-gen', 'credits')"
            class="ml-2"
            rounded="lg"
          ></v-list-item>
          
          <v-list-item
            to="/bc-gen?tab=refunds"
            prepend-icon="mdi-undo"
            title="Refunds"
            :active="isTabActive('/bc-gen', 'refunds')"
            class="ml-2"
            rounded="lg"
          ></v-list-item>
          
          <v-list-item
            v-if="isAdmin"
            to="/bc-gen?tab=bcgen-refunds"
            prepend-icon="mdi-cash-refund"
            :active="isTabActive('/bc-gen', 'bcgen-refunds')"
            class="ml-2"
            rounded="lg"
          >
            <v-list-item-title class="d-flex align-center">
              BCGen Refunds
              <v-chip size="x-small" variant="flat" class="ml-2 admin-chip">
                <v-icon start size="x-small">mdi-crown</v-icon>
                Admin
              </v-chip>
            </v-list-item-title>
          </v-list-item>
        </v-list-group>

        <!-- Virtual Assistants -->
        <v-list-group v-if="(hasCommentBotAccess || hasBcGenAccess || hasDashboardAccess) && !isAssistingUser" value="virtual-assistants" :value="opened.includes('virtual-assistants')">
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              prepend-icon="mdi-robot"
              title="Virtual Assistants"
              :active="activeRoute.includes('/virtual-assistants')"
              rounded="lg"
            ></v-list-item>
          </template>
          
          <v-list-item
            to="/virtual-assistants?tab=configure"
            prepend-icon="mdi-cog"
            title="Configure"
            :active="isTabActive('/virtual-assistants', 'configure')"
            class="ml-2"
            rounded="lg"
          ></v-list-item>
          
          <v-list-item
            to="/virtual-assistants?tab=credits"
            prepend-icon="mdi-wallet"
            title="Credits"
            :active="isTabActive('/virtual-assistants', 'credits')"
            class="ml-2"
            rounded="lg"
          ></v-list-item>
        </v-list-group>

        <!-- Profile -->
        <v-list-item
          to="/profile"
          prepend-icon="mdi-account"
          title="Profile"
          :active="activeRoute === '/profile' || activeRoute === '/'"
          rounded="lg"
        ></v-list-item>

        <!-- Settings -->
        <v-list-group 
          v-if="isAdmin"
          value="settings" 
          :value="opened.includes('settings')">
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              prepend-icon="mdi-cog"
              :active="activeRoute.includes('/settings')"
              rounded="lg"
            >
              <v-list-item-title>
                Settings
              </v-list-item-title>
            </v-list-item>
          </template>
          
          <v-list-item
            v-if="isAdmin"
            to="/settings?tab=teams"
            prepend-icon="mdi-account-group"
            :active="isTabActive('/settings', 'teams')"
            class="ml-2"
            rounded="lg"
          >
            <v-list-item-title class="d-flex align-center">
              Teams
              <v-chip size="x-small" variant="flat" class="ml-2 admin-chip">
                <v-icon start size="x-small">mdi-crown</v-icon>
                Admin
              </v-chip>
            </v-list-item-title>
          </v-list-item>
          
        </v-list-group>
      </v-list>
    </v-navigation-drawer>
    
    <!-- Main Content - Router View with improved padding -->
    <v-main class="main-content">
      <v-container fluid :class="isAuthenticated ? 'pa-6' : 'pa-0'" :style="{ paddingTop: isAssistingUser ? '48px' : '0' }">
        <router-view />
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
.drawer-light {
  border-right: 1px solid rgba(0, 0, 0, 0.12);
}

.drawer-dark {
  border-right: 1px solid rgba(255, 255, 255, 0.12);
}

/* Ensure navigation drawer is below app bar */
.v-navigation-drawer {
  z-index: 1999 !important;
}

/* Mobile-First Design Styles */
.mobile-app-bar {
  z-index: 2004 !important;
}

.mobile-title {
  font-size: 1.1rem !important;
  font-weight: 600;
  display: flex;
  align-items: center;
}

.mobile-bottom-nav {
  z-index: 2003 !important;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
}

.v-theme--dark .mobile-bottom-nav {
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.mobile-bottom-nav .v-btn {
  flex-direction: column !important;
  height: 56px !important;
  min-height: 56px !important;
}

.mobile-bottom-nav .v-btn .v-icon {
  margin-bottom: 4px !important;
}

.mobile-bottom-nav .v-btn .text-caption {
  font-size: 0.625rem !important;
  line-height: 1 !important;
}

/* Active popup indicator */
.mobile-bottom-nav .v-btn--active::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 4px;
  background-color: rgb(var(--v-theme-primary));
  border-radius: 0 0 4px 4px;
  animation: expandWidth 0.2s ease-out;
}

/* Mobile Menu Overlay Styles */
.mobile-menu-overlay {
  align-items: flex-start !important;
  justify-content: flex-end !important;
  padding: 0 !important;
}

.mobile-menu-overlay .v-overlay__content {
  position: fixed !important;
  top: 70px !important;
  right: 16px !important;
  left: auto !important;
  transform: none !important;
  margin: 0 !important;
  width: 280px !important;
  max-width: calc(100vw - 32px) !important;
  z-index: 2010 !important;
}

.mobile-menu-card {
  border-radius: 12px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
  overflow: hidden;
  position: relative;
}

.mobile-menu-card::before {
  content: '';
  position: absolute;
  top: -8px;
  right: 24px;
  width: 16px;
  height: 16px;
  background-color: inherit;
  transform: rotate(45deg);
  border-radius: 2px;
  box-shadow: -2px -2px 4px rgba(0, 0, 0, 0.1);
}

.v-theme--dark .mobile-menu-card {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6) !important;
}

.v-theme--dark .mobile-menu-card::before {
  box-shadow: -2px -2px 4px rgba(0, 0, 0, 0.3);
}

/* Slide down transition */
.slide-down-enter-active {
  transition: all 0.3s ease-out;
}

.slide-down-leave-active {
  transition: all 0.25s ease-in;
}

.slide-down-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}

.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  transform: translateY(0);
  opacity: 1;
}

@keyframes expandWidth {
  from {
    width: 0;
  }
  to {
    width: 40px;
  }
}

/* Mobile Content Padding */
@media (max-width: 959px) {
  .v-main {
    padding-top: 56px !important;
    padding-bottom: 56px !important;
  }
}

/* Virtual Assistant Banner specific styles */
.virtual-assistant-banner {
  box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
}

/* Adjust main content when banner is shown */
.v-main .v-container[style*="paddingTop"] {
  transition: padding-top 0.3s ease;
}

/* Hide desktop drawer on mobile */
@media (max-width: 959px) {
  .v-navigation-drawer {
    display: none !important;
  }
}

/* Mobile Popup Menu Styles */
.mobile-popup-container {
  position: fixed;
  bottom: 56px; /* Height of bottom navigation */
  left: 0;
  right: 0;
  z-index: 2002;
}

.mobile-popup-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.3);
  z-index: -1;
}

.mobile-popup-card {
  border-radius: 12px 12px 0 0 !important;
  margin: 0 8px !important;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15) !important;
  overflow: hidden;
  position: relative;
  animation: slideUp 0.2s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.v-theme--dark .mobile-popup-card {
  box-shadow: 0 -4px 20px rgba(255, 255, 255, 0.1) !important;
}

.mobile-popup-card .v-list {
  padding: 4px 0 8px 0 !important;
  background-color: transparent !important;
}

.mobile-popup-item {
  min-height: 48px !important;
  padding: 0 16px;
  margin: 0 8px;
  border-radius: 8px;
  transition: background-color 0.15s ease;
}

.mobile-popup-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.mobile-popup-item.v-list-item--active {
  background-color: rgba(var(--v-theme-primary), 0.12);
}

.mobile-popup-item.v-list-item--active .v-list-item__prepend .v-icon {
  color: rgb(var(--v-theme-primary));
}

/* Add a subtle line to visually connect to bottom nav */
.mobile-popup-card::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(to right, 
    transparent 10%, 
    rgba(var(--v-theme-primary), 0.3) 50%, 
    transparent 90%
  );
}

.main-content {
  background-color: var(--v-theme-background);
}

/* Prevent scrolling on welcome page */
.v-main .v-container.pa-0 {
  max-height: 100vh;
  overflow: hidden;
}

.border-b {
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

/* Smooth transitions for theme changes */
.v-navigation-drawer,
.v-app-bar {
  transition: background-color 0.3s ease;
}

/* Futuristic App Bar Styles */
.futuristic-app-bar {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  overflow: hidden !important;
  z-index: 2000 !important;
}

/* Override Vuetify's default background */
.futuristic-app-bar .v-toolbar__content,
.futuristic-app-bar .v-toolbar__extension {
  background: transparent !important;
}

.app-bar-pattern {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.15;
  background-image: 
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 40px,
      rgba(255, 255, 255, 0.03) 40px,
      rgba(255, 255, 255, 0.03) 80px
    );
  pointer-events: none;
  animation: shimmer 3s linear infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-40px);
  }
  100% {
    transform: translateX(40px);
  }
}

.app-bar-title {
  z-index: 2;
  position: relative;
  display: flex;
  align-items: center;
  transition: all 0.3s ease;
  cursor: pointer;
}

.app-bar-title:hover {
  transform: scale(1.05);
}

.app-bar-title:hover .v-icon {
  animation: robot-dance 0.5s ease-in-out;
}

@keyframes robot-dance {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-10deg); }
  75% { transform: rotate(10deg); }
}

.app-bar-title span {
  background: linear-gradient(45deg, #667eea, #764ba2, #f64f59);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-size: 200% auto;
  animation: gradient-shift 3s ease infinite;
}

@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* Hover effects for buttons in app bar */
.futuristic-app-bar .v-btn {
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.futuristic-app-bar .v-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(255, 255, 255, 0.2);
}

.futuristic-app-bar .v-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.futuristic-app-bar .v-btn:hover::before {
  width: 100px;
  height: 100px;
}

/* Floating Particles Animation */
.particles-container {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}

.particle {
  position: absolute;
  width: 3px;
  height: 3px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  animation: float-up 15s infinite;
}

.particle-1 { left: 5%; animation-delay: 0s; animation-duration: 12s; }
.particle-2 { left: 10%; animation-delay: 1s; animation-duration: 15s; }
.particle-3 { left: 15%; animation-delay: 2s; animation-duration: 10s; }
.particle-4 { left: 20%; animation-delay: 0.5s; animation-duration: 13s; }
.particle-5 { left: 25%; animation-delay: 3s; animation-duration: 11s; }
.particle-6 { left: 30%; animation-delay: 1.5s; animation-duration: 14s; }
.particle-7 { left: 35%; animation-delay: 2.5s; animation-duration: 12s; }
.particle-8 { left: 40%; animation-delay: 0.3s; animation-duration: 16s; }
.particle-9 { left: 45%; animation-delay: 1.8s; animation-duration: 10s; }
.particle-10 { left: 50%; animation-delay: 2.3s; animation-duration: 13s; }
.particle-11 { left: 55%; animation-delay: 0.8s; animation-duration: 11s; }
.particle-12 { left: 60%; animation-delay: 3.5s; animation-duration: 15s; }
.particle-13 { left: 65%; animation-delay: 1.3s; animation-duration: 12s; }
.particle-14 { left: 70%; animation-delay: 2.8s; animation-duration: 14s; }
.particle-15 { left: 75%; animation-delay: 0.2s; animation-duration: 10s; }

@keyframes float-up {
  0% {
    transform: translateY(100px) translateX(0);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(-100px) translateX(50px);
    opacity: 0;
  }
}

/* Animated Border Gradient */
.animated-border {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, 
    transparent,
    #667eea,
    #764ba2,
    #f64f59,
    transparent
  );
  background-size: 200% 100%;
  animation: border-slide 3s linear infinite;
}

@keyframes border-slide {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* Glowing Orbs */
.orb-container {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.4;
  animation: orb-float 20s ease-in-out infinite;
}

.orb-1 {
  width: 150px;
  height: 150px;
  background: radial-gradient(circle, #667eea, transparent);
  top: -50px;
  left: -50px;
  animation-duration: 15s;
}

.orb-2 {
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, #764ba2, transparent);
  top: -100px;
  right: 10%;
  animation-duration: 20s;
  animation-delay: 5s;
}

.orb-3 {
  width: 120px;
  height: 120px;
  background: radial-gradient(circle, #f64f59, transparent);
  bottom: -60px;
  left: 30%;
  animation-duration: 18s;
  animation-delay: 10s;
}

@keyframes orb-float {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(30px, -30px) scale(1.1);
  }
  50% {
    transform: translate(-20px, 20px) scale(0.9);
  }
  75% {
    transform: translate(40px, 10px) scale(1.05);
  }
}

/* Header Entrance Animation */
.header-entrance {
  animation: header-slide-down 0.8s ease-out;
}

@keyframes header-slide-down {
  0% {
    transform: translateY(-100%);
    opacity: 0;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.header-entrance .app-bar-title {
  animation: title-fade-in 1s ease-out 0.5s both;
}

@keyframes title-fade-in {
  0% {
    opacity: 0;
    transform: translateX(-20px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

.header-entrance .v-btn {
  animation: button-pop-in 0.6s ease-out backwards;
}

.header-entrance .v-btn:nth-child(1) { animation-delay: 0.8s; }
.header-entrance .v-btn:nth-child(2) { animation-delay: 0.9s; }
.header-entrance .v-btn:nth-child(3) { animation-delay: 1s; }

@keyframes button-pop-in {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  80% {
    transform: scale(1.1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.header-entrance .particles-container {
  animation: particles-fade-in 2s ease-out 1.2s both;
}

@keyframes particles-fade-in {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

/* Dark mode specific styles */
.v-theme--dark .futuristic-app-bar {
  border-bottom-color: rgba(255, 255, 255, 0.05) !important;
}

.v-theme--light .futuristic-app-bar {
  border-bottom-color: rgba(255, 255, 255, 0.2) !important;
}

/* Glassmorphism effect */
.futuristic-app-bar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.05);
  pointer-events: none;
}

/* Simple active tab styling - colors only */
.v-navigation-drawer .active-tab,
.v-navigation-drawer .active-tab.v-list-item {
  background-color: #ffffff !important;
  color: #1976d2 !important;
}

.v-navigation-drawer .active-tab .v-list-item__prepend .v-icon {
  color: #1976d2 !important;
}

/* Dark mode */
.v-theme--dark .v-navigation-drawer .active-tab,
.v-theme--dark .v-navigation-drawer .active-tab.v-list-item {
  background-color: #ffffff !important;
  color: #1976d2 !important;
}

.v-theme--dark .v-navigation-drawer .active-tab .v-list-item__prepend .v-icon {
  color: #1976d2 !important;
}

/* Ultra-specific force white background class */
.force-white-bg,
.force-white-bg.v-list-item,
.force-white-bg.v-list-item.v-list-item--active,
.force-white-bg.v-list-item.v-list-item--nav,
.v-navigation-drawer .force-white-bg,
.v-navigation-drawer .force-white-bg.v-list-item,
.v-navigation-drawer .v-list .force-white-bg,
.v-navigation-drawer .v-list .force-white-bg.v-list-item,
.v-theme--dark .force-white-bg,
.v-theme--dark .force-white-bg.v-list-item,
.v-theme--dark .v-navigation-drawer .force-white-bg,
.v-theme--dark .v-navigation-drawer .force-white-bg.v-list-item {
  background-color: #ffffff !important;
  background: #ffffff !important;
  color: #1976d2 !important;
  border-radius: 8px !important;
  margin: 2px 8px !important;
}

.force-white-bg:hover,
.force-white-bg.v-list-item:hover,
.v-theme--dark .force-white-bg:hover,
.v-theme--dark .force-white-bg.v-list-item:hover {
  background-color: #ffffff !important;
  background: #ffffff !important;
}

/* Force Vuetify bg-white to work */
.v-navigation-drawer .bg-white,
.v-navigation-drawer .bg-white.v-list-item,
.v-theme--dark .v-navigation-drawer .bg-white,
.v-theme--dark .v-navigation-drawer .bg-white.v-list-item {
  background-color: white !important;
  background: white !important;
}

/* Override any router-link-active or active states */
.v-navigation-drawer .v-list-item.router-link-active.bg-white,
.v-navigation-drawer .v-list-item--active.bg-white,
.v-theme--dark .v-navigation-drawer .v-list-item.router-link-active.bg-white,
.v-theme--dark .v-navigation-drawer .v-list-item--active.bg-white {
  background-color: white !important;
  background: white !important;
}

/* Remove ALL backgrounds from nested tabs - Ultra specific */
.v-navigation-drawer .v-list-group .v-list-item,
.v-navigation-drawer .v-list-group .v-list-item.v-list-item--nav,
.v-navigation-drawer .v-list-group .v-list-item.v-list-item--link,
.v-navigation-drawer .v-list-group .v-list-item.v-list-item--density-compact,
.v-navigation-drawer .v-list .v-list-group .v-list-item,
.v-navigation-drawer .v-list .v-list-group .v-list-item.v-list-item--nav,
.v-list-group .v-list-item,
.v-list-group .v-list-item.v-list-item--nav,
.v-list-group .v-list-item.v-list-item--link,
.v-list-group .v-list-item.v-list-item--density-compact {
  background-color: transparent !important;
  background: transparent !important;
  background-image: none !important;
}

/* Dark mode - Remove ALL backgrounds from nested tabs */
.v-theme--dark .v-navigation-drawer .v-list-group .v-list-item,
.v-theme--dark .v-navigation-drawer .v-list-group .v-list-item.v-list-item--nav,
.v-theme--dark .v-navigation-drawer .v-list-group .v-list-item.v-list-item--link,
.v-theme--dark .v-navigation-drawer .v-list .v-list-group .v-list-item,
.v-theme--dark .v-list-group .v-list-item,
.v-theme--dark .v-list-group .v-list-item.v-list-item--nav {
  background-color: transparent !important;
  background: transparent !important;
  background-image: none !important;
}

/* Remove hover backgrounds for nested tabs */
.v-navigation-drawer .v-list-group .v-list-item:hover:not(.active-tab) {
  background-color: rgba(0, 0, 0, 0.04) !important;
}

.v-theme--dark .v-navigation-drawer .v-list-group .v-list-item:hover:not(.active-tab) {
  background-color: rgba(255, 255, 255, 0.04) !important;
}

/* Remove router-link-active backgrounds unless it's our active tab */
.v-navigation-drawer .v-list-group .v-list-item.router-link-active:not(.active-tab),
.v-navigation-drawer .v-list-group .v-list-item--active:not(.active-tab),
.v-list-group .v-list-item.router-link-active:not(.active-tab),
.v-list-group .v-list-item--active:not(.active-tab) {
  background-color: transparent !important;
  background: transparent !important;
}

/* Override any Vuetify theme surface colors on nested items */
.v-navigation-drawer .v-list-group .v-list-item:not(.active-tab) {
  --v-theme-surface: transparent !important;
  --v-theme-surface-variant: transparent !important;
}

/* Fix the main issue: When parent list-group is active, children get gray background */
.v-list-group--active .v-list-item:not(.active-tab),
.v-list-group.v-list-group--active .v-list-item:not(.active-tab),
.v-navigation-drawer .v-list-group--active .v-list-item:not(.active-tab),
.v-navigation-drawer .v-list-group.v-list-group--active .v-list-item:not(.active-tab) {
  background-color: transparent !important;
  background: transparent !important;
  background-image: none !important;
}

/* Dark mode version */
.v-theme--dark .v-list-group--active .v-list-item:not(.active-tab),
.v-theme--dark .v-list-group.v-list-group--active .v-list-item:not(.active-tab),
.v-theme--dark .v-navigation-drawer .v-list-group--active .v-list-item:not(.active-tab) {
  background-color: transparent !important;
  background: transparent !important;
  background-image: none !important;
}

/* Force remove any inherited background from active list group */
.v-list-group--active .v-list-group__items .v-list-item:not(.active-tab) {
  background-color: transparent !important;
  background: transparent !important;
}

/* Nuclear option: Force ALL nested list items to be transparent unless active */
.v-navigation-drawer .ml-2 {
  background-color: transparent !important;
  background: transparent !important;
}

/* Removed - keeping size consistent */

/* Move sub-tab icons more to the left - more aggressive approach */
.v-navigation-drawer .v-list-group .v-list-item.ml-2 {
  padding-left: 8px !important;
  padding-inline-start: 8px !important;
}

.v-navigation-drawer .v-list-group .v-list-item.ml-2 .v-list-item__prepend {
  margin-left: 0 !important;
  margin-inline-start: 0 !important;
  margin-right: 8px !important;
  margin-inline-end: 8px !important;
}

.v-navigation-drawer .v-list-group .v-list-item.ml-2 .v-list-item__prepend .v-icon {
  margin-left: 0 !important;
  margin-inline-start: 0 !important;
}

/* Admin chip styling */
.v-list-item-title .v-chip {
  height: 18px;
  font-size: 10px;
  padding: 0 6px;
}

.v-list-item-title .v-chip .v-icon {
  font-size: 12px;
}

/* Admin chip styling with forced amber color */
.admin-chip {
  background-color: #FFC107 !important;
  color: rgba(0, 0, 0, 0.87) !important;
}

.admin-chip .v-icon {
  color: rgba(0, 0, 0, 0.87) !important;
}

/* Ensure admin chips are always amber in both themes */
.v-theme--dark .admin-chip,
.v-theme--light .admin-chip {
  background-color: #FFC107 !important;
  color: rgba(0, 0, 0, 0.87) !important;
}

.v-theme--dark .admin-chip .v-icon,
.v-theme--light .admin-chip .v-icon {
  color: rgba(0, 0, 0, 0.87) !important;
}

/* Ensure chips don't wrap */
.v-list-item-title {
  white-space: nowrap;
  display: flex;
  align-items: center;
}

/* Mobile popup admin chips */
.mobile-popup-item .v-list-item-title {
  flex-wrap: nowrap;
}

.mobile-popup-item .v-chip {
  margin-left: auto;
}

/* Adjust spacing for navigation items with chips */
.v-navigation-drawer .v-list-item-title .v-chip {
  opacity: 0.9;
  transition: opacity 0.2s;
}

.v-navigation-drawer .v-list-item:hover .v-list-item-title .v-chip {
  opacity: 1;
}
</style>