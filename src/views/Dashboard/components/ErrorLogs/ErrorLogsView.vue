<template>
  <v-container fluid>
    <v-card>
      <v-card-title>
        <v-icon icon="mdi-alert-circle" color="error" class="mr-2"></v-icon>
        Error Logs
        <v-spacer></v-spacer>
        <v-btn
          color="warning"
          variant="tonal"
          @click="syncCloudflare"
          :loading="syncing"
          class="mr-2"
        >
          <v-icon icon="mdi-cloud-sync"></v-icon>
          Sync Cloudflare
        </v-btn>
        <v-btn
          color="error"
          variant="tonal"
          @click="generateTestError"
          class="mr-2"
        >
          <v-icon icon="mdi-bug"></v-icon>
          Test Error
        </v-btn>
        <v-btn
          color="primary"
          variant="tonal"
          @click="refreshLogs"
          :loading="loading"
        >
          <v-icon icon="mdi-refresh"></v-icon>
          Refresh
        </v-btn>
      </v-card-title>

      <v-card-text>
        <!-- Filters -->
        <v-row class="mb-4">
          <v-col cols="12" sm="3">
            <v-select
              v-model="selectedSource"
              :items="sources"
              label="Error Source"
              clearable
              variant="outlined"
              density="compact"
            ></v-select>
          </v-col>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model="startDate"
              label="Start Date"
              type="datetime-local"
              variant="outlined"
              density="compact"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model="endDate"
              label="End Date"
              type="datetime-local"
              variant="outlined"
              density="compact"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="3">
            <v-btn
              color="primary"
              @click="applyFilters"
              :loading="loading"
              block
            >
              Apply Filters
            </v-btn>
          </v-col>
        </v-row>

        <!-- Error Stats -->
        <v-row class="mb-4">
          <v-col cols="12" sm="3">
            <v-card variant="outlined">
              <v-card-text class="text-center">
                <div class="text-h4 text-error">{{ stats.total }}</div>
                <div class="text-caption">Total Errors</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="3">
            <v-card variant="outlined">
              <v-card-text class="text-center">
                <div class="text-h4 text-warning">{{ stats.today }}</div>
                <div class="text-caption">Today</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="3">
            <v-card variant="outlined">
              <v-card-text class="text-center">
                <div class="text-h4 text-info">{{ stats.week }}</div>
                <div class="text-caption">This Week</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="3">
            <v-card variant="outlined">
              <v-card-text class="text-center">
                <div class="text-h4 text-success">{{ stats.resolved }}</div>
                <div class="text-caption">Resolved</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- No Errors Message -->
        <v-alert
          v-if="!loading && errorLogs.length === 0"
          type="info"
          variant="tonal"
          class="mb-4"
        >
          <v-alert-title>No Errors Found</v-alert-title>
          <div>No errors have been logged yet. Click "Test Error" to generate a sample error.</div>
        </v-alert>

        <!-- Error Logs Table -->
        <v-data-table
          v-if="errorLogs.length > 0"
          :headers="headers"
          :items="errorLogs"
          :loading="loading"
          :items-per-page="25"
          class="elevation-1"
        >
          <template v-slot:item.timestamp="{ item }">
            {{ formatDate(item.timestamp) }}
          </template>

          <template v-slot:item.source="{ item }">
            <v-chip
              :color="getSourceColor(item.source)"
              size="small"
              label
            >
              {{ item.source }}
            </v-chip>
          </template>

          <template v-slot:item.error="{ item }">
            <div>
              <div class="font-weight-bold">{{ item.error.message }}</div>
              <div class="text-caption text-grey">{{ item.error.name }}</div>
            </div>
          </template>

          <template v-slot:item.actions="{ item }">
            <v-btn
              icon="mdi-eye"
              size="small"
              variant="text"
              @click="viewErrorDetails(item)"
            ></v-btn>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Error Details Dialog -->
    <v-dialog
      v-model="detailsDialog"
      max-width="800"
    >
      <v-card>
        <v-card-title>
          Error Details
          <v-spacer></v-spacer>
          <v-btn
            icon="mdi-close"
            variant="text"
            @click="detailsDialog = false"
          ></v-btn>
        </v-card-title>

        <v-card-text v-if="selectedError">
          <v-row>
            <v-col cols="12">
              <div class="mb-2">
                <strong>Timestamp:</strong> {{ formatDate(selectedError.timestamp) }}
              </div>
              <div class="mb-2">
                <strong>Source:</strong> {{ selectedError.source }}
              </div>
              <div class="mb-2">
                <strong>Environment:</strong> {{ selectedError.environment }}
              </div>
              <div class="mb-2">
                <strong>Error Message:</strong> {{ selectedError.error.message }}
              </div>
              <div class="mb-2" v-if="selectedError.error.code">
                <strong>Error Code:</strong> {{ selectedError.error.code }}
              </div>
            </v-col>
          </v-row>

          <v-row v-if="selectedError.metadata && Object.keys(selectedError.metadata).length">
            <v-col cols="12">
              <v-divider class="my-3"></v-divider>
              <h4 class="mb-2">Metadata</h4>
              <pre class="text-caption">{{ JSON.stringify(selectedError.metadata, null, 2) }}</pre>
            </v-col>
          </v-row>

          <v-row v-if="selectedError.error.stack">
            <v-col cols="12">
              <v-divider class="my-3"></v-divider>
              <h4 class="mb-2">Stack Trace</h4>
              <pre class="text-caption error-stack">{{ selectedError.error.stack }}</pre>
            </v-col>
          </v-row>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            variant="text"
            @click="detailsDialog = false"
          >
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';

