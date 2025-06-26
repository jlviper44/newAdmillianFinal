<script setup>
import { ref } from 'vue';
import { useAuth } from '@/composables/useAuth';
import BCGenRefunds from './components/BCGenRefunds.vue';

const { user } = useAuth();
const selectedTab = ref('general');
</script>

<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-6">
          <div>
            <h1 class="text-h4 font-weight-bold">
              <v-icon icon="mdi-cog" size="x-large" class="mr-2"></v-icon>
              Settings
            </h1>
            <p class="text-subtitle-1 text-grey-darken-1 mt-1">Configure your application preferences</p>
          </div>
        </div>
      </v-col>
    </v-row>
    
    <v-row>
      <v-col cols="12" md="3">
        <v-card>
          <v-list nav>
            <v-list-item
              value="general"
              :active="selectedTab === 'general'"
              @click="selectedTab = 'general'"
              prepend-icon="mdi-cog"
              title="General"
              rounded="lg"
            ></v-list-item>
            
            <v-list-item
              v-if="user?.isAdmin"
              value="bcgen-refunds"
              :active="selectedTab === 'bcgen-refunds'"
              @click="selectedTab = 'bcgen-refunds'"
              prepend-icon="mdi-cash-refund"
              rounded="lg"
            >
              <v-list-item-title class="d-flex align-center">
                BCGen Refunds
                <v-chip color="amber" size="x-small" variant="flat" class="ml-2">
                  <v-icon start size="x-small">mdi-crown</v-icon>
                  Admin
                </v-chip>
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
      
      <v-col cols="12" md="9">
        <v-card v-if="selectedTab === 'general'">
          <v-card-title>General</v-card-title>
          <v-card-text>
            <!-- General settings content goes here -->
          </v-card-text>
        </v-card>
        
        <BCGenRefunds v-if="selectedTab === 'bcgen-refunds' && user?.isAdmin" />
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
</style>