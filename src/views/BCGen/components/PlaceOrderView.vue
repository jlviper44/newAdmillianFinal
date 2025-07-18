<template>
  <v-card flat>
    <v-card-title :class="{ 'pa-3': $vuetify.display.smAndDown, 'flex-wrap': $vuetify.display.smAndDown }">
      <span :class="$vuetify.display.smAndDown ? 'text-body-1 mb-2' : ''">Place Order</span>
      <v-spacer v-if="!$vuetify.display.smAndDown"></v-spacer>
      <div :class="$vuetify.display.smAndDown ? 'd-flex flex-column gap-3 w-100' : 'd-flex align-center'" :style="$vuetify.display.smAndDown ? '' : 'gap: 16px;'">
        <v-chip 
          color="secondary" 
          variant="elevated"
          :size="$vuetify.display.smAndDown ? 'default' : 'large'"
          @click="checkAvailability"
          class="text-white"
          :block="$vuetify.display.smAndDown"
        >
          <v-icon start :size="$vuetify.display.smAndDown ? 'small' : 'default'">mdi-account-multiple-check</v-icon>
          <span :class="$vuetify.display.smAndDown ? '' : 'font-weight-bold'">{{ $vuetify.display.smAndDown ? 'Refresh' : 'Refresh Accounts' }}</span>
          <v-icon 
            end 
            size="small"
            :class="{ 'mdi-spin': availabilityLoading }"
          >
            mdi-refresh
          </v-icon>
        </v-chip>
        <v-chip 
          color="primary" 
          variant="elevated"
          :size="$vuetify.display.smAndDown ? 'default' : 'large'"
          @click="fetchCredits"
          class="text-white"
          :block="$vuetify.display.smAndDown"
        >
          <v-icon start :size="$vuetify.display.smAndDown ? 'small' : 'default'">mdi-wallet</v-icon>
          <span :class="$vuetify.display.smAndDown ? '' : 'font-weight-bold'">{{ remainingCredits.toLocaleString() }} credits</span>
          <v-icon 
            end 
            size="small"
            :class="{ 'mdi-spin': creditsLoading }"
          >
            mdi-refresh
          </v-icon>
        </v-chip>
      </div>
    </v-card-title>
    <v-card-text :class="{ 'pa-3': $vuetify.display.smAndDown }">
      <!-- Availability Loading -->
      <v-alert 
        v-if="availabilityLoading" 
        type="info" 
        variant="tonal"
        class="mb-4"
      >
        <v-progress-circular 
          indeterminate 
          size="20" 
          width="2"
          class="mr-2"
        ></v-progress-circular>
        Checking availability...
      </v-alert>
      
      <!-- Region Grid -->
      <v-row :dense="$vuetify.display.smAndDown">
        <v-col 
          v-for="region in regions" 
          :key="region.id"
          cols="12" 
          sm="6" 
          md="4"
        >
          <v-card 
            :elevation="orderQuantities[region.id] > 0 ? 4 : 2"
            :class="{ 
              'pa-2': $vuetify.display.smAndDown,
              'pa-3': !$vuetify.display.smAndDown,
              'text-center': true,
              'region-card': true,
              'selected-card': orderQuantities[region.id] > 0 
            }"
            :loading="availabilityLoading"
          >
            <v-img
              :src="`https://flagcdn.com/w80/${region.code}.png`"
              :alt="`${region.name} flag`"
              :width="$vuetify.display.smAndDown ? 40 : 60"
              :height="$vuetify.display.smAndDown ? 27 : 40"
              class="mx-auto mb-2 flag-image"
              cover
            ></v-img>
            <div :class="$vuetify.display.smAndDown ? 'text-body-2 mb-1 font-weight-bold' : 'text-h6 mb-1 font-weight-bold'">{{ region.name }}</div>
            <div 
              :class="[
                $vuetify.display.smAndDown ? 'text-caption mb-1' : 'mb-2 font-weight-bold',
                availability[region.id] > 0 ? 'text-success' : 'text-error'
              ]"
            >
              <template v-if="availabilityLoading">
                <v-progress-circular 
                  indeterminate 
                  size="16" 
                  width="2"
                ></v-progress-circular>
              </template>
              <template v-else>
                {{ availability[region.id] || 0 }} available
              </template>
            </div>
            <div class="d-flex align-center justify-center">
              <v-btn
                icon="mdi-minus"
                :size="$vuetify.display.smAndDown ? 'x-small' : 'small'"
                variant="tonal"
                :disabled="availabilityLoading || !orderQuantities[region.id] || orderQuantities[region.id] <= 0"
                @click="decrementQuantity(region.id)"
              ></v-btn>
              <v-text-field
                v-model.number="orderQuantities[region.id]"
                type="number"
                variant="outlined"
                density="compact"
                hide-details
                single-line
                :class="$vuetify.display.smAndDown ? 'mx-1 quantity-input-mobile' : 'mx-2 quantity-input'"
                :min="0"
                :max="availability[region.id] || 0"
                :disabled="availabilityLoading"
                @update:model-value="updateOrderTotal"
              ></v-text-field>
              <v-btn
                icon="mdi-plus"
                :size="$vuetify.display.smAndDown ? 'x-small' : 'small'"
                variant="tonal"
                :disabled="availabilityLoading || orderQuantities[region.id] >= (availability[region.id] || 0)"
                @click="incrementQuantity(region.id)"
              ></v-btn>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Order Summary -->
      <v-alert 
        v-if="orderTotal > 0"
        type="info"
        variant="tonal"
        class="mt-4 mb-2"
        :density="$vuetify.display.smAndDown ? 'compact' : 'default'"
      >
        <div :class="$vuetify.display.smAndDown ? 'd-flex flex-column gap-1' : 'd-flex justify-space-between align-center'">
          <span :class="$vuetify.display.smAndDown ? 'text-caption' : ''">Total accounts: <strong>{{ orderTotal }}</strong></span>
          <span :class="$vuetify.display.smAndDown ? 'text-caption' : ''">Credits needed: <strong>{{ orderTotal }}</strong></span>
          <span :class="$vuetify.display.smAndDown ? 'text-caption' : ''">Remaining after order: <strong>{{ remainingCredits - orderTotal }}</strong></span>
        </div>
      </v-alert>

      <!-- Order Button -->
      <v-btn
        @click="handleCreateOrder"
        color="primary"
        block
        :size="$vuetify.display.smAndDown ? 'default' : 'x-large'"
        class="mt-4"
        :loading="orderLoading"
        :disabled="orderTotal === 0 || orderTotal > remainingCredits"
      >
        <v-icon start :size="$vuetify.display.smAndDown ? 'small' : 'default'">mdi-cart</v-icon>
        {{ orderTotal === 0 ? 'Select Accounts to Order' : `Place Order (${orderTotal} credits)` }}
      </v-btn>
    </v-card-text>
    
    <!-- Snackbar for notifications -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color">
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn variant="text" @click="snackbar.show = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { bcgenApi, usersApi } from '@/services/api'

