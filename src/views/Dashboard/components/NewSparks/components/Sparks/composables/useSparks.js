import { ref, computed } from 'vue';
import { sparksApi } from '@/services/api';

export function useSparks() {
  const sparks = ref([]);
  const isLoading = ref(false);
  const searchQuery = ref('');
  const typeFilter = ref('all');
  const statusFilter = ref('all');
  const creatorFilter = ref('all');
  const showThumbnails = ref(true);

  const filteredSparks = computed(() => {
    let filtered = sparks.value;

    if (searchQuery.value) {
      const search = searchQuery.value.toLowerCase();
      filtered = filtered.filter(spark =>
        spark.name?.toLowerCase().includes(search) ||
        spark.spark_code?.toLowerCase().includes(search) ||
        spark.tiktok_link?.toLowerCase().includes(search) ||
        spark.offer_name?.toLowerCase().includes(search) ||
        spark.creator?.toLowerCase().includes(search)
      );
    }

    if (typeFilter.value !== 'all') {
      filtered = filtered.filter(spark => spark.type === typeFilter.value);
    }

    if (statusFilter.value !== 'all') {
      filtered = filtered.filter(spark => spark.status === statusFilter.value);
    }

    if (creatorFilter.value !== 'all') {
      filtered = filtered.filter(spark => spark.creator === creatorFilter.value);
    }

    return filtered;
  });

  const typeOptions = computed(() => {
    const types = new Set(sparks.value.map(spark => spark.type).filter(Boolean));
    return ['all', ...Array.from(types)];
  });

  const statusOptions = computed(() => {
    const statuses = new Set(sparks.value.map(spark => spark.status).filter(Boolean));
    return ['all', ...Array.from(statuses)];
  });

  const creatorOptions = computed(() => {
    const creators = new Set(sparks.value.map(spark => spark.creator).filter(Boolean));
    return ['all', ...Array.from(creators)];
  });

  const typeItems = computed(() => {
    const types = new Set(sparks.value.map(spark => spark.type).filter(Boolean));
    return Array.from(types);
  });

  async function fetchSparks() {
    try {
      isLoading.value = true;
      const response = await sparksApi.listSparks();
      if (response.success) {
        sparks.value = response.sparks || [];
      }
    } catch (error) {
      console.error('Error fetching sparks:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  async function createSpark(sparkData) {
    try {
      const response = await sparksApi.createSpark(sparkData);
      if (response.success && response.spark) {
        sparks.value.unshift(response.spark);
        return response.spark;
      }
      throw new Error('Failed to create spark');
    } catch (error) {
      console.error('Error creating spark:', error);
      throw error;
    }
  }

  async function updateSpark(sparkId, sparkData) {
    try {
      const response = await sparksApi.updateSpark(sparkId, sparkData);
      if (response.success && response.spark) {
        const index = sparks.value.findIndex(s => s.id === sparkId);
        if (index !== -1) {
          sparks.value[index] = response.spark;
        }
        return response.spark;
      }
      throw new Error('Failed to update spark');
    } catch (error) {
      console.error('Error updating spark:', error);
      throw error;
    }
  }

  async function deleteSpark(sparkId) {
    try {
      const response = await sparksApi.deleteSpark(sparkId);
      if (response.success) {
        sparks.value = sparks.value.filter(s => s.id !== sparkId);
        return true;
      }
      throw new Error('Failed to delete spark');
    } catch (error) {
      console.error('Error deleting spark:', error);
      throw error;
    }
  }

  async function bulkUpdateSparks(updates) {
    try {
      const promises = updates.map(({ id, data }) => updateSpark(id, data));
      await Promise.all(promises);
      await fetchSparks();
    } catch (error) {
      console.error('Error bulk updating sparks:', error);
      throw error;
    }
  }

  function clearFilters() {
    searchQuery.value = '';
    typeFilter.value = 'all';
    statusFilter.value = 'all';
    creatorFilter.value = 'all';
  }

  function detectDuplicates() {
    const sparkCodeMap = new Map();
    sparks.value.forEach(spark => {
      if (spark.spark_code) {
        const code = spark.spark_code.trim().toLowerCase();
        if (sparkCodeMap.has(code)) {
          sparkCodeMap.get(code).push(spark);
        } else {
          sparkCodeMap.set(code, [spark]);
        }
      }
    });

    const duplicates = Array.from(sparkCodeMap.entries())
      .filter(([, sparks]) => sparks.length > 1)
      .map(([code, sparks]) => ({
        code,
        sparks: sparks.map(s => s.id),
        count: sparks.length
      }));

    return {
      hasDuplicates: duplicates.length > 0,
      duplicates,
      duplicateIds: new Set(duplicates.flatMap(d => d.sparks))
    };
  }

  return {
    sparks,
    isLoading,
    searchQuery,
    typeFilter,
    statusFilter,
    creatorFilter,
    showThumbnails,
    filteredSparks,
    typeOptions,
    statusOptions,
    creatorOptions,
    typeItems,
    fetchSparks,
    createSpark,
    updateSpark,
    deleteSpark,
    bulkUpdateSparks,
    clearFilters,
    detectDuplicates
  };
}