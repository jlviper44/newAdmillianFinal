<template>
  <v-card class="mb-4">
    <v-card-text>
      <v-row align="center">
        <v-col cols="12" md="3">
          <v-text-field
            :model-value="searchInput"
            @update:model-value="$emit('update:searchInput', $event)"
            label="Search sparks..."
            variant="outlined"
            density="compact"
            hide-details
            prepend-inner-icon="mdi-magnify"
            clearable
          />
        </v-col>

        <v-col cols="12" md="2">
          <v-select
            :model-value="typeFilter"
            @update:model-value="$emit('update:typeFilter', $event)"
            :items="typeOptions"
            label="Type"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-col>

        <v-col cols="12" md="2">
          <v-select
            :model-value="statusFilter"
            @update:model-value="$emit('update:statusFilter', $event)"
            :items="statusOptions"
            label="Status"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-col>

        <v-col cols="12" md="2">
          <v-select
            :model-value="creatorFilter"
            @update:model-value="$emit('update:creatorFilter', $event)"
            :items="creatorOptions"
            label="Creator"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-col>

        <v-col cols="auto">
          <v-checkbox
            :model-value="showThumbnails"
            @update:model-value="$emit('update:showThumbnails', $event)"
            label="Show Thumbnails"
            hide-details
            density="compact"
          />
        </v-col>

        <v-col cols="auto">
          <v-btn
            v-if="!isBulkEditMode && !isCommentBotMode"
            variant="text"
            @click="$emit('clearFilters')"
            prepend-icon="mdi-filter-remove"
          >
            Clear Filters
          </v-btn>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup>
const props = defineProps({
  searchInput: String,
  typeFilter: String,
  statusFilter: String,
  creatorFilter: String,
  showThumbnails: Boolean,
  isBulkEditMode: Boolean,
  isCommentBotMode: Boolean,
  typeOptions: Array,
  statusOptions: Array,
  creatorOptions: Array
});

const emit = defineEmits([
  'update:searchInput',
  'update:typeFilter',
  'update:statusFilter',
  'update:creatorFilter',
  'update:showThumbnails',
  'clearFilters'
]);
</script>