<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="500">
    <v-card>
      <v-card-title class="text-h6">
        <v-icon color="error" class="mr-2">mdi-alert-circle</v-icon>
        Confirm Delete
      </v-card-title>
      <v-card-text>
        <p class="text-body-1 mb-3">
          Are you sure you want to delete this spark?
        </p>
        <div v-if="spark" class="pa-3 bg-grey-lighten-4 rounded">
          <p class="font-weight-bold mb-1">{{ spark.name }}</p>
          <p class="text-caption text-grey mb-0">
            Code: {{ spark.spark_code }}
          </p>
        </div>
        <v-alert type="warning" variant="tonal" density="compact" class="mt-3">
          <v-icon size="small" class="mr-1">mdi-alert</v-icon>
          This action cannot be undone.
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
          <v-icon start>mdi-delete</v-icon>
          Delete Spark
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
const props = defineProps({
  modelValue: Boolean,
  spark: Object,
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