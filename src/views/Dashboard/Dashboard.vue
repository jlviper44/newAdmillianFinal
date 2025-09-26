<template>
  <AuthGuard>
    <v-container fluid :class="{ 'pa-2': $vuetify.display.smAndDown }">
      <!-- Mobile Header -->
      <v-row v-if="$vuetify.display.smAndDown">
        <v-col cols="12" class="pb-2">
          <div class="text-center">
            <h2 class="text-h6 font-weight-bold">Dashboard</h2>
            <p class="text-caption text-grey-darken-1">{{ currentTabTitle }}</p>
          </div>
        </v-col>
      </v-row>

      <!-- Desktop Header -->
      <v-row v-else>
        <v-col cols="12">
          <div class="d-flex justify-space-between align-center mb-6">
            <div>
              <h1 class="text-h4 font-weight-bold">
                <v-icon icon="mdi-view-dashboard" size="x-large" class="mr-2"></v-icon>
                Dashboard
              </h1>
              <p class="text-subtitle-1 text-grey-darken-1 mt-1">{{ currentTabTitle }}</p>
            </div>
          </div>
        </v-col>
      </v-row>

      <!-- No Permission Message -->
      <v-row v-if="!hasAnyTabPermission">
        <v-col cols="12">
          <v-alert
            type="warning"
            variant="tonal"
            class="mt-4"
          >
            <v-alert-title>No Dashboard Access</v-alert-title>
            You do not have permission to access any Dashboard tabs. Please contact your administrator to request access.
          </v-alert>
        </v-col>
      </v-row>

      <v-row>
        <!-- Content Area -->
        <v-col cols="12">
          <!-- Metrics Tab (Check permissions for VAs) -->
          <div v-if="selectedTab === 'metrics' && canViewMetrics">
            <MetricsView />
          </div>
          
          <!-- Campaigns Tab (Check permissions for VAs) -->
          <div v-if="selectedTab === 'campaigns' && canViewCampaigns">
            <CampaignsView />
          </div>
          
          <!-- Ad Launches Tab (Check permissions for VAs) -->
          <div v-if="selectedTab === 'launches' && canViewLaunches">
            <AdLaunchesView />
          </div>
          

          <!-- Sparks Tab (Check permissions for VAs) -->
          <div v-if="selectedTab === 'newsparks' && canViewSparks">
            <NewSparksView />
          </div>
          
          <!-- Templates Tab (Check permissions for VAs) -->
          <div v-if="selectedTab === 'templates' && canViewTemplates">
            <TemplatesView />
          </div>
          
          <!-- Shopify Stores Tab (Check permissions for VAs) -->
          <div v-if="selectedTab === 'shopify' && canViewShopify">
            <ShopifyStoresView />
          </div>
          
          <!-- Logs Tab (Check permissions for VAs) -->
          <div v-if="selectedTab === 'logs' && canViewLogs">
            <LogsView />
          </div>
          
          <!-- Link Splitter Tab (Check permissions for VAs) -->
          <div v-if="selectedTab === 'linksplitter' && canViewLinkSplitter">
            <LinkSplitterView />
          </div>

          <!-- Error Logs Tab (Admin Only) -->
          <div v-if="selectedTab === 'errorlogs' && isAdmin">
            <ErrorLogsView />
          </div>

          <!-- Permission Denied Message -->
          <v-alert
            v-if="!hasTabPermission(selectedTab)"
            type="warning"
            variant="tonal"
            class="mt-4"
          >
            <v-alert-title>Access Denied</v-alert-title>
            You do not have permission to view this tab. Please contact your administrator.
          </v-alert>
        </v-col>
      </v-row>
    </v-container>
  </AuthGuard>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import AuthGuard from '@/components/AuthGuard.vue';
import MetricsView from './components/Metrics/MetricsView.vue';
import NewSparksView from './components/NewSparks/NewSparksView.vue';
import TemplatesView from './components/Templates/TemplatesView.vue';
import ShopifyStoresView from './components/ShopifyStores/ShopifyStoresView.vue';
import CampaignsView from './components/Campaigns/CampaignsView.vue';
import AdLaunchesView from './components/AdLaunches/AdLaunchesView.vue';
import LogsView from './components/Logs/LogsView.vue';
import LinkSplitterView from './components/LinkSplitter/LinkSplitter.vue';
import ErrorLogsView from './components/ErrorLogs/ErrorLogsView.vue';

const route = useRoute();
const router = useRouter();
const { user, checkAccess } = useAuth();
const selectedTab = ref('metrics');

// Tab titles mapping
const tabTitles = {
  metrics: 'Metrics',
  campaigns: 'Campaigns',
  launches: 'Ad Launches',
  newsparks: 'Sparks',
  templates: 'Templates',
  shopify: 'Shopify Stores',
  logs: 'Logs',
  linksplitter: 'Link Splitter',
  errorlogs: 'Error Logs'
};

