<template>
  <v-dialog v-model="dialog" max-width="800px" persistent>
    <v-card>
      <v-card-title>
        <span class="text-h5">{{ editingTest ? 'Edit A/B Test' : 'Create A/B Test' }}</span>
      </v-card-title>
      <v-card-text>
        <v-container>
          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="formData.name"
                label="Test Name"
                required
                :rules="[v => !!v || 'Name is required']"
              ></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="formData.description"
                label="Description"
                rows="3"
              ></v-textarea>
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="formData.type"
                :items="testTypes"
                label="Test Type"
                required
              ></v-select>
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="formData.status"
                :items="['draft', 'running', 'paused', 'completed']"
                label="Status"
              ></v-select>
            </v-col>
          </v-row>

          <v-divider class="my-4"></v-divider>

          <v-row>
            <v-col cols="12">
              <div class="d-flex justify-space-between align-center mb-2">
                <span class="text-subtitle-1">Variants</span>
                <v-btn color="primary" variant="text" @click="addVariant">
                  <v-icon left>mdi-plus</v-icon>
                  Add Variant
                </v-btn>
              </div>
            </v-col>
          </v-row>

          <v-row v-for="(variant, index) in formData.variants" :key="index" class="mb-2">
            <v-col cols="12" md="4">
              <v-text-field
                v-model="variant.name"
                :label="`Variant ${index + 1} Name`"
                required
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                v-model.number="variant.traffic_allocation"
                label="Traffic %"
                type="number"
                min="0"
                max="100"
                required
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field
                v-model="variant.destination_url"
                label="Destination URL"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="1">
              <v-btn
                icon
                variant="text"
                color="error"
                @click="removeVariant(index)"
                :disabled="formData.variants.length <= 2"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </v-col>
          </v-row>

          <v-divider class="my-4"></v-divider>

          <v-row>
            <v-col cols="12">
              <span class="text-subtitle-1">Test Configuration</span>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model.number="formData.min_sample_size"
                label="Minimum Sample Size"
                type="number"
                min="100"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model.number="formData.confidence_level"
                label="Confidence Level (%)"
                type="number"
                min="80"
                max="99.9"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-menu
                v-model="startDateMenu"
                :close-on-content-click="false"
                :nudge-right="40"
                transition="scale-transition"
                offset-y
                min-width="auto"
              >
                <template v-slot:activator="{ on, attrs }">
                  <v-text-field
                    v-model="formData.start_date"
                    label="Start Date"
                    prepend-icon="mdi-calendar"
                    readonly
                    v-bind="attrs"
                    v-on="on"
                  ></v-text-field>
                </template>
                <v-date-picker
                  v-model="formData.start_date"
                  @input="startDateMenu = false"
                ></v-date-picker>
              </v-menu>
            </v-col>
            <v-col cols="12" md="6">
              <v-menu
                v-model="endDateMenu"
                :close-on-content-click="false"
                :nudge-right="40"
                transition="scale-transition"
                offset-y
                min-width="auto"
              >
                <template v-slot:activator="{ on, attrs }">
                  <v-text-field
                    v-model="formData.end_date"
                    label="End Date (Optional)"
                    prepend-icon="mdi-calendar"
                    readonly
                    v-bind="attrs"
                    v-on="on"
                  ></v-text-field>
                </template>
                <v-date-picker
                  v-model="formData.end_date"
                  @input="endDateMenu = false"
                ></v-date-picker>
              </v-menu>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="grey" variant="text" @click="close">Cancel</v-btn>
        <v-btn color="primary" variant="elevated" @click="save" :loading="saving">
          {{ editingTest ? 'Update' : 'Create' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { ref, watch, computed } from 'vue'
import advancedAnalyticsAPI from '@/services/advancedAnalyticsAPI'

export default {
  name: 'ABTestDialog',
  props: {
    modelValue: Boolean,
    test: Object
  },
  emits: ['update:modelValue', 'saved'],
  setup(props, { emit }) {
    const dialog = computed({
      get: () => props.modelValue,
      set: (val) => emit('update:modelValue', val)
    })

    const saving = ref(false)
    const startDateMenu = ref(false)
    const endDateMenu = ref(false)
    const editingTest = computed(() => !!props.test)

    const testTypes = ref([
      'url_split',
      'element_test',
      'multivariate',
      'redirect_test',
      'personalization'
    ])

    const defaultFormData = {
      name: '',
      description: '',
      type: 'url_split',
      status: 'draft',
      variants: [
        { name: 'Control', traffic_allocation: 50, destination_url: '', is_control: true },
        { name: 'Variant A', traffic_allocation: 50, destination_url: '', is_control: false }
      ],
      min_sample_size: 1000,
      confidence_level: 95,
      start_date: new Date().toISOString().split('T')[0],
      end_date: null
    }

    const formData = ref({ ...defaultFormData })

    watch(() => props.test, (newTest) => {
      if (newTest) {
        formData.value = { ...newTest }
      } else {
        formData.value = { ...defaultFormData }
      }
    }, { immediate: true })

    const addVariant = () => {
      const variantLetter = String.fromCharCode(65 + formData.value.variants.length - 1)
      formData.value.variants.push({
        name: `Variant ${variantLetter}`,
        traffic_allocation: 0,
        destination_url: '',
        is_control: false
      })
      redistributeTraffic()
    }

    const removeVariant = (index) => {
      if (formData.value.variants.length > 2) {
        formData.value.variants.splice(index, 1)
        redistributeTraffic()
      }
    }

    const redistributeTraffic = () => {
      const equalShare = Math.floor(100 / formData.value.variants.length)
      const remainder = 100 % formData.value.variants.length
      
      formData.value.variants.forEach((variant, index) => {
        variant.traffic_allocation = equalShare + (index < remainder ? 1 : 0)
      })
    }

    const validateTrafficAllocation = () => {
      const total = formData.value.variants.reduce((sum, v) => sum + v.traffic_allocation, 0)
      return total === 100
    }

    const save = async () => {
      if (!validateTrafficAllocation()) {
        alert('Traffic allocation must total 100%')
        return
      }

      saving.value = true
      try {
        if (editingTest.value) {
          await advancedAnalyticsAPI.updateABTest(props.test.id, formData.value)
        } else {
          await advancedAnalyticsAPI.createABTest(formData.value)
        }
        emit('saved')
        close()
      } catch (error) {
        console.error('Error saving A/B test:', error)
        alert('Failed to save A/B test')
      } finally {
        saving.value = false
      }
    }

    const close = () => {
      dialog.value = false
      formData.value = { ...defaultFormData }
    }

    return {
      dialog,
      saving,
      startDateMenu,
      endDateMenu,
      editingTest,
      testTypes,
      formData,
      addVariant,
      removeVariant,
      save,
      close
    }
  }
}
</script>

<style scoped>
.v-divider {
  margin: 16px 0;
}
</style>