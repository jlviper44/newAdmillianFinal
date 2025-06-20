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
  }
});

const emit = defineEmits(['create-order']);

// Form data
const newOrder = ref({
  post_id: '',
  post_ids: '', // For multiple post IDs input
  like_count: 0,
  save_count: 0,
  comment_group_id: null
});

// Parse multiple post IDs from comma or newline separated string
const parsePostIds = (input) => {
  if (!input) return [];
  
  // Split by commas or newlines, trim whitespace, and filter empty strings
  return input
    .split(/[,\n]+/)
    .map(id => id.trim())
    .filter(id => id.length > 0);
};

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

const parsedPostIds = computed(() => parsePostIds(newOrder.value.post_ids));

const postIdsError = computed(() => {
  const ids = parsedPostIds.value;
  if (ids.length === 0 && newOrder.value.post_ids.trim() !== '') {
    return 'Please enter valid post IDs';
  }
  return '';
});

// Calculate required credits for the order - 1 credit per post ID
const requiredCredits = computed(() => {
  return parsedPostIds.value.length || 0;
});

const insufficientCreditsError = computed(() => {
  if (requiredCredits.value > props.remainingCredits) {
    return `Insufficient credits. Required: ${requiredCredits.value}, Available: ${props.remainingCredits}`;
  }
  return '';
});

const isFormValid = computed(() => {
  return parsedPostIds.value.length > 0 && 
    (newOrder.value.like_count > 0 || 
     newOrder.value.save_count > 0 || 
     newOrder.value.comment_group_id) &&
    !likeCountError.value &&
    !saveCountError.value &&
    !postIdsError.value &&
    !insufficientCreditsError.value;
});

const createOrder = () => {
  const postIds = parsedPostIds.value;
  
  // Create orders for each post ID
  postIds.forEach(postId => {
    const orderData = {
      post_id: postId,
      like_count: Math.min(newOrder.value.like_count, 3000),
      save_count: Math.min(newOrder.value.save_count, 500),
      comment_group_id: newOrder.value.comment_group_id
    };
    
    emit('create-order', orderData);
  });
  
  // Reset form after submission
  newOrder.value = {
    post_id: '',
    post_ids: '',
    like_count: 0,
    save_count: 0,
    comment_group_id: null
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
      
      <v-form @submit.prevent="createOrder">
        <v-row>
          <v-col cols="12">
            <v-textarea
              v-model="newOrder.post_ids"
              label="TikTok Post IDs"
              placeholder="Enter TikTok post IDs (one per line or comma-separated)"
              variant="outlined"
              rows="3"
              auto-grow
              required
              :error-messages="postIdsError || error"
              :hint="`${parsedPostIds.length} post ID(s) entered`"
              persistent-hint
            ></v-textarea>
          </v-col>
          
          <v-col cols="12" md="4">
            <v-text-field
              v-model.number="newOrder.like_count"
              label="Number of Likes"
              type="number"
              min="0"
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
              :disabled="loading || !hasCommentGroups"
              :hint="!hasCommentGroups ? 'No comment groups available' : ''"
              persistent-hint
            ></v-select>
          </v-col>
        </v-row>
        
        <!-- Credits Summary -->
        <v-row v-if="parsedPostIds.length > 0 && (newOrder.like_count > 0 || newOrder.save_count > 0 || newOrder.comment_group_id)" class="mt-4">
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
                    ({{ parsedPostIds.length }} {{ parsedPostIds.length === 1 ? 'post' : 'posts' }} × 1 credit each)
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
              Create Order
            </v-btn>
          </v-col>
        </v-row>
      </v-form>
    </v-card-text>
  </v-card>
</template>