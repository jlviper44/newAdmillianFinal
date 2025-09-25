<template>
  <v-dialog v-model="modelValue" max-width="600">
    <v-card>
      <v-card-title>
        {{ spark?.name }}
        <v-spacer />
        <v-btn icon variant="text" @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-img
          :src="spark?.thumbnail"
          :alt="spark?.name"
          max-height="400"
          contain
        />
        <div class="mt-4">
          <p><strong>Spark Code:</strong> {{ spark?.spark_code }}</p>
          <p><strong>Status:</strong> {{ spark?.status }}</p>
          <v-btn
            :href="spark?.tiktok_link"
            target="_blank"
            color="primary"
            variant="tonal"
            class="mt-2"
          >
            View on TikTok
          </v-btn>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup>
const props = defineProps({
  modelValue: Boolean,
  spark: Object
});

const emit = defineEmits(['update:modelValue']);

function close() {
  emit('update:modelValue', false);
}
</script>