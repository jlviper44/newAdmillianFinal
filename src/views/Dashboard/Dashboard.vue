<template>
  <AuthGuard>
    <v-container fluid>
      <v-row>
        <v-col cols="12">
          <div class="d-flex justify-space-between align-center mb-6">
            <div>
              <h1 class="text-h4 font-weight-bold">
                <v-icon icon="mdi-view-dashboard" size="x-large" class="mr-2"></v-icon>
                Dashboard
              </h1>
              <p class="text-subtitle-1 text-grey-darken-1 mt-1">Analytics & management tools</p>
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
import { ref, onMounted, watch } from 'vue';
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

// Watch for route query changes
watch(() => route.query.tab, (newTab) => {
  if (newTab) {
    selectedTab.value = newTab;
  }
});

// Set initial tab from query parameter
onMounted(() => {
  if (route.query.tab) {
    selectedTab.value = route.query.tab;
  }
});
</script>

<style scoped>
</style>