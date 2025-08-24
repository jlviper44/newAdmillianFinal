<template>
  <div>
    <v-btn v-if="!isAuthenticated" color="primary" @click="signIn">
      <v-icon start>mdi-login</v-icon>
      Sign In
    </v-btn>
    
    <v-menu v-else offset-y>
      <template v-slot:activator="{ props }">
        <v-btn v-bind="props" variant="text" class="user-menu-btn">
          <v-avatar size="32" class="mr-2">
            <v-img v-if="user.image" :src="user.image" :alt="user.name"></v-img>
            <v-icon v-else>mdi-account-circle</v-icon>
          </v-avatar>
          <span class="d-none d-sm-inline user-menu-name">{{ user.name || user.email }}</span>
          <v-chip v-if="user.isAdmin" size="x-small" variant="flat" class="ml-2 admin-chip">
            <v-icon start size="x-small">mdi-crown</v-icon>
            Admin
          </v-chip>
          <v-chip v-if="user?.team" color="primary" size="x-small" variant="flat" class="ml-1">
            <v-icon start size="x-small">mdi-account-group</v-icon>
            {{ user.team.name }}
          </v-chip>
          <v-icon end>mdi-menu-down</v-icon>
        </v-btn>
      </template>
      
      <v-list>
        <!-- Debug info -->
        
        <v-list-item>
          <v-list-item-title class="font-weight-bold d-flex align-center">
            {{ user.name || 'User' }}
            <v-chip v-if="user.isAdmin" size="x-small" variant="flat" class="ml-3 admin-chip">
              <v-icon start size="x-small">mdi-crown</v-icon>
              Admin
            </v-chip>
          </v-list-item-title>
          <v-list-item-subtitle>
            <div v-if="user.email">{{ user.email }}</div>
            <div v-if="user?.team" class="d-flex align-center mt-1">
              <span class="text-caption mr-2">Team:</span>
              <v-chip color="primary" size="x-small" variant="flat">
                <v-icon start size="x-small">mdi-account-group</v-icon>
                {{ user.team.name }}
              </v-chip>
            </div>
          </v-list-item-subtitle>
        </v-list-item>
        
        <v-divider class="my-2"></v-divider>
        
        <!-- Virtual Assistant Switch Account -->
        <v-list-item 
          v-if="isVirtualAssistant && !isAssistingUser"
          prepend-icon="mdi-account-switch"
          @click="showAccountSwitcher = true"
        >
          <v-list-item-title>Switch Account</v-list-item-title>
          <v-list-item-subtitle class="text-caption">
            Access accounts you assist
          </v-list-item-subtitle>
        </v-list-item>
        
        <!-- Currently Assisting -->
        <v-list-item 
          v-if="isAssistingUser"
          prepend-icon="mdi-account-eye"
          @click="exitVirtualAssistantMode"
        >
          <v-list-item-title class="text-success">
            Currently Assisting
          </v-list-item-title>
          <v-list-item-subtitle class="text-caption">
            {{ user.assistingFor || `User #${getTargetUserId()}` }}
            <br>
            <span class="text-primary">Click to exit virtual assistant mode</span>
          </v-list-item-subtitle>
        </v-list-item>
        
        
        <v-list-item prepend-icon="mdi-account" @click="viewProfile">
          <v-list-item-title>View Profile</v-list-item-title>
        </v-list-item>
        
        <!-- Stop Assisting Button -->
        <v-list-item 
          v-if="isAssistingUser"
          prepend-icon="mdi-close-circle"
          @click="exitVirtualAssistantMode"
          class="text-warning"
        >
          <v-list-item-title>Stop Assisting</v-list-item-title>
          <v-list-item-subtitle class="text-caption">
            Return to your own account
          </v-list-item-subtitle>
        </v-list-item>
        
        <v-divider class="my-2"></v-divider>
        
        <v-list-item prepend-icon="mdi-logout" @click="signOut">
          <v-list-item-title>Sign Out</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    
    <!-- Account Switcher Dialog -->
    <v-dialog v-model="showAccountSwitcher" max-width="500">
      <v-card>
        <v-card-title>
          <v-icon class="mr-2">mdi-account-switch</v-icon>
          Switch Account
        </v-card-title>
        
        <v-card-text>
          <v-list v-if="virtualAssistantAccounts.length > 0">
            <v-list-item
              v-for="account in virtualAssistantAccounts"
              :key="account.user_id"
              @click="switchToAccount(account)"
              :prepend-icon="account.status === 'active' ? 'mdi-account-check' : 'mdi-account-clock'"
              :disabled="account.status !== 'active'"
            >
              <v-list-item-title>
                {{ account.name || account.email || `User #${account.user_id}` }}
              </v-list-item-title>
              <v-list-item-subtitle>
                <div v-if="account.email">{{ account.email }}</div>
                <div>Expires: {{ new Date(account.expires_at).toLocaleDateString() }}</div>
                <v-chip 
                  :color="account.status === 'active' ? 'success' : 'error'" 
                  size="x-small"
                  class="mt-1"
                >
                  {{ account.status === 'active' ? 'Active' : 'Expired' }}
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
          
          <v-alert v-else type="info" variant="tonal">
            You are not currently a virtual assistant for any accounts.
          </v-alert>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showAccountSwitcher = false">
            Cancel
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRouter } from 'vue-router'
import { usersApi } from '@/services/api'

const { user, isAuthenticated, signIn, signOut, isVirtualAssistant, virtualAssistantAccounts, isAssistingUser, getTargetUserId } = useAuth()
const router = useRouter()

const showAccountSwitcher = ref(false)



const viewProfile = () => {
  router.push('/profile')
}

const switchToAccount = async (account) => {
  showAccountSwitcher.value = false
  
  try {
    // Start virtual assistant mode using the new API
    const response = await usersApi.startVirtualAssistantMode(account.user_id)
    
    // Reload the page to refresh all data with the new session context
    window.location.reload()
  } catch (error) {
    console.error('Failed to switch to virtual assistant mode:', error)
    // Show error message to user
    alert('Failed to switch to virtual assistant mode. Please try again.')
  }
}

const exitVirtualAssistantMode = async () => {
  try {
    const response = await usersApi.endVirtualAssistantMode()
    
    // Reload the page to refresh all data with the normal session context
    window.location.reload()
  } catch (error) {
    console.error('Failed to exit virtual assistant mode:', error)
    alert('Failed to exit virtual assistant mode. Please try again.')
  }
}

</script>

<style scoped>
/* In light mode, make the username white for better contrast against gradient background */
.v-theme--light .user-menu-btn {
  color: white !important;
}

.v-theme--light .user-menu-btn .user-menu-name {
  color: white !important;
}

.v-theme--light .user-menu-btn .v-icon {
  color: white !important;
}

/* In dark mode, use the default gray-lighten-2 color */
.v-theme--dark .user-menu-btn {
  color: rgb(224, 224, 224) !important;
}

.v-theme--dark .user-menu-btn .user-menu-name {
  color: rgb(224, 224, 224) !important;
}

.v-theme--dark .user-menu-btn .v-icon {
  color: rgb(224, 224, 224) !important;
}
/* Admin chip styling */
.admin-chip {
  background-color: #FFC107 !important;
  color: rgba(0, 0, 0, 0.87) !important;
}

.admin-chip .v-icon {
  color: rgba(0, 0, 0, 0.87) !important;
}
</style>