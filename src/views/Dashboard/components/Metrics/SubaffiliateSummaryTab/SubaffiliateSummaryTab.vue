<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import Datepicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { metricsApi } from '@/services/api'
import SubaffiliateSummaryTable from './Components/SubaffiliateSummaryTable.vue'
import SubaffiliateLineChart from './Components/SubaffiliateChartComponent.vue'

// Initialize Vuetify theme
const theme = useTheme();

// Get current theme
const isDarkMode = computed(() => {
  return theme.global.current.value.dark;
});

// Props
const props = defineProps({
  apiKey: {
    type: String,
    default: null
  },
  affiliateId: {
    type: String,
    default: null
  },
  apiType: {
    type: String,
    default: 'affluent'
  }
})

// Local state variables
const startDateLocal = ref(null)
const endDateLocal = ref(null)
const combinedData = ref([])
const filteredData = ref([])
const selectedSubId = ref(null)
const localLoadingState = ref(false)
const localErrorState = ref(null)
const processedDays = ref(0)
const totalDays = ref(0)
const pendingRequests = ref(0) // Track pending requests

// Filter state
const filters = ref({
  subId: null
})

// Define formatDate function internally instead of receiving as prop
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString()
}

// Computed property for loading state
const loadingSubaffiliateSummary = computed(() => {
  return localLoadingState.value
})

// Computed property for error state
const subaffiliateSummaryError = computed(() => {
  return localErrorState.value
})

// Computed property to get unique Sub IDs from data
const availableSubIds = computed(() => {
  if (!combinedData.value || combinedData.value.length === 0) return []
  
  const subIds = [...new Set(combinedData.value.map(item => item.sub_id))]
  return subIds.sort()
})

// Computed property to get unique Sub IDs from data (for the new filter)
const availableFilterSubIds = computed(() => {
  if (!combinedData.value || combinedData.value.length === 0) return []
  
  const subIds = combinedData.value
    .map(item => item.sub_id)
    .filter(id => id)
  
  return [...new Set(subIds)].sort()
})

// Computed property to get final data to display (either filtered or all)
const displayData = computed(() => {
  let data = [...combinedData.value];
  
  // Apply existing Sub ID filter (from the autocomplete)
  if (selectedSubId.value) {
    data = data.filter(item => item.sub_id === selectedSubId.value);
  }
  
  // Apply new Sub ID filter
  if (filters.value.subId) {
    data = data.filter(item => item.sub_id === filters.value.subId);
  }
  
  return data;
})

// Filter data by Sub ID (kept for compatibility with template)
const filterBySubId = () => {
  // Filtering is now handled by the displayData computed property
  // This function is kept to avoid breaking the template
}

// Watch for changes in the selected Sub ID
watch(selectedSubId, () => {
  filterBySubId();
});

// Watch for changes in combined data to update filtered data if needed
watch(combinedData, () => {
  if (selectedSubId.value) {
    filterBySubId();
  }
}, { deep: true });

// Expose the apiKey and affiliateId as computed properties
const apiKey = computed(() => props.apiKey)
const affiliateId = computed(() => props.affiliateId)

// Watch for changes in API credentials to refresh data if needed
watch(
  [() => props.apiKey, () => props.affiliateId], 
  ([newApiKey, newAffiliateId], [oldApiKey, oldAffiliateId]) => {
    if ((newApiKey && newAffiliateId) && 
        (newApiKey !== oldApiKey || newAffiliateId !== oldAffiliateId) &&
        startDateLocal.value && endDateLocal.value) {
      applyDateFilter()
    }
  }
)

// Note: No need to watch filters for display updates since displayData computed property
// automatically updates when filters change. The filters are applied client-side on the
// already fetched data, so we don't need to re-fetch from the API.

// Set default dates (today minus 7 days to today)
onMounted(() => {
  const today = new Date()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(today.getDate() - 7)
  
  // Set default date range
  startDateLocal.value = sevenDaysAgo
  endDateLocal.value = today
  
  // Fetch data automatically on mount with a slight delay
  // to ensure all components are properly mounted
  setTimeout(() => {
    if (props.apiKey && (props.apiType === 'prescott' || props.affiliateId)) {
      applyDateFilter()
    }
  }, 100)
})

