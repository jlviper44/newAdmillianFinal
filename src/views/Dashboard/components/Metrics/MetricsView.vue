<script setup>
import { ref, onMounted, computed } from 'vue'
import { useTheme } from 'vuetify'
import { useAuth } from '@/composables/useAuth'
import { metricsApi } from '@/services/api'
import PerformanceTab from './PerformanceTab/PerformanceTab.vue'
import SubaffiliateSummaryTab from './SubaffiliateSummaryTab/SubaffiliateSummaryTab.vue'

// Initialize Vuetify theme
const theme = useTheme();

// Get auth state
const { isAuthenticated, signIn } = useAuth()

// Tab Control
const activeTab = ref('performance')

// FluentAPI state
const affluentAPIs = ref([])
const selectedAPI = ref(null)
const loadingAPIs = ref(false)

// Snackbar state
const showSnackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

// Dialog state for adding API
const showAddApiDialog = ref(false)
const newApi = ref({
  name: '',
  api_type: 'affluent',
  api_key: '',
  affiliate_id: ''
})
const addingApi = ref(false)

// API type options
const apiTypeOptions = [
  { title: 'Affluent', value: 'affluent' },
  { title: 'Prescott', value: 'prescott' }
]

// Dialog state for deleting API
const showDeleteApiDialog = ref(false)
const deletingApi = ref(false)

// Get current theme
const isDarkMode = computed(() => {
  return theme.global.current.value.dark;
});

// Function to fetch available Affluent APIs from the database
const fetchAffluentAPIs = async () => {
  try {
    loadingAPIs.value = true
    
    // Use authenticated endpoint to fetch user's APIs
    const response = await metricsApi.getFluentApis()
    
    
    // The response should have success and data properties
    let apiData = []
    
    if (response && response.success && response.data) {
      apiData = response.data || []
    } else if (response && Array.isArray(response)) {
      // Fallback for direct array response
      apiData = response
    } else if (response && response.data && Array.isArray(response.data)) {
      // Another possible structure
      apiData = response.data
    }
    
    
    // Normalize the API data to ensure consistent property casing
    const normalizedApiData = apiData.map(api => {
      // Get all keys from the API object
      const keys = Object.keys(api);
      
      // Be more thorough in finding the right keys
      const idKey = keys.find(k => k.toLowerCase() === 'id');
      const nameKey = keys.find(k => k.toLowerCase() === 'name');
      const apiKeyKey = keys.find(k => k.toLowerCase() === 'api_key' || k.toLowerCase() === 'apikey');
      const affiliateIdKey = keys.find(k => k.toLowerCase() === 'affiliate_id' || k.toLowerCase() === 'affiliateid');
      
      
      const apiTypeKey = keys.find(k => k.toLowerCase() === 'api_type' || k.toLowerCase() === 'apitype');
      
      // Convert old 'eflow' values to 'prescott'
      let apiType = apiTypeKey ? api[apiTypeKey] : 'affluent';
      if (apiType === 'eflow') {
        apiType = 'prescott';
      }
      
      return {
        id: idKey ? api[idKey] : null,
        name: nameKey ? api[nameKey] : 'Unknown API',
        api_type: apiType,
        api_key: apiKeyKey ? api[apiKeyKey].trim() : null,
        affiliate_id: affiliateIdKey ? api[affiliateIdKey] : null
      };
    });
    
    
    if (normalizedApiData.length > 0) {
      affluentAPIs.value = normalizedApiData
      
      // Set default selected API (first in the list)
      selectedAPI.value = affluentAPIs.value[0]
      
      
      // Show success notification
      showNotification(`Connected to API: ${selectedAPI.value.name}`, 'success')
    } else {
      // No APIs found - this is normal for first time users
      affluentAPIs.value = []
      selectedAPI.value = null
      showNotification('No APIs configured yet. Click "Add API" to get started.', 'info')
    }
  } catch (error) {
    affluentAPIs.value = []
    selectedAPI.value = null
    
    // Handle different error scenarios
    if (error.response?.status === 401 || error.message?.includes('Authentication required')) {
      // User is not authenticated - this is ok, just show empty state
    } else if (error.response?.status !== 500) {
      showNotification('Unable to load APIs. Click "Add API" to add your first API.', 'info')
    }
  } finally {
    loadingAPIs.value = false
  }
}

// Helper function to show notifications
const showNotification = (text, color = 'success') => {
  snackbarText.value = text
  snackbarColor.value = color
  showSnackbar.value = true
}

// Helper function to get API type color
const getApiTypeColor = (apiType) => {
  switch(apiType) {
    case 'affluent': return 'blue'
    case 'prescott': return 'green'
    default: return 'grey'
  }
}

// Helper function to get API type label
const getApiTypeLabel = (apiType) => {
  switch(apiType) {
    case 'affluent': return 'Affluent'
    case 'prescott': return 'Prescott'
    default: return apiType
  }
}

