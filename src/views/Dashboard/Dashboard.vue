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
        <!-- Sidebar Navigation -->
        <v-col cols="12" md="3">
          <v-card>
            <v-list nav>
              <v-list-item
                value="overview"
                :active="selectedTab === 'overview'"
                @click="selectedTab = 'overview'"
                prepend-icon="mdi-chart-line"
                title="Overview"
                rounded="lg"
              ></v-list-item>
              
              <v-list-item
                value="metrics"
                :active="selectedTab === 'metrics'"
                @click="selectedTab = 'metrics'"
                prepend-icon="mdi-chart-areaspline"
                title="Metrics"
                rounded="lg"
              ></v-list-item>
              
              <v-list-item
                value="sparks"
                :active="selectedTab === 'sparks'"
                @click="selectedTab = 'sparks'"
                prepend-icon="mdi-lightning-bolt"
                title="Sparks"
                rounded="lg"
              ></v-list-item>
              
              <v-list-item
                value="templates"
                :active="selectedTab === 'templates'"
                @click="selectedTab = 'templates'"
                prepend-icon="mdi-file-document-multiple"
                title="Templates"
                rounded="lg"
              ></v-list-item>
              
              <v-list-item
                value="shopify"
                :active="selectedTab === 'shopify'"
                @click="selectedTab = 'shopify'"
                prepend-icon="mdi-shopping"
                title="Shopify Stores"
                rounded="lg"
              ></v-list-item>
              
              <v-list-item
                value="campaigns"
                :active="selectedTab === 'campaigns'"
                @click="selectedTab = 'campaigns'"
                prepend-icon="mdi-bullhorn"
                title="Campaigns"
                rounded="lg"
              ></v-list-item>
              
              <v-list-item
                value="logs"
                :active="selectedTab === 'logs'"
                @click="selectedTab = 'logs'"
                prepend-icon="mdi-format-list-bulleted"
                title="Logs"
                rounded="lg"
              ></v-list-item>
            </v-list>
          </v-card>
        </v-col>
        
        <!-- Content Area -->
        <v-col cols="12" md="9">
          <v-card v-if="selectedTab === 'overview'">
            <v-card-title>Overview</v-card-title>
            <v-card-text>
              <!-- Overview content goes here -->
            </v-card-text>
          </v-card>
          
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
import { ref } from 'vue';
import AuthGuard from '@/components/AuthGuard.vue';
import MetricsView from './components/Metrics/MetricsView.vue';
import SparksView from './components/Sparks/SparksView.vue';
import TemplatesView from './components/Templates/TemplatesView.vue';
import ShopifyStoresView from './components/ShopifyStores/ShopifyStoresView.vue';
import CampaignsView from './components/Campaigns/CampaignsView.vue';
import LogsView from './components/Logs/LogsView.vue';

const selectedTab = ref('overview');
</script>

<style scoped>
</style>