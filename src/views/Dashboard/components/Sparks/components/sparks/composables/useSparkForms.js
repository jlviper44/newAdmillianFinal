import { ref, computed } from 'vue';

export function useSparkForms(user, isAssistingUser) {
  const showCreateModal = ref(false);
  const showBulkAddModal = ref(false);
  const editingSparkData = ref(null);

  const sparkForm = ref({
    name: '',
    creator: isAssistingUser?.value && user?.value?.originalEmail ? user.value.originalEmail : undefined,
    tiktokLink: '',
    sparkCode: '',
    type: 'auto',
    status: 'untested'
  });

  const bulkAddForm = ref({
    baseName: '',
    type: 'auto',
    creator: isAssistingUser?.value && user?.value?.originalEmail
      ? user.value.originalEmail
      : (!isAssistingUser?.value && user?.value?.email ? user.value.email : undefined),
    status: 'untested',
    sparkCodes: '',
    tiktokLinks: '',
    enableCommentBot: false,
    commentGroupId: null,
    likeCount: 0,
    saveCount: 0
  });

  const bulkAddPreview = ref([]);
  const bulkAddValidationMessage = ref('');
  const bulkAddLoading = ref(false);

  const generateDefaultName = (creator, type) => {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const creatorPrefix = creator ? creator.split('@')[0] : 'unnamed';
    return `${creatorPrefix}_${type}_${dateStr}`;
  };

  const openCreateModal = () => {
    sparkForm.value = {
      name: '',
      creator: isAssistingUser?.value && user?.value?.originalEmail ? user.value.originalEmail : undefined,
      tiktokLink: '',
      sparkCode: '',
      type: 'auto',
      status: 'untested'
    };
    editingSparkData.value = null;
    showCreateModal.value = true;
  };

  const editSpark = (spark) => {
    sparkForm.value = {
      name: spark.name || '',
      creator: spark.creator || '',
      tiktokLink: spark.tiktok_link || '',
      sparkCode: spark.spark_code || '',
      type: spark.type || 'auto',
      status: spark.status || 'untested'
    };
    editingSparkData.value = spark;
    showCreateModal.value = true;
  };

  const bulkAdd = () => {
    bulkAddForm.value = {
      baseName: '',
      type: 'auto',
      creator: isAssistingUser?.value && user?.value?.originalEmail
        ? user.value.originalEmail
        : (!isAssistingUser?.value && user?.value?.email ? user.value.email : undefined),
      status: 'untested',
      sparkCodes: '',
      tiktokLinks: '',
      enableCommentBot: false,
      commentGroupId: null,
      likeCount: 0,
      saveCount: 0
    };
    bulkAddPreview.value = [];
    bulkAddValidationMessage.value = '';
    showBulkAddModal.value = true;
  };

  const autoPreviewBulkAdd = () => {
    const codes = bulkAddForm.value.sparkCodes
      .split('\n')
      .map(c => c.trim())
      .filter(c => c);

    const links = bulkAddForm.value.tiktokLinks
      .split('\n')
      .map(l => l.trim())
      .filter(l => l);

    if (codes.length === 0 && links.length === 0) {
      bulkAddPreview.value = [];
      bulkAddValidationMessage.value = '';
      return;
    }

    if (codes.length > 0 && links.length > 0 && codes.length !== links.length) {
      bulkAddValidationMessage.value = `Warning: ${codes.length} codes but ${links.length} links. They should match.`;
    } else {
      bulkAddValidationMessage.value = '';
    }

    const maxLength = Math.max(codes.length, links.length);
    bulkAddPreview.value = Array.from({ length: maxLength }, (_, i) => ({
      name: bulkAddForm.value.baseName
        ? `${bulkAddForm.value.baseName}_${i + 1}`
        : generateDefaultName(bulkAddForm.value.creator, bulkAddForm.value.type) + `_${i + 1}`,
      creator: bulkAddForm.value.creator,
      sparkCode: codes[i] || '',
      tiktokLink: links[i] || '',
      type: bulkAddForm.value.type,
      status: bulkAddForm.value.status
    }));
  };

  const previewBulkAdd = () => {
    autoPreviewBulkAdd();
  };

  return {
    showCreateModal,
    showBulkAddModal,
    editingSparkData,
    sparkForm,
    bulkAddForm,
    bulkAddPreview,
    bulkAddValidationMessage,
    bulkAddLoading,
    generateDefaultName,
    openCreateModal,
    editSpark,
    bulkAdd,
    autoPreviewBulkAdd,
    previewBulkAdd
  };
}