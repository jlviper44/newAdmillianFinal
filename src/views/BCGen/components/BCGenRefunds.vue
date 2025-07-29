<template>
  <v-card flat>
    <v-card-title class="d-flex align-center">
      <v-icon class="mr-2">mdi-cash-refund</v-icon>
      BCGen Refund Requests
      <v-spacer></v-spacer>
      <v-btn
        @click="loadRefundRequests"
        icon
        variant="text"
        :loading="loading"
      >
        <v-icon>mdi-refresh</v-icon>
      </v-btn>
    </v-card-title>
    
    <v-card-text>
      <div v-if="loading && !requests.length" class="text-center pa-8">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
        <p class="mt-4">Loading refund requests...</p>
      </div>
      
      <div v-else-if="!requests.length" class="text-center pa-8">
        <v-icon size="64" color="grey">mdi-cash-refund</v-icon>
        <p class="text-h6 mt-4 text-grey">No refund requests</p>
      </div>
      
      <v-data-table
        v-else
        :headers="headers"
        :items="requests"
        :items-per-page="10"
        class="elevation-1"
      >
        <!-- Status Column -->
        <template v-slot:item.status="{ item }">
          <v-chip
            :color="getStatusColor(item.status)"
            size="small"
            variant="flat"
          >
            {{ item.status.toUpperCase() }}
          </v-chip>
        </template>
        
        <!-- Order Info Column -->
        <template v-slot:item.orderInfo="{ item }">
          <div>
            <div class="font-weight-medium">Order #{{ item.orderId }}</div>
            <div class="text-caption text-grey">
              {{ item.quantity }} × {{ item.country }}
            </div>
          </div>
        </template>
        
        <!-- User Column -->
        <template v-slot:item.userEmail="{ item }">
          <div>
            <div>{{ item.userEmail || 'Unknown' }}</div>
            <div class="text-caption text-grey">{{ item.userId }}</div>
          </div>
        </template>
        
        <!-- Date Column -->
        <template v-slot:item.createdAt="{ item }">
          {{ formatDate(item.createdAt) }}
        </template>
        
        <!-- Actions Column -->
        <template v-slot:item.actions="{ item }">
          <v-btn
            @click="openDetailsDialog(item)"
            size="small"
            variant="text"
            color="primary"
          >
            View Details
          </v-btn>
        </template>
      </v-data-table>
    </v-card-text>
  </v-card>
  
  <!-- Details Dialog -->
  <v-dialog v-model="detailsDialog" max-width="700">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-cash-refund</v-icon>
        Refund Request Details
        <v-spacer></v-spacer>
        <v-chip
          :color="getStatusColor(selectedRequest?.status)"
          size="small"
          variant="flat"
        >
          {{ selectedRequest?.status?.toUpperCase() }}
        </v-chip>
      </v-card-title>
      
      <v-divider></v-divider>
      
      <v-card-text class="pa-4">
        <!-- Request Information -->
        <v-row>
          <v-col cols="12" md="6">
            <div class="mb-4">
              <div class="text-overline">Order Information</div>
              <div class="text-h6">Order #{{ selectedRequest?.orderId }}</div>
              <div class="text-body-2 text-grey">
                {{ selectedRequest?.quantity }} × {{ selectedRequest?.country }}
              </div>
              <div class="text-body-2 text-grey">
                Order Date: {{ formatDate(selectedRequest?.orderCreatedAt) }}
              </div>
            </div>
          </v-col>
          
          <v-col cols="12" md="6">
            <div class="mb-4">
              <div class="text-overline">User Information</div>
              <div class="text-body-1">{{ selectedRequest?.userEmail || 'Unknown' }}</div>
              <div class="text-body-2 text-grey">ID: {{ selectedRequest?.userId }}</div>
            </div>
          </v-col>
        </v-row>
        
        <v-divider class="my-4"></v-divider>
        
        <!-- Refund Details -->
        <div class="mb-4">
          <div class="text-overline mb-3">Refund Details</div>
          <v-row>
            <v-col cols="12" sm="6">
              <div class="d-flex align-center">
                <strong class="mr-2">Amount:</strong>
                <span>{{ selectedRequest?.refundAmount }} credits</span>
              </div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="d-flex align-center">
                <strong class="mr-2">Requested:</strong>
                <span>{{ formatDate(selectedRequest?.createdAt) }}</span>
              </div>
            </v-col>
          </v-row>
          <v-row class="mt-2">
            <v-col cols="12">
              <v-chip 
                color="info" 
                variant="tonal" 
                size="small"
                prepend-icon="mdi-clock-outline"
              >
                {{ getTimeDifference(selectedRequest?.orderCreatedAt, selectedRequest?.createdAt) }}
              </v-chip>
            </v-col>
          </v-row>
        </div>
        
        <!-- User's Reason -->
        <div class="mb-4">
          <div class="text-overline">User's Reason for Refund</div>
          <v-card variant="tonal" color="grey" class="pa-3">
            <div class="text-body-1">{{ selectedRequest?.reason }}</div>
          </v-card>
        </div>
        
        <!-- Admin Section (for processed requests) -->
        <div v-if="selectedRequest?.status !== 'pending'" class="mb-4">
          <v-divider class="my-4"></v-divider>
          <div class="text-overline">Processing Information</div>
          <div class="mb-2">
            <strong>Processed by:</strong> {{ selectedRequest?.processedBy }}
          </div>
          <div class="mb-2">
            <strong>Processed at:</strong> {{ formatDate(selectedRequest?.processedAt) }}
          </div>
          <div v-if="selectedRequest?.adminNotes">
            <strong>Admin Notes:</strong>
            <v-card variant="outlined" class="pa-3 mt-2">
              <div class="text-body-2">{{ selectedRequest?.adminNotes }}</div>
            </v-card>
          </div>
        </div>
        
        <!-- Admin Notes Input (for pending requests) -->
        <div v-if="selectedRequest?.status === 'pending'">
          <v-divider class="my-4"></v-divider>
          <v-textarea
            v-model="adminNotes"
            label="Admin Notes (Optional)"
            placeholder="Add any notes about this decision..."
            rows="3"
            variant="outlined"
            class="mb-4"
          ></v-textarea>
        </div>
      </v-card-text>
      
      <v-divider></v-divider>
      
      <v-card-actions class="pa-4">
        <v-btn
          @click="detailsDialog = false"
          :disabled="processLoading"
        >
          Close
        </v-btn>
        <v-spacer></v-spacer>
        <template v-if="selectedRequest?.status === 'pending'">
          <v-btn
            @click="processRefund('deny')"
            color="error"
            variant="outlined"
            :loading="processLoading"
            prepend-icon="mdi-close"
          >
            Deny Refund
          </v-btn>
          <v-btn
            @click="processRefund('approve')"
            color="success"
            variant="flat"
            :loading="processLoading"
            prepend-icon="mdi-check"
          >
            Approve Refund
          </v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
  
  <!-- Checkout Link Dialog -->
  <v-dialog v-model="checkoutLinkDialog" max-width="600">
    <v-card>
      <v-card-title>
        <v-icon class="mr-2">mdi-check-circle</v-icon>
        Refund Approved
      </v-card-title>
      
      <v-card-text>
        <v-alert type="success" variant="tonal" class="mb-4">
          The refund has been approved. A checkout link with 0 price has been created for the user.
        </v-alert>
        
        <div class="mb-4">
          <div class="text-subtitle-2 mb-2">Checkout Link:</div>
          <v-text-field
            :model-value="checkoutLink"
            readonly
            variant="outlined"
            density="compact"
            append-inner-icon="mdi-content-copy"
            @click:append-inner="copyToClipboard(checkoutLink)"
          ></v-text-field>
        </div>
        
        <v-alert type="info" variant="tonal" density="compact">
          Send this link to the user so they can claim their refunded accounts.
        </v-alert>
      </v-card-text>
      
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="checkoutLinkDialog = false" variant="flat">
          Close
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  
  <!-- Snackbar -->
  <v-snackbar v-model="snackbar.show" :color="snackbar.color">
    {{ snackbar.text }}
    <template v-slot:actions>
      <v-btn variant="text" @click="snackbar.show = false">Close</v-btn>
    </template>
  </v-snackbar>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { bcgenApi } from '@/services/api'

