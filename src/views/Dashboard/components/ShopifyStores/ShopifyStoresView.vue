<template>
  <v-container fluid class="shopify-stores-container pa-4">
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-6">
          <div>
            <h2 class="text-h5 font-weight-bold">Shopify Stores</h2>
            <p class="text-subtitle-2 text-grey-darken-1">Manage your connected Shopify stores</p>
          </div>
          <v-btn 
            color="primary" 
            @click="openCreateModal"
            class="elevation-0"
          >
            <v-icon class="mr-2">mdi-plus</v-icon>
            Add Store
          </v-btn>
        </div>
      </v-col>
    </v-row>
    
    <!-- Search and Filters -->
    <v-card class="mb-4">
      <v-card-text>
        <v-row align="center">
          <v-col cols="12" md="6">
            <v-text-field
              v-model="searchQuery"
              label="Search stores"
              append-icon="mdi-magnify"
              hide-details
              @keyup.enter="searchStores"
              placeholder="Search by name or URL..."
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="statusFilter"
              label="Status"
              :items="[
                { title: 'All Status', value: 'all' },
                { title: 'Active', value: 'active' },
                { title: 'Inactive', value: 'inactive' }
              ]"
              hide-details
              @update:model-value="searchStores"
            ></v-select>
          </v-col>
          <v-col cols="12" md="3">
            <v-btn color="primary" @click="searchStores" class="ml-2">
              Search
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
    
    <!-- Stores Grid -->
    <v-row v-if="isLoading">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
        <p class="mt-2">Loading stores...</p>
      </v-col>
    </v-row>
    
    <v-row v-else-if="stores.length === 0">
      <v-col cols="12" class="text-center">
        <p class="text-grey">No stores found. Add your first Shopify store to get started.</p>
      </v-col>
    </v-row>
    
    <v-row v-else>
      <v-col v-for="store in stores" :key="store.id" cols="12" sm="6" md="4">
        <v-card class="store-card">
          <v-card-item>
            <template v-slot:prepend>
              <v-avatar color="primary" size="40">
                <v-icon>mdi-shopping</v-icon>
              </v-avatar>
            </template>
            
            <v-card-title>{{ store.store_name }}</v-card-title>
            <v-card-subtitle>{{ store.store_url }}</v-card-subtitle>
          </v-card-item>
          
          <v-card-text>
            <div class="d-flex align-center mb-2">
              <v-chip 
                :color="store.status === 'active' ? 'success' : 'error'" 
                variant="tonal"
                size="small"
              >
                <v-icon v-if="store.status === 'inactive'" start size="x-small">mdi-alert-circle</v-icon>
                {{ store.status }}
              </v-chip>
              <v-spacer></v-spacer>
              <v-btn
                icon
                size="small"
                variant="text"
                @click="testConnection(store)"
                :loading="testingConnection[store.id]"
              >
                <v-icon>mdi-connection</v-icon>
                <v-tooltip activator="parent" location="top">Test Connection</v-tooltip>
              </v-btn>
            </div>
            
            <div class="text-caption text-grey">
              Added {{ formatDate(store.created_at) }}
            </div>
          </v-card-text>
          
          <v-card-actions>
            <v-spacer></v-spacer>
            
            <v-tooltip text="Toggle Status" location="top">
              <template v-slot:activator="{ props }">
                <v-btn 
                  icon 
                  variant="text" 
                  size="small" 
                  :color="store.status === 'active' ? 'warning' : 'success'"
                  @click="toggleStatus(store)" 
                  v-bind="props"
                >
                  <v-icon>
                    {{ store.status === 'active' ? 'mdi-pause' : 'mdi-play' }}
                  </v-icon>
                </v-btn>
              </template>
            </v-tooltip>
            
            <v-tooltip text="Edit Store" location="top">
              <template v-slot:activator="{ props }">
                <v-btn 
                  icon 
                  variant="text" 
                  size="small" 
                  color="primary" 
                  @click="openEditModal(store)" 
                  v-bind="props"
                >
                  <v-icon>mdi-pencil</v-icon>
                </v-btn>
              </template>
            </v-tooltip>
            
            <v-tooltip text="Delete Store" location="top">
              <template v-slot:activator="{ props }">
                <v-btn 
                  icon 
                  variant="text" 
                  size="small" 
                  color="error" 
                  @click="confirmDelete(store)" 
                  v-bind="props"
                >
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </template>
            </v-tooltip>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
    
    <!-- Pagination -->
    <div class="d-flex justify-space-between align-center mt-4">
      <div class="text-grey">
        Showing {{ stores.length }} of {{ totalStores }} stores
      </div>
      <v-pagination
        v-model="currentPage"
        :length="totalPages"
        @update:model-value="changePage"
        rounded="circle"
      ></v-pagination>
    </div>
    
    <!-- Create/Edit Store Modal -->
    <v-dialog v-model="showCreateModal" max-width="600px">
      <v-card>
        <v-card-title>
          {{ editingStore ? 'Edit Store' : 'Add Shopify Store' }}
          <v-spacer></v-spacer>
          <v-btn icon variant="text" @click="closeModal">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        
        <v-card-text>
          <v-form ref="storeForm">
            <div class="mb-4">
              <p class="text-subtitle-2 mb-2">Status</p>
              <v-chip-group
                v-model="formData.status"
                mandatory
                selected-class="v-chip--selected"
              >
                <v-chip
                  value="active"
                  color="success"
                  variant="tonal"
                >
                  Active
                </v-chip>
                <v-chip
                  value="inactive"
                  color="error"
                  variant="tonal"
                >
                  <v-icon start size="small">mdi-alert-circle</v-icon>
                  Inactive
                </v-chip>
              </v-chip-group>
            </div>
            
            <v-text-field
              v-model="formData.store_name"
              label="Store Name"
              :rules="[v => !!v || 'Store name is required']"
              variant="outlined"
              class="mb-4"
            ></v-text-field>
            
            <v-text-field
              v-model="formData.store_url"
              label="Store URL"
              :rules="[
                v => !!v || 'Store URL is required',
                v => /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(v) || 'Invalid URL format'
              ]"
              placeholder="example.myshopify.com"
              variant="outlined"
              class="mb-4"
            ></v-text-field>
            
            <v-text-field
              v-model="formData.access_token"
              label="Access Token (Optional)"
              :type="showAccessToken ? 'text' : 'password'"
              variant="outlined"
              class="mb-4"
            >
              <template v-slot:append>
                <v-icon @click="showAccessToken = !showAccessToken" class="mr-1">
                  {{ showAccessToken ? 'mdi-eye' : 'mdi-eye-off' }}
                </v-icon>
                <v-icon 
                  v-if="formData.access_token && editingStore" 
                  @click="copyToClipboard(formData.access_token)"
                >
                  mdi-content-copy
                </v-icon>
              </template>
            </v-text-field>
            
            <v-divider class="mb-4"></v-divider>
            <div class="text-subtitle-2 mb-4">Advanced Settings</div>
            
            <v-text-field
              v-model="formData.api_key"
              label="API Key"
              variant="outlined"
              class="mb-4"
              :append-icon="formData.api_key && editingStore ? 'mdi-content-copy' : ''"
              @click:append="copyToClipboard(formData.api_key)"
            ></v-text-field>
            
            <v-text-field
              v-model="formData.api_secret"
              label="API Secret"
              :type="showApiSecret ? 'text' : 'password'"
              variant="outlined"
              class="mb-4"
            >
              <template v-slot:append>
                <v-icon @click="showApiSecret = !showApiSecret" class="mr-1">
                  {{ showApiSecret ? 'mdi-eye' : 'mdi-eye-off' }}
                </v-icon>
                <v-icon 
                  v-if="formData.api_secret && editingStore" 
                  @click="copyToClipboard(formData.api_secret)"
                >
                  mdi-content-copy
                </v-icon>
              </template>
            </v-text-field>
            
            <v-text-field
              v-model="formData.webhook_secret"
              label="Webhook Secret"
              variant="outlined"
              class="mb-4"
              :append-icon="formData.webhook_secret && editingStore ? 'mdi-content-copy' : ''"
              @click:append="copyToClipboard(formData.webhook_secret)"
            ></v-text-field>
          </v-form>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeModal">Cancel</v-btn>
          <v-btn 
            color="primary" 
            variant="flat"
            @click="saveStore"
            :loading="saving"
          >
            {{ editingStore ? 'Update' : 'Add' }} Store
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="400">
      <v-card>
        <v-card-title>Confirm Delete</v-card-title>
        <v-card-text>
          Are you sure you want to delete "{{ deletingStore?.store_name }}"? This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showDeleteDialog = false">Cancel</v-btn>
          <v-btn 
            color="error" 
            variant="flat"
            @click="deleteStore"
            :loading="deleting"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
    <!-- Connection Test Result Dialog -->
    <v-dialog v-model="showConnectionDialog" max-width="500">
      <v-card>
        <v-card-title>
          <v-icon 
            :color="connectionResult?.connected ? 'success' : 'error'" 
            class="mr-2"
          >
            {{ connectionResult?.connected ? 'mdi-check-circle' : 'mdi-alert-circle' }}
          </v-icon>
          Connection Test Result
        </v-card-title>
        <v-card-text>
          <div v-if="connectionResult?.connected">
            <p class="text-success mb-3">Successfully connected to Shopify!</p>
            <div v-if="connectionResult?.shop">
              <p><strong>Shop Name:</strong> {{ connectionResult.shop.name }}</p>
              <p><strong>Domain:</strong> {{ connectionResult.shop.domain }}</p>
              <p><strong>Email:</strong> {{ connectionResult.shop.email }}</p>
              <p><strong>Plan:</strong> {{ connectionResult.shop.plan_name }}</p>
            </div>
          </div>
          <div v-else>
            <p class="text-error mb-3">Failed to connect to Shopify</p>
            <p v-if="connectionResult?.error">{{ connectionResult.error }}</p>
            <p v-if="connectionResult?.details" class="text-caption">{{ connectionResult.details }}</p>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn 
            variant="text"
            @click="showConnectionDialog = false"
          >
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
    
    <!-- Snackbar for notifications -->
    <v-snackbar
      v-model="showSnackbar"
      :color="snackbarColor"
      :timeout="3000"
      location="top"
    >
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn
          variant="text"
          @click="showSnackbar = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { shopifyApi } from '@/services/api';

