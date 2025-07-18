<template>
  <div>
    <!-- Header -->
    <v-row class="mb-4">
      <v-col cols="12">
        <div class="d-flex justify-end">
          <v-btn 
            color="primary" 
            @click="refreshData"
            :loading="loading"
            prepend-icon="mdi-refresh"
          >
            Refresh
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <!-- Statistics Cards -->
    <v-row class="mb-6">
      <v-col cols="12" sm="6" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-subtitle-2 text-grey-darken-1">Total Clicks</p>
                <p class="text-h4 font-weight-bold">{{ stats.total.toLocaleString() }}</p>
                <p class="text-caption">Last 24h: {{ stats.last24Hours.total.toLocaleString() }}</p>
              </div>
              <v-icon size="40" color="primary">mdi-mouse</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-subtitle-2 text-grey-darken-1">Conversion Rate</p>
                <p class="text-h4 font-weight-bold">{{ stats.conversionRate }}%</p>
                <p class="text-caption">Passed validation</p>
              </div>
              <v-icon size="40" color="success">mdi-percent</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-subtitle-2 text-grey-darken-1">Blocked Clicks</p>
                <p class="text-h4 font-weight-bold">{{ stats.blocked.toLocaleString() }}</p>
                <p class="text-caption">Failed validation</p>
              </div>
              <v-icon size="40" color="error">mdi-shield-alert</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-subtitle-2 text-grey-darken-1">First 10 Clicks</p>
                <p class="text-h4 font-weight-bold">{{ stats.first10.toLocaleString() }}</p>
                <p class="text-caption">Testing phase</p>
              </div>
              <v-icon size="40" color="info">mdi-flag</v-icon>
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
            <v-select
              v-model="filters.campaign"
              :items="campaignOptions"
              item-title="name"
              item-value="id"
              label="Campaign"
              density="compact"
              variant="outlined"
            ></v-select>
          </v-col>

          <v-col cols="12" sm="6" md="3">
            <v-select
              v-model="filters.type"
              :items="typeOptions"
              label="Type"
              density="compact"
              variant="outlined"
            ></v-select>
          </v-col>

          <v-col cols="12" sm="6" md="3">
            <v-select
              v-model="filters.decision"
              :items="decisionOptions"
              label="Decision"
              density="compact"
              variant="outlined"
            ></v-select>
          </v-col>

          <v-col cols="12" sm="6" md="3">
            <v-select
              v-model="filters.tag"
              :items="tagOptions"
              label="Tags"
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

          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model="filters.search"
              label="Search"
              placeholder="IP, country, city..."
              density="compact"
              variant="outlined"
              @keyup.enter="applyFilters"
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
        <div>
          <v-btn 
            color="success" 
            variant="outlined"
            prepend-icon="mdi-download"
            @click="exportLogs"
          >
            Export CSV
          </v-btn>
          <v-btn 
            color="error" 
            variant="outlined"
            prepend-icon="mdi-delete"
            @click="showClearDialog = true"
            class="ml-2"
          >
            Clear Old Logs
          </v-btn>
        </div>
      </v-card-actions>
    </v-card>

    <!-- Logs Table -->
    <v-card>
      <v-data-table
        :headers="headers"
        :items="logs"
        :loading="loading"
        :items-per-page="itemsPerPage"
        :page="currentPage"
        @update:page="currentPage = $event"
        @update:items-per-page="itemsPerPage = $event"
        class="elevation-1"
      >
        <template v-slot:item.timestamp="{ item }">
          {{ formatDateTime(item.timestamp) }}
        </template>

        <template v-slot:item.type="{ item }">
          <v-chip 
            :color="getTypeColor(item.type)" 
            size="small"
          >
            {{ getTypeLabel(item.type) }}
          </v-chip>
        </template>

        <template v-slot:item.location="{ item }">
          {{ formatLocation(item) }}
        </template>

        <template v-slot:item.os="{ item }">
          {{ formatOS(item.os, item.osVersion) }}
        </template>

        <template v-slot:item.decision="{ item }">
          <v-chip 
            :color="item.decision === 'blackhat' ? 'success' : 'error'" 
            size="small"
          >
            {{ item.decision === 'blackhat' ? 'Passed' : 'Blocked' }}
          </v-chip>
        </template>

        <template v-slot:item.tags="{ item }">
          <v-chip 
            v-for="tag in item.tags" 
            :key="tag"
            size="x-small"
            class="mr-1"
            color="info"
          >
            {{ tag }}
          </v-chip>
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
          <span>Log Details</span>
          <v-btn 
            icon 
            variant="text" 
            @click="showDetailDialog = false"
          >
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        
        <v-card-text v-if="selectedLog">
          <v-tabs v-model="detailTab">
            <v-tab value="formatted">Formatted</v-tab>
            <v-tab value="json">Raw JSON</v-tab>
          </v-tabs>

          <v-window v-model="detailTab">
            <v-window-item value="formatted">
              <div class="mt-4">
                <!-- Basic Info -->
                <div class="mb-4">
                  <h4 class="text-subtitle-1 font-weight-bold mb-2">Basic Information</h4>
                  <v-row>
                    <v-col cols="6">
                      <strong>Log ID:</strong> {{ selectedLog.id }}
                    </v-col>
                    <v-col cols="6">
                      <strong>Timestamp:</strong> {{ formatDateTime(selectedLog.timestamp) }}
                    </v-col>
                    <v-col cols="6">
                      <strong>Type:</strong> 
                      <v-chip :color="getTypeColor(selectedLog.type)" size="small">
                        {{ getTypeLabel(selectedLog.type) }}
                      </v-chip>
                    </v-col>
                    <v-col cols="6">
                      <strong>Decision:</strong> 
                      <v-chip :color="selectedLog.decision === 'blackhat' ? 'success' : 'error'" size="small">
                        {{ selectedLog.decision === 'blackhat' ? 'Passed' : 'Blocked' }}
                      </v-chip>
                    </v-col>
                  </v-row>
                </div>

                <!-- Campaign Info -->
                <div class="mb-4" v-if="selectedLog.campaignId">
                  <h4 class="text-subtitle-1 font-weight-bold mb-2">Campaign Information</h4>
                  <v-row>
                    <v-col cols="6">
                      <strong>Campaign Name:</strong> {{ selectedLog.campaignName || 'Unknown' }}
                    </v-col>
                    <v-col cols="6">
                      <strong>Campaign ID:</strong> {{ selectedLog.campaignId }}
                    </v-col>
                    <v-col cols="6" v-if="selectedLog.launchNumber !== undefined">
                      <strong>Launch Number:</strong> {{ selectedLog.launchNumber }}
                    </v-col>
                  </v-row>
                </div>

                <!-- Location Info -->
                <div class="mb-4">
                  <h4 class="text-subtitle-1 font-weight-bold mb-2">Location Information</h4>
                  <v-row>
                    <v-col cols="6">
                      <strong>IP Address:</strong> {{ selectedLog.ip || 'Unknown' }}
                    </v-col>
                    <v-col cols="6">
                      <strong>Country:</strong> {{ selectedLog.country || 'Unknown' }}
                    </v-col>
                    <v-col cols="6" v-if="selectedLog.region">
                      <strong>Region:</strong> {{ selectedLog.region }}
                    </v-col>
                    <v-col cols="6" v-if="selectedLog.city">
                      <strong>City:</strong> {{ selectedLog.city }}
                    </v-col>
                  </v-row>
                </div>

                <!-- Device Info -->
                <div class="mb-4">
                  <h4 class="text-subtitle-1 font-weight-bold mb-2">Device Information</h4>
                  <v-row>
                    <v-col cols="12">
                      <strong>Operating System:</strong> {{ formatOS(selectedLog.os, selectedLog.osVersion) }}
                    </v-col>
                    <v-col cols="12">
                      <strong>User Agent:</strong>
                      <div class="text-caption mt-1 pa-2 bg-grey-lighten-4 rounded">
                        {{ selectedLog.userAgent || 'Unknown' }}
                      </div>
                    </v-col>
                    <v-col cols="12" v-if="selectedLog.referer">
                      <strong>Referrer:</strong> {{ selectedLog.referer }}
                    </v-col>
                  </v-row>
                </div>

                <!-- Request Info -->
                <div v-if="selectedLog.url || selectedLog.params">
                  <h4 class="text-subtitle-1 font-weight-bold mb-2">Request Information</h4>
                  <v-row>
                    <v-col cols="12" v-if="selectedLog.url">
                      <strong>URL:</strong>
                      <div class="text-caption mt-1 pa-2 bg-grey-lighten-4 rounded">
                        {{ selectedLog.url }}
                      </div>
                    </v-col>
                    <v-col cols="12" v-if="selectedLog.params && Object.keys(selectedLog.params).length > 0">
                      <strong>Parameters:</strong>
                      <div class="mt-2">
                        <div v-for="(value, key) in selectedLog.params" :key="key">
                          <strong>{{ key }}:</strong> {{ value || 'null' }}
                        </div>
                      </div>
                    </v-col>
                  </v-row>
                </div>

                <!-- Tags -->
                <div v-if="selectedLog.tags && selectedLog.tags.length > 0">
                  <h4 class="text-subtitle-1 font-weight-bold mb-2">Tags</h4>
                  <v-chip 
                    v-for="tag in selectedLog.tags" 
                    :key="tag"
                    size="small"
                    class="mr-2"
                    color="info"
                  >
                    {{ tag }}
                  </v-chip>
                </div>
              </div>
            </v-window-item>

            <v-window-item value="json">
              <pre class="mt-4 pa-3 bg-grey-lighten-4 rounded overflow-auto">{{ JSON.stringify(selectedLog, null, 2) }}</pre>
            </v-window-item>
          </v-window>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Clear Logs Dialog -->
    <v-dialog v-model="showClearDialog" max-width="500px">
      <v-card>
        <v-card-title>Clear Old Logs</v-card-title>
        <v-card-text>
          <p class="mb-4">Delete logs older than the specified number of days:</p>
          <v-text-field
            v-model.number="clearDays"
            label="Days to keep"
            type="number"
            min="1"
            variant="outlined"
            density="compact"
          ></v-text-field>
          <v-alert type="warning" variant="tonal" class="mt-2">
            This action cannot be undone.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn 
            variant="text" 
            @click="showClearDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn 
            color="error" 
            variant="flat"
            @click="confirmClearLogs"
          >
            Clear Logs
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import logsAPI from '@/services/logsAPI';

