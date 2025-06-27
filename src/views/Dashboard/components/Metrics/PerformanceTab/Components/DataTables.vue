<script setup>
import { computed, ref } from 'vue'

// Define props from parent component
const props = defineProps({
  clicksData: {
    type: Array,
    required: true
  },
  conversionsData: {
    type: Array,
    required: true
  },
  loadingClicks: {
    type: Boolean,
    required: true
  },
  loadingConversions: {
    type: Boolean,
    required: true
  },
  clicksError: {
    type: String,
    default: null
  },
  conversionsError: {
    type: String,
    default: null
  },
  formatDateAndTime: {
    type: Function,
    required: true
  },
  filters: {
    type: Object,
    default: () => ({
      offerName: null,
      subId: null
    })
  }
})

// Exporting state
const exporting = ref({
  clicks: false,
  conversions: false
})

// Table headers for clicks
const clicksHeaders = [
  { title: 'Date & Time', key: 'click_date', sortable: true, align: 'start' },
  { title: 'Offer Name', key: 'offer.offer_name', sortable: true, align: 'start' },
  { title: 'Sub ID', key: 'subid_1', sortable: true, align: 'start' }
]

// Table headers for conversions
const conversionsHeaders = [
  { title: 'Date & Time', key: 'conversion_date', sortable: true, align: 'start' },
  { title: 'Offer Name', key: 'offer_name', sortable: true, align: 'start' },
  { title: 'Sub ID', key: 'subid_1', sortable: true, align: 'start' },
  { title: 'Price', key: 'price', sortable: true, align: 'end' }
]

// Filtered data based on selected filters
const filteredClicksData = computed(() => {
  let filtered = [...props.clicksData]
  
  if (props.filters.offerName) {
    filtered = filtered.filter(item => 
      item.offer?.offer_name === props.filters.offerName
    )
  }
  
  if (props.filters.subId) {
    filtered = filtered.filter(item => 
      item.subid_1 === props.filters.subId
    )
  }
  
  return filtered
})

const filteredConversionsData = computed(() => {
  let filtered = [...props.conversionsData]
  
  if (props.filters.offerName) {
    filtered = filtered.filter(item => 
      item.offer_name === props.filters.offerName
    )
  }
  
  if (props.filters.subId) {
    filtered = filtered.filter(item => 
      item.subid_1 === props.filters.subId
    )
  }
  
  return filtered
})

// Function to export clicks data to CSV
const exportClicksData = () => {
  exporting.value.clicks = true
  
  try {
    // Convert data to CSV format
    const headers = ['Date & Time', 'Offer Name', 'Sub ID']
    const csvContent = filteredClicksData.value.map(item => {
      const date = props.formatDateAndTime(item.click_date)
      const offerName = item.offer?.offer_name || ''
      const subId = item.subid_1 || ''
      
      return [date, offerName, subId].join(',')
    })
    
    // Add headers row
    csvContent.unshift(headers.join(','))
    
    // Create download link
    const csvString = csvContent.join('\n')
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    
    // Create and trigger download
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `clicks_export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Error exporting clicks data:', error)
  } finally {
    exporting.value.clicks = false
  }
}

// Function to export conversions data to CSV
const exportConversionsData = () => {
  exporting.value.conversions = true
  
  try {
    // Convert data to CSV format
    const headers = ['Date & Time', 'Offer Name', 'Sub ID', 'Price']
    const csvContent = filteredConversionsData.value.map(item => {
      const date = props.formatDateAndTime(item.conversion_date)
      const offerName = item.offer_name || ''
      const subId = item.subid_1 || ''
      const price = item.price || '0.00'
      
      return [date, offerName, subId, price].join(',')
    })
    
    // Add headers row
    csvContent.unshift(headers.join(','))
    
    // Create download link
    const csvString = csvContent.join('\n')
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    
    // Create and trigger download
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `conversions_export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Error exporting conversions data:', error)
  } finally {
    exporting.value.conversions = false
  }
}
</script>

