<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { usersApi } from '@/services/api';
import { useAuth } from '@/composables/useAuth';

const { user } = useAuth();
const router = useRouter();

// State
const credits = ref(0);
const loading = ref({
  checkAccess: false,
  addAssistant: false,
  extendAssistant: {}
});
const error = ref({
  checkAccess: null,
  addAssistant: null
});

// Form state
const showAddDialog = ref(false);
const assistantEmail = ref('');
const assistants = ref([]);
const assistantRoles = ref({
  hasCommentBotAccess: false,
  hasDashboardAccess: false,
  hasBCGenAccess: false
});

// Confirmation dialogs
const showExtendDialog = ref(false);
const showDeleteDialog = ref(false);
const showEditDialog = ref(false);
const selectedAssistant = ref(null);
const editEmail = ref('');
const editRoles = ref({
  hasCommentBotAccess: false,
  hasDashboardAccess: false,
  hasBCGenAccess: false
});

// Validation
const emailRules = [
  v => !!v || 'Email is required',
  v => /.+@.+\..+/.test(v) || 'Email must be valid',
];

// Check user's credits
const checkAccess = async () => {
  loading.value.checkAccess = true;
  error.value.checkAccess = null;
  
  try {
    const data = await usersApi.checkAccess();
    
    // Get Virtual Assistant specific credits
    const virtualAssistantData = data.subscriptions?.virtual_assistant;
    credits.value = virtualAssistantData?.totalCredits || 0;
  } catch (err) {
    error.value.checkAccess = err.message || 'Failed to check access';
  } finally {
    loading.value.checkAccess = false;
  }
};

// Fetch virtual assistants
const fetchVirtualAssistants = async () => {
  try {
    const response = await usersApi.getVirtualAssistants();
    assistants.value = response.assistants || [];
  } catch (err) {
    console.error('Failed to fetch virtual assistants:', err);
  }
};

// Add virtual assistant
const addVirtualAssistant = async () => {
  if (!assistantEmail.value || !/.+@.+\..+/.test(assistantEmail.value)) {
    error.value.addAssistant = 'Please enter a valid email address';
    return;
  }
  
  // Check if it's the user's own email
  if (user.value?.email && assistantEmail.value.toLowerCase() === user.value.email.toLowerCase()) {
    error.value.addAssistant = 'You cannot add yourself as a virtual assistant';
    return;
  }

  if (credits.value < 1) {
    error.value.addAssistant = 'Insufficient credits';
    return;
  }

  loading.value.addAssistant = true;
  error.value.addAssistant = null;
  
  try {
    // Call API to add virtual assistant with roles
    const response = await usersApi.addVirtualAssistant(assistantEmail.value, assistantRoles.value);
    
    if (response.success) {
      // Add the new assistant to the list
      assistants.value.unshift(response.assistant);
      
      // Refresh credits
      await checkAccess();
      
      // Clear form and close dialog
      assistantEmail.value = '';
      assistantRoles.value = {
        hasCommentBotAccess: false,
        hasDashboardAccess: false,
        hasBCGenAccess: false
      };
      showAddDialog.value = false;
    } else {
      throw new Error(response.error || 'Failed to add virtual assistant');
    }
  } catch (err) {
    error.value.addAssistant = err.message || 'Failed to add virtual assistant';
  } finally {
    loading.value.addAssistant = false;
  }
};

// Show extend confirmation dialog
const confirmExtend = (assistant) => {
  selectedAssistant.value = assistant;
  showExtendDialog.value = true;
};

// Show delete confirmation dialog
const confirmDelete = (assistant) => {
  selectedAssistant.value = assistant;
  showDeleteDialog.value = true;
};

// Show edit dialog
const confirmEdit = (assistant) => {
  selectedAssistant.value = assistant;
  editEmail.value = assistant.email;
  editRoles.value = {
    hasCommentBotAccess: assistant.has_comment_bot_access || false,
    hasDashboardAccess: assistant.has_dashboard_access || false,
    hasBCGenAccess: assistant.has_bc_gen_access || false
  };
  showEditDialog.value = true;
};

