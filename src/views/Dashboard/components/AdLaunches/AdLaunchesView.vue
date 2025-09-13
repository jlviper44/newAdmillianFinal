<template>
  <v-container fluid>
    <v-tabs v-model="activeTab" color="purple">
      <v-tab value="tracker">Ad Launches</v-tab>
      <v-tab value="timeclock">Time Clock</v-tab>
      <!-- Only show Payroll tabs for non-VA users (admin/original user) -->
      <v-tab v-if="!isVA" value="payroll">Payroll Calculator</v-tab>
      <v-tab v-if="!isVA" value="history">Payroll History</v-tab>
    </v-tabs>

    <v-window v-model="activeTab" class="mt-4">
      <v-window-item value="tracker">
        <TrackerTab 
          :user="user" 
          @show-message="showMessage"
        />
      </v-window-item>

      <v-window-item value="timeclock">
        <TimeClockTab 
          :user="user"
          @show-message="showMessage"
        />
      </v-window-item>

      <!-- Only show Payroll content for non-VA users (admin/original user) -->
      <v-window-item v-if="!isVA" value="payroll">
        <PayrollTab 
          :user="user"
          @show-message="showMessage"
          @switch-tab="activeTab = $event"
        />
      </v-window-item>

      <v-window-item v-if="!isVA" value="history">
        <PayrollHistoryTab 
          @show-message="showMessage"
        />
      </v-window-item>
    </v-window>

    <!-- Snackbar for notifications -->
    <v-snackbar
      v-model="showSnackbar"
      :color="snackbarColor"
      :timeout="3000"
    >
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn
          variant="text"
          @click="showSnackbar = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useAuth } from '@/composables/useAuth';
import TrackerTab from './tabs/TrackerTab.vue';
import TimeClockTab from './tabs/TimeClockTab.vue';
import PayrollTab from './tabs/PayrollTab.vue';
import PayrollHistoryTab from './tabs/PayrollHistoryTab.vue';

// Get auth user
const { user } = useAuth();

// Check if user is a Virtual Assistant
const isVA = computed(() => user.value?.isVirtualAssistant === true);

// Tab state
const activeTab = ref('tracker');

// Snackbar state
const showSnackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

// Methods
const showMessage = ({ text, color = 'success' }) => {
  snackbarText.value = text;
  snackbarColor.value = color;
  showSnackbar.value = true;
};
</script>