// Handle start date change
const onStartDateChange = (date) => {
  if (date) {
    // Create new Date object for start date
    const startDateObj = new Date(date)
    startDateObj.setHours(0, 0, 0, 0)
    startDateLocal.value = startDateObj
    
    // If end date is before start date, update end date
    if (endDateLocal.value && endDateLocal.value < startDateObj) {
      endDateLocal.value = new Date(startDateObj)
    }
  }
}

// Handle end date change
const onEndDateChange = (date) => {
  if (date) {
    // Create new Date object for end date
    const endDateObj = new Date(date)
    endDateObj.setHours(23, 59, 59, 999)
    endDateLocal.value = endDateObj
  }
}

// Preset date ranges
const setToday = () => {
  const today = new Date()
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  const end = new Date(today)
  end.setHours(23, 59, 59, 999)
  
  startDateLocal.value = start
  endDateLocal.value = end
}

const setYesterday = () => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const start = new Date(yesterday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(yesterday)
  end.setHours(23, 59, 59, 999)
  
  startDateLocal.value = start
  endDateLocal.value = end
}

const setLast7Days = () => {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date()
  start.setDate(start.getDate() - 6)
  start.setHours(0, 0, 0, 0)
  
  startDateLocal.value = start
  endDateLocal.value = end
}

const setLast30Days = () => {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date()
  start.setDate(start.getDate() - 29)
  start.setHours(0, 0, 0, 0)
  
  startDateLocal.value = start
  endDateLocal.value = end
}

const setThisMonth = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  end.setHours(23, 59, 59, 999)
  
  startDateLocal.value = start
  endDateLocal.value = end
}

const setLastMonth = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), 0)
  end.setHours(23, 59, 59, 999)
  
  startDateLocal.value = start
  endDateLocal.value = end
}

const setYearToDate = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  
  startDateLocal.value = start
  endDateLocal.value = end
}

