<template>
  <v-container fluid class="sparks-container">
    <!-- Tab Navigation -->
    <v-tabs v-model="activeTab" class="mb-4">
      <v-tab value="sparks">Sparks</v-tab>
      <v-tab v-if="!isAssistingUser" value="payments">Payments</v-tab>
      <v-tab v-if="!isAssistingUser" value="history">Payment History</v-tab>
      <v-tab v-if="!isAssistingUser" value="invoices">Invoices</v-tab>
    </v-tabs>

    <!-- Tab Content -->
    <v-window v-model="activeTab">
      <v-window-item value="sparks">
        <SparksTab
          :sparks="sparks"
          :is-loading="isLoading"
          v-model:search-input="searchInput"
          v-model:type-filter="typeFilter"
          v-model:status-filter="statusFilter"
          v-model:creator-filter="creatorFilter"
          v-model:show-thumbnails="showThumbnails"
          :is-bulk-edit-mode="isBulkEditMode"
          :is-saving-bulk="isSavingBulk"
          :is-comment-bot-mode="isCommentBotMode"
          :is-processing-bot="isProcessingBot"
          v-model:items-per-page="itemsPerPage"
          v-model:current-page="currentPage"
          :headers="headers"
          :filtered-sparks="filteredSparks"
          :editing-cells="editingCells"
          :editing-values="editingValues"
          :menu-states="menuStates"
          :bulk-edit-values="bulkEditValues"
          :comment-bot-settings="commentBotSettings"
          v-model:selected-for-bot="selectedForBot"
          :comment-groups="commentGroups"
          :type-options="typeOptions"
          :status-options="statusOptions"
          :creator-options="creatorOptions"
          :virtual-assistants="virtualAssistants"
          :type-items="typeItems"
          :default-thumbnail="defaultThumbnail"
          :duplicate-info="duplicateInfo"
          :has-comment-bot-access="hasCommentBotAccess"
          :user-credits="userCredits"
          @clear-filters="clearFilters"
          @start-bulk-edit="startBulkEdit"
          @save-bulk-edit="saveBulkEdit"
          @cancel-bulk-edit="cancelBulkEdit"
          @start-comment-bot="startCommentBotMode"
          @execute-comment-bot="executeCommentBot"
          @cancel-comment-bot="cancelCommentBotMode"
          @toggle-bot-selection="toggleBotSelection"
          @update-comment-bot-settings="commentBotSettings = $event"
          @export-to-csv="exportToCSV"
          @open-create-modal="openCreateModal"
          @bulk-add="bulkAdd"
          @show-large-preview="showLargePreview"
          @handle-image-error="handleImageError"
          @start-inline-edit="startInlineEdit"
          @save-inline-edit="saveInlineEdit"
          @cancel-inline-edit="cancelInlineEdit"
          @copy-code="copyCode"
          @edit-spark="editSpark"
          @delete-spark="deleteSpark"
          @show-batch-update-success="handleBatchUpdateSuccess"
          @show-batch-update-warning="showWarning"
          @apply-batch-updates="applyBatchUpdates"
          @remove-duplicates="removeDuplicates"
          @delete-selected="deleteSelected"
        />
      </v-window-item>

      <!-- Payments Tab Content -->
      <v-window-item value="payments">
        <PaymentsTab
          v-model:show-undo-button="showUndoButton"
          :last-payment-action="lastPaymentAction"
          :total-owed="totalOwed"
          :total-paid="totalPaid"
          :unpaid-sparks="unpaidSparks"
          :active-creators="activeCreators"
          v-model:default-rate="defaultRate"
          v-model:default-commission-rate="defaultCommissionRate"
          v-model:default-commission-type="defaultCommissionType"
          :is-saving-settings="isSavingSettings"
          :creators="creators"
          :payments-by-creator="paymentsByCreator"
          @undo-last-payment="undoLastPayment"
          @save-payment-settings="savePaymentSettings"
          @mark-creator-paid="markCreatorPaid"
        />
      </v-window-item>

      <!-- Payment History Tab Content -->
      <v-window-item value="history">
        <PaymentHistoryTab
          v-model:history-date-from="historyDateFrom"
          v-model:history-date-to="historyDateTo"
          v-model:history-creator-filter="historyCreatorFilter"
          :history-creator-options="historyCreatorOptions"
          :total-paid-in-period="totalPaidInPeriod"
          :total-payments="totalPayments"
          :total-videos-paid="totalVideosPaid"
          :payment-history-headers="paymentHistoryHeaders"
          :payment-history="paymentHistory"
          :items-per-page="itemsPerPage"
          :is-loading-history="isLoadingHistory"
          @filter-payment-history="filterPaymentHistory"
          @clear-history-filters="clearHistoryFilters"
          @export-payment-history="exportPaymentHistory"
          @show-payment-details="showPaymentDetails"
        />
      </v-window-item>

      <!-- Invoices Tab Content -->
      <v-window-item value="invoices">
        <InvoicesTab
          v-model:invoice-status-filter="invoiceStatusFilter"
          v-model:invoice-creator-filter="invoiceCreatorFilter"
          v-model:invoice-date-from="invoiceDateFrom"
          v-model:invoice-date-to="invoiceDateTo"
          :invoice-status-options="invoiceStatusOptions"
          :invoice-creator-options="invoiceCreatorOptions"
          :total-invoices="totalInvoices"
          :total-invoiced="totalInvoiced"
          :pending-invoices="pendingInvoices"
          :paid-invoices="paidInvoices"
          :invoice-headers="invoiceHeaders"
          :invoices="invoices"
          :is-loading-invoices="isLoadingInvoices"
          @open-invoice-generator="openInvoiceGenerator"
          @open-invoice-settings="openInvoiceSettings"
          @refresh-invoices="refreshInvoices"
          @view-invoice="viewInvoice"
          @download-invoice="downloadInvoice"
          @mark-invoice-paid="markInvoicePaid"
          @edit-invoice="editInvoice"
          @void-invoice="voidInvoice"
        />
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
                  @update:model-value="sparkForm.name = generateDefaultName($event, sparkForm.type)"
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
                <v-text-field
                  v-model="sparkForm.type"
                  label="Type"
                  variant="outlined"
                  density="compact"
                  clearable
                  hint="Enter a type for this spark"
                  persistent-hint
                  @update:model-value="sparkForm.name = generateDefaultName(sparkForm.creator, $event)"
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
                    { title: 'Testing', value: 'testing' },
                    { title: 'Untested', value: 'untested' },
                    { title: 'Blocked', value: 'blocked' }
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
              @input="autoPreviewBulkAdd"
            />
            
            <v-row>
              <!-- Type and Creator Selection -->
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="bulkAddForm.type"
                  label="Type"
                  variant="outlined"
                  density="compact"
                  clearable
                  hint="Enter a type for these sparks"
                  persistent-hint
                  class="mb-4"
                  @update:model-value="bulkAddForm.baseName = generateDefaultName(bulkAddForm.creator, $event)"
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
                  @update:model-value="bulkAddForm.baseName = generateDefaultName($event, bulkAddForm.type)"
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
                    { title: 'Testing', value: 'testing' },
                    { title: 'Untested', value: 'untested' },
                    { title: 'Blocked', value: 'blocked' }
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
                  @input="autoPreviewBulkAdd"
                />
              </v-col>

              <!-- Spark Codes Textarea (RIGHT) -->
              <v-col cols="12" md="6">
                <v-textarea
                  v-model="bulkAddForm.sparkCodes"
                  label="Spark Codes (one per line - Required)"
                  variant="outlined"
                  density="compact"
                  rows="8"
                  hint="Required: Must have one spark code for each TikTok link"
                  placeholder="SC001&#10;SC002&#10;SC003"
                  @input="autoPreviewBulkAdd"
                />
              </v-col>
            </v-row>

            <!-- Comment Bot Section -->
            <v-expansion-panels v-if="hasCommentBotAccess" class="mb-4">
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-row align="center" no-gutters>
                    <v-col cols="auto" class="mr-3">
                      <v-checkbox
                        v-model="bulkAddForm.enableCommentBot"
                        @click.stop
                        hide-details
                        density="compact"
                      />
                    </v-col>
                    <v-col>
                      <div class="d-flex align-center">
                        <v-icon class="mr-2">mdi-robot</v-icon>
                        <span>Enable Comment Bot for these sparks</span>
                        <v-chip v-if="bulkAddForm.enableCommentBot" class="ml-3" size="small" color="primary">
                          Cost: {{ bulkAddPreview.length || 0 }} credits
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
                        <strong>Total Cost:</strong> {{ bulkAddPreview.length || 0 }} credits
                      </div>
                    </div>
                  </v-alert>

                  <v-row>
                    <v-col cols="12">
                      <v-select
                        v-model="bulkAddForm.commentGroupId"
                        :items="commentGroups"
                        item-title="name"
                        item-value="id"
                        label="Comment Group *"
                        variant="outlined"
                        density="compact"
                        :rules="bulkAddForm.enableCommentBot ? [v => !!v || 'Comment group is required'] : []"
                        clearable
                      />
                    </v-col>
                  </v-row>

                  <v-row>
                    <v-col cols="12" md="6">
                      <v-text-field
                        v-model.number="bulkAddForm.likeCount"
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
                        v-model.number="bulkAddForm.saveCount"
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
                    v-if="bulkAddPreview.length > 0"
                    type="success"
                    variant="tonal"
                    density="compact"
                  >
                    <strong>Total engagement:</strong>
                    {{ bulkAddPreview.length * (bulkAddForm.likeCount || 0) }} likes,
                    {{ bulkAddPreview.length * (bulkAddForm.saveCount || 0) }} saves
                  </v-alert>

                  <v-alert
                    v-if="bulkAddForm.enableCommentBot && bulkAddPreview.length > userCredits"
                    type="warning"
                    variant="tonal"
                    density="compact"
                    class="mt-2"
                  >
                    <v-icon size="small" class="mr-1">mdi-alert</v-icon>
                    Insufficient credits! You need {{ bulkAddPreview.length }} credits but only have {{ userCredits }}.
                  </v-alert>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

            <!-- Preview Section -->
            <v-card
              v-if="bulkAddPreview.length > 0 || bulkAddValidationMessage"
              class="mt-4"
              variant="tonal"
              :color="bulkAddPreview.length > 0 ? 'info' : 'warning'"
            >
              <v-card-title class="text-h6">
                <template v-if="bulkAddPreview.length > 0">
                  Preview: {{ bulkAddPreview.length }} spark(s) ready to create
                  <v-chip v-if="bulkAddForm.enableCommentBot" class="ml-2" size="small" color="primary" variant="flat">
                    <v-icon start size="small">mdi-robot</v-icon>
                    With Comment Bot
                  </v-chip>
                </template>
                <template v-else>
                  Validation Required
                </template>
              </v-card-title>
              <v-card-text>
                <!-- Comment Bot Preview Alert -->
                <v-alert
                  v-if="bulkAddForm.enableCommentBot && bulkAddPreview.length > 0"
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
                    <div>• Comment Group: {{ commentGroups.find(g => g.id === bulkAddForm.commentGroupId)?.name || 'Not selected' }}</div>
                    <div>• Likes per spark: {{ bulkAddForm.likeCount || 0 }}</div>
                    <div>• Saves per spark: {{ bulkAddForm.saveCount || 0 }}</div>
                    <div>• Total cost: {{ bulkAddPreview.length }} credits</div>
                    <div class="mt-1 font-weight-medium">
                      Total engagement: {{ bulkAddPreview.length * (bulkAddForm.likeCount || 0) }} likes, {{ bulkAddPreview.length * (bulkAddForm.saveCount || 0) }} saves
                    </div>
                  </div>
                </v-alert>
                <!-- Validation message -->
                <v-alert
                  v-if="bulkAddValidationMessage && bulkAddPreview.length === 0"
                  type="warning"
                  variant="tonal"
                  density="compact"
                  class="mb-0"
                >
                  {{ bulkAddValidationMessage }}
                </v-alert>
                <v-list v-if="bulkAddPreview.length > 0" density="compact" class="preview-list">
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
          <v-btn
            color="primary"
            variant="elevated"
            @click="saveBulkAdd"
            :disabled="bulkAddPreview.length === 0 || bulkAddLoading"
            :loading="bulkAddLoading"
          >
            Create {{ bulkAddPreview.length }} Spark{{ bulkAddPreview.length === 1 ? '' : 's' }}
          </v-btn>
          <v-btn variant="text" @click="showBulkAddModal = false">Cancel</v-btn>
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

    <!-- Delete Selected Confirmation Modal -->
    <v-dialog v-model="showDeleteSelectedModal" max-width="500">
      <v-card>
        <v-card-title class="text-h6">
          <v-icon color="error" class="mr-2">mdi-alert-circle</v-icon>
          Confirm Bulk Delete
        </v-card-title>
        <v-card-text>
          <p class="text-body-1 mb-3">
            Are you sure you want to delete <strong>{{ selectedForDelete.length }}</strong> selected spark{{ selectedForDelete.length !== 1 ? 's' : '' }}?
          </p>
          <v-alert type="warning" variant="tonal" density="compact">
            <v-icon size="small" class="mr-1">mdi-alert</v-icon>
            This action cannot be undone. All selected sparks will be permanently deleted.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="showDeleteSelectedModal = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            variant="elevated"
            @click="confirmDeleteSelected"
            :loading="isDeletingSelected"
          >
            <v-icon start>mdi-delete-sweep</v-icon>
            Delete {{ selectedForDelete.length }} Spark{{ selectedForDelete.length !== 1 ? 's' : '' }}
          </v-btn>
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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { sparksApi, templatesApi, usersApi, commentBotApi } from '@/services/api';
import { useAuth } from '@/composables/useAuth';
import jsPDF from 'jspdf';

