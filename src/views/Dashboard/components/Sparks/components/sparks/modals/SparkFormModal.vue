<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="900">
    <v-card>
      <v-card-title>
        Bulk Add Sparks
        <v-spacer />
        <v-btn icon variant="text" @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-form ref="bulkAddFormRef">
          <v-alert
            type="info"
            variant="tonal"
            density="compact"
            class="mb-4"
          >
            <v-icon>mdi-information</v-icon>
            Spark codes will be automatically generated if not provided. You can enter fewer spark codes than TikTok links.
          </v-alert>

          <v-text-field
            v-model="form.baseName"
            label="Base Name (e.g., Max-0901)"
            variant="outlined"
            density="compact"
            hint="This will be used as the name prefix for all sparks"
            class="mb-4"
            @input="updatePreview"
          />

          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.offer"
                label="Offer"
                variant="outlined"
                density="compact"
                clearable
                hint="Enter an offer for these sparks"
                persistent-hint
                class="mb-2"
                @update:model-value="updateBaseName"
              />
              <div class="mb-4">
                <v-chip-group>
                  <v-chip
                    v-for="offerType in offerTypes"
                    :key="offerType"
                    size="small"
                    variant="outlined"
                    @click="selectOfferType(offerType)"
                    class="mr-1 mb-1"
                  >
                    {{ offerType }}
                  </v-chip>
                </v-chip-group>
              </div>
            </v-col>

            <v-col cols="12" md="6">
              <v-select
                v-model="form.creator"
                label="Creator (VA)"
                :items="virtualAssistants"
                variant="outlined"
                density="compact"
                class="mb-4"
                @update:model-value="updateBaseName"
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
                class="mb-4"
              />
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" md="6">
              <v-textarea
                v-model="form.tiktokLinks"
                label="TikTok Links (one per line)"
                variant="outlined"
                density="compact"
                rows="8"
                hint="Enter one TikTok link per line"
                placeholder="https://www.tiktok.com/@user/video/123&#10;https://www.tiktok.com/@user/video/456"
                @input="updatePreview"
              />
            </v-col>

            <v-col cols="12" md="6">
              <v-textarea
                v-model="form.sparkCodes"
                label="Spark Codes (one per line - Required)"
                variant="outlined"
                density="compact"
                rows="8"
                hint="Required: Must have one spark code for each TikTok link"
                placeholder="SC001&#10;SC002&#10;SC003"
                @input="updatePreview"
              />
            </v-col>
          </v-row>

          <v-expansion-panels v-if="hasCommentBotAccess" class="mb-4">
            <v-expansion-panel>
              <v-expansion-panel-title>
                <v-row align="center" no-gutters>
                  <v-col cols="auto" class="mr-3">
                    <v-checkbox
                      v-model="form.enableCommentBot"
                      @click.stop
                      hide-details
                      density="compact"
                    />
                  </v-col>
                  <v-col>
                    <div class="d-flex align-center">
                      <v-icon class="mr-2">mdi-robot</v-icon>
                      <span>Enable Comment Bot for these sparks</span>
                      <v-chip v-if="form.enableCommentBot" class="ml-3" size="small" color="primary">
                        Cost: {{ preview.length || 0 }} credits
                      </v-chip>
                    </div>
                  </v-col>
                </v-row>
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <v-alert
                  type="info"
                  variant="tonal"
                  density="compact"
                  class="mb-3"
                >
                  <div class="d-flex align-center justify-space-between">
                    <div>
                      <v-icon size="small" class="mr-1">mdi-coin</v-icon>
                      <strong>Available Credits:</strong> {{ userCredits || 0 }}
                    </div>
                    <div>
                      <v-icon size="small" class="mr-1">mdi-calculator</v-icon>
                      <strong>Cost per Spark:</strong> 1 credit
                    </div>
                    <div>
                      <v-icon size="small" class="mr-1">mdi-cash</v-icon>
                      <strong>Total Cost:</strong> {{ preview.length || 0 }} credits
                    </div>
                  </div>
                </v-alert>

                <v-row>
                  <v-col cols="12">
                    <v-select
                      v-model="form.commentGroupId"
                      :items="commentGroups"
                      item-title="name"
                      item-value="id"
                      label="Comment Group *"
                      variant="outlined"
                      density="compact"
                      :rules="form.enableCommentBot ? [v => !!v || 'Comment group is required'] : []"
                      clearable
                    />
                  </v-col>
                </v-row>

                <v-row>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model.number="form.likeCount"
                      type="number"
                      label="Likes per Spark"
                      variant="outlined"
                      density="compact"
                      :rules="[v => v >= 0 && v <= 3000 || 'Max 3,000']"
                      placeholder="0-3000"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model.number="form.saveCount"
                      type="number"
                      label="Saves per Spark"
                      variant="outlined"
                      density="compact"
                      :rules="[v => v >= 0 && v <= 500 || 'Max 500']"
                      placeholder="0-500"
                    />
                  </v-col>
                </v-row>

                <v-alert
                  v-if="preview.length > 0"
                  type="success"
                  variant="tonal"
                  density="compact"
                >
                  <strong>Total engagement:</strong>
                  {{ preview.length * (form.likeCount || 0) }} likes,
                  {{ preview.length * (form.saveCount || 0) }} saves
                </v-alert>

                <v-alert
                  v-if="form.enableCommentBot && preview.length > userCredits"
                  type="warning"
                  variant="tonal"
                  density="compact"
                  class="mt-2"
                >
                  <v-icon size="small" class="mr-1">mdi-alert</v-icon>
                  Insufficient credits! You need {{ preview.length }} credits but only have {{ userCredits }}.
                </v-alert>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>

          <v-card
            v-if="preview.length > 0 || validationMessage"
            class="mt-4"
            variant="tonal"
            :color="preview.length > 0 ? 'info' : 'warning'"
          >
            <v-card-title class="text-h6">
              <template v-if="preview.length > 0">
                Preview: {{ preview.length }} spark(s) ready to create
                <v-chip v-if="form.enableCommentBot" class="ml-2" size="small" color="primary" variant="flat">
                  <v-icon start size="small">mdi-robot</v-icon>
                  With Comment Bot
                </v-chip>
              </template>
              <template v-else>
                Validation Required
              </template>
            </v-card-title>
            <v-card-text>
              <v-alert
                v-if="form.enableCommentBot && preview.length > 0"
                type="info"
                variant="tonal"
                density="compact"
                class="mb-3"
              >
                <div class="font-weight-medium mb-2">
                  <v-icon size="small" class="mr-1">mdi-robot</v-icon>
                  Comment Bot Settings:
                </div>
                <div class="text-caption">
                  <div>• Comment Group: {{ commentGroups.find(g => g.id === form.commentGroupId)?.name || 'Not selected' }}</div>
                  <div>• Likes per spark: {{ form.likeCount || 0 }}</div>
                  <div>• Saves per spark: {{ form.saveCount || 0 }}</div>
                  <div>• Total cost: {{ preview.length }} credits</div>
                  <div class="mt-1 font-weight-medium">
                    Total engagement: {{ preview.length * (form.likeCount || 0) }} likes, {{ preview.length * (form.saveCount || 0) }} saves
                  </div>
                </div>
              </v-alert>

              <v-alert
                v-if="validationMessage && preview.length === 0"
                type="warning"
                variant="tonal"
                density="compact"
                class="mb-0"
              >
                {{ validationMessage }}
              </v-alert>

              <v-list v-if="preview.length > 0" density="compact" class="preview-list">
                <v-list-item
                  v-for="(item, index) in preview.slice(0, 10)"
                  :key="index"
                  class="px-0"
                >
                  <template v-slot:prepend>
                    <span class="text-caption text-grey mr-3">{{ index + 1 }}.</span>
                  </template>
                  <v-list-item-title class="text-body-1">
                    <strong>{{ item.name }}</strong>
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip size="x-small" variant="flat" class="mr-2">{{ item.sparkCode }}</v-chip>
                    <span class="text-caption">{{ item.tiktokLink.substring(0, 50) }}{{ item.tiktokLink.length > 50 ? '...' : '' }}</span>
                  </v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="preview.length > 10" class="text-center">
                  <v-list-item-title class="text-caption text-grey">
                    ... and {{ preview.length - 10 }} more
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          color="primary"
          variant="elevated"
          @click="save"
          :disabled="preview.length === 0 || isLoading"
          :loading="isLoading"
        >
          Create {{ preview.length }} Spark{{ preview.length === 1 ? '' : 's' }}
        </v-btn>
        <v-btn variant="text" @click="close">Cancel</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useAuth } from '@/composables/useAuth';

