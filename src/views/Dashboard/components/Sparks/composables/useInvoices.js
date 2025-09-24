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
    clearFilters
  };
}