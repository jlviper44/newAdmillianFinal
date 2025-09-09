<template>
  <v-container fluid class="launches-container pa-0">
    <!-- Campaign Selector and Info -->
    <v-card class="mb-4">
      <v-card-text :class="$vuetify.display.smAndDown ? 'pa-3' : 'pa-4'">
        <v-row align="center">
          <v-col cols="12" md="6">
            <v-select
              v-model="selectedCampaignId"
              label="Select Campaign"
              :items="campaignOptions"
              item-title="name"
              item-value="id"
              @update:model-value="selectCampaign"
              :density="$vuetify.display.smAndDown ? 'compact' : 'comfortable'"
            >
              <template v-slot:selection="{ item }">
                <div class="d-flex align-center">
                  <span class="font-weight-medium">{{ item.title }}</span>
                </div>
              </template>
            </v-select>
          </v-col>
          <v-col cols="12" md="6" v-if="currentCampaign">
            <div class="text-body-2">
              <div class="d-flex align-center">
                <span>Campaign ID: </span>
                <v-text-field
                  v-if="editingCampaignId"
                  v-model="tempCampaignId"
                  variant="outlined"
                  density="compact"
                  hide-details
                  single-line
                  class="mx-2"
                  style="max-width: 300px; min-width: 250px;"
                  @keyup.enter="saveCampaignId"
                  @keyup.esc="cancelEditCampaignId"
                >
                  <template v-slot:append>
                    <v-btn
                      icon="mdi-check"
                      variant="text"
                      size="x-small"
                      color="green"
                      @click="saveCampaignId"
                    />
                    <v-btn
                      icon="mdi-close"
                      variant="text"
                      size="x-small"
                      color="red"
                      @click="cancelEditCampaignId"
                    />
                  </template>
                </v-text-field>
                <span v-else class="d-flex align-center">
                  <strong class="mx-2">{{ currentCampaign?.id }}</strong>
                  <v-btn
                    icon="mdi-pencil"
                    variant="text"
                    size="x-small"
                    class="ml-1"
                    @click="startEditCampaignId"
                  />
                </span>
                <v-divider vertical class="mx-3" />
                <span>Total Launches: <strong>{{ currentLaunches.length }}</strong></span>
              </div>
            </div>
          </v-col>
        </v-row>
        
        <v-alert
          v-if="currentCampaign"
          type="info"
          variant="tonal"
          density="compact"
          class="mt-3 mb-0"
        >
          <span class="text-caption">The "Generate Link" button will create/refresh the Shopify pages with the latest campaign settings.</span>
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Add New Launches Section -->
    <v-card v-if="currentCampaign" variant="flat" class="mb-4 pa-4" :class="$vuetify.theme.current.dark ? 'bg-grey-darken-3' : 'bg-grey-lighten-5'">
      <div class="d-flex align-center justify-space-between">
        <h4 class="text-body-1 font-weight-medium">Add New Launches</h4>
        <div class="d-flex align-center gap-3">
          <span class="text-body-2 font-weight-medium">Count:</span>
          <div class="launch-count-wrapper purple-theme">
            <button 
              type="button"
              class="launch-count-btn minus"
              @click="decrementLaunchCount"
              :disabled="newLaunchCount <= 1"
            >
              <v-icon size="small">mdi-minus</v-icon>
            </button>
            <input 
              v-model.number="newLaunchCount"
              type="number"
              min="1"
              max="10"
              class="launch-count-input"
              @input="validateLaunchCount"
            />
            <button 
              type="button"
              class="launch-count-btn plus"
              @click="incrementLaunchCount"
              :disabled="newLaunchCount >= 10"
            >
              <v-icon size="small">mdi-plus</v-icon>
            </button>
          </div>
          <v-btn
            color="purple"
            variant="flat"
            size="small"
            @click="addNewLaunches"
            :loading="addingLaunches"
            prepend-icon="mdi-plus"
            class="mx-2 my-1"
          >
            ADD
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- Loading State -->
    <v-row v-if="isLoading">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
        <p class="mt-2">Loading launches...</p>
      </v-col>
    </v-row>
    
    <!-- No Campaign Selected -->
    <v-row v-else-if="!currentCampaign">
      <v-col cols="12" class="text-center">
        <v-icon size="48" color="grey">mdi-rocket-launch</v-icon>
        <p class="text-h6 mt-3">Select a Campaign</p>
        <p class="text-body-2 text-grey">Choose a campaign from the dropdown above to manage its launches</p>
      </v-col>
    </v-row>
    
    <!-- Existing Launches -->
    <div v-else>
      <h4 class="text-body-1 mb-3 font-weight-medium">Existing Launches</h4>
      
      <div v-if="currentLaunches.length === 0" class="text-center py-8">
        <v-card class="pa-8">
          <v-icon size="48" color="grey">mdi-rocket</v-icon>
          <p class="text-body-1 mt-3 mb-1">No launches found</p>
          <p class="text-caption text-grey">Click "Add" above to create your first launch</p>
        </v-card>
      </div>
      
      <div v-else class="d-flex flex-column ga-3">
        <v-card
          v-for="(launch, index) in filteredLaunches" 
          :key="launch.number"
          :color="launch.isActive ? ($vuetify.theme.current.dark ? 'grey-darken-2' : 'grey-lighten-5') : ($vuetify.theme.current.dark ? 'grey-darken-3' : 'grey-lighten-4')"
          :variant="launch.isActive ? 'outlined' : 'flat'"
          :style="launch.isActive ? 'border-color: rgb(168, 85, 247); border-width: 2px;' : ''"
          class="pa-4"
        >
          <div class="d-flex flex-column flex-sm-row align-start align-sm-center justify-space-between ga-3">
            <!-- Launch info -->
            <div class="flex-grow-1" style="min-width: 0;">
              <div class="d-flex align-center gap-2 mb-2 flex-wrap">
                <span class="text-h6 font-weight-medium d-flex align-center" :class="$vuetify.theme.current.dark ? 'text-grey-lighten-2' : 'text-grey-darken-4'">
                  Launch: 
                  <v-text-field
                    v-if="editingLaunchId === launch.number"
                    v-model="tempLaunchId"
                    variant="outlined"
                    density="compact"
                    hide-details
                    single-line
                    class="mx-2"
                    style="max-width: 350px; min-width: 250px;"
                    @keyup.enter="saveLaunchId(launch.number)"
                    @keyup.esc="cancelEditLaunchId"
                  >
                    <template v-slot:append>
                      <v-btn
                        icon="mdi-check"
                        variant="text"
                        size="x-small"
                        color="green"
                        @click="saveLaunchId(launch.number)"
                      />
                      <v-btn
                        icon="mdi-close"
                        variant="text"
                        size="x-small"
                        color="red"
                        @click="cancelEditLaunchId"
                      />
                    </template>
                  </v-text-field>
                  <span v-else class="d-flex align-center">
                    <strong class="mx-2">{{ launch.number }}</strong>
                    <v-btn
                      v-if="launch.number !== '0' && launch.number !== 0"
                      icon="mdi-pencil"
                      variant="text"
                      size="x-small"
                      class="ml-1"
                      @click="startEditLaunchId(launch.number)"
                    />
                  </span>
                  <span v-if="launch.number === '0' || launch.number === 0" class="text-caption ml-1">(Default - Cannot be renamed)</span>
                </span>
                
                <v-chip 
                  :color="launch.isActive ? 'green' : 'grey'"
                  variant="tonal"
                  size="small"
                  label
                >
                  {{ launch.isActive ? 'Active' : 'Disabled' }}
                </v-chip>
                
                <v-chip
                  v-if="launch.traffic > 0"
                  color="blue"
                  variant="tonal"
                  size="small"
                  label
                >
                  <v-icon start size="x-small">mdi-chart-line</v-icon>
                  {{ launch.traffic }} visits
                </v-chip>
              </div>
              
              <div class="text-body-2" :class="$vuetify.theme.current.dark ? 'text-grey-lighten-1' : 'text-grey-darken-1'">
                <div v-if="launch.createdAt" class="mb-1">
                  Created: {{ formatDate(launch.createdAt) }}
                </div>
                <div v-if="launch.generatedAt">
                  <template v-if="getTimeSinceGenerated(launch.generatedAt).hours < 1">
                    <v-icon size="x-small" color="green">mdi-circle</v-icon>
                    <span class="text-green-darken-1 ml-1">Updated {{ getTimeSinceGenerated(launch.generatedAt).minutes }}m ago</span>
                  </template>
                  <template v-else-if="getTimeSinceGenerated(launch.generatedAt).hours < 24">
                    <v-icon size="x-small" color="blue">mdi-circle</v-icon>
                    <span class="text-blue-darken-1 ml-1">Updated {{ getTimeSinceGenerated(launch.generatedAt).hours }}h ago</span>
                  </template>
                  <template v-else>
                    <v-icon size="x-small" color="orange">mdi-circle</v-icon>
                    <span class="text-orange-darken-1 ml-1">Updated {{ getTimeSinceGenerated(launch.generatedAt).days }}d ago</span>
                  </template>
                </div>
                <div v-else>
                  <v-icon size="x-small" color="orange">mdi-circle</v-icon>
                  <span class="text-orange-darken-1 ml-1">Not generated</span>
                </div>
              </div>
            </div>

            <!-- Action buttons -->
            <div class="d-flex align-center gap-2 flex-shrink-0">
              <v-btn
                color="purple"
                variant="flat"
                @click="generateLaunchLink(launch.number)"
                :loading="generatingLinkFor === launch.number"
                :prepend-icon="launch.generatedAt ? 'mdi-refresh' : 'mdi-link'"
              >
                {{ launch.generatedAt ? 'REFRESH & COPY' : 'GENERATE LINK' }}
              </v-btn>
              
              <v-btn
                color="blue"
                variant="tonal"
                @click="copyTestLink(launch.number)"
                :disabled="!launch.generatedAt"
                prepend-icon="mdi-test-tube"
              >
                COPY TEST LINK
              </v-btn>
              
              <v-btn
                :color="launch.isActive ? 'grey' : 'green'"
                variant="flat"
                @click="toggleLaunch(launch.number)"
                :loading="togglingLaunch === launch.number"
                :prepend-icon="launch.isActive ? 'mdi-pause' : 'mdi-play'"
              >
                {{ launch.isActive ? 'DISABLE' : 'ENABLE' }}
              </v-btn>
            </div>
          </div>
        </v-card>
      </div>
    </div>
    
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
import { ref, onMounted, computed, watch } from 'vue';
import { campaignsApi, shopifyApi } from '@/services/api';
import logsAPI from '@/services/logsAPI';

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
const campaigns = ref([]);
const stores = ref([]);
const currentCampaign = ref(null);
const currentLaunches = ref([]);
const selectedCampaignId = ref(null);
const isLoading = ref(false);
const searchQuery = ref('');
const statusFilter = ref('all');