// State
const loading = ref(false);
const logs = ref([]);
const campaigns = ref([]);
const stats = ref({
  total: 0,
  passed: 0,
  blocked: 0,
  first10: 0,
  conversionRate: 0,
  last24Hours: {
    total: 0,
    passed: 0,
    blocked: 0
  }
});

// Filters
const filters = ref({
  campaign: 'all',
  type: 'all',
  decision: 'all',
  tag: 'all',
  startDate: '',
  endDate: '',
  search: ''
});

// Pagination
const currentPage = ref(1);
const itemsPerPage = ref(100);
const totalLogs = ref(0);

// Dialogs
const showDetailDialog = ref(false);
const showClearDialog = ref(false);
const selectedLog = ref(null);
const detailTab = ref('formatted');
const clearDays = ref(30);

// Table headers
const headers = [
  { title: 'Timestamp', key: 'timestamp', sortable: true },
  { title: 'Campaign', key: 'campaignName', sortable: true },
  { title: 'Launch', key: 'launchNumber', sortable: true },
  { title: 'Type', key: 'type', sortable: true },
  { title: 'Location', key: 'location', sortable: false },
  { title: 'OS', key: 'os', sortable: true },
  { title: 'Decision', key: 'decision', sortable: true },
  { title: 'Tags', key: 'tags', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false }
];

