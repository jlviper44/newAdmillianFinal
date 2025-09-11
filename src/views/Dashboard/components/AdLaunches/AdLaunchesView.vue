<template>
  <v-container fluid class="launches-container pa-0">
    <!-- Tabs for switching between views -->
    <v-tabs v-model="activeTab" class="mb-4" color="purple">
      <v-tab value="tracker">Ad Launches</v-tab>
      <v-tab value="timeclock">Time Clock</v-tab>
      <v-tab v-if="!isVirtualAssistant" value="payroll">Payroll Calculator</v-tab>
      <v-tab v-if="!isVirtualAssistant" value="history">Payroll History</v-tab>
    </v-tabs>

    <!-- Window for tab content -->
    <v-window v-model="activeTab">
      <!-- Ad Launches Tab -->
      <v-window-item value="tracker">
        <!-- Week Selector and Summary Cards -->
        <v-card class="mb-4">
          <v-card-text>
            <v-row align="center">
              <v-col cols="12" md="4">
                <v-select
                  v-model="selectedTrackerWeek"
                  label="Select Week"
                  :items="availableWeeks"
                  item-title="display"
                  item-value="key"
                  @update:model-value="loadTrackerData"
                  density="comfortable"
                  prepend-inner-icon="mdi-calendar"
                />
              </v-col>
              <v-col cols="12" md="8">
                <div class="d-flex justify-end gap-2">
                  <v-btn
                    color="purple"
                    variant="tonal"
                    @click="exportTrackerData"
                    prepend-icon="mdi-download"
                  >
                    Export CSV
                  </v-btn>
                  <v-btn
                    color="green"
                    variant="flat"
                    @click="openAddEntryDialog"
                    prepend-icon="mdi-plus"
                  >
                    Add Entry
                  </v-btn>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Summary Cards -->
        <v-row class="mb-4">
          <v-col cols="12" sm="6" md="3">
            <v-card>
              <v-card-text class="text-center">
                <div class="text-caption text-grey">Total Entries</div>
                <div class="text-h4 font-weight-bold mt-2">{{ trackerTotals.entries }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card>
              <v-card-text class="text-center">
                <div class="text-caption text-grey">Total Ad Spend</div>
                <div class="text-h4 font-weight-bold mt-2 text-blue">{{ formatCurrency(trackerTotals.adSpend) }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card>
              <v-card-text class="text-center">
                <div class="text-caption text-grey">Amount Lost</div>
                <div class="text-h4 font-weight-bold mt-2 text-red">{{ formatCurrency(trackerTotals.amountLost) }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card>
              <v-card-text class="text-center">
                <div class="text-caption text-grey">Real Spend</div>
                <div class="text-h4 font-weight-bold mt-2 text-green">{{ formatCurrency(trackerTotals.realSpend) }}</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Filters -->
        <v-card class="mb-4">
          <v-card-text>
            <v-row>
              <v-col cols="12" md="3">
                <v-text-field
                  v-model="trackerFilters.va"
                  label="Filter by VA"
                  clearable
                  density="compact"
                  prepend-inner-icon="mdi-account"
                  @update:model-value="filterTrackerData"
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-select
                  v-model="trackerFilters.status"
                  label="Status"
                  :items="statusOptions"
                  clearable
                  density="compact"
                  prepend-inner-icon="mdi-circle"
                  @update:model-value="filterTrackerData"
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-select
                  v-model="trackerFilters.offer"
                  label="Offer"
                  :items="offerOptions"
                  clearable
                  density="compact"
                  prepend-inner-icon="mdi-tag"
                  @update:model-value="filterTrackerData"
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-select
                  v-model="trackerFilters.launchTarget"
                  label="Target"
                  :items="targetOptions"
                  clearable
                  density="compact"
                  prepend-inner-icon="mdi-target"
                  @update:model-value="filterTrackerData"
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Tracker Entries Table -->
        <v-card>
          <v-card-text class="pa-2">
            <v-alert
              type="info"
              variant="tonal"
              density="compact"
              class="mb-2"
            >
              Double-click any cell to edit inline. Dropdowns available for Campaign, BC Type, WH Obj, Target, Status, Ban, and Offer fields. Press Enter to save or Esc to cancel.
            </v-alert>
          </v-card-text>
          <v-data-table
            :headers="trackerHeaders"
            :items="filteredTrackerEntries"
            :loading="trackerLoading"
            density="compact"
            :items-per-page="20"
            class="tracker-table"
          >
            <!-- VA (editable) -->
            <template v-slot:item.va="{ item }">
              <div 
                @dblclick="startInlineEdit(item, 'va')"
                class="editable-cell"
                :title="'Double-click to edit'"
              >
                <v-text-field
                  v-if="isEditing(item.id, 'va')"
                  v-model="editingValues[`${item.id}-va`]"
                  density="compact"
                  variant="outlined"
                  hide-details
                  single-line
                  autofocus
                  @blur="saveInlineEdit(item, 'va')"
                  @keyup.enter="saveInlineEdit(item, 'va')"
                  @keyup.esc="cancelInlineEdit(item.id, 'va')"
                />
                <span v-else>{{ item.va }}</span>
              </div>
            </template>
            
            <!-- Campaign ID (editable with autocomplete) -->
            <template v-slot:item.campaignId="{ item }">
              <div 
                @dblclick="startInlineEdit(item, 'campaignId')"
                class="editable-cell font-weight-medium"
                :title="'Double-click to edit'"
              >
                <v-autocomplete
                  v-if="isEditing(item.id, 'campaignId')"
                  v-model="editingValues[`${item.id}-campaignId`]"
                  :items="campaignOptions"
                  item-value="id"
                  item-title="displayName"
                  :menu="menuStates[`${item.id}-campaignId`]"
                  @update:menu="val => menuStates[`${item.id}-campaignId`] = val"
                  density="compact"
                  variant="outlined"
                  hide-details
                  clearable
                  @update:model-value="val => { editingValues[`${item.id}-campaignId`] = val; saveInlineEdit(item, 'campaignId'); }"
                  @click:clear="() => { editingValues[`${item.id}-campaignId`] = ''; saveInlineEdit(item, 'campaignId'); }"
                />
                <span v-else>{{ item.campaignId }}</span>
              </div>
            </template>
            
            <!-- Campaign Name (read-only) -->
            <template v-slot:item.campaignName="{ item }">
              <span class="text-caption">{{ item.campaignName || '-' }}</span>
            </template>
            
            <!-- BC GEO (editable) -->
            <template v-slot:item.bcGeo="{ item }">
              <div 
                @dblclick="startInlineEdit(item, 'bcGeo')"
                class="editable-cell"
                :title="'Double-click to edit'"
              >
                <v-text-field
                  v-if="isEditing(item.id, 'bcGeo')"
                  v-model="editingValues[`${item.id}-bcGeo`]"
                  density="compact"
                  variant="outlined"
                  hide-details
                  single-line
                  autofocus
                  @blur="saveInlineEdit(item, 'bcGeo')"
                  @keyup.enter="saveInlineEdit(item, 'bcGeo')"
                  @keyup.esc="cancelInlineEdit(item.id, 'bcGeo')"
                />
                <span v-else>{{ item.bcGeo || '-' }}</span>
              </div>
            </template>
            
            <!-- BC Type (editable with dropdown) -->
            <template v-slot:item.bcType="{ item }">
              <div 
                @dblclick="startInlineEdit(item, 'bcType')"
                class="editable-cell"
                :title="'Double-click to edit'"
              >
                <v-select
                  v-if="isEditing(item.id, 'bcType')"
                  v-model="editingValues[`${item.id}-bcType`]"
                  :items="bcTypeOptions"
                  :menu="menuStates[`${item.id}-bcType`]"
                  @update:menu="val => menuStates[`${item.id}-bcType`] = val"
                  density="compact"
                  variant="outlined"
                  hide-details
                  clearable
                  @update:model-value="val => { editingValues[`${item.id}-bcType`] = val; saveInlineEdit(item, 'bcType'); }"
                />
                <span v-else>{{ item.bcType || '-' }}</span>
              </div>
            </template>
            
            <!-- WH Obj (editable with dropdown) -->
            <template v-slot:item.whObj="{ item }">
              <div 
                @dblclick="startInlineEdit(item, 'whObj')"
                class="editable-cell"
                :title="'Double-click to edit'"
              >
                <v-select
                  v-if="isEditing(item.id, 'whObj')"
                  v-model="editingValues[`${item.id}-whObj`]"
                  :items="whObjOptions"
                  :menu="menuStates[`${item.id}-whObj`]"
                  @update:menu="val => menuStates[`${item.id}-whObj`] = val"
                  density="compact"
                  variant="outlined"
                  hide-details
                  @update:model-value="val => { editingValues[`${item.id}-whObj`] = val; saveInlineEdit(item, 'whObj'); }"
                />
                <span v-else>{{ item.whObj || '-' }}</span>
              </div>
            </template>
            
            <!-- Target (editable with dropdown) -->
            <template v-slot:item.launchTarget="{ item }">
              <div 
                @dblclick="startInlineEdit(item, 'launchTarget')"
                class="editable-cell"
                :title="'Double-click to edit'"
              >
                <v-select
                  v-if="isEditing(item.id, 'launchTarget')"
                  v-model="editingValues[`${item.id}-launchTarget`]"
                  :items="targetOptions"
                  :menu="menuStates[`${item.id}-launchTarget`]"
                  @update:menu="val => menuStates[`${item.id}-launchTarget`] = val"
                  density="compact"
                  variant="outlined"
                  hide-details
                  @update:model-value="val => { editingValues[`${item.id}-launchTarget`] = val; saveInlineEdit(item, 'launchTarget'); }"
                />
                <span v-else>{{ item.launchTarget || '-' }}</span>
              </div>
            </template>
            
            <!-- Status (editable with dropdown) -->
            <template v-slot:item.status="{ item }">
              <div 
                @dblclick="startInlineEdit(item, 'status')"
                class="editable-cell"
                :title="'Double-click to edit'"
              >
                <v-select
                  v-if="isEditing(item.id, 'status')"
                  v-model="editingValues[`${item.id}-status`]"
                  :items="statusOptions"
                  :menu="menuStates[`${item.id}-status`]"
                  @update:menu="val => menuStates[`${item.id}-status`] = val"
                  density="compact"
                  variant="outlined"
                  hide-details
                  @update:model-value="val => { editingValues[`${item.id}-status`] = val; saveInlineEdit(item, 'status'); }"
                />
                <v-chip
                  v-else
                  :color="getStatusColor(item.status)"
                  size="small"
                  label
                >
                  {{ item.status }}
                </v-chip>
              </div>
            </template>
            
            <!-- Ban (editable with dropdown) -->
            <template v-slot:item.ban="{ item }">
              <div 
                @dblclick="startInlineEdit(item, 'ban')"
                class="editable-cell"
                :title="'Double-click to edit'"
              >
                <v-select
                  v-if="isEditing(item.id, 'ban')"
                  v-model="editingValues[`${item.id}-ban`]"
                  :items="banOptions"
                  :menu="menuStates[`${item.id}-ban`]"
                  @update:menu="val => menuStates[`${item.id}-ban`] = val"
                  density="compact"
                  variant="outlined"
                  hide-details
                  clearable
                  @update:model-value="val => { editingValues[`${item.id}-ban`] = val; saveInlineEdit(item, 'ban'); }"
                  @click:clear="() => { editingValues[`${item.id}-ban`] = ''; saveInlineEdit(item, 'ban'); }"
                />
                <span v-else>{{ item.ban || '-' }}</span>
              </div>
            </template>
            
            <!-- Ad Spend (editable) -->
            <template v-slot:item.adSpend="{ item }">
              <div 
                @dblclick="startInlineEdit(item, 'adSpend')"
                class="editable-cell"
                :title="'Double-click to edit'"
              >
                <v-text-field
                  v-if="isEditing(item.id, 'adSpend')"
                  v-model.number="editingValues[`${item.id}-adSpend`]"
                  type="number"
                  prefix="$"
                  density="compact"
                  variant="outlined"
                  hide-details
                  single-line
                  autofocus
                  @blur="saveInlineEdit(item, 'adSpend')"
                  @keyup.enter="saveInlineEdit(item, 'adSpend')"
                  @keyup.esc="cancelInlineEdit(item.id, 'adSpend')"
                />
                <span v-else>{{ formatCurrency(item.adSpend) }}</span>
              </div>
            </template>
            
            <!-- BC Spend (editable) -->
            <template v-slot:item.bcSpend="{ item }">
              <div 
                @dblclick="startInlineEdit(item, 'bcSpend')"
                class="editable-cell"
                :title="'Double-click to edit'"
              >
                <v-text-field
                  v-if="isEditing(item.id, 'bcSpend')"
                  v-model.number="editingValues[`${item.id}-bcSpend`]"
                  type="number"
                  prefix="$"
                  density="compact"
                  variant="outlined"
                  hide-details
                  single-line
                  autofocus
                  @blur="saveInlineEdit(item, 'bcSpend')"
                  @keyup.enter="saveInlineEdit(item, 'bcSpend')"
                  @keyup.esc="cancelInlineEdit(item.id, 'bcSpend')"
                />
                <span v-else>{{ formatCurrency(item.bcSpend) }}</span>
              </div>
            </template>
            
            <!-- Amount Lost (computed, read-only) -->
            <template v-slot:item.amountLost="{ item }">
              <span class="text-red">{{ formatCurrency(item.amountLost) }}</span>
            </template>
            
            <!-- Real Spend (computed, read-only) -->
            <template v-slot:item.realSpend="{ item }">
              <span class="text-green">{{ formatCurrency(item.realSpend) }}</span>
            </template>
            
            <!-- Offer (editable with dropdown) -->
            <template v-slot:item.offer="{ item }">
              <div 
                @dblclick="startInlineEdit(item, 'offer')"
                class="editable-cell"
                :title="'Double-click to edit'"
              >
                <v-select
                  v-if="isEditing(item.id, 'offer')"
                  v-model="editingValues[`${item.id}-offer`]"
                  :items="offerOptions"
                  :menu="menuStates[`${item.id}-offer`]"
                  @update:menu="val => menuStates[`${item.id}-offer`] = val"
                  density="compact"
                  variant="outlined"
                  hide-details
                  clearable
                  @update:model-value="val => { editingValues[`${item.id}-offer`] = val; saveInlineEdit(item, 'offer'); }"
                  @click:clear="() => { editingValues[`${item.id}-offer`] = ''; saveInlineEdit(item, 'offer'); }"
                />
                <span v-else>{{ item.offer || '-' }}</span>
              </div>
            </template>
            
            <!-- Notes (editable) -->
            <template v-slot:item.notes="{ item }">
              <div 
                @dblclick="startInlineEdit(item, 'notes')"
                class="editable-cell"
                :title="'Double-click to edit'"
              >
                <v-text-field
                  v-if="isEditing(item.id, 'notes')"
                  v-model="editingValues[`${item.id}-notes`]"
                  density="compact"
                  variant="outlined"
                  hide-details
                  single-line
                  autofocus
                  @blur="saveInlineEdit(item, 'notes')"
                  @keyup.enter="saveInlineEdit(item, 'notes')"
                  @keyup.esc="cancelInlineEdit(item.id, 'notes')"
                />
                <span v-else class="text-caption">{{ item.notes || '-' }}</span>
              </div>
            </template>
            
            <!-- Timestamp (read-only) -->
            <template v-slot:item.timestamp="{ item }">
              {{ formatDateTime(item.timestamp) }}
            </template>
            
            <!-- Actions -->
            <template v-slot:item.actions="{ item }">
              <v-btn
                icon="mdi-pencil"
                size="x-small"
                variant="text"
                @click="editTrackerEntry(item)"
              />
              <v-btn
                icon="mdi-delete"
                size="x-small"
                variant="text"
                color="red"
                @click="deleteTrackerEntry(item)"
              />
            </template>
          </v-data-table>
        </v-card>

        <!-- Add/Edit Entry Dialog -->
        <v-dialog v-model="showAddEntryDialog" max-width="800">
          <v-card>
            <v-card-title>
              {{ editingEntry ? 'Edit Entry' : 'Add New Entry' }}
            </v-card-title>
            <v-card-text>
              <v-form ref="entryFormRef">
                <v-row>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="entryForm.va"
                      label="VA Name (Email)"
                      required
                      :rules="[v => !!v || 'VA name is required']"
                      :readonly="!isUserAdmin"
                      :hint="!isUserAdmin ? 'Auto-populated with your email' : 'Enter VA email'"
                      persistent-hint
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-autocomplete
                      v-model="entryForm.campaignId"
                      label="Campaign"
                      :items="campaignOptions"
                      item-value="id"
                      item-title="displayName"
                      required
                      :rules="[v => !!v || 'Campaign is required']"
                      clearable
                      hint="Select or type to search"
                      persistent-hint
                    />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-text-field
                      v-model="entryForm.bcGeo"
                      label="BC GEO"
                    />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-select
                      v-model="entryForm.bcType"
                      label="BC Type"
                      :items="bcTypeOptions"
                    />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-select
                      v-model="entryForm.whObj"
                      label="WH Objective"
                      :items="whObjOptions"
                    />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-select
                      v-model="entryForm.launchTarget"
                      label="Launch Target"
                      :items="targetOptions"
                    />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-select
                      v-model="entryForm.status"
                      label="Status"
                      :items="statusOptions"
                      required
                      :rules="[v => !!v || 'Status is required']"
                    />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-select
                      v-model="entryForm.ban"
                      label="Ban Type"
                      :items="banOptions"
                      clearable
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model.number="entryForm.adSpend"
                      label="Ad Spend"
                      type="number"
                      prefix="$"
                      :rules="[v => v >= 0 || 'Must be positive']"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model.number="entryForm.bcSpend"
                      label="BC Spend"
                      type="number"
                      prefix="$"
                      :rules="[v => v >= 0 || 'Must be positive']"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="entryForm.offer"
                      label="Offer"
                      :items="offerOptions"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="entryForm.notes"
                      label="Notes"
                    />
                  </v-col>
                </v-row>
                
                <!-- Calculated Fields Display -->
                <v-alert type="info" variant="tonal" class="mt-4">
                  <div class="d-flex justify-space-around">
                    <div>
                      <div class="text-caption">Amount Lost</div>
                      <div class="text-h6 text-red">{{ formatCurrency(calculatedAmountLost) }}</div>
                    </div>
                    <div>
                      <div class="text-caption">Real Spend</div>
                      <div class="text-h6 text-green">{{ formatCurrency(calculatedRealSpend) }}</div>
                    </div>
                  </div>
                </v-alert>
              </v-form>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn
                variant="text"
                @click="closeEntryDialog"
              >
                Cancel
              </v-btn>
              <v-btn
                color="purple"
                variant="flat"
                @click="saveTrackerEntry"
                :loading="savingEntry"
              >
                {{ editingEntry ? 'Update' : 'Add' }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </v-window-item>

      <!-- Time Clock Tab -->
      <v-window-item value="timeclock">
        <v-card>
          <v-card-title>Daily Time Entry</v-card-title>
          <v-card-text>
            <v-form ref="timeClockFormRef">
              <v-row>
                <v-col cols="12" md="3">
                  <v-text-field
                    v-model="timeClockForm.va"
                    label="VA Name"
                    :readonly="!isUserAdmin"
                    :hint="!isUserAdmin ? 'Auto-filled with your email' : ''"
                    persistent-hint
                  />
                </v-col>
                <v-col cols="12" md="3">
                  <v-text-field
                    v-model="timeClockForm.date"
                    label="Date"
                    type="date"
                    :max="todayDate"
                  />
                </v-col>
                <v-col cols="12" md="3">
                  <v-select
                    v-model="timeClockForm.hoursWorked"
                    label="Hours Worked"
                    :items="hoursOptions"
                    hint="Select hours in 0.5 increments"
                    persistent-hint
                  />
                </v-col>
                <v-col cols="12" md="3">
                  <v-text-field
                    v-model.number="timeClockForm.bcsLaunched"
                    label="BCs Launched"
                    type="number"
                    min="0"
                    hint="For verification"
                    persistent-hint
                  />
                </v-col>
              </v-row>
              
              <v-alert
                v-if="timeClockVerification.show"
                :type="timeClockVerification.type"
                class="mt-4"
                dismissible
              >
                {{ timeClockVerification.message }}
              </v-alert>
              
              <v-row class="mt-4">
                <v-col>
                  <v-btn
                    color="primary"
                    @click="submitTimeEntry"
                    :loading="timeClockLoading"
                  >
                    Submit Time Entry
                  </v-btn>
                  <v-btn
                    variant="outlined"
                    class="ml-2"
                    @click="checkTimeEntry"
                  >
                    Check Entry
                  </v-btn>
                </v-col>
              </v-row>
            </v-form>
          </v-card-text>
        </v-card>
      </v-window-item>

      <!-- Payroll Calculator Tab -->
      <v-window-item value="payroll">
        <v-card>
          <v-card-title>Calculate Payroll</v-card-title>
          <v-card-text>
            <v-form ref="payrollFormRef">
              <v-row>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="payrollForm.va"
                    label="VA Name"
                    :readonly="!isUserAdmin"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="payrollForm.startDate"
                    label="Start Date"
                    type="date"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="payrollForm.endDate"
                    label="End Date"
                    type="date"
                  />
                </v-col>
              </v-row>
              
              <v-row>
                <v-col cols="12" md="3">
                  <v-text-field
                    v-model.number="payrollForm.hourlyRate"
                    label="Hourly Rate"
                    type="number"
                    prefix="$"
                    step="0.5"
                  />
                </v-col>
                <v-col cols="12" md="3">
                  <v-text-field
                    v-model.number="payrollForm.commissionRate"
                    label="Commission %"
                    type="number"
                    suffix="%"
                    step="0.1"
                  />
                </v-col>
                <v-col cols="12" md="3">
                  <v-text-field
                    v-model.number="payrollForm.bonusAmount"
                    label="Bonus"
                    type="number"
                    prefix="$"
                  />
                </v-col>
                <v-col cols="12" md="3">
                  <v-text-field
                    v-model="payrollForm.bonusReason"
                    label="Bonus Reason"
                  />
                </v-col>
              </v-row>
              
              <v-row>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="payrollForm.paymentMethod"
                    label="Payment Method"
                    :items="['PayPal', 'Wise', 'Bank Transfer', 'Crypto', 'Other']"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-textarea
                    v-model="payrollForm.notes"
                    label="Notes"
                    rows="2"
                  />
                </v-col>
              </v-row>
              
              <v-divider class="my-4" />
              
              <!-- Payroll Calculation Results -->
              <v-row v-if="payrollCalculation">
                <v-col cols="12">
                  <v-alert type="info" variant="tonal">
                    <div class="d-flex justify-space-between align-center mb-2">
                      <span>Total Hours:</span>
                      <strong>{{ payrollCalculation.totalHours }} hrs</strong>
                    </div>
                    <div class="d-flex justify-space-between align-center mb-2">
                      <span>Total Real Spend:</span>
                      <strong>{{ formatCurrency(payrollCalculation.totalRealSpend) }}</strong>
                    </div>
                    <v-divider class="my-2" />
                    <div class="d-flex justify-space-between align-center mb-2">
                      <span>Hourly Pay ({{ payrollForm.hourlyRate }}/hr):</span>
                      <strong>{{ formatCurrency(payrollCalculation.hourlyPay) }}</strong>
                    </div>
                    <div class="d-flex justify-space-between align-center mb-2">
                      <span>Commission ({{ payrollForm.commissionRate }}%):</span>
                      <strong>{{ formatCurrency(payrollCalculation.commissionPay) }}</strong>
                    </div>
                    <div v-if="payrollForm.bonusAmount" class="d-flex justify-space-between align-center mb-2">
                      <span>Bonus:</span>
                      <strong>{{ formatCurrency(payrollForm.bonusAmount) }}</strong>
                    </div>
                    <v-divider class="my-2" />
                    <div class="d-flex justify-space-between align-center">
                      <span class="text-h6">Total Pay:</span>
                      <strong class="text-h5 text-green">{{ formatCurrency(payrollCalculation.totalPay) }}</strong>
                    </div>
                  </v-alert>
                </v-col>
              </v-row>
              
              <v-row class="mt-4">
                <v-col>
                  <v-btn
                    color="primary"
                    @click="calculatePayroll"
                    :loading="payrollLoading"
                  >
                    Calculate
                  </v-btn>
                  <v-btn
                    v-if="payrollCalculation"
                    color="green"
                    variant="flat"
                    class="ml-2"
                    @click="createPayrollReport"
                  >
                    Create Report
                  </v-btn>
                </v-col>
              </v-row>
            </v-form>
          </v-card-text>
        </v-card>
      </v-window-item>

      <!-- Payroll History Tab -->
      <v-window-item value="history">
        <v-card>
          <v-card-text>
            <v-row align="center" class="mb-4">
              <v-col cols="12" md="3">
                <v-text-field
                  v-model="historyFilters.va"
                  label="Filter by VA"
                  clearable
                  density="compact"
                  @update:model-value="loadPayrollHistory"
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-select
                  v-model="historyFilters.status"
                  label="Payment Status"
                  :items="['all', 'paid', 'unpaid']"
                  density="compact"
                  @update:model-value="loadPayrollHistory"
                />
              </v-col>
              <v-col cols="12" md="6" class="text-right">
                <v-btn
                  color="purple"
                  variant="tonal"
                  @click="generateWeeklyPayroll"
                  prepend-icon="mdi-calendar-clock"
                  :loading="weeklyPayrollLoading"
                >
                  Generate Weekly Payroll
                </v-btn>
              </v-col>
            </v-row>
            
            <v-data-table
              :headers="payrollHistoryHeaders"
              :items="payrollHistory"
              :loading="historyLoading"
              density="compact"
              :items-per-page="15"
            >
              <template v-slot:item.period="{ item }">
                {{ formatDate(item.periodStart) }} - {{ formatDate(item.periodEnd) }}
              </template>
              <template v-slot:item.totalPay="{ item }">
                <strong class="text-green">{{ formatCurrency(item.totalPay) }}</strong>
              </template>
              <template v-slot:item.status="{ item }">
                <v-chip
                  :color="item.status === 'paid' ? 'green' : 'orange'"
                  size="small"
                  label
                >
                  {{ item.status }}
                </v-chip>
              </template>
              <template v-slot:item.createdAt="{ item }">
                {{ formatDateTime(item.createdAt) }}
              </template>
              <template v-slot:item.actions="{ item }">
                <v-btn
                  icon="mdi-eye"
                  size="x-small"
                  variant="text"
                  @click="viewPayrollDetails(item)"
                />
                <v-btn
                  icon="mdi-download"
                  size="x-small"
                  variant="text"
                  @click="exportPayrollReport(item.id)"
                />
                <v-btn
                  v-if="item.status === 'unpaid'"
                  icon="mdi-check"
                  size="x-small"
                  variant="text"
                  color="green"
                  @click="markAsPaid(item)"
                />
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
        
        <!-- Payroll Details Dialog -->
        <v-dialog v-model="showPayrollDetailsDialog" max-width="600">
          <v-card v-if="selectedPayrollReport">
            <v-card-title>
              Payroll Report Details
            </v-card-title>
            <v-card-text>
              <v-list density="compact">
                <v-list-item>
                  <v-list-item-title>VA</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedPayrollReport.va }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Period</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ formatDate(selectedPayrollReport.periodStart) }} - {{ formatDate(selectedPayrollReport.periodEnd) }}
                  </v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Total Hours</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedPayrollReport.totalHours }} hours</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Hourly Pay</v-list-item-title>
                  <v-list-item-subtitle>{{ formatCurrency(selectedPayrollReport.hourlyPay) }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Commission</v-list-item-title>
                  <v-list-item-subtitle>{{ formatCurrency(selectedPayrollReport.commissionPay) }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="selectedPayrollReport.bonusAmount">
                  <v-list-item-title>Bonus</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ formatCurrency(selectedPayrollReport.bonusAmount) }}
                    <span v-if="selectedPayrollReport.bonusReason">({{ selectedPayrollReport.bonusReason }})</span>
                  </v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Total Pay</v-list-item-title>
                  <v-list-item-subtitle class="text-h6 text-green">
                    {{ formatCurrency(selectedPayrollReport.totalPay) }}
                  </v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Status</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip
                      :color="selectedPayrollReport.status === 'paid' ? 'green' : 'orange'"
                      size="small"
                      label
                    >
                      {{ selectedPayrollReport.status }}
                    </v-chip>
                  </v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="selectedPayrollReport.paymentMethod">
                  <v-list-item-title>Payment Method</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedPayrollReport.paymentMethod }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="selectedPayrollReport.notes">
                  <v-list-item-title>Notes</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedPayrollReport.notes }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn
                color="primary"
                variant="text"
                @click="showPayrollDetailsDialog = false"
              >
                Close
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </v-window-item>
    </v-window>
    
    <!-- Snackbar for notifications -->
    <v-snackbar
      v-model="showSnackbar"
      :color="snackbarColor"
      :timeout="3000"
      location="top"
    >
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn
          variant="text"
          @click="showSnackbar = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { campaignsApi, shopifyApi } from '@/services/api';
