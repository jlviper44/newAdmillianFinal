<template>
  <v-col cols="auto" class="ml-auto">
    <v-btn
      v-if="!isBulkEditMode && !isCommentBotMode"
      variant="tonal"
      color="warning"
      class="mr-2"
      @click="$emit('startBulkEdit')"
      prepend-icon="mdi-pencil-box-multiple"
    >
      Edit All
    </v-btn>

    <template v-if="isBulkEditMode">
      <v-btn
        color="success"
        variant="elevated"
        class="mr-2"
        @click="$emit('saveBulkEdit')"
        prepend-icon="mdi-check-all"
        :loading="isSavingBulk"
      >
        Save All
      </v-btn>
      <v-btn
        color="error"
        variant="elevated"
        class="mr-2"
        @click="$emit('deleteSelected', selectedItems)"
        prepend-icon="mdi-delete-sweep"
        :disabled="selectedItems.length === 0"
      >
        Delete Selected ({{ selectedItems.length }})
      </v-btn>
      <v-btn
        color="grey"
        variant="tonal"
        class="mr-2"
        @click="$emit('cancelBulkEdit')"
        prepend-icon="mdi-close"
      >
        Cancel
      </v-btn>
    </template>

    <v-btn
      v-if="!isBulkEditMode && !isCommentBotMode"
      variant="tonal"
      color="primary"
      class="mr-2"
      @click="$emit('exportToCSV')"
      prepend-icon="mdi-download"
    >
      Export CSV
    </v-btn>

    <v-btn
      v-if="!isBulkEditMode && !isCommentBotMode"
      color="secondary"
      variant="elevated"
      class="mr-2"
      @click="$emit('bulkAdd')"
      prepend-icon="mdi-plus"
    >
      Add Spark
    </v-btn>

    <v-btn
      v-if="!isBulkEditMode && !isCommentBotMode && hasCommentBotAccess"
      color="primary"
      variant="elevated"
      class="mr-2"
      @click="$emit('startCommentBot')"
      prepend-icon="mdi-robot"
    >
      Comment Bot
    </v-btn>

    <v-btn
      v-if="isCommentBotMode"
      color="error"
      variant="tonal"
      class="mr-2"
      @click="$emit('cancelCommentBot')"
      prepend-icon="mdi-close"
    >
      Cancel Comment Bot
    </v-btn>
  </v-col>
</template>

<script setup>
const props = defineProps({
  isBulkEditMode: Boolean,
  isCommentBotMode: Boolean,
  isSavingBulk: Boolean,
  hasCommentBotAccess: Boolean,
  selectedItems: Array
});

const emit = defineEmits([
  'startBulkEdit',
  'saveBulkEdit',
  'cancelBulkEdit',
  'deleteSelected',
  'exportToCSV',
  'bulkAdd',
  'startCommentBot',
  'cancelCommentBot'
]);
</script>