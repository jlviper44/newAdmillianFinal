<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import Teams from './components/Teams.vue';
import ErrorLogsView from '../Dashboard/components/ErrorLogs/ErrorLogsView.vue';

const { user, hasCommentBotAccess, hasBcGenAccess, hasDashboardAccess } = useAuth();

// Check if user has any subscription
const hasAnySubscription = computed(() => {
  return hasCommentBotAccess.value || hasBcGenAccess.value || hasDashboardAccess.value;
});
const route = useRoute();
// Set default tab based on what's available
const getDefaultTab = () => {
  if (user.value?.isAdmin) return 'teams';
  return 'teams'; // Default to teams
};

const selectedTab = ref(getDefaultTab());

// Tab titles mapping
const tabTitles = {
  teams: 'Team Management',
  errorlogs: 'Error Logs Management'
};

// Computed property for current tab title
const currentTabTitle = computed(() => {
  return tabTitles[selectedTab.value] || 'Configure your application preferences';
});

// Watch for route query changes
watch(() => route.query.tab, (newTab) => {
  if (newTab) {
    selectedTab.value = newTab;
  }
});

// Initialize from route query
onMounted(() => {
  if (route.query.tab) {
    selectedTab.value = route.query.tab;
  } else {
    selectedTab.value = getDefaultTab();
  }
});
</script>

<template>
  <!-- Show access denied if user doesn't have admin access -->
  <v-container v-if="!user?.isAdmin" fluid>
    <v-row justify="center" class="mt-10">
      <v-col cols="12" md="6">
        <v-card>
          <v-card-text class="text-center py-10">
            <v-icon size="80" color="grey-lighten-1" class="mb-4">mdi-lock</v-icon>
            <h2 class="text-h5 mb-4">Admin Access Required</h2>
            <p class="text-body-1 text-grey-darken-1">
              Only administrators can access Settings.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>

  <!-- Normal settings content -->
  <v-container v-else fluid :class="{ 'pa-2': $vuetify.display.smAndDown }">
    <!-- Mobile Header -->
    <v-row v-if="$vuetify.display.smAndDown">
      <v-col cols="12" class="pb-2">
        <div class="text-center">
          <h2 class="text-h6 font-weight-bold">Settings</h2>
          <p class="text-caption text-grey-darken-1">{{ currentTabTitle }}</p>
        </div>
      </v-col>
    </v-row>

    <!-- Desktop Header -->
    <v-row v-else>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-6">
          <div>
            <h1 class="text-h4 font-weight-bold">
              <v-icon icon="mdi-cog" size="x-large" class="mr-2"></v-icon>
              Settings
            </h1>
            <p class="text-subtitle-1 text-grey-darken-1 mt-1">{{ currentTabTitle }}</p>
          </div>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <!-- Content Area -->
      <v-col cols="12">
        <!-- Teams Tab -->
        <div v-if="selectedTab === 'teams' && user?.isAdmin">
          <Teams />
        </div>

        <!-- Error Logs Tab -->
        <div v-if="selectedTab === 'errorlogs' && user?.isAdmin">
          <ErrorLogsView />
        </div>
        
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
</style>