import logsAPI from '@/services/logsAPI';
import adLaunchesAPI from '@/services/adLaunchesAPI';
import { useAuth } from '@/composables/useAuth';

// Get auth user
const { user, isAuthenticated } = useAuth();

// Tab control
const activeTab = ref('tracker');

// Snackbar state
const showSnackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

// Helper functions for notifications
const showSuccess = (message) => {
  snackbarText.value = message;
  snackbarColor.value = 'success';
  showSnackbar.value = true;
};

const showError = (message) => {
  snackbarText.value = message;
  snackbarColor.value = 'error';
  showSnackbar.value = true;
};

// ========== EXISTING LAUNCH MANAGEMENT DATA ==========
const campaigns = ref([]);
const stores = ref([]);
const currentCampaign = ref(null);
const currentLaunches = ref([]);
const selectedCampaignId = ref(null);
const isLoading = ref(false);
const searchQuery = ref('');
const statusFilter = ref('all');

// Campaign ID editing
const editingCampaignId = ref(false);
const tempCampaignId = ref('');

// Launch ID editing
const editingLaunchId = ref(null);
const tempLaunchId = ref('');

// Launch management
const newLaunchCount = ref(1);
const addingLaunches = ref(false);
const generatingLinkFor = ref(null);
const togglingLaunch = ref(null);

