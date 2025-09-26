<template>
  <div class="history-invoices-tab">
    <!-- Summary Cards -->
    <v-row class="mb-4">
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-success mb-2">{{ historyStats.paidAmount }}</h3>
            <p class="text-body-2 text-grey">Total Paid</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-error mb-2">{{ historyStats.voidedAmount }}</h3>
            <p class="text-body-2 text-grey">Total Voided</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-primary mb-2">{{ historyStats.totalReports }}</h3>
            <p class="text-body-2 text-grey">Total Records</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-info mb-2">{{ historyStats.totalSparks }}</h3>
            <p class="text-body-2 text-grey">Total Sparks</p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Payment History Table -->
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <span>Payment History</span>
        <v-btn
          color="primary"
          variant="outlined"
          size="small"
          @click="loadPaymentHistory"
          :loading="isLoading"
          prepend-icon="mdi-refresh"
        >
          Refresh
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="historyHeaders"
          :items="completedPayments"
          :loading="isLoading"
          density="compact"
          :items-per-page="25"
          class="compact-table"
        >
          <!-- VA Column -->
          <template v-slot:item.va_email="{ item }">
            <div class="d-flex align-center">
              <v-avatar color="primary" size="24" class="mr-2">
                <span class="text-caption font-weight-bold">{{ item.va_email.charAt(0).toUpperCase() }}</span>
              </v-avatar>
              <div>
                <div class="text-caption font-weight-medium">{{ item.va_email }}</div>
              </div>
            </div>
          </template>

          <!-- Week Period Column -->
          <template v-slot:item.week_period="{ item }">
            <div>
              <div class="font-weight-medium text-caption mb-1">{{ formatWeekPeriod(item.week_start, item.week_end) }}</div>
              <v-chip
                size="x-small"
                variant="tonal"
                :color="item.generation_type === 'early' ? 'warning' : 'info'"
                class="mr-1 text-xs"
              >
                {{ item.generation_type }}
              </v-chip>
              <span class="text-xs text-grey">{{ item.generated_by }}</span>
            </div>
          </template>

          <!-- Status Column -->
          <template v-slot:item.status="{ item }">
            <v-chip
              size="small"
              :color="getPaymentStatusColor(item.status)"
              variant="tonal"
            >
              {{ item.status.toUpperCase() }}
            </v-chip>
          </template>

          <!-- Payment Method Column -->
          <template v-slot:item.payment_method="{ item }">
            <v-chip
              v-if="item.payment_method"
              size="small"
              color="grey"
              variant="outlined"
            >
              {{ item.payment_method }}
            </v-chip>
            <span v-else class="text-grey text-caption">-</span>
          </template>

          <!-- Date Completed Column -->
          <template v-slot:item.date_completed="{ item }">
            <div class="text-caption">
              {{ item.status === 'paid' ? formatDate(item.paid_at) : formatDate(item.voided_at) }}
            </div>
          </template>

          <!-- Actions Column -->
          <template v-slot:item.actions="{ item }">
            <div class="text-center">
              <v-btn
                v-if="item.status === 'paid'"
                color="primary"
                variant="outlined"
                size="small"
                @click="downloadInvoicePDF(item)"
                :loading="downloadingItems[item.id]"
                prepend-icon="mdi-download"
              >
                PDF
              </v-btn>
              <span v-else class="text-grey text-caption">-</span>
            </div>
          </template>

          <!-- No Data Message -->
          <template v-slot:no-data>
            <div class="text-center pa-4">
              <v-icon size="48" color="grey-lighten-2" class="mb-2">mdi-history</v-icon>
              <div class="text-h6 text-grey">No payment history found</div>
              <div class="text-caption text-grey">Completed payments will appear here</div>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useVAStatus } from '../VAStatus/composables/useVAStatus.js';
import { onSparkEvent } from '../sparks/composables/useSparks.js';
import { api } from '@/services/api.js';
import jsPDF from 'jspdf';

// Use VA Status composable to get payment data
const { getWeeklyPaymentEntries } = useVAStatus();

// State
const isLoading = ref(false);
const allPayments = ref([]);
const downloadingItems = ref({});

