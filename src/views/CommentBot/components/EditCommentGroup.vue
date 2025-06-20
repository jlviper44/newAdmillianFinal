<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  commentGroup: {
    type: Object,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  },
  deleteLoading: {
    type: Boolean,
    default: false
  },
  deleteError: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['update', 'delete', 'cancel']);

// Dialog handling
const alertDialog = ref({
  show: false,
  type: 'error',
  title: '',
  message: ''
});

const confirmDialog = ref({
  show: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  onConfirm: null,
  onCancel: null
});

// Show alert dialog
const showAlert = (type, message, title = '') => {
  alertDialog.value = {
    show: true,
    type: type,
    title: title || (type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Information'),
    message: message
  };
};

// Show confirm dialog
const showConfirm = (title, message, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel') => {
  confirmDialog.value = {
    show: true,
    title: title,
    message: message,
    confirmText: confirmText,
    cancelText: cancelText,
    onConfirm: onConfirm,
    onCancel: null
  };
};

// Handle confirm dialog response
const handleConfirm = () => {
  if (confirmDialog.value.onConfirm) {
    confirmDialog.value.onConfirm();
  }
  confirmDialog.value.show = false;
};

// Edit form data
const editedGroup = ref({
  id: null,
  name: '',
  description: '',
  legends: []
});

// Watch for changes to commentGroup prop
watch(() => props.commentGroup, (newGroup) => {
  if (newGroup) {
    editedGroup.value = {
      id: newGroup.id,
      name: newGroup.name || '',
      description: newGroup.description || '',
      legends: newGroup.legends ? newGroup.legends.map(legend => ({
        legend_name: legend.legend_name || '',
        conversations: Array.isArray(legend.conversations) ? legend.conversations : []
      })) : []
    };
  }
}, { immediate: true, deep: true });

// JSON template download
const downloadJsonTemplate = () => {
  // Convert edited group to JSON template format
  const template = {
    name: editedGroup.value.name,
    description: editedGroup.value.description,
    legends: editedGroup.value.legends
  };
  
  // Convert to JSON string
  const jsonString = JSON.stringify(template, null, 2);
  
  // Create a blob and download link
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // Create a temporary link and trigger download
  const a = document.createElement('a');
  a.href = url;
  a.download = `comment_group_${props.commentGroup.id}.json`;
  document.body.appendChild(a);
  a.click();
  
  // Clean up
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
};

// JSON import handling
const handleJsonImport = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const jsonData = JSON.parse(e.target.result);
      
      // Validate JSON structure
      if (jsonData.legends && Array.isArray(jsonData.legends)) {
        // If JSON contains name/description, use them
        if (jsonData.name) editedGroup.value.name = jsonData.name;
        if (jsonData.description) editedGroup.value.description = jsonData.description;
        
        // Replace or merge legends
        showConfirm(
          'Import Data',
          'Would you like to replace existing templates or append the imported data?',
          () => {
            // Replace existing legends
            editedGroup.value.legends = jsonData.legends;
          },
          'Replace',
          'Append'
        );
        
        // Store append action for when cancel/append is clicked
        confirmDialog.value.onCancel = () => {
          // Append imported legends to existing ones
          editedGroup.value.legends = [...editedGroup.value.legends, ...jsonData.legends];
        };
      } else {
        showAlert('error', 'Invalid JSON format. The file must contain a "legends" array.');
      }
    } catch (err) {
      showAlert('error', 'Error parsing JSON file: ' + err.message);
    }
    
    // Clear the file input
    event.target.value = '';
  };
  
  reader.readAsText(file);
};

// Conversation template management
const addConversationTemplate = () => {
  editedGroup.value.legends.push({
    legend_name: '',
    conversations: ['']
  });
};

const removeConversationTemplate = (index) => {
  if (editedGroup.value.legends.length > 1) {
    editedGroup.value.legends.splice(index, 1);
  }
};

const addMessage = (legendIndex) => {
  editedGroup.value.legends[legendIndex].conversations.push('');
};

