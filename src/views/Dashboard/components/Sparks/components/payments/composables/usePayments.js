import { ref, computed } from 'vue';
import { sparksApi } from '@/services/api';

export function usePayments() {
  const defaultRate = ref(1);
  const defaultCommissionRate = ref(0);
  const defaultCommissionType = ref('percentage');
  const paymentSettingsLoaded = ref(false);
  const isSavingSettings = ref(false);

  const paymentHistory = ref([]);
  const isLoadingHistory = ref(false);
  const historyDateFrom = ref('');
  const historyDateTo = ref('');
  const historyCreatorFilter = ref('all');

  const lastPaymentAction = ref(null);
  const showUndoButton = ref(false);
  const undoTimeoutId = ref(null);

  const historyCreatorOptions = computed(() => {
    const creators = new Set(paymentHistory.value.map(p => p.creator).filter(Boolean));
    return [
      { title: 'All Creators', value: 'all' },
      ...Array.from(creators).map(creator => ({ title: creator, value: creator }))
    ];
  });

  const filteredPaymentHistory = computed(() => {
    let filtered = paymentHistory.value;

    if (historyDateFrom.value) {
      filtered = filtered.filter(p => p.paymentDate >= historyDateFrom.value);
    }

    if (historyDateTo.value) {
      filtered = filtered.filter(p => p.paymentDate <= historyDateTo.value);
    }

    if (historyCreatorFilter.value !== 'all') {
      filtered = filtered.filter(p => p.creator === historyCreatorFilter.value);
    }

    return filtered.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
  });

  const totalPaidInPeriod = computed(() => {
    return filteredPaymentHistory.value
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  });

  const totalPayments = computed(() => {
    return filteredPaymentHistory.value.filter(p => p.status === 'paid').length;
  });

  const totalVideosPaid = computed(() => {
    return filteredPaymentHistory.value
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + (p.videoCount || 0), 0);
  });

  function getPaymentsByCreator(sparks) {
    const byCreator = {};

    sparks.forEach(spark => {
      const creator = spark.creator || 'None';
      if (!byCreator[creator]) {
        byCreator[creator] = {
          creator,
          unpaidSparks: [],
          unpaidCount: 0,
          unpaidAmount: 0
        };
      }

      if (!spark.payment_status || spark.payment_status !== 'paid') {
        byCreator[creator].unpaidSparks.push(spark);
        byCreator[creator].unpaidCount++;

        const sparkRate = spark.custom_rate || defaultRate.value;
        const baseAmount = sparkRate;
        let commissionAmount = 0;

        if (defaultCommissionType.value === 'percentage') {
          commissionAmount = baseAmount * (defaultCommissionRate.value / 100);
        } else {
          commissionAmount = defaultCommissionRate.value;
        }

        byCreator[creator].unpaidAmount += baseAmount + commissionAmount;
      }
    });

    return byCreator;
  }

  function getTotalOwed(sparks) {
    return sparks
      .filter(s => !s.payment_status || s.payment_status !== 'paid')
      .reduce((sum, spark) => {
        const sparkRate = spark.custom_rate || defaultRate.value;
        const baseAmount = sparkRate;
        let commissionAmount = 0;

        if (defaultCommissionType.value === 'percentage') {
          commissionAmount = baseAmount * (defaultCommissionRate.value / 100);
        } else {
          commissionAmount = defaultCommissionRate.value;
        }

        return sum + baseAmount + commissionAmount;
      }, 0);
  }

  function getTotalPaid(sparks) {
    return sparks
      .filter(s => s.payment_status === 'paid')
      .reduce((sum, spark) => {
        const sparkRate = spark.custom_rate || defaultRate.value;
        const baseAmount = sparkRate;
        let commissionAmount = 0;

        if (defaultCommissionType.value === 'percentage') {
          commissionAmount = baseAmount * (defaultCommissionRate.value / 100);
        } else {
          commissionAmount = defaultCommissionRate.value;
        }

        return sum + baseAmount + commissionAmount;
      }, 0);
  }

  function getUnpaidSparks(sparks) {
    return sparks.filter(s => !s.payment_status || s.payment_status !== 'paid');
  }

  function getActiveCreators(sparks) {
    const creators = new Set(
      sparks
        .filter(s => (!s.payment_status || s.payment_status !== 'paid') && s.creator)
        .map(s => s.creator)
    );
    return creators.size;
  }

  async function loadPaymentSettings() {
    try {
      // TODO: Implement backend endpoint
      // const response = await sparksApi.getPaymentSettings();
      paymentSettingsLoaded.value = true;
    } catch (error) {
      console.error('Error loading payment settings:', error);
      throw error;
    }
  }

  async function savePaymentSettings() {
    try {
      isSavingSettings.value = true;
      // TODO: Implement backend endpoint
      // const response = await sparksApi.savePaymentSettings({
      //   default_rate: defaultRate.value,
      //   commission_rate: defaultCommissionRate.value,
      //   commission_type: defaultCommissionType.value
      // });
      return { success: true };
    } catch (error) {
      console.error('Error saving payment settings:', error);
      throw error;
    } finally {
      isSavingSettings.value = false;
    }
  }

  async function loadPaymentHistory() {
    try {
      isLoadingHistory.value = true;
      // TODO: Implement backend endpoint
      // const response = await sparksApi.getPaymentHistory();
      paymentHistory.value = [];
    } catch (error) {
      console.error('Error loading payment history:', error);
      throw error;
    } finally {
      isLoadingHistory.value = false;
    }
  }

  async function recordPayment(paymentData) {
    try {
      // TODO: Implement backend endpoint
      // const response = await sparksApi.recordPayment(paymentData);
      lastPaymentAction.value = {
        type: 'payment',
        data: paymentData,
        timestamp: Date.now()
      };
      showUndoButton.value = true;

      if (undoTimeoutId.value) {
        clearTimeout(undoTimeoutId.value);
      }

      undoTimeoutId.value = setTimeout(() => {
        showUndoButton.value = false;
        lastPaymentAction.value = null;
      }, 10000);

      await loadPaymentHistory();
      return { success: true };
    } catch (error) {
      console.error('Error recording payment:', error);
      throw error;
    }
  }

  async function undoLastPayment() {
    if (!lastPaymentAction.value) return;

    try {
      // TODO: Implement backend endpoint
      // const response = await sparksApi.undoPayment(lastPaymentAction.value.data);
      showUndoButton.value = false;
      lastPaymentAction.value = null;
      if (undoTimeoutId.value) {
        clearTimeout(undoTimeoutId.value);
      }
      await loadPaymentHistory();
      return { success: true };
    } catch (error) {
      console.error('Error undoing payment:', error);
      throw error;
    }
  }

  function clearHistoryFilters() {
    historyDateFrom.value = '';
    historyDateTo.value = '';
    historyCreatorFilter.value = 'all';
  }

  return {
    defaultRate,
    defaultCommissionRate,
    defaultCommissionType,
    paymentSettingsLoaded,
    isSavingSettings,
    paymentHistory,
    isLoadingHistory,
    historyDateFrom,
    historyDateTo,
    historyCreatorFilter,
    historyCreatorOptions,
    filteredPaymentHistory,
    totalPaidInPeriod,
    totalPayments,
    totalVideosPaid,
    lastPaymentAction,
    showUndoButton,
    getPaymentsByCreator,
    getTotalOwed,
    getTotalPaid,
    getUnpaidSparks,
    getActiveCreators,
    loadPaymentSettings,
    savePaymentSettings,
    loadPaymentHistory,
    recordPayment,
    undoLastPayment,
    clearHistoryFilters
  };
}