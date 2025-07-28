<template>
  <v-card flat>
    <v-card-text :class="{ 'pa-3': $vuetify.display.smAndDown }">
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
          <v-card-title :class="[
            'd-flex',
            $vuetify.display.smAndDown ? 'flex-column pa-3' : 'justify-space-between align-center pa-4'
          ]">
            <div :class="{ 'mb-2': $vuetify.display.smAndDown }">
              <div :class="$vuetify.display.smAndDown ? 'text-body-1 font-weight-bold' : 'text-h6'">Order #{{ order.orderId }}</div>
              <div :class="[
                'd-flex align-center gap-2',
                { 'flex-wrap': $vuetify.display.smAndDown }
              ]">
                <span :class="$vuetify.display.smAndDown ? 'text-caption' : 'text-caption'">{{ formatDateTime(order.createdAt) }}</span>
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
                  v-else-if="isWithin24Hours(order.createdAt) && order.status !== 'refunded' && (order.status === 'fulfilled' || order.status === 'completed')"
                  size="x-small"
                  color="info"
                  variant="tonal"
                >
                  Refundable
                </v-chip>
              </div>
            </div>
            <div :class="$vuetify.display.smAndDown ? 'w-100' : 'text-right'">
              <div :class="$vuetify.display.smAndDown ? 'd-flex justify-space-between align-center' : ''">
                <v-chip 
                  :color="getStatusColor(order.status)"
                  text-color="white"
                  :size="$vuetify.display.smAndDown ? 'small' : 'default'"
                  :class="$vuetify.display.smAndDown ? '' : 'mb-1'"
                >
                  {{ order.status?.toUpperCase() || 'PENDING' }}
                </v-chip>
                <div :class="$vuetify.display.smAndDown ? 'text-caption' : 'text-caption'">
                  {{ order.quantity || order.totalAccounts || 0 }} accounts • ${{ order.total || order.totalPrice || 0 }}
                </div>
              </div>
            </div>
          </v-card-title>
          
          <!-- Order Items -->
          <v-card-text :class="$vuetify.display.smAndDown ? 'pt-0 pb-2 px-3' : 'pt-0 pb-2'">
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
          <v-card-actions :class="{ 'pa-3': $vuetify.display.smAndDown }">
            <v-row no-gutters :dense="$vuetify.display.smAndDown">
              <v-col 
                :cols="(order.status === 'fulfilled' || order.status === 'completed') && isWithin24Hours(order.createdAt) && order.status !== 'refunded' ? 6 : 12"
                :class="(order.status === 'fulfilled' || order.status === 'completed') && isWithin24Hours(order.createdAt) && order.status !== 'refunded' ? 'pr-1' : ''"
              >
                <v-btn
                  v-if="order.status === 'fulfilled' || order.status === 'completed'"
                  @click="toggleAccounts(order.orderId)"
                  color="secondary"
                  block
                  variant="outlined"
                  :size="$vuetify.display.smAndDown ? 'small' : 'default'"
                >
                  {{ expandedOrders[order.orderId] ? 'Hide' : 'View' }} Accounts
                </v-btn>
                <p v-else class="text-center w-100 text-grey pa-2">
                  Order is being processed...
                </p>
              </v-col>
              <v-col 
                v-if="(order.status === 'fulfilled' || order.status === 'completed') && isWithin24Hours(order.createdAt) && order.status !== 'refunded'"
                cols="6"
                class="pl-1"
              >
                <v-btn
                  v-if="!order.refundStatus"
                  @click="openRefundDialog(order)"
                  color="warning"
                  block
                  variant="outlined"
                  :prepend-icon="$vuetify.display.smAndDown ? '' : 'mdi-cash-refund'"
                  :size="$vuetify.display.smAndDown ? 'small' : 'default'"
                >
                  <v-icon v-if="$vuetify.display.smAndDown" start size="small">mdi-cash-refund</v-icon>
                  {{ $vuetify.display.smAndDown ? 'Refund' : 'Request Refund' }}
                </v-btn>
                <v-btn
                  v-else-if="order.refundStatus === 'pending'"
                  color="grey"
                  block
                  variant="outlined"
                  disabled
                  :prepend-icon="$vuetify.display.smAndDown ? '' : 'mdi-clock-outline'"
                  :size="$vuetify.display.smAndDown ? 'small' : 'default'"
                >
                  <v-icon v-if="$vuetify.display.smAndDown" start size="small">mdi-clock-outline</v-icon>
                  {{ $vuetify.display.smAndDown ? 'Waiting' : 'Waiting for Response' }}
                </v-btn>
                <v-btn
                  v-else-if="order.refundStatus === 'approved'"
                  color="success"
                  block
                  variant="tonal"
                  disabled
                  :prepend-icon="$vuetify.display.smAndDown ? '' : 'mdi-check-circle'"
                  :size="$vuetify.display.smAndDown ? 'small' : 'default'"
                >
                  <v-icon v-if="$vuetify.display.smAndDown" start size="small">mdi-check-circle</v-icon>
                  {{ $vuetify.display.smAndDown ? 'Approved' : 'Refund Approved' }}
                </v-btn>
              </v-col>
            </v-row>
          </v-card-actions>
          
          <!-- Accounts Container -->
          <v-expand-transition>
            <div v-if="expandedOrders[order.orderId]">
              <v-divider></v-divider>
              <v-card-text :class="{ 'pa-3': $vuetify.display.smAndDown }">
                <div v-if="loadingAccounts[order.orderId]" class="text-center pa-4">
                  <v-progress-circular indeterminate size="24"></v-progress-circular>
                  <p class="mt-2">Loading accounts...</p>
                </div>
                
                <div v-else-if="orderAccounts[order.orderId]">
                  <!-- Quick Actions Bar -->
                  <div :class="[
                    'd-flex align-center mb-4 pa-2',
                    $vuetify.display.smAndDown ? 'flex-column gap-2' : 'justify-space-between'
                  ]">
                    <div :class="$vuetify.display.smAndDown ? 'text-body-1 font-weight-bold' : 'text-h6'">
                      <v-icon start color="primary" :size="$vuetify.display.smAndDown ? 'small' : 'default'">mdi-account-multiple</v-icon>
                      {{ orderAccounts[order.orderId].length }} Accounts
                    </div>
                    <v-btn
                      @click="copyAllAccounts(order)"
                      color="primary"
                      variant="tonal"
                      :prepend-icon="$vuetify.display.smAndDown ? '' : 'mdi-content-copy'"
                      :size="$vuetify.display.smAndDown ? 'small' : 'default'"
                      :block="$vuetify.display.smAndDown"
                    >
                      <v-icon v-if="$vuetify.display.smAndDown" start size="small">mdi-content-copy</v-icon>
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
                    <v-card-title :class="[
                      'account-header',
                      $vuetify.display.smAndDown ? 'pa-3' : 'pa-4'
                    ]">
                      <div :class="[
                        'd-flex align-center w-100',
                        $vuetify.display.smAndDown ? 'flex-column' : 'justify-space-between'
                      ]">
                        <div :class="[
                          'd-flex align-center',
                          { 'mb-2': $vuetify.display.smAndDown }
                        ]">
                          <v-avatar 
                            :color="account.refunded ? 'error' : 'primary'"
                            :size="$vuetify.display.smAndDown ? '32' : '40'"
                            :class="$vuetify.display.smAndDown ? 'mr-2' : 'mr-3'"
                          >
                            <span :class="$vuetify.display.smAndDown ? 'text-body-2' : 'text-h6'">{{ index + 1 }}</span>
                          </v-avatar>
                          <div>
                            <div :class="$vuetify.display.smAndDown ? 'text-body-2' : 'text-h6'">
                              {{ account.country || order.country }}
                              <v-chip 
                                :size="$vuetify.display.smAndDown ? 'x-small' : 'small'" 
                                variant="tonal"
                                :class="$vuetify.display.smAndDown ? 'ml-1' : 'ml-2'"
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
                        <div v-if="!$vuetify.display.smAndDown || account.refunded">
                          <v-chip 
                            v-if="account.refunded"
                            color="error"
                            variant="elevated"
                            :prepend-icon="$vuetify.display.smAndDown ? '' : 'mdi-close-circle'"
                            :size="$vuetify.display.smAndDown ? 'small' : 'default'"
                          >
                            <v-icon v-if="$vuetify.display.smAndDown" start size="small">mdi-close-circle</v-icon>
                            REFUNDED
                          </v-chip>
                        </div>
                      </div>
                    </v-card-title>

                    <v-divider></v-divider>
                    
                    <!-- Account Details -->
                    <v-card-text :class="$vuetify.display.smAndDown ? 'pa-3' : 'pa-4'">
                      <v-row :dense="$vuetify.display.smAndDown">
                        <!-- Left Column - Compact Credentials -->
                        <v-col cols="12" :md="$vuetify.display.smAndDown ? '12' : '6'">
                          <v-card variant="outlined" :class="$vuetify.display.smAndDown ? 'pa-2 mb-3' : 'pa-3 equal-height-card'">
                            <div :class="$vuetify.display.smAndDown ? 'text-caption text-grey mb-2' : 'text-subtitle-2 text-grey mb-3'">
                              <v-icon size="small" class="mr-1">mdi-account-details</v-icon>
                              Credentials
                            </div>
                            
                            <!-- Compact credential rows -->
                            <div :class="$vuetify.display.smAndDown ? 'compact-credentials-mobile' : 'compact-credentials'">
                              <!-- Username -->
                              <div :class="$vuetify.display.smAndDown ? 'credential-row-mobile' : 'credential-row'">
                                <span :class="$vuetify.display.smAndDown ? 'credential-label-mobile' : 'credential-label'">Username</span>
                                <code :class="$vuetify.display.smAndDown ? 'credential-value-mobile' : 'credential-value'">{{ account.Username || account.username || 'N/A' }}</code>
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
                              <div :class="$vuetify.display.smAndDown ? 'credential-row-mobile' : 'credential-row'">
                                <span :class="$vuetify.display.smAndDown ? 'credential-label-mobile' : 'credential-label'">Password</span>
                                <code :class="$vuetify.display.smAndDown ? 'credential-value-mobile' : 'credential-value'">{{ account.Password || account.passTiktok || account.password || 'N/A' }}</code>
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
                              <div :class="$vuetify.display.smAndDown ? 'credential-row-mobile' : 'credential-row'" v-if="account.Email || account.mail">
                                <span :class="$vuetify.display.smAndDown ? 'credential-label-mobile' : 'credential-label'">Email</span>
                                <code :class="$vuetify.display.smAndDown ? 'credential-value-mobile' : 'credential-value'">{{ account.Email || account.mail }}</code>
                                <v-btn 
                                  @click="copyToClipboard(account.Email || account.mail, 'Email')"
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
                                class="mb-2"
                              >
                                Copy All Credentials
                              </v-btn>
                              <v-btn
                                v-if="account.Email || account.mail"
                                @click="checkAccountEmail(account)"
                                color="secondary"
                                variant="tonal"
                                size="small"
                                block
                                prepend-icon="mdi-email-check"
                              >
                                Check Email
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

  <!-- Refund Dialog -->
  <v-dialog 
    v-model="refundDialog" 
    :max-width="$vuetify.display.smAndDown ? '100%' : '500'"
    :fullscreen="$vuetify.display.smAndDown"
    :transition="$vuetify.display.smAndDown ? 'dialog-bottom-transition' : 'dialog-transition'"
  >
    <v-card :class="{ 'mobile-dialog-card': $vuetify.display.smAndDown }">
      <v-card-title :class="{ 'pa-3': $vuetify.display.smAndDown }">
        <v-icon class="mr-2" :size="$vuetify.display.smAndDown ? 'small' : 'default'">mdi-cash-refund</v-icon>
        <span :class="$vuetify.display.smAndDown ? 'text-body-1' : ''">Request Refund</span>
      </v-card-title>
      
      <v-card-text :class="{ 'pa-3': $vuetify.display.smAndDown }">
        <v-alert type="info" variant="tonal" class="mb-4">
          You are requesting a refund for:
          <div class="mt-2 font-weight-medium">Order #{{ refundOrder?.orderId }}</div>
        </v-alert>
        
        <v-textarea
          v-model="refundReason"
          label="Reason for refund"
          placeholder="Please explain why you are requesting a refund..."
          rows="4"
          required
          variant="outlined"
          :error-messages="!refundReason.trim() && refundLoading ? ['Reason is required'] : []"
        ></v-textarea>
      </v-card-text>
      
      <v-card-actions :class="{ 'pa-3': $vuetify.display.smAndDown }">
        <v-spacer></v-spacer>
        <v-btn
          @click="refundDialog = false"
          :disabled="refundLoading"
          :size="$vuetify.display.smAndDown ? 'small' : 'default'"
        >
          Cancel
        </v-btn>
        <v-btn
          @click="submitRefund"
          color="warning"
          variant="flat"
          :loading="refundLoading"
          :size="$vuetify.display.smAndDown ? 'small' : 'default'"
        >
          Submit Request
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Email Check Dialog -->
  <v-dialog 
    v-model="emailModal" 
    :max-width="$vuetify.display.smAndDown ? '100%' : '800'"
    :fullscreen="$vuetify.display.smAndDown"
    :transition="$vuetify.display.smAndDown ? 'dialog-bottom-transition' : 'dialog-transition'"
  >
    <v-card :class="{ 'mobile-dialog-card': $vuetify.display.smAndDown }">
      <v-card-title class="d-flex justify-space-between align-center" :class="{ 'pa-3': $vuetify.display.smAndDown }">
        <div class="d-flex align-center">
          <v-icon class="mr-2" :size="$vuetify.display.smAndDown ? 'small' : 'default'">mdi-email-check</v-icon>
          <span :class="$vuetify.display.smAndDown ? 'text-body-1' : ''">Email Check Results</span>
        </div>
        <v-btn 
          icon="mdi-close" 
          variant="text" 
          @click="emailModal = false"
          :size="$vuetify.display.smAndDown ? 'small' : 'default'"
        ></v-btn>
      </v-card-title>
      
      <v-card-text :class="{ 'pa-3': $vuetify.display.smAndDown }">
        <div v-if="emailLoading" class="text-center pa-8">
          <v-progress-circular indeterminate color="primary"></v-progress-circular>
          <p class="mt-4">Checking emails...</p>
        </div>
        
        <div v-else-if="emailContent && emailContent.parsed && emailContent.parsed.success && emailContent.parsed.data">
          <v-alert 
            type="info" 
            variant="tonal" 
            class="mb-4"
          >
            Found {{ emailContent.parsed.data.length }} email(s) for {{ emailAccount.Email || emailAccount.mail }}
          </v-alert>
          
          <v-card 
            v-for="(email, index) in emailContent.parsed.data" 
            :key="index"
            class="mb-3"
            variant="outlined"
          >
            <v-card-title class="py-3">
              <div class="d-flex justify-space-between align-center w-100">
                <div>
                  <div class="text-subtitle-1">{{ email.from_email || 'Unknown Sender' }}</div>
                  <div class="text-caption text-grey">{{ email.date || 'No date' }}</div>
                </div>
                <v-chip 
                  v-if="email.subject && email.subject.includes('verification')"
                  color="primary"
                  size="small"
                >
                  Verification
                </v-chip>
              </div>
            </v-card-title>
            
            <v-card-text>
              <div class="text-subtitle-2 mb-2">{{ email.subject || 'No subject' }}</div>
              
              <!-- Show verification codes if found -->
              <div v-if="email.code || email.verification_code" class="mb-3">
                <v-alert type="success" variant="tonal" density="compact">
                  <div class="d-flex justify-space-between align-center">
                    <div>
                      <strong>Verification Code:</strong> 
                      <code class="ml-2 text-h6">{{ email.code || email.verification_code }}</code>
                    </div>
                    <v-btn
                      @click="copyToClipboard(email.code || email.verification_code, 'Verification code')"
                      color="primary"
                      size="small"
                      variant="tonal"
                      prepend-icon="mdi-content-copy"
                    >
                      Copy
                    </v-btn>
                  </div>
                </v-alert>
              </div>
              
              <!-- Email content preview -->
              <v-expansion-panels v-if="email.text || email.html">
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <v-icon class="mr-2" size="small">mdi-text</v-icon>
                    View Full Content
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <pre class="email-content">{{ email.text || stripHtml(email.html) || 'No content' }}</pre>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-card-text>
          </v-card>
        </div>
        
        <div v-else-if="emailContent && emailContent.content">
          <v-alert type="info" variant="tonal" class="mb-4">
            Raw email response received
          </v-alert>
          <v-card variant="tonal">
            <v-card-text>
              <pre class="email-content">{{ emailContent.content }}</pre>
            </v-card-text>
          </v-card>
        </div>
        
        <div v-else>
          <v-alert type="warning" variant="tonal">
            No emails found for this account
          </v-alert>
        </div>
      </v-card-text>
      
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn
          @click="emailModal = false"
          color="primary"
          variant="flat"
        >
          Close
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { bcgenApi } from '@/services/api'
import { useAuth } from '@/composables/useAuth'
import { formatDateTime } from '@/utils/dateFormatter'

