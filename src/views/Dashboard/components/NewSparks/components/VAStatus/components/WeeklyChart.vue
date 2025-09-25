<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-icon class="mr-2">mdi-chart-line</v-icon>
      Weekly Productivity Trends
      <v-spacer />
      <v-btn-toggle
        v-model="chartView"
        density="compact"
        size="small"
      >
        <v-btn value="daily" size="small">Daily</v-btn>
        <v-btn value="comparison" size="small">Comparison</v-btn>
      </v-btn-toggle>
    </v-card-title>

    <v-card-text>
      <!-- Daily View -->
      <div v-if="chartView === 'daily'" class="daily-chart">
        <div class="chart-header mb-4">
          <div class="text-subtitle-1 font-weight-medium">Daily Spark Creation - Current Week</div>
          <div class="text-caption text-grey">Monday through Sunday breakdown</div>
        </div>

        <!-- Daily Bars -->
        <div class="daily-bars">
          <div
            v-for="day in dailyData"
            :key="day.name"
            class="daily-bar-container"
          >
            <div class="daily-bar-wrapper">
              <div
                class="daily-bar"
                :style="{
                  height: `${getBarHeight(day.current)}px`,
                  backgroundColor: day.current > 0 ? '#2196F3' : '#E0E0E0'
                }"
              ></div>
              <div class="bar-value">{{ day.current }}</div>
            </div>
            <div class="day-label">{{ day.name }}</div>
          </div>
        </div>

        <!-- Legend -->
        <div class="chart-legend mt-4">
          <div class="d-flex align-center">
            <div class="legend-color" style="background-color: #2196F3;"></div>
            <span class="text-caption ml-2">Current Week Total: {{ currentWeekTotal }}</span>
          </div>
        </div>
      </div>

      <!-- Comparison View -->
      <div v-else class="comparison-chart">
        <div class="chart-header mb-4">
          <div class="text-subtitle-1 font-weight-medium">Week-over-Week Comparison</div>
          <div class="text-caption text-grey">Current week vs previous week</div>
        </div>

        <!-- Comparison Bars -->
        <div class="comparison-bars">
          <div
            v-for="day in dailyData"
            :key="day.name"
            class="comparison-bar-container"
          >
            <div class="comparison-bar-wrapper">
              <!-- Previous Week Bar -->
              <div
                class="comparison-bar previous"
                :style="{
                  height: `${getBarHeight(day.previous)}px`
                }"
              ></div>
              <!-- Current Week Bar -->
              <div
                class="comparison-bar current"
                :style="{
                  height: `${getBarHeight(day.current)}px`
                }"
              ></div>
            </div>
            <div class="comparison-values">
              <div class="text-caption">{{ day.current }} | {{ day.previous }}</div>
            </div>
            <div class="day-label">{{ day.name }}</div>
          </div>
        </div>

        <!-- Legend -->
        <div class="chart-legend mt-4">
          <div class="d-flex gap-4">
            <div class="d-flex align-center">
              <div class="legend-color" style="background-color: #2196F3;"></div>
              <span class="text-caption ml-2">Current Week ({{ currentWeekTotal }})</span>
            </div>
            <div class="d-flex align-center">
              <div class="legend-color" style="background-color: #9E9E9E;"></div>
              <span class="text-caption ml-2">Previous Week ({{ previousWeekTotal }})</span>
            </div>
          </div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  currentWeekData: {
    type: Array,
    default: () => []
  },
  previousWeekData: {
    type: Array,
    default: () => []
  }
});

// Component state
const chartView = ref('daily');

// Days of the week
const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Computed properties
const dailyData = computed(() => {
  return daysOfWeek.map((day, index) => {
    // Sum sparks for each day across all VAs
    const currentDayTotal = props.currentWeekData.reduce((sum, va) => {
      return sum + (va.daily_breakdown?.[day] || 0);
    }, 0);

    const previousDayTotal = props.previousWeekData.reduce((sum, va) => {
      return sum + (va.daily_breakdown?.[day] || 0);
    }, 0);

    return {
      name: dayLabels[index],
      current: currentDayTotal,
      previous: previousDayTotal
    };
  });
});

const currentWeekTotal = computed(() => {
  return dailyData.value.reduce((sum, day) => sum + day.current, 0);
});

const previousWeekTotal = computed(() => {
  return dailyData.value.reduce((sum, day) => sum + day.previous, 0);
});

const maxValue = computed(() => {
  const allValues = dailyData.value.flatMap(day => [day.current, day.previous]);
  return Math.max(...allValues, 1); // Minimum 1 to avoid division by zero
});

// Methods
const getBarHeight = (value) => {
  const maxHeight = 100; // Maximum bar height in pixels
  const minHeight = 3;   // Minimum bar height for visibility

  if (value === 0) return minHeight;

  const height = (value / maxValue.value) * maxHeight;
  return Math.max(height, minHeight);
};
</script>

<style scoped>
.daily-chart,
.comparison-chart {
  min-height: 200px;
}

.chart-header {
  text-align: center;
}

.daily-bars,
.comparison-bars {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 120px;
  padding: 0 20px;
  margin: 20px 0;
}

.daily-bar-container,
.comparison-bar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.daily-bar-wrapper {
  position: relative;
  display: flex;
  align-items: flex-end;
  height: 100px;
  margin-bottom: 8px;
}

.comparison-bar-wrapper {
  position: relative;
  display: flex;
  align-items: flex-end;
  height: 100px;
  margin-bottom: 8px;
  gap: 2px;
}

.daily-bar {
  width: 30px;
  min-height: 3px;
  border-radius: 3px 3px 0 0;
  transition: all 0.3s ease;
}

.comparison-bar {
  width: 15px;
  min-height: 3px;
  border-radius: 3px 3px 0 0;
  transition: all 0.3s ease;
}

.comparison-bar.current {
  background-color: #2196F3;
}

.comparison-bar.previous {
  background-color: #9E9E9E;
}

.bar-value {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.75rem;
  font-weight: 500;
  color: #666;
}

.comparison-values {
  font-size: 0.65rem;
  color: #666;
  margin-bottom: 4px;
}

.day-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #888;
  text-align: center;
}

.chart-legend {
  display: flex;
  justify-content: center;
  padding: 12px;
  border-top: 1px solid #E0E0E0;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

/* Hover effects */
.daily-bar:hover,
.comparison-bar:hover {
  opacity: 0.8;
  transform: translateY(-2px);
}

/* Dark theme support */
.v-theme--dark .chart-legend {
  border-top-color: #424242;
}

.v-theme--dark .day-label,
.v-theme--dark .bar-value,
.v-theme--dark .comparison-values {
  color: #BBB;
}
</style>