// Campaign ID editing
const editingCampaignId = ref(false);
const tempCampaignId = ref('');

// Launch ID editing
const editingLaunchId = ref(null);
const tempLaunchId = ref('');

// Launch management
const newLaunchCount = ref(1);
const addingLaunches = ref(false);
const generatingLinkFor = ref(null);
const togglingLaunch = ref(null);

// Computed properties
const campaignOptions = computed(() => {
  return campaigns.value.map(c => ({
    id: c.id,
    name: `${c.name} (${c.id})`
  }));
});

const filteredLaunches = computed(() => {
  let launches = [...currentLaunches.value];
  
  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    launches = launches.filter(l => 
      l.number.toString().toLowerCase().includes(query)
    );
  }
  
  // Filter by status
  if (statusFilter.value === 'active') {
    launches = launches.filter(l => l.isActive);
  } else if (statusFilter.value === 'disabled') {
    launches = launches.filter(l => !l.isActive);
  }
  
  return launches;
});

// Methods
const fetchCampaigns = async () => {
  try {
    const data = await campaignsApi.listCampaigns({ limit: 100 });
    campaigns.value = data.campaigns || [];
    
    // Auto-select first campaign if available
    if (campaigns.value.length > 0 && !selectedCampaignId.value) {
      selectedCampaignId.value = campaigns.value[0].id;
      await selectCampaign(selectedCampaignId.value);
    }
  } catch (error) {
    showError('Failed to load campaigns');
  }
};

