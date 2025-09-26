import { ref, computed, getCurrentInstance } from 'vue'
import { useRouter, useRoute } from 'vue-router'

// Global auth state
const user = ref(null)
const loading = ref(true)
const subscriptions = ref(null)
const virtualAssistantFor = ref([])
const showAuthModal = ref(false)
const isAssistingUser = ref(false) // True when accessing as virtual assistant

// Track initialization and prevent duplicate calls
let isInitializing = false
let initPromise = null
let authController = null
let accessController = null

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

// Helper to get target user ID from session (for backward compatibility)
function getTargetUserId() {
  // This function is now used only for display purposes
  // The actual virtual assistant context is managed by the session
  return user.value?.assistingFor || null
}

export function useAuth() {
  // Only use router/route if we're in a component context
  const instance = getCurrentInstance()
  const router = instance ? useRouter() : null
  const route = instance ? useRoute() : null

  // Computed properties
  const isAuthenticated = computed(() => !!user.value)
  
  // Subscription-specific computed properties
  // If user is a VA in assisting mode, check permissions first
  const hasCommentBotAccess = computed(() => {
    if (user.value?.isVirtualAssistant && user.value?.vaPermissions) {
      // VA must have permission - subscription check happens at credit deduction time
      // If VA has permission, allow access (subscription will be checked when using credits)
      return user.value.vaPermissions.hasCommentBotAccess || false
    }
    return subscriptions.value?.comment_bot?.isActive || false
  })
  
  const hasBcGenAccess = computed(() => {
    if (user.value?.isVirtualAssistant && user.value?.vaPermissions) {
      // VA must have permission - subscription check happens at credit deduction time
      // If VA has permission, allow access (subscription will be checked when using credits)
      return user.value.vaPermissions.hasBCGenAccess || false
    }
    return subscriptions.value?.bc_gen?.isActive || false
  })
  
  const hasDashboardAccess = computed(() => {
    if (user.value?.isVirtualAssistant && user.value?.vaPermissions) {
      // VA must have permission - subscription check happens at credit deduction time
      // If VA has permission, allow access (subscription will be checked when using credits)
      return user.value.vaPermissions.hasDashboardAccess || false
    }
    return subscriptions.value?.dashboard?.isActive || false
  })
  const hasAnyAccess = computed(() => hasCommentBotAccess.value || hasBcGenAccess.value || hasDashboardAccess.value)
  
  // Credit-specific computed properties
  const virtualAssistantCredits = computed(() => subscriptions.value?.virtual_assistant?.totalCredits || 0)
  const hasVirtualAssistantCredits = computed(() => virtualAssistantCredits.value > 0)
  
  // Virtual assistant computed properties
  const isVirtualAssistant = computed(() => virtualAssistantFor.value && virtualAssistantFor.value.length > 0)
  const virtualAssistantAccounts = computed(() => virtualAssistantFor.value || [])

  // Check authentication status
  const checkAuth = async () => {
    // Cancel previous auth request if it exists
    if (authController) {
      authController.abort()
    }

    authController = new AbortController()
    loading.value = true

    try {
      const response = await fetch('/api/auth/user', {
        credentials: 'include',
        signal: authController.signal
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
      // Only update state if this wasn't an abort
      if (error.name !== 'AbortError') {
        user.value = null
      }
    } finally {
      // Only set loading to false if this wasn't aborted
      if (!authController.signal.aborted) {
        loading.value = false
      }
      authController = null
    }
  }

  // Check access (membership validation)
  const checkAccess = async () => {
    // Cancel previous access request if it exists
    if (accessController) {
      accessController.abort()
    }

    accessController = new AbortController()

    try {
      // Check access - virtual assistant mode is now handled by session
      const url = '/api/auth/check-access'

      const response = await fetch(url, {
        credentials: 'include',
        signal: accessController.signal
      })

      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          user.value = data.user
          // Check if this is a virtual assistant accessing another user's account
          // assistingFor is only set when actively assisting, not when just being a VA
          isAssistingUser.value = !!data.user.assistingFor
          // Log for debugging
          if (data.user.assistingFor) {
            console.log('Virtual Assistant Mode Active - Assisting:', data.user.assistingFor)
          }
        }
        if (data.subscriptions) {
          subscriptions.value = data.subscriptions
        }
        if (data.virtualAssistantFor) {
          virtualAssistantFor.value = data.virtualAssistantFor
        }
        return true
      }
    } catch (error) {
      // Only handle non-abort errors
      if (error.name !== 'AbortError') {
        console.error('Check access error:', error)
      }
    } finally {
      accessController = null
    }

    // Only reset state if request wasn't aborted
    if (accessController === null) {
      subscriptions.value = null
      virtualAssistantFor.value = []
    }
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
      
      // Detect if we're on mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      
      let authWindow = null
      
      if (isMobile) {
        // For mobile devices, especially iOS, use location.href for better compatibility
        if (isIOS) {
          // Store a flag to indicate we're in the auth flow
          sessionStorage.setItem('auth_flow_started', 'true')
          window.location.href = authUrl
          return
        } else {
          authWindow = window.open(authUrl, '_blank')
        }
      } else {
        // For desktop, use popup window
        const width = 500
        const height = 600
        const left = (window.screen.width - width) / 2
        const top = (window.screen.height - height) / 2
        
        authWindow = window.open(
          authUrl,
          'whopAuth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        )
      }
      
      // Check if popup was blocked (mainly for desktop)
      if (!authWindow && !isMobile) {
        alert('Please allow popups for this site to sign in with Whop.')
        return
      }
      
      // For iOS using _self target, we'll navigate away from the app
      // The auth callback will handle the redirect back
      if (isIOS && authWindow === window) {
        return
      }
      
      // For desktop and Android, track the popup/tab
      if (!isMobile || !isIOS) {
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
      }
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
      virtualAssistantFor.value = []
      router?.push('/')
    }
  }



  // Initialize auth on app load
  const initAuth = async () => {
    // If already initializing, return the existing promise
    if (isInitializing) {
      return initPromise
    }

    // If already initialized (not loading), return immediately
    if (!loading.value) {
      return Promise.resolve()
    }

    isInitializing = true
    initPromise = (async () => {
      try {
        // Check if we're returning from an OAuth callback
        const authCallbackComplete = sessionStorage.getItem('auth_callback_complete')
        if (authCallbackComplete) {
          // Clear the flag
          sessionStorage.removeItem('auth_callback_complete')

          // Check if we have pending auth parameters (from fallback HTML)
          const pendingCode = sessionStorage.getItem('pending_auth_code')
          const pendingState = sessionStorage.getItem('pending_auth_state')

          if (pendingCode && pendingState) {
            // Process the auth callback
            sessionStorage.removeItem('pending_auth_code')
            sessionStorage.removeItem('pending_auth_state')

            try {
              const response = await fetch('/api/auth/callback/whop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: pendingCode, state: pendingState })
              })

              if (!response.ok) {
                throw new Error('Auth callback failed')
              }
            } catch (error) {
              console.error('Error processing auth callback:', error)
            }
          }

          // Force a fresh auth check
          loading.value = true
        }

        await checkAuth()
        // Check access if we're authenticated
        if (user.value && user.value.id) {
          await checkAccess()
        } else {
          // Ensure subscriptions are null when not authenticated
          subscriptions.value = null
          virtualAssistantFor.value = []
        }

        // Check if we should show auth modal from query parameter
        if (route?.query?.showAuth === 'true') {
          showAuthModal.value = true
          // Clean up the URL
          router?.replace({ query: {} })
        }
      } finally {
        isInitializing = false
        initPromise = null
      }
    })()

    return initPromise
  }

  return {
    user,
    loading,
    subscriptions,
    virtualAssistantFor,
    isAssistingUser,
    isAuthenticated,
    hasCommentBotAccess,
    hasBcGenAccess,
    hasDashboardAccess,
    hasAnyAccess,
    virtualAssistantCredits,
    hasVirtualAssistantCredits,
    isVirtualAssistant,
    virtualAssistantAccounts,
    showAuthModal,
    checkAuth,
    checkAccess,
    signIn,
    signOut,
    initAuth,
    getTargetUserId
  }
}