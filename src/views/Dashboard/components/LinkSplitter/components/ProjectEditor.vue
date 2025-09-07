<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="900"
    persistent
  >
    <v-card>
      <v-card-title>
        {{ project ? 'Edit Project' : 'Create New Project' }}
      </v-card-title>
      
      <v-card-text>
        <v-stepper v-model="step" alt-labels>
          <v-stepper-header>
            <v-stepper-item
              :complete="step > 1"
              :value="1"
              title="Basic Info"
            ></v-stepper-item>
            
            <v-divider></v-divider>
            
            <v-stepper-item
              :complete="step > 2"
              :value="2"
              title="Split URLs"
            ></v-stepper-item>
            
            <v-divider></v-divider>
            
            <v-stepper-item
              :complete="step > 3"
              :value="3"
              title="Targeting"
            ></v-stepper-item>
            
            <v-divider></v-divider>
            
            <v-stepper-item
              :value="4"
              title="Advanced"
            ></v-stepper-item>
          </v-stepper-header>
          
          <v-stepper-window>
            <!-- Step 1: Basic Info -->
            <v-stepper-window-item :value="1">
              <v-container>
                <v-row>
                  <v-col cols="12">
                    <v-text-field
                      v-model="form.name"
                      label="Project Name"
                      required
                      variant="outlined"
                      :rules="[v => !!v || 'Name is required']"
                    ></v-text-field>
                  </v-col>
                  
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="form.group_id"
                      :items="groups"
                      item-title="name"
                      item-value="id"
                      label="Group"
                      variant="outlined"
                      clearable
                    ></v-select>
                  </v-col>
                  
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="form.custom_alias"
                      label="Custom Alias"
                      variant="outlined"
                      hint="Leave empty for auto-generated"
                      persistent-hint
                      prepend-inner-icon="mdi-link"
                      :prefix="`${origin}/l/`"
                    ></v-text-field>
                  </v-col>
                  
                  <v-col cols="12">
                    <v-text-field
                      v-model="form.main_url"
                      label="Main URL"
                      required
                      variant="outlined"
                      :rules="[v => !!v || 'Main URL is required', validateUrl]"
                      placeholder="https://example.com"
                    ></v-text-field>
                  </v-col>
                  
                  <v-col cols="12">
                    <v-text-field
                      v-model="form.safe_link"
                      label="Safe/Fallback URL (Optional)"
                      variant="outlined"
                      hint="Where to redirect if no rules match"
                      persistent-hint
                      :rules="[validateUrlOptional]"
                    ></v-text-field>
                  </v-col>
                </v-row>
              </v-container>
            </v-stepper-window-item>
            
            <!-- Step 2: Split URLs -->
            <v-stepper-window-item :value="2">
              <v-container>
                <v-row>
                  <v-col cols="12">
                    <div class="d-flex justify-space-between align-center mb-4">
                      <h3>Split URLs</h3>
                      <v-btn
                        color="primary"
                        size="small"
                        prepend-icon="mdi-plus"
                        @click="addSplitUrl"
                      >
                        Add URL
                      </v-btn>
                    </div>
                    
                    <v-alert
                      v-if="form.items.length === 0"
                      type="info"
                      variant="tonal"
                      class="mb-4"
                    >
                      Add at least one URL to split traffic between
                    </v-alert>
                    
                    <v-card
                      v-for="(item, index) in form.items"
                      :key="index"
                      class="mb-3"
                      variant="outlined"
                    >
                      <v-card-text>
                        <v-row>
                          <v-col cols="12" md="8">
                            <v-text-field
                              v-model="item.url"
                              label="URL"
                              variant="outlined"
                              density="compact"
                              :rules="[v => !!v || 'URL is required', validateUrl]"
                            ></v-text-field>
                          </v-col>
                          <v-col cols="12" md="3">
                            <v-text-field
                              v-model.number="item.weight"
                              label="Weight %"
                              type="number"
                              variant="outlined"
                              density="compact"
                              :suffix="`%`"
                            ></v-text-field>
                          </v-col>
                          <v-col cols="12" md="1">
                            <v-btn
                              icon="mdi-delete"
                              variant="text"
                              color="error"
                              @click="removeSplitUrl(index)"
                            ></v-btn>
                          </v-col>
                          <v-col cols="12">
                            <v-text-field
                              v-model="item.label"
                              label="Label (Optional)"
                              variant="outlined"
                              density="compact"
                              hint="For identification in analytics"
                            ></v-text-field>
                          </v-col>
                        </v-row>
                      </v-card-text>
                    </v-card>
                    
                    <v-btn
                      v-if="form.items.length > 0"
                      variant="outlined"
                      size="small"
                      @click="autoCalculateWeights"
                    >
                      Auto-calculate equal weights
                    </v-btn>
                  </v-col>
                </v-row>
              </v-container>
            </v-stepper-window-item>
            
            <!-- Step 3: Targeting Rules -->
            <v-stepper-window-item :value="3">
              <v-container>
                <TargetingRules
                  v-model="form.targeting"
                />
              </v-container>
            </v-stepper-window-item>
            
            <!-- Step 4: Advanced Settings -->
            <v-stepper-window-item :value="4">
              <v-container>
                <v-row>
                  <!-- Fraud Protection -->
                  <v-col cols="12">
                    <v-card variant="outlined">
                      <v-card-title>
                        <v-switch
                          v-model="form.fraud_protection.enabled"
                          label="Enable Fraud Protection"
                          color="primary"
                          hide-details
                        ></v-switch>
                      </v-card-title>
                      <v-card-text v-if="form.fraud_protection.enabled">
                        <v-row>
                          <v-col cols="12" md="6">
                            <v-switch
                              v-model="form.fraud_protection.blockBots"
                              label="Block Bot Traffic"
                              color="primary"
                            ></v-switch>
                          </v-col>
                          <v-col cols="12" md="6">
                            <v-text-field
                              v-model.number="form.fraud_protection.suspiciousThreshold"
                              label="Suspicious Score Threshold"
                              type="number"
                              variant="outlined"
                              density="compact"
                              :min="0"
                              :max="100"
                              suffix="%"
                            ></v-text-field>
                          </v-col>
                        </v-row>
                      </v-card-text>
                    </v-card>
                  </v-col>
                  
                  <!-- Link Limits -->
                  <v-col cols="12">
                    <v-card variant="outlined">
                      <v-card-title>Link Limits</v-card-title>
                      <v-card-text>
                        <v-row>
                          <v-col cols="12" md="6">
                            <v-text-field
                              v-model.number="form.clicks_limit"
                              label="Maximum Clicks"
                              type="number"
                              variant="outlined"
                              density="compact"
                              hint="Leave empty for unlimited"
                              persistent-hint
                            ></v-text-field>
                          </v-col>
                          <v-col cols="12" md="6">
                            <v-text-field
                              v-model="form.expires_at"
                              label="Expiration Date"
                              type="datetime-local"
                              variant="outlined"
                              density="compact"
                              hint="Leave empty for no expiration"
                              persistent-hint
                            ></v-text-field>
                          </v-col>
                        </v-row>
                      </v-card-text>
                    </v-card>
                  </v-col>
                  
                  <!-- Pixel Tracking -->
                  <v-col cols="12">
                    <v-card variant="outlined">
                      <v-card-title>Pixel Tracking</v-card-title>
                      <v-card-text>
                        <v-row>
                          <v-col cols="12" md="4">
                            <v-text-field
                              v-model="form.pixel_settings.tiktokPixelId"
                              label="TikTok Pixel ID"
                              variant="outlined"
                              density="compact"
                            ></v-text-field>
                          </v-col>
                          <v-col cols="12" md="4">
                            <v-text-field
                              v-model="form.pixel_settings.facebookPixelId"
                              label="Facebook Pixel ID"
                              variant="outlined"
                              density="compact"
                            ></v-text-field>
                          </v-col>
                          <v-col cols="12" md="4">
                            <v-text-field
                              v-model="form.pixel_settings.googlePixelId"
                              label="Google Analytics ID"
                              variant="outlined"
                              density="compact"
                            ></v-text-field>
                          </v-col>
                        </v-row>
                      </v-card-text>
                    </v-card>
                  </v-col>
                </v-row>
              </v-container>
            </v-stepper-window-item>
          </v-stepper-window>
        </v-stepper>
      </v-card-text>
      
      <v-card-actions>
        <v-btn
          v-if="step > 1"
          variant="text"
          @click="step--"
        >
          Back
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn
          variant="text"
          @click="cancel"
        >
          Cancel
        </v-btn>
        <v-btn
          v-if="step < 4"
          color="primary"
          variant="flat"
          @click="step++"
        >
          Next
        </v-btn>
        <v-btn
          v-else
          color="primary"
          variant="flat"
          @click="save"
          :loading="saving"
        >
          Save Project
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { ref, watch, computed } from 'vue'
import TargetingRules from './TargetingRules.vue'

