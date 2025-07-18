<template>
  <div v-if="loading" class="d-flex justify-center align-center" style="min-height: 400px;">
    <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
  </div>
  
  <div v-else-if="!isAuthenticated" class="landing-page">
    <!-- Background Pattern -->
    <div class="app-bar-pattern"></div>
    
    <!-- Floating Particles Animation -->
    <div class="particles-container">
      <div v-for="i in 15" :key="`particle-${i}`" :class="`particle particle-${i}`"></div>
    </div>
    
    
    <!-- Glowing Orbs Background -->
    <div class="orb-container">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>
    
    <v-container class="fill-height mobile-safe-container">
      <v-row align="center" justify="center">
        <v-col cols="12" sm="10" md="8" lg="6" xl="5">
          <div class="text-center content-entrance">
            <!-- Logo/Icon -->
            <v-icon :size="$vuetify.display.smAndDown ? '60' : '80'" color="primary" class="mb-4 robot-icon">mdi-robot-happy</v-icon>
            
            <!-- Welcome Message -->
            <h1 :class="$vuetify.display.smAndDown ? 'text-h4 font-weight-bold mb-3 welcome-title' : 'text-h3 text-md-h2 font-weight-bold mb-3 welcome-title'">
              <span class="gradient-text">Welcome to MillianAI</span>
            </h1>
            
            <!-- Subtitle -->
            <p :class="$vuetify.display.smAndDown ? 'text-body-2 text-grey mb-4' : 'text-body-1 text-md-h6 text-grey mb-6'">
              Automate your social media engagement with intelligent comment bots
            </p>
            
            <!-- Features -->
            <v-row :class="$vuetify.display.smAndDown ? 'mb-3 features-row' : 'mb-4 features-row'">
              <v-col cols="12" md="4" :class="$vuetify.display.smAndDown ? 'mb-2 mb-md-4' : 'mb-2 mb-md-4'">
                <div class="feature-card">
                  <v-icon :size="$vuetify.display.smAndDown ? '32' : '40'" color="primary" class="mb-2">mdi-flash</v-icon>
                  <h3 :class="$vuetify.display.smAndDown ? 'text-body-2 mb-1' : 'text-subtitle-1 mb-1'">Fast & Efficient</h3>
                  <p class="text-caption text-grey">Automate comments at scale with lightning speed</p>
                </div>
              </v-col>
              <v-col cols="12" md="4" :class="$vuetify.display.smAndDown ? 'mb-2 mb-md-4' : 'mb-2 mb-md-4'">
                <div class="feature-card">
                  <v-icon :size="$vuetify.display.smAndDown ? '32' : '40'" color="primary" class="mb-2">mdi-brain</v-icon>
                  <h3 :class="$vuetify.display.smAndDown ? 'text-body-2 mb-1' : 'text-subtitle-1 mb-1'">AI-Powered</h3>
                  <p class="text-caption text-grey">Intelligent comments that feel natural and engaging</p>
                </div>
              </v-col>
              <v-col cols="12" md="4" :class="$vuetify.display.smAndDown ? 'mb-2 mb-md-4' : 'mb-2 mb-md-4'">
                <div class="feature-card">
                  <v-icon :size="$vuetify.display.smAndDown ? '32' : '40'" color="primary" class="mb-2">mdi-shield-check</v-icon>
                  <h3 :class="$vuetify.display.smAndDown ? 'text-body-2 mb-1' : 'text-subtitle-1 mb-1'">Secure & Reliable</h3>
                  <p class="text-caption text-grey">Your accounts are safe with our advanced security</p>
                </div>
              </v-col>
            </v-row>
            
            <!-- CTA Button -->
            <v-btn 
              color="primary" 
              :size="$vuetify.display.smAndDown ? 'default' : 'large'"
              @click="signIn"
              :class="$vuetify.display.smAndDown ? 'px-4 cta-button mobile-cta-button' : 'px-6 cta-button'"
              elevation="2"
            >
              <v-icon start>mdi-login</v-icon>
              Get Started with Whop
            </v-btn>
            
            <!-- Additional Info -->
            <p :class="$vuetify.display.smAndDown ? 'text-caption text-grey mt-3' : 'text-caption text-grey mt-4'">
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
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.landing-page::before {
  content: '';
  position: absolute;
  top: -100px;
  left: 0;
  right: 0;
  height: 100px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%);
  z-index: 1;
}

