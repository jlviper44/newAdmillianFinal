<template>
  <v-card flat>
    <v-card-text>
      <div v-if="ordersLoading" class="text-center pa-4">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
        <p class="mt-2">Loading refund requests...</p>
      </div>
      
      <div v-else-if="refundOrders.length === 0" class="text-center pa-8">
        <v-icon size="64" color="grey">mdi-cash-refund</v-icon>
        <p class="text-h6 mt-4 text-grey">No refund requests</p>
        <p class="text-body-2 text-grey">Orders with refund requests will appear here</p>
      </div>
      
      <div v-else>
        <v-card 
          v-for="order in refundOrders" 
          :key="order.orderId"
          class="mb-4"
          elevation="2"
        >
          <!-- Order Header -->
          <v-card-title class="d-flex justify-space-between align-center pa-4">
            <div>
              <div class="text-h6">Order #{{ order.orderId }}</div>
              <div class="d-flex align-center gap-2">
                <span class="text-caption">{{ formatDate(order.createdAt) }}</span>
                <v-chip 
                  v-if="order.refundStatus === 'pending'"
                  size="x-small"
                  color="warning"
                  variant="tonal"
                >
                  Refund Pending
                </v-chip>
                <v-chip 
                  v-else-if="order.refundStatus === 'approved'"
                  size="x-small"
                  color="success"
                  variant="tonal"
                >
                  Refund Approved
                </v-chip>
                <v-chip 
                  v-else-if="order.refundStatus === 'denied'"
                  size="x-small"
                  color="error"
                  variant="tonal"
                >
                  Refund Denied
                </v-chip>
                <v-chip 
                  v-else-if="order.status === 'refunded'"
                  size="x-small"
                  color="success"
                  variant="flat"
                >
                  Refunded
                </v-chip>
              </div>
            </div>
            <div class="text-right">
              <div class="text-caption">
                {{ order.quantity || order.totalAccounts || 0 }} accounts • {{ order.status === 'refunded' || order.refundStatus === 'approved' ? 0 : (order.totalPrice || 0) }} credits
              </div>
            </div>
          </v-card-title>
          
          <!-- Order Items -->
          <v-card-text class="pt-0 pb-2">
            <!-- Refund Information -->
            <v-alert 
              :type="order.refundStatus === 'approved' || order.status === 'refunded' ? 'success' : 
                     order.refundStatus === 'denied' ? 'error' : 'warning'"
              variant="tonal"
              density="compact"
              class="mb-0"
            >
              <div>
                <div class="font-weight-medium">
                  {{ order.refundStatus === 'pending' ? 'Refund request is being reviewed' : 
                     order.refundStatus === 'approved' ? 'Refund has been approved' :
                     order.refundStatus === 'denied' ? 'Refund request was denied' :
                     order.status === 'refunded' ? 'Refund completed' : 'Refund status unknown' }}
                </div>
                <div class="text-caption" v-if="order.refundRequestedAt">
                  Requested: {{ formatDate(order.refundRequestedAt) }}
                </div>
                <div class="text-caption mt-1" v-if="order.refundStatus === 'denied' && order.adminNotes">
                  <strong>Reason:</strong> {{ order.adminNotes }}
                </div>
                <div class="mt-2" v-if="order.refundStatus === 'approved' && order.checkoutLink">
                  <v-btn
                    :href="order.checkoutLink"
                    target="_blank"
                    color="primary"
                    size="small"
                    variant="flat"
                    prepend-icon="mdi-open-in-new"
                  >
                    Claim Refund
                  </v-btn>
                </div>
              </div>
            </v-alert>
          </v-card-text>
          
          <!-- Order Actions -->
          <v-card-actions>
            <v-row no-gutters>
              <v-col cols="12">
                <v-btn
                  v-if="order.status === 'fulfilled' || order.status === 'completed' || order.status === 'refunded'"
                  @click="toggleAccounts(order.orderId)"
                  color="secondary"
                  block
                  variant="outlined"
                >
                  {{ expandedOrders[order.orderId] ? 'Hide' : 'View' }} Accounts
                </v-btn>
                <p v-else-if="order.refundStatus === 'approved' && !order.checkoutLink" class="text-center w-100 text-grey pa-2">
                  Waiting for checkout link...
                </p>
                <p v-else-if="order.refundStatus === 'pending'" class="text-center w-100 text-grey pa-2">
                  Refund pending review
                </p>
                <p v-else class="text-center w-100 text-grey pa-2">
                  Order is being processed...
                </p>
              </v-col>
            </v-row>
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
                  <!-- Quick Actions Bar -->
                  <div class="d-flex justify-space-between align-center mb-4 pa-2">
                    <div class="text-h6">
                      <v-icon start color="primary">mdi-account-multiple</v-icon>
                      {{ orderAccounts[order.orderId].length }} Accounts
                    </div>
                    <v-btn
                      @click="copyAllAccounts(order)"
                      color="primary"
                      variant="flat"
                      size="small"
                      prepend-icon="mdi-content-copy"
                    >
                      Copy All
                    </v-btn>
                  </div>
                  
                  <v-card 
                    v-for="(account, index) in orderAccounts[order.orderId]" 
                    :key="index"
                    class="mb-4 account-card"
                    :variant="account.refunded ? 'tonal' : 'elevated'"
                    :color="account.refunded ? 'error' : ''"
                    elevation="2"
                  >
                    <!-- Account Header -->
                    <v-card-title class="account-header pa-4">
                      <div class="d-flex justify-space-between align-center w-100">
                        <div class="d-flex align-center">
                          <v-avatar 
                            :color="account.refunded ? 'error' : 'primary'"
                            size="40"
                            class="mr-3"
                          >
                            <span class="text-h6">{{ index + 1 }}</span>
                          </v-avatar>
                          <div>
                            <div class="text-h6">
                              {{ account.country || order.country }}
                              <v-chip 
                                size="small" 
                                variant="tonal"
                                class="ml-2"
                                :color="account.Status === 'Active' ? 'success' : 'warning'"
                              >
                                {{ account.Status || 'Active' }}
                              </v-chip>
                            </div>
                            <div class="text-caption text-grey">
                              ID: {{ account.ID || `${order.orderId}-${index + 1}` }}
                            </div>
                          </div>
                        </div>
                        <div>
                          <v-chip 
                            v-if="account.refunded"
                            color="error"
                            variant="elevated"
                            prepend-icon="mdi-close-circle"
                          >
                            REFUNDED
                          </v-chip>
                        </div>
                      </div>
                    </v-card-title>

                    <v-divider></v-divider>
                    
                    <!-- Account Details -->
                    <v-card-text class="pa-4">
                      <v-row>
                        <!-- Left Column - Compact Credentials -->
                        <v-col cols="12" md="6">
                          <v-card variant="outlined" class="pa-3 equal-height-card">
                            <div class="text-subtitle-2 text-grey mb-3">
                              <v-icon size="small" class="mr-1">mdi-account-details</v-icon>
                              Credentials
                            </div>
                            
                            <!-- Compact credential rows -->
                            <div class="compact-credentials">
                              <!-- Username -->
                              <div class="credential-row">
                                <span class="credential-label">Username</span>
                                <code class="credential-value">{{ account.Username || account.username || 'N/A' }}</code>
                                <v-btn 
                                  v-if="account.Username || account.username"
                                  @click="copyToClipboard(account.Username || account.username, 'Username')"
                                  icon="mdi-content-copy"
                                  size="x-small"
                                  variant="text"
                                  density="compact"
                                ></v-btn>
                              </div>
                              
                              <!-- Password -->
                              <div class="credential-row">
                                <span class="credential-label">Password</span>
                                <code class="credential-value">{{ account.Password || account.passTiktok || account.password || 'N/A' }}</code>
                                <v-btn 
                                  v-if="account.Password || account.passTiktok || account.password"
                                  @click="copyToClipboard(account.Password || account.passTiktok || account.password, 'Password')"
                                  icon="mdi-content-copy"
                                  size="x-small"
                                  variant="text"
                                  density="compact"
                                ></v-btn>
                              </div>
                              
                              <!-- Email -->
                              <div class="credential-row" v-if="account.Email || account.mail">
                                <span class="credential-label">Email</span>
                                <code class="credential-value">{{ account.Email || account.mail }}</code>
                                <v-btn 
                                  @click="copyToClipboard(account.Email || account.mail, 'Email')"
                                  icon="mdi-content-copy"
                                  size="x-small"
                                  variant="text"
                                  density="compact"
                                ></v-btn>
                              </div>
                              
                              <!-- Email Password -->
                              <div class="credential-row" v-if="account['Email Password']">
                                <span class="credential-label">Email Pass</span>
                                <code class="credential-value">{{ account['Email Password'] }}</code>
                                <v-btn 
                                  @click="copyToClipboard(account['Email Password'], 'Email Password')"
                                  icon="mdi-content-copy"
                                  size="x-small"
                                  variant="text"
                                  density="compact"
                                ></v-btn>
                              </div>
                              
                            </div>
                            
                            <!-- Action Buttons -->
                            <v-spacer></v-spacer>
                            <div class="mt-auto pt-3">
                              <v-btn
                                @click="copyAccountCredentials(account)"
                                color="primary"
                                variant="tonal"
                                size="small"
                                block
                                prepend-icon="mdi-content-copy"
                              >
                                Copy All Credentials
                              </v-btn>
                            </div>
                          </v-card>
                        </v-col>
                      
                        <!-- Right Column - 2FA & Cookies -->
                        <v-col cols="12" md="6">
                          <!-- 2FA Section -->
                          <v-card variant="outlined" class="pa-3 equal-height-card">
                            <div class="text-subtitle-2 text-grey mb-3">
                              <v-icon size="small" class="mr-1">mdi-shield-key</v-icon>
                              Two-Factor Auth
                            </div>
                            
                            <template v-if="account['Recovery Code'] || account.code2fa">
                              <div class="compact-credentials">
                                <!-- 2FA Secret -->
                                <div class="credential-row">
                                  <span class="credential-label">Secret</span>
                                  <code class="credential-value font-weight-bold">{{ account['Recovery Code'] || account.code2fa }}</code>
                                  <v-btn 
                                    @click="copyToClipboard(account['Recovery Code'] || account.code2fa, '2FA Secret')"
                                    icon="mdi-content-copy"
                                    size="x-small"
                                    variant="text"
                                    density="compact"
                                  ></v-btn>
                                </div>
                                
                                <!-- TOTP Code -->
                                <div class="credential-row" style="background: rgba(var(--v-theme-primary), 0.1);">
                                  <span class="credential-label">Code</span>
                                  <code class="totp-display-compact">{{ totpCodes[`${order.orderId}-${index}`] || '------' }}</code>
                                  <v-progress-circular
                                    :model-value="(30 - (totpTimers[`${order.orderId}-${index}`] || 30)) * 3.33"
                                    :size="24"
                                    :width="2"
                                    color="primary"
                                  >
                                    <span style="font-size: 0.65rem;">{{ totpTimers[`${order.orderId}-${index}`] || 30 }}</span>
                                  </v-progress-circular>
                                </div>
                                
                                <!-- Action Buttons -->
                                <div class="d-flex flex-column mt-3">
                                  <v-btn
                                    @click="copyToClipboard(totpCodes[`${order.orderId}-${index}`], 'TOTP Code')"
                                    color="primary"
                                    variant="tonal"
                                    size="small"
                                    block
                                    :disabled="!totpCodes[`${order.orderId}-${index}`]"
                                    prepend-icon="mdi-content-copy"
                                    class="mb-2"
                                  >
                                    Copy Code
                                  </v-btn>
                                  <v-btn
                                    @click="refreshTOTP(order.orderId, index, account['Recovery Code'] || account.code2fa)"
                                    color="secondary"
                                    variant="tonal"
                                    size="small"
                                    block
                                    prepend-icon="mdi-refresh"
                                  >
                                    Refresh Code
                                  </v-btn>
                                </div>
                              </div>
                            </template>
                            <template v-else>
                              <div class="d-flex align-center justify-center flex-grow-1">
                                <span class="text-caption text-grey">
                                  <v-icon size="small" class="mr-1">mdi-shield-off</v-icon>
                                  Not configured
                                </span>
                              </div>
                            </template>
                          </v-card>
                        </v-col>
                      </v-row>

                      <!-- Cookies Section - Full Width -->
                      <div class="mt-3">
                        <v-card variant="tonal" color="grey" density="compact">
                          <v-card-title class="d-flex justify-space-between align-center py-2">
                            <span class="text-subtitle-2">
                              <v-icon size="x-small" class="mr-1">mdi-cookie</v-icon>
                              Cookies
                            </span>
                            <v-btn 
                              @click="copyToClipboard(account.cookies || '', 'Cookies')"
                              color="primary"
                              variant="flat"
                              size="x-small"
                              prepend-icon="mdi-content-copy"
                              :disabled="!account.cookies"
                            >
                              Copy
                            </v-btn>
                          </v-card-title>
                          <v-divider></v-divider>
                          <v-card-text class="pa-0">
                            <pre class="cookies-code"><code>{{ account.cookies || 'No cookies available' }}</code></pre>
                          </v-card-text>
                        </v-card>
                      </div>
                    </v-card-text>
                  </v-card>
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
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { bcgenApi } from '@/services/api'

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

