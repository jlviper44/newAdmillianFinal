<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="1200"
  >
    <v-card v-if="project">
      <v-card-title class="d-flex justify-space-between align-center">
        <div>
          Analytics: {{ project.name }}
        </div>
        <v-btn
          icon="mdi-close"
          variant="text"
          @click="$emit('update:modelValue', false)"
        ></v-btn>
      </v-card-title>
      
      <v-card-text>
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
            <v-btn
              variant="outlined"
              prepend-icon="mdi-download"
              @click="exportData"
            >
              Export Data
            </v-btn>
          </v-col>
        </v-row>
        
        <!-- Stats Cards -->
        <v-row class="mb-4">
          <v-col cols="12" md="3">
            <v-card variant="outlined">
              <v-card-text>
                <div class="text-caption text-grey">Total Clicks</div>
                <div class="text-h5">{{ analytics.stats?.total_clicks || 0 }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card variant="outlined">
              <v-card-text>
                <div class="text-caption text-grey">Unique Visitors</div>
                <div class="text-h5">{{ analytics.stats?.unique_visitors || 0 }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card variant="outlined">
              <v-card-text>
                <div class="text-caption text-grey">Bot Clicks</div>
                <div class="text-h5">{{ analytics.stats?.bot_clicks || 0 }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card variant="outlined">
              <v-card-text>
                <div class="text-caption text-grey">Avg Fraud Score</div>
                <div class="text-h5">{{ Math.round(analytics.stats?.avg_fraud_score || 0) }}%</div>
              </v-card-text>
            </v-card>
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
                <v-simple-table density="compact">
                  <template v-slot:default>
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
                  </template>
                </v-simple-table>
              </v-card-text>
            </v-card>
          </v-col>
          
          <!-- Top Referrers -->
          <v-col cols="12" md="6">
            <v-card variant="outlined">
              <v-card-title>Top Referrers</v-card-title>
              <v-card-text>
                <v-simple-table density="compact">
                  <template v-slot:default>
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
                  </template>
                </v-simple-table>
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
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
import { ref, watch, onMounted, nextTick } from 'vue'
import Chart from 'chart.js/auto'
import linkSplitterAPI from '@/services/linkSplitterAPI'

export default {
  name: 'Analytics',
  props: {
    modelValue: Boolean,
    project: Object
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    // Data
    const period = ref('7d')
    const analytics = ref({
      stats: {},
      devices: [],
      countries: [],
      referrers: [],
      timeline: [],
      urlPerformance: []
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
      analytics,
      timelineChart,
      deviceChart,
      periodOptions,
      urlHeaders,
      loadAnalytics,
      formatReferrer,
      exportData
    }
  }
}
</script>

<style scoped>
canvas {
  max-height: 300px;
}
</style>