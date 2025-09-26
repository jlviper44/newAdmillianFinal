<template>
  <div class="sparks-tab">
    <!-- Header with stats -->
    <v-row class="mb-4">
      <v-col cols="12" md="3">
        <v-card variant="outlined">
          <v-card-text class="text-center">
            <div class="text-h4 mb-2">{{ sparks.length }}</div>
            <div class="text-subtitle-2">Total Sparks</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card variant="outlined">
          <v-card-text class="text-center">
            <div class="text-h4 mb-2">{{ activeSparks }}</div>
            <div class="text-subtitle-2">Active Sparks</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card variant="outlined">
          <v-card-text class="text-center">
            <div class="text-h4 mb-2">{{ thisMonthSparks }}</div>
            <div class="text-subtitle-2">This Month</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card variant="outlined">
          <v-card-text class="text-center">
            <div class="text-h4 mb-2">{{ uniqueCreators }}</div>
            <div class="text-subtitle-2">Creators</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Simple controls -->
    <v-card class="mb-4">
      <v-card-text>
        <v-row align="center">
          <v-col cols="12" md="4">
            <v-text-field
              v-model="searchQuery"
              prepend-inner-icon="mdi-magnify"
              label="Search sparks..."
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-switch
              v-model="showThumbnails"
              label="Show thumbnails"
              hide-details
            />
          </v-col>
          <v-spacer />
          <v-col cols="auto">
            <v-btn
              prepend-icon="mdi-plus"
              color="secondary"
              variant="elevated"
              @click="addSpark"
              class="mr-2"
            >
              Add Spark
            </v-btn>
            <v-btn
              prepend-icon="mdi-table-large"
              variant="outlined"
              @click="openSpreadsheetView"
              class="mr-2"
            >
              Spreadsheet View
            </v-btn>
            <v-btn
              prepend-icon="mdi-refresh"
              variant="outlined"
              @click="loadSparks"
            >
              Refresh
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Data table -->
    <SparksDataTable
      :sparks="filteredSparks"
      :is-loading="isLoading"
      :show-thumbnails="showThumbnails"
      :items-per-page="25"
    />

    <!-- Spreadsheet View Dialog -->
    <SparksSpreadsheetView
      v-model="showSpreadsheetView"
      :sparks="filteredSparks"
      :virtual-assistants="virtualAssistants"
      :has-comment-bot-access="hasCommentBotAccess"
      :user-credits="userCredits"
      :comment-groups="commentGroups"
      @save-changes="saveSpreadsheetChanges"
      @delete-sparks="deleteSparksBatch"
    />

    <!-- Bulk Add Spark Modal -->
    <SparkFormModal
      v-model="showSparkModal"
      :virtual-assistants="virtualAssistants"
      :comment-groups="commentGroups"
      :has-comment-bot-access="hasCommentBotAccess"
      :user-credits="userCredits"
      :is-loading="isLoading"
      @save="saveSpark"
    />

    <!-- Success Snackbar -->
    <v-snackbar
      v-model="showSnackbar"
      :color="snackbarColor"
      :timeout="4000"
      location="top"
    >
      {{ snackbarMessage }}
      <template v-slot:actions>
        <v-btn
          color="white"
          variant="text"
          @click="showSnackbar = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useSparks, onSparkEvent } from './composables/useSparks.js';
import { usersApi, commentBotApi } from '@/services/api';
import { useAuth } from '@/composables/useAuth';
import SparksDataTable from './components/SparksDataTable.vue';
import SparksSpreadsheetView from './components/SparksSpreadsheetView.vue';
import SparkFormModal from './modals/SparkFormModal.vue';

// Use the same composable as the old implementation
const {
  sparks,
  isLoading,
  searchQuery,
  showThumbnails,
  filteredSparks,
  fetchSparks,
  createSpark,
  bulkUpdateSparks,
  deleteSpark
} = useSparks();

// Auth composable
const { user, subscriptions, isAssistingUser } = useAuth();

// Load sparks data (same method as old implementation)
const loadSparks = async () => {
  try {
    await fetchSparks();
  } catch (error) {
    console.error('Failed to load sparks:', error);
  }
};

