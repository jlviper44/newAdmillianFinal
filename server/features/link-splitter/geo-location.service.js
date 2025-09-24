/**
 * GeoLocation Service for LinkSplitter Analytics
 * Utilizes Cloudflare's built-in geolocation and enhances with additional data
 */

/**
 * Get enhanced geo-location data from Cloudflare request
 */
export function getGeoLocationFromRequest(request) {
  const cf = request.cf;
  
  if (!cf) {
    return getDefaultGeoLocation();
  }
  
  return {
    // Basic location data from Cloudflare
    country_code: cf.country || 'XX',
    country_name: getCountryName(cf.country),
    region_code: cf.region || null,
    region_name: cf.regionName || null,
    city: cf.city || null,
    postal_code: cf.postalCode || null,
    latitude: cf.latitude || null,
    longitude: cf.longitude || null,
    timezone: cf.timezone || null,
    
    // Network information
    isp: cf.asOrganization || null,
    as_number: cf.asn || null,
    
    // Additional metadata
    continent_code: cf.continent || null,
    continent_name: getContinentName(cf.continent),
    metro_code: cf.metroCode || null,
    
    // EU/Privacy flags
    is_eu: cf.isEUCountry || false,
    
    // Connection type
    connection_type: getConnectionType(cf),
    
    // Accuracy radius (in km)
    accuracy_radius: getAccuracyRadius(cf)
  };
}

/**
 * Get default geo-location when CF object is not available
 */
function getDefaultGeoLocation() {
  return {
    country_code: 'XX',
    country_name: 'Unknown',
    region_code: null,
    region_name: null,
    city: null,
    postal_code: null,
    latitude: null,
    longitude: null,
    timezone: null,
    isp: null,
    as_number: null,
    continent_code: null,
    continent_name: null,
    metro_code: null,
    is_eu: false,
    connection_type: 'unknown',
    accuracy_radius: null
  };
}

/**
 * Get country name from ISO code
 */
function getCountryName(code) {
  const countries = {
    'US': 'United States',
    'GB': 'United Kingdom',
    'CA': 'Canada',
    'AU': 'Australia',
    'DE': 'Germany',
    'FR': 'France',
    'ES': 'Spain',
    'IT': 'Italy',
    'NL': 'Netherlands',
    'BR': 'Brazil',
    'MX': 'Mexico',
    'JP': 'Japan',
    'CN': 'China',
    'IN': 'India',
    'KR': 'South Korea',
    'RU': 'Russia',
    'ZA': 'South Africa',
    'NG': 'Nigeria',
    'EG': 'Egypt',
    'AR': 'Argentina',
    'CL': 'Chile',
    'CO': 'Colombia',
    'PL': 'Poland',
    'SE': 'Sweden',
    'NO': 'Norway',
    'FI': 'Finland',
    'DK': 'Denmark',
    'CH': 'Switzerland',
    'AT': 'Austria',
    'BE': 'Belgium',
    'IE': 'Ireland',
    'PT': 'Portugal',
    'GR': 'Greece',
    'CZ': 'Czech Republic',
    'HU': 'Hungary',
    'RO': 'Romania',
    'BG': 'Bulgaria',
    'HR': 'Croatia',
    'SK': 'Slovakia',
    'SI': 'Slovenia',
    'LT': 'Lithuania',
    'LV': 'Latvia',
    'EE': 'Estonia',
    'NZ': 'New Zealand',
    'SG': 'Singapore',
    'HK': 'Hong Kong',
    'MY': 'Malaysia',
    'TH': 'Thailand',
    'ID': 'Indonesia',
    'PH': 'Philippines',
    'VN': 'Vietnam',
    'PK': 'Pakistan',
    'BD': 'Bangladesh',
    'TR': 'Turkey',
    'SA': 'Saudi Arabia',
    'AE': 'United Arab Emirates',
    'IL': 'Israel',
    'UA': 'Ukraine',
    'KE': 'Kenya',
    'MA': 'Morocco',
    'TN': 'Tunisia',
    'PE': 'Peru',
    'VE': 'Venezuela',
    'UY': 'Uruguay',
    'PY': 'Paraguay',
    'EC': 'Ecuador',
    'BO': 'Bolivia',
    'CR': 'Costa Rica',
    'PA': 'Panama',
    'DO': 'Dominican Republic',
    'GT': 'Guatemala',
    'HN': 'Honduras',
    'SV': 'El Salvador',
    'NI': 'Nicaragua'
  };
  
  return countries[code] || code || 'Unknown';
}

