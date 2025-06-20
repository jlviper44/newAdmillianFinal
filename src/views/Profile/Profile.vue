<template>
  <AuthGuard>
    <v-container fluid>
      <v-row>
        <v-col cols="12">
          <h1 class="text-h5 font-weight-bold mb-3">Profile</h1>
        </v-col>
      </v-row>

      <v-row>
        <!-- User Information Card -->
        <v-col cols="12">
          <v-card density="compact">
            <v-card-title class="d-flex align-center pa-3">
              <v-icon class="mr-2" size="small">mdi-account-circle</v-icon>
              <span class="text-h6">User Information</span>
            </v-card-title>
            <v-card-text class="pa-3">
              <v-row v-if="user" no-gutters>
                <v-col cols="12" class="d-flex align-center mb-3">
                  <v-avatar size="60" class="mr-3">
                    <v-img v-if="user.image" :src="user.image" :alt="user.name"></v-img>
                    <v-icon v-else size="60">mdi-account-circle</v-icon>
                  </v-avatar>
                  <div class="flex-grow-1">
                    <div class="text-subtitle-1 font-weight-medium">{{ user.name || 'Not set' }}</div>
                    <div class="text-body-2 text-grey">{{ user.email || 'Not set' }}</div>
                    <div class="text-caption text-grey">ID: {{ user.id }}</div>
                  </div>
                  <v-btn
                    color="error"
                    variant="outlined"
                    size="small"
                    @click="confirmSignOut"
                  >
                    <v-icon start size="small">mdi-logout</v-icon>
                    Sign Out
                  </v-btn>
                </v-col>
              </v-row>
              <v-row v-else no-gutters>
                <v-col cols="12" class="text-center py-3">
                  <v-progress-circular indeterminate color="primary" size="24"></v-progress-circular>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>

      </v-row>

      <!-- Subscription Cards -->
      <v-row class="mt-3" v-if="subscriptions">
        <!-- Comment Bot Subscription Card -->
        <v-col cols="12">
          <v-card 
            :variant="subscriptions.comment_bot?.isActive ? 'elevated' : 'outlined'"
            :elevation="subscriptions.comment_bot?.isActive ? 2 : 0"
          >
            <v-card-title class="d-flex align-center pa-4">
              <v-icon class="mr-3" color="primary">mdi-comment-multiple</v-icon>
              <div>
                <div class="text-h6">Comment Bot</div>
                <div class="text-caption text-grey">Automated social media engagement</div>
              </div>
            </v-card-title>
            
            <v-card-text class="pa-4 pt-0">
              <p class="text-body-2 mb-4">
                Boost your social media presence with intelligent automated comments. Perfect for Instagram, TikTok, and other platforms.
              </p>
              
              <!-- Active subscription info -->
              <v-alert 
                v-if="subscriptions.comment_bot?.isActive"
                color="success"
                variant="tonal"
                density="compact"
                class="mb-0"
              >
                <div class="d-flex align-center justify-space-between">
                  <div>
                    <div class="text-subtitle-2">Active Subscription</div>
                    <div class="text-caption">
                      {{ subscriptions.comment_bot.expiresIn }} days remaining • Renews {{ formatDate(subscriptions.comment_bot.endDate) }}
                    </div>
                  </div>
                  <v-icon>mdi-check-circle</v-icon>
                </div>
              </v-alert>
              
              <!-- Inactive subscription -->
              <div v-else>
                <v-list density="compact" class="pa-0 mb-3">
                  <v-list-item class="pa-0">
                    <template v-slot:prepend>
                      <v-icon size="small" color="primary">mdi-check</v-icon>
                    </template>
                    <v-list-item-title class="text-body-2">AI-powered comment generation</v-list-item-title>
                  </v-list-item>
                  <v-list-item class="pa-0">
                    <template v-slot:prepend>
                      <v-icon size="small" color="primary">mdi-check</v-icon>
                    </template>
                    <v-list-item-title class="text-body-2">Multi-platform support</v-list-item-title>
                  </v-list-item>
                  <v-list-item class="pa-0">
                    <template v-slot:prepend>
                      <v-icon size="small" color="primary">mdi-check</v-icon>
                    </template>
                    <v-list-item-title class="text-body-2">Customizable engagement strategies</v-list-item-title>
                  </v-list-item>
                </v-list>
                
                <v-btn 
                  color="primary"
                  block
                  @click="openCheckout('comment_bot')"
                  :disabled="!subscriptions.comment_bot?.checkoutLink"
                >
                  Get Started
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- BC Gen Subscription Card -->
        <v-col cols="12">
          <v-card 
            :variant="subscriptions.bc_gen?.isActive ? 'elevated' : 'outlined'"
            :elevation="subscriptions.bc_gen?.isActive ? 2 : 0"
          >
            <v-card-title class="d-flex align-center pa-4">
              <v-icon class="mr-3" color="primary">mdi-barcode</v-icon>
              <div>
                <div class="text-h6">BC Gen</div>
                <div class="text-caption text-grey">Business card generator</div>
              </div>
            </v-card-title>
            
            <v-card-text class="pa-4 pt-0">
              <p class="text-body-2 mb-4">
                Create professional digital business cards instantly. Share your contact information with style and ease.
              </p>
              
              <!-- Active subscription info -->
              <v-alert 
                v-if="subscriptions.bc_gen?.isActive"
                color="success"
                variant="tonal"
                density="compact"
                class="mb-0"
              >
                <div class="d-flex align-center justify-space-between">
                  <div>
                    <div class="text-subtitle-2">Active Subscription</div>
                    <div class="text-caption">
                      {{ subscriptions.bc_gen.expiresIn }} days remaining • Renews {{ formatDate(subscriptions.bc_gen.endDate) }}
                    </div>
                  </div>
                  <v-icon>mdi-check-circle</v-icon>
                </div>
              </v-alert>
              
              <!-- Inactive subscription -->
              <div v-else>
                <v-list density="compact" class="pa-0 mb-3">
                  <v-list-item class="pa-0">
                    <template v-slot:prepend>
                      <v-icon size="small" color="primary">mdi-check</v-icon>
                    </template>
                    <v-list-item-title class="text-body-2">Unlimited business card designs</v-list-item-title>
                  </v-list-item>
                  <v-list-item class="pa-0">
                    <template v-slot:prepend>
                      <v-icon size="small" color="primary">mdi-check</v-icon>
                    </template>
                    <v-list-item-title class="text-body-2">QR code integration</v-list-item-title>
                  </v-list-item>
                  <v-list-item class="pa-0">
                    <template v-slot:prepend>
                      <v-icon size="small" color="primary">mdi-check</v-icon>
                    </template>
                    <v-list-item-title class="text-body-2">Real-time analytics</v-list-item-title>
                  </v-list-item>
                </v-list>
                
                <v-btn 
                  color="primary"
                  block
                  @click="openCheckout('bc_gen')"
                  :disabled="!subscriptions.bc_gen?.checkoutLink"
                >
                  Get Started
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <!-- Sign Out Confirmation Dialog -->
    <v-dialog v-model="signOutDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h5">
          Confirm Sign Out
        </v-card-title>
        <v-card-text>
          Are you sure you want to sign out of your account?
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="signOutDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            variant="text"
            @click="handleSignOut"
          >
            Sign Out
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </AuthGuard>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import AuthGuard from '@/components/AuthGuard.vue';

const router = useRouter();
const { user, isAuthenticated, subscriptions, signOut, checkAccess } = useAuth();

const signOutDialog = ref(false);

// Go to credits page
const goToCredits = () => {
  router.push('/credits');
};

// Show sign out confirmation
const confirmSignOut = () => {
  signOutDialog.value = true;
};

// Handle sign out
const handleSignOut = async () => {
  signOutDialog.value = false;
  await signOut();
};

// Format Unix timestamp to readable date
const formatDate = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Open checkout link
const openCheckout = (type) => {
  const link = subscriptions.value?.[type]?.checkoutLink;
  if (link) {
    window.open(link, '_blank');
  }
};

// Fetch data on mount
onMounted(async () => {
  // Refresh access check to get latest subscription data
  await checkAccess();
});
</script>

<style scoped>
.ga-3 {
  gap: 12px;
}
</style>