// Import tab components
import SparksTab from './components/SparksTab.vue';
import PaymentsTab from './components/PaymentsTab.vue';
import PaymentHistoryTab from './components/PaymentHistoryTab.vue';
import InvoicesTab from './components/InvoicesTab.vue';

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

// Bulk edit mode state
const isBulkEditMode = ref(false);
const bulkEditValues = ref({});
const isSavingBulk = ref(false);

// Comment Bot bulk mode state
const isCommentBotMode = ref(false);
const isProcessingBot = ref(false);
const commentBotSettings = ref({
  comment_group_id: null,
  like_count: 0,
  save_count: 0
});
const selectedForBot = ref([]);

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
const statusFilter = ref('all');  // Default to all statuses
const creatorFilter = ref('all');

// Table configuration
const itemsPerPage = ref(200); // Default to 200 items per page for bulk editing
const currentPage = ref(1);
const showThumbnails = ref(true); // Toggle for showing thumbnail column

// Modal state
const showPreview = ref(false);
const previewSpark = ref(null);
const showCreateModal = ref(false);
const editingSparkData = ref(null);
const showBulkAddModal = ref(false);

// Comment Bot state
const commentGroups = ref([]);
const hasCommentBotAccess = ref(false);
const userCredits = ref(0);
const showDeleteModal = ref(false);
const sparkToDelete = ref(null);
const deleteLoading = ref(false);
const showDeleteSelectedModal = ref(false);
const selectedForDelete = ref([]);
const isDeletingSelected = ref(false);

