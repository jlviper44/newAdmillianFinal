<template>
  <v-container class="fill-height d-flex align-center justify-center">
    <v-card class="pa-6 text-center" max-width="400" elevation="4">
      <!-- Loading State -->
      <v-progress-circular
        v-if="loading"
        indeterminate
        color="primary"
        size="64"
        class="mb-4"
      ></v-progress-circular>
      
      <!-- Error State -->
      <v-icon
        v-else-if="error"
        size="64"
        color="error"
        class="mb-4"
      >mdi-alert-circle</v-icon>
      
      <!-- Success State -->
      <v-icon
        v-else
        size="64"
        color="success"
        class="mb-4"
      >mdi-check-circle</v-icon>
      
      <h2 class="text-h5 mb-2">
        {{ loading ? 'Authenticating...' : error ? 'Authentication Failed' : 'Authentication Successful' }}
      </h2>
      
      <p class="text-body-1 mb-4 text-medium-emphasis">
        {{ loading ? 'Please wait while we complete your sign in.' : error || 'You can close this window.' }}
      </p>
      
      <v-btn
        v-if="error"
        color="primary"
        @click="retry"
      >
        Try Again
      </v-btn>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const loading = ref(true)
const error = ref(null)

const processCallback = async () => {
  try {
    // Add debugging for mobile
    console.log('Auth callback started', {
      query: route.query,
      fullPath: route.fullPath,
      userAgent: navigator.userAgent
    })
    
    const code = route.query.code
    const state = route.query.state
    
    if (!code || !state) {
      throw new Error('Missing authentication parameters')
    }
    
    // Send the code and state to our backend
    const response = await fetch('/api/auth/callback/whop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ code, state })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Authentication failed')
    }
    
    // Success - notify parent window and close
    loading.value = false
    
    // Check if this is a popup or direct navigation
    if (window.opener) {
      // Popup flow - send message to parent and close
      window.opener.postMessage({ type: 'auth-success' }, '*')
      setTimeout(() => {
        window.close()
      }, 1500)
    } else {
      // Direct navigation flow (mobile) - redirect to the web application
      // Add a flag to indicate we need to refresh auth state
      sessionStorage.setItem('auth_callback_complete', 'true')
      
      // Show success message briefly before redirect
      setTimeout(() => {
        // Use replace to avoid keeping the callback URL in history
        window.location.replace('/')
      }, 500)
    }
    
  } catch (err) {
    error.value = err.message
    loading.value = false
    // Handle error for both popup and direct navigation
    if (window.opener) {
      // Popup flow - close window after delay
      setTimeout(() => {
        window.close()
      }, 2000)
    } else {
      // Direct navigation flow (mobile) - redirect to home after delay
      setTimeout(() => {
        window.location.replace('/')
      }, 2000)
    }
  }
}

const retry = () => {
  window.location.href = '/api/auth/signin'
}

onMounted(() => {
  processCallback()
})
</script>