// Table headers
const historyHeaders = [
  { title: 'VA', key: 'va_email', sortable: true },
  { title: 'Week Period', key: 'week_period', sortable: true },
  { title: 'Sparks', key: 'sparks_count', sortable: true },
  { title: 'Amount', key: 'amount', sortable: true },
  { title: 'Payment Method', key: 'payment_method', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Date Completed', key: 'date_completed', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, align: 'center' }
];

// Computed property to filter only completed payments (paid or voided)
const completedPayments = computed(() => {
  return allPayments.value.filter(payment =>
    payment.status === 'paid' || payment.status === 'voided'
  );
});

// Computed statistics
const historyStats = computed(() => {
  const completed = completedPayments.value;
  const paidPayments = completed.filter(p => p.status === 'paid');
  const voidedPayments = completed.filter(p => p.status === 'voided');

  return {
    paidAmount: `$${paidPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}`,
    voidedAmount: `$${voidedPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}`,
    totalReports: completed.length,
    totalSparks: completed.reduce((sum, p) => sum + p.sparks_count, 0)
  };
});

// Load payment history
const loadPaymentHistory = async () => {
  try {
    isLoading.value = true;
    console.log('📋 InvoicesTab: Loading payment history...');
    const entries = await getWeeklyPaymentEntries();
    allPayments.value = entries;
    console.log('📋 InvoicesTab: Payment history loaded:', entries.length, 'entries');
  } catch (error) {
    console.error('❌ InvoicesTab: Failed to load payment history:', error);
  } finally {
    isLoading.value = false;
  }
};

// Utility functions
const formatWeekPeriod = (startDate, endDate) => {
  try {
    if (!startDate || !endDate) {
      return 'Date not available';
    }
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 'Invalid date range';
    }

    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  } catch (error) {
    console.error('Error formatting week period:', error);
    return 'Date format error';
  }
};

const formatDate = (dateString) => {
  try {
    if (!dateString) return '-';
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Date error';
  }
};

const getPaymentStatusColor = (status) => {
  switch (status) {
    case 'pending': return 'warning';
    case 'paid': return 'success';
    case 'voided': return 'error';
    default: return 'grey';
  }
};

