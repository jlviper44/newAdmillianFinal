<template>
  <v-dialog v-model="dialog" max-width="700px" persistent>
    <v-card>
      <v-card-title>
        <span class="text-h5">{{ editingWebhook ? 'Edit Webhook' : 'Create Webhook' }}</span>
      </v-card-title>
      <v-card-text>
        <v-container>
          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="formData.name"
                label="Webhook Name"
                required
                :rules="[v => !!v || 'Name is required']"
              ></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="formData.url"
                label="Webhook URL"
                required
                :rules="[v => !!v || 'URL is required', v => isValidUrl(v) || 'Must be a valid URL']"
                placeholder="https://example.com/webhook"
              ></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="formData.secret"
                label="Secret Key (for HMAC signature)"
                :append-icon="showSecret ? 'mdi-eye' : 'mdi-eye-off'"
                :type="showSecret ? 'text' : 'password'"
                @click:append="showSecret = !showSecret"
                hint="Used to sign webhook payloads for security"
              >
                <template v-slot:append-inner>
                  <v-btn
                    variant="text"
                    size="small"
                    @click="generateSecret"
                  >
                    Generate
                  </v-btn>
                </template>
              </v-text-field>
            </v-col>
          </v-row>

          <v-divider class="my-4"></v-divider>

          <v-row>
            <v-col cols="12">
              <span class="text-subtitle-1">Events to Trigger</span>
              <v-chip-group
                v-model="selectedEvents"
                multiple
                column
                class="mt-2"
              >
                <v-chip
                  v-for="event in availableEvents"
                  :key="event.value"
                  :value="event.value"
                  filter
                  variant="outlined"
                >
                  <v-icon left size="small">{{ event.icon }}</v-icon>
                  {{ event.text }}
                </v-chip>
              </v-chip-group>
            </v-col>
          </v-row>

          <v-divider class="my-4"></v-divider>

          <v-row>
            <v-col cols="12">
              <span class="text-subtitle-1">Custom Headers (Optional)</span>
            </v-col>
            <v-col cols="12">
              <div v-for="(header, index) in formData.headers" :key="index" class="d-flex gap-2 mb-2">
                <v-text-field
                  v-model="header.key"
                  label="Header Name"
                  density="compact"
                  class="flex-grow-1"
                ></v-text-field>
                <v-text-field
                  v-model="header.value"
                  label="Header Value"
                  density="compact"
                  class="flex-grow-1"
                ></v-text-field>
                <v-btn
                  icon
                  variant="text"
                  color="error"
                  @click="removeHeader(index)"
                  size="small"
                >
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </div>
              <v-btn
                color="primary"
                variant="text"
                @click="addHeader"
                size="small"
              >
                <v-icon left>mdi-plus</v-icon>
                Add Header
              </v-btn>
            </v-col>
          </v-row>

          <v-divider class="my-4"></v-divider>

          <v-row>
            <v-col cols="12">
              <span class="text-subtitle-1">Retry Configuration</span>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model.number="formData.retry_count"
                label="Max Retry Attempts"
                type="number"
                min="0"
                max="5"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model.number="formData.retry_delay"
                label="Retry Delay (seconds)"
                type="number"
                min="1"
                max="300"
              ></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-switch
                v-model="formData.is_active"
                label="Active"
                color="primary"
                hint="Inactive webhooks will not receive events"
                persistent-hint
              ></v-switch>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
      <v-card-actions>
        <v-btn
          v-if="editingWebhook"
          color="warning"
          variant="text"
          @click="testWebhook"
          :loading="testing"
        >
          <v-icon left>mdi-send</v-icon>
          Test Webhook
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn color="grey" variant="text" @click="close">Cancel</v-btn>
        <v-btn color="primary" variant="elevated" @click="save" :loading="saving">
          {{ editingWebhook ? 'Update' : 'Create' }}
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Test Result Dialog -->
    <v-dialog v-model="testResultDialog" max-width="500px">
      <v-card>
        <v-card-title>
          Test Result
        </v-card-title>
        <v-card-text>
          <v-alert
            :type="testResult.success ? 'success' : 'error'"
            variant="tonal"
          >
            {{ testResult.message }}
          </v-alert>
          <div v-if="testResult.details" class="mt-3">
            <strong>Response:</strong>
            <pre class="mt-2">{{ testResult.details }}</pre>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="text" @click="testResultDialog = false">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script>
import { ref, watch, computed } from 'vue'
import advancedAnalyticsAPI from '@/services/advancedAnalyticsAPI'

