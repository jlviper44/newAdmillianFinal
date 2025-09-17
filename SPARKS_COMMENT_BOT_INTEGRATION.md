# Sparks Comment Bot Integration Guide

## Overview
This guide explains how to integrate Comment Bot bulk functionality with the Sparks section, allowing users to select multiple sparks and apply comment bot operations in bulk, similar to the "Edit All" feature.

## Prerequisites
Users must be subscribed to both:
- Comment Bot
- Dashboard

## Feature Components

### 1. Bulk Comment Bot Interface

#### Database Schema Update
```sql
ALTER TABLE sparks ADD COLUMN bot_status VARCHAR(20) DEFAULT 'not_botted';
ALTER TABLE sparks ADD COLUMN bot_order_id INT;
ALTER TABLE sparks ADD COLUMN last_bot_attempt TIMESTAMP;
ALTER TABLE sparks ADD FOREIGN KEY (bot_order_id) REFERENCES comment_bot_orders(id);
```

Bot Status Values:
- `not_botted` - Default state, no bot operation performed
- `queued` - Spark is queued for bot processing
- `processing` - Bot operation is currently in progress
- `completed` - Bot operation finished successfully
- `failed` - Bot operation failed

#### API Endpoints Required
- `GET /api/commentbot/comment-groups` - Fetch available comment groups
- `POST /api/commentbot/bulk-orders` - Create bulk bot orders
- `GET /api/commentbot/order-status/:orderId` - Check order status
- `PUT /api/sparks/bulk-bot-status` - Update bot status for multiple sparks

### 2. Implementation Steps

#### Step 1: Update Sparks Data Model
Add bot status tracking fields to the spark model:

```javascript
// In SparksView.vue data
const sparks = ref([
  {
    id: 1,
    name: 'Spark Name',
    tiktok_link: 'https://tiktok.com/...',
    bot_status: 'not_botted', // NEW: Track bot status
    bot_order_id: null, // NEW: Reference to bot order
    last_bot_attempt: null, // NEW: Timestamp of last bot attempt
    // ... other fields
  }
]);
```

#### Step 2: Add Comment Bot Button to Toolbar
```vue
<!-- Add to SparksView.vue toolbar -->
<v-btn
  v-if="hasCommentBotAccess"
  @click="openCommentBotModal"
  color="primary"
  variant="elevated"
  class="ml-2"
>
  <v-icon start>mdi-robot</v-icon>
  Comment Bot
</v-btn>
```

#### Step 3: Add Bot Status Column to Table
```javascript
const headers = [
  // ... existing headers
  {
    title: 'Bot Status',
    key: 'bot_status',
    sortable: true,
    width: '120px',
    align: 'center'
  },
  // ... other headers
];
```

#### Step 4: Display Bot Status in Table
```vue
<!-- In the data table template -->
<template v-slot:item.bot_status="{ item }">
  <v-chip 
    :color="getBotStatusColor(item.bot_status)"
    size="small"
    variant="tonal"
  >
    <v-progress-circular
      v-if="item.bot_status === 'processing'"
      size="12"
      width="2"
      indeterminate
      class="mr-1"
    />
    <v-icon v-else start size="x-small">
      {{ getBotStatusIcon(item.bot_status) }}
    </v-icon>
    {{ formatBotStatus(item.bot_status) }}
  </v-chip>
</template>
```

#### Step 5: Helper Functions for Bot Status
```javascript
const getBotStatusColor = (status) => {
  const colors = {
    'not_botted': 'grey',
    'queued': 'blue',
    'processing': 'orange',
    'completed': 'success',
    'failed': 'error'
  };
  return colors[status] || 'grey';
};

const getBotStatusIcon = (status) => {
  const icons = {
    'not_botted': 'mdi-robot-off',
    'queued': 'mdi-clock-outline',
    'processing': 'mdi-cog',
    'completed': 'mdi-check-circle',
    'failed': 'mdi-alert-circle'
  };
  return icons[status] || 'mdi-help-circle';
};

const formatBotStatus = (status) => {
  return status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Not Botted';
};
```

