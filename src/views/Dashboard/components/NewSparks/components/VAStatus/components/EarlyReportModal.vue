<template>
  <v-dialog v-model="localValue" max-width="800px" persistent>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-file-document-plus</v-icon>
        Generate Early Report
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" @click="closeModal" />
      </v-card-title>

      <v-card-text>
        <v-stepper v-model="currentStep" :items="stepperItems" hide-actions flat>
          <!-- Step 1: Date Range & VA Selection -->
          <template v-slot:item.1>
            <div class="step-content">
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="dateRange.start"
                    label="Start Date"
                    type="date"
                    variant="outlined"
                    density="comfortable"
                    :rules="[validateStartDate]"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="dateRange.end"
                    label="End Date"
                    type="date"
                    variant="outlined"
                    density="comfortable"
                    :rules="[validateEndDate]"
                  />
                </v-col>
              </v-row>

              <v-select
                v-model="selectedVAs"
                :items="availableVAs"
                label="Select VAs (leave empty for all)"
                multiple
                chips
                variant="outlined"
                density="comfortable"
                clearable
                class="mt-4"
              >
                <template v-slot:prepend-item>
                  <v-list-item>
                    <v-list-item-action>
                      <v-checkbox-btn
                        :model-value="selectedVAs.length === availableVAs.length"
                        :indeterminate="selectedVAs.length > 0 && selectedVAs.length < availableVAs.length"
                        @click="toggleAllVAs"
                      />
                    </v-list-item-action>
                    <v-list-item-title>Select All</v-list-item-title>
                  </v-list-item>
                  <v-divider />
                </template>
              </v-select>

              <v-alert
                v-if="dateRangeWarning"
                type="warning"
                variant="tonal"
                class="mt-4"
              >
                {{ dateRangeWarning }}
              </v-alert>
            </div>
          </template>

          <!-- Step 2: Preview -->
          <template v-slot:item.2>
            <div class="step-content">
              <div v-if="isLoadingPreview" class="text-center py-8">
                <v-progress-circular indeterminate color="primary" size="48" />
                <div class="text-subtitle-1 mt-4">Calculating preview...</div>
              </div>

              <div v-else>
                <!-- Preview Summary -->
                <v-row class="mb-4">
                  <v-col cols="12" md="4">
                    <v-card variant="tonal" color="primary">
                      <v-card-text class="text-center">
                        <div class="text-h4">{{ previewData.length }}</div>
                        <div class="text-subtitle-2">VAs to be paid</div>
                      </v-card-text>
                    </v-card>
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-card variant="tonal" color="success">
                      <v-card-text class="text-center">
                        <div class="text-h4">{{ totalSparks }}</div>
                        <div class="text-subtitle-2">Total sparks</div>
                      </v-card-text>
                    </v-card>
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-card variant="tonal" color="info">
                      <v-card-text class="text-center">
                        <div class="text-h4">${{ totalAmount }}</div>
                        <div class="text-subtitle-2">Total amount</div>
                      </v-card-text>
                    </v-card>
                  </v-col>
                </v-row>

                <!-- Conflicts Alert -->
                <v-alert
                  v-if="hasConflicts"
                  type="error"
                  variant="tonal"
                  class="mb-4"
                >
                  <template v-slot:title>Conflicts Detected</template>
                  Some VAs already have payments for overlapping periods. Please review before proceeding.
                </v-alert>

                <!-- Preview Table -->
                <v-data-table
                  :headers="previewHeaders"
                  :items="previewData"
                  density="compact"
                  :items-per-page="10"
                  no-data-text="No VAs found for the selected criteria"
                >
                  <!-- VA Column -->
                  <template v-slot:item.va_email="{ item }">
                    <div class="d-flex align-center">
                      <v-avatar color="primary" size="24" class="mr-2">
                        <span class="text-caption">{{ item.va_email.charAt(0).toUpperCase() }}</span>
                      </v-avatar>
                      {{ item.va_email }}
                    </div>
                  </template>

                  <!-- Conflict Status -->
                  <template v-slot:item.hasConflict="{ item }">
                    <v-chip
                      v-if="item.hasExistingReport"
                      color="error"
                      size="small"
                      variant="tonal"
                    >
                      Conflict
                    </v-chip>
                    <v-chip
                      v-else
                      color="success"
                      size="small"
                      variant="tonal"
                    >
                      Clear
                    </v-chip>
                  </template>

                  <!-- Earnings -->
                  <template v-slot:item.total_earnings="{ item }">
                    <div class="font-weight-medium text-success">
                      ${{ item.total_earnings.toFixed(2) }}
                    </div>
                  </template>
                </v-data-table>
              </div>
            </div>
          </template>

          <!-- Step 3: Confirmation -->
          <template v-slot:item.3>
            <div class="step-content">
              <v-alert type="info" variant="tonal" class="mb-4">
                <template v-slot:title>Ready to Generate Report</template>
                This will create payment entries for {{ previewData.length }} VAs totaling ${{ totalAmount }}.
                The payments will appear in the Payments tab and can be edited before being marked as paid.
              </v-alert>

              <div class="text-h6 mb-2">Report Summary:</div>
              <v-list density="compact">
                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon>mdi-calendar-range</v-icon>
                  </template>
                  <v-list-item-title>Date Range</v-list-item-title>
                  <v-list-item-subtitle>{{ formatDate(dateRange.start) }} - {{ formatDate(dateRange.end) }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon>mdi-account-group</v-icon>
                  </template>
                  <v-list-item-title>VAs Selected</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedVAs.length > 0 ? `${selectedVAs.length} specific VAs` : 'All VAs' }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon>mdi-cash</v-icon>
                  </template>
                  <v-list-item-title>Total Payment</v-list-item-title>
                  <v-list-item-subtitle>${{ totalAmount }} for {{ totalSparks }} sparks</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </div>
          </template>
        </v-stepper>
      </v-card-text>

      <v-card-actions class="px-6 pb-4">
        <v-btn
          v-if="currentStep > 1"
          variant="outlined"
          @click="previousStep"
        >
          Back
        </v-btn>
        <v-spacer />
        <v-btn variant="outlined" @click="closeModal">Cancel</v-btn>
        <v-btn
          v-if="currentStep < 3"
          color="primary"
          variant="elevated"
          @click="nextStep"
          :disabled="!canProceedToNextStep"
          :loading="isLoadingPreview"
        >
          {{ currentStep === 1 ? 'Generate Preview' : 'Continue' }}
        </v-btn>
        <v-btn
          v-else
          color="success"
          variant="elevated"
          @click="generateReport"
          :loading="isGeneratingReport"
        >
          Generate Report
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useVAStatus } from '../composables/useVAStatus.js';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  availableVAs: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:modelValue', 'generate']);

