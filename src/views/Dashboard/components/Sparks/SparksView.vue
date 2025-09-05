<template>
  <v-container fluid class="sparks-container">
    <!-- Header with Title and Export -->
    <v-card class="mb-4" elevation="0">
      <v-card-title class="d-flex justify-space-between align-center">
        <h2 class="text-h4">Spark Campaign Tracker</h2>
        <v-btn
          variant="tonal"
          color="primary"
          @click="exportToCSV"
          prepend-icon="mdi-download"
        >
          Export CSV
        </v-btn>
      </v-card-title>
    </v-card>

    <!-- Tab Navigation -->
    <v-tabs v-model="activeTab" class="mb-4">
      <v-tab value="sparks">Sparks</v-tab>
      <v-tab value="payments">Payments</v-tab>
    </v-tabs>

    <!-- Sparks Tab Content -->
    <v-window v-model="activeTab">
      <v-window-item value="sparks">
        <!-- Search and Filters Bar -->
        <v-card class="mb-4">
          <v-card-text>
            <v-row align="center">
              <v-col cols="12" md="3">
                <v-text-field
                  v-model="searchQuery"
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
                  v-model="typeFilter"
                  :items="typeOptions"
                  label="Type"
                  variant="outlined"
                  density="compact"
                  hide-details
                />
              </v-col>

              <v-col cols="12" md="2">
                <v-select
                  v-model="statusFilter"
                  :items="statusOptions"
                  label="Status"
                  variant="outlined"
                  density="compact"
                  hide-details
                />
              </v-col>

              <v-col cols="12" md="2">
                <v-select
                  v-model="creatorFilter"
                  :items="creatorOptions"
                  label="Creator"
                  variant="outlined"
                  density="compact"
                  hide-details
                />
              </v-col>

              <v-col cols="auto">
                <v-checkbox
                  v-model="activeOnly"
                  label="Active Only"
                  hide-details
                  density="compact"
                />
              </v-col>

              <v-col cols="auto" class="ml-auto">
                <v-btn
                  color="primary"
                  variant="elevated"
                  class="mr-2"
                  @click="openCreateModal"
                  prepend-icon="mdi-plus"
                >
                  Add Spark
                </v-btn>
                <v-btn
                  color="secondary"
                  variant="elevated"
                  class="mr-2"
                  @click="bulkAdd"
                  prepend-icon="mdi-plus-box-multiple"
                >
                  Bulk Add
                </v-btn>
                <v-btn
                  variant="text"
                  @click="clearFilters"
                  prepend-icon="mdi-filter-remove"
                >
                  Clear Filters
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Data Table -->
        <v-card>
          <v-data-table
            :headers="headers"
            :items="filteredSparks"
            :items-per-page="itemsPerPage"
            :loading="isLoading"
            :search="searchQuery"
            class="sparks-table"
            hover
          >
            <!-- Thumbnail Column -->
            <template v-slot:item.thumbnail="{ item }">
              <div class="thumbnail-container my-2">
                <v-img
                  :src="item.thumbnail || defaultThumbnail"
                  :alt="item.name"
                  width="100"
                  height="100"
                  cover
                  class="rounded cursor-pointer"
                  @click="showLargePreview(item)"
                  @error="handleImageError"
                />
              </div>
            </template>

            <!-- Name Column -->
            <template v-slot:item.name="{ item }">
              <span class="font-weight-medium">{{ item.name }}</span>
            </template>

            <!-- Type Column -->
            <template v-slot:item.type="{ item }">
              <v-chip
                size="small"
                :color="item.type === 'manual' ? 'purple' : 'indigo'"
                variant="flat"
              >
                {{ item.type || 'Auto' }}
              </v-chip>
            </template>

            <!-- Status Column -->
            <template v-slot:item.status="{ item }">
              <v-chip
                size="small"
                :color="getStatusColor(item.status)"
                variant="flat"
              >
                {{ getStatusLabel(item.status) }}
              </v-chip>
            </template>

            <!-- TikTok Link Column -->
            <template v-slot:item.tiktok_link="{ item }">
              <v-btn
                icon
                variant="text"
                size="small"
                :href="item.tiktok_link"
                target="_blank"
                @click.stop
              >
                <v-icon>mdi-open-in-new</v-icon>
              </v-btn>
            </template>

            <!-- Spark Code Column -->
            <template v-slot:item.spark_code="{ item }">
              <div class="d-flex align-center">
                <code class="mr-2">{{ item.spark_code }}</code>
                <v-btn
                  icon
                  variant="text"
                  size="x-small"
                  @click.stop="copyCode(item.spark_code)"
                >
                  <v-icon size="small">mdi-content-copy</v-icon>
                </v-btn>
              </div>
            </template>

            <!-- Created Date Column -->
            <template v-slot:item.created_at="{ item }">
              {{ formatDate(item.created_at) }}
            </template>

            <!-- Actions Column -->
            <template v-slot:item.actions="{ item }">
              <v-btn
                icon
                variant="text"
                size="small"
                color="primary"
                @click.stop="editSpark(item)"
              >
                <v-icon>mdi-pencil</v-icon>
              </v-btn>
              <v-btn
                icon
                variant="text"
                size="small"
                color="error"
                @click.stop="deleteSpark(item)"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-window-item>

      <!-- Payments Tab Content -->
      <v-window-item value="payments">
        <!-- Summary Cards -->
        <v-row class="mb-4">
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <h3 class="text-h4 text-primary mb-2">$0.00</h3>
                <p class="text-body-2 text-grey">Total Owed</p>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <h3 class="text-h4 text-success mb-2">$0.00</h3>
                <p class="text-body-2 text-grey">Total Paid</p>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <h3 class="text-h4 text-warning mb-2">{{ unpaidSparks }}</h3>
                <p class="text-body-2 text-grey">Unpaid Sparks</p>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <h3 class="text-h4 text-info mb-2">{{ activeCreators }}</h3>
                <p class="text-body-2 text-grey">Active Creators</p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Payment Settings -->
        <v-card class="mb-4">
          <v-card-title>Payment Settings</v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="defaultRate"
                  label="Default Rate per Video"
                  prefix="$"
                  type="number"
                  variant="outlined"
                  density="compact"
                />
              </v-col>
            </v-row>

            <h4 class="text-h6 mb-3">Creator Custom Rates</h4>
            <v-row>
              <v-col
                v-for="creator in creators"
                :key="creator.id"
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="creator.rate"
                  :label="creator.name"
                  prefix="$"
                  type="number"
                  variant="outlined"
                  density="compact"
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Payments List -->
        <v-card>
          <v-card-title>Payment Summary</v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item
                v-for="payment in payments"
                :key="payment.id"
                class="mb-2"
              >
                <template v-slot:prepend>
                  <v-avatar color="primary">
                    <span>{{ payment.creator.charAt(0) }}</span>
                  </v-avatar>
                </template>

                <v-list-item-title>{{ payment.creator }}</v-list-item-title>
                <v-list-item-subtitle>
                  Rate: ${{ payment.rate }}/video • Unpaid: {{ payment.unpaid }}
                </v-list-item-subtitle>

                <template v-slot:append>
                  <div class="text-right">
                    <div class="text-h6 text-primary">${{ payment.total }}</div>
                    <v-btn
                      color="success"
                      variant="tonal"
                      size="small"
                      @click="markPaid(payment.id)"
                    >
                      Mark All Paid
                    </v-btn>
                  </div>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-window-item>
    </v-window>

    <!-- Preview Modal -->
    <v-dialog v-model="showPreview" max-width="600">
      <v-card>
        <v-card-title>
          {{ previewSpark?.name }}
          <v-spacer />
          <v-btn icon variant="text" @click="showPreview = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-img
            :src="previewSpark?.thumbnail"
            :alt="previewSpark?.name"
            max-height="400"
            contain
          />
          <div class="mt-4">
            <p><strong>Spark Code:</strong> {{ previewSpark?.spark_code }}</p>
            <p><strong>Status:</strong> {{ previewSpark?.status }}</p>
            <v-btn
              :href="previewSpark?.tiktok_link"
              target="_blank"
              color="primary"
              variant="tonal"
              class="mt-2"
            >
              View on TikTok
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Create/Edit Modal -->
    <v-dialog v-model="showCreateModal" max-width="700">
      <v-card>
        <v-card-title>
          {{ editingSparkData ? 'Edit Spark' : 'Create Spark' }}
          <v-spacer />
          <v-btn icon variant="text" @click="showCreateModal = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-form ref="sparkFormRef">
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="sparkForm.name"
                  label="Spark Name"
                  required
                  variant="outlined"
                  density="compact"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="sparkForm.creator"
                  label="Creator (VA)"
                  :items="virtualAssistants"
                  variant="outlined"
                  density="compact"
                  hint="Select the virtual assistant who created this spark"
                  :rules="[v => v !== undefined || 'Please select a creator']"
                  required
                />
              </v-col>
            </v-row>
            
            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="sparkForm.tiktokLink"
                  label="TikTok Video Link"
                  type="url"
                  required
                  variant="outlined"
                  density="compact"
                  hint="Full TikTok video URL"
                />
              </v-col>
            </v-row>
            
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="sparkForm.sparkCode"
                  label="Spark Code"
                  required
                  variant="outlined"
                  density="compact"
                  hint="Unique identifier code"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="sparkForm.type"
                  label="Type"
                  :items="[
                    { title: 'Auto', value: 'auto' },
                    { title: 'Manual', value: 'manual' }
                  ]"
                  variant="outlined"
                  density="compact"
                />
              </v-col>
            </v-row>
            
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="sparkForm.status"
                  label="Status"
                  :items="[
                    { title: 'Active', value: 'active' },
                    { title: 'Completed', value: 'completed' },
                    { title: 'Disabled', value: 'disabled' }
                  ]"
                  variant="outlined"
                  density="compact"
                />
              </v-col>
            </v-row>
            
            <!-- Thumbnail Preview (Read-only) -->
            <v-row v-if="editingSparkData?.thumbnail">
              <v-col cols="12">
                <p class="text-caption mb-2">Current Thumbnail:</p>
                <v-img
                  :src="editingSparkData.thumbnail"
                  max-height="150"
                  max-width="150"
                  class="rounded"
                />
                <p class="text-caption mt-1 text-grey">Thumbnail is auto-generated from TikTok link</p>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showCreateModal = false">Cancel</v-btn>
          <v-btn color="primary" variant="elevated" @click="saveSpark">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Bulk Add Modal -->
    <v-dialog v-model="showBulkAddModal" max-width="900">
      <v-card>
        <v-card-title>
          Bulk Add Sparks
          <v-spacer />
          <v-btn icon variant="text" @click="showBulkAddModal = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-form ref="bulkAddFormRef">
            <!-- Base Name Field -->
            <v-text-field
              v-model="bulkAddForm.baseName"
              label="Base Name (e.g., Max-0901)"
              variant="outlined"
              density="compact"
              hint="This will be used as the name prefix for all sparks"
              class="mb-4"
            />
            
            <v-row>
              <!-- Type and Creator Selection -->
              <v-col cols="12" md="6">
                <v-select
                  v-model="bulkAddForm.type"
                  label="Type"
                  :items="[
                    { title: 'Auto', value: 'auto' },
                    { title: 'Manual', value: 'manual' }
                  ]"
                  variant="outlined"
                  density="compact"
                  class="mb-4"
                />
              </v-col>
              
              <v-col cols="12" md="6">
                <v-select
                  v-model="bulkAddForm.creator"
                  label="Creator (VA)"
                  :items="virtualAssistants"
                  variant="outlined"
                  density="compact"
                  class="mb-4"
                />
              </v-col>
            </v-row>
            
            <v-row>
              <!-- Status Selection -->
              <v-col cols="12" md="6">
                <v-select
                  v-model="bulkAddForm.status"
                  label="Status"
                  :items="[
                    { title: 'Active', value: 'active' },
                    { title: 'Completed', value: 'completed' },
                    { title: 'Disabled', value: 'disabled' }
                  ]"
                  variant="outlined"
                  density="compact"
                  class="mb-4"
                />
              </v-col>
            </v-row>
            
            <v-row>
              <!-- TikTok Links Textarea (LEFT) -->
              <v-col cols="12" md="6">
                <v-textarea
                  v-model="bulkAddForm.tiktokLinks"
                  label="TikTok Links (one per line)"
                  variant="outlined"
                  density="compact"
                  rows="8"
                  hint="Enter one TikTok link per line"
                  placeholder="https://www.tiktok.com/@user/video/123&#10;https://www.tiktok.com/@user/video/456"
                  @input="onTikTokLinksChange"
                />
              </v-col>
              
              <!-- Spark Codes Textarea (RIGHT) -->
              <v-col cols="12" md="6">
                <v-textarea
                  v-model="bulkAddForm.sparkCodes"
                  label="Spark Codes (one per line)"
                  variant="outlined"
                  density="compact"
                  rows="8"
                  hint="Enter one spark code per line"
                  placeholder="SC001&#10;SC002&#10;SC003"
                />
              </v-col>
            </v-row>
            
            <!-- Preview Section -->
            <v-card 
              v-if="bulkAddPreview.length > 0"
              class="mt-4"
              variant="tonal"
              color="info"
            >
              <v-card-title class="text-h6">
                Preview: {{ bulkAddPreview.length }} spark(s) will be created
              </v-card-title>
              <v-card-text>
                <v-list density="compact" class="preview-list">
                  <v-list-item
                    v-for="(item, index) in bulkAddPreview.slice(0, 10)"
                    :key="index"
                    class="px-0"
                  >
                    <template v-slot:prepend>
                      <span class="text-caption text-grey mr-3">{{ index + 1 }}.</span>
                    </template>
                    <v-list-item-title class="text-body-1">
                      <strong>{{ item.name }}</strong>
                    </v-list-item-title>
                    <v-list-item-subtitle>
                      <v-chip size="x-small" variant="flat" class="mr-2">{{ item.sparkCode }}</v-chip>
                      <span class="text-caption">{{ item.tiktokLink.substring(0, 50) }}{{ item.tiktokLink.length > 50 ? '...' : '' }}</span>
                    </v-list-item-subtitle>
                  </v-list-item>
                  <v-list-item v-if="bulkAddPreview.length > 10" class="text-center">
                    <v-list-item-title class="text-caption text-grey">
                      ... and {{ bulkAddPreview.length - 10 }} more
                    </v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-card-text>
            </v-card>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="outlined" @click="previewBulkAdd">Preview</v-btn>
          <v-btn 
            color="primary" 
            variant="elevated" 
            @click="saveBulkAdd"
            :disabled="bulkAddPreview.length === 0 || bulkAddLoading"
            :loading="bulkAddLoading"
          >
            Save All
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Modal -->
    <v-dialog v-model="showDeleteModal" max-width="500">
      <v-card>
        <v-card-title class="text-h6">
          <v-icon color="error" class="mr-2">mdi-alert-circle</v-icon>
          Confirm Delete
        </v-card-title>
        <v-card-text>
          <p class="text-body-1 mb-3">
            Are you sure you want to delete this spark?
          </p>
          <div v-if="sparkToDelete" class="pa-3 bg-grey-lighten-4 rounded">
            <p class="font-weight-bold mb-1">{{ sparkToDelete.name }}</p>
            <p class="text-caption text-grey mb-0">
              <v-icon size="small" class="mr-1">mdi-code-tags</v-icon>
              {{ sparkToDelete.spark_code }}
            </p>
            <p class="text-caption text-grey">
              <v-icon size="small" class="mr-1">mdi-account</v-icon>
              {{ sparkToDelete.creator || 'None' }}
            </p>
          </div>
          <v-alert 
            type="warning" 
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            This action cannot be undone.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn 
            variant="text" 
            @click="cancelDelete"
          >
            Cancel
          </v-btn>
          <v-btn 
            color="error" 
            variant="elevated"
            @click="confirmDelete"
            :loading="deleteLoading"
          >
            Delete Spark
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="showSnackbar" :color="snackbarColor" :timeout="3000">
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn variant="text" @click="showSnackbar = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { sparksApi, templatesApi, usersApi } from '@/services/api';