// Handle API change
const onAPIChange = (api) => {
  if (api) {
    showNotification(`Now using API: ${api.name}`, 'info')
  }
}

// Add new Affluent API
const addNewApi = async () => {
  
  // Basic validation
  if (!newApi.value.name || !newApi.value.api_key) {
    showNotification('Please fill in name and API key', 'error')
    return
  }
  
  // Affiliate ID is required for non-Prescott APIs
  if (newApi.value.api_type !== 'prescott' && !newApi.value.affiliate_id) {
    showNotification('Affiliate ID is required for this API type', 'error')
    return
  }

  try {
    addingApi.value = true
    
    const apiData = {
      name: newApi.value.name,
      api_type: newApi.value.api_type,
      api_key: newApi.value.api_key.trim()
    }
    
    // Only add affiliate_id if it exists (not needed for Prescott)
    if (newApi.value.affiliate_id) {
      apiData.affiliate_id = newApi.value.affiliate_id.trim()
    }
    
    const response = await metricsApi.addFluentApi(apiData)
    
    
    if (response && response.success) {
      showNotification('API added successfully', 'success')
      showAddApiDialog.value = false
      
      // Reset form
      newApi.value = {
        name: '',
        api_type: 'affluent',
        api_key: '',
        affiliate_id: ''
      }
      
      // Refresh the API list
      await fetchAffluentAPIs()
    } else {
      showNotification(response?.error || 'Failed to add API', 'error')
    }
  } catch (error) {
    
    if (error.response?.status === 401) {
      showNotification('Please sign in to add APIs', 'warning')
      showAddApiDialog.value = false
    } else {
      showNotification(error.response?.data?.error || 'Failed to add API', 'error')
    }
  } finally {
    addingApi.value = false
  }
}

// Open add API dialog
const openAddApiDialog = () => {
  if (!isAuthenticated.value) {
    showNotification('Please sign in to add APIs', 'warning')
    return
  }
  
  newApi.value = {
    name: '',
    api_type: 'affluent',
    api_key: '',
    affiliate_id: ''
  }
  showAddApiDialog.value = true
}

// Open delete API dialog
const openDeleteApiDialog = () => {
  if (selectedAPI.value) {
    showDeleteApiDialog.value = true
  }
}

// Delete selected API
const deleteSelectedApi = async () => {
  if (!selectedAPI.value) return
  
  try {
    deletingApi.value = true
    
    // Use authenticated endpoint to delete the API
    const response = await metricsApi.deleteFluentApi(selectedAPI.value.id || selectedAPI.value.name)
    
    
    if (response && response.success) {
      showNotification('API deleted successfully', 'success')
      showDeleteApiDialog.value = false
      
      // Clear selected API
      selectedAPI.value = null
      
      // Refresh the API list
      await fetchAffluentAPIs()
    } else {
      showNotification('Failed to delete API', 'error')
    }
  } catch (error) {
    showNotification(error.response?.data?.error || 'Failed to delete API', 'error')
  } finally {
    deletingApi.value = false
  }
}

// Test API connection
const testAPIConnection = async () => {
  if (!selectedAPI.value) return
  
  try {
    showNotification('Testing API connection...', 'info')
    
    const response = await metricsApi.testAffiliate({
      api_type: selectedAPI.value.api_type || 'affluent',
      api_key: selectedAPI.value.api_key,
      affiliate_id: selectedAPI.value.affiliate_id,
      start_date: '2024-01-01 00:00:00',
      end_date: '2024-01-01 23:59:59'
    })
    
    
    if (response.data.success) {
      showNotification('API connection successful!', 'success')
    } else {
      showNotification(`API test failed: ${response.data.status} - ${JSON.stringify(response.data.data)}`, 'error')
    }
  } catch (error) {
    showNotification(`API test error: ${error.message}`, 'error')
  }
}

// Fetch Affluent APIs on component mount
onMounted(() => {
  
  // Only fetch APIs if user is authenticated
  if (isAuthenticated.value) {
    fetchAffluentAPIs()
  } else {
  }
})
</script>