// Snackbar state
const showSnackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

// Helper functions for notifications
const showSuccess = (message) => {
  snackbarText.value = message;
  snackbarColor.value = 'success';
  showSnackbar.value = true;
};

const showError = (message) => {
  snackbarText.value = message;
  snackbarColor.value = 'error';
  showSnackbar.value = true;
};

// Data
const stores = ref([]);
const isLoading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const searchQuery = ref('');
const statusFilter = ref('all');
const currentPage = ref(1);
const totalPages = ref(1);
const totalStores = ref(0);
const testingConnection = ref({});

// Dialogs
const showCreateModal = ref(false);
const showDeleteDialog = ref(false);
const showConnectionDialog = ref(false);
const editingStore = ref(null);
const deletingStore = ref(null);
const connectionResult = ref(null);

// Form
const storeForm = ref(null);
const showAccessToken = ref(false);
const showApiSecret = ref(false);
const formData = ref({
  store_name: '',
  store_url: '',
  access_token: '',
  api_key: '',
  api_secret: '',
  webhook_secret: '',
  status: 'active',
  metadata: {}
});

// Methods
const fetchStores = async () => {
  isLoading.value = true;
  try {
    const params = {
      page: currentPage.value,
      search: searchQuery.value,
      status: statusFilter.value
    };
    
    const data = await shopifyApi.listStores(params);
    
    if (data.success) {
      stores.value = data.stores;
      totalPages.value = data.totalPages;
      totalStores.value = data.total;
    }
  } catch (error) {
    showError('Failed to load stores');
  } finally {
    isLoading.value = false;
  }
};