// ========== NEW LAUNCH TRACKER DATA ==========
const trackerEntries = ref([]);
const filteredTrackerEntries = ref([]);
const selectedTrackerWeek = ref('');
const availableWeeks = ref([]);
const trackerLoading = ref(false);
const showAddEntryDialog = ref(false);
const editingEntry = ref(null);
const savingEntry = ref(false);
const entryFormRef = ref(null);

// Inline editing state
const editingCells = ref({});
const editingValues = ref({});
const menuStates = ref({});

// Tracker filters
const trackerFilters = ref({
  va: '',
  status: null,
  offer: null,
  launchTarget: null
});

// Entry form - using reactive for better reactivity
const entryForm = reactive({
  va: '',
  campaignId: '',
  bcGeo: '',
  bcType: '',
  whObj: '',
  launchTarget: '',
  status: '',
  ban: '',
  adSpend: 0,
  bcSpend: 0,
  offer: '',
  notes: ''
});

// Options for dropdowns
const statusOptions = ['Active', 'Banned', 'WH Ban', 'BH Ban', 'PF', 'Other'];
const offerOptions = ['Cash', 'Shein', 'Auto', 'CPI', 'Other'];
const targetOptions = ['US', 'UK', 'CAN', 'AUS', 'Other'];
const whObjOptions = ['Sales', 'Sales +', 'Video Views', 'Reach', 'Traffic', 'Lead Gen', 'Lead Gen +'];
const banOptions = ['WH Instant', 'WH Delay', 'BH Instant', 'BH Delay', 'Dupe'];
const bcTypeOptions = ['Auto', 'Manual'];

