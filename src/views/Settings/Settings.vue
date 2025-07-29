<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import Teams from './components/Teams.vue';

const { user, hasCommentBotAccess, hasBcGenAccess, hasDashboardAccess } = useAuth();

// Check if user has any subscription
const hasAnySubscription = computed(() => {
  return hasCommentBotAccess.value || hasBcGenAccess.value || hasDashboardAccess.value;
});
const route = useRoute();
// Set default tab based on what's available
const getDefaultTab = () => {
  if (hasAnySubscription.value) return 'virtual-assistants';
  if (user.value?.isAdmin) return 'teams';
  // If no subscription and not admin, still default to virtual-assistants
  // but it won't show anything
  return 'virtual-assistants';
};

const selectedTab = ref(getDefaultTab());

// Tab titles mapping
const tabTitles = {
  teams: 'Team Management',
  'virtual-assistants': 'Virtual Assistants'
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
  <v-container fluid :class="{ 'pa-2': $vuetify.display.smAndDown }">
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
        <!-- Virtual Assistants Tab -->
        <div v-if="selectedTab === 'virtual-assistants' && hasAnySubscription">
          <v-card>
            <v-card-title class="text-h5 font-weight-bold">
              <v-icon icon="mdi-assistant" size="small" class="mr-2"></v-icon>
              Virtual Assistants
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12">
                  <p class="text-body-1 text-grey-darken-1 mb-4">Manage your AI-powered virtual assistants.</p>
                  <!-- Virtual Assistants content will go here -->
                  <v-alert
                    type="info"
                    variant="tonal"
                    class="mb-4"
                  >
                    Virtual Assistants feature coming soon.
                  </v-alert>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </div>
        
        <!-- Teams Tab -->
        <div v-if="selectedTab === 'teams' && user?.isAdmin">
          <Teams />
        </div>
        
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
</style>