<template>
  <div>
    <div class="d-flex justify-space-between align-center mb-4">
      <h3>Targeting Rules</h3>
      <v-btn
        color="primary"
        size="small"
        prepend-icon="mdi-plus"
        @click="addRule"
      >
        Add Rule
      </v-btn>
    </div>
    
    <v-alert
      v-if="rules.length === 0"
      type="info"
      variant="tonal"
      class="mb-4"
    >
      No targeting rules configured. Traffic will be split based on weights only.
    </v-alert>
    
    <v-card
      v-for="(rule, index) in rules"
      :key="index"
      class="mb-3"
      variant="outlined"
    >
      <v-card-text>
        <v-row align="center">
          <v-col cols="12" md="2">
            <v-select
              v-model="rule.type"
              :items="ruleTypes"
              label="Type"
              variant="outlined"
              density="compact"
              @update:model-value="updateRuleField(rule)"
            ></v-select>
          </v-col>
          
          <v-col cols="12" md="3">
            <v-select
              v-model="rule.field"
              :items="getFieldsForType(rule.type)"
              label="Field"
              variant="outlined"
              density="compact"
            ></v-select>
          </v-col>
          
          <v-col cols="12" md="2">
            <v-select
              v-model="rule.operator"
              :items="operators"
              label="Operator"
              variant="outlined"
              density="compact"
            ></v-select>
          </v-col>
          
          <v-col cols="12" md="3">
            <v-text-field
              v-if="!isSelectField(rule)"
              v-model="rule.value"
              label="Value"
              variant="outlined"
              density="compact"
              :hint="getHintForRule(rule)"
            ></v-text-field>
            <v-select
              v-else
              v-model="rule.value"
              :items="getSelectValues(rule)"
              label="Value"
              variant="outlined"
              density="compact"
            ></v-select>
          </v-col>
          
          <v-col cols="12" md="1">
            <v-switch
              v-model="rule.enabled"
              color="primary"
              hide-details
            ></v-switch>
          </v-col>
          
          <v-col cols="12" md="1">
            <v-btn
              icon="mdi-delete"
              variant="text"
              color="error"
              size="small"
              @click="removeRule(index)"
            ></v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </div>
</template>

<script>
import { ref, watch } from 'vue'

export default {
  name: 'TargetingRules',
  props: {
    modelValue: {
      type: Array,
      default: () => []
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const rules = ref([])
    
    // Rule configuration
    const ruleTypes = [
      { title: 'Geographic', value: 'geo' },
      { title: 'Device', value: 'device' },
      { title: 'Time', value: 'time' },
      { title: 'Referrer', value: 'referrer' },
      { title: 'UTM Parameter', value: 'utm' }
    ]
    
    const operators = [
      { title: 'Equals', value: 'equals' },
      { title: 'Contains', value: 'contains' },
      { title: 'Starts With', value: 'starts_with' },
      { title: 'Ends With', value: 'ends_with' },
      { title: 'Regex', value: 'regex' }
    ]
    
    const fieldsByType = {
      geo: [
        { title: 'Country', value: 'country' },
        { title: 'City', value: 'city' },
        { title: 'Region', value: 'region' }
      ],
      device: [
        { title: 'Device Type', value: 'type' },
        { title: 'Browser', value: 'browser' },
        { title: 'OS', value: 'os' }
      ],
      time: [
        { title: 'Hour of Day', value: 'hour' },
        { title: 'Day of Week', value: 'day' },
        { title: 'Date', value: 'date' }
      ],
      referrer: [
        { title: 'Full URL', value: 'url' },
        { title: 'Domain', value: 'domain' }
      ],
      utm: [
        { title: 'Source', value: 'utm_source' },
        { title: 'Medium', value: 'utm_medium' },
        { title: 'Campaign', value: 'utm_campaign' },
        { title: 'Term', value: 'utm_term' },
        { title: 'Content', value: 'utm_content' }
      ]
    }
    
    const deviceTypes = [
      { title: 'Mobile', value: 'mobile' },
      { title: 'Desktop', value: 'desktop' },
      { title: 'Tablet', value: 'tablet' }
    ]
    
    const daysOfWeek = [
      { title: 'Sunday', value: '0' },
      { title: 'Monday', value: '1' },
      { title: 'Tuesday', value: '2' },
      { title: 'Wednesday', value: '3' },
      { title: 'Thursday', value: '4' },
      { title: 'Friday', value: '5' },
      { title: 'Saturday', value: '6' }
    ]
    
    // Watch for external changes
    watch(() => props.modelValue, (newValue) => {
      rules.value = newValue || []
    }, { immediate: true, deep: true })
    
    // Watch for internal changes
    watch(rules, (newValue) => {
      emit('update:modelValue', newValue)
    }, { deep: true })
    
    // Methods
    const addRule = () => {
      rules.value.push({
        type: 'geo',
        field: 'country',
        operator: 'equals',
        value: '',
        enabled: true
      })
    }
    
    const removeRule = (index) => {
      rules.value.splice(index, 1)
    }
    
    const getFieldsForType = (type) => {
      return fieldsByType[type] || []
    }
    
    const updateRuleField = (rule) => {
      const fields = getFieldsForType(rule.type)
      if (fields.length > 0) {
        rule.field = fields[0].value
      }
    }
    
    const isSelectField = (rule) => {
      return (rule.type === 'device' && rule.field === 'type') ||
             (rule.type === 'time' && rule.field === 'day')
    }
    
    const getSelectValues = (rule) => {
      if (rule.type === 'device' && rule.field === 'type') {
        return deviceTypes
      }
      if (rule.type === 'time' && rule.field === 'day') {
        return daysOfWeek
      }
      return []
    }
    
    const getHintForRule = (rule) => {
      if (rule.type === 'geo' && rule.field === 'country') {
        return 'Use 2-letter country code (e.g., US, GB)'
      }
      if (rule.type === 'time' && rule.field === 'hour') {
        return 'Use 24-hour format (0-23)'
      }
      if (rule.type === 'time' && rule.field === 'date') {
        return 'Use YYYY-MM-DD format'
      }
      if (rule.operator === 'regex') {
        return 'Enter a valid regular expression'
      }
      return ''
    }
    
    return {
      rules,
      ruleTypes,
      operators,
      addRule,
      removeRule,
      getFieldsForType,
      updateRuleField,
      isSelectField,
      getSelectValues,
      getHintForRule
    }
  }
}
</script>