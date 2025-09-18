<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { commentBotApi, usersApi } from '@/services/api';
import { useAuth } from '@/composables/useAuth';
import AuthGuard from '@/components/AuthGuard.vue';

// Import components
import AccountPools from './components/AccountPools.vue';
import CommentGroups from './components/CommentGroups.vue';
import CreateOrder from './components/CreateOrder.vue';
import ActiveOrders from './components/ActiveOrders.vue';
import CommentGroupDetail from './components/CommentGroupDetail.vue';
import CreateCommentGroup from './components/CreateCommentGroup.vue';
import EditCommentGroup from './components/EditCommentGroup.vue';
import CommentBotCredits from './components/CommentBotCredits.vue';
import CommentBotLogs from './components/CommentBotLogs.vue';
import JobQueue from './components/JobQueue.vue';
import { formatDateTime, getUserTimezone } from '@/utils/dateFormatter';

// Get route
const route = useRoute();

// State management
const loading = ref({
  commentGroups: false,
  accountPools: false,
  createOrder: false,
  orderStatus: false,
  commentGroupDetail: false,
  createCommentGroup: false,
  updateCommentGroup: false,
  deleteCommentGroup: false,
  orders: false,
  credits: false
});

const error = ref({
  commentGroups: null,
  accountPools: null,
  createOrder: null,
  orderStatus: null,
  commentGroupDetail: null,
  createCommentGroup: null,
  updateCommentGroup: null,
  deleteCommentGroup: null,
  orders: null,
  credits: null
});

// Data stores
const commentGroups = ref([]);
const accountPools = ref({
  like: null,
  comment: null
});
const activeOrders = ref([]);
const orderProgress = ref({});
const selectedCommentGroup = ref(null);
const commentGroupDetail = ref(null);
const editingCommentGroup = ref(null);
const remainingCredits = ref(0);
const user = ref(null);

// UI state
const showCreateGroupDialog = ref(false);
const showEditGroupDialog = ref(false);
const showGroupDetailDialog = ref(false);
// Initialize currentTab from route query, default to 'orders' if not specified
const currentTab = ref(route.query.tab || 'orders');

// Tab titles mapping
const tabTitles = {
  orders: 'Orders',
  credits: 'Credits',
  logs: 'Logs (Admin)'
};

// Computed property for current tab title
const currentTabTitle = computed(() => {
  return tabTitles[currentTab.value] || 'Automated TikTok comments';
});

// Polling management
const pollingIntervals = ref({});

// Fetch functions
const fetchCommentGroups = async () => {
  loading.value.commentGroups = true;
  error.value.commentGroups = null;
  
  try {
    const data = await commentBotApi.getCommentGroups();
    commentGroups.value = data.commentGroups || [];
  } catch (err) {
    error.value.commentGroups = err.message || 'Failed to fetch comment groups';
  } finally {
    loading.value.commentGroups = false;
  }
};

const fetchOrders = async () => {
  loading.value.orders = true;
  error.value.orders = null;
  
  try {
    // Fetch orders with their saved progress from D1
    const data = await commentBotApi.getOrders();
    activeOrders.value = data.orders || [];
    
    // If orders include saved progress, load it
    if (data.orderProgress) {
      orderProgress.value = data.orderProgress;
      console.log('Loaded saved progress from D1:', data.orderProgress);
    }
    
    // Process each order
    for (const order of activeOrders.value) {
      // Check if we already have progress data for this order (either from D1 or memory)
      const hasProgressData = orderProgress.value[order.order_id] && 
        (orderProgress.value[order.order_id].like || 
         orderProgress.value[order.order_id].save || 
         orderProgress.value[order.order_id].comment);
      
      if (hasProgressData) {
        // Already have data from D1, don't fetch or poll
        console.log(`Order ${order.order_id} already has saved progress data, skipping API call`);
        continue;
      }
      
      // No saved data, need to check status and fetch if needed
      if (order.status !== 'completed' && order.status !== 'canceled' && order.status !== 'failed') {
        // Not completed yet, start polling
        console.log(`Starting polling for order ${order.order_id} (status: ${order.status})`);
        startPollingOrder(order.order_id);
      } else if (order.status === 'completed') {
        // Status is completed but no saved progress, fetch from API
        console.log(`Order ${order.order_id} is completed but has no saved progress, fetching from API...`);
        try {
          const statusData = await commentBotApi.getOrderStatus(order.order_id);
          
          if (statusData.progress) {
            let progressData = null;
            
            // Check if progress contains a nested progress field
            if (statusData.progress.progress && typeof statusData.progress.progress === 'object') {
              progressData = statusData.progress.progress;
              orderProgress.value[order.order_id] = statusData.progress.progress;
            } else if (statusData.progress.like || statusData.progress.save || statusData.progress.comment) {
              progressData = statusData.progress;
              orderProgress.value[order.order_id] = statusData.progress;
            }
            
            // Save the fetched progress to D1 for future use
            if (progressData) {
              console.log(`Got progress for ${order.order_id}, saving to D1...`);
              try {
                await commentBotApi.saveOrderProgress(order.order_id, {
                  status: order.status,
                  progress: progressData,
                  completed_at: order.completed_at || new Date().toISOString()
                });
                console.log(`Saved progress for ${order.order_id} to D1`);
              } catch (saveErr) {
                console.error(`Failed to save progress to D1:`, saveErr);
              }
            } else {
              console.warn(`No valid progress in response for completed order ${order.order_id}`);
            }
          }
        } catch (err) {
          console.error(`Failed to fetch progress for order ${order.order_id}:`, err);
        }
      }
    }
  } catch (err) {
    error.value.orders = err.message || 'Failed to fetch orders';
  } finally {
    loading.value.orders = false;
  }
};

