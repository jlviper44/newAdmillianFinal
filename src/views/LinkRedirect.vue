<template>
  <v-container class="d-flex align-center justify-center" style="min-height: 100vh;">
    <v-progress-circular
      v-if="loading"
      indeterminate
      color="primary"
      size="64"
    ></v-progress-circular>
    
    <v-alert
      v-else-if="error"
      type="error"
      variant="outlined"
      max-width="400"
    >
      <v-alert-title>Link Not Found</v-alert-title>
      The requested link does not exist or has expired.
    </v-alert>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref(false)

onMounted(async () => {
  const code = route.params.code
  
  if (!code) {
    error.value = true
    loading.value = false
    return
  }
  
  try {
    // Call the API to get the redirect URL
    const response = await axios.get(`/api/link-splitter/redirect/${code}`)
    
    if (response.data && response.data.url) {
      // Redirect to the target URL
      window.location.href = response.data.url
    } else {
      error.value = true
      loading.value = false
    }
  } catch (err) {
    console.error('Failed to redirect:', err)
    error.value = true
    loading.value = false
  }
})
</script>