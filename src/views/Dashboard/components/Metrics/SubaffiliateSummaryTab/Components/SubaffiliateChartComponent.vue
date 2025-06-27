<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useTheme } from 'vuetify'
import Chart from 'chart.js/auto';

// Initialize Vuetify theme
const theme = useTheme();

// Get current theme
const isDarkMode = computed(() => {
  return theme.global.current.value.dark;
});

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  }
});

const chartCanvas = ref(null);
let chart = null;

// Computed properties for stats and summaries
const uniqueDatesCount = computed(() => {
  if (!props.data || props.data.length === 0) return 0;
  return new Set(props.data.map(item => item.fetched_date)).size;
});

const uniqueSubIds = computed(() => {
  if (!props.data || props.data.length === 0) return [];
  return [...new Set(props.data.map(item => item.sub_id))];
});

const totalMetrics = computed(() => {
  if (!props.data || props.data.length === 0) {
    return { clicks: 0, conversions: 0, revenue: 0, events: 0 };
  }
  
  return props.data.reduce((totals, item) => {
    totals.clicks += Number(item.clicks || 0);
    totals.conversions += Number(item.conversions || 0);
    totals.revenue += Number(item.revenue || 0);
    totals.events += Number(item.events || 0);
    return totals;
  }, { clicks: 0, conversions: 0, revenue: 0, events: 0 });
});

const averageEpc = computed(() => {
  if (!totalMetrics.value.clicks || totalMetrics.value.clicks === 0) return 0;
  return totalMetrics.value.revenue / totalMetrics.value.clicks;
});

// Computed property to sort data by date
const sortedData = computed(() => {
  if (!props.data || props.data.length === 0) return [];
  
  return [...props.data].sort((a, b) => {
    return new Date(a.fetched_date) - new Date(b.fetched_date);
  });
});

// Generate datasets for chart
const generateChartData = () => {
  if (!sortedData.value || sortedData.value.length === 0) return null;
  
  // Extract unique dates for x-axis
  const dates = [...new Set(sortedData.value.map(item => item.fetched_date))].sort();
  
  // Set chart colors based on theme
  const chartColors = isDarkMode.value ? {
    clicks: {
      border: 'rgba(100, 181, 246, 1)',
      background: 'rgba(100, 181, 246, 0.1)'
    },
    conversions: {
      border: 'rgba(129, 199, 132, 1)',
      background: 'rgba(129, 199, 132, 0.1)'
    },
    revenue: {
      border: 'rgba(255, 167, 38, 1)',
      background: 'rgba(255, 167, 38, 0.1)'
    },
    epc: {
      border: 'rgba(206, 147, 216, 1)',
      background: 'rgba(206, 147, 216, 0.1)'
    },
    events: {
      border: 'rgba(229, 57, 53, 1)',
      background: 'rgba(229, 57, 53, 0.1)'
    }
  } : {
    clicks: {
      border: 'rgba(25, 118, 210, 1)',
      background: 'rgba(25, 118, 210, 0.1)'
    },
    conversions: {
      border: 'rgba(67, 160, 71, 1)',
      background: 'rgba(67, 160, 71, 0.1)'
    },
    revenue: {
      border: 'rgba(245, 124, 0, 1)',
      background: 'rgba(245, 124, 0, 0.1)'
    },
    epc: {
      border: 'rgba(156, 39, 176, 1)',
      background: 'rgba(156, 39, 176, 0.1)'
    },
    events: {
      border: 'rgba(229, 57, 53, 1)',
      background: 'rgba(229, 57, 53, 0.1)'
    }
  };
  
  // Prepare datasets for each metric
  const metrics = {
    clicks: {
      label: 'Clicks',
      borderColor: chartColors.clicks.border,
      backgroundColor: chartColors.clicks.background,
      data: [],
      yAxisID: 'count',
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5
    },
    conversions: {
      label: 'Conversions',
      borderColor: chartColors.conversions.border,
      backgroundColor: chartColors.conversions.background,
      data: [],
      yAxisID: 'count',
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5
    },
    revenue: {
      label: 'Revenue',
      borderColor: chartColors.revenue.border,
      backgroundColor: chartColors.revenue.background,
      data: [],
      yAxisID: 'revenue',
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5
    },
    epc: {
      label: 'EPC',
      borderColor: chartColors.epc.border,
      backgroundColor: chartColors.epc.background,
      data: [],
      yAxisID: 'epc',
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      hidden: true  // Start with EPC hidden to avoid too many lines
    }
  };
  
  // Aggregate data by date for each metric
  dates.forEach(date => {
    const dayData = sortedData.value.filter(item => item.fetched_date === date);
    
    // Sum all metrics for the day
    const dayTotals = dayData.reduce((totals, item) => {
      // Ensure all needed properties exist and are numbers
      totals.clicks += Number(item.clicks || 0);
      totals.conversions += Number(item.conversions || 0);
      totals.revenue += Number(item.revenue || 0);
      
      // Calculate EPC for the day - clicks might be 0, handle that case
      if (totals.clicks > 0) {
        totals.epc = totals.revenue / totals.clicks;
      } else {
        totals.epc = 0;
      }
      
      return totals;
    }, { clicks: 0, conversions: 0, revenue: 0, epc: 0 });
    
    // Update each metric's dataset
    Object.keys(metrics).forEach(key => {
      metrics[key].data.push(dayTotals[key]);
    });
  });
  
  // Format dates for display
  const formattedDates = dates.map(dateStr => {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  });
  
  return {
    labels: formattedDates,
    datasets: Object.values(metrics)
  };
};

