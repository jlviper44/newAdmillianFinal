<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="1400"
    width="90%"
  >
    <v-card v-if="project">
      <v-card-title class="d-flex align-center pa-4">
        <span>Analytics: {{ project.name }}</span>
        <v-spacer></v-spacer>
        <v-btn
          variant="outlined"
          size="small"
          prepend-icon="mdi-download"
          @click="exportData"
          v-if="activeTab === 'basic'"
          class="mr-2"
        >
          Export
        </v-btn>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          @click="$emit('update:modelValue', false)"
        ></v-btn>
      </v-card-title>
      
      <!-- Stats Header - Visible for all tabs -->
      <v-card-text class="pb-2">
        <v-row>
          <v-col cols="12" sm="6" md="2">
            <v-card 
              variant="outlined" 
              class="text-center stat-card"
              elevation="1"
            >
              <v-card-text class="pa-3">
                <v-icon color="primary" size="24" class="mb-1">mdi-account-multiple</v-icon>
                <div class="text-overline text-medium-emphasis">Active Users</div>
                <div class="text-h4 font-weight-bold text-primary">{{ dashboardStats.activeUsers || 0 }}</div>
                <v-chip size="x-small" color="success" variant="flat" class="mt-1">
                  <v-icon size="x-small" start>mdi-circle</v-icon>
                  Live Now
                </v-chip>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="2">
            <v-card 
              variant="outlined" 
              class="text-center stat-card"
              elevation="1"
            >
              <v-card-text class="pa-3">
                <v-icon color="info" size="24" class="mb-1">mdi-cursor-default-click</v-icon>
                <div class="text-overline text-medium-emphasis">Total Clicks</div>
                <div class="text-h4 font-weight-bold text-primary">{{ analytics.stats?.total_clicks || 0 }}</div>
                <v-chip size="x-small" variant="tonal" color="info" class="mt-1">
                  Today
                </v-chip>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="2">
            <v-card 
              variant="outlined" 
              class="text-center stat-card"
              elevation="1"
            >
              <v-card-text class="pa-3">
                <v-icon color="success" size="24" class="mb-1">mdi-account-check</v-icon>
                <div class="text-overline text-medium-emphasis">Unique Visitors</div>
                <div class="text-h4 font-weight-bold text-success">{{ analytics.stats?.unique_visitors || 0 }}</div>
                <v-chip size="x-small" variant="tonal" color="success" class="mt-1">
                  Total
                </v-chip>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="2">
            <v-card 
              variant="outlined" 
              class="text-center stat-card"
              elevation="1"
            >
              <v-card-text class="pa-3">
                <v-icon color="error" size="24" class="mb-1">mdi-robot-angry</v-icon>
                <div class="text-overline text-medium-emphasis">Bot Clicks</div>
                <div class="text-h4 font-weight-bold text-error">{{ analytics.stats?.bot_clicks || 0 }}</div>
                <v-chip size="x-small" variant="tonal" color="error" class="mt-1">
                  Blocked
                </v-chip>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="2">
            <v-card 
              variant="outlined" 
              class="text-center stat-card"
              :color="getFraudScoreColor(analytics.stats?.avg_fraud_score)"
              elevation="1"
            >
              <v-card-text class="pa-3">
                <v-icon size="24" class="mb-1">mdi-shield-alert</v-icon>
                <div class="text-overline">Fraud Score</div>
                <div class="text-h4 font-weight-bold text-warning">{{ Math.round(analytics.stats?.avg_fraud_score || 0) }}%</div>
                <v-chip size="x-small" variant="flat" class="mt-1">
                  {{ getFraudScoreLabel(analytics.stats?.avg_fraud_score) }}
                </v-chip>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="2">
            <v-card 
              variant="outlined" 
              class="text-center stat-card"
              color="green-lighten-5"
              elevation="1"
            >
              <v-card-text class="pa-3">
                <v-icon color="green" size="24" class="mb-1">mdi-server-network</v-icon>
                <div class="text-overline text-green-darken-2">Uptime</div>
                <div class="text-h4 font-weight-bold text-success">99.9%</div>
                <v-chip size="x-small" color="green" variant="flat" class="mt-1">
                  <v-icon size="x-small" start>mdi-check-circle</v-icon>
                  Excellent
                </v-chip>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
      
      <v-tabs 
        v-model="activeTab" 
        color="primary"
        class="custom-tabs"
        align-tabs="center"
        density="comfortable"
        grow
      >
        <v-tab value="basic" prepend-icon="mdi-chart-line">
          <span class="text-capitalize">Basic</span>
        </v-tab>
        <v-tab value="realtime" prepend-icon="mdi-pulse">
          <span class="text-capitalize">Real-time</span>
        </v-tab>
        <v-tab value="fraud" prepend-icon="mdi-shield-check">
          <span class="text-capitalize">Fraud Detection</span>
        </v-tab>
        <v-tab value="performance" prepend-icon="mdi-speedometer">
          <span class="text-capitalize">Performance</span>
        </v-tab>
        <v-tab value="geographic" prepend-icon="mdi-earth">
          <span class="text-capitalize">Geographic</span>
        </v-tab>
        <v-tab value="activity" prepend-icon="mdi-format-list-bulleted">
          <span class="text-capitalize">Activity Log</span>
        </v-tab>
      </v-tabs>
      
      <v-window v-model="activeTab" style="height: 60vh; overflow-y: auto;">
        <!-- Basic Analytics Tab -->
        <v-window-item value="basic" style="height: 100%;">
          <v-container fluid class="pa-4" style="height: 100%; overflow-y: auto;">
        <!-- Date Range Selector -->
        <v-row class="mb-4">
          <v-col cols="12" md="4">
            <v-select
              v-model="period"
              :items="periodOptions"
              label="Time Period"
              variant="outlined"
              density="compact"
              @update:model-value="loadAnalytics"
            ></v-select>
          </v-col>
          <v-col cols="12" md="8" class="text-right">
            <!-- Export button moved to toolbar -->
          </v-col>
        </v-row>
        
        <!-- Charts -->
        <v-row>
          <!-- Click Timeline -->
          <v-col cols="12" md="8">
            <v-card variant="outlined">
              <v-card-title>Click Timeline</v-card-title>
              <v-card-text>
                <canvas ref="timelineChart"></canvas>
              </v-card-text>
            </v-card>
          </v-col>
          
          <!-- Device Breakdown -->
          <v-col cols="12" md="4">
            <v-card variant="outlined">
              <v-card-title>Device Types</v-card-title>
              <v-card-text>
                <canvas ref="deviceChart"></canvas>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
        
        <!-- Tables -->
        <v-row class="mt-4">
          <!-- Top Countries -->
          <v-col cols="12" md="6">
            <v-card variant="outlined">
              <v-card-title>Top Countries</v-card-title>
              <v-card-text>
                <v-table density="compact">
                  <thead>
                    <tr>
                      <th>Country</th>
                      <th class="text-right">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="country in analytics.countries" :key="country.country">
                      <td>{{ country.country || 'Unknown' }}</td>
                      <td class="text-right">{{ country.count }}</td>
                    </tr>
                  </tbody>
                </v-table>
              </v-card-text>
            </v-card>
          </v-col>
          
          <!-- Top Referrers -->
          <v-col cols="12" md="6">
            <v-card variant="outlined">
              <v-card-title>Top Referrers</v-card-title>
              <v-card-text>
                <v-table density="compact">
                  <thead>
                    <tr>
                      <th>Referrer</th>
                      <th class="text-right">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="referrer in analytics.referrers" :key="referrer.referrer">
                      <td>{{ formatReferrer(referrer.referrer) }}</td>
                      <td class="text-right">{{ referrer.count }}</td>
                    </tr>
                  </tbody>
                </v-table>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
        
        <!-- URL Performance -->
        <v-row class="mt-4">
          <v-col cols="12">
            <v-card variant="outlined">
              <v-card-title>URL Performance</v-card-title>
              <v-card-text>
                <v-data-table
                  :headers="urlHeaders"
                  :items="analytics.urlPerformance"
                  density="compact"
                >
                  <template v-slot:item.clicked_url="{ item }">
                    <div class="text-truncate" style="max-width: 400px">
                      {{ item.clicked_url }}
                    </div>
                  </template>
                </v-data-table>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
          </v-container>
        </v-window-item>
        
        <!-- Real-time Tab -->
        <v-window-item value="realtime" style="height: 100%;">
          <div style="height: 100%; overflow-y: auto;">
            <AnalyticsDashboard :project-id="project?.id" :initial-tab="'realtime'" />
          </div>
        </v-window-item>
        
        <!-- Fraud Detection Tab -->
        <v-window-item value="fraud" style="height: 100%;">
          <div style="height: 100%; overflow-y: auto;">
            <AnalyticsDashboard :project-id="project?.id" :initial-tab="'fraud'" />
          </div>
        </v-window-item>
        
        <!-- Performance Tab -->
        <v-window-item value="performance" style="height: 100%;">
          <div style="height: 100%; overflow-y: auto;">
            <AnalyticsDashboard :project-id="project?.id" :initial-tab="'performance'" />
          </div>
        </v-window-item>
        
        <!-- Geographic Tab -->
        <v-window-item value="geographic" style="height: 100%;">
          <div style="height: 100%; overflow-y: auto;">
            <AnalyticsDashboard :project-id="project?.id" :initial-tab="'geographic'" />
          </div>
        </v-window-item>
        
        <!-- Activity Log Tab -->
        <v-window-item value="activity" style="height: 100%;">
          <div style="height: 100%; overflow-y: auto;">
            <AnalyticsDashboard :project-id="project?.id" :initial-tab="'activity'" />
          </div>
        </v-window-item>
      </v-window>
    </v-card>
  </v-dialog>