/**
 * Get continent name from code
 */
function getContinentName(code) {
  const continents = {
    'AF': 'Africa',
    'AS': 'Asia',
    'EU': 'Europe',
    'NA': 'North America',
    'OC': 'Oceania',
    'SA': 'South America',
    'AN': 'Antarctica'
  };
  
  return continents[code] || code || 'Unknown';
}

/**
 * Determine connection type based on CF data
 */
function getConnectionType(cf) {
  if (!cf) return 'unknown';
  
  // Check if it's a known data center or cloud provider
  const cloudProviders = [
    'amazon', 'google', 'microsoft', 'digitalocean',
    'linode', 'vultr', 'ovh', 'alibaba'
  ];
  
  const org = (cf.asOrganization || '').toLowerCase();
  
  if (cloudProviders.some(provider => org.includes(provider))) {
    return 'datacenter';
  }
  
  // Check for mobile carriers
  const mobileCarriers = [
    'verizon', 'at&t', 'sprint', 't-mobile', 'vodafone',
    'orange', 'telefonica', 'china mobile', 'airtel'
  ];
  
  if (mobileCarriers.some(carrier => org.includes(carrier))) {
    return 'mobile';
  }
  
  // Default to broadband
  return 'broadband';
}

/**
 * Estimate accuracy radius based on available data
 */
function getAccuracyRadius(cf) {
  if (!cf) return null;
  
  // If we have city-level data, accuracy is typically 10-50km
  if (cf.city) return 25;
  
  // If we have region-level data, accuracy is typically 50-200km
  if (cf.region) return 100;
  
  // Country-level only, accuracy varies widely
  if (cf.country) return 500;
  
  return null;
}

/**
 * Calculate distance between two geo points (in km)
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Group countries by region for analytics
 */
