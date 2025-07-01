<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  commentGroups: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  },
  remainingCredits: {
    type: Number,
    default: 0
  },
  isAdmin: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['create-order']);

// Form data
const newOrder = ref({
  post_ids: '', // For multiple post IDs input
  like_count: 0,
  save_count: 0,
  comment_group_id: null
});

// Order creation state
const isCreatingOrders = ref(false);
const orderCreationProgress = ref({
  current: 0,
  total: 0,
  message: ''
});

// Computed properties
const hasCommentGroups = computed(() => {
  return props.commentGroups && props.commentGroups.length > 0;
});

const likeCountError = computed(() => {
  if (newOrder.value.like_count > 3000) {
    return 'Maximum 3,000 likes allowed';
  }
  return '';
});

const saveCountError = computed(() => {
  if (newOrder.value.save_count > 500) {
    return 'Maximum 500 saves allowed';
  }
  return '';
});

const postIdError = computed(() => {
  const postIds = newOrder.value.post_ids
    .split(/[\n,]+/)
    .map(id => id.trim())
    .filter(id => id.length > 0);
  
  // No limit for admins
  if (!props.isAdmin && postIds.length > 10) {
    return `Maximum 10 post IDs allowed. You have entered ${postIds.length} post IDs.`;
  }
  return '';
});

const postIdCount = computed(() => {
  if (!newOrder.value.post_ids) return 0;
  
  const postIds = newOrder.value.post_ids
    .split(/[\n,]+/)
    .map(id => id.trim())
    .filter(id => id.length > 0);
  
  return postIds.length;
});

// Calculate required credits for the order - 1 credit per post ID
const requiredCredits = computed(() => {
  return postIdCount.value || 0;
});

const insufficientCreditsError = computed(() => {
  if (requiredCredits.value > props.remainingCredits) {
    return `Insufficient credits. Required: ${requiredCredits.value}, Available: ${props.remainingCredits}`;
  }
  return '';
});

const isFormValid = computed(() => {
  return newOrder.value.post_ids && 
    (newOrder.value.like_count > 0 || 
     newOrder.value.save_count > 0 || 
     newOrder.value.comment_group_id) &&
    !likeCountError.value &&
    !saveCountError.value &&
    !postIdError.value &&
    !insufficientCreditsError.value &&
    !isCreatingOrders.value;
});

