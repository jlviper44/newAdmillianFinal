<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useTheme } from 'vuetify'
import Chart from 'chart.js/auto'

// Initialize Vuetify theme
const theme = useTheme();

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
  loading: {
    type: Boolean,
    required: true
  },
  filters: {
    type: Object,
    default: () => ({
      offerName: null,
      subId: null,
      subId2: null
    })
  }
})

// Chart reference and instance
const hourlyChartRef = ref(null)
let chartInstance = null

// Get current theme
const isDarkMode = computed(() => {
  return theme.global.current.value.dark;
});

// Computed property to check if there's data to display
const dataAvailable = computed(() => {
  return (
    (filteredClicksData.value.length > 0 || filteredConversionsData.value.length > 0) && 
    !props.loading
  );
});

// Computed properties for filtered data based on props.filters
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
  
  if (props.filters.subId2) {
    filtered = filtered.filter(item => 
      item.subid_2 === props.filters.subId2
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
  
  if (props.filters.subId2) {
    filtered = filtered.filter(item => 
      item.subid_2 === props.filters.subId2
    )
  }
  
  return filtered
})

// Summary statistics
const totalClicks = computed(() => {
  return filteredClicksData.value.length;
});

const totalRevenue = computed(() => {
  return filteredConversionsData.value.reduce((sum, conversion) => {
    return sum + (parseFloat(conversion.price) || 0);
  }, 0);
});

const conversionRate = computed(() => {
  if (totalClicks.value === 0) return "0.00";
  return ((filteredConversionsData.value.length / totalClicks.value) * 100).toFixed(2);
});

// Function to group clicks data by hour
const groupClicksByHour = (clicksData) => {
  // Initialize an array to hold click counts for each hour (0-23)
  const hourlyClicks = Array(24).fill(0)
  
  // Process each click
  clicksData.forEach(click => {
    if (!click.click_date) return
    
    // Parse the timestamp to a Date object
    const clickDate = new Date(click.click_date)
    
    // Get the hour in local time
    const hour = clickDate.getHours()
    
    // Increment the count for that hour
    hourlyClicks[hour]++
  })
  
  return hourlyClicks
}

// Function to group conversions data by hour and sum prices
const groupConversionsByHour = (conversionsData) => {
  // Initialize an array to hold conversion price sums for each hour (0-23)
  const hourlyConversions = Array(24).fill(0)
  
  // Process each conversion
  conversionsData.forEach(conversion => {
    if (!conversion.conversion_date || !conversion.price) return
    
    // Parse the timestamp to a Date object
    const conversionDate = new Date(conversion.conversion_date)
    
    // Get the hour in local time
    const hour = conversionDate.getHours()
    
    // Add the price to the sum for that hour
    hourlyConversions[hour] += parseFloat(conversion.price) || 0
  })
  
  return hourlyConversions
}

// Get peak click hour
const peakClickHour = computed(() => {
  const hourlyClicks = groupClicksByHour(filteredClicksData.value);
  let maxClicks = 0;
  let peakHour = 0;
  
  hourlyClicks.forEach((clicks, hour) => {
    if (clicks > maxClicks) {
      maxClicks = clicks;
      peakHour = hour;
    }
  });
  
  // Format hour as "HH:00"
  return `${peakHour.toString().padStart(2, '0')}:00`;
});