// Tracker table headers
const trackerHeaders = [
  { title: 'VA', key: 'va' },
  { title: 'Time', key: 'timestamp' },
  { title: 'Campaign ID', key: 'campaignId' },
  { title: 'Campaign Name', key: 'campaignName' },
  { title: 'BC GEO', key: 'bcGeo' },
  { title: 'BC Type', key: 'bcType' },
  { title: 'WH Obj', key: 'whObj' },
  { title: 'Target', key: 'launchTarget' },
  { title: 'Status', key: 'status' },
  { title: 'Ban', key: 'ban' },
  { title: 'Ad Spend', key: 'adSpend' },
  { title: 'BC Spend', key: 'bcSpend' },
  { title: 'Lost', key: 'amountLost' },
  { title: 'Real', key: 'realSpend' },
  { title: 'Offer', key: 'offer' },
  { title: 'Notes', key: 'notes' },
  { title: 'Actions', key: 'actions', sortable: false }
];

// ========== PAYROLL DATA ==========
// Time Clock
const timeClockForm = reactive({
  va: user.value?.email || '',
  date: new Date().toISOString().split('T')[0],
  hoursWorked: 0,
  bcsLaunched: 0
});

const timeClockLoading = ref(false);
const timeClockVerification = ref({
  show: false,
  type: 'info',
  message: ''
});

