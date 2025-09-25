<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-spacer />
      <v-chip color="info" size="small">View Only</v-chip>
    </v-card-title>

    <v-card-text>
      <!-- Simple data table for viewing only -->
      <v-data-table
        :headers="headers"
        :items="sparks"
        :loading="isLoading"
        :items-per-page="itemsPerPage"
        class="sparks-table"
        density="compact"
      >
        <!-- Date Column -->
        <template v-slot:item.created_at="{ item }">
          <span class="text-caption">{{ formatDate(item.created_at) }}</span>
        </template>

        <!-- Thumbnail Column -->
        <template v-slot:item.thumbnail="{ item }">
          <div class="thumbnail-container" v-if="showThumbnails">
            <v-img
              :src="item.thumbnail || defaultThumbnail"
              :alt="item.name"
              width="100"
              height="200"
              class="rounded"
              @error="handleImageError"
            ></v-img>
          </div>
        </template>

        <!-- TikTok Link Column -->
        <template v-slot:item.tiktok_link="{ item }">
          <a
            v-if="item.tiktok_link"
            :href="item.tiktok_link"
            target="_blank"
            class="text-primary text-decoration-none"
          >
            <v-icon size="small" class="mr-1">mdi-open-in-new</v-icon>
            View
          </a>
          <span v-else class="text-grey">No link</span>
        </template>

        <!-- Content Type Column -->
        <template v-slot:item.content_type="{ item }">
          <v-chip
            size="small"
            :color="getTypeColor(item.content_type)"
            variant="tonal"
          >
            {{ item.content_type || 'Auto' }}
          </v-chip>
        </template>

        <!-- Spark Code Column -->
        <template v-slot:item.spark_code="{ item }">
          <code class="text-caption">{{ item.spark_code }}</code>
        </template>

        <!-- Status Column -->
        <template v-slot:item.status="{ item }">
          <v-chip
            size="small"
            :color="getStatusColor(item.status)"
            variant="tonal"
          >
            {{ getStatusLabel(item.status) }}
          </v-chip>
        </template>

        <!-- Bot Status Column -->
        <template v-slot:item.bot_status="{ item }">
          <v-chip
            v-if="item.bot_status"
            size="small"
            :color="getBotStatusColor(item.bot_status)"
            variant="tonal"
          >
            {{ item.bot_status }}
          </v-chip>
          <span v-else class="text-grey">-</span>
        </template>

        <!-- Offer Column -->
        <template v-slot:item.offer="{ item }">
          <span>{{ item.offer || '-' }}</span>
        </template>

        <!-- Creator Column -->
        <template v-slot:item.creator="{ item }">
          <span>{{ item.creator || '-' }}</span>
        </template>

        <!-- Name Column -->
        <template v-slot:item.name="{ item }">
          <span class="font-weight-medium">{{ item.name || 'Untitled' }}</span>
        </template>

        <!-- No data message -->
        <template v-slot:no-data>
          <div class="text-center pa-4">
            <v-icon size="48" color="grey-lighten-2" class="mb-2">mdi-lightning-bolt-outline</v-icon>
            <div class="text-h6 text-grey">No sparks found</div>
            <div class="text-caption text-grey">Start by creating some sparks</div>
          </div>
        </template>
      </v-data-table>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { computed } from 'vue';

// Props
const props = defineProps({
  sparks: {
    type: Array,
    default: () => []
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  itemsPerPage: {
    type: Number,
    default: 25
  },
  showThumbnails: {
    type: Boolean,
    default: true
  }
});

// Default thumbnail
const defaultThumbnail = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjRTBFMEUwIi8+CjxwYXRoIGQ9Ik0yNSAxOEwyOSAyNUwyNSAzMkwyMSAyNVoiIGZpbGw9IiM5RTlFOUUiLz4KPC9zdmc+';

// Table headers
const headers = computed(() => {
  let baseHeaders = [
    { title: 'Date', key: 'created_at', sortable: true, width: '100px' },
    { title: 'Preview', key: 'thumbnail', sortable: false, width: '120px' },
    { title: 'Link', key: 'tiktok_link', sortable: false, width: '100px' },
    { title: 'Type', key: 'content_type', sortable: true, width: '120px' },
    { title: 'Spark Code', key: 'spark_code', sortable: true, width: '150px' },
    { title: 'Status', key: 'status', sortable: true, width: '100px' },
    { title: 'Bot Status', key: 'bot_status', sortable: true, width: '140px' },
    { title: 'Offer', key: 'offer', sortable: true, width: '120px' },
    { title: 'Creator', key: 'creator', sortable: true, width: '120px' },
    { title: 'Name', key: 'name', sortable: true }
  ];

  // Hide thumbnail column if not showing thumbnails
  if (!props.showThumbnails) {
    baseHeaders = baseHeaders.filter(h => h.key !== 'thumbnail');
  }

  return baseHeaders;
});

// Utility functions
const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
};

const handleImageError = (event) => {
  event.target.src = defaultThumbnail;
};

const getTypeColor = (type) => {
  const lowerType = (type || 'Auto').toLowerCase();
  switch (lowerType) {
    case 'cpi': return 'blue';
    case 'sweeps': return 'purple';
    case 'cash': return 'green';
    case 'paypal': return 'orange';
    case 'auto': return 'indigo';
    case 'home': return 'teal';
    default: return 'grey';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'active': return 'success';
    case 'testing': return 'warning';
    case 'blocked': return 'error';
    default: return 'grey';
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'active': return 'Active';
    case 'testing': return 'Testing';
    case 'blocked': return 'Blocked';
    default: return status || 'Unknown';
  }
};

const getBotStatusColor = (status) => {
  switch (status) {
    case 'completed': return 'success';
    case 'processing': return 'info';
    case 'queued': return 'warning';
    case 'failed': return 'error';
    default: return 'grey';
  }
};
</script>

<style scoped>
.sparks-table {
  /* Custom table styling */
}

.thumbnail-container {
  display: inline-block;
  overflow: hidden;
  border-radius: 4px;
}

code {
  padding: 2px 6px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.05);
  font-family: monospace;
  font-size: 0.75rem;
}

.v-theme--dark code {
  background-color: rgba(255, 255, 255, 0.1);
}
</style>