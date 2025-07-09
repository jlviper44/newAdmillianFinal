<script setup>
import { metricsApi } from '@/services/api'
import { ref, computed, onMounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import Datepicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import HourlyChart from './Components/HourlyChart.vue'
import DataTables from './Components/DataTables.vue'

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
  }
})

// Data
const clicksData = ref([])
const conversionsData = ref([])

// Loading states
const loadingClicks = ref(false)
const loadingConversions = ref(false)

// Error states
const clicksError = ref(null)
const conversionsError = ref(null)

// Date states
const startDate = ref(null)
const endDate = ref(null)
const selectedDate = ref(new Date())

// Filter state
const filters = ref({
  offerName: null,
  subId: null,
  subId2: null
})

// Set default date to today
const today = new Date()

// Set initial start and end dates to today
startDate.value = new Date(today)
startDate.value.setHours(0, 0, 0, 0)
endDate.value = new Date(today)
endDate.value.setHours(23, 59, 59, 999)

// Handle date change
const onSelectedDateChange = (date) => {
  if (date) {
    // Create new Date objects for start and end
    const selectedDateObj = new Date(date)
    
    // Set start time to 00:00:00
    const startDateObj = new Date(selectedDateObj)
    startDateObj.setHours(0, 0, 0, 0)
    
    // Set end time to 23:59:59
    const endDateObj = new Date(selectedDateObj)
    endDateObj.setHours(23, 59, 59, 999)
    
    // Update local date state
    startDate.value = startDateObj
    endDate.value = endDateObj
  }
}

// Date formatters
const formatDateForDisplay = (date) => {
  if (!date) return ''
  return date.toLocaleDateString()
}

// New formatter to include both date and time
const formatDateAndTime = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

