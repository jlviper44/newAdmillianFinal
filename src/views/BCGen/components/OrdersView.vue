<template>
  <v-card flat>
    <v-card-text>
      <div v-if="ordersLoading" class="text-center pa-4">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
        <p class="mt-2">Loading orders...</p>
      </div>
      
      <div v-else-if="orders.length === 0" class="text-center pa-8">
        <v-icon size="64" color="grey">mdi-cart-outline</v-icon>
        <p class="text-h6 mt-4 text-grey">No orders yet</p>
      </div>
      
      <div v-else>
        <v-card 
          v-for="order in orders" 
          :key="order.orderId"
          class="mb-4"
          elevation="2"
        >
          <!-- Order Header -->
          <v-card-title class="d-flex justify-space-between align-center pa-4">
            <div>
              <div class="text-h6">Order #{{ order.orderId }}</div>
              <div class="text-caption">{{ formatDate(order.createdAt) }}</div>
            </div>
            <div class="text-right">
              <v-chip 
                :color="getStatusColor(order.status)"
                text-color="white"
                class="mb-1"
              >
                {{ order.status?.toUpperCase() || 'PENDING' }}
              </v-chip>
              <div class="text-caption">
                {{ order.quantity || order.totalAccounts || 0 }} accounts • ${{ order.total || order.totalPrice || 0 }}
              </div>
            </div>
          </v-card-title>
          
          <!-- Order Items -->
          <v-card-text class="pt-0 pb-2">
            <div class="d-flex flex-wrap gap-2 mb-3">
              <v-chip 
                v-if="order.country"
                size="small"
                variant="outlined"
                color="primary"
              >
                {{ order.quantity || 1 }}x {{ order.country }}
              </v-chip>
              <v-chip 
                v-else-if="order.items"
                v-for="item in order.items" 
                :key="item.region"
                size="small"
                variant="outlined"
                color="primary"
              >
                {{ item.quantity }}x {{ item.region }}
              </v-chip>
            </div>
          </v-card-text>
          
          <!-- Order Actions -->
          <v-card-actions>
            <v-btn
              v-if="order.status === 'fulfilled' || order.status === 'completed'"
              @click="toggleAccounts(order.orderId)"
              color="secondary"
              block
              variant="outlined"
            >
              {{ expandedOrders[order.orderId] ? 'Hide' : 'View' }} Accounts
            </v-btn>
            <p v-else class="text-center w-100 text-grey pa-2">
              Order is being processed...
            </p>
          </v-card-actions>
          
          <!-- Accounts Container -->
          <v-expand-transition>
            <div v-if="expandedOrders[order.orderId]">
              <v-divider></v-divider>
              <v-card-text>
                <div v-if="loadingAccounts[order.orderId]" class="text-center pa-4">
                  <v-progress-circular indeterminate size="24"></v-progress-circular>
                  <p class="mt-2">Loading accounts...</p>
                </div>
                
                <div v-else-if="orderAccounts[order.orderId]">
                  <v-card 
                    v-for="(account, index) in orderAccounts[order.orderId]" 
                    :key="index"
                    class="mb-3 pa-3"
                    :variant="account.refunded ? 'tonal' : 'outlined'"
                    :color="account.refunded ? 'error' : ''"
                  >
                    <div class="d-flex justify-space-between align-center mb-2">
                      <div class="font-weight-bold">
                        Account #{{ index + 1 }} - {{ account.country || order.country }}
                      </div>
                      <div>
                        <v-chip 
                          v-if="account.refunded"
                          size="small"
                          color="error"
                        >
                          REFUNDED
                        </v-chip>
                        <v-btn
                          v-else-if="canRefund(order)"
                          @click="requestRefund(order.orderId, account.Username || account.username)"
                          size="small"
                          color="warning"
                          variant="outlined"
                          class="ml-2"
                        >
                          Request Refund
                        </v-btn>
                      </div>
                    </div>
                    
                    <!-- Account Details -->
                    <div class="account-details">
                      <!-- Username -->
                      <div class="detail-row">
                        <span class="detail-label">Username:</span>
                        <span class="detail-value">
                          <code>{{ account.Username || account.username || 'Not available' }}</code>
                          <v-btn 
                            v-if="account.Username || account.username"
                            @click="copyToClipboard(account.Username || account.username, 'Username')"
                            size="small"
                            color="success"
                            class="ml-2"
                          >
                            Copy
                          </v-btn>
                        </span>
                      </div>
                      
                      <!-- Password -->
                      <div class="detail-row">
                        <span class="detail-label">Password:</span>
                        <span class="detail-value">
                          <code>{{ account.Password || account.passTiktok || account.password || 'Not available' }}</code>
                          <v-btn 
                            v-if="account.Password || account.passTiktok || account.password"
                            @click="copyToClipboard(account.Password || account.passTiktok || account.password, 'Password')"
                            size="small"
                            color="success"
                            class="ml-2"
                          >
                            Copy Password
                          </v-btn>
                        </span>
                      </div>
                      
                      <!-- Email -->
                      <div class="detail-row" v-if="account.Email || account.mail">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value">
                          <code>{{ account.Email || account.mail }}</code>
                          <v-btn 
                            @click="copyToClipboard(account.Email || account.mail, 'Email')"
                            size="small"
                            color="success"
                            class="ml-2"
                          >
                            Copy Email
                          </v-btn>
                        </span>
                      </div>
                      
                      <!-- 2FA Secret -->
                      <div v-if="account['Recovery Code'] || account.code2fa">
                        <div class="detail-row">
                          <span class="detail-label">2FA Secret:</span>
                          <span class="detail-value">
                            <code class="two-fa-code">{{ account['Recovery Code'] || account.code2fa }}</code>
                            <v-btn 
                              @click="copyToClipboard(account['Recovery Code'] || account.code2fa, '2FA Secret')"
                              size="small"
                              color="secondary"
                              class="ml-2"
                            >
                              Copy Secret
                            </v-btn>
                          </span>
                        </div>
                        
                        <!-- TOTP Code -->
                        <div class="detail-row totp-row">
                          <span class="detail-label">2FA Login Code:</span>
                          <span class="detail-value">
                            <div class="totp-container">
                              <code class="totp-code">{{ totpCodes[`${order.orderId}-${index}`] || '------' }}</code>
                              <v-chip size="small" class="ml-2">
                                {{ totpTimers[`${order.orderId}-${index}`] || 30 }}s
                              </v-chip>
                              <v-btn 
                                @click="copyToClipboard(totpCodes[`${order.orderId}-${index}`], 'TOTP Code')"
                                size="small"
                                color="success"
                                class="ml-2"
                                :disabled="!totpCodes[`${order.orderId}-${index}`]"
                              >
                                Copy Code
                              </v-btn>
                              <v-btn 
                                @click="refreshTOTP(order.orderId, index, account['Recovery Code'] || account.code2fa)"
                                size="small"
                                color="info"
                                class="ml-2"
                              >
                                Refresh
                              </v-btn>
                            </div>
                          </span>
                        </div>
                      </div>
                      <div v-else class="detail-row">
                        <span class="detail-label">2FA:</span>
                        <span class="detail-value text-grey">Not configured</span>
                      </div>
                      
                      <!-- Cookies -->
                      <div class="detail-row">
                        <span class="detail-label">Cookies:</span>
                        <div class="d-flex align-start gap-2 mt-2">
                          <v-textarea
                            :model-value="account.cookies || 'N/A'"
                            readonly
                            rows="3"
                            variant="outlined"
                            density="compact"
                            class="flex-grow-1"
                          ></v-textarea>
                          <v-btn 
                            @click="copyToClipboard(account.cookies || '', 'Cookies')"
                            size="small"
                            color="success"
                          >
                            Copy Cookies
                          </v-btn>
                        </div>
                      </div>
                      
                      <!-- Email Password if exists -->
                      <div class="detail-row" v-if="account['Email Password']">
                        <span class="detail-label">Email Password:</span>
                        <span class="detail-value">
                          <code>{{ account['Email Password'] }}</code>
                          <v-btn 
                            @click="copyToClipboard(account['Email Password'], 'Email Password')"
                            size="small"
                            color="success"
                            class="ml-2"
                          >
                            Copy
                          </v-btn>
                        </span>
                      </div>
                    </div>
                  </v-card>
                  
                  <!-- Refund Warning -->
                  <v-alert 
                    v-if="!canRefund(order) && !order.accounts?.some(a => a.refunded)"
                    type="warning"
                    variant="tonal"
                    class="mt-3"
                  >
                    <v-icon icon="mdi-alert"></v-icon>
                    Refund period has expired (24 hours)
                  </v-alert>
                </div>
              </v-card-text>
            </div>
          </v-expand-transition>
        </v-card>
      </div>
      
      <!-- Snackbar for notifications -->
      <v-snackbar v-model="snackbar.show" :color="snackbar.color">
        {{ snackbar.text }}
        <template v-slot:actions>
          <v-btn variant="text" @click="snackbar.show = false">Close</v-btn>
        </template>
      </v-snackbar>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { bcgenApi } from '@/services/api'