// Payroll Calculator
const payrollForm = reactive({
  va: user.value?.email || '',
  startDate: '',
  endDate: '',
  hourlyRate: 5,
  commissionRate: 3,
  bonusAmount: 0,
  bonusReason: '',
  paymentMethod: '',
  notes: ''
});

const payrollLoading = ref(false);
const payrollCalculation = ref(null);

// Payroll History
const payrollHistory = ref([]);
const historyLoading = ref(false);
const historyFilters = reactive({
  va: '',
  status: 'all'
});

const showPayrollDetailsDialog = ref(false);
const selectedPayrollReport = ref(null);
const weeklyPayrollLoading = ref(false);

// Payroll history table headers
const payrollHistoryHeaders = [
  { title: 'VA', key: 'va' },
  { title: 'Period', key: 'period' },
  { title: 'Hours', key: 'totalHours' },
  { title: 'Total Pay', key: 'totalPay' },
  { title: 'Status', key: 'status' },
  { title: 'Created', key: 'createdAt' },
  { title: 'Actions', key: 'actions', sortable: false }
];

// Generate hours options (0.5 hour increments from 0 to 24)
const hoursOptions = (() => {
  const options = [];
  for (let i = 0; i <= 24; i += 0.5) {
    options.push(i);
  }
  return options;
})();

const todayDate = new Date().toISOString().split('T')[0];

// ========== COMPUTED PROPERTIES ==========
const campaignOptions = computed(() => {
  return campaigns.value.map(c => ({
    id: c.id,
    name: c.name,
    displayName: `${c.name} (${c.id})`
  }));
});

const filteredLaunches = computed(() => {
  let launches = [...currentLaunches.value];
  
  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    launches = launches.filter(l => 
      l.number.toString().toLowerCase().includes(query)
    );
  }
  
  // Filter by status
  if (statusFilter.value === 'active') {
    launches = launches.filter(l => l.isActive);
  } else if (statusFilter.value === 'disabled') {
    launches = launches.filter(l => !l.isActive);
  }
  
  return launches;
});

// Tracker computed properties
const trackerTotals = computed(() => {
  return adLaunchesAPI.calculateTotals(filteredTrackerEntries.value);
});

const calculatedAmountLost = computed(() => {
  return (parseFloat(entryForm.bcSpend) || 0) - (parseFloat(entryForm.adSpend) || 0);
});

const calculatedRealSpend = computed(() => {
  return (parseFloat(entryForm.adSpend) || 0) - calculatedAmountLost.value;
});

// Check if user is admin (admins can edit VA field)
const isUserAdmin = computed(() => {
  return user.value?.isAdmin || false;
});

// Get user email for permission checks
const userEmail = computed(() => {
  return user.value?.email || '';
});

// Check if user is a Virtual Assistant
const isVirtualAssistant = computed(() => {
  return user.value?.isVirtualAssistant || false;
});

// Helper to get campaign name by ID
const getCampaignName = (campaignId) => {
  const campaign = campaigns.value.find(c => c.id === campaignId);
  return campaign ? campaign.name : '';
};

// ========== EXISTING LAUNCH MANAGEMENT METHODS ==========
const fetchCampaigns = async () => {
  try {
    const data = await campaignsApi.listCampaigns({ limit: 100 });
    campaigns.value = data.campaigns || [];
    
    // Auto-select first campaign if available
    if (campaigns.value.length > 0 && !selectedCampaignId.value) {
      selectedCampaignId.value = campaigns.value[0].id;
      await selectCampaign(selectedCampaignId.value);
    }
  } catch (error) {
    showError('Failed to load campaigns');
  }
};

const fetchStores = async () => {
  try {
    const data = await shopifyApi.listStores({ limit: 100, status: 'active' });
    stores.value = data.stores || [];
  } catch (error) {
    console.error('Failed to fetch stores:', error);
  }
};

const selectCampaign = async (campaignId) => {
  if (!campaignId) {
    currentCampaign.value = null;
    currentLaunches.value = [];
    return;
  }
  
  isLoading.value = true;
  try {
    // Fetch campaign details
    const data = await campaignsApi.getCampaign(campaignId);
    currentCampaign.value = data;
    
    // Fetch traffic data
    let trafficData = {};
    try {
      const trafficResponse = await logsAPI.getTrafficByLaunch(campaignId);
      trafficData = trafficResponse.traffic || {};
    } catch (error) {
      console.error('Failed to fetch traffic data:', error);
    }
    
    // Convert launches object to array
    if (data.launches && Object.keys(data.launches).length > 0) {
      const launchesArray = Object.entries(data.launches)
        .map(([num, launch]) => ({
          ...launch,
          number: num,
          traffic: trafficData[num] || 0
        }))
        .sort((a, b) => {
          const aNum = parseInt(a.number);
          const bNum = parseInt(b.number);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
          }
          return a.number.toString().localeCompare(b.number.toString());
        });
      currentLaunches.value = launchesArray;
    } else {
      // Initialize with default launch if none exist
      currentLaunches.value = [{
        number: '0',
        isActive: true,
        createdAt: new Date().toISOString(),
        generatedAt: null,
        traffic: trafficData['0'] || 0
      }];
    }
    
    newLaunchCount.value = 1;
  } catch (error) {
    showError('Failed to load campaign details');
    currentCampaign.value = null;
    currentLaunches.value = [];
  } finally {
    isLoading.value = false;
  }
};

