<template>
  <div v-if="loading" class="d-flex justify-center align-center" style="min-height: 400px;">
    <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
  </div>
  
  <div v-else-if="!isAuthenticated" class="landing-page">
    <v-container class="fill-height">
      <v-row align="center" justify="center">
        <v-col cols="12" sm="10" md="8" lg="6" xl="5">
          <div class="text-center">
            <!-- Logo/Icon -->
            <v-icon size="100" color="primary" class="mb-6">mdi-robot-happy</v-icon>
            
            <!-- Welcome Message -->
            <h1 class="text-h2 text-md-h1 font-weight-bold mb-4">
              Welcome to MillianAI
            </h1>
            
            <!-- Subtitle -->
            <p class="text-h6 text-md-h5 text-grey mb-8">
              Automate your social media engagement with intelligent comment bots
            </p>
            
            <!-- Features -->
            <v-row class="mb-8">
              <v-col cols="12" md="4" class="mb-4">
                <v-icon size="48" color="primary" class="mb-3">mdi-flash</v-icon>
                <h3 class="text-h6 mb-2">Fast & Efficient</h3>
                <p class="text-body-2 text-grey">Automate comments at scale with lightning speed</p>
              </v-col>
              <v-col cols="12" md="4" class="mb-4">
                <v-icon size="48" color="primary" class="mb-3">mdi-brain</v-icon>
                <h3 class="text-h6 mb-2">AI-Powered</h3>
                <p class="text-body-2 text-grey">Intelligent comments that feel natural and engaging</p>
              </v-col>
              <v-col cols="12" md="4" class="mb-4">
                <v-icon size="48" color="primary" class="mb-3">mdi-shield-check</v-icon>
                <h3 class="text-h6 mb-2">Secure & Reliable</h3>
                <p class="text-body-2 text-grey">Your accounts are safe with our advanced security</p>
              </v-col>
            </v-row>
            
            <!-- CTA Button -->
            <v-btn 
              color="primary" 
              size="x-large" 
              @click="signIn"
              class="px-8"
              elevation="2"
            >
              <v-icon start>mdi-login</v-icon>
              Get Started with Whop
            </v-btn>
            
            <!-- Additional Info -->
            <p class="text-body-2 text-grey mt-6">
              Sign in to access powerful automation tools
            </p>
          </div>
        </v-col>
      </v-row>
    </v-container>
  </div>
  
  <slot v-else></slot>
  
  <!-- Payment Processing Dialog -->
  <v-dialog
    v-model="showPaymentDialog"
    persistent
    max-width="400"
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
          Getting access to Comment Bot
        </p>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { defineProps, onMounted, onUnmounted, watch, ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { usersApi } from '@/services/api'

const props = defineProps({
  requireAccess: {
    type: Boolean,
    default: true
  }
})

const { isAuthenticated, hasAccess, loading, signIn, checkAccess, initAuth, showAuthModal } = useAuth()
const checkoutLink = ref('')
const showPaymentDialog = ref(false)
const paymentCheckInterval = ref(null)

// Fetch checkout link
const fetchCheckoutLink = async () => {
  try {
    const data = await usersApi.getCheckoutLink()
    checkoutLink.value = data.checkoutLink || ''
  } catch (err) {
    console.error('Failed to fetch checkout link:', err)
  }
}

// Open checkout in popup window
const openCheckout = () => {
  if (!checkoutLink.value) return
  
  // Open checkout in a new window
  const width = 600
  const height = 800
  const left = (window.screen.width - width) / 2
  const top = (window.screen.height - height) / 2
  
  const popup = window.open(
    checkoutLink.value,
    'WhopCheckout',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
  )
  
  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    alert('Please allow popups for this site to proceed with checkout.')
  } else {
    // Show payment dialog
    showPaymentDialog.value = true
    
    // Poll for completion
    paymentCheckInterval.value = setInterval(async () => {
      if (popup.closed) {
        // Window closed, check if payment was successful
        await checkAccess()
        
        // Give it a moment then check again to ensure we have the latest data
        setTimeout(async () => {
          await checkAccess()
          clearInterval(paymentCheckInterval.value)
          showPaymentDialog.value = false
          
          // If access is granted, the component will automatically update
        }, 1000)
      }
    }, 500)
  }
}

// Initialize auth on mount if needed
onMounted(async () => {
  if (loading.value) {
    await initAuth()
  }
  
  if (isAuthenticated.value && props.requireAccess && !hasAccess.value) {
    await checkAccess()
  }
  
  // Fetch checkout link
  await fetchCheckoutLink()
})

// Watch for authentication changes
watch(isAuthenticated, async (newVal) => {
  if (newVal && props.requireAccess && !hasAccess.value) {
    await checkAccess()
  }
})

// Watch for auth modal trigger
watch(showAuthModal, async (newVal) => {
  if (newVal && !isAuthenticated.value) {
    showAuthModal.value = false
    await signIn()
  }
})

// Clean up on unmount
onUnmounted(() => {
  if (paymentCheckInterval.value) {
    clearInterval(paymentCheckInterval.value)
  }
})
</script>

<style scoped>
.landing-page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

.landing-page .v-container {
  position: relative;
  z-index: 1;
}

.landing-page h1,
.landing-page h3,
.landing-page p {
  color: var(--v-theme-on-surface) !important;
}

.landing-page .text-grey {
  opacity: 0.7;
}

.landing-page .v-icon {
  color: var(--v-theme-primary) !important;
}

.landing-page .v-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}
</style>