### 3. Comment Bot Bulk Modal Component

#### CommentBotBulkModal.vue - Similar to Edit All Interface
```vue
<!-- components/Sparks/CommentBotBulkModal.vue -->
<template>
  <v-dialog v-model="dialog" max-width="900" persistent>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-robot</v-icon>
        Bulk Comment Bot
        <v-spacer />
        <v-btn icon variant="text" @click="closeModal">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      
      <v-card-text>
        <!-- Step 1: Row Selection -->
        <v-stepper v-model="currentStep" flat>
          <v-stepper-header>
            <v-stepper-item
              :complete="currentStep > 1"
              :value="1"
              title="Select Sparks"
            />
            <v-divider />
            <v-stepper-item
              :complete="currentStep > 2"
              :value="2"
              title="Configure Bot"
            />
            <v-divider />
            <v-stepper-item
              :value="3"
              title="Processing"
            />
          </v-stepper-header>
          
          <v-stepper-window>
            <!-- Step 1: Select Rows -->
            <v-stepper-window-item :value="1">
              <div class="mb-4">
                <v-alert type="info" variant="tonal" class="mb-4">
                  Select the sparks you want to bot. Only sparks with valid TikTok links can be processed.
                </v-alert>
                
                <!-- Quick Actions -->
                <div class="d-flex gap-2 mb-3">
                  <v-btn size="small" variant="tonal" @click="selectAll">
                    Select All Valid
                  </v-btn>
                  <v-btn size="small" variant="tonal" @click="selectNone">
                    Clear Selection
                  </v-btn>
                  <v-spacer />
                  <v-chip color="primary" variant="elevated">
                    {{ selectedSparks.length }} Selected
                  </v-chip>
                </div>
                
                <!-- Selection List -->
                <v-list density="compact" class="border rounded" style="max-height: 400px; overflow-y: auto;">
                  <v-list-item
                    v-for="spark in availableSparks"
                    :key="spark.id"
                    @click="toggleSelection(spark)"
                  >
                    <template v-slot:prepend>
                      <v-checkbox-btn
                        :model-value="isSelected(spark)"
                        :disabled="!spark.tiktok_link"
                      />
                    </template>
                    
                    <v-list-item-title>
                      {{ spark.name }}
                      <v-chip 
                        v-if="spark.bot_status && spark.bot_status !== 'not_botted'"
                        :color="getBotStatusColor(spark.bot_status)"
                        size="x-small"
                        class="ml-2"
                      >
                        {{ formatBotStatus(spark.bot_status) }}
                      </v-chip>
                    </v-list-item-title>
                    
                    <v-list-item-subtitle>
                      {{ spark.spark_code }}
                      <span v-if="!spark.tiktok_link" class="text-error">
                        - No TikTok Link
                      </span>
                    </v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </div>
              
              <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="closeModal">Cancel</v-btn>
                <v-btn 
                  color="primary" 
                  variant="elevated"
                  :disabled="selectedSparks.length === 0"
                  @click="currentStep = 2"
                >
                  Next: Configure Bot
                </v-btn>
              </v-card-actions>
            </v-stepper-window-item>
            
            <!-- Step 2: Configure Bot Settings -->
            <v-stepper-window-item :value="2">
              <div class="mb-4">
                <v-alert type="info" variant="tonal" class="mb-4">
                  Configure bot settings for {{ selectedSparks.length }} selected spark(s)
                </v-alert>
                
                <!-- Comment Group Selection -->
                <v-select
                  v-model="botSettings.comment_group_id"
                  :items="commentGroups"
                  item-title="name"
                  item-value="id"
                  label="Comment Group"
                  variant="outlined"
                  density="compact"
                  clearable
                  class="mb-4"
                  hint="Select a comment group to use for all selected sparks"
                  persistent-hint
                />
                
                <!-- Engagement Settings -->
                <v-row>
                  <v-col cols="6">
                    <v-text-field
                      v-model.number="botSettings.like_count"
                      type="number"
                      label="Likes per Spark"
                      variant="outlined"
                      density="compact"
                      :rules="[v => v >= 0 && v <= 3000 || 'Max 3,000']"
                      hint="0-3,000 likes"
                      persistent-hint
                    />
                  </v-col>
                  <v-col cols="6">
                    <v-text-field
                      v-model.number="botSettings.save_count"
                      type="number"
                      label="Saves per Spark"
                      variant="outlined"
                      density="compact"
                      :rules="[v => v >= 0 && v <= 500 || 'Max 500']"
                      hint="0-500 saves"
                      persistent-hint
                    />
                  </v-col>
                </v-row>
                
                <!-- Summary -->
                <v-card variant="tonal" class="mt-4">
                  <v-card-text>
                    <div class="text-subtitle-2 mb-2">Summary</div>
                    <v-list density="compact">
                      <v-list-item>
                        <v-list-item-title>Selected Sparks</v-list-item-title>
                        <template v-slot:append>
                          <span class="font-weight-bold">{{ selectedSparks.length }}</span>
                        </template>
                      </v-list-item>
                      <v-list-item v-if="botSettings.comment_group_id">
                        <v-list-item-title>Comment Group</v-list-item-title>
                        <template v-slot:append>
                          <v-chip size="small" color="primary">
                            {{ getCommentGroupName(botSettings.comment_group_id) }}
                          </v-chip>
                        </template>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-title>Total Engagement</v-list-item-title>
                        <template v-slot:append>
                          <span>
                            {{ selectedSparks.length * botSettings.like_count }} likes,
                            {{ selectedSparks.length * botSettings.save_count }} saves
                          </span>
                        </template>
                      </v-list-item>
                    </v-list>
                  </v-card-text>
                </v-card>
              </div>
              
              <v-card-actions>
                <v-btn variant="text" @click="currentStep = 1">Back</v-btn>
                <v-spacer />
                <v-btn variant="text" @click="closeModal">Cancel</v-btn>
                <v-btn 
                  color="success" 
                  variant="elevated"
                  :disabled="!isValidConfiguration"
                  @click="startBotProcess"
                >
                  <v-icon start>mdi-robot</v-icon>
                  Start Bot Process
                </v-btn>
              </v-card-actions>
            </v-stepper-window-item>
            
            <!-- Step 3: Processing -->
            <v-stepper-window-item :value="3">
              <div class="mb-4">
                <v-alert type="info" variant="tonal" class="mb-4">
                  Processing {{ processedCount }} of {{ selectedSparks.length }} sparks
                </v-alert>
                
                <!-- Progress Bar -->
                <v-progress-linear
                  :model-value="progressPercentage"
                  color="primary"
                  height="25"
                  rounded
                  class="mb-4"
                >
                  <template v-slot:default>
                    {{ Math.round(progressPercentage) }}%
                  </template>
                </v-progress-linear>
                
                <!-- Processing List -->
                <v-list density="compact" class="border rounded" style="max-height: 400px; overflow-y: auto;">
                  <v-list-item
                    v-for="spark in processingStatus"
                    :key="spark.id"
                  >
                    <template v-slot:prepend>
                      <v-icon :color="getProcessingIconColor(spark.status)">
                        {{ getProcessingIcon(spark.status) }}
                      </v-icon>
                    </template>
                    
                    <v-list-item-title>
                      {{ spark.name }}
                    </v-list-item-title>
                    
                    <template v-slot:append>
                      <v-chip
                        :color="getProcessingIconColor(spark.status)"
                        size="small"
                        variant="tonal"
                      >
                        <v-progress-circular
                          v-if="spark.status === 'processing'"
                          size="12"
                          width="2"
                          indeterminate
                          class="mr-1"
                        />
                        {{ spark.status }}
                      </v-chip>
                    </template>
                  </v-list-item>
                </v-list>
              </div>
              
              <v-card-actions>
                <v-spacer />
                <v-btn 
                  v-if="!isProcessing"
                  color="primary" 
                  variant="elevated"
                  @click="closeModal"
                >
                  Close
                </v-btn>
                <v-btn 
                  v-else
                  color="error" 
                  variant="tonal"
                  @click="cancelProcess"
                >
                  Cancel
                </v-btn>
              </v-card-actions>
            </v-stepper-window-item>
          </v-stepper-window>
        </v-stepper>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { commentBotApi } from '@/services/api';

const props = defineProps({
  modelValue: Boolean,
  sparks: Array,
  commentGroups: Array
});

const emit = defineEmits(['update:modelValue', 'refresh']);

// Dialog control
const dialog = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

// Stepper
const currentStep = ref(1);

// Selection state
const selectedSparks = ref([]);
const availableSparks = computed(() => props.sparks || []);

// Bot settings
const botSettings = ref({
  comment_group_id: null,
  like_count: 0,
  save_count: 0
});

// Processing state
const isProcessing = ref(false);
const processingStatus = ref([]);
const processedCount = ref(0);

// Helper functions for status display
const getBotStatusColor = (status) => {
  const colors = {
    'not_botted': 'grey',
    'queued': 'blue',
    'processing': 'orange',
    'completed': 'success',
    'failed': 'error'
  };
  return colors[status] || 'grey';
};

const formatBotStatus = (status) => {
  return status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Not Botted';
};

// Selection methods
const isSelected = (spark) => {
  return selectedSparks.value.some(s => s.id === spark.id);
};

const toggleSelection = (spark) => {
  if (!spark.tiktok_link) return;
  
  const index = selectedSparks.value.findIndex(s => s.id === spark.id);
  if (index >= 0) {
    selectedSparks.value.splice(index, 1);
  } else {
    selectedSparks.value.push(spark);
  }
};

const selectAll = () => {
  selectedSparks.value = availableSparks.value.filter(s => s.tiktok_link);
};

const selectNone = () => {
  selectedSparks.value = [];
};

// Configuration validation
const isValidConfiguration = computed(() => {
  return selectedSparks.value.length > 0 && 
    (botSettings.value.comment_group_id || 
     botSettings.value.like_count > 0 || 
     botSettings.value.save_count > 0);
});

const getCommentGroupName = (id) => {
  return props.commentGroups?.find(g => g.id === id)?.name || 'Unknown';
};

// Processing
const progressPercentage = computed(() => {
  if (selectedSparks.value.length === 0) return 0;
  return (processedCount.value / selectedSparks.value.length) * 100;
});

const getProcessingIcon = (status) => {
  const icons = {
    'queued': 'mdi-clock-outline',
    'processing': 'mdi-cog',
    'completed': 'mdi-check-circle',
    'failed': 'mdi-alert-circle'
  };
  return icons[status] || 'mdi-help-circle';
};

const getProcessingIconColor = (status) => {
  const colors = {
    'queued': 'grey',
    'processing': 'orange',
    'completed': 'success',
    'failed': 'error'
  };
  return colors[status] || 'grey';
};

// Extract Post ID from TikTok Link
const extractPostIdFromTikTokLink = (link) => {
  if (!link) return null;
  
  const patterns = [
    /\/video\/(\d{19})/,
    /@[\w.]+\/video\/(\d{19})/,
    /\/(\d{19})(?:\?|$)/
  ];
  
  for (const pattern of patterns) {
    const match = link.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
};

// Start bot process
const startBotProcess = async () => {
  currentStep.value = 3;
  isProcessing.value = true;
  processedCount.value = 0;
  
  // Initialize processing status
  processingStatus.value = selectedSparks.value.map(spark => ({
    id: spark.id,
    name: spark.name,
    status: 'queued'
  }));
  
  // Process each spark
  for (const spark of selectedSparks.value) {
    if (!isProcessing.value) break; // Check if cancelled
    
    // Update status to processing
    const statusItem = processingStatus.value.find(s => s.id === spark.id);
    if (statusItem) statusItem.status = 'processing';
    
    try {
      const postId = extractPostIdFromTikTokLink(spark.tiktok_link);
      
      if (!postId) {
        if (statusItem) statusItem.status = 'failed';
        processedCount.value++;
        continue;
      }
      
      // Create bot order
      await commentBotApi.createBulkOrder({
        spark_id: spark.id,
        post_id: postId,
        comment_group_id: botSettings.value.comment_group_id,
        like_count: Math.min(botSettings.value.like_count, 3000),
        save_count: Math.min(botSettings.value.save_count, 500)
      });
      
      if (statusItem) statusItem.status = 'completed';
    } catch (error) {
      console.error(`Failed to bot spark ${spark.name}:`, error);
      if (statusItem) statusItem.status = 'failed';
    }
    
    processedCount.value++;
    
    // Add small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  isProcessing.value = false;
  emit('refresh'); // Refresh the main table
};

// Cancel process
const cancelProcess = () => {
  isProcessing.value = false;
};

// Close modal
const closeModal = () => {
  if (isProcessing.value) {
    if (!confirm('Bot process is still running. Are you sure you want to close?')) {
      return;
    }
  }
  
  // Reset state
  currentStep.value = 1;
  selectedSparks.value = [];
  botSettings.value = {
    comment_group_id: null,
    like_count: 0,
    save_count: 0
  };
  processingStatus.value = [];
  processedCount.value = 0;
  isProcessing.value = false;
  
  dialog.value = false;
};
</script>
```

