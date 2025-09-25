<template>
  <v-card v-if="isBulkEditMode" class="mb-4 batch-update-card">
    <v-card-title class="text-h6 pb-2">
      <v-icon class="mr-2">mdi-pencil-box-multiple</v-icon>
      Batch Update - Apply to Selected Items
      <v-spacer />
      <v-chip class="mr-2" color="white" variant="flat">
        {{ selectedItems.length }} selected
      </v-chip>
      <v-btn
        size="small"
        variant="tonal"
        class="mr-2"
        @click="$emit('selectAllItems')"
      >
        Select All
      </v-btn>
      <v-btn
        size="small"
        variant="tonal"
        @click="$emit('clearSelection')"
      >
        Clear Selection
      </v-btn>
    </v-card-title>

    <v-card-text>
      <v-row align="center" dense>
        <!-- Status field -->
        <v-col cols="12" md="6">
          <v-row align="center" no-gutters>
            <v-col cols="8">
              <v-select
                v-model="batchUpdate.status"
                :items="['active', 'testing', 'untested', 'blocked']"
                label="Status"
                density="compact"
                variant="outlined"
                hide-details
                clearable
              />
            </v-col>
            <v-col cols="4" class="pl-2">
              <v-btn
                size="small"
                variant="tonal"
                color="primary"
                block
                @click="applyBatchUpdate('status')"
                :disabled="!batchUpdate.status"
              >
                Apply
              </v-btn>
            </v-col>
          </v-row>
        </v-col>

        <!-- Type field -->
        <v-col cols="12" md="6">
          <v-row align="center" no-gutters>
            <v-col cols="8">
              <v-text-field
                v-model="batchUpdate.type"
                label="Offer"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                placeholder="Enter offer..."
              />
              <div class="d-flex gap-2 mt-2">
                <v-chip
                  size="x-small"
                  variant="outlined"
                  @click="batchUpdate.type = 'CPI'"
                >
                  CPI
                </v-chip>
                <v-chip
                  size="x-small"
                  variant="outlined"
                  @click="batchUpdate.type = 'Auto'"
                >
                  Auto
                </v-chip>
                <v-chip
                  size="x-small"
                  variant="outlined"
                  @click="batchUpdate.type = 'Shein'"
                >
                  Shein
                </v-chip>
                <v-chip
                  size="x-small"
                  variant="outlined"
                  @click="batchUpdate.type = 'Cash'"
                >
                  Cash
                </v-chip>
              </div>
            </v-col>
            <v-col cols="4" class="pl-2">
              <v-btn
                size="small"
                variant="tonal"
                color="primary"
                block
                @click="applyBatchUpdate('type')"
                :disabled="!batchUpdate.type"
              >
                Apply
              </v-btn>
            </v-col>
          </v-row>
        </v-col>
      </v-row>

      <v-row align="center" dense class="mt-2">
        <!-- Name field -->
        <v-col cols="12" md="6">
          <v-row align="center" no-gutters>
            <v-col cols="8">
              <v-text-field
                v-model="batchUpdate.name"
                label="Name"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                placeholder="Enter name..."
              />
            </v-col>
            <v-col cols="4" class="pl-2">
              <v-btn
                size="small"
                variant="tonal"
                color="primary"
                block
                @click="applyBatchUpdate('name')"
                :disabled="!batchUpdate.name"
              >
                Apply
              </v-btn>
            </v-col>
          </v-row>
        </v-col>

        <!-- Creator field -->
        <v-col cols="12" md="6">
          <v-row align="center" no-gutters>
            <v-col cols="8">
              <v-select
                v-model="batchUpdate.creator"
                :items="virtualAssistants"
                label="Creator"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                placeholder="Select creator..."
              />
            </v-col>
            <v-col cols="4" class="pl-2">
              <v-btn
                size="small"
                variant="tonal"
                color="primary"
                block
                @click="applyBatchUpdate('creator')"
                :disabled="!batchUpdate.creator"
              >
                Apply
              </v-btn>
            </v-col>
          </v-row>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  isBulkEditMode: Boolean,
  selectedItems: Array,
  virtualAssistants: Array
});

const emit = defineEmits([
  'selectAllItems',
  'clearSelection',
  'applyBatchUpdates',
  'showBatchUpdateSuccess',
  'showBatchUpdateWarning'
]);

// Batch update state
const batchUpdate = ref({
  name: '',
  type: null,
  status: null,
  creator: null
});

// Batch update function
const applyBatchUpdate = (field) => {
  const value = batchUpdate.value[field];

  if (value === null || value === undefined) {
    return;
  }

  // Check if any items are selected
  if (props.selectedItems.length === 0) {
    emit('showBatchUpdateWarning', 'Please select items to update');
    return;
  }

  // Prepare updates for selected items
  const updates = {};
  props.selectedItems.forEach(spark => {
    const key = `${spark.id}-${field === 'spark_code' ? 'spark_code' : field}`;
    updates[key] = value;
  });

  // Emit the updates to parent
  emit('applyBatchUpdates', updates);

  // Clear the batch update field after applying
  batchUpdate.value[field] = field === 'creator' ? undefined : null;

  // Show success message (emit to parent)
  emit('showBatchUpdateSuccess', { field, count: props.selectedItems.length });
};
</script>

<style scoped>
/* Batch update card styling */
.batch-update-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.batch-update-card .v-card-title {
  color: white;
}

.batch-update-card .v-alert {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}
</style>