// Emit
const emit = defineEmits(['orderCreated'])

// State
const orderLoading = ref(false)
const availability = ref({})
const orderQuantities = ref({})
const orderTotal = ref(0)
const availabilityLoading = ref(false)
const remainingCredits = ref(0)
const creditsLoading = ref(false)

// Snackbar
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
})

// Constants
const regions = [
  { id: 'netherlands', name: 'Netherlands', code: 'nl' },
  { id: 'saudi arabia', name: 'Saudi Arabia', code: 'sa' },
  { id: 'canada', name: 'Canada', code: 'ca' },
  { id: 'france', name: 'France', code: 'fr' },
  { id: 'germany', name: 'Germany', code: 'de' },
  { id: 'switzerland', name: 'Switzerland', code: 'ch' },
  { id: 'sweden', name: 'Sweden', code: 'se' },
  { id: 'usa', name: 'United States', code: 'us' },
  { id: 'usa auto', name: 'USA Auto', code: 'us' }
]

// Methods
const showSnackbar = (text, color = 'success') => {
  snackbar.value = { show: true, text, color }
}

// Fetch user's credit balance for BC Gen
const fetchCredits = async () => {
  creditsLoading.value = true
  
  try {
    const data = await usersApi.checkAccess()
    
    // Get BC Gen specific credits
    const bcGenData = data.subscriptions?.bc_gen
    remainingCredits.value = bcGenData?.totalCredits || 0
  } catch (err) {
    showSnackbar(err.message || 'Failed to fetch credits', 'error')
    remainingCredits.value = 0
  } finally {
    creditsLoading.value = false
  }
}

const updateOrderTotal = () => {
  let total = 0
  Object.values(orderQuantities.value).forEach(qty => {
    total += qty || 0
  })
  orderTotal.value = total
}

const incrementQuantity = (regionId) => {
  const current = orderQuantities.value[regionId] || 0
  const max = availability.value[regionId] || 0
  
  if (current < max) {
    orderQuantities.value[regionId] = current + 1
    updateOrderTotal()
  }
}

const decrementQuantity = (regionId) => {
  const current = orderQuantities.value[regionId] || 0
  
  if (current > 0) {
    orderQuantities.value[regionId] = current - 1
    updateOrderTotal()
  }
}

