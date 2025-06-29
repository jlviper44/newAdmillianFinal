<template>
  <v-container fluid class="templates-container pa-4">
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-6">
          <div>
            <h2 class="text-h5 font-weight-bold">Templates Management</h2>
            <p class="text-subtitle-2 text-grey-darken-1">Manage your HTML templates for campaigns</p>
          </div>
          <v-btn 
            color="primary" 
            @click="openCreateModal"
            class="elevation-0"
          >
            <v-icon class="mr-2">mdi-plus</v-icon>
            Create Template
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
              label="Search templates"
              append-icon="mdi-magnify"
              hide-details
              @keyup.enter="searchTemplates"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="categoryFilter"
              label="Category"
              :items="[
                { title: 'All Categories', value: 'all' },
                ...categories
              ]"
              hide-details
              @update:model-value="searchTemplates"
            ></v-select>
          </v-col>
          <v-col cols="12" md="3">
            <v-btn color="primary" @click="searchTemplates" class="ml-2">
              Search
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
    
    <!-- Templates Grid -->
    <v-row v-if="isLoading">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
        <p class="mt-2">Loading templates...</p>
      </v-col>
    </v-row>
    
    <v-row v-else-if="templates.length === 0">
      <v-col cols="12" class="text-center">
        <p class="text-grey">No templates found. Create your first template to get started.</p>
      </v-col>
    </v-row>
    
    <v-row v-else>
      <v-col v-for="template in templates" :key="template.id" cols="12" sm="6" md="4">
        <v-card class="template-card">
          <v-card-item>
            <div class="d-flex justify-space-between align-center">
              <v-card-title>{{ template.name }}</v-card-title>
              <v-chip color="primary" size="small">{{ template.category || 'General' }}</v-chip>
            </div>
            
            <v-card-subtitle v-if="template.description">
              {{ template.description }}
            </v-card-subtitle>
            <v-card-subtitle v-else class="text-grey font-italic">
              No description
            </v-card-subtitle>
            
            <div class="text-caption text-grey mt-2">
              <div>Created: {{ formatDate(template.created_at) }}</div>
              <div>Version: {{ template.version || 1 }}</div>
            </div>
          </v-card-item>
          
          <v-card-actions>
            <v-btn variant="text" color="primary" @click="previewTemplate(template)">
              <v-icon size="small" class="mr-1">mdi-eye</v-icon> Preview
            </v-btn>
            <v-spacer></v-spacer>
            
            <v-tooltip text="Duplicate Template" location="top">
              <template v-slot:activator="{ props }">
                <v-btn 
                  icon 
                  variant="text" 
                  color="success" 
                  @click="duplicateTemplate(template.id)" 
                  v-bind="props"
                >
                  <v-icon>mdi-content-copy</v-icon>
                </v-btn>
              </template>
            </v-tooltip>
            
            <v-tooltip text="Edit Template" location="top">
              <template v-slot:activator="{ props }">
                <v-btn 
                  icon 
                  variant="text" 
                  color="primary" 
                  @click="openEditModal(template)" 
                  v-bind="props"
                >
                  <v-icon>mdi-pencil</v-icon>
                </v-btn>
              </template>
            </v-tooltip>
            
            <v-tooltip text="Delete Template" location="top">
              <template v-slot:activator="{ props }">
                <v-btn 
                  icon 
                  variant="text" 
                  color="error" 
                  @click="deleteTemplate(template.id)" 
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
        Showing {{ templates.length }} of {{ totalTemplates }} templates
      </div>
      <v-pagination
        v-model="currentPage"
        :length="totalPages"
        @update:model-value="changePage"
        rounded="circle"
      ></v-pagination>
    </div>
    
    <!-- Create/Edit Template Modal -->
    <v-dialog v-model="showCreateModal" max-width="900px">
      <v-card>
        <v-card-title>
          {{ editingTemplate ? 'Edit Template' : 'Create Template' }}
          <v-spacer></v-spacer>
          <v-btn icon variant="text" @click="showCreateModal = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        
        <v-card-text>
          <v-form @submit.prevent="saveTemplate">
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="templateForm.name"
                  label="Template Name"
                  required
                ></v-text-field>
              </v-col>
              
              <v-col cols="12" md="6">
                <v-select
                  v-model="templateForm.category"
                  label="Category"
                  :items="categories"
                  item-title="title"
                  item-value="value"
                  required
                ></v-select>
              </v-col>
              
              <v-col cols="12">
                <v-text-field
                  v-model="templateForm.description"
                  label="Description (optional)"
                ></v-text-field>
              </v-col>
              
              <v-col cols="12">
                <v-textarea
                  v-model="templateForm.html"
                  label="HTML Content"
                  rows="15"
                  auto-grow
                  required
                  hint="Enter your HTML template code here"
                ></v-textarea>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
        
        <v-card-actions>
          <v-btn 
            variant="text"
            color="primary"
            @click="previewTemplate()"
          >
            <v-icon class="mr-1">mdi-eye</v-icon>
            Preview
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showCreateModal = false">Cancel</v-btn>
          <v-btn 
            color="primary" 
            @click="saveTemplate"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
    <!-- Preview Modal -->
    <v-dialog v-model="showPreviewModal" max-width="900px">
      <v-card>
        <v-card-title>
          Template Preview
          <v-spacer></v-spacer>
          <v-btn icon variant="text" @click="showPreviewModal = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        
        <v-card-text>
          <iframe
            :srcdoc="previewIframeContent"
            style="width: 100%; height: 500px; border: 1px solid #ccc;"
          ></iframe>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showPreviewModal = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
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
        <v-card-title>{{ confirmDialog.title }}</v-card-title>
        <v-card-text>{{ confirmDialog.message }}</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="confirmDialog.show = false">
            {{ confirmDialog.cancelText }}
          </v-btn>
          <v-btn color="primary" variant="flat" @click="handleConfirm">
            {{ confirmDialog.confirmText }}
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
import { ref, onMounted } from 'vue';
import { templatesApi } from '@/services/api';

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