// Data
const requests = ref([])
const loading = ref(false)

// Dialog state
const detailsDialog = ref(false)
const selectedRequest = ref(null)
const adminNotes = ref('')
const processLoading = ref(false)
const checkoutLinkDialog = ref(false)
const checkoutLink = ref('')

// Snackbar
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
})

// Table headers
const headers = [
  { title: 'Status', key: 'status', width: '120px' },
  { title: 'Order', key: 'orderInfo', width: '150px' },
  { title: 'User', key: 'userEmail' },
  { title: 'Request Date', key: 'createdAt' },
  { title: 'Actions', key: 'actions', width: '120px', sortable: false }
]

// Methods
const showSnackbar = (text, color = 'success') => {
  snackbar.value = { show: true, text, color }
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    showSnackbar('Checkout link copied!', 'success')
  } catch (error) {
    showSnackbar('Failed to copy link', 'error')
  }
}

const getStatusColor = (status) => {
  const colors = {
    pending: 'warning',
    approved: 'success',
    denied: 'error'
  }
  return colors[status] || 'grey'
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString()
}

const getTimeDifference = (orderDate, refundDate) => {
  const order = new Date(orderDate)
  const refund = new Date(refundDate)
  const diffMs = refund - order
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  
  if (diffHours < 1) {
    return `${diffMinutes} minutes after order`
  } else if (diffHours === 1) {
    return `1 hour ${diffMinutes} minutes after order`
  } else {
    return `${diffHours} hours ${diffMinutes} minutes after order`
  }
}

const loadRefundRequests = async () => {
  loading.value = true
  try {
    const response = await bcgenApi.getRefundRequests()
    
    if (response.error) {
      showSnackbar(response.error, 'error')
      return
    }
    
    requests.value = response.requests || []
  } catch (error) {
    showSnackbar('Failed to load refund requests', 'error')
  } finally {
    loading.value = false
  }
}

const openDetailsDialog = (request) => {
  selectedRequest.value = request
  adminNotes.value = ''
  detailsDialog.value = true
}

const processRefund = async (action) => {
  processLoading.value = true
  try {
    const response = await bcgenApi.processRefund(
      selectedRequest.value.requestId,
      action,
      adminNotes.value
    )
    
    if (response.error) {
      showSnackbar(response.error, 'error')
      return
    }
    
    showSnackbar(response.message, 'success')
    
    // If approved and has checkout link, show it
    if (action === 'approve' && response.checkoutLink) {
      checkoutLink.value = response.checkoutLink
      checkoutLinkDialog.value = true
    }
    
    detailsDialog.value = false
    
    // Reload requests
    await loadRefundRequests()
  } catch (error) {
    showSnackbar('Failed to process refund', 'error')
  } finally {
    processLoading.value = false
  }
}

// Load on mount
onMounted(() => {
  loadRefundRequests()
})
</script>

<style scoped>
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>