const checkAvailability = async () => {
  availabilityLoading.value = true
  
  try {
    const response = await bcgenApi.getAvailability()
    
    if (response.error) {
      showSnackbar(response.error, 'error')
      return
    }
    
    availability.value = response
    
    // Initialize order quantities
    regions.forEach(region => {
      if (!orderQuantities.value[region.id]) {
        orderQuantities.value[region.id] = 0
      }
    })
  } catch (error) {
    showSnackbar(error.message || 'Failed to check availability', 'error')
  } finally {
    availabilityLoading.value = false
  }
}

const handleCreateOrder = async () => {
  // Collect orders for each region
  const ordersToPlace = []
  
  for (const region of regions) {
    const quantity = orderQuantities.value[region.id]
    if (quantity > 0) {
      ordersToPlace.push({ country: region.id, quantity })
    }
  }
  
  if (ordersToPlace.length === 0) {
    showSnackbar('Please select at least one account', 'warning')
    return
  }
  
  // Check if user has enough credits
  if (orderTotal.value > remainingCredits.value) {
    showSnackbar(`Insufficient credits. You need ${orderTotal.value} credits but only have ${remainingCredits.value}`, 'error')
    return
  }
  
  orderLoading.value = true
  
  try {
    const successfulOrders = []
    const failedOrders = []
    
    // Place orders for each region
    for (const order of ordersToPlace) {
      const response = await bcgenApi.createOrder(
        order.country,
        order.quantity
      )
      
      if (response.error) {
        failedOrders.push({ 
          country: order.country, 
          error: response.error,
          available: response.available 
        })
        continue
      }
      
      successfulOrders.push({
        country: order.country,
        quantity: order.quantity,
        orderId: response.orderId
      })
    }
    
    // Show results
    if (successfulOrders.length > 0) {
      const successMsg = successfulOrders.map(o => 
        `${o.country}: ${o.quantity} accounts (Order ID: ${o.orderId})`
      ).join('\n')
      showSnackbar(`Orders created successfully!\n${successMsg}`, 'success')
    }
    
    if (failedOrders.length > 0) {
      failedOrders.forEach(f => {
        if (f.available !== undefined) {
          showSnackbar(`${f.country}: ${f.error}`, 'error')
        } else {
          showSnackbar(`${f.country}: ${f.error}`, 'error')
        }
      })
    }
    
    // Reset quantities only for successful orders
    successfulOrders.forEach(order => {
      orderQuantities.value[order.country] = 0
    })
    
    // Update quantities for failed orders based on availability
    failedOrders.forEach(f => {
      if (f.available !== undefined && f.available < orderQuantities.value[f.country]) {
        orderQuantities.value[f.country] = f.available
      }
    })
    
    updateOrderTotal()
    
    // Refresh availability and credits
    await checkAvailability()
    await fetchCredits()
    
    // Emit event to refresh orders list if any orders were successful
    if (successfulOrders.length > 0) {
      emit('orderCreated')
    }
  } catch (error) {
    showSnackbar(error.message || 'Failed to create orders', 'error')
  } finally {
    orderLoading.value = false
  }
}

// Check availability on mount
onMounted(() => {
  checkAvailability()
  fetchCredits()
})
</script>

<style scoped>
.region-card {
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.region-card:hover {
  transform: translateY(-2px);
}

.selected-card {
  border-color: rgb(var(--v-theme-primary)) !important;
}

.quantity-input {
  max-width: 60px;
}

.quantity-input-mobile {
  max-width: 45px;
}

.flag-image {
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.quantity-input :deep(.v-field__input),
.quantity-input-mobile :deep(.v-field__input) {
  text-align: center;
  padding: 0 8px;
}

/* Hide number input spin buttons */
.quantity-input :deep(input[type="number"]::-webkit-inner-spin-button),
.quantity-input :deep(input[type="number"]::-webkit-outer-spin-button),
.quantity-input-mobile :deep(input[type="number"]::-webkit-inner-spin-button),
.quantity-input-mobile :deep(input[type="number"]::-webkit-outer-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}

.quantity-input :deep(input[type="number"]),
.quantity-input-mobile :deep(input[type="number"]) {
  -moz-appearance: textfield;
}

/* Mobile chip styles */
@media (max-width: 600px) {
  .v-chip {
    width: 100%;
    justify-content: center;
  }
  
  .v-chip__content {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  /* Ensure gap between chips */
  .gap-3 {
    gap: 16px !important;
  }
  
  .gap-3 > .v-chip {
    margin: 0 !important;
  }
}

/* Animation */
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
</style>