// Computed properties for stats
const activeSparks = computed(() =>
  sparks.value.filter(spark => spark.status === 'active').length
);

const thisMonthSparks = computed(() => {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  return sparks.value.filter(spark => {
    if (!spark.created_at) return false;
    const created = new Date(spark.created_at);
    return created.getMonth() === thisMonth && created.getFullYear() === thisYear;
  }).length;
});

const uniqueCreators = computed(() => {
  const creators = new Set();
  sparks.value.forEach(spark => {
    if (spark.creator) creators.add(spark.creator);
  });
  return creators.size;
});

// Spreadsheet view state
const showSpreadsheetView = ref(false);

// Add spark modal state
const showSparkModal = ref(false);

// Snackbar state
const showSnackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

// Virtual Assistants data
const virtualAssistants = ref([]);
const commentGroups = ref([]);
const hasCommentBotAccess = ref(false);
const userCredits = ref(0);

// Fetch credits from server
const fetchCredits = async () => {
  try {
    // Use existing user and subscription data instead of API call
    const userData = user.value;
    const data = { user: userData, subscriptions: subscriptions.value };

    // Check if user is admin (admins get unlimited credits)
    if (userData?.isAdmin && !userData?.isVirtualAssistant) {
      userCredits.value = 999999; // Unlimited for admins
      hasCommentBotAccess.value = true;
      console.log('Admin user detected, unlimited credits granted');
    } else {
      // Get Comment Bot specific credits for regular users
      const commentBotData = data.subscriptions?.comment_bot;
      userCredits.value = commentBotData?.totalCredits || 0;
      hasCommentBotAccess.value = (userCredits.value > 0);
      console.log('Regular user credits:', userCredits.value);
    }

  } catch (error) {
    console.error('Failed to fetch user credits:', error);
    userCredits.value = 0;
    hasCommentBotAccess.value = false;
  }
};

