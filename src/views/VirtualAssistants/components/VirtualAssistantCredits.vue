<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { usersApi } from '@/services/api';

// Credits data
const credits = ref({
  balance: 0,
  transactions: [],
  memberships: []
});

// Loading states
const loading = ref({
  checkAccess: false,
  createCheckout: false,
  useCredits: false
});
const error = ref({
  checkAccess: null,
  createCheckout: null,
  useCredits: null
});

// Purchase form
const purchaseQuantity = ref(10);
const showPaymentDialog = ref(false);
const paymentCheckInterval = ref(null);

// Pricing data
const creditPrice = ref(50.00);

// Format unix timestamp to readable date
const formatDate = (timestamp) => {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// Fetch pricing from backend
const fetchPricing = async () => {
  try {
    const data = await usersApi.getPricing();
    creditPrice.value = data.virtualAssistantCreditPrice;
  } catch (err) {
    console.error('Failed to fetch pricing:', err);
  }
};

// Check user's access and credit balance
const checkAccess = async () => {
  loading.value.checkAccess = true;
  error.value.checkAccess = null;
  
  try {
    const data = await usersApi.checkAccess();
    
    // Get Virtual Assistant specific credits
    const virtualAssistantData = data.subscriptions?.virtual_assistant;
    
    credits.value.balance = virtualAssistantData?.totalCredits || 0;
    credits.value.memberships = virtualAssistantData?.creditMemberships || [];
  } catch (err) {
    error.value.checkAccess = err.message || 'Failed to check access';
  } finally {
    loading.value.checkAccess = false;
  }
};

// Create checkout session for purchasing credits
const createCheckout = async () => {
  if (purchaseQuantity.value < 1) {
    error.value.createCheckout = 'Please enter a valid quantity';
    return;
  }
  
  loading.value.createCheckout = true;
  error.value.createCheckout = null;
  
  try {
    const data = await usersApi.createCheckout({ 
      quantity: purchaseQuantity.value,
      productType: 'virtual_assistant'
    });
    
    if (data.direct_link) {
      // Open checkout in a new window
      const width = 600;
      const height = 800;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      
      const popup = window.open(
        data.direct_link,
        'WhopCheckout',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
      );
      
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        error.value.createCheckout = 'Please allow popups for this site to proceed with checkout.';
      } else {
        // Show payment dialog
        showPaymentDialog.value = true;
        
        // Store current balance for comparison
        const previousBalance = credits.value.balance;
        
        // Poll for completion
        paymentCheckInterval.value = setInterval(async () => {
          if (popup.closed) {
            // Window closed, check if payment was successful by comparing balances
            await checkAccess();
            
            // Give it a moment then check again to ensure we have the latest data
            setTimeout(async () => {
              await checkAccess();
              clearInterval(paymentCheckInterval.value);
              showPaymentDialog.value = false;
              
              // If balance increased, payment was successful
              if (credits.value.balance > previousBalance) {
                // Payment successful - balance updated
              }
            }, 1000);
          }
        }, 500);
      }
    }
  } catch (err) {
    error.value.createCheckout = err.message || 'Failed to create checkout';
  } finally {
    loading.value.createCheckout = false;
  }
};

// Initialize on mount
onMounted(() => {
  checkAccess();
  fetchPricing();
});

// Clean up on unmount
onUnmounted(() => {
  if (paymentCheckInterval.value) {
    clearInterval(paymentCheckInterval.value);
  }
});
</script>