const fetchStores = async () => {
  try {
    const data = await shopifyApi.listStores({ limit: 100, status: 'active' });
    stores.value = data.stores || [];
  } catch (error) {
    console.error('Failed to fetch stores:', error);
  }
};

const selectCampaign = async (campaignId) => {
  if (!campaignId) {
    currentCampaign.value = null;
    currentLaunches.value = [];
    return;
  }
  
  isLoading.value = true;
  try {
    // Fetch campaign details
    const data = await campaignsApi.getCampaign(campaignId);
    currentCampaign.value = data;
    
    // Fetch traffic data
    let trafficData = {};
    try {
      const trafficResponse = await logsAPI.getTrafficByLaunch(campaignId);
      trafficData = trafficResponse.traffic || {};
    } catch (error) {
      console.error('Failed to fetch traffic data:', error);
    }
    
    // Convert launches object to array
    if (data.launches && Object.keys(data.launches).length > 0) {
      const launchesArray = Object.entries(data.launches)
        .map(([num, launch]) => ({
          ...launch,
          number: num,
          traffic: trafficData[num] || 0
        }))
        .sort((a, b) => {
          const aNum = parseInt(a.number);
          const bNum = parseInt(b.number);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
          }
          return a.number.toString().localeCompare(b.number.toString());
        });
      currentLaunches.value = launchesArray;
    } else {
      // Initialize with default launch if none exist
      currentLaunches.value = [{
        number: '0',
        isActive: true,
        createdAt: new Date().toISOString(),
        generatedAt: null,
        traffic: trafficData['0'] || 0
      }];
    }
    
    newLaunchCount.value = 1;
  } catch (error) {
    showError('Failed to load campaign details');
    currentCampaign.value = null;
    currentLaunches.value = [];
  } finally {
    isLoading.value = false;
  }
};