const searchStores = () => {
  currentPage.value = 1;
  fetchStores();
};

const changePage = (page) => {
  currentPage.value = page;
  fetchStores();
};

const openCreateModal = () => {
  editingStore.value = null;
  formData.value = {
    store_name: '',
    store_url: '',
    access_token: '',
    api_key: '',
    api_secret: '',
    webhook_secret: '',
    status: 'active',
    metadata: {}
  };
  showCreateModal.value = true;
};

const openEditModal = async (store) => {
  try {
    // Get both store details and credentials
    const [storeData, credentialsData] = await Promise.all([
      shopifyApi.getStore(store.id),
      shopifyApi.getStoreCredentials(store.id)
    ]);
    
    if (storeData.success && credentialsData.success) {
      editingStore.value = storeData.store;
      formData.value = {
        store_name: storeData.store.store_name,
        store_url: storeData.store.store_url,
        access_token: credentialsData.credentials.access_token || '',
        api_key: credentialsData.credentials.api_key || '',
        api_secret: credentialsData.credentials.api_secret || '',
        webhook_secret: credentialsData.credentials.webhook_secret || '',
        status: storeData.store.status,
        metadata: storeData.store.metadata || {}
      };
      showCreateModal.value = true;
    }
  } catch (error) {
    showError('Failed to load store details');
  }
};

