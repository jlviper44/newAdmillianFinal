<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  },
  existingGroups: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['create', 'close']);

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

// New comment group form
const newCommentGroup = ref({
  name: '',
  description: '',
  legends: [
    {
      conversations: [
        { user: 'A', text: '' }
      ]
    }
  ]
});

// Reset comment group form
const resetCommentGroupForm = () => {
  newCommentGroup.value = {
    name: '',
    description: '',
    legends: [
      {
        conversations: [
          { user: 'A', text: '' }
        ]
      }
    ]
  };
};

// JSON template download
const downloadJsonTemplate = () => {
  // Create a sample template
  const template = {
    name: "Sample Comment Group",
    description: "A template for creating comment groups",
    legends: [
      {
        conversations: [
          { user: "A", text: "This video is amazing! The editing is so smooth 🔥" },
          { user: "B", text: "I know right? Been following this creator for months now!" }
        ]
      },
      {
        conversations: [
          { user: "B", text: "OMG I've been trying to find a tutorial like this forever!" },
          { user: "C", text: "Same! This is exactly what I needed" }
        ]
      }
    ]
  };
  
  // Convert to JSON string
  const jsonString = JSON.stringify(template, null, 2);
  
  // Create a blob and download link
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // Create a temporary link and trigger download
  const a = document.createElement('a');
  a.href = url;
  a.download = 'comment_group_template.json';
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
        if (jsonData.name) newCommentGroup.value.name = jsonData.name;
        if (jsonData.description) newCommentGroup.value.description = jsonData.description;
        
        // Replace or merge legends
        showConfirm(
          'Import Data',
          'Would you like to replace existing templates or append the imported data?',
          () => {
            // Replace existing legends
            newCommentGroup.value.legends = jsonData.legends;
          },
          'Replace',
          'Append'
        );
        
        // Store append action for when cancel/append is clicked
        confirmDialog.value.onCancel = () => {
          // Append imported legends to existing ones
          newCommentGroup.value.legends = [...newCommentGroup.value.legends, ...jsonData.legends];
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
  newCommentGroup.value.legends.push({
    conversations: [
      { user: 'A', text: '' }
    ]
  });
};

const removeConversationTemplate = (index) => {
  if (newCommentGroup.value.legends.length > 1) {
    newCommentGroup.value.legends.splice(index, 1);
  }
};

const addMessage = (legendIndex) => {
  const conversations = newCommentGroup.value.legends[legendIndex].conversations;
  const lastUser = conversations[conversations.length - 1].user;
  
  // Cycle between users A, B, and C
  let nextUser;
  if (lastUser === 'A') nextUser = 'B';
  else if (lastUser === 'B') nextUser = 'C';
  else nextUser = 'A';
  
  conversations.push({ user: nextUser, text: '' });
};

const removeMessage = (legendIndex, messageIndex) => {
  const conversations = newCommentGroup.value.legends[legendIndex].conversations;
  if (conversations.length > 1) {
    conversations.splice(messageIndex, 1);
  }
};

const closeDialog = () => {
  resetCommentGroupForm();
  emit('close');
};

const createCommentGroup = () => {
  // Validate all messages have text before creating
  for (const legend of newCommentGroup.value.legends) {
    for (const convo of legend.conversations) {
      if (!convo.text || convo.text.trim().length === 0) {
        showAlert('error', 'All messages must contain at least 1 character');
        return;
      }
    }
  }
  
  emit('create', { ...newCommentGroup.value });
};

// Computed property to check if create button should be disabled
const isCreateDisabled = computed(() => {
  const name = newCommentGroup.value.name.trim();
  if (!name) return true;
  
  // Check if name already exists (case-insensitive)
  const nameExists = props.existingGroups.some(
    group => group.name.toLowerCase() === name.toLowerCase()
  );
  
  if (nameExists) return true;
  
  // Check if all messages have at least 1 character
  for (const legend of newCommentGroup.value.legends) {
    for (const convo of legend.conversations) {
      if (!convo.text || convo.text.trim().length === 0) {
        return true;
      }
    }
  }
  
  return false;
});
</script>

<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <div>
        <v-icon class="me-2">mdi-comment-plus</v-icon>
        Create Comment Group
      </div>
      <v-spacer></v-spacer>
      <v-btn icon @click="closeDialog">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-card-title>
    
    <v-divider></v-divider>
    
    <v-card-text class="pa-4">
      <v-form>
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
        
        <!-- Basic Info -->
        <v-row class="mb-2">
          <v-col cols="12" md="6">
            <v-text-field
              v-model="newCommentGroup.name"
              label="Group Name"
              placeholder="Enter a name for this comment group"
              variant="outlined"
              required
              :rules="[v => !!v.trim() || 'Name is required', v => !props.existingGroups.some(g => g.name.toLowerCase() === v.trim().toLowerCase()) || 'A group with this name already exists']"
            ></v-text-field>
          </v-col>
          
          <v-col cols="12" md="6">
            <v-text-field
              v-model="newCommentGroup.description"
              label="Description (Optional)"
              placeholder="Enter a description for this comment group"
              variant="outlined"
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
            @click="$refs.jsonFileInput.click()"
          >
            Import JSON
          </v-btn>
          <input
            ref="jsonFileInput"
            type="file"
            accept=".json"
            style="display: none"
            @change="handleJsonImport"
          />
          <v-btn
            color="success"
            size="small"
            prepend-icon="mdi-plus"
            @click="addConversationTemplate"
          >
            Add Template
          </v-btn>
        </div>
        
        <v-expansion-panels variant="accordion" class="mb-4">
          <v-expansion-panel
            v-for="(legend, legendIndex) in newCommentGroup.legends"
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
              <div class="d-flex justify-end mb-2">
                <v-btn
                  v-if="newCommentGroup.legends.length > 1"
                  color="error"
                  size="small"
                  variant="text"
                  prepend-icon="mdi-delete"
                  @click="removeConversationTemplate(legendIndex)"
                >
                  Remove Template
                </v-btn>
              </div>
              
              <!-- Messages -->
              <v-card
                v-for="(convo, convoIndex) in legend.conversations"
                :key="convoIndex"
                variant="outlined"
                class="mb-3"
              >
                <v-card-text class="py-2">
                  <div class="d-flex align-center mb-2">
                    <v-avatar
                      :color="convo.user === 'A' ? 'primary' : convo.user === 'B' ? 'success' : 'warning'"
                      size="32"
                      class="me-2"
                    >
                      <span class="text-subtitle-2 white--text">{{ convo.user }}</span>
                    </v-avatar>
                    
                    <!-- Add user selection dropdown -->
                    <v-select
                      v-model="convo.user"
                      :items="['A', 'B', 'C']"
                      label="User"
                      density="compact"
                      hide-details
                      class="me-2"
                      style="max-width: 120px;"
                    ></v-select>
                    
                    <v-spacer></v-spacer>
                    <v-btn
                      v-if="legend.conversations.length > 1"
                      icon
                      variant="text"
                      color="error"
                      size="small"
                      @click="removeMessage(legendIndex, convoIndex)"
                    >
                      <v-icon>mdi-delete</v-icon>
                    </v-btn>
                  </div>
                  
                  <v-textarea
                    v-model="convo.text"
                    label="Message Text"
                    placeholder="Enter the message content"
                    variant="outlined"
                    rows="2"
                    auto-grow
                    hide-details
                    :rules="[v => !!v && v.trim().length > 0 || 'Message text must contain at least 1 character']"
                  ></v-textarea>
                </v-card-text>
              </v-card>
              
              <!-- Add Message -->
              <div class="d-flex justify-center mt-2">
                <v-btn
                  color="primary"
                  size="small"
                  prepend-icon="mdi-message-plus"
                  @click="addMessage(legendIndex)"
                >
                  Add Message
                </v-btn>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-form>
    </v-card-text>
    
    <v-divider></v-divider>
    
    <v-card-actions class="pa-4">
      <v-spacer></v-spacer>
      <v-btn
        color="error"
        variant="text"
        @click="closeDialog"
      >
        Cancel
      </v-btn>
      <v-btn
        color="success"
        :loading="loading"
        :disabled="isCreateDisabled"
        @click="createCommentGroup"
      >
        Create Group
      </v-btn>
    </v-card-actions>
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