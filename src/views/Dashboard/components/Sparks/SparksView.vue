<template>
  <v-container fluid class="new-sparks-container">

    <!-- Tab Navigation -->
    <v-tabs v-model="activeTab" class="mb-4">
      <v-tab value="sparks">Sparks</v-tab>
      <v-tab value="va-status">VA Status</v-tab>
      <v-tab value="payments">Active Payments</v-tab>
      <v-tab value="invoices">History and Invoices</v-tab>
    </v-tabs>

    <!-- Tab Content -->
    <v-window v-model="activeTab">
      <v-window-item value="sparks">
        <SparksTab />
      </v-window-item>

      <v-window-item value="va-status">
        <VAStatusTab />
      </v-window-item>

      <v-window-item value="payments">
        <PaymentsTab />
      </v-window-item>

      <v-window-item value="invoices">
        <InvoicesTab />
      </v-window-item>
    </v-window>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import SparksTab from './components/sparks/SparksTab.vue';
import VAStatusTab from './components/VAStatus/VAStatusTab.vue';
import PaymentsTab from './components/payments/PaymentsTab.vue';
import InvoicesTab from './components/invoices/InvoicesTab.vue';

// Tab state
const activeTab = ref('sparks');
</script>

<style scoped>
.new-sparks-container {
  padding-top: 20px;
}
</style>