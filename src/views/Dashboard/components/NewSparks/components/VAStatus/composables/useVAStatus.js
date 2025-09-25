import { ref, computed } from 'vue';
import { sparksApi } from '@/services/api';
import { usePayments } from '../../Payments/composables/usePayments.js';

export function useVAStatus() {
  // Get payment settings
  const {
    defaultRate,
    defaultCommissionRate,
    defaultCommissionType
  } = usePayments();

  // State
  const isLoading = ref(false);
  const vaStats = ref([]);
  const selectedDateRange = ref({
    start: null,
    end: null
  });

  // Early report generation state
  const isGeneratingReport = ref(false);
  const reportPreview = ref([]);
  const showEarlyReportModal = ref(false);

  // Get current week date range (Monday to Sunday)
  const getCurrentWeekRange = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Sunday

    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0]
    };
  };

  // Get previous week date range
  const getPreviousWeekRange = () => {
    const currentWeek = getCurrentWeekRange();
    const prevWeekStart = new Date(currentWeek.start);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const prevWeekEnd = new Date(currentWeek.end);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);

    return {
      start: prevWeekStart.toISOString().split('T')[0],
      end: prevWeekEnd.toISOString().split('T')[0]
    };
  };

  // Calculate earnings for a specific VA
  const calculateVAEarnings = (sparks, vaEmail) => {
    let totalEarnings = 0;

    // Get custom rates for this specific VA from usePayments composable
    const { customCreatorRates } = usePayments();
    const customRates = customCreatorRates.value.get(vaEmail);

    console.log('Calculating VA earnings for:', vaEmail, {
      sparks: sparks.length,
      customRates,
      defaultRate: defaultRate.value,
      defaultCommissionRate: defaultCommissionRate.value,
      defaultCommissionType: defaultCommissionType.value
    });

    sparks.forEach(spark => {
      // Use custom rate for this VA if available, otherwise use spark custom rate, otherwise default
      const sparkRate = parseFloat(customRates?.rate) || parseFloat(spark.custom_rate) || parseFloat(defaultRate.value) || 1;
      const baseAmount = sparkRate;
      let commissionAmount = 0;

      // Use custom commission settings for this VA if available, otherwise use defaults
      const commissionRate = parseFloat(customRates?.commissionRate ?? defaultCommissionRate.value) || 0;
      const commissionType = customRates?.commissionType || defaultCommissionType.value || 'percentage';

      if (commissionType === 'percentage') {
        commissionAmount = baseAmount * (commissionRate / 100);
      } else {
        commissionAmount = commissionRate;
      }

      totalEarnings += baseAmount + commissionAmount;

      console.log('Spark calculation:', {
        sparkId: spark.id,
        vaEmail,
        sparkRate,
        baseAmount,
        commissionRate,
        commissionType,
        commissionAmount,
        runningTotal: totalEarnings
      });
    });

    console.log('Final earnings calculation for', vaEmail, ':', totalEarnings);
    return totalEarnings;
  };

  // Get weekly sparks by VA for a date range
  const getWeeklySparksByVA = async (startDate, endDate) => {
    try {
      isLoading.value = true;

      // This would normally be an API call to get sparks within date range
      // For now, we'll use the existing sparks API and filter locally
      const response = await sparksApi.listSparks();
      const allSparks = response.sparks || [];

      // Filter sparks by date range
      const filteredSparks = allSparks.filter(spark => {
        if (!spark.created_at) return false;
        const sparkDate = new Date(spark.created_at).toISOString().split('T')[0];
        return sparkDate >= startDate && sparkDate <= endDate;
      });

      // Group by VA (creator)
      const vaGroups = {};
      filteredSparks.forEach(spark => {
        const creator = spark.creator || 'Unassigned';
        if (!vaGroups[creator]) {
          vaGroups[creator] = {
            va_email: creator,
            sparks: [],
            daily_breakdown: {}
          };
        }
        vaGroups[creator].sparks.push(spark);

        // Daily breakdown
        const sparkDate = new Date(spark.created_at);
        const dayName = sparkDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        vaGroups[creator].daily_breakdown[dayName] = (vaGroups[creator].daily_breakdown[dayName] || 0) + 1;
      });

      // Convert to array with calculated stats
      return Object.values(vaGroups).map(group => ({
        ...group,
        sparks_created: group.sparks.length,
        week_start: startDate,
        week_end: endDate,
        // Calculate earnings using proper payment settings for this specific VA
        total_earnings: calculateVAEarnings(group.sparks, group.va_email),
        generation_type: 'current',
        generated_by: 'system',
        generated_at: new Date().toISOString()
      }));

    } catch (error) {
      console.error('Error fetching weekly sparks:', error);
      return [];
    } finally {
      isLoading.value = false;
    }
  };

  // Get current week sparks
  const getCurrentWeekSparks = async () => {
    const currentWeek = getCurrentWeekRange();
    return await getWeeklySparksByVA(currentWeek.start, currentWeek.end);
  };

  // Get previous week sparks
  const getPreviousWeekSparks = async () => {
    const previousWeek = getPreviousWeekRange();
    return await getWeeklySparksByVA(previousWeek.start, previousWeek.end);
  };

  // Get VA productivity stats
  const getVAProductivityStats = (currentWeekData, previousWeekData) => {
    const currentTotal = currentWeekData.reduce((sum, va) => sum + va.sparks_created, 0);
    const previousTotal = previousWeekData.reduce((sum, va) => sum + va.sparks_created, 0);

    const uniqueVAsThisWeek = currentWeekData.filter(va => va.sparks_created > 0).length;
    const uniqueVAsLastWeek = previousWeekData.filter(va => va.sparks_created > 0).length;

    const avgPerVAThisWeek = uniqueVAsThisWeek > 0 ? (currentTotal / uniqueVAsThisWeek).toFixed(1) : 0;
    const avgPerVALastWeek = uniqueVAsLastWeek > 0 ? (previousTotal / uniqueVAsLastWeek).toFixed(1) : 0;

    const weekOverWeekChange = previousTotal > 0 ?
      (((currentTotal - previousTotal) / previousTotal) * 100).toFixed(1) : 0;

    return {
      currentWeekTotal: currentTotal,
      previousWeekTotal: previousTotal,
      weekOverWeekChange: parseFloat(weekOverWeekChange),
      activeVAsThisWeek: uniqueVAsThisWeek,
      activeVAsLastWeek: uniqueVAsLastWeek,
      avgPerVAThisWeek: parseFloat(avgPerVAThisWeek),
      avgPerVALastWeek: parseFloat(avgPerVALastWeek)
    };
  };

  // Preview early report generation
  const previewEarlyReport = async (startDate, endDate, vaEmails = null) => {
    try {
      isLoading.value = true;

      const weeklyData = await getWeeklySparksByVA(startDate, endDate);

      // Filter by specific VAs if provided
      const filteredData = vaEmails && vaEmails.length > 0
        ? weeklyData.filter(va => vaEmails.includes(va.va_email))
        : weeklyData;

      // Check for existing reports (placeholder - would check database)
      const preview = filteredData.map(va => ({
        ...va,
        hasExistingReport: false, // TODO: Implement conflict detection
        sparkIds: va.sparks.map(s => s.id)
      }));

      reportPreview.value = preview;
      return preview;

    } catch (error) {
      console.error('Error generating preview:', error);
      return [];
    } finally {
      isLoading.value = false;
    }
  };

  // Check for existing reports in date range
  const checkExistingReports = async (startDate, endDate) => {
    try {
      // TODO: Implement API call to check existing reports
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('Error checking existing reports:', error);
      return [];
    }
  };

  // Generate early report
  const generateEarlyReport = async (startDate, endDate, vaEmails = null, generatedBy = 'admin') => {
    try {
      isGeneratingReport.value = true;

      // Preview the report first
      const preview = await previewEarlyReport(startDate, endDate, vaEmails);

      if (preview.length === 0) {
        throw new Error('No data found for the selected date range and VAs');
      }

      // Create payment entries for each VA
      const paymentEntries = preview.map(vaReport => ({
        id: `weekly_${vaReport.va_email}_${startDate}_${endDate}`,
        va_email: vaReport.va_email,
        week_start: startDate,
        week_end: endDate,
        sparks_count: vaReport.sparks_created,
        amount: vaReport.total_earnings,
        status: 'pending',
        payment_type: 'weekly',
        generation_type: 'early',
        generated_by: generatedBy,
        generated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }));

      // Store the payment entries (for now in memory, later this will be database)
      if (!globalThis.weeklyPaymentEntries) {
        globalThis.weeklyPaymentEntries = [];
      }

      // Add new entries, avoiding duplicates
      paymentEntries.forEach(newEntry => {
        const existingIndex = globalThis.weeklyPaymentEntries.findIndex(
          entry => entry.va_email === newEntry.va_email &&
                  entry.week_start === newEntry.week_start &&
                  entry.week_end === newEntry.week_end
        );

        if (existingIndex >= 0) {
          // Update existing entry
          globalThis.weeklyPaymentEntries[existingIndex] = newEntry;
        } else {
          // Add new entry
          globalThis.weeklyPaymentEntries.push(newEntry);
        }
      });

      console.log('Generated early report with payment entries:', {
        startDate,
        endDate,
        vaEmails,
        generatedBy,
        paymentEntries,
        totalEntries: globalThis.weeklyPaymentEntries.length
      });

      return {
        success: true,
        reports: preview,
        paymentEntries,
        generatedAt: new Date().toISOString(),
        totalReports: preview.length
      };

    } catch (error) {
      console.error('Error generating early report:', error);
      throw error;
    } finally {
      isGeneratingReport.value = false;
    }
  };

  // Get weekly comparison data
  const getWeeklyComparison = async () => {
    try {
      const [currentWeek, previousWeek] = await Promise.all([
        getCurrentWeekSparks(),
        getPreviousWeekSparks()
      ]);

      const stats = getVAProductivityStats(currentWeek, previousWeek);

      return {
        currentWeek,
        previousWeek,
        stats
      };
    } catch (error) {
      console.error('Error getting weekly comparison:', error);
      return {
        currentWeek: [],
        previousWeek: [],
        stats: {
          currentWeekTotal: 0,
          previousWeekTotal: 0,
          weekOverWeekChange: 0,
          activeVAsThisWeek: 0,
          activeVAsLastWeek: 0,
          avgPerVAThisWeek: 0,
          avgPerVALastWeek: 0
        }
      };
    }
  };

  // Computed properties
  const hasPreviewData = computed(() => reportPreview.value.length > 0);

  const totalPreviewAmount = computed(() => {
    return reportPreview.value.reduce((sum, va) => sum + va.total_earnings, 0).toFixed(2);
  });

  const conflictsDetected = computed(() => {
    return reportPreview.value.some(va => va.hasExistingReport);
  });

  // Get weekly payment entries
  const getWeeklyPaymentEntries = () => {
    if (!globalThis.weeklyPaymentEntries) {
      globalThis.weeklyPaymentEntries = [];
    }
    return [...globalThis.weeklyPaymentEntries].sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );
  };

  return {
    // State
    isLoading,
    vaStats,
    selectedDateRange,
    isGeneratingReport,
    reportPreview,
    showEarlyReportModal,

    // Computed
    hasPreviewData,
    totalPreviewAmount,
    conflictsDetected,

    // Methods
    getWeeklySparksByVA,
    getCurrentWeekSparks,
    getPreviousWeekSparks,
    getVAProductivityStats,
    getWeeklyComparison,
    previewEarlyReport,
    generateEarlyReport,
    checkExistingReports,
    getCurrentWeekRange,
    getPreviousWeekRange,
    getWeeklyPaymentEntries
  };
}