<template>
  <v-card v-if="isCommentBotMode" class="mb-4 batch-update-card">
    <!-- Credits Display -->
    <v-alert
      type="info"
      variant="tonal"
      density="compact"
      class="mb-0"
    >
      <div class="d-flex align-center justify-space-between">
        <div>
          <v-icon size="small" class="mr-1">mdi-coin</v-icon>
          <strong>Available Credits:</strong> {{ userCredits || 0 }}
        </div>
        <div>
          <v-icon size="small" class="mr-1">mdi-calculator</v-icon>
          <strong>Cost per Order:</strong> 1 credit
        </div>
        <div>
          <v-icon size="small" class="mr-1">mdi-cash</v-icon>
          <strong>Total Cost:</strong> {{ selectedForBot.length }} credits
        </div>
      </div>
    </v-alert>

    <!-- No Selection Warning -->
    <v-alert
      v-if="selectedForBot.length === 0"
      type="warning"
      variant="tonal"
      density="compact"
      class="mt-2"
    >
      <v-icon size="small" class="mr-1">mdi-alert</v-icon>
      Please select at least one spark from the table below to create an order
    </v-alert>

    <v-card-title class="text-h6 pb-2">
      <v-icon class="mr-2">mdi-robot</v-icon>
      Comment Bot - Configure Settings for Selected Items
    </v-card-title>

    <v-card-text>
      <v-row align="center" dense>
        <v-col cols="12" md="4">
          <v-select
            :model-value="commentBotSettings.comment_group_id"
            @update:model-value="updateCommentBotSetting('comment_group_id', $event)"
            :items="commentGroups"
            item-title="name"
            item-value="id"
            label="Comment Group *"
            density="compact"
            variant="outlined"
            :error="!commentBotSettings.comment_group_id"
            hide-details
            clearable
            placeholder="Select a comment group"
          />
        </v-col>

        <v-col cols="12" md="3">
          <v-text-field
            :model-value="commentBotSettings.like_count"
            @update:model-value="updateCommentBotSetting('like_count', $event)"
            type="number"
            label="Likes per Spark"
            density="compact"
            variant="outlined"
            hide-details
            :rules="[v => v >= 0 && v <= 3000 || 'Max 3,000']"
            placeholder="0-3000"
          />
        </v-col>

        <v-col cols="12" md="3">
          <v-text-field
            :model-value="commentBotSettings.save_count"
            @update:model-value="updateCommentBotSetting('save_count', $event)"
            type="number"
            label="Saves per Spark"
            density="compact"
            variant="outlined"
            hide-details
            :rules="[v => v >= 0 && v <= 500 || 'Max 500']"
            placeholder="0-500"
          />
        </v-col>

        <v-col cols="12" md="2">
          <v-chip color="info" variant="tonal" class="w-100 justify-center">
            Total: {{ selectedForBot.length * (commentBotSettings.like_count || 0) }} likes,
            {{ selectedForBot.length * (commentBotSettings.save_count || 0) }} saves
          </v-chip>
        </v-col>
      </v-row>

      <v-row align="center" dense class="mt-3">
        <v-col cols="12" class="d-flex justify-space-between align-center">
          <v-chip color="primary" variant="flat">
            {{ selectedForBot.length }} selected
          </v-chip>
          <div class="d-flex">
            <v-btn
              variant="tonal"
              class="mr-2"
              @click="$emit('selectAllForBot')"
            >
              Select All Valid
            </v-btn>
            <v-btn
              variant="tonal"
              class="mr-2"
              @click="$emit('clearSelection')"
            >
              Clear Selection
            </v-btn>
            <v-tooltip
              :text="getCreateOrderTooltip()"
              :disabled="!!(selectedForBot.length > 0 && commentBotSettings.comment_group_id)"
            >
              <template v-slot:activator="{ props }">
                <v-btn
                  v-bind="props"
                  color="success"
                  variant="elevated"
                  @click="$emit('executeCommentBot')"
                  :loading="isProcessingBot"
                  :disabled="selectedForBot.length === 0 || !commentBotSettings.comment_group_id"
                >
                  <v-icon start>mdi-cart-plus</v-icon>
                  Create Order
                </v-btn>
              </template>
            </v-tooltip>
          </div>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup>
const props = defineProps({
  isCommentBotMode: Boolean,
  userCredits: Number,
  selectedForBot: Array,
  commentBotSettings: Object,
  commentGroups: Array,
  isProcessingBot: Boolean
});

const emit = defineEmits([
  'updateCommentBotSettings',
  'selectAllForBot',
  'clearSelection',
  'executeCommentBot'
]);

const updateCommentBotSetting = (key, value) => {
  const updatedSettings = { ...props.commentBotSettings, [key]: value };
  emit('updateCommentBotSettings', updatedSettings);
};

const getCreateOrderTooltip = () => {
  if (props.selectedForBot.length === 0 && !props.commentBotSettings.comment_group_id) {
    return 'Please select at least one spark and a comment group';
  } else if (props.selectedForBot.length === 0) {
    return 'Please select at least one spark';
  } else if (!props.commentBotSettings.comment_group_id) {
    return 'Please select a comment group';
  }
  return '';
};
</script>

<style scoped>
/* Batch update card styling */
.batch-update-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.batch-update-card .v-card-title {
  color: white;
}

.batch-update-card .v-alert {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}
</style>