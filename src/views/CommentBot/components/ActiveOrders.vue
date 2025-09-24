<script setup>
import { ref, computed, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { formatDateTime } from '@/utils/dateFormatter';

const { user } = useAuth();

const props = defineProps({
  orders: {
    type: Array,
    default: () => []
  },
  orderProgress: {
    type: Object,
    default: () => ({})
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['poll-status', 'refresh']);

// Pagination state
const page = ref(1);
const itemsPerPage = ref(10);

// Show creator column if user is part of a team
const showCreator = computed(() => {
  return user.value?.team != null;
});

// Helper function to get detailed status info
const getOrderStatusDetails = (order) => {
  // If status is NOT completed, show Processing
  if (order.status !== 'completed') {
    return {
      status: 'processing',
      color: 'info',
      message: 'Processing'
    };
  }
  
  // Status is completed - compute based on progress data
  const progress = props.orderProgress[order.order_id];
  
  // Debug log to see what we're receiving
  console.log(`Computing status for order ${order.order_id}:`, {
    hasProgress: !!progress,
    progressData: progress,
    like: progress?.like,
    save: progress?.save,
    comment: progress?.comment
  });
  
  // If no progress data available, show as completed
  if (!progress || (!progress.like && !progress.save && !progress.comment)) {
    console.log(`No progress data for ${order.order_id}, showing as Completed`);
    return {
      status: 'completed',
      color: 'success',
      message: 'Completed'
    };
  }
  
  // Calculate totals across all interaction types
  let totalRequested = 0;
  let totalCompleted = 0;
  let totalFailed = 0;
  
  ['like', 'save', 'comment'].forEach(type => {
    if (progress[type] && progress[type].total > 0) {
      totalRequested += progress[type].total;
      totalCompleted += (progress[type].completed || 0);
      totalFailed += (progress[type].failed || 0);
      console.log(`  ${type}: total=${progress[type].total}, completed=${progress[type].completed}, failed=${progress[type].failed}`);
    }
  });
  
  console.log(`Totals for ${order.order_id}: requested=${totalRequested}, completed=${totalCompleted}, failed=${totalFailed}`);
  
  // If no activity was requested, show as completed
  if (totalRequested === 0) {
    console.log(`No activity requested for ${order.order_id}, showing as Completed`);
    return {
      status: 'completed',
      color: 'success', 
      message: 'Completed'
    };
  }
  
  // Determine success/failure based on results
  if (totalCompleted === 0 && totalFailed > 0) {
    // Everything failed
    console.log(`Everything failed for ${order.order_id}, showing as Failed`);
    return {
      status: 'failed',
      color: 'error',
      message: 'Failed'
    };
  } else if (totalFailed === 0 && totalCompleted > 0) {
    // Everything succeeded
    return {
      status: 'completed',
      color: 'success',
      message: 'Completed'
    };
  } else if (totalFailed > 0 && totalCompleted > 0) {
    // Mixed results
    const successRate = Math.round((totalCompleted / totalRequested) * 100);
    if (successRate < 50) {
      return {
        status: 'mostly_failed',
        color: 'deep-orange',
        message: `Partial (${successRate}% success)`
      };
    } else {
      return {
        status: 'completed_with_errors',
        color: 'orange',
        message: `Completed (${successRate}% success)`
      };
    }
  }
  
  // Default: completed
  return {
    status: 'completed',
    color: 'success',
    message: 'Completed'
  };
};

const getStatusColor = (status) => {
  switch(status) {
    case 'completed': return 'success';
    case 'processing': return 'info';
    case 'failed': return 'error';
    case 'partial': return 'warning';
    case 'completed_with_errors': return 'orange';
    default: return 'warning';
  }
};

// Computed properties
const hasActiveOrders = computed(() => {
  return props.orders && props.orders.length > 0;
});

const totalPages = computed(() => {
  return Math.ceil(props.orders.length / itemsPerPage.value);
});

const paginatedOrders = computed(() => {
  const start = (page.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return props.orders.slice(start, end);
});

// Watch for new orders to start polling their status
watch(() => props.orders, (newOrders) => {
  if (newOrders && newOrders.length > 0) {
    newOrders.forEach(order => {
      if (
        order.status !== 'completed' && 
        order.status !== 'failed' && 
        order.status !== 'canceled'
      ) {
        emit('poll-status', order.order_id);
      }
    });
  }
}, { deep: true });

// Reset to first page when orders change significantly
watch(() => props.orders.length, () => {
  if (page.value > totalPages.value && totalPages.value > 0) {
    page.value = totalPages.value;
  }
});

// formatDateTime is now imported from utils/dateFormatter
</script>

<template>
  <v-card class="elevation-1 rounded-lg">
    <v-card-title class="d-flex align-center justify-space-between">
      <div class="d-flex align-center">
        <v-icon icon="mdi-clock-outline" color="primary" class="mr-2"></v-icon>
        <span class="text-h6">Active Orders</span>
      </div>

      <v-btn
        icon
        variant="text"
        size="small"
        @click="emit('refresh')"
        :loading="props.loading"
      >
        <v-icon>mdi-refresh</v-icon>
      </v-btn>
    </v-card-title>

    <v-card-text>
    <!-- Empty State -->
    <div v-if="!hasActiveOrders" class="text-center py-8">
      <v-icon size="x-large" color="grey-lighten-1" class="mb-2">mdi-emoticon-neutral-outline</v-icon>
      <div class="text-body-1 text-medium-emphasis">No active orders</div>
      <div class="text-caption text-medium-emphasis">Create an order to start the bot</div>
    </div>
    
    <!-- Mobile Card Layout -->
    <div v-if="hasActiveOrders && $vuetify.display.smAndDown" class="mobile-orders">
      <v-card 
        v-for="order in paginatedOrders" 
        :key="order.order_id"
        class="mb-3 order-card"
        variant="outlined"
      >
        <v-card-text class="pb-2">
          <!-- Order Header -->
          <div class="d-flex justify-space-between align-center mb-2">
            <div class="d-flex align-center">
              <v-chip
                size="small"
                :color="getOrderStatusDetails(order).color"
                class="mr-2"
              >
                {{ getOrderStatusDetails(order).message }}
              </v-chip>
              <span class="text-caption text-medium-emphasis">
                {{ formatDateTime(order.created_at) }}
              </span>
            </div>
          </div>

          <!-- Order Details -->
          <div class="order-details">
            <div class="detail-row">
              <span class="text-caption text-medium-emphasis">Order ID:</span>
              <span class="text-caption font-weight-medium">{{ order.order_id.slice(0, 8) }}...</span>
            </div>
            
            <div class="detail-row">
              <span class="text-caption text-medium-emphasis">Post ID:</span>
              <span class="text-caption font-weight-medium">{{ order.post_id }}</span>
            </div>

            <div v-if="showCreator && order.creator" class="detail-row">
              <span class="text-caption text-medium-emphasis">Created by:</span>
              <span class="text-caption font-weight-medium">{{ order.creator.name }}</span>
            </div>
          </div>

          <!-- Progress -->
          <div class="mt-3">
            <div class="d-flex justify-space-between align-center mb-1">
              <span class="text-caption">Progress</span>
              <span class="text-caption font-weight-medium">
                {{ orderProgress[order.order_id]?.overall || 0 }}%
              </span>
            </div>
            <v-progress-linear
              :model-value="orderProgress[order.order_id]?.overall || 0"
              :color="getOrderStatusDetails(order).color"
              height="6"
              rounded
            ></v-progress-linear>
            
            <!-- Progress Details -->
            <div v-if="orderProgress[order.order_id]" class="mt-2 text-caption">
              <div v-if="orderProgress[order.order_id].comment" class="d-flex justify-space-between">
                <span>Comments:</span>
                <span>
                  {{ orderProgress[order.order_id].comment.completed }}/{{ orderProgress[order.order_id].comment.total }}
                  <span v-if="orderProgress[order.order_id].comment.failed > 0" class="text-error">
                    ({{ orderProgress[order.order_id].comment.failed }} failed)
                  </span>
                </span>
              </div>
              <div v-if="orderProgress[order.order_id].like" class="d-flex justify-space-between">
                <span>Likes:</span>
                <span>
                  {{ orderProgress[order.order_id].like.completed }}/{{ orderProgress[order.order_id].like.total }}
                  <span v-if="orderProgress[order.order_id].like.failed > 0" class="text-error">
                    ({{ orderProgress[order.order_id].like.failed }} failed)
                  </span>
                </span>
              </div>
              <div v-if="orderProgress[order.order_id].save" class="d-flex justify-space-between">
                <span>Saves:</span>
                <span>
                  {{ orderProgress[order.order_id].save.completed }}/{{ orderProgress[order.order_id].save.total }}
                  <span v-if="orderProgress[order.order_id].save.failed > 0" class="text-error">
                    ({{ orderProgress[order.order_id].save.failed }} failed)
                  </span>
                </span>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <!-- Mobile Pagination -->
      <div v-if="totalPages > 1" class="text-center mt-4">
        <v-pagination
          v-model="page"
          :length="totalPages"
          :total-visible="5"
          size="small"
          density="comfortable"
        ></v-pagination>
      </div>
    </div>
    
    <!-- Desktop Table Layout -->
    <div v-if="hasActiveOrders && !$vuetify.display.smAndDown">
        <v-table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Post ID</th>
            <th v-if="showCreator">Created By</th>
            <th>Status</th>
            <th>Progress</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in paginatedOrders" :key="order.order_id">
            <td class="text-caption">{{ order.order_id }}</td>
            <td class="text-caption">{{ order.post_id }}</td>
            <td v-if="showCreator">
              <div v-if="order.creator" class="d-flex align-center">
                <v-icon size="small" class="mr-1">mdi-account</v-icon>
                <span class="text-caption">{{ order.creator.name }}</span>
              </div>
              <span v-else class="text-caption text-disabled">Unknown</span>
            </td>
            <td>
              <v-chip
                size="small"
                :color="getOrderStatusDetails(order).color"
              >
                {{ getOrderStatusDetails(order).message }}
              </v-chip>
            </td>
            <td>
              <v-tooltip bottom v-if="orderProgress[order.order_id]">
                <template v-slot:activator="{ props }">
                  <div v-bind="props">
                    <v-progress-linear
                      v-if="orderProgress[order.order_id] && orderProgress[order.order_id].overall"
                      :model-value="orderProgress[order.order_id].overall"
                      :color="getOrderStatusDetails(order).color"
                      height="8"
                      rounded
                    ></v-progress-linear>
                    <div v-else class="text-caption text-medium-emphasis">
                      {{ order.status === 'completed' ? '100%' : 'Loading...' }}
                    </div>
                  </div>
                </template>
                <div v-if="orderProgress[order.order_id]">
                  <div v-if="orderProgress[order.order_id].comment">
                    Comments: {{ orderProgress[order.order_id].comment.completed }}/{{ orderProgress[order.order_id].comment.total }}
                    ({{ orderProgress[order.order_id].comment.percent }}%)
                    <span v-if="orderProgress[order.order_id].comment.failed > 0" class="text-error">
                      - {{ orderProgress[order.order_id].comment.failed }} failed
                    </span>
                  </div>
                  <div v-if="orderProgress[order.order_id].like">
                    Likes: {{ orderProgress[order.order_id].like.completed }}/{{ orderProgress[order.order_id].like.total }}
                    ({{ orderProgress[order.order_id].like.percent }}%)
                    <span v-if="orderProgress[order.order_id].like.failed > 0" class="text-error">
                      - {{ orderProgress[order.order_id].like.failed }} failed
                    </span>
                  </div>
                  <div v-if="orderProgress[order.order_id].save">
                    Saves: {{ orderProgress[order.order_id].save.completed }}/{{ orderProgress[order.order_id].save.total }}
                    ({{ orderProgress[order.order_id].save.percent }}%)
                    <span v-if="orderProgress[order.order_id].save.failed > 0" class="text-error">
                      - {{ orderProgress[order.order_id].save.failed }} failed
                    </span>
                  </div>
                </div>
              </v-tooltip>
              <div v-else class="text-caption text-medium-emphasis">
                {{ order.status === 'completed' ? '100%' : 'Loading...' }}
              </div>
            </td>
            <td>{{ formatDateTime(order.created_at) }}</td>
          </tr>
        </tbody>
      </v-table>
      
      <!-- Pagination -->
      <div v-if="totalPages > 1" class="d-flex align-center justify-space-between mt-4">
        <div class="text-caption text-medium-emphasis">
          Showing {{ (page - 1) * itemsPerPage + 1 }} - {{ Math.min(page * itemsPerPage, orders.length) }} of {{ orders.length }} orders
        </div>
        <v-pagination
          v-model="page"
          :length="totalPages"
          :total-visible="7"
          density="compact"
          rounded="circle"
        ></v-pagination>
      </div>
    </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.mobile-orders {
  max-width: 100%;
}

.order-card {
  transition: all 0.2s ease;
  border-radius: 12px !important;
}

.order-card:active {
  transform: scale(0.98);
}

.order-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 0;
}

@media (max-width: 600px) {
  .order-card {
    margin-bottom: 8px !important;
  }
  
  .v-card__text {
    padding: 12px !important;
  }
}
</style>