const fetchAccountPools = async () => {
  loading.value.accountPools = true;
  error.value.accountPools = null;
  
  try {
    const data = await commentBotApi.getAccountPools();
    accountPools.value = data.pools || {};
  } catch (err) {
    error.value.accountPools = err.message || 'Failed to fetch account pools';
  } finally {
    loading.value.accountPools = false;
  }
};

const createCommentGroup = async (newGroup) => {
  loading.value.createCommentGroup = true;
  error.value.createCommentGroup = null;
  
  try {
    const data = await commentBotApi.createCommentGroup(newGroup);
    // Add to list and reset form
    commentGroups.value.unshift(data.commentGroup);
    showCreateGroupDialog.value = false;
  } catch (err) {
    error.value.createCommentGroup = err.message || 'Failed to create comment group';
  } finally {
    loading.value.createCommentGroup = false;
  }
};

// Store orders to be created
const pendingOrders = ref([]);
const isProcessingOrders = ref(false);
const processOrdersTimeout = ref(null);

const createOrder = async (newOrder) => {
  console.log('=== Creating new order ===', newOrder);
  
  // Add order to pending list
  pendingOrders.value.push(newOrder);
  
  // Clear existing timeout
  if (processOrdersTimeout.value) {
    clearTimeout(processOrdersTimeout.value);
  }
  
  // Set a small delay to batch orders together
  processOrdersTimeout.value = setTimeout(async () => {
    if (!isProcessingOrders.value && pendingOrders.value.length > 0) {
      isProcessingOrders.value = true;
      loading.value.createOrder = true;
      error.value.createOrder = null;
      
      try {
        console.log('Processing', pendingOrders.value.length, 'pending orders');
        
        // Calculate total credits needed - 1 credit per order
        const totalCreditsNeeded = pendingOrders.value.length;
        
        // Deduct all credits at once
        const creditResult = await usersApi.useCredits({ 
          credits: totalCreditsNeeded,
          productType: 'comment_bot'
        });
      
        console.log('Credits deduction result:', creditResult);
        
        if (!creditResult.success) {
          throw new Error('Failed to deduct credits');
        }
        
        // Create all orders (now returns jobs instead of orders)
        const orderPromises = pendingOrders.value.map(order => {
          console.log('Calling createOrder API for:', order);
          return commentBotApi.createOrder(order);
        });
        
        const results = await Promise.all(orderPromises);
        
        console.log('=== Create order API results ===', results);
        
        // Start polling for jobs instead of orders
        results.forEach(data => {
          console.log('Processing result:', data);
          if (data.job && data.job.job_id) {
            console.log('Starting to poll job:', data.job.job_id);
            startPollingJob(data.job.job_id);
          } else if (data.order && data.order.order_id) {
            // Fallback for old API response format
            console.log('Got old format order, polling order:', data.order.order_id);
            startPollingOrder(data.order.order_id);
          }
        });
        
        // Clear pending orders
        pendingOrders.value = [];
        
        // Refresh credits and orders
        await fetchCredits();
        await fetchOrders();
        
      } catch (err) {
        error.value.createOrder = err.message || 'Failed to create orders';
        // Clear pending orders on error
        pendingOrders.value = [];
        // Refresh credits in case of partial deduction
        await fetchCredits();
      } finally {
        loading.value.createOrder = false;
        isProcessingOrders.value = false;
      }
    }
  }, 100); // 100ms delay to batch orders
};