const filterLaunches = () => {
  // Filtering is handled by computed property
};

const addNewLaunches = async () => {
  if (!currentCampaign.value || !newLaunchCount.value) return;
  
  addingLaunches.value = true;
  try {
    const newLaunches = [];
    
    for (let i = 0; i < newLaunchCount.value; i++) {
      const result = await campaignsApi.manageLaunches(currentCampaign.value.id, 'add', {});
      if (result.success && result.result?.launchNumber !== undefined) {
        newLaunches.push(result.result.launchNumber);
      }
    }
    
    if (newLaunches.length > 0) {
      showSuccess(`Successfully added ${newLaunches.length} new launch(es): ${newLaunches.join(', ')}`);
      await selectCampaign(currentCampaign.value.id);
    } else {
      showError('Failed to add launches');
    }
  } catch (error) {
    showError('Failed to add launches: ' + error.message);
  } finally {
    addingLaunches.value = false;
  }
};

// Campaign ID editing functions
const startEditCampaignId = () => {
  tempCampaignId.value = currentCampaign.value.id;
  editingCampaignId.value = true;
};

const cancelEditCampaignId = () => {
  editingCampaignId.value = false;
  tempCampaignId.value = '';
};

const saveCampaignId = async () => {
  if (!tempCampaignId.value || tempCampaignId.value === currentCampaign.value.id) {
    cancelEditCampaignId();
    return;
  }
  
  try {
    const result = await campaignsApi.updateCampaignId(currentCampaign.value.id, tempCampaignId.value);
    if (result.success) {
      showSuccess('Campaign ID updated successfully');
      const oldId = currentCampaign.value.id;
      currentCampaign.value.id = tempCampaignId.value;
      editingCampaignId.value = false;
      
      // Update the campaigns list and re-select
      await fetchCampaigns();
      selectedCampaignId.value = tempCampaignId.value;
      await selectCampaign(tempCampaignId.value);
    } else {
      showError(result.message || 'Failed to update campaign ID');
    }
  } catch (error) {
    showError('Failed to update campaign ID: ' + error.message);
  }
};