// Filter options
const campaignOptions = computed(() => {
  return [
    { id: 'all', name: 'All Campaigns' },
    ...campaigns.value
  ];
});

const typeOptions = [
  { value: 'all', title: 'All Types' },
  { value: 'click', title: 'Successful Clicks' },
  { value: 'validation', title: 'Failed Validations' },
  { value: 'pending', title: 'Initial Checks' }
];

const decisionOptions = [
  { value: 'all', title: 'All Decisions' },
  { value: 'blackhat', title: 'Passed (Real Users)' },
  { value: 'whitehat', title: 'Blocked (Bots/Invalid)' }
];

const tagOptions = [
  { value: 'all', title: 'All Tags' },
  { value: 'first10', title: 'First 10 Clicks' }
];

// Methods
const loadLogs = async () => {
  loading.value = true;
  try {
    const params = {
      page: currentPage.value,
      limit: itemsPerPage.value,
      ...filters.value
    };
    
    const response = await logsAPI.getLogs(params);
    logs.value = response.logs;
    totalLogs.value = response.pagination.total;
  } catch (error) {
  } finally {
    loading.value = false;
  }
};

const loadStats = async () => {
  try {
    const response = await logsAPI.getLogsSummary();
    stats.value = response;
  } catch (error) {
  }
};

