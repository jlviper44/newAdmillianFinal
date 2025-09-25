import { ref } from 'vue';

export function useSparkUtils() {
  const snackbarText = ref('');
  const snackbarColor = ref('success');
  const showSnackbar = ref(false);

  const getTypeColor = (type) => {
    const colors = {
      'auto': 'primary',
      'manual': 'secondary',
      'template': 'info'
    };
    return colors[type] || 'grey';
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': 'success',
      'inactive': 'error',
      'pending': 'warning',
      'untested': 'grey',
      'tested': 'info'
    };
    return colors[status] || 'grey';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'untested': 'Untested',
      'tested': 'Tested',
      'active': 'Active',
      'inactive': 'Inactive',
      'pending': 'Pending'
    };
    return labels[status] || status;
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      showSuccess('Spark code copied to clipboard');
    } catch (error) {
      console.error('Failed to copy:', error);
      showError('Failed to copy spark code');
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleImageError = (event) => {
    event.target.src = '/placeholder-image.png';
  };

  const getInvoiceStatusColor = (status) => {
    const colors = {
      'pending': 'warning',
      'paid': 'success',
      'voided': 'error',
      'overdue': 'error'
    };
    return colors[status] || 'grey';
  };

  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) {
      showWarning('No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',')
          ? `"${value}"`
          : value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    showSuccess('Exported successfully');
  };

  const showSuccess = (message) => {
    snackbarText.value = message;
    snackbarColor.value = 'success';
    showSnackbar.value = true;
  };

  const showError = (message) => {
    snackbarText.value = message;
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  };

  const showInfo = (message) => {
    snackbarText.value = message;
    snackbarColor.value = 'info';
    showSnackbar.value = true;
  };

  const showWarning = (message) => {
    snackbarText.value = message;
    snackbarColor.value = 'warning';
    showSnackbar.value = true;
  };

  return {
    snackbarText,
    snackbarColor,
    showSnackbar,
    getTypeColor,
    getStatusColor,
    getStatusLabel,
    copyCode,
    formatDate,
    handleImageError,
    getInvoiceStatusColor,
    exportToCSV,
    showSuccess,
    showError,
    showInfo,
    showWarning
  };
}