// Computed - filter only orders with refund requests
const refundOrders = computed(() => {
  return orders.value.filter(order => 
    order.refundStatus || order.status === 'refunded'
  )
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
    // Re-start TOTP generation for existing accounts
    orderAccounts.value[orderId].forEach((account, index) => {
      if (account['Recovery Code'] || account.code2fa) {
        refreshTOTP(orderId, index, account['Recovery Code'] || account.code2fa)
      }
    })
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

const copyAccountCredentials = async (account) => {
  let text = `Username: ${account.Username || account.username}\n`
  text += `Password: ${account.Password || account.password}\n`
  
  if (account['Recovery Code'] || account.code2fa) {
    text += `2FA Secret: ${account['Recovery Code'] || account.code2fa}\n`
  }
  
  if (account.Email || account.mail) {
    text += `Email: ${account.Email || account.mail}\n`
  }
  
  if (account['Email Password']) {
    text += `Email Password: ${account['Email Password']}\n`
  }
  
  try {
    await navigator.clipboard.writeText(text)
    showSnackbar('Account credentials copied!', 'success')
  } catch (error) {
    showSnackbar('Failed to copy credentials', 'error')
  }
}

const copyAllAccounts = async (order) => {
  const accounts = orderAccounts.value[order.orderId]
  if (!accounts || accounts.length === 0) return
  
  let allText = `Order #${order.orderId} - ${order.country}\n\n`
  
  accounts.forEach((account, index) => {
    allText += `Account #${index + 1}:\n`
    allText += `Username: ${account.Username || account.username}\n`
    allText += `Password: ${account.Password || account.password}\n`
    if (account['Recovery Code'] || account.code2fa) {
      allText += `2FA Secret: ${account['Recovery Code'] || account.code2fa}\n`
    }
    if (account.Email || account.mail) {
      allText += `Email: ${account.Email || account.mail}\n`
    }
    if (account['Email Password']) {
      allText += `Email Password: ${account['Email Password']}\n`
    }
    allText += '\n'
  })
  
  try {
    await navigator.clipboard.writeText(allText)
    showSnackbar('All accounts copied!', 'success')
  } catch (error) {
    showSnackbar('Failed to copy accounts', 'error')
  }
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
    
    return code.toString().padStart(6, '0')
  } catch (error) {
    return '------'
  }
}

const refreshTOTP = async (orderId, accountIndex, secret) => {
  const key = `${orderId}-${accountIndex}`
  
  // Clear existing interval
  if (totpIntervals.value[key]) {
    clearInterval(totpIntervals.value[key])
  }
  
  // Generate initial code
  const code = await generateTOTP(secret)
  totpCodes.value[key] = code
  
  // Update timer
  const updateTimer = () => {
    const now = Date.now()
    const timeStep = 30000 // 30 seconds in milliseconds
    const timeRemaining = Math.ceil((timeStep - (now % timeStep)) / 1000)
    totpTimers.value[key] = timeRemaining
    
    if (timeRemaining === 30) {
      // Generate new code
      generateTOTP(secret).then(newCode => {
        totpCodes.value[key] = newCode
      })
    }
  }
  
  // Update immediately and then every second
  updateTimer()
  totpIntervals.value[key] = setInterval(updateTimer, 1000)
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

// Expose refresh method for parent component
defineExpose({
  refreshOrders: loadUserOrders
})
</script>

<style scoped>
/* Account Card Styles */
.account-card {
  transition: all 0.3s ease;
  overflow: hidden;
}

.account-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.account-header {
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.05) 0%, rgba(var(--v-theme-primary), 0.02) 100%);
}