const removeMessage = (legendIndex, messageIndex) => {
  const conversations = editedGroup.value.legends[legendIndex].conversations;
  if (conversations.length > 1) {
    conversations.splice(messageIndex, 1);
  }
};

const updateCommentGroup = () => {
  emit('update', { ...editedGroup.value });
};

const deleteCommentGroup = () => {
  showConfirm(
    'Delete Comment Group',
    `Are you sure you want to delete the comment group "${props.commentGroup.name}"? This action cannot be undone.`,
    () => {
      emit('delete');
    },
    'Delete',
    'Cancel'
  );
};

const closeDialog = () => {
  emit('cancel');
};
</script>

<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <div>
        <v-icon class="me-2">mdi-comment-edit</v-icon>
        Edit Comment Group
      </div>
      <v-spacer></v-spacer>
      <v-btn icon @click="closeDialog">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-card-title>
    
    <v-divider></v-divider>
    
    <v-card-text class="pa-4">
      <v-form @submit.prevent="updateCommentGroup">
        <!-- Error Alert -->
        <v-alert
          v-if="error"
          type="error"
          variant="outlined"
          class="mb-4"
          closable
        >
          {{ error }}
        </v-alert>
        
        <!-- Delete Error Alert -->
        <v-alert
          v-if="deleteError"
          type="error"
          variant="outlined"
          class="mb-4"
          closable
        >
          {{ deleteError }}
        </v-alert>
        
        <!-- Basic Info -->
        <v-row class="mb-2">
          <v-col cols="12" md="6">
            <v-text-field
              v-model="editedGroup.name"
              label="Group Name"
              placeholder="Enter a name for this comment group"
              variant="outlined"
              :disabled="loading"
              required
              :rules="[v => !!v || 'Name is required']"
            ></v-text-field>
          </v-col>
          
          <v-col cols="12" md="6">
            <v-text-field
              v-model="editedGroup.description"
              label="Description (Optional)"
              placeholder="Enter a description for this comment group"
              variant="outlined"
              :disabled="loading"
            ></v-text-field>
          </v-col>
        </v-row>
        
        <v-divider class="my-4"></v-divider>
        
        <!-- Conversation Templates -->
        <div class="d-flex align-center mb-4">
          <div class="text-h6">Conversation Templates</div>
          <v-spacer></v-spacer>
          <v-btn
            color="secondary"
            size="small"
            prepend-icon="mdi-file-download"
            class="me-2"
            @click="downloadJsonTemplate"
          >
            Download Template
          </v-btn>
          <v-btn
            color="info"
            size="small"
            prepend-icon="mdi-file-upload"
            class="me-2"
            :disabled="loading"
            @click="$refs.fileInput.click()"
          >
            Import JSON
          </v-btn>
          <input
            ref="fileInput"
            type="file"
            accept=".json"
            style="display: none"
            @change="handleJsonImport"
          />
          <v-btn
            color="primary"
            size="small"
            prepend-icon="mdi-plus"
            :disabled="loading"
            @click="addConversationTemplate"
          >
            Add Template
          </v-btn>
        </div>
        
        <v-expansion-panels variant="accordion" class="mb-4">
          <v-expansion-panel
            v-for="(legend, legendIndex) in editedGroup.legends"
            :key="legendIndex"
          >
            <v-expansion-panel-title>
              <div class="d-flex align-center">
                <v-icon class="me-2">mdi-chat-outline</v-icon>
                Conversation Template {{ legendIndex + 1 }}
                <v-chip
                  class="ms-2"
                  size="x-small"
                  color="info"
                >
                  {{ legend.conversations.length }} messages
                </v-chip>
              </div>
            </v-expansion-panel-title>
            
            <v-expansion-panel-text>
              <!-- Template Actions -->
              <div class="d-flex justify-space-between mb-2">
                <v-text-field
                  v-model="legend.legend_name"
                  label="Template Name (Optional)"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="mr-2"
                ></v-text-field>
                <v-btn
                  v-if="editedGroup.legends.length > 1"
                  color="error"
                  size="small"
                  variant="text"
                  prepend-icon="mdi-delete"
                  :disabled="loading"
                  @click="removeConversationTemplate(legendIndex)"
                >
                  Remove Template
                </v-btn>
              </div>
              
              <!-- Messages -->
              <div class="mt-3">
                <v-card
                  v-for="(message, messageIndex) in legend.conversations"
                  :key="messageIndex"
                  variant="outlined"
                  class="mb-3"
                >
                  <v-card-text class="py-2">
                    <div class="d-flex align-center mb-2">
                      <v-avatar
                        :color="messageIndex % 3 === 0 ? 'primary' : messageIndex % 3 === 1 ? 'success' : 'warning'"
                        size="32"
                        class="me-2"
                      >
                        <span class="text-subtitle-2 white--text">{{ String.fromCharCode(65 + (messageIndex % 3)) }}</span>
                      </v-avatar>
                      <span class="text-caption">User {{ String.fromCharCode(65 + (messageIndex % 3)) }}</span>
                      
                      <v-spacer></v-spacer>
                      <v-btn
                        v-if="legend.conversations.length > 1"
                        icon
                        variant="text"
                        color="error"
                        size="small"
                        :disabled="loading"
                        @click="removeMessage(legendIndex, messageIndex)"
                      >
                        <v-icon>mdi-delete</v-icon>
                      </v-btn>
                    </div>
                    
                    <v-textarea
                      v-model="legend.conversations[messageIndex]"
                      label="Message Text"
                      placeholder="Enter the message content"
                      variant="outlined"
                      rows="2"
                      auto-grow
                      :disabled="loading"
                      hide-details
                      :rules="[v => !!v || 'Message text is required']"
                    ></v-textarea>
                  </v-card-text>
                </v-card>
              </div>
              
              <!-- Add Message -->
              <div class="d-flex justify-center mt-2">
                <v-btn
                  color="primary"
                  size="small"
                  prepend-icon="mdi-message-plus"
                  :disabled="loading"
                  @click="addMessage(legendIndex)"
                >
                  Add Message
                </v-btn>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
        
        <!-- Actions -->
        <div class="d-flex justify-space-between mt-4">
          <v-btn
            color="error"
            variant="outlined"
            @click="deleteCommentGroup"
            :loading="deleteLoading"
            :disabled="loading"
          >
            <v-icon start>mdi-delete</v-icon>
            Delete Group
          </v-btn>
          <div class="d-flex gap-2">
            <v-btn
              variant="text"
              @click="closeDialog"
              :disabled="loading || deleteLoading"
            >
              Cancel
            </v-btn>
            <v-btn
              color="primary"
              variant="elevated"
              type="submit"
              :loading="loading"
              :disabled="!editedGroup.name || editedGroup.legends.length === 0 || deleteLoading"
            >
              Save Changes
            </v-btn>
          </div>
        </div>
      </v-form>
    </v-card-text>
  </v-card>
  
  <!-- Alert Dialog -->
  <v-dialog
    v-model="alertDialog.show"
    max-width="500"
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon 
          :color="alertDialog.type" 
          class="mr-2"
        >
          {{ alertDialog.type === 'error' ? 'mdi-alert-circle' : 
             alertDialog.type === 'success' ? 'mdi-check-circle' : 
             alertDialog.type === 'warning' ? 'mdi-alert' : 'mdi-information' }}
        </v-icon>
        {{ alertDialog.title }}
      </v-card-title>
      <v-card-text>
        {{ alertDialog.message }}
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn 
          :color="alertDialog.type" 
          variant="flat"
          @click="alertDialog.show = false"
        >
          OK
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Confirm Dialog -->
  <v-dialog
    v-model="confirmDialog.show"
    max-width="500"
    persistent
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon color="warning" class="mr-2">mdi-alert</v-icon>
        {{ confirmDialog.title }}
      </v-card-title>
      <v-card-text>
        {{ confirmDialog.message }}
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn 
          variant="text"
          @click="confirmDialog.show = false; confirmDialog.onCancel && confirmDialog.onCancel()"
        >
          {{ confirmDialog.cancelText }}
        </v-btn>
        <v-btn 
          color="primary" 
          variant="flat"
          @click="handleConfirm"
        >
          {{ confirmDialog.confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>