// Remove virtual assistant
const removeAssistant = async () => {
  if (!selectedAssistant.value) return;
  
  try {
    const response = await usersApi.removeVirtualAssistant(selectedAssistant.value.id);
    
    if (response.success) {
      // Remove from local list
      assistants.value = assistants.value.filter(a => a.id !== selectedAssistant.value.id);
      showDeleteDialog.value = false;
      selectedAssistant.value = null;
    } else {
      throw new Error(response.error || 'Failed to remove virtual assistant');
    }
  } catch (err) {
    console.error('Failed to remove virtual assistant:', err);
    error.value.addAssistant = err.message || 'Failed to remove virtual assistant';
  }
};

// Edit virtual assistant email
const editAssistant = async () => {
  if (!selectedAssistant.value || !editEmail.value) return;
  
  if (!/.+@.+\..+/.test(editEmail.value)) {
    error.value.addAssistant = 'Please enter a valid email address';
    return;
  }
  
  // Check if it's the user's own email
  if (user.value?.email && editEmail.value.toLowerCase() === user.value.email.toLowerCase()) {
    error.value.addAssistant = 'You cannot use your own email for a virtual assistant';
    return;
  }
  
  const id = selectedAssistant.value.id;
  
  try {
    const response = await usersApi.editVirtualAssistant(id, editEmail.value, editRoles.value);
    
    if (response.success) {
      // Update the assistant's email and roles in the list
      const assistant = assistants.value.find(a => a.id === id);
      if (assistant) {
        assistant.email = response.newEmail || editEmail.value;
        assistant.has_comment_bot_access = editRoles.value.hasCommentBotAccess;
        assistant.has_dashboard_access = editRoles.value.hasDashboardAccess;
        assistant.has_bc_gen_access = editRoles.value.hasBCGenAccess;
      }
      
      // Close dialog
      showEditDialog.value = false;
      selectedAssistant.value = null;
      editEmail.value = '';
      editRoles.value = {
        hasCommentBotAccess: false,
        hasDashboardAccess: false,
        hasBCGenAccess: false
      };
    } else {
      throw new Error(response.error || 'Failed to edit virtual assistant');
    }
  } catch (err) {
    console.error('Failed to edit virtual assistant:', err);
    error.value.addAssistant = err.message || 'Failed to edit email';
  }
};

// Extend virtual assistant time
const extendAssistant = async () => {
  if (!selectedAssistant.value) return;
  
  if (credits.value < 1) {
    error.value.addAssistant = 'Insufficient credits to extend time';
    return;
  }
  
  const id = selectedAssistant.value.id;
  loading.value.extendAssistant[id] = true;
  
  try {
    const response = await usersApi.extendVirtualAssistant(id);
    
    if (response.success) {
      // Update the assistant's expiration date in the list
      const assistant = assistants.value.find(a => a.id === id);
      if (assistant) {
        assistant.expires_at = response.newExpiresAt;
      }
      
      // Refresh credits
      await checkAccess();
      
      // Close dialog
      showExtendDialog.value = false;
      selectedAssistant.value = null;
    } else {
      throw new Error(response.error || 'Failed to extend virtual assistant');
    }
  } catch (err) {
    console.error('Failed to extend virtual assistant:', err);
    error.value.addAssistant = err.message || 'Failed to extend time';
  } finally {
    loading.value.extendAssistant[id] = false;
  }
};


// Format date
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