export default {
  name: 'ProjectEditor',
  components: {
    TargetingRules
  },
  props: {
    modelValue: Boolean,
    project: Object,
    groups: Array
  },
  emits: ['update:modelValue', 'save'],
  setup(props, { emit }) {
    const step = ref(1)
    const saving = ref(false)
    const origin = window.location.origin
    
    const form = ref({
      name: '',
      group_id: null,
      custom_alias: '',
      main_url: '',
      safe_link: '',
      items: [],
      targeting: [],
      fraud_protection: {
        enabled: false,
        blockBots: false,
        suspiciousThreshold: 70,
        maxClicksPerIP: 10,
        maxClicksPerSession: 5
      },
      ab_testing: {},
      pixel_settings: {
        tiktokPixelId: '',
        facebookPixelId: '',
        googlePixelId: '',
        enableConversionTracking: false,
        enablePageViewTracking: false
      },
      expires_at: null,
      clicks_limit: null
    })
    
    // Watch for project changes
    watch(() => props.project, (newProject) => {
      if (newProject) {
        form.value = {
          ...form.value,
          ...newProject
        }
      } else {
        // Reset form for new project
        form.value = {
          name: '',
          group_id: null,
          custom_alias: '',
          main_url: '',
          safe_link: '',
          items: [],
          targeting: [],
          fraud_protection: {
            enabled: false,
            blockBots: false,
            suspiciousThreshold: 70,
            maxClicksPerIP: 10,
            maxClicksPerSession: 5
          },
          ab_testing: {},
          pixel_settings: {
            tiktokPixelId: '',
            facebookPixelId: '',
            googlePixelId: '',
            enableConversionTracking: false,
            enablePageViewTracking: false
          },
          expires_at: null,
          clicks_limit: null
        }
      }
      step.value = 1
    }, { immediate: true })
    
    // Methods
    const validateUrl = (value) => {
      if (!value) return true
      try {
        new URL(value)
        return true
      } catch {
        return 'Please enter a valid URL'
      }
    }
    
    const validateUrlOptional = (value) => {
      if (!value) return true
      return validateUrl(value)
    }
    
    const addSplitUrl = () => {
      form.value.items.push({
        url: '',
        weight: 0,
        label: '',
        targeting: []
      })
      autoCalculateWeights()
    }
    
    const removeSplitUrl = (index) => {
      form.value.items.splice(index, 1)
      if (form.value.items.length > 0) {
        autoCalculateWeights()
      }
    }
    
    const autoCalculateWeights = () => {
      if (form.value.items.length === 0) return
      const weight = 100 / form.value.items.length
      form.value.items.forEach(item => {
        item.weight = Math.round(weight * 100) / 100
      })
    }
    
    const cancel = () => {
      emit('update:modelValue', false)
      step.value = 1
    }
    
    const save = async () => {
      saving.value = true
      try {
        // Clean up empty values
        const data = {
          ...form.value,
          expires_at: form.value.expires_at || null,
          clicks_limit: form.value.clicks_limit || null
        }
        
        emit('save', data)
      } finally {
        saving.value = false
      }
    }
    
    return {
      step,
      saving,
      form,
      origin,
      validateUrl,
      validateUrlOptional,
      addSplitUrl,
      removeSplitUrl,
      autoCalculateWeights,
      cancel,
      save
    }
  }
}
</script>