// Launch ID editing functions
const startEditLaunchId = (launchNumber) => {
  tempLaunchId.value = launchNumber.toString();
  editingLaunchId.value = launchNumber;
};

const cancelEditLaunchId = () => {
  editingLaunchId.value = null;
  tempLaunchId.value = '';
};

const saveLaunchId = async (oldLaunchNumber) => {
  const newLaunchId = tempLaunchId.value.trim();
  
  if (!newLaunchId || newLaunchId === oldLaunchNumber.toString()) {
    cancelEditLaunchId();
    return;
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(newLaunchId)) {
    showError('Launch ID can only contain letters, numbers, and underscores');
    return;
  }
  
  if (oldLaunchNumber.toString() !== newLaunchId && currentLaunches.value.some(l => l.number.toString() === newLaunchId)) {
    showError('Launch ID already exists');
    return;
  }
  
  try {
    const result = await campaignsApi.updateLaunchId(currentCampaign.value.id, oldLaunchNumber, newLaunchId);
    if (result.success) {
      showSuccess('Launch ID updated successfully');
      
      const launchIndex = currentLaunches.value.findIndex(l => l.number.toString() === oldLaunchNumber.toString());
      if (launchIndex !== -1) {
        currentLaunches.value[launchIndex].number = newLaunchId;
      }
      
      editingLaunchId.value = null;
      tempLaunchId.value = '';
      
      await selectCampaign(currentCampaign.value.id);
    } else {
      showError(result.message || 'Failed to update launch ID');
    }
  } catch (error) {
    showError('Failed to update launch ID: ' + error.message);
  }
};

const toggleLaunch = async (launchNumber) => {
  togglingLaunch.value = launchNumber;
  try {
    const result = await campaignsApi.manageLaunches(currentCampaign.value.id, 'toggle', {
      launchNumber: launchNumber
    });
    
    if (result.success) {
      const launchIndex = currentLaunches.value.findIndex(l => l.number.toString() === launchNumber.toString());
      if (launchIndex !== -1) {
        currentLaunches.value[launchIndex].isActive = result.result?.isActive || !currentLaunches.value[launchIndex].isActive;
      }
      
      showSuccess('Launch status updated');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      togglingLaunch.value = null;
      await generateLaunchLink(launchNumber);
    }
  } catch (error) {
    showError('Failed to update launch status');
  } finally {
    togglingLaunch.value = null;
  }
};

const generateLaunchLink = async (launchNumber) => {
  generatingLinkFor.value = launchNumber;
  try {
    const data = await campaignsApi.generateLink({
      campaignId: currentCampaign.value.id,
      launchNumber: launchNumber,
      params: {
        utm_source: 'tiktok',
        utm_medium: 'cpc',
        utm_campaign: currentCampaign.value.id
      }
    });
    
    if (data.success && data.link) {
      await navigator.clipboard.writeText(data.link);
      
      if (data.refreshed) {
        showSuccess('Shopify pages refreshed and link copied!');
      } else {
        showSuccess('Link generated and copied to clipboard!');
      }
      
      await selectCampaign(currentCampaign.value.id);
    }
  } catch (error) {
    let errorMessage = 'Error generating link: ' + error.message;
    
    if (error.message?.includes('store is missing admin API token')) {
      errorMessage = 'Error: The TikTok store is missing its Admin API token.';
    } else if (error.message?.includes('store not found')) {
      errorMessage = 'Error: One of the configured stores was not found.';
    }
    
    showError(errorMessage);
  } finally {
    generatingLinkFor.value = null;
  }
};