// Fetch virtual assistants from API (same as old implementation)
const fetchVirtualAssistants = async () => {
  try {
    const response = await usersApi.getVirtualAssistants();

    // The API returns { assistants: [...] }
    if (response && response.assistants && Array.isArray(response.assistants)) {
      virtualAssistants.value = response.assistants
        .filter(va => va.status === 'active') // Only show active VAs
        .map(va => ({
          title: va.email || 'Unknown VA',
          value: va.email || ''
        }));

      console.log('Processed VAs:', virtualAssistants.value); // Debug log

      // Add main user's email if they're logged in (not a VA)
      if (!isAssistingUser.value && user.value?.email) {
        virtualAssistants.value.push({
          title: user.value.email,
          value: user.value.email
        });
      }

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

// Fetch comment groups from API
const fetchCommentGroups = async () => {
  try {
    const data = await commentBotApi.getCommentGroups();
    console.log('Comment groups response:', data); // Debug log

    if (data && data.commentGroups && Array.isArray(data.commentGroups)) {
      commentGroups.value = data.commentGroups;
    } else {
      console.log('No comment groups found in response');
      commentGroups.value = [];
    }
  } catch (error) {
    console.error('Failed to fetch comment groups:', error);
    commentGroups.value = [];
  }
};

// Spreadsheet view function
const openSpreadsheetView = () => {
  showSpreadsheetView.value = true;
};

// Handle spreadsheet changes
const saveSpreadsheetChanges = async (changes) => {
  try {
    if (changes && changes.length > 0) {
      await bulkUpdateSparks(changes);
      // Refresh the data after successful save
      await loadSparks();
    }
  } catch (error) {
    console.error('Failed to save spreadsheet changes:', error);
    // TODO: Show error message to user
  }
};

// Handle bulk delete from spreadsheet
const deleteSparksBatch = async (deleteRequests) => {
  try {
    console.log('Deleting sparks batch:', deleteRequests);

    // Delete each spark individually
    const deletePromises = deleteRequests.map(request =>
      deleteSpark(request.id)
    );

    await Promise.all(deletePromises);

    // Refresh the data after successful deletion
    await loadSparks();

    console.log(`Successfully deleted ${deleteRequests.length} spark(s)`);
  } catch (error) {
    console.error('Failed to delete sparks:', error);
    // TODO: Show error message to user
    // Refresh data to restore UI consistency
    await loadSparks();
  }
};

// Add spark function
const addSpark = () => {
  showSparkModal.value = true;
};

// Save spark function (same as old implementation)
const saveSpark = async (bulkData) => {
  try {
    console.log('Bulk data received:', bulkData);
    const { sparks: sparksToCreate, enableCommentBot, commentBotSettings } = bulkData;

    // Create each spark individually (same as old implementation)
    for (const sparkData of sparksToCreate) {
      console.log('Creating spark with data:', sparkData);
      await createSpark(sparkData);
    }

    console.log(`Successfully created ${sparksToCreate.length} sparks`);
    await loadSparks();

    // Show success message for bulk creation
    if (sparksToCreate.length > 1) {
      snackbarMessage.value = `Successfully added ${sparksToCreate.length} sparks`;
      snackbarColor.value = 'success';
      showSnackbar.value = true;
    }

    if (enableCommentBot && commentBotSettings) {
      console.log('Processing comment bot for newly created sparks...');
      await processCommentBotForSparks(sparksToCreate, commentBotSettings);
    }

    showSparkModal.value = false;
  } catch (error) {
    console.error('Failed to create sparks:', error);
  }
};

// Process comment bot for newly created sparks
const processCommentBotForSparks = async (sparksToCreate, commentBotSettings) => {
  try {
    console.log('Processing comment bot for sparks:', sparksToCreate);
    console.log('Comment bot settings:', commentBotSettings);

    let processedCount = 0;
    let failedCount = 0;

    // Find the created sparks in the current sparks list
    for (const sparkData of sparksToCreate) {
      try {
        // Find the created spark by matching tiktok_link and spark_code
        const createdSpark = sparks.value.find(s =>
          s.tiktok_link === sparkData.tiktokLink &&
          s.spark_code === sparkData.sparkCode
        );

        if (!createdSpark) {
          console.log('Could not find created spark for comment bot processing:', sparkData);
          failedCount++;
          continue;
        }

        // Extract post ID from TikTok link
        console.log('Processing spark:', createdSpark.id, 'TikTok link:', createdSpark.tiktok_link);
        const postId = extractPostIdFromTikTokLink(createdSpark.tiktok_link);
        console.log('Extracted post ID:', postId);

        if (!postId) {
          console.log('Failed to extract post ID from link:', createdSpark.tiktok_link);
          failedCount++;
          continue;
        }

        // Create comment bot order
        const orderData = {
          post_id: postId,
          comment_group_id: commentBotSettings.commentGroupId,
          like_count: Math.min(commentBotSettings.likeCount || 0, 3000),
          save_count: Math.min(commentBotSettings.saveCount || 0, 500)
        };

        console.log(`Creating comment bot order for spark ${createdSpark.id}:`, orderData);

        try {
          const response = await commentBotApi.createOrder(orderData);
          console.log(`Comment bot order created for spark ${createdSpark.id}:`, response);

          // Update the spark with bot status and post ID
          const updateData = {
            bot_status: 'processing',
            bot_post_id: postId
          };

          if (response.order_id) {
            updateData.comment_bot_order_id = response.order_id;
          }

          // Update via bulk update
          await bulkUpdateSparks([{
            id: createdSpark.id,
            data: updateData
          }]);

          processedCount++;
          console.log(`Successfully processed comment bot for spark ${createdSpark.id}`);

        } catch (orderError) {
          console.error(`Failed to create comment bot order for spark ${createdSpark.id}:`, orderError);
          failedCount++;
        }

      } catch (error) {
        console.error(`Error processing spark for comment bot:`, error);
        failedCount++;
      }
    }

    console.log(`Comment bot processing completed: ${processedCount} processed, ${failedCount} failed`);

    // Refresh data to show updated bot statuses
    await loadSparks();

  } catch (error) {
    console.error('Comment bot processing failed:', error);
  }
};

// Extract post ID from TikTok link (same function as spreadsheet view)
const extractPostIdFromTikTokLink = (link) => {
  if (!link) {
    console.log('No TikTok link provided');
    return null;
  }

  console.log('Extracting post ID from link:', link);

  const patterns = [
    /\/video\/(\d+)/i,
    /\/photo\/(\d+)/i,
    /\/v\/(\d+)/i,
    /tiktok\.com\/.*\/video\/(\d+)/i,
    /tiktok\.com\/.*\/photo\/(\d+)/i,
    /vm\.tiktok\.com\/(\w+)/i,
    /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i,
    /tiktok\.com\/@[\w.-]+\/photo\/(\d+)/i,
    /tiktok\.com\/t\/(\w+)/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = link.match(pattern);
    if (match) {
      console.log(`Pattern ${i + 1} matched:`, pattern, 'Result:', match[1]);
      return match[1];
    }
  }

  console.log('No patterns matched for link:', link);
  return null;
};

// Bot status polling
let botStatusInterval = null;

const refreshBotStatuses = async () => {
  console.log('🔄 Polling bot statuses...');

  // Debug: Show all sparks with bot-related fields
  const allBotSparks = sparks.value.filter(s => s.bot_status || s.bot_post_id);
  console.log(`All sparks with bot fields (${allBotSparks.length}):`, allBotSparks.map(s => ({
    id: s.id,
    bot_post_id: s.bot_post_id,
    bot_status: s.bot_status
  })));

  const processingSparks = sparks.value.filter(s =>
    s.bot_post_id &&
    (s.bot_status === 'queued' || s.bot_status === 'processing' || s.bot_status === 'pending')
  );

  console.log(`Found ${processingSparks.length} processing sparks:`, processingSparks.map(s => ({
    id: s.id,
    bot_post_id: s.bot_post_id,
    bot_status: s.bot_status
  })));

  if (processingSparks.length === 0) {
    console.log('No processing sparks found, skipping poll');
    return; // No sparks to check
  }

  try {
    // Get all active orders from comment bot
    const ordersResponse = await commentBotApi.getOrders();

    if (!ordersResponse || !ordersResponse.orders) {
      return;
    }

    // Create a map of post_id to order status
    const orderStatusMap = {};
    ordersResponse.orders.forEach(order => {
      if (order.post_id) {
        orderStatusMap[order.post_id] = order.status || 'processing';
      }
    });

    // Check if any sparks need status updates
    let hasUpdates = false;
    const updates = [];

    for (const spark of processingSparks) {
      let newStatus = spark.bot_status;

      if (orderStatusMap[spark.bot_post_id]) {
        // Found matching order - update to its status
        newStatus = orderStatusMap[spark.bot_post_id];
      } else {
        // No matching order found - mark as completed
        newStatus = 'completed';
      }

      // Only update if status changed
      if (newStatus !== spark.bot_status) {
        hasUpdates = true;
        updates.push({
          id: spark.id,
          data: {
            bot_status: newStatus
          }
        });
      }
    }

    // Apply updates using bulk update
    if (hasUpdates && updates.length > 0) {
      try {
        await bulkUpdateSparks(updates);
        // Refresh the data after successful update
        await loadSparks();
      } catch (error) {
        console.error('Failed to update bot statuses:', error);
      }
    }

  } catch (error) {
    console.error('Failed to refresh bot statuses:', error);
  }
};

// Load data on mount
onMounted(async () => {
  // Fetch VAs, credits, comment groups, and sparks
  await fetchVirtualAssistants();
  await fetchCredits();
  await fetchCommentGroups();
  await loadSparks();

  // Set up success notification for spark creation
  onSparkEvent('sparkCreatedSuccess', (sparkData) => {
    snackbarMessage.value = `Successfully added spark: ${sparkData.name}`;
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  });

  // Start bot status polling
  console.log('🚀 Starting bot status polling every 10 seconds');
  // Run once immediately for testing
  await refreshBotStatuses();
  botStatusInterval = setInterval(refreshBotStatuses, 10000);
});

// Cleanup on unmount
onUnmounted(() => {
  console.log('🛑 Cleaning up bot status polling');
  if (botStatusInterval) {
    clearInterval(botStatusInterval);
  }
});
</script>

<style scoped>
.sparks-tab {
  /* Add your custom styles here */
}
</style>