// Generate invoice HTML content
const generateInvoiceHTML = (paymentItem, invoiceNumber) => {
  console.log('📄 Generating HTML for payment item:', paymentItem);

  // Safely extract values with fallbacks
  const currentDate = new Date().toLocaleDateString();
  const paidDate = paymentItem.paid_at ? new Date(paymentItem.paid_at).toLocaleDateString() : currentDate;
  const amount = parseFloat(paymentItem.amount) || 0;
  const sparksCount = parseInt(paymentItem.sparks_count) || 1;
  const rate = (amount / sparksCount).toFixed(2);
  const weekPeriod = formatWeekPeriod(paymentItem.week_start, paymentItem.week_end);
  const vaEmail = paymentItem.va_email || 'Unknown VA';
  const paymentMethod = paymentItem.payment_method || 'N/A';

  console.log('📄 Invoice details:', { invoiceNumber, currentDate, paidDate, rate, weekPeriod, amount, sparksCount, vaEmail, paymentMethod });

  const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Invoice ${invoiceNumber}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            background: white;
        }
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 20px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 40px;
            border-bottom: 2px solid #4CAF50;
            padding-bottom: 20px;
        }
        .invoice-title {
            color: #4CAF50;
            margin: 0;
            font-size: 28px;
        }
        .invoice-number {
            margin: 0;
            color: #333;
            font-size: 18px;
        }
        .bill-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }
        .bill-to h3 {
            color: #333;
            margin-bottom: 10px;
        }
        .table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        .table th {
            background-color: #4CAF50;
            color: white;
            padding: 12px;
            text-align: left;
            border: 1px solid #ddd;
        }
        .table td {
            padding: 12px;
            border: 1px solid #ddd;
        }
        .total-section {
            text-align: right;
            margin-bottom: 30px;
        }
        .total-row {
            padding: 15px 0;
            border-bottom: 2px solid #4CAF50;
            font-size: 18px;
            font-weight: bold;
        }
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <div>
                <h1 class="invoice-title">INVOICE</h1>
                <p style="margin: 5px 0; color: #666;">Professional Services</p>
            </div>
            <div style="text-align: right;">
                <h2 class="invoice-number">${invoiceNumber}</h2>
                <p><strong>Date:</strong> ${currentDate}</p>
                <p><strong>Status:</strong> <span style="color: #4CAF50; font-weight: bold;">PAID</span></p>
            </div>
        </div>

        <div class="bill-info">
            <div class="bill-to">
                <h3>Bill To:</h3>
                <p style="font-size: 16px; font-weight: bold; margin: 5px 0;">${vaEmail}</p>
                <p style="color: #666; margin: 5px 0;">Virtual Assistant</p>
            </div>
            <div style="text-align: right;">
                <p><strong>Payment Date:</strong> ${paidDate}</p>
                <p><strong>Payment Method:</strong> ${paymentMethod}</p>
                <p><strong>Period:</strong> ${weekPeriod}</p>
            </div>
        </div>

        <table class="table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th style="text-align: center;">Quantity</th>
                    <th style="text-align: right;">Rate</th>
                    <th style="text-align: right;">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>
                        Spark Videos - ${vaEmail}<br>
                        <small style="color: #666;">${weekPeriod}</small>
                    </td>
                    <td style="text-align: center;">${sparksCount}</td>
                    <td style="text-align: right;">$${rate}</td>
                    <td style="text-align: right; font-weight: bold;">$${amount.toFixed(2)}</td>
                </tr>
            </tbody>
        </table>

        <div class="total-section">
            <div style="display: inline-block; text-align: left; min-width: 250px;">
                <div style="padding: 10px 0; border-bottom: 1px solid #ddd;">
                    <span style="float: left;">Subtotal:</span>
                    <span style="float: right; font-weight: bold;">$${amount.toFixed(2)}</span>
                    <div style="clear: both;"></div>
                </div>
                <div class="total-row">
                    <span style="float: left;">Total:</span>
                    <span style="float: right; color: #4CAF50;">$${amount.toFixed(2)}</span>
                    <div style="clear: both;"></div>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>Thank you for your excellent work!</p>
            <p style="font-size: 12px;">This invoice was generated automatically for ${sparksCount} Spark videos delivered during the period ${weekPeriod}.</p>
        </div>
    </div>
