<template>
  <div>
    <!-- Statistics Cards -->
    <v-row class="mb-6">
      <v-col cols="12" sm="6" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-subtitle-2 text-grey-darken-1">Total Orders</p>
                <p class="text-h4 font-weight-bold">{{ stats.totalOrders.toLocaleString() }}</p>
              </div>
              <v-icon size="40" color="primary">mdi-comment-multiple</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-subtitle-2 text-grey-darken-1">Completed</p>
                <p class="text-h4 font-weight-bold">{{ stats.completedOrders.toLocaleString() }}</p>
              </div>
              <v-icon size="40" color="success">mdi-check-circle</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-subtitle-2 text-grey-darken-1">Failed</p>
                <p class="text-h4 font-weight-bold">{{ stats.failedOrders.toLocaleString() }}</p>
              </div>
              <v-icon size="40" color="error">mdi-alert-circle</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-subtitle-2 text-grey-darken-1">Active</p>
                <p class="text-h4 font-weight-bold">{{ stats.activeOrders.toLocaleString() }}</p>
              </div>
              <v-icon size="40" color="info">mdi-progress-clock</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Filters -->
    <v-card class="mb-6">
      <v-card-title>Filters</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model="filters.search"
              label="Search"
              placeholder="Order ID, Post ID, User..."
              density="compact"
              variant="outlined"
              clearable
              @keyup.enter="applyFilters"
            ></v-text-field>
          </v-col>

          <v-col cols="12" sm="6" md="3">
            <v-select
              v-model="filters.status"
              :items="statusOptions"
              label="Status"
              density="compact"
              variant="outlined"
            ></v-select>
          </v-col>

          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model="filters.startDate"
              label="Start Date"
              type="date"
              density="compact"
              variant="outlined"
            ></v-text-field>
          </v-col>

          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model="filters.endDate"
              label="End Date"
              type="date"
              density="compact"
              variant="outlined"
            ></v-text-field>
          </v-col>

          <v-col cols="12" sm="6" md="3" class="d-flex align-center gap-2">
            <v-btn 
              color="primary" 
              @click="applyFilters"
              prepend-icon="mdi-filter"
            >
              Apply
            </v-btn>
            <v-btn 
              variant="outlined" 
              @click="resetFilters"
              icon="mdi-refresh"
            ></v-btn>
          </v-col>
        </v-row>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-actions class="justify-space-between">
        <div class="text-subtitle-2">{{ totalLogs.toLocaleString() }} logs found</div>
        <v-btn 
          color="success" 
          variant="outlined"
          prepend-icon="mdi-download"
          @click="exportLogs"
        >
          Export CSV
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Logs Table -->
    <v-card>
      <v-card-text v-if="!loading && logs.length === 0" class="text-center py-8">
        <v-icon size="64" color="grey-lighten-1">mdi-file-document-outline</v-icon>
        <p class="text-h6 mt-4">No orders found</p>
        <p class="text-subtitle-1 text-grey-darken-1">Orders will appear here once they are created</p>
      </v-card-text>
      
      <v-data-table
        v-if="loading || logs.length > 0"
        :headers="headers"
        :items="logs"
        :loading="loading"
        :items-per-page="itemsPerPage"
        :page="currentPage"
        @update:page="currentPage = $event"
        @update:items-per-page="itemsPerPage = $event"
        class="elevation-1"
      >
        <template v-slot:item.created_at="{ item }">
          {{ formatDateTime(item.created_at) }}
        </template>

        <template v-slot:item.status="{ item }">
          <v-chip 
            :color="getStatusColor(item.status)" 
            size="small"
          >
            {{ item.status }}
          </v-chip>
        </template>

        <template v-slot:item.user="{ item }">
          {{ item.user_email || item.user_id || 'Unknown' }}
        </template>

        <template v-slot:item.actions="{ item }">
          <v-btn 
            icon 
            size="small" 
            variant="text"
            @click="viewLogDetail(item)"
          >
            <v-icon>mdi-eye</v-icon>
          </v-btn>
        </template>
      </v-data-table>
    </v-card>

    <!-- Log Detail Dialog -->
    <v-dialog v-model="showDetailDialog" max-width="800px">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center">
          <span>Order Details</span>
          <v-btn 
            icon 
            variant="text" 
            @click="showDetailDialog = false"
          >
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        
        <v-card-text v-if="selectedLog">
          <v-row>
            <v-col cols="6">
              <strong>Order ID:</strong> {{ selectedLog.order_id }}
            </v-col>
            <v-col cols="6">
              <strong>Post ID:</strong> {{ selectedLog.post_id }}
            </v-col>
            <v-col cols="6">
              <strong>Status:</strong> 
              <v-chip :color="getStatusColor(selectedLog.status)" size="small">
                {{ selectedLog.status }}
              </v-chip>
            </v-col>
            <v-col cols="6">
              <strong>Created:</strong> {{ formatDateTime(selectedLog.created_at) }}
            </v-col>
            <v-col cols="6">
              <strong>User:</strong> {{ selectedLog.user_email || selectedLog.user_id || 'Unknown' }}
            </v-col>
            <v-col cols="6">
              <strong>Team:</strong> {{ selectedLog.team_id || 'None' }}
            </v-col>
            <v-col cols="6">
              <strong>Like Count:</strong> {{ selectedLog.like_count || 0 }}
            </v-col>
            <v-col cols="6">
              <strong>Save Count:</strong> {{ selectedLog.save_count || 0 }}
            </v-col>
            <v-col cols="12" v-if="selectedLog.message">
              <strong>Message:</strong>
              <v-alert type="info" variant="tonal" class="mt-2">
                {{ selectedLog.message }}
              </v-alert>
            </v-col>
            <v-col cols="12" v-if="selectedLog.comment_group_name">
              <strong>Comment Group:</strong> {{ selectedLog.comment_group_name }}
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { commentBotApi } from '@/services/api';
import { formatDateTime } from '@/utils/dateFormatter';

