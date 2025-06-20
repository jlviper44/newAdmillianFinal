import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

// Global auth state
const user = ref(null)
const loading = ref(true)
const subscriptions = ref(null)

export function useAuth() {
  const router = useRouter()

  // Computed properties
  const isAuthenticated = computed(() => !!user.value)
  
  // Subscription-specific computed properties
  const hasCommentBotAccess = computed(() => subscriptions.value?.comment_bot?.isActive || false)
  const hasBcGenAccess = computed(() => subscriptions.value?.bc_gen?.isActive || false)
  const hasAnyAccess = computed(() => hasCommentBotAccess.value || hasBcGenAccess.value)

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
      }
    } catch (error) {
      console.error('Auth check failed:', error)
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
      console.error('Access check failed:', error)
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
      console.error('Sign in failed:', error)
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
      console.error('Logout failed:', error)
    } finally {
      user.value = null
      subscriptions.value = null
      router.push('/')
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
  }

  return {
    user,
    loading,
    subscriptions,
    isAuthenticated,
    hasCommentBotAccess,
    hasBcGenAccess,
    hasAnyAccess,
    checkAuth,
    checkAccess,
    signIn,
    signOut,
    initAuth
  }
}