const checkAccounts = async (type) => {
  try {
    await commentBotApi.checkAccounts(type);
    fetchAccountPools();
  } catch (err) {
    error.value.accountPools = err.message || `Failed to check ${type} accounts`;
  }
};

// Fetch user's credit balance
const fetchCredits = async () => {
  loading.value.credits = true;
  error.value.credits = null;
  
  try {
    const data = await usersApi.checkAccess();
    
    // Store user data including admin status
    user.value = data.user;
    
    // Get Comment Bot specific credits
    const commentBotData = data.subscriptions?.comment_bot;
    remainingCredits.value = commentBotData?.totalCredits || 0;
    
  } catch (err) {
    error.value.credits = err.message || 'Failed to fetch credits';
    remainingCredits.value = 0;
  } finally {
    loading.value.credits = false;
  }
};

// Order status polling
const pollOrderStatus = async (orderId) => {
  try {
    const data = await commentBotApi.getOrderStatus(orderId);
    if (data.order) {
      const order = data.order;
      
      // Update order in activeOrders
      const index = activeOrders.value.findIndex(o => o.order_id === orderId);
      if (index !== -1) {
        activeOrders.value[index] = order;
      }
      
      // Update order progress - API returns { success, order, progress }
      let progressData = null;
      if (data.progress) {
        // Check if progress contains a nested progress field
        if (data.progress.progress && typeof data.progress.progress === 'object') {
          progressData = data.progress.progress;
          orderProgress.value[orderId] = data.progress.progress;
        } else if (data.progress.like || data.progress.save || data.progress.comment) {
          progressData = data.progress;
          orderProgress.value[orderId] = data.progress;
        }
      }
      
      // Check if order is completed and we have valid progress data
      if (order.status === 'completed' && progressData && 
          (progressData.like || progressData.save || progressData.comment)) {
        
        console.log(`Order ${orderId} completed with progress data, saving to D1...`);
        
        // Save the completed state to D1
        try {
          await commentBotApi.saveOrderProgress(orderId, {
            status: order.status,
            progress: progressData,
            completed_at: new Date().toISOString()
          });
          console.log(`Successfully saved progress for order ${orderId} to D1`);
        } catch (saveErr) {
          console.error(`Failed to save progress for order ${orderId} to D1:`, saveErr);
        }
        
        // Stop polling since we have the final data
        if (pollingIntervals.value[orderId]) {
          clearInterval(pollingIntervals.value[orderId]);
          delete pollingIntervals.value[orderId];
          console.log(`Stopped polling for completed order ${orderId}`);
        }
      } else if (['failed', 'canceled'].includes(order.status)) {
        // Stop polling for failed/canceled orders
        if (pollingIntervals.value[orderId]) {
          clearInterval(pollingIntervals.value[orderId]);
          delete pollingIntervals.value[orderId];
          console.log(`Stopped polling for ${order.status} order ${orderId}`);
        }
      }
    }
  } catch (err) {
    console.error(`Error polling order ${orderId}:`, err);
  }
};

const startPollingOrder = (orderId) => {
  // Clear existing interval if any
  if (pollingIntervals.value[orderId]) {
    clearInterval(pollingIntervals.value[orderId]);
  }
  // Then poll every 10 seconds
  pollingIntervals.value[orderId] = setInterval(() => {
    pollOrderStatus(orderId);
  }, 20000);
};

// Job polling functions for queue-based system
const startPollingJob = (jobId) => {
  // Clear existing interval if any
  if (pollingIntervals.value[`job_${jobId}`]) {
    clearInterval(pollingIntervals.value[`job_${jobId}`]);
  }
  
  // Poll immediately once
  pollJobStatus(jobId);
  
  // Then poll every 5 seconds for job status
  pollingIntervals.value[`job_${jobId}`] = setInterval(() => {
    pollJobStatus(jobId);
  }, 5000);
};