<template>
    <v-container fluid :class="$vuetify.display.smAndDown ? 'pa-2' : 'pa-0'">

      <!-- Credits Balance Card -->
      <v-row>
        <v-col cols="12">
          <v-card 
            elevation="8" 
            class="credit-balance-card"
            :class="$vuetify.theme.current.dark ? 'bg-gradient-dark' : 'bg-gradient-light'"
            style="position: relative; overflow: hidden;"
          >
            <!-- Background Pattern -->
            <div style="position: absolute; top: -50px; right: -50px; opacity: 0.1;">
              <v-icon size="300" :color="$vuetify.theme.current.dark ? 'grey-lighten-2' : 'white'">mdi-wallet</v-icon>
            </div>
            
            <v-card-text :class="$vuetify.display.smAndDown ? 'pa-4' : 'pa-8'" style="position: relative; z-index: 1;">
              <v-row align="center" class="ma-0" :class="{ 'flex-column': $vuetify.display.smAndDown }">
                <v-col cols="12" :md="$vuetify.display.smAndDown ? '12' : '7'" class="pa-0">
                  <div :class="$vuetify.theme.current.dark ? 'text-grey-lighten-2' : 'text-white'">
                    <div class="text-overline font-weight-medium mb-2" style="opacity: 0.9;" :class="{ 'text-center': $vuetify.display.smAndDown }">CREDIT BALANCE</div>
                    <div class="d-flex align-baseline mb-1" :class="{ 'justify-center': $vuetify.display.smAndDown }">
                      <div class="font-weight-bold" :style="$vuetify.display.smAndDown ? 'font-size: 2.5rem !important; line-height: 1;' : 'font-size: 4rem !important; line-height: 1;'">
                        {{ credits.balance.toLocaleString() }}
                      </div>
                      <div :class="$vuetify.display.smAndDown ? 'text-h6 ml-2' : 'text-h5 ml-3'" style="opacity: 0.9;">credits</div>
                    </div>
                    <div :class="$vuetify.display.smAndDown ? 'text-body-2 text-center' : 'text-body-1'" style="opacity: 0.8;">
                      Available for Virtual Assistants
                    </div>
                  </div>
                </v-col>
                
                <v-col cols="12" :md="$vuetify.display.smAndDown ? '12' : '5'" :class="$vuetify.display.smAndDown ? 'pa-0 mt-4' : 'pa-0 mt-6 mt-md-0'">
                  <v-card 
                    elevation="0" 
                    class="pa-4" 
                    :style="$vuetify.theme.current.dark ? 'background: rgba(33, 33, 33, 0.95); border-radius: 16px;' : 'background: rgba(255, 255, 255, 0.95); border-radius: 16px;'"
                  >
                    <div class="text-center mb-3">
                      <div class="text-subtitle-2 mb-2" :class="$vuetify.theme.current.dark ? 'text-grey-lighten-2' : 'text-grey-darken-2'">Purchase Credits</div>
                      <div class="d-flex align-center justify-center">
                        <v-btn
                          icon
                          :density="$vuetify.display.smAndDown ? 'compact' : 'comfortable'"
                          variant="tonal"
                          color="primary"
                          @click="purchaseQuantity = Math.max(1, purchaseQuantity - 5)"
                          :size="$vuetify.display.smAndDown ? 'small' : 'default'"
                        >
                          <v-icon>mdi-minus</v-icon>
                        </v-btn>
                        <v-text-field
                          v-model.number="purchaseQuantity"
                          type="number"
                          min="1"
                          variant="solo"
                          :density="$vuetify.display.smAndDown ? 'compact' : 'comfortable'"
                          hide-details
                          single-line
                          class="mx-2 credit-input"
                          :style="$vuetify.display.smAndDown ? 'max-width: 80px;' : 'max-width: 100px;'"
                        ></v-text-field>
                        <v-btn
                          icon
                          :density="$vuetify.display.smAndDown ? 'compact' : 'comfortable'"
                          variant="tonal"
                          color="primary"
                          @click="purchaseQuantity = purchaseQuantity + 5"
                          :size="$vuetify.display.smAndDown ? 'small' : 'default'"
                        >
                          <v-icon>mdi-plus</v-icon>
                        </v-btn>
                      </div>
                      <div class="text-caption text-grey mt-2">1 credit = 1 virtual assistant</div>
                    </div>
                    <div class="mb-3">
                      <div class="text-h5 font-weight-bold text-primary text-center mb-1">
                        ${{ (purchaseQuantity * creditPrice).toFixed(2) }}
                      </div>
                      <div class="text-caption text-grey text-center">
                        ${{ creditPrice.toFixed(2) }} per credit
                      </div>
                    </div>
                    <v-btn 
                      color="primary" 
                      variant="elevated"
                      :size="$vuetify.display.smAndDown ? 'default' : 'large'"
                      :loading="loading.createCheckout"
                      @click="createCheckout"
                      block
                      class="text-none"
                      style="border-radius: 12px;"
                    >
                      <v-icon start :size="$vuetify.display.smAndDown ? 'small' : 'default'">mdi-cart-plus</v-icon>
                      Purchase Credits
                    </v-btn>
                  </v-card>
                  <v-alert 
                    v-if="error.createCheckout" 
                    type="error" 
                    density="compact"
                    class="mt-3"
                  >
                    {{ error.createCheckout }}
                  </v-alert>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Transaction History -->
      <v-row :class="$vuetify.display.smAndDown ? 'mt-4' : 'mt-6'">
        <v-col cols="12">
          <v-card elevation="2">
            <v-card-title :class="[
              'd-flex align-center',
              $vuetify.display.smAndDown ? 'flex-wrap pa-3' : 'justify-space-between'
            ]">
              <span :class="$vuetify.display.smAndDown ? 'text-body-1' : ''">Credit Purchases</span>
              <v-spacer v-if="!$vuetify.display.smAndDown"></v-spacer>
              <v-btn 
                variant="text" 
                color="primary" 
                :size="$vuetify.display.smAndDown ? 'x-small' : 'small'"
                @click="checkAccess"
                :loading="loading.checkAccess"
                :class="{ 'ml-auto': $vuetify.display.smAndDown }"
              >
                <v-icon start :size="$vuetify.display.smAndDown ? 'small' : 'default'">mdi-refresh</v-icon>
                {{ $vuetify.display.smAndDown ? '' : 'Refresh' }}
              </v-btn>
            </v-card-title>
            <v-card-text :class="{ 'pa-3': $vuetify.display.smAndDown }">
              <!-- Mobile Card Layout -->
              <div v-if="$vuetify.display.smAndDown" class="mobile-purchases">
                <div v-if="credits.memberships.filter(m => m.metadata?.InitialQuantity !== undefined || m.metadata?.Quantity !== undefined).length === 0" 
                     class="text-center py-8 text-medium-emphasis">
                  No credit purchases found
                </div>
                <v-card 
                  v-else
                  v-for="item in credits.memberships.filter(m => m.metadata?.InitialQuantity !== undefined || m.metadata?.Quantity !== undefined)"
                  :key="item.id"
                  class="mb-3"
                  variant="outlined"
                >
                  <v-card-text class="pa-3">
                    <div class="d-flex justify-space-between align-center mb-2">
                      <span class="text-caption text-medium-emphasis">{{ formatDate(item.created_at) }}</span>
                    </div>
                    <div class="d-flex justify-space-between align-center">
                      <div>
                        <div class="text-caption text-medium-emphasis">Initial</div>
                        <div class="text-h6 font-weight-bold text-grey-darken-1">
                          {{ parseInt(item.metadata.InitialQuantity || item.metadata.Quantity).toLocaleString() }}
                        </div>
                      </div>
                      <v-icon size="small" class="mx-2">mdi-arrow-right</v-icon>
                      <div>
                        <div class="text-caption text-medium-emphasis">Remaining</div>
                        <div class="text-h6 font-weight-bold text-primary">
                          {{ parseInt(item.metadata.Quantity || 0).toLocaleString() }}
                        </div>
                      </div>
                    </div>
                  </v-card-text>
                </v-card>
              </div>
              
              <!-- Desktop Table -->
              <v-data-table
                v-else
                :headers="[
                  { title: 'Created At', key: 'created_at', align: 'start' },
                  { title: 'Initial Credits', key: 'initial_credits', align: 'end' },
                  { title: 'Remaining Credits', key: 'remaining_credits', align: 'end' }
                ]"
                :items="credits.memberships.filter(m => m.metadata?.InitialQuantity !== undefined || m.metadata?.Quantity !== undefined)"
                :loading="loading.checkAccess"
                items-per-page="10"
                no-data-text="No credit purchases found"
              >
                <template v-slot:item.created_at="{ item }">
                  {{ formatDate(item.created_at) }}
                </template>
                <template v-slot:item.initial_credits="{ item }">
                  <span class="text-h6 font-weight-bold text-grey-darken-1">
                    {{ parseInt(item.metadata.InitialQuantity || item.metadata.Quantity).toLocaleString() }}
                  </span>
                </template>
                <template v-slot:item.remaining_credits="{ item }">
                  <span class="text-h6 font-weight-bold text-primary">
                    {{ parseInt(item.metadata.Quantity || 0).toLocaleString() }}
                  </span>
                </template>
              </v-data-table>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    
    <!-- Payment Processing Dialog -->
    <v-dialog
      v-model="showPaymentDialog"
      persistent
      :max-width="$vuetify.display.smAndDown ? '90%' : '400'"
    >
      <v-card>
        <v-card-text class="text-center pa-6">
          <v-progress-circular
            indeterminate
            color="primary"
            size="64"
            class="mb-4"
          ></v-progress-circular>
          <h3 class="text-h6 mb-2">Complete Payment</h3>
          <p class="text-body-2 text-grey">
            Please complete your payment in the popup window.
            This dialog will close automatically once payment is processed.
          </p>
          <p class="text-caption text-grey mt-4">
            Purchasing {{ purchaseQuantity }} credits
          </p>
        </v-card-text>
      </v-card>
    </v-dialog>