// Function to create and update the chart
const updateChart = () => {
  
  if (!hourlyChartRef.value) {
    return
  }
  
  // If a chart instance already exists, destroy it
  if (chartInstance) {
    chartInstance.destroy()
  }
  
  // Process data
  const hourlyClicksData = groupClicksByHour(filteredClicksData.value)
  const hourlyConversionsData = groupConversionsByHour(filteredConversionsData.value)
  
  // Create labels for 24 hours (0-23)
  const labels = Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0') + ':00')
  
  // Get chart context
  const ctx = hourlyChartRef.value.getContext('2d')
  
  // Set chart colors based on theme
  const chartColors = isDarkMode.value ? {
    clicks: {
      border: 'rgba(100, 181, 246, 1)',
      background: 'rgba(100, 181, 246, 0.2)'
    },
    conversions: {
      border: 'rgba(229, 115, 115, 1)',
      background: 'rgba(229, 115, 115, 0.2)'
    },
    grid: 'rgba(255, 255, 255, 0.1)',
    text: '#e0e0e0'
  } : {
    clicks: {
      border: 'rgba(54, 162, 235, 1)',
      background: 'rgba(54, 162, 235, 0.2)'
    },
    conversions: {
      border: 'rgba(255, 99, 132, 1)',
      background: 'rgba(255, 99, 132, 0.2)'
    },
    grid: 'rgba(0, 0, 0, 0.1)',
    text: '#333333'
  };
  
  // Create new chart
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Clicks',
          data: hourlyClicksData,
          borderColor: chartColors.clicks.border,
          backgroundColor: chartColors.clicks.background,
          tension: 0.2,
          yAxisID: 'y',
        },
        {
          label: 'Revenue ($)',
          data: hourlyConversionsData,
          borderColor: chartColors.conversions.border,
          backgroundColor: chartColors.conversions.background,
          tension: 0.2,
          yAxisID: 'y1',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        tooltip: {
          padding: 10,
          cornerRadius: 6,
          caretSize: 6,
          backgroundColor: isDarkMode.value ? 'rgba(40, 40, 40, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          titleColor: isDarkMode.value ? '#ffffff' : '#333333',
          bodyColor: isDarkMode.value ? '#e0e0e0' : '#666666',
          borderColor: isDarkMode.value ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1,
          displayColors: true,
          boxPadding: 6
        },
        legend: {
          position: 'top',
          labels: {
            padding: 20,
            color: chartColors.text,
            usePointStyle: true,
            font: {
              size: 12
            }
          }
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Hour (24h format)',
            color: chartColors.text,
            font: {
              size: 12,
              weight: 'normal'
            }
          },
          ticks: {
            color: chartColors.text
          },
          grid: {
            color: chartColors.grid,
            drawBorder: false
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Click Count',
            color: chartColors.text,
            font: {
              size: 12,
              weight: 'normal'
            }
          },
          ticks: {
            color: chartColors.text
          },
          grid: {
            color: chartColors.grid,
            drawBorder: false
          },
          beginAtZero: true,
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Conversion Revenue ($)',
            color: chartColors.text,
            font: {
              size: 12,
              weight: 'normal'
            }
          },
          ticks: {
            color: chartColors.text
          },
          grid: {
            drawOnChartArea: false,
            color: chartColors.grid,
            drawBorder: false
          },
          beginAtZero: true,
        }
      }
    }
  })
}

// Function to download chart as image
const downloadChart = () => {
  if (!chartInstance) return;
  
  const link = document.createElement('a');
  link.href = chartInstance.toBase64Image();
  link.download = `hourly_performance_chart_${new Date().toISOString().slice(0, 10)}.png`;
  link.click();
}

// Watch for theme changes to update chart
watch(() => isDarkMode.value, () => {
  if (!props.loading && dataAvailable.value) {
    nextTick(() => {
      updateChart();
    });
  }
});

// Watch for data changes to update the chart
watch([() => filteredClicksData.value, () => filteredConversionsData.value], () => {
  if (!props.loading) {
    nextTick(() => {
      updateChart()
    })
  }
}, { deep: true, immediate: true })

// Initialize chart when component is mounted and watch for loading states to finish
onMounted(() => {
  nextTick(() => {
    if (!props.loading && dataAvailable.value) {
      updateChart()
    }
  })
})

// Watch specifically for the loading state to transition from true to false
watch(() => props.loading, (newLoading, oldLoading) => {
  if (oldLoading && !newLoading) {
    // Loading just finished, update the chart
    nextTick(() => {
      updateChart()
    })
  }
})

// Clean up chart instance when component is unmounted
onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
})
</script>