export function getCountryGroup(countryCode) {
  const regions = {
    'North America': ['US', 'CA', 'MX'],
    'Europe': ['GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'CH', 'AT', 
               'SE', 'NO', 'DK', 'FI', 'PL', 'PT', 'GR', 'IE', 
               'CZ', 'HU', 'RO', 'BG', 'HR', 'SK', 'SI', 'LT', 'LV', 'EE'],
    'Asia Pacific': ['JP', 'CN', 'KR', 'IN', 'AU', 'NZ', 'SG', 'HK', 
                     'MY', 'TH', 'ID', 'PH', 'VN', 'PK', 'BD'],
    'Middle East': ['SA', 'AE', 'IL', 'TR', 'EG', 'JO', 'KW', 'QA', 'OM'],
    'Africa': ['ZA', 'NG', 'KE', 'MA', 'TN', 'GH', 'ET', 'UG', 'TZ'],
    'South America': ['BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'UY', 'PY', 'EC', 'BO'],
    'Central America': ['CR', 'PA', 'DO', 'GT', 'HN', 'SV', 'NI']
  };
  
  for (const [region, countries] of Object.entries(regions)) {
    if (countries.includes(countryCode)) {
      return region;
    }
  }
  
  return 'Other';
}

/**
 * Get timezone offset from timezone name
 */
export function getTimezoneOffset(timezone) {
  if (!timezone) return null;
  
  // This is a simplified version - in production, use a proper timezone library
  const offsets = {
    'America/New_York': -5,
    'America/Chicago': -6,
    'America/Denver': -7,
    'America/Los_Angeles': -8,
    'Europe/London': 0,
    'Europe/Paris': 1,
    'Europe/Berlin': 1,
    'Asia/Tokyo': 9,
    'Asia/Shanghai': 8,
    'Asia/Dubai': 4,
    'Australia/Sydney': 10,
    'Pacific/Auckland': 12
  };
  
  return offsets[timezone] || null;
}

/**
 * Determine if an IP might be a VPN/Proxy based on ISP
 */
export function detectVpnProxy(isp) {
  if (!isp) return { is_vpn: false, is_proxy: false };
  
  const ispLower = isp.toLowerCase();
  
  const vpnProviders = [
    'nordvpn', 'expressvpn', 'surfshark', 'cyberghost', 
    'private internet access', 'ipvanish', 'vyprvpn',
    'tunnelbear', 'windscribe', 'protonvpn'
  ];
  
  const proxyProviders = [
    'luminati', 'smartproxy', 'brightdata', 'oxylabs',
    'netnut', 'proxy-seller', 'blazingseollc'
  ];
  
  const is_vpn = vpnProviders.some(provider => ispLower.includes(provider));
  const is_proxy = proxyProviders.some(provider => ispLower.includes(provider));
  
  return { is_vpn, is_proxy };
}

/**
 * Enhanced geo-location lookup with caching
 */
export class GeoLocationCache {
  constructor(env) {
    this.env = env;
    this.cacheTimeout = 3600; // 1 hour in seconds
  }
  
  /**
   * Get geo location with caching
   */
  async getGeoLocation(ipAddress, request) {
    // First, try to get from Cloudflare's request object
    if (request?.cf) {
      const cfGeo = getGeoLocationFromRequest(request);
      
      // Store in cache for future use
      await this.cacheGeoLocation(ipAddress, cfGeo);
      
      return cfGeo;
    }
    
    // Try to get from cache
    const cached = await this.getCachedGeoLocation(ipAddress);
    if (cached) {
      return cached;
    }
    
    // If no data available, return default
    return getDefaultGeoLocation();
  }
  
  /**
   * Get cached geo location from KV or D1
   */
  async getCachedGeoLocation(ipAddress) {
    try {
      // Try KV store first if available
      if (this.env.GEO_CACHE) {
        const cached = await this.env.GEO_CACHE.get(ipAddress, { type: 'json' });
        if (cached) return cached;
      }
      
      // Try D1 cache
      const result = await this.env.LINKSPLITTER_DB.prepare(
        'SELECT geo_data FROM geo_cache WHERE ip_address = ? AND expires_at > datetime("now")'
      ).bind(ipAddress).first();
      
      if (result?.geo_data) {
        return JSON.parse(result.geo_data);
      }
    } catch (error) {
      console.error('Error getting cached geo location:', error);
    }
    
    return null;
  }
  
  /**
   * Cache geo location data
   */
  async cacheGeoLocation(ipAddress, geoData) {
    try {
      // Store in KV if available
      if (this.env.GEO_CACHE) {
        await this.env.GEO_CACHE.put(
          ipAddress, 
          JSON.stringify(geoData),
          { expirationTtl: this.cacheTimeout }
        );
      }
      
      // Store in D1
      await this.env.LINKSPLITTER_DB.prepare(`
        INSERT OR REPLACE INTO geo_cache (ip_address, geo_data, expires_at)
        VALUES (?, ?, datetime('now', '+${this.cacheTimeout} seconds'))
      `).bind(ipAddress, JSON.stringify(geoData)).run();
      
    } catch (error) {
      console.error('Error caching geo location:', error);
    }
  }
}

// Create geo cache table if needed
export const geoLocationSchema = `
CREATE TABLE IF NOT EXISTS geo_cache (
  ip_address VARCHAR(45) PRIMARY KEY,
  geo_data TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_geo_cache_expires ON geo_cache(expires_at);
`;