const props = defineProps({
  modelValue: Boolean,
  virtualAssistants: {
    type: Array,
    default: () => []
  },
  commentGroups: {
    type: Array,
    default: () => []
  },
  hasCommentBotAccess: Boolean,
  userCredits: {
    type: Number,
    default: 0
  },
  isLoading: Boolean
});

const emit = defineEmits(['update:modelValue', 'save']);

// Get current user info
const { user, isAssistingUser } = useAuth();

const bulkAddFormRef = ref(null);

const statusOptions = [
  { title: 'Active', value: 'active' },
  { title: 'Testing', value: 'testing' },
  { title: 'Untested', value: 'untested' },
  { title: 'Blocked', value: 'blocked' }
];

const offerTypes = [
  'Playful',
  'Testerup',
  'Shein',
  'Cash',
  'PayPal'
];

// Get default creator based on current user
const defaultCreator = computed(() => {
  if (isAssistingUser.value) {
    // If user is a VA, use their email
    return user.value?.email || '';
  } else {
    // If main user, use their email
    return user.value?.email || '';
  }
});

const form = ref({
  baseName: '',
  offer: 'Cash',
  creator: defaultCreator.value,
  status: 'active',
  tiktokLinks: '',
  sparkCodes: '',
  enableCommentBot: false,
  commentGroupId: null,
  likeCount: 0,
  saveCount: 0
});

