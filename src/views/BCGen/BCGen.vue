<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import AuthGuard from '@/components/AuthGuard.vue';
import BCGenCredits from './components/BCGenCredits.vue';
import PlaceOrderView from './components/PlaceOrderView.vue';
import OrdersView from './components/OrdersView.vue';
import RefundsView from './components/RefundsView.vue';
import { usersApi } from '@/services/api';

// Component refs
const ordersViewRef = ref(null);
const refundsViewRef = ref(null);

// State management
const currentTab = ref('orders');
const route = useRoute();

// Tab titles mapping
const tabTitles = {
  orders: 'Place Order',
  'my-orders': 'My Orders',
  refunds: 'Refunds',
  credits: 'Credits'
};

// Computed property for current tab title
const currentTabTitle = computed(() => {
  return tabTitles[currentTab.value] || 'Account creation system';
});
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
    
  } catch (err) {
    error.value.credits = err.message || 'Failed to fetch credits';
    remainingCredits.value = 0;
  } finally {
    loading.value.credits = false;
  }
};

// Handle order creation
const handleOrderCreated = () => {
  // Switch to My Orders tab
  currentTab.value = 'my-orders';
  
  // Refresh the orders list
  if (ordersViewRef.value) {
    ordersViewRef.value.refreshOrders();
  }
  
  // Also refresh refunds view if it exists
  if (refundsViewRef.value) {
    refundsViewRef.value.refreshOrders();
  }
};

// Handle refund request
const handleRefundRequested = () => {
  // Refresh the refunds view
  if (refundsViewRef.value) {
    refundsViewRef.value.refreshOrders();
  }
};

// Watch for route query changes
watch(() => route.query.tab, (newTab) => {
  if (newTab && ['orders', 'my-orders', 'refunds', 'credits'].includes(newTab)) {
    currentTab.value = newTab;
  }
});

// Lifecycle hooks
onMounted(() => {
  fetchCredits();
  
  // Set initial tab from query parameter
  if (route.query.tab && ['orders', 'my-orders', 'refunds', 'credits'].includes(route.query.tab)) {
    currentTab.value = route.query.tab;
  } else if (route.query.showCredits === 'true') {
    currentTab.value = 'credits';
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
});
</script>

<template>
  <AuthGuard>
    <v-container fluid :class="{ 'pa-2': $vuetify.display.smAndDown }">
      <!-- Mobile Header -->
      <v-row v-if="$vuetify.display.smAndDown">
        <v-col cols="12" class="pb-2">
          <div class="text-center">
            <h2 class="text-h6 font-weight-bold">BC Gen</h2>
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
                <v-icon icon="mdi-account-multiple-plus" size="x-large" class="mr-2"></v-icon>
                BC Gen
              </h1>
              <p class="text-subtitle-1 text-grey-darken-1 mt-1">{{ currentTabTitle }}</p>
            </div>
          </div>
        </v-col>
      </v-row>

      <v-row>
        <!-- Content Area -->
        <v-col cols="12">
          <!-- Place Order Tab -->
          <div v-if="currentTab === 'orders'">
            <PlaceOrderView @orderCreated="handleOrderCreated" />
          </div>

          <!-- My Orders Tab -->
          <div v-if="currentTab === 'my-orders'">
            <OrdersView ref="ordersViewRef" @refund-requested="handleRefundRequested" />
          </div>

          <!-- Refunds Tab -->
          <div v-if="currentTab === 'refunds'">
            <RefundsView ref="refundsViewRef" />
          </div>

          <!-- Credits Tab -->
          <div v-if="currentTab === 'credits'">
            <BCGenCredits />
          </div>
        </v-col>
      </v-row>
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

.tab-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.v-theme--dark .tab-header {
  border-bottom-color: rgba(255, 255, 255, 0.12);
}

.tab-content {
  min-height: 500px;
}

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

/* Tab Content */
.v-tab-content {
  min-height: 400px;
}

@media (max-width: 768px) {
  .v-tab-content {
    min-height: 300px;
  }
}
</style>