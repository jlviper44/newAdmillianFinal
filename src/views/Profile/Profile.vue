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

      <!-- Subscription Tiers Section -->
      <v-row class="mt-6">
        <v-col cols="12">
          <h2 class="text-h5 font-weight-bold mb-2">Choose your plan</h2>
          <p class="text-body-1 text-grey mb-4">Get instant access to powerful automation tools</p>
        </v-col>
      </v-row>

      <v-row v-if="subscriptions">
        <!-- Comment Bot Tier -->
        <v-col cols="12" md="6">
          <v-card 
            class="tier-card h-100"
            :class="{ 'active-tier': subscriptions.comment_bot?.isActive }"
            elevation="0"
            variant="outlined"
          >
            <!-- Header with gradient background -->
            <div class="tier-header tier-header-comment">
              <v-icon size="40" color="white" class="mb-2">mdi-comment-multiple</v-icon>
              <h3 class="text-h5 font-weight-bold text-white">Comment Bot</h3>
              <p class="text-body-2 text-white-darken-1 mb-0">Automated social media engagement</p>
            </div>
            
            <v-card-text class="pa-5">
              <!-- Pricing -->
              <div class="text-center mb-5">
                <div class="d-flex align-center justify-center mb-2">
                  <span class="text-h3 font-weight-bold">$20</span>
                  <span class="text-body-1 ml-1">/month</span>
                </div>
                <v-divider class="mx-auto" style="max-width: 100px;"></v-divider>
                <p class="text-body-1 font-weight-bold mt-2">Plus $2 per credit</p>
                <p class="text-caption text-grey">Pay as you go for credits</p>
              </div>

              <!-- Features List -->
              <div class="mb-5">
                <div class="feature-item" v-for="feature in commentBotFeatures" :key="feature">
                  <v-icon size="20" color="success" class="mr-3">mdi-check-circle</v-icon>
                  <span class="text-body-2">{{ feature }}</span>
                </div>
              </div>

              <!-- Active Status or CTA -->
              <div v-if="subscriptions.comment_bot?.isActive" class="active-status">
                <v-chip color="success" variant="flat" class="mb-3" block>
                  <v-icon start size="small">mdi-check-circle</v-icon>
                  Subscribed
                </v-chip>
                <div class="text-center mb-3">
                  <p class="text-body-2 text-grey mb-1">Renews in</p>
                  <p class="text-h6 font-weight-bold">{{ subscriptions.comment_bot.expiresIn }} days</p>
                  <p class="text-caption text-grey">{{ formatDate(subscriptions.comment_bot.endDate) }}</p>
                </div>
                <v-divider class="my-3"></v-divider>
                <div class="text-center mb-3">
                  <p class="text-body-2 font-weight-medium">{{ subscriptions.comment_bot.totalCredits || 0 }} credits available</p>
                </div>
                <v-btn 
                  variant="outlined"
                  color="primary"
                  block
                  size="large"
                  @click="openCheckout('comment_bot')"
                >
                  Add More Credits
                </v-btn>
              </div>
              <v-btn 
                v-else
                color="primary"
                variant="flat"
                block
                size="large"
                @click="openCheckout('comment_bot')"
                :disabled="!subscriptions.comment_bot?.checkoutLink"
              >
                Get Started
              </v-btn>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- BC Gen Tier -->
        <v-col cols="12" md="6">
          <v-card 
            class="tier-card h-100"
            :class="{ 'active-tier': subscriptions.bc_gen?.isActive }"
            elevation="0"
            variant="outlined"
          >
            <!-- Header with gradient background -->
            <div class="tier-header tier-header-bcgen">
              <v-icon size="40" color="white" class="mb-2">mdi-account-multiple</v-icon>
              <h3 class="text-h5 font-weight-bold text-white">BC Gen</h3>
              <p class="text-body-2 text-white-darken-1 mb-0">Premium account marketplace</p>
            </div>
            
            <v-card-text class="pa-5">
              <!-- Pricing -->
              <div class="text-center mb-5">
                <div class="d-flex align-center justify-center mb-2">
                  <span class="text-h3 font-weight-bold">$20</span>
                  <span class="text-body-1 ml-1">/month</span>
                </div>
                <v-divider class="mx-auto" style="max-width: 100px;"></v-divider>
                <p class="text-body-1 font-weight-bold mt-2">Plus $2 per account</p>
                <p class="text-caption text-grey">1 credit = 1 account</p>
              </div>

              <!-- Features List -->
              <div class="mb-5">
                <div class="feature-item" v-for="feature in bcGenFeatures" :key="feature">
                  <v-icon size="20" color="success" class="mr-3">mdi-check-circle</v-icon>
                  <span class="text-body-2">{{ feature }}</span>
                </div>
              </div>

              <!-- Active Status or CTA -->
              <div v-if="subscriptions.bc_gen?.isActive" class="active-status">
                <v-chip color="success" variant="flat" class="mb-3" block>
                  <v-icon start size="small">mdi-check-circle</v-icon>
                  Subscribed
                </v-chip>
                <div class="text-center mb-3">
                  <p class="text-body-2 text-grey mb-1">Renews in</p>
                  <p class="text-h6 font-weight-bold">{{ subscriptions.bc_gen.expiresIn }} days</p>
                  <p class="text-caption text-grey">{{ formatDate(subscriptions.bc_gen.endDate) }}</p>
                </div>
                <v-divider class="my-3"></v-divider>
                <div class="text-center mb-3">
                  <p class="text-body-2 font-weight-medium">{{ subscriptions.bc_gen.totalCredits || 0 }} credits available</p>
                </div>
                <v-btn 
                  variant="outlined"
                  color="primary"
                  block
                  size="large"
                  @click="openCheckout('bc_gen')"
                >
                  Add More Credits
                </v-btn>
              </div>
              <v-btn 
                v-else
                color="primary"
                variant="flat"
                block
                size="large"
                @click="openCheckout('bc_gen')"
                :disabled="!subscriptions.bc_gen?.checkoutLink"
              >
                Get Started
              </v-btn>
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
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import AuthGuard from '@/components/AuthGuard.vue';

