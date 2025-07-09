<script setup>
import { ref, computed, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';

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

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString();
};
</script>

<template>
  <v-card>
    <v-card-title>
      <v-icon class="me-2">mdi-format-list-checks</v-icon>
      Active Orders
    </v-card-title>
    
    <v-card-text>
      <div v-if="!hasActiveOrders" class="text-center py-4">
        <v-icon size="large" color="grey-lighten-1" class="mb-2">mdi-emoticon-neutral-outline</v-icon>
        <div class="text-body-1 text-medium-emphasis">No active orders</div>
        <div class="text-caption text-medium-emphasis">Create an order to start the bot</div>
      </div>
      
      <v-table v-else>
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
            <td>{{ formatDate(order.created_at) }}</td>
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
</template>