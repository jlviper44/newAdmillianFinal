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
const { initAuth, isAuthenticated, hasCommentBotAccess, hasBcGenAccess } = useAuth();

// All routes
const allRoutes = [
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
    <!-- App Bar with improved styling and dark mode toggle -->
    <v-app-bar
      v-if="isAuthenticated"
      elevation="2"
      :color="isDarkMode ? 'surface' : 'primary'"
      :class="{ 'text-white': !isDarkMode, 'border-b': isDarkMode }"
    >
      <!-- Menu toggle for responsive design -->
      <v-app-bar-nav-icon 
        @click="toggleDrawer"
      ></v-app-bar-nav-icon>
      
      <v-app-bar-title class="font-weight-bold">
        Millian AI
      </v-app-bar-title>
      
      <v-spacer></v-spacer>
      
      <!-- User Menu -->
      <UserMenu />
      
      <!-- Dark Mode Toggle -->
      <v-btn icon @click="toggleDarkMode" class="mx-1">
        <v-icon>{{ isDarkMode ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
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
      <v-list nav>
        <v-list-item
          v-for="(item, i) in visibleRoutes"
          :key="`nav-${item.path}`"
          :to="item.path"
          :title="item.title"
          :prepend-icon="item.icon"
          :active="activeRoute === item.path || (item.path === '/profile' && activeRoute === '/')"
          :class="{ 'bg-primary-lighten-5': (activeRoute === item.path || (item.path === '/profile' && activeRoute === '/')) && !isDarkMode,
                    'bg-primary-darken-3': (activeRoute === item.path || (item.path === '/profile' && activeRoute === '/')) && isDarkMode }"
          rounded="lg"
          class="mb-1"
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
</style>