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
        </v-col>
      </v-row>
    </v-container>
  </AuthGuard>
</template>

<script setup>
import { ref } from 'vue';
import AuthGuard from '@/components/AuthGuard.vue';
import MetricsView from './components/Metrics/MetricsView.vue';

const selectedTab = ref('overview');
</script>

<style scoped>
</style>