// Format for API requests (YYYY-MM-DD HH:MM:SS)
const formatDateForApi = (date, isEndDate = false) => {
  if (!date) return ''
  
  // Create a new date object to avoid modifying the original
  const formattedDate = new Date(date)
  
  // Set time to 00:00:00 for start date or 23:59:59 for end date
  if (isEndDate) {
    formattedDate.setHours(23, 59, 59, 999)
  } else {
    formattedDate.setHours(0, 0, 0, 0)
  }
  
  // Format as YYYY-MM-DD HH:MM:SS
  const year = formattedDate.getFullYear()
  const month = String(formattedDate.getMonth() + 1).padStart(2, '0')
  const day = String(formattedDate.getDate()).padStart(2, '0')
  const hours = String(formattedDate.getHours()).padStart(2, '0')
  const minutes = String(formattedDate.getMinutes()).padStart(2, '0')
  const seconds = String(formattedDate.getSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// Define field arrays for each data type
const clicksFields = [
  'click_date',
  'offer',
  'subid_1',
  'subid_2'
]

const conversionsFields = [
  'conversion_date',
  'offer_name',
  'subid_1',
  'subid_2',
  'price'
]

// Function to prepare common request parameters
const getRequestParams = (fields = []) => {
  const params = {
    api_key: props.apiKey,
    affiliate_id: props.affiliateId,
    start_date: formatDateForApi(startDate.value, false),
    end_date: formatDateForApi(endDate.value, true),
    fields: fields
  }
  
  return params
}

// Function to fetch clicks data
const fetchClicksData = async () => {
  if (!startDate.value || !endDate.value || !props.apiKey || !props.affiliateId) {
    return
  }
  
  try {
    loadingClicks.value = true
    clicksError.value = null
    
    const response = await metricsApi.getClicks(getRequestParams(clicksFields))
    
    // Process clicks data
    if (response.data && response.data.success === false) {
      // API returned an error
      clicksError.value = response.data.error || 'Failed to fetch clicks data'
      clicksData.value = []
    } else if (response.data?.data?.data?.data && Array.isArray(response.data.data.data.data)) {
      // Affluent API returns nested structure: { data: { success: true, data: { row_count: X, data: [...] } } }
      clicksData.value = response.data.data.data.data
      const rowCount = response.data.data.data.row_count || clicksData.value.length
    } else if (response.data?.data?.data && Array.isArray(response.data.data.data)) {
      // Alternative structure: { data: { success: true, data: [...] } }
      clicksData.value = response.data.data.data
    } else if (response.data?.data && Array.isArray(response.data.data)) {
      // Simpler structure: { data: [...] }
      clicksData.value = response.data.data
    } else {
      clicksData.value = []
    }
    console.log(clicksData.value)
  } catch (err) {
    clicksError.value = err.response?.data?.error || err.message || `Failed to fetch clicks data`
  } finally {
    loadingClicks.value = false
  }
}

// Function to fetch conversions data
const fetchConversionsData = async () => {
  if (!startDate.value || !endDate.value || !props.apiKey || !props.affiliateId) {
    return
  }
  
  try {
    loadingConversions.value = true
    conversionsError.value = null
    
    const response = await metricsApi.getConversions(getRequestParams(conversionsFields))
    
    // Process conversions data
    if (response.data && response.data.success === false) {
      // API returned an error
      conversionsError.value = response.data.error || 'Failed to fetch conversions data'
      conversionsData.value = []
    } else if (response.data?.data?.data?.data && Array.isArray(response.data.data.data.data)) {
      // Affluent API returns nested structure: { data: { success: true, data: { row_count: X, data: [...] } } }
      conversionsData.value = response.data.data.data.data
      const rowCount = response.data.data.data.row_count || conversionsData.value.length
    } else if (response.data?.data?.data && Array.isArray(response.data.data.data)) {
      // Alternative structure: { data: { success: true, data: [...] } }
      conversionsData.value = response.data.data.data
    } else if (response.data?.data && Array.isArray(response.data.data)) {
      // Simpler structure: { data: [...] }
      conversionsData.value = response.data.data
    } else {
      conversionsData.value = []
    }
  } catch (err) {
    conversionsError.value = err.response?.data?.error || err.message || `Failed to fetch conversions data`
  } finally {
    loadingConversions.value = false
  }
}

// Function to fetch all performance data
const fetchAllData = () => {
  if (!startDate.value || !endDate.value) {
    // Set performance error states to show the same message
    clicksError.value = "Please select both start and end dates"
    conversionsError.value = "Please select both start and end dates"
    return
  }
  
  if (!props.apiKey || !props.affiliateId) {
    // Set error states to show API credentials missing
    clicksError.value = "API credentials are missing"
    conversionsError.value = "API credentials are missing"
    return
  }
  
  // Clear previous data
  clicksData.value = []
  conversionsData.value = []
  
  // Clear previous errors
  clicksError.value = null
  conversionsError.value = null
  
  // Fetch performance data types concurrently and independently
  fetchClicksData()
  fetchConversionsData()
}

// Computed properties for filter options
const offerNameOptions = computed(() => {
  const clicksOffers = clicksData.value
    .map(item => item.offer?.offer_name)
    .filter(name => name)
  
  const conversionOffers = conversionsData.value
    .map(item => item.offer_name)
    .filter(name => name)
  
  // Combine unique offer names from both datasets
  return [...new Set([...clicksOffers, ...conversionOffers])].sort()
})

const subIdOptions = computed(() => {
  const clicksSubIds = clicksData.value
    .map(item => item.subid_1)
    .filter(id => id)
  
  const conversionSubIds = conversionsData.value
    .map(item => item.subid_1)
    .filter(id => id)
  
  // Combine unique subids from both datasets
  return [...new Set([...clicksSubIds, ...conversionSubIds])].sort()
})

const subId2Options = computed(() => {
  const clicksSubIds2 = clicksData.value
    .map(item => item.subid_2)
    .filter(id => id)
  
  const conversionSubIds2 = conversionsData.value
    .map(item => item.subid_2)
    .filter(id => id)
  
  // Combine unique subid_2s from both datasets
  return [...new Set([...clicksSubIds2, ...conversionSubIds2])].sort()
})

// Function to apply filters
const applyFilters = () => {
  // Filters are automatically applied through computed properties
}

// Function to clear filters
const clearFilters = () => {
  filters.value.offerName = null
  filters.value.subId = null
  filters.value.subId2 = null
}

// Watch for changes in API credentials to refresh data
watch(
  [() => props.apiKey, () => props.affiliateId], 
  ([newApiKey, newAffiliateId], [oldApiKey, oldAffiliateId]) => {
    if ((newApiKey && newAffiliateId) && 
        (newApiKey !== oldApiKey || newAffiliateId !== oldAffiliateId)) {
      fetchAllData()
    }
  }
)

// Initialize with current dates and fetch data if API credentials are available
onMounted(() => {
  if (props.apiKey && props.affiliateId) {
    fetchAllData()
  }
})
</script>

<template>
  <div>
    <!-- Date range selection -->
    <v-card class="date-filters mb-6 elevation-2 rounded-lg" variant="elevated">
      <v-card-title class="pb-2 d-flex align-center">
        <v-icon icon="mdi-calendar" color="primary" class="mr-2"></v-icon>
        <span class="text-h6">Date Range</span>
      </v-card-title>
      
      <v-divider></v-divider>
      
      <v-card-text class="pa-4">
        <div class="d-flex flex-wrap align-center">
          <div class="me-4 mb-2 date-picker-container">
            <label class="text-body-1 mb-1 d-block font-weight-medium">Date</label>
            <Datepicker 
              v-model="selectedDate" 
              :max-date="new Date()"
              auto-apply
              :enable-time-picker="false"
              text-input
              placeholder="Select date"
              :format="formatDateForDisplay"
              position="bottom"
              @update:model-value="onSelectedDateChange"
              :dark="isDarkMode"
              class="performance-date-picker"
            />
          </div>
          
          <div class="mb-2 mt-4">
            <v-btn 
              color="primary" 
              :loading="loadingClicks || loadingConversions"
              :disabled="!startDate || !endDate || !apiKey || !affiliateId"
              @click="fetchAllData"
              variant="elevated"
              prepend-icon="mdi-refresh"
              class="apply-btn"
            >
              Apply Filters
            </v-btn>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- Hourly Chart Component -->
    <HourlyChart 
      :clicks-data="clicksData"
      :conversions-data="conversionsData"
      :loading="loadingClicks || loadingConversions"
      :filters="filters"
    />
    
    <!-- Filters for Performance Tab -->
    <v-card class="mb-4 pa-4 elevation-2 rounded-lg filter-card" variant="elevated">
      <v-card-title class="pb-2 d-flex align-center">
        <v-icon icon="mdi-filter" color="primary" class="mr-2"></v-icon>
        <span class="text-h6">Filters</span>
      </v-card-title>
      
      <v-divider></v-divider>
      
      <v-card-text class="pt-4">
        <div class="d-flex flex-wrap align-center">
          <v-autocomplete
            v-model="filters.offerName"
            :items="offerNameOptions"
            label="Filter by Offer Name"
            variant="outlined"
            clearable
            class="me-4 mb-2 filter-input"
            style="min-width: 250px;"
            density="comfortable"
            hide-details
            prepend-inner-icon="mdi-tag-multiple"
            @update:model-value="applyFilters"
          ></v-autocomplete>
          
          <v-autocomplete
            v-model="filters.subId"
            :items="subIdOptions"
            label="Filter by Sub ID"
            variant="outlined"
            clearable
            class="me-4 mb-2 filter-input"
            style="min-width: 250px;"
            density="comfortable"
            hide-details
            prepend-inner-icon="mdi-identifier"
            @update:model-value="applyFilters"
          ></v-autocomplete>
          
          <v-autocomplete
            v-model="filters.subId2"
            :items="subId2Options"
            label="Filter by Sub ID 2"
            variant="outlined"
            clearable
            class="me-4 mb-2 filter-input"
            style="min-width: 250px;"
            density="comfortable"
            hide-details
            prepend-inner-icon="mdi-identifier"
            @update:model-value="applyFilters"
          ></v-autocomplete>
          
          <v-btn 
            color="secondary" 
            variant="tonal" 
            class="mb-2 clear-btn"
            prepend-icon="mdi-close"
            @click="clearFilters"
          >
            Clear Filters
          </v-btn>
        </div>
      </v-card-text>
    </v-card>
    
    <!-- Data Tables Component -->
    <DataTables
      :clicks-data="clicksData"
      :conversions-data="conversionsData"
      :loading-clicks="loadingClicks"
      :loading-conversions="loadingConversions"
      :clicks-error="clicksError"
      :conversions-error="conversionsError"
      :format-date-and-time="formatDateAndTime"
      :filters="filters"
    />
  </div>
</template>

<style>
:root {
  --datepicker-bg: #ffffff;
  --datepicker-text: #333333;
  --filter-card-bg: #ffffff;
  --transition-speed: 0.3s;
}

[data-theme="dark"] {
  --datepicker-bg: #1e1e1e;
  --datepicker-text: #ffffff;
  --filter-card-bg: #1e1e1e;
}
</style>

<style scoped>
/* Date picker container and positioning fixes */
.date-filters, .filter-card {
  background-color: var(--filter-card-bg) !important;
  transition: background-color var(--transition-speed) ease;
  overflow: visible !important;
  position: relative;
  z-index: 1;
}

.date-picker-container {
  position: relative;
  z-index: 2;
  width: 250px;
}

.apply-btn, .clear-btn {
  transition: all var(--transition-speed) ease;
}

.apply-btn:hover, .clear-btn:hover {
  transform: translateY(-2px);
}

.filter-input {
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

/* Responsive styles */
@media (max-width: 768px) {
  .date-picker-container {
    width: 100%;
  }
  
  .apply-btn {
    width: 100%;
    margin-top: 16px;
  }
  
  .filter-input {
    width: 100%;
    min-width: 100% !important;
    margin-right: 0 !important;
  }
  
  .clear-btn {
    width: 100%;
    margin-top: 8px;
  }
}
</style>