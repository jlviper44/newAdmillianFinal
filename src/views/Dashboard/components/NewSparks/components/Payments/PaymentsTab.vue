<template>
  <div class="payments-tab">
    <!-- Undo Button -->
    <v-slide-y-transition>
      <v-alert
        v-if="showUndoButton"
        type="success"
        variant="tonal"
        closable
        @click:close="showUndoButton = false"
        class="mb-4"
      >
        <div class="d-flex align-center justify-space-between">
          <span>
            <template v-if="lastPaymentAction?.type === 'void'">
              Payment voided successfully for {{ lastPaymentAction?.creator }}
            </template>
            <template v-else>
              Payment marked successfully for {{ lastPaymentAction?.creator }}
              <span v-if="lastPaymentAction?.amount">
                (${{ lastPaymentAction.amount }})
              </span>
            </template>
          </span>
          <v-btn
            color="warning"
            variant="elevated"
            size="small"
            @click="handleUndoPayment"
            prepend-icon="mdi-undo"
          >
            Undo
          </v-btn>
        </div>
      </v-alert>
    </v-slide-y-transition>

    <!-- Summary Cards -->
    <v-row class="mb-4">
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-primary mb-2">${{ totalOwed }}</h3>
            <p class="text-body-2 text-grey">Total Owed</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-success mb-2">${{ totalPaid }}</h3>
            <p class="text-body-2 text-grey">Total Paid</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-warning mb-2">{{ unpaidSparks }}</h3>
            <p class="text-body-2 text-grey">Unpaid Videos</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-info mb-2">{{ activeCreators }}</h3>
            <p class="text-body-2 text-grey">Active Creators</p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Payment Settings -->
    <v-card class="mb-4">
      <v-card-title>
        <span>Payment Settings</span>
        <v-spacer />
        <v-btn
          color="primary"
          variant="elevated"
          :loading="isSavingSettings"
          @click="handleSaveSettings"
          prepend-icon="mdi-content-save"
        >
          Save Settings
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="defaultRate"
              label="Default Rate per Video"
              prefix="$"
              type="number"
              variant="outlined"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="defaultCommissionRate"
              label="Default Commission"
              :suffix="defaultCommissionType === 'percentage' ? '%' : '$'"
              type="number"
              variant="outlined"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-select
              v-model="defaultCommissionType"
              label="Commission Type"
              :items="[{title: 'Percentage', value: 'percentage'}, {title: 'Fixed Amount', value: 'fixed'}]"
              variant="outlined"
              density="compact"
            />
          </v-col>
        </v-row>

        <h4 class="text-h6 mb-3" v-if="creators.length > 0">Creator Custom Rates & Commissions</h4>
        <v-row v-if="creators.length > 0">
          <v-col
            v-for="creator in creators"
            :key="creator.id"
            cols="12"
          >
            <v-card variant="outlined" class="pa-3">
              <div class="font-weight-medium mb-2">{{ creator.name }}</div>
              <v-row>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="creator.rate"
                    label="Rate per Video"
                    prefix="$"
                    type="number"
                    variant="outlined"
                    density="compact"
                    hide-details
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="creator.commissionRate"
                    label="Commission"
                    :suffix="creator.commissionType === 'percentage' ? '%' : '$'"
                    type="number"
                    variant="outlined"
                    density="compact"
                    hide-details
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-select
                    v-model="creator.commissionType"
                    label="Type"
                    :items="[{title: 'Percentage', value: 'percentage'}, {title: 'Fixed', value: 'fixed'}]"
                    variant="outlined"
                    density="compact"
                    hide-details
                  />
                </v-col>
              </v-row>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Payments List -->
    <v-card>
      <v-card-title>Payment Summary by Creator</v-card-title>
      <v-card-text>
        <v-expansion-panels
          v-if="paymentsByCreator.length > 0"
          variant="accordion"
        >
          <v-expansion-panel
            v-for="creatorPayment in paymentsByCreator"
            :key="creatorPayment.creator"
          >
            <v-expansion-panel-title>
              <v-row align="center" class="flex-grow-0">
                <v-col cols="auto">
                  <v-avatar color="primary" size="32">
                    <span>{{ creatorPayment.creator.charAt(0) }}</span>
                  </v-avatar>
                </v-col>
                <v-col>
                  <div class="font-weight-medium">{{ creatorPayment.creator }}</div>
                  <div class="text-caption text-grey">
                    {{ creatorPayment.videos.length }} video{{ creatorPayment.videos.length !== 1 ? 's' : '' }} •
                    ${{ creatorPayment.rate }}/video
                    <span v-if="creatorPayment.commissionRate > 0">
                      + {{ creatorPayment.commissionRate }}{{ creatorPayment.commissionType === 'percentage' ? '%' : '$' }} commission
                    </span>
                  </div>
                </v-col>
                <v-col cols="auto">
                  <div class="text-right">
                    <div class="text-h6 text-primary">${{ creatorPayment.total.toFixed(2) }}</div>
                    <div class="text-caption text-grey">
                      Base: ${{ creatorPayment.baseAmount.toFixed(2) }}
                      <span v-if="creatorPayment.commissionAmount > 0">
                        + Commission: ${{ creatorPayment.commissionAmount.toFixed(2) }}
                      </span>
                    </div>
                  </div>
                </v-col>
              </v-row>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-list density="compact">
                <v-list-item
                  v-for="video in creatorPayment.videos"
                  :key="video.id"
                  class="pl-0"
                >
                  <template v-slot:prepend>
                    <v-icon size="small" color="grey">mdi-video</v-icon>
                  </template>
                  <v-list-item-title>{{ video.name }}</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip size="x-small" variant="flat" class="mr-2">{{ video.spark_code }}</v-chip>
                    <span class="text-caption">{{ formatDate(video.created_at) }}</span>
                  </v-list-item-subtitle>
                  <template v-slot:append>
                    <v-btn
                      icon
                      variant="text"
                      size="x-small"
                      :href="video.tiktok_link"
                      target="_blank"
                    >
                      <v-icon size="small">mdi-open-in-new</v-icon>
                    </v-btn>
                  </template>
                </v-list-item>
              </v-list>
              <v-divider class="my-2"></v-divider>

              <!-- Payout Amount Editor -->
              <div class="mb-3">
                <v-row align="center" no-gutters>
                  <v-col cols="auto" class="mr-3">
                    <span class="text-body-2">Payout Amount:</span>
                  </v-col>
                  <v-col cols="auto" class="mr-3">
                    <v-text-field
                      v-model="editingPayouts[creatorPayment.creator]"
                      :placeholder="creatorPayment.total.toFixed(2)"
                      prefix="$"
                      type="number"
                      variant="outlined"
                      density="compact"
                      hide-details
                      style="max-width: 120px;"
                      @focus="initializeEditingPayout(creatorPayment)"
                    />
                  </v-col>
                  <v-col cols="auto">
                    <v-btn
                      v-if="editingPayouts[creatorPayment.creator] !== undefined &&
                            editingPayouts[creatorPayment.creator] !== creatorPayment.total.toFixed(2)"
                      color="info"
                      variant="text"
                      size="x-small"
                      @click="resetPayoutAmount(creatorPayment)"
                    >
                      Reset
                    </v-btn>
                  </v-col>
                </v-row>
              </div>

              <!-- Action Buttons -->
              <div class="d-flex justify-end gap-2">
                <v-btn
                  color="error"
                  variant="outlined"
                  size="small"
                  @click="handleVoidCreatorPayment(creatorPayment.creator)"
                  prepend-icon="mdi-cancel"
                >
                  Void Payment
                </v-btn>
                <v-btn
                  color="success"
                  variant="tonal"
                  size="small"
                  @click="handleMarkCreatorPaid(creatorPayment.creator, editingPayouts[creatorPayment.creator])"
                  prepend-icon="mdi-check-circle"
                >
                  Mark Paid
                  <span v-if="editingPayouts[creatorPayment.creator] !== undefined &&
                             editingPayouts[creatorPayment.creator] !== creatorPayment.total.toFixed(2)">
                    (${{ editingPayouts[creatorPayment.creator] }})
                  </span>
                </v-btn>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
        <v-alert
          v-else
          type="info"
          variant="tonal"
          class="mt-4"
        >
          No unpaid videos found
        </v-alert>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { usePayments } from './composables/usePayments.js';