// Reactive state for templates data
const templates = ref([]);
const isLoading = ref(true);
const currentPage = ref(1);
const totalPages = ref(1);
const totalTemplates = ref(0);
const searchQuery = ref('');
const categoryFilter = ref('all');

// Modal state
const showCreateModal = ref(false);
const showPreviewModal = ref(false);
const editingTemplate = ref(null);
const previewIframeContent = ref('');

// Form data
const templateForm = ref({
  id: '',
  name: '',
  category: 'general',
  description: '',
  html: ''
});

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
  onConfirm: null
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
    onConfirm: onConfirm
  };
};

// Handle confirm dialog response
const handleConfirm = () => {
  if (confirmDialog.value.onConfirm) {
    confirmDialog.value.onConfirm();
  }
  confirmDialog.value.show = false;
};

// Categories for dropdown
const categories = [
  { value: 'general', title: 'General' },
  { value: 'offers', title: 'Offers' },
  { value: 'products', title: 'Products' },
  { value: 'landing', title: 'Landing Pages' },
  { value: 'sales', title: 'Sales Pages' },
  { value: 'optin', title: 'Opt-in Pages' }
];

// Fetch templates data with pagination and filters
const fetchTemplates = async () => {
  isLoading.value = true;
  try {
    const params = {
      page: currentPage.value,
      search: searchQuery.value,
      category: categoryFilter.value
    };
    
    const data = await templatesApi.listTemplates(params);
    
    templates.value = data.templates || [];
    totalPages.value = data.totalPages || 1;
    totalTemplates.value = data.total || 0;
    currentPage.value = data.page || 1;
  } catch (error) {
    showError('Failed to load templates');
  } finally {
    isLoading.value = false;
  }
};

// Search templates
const searchTemplates = () => {
  currentPage.value = 1;
  fetchTemplates();
};

// Change page
const changePage = (page) => {
  currentPage.value = page;
  fetchTemplates();
};

// Open create template modal
const openCreateModal = () => {
  // Reset form
  templateForm.value = {
    id: '',
    name: '',
    category: 'general',
    description: '',
    html: ''
  };
  
  editingTemplate.value = null;
  showCreateModal.value = true;
};

// Open edit template modal
const openEditModal = async (template) => {
  try {
    const data = await templatesApi.getTemplate(template.id);
    
    // Set form data
    templateForm.value = {
      id: data.id,
      name: data.name,
      category: data.category || 'general',
      description: data.description || '',
      html: data.html || ''
    };
    
    editingTemplate.value = data;
    showCreateModal.value = true;
  } catch (error) {
    showError('Failed to load template details');
  }
};

// Save template (create or update)
const saveTemplate = async () => {
  try {
    // Validate form
    if (!templateForm.value.name) {
      showAlert('error', 'Template name is required');
      return;
    }
    
    if (!templateForm.value.html) {
      showAlert('error', 'HTML content is required');
      return;
    }
    
    let data;
    
    if (editingTemplate.value) {
      // Update existing template
      data = await templatesApi.updateTemplate(templateForm.value.id, templateForm.value);
    } else {
      // Create new template
      data = await templatesApi.createTemplate(templateForm.value);
    }
    
    showCreateModal.value = false;
    fetchTemplates();
    showSuccess(editingTemplate.value ? 'Template updated successfully' : 'Template created successfully');
  } catch (error) {
    showError(error.message || 'Failed to save template');
  }
};

// Delete template
const deleteTemplate = async (templateId) => {
  showConfirm(
    'Delete Template',
    'Are you sure you want to delete this template? This action cannot be undone.',
    async () => {
      try {
        const data = await templatesApi.deleteTemplate(templateId);
        
        if (data.success) {
          fetchTemplates();
          showSuccess('Template deleted successfully');
        }
      } catch (error) {
        showError(error.message || 'Failed to delete template');
      }
    },
    'Delete',
    'Cancel'
  );
};

// Duplicate template
const duplicateTemplate = async (templateId) => {
  try {
    const data = await templatesApi.duplicateTemplate(templateId);
    
    if (data.success) {
      fetchTemplates();
      showSuccess('Template duplicated successfully');
    }
  } catch (error) {
    showError(error.message || 'Failed to duplicate template');
  }
};

// Preview template
const previewTemplate = (template = null) => {
  try {
    // If template is provided, use its HTML content
    // Otherwise, use the current editor content
    let htmlContent = '';
    
    if (template) {
      htmlContent = template.html;
    } else {
      htmlContent = templateForm.value.html;
    }
    
    if (!htmlContent) {
      showAlert('error', 'No HTML content to preview');
      return;
    }
    
    previewIframeContent.value = htmlContent;
    showPreviewModal.value = true;
  } catch (error) {
    showAlert('error', error.message || 'Failed to preview template');
  }
};

// Format date
const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

// Initialize on mount
onMounted(() => {
  fetchTemplates();
});
</script>

<style scoped>
.templates-container {
}

.template-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>