const addNewLaunches = async () => {
  if (!currentCampaign.value || !newLaunchCount.value) return;
  
  addingLaunches.value = true;
  try {
    const newLaunches = [];
    
    for (let i = 0; i < newLaunchCount.value; i++) {
      const result = await campaignsApi.manageLaunches(currentCampaign.value.id, 'add', {});
      if (result.success && result.result?.launchNumber !== undefined) {
        newLaunches.push(result.result.launchNumber);
      }
    }
    
    if (newLaunches.length > 0) {
      showSuccess(`Successfully added ${newLaunches.length} new launch(es): ${newLaunches.join(', ')}`);
      await selectCampaign(currentCampaign.value.id);
    } else {
      showError('Failed to add launches');
    }
  } catch (error) {
    showError('Failed to add launches: ' + error.message);
  } finally {
    addingLaunches.value = false;
  }
};

// Campaign ID editing functions
const startEditCampaignId = () => {
  tempCampaignId.value = currentCampaign.value.id;
  editingCampaignId.value = true;
};

const cancelEditCampaignId = () => {
  editingCampaignId.value = false;
  tempCampaignId.value = '';
};

const saveCampaignId = async () => {
  if (!tempCampaignId.value || tempCampaignId.value === currentCampaign.value.id) {
    cancelEditCampaignId();
    return;
  }
  
  try {
    const result = await campaignsApi.updateCampaignId(currentCampaign.value.id, tempCampaignId.value);
    if (result.success) {
      showSuccess('Campaign ID updated successfully');
      const oldId = currentCampaign.value.id;
      currentCampaign.value.id = tempCampaignId.value;
      editingCampaignId.value = false;
      
      // Update the campaigns list and re-select
      await fetchCampaigns();
      selectedCampaignId.value = tempCampaignId.value;
      await selectCampaign(tempCampaignId.value);
    } else {
      showError(result.message || 'Failed to update campaign ID');
    }
  } catch (error) {
    showError('Failed to update campaign ID: ' + error.message);
  }
};

// Launch ID editing functions
const startEditLaunchId = (launchNumber) => {
  tempLaunchId.value = launchNumber.toString();
  editingLaunchId.value = launchNumber;
};

const cancelEditLaunchId = () => {
  editingLaunchId.value = null;
  tempLaunchId.value = '';
};

const saveLaunchId = async (oldLaunchNumber) => {
  const newLaunchId = tempLaunchId.value.trim();
  
  if (!newLaunchId || newLaunchId === oldLaunchNumber.toString()) {
    cancelEditLaunchId();
    return;
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(newLaunchId)) {
    showError('Launch ID can only contain letters, numbers, and underscores');
    return;
  }
  
  if (oldLaunchNumber.toString() !== newLaunchId && currentLaunches.value.some(l => l.number.toString() === newLaunchId)) {
    showError('Launch ID already exists');
    return;
  }
  
  try {
    const result = await campaignsApi.updateLaunchId(currentCampaign.value.id, oldLaunchNumber, newLaunchId);
    if (result.success) {
      showSuccess('Launch ID updated successfully');
      
      const launchIndex = currentLaunches.value.findIndex(l => l.number.toString() === oldLaunchNumber.toString());
      if (launchIndex !== -1) {
        currentLaunches.value[launchIndex].number = newLaunchId;
      }
      
      editingLaunchId.value = null;
      tempLaunchId.value = '';
      
      await selectCampaign(currentCampaign.value.id);
    } else {
      showError(result.message || 'Failed to update launch ID');
    }
  } catch (error) {
    showError('Failed to update launch ID: ' + error.message);
  }
};

const toggleLaunch = async (launchNumber) => {
  togglingLaunch.value = launchNumber;
  try {
    const result = await campaignsApi.manageLaunches(currentCampaign.value.id, 'toggle', {
      launchNumber: launchNumber
    });
    
    if (result.success) {
      const launchIndex = currentLaunches.value.findIndex(l => l.number.toString() === launchNumber.toString());
      if (launchIndex !== -1) {
        currentLaunches.value[launchIndex].isActive = result.result?.isActive || !currentLaunches.value[launchIndex].isActive;
      }
      
      showSuccess('Launch status updated');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      togglingLaunch.value = null;
      await generateLaunchLink(launchNumber);
    }
  } catch (error) {
    showError('Failed to update launch status');
  } finally {
    togglingLaunch.value = null;
  }
};

const generateLaunchLink = async (launchNumber) => {
  generatingLinkFor.value = launchNumber;
  try {
    const data = await campaignsApi.generateLink({
      campaignId: currentCampaign.value.id,
      launchNumber: launchNumber,
      params: {
        utm_source: 'tiktok',
        utm_medium: 'cpc',
        utm_campaign: currentCampaign.value.id
      }
    });
    
    if (data.success && data.link) {
      await navigator.clipboard.writeText(data.link);
      
      if (data.refreshed) {
        showSuccess('Shopify pages refreshed and link copied!');
      } else {
        showSuccess('Link generated and copied to clipboard!');
      }
      
      await selectCampaign(currentCampaign.value.id);
    }
  } catch (error) {
    let errorMessage = 'Error generating link: ' + error.message;
    
    if (error.message?.includes('store is missing admin API token')) {
      errorMessage = 'Error: The TikTok store is missing its Admin API token.';
    } else if (error.message?.includes('store not found')) {
      errorMessage = 'Error: One of the configured stores was not found.';
    }
    
    showError(errorMessage);
  } finally {
    generatingLinkFor.value = null;
  }
};

const copyTestLink = async (launchNumber) => {
  try {
    const pageHandle = `${currentCampaign.value.id}-${launchNumber}`;
    const tiktokStore = stores.value.find(s => s.id === currentCampaign.value.tiktokStoreId);
    
    if (!tiktokStore) {
      showError('TikTok store not found');
      return;
    }
    
    let storeUrl = tiktokStore.store_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!storeUrl.includes('.myshopify.com') && !storeUrl.includes('.')) {
      storeUrl = `${storeUrl}.myshopify.com`;
    }
    
    const testLink = `https://${storeUrl}/pages/${pageHandle}?ttclid=9999999`;
    await navigator.clipboard.writeText(testLink);
    showSuccess('Test link copied to clipboard!');
  } catch (error) {
    showError('Failed to copy test link: ' + error.message);
  }
};