const createOrder = async () => {
  if (isCreatingOrders.value) return;
  
  // Parse multiple post IDs from textarea
  const postIds = newOrder.value.post_ids
    .split(/[\n,]+/)
    .map(id => id.trim())
    .filter(id => id.length > 0);
  
  // Limit to 10 post IDs for non-admins
  const limitedPostIds = props.isAdmin ? postIds : postIds.slice(0, 10);
  
  // Set up progress tracking
  isCreatingOrders.value = true;
  orderCreationProgress.value = {
    current: 0,
    total: limitedPostIds.length,
    message: ''
  };
  
  // Create orders for each post ID with 60 second delay between each
  for (let i = 0; i < limitedPostIds.length; i++) {
    const postId = limitedPostIds[i];
    const orderData = {
      post_id: postId,
      like_count: Math.min(newOrder.value.like_count, 3000),
      save_count: Math.min(newOrder.value.save_count, 500),
      comment_group_id: newOrder.value.comment_group_id
    };
    
    orderCreationProgress.value.current = i + 1;
    orderCreationProgress.value.message = `Creating order ${i + 1} of ${limitedPostIds.length} for post ID: ${postId}`;
    
    console.log(`Creating order ${i + 1} of ${limitedPostIds.length} for post ID: ${postId}`);
    emit('create-order', orderData);
    
    // Wait 60 seconds before creating the next order (except for the last one)
    if (i < limitedPostIds.length - 1) {
      orderCreationProgress.value.message = `Waiting 60 seconds before creating next order...`;
      console.log(`Waiting 60 seconds before creating next order...`);
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  }
  
  // Reset form and progress after submission
  newOrder.value = {
    post_ids: '',
    like_count: 0,
    save_count: 0,
    comment_group_id: null
  };
  
  isCreatingOrders.value = false;
  orderCreationProgress.value = {
    current: 0,
    total: 0,
    message: ''
  };
};
</script>

<template>
  <v-card>
    <v-card-title>
      <v-icon class="me-2">mdi-plus-circle</v-icon>
      Create New Order
    </v-card-title>
    
    <v-card-text>
      <div v-if="isCreatingOrders" class="mb-4">
        <v-alert type="info" variant="outlined">
          <v-icon slot="prepend">mdi-progress-clock</v-icon>
          <div>{{ orderCreationProgress.message }}</div>
          <v-progress-linear
            v-if="orderCreationProgress.total > 0"
            :model-value="(orderCreationProgress.current / orderCreationProgress.total) * 100"
            color="primary"
            height="10"
            rounded
            class="mt-2"
          ></v-progress-linear>
          <div v-if="orderCreationProgress.total > 0" class="text-caption mt-1">
            Progress: {{ orderCreationProgress.current }} / {{ orderCreationProgress.total }} orders
          </div>
        </v-alert>
      </div>
      
      <v-form @submit.prevent="createOrder">
        <v-row>
          <v-col cols="12">
            <v-textarea
              v-model="newOrder.post_ids"
              :label="`TikTok Post IDs (${postIdCount}${!isAdmin ? '/10' : ''})`"
              placeholder="Enter TikTok post IDs (one per line or comma-separated)"
              variant="outlined"
              :disabled="isCreatingOrders"
              required
              :error-messages="postIdError || error"
              rows="3"
              auto-grow
              :hint="isAdmin ? 'You can enter multiple post IDs separated by commas or new lines (no limit for admins)' : 'You can enter multiple post IDs separated by commas or new lines (maximum 10 post IDs)'"
              persistent-hint
            ></v-textarea>
          </v-col>
          
          <v-col cols="12" md="4">
            <v-text-field
              v-model.number="newOrder.like_count"
              label="Number of Likes"
              type="number"
              min="0"
              :disabled="isCreatingOrders"
              variant="outlined"
              hint="Maximum: 3,000 likes"
              persistent-hint
              :error-messages="likeCountError"
            ></v-text-field>
          </v-col>
          
          <v-col cols="12" md="4">
            <v-text-field
              v-model.number="newOrder.save_count"
              label="Number of Saves"
              type="number"
              min="0"
              :disabled="isCreatingOrders"
              variant="outlined"
              hint="Maximum: 500 saves"
              persistent-hint
              :error-messages="saveCountError"
            ></v-text-field>
          </v-col>
          
          <v-col cols="12" md="4">
            <v-select
              v-model="newOrder.comment_group_id"
              label="Comment Group"
              :items="commentGroups"
              item-title="name"
              item-value="id"
              variant="outlined"
              :loading="loading"
              :disabled="loading || !hasCommentGroups || isCreatingOrders"
              :hint="!hasCommentGroups ? 'No comment groups available' : ''"
              persistent-hint
            ></v-select>
          </v-col>
        </v-row>
        
        <!-- Credits Summary -->
        <v-row v-if="postIdCount > 0 && (newOrder.like_count > 0 || newOrder.save_count > 0 || newOrder.comment_group_id)" class="mt-4">
          <v-col cols="12">
            <v-alert 
              :type="insufficientCreditsError ? 'error' : 'info'" 
              variant="tonal"
              density="compact"
            >
              <div class="d-flex justify-space-between align-center">
                <span>
                  <strong>Credits Required:</strong> {{ requiredCredits }}
                  <span class="text-caption ml-2">
                    ({{ postIdCount }} {{ postIdCount === 1 ? 'post' : 'posts' }} × 1 credit each)
                  </span>
                </span>
                <span>
                  <strong>Available:</strong> {{ props.remainingCredits }}
                </span>
              </div>
              <div v-if="insufficientCreditsError" class="mt-2">
                {{ insufficientCreditsError }}
              </div>
            </v-alert>
          </v-col>
        </v-row>
        
        <v-row class="mt-2">
          <v-col class="d-flex justify-end">
            <v-btn
              color="primary"
              type="submit"
              :loading="loading"
              :disabled="!isFormValid"
            >
              Create Order{{ postIdCount > 1 ? 's' : '' }}
            </v-btn>
          </v-col>
        </v-row>
      </v-form>
    </v-card-text>
  </v-card>
</template>