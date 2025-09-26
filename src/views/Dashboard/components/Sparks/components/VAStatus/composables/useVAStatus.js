import { ref, computed } from 'vue';
import { sparksApi } from '@/services/api';
import { usePayments } from '../../payments/composables/usePayments.js';
import { emitSparkEvent } from '../../sparks/composables/useSparks.js';

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
  const calculateVAEarnings = (sparks, vaEmail, paymentSettings) => {
    let totalEarnings = 0;

    // Use passed payment settings instead of creating new usePayments instance
    const customRates = paymentSettings.customCreatorRates.get(vaEmail);

    console.log('Calculating VA earnings for:', vaEmail, {
      sparks: sparks.length,
      customRates,
      defaultRate: paymentSettings.defaultRate,
      defaultCommissionRate: paymentSettings.defaultCommissionRate,
      defaultCommissionType: paymentSettings.defaultCommissionType
    });

    sparks.forEach(spark => {
      // Use custom rate for this VA if available, otherwise use spark custom rate, otherwise default
      const sparkRate = parseFloat(customRates?.rate) || parseFloat(spark.custom_rate) || parseFloat(paymentSettings.defaultRate) || 1;
      const baseAmount = sparkRate;
      let commissionAmount = 0;

      // Use custom commission settings for this VA if available, otherwise use defaults
      const commissionRate = parseFloat(customRates?.commissionRate ?? paymentSettings.defaultCommissionRate) || 0;
      const commissionType = customRates?.commissionType || paymentSettings.defaultCommissionType || 'percentage';

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

  // Get weekly sparks by VA for a date range (ALL SPARKS for stats calculation)
  const getWeeklySparksByVA = async (startDate, endDate, paymentSettings = null) => {
    try {
      isLoading.value = true;

      // This would normally be an API call to get sparks within date range
      // For now, we'll use the existing sparks API and filter locally
      const response = await sparksApi.listSparks();
      const allSparks = response.sparks || [];

      // Filter sparks by date range - INCLUDE ALL SPARKS regardless of payment status for stats
      const filteredSparks = allSparks.filter(spark => {
        if (!spark.created_at) return false;
        const sparkDate = new Date(spark.created_at).toISOString().split('T')[0];
        const isInDateRange = sparkDate >= startDate && sparkDate <= endDate;
        return isInDateRange; // No payment status filtering for stats
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
        total_earnings: paymentSettings ? calculateVAEarnings(group.sparks, group.va_email, paymentSettings) : 0,
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

  // Get weekly unpaid sparks by VA for productivity breakdown (UNPAID ONLY)
  const getWeeklyUnpaidSparksByVA = async (startDate, endDate, paymentSettings = null) => {
    try {
      isLoading.value = true;

      // This would normally be an API call to get sparks within date range
      // For now, we'll use the existing sparks API and filter locally
      const response = await sparksApi.listSparks();
      const allSparks = response.sparks || [];

      // Filter sparks by date range and exclude already paid sparks for productivity breakdown
      const filteredSparks = allSparks.filter(spark => {
        if (!spark.created_at) return false;
        const sparkDate = new Date(spark.created_at).toISOString().split('T')[0];
        const isInDateRange = sparkDate >= startDate && sparkDate <= endDate;
        const isNotPaid = !spark.payment_status || spark.payment_status !== 'paid';
        return isInDateRange && isNotPaid;
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
        total_earnings: paymentSettings ? calculateVAEarnings(group.sparks, group.va_email, paymentSettings) : 0,
        generation_type: 'current',
        generated_by: 'system',
        generated_at: new Date().toISOString()
      }));

    } catch (error) {
      console.error('Error fetching weekly unpaid sparks:', error);
      return [];
    } finally {
      isLoading.value = false;
    }
  };

  // Get current week sparks (ALL SPARKS for stats)
  const getCurrentWeekSparks = async (paymentSettings = null) => {
    const currentWeek = getCurrentWeekRange();
    return await getWeeklySparksByVA(currentWeek.start, currentWeek.end, paymentSettings);
  };

  // Get previous week sparks (ALL SPARKS for stats)
  const getPreviousWeekSparks = async (paymentSettings = null) => {
    const previousWeek = getPreviousWeekRange();
    return await getWeeklySparksByVA(previousWeek.start, previousWeek.end, paymentSettings);
  };

  // Get current week unpaid sparks for productivity breakdown
  const getCurrentWeekUnpaidSparks = async (paymentSettings = null) => {
    const currentWeek = getCurrentWeekRange();
    return await getWeeklyUnpaidSparksByVA(currentWeek.start, currentWeek.end, paymentSettings);
  };

  // Get previous week unpaid sparks for productivity breakdown
  const getPreviousWeekUnpaidSparks = async (paymentSettings = null) => {
    const previousWeek = getPreviousWeekRange();
    return await getWeeklyUnpaidSparksByVA(previousWeek.start, previousWeek.end, paymentSettings);
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
  const previewEarlyReport = async (startDate, endDate, vaEmails = null, paymentSettings = null) => {
    try {
      isLoading.value = true;

      // Use unpaid sparks for early report generation (to avoid double payment)
      const weeklyData = await getWeeklyUnpaidSparksByVA(startDate, endDate, paymentSettings);

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
  const generateEarlyReport = async (startDate, endDate, vaEmails = null, generatedBy = 'admin', paymentSettings = null) => {
    try {
      isGeneratingReport.value = true;

      // Preview the report first using unpaid sparks
      const preview = await previewEarlyReport(startDate, endDate, vaEmails, paymentSettings);

      if (preview.length === 0) {
        throw new Error('No data found for the selected date range and VAs');
      }

      // Collect all spark IDs that need to be marked as paid
      const allSparkIds = [];
      preview.forEach(vaReport => {
        if (vaReport.sparkIds) {
          allSparkIds.push(...vaReport.sparkIds);
        }
      });

      // Mark all sparks as paid to prevent double payment
      if (allSparkIds.length > 0) {
        console.log('Marking sparks as paid:', allSparkIds);
        await sparksApi.updatePaymentStatus(allSparkIds, 'paid');
      }

      // Create payment entries for each VA
      const paymentEntries = preview.map(vaReport => {
        // Get creator-specific payment method or fall back to default
        const creatorRates = paymentSettings?.customCreatorRates?.get(vaReport.va_email);
        const paymentMethod = creatorRates?.paymentMethod || paymentSettings?.defaultPaymentMethod || null;

        console.log(`Payment method for ${vaReport.va_email}:`, {
          creatorSpecific: creatorRates?.paymentMethod,
          default: paymentSettings?.defaultPaymentMethod,
          final: paymentMethod
        });

        return {
          va_email: vaReport.va_email,
          week_start: startDate,
          week_end: endDate,
          sparks_count: vaReport.sparks_created,
          amount: vaReport.total_earnings,
          original_amount: vaReport.total_earnings, // Store original calculated amount (using snake_case for database)
          payment_method: paymentMethod, // Use creator-specific or default payment method
          status: 'pending',
          payment_type: 'weekly',
          generation_type: 'early',
          generated_by: generatedBy,
          generated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          spark_ids: vaReport.sparkIds // Keep track of which sparks were included
        };
      });

      // Store the payment entries in database
      const savedEntries = [];
      for (const entry of paymentEntries) {
        try {
          const result = await sparksApi.createWeeklyPaymentEntry(entry);
          if (result.success) {
            savedEntries.push({ ...entry, id: result.id });
          }
        } catch (error) {
          console.error('Failed to save payment entry:', entry, error);
        }
      }

      console.log('Generated early report with payment entries:', {
        startDate,
        endDate,
        vaEmails,
        generatedBy,
        paymentEntries: savedEntries,
        sparksMarkedAsPaid: allSparkIds.length,
        totalEntriesSaved: savedEntries.length
      });

      // Emit event to notify Payments tab to refresh
      emitSparkEvent('paymentReportGenerated', {
        paymentEntries: savedEntries,
        sparksMarkedAsPaid: allSparkIds.length,
        vaEmails,
        totalReports: preview.length
      });

      return {
        success: true,
        reports: preview,
        paymentEntries: savedEntries,
        sparksMarkedAsPaid: allSparkIds.length,
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

  // Get weekly comparison data (ALL SPARKS for stats)
  const getWeeklyComparison = async (paymentSettings = null) => {
    try {
      const [currentWeek, previousWeek] = await Promise.all([
        getCurrentWeekSparks(paymentSettings),
        getPreviousWeekSparks(paymentSettings)
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

  // Get weekly productivity breakdown (UNPAID SPARKS ONLY for productivity breakdown)
  const getWeeklyProductivityBreakdown = async (paymentSettings = null) => {
    try {
      const [currentWeek, previousWeek] = await Promise.all([
        getCurrentWeekUnpaidSparks(paymentSettings),
        getPreviousWeekUnpaidSparks(paymentSettings)
      ]);

      const stats = getVAProductivityStats(currentWeek, previousWeek);

      return {
        currentWeek,
        previousWeek,
        stats
      };
    } catch (error) {
      console.error('Error getting weekly productivity breakdown:', error);
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
  const getWeeklyPaymentEntries = async (paymentSettings = null) => {
    try {
      console.log('🔍 useVAStatus: getWeeklyPaymentEntries called - fetching from database...');
      console.log('🔍 useVAStatus: Making API call to sparksApi.getWeeklyPaymentEntries()');
      const response = await sparksApi.getWeeklyPaymentEntries();
      console.log('🔍 useVAStatus: Weekly payment entries API response:', response);

      if (response && response.success) {
        const entries = response.entries || [];
        console.log('🔍 useVAStatus: Found', entries.length, 'weekly payment entries');
        console.log('🔍 useVAStatus: Raw entries:', entries);

        // Add original_amount field and apply payment method hierarchy if payment method is null/empty
        const entriesWithDefaults = entries.map(entry => {
          let paymentMethod = entry.payment_method;

          // If payment method is null or empty, apply hierarchy
          if (!paymentMethod && paymentSettings) {
            const creatorRates = paymentSettings.customCreatorRates?.get(entry.va_email);
            paymentMethod = creatorRates?.paymentMethod || paymentSettings.defaultPaymentMethod || null;
          }

          return {
            ...entry,
            original_amount: entry.original_amount || entry.amount, // Use existing original_amount or fallback to current amount
            payment_method: paymentMethod // Apply payment method hierarchy
          };
        });

        const sorted = entriesWithDefaults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        console.log('🔍 useVAStatus: Returning sorted entries with payment methods applied:', sorted);
        return sorted;
      } else {
        console.error('❌ useVAStatus: Failed to fetch weekly payment entries:', response?.error || 'No success flag');
        console.log('❌ useVAStatus: Full response object:', response);
        return [];
      }
    } catch (error) {
      console.error('❌ useVAStatus: Error fetching weekly payment entries:', error);
      console.error('❌ useVAStatus: Error details:', error.message, error.stack);
      return [];
    }
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
    getWeeklyUnpaidSparksByVA,
    getCurrentWeekSparks,
    getPreviousWeekSparks,
    getCurrentWeekUnpaidSparks,
    getPreviousWeekUnpaidSparks,
    getVAProductivityStats,
    getWeeklyComparison,
    getWeeklyProductivityBreakdown,
    previewEarlyReport,
    generateEarlyReport,
    checkExistingReports,
    getCurrentWeekRange,
    getPreviousWeekRange,
    getWeeklyPaymentEntries
  };
}