// ========== NEW LAUNCH TRACKER METHODS ==========
const loadAvailableWeeks = async () => {
  try {
    // Get current week
    const currentWeek = adLaunchesAPI.utils.formatWeekKey(new Date());
    const currentWeekString = adLaunchesAPI.utils.getCurrentWeekString();
    
    // Initialize with current week and past 8 weeks
    const weeks = [];
    const today = new Date();
    
    for (let i = 0; i < 8; i++) {
      const weekDate = new Date(today);
      weekDate.setDate(today.getDate() - (i * 7));
      const weekKey = adLaunchesAPI.utils.formatWeekKey(weekDate);
      const weekStart = adLaunchesAPI.utils.getWeekStart(weekDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      weeks.push({
        key: weekKey,
        display: i === 0 ? `Current Week (${currentWeekString})` : 
                 `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`
      });
    }
    
    availableWeeks.value = weeks;
    selectedTrackerWeek.value = currentWeek;
  } catch (error) {
    console.error('Error loading available weeks:', error);
  }
};

const loadTrackerData = async () => {
  trackerLoading.value = true;
  try {
    const data = await adLaunchesAPI.getEntries(selectedTrackerWeek.value);
    console.log('Loaded tracker data:', data);
    // Add campaign name to each entry
    trackerEntries.value = (data.entries || []).map(entry => ({
      ...entry,
      campaignName: getCampaignName(entry.campaignId)
    }));
    filterTrackerData();
  } catch (error) {
    console.error('Error loading tracker data:', error);
    showError('Failed to load tracker data');
    trackerEntries.value = [];
  } finally {
    trackerLoading.value = false;
  }
};

const filterTrackerData = () => {
  let filtered = [...trackerEntries.value];
  
  if (trackerFilters.value.va) {
    filtered = filtered.filter(e => 
      e.va?.toLowerCase().includes(trackerFilters.value.va.toLowerCase())
    );
  }
  
  if (trackerFilters.value.status) {
    filtered = filtered.filter(e => e.status === trackerFilters.value.status);
  }
  
  if (trackerFilters.value.offer) {
    filtered = filtered.filter(e => e.offer === trackerFilters.value.offer);
  }
  
  if (trackerFilters.value.launchTarget) {
    filtered = filtered.filter(e => e.launchTarget === trackerFilters.value.launchTarget);
  }
  
  filteredTrackerEntries.value = filtered;
};

const exportTrackerData = async () => {
  try {
    await adLaunchesAPI.exportData(selectedTrackerWeek.value);
    showSuccess('Data exported successfully');
  } catch (error) {
    showError('Failed to export data');
  }
};

const openAddEntryDialog = () => {
  // Reset form with user's email as VA name
  Object.assign(entryForm, {
    va: user.value?.email || '',  // Auto-populate with user's email
    campaignId: selectedCampaignId.value || '',  // Auto-populate with current campaign if selected
    bcGeo: '',
    bcType: '',
    whObj: '',
    launchTarget: '',
    status: '',
    ban: '',
    adSpend: 0,
    bcSpend: 0,
    offer: '',
    notes: ''
  });
  editingEntry.value = null;
  showAddEntryDialog.value = true;
};

const editTrackerEntry = (entry) => {
  editingEntry.value = entry;
  // Don't copy campaignName to the form (it's a computed field)
  const { campaignName, ...entryData } = entry;
  Object.assign(entryForm, entryData);
  showAddEntryDialog.value = true;
};

const deleteTrackerEntry = async (entry) => {
  if (confirm(`Are you sure you want to delete this entry for ${entry.va}?`)) {
    try {
      await adLaunchesAPI.deleteEntry(entry.id, selectedTrackerWeek.value);
      showSuccess('Entry deleted successfully');
      await loadTrackerData();
    } catch (error) {
      showError('Failed to delete entry');
    }
  }
};

// Inline editing methods
const isEditing = (itemId, field) => {
  return editingCells.value[`${itemId}-${field}`] === true;
};

const startInlineEdit = (item, field) => {
  // Don't allow editing if user is not admin and it's not their entry
  if (!isUserAdmin.value && item.va !== userEmail.value) {
    showError('You can only edit your own entries');
    return;
  }
  
  // Set the editing state
  const key = `${item.id}-${field}`;
  editingCells.value[key] = true;
  editingValues.value[key] = item[field];
  // Open menu for select fields
  menuStates.value[key] = true;
};

const cancelInlineEdit = (itemId, field) => {
  const key = `${itemId}-${field}`;
  delete editingCells.value[key];
  delete editingValues.value[key];
  delete menuStates.value[key];
};

const saveInlineEdit = async (item, field) => {
  const key = `${item.id}-${field}`;
  const newValue = editingValues.value[key];
  
  // Don't save if value hasn't changed
  if (newValue === item[field]) {
    cancelInlineEdit(item.id, field);
    return;
  }
  
  try {
    // Prepare the update data
    const updateData = { ...item };
    updateData[field] = newValue;
    
    // Recalculate computed fields if needed
    if (field === 'adSpend' || field === 'bcSpend') {
      const adSpend = field === 'adSpend' ? parseFloat(newValue) || 0 : parseFloat(item.adSpend) || 0;
      const bcSpend = field === 'bcSpend' ? parseFloat(newValue) || 0 : parseFloat(item.bcSpend) || 0;
      updateData.amountLost = Math.max(0, bcSpend - adSpend);
      updateData.realSpend = adSpend - updateData.amountLost;
    }
    
    // Update the entry
    await adLaunchesAPI.updateEntry(
      item.id,
      updateData,
      selectedTrackerWeek.value
    );
    
    // Update local data
    item[field] = newValue;
    if (field === 'adSpend' || field === 'bcSpend') {
      item.amountLost = updateData.amountLost;
      item.realSpend = updateData.realSpend;
    }
    
    // Clear editing state
    cancelInlineEdit(item.id, field);
    
    // Reload data to ensure consistency
    await loadTrackerData();
    showSuccess(`${field} updated successfully`);
  } catch (error) {
    console.error('Failed to update inline:', error);
    showError('Failed to update field');
    cancelInlineEdit(item.id, field);
  }
};

const saveTrackerEntry = async () => {
  // Validate form if ref is available
  if (entryFormRef.value) {
    const { valid } = await entryFormRef.value.validate();
    if (!valid) {
      showError('Please fill in all required fields');
      return;
    }
  }
  
  savingEntry.value = true;
  try {
    console.log('Saving entry:', entryForm);
    
    if (editingEntry.value) {
      // Update existing entry
      await adLaunchesAPI.updateEntry(
        editingEntry.value.id,
        entryForm,
        selectedTrackerWeek.value
      );
      showSuccess('Entry updated successfully');
    } else {
      // Create new entry
      const result = await adLaunchesAPI.createEntry(entryForm);
      console.log('Entry created:', result);
      showSuccess('Entry added successfully');
    }
    
    closeEntryDialog();
    await loadTrackerData();
  } catch (error) {
    console.error('Save error:', error);
    showError('Failed to save entry: ' + (error.message || 'Unknown error'));
  } finally {
    savingEntry.value = false;
  }
};

const closeEntryDialog = () => {
  showAddEntryDialog.value = false;
  editingEntry.value = null;
  Object.assign(entryForm, {
    va: '',
    campaignId: '',
    bcGeo: '',
    bcType: '',
    whObj: '',
    launchTarget: '',
    status: '',
    ban: '',
    adSpend: 0,
    bcSpend: 0,
    offer: '',
    notes: ''
  });
};

// Helper functions
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', { timeZone: 'America/New_York' });
};

const formatCurrency = (value) => {
  return `$${parseFloat(value || 0).toFixed(2)}`;
};

const getTimeSinceGenerated = (generatedAt) => {
  if (!generatedAt) return { hours: 0, days: 0, minutes: 0 };
  
  const genDate = new Date(generatedAt);
  const now = new Date();
  const diffMs = now - genDate;
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  return { hours, days, minutes };
};

const getStatusColor = (status) => {
  const colors = {
    'Active': 'green',
    'Banned': 'red',
    'WH Ban': 'orange',
    'BH Ban': 'blue',
    'PF': 'grey',
    'Other': 'grey'
  };
  return colors[status] || 'grey';
};

// Launch count controls
const incrementLaunchCount = () => {
  if (newLaunchCount.value < 10) {
    newLaunchCount.value++;
  }
};

const decrementLaunchCount = () => {
  if (newLaunchCount.value > 1) {
    newLaunchCount.value--;
  }
};

const validateLaunchCount = () => {
  if (newLaunchCount.value < 1) {
    newLaunchCount.value = 1;
  } else if (newLaunchCount.value > 10) {
    newLaunchCount.value = 10;
  }
};

// ========== PAYROLL METHODS ==========
// Time Clock Methods
const submitTimeEntry = async () => {
  try {
    timeClockLoading.value = true;
    
    const response = await fetch('/api/timeclock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(timeClockForm),
      credentials: 'include'
    });
    
    if (!response.ok) throw new Error('Failed to submit time entry');
    
    const result = await response.json();
    showSuccess('Time entry submitted successfully');
    
    // Check against actual launches
    await checkTimeEntry();
  } catch (error) {
    showError(error.message || 'Failed to submit time entry');
  } finally {
    timeClockLoading.value = false;
  }
};

