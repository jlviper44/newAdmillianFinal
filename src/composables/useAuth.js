import { ref, computed, getCurrentInstance } from 'vue'
import { useRouter, useRoute } from 'vue-router'

// Global auth state
const user = ref(null)
const loading = ref(true)
const subscriptions = ref(null)
const showAuthModal = ref(false)

// Set up global auth expired listener
let authExpiredHandler = null
if (typeof window !== 'undefined') {
  authExpiredHandler = () => {
    user.value = null
    subscriptions.value = null
    showAuthModal.value = true
  }
  window.addEventListener('auth:expired', authExpiredHandler)
}

export function useAuth() {
  // Only use router/route if we're in a component context
  const instance = getCurrentInstance()
  const router = instance ? useRouter() : null
  const route = instance ? useRoute() : null

  // Computed properties
  const isAuthenticated = computed(() => !!user.value)
  
  // Subscription-specific computed properties
  const hasCommentBotAccess = computed(() => subscriptions.value?.comment_bot?.isActive || false)
  const hasBcGenAccess = computed(() => subscriptions.value?.bc_gen?.isActive || false)
  const hasDashboardAccess = computed(() => subscriptions.value?.dashboard?.isActive || false)
  const hasAnyAccess = computed(() => hasCommentBotAccess.value || hasBcGenAccess.value || hasDashboardAccess.value)

  // Check authentication status
  const checkAuth = async () => {
    loading.value = true
    try {
      const response = await fetch('/api/auth/user', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        user.value = data.user
        // If we have a user object but it's empty or has no id, treat as not authenticated
        if (user.value && !user.value.id) {
          user.value = null
        }
      } else {
        user.value = null
        // Don't trigger auth modal here, let individual API calls handle 401s
      }
    } catch (error) {
      user.value = null
    } finally {
      loading.value = false
    }
  }

  // Check access (membership validation)
  const checkAccess = async () => {
    try {
      const response = await fetch('/api/auth/check-access', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          user.value = data.user
        }
        if (data.subscriptions) {
          subscriptions.value = data.subscriptions
        }
        return true
      }
    } catch (error) {
    }
    subscriptions.value = null
    return false
  }

  // Sign in
  const signIn = async () => {
    try {
      // Store current user state before auth attempt
      const previousUser = user.value
      
      // First, get the auth URL from the backend (this sets up the session and state)
      const response = await fetch('/api/auth/signin', {
        method: 'GET',
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error('Failed to get auth URL')
      }
      
      const { authUrl } = await response.json()
      
      // Open OAuth flow in new window
      const width = 500
      const height = 600
      const left = (window.screen.width - width) / 2
      const top = (window.screen.height - height) / 2
      
      const authWindow = window.open(
        authUrl,
        'whopAuth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      )
      
      // Check if popup was blocked
      if (!authWindow || authWindow.closed || typeof authWindow.closed === 'undefined') {
        // Popup was blocked, fallback to redirect for mobile
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        if (isMobile) {
          // For mobile, use direct redirect instead of popup
          window.location.href = authUrl
          return
        } else {
          // For desktop, show alert about popup blocker
          alert('Please allow popups for this site to sign in with Whop.')
          return
        }
      }
      
      // Track if we received a successful auth callback
      let authCompleted = false
      
      // Listen for messages from the auth callback window
      const messageHandler = (event) => {
        if (event.data && event.data.type === 'auth-success') {
          authCompleted = true
          window.removeEventListener('message', messageHandler)
        }
      }
      window.addEventListener('message', messageHandler)
      
      // Check if auth window closed and refresh auth state
      const checkInterval = setInterval(async () => {
        if (authWindow && authWindow.closed) {
          clearInterval(checkInterval)
          window.removeEventListener('message', messageHandler)
          
          // Only check auth if we received a success message
          if (authCompleted) {
            setTimeout(async () => {
              await checkAuth()
              if (user.value) {
                await checkAccess()
              }
            }, 500)
          } else {
            // Window was closed without completing auth
            // Ensure user remains as it was before
            user.value = previousUser
          }
        }
      }, 500)
    } catch (error) {
    }
  }

  // Sign out
  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'GET',
        credentials: 'include'
      })
    } catch (error) {
    } finally {
      user.value = null
      subscriptions.value = null
      router?.push('/')
    }
  }

  // Initialize auth on app load
  const initAuth = async () => {
    await checkAuth()
    // Only check access if we have a valid authenticated user
    if (user.value && user.value.id) {
      await checkAccess()
    } else {
      // Ensure subscriptions are null when not authenticated
      subscriptions.value = null
    }
    
    // Check if we should show auth modal from query parameter
    if (route?.query?.showAuth === 'true') {
      showAuthModal.value = true
      // Clean up the URL
      router?.replace({ query: {} })
    }
  }

  return {
    user,
    loading,
    subscriptions,
    isAuthenticated,
    hasCommentBotAccess,
    hasBcGenAccess,
    hasDashboardAccess,
    hasAnyAccess,
    showAuthModal,
    checkAuth,
    checkAccess,
    signIn,
    signOut,
    initAuth
  }
}