// Use VA Status composable
const {
  isLoading,
  isGeneratingReport,
  previewEarlyReport,
  generateEarlyReport,
  reportPreview,
  hasPreviewData,
  totalPreviewAmount,
  conflictsDetected
} = useVAStatus();

// Component state
const currentStep = ref(1);
const isLoadingPreview = ref(false);
const dateRange = ref({
  start: '',
  end: ''
});
const selectedVAs = ref([]);
const previewData = ref([]);

// Stepper configuration
const stepperItems = [
  { title: 'Date & VAs', value: '1' },
  { title: 'Preview', value: '2' },
  { title: 'Confirm', value: '3' }
];

// Preview table headers
const previewHeaders = [
  { title: 'VA', key: 'va_email', sortable: true },
  { title: 'Sparks', key: 'sparks_created', sortable: true },
  { title: 'Earnings', key: 'total_earnings', sortable: true },
  { title: 'Status', key: 'hasConflict', sortable: false }
];

// Computed properties
const localValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const dateRangeWarning = computed(() => {
  if (!dateRange.value.start || !dateRange.value.end) return null;

  const start = new Date(dateRange.value.start);
  const end = new Date(dateRange.value.end);
  const today = new Date();

  if (start > end) {
    return 'Start date must be before end date';
  }

  if (end > today) {
    return 'End date cannot be in the future';
  }

  const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  if (diffDays > 14) {
    return 'Date range is longer than 2 weeks. Consider breaking into smaller periods.';
  }

  return null;
});

