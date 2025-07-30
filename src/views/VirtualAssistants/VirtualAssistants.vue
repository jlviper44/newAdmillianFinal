<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import AuthGuard from '@/components/AuthGuard.vue';
import VirtualAssistantCredits from './components/VirtualAssistantCredits.vue';
import VirtualAssistantConfigure from './components/VirtualAssistantConfigure.vue';

const { user } = useAuth();
const route = useRoute();

// Tab management
const currentTab = ref('configure');

// Tab titles mapping
const tabTitles = {
  credits: 'Credits',
  configure: 'Configure'
};

// Computed property for current tab title
const currentTabTitle = computed(() => {
  return tabTitles[currentTab.value] || 'AI-powered assistants';
});

// Watch for route query changes
watch(() => route.query.tab, (newTab) => {
  if (newTab && ['credits', 'configure'].includes(newTab)) {
    currentTab.value = newTab;
  }
});

// Lifecycle hooks
onMounted(() => {
  // Set initial tab from query parameter
  if (route.query.tab && ['credits', 'configure'].includes(route.query.tab)) {
    currentTab.value = route.query.tab;
  } else {
    // Default to configure tab
    currentTab.value = 'configure';
  }
});
</script>

<template>
  <AuthGuard>
    <v-container fluid :class="{ 'pa-2': $vuetify.display.smAndDown }">
      <!-- Mobile Header -->
      <v-row v-if="$vuetify.display.smAndDown">
        <v-col cols="12" class="pb-2">
          <div class="text-center">
            <h2 class="text-h6 font-weight-bold">Virtual Assistants</h2>
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
                <v-icon icon="mdi-robot" size="x-large" class="mr-2"></v-icon>
                Virtual Assistants
              </h1>
              <p class="text-subtitle-1 text-grey-darken-1 mt-1">{{ currentTabTitle }}</p>
            </div>
          </div>
        </v-col>
      </v-row>

      <v-row>
        <!-- Content Area -->
        <v-col cols="12">
          <!-- Credits Tab -->
          <div v-if="currentTab === 'credits'">
            <VirtualAssistantCredits />
          </div>

          <!-- Configure Tab -->
          <div v-if="currentTab === 'configure'">
            <VirtualAssistantConfigure />
          </div>
        </v-col>
      </v-row>
    </v-container>
  </AuthGuard>
</template>

<style scoped>
</style>