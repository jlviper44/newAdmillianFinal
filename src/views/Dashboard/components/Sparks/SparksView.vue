<template>
  <v-container fluid class="sparks-container pa-4">
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-6">
          <div>
            <h2 class="text-h5 font-weight-bold">Sparks Management</h2>
            <p class="text-subtitle-2 text-grey-darken-1">Manage your TikTok Spark Ads content</p>
          </div>
          <v-btn 
            color="primary" 
            @click="openCreateModal"
            class="elevation-0"
          >
            <v-icon class="mr-2">mdi-plus</v-icon>
            Create Spark
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
              label="Search sparks"
              append-icon="mdi-magnify"
              hide-details
              @keyup.enter="searchSparks"
              placeholder="Search by name or code..."
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="statusFilter"
              label="Status"
              :items="[
                { title: 'All Status', value: 'all' },
                { title: 'Active', value: 'active' },
                { title: 'Disabled', value: 'disabled' }
              ]"
              hide-details
              @update:model-value="searchSparks"
            ></v-select>
          </v-col>
          <v-col cols="12" md="3">
            <v-btn color="primary" @click="searchSparks" class="ml-2">
              Search
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
    
    <!-- Sparks Grid -->
    <v-row v-if="isLoading">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
        <p class="mt-2">Loading sparks...</p>
      </v-col>
    </v-row>
    
    <v-row v-else-if="sparks.length === 0">
      <v-col cols="12" class="text-center">
        <p class="text-grey">No sparks found. Create your first spark to get started.</p>
      </v-col>
    </v-row>
    
    <v-row v-else>
      <v-col v-for="spark in sparks" :key="spark.id" cols="12" sm="6" md="6" lg="4">
        <v-card :class="{ 'border-error': spark.status === 'disabled' }" class="spark-card">
          <div class="position-relative">
            <v-img :src="spark.thumbnail" height="200" cover>
              <div class="status-badge" v-if="spark.status === 'disabled'">
                <v-chip color="error" size="small">DISABLED</v-chip>
              </div>
            </v-img>
          </div>
          
          <v-card-title>{{ spark.name }}</v-card-title>
          
          <v-card-text>
            <p><strong>Code:</strong> {{ spark.spark_code }}</p>
            <p><strong>Offer:</strong> {{ spark.offer_name }}</p>
            <p class="text-caption text-grey mt-2">
              Created {{ new Date(spark.created_at).toLocaleDateString() }}
            </p>
          </v-card-text>
          
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-tooltip text="Edit Spark" location="top">
              <template v-slot:activator="{ props }">
                <v-btn 
                  icon 
                  variant="text" 
                  size="small" 
                  color="primary" 
                  @click="openEditModal(spark)" 
                  v-bind="props"
                >
                  <v-icon>mdi-pencil</v-icon>
                </v-btn>
              </template>
            </v-tooltip>
            
            <v-tooltip text="View Stats" location="top">
              <template v-slot:activator="{ props }">
                <v-btn 
                  icon 
                  variant="text" 
                  size="small" 
                  color="success" 
                  @click="openStatsModal(spark.id)" 
                  v-bind="props"
                >
                  <v-icon>mdi-chart-bar</v-icon>
                </v-btn>
              </template>
            </v-tooltip>
            
            <v-tooltip text="Delete Spark" location="top">
              <template v-slot:activator="{ props }">
                <v-btn 
                  icon 
                  variant="text" 
                  size="small" 
                  color="error" 
                  @click="openDeleteModal(spark.id)" 
                  v-bind="props"
                >
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </template>
            </v-tooltip>
            
            <v-tooltip 
              :text="spark.status === 'active' ? 'Disable Spark' : 'Enable Spark'" 
              location="top"
            >
              <template v-slot:activator="{ props }">
                <v-btn 
                  v-if="spark.status === 'active'" 
                  icon 
                  variant="text" 
                  size="small" 
                  color="warning" 
                  @click="toggleSparkStatus(spark.id, 'disabled')" 
                  v-bind="props"
                >
                  <v-icon>mdi-close-circle</v-icon>
                </v-btn>
                <v-btn 
                  v-else 
                  icon 
                  variant="text" 
                  size="small" 
                  color="success" 
                  @click="toggleSparkStatus(spark.id, 'active')" 
                  v-bind="props"
                >
                  <v-icon>mdi-check-circle</v-icon>
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
        Showing {{ Math.min(sparks.length, 12) }} of {{ totalSparks }} sparks
      </div>
      <v-pagination
        v-model="currentPage"
        :length="totalPages"
        @update:model-value="changePage"
        rounded="circle"
      ></v-pagination>
    </div>
    
    <!-- Create/Edit Spark Modal -->
    <v-dialog v-model="showCreateModal" max-width="600px">
      <v-card>
        <v-card-title>
          {{ editingSpark ? 'Edit Spark' : 'Create Spark' }}
          <v-spacer></v-spacer>
          <v-btn icon variant="text" @click="showCreateModal = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        
        <v-card-text>
          <v-form @submit.prevent="saveSpark">
            <v-text-field
              v-model="sparkForm.name"
              label="Spark Name"
              required
              class="mb-4"
            ></v-text-field>
            
            <v-text-field
              v-model="sparkForm.tiktokLink"
              label="TikTok Video Link"
              type="url"
              required
              class="mb-4"
              @input="handleTikTokLinkChange"
              hint="Enter a valid TikTok video URL to automatically extract thumbnail"
            ></v-text-field>
            
            <v-text-field
              v-model="sparkForm.sparkCode"
              label="Spark Code"
              required
              class="mb-4"
            ></v-text-field>
            
            <v-select
              v-model="sparkForm.offer"
              label="Offer (Template)"
              :items="offerTemplates"
              item-title="name"
              item-value="id"
              required
              class="mb-4"
            ></v-select>
            
            <!-- Thumbnail Preview -->
            <div v-if="sparkForm.thumbnail" class="mb-4">
              <p class="text-subtitle-2 mb-2">Thumbnail Preview</p>
              <div class="thumbnail-preview-container">
                <v-img
                  :src="sparkForm.thumbnail"
                  height="180"
                  cover
                  class="rounded"
                ></v-img>
                
                <div class="thumbnail-overlay" v-if="isProcessingThumbnail">
                  <v-progress-circular indeterminate color="white"></v-progress-circular>
                </div>
              </div>
            </div>
            
            <div v-else-if="isProcessingThumbnail" class="mb-4 text-center">
              <v-progress-circular indeterminate color="primary"></v-progress-circular>
              <p class="text-caption mt-2">Extracting thumbnail...</p>
            </div>
          </v-form>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showCreateModal = false">Cancel</v-btn>
          <v-btn 
            color="primary" 
            @click="saveSpark" 
            :loading="isProcessingThumbnail"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
    <!-- Stats Modal -->
    <v-dialog v-model="showStatsModal" max-width="900px">
      <v-card>
        <v-card-title>
          <span v-if="currentStats && currentStats.spark && !currentStats.error">
            Spark Stats: {{ currentStats.spark.name || '' }}
          </span>
          <span v-else>Spark Statistics</span>
          <v-spacer></v-spacer>
          <v-btn icon variant="text" @click="showStatsModal = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        
        <v-card-text>
          <!-- Loading state -->
          <div v-if="!currentStats" class="d-flex justify-center align-center" style="min-height: 300px;">
            <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
            <span class="ml-4">Loading statistics...</span>
          </div>
          
          <!-- Error state -->
          <div v-else-if="currentStats.error" class="d-flex flex-column justify-center align-center" style="min-height: 300px;">
            <v-icon color="error" size="64" class="mb-4">mdi-alert-circle</v-icon>
            <p class="text-h6 text-center">{{ currentStats.message || 'Failed to load statistics' }}</p>
            <v-btn color="primary" @click="fetchSparkStats(currentSparkId, statsPeriod)" class="mt-4">
              Try Again
            </v-btn>
          </div>
          
          <!-- Content when data is available -->
          <v-row v-else>
            <v-col cols="12" md="4">
              <v-img
                v-if="currentStats.spark?.thumbnail"
                :src="currentStats.spark.thumbnail"
                height="160"
                cover
                class="rounded mb-4"
              ></v-img>
              
              <v-card variant="outlined" class="mb-4">
                <v-card-text>
                  <p><strong>Name:</strong> {{ currentStats.spark?.name || 'N/A' }}</p>
                  
                  <!-- Improved code display with copy button -->
                  <div class="d-flex align-center">
                    <strong class="mr-1">Code:</strong>
                    <div class="code-display text-truncate">{{ currentStats.spark?.spark_code || 'N/A' }}</div>
                    <v-btn
                      icon
                      variant="text"
                      size="small"
                      color="primary"
                      @click="copySparkCode"
                      title="Copy Code"
                      class="ml-1"
                      :disabled="!currentStats.spark?.spark_code"
                    >
                      <v-icon>mdi-content-copy</v-icon>
                    </v-btn>
                  </div>
                  
                  <p><strong>Offer:</strong> {{ currentStats.spark?.offer_name || 'N/A' }}</p>
                  <v-btn
                    v-if="currentStats.spark?.tiktok_link"
                    :href="currentStats.spark.tiktok_link"
                    target="_blank"
                    variant="text"
                    color="primary"
                    prepend-icon="mdi-share"
                    size="small"
                    class="mt-2"
                  >
                    View on TikTok
                  </v-btn>
                </v-card-text>
              </v-card>
              
              <!-- Traffic metrics summary card -->
              <v-card variant="outlined" class="mb-4" v-if="currentStats.stats">
                <v-card-title class="text-subtitle-1">
                  <v-icon class="mr-2" color="primary">mdi-traffic-light</v-icon>
                  Traffic Summary
                </v-card-title>
                <v-card-text>
                  <div class="d-flex justify-space-between mb-2">
                    <span><strong>Total Traffic:</strong></span>
                    <span>{{ formatNumber(currentStats.stats.totalTraffic || 0) }}</span>
                  </div>
                  <div class="d-flex justify-space-between mb-2">
                    <span><strong>Active Campaigns:</strong></span>
                    <span>{{ currentStats.stats.activeCampaigns || 0 }}</span>
                  </div>
                  <div class="d-flex justify-space-between">
                    <span><strong>Total Campaigns:</strong></span>
                    <span>{{ currentStats.stats.totalCampaigns || 0 }}</span>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            
            <v-col cols="12" md="8">
              <div class="d-flex mb-4">
                <v-btn-group variant="outlined">
                  <v-btn
                    :color="statsPeriod === 7 ? 'primary' : undefined"
                    @click="changeStatsPeriod(7)"
                  >Last 7 Days</v-btn>
                  <v-btn
                    :color="statsPeriod === 30 ? 'primary' : undefined"
                    @click="changeStatsPeriod(30)"
                  >Last 30 Days</v-btn>
                  <v-btn
                    :color="statsPeriod === 90 ? 'primary' : undefined"
                    @click="changeStatsPeriod(90)"
                  >Last 90 Days</v-btn>
                </v-btn-group>
              </div>
              
              <!-- Stats Placeholder -->
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">
                  <v-icon class="mr-2" color="info">mdi-chart-line</v-icon>
                  Performance Metrics
                </v-card-title>
                <v-card-text>
                  <p class="text-grey font-italic">Detailed statistics will be available here once campaigns are associated with this spark.</p>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-dialog>
    
    <!-- Delete Confirmation Modal -->
    <v-dialog v-model="showDeleteModal" max-width="500px">
      <v-card>
        <v-card-title>Delete Spark</v-card-title>
        <v-card-text>
          Are you sure you want to delete this spark? This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showDeleteModal = false">Cancel</v-btn>
          <v-btn 
            color="error" 
            @click="deleteSpark"
          >
            Delete
          </v-btn>
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
import { sparksApi, templatesApi } from '@/services/api';

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