<template>
  <div class="metrics-view">
    <!-- Authentication Alert -->
    <v-alert
      v-if="!isAuthenticated"
      type="warning"
      variant="tonal"
      class="mb-4"
    >
      <div class="d-flex align-center justify-space-between">
        <div class="d-flex align-center">
          <v-icon icon="mdi-lock" class="mr-2"></v-icon>
          <span>Please sign in to access affiliate metrics</span>
        </div>
        <v-btn
          color="warning"
          variant="flat"
          size="small"
          @click="signIn"
        >
          Sign In
        </v-btn>
      </div>
    </v-alert>
    
    
    <!-- API Configuration Card -->
    <v-card class="mb-4 elevation-2 rounded-lg api-config-card">
      <v-card-title class="d-flex align-center pb-2">
        <v-icon icon="mdi-api" color="primary" class="mr-2"></v-icon>
        <span class="text-h6">API Configuration</span>
      </v-card-title>
      
      <v-divider></v-divider>
      
      <v-card-text class="pa-4">
        <div class="d-flex flex-wrap align-center ga-3">
          <!-- Add API Button (moved to left) -->
          <v-btn
            color="success"
            variant="flat"
            @click="openAddApiDialog"
            prepend-icon="mdi-plus"
            class="add-api-btn"
            :disabled="!isAuthenticated"
          >
            Add API
          </v-btn>
          
          <!-- Delete API Button -->
          <v-btn
            color="error"
            variant="flat"
            @click="openDeleteApiDialog"
            prepend-icon="mdi-delete"
            class="delete-api-btn"
            :disabled="!selectedAPI"
          >
            Delete API
          </v-btn>
          
          <!-- Test API Button -->
          <v-btn
            color="info"
            variant="flat"
            @click="testAPIConnection"
            prepend-icon="mdi-connection"
            class="test-api-btn"
            :disabled="!selectedAPI"
          >
            Test API
          </v-btn>
          
          <!-- Refresh Button -->
          <v-btn
            color="primary"
            variant="tonal"
            @click="fetchAffluentAPIs"
            prepend-icon="mdi-refresh"
            class="refresh-api-btn"
            :loading="loadingAPIs"
          >
            Refresh
          </v-btn>
          
          <!-- API Selection Dropdown -->
          <v-select
            v-model="selectedAPI"
            :items="affluentAPIs"
            label="Select API"
            variant="outlined"
            density="comfortable"
            class="api-selector flex-grow-1"
            :loading="loadingAPIs"
            :disabled="loadingAPIs"
            prepend-inner-icon="mdi-api"
            return-object
            @update:model-value="onAPIChange"
          >
            <template v-slot:item="{ props, item }">
              <v-list-item v-bind="props">
                <template v-slot:title>
                  {{ item.raw.name }}
                  <v-chip size="x-small" class="ml-2" :color="getApiTypeColor(item.raw.api_type)">
                    {{ getApiTypeLabel(item.raw.api_type) }}
                  </v-chip>
                </template>
              </v-list-item>
            </template>
            <template v-slot:selection="{ item }">
              {{ item.raw.name }}
              <v-chip size="x-small" class="ml-2" :color="getApiTypeColor(item.raw.api_type)">
                {{ getApiTypeLabel(item.raw.api_type) }}
              </v-chip>
            </template>
          </v-select>
        </div>
        
        <!-- API Info Alert -->
        <v-alert
          v-if="!selectedAPI && affluentAPIs.length === 0"
          type="info"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          <small>No APIs configured yet. Click "Add API" to connect your Affluent account.</small>
        </v-alert>
      </v-card-text>
    </v-card>
    
    <!-- Tabs for Performance and Subaffiliate Summary -->
    <v-card class="elevation-2 rounded-lg tabs-card">
      <v-tabs 
        v-model="activeTab" 
        color="primary"
        slider-color="primary"
        align-tabs="center"
        class="tab-header"
        grow
      >
        <v-tab value="performance" class="tab-item">
          <v-icon icon="mdi-chart-line" class="mr-2"></v-icon>
          Performance
        </v-tab>
        <v-tab value="subaffiliatesummary" class="tab-item">
          <v-icon icon="mdi-account-group" class="mr-2"></v-icon>
          Subaffiliate Summary
        </v-tab>
      </v-tabs>
      
      <v-divider></v-divider>
      
      <!-- Tab Content -->
      <v-window v-model="activeTab" class="tab-content">
        <v-window-item value="performance">
          <div class="pa-4">
            <PerformanceTab :api-key="selectedAPI?.api_key" :affiliate-id="selectedAPI?.affiliate_id" :api-type="selectedAPI?.api_type" />
          </div>
        </v-window-item>
        
        <v-window-item value="subaffiliatesummary">
          <div class="pa-4">
            <SubaffiliateSummaryTab :api-key="selectedAPI?.api_key" :affiliate-id="selectedAPI?.affiliate_id" :api-type="selectedAPI?.api_type" />
          </div>
        </v-window-item>
      </v-window>
    </v-card>
    
    <!-- Snackbar for API change notifications -->
    <v-snackbar
      v-model="showSnackbar"
      :color="snackbarColor"
      :timeout="3000"
      location="top"
    >
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn
          variant="text"
          @click="showSnackbar = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
    
    <!-- Add API Dialog -->
    <v-dialog
      v-model="showAddApiDialog"
      max-width="500"
    >
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-api" color="primary" class="mr-2"></v-icon>
          <span>Add API Configuration</span>
        </v-card-title>
        
        <v-divider></v-divider>
        
        <v-card-text class="pa-4">
          <v-form>
            <v-text-field
              v-model="newApi.name"
              label="API Name"
              placeholder="e.g., Production API"
              prepend-icon="mdi-tag"
              variant="outlined"
              density="comfortable"
              :rules="[v => !!v || 'Name is required']"
              class="mb-3"
            ></v-text-field>
            
            <v-select
              v-model="newApi.api_type"
              label="API Type"
              :items="apiTypeOptions"
              prepend-icon="mdi-swap-horizontal"
              variant="outlined"
              density="comfortable"
              class="mb-3"
            ></v-select>
            
            <v-text-field
              v-model="newApi.api_key"
              label="API Key"
              placeholder="Your Affluent API key"
              prepend-icon="mdi-key"
              variant="outlined"
              density="comfortable"
              :rules="[v => !!v || 'API Key is required']"
              class="mb-3"
              type="password"
            ></v-text-field>
            
            <v-text-field
              v-if="newApi.api_type !== 'prescott'"
              v-model="newApi.affiliate_id"
              label="Affiliate ID"
              placeholder="Your Affiliate ID"
              prepend-icon="mdi-identifier"
              variant="outlined"
              density="comfortable"
              :rules="[v => !!v || 'Affiliate ID is required']"
            ></v-text-field>
            
            <v-alert
              v-if="newApi.api_type === 'prescott'"
              type="success"
              variant="tonal"
              density="compact"
              class="mt-3"
            >
              <small>Prescott only requires an API key (x-eflow-api-key). The affiliate information is determined by the API key itself.</small>
            </v-alert>
            
            <v-alert
              v-else
              type="info"
              variant="tonal"
              density="compact"
              class="mt-3"
            >
              <small>You can find your API credentials in your Affluent dashboard under API settings.</small>
            </v-alert>
          </v-form>
        </v-card-text>
        
        <v-divider></v-divider>
        
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="showAddApiDialog = false"
            :disabled="addingApi"
          >
            Cancel
          </v-btn>
          <v-btn
            color="success"
            variant="flat"
            @click="addNewApi"
            :loading="addingApi"
            :disabled="!newApi.name || !newApi.api_key || (newApi.api_type !== 'prescott' && !newApi.affiliate_id)"
          >
            Add API
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
    <!-- Delete API Confirmation Dialog -->
    <v-dialog
      v-model="showDeleteApiDialog"
      max-width="400"
    >
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-delete-alert" color="error" class="mr-2"></v-icon>
          <span>Delete API Configuration</span>
        </v-card-title>
        
        <v-divider></v-divider>
        
        <v-card-text class="pa-4">
          <p class="mb-0">
            Are you sure you want to delete the API configuration 
            <strong>"{{ selectedAPI?.name }}"</strong>?
          </p>
          <v-alert
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            <small>This action cannot be undone.</small>
          </v-alert>
        </v-card-text>
        
        <v-divider></v-divider>
        
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="showDeleteApiDialog = false"
            :disabled="deletingApi"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            @click="deleteSelectedApi"
            :loading="deletingApi"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.metrics-view {
  /* Remove extra padding since we're already inside a container */
}