import { useAuth } from '@/composables/useAuth'

const { user } = useAuth()

// State
const ordersLoading = ref(false)
const orders = ref([])
const expandedOrders = ref({})
const orderAccounts = ref({})
const loadingAccounts = ref({})
const totpCodes = ref({})
const totpTimers = ref({})
const totpIntervals = ref({})

// Snackbar
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
})

// Methods
const showSnackbar = (text, color = 'success') => {
  snackbar.value = { show: true, text, color }
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString()
}

const getStatusColor = (status) => {
  const colors = {
    pending: 'orange',
    completed: 'success',
    refunded: 'grey',
    failed: 'error'
  }
  return colors[status] || 'grey'
}

const loadUserOrders = async () => {
  ordersLoading.value = true
  try {
    const response = await bcgenApi.getUserOrders()
    
    if (response.error) {
      showSnackbar(response.error, 'error')
      return
    }
    
    orders.value = response.orders || []
  } catch (error) {
    showSnackbar(error.message || 'Failed to load orders', 'error')
  } finally {
    ordersLoading.value = false
  }
}

const toggleAccounts = async (orderId) => {
  if (expandedOrders.value[orderId]) {
    expandedOrders.value[orderId] = false
    
    // Clear TOTP intervals for this order
    Object.keys(totpIntervals.value).forEach(key => {
      if (key.startsWith(orderId)) {
        clearInterval(totpIntervals.value[key])
        delete totpIntervals.value[key]
        delete totpCodes.value[key]
        delete totpTimers.value[key]
      }
    })
    
    return
  }
  
  expandedOrders.value[orderId] = true
  
  if (orderAccounts.value[orderId]) {
    return
  }
  
  loadingAccounts.value[orderId] = true
  
  try {
    const response = await bcgenApi.getOrderStatus(orderId)
    
    if (response.error) {
      showSnackbar(response.error, 'error')
      return
    }
    
    orderAccounts.value[orderId] = response.order?.accounts || []
    
    // Start generating TOTP codes for accounts with 2FA
    if (response.order?.accounts) {
      response.order.accounts.forEach((account, index) => {
        if (account['Recovery Code'] || account.code2fa) {
          refreshTOTP(orderId, index, account['Recovery Code'] || account.code2fa)
        }
      })
    }
  } catch (error) {
    showSnackbar(error.message || 'Failed to load accounts', 'error')
  } finally {
    loadingAccounts.value[orderId] = false
  }
}