// Tab state
const activeTab = ref('sparks');

// Data state
const sparks = ref([]);
const isLoading = ref(false);
const offerTemplates = ref([]);
const creators = ref([]);
const payments = ref([]);
const virtualAssistants = ref([]);

// Filter state
const searchQuery = ref('');
const typeFilter = ref('all');
const statusFilter = ref('all');
const creatorFilter = ref('all');
const activeOnly = ref(false);

// Table configuration
const itemsPerPage = ref(10);

// Modal state
const showPreview = ref(false);
const previewSpark = ref(null);
const showCreateModal = ref(false);
const editingSparkData = ref(null);
const showBulkAddModal = ref(false);
const showDeleteModal = ref(false);
const sparkToDelete = ref(null);
const deleteLoading = ref(false);

// Form state
const sparkForm = ref({
  name: '',
  creator: undefined,  // No default, user must select
  tiktokLink: '',
  sparkCode: '',
  type: 'auto',
  status: 'active'
});

// Bulk Add Form state
const bulkAddForm = ref({
  baseName: '',
  type: 'auto',
  creator: undefined,
  status: 'active',
  sparkCodes: '',
  tiktokLinks: ''
});

const bulkAddPreview = ref([]);
const bulkAddLoading = ref(false);

// Payment state
const defaultRate = ref(1);
const unpaidSparks = ref(0);
const activeCreators = ref(0);

