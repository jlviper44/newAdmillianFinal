<template>
  <AuthGuard>
    <v-container fluid :class="{ 'pa-2': $vuetify.display.smAndDown }">
      <!-- Mobile Header -->
      <v-row v-if="$vuetify.display.smAndDown">
        <v-col cols="12" class="pb-2">
          <div class="text-center">
            <h2 class="text-h6 font-weight-bold">Profile</h2>
            <p class="text-caption text-grey-darken-1">Manage your account settings</p>
          </div>
        </v-col>
      </v-row>

      <!-- Desktop Header -->
      <v-row v-else>
        <v-col cols="12">
          <div class="d-flex justify-space-between align-center mb-6">
            <div>
              <h1 class="text-h4 font-weight-bold">
                <v-icon icon="mdi-account" size="x-large" class="mr-2"></v-icon>
                Profile
              </h1>
              <p class="text-subtitle-1 text-grey-darken-1 mt-1">Manage your account settings and information</p>
            </div>
          </div>
        </v-col>
      </v-row>

      <v-row>
        <!-- User Information Card -->
        <v-col cols="12">
          <v-card :class="$vuetify.display.smAndDown ? 'ma-1' : ''" density="compact">
            <v-card-title :class="$vuetify.display.smAndDown ? 'text-body-1 pa-3' : 'd-flex align-center pa-3'">
              <v-icon class="mr-2" :size="$vuetify.display.smAndDown ? 'small' : 'small'">mdi-account-circle</v-icon>
              <span :class="$vuetify.display.smAndDown ? 'text-body-1' : 'text-h6'">User Information</span>
            </v-card-title>
            <v-card-text :class="$vuetify.display.smAndDown ? 'pa-3' : 'pa-3'">
              <v-row v-if="user" no-gutters>
                <v-col cols="12" :class="$vuetify.display.smAndDown ? 'mb-3' : 'd-flex align-center mb-3'">
                  <!-- Mobile Layout -->
                  <div v-if="$vuetify.display.smAndDown" class="text-center">
                    <v-avatar size="80" class="mb-3">
                      <v-img v-if="user.image" :src="user.image" :alt="user.name"></v-img>
                      <v-icon v-else size="80">mdi-account-circle</v-icon>
                    </v-avatar>
                    <div class="mb-3">
                      <div class="text-h6 font-weight-medium mb-1">{{ user.name || 'Not set' }}</div>
                      <div class="text-body-2 text-grey mb-2">{{ user.email || 'Not set' }}</div>
                      <div class="text-caption text-grey mb-3">ID: {{ user.id }}</div>
                      <div class="d-flex justify-center gap-2 flex-wrap mb-3">
                        <v-chip v-if="user.isAdmin" color="amber" size="small" variant="flat">
                          <v-icon start size="small">mdi-crown</v-icon>
                          Admin
                        </v-chip>
                        <v-chip v-if="user?.team" color="primary" size="small" variant="flat">
                          <v-icon start size="small">mdi-account-group</v-icon>
                          {{ user.team.name }}
                        </v-chip>
                      </div>
                    </div>
                    <v-btn
                      color="error"
                      variant="outlined"
                      size="default"
                      @click="confirmSignOut"
                      block
                      class="mobile-logout-btn"
                    >
                      <v-icon start size="small">mdi-logout</v-icon>
                      Sign Out
                    </v-btn>
                  </div>
                  <!-- Desktop Layout -->
                  <template v-else>
                    <v-avatar size="60" class="mr-3">
                      <v-img v-if="user.image" :src="user.image" :alt="user.name"></v-img>
                      <v-icon v-else size="60">mdi-account-circle</v-icon>
                    </v-avatar>
                    <div class="flex-grow-1">
                      <div class="d-flex align-center">
                        <span class="text-subtitle-1 font-weight-medium">{{ user.name || 'Not set' }}</span>
                        <v-chip v-if="user.isAdmin" color="amber" size="small" variant="flat" class="ml-3">
                          <v-icon start size="small">mdi-crown</v-icon>
                          Admin
                        </v-chip>
                        <v-chip v-if="user?.team" color="primary" size="small" variant="flat" class="ml-2">
                          <v-icon start size="small">mdi-account-group</v-icon>
                          {{ user.team.name }}
                        </v-chip>
                      </div>
                      <div class="text-body-2 text-grey">{{ user.email || 'Not set' }}</div>
                      <div class="text-caption text-grey">ID: {{ user.id }}</div>
                    </div>
                    <v-btn
                      color="error"
                      variant="outlined"
                      size="small"
                      @click.stop="confirmSignOut"
                    >
                      <v-icon start size="small">mdi-logout</v-icon>
                      Sign Out
                    </v-btn>
                  </template>
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

        <!-- Virtual Assistant Section -->
        <v-col v-if="isVirtualAssistant || isAssistingUser" cols="12">
          <v-card :class="$vuetify.display.smAndDown ? 'ma-1' : ''" density="compact" class="va-card">
            <v-card-title :class="$vuetify.display.smAndDown ? 'text-body-1 pa-3' : 'd-flex align-center pa-3'">
              <v-icon class="mr-2" :size="$vuetify.display.smAndDown ? 'small' : 'small'" color="primary">mdi-account-supervisor</v-icon>
              <span :class="$vuetify.display.smAndDown ? 'text-body-1' : 'text-h6'">Virtual Assistant Access</span>
            </v-card-title>
            <v-card-text :class="$vuetify.display.smAndDown ? 'pa-3' : 'pa-3'">
              <!-- Currently Assisting -->
              <div v-if="isAssistingUser" class="assisting-banner">
                <v-alert
                  type="success"
                  variant="tonal"
                  density="compact"
                  class="mb-3"
                >
                  <template v-slot:prepend>
                    <v-icon>mdi-account-eye</v-icon>
                  </template>
                  <div class="d-flex align-center justify-space-between flex-wrap">
                    <div>
                      <div class="font-weight-bold">Currently Assisting</div>
                      <div class="text-caption">{{ user.assistingFor || user.email || `User #${user.id}` }}</div>
                    </div>
                    <v-btn
                      color="warning"
                      variant="outlined"
                      size="small"
                      prepend-icon="mdi-close-circle"
                      @click="exitVirtualAssistantMode"
                      :class="$vuetify.display.smAndDown ? 'mt-2' : ''"
                    >
                      Stop Assisting
                    </v-btn>
                  </div>
                </v-alert>
              </div>

              <!-- VA Account List -->
              <div v-else>
                <div class="d-flex align-center justify-space-between mb-3">
                  <div>
                    <div class="text-subtitle-2 font-weight-medium">Client Accounts</div>
                    <div class="text-caption text-grey">Switch to any account you assist</div>
                  </div>
                  <v-chip color="primary" size="small" variant="flat">
                    {{ virtualAssistantAccounts.length }} account{{ virtualAssistantAccounts.length !== 1 ? 's' : '' }}
                  </v-chip>
                </div>

                <v-list v-if="virtualAssistantAccounts.length > 0" density="compact" class="va-account-list">
                  <v-list-item
                    v-for="account in virtualAssistantAccounts"
                    :key="account.user_id"
                    @click="switchToAccount(account)"
                    :disabled="account.status !== 'active'"
                    class="va-account-item"
                  >
                    <template v-slot:prepend>
                      <v-icon :color="account.status === 'active' ? 'success' : 'grey'">
                        {{ account.status === 'active' ? 'mdi-account-check' : 'mdi-account-clock' }}
                      </v-icon>
                    </template>
                    <v-list-item-title class="font-weight-medium">
                      {{ account.name || account.email || `User #${account.user_id}` }}
                    </v-list-item-title>
                    <v-list-item-subtitle>
                      <div v-if="account.email" class="text-caption">{{ account.email }}</div>
                      <div class="d-flex align-center mt-1 gap-2">
                        <v-chip
                          :color="account.status === 'active' ? 'success' : 'error'"
                          size="x-small"
                          variant="flat"
                        >
                          {{ account.status === 'active' ? 'Active' : 'Expired' }}
                        </v-chip>
                        <span class="text-caption text-grey">Expires: {{ new Date(account.expires_at).toLocaleDateString() }}</span>
                      </div>
                    </v-list-item-subtitle>
                    <template v-slot:append v-if="account.status === 'active'">
                      <v-icon size="small">mdi-chevron-right</v-icon>
                    </template>
                  </v-list-item>
                </v-list>

                <v-alert v-else type="info" variant="tonal" density="compact">
                  You are not currently a virtual assistant for any accounts.
                </v-alert>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

      </v-row>

      <!-- Subscription Tiers Section -->
      <v-row :class="$vuetify.display.smAndDown ? 'mt-3' : 'mt-6'">
        <v-col cols="12" :class="$vuetify.display.smAndDown ? 'px-3' : ''">
          <h2 :class="$vuetify.display.smAndDown ? 'text-h6 font-weight-bold mb-2' : 'text-h5 font-weight-bold mb-2'">Choose your plan</h2>
          <p :class="$vuetify.display.smAndDown ? 'text-body-2 text-grey mb-3' : 'text-body-1 text-grey mb-4'">Get instant access to powerful automation tools</p>
        </v-col>
      </v-row>

      <v-row v-if="subscriptions">
        <!-- Dashboard Tier -->
        <v-col cols="12" md="4" :class="$vuetify.display.smAndDown ? 'px-3 pb-3' : ''">
          <v-card 
            class="tier-card h-100"
            :class="{ 'active-tier': subscriptions.dashboard?.isActive }"
            elevation="0"
            variant="outlined"
          >
            <!-- Header with gradient background -->
            <div class="tier-header tier-header-dashboard">
              <v-icon size="32" color="white" class="mb-1">mdi-view-dashboard</v-icon>
              <h3 class="text-h6 font-weight-bold text-white">Dashboard</h3>
              <p class="text-caption text-white-darken-1 mb-0">Analytics & management tools</p>
            </div>
            
            <v-card-text :class="$vuetify.display.smAndDown ? 'pa-3' : 'pa-4'">
              <!-- Pricing -->
              <div class="text-center mb-4">
                <div class="d-flex align-center justify-center mb-1">
                  <span :class="$vuetify.display.smAndDown ? 'text-h5 font-weight-bold' : 'text-h4 font-weight-bold'">$500</span>
                  <span class="text-body-2 ml-1">/month</span>
                </div>
                <v-divider class="mx-auto" style="max-width: 60px;"></v-divider>
                <p class="text-body-2 font-weight-bold mt-1">All-in-one solution</p>
                <p class="text-caption text-grey">Comprehensive analytics suite</p>
              </div>

              <!-- Features List -->
              <div class="mb-4">
                <div class="feature-item" v-for="feature in dashboardFeatures" :key="feature">
                  <v-icon size="16" color="success" class="mr-2">mdi-check-circle</v-icon>
                  <span :class="$vuetify.display.smAndDown ? 'text-caption' : 'text-caption'">{{ feature }}</span>
                </div>
              </div>

              <!-- Active Status or CTA -->
              <div v-if="user?.isAdmin" class="active-status">
                <v-chip color="amber" variant="flat" class="mb-3" block>
                  <v-icon start size="small">mdi-crown</v-icon>
                  Admin Access
                </v-chip>
                <div class="text-center mb-3">
                  <p class="text-body-2 text-grey mb-1">Status</p>
                  <p class="text-h6 font-weight-bold">Unlimited Access</p>
                  <p class="text-caption text-grey">No expiration</p>
                </div>
                <v-divider class="my-3"></v-divider>
                <div class="text-center mb-3">
                  <p class="text-body-2 font-weight-medium">Full dashboard access</p>
                </div>
              </div>
              <div v-else-if="subscriptions.dashboard?.isActive" class="active-status">
                <v-chip color="success" variant="flat" class="mb-3" block>
                  <v-icon start size="small">mdi-check-circle</v-icon>
                  Subscribed
                </v-chip>
                <div class="text-center mb-3">
                  <p class="text-body-2 text-grey mb-1">Renews in</p>
                  <p class="text-h6 font-weight-bold">{{ subscriptions.dashboard.expiresIn }} days</p>
                  <p class="text-caption text-grey">{{ formatDate(subscriptions.dashboard.endDate) }}</p>
                </div>
                <v-divider class="my-3"></v-divider>
                <div class="text-center mb-3">
                  <p class="text-body-2 font-weight-medium">Full access active</p>
                </div>
                <v-btn 
                  variant="outlined"
                  color="primary"
                  block
                  @click="openCheckout('dashboard')"
                >
                  Manage Subscription
                </v-btn>
              </div>
              <v-btn 
                v-else
                color="primary"
                variant="flat"
                block
                @click="openCheckout('dashboard')"
                :disabled="!subscriptions.dashboard?.checkoutLink"
              >
                Get Started
              </v-btn>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Comment Bot Tier -->
        <v-col cols="12" md="4" :class="$vuetify.display.smAndDown ? 'px-3 pb-3' : ''">
          <v-card 
            class="tier-card h-100"
            :class="{ 'active-tier': subscriptions.comment_bot?.isActive }"
            elevation="0"
            variant="outlined"
          >
            <!-- Header with gradient background -->
            <div class="tier-header tier-header-comment">
              <v-icon size="32" color="white" class="mb-1">mdi-comment-multiple</v-icon>
              <h3 class="text-h6 font-weight-bold text-white">Comment Bot</h3>
              <p class="text-caption text-white-darken-1 mb-0">Automated social media engagement</p>
            </div>
            
            <v-card-text :class="$vuetify.display.smAndDown ? 'pa-3' : 'pa-4'">
              <!-- Pricing -->
              <div class="text-center mb-4">
                <div class="d-flex align-center justify-center mb-1">
                  <span :class="$vuetify.display.smAndDown ? 'text-h5 font-weight-bold' : 'text-h4 font-weight-bold'">$20</span>
                  <span class="text-body-2 ml-1">/month</span>
                </div>
                <v-divider class="mx-auto" style="max-width: 60px;"></v-divider>
                <p class="text-body-2 font-weight-bold mt-1">$3 per credit</p>
                <p class="text-caption text-grey">Pay as you go for credits</p>
              </div>

              <!-- Features List -->
              <div class="mb-4">
                <div class="feature-item" v-for="feature in commentBotFeatures" :key="feature">
                  <v-icon size="16" color="success" class="mr-2">mdi-check-circle</v-icon>
                  <span :class="$vuetify.display.smAndDown ? 'text-caption' : 'text-caption'">{{ feature }}</span>
                </div>
              </div>

              <!-- Active Status or CTA -->
              <div v-if="user?.isAdmin" class="active-status">
                <v-chip color="amber" variant="flat" class="mb-3" block>
                  <v-icon start size="small">mdi-crown</v-icon>
                  Admin Access
                </v-chip>
                <div class="text-center mb-3">
                  <p class="text-body-2 text-grey mb-1">Status</p>
                  <p class="text-h6 font-weight-bold">Unlimited Access</p>
                  <p class="text-caption text-grey">No expiration</p>
                </div>
                <v-divider class="my-3"></v-divider>
                <div class="text-center mb-3">
                  <p class="text-body-2 font-weight-medium">Unlimited credits available</p>
                </div>
              </div>
              <div v-else-if="subscriptions.comment_bot?.isActive" class="active-status">
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
                @click="openCheckout('comment_bot')"
                :disabled="!subscriptions.comment_bot?.checkoutLink"
              >
                Get Started
              </v-btn>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- BC Gen Tier -->
        <v-col cols="12" md="4" :class="$vuetify.display.smAndDown ? 'px-3 pb-3' : ''">
          <v-card 
            class="tier-card h-100"
            :class="{ 'active-tier': subscriptions.bc_gen?.isActive }"
            elevation="0"
            variant="outlined"
          >
            <!-- Header with gradient background -->
            <div class="tier-header tier-header-bcgen">
              <v-icon size="32" color="white" class="mb-1">mdi-account-multiple</v-icon>
              <h3 class="text-h6 font-weight-bold text-white">BC Gen</h3>
              <p class="text-caption text-white-darken-1 mb-0">Premium account marketplace</p>
            </div>
            
            <v-card-text :class="$vuetify.display.smAndDown ? 'pa-3' : 'pa-4'">
              <!-- Pricing -->
              <div class="text-center mb-4">
                <div class="d-flex align-center justify-center mb-1">
                  <span :class="$vuetify.display.smAndDown ? 'text-h5 font-weight-bold' : 'text-h4 font-weight-bold'">$20</span>
                  <span class="text-body-2 ml-1">/month</span>
                </div>
                <v-divider class="mx-auto" style="max-width: 60px;"></v-divider>
                <p class="text-body-2 font-weight-bold mt-1">Plus $2 per account</p>
                <p class="text-caption text-grey">1 credit = 1 account</p>
              </div>

              <!-- Features List -->
              <div class="mb-4">
                <div class="feature-item" v-for="feature in bcGenFeatures" :key="feature">
                  <v-icon size="16" color="success" class="mr-2">mdi-check-circle</v-icon>
                  <span :class="$vuetify.display.smAndDown ? 'text-caption' : 'text-caption'">{{ feature }}</span>
                </div>
              </div>

              <!-- Active Status or CTA -->
              <div v-if="user?.isAdmin" class="active-status">
                <v-chip color="amber" variant="flat" class="mb-3" block>
                  <v-icon start size="small">mdi-crown</v-icon>
                  Admin Access
                </v-chip>
                <div class="text-center mb-3">
                  <p class="text-body-2 text-grey mb-1">Status</p>
                  <p class="text-h6 font-weight-bold">Unlimited Access</p>
                  <p class="text-caption text-grey">No expiration</p>
                </div>
                <v-divider class="my-3"></v-divider>
                <div class="text-center mb-3">
                  <p class="text-body-2 font-weight-medium">Unlimited credits available</p>
                </div>
              </div>
              <div v-else-if="subscriptions.bc_gen?.isActive" class="active-status">
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
    <v-dialog 
      v-model="signOutDialog" 
      :max-width="$vuetify.display.smAndDown ? '320px' : '400px'"
    >
      <v-card>
        <v-card-title :class="$vuetify.display.smAndDown ? 'text-h6 pa-4' : 'text-h5'">
          Confirm Sign Out
        </v-card-title>
        <v-card-text :class="$vuetify.display.smAndDown ? 'pa-4' : ''">
          Are you sure you want to sign out of your account?
        </v-card-text>
        <v-card-actions :class="$vuetify.display.smAndDown ? 'pa-4' : ''">
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="signOutDialog = false"
            :size="$vuetify.display.smAndDown ? 'small' : 'default'"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            variant="text"
            @click.stop="handleSignOut"
            :size="$vuetify.display.smAndDown ? 'small' : 'default'"
            class="modal-signout-btn"
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
import { usersApi } from '@/services/api';
import AuthGuard from '@/components/AuthGuard.vue';