// Function to format date for API (YYYY-MM-DD HH:MM:SS)
const formatDateForApi = (date, isEndDate = false) => {
  if (!date) return ''
  
  const formattedDate = new Date(date)
  
  if (isEndDate) {
    formattedDate.setHours(23, 59, 59, 999)
  } else {
    formattedDate.setHours(0, 0, 0, 0)
  }
  
  const year = formattedDate.getFullYear()
  const month = String(formattedDate.getMonth() + 1).padStart(2, '0')
  const day = String(formattedDate.getDate()).padStart(2, '0')
  const hours = String(formattedDate.getHours()).padStart(2, '0')
  const minutes = String(formattedDate.getMinutes()).padStart(2, '0')
  const seconds = String(formattedDate.getSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// Function to get all dates in range
const getDatesInRange = (startDate, endDate) => {
  const dates = []
  const currentDate = new Date(startDate)
  
  // Include the start date
  currentDate.setHours(0, 0, 0, 0)
  
  // End date (set to end of day for comparison)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)
  
  // Generate all dates in range
  while (currentDate <= end) {
    dates.push(new Date(currentDate))
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return dates
}

// Get request parameters for API call
const getRequestParams = (startDate, endDate) => {
  const fields = [
    'sub_id',
    'clicks',
    'conversions',
    'revenue',
    'epc',
    'events',
    'date'
  ]
  
  const params = {
    api_type: props.apiType,
    api_key: props.apiKey,
    affiliate_id: props.affiliateId,
    start_date: formatDateForApi(startDate, false),
    end_date: formatDateForApi(endDate, true),
    fields: fields
  }
  
  return params
}

// Function to fetch data for a single day
const fetchDayData = async (date) => {
  try {
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)
    
    
    const requestParams = getRequestParams(dayStart, dayEnd)
    
    const response = await metricsApi.getSubaffiliateSummary(requestParams)
    
    // Add date information to each record
    let data = []
    if (response.data && response.data.success === false) {
      throw new Error(response.data.error || 'Failed to fetch subaffiliate data')
    } else if (response.data?.data?.data?.data && Array.isArray(response.data.data.data.data)) {
      // Affluent API returns nested structure: { data: { success: true, data: { row_count: X, data: [...] } } }
      data = response.data.data.data.data.map(item => ({
        ...item,
        fetched_date: dayStart.toISOString().split('T')[0] // Add date in YYYY-MM-DD format
      }))
      const rowCount = response.data.data.data.row_count || data.length
    } else if (response.data?.data?.data && Array.isArray(response.data.data.data)) {
      // Alternative structure: { data: { success: true, data: [...] } }
      data = response.data.data.data.map(item => ({
        ...item,
        fetched_date: dayStart.toISOString().split('T')[0]
      }))
    } else if (response.data?.data && Array.isArray(response.data.data)) {
      // Simpler structure: { data: [...] }
      data = response.data.data.map(item => ({
        ...item,
        fetched_date: dayStart.toISOString().split('T')[0]
      }))
    } else {
      data = []
    }
    
    return data
  } catch (error) {
    throw error
  }
}

// Apply date filter and fetch data
const applyDateFilter = async () => {
  if (!startDateLocal.value || !endDateLocal.value) return
  
  if (!props.apiKey || (props.apiType !== 'prescott' && !props.affiliateId)) {
    localErrorState.value = "API credentials are missing"
    return
  }
  
  // Get all dates in range
  const dateRange = getDatesInRange(startDateLocal.value, endDateLocal.value)
  totalDays.value = dateRange.length
  processedDays.value = 0
  pendingRequests.value = dateRange.length
  
  // Clear previous data and error
  combinedData.value = []
  selectedSubId.value = null
  filters.value.subId = null
  localErrorState.value = null
  
  // Set loading state
  localLoadingState.value = true
  
  try {
    // Create an array to hold all promises
    const promises = dateRange.map(date => {
      // Return a promise that will handle its own completion
      return fetchDayData(date)
        .then(dayData => {
          // Update progress and return data
          processedDays.value++
          return dayData
        })
        .catch(error => {
          // Update progress even on error, but return empty array
          processedDays.value++
          return [] // Return empty array to continue with other dates
        })
    })
    
    // Wait for all promises to resolve (in parallel)
    const results = await Promise.all(promises)
    
    // Combine all results
    const allData = results.flat()
    combinedData.value = allData
    
    // Check if we got any data
    if (allData.length === 0) {
      localErrorState.value = "No data found for the selected date range."
    }
  } catch (error) {
    localErrorState.value = error.message || "Failed to fetch data for the selected date range."
  } finally {
    localLoadingState.value = false
  }
}
</script>

<template>
  <div>
    <!-- Date range and Sub ID selection -->
    <v-card class="date-filters mb-6 elevation-2 rounded-lg" variant="elevated">
      <v-card-title class="pb-2 d-flex align-center">
        <v-icon icon="mdi-calendar-range" color="primary" class="mr-2"></v-icon>
        <span class="text-h6">Date Range & Filters</span>
      </v-card-title>
      
      <v-divider></v-divider>
      
      <v-card-text class="pa-4">
        <div class="d-flex flex-column">
          <!-- Date pickers and fetch button -->
          <div class="d-flex flex-wrap align-center justify-space-between mb-3">
            <div class="date-range-container d-flex flex-wrap align-center">
              <div class="me-4 mb-2 date-picker-container">
                <label class="text-body-1 mb-1 d-block font-weight-medium">Start Date</label>
                <Datepicker 
                  v-model="startDateLocal" 
                  :max-date="endDateLocal || new Date()"
                  auto-apply
                  :enable-time-picker="false"
                  text-input
                  placeholder="Select start date"
                  position="bottom"
                  @update:model-value="onStartDateChange"
                  :dark="isDarkMode"
                  class="date-picker"
                />
              </div>
              
              <div class="me-4 mb-2 date-picker-container">
                <label class="text-body-1 mb-1 d-block font-weight-medium">End Date</label>
                <Datepicker 
                  v-model="endDateLocal" 
                  :min-date="startDateLocal"
                  :max-date="new Date()"
                  auto-apply
                  :enable-time-picker="false"
                  text-input
                  placeholder="Select end date"
                  position="bottom"
                  @update:model-value="onEndDateChange"
                  :dark="isDarkMode"
                  class="date-picker"
                />
              </div>
            </div>
            
            <div class="mb-2">
              <v-btn 
                color="primary" 
                :loading="loadingSubaffiliateSummary"
                :disabled="!startDateLocal || !endDateLocal || !apiKey || (props.apiType !== 'prescott' && !affiliateId)"
                @click="applyDateFilter"
                variant="elevated"
                prepend-icon="mdi-refresh"
                class="fetch-btn"
              >
                Fetch Daily Data
              </v-btn>
            </div>
          </div>
          
          <!-- Preset date range buttons -->
          <div class="d-flex flex-wrap gap-2 mb-4">
            <v-btn 
              variant="tonal" 
              size="small" 
              @click="setToday"
              color="primary"
            >
              Today
            </v-btn>
            <v-btn 
              variant="tonal" 
              size="small" 
              @click="setYesterday"
              color="primary"
            >
              Yesterday
            </v-btn>
            <v-btn 
              variant="tonal" 
              size="small" 
              @click="setLast7Days"
              color="primary"
            >
              Last 7 Days
            </v-btn>
            <v-btn 
              variant="tonal" 
              size="small" 
              @click="setLast30Days"
              color="primary"
            >
              Last 30 Days
            </v-btn>
            <v-btn 
              variant="tonal" 
              size="small" 
              @click="setThisMonth"
              color="primary"
            >
              This Month
            </v-btn>
            <v-btn 
              variant="tonal" 
              size="small" 
              @click="setLastMonth"
              color="primary"
            >
              Last Month
            </v-btn>
            <v-btn 
              variant="tonal" 
              size="small" 
              @click="setYearToDate"
              color="primary"
            >
              Year to Date
            </v-btn>
          </div>
        </div>
        
        <!-- Sub ID Filter -->
        <div class="mt-4">
          <v-autocomplete
            v-model="selectedSubId"
            :items="availableSubIds"
            label="Filter by Sub ID"
            clearable
            placeholder="All Sub IDs"
            density="comfortable"
            variant="outlined"
            hide-details
            prepend-inner-icon="mdi-filter-variant"
            class="sub-id-filter"
            @update:model-value="filterBySubId"
          >
            <template v-slot:selection="{ item }">
              <div class="d-flex align-center">
                <v-icon icon="mdi-account" size="small" class="mr-2"></v-icon>
                <span>{{ item.raw }}</span>
              </div>
            </template>
          </v-autocomplete>
        </div>
        
      </v-card-text>
    </v-card>
    
    <!-- Progress Indicator Card -->
    <v-card v-if="loadingSubaffiliateSummary" class="mb-6 progress-card elevation-2 rounded-lg" variant="elevated">
      <v-card-text class="pa-4">
        <div class="d-flex flex-column justify-center align-center py-4">
          <v-progress-circular indeterminate color="primary" size="56"></v-progress-circular>
          <span class="mt-4 text-body-1">Loading data for each day in range...</span>
          <div v-if="totalDays > 0" class="mt-3 text-body-2 progress-text">
            <v-progress-linear
              :model-value="(processedDays / totalDays) * 100"
              color="primary"
              height="10"
              rounded
              class="mb-2"
            ></v-progress-linear>
            Processed {{ processedDays }} of {{ totalDays }} days ({{ Math.round((processedDays / totalDays) * 100) }}%)
          </div>
        </div>
      </v-card-text>
    </v-card>
    
    <!-- Error message -->
    <v-alert
      v-if="subaffiliateSummaryError"
      type="error"
      class="mb-4 elevation-1"
      variant="elevated"
      border="start"
      closable
      prominent
    >
      <template v-slot:prepend>
        <v-icon icon="mdi-alert-circle" color="error"></v-icon>
      </template>
      {{ subaffiliateSummaryError }}
    </v-alert>
    
    <!-- Chart Section -->
    <v-card class="mb-6 elevation-2 rounded-lg chart-card" variant="elevated">
      <v-card-title class="pb-2 d-flex align-center">
        <v-icon icon="mdi-chart-line" color="primary" class="mr-2"></v-icon>
        <span class="text-h6">Subaffiliate Metrics Trend</span>
      </v-card-title>
      
      <v-divider></v-divider>
      
      <v-card-text class="pa-4">
        <div v-if="!loadingSubaffiliateSummary && displayData.length === 0" class="text-center py-4 empty-data">
          <v-icon icon="mdi-chart-line-variant" size="large" class="mb-2 opacity-50"></v-icon>
          <p>No data available for the selected date range.</p>
          <p class="text-caption">Try selecting a different date range or API.</p>
        </div>
        
        <SubaffiliateLineChart
          v-else
          :data="displayData"
          :start-date="startDateLocal"
          :end-date="endDateLocal"
        />
      </v-card-text>
    </v-card>
    
    <!-- Table Section -->
    <v-card class="elevation-2 rounded-lg table-card" variant="elevated">
      <v-card-title class="pb-2 d-flex align-center">
        <v-icon icon="mdi-table" color="primary" class="mr-2"></v-icon>
        <span class="text-h6">Subaffiliate Data</span>
      </v-card-title>
      
      <v-divider></v-divider>
      
      <v-card-text class="pa-4">
        <SubaffiliateSummaryTable
          :data="displayData"
          :loading="loadingSubaffiliateSummary"
          :error="subaffiliateSummaryError"
          :start-date="startDateLocal"
          :end-date="endDateLocal"
          :format-date="formatDate"
        />
      </v-card-text>
    </v-card>
  </div>
</template>

<style>
:root {
  --datepicker-bg: #ffffff;
  --datepicker-text: #333333;
  --chart-card-bg: #ffffff;
  --table-card-bg: #ffffff;
  --progress-card-bg: #ffffff;
  --empty-data-color: #757575;
  --progress-text-color: #757575;
  --transition-speed: 0.3s;
}

[data-theme="dark"] {
  --datepicker-bg: #1e1e1e;
  --datepicker-text: #ffffff;
  --chart-card-bg: #1e1e1e;
  --table-card-bg: #1e1e1e;
  --progress-card-bg: #1e1e1e;
  --empty-data-color: #b0bec5;
  --progress-text-color: #b0bec5;
}
</style>

<style scoped>
/* Date picker container and positioning fixes */
.date-filters {
  overflow: visible !important;
  position: relative;
  z-index: 1;
  background-color: var(--datepicker-bg) !important;
  transition: background-color var(--transition-speed) ease;
}

.date-picker-container {
  position: relative;
  z-index: 2;
  width: 200px;
}

.chart-card, .table-card {
  background-color: var(--chart-card-bg) !important;
  transition: background-color var(--transition-speed) ease;
}

.progress-card {
  background-color: var(--progress-card-bg) !important;
  transition: background-color var(--transition-speed) ease;
}

.empty-data {
  color: var(--empty-data-color);
  transition: color var(--transition-speed) ease;
}

.progress-text {
  color: var(--progress-text-color);
  transition: color var(--transition-speed) ease;
}

.fetch-btn {
  transition: all var(--transition-speed) ease;
}

.fetch-btn:hover {
  transform: translateY(-2px);
}

.sub-id-filter {
  max-width: 100%;
  transition: all var(--transition-speed) ease;
}

/* Fix for date picker z-index issue */
:deep(.dp__outer_menu) {
  z-index: 100 !important;
}

:deep(.dp__menu) {
  z-index: 100 !important;
  background-color: var(--datepicker-bg) !important;
  color: var(--datepicker-text) !important;
  transition: all var(--transition-speed) ease;
}

:deep(.dp__overlay) {
  z-index: 100 !important;
}

/* Make sure the date picker input doesn't get clipped */
:deep(.dp__input) {
  z-index: 2;
  background-color: var(--datepicker-bg) !important;
  color: var(--datepicker-text) !important;
  transition: all var(--transition-speed) ease;
  border-radius: 8px;
}

/* Ensure the date picker popup has enough space */
:deep(.dp__instance_calendar) {
  position: absolute;
  margin-top: 0;
  background-color: var(--datepicker-bg) !important;
  transition: all var(--transition-speed) ease;
}

/* Set background color for all date picker components */
:deep(.dp__main) {
  background-color: var(--datepicker-bg) !important;
  transition: all var(--transition-speed) ease;
}

:deep(.dp__calendar_header) {
  background-color: var(--datepicker-bg) !important;
  color: var(--datepicker-text) !important;
  transition: all var(--transition-speed) ease;
}

:deep(.dp__calendar) {
  background-color: var(--datepicker-bg) !important;
  color: var(--datepicker-text) !important;
  transition: all var(--transition-speed) ease;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .date-range-container {
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
  }
  
  .date-picker-container {
    width: 100%;
    margin-right: 0 !important;
  }
  
  .fetch-btn {
    width: 100%;
    margin-top: 16px;
  }
  
  .sub-id-filter {
    width: 100%;
  }
}
</style>