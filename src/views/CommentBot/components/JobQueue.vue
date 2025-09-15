<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { commentBotApi } from '@/services/api';

// State
const jobs = ref([]);
const queueStats = ref(null);
const loading = ref(false);
const error = ref(null);
const pollingInterval = ref(null);

// Fetch job queue
const fetchJobs = async () => {
  try {
    console.log('=== JobQueue: Fetching jobs from queue ===');
    
    // First, try fetching all jobs to see what's there
    const allJobsResponse = await commentBotApi.getJobs({ 
      limit: 50 
    });
    console.log('All jobs (no filter):', allJobsResponse);
    
    const [pendingResponse, processingResponse] = await Promise.all([
      commentBotApi.getJobs({ 
        status: 'pending',
        limit: 20 
      }),
      commentBotApi.getJobs({ 
        status: 'processing',
        limit: 5 
      })
    ]);
    
    console.log('Pending jobs response:', pendingResponse);
    console.log('Processing jobs response:', processingResponse);
    
    // Combine and sort by status (processing first) then by created_at
    const allJobs = [
      ...(processingResponse.jobs || []),
      ...(pendingResponse.jobs || [])
    ];
    
    console.log('All jobs combined:', allJobs);
    console.log('Setting jobs.value to:', allJobs.length, 'jobs');
    
    jobs.value = allJobs;
  } catch (err) {
    console.error('Error fetching jobs:', err);
    error.value = err.message || 'Failed to fetch jobs';
  }
};

// Fetch queue statistics
const fetchQueueStats = async () => {
  try {
    const response = await commentBotApi.getQueueStats();
    queueStats.value = response.stats;
  } catch (err) {
    console.error('Error fetching queue stats:', err);
  }
};

// Refresh all data
const refresh = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    await Promise.all([
      fetchJobs(),
      fetchQueueStats()
    ]);
  } catch (err) {
    error.value = err.message || 'Failed to fetch queue data';
  } finally {
    loading.value = false;
  }
};

// Cancel a job
const cancelJob = async (jobId) => {
  try {
    await commentBotApi.cancelJob(jobId);
    await refresh();
  } catch (err) {
    error.value = err.message || 'Failed to cancel job';
  }
};


// Get status color
const getStatusColor = (status) => {
  switch (status) {
    case 'pending': return 'warning';
    case 'processing': return 'info';
    case 'completed': return 'success';
    case 'failed': return 'error';
    case 'cancelled': return 'grey';
    default: return 'grey';
  }
};

// Get status icon
const getStatusIcon = (status) => {
  switch (status) {
    case 'pending': return 'mdi-clock-outline';
    case 'processing': return 'mdi-progress-clock';
    case 'completed': return 'mdi-check-circle';
    case 'failed': return 'mdi-alert-circle';
    case 'cancelled': return 'mdi-cancel';
    default: return 'mdi-help-circle';
  }
};

// Get status label
const getStatusLabel = (status) => {
  switch (status) {
    case 'pending': return 'Not Started';
    case 'processing': return 'Processing';
    case 'completed': return 'Completed';
    case 'failed': return 'Failed';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
};

// Format time
const formatTime = (seconds) => {
  if (!seconds) return 'N/A';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.round(seconds / 60)}m`;
};

// Initialize
onMounted(async () => {
  refresh();
  
  // Poll every 5 seconds
  pollingInterval.value = setInterval(refresh, 5000);
});

// Cleanup
onUnmounted(() => {
  if (pollingInterval.value) {
    clearInterval(pollingInterval.value);
  }
});
</script>

<template>
  <v-card class="elevation-1 rounded-lg">
    <v-card-title class="d-flex align-center justify-space-between">
      <div class="d-flex align-center">
        <v-icon icon="mdi-format-list-bulleted" color="primary" class="mr-2"></v-icon>
        <span class="text-h6">Job Queue</span>
      </div>
      
      <v-btn
        icon="mdi-refresh"
        variant="text"
        size="small"
        @click="refresh"
        :loading="loading"
      ></v-btn>
    </v-card-title>
    
    <v-card-text>
      <!-- Queue Statistics -->
      <v-row v-if="queueStats" class="mb-4">
        <v-col cols="6" sm="3">
          <v-card variant="outlined">
            <v-card-text class="text-center">
              <div class="text-h4 text-warning">{{ queueStats.pending }}</div>
              <div class="text-caption">Pending</div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="6" sm="3">
          <v-card variant="outlined">
            <v-card-text class="text-center">
              <div class="text-h4 text-info">{{ queueStats.processing }}</div>
              <div class="text-caption">Processing</div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="6" sm="3">
          <v-card variant="outlined">
            <v-card-text class="text-center">
              <div class="text-h4 text-success">{{ queueStats.completed }}</div>
              <div class="text-caption">Completed (24h)</div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="6" sm="3">
          <v-card variant="outlined">
            <v-card-text class="text-center">
              <div class="text-h4">{{ formatTime(queueStats.avgProcessingTime) }}</div>
              <div class="text-caption">Avg Time</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
      
      <!-- Error Message -->
      <v-alert v-if="error" type="error" variant="outlined" class="mb-4">
        {{ error }}
      </v-alert>
      
      <!-- Jobs List -->
      <v-list v-if="jobs.length > 0" lines="two">
        <v-list-item 
          v-for="job in jobs" 
          :key="job.job_id"
          class="mb-2"
        >
          <template v-slot:prepend>
            <v-icon :color="getStatusColor(job.status)">
              {{ getStatusIcon(job.status) }}
            </v-icon>
          </template>
          
          <v-list-item-title>
            Job #{{ job.job_id.substring(0, 8) }}
            <v-chip 
              :color="getStatusColor(job.status)" 
              size="x-small"
              class="ml-2"
            >
              {{ getStatusLabel(job.status) }}
            </v-chip>
          </v-list-item-title>
          
          <v-list-item-subtitle>
            <div>Type: {{ job.type }}</div>
            <div v-if="job.queue_position">
              Position in queue: {{ job.queue_position }}
            </div>
            <div v-if="job.estimatedCompletionTime">
              Est. completion: {{ new Date(job.estimatedCompletionTime).toLocaleTimeString() }}
            </div>
          </v-list-item-subtitle>
          
          <template v-slot:append>
            <v-btn
              v-if="job.status === 'pending'"
              icon="mdi-close"
              variant="text"
              size="small"
              color="error"
              @click="cancelJob(job.job_id)"
            ></v-btn>
          </template>
        </v-list-item>
      </v-list>
      
      <!-- Empty State -->
      <div v-else-if="!loading" class="text-center py-4">
        <v-icon size="48" color="grey">mdi-inbox</v-icon>
        <div class="text-grey mt-2">No jobs in queue</div>
      </div>
      
      <!-- Loading State -->
      <div v-if="loading && jobs.length === 0" class="text-center py-4">
        <v-progress-circular indeterminate></v-progress-circular>
      </div>
    </v-card-text>
  </v-card>
</template>