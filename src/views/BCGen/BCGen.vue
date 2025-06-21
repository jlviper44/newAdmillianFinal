<script setup>
import { ref, onMounted } from 'vue';
import AuthGuard from '@/components/AuthGuard.vue';
import BCGenCredits from './components/BCGenCredits.vue';
import PlaceOrderView from './components/PlaceOrderView.vue';
import OrdersView from './components/OrdersView.vue';
import { usersApi } from '@/services/api';

// State management
const currentTab = ref('orders');
const loading = ref({
  credits: false
});
const error = ref({
  credits: null
});

// Credits data
const remainingCredits = ref(0);

// Fetch user's credit balance for BC Gen
const fetchCredits = async () => {
  loading.value.credits = true;
  error.value.credits = null;
  
  try {
    const data = await usersApi.checkAccess();
    
    // Get BC Gen specific credits
    const bcGenData = data.subscriptions?.bc_gen;
    remainingCredits.value = bcGenData?.totalCredits || 0;
    
    console.log('BC Gen credits:', remainingCredits.value);
  } catch (err) {
    error.value.credits = err.message || 'Failed to fetch credits';
    remainingCredits.value = 0;
  } finally {
    loading.value.credits = false;
  }
};

// Lifecycle hooks
onMounted(() => {
  fetchCredits();
});
</script>

<template>
  <AuthGuard>
    <v-container fluid class="pa-4">
      <v-row>
        <v-col cols="12">
          <div class="d-flex justify-space-between align-center mb-6">
            <div>
              <h1 class="text-h4 font-weight-bold">
                <v-icon icon="mdi-account-multiple-plus" size="x-large" class="mr-2"></v-icon>
                BC Gen
              </h1>
              <p class="text-subtitle-1 text-grey-darken-1 mt-1">Account creation system</p>
            </div>
          </div>
        </v-col>
      </v-row>

      <!-- Tabs -->
      <v-row>
        <v-col cols="12">
          <v-tabs v-model="currentTab" class="mb-6">
            <v-tab value="orders">Orders</v-tab>
            <v-tab value="my-orders">My Orders</v-tab>
            <v-tab value="credits">Credits</v-tab>
          </v-tabs>
        </v-col>
      </v-row>

      <!-- Tab Content -->
      <v-window v-model="currentTab">
        <!-- Orders Tab -->
        <v-window-item value="orders">
          <PlaceOrderView />
        </v-window-item>

        <!-- My Orders Tab -->
        <v-window-item value="my-orders">
          <OrdersView />
        </v-window-item>

        <!-- Overview Tab -->
        <v-window-item value="overview">
          <v-row>
            <v-col cols="12">
              <v-card elevation="2">
                <v-card-title class="d-flex align-center">
                  <v-icon start>mdi-information</v-icon>
                  BC Gen Overview
                  <v-spacer></v-spacer>
                  <v-chip 
                    color="primary" 
                    variant="elevated"
                    size="large"
                    @click="fetchCredits"
                  >
                    <v-icon start>mdi-wallet</v-icon>
                    <span class="font-weight-bold">{{ remainingCredits.toLocaleString() }} credits</span>
                    <v-icon 
                      end 
                      size="small"
                      :class="{ 'mdi-spin': loading.credits }"
                    >
                      mdi-refresh
                    </v-icon>
                  </v-chip>
                </v-card-title>
                <v-card-text>
                  <v-alert type="info" variant="tonal" class="mb-4">
                    BC Gen functionality is coming soon. This service will allow you to create accounts efficiently.
                  </v-alert>
                  
                  <div class="text-h6 mb-3">Features (Coming Soon)</div>
                  <v-list density="comfortable">
                    <v-list-item>
                      <template v-slot:prepend>
                        <v-icon color="primary">mdi-check-circle</v-icon>
                      </template>
                      <v-list-item-title>Bulk account creation</v-list-item-title>
                      <v-list-item-subtitle>Create multiple accounts quickly and efficiently</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <template v-slot:prepend>
                        <v-icon color="primary">mdi-check-circle</v-icon>
                      </template>
                      <v-list-item-title>Account management</v-list-item-title>
                      <v-list-item-subtitle>Manage and organize created accounts</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <template v-slot:prepend>
                        <v-icon color="primary">mdi-check-circle</v-icon>
                      </template>
                      <v-list-item-title>Profile customization</v-list-item-title>
                      <v-list-item-subtitle>Customize account profiles and settings</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <template v-slot:prepend>
                        <v-icon color="primary">mdi-check-circle</v-icon>
                      </template>
                      <v-list-item-title>Export accounts</v-list-item-title>
                      <v-list-item-subtitle>Export account data in various formats</v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-window-item>

        <!-- Credits Tab -->
        <v-window-item value="credits">
          <BCGenCredits />
        </v-window-item>
      </v-window>
    </v-container>
  </AuthGuard>
</template>

<style scoped>
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.mdi-spin {
  animation: spin 1s linear infinite;
}
</style>