### 4. Integration in SparksView.vue

#### Add Comment Bot Modal Import and State
```javascript
// In SparksView.vue
import CommentBotBulkModal from './CommentBotBulkModal.vue';

// State management
const showCommentBotModal = ref(false);
const commentGroups = ref([]);
const hasCommentBotAccess = ref(false);

// Check subscription and fetch comment groups
onMounted(async () => {
  // Check user subscriptions
  const userSubscriptions = await getUserSubscriptions();
  hasCommentBotAccess.value = 
    userSubscriptions.includes('comment_bot') && 
    userSubscriptions.includes('dashboard');
  
  if (hasCommentBotAccess.value) {
    try {
      const response = await commentBotApi.getCommentGroups();
      commentGroups.value = response.data;
    } catch (error) {
      console.error('Failed to fetch comment groups:', error);
    }
  }
});

// Open Comment Bot Modal
const openCommentBotModal = () => {
  showCommentBotModal.value = true;
};

// Handle refresh after bot processing
const handleRefresh = async () => {
  await fetchSparks(); // Your existing fetch function
};
```

#### Add Comment Bot Modal to Template
```vue
<!-- In SparksView.vue template -->
<CommentBotBulkModal
  v-model="showCommentBotModal"
  :sparks="sparks"
  :comment-groups="commentGroups"
  @refresh="handleRefresh"
/>
```

