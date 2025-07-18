<script setup>
import { ref, computed } from 'vue';
import axios from 'axios';
import { useAuth } from '@/composables/useAuth';

const { user } = useAuth();

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

// Show creator column if user is part of a team
const showCreator = computed(() => {
  return user.value?.team != null;
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
    <v-card-title class="d-flex align-center" :class="{ 'flex-wrap': $vuetify.display.smAndDown }">
      <div class="d-flex align-center" :class="{ 'mb-2': $vuetify.display.smAndDown }">
        <v-icon class="me-2" :size="$vuetify.display.smAndDown ? 'small' : 'default'">mdi-comment-multiple</v-icon>
        <span :class="$vuetify.display.smAndDown ? 'text-body-1' : ''">Comment Groups</span>
      </div>
      <v-spacer></v-spacer>
      <div class="d-flex gap-2">
        <v-btn 
          color="primary" 
          :prepend-icon="$vuetify.display.smAndDown ? '' : 'mdi-plus'"
          @click="createGroup"
          :size="$vuetify.display.smAndDown ? 'small' : 'default'"
          :icon="$vuetify.display.smAndDown"
        >
          <v-icon v-if="$vuetify.display.smAndDown">mdi-plus</v-icon>
          <span v-else>Create Group</span>
        </v-btn>
        <v-btn 
          color="primary" 
          variant="outlined" 
          :loading="loading"
          @click="refreshCommentGroups"
          :size="$vuetify.display.smAndDown ? 'small' : 'default'"
          :icon="$vuetify.display.smAndDown"
        >
          <v-icon>mdi-refresh</v-icon>
          <span v-if="!$vuetify.display.smAndDown" class="ml-2">Refresh</span>
        </v-btn>
      </div>
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
      
      <!-- Mobile Card Layout -->
      <div v-else-if="$vuetify.display.smAndDown" class="mobile-comment-groups">
        <v-card 
          v-for="group in commentGroups" 
          :key="group.id"
          class="mb-3 comment-group-card"
          variant="outlined"
        >
          <v-card-text class="pb-2">
            <!-- Group Header -->
            <div class="d-flex justify-space-between align-center mb-2">
              <h4 class="text-subtitle-1 font-weight-bold">{{ group.name }}</h4>
              <v-chip size="x-small" color="success">Active</v-chip>
            </div>
            
            <!-- Group Info -->
            <div class="group-details">
              <div v-if="group.description" class="text-caption text-medium-emphasis mb-1">
                {{ group.description }}
              </div>
              
              <div class="d-flex justify-space-between align-center">
                <div class="text-caption">
                  <v-icon size="x-small" class="mr-1">mdi-format-list-text</v-icon>
                  {{ group.legend_count || 0 }} legends
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ new Date(group.created_at).toLocaleDateString() }}
                </div>
              </div>
              
              <div v-if="showCreator && group.creator" class="text-caption text-medium-emphasis mt-1">
                <v-icon size="x-small" class="mr-1">mdi-account</v-icon>
                {{ group.creator.name }}
              </div>
            </div>
            
            <!-- Actions -->
            <div class="d-flex gap-2 mt-3">
              <v-btn
                color="primary"
                variant="tonal"
                size="small"
                @click="viewDetails(group)"
                class="flex-grow-1"
              >
                <v-icon start size="small">mdi-eye</v-icon>
                View Details
              </v-btn>
              <v-btn
                color="primary"
                variant="outlined"
                size="small"
                @click="editGroup(group)"
                icon
              >
                <v-icon size="small">mdi-pencil</v-icon>
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </div>
      
      <!-- Desktop Table Layout -->
      <v-table v-else>
        <thead>
          <tr>
            <th>Name</th>
            <th v-if="showCreator">Created By</th>
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
            <td v-if="showCreator">
              <div v-if="group.creator" class="d-flex align-center">
                <v-icon size="small" class="mr-1">mdi-account</v-icon>
                <span class="text-caption">{{ group.creator.name }}</span>
              </div>
              <span v-else class="text-caption text-disabled">Unknown</span>
            </td>
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

<style scoped>
/* Mobile Comment Groups */
.mobile-comment-groups {
  max-width: 100%;
}

.comment-group-card {
  transition: all 0.2s ease;
  border-radius: 12px !important;
  overflow: hidden;
}

.comment-group-card:active {
  transform: scale(0.98);
}

.group-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Mobile optimizations */
@media (max-width: 600px) {
  .v-card-title {
    padding: 12px !important;
  }
  
  .v-card-text {
    padding: 12px !important;
  }
  
  .comment-group-card {
    margin-bottom: 8px !important;
  }
  
  .comment-group-card .v-card__text {
    padding: 12px !important;
  }
  
  /* Ensure buttons don't overflow */
  .v-btn {
    min-width: auto !important;
  }
}

/* Fix table overflow on tablets */
@media (max-width: 960px) {
  .v-table {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  .v-table table {
    min-width: 600px;
  }
}
</style>