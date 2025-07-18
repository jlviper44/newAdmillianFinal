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

      <v-row>
        <!-- Content Area -->
        <v-col cols="12">
          <!-- Metrics Tab -->
          <div v-if="selectedTab === 'metrics'">
            <MetricsView />
          </div>
          
          <!-- Sparks Tab -->
          <div v-if="selectedTab === 'sparks'">
            <SparksView />
          </div>
          
          <!-- Templates Tab -->
          <div v-if="selectedTab === 'templates'">
            <TemplatesView />
          </div>
          
          <!-- Shopify Stores Tab -->
          <div v-if="selectedTab === 'shopify'">
            <ShopifyStoresView />
          </div>
          
          <!-- Campaigns Tab -->
          <div v-if="selectedTab === 'campaigns'">
            <CampaignsView />
          </div>
          
          <!-- Logs Tab -->
          <div v-if="selectedTab === 'logs'">
            <LogsView />
          </div>
        </v-col>
      </v-row>
    </v-container>
  </AuthGuard>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import AuthGuard from '@/components/AuthGuard.vue';
import MetricsView from './components/Metrics/MetricsView.vue';
import SparksView from './components/Sparks/SparksView.vue';
import TemplatesView from './components/Templates/TemplatesView.vue';
import ShopifyStoresView from './components/ShopifyStores/ShopifyStoresView.vue';
import CampaignsView from './components/Campaigns/CampaignsView.vue';
import LogsView from './components/Logs/LogsView.vue';

const route = useRoute();
const selectedTab = ref('metrics');

// Tab titles mapping
const tabTitles = {
  metrics: 'Metrics',
  campaigns: 'Campaigns',
  sparks: 'Sparks',
  templates: 'Templates',
  shopify: 'Shopify Stores',
  logs: 'Logs'
};

// Computed property for current tab title
const currentTabTitle = computed(() => {
  return tabTitles[selectedTab.value] || 'Analytics & management tools';
});

// Watch for route query changes
watch(() => route.query.tab, (newTab) => {
  if (newTab) {
    selectedTab.value = newTab;
  }
}, { immediate: true });

// Set initial tab from query parameter
onMounted(() => {
  if (route.query.tab) {
    selectedTab.value = route.query.tab;
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