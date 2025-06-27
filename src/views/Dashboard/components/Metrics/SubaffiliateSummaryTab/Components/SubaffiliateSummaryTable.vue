<script setup>
import { ref, watch, computed } from 'vue'

// Props from parent component
const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    required: true
  },
  error: {
    type: String,
    default: null
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  formatDate: {
    type: Function,
    required: true
  }
})

// Local state
const exporting = ref(false)

// Table headers
const tableHeaders = ref([
  { title: 'Date', key: 'fetched_date', align: 'start', sortable: true },
  { title: 'Sub ID', key: 'sub_id', align: 'start', sortable: true },
  { title: 'Clicks', key: 'clicks', align: 'end', sortable: true },
  { title: 'Conversions', key: 'conversions', align: 'end', sortable: true },
  { title: 'Revenue', key: 'revenue', align: 'end', sortable: true },
  { title: 'EPC', key: 'epc', align: 'end', sortable: true },
  { title: 'Events', key: 'events', align: 'end', sortable: true }
])

// Dynamically update headers based on actual data structure
watch(() => props.data, (newData) => {
  if (newData && newData.length > 0) {
    const sampleItem = newData[0]
    
    // Make sure fetched_date is always first
    const updatedHeaders = [
      { title: 'Date', key: 'fetched_date', align: 'start', sortable: true }
    ]
    
    // Add all other keys (except fetched_date which we already added)
    Object.keys(sampleItem)
      .filter(key => key !== 'fetched_date')
      .forEach(key => {
        const isNumeric = ['clicks', 'conversions', 'revenue', 'epc', 'events'].includes(key)
        
        updatedHeaders.push({
          title: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
          key: key,
          align: isNumeric ? 'end' : 'start',
          sortable: true
        })
      })
    
    tableHeaders.value = updatedHeaders
  }
}, { immediate: true, deep: true })

// Function to export data to CSV
const exportToCsv = () => {
  exporting.value = true
  
  try {
    // Get headers
    const headerRow = tableHeaders.value.map(header => header.title)
    
    // Format data rows
    const dataRows = props.data.map(item => {
      return tableHeaders.value.map(header => {
        const value = item[header.key]
        
        // Format date
        if (header.key === 'fetched_date' && value) {
          return props.formatDate(new Date(value))
        }
        
        // Format currency values
        if (['revenue', 'epc'].includes(header.key) && value) {
          return parseFloat(value).toFixed(2)
        }
        
        return value !== undefined ? value : ''
      })
    })
    
    // Combine headers and rows
    const csvContent = [headerRow, ...dataRows].map(row => row.join(',')).join('\n')
    
    // Create a blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `subaffiliate_data_${formatDateForFilename(props.startDate)}_to_${formatDateForFilename(props.endDate)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Error exporting data to CSV:', error)
  } finally {
    exporting.value = false
  }
}

// Helper to format date for filename
const formatDateForFilename = (date) => {
  if (!date) return 'unknown-date'
  
  const d = new Date(date)
  return d.toISOString().split('T')[0]
}
</script>