</template>

<style scoped>
/* Gradient backgrounds for light and dark mode */
.bg-gradient-light {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.bg-gradient-dark {
  background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
}

.credit-balance-card {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.credit-balance-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15) !important;
}

.credit-input :deep(.v-field__input) {
  text-align: center;
  font-size: 1.25rem;
  font-weight: 600;
}

/* Mobile styles */
@media (max-width: 600px) {
  .credit-input :deep(.v-field__input) {
    font-size: 1rem;
  }
  
  .mobile-purchases {
    max-width: 100%;
  }
  
  /* Smaller background icon on mobile */
  .credit-balance-card > div:first-child v-icon {
    font-size: 200px !important;
  }
}

/* Remove spinner arrows from number input */
.credit-input :deep(input[type="number"]::-webkit-inner-spin-button),
.credit-input :deep(input[type="number"]::-webkit-outer-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}

.credit-input :deep(input[type="number"]) {
  -moz-appearance: textfield;
}

/* Animation for the wallet icon */
@keyframes float {
  0% { transform: translateY(0px) rotate(-5deg); }
  50% { transform: translateY(-20px) rotate(5deg); }
  100% { transform: translateY(0px) rotate(-5deg); }
}

.credit-balance-card > div:first-child {
  animation: float 6s ease-in-out infinite;
}
</style>