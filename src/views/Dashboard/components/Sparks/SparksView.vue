<template>
  <v-container fluid class="sparks-container">
    <!-- Tab Navigation -->
    <v-tabs v-model="activeTab" class="mb-4">
      <v-tab value="sparks">Sparks</v-tab>
      <v-tab v-if="!isAssistingUser" value="payments">Payments</v-tab>
      <v-tab v-if="!isAssistingUser" value="history">Payment History</v-tab>
      <v-tab v-if="!isAssistingUser" value="invoices">Invoices</v-tab>
    </v-tabs>

    <!-- Sparks Tab Content -->
    <v-window v-model="activeTab">
      <v-window-item value="sparks">
        <!-- Search and Filters Bar -->
        <v-card class="mb-4">
          <v-card-text>
            <v-row align="center">
              <v-col cols="12" md="3">
                <v-text-field
                  v-model="searchInput"
                  label="Search sparks..."
                  variant="outlined"
                  density="compact"
                  hide-details
                  prepend-inner-icon="mdi-magnify"
                  clearable
                />
              </v-col>

              <v-col cols="12" md="2">
                <v-select
                  v-model="typeFilter"
                  :items="typeOptions"
                  label="Type"
                  variant="outlined"
                  density="compact"
                  hide-details
                />
              </v-col>

              <v-col cols="12" md="2">
                <v-select
                  v-model="statusFilter"
                  :items="statusOptions"
                  label="Status"
                  variant="outlined"
                  density="compact"
                  hide-details
                />
              </v-col>

              <v-col cols="12" md="2">
                <v-select
                  v-model="creatorFilter"
                  :items="creatorOptions"
                  label="Creator"
                  variant="outlined"
                  density="compact"
                  hide-details
                />
              </v-col>

              <v-col cols="auto">
                <v-checkbox
                  v-model="activeOnly"
                  label="Active Only"
                  hide-details
                  density="compact"
                />
              </v-col>

              <v-col cols="auto" class="ml-auto">
                <v-btn
                  variant="tonal"
                  color="primary"
                  class="mr-2"
                  @click="exportToCSV"
                  prepend-icon="mdi-download"
                >
                  Export CSV
                </v-btn>
                <v-btn
                  color="primary"
                  variant="elevated"
                  class="mr-2"
                  @click="openCreateModal"
                  prepend-icon="mdi-plus"
                >
                  Add Spark
                </v-btn>
                <v-btn
                  color="secondary"
                  variant="elevated"
                  class="mr-2"
                  @click="bulkAdd"
                  prepend-icon="mdi-plus-box-multiple"
                >
                  Bulk Add
                </v-btn>
                <v-btn
                  variant="text"
                  @click="clearFilters"
                  prepend-icon="mdi-filter-remove"
                >
                  Clear Filters
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Data Table -->
        <v-card>
          <v-card-text class="pa-2">
            <v-alert
              type="info"
              variant="tonal"
              density="compact"
              class="mb-2"
            >
              Double-click any cell to edit inline. Press Enter to save or Esc to cancel.
            </v-alert>
          </v-card-text>
          <v-data-table
            :headers="headers"
            :items="filteredSparks"
            :items-per-page="itemsPerPage"
            :loading="isLoading"
            :items-per-page-options="[10, 25, 50, 100]"
            :page="currentPage"
            @update:page="currentPage = $event"
            class="sparks-table"
            hover
            fixed-header
            height="600"
          >
            <!-- Thumbnail Column -->
            <template v-slot:item.thumbnail="{ item }">
              <div class="thumbnail-container my-2">
                <v-img
                  :src="item.thumbnail || defaultThumbnail"
                  :alt="item.name"
                  width="150"
                  height="150"
                  cover
                  class="rounded cursor-pointer"
                  @click="showLargePreview(item)"
                  @error="handleImageError"
                />
              </div>
            </template>

            <!-- Name Column (editable) -->
            <template v-slot:item.name="{ item }">
              <div 
                @dblclick="startInlineEdit(item, 'name')"
                class="editable-cell"
                :title="'Double-click to edit'"
              >
                <v-text-field
                  v-if="isEditing(item.id, 'name')"
                  v-model="editingValues[`${item.id}-name`]"
                  density="compact"
                  variant="outlined"
                  hide-details
                  single-line
                  autofocus
                  @blur="saveInlineEdit(item, 'name')"
                  @keyup.enter="saveInlineEdit(item, 'name')"
                  @keyup.esc="cancelInlineEdit(item.id, 'name')"
                />
                <span v-else class="font-weight-medium">{{ item.name }}</span>
              </div>
            </template>

            <!-- Type Column (editable) -->
            <template v-slot:item.type="{ item }">
              <div 
                @dblclick="startInlineEdit(item, 'type')"
                class="editable-cell"
                :title="'Double-click to edit'"
              >
                <v-select
                  v-if="isEditing(item.id, 'type')"
                  v-model="editingValues[`${item.id}-type`]"
                  :items="['auto', 'manual']"
                  :menu="menuStates[`${item.id}-type`]"
                  @update:menu="val => menuStates[`${item.id}-type`] = val"
                  density="compact"
                  variant="outlined"
                  hide-details
                  @update:model-value="val => { editingValues[`${item.id}-type`] = val; saveInlineEdit(item, 'type'); }"
                />
                <v-chip
                  v-else
                  size="small"
                  :color="item.type === 'manual' ? 'purple' : 'indigo'"
                  variant="flat"
                >
                  {{ item.type || 'Auto' }}
                </v-chip>
              </div>
            </template>

            <!-- Status Column (editable) -->
            <template v-slot:item.status="{ item }">
              <div 
                @dblclick="startInlineEdit(item, 'status')"
                class="editable-cell"
                :title="'Double-click to edit'"
              >
                <v-select
                  v-if="isEditing(item.id, 'status')"
                  v-model="editingValues[`${item.id}-status`]"
                  :items="['active', 'completed', 'disabled']"
                  :menu="menuStates[`${item.id}-status`]"
                  @update:menu="val => menuStates[`${item.id}-status`] = val"
                  density="compact"
                  variant="outlined"
                  hide-details
                  @update:model-value="val => { editingValues[`${item.id}-status`] = val; saveInlineEdit(item, 'status'); }"
                />
                <v-chip
                  v-else
                  size="small"
                  :color="getStatusColor(item.status)"
                  variant="flat"
                >
                  {{ getStatusLabel(item.status) }}
                </v-chip>
              </div>
            </template>

            <!-- Creator Column (editable) -->
            <template v-slot:item.creator="{ item }">
              <div 
                @dblclick="startInlineEdit(item, 'creator')"
                class="editable-cell"
                :title="'Double-click to edit'"
              >
                <v-select
                  v-if="isEditing(item.id, 'creator')"
                  v-model="editingValues[`${item.id}-creator`]"
                  :items="virtualAssistants"
                  :menu="menuStates[`${item.id}-creator`]"
                  @update:menu="val => menuStates[`${item.id}-creator`] = val"
                  density="compact"
                  variant="outlined"
                  hide-details
                  @update:model-value="val => { editingValues[`${item.id}-creator`] = val; saveInlineEdit(item, 'creator'); }"
                />
                <span v-else>{{ item.creator || '-' }}</span>
              </div>
            </template>

            <!-- TikTok Link Column -->
            <template v-slot:item.tiktok_link="{ item }">
              <v-btn
                icon
                variant="text"
                size="small"
                :href="item.tiktok_link"
                target="_blank"
                @click.stop
              >
                <v-icon>mdi-open-in-new</v-icon>
              </v-btn>
            </template>

            <!-- Spark Code Column (editable) -->
            <template v-slot:item.spark_code="{ item }">
              <div 
                @dblclick="startInlineEdit(item, 'spark_code')"
                class="editable-cell d-flex align-center"
                :title="'Double-click to edit'"
              >
                <v-text-field
                  v-if="isEditing(item.id, 'spark_code')"
                  v-model="editingValues[`${item.id}-spark_code`]"
                  density="compact"
                  variant="outlined"
                  hide-details
                  single-line
                  autofocus
                  @blur="saveInlineEdit(item, 'spark_code')"
                  @keyup.enter="saveInlineEdit(item, 'spark_code')"
                  @keyup.esc="cancelInlineEdit(item.id, 'spark_code')"
                />
                <template v-else>
                  <div class="d-flex align-center">
                    <code class="mr-2 text-truncate spark-code-truncate">{{ item.spark_code }}</code>
                    <v-btn
                      icon
                      variant="text"
                      size="x-small"
                      @click.stop="copyCode(item.spark_code)"
                    >
                      <v-icon size="small">mdi-content-copy</v-icon>
                    </v-btn>
                  </div>
                </template>
              </div>
            </template>

            <!-- Created Date Column -->
            <template v-slot:item.created_at="{ item }">
              {{ formatDate(item.created_at) }}
            </template>

            <!-- Actions Column -->
            <template v-slot:item.actions="{ item }">
              <v-btn
                icon
                variant="text"
                size="small"
                color="primary"
                @click.stop="editSpark(item)"
              >
                <v-icon>mdi-pencil</v-icon>
              </v-btn>
              <v-btn
                icon
                variant="text"
                size="small"
                color="error"
                @click.stop="deleteSpark(item)"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-window-item>

      <!-- Payments Tab Content -->
      <v-window-item value="payments">
        <!-- Undo Button -->
        <v-slide-y-transition>
          <v-alert
            v-if="showUndoButton"
            type="success"
            variant="tonal"
            closable
            @click:close="showUndoButton = false"
            class="mb-4"
          >
            <div class="d-flex align-center justify-space-between">
              <span>Payment marked successfully for {{ lastPaymentAction?.creator }}</span>
              <v-btn
                color="warning"
                variant="elevated"
                size="small"
                @click="undoLastPayment"
                prepend-icon="mdi-undo"
              >
                Undo
              </v-btn>
            </div>
          </v-alert>
        </v-slide-y-transition>
        
        <!-- Summary Cards -->
        <v-row class="mb-4">
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <h3 class="text-h4 text-primary mb-2">${{ totalOwed }}</h3>
                <p class="text-body-2 text-grey">Total Owed</p>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <h3 class="text-h4 text-success mb-2">${{ totalPaid }}</h3>
                <p class="text-body-2 text-grey">Total Paid</p>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <h3 class="text-h4 text-warning mb-2">{{ unpaidSparks }}</h3>
                <p class="text-body-2 text-grey">Unpaid Videos</p>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <h3 class="text-h4 text-info mb-2">{{ activeCreators }}</h3>
                <p class="text-body-2 text-grey">Active Creators</p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Payment Settings -->
        <v-card class="mb-4">
          <v-card-title>
            <span>Payment Settings</span>
            <v-spacer />
            <v-btn
              color="primary"
              variant="elevated"
              :loading="isSavingSettings"
              @click="savePaymentSettings"
              prepend-icon="mdi-content-save"
            >
              Save Settings
            </v-btn>
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="defaultRate"
                  label="Default Rate per Video"
                  prefix="$"
                  type="number"
                  variant="outlined"
                  density="compact"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="defaultCommissionRate"
                  label="Default Commission"
                  :suffix="defaultCommissionType === 'percentage' ? '%' : '$'"
                  type="number"
                  variant="outlined"
                  density="compact"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-select
                  v-model="defaultCommissionType"
                  label="Commission Type"
                  :items="[{title: 'Percentage', value: 'percentage'}, {title: 'Fixed Amount', value: 'fixed'}]"
                  variant="outlined"
                  density="compact"
                />
              </v-col>
            </v-row>

            <h4 class="text-h6 mb-3">Creator Custom Rates & Commissions</h4>
            <v-row>
              <v-col
                v-for="creator in creators"
                :key="creator.id"
                cols="12"
              >
                <v-card variant="outlined" class="pa-3">
                  <div class="font-weight-medium mb-2">{{ creator.name }}</div>
                  <v-row>
                    <v-col cols="12" md="4">
                      <v-text-field
                        v-model="creator.rate"
                        label="Rate per Video"
                        prefix="$"
                        type="number"
                        variant="outlined"
                        density="compact"
                        hide-details
                      />
                    </v-col>
                    <v-col cols="12" md="4">
                      <v-text-field
                        v-model="creator.commissionRate"
                        label="Commission"
                        :suffix="creator.commissionType === 'percentage' ? '%' : '$'"
                        type="number"
                        variant="outlined"
                        density="compact"
                        hide-details
                      />
                    </v-col>
                    <v-col cols="12" md="4">
                      <v-select
                        v-model="creator.commissionType"
                        label="Type"
                        :items="[{title: 'Percentage', value: 'percentage'}, {title: 'Fixed', value: 'fixed'}]"
                        variant="outlined"
                        density="compact"
                        hide-details
                      />
                    </v-col>
                  </v-row>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Payments List -->
        <v-card>
          <v-card-title>Payment Summary by Creator</v-card-title>
          <v-card-text>
            <v-expansion-panels
              v-if="paymentsByCreator.length > 0"
              variant="accordion"
            >
              <v-expansion-panel
                v-for="creatorPayment in paymentsByCreator"
                :key="creatorPayment.creator"
              >
                <v-expansion-panel-title>
                  <v-row align="center" class="flex-grow-0">
                    <v-col cols="auto">
                      <v-avatar color="primary" size="32">
                        <span>{{ creatorPayment.creator.charAt(0) }}</span>
                      </v-avatar>
                    </v-col>
                    <v-col>
                      <div class="font-weight-medium">{{ creatorPayment.creator }}</div>
                      <div class="text-caption text-grey">
                        {{ creatorPayment.videos.length }} video{{ creatorPayment.videos.length !== 1 ? 's' : '' }} • 
                        ${{ creatorPayment.rate }}/video
                        <span v-if="creatorPayment.commissionRate > 0">
                          + {{ creatorPayment.commissionRate }}{{ creatorPayment.commissionType === 'percentage' ? '%' : '$' }} commission
                        </span>
                      </div>
                    </v-col>
                    <v-col cols="auto">
                      <div class="text-right">
                        <div class="text-h6 text-primary">${{ creatorPayment.total }}</div>
                        <div class="text-caption text-grey">
                          Base: ${{ creatorPayment.baseAmount }}
                          <span v-if="creatorPayment.commissionAmount > 0">
                            + Commission: ${{ creatorPayment.commissionAmount }}
                          </span>
                        </div>
                      </div>
                    </v-col>
                  </v-row>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-list density="compact">
                    <v-list-item
                      v-for="video in creatorPayment.videos"
                      :key="video.id"
                      class="pl-0"
                    >
                      <template v-slot:prepend>
                        <v-icon size="small" color="grey">mdi-video</v-icon>
                      </template>
                      <v-list-item-title>{{ video.name }}</v-list-item-title>
                      <v-list-item-subtitle>
                        <v-chip size="x-small" variant="flat" class="mr-2">{{ video.spark_code }}</v-chip>
                        <span class="text-caption">{{ formatDate(video.created_at) }}</span>
                      </v-list-item-subtitle>
                      <template v-slot:append>
                        <v-btn
                          icon
                          variant="text"
                          size="x-small"
                          :href="video.tiktok_link"
                          target="_blank"
                        >
                          <v-icon size="small">mdi-open-in-new</v-icon>
                        </v-btn>
                      </template>
                    </v-list-item>
                  </v-list>
                  <v-divider class="my-2"></v-divider>
                  <div class="d-flex justify-end">
                    <v-btn
                      color="success"
                      variant="tonal"
                      size="small"
                      @click="markCreatorPaid(creatorPayment.creator)"
                    >
                      Mark All Paid
                    </v-btn>
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
            <v-alert
              v-else
              type="info"
              variant="tonal"
              class="mt-4"
            >
              No unpaid videos found
            </v-alert>
          </v-card-text>
        </v-card>
      </v-window-item>

      <!-- Payment History Tab Content -->
      <v-window-item value="history">
        <!-- Date Range Filter -->
        <v-card class="mb-4">
          <v-card-text>
            <v-row align="center">
              <v-col cols="12" md="3">
                <v-text-field
                  v-model="historyDateFrom"
                  label="From Date"
                  type="date"
                  variant="outlined"
                  density="compact"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-text-field
                  v-model="historyDateTo"
                  label="To Date"
                  type="date"
                  variant="outlined"
                  density="compact"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-select
                  v-model="historyCreatorFilter"
                  :items="historyCreatorOptions"
                  label="Creator"
                  variant="outlined"
                  density="compact"
                  hide-details
                />
              </v-col>
              <v-col cols="auto">
                <v-btn
                  color="primary"
                  variant="tonal"
                  @click="filterPaymentHistory"
                  prepend-icon="mdi-filter"
                >
                  Apply Filter
                </v-btn>
              </v-col>
              <v-col cols="auto">
                <v-btn
                  variant="text"
                  @click="clearHistoryFilters"
                  prepend-icon="mdi-filter-remove"
                >
                  Clear
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Payment History Summary -->
        <v-row class="mb-4">
          <v-col cols="12" md="4">
            <v-card>
              <v-card-text class="text-center">
                <h3 class="text-h4 text-success mb-2">${{ totalPaidInPeriod }}</h3>
                <p class="text-body-2 text-grey">Total Paid in Period</p>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="4">
            <v-card>
              <v-card-text class="text-center">
                <h3 class="text-h4 text-info mb-2">{{ totalPayments }}</h3>
                <p class="text-body-2 text-grey">Total Payments</p>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="4">
            <v-card>
              <v-card-text class="text-center">
                <h3 class="text-h4 text-primary mb-2">{{ totalVideosPaid }}</h3>
                <p class="text-body-2 text-grey">Videos Paid</p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Payment History Table -->
        <v-card>
          <v-card-title>
            Payment Records
            <v-spacer />
            <v-btn
              variant="tonal"
              color="primary"
              @click="exportPaymentHistory"
              prepend-icon="mdi-download"
              size="small"
            >
              Export History
            </v-btn>
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="paymentHistoryHeaders"
              :items="paymentHistory"
              :items-per-page="itemsPerPage"
              :loading="isLoadingHistory"
              class="elevation-0"
            >
              <!-- Payment Date Column -->
              <template v-slot:item.paymentDate="{ item }">
                {{ formatDate(item.paymentDate) }}
              </template>

              <!-- Creator Column with Avatar -->
              <template v-slot:item.creator="{ item }">
                <div class="d-flex align-center">
                  <v-avatar size="28" color="primary" class="mr-2">
                    <span class="text-caption">{{ item.creator.charAt(0) }}</span>
                  </v-avatar>
                  {{ item.creator }}
                </div>
              </template>

              <!-- Amount Column -->
              <template v-slot:item.amount="{ item }">
                <span class="text-success font-weight-medium">${{ item.amount }}</span>
              </template>

              <!-- Status Column -->
              <template v-slot:item.status="{ item }">
                <v-chip
                  :color="item.status === 'paid' ? 'success' : 'warning'"
                  size="small"
                  variant="flat"
                >
                  {{ item.status }}
                </v-chip>
              </template>

              <!-- Details Column -->
              <template v-slot:item.details="{ item }">
                <v-btn
                  icon
                  variant="text"
                  size="small"
                  @click="showPaymentDetails(item)"
                >
                  <v-icon>mdi-information-outline</v-icon>
                </v-btn>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-window-item>

      <!-- Invoices Tab Content -->
      <v-window-item value="invoices">
        <!-- Invoice Actions Bar -->
        <v-card class="mb-4">
          <v-card-text>
            <v-row align="center">
              <v-col cols="12" md="3">
                <v-select
                  v-model="invoiceStatusFilter"
                  :items="invoiceStatusOptions"
                  label="Status"
                  variant="outlined"
                  density="compact"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-select
                  v-model="invoiceCreatorFilter"
                  :items="invoiceCreatorOptions"
                  label="Creator"
                  variant="outlined"
                  density="compact"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="2">
                <v-text-field
                  v-model="invoiceDateFrom"
                  label="From Date"
                  type="date"
                  variant="outlined"
                  density="compact"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="2">
                <v-text-field
                  v-model="invoiceDateTo"
                  label="To Date"
                  type="date"
                  variant="outlined"
                  density="compact"
                  hide-details
                />
              </v-col>
              <v-col cols="auto">
                <v-btn
                  color="primary"
                  variant="elevated"
                  @click="openInvoiceGenerator"
                  prepend-icon="mdi-file-document-plus"
                >
                  Create Invoice
                </v-btn>
              </v-col>
              <v-col cols="auto">
                <v-btn
                  color="secondary"
                  variant="tonal"
                  @click="openInvoiceSettings"
                  prepend-icon="mdi-cog"
                >
                  Settings
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Invoice Statistics -->
        <v-row class="mb-4">
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <h3 class="text-h4 text-primary mb-2">{{ totalInvoices }}</h3>
                <p class="text-body-2 text-grey">Total Invoices</p>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <h3 class="text-h4 text-success mb-2">${{ totalInvoiced }}</h3>
                <p class="text-body-2 text-grey">Total Invoiced</p>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <h3 class="text-h4 text-warning mb-2">{{ pendingInvoices }}</h3>
                <p class="text-body-2 text-grey">Pending</p>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text class="text-center">
                <h3 class="text-h4 text-info mb-2">${{ paidInvoices }}</h3>
                <p class="text-body-2 text-grey">Paid</p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Invoices List -->
        <v-card>
          <v-card-title>
            Invoices
            <v-spacer />
            <v-btn
              variant="text"
              color="primary"
              @click="refreshInvoices"
              prepend-icon="mdi-refresh"
            >
              Refresh
            </v-btn>
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="invoiceHeaders"
              :items="invoices"
              :loading="isLoadingInvoices"
              items-per-page="10"
              class="elevation-0"
            >
              <!-- Invoice Number Column -->
              <template v-slot:item.invoice_number="{ item }">
                <span class="font-weight-medium">{{ item.invoice_number }}</span>
              </template>

              <!-- Status Column -->
              <template v-slot:item.status="{ item }">
                <v-chip
                  :color="getInvoiceStatusColor(item.status)"
                  size="small"
                  variant="tonal"
                >
                  {{ item.status }}
                </v-chip>
              </template>

              <!-- Date Column -->
              <template v-slot:item.invoice_date="{ item }">
                {{ formatDate(item.invoice_date) }}
              </template>

              <!-- Amount Column -->
              <template v-slot:item.total_amount="{ item }">
                <span class="font-weight-medium">${{ item.total_amount.toFixed(2) }}</span>
              </template>

              <!-- Actions Column -->
              <template v-slot:item.actions="{ item }">
                <v-btn
                  icon="mdi-eye"
                  size="small"
                  variant="text"
                  @click="viewInvoice(item)"
                  title="View Invoice"
                />
                <v-btn
                  icon="mdi-download"
                  size="small"
                  variant="text"
                  @click="downloadInvoice(item)"
                  title="Download PDF"
                />
                <v-btn
                  v-if="item.status === 'pending'"
                  icon="mdi-check"
                  size="small"
                  variant="text"
                  color="success"
                  @click="markInvoicePaid(item)"
                  title="Mark as Paid"
                />
                <v-btn
                  v-if="item.status === 'pending'"
                  icon="mdi-pencil"
                  size="small"
                  variant="text"
                  @click="editInvoice(item)"
                  title="Edit Invoice"
                />
                <v-btn
                  v-if="item.status !== 'voided'"
                  icon="mdi-close"
                  size="small"
                  variant="text"
                  color="error"
                  @click="voidInvoice(item)"
                  title="Void Invoice"
                />
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-window-item>
    </v-window>

    <!-- Preview Modal -->
    <v-dialog v-model="showPreview" max-width="600">
      <v-card>
        <v-card-title>
          {{ previewSpark?.name }}
          <v-spacer />
          <v-btn icon variant="text" @click="showPreview = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-img
            :src="previewSpark?.thumbnail"
            :alt="previewSpark?.name"
            max-height="400"
            contain
          />
          <div class="mt-4">
            <p><strong>Spark Code:</strong> {{ previewSpark?.spark_code }}</p>
            <p><strong>Status:</strong> {{ previewSpark?.status }}</p>
            <v-btn
              :href="previewSpark?.tiktok_link"
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

    <!-- Create/Edit Modal -->
    <v-dialog v-model="showCreateModal" max-width="700">
      <v-card>
        <v-card-title>
          {{ editingSparkData ? 'Edit Spark' : 'Create Spark' }}
          <v-spacer />
          <v-btn icon variant="text" @click="showCreateModal = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-form ref="sparkFormRef">
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="sparkForm.name"
                  label="Spark Name"
                  required
                  variant="outlined"
                  density="compact"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="sparkForm.creator"
                  label="Creator (VA)"
                  :items="virtualAssistants"
                  variant="outlined"
                  density="compact"
                  hint="Select the virtual assistant who created this spark"
                  :rules="[v => v !== undefined || 'Please select a creator']"
                  required
                />
              </v-col>
            </v-row>
            
            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="sparkForm.tiktokLink"
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
                  v-model="sparkForm.sparkCode"
                  label="Spark Code"
                  required
                  variant="outlined"
                  density="compact"
                  hint="Unique identifier code"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="sparkForm.type"
                  label="Type"
                  :items="[
                    { title: 'Auto', value: 'auto' },
                    { title: 'Manual', value: 'manual' }
                  ]"
                  variant="outlined"
                  density="compact"
                />
              </v-col>
            </v-row>
            
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="sparkForm.status"
                  label="Status"
                  :items="[
                    { title: 'Active', value: 'active' },
                    { title: 'Completed', value: 'completed' },
                    { title: 'Disabled', value: 'disabled' }
                  ]"
                  variant="outlined"
                  density="compact"
                />
              </v-col>
            </v-row>
            
            <!-- Thumbnail Preview (Read-only) -->
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
          <v-btn variant="text" @click="showCreateModal = false">Cancel</v-btn>
          <v-btn color="primary" variant="elevated" @click="saveSpark">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Bulk Add Modal -->
    <v-dialog v-model="showBulkAddModal" max-width="900">
      <v-card>
        <v-card-title>
          Bulk Add Sparks
          <v-spacer />
          <v-btn icon variant="text" @click="showBulkAddModal = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-form ref="bulkAddFormRef">
            <!-- Info Alert -->
            <v-alert
              type="info"
              variant="tonal"
              density="compact"
              class="mb-4"
            >
              <v-icon>mdi-information</v-icon>
              Spark codes will be automatically generated if not provided. You can enter fewer spark codes than TikTok links.
            </v-alert>
            
            <!-- Base Name Field -->
            <v-text-field
              v-model="bulkAddForm.baseName"
              label="Base Name (e.g., Max-0901)"
              variant="outlined"
              density="compact"
              hint="This will be used as the name prefix for all sparks"
              class="mb-4"
            />
            
            <v-row>
              <!-- Type and Creator Selection -->
              <v-col cols="12" md="6">
                <v-select
                  v-model="bulkAddForm.type"
                  label="Type"
                  :items="[
                    { title: 'Auto', value: 'auto' },
                    { title: 'Manual', value: 'manual' }
                  ]"
                  variant="outlined"
                  density="compact"
                  class="mb-4"
                />
              </v-col>
              
              <v-col cols="12" md="6">
                <v-select
                  v-model="bulkAddForm.creator"
                  label="Creator (VA)"
                  :items="virtualAssistants"
                  variant="outlined"
                  density="compact"
                  class="mb-4"
                />
              </v-col>
            </v-row>
            
            <v-row>
              <!-- Status Selection -->
              <v-col cols="12" md="6">
                <v-select
                  v-model="bulkAddForm.status"
                  label="Status"
                  :items="[
                    { title: 'Active', value: 'active' },
                    { title: 'Completed', value: 'completed' },
                    { title: 'Disabled', value: 'disabled' }
                  ]"
                  variant="outlined"
                  density="compact"
                  class="mb-4"
                />
              </v-col>
            </v-row>
            
            <v-row>
              <!-- TikTok Links Textarea (LEFT) -->
              <v-col cols="12" md="6">
                <v-textarea
                  v-model="bulkAddForm.tiktokLinks"
                  label="TikTok Links (one per line)"
                  variant="outlined"
                  density="compact"
                  rows="8"
                  hint="Enter one TikTok link per line"
                  placeholder="https://www.tiktok.com/@user/video/123&#10;https://www.tiktok.com/@user/video/456"
                  @input="onTikTokLinksChange"
                />
              </v-col>
              
              <!-- Spark Codes Textarea (RIGHT) -->
              <v-col cols="12" md="6">
                <v-textarea
                  v-model="bulkAddForm.sparkCodes"
                  label="Spark Codes (one per line - Optional)"
                  variant="outlined"
                  density="compact"
                  rows="8"
                  hint="Optional: Codes will be auto-generated if not provided"
                  placeholder="SC001&#10;SC002&#10;SC003&#10;(Leave empty to auto-generate)"
                />
              </v-col>
            </v-row>
            
            <!-- Preview Section -->
            <v-card 
              v-if="bulkAddPreview.length > 0"
              class="mt-4"
              variant="tonal"
              color="info"
            >
              <v-card-title class="text-h6">
                Preview: {{ bulkAddPreview.length }} spark(s) will be created
              </v-card-title>
              <v-card-text>
                <v-list density="compact" class="preview-list">
                  <v-list-item
                    v-for="(item, index) in bulkAddPreview.slice(0, 10)"
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
                  <v-list-item v-if="bulkAddPreview.length > 10" class="text-center">
                    <v-list-item-title class="text-caption text-grey">
                      ... and {{ bulkAddPreview.length - 10 }} more
                    </v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-card-text>
            </v-card>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="outlined" @click="previewBulkAdd">Preview</v-btn>
          <v-btn 
            color="primary" 
            variant="elevated" 
            @click="saveBulkAdd"
            :disabled="bulkAddPreview.length === 0 || bulkAddLoading"
            :loading="bulkAddLoading"
          >
            Save All
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Payment Details Modal -->
    <v-dialog v-model="showPaymentDetailsModal" max-width="600">
      <v-card>
        <v-card-title>
          Payment Details
          <v-spacer />
          <v-btn icon variant="text" @click="showPaymentDetailsModal = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text v-if="selectedPayment">
          <v-list density="compact">
            <v-list-item>
              <v-list-item-title class="font-weight-medium">Creator</v-list-item-title>
              <v-list-item-subtitle>{{ selectedPayment.creator }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title class="font-weight-medium">Payment Date</v-list-item-title>
              <v-list-item-subtitle>{{ formatDate(selectedPayment.paymentDate) }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title class="font-weight-medium">Amount</v-list-item-title>
              <v-list-item-subtitle>${{ selectedPayment.amount }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title class="font-weight-medium">Number of Videos</v-list-item-title>
              <v-list-item-subtitle>{{ selectedPayment.videoCount }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title class="font-weight-medium">Payment Method</v-list-item-title>
              <v-list-item-subtitle>{{ selectedPayment.paymentMethod || 'N/A' }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title class="font-weight-medium">Notes</v-list-item-title>
              <v-list-item-subtitle>{{ selectedPayment.notes || 'No notes' }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
          
          <v-divider class="my-3"></v-divider>
          
          <div class="text-subtitle-2 mb-2">Videos Included:</div>
          <v-list density="compact">
            <v-list-item
              v-for="video in selectedPayment.videos"
              :key="video.id"
              class="pl-0"
            >
              <template v-slot:prepend>
                <v-icon size="small" color="grey">mdi-video</v-icon>
              </template>
              <v-list-item-title>{{ video.name }}</v-list-item-title>
              <v-list-item-subtitle>
                <v-chip size="x-small" variant="flat">{{ video.spark_code }}</v-chip>
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showPaymentDetailsModal = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Modal -->
    <v-dialog v-model="showDeleteModal" max-width="500">
      <v-card>
        <v-card-title class="text-h6">
          <v-icon color="error" class="mr-2">mdi-alert-circle</v-icon>
          Confirm Delete
        </v-card-title>
        <v-card-text>
          <p class="text-body-1 mb-3">
            Are you sure you want to delete this spark?
          </p>
          <div v-if="sparkToDelete" class="pa-3 bg-grey-lighten-4 rounded">
            <p class="font-weight-bold mb-1">{{ sparkToDelete.name }}</p>
            <p class="text-caption text-grey mb-0">
              <v-icon size="small" class="mr-1">mdi-code-tags</v-icon>
              {{ sparkToDelete.spark_code }}
            </p>
            <p class="text-caption text-grey">
              <v-icon size="small" class="mr-1">mdi-account</v-icon>
              {{ sparkToDelete.creator || 'None' }}
            </p>
          </div>
          <v-alert 
            type="warning" 
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            This action cannot be undone.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn 
            variant="text" 
            @click="cancelDelete"
          >
            Cancel
          </v-btn>
          <v-btn 
            color="error" 
            variant="elevated"
            @click="confirmDelete"
            :loading="deleteLoading"
          >
            Delete Spark
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="showSnackbar" :color="snackbarColor" :timeout="3000">
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn variant="text" @click="showSnackbar = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { sparksApi, templatesApi, usersApi } from '@/services/api';
import { useAuth } from '@/composables/useAuth';
import jsPDF from 'jspdf';

// Get auth state
const { user, isAssistingUser } = useAuth();

// Tab state
const activeTab = ref('sparks');

// Watch for tab changes and prevent VAs from accessing payment tabs
watch(activeTab, (newTab) => {
  if (isAssistingUser.value && (newTab === 'payments' || newTab === 'history')) {
    activeTab.value = 'sparks';
    snackbarText.value = 'Payment features are not available in Virtual Assistant mode';
    snackbarColor.value = 'warning';
    showSnackbar.value = true;
  }
});

// Data state
const sparks = ref([]);
const isLoading = ref(false);
const offerTemplates = ref([]);
const creators = ref([]);
const payments = ref([]);
const virtualAssistants = ref([]);

// Inline editing state
const editingCells = ref({});
const editingValues = ref({});
const menuStates = ref({});

// Filter state
const searchInput = ref('');
const searchQuery = ref('');

// Debounce timer
let searchDebounceTimer = null;

// Watch search input with debounce
watch(searchInput, (newValue) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    searchQuery.value = newValue;
  }, 300); // 300ms debounce
});
const typeFilter = ref('all');
const statusFilter = ref('active');  // Default to active
const creatorFilter = ref('all');
const activeOnly = ref(false);

// Table configuration
const itemsPerPage = ref(25); // Increased for better performance with pagination
const currentPage = ref(1);

// Modal state
const showPreview = ref(false);
const previewSpark = ref(null);
const showCreateModal = ref(false);
const editingSparkData = ref(null);
const showBulkAddModal = ref(false);
const showDeleteModal = ref(false);
const sparkToDelete = ref(null);
const deleteLoading = ref(false);

// Form state
const sparkForm = ref({
  name: '',
  creator: undefined,  // No default, user must select
  tiktokLink: '',
  sparkCode: '',
  type: 'auto',
  status: 'active'
});

// Bulk Add Form state
const bulkAddForm = ref({
  baseName: '',
  type: 'auto',
  creator: undefined,
  status: 'active',
  sparkCodes: '',
  tiktokLinks: ''
});

const bulkAddPreview = ref([]);
const bulkAddLoading = ref(false);

// Payment state
const defaultRate = ref(1);
const defaultCommissionRate = ref(0);
const defaultCommissionType = ref('percentage');
const paymentSettingsLoaded = ref(false);
const isSavingSettings = ref(false);

// Payment History state
const paymentHistory = ref([]);
const isLoadingHistory = ref(false);
const historyDateFrom = ref('');
const historyDateTo = ref('');
const historyCreatorFilter = ref('all');
const historyCreatorOptions = ref([{ title: 'All Creators', value: 'all' }]);
const showPaymentDetailsModal = ref(false);
const selectedPayment = ref(null);

// Undo state
const lastPaymentAction = ref(null);
const showUndoButton = ref(false);
const undoTimeoutId = ref(null);

// Invoice state
const invoices = ref([]);
const isLoadingInvoices = ref(false);
const invoiceStatusFilter = ref('all');
const invoiceCreatorFilter = ref('all');
const invoiceDateFrom = ref('');
const invoiceDateTo = ref('');
const invoiceStatusOptions = ref([
  { title: 'All Status', value: 'all' },
  { title: 'Pending', value: 'pending' },
  { title: 'Paid', value: 'paid' },
  { title: 'Voided', value: 'voided' },
  { title: 'Overdue', value: 'overdue' }
]);
const invoiceCreatorOptions = ref([{ title: 'All Creators', value: 'all' }]);
const invoiceHeaders = ref([
  { title: 'Invoice #', key: 'invoice_number', sortable: true },
  { title: 'Creator', key: 'creator_name', sortable: true },
  { title: 'Date', key: 'invoice_date', sortable: true },
  { title: 'Due Date', key: 'due_date', sortable: true },
  { title: 'Amount', key: 'total_amount', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false }
]);

// Payment History Headers
const paymentHistoryHeaders = ref([
  { title: 'Date', key: 'paymentDate', sortable: true },
  { title: 'Creator', key: 'creator', sortable: true },
  { title: 'Videos', key: 'videoCount', sortable: true },
  { title: 'Amount', key: 'amount', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Method', key: 'paymentMethod', sortable: true },
  { title: 'Details', key: 'details', sortable: false }
]);

// Snackbar
const showSnackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

// Table headers
const headers = ref([
  { title: 'Date', key: 'created_at' },
  { title: 'Preview', key: 'thumbnail', sortable: false, width: '120px' },
  { title: 'TikTok Link', key: 'tiktok_link', sortable: false },
  { title: 'Spark Code', key: 'spark_code' },
  { title: 'Status', key: 'status' },
  { title: 'Type', key: 'type' },
  { title: 'Creator', key: 'creator' },
  { title: 'Name', key: 'name' },
  { title: 'Actions', key: 'actions', sortable: false }
]);

// Options for filters
const typeOptions = ref([
  { title: 'All Types', value: 'all' },
  { title: 'Auto', value: 'auto' },
  { title: 'Manual', value: 'manual' }
]);

const statusOptions = ref([
  { title: 'All Status', value: 'all' },
  { title: 'Active', value: 'active' },
  { title: 'Completed', value: 'completed' },
  { title: 'Disabled', value: 'disabled' }
]);

const creatorOptions = ref([
  { title: 'All Creators', value: 'all' }
]);

// Default thumbnail
const defaultThumbnail = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjRTBFMEUwIi8+CjxwYXRoIGQ9Ik0yNSAxOEwyOSAyNUwyNSAzMkwyMSAyNVoiIGZpbGw9IiM5RTlFOUUiLz4KPC9zdmc+';

// Computed properties
const filteredSparks = computed(() => {
  let filtered = sparks.value;

  // Apply filters only if needed to avoid unnecessary iterations
  if (typeFilter.value !== 'all' || statusFilter.value !== 'all' || 
      creatorFilter.value !== 'all' || activeOnly.value || searchQuery.value) {
    
    filtered = sparks.value.filter(spark => {
      // Type filter
      if (typeFilter.value !== 'all' && spark.type !== typeFilter.value) {
        return false;
      }

      // Status filter
      if (statusFilter.value !== 'all' && spark.status !== statusFilter.value) {
        return false;
      }

      // Creator filter
      if (creatorFilter.value !== 'all' && spark.creator !== creatorFilter.value) {
        return false;
      }

      // Active only filter
      if (activeOnly.value && spark.status !== 'active') {
        return false;
      }

      // Search query filter
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        const searchableText = `${spark.name || ''} ${spark.creator || ''} ${spark.spark_code || ''} ${spark.type || ''}`.toLowerCase();
        if (!searchableText.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }

  return filtered;
});

// Computed property for payments grouped by creator
const paymentsByCreator = computed(() => {
  const creatorMap = new Map();
  
  // Group sparks by creator (only unpaid/active ones)
  sparks.value
    .filter(spark => spark.creator && spark.status === 'active')
    .forEach(spark => {
      if (!creatorMap.has(spark.creator)) {
        creatorMap.set(spark.creator, {
          creator: spark.creator,
          videos: [],
          rate: defaultRate.value,
          total: 0
        });
      }
      creatorMap.get(spark.creator).videos.push(spark);
    });
  
  // Calculate totals and apply custom rates and commissions if available
  const paymentsList = Array.from(creatorMap.values());
  paymentsList.forEach(payment => {
    // Check if there's a custom rate and commission for this creator
    const customCreator = creators.value.find(c => c.name === payment.creator);
    if (customCreator) {
      if (customCreator.rate) {
        payment.rate = customCreator.rate;
      }
      payment.commissionRate = customCreator.commissionRate || defaultCommissionRate.value;
      payment.commissionType = customCreator.commissionType || defaultCommissionType.value;
    } else {
      payment.commissionRate = defaultCommissionRate.value;
      payment.commissionType = defaultCommissionType.value;
    }
    
    // Calculate base amount
    const baseAmount = payment.videos.length * payment.rate;
    
    // Calculate commission
    let commissionAmount = 0;
    if (payment.commissionRate > 0) {
      if (payment.commissionType === 'percentage') {
        commissionAmount = baseAmount * (payment.commissionRate / 100);
      } else if (payment.commissionType === 'fixed') {
        commissionAmount = payment.videos.length * payment.commissionRate;
      }
    }
    
    payment.baseAmount = baseAmount.toFixed(2);
    payment.commissionAmount = commissionAmount.toFixed(2);
    payment.total = (baseAmount + commissionAmount).toFixed(2);
  });
  
  // Sort by creator name
  return paymentsList.sort((a, b) => a.creator.localeCompare(b.creator));
});

// Computed properties for payment summary stats
const totalOwed = computed(() => {
  return paymentsByCreator.value
    .reduce((sum, payment) => sum + parseFloat(payment.total), 0)
    .toFixed(2);
});

const totalPaid = computed(() => {
  // Calculate based on completed sparks
  const completedSparks = sparks.value.filter(spark => spark.status === 'completed' && spark.creator);
  let total = 0;
  
  completedSparks.forEach(spark => {
    const customCreator = creators.value.find(c => c.name === spark.creator);
    const rate = customCreator?.rate || defaultRate.value;
    total += rate;
  });
  
  return total.toFixed(2);
});

const unpaidSparks = computed(() => {
  return sparks.value.filter(spark => spark.status === 'active' && spark.creator).length;
});

const activeCreators = computed(() => {
  return paymentsByCreator.value.length;
});

// Computed properties for payment history
const totalPaidInPeriod = computed(() => {
  return paymentHistory.value
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0)
    .toFixed(2);
});

const totalPayments = computed(() => {
  return paymentHistory.value.length;
});

const totalVideosPaid = computed(() => {
  return paymentHistory.value.reduce((sum, p) => sum + (p.videoCount || 0), 0);
});

// Computed properties for invoices
const totalInvoices = computed(() => {
  return invoices.value.length;
});

const totalInvoiced = computed(() => {
  return invoices.value
    .reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
    .toFixed(2);
});

const pendingInvoices = computed(() => {
  return invoices.value.filter(inv => inv.status === 'pending').length;
});

const paidInvoices = computed(() => {
  return invoices.value
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
    .toFixed(2);
});

// Methods
const fetchSparks = async () => {
  isLoading.value = true;
  try {
    const response = await sparksApi.listSparks({ page: 1, limit: 1000 });
    if (response.success) {
      // Freeze the sparks array to prevent unnecessary reactivity on individual items
      sparks.value = Object.freeze(response.sparks.map(spark => ({
        ...spark,
        type: spark.type || 'auto',
        creator: spark.creator || 'None'  // Show "None" instead of "Unknown"
      })));
      
      // Use virtual assistants for creator options if available
      const uniqueCreators = [...new Set(sparks.value.map(s => s.creator).filter(c => c))];
      
      if (virtualAssistants.value.length > 1) {  // More than just "None"
        creatorOptions.value = [
          { title: 'All Creators', value: 'all' },
          ...virtualAssistants.value.filter(va => va.value !== '')  // Exclude "None"
        ];
        
        // Use VAs for payments
        creators.value = virtualAssistants.value
          .filter(va => va.value !== '')
          .map(va => ({
            id: va.value,
            name: va.title,
            rate: defaultRate.value,
            commissionRate: defaultCommissionRate.value,
            commissionType: defaultCommissionType.value
          }));
      } else {
        // Fallback to extracting from existing data
        creatorOptions.value = [
          { title: 'All Creators', value: 'all' },
          ...uniqueCreators.map(c => ({ title: c || 'Unknown', value: c }))
        ];
        
        creators.value = uniqueCreators.map(name => ({
          id: name,
          name: name,
          rate: defaultRate.value,
          commissionRate: defaultCommissionRate.value,
          commissionType: defaultCommissionType.value
        }));
      }
      
      // Stats are updated automatically via computed properties
    }
  } catch (error) {
    showError('Failed to load sparks');
  } finally {
    isLoading.value = false;
  }
};

const fetchOfferTemplates = async () => {
  try {
    const data = await templatesApi.getTemplatesList();
    offerTemplates.value = data.templates || [];
  } catch (error) {
    offerTemplates.value = [];
  }
};

const fetchVirtualAssistants = async () => {
  try {
    const response = await usersApi.getVirtualAssistants();
    console.log('Virtual assistants response:', response); // Debug log
    
    // The API returns { assistants: [...] }
    if (response && response.assistants && Array.isArray(response.assistants)) {
      virtualAssistants.value = response.assistants
        .filter(va => va.status === 'active') // Only show active VAs
        .map(va => ({
          title: va.email || 'Unknown VA',
          value: va.email || 'Unknown'
        }));
      
      console.log('Processed VAs:', virtualAssistants.value); // Debug log
      
      // Add a "None" option at the beginning
      virtualAssistants.value.unshift({ title: 'None', value: '' });
    } else {
      console.log('No virtual assistants found in response, response structure:', response);
      virtualAssistants.value = [{ title: 'None', value: '' }];
    }
    
    console.log('Final virtualAssistants.value:', virtualAssistants.value); // Debug log
  } catch (error) {
    console.error('Failed to fetch virtual assistants:', error);
    virtualAssistants.value = [{ title: 'None', value: '' }];
  }
};

const clearFilters = () => {
  searchInput.value = '';
  searchQuery.value = '';
  typeFilter.value = 'all';
  statusFilter.value = 'all';
  creatorFilter.value = 'all';
  activeOnly.value = false;
  currentPage.value = 1;
};

const getStatusColor = (status) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'completed':
      return 'blue';
    case 'disabled':
      return 'grey';
    default:
      return 'grey';
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'active':
      return 'Active';
    case 'completed':
      return 'Completed';
    case 'disabled':
      return 'Disabled';
    default:
      return status;
  }
};

const copyCode = (code) => {
  navigator.clipboard.writeText(code);
  showSuccess('Spark code copied to clipboard');
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
};

const handleImageError = (event) => {
  event.target.src = defaultThumbnail;
};

const showLargePreview = (spark) => {
  previewSpark.value = spark;
  showPreview.value = true;
};

const openCreateModal = () => {
  editingSparkData.value = null;
  sparkForm.value = {
    name: '',
    creator: undefined,  // No default, user must select
    tiktokLink: '',
    sparkCode: '',
    type: 'auto',
    status: 'active'
  };
  showCreateModal.value = true;
};

const editSpark = (spark) => {
  editingSparkData.value = spark;
  sparkForm.value = {
    name: spark.name || '',
    creator: spark.creator || '',
    tiktokLink: spark.tiktok_link || '',
    sparkCode: spark.spark_code || '',
    type: spark.type || 'auto',
    status: spark.status || 'active'
  };
  showCreateModal.value = true;
};

const saveSpark = async () => {
  try {
    // Validate required fields including creator
    if (!sparkForm.value.name || !sparkForm.value.tiktokLink || !sparkForm.value.sparkCode || sparkForm.value.creator === undefined) {
      showError('Please fill in all required fields including creator');
      return;
    }
    
    // Prepare the data to send
    const sparkData = {
      name: sparkForm.value.name,
      creator: sparkForm.value.creator || '',  // Empty string for "None" selection
      tiktokLink: sparkForm.value.tiktokLink,
      sparkCode: sparkForm.value.sparkCode,
      type: sparkForm.value.type || 'auto',
      offer: '',  // Default empty offer
      status: sparkForm.value.status || 'active'
    };
    
    // Note: thumbnail will be auto-generated from TikTok link on the server side
    
    if (editingSparkData.value) {
      await sparksApi.updateSpark(editingSparkData.value.id, sparkData);
      showSuccess('Spark updated successfully');
    } else {
      await sparksApi.createSpark(sparkData);
      showSuccess('Spark created successfully');
    }
    showCreateModal.value = false;
    fetchSparks();
  } catch (error) {
    showError('Failed to save spark: ' + (error.message || 'Unknown error'));
  }
};

const deleteSpark = (spark) => {
  // Handle both spark object and spark id
  if (typeof spark === 'string') {
    // If only ID is passed, find the spark object
    sparkToDelete.value = sparks.value.find(s => s.id === spark);
  } else {
    sparkToDelete.value = spark;
  }
  showDeleteModal.value = true;
};

// Inline editing methods
const isEditing = (itemId, field) => {
  return editingCells.value[`${itemId}-${field}`] === true;
};

const startInlineEdit = (item, field) => {
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
    // Map snake_case field names to camelCase for API
    const fieldMapping = {
      'spark_code': 'sparkCode',
      'tiktok_link': 'tiktokLink',
      'offer_name': 'offerName'
    };
    
    // Prepare the update data - use camelCase for API
    const updateData = {
      name: item.name,
      creator: item.creator,
      tiktokLink: item.tiktok_link,  // Map to camelCase
      sparkCode: item.spark_code,     // Map to camelCase
      type: item.type,
      status: item.status,
      offerName: item.offer_name || ''  // Map to camelCase
    };
    
    // Update the specific field being edited (use camelCase if needed)
    const apiField = fieldMapping[field] || field;
    updateData[apiField] = newValue;
    
    // Update the spark
    await sparksApi.updateSpark(item.id, updateData);
    
    // Update local data with the original field name
    item[field] = newValue;
    
    // Clear editing state
    cancelInlineEdit(item.id, field);
    
    showSuccess(`${field.replace('_', ' ')} updated successfully`);
  } catch (error) {
    console.error('Failed to update inline:', error);
    showError('Failed to update field: ' + (error.message || 'Unknown error'));
    cancelInlineEdit(item.id, field);
  }
};

const confirmDelete = async () => {
  if (!sparkToDelete.value) return;
  
  deleteLoading.value = true;
  try {
    await sparksApi.deleteSpark(sparkToDelete.value.id);
    showDeleteModal.value = false;
    showSuccess('Spark deleted successfully');
    fetchSparks();
  } catch (error) {
    showError('Failed to delete spark: ' + (error.message || 'Unknown error'));
  } finally {
    deleteLoading.value = false;
    sparkToDelete.value = null;
  }
};

const cancelDelete = () => {
  showDeleteModal.value = false;
  sparkToDelete.value = null;
};

const bulkAdd = () => {
  // Reset bulk add form
  bulkAddForm.value = {
    baseName: '',
    type: 'auto',
    creator: undefined,
    status: 'active',
    sparkCodes: '',
    tiktokLinks: ''
  };
  bulkAddPreview.value = [];
  showBulkAddModal.value = true;
};

const onTikTokLinksChange = () => {
  // Optional: Could auto-update spark codes if prefix is set
  // But let's keep it manual for now to avoid unexpected changes
};

const previewBulkAdd = () => {
  const tiktokLinks = bulkAddForm.value.tiktokLinks.split('\n').filter(link => link.trim());
  const sparkCodes = bulkAddForm.value.sparkCodes.split('\n').filter(code => code.trim());
  
  if (tiktokLinks.length === 0) {
    showError('Please enter at least one TikTok link');
    return;
  }
  
  // Parse the base name to extract prefix and number
  const baseNameMatch = bulkAddForm.value.baseName.match(/^(.*?)(\d+)$/);
  let namePrefix = bulkAddForm.value.baseName;
  let startNumber = 1;
  
  if (baseNameMatch) {
    namePrefix = baseNameMatch[1];
    startNumber = parseInt(baseNameMatch[2]);
  }
  
  // Auto-generate spark codes if not enough provided
  const maxCount = Math.max(tiktokLinks.length, sparkCodes.length);
  
  bulkAddPreview.value = [];
  for (let i = 0; i < maxCount; i++) {
    const currentNumber = startNumber + i;
    const paddedNumber = baseNameMatch && baseNameMatch[2].length > 1 
      ? currentNumber.toString().padStart(baseNameMatch[2].length, '0')
      : currentNumber.toString();
    
    const name = `${namePrefix}${paddedNumber}`;
    
    // Use provided spark code or auto-generate one
    let sparkCode = sparkCodes[i]?.trim();
    if (!sparkCode) {
      // Auto-generate spark code using name pattern
      sparkCode = `SPARK-${namePrefix.toUpperCase()}${paddedNumber}`;
    }
    
    // Only add if we have a TikTok link for this index
    if (tiktokLinks[i]) {
      bulkAddPreview.value.push({
        name: name,
        tiktokLink: tiktokLinks[i].trim(),
        sparkCode: sparkCode
      });
    }
  }
  
  // Show info about auto-generated codes
  const autoGeneratedCount = bulkAddPreview.value.length - sparkCodes.length;
  if (autoGeneratedCount > 0) {
    showInfo(`Ready to create ${bulkAddPreview.value.length} sparks (${autoGeneratedCount} spark codes auto-generated)`);
  } else {
    showInfo(`Ready to create ${bulkAddPreview.value.length} sparks`);
  }
};

const saveBulkAdd = async () => {
  // Validate required fields
  if (!bulkAddForm.value.baseName || bulkAddForm.value.creator === undefined) {
    showError('Please fill in all required fields');
    return;
  }
  
  const tiktokLinks = bulkAddForm.value.tiktokLinks.split('\n').filter(link => link.trim());
  const sparkCodes = bulkAddForm.value.sparkCodes.split('\n').filter(code => code.trim());
  
  if (tiktokLinks.length === 0) {
    showError('Please enter at least one TikTok link');
    return;
  }
  
  bulkAddLoading.value = true;
  
  // Parse the base name to extract prefix and number
  const baseNameMatch = bulkAddForm.value.baseName.match(/^(.*?)(\d+)$/);
  let namePrefix = bulkAddForm.value.baseName;
  let startNumber = 1;
  
  if (baseNameMatch) {
    namePrefix = baseNameMatch[1];
    startNumber = parseInt(baseNameMatch[2]);
  }
  
  try {
    let successCount = 0;
    let failedCount = 0;
    const errors = [];
    
    // Process each TikTok link
    for (let i = 0; i < tiktokLinks.length; i++) {
      const currentNumber = startNumber + i;
      const paddedNumber = baseNameMatch && baseNameMatch[2].length > 1 
        ? currentNumber.toString().padStart(baseNameMatch[2].length, '0')
        : currentNumber.toString();
      
      const name = `${namePrefix}${paddedNumber}`;
      
      // Use provided spark code or auto-generate one
      let sparkCode = sparkCodes[i]?.trim();
      if (!sparkCode) {
        // Auto-generate spark code using name pattern
        sparkCode = `SPARK-${namePrefix.toUpperCase()}${paddedNumber}`;
      }
      
      const sparkData = {
        name: name,
        creator: bulkAddForm.value.creator || '',
        tiktokLink: tiktokLinks[i].trim(),
        sparkCode: sparkCode,
        type: bulkAddForm.value.type,
        offer: '',  // Default empty offer
        status: bulkAddForm.value.status
      };
      
      try {
        await sparksApi.createSpark(sparkData);
        successCount++;
      } catch (error) {
        console.error(`Failed to create spark ${name}:`, error);
        errors.push(`${name}: ${error.message || 'Unknown error'}`);
        failedCount++;
      }
    }
    
    showBulkAddModal.value = false;
    
    // Show detailed results
    if (failedCount === 0) {
      showSuccess(`Successfully created ${successCount} sparks`);
    } else if (successCount === 0) {
      showError(`Failed to create all sparks. Errors: ${errors.join(', ')}`);
    } else {
      showWarning(`Created ${successCount} sparks, ${failedCount} failed. Check console for details.`);
      console.error('Failed sparks:', errors);
    }
    
    // Refresh the sparks list
    fetchSparks();
  } catch (error) {
    showError('Failed to create sparks: ' + (error.message || 'Unknown error'));
  } finally {
    bulkAddLoading.value = false;
  }
};

const exportToCSV = () => {
  const headers = ['Name', 'Creator', 'Type', 'Status', 'Spark Code', 'Offer', 'Created'];
  const rows = filteredSparks.value.map(spark => [
    spark.name,
    spark.creator || '-',
    spark.type || 'Auto',
    spark.status,
    spark.spark_code,
    spark.offer_name || '-',
    formatDate(spark.created_at)
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sparks_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  
  showSuccess('CSV exported successfully');
};

const markPaid = (paymentId) => {
  showInfo('Mark paid feature coming soon');
};

const markCreatorPaid = async (creatorName) => {
  try {
    // Find all active sparks for this creator
    const creatorSparks = sparks.value.filter(
      spark => spark.creator === creatorName && spark.status === 'active'
    );
    
    // Calculate payment amount with commission
    const customCreator = creators.value.find(c => c.name === creatorName);
    const rate = customCreator?.rate || defaultRate.value;
    const commissionRate = customCreator?.commissionRate || defaultCommissionRate.value;
    const commissionType = customCreator?.commissionType || defaultCommissionType.value;
    
    // Calculate base amount
    const baseAmount = creatorSparks.length * rate;
    
    // Calculate commission
    let commissionAmount = 0;
    if (commissionRate > 0) {
      if (commissionType === 'percentage') {
        commissionAmount = baseAmount * (commissionRate / 100);
      } else if (commissionType === 'fixed') {
        commissionAmount = creatorSparks.length * commissionRate;
      }
    }
    
    const totalAmount = baseAmount + commissionAmount;
    
    // Create payment history record
    const paymentRecord = {
      id: `payment_${Date.now()}`,
      creator: creatorName,
      paymentDate: new Date().toISOString(),
      amount: totalAmount.toFixed(2),
      baseAmount: baseAmount.toFixed(2),
      commissionAmount: commissionAmount.toFixed(2),
      videoCount: creatorSparks.length,
      status: 'paid',
      paymentMethod: 'Manual',
      notes: `Payment for ${creatorSparks.length} videos`,
      videos: creatorSparks.map(spark => ({
        id: spark.id,
        name: spark.name,
        spark_code: spark.spark_code
      }))
    };
    
    // Store undo information
    lastPaymentAction.value = {
      creator: creatorName,
      sparkIds: creatorSparks.map(s => s.id),
      sparks: creatorSparks.map(spark => ({
        ...spark,
        // Store the complete spark data for undo
      })),
      paymentRecord: paymentRecord,
      timestamp: Date.now()
    };
    
    // Show undo button with auto-hide after 30 seconds
    showUndoButton.value = true;
    if (undoTimeoutId.value) {
      clearTimeout(undoTimeoutId.value);
    }
    undoTimeoutId.value = setTimeout(() => {
      showUndoButton.value = false;
      lastPaymentAction.value = null;
    }, 30000); // Hide after 30 seconds
    
    // Save payment to backend
    try {
      await fetch('/api/sparks/record-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          creatorName: creatorName,
          paymentDate: paymentRecord.paymentDate,
          videoCount: paymentRecord.videoCount,
          baseAmount: paymentRecord.baseAmount,
          commissionAmount: paymentRecord.commissionAmount,
          totalAmount: paymentRecord.amount,
          paymentMethod: paymentRecord.paymentMethod,
          notes: paymentRecord.notes,
          sparkIds: creatorSparks.map(s => s.id)
        })
      });
    } catch (error) {
      console.error('Failed to save payment to backend:', error);
    }
    
    // Add to payment history locally
    paymentHistory.value.unshift(paymentRecord);
    
    // Update each spark to completed status
    for (const spark of creatorSparks) {
      // Only send the required fields for update
      const updateData = {
        name: spark.name,
        creator: spark.creator,
        tiktokLink: spark.tiktok_link || spark.tiktokLink,
        sparkCode: spark.spark_code || spark.sparkCode,
        type: spark.type || 'auto',
        offer: spark.offer || '',
        status: 'completed'  // Change status to completed
      };
      
      await sparksApi.updateSpark(spark.id, updateData);
    }
    
    // Don't show success message yet - it's in the undo alert
    
    // Refresh the sparks list
    fetchSparks();
    
    // Update history creator options
    updateHistoryCreatorOptions();
  } catch (error) {
    showError('Failed to mark videos as paid: ' + (error.message || 'Unknown error'));
  }
};

// Undo function
const undoLastPayment = async () => {
  if (!lastPaymentAction.value) {
    showError('No action to undo');
    return;
  }
  
  try {
    // Revert each spark back to active status
    for (const spark of lastPaymentAction.value.sparks) {
      const updateData = {
        name: spark.name,
        creator: spark.creator,
        tiktokLink: spark.tiktok_link || spark.tiktokLink,
        sparkCode: spark.spark_code || spark.sparkCode,
        type: spark.type || 'auto',
        offer: spark.offer || '',
        status: 'active'  // Change back to active
      };
      
      await sparksApi.updateSpark(spark.id, updateData);
    }
    
    // Remove the payment record from history
    const recordIndex = paymentHistory.value.findIndex(
      p => p.id === lastPaymentAction.value.paymentRecord.id
    );
    if (recordIndex > -1) {
      paymentHistory.value.splice(recordIndex, 1);
    }
    
    showSuccess(`Undone payment for ${lastPaymentAction.value.creator} - ${lastPaymentAction.value.sparkIds.length} videos reverted to active`);
    
    // Clear undo state
    showUndoButton.value = false;
    lastPaymentAction.value = null;
    if (undoTimeoutId.value) {
      clearTimeout(undoTimeoutId.value);
      undoTimeoutId.value = null;
    }
    
    // Refresh the sparks list
    fetchSparks();
  } catch (error) {
    showError('Failed to undo payment: ' + (error.message || 'Unknown error'));
  }
};

// Payment History Methods
const filterPaymentHistory = () => {
  // In a real app, this would fetch filtered data from backend
  // For now, we'll filter the existing payment history
  let filtered = [...paymentHistory.value];
  
  if (historyDateFrom.value) {
    filtered = filtered.filter(p => new Date(p.paymentDate) >= new Date(historyDateFrom.value));
  }
  
  if (historyDateTo.value) {
    filtered = filtered.filter(p => new Date(p.paymentDate) <= new Date(historyDateTo.value));
  }
  
  if (historyCreatorFilter.value !== 'all') {
    filtered = filtered.filter(p => p.creator === historyCreatorFilter.value);
  }
  
  // Update the display (in real app, would update paymentHistory)
  showInfo(`Showing ${filtered.length} payment records`);
};

const clearHistoryFilters = () => {
  historyDateFrom.value = '';
  historyDateTo.value = '';
  historyCreatorFilter.value = 'all';
  showInfo('Filters cleared');
};

const showPaymentDetails = (payment) => {
  selectedPayment.value = payment;
  showPaymentDetailsModal.value = true;
};

// Load payment settings from backend
const loadPaymentSettings = async () => {
  try {
    const response = await fetch('/api/sparks/payment-settings', {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (data.success && data.settings) {
      // Load global settings
      const globalSettings = data.settings.find(s => s.setting_type === 'global');
      if (globalSettings) {
        defaultRate.value = globalSettings.base_rate;
        defaultCommissionRate.value = globalSettings.commission_rate;
        defaultCommissionType.value = globalSettings.commission_type;
      }
      
      // Load creator-specific settings
      data.settings
        .filter(s => s.setting_type === 'creator')
        .forEach(setting => {
          const creator = creators.value.find(c => c.name === setting.creator_name);
          if (creator) {
            creator.rate = setting.base_rate;
            creator.commissionRate = setting.commission_rate;
            creator.commissionType = setting.commission_type;
          }
        });
        
      paymentSettingsLoaded.value = true;
    }
  } catch (error) {
    console.error('Failed to load payment settings:', error);
  }
};

// Save payment settings to backend
const savePaymentSettings = async () => {
  isSavingSettings.value = true;
  try {
    // Save global settings
    await fetch('/api/sparks/payment-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        settingType: 'global',
        baseRate: defaultRate.value,
        commissionRate: defaultCommissionRate.value,
        commissionType: defaultCommissionType.value
      })
    });
    
    // Save creator-specific settings
    for (const creator of creators.value) {
      if (creator.rate !== defaultRate.value || 
          creator.commissionRate !== defaultCommissionRate.value ||
          creator.commissionType !== defaultCommissionType.value) {
        await fetch('/api/sparks/payment-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            settingType: 'creator',
            creatorName: creator.name,
            baseRate: creator.rate,
            commissionRate: creator.commissionRate || 0,
            commissionType: creator.commissionType || 'percentage'
          })
        });
      }
    }
    
    showSuccess('Payment settings saved successfully');
    paymentSettingsLoaded.value = true;
  } catch (error) {
    console.error('Failed to save payment settings:', error);
    showError('Failed to save payment settings');
  } finally {
    isSavingSettings.value = false;
  }
};