<template>
  <div>
    <!-- Export button and info when data is available -->
    <div class="d-flex align-center justify-space-between mb-4" v-if="!loading && data.length > 0">
      <div class="table-info">
        <v-chip color="primary" size="small" variant="elevated" class="mr-2">
          {{ data.length }} records
        </v-chip>
        <span class="text-caption date-range" v-if="startDate && endDate">
          {{ formatDate(startDate) }} - {{ formatDate(endDate) }}
        </span>
      </div>
      
      <v-btn 
        color="primary" 
        variant="tonal" 
        size="small" 
        @click="exportToCsv"
        :loading="exporting"
        prepend-icon="mdi-file-export"
      >
        Export to CSV
      </v-btn>
    </div>
    
    <!-- Empty state or loading -->
    <div v-if="loading || (data.length === 0 && !error)">
      <!-- Loading state -->
      <div v-if="loading" class="text-center py-6 loading-container">
        <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
        <p class="mt-4 text-medium-emphasis">Loading data...</p>
      </div>
      
      <!-- No data message -->
      <v-alert
        v-else
        type="info"
        variant="tonal"
        class="mt-4"
        border="start"
      >
        <template v-slot:prepend>
          <v-icon icon="mdi-information" color="info"></v-icon>
        </template>
        <div>
          <p>No subaffiliate summary data available for the selected period.</p>
          <p class="text-caption mt-2">Try selecting a different date range or API.</p>
        </div>
      </v-alert>
    </div>
    
    <!-- Data table when data is available -->
    <div v-else-if="data.length > 0" class="table-container">
      <v-data-table
        :headers="tableHeaders"
        :items="data"
        :items-per-page="10"
        :footer-props="{
          'items-per-page-options': [10, 20, 50, 100]
        }"
        class="elevation-1 summary-table"
        hover
        density="comfortable"
      >
        <!-- Custom cell formatting -->
        
        <!-- Date cell -->
        <template v-slot:item.fetched_date="{ item }">
          <div class="date-cell">
            {{ formatDate(new Date(item.fetched_date)) }}
          </div>
        </template>
        
        <!-- Sub ID cell -->
        <template v-slot:item.sub_id="{ item }">
          <div class="sub-id-cell">
            <v-chip 
              size="small" 
              color="primary" 
              variant="flat" 
              class="font-monospace"
            >
              {{ item.sub_id }}
            </v-chip>
          </div>
        </template>
        
        <!-- Clicks cell -->
        <template v-slot:item.clicks="{ item }">
          <div class="numeric-cell">
            {{ item.clicks }}
          </div>
        </template>
        
        <!-- Conversions cell -->
        <template v-slot:item.conversions="{ item }">
          <div class="numeric-cell">
            {{ item.conversions }}
          </div>
        </template>
        
        <!-- Revenue cell -->
        <template v-slot:item.revenue="{ item }">
          <div class="revenue-cell">
            ${{ parseFloat(item.revenue).toFixed(2) }}
          </div>
        </template>
        
        <!-- EPC cell -->
        <template v-slot:item.epc="{ item }">
          <div class="epc-cell">
            ${{ parseFloat(item.epc).toFixed(2) }}
          </div>
        </template>
        
        <!-- Events cell -->
        <template v-slot:item.events="{ item }">
          <div class="numeric-cell">
            {{ item.events }}
          </div>
        </template>
      </v-data-table>
    </div>
  </div>
</template>

<style>
:root {
  --table-bg: #ffffff;
  --table-header-bg: #f5f7fa;
  --table-row-hover: rgba(25, 118, 210, 0.05);
  --table-text: #333333;
  --date-range-color: #757575;
  --revenue-color: #43a047;
  --epc-color: #9c27b0;
  --transition-speed: 0.3s;
}

[data-theme="dark"] {
  --table-bg: #1e1e1e;
  --table-header-bg: #2d2d2d;
  --table-row-hover: rgba(100, 181, 246, 0.1);
  --table-text: #e0e0e0;
  --date-range-color: #b0bec5;
  --revenue-color: #81c784;
  --epc-color: #ce93d8;
}
</style>

<style scoped>
.table-container {
  border-radius: 8px;
  overflow: hidden;
  transition: all var(--transition-speed) ease;
}

.summary-table {
  background-color: var(--table-bg) !important;
  transition: background-color var(--transition-speed) ease;
}

:deep(.v-data-table__tr:hover) {
  background-color: var(--table-row-hover) !important;
}

:deep(.v-data-table-header) {
  background-color: var(--table-header-bg) !important;
  transition: background-color var(--transition-speed) ease;
}

.date-range {
  color: var(--date-range-color);
  transition: color var(--transition-speed) ease;
}

.date-cell, .sub-id-cell, .numeric-cell {
  color: var(--table-text);
  transition: color var(--transition-speed) ease;
}

.revenue-cell {
  color: var(--revenue-color);
  font-weight: bold;
  transition: color var(--transition-speed) ease;
}

.epc-cell {
  color: var(--epc-color);
  font-weight: bold;
  transition: color var(--transition-speed) ease;
}

.font-monospace {
  font-family: monospace;
}

.loading-container {
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

@media (max-width: 600px) {
  .table-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  
  .date-range {
    margin-top: 8px;
  }
}
</style>