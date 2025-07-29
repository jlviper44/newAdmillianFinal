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
        
        <v-list-item prepend-icon="mdi-account" @click="viewProfile">
          <v-list-item-title>View Profile</v-list-item-title>
        </v-list-item>
        
        <v-divider class="my-2"></v-divider>
        
        <v-list-item prepend-icon="mdi-logout" @click="signOut">
          <v-list-item-title>Sign Out</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script setup>
import { useAuth } from '@/composables/useAuth'
import { useRouter } from 'vue-router'

const { user, isAuthenticated, signIn, signOut } = useAuth()
const router = useRouter()

const viewProfile = () => {
  router.push('/profile')
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