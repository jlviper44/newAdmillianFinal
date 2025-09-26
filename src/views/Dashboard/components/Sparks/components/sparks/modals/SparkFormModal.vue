<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="700">
    <v-card>
      <v-card-title>
        {{ editingSparkData ? 'Edit Spark' : 'Create Spark' }}
        <v-spacer />
        <v-btn icon variant="text" @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-form ref="sparkFormRef">
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.name"
                label="Spark Name"
                required
                variant="outlined"
                density="compact"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="form.creator"
                label="Creator (VA)"
                :items="virtualAssistants"
                variant="outlined"
                density="compact"
                hint="Select the virtual assistant who created this spark"
                @update:model-value="form.name = generateDefaultName($event, form.type)"
                :rules="[v => v !== undefined || 'Please select a creator']"
                required
              />
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="form.tiktokLink"
                label="TikTok Video Link"
                type="url"
                required
                variant="outlined"
                density="compact"
                hint="Full TikTok video URL"
              />
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.sparkCode"
                label="Spark Code"
                required
                variant="outlined"
                density="compact"
                hint="Unique identifier code"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.type"
                label="Offer"
                variant="outlined"
                density="compact"
                clearable
                hint="Enter an offer for this spark"
                persistent-hint
                @update:model-value="form.name = generateDefaultName(form.creator, $event)"
              />
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" md="6">
              <v-select
                v-model="form.status"
                label="Status"
                :items="statusOptions"
                variant="outlined"
                density="compact"
              />
            </v-col>
          </v-row>

          <v-row v-if="editingSparkData?.thumbnail">
            <v-col cols="12">
              <p class="text-caption mb-2">Current Thumbnail:</p>
              <v-img
                :src="editingSparkData.thumbnail"
                max-height="150"
                max-width="150"
                class="rounded"
              />
              <p class="text-caption mt-1 text-grey">Thumbnail is auto-generated from TikTok link</p>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn color="primary" variant="elevated" @click="save">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  modelValue: Boolean,
  editingSparkData: Object,
  virtualAssistants: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:modelValue', 'save']);

const sparkFormRef = ref(null);

const statusOptions = [
  { title: 'Active', value: 'active' },
  { title: 'Testing', value: 'testing' },
  { title: 'Untested', value: 'untested' },
  { title: 'Blocked', value: 'blocked' }
];

const form = ref({
  name: '',
  creator: '',
  tiktokLink: '',
  sparkCode: '',
  type: '',
  status: 'untested'
});

watch(() => props.editingSparkData, (newVal) => {
  if (newVal) {
    form.value = {
      name: newVal.name || '',
      creator: newVal.creator || '',
      tiktokLink: newVal.tiktok_link || '',
      sparkCode: newVal.spark_code || '',
      type: newVal.type || '',
      status: newVal.status || 'untested'
    };
  } else {
    form.value = {
      name: '',
      creator: '',
      tiktokLink: '',
      sparkCode: '',
      type: '',
      status: 'untested'
    };
  }
}, { immediate: true });

function generateDefaultName(creator, type) {
  if (!creator) return '';

  const creatorName = typeof creator === 'object' ? creator.title : creator;
  const typeName = type || 'Auto';

  return `${creatorName} - ${typeName}`;
}

function close() {
  emit('update:modelValue', false);
}

function save() {
  emit('save', form.value);
}
</script>