// Snackbar
const showSnackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

// Table headers
const headers = ref([
  { title: 'Date', key: 'created_at' },
  { title: 'Preview', key: 'thumbnail', sortable: false, width: '120px' },
  { title: 'TikTok Link', key: 'tiktok_link', sortable: false },
  { title: 'Spark Code', key: 'spark_code' },
  { title: 'Status', key: 'status' },
  { title: 'Type', key: 'type' },
  { title: 'Creator', key: 'creator' },
  { title: 'Name', key: 'name' },
  { title: 'Actions', key: 'actions', sortable: false }
]);

// Options for filters
const typeOptions = ref([
  { title: 'All Types', value: 'all' },
  { title: 'Auto', value: 'auto' },
  { title: 'Manual', value: 'manual' }
]);

const statusOptions = ref([
  { title: 'All Status', value: 'all' },
  { title: 'Active', value: 'active' },
  { title: 'Completed', value: 'completed' },
  { title: 'Disabled', value: 'disabled' }
]);

const creatorOptions = ref([
  { title: 'All Creators', value: 'all' }
]);

// Default thumbnail
const defaultThumbnail = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjRTBFMEUwIi8+CjxwYXRoIGQ9Ik0yNSAxOEwyOSAyNUwyNSAzMkwyMSAyNVoiIGZpbGw9IiM5RTlFOUUiLz4KPC9zdmc+';