export default {
  name: 'WebhookDialog',
  props: {
    modelValue: Boolean,
    webhook: Object
  },
  emits: ['update:modelValue', 'saved'],
  setup(props, { emit }) {
    const dialog = computed({
      get: () => props.modelValue,
      set: (val) => emit('update:modelValue', val)
    })

    const saving = ref(false)
    const testing = ref(false)
    const showSecret = ref(false)
    const testResultDialog = ref(false)
    const testResult = ref({ success: false, message: '', details: null })
    const editingWebhook = computed(() => !!props.webhook)
    const selectedEvents = ref([])

    const availableEvents = ref([
      { value: 'click', text: 'Link Click', icon: 'mdi-cursor-pointer' },
      { value: 'conversion', text: 'Conversion', icon: 'mdi-target' },
      { value: 'fraud_detected', text: 'Fraud Detected', icon: 'mdi-shield-alert' },
      { value: 'ab_test_complete', text: 'A/B Test Complete', icon: 'mdi-chart-line' },
      { value: 'project_created', text: 'Project Created', icon: 'mdi-plus-circle' },
      { value: 'project_updated', text: 'Project Updated', icon: 'mdi-pencil' },
      { value: 'project_deleted', text: 'Project Deleted', icon: 'mdi-delete' },
      { value: 'threshold_exceeded', text: 'Threshold Exceeded', icon: 'mdi-alert' },
      { value: 'daily_report', text: 'Daily Report', icon: 'mdi-calendar' },
      { value: 'api_key_used', text: 'API Key Used', icon: 'mdi-key' }
    ])

    const defaultFormData = {
      name: '',
      url: '',
      secret: '',
      events: [],
      headers: [],
      retry_count: 3,
      retry_delay: 5,
      is_active: true
    }

    const formData = ref({ ...defaultFormData })

    watch(() => props.webhook, (newWebhook) => {
      if (newWebhook) {
        formData.value = { 
          ...newWebhook,
          headers: newWebhook.headers ? Object.entries(newWebhook.headers).map(([key, value]) => ({ key, value })) : []
        }
        selectedEvents.value = newWebhook.events || []
      } else {
        formData.value = { ...defaultFormData }
        selectedEvents.value = []
      }
    }, { immediate: true })

    watch(selectedEvents, (newEvents) => {
      formData.value.events = newEvents
    })

    const isValidUrl = (url) => {
      try {
        new URL(url)
        return true
      } catch {
        return false
      }
    }

    const generateSecret = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      let secret = ''
      for (let i = 0; i < 32; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      formData.value.secret = secret
    }

    const addHeader = () => {
      formData.value.headers.push({ key: '', value: '' })
    }

    const removeHeader = (index) => {
      formData.value.headers.splice(index, 1)
    }

    const save = async () => {
      if (!formData.value.name || !formData.value.url) {
        alert('Please fill in all required fields')
        return
      }

      if (!isValidUrl(formData.value.url)) {
        alert('Please enter a valid URL')
        return
      }

      if (selectedEvents.value.length === 0) {
        alert('Please select at least one event')
        return
      }

      saving.value = true
      try {
        const webhookData = {
          ...formData.value,
          headers: formData.value.headers.reduce((acc, h) => {
            if (h.key && h.value) acc[h.key] = h.value
            return acc
          }, {}),
          retry_policy: {
            max_attempts: formData.value.retry_count,
            delay_seconds: formData.value.retry_delay
          }
        }

        if (editingWebhook.value) {
          await advancedAnalyticsAPI.updateWebhook(props.webhook.id, webhookData)
        } else {
          await advancedAnalyticsAPI.createWebhook(webhookData)
        }
        emit('saved')
        close()
      } catch (error) {
        console.error('Error saving webhook:', error)
        alert('Failed to save webhook')
      } finally {
        saving.value = false
      }
    }

    const testWebhook = async () => {
      testing.value = true
      try {
        const result = await advancedAnalyticsAPI.testWebhook(props.webhook.id)
        testResult.value = {
          success: result.success,
          message: result.success ? 'Webhook test successful!' : 'Webhook test failed',
          details: result.response || result.error
        }
        testResultDialog.value = true
      } catch (error) {
        testResult.value = {
          success: false,
          message: 'Failed to test webhook',
          details: error.message
        }
        testResultDialog.value = true
      } finally {
        testing.value = false
      }
    }

    const close = () => {
      dialog.value = false
      formData.value = { ...defaultFormData }
      selectedEvents.value = []
      showSecret.value = false
    }

    return {
      dialog,
      saving,
      testing,
      showSecret,
      testResultDialog,
      testResult,
      editingWebhook,
      selectedEvents,
      availableEvents,
      formData,
      isValidUrl,
      generateSecret,
      addHeader,
      removeHeader,
      save,
      testWebhook,
      close
    }
  }
}
</script>

<style scoped>
.v-divider {
  margin: 16px 0;
}

pre {
  background-color: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
}
</style>