// Reactive state for sparks data
const sparks = ref([]);
const isLoading = ref(true);
const currentPage = ref(1);
const totalPages = ref(1);
const totalSparks = ref(0);
const searchQuery = ref('');
const statusFilter = ref('all');

// Modal state
const showCreateModal = ref(false);
const editingSpark = ref(null);
const showStatsModal = ref(false);
const showDeleteModal = ref(false);
const currentSparkId = ref(null);
const statsPeriod = ref(7);
const currentStats = ref(null);
const isProcessingThumbnail = ref(false);

// Form data
const sparkForm = ref({
  id: '',
  name: '',
  tiktokLink: '',
  sparkCode: '',
  offer: '',
  status: 'active',
  thumbnail: ''
});

// Data for dropdowns
const offerTemplates = ref([]);

// Dialog handling
const alertDialog = ref({
  show: false,
  type: 'error',
  title: '',
  message: ''
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

// Fetch sparks data with pagination and filters
const fetchSparks = async () => {
  isLoading.value = true;
  try {
    const params = {
      page: currentPage.value,
      search: searchQuery.value,
      status: statusFilter.value
    };
    
    const data = await sparksApi.listSparks(params);
    
    if (data.success) {
      sparks.value = data.sparks;
      totalPages.value = data.totalPages;
      totalSparks.value = data.total;
    }
  } catch (error) {
    showError('Failed to load sparks');
  } finally {
    isLoading.value = false;
  }
};

// Search sparks
const searchSparks = () => {
  currentPage.value = 1;
  fetchSparks();
};

// Change page
const changePage = (page) => {
  currentPage.value = page;
  fetchSparks();
};

// Extract TikTok thumbnail from video URL
const extractTikTokThumbnail = async (url) => {
  try {
    isProcessingThumbnail.value = true;
    
    if (!url || !url.includes('tiktok.com')) {
      return null;
    }
    
    const data = await sparksApi.extractTikTokThumbnail(url);
    
    if (data.success && data.thumbnailUrl) {
      sparkForm.value.thumbnail = data.thumbnailUrl;
      return data.thumbnailUrl;
    }
    
    return null;
  } catch (error) {
    return null;
  } finally {
    isProcessingThumbnail.value = false;
  }
};

// Handle TikTok link change
const handleTikTokLinkChange = async () => {
  if (sparkForm.value.tiktokLink && sparkForm.value.tiktokLink.includes('tiktok.com')) {
    await extractTikTokThumbnail(sparkForm.value.tiktokLink);
  }
};

// Open create spark modal
const openCreateModal = () => {
  // Reset form
  sparkForm.value = {
    id: '',
    name: '',
    tiktokLink: '',
    sparkCode: '',
    offer: '',
    status: 'active',
    thumbnail: ''
  };
  
  editingSpark.value = null;
  showCreateModal.value = true;
};

// Open edit spark modal
const openEditModal = async (spark) => {
  try {
    const data = await sparksApi.getSpark(spark.id);
    
    if (data.success) {
      // Set form data
      sparkForm.value = {
        id: data.spark.id,
        name: data.spark.name,
        tiktokLink: data.spark.tiktok_link,
        sparkCode: data.spark.spark_code,
        offer: data.spark.offer,
        status: data.spark.status,
        thumbnail: data.spark.thumbnail || ''
      };
      
      editingSpark.value = data.spark;
      showCreateModal.value = true;
    }
  } catch (error) {
    showError('Failed to load spark details');
  }
};

// Save spark (create or update)
const saveSpark = async () => {
  try {
    // Validate form
    if (!sparkForm.value.name) {
      showAlert('error', 'Spark name is required');
      return;
    }
    
    if (!sparkForm.value.tiktokLink) {
      showAlert('error', 'TikTok video link is required');
      return;
    }
    
    if (!sparkForm.value.sparkCode) {
      showAlert('error', 'Spark code is required');
      return;
    }
    
    if (!sparkForm.value.offer) {
      showAlert('error', 'Offer template is required');
      return;
    }
    
    let data;
    
    if (editingSpark.value) {
      // Update existing spark
      data = await sparksApi.updateSpark(sparkForm.value.id, sparkForm.value);
    } else {
      // Create new spark
      data = await sparksApi.createSpark(sparkForm.value);
    }
    
    if (data.success) {
      showCreateModal.value = false;
      fetchSparks();
      showSuccess(editingSpark.value ? 'Spark updated successfully' : 'Spark created successfully');
    }
  } catch (error) {
    showError(error.message || 'Failed to save spark');
  }
};

// Open delete confirmation modal
const openDeleteModal = (sparkId) => {
  currentSparkId.value = sparkId;
  showDeleteModal.value = true;
};

// Delete spark
const deleteSpark = async () => {
  try {
    const data = await sparksApi.deleteSpark(currentSparkId.value);
    
    if (data.success) {
      showDeleteModal.value = false;
      fetchSparks();
      showSuccess('Spark deleted successfully');
    }
  } catch (error) {
    showError(error.message || 'Failed to delete spark');
  }
};

// Toggle spark status (active/disabled)
const toggleSparkStatus = async (sparkId, status) => {
  try {
    const data = await sparksApi.toggleSparkStatus(sparkId);
    
    if (data.success) {
      fetchSparks();
      showSuccess(`Spark ${data.spark.status === 'active' ? 'enabled' : 'disabled'} successfully`);
    }
  } catch (error) {
    showError(error.message || 'Failed to update spark status');
  }
};

// Open stats modal and fetch stats
const openStatsModal = async (sparkId) => {
  currentSparkId.value = sparkId;
  statsPeriod.value = 7;
  showStatsModal.value = true;
  
  try {
    currentStats.value = null;
    await fetchSparkStats(sparkId, 7);
  } catch (error) {
    currentStats.value = {
      error: true,
      message: 'Failed to load statistics. Please try again later.'
    };
  }
};

// Fetch spark statistics
const fetchSparkStats = async (sparkId, period) => {
  try {
    const data = await sparksApi.getSparkStats(sparkId);
    
    if (data.success) {
      currentStats.value = {
        spark: sparks.value.find(s => s.id === sparkId),
        stats: data.stats || {}
      };
    } else {
      throw new Error(data.error || 'Failed to fetch spark statistics');
    }
  } catch (error) {
    currentStats.value = {
      error: true,
      message: error.message || 'Failed to fetch statistics'
    };
  }
};

// Change stats period
const changeStatsPeriod = (period) => {
  statsPeriod.value = period;
  fetchSparkStats(currentSparkId.value, period);
};

// Copy spark code to clipboard
const copySparkCode = () => {
  if (currentStats.value && currentStats.value.spark && currentStats.value.spark.spark_code) {
    navigator.clipboard.writeText(currentStats.value.spark.spark_code)
      .then(() => {
        showSuccess('Spark code copied to clipboard!');
      })
      .catch(err => {
        showError('Failed to copy spark code');
      });
  }
};

// Format number with commas
const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  return num.toLocaleString();
};

// Fetch offer templates for dropdown
const fetchOfferTemplates = async () => {
  try {
    const data = await templatesApi.getTemplatesList();
    
    if (data.templates && data.templates.length > 0) {
      offerTemplates.value = data.templates;
    } else {
      // Provide fallback templates if API returns empty
      offerTemplates.value = [];
    }
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    // Provide fallback templates if API fails
    offerTemplates.value = [];
  }
};

// Initialize on mount
onMounted(() => {
  fetchSparks();
  fetchOfferTemplates();
});
</script>

<style scoped>
.sparks-container {
}

.spark-card {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.border-error {
  border: 2px solid rgb(var(--v-theme-error));
}

.position-relative {
  position: relative;
}

.status-badge {
  position: absolute;
  top: 8px;
  right: 8px;
}

.thumbnail-preview-container {
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

.thumbnail-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.code-display {
  font-family: monospace;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
  max-width: 200px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>