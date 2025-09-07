<template>
  <v-dialog v-model="dialog" max-width="800px">
    <v-card>
      <v-card-title>
        <span class="text-h5">Activity Details</span>
      </v-card-title>
      <v-card-text v-if="activity">
        <v-container>
          <v-row>
            <v-col cols="12" md="6">
              <div class="detail-item">
                <div class="text-subtitle-2 text-medium-emphasis mb-1">Action</div>
                <v-chip :color="getActionColor(activity.action)" variant="flat" size="small">
                  {{ activity.action }}
                </v-chip>
              </div>
            </v-col>
            <v-col cols="12" md="6">
              <div class="detail-item">
                <div class="text-subtitle-2 text-medium-emphasis mb-1">Timestamp</div>
                <div class="text-body-1">{{ formatDate(activity.timestamp) }}</div>
              </div>
            </v-col>
          </v-row>

          <v-row class="mt-2">
            <v-col cols="12" md="6">
              <div class="detail-item">
                <div class="text-subtitle-2 text-medium-emphasis mb-1">User</div>
                <div class="d-flex align-center">
                  <v-icon size="small" class="mr-2">mdi-account</v-icon>
                  <span class="text-body-1">{{ activity.user_email || activity.user_id }}</span>
                  <v-chip v-if="activity.user_role" size="small" class="ml-2">
                    {{ activity.user_role }}
                  </v-chip>
                </div>
              </div>
            </v-col>
            <v-col cols="12" md="6">
              <div class="detail-item">
                <div class="text-subtitle-2 text-medium-emphasis mb-1">Resource</div>
                <div class="d-flex align-center">
                  <v-chip size="small" variant="outlined" class="mr-2">
                    {{ activity.resource_type }}
                  </v-chip>
                  <span class="text-body-1 text-truncate">{{ activity.resource_name || activity.resource_id }}</span>
                </div>
              </div>
            </v-col>
          </v-row>

          <v-divider class="my-4"></v-divider>

          <v-row>
            <v-col cols="12" md="6">
              <div class="detail-item">
                <div class="text-subtitle-2 text-medium-emphasis mb-1">IP Address</div>
                <code class="text-body-1">{{ activity.ip_address || 'N/A' }}</code>
              </div>
            </v-col>
            <v-col cols="12" md="6">
              <div class="detail-item">
                <div class="text-subtitle-2 text-medium-emphasis mb-1">Session ID</div>
                <code class="text-body-1 text-truncate d-block">{{ activity.session_id || 'N/A' }}</code>
              </div>
            </v-col>
          </v-row>

          <v-row v-if="activity.user_agent">
            <v-col cols="12">
              <div class="detail-item">
                <span class="detail-label">User Agent:</span>
                <div class="user-agent-info mt-2">
                  <v-icon small>{{ getBrowserIcon(activity.user_agent) }}</v-icon>
                  <span class="ml-2 text-caption">{{ parseUserAgent(activity.user_agent) }}</span>
                </div>
              </div>
            </v-col>
          </v-row>

          <v-divider v-if="activity.details" class="my-4"></v-divider>

          <v-row v-if="activity.details">
            <v-col cols="12">
              <div class="detail-item">
                <div class="text-subtitle-2 text-medium-emphasis mb-2">Additional Details</div>
                <v-card variant="outlined">
                  <v-card-text>
                    <v-row>
                      <v-col cols="12" md="6" v-if="activity.details.country">
                        <div class="d-flex align-center mb-2">
                          <v-icon size="small" class="mr-2">mdi-map-marker</v-icon>
                          <span class="text-caption text-medium-emphasis">Location:</span>
                          <span class="ml-2">{{ activity.details.city }}, {{ activity.details.country }}</span>
                        </div>
                      </v-col>
                      <v-col cols="12" md="6" v-if="activity.details.device">
                        <div class="d-flex align-center mb-2">
                          <v-icon size="small" class="mr-2">mdi-devices</v-icon>
                          <span class="text-caption text-medium-emphasis">Device:</span>
                          <span class="ml-2">{{ activity.details.device }}</span>
                        </div>
                      </v-col>
                      <v-col cols="12" md="6" v-if="activity.details.fraud_score !== undefined">
                        <div class="d-flex align-center mb-2">
                          <v-icon size="small" class="mr-2">mdi-shield-alert</v-icon>
                          <span class="text-caption text-medium-emphasis">Fraud Score:</span>
                          <v-chip size="small" :color="getFraudScoreColor(activity.details.fraud_score)" class="ml-2">
                            {{ activity.details.fraud_score }}%
                          </v-chip>
                        </div>
                      </v-col>
                      <v-col cols="12" md="6" v-if="activity.details.referrer">
                        <div class="d-flex align-center mb-2">
                          <v-icon size="small" class="mr-2">mdi-link-variant</v-icon>
                          <span class="text-caption text-medium-emphasis">Referrer:</span>
                          <span class="ml-2 text-truncate">{{ activity.details.referrer || 'Direct' }}</span>
                        </div>
                      </v-col>
                      <v-col cols="12" v-if="activity.details.session_id">
                        <div class="d-flex align-center">
                          <v-icon size="small" class="mr-2">mdi-identifier</v-icon>
                          <span class="text-caption text-medium-emphasis">Session ID:</span>
                          <code class="ml-2 text-caption">{{ activity.details.session_id }}</code>
                        </div>
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>
              </div>
            </v-col>
          </v-row>

          <v-divider class="my-4"></v-divider>

          <v-row>
            <v-col cols="12">
              <div class="timeline-section">
                <span class="detail-label">Related Activities:</span>
                <v-timeline side="end" density="compact" class="mt-3">
                  <v-timeline-item
                    v-for="(related, index) in relatedActivities"
                    :key="index"
                    :dot-color="getActionColor(related.action)"
                    size="small"
                  >
                    <template v-slot:opposite>
                      <span class="text-caption">{{ formatTime(related.timestamp) }}</span>
                    </template>
                    <div class="d-flex align-center">
                      <strong>{{ related.action }}</strong>
                      <span class="ml-2 text-caption">{{ related.resource_type }}</span>
                    </div>
                  </v-timeline-item>
                </v-timeline>
              </div>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
      <v-card-text v-else>
        <v-alert type="info" variant="tonal">
          No activity selected
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="text" @click="close">
          Close
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import linkSplitterAPI from '@/services/linkSplitterAPI'

