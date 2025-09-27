<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <!-- View Toggle -->
      <v-btn-toggle
        v-model="viewMode"
        mandatory
        density="compact"
        variant="outlined"
        divided
      >
        <v-btn value="table" size="small">
          <v-icon start>mdi-table</v-icon>
          Table
        </v-btn>
        <v-btn value="card" size="small">
          <v-icon start>mdi-view-grid</v-icon>
          Cards
        </v-btn>
      </v-btn-toggle>
      <v-spacer />
      <v-chip color="info" size="small">View Only</v-chip>
    </v-card-title>

    <v-card-text>
      <!-- Table View -->
      <v-data-table
        v-if="viewMode === 'table'"
        :headers="headers"
        :items="sparks"
        :loading="isLoading"
        :items-per-page="50"
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
            <v-icon size="small">mdi-open-in-new</v-icon>
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
          <code class="text-caption" style="max-width: 150px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" :title="item.spark_code">{{ item.spark_code }}</code>
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

      <!-- Card View -->
      <div v-else-if="viewMode === 'card'">
        <!-- Loading state -->
        <div v-if="isLoading" class="text-center pa-8">
          <v-progress-circular indeterminate color="primary" />
          <div class="text-body-2 mt-2">Loading sparks...</div>
        </div>

        <!-- Cards Grid -->
        <v-row v-else-if="sparks.length > 0">
          <v-col
            v-for="spark in sparks"
            :key="spark.id"
            cols="12"
            sm="6"
            md="4"
            lg="3"
          >
            <v-card class="spark-card" height="100%">
              <!-- Thumbnail -->
              <v-img
                :src="spark.thumbnail || defaultThumbnail"
                :alt="spark.name"
                height="200"
                cover
                class="align-end"
                @error="handleImageError"
              >
                <!-- Status overlay -->
                <v-chip
                  :color="getStatusColor(spark.status)"
                  size="small"
                  class="ma-2"
                  style="position: absolute; top: 0; right: 0;"
                >
                  {{ getStatusLabel(spark.status) }}
                </v-chip>
              </v-img>

              <v-card-title class="text-h6 py-2">
                {{ spark.name || 'Untitled' }}
              </v-card-title>

              <v-card-subtitle class="py-0">
                <v-chip
                  size="x-small"
                  :color="getTypeColor(spark.content_type)"
                  variant="tonal"
                  class="mr-1"
                >
                  {{ spark.content_type || 'Auto' }}
                </v-chip>
                <span class="text-caption">{{ formatDate(spark.created_at) }}</span>
              </v-card-subtitle>

              <v-card-text>
                <div class="d-flex flex-column gap-1">
                  <!-- Spark Code with Copy Button -->
                  <div class="d-flex align-center">
                    <v-btn
                      size="x-small"
                      variant="tonal"
                      color="primary"
                      @click.stop="() => copySparkCode(spark)"
                      :disabled="!spark.spark_code && !spark.sparkCode && !spark.code"
                    >
                      <v-icon start size="x-small">{{ isCodeCopied(spark) ? 'mdi-check' : 'mdi-content-copy' }}</v-icon>
                      {{ isCodeCopied(spark) ? 'Copied!' : 'Copy Spark Code' }}
                    </v-btn>
                    <span v-if="!spark.spark_code && !spark.sparkCode && !spark.code" class="text-caption text-grey ml-2">No code</span>
                  </div>

                  <!-- Creator -->
                  <div v-if="spark.creator" class="text-caption">
                    <v-icon size="x-small" class="mr-1">mdi-account</v-icon>
                    {{ spark.creator }}
                  </div>

                  <!-- Offer -->
                  <div v-if="spark.offer" class="text-caption">
                    <v-icon size="x-small" class="mr-1">mdi-tag</v-icon>
                    {{ spark.offer }}
                  </div>

                  <!-- Bot Status -->
                  <div v-if="spark.bot_status" class="text-caption">
                    <v-icon size="x-small" class="mr-1">mdi-robot</v-icon>
                    <v-chip
                      size="x-small"
                      :color="getBotStatusColor(spark.bot_status)"
                      variant="tonal"
                    >
                      {{ spark.bot_status }}
                    </v-chip>
                  </div>
                </div>
              </v-card-text>

              <v-card-actions>
                <v-btn
                  v-if="spark.tiktok_link"
                  @click="openLink(spark.tiktok_link)"
                  size="small"
                  variant="tonal"
                  color="primary"
                  block
                >
                  <v-icon start>mdi-open-in-new</v-icon>
                  Open
                </v-btn>
                <div v-else class="text-center text-grey text-caption w-100 py-2">
                  No link available
                </div>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>

        <!-- No data state -->
        <div v-else class="text-center pa-8">
          <v-icon size="48" color="grey-lighten-2" class="mb-2">mdi-lightning-bolt-outline</v-icon>
          <div class="text-h6 text-grey">No sparks found</div>
          <div class="text-caption text-grey">Start by creating some sparks</div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, computed } from 'vue';