<template>
  <div>
    <!-- Error message container for both tables -->
    <div v-if="clicksError || conversionsError" class="mb-4">
      <v-alert
        v-if="clicksError"
        type="error"
        class="mb-2 elevation-1"
        variant="elevated"
        border="start"
        closable
        prominent
      >
        <template v-slot:prepend>
          <v-icon icon="mdi-alert-circle" color="error"></v-icon>
        </template>
        {{ clicksError }}
      </v-alert>
      
      <v-alert
        v-if="conversionsError"
        type="error"
        class="mb-2 elevation-1"
        variant="elevated"
        border="start"
        closable
        prominent
      >
        <template v-slot:prepend>
          <v-icon icon="mdi-alert-circle" color="error"></v-icon>
        </template>
        {{ conversionsError }}
      </v-alert>
    </div>
    
    <!-- Side-by-side tables using grid layout -->
    <v-row>
      <!-- Clicks Table Column -->
      <v-col cols="12" md="6">
        <v-card class="data-card elevation-2 rounded-lg mb-4" variant="elevated">
          <v-card-title class="pb-2 d-flex align-center">
            <v-icon icon="mdi-cursor-default-click" color="primary" class="mr-2"></v-icon>
            <span class="text-h6">Clicks</span>
            
            <v-chip 
              v-if="!loadingClicks && filteredClicksData.length > 0"
              color="primary" 
              class="ml-2"
              size="small"
              variant="elevated"
            >
              {{ filteredClicksData.length }}
            </v-chip>
            
            <v-spacer></v-spacer>
            
            <v-btn 
              v-if="filteredClicksData.length > 0"
              icon 
              variant="text" 
              color="primary"
              @click="exportClicksData"
              :loading="exporting.clicks"
              size="small"
            >
              <v-icon icon="mdi-download"></v-icon>
              <v-tooltip activator="parent" location="top">Export to CSV</v-tooltip>
            </v-btn>
          </v-card-title>
          
          <v-divider></v-divider>
          
          <v-card-text class="pa-0">
            <!-- Loading state -->
            <div v-if="loadingClicks" class="d-flex justify-center align-center py-6">
              <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
              <span class="ml-4 text-body-1">Loading clicks data...</span>
            </div>
            
            <!-- Clicks Data table -->
            <v-data-table
              v-if="!loadingClicks && filteredClicksData.length > 0"
              :headers="clicksHeaders"
              :items="filteredClicksData"
              :items-per-page="10"
              :footer-props="{
                'items-per-page-options': [10, 20, 50]
              }"
              class="clicks-table"
              density="comfortable"
              hover
            >
              <!-- Custom formatting for date columns to include time -->
              <template v-slot:item.click_date="{ item }">
                <div class="date-time-cell">
                  {{ formatDateAndTime(item.click_date) }}
                </div>
              </template>
              
              <!-- Custom formatting for offer name column -->
              <template v-slot:item.offer.offer_name="{ item }">
                <div class="offer-name-cell">
                  <v-chip 
                    color="primary" 
                    size="small" 
                    variant="flat" 
                    class="mr-1"
                  >
                    {{ item.offer?.offer_name }}
                  </v-chip>
                </div>
              </template>
              
              <!-- Custom formatting for sub ID column -->
              <template v-slot:item.subid_1="{ item }">
                <div class="subid-cell">
                  <span class="font-monospace">{{ item.subid_1 }}</span>
                </div>
              </template>
            </v-data-table>
            
            <!-- No data message -->
            <v-alert
              v-if="!loadingClicks && filteredClicksData.length === 0 && !clicksError"
              type="info"
              class="ma-4"
            >
              <template v-slot:prepend>
                <v-icon icon="mdi-information" color="info"></v-icon>
              </template>
              No clicks data available for the selected filters.
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>
      
      <!-- Conversions Table Column -->
      <v-col cols="12" md="6">
        <v-card class="data-card elevation-2 rounded-lg mb-4" variant="elevated">
          <v-card-title class="pb-2 d-flex align-center">
            <v-icon icon="mdi-cash-plus" color="success" class="mr-2"></v-icon>
            <span class="text-h6">Conversions</span>
            
            <v-chip 
              v-if="!loadingConversions && filteredConversionsData.length > 0"
              color="success" 
              class="ml-2"
              size="small"
              variant="elevated"
            >
              {{ filteredConversionsData.length }}
            </v-chip>
            
            <v-spacer></v-spacer>
            
            <v-btn 
              v-if="filteredConversionsData.length > 0"
              icon 
              variant="text" 
              color="success"
              @click="exportConversionsData"
              :loading="exporting.conversions"
              size="small"
            >
              <v-icon icon="mdi-download"></v-icon>
              <v-tooltip activator="parent" location="top">Export to CSV</v-tooltip>
            </v-btn>
          </v-card-title>
          
          <v-divider></v-divider>
          
          <v-card-text class="pa-0">
            <!-- Loading state -->
            <div v-if="loadingConversions" class="d-flex justify-center align-center py-6">
              <v-progress-circular indeterminate color="success" size="48"></v-progress-circular>
              <span class="ml-4 text-body-1">Loading conversions data...</span>
            </div>
            
            <!-- Conversions Data table -->
            <v-data-table
              v-if="!loadingConversions && filteredConversionsData.length > 0"
              :headers="conversionsHeaders"
              :items="filteredConversionsData"
              :items-per-page="10"
              :footer-props="{
                'items-per-page-options': [10, 20, 50]
              }"
              class="conversions-table"
              density="comfortable"
              hover
            >
              <!-- Custom formatting for date columns to include time -->
              <template v-slot:item.conversion_date="{ item }">
                <div class="date-time-cell">
                  {{ formatDateAndTime(item.conversion_date) }}
                </div>
              </template>
              
              <!-- Custom formatting for offer name column -->
              <template v-slot:item.offer_name="{ item }">
                <div class="offer-name-cell">
                  <v-chip 
                    color="success" 
                    size="small" 
                    variant="flat" 
                    class="mr-1"
                  >
                    {{ item.offer_name }}
                  </v-chip>
                </div>
              </template>
              
              <!-- Custom formatting for sub ID column -->
              <template v-slot:item.subid_1="{ item }">
                <div class="subid-cell">
                  <span class="font-monospace">{{ item.subid_1 }}</span>
                </div>
              </template>
              
              <!-- Custom formatting for price column -->
              <template v-slot:item.price="{ item }">
                <div class="price-cell">
                  <span class="font-weight-bold">${{ parseFloat(item.price).toFixed(2) }}</span>
                </div>
              </template>
            </v-data-table>
            
            <!-- No data message -->
            <v-alert
              v-if="!loadingConversions && filteredConversionsData.length === 0 && !conversionsError"
              type="info"
              class="ma-4"
            >
              <template v-slot:prepend>
                <v-icon icon="mdi-information" color="info"></v-icon>
              </template>
              No conversions data available for the selected filters.
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<style>
:root {
  --data-card-bg: #ffffff;
  --table-header-bg: #f5f7fa;
  --table-row-hover: rgba(25, 118, 210, 0.04);
  --table-border-color: rgba(0, 0, 0, 0.12);
  --cell-text-color: #333333;
  --transition-speed: 0.3s;
}

[data-theme="dark"] {
  --data-card-bg: #1e1e1e;
  --table-header-bg: #2d2d2d;
  --table-row-hover: rgba(100, 181, 246, 0.08);
  --table-border-color: rgba(255, 255, 255, 0.12);
  --cell-text-color: #e0e0e0;
}
</style>

<style scoped>
.data-card {
  background-color: var(--data-card-bg) !important;
  transition: background-color var(--transition-speed) ease;
  overflow: hidden;
}

:deep(.v-data-table) {
  background-color: var(--data-card-bg) !important;
  transition: background-color var(--transition-speed) ease;
}

:deep(.v-data-table__tr:hover) {
  background-color: var(--table-row-hover) !important;
}

:deep(.v-data-table-header) {
  background-color: var(--table-header-bg) !important;
  transition: background-color var(--transition-speed) ease;
}

.date-time-cell, .offer-name-cell, .subid-cell, .price-cell {
  color: var(--cell-text-color);
  transition: color var(--transition-speed) ease;
}

.font-monospace {
  font-family: monospace;
}

@media (max-width: 960px) {
  .v-col {
    padding: 6px;
  }
}
</style>