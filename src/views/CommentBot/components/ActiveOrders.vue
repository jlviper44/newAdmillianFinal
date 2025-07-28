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
  }
});

const emit = defineEmits(['poll-status']);

// Pagination state
const page = ref(1);
const itemsPerPage = ref(10);

// Show creator column if user is part of a team
const showCreator = computed(() => {
  return user.value?.team != null;
});

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
  <div>
    <!-- Empty State -->
    <div v-if="!hasActiveOrders" class="text-center py-8">
      <v-icon size="x-large" color="grey-lighten-1" class="mb-2">mdi-emoticon-neutral-outline</v-icon>
      <div class="text-body-1 text-medium-emphasis">No active orders</div>
      <div class="text-caption text-medium-emphasis">Create an order to start the bot</div>
    </div>
    
    <!-- Mobile Card Layout -->
    <div v-else-if="$vuetify.display.smAndDown" class="mobile-orders">
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
                :color="
                  order.status === 'completed' ? 'success' :
                  order.status === 'processing' ? 'info' :
                  order.status === 'failed' ? 'error' : 'warning'
                "
                class="mr-2"
              >
                {{ order.status }}
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
              :color="
                order.status === 'completed' ? 'success' :
                order.status === 'processing' ? 'info' :
                order.status === 'failed' ? 'error' : 'warning'
              "
              height="6"
              rounded
            ></v-progress-linear>
            
            <!-- Progress Details -->
            <div v-if="orderProgress[order.order_id]" class="mt-2 text-caption">
              <div v-if="orderProgress[order.order_id].comment" class="d-flex justify-space-between">
                <span>Comments:</span>
                <span>{{ orderProgress[order.order_id].comment.completed }}/{{ orderProgress[order.order_id].comment.total }}</span>
              </div>
              <div v-if="order.like_count > 0" class="d-flex justify-space-between">
                <span>Likes:</span>
                <span>{{ order.like_count }}</span>
              </div>
              <div v-if="order.save_count > 0" class="d-flex justify-space-between">
                <span>Saves:</span>
                <span>{{ order.save_count }}</span>
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
    <v-card v-else>
      <v-card-title>
        <v-icon class="me-2">mdi-format-list-checks</v-icon>
        Active Orders
      </v-card-title>
      
      <v-card-text>
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
                :color="
                  order.status === 'completed' ? 'success' :
                  order.status === 'processing' ? 'info' :
                  order.status === 'failed' ? 'error' : 'warning'
                "
              >
                {{ order.status }}
              </v-chip>
            </td>
            <td>
              <v-tooltip bottom v-if="orderProgress[order.order_id]">
                <template v-slot:activator="{ props }">
                  <div v-bind="props">
                    <v-progress-linear
                      v-if="orderProgress[order.order_id] && orderProgress[order.order_id].overall"
                      :model-value="orderProgress[order.order_id].overall"
                      :color="
                        order.status === 'completed' ? 'success' :
                        order.status === 'processing' ? 'info' :
                        order.status === 'failed' ? 'error' : 'warning'
                      "
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
                  </div>
                  <div v-if="order.like_count > 0">
                    Likes: {{ order.like_count }}
                  </div>
                  <div v-if="order.save_count > 0">
                    Saves: {{ order.save_count }}
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
    </v-card-text>
    </v-card>
  </div>
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