const checkTimeEntry = async () => {
  try {
    const response = await fetch(`/api/timeclock?va=${timeClockForm.va}&date=${timeClockForm.date}`, {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (data.actualLaunches !== undefined) {
      const difference = Math.abs(data.actualLaunches - timeClockForm.bcsLaunched);
      
      if (difference === 0) {
        timeClockVerification.value = {
          show: true,
          type: 'success',
          message: `Launch count matches! ${data.actualLaunches} launches verified.`
        };
      } else {
        timeClockVerification.value = {
          show: true,
          type: 'warning',
          message: `Launch count mismatch! You reported ${timeClockForm.bcsLaunched} but system shows ${data.actualLaunches} launches.`
        };
      }
    }
  } catch (error) {
    console.error('Failed to check time entry:', error);
  }
};

// Payroll Calculator Methods
const calculatePayroll = async () => {
  try {
    payrollLoading.value = true;
    payrollCalculation.value = null;
    
    const response = await fetch(
      `/api/payroll?va=${payrollForm.va}&startDate=${payrollForm.startDate}&endDate=${payrollForm.endDate}`,
      { credentials: 'include' }
    );
    
    if (!response.ok) throw new Error('Failed to calculate payroll');
    
    const data = await response.json();
    
    // Calculate pay components
    const hourlyPay = data.totalHours * payrollForm.hourlyRate;
    const commissionPay = data.totalRealSpend * (payrollForm.commissionRate / 100);
    const totalPay = hourlyPay + commissionPay + (payrollForm.bonusAmount || 0);
    
    payrollCalculation.value = {
      ...data,
      hourlyPay,
      commissionPay,
      totalPay
    };
  } catch (error) {
    showError(error.message || 'Failed to calculate payroll');
  } finally {
    payrollLoading.value = false;
  }
};

const createPayrollReport = async () => {
  try {
    if (!payrollCalculation.value) return;
    
    const report = {
      va: payrollForm.va,
      period: {
        start: payrollForm.startDate,
        end: payrollForm.endDate
      },
      totalHours: payrollCalculation.value.totalHours,
      totalRealSpend: payrollCalculation.value.totalRealSpend,
      hourlyRate: payrollForm.hourlyRate,
      commissionRate: payrollForm.commissionRate / 100,
      bonusAmount: payrollForm.bonusAmount || 0,
      bonusReason: payrollForm.bonusReason,
      paymentMethod: payrollForm.paymentMethod,
      notes: payrollForm.notes
    };
    
    const response = await fetch('/api/payroll-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      credentials: 'include'
    });
    
    if (!response.ok) throw new Error('Failed to create payroll report');
    
    showSuccess('Payroll report created successfully');
    await loadPayrollHistory();
    
    // Switch to history tab
    activeTab.value = 'history';
  } catch (error) {
    showError(error.message || 'Failed to create payroll report');
  }
};

// Payroll History Methods
const loadPayrollHistory = async () => {
  try {
    historyLoading.value = true;
    
    let url = '/api/payroll-report?';
    if (historyFilters.va) url += `va=${historyFilters.va}&`;
    if (historyFilters.status !== 'all') url += `status=${historyFilters.status}&`;
    
    const response = await fetch(url, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to load payroll history');
    
    payrollHistory.value = await response.json();
  } catch (error) {
    showError(error.message || 'Failed to load payroll history');
  } finally {
    historyLoading.value = false;
  }
};

const viewPayrollDetails = (report) => {
  selectedPayrollReport.value = report;
  showPayrollDetailsDialog.value = true;
};

const markAsPaid = async (report) => {
  try {
    const response = await fetch(`/api/payroll-report/${report.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid' }),
      credentials: 'include'
    });
    
    if (!response.ok) throw new Error('Failed to update payment status');
    
    showSuccess('Payment status updated');
    await loadPayrollHistory();
  } catch (error) {
    showError(error.message || 'Failed to update payment status');
  }
};

const exportPayrollReport = async (reportId) => {
  try {
    const response = await fetch(`/api/payroll-report/export?id=${reportId}`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to export report');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_report_${reportId}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    showError(error.message || 'Failed to export report');
  }
};

const generateWeeklyPayroll = async () => {
  try {
    weeklyPayrollLoading.value = true;
    
    const response = await fetch('/api/generate-weekly-payroll', {
      method: 'POST',
      credentials: 'include'
    });
    
    if (!response.ok) throw new Error('Failed to generate weekly payroll');
    
    const reports = await response.json();
    showSuccess(`Generated ${reports.length} payroll reports`);
    await loadPayrollHistory();
  } catch (error) {
    showError(error.message || 'Failed to generate weekly payroll');
  } finally {
    weeklyPayrollLoading.value = false;
  }
};

// Lifecycle
onMounted(() => {
  fetchCampaigns();
  fetchStores();
  loadAvailableWeeks();
  loadTrackerData();
  loadPayrollHistory();
});
</script>

<style scoped>
.launches-container {
}

/* Launch count input with stepper buttons */
.launch-count-wrapper {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgb(216, 180, 254);
  border-radius: 4px;
  background-color: white;
  overflow: hidden;
}

.launch-count-input {
  border: none;
  padding: 6px 8px;
  font-size: 0.875rem;
  line-height: 1.25rem;
  background-color: transparent;
  color: rgba(0, 0, 0, 0.87);
  text-align: center;
  width: 50px;
  height: 32px;
  -moz-appearance: textfield;
}

.launch-count-input:focus {
  outline: none;
}

.launch-count-input::-webkit-inner-spin-button,
.launch-count-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.launch-count-btn {
  background-color: transparent;
  border: none;
  padding: 6px 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  color: rgb(168, 85, 247);
  min-width: 32px;
  height: 32px;
}

.launch-count-btn:hover:not(:disabled) {
  background-color: rgba(216, 180, 254, 0.2);
}

.launch-count-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
  color: rgba(0, 0, 0, 0.38);
}

.launch-count-btn.minus {
  border-right: 1px solid rgb(216, 180, 254);
}

.launch-count-btn.plus {
  border-left: 1px solid rgb(216, 180, 254);
}

/* Dark theme support */
.v-theme--dark .launch-count-wrapper {
  background-color: rgba(255, 255, 255, 0.09);
  border-color: rgba(168, 85, 247, 0.5);
}

.v-theme--dark .launch-count-input {
  color: rgba(255, 255, 255, 0.87);
}

.v-theme--dark .launch-count-btn {
  color: rgba(168, 85, 247, 0.9);
}

.v-theme--dark .launch-count-btn:hover:not(:disabled) {
  background-color: rgba(168, 85, 247, 0.1);
}

.v-theme--dark .launch-count-btn:disabled {
  color: rgba(255, 255, 255, 0.3);
}

.v-theme--dark .launch-count-btn.minus {
  border-right-color: rgba(168, 85, 247, 0.5);
}

.v-theme--dark .launch-count-btn.plus {
  border-left-color: rgba(168, 85, 247, 0.5);
}

/* Tracker table styling */
.tracker-table :deep(.v-data-table__td) {
  white-space: nowrap;
}

.tracker-table :deep(.v-data-table-header__content) {
  font-weight: 600;
}

/* Inline editing styles */
.editable-cell {
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
  min-height: 32px;
  display: flex;
  align-items: center;
  position: relative;
}

.editable-cell:hover {
  background-color: rgba(168, 85, 247, 0.08);
}

.v-theme--dark .editable-cell:hover {
  background-color: rgba(168, 85, 247, 0.15);
}

.editable-cell:deep(.v-field) {
  min-height: 32px !important;
}

.editable-cell:deep(.v-field__input) {
  padding: 4px 8px !important;
  min-height: 32px !important;
}

.editable-cell:deep(.v-input__details) {
  display: none !important;
}

.editable-cell:deep(.v-select__selection) {
  margin: 0 !important;
}

/* Ensure table doesn't clip dropdowns */
.tracker-table :deep(.v-data-table__td) {
  white-space: nowrap;
  position: relative;
  overflow: visible;
}
</style>