// Form state
const sparkForm = ref({
  name: '',
  creator: isAssistingUser.value && user.value?.originalEmail ? user.value.originalEmail : undefined,  // Auto-select VA's own email if logged in as VA
  tiktokLink: '',
  sparkCode: '',
  type: 'auto',
  status: 'untested'
});

// Bulk Add Form state
const bulkAddForm = ref({
  baseName: '',
  type: 'auto',
  creator: isAssistingUser.value && user.value?.originalEmail ? user.value.originalEmail : undefined,  // Auto-select VA's own email if logged in as VA
  status: 'untested',
  sparkCodes: '',
  tiktokLinks: '',
  // Comment Bot fields
  enableCommentBot: false,
  commentGroupId: null,
  likeCount: 0,
  saveCount: 0
});

const bulkAddPreview = ref([]);
const bulkAddValidationMessage = ref('');
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

// Base table headers
const baseHeaders = [
  { title: 'Date', key: 'created_at' },
  { title: 'Preview', key: 'thumbnail', sortable: false, width: '120px' },
  { title: 'TikTok Link', key: 'tiktok_link', sortable: false },
  { title: 'Spark Code', key: 'spark_code' },
  { title: 'Status', key: 'status' },
  { title: 'Bot Status', key: 'bot_status', sortable: true, width: '120px', align: 'center' },
  { title: 'Type', key: 'type' },
  { title: 'Creator', key: 'creator' },
  { title: 'Name', key: 'name' },
  { title: 'Actions', key: 'actions', sortable: false }
];

// Computed headers based on showThumbnails toggle and bulk edit mode
const headers = computed(() => {
  let headers = baseHeaders;
  
  // Hide thumbnail if toggle is off
  if (!showThumbnails.value) {
    headers = headers.filter(h => h.key !== 'thumbnail');
  }
  
  // Hide only Actions column in bulk edit mode (keep TikTok link editable)
  if (isBulkEditMode.value) {
    headers = headers.filter(h => h.key !== 'actions');
    // Adjust column widths in bulk edit mode
    headers = headers.map(h => {
      if (h.key === 'spark_code') {
        return { ...h, width: '200px' };
      }
      if (h.key === 'tiktok_link') {
        return { ...h, width: '250px' };
      }
      return h;
    });
  }
  
  return headers;
});

// Common type items for combobox (without 'All Types' option)
const typeItems = ref(['CPI', 'Sweeps', 'Cash', 'PayPal', 'Auto', 'Home']);

// Options for filters (includes 'All Types')
const typeOptions = ref([
  { title: 'All Types', value: 'all' },
  { title: 'CPI', value: 'CPI' },
  { title: 'Sweeps', value: 'Sweeps' },
  { title: 'Cash', value: 'Cash' },
  { title: 'PayPal', value: 'PayPal' },
  { title: 'Auto', value: 'Auto' },
  { title: 'Home', value: 'Home' }
]);

const statusOptions = ref([
  { title: 'All Status', value: 'all' },
  { title: 'Active', value: 'active' },
  { title: 'Testing', value: 'testing' },
  { title: 'Untested', value: 'untested' },
  { title: 'Blocked', value: 'blocked' }
]);

const creatorOptions = ref([
  { title: 'All Creators', value: 'all' }
]);

// Default thumbnail
const defaultThumbnail = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjRTBFMEUwIi8+CjxwYXRoIGQ9Ik0yNSAxOEwyOSAyNUwyNSAzMkwyMSAyNVoiIGZpbGw9IiM5RTlFOUUiLz4KPC9zdmc+';

// Computed property for duplicate detection
const duplicateInfo = computed(() => {
  const linkMap = new Map();
  const codeMap = new Map();
  const duplicateIds = new Set();
  const duplicateErrors = [];
  
  // Check for duplicates in all sparks
  sparks.value.forEach(spark => {
    // Check for duplicate TikTok links
    if (spark.tiktok_link) {
      if (linkMap.has(spark.tiktok_link)) {
        const existingIds = linkMap.get(spark.tiktok_link);
        existingIds.push(spark.id);
        // Mark all instances as duplicates
        existingIds.forEach(id => duplicateIds.add(id));
      } else {
        linkMap.set(spark.tiktok_link, [spark.id]);
      }
    }
    
    // Check for duplicate spark codes
    if (spark.spark_code) {
      if (codeMap.has(spark.spark_code)) {
        const existingIds = codeMap.get(spark.spark_code);
        existingIds.push(spark.id);
        // Mark all instances as duplicates
        existingIds.forEach(id => duplicateIds.add(id));
      } else {
        codeMap.set(spark.spark_code, [spark.id]);
      }
    }
  });
  
  // Generate error messages
  linkMap.forEach((ids, link) => {
    if (ids.length > 1) {
      duplicateErrors.push(`Duplicate TikTok link found: ${link} (${ids.length} occurrences)`);
    }
  });
  
  codeMap.forEach((ids, code) => {
    if (ids.length > 1) {
      duplicateErrors.push(`Duplicate spark code found: ${code} (${ids.length} occurrences)`);
    }
  });
  
  return {
    duplicateIds,
    duplicateErrors,
    linkDuplicates: linkMap,
    codeDuplicates: codeMap
  };
});

