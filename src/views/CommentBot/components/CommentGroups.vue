<script setup>
import { ref, computed } from 'vue';
import axios from 'axios';

const props = defineProps({
  commentGroups: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  },
});

const emit = defineEmits(['refresh', 'create-group', 'view-details', 'edit-group']);

// Computed properties
const hasCommentGroups = computed(() => {
  return props.commentGroups && props.commentGroups.length > 0;
});

const refreshCommentGroups = () => {
  emit('refresh');
};

const viewDetails = (group) => {
  emit('view-details', group);
};

const editGroup = (group) => {
  emit('edit-group', group);
};

const createGroup = () => {
  emit('create-group');
};
</script>

<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <div>
        <v-icon class="me-2">mdi-comment-multiple</v-icon>
        Comment Groups
      </div>
      <v-spacer></v-spacer>
      <v-btn 
        color="primary" 
        class="me-2"
        prepend-icon="mdi-plus"
        @click="createGroup"
      >
        Create Group
      </v-btn>
      <v-btn 
        color="primary" 
        variant="outlined" 
        :loading="loading"
        @click="refreshCommentGroups"
      >
        Refresh
      </v-btn>
    </v-card-title>
    
    <v-card-text>
      <v-skeleton-loader v-if="loading" type="table"></v-skeleton-loader>
      <div v-else-if="!hasCommentGroups" class="text-center py-4">
        <v-icon size="large" color="grey-lighten-1" class="mb-2">mdi-comment-question-outline</v-icon>
        <div class="text-body-1 text-medium-emphasis">No comment groups available</div>
        <div class="text-caption text-medium-emphasis">
          Create a comment group to get started
        </div>
      </div>
      <v-table v-else>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Legends</th>
            <th>Created</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="group in commentGroups" :key="group.id">
            <td>{{ group.name }}</td>
            <td>{{ group.description || 'N/A' }}</td>
            <td>{{ group.legend_count || 0 }}</td>
            <td>{{ new Date(group.created_at).toLocaleString() }}</td>
            <td>
              <v-chip
                size="small"
                color="success"
              >
                Active
              </v-chip>
            </td>
            <td>
              <v-tooltip text="View Details" location="top">
                <template v-slot:activator="{ props }">
                  <v-btn
                    icon
                    variant="text"
                    color="primary"
                    @click="viewDetails(group)"
                    v-bind="props"
                  >
                    <v-icon>mdi-eye</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>
              <v-btn
                icon
                variant="text"
                color="primary"
                @click="editGroup(group)"
              >
                <v-icon>mdi-pencil</v-icon>
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card-text>
  </v-card>
</template>