// Computed properties
const filteredSparks = computed(() => {
  let filtered = [...sparks.value];

  // Type filter
  if (typeFilter.value !== 'all') {
    filtered = filtered.filter(spark => spark.type === typeFilter.value);
  }

  // Status filter
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(spark => spark.status === statusFilter.value);
  }

  // Creator filter
  if (creatorFilter.value !== 'all') {
    filtered = filtered.filter(spark => spark.creator === creatorFilter.value);
  }

  // Active only filter
  if (activeOnly.value) {
    filtered = filtered.filter(spark => spark.status === 'active');
  }

  return filtered;
});

// Methods
const fetchSparks = async () => {
  isLoading.value = true;
  try {
    const response = await sparksApi.listSparks({ page: 1, limit: 1000 });
    if (response.success) {
      sparks.value = response.sparks.map(spark => ({
        ...spark,
        type: spark.type || 'auto',
        creator: spark.creator || 'None'  // Show "None" instead of "Unknown"
      }));
      
      // Use virtual assistants for creator options if available
      const uniqueCreators = [...new Set(sparks.value.map(s => s.creator).filter(c => c))];
      
      if (virtualAssistants.value.length > 1) {  // More than just "None"
        creatorOptions.value = [
          { title: 'All Creators', value: 'all' },
          ...virtualAssistants.value.filter(va => va.value !== '')  // Exclude "None"
        ];
        
        // Use VAs for payments
        creators.value = virtualAssistants.value
          .filter(va => va.value !== '')
          .map(va => ({
            id: va.value,
            name: va.title,
            rate: defaultRate.value
          }));
      } else {
        // Fallback to extracting from existing data
        creatorOptions.value = [
          { title: 'All Creators', value: 'all' },
          ...uniqueCreators.map(c => ({ title: c || 'Unknown', value: c }))
        ];
        
        creators.value = uniqueCreators.map(name => ({
          id: name,
          name: name,
          rate: defaultRate.value
        }));
      }
      
      // Update stats
      unpaidSparks.value = sparks.value.filter(s => s.status === 'active').length;
      activeCreators.value = uniqueCreators.length;
    }
  } catch (error) {
    showError('Failed to load sparks');
  } finally {
    isLoading.value = false;
  }
};

