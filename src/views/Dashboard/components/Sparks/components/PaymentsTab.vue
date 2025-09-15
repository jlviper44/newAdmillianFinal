<template>
  <div>
    <!-- Undo Button -->
    <v-slide-y-transition>
      <v-alert
        v-if="showUndoButton"
        type="success"
        variant="tonal"
        closable
        @click:close="$emit('update:showUndoButton', false)"
        class="mb-4"
      >
        <div class="d-flex align-center justify-space-between">
          <span>Payment marked successfully for {{ lastPaymentAction?.creator }}</span>
          <v-btn
            color="warning"
            variant="elevated"
            size="small"
            @click="undoLastPayment"
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
          @click="savePaymentSettings"
          prepend-icon="mdi-content-save"
        >
          Save Settings
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="4">
            <v-text-field
              :model-value="defaultRate"
              @update:model-value="$emit('update:defaultRate', $event)"
              label="Default Rate per Video"
              prefix="$"
              type="number"
              variant="outlined"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              :model-value="defaultCommissionRate"
              @update:model-value="$emit('update:defaultCommissionRate', $event)"
              label="Default Commission"
              :suffix="defaultCommissionType === 'percentage' ? '%' : '$'"
              type="number"
              variant="outlined"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-select
              :model-value="defaultCommissionType"
              @update:model-value="$emit('update:defaultCommissionType', $event)"
              label="Commission Type"
              :items="[{title: 'Percentage', value: 'percentage'}, {title: 'Fixed Amount', value: 'fixed'}]"
              variant="outlined"
              density="compact"
            />
          </v-col>
        </v-row>

        <h4 class="text-h6 mb-3">Creator Custom Rates & Commissions</h4>
        <v-row>
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
                    <div class="text-h6 text-primary">${{ creatorPayment.total }}</div>
                    <div class="text-caption text-grey">
                      Base: ${{ creatorPayment.baseAmount }}
                      <span v-if="creatorPayment.commissionAmount > 0">
                        + Commission: ${{ creatorPayment.commissionAmount }}
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
              <div class="d-flex justify-end">
                <v-btn
                  color="success"
                  variant="tonal"
                  size="small"
                  @click="markCreatorPaid(creatorPayment.creator)"
                >
                  Mark All Paid
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
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  showUndoButton: Boolean,
  lastPaymentAction: Object,
  totalOwed: [Number, String],
  totalPaid: [Number, String],
  unpaidSparks: Number,
  activeCreators: Number,
  defaultRate: Number,
  defaultCommissionRate: Number,
  defaultCommissionType: String,
  isSavingSettings: Boolean,
  creators: Array,
  paymentsByCreator: Array
});

const emit = defineEmits([
  'update:showUndoButton',
  'update:defaultRate',
  'update:defaultCommissionRate',
  'update:defaultCommissionType',
  'undoLastPayment',
  'savePaymentSettings',
  'markCreatorPaid'
]);

const undoLastPayment = () => emit('undoLastPayment');
const savePaymentSettings = () => emit('savePaymentSettings');
const markCreatorPaid = (creator) => emit('markCreatorPaid', creator);
const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
};
</script>