// Initialize or update chart
const initOrUpdateChart = () => {
  const chartData = generateChartData();
  
  if (!chartData) return;
  
  const ctx = chartCanvas.value.getContext('2d');
  
  // Destroy existing chart if it exists
  if (chart) {
    chart.destroy();
  }
  
  // Set text and grid colors based on theme
  const chartColors = isDarkMode.value ? {
    text: '#e0e0e0',
    grid: 'rgba(255, 255, 255, 0.1)'
  } : {
    text: '#333333',
    grid: 'rgba(0, 0, 0, 0.1)'
  };
  
  // Create new chart
  chart = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      },
      plugins: {
        tooltip: {
          mode: 'index',
          intersect: false,
          padding: 10,
          cornerRadius: 6,
          caretSize: 6,
          backgroundColor: isDarkMode.value ? 'rgba(40, 40, 40, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          titleColor: isDarkMode.value ? '#ffffff' : '#333333',
          bodyColor: isDarkMode.value ? '#e0e0e0' : '#666666',
          borderColor: isDarkMode.value ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1,
          usePointStyle: true,
          boxPadding: 6
        },
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 20,
            color: chartColors.text,
            font: {
              size: 12
            }
          }
        },
        title: {
          display: true,
          text: 'Subaffiliate Metrics Over Time',
          color: chartColors.text,
          font: {
            size: 16,
            weight: 'normal'
          },
          padding: {
            top: 10,
            bottom: 20
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Date',
            color: chartColors.text,
            font: {
              size: 12,
              weight: 'normal'
            }
          },
          ticks: {
            color: chartColors.text,
            maxRotation: 45,
            minRotation: 45
          },
          grid: {
            color: chartColors.grid,
            drawBorder: false
          }
        },
        count: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Count',
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
          beginAtZero: true
        },
        revenue: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Revenue ($)',
            color: chartColors.text,
            font: {
              size: 12,
              weight: 'normal'
            }
          },
          ticks: {
            color: chartColors.text,
            callback: function(value) {
              return '$' + value;
            }
          },
          grid: {
            color: chartColors.grid,
            drawOnChartArea: false,
            drawBorder: false
          },
          beginAtZero: true
        },
        epc: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'EPC ($)',
            color: chartColors.text,
            font: {
              size: 12,
              weight: 'normal'
            }
          },
          ticks: {
            color: chartColors.text,
            callback: function(value) {
              return '$' + value.toFixed(2);
            }
          },
          grid: {
            color: chartColors.grid,
            drawOnChartArea: false,
            drawBorder: false
          },
          beginAtZero: true
        }
      }
    }
  });
};

// Function to download chart as image
const downloadChart = () => {
  if (!chart) return;
  
  const link = document.createElement('a');
  link.href = chart.toBase64Image();
  
  // Create a filename with date range
  let filename = 'subaffiliate_metrics';
  if (props.startDate && props.endDate) {
    const start = props.startDate.toISOString().split('T')[0];
    const end = props.endDate.toISOString().split('T')[0];
    filename += `_${start}_to_${end}`;
  }
  
  link.download = `${filename}.png`;
  link.click();
};

// Watch for theme changes
watch(() => isDarkMode.value, () => {
  if (props.data && props.data.length > 0) {
    initOrUpdateChart();
  }
});

// Initialize chart when component is mounted
onMounted(() => {
  if (props.data && props.data.length > 0) {
    initOrUpdateChart();
  }
});