const router = useRouter();
const { user, subscriptions, signOut, checkAccess, isVirtualAssistant, virtualAssistantAccounts, isAssistingUser } = useAuth();

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

const dashboardFeatures = [
  'Real-time analytics',
  'Performance metrics',
  'Campaign management',
  'Team collaboration tools',
  'Advanced reporting'
];


// Show sign out confirmation
const confirmSignOut = () => {
  signOutDialog.value = true;
};

// Handle sign out
const handleSignOut = async () => {
  console.log('handleSignOut called');
  signOutDialog.value = false;
  try {
    await signOut();
    console.log('Sign out successful');
    // Navigate to home page after successful logout
    router.push('/');
  } catch (error) {
    console.error('Sign out error:', error);
  }
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
    } else if (type === 'dashboard') {
      router.push('/dashboard');
    }
  } else {
    // For new users, open the checkout link
    const link = subscriptions.value?.[type]?.checkoutLink;
    if (link) {
      window.open(link, '_blank');
    }
  }
};

// Switch to account
const switchToAccount = async (account) => {
  try {
    await usersApi.startVirtualAssistantMode(account.user_id);
    window.location.reload();
  } catch (error) {
    console.error('Failed to switch to virtual assistant mode:', error);
    alert('Failed to switch to virtual assistant mode. Please try again.');
  }
};

