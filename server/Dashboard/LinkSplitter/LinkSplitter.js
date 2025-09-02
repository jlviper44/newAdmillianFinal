// ============= UTILITY FUNCTIONS =============

/**
 * Generate a short unique ID
 */
function generateShortId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a UUID v4
 */
function generateId() {
  // Generate UUID v4 using crypto.randomUUID() or fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback UUID v4 generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Detect device type from user agent
 */
function detectDevice(userAgent) {
  if (!userAgent) return 'unknown';
  
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  } else {
    return 'desktop';
  }
}

/**
 * Detect bot traffic
 */
function detectBot(userAgent) {
  if (!userAgent) return false;
  
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget',
    'python', 'ruby', 'perl', 'java', 'go-http'
  ];
  
  const ua = userAgent.toLowerCase();
  return botPatterns.some(pattern => ua.includes(pattern));
}

/**
 * Calculate fraud score based on various factors
 */
function calculateFraudScore(req, _ipAddress, userAgent) {
  let score = 0;
  
  // Check for bot patterns
  if (detectBot(userAgent)) {
    score += 40;
  }
  
  // Check for missing headers
  if (!req.headers['accept-language']) score += 10;
  if (!req.headers['accept-encoding']) score += 10;
  if (!req.headers['accept']) score += 10;
  
  // Check for suspicious referers
  const referer = req.headers['referer'] || '';
  if (referer && (referer.includes('bot') || referer.includes('crawler'))) {
    score += 20;
  }
  
  // Check for rapid clicks (would need session tracking)
  // This would be implemented with session management
  
  return Math.min(score, 100);
}

/**
 * Check if a targeting rule matches the current request
 */
function checkTargetingMatch(rule, req, geoData) {
  if (!rule.enabled) return false;
  
  let actualValue = '';
  
  switch (rule.type) {
    case 'geo':
      if (rule.field === 'country' && geoData) {
        actualValue = geoData.country || '';
      } else if (rule.field === 'city' && geoData) {
        actualValue = geoData.city || '';
      } else if (rule.field === 'region' && geoData) {
        actualValue = geoData.region || '';
      }
      break;
      
    case 'device':
      actualValue = detectDevice(req.headers['user-agent']) || '';
      break;
      
    case 'time':
      const now = new Date();
      if (rule.field === 'hour') {
        actualValue = now.getHours().toString();
      } else if (rule.field === 'day') {
        actualValue = now.getDay().toString();
      } else if (rule.field === 'date') {
        actualValue = now.toISOString().split('T')[0];
      }
      break;
      
    case 'referrer':
      actualValue = req.headers['referer'] || '';
      break;
      
    case 'utm':
      const utm = req.query[rule.field] || '';
      actualValue = utm;
      break;
  }
  
  return matchValue(actualValue, rule.operator, rule.value);
}

/**
 * Match value against operator and expected value
 */