const fetchOfferTemplates = async () => {
  try {
    const data = await templatesApi.getTemplatesList();
    offerTemplates.value = data.templates || [];
  } catch (error) {
    offerTemplates.value = [];
  }
};

const fetchVirtualAssistants = async () => {
  try {
    const response = await usersApi.getVirtualAssistants();
    console.log('Virtual assistants response:', response); // Debug log
    
    // The API returns { assistants: [...] }
    if (response && response.assistants && Array.isArray(response.assistants)) {
      virtualAssistants.value = response.assistants
        .filter(va => va.status === 'active') // Only show active VAs
        .map(va => ({
          title: va.email || 'Unknown VA',
          value: va.email || 'Unknown'
        }));
      
      console.log('Processed VAs:', virtualAssistants.value); // Debug log
      
      // Add a "None" option at the beginning
      virtualAssistants.value.unshift({ title: 'None', value: '' });
    } else {
      console.log('No virtual assistants found in response, response structure:', response);
      virtualAssistants.value = [{ title: 'None', value: '' }];
    }
    
    console.log('Final virtualAssistants.value:', virtualAssistants.value); // Debug log
  } catch (error) {
    console.error('Failed to fetch virtual assistants:', error);
    virtualAssistants.value = [{ title: 'None', value: '' }];
  }
};