const canProceedToNextStep = computed(() => {
  if (currentStep.value === 1) {
    return dateRange.value.start &&
           dateRange.value.end &&
           !dateRangeWarning.value;
  }
  if (currentStep.value === 2) {
    return previewData.value.length > 0;
  }
  return true;
});

const totalSparks = computed(() => {
  return previewData.value.reduce((sum, va) => sum + va.sparks_created, 0);
});

const totalAmount = computed(() => {
  return previewData.value.reduce((sum, va) => sum + va.total_earnings, 0).toFixed(2);
});

const hasConflicts = computed(() => {
  return previewData.value.some(va => va.hasExistingReport);
});

// Methods
const closeModal = () => {
  localValue.value = false;
  resetModal();
};

const resetModal = () => {
  currentStep.value = 1;
  dateRange.value = { start: '', end: '' };
  selectedVAs.value = [];
  previewData.value = [];
};

const toggleAllVAs = () => {
  if (selectedVAs.value.length === props.availableVAs.length) {
    selectedVAs.value = [];
  } else {
    selectedVAs.value = [...props.availableVAs.map(va => va.value)];
  }
};

const validateStartDate = (value) => {
  if (!value) return 'Start date is required';
  const date = new Date(value);
  const today = new Date();
  if (date > today) return 'Start date cannot be in the future';
  return true;
};

const validateEndDate = (value) => {
  if (!value) return 'End date is required';
  const date = new Date(value);
  const today = new Date();
  if (date > today) return 'End date cannot be in the future';
  return true;
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const nextStep = async () => {
  if (currentStep.value === 1) {
    // Generate preview
    await generatePreview();
  }
  if (canProceedToNextStep.value) {
    currentStep.value++;
  }
};

const previousStep = () => {
  currentStep.value--;
};

const generatePreview = async () => {
  try {
    isLoadingPreview.value = true;

    const vaEmails = selectedVAs.value.length > 0 ? selectedVAs.value : null;
    const preview = await previewEarlyReport(
      dateRange.value.start,
      dateRange.value.end,
      vaEmails
    );

    previewData.value = preview;
  } catch (error) {
    console.error('Failed to generate preview:', error);
    // TODO: Add proper error handling/notification
  } finally {
    isLoadingPreview.value = false;
  }
};

const generateReport = async () => {
  try {
    const vaEmails = selectedVAs.value.length > 0 ? selectedVAs.value : null;
    const result = await generateEarlyReport(
      dateRange.value.start,
      dateRange.value.end,
      vaEmails,
      'admin'
    );

    emit('generate', {
      dateRange: dateRange.value,
      vaEmails,
      result
    });

    closeModal();
  } catch (error) {
    console.error('Failed to generate report:', error);
    // TODO: Add proper error handling/notification
  }
};

// Set default date range when modal opens
watch(localValue, (newValue) => {
  if (newValue && !dateRange.value.start) {
    // Default to current week
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);

    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    dateRange.value.start = monday.toISOString().split('T')[0];
    dateRange.value.end = sunday.toISOString().split('T')[0];
  }
});
</script>

<style scoped>
.step-content {
  min-height: 300px;
  padding: 20px 0;
}

.v-stepper {
  box-shadow: none !important;
}

.text-h4 {
  font-weight: 600;
}

.v-card--variant-tonal {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
</style>