</template>

<script>
import { ref, watch, onMounted, nextTick } from 'vue'
import Chart from 'chart.js/auto'
import linkSplitterAPI from '@/services/linkSplitterAPI'
import AnalyticsDashboard from './AnalyticsDashboard.vue'

export default {
  name: 'Analytics',
  components: {
    AnalyticsDashboard
  },
  props: {
    modelValue: Boolean,
    project: Object
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    // Data
    const period = ref('7d')
    const activeTab = ref('basic')
    const analytics = ref({
      stats: {},
      devices: [],
      countries: [],
      referrers: [],
      timeline: [],
      urlPerformance: []
    })
    const dashboardStats = ref({
      activeUsers: 0
    })
    
    // Charts
    const timelineChart = ref(null)
    const deviceChart = ref(null)
    let timelineChartInstance = null
    let deviceChartInstance = null
    
    // Config
    const periodOptions = [
      { title: 'Last 24 Hours', value: '1d' },
      { title: 'Last 7 Days', value: '7d' },
      { title: 'Last 30 Days', value: '30d' },
      { title: 'Last 3 Months', value: '90d' }
    ]
    
    const urlHeaders = [
      { title: 'URL', key: 'clicked_url' },
      { title: 'Clicks', key: 'clicks', align: 'end' },
      { title: 'Unique Visitors', key: 'unique_visitors', align: 'end' }
    ]
    
    // Methods
    const loadAnalytics = async () => {
      if (!props.project) return
      
      try {
        const data = await linkSplitterAPI.getAnalytics(props.project.id, {
          period: period.value
        })
        analytics.value = data
        
        // Update charts
        await nextTick()
        updateCharts()
      } catch (error) {
        console.error('Error loading analytics:', error)
      }
    }
    
    const updateCharts = () => {
      // Timeline Chart
      if (timelineChart.value) {
        const ctx = timelineChart.value.getContext('2d')
        
        if (timelineChartInstance) {
          timelineChartInstance.destroy()
        }
        
        timelineChartInstance = new Chart(ctx, {
          type: 'line',
          data: {
            labels: analytics.value.timeline?.map(d => d.date) || [],
            datasets: [{
              label: 'Clicks',
              data: analytics.value.timeline?.map(d => d.clicks) || [],
              borderColor: 'rgb(75, 192, 192)',
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              tension: 0.1
            }, {
              label: 'Unique Visitors',
              data: analytics.value.timeline?.map(d => d.unique_visitors) || [],
              borderColor: 'rgb(255, 99, 132)',
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              tension: 0.1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom'
              }
            },
            scales: {
              y: {
                beginAtZero: true
              }
            }
          }
        })
      }
      
      // Device Chart
      if (deviceChart.value) {
        const ctx = deviceChart.value.getContext('2d')
        
        if (deviceChartInstance) {
          deviceChartInstance.destroy()
        }
        
        deviceChartInstance = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: analytics.value.devices?.map(d => d.device_type || 'Unknown') || [],
            datasets: [{
              data: analytics.value.devices?.map(d => d.count) || [],
              backgroundColor: [
                'rgba(255, 99, 132, 0.8)',
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 206, 86, 0.8)',
                'rgba(75, 192, 192, 0.8)'
              ]
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom'
              }
            }
          }
        })
      }
    }
    
    const formatReferrer = (referrer) => {
      if (!referrer) return 'Direct'
      try {
        const url = new URL(referrer)
        return url.hostname
      } catch {
        return referrer
      }
    }
    
    
    const getFraudScoreColor = (score) => {
      if (!score || score < 20) return ''
      if (score < 50) return 'orange-lighten-4'
      return 'red-lighten-4'
    }
    
    const getFraudScoreLabel = (score) => {
      if (!score || score < 20) return 'Low Risk'
      if (score < 50) return 'Medium Risk'
      return 'High Risk'
    }
    
    const exportData = async () => {
      if (!props.project) return
      
      try {
        const data = await linkSplitterAPI.exportAnalytics(props.project.id, {
          format: 'csv',
          period: period.value
        })
        
        // Create download link
        const blob = new Blob([data], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `analytics-${props.project.custom_alias}-${Date.now()}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
      } catch (error) {
        console.error('Error exporting data:', error)
      }
    }
    
    // Lifecycle
    watch(() => props.project, (newProject) => {
      if (newProject && props.modelValue) {
        loadAnalytics()
      }
    })
    
    watch(() => props.modelValue, (isOpen) => {
      if (isOpen && props.project) {
        loadAnalytics()
      }
    })
    
    // Cleanup
    onMounted(() => {
      return () => {
        if (timelineChartInstance) {
          timelineChartInstance.destroy()
        }
        if (deviceChartInstance) {
          deviceChartInstance.destroy()
        }
      }
    })
    
    return {
      period,
      activeTab,
      analytics,
      dashboardStats,
      timelineChart,
      deviceChart,
      periodOptions,
      urlHeaders,
      loadAnalytics,
      formatReferrer,
      getFraudScoreColor,
      getFraudScoreLabel,
      exportData
    }
  }
}
</script>

<style scoped>
canvas {
  max-height: 300px;
}

/* Stat Cards Enhancement */
.stat-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
}

/* Tab content consistency */
.tab-content-container {
  min-height: 60vh;
  max-height: 60vh;
  overflow-y: auto;
}

/* Custom Tabs Styling */
.custom-tabs :deep(.v-tab) {
  font-weight: 500;
  letter-spacing: 0.5px;
  margin: 0 2px;
  transition: all 0.2s ease;
}

.custom-tabs :deep(.v-tab--selected) {
  font-weight: 600;
}
</style>