const clearFilters = () => {
  searchQuery.value = '';
  typeFilter.value = 'all';
  statusFilter.value = 'all';
  creatorFilter.value = 'all';
  activeOnly.value = false;
};

const getStatusColor = (status) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'completed':
      return 'blue';
    case 'disabled':
      return 'grey';
    default:
      return 'grey';
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'active':
      return 'Active';
    case 'completed':
      return 'Completed';
    case 'disabled':
      return 'Disabled';
    default:
      return status;
  }
};

const copyCode = (code) => {
  navigator.clipboard.writeText(code);
  showSuccess('Spark code copied to clipboard');
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
};

const handleImageError = (event) => {
  event.target.src = defaultThumbnail;
};

const showLargePreview = (spark) => {
  previewSpark.value = spark;
  showPreview.value = true;
};

const openCreateModal = () => {
  editingSparkData.value = null;
  sparkForm.value = {
    name: '',
    creator: undefined,  // No default, user must select
    tiktokLink: '',
    sparkCode: '',
    type: 'auto',
    status: 'active'
  };
  showCreateModal.value = true;
};

const editSpark = (spark) => {
  editingSparkData.value = spark;
  sparkForm.value = {
    name: spark.name || '',
    creator: spark.creator || '',
    tiktokLink: spark.tiktok_link || '',
    sparkCode: spark.spark_code || '',
    type: spark.type || 'auto',
    status: spark.status || 'active'
  };
  showCreateModal.value = true;
};