// Computed properties
const filteredSparks = computed(() => {
  let filtered = sparks.value;

  // Apply filters only if needed to avoid unnecessary iterations
  if (typeFilter.value !== 'all' || statusFilter.value !== 'all' ||
      creatorFilter.value !== 'all' || searchQuery.value) {
    
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

  // Add duplicate flag to each spark
  return filtered.map(spark => ({
    ...spark,
    isDuplicate: duplicateInfo.value.duplicateIds.has(spark.id)
  }));
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
      // Process sparks but don't freeze yet - we need to update bot statuses
      const processedSparks = response.sparks.map(spark => ({
        ...spark,
        type: spark.type || 'auto',
        creator: spark.creator || 'None'  // Show "None" instead of "Unknown"
      }));

      // Get active orders from comment bot to update statuses
      try {
        const ordersResponse = await commentBotApi.getOrders();

        if (ordersResponse && ordersResponse.orders) {
          // Create a map of post_id to order status for quick lookup
          const orderStatusMap = {};
          ordersResponse.orders.forEach(order => {
            if (order.post_id) {
              orderStatusMap[order.post_id] = order.status || 'processing';
            }
          });

          // Update spark statuses based on matching post IDs
          processedSparks.forEach(spark => {
            if (spark.bot_post_id && orderStatusMap[spark.bot_post_id]) {
              spark.bot_status = orderStatusMap[spark.bot_post_id];
            } else if (spark.bot_post_id && !orderStatusMap[spark.bot_post_id]) {
              // Has a post ID but no matching order - likely completed or expired
              if (spark.bot_status === 'queued' || spark.bot_status === 'processing' || spark.bot_status === 'pending') {
                spark.bot_status = 'completed';
              }
            }
          });
        }
      } catch (error) {
        console.error('Failed to fetch comment bot orders:', error);
      }

      // Now freeze the sparks array
      sparks.value = Object.freeze(processedSparks);

      // Update type options dynamically based on actual types in data
      const uniqueTypes = [...new Set(sparks.value.map(s => s.type).filter(t => t))];

      // Update typeItems to include any new custom types
      const existingTypeItems = new Set(typeItems.value);
      uniqueTypes.forEach(type => {
        if (!existingTypeItems.has(type)) {
          typeItems.value.push(type);
        }
      });
      
      // Update typeOptions for the filter dropdown
      typeOptions.value = [
        { title: 'All Types', value: 'all' },
        ...uniqueTypes.sort().map(t => ({ 
          title: t.charAt(0).toUpperCase() + t.slice(1), 
          value: t 
        }))
      ];
      
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
  showThumbnails.value = true;
  currentPage.value = 1;
};

const getTypeColor = (type) => {
  const lowerType = (type || 'Auto').toLowerCase();
  switch (lowerType) {
    case 'cpi':
      return 'blue';
    case 'sweeps':
      return 'purple';
    case 'cash':
      return 'green';
    case 'paypal':
      return 'orange';
    case 'auto':
      return 'indigo';
    case 'home':
      return 'teal';
    default:
      return 'grey';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'testing':
      return 'warning';
    case 'blocked':
      return 'error';
    default:
      return 'grey';
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'active':
      return 'Active';
    case 'testing':
      return 'Testing';
    case 'blocked':
      return 'Blocked';
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

// Helper function to generate default name
const generateDefaultName = (creator, type) => {
  // Remove @domain.com from creator email
  const creatorName = creator ? creator.replace(/@.*\.com$/i, '') : 'unknown';

  // Get current date in YYMMDD format
  const date = new Date();
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // Generate name: creator-date-type-
  return `${creatorName}-${dateStr}-${type}-`;
};

const openCreateModal = () => {
  editingSparkData.value = null;
  const creator = isAssistingUser.value && user.value?.originalEmail ? user.value.originalEmail : undefined;
  const type = 'auto';

  sparkForm.value = {
    name: generateDefaultName(creator, type),
    creator: creator,  // Auto-select VA's own email if logged in as VA
    tiktokLink: '',
    sparkCode: '',
    type: type,
    status: 'untested'
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
    status: spark.status || 'untested'
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
      status: sparkForm.value.status || 'untested'
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

const removeDuplicates = async () => {
  try {
    isLoading.value = true;

    // Create a map to track unique entries and keep the latest one
    const uniqueMap = new Map();
    const duplicateIds = [];

    // Process sparks in reverse order (keeping the last added)
    const reversedSparks = [...sparks.value].reverse();

    for (const spark of reversedSparks) {
      // Create unique keys for each type of duplicate
      const tiktokKey = spark.tiktok_link ? `tiktok:${spark.tiktok_link}` : null;
      const sparkCodeKey = spark.spark_code ? `code:${spark.spark_code}` : null;

      // Check if TikTok link already exists
      if (tiktokKey && uniqueMap.has(tiktokKey)) {
        duplicateIds.push(spark.id);
        continue;
      }

      // Check if spark code already exists
      if (sparkCodeKey && uniqueMap.has(sparkCodeKey)) {
        duplicateIds.push(spark.id);
        continue;
      }

      // Mark as seen
      if (tiktokKey) uniqueMap.set(tiktokKey, spark.id);
      if (sparkCodeKey) uniqueMap.set(sparkCodeKey, spark.id);
    }

    // Delete duplicates from database
    let deletedCount = 0;
    for (const id of duplicateIds) {
      try {
        await sparksApi.deleteSpark(id);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete duplicate spark ${id}:`, error);
      }
    }

    // Refresh sparks list
    await fetchSparks();

    if (deletedCount > 0) {
      showSuccess(`Removed ${deletedCount} duplicate spark${deletedCount > 1 ? 's' : ''}`);
    } else {
      showInfo('No duplicates found to remove');
    }

  } catch (error) {
    console.error('Error removing duplicates:', error);
    showError('Failed to remove duplicates');
  } finally {
    isLoading.value = false;
  }
};

const deleteSelected = async (selectedSparks) => {
  if (!selectedSparks || selectedSparks.length === 0) {
    showWarning('No sparks selected for deletion');
    return;
  }

  // Store selected sparks and show modal
  selectedForDelete.value = selectedSparks;
  showDeleteSelectedModal.value = true;
};

const confirmDeleteSelected = async () => {
  try {
    isDeletingSelected.value = true;
    let deletedCount = 0;
    let failedCount = 0;

    // Delete each selected spark
    for (const spark of selectedForDelete.value) {
      try {
        await sparksApi.deleteSpark(spark.id);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete spark ${spark.name || spark.id}:`, error);
        failedCount++;
      }
    }

    // Close modal
    showDeleteSelectedModal.value = false;
    selectedForDelete.value = [];

    // Exit bulk edit mode
    cancelBulkEdit();

    // Refresh sparks list
    await fetchSparks();

    // Show results
    if (failedCount > 0) {
      showWarning(`Deleted ${deletedCount} spark${deletedCount !== 1 ? 's' : ''}, ${failedCount} failed`);
    } else {
      showSuccess(`Successfully deleted ${deletedCount} spark${deletedCount !== 1 ? 's' : ''}`);
    }

  } catch (error) {
    console.error('Error deleting selected sparks:', error);
    showError('Failed to delete selected sparks');
  } finally {
    isDeletingSelected.value = false;
  }
};

// Inline editing methods
const isEditing = (itemId, field) => {
  return editingCells.value[`${itemId}-${field}`] === true;
};

const startInlineEdit = (item, field) => {
  // Get the current item from the sparks array to ensure we have the latest data
  const currentItem = sparks.value.find(s => s.id === item.id) || item;
  
  // Set the editing state
  const key = `${currentItem.id}-${field}`;
  editingCells.value[key] = true;
  editingValues.value[key] = currentItem[field];
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
    // Only include defined values to avoid sending undefined
    const updateData = {};

    // Always include these fields if they exist
    if (item.name !== undefined) updateData.name = item.name;
    if (item.creator !== undefined) updateData.creator = item.creator;
    if (item.tiktok_link !== undefined) updateData.tiktokLink = item.tiktok_link;
    if (item.spark_code !== undefined) updateData.sparkCode = item.spark_code;
    if (item.type !== undefined) updateData.type = item.type;
    if (item.status !== undefined) updateData.status = item.status;
    if (item.offer_name !== undefined) updateData.offerName = item.offer_name;
    
    // Update the specific field being edited (use camelCase if needed)
    const apiField = fieldMapping[field] || field;
    updateData[apiField] = newValue;

    // Debug log to see what we're sending
    console.log('Updating spark with data:', updateData);
    console.log('Item data:', item);

    // Update the spark
    const response = await sparksApi.updateSpark(item.id, updateData);
    
    if (response.success) {
      // Clear editing state
      cancelInlineEdit(item.id, field);
      
      showSuccess(`${field.replace('_', ' ')} updated successfully`);
      
      // Refresh the sparks data to ensure we have the latest data
      await fetchSparks();
    }
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
  const creator = isAssistingUser.value && user.value?.originalEmail ? user.value.originalEmail : undefined;
  const type = 'auto';

  bulkAddForm.value = {
    baseName: generateDefaultName(creator, type),
    type: type,
    creator: creator,  // Auto-select VA's own email if logged in as VA
    status: 'untested',
    sparkCodes: '',
    tiktokLinks: '',
    // Reset Comment Bot fields
    enableCommentBot: false,
    commentGroupId: null,
    likeCount: 0,
    saveCount: 0
  };
  bulkAddPreview.value = [];
  bulkAddValidationMessage.value = '';
  showBulkAddModal.value = true;
};

// Auto preview function for bulk add
const autoPreviewBulkAdd = () => {
  const tiktokLinks = bulkAddForm.value.tiktokLinks.split('\n').filter(link => link.trim());
  const sparkCodes = bulkAddForm.value.sparkCodes.split('\n').filter(code => code.trim());

  // Clear preview and validation if no TikTok links
  if (tiktokLinks.length === 0) {
    bulkAddPreview.value = [];
    bulkAddValidationMessage.value = '';
    return;
  }

  // Check if spark codes match TikTok links count
  if (sparkCodes.length !== tiktokLinks.length) {
    bulkAddPreview.value = [];
    bulkAddValidationMessage.value = `Spark codes (${sparkCodes.length}) must match TikTok links (${tiktokLinks.length})`;
    return;
  }

  // Clear validation message and proceed with preview
  bulkAddValidationMessage.value = '';
  previewBulkAdd();
};

const previewBulkAdd = () => {
  const tiktokLinks = bulkAddForm.value.tiktokLinks.split('\n').filter(link => link.trim());
  const sparkCodes = bulkAddForm.value.sparkCodes.split('\n').filter(code => code.trim());

  if (tiktokLinks.length === 0 || sparkCodes.length !== tiktokLinks.length) {
    bulkAddPreview.value = [];
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

  // Create preview with matching spark codes
  bulkAddPreview.value = [];
  for (let i = 0; i < tiktokLinks.length; i++) {
    const currentNumber = startNumber + i;
    const paddedNumber = baseNameMatch && baseNameMatch[2].length > 1
      ? currentNumber.toString().padStart(baseNameMatch[2].length, '0')
      : currentNumber.toString();

    const name = `${namePrefix}${paddedNumber}`;

    bulkAddPreview.value.push({
      name: name,
      tiktokLink: tiktokLinks[i].trim(),
      sparkCode: sparkCodes[i].trim()
    });
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

  // Validate that spark codes match TikTok links
  if (sparkCodes.length !== tiktokLinks.length) {
    showError(`Number of spark codes (${sparkCodes.length}) must match number of TikTok links (${tiktokLinks.length})`);
    return;
  }

  // Validate comment bot settings if enabled
  if (bulkAddForm.value.enableCommentBot) {
    if (!bulkAddForm.value.commentGroupId) {
      showError('Please select a comment group for Comment Bot');
      return;
    }

    // Check if user has enough credits
    if (tiktokLinks.length > userCredits.value) {
      showError(`Insufficient credits! You need ${tiktokLinks.length} credits but only have ${userCredits.value}`);
      return;
    }
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
    let botOrderSuccessCount = 0;
    let botOrderFailedCount = 0;
    const errors = [];
    const createdSparks = [];

    // Process each TikTok link
    for (let i = 0; i < tiktokLinks.length; i++) {
      const currentNumber = startNumber + i;
      const paddedNumber = baseNameMatch && baseNameMatch[2].length > 1
        ? currentNumber.toString().padStart(baseNameMatch[2].length, '0')
        : currentNumber.toString();

      const name = `${namePrefix}${paddedNumber}`;

      // Use the corresponding spark code (already validated to exist)
      const sparkCode = sparkCodes[i].trim();
      const tiktokLink = tiktokLinks[i].trim();

      const sparkData = {
        name: name,
        creator: bulkAddForm.value.creator || '',
        tiktokLink: tiktokLink,
        sparkCode: sparkCode,
        type: bulkAddForm.value.type,
        offer: '',  // Default empty offer
        status: bulkAddForm.value.status,
        bot_status: bulkAddForm.value.enableCommentBot ? 'queued' : 'not_botted'
      };

      try {
        const createdSpark = await sparksApi.createSpark(sparkData);
        successCount++;

        // The API response should contain the created spark with its ID
        const sparkId = createdSpark.id || createdSpark.spark?.id || createdSpark.data?.id;

        if (!sparkId) {
          console.warn(`Created spark ${name} but no ID returned in response:`, createdSpark);
        }

        createdSparks.push({ ...createdSpark, tiktok_link: tiktokLink });

        // If Comment Bot is enabled, create an order for this spark
        if (bulkAddForm.value.enableCommentBot && sparkId) {
          const postId = extractPostIdFromTikTokLink(tiktokLink);
          if (postId) {
            try {
              const orderData = {
                post_id: postId,
                comment_group_id: bulkAddForm.value.commentGroupId,
                like_count: Math.min(bulkAddForm.value.likeCount || 0, 3000),
                save_count: Math.min(bulkAddForm.value.saveCount || 0, 500)
              };

              console.log(`Creating Comment Bot order for ${name}:`, orderData);
              await commentBotApi.createOrder(orderData);
              botOrderSuccessCount++;

              // Update spark to processing status with bot_post_id
              try {
                const updateData = {
                  name: name,
                  creator: bulkAddForm.value.creator || '',
                  tiktokLink: tiktokLink,
                  sparkCode: sparkCode,
                  type: bulkAddForm.value.type,
                  status: bulkAddForm.value.status,
                  offerName: '',
                  bot_post_id: postId,
                  bot_status: 'processing'
                };
                await sparksApi.updateSpark(sparkId, updateData);
              } catch (updateError) {
                console.error(`Failed to update bot status for ${name}:`, updateError);
              }
            } catch (botError) {
              console.error(`Failed to create Comment Bot order for ${name}:`, botError);
              botOrderFailedCount++;

              // Update spark to failed status
              if (sparkId) {
                try {
                  const updateData = {
                    name: name,
                    creator: bulkAddForm.value.creator || '',
                    tiktokLink: tiktokLink,
                    sparkCode: sparkCode,
                    type: bulkAddForm.value.type,
                    status: bulkAddForm.value.status,
                    offerName: '',
                    bot_status: 'failed'
                  };
                  await sparksApi.updateSpark(sparkId, updateData);
                } catch (updateError) {
                  console.error(`Failed to update bot status for ${name}:`, updateError);
                }
              }
            }
          } else {
            console.warn(`Could not extract post ID from TikTok link for ${name}`);
            botOrderFailedCount++;
          }
        }
      } catch (error) {
        console.error(`Failed to create spark ${name}:`, error);
        errors.push(`${name}: ${error.message || 'Unknown error'}`);
        failedCount++;
      }
    }

    showBulkAddModal.value = false;

    // Show detailed results
    let resultMessage = '';
    if (failedCount === 0) {
      resultMessage = `Successfully created ${successCount} sparks`;
    } else if (successCount === 0) {
      showError(`Failed to create all sparks. Errors: ${errors.join(', ')}`);
      fetchSparks();
      return;
    } else {
      resultMessage = `Created ${successCount} sparks, ${failedCount} failed`;
    }

    // Add Comment Bot results if enabled
    if (bulkAddForm.value.enableCommentBot && successCount > 0) {
      if (botOrderSuccessCount > 0) {
        resultMessage += `. Comment Bot: ${botOrderSuccessCount} orders created`;
      }
      if (botOrderFailedCount > 0) {
        resultMessage += `, ${botOrderFailedCount} failed`;
      }
    }

    if (failedCount > 0 || botOrderFailedCount > 0) {
      showWarning(resultMessage + '. Check console for details.');
      if (errors.length > 0) {
        console.error('Failed sparks:', errors);
      }
    } else {
      showSuccess(resultMessage);
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

// Handle batch update success
const handleBatchUpdateSuccess = (data) => {
  const fieldLabels = {
    type: 'Type',
    status: 'Status',
    creator: 'Creator'
  };
  const field = typeof data === 'string' ? data : data.field;
  const count = typeof data === 'object' ? data.count : 'all';
  showSuccess(`${fieldLabels[field] || field} applied to ${count} selected item${count !== 1 ? 's' : ''}`);
};

// Apply batch updates from child component
const applyBatchUpdates = (updates) => {
  // Create a new object to trigger reactivity
  bulkEditValues.value = {
    ...bulkEditValues.value,
    ...updates
  };
};

// Store the original showThumbnails state
let originalShowThumbnails = null;

// Bulk Edit Functions
const startBulkEdit = () => {
  isBulkEditMode.value = true;
  bulkEditValues.value = {};

  // Store current thumbnail state and disable thumbnails
  originalShowThumbnails = showThumbnails.value;
  showThumbnails.value = false;

  // Initialize bulk edit values with current values
  filteredSparks.value.forEach(spark => {
    bulkEditValues.value[`${spark.id}-name`] = spark.name;
    bulkEditValues.value[`${spark.id}-type`] = spark.type;
    bulkEditValues.value[`${spark.id}-status`] = spark.status;
    bulkEditValues.value[`${spark.id}-creator`] = spark.creator;
    bulkEditValues.value[`${spark.id}-spark_code`] = spark.spark_code;
    bulkEditValues.value[`${spark.id}-tiktok_link`] = spark.tiktok_link;
  });
};

const cancelBulkEdit = () => {
  isBulkEditMode.value = false;
  bulkEditValues.value = {};

  // Restore original thumbnail state
  if (originalShowThumbnails !== null) {
    showThumbnails.value = originalShowThumbnails;
    originalShowThumbnails = null;
  }
};

const saveBulkEdit = async () => {
  isSavingBulk.value = true;
  
  try {
    const updates = [];
    
    // Collect all changes
    filteredSparks.value.forEach(spark => {
      const hasChanges = 
        bulkEditValues.value[`${spark.id}-name`] !== spark.name ||
        bulkEditValues.value[`${spark.id}-type`] !== spark.type ||
        bulkEditValues.value[`${spark.id}-status`] !== spark.status ||
        bulkEditValues.value[`${spark.id}-creator`] !== spark.creator ||
        bulkEditValues.value[`${spark.id}-spark_code`] !== spark.spark_code ||
        bulkEditValues.value[`${spark.id}-tiktok_link`] !== spark.tiktok_link;
      
      if (hasChanges) {
        updates.push({
          id: spark.id,
          name: bulkEditValues.value[`${spark.id}-name`],
          type: bulkEditValues.value[`${spark.id}-type`],
          status: bulkEditValues.value[`${spark.id}-status`],
          creator: bulkEditValues.value[`${spark.id}-creator`],
          sparkCode: bulkEditValues.value[`${spark.id}-spark_code`],
          tiktokLink: bulkEditValues.value[`${spark.id}-tiktok_link`]
        });
      }
    });
    
    if (updates.length === 0) {
      showSuccess('No changes to save');
      cancelBulkEdit();
      return;
    }
    
    // Save all updates
    let successCount = 0;
    let failedCount = 0;
    
    for (const update of updates) {
      try {
        await sparksApi.updateSpark(update.id, update);
        successCount++;
      } catch (error) {
        console.error(`Failed to update spark ${update.id}:`, error);
        failedCount++;
      }
    }
    
    if (successCount > 0) {
      showSuccess(`Successfully updated ${successCount} spark${successCount > 1 ? 's' : ''}`);
      // Refresh the data
      await fetchSparks();
    }
    
    if (failedCount > 0) {
      showError(`Failed to update ${failedCount} spark${failedCount > 1 ? 's' : ''}`);
    }
    
    cancelBulkEdit();
  } catch (error) {
    console.error('Bulk save error:', error);
    showError('Failed to save bulk changes');
  } finally {
    isSavingBulk.value = false;
  }
};

// Comment Bot Functions
const checkCommentBotAccess = async () => {
  try {
    // Check user subscriptions from the auth state
    const currentUser = user.value;
    console.log('Current user:', currentUser);
    console.log('Full user object keys:', currentUser ? Object.keys(currentUser) : 'No user');
    
    // Try different possible subscription fields
    const subscriptions = currentUser?.subscriptions || 
                          currentUser?.subscription || 
                          currentUser?.plans || 
                          currentUser?.access || 
                          [];
    
    console.log('Found subscriptions:', subscriptions);
    
    // Check if user has both Comment Bot and Dashboard subscriptions
    const hasCommentBot = subscriptions.includes('comment_bot');
    const hasDashboard = subscriptions.includes('dashboard');
    
    // Check if user is admin (admins get access to all features)
    const isAdmin = currentUser?.isAdmin === true;
    
    console.log('Has comment_bot subscription:', hasCommentBot);
    console.log('Has dashboard subscription:', hasDashboard);
    console.log('Is admin:', isAdmin);
    
    // Grant access if user has subscriptions OR is an admin
    hasCommentBotAccess.value = (hasCommentBot && hasDashboard) || isAdmin;
    console.log('Comment Bot access granted:', hasCommentBotAccess.value);
    
    if (hasCommentBotAccess.value) {
      // Fetch comment groups
      try {
        const groupsResponse = await commentBotApi.getCommentGroups();
        console.log('Comment groups API response:', groupsResponse);
        
        // Check if the response has the expected structure
        if (groupsResponse.success && groupsResponse.data) {
          commentGroups.value = groupsResponse.data;
        } else if (Array.isArray(groupsResponse)) {
          commentGroups.value = groupsResponse;
        } else if (groupsResponse.commentGroups) {
          commentGroups.value = groupsResponse.commentGroups;
        } else {
          // Try to use the response directly if it looks like an array
          commentGroups.value = groupsResponse || [];
        }
        
        console.log('Processed comment groups:', commentGroups.value);
      } catch (error) {
        console.error('Failed to fetch comment groups:', error);
        showWarning('Comment groups unavailable');
      }
      
      // Fetch user credits - same as Comment Bot page
      try {
        const creditsResponse = await usersApi.checkAccess();
        console.log('Credits response:', creditsResponse);
        
        // Get Comment Bot specific credits (matching CommentBot.vue logic)
        const commentBotData = creditsResponse.subscriptions?.comment_bot;
        userCredits.value = commentBotData?.totalCredits || 0;
        
        console.log('User credits:', userCredits.value);
      } catch (error) {
        console.error('Failed to fetch user credits:', error);
        userCredits.value = 0;
      }
    }
  } catch (error) {
    console.error('Failed to check Comment Bot access:', error);
    hasCommentBotAccess.value = false;
  }
};

const startCommentBotMode = () => {
  if (!hasCommentBotAccess.value) {
    showWarning('Comment Bot subscription required for this feature');
    return;
  }
  
  // Reset state first before enabling mode
  selectedForBot.value = [];
  commentBotSettings.value = {
    comment_group_id: null,
    like_count: 0,
    save_count: 0
  };
  
  // Then enable mode
  isBulkEditMode.value = false; // Ensure bulk edit is off
  
  // Use nextTick to avoid recursive updates
  nextTick(() => {
    isCommentBotMode.value = true;
  });
};

const cancelCommentBotMode = () => {
  isCommentBotMode.value = false;
  selectedForBot.value = [];
  commentBotSettings.value = {
    comment_group_id: null,
    like_count: 0,
    save_count: 0
  };
};

const toggleBotSelection = (sparkId) => {
  const index = selectedForBot.value.indexOf(sparkId);
  if (index > -1) {
    selectedForBot.value.splice(index, 1);
  } else {
    selectedForBot.value.push(sparkId);
  }
};

const executeCommentBot = async () => {
  if (selectedForBot.value.length === 0) {
    showError('Please select at least one spark');
    return;
  }

  if (!commentBotSettings.value.comment_group_id &&
      commentBotSettings.value.like_count === 0 &&
      commentBotSettings.value.save_count === 0) {
    showWarning('Please configure bot settings');
    return;
  }

  isProcessingBot.value = true;

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  try {
    // First, update all selected sparks to 'queued' status in the database
    for (const sparkId of selectedForBot.value) {
      const spark = sparks.value.find(s => s.id === sparkId);
      if (!spark) continue;

      // Only update sparks that have a TikTok link
      if (!spark.tiktok_link) {
        console.warn(`Skipping ${spark.name} - no TikTok link`);
        continue;
      }

      try {
        // Prepare update data with camelCase field names like the inline edit does
        const updateData = {
          name: spark.name,
          creator: spark.creator || 'None',
          tiktokLink: spark.tiktok_link,  // Use camelCase!
          sparkCode: spark.spark_code || '',  // Use camelCase!
          type: spark.type || 'auto',
          status: spark.status || 'active',
          offerName: spark.offer_name || '',  // Use camelCase!
          bot_status: 'queued'
        };

        const response = await sparksApi.updateSpark(spark.id, updateData);
      } catch (err) {
        console.error(`Failed to set queued status for ${spark.name}:`, err);
      }
    }

    // Refresh sparks to show queued status
    await fetchSparks();

    // Process each selected spark
    for (const sparkId of selectedForBot.value) {
      const spark = sparks.value.find(s => s.id === sparkId);
      if (!spark || !spark.tiktok_link) {
        skipCount++;
        continue;
      }

      const postId = extractPostIdFromTikTokLink(spark.tiktok_link);
      if (!postId) {
        console.warn(`No valid post ID for spark ${spark.name}, skipping`);

        // Update to failed in database
        try {
          const updateData = {
            name: spark.name,
            creator: spark.creator || 'None',
            tiktokLink: spark.tiktok_link,  // Use camelCase!
            sparkCode: spark.spark_code || '',  // Use camelCase!
            type: spark.type || 'auto',
            status: spark.status || 'active',
            offerName: spark.offer_name || '',  // Use camelCase!
            bot_status: 'failed'
          };

          await sparksApi.updateSpark(spark.id, updateData);
        } catch (updateError) {
          console.error(`Failed to update spark status in database:`, updateError);
        }

        failCount++;
        continue;
      }

      const orderData = {
        post_id: postId,
        comment_group_id: commentBotSettings.value.comment_group_id,
        like_count: Math.min(commentBotSettings.value.like_count || 0, 3000),
        save_count: Math.min(commentBotSettings.value.save_count || 0, 500)
      };

      console.log(`Creating order for spark ${spark.name}:`, orderData);

      try {
        // Use the regular createOrder endpoint
        const response = await commentBotApi.createOrder(orderData);
        console.log(`Order created for ${spark.name}:`, response);

        // Update the spark in the database with the post ID and processing status
        try {
          const updateData = {
            name: spark.name,
            creator: spark.creator || 'None',
            tiktokLink: spark.tiktok_link,  // Use camelCase!
            sparkCode: spark.spark_code || '',  // Use camelCase!
            type: spark.type || 'auto',
            status: spark.status || 'active',
            offerName: spark.offer_name || '',  // Use camelCase!
            bot_post_id: postId,
            bot_status: 'processing'
          };

          await sparksApi.updateSpark(spark.id, updateData);
        } catch (updateError) {
          console.error(`Failed to update spark ${spark.name} in database:`, updateError);
          console.error(`Update data:`, updateData);
          // Don't fail the whole operation if DB update fails
        }

        successCount++;
      } catch (error) {
        console.error(`Failed to create order for spark ${spark.name}:`, error);

        // Try to update in database with failed status
        try {
          const updateData = {
            name: spark.name,
            creator: spark.creator || 'None',
            tiktokLink: spark.tiktok_link,  // Use camelCase!
            sparkCode: spark.spark_code || '',  // Use camelCase!
            type: spark.type || 'auto',
            status: spark.status || 'active',
            offerName: spark.offer_name || '',  // Use camelCase!
            bot_status: 'failed'
          };

          await sparksApi.updateSpark(spark.id, updateData);
        } catch (updateError) {
          console.error(`Failed to update spark status in database:`, updateError);
        }

        failCount++;
      }
    }
    
    // Provide detailed feedback based on results
    if (failCount > 0 && successCount > 0) {
      showWarning(`Processed ${selectedForBot.value.length} sparks: ${successCount} succeeded, ${failCount} failed${skipCount > 0 ? `, ${skipCount} skipped` : ''}`);
    } else if (failCount > 0 && successCount === 0) {
      showError(`All ${failCount} sparks failed to process${skipCount > 0 ? ` (${skipCount} skipped)` : ''}`);
    } else if (skipCount > 0 && successCount === 0) {
      showError(`No valid sparks to process (${skipCount} skipped)`);
    } else {
      showSuccess(`Successfully processed all ${successCount} sparks`);
    }
    
    cancelCommentBotMode();
    await fetchSparks();
  } catch (error) {
    console.error('Bot processing failed:', error);
    showError('Failed to process sparks');
  } finally {
    isProcessingBot.value = false;
  }
};

// Extract Post ID from TikTok Link
const extractPostIdFromTikTokLink = (link) => {
  if (!link) return null;
  
  const patterns = [
    /\/video\/(\d{19})/,
    /@[\w.]+\/video\/(\d{19})/,
    /\/(\d{19})(?:\?|$)/
  ];
  
  for (const pattern of patterns) {
    const match = link.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
};

const handleCommentBotRefresh = async () => {
  await fetchSparks();
  showSuccess('Sparks updated with bot status');
};

// Bot status refresh interval
let botStatusInterval = null;

// Function to refresh bot statuses for processing sparks
const refreshBotStatuses = async () => {
  const processingSparks = sparks.value.filter(s =>
    s.bot_post_id &&
    (s.bot_status === 'queued' || s.bot_status === 'processing' || s.bot_status === 'pending')
  );

  if (processingSparks.length === 0) {
    return; // No sparks to check
  }

  try {
    // Get all active orders from comment bot
    const ordersResponse = await commentBotApi.getOrders();

    if (!ordersResponse || !ordersResponse.orders) {
      return;
    }

    // Create a map of post_id to order status
    const orderStatusMap = {};
    ordersResponse.orders.forEach(order => {
      if (order.post_id) {
        orderStatusMap[order.post_id] = order.status || 'processing';
      }
    });

    // Check if any sparks need status updates
    let hasUpdates = false;

    for (const spark of processingSparks) {
      let newStatus = spark.bot_status;

      if (orderStatusMap[spark.bot_post_id]) {
        // Found matching order - update to its status
        newStatus = orderStatusMap[spark.bot_post_id];
      } else {
        // No matching order found - mark as completed
        newStatus = 'completed';
      }

      // Only update if status changed
      if (newStatus !== spark.bot_status) {
        hasUpdates = true;

        // Update in database with camelCase fields
        try {
          const updateData = {
            name: spark.name,
            creator: spark.creator || 'None',
            tiktokLink: spark.tiktok_link || '',  // Use camelCase!
            sparkCode: spark.spark_code || '',  // Use camelCase!
            type: spark.type || 'auto',
            status: spark.status || 'active',
            offerName: spark.offer_name || '',  // Use camelCase!
            bot_status: newStatus
          };

          await sparksApi.updateSpark(spark.id, updateData);
        } catch (err) {
          console.error(`Failed to update spark ${spark.id} status in DB:`, err);
        }
      }
    }

    // Refresh sparks if any updates were made
    if (hasUpdates) {
      await fetchSparks();
    }
  } catch (error) {
    console.error('Failed to refresh bot statuses:', error);
  }
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

  // Check Comment Bot access and fetch comment groups
  await checkCommentBotAccess();

  // Start periodic bot status refresh (every 10 seconds)
  botStatusInterval = setInterval(refreshBotStatuses, 10000);
});

// Clean up interval on unmount
onUnmounted(() => {
  if (botStatusInterval) {
    clearInterval(botStatusInterval);
  }
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