// Watch for changes in data and update chart
watch(() => props.data, () => {
  if (props.data && props.data.length > 0) {
    initOrUpdateChart();
  }
}, { deep: true });

// Watch for changes in date range
watch([() => props.startDate, () => props.endDate], () => {
  if (props.data && props.data.length > 0) {
    initOrUpdateChart();
  }
});
</script>

<template>
  <div class="chart-outer-container">
    <div v-if="data && data.length > 0" class="chart-header d-flex justify-space-between align-center mb-4">
      <div class="chart-title">
        <v-chip color="primary" size="small" variant="elevated" class="mr-2">
          {{ uniqueDatesCount }} days
        </v-chip>
        <v-chip color="secondary" size="small" variant="elevated" class="mr-2">
          {{ uniqueSubIds.length }} sub IDs
        </v-chip>
      </div>
      
      <v-btn 
        icon 
        variant="text" 
        color="primary" 
        @click="downloadChart" 
        v-if="chart"
      >
        <v-icon icon="mdi-download"></v-icon>
        <v-tooltip activator="parent" location="top">Download Chart</v-tooltip>
      </v-btn>
    </div>
    
    <div class="chart-container">
      <canvas ref="chartCanvas"></canvas>
      <div v-if="!data || data.length === 0" class="no-data-message">
        <v-icon icon="mdi-chart-line-variant" size="large" color="primary" class="mb-3 opacity-50"></v-icon>
        <p class="text-h6 mb-1">No Chart Data</p>
        <p class="text-body-2">No data available for chart visualization</p>
      </div>
    </div>
    
    <!-- Summary cards when data is available -->
    <v-row v-if="data && data.length > 0" class="mt-4">
      <v-col cols="12" sm="6" md="3">
        <v-card class="summary-card" flat>
          <v-card-text class="text-center">
            <div class="summary-label">Total Clicks</div>
            <div class="summary-value clicks-value">{{ totalMetrics.clicks }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      
      <v-col cols="12" sm="6" md="3">
        <v-card class="summary-card" flat>
          <v-card-text class="text-center">
            <div class="summary-label">Total Conversions</div>
            <div class="summary-value conversions-value">{{ totalMetrics.conversions }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      
      <v-col cols="12" sm="6" md="3">
        <v-card class="summary-card" flat>
          <v-card-text class="text-center">
            <div class="summary-label">Total Revenue</div>
            <div class="summary-value revenue-value">${{ totalMetrics.revenue.toFixed(2) }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      
      <v-col cols="12" sm="6" md="3">
        <v-card class="summary-card" flat>
          <v-card-text class="text-center">
            <div class="summary-label">Average EPC</div>
            <div class="summary-value epc-value">${{ averageEpc.toFixed(2) }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<style>
:root {
  --chart-bg: #ffffff;
  --chart-text-color: #333333;
  --no-data-color: #757575;
  --card-bg: #f5f7fa;
  --clicks-color: #1976d2;
  --conversions-color: #43a047;
  --revenue-color: #f57c00;
  --epc-color: #9c27b0;
  --transition-speed: 0.3s;
}

[data-theme="dark"] {
  --chart-bg: #1e1e1e;
  --chart-text-color: #e0e0e0;
  --no-data-color: #b0bec5;
  --card-bg: #2d2d2d;
  --clicks-color: #64b5f6;
  --conversions-color: #81c784;
  --revenue-color: #ffa726;
  --epc-color: #ce93d8;
}
</style>

<style scoped>
.chart-outer-container {
  background-color: var(--chart-bg);
  transition: background-color var(--transition-speed) ease;
  border-radius: 8px;
}

.chart-container {
  position: relative;
  height: 400px;
  width: 100%;
  margin: 0;
  transition: all var(--transition-speed) ease;
}

.chart-header {
  transition: all var(--transition-speed) ease;
}

.no-data-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--no-data-color);
  transition: color var(--transition-speed) ease;
}

.summary-card {
  background-color: var(--card-bg) !important;
  border-radius: 8px;
  transition: background-color var(--transition-speed) ease;
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
  transition: color var(--transition-speed) ease;
}

.clicks-value {
  color: var(--clicks-color);
}

.conversions-value {
  color: var(--conversions-color);
}

.revenue-value {
  color: var(--revenue-color);
}

.epc-value {
  color: var(--epc-color);
}

@media (max-width: 768px) {
  .chart-container {
    height: 300px;
  }
  
  .summary-value {
    font-size: 1.25rem;
  }
}
</style>