<template>
  <v-container class="fill-height d-flex align-center justify-center">
    <v-card max-width="400" class="pa-6 text-center">
      <v-progress-circular
        v-if="loading"
        indeterminate
        color="primary"
        size="64"
        class="mb-4"
      ></v-progress-circular>
      
      <v-icon
        v-else-if="error"
        size="64"
        color="error"
        class="mb-4"
      >mdi-alert-circle</v-icon>
      
      <v-icon
        v-else
        size="64"
        color="success"
        class="mb-4"
      >mdi-check-circle</v-icon>
      
      <h2 class="text-h5 mb-2">
        {{ loading ? 'Authenticating...' : error ? 'Authentication Failed' : 'Authentication Successful' }}
      </h2>
      
      <p class="text-body-1 mb-4">
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
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const loading = ref(true)
const error = ref(null)

const processCallback = async () => {
  try {
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
    
    // Send success message to parent window
    if (window.opener) {
      window.opener.postMessage({ type: 'auth-success' }, '*')
    }
    
    // Close the window after a short delay
    setTimeout(() => {
      window.close()
    }, 1500)
    
  } catch (err) {
    console.error('Auth callback error:', err)
    error.value = err.message
    loading.value = false
    // Close window after a short delay
    setTimeout(() => {
      window.close()
    }, 2000)
  }
}

const retry = () => {
  window.location.href = '/api/auth/signin'
}

onMounted(() => {
  processCallback()
})
</script>