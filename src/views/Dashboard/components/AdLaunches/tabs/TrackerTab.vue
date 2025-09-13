<template>
  <div>
    <!-- Week Selector and Summary Cards -->
    <v-card class="mb-4">
      <v-card-text>
        <v-row align="center">
          <v-col cols="12" md="4">
            <v-select
              v-model="selectedWeek"
              label="Select Week"
              :items="availableWeeks"
              item-title="display"
              item-value="key"
              @update:model-value="loadTrackerData"
              density="comfortable"
              prepend-inner-icon="mdi-calendar"
            />
          </v-col>
          <v-col cols="12" md="8">
            <div class="d-flex justify-end gap-2">
              <v-btn
                color="purple"
                variant="tonal"
                @click="exportTrackerData"
                prepend-icon="mdi-download"
              >
                Export CSV
              </v-btn>
              <v-btn
                color="green"
                variant="flat"
                @click="openAddEntryDialog"
                prepend-icon="mdi-plus"
              >
                Add Entry
              </v-btn>
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Summary Cards -->
    <v-row class="mb-4">
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text>
            <div class="text-overline mb-1">Total Entries</div>
            <div class="text-h4">{{ launches.length }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text>
            <div class="text-overline mb-1">Total Ad Spend</div>
            <div class="text-h4">${{ totalAdSpend.toFixed(2) }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text>
            <div class="text-overline mb-1">Active Campaigns</div>
            <div class="text-h4">{{ activeCampaigns }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text>
            <div class="text-overline mb-1">This Week</div>
            <div class="text-h4">{{ weeklyLaunches }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Data Table -->
    <v-card>
      <v-card-title>
        <v-row align="center">
          <v-col>
            Ad Launches Tracker
          </v-col>
          <v-col cols="auto">
            <v-text-field
              v-model="search"
              append-inner-icon="mdi-magnify"
              label="Search"
              single-line
              hide-details
              density="compact"
            />
          </v-col>
        </v-row>
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="headers"
          :items="filteredLaunches"
          :search="search"
          :items-per-page="10"
        >
          <template v-slot:item.actions="{ item }">
            <v-btn icon size="small" @click="editEntry(item)">
              <v-icon>mdi-pencil</v-icon>
            </v-btn>
            <v-btn icon size="small" @click="deleteEntry(item)" color="red">
              <v-icon>mdi-delete</v-icon>
            </v-btn>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Add/Edit Dialog -->
    <v-dialog v-model="entryDialog" max-width="600">
      <v-card>
        <v-card-title>
          {{ editingEntry ? 'Edit Entry' : 'Add New Entry' }}
        </v-card-title>
        <v-card-text>
          <v-form ref="entryForm">
            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="entryData.va"
                  label="VA Name"
                  required
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="entryData.campaign_id"
                  label="Campaign ID"
                  required
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="entryData.launch_id"
                  label="Launch ID"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="entryData.ad_spend"
                  label="Ad Spend"
                  type="number"
                  prefix="$"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="entryData.date"
                  label="Date"
                  type="date"
                />
              </v-col>
              <v-col cols="12">
                <v-select
                  v-model="entryData.status"
                  label="Status"
                  :items="['Active', 'Paused', 'Completed']"
                />
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="entryData.notes"
                  label="Notes"
                  rows="3"
                />
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="closeEntryDialog">Cancel</v-btn>
          <v-btn color="primary" @click="saveEntry">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import adLaunchesAPI from '@/services/adLaunchesAPI';

// Props
const props = defineProps({
  user: Object
});

// Emit
const emit = defineEmits(['show-message']);

// Data
const launches = ref([]);
const search = ref('');
const selectedWeek = ref('current');
const availableWeeks = ref([]);
const entryDialog = ref(false);
const editingEntry = ref(null);

const entryData = reactive({
  va: '',
  campaign_id: '',
  launch_id: '',
  ad_spend: 0,
  date: new Date().toISOString().split('T')[0],
  status: 'Active',
  notes: ''
});

// Headers for data table
const headers = [
  { title: 'VA', key: 'va' },
  { title: 'Campaign ID', key: 'campaign_id' },
  { title: 'Launch ID', key: 'launch_id' },
  { title: 'Ad Spend', key: 'ad_spend' },
  { title: 'Date', key: 'date' },
  { title: 'Status', key: 'status' },
  { title: 'Actions', key: 'actions', sortable: false }
];

// Computed
const filteredLaunches = computed(() => {
  return launches.value;
});

const totalAdSpend = computed(() => {
  return launches.value.reduce((sum, launch) => sum + (parseFloat(launch.ad_spend) || 0), 0);
});

const activeCampaigns = computed(() => {
  return launches.value.filter(l => l.status === 'Active').length;
});

const weeklyLaunches = computed(() => {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return launches.value.filter(l => new Date(l.date) >= weekAgo).length;
});

// Methods
const loadTrackerData = async () => {
  try {
    const response = await adLaunchesAPI.getTrackerData(selectedWeek.value);
    if (response.success) {
      launches.value = response.data || [];
    }
  } catch (error) {
    console.error('Error loading tracker data:', error);
    emit('show-message', { text: 'Failed to load tracker data', color: 'error' });
  }
};

const loadAvailableWeeks = () => {
  const weeks = [];
  const today = new Date();
  
  // Current week
  weeks.push({
    key: 'current',
    display: 'Current Week'
  });
  
  // Previous 8 weeks
  for (let i = 1; i <= 8; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - (i * 7));
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    weeks.push({
      key: `week_${i}`,
      display: `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`
    });
  }
  
  availableWeeks.value = weeks;
};

const openAddEntryDialog = () => {
  editingEntry.value = null;
  Object.assign(entryData, {
    va: props.user?.email || '',
    campaign_id: '',
    launch_id: '',
    ad_spend: 0,
    date: new Date().toISOString().split('T')[0],
    status: 'Active',
    notes: ''
  });
  entryDialog.value = true;
};

const editEntry = (entry) => {
  editingEntry.value = entry;
  Object.assign(entryData, entry);
  entryDialog.value = true;
};

const closeEntryDialog = () => {
  entryDialog.value = false;
  editingEntry.value = null;
};

const saveEntry = async () => {
  try {
    const api = editingEntry.value 
      ? adLaunchesAPI.updateLaunch(editingEntry.value.id, entryData)
      : adLaunchesAPI.createLaunch(entryData);
      
    const response = await api;
    if (response.success) {
      emit('show-message', { 
        text: editingEntry.value ? 'Entry updated successfully' : 'Entry created successfully', 
        color: 'success' 
      });
      await loadTrackerData();
      closeEntryDialog();
    }
  } catch (error) {
    emit('show-message', { text: 'Failed to save entry', color: 'error' });
  }
};

const deleteEntry = async (entry) => {
  if (!confirm('Are you sure you want to delete this entry?')) return;
  
  try {
    const response = await adLaunchesAPI.deleteLaunch(entry.id);
    if (response.success) {
      emit('show-message', { text: 'Entry deleted successfully', color: 'success' });
      await loadTrackerData();
    }
  } catch (error) {
    emit('show-message', { text: 'Failed to delete entry', color: 'error' });
  }
};

const exportTrackerData = () => {
  const csv = [
    ['VA', 'Campaign ID', 'Launch ID', 'Ad Spend', 'Date', 'Status', 'Notes'],
    ...launches.value.map(l => [
      l.va,
      l.campaign_id,
      l.launch_id,
      l.ad_spend,
      l.date,
      l.status,
      l.notes
    ])
  ].map(row => row.join(',')).join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ad-launches-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// Lifecycle
onMounted(() => {
  loadAvailableWeeks();
  loadTrackerData();
});
</script>