const loadCampaigns = async () => {
  try {
    const response = await logsAPI.getCampaignsList();
    campaigns.value = response.campaigns;
  } catch (error) {
  }
};

const applyFilters = () => {
  currentPage.value = 1;
  loadLogs();
};

const resetFilters = () => {
  filters.value = {
    campaign: 'all',
    type: 'all',
    decision: 'all',
    tag: 'all',
    startDate: '',
    endDate: '',
    search: ''
  };
  applyFilters();
};

const refreshData = async () => {
  await Promise.all([
    loadLogs(),
    loadStats()
  ]);
};

const exportLogs = () => {
  const params = new URLSearchParams(filters.value);
  window.open(`/api/logs/export?${params}`, '_blank');
};

const viewLogDetail = async (log) => {
  try {
    const response = await logsAPI.getLog(log.id);
    selectedLog.value = response;
    showDetailDialog.value = true;
  } catch (error) {
  }
};

const confirmClearLogs = async () => {
  try {
    await logsAPI.clearOldLogs(clearDays.value);
    showClearDialog.value = false;
    refreshData();
  } catch (error) {
  }
};

// Formatting helpers
const formatDateTime = (timestamp) => {
  return new Date(timestamp).toLocaleString();
};

const formatLocation = (log) => {
  const parts = [log.country];
  if (log.city) parts.push(log.city);
  return parts.join(', ') || 'Unknown';
};

const formatOS = (os, version) => {
  if (!os || os === 'unknown') return 'Unknown';
  
  const osNames = {
    ios: 'iOS',
    android: 'Android',
    windows: 'Windows',
    macos: 'macOS'
  };
  
  const name = osNames[os] || os;
  return version ? `${name} ${version}` : name;
};

const getTypeColor = (type) => {
  const colors = {
    click: 'success',
    validation: 'error',
    pending: 'warning'
  };
  return colors[type] || 'grey';
};

const getTypeLabel = (type) => {
  const labels = {
    click: 'Click',
    validation: 'Validation',
    pending: 'Pending'
  };
  return labels[type] || type;
};

// Lifecycle
onMounted(async () => {
  await Promise.all([
    loadCampaigns(),
    loadLogs(),
    loadStats()
  ]);
});
</script>

<style scoped>
pre {
  max-height: 500px;
  font-size: 12px;
}
</style>