import { useSparks } from '../Sparks/composables/useSparks.js';

// Use the payments composable
const {
  defaultRate,
  defaultCommissionRate,
  defaultCommissionType,
  isSavingSettings,
  lastPaymentAction,
  showUndoButton,
  getPaymentsByCreator,
  getTotalOwed,
  getTotalPaid,
  getUnpaidSparks,
  getActiveCreators,
  getCreatorsWithRates,
  savePaymentSettings,
  markCreatorPaid,
  voidCreatorPayment,
  undoLastPayment
} = usePayments();

// State for editing payout amounts
const editingPayouts = ref({});

// Use the sparks composable to get data
const { sparks, fetchSparks } = useSparks();

// Computed properties for display
const totalOwed = computed(() => getTotalOwed(sparks.value));
const totalPaid = computed(() => getTotalPaid(sparks.value));
const unpaidSparks = computed(() => getUnpaidSparks(sparks.value));
const activeCreators = computed(() => getActiveCreators(sparks.value));
const paymentsByCreator = computed(() => getPaymentsByCreator(sparks.value));
const creators = computed(() => getCreatorsWithRates(sparks.value));

// Event handlers
const handleSaveSettings = async () => {
  try {
    await savePaymentSettings();
    console.log('Payment settings saved successfully');
  } catch (error) {
    console.error('Failed to save payment settings:', error);
  }
};