</body>
</html>`;

  console.log('📄 Generated HTML length:', html.length);
  return html;
};

// PDF download using jsPDF (working solution from PayrollHistoryTab)
const downloadInvoicePDF = async (paymentItem) => {
  try {
    downloadingItems.value[paymentItem.id] = true;
    console.log('📄 InvoicesTab: Generating PDF with jsPDF for payment:', paymentItem);

    // Extract data safely
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const amount = parseFloat(paymentItem.amount) || 0;
    const sparksCount = parseInt(paymentItem.sparks_count) || 0;
    const vaEmail = paymentItem.va_email || 'Unknown VA';
    const weekPeriod = formatWeekPeriod(paymentItem.week_start, paymentItem.week_end);
    const currentDate = new Date().toLocaleDateString();

    // Create PDF document
    const doc = new jsPDF();

    // Colors
    const primaryBlue = [41, 128, 185];
    const darkGray = [52, 73, 94];
    const lightGray = [149, 165, 166];
    const green = [39, 174, 96];

    // Header background
    doc.setFillColor(...primaryBlue);
    doc.rect(0, 0, 210, 35, 'F');

    // Company/Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('SPARK INVOICE', 105, 22, { align: 'center' });

    // Reset color
    doc.setTextColor(0, 0, 0);

    // Invoice number (top right)
    doc.setFontSize(16);
    doc.setTextColor(...darkGray);
    doc.text(invoiceNumber, 190, 50, { align: 'right' });

    // Date info box
    doc.setFillColor(248, 249, 250);
    doc.rect(130, 55, 60, 25, 'F');
    doc.setFontSize(10);
    doc.setTextColor(...darkGray);
    doc.text('Issue Date:', 135, 63);
    doc.text(currentDate, 135, 69);
    doc.text('Period:', 135, 75);

    // Bill To section
    doc.setFontSize(14);
    doc.setTextColor(...primaryBlue);
    doc.text('BILL TO:', 20, 65);

    doc.setFontSize(12);
    doc.setTextColor(...darkGray);
    doc.text(vaEmail, 20, 75);
    doc.setFontSize(10);
    doc.setTextColor(...lightGray);
    doc.text('Virtual Assistant', 20, 82);

    // Status badge
    doc.setFillColor(...green);
    doc.roundedRect(20, 90, 25, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('PAID', 32.5, 95, { align: 'center' });

    // Period info
    doc.setTextColor(...darkGray);
    doc.setFontSize(10);
    doc.text(weekPeriod, 135, 81);

    // Services table header
    doc.setFillColor(...primaryBlue);
    doc.rect(20, 115, 170, 12, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('DESCRIPTION', 25, 123);
    doc.text('QTY', 120, 123);
    doc.text('RATE', 140, 123);
    doc.text('AMOUNT', 170, 123);

    // Service row
    doc.setFillColor(255, 255, 255);
    doc.rect(20, 127, 170, 15, 'F');
    doc.setDrawColor(...lightGray);
    doc.rect(20, 127, 170, 15, 'S');

    doc.setTextColor(...darkGray);
    doc.setFontSize(10);
    doc.text('Spark Video Creation', 25, 135);
    doc.text(`${sparksCount}`, 120, 135);
    doc.text(`$${(amount / sparksCount).toFixed(2)}`, 140, 135);
    doc.setFontSize(11);
    doc.text(`$${amount.toFixed(2)}`, 170, 135);

    // Total section
    doc.setFillColor(248, 249, 250);
    doc.rect(130, 155, 60, 25, 'F');
    doc.setDrawColor(...lightGray);
    doc.rect(130, 155, 60, 25, 'S');

    doc.setTextColor(...darkGray);
    doc.setFontSize(10);
    doc.text('Subtotal:', 135, 165);
    doc.text(`$${amount.toFixed(2)}`, 185, 165, { align: 'right' });

    // Total line
    doc.setLineWidth(0.5);
    doc.setDrawColor(...primaryBlue);
    doc.line(135, 170, 185, 170);

    doc.setFontSize(12);
    doc.setTextColor(...primaryBlue);
    doc.text('TOTAL:', 135, 177);
    doc.text(`$${amount.toFixed(2)}`, 185, 177, { align: 'right' });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(...lightGray);
    doc.text('Thank you for your excellent work!', 105, 200, { align: 'center' });
    doc.text(`Invoice generated on ${currentDate}`, 105, 206, { align: 'center' });

    // Save the PDF
    const filename = `${invoiceNumber}-${vaEmail.replace('@', '_at_').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    doc.save(filename);

    console.log('📄 PDF generated successfully with jsPDF');
  } catch (error) {
    console.error('❌ Failed to generate PDF with jsPDF:', error);
    alert('Failed to generate invoice PDF. Please try again.');
  } finally {
    downloadingItems.value[paymentItem.id] = false;
  }
};

// Load data on mount
onMounted(() => {
  loadPaymentHistory();

  // Set up auto-refresh when payments are marked as paid or voided
  onSparkEvent('paymentMarkedPaid', async (paymentData) => {
    console.log('🔄 InvoicesTab: Auto-refreshing due to payment marked as paid:', paymentData);
    await loadPaymentHistory();
    console.log('✅ InvoicesTab: Auto-refresh completed after payment marked as paid');
  });

  onSparkEvent('paymentMarkedVoid', async (paymentData) => {
    console.log('🔄 InvoicesTab: Auto-refreshing due to payment marked as void:', paymentData);
    await loadPaymentHistory();
    console.log('✅ InvoicesTab: Auto-refresh completed after payment marked as void');
  });
});
</script>

<style scoped>
.history-invoices-tab {
  /* Custom styles for the history and invoices tab */
}

.compact-table :deep(.v-data-table__td) {
  padding: 4px 8px !important;
  height: auto !important;
}

.compact-table :deep(.v-data-table__th) {
  padding: 8px 8px !important;
  font-size: 0.75rem !important;
  font-weight: 600 !important;
}

.compact-table :deep(.v-data-table-header__content) {
  font-size: 0.75rem !important;
  font-weight: 600 !important;
}

.text-xs {
  font-size: 0.6875rem !important;
  line-height: 1rem;
}
</style>