const pollJobStatus = async (jobId) => {
  try {
    const response = await commentBotApi.getJobStatus(jobId);
    
    if (response.job) {
      const job = response.job;
      
      // Update UI based on job status
      if (job.status === 'completed' && job.result) {
        // Job completed successfully, add the order to active orders
        const order = job.result;
        if (order.order_id) {
          // Stop polling the job
          if (pollingIntervals.value[`job_${jobId}`]) {
            clearInterval(pollingIntervals.value[`job_${jobId}`]);
            delete pollingIntervals.value[`job_${jobId}`];
          }
          
          // Start polling the actual order
          startPollingOrder(order.order_id);
          
          // Refresh orders to show the new order
          await fetchOrders();
        }
      } else if (job.status === 'failed' || job.status === 'cancelled') {
        // Stop polling on failure or cancellation
        if (pollingIntervals.value[`job_${jobId}`]) {
          clearInterval(pollingIntervals.value[`job_${jobId}`]);
          delete pollingIntervals.value[`job_${jobId}`];
        }
        
        // Show error message to user
        if (job.status === 'failed') {
          error.value.createOrder = `Job failed: ${job.error || 'Unknown error'}`;
        }
      }
      // For 'pending' or 'processing' status, continue polling
    }
  } catch (err) {
    console.error(`Error polling job ${jobId}:`, err);
  }
};

// Comment Group Detail functions
const fetchCommentGroupDetail = async (group) => {
  selectedCommentGroup.value = group;
  showGroupDetailDialog.value = true;
  loading.value.commentGroupDetail = true;
  error.value.commentGroupDetail = null;
  
  try {
    const data = await commentBotApi.getCommentGroupDetail(group.id);
    commentGroupDetail.value = data.commentGroup;
  } catch (err) {
    error.value.commentGroupDetail = err.message || 'Failed to fetch comment group details';
  } finally {
    loading.value.commentGroupDetail = false;
  }
};

const closeGroupDetailDialog = () => {
  showGroupDetailDialog.value = false;
  selectedCommentGroup.value = null;
  commentGroupDetail.value = null;
};

// Dialog controls
const openCreateGroupDialog = () => {
  showCreateGroupDialog.value = true;
};

const openEditGroupDialog = async (group) => {
  loading.value.commentGroupDetail = true;
  error.value.commentGroupDetail = null;
  
  try {
    // Fetch full details including legends
    const data = await commentBotApi.getCommentGroupDetail(group.id);
    editingCommentGroup.value = data.commentGroup;
    showEditGroupDialog.value = true;
  } catch (err) {
    error.value.commentGroupDetail = err.message || 'Failed to fetch comment group details';
  } finally {
    loading.value.commentGroupDetail = false;
  }
};

const closeEditGroupDialog = () => {
  showEditGroupDialog.value = false;
  editingCommentGroup.value = null;
};

const updateCommentGroup = async (updatedGroup) => {
  loading.value.updateCommentGroup = true;
  error.value.updateCommentGroup = null;
  
  try {
    await commentBotApi.updateCommentGroup(updatedGroup.id, updatedGroup);
    // Update in list
    const index = commentGroups.value.findIndex(g => g.id === updatedGroup.id);
    if (index !== -1) {
      commentGroups.value[index] = { ...commentGroups.value[index], ...updatedGroup };
    }
    closeEditGroupDialog();
  } catch (err) {
    error.value.updateCommentGroup = err.message || 'Failed to update comment group';
  } finally {
    loading.value.updateCommentGroup = false;
  }
};

const deleteCommentGroup = async () => {
  if (!editingCommentGroup.value) return;
  
  loading.value.deleteCommentGroup = true;
  error.value.deleteCommentGroup = null;
  
  try {
    await commentBotApi.deleteCommentGroup(editingCommentGroup.value.id);
    // Remove from list
    commentGroups.value = commentGroups.value.filter(g => g.id !== editingCommentGroup.value.id);
    closeEditGroupDialog();
  } catch (err) {
    error.value.deleteCommentGroup = err.message || 'Failed to delete comment group';
  } finally {
    loading.value.deleteCommentGroup = false;
  }
};

// Watch for route query changes
watch(() => route.query.tab, (newTab) => {
  const validTabs = ['orders', 'credits'];
  // Add logs tab if user is admin and not a virtual assistant
  if (user.value?.isAdmin && !user.value?.isVirtualAssistant) {
    validTabs.push('logs');
  }
  if (newTab && validTabs.includes(newTab)) {
    currentTab.value = newTab;
  }
});