const copyToClipboard = async (text, label) => {
  try {
    await navigator.clipboard.writeText(text)
    showSnackbar(`${label} copied!`, 'success')
  } catch (error) {
    showSnackbar('Failed to copy', 'error')
  }
}

const requestRefund = async (orderId, accountUsername) => {
  try {
    const response = await bcgenApi.refundRequest(orderId, accountUsername)
    
    if (response.error) {
      showSnackbar(response.error, 'error')
      return
    }
    
    showSnackbar('Refund request submitted successfully!', 'success')
    await loadUserOrders()
    
    // Reload accounts if they're expanded
    if (expandedOrders.value[orderId]) {
      orderAccounts.value[orderId] = null
      await toggleAccounts(orderId)
    }
  } catch (error) {
    showSnackbar(error.message || 'Failed to request refund', 'error')
  }
}

const canRefund = (order) => {
  if (order.status !== 'completed' && order.status !== 'fulfilled') return false
  
  const orderDate = new Date(order.createdAt || order.fulfilledAt)
  const now = new Date()
  const hoursDiff = (now - orderDate) / (1000 * 60 * 60)
  
  return hoursDiff <= 24
}

// TOTP Implementation
const base32ToHex = (base32) => {
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  let bits = ""
  let hex = ""
  
  // Remove spaces and uppercase
  base32 = base32.replace(/\s/g, '').toUpperCase()
  
  for (let i = 0; i < base32.length; i++) {
    const val = base32chars.indexOf(base32.charAt(i))
    if (val === -1) throw new Error("Invalid base32 character")
    bits += val.toString(2).padStart(5, '0')
  }
  
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    const chunk = bits.substring(i, i + 8)
    hex += parseInt(chunk, 2).toString(16).padStart(2, '0')
  }
  
  return hex
}

