import { ref, computed } from 'vue';
import { sparksApi } from '@/services/api';

export function useInvoices() {
  const invoices = ref([]);
  const isLoadingInvoices = ref(false);
  const invoiceStatusFilter = ref('all');
  const invoiceCreatorFilter = ref('all');
  const invoiceDateFrom = ref('');
  const invoiceDateTo = ref('');

  const invoiceStatusOptions = [
    { title: 'All Status', value: 'all' },
    { title: 'Pending', value: 'pending' },
    { title: 'Paid', value: 'paid' },
    { title: 'Voided', value: 'voided' },
    { title: 'Overdue', value: 'overdue' }
  ];

  const invoiceCreatorOptions = computed(() => {
    const creators = new Set(invoices.value.map(inv => inv.creator_name).filter(Boolean));
    return [
      { title: 'All Creators', value: 'all' },
      ...Array.from(creators).map(creator => ({ title: creator, value: creator }))
    ];
  });

  const filteredInvoices = computed(() => {
    let filtered = invoices.value;

    if (invoiceStatusFilter.value !== 'all') {
      filtered = filtered.filter(inv => inv.status === invoiceStatusFilter.value);
    }

    if (invoiceCreatorFilter.value !== 'all') {
      filtered = filtered.filter(inv => inv.creator_name === invoiceCreatorFilter.value);
    }

    if (invoiceDateFrom.value) {
      filtered = filtered.filter(inv => inv.invoice_date >= invoiceDateFrom.value);
    }

    if (invoiceDateTo.value) {
      filtered = filtered.filter(inv => inv.invoice_date <= invoiceDateTo.value);
    }

    return filtered.sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date));
  });

  const totalInvoices = computed(() => filteredInvoices.value.length);

  const totalInvoiced = computed(() => {
    return filteredInvoices.value.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  });

  const pendingInvoices = computed(() => {
    return filteredInvoices.value.filter(inv => inv.status === 'pending').length;
  });

  const paidInvoices = computed(() => {
    return filteredInvoices.value.filter(inv => inv.status === 'paid').length;
  });

  async function loadInvoices() {
    try {
      isLoadingInvoices.value = true;
      // TODO: Implement backend endpoint
      // const response = await sparksApi.getInvoices();
      invoices.value = [];
    } catch (error) {
      console.error('Error loading invoices:', error);
      throw error;
    } finally {
      isLoadingInvoices.value = false;
    }
  }

  async function generateInvoice(invoiceData) {
    try {
      // TODO: Implement backend endpoint
      // const response = await sparksApi.generateInvoice(invoiceData);
      await loadInvoices();
      return { success: true };
    } catch (error) {
      console.error('Error generating invoice:', error);
      throw error;
    }
  }

  async function updateInvoice(invoiceId, updates) {
    try {
      // TODO: Implement backend endpoint
      // const response = await sparksApi.updateInvoice(invoiceId, updates);
      const index = invoices.value.findIndex(inv => inv.id === invoiceId);
      if (index !== -1) {
        invoices.value[index] = { ...invoices.value[index], ...updates };
      }
      return { success: true };
    } catch (error) {
      console.error('Error updating invoice:', error);
      throw error;
    }
  }

  async function markInvoicePaid(invoiceId, paymentData) {
    try {
      // TODO: Implement backend endpoint
      // const response = await sparksApi.markInvoicePaid(invoiceId, paymentData);
      await loadInvoices();
      return { success: true };
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      throw error;
    }
  }

  async function voidInvoice(invoiceId) {
    try {
      // TODO: Implement backend endpoint
      // const response = await sparksApi.voidInvoice(invoiceId);
      const index = invoices.value.findIndex(inv => inv.id === invoiceId);
      if (index !== -1) {
        invoices.value[index].status = 'voided';
      }
      return { success: true };
    } catch (error) {
      console.error('Error voiding invoice:', error);
      throw error;
    }
  }

  async function downloadInvoice(invoiceId) {
    try {
      // TODO: Implement backend endpoint
      // const response = await sparksApi.downloadInvoice(invoiceId);
      return { success: true };
    } catch (error) {
      console.error('Error downloading invoice:', error);
      throw error;
    }
  }

  async function openInvoiceGenerator(sparks, defaultRate, defaultCommissionRate, defaultCommissionType, creators, showWarning, showSuccess, showError) {
    // Get current unpaid sparks grouped by creator
    const unpaidByCreator = {};

    sparks
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

    await createInvoiceForCreator(creator, creatorSparks, creators, defaultRate, defaultCommissionRate, defaultCommissionType, showSuccess, showError);
  }

  async function createInvoiceForCreator(creatorName, creatorSparks, creators, defaultRate, defaultCommissionRate, defaultCommissionType, showSuccess, showError) {
    try {
      // Get payment settings for calculation
      const customCreator = creators.find(c => c.name === creatorName);
      const rate = customCreator?.rate || defaultRate;
      const commissionRate = customCreator?.commissionRate || defaultCommissionRate;
      const commissionType = customCreator?.commissionType || defaultCommissionType;

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
        await loadInvoices();
      } else {
        showError('Failed to create invoice');
      }
    } catch (error) {
      console.error('Failed to create invoice:', error);
      showError('Failed to create invoice');
    }
  }

  function viewInvoice(invoice) {
    // Open invoice HTML in new tab
    window.open(`/api/sparks/invoices/${invoice.id}/pdf`, '_blank');
  }

  async function downloadInvoiceWithPDF(invoice, showSuccess, showError) {
    // Generate and download invoice as PDF using jsPDF
    try {
      const { jsPDF } = await import('jspdf');

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
  }

  function editInvoice(invoice, showInfo) {
    // Open edit modal
    // This would open a modal to edit invoice details
    showInfo('Invoice editing will be available soon');
  }

  async function voidInvoiceWithConfirmation(invoice) {
    if (!confirm(`Are you sure you want to void invoice ${invoice.invoice_number}?`)) {
      return;
    }
    return await voidInvoice(invoice.id);
  }

  function clearFilters() {
    invoiceStatusFilter.value = 'all';
    invoiceCreatorFilter.value = 'all';
    invoiceDateFrom.value = '';
    invoiceDateTo.value = '';
  }

  return {
    invoices,
    isLoadingInvoices,
    invoiceStatusFilter,
    invoiceCreatorFilter,
    invoiceDateFrom,
    invoiceDateTo,
    invoiceStatusOptions,
    invoiceCreatorOptions,
    filteredInvoices,
    totalInvoices,
    totalInvoiced,
    pendingInvoices,
    paidInvoices,
    loadInvoices,
    generateInvoice,
    updateInvoice,
    markInvoicePaid,
    voidInvoice,
    downloadInvoice,
    openInvoiceGenerator,
    createInvoiceForCreator,
    viewInvoice,
    downloadInvoiceWithPDF,
    editInvoice,
    voidInvoiceWithConfirmation,
    clearFilters
  };
}