const copyTestLink = async (launchNumber) => {
  try {
    const pageHandle = `${currentCampaign.value.id}-${launchNumber}`;
    const tiktokStore = stores.value.find(s => s.id === currentCampaign.value.tiktokStoreId);
    
    if (!tiktokStore) {
      showError('TikTok store not found');
      return;
    }
    
    let storeUrl = tiktokStore.store_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!storeUrl.includes('.myshopify.com') && !storeUrl.includes('.')) {
      storeUrl = `${storeUrl}.myshopify.com`;
    }
    
    const testLink = `https://${storeUrl}/pages/${pageHandle}?ttclid=9999999`;
    await navigator.clipboard.writeText(testLink);
    showSuccess('Test link copied to clipboard!');
  } catch (error) {
    showError('Failed to copy test link: ' + error.message);
  }
};

// Helper functions
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

const getTimeSinceGenerated = (generatedAt) => {
  if (!generatedAt) return { hours: 0, days: 0, minutes: 0 };
  
  const genDate = new Date(generatedAt);
  const now = new Date();
  const diffMs = now - genDate;
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  return { hours, days, minutes };
};

// Launch count controls
const incrementLaunchCount = () => {
  if (newLaunchCount.value < 10) {
    newLaunchCount.value++;
  }
};

const decrementLaunchCount = () => {
  if (newLaunchCount.value > 1) {
    newLaunchCount.value--;
  }
};

const validateLaunchCount = () => {
  if (newLaunchCount.value < 1) {
    newLaunchCount.value = 1;
  } else if (newLaunchCount.value > 10) {
    newLaunchCount.value = 10;
  }
};

// Lifecycle
onMounted(() => {
  fetchCampaigns();
  fetchStores();
});
</script>

<style scoped>
.launches-container {
}

/* Launch count input with stepper buttons */
.launch-count-wrapper {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgb(216, 180, 254);
  border-radius: 4px;
  background-color: white;
  overflow: hidden;
}

.launch-count-input {
  border: none;
  padding: 6px 8px;
  font-size: 0.875rem;
  line-height: 1.25rem;
  background-color: transparent;
  color: rgba(0, 0, 0, 0.87);
  text-align: center;
  width: 50px;
  height: 32px;
  -moz-appearance: textfield;
}

.launch-count-input:focus {
  outline: none;
}

.launch-count-input::-webkit-inner-spin-button,
.launch-count-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.launch-count-btn {
  background-color: transparent;
  border: none;
  padding: 6px 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  color: rgb(168, 85, 247);
  min-width: 32px;
  height: 32px;
}

.launch-count-btn:hover:not(:disabled) {
  background-color: rgba(216, 180, 254, 0.2);
}

.launch-count-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
  color: rgba(0, 0, 0, 0.38);
}

.launch-count-btn.minus {
  border-right: 1px solid rgb(216, 180, 254);
}

.launch-count-btn.plus {
  border-left: 1px solid rgb(216, 180, 254);
}

/* Dark theme support */
.v-theme--dark .launch-count-wrapper {
  background-color: rgba(255, 255, 255, 0.09);
  border-color: rgba(168, 85, 247, 0.5);
}

.v-theme--dark .launch-count-input {
  color: rgba(255, 255, 255, 0.87);
}

.v-theme--dark .launch-count-btn {
  color: rgba(168, 85, 247, 0.9);
}

.v-theme--dark .launch-count-btn:hover:not(:disabled) {
  background-color: rgba(168, 85, 247, 0.1);
}

.v-theme--dark .launch-count-btn:disabled {
  color: rgba(255, 255, 255, 0.3);
}

.v-theme--dark .launch-count-btn.minus {
  border-right-color: rgba(168, 85, 247, 0.5);
}

.v-theme--dark .launch-count-btn.plus {
  border-left-color: rgba(168, 85, 247, 0.5);
}
</style>