const { user } = useAuth()

// Define emits
const emit = defineEmits(['refund-requested'])

// State
const ordersLoading = ref(false)
const allOrders = ref([])

// Computed - filter out orders with refund requests
const orders = computed(() => {
  return allOrders.value.filter(order => 
    !order.refundStatus && order.status !== 'refunded'
  )
})
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

// formatDateTime is now imported from utils/dateFormatter

const getStatusColor = (status) => {
  const colors = {
    pending: 'orange',
    completed: 'success',
    refunded: 'grey',
    failed: 'error'
  }
  return colors[status] || 'grey'
}

const isWithin24Hours = (dateString) => {
  const orderDate = new Date(dateString)
  const now = new Date()
  const diffInHours = (now - orderDate) / (1000 * 60 * 60)
  return diffInHours <= 24
}

// Refund dialog state
const refundDialog = ref(false)
const refundOrder = ref(null)
const refundReason = ref('')
const refundLoading = ref(false)

const openRefundDialog = (order) => {
  refundOrder.value = order
  refundReason.value = ''
  refundDialog.value = true
}

const submitRefund = async () => {
  if (!refundReason.value.trim()) {
    showSnackbar('Please provide a reason for the refund', 'warning')
    return
  }

  refundLoading.value = true
  try {
    const response = await bcgenApi.requestRefund(refundOrder.value.orderId, refundReason.value)
    
    if (response.error) {
      showSnackbar(response.error, 'error')
      return
    }
    
    showSnackbar('Refund request submitted successfully', 'success')
    refundDialog.value = false
    // Refresh orders to update status
    await loadUserOrders()
    // Emit event to parent to refresh refunds view
    emit('refund-requested')
  } catch (error) {
    showSnackbar('Failed to submit refund request', 'error')
  } finally {
    refundLoading.value = false
  }
}