/* Equal Height Cards */
.equal-height-card {
  height: 100%;
  min-height: 220px;
  display: flex;
  flex-direction: column;
}

.equal-height-card .compact-credentials {
  flex: 1 0 auto;
}

/* Credentials styling */
.compact-credentials {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.credential-row {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 6px;
  transition: background 0.2s;
}

.credential-row:hover {
  background: rgba(0, 0, 0, 0.05);
}

.credential-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.6);
  min-width: 80px;
}

.credential-value {
  flex: 1;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.9);
  padding: 0 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Cookies Code Block */
.cookies-code {
  margin: 0;
  padding: 12px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 0;
  overflow-x: auto;
  max-height: 80px;
  overflow-y: auto;
}

.cookies-code code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.9);
  white-space: pre-wrap;
  word-break: break-all;
}

/* TOTP Display */
.totp-display-compact {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgb(var(--v-theme-primary));
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  padding: 0 8px;
}

/* Custom scrollbar for cookies */
.cookies-code::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.cookies-code::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
}

.cookies-code::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.cookies-code::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

.cookies-code::-webkit-scrollbar-corner {
  background: transparent;
}

/* Responsive adjustments */
@media (max-width: 960px) {
  .credential-text {
    font-size: 0.85em;
  }
  
  .totp-display {
    font-size: 1.2em;
  }
}
</style>