// Exit VA mode
const exitVirtualAssistantMode = async () => {
  try {
    await usersApi.endVirtualAssistantMode();
    window.location.reload();
  } catch (error) {
    console.error('Failed to exit virtual assistant mode:', error);
    alert('Failed to exit virtual assistant mode. Please try again.');
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
  padding: 24px 16px;
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

.tier-header-dashboard {
  background: linear-gradient(135deg, #2196f3 0%, #1565c0 100%);
}

/* Feature Items */
.feature-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  padding: 2px 0;
}

.feature-item:last-child {
  margin-bottom: 0;
}

/* Active Status */
.active-status :deep(.v-chip) {
  height: 32px;
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
    padding: 20px 16px;
  }
  
  .tier-card {
    margin-bottom: 16px;
  }
  
  .tier-card .v-card-text {
    padding: 16px !important;
  }
  
  .feature-item {
    margin-bottom: 6px;
  }
  
  .feature-item .v-icon {
    font-size: 14px !important;
  }
  
  .feature-item span {
    font-size: 0.75rem !important;
  }
}

/* Mobile-specific styles */
@media (max-width: 600px) {
  .tier-card {
    border-radius: 12px !important;
    margin-bottom: 12px;
  }
  
  .tier-header {
    padding: 16px 12px;
  }
  
  .tier-header h3 {
    font-size: 1.1rem !important;
  }
  
  .tier-header p {
    font-size: 0.75rem !important;
  }
  
  .tier-card .v-card-text {
    padding: 12px !important;
  }
  
  .v-chip {
    height: auto !important;
    padding: 4px 8px !important;
  }
  
  .v-chip .v-chip__content {
    font-size: 0.75rem !important;
  }
  
  .v-btn {
    height: auto !important;
    padding: 8px 16px !important;
    pointer-events: auto !important;
  }
  
  .v-btn .v-btn__content {
    font-size: 0.875rem !important;
    pointer-events: none !important;
  }
  
  .mobile-logout-btn {
    min-height: 44px !important;
    touch-action: manipulation !important;
    cursor: pointer !important;
  }
  
  .mobile-logout-btn:hover {
    background-color: rgba(var(--v-theme-error), 0.04) !important;
  }
  
  .modal-signout-btn {
    min-height: 36px !important;
    touch-action: manipulation !important;
    cursor: pointer !important;
    pointer-events: auto !important;
  }
}

/* VA Card Styling */
.va-card {
  border: 2px solid rgb(var(--v-theme-primary));
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.03) 0%, rgba(var(--v-theme-primary), 0.08) 100%);
}

.va-account-list {
  background: transparent !important;
  overflow-y: auto;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.va-account-list::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

.va-account-item {
  background-color: rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  margin-bottom: 8px;
  transition: all 0.2s ease;
}

.v-theme--dark .va-account-item {
  background-color: rgba(255, 255, 255, 0.05);
}

.va-account-item:hover:not(.v-list-item--disabled) {
  background-color: rgba(var(--v-theme-primary), 0.1);
  transform: translateX(4px);
}

.va-account-item.v-list-item--disabled {
  opacity: 0.5;
}

.gap-2 {
  gap: 8px;
}
</style>