.v-theme--dark .landing-page {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 33%, #0f3460 66%, #533483 100%);
}

.v-theme--dark .landing-page::before {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 33%, #0f3460 66%, #533483 100%);
}

.landing-page .v-container {
  position: relative;
  z-index: 10;
  height: 100%;
  max-height: 100vh;
  padding-top: 2rem !important;
  padding-bottom: 2rem !important;
}

.mobile-safe-container {
  padding-top: env(safe-area-inset-top, 1rem) !important;
  padding-bottom: env(safe-area-inset-bottom, 1rem) !important;
}

/* Background Pattern */
.app-bar-pattern {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 40px,
    rgba(255, 255, 255, 0.03) 40px,
    rgba(255, 255, 255, 0.03) 80px
  );
  pointer-events: none;
  animation: shimmer 3s linear infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-40px);
  }
  100% {
    transform: translateX(40px);
  }
}

/* Floating Particles Animation */
.particles-container {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}

.particle {
  position: absolute;
  width: 4px;
  height: 4px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  animation: float-up 15s infinite;
}

.particle-1 { left: 5%; animation-delay: 0s; animation-duration: 12s; }
.particle-2 { left: 10%; animation-delay: 1s; animation-duration: 15s; }
.particle-3 { left: 15%; animation-delay: 2s; animation-duration: 10s; }
.particle-4 { left: 20%; animation-delay: 0.5s; animation-duration: 13s; }
.particle-5 { left: 25%; animation-delay: 3s; animation-duration: 11s; }
.particle-6 { left: 30%; animation-delay: 1.5s; animation-duration: 14s; }
.particle-7 { left: 35%; animation-delay: 2.5s; animation-duration: 12s; }
.particle-8 { left: 40%; animation-delay: 0.3s; animation-duration: 16s; }
.particle-9 { left: 45%; animation-delay: 1.8s; animation-duration: 10s; }
.particle-10 { left: 50%; animation-delay: 2.3s; animation-duration: 13s; }
.particle-11 { left: 55%; animation-delay: 0.8s; animation-duration: 11s; }
.particle-12 { left: 60%; animation-delay: 3.5s; animation-duration: 15s; }
.particle-13 { left: 65%; animation-delay: 1.3s; animation-duration: 12s; }
.particle-14 { left: 70%; animation-delay: 2.8s; animation-duration: 14s; }
.particle-15 { left: 75%; animation-delay: 0.2s; animation-duration: 10s; }

@keyframes float-up {
  0% {
    transform: translateY(100vh) translateX(0);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(-100px) translateX(50px);
    opacity: 0;
  }
}

/* Animated Border Gradient */
.animated-border-top,
.animated-border-bottom {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, 
    transparent,
    #667eea,
    #764ba2,
    #f64f59,
    transparent
  );
  background-size: 200% 100%;
  animation: border-slide 3s linear infinite;
}

.animated-border-top {
  top: 0;
}

.animated-border-bottom {
  bottom: 0;
}

@keyframes border-slide {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* Glowing Orbs */
.orb-container {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.4;
  animation: orb-float 20s ease-in-out infinite;
}

.orb-1 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, #667eea, transparent);
  top: -150px;
  left: -150px;
  animation-duration: 15s;
}

.orb-2 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, #764ba2, transparent);
  bottom: -200px;
  right: -200px;
  animation-duration: 20s;
  animation-delay: 5s;
}

.orb-3 {
  width: 250px;
  height: 250px;
  background: radial-gradient(circle, #f64f59, transparent);
  top: 50%;
  left: 50%;
  animation-duration: 18s;
  animation-delay: 10s;
}

@keyframes orb-float {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(30px, -30px) scale(1.1);
  }
  50% {
    transform: translate(-20px, 20px) scale(0.9);
  }
  75% {
    transform: translate(40px, 10px) scale(1.05);
  }
}

/* Content Styling */
.landing-page h1,
.landing-page h3,
.landing-page p {
  color: white !important;
}

.v-theme--dark .landing-page h1,
.v-theme--dark .landing-page h3,
.v-theme--dark .landing-page p {
  color: var(--v-theme-on-surface) !important;
}

.landing-page .text-grey {
  opacity: 0.9;
  color: rgba(255, 255, 255, 0.9) !important;
}

.v-theme--dark .landing-page .text-grey {
  opacity: 0.7;
  color: inherit !important;
}