.header-card, .api-config-card {
  transition: background-color 0.3s ease;
}

.tabs-card {
  transition: background-color 0.3s ease;
  overflow: hidden;
}

.api-selector {
  min-width: 250px;
  transition: all 0.3s ease;
}

.add-api-btn, .delete-api-btn, .test-api-btn, .refresh-api-btn {
  white-space: nowrap;
}

.tab-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.v-theme--dark .tab-header {
  border-bottom-color: rgba(255, 255, 255, 0.12);
}

.tab-item {
  min-height: 48px;
  transition: background-color 0.3s ease;
}

.tab-item.v-tab--selected {
  background-color: rgba(25, 118, 210, 0.08);
}

.v-theme--dark .tab-item.v-tab--selected {
  background-color: rgba(100, 181, 246, 0.15);
}

.tab-content {
  min-height: 400px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .d-flex.flex-wrap {
    flex-direction: column;
    align-items: flex-start !important;
  }
  
  .d-flex.align-center.ga-2 {
    width: 100%;
    flex-direction: column;
    align-items: stretch !important;
  }
  
  .api-selector {
    margin-top: 8px;
    max-width: 100%;
    width: 100%;
  }
  
  .tab-content {
    min-height: 300px;
  }
  
  .v-btn.mr-3 {
    margin-right: 0 !important;
    margin-bottom: 8px;
    width: 100%;
  }
  
  .add-api-btn, .delete-api-btn, .test-api-btn, .refresh-api-btn {
    width: 100%;
    margin-bottom: 8px;
  }
}
</style>