const generateTOTP = async (secret, timeStep = 30) => {
  try {
    // Convert base32 secret to hex
    const hexSecret = base32ToHex(secret)
    
    // Get current time counter
    const counter = Math.floor(Date.now() / 1000 / timeStep)
    
    // Convert counter to 8-byte buffer
    const counterBuffer = new ArrayBuffer(8)
    const counterView = new DataView(counterBuffer)
    counterView.setBigUint64(0, BigInt(counter), false)
    
    // Convert hex secret to buffer
    const secretBuffer = new Uint8Array(hexSecret.match(/.{2}/g).map(byte => parseInt(byte, 16)))
    
    // Import secret as HMAC key
    const key = await crypto.subtle.importKey(
      'raw',
      secretBuffer,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    )
    
    // Generate HMAC
    const signature = await crypto.subtle.sign('HMAC', key, counterBuffer)
    const signatureArray = new Uint8Array(signature)
    
    // Dynamic truncation
    const offset = signatureArray[signatureArray.length - 1] & 0xf
    const code = (
      ((signatureArray[offset] & 0x7f) << 24) |
      ((signatureArray[offset + 1] & 0xff) << 16) |
      ((signatureArray[offset + 2] & 0xff) << 8) |
      (signatureArray[offset + 3] & 0xff)
    ) % 1000000
    
    // Pad with leading zeros
    return code.toString().padStart(6, '0')
  } catch (error) {
    console.error('TOTP generation error:', error)
    return null
  }
}

const getTimeRemaining = (timeStep = 30) => {
  const seconds = Math.floor(Date.now() / 1000)
  return timeStep - (seconds % timeStep)
}

const refreshTOTP = async (orderId, index, secret) => {
  const key = `${orderId}-${index}`
  
  // Clear existing interval
  if (totpIntervals.value[key]) {
    clearInterval(totpIntervals.value[key])
  }
  
  // Generate initial code
  const code = await generateTOTP(secret)
  if (code) {
    totpCodes.value[key] = code
    totpTimers.value[key] = getTimeRemaining()
    
    // Update every second
    totpIntervals.value[key] = setInterval(async () => {
      const remaining = getTimeRemaining()
      totpTimers.value[key] = remaining
      
      // Generate new code when timer resets
      if (remaining === 30) {
        const newCode = await generateTOTP(secret)
        if (newCode) {
          totpCodes.value[key] = newCode
        }
      }
    }, 1000)
  }
}

// Load orders on mount
onMounted(() => {
  loadUserOrders()
})

// Cleanup on unmount
onUnmounted(() => {
  // Clear all TOTP intervals
  Object.values(totpIntervals.value).forEach(interval => {
    clearInterval(interval)
  })
})
</script>

<style scoped>
/* Account Details Styles */
.account-details {
  margin-top: 16px;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 16px;
}

.detail-label {
  font-weight: 600;
  min-width: 120px;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.detail-value {
  flex: 1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-value code {
  background-color: rgba(var(--v-theme-surface-variant), 0.5);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9em;
}

.two-fa-code {
  background-color: rgba(var(--v-theme-primary), 0.1) !important;
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}

.totp-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.totp-code {
  font-size: 1.2em;
  font-weight: bold;
  letter-spacing: 0.1em;
  background-color: rgba(var(--v-theme-success), 0.1) !important;
  color: rgb(var(--v-theme-success));
  padding: 8px 12px !important;
}
</style>