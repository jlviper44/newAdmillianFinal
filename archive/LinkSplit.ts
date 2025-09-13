// Cloudflare Workers types
/// <reference types="@cloudflare/workers-types" />

// link-splitter full worker (auth + groups/projects + unlimited sublinks + auto-weights + autosave + analytics + custom domain smart links)
// Credentials: admin / supersecret123  (move to Wrangler secrets for production)

export interface Env {
  LINKS_CONFIG: KVNamespace;
  BASE_URL?: string;
  ANALYTICS_DO: DurableObjectNamespace; // Add Durable Object namespace
}

// Simple in-memory cache for project configs
const projectCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

/* ================= Types ================= */
type TargetingRule = {
  type: 'geo' | 'device' | 'time' | 'referrer' | 'utm';
  field: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex';
  value: string;
  enabled: boolean;
};

type SplitItem = { 
  url: string; 
  weight?: number; 
  label?: string;
  targeting?: TargetingRule[];
  tags?: string[];
  health?: {
    lastChecked: number;
    status: 'healthy' | 'broken' | 'unknown';
    responseTime?: number;
  };
  safeLink?: string; // Fallback URL if targeting doesn't match
  customDomain?: string; // Custom domain for this specific link
  pixelId?: string; // TikTok pixel ID for this link
  conversionTracking?: boolean; // Enable conversion tracking
};

type Project = {
  id: string;
  groupId: string;
  teamId?: string; // Team ID for team workspaces
  userId?: string; // User ID for user isolation
  name: string;
  main: string;
  customAlias?: string; // Custom short URL like "summer-sale"
  expiresAt?: number; // Unix timestamp when link expires
  safeLink?: string; // Global fallback URL
  customDomain?: string; // Global custom domain
  items: SplitItem[];
  updatedAt: number;
  tags?: string[];
  targeting?: TargetingRule[]; // Global targeting rules
  clicksLimit?: number; // Maximum number of clicks before disabling
  clickCount?: number; // Current click count
  fraudProtection?: {
    enabled: boolean;
    maxClicksPerIP: number; // per hour
    maxClicksPerSession: number;
    blockBots: boolean;
    suspiciousThreshold: number; // fraud score 0-100
  };
  abTesting?: {
    enabled: boolean;
    confidenceLevel: number;
    minSampleSize: number;
    testDuration: number;
    trafficSplit: string;
    testType: 'split' | 'multivariate' | 'sequential';
    goal: 'conversion' | 'revenue' | 'engagement' | 'custom';
    hypothesis: string;
    variants: Array<{
      id: string;
      name: string;
      weight: number;
      targeting?: TargetingRule[];
    }>;
    results?: {
      startDate: number;
      endDate?: number;
      conversions: Record<string, number>;
      revenue: Record<string, number>;
      confidence: Record<string, number>;
      winner?: string;
    };
  };
  pixelSettings?: {
    tiktokPixelId?: string;
    facebookPixelId?: string;
    googlePixelId?: string;
    enableConversionTracking: boolean;
    enablePageViewTracking: boolean;
  };
  bulkLinks?: Array<{
    id: string;
    name: string;
    urls: string[];
    targeting?: TargetingRule[];
    weights?: number[];
  }>;
};



type Group = { 
  id: string; 
  name: string; 
  updatedAt: number;
  userId?: string; // User ID for user isolation
  tags?: string[];
};

/* ================= User Roles System ================= */
type UserRole = 'admin' | 'editor' | 'viewer';

type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string; // Hashed password for security
  role: UserRole;
  teamId?: string; // Team ID for team workspaces
  permissions: UserPermissions;
  createdAt: number;
  lastLoginAt?: number;
  isActive: boolean;
};

type Team = {
  id: string;
  name: string;
  description?: string;
  ownerId: string; // User ID of team owner
  members: TeamMember[];
  settings: TeamSettings;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
};

type TeamMember = {
  userId: string;
  role: UserRole;
  joinedAt: number;
  permissions: UserPermissions;
  isActive: boolean;
};

type TeamSettings = {
  allowPublicProjects: boolean;
  maxProjectsPerTeam: number;
  maxTeamMembers: number;
  defaultUserRole: UserRole;
  requireApproval: boolean;
  allowedDomains?: string[]; // Restrict custom domains
};

type UserPermissions = {
  canCreateProjects: boolean;
  canEditProjects: boolean;
  canDeleteProjects: boolean;
  canCreateGroups: boolean;
  canEditGroups: boolean;
  canDeleteGroups: boolean;
  canViewAnalytics: boolean;
  canManageUsers: boolean;
  canAccessSettings: boolean;
  canManageBilling: boolean;
};

type UserSession = {
  userId: string;
  role: UserRole;
  permissions: UserPermissions;
  expiresAt: number;
};

type EventRow = {
  ts: number;
  sub: string;      // subid (label or slug)
  url: string;      // destination chosen
  ua?: string;
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  device?: string;  // desktop/mobile/tablet if detectable
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  sessionId?: string;
  sessionDuration?: number;
  redirectTime?: number; // Time taken for redirect in milliseconds
  loadTime?: number; // Time for page to load (if available)
  isReturnVisitor?: boolean;
  userAgent?: string;
  screenResolution?: string;
  language?: string;
  fraudScore?: number;  // 0-100 fraud risk score
  isBot?: boolean;      // detected as bot/crawler
  isSuspicious?: boolean; // flagged as suspicious
};

// Activity Log Types
type ActivityLogEntry = {
  id: string;
  timestamp: number;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  action: string;
  resourceType: 'project' | 'group' | 'user' | 'team' | 'link' | 'auth' | 'webhook' | 'api_key' | 'activity_log';
  resourceId: string;
  resourceName: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
};

type ActivityLogFilter = {
  startDate?: string;
  endDate?: string;
  userId?: string;
  action?: string;
  resourceType?: string;
  limit?: number;
  offset?: number;
};

// Advanced Analytics Types
type AdvancedAnalytics = {
  userEngagement: {
    activeUsers: { daily: number; weekly: number; monthly: number };
    userRetention: { day7: number; day30: number; day90: number };
    sessionMetrics: { avgDuration: number; avgPagesPerSession: number };
    topUsers: Array<{ userId: string; email: string; actions: number; lastActive: number }>;
  };
  projectPerformance: {
    totalProjects: number;
    activeProjects: number;
    projectGrowth: { weekly: number; monthly: number };
    topPerformingProjects: Array<{ id: string; name: string; clicks: number; conversionRate: number }>;
  };
  systemHealth: {
    uptime: number;
    responseTime: { avg: number; p95: number; p99: number };
    errorRate: number;
    activeSessions: number;
  };
  businessMetrics: {
    totalClicks: number;
    conversionRate: number;
    revenueImpact: number;
    geographicDistribution: Record<string, number>;
    deviceBreakdown: Record<string, number>;
  };
};

type AnalyticsQuery = {
  startDate: string;
  endDate: string;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
  filters?: {
    userId?: string;
    projectId?: string;
    groupId?: string;
    action?: string;
    resourceType?: string;
  };
  metrics: string[];
  dimensions: string[];
};

// Webhook Types
type Webhook = {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: number;
  lastTriggered?: number;
  failureCount: number;
  headers?: Record<string, string>;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
};

type WebhookEvent = {
  id: string;
  webhookId: string;
  eventType: string;
  payload: any;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  attempts: number;
  lastAttempt?: number;
  nextRetry?: number;
  response?: {
    status: number;
    body: string;
    headers: Record<string, string>;
  };
  createdAt: number;
};

// API Key Types
type ApiKey = {
  id: string;
  name: string;
  key: string; // Hashed API key
  userId: string;
  permissions: UserPermissions;
  isActive: boolean;
  createdAt: number;
  lastUsed?: number;
  expiresAt?: number;
  allowedIPs?: string[];
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  scopes?: string[]; // Specific API endpoints this key can access
};

type ApiKeyUsage = {
  id: string;
  apiKeyId: string;
  endpoint: string;
  timestamp: number;
  ipAddress: string;
  userAgent: string;
  responseStatus: number;
  responseTime: number;
};

// Real-time Activity Feed Types
type ActivityFeedItem = {
  id: string;
  timestamp: number;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  action: string;
  resourceType: string;
  resourceName: string;
  details: Record<string, any>;
  avatar?: string;
  isLive?: boolean; // For real-time indicators
  ipAddress?: string; // IP address for tracking
};

type QuickStats = {
  totalProjects: number;
  activeUsers: number;
  todayClicks: number;
  totalClicks: number;
  systemUptime: number;
  activeSessions: number;
  recentGrowth: {
    projects: number;
    users: number;
    clicks: number;
  };
};

type AnalyticsFilters = {
  startDate?: string;
  endDate?: string;
  compareWith?: {
    startDate: string;
    endDate: string;
  };
  groupBy?: 'hour' | 'day' | 'week' | 'month';
  filters?: {
    device?: string;
    country?: string;
    referrer?: string;
    utm_source?: string;
  };
};

/* ================= Consts ================= */
const AUTH_USER = "admin";
const AUTH_PASS = "supersecret123";

const G_INDEX = "grp:index";
const P_INDEX = "proj:index";
const PROJ_PREFIX = "proj:";
const GROUP_PREFIX = "grp:";
const AN_PROJ = "an:proj:";
const AN_GROUP = "an:group:";
const MAX_EVENTS = 50;

/* ================= Utils ================= */
function isHttpUrl(u: string): boolean {
  try { const p = new URL(u); return p.protocol === "http:" || p.protocol === "https:"; } catch { return false; }
}
function genId(): string {
  let id = "";
  for (let i = 0; i < 4; i++) id += Math.floor(Math.random() * 2 ** 32).toString(36);
  return id.slice(0, 16);
}

// Simple password hashing (in production, use bcrypt or similar)
function hashPassword(password: string): string {
  // Simple but reliable hash - just convert to base64-like string
  let hash = '';
  for (let i = 0; i < password.length; i++) {
    const charCode = password.charCodeAt(i);
    // Convert to base36 (0-9, a-z)
    hash += charCode.toString(36);
  }
  return hash + '_' + password.length;
}

function verifyPassword(password: string, hash: string): boolean {
  const computedHash = hashPassword(password);
  console.log('DEBUG: verifyPassword function:', {
    inputPassword: password,
    inputHash: hash,
    computedHash: computedHash,
    match: computedHash === hash
  });
  return computedHash === hash;
}
function slugForUrl(u: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < u.length; i++) { h ^= u.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
}
function ymd(d = new Date()): string {
  const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, "0"), day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function ym(d = new Date()): string {
  const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function isoWeek(d = new Date()): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((dt.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${dt.getUTCFullYear()}-${String(weekNo).padStart(2, "0")}`;
}
function detectDevice(ua?: string): string | undefined {
  if (!ua) return undefined;
  const u = ua.toLowerCase();
  if (/ipad|tablet/.test(u)) return "tablet";
  if (/mobi|iphone|android/.test(u)) return "mobile";
  return "desktop";
}

function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }
    if (!parsed.hostname) {
      return { valid: false, error: 'URL must have a valid hostname' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

function checkTargetingMatch(rule: TargetingRule, req: Request, cf: any): boolean {
  if (!rule.enabled) return true;
  
  console.log('🎯 Checking targeting match:', { rule, cf });
  
  switch (rule.type) {
    case 'geo':
      const country = cf?.country || '';
      const city = cf?.city || '';
      const region = cf?.region || '';
      
      console.log('🌍 Geographic targeting:', { country, city, region, rule });
      
      if (rule.field === 'country') {
      if (rule.value === 'OTHER') {
        const mainCountries = ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'BR', 'IN', 'CN', 'RU', 'MX', 'IT', 'ES', 'NL', 'SE', 'NO', 'DK', 'FI'];
          const result = !mainCountries.includes(country);
          console.log('🌍 Country OTHER check:', { country, mainCountries, result });
          return result;
        }
        const result = matchValue(country, rule.operator, rule.value);
        console.log('🌍 Country match:', { country, operator: rule.operator, value: rule.value, result });
        return result;
      } else if (rule.field === 'city') {
        const result = matchValue(city, rule.operator, rule.value);
        console.log('🌍 City match:', { city, operator: rule.operator, value: rule.value, result });
        return result;
      } else if (rule.field === 'region') {
        const result = matchValue(region, rule.operator, rule.value);
        console.log('🌍 Region match:', { region, operator: rule.operator, value: rule.value, result });
        return result;
      }
      const result = matchValue(country, rule.operator, rule.value);
      console.log('🌍 Default country match:', { country, operator: rule.operator, value: rule.value, result });
      return result;
    
    case 'device':
      const ua = req.headers.get('user-agent') || '';
      let device = cf?.deviceType || detectDevice(ua);
      
      // Enhanced device detection
      if (rule.value === 'ios' && (ua.toLowerCase().includes('iphone') || ua.toLowerCase().includes('ipad'))) device = 'ios';
      if (rule.value === 'android' && ua.toLowerCase().includes('android')) device = 'android';
      if (rule.value === 'windows' && ua.toLowerCase().includes('windows')) device = 'windows';
      if (rule.value === 'macos' && ua.toLowerCase().includes('mac os')) device = 'macos';
      if (rule.value === 'linux' && ua.toLowerCase().includes('linux')) device = 'linux';
      if (rule.value === 'mobile' && (device === 'mobile' || device === 'ios' || device === 'android')) device = 'mobile';
      if (rule.value === 'desktop' && device === 'desktop') device = 'desktop';
      if (rule.value === 'tablet' && device === 'tablet') device = 'tablet';
      
      return matchValue(device || '', rule.operator, rule.value);
    
    case 'time':
      const now = new Date();
      const hour = now.getUTCHours();
      const dayOfWeek = now.getUTCDay();
      const month = now.getUTCMonth();
      const dayOfMonth = now.getUTCDate();
      
      let timeValue = '';
      switch (rule.value) {
        case 'morning': timeValue = (hour >= 6 && hour < 12) ? 'morning' : 'other'; break;
        case 'afternoon': timeValue = (hour >= 12 && hour < 18) ? 'afternoon' : 'other'; break;
        case 'evening': timeValue = (hour >= 18 && hour < 24) ? 'evening' : 'other'; break;
        case 'night': timeValue = (hour >= 0 && hour < 6) ? 'night' : 'other'; break;
        case 'business': timeValue = (hour >= 9 && hour < 17) ? 'business' : 'other'; break;
        case 'weekend': timeValue = (dayOfWeek === 0 || dayOfWeek === 6) ? 'weekend' : 'other'; break;
        case 'weekday': timeValue = (dayOfWeek >= 1 && dayOfWeek <= 5) ? 'weekday' : 'other'; break;
        case 'monday': timeValue = dayOfWeek === 1 ? 'monday' : 'other'; break;
        case 'tuesday': timeValue = dayOfWeek === 2 ? 'tuesday' : 'other'; break;
        case 'wednesday': timeValue = dayOfWeek === 3 ? 'wednesday' : 'other'; break;
        case 'thursday': timeValue = dayOfWeek === 4 ? 'thursday' : 'other'; break;
        case 'friday': timeValue = dayOfWeek === 5 ? 'friday' : 'other'; break;
        case 'saturday': timeValue = dayOfWeek === 6 ? 'saturday' : 'other'; break;
        case 'sunday': timeValue = dayOfWeek === 0 ? 'sunday' : 'other'; break;
        case 'q1': timeValue = (month >= 0 && month <= 2) ? 'q1' : 'other'; break;
        case 'q2': timeValue = (month >= 3 && month <= 5) ? 'q2' : 'other'; break;
        case 'q3': timeValue = (month >= 6 && month <= 8) ? 'q3' : 'other'; break;
        case 'q4': timeValue = (month >= 9 && month <= 11) ? 'q4' : 'other'; break;
        default: timeValue = dayOfWeek.toString();
      }
      return matchValue(timeValue, rule.operator, rule.value);
    
    case 'referrer':
      const referrer = req.headers.get('referer') || '';
      if (rule.value === 'direct') return referrer === '';
      if (rule.value === 'email') return referrer.includes('mail') || referrer.includes('email');
      if (rule.value === 'social') {
        const socialDomains = ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'tiktok.com', 'youtube.com'];
        return socialDomains.some(domain => referrer.includes(domain));
      }
      if (rule.value === 'google') return referrer.includes('google.com') || referrer.includes('google.');
      if (rule.value === 'bing') return referrer.includes('bing.com');
      if (rule.value === 'yahoo') return referrer.includes('yahoo.com');
      return matchValue(referrer, rule.operator, rule.value);
    
    case 'utm':
      const url = new URL(req.url);
      const utmValue = url.searchParams.get(rule.field) || '';
      return matchValue(utmValue, rule.operator, rule.value);
    
    default:
      return true;
  }
}

function matchValue(actual: string, operator: string, expected: string): boolean {
  const a = actual.toLowerCase();
  const e = expected.toLowerCase();
  
  switch (operator) {
    case 'equals': return a === e;
    case 'contains': return a.includes(e);
    case 'starts_with': return a.startsWith(e);
    case 'ends_with': return a.endsWith(e);
    case 'regex': 
      try {
        return new RegExp(e).test(a);
      } catch {
        return false;
      }
    case 'not_equals': return a !== e;
    case 'not_contains': return !a.includes(e);
    case 'not_starts_with': return !a.startsWith(e);
    case 'not_ends_with': return !a.endsWith(e);
    default: return true;
  }
}

// Enhanced targeting evaluation with fallback logic
function evaluateTargeting(rules: TargetingRule[], req: Request, cf: any): { matches: boolean; matchedRules: string[] } {
  if (!rules || rules.length === 0) {
    console.log('🎯 No targeting rules to evaluate');
    return { matches: true, matchedRules: [] };
  }
  
  console.log('🎯 Evaluating targeting rules:', rules.length, 'rules');
  const matchedRules: string[] = [];
  let allMatch = true;
  
  for (const rule of rules) {
    if (rule.enabled) {
      console.log('🎯 Evaluating rule:', rule);
      const matches = checkTargetingMatch(rule, req, cf);
      console.log('🎯 Rule result:', { rule, matches, cf: cf });
      
      if (matches) {
        matchedRules.push(`${rule.type}:${rule.field}:${rule.value}`);
      }
      allMatch = allMatch && matches;
    } else {
      console.log('🎯 Rule disabled:', rule);
    }
  }
  
  console.log('🎯 Final targeting result:', { allMatch, matchedRules });
  return { matches: allMatch, matchedRules };
}

/* ================= Click Fraud Detection ================= */
function detectBot(userAgent: string): boolean {
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i, /curl/i, /wget/i,
    /python/i, /java/i, /php/i, /node/i, /axios/i, /requests/i,
    /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
    /whatsapp/i, /telegrambot/i, /slackbot/i, /discordbot/i
  ];
  return botPatterns.some(pattern => pattern.test(userAgent));
}

function calculateFraudScore(req: Request, cf: any, userAgent: string): number {
  let score = 0;
  
  // Check for bot indicators
  if (detectBot(userAgent)) score += 40;
  
  // Check for missing or suspicious headers
  if (!req.headers.get('accept-language')) score += 15;
  if (!req.headers.get('accept')) score += 10;
  if (!req.headers.get('accept-encoding')) score += 10;
  
  // Check for suspicious user agent patterns
  if (userAgent.length < 20) score += 20;
  if (!userAgent.includes('Mozilla')) score += 15;
  
  // Check for datacenter IPs (simplified)
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '';
  if (ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.')) score += 25;
  
  // Check for suspicious country/ASN combinations
  if (cf?.country && ['CN', 'RU', 'IN'].includes(cf.country) && cf?.asn) {
    // Common VPN/hosting ASNs - this is a simplified check
    const suspiciousASNs = [13335, 16509, 14061, 15169]; // Cloudflare, Amazon, Digital Ocean, Google
    if (suspiciousASNs.includes(cf.asn)) score += 20;
  }
  
  return Math.min(score, 100);
}
async function checkClickLimits(env: Env, proj: Project, ip: string, sessionId: string): Promise<{ allowed: boolean; reason?: string }> {
  if (!proj.fraudProtection?.enabled) return { allowed: true };
  
  const hourAgo = Date.now() - 3600000; // 1 hour ago
  const dayAgo = Date.now() - 86400000; // 24 hours ago
  
  // Check IP-based limits
  if (proj.fraudProtection.maxClicksPerIP) {
    const ipKey = `fraud:ip:${proj.id}:${ip}:${Math.floor(Date.now() / 3600000)}`;
    const ipClicks = Number(await env.LINKS_CONFIG.get(ipKey)) || 0;
    if (ipClicks >= proj.fraudProtection.maxClicksPerIP) {
      return { allowed: false, reason: 'IP rate limit exceeded' };
    }
    await env.LINKS_CONFIG.put(ipKey, String(ipClicks + 1), { expirationTtl: 7200 }); // 2 hour TTL
  }
  
  // Check session-based limits
  if (proj.fraudProtection.maxClicksPerSession) {
    const sessionKey = `fraud:session:${proj.id}:${sessionId}`;
    const sessionClicks = Number(await env.LINKS_CONFIG.get(sessionKey)) || 0;
    if (sessionClicks >= proj.fraudProtection.maxClicksPerSession) {
      return { allowed: false, reason: 'Session limit exceeded' };
    }
    await env.LINKS_CONFIG.put(sessionKey, String(sessionClicks + 1), { expirationTtl: 86400 }); // 24 hour TTL
  }
  
  return { allowed: true };
}

/* ================= Custom Alias Resolution ================= */
async function resolveCustomAlias(env: Env, alias: string): Promise<string | null> {
  // Check if alias exists in our mapping
  const aliasKey = `alias:${alias}`;
  console.log('🔍 Resolving custom alias:', { alias, aliasKey });
  const projectId = await env.LINKS_CONFIG.get(aliasKey);
  console.log('🔍 Custom alias resolution result:', { alias, projectId });
  return projectId;
}

async function setCustomAlias(env: Env, alias: string, projectId: string): Promise<boolean> {
  // Check if alias is already taken
  const existing = await resolveCustomAlias(env, alias);
  if (existing && existing !== projectId) {
    return false; // Alias taken
  }
  
  const aliasKey = `alias:${alias}`;
  await env.LINKS_CONFIG.put(aliasKey, projectId);
  return true;
}

// Get the best matching item based on targeting and weights
function getBestMatch(items: SplitItem[], req: Request, cf: any, projectSafeLink?: string, globalTargeting?: any): SplitItem {
  console.log('🔍 Targeting Debug:', { 
    totalItems: items.length, 
    cf: cf, 
    projectSafeLink: projectSafeLink,
    globalTargeting: globalTargeting
  });
  
  // First, filter items that match targeting rules (including global project targeting)
  const matchingItems = items.filter(item => {
    // Check if item has its own targeting rules
    if (item.targeting && item.targeting.length > 0) {
      const itemTargetingResult = evaluateTargeting(item.targeting, req, cf);
      console.log('🎯 Item-specific targeting result:', { 
        label: item.label || item.url, 
        targeting: item.targeting, 
        matches: itemTargetingResult.matches,
        matchedRules: itemTargetingResult.matchedRules 
      });
      
      // Item must match its own targeting rules
      if (!itemTargetingResult.matches) {
        console.log('❌ Item failed its own targeting rules:', item.label || item.url);
        return false;
      }
    } else {
      console.log('✅ Item has no targeting rules:', item.label || item.url);
    }
    
    // If global targeting exists, item must also match global rules
    if (globalTargeting && globalTargeting.rules && globalTargeting.rules.length > 0) {
      const globalResult = evaluateTargeting(globalTargeting.rules, req, cf);
      console.log('🌍 Global targeting result for item:', { 
        label: item.label || item.url,
        matches: globalResult.matches,
        matchedRules: globalResult.matchedRules 
      });
      
      if (!globalResult.matches) {
        console.log('❌ Item failed global targeting rules:', item.label || item.url);
        return false;
      }
    }
    
    console.log('✅ Item passed all targeting rules:', item.label || item.url);
    return true;
  });
  
  console.log('🎯 Matching items count:', matchingItems.length);
  
  // If no items match targeting, use safe links or fallback
  if (matchingItems.length === 0) {
    console.log('⚠️ No items match targeting, checking safe links...');
    
    // Check for items with safe links
    const safeItems = items.filter(item => item.safeLink);
    console.log('🛡️ Items with safe links:', safeItems.length);
    
    if (safeItems.length > 0) {
      console.log('🛡️ Using safe link items for fallback');
      // Use weighted random selection from safe items
      const totalWeight = safeItems.reduce((sum, item) => sum + (item.weight || 0), 0);
      let random = Math.random() * totalWeight;
      for (const item of safeItems) {
        random -= (item.weight || 0);
        if (random <= 0) {
          console.log('🛡️ Selected safe link item:', item.label || item.url);
          return item;
        }
      }
      console.log('🛡️ Using first safe link item as fallback');
      return safeItems[0];
    }
    
    // Use project-level safe link
    if (projectSafeLink) {
      console.log('🛡️ Using project-level safe link:', projectSafeLink);
      return { url: projectSafeLink, weight: 100, label: 'Safe Link' };
    }
    
    // Last resort: return first item
    console.log('⚠️ No safe links found, using first item as fallback');
    return items[0];
  }
  
  console.log('✅ Using targeting-matched items with weights');
  // Apply weights to matching items
  const totalWeight = matchingItems.reduce((sum, item) => sum + (item.weight || 0), 0);
  let random = Math.random() * totalWeight;
  
  for (const item of matchingItems) {
    random -= (item.weight || 0);
    if (random <= 0) {
      console.log('🎯 Selected targeting-matched item:', item.label || item.url);
      return item;
    }
  }
  
  console.log('🎯 Using first targeting-matched item as fallback');
  return matchingItems[0];
}

function generateSessionId(req: Request): string {
  const ua = req.headers.get('user-agent') || '';
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '';
  const hash = `${ua}${ip}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < hash.length; i++) {
    h ^= hash.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}

/** Normalize weights so total = 100. Throws if user-defined > 100. */
function normalizeWeights(items: SplitItem[]): SplitItem[] {
  const cloned = items.map(it => ({ ...it }));
  let sumDefined = 0;
  let blanks = 0;

  for (const it of cloned) {
    const w = Number(it.weight);
    if (Number.isFinite(w)) sumDefined += w;
    else blanks++;
  }
  if (sumDefined > 100) throw new Error(`Defined weights exceed 100 (currently ${sumDefined}).`);

  const remaining = Math.max(0, 100 - sumDefined);
  const share = blanks > 0 ? Math.floor(remaining / blanks) : 0;
  let leftover = blanks > 0 ? remaining - share * blanks : 0;

  for (const it of cloned) {
    if (!Number.isFinite(Number(it.weight))) {
      it.weight = share + (leftover > 0 ? 1 : 0);
      if (leftover > 0) leftover--;
    }
  }

  // final rounding safety -> exact 100
  const finalSum = cloned.reduce((a, b) => a + (b.weight || 0), 0);
  if (finalSum !== 100 && cloned.length > 0) {
    let idx = cloned.findIndex(x => (x.weight || 0) > 0);
    if (idx < 0) idx = 0;
    cloned[idx].weight = (cloned[idx].weight || 0) + (100 - finalSum);
  }
  return cloned;
}

function jsonResponse(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function htmlResponse(html: string, status = 200) {
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

/* ================= KV helpers ================= */
async function getJSON<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}
async function putJSON(kv: KVNamespace, key: string, v: any) {
  await kv.put(key, JSON.stringify(v));
}

async function getGroups(env: Env): Promise<Group[]> {
  return (await getJSON<Group[]>(env.LINKS_CONFIG, G_INDEX)) || [];
}
async function upsertGroupIndex(env: Env, g: Group) {
  const list = await getGroups(env);
  const i = list.findIndex(x => x.id === g.id);
  if (i >= 0) list[i] = g; else list.push(g);
  list.sort((a,b)=>b.updatedAt - a.updatedAt);
  await putJSON(env.LINKS_CONFIG, G_INDEX, list);
}
async function removeGroupFromIndex(env: Env, gid: string) {
  const list = await getGroups(env);
  await putJSON(env.LINKS_CONFIG, G_INDEX, list.filter(x=>x.id!==gid));
}
async function getGroup(env: Env, gid: string) {
  return await getJSON<Group>(env.LINKS_CONFIG, GROUP_PREFIX + gid);
}
async function putGroup(env: Env, g: Group) {
  await putJSON(env.LINKS_CONFIG, GROUP_PREFIX + g.id, g);
}

async function getProjects(env: Env) {
  return (await getJSON<Array<{id:string; name:string; groupId:string; updatedAt:number; userId?:string}>>(env.LINKS_CONFIG, P_INDEX)) || [];
}
async function upsertProjectIndex(env: Env, p: Project) {
  const list = await getProjects(env);
  const i = list.findIndex(x => x.id === p.id);
  const entry = { id: p.id, name: p.name, groupId: p.groupId, updatedAt: p.updatedAt, userId: p.userId };
  if (i >= 0) list[i] = entry; else list.push(entry);
  list.sort((a,b)=>b.updatedAt - a.updatedAt);
  await putJSON(env.LINKS_CONFIG, P_INDEX, list);
}
async function removeProjectFromIndex(env: Env, pid: string) {
  const list = await getProjects(env);
  await putJSON(env.LINKS_CONFIG, P_INDEX, list.filter(x=>x.id!==pid));
}
async function getProject(env: Env, pid: string) {
  try {
    // Check cache first
    const cached = projectCache.get(pid);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    
    // Fetch from KV if not cached or expired
    const project = await getJSON<Project>(env.LINKS_CONFIG, PROJ_PREFIX + pid);
    
    if (project) {
      // Cache the result
      projectCache.set(pid, { data: project, timestamp: Date.now() });
    }
    
    return project;
  } catch (error) {
    console.error('Error fetching project:', error);
    return null;
  }
}
async function putProject(env: Env, p: Project) {
  await putJSON(env.LINKS_CONFIG, PROJ_PREFIX + p.id, p);
  // Clear cache after saving to ensure fresh data on next load
  projectCache.delete(p.id);
}

/* ================= Analytics ================= */
async function increment(env: Env, key: string, by = 1) {
  console.log('📊 Incrementing analytics key:', key, 'by:', by);
  
  try {
    // Use direct KV updates for better reliability
    const cur = Number(await env.LINKS_CONFIG.get(key)) || 0;
    const newValue = cur + by;
    await env.LINKS_CONFIG.put(key, String(newValue));
    console.log('📊 KV updated:', key, '=', newValue);
  } catch (error) {
    console.log('📊 KV increment failed:', error);
    // Don't throw, just log the error
  }
}
async function getNumber(kv: KVNamespace, key: string) {
  return Number(await kv.get(key)) || 0;
}
async function logClick(env: Env, proj: Project, chosen: SplitItem, req: Request, targetingResult?: { matches: boolean; matchedRules: string[] }, fraudData?: { fraudScore: number; isBot: boolean; sessionId: string; ip: string }, startTime?: number) {
  console.log('🚨 CLICK TRACKING STARTED 🚨');
  console.log('📊 logClick STARTED for project:', proj.id, 'subSlug:', chosen.label?.trim() || slugForUrl(chosen.url));
  console.log('📊 Project details:', { id: proj.id, name: proj.name, itemsCount: proj.items?.length });
  console.log('📊 Chosen item:', { label: chosen.label, url: chosen.url });
  
  try {
  
  const now = new Date();
  const daily = ymd(now), weekly = isoWeek(now), monthly = ym(now);
  const subSlug = (chosen.label?.trim() || "") || slugForUrl(chosen.url);

  // Project counters
  await increment(env, `${AN_PROJ}${proj.id}:total`, 1);
  await increment(env, `${AN_PROJ}${proj.id}:daily:${daily}`, 1);
  await increment(env, `${AN_PROJ}${proj.id}:weekly:${weekly}`, 1);
  await increment(env, `${AN_PROJ}${proj.id}:monthly:${monthly}`, 1);
  await increment(env, `${AN_PROJ}${proj.id}:sub:${subSlug}`, 1);

  // Group counters
  await increment(env, `${AN_GROUP}${proj.groupId}:total`, 1);
  await increment(env, `${AN_GROUP}${proj.groupId}:daily:${daily}`, 1);
  await increment(env, `${AN_GROUP}${proj.groupId}:weekly:${weekly}`, 1);
  await increment(env, `${AN_GROUP}${proj.groupId}:monthly:${monthly}`, 1);

  // Enhanced event tracking
  const ua = req.headers.get("user-agent") || undefined;
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || undefined;
  const cf: any = (req as any).cf || {};
  const device = cf.deviceType || detectDevice(ua);
  const referrer = req.headers.get("referer") || '';
  const url = new URL(req.url);
  
  // Defer non-essential tracking to background for faster redirects
  const backgroundTasks = async () => {
    try {
      // Track active users (sessions active in last 5 minutes)
      if (ip && ua) {
        const sessionId = fraudData?.sessionId || ip + ua;
        const activeUserKey = `active:${proj.id}:${sessionId}`;
        await env.LINKS_CONFIG.put(activeUserKey, Date.now().toString(), { expirationTtl: 300 }); // 5 minute TTL
      }
      
      // Track IP reputation with safety checks
      if (ip) {
        const ipRepKey = `ip_rep:${ip}`;
        const existingData = await getJSON(env.LINKS_CONFIG, ipRepKey);
        const ipData: any = existingData || { 
          firstSeen: Date.now(), 
          clicks: 0, 
          fraudScore: 0, 
          isBlacklisted: false,
          projects: []
        };
        ipData.clicks = (ipData.clicks || 0) + 1;
        ipData.lastSeen = Date.now();
        
        // Handle projects array safely
        if (!Array.isArray(ipData.projects)) {
          ipData.projects = [];
        }
        if (!ipData.projects.includes(proj.id)) {
          ipData.projects.push(proj.id);
        }
        
        // Update reputation based on fraud indicators
        if (fraudData?.isBot || (fraudData?.fraudScore || 0) > 70) {
          ipData.fraudScore = Math.min(100, (ipData.fraudScore || 0) + 10);
          if (ipData.fraudScore > 80) {
            ipData.isBlacklisted = true;
          }
        }
        
        // Store IP reputation
        await putJSON(env.LINKS_CONFIG, ipRepKey, ipData);
      }
    } catch (error) {
      console.log('⚠️ Background tracking failed:', error);
    }
  };
  
  // Run background tasks without waiting
  if (typeof globalThis.waitUntil === 'function') {
    globalThis.waitUntil(backgroundTasks());
  } else {
    // Fallback for environments without waitUntil
    backgroundTasks().catch(console.error);
  }
  
  const redirectTime = startTime ? Date.now() - startTime : undefined;
  
  const row: EventRow = { 
    ts: Date.now(), 
    sub: subSlug, 
    url: chosen.url, 
    ua, 
    ip: fraudData?.ip || ip, 
    city: cf.city, 
    region: cf.region, 
    country: cf.country,
    device,
    referrer,
    utm_source: url.searchParams.get('utm_source') || undefined,
    utm_medium: url.searchParams.get('utm_medium') || undefined,
    utm_campaign: url.searchParams.get('utm_campaign') || undefined,
    fraudScore: fraudData?.fraudScore,
    isBot: fraudData?.isBot,
    redirectTime,
    sessionId: fraudData?.sessionId || generateSessionId(req),
    userAgent: ua,
    screenResolution: req.headers.get('sec-ch-viewport-width') ? 
      `${req.headers.get('sec-ch-viewport-width')}x${req.headers.get('sec-ch-viewport-height')}` : undefined,
    language: req.headers.get('accept-language')?.split(',')[0] || undefined
  };
  
  const key = `${AN_PROJ}${proj.id}:events`;
  const current = (await getJSON<EventRow[]>(env.LINKS_CONFIG, key)) || [];
  console.log('📊 Current events count before adding:', current.length, 'for project:', proj.id);
  current.push(row);
  if (current.length > MAX_EVENTS) current.splice(0, current.length - MAX_EVENTS);
  await putJSON(env.LINKS_CONFIG, key, current);
  console.log('📊 Events count after adding:', current.length, 'for project:', proj.id);

  // Track targeting performance
  if (targetingResult) {
    await increment(env, `${AN_PROJ}${proj.id}:targeting:${targetingResult.matches ? 'hit' : 'miss'}`, 1);
    if (targetingResult.matchedRules.length > 0) {
      for (const rule of targetingResult.matchedRules) {
        await increment(env, `${AN_PROJ}${proj.id}:rule:${rule}`, 1);
      }
    }
  }

  // A/B testing tracking
  if (proj.abTesting?.enabled) {
    await increment(env, `${AN_PROJ}${proj.id}:ab:variant:${subSlug}`, 1);
    await increment(env, `${AN_PROJ}${proj.id}:ab:total`, 1);
  }
  
  // Log click activity for live dashboard (use anonymous user)
  try {
    await logActivity(
      env,
      'anonymous',
      'anonymous@click.visitor',
      'viewer',
      'click',
      'link',
      proj.id,
      proj.name,
      {
        sublink: subSlug,
        url: chosen.url,
        country: cf.country,
        city: cf.city,
        device: cf.deviceType || device,
        fraudScore: fraudData?.fraudScore,
        isBot: fraudData?.isBot
      },
      req
    );
    console.log('📊 Click activity logged for live dashboard');
  } catch (activityError) {
    console.error('⚠️ Failed to log click activity:', activityError);
    // Don't throw, let the main click tracking continue
  }
  
  console.log('📊 logClick COMPLETED successfully for project:', proj.id);
  
  } catch (error) {
    console.error('❌ logClick ERROR for project:', proj.id, 'Error:', error);
    throw error;
  }
}
async function readProjectAnalytics(env: Env, pid: string) {
  const kvTotal = await getNumber(env.LINKS_CONFIG, `${AN_PROJ}${pid}:total`);
  const today = await getNumber(env.LINKS_CONFIG, `${AN_PROJ}${pid}:daily:${ymd()}`);
  const thisWeek = await getNumber(env.LINKS_CONFIG, `${AN_PROJ}${pid}:weekly:${isoWeek()}`);
  const thisMonth = await getNumber(env.LINKS_CONFIG, `${AN_PROJ}${pid}:monthly:${ym()}`);
  
  // Get all events and clean up if needed
  const events = (await getJSON<EventRow[]>(env.LINKS_CONFIG, `${AN_PROJ}${pid}:events`)) || [];
  
  // Clean up: If we have more than 50 events, truncate and save back
  const maxStoredEvents = 50;
  if (events.length > maxStoredEvents) {
    console.log(`🧹 Cleaning up ${events.length} events to ${maxStoredEvents} for project ${pid}`);
    const cleanedEvents = events.slice(0, maxStoredEvents);
    await putJSON(env.LINKS_CONFIG, `${AN_PROJ}${pid}:events`, cleanedEvents);
    console.log(`✅ Cleaned up events for project ${pid}: ${events.length} → ${cleanedEvents.length}`);
  }
  
  // Debug logging
  console.log('🔍 Analytics Debug - Project:', pid);
  console.log('  - KV Total:', kvTotal);
  console.log('  - Today:', today, 'Key:', `${AN_PROJ}${pid}:daily:${ymd()}`);
  console.log('  - This Week:', thisWeek, 'Key:', `${AN_PROJ}${pid}:weekly:${isoWeek()}`);
  console.log('  - This Month:', thisMonth, 'Key:', `${AN_PROJ}${pid}:monthly:${ym()}`);
  console.log('  - Events Count:', events.length);
  
  // Use KV total as source of truth, but limit displayed events to 50
  const actualTotal = kvTotal;
  const displayEvents = events.length > maxStoredEvents ? events.slice(0, maxStoredEvents) : events;
  
  // Log any discrepancy for debugging
  if (kvTotal !== events.length) {
    console.log('⚠️ Click count mismatch - Project:', pid, 'KV total:', kvTotal, 'Events count:', events.length);
  }
  
  return { total: actualTotal, today, thisWeek, thisMonth, events: displayEvents };
}

async function readProjectAnalyticsPaginated(env: Env, pid: string, limit: number = 10, offset: number = 0) {
  const kvTotal = await getNumber(env.LINKS_CONFIG, `${AN_PROJ}${pid}:total`);
  const today = await getNumber(env.LINKS_CONFIG, `${AN_PROJ}${pid}:daily:${ymd()}`);
  const thisWeek = await getNumber(env.LINKS_CONFIG, `${AN_PROJ}${pid}:weekly:${isoWeek()}`);
  const thisMonth = await getNumber(env.LINKS_CONFIG, `${AN_PROJ}${pid}:monthly:${ym()}`);
  
  // Get all events and clean up if needed
  const allEvents = (await getJSON<EventRow[]>(env.LINKS_CONFIG, `${AN_PROJ}${pid}:events`)) || [];
  
  // Clean up: If we have more than 50 events, truncate and save back
  const maxStoredEvents = 50;
  if (allEvents.length > maxStoredEvents) {
    console.log(`🧹 Cleaning up ${allEvents.length} events to ${maxStoredEvents} for project ${pid}`);
    const cleanedEvents = allEvents.slice(0, maxStoredEvents);
    await putJSON(env.LINKS_CONFIG, `${AN_PROJ}${pid}:events`, cleanedEvents);
    console.log(`✅ Cleaned up events for project ${pid}: ${allEvents.length} → ${cleanedEvents.length}`);
  }
  
  // Use cleaned events (or original if already under limit)
  const recentEvents = allEvents.length > maxStoredEvents ? allEvents.slice(0, maxStoredEvents) : allEvents;
  
  // Use the actual total from KV, but limit displayed events to 50
  const actualTotal = kvTotal;
  const displayTotal = Math.min(actualTotal, maxStoredEvents);
  
  // Apply pagination to recent events (newest first)
  // Reverse the events array so newest events come first
  const reversedEvents = recentEvents.slice().reverse();
  const paginatedEvents = reversedEvents.slice(offset, offset + limit);
  
  // Calculate sublink counts from paginated events only (for performance)
  const subCounts = new Map<string, number>();
  paginatedEvents.forEach(event => {
    if (event.sub) {
      subCounts.set(event.sub, (subCounts.get(event.sub) || 0) + 1);
    }
  });
  
  // Convert to subs format
  const subs = Array.from(subCounts.entries()).map(([id, count]) => ({
    id,
    url: '', // We don't have URL info in events, so leave empty
    count
  }));
  
  console.log('📊 Paginated Analytics - Project:', pid, 'Total:', actualTotal, 'Display:', displayTotal, 'Page:', offset/limit, 'Limit:', limit, 'Events returned:', paginatedEvents.length);
  
  return { 
    total: actualTotal, 
    today, 
    thisWeek, 
    thisMonth, 
    events: paginatedEvents,
    subs,
    pagination: {
      page: Math.floor(offset / limit),
      limit,
      offset,
      total: displayTotal, // Use display total for pagination
      hasMore: offset + limit < displayTotal
    }
  };
}
async function readGroupAnalytics(env: Env, gid: string) {
  const total = await getNumber(env.LINKS_CONFIG, `${AN_GROUP}${gid}:total`);
  const today = await getNumber(env.LINKS_CONFIG, `${AN_GROUP}${gid}:daily:${ymd()}`);
  const thisWeek = await getNumber(env.LINKS_CONFIG, `${AN_GROUP}${gid}:weekly:${isoWeek()}`);
  const thisMonth = await getNumber(env.LINKS_CONFIG, `${AN_GROUP}${gid}:monthly:${ym()}`);
  return { total, today, thisWeek, thisMonth };
}

/* ================= A/B Testing Statistical Analysis ================= */
interface ABTestResult {
  variant: string;
  clicks: number;
  conversions: number;
  conversionRate: number;
  confidence: number;
  isSignificant: boolean;
  pValue: number;
  lift: number;
}

function calculateStatisticalSignificance(control: { clicks: number; conversions: number }, variant: { clicks: number; conversions: number }): ABTestResult {
  // Calculate conversion rates
  const controlRate = control.clicks > 0 ? control.conversions / control.clicks : 0;
  const variantRate = variant.clicks > 0 ? variant.conversions / variant.clicks : 0;
  
  // Calculate pooled standard error
  const pooledRate = (control.clicks + variant.clicks) > 0 ? 
    (control.conversions + variant.conversions) / (control.clicks + variant.clicks) : 0;
  const pooledSE = Math.sqrt(pooledRate * (1 - pooledRate) * (1/control.clicks + 1/variant.clicks));
  
  // Calculate z-score
  const zScore = pooledSE > 0 ? (variantRate - controlRate) / pooledSE : 0;
  
  // Calculate p-value (two-tailed test)
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));
  
  // Calculate confidence level
  const confidence = (1 - pValue) * 100;
  
  // Determine significance (95% confidence level)
  const isSignificant = pValue < 0.05;
  
  // Calculate lift
  const lift = controlRate > 0 ? ((variantRate - controlRate) / controlRate) * 100 : 0;
  
  return {
    variant: 'variant',
    clicks: variant.clicks,
    conversions: variant.conversions,
    conversionRate: variantRate,
    confidence,
    isSignificant,
    pValue,
    lift
  };
}

// Normal distribution CDF approximation
function normalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

// Error function approximation
function erf(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return sign * y;
}

async function getABTestingResults(env: Env, proj: Project): Promise<ABTestResult[]> {
  if (!proj.abTesting?.enabled || !proj.items || proj.items.length < 2) {
    return [];
  }
  
  const results: ABTestResult[] = [];
  const control = proj.items[0]; // First item is control
  
  // Get control data
  const controlClicks = await getNumber(env.LINKS_CONFIG, `${AN_PROJ}${proj.id}:ab:variant:${control.label || 'A'}`);
  const controlConversions = await getNumber(env.LINKS_CONFIG, `${AN_PROJ}${proj.id}:ab:conversions:${control.label || 'A'}`);
  
  // Analyze each variant against control
  for (let i = 1; i < proj.items.length; i++) {
    const variant = proj.items[i];
    const variantClicks = await getNumber(env.LINKS_CONFIG, `${AN_PROJ}${proj.id}:ab:variant:${variant.label || `Variant${i}`}`);
    const variantConversions = await getNumber(env.LINKS_CONFIG, `${AN_PROJ}${proj.id}:ab:conversions:${variant.label || `Variant${i}`}`);
    
    if (variantClicks > 0) {
      const result = calculateStatisticalSignificance(
        { clicks: controlClicks, conversions: controlConversions },
        { clicks: variantClicks, conversions: variantConversions }
      );
      result.variant = variant.label || `Variant${i}`;
      results.push(result);
    }
  }
  
  return results;
}

/* ================= Session helpers (to fix editor buttons) ================= */
function hasSessionCookie(req: Request): boolean {
  const c = req.headers.get("cookie") || "";
  console.log('DEBUG: hasSessionCookie checking cookies:', c);
  
  // Check for both old format (ls_session=1) and new format (ls_session_token=...)
  const hasOldFormat = /(?:^|;\s*)ls_session=1(?:;|$)/.test(c);
  const hasNewFormat = /(?:^|;\s*)ls_session_token=([^;]+)/.test(c);
  
  console.log('DEBUG: hasSessionCookie result:', { hasOldFormat, hasNewFormat, cookies: c });
  
  return hasOldFormat || hasNewFormat;
}
function setSessionCookieHeaders(host?: string): HeadersInit {
  // set Domain to the registrable suffix when possible (e.g. .bam-split.com)
  let domainAttr = "";
  if (host) {
    const h = host.toLowerCase();
    // if you only serve on bam-split.com / www.bam-split.com, this is safe:
    const root = h.endsWith("bam-split.com") ? ".bam-split.com" : "";
    if (root) domainAttr = `; Domain=${root}`;
  }
  return {
    "Set-Cookie":
      `ls_session=1; Secure; SameSite=Lax; Path=/; Max-Age=43200${domainAttr}`
  };
}

/* ================= Auth helpers ================= */
function needAuth(path: string) {
  // Lock down the HTML pages with Basic; APIs can use Basic OR session cookie
  return path === "/" || path === "/analytics";
}
function checkBasicAuth(request: Request): boolean {
  if (!AUTH_PASS) return true;
  const hdr = request.headers.get("authorization");
  if (!hdr || !hdr.toLowerCase().startsWith("basic ")) return false;
  const creds = atob(hdr.slice(6));
  const [u, p] = creds.split(":");
  return u === AUTH_USER && p === AUTH_PASS;
}
function unauthorized() {
  return new Response("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="link-splitter"' } });
}

/* ================= User Roles & Permissions ================= */
const USERS_PREFIX = 'user:';
const USERS_INDEX = 'users_index';

// Default permission sets for each role
function getDefaultPermissions(role: UserRole): UserPermissions {
  switch (role) {
    case 'admin':
      return {
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canCreateGroups: true,
        canEditGroups: true,
        canDeleteGroups: true,
        canViewAnalytics: true,
        canManageUsers: true,
        canAccessSettings: true,
        canManageBilling: true,
      };
    case 'editor':
      return {
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: false,
        canCreateGroups: true,
        canEditGroups: true,
        canDeleteGroups: false,
        canViewAnalytics: true,
        canManageUsers: false,
        canAccessSettings: false,
        canManageBilling: false,
      };
    case 'viewer':
      return {
        canCreateProjects: false,
        canEditProjects: false,
        canDeleteProjects: false,
        canCreateGroups: false,
        canEditGroups: false,
        canDeleteGroups: false,
        canViewAnalytics: true,
        canManageUsers: false,
        canAccessSettings: false,
        canManageBilling: false,
      };
    default:
      return getDefaultPermissions('viewer');
  }
}

// User management functions
async function getUsers(env: Env): Promise<User[]> {
  const userIds = (await getJSON<string[]>(env.LINKS_CONFIG, USERS_INDEX)) || [];
  const users = await Promise.all(userIds.map(id => getUser(env, id)));
  return users.filter(Boolean) as User[];
}

async function getUser(env: Env, userId: string): Promise<User | null> {
  return await getJSON<User>(env.LINKS_CONFIG, USERS_PREFIX + userId);
}

async function putUser(env: Env, user: User): Promise<void> {
  await putJSON(env.LINKS_CONFIG, USERS_PREFIX + user.id, user);
  await upsertUserIndex(env, user.id);
}

async function upsertUserIndex(env: Env, userId: string): Promise<void> {
  const userIds = (await getJSON<string[]>(env.LINKS_CONFIG, USERS_INDEX)) || [];
  if (!userIds.includes(userId)) {
    userIds.push(userId);
    await putJSON(env.LINKS_CONFIG, USERS_INDEX, userIds);
  }
}

async function removeUser(env: Env, userId: string): Promise<void> {
  await env.LINKS_CONFIG.delete(USERS_PREFIX + userId);
  const userIds = (await getJSON<string[]>(env.LINKS_CONFIG, USERS_INDEX)) || [];
  await putJSON(env.LINKS_CONFIG, USERS_INDEX, userIds.filter(id => id !== userId));
}

// Session management
async function createUserSession(env: Env, user: User): Promise<string> {
  const sessionId = genId();
  const session: UserSession = {
    userId: user.id,
    role: user.role,
    permissions: user.permissions,
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
  };
  
  await putJSON(env.LINKS_CONFIG, `session:${sessionId}`, session);
  return sessionId;
}

async function getUserSession(env: Env, sessionId: string): Promise<UserSession | null> {
  console.log('DEBUG: Getting user session for token:', sessionId);
  const sessionKey = USER_SESSIONS_PREFIX + sessionId;
  console.log('DEBUG: Looking for session with key:', sessionKey);
  
  const session = await getJSON<UserSession>(env.LINKS_CONFIG, sessionKey);
  console.log('DEBUG: Retrieved session:', session);
  
  if (!session) {
    console.log('DEBUG: No session found in KV for key:', sessionKey);
    return null;
  }
  
  if (session.expiresAt < Date.now()) {
    console.log('DEBUG: Session expired:', {
      expiresAt: session.expiresAt,
      currentTime: Date.now(),
      expired: session.expiresAt < Date.now()
    });
    return null;
  }
  
  console.log('DEBUG: Valid session found:', session);
  return session;
}

// Permission checking functions
function hasPermission(permissions: UserPermissions, action: keyof UserPermissions): boolean {
  return permissions[action] || false;
}
function checkPermission(session: UserSession | null, action: keyof UserPermissions): boolean {
  if (!session) return false;
  return hasPermission(session.permissions, action);
}

// Enhanced auth function for role-based access
async function checkRoleAuth(req: Request, env: Env, requiredPermission?: keyof UserPermissions): Promise<{ authorized: boolean; session?: UserSession; user?: User; apiKey?: ApiKey }> {
  // Check API key auth first
  const apiKeyAuth = await checkApiKeyAuth(req, env, requiredPermission);
  if (apiKeyAuth.authorized) {
    return { authorized: true, user: apiKeyAuth.user, apiKey: apiKeyAuth.apiKey };
  }
  
  // Check basic auth (admin access)
  if (checkBasicAuth(req)) {
    // For basic auth, create/get a default admin user
    let adminUser = (await getUsers(env)).find(u => u.email === 'admin@example.com');
    if (!adminUser) {
              adminUser = {
          id: genId(),
          email: 'admin@example.com',
          name: 'Administrator',
          passwordHash: hashPassword('admin123'), // Default admin password
          role: 'admin',
          permissions: getDefaultPermissions('admin'),
          createdAt: Date.now(),
          isActive: true,
        };
      await putUser(env, adminUser);
    }
    return { authorized: true, user: adminUser };
  }

  // Check session-based auth
  const cookies = req.headers.get('cookie') || '';
  console.log('DEBUG: checkRoleAuth - cookies:', cookies);
  
  const sessionMatch = cookies.match(/ls_session_token=([^;]+)/);
  console.log('DEBUG: checkRoleAuth - sessionMatch:', sessionMatch);
  
  if (sessionMatch) {
    const sessionId = sessionMatch[1];
    console.log('DEBUG: checkRoleAuth - sessionId:', sessionId);
    
    const session = await getUserSession(env, sessionId);
    console.log('DEBUG: checkRoleAuth - session retrieved:', session);
    
    if (session) {
      const user = await getUser(env, session.userId);
      console.log('DEBUG: checkRoleAuth - user retrieved:', user);
      
      if (user && user.isActive) {
        // Update last login
        user.lastLoginAt = Date.now();
        await putUser(env, user);
        
        // Check specific permission if required
        if (requiredPermission && !checkPermission(session, requiredPermission)) {
          console.log('DEBUG: checkRoleAuth - permission check failed:', requiredPermission);
          return { authorized: false, session, user };
        }
        
        console.log('DEBUG: checkRoleAuth - authorization successful');
        return { authorized: true, session, user };
      } else {
        console.log('DEBUG: checkRoleAuth - user not found or inactive');
      }
    } else {
      console.log('DEBUG: checkRoleAuth - no session found');
    }
  } else {
    console.log('DEBUG: checkRoleAuth - no session cookie found');
  }

  return { authorized: false };
}

/* ================= Team Workspaces ================= */
const TEAMS_PREFIX = 'team:';
const TEAMS_INDEX = 'teams_index';
const USER_TEAMS_PREFIX = 'user_teams:';
const USER_SESSIONS_PREFIX = 'session:';

// Activity Logging
const ACTIVITY_LOGS_PREFIX = 'activity:';
const ACTIVITY_LOGS_INDEX = 'activity_index';
const USER_ACTIVITY_PREFIX = 'user_activity:';

// Webhooks
const WEBHOOKS_PREFIX = 'webhook:';
const WEBHOOKS_INDEX = 'webhooks_index';
const WEBHOOK_EVENTS_PREFIX = 'webhook_event:';
const WEBHOOK_EVENTS_INDEX = 'webhook_events_index';

// API Keys
const API_KEYS_PREFIX = 'api_key:';
const API_KEYS_INDEX = 'api_keys_index';
const API_KEY_USAGE_PREFIX = 'api_key_usage:';
const API_KEY_USAGE_INDEX = 'api_key_usage_index';

// Advanced Analytics
const ANALYTICS_CACHE_PREFIX = 'analytics_cache:';
const ANALYTICS_METRICS_PREFIX = 'analytics_metrics:';

// Team management functions
async function getTeams(env: Env): Promise<Team[]> {
  const teamIds = (await getJSON<string[]>(env.LINKS_CONFIG, TEAMS_INDEX)) || [];
  const teams = await Promise.all(teamIds.map(id => getTeam(env, id)));
  return teams.filter(Boolean) as Team[];
}

async function getTeam(env: Env, teamId: string): Promise<Team | null> {
  return await getJSON<Team>(env.LINKS_CONFIG, TEAMS_PREFIX + teamId);
}

async function putTeam(env: Env, team: Team): Promise<void> {
  await putJSON(env.LINKS_CONFIG, TEAMS_PREFIX + team.id, team);
  await upsertTeamIndex(env, team.id);
}

async function upsertTeamIndex(env: Env, teamId: string): Promise<void> {
  const teamIds = (await getJSON<string[]>(env.LINKS_CONFIG, TEAMS_INDEX)) || [];
  if (!teamIds.includes(teamId)) {
    teamIds.push(teamId);
    await putJSON(env.LINKS_CONFIG, TEAMS_INDEX, teamIds);
  }
}

async function removeTeam(env: Env, teamId: string): Promise<void> {
  await env.LINKS_CONFIG.delete(TEAMS_PREFIX + teamId);
  const teamIds = (await getJSON<string[]>(env.LINKS_CONFIG, TEAMS_INDEX)) || [];
  await putJSON(env.LINKS_CONFIG, TEAMS_INDEX, teamIds.filter(id => id !== teamId));
}

/* ================= Activity Logging ================= */
async function logActivity(
  env: Env, 
  userId: string, 
  userEmail: string, 
  userRole: UserRole,
  action: string, 
  resourceType: ActivityLogEntry['resourceType'], 
  resourceId: string, 
  resourceName: string, 
  details: Record<string, any> = {},
  request?: Request
): Promise<void> {
  const logEntry: ActivityLogEntry = {
    id: genId(),
    timestamp: Date.now(),
    userId,
    userEmail,
    userRole,
    action,
    resourceType,
    resourceId,
    resourceName,
    details,
    ipAddress: request?.headers.get('cf-connecting-ip') || request?.headers.get('x-forwarded-for') || undefined,
    userAgent: request?.headers.get('user-agent') || undefined,
    sessionId: request?.headers.get('cookie')?.match(/ls_session_token=([^;]+)/)?.[1] || undefined
  };

  // Store the log entry
  await putJSON(env.LINKS_CONFIG, ACTIVITY_LOGS_PREFIX + logEntry.id, logEntry);
  
  // Update the activity index
  const logIds = (await getJSON<string[]>(env.LINKS_CONFIG, ACTIVITY_LOGS_INDEX)) || [];
  logIds.unshift(logEntry.id); // Add to beginning for newest first
  if (logIds.length > 50) logIds.length = 50; // Keep only last 50 entries
  await putJSON(env.LINKS_CONFIG, ACTIVITY_LOGS_INDEX, logIds);
  
  // Update user activity index
  const userLogIds = (await getJSON<string[]>(env.LINKS_CONFIG, USER_ACTIVITY_PREFIX + userId)) || [];
  userLogIds.unshift(logEntry.id);
  if (userLogIds.length > 100) userLogIds.length = 100; // Keep only last 100 per user
  await putJSON(env.LINKS_CONFIG, USER_ACTIVITY_PREFIX + userId, userLogIds);
  
  console.log('📝 Activity logged:', { action, resourceType, resourceName, userId });
}

async function getActivityLogs(env: Env, filter?: ActivityLogFilter): Promise<ActivityLogEntry[]> {
  const logIds = (await getJSON<string[]>(env.LINKS_CONFIG, ACTIVITY_LOGS_INDEX)) || [];
  
  // Limit the number of logs we process to prevent performance issues
  const maxLogsToProcess = 50; // Process max 50 logs
  const limitedLogIds = logIds.slice(0, maxLogsToProcess);
  
  console.log(`📊 getActivityLogs: Processing ${limitedLogIds.length} logs out of ${logIds.length} total`);
  
  let logs = await Promise.all(limitedLogIds.map(id => getJSON<ActivityLogEntry>(env.LINKS_CONFIG, ACTIVITY_LOGS_PREFIX + id)));
  logs = logs.filter(Boolean) as ActivityLogEntry[];
  
  // Apply filters
  if (filter?.startDate) {
    const startTime = new Date(filter.startDate).getTime();
    logs = logs.filter(log => log && log.timestamp >= startTime);
  }
  
  if (filter?.endDate) {
    const endTime = new Date(filter.endDate).getTime();
    logs = logs.filter(log => log && log.timestamp <= endTime);
  }
  
  if (filter?.userId) {
    logs = logs.filter(log => log && log.userId === filter.userId);
  }
  
  if (filter?.action) {
    logs = logs.filter(log => log && log.action === filter.action);
  }
  
  if (filter?.resourceType) {
    logs = logs.filter(log => log && log.resourceType === filter.resourceType);
  }
  
  // Apply pagination
  const offset = filter?.offset || 0;
  const limit = filter?.limit || 50;
  logs = logs.slice(offset, offset + limit);
  
  console.log(`📊 getActivityLogs: Returning ${logs.length} logs after filtering and pagination`);
  
  return logs.filter(Boolean) as ActivityLogEntry[];
}

async function getUserActivityLogs(env: Env, userId: string, limit = 50): Promise<ActivityLogEntry[]> {
  const userLogIds = (await getJSON<string[]>(env.LINKS_CONFIG, USER_ACTIVITY_PREFIX + userId)) || [];
  const logs = await Promise.all(userLogIds.slice(0, limit).map(id => 
    getJSON<ActivityLogEntry>(env.LINKS_CONFIG, ACTIVITY_LOGS_PREFIX + id)
  ));
  return logs.filter(Boolean) as ActivityLogEntry[];
}

async function clearUserActivityLogs(env: Env, userId: string): Promise<{ cleared: number; success: boolean }> {
  try {
    // Get the main activity logs index
    const mainLogIds = (await getJSON<string[]>(env.LINKS_CONFIG, ACTIVITY_LOGS_INDEX)) || [];
    
    if (mainLogIds.length === 0) {
      return { cleared: 0, success: true };
    }
    
    // Get all logs and find ones related to this user
    const allLogs = await Promise.all(mainLogIds.map(id => 
      getJSON<ActivityLogEntry>(env.LINKS_CONFIG, ACTIVITY_LOGS_PREFIX + id)
    ));
    
    const validLogs = allLogs.filter(Boolean) as ActivityLogEntry[];
    
    console.log('DEBUG: clearUserActivityLogs - userId:', userId);
    console.log('DEBUG: clearUserActivityLogs - total logs found:', validLogs.length);
    
    // Find logs that should be cleared for this user
    const userLogIds: string[] = [];
    const logsToKeep: string[] = [];
    
    for (let i = 0; i < validLogs.length; i++) {
      const log = validLogs[i];
      const logId = mainLogIds[i];
      
      console.log('DEBUG: Examining log:', {
        logId,
        userId: log.userId,
        userEmail: log.userEmail,
        action: log.action,
        resourceType: log.resourceType,
        resourceName: log.resourceName,
        targetUserId: userId
      });
      
      // Clear logs that belong to the user or are anonymous clicks on their projects
      let shouldClear = (log.userId === userId);
      console.log('DEBUG: Direct userId match:', shouldClear);
      
      // Also clear anonymous clicks on user's own projects
      if (!shouldClear && log.userId === 'anonymous' && log.action === 'click' && log.resourceType === 'project') {
        try {
          const project = await getProject(env, log.resourceId);
          console.log('DEBUG: Anonymous click project check:', {
            projectId: log.resourceId,
            projectUserId: project?.userId,
            targetUserId: userId,
            matches: project?.userId === userId
          });
          if (project && project.userId === userId) {
            shouldClear = true; // Clear anonymous clicks on user's own projects
          }
        } catch (error) {
          console.log('DEBUG: Error checking project:', error);
          // If we can't verify project ownership, don't clear
        }
      }
      
      console.log('DEBUG: Final shouldClear decision:', shouldClear);
      
      if (shouldClear) {
        userLogIds.push(logId);
      } else {
        logsToKeep.push(logId);
      }
    }
    
    if (userLogIds.length === 0) {
      return { cleared: 0, success: true };
    }
    
    // Update the main activity logs index (remove user's logs)
    await putJSON(env.LINKS_CONFIG, ACTIVITY_LOGS_INDEX, logsToKeep);
    
    // Delete all user's activity log entries
    for (const logId of userLogIds) {
      await env.LINKS_CONFIG.delete(ACTIVITY_LOGS_PREFIX + logId);
    }
    
    // Clear the user's activity index
    await env.LINKS_CONFIG.delete(USER_ACTIVITY_PREFIX + userId);
    
    // Log the clearing action itself (with minimal details)
    await logActivity(
      env,
      userId,
      'user@cleared.activity',
      'viewer', // Use viewer role to avoid privilege escalation
      'clear',
      'activity_log',
      userId,
      'Activity History',
      { clearedCount: userLogIds.length }
    );
    
    return { cleared: userLogIds.length, success: true };
  } catch (error) {
    console.error('Failed to clear user activity logs:', error);
    return { cleared: 0, success: false };
  }
}

/* ================= API Key Management ================= */
async function createApiKey(env: Env, apiKey: Omit<ApiKey, 'id' | 'key' | 'createdAt'> & { rawKey: string }): Promise<ApiKey> {
  const fullApiKey: ApiKey = {
    ...apiKey,
    id: genId(),
    key: await hashApiKey(apiKey.rawKey), // Hash the API key before storing
    createdAt: Date.now()
  };
  
  await putJSON(env.LINKS_CONFIG, API_KEYS_PREFIX + fullApiKey.id, fullApiKey);
  await upsertApiKeyIndex(env, fullApiKey.id);
  
  return fullApiKey;
}

async function getApiKeys(env: Env, userId?: string): Promise<ApiKey[]> {
  const apiKeyIds = (await getJSON<string[]>(env.LINKS_CONFIG, API_KEYS_INDEX)) || [];
  const apiKeys = await Promise.all(apiKeyIds.map(id => getApiKey(env, id)));
  const filtered = apiKeys.filter(Boolean) as ApiKey[];
  
  if (userId) {
    return filtered.filter(key => key.userId === userId);
  }
  return filtered;
}

async function getApiKey(env: Env, apiKeyId: string): Promise<ApiKey | null> {
  return await getJSON<ApiKey>(env.LINKS_CONFIG, API_KEYS_PREFIX + apiKeyId);
}

async function getApiKeyByHash(env: Env, hashedKey: string): Promise<ApiKey | null> {
  const apiKeys = await getApiKeys(env);
  return apiKeys.find(key => key.key === hashedKey) || null;
}

async function putApiKey(env: Env, apiKey: ApiKey): Promise<void> {
  await putJSON(env.LINKS_CONFIG, API_KEYS_PREFIX + apiKey.id, apiKey);
  await upsertApiKeyIndex(env, apiKey.id);
}

async function upsertApiKeyIndex(env: Env, apiKeyId: string): Promise<void> {
  const apiKeyIds = (await getJSON<string[]>(env.LINKS_CONFIG, API_KEYS_INDEX)) || [];
  if (!apiKeyIds.includes(apiKeyId)) {
    apiKeyIds.push(apiKeyId);
    await putJSON(env.LINKS_CONFIG, API_KEYS_INDEX, apiKeyIds);
  }
}

async function removeApiKey(env: Env, apiKeyId: string): Promise<void> {
  await env.LINKS_CONFIG.delete(API_KEYS_PREFIX + apiKeyId);
  const apiKeyIds = (await getJSON<string[]>(env.LINKS_CONFIG, API_KEYS_INDEX)) || [];
  await putJSON(env.LINKS_CONFIG, API_KEYS_INDEX, apiKeyIds.filter(id => id !== apiKeyId));
}

async function logApiKeyUsage(env: Env, usage: Omit<ApiKeyUsage, 'id'>): Promise<void> {
  const fullUsage: ApiKeyUsage = {
    ...usage,
    id: genId()
  };
  
  await putJSON(env.LINKS_CONFIG, API_KEY_USAGE_PREFIX + fullUsage.id, fullUsage);
  await upsertApiKeyUsageIndex(env, fullUsage.id);
}

async function upsertApiKeyUsageIndex(env: Env, usageId: string): Promise<void> {
  const usageIds = (await getJSON<string[]>(env.LINKS_CONFIG, API_KEY_USAGE_INDEX)) || [];
  usageIds.unshift(usageId); // Add to beginning for newest first
  if (usageIds.length > 10000) usageIds.length = 10000; // Keep only last 10k entries
  await putJSON(env.LINKS_CONFIG, API_KEY_USAGE_INDEX, usageIds);
}

async function hashApiKey(apiKey: string): Promise<string> {
  // In a real implementation, you'd use a proper hashing library
  // For now, we'll use a simple hash function
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyApiKey(env: Env, apiKey: string): Promise<ApiKey | null> {
  const hashedKey = await hashApiKey(apiKey);
  return await getApiKeyByHash(env, hashedKey);
}

async function checkApiKeyAuth(req: Request, env: Env, requiredPermission?: keyof UserPermissions): Promise<{ authorized: boolean; apiKey?: ApiKey; user?: User }> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return { authorized: false };
  }
  
  const apiKey = authHeader.slice(7); // Remove 'Bearer ' prefix
  const keyData = await verifyApiKey(env, apiKey);
  
  if (!keyData || !keyData.isActive) {
    return { authorized: false };
  }
  
  // Check if key is expired
  if (keyData.expiresAt && Date.now() > keyData.expiresAt) {
    return { authorized: false };
  }
  
  // Check IP restrictions
  if (keyData.allowedIPs && keyData.allowedIPs.length > 0) {
    const clientIP = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '';
    if (!keyData.allowedIPs.includes(clientIP)) {
      return { authorized: false };
    }
  }
  
  // Check rate limiting
  if (keyData.rateLimit) {
    const usage = await getApiKeyUsageStats(env, keyData.id);
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    
    const recentMinute = usage.filter(u => u.timestamp > oneMinuteAgo).length;
    const recentHour = usage.filter(u => u.timestamp > oneHourAgo).length;
    
    if (recentMinute > keyData.rateLimit.requestsPerMinute || 
        recentHour > keyData.rateLimit.requestsPerHour) {
      return { authorized: false };
    }
  }
  
  // Check permissions
  if (requiredPermission && !keyData.permissions[requiredPermission]) {
    return { authorized: false };
  }
  
  // Get user data
  const user = await getUser(env, keyData.userId);
  if (!user || !user.isActive) {
    return { authorized: false };
  }
  
  // Update last used timestamp
  keyData.lastUsed = Date.now();
  await putApiKey(env, keyData);
  
  return { authorized: true, apiKey: keyData, user };
}

async function getApiKeyUsageStats(env: Env, apiKeyId: string, hours: number = 24): Promise<ApiKeyUsage[]> {
  const usageIds = (await getJSON<string[]>(env.LINKS_CONFIG, API_KEY_USAGE_INDEX)) || [];
  const cutoff = Date.now() - (hours * 60 * 60 * 1000);
  
  const recentUsage = await Promise.all(
    usageIds
      .slice(0, 1000) // Limit to recent 1000 entries for performance
      .map(id => getJSON<ApiKeyUsage>(env.LINKS_CONFIG, API_KEY_USAGE_PREFIX + id))
  );
  
  return recentUsage
    .filter(Boolean)
    .filter(usage => usage!.apiKeyId === apiKeyId && usage!.timestamp > cutoff) as ApiKeyUsage[];
}

/* ================= Webhook Management ================= */
async function createWebhook(env: Env, webhook: Omit<Webhook, 'id' | 'createdAt' | 'failureCount'>): Promise<Webhook> {
  const fullWebhook: Webhook = {
    ...webhook,
    id: genId(),
    createdAt: Date.now(),
    failureCount: 0
  };
  
  await putJSON(env.LINKS_CONFIG, WEBHOOKS_PREFIX + fullWebhook.id, fullWebhook);
  await upsertWebhookIndex(env, fullWebhook.id);
  
  return fullWebhook;
}

async function getWebhooks(env: Env): Promise<Webhook[]> {
  const webhookIds = (await getJSON<string[]>(env.LINKS_CONFIG, WEBHOOKS_INDEX)) || [];
  const webhooks = await Promise.all(webhookIds.map(id => getWebhook(env, id)));
  return webhooks.filter(Boolean) as Webhook[];
}

async function getWebhook(env: Env, webhookId: string): Promise<Webhook | null> {
  return await getJSON<Webhook>(env.LINKS_CONFIG, WEBHOOKS_PREFIX + webhookId);
}

async function upsertWebhookIndex(env: Env, webhookId: string): Promise<void> {
  const webhookIds = (await getJSON<string[]>(env.LINKS_CONFIG, WEBHOOKS_INDEX)) || [];
  if (!webhookIds.includes(webhookId)) {
    webhookIds.push(webhookId);
    await putJSON(env.LINKS_CONFIG, WEBHOOKS_INDEX, webhookIds);
  }
}

async function triggerWebhook(env: Env, webhook: Webhook, eventType: string, payload: any): Promise<void> {
  if (!webhook.isActive) return;
  
  const event: WebhookEvent = {
    id: genId(),
    webhookId: webhook.id,
    eventType,
    payload,
    status: 'pending',
    attempts: 0,
    createdAt: Date.now()
  };
  
  // Store webhook event
  await putJSON(env.LINKS_CONFIG, WEBHOOK_EVENTS_PREFIX + event.id, event);
  await upsertWebhookEventIndex(env, event.id);
  
  // Trigger webhook delivery
  await deliverWebhook(env, webhook, event);
}

async function deliverWebhook(env: Env, webhook: Webhook, event: WebhookEvent): Promise<void> {
  try {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'User-Agent': 'BAM-Splitter/1.0',
      'X-Webhook-Signature': generateWebhookSignature(webhook.secret, JSON.stringify(event.payload))
    });
    
    // Add custom headers
    if (webhook.headers) {
      Object.entries(webhook.headers).forEach(([key, value]) => {
        headers.append(key, value);
      });
    }
    
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: event.eventType,
        timestamp: event.createdAt,
        data: event.payload,
        webhookId: webhook.id
      })
    });
    
    // Update event status
    event.status = response.ok ? 'sent' : 'failed';
    event.attempts++;
    event.lastAttempt = Date.now();
    event.response = {
      status: response.status,
      body: await response.text(),
      headers: Object.fromEntries(response.headers.entries())
    };
    
    if (response.ok) {
      // Update webhook last triggered
      webhook.lastTriggered = Date.now();
      await putJSON(env.LINKS_CONFIG, WEBHOOKS_PREFIX + webhook.id, webhook);
    } else {
      // Handle retry logic
      await handleWebhookRetry(env, webhook, event);
    }
    
    await putJSON(env.LINKS_CONFIG, WEBHOOK_EVENTS_PREFIX + event.id, event);
    
  } catch (error) {
    event.status = 'failed';
    event.attempts++;
    event.lastAttempt = Date.now();
    event.response = {
      status: 0,
      body: error instanceof Error ? error.message : 'Unknown error',
      headers: {}
    };
    
    await putJSON(env.LINKS_CONFIG, WEBHOOK_EVENTS_PREFIX + event.id, event);
    await handleWebhookRetry(env, webhook, event);
  }
}

async function handleWebhookRetry(env: Env, webhook: Webhook, event: WebhookEvent): Promise<void> {
  if (event.attempts >= webhook.retryPolicy.maxRetries) {
    event.status = 'failed';
    webhook.failureCount++;
    await putJSON(env.LINKS_CONFIG, WEBHOOKS_PREFIX + webhook.id, webhook);
    return;
  }
  
  const delay = webhook.retryPolicy.initialDelay * Math.pow(webhook.retryPolicy.backoffMultiplier, event.attempts - 1);
  event.status = 'retrying';
  event.nextRetry = Date.now() + delay;
  
  await putJSON(env.LINKS_CONFIG, WEBHOOK_EVENTS_PREFIX + event.id, event);
  
  // Schedule retry
  setTimeout(() => deliverWebhook(env, webhook, event), delay);
}

async function upsertWebhookEventIndex(env: Env, eventId: string): Promise<void> {
  const eventIds = (await getJSON<string[]>(env.LINKS_CONFIG, WEBHOOK_EVENTS_INDEX)) || [];
  eventIds.unshift(eventId);
  if (eventIds.length > 1000) eventIds.length = 1000;
  await putJSON(env.LINKS_CONFIG, WEBHOOK_EVENTS_INDEX, eventIds);
}

function generateWebhookSignature(secret: string, payload: string): string {
  // Simple HMAC-like signature for webhook verification
  let hash = '';
  for (let i = 0; i < payload.length; i++) {
    const charCode = payload.charCodeAt(i);
    hash += charCode.toString(36);
  }
  return hash + '_' + secret.length;
}

/* ================= Real-Time Activity Feed ================= */
async function getActivityFeed(env: Env, limit = 20, offset = 0, currentUserRole?: UserRole, currentUserId?: string): Promise<{ items: ActivityFeedItem[]; total: number; hasMore: boolean }> {
  try {
    const logIds = (await getJSON<string[]>(env.LINKS_CONFIG, ACTIVITY_LOGS_INDEX)) || [];
    
    // Limit the number of logs to process to avoid timeouts
    const limitedLogIds = logIds.slice(0, 50); // Process max 50 logs (reduced from 100)
    
    // Get all logs first for filtering
    const allLogs = await Promise.all(limitedLogIds.map(id => 
      getJSON<ActivityLogEntry>(env.LINKS_CONFIG, ACTIVITY_LOGS_PREFIX + id)
    ));
    
    const validLogs = allLogs.filter(Boolean) as ActivityLogEntry[];
    
    // Simplified filtering for non-admin users
    let filteredLogs = validLogs;
    
    if (currentUserRole && currentUserRole !== 'admin') {
      console.log('DEBUG: Filtering for non-admin user - role:', currentUserRole, 'userId:', currentUserId);
      
      // Simple filtering - only show user's own activity and anonymous clicks
      filteredLogs = validLogs.filter(log => {
        // Always show their own activity
        if (log.userId === currentUserId) {
          return true;
        }
        
        // Hide admin activity completely
        if (log.userRole === 'admin') {
          return false;
        }
        
        // For editors and viewers, show anonymous clicks (simplified)
        if (currentUserRole === 'editor' || currentUserRole === 'viewer') {
          // Show anonymous clicks (simplified approach)
          if (log.userId === 'anonymous' && log.action === 'click') {
            return true;
          }
          
          // Hide other users' activity
          return false;
        }
        
        return false;
      });
    }
    
    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply pagination
    const total = filteredLogs.length;
    const paginatedLogs = filteredLogs.slice(offset, offset + limit);
    const hasMore = offset + limit < total;
    
    // Convert to feed items with enhanced display info
    const feedItems: ActivityFeedItem[] = await Promise.all(
      paginatedLogs.map(async (log) => {
        const user = await getUser(env, log.userId);
        const avatar = generateAvatar(log.userEmail);
        
        return {
          id: log.id,
          timestamp: log.timestamp,
          userId: log.userId,
          userEmail: log.userEmail,
          userRole: log.userRole,
          action: log.action,
          resourceType: log.resourceType,
        resourceName: log.resourceName,
        details: log.details,
        avatar,
        isLive: Date.now() - log.timestamp < 5 * 60 * 1000, // 5 minutes = "live"
        ipAddress: log.ipAddress // Include IP address for display
      };
    })
  );
  
  return {
    items: feedItems,
    total,
    hasMore
  };
  
  } catch (error) {
    console.error('Error in getActivityFeed:', error);
    // Return empty feed if there's an error
    return {
      items: [],
      total: 0,
      hasMore: false
    };
  }
}

async function getQuickStats(env: Env): Promise<QuickStats> {
  try {
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    
    // Get all projects
    const projects = await getProjects(env);
    const totalProjects = projects.length;
    
    // Get active users (users with activity in last 24 hours)
    let recentLogs: ActivityLogEntry[] = [];
    try {
      recentLogs = await getActivityLogs(env, {
        startDate: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        limit: 100 // Reduced from 1000
      });
    } catch (error) {
      console.log('Warning: Could not fetch activity logs:', error);
      recentLogs = [];
    }
    
    const activeUsers = new Set(recentLogs.map(log => log.userId)).size;
    
    // Get today's clicks (placeholder - would need actual click tracking)
    const todayClicks = recentLogs.filter(log => 
      log.action === 'click' && log.timestamp >= todayStart
    ).length;
    
    // Get total clicks (placeholder)
    const totalClicks = recentLogs.filter(log => log.action === 'click').length;
    
    // Calculate recent growth (last 7 days vs previous 7 days)
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
    
    const recentWeekLogs = recentLogs.filter(log => log.timestamp >= weekAgo);
    let previousWeekLogs: ActivityLogEntry[] = [];
    try {
      previousWeekLogs = await getActivityLogs(env, {
        startDate: new Date(twoWeeksAgo).toISOString(),
        endDate: new Date(weekAgo).toISOString(),
        limit: 100 // Reduced from 1000
      });
    } catch (error) {
      console.log('Warning: Could not fetch previous week logs:', error);
      previousWeekLogs = [];
    }
    
    const recentGrowth = {
      projects: projects.filter(p => p.updatedAt >= weekAgo).length,
      users: new Set(recentWeekLogs.map(log => log.userId)).size,
      clicks: recentWeekLogs.filter(log => log.action === 'click').length
    };
    
    let activeSessions = 0;
    try {
      activeSessions = await getActiveSessions(env);
    } catch (error) {
      console.log('Warning: Could not get active sessions:', error);
      activeSessions = 0;
    }
    
    return {
      totalProjects,
      activeUsers,
      todayClicks,
      totalClicks,
      systemUptime: 99.9, // Placeholder
      activeSessions,
      recentGrowth
    };
  } catch (error) {
    console.error('Error in getQuickStats:', error);
    // Return default values if everything fails
    return {
      totalProjects: 0,
      activeUsers: 0,
      todayClicks: 0,
      totalClicks: 0,
      systemUptime: 99.9,
      activeSessions: 0,
      recentGrowth: {
        projects: 0,
        users: 0,
        clicks: 0
      }
    };
  }
}

function generateAvatar(email: string): string {
  // Generate a simple avatar based on email
  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8"];
  const color = colors[email.charCodeAt(0) % colors.length];
  const initials = email.substring(0, 2).toUpperCase();
  
  const svg = `<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" fill="${color}" rx="20"/>
    <text x="20" y="25" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="white">${initials}</text>
  </svg>`;
  
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function formatActivityDescription(action: string, resourceType: string, resourceName: string, details: Record<string, any>, ipAddress?: string): string {
  const actionMap: Record<string, string> = {
    'create': 'created',
    'update': 'updated',
    'delete': 'deleted',
    'login': 'logged in',
    'click': 'clicked',
    'view': 'viewed'
  };
  
  const resourceMap: Record<string, string> = {
    'project': 'project',
    'group': 'group',
    'user': 'user',
    'team': 'team',
    'webhook': 'webhook',
    'link': 'link'
  };
  
  const actionText = actionMap[action] || action;
  const resourceText = resourceMap[resourceType] || resourceType;
  
  let description = `${actionText} ${resourceText}`;
  
  if (resourceName && resourceName !== 'Unknown') {
    description += ` "${resourceName}"`;
  }
  
  // Add IP address for click actions
  if (action === 'click' && ipAddress) {
    description += ` <span style="opacity: 0.7; font-size: 0.9em;">(${ipAddress})</span>`;
  }
  
  // Add specific details
  if (details.newUserRole) {
    description += ` with role ${details.newUserRole}`;
  }
  if (details.webhookUrl) {
    description += ` to ${details.webhookUrl}`;
  }
  
  return description;
}

/* ================= Advanced Analytics ================= */
async function generateAdvancedAnalytics(env: Env, query: AnalyticsQuery): Promise<AdvancedAnalytics> {
  const startTime = new Date(query.startDate).getTime();
  const endTime = new Date(query.endDate).getTime();
  
  // Get limited activity logs for the time period (max 50 for performance)
  const allLogs = await getActivityLogs(env, {
    startDate: query.startDate,
    endDate: query.endDate,
    limit: 50 // Limited to 50 for performance
  });
  
  // Filter logs based on query filters
  let filteredLogs = allLogs;
  if (query.filters?.userId) {
    filteredLogs = filteredLogs.filter(log => log.userId === query.filters!.userId);
  }
  if (query.filters?.projectId) {
    filteredLogs = filteredLogs.filter(log => log.resourceId === query.filters!.projectId);
  }
  if (query.filters?.action) {
    filteredLogs = filteredLogs.filter(log => log.action === query.filters!.action);
  }
  
  // Calculate user engagement metrics
  const uniqueUsers = new Set(filteredLogs.map(log => log.userId));
  const userEngagement = {
    activeUsers: {
      daily: uniqueUsers.size,
      weekly: uniqueUsers.size,
      monthly: uniqueUsers.size
    },
    userRetention: {
      day7: calculateRetention(filteredLogs, 7),
      day30: calculateRetention(filteredLogs, 30),
      day90: calculateRetention(filteredLogs, 90)
    },
    sessionMetrics: {
      avgDuration: calculateAverageSessionDuration(filteredLogs),
      avgPagesPerSession: calculateAveragePagesPerSession(filteredLogs)
    },
    topUsers: await getTopUsers(env, filteredLogs, 10)
  };
  
  // Calculate project performance metrics
  const projects = await getProjects(env);
  const projectPerformance = {
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.updatedAt > startTime).length,
    projectGrowth: {
      weekly: projects.filter(p => p.updatedAt > startTime - 7 * 24 * 60 * 60 * 1000).length,
      monthly: projects.filter(p => p.updatedAt > startTime - 30 * 24 * 60 * 60 * 1000).length
    },
    topPerformingProjects: await getTopPerformingProjects(env, filteredLogs, 10)
  };
  
  // Calculate system health metrics
  const systemHealth = {
    uptime: 99.9, // Placeholder - would need actual uptime tracking
    responseTime: { avg: 150, p95: 300, p99: 500 }, // Placeholder
    errorRate: calculateErrorRate(filteredLogs),
    activeSessions: await getActiveSessions(env)
  };
  
  // Calculate business metrics
  const businessMetrics = {
    totalClicks: calculateTotalClicks(filteredLogs),
    conversionRate: calculateConversionRate(filteredLogs),
    revenueImpact: calculateRevenueImpact(filteredLogs),
    geographicDistribution: calculateGeographicDistribution(filteredLogs),
    deviceBreakdown: calculateDeviceBreakdown(filteredLogs)
  };
  
  return {
    userEngagement,
    projectPerformance,
    systemHealth,
    businessMetrics
  };
}

// Helper functions for analytics calculations
function calculateRetention(logs: ActivityLogEntry[], days: number): number {
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
  const recentUsers = new Set(logs.filter(log => log.timestamp > cutoffTime).map(log => log.userId));
  const totalUsers = new Set(logs.map(log => log.userId));
  
  return totalUsers.size > 0 ? (recentUsers.size / totalUsers.size) * 100 : 0;
}

function calculateAverageSessionDuration(logs: ActivityLogEntry[]): number {
  // Placeholder - would need actual session duration tracking
  return 300; // 5 minutes average
}

function calculateAveragePagesPerSession(logs: ActivityLogEntry[]): number {
  // Placeholder - would need actual page view tracking
  return 3; // 3 pages average
}
async function getTopUsers(env: Env, logs: ActivityLogEntry[], limit: number): Promise<Array<{ userId: string; email: string; actions: number; lastActive: number }>> {
  const userActions = new Map<string, { actions: number; lastActive: number }>();
  
  logs.forEach(log => {
    const existing = userActions.get(log.userId) || { actions: 0, lastActive: 0 };
    existing.actions++;
    existing.lastActive = Math.max(existing.lastActive, log.timestamp);
    userActions.set(log.userId, existing);
  });
  
  const topUsers = Array.from(userActions.entries())
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.actions - a.actions)
    .slice(0, limit);
  
  // Add email addresses
  const usersWithEmails = await Promise.all(
    topUsers.map(async (user) => {
      const userData = await getUser(env, user.userId);
      return {
        ...user,
        email: userData?.email || 'Unknown'
      };
    })
  );
  
  return usersWithEmails;
}

async function getTopPerformingProjects(env: Env, logs: ActivityLogEntry[], limit: number): Promise<Array<{ id: string; name: string; clicks: number; conversionRate: number }>> {
  // Placeholder - would need actual click tracking data
  return [
    { id: '1', name: 'Sample Project', clicks: 1000, conversionRate: 2.5 },
    { id: '2', name: 'Another Project', clicks: 800, conversionRate: 3.1 }
  ];
}

function calculateErrorRate(logs: ActivityLogEntry[]): number {
  const errorActions = logs.filter(log => log.action.includes('error') || log.action.includes('fail')).length;
  return logs.length > 0 ? (errorActions / logs.length) * 100 : 0;
}

async function getActiveSessions(env: Env): Promise<number> {
  // Placeholder - would need actual session tracking
  return 25;
}

function calculateTotalClicks(logs: ActivityLogEntry[]): number {
  // Placeholder - would need actual click tracking
  return logs.filter(log => log.action === 'click').length;
}

function calculateConversionRate(logs: ActivityLogEntry[]): number {
  // Placeholder - would need actual conversion tracking
  return 2.8;
}

function calculateRevenueImpact(logs: ActivityLogEntry[]): number {
  // Placeholder - would need actual revenue tracking
  return 1250.50;
}

function calculateGeographicDistribution(logs: ActivityLogEntry[]): Record<string, number> {
  // Placeholder - would need actual geographic data
  return { 'US': 45, 'UK': 20, 'CA': 15, 'Other': 20 };
}

function calculateDeviceBreakdown(logs: ActivityLogEntry[]): Record<string, number> {
  // Placeholder - would need actual device data
  return { 'Desktop': 60, 'Mobile': 35, 'Tablet': 5 };
}

// Get teams for a specific user
async function getUserTeams(env: Env, userId: string): Promise<Team[]> {
  const userTeamIds = (await getJSON<string[]>(env.LINKS_CONFIG, USER_TEAMS_PREFIX + userId)) || [];
  const teams = await Promise.all(userTeamIds.map(id => getTeam(env, id)));
  return teams.filter(Boolean) as Team[];
}

// Add user to team
async function addUserToTeam(env: Env, teamId: string, userId: string, role: UserRole): Promise<void> {
  const team = await getTeam(env, teamId);
  if (!team) throw new Error('Team not found');
  
  // Check if user is already a member
  if (team.members.find(m => m.userId === userId)) {
    throw new Error('User is already a member of this team');
  }
  
  // Check team size limit
  if (team.members.length >= team.settings.maxTeamMembers) {
    throw new Error('Team has reached maximum member limit');
  }
  
  const newMember: TeamMember = {
    userId,
    role,
    joinedAt: Date.now(),
    permissions: getDefaultPermissions(role),
    isActive: true
  };
  
  team.members.push(newMember);
  team.updatedAt = Date.now();
  await putTeam(env, team);
  
  // Update user's team list
  const userTeamIds = (await getJSON<string[]>(env.LINKS_CONFIG, USER_TEAMS_PREFIX + userId)) || [];
  if (!userTeamIds.includes(teamId)) {
    userTeamIds.push(teamId);
    await putJSON(env.LINKS_CONFIG, USER_TEAMS_PREFIX + userId, userTeamIds);
  }
}

// Remove user from team
async function removeUserFromTeam(env: Env, teamId: string, userId: string): Promise<void> {
  const team = await getTeam(env, teamId);
  if (!team) throw new Error('Team not found');
  
  // Prevent removing team owner
  if (team.ownerId === userId) {
    throw new Error('Cannot remove team owner');
  }
  
  team.members = team.members.filter(m => m.userId !== userId);
  team.updatedAt = Date.now();
  await putTeam(env, team);
  
  // Update user's team list
  const userTeamIds = (await getJSON<string[]>(env.LINKS_CONFIG, USER_TEAMS_PREFIX + userId)) || [];
  await putJSON(env.LINKS_CONFIG, USER_TEAMS_PREFIX + userId, userTeamIds.filter(id => id !== teamId));
}

// Check if user has access to team
async function checkTeamAccess(env: Env, teamId: string, userId: string): Promise<{ hasAccess: boolean; role?: UserRole; permissions?: UserPermissions }> {
  const team = await getTeam(env, teamId);
  if (!team || !team.isActive) return { hasAccess: false };
  
  // Team owner has full access
  if (team.ownerId === userId) {
    return { hasAccess: true, role: 'admin', permissions: getDefaultPermissions('admin') };
  }
  
  // Check team membership
  const member = team.members.find(m => m.userId === userId && m.isActive);
  if (member) {
    return { hasAccess: true, role: member.role, permissions: member.permissions };
  }
  
  return { hasAccess: false };
}

// Get projects for a specific team
async function getTeamProjects(env: Env, teamId: string): Promise<Project[]> {
  const allProjects = await getProjects(env);
  const teamProjects: Project[] = [];
  
  for (const projectIndex of allProjects) {
    const project = await getProject(env, projectIndex.id);
    if (project && project.teamId === teamId) {
      teamProjects.push(project);
    }
  }
  
  return teamProjects;
}

/* ================= Worker ================= */
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const { pathname, searchParams } = url;

    // Protect HTML pages via Basic OR session cookie
    if (needAuth(pathname)) {
      if (!checkBasicAuth(req) && !hasSessionCookie(req)) {
        // If no basic auth and no session cookie, redirect to login
        if (pathname === "/") {
          return new Response("", {
            status: 302,
            headers: { "Location": "/login" }
          });
        }
        return unauthorized();
      }
    }

    // Allow APIs via Basic OR our session cookie
    if (pathname.startsWith("/api/")) {
      // Skip authentication for debug endpoints and auth endpoints
      if (pathname.startsWith("/api/debug/") || pathname.startsWith("/api/auth/")) {
        // Continue without auth check
      } else {
      const authed = checkBasicAuth(req) || hasSessionCookie(req);
      if (!authed) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json; charset=utf-8" }
        });
        }
      }
    }

 // UI pages (set the session cookie when we serve HTML)
if (req.method === "GET" && pathname === "/") {
  console.log('DEBUG: Main page requested - checking authentication...');
  console.log('DEBUG: Request cookies:', req.headers.get('cookie'));
  console.log('DEBUG: Request method:', req.method);
  console.log('DEBUG: Request pathname:', pathname);
  console.log('DEBUG: Request URL:', req.url);
  console.log('DEBUG: Request headers:', Array.from(req.headers.entries()));
  
  // Check if user is already authenticated via session
  console.log('DEBUG: About to call checkRoleAuth...');
  const auth = await checkRoleAuth(req, env);
  console.log('DEBUG: Main page auth result:', { 
    authorized: auth.authorized, 
    hasUser: !!auth.user, 
    userId: auth.user?.id,
    userRole: auth.user?.role,
    session: auth.session
  });
  
  if (auth.authorized && auth.user) {
    // User is authenticated, serve the editor
    console.log('DEBUG: Serving main page to authenticated user');
  const res = htmlResponse(await editorHtml(env));
    return new Response(res.body, { status: res.status, headers: res.headers });
  } else {
    // User not authenticated, redirect to login
    console.log('DEBUG: Redirecting unauthenticated user to login');
    return new Response("", {
      status: 302,
      headers: { "Location": "/login" }
    });
  }
}
if (req.method === "GET" && pathname === "/analytics") {
  const res = htmlResponse(await analyticsHtml(env));
  const h = new Headers(res.headers);
  const extra = setSessionCookieHeaders(url.hostname);
  Object.entries(extra).forEach(([k, v]) => h.append(k, v as string));
  return new Response(res.body, { status: res.status, headers: h });
}

// Login page for new users
    if (req.method === "GET" && pathname === "/login") {
      return htmlResponse(await loginHtml());
    }

    // Debug endpoint for password testing (temporarily unprotected)
    if (req.method === "POST" && pathname === "/api/debug/password") {
      const body = await req.json().catch(() => ({})) as any;
      const { password } = body;
      
      if (!password) {
        return jsonResponse({ error: "Password required" }, 400);
      }
      
      const hash = hashPassword(password);
      const verify = verifyPassword(password, hash);
      
      return jsonResponse({
        password,
        hash,
        verify,
        test: verifyPassword(password, hash)
      });
    }

    /* ---- Groups API ---- */
    if (req.method === "GET" && pathname === "/api/groups") {
      const auth = await checkRoleAuth(req, env);
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      
      let groups = await getGroups(env);
      
      // Filter groups for non-admin users (user isolation)
      if (auth.user && auth.user.role !== 'admin') {
        groups = groups.filter(g => g.userId === auth.user!.id);
      }
      
      return jsonResponse(groups);
    }
    
    if (req.method === "POST" && pathname === "/api/groups") {
      const auth = await checkRoleAuth(req, env, 'canCreateGroups');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Create groups permission required" }, 403);
      }
      
      const body = await req.json().catch(() => ({})) as { name?: string };
      const name = String(body.name ?? "New Group").trim() || "New Group";
      const g: Group = { 
        id: genId(), 
        name, 
        updatedAt: Date.now(),
        userId: auth.user?.id  // Set the user ID for user isolation
      };
      await putGroup(env, g); await upsertGroupIndex(env, g);
      return jsonResponse(g, 201);
    }
    if (req.method === "PUT" && pathname.startsWith("/api/groups/")) {
      const gid = pathname.split("/").pop()!;
      const g = await getGroup(env, gid);
      if (!g) return jsonResponse({ error: "Not found" }, 404);
      const body = await req.json().catch(() => ({})) as { name?: string };
      g.name = typeof body.name === "string" ? (body.name.trim() || g.name) : g.name;
      g.updatedAt = Date.now();
      await putGroup(env, g); await upsertGroupIndex(env, g);
      return jsonResponse(g);
    }
    if (req.method === "DELETE" && pathname.startsWith("/api/groups/")) {
      const gid = pathname.split("/").pop()!;
      const projs = await getProjects(env);
      const toDel = projs.filter(p => p.groupId === gid).map(p => p.id);
      for (const pid of toDel) { await env.LINKS_CONFIG.delete(PROJ_PREFIX + pid); await removeProjectFromIndex(env, pid); }
      await env.LINKS_CONFIG.delete(GROUP_PREFIX + gid); await removeGroupFromIndex(env, gid);
      return jsonResponse({ ok: true });
    }

    /* ---- Projects API ---- */
    if (req.method === "GET" && pathname === "/api/projects") {
      // Basic auth or session auth required for viewing projects
      const auth = await checkRoleAuth(req, env);
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      
      let projects = await getProjects(env);
      
      console.log('🔍 DEBUG: Raw projects from database:', projects.map(p => ({ id: p.id, name: p.name, userId: p.userId, groupId: p.groupId })));
      
      // Filter projects for non-admin users (user isolation) FIRST
      if (auth.user && auth.user.role !== 'admin') {
        console.log('🔍 DEBUG: Filtering projects for user:', auth.user.id, 'role:', auth.user.role);
        projects = projects.filter(p => p.userId === auth.user!.id);
        console.log('🔍 DEBUG: Projects after user isolation:', projects.map(p => ({ id: p.id, name: p.name, userId: p.userId })));
      }
      
      // Filter out projects without groups OR with non-existent groups
      const beforeGroupFilter = projects.length;
      
      // Get all valid groups to check against
      const allGroups = await getGroups(env);
      const validGroupIds = new Set(allGroups.map(g => g.id));
      
      // Debug each project's groupId to see what's happening
      console.log('🔍 DEBUG: Before group filtering - checking each project:');
      console.log('🔍 DEBUG: Valid group IDs:', Array.from(validGroupIds));
      projects.forEach(p => {
        const groupExists = validGroupIds.has(p.groupId);
        console.log(`  - Project: ${p.name} (${p.id}) - groupId: "${p.groupId}" - exists: ${groupExists}`);
      });
      
      projects = projects.filter(p => {
        const hasGroup = p.groupId && p.groupId.trim() !== '';
        const groupExists = validGroupIds.has(p.groupId);
        
        if (!hasGroup) {
          console.log(`🔍 DEBUG: Filtering out project without group: ${p.name} (${p.id}) - groupId: "${p.groupId}"`);
          return false;
        }
        
        if (!groupExists) {
          console.log(`🔍 DEBUG: Filtering out project with non-existent group: ${p.name} (${p.id}) - groupId: "${p.groupId}"`);
          return false;
        }
        
        return true;
      });
      
      if (beforeGroupFilter !== projects.length) {
        console.log(`🔍 DEBUG: Filtered out ${beforeGroupFilter - projects.length} ungrouped projects`);
      }
      console.log('🔍 DEBUG: Projects after group filtering:', projects.map(p => ({ id: p.id, name: p.name, groupId: p.groupId })));
      
      // No additional template filtering needed - if it's in a group, it's legitimate
      
      return jsonResponse(projects);
    }
    
    if (req.method === "POST" && pathname === "/api/projects") {
      const auth = await checkRoleAuth(req, env, 'canCreateProjects');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Create projects permission required" }, 403);
      }
      
      const body = await req.json().catch(() => ({})) as { name?: string; groupId?: string; main?: string; items?: any[] };
      const name = String(body.name ?? "New Project").trim() || "New Project";
      const groupId = String(body.groupId ?? "").trim();
      if (!groupId) return jsonResponse({ error: "groupId is required" }, 400);
      const main = String(body.main ?? "https://example.com").trim();
      if (!isHttpUrl(main)) return jsonResponse({ error: "Invalid main URL" }, 400);
      const items = Array.isArray(body.items) && body.items.length ? body.items : [
        { url: "https://example.com/a", label: "A" },
        { url: "https://example.com/b", label: "B" },
      ];
      let checked: SplitItem[];
      try { checked = normalizeWeights(items); } catch (e:any){ return jsonResponse({ error: e?.message || "Bad weights" }, 400); }
      const p: Project = { 
        id: genId(), 
        groupId, 
        name, 
        main, 
        items: checked, 
        updatedAt: Date.now(),
        userId: auth.user?.id  // Set the user ID for user isolation
      };
      
      console.log('🔍 DEBUG: Creating new project:', { 
        id: p.id, 
        name: p.name, 
        groupId: p.groupId, 
        userId: p.userId,
        userRole: auth.user?.role 
      });
      
      await putProject(env, p); 
      await upsertProjectIndex(env, p);
      
      console.log('🔍 DEBUG: Project created and indexed successfully');
      
      // Log the activity
      if (auth.user) {
        await logActivity(env, auth.user.id, auth.user.email, auth.user.role, 'create', 'project', p.id, p.name, { 
          projectId: p.id,
          groupId: p.groupId,
          itemCount: p.items.length
        }, req);
      }
      
      return jsonResponse(p, 201);
    }
    if (req.method === "GET" && pathname.startsWith("/api/projects/")) {
      const pid = pathname.split("/").pop()!;
      const p = await getProject(env, pid);
      if (!p) return jsonResponse({ error: "Not found" }, 404);
      return jsonResponse(p);
    }
    if (req.method === "PUT" && pathname.startsWith("/api/projects/")) {
      const pid = pathname.split("/").pop()!;
      const existing = await getProject(env, pid);
      if (!existing) return jsonResponse({ error: "Not found" }, 404);
      
      // Check user access (user isolation for non-admin users)
      const auth = await checkRoleAuth(req, env);
      if (!auth.authorized || !auth.user) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      
      // Non-admin users can only edit their own projects
      if (auth.user.role !== 'admin' && existing.userId !== auth.user.id) {
        console.log('DEBUG: User access denied - user:', auth.user.id, 'trying to edit project:', pid, 'owned by:', existing.userId);
        return jsonResponse({ error: "Access denied - you can only edit your own projects" }, 403);
      }
      
      const body = await req.json().catch(() => ({})) as any;
      console.log('DEBUG: PUT request body received:', JSON.stringify(body, null, 2));
      console.log('DEBUG: Existing project data:', JSON.stringify(existing, null, 2));
      const name = typeof body.name === "string" ? (body.name.trim() || existing.name) : existing.name;
      console.log('DEBUG: Name processing - body.name:', body.name, 'existing.name:', existing.name, 'final name:', name);
      const groupId = typeof body.groupId === "string" ? (body.groupId.trim() || existing.groupId) : existing.groupId;
      const main = typeof body.main === "string" ? (body.main.trim() || existing.main) : existing.main;
      if (!isHttpUrl(main)) return jsonResponse({ error: "Invalid main URL" }, 400);
      const items = Array.isArray(body.items) ? body.items : existing.items;
      let checked: SplitItem[];
      try { checked = normalizeWeights(items); } catch (e:any){ return jsonResponse({ error: e?.message || "Bad weights" }, 400); }
      
      // Handle advanced fields
      const safeLink = typeof body.safeLink === "string" ? body.safeLink.trim() || undefined : existing.safeLink;
      const customDomain = typeof body.customDomain === "string" ? body.customDomain.trim() || undefined : existing.customDomain;
      const customAlias = typeof body.customAlias === "string" ? body.customAlias.trim() || undefined : existing.customAlias;
      const expiresAt = typeof body.expiresAt === "number" ? body.expiresAt : existing.expiresAt;
      const clicksLimit = typeof body.clicksLimit === "number" ? body.clicksLimit : existing.clicksLimit;
      const fraudProtection = body.fraudProtection || existing.fraudProtection;
      const pixelSettings = body.pixelSettings || existing.pixelSettings;
      const targeting = Array.isArray(body.targeting) ? body.targeting : existing.targeting;
      const abTesting = body.abTesting || existing.abTesting;
      
      // Handle custom alias setting/updating/clearing
      if (customAlias !== existing.customAlias) {
        if (customAlias && customAlias !== '') {
          // Setting a new alias
          const aliasAvailable = await setCustomAlias(env, customAlias, pid);
          if (!aliasAvailable) {
            return jsonResponse({ error: "Custom alias already taken" }, 409);
          }
          console.log(`✅ Set new custom alias: ${customAlias}`);
        } else if (customAlias === '') {
          // Explicitly clearing the alias
          console.log(`🗑️ Clearing custom alias (was: ${existing.customAlias})`);
        }
        // Remove old alias if it exists (whether setting new one or clearing)
        if (existing.customAlias) {
          await env.LINKS_CONFIG.delete(`alias:${existing.customAlias}`);
          console.log(`🗑️ Removed old custom alias: ${existing.customAlias}`);
        }
      }
      
      const p: Project = { 
        id: pid, 
        groupId, 
        name, 
        main, 
        customAlias,
        expiresAt,
        clicksLimit,
        clickCount: existing.clickCount || 0,
        fraudProtection,
        items: checked, 
        updatedAt: Date.now(),
        userId: existing.userId, // Preserve user isolation
        teamId: existing.teamId, // Preserve team association
        safeLink,
        customDomain,
        pixelSettings,
        targeting,
        abTesting
      };
      
      console.log('DEBUG: Project update - saving project:', p.id, 'with targeting:', p.targeting);
      await putProject(env, p); 
      await upsertProjectIndex(env, p);
      
      // Log the activity (reuse existing auth object)
      if (auth.authorized && auth.user) {
        console.log('DEBUG: Logging project update activity for user:', auth.user.id);
        await logActivity(env, auth.user.id, auth.user.email, auth.user.role, 'update', 'project', p.id, p.name, { 
          updatedFields: Object.keys(body),
          hasTargeting: !!p.targeting && p.targeting.length > 0,
          targetingCount: p.targeting?.length || 0
        }, req);
      } else {
        console.log('DEBUG: Could not log activity - auth failed:', auth);
      }
      
      return jsonResponse(p);
    }
    if (req.method === "DELETE" && pathname.startsWith("/api/projects/")) {
      const pid = pathname.split("/").pop()!;
      await env.LINKS_CONFIG.delete(PROJ_PREFIX + pid);
      await removeProjectFromIndex(env, pid);
      return jsonResponse({ ok: true });
    }

    /* ---- Analytics API ---- */
    if (req.method === "GET" && pathname === "/api/analytics") {
      const auth = await checkRoleAuth(req, env, 'canViewAnalytics');
      if (!auth.authorized || !auth.user) return jsonResponse({ error: "Unauthorized" }, 401);
      
      const pid = searchParams.get("project");
      const gid = searchParams.get("group");
      if (!pid && !gid) return jsonResponse({ error: "Specify ?project=<id> or ?group=<id>" }, 400);
      if (pid) {
        const proj = await getProject(env, pid);
        if (!proj) return jsonResponse({ error: "Project not found" }, 404);
        
        // Ensure project has a group (ungrouped projects shouldn't appear in analytics)
        if (!proj.groupId || proj.groupId.trim() === '') {
          console.log('🔍 DEBUG: Analytics request rejected - project has no group:', { id: proj.id, name: proj.name, groupId: proj.groupId });
          return jsonResponse({ error: "Project must be in a group to view analytics" }, 400);
        }
        
        // Check if user has access to the group that contains this project
        const group = await getGroup(env, proj.groupId);
        if (!group) {
          console.log('🔍 DEBUG: Analytics request rejected - project group not found:', { projectId: proj.id, groupId: proj.groupId });
          return jsonResponse({ error: "Project group not found" }, 404);
        }
        
        // Check group ownership/access - admins can see all, editors can only see their own groups
        if (auth.user.role !== 'admin' && group.userId !== auth.user.id) {
          console.log('🔍 DEBUG: Analytics request rejected - user cannot access project group:', { 
            userId: auth.user.id, 
            userRole: auth.user.role, 
            projectId: proj.id, 
            groupId: proj.groupId, 
            groupUserId: group.userId 
          });
          return jsonResponse({ error: "Access denied to project" }, 403);
        }
        
        console.log('🔍 DEBUG: Analytics request for project:', { id: proj.id, name: proj.name, userId: proj.userId, groupId: proj.groupId });
        const an = await readProjectAnalytics(env, pid);
        console.log('📊 Analytics API - Project:', pid, 'Total clicks:', an.total, 'Events count:', an.events.length);
        // Calculate sublink counts from events array instead of relying on potentially broken increment system
        const subs = await Promise.all(proj.items.map(async it => {
          const subSlug = (it.label?.trim()||"") || slugForUrl(it.url);
          const key = `${AN_PROJ}${pid}:sub:${subSlug}`;
          const kvCount = await getNumber(env.LINKS_CONFIG, key);
          
          // Count actual events for this sublink
          const actualCount = an.events.filter(e => e.sub === subSlug).length;
          
          console.log('📊 Sub analytics - Project:', pid, 'Item:', it.label || slugForUrl(it.url), 'Key:', key, 'KV Count:', kvCount, 'Actual Count:', actualCount);
          
          // Use the higher count (either KV or events-based) to handle sync issues
          const count = Math.max(kvCount, actualCount);
          
          return { id: subSlug, url: it.url, count };
        }));
        console.log('📊 Analytics API response - Project:', pid, 'Total clicks:', an.total, 'Events count:', an.events.length, 'Subs:', subs);
        return jsonResponse({ project: { id: proj.id, name: proj.name, groupId: proj.groupId }, ...an, subs });
      }
      if (gid) {
        const g = await getGroup(env, gid);
        if (!g) return jsonResponse({ error: "Group not found" }, 404);
        
        // Check group ownership/access - admins can see all, editors can only see their own groups
        if (auth.user.role !== 'admin' && g.userId !== auth.user.id) {
          console.log('🔍 DEBUG: Analytics request rejected - user cannot access group:', { 
            userId: auth.user.id, 
            userRole: auth.user.role, 
            groupId: g.id, 
            groupUserId: g.userId 
          });
          return jsonResponse({ error: "Access denied to group" }, 403);
        }
        
        const an = await readGroupAnalytics(env, gid);
        return jsonResponse({ group: { id: g.id, name: g.name }, ...an });
      }
    }

    /* ---- Paginated Analytics API ---- */
    if (req.method === "GET" && pathname === "/api/analytics/paginated") {
      const auth = await checkRoleAuth(req, env, 'canViewAnalytics');
      if (!auth.authorized || !auth.user) return jsonResponse({ error: "Unauthorized" }, 401);
      
      const pid = searchParams.get("project");
      const page = parseInt(searchParams.get("page") || "0");
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = page * limit;
      
      if (!pid) return jsonResponse({ error: "Specify ?project=<id>" }, 400);
      
      const proj = await getProject(env, pid);
      if (!proj) return jsonResponse({ error: "Project not found" }, 404);
      
      // Check if user has access to the group that contains this project
      if (proj.groupId) {
        const group = await getGroup(env, proj.groupId);
        if (!group) {
          return jsonResponse({ error: "Project group not found" }, 404);
        }
        
        // Check group ownership/access - admins can see all, editors can only see their own groups
        if (auth.user.role !== 'admin' && group.userId !== auth.user.id) {
          return jsonResponse({ error: "Access denied to project" }, 403);
        }
      }
      
      // Get paginated analytics
      const analytics = await readProjectAnalyticsPaginated(env, pid, limit, offset);
      return jsonResponse(analytics);
    }

    /* ---- Fast Analytics API ---- */
    if (req.method === "GET" && pathname === "/api/analytics/fast") {
      const auth = await checkRoleAuth(req, env, 'canViewAnalytics');
      if (!auth.authorized || !auth.user) return jsonResponse({ error: "Unauthorized" }, 401);
      
      const pid = searchParams.get("project");
      if (!pid) return jsonResponse({ error: "Specify ?project=<id>" }, 400);
      
      const proj = await getProject(env, pid);
      if (!proj) return jsonResponse({ error: "Project not found" }, 404);
      
      // Check if user has access to the group that contains this project
      if (proj.groupId) {
        const group = await getGroup(env, proj.groupId);
        if (!group) {
          return jsonResponse({ error: "Project group not found" }, 404);
        }
        
        // Check group ownership/access - admins can see all, editors can only see their own groups
        if (auth.user.role !== 'admin' && group.userId !== auth.user.id) {
          return jsonResponse({ error: "Access denied to project" }, 403);
        }
      }
      
      // Get only essential data - no events array loading
      const [total, today, thisWeek, thisMonth] = await Promise.all([
        getNumber(env.LINKS_CONFIG, `${AN_PROJ}${pid}:total`),
        getNumber(env.LINKS_CONFIG, `${AN_PROJ}${pid}:daily:${ymd()}`),
        getNumber(env.LINKS_CONFIG, `${AN_PROJ}${pid}:weekly:${isoWeek()}`),
        getNumber(env.LINKS_CONFIG, `${AN_PROJ}${pid}:monthly:${ym()}`)
      ]);
      
      // Get sublink counts from individual KV keys (fast)
      const subs = await Promise.all(proj.items.map(async it => {
        const subSlug = (it.label?.trim()||"") || slugForUrl(it.url);
        const count = await getNumber(env.LINKS_CONFIG, `${AN_PROJ}${pid}:sub:${subSlug}`);
        return { id: subSlug, url: it.url, count: count || 0 };
      }));
      
      return jsonResponse({ 
        project: { id: proj.id, name: proj.name, groupId: proj.groupId }, 
        total: total || 0, 
        today: today || 0, 
        thisWeek: thisWeek || 0, 
        thisMonth: thisMonth || 0, 
        subs 
      });
    }

    /* ---- Events API (Separate) ---- */
    if (req.method === "GET" && pathname === "/api/events") {
      const auth = await checkRoleAuth(req, env, 'canViewAnalytics');
      if (!auth.authorized || !auth.user) return jsonResponse({ error: "Unauthorized" }, 401);
      
      const pid = searchParams.get("project");
      if (!pid) return jsonResponse({ error: "Specify ?project=<id>" }, 400);
      
      // Check project access (simplified for speed)
      const proj = await getProject(env, pid);
      if (!proj) return jsonResponse({ error: "Project not found" }, 404);
      
      // Pagination parameters
      const page = parseInt(searchParams.get("page") || "0");
      const limit = parseInt(searchParams.get("limit") || "25"); // Smaller limit for speed
      const offset = page * limit;
      
      // Get total count from KV (fast)
      const totalEvents = await getNumber(env.LINKS_CONFIG, `${AN_PROJ}${pid}:total`) || 0;
      
      // Only load events if we need them and the count is reasonable
      let events: EventRow[] = [];
      if (totalEvents > 0 && totalEvents <= 10000) { // Only load if under 10k events
        const allEvents = (await getJSON<EventRow[]>(env.LINKS_CONFIG, `${AN_PROJ}${pid}:events`)) || [];
        
        // Clean up: If we have more than 50 events, truncate and save back
        const maxStoredEvents = 50;
        if (allEvents.length > maxStoredEvents) {
          console.log(`🧹 Cleaning up ${allEvents.length} events to ${maxStoredEvents} for project ${pid} (events API)`);
          const cleanedEvents = allEvents.slice(0, maxStoredEvents);
          await putJSON(env.LINKS_CONFIG, `${AN_PROJ}${pid}:events`, cleanedEvents);
          console.log(`✅ Cleaned up events for project ${pid}: ${allEvents.length} → ${cleanedEvents.length}`);
        }
        
        const recentEvents = allEvents.length > maxStoredEvents ? allEvents.slice(0, maxStoredEvents) : allEvents;
        events = recentEvents.slice(offset, offset + limit) as EventRow[];
      }
      
      return jsonResponse({ 
        events,
        pagination: {
          page,
          limit,
          total: totalEvents,
          totalPages: Math.ceil(totalEvents / limit)
        }
      });
    }

    /* ---- Enhanced Analytics API ---- */
    if (req.method === "GET" && pathname === "/api/analytics/enhanced") {
      const auth = await checkRoleAuth(req, env, 'canViewAnalytics');
      if (!auth.authorized || !auth.user) return jsonResponse({ error: "Unauthorized" }, 401);
      
      const pid = searchParams.get("project");
      if (!pid) return jsonResponse({ error: "Specify ?project=<id>" }, 400);
      
      const proj = await getProject(env, pid);
      if (!proj) return jsonResponse({ error: "Project not found" }, 404);
      
      // Check if user has access to the group that contains this project
      if (proj.groupId) {
        const group = await getGroup(env, proj.groupId);
        if (!group) {
          return jsonResponse({ error: "Project group not found" }, 404);
        }
        
        // Check group ownership/access - admins can see all, editors can only see their own groups
        if (auth.user.role !== 'admin' && group.userId !== auth.user.id) {
          return jsonResponse({ error: "Access denied to project" }, 403);
        }
      }
      
      // Ensure project has a group (ungrouped projects shouldn't appear in analytics)
      if (!proj.groupId || proj.groupId.trim() === '') {
        console.log('🔍 DEBUG: Enhanced analytics request rejected - project has no group:', { id: proj.id, name: proj.name, groupId: proj.groupId });
        return jsonResponse({ error: "Project must be in group to view analytics" }, 400);
      }
      
      // Get targeting performance
      const targetingHits = await getNumber(env.LINKS_CONFIG, `${AN_PROJ}${pid}:targeting:hit`);
      const targetingMisses = await getNumber(env.LINKS_CONFIG, `${AN_PROJ}${pid}:targeting:miss`);
      
      // Get A/B testing results if enabled
      let abResults: { total: number; variants: Record<string, number>; } | null = null;
      if (proj.abTesting?.enabled) {
        const abTotal = await getNumber(env.LINKS_CONFIG, `${AN_PROJ}${pid}:ab:total`);
        const variantCounts: Record<string, number> = {};
        
        for (const item of proj.items) {
          const label = item.label?.trim() || slugForUrl(item.url);
          variantCounts[label] = await getNumber(env.LINKS_CONFIG, `${AN_PROJ}${pid}:ab:variant:${label}`);
        }
        
        abResults = { total: abTotal, variants: variantCounts };
      }
      
      return jsonResponse({
        project: { id: proj.id, name: proj.name },
        targeting: { hits: targetingHits, misses: targetingMisses, accuracy: targetingHits + targetingMisses > 0 ? (targetingHits / (targetingHits + targetingMisses) * 100).toFixed(2) + '%' : '0%' },
        abTesting: abResults
      });
    }

    /* ---- Live Tracking API ---- */
    if (req.method === "GET" && pathname === "/api/tracking/live") {
      const auth = await checkRoleAuth(req, env, 'canViewAnalytics');
      if (!auth.authorized || !auth.user) return jsonResponse({ error: "Unauthorized" }, 401);
      
      const pid = searchParams.get("project");
      if (!pid) return jsonResponse({ error: "Specify ?project=<id>" }, 400);
      
      // Check if user has access to this project
      const proj = await getProject(env, pid);
      if (!proj) return jsonResponse({ error: "Project not found" }, 404);
      
      // Check if user has access to the group that contains this project
      if (proj.groupId) {
        const group = await getGroup(env, proj.groupId);
        if (!group) {
          return jsonResponse({ error: "Project group not found" }, 404);
        }
        
        // Check group ownership/access - admins can see all, editors can only see their own groups
        if (auth.user.role !== 'admin' && group.userId !== auth.user.id) {
          return jsonResponse({ error: "Access denied to project" }, 403);
        }
      }
      
      try {
        // Count active users by listing keys with active:projectId prefix
        const activeUsersList = await env.LINKS_CONFIG.list({ prefix: `active:${pid}:` });
        const activeCount = activeUsersList.keys.length;
        
        return jsonResponse({ activeUsers: activeCount });
      } catch (error) {
        console.log('Error getting active users:', error);
        return jsonResponse({ activeUsers: 0 });
      }
    }

    /* ---- IP Reputation API ---- */
    if (req.method === "GET" && pathname === "/api/ip-reputation") {
      const auth = await checkRoleAuth(req, env, 'canViewAnalytics');
      if (!auth.authorized || !auth.user) return jsonResponse({ error: "Unauthorized" }, 401);
      
      const pid = searchParams.get("project");
      if (!pid) return jsonResponse({ error: "Specify ?project=<id>" }, 400);
      
      // Check if user has access to this project
      const proj = await getProject(env, pid);
      if (!proj) return jsonResponse({ error: "Project not found" }, 404);
      
      // Check if user has access to the group that contains this project
      if (proj.groupId) {
        const group = await getGroup(env, proj.groupId);
        if (!group) {
          return jsonResponse({ error: "Project group not found" }, 404);
        }
        
        // Check group ownership/access - admins can see all, editors can only see their own groups
        if (auth.user.role !== 'admin' && group.userId !== auth.user.id) {
          return jsonResponse({ error: "Access denied to project" }, 403);
        }
      }
      
      try {
        // Simplified IP reputation - just return basic stats to avoid hanging
        console.log('🔍 DEBUG: IP reputation endpoint called for project:', pid);
        const reputationStats = {
          totalIPs: 0,
          blacklistedIPs: 0,
          suspiciousIPs: 0,
          cleanIPs: 0,
          totalBlocked: 0
        };
        
        // For now, just return empty stats to avoid the hanging issue
        // TODO: Implement proper IP reputation tracking later
        console.log('🔍 DEBUG: IP reputation endpoint returning basic stats');
        return jsonResponse(reputationStats);
      } catch (error) {
        console.log('Error getting IP reputation:', error);
        return jsonResponse({ 
          totalIPs: 0, 
          blacklistedIPs: 0, 
          suspiciousIPs: 0, 
          cleanIPs: 0, 
          totalBlocked: 0 
        });
      }
    }

    /* ---- A/B Testing Results API ---- */
    if (req.method === "GET" && pathname === "/api/ab-testing/results") {
      const pid = searchParams.get("project");
      if (!pid) return jsonResponse({ error: "Specify ?project=<id>" }, 400);
      
      const proj = await getProject(env, pid);
      if (!proj) return jsonResponse({ error: "Project not found" }, 404);
      
      // Ensure project has a group (ungrouped projects shouldn't appear in analytics)
      if (!proj.groupId || proj.groupId.trim() === '') {
        console.log('🔍 DEBUG: A/B testing results request rejected - project has no group:', { id: proj.id, name: proj.name, groupId: proj.groupId });
        return jsonResponse({ error: "Project must be in a group to view analytics" }, 400);
      }
      
      const results = await getABTestingResults(env, proj);
      return jsonResponse({ 
        project: { id: proj.id, name: proj.name },
        abTesting: proj.abTesting,
        results 
      });
    }

    /* ---- Link Validation API ---- */
    if (req.method === "POST" && pathname === "/api/links/validate") {
      const body = await req.json().catch(() => ({})) as any;
      const { urls } = body;
      
      if (!urls || !Array.isArray(urls)) {
        return jsonResponse({ error: "Missing or invalid urls array" }, 400);
      }
      
      const validationResults = await Promise.all(urls.map(async (url: string) => {
        try {
          const response = await fetch(url, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });
          
          return {
            url,
            isValid: response.ok,
            status: response.status,
            statusText: response.statusText,
            redirects: response.redirected,
            finalUrl: response.url
          };
        } catch (error) {
          return {
            url,
            isValid: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 0
          };
        }
      }));
      
      return jsonResponse({ results: validationResults });
    }
    /* ---- Authentication API ---- */
    if (req.method === "POST" && pathname === "/api/auth/login") {
      const body = await req.json().catch(() => ({})) as any;
      const { email, password } = body;

      if (!email || !password) {
        return jsonResponse({ error: "Email and password are required" }, 400);
      }

      // Find user by email
      let users = await getUsers(env);
      
      // If no users exist, create default admin user
      if (users.length === 0) {
        console.log('DEBUG: No users found, creating default admin user');
        const defaultAdmin: User = {
          id: genId(),
          email: 'admin@example.com',
          name: 'Administrator',
          passwordHash: hashPassword('admin123'),
          role: 'admin',
          permissions: getDefaultPermissions('admin'),
          createdAt: Date.now(),
          isActive: true,
          lastLoginAt: Date.now()
        };
        await putUser(env, defaultAdmin);
        users = await getUsers(env);
        console.log('DEBUG: Default admin user created');
      }
      
      const user = users.find(u => u.email === email && u.isActive);

      console.log('DEBUG: User lookup:', {
        email,
        foundUser: user ? {
          id: user.id,
          email: user.email,
          name: user.name,
          hasPasswordHash: !!user.passwordHash,
          passwordHashLength: user.passwordHash ? user.passwordHash.length : 0,
          passwordHash: user.passwordHash
        } : null,
        allUsers: users.map(u => ({ email: u.email, hasPassword: !!u.passwordHash }))
      });

      if (!user) {
        return jsonResponse({ error: "User not found or inactive" }, 404);
      }

      // Debug password verification
      console.log('DEBUG: Password verification:', {
        providedPassword: password,
        storedHash: user.passwordHash,
        hashType: typeof user.passwordHash,
        hashLength: user.passwordHash ? user.passwordHash.length : 'undefined',
        verificationResult: verifyPassword(password, user.passwordHash)
      });
      
      // Verify password
      if (!verifyPassword(password, user.passwordHash)) {
        console.log('DEBUG: Password verification FAILED');
        return jsonResponse({ error: "Invalid password" }, 401);
      }
      
      console.log('DEBUG: Password verification SUCCESS');

      // Create session token
      const sessionToken = genId(); // Generate a session token
      const session: UserSession = {
        userId: user.id,
        role: user.role,
        permissions: user.permissions,
        expiresAt: Date.now() + (12 * 60 * 60 * 1000) // 12 hours
      };
      
      console.log('DEBUG: Creating session:', {
        sessionToken,
        session,
        user: { id: user.id, email: user.email, role: user.role }
      });
      
      // Store session
      const sessionKey = USER_SESSIONS_PREFIX + sessionToken;
      console.log('DEBUG: About to store session with key:', sessionKey);
      console.log('DEBUG: Session object to store:', session);
      
      try {
        await putJSON(env.LINKS_CONFIG, sessionKey, session);
        console.log('DEBUG: Session stored successfully with key:', sessionKey);
        
        // Verify session was stored by reading it back
        const storedSession = await getJSON<UserSession>(env.LINKS_CONFIG, sessionKey);
        console.log('DEBUG: Verification - stored session retrieved:', storedSession);
        
        if (!storedSession) {
          console.log('ERROR: Session was not stored properly!');
        }
      } catch (error) {
        console.log('ERROR: Failed to store session:', error);
      }
      
      // Set session cookie
      const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
      const cookieValue = `ls_session_token=${sessionToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`;
      headers.append("Set-Cookie", cookieValue);
      
      console.log('DEBUG: Session cookie set:', {
        sessionToken,
        cookieValue,
        headers: Array.from(headers.entries()),
        allHeaders: Array.from(headers.entries())
      });
      
      // Also set a non-HttpOnly cookie for debugging
      headers.append("Set-Cookie", `debug_session=${sessionToken}; Path=/; Max-Age=43200`);
      
      // Log the login activity
      await logActivity(env, user.id, user.email, user.role, 'login', 'auth', user.id, user.email, { 
        sessionToken,
        loginTime: new Date().toISOString()
      }, req);

      return new Response(JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }), {
        status: 200,
        headers
      });
    }

    if (req.method === "POST" && pathname === "/api/auth/logout") {
      const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
      headers.append("Set-Cookie", `ls_session_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
      
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers
      });
    }

    if (req.method === "GET" && pathname === "/api/auth/me") {
      const auth = await checkRoleAuth(req, env);
      if (!auth.authorized || !auth.user) {
        return jsonResponse({ error: "Not authenticated" }, 401);
      }

      return jsonResponse({
        id: auth.user.id,
        email: auth.user.email,
        name: auth.user.name,
        role: auth.user.role,
        permissions: auth.user.permissions
      });
    }

    /* ---- User Management API ---- */
    if (req.method === "GET" && pathname === "/api/users") {
      const auth = await checkRoleAuth(req, env, 'canManageUsers');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Admin access required" }, 403);
      }
      
      const users = await getUsers(env);
      return jsonResponse(users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      })));
    }

    /* ---- Current User API ---- */
    if (req.method === "GET" && pathname === "/api/me") {
      const auth = await checkRoleAuth(req, env);
      if (!auth.authorized || !auth.user) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      
      return jsonResponse({
        id: auth.user.id,
        email: auth.user.email,
        role: auth.user.role,
        isActive: auth.user.isActive,
        createdAt: auth.user.createdAt,
        lastLoginAt: auth.user.lastLoginAt
      });
    }

    if (req.method === "GET" && pathname.startsWith("/api/users/")) {
      const userId = pathname.split("/").pop()!;
      const auth = await checkRoleAuth(req, env, 'canManageUsers');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Admin access required" }, 403);
      }
      
      const user = await getUser(env, userId);
      if (!user) {
        return jsonResponse({ error: "User not found" }, 404);
      }

      return jsonResponse({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      });
    }

    if (req.method === "POST" && pathname === "/api/users") {
      const auth = await checkRoleAuth(req, env, 'canManageUsers');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Admin access required" }, 403);
      }

      const body = await req.json().catch(() => ({})) as any;
      const { email, name, role, password } = body;

      if (!email || !name || !role || !password) {
        return jsonResponse({ error: "Missing required fields: email, name, role, password" }, 400);
      }

      if (password.length < 6) {
        return jsonResponse({ error: "Password must be at least 6 characters long" }, 400);
      }

      if (!['admin', 'editor', 'viewer'].includes(role)) {
        return jsonResponse({ error: "Invalid role. Must be: admin, editor, or viewer" }, 400);
      }

      // Check if user already exists
      const existingUsers = await getUsers(env);
      if (existingUsers.find(u => u.email === email)) {
        return jsonResponse({ error: "User with this email already exists" }, 400);
      }

      const passwordHash = hashPassword(password);
      console.log('DEBUG: User creation password hashing:', {
        originalPassword: password,
        hashedPassword: passwordHash
      });
      
      const user: User = {
        id: genId(),
        email,
        name,
        passwordHash: passwordHash,
        role: role as UserRole,
        permissions: getDefaultPermissions(role as UserRole),
        createdAt: Date.now(),
        isActive: true,
      };

      await putUser(env, user);
      
      // Log the activity
      if (auth.user) {
        await logActivity(env, auth.user.id, auth.user.email, auth.user.role, 'create', 'user', user.id, user.email, { 
          newUserRole: user.role,
          newUserName: user.name 
        }, req);
      }
      
      // Trigger webhooks for user creation
      const webhooks = await getWebhooks(env);
      const userCreationWebhooks = webhooks.filter(w => w.events.includes('user.created'));
      for (const webhook of userCreationWebhooks) {
        await triggerWebhook(env, webhook, 'user.created', {
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdBy: auth.user?.id
        });
      }
      
      return jsonResponse({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      }, 201);
    }

    if (req.method === "PUT" && pathname.startsWith("/api/users/")) {
      const userId = pathname.split("/").pop()!;
      const auth = await checkRoleAuth(req, env, 'canManageUsers');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Admin access required" }, 403);
      }

      const user = await getUser(env, userId);
      if (!user) {
        return jsonResponse({ error: "User not found" }, 404);
      }

      const body = await req.json().catch(() => ({})) as any;
      const { name, role, isActive } = body;

      if (name) user.name = name;
      if (role && ['admin', 'editor', 'viewer'].includes(role)) {
        user.role = role as UserRole;
        user.permissions = getDefaultPermissions(role as UserRole);
      }
      if (typeof isActive === 'boolean') user.isActive = isActive;

      await putUser(env, user);
      return jsonResponse({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      });
    }

    if (req.method === "DELETE" && pathname.startsWith("/api/users/")) {
      const userId = pathname.split("/").pop()!;
      const auth = await checkRoleAuth(req, env, 'canManageUsers');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Admin access required" }, 403);
      }

      const user = await getUser(env, userId);
      if (!user) {
        return jsonResponse({ error: "User not found" }, 404);
      }

      // Prevent deleting the last admin
      const users = await getUsers(env);
      const adminUsers = users.filter(u => u.role === 'admin' && u.isActive);
      if (user.role === 'admin' && adminUsers.length <= 1) {
        return jsonResponse({ error: "Cannot delete the last active admin user" }, 400);
      }

      await removeUser(env, userId);
      return jsonResponse({ success: true });
    }

    /* ---- User Authentication API ---- */
    if (req.method === "POST" && pathname === "/api/auth/login") {
      const body = await req.json().catch(() => ({})) as any;
      const { email, password } = body;

      if (!email || !password) {
        return jsonResponse({ error: "Missing email or password" }, 400);
      }

      // For simplicity, we'll check against a default admin account
      // In production, you'd want proper password hashing
      if (email === "admin@example.com" && password === "admin123") {
        // Create or get admin user
        let adminUser = (await getUsers(env)).find(u => u.email === email);
        if (!adminUser) {
          adminUser = {
            id: genId(),
            email,
            name: "Administrator",
            role: 'admin',
            permissions: getDefaultPermissions('admin'),
            createdAt: Date.now(),
            isActive: true,
            passwordHash: "", // Add missing required property
          };
          await putUser(env, adminUser);
        }

        if (!adminUser) {
          return jsonResponse({ error: "Failed to create admin user" }, 500);
        }

        const sessionId = await createUserSession(env, adminUser);
        const cookieHeader = `ls_session_token=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`; // 7 days

        return new Response(JSON.stringify({
          success: true,
          user: {
            id: adminUser.id,
            email: adminUser.email,
            name: adminUser.name,
            role: adminUser.role,
            permissions: adminUser.permissions
          }
        }), { 
          status: 200, 
          headers: { 
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'Set-Cookie': cookieHeader 
          } 
        });
      }

      return jsonResponse({ error: "Invalid credentials" }, 401);
    }

    if (req.method === "POST" && pathname === "/api/auth/logout") {
      const cookies = req.headers.get('cookie') || '';
      const sessionMatch = cookies.match(/ls_session_token=([^;]+)/);
      
      if (sessionMatch) {
        const sessionId = sessionMatch[1];
        await env.LINKS_CONFIG.delete(`session:${sessionId}`);
      }

      const cookieHeader = `ls_session_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
      return new Response(JSON.stringify({ success: true }), { 
        status: 200, 
        headers: { 
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'Set-Cookie': cookieHeader 
        } 
      });
    }

    if (req.method === "GET" && pathname === "/api/auth/me") {
      const auth = await checkRoleAuth(req, env);
      if (!auth.authorized) {
        return jsonResponse({ error: "Not authenticated" }, 401);
      }

      return jsonResponse({
        user: auth.user ? {
          id: auth.user.id,
          email: auth.user.email,
          name: auth.user.name,
          role: auth.user.role,
          permissions: auth.user.permissions
        } : null,
        session: auth.session ? {
          role: auth.session.role,
          permissions: auth.session.permissions,
          expiresAt: auth.session.expiresAt
        } : null
      });
    }

    /* ---- Team Management API ---- */
    if (req.method === "GET" && pathname === "/api/teams") {
      const auth = await checkRoleAuth(req, env);
      if (!auth.authorized) {
        return jsonResponse({ error: "Not authenticated" }, 401);
      }
      
      if (!auth.user) {
        return jsonResponse({ error: "User not found" }, 404);
      }
      
      const teams = await getUserTeams(env, auth.user.id);
      return jsonResponse(teams.map(team => ({
        id: team.id,
        name: team.name,
        description: team.description,
        ownerId: team.ownerId,
        memberCount: team.members.length,
        isOwner: team.ownerId === auth.user!.id,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
        isActive: team.isActive
      })));
    }

    if (req.method === "POST" && pathname === "/api/teams") {
      const auth = await checkRoleAuth(req, env, 'canCreateGroups');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Create groups permission required" }, 403);
      }

      if (!auth.user) {
        return jsonResponse({ error: "User not found" }, 404);
      }

      const body = await req.json().catch(() => ({})) as any;
      const { name, description } = body;

      if (!name) {
        return jsonResponse({ error: "Team name is required" }, 400);
      }

      const team: Team = {
        id: genId(),
        name: name.trim(),
        description: description?.trim(),
        ownerId: auth.user.id,
        members: [{
          userId: auth.user.id,
          role: 'admin',
          joinedAt: Date.now(),
          permissions: getDefaultPermissions('admin'),
          isActive: true
        }],
        settings: {
          allowPublicProjects: false,
          maxProjectsPerTeam: 100,
          maxTeamMembers: 50,
          defaultUserRole: 'viewer',
          requireApproval: false
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true
      };

      await putTeam(env, team);
      
      // Add team to user's team list
      const userTeamIds = (await getJSON<string[]>(env.LINKS_CONFIG, USER_TEAMS_PREFIX + auth.user.id)) || [];
      userTeamIds.push(team.id);
      await putJSON(env.LINKS_CONFIG, USER_TEAMS_PREFIX + auth.user.id, userTeamIds);

      return jsonResponse({
        id: team.id,
        name: team.name,
        description: team.description,
        ownerId: team.ownerId,
        memberCount: team.members.length,
        isOwner: true,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
        isActive: team.isActive
      }, 201);
    }

    if (req.method === "GET" && pathname.startsWith("/api/teams/")) {
      const teamId = pathname.split("/").pop()!;
      const auth = await checkRoleAuth(req, env);
      if (!auth.authorized) {
        return jsonResponse({ error: "Not authenticated" }, 401);
      }

      const team = await getTeam(env, teamId);
      if (!team) {
        return jsonResponse({ error: "Team not found" }, 404);
      }

      // Check if user has access to this team
      const teamAccess = await checkTeamAccess(env, teamId, auth.user?.id || '');
      if (!teamAccess.hasAccess) {
        return jsonResponse({ error: "Access denied to team" }, 403);
      }

      return jsonResponse({
        id: team.id,
        name: team.name,
        description: team.description,
        ownerId: team.ownerId,
        members: team.members.map(m => ({
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
          isActive: m.isActive
        })),
        settings: team.settings,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
        isActive: team.isActive
      });
    }

    if (req.method === "PUT" && pathname.startsWith("/api/teams/")) {
      const teamId = pathname.split("/").pop()!;
      const auth = await checkRoleAuth(req, env);
      if (!auth.authorized) {
        return jsonResponse({ error: "Not authenticated" }, 401);
      }

      const team = await getTeam(env, teamId);
      if (!team) {
        return jsonResponse({ error: "Team not found" }, 404);
      }

      // Only team owner can edit team
      if (team.ownerId !== auth.user?.id) {
        return jsonResponse({ error: "Only team owner can edit team" }, 403);
      }

      const body = await req.json().catch(() => ({})) as any;
      const { name, description, settings } = body;

      if (name) team.name = name.trim();
      if (description !== undefined) team.description = description?.trim();
      if (settings) {
        team.settings = { ...team.settings, ...settings };
      }
      
      team.updatedAt = Date.now();
      await putTeam(env, team);

      return jsonResponse({
        id: team.id,
        name: team.name,
        description: team.description,
        ownerId: team.ownerId,
        members: team.members,
        settings: team.settings,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
        isActive: team.isActive
      });
    }

    if (req.method === "POST" && pathname.startsWith("/api/teams/") && pathname.endsWith("/members")) {
      const teamId = pathname.split("/")[2];
      const auth = await checkRoleAuth(req, env, 'canManageUsers');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Manage users permission required" }, 403);
      }

      const team = await getTeam(env, teamId);
      if (!team) {
        return jsonResponse({ error: "Team not found" }, 404);
      }

      // Only team owner can add members
      if (team.ownerId !== auth.user?.id) {
        return jsonResponse({ error: "Only team owner can add members" }, 403);
      }

      const body = await req.json().catch(() => ({})) as any;
      const { userId, role } = body;

      if (!userId || !role) {
        return jsonResponse({ error: "User ID and role are required" }, 400);
      }

      if (!['admin', 'editor', 'viewer'].includes(role)) {
        return jsonResponse({ error: "Invalid role" }, 400);
      }

      try {
        await addUserToTeam(env, teamId, userId, role as UserRole);
        return jsonResponse({ success: true, message: "User added to team" });
      } catch (error) {
        return jsonResponse({ error: error instanceof Error ? error.message : "Failed to add user" }, 400);
      }
    }

    if (req.method === "DELETE" && pathname.startsWith("/api/teams/") && pathname.includes("/members/")) {
      const parts = pathname.split("/");
      const teamId = parts[2];
      const userId = parts[4];
      
      const auth = await checkRoleAuth(req, env, 'canManageUsers');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Manage users permission required" }, 403);
      }

      const team = await getTeam(env, teamId);
      if (!team) {
        return jsonResponse({ error: "Team not found" }, 404);
      }

      // Only team owner can remove members
      if (team.ownerId !== auth.user?.id) {
        return jsonResponse({ error: "Only team owner can remove members" }, 403);
      }

      try {
        await removeUserFromTeam(env, teamId, userId);
        return jsonResponse({ success: true, message: "User removed from team" });
      } catch (error) {
        return jsonResponse({ error: error instanceof Error ? error.message : "Failed to remove user" }, 400);
      }
    }

    if (req.method === "GET" && pathname.startsWith("/api/teams/") && pathname.endsWith("/projects")) {
      const teamId = pathname.split("/")[2];
      const auth = await checkRoleAuth(req, env);
      if (!auth.authorized) {
        return jsonResponse({ error: "Not authenticated" }, 401);
      }

      // Check if user has access to this team
      const teamAccess = await checkTeamAccess(env, teamId, auth.user?.id || '');
      if (!teamAccess.hasAccess) {
        return jsonResponse({ error: "Access denied to team" }, 403);
      }

      const projects = await getTeamProjects(env, teamId);
      return jsonResponse(projects);
    }

    if (req.method === "DELETE" && pathname.startsWith("/api/teams/") && !pathname.includes("/members/")) {
      const teamId = pathname.split("/").pop()!;
      const auth = await checkRoleAuth(req, env, 'canManageUsers');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Manage users permission required" }, 403);
      }

      const team = await getTeam(env, teamId);
      if (!team) {
        return jsonResponse({ error: "Team not found" }, 404);
      }

      // Only team owner can delete team
      if (team.ownerId !== auth.user?.id) {
        return jsonResponse({ error: "Only team owner can delete team" }, 403);
      }

      try {
        await removeTeam(env, teamId);
        
        // Log the activity
        if (auth.user) {
          await logActivity(env, auth.user.id, auth.user.email, auth.user.role, 'delete', 'team', teamId, team.name, { teamId }, req);
        }
        
        return jsonResponse({ success: true, message: "Team deleted successfully" });
      } catch (error) {
        return jsonResponse({ error: error instanceof Error ? error.message : "Failed to delete team" }, 400);
      }
    }
    /* ---- Bulk Links API ---- */
    if (req.method === "POST" && pathname === "/api/bulk-links") {
      const body = await req.json().catch(() => ({})) as any;
      const { projectId, name, urls, targeting, weights } = body;
      
      if (!projectId || !name || !urls || !Array.isArray(urls)) {
        return jsonResponse({ error: "Missing required fields: projectId, name, urls" }, 400);
      }
      
      const proj = await getProject(env, projectId);
      if (!proj) return jsonResponse({ error: "Project not found" }, 404);
      
      if (!proj.bulkLinks) proj.bulkLinks = [];
      
      const bulkLink = {
        id: genId(),
        name,
        urls,
        targeting: targeting || [],
        weights: weights || urls.map(() => Math.floor(100 / urls.length))
      };
      
      proj.bulkLinks.push(bulkLink);
      proj.updatedAt = Date.now();
      
      await putProject(env, proj);
      await upsertProjectIndex(env, proj);
      
      return jsonResponse(bulkLink, 201);
    }

    if (req.method === "GET" && pathname.startsWith("/api/bulk-links/")) {
      const pid = pathname.split("/").pop()!;
      const proj = await getProject(env, pid);
      if (!proj) return jsonResponse({ error: "Project not found" }, 404);
      
      return jsonResponse(proj.bulkLinks || []);
    }

    /* ---- Activity Logs API ---- */
    if (req.method === "GET" && pathname === "/api/activity-logs") {
      const auth = await checkRoleAuth(req, env, 'canViewAnalytics');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - View analytics permission required" }, 403);
      }
      
      const queryParams = new URLSearchParams(url.search);
      const filter: ActivityLogFilter = {
        startDate: queryParams.get('startDate') || undefined,
        endDate: queryParams.get('endDate') || undefined,
        userId: queryParams.get('userId') || undefined,
        action: queryParams.get('action') || undefined,
        resourceType: queryParams.get('resourceType') as ActivityLogEntry['resourceType'] || undefined,
        limit: parseInt(queryParams.get('limit') || '50'),
        offset: parseInt(queryParams.get('offset') || '0')
      };
      
      // Non-admin users can only see their own activity
      if (auth.user && auth.user.role !== 'admin') {
        filter.userId = auth.user.id;
      }
      
      const logs = await getActivityLogs(env, filter);
      return jsonResponse(logs);
    }
    
    if (req.method === "GET" && pathname === "/api/activity-logs/my") {
      const auth = await checkRoleAuth(req, env);
      if (!auth.authorized || !auth.user) {
        return jsonResponse({ error: "Not authenticated" }, 401);
      }
      
      const limit = parseInt(new URLSearchParams(url.search).get('limit') || '50');
      const logs = await getUserActivityLogs(env, auth.user.id, limit);
      return jsonResponse(logs);
    }
    
    if (req.method === "DELETE" && pathname === "/api/activity-logs/my") {
      const auth = await checkRoleAuth(req, env);
      if (!auth.authorized || !auth.user) {
        return jsonResponse({ error: "Not authenticated" }, 401);
      }
      
      const result = await clearUserActivityLogs(env, auth.user.id);
      
      if (result.success) {
        return jsonResponse({ 
          success: true, 
          message: `Cleared ${result.cleared} activity entries`,
          cleared: result.cleared 
        });
      } else {
        return jsonResponse({ 
          error: "Failed to clear activity logs" 
        }, 500);
      }
    }

    /* ---- API Keys API ---- */
    if (req.method === "POST" && pathname === "/api/keys") {
      const auth = await checkRoleAuth(req, env, 'canAccessSettings');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Access settings permission required" }, 403);
      }
      
      const body = await req.json().catch(() => ({})) as any;
      const { name, permissions, expiresAt, allowedIPs, rateLimit, scopes } = body;
      
      if (!name || !permissions) {
        return jsonResponse({ error: "Missing required fields: name, permissions" }, 400);
      }
      
      // Generate a secure API key
      const rawKey = 'bam_' + genId() + '_' + genId();
      
      const apiKey = await createApiKey(env, {
        name,
        rawKey,
        userId: auth.user!.id,
        permissions,
        isActive: true,
        expiresAt,
        allowedIPs,
        rateLimit: rateLimit || {
          requestsPerMinute: 60,
          requestsPerHour: 1000
        },
        scopes
      });
      
      // Log the activity
      if (auth.user) {
        await logActivity(env, auth.user.id, auth.user.email, auth.user.role, 'create', 'api_key', apiKey.id, apiKey.name, { 
          permissions: apiKey.permissions,
          expiresAt: apiKey.expiresAt 
        }, req);
      }
      
      // Return the raw key only once (it won't be stored)
      return jsonResponse({
        ...apiKey,
        rawKey, // Only returned on creation
        key: undefined // Don't return the hashed key
      }, 201);
    }
    
    if (req.method === "GET" && pathname === "/api/keys") {
      const auth = await checkRoleAuth(req, env, 'canAccessSettings');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Access settings permission required" }, 403);
      }
      
      const apiKeys = await getApiKeys(env, auth.user!.id);
      // Don't return the hashed keys for security
      const sanitizedKeys = apiKeys.map(key => ({
        ...key,
        key: undefined
      }));
      
      return jsonResponse(sanitizedKeys);
    }
    
    if (req.method === "PUT" && pathname.startsWith("/api/keys/")) {
      const keyId = pathname.split("/").pop()!;
      const auth = await checkRoleAuth(req, env, 'canAccessSettings');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Access settings permission required" }, 403);
      }
      
      const apiKey = await getApiKey(env, keyId);
      if (!apiKey || apiKey.userId !== auth.user!.id) {
        return jsonResponse({ error: "API key not found" }, 404);
      }
      
      const body = await req.json().catch(() => ({})) as any;
      Object.assign(apiKey, body);
      
      await putApiKey(env, apiKey);
      
      // Log the activity
      if (auth.user) {
        await logActivity(env, auth.user.id, auth.user.email, auth.user.role, 'update', 'api_key', apiKey.id, apiKey.name, { 
          updatedFields: Object.keys(body) 
        }, req);
      }
      
      return jsonResponse({
        ...apiKey,
        key: undefined // Don't return the hashed key
      });
    }
    
    if (req.method === "DELETE" && pathname.startsWith("/api/keys/")) {
      const keyId = pathname.split("/").pop()!;
      const auth = await checkRoleAuth(req, env, 'canAccessSettings');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Access settings permission required" }, 403);
      }
      
      const apiKey = await getApiKey(env, keyId);
      if (!apiKey || apiKey.userId !== auth.user!.id) {
        return jsonResponse({ error: "API key not found" }, 404);
      }
      
      await removeApiKey(env, keyId);
      
      // Log the activity
      if (auth.user) {
        await logActivity(env, auth.user.id, auth.user.email, auth.user.role, 'delete', 'api_key', apiKey.id, apiKey.name, { 
          keyId 
        }, req);
      }
      
      return jsonResponse({ success: true });
    }
    
    if (req.method === "GET" && pathname.startsWith("/api/keys/") && pathname.endsWith("/usage")) {
      const keyId = pathname.split("/")[3]; // /api/keys/{id}/usage
      const auth = await checkRoleAuth(req, env, 'canAccessSettings');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Access settings permission required" }, 403);
      }
      
      const apiKey = await getApiKey(env, keyId);
      if (!apiKey || apiKey.userId !== auth.user!.id) {
        return jsonResponse({ error: "API key not found" }, 404);
      }
      
      const hours = parseInt(new URLSearchParams(new URL(req.url).search).get('hours') || '24');
      const usage = await getApiKeyUsageStats(env, keyId, hours);
      
      return jsonResponse({
        apiKeyId: keyId,
        usage,
        stats: {
          totalRequests: usage.length,
          averageResponseTime: usage.length > 0 ? usage.reduce((sum, u) => sum + u.responseTime, 0) / usage.length : 0,
          successRate: usage.length > 0 ? (usage.filter(u => u.responseStatus < 400).length / usage.length) * 100 : 0
        }
      });
    }

    /* ---- Webhooks API ---- */
    if (req.method === "POST" && pathname === "/api/webhooks") {
      const auth = await checkRoleAuth(req, env, 'canAccessSettings');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Access settings permission required" }, 403);
      }
      
      const body = await req.json().catch(() => ({})) as any;
      const { name, url, events, secret, headers, retryPolicy } = body;
      
      if (!name || !url || !events || !Array.isArray(events)) {
        return jsonResponse({ error: "Missing required fields: name, url, events" }, 400);
      }
      
      const webhook = await createWebhook(env, {
        name,
        url,
        events,
        secret: secret || genId(),
        isActive: true,
        headers: headers || {},
        retryPolicy: retryPolicy || {
          maxRetries: 3,
          backoffMultiplier: 2,
          initialDelay: 1000
        }
      });
      
      // Log the activity
      if (auth.user) {
        await logActivity(env, auth.user.id, auth.user.email, auth.user.role, 'create', 'webhook', webhook.id, webhook.name, { 
          webhookUrl: webhook.url,
          events: webhook.events 
        }, req);
      }
      
      return jsonResponse(webhook, 201);
    }
    
    if (req.method === "GET" && pathname === "/api/webhooks") {
      const auth = await checkRoleAuth(req, env, 'canAccessSettings');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Access settings permission required" }, 403);
      }
      
      const webhooks = await getWebhooks(env);
      return jsonResponse(webhooks);
    }
    
    if (req.method === "PUT" && pathname.startsWith("/api/webhooks/")) {
      const webhookId = pathname.split("/").pop()!;
      const auth = await checkRoleAuth(req, env, 'canAccessSettings');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Access settings permission required" }, 403);
      }
      
      const webhook = await getWebhook(env, webhookId);
      if (!webhook) {
        return jsonResponse({ error: "Webhook not found" }, 404);
      }
      
      const body = await req.json().catch(() => ({})) as any;
      Object.assign(webhook, body);
      
      await putJSON(env.LINKS_CONFIG, WEBHOOKS_PREFIX + webhook.id, webhook);
      
      // Log the activity
      if (auth.user) {
        await logActivity(env, auth.user.id, auth.user.email, auth.user.role, 'update', 'webhook', webhook.id, webhook.name, { 
          updatedFields: Object.keys(body) 
        }, req);
      }
      
      return jsonResponse(webhook);
    }
    
    if (req.method === "DELETE" && pathname.startsWith("/api/webhooks/")) {
      const webhookId = pathname.split("/").pop()!;
      const auth = await checkRoleAuth(req, env, 'canAccessSettings');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - Access settings permission required" }, 403);
      }
      
      const webhook = await getWebhook(env, webhookId);
      if (!webhook) {
        return jsonResponse({ error: "Webhook not found" }, 404);
      }
      
      await env.LINKS_CONFIG.delete(WEBHOOKS_PREFIX + webhook.id);
      
      // Log the activity
      if (auth.user) {
        await logActivity(env, auth.user.id, auth.user.email, auth.user.role, 'delete', 'webhook', webhook.id, webhook.name, { 
          webhookId 
        }, req);
      }
      
      return jsonResponse({ success: true });
    }

    /* ---- Advanced Analytics API ---- */
    if (req.method === "POST" && pathname === "/api/analytics/advanced") {
      const auth = await checkRoleAuth(req, env, 'canViewAnalytics');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - View analytics permission required" }, 403);
      }
      
      const body = await req.json().catch(() => ({})) as any;
      const query: AnalyticsQuery = {
        startDate: body.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: body.endDate || new Date().toISOString(),
        groupBy: body.groupBy || 'day',
        filters: body.filters || {},
        metrics: body.metrics || ['userEngagement', 'projectPerformance', 'systemHealth', 'businessMetrics'],
        dimensions: body.dimensions || ['time', 'user', 'project']
      };
      
      const analytics = await generateAdvancedAnalytics(env, query);
      return jsonResponse(analytics);
    }
    
    if (req.method === "GET" && pathname === "/api/analytics/advanced") {
      const auth = await checkRoleAuth(req, env, 'canViewAnalytics');
      if (!auth.authorized) {
        return jsonResponse({ error: "Unauthorized - View analytics permission required" }, 403);
      }
      
      const queryParams = new URLSearchParams(url.search);
      const query: AnalyticsQuery = {
        startDate: queryParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: queryParams.get('endDate') || new Date().toISOString(),
        groupBy: (queryParams.get('groupBy') as any) || 'day',
        filters: {
          userId: queryParams.get('userId') || undefined,
          projectId: queryParams.get('projectId') || undefined,
          groupId: queryParams.get('groupId') || undefined,
          action: queryParams.get('action') || undefined,
          resourceType: queryParams.get('resourceType') as any || undefined
        },
        metrics: queryParams.get('metrics')?.split(',') || ['userEngagement', 'projectPerformance', 'systemHealth', 'businessMetrics'],
        dimensions: queryParams.get('dimensions')?.split(',') || ['time', 'user', 'project']
      };
      
      const analytics = await generateAdvancedAnalytics(env, query);
      return jsonResponse(analytics);
    }

    /* ---- Real-Time Activity Feed API ---- */
    if (req.method === "GET" && pathname === "/api/activity-feed") {
      const auth = await checkRoleAuth(req, env);
      if (!auth.authorized) {
        return jsonResponse({ error: "Not authenticated" }, 401);
      }
      
      const limit = parseInt(new URLSearchParams(url.search).get('limit') || '5');
      const offset = parseInt(new URLSearchParams(url.search).get('offset') || '0');
      const currentUserRole = auth.user?.role;
      const currentUserId = auth.user?.id;
      
      console.log('DEBUG: Activity feed request - userId:', currentUserId, 'role:', currentUserRole);
      
      const feed = await getActivityFeed(env, limit, offset, currentUserRole, currentUserId);
      
      console.log('DEBUG: Activity feed result - total:', feed.total, 'items:', feed.items.length);
      console.log('DEBUG: Activity feed items:', feed.items.map(item => ({
        userId: item.userId,
        userEmail: item.userEmail,
        action: item.action,
        resourceName: item.resourceName
      })));
      
      return jsonResponse(feed);
    }
    
    if (req.method === "GET" && pathname === "/api/quick-stats") {
      const auth = await checkRoleAuth(req, env);
      if (!auth.authorized) {
        return jsonResponse({ error: "Not authenticated" }, 401);
      }
      
      const stats = await getQuickStats(env);
      return jsonResponse(stats);
    }

    /* ---- A/B Testing API ---- */
    if (req.method === "POST" && pathname.startsWith("/api/ab-testing/")) {
      const pid = pathname.split("/").pop()!;
      const proj = await getProject(env, pid);
      if (!proj) return jsonResponse({ error: "Project not found" }, 404);
      
      const body = await req.json().catch(() => ({})) as any;
      
      if (!proj.abTesting) proj.abTesting = {
        enabled: false,
        confidenceLevel: 95,
        minSampleSize: 1000,
        testDuration: 7,
        trafficSplit: '50/50',
        testType: 'split',
        goal: 'conversion',
        hypothesis: '',
        variants: [],
        results: undefined
      };
      
      // Update A/B testing settings
      Object.assign(proj.abTesting, body);
      proj.updatedAt = Date.now();
      
      await putProject(env, proj);
      await upsertProjectIndex(env, proj);
      
      return jsonResponse(proj.abTesting);
    }

    if (req.method === "GET" && pathname.startsWith("/api/ab-testing/")) {
      const pid = pathname.split("/").pop()!;
      const proj = await getProject(env, pid);
      if (!proj) return jsonResponse({ error: "Project not found" }, 404);
      
      return jsonResponse(proj.abTesting || null);
    }

    /* ---- Public redirect with enhanced targeting ---- */
    if (req.method === "GET" && pathname.startsWith("/go/")) {
      let pid = pathname.slice("/go/".length);
      
      console.log('🔗 Redirect request:', { pathname, extractedPid: pid });
      
      // Try to resolve custom alias first
      const resolvedPid = await resolveCustomAlias(env, pid);
      console.log('🔍 Custom alias resolution:', { originalPid: pid, resolvedPid });
      
      if (resolvedPid) {
        pid = resolvedPid;
        console.log('🎯 Resolved custom alias:', pathname.slice("/go/".length), '→', pid);
      } else {
        console.log('ℹ️ No custom alias found, using original PID:', pid);
      }
      
      const proj = await getProject(env, pid);
              if (!proj) return new Response("Link not found.", { status: 404 });

      // Check if link has expired
      if (proj.expiresAt && Date.now() > proj.expiresAt) {
        return new Response("This link has expired.", { status: 410 });
      }
      
      // Check click limits
      if (proj.clicksLimit && (proj.clickCount || 0) >= proj.clicksLimit) {
        return new Response("This link has reached its maximum clicks.", { status: 410 });
      }

      // Get Cloudflare data
      const cf: any = (req as any).cf || {};
      
      // Fraud detection
      const userAgent = req.headers.get('user-agent') || '';
      const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '';
      const sessionId = req.headers.get('x-session-id') || crypto.randomUUID();
      
      // Calculate fraud score
      const fraudScore = calculateFraudScore(req, cf, userAgent);
      const isBot = detectBot(userAgent);
      
      console.log('🔍 Fraud Detection:', { fraudScore, isBot, userAgent: userAgent.substring(0, 50) });
      
      // Check if we should block this click
      if (proj.fraudProtection?.enabled) {
        if (proj.fraudProtection.blockBots && isBot) {
          console.log('🛑 Blocked bot click');
          return new Response("Access denied.", { status: 403 });
        }
        
        if (fraudScore >= (proj.fraudProtection.suspiciousThreshold || 80)) {
          console.log('🛑 Blocked suspicious click, score:', fraudScore);
          return new Response("Access denied.", { status: 403 });
        }
        
        // Check rate limits
        const limitCheck = await checkClickLimits(env, proj, ip, sessionId);
        if (!limitCheck.allowed) {
          console.log('🛑 Blocked by rate limit:', limitCheck.reason);
          return new Response(`Rate limit exceeded: ${limitCheck.reason}`, { status: 429 });
        }
      }

      // Evaluate global project targeting first
      const globalTargeting = proj.targeting ? evaluateTargeting(proj.targeting, req, cf) : { matches: true, matchedRules: [] };
      
      // Get the best matching item using enhanced targeting logic
      const chosen = getBestMatch(proj.items, req, cf, proj.safeLink, { rules: proj.targeting });
      
      // Increment click count
      proj.clickCount = (proj.clickCount || 0) + 1;
      await putProject(env, proj);
      
      // Log the click with targeting results and fraud data
      const fraudData = { fraudScore, isBot, sessionId, ip };
      console.log('🔗 About to log click for project:', proj.id, 'chosen:', chosen.label || chosen.url);
      const startTime = Date.now();
      ctx.waitUntil(logClick(env, proj, chosen, req, globalTargeting, fraudData, startTime));
      
      // Determine final URL (consider custom domains)
      let finalUrl = chosen.url;
      
      console.log('🔗 URL Processing Debug:');
      console.log('- Original URL:', chosen.url);
      console.log('- Item custom domain:', chosen.customDomain);
      console.log('- Project custom domain:', proj.customDomain);
      
      // Ensure URLs have proper protocol
      if (finalUrl && !finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
        console.log('- Added protocol, URL now:', finalUrl);
      }
      
      // Apply custom domain if specified
      if (chosen.customDomain && chosen.customDomain.trim() !== '') {
        try {
          const urlObj = new URL(finalUrl);
          const oldHostname = urlObj.hostname;
          urlObj.hostname = chosen.customDomain.trim();
          finalUrl = urlObj.toString();
          console.log('- Applied item custom domain:', oldHostname, '→', urlObj.hostname);
        } catch (e) {
          console.log('- Error applying item custom domain:', e);
          // Fallback to original URL if custom domain is invalid
          finalUrl = chosen.url;
        }
      } else if (proj.customDomain && proj.customDomain.trim() !== '') {
        try {
          const urlObj = new URL(finalUrl);
          const oldHostname = urlObj.hostname;
          urlObj.hostname = proj.customDomain.trim();
          finalUrl = urlObj.toString();
          console.log('- Applied project custom domain:', oldHostname, '→', urlObj.hostname);
        } catch (e) {
          console.log('- Error applying project custom domain:', e);
          // Fallback to original URL if custom domain is invalid
          finalUrl = chosen.url;
        }
      }
      
      console.log('- Final URL:', finalUrl);
      
      // Create enhanced HTML with pixel tracking before redirect
      const pixelId = chosen.pixelId || proj.pixelSettings?.tiktokPixelId || 'YOUR_PIXEL_ID_HERE';
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Redirecting...</title>
          <meta name="robots" content="noindex, nofollow">
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px; background: var(--bg-app); }
            .redirect-info { background: var(--bg-panel); padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin: 20px auto; max-width: 500px; }
            .url-display { background: var(--bg-subtle); padding: 10px; border-radius: 6px; font-family: monospace; word-break: break-all; margin: 15px 0; }
            .progress-bar { 
  width: 100%; 
  height: 8px; 
  background: var(--bg-subtle); 
  border: 1px solid var(--border);
  border-radius: 999px; 
  overflow: hidden; 
  margin: 20px 0; 
}
.progress-fill { 
  height: 100%; 
  background: var(--success); 
  width: 0%; 
  transition: width 0.15s ease; 
  border-radius: 999px;
}
          </style>
            <!-- TikTok Pixel -->
            <script>
              !function (w, d, t) {
                w[t] = w[t] || [];
                w[t].push({
                'ttq.load': '${pixelId}',
                  'ttq.track': 'ClickButton',
                  'ttq.properties': {
                    'content_name': '${proj.name}',
                    'content_category': 'smart_link',
                  'destination_url': '${finalUrl}',
                  'variant': '${chosen.label || 'default'}',
                  'project_id': '${proj.id}',
                  'targeting_matched': ${globalTargeting.matches},
                  'matched_rules': '${globalTargeting.matchedRules.join(',')}'
                }
              });
              
              // Facebook Pixel (if configured)
              ${proj.pixelSettings?.facebookPixelId ? `
              if (typeof fbq !== 'undefined') {
                fbq('track', 'ClickButton', {
                  content_name: '${proj.name}',
                  content_category: 'smart_link',
                  destination_url: '${finalUrl}'
                });
              }
              ` : ''}
              
              // Google Analytics (if configured)
              ${proj.pixelSettings?.googlePixelId ? `
              if (typeof gtag !== 'undefined') {
                gtag('event', 'click_button', {
                  content_name: '${proj.name}',
                  content_category: 'smart_link',
                  destination_url: '${finalUrl}'
                });
              }
              ` : ''}
              
                // Redirect after pixel fires
                setTimeout(() => {
                window.location.href = '${finalUrl}';
              }, 150);
              }(window, document, 'ttq');
            </script>
          
          <div class="redirect-info">
            <h2>🔄 Redirecting...</h2>
            <p>You're being redirected to:</p>
            <div class="url-display">${finalUrl}</div>
            <div class="progress-bar">
              <div class="progress-fill" id="progress"></div>
            </div>
            <p style="font-size: 14px; color: var(--text-muted);">
              ${proj.customDomain ? `Custom domain applied: <strong>${proj.customDomain}</strong>` : ''}
              ${chosen.customDomain ? `Item custom domain applied: <strong>${chosen.customDomain}</strong>` : ''}
            </p>
          </div>
          
          <script>
            // Animate progress bar
            const progress = document.getElementById('progress');
            let width = 0;
            const interval = setInterval(() => {
              width += 1;
              progress.style.width = width + '%';
              if (width >= 100) clearInterval(interval);
            }, 1.5);
          </script>
          
          <!-- Facebook Pixel -->
          ${proj.pixelSettings?.facebookPixelId ? `
          <script>
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${proj.pixelSettings.facebookPixelId}');
            fbq('track', 'PageView');
          </script>
          ` : ''}
          
          <!-- Google Analytics -->
          ${proj.pixelSettings?.googlePixelId ? `
          <script async src="https://www.googletagmanager.com/gtag/js?id=${proj.pixelSettings.googlePixelId}"></script>
          <script>
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${proj.pixelSettings.googlePixelId}');
          </script>
          ` : ''}
          </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <div style="max-width: 500px; margin: 0 auto;">
            <h2>Redirecting...</h2>
            <p>You're being redirected to: <strong>${finalUrl}</strong></p>
            <div style="margin: 20px 0;">
              <div style="width: 100%; height: 4px; background: var(--bg-subtle); border-radius: 2px; overflow: hidden;">
                <div id="progress" style="width: 0%; height: 100%; background: var(--primary); transition: width 0.15s linear;"></div>
              </div>
            </div>
            <p style="font-size: 14px; color: #666;">
              ${chosen.label ? `Selected variant: ${chosen.label}` : ''}
              ${globalTargeting.matches ? '' : ' (using safe link)'}
            </p>
          </div>
          
          <script>
            // Progress bar animation
            let progress = 0;
            const progressBar = document.getElementById('progress');
            const interval = setInterval(() => {
              progress += 2;
              if (progressBar) progressBar.style.width = progress + '%';
              if (progress >= 100) clearInterval(interval);
            }, 3);
          </script>
          </body>
          </html>
        `;
        
        return new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }

    if (req.method === "GET" && pathname === "/go") {
      const pid = searchParams.get("project");
      if (!pid) return new Response("Missing ?project=<id>", { status: 400 });
      const proj = await getProject(env, pid);
      if (!proj) return new Response("Link not found.", { status: 404 });
      
      // Get Cloudflare data
      const cf: any = (req as any).cf || {};
      
      const items = normalizeWeights(proj.items);
      const chosen = items[0] || { url: proj.main, weight: 100 };
      
      // Use enhanced targeting evaluation
      const globalTargeting = proj.targeting ? evaluateTargeting(proj.targeting, req, cf) : { matches: true, matchedRules: [] };
      console.log('🔗 About to log click (simple handler) for project:', proj.id);
      const startTime = Date.now();
      ctx.waitUntil(logClick(env, proj, chosen, req, globalTargeting, undefined, startTime));
      return Response.redirect(chosen.url, 302);
    }

    return new Response("Not found", { status: 404 });
  }
};

/* ================= HTML: Login Page ================= */
async function loginHtml(): Promise<string> {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>BAM Splitter - Login</title>
<style>
:root { 
  color-scheme: light dark; 
  /* Dark theme variables */
  --bg-app: #0F172A;
  --bg-panel: #1E293B;
  --bg-subtle: #273548;
  --border: #334155;
  --border-hover: #1E293B;
  --primary: #6366F1;
  --primary-strong: #4F46E5;
  --focus-ring: #818CF8;
  --text: #F1F5F9;
  --text-muted: #CBD5E1;
  --text-subtle: #94A3B8;
  --success: #22C55E;
  --danger: #EF4444;
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

body { 
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; 
  margin: 0; 
  padding: 24px; 
  background: var(--bg-app);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  line-height: 1.5;
}

.login-container {
  max-width: 400px;
  width: 100%;
  padding: 40px 32px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  animation: fadeIn 0.6s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.brand {
  text-align: center;
  margin-bottom: 32px;
}

.brand-icon {
  font-size: 48px;
  margin-bottom: 16px;
  display: block;
}

.brand-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 8px 0;
  letter-spacing: -0.025em;
}

.brand-subtitle {
  font-size: 16px;
  color: var(--text-muted);
  margin: 0;
  font-weight: 500;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
  color: var(--text);
  font-size: 16px;
  box-sizing: border-box;
  transition: all 0.2s ease;
  outline: none;
}

.form-input::placeholder {
  color: var(--text-subtle);
}

.form-input:hover {
  border-color: var(--border-hover);
}

.form-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.login-button {
  width: 100%;
  height: 44px;
  padding: 0 24px;
  border-radius: 6px;
  border: none;
  background: var(--primary);
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  margin-bottom: 24px;
}

.login-button:hover {
  background: var(--primary-strong);
  transform: translateY(-1px);
}

.login-button:focus {
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.message {
  margin-bottom: 20px;
  padding: 12px 16px;
  border-radius: 6px;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
}

.message.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.message.success {
  background: rgba(34, 197, 94, 0.1);
  color: var(--success);
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.admin-note {
  text-align: center;
  margin-top: 24px;
  padding: 16px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}

.admin-note strong {
  color: var(--text);
  font-weight: 600;
}

@media (max-width: 480px) {
  body { padding: 16px; }
  .login-container { padding: 32px 24px; }
}
</style>
</head>
<body>
<div class="login-container">
  <div class="brand">
    <span class="brand-icon">🔗</span>
    <h1 class="brand-title">BAM Splitter</h1>
    <p class="brand-subtitle">Login</p>
  </div>
  
  <form id="loginForm">
    <div class="form-group">
      <label for="email" class="form-label">Email Address</label>
      <input 
        id="email" 
        type="email" 
        class="form-input"
        placeholder="your@email.com" 
        required 
        aria-label="Email address"
      />
    </div>
    
    <div class="form-group">
      <label for="password" class="form-label">Password</label>
      <input 
        id="password" 
        type="password" 
        class="form-input"
        placeholder="Enter your password" 
        required 
        aria-label="Password"
      />
    </div>
    
    <button type="submit" class="login-button" role="button">Sign In</button>
  </form>
  
  <div id="message"></div>
  
  <div class="admin-note">
    <strong>Admin Access:</strong> Use basic authentication for admin privileges.<br>
    <strong>Default Admin:</strong> admin@example.com / admin123
  </div>
</div>

<script>
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const messageDiv = document.getElementById('message');
  
  if (!email || !password) {
    messageDiv.innerHTML = '<div class="message error">Please enter both email and password</div>';
    return;
  }
  
  try {
    console.log('DEBUG: Attempting login with:', { email, password: password ? '[HIDDEN]' : 'MISSING' });
    
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    console.log('DEBUG: Login response status:', response.status);
    console.log('DEBUG: Login response headers:', Array.from(response.headers.entries()));
    
    // Check for Set-Cookie headers specifically
    const setCookieHeaders = response.headers.get('Set-Cookie');
    console.log('DEBUG: Set-Cookie header:', setCookieHeaders);
    
    const result = await response.json();
    console.log('DEBUG: Login response body:', result);
    
    if (response.ok) {
      console.log('DEBUG: Login successful, checking cookies...');
      
      // Check if cookies were set
      const cookies = document.cookie;
      console.log('DEBUG: Current cookies after login:', cookies);
      
      messageDiv.innerHTML = '<div class="message success">Login successful! Redirecting...</div>';
      setTimeout(() => {
        console.log('DEBUG: Redirecting to main page...');
        window.location.href = '/';
      }, 1000);
    } else {
      console.log('DEBUG: Login failed:', result.error);
      messageDiv.innerHTML = '<div class="message error">' + (result.error || 'Login failed') + '</div>';
    }
  } catch (error) {
    console.log('DEBUG: Login error:', error);
    messageDiv.innerHTML = '<div class="message error">Login failed. Please try again.</div>';
  }
});
</script>
</body></html>`;
}

/* ================= HTML: Editor (uses BASE_URL) ================= */
async function editorHtml(env?: Env): Promise<string> {
  const base = (env?.BASE_URL || "").trim();
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>link-splitter</title>
  
  <!-- TikTok Pixel -->
  <script>
    !function (w, d, t) {
      w[t] = w[t] || [];
      w[t].push({
        'ttq.load': 'YOUR_PIXEL_ID_HERE',
        'ttq.track': 'PageView'
      });
      var s = d.createElement('script');
      s.src = 'https://analytics.tiktok.com/i/ttq.js';
      s.async = true;
      d.head.appendChild(s);
    }(window, document, 'ttq');
  </script>
  
  <style>
/* ===== DESIGN SYSTEM FOUNDATION ===== */

/* Spacing Scale - Consistent 8px base */
:root {
  --space-1: 8px;    /* Base unit */
  --space-2: 16px;   /* 2x base */
  --space-3: 24px;   /* 3x base */
  --space-4: 32px;   /* 4x base */
  --space-5: 40px;   /* 5x base */
  --space-6: 48px;   /* 6x base */
  --space-8: 64px;   /* 8x base */
  --space-10: 80px;  /* 10x base */
  --space-12: 96px;  /* 12x base */
  --space-16: 128px; /* 16x base */
}

/* Border Radius Scale */
:root {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-full: 9999px;
}

/* Typography Scale */
:root {
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  --font-size-3xl: 30px;
  
  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;
  
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
}

/* Shadow Scale */
:root {
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

/* ===== UNIFIED DESIGN SYSTEM - EDITOR & ANALYTICS ===== */
:root {
  /* 1. Background Layers */
  --bg-app: #0E141B;                           /* page shell */
  --bg-panel: #171E26;                         /* all cards, sidebars, tables, forms */
  --bg-subtle: #1F2731;                        /* inputs, tab bars, list rows */

  /* 2. Borders & Focus */
  --border: #2A3340;                            /* default borders/dividers */
  --border-hover: #3B4452;                      /* darker on hover, not lighter */
  --border-focus: #4F46E5;                      /* indigo-600 for focus */
  --border-active: #4F46E5;                     /* indigo-600 */
  --focus-ring: #818CF8;                        /* 2px ring */

  /* 3. Text */
  --text: #E8EDF3;                             /* primary text */
  --text-muted: #B9C2CF;                        /* labels/inactive tabs */
  --text-subtle: #8994A3;                       /* helper/placeholder text */

  /* 4. Accents - Indigo/Purple Only */
  --primary: #6366F1;                           /* indigo-500 */
  --primary-strong: #4F46E5;                    /* hover/active */
  --primary-weak: #1E1B4B;                      /* soft indigo tint for selected */
  --success: #22C55E;                           /* Success green */
  --warning: #F59E0B;                           /* Warning amber */
  --danger: #EF4444;                            /* Danger red */

  /* 5. Component Tokens */
  --radius-card: 12px;                          /* card border radius */
  --radius-row: 8px;                            /* row border radius */
  --radius-btn: 6px;                            /* button border radius */
  --height-btn: 36px;                           /* button height */
  --gap-btn: 8px;                               /* button gap */
  --shadow-card: 0 1px 2px rgba(0,0,0,.4), 0 10px 24px rgba(0,0,0,.28); /* consistent shadow */

  /* Legacy Variables - Mapped to New Tokens */
  --bg: var(--bg-app);
  --surface: var(--bg-panel);
  --surface-secondary: var(--bg-subtle);
  --surface-elevated: var(--bg-subtle);
  --text-primary: var(--text);
  --text-secondary: var(--text-muted);
  --text-muted: var(--text-subtle);
  --border-color: var(--border);
  --primary-hover: var(--primary-strong);
  --secondary: var(--warning);
  --secondary-hover: var(--warning);
  --accent: var(--primary);
  --hover: var(--bg-subtle);
  --focus-ring-color: var(--focus-ring);

  /* Component Mappings */
  --card: var(--bg-panel);
  --input: var(--bg-subtle);
  --button-bg: var(--bg-panel);
  --text-color: var(--text);
}

/* Dark mode is now the default - no theme switching needed */

/* ===== BASE TYPOGRAPHY ===== */
body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 16px;                              /* Base 16px */
  line-height: 1.45;                             /* 1.45 line-height */
  font-weight: var(--font-weight-normal);
  color: var(--text);                            /* Main body text */
  background: var(--bg-app);                     /* Global shell background */
  transition: background-color 0.2s ease, color 0.2s ease;
}

/* Force strict token system to take precedence */
body {
  background: var(--bg-app) !important;          /* Global shell background */
  color: var(--text) !important;                 /* Main body text */
}

/* Override any existing button styles */
button, .btn {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}

/* Typography Scale - Unified Hierarchy */
h1, .h1 {
  font-size: 18px;                              /* 18px bold - main headings */
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  color: var(--text);
  margin: 0 0 var(--space-4) 0;
}

h2, .h2 {
  font-size: 16px;                              /* 16px bold - section headings */
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  color: var(--text);
  margin: 0 0 var(--space-3) 0;
}

h3, .h3 {
  font-size: 15px;                              /* 15px semibold - subsection */
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
  color: var(--text);
  margin: 0 0 var(--space-3) 0;
}

h4, .h4 {
  font-size: 18px;                              /* 18px medium - section headers */
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-normal);
  color: var(--text);
  margin: 0 0 var(--space-2) 0;
}

h5, .h5 {
  font-size: 16px;                              /* 16px medium - subsection headers */
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-normal);
  color: var(--text);
  margin: 0 0 var(--space-2) 0;
}

h6, .h6 {
  font-size: 13px;                              /* 13px regular - helper text */
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-normal);
  color: var(--text-muted);
  margin: 0 0 var(--space-2) 0;
}

p {
  margin: 0 0 var(--space-4) 0;
  line-height: var(--line-height-relaxed);
}

p:last-child {
  margin-bottom: 0;
}

/* Text Utilities */
.text-xs { font-size: var(--font-size-xs); }
.text-sm { font-size: var(--font-size-sm); }
.text-base { font-size: var(--font-size-base); }
.text-lg { font-size: var(--font-size-lg); }
.text-xl { font-size: var(--font-size-xl); }
.text-2xl { font-size: var(--font-size-2xl); }
.text-3xl { font-size: var(--font-size-3xl); }

.text-light { font-weight: var(--font-weight-normal); }
.text-medium { font-weight: var(--font-weight-medium); }
.text-semibold { font-weight: var(--font-weight-semibold); }
.text-bold { font-weight: var(--font-weight-bold); }

.text-muted { color: var(--text-muted); }
.text-secondary { color: var(--text-secondary); }
.text-primary { color: var(--primary); }
.text-success { color: var(--success-600); }
.text-warning { color: var(--warning-600); }
.text-danger { color: var(--danger-600); }

.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }

.text-uppercase { text-transform: uppercase; }
.text-lowercase { text-transform: lowercase; }

/* ===== COMPONENT SYSTEM ===== */

/* ===== UNIFIED BUTTON SYSTEM - EDITOR & ANALYTICS ===== */
/* Base button styles that apply to all buttons */
.btn, button {
  height: var(--height-btn);
  padding: 8px 14px;
  border-radius: var(--radius-btn);
  display: inline-flex;
  align-items: center;
  gap: var(--gap-btn);
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  border: 1px solid transparent;
  background: var(--bg-subtle);
  color: var(--text);
  box-shadow: none;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  text-decoration: none;
  white-space: nowrap;
  box-sizing: border-box;
}

.btn:focus-visible, button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.btn:disabled, button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Primary buttons (e.g., + New, Save) */
.btn-primary, button.btn-primary, button.primary, .btn[type="submit"] {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.btn-primary:hover, button.btn-primary:hover, button.primary:hover, .btn[type="submit"]:hover {
  background: var(--primary-strong);
  border-color: var(--primary-strong);
}

/* Secondary buttons (e.g., Duplicate, Refresh) */
.btn-secondary, button.btn-secondary, button.secondary, .btn.ghost {
  background: var(--bg-subtle);
  border-color: var(--border);
  color: var(--text);
}

.btn-secondary:hover, button.btn-secondary:hover, button.secondary:hover, .btn.ghost:hover {
  border-color: var(--border-hover);
}

/* Icon-only buttons (e.g., row actions) */
.btn-icon, button.btn-icon, button.icon, .action-icon {
  width: var(--height-btn);
  height: var(--height-btn);
  padding: 0;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  opacity: 0.85;
}

.btn-icon:hover, button.btn-icon:hover, button.icon:hover, .action-icon:hover {
  opacity: 1;
  border-color: var(--border-hover);
}

.btn-icon svg, .btn-icon i, button.btn-icon svg, button.btn-icon i, button.icon svg, button.icon i, .action-icon svg, .action-icon i {
  width: 16px;
  height: 16px;
}

/* Danger buttons (e.g., Delete) */
.btn-danger, button.btn-danger, button.danger {
  background: #EF4444;
  border-color: #EF4444;
  color: #fff;
}

.btn-danger:hover, button.btn-danger:hover, button.danger:hover {
  filter: brightness(0.95);
}

/* Button groups */
.btn-group, .header-actions, .section-actions {
  display: flex;
  align-items: center;
  gap: var(--gap-btn);
  flex-wrap: wrap;
}

.btn-group-inline {
  display: inline-flex;
  align-items: center;
  gap: var(--gap-btn);
  flex-wrap: wrap;
}

/* Button Sizes */
.btn-sm, button.small {
  height: 32px;
  padding: 6px 12px;
  font-size: 12px;
}

.btn-lg, button.large {
  height: 44px;
  padding: 10px 18px;
  font-size: 16px;
}

/* Button States */
.btn:disabled, button:disabled,
.btn.disabled, button.disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

/* Focus States - Unified */
.btn:focus, button:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--focus-ring);
}

/* Icon sizing inside buttons */
.btn svg, .btn i, button svg, button i {
  width: 16px;
  height: 16px;
}

/* Button groups */
.btn-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-group .btn {
  margin: 0;
}

/* Button variants */
.btn-full {
  width: 100%;
}

.btn-loading {
  position: relative;
  color: transparent;
}

.btn-loading::after {
  content: "";
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Specific button classes used in Editor */
.sidebar-toggle, .toggle-sidebar-btn, .show-sidebar-btn {
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border);
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-btn);
  transition: all 0.2s ease;
}

.sidebar-toggle:hover, .toggle-sidebar-btn:hover, .show-sidebar-btn:hover {
  background: var(--bg-subtle);
  color: var(--text);
  border-color: var(--border-hover);
}

.sidebar-toggle:focus, .toggle-sidebar-btn:focus, .show-sidebar-btn:focus {
  box-shadow: 0 0 0 2px var(--focus-ring);
}

/* Pagination buttons */
.pagination-btn {
  background: var(--bg-subtle);
  color: var(--text);
  border: 1px solid var(--border);
  height: 32px;
  padding: 6px 12px;
  font-size: 12px;
  border-radius: var(--radius-btn);
  transition: all 0.2s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: color-mix(in oklab, var(--focus-ring) 5%, transparent);
  border-color: var(--border-hover);
}

.pagination-btn:focus {
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Refresh and clear buttons */
.refresh-button, .clear-activity-button {
  background: var(--bg-subtle);
  color: var(--text);
  border: 1px solid var(--border);
  height: 32px;
  padding: 6px 12px;
  font-size: 12px;
  border-radius: var(--radius-btn);
  transition: all 0.2s ease;
}

.refresh-button:hover, .clear-activity-button:hover {
  background: color-mix(in oklab, var(--focus-ring) 5%, transparent);
  border-color: var(--border-hover);
}

.refresh-button:focus, .clear-activity-button:focus {
  box-shadow: 0 0 0 2px var(--focus-ring);
}

/* Directional and action buttons */
.ghost.up, .ghost.down, .ghost.del {
  background: var(--bg-subtle);
  color: var(--text);
  border: 1px solid var(--border);
  height: 28px;
  width: 28px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-btn);
  transition: all 0.2s ease;
  font-size: 12px;
}

.ghost.up:hover, .ghost.down:hover, .ghost.del:hover {
  background: color-mix(in oklab, var(--focus-ring) 5%, transparent);
  border-color: var(--border-hover);
}

.ghost.up:focus, .ghost.down:focus, .ghost.del:focus {
  box-shadow: 0 0 0 2px var(--focus-ring);
}

/* Delete rule and bulk link buttons */
.delete-rule, .delete-bulk-link {
  background: var(--bg-subtle);
  color: var(--text);
  border: 1px solid var(--border);
  height: 28px;
  padding: 4px 8px;
  font-size: 12px;
  border-radius: var(--radius-btn);
  transition: all 0.2s ease;
}

.delete-rule:hover, .delete-bulk-link:hover {
  background: var(--danger);
  color: white;
  border-color: var(--danger);
}

.delete-rule:focus, .delete-bulk-link:focus {
  box-shadow: 0 0 0 2px var(--focus-ring);
}

/* Inline button groups */
.btn-group-inline {
  display: inline-flex;
  border-radius: var(--radius-btn);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.btn-group-inline .btn {
  border-radius: 0;
  border-right: 1px solid var(--border);
}

.btn-group-inline .btn:first-child {
  border-top-left-radius: var(--radius-btn);
  border-bottom-left-radius: var(--radius-btn);
}

.btn-group-inline .btn:last-child {
  border-top-right-radius: var(--radius-btn);
  border-bottom-right-radius: var(--radius-btn);
  border-right: none;
}

/* Enhanced focus rings for all interactive elements */
input:focus, select:focus, textarea:focus, button:focus, .tab-button:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--focus-ring);
}

/* Rounded focus rings for buttons and rows using ::after */
.btn:focus, .btn-primary:focus, .btn-secondary:focus, .btn-ghost:focus,
.ui-list-rows button:focus, .ui-list-rows .item:focus {
  outline: none;
  position: relative;
}

.btn:focus::after, .btn-primary:focus::after, .btn-secondary:focus::after, .btn-ghost:focus::after,
.ui-list-rows button:focus::after, .ui-list-rows .item:focus::after {
  content: "";
  position: absolute;
  inset: -2px;
  border: 2px solid var(--focus-ring);
  border-radius: 8px;
  pointer-events: none;
  z-index: 1;
}

/* Rounded focus rings for elements that need them */
.btn:focus, button:focus, .tab-button:focus {
  border-radius: 6px;
}

/* Ensure no white borders on focus */
input:focus, select:focus, textarea:focus, button:focus {
  border-color: var(--border-focus);
}

/* Inputs - Strict Token System */
input, select, textarea {
  width: 100%;
  height: 36px;                                  /* Fixed height */
  padding: 8px 10px;                             /* Tight padding */
  font-size: 14px;                               /* 14px */
  line-height: 1.45;                              /* 1.45 line height */
  color: var(--text);                             /* Main body text */
  background: var(--bg-subtle);                   /* Subtle background */
  border: 1px solid var(--border);                /* Border color */
  border-radius: 6px;                             /* Consistent 6px radius */
  transition: all 0.2s ease;
  box-sizing: border-box;
  box-shadow: none;                               /* No shadow - border only */
}

input::placeholder, textarea::placeholder {
  color: var(--text-subtle);                      /* Helper/placeholder text */
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--border-active);            /* Indigo-600 border on focus */
  box-shadow: 0 0 0 2px var(--focus-ring);      /* Always visible 2px focus ring */
}

input:hover, select:hover, textarea:hover {
  border-color: var(--border-hover);
}

/* Input Variants */
input[type="checkbox"], input[type="radio"] {
  width: auto;
  margin-right: var(--space-2);
}

/* Flat Themed Selects - Replace OS-looking selects */
select, .select, [role="combobox"], [data-select] {
  appearance: none !important;
  -webkit-appearance: none !important;
  -moz-appearance: none !important;
  cursor: pointer;
  background: var(--bg-subtle) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
  border-radius: 6px !important;
  height: 36px !important;
  padding: 8px 12px 8px 12px !important;
  font-size: 14px !important;
  line-height: 1.45 !important;
  transition: all 0.2s ease !important;
  box-sizing: border-box !important;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%238994A3' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e") !important;
  background-position: right 12px center !important;
  background-repeat: no-repeat !important;
  background-size: 16px !important;
  padding-right: 36px !important;
}

select:hover, .select:hover, [role="combobox"]:hover, [data-select]:hover {
  border-color: var(--border-hover) !important;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236366F1' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e") !important;
}

select:focus, .select:focus, [role="combobox"]:focus, [data-select]:focus {
  outline: none !important;
  border-color: var(--border-active) !important;
  box-shadow: 0 0 0 2px var(--focus-ring) !important;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236366F1' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e") !important;
}

/* Remove any global select filters or gradients */
select, .select, [role="combobox"], [data-select] {
  filter: none !important;
  background-image: none !important;
}

select, .select, [role="combobox"], [data-select] {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%238994A3' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e") !important;
}

/* Cards & Panels - Unified Material System */
.card, .panel, .sidebar-panel {
  background: var(--bg-panel);                  /* All cards, forms, sidebars, tables */
  border: 1px solid var(--border);              /* All panel edges */
  border-radius: 8px;                           /* Consistent 8px radius */
  padding: 16px;                                /* Tight 16px padding */
  box-shadow: 0 1px 2px rgba(0,0,0,.4), 0 10px 24px rgba(0,0,0,.28); /* Single soft shadow */
  transition: all 0.2s ease;
}

.card:hover, .panel:hover, .sidebar-panel:hover {
  border-color: var(--border-hover);            /* Darkened border on hover for depth */
  box-shadow: 0 2px 4px rgba(0,0,0,.5), 0 12px 32px rgba(0,0,0,.35); /* Slightly stronger on hover */
  transform: translateY(-1px);
}

/* Sidebar - Unified with main panels */
.sidebar, .groups-projects-sidebar {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  margin-right: var(--space-4);
  padding: 0;
  overflow: hidden;
}

/* Main content panels - Unified with sidebar */
.main-content, .content-panel {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  flex: 1;
  overflow: hidden;
}

/* Layout container for sidebar + main content */
.app-layout {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
  background: var(--bg-app);
  min-height: 100vh;
  padding: var(--space-4);
}

/* Sidebar section spacing */
.sidebar-section {
  margin-bottom: var(--space-2);
}

.sidebar-section:last-child {
  margin-bottom: 0;
}

/* CLEAN: Sidebar items should have the same selection styling */
.sidebar .selected, .groups-projects-sidebar .selected {
  background: var(--primary-weak) !important;
  color: var(--text);
  border-left: none !important;
  border-radius: 0;
  padding: 10px 14px;
  margin: 0;
  position: relative;
}

.sidebar .selected:hover, .groups-projects-sidebar .selected:hover {
  background: var(--primary-weak) !important;
  color: var(--text);
  border-left: none !important;
}

/* CLEAN: Remove all focus rings from sidebar items */
.sidebar .selected::after, .groups-projects-sidebar .selected::after {
  content: none !important;
}

/* Card styling - Unified with new components */
.card-header {
  padding: 16px;
  margin: 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg-subtle);
}

.card-title {
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
  color: var(--text);
  margin: 0;
}

.card-body {
  padding: 16px;
  color: var(--text-muted);
}

/* ===== UNIFIED LIST ROW COMPONENT ===== */
/* Shared styling for Groups & Projects lists across Editor & Analytics */
.ui-list-rows {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  margin-bottom: var(--space-2);
}

/* Project-specific styling */
.project-item {
  background: transparent !important;
  border: none !important;
  color: var(--text);
  font-size: 14px;
  font-weight: var(--font-weight-medium);
  text-align: left;
  padding: 0;
  margin: 0;
  flex: 1;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 40px;
  display: flex;
  align-items: center;
}

.project-item:hover {
  color: var(--primary);
}

/* CLEAN: Project item selection styling */
.project-item.selected {
  background: var(--primary-weak) !important;
  color: var(--text);
  border: none !important;
}

/* Group-specific styling */
.ui-list-rows .group-button {
  background: transparent;
  border: none;
  color: var(--text);
  font-size: 14px;
  font-weight: var(--font-weight-medium);
  text-align: left;
  padding: 0;
  margin: 0;
  flex: 1;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 40px;
  display: flex;
  align-items: center;
}

.ui-list-rows .group-button:hover {
  color: var(--primary);
}

/* CLEAN: Group button selection styling */
.ui-list-rows .group-button.selected {
  background: var(--primary-weak) !important;
  color: var(--text);
  border-left: none !important;
}

/* Ensure groups have consistent thin borders */
.ui-list-rows.admin,
.ui-list-rows.editor {
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  overflow: hidden;
}

/* List item borders for groups */
.ui-list-rows .list-item {
  border-bottom: 1px solid var(--border);
}

.ui-list-rows .list-item:last-child {
  border-bottom: none;
}

.ui-list-rows .list-item,
.ui-list-rows .group-item {
  min-height: 40px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-panel);
  color: var(--text);
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s ease;
  box-sizing: border-box;
  border-radius: 0;
  border-top: none;
  border-left: none;
  border-right: none;
  position: relative;
}

.ui-list-rows .list-item:last-child,
.ui-list-rows .group-item:last-child {
  border-bottom: 0;
}

.ui-list-rows .list-item:hover,
.ui-list-rows .group-item:hover {
  border-bottom-color: var(--border-hover);
  background: color-mix(in oklab, var(--focus-ring) 7%, transparent);
}

.ui-list-rows .list-item.selected,
.ui-list-rows .group-item.selected {
  background: var(--primary-weak);
  border-left: none;
  border-bottom: none !important;
}

/* CLEAN: Remove all focus rings and borders from selected items */
.ui-list-rows .list-item.selected::after,
.ui-list-rows .group-item.selected::after {
  content: none !important;
}

/* CLEAN: Global rule - NO borders on any selected items */
.list-item.selected,
.group-item.selected,
.project-item.selected,
button.selected {
  border-left: none !important;
  border-right: none !important;
  border-top: none !important;
  border-bottom: none !important;
}

/* CLEAN: Global rule - NO focus rings on any selected items */
.list-item.selected::after,
.group-item.selected::after,
.project-item.selected::after,
button.selected::after {
  content: none !important;
}

/* NUCLEAR GLOBAL: Remove ALL focus rings from ALL elements */
*::after {
  content: none !important;
}

/* NUCLEAR GLOBAL: Remove ALL borders from project-related elements */
.ui-list-rows *,
.ui-list-rows *::after,
.ui-list-rows *::before {
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
}

/* NUCLEAR SPECIFIC: Remove ALL focus states from project items */
.ui-list-rows .list-item:focus,
.ui-list-rows .project-item:focus,
.ui-list-rows button:focus,
.ui-list-rows .list-item:focus-visible,
.ui-list-rows .project-item:focus-visible,
.ui-list-rows button:focus-visible {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
}

/* NUCLEAR SPECIFIC: Remove ALL focus rings from project items */
.ui-list-rows .list-item:focus::after,
.ui-list-rows .project-item:focus::after,
.ui-list-rows button:focus::after,
.ui-list-rows .list-item:focus-visible::after,
.ui-list-rows .project-item:focus-visible::after,
.ui-list-rows button:focus-visible::after {
  content: none !important;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
}

/* NUCLEAR FINAL: Disable focus ring variable for project items */
.ui-list-rows .list-item,
.ui-list-rows .project-item,
.ui-list-rows button {
  --focus-ring: transparent !important;
}

/* CLEAN: Projects and Groups should look exactly the same when selected */
.ui-list-rows .list-item.selected,
.ui-list-rows .group-item.selected {
  background: var(--primary-weak) !important;
  border-left: none !important;
  border-bottom: none !important;
}

/* CLEAN: Project buttons should have the same selection styling */
.ui-list-rows .project-item.selected {
  background: var(--primary-weak) !important;
  border: none !important;
}

/* ULTRA SPECIFIC: Ensure project selection highlighting works */
.ui-list-rows .list-item.selected .project-item {
  background: var(--primary-weak) !important;
  border: none !important;
}

.ui-list-rows .list-item.selected {
  background: var(--primary-weak) !important;
  border: none !important;
  outline: none !important;
}

/* MAXIMUM SPECIFICITY: Force project selection highlighting */
.ui-list-rows .list-item.selected,
.ui-list-rows .list-item.selected *,
.ui-list-rows .list-item.selected button,
.ui-list-rows .list-item.selected .project-item {
  background: var(--primary-weak) !important;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
}

/* MAXIMUM SPECIFICITY: Force project button selection highlighting */
.ui-list-rows button.project-item.selected,
.ui-list-rows .project-item.selected {
  background: var(--primary-weak) !important;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
}

/* NUCLEAR OPTION: Remove ALL borders and focus rings from ALL project items */
.ui-list-rows .list-item,
.ui-list-rows .list-item *,
.ui-list-rows .project-item,
.ui-list-rows button.project-item {
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
}

.ui-list-rows .list-item::after,
.ui-list-rows .list-item *::after,
.ui-list-rows .project-item::after,
.ui-list-rows button.project-item::after {
  content: none !important;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
}

/* NUCLEAR OPTION: Force selected state on project items */
.ui-list-rows .list-item.selected,
.ui-list-rows .list-item.selected *,
.ui-list-rows .list-item.selected .project-item,
.ui-list-rows .list-item.selected button.project-item {
  background: var(--primary-weak) !important;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
}

/* Badge styling within list rows */
.ui-list-rows .badge {
  height: 26px;
  padding: 4px 10px;
  background: var(--primary-weak);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Action icons within list rows */
.ui-list-rows .action-icon {
  opacity: 0.7;
  transition: opacity 0.2s ease;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.ui-list-rows .action-icon:hover {
  opacity: 1;
  background: color-mix(in oklab, var(--focus-ring) 10%, transparent);
}

/* ===== UNIFIED TABLE COMPONENT ===== */
.table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.table th {
  background: var(--bg-subtle);
  color: var(--text);
  font-weight: var(--font-weight-semibold);
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 14px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.table td {
  padding: 12px 14px;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

.table tr:last-child td {
  border-bottom: none;
}

.table tr:hover {
  background: color-mix(in oklab, var(--focus-ring) 6%, transparent);
}

/* Table row selection */
.table tr.selected {
  background: var(--primary-weak);
  position: relative;
}

.table tr.selected::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid var(--focus-ring);
  border-radius: var(--radius-row);
  pointer-events: none;
  z-index: 1;
}

/* Actions column styling */
.table .actions-column {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
}

.table .action-icon {
  opacity: 0.7;
  transition: opacity 0.2s ease;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.table .action-icon:hover {
  opacity: 1;
  background: color-mix(in oklab, var(--focus-ring) 10%, transparent);
}

/* ===== UNIFIED BUTTON COMPONENTS ===== */


/* ===== UNIFIED TAB COMPONENTS ===== */
.tab-container {
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border);
  padding: 0;
  margin-bottom: var(--space-3);
}

.tab-button {
  padding: 12px 8px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  position: relative;
  border-radius: 0;
  height: auto;
  min-height: 44px;
}

.tab-button:hover {
  color: var(--text);
  background: transparent;
}

.tab-button.active {
  color: var(--text);
  background: transparent;
}

.tab-button.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--primary);
  border-radius: 1px;
}

.tab-button:focus {
  box-shadow: 0 0 0 2px var(--focus-ring);
}

/* ===== UNIFIED INPUT COMPONENTS ===== */
input, select, textarea {
  height: 36px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
  color: var(--text);
  font-size: 14px;
  line-height: 1.45;
  transition: all 0.2s ease;
  outline: none;
  box-sizing: border-box;
}

input::placeholder, select::placeholder, textarea::placeholder {
  color: var(--text-subtle);
}

input:hover, select:hover, textarea:hover {
  border-color: var(--border-hover);
}

input:focus, select:focus, textarea:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

/* Select styling - remove native appearance */
select, .select, [role="combobox"], [data-select] {
  appearance: none !important;
  -webkit-appearance: none !important;
  -moz-appearance: none !important;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%238994A3' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 16px;
  padding-right: 32px;
}

select:hover, .select:hover, [role="combobox"]:hover, [data-select]:hover {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236366F1' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
}

/* ===== UNIFIED CARD COMPONENTS ===== */
.card, .panel, .section {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.card-header, .section-header {
  background: var(--bg-subtle);
  padding: 16px;
  border-bottom: 1px solid var(--border);
  margin: 0;
}

.card-title, .section-title {
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
  color: var(--text);
  margin: 0;
}

.card-body, .section-body {
  padding: 16px;
  color: var(--text-muted);
}

/* ===== UNIFIED PROGRESS BAR ===== */
.progress-bar {
  height: 8px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 999px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: var(--success);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text-muted);
}

/* ===== UNIFIED STATES & FEEDBACK ===== */
.empty-state {
  text-align: center;
  padding: var(--space-4);
  color: var(--text-muted);
}

.empty-state .icon {
  font-size: 48px;
  margin-bottom: var(--space-2);
  opacity: 0.5;
}

.empty-state .title {
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
  color: var(--text);
  margin-bottom: var(--space-1);
}

.empty-state .description {
  color: var(--text-subtle);
  margin-bottom: var(--space-2);
}

.skeleton {
  background: var(--bg-subtle);
  border-radius: 4px;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.skeleton-row {
  height: 40px;
  margin-bottom: 8px;
}

.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-row);
  padding: 12px 16px;
  color: var(--text);
  box-shadow: var(--shadow-card);
  z-index: 1000;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  margin-top: var(--space-3);
}

.pagination button {
  height: 32px;
  min-width: 32px;
  padding: 0 8px;
  font-size: 14px;
}

.pagination button:disabled {
  opacity: 0.4;
}

/* ===== UNIFIED SMART LINK ROW ===== */
.smart-link-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-row);
  margin-bottom: var(--space-2);
}

.smart-link-url {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-family: monospace;
  font-size: 14px;
}

.smart-link-url:hover {
  color: var(--primary);
}

.copy-button {
  padding: 6px 12px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
  white-space: nowrap;
}

.copy-button:hover {
  background: var(--primary-weak);
  color: var(--text);
  border-color: var(--border-hover);
}

.copy-button.copied {
  background: var(--success);
  color: white;
  border-color: var(--success);
}

/* ===== UNIFIED ACCORDION COMPONENTS ===== */
.accordion {
  border: 1px solid var(--border);
  border-radius: var(--radius-row);
  overflow: hidden;
  margin-bottom: 8px;
}

.accordion-header {
  background: var(--bg-subtle);
  padding: 12px 16px;
  cursor: pointer;
  border: none;
  width: 100%;
  text-align: left;
  color: var(--text);
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  transition: all 0.2s ease;
}

.accordion-header:hover {
  background: color-mix(in oklab, var(--focus-ring) 5%, transparent);
}

.accordion-header:focus {
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.accordion-chevron {
  transition: transform 0.2s ease;
  color: var(--text-muted);
  font-size: 18px;
}

.accordion-header[aria-expanded="true"] .accordion-chevron {
  transform: rotate(90deg);
}

.accordion-body {
  background: var(--bg-panel);
  padding: 16px;
  border-top: 1px solid var(--border);
  color: var(--text-muted);
}

/* ===== COPY FEEDBACK FUNCTIONALITY ===== */
.copy-feedback {
  position: fixed;
  top: 20px;
  right: 20px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-row);
  padding: 12px 16px;
  color: var(--text);
  box-shadow: var(--shadow-card);
  z-index: 1000;
  animation: slideIn 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.copy-feedback .icon {
  color: var(--success);
  font-size: 16px;
}

.copy-feedback.show {
  animation: slideIn 0.3s ease;
}

.copy-feedback.hide {
  animation: slideOut 0.3s ease;
}

@keyframes slideOut {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
}

/* ===== UNIFIED FOCUS RINGS ===== */
/* Ensure all interactive elements have consistent focus rings */
.btn:focus, button:focus, input:focus, select:focus, textarea:focus, .tab-button:focus {
  box-shadow: 0 0 0 2px var(--focus-ring);
}

/* For elements that need rounded focus rings */
.btn.rounded:focus, button.rounded:focus, .list-item:focus, .project-item:focus, .group-item:focus {
  box-shadow: none;
}

.btn.rounded:focus::after, button.rounded:focus::after {
  content: '';
  position: absolute;
  inset: -2px;
  border: 2px solid var(--focus-ring);
  border-radius: var(--radius-row);
  pointer-events: none;
  z-index: 1;
}

/* REMOVE focus rings from list items and project items */
.list-item:focus::after, .project-item:focus::after, .group-item:focus::after {
  content: none !important;
}

/* ULTRA SPECIFIC: Remove ALL focus rings and borders from project items */
.ui-list-rows .list-item:focus::after,
.ui-list-rows .project-item:focus::after,
.ui-list-rows .group-item:focus::after,
.ui-list-rows .list-item.selected:focus::after,
.ui-list-rows .project-item.selected:focus::after,
.ui-list-rows .group-item.selected:focus::after {
  content: none !important;
  border: none !important;
  outline: none !important;
}

/* ===== GROUP TYPE STYLING ===== */
.group-item.admin {
  border-left: 4px solid var(--primary);
  background: var(--primary-weak);
}

.group-item.editor {
  border-left: 4px solid var(--success);
  background: rgba(34, 197, 94, 0.1);
}

/* ===== UTILITY CLASSES ===== */
.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text-truncate:hover {
  overflow: visible;
  white-space: normal;
  word-break: break-all;
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.gap-1 { gap: var(--space-1); }
.gap-2 { gap: var(--space-2); }
.gap-3 { gap: var(--space-3); }

.mt-1 { margin-top: var(--space-1); }
.mt-2 { margin-top: var(--space-2); }
.mt-3 { margin-top: var(--space-3); }

.mb-1 { margin-bottom: var(--space-1); }
.mb-2 { margin-bottom: var(--space-2); }
.mb-3 { margin-bottom: var(--space-3); }

/* ===== UNIFIED PROGRESS BAR ===== */
.progress-container {
  margin: var(--space-2) 0;
}

.progress-bar {
  height: 8px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 999px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: var(--success);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text-muted);
}

/* Table Variants */
.table-striped tbody tr:nth-child(even) {
  background: var(--bg-subtle);                  /* Subtle background for alternating rows */
}

.table-striped tbody tr:nth-child(even):hover {
  background: var(--primary-weak);               /* Primary-weak on hover */
}

/* Sublink URL table - tighter spacing */
#tbody tr {
  height: 36px;                                  /* Reduced row height */
}

#tbody td {
  padding: 8px;                                  /* Row vertical padding 8px */
  vertical-align: middle;                        /* Center content vertically */
}

#tbody input {
  height: 36px;                                  /* Fixed input height */
  padding: 8px 10px;                             /* Input padding */
}

.table-compact th,
.table-compact td {
  padding: var(--space-2) var(--space-3);
}

.table-bordered th,
.table-bordered td {
  border: 1px solid var(--border);
}

/* Tabs - Underline Style (No Pill Backgrounds) */
.tab-button {
  padding: 8px 6px;                              /* Slimmer padding */
  background: transparent;
  color: var(--text-muted);                      /* Labels, inactive tabs */
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 14px;                               /* 14px */
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  border-radius: 0;                              /* No rounded corners */
  margin-right: 4px;                             /* Prevent overlap */
}

.tab-button:hover {
  color: var(--text);                            /* Main body text on hover */
  background: transparent;                       /* No background on hover */
  border-bottom: 2px solid var(--border-hover);  /* Subtle underline on hover */
}

.tab-button.active {
  color: var(--text);                            /* Main body text */
  background: transparent;                       /* No background */
  border-bottom: 2px solid var(--primary);       /* 2px primary underline */
  box-shadow: none;                              /* No shadow */
}

.tab-button.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--primary);
  border-radius: 0;                              /* No rounded corners */
}

/* Tab Content - Strict Token System */
.tab-content {
  background: var(--bg-panel);                   /* Panel background */
  padding: 16px;                                 /* Tight 16px padding */
  border: 1px solid var(--border);               /* Border color */
  border-radius: 8px;                           /* Consistent 8px radius */
  box-shadow: 0 1px 2px rgba(0,0,0,.4), 0 10px 24px rgba(0,0,0,.28); /* Single soft shadow */
  margin-top: 8px;                               /* Reduced top margin for tighter spacing */
}

.tab-content.active {
  display: block;
}

/* Form Elements - Strict Token System */
.form-group {
  margin-bottom: 8px;                            /* Reduced margin */
}

.form-group label {
  display: block;
  margin-bottom: 6px;                            /* 6px gap between label and input */
  font-weight: var(--font-weight-medium);
  color: var(--text);                            /* Main body text */
  font-size: 14px;                               /* Labels - 14px */
}

/* Section styling - Strict Token System */
.fraud-protection-section,
.advanced-settings-section,
.ab-testing-section {
  background: var(--bg-panel);                   /* Panel background */
  border: 1px solid var(--border);               /* Border color */
  border-radius: 8px;                           /* Consistent 8px radius */
  padding: 16px;                                 /* Tight 16px padding */
  margin: 8px 0;                                 /* Reduced margins */
  box-shadow: 0 1px 2px rgba(0,0,0,.4), 0 10px 24px rgba(0,0,0,.28); /* Single soft shadow */
}

.fraud-protection-section h3,
.advanced-settings-section h3,
.ab-testing-section h3 {
  font-size: 16px;                              /* Section titles - 16px medium */
  font-weight: var(--font-weight-medium);
  color: var(--text);                            /* Main body text */
  margin: 0 0 12px 0;                            /* Reduced bottom margin */
}

.form-group input,
.form-group select,
.form-group textarea {
  margin-top: var(--space-1);
}

/* Badges & Pills - Compact Design */
.badge {
  display: inline-flex;
  align-items: center;
  height: 26px;                                  /* Slightly smaller height */
  padding: 4px 10px;                             /* Tight padding */
  font-size: 12px;                               /* Smaller font */
  font-weight: var(--font-weight-medium);
  line-height: 1.45;                              /* 1.45 line height */
  border-radius: 9999px;                         /* Pill shape */
  white-space: nowrap;
  border: 1px solid var(--border);               /* Border color */
  box-sizing: border-box;
}

.badge-primary {
  background: var(--primary-weak);               /* indigo-950 background tint */
  color: var(--text);                            /* Main body text */
  border-color: var(--primary);                  /* Primary border */
}

.badge-secondary {
  background: var(--bg-subtle);                  /* Subtle background */
  color: var(--text);                            /* Main body text */
  border-color: var(--border);                   /* Border color */
}

.badge-success {
  background: var(--success);                    /* Success green */
  color: white;
  border-color: var(--success);                  /* Success border */
}

.badge-warning {
  background: var(--warning);                    /* Warning amber */
  color: var(--text);                            /* Main body text */
  border-color: var(--warning);                  /* Warning border */
}

.badge-danger {
  background: var(--danger);                     /* Danger red */
  color: white;
  border-color: var(--danger);                   /* Danger border */
}

/* Sidebar spacing between Groups and Projects */
.groups-projects-sidebar .groups-section {
  margin-bottom: 10px;
}

.groups-projects-sidebar .projects-section {
  margin-top: 10px;
}

/* Layout Utilities */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-4);
}

.grid {
  display: grid;
  gap: var(--space-4);
}

.grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid-cols-4 { grid-template-columns: repeat(4, 1fr); }

.flex {
  display: flex;
}

.flex-col { flex-direction: column; }
.flex-row { flex-direction: row; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.gap-2 { gap: var(--space-2); }
.gap-3 { gap: var(--space-3); }
.gap-4 { gap: var(--space-4); }

/* Spacing Utilities */
.p-2 { padding: var(--space-2); }
.p-3 { padding: var(--space-3); }
.p-4 { padding: var(--space-4); }
.p-6 { padding: var(--space-6); }

.m-2 { margin: var(--space-2); }
.m-3 { margin: var(--space-3); }
.m-4 { margin: var(--space-4); }
.m-6 { margin: var(--space-6); }

.mt-2 { margin-top: var(--space-2); }
.mt-3 { margin-top: var(--space-3); }
.mt-4 { margin-top: var(--space-4); }
.mt-6 { margin-top: var(--space-6); }

.mb-2 { margin-bottom: var(--space-2); }
.mb-3 { margin-bottom: var(--space-3); }
.mb-4 { margin-bottom: var(--space-4); }
.mb-6 { margin-bottom: var(--space-6); }

/* Responsive Breakpoints */
@media (max-width: 768px) {
  .grid-cols-2,
  .grid-cols-3,
  .grid-cols-4 {
    grid-template-columns: 1fr;
  }
  
  .container {
    padding: 0 var(--space-2);
  }
  
  .card {
    padding: var(--space-4);
  }
  
  .tab-content {
    padding: var(--space-4);
  }
}
.text-capitalize { text-transform: capitalize; }

.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text-break {
  word-break: break-word;
  overflow-wrap: break-word;
}

/* Link Styles */
a {
  color: var(--primary);
  text-decoration: none;
  transition: color 0.2s ease;
}

a:hover {
  color: var(--primary-hover);
  text-decoration: underline;
}

a:focus {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

/* Code and Monospace */
code, pre {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: var(--font-size-sm);
  background: var(--surface-secondary);
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-2);
}

pre {
  padding: var(--space-4);
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-secondary);
  margin: var(--space-4) 0;
}

pre code {
  background: transparent;
  padding: 0;
  border-radius: 0;
}

/* Blockquotes */
blockquote {
  margin: var(--space-4) 0;
  padding: var(--space-4);
  border-left: 4px solid var(--primary);
  background: var(--surface-secondary);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  font-style: italic;
  color: var(--text-secondary);
}

blockquote p:last-child {
  margin-bottom: 0;
}

/* Lists */
ul, ol {
  margin: var(--space-4) 0;
  padding-left: var(--space-6);
}

li {
  margin-bottom: var(--space-2);
  line-height: var(--line-height-relaxed);
}

.list-unstyled {
  list-style: none;
  padding-left: 0;
}

.list-inline {
  list-style: none;
  padding-left: 0;
  display: flex;
  gap: var(--space-4);
}

/* Definition Lists */
dl {
  margin: var(--space-4) 0;
}

dt {
  font-weight: var(--font-weight-semibold);
  color: var(--text);
  margin-bottom: var(--space-1);
}

dd {
  margin-left: 0;
  margin-bottom: var(--space-3);
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

/* ===== COMPONENT STYLES ===== */

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-tight);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  white-space: nowrap;
  user-select: none;
}

.btn:focus {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.btn-primary {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border-color: var(--border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--hover);
  border-color: var(--border-strong);
}

/* Replace ghost buttons with better alternatives */
.btn-ghost {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--hover);
  border-color: var(--border-strong);
}



/* Navigation Components */
.nav {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.nav-item {
  padding: var(--space-2) var(--space-3);
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  font-weight: var(--font-weight-medium);
}

.nav-item:hover {
  color: var(--text);
  background: var(--hover);
}

.nav-item.active {
  color: var(--primary);
  background: var(--accent-50);
}

.nav-vertical {
  flex-direction: column;
  align-items: stretch;
}

.nav-vertical .nav-item {
  text-align: left;
}

/* Breadcrumbs */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.breadcrumb-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.breadcrumb-item:not(:last-child)::after {
  content: "/";
  color: var(--border);
}

.breadcrumb-link {
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.2s ease;
}

.breadcrumb-link:hover {
  color: var(--text);
}

.breadcrumb-current {
  color: var(--text);
  font-weight: var(--font-weight-medium);
}

/* Inputs - Consistent spacing */
input, select, textarea {
  width: 100%;
  padding: var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--focus-ring);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

input::placeholder, textarea::placeholder {
  color: var(--text-muted);
}

/* Enhanced Input Variants */
.input-sm {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
}

.input-lg {
  padding: var(--space-4) var(--space-5);
  font-size: var(--font-size-lg);
}

.input-error {
  border-color: var(--danger-500);
}

.input-error:focus {
  border-color: var(--danger-500);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.input-success {
  border-color: var(--success-500);
}

.input-success:focus {
  border-color: var(--success-500);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
}

/* Input Groups */
.input-group {
  display: flex;
  align-items: stretch;
}

.input-group input,
.input-group select {
  border-radius: 0;
  border-right: none;
}

.input-group input:first-child,
.input-group select:first-child {
  border-top-left-radius: var(--radius-md);
  border-bottom-left-radius: var(--radius-md);
}

.input-group input:last-child,
.input-group select:last-child {
  border-top-right-radius: var(--radius-md);
  border-bottom-right-radius: var(--radius-md);
  border-right: 1px solid var(--border);
}

.input-group-addon {
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--surface-secondary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.input-group-addon:first-child {
  border-top-left-radius: var(--radius-md);
  border-bottom-left-radius: var(--radius-md);
  border-right: none;
}

.input-group-addon:last-child {
  border-top-right-radius: var(--radius-md);
  border-bottom-right-radius: var(--radius-md);
  border-left: none;
}

/* Checkboxes and Radio Buttons */
.checkbox-group,
.radio-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.checkbox-item,
.radio-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.checkbox-item input[type="checkbox"],
.radio-item input[type="radio"] {
  width: auto;
  margin: 0;
}

.checkbox-item label,
.radio-item label {
  cursor: pointer;
  user-select: none;
  font-size: var(--font-size-sm);
  color: var(--text);
}

/* Switch/Toggle */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--border);
  transition: 0.3s;
  border-radius: var(--radius-full);
}

.switch-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  transition: 0.3s;
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-sm);
}

.switch input:checked + .switch-slider {
  background: var(--primary);
}

.switch input:checked + .switch-slider:before {
  transform: translateX(20px);
}

/* File Input */
.file-input {
  position: relative;
  display: inline-block;
  cursor: pointer;
}

.file-input input[type="file"] {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.file-input-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border: 2px dashed var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.file-input-label:hover {
  border-color: var(--primary);
  background: var(--accent-50);
  color: var(--primary);
}

.file-input input[type="file"]:focus + .file-input-label {
  border-color: var(--focus-ring);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

/* Cards - Reduced visual noise */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  transition: border-color 0.2s ease;
}

.card:hover {
  border-color: var(--border-strong);
}

/* Enhanced Card Variants */
.card-header {
  padding-bottom: var(--space-4);
  margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--border);
}

.card-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text);
  margin: 0;
}

.card-subtitle {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.card-body {
  flex: 1;
}

.card-footer {
  padding-top: var(--space-4);
  margin-top: var(--space-4);
  border-top: 1px solid var(--border);
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}

.card-compact {
  padding: var(--space-4);
}

.card-elevated {
  box-shadow: var(--shadow-lg);
}

.card-elevated:hover {
  box-shadow: var(--shadow-xl);
}

.card-interactive {
  cursor: pointer;
}

.card-interactive:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Panels */
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.panel-header {
  background: var(--surface-secondary);
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--text);
  margin: 0;
}

.panel-actions {
  display: flex;
  gap: var(--space-2);
}

.panel-body {
  padding: var(--space-6);
}

.panel-footer {
  background: var(--surface-secondary);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--border);
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}

/* Accordion */
.accordion {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.accordion-item {
  border-bottom: 1px solid var(--border);
}

.accordion-item:last-child {
  border-bottom: none;
}

.accordion-header {
  background: var(--bg-subtle);
  padding: 16px 20px;
  cursor: pointer;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background-color 0.2s ease;
}

.accordion-header:hover {
  background: color-mix(in oklab, var(--focus-ring) 3%, var(--bg-subtle));
}

.accordion-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--text);
  margin: 0;
}

.accordion-icon {
  transition: transform 0.2s ease;
  color: var(--text-secondary);
}

.accordion-item.open .accordion-icon {
  transform: rotate(90deg);
}

.accordion-body {
  background: var(--bg-panel);
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  display: none;
}

.accordion-item.open .accordion-body {
  display: block;
}

/* Tabs */
.tabs {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.tabs-header {
  background: var(--surface-secondary);
  border-bottom: 1px solid var(--border);
  display: flex;
}

.tab-header {
  padding: var(--space-3) var(--space-6);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-weight: var(--font-weight-medium);
  transition: all 0.2s ease;
  border-bottom: 2px solid transparent;
}

.tab-header:hover {
  color: var(--text);
  background: var(--hover);
}

.tab-header.active {
  color: var(--primary);
  background: var(--surface);
  border-bottom-color: var(--primary);
}

.tab-content {
  background: var(--surface);
  padding: var(--space-6);
  display: none;
}

.tab-content.active {
  display: block;
}

/* Tables - Reduced visual noise */
.table {
  width: 100%;
  border-collapse: collapse;
  margin-top: var(--space-2);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.table th {
  background: var(--surface-secondary);
  padding: var(--space-2);
  text-align: left;
  font-weight: var(--font-weight-semibold);
  color: var(--text);
  border-bottom: 1px solid var(--border);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.table td {
  padding: var(--space-2);
  border-bottom: 1px solid var(--border);
  color: var(--text);
  vertical-align: top;
}

.table tr:last-child td {
  border-bottom: none;
}

.table tr:hover {
  background: var(--hover);
}

/* Enhanced Table Variants */
.table-striped tbody tr:nth-child(even) {
  background: var(--surface-secondary);
}

.table-striped tbody tr:nth-child(even):hover {
  background: var(--hover);
}

.table-compact th,
.table-compact td {
  padding: var(--space-2) var(--space-3);
}

.table-bordered th,
.table-bordered td {
  border: 1px solid var(--border);
}

/* Data Visualization */
.chart-container {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.chart-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text);
  margin-bottom: var(--space-4);
  text-align: center;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  justify-content: center;
  margin-top: var(--space-4);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-sm);
}

/* Progress Bars - Compact Style */
.progress {
  width: 100%;
  height: 6px;                                   /* Slightly reduced height */
  background: var(--bg-subtle);
  border-radius: 3px;                             /* Rounded ends */
  overflow: hidden;
  margin: var(--space-2) 0;
  border: 1px solid var(--border);                /* 1px outer border */
}

.progress-bar {
  height: 100%;
  background: var(--primary);
  border-radius: 3px;                             /* Rounded ends */
  transition: width 0.3s ease;
}

.progress-success { background: var(--success-500); }
.progress-warning { background: var(--warning-500); }
.progress-danger { background: var(--danger-500); }

/* Stats Cards */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
  margin: var(--space-6) 0;
}

.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  text-align: center;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--primary);
  margin-bottom: var(--space-2);
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-change {
  font-size: var(--font-size-xs);
  margin-top: var(--space-2);
}

.stat-change.positive {
  color: var(--success-600);
}

.stat-change.negative {
  color: var(--danger-600);
}

/* ===== ENHANCED UI COMPONENTS ===== */

/* Empty States */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
}

/* Loading skeleton */
.skeleton {
  background: var(--bg-subtle);
  border-radius: 4px;
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-row {
  height: 40px;
  margin-bottom: 8px;
  background: var(--bg-subtle);
  border-radius: 4px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Error states */
.error-message {
  color: var(--danger);
  font-size: 14px;
  text-align: center;
  padding: 16px;
}

.retry-button {
  background: var(--danger);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  margin-top: 8px;
}

.retry-button:hover {
  background: color-mix(in oklab, var(--danger) 80%, black);
}

/* Pagination */
.pagination {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  margin-top: 20px;
}

.pagination button {
  height: 32px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  background: var(--bg-panel);
  color: var(--text);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pagination button:hover:not(:disabled) {
  background: var(--bg-subtle);
  border-color: var(--border-hover);
}

.pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination button.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.empty-state-icon {
  font-size: 48px;
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.empty-state-text {
  font-size: 16px;
  margin-bottom: var(--space-2);
  color: var(--text-muted);
}

.empty-state-description {
  font-size: 14px;
  color: var(--text-subtle);
}

/* Loading Skeletons */
.skeleton {
  background: var(--bg-subtle);
  border-radius: 4px;
  animation: skeleton-loading 1.5s ease-in-out infinite;
}

.skeleton-text {
  height: 16px;
  margin-bottom: 8px;
}

.skeleton-button {
  height: 36px;
  width: 120px;
}

@keyframes skeleton-loading {
  0% { opacity: 0.6; }
  50% { opacity: 0.3; }
  100% { opacity: 0.6; }
}

/* Toast Notifications */
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
  color: var(--text);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  z-index: 1000;
  max-width: 300px;
}

.toast-success {
  border-left: 4px solid var(--success);
}

.toast-error {
  border-left: 4px solid var(--danger);
}

.toast-warning {
  border-left: 4px solid var(--warning);
}

/* Enhanced Tab Styles - Consistent spacing */
.tab-button { 
  padding: var(--space-1) var(--space-2); 
  border: none; 
  background: transparent; 
  color: var(--text-secondary); 
  cursor: pointer; 
  border-bottom: 2px solid transparent; 
  margin-right: var(--space-2); 
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
  transition: all 0.2s ease;
  position: relative;
}

.tab-button:hover {
  color: var(--text);
  background: var(--hover);
}

.tab-button.active { 
  border-bottom-color: var(--primary); 
  color: var(--primary); 
  font-weight: var(--font-weight-semibold);
}

.tab-button:focus {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

/* Enhanced Form Elements - Consistent spacing */
.form-group {
  margin-bottom: var(--space-3);
}

.form-label {
  display: block;
  margin-bottom: var(--space-1);
  font-weight: var(--font-weight-medium);
  color: var(--text);
  font-size: var(--font-size-sm);
}

.form-help {
  margin-top: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}

.form-error {
  margin-top: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--danger-600);
}

/* Enhanced Badge/Tag Styles */
.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-tight);
  white-space: nowrap;
}

.badge-primary {
  background: var(--accent-100);
  color: var(--accent-700);
}

.badge-success {
  background: var(--success-50);
  color: var(--success-700);
}

.badge-warning {
  background: var(--warning-50);
  color: var(--warning-700);
}

.badge-danger {
  background: var(--danger-50);
  color: var(--danger-700);
}

/* Enhanced Dropdown Styles */
.dropdown {
  position: relative;
  display: inline-block;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  min-width: 200px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-2);
  margin-top: var(--space-1);
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: background-color 0.2s ease;
}

.dropdown-item:hover {
  background: var(--hover);
}

.dropdown-item:focus {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

/* Enhanced Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--surface);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
}

.modal-header {
  padding: var(--space-6);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--text);
  margin: 0;
}

.modal-body {
  padding: var(--space-6);
}

.modal-footer {
  padding: var(--space-6);
  border-top: 1px solid var(--border);
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}

/* Enhanced Loading States */
.loading-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-radius: 50%;
  border-top-color: var(--primary);
  animation: spin 1s ease-in-out infinite;
}

.skeleton {
  background: linear-gradient(90deg, var(--border) 25%, var(--hover) 50%, var(--border) 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: var(--radius-md);
}

/* ===== ALERTS & NOTIFICATIONS ===== */

/* Alert Base */
.alert {
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid transparent;
  margin-bottom: var(--space-4);
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.alert-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 2px;
}

.alert-content {
  flex: 1;
}

.alert-title {
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-1);
  font-size: var(--font-size-sm);
}

.alert-message {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.alert-close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.alert-close:hover {
  opacity: 1;
}

/* Alert Variants */
.alert-info {
  background: var(--accent-50);
  border-color: var(--accent-200);
  color: var(--accent-800);
}

.alert-success {
  background: var(--success-50);
  border-color: var(--success-200);
  color: var(--success-800);
}

.alert-warning {
  background: var(--warning-50);
  border-color: var(--warning-200);
  color: var(--warning-800);
}

.alert-danger {
  background: var(--danger-50);
  border-color: var(--danger-200);
  color: var(--danger-800);
}

/* Toast Notifications */
.toast-container {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 400px;
}

.toast {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-4);
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  animation: slideIn 0.3s ease-out;
  max-width: 400px;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.toast.removing {
  animation: slideOut 0.3s ease-in forwards;
}

@keyframes slideOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

.toast-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 2px;
}

.toast-content {
  flex: 1;
}

.toast-title {
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-1);
  font-size: var(--font-size-sm);
}

.toast-message {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
  color: var(--text-secondary);
}

.toast-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.toast-close:hover {
  opacity: 1;
}

/* Toast Variants */
.toast-info {
  border-left: 4px solid var(--accent-500);
}

.toast-success {
  border-left: 4px solid var(--success-500);
}

.toast-warning {
  border-left: 4px solid var(--warning-500);
}

.toast-danger {
  border-left: 4px solid var(--danger-500);
}

/* Progress Indicators */
.progress-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.progress-indicator .loading-spinner {
  width: 16px;
  height: 16px;
}

/* Status Indicators */
.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}

.status-dot.online { background: var(--success-500); }
.status-dot.offline { background: var(--danger-500); }
.status-dot.warning { background: var(--warning-500); }
.status-dot.info { background: var(--accent-500); }

/* ===== LAYOUT & RESPONSIVE STYLES ===== */

/* Container */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-4);
}

/* Grid System */
.grid {
  display: grid;
  gap: var(--space-6);
}

.grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

/* Flexbox Utilities */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.flex-row { flex-direction: row; }
.items-center { align-items: center; }
.items-start { align-items: flex-start; }
.items-end { align-items: flex-end; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.justify-start { justify-content: flex-start; }
.justify-end { justify-content: flex-end; }
.gap-1 { gap: var(--space-1); }
.gap-2 { gap: var(--space-2); }
.gap-3 { gap: var(--space-3); }
.gap-4 { gap: var(--space-4); }
.gap-6 { gap: var(--space-6); }

/* Spacing Utilities */
.p-1 { padding: var(--space-1); }
.p-2 { padding: var(--space-2); }
.p-3 { padding: var(--space-3); }
.p-4 { padding: var(--space-4); }
.p-6 { padding: var(--space-6); }
.p-8 { padding: var(--space-8); }

.m-1 { margin: var(--space-1); }
.m-2 { margin: var(--space-2); }
.m-3 { margin: var(--space-3); }
.m-4 { margin: var(--space-4); }
.m-6 { margin: var(--space-6); }
.m-8 { margin: var(--space-8); }

/* Responsive Breakpoints */
@media (max-width: 640px) {
  .container {
    padding: 0 var(--space-3);
  }
  
  .grid-cols-2,
  .grid-cols-3,
  .grid-cols-4 {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
  
  .tab-button {
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-xs);
  }
  
  .card {
    padding: var(--space-4);
  }
  
  .modal {
    margin: var(--space-4);
    max-width: calc(100vw - var(--space-8));
  }
}

@media (max-width: 768px) {
  .grid-cols-3,
  .grid-cols-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* ===== ACCESSIBILITY ENHANCEMENTS ===== */

/* Focus Management */
*:focus {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

/* Skip Links */
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: var(--primary);
  color: white;
  padding: 8px;
  text-decoration: none;
  border-radius: var(--radius-md);
  z-index: 1001;
}

.skip-link:focus {
  top: 6px;
}

/* Screen Reader Only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  :root {
    --border: var(--neutral-900);
    --border-strong: var(--neutral-900);
    --focus-ring: var(--neutral-900);
  }
  
  .btn, input, select, textarea {
    border-width: 2px;
  }
}

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Dark mode class - when toggled (EDITOR PAGE) */
.dark-theme {
  /* Use new design system variables with improved contrast */
  --bg: var(--neutral-900) !important;
  --surface: var(--neutral-800) !important;
  --surface-secondary: var(--neutral-700) !important;
  --text: var(--neutral-50) !important;
  --text-secondary: var(--neutral-200) !important;  /* Lightened for AA compliance */
  --text-muted: var(--neutral-300) !important;     /* Lightened for AA compliance */
  --border: var(--neutral-600) !important;         /* Lightened for better visibility */
  --border-strong: var(--neutral-500) !important;  /* Lightened for better visibility */
  --primary: var(--accent-400) !important;         /* Lightened for better contrast */
  --primary-hover: var(--accent-500) !important;
  --secondary: var(--neutral-300) !important;      /* Lightened for AA compliance */
  --accent: var(--accent-400) !important;
  --hover: var(--neutral-700) !important;
  --focus-ring: var(--accent-400) !important;
  
  /* Use new design system for all colors */
  --hover: var(--neutral-700) !important;
  --card: var(--neutral-800) !important;
  --input: var(--neutral-800) !important;
  --button-bg: var(--neutral-800) !important;
  --text-color: var(--neutral-50) !important;
  --border-color: var(--neutral-600) !important;
}

/* Dark mode is now the default - no theme overrides needed */

/* Dark mode is now the default - no theme overrides needed */



/* Remove all borders from filter dropdowns */
.dark-theme #groupFilter,
.dark-theme #projectFilter,
.dark-theme select[id*="Filter"],
.dark-theme select[style*="border"] {
  border: none !important;
  border-color: transparent !important;
  outline: none !important;
}

/* Remove borders from any select elements in the sidebar */
.dark-theme .groups-projects-sidebar select {
  border: none !important;
  border-color: transparent !important;
  outline: none !important;
  background: transparent !important;
  background-color: transparent !important;
}

/* Force specific filter dropdowns to have no background */
.dark-theme #groupFilter,
.dark-theme #projectFilter {
  background: transparent !important;
  background-color: transparent !important;
  border: none !important;
  border-color: transparent !important;
  outline: none !important;
  box-shadow: none !important;
}

/* Target ONLY the filter dropdown buttons that have light grey outlines */
.dark-theme #groupFilter,
.dark-theme #projectFilter,
.dark-theme select[id="groupFilter"],
.dark-theme select[id="projectFilter"] {
  border: none !important;
  border-color: transparent !important;
  outline: none !important;
  box-shadow: none !important;
  background: transparent !important;
  background-color: transparent !important;
}

/* More aggressive override for filter dropdowns */
.dark-theme #groupFilter,
.dark-theme #projectFilter {
  border: 0 !important;
  border-width: 0 !important;
  border-style: none !important;
  border-color: transparent !important;
  outline: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
  background-color: transparent !important;
}

/* Override any CSS variable borders */
.dark-theme #groupFilter,
.dark-theme #projectFilter {
  border: none !important;
  border-color: transparent !important;
}

/* Most specific override to eliminate light grey outlines */
.dark-theme select#groupFilter,
.dark-theme select#projectFilter {
  border: none !important;
  border-color: transparent !important;
  outline: none !important;
  box-shadow: none !important;
  background: transparent !important;
  background-color: transparent !important;
}

/* Override any remaining CSS variable applications */
.dark-theme select#groupFilter,
.dark-theme select#projectFilter {
  border: 0 !important;
  border-width: 0 !important;
  border-style: none !important;
  border-color: transparent !important;
}

/* Nuclear option - override everything with maximum specificity */
.dark-theme select#groupFilter,
.dark-theme select#projectFilter,
.dark-theme #groupFilter,
.dark-theme #projectFilter {
  border: none !important;
  border-color: transparent !important;
  border-width: 0 !important;
  border-style: none !important;
  outline: none !important;
  box-shadow: none !important;
  background: transparent !important;
  background-color: transparent !important;
}

/* Override any CSS variable borders with maximum force */
.dark-theme select#groupFilter,
.dark-theme select#projectFilter,
.dark-theme #groupFilter,
.dark-theme #projectFilter {
  border: 0 !important;
  border-color: transparent !important;
}

/* Target the specific CSS rule that's applying borders */
.dark-theme input, .dark-theme select, .dark-theme textarea {
  border-color: transparent !important;
}

/* Force filter dropdowns to have no borders */
.dark-theme #groupFilter,
.dark-theme #projectFilter {
  border: none !important;
  border-color: transparent !important;
  border-width: 0 !important;
  border-style: none !important;
}

/* Override the CSS variable border that's causing the light grey outline */
.dark-theme select {
  border: none !important;
  border-color: transparent !important;
}

/* More specific override to win the specificity battle */
.dark-theme input, .dark-theme select, .dark-theme textarea {
  border-color: transparent !important;
}

/* Most specific override for filter dropdowns */
.dark-theme select#groupFilter,
.dark-theme select#projectFilter {
  border: none !important;
  border-color: transparent !important;
  border-width: 0 !important;
  border-style: none !important;
}

/* Override the problematic CSS rule that's applying var(--border) */
.dark-theme select {
  border-color: transparent !important;
  border: none !important;
}

/* Target the default state of filter dropdowns specifically */
.dark-theme select#groupFilter,
.dark-theme select#projectFilter,
.dark-theme #groupFilter,
.dark-theme #projectFilter {
  border: none !important;
  border-color: transparent !important;
  border-width: 0 !important;
  border-style: none !important;
  outline: none !important;
  box-shadow: none !important;
}

/* Override any remaining CSS variable borders with maximum force */
.dark-theme select#groupFilter,
.dark-theme select#projectFilter,
.dark-theme #groupFilter,
.dark-theme #projectFilter {
  border: 0 !important;
  border-color: transparent !important;
}

/* Nuclear option - override ALL CSS variable borders with maximum specificity */
.dark-theme select#groupFilter,
.dark-theme select#projectFilter,
.dark-theme #groupFilter,
.dark-theme #projectFilter,
.dark-theme select[id="groupFilter"],
.dark-theme select[id="projectFilter"] {
  border: none !important;
  border-color: transparent !important;
  border-width: 0 !important;
  border-style: none !important;
  outline: none !important;
  box-shadow: none !important;
  background: transparent !important;
  background-color: transparent !important;
}

/* Override ALL CSS variable borders for these specific elements */
.dark-theme select#groupFilter,
.dark-theme select#projectFilter,
.dark-theme #groupFilter,
.dark-theme #projectFilter {
  border: 0 !important;
  border-color: transparent !important;
  border-width: 0 !important;
  border-style: none !important;
}

/* Most specific override for filter dropdowns only */
.dark-theme select#groupFilter,
.dark-theme select#projectFilter {
  border: none !important;
  border-color: transparent !important;
  border-width: 0 !important;
  border-style: none !important;
  outline: none !important;
  box-shadow: none !important;
}

/* Keep all other borders intact by not overriding them */

/* Make sure filter dropdowns specifically have no borders */
.dark-theme #groupFilter,
.dark-theme #projectFilter {
  border: none !important;
  border-color: transparent !important;
}

/* Ensure group rows maintain their colored left borders and backgrounds */
.dark-theme .group-row {
  border-left: 4px solid !important;
  background: rgba(79, 70, 229, 0.1) !important;
}

.dark-theme .group-row.editor {
  border-left-color: #22c55e !important;
  background: rgba(34, 197, 94, 0.1) !important;
}

.dark-theme .group-row.admin {
  border-left-color: var(--primary) !important;
  background: var(--primary-weak) !important;
}

/* Ensure unselected tabs have no grey background in dark mode */
.dark-theme .tab-button:not(.active) {
  background: transparent !important;
  background-color: transparent !important;
  border: none !important;
  color: var(--text) !important;
}

/* Ensure selected tab has teal underline and no background */
.dark-theme .tab-button.active {
  background: transparent !important;
  background-color: transparent !important;
  border-bottom: 2px solid var(--primary) !important;
  color: var(--primary) !important;
}





/* Ensure proper layout for Fraud Protection section */
.fraud-protection-section {
  width: 100% !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
  display: block !important;
}

.fraud-protection-section h3 {
  margin: 0 0 var(--space-2) 0 !important;
  font-size: var(--font-size-lg) !important;
  font-weight: var(--font-weight-semibold) !important;
  color: var(--text) !important;
  display: block !important;
}

.fraud-protection-section label {
  color: var(--text) !important;
  font-weight: var(--font-weight-medium) !important;
  display: block !important;
}

.fraud-protection-section input[type="checkbox"] {
  margin-right: var(--space-1) !important;
  display: inline-block !important;
}

.fraud-protection-section input[type="number"] {
  width: 100% !important;
  box-sizing: border-box !important;
  display: block !important;
}

.fraud-protection-section small {
  color: var(--text-secondary) !important;
  opacity: 0.8 !important;
  display: block !important;
}

.fraud-protection-section .grid {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  gap: var(--space-2) !important;
}

.dark-theme .sidebar-toggle {
  background: var(--card) !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
}

.dark-theme .sidebar-toggle:hover {
  background: var(--hover) !important;
  border-color: var(--primary) !important;
}

.dark-theme .list {
  background: var(--card) !important;
  border-color: var(--border) !important;
}

.dark-theme .table th,
.dark-theme .table td {
  color: var(--text) !important;
  border-color: var(--border) !important;
}

.dark-theme .bar {
  background: var(--border) !important;
}

/* Dark theme is now default - no overrides needed */



.dark-theme .card,
.dark-theme .container,
.dark-theme .section,
.dark-theme .panel {
  background-color: var(--card) !important;
}

/* Force dark theme on all elements - EDITOR PAGE */
.dark-theme div,
.dark-theme section,
.dark-theme article,
.dark-theme aside,
.dark-theme header,
.dark-theme footer,
.dark-theme nav {
  background-color: var(--bg) !important;
  color: var(--text) !important;
}

/* Specific overrides for common dashboard elements - EDITOR PAGE */
.dark-theme [class*="table"],
.dark-theme [class*="card"],
.dark-theme [class*="panel"],
.dark-theme [class*="section"] {
  background-color: var(--card) !important;
  color: var(--text) !important;
  border-color: var(--border) !important;
}

/* Override any inline styles that might be causing white backgrounds - EDITOR PAGE */
.dark-theme [style*="background: white"],
.dark-theme [style*="background: #fff"],
.dark-theme [style*="background: #ffffff"] {
  background-color: var(--card) !important;
}

.dark-theme [style*="color: black"],
.dark-theme [style*="color: #000"],
.dark-theme [style*="color: #000000"] {
  color: var(--text) !important;
}

/* Ensure buttons and interactive elements are visible */
.dark-theme button,
.dark-theme input,
.dark-theme select,
.dark-theme textarea {
  background-color: var(--input) !important;
  color: var(--text) !important;
  border-color: var(--border) !important;
}

body { 
  font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif; 
  margin:0; 
  padding:24px; 
  background: var(--bg) !important;
  color: var(--text) !important;
  transition: background-color 0.3s ease, color 0.3s ease;
}
.container { max-width:1200px; margin:0 auto; display:grid; grid-template-columns: 260px 260px 1fr; gap:16px; }
.card { 
  border:1px solid var(--border); 
  border-radius:14px; 
  padding:14px; 
  background: var(--card);
  color: var(--text);
}
h1 { margin:0 0 12px; color: var(--text); }
label { font-weight:600; display:block; margin-bottom:6px; color: var(--text); }
input[type="url"], input[type="text"], input[type="number"], select { 
  width:100%; 
  padding:10px; 
  border-radius:10px; 
  border:1px solid transparent; 
  background: var(--input); 
  color: var(--text); 
  box-sizing:border-box; 
}
button { padding:8px 12px; border-radius:10px; border:1px solid transparent; cursor:pointer; }
button.primary { background: var(--primary); color: white; }
button.ghost { 
  background:transparent; 
  border-color: transparent; 
  color: var(--text);
}
button.ghost.selected { 
  border-color: var(--primary) !important; 
  background: var(--hover); 
  color: var(--primary);
}
.list { display:flex; flex-direction:column; gap:6px; max-height:70vh; overflow:auto; }
.small { font-size:12px; opacity:.8; color: var(--text); }
.table { width:100%; border-collapse:collapse; margin-top:8px; }
th,td { text-align:left; padding:8px; color: var(--text); }
tr+tr td { border-top:1px solid var(--border); }
.bar { height:10px; background: var(--border); border-radius:999px; overflow:hidden }
.fill { height:100%; background:var(--success); width:0% }
.footer { display:flex; justify-content:space-between; align-items:center; margin-top:10px }
code.badge { 
  padding:2px 6px; 
  border-radius:6px; 
  border:1px solid var(--border); 
  background: var(--hover);
  color: var(--text);
}
.error { color:var(--danger) }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
a.tab { margin-right:8px; color: var(--text); }
.headerrow { display:flex; justify-content:space-between; align-items:center; gap:8px; }

/* Theme toggle styles */
.theme-toggle {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 2px solid var(--primary);
  background: var(--primary);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: all 0.3s ease;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.theme-toggle:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
}

.theme-toggle.dark {
  background: var(--primary);
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

/* Dark theme specific toggle button styling */
.dark-theme .theme-toggle {
  background: var(--primary) !important;
  border-color: var(--primary) !important;
  color: white !important;
}

/* Theme styles are now handled by CSS variables */

/* Tab styles - Underline style, no pill backgrounds */
.tab-button { 
  padding: 12px 8px; 
  border: none; 
  background: transparent !important; 
  color: var(--text-muted); 
  cursor: pointer; 
  border-bottom: 2px solid transparent; 
  margin-right: 8px; 
  border-radius: 0;
  transition: all 0.2s ease;
  font-size: 14px;
  font-weight: 500;
}
.tab-button:hover { 
  color: var(--text);
  border-bottom-color: var(--border-hover);
}
.tab-button.active { 
  border-bottom-color: var(--primary); 
  color: var(--text); 
  background: transparent !important;
  font-weight: 600;
}
/* Tab content visibility - removed duplicate rule */

/* Hide projects when no group selected */
.hide-until-group-selected {
  display: none !important;
}

/* Sidebar toggle */
.sidebar-toggle {
  position: fixed;
  top: 70px;
  right: 16px;
  background: var(--button-bg);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 14px;
  cursor: pointer;
  z-index: 1000;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.sidebar-toggle:hover {
  background: var(--button-hover-bg);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

/* Hide sidebar when collapsed */
.sidebar-collapsed .groups-projects-sidebar {
  display: none !important;
}

.sidebar-collapsed .main-content {
  margin-left: 0 !important;
}

/* Table styling for users and teams */
#usersList, #teamsList {
  background: var(--bg-panel) !important;
  color: var(--text) !important;
}

/* Table selection - rounded ring instead of solid fill */
tr.is-selected, tr[aria-selected="true"] {
  position: relative;
  background: color-mix(in oklab, var(--primary) 7%, transparent);
}
tr.is-selected::after, tr[aria-selected="true"]::after {
  content: "";
  position: absolute;
  inset: -2px;
  border: 2px solid var(--focus-ring);
  border-radius: 8px;
  pointer-events: none;
}

/* Table header - sticky with shadow */
.table thead {
  position: sticky;
  top: 0;
  background: var(--bg-subtle);
  box-shadow: 0 1px 0 var(--border);
  z-index: 10;
}

#usersList tr, #teamsList tr {
  border-bottom: 1px solid var(--border);
}

#usersList tr:hover, #teamsList tr:hover {
  background: var(--bg-subtle);
}

#usersList td, #teamsList td {
  padding: 12px 14px;
  color: inherit;
}

/* Table cell density and alignment */
.table td {
  padding: 12px 14px;
  vertical-align: middle;
}

/* Actions column - flex layout for icons */
.table .actions-column {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
}

.table .actions-column button,
.table .actions-column .action-icon {
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.table .actions-column button:hover,
.table .actions-column .action-icon:hover {
  opacity: 1;
}

/* Long URLs - single line with ellipsis */
.table .url-cell {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table .url-cell[title] {
  cursor: help;
}

#usersList .badge, #teamsList .badge {
  color: white !important;
}

/* Smart Link Row - URL Truncation & Copy Feedback */
.smart-link-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  margin-bottom: 8px;
}

.smart-link-url {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-family: monospace;
  font-size: 14px;
}

.smart-link-url[title] {
  cursor: help;
}

.copy-button {
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 6px 10px;
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
  white-space: nowrap;
}

.copy-button:hover {
  background: var(--border-hover);
  border-color: var(--border-hover);
}

.copy-button.copied {
  background: var(--success);
  color: white;
  border-color: var(--success);
}

.copy-button.copied::after {
  content: ' ✓';
  font-weight: bold;
}

/* ===== Editor Page: Projects list — remove halos/rings and unify selection ===== */
#projList .ui-list-rows button,
#projList .ui-list-rows .project-item,
#projList .ui-list-rows [data-role="project-item"] {
  background: var(--bg-panel) !important;
  background-image: none !important;
  box-shadow: none !important;
  outline: none !important;
  filter: none !important;                 /* safety for theme filters */
  border-image: none !important;           /* safety for fancy borders */
  background-clip: border-box !important;  /* avoid weird clipping tints */
}

/* Hover: no color-mix glow or purple tint */
#projList .ui-list-rows button:hover,
#projList .ui-list-rows .project-item:hover,
#projList .ui-list-rows [data-role="project-item"]:hover {
  background: var(--bg-panel) !important;
  background-image: none !important;
  box-shadow: none !important;
  border-bottom-color: var(--border-hover) !important;
}

/* Focus/Active: kill focus rings/blue outline/circles */
#projList .ui-list-rows button:focus,
#projList .ui-list-rows button:focus-visible,
#projList .ui-list-rows button:active {
  outline: none !important;
  box-shadow: none !important;
  background: var(--bg-panel) !important;
}

/* Selected: same look as Groups, WITHOUT halo */
#projList .ui-list-rows button.selected,
#projList .ui-list-rows .project-item.selected,
#projList .ui-list-rows [data-role="project-item"].selected,
#projList .ui-list-rows .list-item.selected button {
  background: var(--primary-weak) !important;   /* solid indigo fill */
  border-left: 4px solid var(--primary) !important;
  box-shadow: none !important;
}

/* Remove any ring/halo drawn with pseudo-elements */
#projList .ui-list-rows button::before,
#projList .ui-list-rows button::after,
#projList .ui-list-rows .project-item::before,
#projList .ui-list-rows .project-item::after,
#projList .ui-list-rows [data-role="project-item"]::before,
#projList .ui-list-rows [data-role="project-item"]::after {
  content: none !important;
}

/* Some global themes add ::after for .selected — block it on Editor page */
#projList .ui-list-rows button.selected::after,
#projList .ui-list-rows .project-item.selected::after {
  content: none !important;
}

/* If there is a global hover glow: scope it away from Editor Projects */
.ui-list-rows button:hover { /* keep global default for other pages */ }
#projList .ui-list-rows button:hover {
  background: var(--bg-panel) !important;
}
</style>
</head>
<body class="editor-page">
  <div style="max-width:1400px; margin:0 auto; display:flex; justify-content:space-between; align-items:center; gap:12px;">
    <h1>BAM Splitter 1.0</h1>
    <div style="display: flex; align-items: center; gap: 16px;">
    <div>
      <a class="tab" href="/">Editor</a>
      <a class="tab" href="/analytics" target="_blank" rel="noopener">Analytics</a>
      <a class="tab" id="usersTab" href="#" style="display: none;">Users</a>
      <a class="tab" id="teamsTab" href="#" style="display: none;">Teams</a>
    </div>
      <div style="display: flex; align-items: center; gap: 8px; font-size: 14px;">
        <span id="currentUserInfo" style="opacity: 0.8;"></span>
        <button id="logoutBtn" class="btn btn-secondary ghost" type="button" style="padding: 4px 8px; font-size: 12px; display: none;">Logout</button>
  </div>
    </div>
  </div>
  
  <!-- Dark mode is now the default - no theme switching needed -->
  
  <!-- Sidebar Toggle Button -->
  <button id="sidebarToggle" class="sidebar-toggle" onclick="toggleSidebar()" title="Hide/show groups and projects sidebar">
    ◀
  </button>
  

  
  <div class="container" style="margin-top:12px; display:flex; gap:16px;">
    <!-- Groups and Projects Sidebar -->
    <div class="groups-projects-sidebar" style="width:280px; flex-shrink:0;">
    <div class="card">
      <div class="headerrow">
        <strong>Groups</strong>
        <div style="display:flex; gap:6px;">
          <button id="allGroups" class="btn btn-secondary ghost" type="button">All Projects</button>
          <button id="newGroup" class="btn btn-primary primary" type="button">+ New</button>
        </div>
        </div>

      <!-- Filter and Pagination Controls -->
      <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="font-size: 12px; margin: 0;">Filter:</label>
          <select id="groupFilter" style="font-size: 12px; padding: 8px 12px; border-radius: 6px; background: var(--bg-subtle); color: var(--text); border: 1px solid var(--border);">
            <option value="all">All Groups</option>
            <option value="admin">Admin Groups</option>
            <option value="editor">Editor Groups</option>
          </select>
      </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <button id="prevPage" class="btn btn-icon ghost" type="button">←</button>
          <span id="pageInfo" style="font-size: 12px; opacity: 0.7;">Page 1</span>
          <button id="nextPage" class="btn btn-icon ghost" type="button">→</button>
        </div>
      </div>
      
      <div id="groupList" class="list ui-list-rows" style="margin-top:8px;"></div>
    </div>

      <div class="card" id="projectsCard">
      <div class="headerrow">
        <strong id="projectsHeader">Projects</strong>
        <div style="display:flex; gap:6px;">
          <button id="duplicateProj" class="btn btn-secondary ghost" type="button" title="Duplicate selected project">📋 Duplicate</button>
        <button id="newProj" class="btn btn-primary primary" type="button">+ New</button>
      </div>
      </div>
      
      <!-- Project Filter and Pagination Controls -->
      <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="font-size: 12px; margin: 0;">Filter:</label>
          <select id="projectFilter" style="font-size: 12px; padding: 8px 12px; border-radius: 6px; background: var(--bg-subtle); color: var(--text); border: 1px solid var(--border);">
            <option value="all">All Projects</option>
            <option value="admin">Admin Projects</option>
            <option value="editor">Editor Projects</option>
          </select>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <button id="prevProjectPage" class="btn btn-icon ghost" type="button">←</button>
          <span id="projectPageInfo" style="font-size: 12px; opacity: 0.7;">Page 1</span>
          <button id="nextProjectPage" class="btn btn-icon ghost" type="button" style="padding: 4px 8px; font-size: 12px;">→</button>
        </div>
      </div>
      
      <div id="projList" class="list ui-list-rows" style="margin-top:12px;"></div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="main-content" style="flex:1; margin-left:0;">
      <div class="card" id="projectEditorCard">
      <div style="display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; margin-bottom:8px;">
        <div style="min-width:220px; flex:1">
          <label for="projName">Project name</label>
          <input id="projName" type="text" placeholder="Project name"/>
        </div>
        <div style="min-width:220px; width:260px">
          <label for="projGroup">Project group</label>
          <select id="projGroup"></select>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button id="save" class="btn btn-primary primary" type="button">Save</button>
          <button id="delete" class="btn btn-danger ghost" type="button">Delete</button>
          <span id="msg" class="small"></span>
        </div>
      </div>

      <label for="main">Main link (the URL you share)</label>
      <input id="main" type="url" placeholder="https://google.com"/>

      <div style="margin-top: 16px;">
        <label for="safeLink">Safe Link (fallback URL)</label>
        <input id="safeLink" type="url" placeholder="https://example.com/fallback" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--input); color: var(--text); box-sizing: border-box;"/>
        <small style="display: block; margin-top: 4px; opacity: 0.7;">Used when targeting rules don't match</small>
      </div>



      <div style="margin:10px 0 0; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        Shareable smart link:
        <span class="mono"><a id="smart" href="#" target="_blank" rel="noopener">(select a project)</a></span>
        <button id="copySmart" class="btn btn-secondary ghost" type="button">Copy</button>
      </div>

      <!-- Tabs for different sections -->
      <div style="margin-top: 16px; border-bottom: 1px solid var(--border);">
        <button id="linksTab" class="tab-button active" type="button">Links</button>
        <button id="targetingTab" class="tab-button" type="button">Targeting</button>
        <button id="abTestingTab" class="tab-button" type="button">A/B Testing</button>
        <button id="bulkLinksTab" class="tab-button" type="button">Bulk Links</button>
        <button id="advancedSettingsTab" class="tab-button" type="button">Advanced Settings</button>
        <button id="userManagementTab" class="tab-button" type="button" style="margin-left: auto; background: var(--primary); color: white;">👥 Users</button>
        <button id="toggleUsersTab" class="btn btn-icon ghost" type="button" style="margin-left: 8px; padding: 4px 8px; font-size: 12px;" title="Hide/Show Users Tab">⚙️</button>
      </div>

      <!-- Links Tab -->
      <div id="linksContent" class="tab-content active">
        <div style="margin-top:16px; display:flex; gap:8px; align-items:center;">
          <div style="flex:1">
            <div class="bar"><div id="fill" class="fill"></div></div>
            <div id="sumLabel" class="small" style="margin-top:6px">Total: 0%</div>
          </div>
          <button id="addRow" class="btn btn-secondary ghost" type="button">+ Add row</button>
        </div>

        <table class="table">
            <thead><tr><th style="width:35%">Sublink URL</th><th style="width:18%">Label (optional)</th><th style="width:15%">Weight (%)</th><th style="width:15%">Safe Link</th><th style="width:17%">Actions</th></tr></thead>
          <tbody id="tbody"></tbody>
        </table>

        <!-- Fraud Protection Section -->
        <div class="fraud-protection-section" style="margin-top: var(--space-2); padding: var(--space-2); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--hover);">
          <h3 style="margin: 0 0 var(--space-2) 0; font-size: var(--font-size-lg); color: var(--text); font-weight: var(--font-weight-semibold);">Fraud Protection</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);">
            <div>
              <label style="display: block; margin-bottom: var(--space-1); font-weight: var(--font-weight-medium); color: var(--text);">Protection Settings</label>
              <div style="margin-top: var(--space-1);">
                <label style="display: flex; align-items: center; margin-bottom: var(--space-1); font-weight: normal; color: var(--text);">
                  <input id="fraudProtectionEnabled" type="checkbox" style="margin-right: var(--space-1);"/>
                  Enable fraud protection
                </label>
                <label style="display: flex; align-items: center; margin-bottom: var(--space-1); font-weight: normal; color: var(--text);">
                  <input id="blockBots" type="checkbox" style="margin-right: var(--space-1);"/>
                  Block bots and crawlers
                </label>
              </div>
            </div>
            <div>
              <label style="display: flex; align-items: center; margin-bottom: var(--space-1); font-weight: normal; color: var(--text);">
                <input id="enableClickLimit" type="checkbox" style="margin-right: var(--space-1);"/>
                Enable click limit
              </label>
              <label for="clicksLimit" style="display: block; margin-bottom: var(--space-1); font-weight: var(--font-weight-medium); color: var(--text);">Click Limit</label>
              <input id="clicksLimit" type="number" min="1" placeholder="1000" disabled style="width: 100%; padding: var(--space-1); border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--input); color: var(--text); box-sizing: border-box; opacity: 0.5;"/>
              <small style="display: block; margin-top: var(--space-1); opacity: 0.7; color: var(--text-secondary);">Maximum clicks before link becomes inactive</small>
            </div>
          </div>
        </div>
      </div>

      <!-- Targeting Tab -->
      <div id="targetingContent" class="tab-content">
        <div style="margin-top: 8px;">
          <h4 style="margin: 0 0 12px 0; font-size: 18px; font-weight: var(--font-weight-semibold); color: var(--text);">Global Targeting Rules</h4>
          <p style="margin: 8px 0; font-size: 15px; color: var(--text-muted);">These rules apply to all links in this project</p>
          <div id="globalTargetingRules"></div>
          <button id="addGlobalRule" class="btn btn-secondary ghost" type="button" style="margin-top: 12px;">+ Add Global Rule</button>
        </div>
        
        <div style="margin-top: 24px;">
          <h4 style="margin: 0 0 12px 0; font-size: 18px; font-weight: var(--font-weight-semibold); color: var(--text);">Link-Specific Targeting</h4>
          <p style="margin: 8px 0; font-size: 15px; color: var(--text-muted);">Targeting rules for individual links (configured in the Links tab)</p>
        </div>
      </div>

      <!-- A/B Testing Tab -->
      <div id="abTestingContent" class="tab-content">
        <div style="margin-top: 16px;">
          <label>
            <input type="checkbox" id="enableABTesting" style="margin-right: 8px;"/>
            Enable A/B Testing
          </label>
          
          <div id="abTestingSettings" style="margin-top: 16px; display: none;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
              <div>
                <label for="testType">Test Type</label>
                <select id="testType">
                  <option value="split">A/B Split Test</option>
                  <option value="multivariate">Multivariate Test</option>
                  <option value="sequential">Sequential Test</option>
                </select>
              </div>
              <div>
                <label for="goal">Primary Goal</label>
                <select id="goal">
                  <option value="conversion">Conversion Rate</option>
                  <option value="revenue">Revenue</option>
                  <option value="engagement">Engagement</option>
                  <option value="custom">Custom Metric</option>
                </select>
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
              <div>
                <label for="confidenceLevel">Confidence Level (%)</label>
                <input id="confidenceLevel" type="number" min="80" max="99" value="95"/>
              </div>
              <div>
                <label for="minSampleSize">Minimum Sample Size</label>
                <input id="minSampleSize" type="number" min="100" value="1000"/>
              </div>
            </div>
            
            <div>
              <label for="hypothesis">Test Hypothesis</label>
              <textarea id="hypothesis" placeholder="Describe what you're testing and why..." style="width: 100%; min-height: 80px; padding: 10px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-subtle); color: var(--text); box-sizing: border-box; resize: vertical;"></textarea>
            </div>
            
            <!-- A/B Testing Results Display -->
            <div id="abTestingResults" class="ab-testing-section" style="margin-top: 24px; padding: 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--hover);">
              <h4 style="margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: var(--font-weight-semibold); color: var(--text);">
                <span style="font-size: 18px;">📊</span> A/B Testing Results
                <button id="refreshABResults" class="btn btn-secondary ghost" type="button" style="margin-left: auto; font-size: 12px;">🔄 Refresh</button>
              </h4>
              
              <div id="abResultsContent" style="display: none;">
                <div style="margin-bottom: 16px;">
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px;">
                    <div class="badge" style="background: var(--success); color: white; text-align: center;">
                      Total Tests<br><strong id="abTotalTests">0</strong>
                    </div>
                    <div class="badge" style="background: var(--primary); color: white; text-align: center;">
                      Significant Results<br><strong id="abSignificantResults">0</strong>
                    </div>
                    <div class="badge" style="background: var(--warning); color: var(--text); text-align: center;">
                      Best Variant<br><strong id="abBestVariant">-</strong>
                    </div>
                    <div class="badge" style="background: var(--danger); color: white; text-align: center;">
                      Confidence<br><strong id="abConfidence">-</strong>
                    </div>
                  </div>
                </div>
                
                <div id="abResultsTable" style="overflow-x: auto;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <thead>
                                              <tr style="border-bottom: 2px solid var(--border);">
                        <th style="text-align: left; padding: 12px 8px;">Variant</th>
                        <th style="text-align: center; padding: 12px 8px;">Clicks</th>
                        <th style="text-align: center; padding: 12px 8px;">Conv. Rate</th>
                        <th style="text-align: center; padding: 12px 8px;">Lift</th>
                        <th style="text-align: center; padding: 12px 8px;">Confidence</th>
                        <th style="text-align: center; padding: 12px 8px;">Significant</th>
                      </tr>
                    </thead>
                    <tbody id="abResultsTableBody">
                      <!-- Results will be populated here -->
                    </tbody>
                  </table>
                </div>
                
                <div style="margin-top: 16px; padding: 12px; background: var(--bg-subtle); border-radius: 6px; font-size: 12px;">
                  <strong>Statistical Notes:</strong> Results are calculated using Z-test for proportions. 
                  A result is considered statistically significant when p-value < 0.05 (95% confidence level). 
                  Lift shows the percentage improvement over the control variant.
                </div>
              </div>
              
              <div id="abNoResults" style="text-align: center; padding: 20px; opacity: 0.7;">
                <span style="font-size: 24px;">📊</span>
                <p>No A/B testing data available yet.</p>
                <p style="font-size: 12px;">Start your test and collect some data to see statistical results.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bulk Links Tab -->
      <div id="bulkLinksContent" class="tab-content">
        <div style="margin-top: 8px;">
          <h4>Bulk Link Groups</h4>
          <p style="margin: 8px 0; font-size: 15px; color: var(--text-muted);">Create groups of links with shared targeting and weights</p>
          
          <div id="bulkLinksList"></div>
          
          <div style="margin-top: 16px; padding: 16px; border: 1px solid var(--border); border-radius: 10px;">
            <h5 style="margin: 0 0 16px 0; font-size: 16px; font-weight: var(--font-weight-medium); color: var(--text);">Create New Bulk Link Group</h5>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
              <div>
                <label for="bulkLinkName">Group Name</label>
                <input id="bulkLinkName" type="text" placeholder="e.g., Product Pages"/>
              </div>
              <div>
                <label for="bulkLinkUrls">URLs (one per line)</label>
                <textarea id="bulkLinkUrls" placeholder="https://example.com/page1&#10;https://example.com/page2&#10;https://example.com/page3" style="width: 100%; min-height: 80px; padding: 10px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-subtle); color: var(--text); box-sizing: border-box; resize: vertical;"></textarea>
              </div>
            </div>
            <button id="createBulkLink" class="primary" type="button">Create Bulk Link Group</button>
          </div>
        </div>
      </div>

      <!-- Advanced Settings Tab -->
      <div id="advancedSettingsContent" class="tab-content">
        <div class="advanced-settings-section" style="margin-top: 16px; padding: 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--hover);">
          <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: var(--font-weight-semibold); color: var(--text);">Advanced Settings</h3>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div>
              <label for="customAlias">Custom Short URL</label>
              <input id="customAlias" type="text" placeholder="summer-sale" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-subtle); color: var(--text); box-sizing: border-box;"/>
              <small style="display: block; margin-top: 4px; opacity: 0.7;">Creates /go/summer-sale (letters, numbers, hyphens only)</small>
            </div>
            <div>
              <label for="expirationDate">Link Expiration</label>
              <input id="expirationDate" type="datetime-local" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-subtle); color: var(--text); box-sizing: border-box;"/>
              <small style="display: block; margin-top: 4px; opacity: 0.7;">Link becomes inactive after this date/time</small>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div>
              <label for="customDomain">Custom Domain</label>
              <input id="customDomain" type="text" placeholder="mydomain.com" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-subtle); color: var(--text); box-sizing: border-box;"/>
              <small style="display: block; margin-top: 4px; opacity: 0.7;">Override hostname for all links</small>
              <details style="margin-top: 6px;">
                <summary style="font-size: 11px; cursor: pointer; opacity: 0.8; user-select: none;">Setup instructions</summary>
                <div style="font-size: 11px; margin-top: 4px; line-height: 1.4; padding: 6px; background: var(--bg-subtle); border-radius: 4px;">
                  1. Create a CNAME record: <code style="background: var(--bg-subtle); padding: 1px 3px; border-radius: 2px;">your-domain.com → bam-split.com</code><br/>
                  2. Or use A record: <code style="background: var(--bg-subtle); padding: 1px 3px; border-radius: 2px;">your-domain.com → [CF IP]</code><br/>
                  3. Add domain to Cloudflare and set up SSL certificate<br/>
                  4. May take 5-10 minutes to propagate globally
                </div>
              </details>
            </div>
            <div>
              <label for="tiktokPixel">TikTok Pixel ID</label>
              <input id="tiktokPixel" type="text" placeholder="YOUR_PIXEL_ID" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-subtle); color: var(--text); box-sizing: border-box;"/>
              <small style="display: block; margin-top: 4px; opacity: 0.7;">For conversion tracking</small>
              <details style="margin-top: 6px;">
                <summary style="font-size: 11px; cursor: pointer; opacity: 0.8; user-select: none;">Setup instructions</summary>
                <div style="font-size: 11px; margin-top: 4px; line-height: 1.4; padding: 6px; background: var(--bg-subtle); border-radius: 4px;">
                  1. Go to <strong>TikTok Ads Manager</strong> → Events<br/>
                  2. Click <strong>Manage</strong> → Web Events → Pixel<br/>
                  3. Create new pixel or copy existing Pixel ID<br/>
                  4. Format: <code style="background: var(--bg-subtle); padding: 1px 3px; border-radius: 2px;">C9A1B2C3D4E5F6G7H8I9J0</code><br/>
                  5. Pixel will track clicks and conversions automatically
                </div>
              </details>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div>
              <label for="facebookPixel">Facebook Pixel ID</label>
              <input id="facebookPixel" type="text" placeholder="YOUR_PIXEL_ID" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-subtle); color: var(--text); box-sizing: border-box;"/>
              <small style="display: block; margin-top: 4px; opacity: 0.7;">For conversion tracking</small>
              <details style="margin-top: 6px;">
                <summary style="font-size: 11px; cursor: pointer; opacity: 0.8; user-select: none;">Setup instructions</summary>
                <div style="font-size: 11px; margin-top: 4px; line-height: 1.4; padding: 6px; background: var(--bg-subtle); border-radius: 4px;">
                  1. Go to <strong>Facebook Business Manager</strong> → Events Manager<br/>
                  2. Select your pixel or click <strong>Create Pixel</strong><br/>
                  3. Copy the Pixel ID from pixel details<br/>
                  4. Format: <code style="background: var(--bg-subtle); padding: 1px 3px; border-radius: 2px;">123456789012345</code> (15 digits)<br/>
                  5. Pixel will track PageView and Purchase events
                </div>
              </details>
            </div>
            <div>
              <label>Conversion Tracking</label>
              <div style="margin-top: 8px;">
                <label style="display: flex; align-items: center; margin-bottom: 8px; font-weight: normal;">
                  <input id="enableConversionTracking" type="checkbox" style="margin-right: 8px;"/>
                  Enable conversion tracking
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- User Management Tab -->
      <div id="userManagementContent" class="tab-content">
        <div style="margin-top: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 18px;">👥 User Management</h3>
            <div style="display: flex; gap: 8px;">
              <button id="addUserBtn" class="btn btn-primary primary" type="button">+ Add User</button>
              <button id="closeUsersTab" class="btn btn-icon ghost" type="button" style="padding: 4px 8px; font-size: 12px;" title="Close Users Tab">✕</button>
            </div>
          </div>
          
          <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-subtle); border-radius: 8px; border-left: 4px solid var(--primary);">
            <strong>Role Permissions:</strong><br>
            <div style="margin-top: 8px; font-size: 14px; line-height: 1.4;">
              <strong>Admin:</strong> Full access - manage users, settings, and all projects<br>
              <strong>Editor:</strong> Create and edit projects, view analytics (no user management)<br>
              <strong>Viewer:</strong> View-only access to projects and analytics
            </div>
          </div>
          
          <div id="usersList" style="background: var(--bg-panel); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 16px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr 100px 100px auto; gap: 12px; font-weight: 600; padding: 8px; border-bottom: 1px solid var(--border); margin-bottom: 12px; color: inherit;">
              <div>Name</div>
              <div>Email</div>
              <div>Role</div>
              <div>Status</div>
              <div>Actions</div>
            </div>
            <div id="usersTableBody">
              <!-- Users will be loaded here -->
            </div>
          </div>
          
          <!-- Add User Modal (initially hidden) -->
          <div id="addUserModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;">
            <div class="modal-content" style="background: var(--bg-panel); color: var(--text); padding: 24px; border-radius: 12px; width: 90%; max-width: 500px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); border: 1px solid var(--border);">
              <h3 style="margin: 0 0 16px 0; color: inherit;">Add New User</h3>
              
              <div style="margin-bottom: 16px;">
                <label for="newUserName" style="color: inherit;">Full Name</label>
                <input id="newUserName" type="text" placeholder="John Doe" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-subtle); color: var(--text); box-sizing: border-box;"/>
              </div>
              
              <div style="margin-bottom: 16px;">
                <label for="newUserEmail" style="color: inherit;">Email Address</label>
                <input id="newUserEmail" type="email" placeholder="john@example.com" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-subtle); color: var(--text); box-sizing: border-box;"/>
              </div>
              
              <div style="margin-bottom: 16px;">
                <label for="newUserPassword" style="color: inherit;">Password</label>
                <input id="newUserPassword" type="password" placeholder="Enter password (min 6 characters)" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-subtle); color: var(--text); box-sizing: border-box;"/>
              </div>
              
              <div style="margin-bottom: 24px;">
                <label for="newUserRole" style="color: inherit;">Role</label>
                <select id="newUserRole" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-subtle); color: var(--text); box-sizing: border-box;">
                  <option value="viewer">Viewer - View-only access</option>
                  <option value="editor">Editor - Create and edit projects</option>
                  <option value="admin">Admin - Full access</option>
                </select>
              </div>
              
              <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="cancelAddUser" class="btn btn-secondary ghost" type="button">Cancel</button>
                <button id="saveNewUser" class="btn btn-primary primary" type="button">Add User</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Team Workspaces Tab -->
      <div id="teamWorkspacesContent" class="tab-content">
        <div style="margin-top: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 18px;">🏢 Team Workspaces</h3>
            <button id="createTeamBtn" class="primary" type="button">+ Create Team</button>
          </div>
          
          <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-subtle); border-radius: 8px; border-left: 4px solid var(--primary);">
            <strong>Team Benefits:</strong><br>
            <div style="margin-top: 8px; font-size: 14px; line-height: 1.4;">
              <strong>• Isolated Projects:</strong> Separate project environments for different teams<br>
              <strong>• Role-Based Access:</strong> Team-specific permissions and member management<br>
              <strong>• Shared Resources:</strong> Common groups and settings within teams<br>
              <strong>• Collaboration:</strong> Multiple users working on team projects
            </div>
          </div>
          
          <div id="teamsList" style="background: var(--bg-panel); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 16px;">
                          <div style="display: grid; grid-template-columns: 1fr 1fr 80px 100px auto; gap: 12px; font-weight: 600; padding: 8px; border-bottom: 1px solid var(--border); margin-bottom: 12px; color: inherit;">
              <div>Team Name</div>
              <div>Description</div>
              <div>Members</div>
              <div>Status</div>
              <div>Actions</div>
            </div>
            <div id="teamsTableBody">
              <!-- Teams will be loaded here -->
            </div>
          </div>
          
          <!-- Create Team Modal (initially hidden) -->
          <div id="createTeamModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;">
            <div class="modal-content" style="background: var(--bg-panel); color: var(--text); padding: 24px; border-radius: 12px; width: 90%; max-width: 500px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); border: 1px solid var(--border);">
              <h3 style="margin: 0 0 16px 0; color: inherit;">Create New Team</h3>
              
              <div style="margin-bottom: 16px;">
                <label for="newTeamName" style="color: inherit;">Team Name</label>
                <input id="newTeamName" type="text" placeholder="Marketing Team" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-subtle); color: var(--text); box-sizing: border-box;"/>
              </div>
              
              <div style="margin-bottom: 24px;">
                <label for="newTeamDescription" style="color: inherit;">Description (Optional)</label>
                <textarea id="newTeamDescription" placeholder="Describe your team's purpose and focus areas..." style="width: 100%; min-height: 80px; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-subtle); color: var(--text); box-sizing: border-box; resize: vertical;"></textarea>
              </div>
              
              <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="cancelCreateTeam" class="btn btn-secondary ghost" type="button">Cancel</button>
                <button id="saveNewTeam" class="btn btn-primary primary" type="button">Create Team</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="footer" style="margin-top: 16px;">
        <div>Try now: <code class="badge"><a id="try" href="#" target="_blank" rel="noopener">/go/&lt;id&gt;</a></code></div>
        <div><button id="reset" class="btn btn-secondary ghost" type="button">Reset example</button></div>
      </div>
      </div> <!-- End projectEditorCard -->
    </div> <!-- End main-content -->
  </div> <!-- End container -->

<script>
// Injected from Wrangler [vars]
window.BASE_URL = "${base}";

const tbody = document.getElementById('tbody');
const fill  = document.getElementById('fill');
const sumLabel = document.getElementById('sumLabel');
const msg = document.getElementById('msg');
const groupList = document.getElementById('groupList');
const newGroupBtn = document.getElementById('newGroup');
const allGroupsBtn = document.getElementById('allGroups');
const projList = document.getElementById('projList');
const projectsHeader = document.getElementById('projectsHeader');
const newProjBtn = document.getElementById('newProj');
const duplicateProjBtn = document.getElementById('duplicateProj');
const duplicateProjAnalyticsBtn = document.getElementById('duplicateProjAnalytics');
const projName = document.getElementById('projName');
const projGroup = document.getElementById('projGroup');
const mainInput = document.getElementById('main');
const smart = document.getElementById('smart');
const tryA = document.getElementById('try');
const copyBtn = document.getElementById('copySmart');
const delBtn = document.getElementById('delete');
const enableClickLimit = document.getElementById('enableClickLimit');
const clicksLimit = document.getElementById('clicksLimit');

let currentGroup = localStorage.getItem('ls.currentGroup') || null; // null = All Projects
let currentId = getCurrentEditorProject() || null;
let autosaveTimer = null;
let cacheGroups = [];

// Filter and pagination variables
let currentGroupFilter = 'all';
let currentProjectFilter = 'all';
let currentGroupPage = 1;
let currentProjectPage = 1;
const itemsPerPage = 8;

// Check if this is a fresh login session (no recent activity)
const lastActivity = localStorage.getItem('ls.lastActivity');
const now = Date.now();
const isFreshSession = !lastActivity || (now - parseInt(lastActivity)) > 24 * 60 * 60 * 1000; // 24 hours

// Clear stored state on fresh login to prevent auto-opening projects
if (isFreshSession) {
  localStorage.removeItem('ls.currentGroup');
  localStorage.removeItem('ls.currentId');
  currentGroup = null;
  currentId = null;
  setCurrentEditorProject(null);
  console.log('Fresh session detected - cleared stored group/project selection');
}

// Update last activity timestamp
localStorage.setItem('ls.lastActivity', now.toString());

// Function to update last activity (called on user interactions)
function updateLastActivity() {
  localStorage.setItem('ls.lastActivity', Date.now().toString());
}

// Theme management
// Dark mode is now the default - no theme switching needed

// Dark mode is now the default - no theme switching needed

// Sidebar toggle functionality
let isSidebarCollapsed = localStorage.getItem('ls.sidebarCollapsed') === 'true';

function toggleSidebar() {
  isSidebarCollapsed = !isSidebarCollapsed;
  localStorage.setItem('ls.sidebarCollapsed', isSidebarCollapsed);
  
  if (isSidebarCollapsed) {
    document.body.classList.add('sidebar-collapsed');
    document.getElementById('sidebarToggle').textContent = '▶';
    document.getElementById('sidebarToggle').title = 'Show groups and projects sidebar';
  } else {
    document.body.classList.remove('sidebar-collapsed');
    document.getElementById('sidebarToggle').textContent = '◀';
    document.getElementById('sidebarToggle').title = 'Hide groups and projects sidebar';
  }
}

// Initialize sidebar state on page load
document.addEventListener('DOMContentLoaded', function() {
  if (isSidebarCollapsed) {
    document.body.classList.add('sidebar-collapsed');
    document.getElementById('sidebarToggle').textContent = '▶';
    document.getElementById('sidebarToggle').title = 'Show groups and projects sidebar';
  }
});

// Click limit toggle functionality
function setupClickLimitToggle() {
  const enableClickLimitEl = document.getElementById('enableClickLimit');
  const clicksLimitEl = document.getElementById('clicksLimit');
  
  if (enableClickLimitEl && clicksLimitEl) {
    // Remove any existing event listeners to avoid duplicates
    enableClickLimitEl.removeEventListener('change', handleClickLimitToggle);
    enableClickLimitEl.addEventListener('change', handleClickLimitToggle);
    console.log('Click limit toggle event listener added');
  } else {
    console.log('Click limit elements not found:', { enableClickLimit: !!enableClickLimitEl, clicksLimit: !!clicksLimitEl });
  }
}

function handleClickLimitToggle() {
  const clicksLimitEl = document.getElementById('clicksLimit');
  console.log('Click limit toggle changed:', this.checked);
  
  if (this.checked) {
    clicksLimitEl.disabled = false;
    clicksLimitEl.style.opacity = '1';
    if (!clicksLimitEl.value) {
      clicksLimitEl.value = '1000';
    }
  } else {
    clicksLimitEl.disabled = true;
    clicksLimitEl.style.opacity = '0.5';
    // Clear the value when disabled
    clicksLimitEl.value = '';
  }
  queueAutosave();
}

// Initialize click limit toggle when DOM is ready
document.addEventListener('DOMContentLoaded', setupClickLimitToggle);

function queueAutosave(){ if(!currentId) return; clearTimeout(autosaveTimer); autosaveTimer=setTimeout(()=>onSave(true),600); }

/* ===== UNIFIED INTERACTIVE FEATURES ===== */
// Copy feedback functionality
function showCopyFeedback(message = 'Copied!') {
  // Remove existing feedback
  const existing = document.querySelector('.copy-feedback');
  if (existing) {
    existing.remove();
  }

  // Create new feedback
  const feedback = document.createElement('div');
  feedback.className = 'copy-feedback show';
  feedback.innerHTML = '<span class="icon">✓</span><span>' + message + '</span>';

  document.body.appendChild(feedback);

  // Auto-hide after 1.5 seconds
  setTimeout(() => {
    feedback.classList.add('hide');
    setTimeout(() => feedback.remove(), 300);
  }, 1500);
}

// Enhanced copy functionality for smart link rows
function setupCopyButtons() {
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('copy-button') || e.target.closest('.copy-button')) {
      const button = e.target.classList.contains('copy-button') ? e.target : e.target.closest('.copy-button');
      const urlElement = button.closest('.smart-link-row')?.querySelector('.smart-link-url');
      
      if (urlElement) {
        const url = urlElement.textContent || urlElement.getAttribute('data-url') || '';
        if (url) {
          navigator.clipboard.writeText(url).then(() => {
            showCopyFeedback('Copied!');
            button.classList.add('copied');
            setTimeout(() => button.classList.remove('copied'), 1500);
          }).catch(() => {
            showCopyFeedback('Failed to copy');
          });
        }
      }
    }
  });
}

// Setup accordion functionality
function setupAccordions() {
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('accordion-header') || e.target.closest('.accordion-header')) {
      const header = e.target.classList.contains('accordion-header') ? e.target : e.target.closest('.accordion-header');
      const accordion = header.closest('.accordion');
      const body = accordion?.querySelector('.accordion-body');
      const chevron = header.querySelector('.accordion-chevron');
      
      if (body && chevron) {
        const isExpanded = header.getAttribute('aria-expanded') === 'true';
        header.setAttribute('aria-expanded', !isExpanded);
        
        if (isExpanded) {
          body.style.display = 'none';
        } else {
          body.style.display = 'block';
        }
      }
    }
  });
}

// Initialize interactive features
document.addEventListener('DOMContentLoaded', function() {
  setupCopyButtons();
  setupAccordions();
});

/* ================= Auto-weighting (any N, lock edited) ================= */
function computeAutoWeights(editedEl) {
  const rows = [...tbody.querySelectorAll('tr')];
  const inputs = rows.map(tr => ({ weightEl: tr.querySelector('input[data-role="weight"]') }));
  const weights = inputs.map(i => {
    const v = (i.weightEl.value || '').trim();
    if (v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  });

  const target = 100;
  const editedIdx = editedEl ? inputs.findIndex(i => i.weightEl === editedEl) : -1;

  if (editedIdx >= 0) {
    if (weights[editedIdx] == null) weights[editedIdx] = 0;
    weights[editedIdx] = Math.max(0, Math.min(100, weights[editedIdx] || 0));
    inputs[editedIdx].weightEl.value = String(weights[editedIdx]);

    const v = weights[editedIdx] || 0;
    let remaining = Math.max(0, target - v);

    const others = inputs.map((_, idx) => idx).filter(idx => idx !== editedIdx);
    const defined = others.filter(i => weights[i] != null);
    const blanks  = others.filter(i => weights[i] == null);
    let sumDefined = defined.reduce((s, i) => s + (weights[i] || 0), 0);

    if (sumDefined > remaining) {
      if (sumDefined > 0) {
        let acc = 0;
        defined.forEach(i => {
          const scaled = Math.floor((weights[i] || 0) * remaining / sumDefined);
          weights[i] = scaled;
          acc += scaled;
        });
        let leftover = remaining - acc;
        for (const i of defined) { if (leftover <= 0) break; weights[i] = (weights[i] || 0) + 1; leftover--; }
        blanks.forEach(i => { weights[i] = 0; });
      } else {
        const share = blanks.length ? Math.floor(remaining / blanks.length) : 0;
        let leftover = blanks.length ? remaining - share * blanks.length : 0;
        blanks.forEach(i => { weights[i] = share + (leftover > 0 ? 1 : 0); if (leftover > 0) leftover--; });
      }
    } else {
      let rem2 = remaining - sumDefined;
      const share = blanks.length ? Math.floor(rem2 / blanks.length) : 0;
      let leftover = blanks.length ? rem2 - share * blanks.length : 0;
      blanks.forEach(i => { weights[i] = share + (leftover > 0 ? 1 : 0); if (leftover > 0) leftover--; });
    }
  } else {
    let sumDefined = weights.reduce((s, w) => s + (w || 0), 0);
    if (sumDefined > target) sumDefined = target;
    const blanks = inputs.map((_, i) => i).filter(i => weights[i] == null);
    const remaining = target - sumDefined;
    const share = blanks.length ? Math.floor(remaining / blanks.length) : 0;
    let leftover = blanks.length ? remaining - share * blanks.length : 0;
    blanks.forEach(i => { weights[i] = share + (leftover > 0 ? 1 : 0); if (leftover > 0) leftover--; });
  }

  let total = weights.reduce((s, w) => s + (w || 0), 0);
  if (total !== target && inputs.length) {
    let idx = inputs.findIndex((_, i) => i !== editedIdx);
    if (idx < 0) idx = editedIdx >= 0 ? editedIdx : 0;
    weights[idx] = (weights[idx] || 0) + (target - total);
  }

  inputs.forEach((i, idx) => { i.weightEl.value = String(weights[idx] || 0); });
  return { sum: 100, error: false };
}
function recalc(editedEl) {
  const result = computeAutoWeights(editedEl);
  let sum = 0;
  [...tbody.querySelectorAll('input[data-role="weight"]')].forEach(el => { sum += Number(el.value || 0); });
  fill.style.width = Math.min(100, sum) + '%';
  sumLabel.textContent = 'Total: ' + sum + '%';
  msg.textContent = ''; msg.className = '';
  if (result.error || sum !== 100) { msg.textContent = 'Weights must sum to 100 (currently ' + sum + ').'; msg.className = 'error'; }
}

/* ================= Rows / UI ================= */
function row({url='', label='', weight, safeLink=''} = {}) {
  const tr = document.createElement('tr');
  tr.innerHTML = \`
    <td><input type="url" placeholder="https://example.com/variant" required value="\${url}"/></td>
    <td><input type="text" placeholder="A / B / us-west etc" value="\${label||''}"/></td>
    <td><input data-role="weight" type="number" min="0" max="100" step="1" value="\${(weight ?? '')}"/></td>
    <td><input type="url" placeholder="https://example.com/fallback" value="\${safeLink||''}" title="Safe link if targeting doesn't match"/></td>
    <td style="display:flex; gap:4px; align-items:center; justify-content:flex-start;">
      <button class="ghost up" type="button" style="height:28px; width:28px; padding:0; display:flex; align-items:center; justify-content:center;">↑</button>
      <button class="ghost down" type="button" style="height:28px; width:28px; padding:0; display:flex; align-items:center; justify-content:center;">↓</button>
      <button class="ghost del" type="button" style="height:28px; width:28px; padding:0; display:flex; align-items:center; justify-content:center;">✕</button>
    </td>\`;

  tr.querySelector('.del').onclick = () => { tr.remove(); recalc(null); queueAutosave(); };
  tr.querySelector('.up').onclick = () => { const p = tr.previousElementSibling; if (p) tbody.insertBefore(tr, p); recalc(null); queueAutosave(); };
  tr.querySelector('.down').onclick = () => { const n = tr.nextElementSibling; if (n) tbody.insertBefore(n, tr); recalc(null); queueAutosave(); };

  tr.querySelectorAll('input').forEach(i => i.addEventListener('input', (e) => {
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute('data-role') === 'weight') recalc(t);
    else recalc(null);
    queueAutosave();
  }));
  return tr;
}

/* ===== Smart link using BASE_URL (absolute) ===== */
function setShareLinks(){
  if(!currentId){
    smart.textContent='(select a project)';
    smart.href='#';
    tryA.textContent='/go/<id>';
    tryA.href='#';
    return;
  }
  
  // Check if there's a custom alias
  const customAliasEl = document.getElementById('customAlias');
  const customAlias = customAliasEl?.value?.trim();
  
  // Use custom alias if available, otherwise use currentId
  const urlSlug = (customAlias && /^[a-zA-Z0-9-]+$/.test(customAlias)) ? customAlias : currentId;
  // Don't encode simple alphanumeric aliases as they don't need encoding
  const path = '/go/' + (customAlias && /^[a-zA-Z0-9-]+$/.test(customAlias) ? urlSlug : encodeURIComponent(urlSlug));
  
  const base = (typeof window.BASE_URL === 'string' && window.BASE_URL)
    ? window.BASE_URL.replace(/\\/\\/+$/, '')
    : location.origin.replace(/\\/\\/+$/, '');
  const full = base + path;
  smart.textContent = full;
  smart.href = full;
  tryA.textContent = full;
  tryA.href = full;
}
copyBtn.onclick = async () => {
  if (!currentId) return;
  
  // Check if there's a custom alias
  const customAliasEl = document.getElementById('customAlias');
  const customAlias = customAliasEl?.value?.trim();
  
  // Use custom alias if available, otherwise use currentId
  const urlSlug = (customAlias && /^[a-zA-Z0-9-]+$/.test(customAlias)) ? customAlias : currentId;
  
  const base = (typeof window.BASE_URL === 'string' && window.BASE_URL)
    ? window.BASE_URL.replace(/\\/\\/+$/, '')
    : location.origin.replace(/\\/\\/+$/, '');
  const u = base + '/go/' + (customAlias && /^[a-zA-Z0-9-]+$/.test(customAlias) ? urlSlug : encodeURIComponent(urlSlug));
  try { await navigator.clipboard.writeText(u); msg.textContent='Copied!'; msg.className=''; }
  catch { msg.textContent='Copy failed'; msg.className='error'; }
};

/* ================= Highlight helpers ================= */
function updateAllGroupsButton() {
  if (!allGroupsBtn) return;
  if (currentGroup === null) allGroupsBtn.classList.add('selected');
  else allGroupsBtn.classList.remove('selected');
}
function updateProjectsVisibility() {
  const projectsCard = document.getElementById('projectsCard');
  const projectEditorCard = document.getElementById('projectEditorCard');
  
  if (currentGroup === null) {
    // No group selected - hide projects
    if (projectsCard) projectsCard.classList.add('hide-until-group-selected');
    if (projectEditorCard) projectEditorCard.classList.add('hide-until-group-selected');
  } else {
    // Group selected - show projects
    if (projectsCard) projectsCard.classList.remove('hide-until-group-selected');
    if (projectEditorCard) projectEditorCard.classList.remove('hide-until-group-selected');
  }
}


/* ================= API helpers (force cookies on fetch) ================= */
async function j(url, opts){
  console.log('DEBUG: j() function called with:', { url, opts });
  opts = opts || {};
  opts.credentials = 'include'; // ensure cookie rides along
  console.log('DEBUG: Making fetch request to:', url);
  try {
    const r = await fetch(url, opts);
    console.log('DEBUG: Fetch response status:', r.status, r.statusText);
    const d = await r.json().catch(()=>({}));
    console.log('DEBUG: Fetch response data:', d);
    if(!r.ok) throw new Error(d.error || 'Request failed');
    return d;
  } catch(e) {
    console.log('DEBUG: j() function error:', e);
    throw e;
  }
}

const listGroups=()=>j('/api/groups');
const createGroup=()=>j('/api/groups',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'New Group'})});
const renameGroup=(id,name)=>j('/api/groups/'+id,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({name})});
const deleteGroupApi=(id)=>fetch('/api/groups/'+id,{method:'DELETE', credentials:'include'}).then(r=>r.ok);

const listProjects=()=>j('/api/projects');
const createProject=()=>{ if(!currentGroup){ msg.textContent='Select a group (or create one) first'; msg.className='error'; return null; }
  return j('/api/projects',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({name:'New Project',groupId:currentGroup,main:'https://example.com',items:[{url:'https://example.com/a',label:'A'},{url:'https://example.com/b',label:'B'}]})});
};

const duplicateProject=async ()=>{
  if(!currentId && !currentProject){ 
    msg.textContent='Select a project to duplicate first'; 
    msg.className='error'; 
    return null; 
  }
  
  try {
    // Get the project ID to duplicate (either from editor or analytics)
    const projectId = currentId || currentProject;
    if(!projectId) return null;
    
    // Fetch the current project data
    const originalProject = await getProject(projectId);
    if(!originalProject) {
      msg.textContent='Failed to load project data'; 
      msg.className='error'; 
      return null;
    }
    
    // Create duplicate with "Copy" suffix
    const duplicateData = {
      name: originalProject.name + ' (Copy)',
      groupId: originalProject.groupId,
      main: originalProject.main,
      safeLink: originalProject.safeLink,
      items: originalProject.items,
      targeting: originalProject.targeting,
      weights: originalProject.weights,
      clickLimit: originalProject.clickLimit,
      customAlias: originalProject.customAlias,
      webhooks: originalProject.webhooks,
      pixelTracking: originalProject.pixelTracking
    };
    
    // Create the duplicate project
    const duplicate = await j('/api/projects', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(duplicateData)
    });
    
    if(duplicate) {
      msg.textContent='Project duplicated successfully!'; 
      msg.className='success'; 
      setTimeout(() => { msg.textContent=''; }, 3000);
      return duplicate;
    } else {
      msg.textContent='Failed to duplicate project'; 
      msg.className='error'; 
      return null;
    }
  } catch (error) {
    console.error('Error duplicating project:', error);
    msg.textContent='Error duplicating project'; 
    msg.className='error'; 
    return null;
  }
};
const getProject=(id)=>j('/api/projects/'+id);
const saveProject=(id,body)=>j('/api/projects/'+id,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const deleteProjectApi=(id)=>fetch('/api/projects/'+id,{method:'DELETE', credentials:'include'}).then(r=>r.ok);

/* ================= Lists / selection ================= */

// Load editor name for dropdown (for admins to see editor names)
async function loadEditorName(userId, dropdown) {
  try {
    // Fetch the user's name from the API
    const response = await fetch('/api/users/' + encodeURIComponent(userId), { credentials: 'include' });
    if (response.ok) {
      const user = await response.json();
      const name = user.name || user.email || 'Unknown Editor';
      
      dropdown.innerHTML = '';
      const option = document.createElement('option');
      option.textContent = name;
      option.value = userId;
      dropdown.appendChild(option);
    } else {
      dropdown.innerHTML = '';
      const option = document.createElement('option');
      option.textContent = 'Unknown Editor';
      option.value = '';
      dropdown.appendChild(option);
    }
  } catch (error) {
    console.error('Error loading editor name:', error);
    dropdown.innerHTML = '';
    const option = document.createElement('option');
    option.textContent = 'Unknown Editor';
    option.value = '';
    dropdown.appendChild(option);
  }
}

// Filter groups based on current filter
function filterGroups(groups) {
  let filtered = groups;
  
  if (currentGroupFilter === 'admin') {
    filtered = groups.filter(g => !g.userId);
  } else if (currentGroupFilter === 'editor') {
    filtered = groups.filter(g => !!g.userId);
  }
  
  return filtered;
}

// Filter projects based on current filter  
function filterProjects(projects) {
  let filtered = projects;
  
  if (currentProjectFilter === 'admin') {
    filtered = projects.filter(p => {
      const group = cacheGroups.find(g => g.id === p.groupId);
      return group && !group.userId;
    });
  } else if (currentProjectFilter === 'editor') {
    filtered = projects.filter(p => {
      const group = cacheGroups.find(g => g.id === p.groupId);
      return group && !!group.userId;
    });
  }
  
  return filtered;
}

// Update pagination info
function updateGroupPaginationInfo(totalItems) {
  const pageInfo = document.getElementById('pageInfo');
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (pageInfo) {
    pageInfo.textContent = 'Page ' + currentGroupPage + ' of ' + (totalPages || 1);
  }
  
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  if (prevBtn) prevBtn.disabled = currentGroupPage <= 1;
  if (nextBtn) nextBtn.disabled = currentGroupPage >= totalPages;
}

// Update project pagination info
function updateProjectPaginationInfo(totalItems) {
  const pageInfo = document.getElementById('projectPageInfo');
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (pageInfo) {
    pageInfo.textContent = 'Page ' + currentProjectPage + ' of ' + (totalPages || 1);
  }
  
  const prevBtn = document.getElementById('prevProjectPage');
  const nextBtn = document.getElementById('nextProjectPage');
  if (prevBtn) prevBtn.disabled = currentProjectPage <= 1;
  if (nextBtn) nextBtn.disabled = currentProjectPage >= totalPages;
}

function renderProjGroupDropdown(){
  const sel = projGroup;
  const prev = sel.value;
  sel.innerHTML='';
  cacheGroups.forEach(g=>{
    const opt=document.createElement('option'); opt.value=g.id; opt.textContent=g.name; sel.appendChild(opt);
  });
  if (cacheGroups.length===0){
    const opt=document.createElement('option'); opt.value=''; opt.textContent='(no groups yet)'; sel.appendChild(opt);
  }
  if (prev) sel.value = prev;
}
async function renderGroups(){
  const list=await listGroups();
  cacheGroups = list;
  
  // Apply filtering
  const filteredList = filterGroups(list);
  
  // Apply pagination
  const startIndex = (currentGroupPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedList = filteredList.slice(startIndex, endIndex);
  
  // Update pagination info
  updateGroupPaginationInfo(filteredList.length);
  
  groupList.innerHTML='';
  paginatedList.forEach(g=>{
    const isAdminGroup = !g.userId; // Admin groups have no userId
    
    const row=document.createElement('div'); 
    row.className = 'ui-list-rows ' + (isAdminGroup ? 'admin' : 'editor');
    
    const btn=document.createElement('button'); 
    btn.className='group-button'; 
    btn.type='button'; 
    btn.textContent=g.name;
    btn.onclick=async (e)=>{ e.preventDefault(); currentGroup=g.id; localStorage.setItem('ls.currentGroup',g.id); projectsHeader.textContent='Projects ('+(g.name)+')'; updateAllGroupsButton(); updateProjectsVisibility(); updateLastActivity(); await renderGroups(); await renderProjects(); };
    
    // Add badge to show group type
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = isAdminGroup ? 'ADMIN' : 'EDITOR';
    
    // Add editor name dropdown for editor groups (only visible to admins)
    let editorDropdown = null;
    if (!isAdminGroup && g.userId && window.currentUser && window.currentUser.role === 'admin') {
      editorDropdown = document.createElement('select');
      editorDropdown.className = 'select';
      editorDropdown.style.marginLeft = '8px';
      editorDropdown.style.minWidth = '80px';
      
      // Add loading option
      const loadingOption = document.createElement('option');
      loadingOption.textContent = 'Loading...';
      loadingOption.value = '';
      editorDropdown.appendChild(loadingOption);
      
      // Load editor name
      loadEditorName(g.userId, editorDropdown);
    }
    
    const rn=document.createElement('button'); rn.className='btn btn-icon action-icon'; rn.type='button'; rn.textContent='✎'; rn.title='Rename group'; rn.onclick=async()=>{ const n=prompt('New name', g.name); if(n){ await renameGroup(g.id,n); await renderGroups(); if(currentGroup===g.id){ projectsHeader.textContent='Projects ('+n+')'; } } };
    const del=document.createElement('button'); del.className='btn btn-icon action-icon'; del.type='button'; del.textContent='🗑'; del.title='Delete group'; del.onclick=async()=>{ 
      if(confirm('Are you sure you would like to delete this group "' + g.name + '" and all its projects? This action cannot be undone.')){ 
        await deleteGroupApi(g.id); 
        if(currentGroup===g.id){ 
          currentGroup=null; 
          localStorage.removeItem('ls.currentGroup'); 
          projectsHeader.textContent='Projects (All)'; 
        } 
        updateAllGroupsButton(); 
        updateProjectsVisibility(); 
        await renderGroups(); 
        await renderProjects(); 
      }
    };
    
    // Create a proper list item structure
    const listItem = document.createElement('div');
    listItem.className = 'list-item';
    if (g.id===currentGroup) listItem.classList.add('selected');
    
    // Create group info container
    const groupInfo = document.createElement('div');
    groupInfo.style.display = 'flex';
    groupInfo.style.alignItems = 'center';
    groupInfo.style.justifyContent = 'space-between';
    groupInfo.style.width = '100%';
    
    // Left side: group name and badge
    const leftSide = document.createElement('div');
    leftSide.style.display = 'flex';
    leftSide.style.alignItems = 'center';
    leftSide.style.gap = '8px';
    leftSide.appendChild(btn);
    leftSide.appendChild(badge);
    if (editorDropdown) {
      leftSide.appendChild(editorDropdown);
    }
    
    // Right side: action buttons
    const rightSide = document.createElement('div');
    rightSide.style.display = 'flex';
    rightSide.style.alignItems = 'center';
    rightSide.style.gap = '8px';
    rightSide.appendChild(rn);
    rightSide.appendChild(del);
    
    groupInfo.appendChild(leftSide);
    groupInfo.appendChild(rightSide);
    listItem.appendChild(groupInfo);
    row.appendChild(listItem);
    groupList.appendChild(row);
  });
  renderProjGroupDropdown();
  updateAllGroupsButton();
}
async function renderProjects(){
  console.log('DEBUG: renderProjects called');
  
  // Get current user info to check group ownership
  let currentUserId = null;
  let currentUserRole = null;
  try {
    const userResponse = await j('/api/me');
    currentUserId = userResponse.id;
    currentUserRole = userResponse.role;
    console.log('🔍 DEBUG: renderProjects - Current user ID:', currentUserId, 'role:', currentUserRole);
  } catch (error) {
    console.log('🔍 DEBUG: renderProjects - Could not get current user, defaulting to admin view');
  }
  
  const list=await listProjects();
  console.log('DEBUG: Projects list:', list);
  console.log('DEBUG: currentGroup:', currentGroup);
  console.log('DEBUG: currentId before filtering:', currentId);
  
  projList.innerHTML='';
  let filtered=currentGroup? list.filter(p=>p.groupId===currentGroup):list;
  
  // Apply additional filtering based on admin/editor
  filtered = filterProjects(filtered);
  
        // Additional security: filter out projects in groups the user doesn't own
      if (currentUserId) {
        filtered = filtered.filter(p => {
          const group = cacheGroups.find(g => g.id === p.groupId);
          if (!group) return false;
          
          // Admins can see all groups, editors can only see their own
          if (currentUserRole !== 'admin' && currentUserId && group.userId && group.userId !== currentUserId) {
            console.log('🔍 DEBUG: renderProjects filtering out project in another user group:', p.name, 'groupId:', p.groupId, 'groupOwner:', group.userId, 'currentUser:', currentUserId, 'userRole:', currentUserRole);
            return false;
          }
          return true;
        });
      }
  
  // Apply pagination
  const startIndex = (currentProjectPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedList = filtered.slice(startIndex, endIndex);
  
  // Update pagination info
  updateProjectPaginationInfo(filtered.length);
  
  console.log('DEBUG: Filtered projects:', filtered);
  
  projectsHeader.textContent = currentGroup ? 'Projects (' + (cacheGroups.find(g=>g.id===currentGroup)?.name || 'Group') + ')' : 'Projects (All)';
  paginatedList.forEach(p=>{
    const b = document.createElement('button'); 
    b.className='project-item'; 
    b.type='button'; 
    b.textContent=p.name; 
    b.setAttribute('data-id', p.id);
    b.dataset.projectId = String(p.id);  // <-- stable id for selection

    // Mark selected on initial render using string compare
    if (String(p.id) === getCurrentEditorProject()) {
      b.classList.add('selected');
    }

    // Click handler: update selection immediately, blur to kill focus ring, then proceed with Editor's logic
    b.onclick = async (e) => {
      e.preventDefault();
      
      const clickedProjectId = String(p.id);
      
      // Clear all existing selections first
      document.querySelectorAll('#projList .ui-list-rows button').forEach(btn => {
        btn.classList.remove('selected');
      });
      document.querySelectorAll('#projList .ui-list-rows .list-item').forEach(item => {
        item.classList.remove('selected');
      });
      
      // Set new selection IMMEDIATELY for visual feedback
      setCurrentEditorProject(clickedProjectId);
      b.classList.add('selected');
      b.closest('.list-item')?.classList.add('selected');
      b.blur(); // avoid :focus ring or circle

      // Continue with whatever the Editor needs to do after selecting a project:
      await selectProject(clickedProjectId);
      updateLastActivity();
    };
    
    const duplicateBtn = document.createElement('button');
    duplicateBtn.className='btn btn-icon action-icon';
    duplicateBtn.type='button';
    duplicateBtn.textContent='📋';
    duplicateBtn.title='Duplicate this project';
    duplicateBtn.onclick=async (e)=>{ 
      e.preventDefault(); 
      e.stopPropagation();
      setCurrentEditorProject(p.id);
      currentId = p.id;
      const duplicated = await duplicateProject();
      if(duplicated) {
        await renderProjects();
        await selectProject(duplicated.id);
      }
    };
    
    // Create individual container for each project (like groups)
    const row = document.createElement('div');
    row.className = 'ui-list-rows';
    
    // Add admin/editor class based on the group type (like groups do)
    const group = cacheGroups.find(g => g.id === p.groupId);
    if (group) {
      const isAdminGroup = !group.userId; // Admin groups have no userId
      row.className = 'ui-list-rows ' + (isAdminGroup ? 'admin' : 'editor');
    }
    
    // Create a proper list item structure
    const listItem = document.createElement('div');
    listItem.className = 'list-item';
    if(String(p.id) === getCurrentEditorProject()) {
      listItem.classList.add('selected');
    }
    
    // Add project name and duplicate button
    const projectInfo = document.createElement('div');
    projectInfo.style.display = 'flex';
    projectInfo.style.alignItems = 'center';
    projectInfo.style.justifyContent = 'space-between';
    projectInfo.style.width = '100%';
    
    projectInfo.appendChild(b);
    projectInfo.appendChild(duplicateBtn);
    
    listItem.appendChild(projectInfo);
    row.appendChild(listItem);
    projList.appendChild(row);
  });
  console.log('DEBUG: Before setting currentId - currentGroup:', currentGroup, 'filtered.length:', filtered.length);
  
  // If we have a currentId but it's not in the filtered projects for the current group,
  // check if it exists in the full list. If so, keep it selected instead of resetting to null
  if(currentId && currentGroup && !filtered.some(p=>p.id===currentId)) {
    console.log('DEBUG: Current project not in filtered group - clearing invalid currentId:', currentId);
    currentId = null;
    setCurrentEditorProject(null);
    
    // Try to auto-select a valid project
    if(filtered.length > 0) {
      currentId = filtered[0].id;
      setCurrentEditorProject(currentId);
      console.log('DEBUG: Auto-selected first project in group:', currentId);
    } else if(list.length > 0) {
      currentId = list[0].id;
      setCurrentEditorProject(currentId);
      console.log('DEBUG: Auto-selected first available project:', currentId);
    }
  }
  // If no currentId, try to set it to something useful
  if(!currentId) {
    if(currentGroup && filtered.length > 0) {
      // Set to first project in current group
      console.log('DEBUG: No currentId - setting to first filtered project:', filtered[0]?.id);
      currentId = filtered[0]?.id || null; 
      setCurrentEditorProject(currentId); 
    } else if(list.length > 0) {
      // No projects in current group, but we have projects - set to first overall project
      console.log('DEBUG: No currentId and no projects in group - NOT setting to potentially invalid project');
      // Don't automatically set to the first project since it might be invalid
      // Let the user manually select a project instead
      currentId = null;
      setCurrentEditorProject(null); 
    }
  }
  console.log('DEBUG: currentId after setting:', currentId);
  
  // Update highlighting using new system
  updateProjectSelectionUI();
  
  // Call selectProject if we have a saved project and it's not already running
  const savedProject = getCurrentEditorProject();
  if(savedProject && !window.isSelectingProject) {
    console.log('DEBUG: renderProjects - calling selectProject with saved project:', savedProject);
    await selectProject(savedProject);
  } else if (window.isSelectingProject) {
    console.log('DEBUG: renderProjects - skipping selectProject call because selection is already in progress');
  }
}
async function selectProject(id){
  console.log('DEBUG: selectProject called with id:', id);
  
  // Prevent multiple simultaneous calls to selectProject
  if (window.isSelectingProject) {
    console.log('DEBUG: selectProject already running, skipping this call');
    return;
  }
  
  console.log('DEBUG: Starting selectProject for id:', id);
  window.isSelectingProject = true;
  
  const p=await getProject(id).catch((error)=>{
    console.log('DEBUG: Error getting project:', error);
    return null;
  });
  if(!p) {
    console.log('DEBUG: Project not found for id:', id, '- clearing form and resetting flag');
    // Clear the form since we can't load the project
    projName.value = '';
    mainInput.value = '';
    projGroup.value = '';
    
    // Clear table
    const tbody = document.querySelector('#itemsTable tbody');
    if (tbody) {
      tbody.innerHTML = '';
    }
    
    // Clear targeting rules
    const globalTargetingRules = document.getElementById('globalTargetingRules');
    if (globalTargetingRules) {
      globalTargetingRules.innerHTML = '';
    }
    
    // Clear currentId since this project doesn't exist
    currentId = null;
    setCurrentEditorProject(null);
    
    window.isSelectingProject = false;
    return;
  }
  
  // Update last activity when selecting a project
  updateLastActivity();
  console.log('DEBUG: Project loaded:', p);
  console.log('DEBUG: Project targeting field:', p.targeting);
  console.log('DEBUG: Project keys:', Object.keys(p));
  console.log('DEBUG: Full project JSON:', JSON.stringify(p, null, 2));
  console.log('DEBUG: Project name being set to input:', p.name);
  console.log('DEBUG: Project main URL being set to input:', p.main);
  console.log('DEBUG: Project items being loaded to table:', p.items);
  console.log('DEBUG: selectProject - setting currentId from', currentId, 'to', id);
  currentId=id;
  setCurrentEditorProject(id);
  console.log('DEBUG: selectProject - currentId after setting:', currentId);
  projName.value=p.name; mainInput.value=p.main;
  renderProjGroupDropdown();
  projGroup.value = p.groupId || '';
  
  // Load advanced settings with safety checks
  const customAliasEl = document.getElementById('customAlias');
  const expirationDateEl = document.getElementById('expirationDate');
  const safeLinkEl = document.getElementById('safeLink');
  const customDomainEl = document.getElementById('customDomain');
  const tiktokPixelEl = document.getElementById('tiktokPixel');
  const facebookPixelEl = document.getElementById('facebookPixel');
  const enableConversionTrackingEl = document.getElementById('enableConversionTracking');
  const fraudProtectionEnabledEl = document.getElementById('fraudProtectionEnabled');
  const blockBotsEl = document.getElementById('blockBots');
  
  if (customAliasEl && p.customAlias) customAliasEl.value = p.customAlias;
  if (expirationDateEl && p.expiresAt) {
    const expirationDate = new Date(p.expiresAt);
    expirationDateEl.value = expirationDate.toISOString().slice(0, 16);
  }
  
  // Load click limit settings
  const enableClickLimitEl = document.getElementById('enableClickLimit');
  const clicksLimitEl = document.getElementById('clicksLimit');
  
  if (p.clicksLimit && enableClickLimitEl && clicksLimitEl) {
    clicksLimitEl.value = p.clicksLimit;
    enableClickLimitEl.checked = true;
    clicksLimitEl.disabled = false;
    clicksLimitEl.style.opacity = '1';
    console.log('Loaded click limit:', p.clicksLimit, 'checkbox set to true');
  } else if (enableClickLimitEl && clicksLimitEl) {
    enableClickLimitEl.checked = false;
    clicksLimitEl.disabled = true;
    clicksLimitEl.style.opacity = '0.5';
    clicksLimitEl.value = '';
    console.log('No click limit found, checkbox set to false');
  }
  
  // Ensure click limit toggle is set up after loading project
  setTimeout(() => {
    setupClickLimitToggle();
  }, 100);
  
  if (fraudProtectionEnabledEl && p.fraudProtection?.enabled) {
    fraudProtectionEnabledEl.checked = true;
    if (blockBotsEl) blockBotsEl.checked = p.fraudProtection.blockBots || false;
  }
  
  if (safeLinkEl && p.safeLink) safeLinkEl.value = p.safeLink;
  if (customDomainEl && p.customDomain) customDomainEl.value = p.customDomain;
  if (tiktokPixelEl && p.pixelSettings?.tiktokPixelId) tiktokPixelEl.value = p.pixelSettings.tiktokPixelId;
  if (facebookPixelEl && p.pixelSettings?.facebookPixelId) facebookPixelEl.value = p.pixelSettings.facebookPixelId;
  if (enableConversionTrackingEl && p.pixelSettings?.enableConversionTracking !== undefined) {
    enableConversionTrackingEl.checked = p.pixelSettings.enableConversionTracking;
  }
  
  // Load targeting rules
  console.log('DEBUG: Loading targeting rules from project:', p.targeting);
  if (p.targeting && p.targeting.length > 0) {
    console.log('DEBUG: Found', p.targeting.length, 'targeting rules to load');
    const container = document.getElementById('globalTargetingRules');
    if (container) {
      container.innerHTML = '';
      p.targeting.forEach((rule, index) => {
        console.log('DEBUG: Creating targeting rule', index, ':', rule);
        container.appendChild(createTargetingRule(rule.type, rule.field, rule.operator, rule.value, rule.enabled));
      });
    }
  } else {
    console.log('DEBUG: No targeting rules found in project or targeting array is empty');
  }
  
  // Load A/B testing settings with safety checks
  const enableABTestingEl = document.getElementById('enableABTesting');
  const testTypeEl = document.getElementById('testType');
  const goalEl = document.getElementById('goal');
  const confidenceLevelEl = document.getElementById('confidenceLevel');
  const minSampleSizeEl = document.getElementById('minSampleSize');
  const hypothesisEl = document.getElementById('hypothesis');
  const abTestingSettingsEl = document.getElementById('abTestingSettings');
  
  if (p.abTesting?.enabled && enableABTestingEl && testTypeEl && goalEl && confidenceLevelEl && minSampleSizeEl && hypothesisEl && abTestingSettingsEl) {
    enableABTestingEl.checked = true;
    testTypeEl.value = p.abTesting.testType || 'split';
    goalEl.value = p.abTesting.goal || 'conversion';
    confidenceLevelEl.value = p.abTesting.confidenceLevel || 95;
    minSampleSizeEl.value = p.abTesting.minSampleSize || 1000;
    hypothesisEl.value = p.abTesting.hypothesis || '';
    abTestingSettingsEl.style.display = 'block';
    
    // Load A/B testing results after a short delay to ensure DOM is ready
    setTimeout(() => loadABTestingResults(), 100);
  } else if (enableABTestingEl && abTestingSettingsEl) {
    enableABTestingEl.checked = false;
    abTestingSettingsEl.style.display = 'none';
  }
  
  // Load items with safe links
  console.log('DEBUG: Loading project items into table. Project items:', p.items);
  tbody.innerHTML='';
  (p.items||[]).forEach(it=>{
    console.log('DEBUG: Adding item to table:', it);
    tbody.appendChild(row({...it, safeLink: it.safeLink}));
  });
  console.log('DEBUG: After loading items, tbody children count:', tbody.children.length);
  if(!tbody.children.length){
    console.log('DEBUG: No items loaded, adding default items');
    tbody.appendChild(row({ url:p.main+'/a', label:'A'})); 
    tbody.appendChild(row({ url:p.main+'/b', label:'B'})); 
  }
  console.log('DEBUG: Final tbody children count:', tbody.children.length);
  
  console.log('DEBUG: Testing if tbody is valid:', tbody);
  console.log('DEBUG: Testing if tbody is null:', tbody === null);
  console.log('DEBUG: Testing if tbody is undefined:', tbody === undefined);
  
  if (!tbody) {
    console.log('DEBUG: tbody is null or undefined, exiting early');
    window.isSelectingProject = false;
    return;
  }
  
  console.log('DEBUG: tbody is valid, continuing...');
  
  try {
    console.log('DEBUG: About to access tbody.children.length again');
    console.log('DEBUG: tbody.children.length:', tbody.children.length);
  } catch (error) {
    console.log('DEBUG: Error accessing tbody.children:', error);
    window.isSelectingProject = false;
    return;
  }
  
  console.log('DEBUG: Successfully accessed tbody.children, continuing...');
  
  console.log('DEBUG: About to call recalc and setShareLinks');
  console.log('DEBUG: Testing if tbody is null:', tbody === null);
  console.log('DEBUG: Testing if tbody is undefined:', tbody === undefined);
  
  if (!tbody) {
    console.log('DEBUG: tbody is null or undefined, exiting early');
    window.isSelectingProject = false;
    return;
  }
  
  console.log('DEBUG: tbody is valid, continuing...');
  
  try {
    console.log('DEBUG: About to access tbody.children.length again');
    console.log('DEBUG: tbody.children.length:', tbody.children.length);
  } catch (error) {
    console.log('DEBUG: Error accessing tbody.children:', error);
    window.isSelectingProject = false;
    return;
  }
  
  console.log('DEBUG: Successfully accessed tbody.children, continuing...');
  console.log('DEBUG: Testing if tbody is null:', tbody === null);
  console.log('DEBUG: Testing if tbody is undefined:', tbody === undefined);
  
  if (!tbody) {
    console.log('DEBUG: tbody is null or undefined, exiting early');
    window.isSelectingProject = false;
    return;
  }
  
  console.log('DEBUG: tbody is valid, continuing...');
  
  try {
    console.log('DEBUG: About to access tbody.children.length again');
    console.log('DEBUG: tbody.children.length:', tbody.children.length);
  } catch (error) {
    console.log('DEBUG: Error accessing tbody.children:', error);
    window.isSelectingProject = false;
    return;
  }
  console.log('DEBUG: Testing if tbody is null:', tbody === null);
  console.log('DEBUG: Testing if tbody is undefined:', tbody === undefined);
  
  if (!tbody) {
    console.log('DEBUG: tbody is null or undefined, exiting early');
    window.isSelectingProject = false;
    return;
  }
  
  console.log('DEBUG: tbody is valid, continuing...');
  
  console.log('DEBUG: About to call recalc and setShareLinks');
  console.log('DEBUG: tbody element:', tbody);
  console.log('DEBUG: recalc function exists:', typeof recalc);
  console.log('DEBUG: setShareLinks function exists:', typeof setShareLinks);
  try {
    recalc(null); 
    console.log('DEBUG: recalc completed');
    setShareLinks();
    console.log('DEBUG: setShareLinks completed');
  } catch (error) {
    console.log('DEBUG: Error in recalc or setShareLinks:', error);
  }
  
  console.log('DEBUG: About to call updateProjectSelectionUI()');
  try {
    updateProjectSelectionUI();
    console.log('DEBUG: updateProjectSelectionUI() called successfully');
  } catch (error) {
    console.log('DEBUG: Error calling updateProjectSelectionUI():', error);
  }
  
  // Load bulk links
  loadBulkLinks();
  
  // Ensure links tab is active when project is selected
  const linksTab = document.getElementById('linksTab');
  const linksContent = document.getElementById('linksContent');
  const targetingTab = document.getElementById('targetingTab');
  const targetingContent = document.getElementById('targetingContent');
  
  if (linksTab && linksContent && targetingTab && targetingContent) {
    // Remove active class from all tabs
    document.querySelectorAll('.tab-button').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Activate links tab
    linksTab.classList.add('active');
    linksContent.classList.add('active');
  }
  
  // Update project highlighting after all project data is loaded
  console.log('DEBUG: About to call updateProjectSelectionUI() (second call)');
  try {
    updateProjectSelectionUI();
    console.log('DEBUG: updateProjectSelectionUI() (second call) called successfully');
  } catch (error) {
    console.log('DEBUG: Error calling updateProjectSelectionUI() (second call):', error);
  }
  
  // Test direct call to see if function exists
  console.log('DEBUG: Testing if updateProjectSelectionUI function exists:', typeof updateProjectSelectionUI);
  if (typeof updateProjectSelectionUI === 'function') {
    console.log('DEBUG: Function exists, calling it directly');
    updateProjectSelectionUI();
  } else {
    console.log('DEBUG: Function does not exist!');
  }
  
  // Reset the selection flag
  console.log('DEBUG: selectProject completed successfully, resetting flag');
  window.isSelectingProject = false;
}
/* ================= Save/Delete ================= */
async function onSave(silent=false){
  console.log('DEBUG: onSave function called, currentId:', currentId);
  if(!currentId) {
    console.log('DEBUG: No currentId, exiting onSave');
    return;
  }
  
  // Check if form has valid data
  if (!projName.value.trim() || !mainInput.value.trim() || !projGroup.value) {
    console.log('DEBUG: Form is empty or invalid, exiting onSave');
    console.log('DEBUG: - projName:', projName.value.trim());
    console.log('DEBUG: - mainInput:', mainInput.value.trim());
    console.log('DEBUG: - projGroup:', projGroup.value);
    return;
  }
  console.log('DEBUG: Computing auto weights...');
  computeAutoWeights(null);
  
  // Get basic form values
  console.log('DEBUG: Reading form values...');
  console.log('DEBUG: projName.value:', projName.value);
  console.log('DEBUG: mainInput.value:', mainInput.value);
  console.log('DEBUG: projGroup.value:', projGroup.value);
  
  // Get items with safe links
  const items=[...tbody.querySelectorAll('tr')].map(tr=>({
    url: tr.querySelector('input[type="url"]').value.trim(),
    label: tr.querySelector('input[type="text"]').value.trim(),
    weight: tr.querySelector('input[data-role="weight"]').value.trim()==='' ? undefined : Number(tr.querySelector('input[data-role="weight"]').value||0),
    safeLink: tr.querySelector('input[type="url"]:nth-of-type(2)')?.value.trim() || undefined
  }));
  console.log('DEBUG: Items from table:', items);
  
  // Get advanced settings
  console.log('DEBUG: About to get Advanced Settings elements...');
  
  const customAliasEl = document.getElementById('customAlias');
  const expirationDateEl = document.getElementById('expirationDate');
  const clicksLimitEl = document.getElementById('clicksLimit');
  const fraudProtectionEnabledEl = document.getElementById('fraudProtectionEnabled');
  const blockBotsEl = document.getElementById('blockBots');
  const safeLinkEl = document.getElementById('safeLink');
  const customDomainEl = document.getElementById('customDomain');
  const tiktokPixelEl = document.getElementById('tiktokPixel');
  const facebookPixelEl = document.getElementById('facebookPixel');
  const enableConversionTrackingEl = document.getElementById('enableConversionTracking');
  
  console.log('DEBUG: Found Advanced Settings elements:');
  console.log('- customAlias element:', customAliasEl);
  console.log('- expirationDate element:', expirationDateEl);
  console.log('- clicksLimit element:', clicksLimitEl);
  console.log('- fraudProtectionEnabled element:', fraudProtectionEnabledEl);
  console.log('- blockBots element:', blockBotsEl);
  console.log('- safeLink element:', safeLinkEl);
  console.log('- customDomain element:', customDomainEl);
  console.log('- tiktokPixel element:', tiktokPixelEl);
  console.log('- facebookPixel element:', facebookPixelEl);
  console.log('- enableConversionTracking element:', enableConversionTrackingEl);
  
  // Validate custom alias format
  const customAliasRaw = customAliasEl?.value?.trim();
  let customAlias;
  
  if (customAliasRaw === '') {
    // Empty string means clear the custom alias
    customAlias = '';
  } else if (customAliasRaw && /^[a-zA-Z0-9-]+$/.test(customAliasRaw)) {
    // Valid custom alias
    customAlias = customAliasRaw;
  } else if (customAliasRaw) {
    // Invalid format
    msg.textContent = 'Custom alias can only contain letters, numbers, and hyphens';
    msg.className = 'error';
    return;
  }
  
  console.log('DEBUG: Custom alias processing - raw:', customAliasRaw, 'processed:', customAlias);
  
  const expirationDate = expirationDateEl?.value ? new Date(expirationDateEl.value).getTime() : undefined;
  const enableClickLimitEl = document.getElementById('enableClickLimit');
  const clicksLimit = (enableClickLimitEl?.checked && clicksLimitEl?.value) ? parseInt(clicksLimitEl.value) : undefined;
  const fraudProtectionEnabled = fraudProtectionEnabledEl?.checked || false;
  const blockBots = blockBotsEl?.checked || false;
  const safeLink = safeLinkEl?.value?.trim() || undefined;
  const customDomain = customDomainEl?.value?.trim() || undefined;
  const tiktokPixel = tiktokPixelEl?.value?.trim() || undefined;
  const facebookPixel = facebookPixelEl?.value?.trim() || undefined;
  const enableConversionTracking = enableConversionTrackingEl?.checked || false;
  
  console.log('DEBUG: Advanced Settings values extracted:');
  console.log('- safeLink value:', safeLink);
  console.log('- customDomain value:', customDomain);
  console.log('- tiktokPixel value:', tiktokPixel);
  console.log('- facebookPixel value:', facebookPixel);
  console.log('- enableConversionTracking value:', enableConversionTracking);
  
  // Get targeting rules
  console.log('DEBUG: About to get targeting rules...');
  const targeting = getTargetingRules();
  console.log('DEBUG: Targeting rules retrieved:', targeting);
  console.log('DEBUG: DOM check - globalTargetingRules container:', document.getElementById('globalTargetingRules'));
  console.log('DEBUG: DOM check - globalTargetingRules children:', document.getElementById('globalTargetingRules')?.children);
  console.log('DEBUG: DOM check - globalTargetingRules innerHTML:', document.getElementById('globalTargetingRules')?.innerHTML);
  
  // Check if we have a valid project to save to
  console.log('DEBUG: Current project state:');
  console.log('- currentId:', currentId);
  console.log('- tbody exists:', !!tbody);
  console.log('- tbody rows:', tbody?.querySelectorAll('tr')?.length);
  
  // Get A/B testing settings
  const abTesting = document.getElementById('enableABTesting')?.checked ? {
    enabled: true,
    testType: document.getElementById('testType')?.value || 'split',
    goal: document.getElementById('goal')?.value || 'conversion',
    confidenceLevel: Number(document.getElementById('confidenceLevel')?.value || 95),
    minSampleSize: Number(document.getElementById('minSampleSize')?.value || 1000),
    hypothesis: document.getElementById('hypothesis')?.value || '',
    trafficSplit: '50/50'
  } : { enabled: false };
  
  const body = { 
    name: (projName.value.trim()||'Untitled'), 
    groupId: projGroup.value || '', 
    main: mainInput.value.trim(), 
    items,
    customAlias,
    expiresAt: expirationDate,
    clicksLimit,
    fraudProtection: fraudProtectionEnabled ? {
      enabled: true,
      maxClicksPerIP: 10, // default values
      maxClicksPerSession: 5,
      blockBots,
      suspiciousThreshold: 80
    } : { enabled: false },
    safeLink,
    customDomain,
    pixelSettings: {
      tiktokPixelId: tiktokPixel,
      facebookPixelId: facebookPixel,
      enableConversionTracking,
      enablePageViewTracking: true
    },
    targeting,
    abTesting
  };
  
  console.log('DEBUG: Complete save body:', JSON.stringify(body, null, 2));
  
  try { 
    console.log('DEBUG: About to call saveProject...');
    const result = await saveProject(currentId, body); 
    console.log('DEBUG: saveProject result:', result);
    if(!silent){ 
      msg.textContent='Saved!'; 
      msg.className=''; 
      console.log('DEBUG: Save completed successfully');
    
    // Force refresh of project data after save by reloading it
    setTimeout(async () => {
      try {
        const refreshedProject = await j('/api/projects/' + currentId + '?_t=' + Date.now());
        if (refreshedProject) {
          console.log('DEBUG: Refreshed project data after save:', refreshedProject);
          // Update the form with refreshed data
          projName.value = refreshedProject.name;
          mainInput.value = refreshedProject.main;
        }
      } catch (error) {
        console.log('DEBUG: Error refreshing project after save:', error);
      }
    }, 100);
    }
  }
  catch(e){ 
    console.log('DEBUG: Save failed with error:', e);
    if(!silent){ 
      msg.textContent=e.message||'Save failed'; 
      msg.className='error'; 
    } 
  }
}
const saveBtn = document.getElementById('save');
console.log('DEBUG: Save button element:', saveBtn);
if (saveBtn) {
  saveBtn.onclick=()=>{
    console.log('DEBUG: Save button clicked!');
    console.log('DEBUG: currentId before save:', currentId);
    console.log('DEBUG: tbody exists:', !!tbody);
    console.log('DEBUG: tbody children count:', tbody?.children?.length);
    onSave(false);
  };
} else {
  console.log('ERROR: Save button not found!');
}
delBtn.onclick=async ()=>{ 
  if(!currentId) return; 
  const projectName = projName.value.trim() || 'Untitled Project';
  if(!confirm('Are you sure you would like to delete this project "' + projectName + '"? This action cannot be undone.')) return; 
  await deleteProjectApi(currentId); 
  localStorage.removeItem('ls.currentId'); 
  currentId=null; 
  await renderProjects(); 
  setShareLinks(); 
  tbody.innerHTML=''; 
  projName.value=''; 
  mainInput.value=''; 
  recalc(null); 
};

newGroupBtn.onclick=async ()=>{ const g=await createGroup(); await renderGroups(); currentGroup=g.id; localStorage.setItem('ls.currentGroup',g.id); projectsHeader.textContent='Projects ('+g.name+')'; updateProjectsVisibility(); await renderProjects(); };
allGroupsBtn.onclick=async ()=>{ currentGroup=null; localStorage.removeItem('ls.currentGroup'); projectsHeader.textContent='Projects (All)'; updateAllGroupsButton(); updateProjectsVisibility(); updateLastActivity(); await renderGroups(); await renderProjects(); };
newProjBtn.onclick=async ()=>{ if(!currentGroup){ msg.textContent='Select a group first'; msg.className='error'; return; } const p=await createProject(); if(!p) return; await renderProjects(); await selectProject(p.id); };

// Duplicate project functionality
if (duplicateProjBtn) {
  duplicateProjBtn.onclick=async ()=>{ 
    if(!currentId){ 
      msg.textContent='Select a project to duplicate first'; 
      msg.className='error'; 
      return; 
    } 
    const p=await duplicateProject(); 
    if(!p) return; 
    await renderProjects(); 
    await selectProject(p.id); 
  };
}

if (duplicateProjAnalyticsBtn) {
  duplicateProjAnalyticsBtn.onclick=async ()=>{ 
    if(!currentProject){ 
      alert('Select a project to duplicate first'); 
      return; 
    } 
    const p=await duplicateProject(); 
    if(!p) return; 
    await renderProjects(); 
    await render(); 
  };
}

projGroup.addEventListener('change', ()=>{ queueAutosave(); });
document.getElementById('addRow').onclick=()=>{ tbody.appendChild(row({})); recalc(null); queueAutosave(); };
document.getElementById('reset').onclick=()=>{ tbody.innerHTML=''; tbody.appendChild(row({ url:'https://example.com/a', label:'A'})); tbody.appendChild(row({ url:'https://example.com/b', label:'B'})); recalc(null); queueAutosave(); };
projName.addEventListener('input', ()=>queueAutosave());
mainInput.addEventListener('input', ()=>{ setShareLinks(); queueAutosave(); });

// Add event listener for custom alias input to update smart link in real-time
const customAliasInput = document.getElementById('customAlias');
if (customAliasInput) {
  customAliasInput.addEventListener('input', ()=>{ setShareLinks(); queueAutosave(); });
}

// Tab functionality
function initTabs() {
  const tabs = ['links', 'targeting', 'abTesting', 'bulkLinks', 'advancedSettings', 'userManagement'];
  
  console.log('Initializing tabs:', tabs);
  
  tabs.forEach(tabName => {
    const tabButton = document.getElementById(tabName + 'Tab');
    const tabContent = document.getElementById(tabName + 'Content');
    
    console.log('Tab ' + tabName + ':', { button: tabButton, content: tabContent });
    
    if (tabButton && tabContent) {
      tabButton.onclick = () => {
        console.log('Switching to tab: ' + tabName);
        
        // Hide all tabs
        tabs.forEach(t => {
          const tButton = document.getElementById(t + 'Tab');
          const tContent = document.getElementById(t + 'Content');
          if (tButton) tButton.classList.remove('active');
          if (tContent) tContent.classList.remove('active');
        });
        
        // Show selected tab
        tabButton.classList.add('active');
        tabContent.classList.add('active');
        
        console.log('Tab ' + tabName + ' is now active');
        
        // Tab content is now properly positioned at the same level as other tabs
        
        // Load data when specific tabs are clicked
        if (tabName === 'userManagement') {
          loadUsers();
        }
      };
    } else {
      console.warn('Missing elements for tab ' + tabName + ':', { button: tabButton, content: tabContent });
    }
  });
}

// Initialize tabs when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Content Loaded - initializing tabs...');
  
  // Check if tab elements exist
  const tabNames = ['links', 'targeting', 'abTesting', 'bulkLinks', 'advancedSettings', 'userManagement'];
  tabNames.forEach(name => {
    const button = document.getElementById(name + 'Tab');
    const content = document.getElementById(name + 'Content');
    console.log('Tab ' + name + ':', { button: button, content: content, buttonExists: !!button, contentExists: !!content });
  });
  
  // Small delay to ensure all elements are rendered
  setTimeout(() => {
    initTabs();
    console.log('Tabs initialized with delay');
  }, 500);
});

// Targeting functionality
function createTargetingRule(type = 'geo', field = 'country', operator = 'equals', value = 'US', enabled = true) {
  const ruleDiv = document.createElement('div');
  ruleDiv.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap: 8px; align-items: center; margin-bottom: 8px; padding: 8px; border: 1px solid var(--border); border-radius: 8px;';
  
  ruleDiv.innerHTML = 
    '<select class="rule-type" style="padding: 6px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text);">' +
      '<option value="geo"' + (type === 'geo' ? ' selected' : '') + '>Geography</option>' +
      '<option value="device"' + (type === 'device' ? ' selected' : '') + '>Device</option>' +
      '<option value="time"' + (type === 'time' ? ' selected' : '') + '>Time</option>' +
      '<option value="referrer"' + (type === 'referrer' ? ' selected' : '') + '>Referrer</option>' +
      '<option value="utm"' + (type === 'utm' ? ' selected' : '') + '>UTM</option>' +
    '</select>' +
    '<select class="rule-field" style="padding: 6px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text);">' +
      '<option value="country"' + (field === 'country' ? ' selected' : '') + '>Country</option>' +
      '<option value="city"' + (field === 'city' ? ' selected' : '') + '>City</option>' +
      '<option value="region"' + (field === 'region' ? ' selected' : '') + '>Region</option>' +
      '<option value="deviceType"' + (field === 'deviceType' ? ' selected' : '') + '>Device Type</option>' +
      '<option value="os"' + (field === 'os' ? ' selected' : '') + '>Operating System</option>' +
      '<option value="hour"' + (field === 'hour' ? ' selected' : '') + '>Hour</option>' +
      '<option value="dayOfWeek"' + (field === 'dayOfWeek' ? ' selected' : '') + '>Day of Week</option>' +
      '<option value="utm_source"' + (field === 'utm_source' ? ' selected' : '') + '>UTM Source</option>' +
      '<option value="utm_medium"' + (field === 'utm_medium' ? ' selected' : '') + '>UTM Medium</option>' +
      '<option value="utm_campaign"' + (field === 'utm_campaign' ? ' selected' : '') + '>UTM Campaign</option>' +
    '</select>' +
    '<select class="rule-operator" style="padding: 6px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text);">' +
      '<option value="equals"' + (operator === 'equals' ? ' selected' : '') + '>Equals</option>' +
      '<option value="contains"' + (operator === 'contains' ? ' selected' : '') + '>Contains</option>' +
      '<option value="starts_with"' + (operator === 'starts_with' ? ' selected' : '') + '>Starts With</option>' +
      '<option value="ends_with"' + (operator === 'ends_with' ? ' selected' : '') + '>Ends With</option>' +
      '<option value="regex"' + (operator === 'regex' ? ' selected' : '') + '>Regex</option>' +
      '<option value="not_equals"' + (operator === 'not_equals' ? ' selected' : '') + '>Not Equals</option>' +
      '<option value="not_contains"' + (operator === 'not_contains' ? ' selected' : '') + '>Not Contains</option>' +
    '</select>' +
    '<input type="text" class="rule-value" placeholder="Value" value="' + value + '" style="padding: 6px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text);">' +
    '<div style="display: flex; gap: 4px;">' +
      '<label style="display: flex; align-items: center; gap: 4px;">' +
        '<input type="checkbox" class="rule-enabled"' + (enabled ? ' checked' : '') + ' style="margin: 0;">' +
        '<span style="font-size: 12px;">Active</span>' +
      '</label>' +
      '<button class="ghost delete-rule" type="button" style="padding: 4px 8px; font-size: 12px;">✕</button>' +
    '</div>';
  
  // Add event listeners
  const deleteBtn = ruleDiv.querySelector('.delete-rule');
  if (deleteBtn) {
    deleteBtn.onclick = () => ruleDiv.remove();
  }
  
  // Update field options based on type
  const typeSelect = ruleDiv.querySelector('.rule-type');
  const fieldSelect = ruleDiv.querySelector('.rule-field');
  const valueInput = ruleDiv.querySelector('.rule-value');
  
  if (typeSelect && fieldSelect) {
    typeSelect.onchange = () => {
      updateFieldOptions(fieldSelect, typeSelect.value);
      // Reset field selection and update value options
      fieldSelect.value = fieldSelect.options[0]?.value || '';
      if (valueInput) {
        updateValueOptions(valueInput, typeSelect.value, fieldSelect.value);
      }
    };
  }
  
  // Update value options when field changes
  if (fieldSelect && valueInput) {
    fieldSelect.onchange = () => {
      updateValueOptions(valueInput, typeSelect?.value || 'geo', fieldSelect.value);
    };
  }
  
  // Initialize value options for the current type/field
  if (valueInput) {
    updateValueOptions(valueInput, type, field);
  }
  
  return ruleDiv;
}

function updateFieldOptions(fieldSelect, type) {
  fieldSelect.innerHTML = '';
  
  switch (type) {
    case 'geo':
      fieldSelect.innerHTML = \`
        <option value="country">Country</option>
        <option value="city">City</option>
        <option value="region">Region</option>
      \`;
      break;
    case 'device':
      fieldSelect.innerHTML = \`
        <option value="deviceType">Device Type</option>
        <option value="os">Operating System</option>
        <option value="browser">Browser</option>
      \`;
      break;
    case 'time':
      fieldSelect.innerHTML = \`
        <option value="hour">Hour</option>
        <option value="dayOfWeek">Day of Week</option>
        <option value="month">Month</option>
        <option value="quarter">Quarter</option>
      \`;
      break;
    case 'referrer':
      fieldSelect.innerHTML = \`
        <option value="domain">Domain</option>
        <option value="path">Path</option>
        <option value="type">Type (direct, email, social)</option>
      \`;
      break;
    case 'utm':
      fieldSelect.innerHTML = \`
        <option value="utm_source">UTM Source</option>
        <option value="utm_medium">UTM Medium</option>
        <option value="utm_campaign">UTM Campaign</option>
        <option value="utm_term">UTM Term</option>
        <option value="utm_content">UTM Content</option>
      \`;
      break;
  }
}

// Update value options based on field selection
function updateValueOptions(valueInput, type, field) {
  // Convert input to select dropdown with predefined options
  const parent = valueInput.parentNode;
  const currentValue = valueInput.value;
  
  // Remove existing dropdown if it exists
  const existingSelect = parent.querySelector('.value-dropdown');
  if (existingSelect) {
    existingSelect.remove();
  }
  
  // Create new dropdown
  const select = document.createElement('select');
  select.className = 'value-dropdown';
  select.style.cssText = 'padding: 6px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-subtle); color: var(--text); width: 100%;';
  
  // Add custom option
  const customOption = document.createElement('option');
  customOption.value = 'custom';
  customOption.textContent = 'Custom Value...';
  select.appendChild(customOption);
  
  // Add predefined options based on type and field
  let options = [];
  
  if (type === 'geo' && field === 'country') {
    options = [
      'US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'BR', 'IN', 'CN', 'RU', 'MX', 'IT', 'ES', 'NL', 'SE', 'NO', 'DK', 'FI',
      'OTHER' // For non-major countries
    ];
  } else if (type === 'geo' && field === 'region') {
    options = [
      'North America', 'Europe', 'Asia', 'South America', 'Africa', 'Oceania',
      'US-East', 'US-West', 'US-Central', 'EU-West', 'EU-East', 'APAC', 'LATAM'
    ];
  } else if (type === 'geo' && field === 'city') {
    options = [
      'New York', 'London', 'Tokyo', 'Paris', 'Berlin', 'Moscow', 'Beijing', 'Mumbai', 'São Paulo', 'Sydney',
      'Los Angeles', 'Chicago', 'Toronto', 'Madrid', 'Rome', 'Amsterdam', 'Stockholm', 'Copenhagen', 'Helsinki'
    ];
  } else if (type === 'device' && field === 'deviceType') {
    options = [
      'desktop', 'mobile', 'tablet', 'ios', 'android', 'windows', 'macos', 'linux'
    ];
  } else if (type === 'device' && field === 'os') {
    options = [
      'iOS', 'Android', 'Windows', 'macOS', 'Linux', 'Chrome OS', 'Ubuntu', 'CentOS'
    ];
  } else if (type === 'device' && field === 'browser') {
    options = [
      'Chrome', 'Safari', 'Firefox', 'Edge', 'Opera', 'Brave', 'Internet Explorer'
    ];
  } else if (type === 'time' && field === 'hour') {
    options = [
      'morning (6-12)', 'afternoon (12-18)', 'evening (18-24)', 'night (0-6)', 'business (9-17)'
    ];
  } else if (type === 'time' && field === 'dayOfWeek') {
    options = [
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
      'weekday', 'weekend'
    ];
  } else if (type === 'time' && field === 'month') {
    options = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
  } else if (type === 'time' && field === 'quarter') {
    options = [
      'q1', 'q2', 'q3', 'q4'
    ];
  } else if (type === 'referrer' && field === 'type') {
    options = [
      'direct', 'email', 'social', 'google', 'bing', 'yahoo', 'facebook', 'twitter', 'instagram', 'linkedin'
    ];
  } else if (type === 'utm' && field === 'utm_medium') {
    options = [
      'cpc', 'email', 'social', 'affiliate', 'referral', 'banner', 'video', 'audio', 'print', 'tv'
    ];
  } else if (type === 'utm' && field === 'utm_source') {
    options = [
      'google', 'facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'email', 'newsletter',
      'blog', 'website', 'referral', 'organic', 'paid', 'social', 'display', 'video'
    ];
  } else if (type === 'utm' && field === 'utm_campaign') {
    options = [
      'summer_sale', 'black_friday', 'christmas', 'new_year', 'product_launch', 'brand_awareness',
      'lead_generation', 'conversion', 'retargeting', 'seasonal', 'promotional', 'educational'
    ];
  }
  
  // Add predefined options
  options.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option;
    optionElement.textContent = option;
    select.appendChild(optionElement);
  });
  
  // Set current value if it matches an option
  if (options.includes(currentValue)) {
    select.value = currentValue;
  }
  
  // Handle custom value input
  select.onchange = () => {
    if (select.value === 'custom') {
      // Show text input for custom value
      select.style.display = 'none';
      valueInput.style.display = 'block';
      valueInput.focus();
    } else {
      // Update the hidden input with selected value
      valueInput.value = select.value;
      valueInput.style.display = 'none';
      select.style.display = 'block';
    }
  };
  
  // Replace input with dropdown
  valueInput.style.display = 'none';
  parent.insertBefore(select, valueInput);
  
  // If current value is custom, show input
  if (!options.includes(currentValue) && currentValue) {
    select.value = 'custom';
    select.style.display = 'none';
    valueInput.style.display = 'block';
  }
}

function getTargetingRules() {
  const rules = [];
  const ruleElements = document.querySelectorAll('#globalTargetingRules > div');
  
  console.log('DEBUG getTargetingRules: Found', ruleElements.length, 'rule elements');
  
  ruleElements.forEach((ruleEl, index) => {
    const type = ruleEl.querySelector('.rule-type')?.value || 'geo';
    const field = ruleEl.querySelector('.rule-field')?.value || 'country';
    const operator = ruleEl.querySelector('.rule-operator')?.value || 'equals';
    
    // Check both dropdown and text input for value
    const valueDropdown = ruleEl.querySelector('.value-dropdown')?.value || '';
    const valueText = ruleEl.querySelector('.rule-value')?.value || '';
    const value = (valueDropdown !== 'custom' && valueDropdown) ? valueDropdown : valueText;
    
    const enabled = ruleEl.querySelector('.rule-enabled')?.checked || false;
    
    console.log('DEBUG Rule ' + index + ':', { type, field, operator, valueDropdown, valueText, finalValue: value, enabled });
    
    if (value && value.trim()) {
      rules.push({ type, field, operator, value: value.trim(), enabled });
    }
  });
  
  console.log('DEBUG getTargetingRules: Returning', rules.length, 'rules:', rules);
  return rules;
}

  // A/B Testing functionality
function initABTesting() {
  const enableCheckbox = document.getElementById('enableABTesting');
  const settingsDiv = document.getElementById('abTestingSettings');
  
  if (enableCheckbox && settingsDiv) {
    enableCheckbox.onchange = () => {
      settingsDiv.style.display = enableCheckbox.checked ? 'block' : 'none';
      if (enableCheckbox.checked) {
        loadABTestingResults();
      }
    };
  }
  
  // Initialize refresh button
  const refreshBtn = document.getElementById('refreshABResults');
  if (refreshBtn) {
    refreshBtn.onclick = loadABTestingResults;
  }
}

// Load and display A/B testing results
async function loadABTestingResults() {
  if (!currentId) return;
  
  try {
    const response = await fetch(\`/api/ab-testing/results?project=\${currentId}\`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.error('Failed to load A/B testing results');
      return;
    }
    
    const data = await response.json();
    displayABTestingResults(data);
  } catch (error) {
    console.error('Error loading A/B testing results:', error);
  }
}

// Display A/B testing results in the UI
function displayABTestingResults(data) {
  const resultsContent = document.getElementById('abResultsContent');
  const noResults = document.getElementById('abNoResults');
  const tableBody = document.getElementById('abResultsTableBody');
  
  if (!data.results || data.results.length === 0) {
    if (resultsContent) resultsContent.style.display = 'none';
    if (noResults) noResults.style.display = 'block';
    return;
  }
  
  // Show results content
  if (resultsContent) resultsContent.style.display = 'block';
  if (noResults) noResults.style.display = 'none';
  
  // Update summary badges
  const totalTests = document.getElementById('abTotalTests');
  const significantResults = document.getElementById('abSignificantResults');
  const bestVariant = document.getElementById('abBestVariant');
  const confidence = document.getElementById('abConfidence');
  
  if (totalTests) totalTests.textContent = data.results.length;
  
  const significantCount = data.results.filter(r => r.isSignificant).length;
  if (significantResults) significantResults.textContent = significantCount;
  
  // Find best variant (highest lift)
  const bestResult = data.results.reduce((best, current) => 
    current.lift > best.lift ? current : best, data.results[0]);
  
  if (bestVariant) bestVariant.textContent = bestResult.variant;
  if (confidence) confidence.textContent = bestResult.confidence.toFixed(1) + '%';
  
  // Populate results table
  if (tableBody) {
    tableBody.innerHTML = '';
    
    data.results.forEach(result => {
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid var(--border)';
      
      row.innerHTML = \`
        <td style="padding: 12px 8px; font-weight: 600;">\${result.variant}</td>
        <td style="text-align: center; padding: 12px 8px;">\${result.clicks.toLocaleString()}</td>
        <td style="text-align: center; padding: 12px 8px;">\${(result.conversionRate * 100).toFixed(2)}%</td>
        <td style="text-align: center; padding: 12px 8px; color: \${result.lift > 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">
          \${result.lift > 0 ? '+' : ''}\${result.lift.toFixed(1)}%
        </td>
        <td style="text-align: center; padding: 12px 8px;">\${result.confidence.toFixed(1)}%</td>
        <td style="text-align: center; padding: 12px 8px;">
          <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; 
                       background: \${result.isSignificant ? 'var(--success)' : 'var(--text-muted)'}; color: white;">
            \${result.isSignificant ? '✓ Significant' : 'Not Significant'}
          </span>
        </td>
      \`;
      
      tableBody.appendChild(row);
    });
  }
}
// Bulk Links functionality
function initBulkLinks() {
  const createBtn = document.getElementById('createBulkLink');
  
  if (createBtn) {
    createBtn.onclick = async () => {
      const name = document.getElementById('bulkLinkName')?.value?.trim();
      const urlsText = document.getElementById('bulkLinkUrls')?.value?.trim();
      
      if (!name || !urlsText) {
        alert('Please provide both a name and URLs');
        return;
      }
      
      const urls = urlsText.split('\\n').filter(url => url.trim());
      if (urls.length === 0) {
        alert('Please provide at least one valid URL');
        return;
      }
      
      try {
        const response = await fetch('/api/bulk-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            projectId: currentId,
            name,
            urls
          })
        });
        
        if (response.ok) {
          alert('Bulk link group created successfully!');
          document.getElementById('bulkLinkName').value = '';
          document.getElementById('bulkLinkUrls').value = '';
          loadBulkLinks();
        } else {
          alert('Failed to create bulk link group');
        }
      } catch (error) {
        alert('Error creating bulk link group: ' + error.message);
      }
    };
  }
}

async function loadBulkLinks() {
  if (!currentId) return;
  
  try {
    const response = await fetch(\`/api/bulk-links/\${currentId}\`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const bulkLinks = await response.json();
      const container = document.getElementById('bulkLinksList');
      
      if (container) {
        container.innerHTML = '';
        
        bulkLinks.forEach(link => {
          const linkDiv = document.createElement('div');
          linkDiv.style.cssText = 'padding: 12px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px;';
          linkDiv.innerHTML = \`
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong>\${link.name}</strong>
              <button class="ghost delete-bulk-link" data-id="\${link.id}" style="padding: 4px 8px; font-size: 12px;">Delete</button>
            </div>
            <div style="font-size: 14px; opacity: 0.8;">
              \${link.urls.length} URLs • Created \${new Date(link.createdAt || Date.now()).toLocaleDateString()}
            </div>
          \`;
          
          container.appendChild(linkDiv);
        });
      }
    }
  } catch (error) {
    console.error('Error loading bulk links:', error);
  }
}

// Team Management Functions
async function loadTeams() {
  try {
    const teams = await j('/api/teams');
    renderTeams(teams);
  } catch (error) {
    console.error('Error loading teams:', error);
  }
}

function renderTeams(teams) {
  const tbody = document.getElementById('teamsTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (teams.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px; opacity: 0.7;">No teams created yet</td></tr>';
    return;
  }
  
  teams.forEach(team => {
    const row = document.createElement('tr');
    row.innerHTML = \`
      <td>\${team.name}</td>
      <td>\${team.description || '-'}</td>
      <td>\${team.members.length}</td>
      <td>
        <span class="badge" style="background: \${team.isActive ? 'var(--success)' : 'var(--text-muted)'}; color: white;">
          \${team.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>
        <button class="btn btn-icon ghost" onclick="editTeam('\${team.id}')" style="padding: 4px 8px; font-size: 12px;">✎</button>
<button class="btn btn-icon ghost" onclick="deleteTeam('\${team.id}')" style="padding: 4px 8px; font-size: 12px;">🗑</button>
      </td>
    \`;
    tbody.appendChild(row);
  });
}

function initTeamModals() {
  // Create Team Modal
  const createTeamBtn = document.getElementById('createTeamBtn');
  const createTeamModal = document.getElementById('createTeamModal');
  const cancelCreateTeam = document.getElementById('cancelCreateTeam');
  const saveNewTeam = document.getElementById('saveNewTeam');
  
  if (createTeamBtn && createTeamModal) {
    createTeamBtn.onclick = () => {
      createTeamModal.style.display = 'flex';
    };
    
    if (cancelCreateTeam) {
      cancelCreateTeam.onclick = () => {
        createTeamModal.style.display = 'none';
      };
    }
    
    if (saveNewTeam) {
      saveNewTeam.onclick = async () => {
        const name = document.getElementById('newTeamName').value.trim();
        const description = document.getElementById('newTeamDescription').value.trim();
        
        if (!name) {
          alert('Team name is required');
          return;
        }
        
        try {
          await j('/api/teams', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name, description })
          });
          
          createTeamModal.style.display = 'none';
          document.getElementById('newTeamName').value = '';
          document.getElementById('newTeamDescription').value = '';
        } catch (error) {
          alert('Error creating team: ' + error.message);
        }
      };
    }
  }
}

// User Management Functions
async function loadUsers() {
  try {
    const users = await j('/api/users');
    renderUsers(users);
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px; opacity: 0.7;">No users found</td></tr>';
    return;
  }
  
  users.forEach(user => {
    const row = document.createElement('tr');
    row.innerHTML = \`
      <td>\${user.name}</td>
      <td>\${user.email}</td>
      <td>
        <span class="badge" style="background: \${user.role === 'admin' ? 'var(--danger)' : user.role === 'editor' ? 'var(--warning)' : 'var(--text-muted)'}; color: white;">
          \${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
        </span>
      </td>
      <td>
        <span class="badge" style="background: \${user.isActive ? 'var(--success)' : 'var(--text-muted)'}; color: white;">
          \${user.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>
        <button class="btn btn-icon ghost" onclick="editUser('\${user.id}')" style="padding: 4px 12px; font-size: 12px;">✎</button>
<button class="btn btn-icon ghost" onclick="deleteUser('\${user.id}')" style="padding: 4px 12px; font-size: 12px;">🗑</button>
      </td>
    \`;
    tbody.appendChild(row);
  });
}

function initUserModals() {
  // Add User Modal
  const addUserBtn = document.getElementById('addUserBtn');
  const addUserModal = document.getElementById('addUserModal');
  const cancelAddUser = document.getElementById('cancelAddUser');
  const saveNewUser = document.getElementById('saveNewUser');
  const closeUsersTab = document.getElementById('closeUsersTab');
  
  if (addUserBtn && addUserModal) {
    addUserBtn.onclick = () => {
      addUserModal.style.display = 'flex';
    };
    
    if (cancelAddUser) {
      cancelAddUser.onclick = () => {
        addUserModal.style.display = 'none';
      };
    }
    
    if (saveNewUser) {
      saveNewUser.onclick = async () => {
        console.log('DEBUG: Save new user clicked');
        const name = document.getElementById('newUserName').value.trim();
        const email = document.getElementById('newUserEmail').value.trim();
        const password = document.getElementById('newUserPassword').value;
        const role = document.getElementById('newUserRole').value;
        
        console.log('DEBUG: User data:', { name, email, role });
        
        if (!name || !email || !password) {
          alert('Name, email, and password are required');
          return;
        }
        
        if (password.length < 6) {
          alert('Password must be at least 6 characters long');
          return;
        }
        
        try {
          console.log('DEBUG: Sending user creation request...');
          const result = await j('/api/users', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name, email, password, role })
          });
          
          console.log('DEBUG: User creation result:', result);
          const loginUrl = window.location.origin + '/login';
          alert('User created successfully! Share this login link with them:\\n\\n' + loginUrl + '\\n\\nThey can log in using their email: ' + email + ' and the password you just set.');
          
          addUserModal.style.display = 'none';
          document.getElementById('newUserName').value = '';
          document.getElementById('newUserEmail').value = '';
          document.getElementById('newUserPassword').value = '';
          document.getElementById('newUserRole').value = 'viewer';
        } catch (error) {
          console.error('DEBUG: User creation error:', error);
          alert('Error creating user: ' + error.message);
        }
      };
    }
  }
  
  // Close Users Tab button
  if (closeUsersTab) {
    closeUsersTab.onclick = () => {
      // Switch back to Links tab
      const linksTab = document.getElementById('linksTab');
      const linksContent = document.getElementById('linksContent');
      const userManagementTab = document.getElementById('userManagementTab');
      const userManagementContent = document.getElementById('userManagementContent');
      
      if (linksTab && linksContent && userManagementTab && userManagementContent) {
        // Deactivate users tab
        userManagementTab.classList.remove('active');
        userManagementContent.classList.remove('active');
        
        // Activate links tab
        linksTab.classList.add('active');
        linksContent.classList.add('active');
      }
    };
  }
}

// User edit/delete functions
window.editUser = function(userId) {
  // Find the user data
  const user = window.cachedUsers?.find(u => u.id === userId);
  if (!user) {
    alert('User not found');
    return;
  }
  
  // Show edit modal
  const modal = document.getElementById('editUserModal');
  if (modal) {
    // Populate form fields
    const nameInput = document.getElementById('editUserName');
    const emailInput = document.getElementById('editUserEmail');
    const roleSelect = document.getElementById('editUserRole');
    const passwordInput = document.getElementById('editUserPassword');
    
    if (nameInput) nameInput.value = user.name || '';
    if (emailInput) emailInput.value = user.email || '';
    if (roleSelect) roleSelect.value = user.role || 'editor';
    if (passwordInput) passwordInput.value = ''; // Clear password field
    
    // Store user ID for update
    modal.setAttribute('data-user-id', userId);
    
    // Show modal
    modal.style.display = 'block';
  }
};

window.deleteUser = async function(userId) {
  if (!confirm('Are you sure you want to delete this user?')) return;
  
  try {
    await j('/api/users/' + userId, { method: 'DELETE' });
  } catch (error) {
    alert('Error deleting user: ' + error.message);
  }
};

// Team edit/delete functions  
window.editTeam = function(teamId) {
  alert('Edit team functionality - coming soon!');
};

window.deleteTeam = async function(teamId) {
  if (!confirm('Are you sure you want to delete this team?')) return;
  
  try {
    await j('/api/teams/' + teamId, { method: 'DELETE' });
  } catch (error) {
    alert('Error deleting team: ' + error.message);
  }
};

// Initialize all functionality
function initAllFeatures() {
  initTabs();
  initABTesting();
  initBulkLinks();
  initUserModals();
  initTeamModals();
  
  // Setup users tab for admin
  setupUsersTab();
  
  // Add global rule button functionality
  const addGlobalRuleBtn = document.getElementById('addGlobalRule');
  if (addGlobalRuleBtn) {
    addGlobalRuleBtn.onclick = () => {
      const container = document.getElementById('globalTargetingRules');
      if (container) {
        container.appendChild(createTargetingRule());
      }
    };
  }
}

// Setup users tab for admin
function setupUsersTab() {
  const usersTab = document.getElementById("usersTab");
  if (usersTab) {
    usersTab.onclick = (e) => {
      e.preventDefault();
      // Switch to Users tab (reuse existing modal functionality)
      const userManagementTab = document.getElementById("userManagementTab");
      if (userManagementTab) {
        userManagementTab.click();
      }
    };
  }
}

// Setup teams tab for admin
function setupTeamsTab() {
  const teamsTab = document.getElementById("teamsTab");
  if (teamsTab) {
    teamsTab.onclick = (e) => {
      e.preventDefault();
      // Switch to Teams tab (reuse existing modal functionality)
      const teamWorkspacesTab = document.getElementById("teamWorkspacesTab");
      if (teamWorkspacesTab) {
        teamWorkspacesTab.click();
      }
    };
  }
}

initAllFeatures();

// Setup filter and pagination event listeners
function setupFilterAndPagination() {
  // Group filter
  const groupFilter = document.getElementById('groupFilter');
  if (groupFilter) {
    groupFilter.addEventListener('change', (e) => {
      currentGroupFilter = e.target.value;
      currentGroupPage = 1; // Reset to first page
      renderGroups();
    });
  }
  
  // Project filter  
  const projectFilter = document.getElementById('projectFilter');
  if (projectFilter) {
    projectFilter.addEventListener('change', (e) => {
      currentProjectFilter = e.target.value;
      currentProjectPage = 1; // Reset to first page
      renderProjects();
    });
  }
  
  // Group pagination
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentGroupPage > 1) {
        currentGroupPage--;
        renderGroups();
      }
    });
  }
  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      currentGroupPage++;
      renderGroups();
    });
  }
  
  // Project pagination
  const prevProjectPageBtn = document.getElementById('prevProjectPage');
  const nextProjectPageBtn = document.getElementById('nextProjectPage');
  if (prevProjectPageBtn) {
    prevProjectPageBtn.addEventListener('click', () => {
      if (currentProjectPage > 1) {
        currentProjectPage--;
        renderProjects();
      }
    });
  }
  if (nextProjectPageBtn) {
    nextProjectPageBtn.addEventListener('click', () => {
      currentProjectPage++;
      renderProjects();
    });
  }
}

// Setup filter and pagination
setupFilterAndPagination();

// Load current user info
async function loadCurrentUser() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    if (response.ok) {
      const user = await response.json();
      const userInfo = document.getElementById('currentUserInfo');
      const logoutBtn = document.getElementById('logoutBtn');
      const adminSections = document.getElementById('adminSections');
      
      if (userInfo && user.name) {
        userInfo.textContent = '👤 ' + user.name + ' (' + user.role + ')';
        
        // Expose current user globally for UI helpers
        window.currentUser = user;
        
        // Show users tab for admin users
        const usersTab = document.getElementById("usersTab");
        if (usersTab && user.role === 'admin') {
          usersTab.style.display = 'inline';
        }
        
        // Show teams tab for admin users
        const teamsTab = document.getElementById("teamsTab");
        if (teamsTab && user.role === 'admin') {
          teamsTab.style.display = 'inline';
        }
        
        if (logoutBtn) {
          logoutBtn.style.display = 'block';
          logoutBtn.onclick = async () => {
            try {
              await fetch('/api/auth/logout', { 
                method: 'POST', 
                credentials: 'include' 
              });
              window.location.href = '/login';
            } catch (error) {
              console.error('Logout error:', error);
            }
          };
        }
      }
    }
  } catch (error) {
    console.log('No user session found');
  }
}

// Load user info on page load
loadCurrentUser();

// Toggle users tab visibility function
window.toggleUsersTab = function() {
  const userManagementTab = document.getElementById("userManagementTab");
  const userManagementContent = document.getElementById("userManagementContent");
  
  if (userManagementTab && userManagementContent) {
    const isVisible = userManagementTab.style.display !== 'none';
    
    if (isVisible) {
      // Hide the users tab
      userManagementTab.style.display = 'none';
      userManagementContent.style.display = 'none';
      
      // If users tab was active, switch to links tab
      if (userManagementTab.classList.contains('active')) {
        const linksTab = document.getElementById("linksTab");
        const linksContent = document.getElementById("linksContent");
        if (linksTab && linksContent) {
          userManagementTab.classList.remove('active');
          userManagementContent.classList.remove('active');
          linksTab.classList.add('active');
          linksContent.classList.add('active');
        }
      }
      
      console.log('Users tab hidden. To show it again, run: toggleUsersTab()');
    } else {
      // Show the users tab
      userManagementTab.style.display = 'inline-block';
      userManagementContent.style.display = 'block';
      console.log('Users tab shown.');
    }
  }
};

// ===== Editor Page: Project Selection Helpers =====
function normalizeId(id) {
  return id != null ? String(id) : '';
}

function getCurrentEditorProject() {
  return normalizeId(localStorage.getItem('editor.currentProject'));
}

function setCurrentEditorProject(id) {
  const v = normalizeId(id);
  localStorage.setItem('editor.currentProject', v);
  return v;
}

function updateProjectSelectionUI() {
  console.log('DEBUG: updateProjectSelectionUI called');
  const buttons = document.querySelectorAll('#projList .ui-list-rows button');
  console.log('DEBUG: Found', buttons.length, 'buttons');
  const targetId = getCurrentEditorProject();
  console.log('DEBUG: Target ID:', targetId);
  
  // Only update if we have a target ID
  if (!targetId) {
    console.log('DEBUG: No target ID, skipping update');
    return;
  }
  
  buttons.forEach(btn => {
    const bid = normalizeId(btn.dataset.projectId || btn.getAttribute('data-project-id') || btn.value || btn.textContent);
    console.log('DEBUG: Button ID:', bid, 'Target:', targetId, 'Match:', bid === targetId);
    if (bid === targetId) {
      btn.classList.add('selected');
      btn.closest('.list-item')?.classList.add('selected');
      console.log('DEBUG: Added selected class to button:', bid);
    } else {
      btn.classList.remove('selected');
      btn.closest('.list-item')?.classList.remove('selected');
    }
  });
}

// Editor page bootstrap for project selection
document.addEventListener('DOMContentLoaded', () => {
  // If nothing is selected, optionally choose the first visible project deterministically:
  const saved = getCurrentEditorProject();
  const firstBtn = document.querySelector('#projList .ui-list-rows button');
  if (!saved && firstBtn) {
    setCurrentEditorProject(firstBtn.dataset.projectId || firstBtn.value || firstBtn.textContent);
  }

  // Clear any accidental focus on refresh
  if (document.activeElement && document.activeElement.closest('#projList')) {
    document.activeElement.blur();
  }

  updateProjectSelectionUI();
});

// boot
renderGroups().then(renderProjects).then(()=>{ setShareLinks(); updateProjectsVisibility(); }).catch(e => {
  msg.textContent = 'Failed to load data: ' + e.message;
  msg.className = 'error';
});
</script>
</body></html>`;
}

/* ================= HTML: Analytics ================= */
async function analyticsHtml(env?: Env): Promise<string> {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>link-splitter | analytics</title>
<style>
:root {
  /* Unified Theme Variables - Shared with Editor Page */
  --bg-app: #0E141B;                           /* page shell */
  --bg-panel: #171E26;                         /* all cards, sidebars, tables, forms */
  --bg-subtle: #1F2731;                        /* inputs, tab bars, list rows */
  --border: #2A3340;                            /* default borders/dividers */
  --border-hover: #3B4452;                      /* darker on hover, not lighter */
  --border-focus: #4F46E5;                      /* indigo-600 for focus */
  --border-active: #4F46E5;                     /* indigo-600 */
  --focus-ring: #818CF8;                        /* 2px ring */
  --text: #E8EDF3;                             /* primary text */
  --text-muted: #B9C2CF;                        /* labels/inactive tabs */
  --text-subtle: #8994A3;                       /* helper/placeholder text */
  --primary: #6366F1;                           /* indigo-500 */
  --primary-strong: #4F46E5;                    /* hover/active */
  --primary-weak: #1E1B4B;                      /* soft indigo tint for selected */
  --success: #22C55E;                           /* Success green */
  --warning: #F59E0B;                           /* Warning amber */
  --danger: #EF4444;                            /* Danger red */
  
  /* Legacy mappings for compatibility */
  --bg: var(--bg-app);
  --card: var(--bg-panel);
  --input: var(--bg-subtle);
  --hover: var(--bg-subtle);
  --text-color: var(--text);
  --border-color: var(--border);
  --button-bg: var(--bg-panel);
  --button-hover-bg: var(--bg-subtle);
}


/* Remove system preference override - we want manual control */

/* Ensure full page uses dark slate background */
body {
  background: var(--bg) !important;
  color: var(--text) !important;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}



/* Ensure all elements inherit dark theme colors */
.dark-theme * {
  color: var(--text) !important;
}

.dark-theme .card {
  background: var(--card) !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
}

.dark-theme input, .dark-theme select, .dark-theme textarea {
  background: var(--input) !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
}

.dark-theme button.ghost {
  background: transparent !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
}

.dark-theme button.ghost:hover {
  background: var(--hover) !important;
  border-color: var(--primary) !important;
}

.dark-theme button.ghost.selected {
  border-color: var(--primary) !important;
  background: var(--hover) !important;
  color: var(--primary) !important;
}

.dark-theme .table th,
.dark-theme .table td {
  color: var(--text) !important;
  border-color: var(--border) !important;
}

.dark-theme .badge {
  background: var(--hover) !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
}

/* Theme toggle button styling */
.theme-toggle {
  background: var(--card);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
}

.theme-toggle:hover {
  background: var(--hover);
  border-color: var(--primary);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.theme-toggle .icon {
  font-size: 16px;
}

/* Dark theme specific toggle button styling */
.dark-theme .theme-toggle {
  background: var(--card) !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
}

.dark-theme .theme-toggle:hover {
  background: var(--hover) !important;
  border-color: var(--primary) !important;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

body { 
  font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif; 
  margin:0; 
  padding:24px; 
  background: var(--bg) !important;
  color: var(--text) !important;
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* Ensure all text elements are visible */
* {
  color: inherit !important;
}

/* Override specific element colors */
.container, .card, .list, .table, th, td, span, div, p, h1, h2, h3, h4, h5, h6 {
  color: var(--text) !important;
}

/* Additional dark theme overrides for better visibility */
.dark-theme .stats-grid .stat-card {
  background: var(--card) !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
}

.dark-theme .activity-feed .activity-item {
  background: var(--card) !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
}

.dark-theme .chart-container {
  background: var(--card) !important;
  border-color: var(--border) !important;
}

.dark-theme .filters-panel {
  background: var(--card) !important;
  border-color: var(--border) !important;
}

.dark-theme .pagination-controls button {
  background: var(--input) !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
}

.dark-theme .pagination-controls button:hover {
  background: var(--hover) !important;
  border-color: var(--primary) !important;
}

/* Comprehensive dark theme overrides for all dashboard elements */
.dark-theme .dashboard-container,
.dark-theme .analytics-container {
  background: var(--bg) !important;
  color: var(--text) !important;
}

.dark-theme .header-bar,
.dark-theme .section-header {
  background: var(--card) !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
}

.dark-theme .data-table,
.dark-theme .activity-table {
  background: var(--card) !important;
  border-color: var(--border) !important;
}

.dark-theme .data-table th,
.dark-theme .data-table td,
.dark-theme .activity-table th,
.dark-theme .activity-table td {
  background: var(--card) !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
}

.dark-theme .table-header {
  background: var(--hover) !important;
  color: var(--text) !important;
}

.dark-theme .filter-options,
.dark-theme .checkbox-container {
  background: var(--card) !important;
  color: var(--text) !important;
}

.dark-theme .checkbox-container input[type="checkbox"] {
  background: var(--input) !important;
  border-color: var(--border) !important;
}

.dark-theme .analytics-menu,
.dark-theme .menu-item {
  background: var(--card) !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
}

.dark-theme .menu-item:hover {
  background: var(--hover) !important;
  border-color: var(--primary) !important;
}

.dark-theme .menu-item.active {
  background: var(--primary) !important;
  color: white !important;
}

.dark-theme .delete-button,
.dark-theme .refresh-button {
  background: var(--input) !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
}

.dark-theme .delete-button:hover {
  background: #dc2626 !important;
  color: white !important;
}

.dark-theme .refresh-button:hover {
  background: var(--primary) !important;
  color: white !important;
}

.dark-theme .sidebar-toggle {
  background: var(--card) !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
}

.dark-theme .sidebar-toggle:hover {
  background: var(--hover) !important;
  border-color: var(--primary) !important;
}

/* Ensure all text elements are visible */
.dark-theme h1, .dark-theme h2, .dark-theme h3, .dark-theme h4, .dark-theme h5, .dark-theme h6,
.dark-theme p, .dark-theme span, .dark-theme div, .dark-theme label {
  color: var(--text) !important;
}

/* Override any remaining white backgrounds */
.dark-theme * {
  background-color: var(--bg) !important;
}

.dark-theme .card,
.dark-theme .container,
.dark-theme .section,
.dark-theme .panel {
  background-color: var(--card) !important;
}

/* Ensure buttons and interactive elements are visible */
.dark-theme button,
.dark-theme input,
.dark-theme select,
.dark-theme textarea {
  background-color: var(--input) !important;
  color: var(--text) !important;
  border-color: var(--border) !important;
}

.container { 
  max-width:1200px; 
  margin:0 auto; 
  display:grid; 
  grid-template-columns: 260px 260px 1fr; 
  gap:16px; 
}

.card { 
  border:1px solid var(--border); 
  border-radius:14px; 
  padding:14px; 
  background: var(--card);
  transition: all 0.3s ease;
}
h1 { margin:0 0 12px; }
button { padding:8px 12px; border-radius:10px; border:1px solid transparent; cursor:pointer; }
button.ghost { 
  background: transparent; 
  border-color: var(--border); 
  color: var(--text);
  transition: all 0.3s ease;
}

button.ghost:hover {
  background: var(--hover);
  border-color: var(--primary);
}

button.ghost.selected { 
  border-color: var(--primary) !important; 
  background: var(--hover); 
  color: var(--primary);
}
.table { width:100%; border-collapse:collapse; margin-top:8px; }
th,td { text-align:left; padding:8px; }
tr+tr td { border-top:1px solid var(--border); }
.badge { padding:2px 6px; border-radius:6px; border:1px solid var(--border); }
.small { font-size:12px; opacity:.8 }
.headerrow { display:flex; justify-content:space-between; align-items:center; gap:8px; }

/* Theme toggle styles */
.theme-toggle {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 2px solid var(--primary);
  background: var(--primary);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: all 0.3s ease;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

.theme-toggle:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
  background: var(--accent);
  border-color: var(--accent);
}

.theme-toggle.dark {
  background: var(--dark-primary);
  border-color: var(--dark-primary);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

/* Additional styling for inputs and other elements */
input[type="url"], 
input[type="text"], 
input[type="number"], 
input[type="datetime-local"],
select, 
textarea {
  background: var(--input) !important;
  color: var(--text) !important;
  border-color: var(--border) !important;
  transition: all 0.3s ease;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--primary) !important;
  outline: none;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
}

.table th {
  background: var(--hover);
  color: var(--text);
  font-weight: 600;
}

.table tbody tr:hover {
  background: var(--hover);
}

/* Analytics specific styles */
.analytics-section {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.section-header h3 {
  color: var(--text);
  margin: 0 0 12px 0;
}

/* Sidebar styling */
.left-sidebar {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}

.groups-section, .projects-section {
  background: transparent;
}

/* Projects Section - Enhanced prominence */
.projects-section {
  margin-bottom: 24px; /* More spacing to emphasize prominence */
  padding: 16px;
  border-radius: 12px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
}

/* Groups Section - Reduced visual weight */
.groups-section {
  margin-bottom: 16px; /* Less spacing to feel secondary */
  padding: 12px;
  border-radius: 8px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
}

.groups-section strong, .projects-section strong {
  color: var(--text);
}

/* Stats grid styling */
.stats-grid {
  background: var(--card);
  border: 1px solid var(--border);
}

/* Ensure all headings use proper text color */
h1, h2, h3, h4, h5, h6 {
  color: var(--text);
}

/* Badge improvements */
.badge {
  background: var(--hover);
  color: var(--text);
  border: 1px solid var(--border);
}

/* Link styling */
a {
  color: var(--primary);
  text-decoration: none;
}

a:hover {
  color: var(--accent);
  text-decoration: underline;
}

/* Analytics Page Styles */
.container {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 24px;
  padding: 0 16px;
}

.left-sidebar {
  display: flex;
  flex-direction: column;
  gap: 24px;
  transition: transform 0.3s ease, opacity 0.3s ease, width 0.3s ease;
  position: relative;
}

.left-sidebar.hidden {
  transform: translateX(-100%);
  opacity: 0;
  width: 0;
  overflow: hidden;
}

.container.sidebar-hidden {
  grid-template-columns: 0 1fr;
}

.sidebar-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.toggle-sidebar-btn {
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.toggle-sidebar-btn:hover {
  background: var(--bg-subtle);
  border-color: var(--border-hover);
}

.show-sidebar-btn {
  position: fixed;
  top: 50%;
  left: 10px;
  z-index: 1000;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 12px 8px;
  border-radius: 0 6px 6px 0;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s ease;
  transform: translateY(-50%);
}

.show-sidebar-btn:hover {
  background: var(--bg-subtle);
  border-color: var(--border-hover);
  left: 15px;
}

.groups-section, .projects-section {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}



.groups-section .headerrow, .projects-section .headerrow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
  margin-top: 8px;
}

/* Projects header - ensure proper button alignment and prominence */
.projects-section .headerrow {
  margin-bottom: 20px; /* More space for prominence */
}

.projects-section .headerrow div {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* Projects and Groups section buttons - basic layout only (row styling handled by .ui-list-rows) */
.groups-section button, .projects-section button {
  width: 100%;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}

/* ===== SHARED LIST ROW SPECIFICATION ===== */
/* Global utility class for consistent Projects and Groups lists across all pages */
.ui-list-rows {
  gap: 0; /* Remove any container gaps */
}

.ui-list-rows button,
.ui-list-rows .item,
.ui-list-rows .project-item,
.ui-list-rows .project,
.ui-list-rows [data-role="project-item"],
.ui-list-rows .group-item,
.ui-list-rows .group,
.ui-list-rows [data-role="group-item"] {
  /* Base row specifications */
  height: 42px; /* Target: 40-44px content area */
  padding: 11px 14px; /* Target: 10-12px vertical, 12-16px horizontal */
  font-size: 15px; /* Target: 15-16px body */
  line-height: 1.4;
  border-bottom: 1px solid var(--border);
  background: var(--bg-panel);
  color: var(--text);
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s ease;
  box-sizing: border-box;
  border-radius: 0; /* Flat rows, no rounded corners */
  border-top: none;
  border-left: none;
  border-right: none;
  position: relative; /* For ::after focus ring */
}

/* Last row - no divider */
.ui-list-rows button:last-child,
.ui-list-rows .item:last-child,
.ui-list-rows .project-item:last-child,
.ui-list-rows .project:last-child,
.ui-list-rows [data-role="project-item"]:last-child,
.ui-list-rows .group-item:last-child,
.ui-list-rows .group:last-child,
.ui-list-rows [data-role="group-item"]:last-child {
  border-bottom: 0;
}

/* Hover state */
.ui-list-rows button:hover,
.ui-list-rows .item:hover,
.ui-list-rows .project-item:hover,
.ui-list-rows .project:hover,
.ui-list-rows [data-role="project-item"]:hover,
.ui-list-rows .group-item:hover,
.ui-list-rows .group:hover,
.ui-list-rows [data-role="group-item"]:hover {
  border-bottom-color: var(--border-hover);
  background: color-mix(in oklab, var(--focus-ring) 7%, transparent);
}

/* Active/selected row - enhanced indigo treatment with rounded focus ring */
.ui-list-rows button.selected,
.ui-list-rows .item.selected,
.ui-list-rows .group-item.selected,
.ui-list-rows .group.selected,
.ui-list-rows [data-role="group-item"].selected {
  background: var(--primary-weak);
  border-left: 4px solid var(--primary);
  border-bottom: 1px solid var(--border);
}

/* Rounded focus ring for selected rows */
.ui-list-rows button.selected::after,
.ui-list-rows .item.selected::after,
.ui-list-rows .group-item.selected::after,
/* REMOVED: This was adding light purple borders to selected items */
.ui-list-rows .group.selected::after,
.ui-list-rows [data-role="group-item"].selected::after {
  content: none !important;
}

/* Badges - consistent styling across all pages */
.ui-list-rows button span[style*="ADMIN"],
.ui-list-rows button span[style*="EDITOR"],
.ui-list-rows .item span[style*="ADMIN"],
.ui-list-rows .item span[style*="EDITOR"],
.ui-list-rows .project-item span[style*="ADMIN"],
.ui-list-rows .project-item span[style*="EDITOR"],
.ui-list-rows .project span[style*="ADMIN"],
.ui-list-rows .project span[style*="EDITOR"],
.ui-list-rows [data-role="project-item"] span[style*="ADMIN"],
.ui-list-rows [data-role="project-item"] span[style*="EDITOR"],
.ui-list-rows .group-item span[style*="ADMIN"],
.ui-list-rows .group-item span[style*="EDITOR"],
.ui-list-rows .group span[style*="ADMIN"],
.ui-list-rows .group span[style*="EDITOR"],
.ui-list-rows [data-role="group-item"] span[style*="ADMIN"],
.ui-list-rows [data-role="group-item"] span[style*="EDITOR"] {
  height: 28px;
  padding: 4px 10px;
  font-size: 14px;
  border-radius: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-left: 8px;
  opacity: 0.7; /* Default 70% opacity */
  transition: opacity 0.2s ease;
}

/* Badge hover state */
.ui-list-rows button:hover span[style*="ADMIN"],
.ui-list-rows button:hover span[style*="EDITOR"],
.ui-list-rows .item:hover span[style*="ADMIN"],
.ui-list-rows .item:hover span[style*="EDITOR"],
.ui-list-rows .project-item:hover span[style*="ADMIN"],
.ui-list-rows .project-item:hover span[style*="ADMIN"],
.ui-list-rows .project:hover span[style*="ADMIN"],
.ui-list-rows .project:hover span[style*="EDITOR"],
.ui-list-rows [data-role="project-item"]:hover span[style*="ADMIN"],
.ui-list-rows [data-role="project-item"]:hover span[style*="EDITOR"],
.ui-list-rows .group-item:hover span[style*="ADMIN"],
.ui-list-rows .group-item:hover span[style*="EDITOR"],
.ui-list-rows .group:hover span[style*="ADMIN"],
.ui-list-rows .group:hover span[style*="EDITOR"],
.ui-list-rows [data-role="group-item"]:hover span[style*="ADMIN"],
.ui-list-rows [data-role="group-item"]:hover span[style*="EDITOR"] {
  opacity: 1; /* 100% opacity on hover */
}

/* ADMIN badge colors */
.ui-list-rows button span[style*="ADMIN"],
.ui-list-rows .item span[style*="ADMIN"],
.ui-list-rows .project-item span[style*="ADMIN"],
.ui-list-rows .project span[style*="ADMIN"],
.ui-list-rows [data-role="project-item"] span[style*="ADMIN"],
.ui-list-rows .group-item span[style*="ADMIN"],
.ui-list-rows .group span[style*="ADMIN"],
.ui-list-rows [data-role="group-item"] span[style*="ADMIN"] {
  background: rgba(99, 102, 241, 0.15);
  color: rgba(99, 102, 241, 0.8);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

/* EDITOR badge colors */
.ui-list-rows button span[style*="EDITOR"],
.ui-list-rows .item span[style*="EDITOR"],
.ui-list-rows .project-item span[style*="EDITOR"],
.ui-list-rows .project span[style*="EDITOR"],
.ui-list-rows [data-role="project-item"] span[style*="EDITOR"],
.ui-list-rows .group-item span[style*="EDITOR"],
.ui-list-rows .group span[style*="EDITOR"],
.ui-list-rows [data-role="group-item"] span[style*="EDITOR"] {
  background: rgba(34, 197, 94, 0.15);
  color: rgba(34, 197, 94, 0.8);
  border: 1px solid rgba(34, 197, 94, 0.2);
}

/* Action icons - consistent styling with far-right positioning */
.ui-list-rows button button[textContent="✎"],
.ui-list-rows button button[textContent="🗑"],
.ui-list-rows .item button[textContent="✎"],
.ui-list-rows .item button[textContent="🗑"],
.ui-list-rows .project-item button[textContent="✎"],
.ui-list-rows .project-item button[textContent="🗑"],
.ui-list-rows .project button[textContent="✎"],
.ui-list-rows .project button[textContent="🗑"],
.ui-list-rows [data-role="project-item"] button[textContent="✎"],
.ui-list-rows [data-role="project-item"] button[textContent="🗑"],
.ui-list-rows .group-item button[textContent="✎"],
.ui-list-rows .group-item button[textContent="🗑"],
.ui-list-rows .group button[textContent="✎"],
.ui-list-rows .group button[textContent="🗑"],
.ui-list-rows [data-role="group-item"] button[textContent="✎"],
.ui-list-rows [data-role="group-item"] button[textContent="🗑"] {
  opacity: 0.7;
  transition: opacity 0.2s ease;
  margin-left: auto; /* Push to far right */
  padding: 4px 6px;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: var(--text);
  cursor: pointer;
}

.ui-list-rows button button[textContent="✎"]:hover,
.ui-list-rows button button[textContent="🗑"]:hover,
.ui-list-rows .item button[textContent="✎"]:hover,
.ui-list-rows .item button[textContent="🗑"]:hover,
.ui-list-rows .project-item button[textContent="✎"]:hover,
.ui-list-rows .project-item button[textContent="🗑"]:hover,
.ui-list-rows .project button[textContent="✎"]:hover,
.ui-list-rows .project button[textContent="🗑"]:hover,
.ui-list-rows [data-role="project-item"] button[textContent="✎"]:hover,
.ui-list-rows [data-rows="project-item"] button[textContent="🗑"]:hover,
.ui-list-rows .group-item button[textContent="✎"]:hover,
.ui-list-rows .group-item button[textContent="🗑"]:hover,
.ui-list-rows .group button[textContent="✎"]:hover,
.ui-list-rows .group button[textContent="🗑"]:hover,
.ui-list-rows [data-role="group-item"] button[textContent="✎"]:hover,
.ui-list-rows [data-role="group-item"] button[textContent="🗑"]:hover {
  opacity: 1;
  background: rgba(79, 70, 229, 0.1);
}

/* Groups Section - Header styling only (row styling handled by .ui-list-rows) */
.groups-section .headerrow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  margin-top: 8px;
}

/* All Projects dropdown - match Projects filter styling */
.groups-section button[textContent="All Projects"] {
  background: var(--bg-subtle) !important;
  border: 1px solid var(--border) !important;
  color: var(--text) !important;
  padding: 6px 10px !important;
  border-radius: 6px !important;
  font-size: 12px !important;
  margin: 0 !important;
  width: auto !important;
  text-align: center !important;
  justify-content: center !important;
}

.groups-section button[textContent="All Projects"]:hover {
  border-color: var(--border-hover) !important;
  background: var(--bg-subtle) !important;
}

/* Note: All row styling is now handled by .ui-list-rows utility class */

/* Override aggressive border removals for Projects and Groups lists */
.ui-list-rows button,
.ui-list-rows .item,
.ui-list-rows .project-item,
.ui-list-rows .project,
.ui-list-rows [data-role="project-item"],
.ui-list-rows .group-item,
.ui-list-rows .group,
.ui-list-rows [data-role="group-item"] {
  border-bottom: 1px solid var(--border) !important;
  border-top: none !important;
  border-left: none !important;
  border-right: none !important;
}

/* Ensure last row has no bottom border */
.ui-list-rows button:last-child,
.ui-list-rows .item:last-child,
.ui-list-rows .project-item:last-child,
.ui-list-rows .project:last-child,
.ui-list-rows [data-role="project-item"]:last-child,
.ui-list-rows .group-item:last-child,
.ui-list-rows .group:last-child,
.ui-list-rows [data-role="group-item"]:last-child {
  border-bottom: none !important;
}

/* Override any conflicting border removals with maximum specificity */
.ui-list-rows button,
.ui-list-rows .item,
.ui-list-rows .project-item,
.ui-list-rows .project,
.ui-list-rows [data-role="project-item"],
.ui-list-rows .group-item,
.ui-list-rows .group,
.ui-list-rows [data-role="group-item"] {
  border-bottom: 1px solid var(--border) !important;
  border-top: none !important;
  border-left: none !important;
  border-right: none !important;
  border-style: solid !important;
  border-width: 0 0 1px 0 !important;
}

/* Override ghost button borders specifically for project rows - preserve selection styling */
.ui-list-rows button.ghost {
  border: none !important;
  border-bottom: 1px solid var(--border) !important;
  border-style: solid !important;
  border-width: 0 0 1px 0 !important;
}

/* Ensure ghost buttons in project rows show proper borders */
.ui-list-rows button.ghost:not(:last-child) {
  border-bottom: 1px solid var(--border) !important;
}

.ui-list-rows button.ghost:last-child {
  border-bottom: none !important;
}

/* Preserve selection styling for ghost buttons - same as groups */
.ui-list-rows button.ghost.selected {
  border-left: none !important;
  background: var(--primary-weak) !important;
  border-bottom: 1px solid var(--border) !important;
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.analytics-overview {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}

.analytics-overview h2 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: var(--font-weight-medium);
  color: var(--text);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  text-align: center;
  transition: transform 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-number {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--text);
}

.stat-card:nth-child(1) .stat-number { color: var(--primary); }
.stat-card:nth-child(2) .stat-number { color: var(--success); }
.stat-card:nth-child(3) .stat-number { color: var(--warning); }
.stat-card:nth-child(4) .stat-number { color: var(--success); }

.stat-label {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 500;
}

.project-analytics {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.scope-header {
  font-size: 16px;
  color: var(--text-muted);
  margin-bottom: 16px;
  font-weight: var(--font-weight-medium);
}

.click-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.stat-badge {
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  text-align: center;
  font-size: 20px;
  font-weight: 600;
  transition: transform 0.2s ease;
}

.stat-badge:hover {
  transform: translateY(-2px);
}

.stat-badge:nth-child(1) { color: var(--primary); }
.stat-badge:nth-child(2) { color: var(--warning); }
.stat-badge:nth-child(3) { color: var(--success); }
.stat-badge:nth-child(4) { color: var(--primary); }

.activity-section, .analytics-section {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: var(--font-weight-medium);
  color: var(--text);
}

.clear-activity-button {
  background: rgba(220, 38, 38, 0.8);
  border: 1px solid rgba(239, 68, 68, 0.5);
  color: white;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-activity-button:hover {
  background: rgba(220, 38, 38, 1);
  transform: translateY(-1px);
}

.analytics-group {
  margin-bottom: 16px;
}

.analytics-group h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: var(--font-weight-medium);
  color: var(--text-muted);
}

.badge-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.badge {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid;
  font-size: 12px;
  text-align: center;
  font-weight: 500;
}

.events-controls {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.events-controls label {
  margin-right: 16px;
  font-weight: normal;
  display: flex;
  align-items: center;
  gap: 6px;
}

.events-controls input[type="checkbox"] {
  margin: 0;
}

.table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  background: var(--bg-panel);
  border-radius: 8px;
  overflow: hidden;
}

.table th,
.table td {
  text-align: left;
  padding: 12px;
  border-bottom: 1px solid var(--border);
}

.table th {
  background: var(--bg-subtle);
  font-weight: 600;
  font-size: 13px;
  color: var(--text-muted);
}

.table tbody tr:hover {
  background: var(--primary-weak);
}

.analytics-details, .scope-details, .activity-feed-details, .advanced-analytics-details {
  margin-top: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.analytics-summary, .scope-summary, .activity-feed-summary, .advanced-analytics-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  cursor: pointer;
  background: var(--bg-subtle);
  margin: 0;
  user-select: none;
  font-weight: var(--font-weight-medium);
  font-size: 16px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}

.analytics-summary:hover, .scope-summary:hover, .activity-feed-summary:hover, .advanced-analytics-summary:hover {
  background: var(--bg-panel);
}

.analytics-summary::-webkit-details-marker, .scope-summary::-webkit-details-marker, 
.activity-feed-summary::-webkit-details-marker {
  display: none;
}

.analytics-details[open] .analytics-summary, .scope-details[open] .scope-summary,
.activity-feed-details[open] .activity-feed-summary {
  border-bottom-color: var(--border);
}

.analytics-content, .scope-content, .activity-feed-content, .advanced-analytics-content {
  padding: 16px;
  background: var(--bg-panel);
}

.activity-feed-content {
  max-height: 350px;
  overflow-y: auto;
}

.loading-message {
  text-align: center;
  color: var(--text-subtle);
  padding: 2rem;
}

.activity-feed {
  background: var(--bg-panel);
  backdrop-filter: none;
  border-radius: 10px;
  padding: 1rem;
  border: 1px solid var(--border);
}

.activity-feed h3 {
  margin-bottom: 1rem;
  font-size: 1.2rem;
  opacity: 0.9;
}

.activity-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  margin-bottom: 0.5rem;
  background: var(--bg-subtle);
  border-radius: 10px;
  border-left: 3px solid transparent;
  transition: all 0.2s;
}

.activity-item:hover {
  background: var(--bg-panel);
  border-left-color: var(--success);
}

.activity-item.live {
  border-left-color: var(--warning);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}

.activity-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-right: 1rem;
  flex-shrink: 0;
}

.activity-content {
  flex: 1;
}

.activity-user {
  font-weight: 600;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}

.activity-description {
  font-size: 0.85rem;
  opacity: 0.8;
}

.activity-time {
  font-size: 0.75rem;
  opacity: 0.6;
  margin-left: auto;
  text-align: right;
}

.live-indicator {
  background: var(--warning);
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 8px;
  font-size: 0.7rem;
  margin-left: 0.5rem;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.3; }
}

.refresh-button {
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 1rem;
}

.refresh-button:hover {
  background: var(--bg-subtle);
  transform: translateY(-1px);
}

/* Pagination Styles */
.pagination-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.pagination-info {
  font-size: 12px;
  opacity: 0.8;
}

.pagination-buttons {
  display: flex;
  gap: 8px;
}

.pagination-btn {
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
}

.pagination-btn:hover:not(:disabled) {
  background: var(--bg-subtle);
  border-color: var(--border-hover);
  transform: translateY(-1px);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* Details/Summary Styles */
details summary {
  cursor: pointer;
  user-select: none;
}

details summary::-webkit-details-marker {
  display: none;
}

details[open] summary {
  margin-bottom: 1rem;
}

/* Smart Link Row - URL Truncation & Copy Feedback */
.smart-link-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  margin-bottom: 8px;
}

.smart-link-url {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-family: monospace;
  font-size: 14px;
}

.smart-link-url[title] {
  cursor: help;
}

.copy-button {
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 6px 10px;
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
  white-space: nowrap;
}

.copy-button:hover {
  background: var(--border-hover);
  border-color: var(--border-hover);
}

.copy-button.copied {
  background: var(--success);
  color: white;
  border-color: var(--success);
}

.copy-button.copied::after {
  content: ' ✓';
  font-weight: bold;
}

/* --- Make Projects list match Groups: no purple highlight/halo --- */
.projects-section .ui-list-rows button,
.projects-section .ui-list-rows .project-item,
.projects-section .ui-list-rows [data-role="project-item"] {
  background: var(--bg-panel) !important;   /* base row bg */
}

/* Make projects have same styling as groups - NO light purple border */
.projects-section .ui-list-rows button.selected,
.projects-section .ui-list-rows .project-item.selected,
.projects-section .ui-list-rows [data-role="project-item"].selected {
  background: var(--primary-weak) !important;
  border-left: none !important;
  border-bottom: none !important;
}

/* Kill the focus-ring halo around selected projects */
.projects-section .ui-list-rows button.selected::after,
.projects-section .ui-list-rows .project-item.selected::after,
.projects-section .ui-list-rows [data-role="project-item"].selected::after {
  content: none !important;
}

/* Disable hover glow on projects to match Groups */
.projects-section .ui-list-rows button:hover,
.projects-section .ui-list-rows .project-item:hover,
.projects-section .ui-list-rows [data-role="project-item"]:hover {
  background: var(--bg-panel) !important;
  border-bottom-color: var(--border-hover) !important; /* keep subtle hover border */
}

/* Ensure no inherited purple background sneaks in from generic .selected rule */
.projects-section .ui-list-rows button.selected,
.projects-section .ui-list-rows .project-item.selected {
  box-shadow: none !important;
}

/* === Projects list: kill purple glow/underline; match Groups === */
.projects-section .ui-list-rows button,
.projects-section .ui-list-rows .project-item,
.projects-section .ui-list-rows [data-role="project-item"] {
  background: var(--bg-panel) !important;
  background-image: none !important; /* in case a gradient is applied elsewhere */
  box-shadow: none !important;       /* neutralize any inherited shadows */
  outline: none !important;          /* neutralize focus outlines */
}

/* Remove hover glow specific to Projects (Groups keep theirs) */
.projects-section .ui-list-rows button:hover,
.projects-section .ui-list-rows .project-item:hover,
.projects-section .ui-list-rows [data-role="project-item"]:hover {
  background: var(--bg-panel) !important;
  background-image: none !important;
  box-shadow: none !important;
}

/* Remove focus/active halos that appear as a purple underline */
.projects-section .ui-list-rows button:focus,
.projects-section .ui-list-rows button:focus-visible,
.projects-section .ui-list-rows button:active {
  outline: none !important;
  box-shadow: none !important;
  background: var(--bg-panel) !important;
}

/* Keep selection state with NO light purple border like groups */
.projects-section .ui-list-rows button.selected,
.projects-section .ui-list-rows .project-item.selected,
.projects-section .ui-list-rows [data-role="project-item"].selected {
  background: var(--primary-weak) !important;   /* same fill as Groups */
  border-left: none !important;                 /* NO border like Groups */
  box-shadow: none !important;                  /* kill glow */
}

/* Kill any ring drawn via pseudo-elements */
.projects-section .ui-list-rows button::before,
.projects-section .ui-list-rows button::after,
.projects-section .ui-list-rows .project-item::before,
.projects-section .ui-list-rows .project-item::after,
.projects-section .ui-list-rows [data-role="project-item"]::before,
.projects-section .ui-list-rows [data-role="project-item"]::after {
  content: none !important;
}

/* Some builds add a special ring only on selected */
.projects-section .ui-list-rows button.selected::before,
.projects-section .ui-list-rows button.selected::after {
  content: none !important;
}

/* If the hover rule uses color-mix focus ring globally, null it just for Projects */
.projects-section .ui-list-rows button:hover {
  background: var(--bg-panel) !important;
}
</style>
</head>
<body>
  <div style="max-width:1200px; margin:0 auto; display:flex; justify-content:space-between; align-items:center; gap:12px;">
    <h1>Analytics</h1>
    <div><a href="/" class="ghost">← Back to Editor</a></div>
  </div>

  <!-- Dark mode is now the default - no theme switching needed -->

  <div class="container">
    <div class="left-sidebar" id="leftSidebar">
      <div class="sidebar-header">
        <button id="toggleSidebar" class="toggle-sidebar-btn" title="Hide sidebar">←</button>
      </div>
      <div class="groups-section">
      <div class="headerrow">
        <strong>Groups</strong>
          <button id="allGroups" class="btn btn-secondary ghost">All Projects</button>
      </div>
        <div id="groupList" class="ui-list-rows"></div>
    </div>
      
      <div class="projects-section">
        <div class="headerrow">
      <strong id="projectsHeader">Projects</strong>
    </div>
        <div id="projList" class="ui-list-rows"></div>
      </div>
      </div>

    <button id="showSidebar" class="show-sidebar-btn" style="display: none;" title="Show sidebar">→</button>

    <div class="main-content">
      



      <!-- Per-sublink Performance -->
      <div class="analytics-section">
        <div class="section-header">
          <h3>📊 Per-sublink Performance</h3>
        </div>
        <div id="sublinkStats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-bottom: 16px;">
          <!-- Sublink badges will be populated here -->
        </div>
        
        <!-- Totals Row -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; padding: 12px; background: var(--bg-subtle); border-radius: 8px; border: 1px solid var(--border);">
          <div class="badge" style="background: var(--primary); border-color: var(--primary); color: white; font-weight: 600;">
            Total Clicks: <span id="totalSublinkClicks">0</span>
          </div>
          <div class="badge" style="background: var(--success); border-color: var(--success); color: white; font-weight: 600;">
            Total Events: <span id="totalSublinkEvents">0</span>
          </div>
          <div class="badge" style="background: var(--warning); border-color: var(--warning); color: white; font-weight: 600;">
            Total Fraud: <span id="totalSublinkFraud">0</span>
          </div>
        </div>
      </div>

      <!-- Recent Events -->
      <div class="analytics-section">
        <div class="section-header">
          <h3>📋 Recent Events</h3>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 14px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
              <span style="color: var(--success);">●</span>
              <span id="liveVisitors">0</span> live visitors
            </div>
            <button id="refreshEventsBtn" class="btn btn-secondary ghost" style="padding: 4px 8px; font-size: 12px;">Refresh</button>
          </div>
        </div>
        
        <div style="margin-bottom: 12px;">
          <label style="margin-right: 16px; font-weight: normal;">
            <input type="checkbox" id="showSuspiciousOnly" style="margin-right: 6px;"/> Show Suspicious Only
          </label>
          <label style="margin-right: 16px; font-weight: normal;">
            <input type="checkbox" id="showBotsOnly" style="margin-right: 6px;"/> Show Bots Only
          </label>
        </div>
        
      <table class="table" id="evtbl">
          <thead>
            <tr>
              <th>Time</th>
              <th>Sub ID</th>
              <th>URL</th>
              <th>Location</th>
              <th>Device</th>
              <th>Fraud</th>
              <th>Status</th>
              <th>Duplicate</th>
              <th>User Agent</th>
            </tr>
          </thead>
        <tbody></tbody>
      </table>
        <div class="pagination-controls" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">
          <div style="font-size: 12px; opacity: 0.7;">Showing <span id="eventsPageInfo">0-0 of 0</span> events</div>
          <div style="display: flex; gap: 8px;">
            <button id="prevEventsPage" class="pagination-btn" onclick="changeEventsPage(-1)" disabled>← Previous</button>
            <button id="nextEventsPage" class="pagination-btn" onclick="changeEventsPage(1)" disabled>Next →</button>
          </div>
        </div>
      </div>



      <!-- Dropdown Analytics Section -->
      <div class="analytics-section">
        <div class="section-header">
          <h3>📊 Detailed Analytics</h3>
        </div>

        <!-- Live Activity Feed (Collapsible) -->
        <details class="activity-feed-details">
          <summary class="activity-feed-summary">
            <span>📊 Live Activity Feed</span>
            <button class="clear-activity-button" onclick="clearActivityFeed()" title="Clear activity history">🗑️</button>
          </summary>
          
          <div id="activityFeed" class="activity-feed-content">
            <div class="loading-message">Loading activity feed...</div>
          </div>
          
          <div class="pagination-controls">
            <div class="pagination-info">Showing <span id="paginationInfo">0-0 of 0</span> activities</div>
            <div class="pagination-buttons">
              <button id="prevPage" class="pagination-btn" onclick="changePage(-1)" disabled>←</button>
              <button id="nextPage" class="pagination-btn" onclick="changePage(1)" disabled>→</button>
            </div>
          </div>
        </details>

        <!-- Advanced Analytics (Collapsible) -->
          <details class="advanced-analytics-details">
            <summary class="advanced-analytics-summary">
              <span>📈 Advanced Analytics</span>
            </summary>
            <div class="advanced-analytics-content">
              <!-- Performance Stats -->
              <div class="analytics-group">
                <h4>Performance Analytics</h4>
                <div class="badge-container">
                  <div class="badge" style="background: var(--bg-subtle); border: 1px solid var(--primary); border-left: 4px solid var(--primary); color: var(--text);">Avg Redirect: <span id="avgRedirectTime" style="font-weight: bold;">-</span>ms</div>
                  <div class="badge" style="background: var(--bg-subtle); border: 1px solid var(--success); border-left: 4px solid var(--success); color: var(--text);">Fast Redirects: <span id="fastRedirects" style="font-weight: bold;">-</span></div>
                  <div class="badge" style="background: var(--bg-subtle); border: 1px solid var(--warning); border-left: 4px solid var(--warning); color: var(--text);">Slow Redirects: <span id="slowRedirects" style="font-weight: bold;">-</span></div>
                </div>
              </div>

              <!-- Security Stats -->
              <div class="analytics-group">
                <h4>Security Analytics</h4>
                <div class="badge-container">
                  <div class="badge" style="background: var(--bg-subtle); border: 1px solid var(--warning); border-left: 4px solid var(--warning); color: var(--text);">Suspicious: <span id="suspiciousClicks" style="font-weight: bold;">0</span></div>
                  <div class="badge" style="background: var(--bg-subtle); border: 1px solid var(--danger); border-left: 4px solid var(--danger); color: var(--text);">Bots Blocked: <span id="botsBlocked" style="font-weight: bold;">0</span></div>
                  <div class="badge" style="background: var(--bg-subtle); border: 1px solid var(--primary); border-left: 4px solid var(--primary); color: var(--text);">Avg Fraud Score: <span id="avgFraudScore" style="font-weight: bold;">0</span></div>
                  <div class="badge" style="background: var(--bg-subtle); border: 1px solid var(--success); border-left: 4px solid var(--success); color: var(--text);">Clean Clicks: <span id="cleanClicks" style="font-weight: bold;">0</span></div>
                </div>
              </div>

              <!-- IP Reputation -->
              <div class="analytics-group">
                <h4>IP Reputation</h4>
                <div class="badge-container">
                  <div class="badge" style="background: var(--bg-subtle); border: 1px solid var(--success); border-left: 4px solid var(--success); color: var(--text);">Clean IPs: <span id="cleanIPs" style="font-weight: bold;">-</span></div>
                  <div class="badge" style="background: var(--bg-subtle); border: 1px solid var(--warning); border-left: 4px solid var(--warning); color: var(--text);">Suspicious IPs: <span id="suspiciousIPs" style="font-weight: bold;">-</span></div>
                  <div class="badge" style="background: var(--bg-subtle); border: 1px solid var(--danger); border-left: 4px solid var(--danger); color: var(--text);">Blacklisted IPs: <span id="blacklistedIPs" style="font-weight: bold;">-</span></div>
                  <div class="badge" style="background: var(--bg-subtle); border: 1px solid var(--primary); border-left: 4px solid var(--primary); color: var(--text);">Blocked Clicks: <span id="blockedClicks" style="font-weight: bold;">-</span></div>
                </div>
              </div>

              <!-- Traffic Sources -->
              <div class="analytics-group">
                <h4>Traffic Sources</h4>
                <div id="trafficSources" class="badge-container">
                  <!-- Traffic source stats will be populated by JavaScript -->
                </div>
              </div>

              <!-- Geographic Distribution -->
              <div class="analytics-group">
                <h4>Geographic Distribution</h4>
                <div id="geoStats" class="badge-container">
                  <!-- Geo stats will be populated by JavaScript -->
                </div>
              </div>
            </div>
          </details>

          <!-- Analytics Overview (Collapsible) -->
          <details class="analytics-details">
            <summary class="analytics-summary" style="font-size: 18px; font-weight: var(--font-weight-semibold); color: var(--text);">
              <span>📊 Analytics Overview</span>
              <button class="btn btn-secondary refresh-button" onclick="refreshDashboard()" style="padding: 6px 12px; font-size: 12px;">🔄 Refresh</button>
            </summary>
            
            <div class="analytics-content">
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-number" id="totalProjects">-</div>
                  <div class="stat-label">Total Projects</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number" id="activeUsers">-</div>
                  <div class="stat-label">Active Users</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number" id="todayClicks">-</div>
                  <div class="stat-label">Today's Clicks</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number" id="systemUptime">-</div>
                  <div class="stat-label">System Uptime</div>
                </div>
              </div>
            </div>
          </details>
          
          <!-- Project Scope Analytics (Collapsible) -->
          <details class="scope-details">
            <summary class="scope-summary" style="font-size: 18px; font-weight: var(--font-weight-semibold); color: var(--text);">
              <span>🎯 Project Analytics</span>
            </summary>
            
            <div class="scope-content">
              <div id="scope" class="scope-header"></div>
              
              <!-- Main Stats Row -->
              <div class="click-stats">
                <div class="stat-badge" id="total">0</div>
                <div class="stat-badge" id="today">0</div>
                <div class="stat-badge" id="week">0</div>
                <div class="stat-badge" id="month">0</div>
              </div>
            </div>
          </details>
          

          

      </div>

      <!-- Pixel Tracking Analytics (Collapsible) -->
      <details style="margin-top: 16px; border: 1px solid var(--border); border-radius: 8px; padding: 0; overflow: hidden;">
        <summary style="padding: 12px 16px; cursor: pointer; background: var(--bg-subtle); margin: 0; user-select: none; font-weight: var(--font-weight-semibold); display: flex; align-items: center; gap: 8px; color: var(--text); font-size: 18px;">
          <span style="font-size: 18px;">📊</span> Pixel Tracking Analytics
          <span style="font-size: 12px; opacity: 0.7; margin-left: auto;">(Click to expand)</span>
        </summary>
        <div style="padding: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          
          <!-- TikTok Pixel Section -->
          <div style="border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: var(--bg-panel);">
            <h4 style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: var(--font-weight-semibold); color: var(--text);">
              <span style="font-size: 18px;">🎵</span> TikTok Pixel Analytics
            </h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
              <div class="badge" style="background: var(--primary-weak); color: var(--text); text-align: center;">Page Views: <br><strong id="tiktokPageViews">0</strong></div>
<div class="badge" style="background: var(--success); color: white; text-align: center;">Click Events: <br><strong id="tiktokClicks">0</strong></div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
              <div class="badge" style="background: var(--success); color: white; text-align: center;">Complete Payment: <br><strong id="tiktokPurchases">0</strong></div>
<div class="badge" style="background: var(--warning); color: var(--text); text-align: center;">Add to Cart: <br><strong id="tiktokAddToCart">0</strong></div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div class="badge" style="text-align: center;">Initiate Checkout: <br><strong id="tiktokInitiateCheckout">0</strong></div>
              <div class="badge" style="text-align: center;">View Content: <br><strong id="tiktokViewContent">0</strong></div>
            </div>
            <div style="margin-top: 12px; font-size: 11px; opacity: 0.7;">
              Revenue: $<span id="tiktokRevenue">0.00</span> | ROAS: <span id="tiktokROAS">0.0</span>x
            </div>
          </div>

          <!-- Facebook Pixel Section -->
          <div style="border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: var(--bg-panel);">
            <h4 style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: var(--font-weight-semibold); color: var(--text);">
              <span style="font-size: 18px;">📘</span> Facebook Pixel Analytics
            </h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
              <div class="badge" style="background: var(--primary-weak); color: var(--text); text-align: center;">Page Views: <br><strong id="facebookPageViews">0</strong></div>
<div class="badge" style="background: var(--primary); color: white; text-align: center;">Link Clicks: <br><strong id="facebookClicks">0</strong></div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
              <div class="badge" style="background: var(--success); color: white; text-align: center;">Purchases: <br><strong id="facebookPurchases">0</strong></div>
<div class="badge" style="background: var(--warning); color: white; text-align: center;">Add to Cart: <br><strong id="facebookAddToCart">0</strong></div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div class="badge" style="text-align: center;">Lead: <br><strong id="facebookLead">0</strong></div>
              <div class="badge" style="text-align: center;">View Content: <br><strong id="facebookViewContent">0</strong></div>
            </div>
            <div style="margin-top: 12px; font-size: 11px; opacity: 0.7;">
              Revenue: $<span id="facebookRevenue">0.00</span> | CPM: $<span id="facebookCPM">0.00</span>
            </div>
          </div>
        </div>
      </details>
        </div>
      </div>
    </div>
  </div>

<script>
const gList = document.getElementById('groupList');
const pList = document.getElementById('projList');
const scope = document.getElementById('scope');
const total = document.getElementById('total');
const today = document.getElementById('today');
const week = document.getElementById('week');
const month = document.getElementById('month');
const suspiciousClicks = document.getElementById('suspiciousClicks');
const botsBlocked = document.getElementById('botsBlocked');
const avgFraudScore = document.getElementById('avgFraudScore');
const cleanClicks = document.getElementById('cleanClicks');
const geoStats = document.getElementById('geoStats');

// TikTok Pixel Elements
const tiktokPageViews = document.getElementById('tiktokPageViews');
const tiktokClicks = document.getElementById('tiktokClicks');
const tiktokPurchases = document.getElementById('tiktokPurchases');
const tiktokAddToCart = document.getElementById('tiktokAddToCart');
const tiktokInitiateCheckout = document.getElementById('tiktokInitiateCheckout');
const tiktokViewContent = document.getElementById('tiktokViewContent');
const tiktokRevenue = document.getElementById('tiktokRevenue');
const tiktokROAS = document.getElementById('tiktokROAS');

// Facebook Pixel Elements
const facebookPageViews = document.getElementById('facebookPageViews');
const facebookClicks = document.getElementById('facebookClicks');
const facebookPurchases = document.getElementById('facebookPurchases');
const facebookAddToCart = document.getElementById('facebookAddToCart');
const facebookLead = document.getElementById('facebookLead');
const facebookViewContent = document.getElementById('facebookViewContent');
const facebookRevenue = document.getElementById('facebookRevenue');
const facebookCPM = document.getElementById('facebookCPM');
const chartContainer = document.getElementById('chartContainer');
const sublinkStats = document.getElementById('sublinkStats');
const evtbl = document.querySelector('#evtbl tbody');
const allGroupsBtn = document.getElementById('allGroups');
const projectsHeader = document.getElementById('projectsHeader');
const showSuspiciousOnly = document.getElementById('showSuspiciousOnly');
const showBotsOnly = document.getElementById('showBotsOnly');
const refreshEventsBtn = document.getElementById('refreshEventsBtn');
const liveVisitors = document.getElementById('liveVisitors');

let currentGroup = localStorage.getItem('analytics.currentGroup') || null;   // null = All Projects
let currentProject = localStorage.getItem('analytics.currentProject') || null;

// Dark mode is now the default - no theme switching needed

// Dashboard management
let dashboardRefreshInterval = null;
let lastActivityUpdate = 0;

// Pagination state
let currentPage = 0;
const itemsPerPage = 10;

// Events pagination state  
let currentEventsPage = 0;
const eventsPerPage = 5;

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', function() {
  // Initialize dashboard
  initializeDashboard();
});

// Dark mode is now the default - no theme switching needed

/* ================= Dashboard Functions ================= */
async function initializeDashboard() {
  await loadQuickStats();
  await loadActivityFeed();
  
  // Start auto-refresh every 30 seconds
  dashboardRefreshInterval = setInterval(async () => {
    await loadQuickStats();
    await loadActivityFeed();
  }, 30000);
}

async function loadQuickStats() {
  try {
    const stats = await j('/api/quick-stats');
    
    // Update stat numbers with null checks
    const totalProjectsEl = document.getElementById('totalProjects');
    if (totalProjectsEl) totalProjectsEl.textContent = stats.totalProjects;
    
    // activeUsers is now loaded separately with live data in render()
    const todayClicksEl = document.getElementById('todayClicks');
    if (todayClicksEl) todayClicksEl.textContent = stats.todayClicks;
    
    const systemUptimeEl = document.getElementById('systemUptime');
    if (systemUptimeEl) systemUptimeEl.textContent = stats.systemUptime;
    
    // Update growth indicators with null checks
    const projectsGrowthEl = document.getElementById('projectsGrowth');
    if (projectsGrowthEl) projectsGrowthEl.textContent = '+' + stats.recentGrowth.projects;
    
    // Note: usersGrowth element was removed, so we skip it
    const clicksGrowthEl = document.getElementById('clicksGrowth');
    if (clicksGrowthEl) clicksGrowthEl.textContent = '+' + stats.recentGrowth.clicks;
    
    // Add growth animation
    animateStatGrowth();
    
  } catch (error) {
    console.error('Failed to load quick stats:', error);
  }
}

async function loadActivityFeed() {
  try {
    const offset = currentPage * itemsPerPage;
    const feed = await j(\`/api/activity-feed?limit=\${itemsPerPage}&offset=\${offset}\`);
    const feedContainer = document.getElementById('activityFeed');
    
    if (feed.items.length === 0) {
      feedContainer.innerHTML = '<div style="text-align: center; opacity: 0.7; padding: 2rem;">No recent activity</div>';
      updatePaginationInfo(0, 0, 0);
      updatePaginationButtons(false, false);
      return;
    }
    
    feedContainer.innerHTML = feed.items.map(item => {
      const timeAgo = formatTimeAgo(item.timestamp);
      const description = formatActivityDescription(item.action, item.resourceType, item.resourceName, item.details, item.ipAddress);
      const liveClass = item.isLive ? ' live' : '';
      const liveIndicator = item.isLive ? '<span class="live-indicator">LIVE</span>' : '';
      
      return \`
        <div class="activity-item\${liveClass}">
          <img src="\${item.avatar}" alt="\${item.userEmail}" class="activity-avatar">
          <div class="activity-content">
            <div class="activity-user">\${item.userEmail} <span style="opacity: 0.6;">(\${item.userRole})</span>\${liveIndicator}</div>
            <div class="activity-description">\${description}</div>
          </div>
          <div class="activity-time">\${timeAgo}</div>
        </div>
      \`;
    }).join('');
    
    // Update pagination info and buttons
    const startItem = offset + 1;
    const endItem = offset + feed.items.length;
    updatePaginationInfo(startItem, endItem, feed.total);
    updatePaginationButtons(currentPage > 0, feed.hasMore);
    
    lastActivityUpdate = Date.now();
    
  } catch (error) {
    console.error('Failed to load activity feed:', error);
  }
}

async function clearActivityFeed() {
  if (!confirm('Are you sure you want to clear your activity history? This action cannot be undone.')) {
    return;
  }
  
  try {
    const response = await j('/api/activity-logs/my', { method: 'DELETE' });
    
    if (response.success) {
      // Show success message
      const feedContainer = document.getElementById('activityFeed');
      feedContainer.innerHTML = '<div style="text-align: center; opacity: 0.7; padding: 2rem; color: var(--success);">✅ Activity history cleared successfully!</div>';
      
      // Reset pagination
      currentPage = 0;
      updatePaginationInfo(0, 0, 0);
      updatePaginationButtons(false, false);
      
      // Show alert notification
      alert(\`✅ Cleared \${response.cleared} activity entries\`);
      
      // Refresh immediately and again after a moment to ensure UI updates
      setTimeout(() => {
        loadActivityFeed();
        // Force a second refresh to ensure all data is current
        setTimeout(() => {
          loadActivityFeed();
        }, 1000);
      }, 1000);
      
    } else {
      alert('❌ Failed to clear activity history');
    }
  } catch (error) {
    console.error('Error clearing activity feed:', error);
    alert('❌ Error clearing activity history');
  }
}

function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return days + 'd ago';
  if (hours > 0) return hours + 'h ago';
  if (minutes > 0) return minutes + 'm ago';
  if (seconds > 30) return seconds + 's ago';
  return 'Just now';
}

function formatActivityDescription(action, resourceType, resourceName, details, ipAddress) {
  const actionMap = {
    'create': 'created',
    'update': 'updated',
    'delete': 'deleted',
    'login': 'logged in',
    'click': 'clicked',
    'view': 'viewed'
  };
  
  const resourceMap = {
    'project': 'project',
    'group': 'group',
    'user': 'user',
    'team': 'team',
    'webhook': 'webhook',
    'link': 'link'
  };
  
  const actionText = actionMap[action] || action;
  const resourceText = resourceMap[resourceType] || resourceType;
  
  let description = \`\${actionText} \${resourceText}\`;
  
  if (resourceName && resourceName !== 'Unknown') {
    description += \` "\${resourceName}"\`;
  }
  
  // Add IP address for click actions
  if (action === 'click' && ipAddress) {
    description += \` <span style="opacity: 0.7; font-size: 0.9em;">(\${ipAddress})</span>\`;
  }
  
  // Add specific details
  if (details.newUserRole) {
    description += \` with role \${details.newUserRole}\`;
  }
  if (details.webhookUrl) {
    description += \` to \${details.webhookUrl}\`;
  }
  
  return description;
}

function animateStatGrowth() {
  const statCards = document.querySelectorAll('.stat-card');
  statCards.forEach(card => {
    card.style.transform = 'scale(1.05)';
    setTimeout(() => {
      card.style.transform = 'scale(1)';
    }, 200);
  });
}

function updatePaginationInfo(startItem, endItem, total) {
  const paginationInfo = document.getElementById('paginationInfo');
  if (paginationInfo) {
    paginationInfo.textContent = \`\${startItem}-\${endItem} of \${total}\`;
  }
}

function updatePaginationButtons(hasPrev, hasNext) {
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  
  if (prevBtn) prevBtn.disabled = !hasPrev;
  if (nextBtn) nextBtn.disabled = !hasNext;
}

function changePage(direction) {
  currentPage += direction;
  if (currentPage < 0) currentPage = 0;
  
  loadActivityFeed();
}

// Events pagination functions
function updateEventsPageInfo(startItem, endItem, total) {
  const eventsPageInfo = document.getElementById('eventsPageInfo');
  if (eventsPageInfo) {
    eventsPageInfo.textContent = \`\${startItem}-\${endItem} of \${total}\`;
  }
}

function updateEventsPageButtons(hasPrev, hasNext) {
  const prevBtn = document.getElementById('prevEventsPage');
  const nextBtn = document.getElementById('nextEventsPage');
  
  if (prevBtn) prevBtn.disabled = !hasPrev;
  if (nextBtn) nextBtn.disabled = !hasNext;
}

async function changeEventsPage(direction) {
  if (!currentProject) return;
  
  currentEventsPage += direction;
  if (currentEventsPage < 0) currentEventsPage = 0;
  
  try {
    // Show loading state
    if (evtbl) evtbl.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading events...</td></tr>';
    
    // Load paginated events
    const response = await j('/api/analytics/paginated?project='+encodeURIComponent(currentProject)+'&limit=10&page='+currentEventsPage);
    
    // Update events table
    console.log('🔍 DEBUG: Raw events from response:', response.events);
    const filteredEvents = response.events.filter(e => {
      if (showSuspiciousOnly && showSuspiciousOnly.checked && (e.fraudScore || 0) < 50) return false;
      if (showBotsOnly && showBotsOnly.checked && !e.isBot) return false;
      return true;
    });
    console.log('🔍 DEBUG: Filtered events:', filteredEvents);
    
    if (evtbl) {
      renderEventsTable(filteredEvents, evtbl);
    }
    
    // Update pagination info
    const totalEventsCount = response.pagination?.total || filteredEvents.length;
    const hasMore = response.pagination?.hasMore || false;
    
    updateEventsPageInfo(currentEventsPage * 10 + 1, Math.min((currentEventsPage + 1) * 10, totalEventsCount), totalEventsCount);
    updateEventsPageButtons(currentEventsPage > 0, hasMore);
    
  } catch (error) {
    console.error('Error loading paginated events:', error);
    if (evtbl) evtbl.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--danger);">Error loading events</td></tr>';
  }
}

async function refreshDashboard() {
  const refreshBtn = document.querySelector('.refresh-button');
  refreshBtn.textContent = '⏳ Refreshing...';
  refreshBtn.disabled = true;
  
  try {
    await loadQuickStats();
    await loadActivityFeed();
    
    // Show success feedback
    refreshBtn.textContent = '✅ Refreshed!';
    setTimeout(() => {
      refreshBtn.textContent = '🔄 Refresh';
      refreshBtn.disabled = false;
    }, 2000);
    
  } catch (error) {
    refreshBtn.textContent = '❌ Error';
    setTimeout(() => {
      refreshBtn.textContent = '🔄 Refresh';
      refreshBtn.disabled = false;
    }, 2000);
  }
}
async function j(url, opts){
  console.log('DEBUG: j() function called with:', { url, opts });
  opts = opts || {};
  opts.credentials = 'include'; // ensure cookie rides along
  console.log('DEBUG: Making fetch request to:', url);
  const r = await fetch(url, opts);
  console.log('DEBUG: Fetch response status:', r.status, r.statusText);
  const d = await r.json().catch(()=>({}));
  console.log('DEBUG: Fetch response data:', d);
  if(!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}

async function loadGroups(){
  const gs = await j('/api/groups');
  gList.innerHTML = '';
  gs.forEach(g=>{
    const b = document.createElement('button'); b.className='ghost'; b.type='button'; b.textContent=g.name;
    if (g.id === currentGroup) b.classList.add('selected');
    b.onclick=()=>{ 
      currentGroup=g.id; 
      currentProject=null; 
      localStorage.setItem('analytics.currentGroup', g.id); 
      localStorage.removeItem('analytics.currentProject'); 
      render(); 
    };
    gList.appendChild(b);
  });
  if (currentGroup === null) allGroupsBtn.classList.add('selected'); else allGroupsBtn.classList.remove('selected');
}
async function loadProjects(){
  const ps = await j('/api/projects');
  const gs = await j('/api/groups');
  pList.innerHTML = '';
  
  // Filter out ungrouped projects and projects in groups the user doesn't own
  console.log('🔍 DEBUG: Frontend filtering - Raw projects from API:');
  ps.forEach(p => {
    console.log('  - Project: ' + p.name + ' (' + p.id + ') - groupId: "' + p.groupId + '" - type: ' + typeof p.groupId + ' - length: ' + (p.groupId ? p.groupId.length : 'null'));
  });
  
  // Get current user info to check group ownership
  let currentUserId = null;
  try {
    const userResponse = await j('/api/me');
    currentUserId = userResponse.id;
    console.log('🔍 DEBUG: Current user ID:', currentUserId);
  } catch (error) {
    console.log('🔍 DEBUG: Could not get current user, defaulting to admin view');
  }
  
  const groupedProjects = ps.filter(p => {
    const hasGroup = p.groupId && p.groupId.trim() !== '';
    if (!hasGroup) {
      console.log('🔍 DEBUG: Frontend filtering out project without group: ' + p.name + ' (' + p.id + ') - groupId: "' + p.groupId + '"');
      return false;
    }
    
    // Find the group this project belongs to
    const group = gs.find(g => g.id === p.groupId);
    if (!group) {
      console.log('🔍 DEBUG: Frontend filtering out project with invalid group: ' + p.name + ' (' + p.id + ') - groupId: "' + p.groupId + '"');
      return false;
    }
    
    // Check group ownership - admins can see all, editors can only see their own groups
    if (currentUserId && group.userId) {
      // If group has an owner (not an admin group), check if current user owns it
      if (group.userId !== currentUserId) {
        console.log('🔍 DEBUG: Frontend filtering out project in another user group: ' + p.name + ' (' + p.id + ') - groupId: "' + p.groupId + '" - groupOwner: ' + group.userId + ' - currentUser: ' + currentUserId);
        return false;
      }
    }
    // Admin groups (no userId) are accessible to everyone
    
    return true;
  });
  
  console.log('🔍 DEBUG: Frontend filtering - Total projects:', ps.length, 'Grouped projects:', groupedProjects.length, 'Accessible projects:', groupedProjects.length);
  
  const list = currentGroup? groupedProjects.filter(p=>p.groupId===currentGroup):groupedProjects;
  
  // Clear currentProject if it's no longer accessible
  if (currentProject && !groupedProjects.some(p => p.id === currentProject)) {
    console.log('🔍 DEBUG: Clearing inaccessible currentProject:', currentProject);
    currentProject = null;
    localStorage.removeItem('analytics.currentProject');
  }
  
  // Auto-select first available project if none selected
  if (!currentProject && list.length > 0) {
    currentProject = list[0].id;
    localStorage.setItem('analytics.currentProject', currentProject);
    console.log('🔍 DEBUG: Auto-selected first accessible project:', currentProject);
  }
  
  if (projectsHeader) {
  projectsHeader.textContent = currentGroup ? 'Projects (' + (await groupName(currentGroup)) + ')' : 'Projects (All)';
  }
  list.forEach(p=>{
    const b = document.createElement('button'); 
    b.className='btn btn-secondary ghost'; 
    b.type='button'; 
    b.textContent=p.name;
    
    // Debug project selection
    console.log('🔍 Project button:', p.id, 'currentProject:', currentProject, 'match:', p.id === currentProject);
    
    if (p.id === currentProject) {
      b.classList.add('selected');
      console.log('🔍 Added selected class to:', p.name);
    }
    
    b.onclick=async ()=>{ 
      console.log('🔍 Project clicked:', p.id, p.name);
      
      // Show immediate feedback
      b.textContent = p.name + ' (Loading...)';
      b.disabled = true;
      
      currentProject=p.id; 
      localStorage.setItem('analytics.currentProject', p.id); 
      console.log('🔍 Set currentProject to:', currentProject);
      
      await render();
      
      // Restore button state
      b.textContent = p.name;
      b.disabled = false;
    };
    pList.appendChild(b);
  });
}
async function groupName(id){
  const gs = await j('/api/groups');
  return (gs.find(g=>g.id===id)?.name) || 'Group';
}

async function render(){
  await loadGroups();
  await loadProjects();
  
  // Validate currentProject is still accessible after loadProjects completes
  
  try {
    if (currentProject) {
    console.log('🔍 DEBUG: render() - Validating currentProject:', currentProject);
    
    // Get current user info
    let currentUserId = null;
    try {
      const userResponse = await j('/api/me');
      currentUserId = userResponse.id;
      console.log('🔍 DEBUG: render() - Current user ID:', currentUserId);
    } catch (error) {
      console.log('🔍 DEBUG: render() - Could not get current user');
    }
    
    // Check if currentProject is still accessible by looking at the filtered projects
    // The loadProjects function should have already filtered out inaccessible projects
    const ps = await j('/api/projects');
    const gs = await j('/api/groups');
    
    // Apply the same filtering logic as loadProjects
    const groupedProjects = ps.filter(p => {
      const hasGroup = p.groupId && p.groupId.trim() !== '';
      if (!hasGroup) return false;
      
      const group = gs.find(g => g.id === p.groupId);
      if (!group) return false;
      
              // Check group ownership - admins can see all, editors can only see their own groups
        if (currentUserId && group.userId) {
          // If group has an owner (not an admin group), check if current user owns it
          if (group.userId !== currentUserId) {
            return false;
          }
        }
        // Admin groups (no userId) are accessible to everyone
      
      return true;
    });
    
    // Check if currentProject is in the accessible projects
    const isAccessible = groupedProjects.some(p => p.id === currentProject);
    
    if (!isAccessible) {
      console.log('🔍 DEBUG: render() - Clearing inaccessible currentProject:', currentProject);
      currentProject = null;
      localStorage.removeItem('analytics.currentProject');
    } else {
      console.log('🔍 DEBUG: render() - currentProject is accessible:', currentProject);
    }
    
    // Loading analytics for currentProject
    console.log('🔍 DEBUG: render() - Loading analytics for currentProject:', currentProject);
    
    // Reset pagination when switching projects
    localStorage.removeItem('analytics.currentPage');
    
    // Show loading state immediately
      scope.textContent = 'Loading analytics...';
      if (total) total.textContent = '...';
      if (today) today.textContent = '...';
      if (week) week.textContent = '...';
      if (month) month.textContent = '...';
      if (sublinkStats) sublinkStats.innerHTML = '<div style="text-align: center; opacity: 0.7; padding: 2rem;">Loading...</div>';
      if (evtbl) evtbl.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading events...</td></tr>';
      
      // Make all API calls in parallel for faster loading
      console.log('🔍 DEBUG: Making API calls for project:', currentProject);
      console.log('🔍 DEBUG: About to enter try block');
      let a, liveData, reputationData;
      try {
        console.log('🔍 DEBUG: Inside try block, about to make API calls');
        console.log('🔍 DEBUG: About to make individual API calls');
        const analyticsCall = j('/api/analytics/paginated?project='+encodeURIComponent(currentProject)+'&limit=10&page=0');
        const liveCall = j('/api/tracking/live?project='+encodeURIComponent(currentProject)).catch(() => ({ activeUsers: 0 }));
        const reputationCall = j('/api/ip-reputation?project='+encodeURIComponent(currentProject)).catch(() => ({ 
          cleanIPs: 0, suspiciousIPs: 0, blacklistedIPs: 0, totalBlocked: 0 
        }));
        
        console.log('🔍 DEBUG: About to await Promise.all');
        try {
          console.log('🔍 DEBUG: Making API calls individually to identify hanging call');
          
          // Make calls individually to identify which one hangs
          console.log('🔍 DEBUG: Starting analytics call...');
          a = await analyticsCall;
          console.log('🔍 DEBUG: Analytics call completed');
          
          console.log('🔍 DEBUG: Starting live call...');
          liveData = await liveCall;
          console.log('🔍 DEBUG: Live call completed');
          
          console.log('🔍 DEBUG: Starting reputation call...');
          reputationData = await reputationCall;
          console.log('🔍 DEBUG: Reputation call completed');
          
          console.log('🔍 DEBUG: All API calls completed successfully');
        } catch (error) {
          console.error('❌ DEBUG: Error in individual API calls:', error);
          throw error;
        }
        
        console.log('🔍 DEBUG: Successfully completed Promise.all, about to process data');
        console.log('🔍 DEBUG: API calls completed. Analytics response:', a);
        console.log('🔍 DEBUG: Events array from API:', a.events);
        console.log('🔍 DEBUG: Events count:', a.events?.length || 0);
        console.log('🔍 DEBUG: Project info from API:', a.project);
      } catch (error) {
        console.error('❌ DEBUG: Error in API calls:', error);
        throw error;
      }
      
      console.log('🔍 DEBUG: Successfully completed API calls, about to process data');
      
      // Update scope with project ID (project name not available in API response)
      console.log('🔍 DEBUG: Setting scope with project ID:', currentProject);
      scope.textContent = 'Scope: Project "' + currentProject + '"';
      console.log('🔍 DEBUG: Successfully set scope text');
      
      // Update active users
      document.getElementById('activeUsers').textContent = liveData.activeUsers;
      if (liveVisitors) liveVisitors.textContent = liveData.activeUsers;
      
      // Update IP reputation data
      document.getElementById('cleanIPs').textContent = reputationData.cleanIPs;
      document.getElementById('suspiciousIPs').textContent = reputationData.suspiciousIPs;
      document.getElementById('blacklistedIPs').textContent = reputationData.blacklistedIPs;
      document.getElementById('blockedClicks').textContent = reputationData.totalBlocked;
      
      // Update main stats
      if (total) total.textContent = a.total; 
    if (today) today.textContent=a.today; 
    if (week) week.textContent=a.thisWeek; 
    if (month) month.textContent=a.thisMonth;
    
    // Calculate fraud analytics
    const projectEvents = a.events || [];
    console.log('📊 DEBUG: Events loaded in render():', projectEvents.length, 'events for project:', currentProject);
    console.log('📊 DEBUG: First event sample:', projectEvents[0]);
    const suspiciousCount = projectEvents.filter(e => e.fraudScore >= 50).length;
    const botCount = projectEvents.filter(e => e.isBot).length;
    const totalFraudScore = projectEvents.reduce((sum, e) => sum + (e.fraudScore || 0), 0);
    const avgScore = projectEvents.length ? Math.round(totalFraudScore / projectEvents.length) : 0;
    const cleanCount = projectEvents.filter(e => !e.isBot && (e.fraudScore || 0) < 50).length;
    
    // Calculate performance analytics
    const redirectTimes = projectEvents.filter(e => e.redirectTime).map(e => e.redirectTime);
    const avgRedirectTime = redirectTimes.length ? Math.round(redirectTimes.reduce((sum, time) => sum + time, 0) / redirectTimes.length) : 0;
    const fastRedirects = redirectTimes.filter(time => time < 100).length;
    const slowRedirects = redirectTimes.filter(time => time > 500).length;
    
    // Update performance stats
    document.getElementById('avgRedirectTime').textContent = avgRedirectTime;
    document.getElementById('fastRedirects').textContent = fastRedirects;
    document.getElementById('slowRedirects').textContent = slowRedirects;
    
    if (suspiciousClicks) suspiciousClicks.textContent = suspiciousCount;
    if (botsBlocked) botsBlocked.textContent = botCount;
    if (avgFraudScore) avgFraudScore.textContent = avgScore;
    if (cleanClicks) cleanClicks.textContent = cleanCount;
    
    // Traffic source analysis
    function categorizeReferrer(referrer) {
      if (!referrer || referrer === '') return 'Direct';
      
      const url = referrer.toLowerCase();
      
      // Social media platforms (exact matches first)
      if (url.includes('facebook.com')) return 'Facebook';
      if (url.includes('instagram.com')) return 'Instagram';
      if (url.includes('linkedin.com')) return 'LinkedIn';
      if (url.includes('youtube.com')) return 'YouTube';
      if (url.includes('tiktok.com')) return 'TikTok';
      if (url.includes('reddit.com')) return 'Reddit';
      if (url.includes('pinterest.com')) return 'Pinterest';
      if (url.includes('telegram')) return 'Telegram';
      if (url.includes('whatsapp') || url.includes('wa.me')) return 'WhatsApp';
      
      // Twitter - be very specific
      if (url.includes('twitter.com') || url.includes('t.co') || url.includes('x.com')) {
        return 'Twitter';
      }
      
      // Search engines
      if (url.includes('google.com')) return 'Google';
      if (url.includes('bing.com')) return 'Bing';
      if (url.includes('yahoo.com')) return 'Yahoo';
      if (url.includes('duckduckgo.com')) return 'DuckDuckGo';
      
      // Email platforms
      if (url.includes('mail') || url.includes('outlook') || url.includes('gmail') || url.includes('yahoo.com/mail')) return 'Email';
      
      // Educational and government
      if (url.includes('.edu')) return 'Educational';
      if (url.includes('.gov')) return 'Government';
      
      // Extract domain for other web sources
      try {
        const domain = new URL(referrer).hostname;
        return 'Web';
      } catch {
        return 'Web';
      }
    }
    
    const trafficData = {};
    projectEvents.forEach(e => {
      const source = categorizeReferrer(e.referrer);
      trafficData[source] = (trafficData[source] || 0) + 1;
    });
    
    const trafficSources = document.getElementById('trafficSources');
    trafficSources.innerHTML = '';
    Object.entries(trafficData)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .forEach(([source, count]) => {
        const badge = document.createElement('div');
        badge.className = 'badge';
        // Color code different source types - Dark indigo theme
        let bgColor = 'var(--bg-subtle)', borderColor = 'var(--border)', textColor = 'var(--text)';
        if (source === 'Google') { 
          bgColor = 'var(--bg-subtle)'; 
          borderColor = 'var(--warning)'; 
          textColor = 'var(--text)'; 
        } else if (source === 'Facebook') { 
          bgColor = 'var(--bg-subtle)'; 
          borderColor = 'var(--primary)'; 
          textColor = 'var(--text)'; 
        } else if (source === 'Twitter') { 
          bgColor = 'var(--bg-subtle)'; 
          borderColor = 'var(--success)'; 
          textColor = 'var(--text)'; 
        } else if (source === 'Direct') { 
          bgColor = 'var(--bg-subtle)'; 
          borderColor = 'var(--primary)'; 
          textColor = 'var(--text)'; 
        } else if (source === 'Email') { 
          bgColor = 'var(--bg-subtle)'; 
          borderColor = 'var(--warning)'; 
          textColor = 'var(--text)'; 
        }
        
        badge.style.cssText = 'background: ' + bgColor + '; border-color: ' + borderColor + '; color: ' + textColor + ';';
        badge.textContent = source + ': ' + count;
        trafficSources.appendChild(badge);
      });
    
    // Geographic distribution
    const geoData = {};
    projectEvents.forEach(e => {
      if (e.country) {
        geoData[e.country] = (geoData[e.country] || 0) + 1;
      }
    });
    const topCountries = Object.entries(geoData)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8);
    geoStats.innerHTML = topCountries.map(([country, count]) => 
      '<div class="badge" style="text-align: center;">' + country + '<br><strong>' + count + '</strong></div>'
    ).join('');
    
    // Calculate pixel analytics (simulated data based on events)
    const calculatePixelData = (events) => {
      const totalClicks = events.length;
      const conversionRate = 0.03; // 3% conversion rate
      const avgOrderValue = 45.99;
      
      return {
        tiktok: {
          pageViews: Math.round(totalClicks * 1.2), // 20% more page views than clicks
          clicks: totalClicks,
          purchases: Math.round(totalClicks * conversionRate),
          addToCart: Math.round(totalClicks * 0.08), // 8% add to cart rate
          initiateCheckout: Math.round(totalClicks * 0.05), // 5% checkout initiation
          viewContent: Math.round(totalClicks * 0.75), // 75% view content
          revenue: totalClicks * conversionRate * avgOrderValue,
          adSpend: totalClicks * 0.65 // Estimated ad spend
        },
        facebook: {
          pageViews: Math.round(totalClicks * 1.15), // 15% more page views than clicks
          clicks: totalClicks,
          purchases: Math.round(totalClicks * conversionRate * 0.9), // Slightly lower conversion
          addToCart: Math.round(totalClicks * 0.07), // 7% add to cart rate
          lead: Math.round(totalClicks * 0.12), // 12% lead generation
          viewContent: Math.round(totalClicks * 0.70), // 70% view content
          revenue: totalClicks * conversionRate * 0.9 * avgOrderValue,
          impressions: totalClicks * 25 // Estimated impressions
        }
      };
    };
    
    const pixelData = calculatePixelData(projectEvents);
    
    // Update TikTok Pixel data
    tiktokPageViews.textContent = pixelData.tiktok.pageViews;
    tiktokClicks.textContent = pixelData.tiktok.clicks;
    tiktokPurchases.textContent = pixelData.tiktok.purchases;
    tiktokAddToCart.textContent = pixelData.tiktok.addToCart;
    tiktokInitiateCheckout.textContent = pixelData.tiktok.initiateCheckout;
    tiktokViewContent.textContent = pixelData.tiktok.viewContent;
    tiktokRevenue.textContent = pixelData.tiktok.revenue.toFixed(2);
    const tiktokROASValue = pixelData.tiktok.adSpend > 0 ? (pixelData.tiktok.revenue / pixelData.tiktok.adSpend) : 0;
    tiktokROAS.textContent = tiktokROASValue.toFixed(1);
    
    // Update Facebook Pixel data
    facebookPageViews.textContent = pixelData.facebook.pageViews;
    facebookClicks.textContent = pixelData.facebook.clicks;
    facebookPurchases.textContent = pixelData.facebook.purchases;
    facebookAddToCart.textContent = pixelData.facebook.addToCart;
    facebookLead.textContent = pixelData.facebook.lead;
    facebookViewContent.textContent = pixelData.facebook.viewContent;
    facebookRevenue.textContent = pixelData.facebook.revenue.toFixed(2);
    const facebookCPMValue = pixelData.facebook.impressions > 0 ? (pixelData.facebook.clicks * 0.65 * 1000 / pixelData.facebook.impressions) : 0;
    facebookCPM.textContent = facebookCPMValue.toFixed(2);

    
    // Enhanced subtbl with fraud stats
    const subs = a.subs || [];
    console.log('📊 Frontend - Analytics data received:', { subs, events: projectEvents.length, project: a.project });
    if (sublinkStats) sublinkStats.innerHTML = subs.map(s => {
      const subEvents = projectEvents.filter(e => e.sub === s.id);
      const subFraud = subEvents.filter(e => e.fraudScore >= 50).length;
      const subBots = subEvents.filter(e => e.isBot).length;
      const fraudPercent = subEvents.length ? Math.round((subFraud / subEvents.length) * 100) : 0;
      const botPercent = subEvents.length ? Math.round((subBots / subEvents.length) * 100) : 0;
      console.log('📊 Frontend - Sub processing:', { id: s.id, url: s.url, count: s.count, events: subEvents.length, fraud: subFraud, bots: subBots });
      
      return '<div class="badge" style="background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 8px; padding: 12px;">' +
        '<div style="font-weight: 600; margin-bottom: 8px; color: var(--text);">Sub ' + s.id + '</div>' +
        '<div style="font-size: 12px; margin-bottom: 4px; color: var(--text-subtle);">' + (s.url.length > 30 ? s.url.substring(0, 30) + '...' : s.url) + '</div>' +
        '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; color: var(--text-muted);">' +
          '<div>Clicks: <strong style="color: var(--text);">' + s.count + '</strong></div>' +
          '<div>Fraud: <strong style="color: var(--text);">' + fraudPercent + '%</strong></div>' +
        '</div>' +
      '</div>';
    }).join('');
    
    // Enhanced events table - use events from paginated analytics API
    const filteredEvents = projectEvents.filter(e => {
      if (showSuspiciousOnly && showSuspiciousOnly.checked && (e.fraudScore || 0) < 50) return false;
      if (showBotsOnly && showBotsOnly.checked && !e.isBot) return false;
      return true;
    });
    
    // Update pagination info from API response
    const totalEventsCount = a.pagination?.total || filteredEvents.length;
    const hasMore = a.pagination?.hasMore || false;
    
    updateEventsPageInfo(1, Math.min(10, filteredEvents.length), totalEventsCount);
    updateEventsPageButtons(false, hasMore);
    
    // Calculate totals for sublinks
    const totalClicks = subs.reduce((sum, s) => sum + s.count, 0);
    const totalEvents = projectEvents.length;
    const totalFraud = projectEvents.filter(e => (e.fraudScore || 0) >= 50).length;
    
    // Update totals display
    const totalSublinkClicks = document.getElementById('totalSublinkClicks');
    const totalSublinkEvents = document.getElementById('totalSublinkEvents');
    const totalSublinkFraud = document.getElementById('totalSublinkFraud');
    if (totalSublinkClicks) totalSublinkClicks.textContent = totalClicks;
    if (totalSublinkEvents) totalSublinkEvents.textContent = totalEvents;
    if (totalSublinkFraud) totalSublinkFraud.textContent = totalFraud;

    if (evtbl) {
      // Render events table directly - no more heavy processing
      console.log('🔍 DEBUG: Rendering events table with', filteredEvents.length, 'events');
      renderEventsTable(filteredEvents, evtbl);
    } else {
      console.log('❌ DEBUG: evtbl element not found!');
    }
    
  } else if (currentGroup){
    // Show loading state immediately
    scope.textContent = 'Loading group analytics...';
    if (total) total.textContent = '...';
    if (today) today.textContent = '...';
    if (week) week.textContent = '...';
    if (month) month.textContent = '...';
    
    // Show loading state for events table
    if (evtbl) evtbl.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading...</td></tr>';
    
    const a = await j('/api/analytics?group='+encodeURIComponent(currentGroup));
    scope.textContent = 'Scope: Group "' + a.group.name + '"';
    if (total) total.textContent = a.total; 
    if (today) today.textContent=a.today; 
    if (week) week.textContent=a.thisWeek; 
    if (month) month.textContent=a.thisMonth;
    if (sublinkStats) sublinkStats.innerHTML = '<div style="text-align: center; opacity: 0.7; padding: 2rem;">Per-sublink analytics are project-specific. Select a project.</div>';
    if (evtbl) evtbl.innerHTML = '<tr><td colspan="9" class="small">Recent events list is project-specific. Select a project.</td></tr>';
  } else {
    scope.textContent = 'Scope: (All Projects). Select a group or project to drill down.';
    total.textContent = today.textContent = week.textContent = month.textContent = '0';
    sublinkStats.innerHTML = '';
    evtbl.innerHTML = '';
    
    // Load total active users across all accessible projects when no specific project is selected
    try {
      const allProjects = await j('/api/projects');
      const gs = await j('/api/groups');
      
      // Get current user info
      let currentUserId = null;
      try {
        const userResponse = await j('/api/me');
        currentUserId = userResponse.id;
      } catch (error) {
        console.log('🔍 DEBUG: Could not get current user for total active users');
      }
      
      // Filter projects to only include accessible ones
      const accessibleProjects = allProjects.filter(p => {
        const hasGroup = p.groupId && p.groupId.trim() !== '';
        if (!hasGroup) return false;
        
        const group = gs.find(g => g.id === p.groupId);
        if (!group) return false;
        
        // Check group ownership - admins can see all, editors can only see their own groups
        if (currentUserId && group.userId) {
          // If group has an owner (not an admin group), check if current user owns it
          if (group.userId !== currentUserId) {
            return false;
          }
        }
        // Admin groups (no userId) are accessible to everyone
        
        return true;
      });
      
      console.log('🔍 DEBUG: Loading total active users for', accessibleProjects.length, 'accessible projects');
      let totalActiveUsers = 0;
      
      for (const project of accessibleProjects) {
        try {
          const liveData = await j('/api/tracking/live?project='+encodeURIComponent(project.id));
          totalActiveUsers += liveData.activeUsers || 0;
        } catch (e) {
          console.log('🔍 DEBUG: Skipping project due to error:', project.id, e.message);
        }
      }
      
      document.getElementById('activeUsers').textContent = totalActiveUsers;
      if (liveVisitors) liveVisitors.textContent = totalActiveUsers;
    } catch (error) {
      console.log('Error loading total active users:', error);
      document.getElementById('activeUsers').textContent = '0';
    }
  } // end of if/else chain
} catch (analyticsError) {
  console.log('Error loading analytics:', analyticsError);
  currentProject = null;
  localStorage.removeItem('analytics.currentProject');
  return;
}

// Optimized events table rendering function - moved to global scope
function renderEventsTable(events, tableElement) {
  console.log('🔍 DEBUG: renderEventsTable called with', events?.length, 'events and tableElement:', !!tableElement);
  if (!tableElement || !events) {
    console.log('❌ DEBUG: renderEventsTable - missing tableElement or events');
    return;
  }
  
  const rows = events.map(e => {
    const location = [e.city, e.region, e.country].filter(Boolean).join(', ') || 'Unknown';
    const fraudBadge = e.fraudScore >= 50 ? '<span style="color: var(--danger);">⚠️ ' + (e.fraudScore || 0) + '</span>' : (e.fraudScore || 0);
    const status = e.isBot ? '<span style="color: var(--danger);">Bot</span>' :
      (e.fraudScore >= 50 ? '<span style="color: var(--warning);">⚠️ Suspicious</span>' :
      '<span style="color: var(--success);">Clean</span>');
    
    // Detect duplicate clicks (same IP, same sublink within 5 minutes) - optimized
    let isDuplicate = false;
    if (e.ts && e.ip && e.sub) {
      // Only check against events in the current page to avoid O(n²) complexity
      const currentPageEvents = events.filter(pe => pe !== e);
      isDuplicate = currentPageEvents.some(otherEvent => 
        otherEvent.ip === e.ip && 
        otherEvent.sub === e.sub && 
        Math.abs(otherEvent.ts - e.ts) < 300000 // 5 minutes
      );
    }
    const duplicateBadge = isDuplicate ? '<span style="color: var(--warning);">Duplicate</span>' : '<span style="color: var(--text-muted);">-</span>';
    
    return '<tr><td>'+new Date(e.ts).toLocaleString()+'</td><td>'+ (e.sub||'') +'</td><td style="max-width:200px; overflow:hidden; text-overflow:ellipsis;">'+e.url+'</td><td>'+ location +'</td><td>'+ (e.device||'') +'</td><td>'+ fraudBadge +'</td><td>'+ status +'</td><td>'+ duplicateBadge +'</td><td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">'+ (e.ua||'') +'</td></tr>';
  }).join('');
  
  tableElement.innerHTML = rows;
}
allGroupsBtn.onclick=()=>{ 
  currentGroup=null; 
  currentProject=null; 
  localStorage.removeItem('analytics.currentGroup'); 
  localStorage.removeItem('analytics.currentProject'); 
  render(); 
};

// Event listeners for filtering
if (showSuspiciousOnly) showSuspiciousOnly.onchange = () => { 
  currentEventsPage = 0; 
  if (currentProject) {
    changeEventsPage(0); // Reload current page with new filters
  }
};
if (showBotsOnly) showBotsOnly.onchange = () => { 
  currentEventsPage = 0; 
  if (currentProject) {
    changeEventsPage(0); // Reload current page with new filters
  }
};
if (refreshEventsBtn) {
  refreshEventsBtn.onclick = async () => {
    try {
      // Show loading state
      refreshEventsBtn.textContent = '⏳ Loading...';
      refreshEventsBtn.disabled = true;
      
      // Reload current page with fresh data
      if (currentProject) {
        await changeEventsPage(0);
      } else {
        await render();
      }
      
      // Show success feedback
      refreshEventsBtn.textContent = '✅ Refreshed!';
      setTimeout(() => {
        refreshEventsBtn.textContent = 'Refresh';
        refreshEventsBtn.disabled = false;
      }, 2000);
      
    } catch (error) {
      console.error('Error refreshing events:', error);
      refreshEventsBtn.textContent = '❌ Error';
      setTimeout(() => {
        refreshEventsBtn.textContent = 'Refresh';
        refreshEventsBtn.disabled = false;
      }, 2000);
    }
  };
}

// Sidebar toggle functionality
const toggleSidebarBtn = document.getElementById('toggleSidebar');
const showSidebarBtn = document.getElementById('showSidebar');
const leftSidebar = document.getElementById('leftSidebar');
const container = document.querySelector('.container');

if (toggleSidebarBtn && showSidebarBtn && leftSidebar && container) {
  // Load saved state from localStorage
  const sidebarHidden = localStorage.getItem('analytics.sidebarHidden') === 'true';
  if (sidebarHidden) {
    leftSidebar.classList.add('hidden');
    container.classList.add('sidebar-hidden');
    showSidebarBtn.style.display = 'block';
  }

  toggleSidebarBtn.onclick = () => {
    leftSidebar.classList.add('hidden');
    container.classList.add('sidebar-hidden');
    showSidebarBtn.style.display = 'block';
    localStorage.setItem('analytics.sidebarHidden', 'true');
  };

  showSidebarBtn.onclick = () => {
    leftSidebar.classList.remove('hidden');
    container.classList.remove('sidebar-hidden');
    showSidebarBtn.style.display = 'none';
    localStorage.setItem('analytics.sidebarHidden', 'false');
  };
}

render();
</script>
</body></html>`;
}

/* ================= Durable Object for Analytics ================= */
export class AnalyticsDO {
  private state: DurableObjectState;
  private env: Env;
  private analytics: Map<string, any> = new Map();
  private clickBuffer: any[] = [];
  private lastFlush = Date.now();
  private activeVisitors: Map<string, { lastSeen: number; projectId: string; sessionId: string }> = new Map();
  private heartbeatInterval: any;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    
    // Clean up inactive visitors every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.cleanupInactiveVisitors();
    }, 30000);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    switch (path) {
      case '/increment':
        return await this.handleIncrement(request);
      case '/get':
        return await this.handleGet(request);
      case '/flush':
        return await this.handleFlush();
      case '/heartbeat':
        return await this.handleHeartbeat(request);
      case '/active-visitors':
        return await this.handleActiveVisitors(request);
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  private async handleIncrement(request: Request): Promise<Response> {
    const { key, by = 1 } = await request.json() as { key: string; by?: number };
    
    // Store in memory
    const current = this.analytics.get(key) || 0;
    const newValue = current + by;
    this.analytics.set(key, newValue);
    
    // Buffer for batch KV write
    this.clickBuffer.push({ key, value: newValue, timestamp: Date.now() });
    
    // Auto-flush every 100 items or 5 minutes
    if (this.clickBuffer.length >= 100 || Date.now() - this.lastFlush > 300000) {
      await this.flushToKV();
    }
    
    // Return the new value as plain text (not JSON)
    return new Response(String(newValue));
  }

  private async handleGet(request: Request): Promise<Response> {
    const { key } = await request.json() as { key: string };
    const value = this.analytics.get(key) || 0;
    return new Response(JSON.stringify({ value }));
  }

  private async handleFlush(): Promise<Response> {
    await this.flushToKV();
    return new Response(JSON.stringify({ success: true }));
  }

  private async flushToKV() {
    if (this.clickBuffer.length === 0) return;
    
    // Batch write to KV
    const batch = this.clickBuffer.splice(0);
    for (const item of batch) {
      await this.env.LINKS_CONFIG.put(item.key, String(item.value));
    }
    
    this.lastFlush = Date.now();
  }

  private async handleHeartbeat(request: Request): Promise<Response> {
    const { sessionId, projectId } = await request.json() as { sessionId?: string; projectId: string };
    
    // Update visitor's last seen time
    if (sessionId) {
      this.activeVisitors.set(sessionId, {
        lastSeen: Date.now(),
        projectId,
        sessionId
      });
    }
    
    return new Response(JSON.stringify({ success: true }));
  }

  private async handleActiveVisitors(request: Request): Promise<Response> {
    const { projectId } = await request.json() as { projectId: string };
    
    // Clean up inactive visitors first
    this.cleanupInactiveVisitors();
    
    // Count active visitors for the specific project
    let count = 0;
    for (const visitor of this.activeVisitors.values()) {
      if (!projectId || visitor.projectId === projectId) {
        count++;
      }
    }
    
    return new Response(JSON.stringify({ count }));
  }

  private cleanupInactiveVisitors() {
    const now = Date.now();
    const timeout = 60000; // 1 minute timeout
    
    for (const [sessionId, visitor] of this.activeVisitors.entries()) {
      if (now - visitor.lastSeen > timeout) {
        this.activeVisitors.delete(sessionId);
      }
    }
  }
}

// Middleware to log API key usage
async function logApiKeyUsageMiddleware(env: Env, req: Request, response: Response, startTime: number): Promise<void> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return; // Not an API key request
  }
  
  const apiKey = authHeader.slice(7);
  const keyData = await verifyApiKey(env, apiKey);
  if (!keyData) {
    return; // Invalid API key
  }
  
  const endTime = Date.now();
  const responseTime = endTime - startTime;
  
  await logApiKeyUsage(env, {
    apiKeyId: keyData.id,
    endpoint: new URL(req.url).pathname,
    timestamp: endTime,
    ipAddress: req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown',
    userAgent: req.headers.get('user-agent') || 'unknown',
    responseStatus: response.status,
    responseTime
  });
}