// Computed property for current tab title
const currentTabTitle = computed(() => {
  return tabTitles[selectedTab.value] || 'Analytics & management tools';
});

// Permission checks for Virtual Assistants
const canViewMetrics = computed(() => {
  if (!user.value?.isVirtualAssistant) return true;
  return user.value?.vaPermissions?.dashboardMetrics === true;
});

const canViewCampaigns = computed(() => {
  if (!user.value?.isVirtualAssistant) return true;
  return user.value?.vaPermissions?.dashboardCampaigns === true;
});

const canViewLaunches = computed(() => {
  if (!user.value?.isVirtualAssistant) return true;
  return user.value?.vaPermissions?.dashboardLaunches === true;
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

// Admin check for Error Logs
const isAdmin = computed(() => {
  // Check both role and isAdmin properties
  return user.value?.role === 'admin' || user.value?.isAdmin === true;
});

// Helper function to check if user has permission for a tab
const hasTabPermission = (tab) => {
  if (!user.value?.isVirtualAssistant) return true;

  switch(tab) {
    case 'metrics': return canViewMetrics.value;
    case 'campaigns': return canViewCampaigns.value;
    case 'launches': return canViewLaunches.value;
    case 'newsparks': return canViewSparks.value;
    case 'templates': return canViewTemplates.value;
    case 'shopify': return canViewShopify.value;
    case 'logs': return canViewLogs.value;
    case 'linksplitter': return canViewLinkSplitter.value;
    case 'errorlogs': return isAdmin.value;
    default: return false;
  }
};

// Check if VA has permission to view any tab
const hasAnyTabPermission = computed(() => {
  if (!user.value?.isVirtualAssistant) return true;
  
  return canViewMetrics.value ||
         canViewCampaigns.value ||
         canViewLaunches.value ||
         canViewSparks.value ||
         canViewTemplates.value ||
         canViewShopify.value ||
         canViewLogs.value ||
         canViewLinkSplitter.value ||
         isAdmin.value;
});

// Find the first tab that the user has permission to view
const getDefaultTab = () => {
  const tabs = ['campaigns', 'launches', 'newsparks', 'templates', 'shopify', 'metrics', 'logs', 'linksplitter', 'errorlogs'];
  for (const tab of tabs) {
    if (hasTabPermission(tab)) {
      return tab;
    }
  }
  return 'campaigns'; // Fallback
};

// Watch for route query changes
watch(() => route.query.tab, (newTab) => {
  if (newTab) {
    // Check if user has permission for the requested tab
    if (!hasTabPermission(newTab)) {
      selectedTab.value = getDefaultTab();
      // Update the URL to reflect the permitted tab
      router.replace({ query: { tab: selectedTab.value } });
    } else {
      selectedTab.value = newTab;
    }
  }
}, { immediate: true });

// Watch for tab selection changes and update the route
watch(() => selectedTab.value, (newTab) => {
  if (newTab && route.query.tab !== newTab) {
    router.replace({ query: { tab: newTab } });
  }
});

// Set initial tab from query parameter
onMounted(async () => {
  // Note: checkAccess is already called by initAuth in App.vue, no need to call again
  
  // Debug: Log VA permissions if it's a VA
  if (user.value?.isVirtualAssistant) {
    console.log('VA Dashboard Permissions:', {
      isVA: user.value.isVirtualAssistant,
      assistingFor: user.value.assistingFor,
      vaPermissions: user.value.vaPermissions,
      hasDashboardAccess: user.value.vaPermissions?.hasDashboardAccess,
      dashboardTabs: {
        metrics: user.value.vaPermissions?.dashboardMetrics,
        campaigns: user.value.vaPermissions?.dashboardCampaigns,
        launches: user.value.vaPermissions?.dashboardLaunches,
        templates: user.value.vaPermissions?.dashboardTemplates,
        shopify: user.value.vaPermissions?.dashboardShopify,
        logs: user.value.vaPermissions?.dashboardLogs,
        linkSplitter: user.value.vaPermissions?.dashboardLinkSplitter
      }
    });
  }
  
  if (route.query.tab) {
    // Check if user has permission for the requested tab
    if (!hasTabPermission(route.query.tab)) {
      selectedTab.value = getDefaultTab();
    } else {
      selectedTab.value = route.query.tab;
    }
  } else {
    // Default to first permitted tab
    selectedTab.value = getDefaultTab();
  }
});
</script>

<style scoped>
/* Mobile optimizations */
@media (max-width: 600px) {
  .v-card {
    margin-bottom: 12px !important;
  }
  
  .v-card-title {
    padding: 12px !important;
    font-size: 1rem !important;
  }
  
  .v-card-text {
    padding: 12px !important;
  }
  
  .text-h6 {
    font-size: 1rem !important;
  }
  
  .v-chip {
    height: auto !important;
    padding: 4px 8px !important;
  }
}
</style>