<template>
  <v-card class="mb-4 elevation-2 rounded-lg chart-card" variant="elevated">
    <v-card-title class="pb-2 d-flex align-center">
      <v-icon icon="mdi-chart-bar" color="primary" class="mr-2"></v-icon>
      <span class="text-h6">Hourly Performance</span>
      
      <v-spacer></v-spacer>
      
      <v-btn v-if="chartInstance && !loading" icon variant="text" color="primary" @click="downloadChart">
        <v-icon icon="mdi-download"></v-icon>
        <v-tooltip activator="parent" location="top">Download Chart</v-tooltip>
      </v-btn>
    </v-card-title>
    
    <v-divider></v-divider>
    
    <v-card-text class="pa-4">
      <div v-if="loading" class="d-flex justify-center align-center my-6">
        <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
        <span class="ml-4 text-body-1">Loading chart data...</span>
      </div>
      
      <div v-else-if="!dataAvailable" class="no-data my-6">
        <div class="text-center">
          <v-icon icon="mdi-chart-box-outline" size="64" class="mb-3 no-data-icon"></v-icon>
          <h3 class="text-h6 mb-2">No Data Available</h3>
          <p class="text-body-1 no-data-text">
            There is no data available for the selected date range or filters.
          </p>
        </div>
      </div>
      
      <div v-else class="chart-container">
        <canvas ref="hourlyChartRef"></canvas>
      </div>
      
      <div v-if="dataAvailable && !loading" class="chart-summary mt-4">
        <v-divider class="mb-4"></v-divider>
        
        <div class="d-flex flex-wrap justify-space-around">
          <div class="summary-item clicks-summary">
            <div class="summary-label">
              <v-icon icon="mdi-cursor-default-click" class="mr-1" size="small"></v-icon>
              Total Clicks
            </div>
            <div class="summary-value">{{ totalClicks }}</div>
          </div>
          
          <div class="summary-item conversions-summary">
            <div class="summary-label">
              <v-icon icon="mdi-cash-multiple" class="mr-1" size="small"></v-icon>
              Total Revenue
            </div>
            <div class="summary-value">${{ totalRevenue.toFixed(2) }}</div>
          </div>
          
          <div class="summary-item peak-summary">
            <div class="summary-label">
              <v-icon icon="mdi-clock-time-eight" class="mr-1" size="small"></v-icon>
              Peak Click Hour
            </div>
            <div class="summary-value">{{ peakClickHour }}</div>
          </div>
          
          <div class="summary-item rate-summary">
            <div class="summary-label">
              <v-icon icon="mdi-swap-vertical" class="mr-1" size="small"></v-icon>
              Conv. Rate
            </div>
            <div class="summary-value">{{ conversionRate }}%</div>
          </div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<style>
:root {
  --chart-card-bg: #ffffff;
  --chart-text-color: #333333;
  --no-data-color: #757575;
  --summary-border: rgba(0, 0, 0, 0.1);
  --summary-bg: rgba(0, 0, 0, 0.03);
  --clicks-color: rgba(54, 162, 235, 0.8);
  --conversions-color: rgba(255, 99, 132, 0.8);
  --transition-speed: 0.3s;
}

[data-theme="dark"] {
  --chart-card-bg: #1e1e1e;
  --chart-text-color: #e0e0e0;
  --no-data-color: #b0bec5;
  --summary-border: rgba(255, 255, 255, 0.1);
  --summary-bg: rgba(255, 255, 255, 0.05);
  --clicks-color: rgba(100, 181, 246, 0.8);
  --conversions-color: rgba(229, 115, 115, 0.8);
}
</style>

<style scoped>
.chart-card {
  background-color: var(--chart-card-bg) !important;
  transition: background-color var(--transition-speed) ease;
}

.chart-container {
  height: 400px;
  position: relative;
  margin-bottom: 20px;
  transition: all var(--transition-speed) ease;
}

.no-data {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
  transition: all var(--transition-speed) ease;
}

.no-data-icon, .no-data-text {
  color: var(--no-data-color);
  opacity: 0.7;
  transition: color var(--transition-speed) ease;
}

.chart-summary {
  transition: all var(--transition-speed) ease;
}

.summary-item {
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  margin: 4px;
  min-width: 120px;
  border: 1px solid var(--summary-border);
  background-color: var(--summary-bg);
  transition: all var(--transition-speed) ease;
}

.summary-label {
  font-size: 0.875rem;
  color: var(--chart-text-color);
  opacity: 0.8;
  margin-bottom: 4px;
  transition: color var(--transition-speed) ease;
}

.summary-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--chart-text-color);
  transition: color var(--transition-speed) ease;
}

.clicks-summary .summary-value {
  color: var(--clicks-color);
}

.conversions-summary .summary-value {
  color: var(--conversions-color);
}

@media (max-width: 768px) {
  .chart-container {
    height: 300px;
  }
  
  .summary-item {
    min-width: 140px;
  }
}
</style>