const loading = ref(false);
const syncing = ref(false);
const errorLogs = ref([]);
const selectedSource = ref(null);
const startDate = ref('');
const endDate = ref('');
const detailsDialog = ref(false);
const selectedError = ref(null);

const sources = [
  'cloudflare-worker',
  'cloudflare-d1',
  'cloudflare-kv',
  'cloudflare-r2',
  'cloudflare-do',
  'cloudflare-api',
  'cloudflare-zone',
  'cloudflare-http',
  'test'
];

const headers = [
  { title: 'Timestamp', key: 'timestamp', width: '180' },
  { title: 'Source', key: 'source', width: '150' },
  { title: 'Error', key: 'error' },
  { title: 'Actions', key: 'actions', width: '80', sortable: false }
];

const stats = computed(() => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    total: errorLogs.value.length,
    today: errorLogs.value.filter(log => new Date(log.timestamp) >= today).length,
    week: errorLogs.value.filter(log => new Date(log.timestamp) >= weekAgo).length,
    resolved: 0 // This would need a resolved status field in the error logs
  };
});

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString();
};

const getSourceColor = (source) => {
  const colors = {
    'cloudflare-worker': 'primary',
    'cloudflare-d1': 'success',
    'cloudflare-kv': 'info',
    'cloudflare-r2': 'warning',
    'cloudflare-do': 'purple',
    'cloudflare-api': 'orange'
  };
  return colors[source] || 'grey';
};

const fetchErrorLogs = async () => {
  loading.value = true;
  try {
    const params = {};
    if (selectedSource.value) params.source = selectedSource.value;
    if (startDate.value) params.startDate = startDate.value;
    if (endDate.value) params.endDate = endDate.value;

    const response = await axios.get('/api/error-logs', { params });
    errorLogs.value = response.data || [];
    console.log('Fetched error logs:', errorLogs.value);
  } catch (error) {
    console.error('Failed to fetch error logs:', error);
    // Show empty state if there's an error
    errorLogs.value = [];
  } finally {
    loading.value = false;
  }
};

const refreshLogs = () => {
  fetchErrorLogs();
};

const applyFilters = () => {
  fetchErrorLogs();
};

const viewErrorDetails = (error) => {
  selectedError.value = error;
  detailsDialog.value = true;
};

const generateTestError = async () => {
  try {
    await axios.post('/api/error-logs/test');
    // Refresh the logs after generating test error
    setTimeout(() => {
      fetchErrorLogs();
    }, 500);
  } catch (error) {
    console.error('Failed to generate test error:', error);
  }
};

const syncCloudflare = async () => {
  syncing.value = true;
  try {
    const response = await axios.post('/api/error-logs/sync-cloudflare');
    const data = response.data;

    // Show success/error message
    if (data.success) {
      console.log(`Synced ${data.synced} of ${data.total} Cloudflare logs`);
      // Refresh the logs after syncing
      await fetchErrorLogs();
    } else {
      console.error('Failed to sync Cloudflare logs:', data.error);
    }
  } catch (error) {
    console.error('Failed to sync Cloudflare logs:', error);
  } finally {
    syncing.value = false;
  }
};

onMounted(() => {
  fetchErrorLogs();
});
</script>

<style scoped>
.error-stack {
  background-color: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  max-height: 300px;
  font-family: monospace;
  font-size: 12px;
}
</style>