## API Integration

### Required API Methods
```javascript
// In services/api.js
export const sparksApi = {
  updateSpark: (id, data) => api.put(`/sparks/${id}`, data),
  updateBotStatus: (sparkIds, status) => api.put('/sparks/bulk-bot-status', { spark_ids: sparkIds, status }),
  getBotStatus: (sparkIds) => api.post('/sparks/bot-status', { spark_ids: sparkIds })
};

export const commentBotApi = {
  getCommentGroups: () => api.get('/commentbot/comment-groups'),
  createBulkOrder: (order) => api.post('/commentbot/bulk-order', order),
  getOrderStatus: (orderId) => api.get(`/commentbot/order-status/${orderId}`),
  cancelOrder: (orderId) => api.delete(`/commentbot/order/${orderId}`)
};
```

### Real-time Status Updates
```javascript
// Polling for status updates during processing
const pollBotStatus = async (sparkIds, interval = 2000) => {
  const poll = setInterval(async () => {
    try {
      const response = await sparksApi.getBotStatus(sparkIds);
      
      // Update local spark status
      response.data.forEach(status => {
        const spark = sparks.value.find(s => s.id === status.spark_id);
        if (spark) {
          spark.bot_status = status.bot_status;
          spark.bot_order_id = status.bot_order_id;
          spark.last_bot_attempt = status.last_bot_attempt;
        }
      });
      
      // Stop polling if all are complete or failed
      const allDone = response.data.every(
        s => s.bot_status === 'completed' || s.bot_status === 'failed'
      );
      
      if (allDone) {
        clearInterval(poll);
      }
    } catch (error) {
      console.error('Failed to poll bot status:', error);
      clearInterval(poll);
    }
  }, interval);
  
  // Return function to stop polling
  return () => clearInterval(poll);
};
```

