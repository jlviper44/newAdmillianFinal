<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="500">
    <v-card>
      <v-card-title class="text-h6">
        <v-icon color="error" class="mr-2">mdi-alert-circle</v-icon>
        Confirm Bulk Delete
      </v-card-title>
      <v-card-text>
        <p class="text-body-1 mb-3">
          Are you sure you want to delete <strong>{{ selectedCount }}</strong> selected spark{{ selectedCount !== 1 ? 's' : '' }}?
        </p>
        <v-alert type="warning" variant="tonal" density="compact">
          <v-icon size="small" class="mr-1">mdi-alert</v-icon>
          This action cannot be undone. All selected sparks will be permanently deleted.
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="close">
          Cancel
        </v-btn>
        <v-btn
          color="error"
          variant="elevated"
          @click="confirmDelete"
          :loading="isLoading"
        >
          <v-icon start>mdi-delete-sweep</v-icon>
          Delete {{ selectedCount }} Spark{{ selectedCount !== 1 ? 's' : '' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
const props = defineProps({
  modelValue: Boolean,
  selectedCount: {
    type: Number,
    default: 0
  },
  isLoading: Boolean
});

const emit = defineEmits(['update:modelValue', 'confirm']);

function close() {
  emit('update:modelValue', false);
}

function confirmDelete() {
  emit('confirm');
}
</script>