.landing-page .v-icon {
  color: white !important;
}

.v-theme--dark .landing-page .v-icon {
  color: var(--v-theme-primary) !important;
}

/* Gradient Text Animation */
.gradient-text {
  background: linear-gradient(45deg, #fff, #e0e0e0, #fff);
  background-size: 200% auto;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradient-shift 3s ease infinite;
}

.v-theme--dark .gradient-text {
  background: linear-gradient(45deg, #667eea, #764ba2, #f64f59);
  background-size: 200% auto;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* Robot Icon Animation */
.robot-icon {
  animation: robot-entrance 1s ease-out;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.robot-icon:hover {
  animation: robot-dance 0.5s ease-in-out;
  transform: scale(1.1);
}

@keyframes robot-entrance {
  0% {
    transform: scale(0) rotate(180deg);
    opacity: 0;
  }
  50% {
    transform: scale(1.2) rotate(90deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

@keyframes robot-dance {
  0%, 100% { transform: rotate(0deg) scale(1.1); }
  25% { transform: rotate(-10deg) scale(1.1); }
  75% { transform: rotate(10deg) scale(1.1); }
}

/* Feature Cards */
.feature-card {
  padding: 15px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  height: 100%;
}

.v-theme--dark .feature-card {
  background: rgba(255, 255, 255, 0.05);
}

.feature-card:hover {
  transform: translateY(-5px);
  background: rgba(255, 255, 255, 0.15);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

/* CTA Button */
.cta-button {
  position: relative;
  overflow: hidden;
  background: white !important;
  color: #667eea !important;
  transition: all 0.3s ease;
}

.cta-button:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.cta-button::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(102, 126, 234, 0.3);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.cta-button:hover::before {
  width: 300px;
  height: 300px;
}

/* Entrance Animations */
.content-entrance {
  animation: content-fade-in 1s ease-out;
}

@keyframes content-fade-in {
  0% {
    opacity: 0;
    transform: translateY(30px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.welcome-title {
  animation: title-slide-in 1s ease-out 0.3s both;
}

@keyframes title-slide-in {
  0% {
    opacity: 0;
    transform: translateX(-50px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

.features-row .v-col:nth-child(1) .feature-card {
  animation: feature-pop-in 0.6s ease-out 0.6s both;
}

.features-row .v-col:nth-child(2) .feature-card {
  animation: feature-pop-in 0.6s ease-out 0.8s both;
}

.features-row .v-col:nth-child(3) .feature-card {
  animation: feature-pop-in 0.6s ease-out 1s both;
}

@keyframes feature-pop-in {
  0% {
    opacity: 0;
    transform: scale(0.8) translateY(20px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.cta-button {
  animation: button-slide-up 0.8s ease-out 1.2s both;
}

.mobile-cta-button {
  position: fixed;
  bottom: env(safe-area-inset-bottom, 2rem);
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  width: calc(100% - 2rem);
  max-width: 300px;
}

/* Mobile-specific styles */
@media (max-width: 600px) {
  .landing-page {
    min-height: 100vh;
    height: 100vh;
    padding-top: 0;
    padding-bottom: 0;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
  }
  
  .landing-page .v-container {
    padding-top: calc(env(safe-area-inset-top, 0) + 1rem) !important;
    padding-bottom: calc(env(safe-area-inset-bottom, 1rem) + 80px) !important;
    max-height: none;
    position: relative;
    z-index: 10;
  }
  
  .feature-card {
    padding: 12px;
    margin-bottom: 8px;
  }
  
  .mobile-cta-button {
    position: fixed;
    bottom: calc(env(safe-area-inset-bottom, 1rem) + 1rem);
    left: 1rem;
    right: 1rem;
    transform: none;
    width: auto;
    max-width: none;
  }
  
  .content-entrance {
    padding-bottom: 80px;
  }
}

/* Handle devices with notches */
@media (max-width: 600px) and (orientation: portrait) {
  .landing-page {
    margin-top: calc(-1 * env(safe-area-inset-top, 0));
    padding-top: env(safe-area-inset-top, 0);
  }
  
  .mobile-safe-container {
    padding-top: 1rem !important;
  }
}

@keyframes button-slide-up {
  0% {
    opacity: 0;
    transform: translateY(40px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 600px) {
  @keyframes button-slide-up {
    0% {
      opacity: 0;
      transform: translateY(40px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
</style>