const preview = ref([]);
const validationMessage = ref('');

// Watch for modal opening to set initial base name
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    // Modal is opening, set creator and update base name
    form.value.creator = defaultCreator.value;
    updateBaseName();
  }
});

// Watch for changes in default creator
watch(defaultCreator, (newCreator) => {
  form.value.creator = newCreator;
  updateBaseName();
});

function generateDefaultName(creator, offer) {
  if (!creator) return '';
  const creatorName = (typeof creator === 'object' ? creator.title : creator).split('@')[0]; // Get part before @
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getFullYear()).slice(2)}`; // DDMMYY format
  const offerName = (offer || 'auto').toLowerCase().replace(/\s+/g, ''); // Remove spaces
  return `${creatorName}-${dateStr}-${offerName}`;
}

function updateBaseName() {
  form.value.baseName = generateDefaultName(form.value.creator, form.value.offer);
}

function selectOfferType(offerType) {
  form.value.offer = offerType;
  updateBaseName();
  updatePreview();
}

function updatePreview() {
  const links = form.value.tiktokLinks.split('\n').map(l => l.trim()).filter(Boolean);
  const codes = form.value.sparkCodes.split('\n').map(c => c.trim()).filter(Boolean);

  if (links.length === 0) {
    preview.value = [];
    validationMessage.value = 'Please enter at least one TikTok link';
    return;
  }

  if (codes.length === 0) {
    preview.value = [];
    validationMessage.value = 'Please enter at least one spark code';
    return;
  }

  if (codes.length !== links.length) {
    preview.value = [];
    validationMessage.value = `Mismatch: ${links.length} links but ${codes.length} spark codes. They must match.`;
    return;
  }

  validationMessage.value = '';
  preview.value = links.map((link, index) => {
    // Generate name in format: {creator}-{date}-{offer} (no spaces)
    const creatorName = (form.value.creator || '').split('@')[0]; // Get part before @
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getFullYear()).slice(2)}`; // DDMMYY format
    const offer = (form.value.offer || 'auto').toLowerCase().replace(/\s+/g, ''); // Remove spaces
    const name = `${creatorName}-${dateStr}-${offer}`;

    return {
      name: name || `Spark ${index + 1}`,
      tiktokLink: link || '',
      sparkCode: codes[index] || '',
      creator: form.value.creator || '',
      status: form.value.status || 'active',
      offer: form.value.offer || 'auto', // Use offer field only
      thumbnail: '', // Ensure thumbnail field is present
      paymentStatus: 'unpaid', // Ensure paymentStatus is present
      traffic: '0' // Ensure traffic field is present
    };
  });
}

function close() {
  form.value = {
    baseName: '',
    offer: 'Cash',
    creator: defaultCreator.value,
    status: 'active',
    tiktokLinks: '',
    sparkCodes: '',
    enableCommentBot: false,
    commentGroupId: null,
    likeCount: 0,
    saveCount: 0
  };
  preview.value = [];
  validationMessage.value = '';
  emit('update:modelValue', false);
}

function save() {
  emit('save', {
    sparks: preview.value,
    enableCommentBot: form.value.enableCommentBot,
    commentBotSettings: {
      commentGroupId: form.value.commentGroupId,
      likeCount: form.value.likeCount,
      saveCount: form.value.saveCount
    }
  });
}
</script>

<style scoped>
.preview-list {
  background: transparent;
}
</style>