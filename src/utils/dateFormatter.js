/**
 * Date formatting utility using browser's default timezone
 */

// Get browser's timezone
export function getUserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Format date/time using browser's timezone
export function formatDateTime(timestamp, options = {}) {
  if (!timestamp) return 'N/A';
  
  const {
    format = 'full', // 'full', 'date', 'time', 'relative'
    showTimezone = false
  } = options;
  
  // Ensure we're working with a Date object
  // Handle ISO strings, timestamps, and Date objects
  let date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'string') {
    // Check if timestamp is in SQLite format without timezone (YYYY-MM-DD HH:MM:SS)
    // These should be treated as UTC times
    if (timestamp.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      // Add 'Z' to indicate UTC time
      date = new Date(timestamp.replace(' ', 'T') + 'Z');
    } else {
      date = new Date(timestamp);
    }
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else {
    return 'Invalid Date';
  }
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  
  // Get timezone info - this should automatically use browser's timezone
  const userTimezone = getUserTimezone();
  
  // Format based on type
  switch (format) {
    case 'date':
      return date.toLocaleDateString('en-US', {
        timeZone: userTimezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
    case 'time':
      return date.toLocaleTimeString('en-US', {
        timeZone: userTimezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      
    case 'relative':
      return getRelativeTime(date);
      
    case 'full':
    default:
      const formatted = date.toLocaleString('en-US', {
        timeZone: userTimezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      
      if (showTimezone) {
        const tzName = date.toLocaleString('en-US', {
          timeZone: userTimezone,
          timeZoneName: 'short'
        }).split(' ').pop();
        return `${formatted} ${tzName}`;
      }
      
      return formatted;
  }
}

// Format Unix timestamp (seconds since epoch)
export function formatUnixTimestamp(timestamp, options = {}) {
  if (!timestamp) return 'N/A';
  // Convert seconds to milliseconds
  return formatDateTime(timestamp * 1000, options);
}

// Get relative time (e.g., "2 hours ago")
export function getRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

// Debug function to show timestamp conversion
export function debugTimestamp(timestamp) {
  const date = new Date(timestamp);
  const userTimezone = getUserTimezone();
  
  console.log('Debug Timestamp Info:');
  console.log('Original timestamp:', timestamp);
  console.log('UTC time:', date.toUTCString());
  console.log('User timezone:', userTimezone);
  console.log('Local time:', date.toLocaleString('en-US', { timeZone: userTimezone }));
  console.log('ISO String:', date.toISOString());
  
  return {
    original: timestamp,
    utc: date.toUTCString(),
    timezone: userTimezone,
    local: date.toLocaleString('en-US', { timeZone: userTimezone }),
    iso: date.toISOString()
  };
}