## Error Handling

```javascript
const errorHandler = {
  handleCommentGroupFetchError: (error) => {
    console.error('Failed to fetch comment groups:', error);
    showWarning('Comment groups unavailable. Feature disabled.');
    hasCommentBotAccess.value = false;
  },
  
  handleBotCreationError: (error, spark) => {
    const message = error.response?.data?.message || 'Failed to create bot order';
    showError(`Bot order failed for ${spark.name}: ${message}`);
  },
  
  handleSubscriptionError: () => {
    showError('Comment Bot subscription required for this feature');
  },
  
  handleInvalidTikTokLink: (spark) => {
    showWarning(`Invalid TikTok link for ${spark.name}. Skipping.`);
  }
};
```

## Performance Considerations

1. **Lazy Loading**: Only fetch comment groups when user has proper subscriptions
2. **Batch Processing**: Process multiple sparks in batches to avoid server overload
3. **Progress Indicators**: Show real-time progress during bulk operations
4. **Cancel Operations**: Allow users to cancel ongoing bulk operations
5. **Status Caching**: Cache bot status to reduce polling frequency

## Security Considerations

1. **Subscription Validation**: Always verify subscriptions server-side
2. **Rate Limiting**: Implement rate limiting for bot operations (e.g., max 100 per minute)
3. **Input Validation**: Validate TikTok post IDs format (19 digits)
4. **Permission Checks**: Ensure user owns the sparks being modified
5. **Audit Logging**: Log all bot operations for security and debugging

## Testing Checklist

- [ ] Comment Bot button appears only for subscribed users
- [ ] Bulk selection interface works correctly
- [ ] Invalid TikTok links are properly disabled
- [ ] Bot status updates in real-time
- [ ] Progress bar accurately reflects processing state
- [ ] Cancel operation stops processing
- [ ] Error messages display correctly
- [ ] Bot status persists after page refresh
- [ ] Processing status icons animate correctly
- [ ] Modal resets properly after closing

## Deployment Notes

1. Run database migrations to add bot status columns:
   - `bot_status` (VARCHAR)
   - `bot_order_id` (INT)
   - `last_bot_attempt` (TIMESTAMP)
2. Deploy API endpoints for bulk bot operations
3. Deploy frontend changes
4. Test with various subscription levels
5. Monitor server load during bulk operations
6. Set up error monitoring for failed bot operations

## Future Enhancements

1. **Queue Management**: Show position in queue when multiple users are botting
2. **Retry Failed**: Add option to retry failed bot operations
3. **Bot History**: Track history of all bot operations per spark
4. **Analytics Dashboard**: Show bot success rates and engagement metrics
5. **Smart Scheduling**: Automatically schedule bot operations for optimal times
6. **Template Presets**: Save common bot configurations as templates