const saveSpark = async () => {
  try {
    // Validate required fields including creator
    if (!sparkForm.value.name || !sparkForm.value.tiktokLink || !sparkForm.value.sparkCode || sparkForm.value.creator === undefined) {
      showError('Please fill in all required fields including creator');
      return;
    }
    
    // Prepare the data to send
    const sparkData = {
      name: sparkForm.value.name,
      creator: sparkForm.value.creator || '',  // Empty string for "None" selection
      tiktokLink: sparkForm.value.tiktokLink,
      sparkCode: sparkForm.value.sparkCode,
      type: sparkForm.value.type || 'auto',
      offer: '',  // Default empty offer
      status: sparkForm.value.status || 'active'
    };
    
    // Note: thumbnail will be auto-generated from TikTok link on the server side
    
    if (editingSparkData.value) {
      await sparksApi.updateSpark(editingSparkData.value.id, sparkData);
      showSuccess('Spark updated successfully');
    } else {
      await sparksApi.createSpark(sparkData);
      showSuccess('Spark created successfully');
    }
    showCreateModal.value = false;
    fetchSparks();
  } catch (error) {
    showError('Failed to save spark: ' + (error.message || 'Unknown error'));
  }
};

const deleteSpark = (spark) => {
  // Handle both spark object and spark id
  if (typeof spark === 'string') {
    // If only ID is passed, find the spark object
    sparkToDelete.value = sparks.value.find(s => s.id === spark);
  } else {
    sparkToDelete.value = spark;
  }
  showDeleteModal.value = true;
};

const confirmDelete = async () => {
  if (!sparkToDelete.value) return;
  
  deleteLoading.value = true;
  try {
    await sparksApi.deleteSpark(sparkToDelete.value.id);
    showDeleteModal.value = false;
    showSuccess('Spark deleted successfully');
    fetchSparks();
  } catch (error) {
    showError('Failed to delete spark: ' + (error.message || 'Unknown error'));
  } finally {
    deleteLoading.value = false;
    sparkToDelete.value = null;
  }
};

const cancelDelete = () => {
  showDeleteModal.value = false;
  sparkToDelete.value = null;
};

const bulkAdd = () => {
  // Reset bulk add form
  bulkAddForm.value = {
    baseName: '',
    type: 'auto',
    creator: undefined,
    status: 'active',
    sparkCodes: '',
    tiktokLinks: ''
  };
  bulkAddPreview.value = [];
  showBulkAddModal.value = true;
};

const onTikTokLinksChange = () => {
  // Optional: Could auto-update spark codes if prefix is set
  // But let's keep it manual for now to avoid unexpected changes
};

const previewBulkAdd = () => {
  const tiktokLinks = bulkAddForm.value.tiktokLinks.split('\n').filter(link => link.trim());
  const sparkCodes = bulkAddForm.value.sparkCodes.split('\n').filter(code => code.trim());
  
  if (sparkCodes.length !== tiktokLinks.length) {
    showError('Number of TikTok links must match number of spark codes');
    return;
  }
  
  if (tiktokLinks.length === 0) {
    showError('Please enter at least one TikTok link and spark code');
    return;
  }
  
  // Parse the base name to extract prefix and number
  const baseNameMatch = bulkAddForm.value.baseName.match(/^(.*?)(\d+)$/);
  let namePrefix = bulkAddForm.value.baseName;
  let startNumber = 1;
  
  if (baseNameMatch) {
    namePrefix = baseNameMatch[1];
    startNumber = parseInt(baseNameMatch[2]);
  }
  
  bulkAddPreview.value = tiktokLinks.map((link, index) => {
    const currentNumber = startNumber + index;
    const paddedNumber = baseNameMatch && baseNameMatch[2].length > 1 
      ? currentNumber.toString().padStart(baseNameMatch[2].length, '0')
      : currentNumber.toString();
    
    return {
      name: `${namePrefix}${paddedNumber}`,
      tiktokLink: link.trim(),
      sparkCode: sparkCodes[index]?.trim() || `${namePrefix}${paddedNumber}`
    };
  });
  
  showInfo(`Ready to create ${bulkAddPreview.value.length} sparks`);
};