const handleMarkCreatorPaid = async (creator, customAmount = null) => {
  try {
    const finalAmount = customAmount !== undefined && customAmount !== null ?
      parseFloat(customAmount) : null;

    await markCreatorPaid(creator, sparks.value, finalAmount);
    console.log(`Marked creator ${creator} as paid`, { customAmount: finalAmount });

    // Clear the editing payout for this creator
    delete editingPayouts.value[creator];

    // Refresh sparks data to reflect the changes
    await fetchSparks();
  } catch (error) {
    console.error('Failed to mark creator as paid:', error);
  }
};

const handleVoidCreatorPayment = async (creator) => {
  try {
    await voidCreatorPayment(creator, sparks.value);
    console.log(`Voided payment for creator ${creator}`);

    // Clear the editing payout for this creator
    delete editingPayouts.value[creator];

    // Refresh sparks data to reflect the changes
    await fetchSparks();
  } catch (error) {
    console.error('Failed to void creator payment:', error);
  }
};

const handleUndoPayment = async () => {
  try {
    await undoLastPayment();
    console.log('Payment undone successfully');
    // Refresh sparks data to reflect the changes
    await fetchSparks();
  } catch (error) {
    console.error('Failed to undo payment:', error);
  }
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
};

// Helper functions for payout editing
const initializeEditingPayout = (creatorPayment) => {
  if (editingPayouts.value[creatorPayment.creator] === undefined) {
    editingPayouts.value[creatorPayment.creator] = creatorPayment.total.toFixed(2);
  }
};

const resetPayoutAmount = (creatorPayment) => {
  editingPayouts.value[creatorPayment.creator] = creatorPayment.total.toFixed(2);
};

// Load data on mount
onMounted(async () => {
  await fetchSparks();
});
</script>

<style scoped>
.payments-tab {
  /* Add your custom styles here */
}
</style>