const closeModal = () => {
  showCreateModal.value = false;
  editingStore.value = null;
  storeForm.value?.reset();
};

const saveStore = async () => {
  const { valid } = await storeForm.value.validate();
  if (!valid) return;
  
  saving.value = true;
  try {
    let data;
    if (editingStore.value) {
      data = await shopifyApi.updateStore(editingStore.value.id, formData.value);
    } else {
      data = await shopifyApi.createStore(formData.value);
    }
    
    if (data.success) {
      showSuccess(editingStore.value ? 'Store updated successfully' : 'Store added successfully');
      closeModal();
      fetchStores();
    }
  } catch (error) {
    if (error.message.includes('already exists')) {
      showError('A store with this URL already exists');
    } else {
      showError(editingStore.value ? 'Failed to update store' : 'Failed to add store');
    }
  } finally {
    saving.value = false;
  }
};

const toggleStatus = async (store) => {
  try {
    const data = await shopifyApi.toggleStoreStatus(store.id);
    
    if (data.success) {
      showSuccess(`Store ${data.store.status === 'active' ? 'activated' : 'deactivated'}`);
      fetchStores();
    }
  } catch (error) {
    showError('Failed to toggle store status');
  }
};

const confirmDelete = (store) => {
  deletingStore.value = store;
  showDeleteDialog.value = true;
};

const deleteStore = async () => {
  if (!deletingStore.value) return;
  
  deleting.value = true;
  try {
    const data = await shopifyApi.deleteStore(deletingStore.value.id);
    
    if (data.success) {
      showSuccess('Store deleted successfully');
      showDeleteDialog.value = false;
      fetchStores();
    }
  } catch (error) {
    showError('Failed to delete store');
  } finally {
    deleting.value = false;
    deletingStore.value = null;
  }
};

const testConnection = async (store) => {
  testingConnection.value[store.id] = true;
  try {
    const data = await shopifyApi.testConnection(store.id);
    
    connectionResult.value = data;
    showConnectionDialog.value = true;
  } catch (error) {
    showError('Failed to test connection');
  } finally {
    testingConnection.value[store.id] = false;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

const copyToClipboard = async (text) => {
  if (!text) return;
  
  try {
    await navigator.clipboard.writeText(text);
    showSuccess('Copied to clipboard');
  } catch (error) {
    showError('Failed to copy to clipboard');
  }
};


// Lifecycle
onMounted(() => {
  fetchStores();
});
</script>

<style scoped>
.shopify-stores-container {
}

.store-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>