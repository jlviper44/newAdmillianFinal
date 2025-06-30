<script setup>
import { ref, onMounted, computed } from 'vue';
import { useTheme } from 'vuetify';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import UserMenu from '@/components/UserMenu.vue';

const router = useRouter();
const theme = useTheme();
const isDarkMode = ref(false);

// Authentication
const { initAuth, isAuthenticated, hasCommentBotAccess, hasBcGenAccess, hasDashboardAccess } = useAuth();

// All routes
const allRoutes = [
  { 
    title: 'Dashboard', 
    icon: 'mdi-view-dashboard', 
    path: '/dashboard',
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
    requiresSubscription: null
  },
  { 
    title: 'Settings', 
    icon: 'mdi-cog', 
    path: '/settings',
    requiresSubscription: null
  },
];

// Filtered routes based on user access
const visibleRoutes = computed(() => {
  if (!isAuthenticated.value) return [];
  
  return allRoutes.filter(route => {
    // Always show routes without subscription requirements
    if (!route.requiresSubscription) return true;
    
    // Check specific subscription requirements
    if (route.requiresSubscription === 'comment_bot') return hasCommentBotAccess.value;
    if (route.requiresSubscription === 'bc_gen') return hasBcGenAccess.value;
    if (route.requiresSubscription === 'dashboard') return hasDashboardAccess.value;
    
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

// Active route for highlighting current page using Vue Router
const activeRoute = computed(() => {
  return router.currentRoute.value.path;
});

// Check if a tab is currently active
const isTabActive = (path, tab) => {
  const currentRoute = router.currentRoute.value;
  const isActive = currentRoute.path === path && currentRoute.query.tab === tab;
  return isActive;
};

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
});
</script>

<template>
  <v-app>
    <!-- Futuristic App Bar -->
    <v-app-bar
      v-if="isAuthenticated"
      elevation="0"
      height="70"
      class="futuristic-app-bar"
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
      
      <!-- Menu toggle for responsive design -->
      <v-app-bar-nav-icon 
        @click="toggleDrawer"
        :color="isDarkMode ? 'grey-lighten-2' : 'white'"
        style="z-index: 2;"
      ></v-app-bar-nav-icon>
      
      <v-app-bar-title class="font-weight-bold app-bar-title" :class="isDarkMode ? 'text-grey-lighten-2' : 'text-white'">
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
    
    <!-- Navigation Drawer with improved styling -->
    <v-navigation-drawer
      v-if="isAuthenticated"
      v-model="drawer"
      :rail="!drawer && $vuetify.display.mdAndUp"
      permanent
      :expand-on-hover="$vuetify.display.mdAndUp"
      :location="$vuetify.display.mdAndUp ? 'left' : 'bottom'"
      :class="isDarkMode ? 'drawer-dark' : 'drawer-light'"
    >
      <!-- Navigation list -->
      <v-list nav density="compact" class="pt-20">
        <!-- Dashboard with nested items -->
        <v-list-group 
          v-if="visibleRoutes.find(r => r.path === '/dashboard')"
          value="dashboard"
          :active="false"
        >
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              prepend-icon="mdi-view-dashboard"
              title="Dashboard"
              :to="'/dashboard?tab=overview'"
            ></v-list-item>
          </template>
          
          <v-list-item
            to="/dashboard?tab=overview"
            title="Overview"
            prepend-icon="mdi-chart-line"
            class="ml-2"
            :class="{ 'active-tab': isTabActive('/dashboard', 'overview') }"
:style="isTabActive('/dashboard', 'overview') ? 'background-color: #ffffff !important; color: #1976d2 !important;' : 'background-color: transparent !important;'"
          ></v-list-item>
          <v-list-item
            to="/dashboard?tab=metrics"
            title="Metrics"
            prepend-icon="mdi-chart-areaspline"
            class="ml-2"
            :class="{ 'active-tab': isTabActive('/dashboard', 'metrics') }"
:style="isTabActive('/dashboard', 'metrics') ? 'background-color: #ffffff !important; color: #1976d2 !important;' : 'background-color: transparent !important;'"
          ></v-list-item>
          <v-list-item
            to="/dashboard?tab=campaigns"
            title="Campaigns"
            prepend-icon="mdi-bullhorn"
            class="ml-2"
            :class="{ 'active-tab': isTabActive('/dashboard', 'campaigns') }"
:style="isTabActive('/dashboard', 'campaigns') ? 'background-color: #ffffff !important; color: #1976d2 !important;' : 'background-color: transparent !important;'"
          ></v-list-item>
          <v-list-item
            to="/dashboard?tab=sparks"
            title="Sparks"
            prepend-icon="mdi-lightning-bolt"
            class="ml-2"
            :class="{ 'active-tab': isTabActive('/dashboard', 'sparks') }"
:style="isTabActive('/dashboard', 'sparks') ? 'background-color: #ffffff !important; color: #1976d2 !important;' : 'background-color: transparent !important;'"
          ></v-list-item>
          <v-list-item
            to="/dashboard?tab=templates"
            title="Templates"
            prepend-icon="mdi-file-document-multiple"
            class="ml-2"
            :class="{ 'active-tab': isTabActive('/dashboard', 'templates') }"
:style="isTabActive('/dashboard', 'templates') ? 'background-color: #ffffff !important; color: #1976d2 !important;' : 'background-color: transparent !important;'"
          ></v-list-item>
          <v-list-item
            to="/dashboard?tab=shopify"
            title="Shopify Stores"
            prepend-icon="mdi-shopping"
            class="ml-2"
            :class="{ 'active-tab': isTabActive('/dashboard', 'shopify') }"
:style="isTabActive('/dashboard', 'shopify') ? 'background-color: #ffffff !important; color: #1976d2 !important;' : 'background-color: transparent !important;'"
          ></v-list-item>
          <v-list-item
            to="/dashboard?tab=logs"
            title="Logs"
            prepend-icon="mdi-format-list-bulleted"
            class="ml-2"
            :class="{ 'active-tab': isTabActive('/dashboard', 'logs') }"
:style="isTabActive('/dashboard', 'logs') ? 'background-color: #ffffff !important; color: #1976d2 !important;' : 'background-color: transparent !important;'"
          ></v-list-item>
        </v-list-group>

        <!-- Comment Bot with nested items -->
        <v-list-group 
          v-if="visibleRoutes.find(r => r.path === '/comments')"
          value="comments"
          :active="false"
        >
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              prepend-icon="mdi-comment-multiple"
              title="Comment Bot"
              :to="'/comments?tab=orders'"
            ></v-list-item>
          </template>
          
          <v-list-item
            to="/comments?tab=orders"
            title="Orders"
            prepend-icon="mdi-format-list-bulleted"
            class="ml-2"
            :class="{ 'active-tab': isTabActive('/comments', 'orders') }"
:style="isTabActive('/comments', 'orders') ? 'background-color: #ffffff !important; color: #1976d2 !important;' : 'background-color: transparent !important;'"
          ></v-list-item>
          <v-list-item
            to="/comments?tab=credits"
            title="Credits"
            prepend-icon="mdi-wallet"
            class="ml-2"
            :class="{ 'active-tab': isTabActive('/comments', 'credits') }"
:style="isTabActive('/comments', 'credits') ? 'background-color: #ffffff !important; color: #1976d2 !important;' : 'background-color: transparent !important;'"
          ></v-list-item>
        </v-list-group>

        <!-- BC Gen with nested items -->
        <v-list-group 
          v-if="visibleRoutes.find(r => r.path === '/bc-gen')"
          value="bc-gen"
          :active="false"
        >
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              prepend-icon="mdi-account-multiple-plus"
              title="BC Gen"
              :to="'/bc-gen?tab=orders'"
            ></v-list-item>
          </template>
          
          <v-list-item
            to="/bc-gen?tab=orders"
            title="Place Order"
            prepend-icon="mdi-cart-plus"
            class="ml-2"
            :class="{ 'active-tab': isTabActive('/bc-gen', 'orders') }"
:style="isTabActive('/bc-gen', 'orders') ? 'background-color: #ffffff !important; color: #1976d2 !important;' : 'background-color: transparent !important;'"
          ></v-list-item>
          <v-list-item
            to="/bc-gen?tab=my-orders"
            title="My Orders"
            prepend-icon="mdi-format-list-bulleted"
            class="ml-2"
            :class="{ 'active-tab': isTabActive('/bc-gen', 'my-orders') }"
:style="isTabActive('/bc-gen', 'my-orders') ? 'background-color: #ffffff !important; color: #1976d2 !important;' : 'background-color: transparent !important;'"
          ></v-list-item>
          <v-list-item
            to="/bc-gen?tab=refunds"
            title="Refunds"
            prepend-icon="mdi-cash-refund"
            class="ml-2"
            :class="{ 'active-tab': isTabActive('/bc-gen', 'refunds') }"
:style="isTabActive('/bc-gen', 'refunds') ? 'background-color: #ffffff !important; color: #1976d2 !important;' : 'background-color: transparent !important;'"
          ></v-list-item>
          <v-list-item
            to="/bc-gen?tab=credits"
            title="Credits"
            prepend-icon="mdi-wallet"
            class="ml-2"
            :class="{ 'active-tab': isTabActive('/bc-gen', 'credits') }"
:style="isTabActive('/bc-gen', 'credits') ? 'background-color: #ffffff !important; color: #1976d2 !important;' : 'background-color: transparent !important;'"
          ></v-list-item>
        </v-list-group>

        <!-- Standalone items (Profile, Settings) -->
        <v-list-item
          v-for="item in visibleRoutes.filter(r => !r.requiresSubscription)"
          :key="`nav-${item.path}`"
          :to="item.path"
          :title="item.title"
          :prepend-icon="item.icon"
          :active="activeRoute === item.path || (item.path === '/profile' && activeRoute === '/')"
          rounded="lg"
        ></v-list-item>
      </v-list>
    </v-navigation-drawer>
    
    <!-- Main Content - Router View with improved padding -->
    <v-main class="main-content">
      <v-container fluid class="pa-6">
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

.main-content {
  background-color: var(--v-theme-background);
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
}

/* Hover effects for buttons in app bar */
.futuristic-app-bar .v-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
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
</style>