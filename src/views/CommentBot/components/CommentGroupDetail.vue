<script setup>
import { ref } from 'vue';

const props = defineProps({
  commentGroup: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['close']);

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString();
};

const closeDialog = () => {
  emit('close');
};
</script>

<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <div>
        <v-icon class="me-2">mdi-comment-text-multiple</v-icon>
        View Comment Group
      </div>
      <v-spacer></v-spacer>
      <v-btn icon @click="closeDialog">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-card-title>
    
    <v-divider></v-divider>
    
    <v-card-text class="pa-4">
      <!-- Basic Info -->
      <v-row class="mb-4">
        <v-col cols="12" md="6">
          <div class="text-caption text-medium-emphasis mb-1">Group Name</div>
          <div class="text-h6">{{ commentGroup.name }}</div>
        </v-col>
        
        <v-col cols="12" md="6">
          <div class="text-caption text-medium-emphasis mb-1">Description</div>
          <div class="text-body-1">{{ commentGroup.description || 'No description provided' }}</div>
        </v-col>
      </v-row>
      
      <v-divider class="my-4"></v-divider>
      
      <!-- Conversation Templates -->
      <div class="d-flex align-center mb-4">
        <div class="text-h6">Conversation Templates</div>
      </div>
      
      <v-expansion-panels 
        v-if="commentGroup.legends && commentGroup.legends.length > 0" 
        variant="accordion" 
        class="mb-4"
        :model-value="commentGroup.legends.map((_, index) => index)"
        multiple
      >
        <v-expansion-panel
          v-for="(legend, legendIndex) in commentGroup.legends"
          :key="legendIndex"
          :value="legendIndex"
        >
          <v-expansion-panel-title>
            <div class="d-flex align-center">
              <v-icon class="me-2">mdi-chat-outline</v-icon>
              {{ legend.legend_name || `Conversation Template ${legendIndex + 1}` }}
              <v-chip
                class="ms-2"
                size="x-small"
                color="info"
              >
                {{ legend.conversations ? legend.conversations.length : 0 }} messages
              </v-chip>
            </div>
          </v-expansion-panel-title>
          
          <v-expansion-panel-text>
            <!-- Messages in compact format -->
            <div class="pa-2">
              <div
                v-for="(message, messageIndex) in legend.conversations"
                :key="messageIndex"
                class="d-flex align-start mb-2"
              >
                <v-avatar
                  :color="messageIndex % 3 === 0 ? 'primary' : messageIndex % 3 === 1 ? 'success' : 'warning'"
                  size="24"
                  class="me-2 mt-1"
                >
                  <span class="text-caption white--text">{{ String.fromCharCode(65 + (messageIndex % 3)) }}</span>
                </v-avatar>
                <div class="flex-grow-1">
                  <div class="text-caption text-medium-emphasis mb-1">User {{ String.fromCharCode(65 + (messageIndex % 3)) }}</div>
                  <div class="text-body-2">{{ message }}</div>
                </div>
              </div>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
      <div v-else class="text-center py-4">
        <v-icon size="large" color="grey-lighten-1" class="mb-2">mdi-chat-remove-outline</v-icon>
        <div class="text-body-1 text-medium-emphasis">No conversation templates available</div>
      </div>
      
      <!-- Additional Info -->
      <v-divider class="my-4"></v-divider>
      
      <v-row>
        <v-col cols="12" md="6">
          <div class="text-caption text-medium-emphasis">Created</div>
          <div class="text-body-2">{{ formatDate(commentGroup.created_at) }}</div>
        </v-col>
        <v-col cols="12" md="6">
          <div class="text-caption text-medium-emphasis">Last Updated</div>
          <div class="text-body-2">{{ formatDate(commentGroup.updated_at) }}</div>
        </v-col>
      </v-row>
    </v-card-text>
    
    <v-divider></v-divider>
    
    <v-card-actions class="pa-4">
      <v-spacer></v-spacer>
      <v-btn
        color="primary"
        variant="text"
        @click="closeDialog"
      >
        Close
      </v-btn>
    </v-card-actions>
  </v-card>
</template>