// Calculate days remaining
const getDaysRemaining = (expiresAt) => {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffTime = expires - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

// Get status color and text
const getStatusInfo = (assistant) => {
  const daysRemaining = getDaysRemaining(assistant.expires_at);
  
  if (daysRemaining === 0) {
    return { color: 'error', text: 'Expired' };
  } else if (daysRemaining <= 7) {
    return { color: 'warning', text: `Expires in ${daysRemaining} days` };
  } else {
    return { color: 'success', text: `Active (${daysRemaining} days)` };
  }
};

// Initialize
onMounted(() => {
  checkAccess();
  fetchVirtualAssistants();
});

// Refresh data
const refreshData = async () => {
  await Promise.all([
    checkAccess(),
    fetchVirtualAssistants()
  ]);
};
</script>

<template>
  <v-container fluid class="pa-0">
    <!-- Credits Display Card -->
    <v-row>
      <v-col cols="12">
        <v-card elevation="2">
          <v-card-text>
            <v-row align="center">
              <v-col cols="12" :md="$vuetify.display.smAndDown ? '12' : '8'">
                <div class="d-flex align-center">
                  <v-icon size="48" color="primary" class="mr-4">mdi-wallet</v-icon>
                  <div>
                    <div class="text-overline">Available Credits</div>
                    <div class="text-h4 font-weight-bold">{{ credits }}</div>
                    <div class="text-caption text-grey">Each virtual assistant requires 1 credit</div>
                  </div>
                </div>
              </v-col>
              <v-col cols="12" :md="$vuetify.display.smAndDown ? '12' : '4'" class="text-right">
                <v-btn
                  color="primary"
                  :size="$vuetify.display.smAndDown ? 'default' : 'large'"
                  @click="showAddDialog = true"
                  :disabled="credits < 1"
                  block
                  :class="{ 'mt-3': $vuetify.display.smAndDown }"
                >
                  <v-icon start>mdi-robot-outline</v-icon>
                  Add Virtual Assistant
                </v-btn>
                <v-alert
                  v-if="credits < 1"
                  type="warning"
                  density="compact"
                  class="mt-2"
                  variant="tonal"
                >
                  You need at least 1 credit to add a virtual assistant
                </v-alert>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Virtual Assistants List -->
    <v-row class="mt-4">
      <v-col cols="12">
        <v-card elevation="2">
          <v-card-title class="d-flex align-center justify-space-between">
            <span>Virtual Assistants</span>
            <v-btn
              icon
              variant="text"
              size="small"
              @click="refreshData"
              :loading="loading.checkAccess"
            >
              <v-icon>mdi-refresh</v-icon>
            </v-btn>
          </v-card-title>
          <v-card-text>
            <v-data-table
              v-if="!$vuetify.display.smAndDown"
              :headers="[
                { title: 'Email', key: 'email' },
                { title: 'Permissions', key: 'permissions' },
                { title: 'Status', key: 'status' },
                { title: 'Added', key: 'created_at' },
                { title: 'Expires', key: 'expires_at' },
                { title: 'Actions', key: 'actions', sortable: false }
              ]"
              :items="assistants"
              :loading="loading.checkAccess"
              no-data-text="No virtual assistants added yet"
            >
              <template v-slot:item.permissions="{ item }">
                <div class="d-flex flex-wrap gap-1">
                  <v-chip
                    v-if="item.has_comment_bot_access"
                    size="x-small"
                    color="primary"
                    variant="outlined"
                  >
                    CommentBot
                  </v-chip>
                  <v-chip
                    v-if="item.has_dashboard_access"
                    size="x-small"
                    color="success"
                    variant="outlined"
                  >
                    Dashboard
                  </v-chip>
                  <v-chip
                    v-if="item.has_bc_gen_access"
                    size="x-small"
                    color="info"
                    variant="outlined"
                  >
                    BCGen
                  </v-chip>
                  <span v-if="!item.has_comment_bot_access && !item.has_dashboard_access && !item.has_bc_gen_access" class="text-caption text-medium-emphasis">
                    No permissions
                  </span>
                </div>
              </template>
              <template v-slot:item.status="{ item }">
                <v-chip
                  :color="getStatusInfo(item).color"
                  size="small"
                >
                  {{ getStatusInfo(item).text }}
                </v-chip>
              </template>
              <template v-slot:item.created_at="{ item }">
                {{ formatDate(item.created_at) }}
              </template>
              <template v-slot:item.expires_at="{ item }">
                {{ formatDate(item.expires_at) }}
              </template>
              <template v-slot:item.actions="{ item }">
                <v-btn
                  icon
                  variant="text"
                  size="small"
                  color="primary"
                  @click="confirmExtend(item)"
                  :disabled="credits < 1"
                  class="mr-1"
                >
                  <v-icon>mdi-clock-plus</v-icon>
                  <v-tooltip activator="parent" location="top">
                    Add 30 days (1 credit)
                  </v-tooltip>
                </v-btn>
                <v-btn
                  icon
                  variant="text"
                  size="small"
                  color="secondary"
                  @click="confirmEdit(item)"
                  class="mr-1"
                >
                  <v-icon>mdi-pencil</v-icon>
                  <v-tooltip activator="parent" location="top">
                    Edit email
                  </v-tooltip>
                </v-btn>
                <v-btn
                  icon
                  variant="text"
                  size="small"
                  color="error"
                  @click="confirmDelete(item)"
                >
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </template>
            </v-data-table>
            
            <!-- Mobile Card Layout -->
            <div v-else>
              <div v-if="assistants.length === 0" class="text-center py-8 text-medium-emphasis">
                No virtual assistants added yet
              </div>
              <v-card
                v-for="assistant in assistants"
                :key="assistant.id"
                class="mb-3"
                variant="outlined"
              >
                <v-card-text>
                  <div class="d-flex justify-space-between align-center mb-2">
                    <span class="font-weight-medium">{{ assistant.email }}</span>
                    <v-chip
                      :color="getStatusInfo(assistant).color"
                      size="small"
                    >
                      {{ getStatusInfo(assistant).text }}
                    </v-chip>
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    Added: {{ formatDate(assistant.created_at) }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    Expires: {{ formatDate(assistant.expires_at) }}
                  </div>
                  <div class="d-flex flex-wrap gap-1 mt-2">
                    <v-chip
                      v-if="assistant.has_comment_bot_access"
                      size="x-small"
                      color="primary"
                      variant="outlined"
                    >
                      CommentBot
                    </v-chip>
                    <v-chip
                      v-if="assistant.has_dashboard_access"
                      size="x-small"
                      color="success"
                      variant="outlined"
                    >
                      Dashboard
                    </v-chip>
                    <v-chip
                      v-if="assistant.has_bc_gen_access"
                      size="x-small"
                      color="info"
                      variant="outlined"
                    >
                      BCGen
                    </v-chip>
                    <span v-if="!assistant.has_comment_bot_access && !assistant.has_dashboard_access && !assistant.has_bc_gen_access" class="text-caption text-medium-emphasis">
                      No permissions set
                    </span>
                  </div>
                  <div class="mt-2 d-flex gap-2 flex-wrap">
                    <v-btn
                      size="small"
                      variant="text"
                      color="primary"
                      @click="confirmExtend(assistant)"
                      :disabled="credits < 1"
                    >
                      <v-icon start small>mdi-clock-plus</v-icon>
                      Extend
                    </v-btn>
                    <v-btn
                      size="small"
                      variant="text"
                      color="secondary"
                      @click="confirmEdit(assistant)"
                    >
                      <v-icon start small>mdi-pencil</v-icon>
                      Edit
                    </v-btn>
                    <v-btn
                      size="small"
                      variant="text"
                      color="error"
                      @click="confirmDelete(assistant)"
                    >
                      <v-icon start small>mdi-delete</v-icon>
                      Remove
                    </v-btn>
                  </div>
                </v-card-text>
              </v-card>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Add Virtual Assistant Dialog -->
    <v-dialog
      v-model="showAddDialog"
      :max-width="$vuetify.display.smAndDown ? '90%' : '500'"
    >
      <v-card>
        <v-card-title>
          <v-icon class="mr-2">mdi-robot-outline</v-icon>
          Add Virtual Assistant
        </v-card-title>
        <v-card-text>
          <v-alert
            type="info"
            density="compact"
            variant="tonal"
            class="mb-4"
          >
            <div>Adding a virtual assistant will:</div>
            <ul class="mt-2">
              <li>Use 1 credit from your balance</li>
              <li>Grant access for 30 days</li>
              <li>Auto-expire after 30 days</li>
            </ul>
          </v-alert>
          <v-text-field
            v-model="assistantEmail"
            label="Virtual Assistant Email"
            placeholder="assistant@example.com"
            type="email"
            variant="outlined"
            :rules="emailRules"
            :error-messages="error.addAssistant"
            @keyup.enter="addVirtualAssistant"
            @input="error.addAssistant = null"
            class="mb-4"
          ></v-text-field>
          
          <div class="mb-2">
            <p class="text-subtitle-2 mb-2">Access Permissions</p>
            <v-checkbox
              v-model="assistantRoles.hasCommentBotAccess"
              label="CommentBot Access"
              density="compact"
              hide-details
            ></v-checkbox>
            <v-checkbox
              v-model="assistantRoles.hasDashboardAccess"
              label="Dashboard Access"
              density="compact"
              hide-details
            ></v-checkbox>
            <v-checkbox
              v-model="assistantRoles.hasBCGenAccess"
              label="BCGen Access"
              density="compact"
              hide-details
            ></v-checkbox>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="showAddDialog = false"
            :disabled="loading.addAssistant"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            @click="addVirtualAssistant"
            :loading="loading.addAssistant"
          >
            Add Assistant
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
    <!-- Extend Time Confirmation Dialog -->
    <v-dialog
      v-model="showExtendDialog"
      :max-width="$vuetify.display.smAndDown ? '90%' : '500'"
    >
      <v-card>
        <v-card-title>
          <v-icon class="mr-2">mdi-clock-plus</v-icon>
          Extend Virtual Assistant
        </v-card-title>
        <v-card-text>
          <v-alert
            type="info"
            density="compact"
            variant="tonal"
            class="mb-4"
          >
            Are you sure you want to extend time for <strong>{{ selectedAssistant?.email }}</strong>?
          </v-alert>
          <div class="mb-2">
            <strong>Cost:</strong> 1 credit
          </div>
          <div class="mb-2">
            <strong>Extension:</strong> 30 days
          </div>
          <div v-if="selectedAssistant">
            <strong>Current expiration:</strong> {{ formatDate(selectedAssistant.expires_at) }}
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="showExtendDialog = false; selectedAssistant = null"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            @click="extendAssistant"
            :loading="loading.extendAssistant[selectedAssistant?.id]"
            :disabled="credits < 1"
          >
            Extend Time
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
    <!-- Delete Confirmation Dialog -->
    <v-dialog
      v-model="showDeleteDialog"
      :max-width="$vuetify.display.smAndDown ? '90%' : '500'"
    >
      <v-card>
        <v-card-title class="text-error">
          <v-icon class="mr-2">mdi-alert</v-icon>
          Remove Virtual Assistant
        </v-card-title>
        <v-card-text>
          <v-alert
            type="warning"
            density="compact"
            variant="tonal"
            class="mb-4"
          >
            Are you sure you want to remove <strong>{{ selectedAssistant?.email }}</strong>?
          </v-alert>
          <div class="text-body-2">
            This action cannot be undone. The virtual assistant will immediately lose access.
          </div>
          <div class="text-body-2 mt-2" v-if="selectedAssistant">
            <strong>Status:</strong> {{ getStatusInfo(selectedAssistant).text }}
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="showDeleteDialog = false; selectedAssistant = null"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            variant="elevated"
            @click="removeAssistant"
          >
            Remove Assistant
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
    <!-- Edit Email Dialog -->
    <v-dialog
      v-model="showEditDialog"
      :max-width="$vuetify.display.smAndDown ? '90%' : '500'"
    >
      <v-card>
        <v-card-title>
          <v-icon class="mr-2">mdi-pencil</v-icon>
          Edit Virtual Assistant
        </v-card-title>
        <v-card-text>
          <div class="mb-4">
            <div class="text-caption text-medium-emphasis mb-1">Current email</div>
            <div class="text-body-1">{{ selectedAssistant?.email }}</div>
          </div>
          <v-text-field
            v-model="editEmail"
            label="New Email Address"
            placeholder="assistant@example.com"
            type="email"
            variant="outlined"
            :rules="emailRules"
            :error-messages="error.addAssistant"
            @keyup.enter="editAssistant"
          ></v-text-field>
          <v-alert
            type="info"
            density="compact"
            variant="tonal"
            class="mt-2"
          >
            The virtual assistant will need to use the new email to access their account.
          </v-alert>
          
          <div class="mt-4">
            <p class="text-subtitle-2 mb-2">Access Permissions</p>
            <v-checkbox
              v-model="editRoles.hasCommentBotAccess"
              label="CommentBot Access"
              density="compact"
              hide-details
            ></v-checkbox>
            <v-checkbox
              v-model="editRoles.hasDashboardAccess"
              label="Dashboard Access"
              density="compact"
              hide-details
            ></v-checkbox>
            <v-checkbox
              v-model="editRoles.hasBCGenAccess"
              label="BCGen Access"
              density="compact"
              hide-details
            ></v-checkbox>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="showEditDialog = false; selectedAssistant = null; editEmail = ''; error.addAssistant = null"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            @click="editAssistant"
            :disabled="!editEmail"
          >
            Save Changes
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
</style>