export default {
  name: 'ActivityDetailsDialog',
  props: {
    modelValue: Boolean,
    activity: Object
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const dialog = computed({
      get: () => props.modelValue,
      set: (val) => emit('update:modelValue', val)
    })

    const relatedActivities = ref([])

    watch(() => props.activity, async (newActivity) => {
      if (newActivity) {
        await loadRelatedActivities(newActivity)
      }
    })

    const loadRelatedActivities = async (activity) => {
      try {
        // Get recent activities from the same IP address
        if (!activity.resource_id || !activity.user_email) {
          relatedActivities.value = []
          return
        }
        
        // For now, we'll just show an empty list since we don't have a dedicated endpoint
        // for related activities. This could be enhanced later with proper backend support.
        relatedActivities.value = []
      } catch (error) {
        console.error('Error loading related activities:', error)
        relatedActivities.value = []
      }
    }

    const getActionColor = (action) => {
      const colors = {
        created: 'success',
        updated: 'info',
        deleted: 'error',
        viewed: 'primary',
        exported: 'secondary',
        imported: 'warning',
        login: 'success',
        logout: 'grey',
        failed: 'error',
        blocked: 'error'
      }
      return colors[action] || 'grey'
    }

    const formatDate = (timestamp) => {
      if (!timestamp) return 'N/A'
      const date = new Date(timestamp)
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    }

    const formatTime = (timestamp) => {
      if (!timestamp) return ''
      const date = new Date(timestamp)
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const formatJson = (details) => {
      if (!details) return ''
      try {
        const parsed = typeof details === 'string' ? JSON.parse(details) : details
        return JSON.stringify(parsed, null, 2)
      } catch {
        return details
      }
    }

    const parseUserAgent = (ua) => {
      if (!ua) return 'Unknown'
      
      // Simple parsing for common browsers
      if (ua.includes('Chrome')) return 'Chrome Browser'
      if (ua.includes('Firefox')) return 'Firefox Browser'
      if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari Browser'
      if (ua.includes('Edge')) return 'Microsoft Edge'
      if (ua.includes('Opera')) return 'Opera Browser'
      
      // Mobile detection
      if (ua.includes('Mobile')) return 'Mobile Browser'
      
      return 'Unknown Browser'
    }

    const getBrowserIcon = (ua) => {
      if (!ua) return 'mdi-web'
      
      if (ua.includes('Chrome')) return 'mdi-google-chrome'
      if (ua.includes('Firefox')) return 'mdi-firefox'
      if (ua.includes('Safari') && !ua.includes('Chrome')) return 'mdi-apple-safari'
      if (ua.includes('Edge')) return 'mdi-microsoft-edge'
      if (ua.includes('Opera')) return 'mdi-opera'
      
      if (ua.includes('Mobile')) return 'mdi-cellphone'
      
      return 'mdi-web'
    }

    const getFraudScoreColor = (score) => {
      if (score < 30) return 'success'
      if (score < 60) return 'warning'
      return 'error'
    }

    const close = () => {
      dialog.value = false
      relatedActivities.value = []
    }

    return {
      dialog,
      relatedActivities,
      getActionColor,
      formatDate,
      formatTime,
      formatJson,
      parseUserAgent,
      getBrowserIcon,
      getFraudScoreColor,
      close
    }
  }
}
</script>

<style scoped>
.detail-item {
  margin-bottom: 16px;
}

/* Removed .detail-label as we're using Vuetify text classes now */

.user-info {
  display: flex;
  align-items: center;
}

.font-mono {
  font-family: monospace;
}

.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
  display: inline-block;
}

.json-content {
  background-color: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
  max-height: 300px;
  font-family: monospace;
}

.user-agent-info {
  display: flex;
  align-items: center;
  padding: 8px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.timeline-section {
  margin-top: 8px;
}

.v-divider {
  margin: 16px 0;
}
</style>