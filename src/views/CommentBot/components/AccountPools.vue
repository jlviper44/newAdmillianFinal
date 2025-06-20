<script setup>
import { ref } from 'vue';
import axios from 'axios';

const props = defineProps({
  accountPools: {
    type: Object,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  },
});

const emit = defineEmits(['refresh', 'check-accounts']);

// Format utilities
const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const refreshAccountPools = () => {
  emit('refresh');
};

const checkAccounts = (type) => {
  emit('check-accounts', type);
};
</script>

<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <div>Account Pools</div>
      <v-spacer></v-spacer>
      <v-btn 
        color="primary" 
        variant="outlined" 
        :loading="loading"
        @click="refreshAccountPools"
        size="small"
      >
        Refresh
      </v-btn>
    </v-card-title>
    
    <v-card-text>
      <v-row>
        <!-- Like Account Pool -->
        <v-col cols="12" md="6">
          <v-card variant="outlined">
            <v-card-title class="text-subtitle-1">
              <v-icon class="me-2">mdi-thumb-up</v-icon>
              Like Accounts
            </v-card-title>
            <v-card-text>
              <v-skeleton-loader v-if="loading" type="list-item"></v-skeleton-loader>
              <div v-else-if="accountPools.like">
                <div class="d-flex justify-space-between mb-2">
                  <span>Total accounts:</span>
                  <span class="font-weight-bold">{{ formatNumber(accountPools.like.total_accounts) }}</span>
                </div>
                <div class="d-flex justify-space-between mb-2">
                  <span>Status:</span>
                  <v-chip
                    size="small"
                    :color="accountPools.like.loaded ? 'success' : 'warning'"
                  >
                    {{ accountPools.like.loaded ? 'Loaded' : 'Not Loaded' }}
                  </v-chip>
                </div>
                <div class="d-flex justify-end mt-4">
                  <v-btn 
                    color="primary" 
                    variant="text" 
                    size="small"
                    @click="checkAccounts('like')"
                  >
                    Check Accounts
                  </v-btn>
                </div>
              </div>
              <div v-else-if="error" class="text-center">
                <v-alert type="error" variant="outlined" density="compact">
                  {{ error }}
                </v-alert>
              </div>
              <div v-else class="text-center">
                No data available
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <!-- Comment Account Pool -->
        <v-col cols="12" md="6">
          <v-card variant="outlined">
            <v-card-title class="text-subtitle-1">
              <v-icon class="me-2">mdi-comment-text</v-icon>
              Comment Accounts
            </v-card-title>
            <v-card-text>
              <v-skeleton-loader v-if="loading" type="list-item"></v-skeleton-loader>
              <div v-else-if="accountPools.comment">
                <div class="d-flex justify-space-between mb-2">
                  <span>Total accounts:</span>
                  <span class="font-weight-bold">{{ formatNumber(accountPools.comment.total_accounts) }}</span>
                </div>
                <div class="d-flex justify-space-between mb-2">
                  <span>Status:</span>
                  <v-chip
                    size="small"
                    :color="accountPools.comment.loaded ? 'success' : 'warning'"
                  >
                    {{ accountPools.comment.loaded ? 'Loaded' : 'Not Loaded' }}
                  </v-chip>
                </div>
                <div class="d-flex justify-end mt-4">
                  <v-btn 
                    color="primary" 
                    variant="text" 
                    size="small"
                    @click="checkAccounts('comment-global')"
                  >
                    Check Accounts
                  </v-btn>
                </div>
              </div>
              <div v-else-if="error" class="text-center">
                <v-alert type="error" variant="outlined" density="compact">
                  {{ error }}
                </v-alert>
              </div>
              <div v-else class="text-center">
                No data available
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>