function matchValue(actual, operator, expected) {
  const actualLower = actual.toLowerCase();
  const expectedLower = expected.toLowerCase();
  
  switch (operator) {
    case 'equals':
      return actualLower === expectedLower;
    case 'contains':
      return actualLower.includes(expectedLower);
    case 'starts_with':
      return actualLower.startsWith(expectedLower);
    case 'ends_with':
      return actualLower.endsWith(expectedLower);
    case 'regex':
      try {
        const regex = new RegExp(expected, 'i');
        return regex.test(actual);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/**
 * Evaluate all targeting rules
 */
function evaluateTargeting(rules, req, geoData) {
  if (!rules || rules.length === 0) {
    return { matches: true, matchedRules: [] };
  }
  
  const matchedRules = [];
  let hasMatch = false;
  
  for (const rule of rules) {
    if (checkTargetingMatch(rule, req, geoData)) {
      matchedRules.push(`${rule.type}:${rule.field}:${rule.operator}:${rule.value}`);
      hasMatch = true;
    }
  }
  
  // If there are rules but none matched, return false
  if (rules.length > 0 && !hasMatch) {
    return { matches: false, matchedRules: [] };
  }
  
  return { matches: true, matchedRules };
}

/**
 * Get the best matching URL based on weights and targeting
 */
function getBestMatch(items, req, geoData, safeLink, globalTargeting) {
  if (!items || items.length === 0) {
    return safeLink ? { url: safeLink } : null;
  }
  
  // First, check for targeted matches
  const targetedMatches = [];
  
  for (const item of items) {
    if (item.targeting && item.targeting.length > 0) {
      const { matches } = evaluateTargeting(item.targeting, req, geoData);
      if (matches) {
        targetedMatches.push(item);
      }
    }
  }
  
  // If we have targeted matches, use them
  if (targetedMatches.length > 0) {
    // Use weight distribution among targeted matches
    return selectByWeight(targetedMatches);
  }
  
  // Check global targeting
  if (globalTargeting && globalTargeting.length > 0) {
    const { matches } = evaluateTargeting(globalTargeting, req, geoData);
    if (!matches) {
      return safeLink ? { url: safeLink } : items[0];
    }
  }
  
  // No targeting matches, use weight distribution
  const itemsWithoutTargeting = items.filter(item => !item.targeting || item.targeting.length === 0);
  
  if (itemsWithoutTargeting.length > 0) {
    return selectByWeight(itemsWithoutTargeting);
  }
  
  // Fallback to safe link or first item
  return safeLink ? { url: safeLink } : items[0];
}

/**
 * Select item based on weight distribution
 */
function selectByWeight(items) {
  // Normalize weights
  const normalizedItems = normalizeWeights(items);
  
  // Calculate total weight
  const totalWeight = normalizedItems.reduce((sum, item) => sum + (item.weight || 0), 0);
  
  if (totalWeight === 0) {
    // If no weights, return random item
    return items[Math.floor(Math.random() * items.length)];
  }
  
  // Random selection based on weights
  const random = Math.random() * totalWeight;
  let accumulator = 0;
  
  for (const item of normalizedItems) {
    accumulator += item.weight || 0;
    if (random <= accumulator) {
      return item;
    }
  }
  
  return items[0];
}

/**
 * Normalize weights to ensure they sum to 100
 */
function normalizeWeights(items) {
  if (!items || items.length === 0) return [];
  
  // Check if weights are already set
  const hasWeights = items.some(item => item.weight && item.weight > 0);
  
  if (!hasWeights) {
    // Auto-calculate equal weights
    const weight = 100 / items.length;
    return items.map(item => ({ ...item, weight }));
  }
  
  // Calculate current total
  const total = items.reduce((sum, item) => sum + (item.weight || 0), 0);
  
  if (total === 0) {
    const weight = 100 / items.length;
    return items.map(item => ({ ...item, weight }));
  }
  
  // Normalize to 100
  const factor = 100 / total;
  return items.map(item => ({
    ...item,
    weight: (item.weight || 0) * factor
  }));
}

/**
 * Simple hash function for session ID generation
 */
async function hashString(str) {
  // Use Web Crypto API if available
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 32); // Return first 32 chars like MD5
  }
  
  // Fallback to simple hash
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generate session ID from request
 */
function generateSessionId(req) {
  const ip = req.ip || req.connection?.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  
  const data = `${ip}-${userAgent}-${acceptLanguage}`;
  
  // Return a promise that resolves to the session ID
  // Note: This is now async, callers need to await it
  return hashString(data);
}

/**
 * Validate URL
 */
function validateUrl(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Invalid protocol' };
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Get client IP address
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         req.ip;
}

export {
  generateShortId,
  generateId,
  detectDevice,
  detectBot,
  calculateFraudScore,
  checkTargetingMatch,
  matchValue,
  evaluateTargeting,
  getBestMatch,
  selectByWeight,
  normalizeWeights,
  generateSessionId,
  validateUrl,
  getClientIp
};