const loadUserOrders = async () => {
  ordersLoading.value = true
  try {
    const response = await bcgenApi.getUserOrders()
    
    if (response.error) {
      showSnackbar(response.error, 'error')
      return
    }
    
    allOrders.value = response.orders || []
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

// Copy all account details
const copyAccountDetails = async (account) => {
  const details = []
  details.push('=== Account Details ===')
  if (account.Username || account.username) details.push(`Username: ${account.Username || account.username}`)
  if (account.Password || account.passTiktok || account.password) details.push(`Password: ${account.Password || account.passTiktok || account.password}`)
  if (account.Email || account.mail) details.push(`Email: ${account.Email || account.mail}`)
  if (account['Recovery Code'] || account.code2fa) details.push(`2FA Secret: ${account['Recovery Code'] || account.code2fa}`)
  if (account.cookies) details.push(`Cookies: ${account.cookies}`)
  
  try {
    await navigator.clipboard.writeText(details.join('\n'))
    showSnackbar('All account details copied!', 'success')
  } catch (error) {
    showSnackbar('Failed to copy details', 'error')
  }
}

// Copy account credentials only
const copyAccountCredentials = async (account) => {
  const credentials = []
  if (account.Username || account.username) credentials.push(`Username: ${account.Username || account.username}`)
  if (account.Password || account.passTiktok || account.password) credentials.push(`Password: ${account.Password || account.passTiktok || account.password}`)
  if (account.Email || account.mail) credentials.push(`Email: ${account.Email || account.mail}`)
  
  try {
    await navigator.clipboard.writeText(credentials.join('\n'))
    showSnackbar('Credentials copied!', 'success')
  } catch (error) {
    showSnackbar('Failed to copy credentials', 'error')
  }
}

// Copy all accounts for an order
const copyAllAccounts = async (order) => {
  const accounts = orderAccounts.value[order.orderId]
  if (!accounts || accounts.length === 0) return
  
  const allDetails = []
  accounts.forEach((account, index) => {
    allDetails.push(`\n=== Account #${index + 1} ===`)
    if (account.Username || account.username) allDetails.push(`Username: ${account.Username || account.username}`)
    if (account.Password || account.passTiktok || account.password) allDetails.push(`Password: ${account.Password || account.passTiktok || account.password}`)
    if (account.Email || account.mail) allDetails.push(`Email: ${account.Email || account.mail}`)
    if (account['Recovery Code'] || account.code2fa) allDetails.push(`2FA Secret: ${account['Recovery Code'] || account.code2fa}`)
  })
  
  try {
    await navigator.clipboard.writeText(allDetails.join('\n'))
    showSnackbar(`All ${accounts.length} accounts copied!`, 'success')
  } catch (error) {
    showSnackbar('Failed to copy accounts', 'error')
  }
}

// Open account in browser (placeholder)
const openInBrowser = (account) => {
  showSnackbar('Browser opening feature coming soon!', 'info')
}

// Email modal state
const emailModal = ref(false)
const emailLoading = ref(false)
const emailContent = ref(null)
const emailAccount = ref(null)

// Check email for account
const checkAccountEmail = async (account) => {
  const email = account.Email || account.mail
  const username = account.Username || account.username
  
  if (!email) {
    showSnackbar('No email address found for this account', 'warning')
    return
  }
  
  emailAccount.value = account
  emailModal.value = true
  emailLoading.value = true
  emailContent.value = null
  
  try {
    const response = await bcgenApi.checkEmail(email, username)
    
    if (response.error) {
      showSnackbar(response.error, 'error')
      emailModal.value = false
      return
    }
    
    emailContent.value = response
  } catch (error) {
    showSnackbar('Failed to check email', 'error')
    emailModal.value = false
  } finally {
    emailLoading.value = false
  }
}

// Helper function to strip HTML tags
const stripHtml = (html) => {
  const tmp = document.createElement('DIV')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
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

/* Compact Credentials */
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
.totp-display {
  font-size: 1.5em;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: rgb(var(--v-theme-primary));
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.totp-display-compact {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgb(var(--v-theme-primary));
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  padding: 0 8px;
}

/* Animations */
@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
}

.totp-display {
  animation: pulse 2s ease-in-out infinite;
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

/* Email content styles */
.email-content {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 400px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.02);
  padding: 12px;
  border-radius: 4px;
}

/* Mobile-specific styles */
.compact-credentials-mobile {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.credential-row-mobile {
  display: flex;
  flex-direction: column;
  padding: 8px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 6px;
  gap: 4px;
}

.credential-label-mobile {
  font-size: 0.625rem;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.6);
  text-transform: uppercase;
}

.credential-value-mobile {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.9);
  word-break: break-all;
  line-height: 1.4;
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

@media (max-width: 600px) {
  .account-card {
    margin-bottom: 12px !important;
  }
  
  .equal-height-card {
    min-height: auto;
  }
  
  /* Mobile-optimized scrollbar */
  .cookies-code {
    max-height: 60px;
  }
  
  .cookies-code::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
}

/* Mobile dialog styles */
.mobile-dialog-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  margin: 0 !important;
  border-radius: 0 !important;
}

/* Ensure scrollable content on mobile */
@media (max-width: 600px) {
  .mobile-dialog-card .v-card-text {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  /* Ensure action buttons stay visible */
  .mobile-dialog-card .v-card-actions {
    position: sticky;
    bottom: 0;
    background: inherit;
    z-index: 1;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
  }
  
  .v-theme--dark .mobile-dialog-card .v-card-actions {
    border-top-color: rgba(255, 255, 255, 0.12);
  }
}
</style>