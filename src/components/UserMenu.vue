<template>
  <div>
    <v-btn v-if="!isAuthenticated" color="primary" @click="signIn">
      <v-icon start>mdi-login</v-icon>
      Sign In
    </v-btn>
    
    <v-menu v-else offset-y>
      <template v-slot:activator="{ props }">
        <v-btn v-bind="props" variant="text">
          <v-avatar size="32" class="mr-2">
            <v-img v-if="user.image" :src="user.image" :alt="user.name"></v-img>
            <v-icon v-else>mdi-account-circle</v-icon>
          </v-avatar>
          <span class="d-none d-sm-inline">{{ user.name || user.email }}</span>
          <v-icon end>mdi-menu-down</v-icon>
        </v-btn>
      </template>
      
      <v-list>
        <v-list-item>
          <v-list-item-title class="font-weight-bold">
            {{ user.name || 'User' }}
          </v-list-item-title>
          <v-list-item-subtitle v-if="user.email">
            {{ user.email }}
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