const exportPaymentHistory = () => {
  const headers = ['Date', 'Creator', 'Videos', 'Amount', 'Status', 'Method', 'Notes'];
  const rows = paymentHistory.value.map(payment => [
    formatDate(payment.paymentDate),
    payment.creator,
    payment.videoCount,
    payment.amount,
    payment.status,
    payment.paymentMethod || 'N/A',
    payment.notes || ''
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payment_history_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  
  showSuccess('Payment history exported successfully');
};

const updateHistoryCreatorOptions = () => {
  const uniqueCreators = new Set();
  
  // Get creators from payment history
  paymentHistory.value.forEach(p => uniqueCreators.add(p.creator));
  
  // Get creators from sparks
  sparks.value.forEach(spark => {
    if (spark.creator) uniqueCreators.add(spark.creator);
  });
  
  historyCreatorOptions.value = [
    { title: 'All Creators', value: 'all' },
    ...Array.from(uniqueCreators).map(creator => ({
      title: creator,
      value: creator
    }))
  ];
};

// Invoice Management Methods
const fetchInvoices = async () => {
  isLoadingInvoices.value = true;
  try {
    const params = new URLSearchParams();
    if (invoiceStatusFilter.value !== 'all') params.append('status', invoiceStatusFilter.value);
    if (invoiceCreatorFilter.value !== 'all') params.append('creator', invoiceCreatorFilter.value);
    if (invoiceDateFrom.value) params.append('dateFrom', invoiceDateFrom.value);
    if (invoiceDateTo.value) params.append('dateTo', invoiceDateTo.value);
    
    const response = await fetch(`/api/sparks/invoices?${params}`, {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (data.success) {
      invoices.value = data.invoices;
      
      // Update creator options
      const creators = new Set();
      data.invoices.forEach(inv => creators.add(inv.creator_name));
      invoiceCreatorOptions.value = [
        { title: 'All Creators', value: 'all' },
        ...Array.from(creators).map(c => ({ title: c, value: c }))
      ];
    }
  } catch (error) {
    console.error('Failed to fetch invoices:', error);
    showError('Failed to load invoices');
  } finally {
    isLoadingInvoices.value = false;
  }
};

const refreshInvoices = () => {
  fetchInvoices();
};

const getInvoiceStatusColor = (status) => {
  const colors = {
    pending: 'warning',
    paid: 'success',
    voided: 'error',
    overdue: 'error'
  };
  return colors[status] || 'grey';
};

const openInvoiceGenerator = async () => {
  // Get current unpaid sparks grouped by creator
  const unpaidByCreator = {};
  
  sparks.value
    .filter(spark => spark.status === 'active' && spark.creator)
    .forEach(spark => {
      if (!unpaidByCreator[spark.creator]) {
        unpaidByCreator[spark.creator] = [];
      }
      unpaidByCreator[spark.creator].push(spark);
    });
  
  if (Object.keys(unpaidByCreator).length === 0) {
    showWarning('No unpaid sparks to invoice');
    return;
  }
  
  // Show dialog to select creator and generate invoice
  // For now, we'll create an invoice for the first creator
  const creator = Object.keys(unpaidByCreator)[0];
  const creatorSparks = unpaidByCreator[creator];
  
  await createInvoiceForCreator(creator, creatorSparks);
};

const createInvoiceForCreator = async (creatorName, creatorSparks) => {
  try {
    // Get payment settings for calculation
    const customCreator = creators.value.find(c => c.name === creatorName);
    const rate = customCreator?.rate || defaultRate.value;
    const commissionRate = customCreator?.commissionRate || defaultCommissionRate.value;
    const commissionType = customCreator?.commissionType || defaultCommissionType.value;
    
    // Calculate amounts
    const subtotal = creatorSparks.length * rate;
    let commissionAmount = 0;
    
    if (commissionRate > 0) {
      if (commissionType === 'percentage') {
        commissionAmount = subtotal * (commissionRate / 100);
      } else {
        commissionAmount = creatorSparks.length * commissionRate;
      }
    }
    
    const lineItems = [{
      description: `Spark Videos (${creatorSparks.length})`,
      quantity: creatorSparks.length,
      rate: rate,
      amount: subtotal
    }];
    
    if (commissionAmount > 0) {
      lineItems.push({
        description: `Commission (${commissionRate}${commissionType === 'percentage' ? '%' : ' fixed'})`,
        quantity: 1,
        rate: commissionAmount,
        amount: commissionAmount
      });
    }
    
    const response = await fetch('/api/sparks/invoices/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        creatorName,
        lineItems,
        subtotal,
        commissionAmount,
        totalAmount: subtotal + commissionAmount,
        notes: `Invoice for ${creatorSparks.length} Spark videos`
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess(`Invoice ${result.invoiceNumber} created successfully`);
      await fetchInvoices();
    } else {
      showError('Failed to create invoice');
    }
  } catch (error) {
    console.error('Failed to create invoice:', error);
    showError('Failed to create invoice');
  }
};

const viewInvoice = (invoice) => {
  // Open invoice HTML in new tab
  window.open(`/api/sparks/invoices/${invoice.id}/pdf`, '_blank');
};

const downloadInvoice = async (invoice) => {
  // Generate and download invoice as PDF
  try {
    // Parse line items
    const lineItems = JSON.parse(invoice.line_items || '[]');
    
    // Create PDF document
    const doc = new jsPDF();
    
    // Set font sizes
    const titleSize = 20;
    const headerSize = 14;
    const normalSize = 11;
    const smallSize = 9;
    
    // Colors
    doc.setTextColor(0, 0, 0);
    
    // Title
    doc.setFontSize(titleSize);
    doc.text('INVOICE', 105, 20, { align: 'center' });
    
    // Invoice details
    doc.setFontSize(normalSize);
    doc.text(`Invoice #: ${invoice.invoice_number}`, 20, 40);
    doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, 20, 47);
    doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 20, 54);
    
    // Status
    doc.setFontSize(smallSize);
    const statusColor = invoice.status === 'paid' ? [0, 128, 0] : 
                       invoice.status === 'voided' ? [255, 0, 0] : [255, 165, 0];
    doc.setTextColor(...statusColor);
    doc.text(`Status: ${invoice.status.toUpperCase()}`, 20, 61);
    doc.setTextColor(0, 0, 0);
    
    // Bill To
    doc.setFontSize(headerSize);
    doc.text('Bill To:', 20, 80);
    doc.setFontSize(normalSize);
    doc.text(invoice.creator_name, 20, 88);
    
    // Line items header
    let yPos = 110;
    doc.setFontSize(headerSize);
    doc.text('Services', 20, yPos);
    
    // Draw line
    doc.setLineWidth(0.5);
    doc.line(20, yPos + 3, 190, yPos + 3);
    
    // Table headers
    yPos += 10;
    doc.setFontSize(smallSize);
    doc.setFont(undefined, 'bold');
    doc.text('Description', 20, yPos);
    doc.text('Qty', 120, yPos);
    doc.text('Rate', 140, yPos);
    doc.text('Amount', 170, yPos);
    doc.setFont(undefined, 'normal');
    
    // Table rows
    yPos += 7;
    doc.setFontSize(normalSize);
    lineItems.forEach((item, index) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.text(item.description || '', 20, yPos);
      doc.text(String(item.quantity || 0), 120, yPos);
      doc.text(`$${(item.rate || 0).toFixed(2)}`, 140, yPos);
      doc.text(`$${(item.amount || 0).toFixed(2)}`, 170, yPos);
      yPos += 7;
    });
    
    // Draw line before totals
    yPos += 5;
    doc.line(120, yPos, 190, yPos);
    
    // Totals
    yPos += 10;
    doc.setFontSize(normalSize);
    
    if (invoice.subtotal !== invoice.total_amount) {
      doc.text('Subtotal:', 140, yPos);
      doc.text(`$${invoice.subtotal.toFixed(2)}`, 170, yPos);
      yPos += 7;
    }
    
    if (invoice.commission_amount > 0) {
      doc.text('Commission:', 140, yPos);
      doc.text(`$${invoice.commission_amount.toFixed(2)}`, 170, yPos);
      yPos += 7;
    }
    
    if (invoice.tax_amount > 0) {
      doc.text('Tax:', 140, yPos);
      doc.text(`$${invoice.tax_amount.toFixed(2)}`, 170, yPos);
      yPos += 7;
    }
    
    if (invoice.discount_amount > 0) {
      doc.text('Discount:', 140, yPos);
      doc.text(`-$${invoice.discount_amount.toFixed(2)}`, 170, yPos);
      yPos += 7;
    }
    
    // Total
    doc.setFont(undefined, 'bold');
    doc.setFontSize(headerSize);
    doc.text('TOTAL:', 140, yPos + 5);
    doc.text(`$${invoice.total_amount.toFixed(2)}`, 170, yPos + 5);
    
    // Notes
    if (invoice.notes) {
      yPos += 20;
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFont(undefined, 'normal');
      doc.setFontSize(smallSize);
      doc.text('Notes:', 20, yPos);
      doc.setFontSize(normalSize);
      const noteLines = doc.splitTextToSize(invoice.notes, 170);
      doc.text(noteLines, 20, yPos + 7);
    }
    
    // Footer
    doc.setFontSize(smallSize);
    doc.setTextColor(128, 128, 128);
    doc.text('Generated by Sparks Invoice System', 105, 280, { align: 'center' });
    doc.text(new Date().toLocaleDateString(), 105, 285, { align: 'center' });
    
    // Save the PDF
    doc.save(`${invoice.invoice_number}.pdf`);
    
    showSuccess('Invoice downloaded as PDF');
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    showError('Failed to generate PDF invoice');
  }
};

const markInvoicePaid = async (invoice) => {
  try {
    const response = await fetch(`/api/sparks/invoices/${invoice.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        status: 'paid',
        paymentData: {
          paymentMethod: 'Manual',
          paymentDate: new Date().toISOString().split('T')[0],
          verifiedBy: user.value?.email
        }
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess('Invoice marked as paid');
      await fetchInvoices();
    } else {
      showError('Failed to update invoice status');
    }
  } catch (error) {
    console.error('Failed to mark invoice as paid:', error);
    showError('Failed to update invoice status');
  }
};

const editInvoice = (invoice) => {
  // Open edit modal
  // This would open a modal to edit invoice details
  showInfo('Invoice editing will be available soon');
};

const voidInvoice = async (invoice) => {
  if (!confirm(`Are you sure you want to void invoice ${invoice.invoice_number}?`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/sparks/invoices/${invoice.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'voided' })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess('Invoice voided successfully');
      await fetchInvoices();
    } else {
      showError('Failed to void invoice');
    }
  } catch (error) {
    console.error('Failed to void invoice:', error);
    showError('Failed to void invoice');
  }
};

const openInvoiceSettings = () => {
  // Open settings modal
  // This would open a modal to configure invoice settings
  showInfo('Invoice settings will be available soon');
};

// Load initial payment history from completed sparks
const loadPaymentHistory = () => {
  // Group completed sparks by creator and approximate payment date
  const completedByCreator = new Map();
  
  sparks.value
    .filter(spark => spark.creator && spark.status === 'completed')
    .forEach(spark => {
      const key = `${spark.creator}_${spark.updated_at?.split('T')[0] || spark.created_at?.split('T')[0]}`;
      if (!completedByCreator.has(key)) {
        completedByCreator.set(key, {
          creator: spark.creator,
          date: spark.updated_at || spark.created_at,
          videos: []
        });
      }
      completedByCreator.get(key).videos.push(spark);
    });
  
  // Create payment records from grouped data
  const historyRecords = Array.from(completedByCreator.values()).map(group => {
    const customCreator = creators.value.find(c => c.name === group.creator);
    const rate = customCreator?.rate || defaultRate.value;
    
    return {
      id: `payment_${group.creator}_${group.date}`,
      creator: group.creator,
      paymentDate: group.date,
      amount: (group.videos.length * rate).toFixed(2),
      videoCount: group.videos.length,
      status: 'paid',
      paymentMethod: 'Manual',
      notes: `Historical payment record`,
      videos: group.videos.map(v => ({
        id: v.id,
        name: v.name,
        spark_code: v.spark_code
      }))
    };
  });
  
  paymentHistory.value = historyRecords.sort((a, b) => 
    new Date(b.paymentDate) - new Date(a.paymentDate)
  );
};

// Helper functions
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

const showInfo = (message) => {
  snackbarText.value = message;
  snackbarColor.value = 'info';
  showSnackbar.value = true;
};

const showWarning = (message) => {
  snackbarText.value = message;
  snackbarColor.value = 'warning';
  showSnackbar.value = true;
};

// Lifecycle
onMounted(async () => {
  // Fetch VAs and templates first, then sparks
  await Promise.all([
    fetchVirtualAssistants(),
    fetchOfferTemplates()
  ]);
  await fetchSparks();
  
  // Load payment settings from backend
  await loadPaymentSettings();
  
  // Load payment history and update creator options
  loadPaymentHistory();
  updateHistoryCreatorOptions();
  
  // Load invoices
  await fetchInvoices();
});
</script>

<style scoped>
.sparks-container {
  padding-top: 20px;
}

.thumbnail-container {
  display: inline-block;
  overflow: hidden;
  border-radius: 4px;
}

.cursor-pointer {
  cursor: pointer;
}

.sparks-table :deep(tbody tr:hover) {
  cursor: pointer;
}

code {
  padding: 2px 6px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.05);
  font-family: monospace;
}

:deep(.v-data-table__th) {
  font-weight: 600 !important;
}

.preview-list {
  max-height: 400px;
  overflow-y: auto;
  background-color: transparent;
}

.preview-list .v-list-item {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding: 12px 0;
}

.preview-list .v-list-item:last-child {
  border-bottom: none;
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
  background-color: rgba(33, 150, 243, 0.08);
}

.v-theme--dark .editable-cell:hover {
  background-color: rgba(33, 150, 243, 0.15);
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
.sparks-table :deep(.v-data-table__td) {
  white-space: nowrap;
  position: relative;
  overflow: visible;
}

/* Performance optimizations */
.sparks-table {
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.v-data-table__wrapper {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.spark-code-truncate {
  max-width: 150px;
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
</style>