// Lifecycle hooks
onMounted(() => {
  fetchCommentGroups();
  fetchOrders();
  fetchAccountPools();
  fetchCredits();
  
  // Set initial tab from query parameter
  const validTabs = ['orders', 'credits'];
  // Add logs tab if user is admin and not a virtual assistant
  if (user.value?.isAdmin && !user.value?.isVirtualAssistant) {
    validTabs.push('logs');
  }
  if (route.query.tab && validTabs.includes(route.query.tab)) {
    currentTab.value = route.query.tab;
  } else if (route.query.showCredits === 'true') {
    currentTab.value = 'credits';
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
});

onUnmounted(() => {
  // Clear all polling intervals
  Object.values(pollingIntervals.value).forEach(interval => {
    clearInterval(interval);
  });
  pollingIntervals.value = {};
});
</script>

<template>
  <AuthGuard>
    <v-container fluid :class="{ 'pa-2': $vuetify.display.smAndDown }">
      <!-- Mobile Header -->
      <v-row v-if="$vuetify.display.smAndDown">
        <v-col cols="12" class="pb-2">
          <div class="text-center">
            <h2 class="text-h6 font-weight-bold">Comment Bot</h2>
            <p class="text-caption text-grey-darken-1">{{ currentTabTitle }}</p>
          </div>
        </v-col>
      </v-row>

      <!-- Desktop Header -->
      <v-row v-else>
        <v-col cols="12">
          <div class="d-flex justify-space-between align-center mb-6">
            <div>
              <h1 class="text-h4 font-weight-bold">
                <v-icon icon="mdi-comment-multiple" size="x-large" class="mr-2"></v-icon>
                Comment Bot
              </h1>
              <p class="text-subtitle-1 text-grey-darken-1 mt-1">{{ currentTabTitle }}</p>
            </div>
          </div>
        </v-col>
      </v-row>

      <v-row>
        <!-- Content Area -->
        <v-col cols="12">
          <!-- Orders Tab -->
          <div v-if="currentTab === 'orders'">
                  <!-- Account Pools Info -->
                  <div class="mb-6" v-if="false">
                    <AccountPools 
                      :account-pools="accountPools" 
                      :loading="loading.accountPools"
                      :error="error.accountPools"
                      :has-edit-permission="true"
                      @refresh="fetchAccountPools"
                      @check-accounts="checkAccounts"
                    />
                  </div>

                  <!-- Comment Groups Section -->
                  <div class="mb-4">
                    <CommentGroups 
                      :comment-groups="commentGroups"
                      :loading="loading.commentGroups"
                      :error="error.commentGroups"
                      :has-edit-permission="true"
                      @refresh="fetchCommentGroups"
                      @create-group="openCreateGroupDialog"
                      @view-details="fetchCommentGroupDetail"
                      @edit-group="openEditGroupDialog"
                    />
                  </div>

                  <!-- Create Order Section -->
                  <v-card class="mb-6 elevation-1 rounded-lg">
                    <v-card-title class="d-flex align-center justify-space-between pb-2" :class="{ 'flex-wrap': $vuetify.display.smAndDown }">
                      <div class="d-flex align-center">
                        <v-icon icon="mdi-plus-box" color="primary" :size="$vuetify.display.smAndDown ? 'small' : 'default'" class="mr-2"></v-icon>
                        <span :class="$vuetify.display.smAndDown ? 'text-body-1' : 'text-h6'">Create Order</span>
                      </div>
                      <v-chip 
                        color="primary" 
                        variant="elevated"
                        :size="$vuetify.display.smAndDown ? 'small' : 'large'"
                        @click="fetchCredits"
                        :class="{ 'mt-2': $vuetify.display.smAndDown }"
                      >
                        <v-icon start size="small">mdi-wallet</v-icon>
                        <span :class="$vuetify.display.smAndDown ? 'text-caption' : 'font-weight-bold'">{{ remainingCredits.toLocaleString() }} credits</span>
                        <v-icon 
                          end 
                          size="x-small"
                          :class="{ 'mdi-spin': loading.credits }"
                        >
                          mdi-refresh
                        </v-icon>
                      </v-chip>
                    </v-card-title>
                    
                    <v-divider></v-divider>
                    
                    <v-card-text class="pa-4">
                      <CreateOrder 
                        :comment-groups="commentGroups"
                        :loading="loading.createOrder"
                        :error="error.createOrder"
                        :has-edit-permission="true"
                        :remaining-credits="remainingCredits"
                        :is-admin="user?.isAdmin || false"
                        @create-order="createOrder"
                      />
                    </v-card-text>
                  </v-card>

                  <!-- Job Queue Section -->
                  <JobQueue class="mb-6" />

                  <!-- Active Orders Section -->
                  <v-card class="elevation-1 rounded-lg">
                    <v-card-title class="d-flex align-center pb-2">
                      <v-icon icon="mdi-clock-outline" color="primary" class="mr-2"></v-icon>
                      <span class="text-h6">Active Orders</span>
                    </v-card-title>
                    
                    <v-divider></v-divider>
                    
                    <v-card-text class="pa-4">
                      <ActiveOrders
                        :orders="activeOrders"
                        :order-progress="orderProgress"
                        :loading="loading.orders"
                        :error="error.orders"
                        :has-edit-permission="true"
                        @refresh="fetchOrders"
                        @poll-status="startPollingOrder"
                      />
                    </v-card-text>
                  </v-card>
          </div>
          
          <!-- Credits Tab -->
          <div v-if="currentTab === 'credits'">
            <CommentBotCredits />
          </div>
          
          <!-- Logs Tab (Admin Only, not for Virtual Assistants) -->
          <div v-if="currentTab === 'logs' && user?.isAdmin && !user?.isVirtualAssistant">
            <CommentBotLogs />
          </div>
        </v-col>
      </v-row>

    <!-- Create Comment Group Dialog -->
    <v-dialog 
      v-model="showCreateGroupDialog" 
      :max-width="$vuetify.display.smAndDown ? '100%' : '800'" 
      :fullscreen="$vuetify.display.smAndDown"
      persistent
      :transition="$vuetify.display.smAndDown ? 'dialog-bottom-transition' : 'dialog-transition'"
    >
      <CreateCommentGroup 
        :loading="loading.createCommentGroup"
        :error="error.createCommentGroup"
        :existing-groups="commentGroups"
        @create="createCommentGroup"
        @close="showCreateGroupDialog = false"
      />
    </v-dialog>

    <!-- Edit Comment Group Dialog -->
    <v-dialog 
      v-model="showEditGroupDialog" 
      :max-width="$vuetify.display.smAndDown ? '100%' : '800'" 
      :fullscreen="$vuetify.display.smAndDown"
      persistent
      :transition="$vuetify.display.smAndDown ? 'dialog-bottom-transition' : 'dialog-transition'"
    >
      <EditCommentGroup 
        v-if="editingCommentGroup"
        :comment-group="editingCommentGroup"
        :loading="loading.updateCommentGroup"
        :error="error.updateCommentGroup"
        :delete-loading="loading.deleteCommentGroup"
        :delete-error="error.deleteCommentGroup"
        @update="updateCommentGroup"
        @delete="deleteCommentGroup"
        @cancel="closeEditGroupDialog"
      />
    </v-dialog>

    <!-- Comment Group Detail Dialog -->
    <v-dialog 
      v-model="showGroupDetailDialog" 
      :max-width="$vuetify.display.smAndDown ? '100%' : '800'" 
      :fullscreen="$vuetify.display.smAndDown"
      :transition="$vuetify.display.smAndDown ? 'dialog-bottom-transition' : 'dialog-transition'"
    >
      <v-card v-if="loading.commentGroupDetail">
        <v-card-text class="text-center pa-6">
          <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
          <div class="mt-4">Loading comment group details...</div>
        </v-card-text>
      </v-card>
      <v-card v-else-if="error.commentGroupDetail">
        <v-card-title>Error</v-card-title>
        <v-card-text>
          <v-alert type="error" variant="outlined">
            {{ error.commentGroupDetail }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="closeGroupDetailDialog">Close</v-btn>
        </v-card-actions>
      </v-card>
      <CommentGroupDetail 
        v-else-if="commentGroupDetail"
        :comment-group="commentGroupDetail"
        @close="closeGroupDetailDialog"
      />
    </v-dialog>
    </v-container>
  </AuthGuard>
</template>

<style scoped>
/* Mobile optimizations */
@media (max-width: 600px) {
  .v-card {
    margin-bottom: 12px !important;
  }
  
  .v-card-title {
    padding: 12px !important;
    font-size: 1rem !important;
  }
  
  .v-card-text {
    padding: 12px !important;
  }
  
  .text-h6 {
    font-size: 1rem !important;
  }
  
  .v-chip {
    height: auto !important;
    padding: 4px 8px !important;
  }
}

/* Tab Content */
.v-tab-content {
  min-height: 400px;
}

@media (max-width: 768px) {
  .v-tab-content {
    min-height: 300px;
  }
}
</style>

<style scoped>
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.mdi-spin {
  animation: spin 1s linear infinite;
}

.tab-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.v-theme--dark .tab-header {
  border-bottom-color: rgba(255, 255, 255, 0.12);
}

.tab-content {
  min-height: 500px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .tab-content {
    min-height: 400px;
  }
}
</style>