// View mode state
const viewMode = ref('card');

// Copy state
const copiedCode = ref(null);

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
    { title: 'Date', key: 'created_at', sortable: true, width: '80px' },
    { title: 'Preview', key: 'thumbnail', sortable: false, width: '120px' },
    { title: 'Link', key: 'tiktok_link', sortable: false, width: '50px' },
    { title: 'Type', key: 'content_type', sortable: true, width: '80px' },
    { title: 'Code', key: 'spark_code', sortable: true, width: '120px' },
    { title: 'Status', key: 'status', sortable: true, width: '90px' },
    { title: 'Bot', key: 'bot_status', sortable: true, width: '80px' },
    { title: 'Offer', key: 'offer', sortable: true, width: '100px' },
    { title: 'Creator', key: 'creator', sortable: true, width: '100px' },
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

// Open link in new tab
const openLink = (url) => {
  if (url) {
    window.open(url, '_blank');
  }
};

// Check if code is copied
const isCodeCopied = (spark) => {
  const code = spark.spark_code || spark.sparkCode || spark.code;
  return copiedCode.value === code;
};

// Copy spark code to clipboard
const copySparkCode = async (spark) => {
  console.log('Full spark object:', JSON.stringify(spark, null, 2));
  console.log('Available fields:', Object.keys(spark));

  // Try different possible field names for the spark code
  const code = spark.spark_code || spark.sparkCode || spark.code || '';

  console.log('spark.spark_code:', spark.spark_code);
  console.log('spark.tiktok_link:', spark.tiktok_link);
  console.log('Selected code to copy:', code);

  if (!code) {
    console.error('No spark code found! Available fields:', Object.keys(spark));
    if (spark.tiktok_link) {
      console.warn('WARNING: Found tiktok_link but no spark_code!');
    }
    alert('No spark code found! Check console for details.');
    return;
  }

  try {
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(code);
      console.log('Copied using clipboard API:', code);
    } else {
      // Fallback for older browsers or non-HTTPS
      const textArea = document.createElement('textarea');
      textArea.value = code;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand('copy');
        console.log('Copied using fallback method:', code);
      } catch (err) {
        console.error('Fallback copy failed:', err);
        alert('Failed to copy. Please copy manually: ' + code);
        return;
      } finally {
        textArea.remove();
      }
    }

    copiedCode.value = code;

    // Reset after 2 seconds
    setTimeout(() => {
      copiedCode.value = null;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    // Last resort - show the code to copy manually
    alert('Failed to copy. Spark code: ' + code);
  }
};
</script>

<style scoped>
.spark-card {
  transition: transform 0.2s, box-shadow 0.2s;
}

.spark-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
}

.gap-1 > *:not(:last-child) {
  margin-bottom: 4px;
}
</style>

<style scoped>
.sparks-table {
  font-size: 0.75rem;
}

.sparks-table :deep(.v-data-table__td) {
  padding: 6px 8px !important;
  height: auto !important;
}

.sparks-table :deep(.v-data-table__th) {
  padding: 8px 8px !important;
  font-size: 0.7rem !important;
  font-weight: 600 !important;
}

.sparks-table :deep(.v-chip) {
  font-size: 0.65rem !important;
  height: 20px !important;
  min-width: auto !important;
}

.sparks-table :deep(.text-caption) {
  font-size: 0.65rem !important;
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