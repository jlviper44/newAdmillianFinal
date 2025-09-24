import { ref } from 'vue';

export function useBulkOperations() {
  const isBulkEditMode = ref(false);
  const bulkEditValues = ref({});
  const isSavingBulk = ref(false);
  const selectedForDelete = ref([]);
  const showDeleteSelectedModal = ref(false);
  const isDeletingSelected = ref(false);

  const editingCells = ref({});
  const editingValues = ref({});
  const menuStates = ref({});

  const isEditing = (itemId, field) => {
    return editingCells.value[`${itemId}-${field}`] === true;
  };

  const startInlineEdit = (item, field, sparks) => {
    const currentItem = sparks.find(s => s.id === item.id) || item;
    const key = `${currentItem.id}-${field}`;
    editingCells.value[key] = true;
    editingValues.value[key] = currentItem[field];
    menuStates.value[key] = true;
  };

  const cancelInlineEdit = (itemId, field) => {
    const key = `${itemId}-${field}`;
    delete editingCells.value[key];
    delete editingValues.value[key];
    delete menuStates.value[key];
  };

  const saveInlineEdit = async (item, field, updateSparkFn) => {
    const key = `${item.id}-${field}`;
    const newValue = editingValues.value[key];

    if (newValue === item[field]) {
      cancelInlineEdit(item.id, field);
      return;
    }

    try {
      const fieldMapping = {
        'spark_code': 'sparkCode',
        'tiktok_link': 'tiktokLink',
        'offer_name': 'offerName'
      };

      const updateData = {};
      const apiField = fieldMapping[field] || field;
      if (newValue !== undefined) {
        updateData[apiField] = newValue;
      }

      await updateSparkFn(item.id, updateData);
      cancelInlineEdit(item.id, field);
    } catch (error) {
      console.error('Error saving inline edit:', error);
      throw error;
    }
  };

  const enableBulkEdit = () => {
    isBulkEditMode.value = true;
    bulkEditValues.value = {};
  };

  const cancelBulkEdit = () => {
    isBulkEditMode.value = false;
    bulkEditValues.value = {};
  };

  const saveBulkEdit = async (sparks, bulkUpdateSparksFn) => {
    const updates = Object.entries(bulkEditValues.value)
      .filter(([, value]) => value && Object.keys(value).length > 0)
      .map(([id, data]) => ({ id: parseInt(id), data }));

    if (updates.length === 0) {
      cancelBulkEdit();
      return;
    }

    try {
      isSavingBulk.value = true;
      await bulkUpdateSparksFn(updates);
      cancelBulkEdit();
    } catch (error) {
      console.error('Error saving bulk edits:', error);
      throw error;
    } finally {
      isSavingBulk.value = false;
    }
  };

  const deleteSelected = (selectedSparks) => {
    if (!selectedSparks || selectedSparks.length === 0) {
      return;
    }
    selectedForDelete.value = selectedSparks;
    showDeleteSelectedModal.value = true;
  };

  const confirmDeleteSelected = async (deleteSparkFn, fetchSparksFn, cancelBulkEditFn, showSuccessFn, showWarningFn, showErrorFn) => {
    try {
      isDeletingSelected.value = true;
      let deletedCount = 0;
      let failedCount = 0;

      for (const spark of selectedForDelete.value) {
        try {
          await deleteSparkFn(spark.id);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete spark ${spark.name || spark.id}:`, error);
          failedCount++;
        }
      }

      showDeleteSelectedModal.value = false;
      selectedForDelete.value = [];
      cancelBulkEditFn();
      await fetchSparksFn();

      if (failedCount > 0) {
        showWarningFn(`Deleted ${deletedCount} spark${deletedCount !== 1 ? 's' : ''}, ${failedCount} failed`);
      } else {
        showSuccessFn(`Successfully deleted ${deletedCount} spark${deletedCount !== 1 ? 's' : ''}`);
      }
    } catch (error) {
      console.error('Error deleting selected sparks:', error);
      showErrorFn('Failed to delete selected sparks');
    } finally {
      isDeletingSelected.value = false;
    }
  };

  const removeDuplicates = async (sparks, deleteSparkFn, fetchSparksFn, showSuccessFn, showInfoFn, showErrorFn, isLoading) => {
    try {
      isLoading.value = true;
      const uniqueMap = new Map();
      const duplicateIds = [];
      const reversedSparks = [...sparks].reverse();

      for (const spark of reversedSparks) {
        const tiktokKey = spark.tiktok_link ? `tiktok:${spark.tiktok_link}` : null;
        const sparkCodeKey = spark.spark_code ? `code:${spark.spark_code}` : null;

        if (tiktokKey && uniqueMap.has(tiktokKey)) {
          duplicateIds.push(spark.id);
          continue;
        }

        if (sparkCodeKey && uniqueMap.has(sparkCodeKey)) {
          duplicateIds.push(spark.id);
          continue;
        }

        if (tiktokKey) uniqueMap.set(tiktokKey, spark.id);
        if (sparkCodeKey) uniqueMap.set(sparkCodeKey, spark.id);
      }

      let deletedCount = 0;
      for (const id of duplicateIds) {
        try {
          await deleteSparkFn(id);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete duplicate spark ${id}:`, error);
        }
      }

      await fetchSparksFn();

      if (deletedCount > 0) {
        showSuccessFn(`Removed ${deletedCount} duplicate spark${deletedCount > 1 ? 's' : ''}`);
      } else {
        showInfoFn('No duplicates found to remove');
      }
    } catch (error) {
      console.error('Error removing duplicates:', error);
      showErrorFn('Failed to remove duplicates');
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isBulkEditMode,
    bulkEditValues,
    isSavingBulk,
    selectedForDelete,
    showDeleteSelectedModal,
    isDeletingSelected,
    editingCells,
    editingValues,
    menuStates,
    isEditing,
    startInlineEdit,
    cancelInlineEdit,
    saveInlineEdit,
    enableBulkEdit,
    cancelBulkEdit,
    saveBulkEdit,
    deleteSelected,
    confirmDeleteSelected,
    removeDuplicates
  };
}