import { ref, computed, onMounted } from 'vue';
import { sparksApi } from '@/services/api';

export function usePayments() {
  // State
  const defaultRate = ref(1);
  const defaultCommissionRate = ref(0);
  const defaultCommissionType = ref('percentage');
  const defaultPaymentMethod = ref('');
  const isSavingSettings = ref(false);
  const isLoadingSettings = ref(false);
  const paymentSettingsLoaded = ref(false);

  // Store for custom creator rates
  const customCreatorRates = ref(new Map());

  // Payment history state
  const paymentHistory = ref([]);
  const isLoadingHistory = ref(false);
  const historyDateFrom = ref('');
  const historyDateTo = ref('');
  const historyCreatorFilter = ref('all');

  // Undo functionality
  const lastPaymentAction = ref(null);
  const showUndoButton = ref(false);
  const undoTimeoutId = ref(null);

  // History filters
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

  // Statistics
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

  // Function to clean up old localStorage data (one-time cleanup)
  const cleanupLocalStorage = () => {
    try {
      console.log('Cleaning up old payment settings from localStorage...');
      localStorage.removeItem('va_payment_settings');
      console.log('localStorage cleanup completed');
    } catch (error) {
      console.error('Error cleaning up localStorage:', error);
    }
  };

  // Load payment settings from API
  const loadPaymentSettings = async () => {
    try {
      isLoadingSettings.value = true;
      console.log('Loading payment settings from API...');

      const response = await sparksApi.getPaymentSettings();
      console.log('Payment settings loaded:', response);

      if (response.success && response.settings) {
        // Find default settings
        const defaultSettings = response.settings.find(s => s.setting_type === 'global' || s.setting_type === 'default');
        if (defaultSettings) {
          defaultRate.value = defaultSettings.base_rate || defaultSettings.rate_per_video || 1;
          defaultCommissionRate.value = defaultSettings.commission_rate || 0;
          defaultCommissionType.value = defaultSettings.commission_type || 'percentage';
          defaultPaymentMethod.value = defaultSettings.payment_method || '';
        }

        // Load creator-specific settings
        const creatorSettings = response.settings.filter(s => s.setting_type === 'creator' && s.creator_name);
        customCreatorRates.value = new Map();

        creatorSettings.forEach(setting => {
          customCreatorRates.value.set(setting.creator_name, {
            rate: setting.base_rate || setting.rate_per_video || defaultRate.value,
            commissionRate: setting.commission_rate || 0,
            commissionType: setting.commission_type || 'percentage',
            paymentMethod: setting.payment_method || null
          });
        });

        console.log('Custom creator rates loaded:', Array.from(customCreatorRates.value.entries()));
      }

      paymentSettingsLoaded.value = true;
    } catch (error) {
      console.error('Error loading payment settings:', error);
      // Set defaults on error
      paymentSettingsLoaded.value = true;
    } finally {
      isLoadingSettings.value = false;
    }
  };

  // Save payment settings to API
  const savePaymentSettings = async () => {
    try {
      isSavingSettings.value = true;
      console.log('Saving payment settings to API...');

      // Prepare settings data
      const settingsToSave = [
        // Default settings
        {
          settingType: 'global',
          creatorName: null,
          baseRate: defaultRate.value,
          commissionRate: defaultCommissionRate.value,
          commissionType: defaultCommissionType.value,
          paymentMethod: defaultPaymentMethod.value
        }
      ];

      // Add creator-specific settings
      customCreatorRates.value.forEach((rates, creatorName) => {
        settingsToSave.push({
          settingType: 'creator',
          creatorName,
          baseRate: rates.rate,
          commissionRate: rates.commissionRate,
          commissionType: rates.commissionType,
          paymentMethod: rates.paymentMethod
        });
      });

      // Save each setting
      for (const setting of settingsToSave) {
        const response = await sparksApi.savePaymentSettings(setting);
        if (!response.success) {
          throw new Error(response.error || 'Failed to save setting');
        }
      }

      console.log('Payment settings saved successfully');
      return { success: true };
    } catch (error) {
      console.error('Error saving payment settings:', error);
      throw error;
    } finally {
      isSavingSettings.value = false;
    }
  };

  // Update custom creator rate
  const updateCreatorRate = (creatorName, rate, commissionRate, commissionType, paymentMethod) => {
    customCreatorRates.value.set(creatorName, {
      rate: parseFloat(rate) || defaultRate.value,
      commissionRate: parseFloat(commissionRate) || defaultCommissionRate.value,
      commissionType: commissionType || defaultCommissionType.value,
      paymentMethod: paymentMethod || null
    });
  };

  // Get creators with their rates
  const getCreatorsWithRates = (sparks) => {
    const creatorsMap = new Map();

    sparks.forEach(spark => {
      if (spark.creator && spark.creator.trim() !== '') {
        if (!creatorsMap.has(spark.creator)) {
          const customRates = customCreatorRates.value.get(spark.creator);
          creatorsMap.set(spark.creator, {
            id: spark.creator,
            name: spark.creator,
            rate: customRates?.rate || defaultRate.value,
            commissionRate: customRates?.commissionRate || defaultCommissionRate.value,
            commissionType: customRates?.commissionType || defaultCommissionType.value,
            paymentMethod: customRates?.paymentMethod || null
          });
        }
      }
    });

    return Array.from(creatorsMap.values());
  };

  // Payment calculations (keeping existing logic)
  const getPaymentsByCreator = (sparks) => {
    const byCreator = {};

    sparks.forEach(spark => {
      const creator = spark.creator || 'None';
      if (!byCreator[creator]) {
        byCreator[creator] = {
          creator,
          videos: [],
          rate: spark.custom_rate || defaultRate.value,
          commissionRate: defaultCommissionRate.value,
          commissionType: defaultCommissionType.value,
          baseAmount: 0,
          commissionAmount: 0,
          total: 0
        };
      }

      if (!spark.payment_status || spark.payment_status !== 'paid') {
        byCreator[creator].videos.push(spark);

        const sparkRate = spark.custom_rate || defaultRate.value;
        const baseAmount = sparkRate;
        let commissionAmount = 0;

        if (defaultCommissionType.value === 'percentage') {
          commissionAmount = baseAmount * (defaultCommissionRate.value / 100);
        } else {
          commissionAmount = defaultCommissionRate.value;
        }

        byCreator[creator].baseAmount += baseAmount;
        byCreator[creator].commissionAmount += commissionAmount;
        byCreator[creator].total += baseAmount + commissionAmount;
      }
    });

    return Object.values(byCreator).filter(creator => creator.videos.length > 0);
  };

  const getTotalOwed = (sparks) => {
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
      }, 0).toFixed(2);
  };

  const getTotalPaid = (sparks) => {
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
      }, 0).toFixed(2);
  };

  const getUnpaidSparks = (sparks) => {
    return sparks.filter(s => !s.payment_status || s.payment_status !== 'paid').length;
  };

  const getActiveCreators = (sparks) => {
    const creators = new Set(
      sparks
        .filter(s => (!s.payment_status || s.payment_status !== 'paid') && s.creator)
        .map(s => s.creator)
    );
    return creators.size;
  };

  // Payment history functions
  const loadPaymentHistory = async () => {
    try {
      isLoadingHistory.value = true;
      const response = await sparksApi.getPaymentHistory();

      if (response.success && response.history) {
        paymentHistory.value = response.history;
      }
    } catch (error) {
      console.error('Error loading payment history:', error);
      throw error;
    } finally {
      isLoadingHistory.value = false;
    }
  };

  // Payment actions (keeping existing logic for now)
  const markCreatorPaid = async (creator, sparks, customAmount = null) => {
    try {
      const unpaidSparks = sparks.filter(spark =>
        spark.creator === creator &&
        (!spark.payment_status || spark.payment_status !== 'paid')
      );

      if (unpaidSparks.length === 0) {
        throw new Error('No unpaid sparks found for this creator');
      }

      console.log(`Marking ${unpaidSparks.length} sparks as paid for creator: ${creator}`, {
        customAmount,
        sparkIds: unpaidSparks.map(s => s.id)
      });

      lastPaymentAction.value = {
        type: 'payment',
        creator,
        sparkIds: unpaidSparks.map(s => s.id),
        amount: customAmount,
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

      return { success: true };
    } catch (error) {
      console.error('Error marking creator as paid:', error);
      throw error;
    }
  };

  const voidCreatorPayment = async (creator, sparks) => {
    // Keeping existing logic for now
    try {
      const unpaidSparks = sparks.filter(spark =>
        spark.creator === creator &&
        (!spark.payment_status || spark.payment_status !== 'paid')
      );

      if (unpaidSparks.length === 0) {
        throw new Error('No unpaid sparks found for this creator');
      }

      console.log(`Voiding payment for ${unpaidSparks.length} sparks for creator: ${creator}`, {
        sparkIds: unpaidSparks.map(s => s.id)
      });

      lastPaymentAction.value = {
        type: 'void',
        creator,
        sparkIds: unpaidSparks.map(s => s.id),
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

      return { success: true };
    } catch (error) {
      console.error('Error voiding creator payment:', error);
      throw error;
    }
  };

  const undoLastPayment = async () => {
    if (!lastPaymentAction.value) return;

    try {
      console.log('Undoing payment for:', lastPaymentAction.value);

      showUndoButton.value = false;
      lastPaymentAction.value = null;
      if (undoTimeoutId.value) {
        clearTimeout(undoTimeoutId.value);
      }

      return { success: true };
    } catch (error) {
      console.error('Error undoing payment:', error);
      throw error;
    }
  };

  const clearHistoryFilters = () => {
    historyDateFrom.value = '';
    historyDateTo.value = '';
    historyCreatorFilter.value = 'all';
  };

  // One-time cleanup on initialization
  const performOneTimeCleanup = () => {
    const cleanupDone = localStorage.getItem('payment_settings_cleanup_done');
    if (!cleanupDone) {
      cleanupLocalStorage();
      localStorage.setItem('payment_settings_cleanup_done', 'true');
    }
  };

  // Initialize on mount
  onMounted(async () => {
    performOneTimeCleanup();
    await loadPaymentSettings();
  });

  return {
    // State
    defaultRate,
    defaultCommissionRate,
    defaultCommissionType,
    defaultPaymentMethod,
    paymentSettingsLoaded,
    isLoadingSettings,
    isSavingSettings,
    customCreatorRates,
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

    // Methods
    getPaymentsByCreator,
    getTotalOwed,
    getTotalPaid,
    getUnpaidSparks,
    getActiveCreators,
    getCreatorsWithRates,
    updateCreatorRate,
    loadPaymentSettings,
    savePaymentSettings,
    loadPaymentHistory,
    markCreatorPaid,
    voidCreatorPayment,
    undoLastPayment,
    clearHistoryFilters
  };
}