// State
const loading = ref(false);
const logs = ref([]);
const stats = ref({
  totalOrders: 0,
  completedOrders: 0,
  failedOrders: 0,
  activeOrders: 0
});

// Filters
const filters = ref({
  search: '',
  status: 'all',
  startDate: '',
  endDate: ''
});

// Pagination
const currentPage = ref(1);
const itemsPerPage = ref(50);
const totalLogs = ref(0);

// Dialogs
const showDetailDialog = ref(false);
const selectedLog = ref(null);

// Table headers
const headers = [
  { title: 'Created', key: 'created_at', sortable: true },
  { title: 'Order ID', key: 'order_id', sortable: true },
  { title: 'Post ID', key: 'post_id', sortable: true },
  { title: 'User', key: 'user', sortable: false },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Likes', key: 'like_count', sortable: true },
  { title: 'Saves', key: 'save_count', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false }
];

// Filter options
const statusOptions = [
  { value: 'all', title: 'All Status' },
  { value: 'completed', title: 'Completed' },
  { value: 'failed', title: 'Failed' },
  { value: 'processing', title: 'Processing' },
  { value: 'pending', title: 'Pending' },
  { value: 'canceled', title: 'Canceled' }
];

// Methods
const loadLogs = async () => {
  loading.value = true;
  try {
    const params = {
      page: currentPage.value,
      limit: itemsPerPage.value
    };
    
    // Only add filters that are not 'all' or empty
    if (filters.value.search) {
      params.search = filters.value.search;
    }
    if (filters.value.status && filters.value.status !== 'all') {
      params.status = filters.value.status;
    }
    if (filters.value.startDate) {
      params.startDate = filters.value.startDate;
    }
    if (filters.value.endDate) {
      params.endDate = filters.value.endDate;
    }
    
    console.log('Fetching logs with params:', params);
    const response = await commentBotApi.getLogs(params);
    console.log('Logs response:', response);
    
    logs.value = response.logs || [];
    totalLogs.value = response.pagination?.total || 0;
    
    // Update stats
    if (response.stats) {
      stats.value = response.stats;
    }
    
    console.log('Logs loaded:', logs.value.length, 'total:', totalLogs.value);
    console.log('Stats:', stats.value);
  } catch (error) {
    console.error('Error loading comment bot logs:', error);
    console.error('Full error:', error.response || error);
    // Show error to user
    alert(`Error loading logs: ${error.message || 'Unknown error'}`);
  } finally {
    loading.value = false;
  }
};

const applyFilters = () => {
  currentPage.value = 1;
  loadLogs();
};

const resetFilters = () => {
  filters.value = {
    search: '',
    status: 'all',
    startDate: '',
    endDate: ''
  };
  applyFilters();
};

const exportLogs = () => {
  const params = new URLSearchParams();
  
  // Only add filters that are not 'all' or empty
  if (filters.value.search) {
    params.append('search', filters.value.search);
  }
  if (filters.value.status && filters.value.status !== 'all') {
    params.append('status', filters.value.status);
  }
  if (filters.value.startDate) {
    params.append('startDate', filters.value.startDate);
  }
  if (filters.value.endDate) {
    params.append('endDate', filters.value.endDate);
  }
  
  window.open(`/api/commentbot/logs/export?${params}`, '_blank');
};

const viewLogDetail = (log) => {
  selectedLog.value = log;
  showDetailDialog.value = true;
};

const getStatusColor = (status) => {
  const colors = {
    completed: 'success',
    failed: 'error',
    processing: 'info',
    pending: 'warning',
    canceled: 'grey'
  };
  return colors[status] || 'grey';
};

// Lifecycle
onMounted(() => {
  loadLogs();
});
</script>

<style scoped>
</style>