const saveBulkAdd = async () => {
  // Validate required fields
  if (!bulkAddForm.value.baseName || bulkAddForm.value.creator === undefined) {
    showError('Please fill in all required fields');
    return;
  }
  
  const tiktokLinks = bulkAddForm.value.tiktokLinks.split('\n').filter(link => link.trim());
  const sparkCodes = bulkAddForm.value.sparkCodes.split('\n').filter(code => code.trim());
  
  if (sparkCodes.length !== tiktokLinks.length) {
    showError('Number of TikTok links must match number of spark codes');
    return;
  }
  
  if (tiktokLinks.length === 0) {
    showError('Please enter at least one TikTok link and spark code');
    return;
  }
  
  bulkAddLoading.value = true;
  
  // Parse the base name to extract prefix and number
  const baseNameMatch = bulkAddForm.value.baseName.match(/^(.*?)(\d+)$/);
  let namePrefix = bulkAddForm.value.baseName;
  let startNumber = 1;
  
  if (baseNameMatch) {
    namePrefix = baseNameMatch[1];
    startNumber = parseInt(baseNameMatch[2]);
  }
  
  try {
    let successCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < tiktokLinks.length; i++) {
      const currentNumber = startNumber + i;
      const paddedNumber = baseNameMatch && baseNameMatch[2].length > 1 
        ? currentNumber.toString().padStart(baseNameMatch[2].length, '0')
        : currentNumber.toString();
      
      const sparkData = {
        name: `${namePrefix}${paddedNumber}`,
        creator: bulkAddForm.value.creator || '',
        tiktokLink: tiktokLinks[i].trim(),
        sparkCode: sparkCodes[i]?.trim() || `AUTO-${i + 1}`,
        type: bulkAddForm.value.type,
        offer: '',  // Default empty offer
        status: bulkAddForm.value.status
      };
      
      try {
        await sparksApi.createSpark(sparkData);
        successCount++;
      } catch (error) {
        console.error(`Failed to create spark ${i + 1}:`, error);
        failedCount++;
      }
    }
    
    showBulkAddModal.value = false;
    
    if (failedCount === 0) {
      showSuccess(`Successfully created ${successCount} sparks`);
    } else {
      showError(`Created ${successCount} sparks, ${failedCount} failed`);
    }
    
    // Refresh the sparks list
    fetchSparks();
  } catch (error) {
    showError('Failed to create sparks: ' + (error.message || 'Unknown error'));
  } finally {
    bulkAddLoading.value = false;
  }
};

const exportToCSV = () => {
  const headers = ['Name', 'Creator', 'Type', 'Status', 'Spark Code', 'Offer', 'Created'];
  const rows = filteredSparks.value.map(spark => [
    spark.name,
    spark.creator || '-',
    spark.type || 'Auto',
    spark.status,
    spark.spark_code,
    spark.offer_name || '-',
    formatDate(spark.created_at)
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sparks_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  
  showSuccess('CSV exported successfully');
};

const markPaid = (paymentId) => {
  showInfo('Mark paid feature coming soon');
};

// Helper functions
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

const showInfo = (message) => {
  snackbarText.value = message;
  snackbarColor.value = 'info';
  showSnackbar.value = true;
};

// Lifecycle
onMounted(async () => {
  // Fetch VAs and templates first, then sparks
  await Promise.all([
    fetchVirtualAssistants(),
    fetchOfferTemplates()
  ]);
  await fetchSparks();
});
</script>

<style scoped>
.sparks-container {
  padding-top: 20px;
}

.thumbnail-container {
  display: inline-block;
  overflow: hidden;
  border-radius: 4px;
}

.cursor-pointer {
  cursor: pointer;
}

.sparks-table :deep(tbody tr:hover) {
  cursor: pointer;
}

code {
  padding: 2px 6px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.05);
  font-family: monospace;
}

:deep(.v-data-table__th) {
  font-weight: 600 !important;
}

.preview-list {
  max-height: 400px;
  overflow-y: auto;
  background-color: transparent;
}

.preview-list .v-list-item {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding: 12px 0;
}

.preview-list .v-list-item:last-child {
  border-bottom: none;
}
</style>