const router = useRouter();
const { user, subscriptions, signOut, checkAccess } = useAuth();

const signOutDialog = ref(false);

// Feature lists
const commentBotFeatures = [
  'AI-powered comment generation',
  'Supported on TikTok (others coming soon)',
  'Custom comment templates',
  'Automated engagement campaigns',
  'Real-time analytics dashboard'
];

const bcGenFeatures = [
  'Premium verified accounts',
  'Multiple regions available',
  '2FA enabled accounts',
  'Instant delivery',
  '24-hour refund guarantee'
];


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

// Open checkout link or navigate to tab
const openCheckout = (type) => {
  // If user has active subscription, navigate to the respective tab and open credits
  if (subscriptions.value?.[type]?.isActive) {
    if (type === 'comment_bot') {
      router.push('/comments?showCredits=true');
    } else if (type === 'bc_gen') {
      router.push('/bc-gen?showCredits=true');
    }
  } else {
    // For new users, open the checkout link
    const link = subscriptions.value?.[type]?.checkoutLink;
    if (link) {
      window.open(link, '_blank');
    }
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

/* Tier Card Styles */
.tier-card {
  border-radius: 16px !important;
  overflow: hidden;
  transition: all 0.3s ease;
  border: 2px solid rgba(0, 0, 0, 0.08);
}

.tier-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
  border-color: rgba(0, 0, 0, 0.12);
}

.tier-card.active-tier {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 8px 16px rgba(var(--v-theme-primary), 0.15);
}

/* Tier Headers */
.tier-header {
  padding: 32px 24px;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.tier-header::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  animation: shimmer 3s infinite;
}

@keyframes shimmer {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.tier-header-comment {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.tier-header-bcgen {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

/* Feature Items */
.feature-item {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  padding: 4px 0;
}

.feature-item:last-child {
  margin-bottom: 0;
}

/* Active Status */
.active-status :deep(.v-chip) {
  height: 40px;
  font-weight: 500;
}

/* Buttons */
.tier-card .v-btn {
  border-radius: 8px;
  text-transform: none;
  font-weight: 600;
  letter-spacing: 0.025em;
}

/* Text adjustments */
.text-white-darken-1 {
  color: rgba(255, 255, 255, 0.87);
}

/* Responsive adjustments */
@media (max-width: 959px) {
  .tier-header {
    padding: 24px 16px;
  }
}
</style>