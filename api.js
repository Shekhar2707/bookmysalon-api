const express = require('express');
require('dotenv').config();
process.env.TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const app = express();
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(express.json());

const https = require('https');
const fs = require('fs');
const path = require('path');
const salons = []; // Temporary, use DB in prod!
const QRCode = require('qrcode');

function sanitizeDataNamespace(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

const DATA_NAMESPACE = sanitizeDataNamespace(process.env.DATA_NAMESPACE || '');
const DEMO_TOOLS_ENABLED = String(process.env.ENABLE_DEMO_TOOLS || '').trim().toLowerCase() === 'true';
const DEMO_EMAIL_DOMAIN = String(process.env.DEMO_EMAIL_DOMAIN || '@demo.local').trim().toLowerCase();
const APP_TIMEZONE = 'Asia/Kolkata';
const FALLBACK_DURATION_MIN = 30;
const DEFAULT_SERVICE_DURATION_MIN = Math.max(10, parseInt(process.env.DEFAULT_SERVICE_DURATION_MIN || '30', 10) || 30);
const LEGACY_BOOKING_DURATION_MIN = Math.max(30, parseInt(process.env.LEGACY_BOOKING_DURATION_MIN || String(DEFAULT_SERVICE_DURATION_MIN), 10) || DEFAULT_SERVICE_DURATION_MIN);
const BOOKING_BUFFER_MIN = Math.max(0, parseInt(process.env.BOOKING_BUFFER_MIN || '5', 10) || 5);
const DATA_DIR = path.join(__dirname, DATA_NAMESPACE ? `data-${DATA_NAMESPACE}` : 'data');
const REGISTRY_FILE = path.join(DATA_DIR, 'salon-registry.json');
const CUSTOMER_SALONS_FILE = path.join(DATA_DIR, 'customer-salons.json');
const BOOKING_STATE_FILE  = path.join(DATA_DIR, 'booking-states.json');
const REVIEWS_FILE        = path.join(DATA_DIR, 'reviews.json');

function loadSalonRegistry() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(REGISTRY_FILE)) {
      fs.writeFileSync(REGISTRY_FILE, '{}', 'utf8');
      return {};
    }
    const fileText = fs.readFileSync(REGISTRY_FILE, 'utf8');
    const parsed = JSON.parse(fileText || '{}');
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (error) {
    console.error('[Registry] Load failed, starting with empty registry:', error.message);
    return {};
  }
}

function persistSalonRegistry(registryObj) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registryObj, null, 2), 'utf8');
  } catch (error) {
    console.error('[Registry] Persist failed:', error.message);
  }
}

function loadCustomerSalonMap() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(CUSTOMER_SALONS_FILE)) {
      fs.writeFileSync(CUSTOMER_SALONS_FILE, '{}', 'utf8');
      return {};
    }
    const fileText = fs.readFileSync(CUSTOMER_SALONS_FILE, 'utf8');
    const parsed = JSON.parse(fileText || '{}');
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (error) {
    console.error('[CustomerSalons] Load failed, starting with empty map:', error.message);
    return {};
  }
}

function persistCustomerSalonMap(mapObj) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CUSTOMER_SALONS_FILE, JSON.stringify(mapObj, null, 2), 'utf8');
  } catch (error) {
    console.error('[CustomerSalons] Persist failed:', error.message);
  }
}

function loadBookingStates() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(BOOKING_STATE_FILE)) {
      fs.writeFileSync(BOOKING_STATE_FILE, '{}', 'utf8');
      return {};
    }
    const parsed = JSON.parse(fs.readFileSync(BOOKING_STATE_FILE, 'utf8') || '{}');
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) {
    console.error('[BookingStates] Load failed:', e.message);
    return {};
  }
}

function persistBookingStates() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(BOOKING_STATE_FILE, JSON.stringify(bookingStates, null, 2), 'utf8');
  } catch (e) {
    console.error('[BookingStates] Persist failed:', e.message);
  }
}

function loadReviews() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(REVIEWS_FILE)) { fs.writeFileSync(REVIEWS_FILE, '{}', 'utf8'); return {}; }
    const parsed = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8') || '{}');
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) { console.error('[Reviews] Load failed:', e.message); return {}; }
}

function persistReviews() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2), 'utf8');
  } catch (e) { console.error('[Reviews] Persist failed:', e.message); }
}

const reviews = loadReviews();

function normalizePhoneKey(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function getIstParts(dateInput) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(dateInput instanceof Date ? dateInput : new Date(dateInput));

  const get = (type) => (parts.find((item) => item.type === type) || {}).value || '00';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second')
  };
}

function formatIstIso(dateInput) {
  const p = getIstParts(dateInput);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+05:30`;
}

function nowIso() {
  return formatIstIso(new Date());
}

function getTodayIst() {
  const p = getIstParts(new Date());
  return `${p.year}-${p.month}-${p.day}`;
}

function toIsoAfterDays(baseIso, days) {
  const baseMs = baseIso ? Date.parse(baseIso) : Date.now();
  const safeBaseMs = Number.isFinite(baseMs) ? baseMs : Date.now();
  const targetDate = new Date(safeBaseMs + (Math.max(0, parseInt(days, 10) || 0) * 86400000));
  const p = getIstParts(targetDate);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+05:30`;
}

function normalizeLocationKey(parts) {
  return parts
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join('|')
    .replace(/\s+/g, ' ');
}

function buildSalonUrls(baseUrl, salonId) {
  const root = String(baseUrl || 'https://bookmysalon.site').replace(/\/+$/, '');
  return {
    bookingUrl: `${root}/salon.html?id=${salonId}`,
    dashboardUrl: `${root}/dashboard.html?id=${salonId}`
  };
}

function generateUniqueSalonId() {
  let salonId = '';
  do {
    salonId = `SALON-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  } while (salonRegistry[salonId]);
  return salonId;
}

function findExistingSalonByOwnerPhone(ownerPhone) {
  const phoneKey = normalizePhoneKey(ownerPhone).slice(-10);
  if (!phoneKey) return null;
  return Object.values(salonRegistry).find((salon) => normalizePhoneKey(salon.ownerPhone).slice(-10) === phoneKey) || null;
}

function findExistingSalonByLocation(locationKey) {
  if (!locationKey) return null;
  return Object.values(salonRegistry).find((salon) => salon.locationKey && salon.locationKey === locationKey) || null;
}

function syncSalonSubscriptionState(salon) {
  if (!salon) return false;

  let changed = false;
  const registeredAt = salon.registeredAt || nowIso();
  if (!salon.registeredAt) {
    salon.registeredAt = registeredAt;
    changed = true;
  }

  const subscription = salon.subscription || (salon.subscription = {});
  if (!subscription.trialStartedAt) {
    subscription.trialStartedAt = registeredAt;
    changed = true;
  }
  if (!subscription.trialEndsAt) {
    subscription.trialEndsAt = toIsoAfterDays(subscription.trialStartedAt, 7);
    changed = true;
  }
  if (subscription.adminControlled == null) {
    subscription.adminControlled = true;
    changed = true;
  }
  if (subscription.manualLimit == null) {
    subscription.manualLimit = 100;
    changed = true;
  }

  const now = Date.now();
  if (subscription.status === 'active' && subscription.activeUntil && Date.parse(subscription.activeUntil) < now) {
    subscription.status = 'expired';
    changed = true;
  } else if (subscription.status !== 'active' && Date.parse(subscription.trialEndsAt) < now && subscription.status !== 'expired') {
    subscription.status = 'expired';
    changed = true;
  } else if (!subscription.status) {
    subscription.status = Date.parse(subscription.trialEndsAt) >= now ? 'trial' : 'expired';
    changed = true;
  }

  return changed;
}

function getManualSubscriptionCount() {
  return Object.values(salonRegistry).filter((salon) => {
    const subscription = salon.subscription || {};
    return subscription.status === 'active' && subscription.activatedManually;
  }).length;
}

function getSalonSubscriptionSnapshot(salon) {
  if (!salon) {
    return {
      isActive: false,
      status: 'missing',
      label: 'Salon Not Found',
      mode: 'missing',
      customerMessage: 'Salon profile nahi mila.',
      ownerMessage: 'Salon profile nahi mila.'
    };
  }

  if (syncSalonSubscriptionState(salon)) {
    persistSalonRegistry(salonRegistry);
  }

  const subscription = salon.subscription || {};
  const now = Date.now();
  const trialEndsAt = subscription.trialEndsAt || toIsoAfterDays(salon.registeredAt, 7);
  const activeUntil = subscription.activeUntil || null;
  const manualSlotsLeft = Math.max(0, 100 - getManualSubscriptionCount());

  if (subscription.status === 'active' && activeUntil && Date.parse(activeUntil) >= now) {
    return {
      isActive: true,
      status: 'active',
      label: 'Subscribed',
      mode: 'paid',
      trialEndsAt,
      activeUntil,
      manualSlotsLeft,
      customerMessage: 'Salon subscription active hai. Booking available hai.',
      ownerMessage: `Subscription active hai. Valid till ${new Date(activeUntil).toLocaleDateString('en-IN')}.`
    };
  }

  if (Date.parse(trialEndsAt) >= now) {
    const daysLeft = Math.max(1, Math.ceil((Date.parse(trialEndsAt) - now) / 86400000));
    return {
      isActive: true,
      status: 'trial',
      label: `Free Trial (${daysLeft} day${daysLeft > 1 ? 's' : ''} left)`,
      mode: 'trial',
      daysLeft,
      trialEndsAt,
      activeUntil: null,
      manualSlotsLeft,
      customerMessage: `Salon abhi ${daysLeft} din ke free trial par hai. Booking available hai.`,
      ownerMessage: `Aapka 7 din ka free trial chal raha hai. ${daysLeft} din bache hain.`
    };
  }

  return {
    isActive: false,
    status: 'expired',
    label: 'Subscription Required',
    mode: 'expired',
    daysLeft: 0,
    trialEndsAt,
    activeUntil,
    manualSlotsLeft,
    customerMessage: 'Salon subscription inactive hai. Booking temporarily unavailable hai. Owner ko subscription renew karne bolein.',
    ownerMessage: 'Aapka 7 din ka free trial khatam ho chuka hai. Subscription activate karaiye.'
  };
}

function buildPublicSalonData(salon) {
  const subscription = getSalonSubscriptionSnapshot(salon);
  const businessType = String(salon.businessType || 'salon').toLowerCase() === 'beauty_parlour' ? 'beauty_parlour' : 'salon';
  const services = normalizeServiceList(salon.services);
  const karigars = normalizeKarigarList(salon.karigars, salon.karigar || 0);
  return {
    salonId: salon.salonId,
    salonName: salon.salonName || 'My Salon',
    businessType,
    businessLabel: businessType === 'beauty_parlour' ? 'Beauty Parlour' : 'Salon',
    ownerName: salon.ownerName || 'Owner',
    ownerPhone: salon.ownerPhone ? `0${String(salon.ownerPhone).slice(-10)}` : '',
    bookingUrl: salon.bookingUrl || '',
    dashboardUrl: salon.dashboardUrl || '',
    location: salon.location || '',
    address: salon.address || '',
    city: salon.city || '',
    state: salon.state || '',
    pincode: salon.pincode || '',
    services,
    karigars,
    latitude: salon.latitude ?? null,
    longitude: salon.longitude ?? null,
    registeredAt: salon.registeredAt || null,
    verifiedAt: salon.verifiedAt || null,
    subscription
  };
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function parseCoordinate(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTimeToMinutes(value) {
  if (!value || typeof value !== 'string') return null;
  const parts = value.split(':').map((v) => parseInt(v, 10));
  if (parts.length < 2) return null;
  const hh = parts[0];
  const mm = parts[1];
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function minutesToTimeString(totalMinutes) {
  const bounded = Math.max(0, Math.min(24 * 60, totalMinutes));
  const hh = String(Math.floor(bounded / 60)).padStart(2, '0');
  const mm = String(bounded % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function normalizeServiceList(services) {
  if (!Array.isArray(services)) return [];
  const out = [];
  for (const item of services) {
    if (typeof item === 'string') {
      const name = item.trim();
      if (name) out.push({ name, durationMin: DEFAULT_SERVICE_DURATION_MIN });
      continue;
    }
    const name = String(item?.name || '').trim();
    if (!name) continue;
    const durationMin = Math.max(5, Math.min(240, parseInt(item?.durationMin, 10) || DEFAULT_SERVICE_DURATION_MIN));
    out.push({ name, durationMin });
  }
  return out;
}

function normalizeKarigarList(karigars, fallbackCount = 0) {
  const source = Array.isArray(karigars) ? karigars : [];
  const normalized = [];
  source.forEach((item, index) => {
    const name = String(item?.name || '').trim();
    if (!name) return;
    const id = String(item?.karigarId || `K${index + 1}`).trim().toUpperCase();
    if (!id) return;
    normalized.push({
      karigarId: id,
      name,
      active: item?.active !== false
    });
  });

  if (normalized.length) return normalized;

  const count = Math.max(0, Math.min(30, parseInt(fallbackCount, 10) || 0));
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push({ karigarId: `K${i + 1}`, name: `Karigar ${i + 1}`, active: true });
  }
  return out;
}

function sanitizeBookingRange(startTime, endTime, durationMin, defaultDurationMin = DEFAULT_SERVICE_DURATION_MIN) {
  const startMin = parseTimeToMinutes(startTime);
  if (startMin == null) return null;

  const safeDefaultDuration = Math.max(5, Math.min(300, parseInt(defaultDurationMin, 10) || FALLBACK_DURATION_MIN));
  const parsedDuration = parseInt(durationMin, 10);
  let normalizedDuration = Number.isFinite(parsedDuration) && parsedDuration > 0
    ? Math.max(5, Math.min(300, parsedDuration))
    : safeDefaultDuration;
  let endMin = parseTimeToMinutes(endTime);
  if (endMin == null || endMin <= startMin) {
    endMin = startMin + normalizedDuration;
  } else {
    normalizedDuration = endMin - startMin;
  }

  return {
    startMin,
    endMin,
    startTime: minutesToTimeString(startMin),
    endTime: minutesToTimeString(endMin),
    durationMin: normalizedDuration
  };
}

function extractLegacyBookingsFromSlots(stateObj) {
  const slots = Array.isArray(stateObj?.slots) ? stateObj.slots : [];
  const unique = new Map();

  slots.forEach((slot) => {
    const slotStart = String(slot?.time || '').trim();
    const slotBookings = Array.isArray(slot?.bookings) ? slot.bookings : [];
    slotBookings.forEach((entry) => {
      if (entry?.sequence && entry.sequence !== 1) return;
      const phone = String(entry?.phone || '').replace(/\D/g, '').slice(-10);
      const stamp = String(entry?.bookedAt || entry?.createdAt || '');
      const key = [phone, stamp, slotStart].join('|');
      if (!phone || unique.has(key)) return;
      const guessedDuration = Math.max(5, Math.min(300,
        parseInt(entry?.serviceDurationMin, 10)
        || ((parseInt(entry?.totalSlots, 10) || 1) * 30)
        || LEGACY_BOOKING_DURATION_MIN
      ));
      unique.set(key, {
        bookingId: `LEGACY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        name: String(entry?.name || 'Customer').trim() || 'Customer',
        phone,
        startTime: slotStart,
        endTime: entry?.endTime || null,
        durationMin: guessedDuration,
        serviceName: String(entry?.serviceName || '').slice(0, 80),
        createdAt: stamp || nowIso(),
        karigarId: String(entry?.karigarId || '').trim().toUpperCase() || null,
        karigarName: String(entry?.karigarName || '').trim() || null
      });
    });
  });

  return Array.from(unique.values());
}

function resolveBookingRangeMinutes(booking) {
  const fallback = Math.max(5, parseInt(booking?.durationMin, 10) || LEGACY_BOOKING_DURATION_MIN || FALLBACK_DURATION_MIN);
  return sanitizeBookingRange(booking?.startTime, booking?.endTime, fallback, LEGACY_BOOKING_DURATION_MIN);
}

function hasTimeOverlap(rangeA, rangeB) {
  return rangeA.startMin < rangeB.endMin && rangeA.endMin > rangeB.startMin;
}

function activeKarigarsFromState(stateObj, salon) {
  const fromState = normalizeKarigarList(stateObj?.karigars, stateObj?.karigar || 0);
  if (fromState.length) return fromState;
  return normalizeKarigarList(salon?.karigars, stateObj?.karigar || 0);
}

function ensureBookingStateSchema(stateObj, salon) {
  let changed = false;
  if (stateObj.bufferMin !== BOOKING_BUFFER_MIN) {
    stateObj.bufferMin = BOOKING_BUFFER_MIN;
    changed = true;
  }

  const normalizedKarigars = activeKarigarsFromState(stateObj, salon);
  if (JSON.stringify(stateObj.karigars || []) !== JSON.stringify(normalizedKarigars)) {
    stateObj.karigars = normalizedKarigars;
    changed = true;
  }

  const bookingsFromState = Array.isArray(stateObj.bookings) ? stateObj.bookings : [];
  const mergedBookings = bookingsFromState.length ? bookingsFromState : extractLegacyBookingsFromSlots(stateObj);
  if (!Array.isArray(stateObj.bookings) || !bookingsFromState.length) {
    stateObj.bookings = mergedBookings;
    changed = true;
  }

  const activeCount = normalizedKarigars.filter((k) => k.active !== false).length;
  if (stateObj.karigar !== activeCount) {
    stateObj.karigar = activeCount;
    changed = true;
  }

  return changed;
}

function rebuildLegacySlotsFromBookings(stateObj) {
  const activeCount = Math.max(0, (stateObj.karigars || []).filter((k) => k.active !== false).length);
  const legacySlots = generateSlots(stateObj.openingTime, stateObj.closingTime, activeCount);
  const ranges = (Array.isArray(stateObj.bookings) ? stateObj.bookings : [])
    .map((entry) => resolveBookingRangeMinutes(entry))
    .filter(Boolean);

  legacySlots.forEach((slot) => {
    const slotRange = sanitizeBookingRange(slot.time, slot.endTime, 30, 30);
    if (!slotRange) return;
    let used = 0;
    ranges.forEach((entryRange) => {
      if (hasTimeOverlap(slotRange, entryRange)) used += 1;
    });
    slot.booked = Math.min(slot.capacity, used);
  });

  return legacySlots;
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(a));
  return 6371 * c;
}

function addSavedSalonForCustomer(customerPhone, salonId) {
  const key = normalizePhoneKey(customerPhone);
  if (!key || !salonId) return false;
  const current = Array.isArray(customerSalonMap[key]) ? customerSalonMap[key] : [];
  if (current.includes(salonId)) return false;
  customerSalonMap[key] = [salonId, ...current].slice(0, 20);
  persistCustomerSalonMap(customerSalonMap);
  return true;
}

function removeSavedSalonForCustomer(customerPhone, salonId) {
  const key = normalizePhoneKey(customerPhone);
  if (!key || !salonId) return false;
  const current = Array.isArray(customerSalonMap[key]) ? customerSalonMap[key] : [];
  const next = current.filter((id) => id !== salonId);
  if (next.length === current.length) return false;
  customerSalonMap[key] = next;
  persistCustomerSalonMap(customerSalonMap);
  return true;
}

function getSavedSalonsForCustomer(customerPhone) {
  const key = normalizePhoneKey(customerPhone);
  return Array.isArray(customerSalonMap[key]) ? customerSalonMap[key] : [];
}

function isDemoSalonRecord(salon) {
  const email = String(salon?.email || '').trim().toLowerCase();
  return Boolean(salon?.meta?.isDemo || (email && DEMO_EMAIL_DOMAIN && email.endsWith(DEMO_EMAIL_DOMAIN)));
}

function cleanupDemoRecords(options = {}) {
  const explicitSalonIds = Array.isArray(options.salonIds)
    ? options.salonIds.map((id) => String(id || '').trim().toUpperCase()).filter(Boolean)
    : [];
  const shouldDeleteSalon = (salon) => explicitSalonIds.includes(salon.salonId) || isDemoSalonRecord(salon);

  const deletedSalonIds = Object.values(salonRegistry)
    .filter(shouldDeleteSalon)
    .map((salon) => salon.salonId);

  if (!deletedSalonIds.length) {
    return { deletedSalonIds: [], deletedCustomerKeys: [], deletedReviewSalonIds: [] };
  }

  for (const salonId of deletedSalonIds) {
    delete salonRegistry[salonId];
    delete bookingStates[salonId];
    delete reviews[salonId];
  }

  const deletedCustomerKeys = [];
  for (const [customerPhone, salonIds] of Object.entries(customerSalonMap)) {
    const nextSalonIds = (Array.isArray(salonIds) ? salonIds : []).filter((salonId) => !deletedSalonIds.includes(salonId));
    if (nextSalonIds.length === 0) {
      delete customerSalonMap[customerPhone];
      deletedCustomerKeys.push(customerPhone);
      continue;
    }
    if (nextSalonIds.length !== salonIds.length) {
      customerSalonMap[customerPhone] = nextSalonIds;
      deletedCustomerKeys.push(customerPhone);
    }
  }

  persistSalonRegistry(salonRegistry);
  persistBookingStates();
  persistCustomerSalonMap(customerSalonMap);
  persistReviews();

  return {
    deletedSalonIds,
    deletedCustomerKeys,
    deletedReviewSalonIds: deletedSalonIds
  };
}

const salonRegistry = loadSalonRegistry(); // { salonId: salonData } — webhook lookup
const customerSalonMap = loadCustomerSalonMap(); // { phone: [salonId1, salonId2] }

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v22.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || 'hello_world';
const WHATSAPP_TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'en_US';
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'bookmysalon_verify';
const ADMIN_KEY_FILE = path.join(DATA_DIR, 'admin-key.json');
function loadAdminKey() {
  try {
    const raw = fs.readFileSync(ADMIN_KEY_FILE, 'utf8');
    return JSON.parse(raw).key || process.env.ADMIN_PANEL_KEY || 'bookmysalon_admin_2026';
  } catch { return process.env.ADMIN_PANEL_KEY || 'bookmysalon_admin_2026'; }
}
let ADMIN_PANEL_KEY = loadAdminKey();
const OPENAI_API_KEY = String(
  process.env.OPENAI_API_KEY ||
  process.env.CHATGPT_API_KEY ||
  process.env.CHAT_GPT_API ||
  ''
).trim();
const OPENAI_MODEL = String(process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
const AI_ANALYTICS_FILE = path.join(DATA_DIR, 'ai-analytics.json');
const AI_LEAD_VERIFY_FILE = path.join(DATA_DIR, 'ai-lead-verifications.json');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');

function loadFeedback() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(FEEDBACK_FILE)) { fs.writeFileSync(FEEDBACK_FILE, '[]', 'utf8'); return []; }
    const parsed = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveFeedback(list) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) { console.error('[Feedback] Save failed:', e.message); }
}
const AI_RATE_LIMIT_WINDOW_MS = Math.max(60 * 1000, parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '', 10) || (10 * 60 * 1000));
const AI_RATE_LIMIT_MAX = Math.max(5, parseInt(process.env.AI_RATE_LIMIT_MAX || '', 10) || 25);
const AI_LEAD_DEDUP_WINDOW_MS = 30 * 60 * 1000;
const AI_VERIFY_EXPIRY_MS = 10 * 60 * 1000;
const AI_VERIFY_RATE_WINDOW_MS = 10 * 60 * 1000;
const AI_VERIFY_RATE_MAX = 5;
const BOOKMYSALON_WHATSAPP_NUMBER = String(process.env.BOOKMYSALON_WHATSAPP_NUMBER || '919209098349').replace(/\D/g, '');
const FREE_TRIAL_DAYS = 7;
const MANUAL_SUBSCRIPTION_LIMIT = 100;
const DEFAULT_SUBSCRIPTION_DAYS = 30;

const aiRateState = new Map();
const aiLeadDedupState = new Map();
const aiVerifyRateState = new Map();

function loadAiLeadVerifications() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(AI_LEAD_VERIFY_FILE)) {
      fs.writeFileSync(AI_LEAD_VERIFY_FILE, '{}', 'utf8');
      return {};
    }
    const parsed = JSON.parse(fs.readFileSync(AI_LEAD_VERIFY_FILE, 'utf8') || '{}');
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};
  }
}

function persistAiLeadVerifications() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(AI_LEAD_VERIFY_FILE, JSON.stringify(aiLeadVerifications, null, 2), 'utf8');
  } catch (e) {
    console.error('[AI Lead Verify] Persist failed:', e.message);
  }
}

const aiLeadVerifications = loadAiLeadVerifications();

function normalizeLegacyLeadVerifications() {
  let changed = false;
  for (const item of Object.values(aiLeadVerifications)) {
    if (!item || typeof item !== 'object') continue;

    // Legacy tokens were tied to typed phone; pending tokens should not be locked.
    if (!item.verifiedAt) {
      if (item.phone) {
        item.phone = '';
        changed = true;
      }
      if (item.maskedPhone !== '—') {
        item.maskedPhone = '—';
        changed = true;
      }
    }
  }
  if (changed) persistAiLeadVerifications();
}

normalizeLegacyLeadVerifications();

function loadAiAnalytics() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(AI_ANALYTICS_FILE)) {
      fs.writeFileSync(AI_ANALYTICS_FILE, JSON.stringify({ topQuestions: {}, leadEvents: 0, totalChats: 0, latestLeads: [] }, null, 2), 'utf8');
    }
    const parsed = JSON.parse(fs.readFileSync(AI_ANALYTICS_FILE, 'utf8') || '{}');
    return {
      topQuestions: (parsed && typeof parsed.topQuestions === 'object' && parsed.topQuestions) || {},
      leadEvents: Number(parsed?.leadEvents || 0),
      totalChats: Number(parsed?.totalChats || 0),
      latestLeads: Array.isArray(parsed?.latestLeads) ? parsed.latestLeads : []
    };
  } catch {
    return { topQuestions: {}, leadEvents: 0, totalChats: 0, latestLeads: [] };
  }
}

function persistAiAnalytics() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(AI_ANALYTICS_FILE, JSON.stringify(aiAnalytics, null, 2), 'utf8');
  } catch (e) {
    console.error('[AI Analytics] Persist failed:', e.message);
  }
}

const aiAnalytics = loadAiAnalytics();

function normalizeQuestionForAnalytics(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\u0900-\u097f\s?]/g, '')
    .trim()
    .slice(0, 180);
}

function trackQuestion(text) {
  const q = normalizeQuestionForAnalytics(text);
  if (!q || q.length < 4) return;
  aiAnalytics.topQuestions[q] = (aiAnalytics.topQuestions[q] || 0) + 1;
  aiAnalytics.totalChats += 1;
  if (aiAnalytics.totalChats % 3 === 0) persistAiAnalytics();
}

function normalizeLeadPhone(value) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function isLikelyValidIndianMobile(value) {
  const phone = normalizeLeadPhone(value);
  if (!/^[6-9]\d{9}$/.test(phone)) return false;
  if (/^(\d)\1{9}$/.test(phone)) return false;
  if (phone === '9876543210' || phone === '9123456789' || phone === '9999999999') return false;
  return true;
}

function maskLeadPhone(phone10) {
  const p = normalizeLeadPhone(phone10);
  if (!p || p.length < 10) return '—';
  return `${p.slice(0, 2)}******${p.slice(-2)}`;
}

function generateLeadVerifyToken() {
  return `BMS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function pruneExpiredLeadVerifications() {
  const now = Date.now();
  for (const [token, item] of Object.entries(aiLeadVerifications)) {
    const expiry = Date.parse(item?.expiresAt || 0);
    const verifiedAt = item?.verifiedAt ? Date.parse(item.verifiedAt) : 0;
    if ((expiry && expiry < now && !verifiedAt) || (verifiedAt && now - verifiedAt > 7 * 24 * 60 * 60 * 1000)) {
      delete aiLeadVerifications[token];
    }
  }
}

function findActiveLeadVerificationByPhone(phone) {
  const normalized = normalizeLeadPhone(phone);
  const now = Date.now();
  return Object.values(aiLeadVerifications).find((item) => {
    if (!item || item.phone !== normalized || item.verifiedAt) return false;
    const expiry = Date.parse(item.expiresAt || 0);
    return expiry > now;
  }) || null;
}

function checkAiVerifyRateLimit(req) {
  const now = Date.now();
  const ip = getClientIp(req);
  const rec = aiVerifyRateState.get(ip) || { count: 0, resetAt: now + AI_VERIFY_RATE_WINDOW_MS };
  if (now > rec.resetAt) {
    rec.count = 0;
    rec.resetAt = now + AI_VERIFY_RATE_WINDOW_MS;
  }
  rec.count += 1;
  aiVerifyRateState.set(ip, rec);
  if (rec.count > AI_VERIFY_RATE_MAX) {
    return { allowed: false, retryAfterSec: Math.ceil((rec.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

function trackLeadEvent(lead, req) {
  const name = String(lead?.name || '').trim().slice(0, 60);
  const phone = normalizeLeadPhone(lead?.phone);
  if (!name && !phone) return;

  const ip = getClientIp(req);
  const key = phone ? `phone:${phone}` : `name:${name.toLowerCase()}|ip:${ip}`;
  const now = Date.now();
  const last = aiLeadDedupState.get(key) || 0;
  if (now - last < AI_LEAD_DEDUP_WINDOW_MS) return;
  aiLeadDedupState.set(key, now);

  aiAnalytics.leadEvents += 1;
  aiAnalytics.latestLeads = Array.isArray(aiAnalytics.latestLeads) ? aiAnalytics.latestLeads : [];
  aiAnalytics.latestLeads.unshift({
    name: name || 'Unknown',
    phone,
    maskedPhone: maskLeadPhone(phone),
    capturedAt: nowIso(),
    verified: true
  });
  if (aiAnalytics.latestLeads.length > 200) {
    aiAnalytics.latestLeads = aiAnalytics.latestLeads.slice(0, 200);
  }
  persistAiAnalytics();
}

function resetAiLeadState() {
  const beforeTotalChats = Number(aiAnalytics.totalChats || 0);
  const beforeTopQuestions = aiAnalytics.topQuestions && typeof aiAnalytics.topQuestions === 'object'
    ? Object.keys(aiAnalytics.topQuestions).length
    : 0;
  const beforeLeadEvents = Number(aiAnalytics.leadEvents || 0);
  const beforeLatestLeads = Array.isArray(aiAnalytics.latestLeads) ? aiAnalytics.latestLeads.length : 0;
  const beforePendingTokens = Object.keys(aiLeadVerifications || {}).length;

  aiAnalytics.totalChats = 0;
  aiAnalytics.topQuestions = {};
  aiAnalytics.leadEvents = 0;
  aiAnalytics.latestLeads = [];
  for (const token of Object.keys(aiLeadVerifications)) {
    delete aiLeadVerifications[token];
  }
  aiLeadDedupState.clear();
  aiVerifyRateState.clear();
  persistAiAnalytics();
  persistAiLeadVerifications();

  return {
    beforeTotalChats,
    beforeTopQuestions,
    beforeLeadEvents,
    beforeLatestLeads,
    beforePendingTokens,
    hadData: (beforeTotalChats > 0) || (beforeTopQuestions > 0) || (beforeLeadEvents > 0) || (beforeLatestLeads > 0) || (beforePendingTokens > 0)
  };
}

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  const first = Array.isArray(xf) ? xf[0] : String(xf || '').split(',')[0];
  return String(first || req.ip || req.connection?.remoteAddress || 'unknown').trim();
}

function checkAiRateLimit(req) {
  const now = Date.now();
  const ip = getClientIp(req);
  const rec = aiRateState.get(ip) || { count: 0, resetAt: now + AI_RATE_LIMIT_WINDOW_MS };
  if (now > rec.resetAt) {
    rec.count = 0;
    rec.resetAt = now + AI_RATE_LIMIT_WINDOW_MS;
  }
  rec.count += 1;
  aiRateState.set(ip, rec);
  if (rec.count > AI_RATE_LIMIT_MAX) {
    const retryAfterSec = Math.ceil((rec.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }
  return { allowed: true, remaining: Math.max(0, AI_RATE_LIMIT_MAX - rec.count) };
}

function callOpenAIResponsesApi(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload || {});
    const req = https.request(
      {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/responses',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (resp) => {
        let raw = '';
        resp.on('data', (chunk) => {
          raw += chunk;
        });
        resp.on('end', () => {
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch (e) {
            return reject(new Error('OpenAI parse error: ' + e.message));
          }
          if (resp.statusCode < 200 || resp.statusCode >= 300) {
            const apiMsg = parsed?.error?.message || `OpenAI API error (${resp.statusCode})`;
            return reject(new Error(apiMsg));
          }
          resolve(parsed);
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

function extractOpenAIText(apiData) {
  if (typeof apiData?.output_text === 'string' && apiData.output_text.trim()) {
    return apiData.output_text.trim();
  }
  const out = [];
  const outputItems = Array.isArray(apiData?.output) ? apiData.output : [];
  for (const item of outputItems) {
    const contentItems = Array.isArray(item?.content) ? item.content : [];
    for (const content of contentItems) {
      if (content?.type === 'output_text' && typeof content?.text === 'string') {
        out.push(content.text);
      }
    }
  }
  return out.join('\n').trim();
}

function buildAiSystemPrompt(mode, language) {
  const isEnglish = String(language || '').toLowerCase() === 'english';
  const common = [
    'You are BookMySalon AI Assistant.',
    isEnglish
      ? 'Respond only in simple English.'
      : 'केवल शुद्ध देवनागरी हिंदी में उत्तर दो। रोमन हिंदी का उपयोग मत करो।',
    'Keep answers short, practical, and step-by-step.',
    'Use numbered steps when useful.',
    'If user is unclear, ask one short follow-up question.',
    'Explain technical terms in simple language.',
    'Avoid unsafe or false claims.'
  ].join(' ');

  if (mode === 'owner') {
    return [
      common,
      'Audience: Salon owner.',
      'Registration flow ke facts strict follow karo: register page, details fill, location verify, WhatsApp verify flow, dashboard open.',
      'OTP verification ka दावा mat karo kyunki current flow WhatsApp verify based hai.',
      'Auto location kabhi galat ho sakti hai, isliye owner ko city/pincode/coordinates manually verify karne ko bolo.',
      'Focus: booking badhana, repeat customer badhana, profile optimization, reviews, offers, staffing, slot planning.',
      'Google Maps ke fayde ko proactively samjhao: nearby discoverability, trust, direction accuracy, walk-in growth, lower drop-off.',
      'Owner ko motivate karo ki accurate latitude-longitude set kare aur business profile complete rakhe.',
      'BookMySalon flow ke examples do: register, dashboard, booking-open, slots, subscription, nearby listing.'
    ].join(' ');
  }

  return [
    common,
    'Audience: customer/user jo salon booking karna chahta hai.',
    'Focus: nearby salons, booking steps, slot selection, kya expect karein, cancellation/retry guidance.',
    'Helpful tone rakho, but concise raho.',
    'Jab user service details puchhe to bolo ki final service details salon se confirm kare.'
  ].join(' ');
}

function requireAdminKey(req, res, next) {
  const incoming = String(
    req.headers['x-admin-key'] || req.query.adminKey || req.body?.adminKey || ''
  ).trim();
  if (!incoming || incoming !== ADMIN_PANEL_KEY) {
    return res.status(401).json({ success: false, msg: 'Unauthorized admin access' });
  }
  next();
}

// Free pincode lookup using India Post API
app.get('/api/pincode-lookup/:pincode', (req, res) => {
  const pincode = (req.params.pincode || '').replace(/\D/g, '').slice(0, 6);
  
  if (!pincode || pincode.length !== 6) {
    return res.json({success: false, msg: 'Invalid pincode'});
  }

  // Call free India Post API
  const url = `https://api.postalpincode.in/pincode/${pincode}`;
  
  https.get(url, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      try {
        const result = JSON.parse(data);
        
        if (result.Status === 'Success' && result.PostOffice && result.PostOffice.length > 0) {
          const office = result.PostOffice[0];
          return res.json({
            success: true,
            city: office.District || '',
            state: office.StateName || '',
            area: office.Name || '',
            pincode: pincode
          });
        }
        
        res.json({success: false, msg: 'Pincode not found', pincode: pincode});
      } catch (e) {
        res.json({success: false, msg: 'API parse error', pincode: pincode});
      }
    });
  }).on('error', () => {
    res.json({success: false, msg: 'Lookup service unavailable', pincode: pincode});
  });
});

app.post('/api/salon-welcome-package', async (req, res) => {
  try {
    const { salonId, salonName, ownerName, bookingUrl } = req.body;
    
    if (!salonId || !salonName || !ownerName || !bookingUrl) {
      return res.json({ success: false, msg: 'Missing required fields' });
    }

    // Generate QR code as PNG
    const qrImage = await QRCode.toDataURL(bookingUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95,
      margin: 1,
      width: 280,
      color: { dark: '#000000', light: '#FFFFFF' }
    });

    // Welcome message
    const welcomeMessage = `Hi, Welcome! 🎉\n\nVerify my salon:\n\n📱 **${salonId}**\n💇 Salon: ${salonName}\n👤 Owner: ${ownerName}\n\n📲 Booking Link: ${bookingUrl}\n\nShow customers the QR code or booking link.`;

    return res.json({
      success: true,
      salonId,
      salonName,
      ownerName,
      welcomeMessage,
      qrImageDataUrl: qrImage,
      bookingUrl
    });
  } catch (error) {
    console.error('Error generating welcome package:', error);
    res.json({ success: false, msg: 'Failed to generate welcome package', error: error.message });
  }
});

function postGraphJson(path, payload) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify(payload);

    const options = {
      hostname: 'graph.facebook.com',
      path,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      }
    };

    const request = https.request(options, (response) => {
      let body = '';
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(parsed);
            return;
          }
          reject({ statusCode: response.statusCode, response: parsed });
        } catch (error) {
          reject({ statusCode: response.statusCode, response: body, parseError: error.message });
        }
      });
    });

    request.on('error', (error) => reject({ error: error.message }));
    request.write(requestData);
    request.end();
  });
}

function sendWhatsAppText(path, to, bodyText) {
  return postGraphJson(path, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: bodyText }
  });
}

app.post('/api/send-whatsapp-welcome', async (req, res) => {
  const { salonId, salonName, ownerName, bookingUrl, dashboardUrl, ownerPhone } = req.body || {};
  const cleanOwnerPhone = String(ownerPhone || '').replace(/\D/g, '');

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return res.json({
      success: false,
      msg: 'WhatsApp API config missing. Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env'
    });
  }

  if (!salonId || !salonName || !ownerName || !bookingUrl || cleanOwnerPhone.length < 10) {
    return res.json({ success: false, msg: 'Missing required fields for WhatsApp welcome send' });
  }

  const to = cleanOwnerPhone.startsWith('91') ? cleanOwnerPhone : `91${cleanOwnerPhone.slice(-10)}`;
  const qrLink = `https://quickchart.io/qr?size=700&text=${encodeURIComponent(bookingUrl)}`;
  const path = `/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const sendImage = async () => {
    const captionText = dashboardUrl
      ? `✅ ${salonId} registered!\n\n📊 Dashboard: ${dashboardUrl}\n\nCustomers ko yeh QR scan karke booking kar sakte hain.`
      : `${salonId} booking QR`;
    return postGraphJson(path, {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: {
        link: qrLink,
        caption: captionText
      }
    });
  };

  const sendTemplate = async () => {
    return postGraphJson(path, {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: WHATSAPP_TEMPLATE_NAME,
        language: { code: WHATSAPP_TEMPLATE_LANG },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: salonName },
              { type: 'text', text: salonId },
              { type: 'text', text: ownerName },
              { type: 'text', text: bookingUrl }
            ]
          }
        ]
      }
    });
  };

  try {
    // Lean path: send only QR image when allowed.
    const imageResult = await sendImage();

    return res.json({
      success: true,
      mode: 'qr-only',
      sentTo: to,
      imageMessageId: imageResult?.messages?.[0]?.id || null
    });
  } catch (error) {
    // If direct image is blocked (usually no 24h session), send approved template first, then QR.
    try {
      const templateResult = await sendTemplate();

      let imageResult = null;
      let imageError = null;
      try {
        imageResult = await sendImage();
      } catch (err) {
        imageError = err;
      }

      return res.json({
        success: true,
        mode: 'template-then-qr',
        sentTo: to,
        templateName: WHATSAPP_TEMPLATE_NAME,
        templateLanguage: WHATSAPP_TEMPLATE_LANG,
        templateMessageId: templateResult?.messages?.[0]?.id || null,
        imageMessageId: imageResult?.messages?.[0]?.id || null,
        imageSendFailed: Boolean(imageError),
        imageError,
        initialQrError: error
      });
    } catch (templateError) {
      return res.json({
        success: false,
        msg: 'WhatsApp send failed (qr-only + template fallback)',
        templateNameTried: WHATSAPP_TEMPLATE_NAME,
        templateLanguageTried: WHATSAPP_TEMPLATE_LANG,
        details: {
          initialQrError: error,
          templateError
        }
      });
    }
  }
});

app.post('/api/register-salon', (req, res) => {
  const {
    name,
    ownerName,
    email,
    phone,
    ownerPhone,
    location,
    address,
    city,
    state,
    pincode,
    services,
    karigars,
    bookingUrl,
    dashboardUrl,
    latitude,
    longitude,
    baseUrl
  } = req.body || {};
  const businessType = String(req.body?.businessType || 'salon').toLowerCase() === 'beauty_parlour' ? 'beauty_parlour' : 'salon';

  const cleanOwnerPhone = normalizePhoneKey(ownerPhone).slice(-10);
  const cleanPincode = String(pincode || '').replace(/\D/g, '').slice(0, 6);
  const latitudeNum = parseCoordinate(latitude);
  const longitudeNum = parseCoordinate(longitude);
  const normalizedServices = normalizeServiceList(services);
  const normalizedKarigars = normalizeKarigarList(karigars, 2);
  const locationParts = [address, city, state, cleanPincode].filter(Boolean);
  const locationText = String(location || locationParts.join(', ') || '').trim();
  const locationKey = normalizeLocationKey([address, city, state, cleanPincode]);

  if (!name || !ownerName || !email || cleanOwnerPhone.length !== 10 || !city || !state) {
    return res.json({ success: false, msg: 'Salon name, owner name, email, city, state and valid WhatsApp number required.' });
  }

  const existingSalon = Object.values(salonRegistry).find((item) => {
    const itemType = String(item?.businessType || 'salon').toLowerCase() === 'beauty_parlour' ? 'beauty_parlour' : 'salon';
    if (itemType !== businessType) return false;
    return String(item?.ownerPhone || '').slice(-10) === cleanOwnerPhone || (locationKey && item?.locationKey === locationKey);
  }) || null;
  if (existingSalon) {
    const existingSubscription = getSalonSubscriptionSnapshot(existingSalon);
    const typeLabel = businessType === 'beauty_parlour' ? 'Beauty Parlour' : 'Salon';
    return res.json({
      success: false,
      code: 'already_registered',
      msg: existingSubscription.isActive
        ? `Ye WhatsApp number pehle se ${typeLabel} ${existingSalon.salonId} ke saath registered hai. Naya free trial nahi milega.`
        : `Aapka ${typeLabel} ${existingSalon.salonId} pehle se registered hai. 7 din ka free trial khatam ho chuka hai. Subscription activate karaiye.`,
      salon: buildPublicSalonData(existingSalon)
    });
  }

  const salonId = generateUniqueSalonId();
  const urls = buildSalonUrls(baseUrl, salonId);
  const nowIsoValue = nowIso();

  salons.push({ name, email, phone, location: locationText, services: normalizedServices, karigars: normalizedKarigars, businessType });
  salonRegistry[salonId] = {
    salonId,
    salonName: name,
    businessType,
    ownerName,
    ownerPhone: cleanOwnerPhone,
    email,
    phone: phone || `+91${cleanOwnerPhone}`,
    location: locationText || 'Not provided',
    address: address || '',
    city: city || '',
    state: state || '',
    pincode: cleanPincode,
    latitude: latitudeNum,
    longitude: longitudeNum,
    locationKey,
    services: normalizedServices,
    karigars: normalizedKarigars,
    bookingUrl: bookingUrl || urls.bookingUrl,
    dashboardUrl: dashboardUrl || urls.dashboardUrl,
    registeredAt: nowIsoValue,
    verifiedAt: null,
    lastWelcomeSentAt: null,
    verificationMessagesSent: 0,
    subscription: {
      status: 'trial',
      trialStartedAt: nowIsoValue,
      trialEndsAt: toIsoAfterDays(nowIsoValue, FREE_TRIAL_DAYS),
      activeUntil: null,
      activatedAt: null,
      activatedBy: null,
      activatedManually: false,
      adminControlled: true,
      manualLimit: MANUAL_SUBSCRIPTION_LIMIT,
      plan: '7-day-free-trial'
    }
  };
  persistSalonRegistry(salonRegistry);

  return res.json({
    success: true,
    msg: `${businessType === 'beauty_parlour' ? 'Beauty Parlour' : 'Salon'} registered successfully. 7-day free trial started.`,
    salon: buildPublicSalonData(salonRegistry[salonId])
  });
});

app.get('/api/salon-profile/:salonId', (req, res) => {
  const salonId = String(req.params.salonId || '').trim().toUpperCase();
  if (!salonId) {
    return res.json({ success: false, msg: 'Salon ID required' });
  }

  const salon = salonRegistry[salonId];
  if (!salon) {
    return res.json({ success: false, msg: 'Salon not found' });
  }

  return res.json({
    success: true,
    salon: buildPublicSalonData(salon)
  });
});

app.post('/api/salon-location/update', (req, res) => {
  const salonId = String(req.body?.salonId || '').trim().toUpperCase();
  const latitude = parseCoordinate(req.body?.latitude);
  const longitude = parseCoordinate(req.body?.longitude);

  if (!salonId) {
    return res.json({ success: false, msg: 'Salon ID required' });
  }
  if (latitude == null || longitude == null) {
    return res.json({ success: false, msg: 'Valid latitude and longitude required' });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.json({ success: false, msg: 'Coordinates out of range' });
  }

  const salon = salonRegistry[salonId];
  if (!salon) {
    return res.json({ success: false, msg: 'Salon not found' });
  }

  salon.latitude = latitude;
  salon.longitude = longitude;
  salon.locationUpdatedAt = nowIso();
  persistSalonRegistry(salonRegistry);

  return res.json({
    success: true,
    msg: 'Salon location updated successfully',
    salon: buildPublicSalonData(salon)
  });
});

app.get('/api/nearby-salons', (req, res) => {
  const userLat = parseCoordinate(req.query.lat);
  const userLng = parseCoordinate(req.query.lng);
  const radiusKm = Math.max(1, Math.min(100, parseFloat(req.query.radiusKm) || 10));
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 30));
  const userCity = normalizeText(req.query.city);
  const userState = normalizeText(req.query.state);
  const userPincode = String(req.query.pincode || '').replace(/\D/g, '').slice(0, 6);
  const activeOnly = String(req.query.activeOnly || 'false').toLowerCase() === 'true';
  const businessType = String(req.query.businessType || 'all').toLowerCase();

  const records = Object.values(salonRegistry)
    .map((salon) => {
      const salonType = String(salon.businessType || 'salon').toLowerCase() === 'beauty_parlour' ? 'beauty_parlour' : 'salon';
      if (businessType !== 'all' && businessType !== salonType) return null;
      const subscription = getSalonSubscriptionSnapshot(salon);
      if (activeOnly && !subscription.isActive) return null;

      const salonLat = parseCoordinate(salon.latitude);
      const salonLng = parseCoordinate(salon.longitude);
      const salonCity = normalizeText(salon.city);
      const salonState = normalizeText(salon.state);
      const salonPincode = String(salon.pincode || '').replace(/\D/g, '').slice(0, 6);

      const hasUserGeo = userLat != null && userLng != null;
      const hasSalonGeo = salonLat != null && salonLng != null;
      const distanceKm = hasUserGeo && hasSalonGeo
        ? Number(haversineDistanceKm(userLat, userLng, salonLat, salonLng).toFixed(2))
        : null;

      const pincodeMatch = Boolean(userPincode && salonPincode && userPincode === salonPincode);
      const cityMatch = Boolean(userCity && salonCity && userCity === salonCity);
      const stateMatch = Boolean(userState && salonState && userState === salonState);
      const isWithinRadius = distanceKm == null ? true : distanceKm <= radiusKm;
      if (!isWithinRadius) return null;

      const sortBucket = distanceKm != null ? 0 : (pincodeMatch ? 1 : (cityMatch ? 2 : (stateMatch ? 3 : 4)));
      return {
        ...buildPublicSalonData(salon),
        distanceKm,
        pincodeMatch,
        cityMatch,
        stateMatch,
        sortBucket
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.sortBucket !== b.sortBucket) return a.sortBucket - b.sortBucket;
      if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
      if (a.subscription?.isActive !== b.subscription?.isActive) return a.subscription?.isActive ? -1 : 1;
      return String(a.salonName || '').localeCompare(String(b.salonName || ''));
    })
    .slice(0, limit);

  return res.json({
    success: true,
    total: records.length,
    businessType,
    radiusKm,
    hasUserGeo: userLat != null && userLng != null,
    salons: records
  });
});

app.get('/api/admin/salons', requireAdminKey, (req, res) => {
  const salonsList = Object.values(salonRegistry)
    .map((salon) => buildPublicSalonData(salon))
    .sort((a, b) => Date.parse(b.registeredAt || 0) - Date.parse(a.registeredAt || 0));

  const geoSetCount = salonsList.filter((salon) => salon.latitude != null && salon.longitude != null).length;
  const geoMissingCount = salonsList.length - geoSetCount;

  return res.json({
    success: true,
    salons: salonsList,
    manualActiveCount: getManualSubscriptionCount(),
    manualSlotsLeft: Math.max(0, MANUAL_SUBSCRIPTION_LIMIT - getManualSubscriptionCount()),
    geoSetCount,
    geoMissingCount
  });
});

app.post('/api/admin/subscription/activate', requireAdminKey, (req, res) => {
  const { salonId, days, activatedBy, plan } = req.body || {};
  const normalizedSalonId = String(salonId || '').trim().toUpperCase();
  const salon = salonRegistry[normalizedSalonId];
  if (!salon) {
    return res.json({ success: false, msg: 'Salon not found' });
  }

  const requestedDays = Math.max(1, parseInt(days, 10) || DEFAULT_SUBSCRIPTION_DAYS);
  const currentSubscription = getSalonSubscriptionSnapshot(salon);
  const otherActiveManualCount = Object.values(salonRegistry).filter((item) => {
    if (item.salonId === normalizedSalonId) return false;
    const subscription = item.subscription || {};
    return subscription.status === 'active' && subscription.activatedManually;
  }).length;

  if ((!salon.subscription?.activatedManually || !currentSubscription.isActive) && otherActiveManualCount >= MANUAL_SUBSCRIPTION_LIMIT) {
    return res.json({ success: false, msg: 'Manual subscription limit 100 salons tak pahunch chuka hai.' });
  }

  const nowIsoValue = nowIso();
  salon.subscription = salon.subscription || {};
  salon.subscription.status = 'active';
  salon.subscription.plan = plan || `${requestedDays}-day-plan`;
  salon.subscription.activatedAt = nowIsoValue;
  salon.subscription.activeUntil = toIsoAfterDays(nowIsoValue, requestedDays);
  salon.subscription.activatedBy = activatedBy || 'admin';
  salon.subscription.activatedManually = true;
  salon.subscription.adminControlled = true;
  persistSalonRegistry(salonRegistry);

  return res.json({ success: true, salon: buildPublicSalonData(salon) });
});

app.post('/api/admin/salon-location/update', requireAdminKey, (req, res) => {
  const salonId = String(req.body?.salonId || '').trim().toUpperCase();
  const latitude = parseCoordinate(req.body?.latitude);
  const longitude = parseCoordinate(req.body?.longitude);

  if (!salonId) {
    return res.json({ success: false, msg: 'Salon ID required' });
  }
  if (latitude == null || longitude == null) {
    return res.json({ success: false, msg: 'Valid latitude and longitude required' });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.json({ success: false, msg: 'Coordinates out of range' });
  }

  const salon = salonRegistry[salonId];
  if (!salon) {
    return res.json({ success: false, msg: 'Salon not found' });
  }

  salon.latitude = latitude;
  salon.longitude = longitude;
  salon.locationUpdatedAt = nowIso();
  persistSalonRegistry(salonRegistry);

  return res.json({
    success: true,
    msg: 'Salon location updated successfully',
    salon: buildPublicSalonData(salon)
  });
});

// Change admin key
app.post('/api/admin/change-key', requireAdminKey, (req, res) => {
  const newKey = String(req.body?.newKey || '').trim();
  if (!newKey || newKey.length < 6) {
    return res.status(400).json({ success: false, msg: 'Nai key kam se kam 6 characters ki honi chahiye' });
  }
  try {
    fs.writeFileSync(ADMIN_KEY_FILE, JSON.stringify({ key: newKey }), 'utf8');
    ADMIN_PANEL_KEY = newKey;
    return res.json({ success: true, msg: 'Admin key change ho gayi!' });
  } catch (e) {
    return res.status(500).json({ success: false, msg: 'Key save nahi ho sake: ' + e.message });
  }
});

app.post('/api/admin/demo/cleanup', requireAdminKey, (req, res) => {
  if (!DEMO_TOOLS_ENABLED) {
    return res.status(403).json({ success: false, msg: 'Demo cleanup disabled. Enable ENABLE_DEMO_TOOLS=true only in local/demo environment.' });
  }

  const salonIds = Array.isArray(req.body?.salonIds) ? req.body.salonIds : [];
  const result = cleanupDemoRecords({ salonIds });
  return res.json({
    success: true,
    msg: result.deletedSalonIds.length
      ? `Deleted ${result.deletedSalonIds.length} demo salon records.`
      : 'No demo salon records found.',
    ...result,
    dataNamespace: DATA_NAMESPACE || 'default'
  });
});

app.post('/api/ai/lead/request-verify', (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 60);

  if (name.length < 2) {
    return res.status(400).json({ success: false, msg: 'नाम सही भरें।' });
  }

  const rate = checkAiVerifyRateLimit(req);
  if (!rate.allowed) {
    return res.status(429).json({ success: false, msg: `बहुत ज़्यादा verify attempts हैं। ${rate.retryAfterSec} सेकंड बाद कोशिश करें।` });
  }

  pruneExpiredLeadVerifications();
  const token = generateLeadVerifyToken();
  const expiresAt = formatIstIso(new Date(Date.now() + AI_VERIFY_EXPIRY_MS));

  aiLeadVerifications[token] = {
    token,
    name,
    phone: '',
    maskedPhone: '—',
    createdAt: nowIso(),
    expiresAt,
    verifiedAt: null,
    status: 'pending'
  };
  persistAiLeadVerifications();

  const whatsappText = `VERIFY LEAD ${token}`;
  const whatsappUrl = `https://wa.me/${BOOKMYSALON_WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappText)}`;
  return res.json({
    success: true,
    token,
    expiresAt,
    whatsappText,
    whatsappUrl,
    maskedPhone: '—'
  });
});

app.get('/api/ai/lead/verify-status/:token', (req, res) => {
  pruneExpiredLeadVerifications();
  const token = String(req.params?.token || '').trim().toUpperCase();
  const item = aiLeadVerifications[token];
  if (!item) {
    return res.json({ success: false, status: 'missing', msg: 'Verification token नहीं मिला।' });
  }
  if (item.verifiedAt) {
    return res.json({
      success: true,
      status: 'verified',
      verifiedAt: item.verifiedAt,
      maskedPhone: item.maskedPhone,
      phone: normalizeLeadPhone(item.phone),
      name: item.name
    });
  }
  if (Date.parse(item.expiresAt || 0) < Date.now()) {
    return res.json({ success: false, status: 'expired', msg: 'Verification link expire हो गया।' });
  }
  return res.json({ success: true, status: 'pending', expiresAt: item.expiresAt, maskedPhone: item.maskedPhone, name: item.name });
});

app.post('/api/ai/chat', async (req, res) => {
  const mode = String(req.body?.mode || 'customer').trim().toLowerCase() === 'owner' ? 'owner' : 'customer';
  const language = String(req.body?.language || 'hindi').trim().toLowerCase() === 'english' ? 'english' : 'hindi';
  const message = String(req.body?.message || '').trim();
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  const salonContext = req.body?.salonContext && typeof req.body.salonContext === 'object' ? req.body.salonContext : null;
  const lead = req.body?.lead && typeof req.body.lead === 'object' ? req.body.lead : null;

  const rate = checkAiRateLimit(req);
  if (!rate.allowed) {
    return res.status(429).json({
      success: false,
      msg: `Zyada requests aa rahi hain. ${rate.retryAfterSec} sec baad try karo.`
    });
  }

  if (!message) {
    return res.status(400).json({ success: false, msg: 'Message required hai.' });
  }
  if (!OPENAI_API_KEY) {
    return res.status(503).json({
      success: false,
      msg: 'AI temporarily unavailable. Server me OPENAI_API_KEY set karo.'
    });
  }

  try {
    const compactHistory = history
      .slice(-8)
      .map((item) => {
        const role = String(item?.role || '').toLowerCase() === 'assistant' ? 'assistant' : 'user';
        const text = String(item?.text || item?.content || '').trim().slice(0, 600);
        return text ? { role, text } : null;
      })
      .filter(Boolean);

    const contextLines = [];
    if (salonContext?.salonId) contextLines.push(`Salon ID: ${salonContext.salonId}`);
    if (salonContext?.salonName) contextLines.push(`Salon Name: ${salonContext.salonName}`);
    if (salonContext?.city) contextLines.push(`City: ${salonContext.city}`);
    if (salonContext?.hasLocation != null) contextLines.push(`Location Set: ${salonContext.hasLocation ? 'Yes' : 'No'}`);
    if (salonContext?.subscriptionLabel) contextLines.push(`Subscription: ${salonContext.subscriptionLabel}`);
    if (lead?.name) contextLines.push(`Lead Name: ${String(lead.name).trim().slice(0, 60)}`);
    if (lead?.phone) contextLines.push(`Lead Phone: ${String(lead.phone).replace(/\D/g, '').slice(-10)}`);

    trackQuestion(message);
    if (aiAnalytics.totalChats % 5 === 0) persistAiAnalytics();

    const finalUserMessage = contextLines.length
      ? `Context:\n${contextLines.join('\n')}\n\nUser question: ${message}`
      : message;

    const input = [
      {
        role: 'system',
        content: [{ type: 'input_text', text: buildAiSystemPrompt(mode, language) }]
      },
      ...compactHistory.map((item) => ({
        role: item.role,
        content: [{ type: 'input_text', text: item.text }]
      })),
      {
        role: 'user',
        content: [{ type: 'input_text', text: finalUserMessage }]
      }
    ];

    const responseData = await callOpenAIResponsesApi({
      model: OPENAI_MODEL,
      input,
      max_output_tokens: 380,
      temperature: 0.5
    });

    const reply = extractOpenAIText(responseData) || 'Abhi clear response nahi bana. Aap question thoda short me dobara bhejo.';
    return res.json({ success: true, mode, language, reply });
  } catch (error) {
    console.error('[AI Chat] Failed:', error.message);
    return res.status(502).json({
      success: false,
      msg: 'AI response abhi nahi aa paaya. 1 min baad dobara try karo.'
    });
  }
});

app.get('/api/admin/ai-analytics', requireAdminKey, (req, res) => {
  pruneExpiredLeadVerifications();

  const topQuestions = Object.entries(aiAnalytics.topQuestions || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([question, count]) => ({ question, count }));

  const verifiedLeads = (Array.isArray(aiAnalytics.latestLeads) ? aiAnalytics.latestLeads : []).map((item) => ({
    key: `verified:${normalizeLeadPhone(item?.phone)}:${item?.capturedAt || ''}`,
    name: String(item?.name || 'Unknown'),
    phone: normalizeLeadPhone(item?.phone),
    maskedPhone: String(item?.maskedPhone || maskLeadPhone(item?.phone)),
    capturedAt: item?.capturedAt || null,
    verified: item?.verified !== false
  }));

  const pendingLeads = Object.values(aiLeadVerifications || {}).map((item) => ({
    key: `verify:${String(item?.token || '')}`,
    name: String(item?.name || 'Unknown'),
    phone: normalizeLeadPhone(item?.phone),
    maskedPhone: String(item?.maskedPhone || maskLeadPhone(item?.phone)),
    capturedAt: item?.verifiedAt || item?.createdAt || null,
    verified: !!item?.verifiedAt
  }));

  const latestLeadMap = new Map();
  for (const item of [...pendingLeads, ...verifiedLeads]) {
    if (!item.phone && !item.name) continue;
    if (!latestLeadMap.has(item.key)) latestLeadMap.set(item.key, item);
  }

  const latestLeads = Array.from(latestLeadMap.values())
    .sort((a, b) => Date.parse(b.capturedAt || 0) - Date.parse(a.capturedAt || 0))
    .slice(0, 50);

  return res.json({
    success: true,
    totalChats: aiAnalytics.totalChats || 0,
    leadEvents: aiAnalytics.leadEvents || 0,
    topQuestions,
    latestLeads
  });
});

app.post('/api/admin/ai-leads/reset', requireAdminKey, (req, res) => {
  const resetInfo = resetAiLeadState();
  const msg = resetInfo.hadData
    ? `AI reset complete. Cleared chats=${resetInfo.beforeTotalChats}, topQuestions=${resetInfo.beforeTopQuestions}, leads=${resetInfo.beforeLatestLeads}, leadEvents=${resetInfo.beforeLeadEvents}, pendingVerifications=${resetInfo.beforePendingTokens}.`
    : 'AI reset skipped: reset karne ke liye koi AI data nahi tha.';
  return res.json({ success: true, msg, resetInfo });
});

// ── WhatsApp Webhook ───────────────────────────────────────────────
// GET /webhook — Meta verification challenge
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// POST /webhook — incoming WhatsApp messages
app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Always 200 first (Meta requirement)
  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    const messages = body.entry?.[0]?.changes?.[0]?.value?.messages;
    if (!messages || messages.length === 0) return;

    const msg = messages[0];
    if (msg.type !== 'text') return;

    const fromPhone = msg.from; // e.g. "919876543210"
    const msgText = (msg.text?.body || '').trim();
    const upperText = msgText.toUpperCase();
    console.log('[Webhook] Incoming message from', fromPhone, 'text:', msgText);

    const path = `/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const match = msgText.match(/SALON-([A-Z0-9]{5})/i);
    const salonIdFromMessage = match ? `SALON-${match[1].toUpperCase()}` : null;
    const verifyLeadMatch = msgText.match(/^VERIFY\s+LEAD\s+(BMS-[A-Z0-9]{6})$/i);

    if (verifyLeadMatch) {
      pruneExpiredLeadVerifications();
      const token = String(verifyLeadMatch[1] || '').toUpperCase();
      const item = aiLeadVerifications[token];
      const senderPhone = normalizePhoneKey(fromPhone).slice(-10);

      if (!item) {
        await sendWhatsAppText(path, fromPhone, 'यह verification token नहीं मिला या expire हो गया है। वेबसाइट पर जाकर फिर से WhatsApp verify करें।');
        return;
      }
      if (item.verifiedAt) {
        await sendWhatsAppText(path, fromPhone, 'यह lead पहले से verify हो चुकी है। अब आप वेबसाइट पर वापस जाकर chat जारी रख सकते हैं।');
        return;
      }
      if (Date.parse(item.expiresAt || 0) < Date.now()) {
        delete aiLeadVerifications[token];
        persistAiLeadVerifications();
        await sendWhatsAppText(path, fromPhone, 'यह verification expire हो गया। वेबसाइट से फिर से verify शुरू करें।');
        return;
      }
      if (item.phone && item.phone !== senderPhone) {
        await sendWhatsAppText(path, fromPhone, 'यह token किसी और WhatsApp नंबर से verify हो चुका है। वेबसाइट से नया verify token बनाएं।');
        return;
      }

      item.phone = senderPhone;
      item.maskedPhone = maskLeadPhone(senderPhone);
      item.verifiedAt = nowIso();
      item.status = 'verified';
      persistAiLeadVerifications();
      trackLeadEvent({ name: item.name, phone: item.phone }, { headers: {}, ip: fromPhone, connection: { remoteAddress: fromPhone } });
      await sendWhatsAppText(path, fromPhone, 'Lead verify हो गई है। अब आप वेबसाइट पर वापस जाकर chat इस्तेमाल कर सकते हैं।');
      return;
    }

    if (/^(MY\s+SALONS|LIST\s+SALONS|SHOW\s+SALONS)$/i.test(upperText)) {
      const saved = getSavedSalonsForCustomer(fromPhone);
      if (!saved.length) {
        await sendWhatsAppText(
          path,
          fromPhone,
          'Aapke paas koi saved salon nahi hai. Save karne ke liye message bheje: SAVE SALON-XXXXX'
        );
        return;
      }

      const lines = saved.slice(0, 10).map((id, idx) => {
        const salon = salonRegistry[id];
        const salonName = salon?.salonName || 'Salon';
        const bookingUrl = salon?.bookingUrl || `https://bookmysalon.site/salon.html?id=${id}`;
        return `${idx + 1}. ${id} (${salonName})\n${bookingUrl}`;
      });

      await sendWhatsAppText(
        path,
        fromPhone,
        `Aapke saved salons:\n\n${lines.join('\n\n')}\n\nRemove karne ke liye bheje: UNSAVE SALON-XXXXX`
      );
      return;
    }

    if (/^SAVE\b/i.test(upperText)) {
      if (!salonIdFromMessage) {
        await sendWhatsAppText(path, fromPhone, 'Format use kare: SAVE SALON-XXXXX');
        return;
      }

      const salon = salonRegistry[salonIdFromMessage];
      if (!salon) {
        await sendWhatsAppText(path, fromPhone, `Salon ID ${salonIdFromMessage} nahi mila.`);
        return;
      }

      const isNewSave = addSavedSalonForCustomer(fromPhone, salonIdFromMessage);
      const bookingUrl = salon.bookingUrl || `https://bookmysalon.site/salon.html?id=${salonIdFromMessage}`;
      await sendWhatsAppText(
        path,
        fromPhone,
        isNewSave
          ? `Saved: ${salonIdFromMessage}\n${bookingUrl}\n\nKabhi bhi MY SALONS bhejkar list dekh sakte hain.`
          : `${salonIdFromMessage} pehle se saved hai.\n${bookingUrl}`
      );
      return;
    }

    if (/^(UNSAVE|REMOVE)\b/i.test(upperText)) {
      if (!salonIdFromMessage) {
        await sendWhatsAppText(path, fromPhone, 'Format use kare: UNSAVE SALON-XXXXX');
        return;
      }

      const removed = removeSavedSalonForCustomer(fromPhone, salonIdFromMessage);
      await sendWhatsAppText(
        path,
        fromPhone,
        removed
          ? `Removed: ${salonIdFromMessage}`
          : `${salonIdFromMessage} aapki saved list me nahi tha.`
      );
      return;
    }

    // Match "verify my salon SALON-XXXXX" pattern
    if (!match) return;

    const salonId = `SALON-${match[1].toUpperCase()}`;
    const salon = salonRegistry[salonId];

    if (!salon) {
      console.log('[Webhook] Salon not found in registry for', salonId);
      try {
        await sendWhatsAppText(path, fromPhone, `Salon ID ${salonId} nahi mila. Kripya register form dobara submit karke phir verify message bheje.`);
      } catch (notifyErr) {
        console.error('[Webhook] Failed to send salon-not-found message:', notifyErr);
      }
      return;
    }

    const senderPhone = normalizePhoneKey(fromPhone).slice(-10);
    if (salon.ownerPhone && normalizePhoneKey(salon.ownerPhone).slice(-10) !== senderPhone) {
      await sendWhatsAppText(
        path,
        fromPhone,
        `Ye salon ${salonId} kisi aur WhatsApp number se registered hai. Kripya owner ka registered number use karein.`
      );
      return;
    }

    const subscription = getSalonSubscriptionSnapshot(salon);
    if (!subscription.isActive) {
      await sendWhatsAppText(
        path,
        fromPhone,
        `${subscription.ownerMessage}\n\nSalon ID: ${salonId}\nDashboard: ${salon.dashboardUrl || 'https://bookmysalon.site/register.html'}`
      );
      return;
    }

    if (salon.lastWelcomeSentAt && Date.now() - Date.parse(salon.lastWelcomeSentAt) < 120000) {
      await sendWhatsAppText(
        path,
        fromPhone,
        `Aapka salon ${salonId} already verified hai.\nDashboard: ${salon.dashboardUrl || ''}\nBooking link: ${salon.bookingUrl || ''}`
      );
      return;
    }

    addSavedSalonForCustomer(fromPhone, salonId);

    const qrLink = `https://quickchart.io/qr?size=700&text=${encodeURIComponent(salon.bookingUrl)}`;
    let templateSent = false;
    let qrSent = false;

    // Send approved template first (opens 24h session)
    try {
      await postGraphJson(path, {
        messaging_product: 'whatsapp',
        to: fromPhone,
        type: 'template',
        template: {
          name: WHATSAPP_TEMPLATE_NAME,
          language: { code: WHATSAPP_TEMPLATE_LANG },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: salon.salonName },
              { type: 'text', text: salonId },
              { type: 'text', text: salon.ownerName },
              { type: 'text', text: salon.bookingUrl }
            ]
          }]
        }
      });
      templateSent = true;
    } catch (templateErr) {
      console.error('[Webhook] Template send failed:', templateErr);
    }

    // Send QR image with dashboard link in caption
    try {
      await postGraphJson(path, {
        messaging_product: 'whatsapp',
        to: fromPhone,
        type: 'image',
        image: {
          link: qrLink,
          caption: `✅ ${salonId} verified!\n\n📊 Dashboard: ${salon.dashboardUrl}\n\nCustomers ko yeh QR scan karke booking kar sakte hain.`
        }
      });
      qrSent = true;
    } catch (imageErr) {
      console.error('[Webhook] QR image send failed:', imageErr);
    }

    if (!templateSent && !qrSent) {
      try {
        await sendWhatsAppText(path, fromPhone, `Verification receive hua, lekin welcome/QR bhejne mein issue aaya. Kripya 1 min baad fir message bheje: verify my salon ${salonId}`);
      } catch (fallbackErr) {
        console.error('[Webhook] Fallback text send failed:', fallbackErr);
      }
      return;
    }

    salon.verifiedAt = salon.verifiedAt || nowIso();
    salon.lastWelcomeSentAt = nowIso();
    salon.verificationMessagesSent = (salon.verificationMessagesSent || 0) + 1;
    persistSalonRegistry(salonRegistry);

  } catch (err) {
    console.error('Webhook error:', err);
  }
});

// ── Booking State (persisted to disk, survives restarts) ─────────────────────
const bookingStates = loadBookingStates(); // { salonId: { isOpen, karigar, openingTime, closingTime, slots, date } }
const bookingWriteLocks = new Map();

function withSalonWriteLock(salonId, task) {
  const lockKey = String(salonId || '').trim().toUpperCase() || 'GLOBAL';
  const previous = bookingWriteLocks.get(lockKey) || Promise.resolve();
  let release = null;
  const gate = new Promise((resolve) => { release = resolve; });
  const queued = previous.then(() => gate);
  bookingWriteLocks.set(lockKey, queued);

  return previous
    .then(() => task())
    .finally(() => {
      if (typeof release === 'function') release();
      if (bookingWriteLocks.get(lockKey) === queued) {
        bookingWriteLocks.delete(lockKey);
      }
    });
}

function getToday() {
  return getTodayIst();
}

function generateSlots(openTime, closeTime, karigar) {
  const slots = [];
  const [oh, om] = openTime.split(':').map(Number);
  const [ch, cm] = closeTime.split(':').map(Number);
  let cur = oh * 60 + om;
  const end = ch * 60 + cm;
  while (cur + 30 <= end) {
    const h  = String(Math.floor(cur / 60)).padStart(2, '0');
    const m  = String(cur % 60).padStart(2, '0');
    const eh = String(Math.floor((cur + 30) / 60)).padStart(2, '0');
    const em = String((cur + 30) % 60).padStart(2, '0');
    slots.push({ time: `${h}:${m}`, endTime: `${eh}:${em}`, capacity: karigar, booked: 0 });
    cur += 30;
  }
  return slots;
}

// GET /api/salon-ratings/:salonId
app.get('/api/salon-ratings/:salonId', (req, res) => {
  const salonId = String(req.params.salonId || '').trim().toUpperCase();
  const list = reviews[salonId] || [];
  const avg = list.length ? (list.reduce((sum, r) => sum + r.stars, 0) / list.length).toFixed(1) : null;
  return res.json({ success: true, salonId, reviews: list, avgRating: avg, totalReviews: list.length });
});

// POST /api/add-review  { salonId, customerPhone, stars, comment }
app.post('/api/add-review', (req, res) => {
  const { salonId, customerPhone, stars, comment } = req.body || {};
  if (!salonId || !stars || stars < 1 || stars > 5) return res.json({ success: false, msg: 'Invalid data' });
  const sid = String(salonId).toUpperCase();
  const phone = String(customerPhone || '').replace(/\D/g, '');
  reviews[sid] = reviews[sid] || [];
  const today = getToday();
  const idx = reviews[sid].findIndex(r => r.phone === phone && r.date === today);
  const entry = { phone, stars: parseInt(stars), comment: String(comment || '').slice(0, 200).trim(), date: today, createdAt: nowIso() };
  if (idx >= 0) { reviews[sid][idx] = entry; } else { reviews[sid].push(entry); }
  persistReviews();
  return res.json({ success: true, msg: 'Review saved!' });
});

// GET /api/booking-state/:salonId
app.get('/api/booking-state/:salonId', (req, res) => {
  const { salonId } = req.params;
  const today = getToday();
  let bs = bookingStates[salonId];
  const salon = salonRegistry[salonId];
  const subscription = getSalonSubscriptionSnapshot(salon);

  // Auto-reset if new day
  if (bs && bs.date !== today) {
    bs.isOpen = false;
    bs.slots = [];
    bs.bookings = [];
    bs.karigar = 0;
    bs.karigars = normalizeKarigarList(salon?.karigars, 0);
    bs.bufferMin = BOOKING_BUFFER_MIN;
    bs.date = today;
    bs.closeReason = 'auto-midnight';
    persistBookingStates();
  }

  if (!bs) {
    return res.json({
      success: true,
      salonId,
      isOpen: false,
      slots: [],
      bookings: [],
      karigar: 0,
      karigars: normalizeKarigarList(salon?.karigars, 0),
      date: today,
      bufferMin: BOOKING_BUFFER_MIN,
      subscription
    });
  }

  if (ensureBookingStateSchema(bs, salon)) {
    bs.slots = rebuildLegacySlotsFromBookings(bs);
    persistBookingStates();
  }

  bs.slots = rebuildLegacySlotsFromBookings(bs);

  res.json({ success: true, ...bs, subscription });
});

// POST /api/booking-open  { salonId, karigar, openingTime, closingTime }
app.post('/api/booking-open', async (req, res) => {
  const { karigar, openingTime, closingTime } = req.body || {};
  const salonId = String(req.body?.salonId || '').trim().toUpperCase();
  if (!salonId || !openingTime || !closingTime) {
    return res.json({ success: false, msg: 'Missing fields' });
  }

  try {
    const result = await withSalonWriteLock(salonId, () => {
      const salon = salonRegistry[salonId];
      if (!salon) return { success: false, msg: 'Salon not found' };

      const subscription = getSalonSubscriptionSnapshot(salon);
      if (!subscription.isActive) return { success: false, msg: subscription.ownerMessage };
      if (openingTime >= closingTime) {
        return { success: false, msg: 'Closing time must be after opening time' };
      }

      const normalizedKarigars = normalizeKarigarList(req.body?.karigars, karigar || salon?.karigar || salon?.karigars?.length || 0);
      const activeKarigars = normalizedKarigars.filter((item) => item.active !== false);
      if (!activeKarigars.length) {
        return { success: false, msg: 'At least one active karigar is required' };
      }

      const today = getToday();
      const slots = generateSlots(openingTime, closingTime, activeKarigars.length);
      bookingStates[salonId] = {
        salonId,
        isOpen: true,
        karigar: activeKarigars.length,
        karigars: normalizedKarigars,
        openingTime,
        closingTime,
        bufferMin: BOOKING_BUFFER_MIN,
        slots,
        bookings: [],
        date: today,
        closeReason: null
      };

      salon.karigars = normalizedKarigars;
      salon.karigar = activeKarigars.length;
      persistSalonRegistry(salonRegistry);
      persistBookingStates();
      return { success: true, slots, karigar: activeKarigars.length, karigars: normalizedKarigars, message: 'Booking opened' };
    });

    return res.json(result);
  } catch (error) {
    console.error('[booking-open] lock failure:', error.message);
    return res.json({ success: false, msg: 'Booking open failed. Retry karein.' });
  }
});

// POST /api/booking-close  { salonId }
app.post('/api/booking-close', async (req, res) => {
  const salonId = String(req.body?.salonId || '').trim().toUpperCase();
  if (!salonId || !bookingStates[salonId]) {
    return res.json({ success: false, msg: 'Salon not found' });
  }

  try {
    const result = await withSalonWriteLock(salonId, () => {
      if (!bookingStates[salonId]) {
        return { success: false, msg: 'Salon not found' };
      }
      bookingStates[salonId].isOpen = false;
      bookingStates[salonId].closeReason = 'manual';
      persistBookingStates();
      return { success: true, message: 'Booking closed' };
    });
    return res.json(result);
  } catch (error) {
    console.error('[booking-close] lock failure:', error.message);
    return res.json({ success: false, msg: 'Booking close failed. Retry karein.' });
  }
});

// POST /api/book-slot  { salonId, startTime, endTime, customerName, customerPhone, durationMin, karigarId }
app.post('/api/book-slot', async (req, res) => {
  const customerName = req.body?.customerName;
  const customerPhone = req.body?.customerPhone;
  const salonId = String(req.body?.salonId || '').trim().toUpperCase();
  const startTime = req.body?.startTime || req.body?.time;
  const requestedRange = sanitizeBookingRange(startTime, req.body?.endTime, req.body?.durationMin, LEGACY_BOOKING_DURATION_MIN);
  if (!requestedRange) return res.json({ success: false, msg: 'Invalid start/end time' });

  try {
    const result = await withSalonWriteLock(salonId, () => {
      const bs = bookingStates[salonId];
      const salon = salonRegistry[salonId];
      const subscription = getSalonSubscriptionSnapshot(salon);
      if (!subscription.isActive) return { success: false, msg: subscription.customerMessage };
      if (!bs || !bs.isOpen) return { success: false, msg: 'Salon booking is closed' };

      if (ensureBookingStateSchema(bs, salon)) {
        bs.slots = rebuildLegacySlotsFromBookings(bs);
      }

      const dayStart = parseTimeToMinutes(bs.openingTime);
      const dayEnd = parseTimeToMinutes(bs.closingTime);
      if (dayStart == null || dayEnd == null || requestedRange.startMin < dayStart || requestedRange.endMin > dayEnd) {
        return { success: false, msg: 'Selected time salon working hours ke bahar hai.' };
      }

      const allKarigars = activeKarigarsFromState(bs, salon).filter((item) => item.active !== false);
      if (!allKarigars.length) return { success: false, msg: 'No active karigar available' };

      const selectedKarigarId = String(req.body?.karigarId || 'ANY').trim().toUpperCase() || 'ANY';
      const targetKarigars = selectedKarigarId === 'ANY'
        ? allKarigars
        : allKarigars.filter((item) => item.karigarId === selectedKarigarId);

      if (!targetKarigars.length) return { success: false, msg: 'Selected karigar not available' };

      const bookings = Array.isArray(bs.bookings) ? bs.bookings : [];
      const bufferedRequested = {
        startMin: requestedRange.startMin,
        endMin: requestedRange.endMin + BOOKING_BUFFER_MIN
      };

      // 1 booking per phone per day per salon
      const cleanPhone = String(customerPhone || '').replace(/\D/g, '').slice(-10);
      const alreadyToday = bookings.some((entry) => String(entry?.phone || '').replace(/\D/g, '').slice(-10) === cleanPhone);
      if (alreadyToday) return { success: false, msg: 'Aapki aaj ki booking pehle se hai is salon mein. Kal dobara aayen! 🙏' };

      let assignedKarigar = null;
      for (const karigarItem of targetKarigars) {
        const hasConflict = bookings.some((entry) => {
          const entryKarigar = String(entry?.karigarId || '').trim().toUpperCase();
          if (entryKarigar && entryKarigar !== karigarItem.karigarId) return false;
          const existingRange = resolveBookingRangeMinutes(entry);
          if (!existingRange) return false;
          const bufferedExisting = {
            startMin: existingRange.startMin,
            endMin: existingRange.endMin + BOOKING_BUFFER_MIN
          };
          return hasTimeOverlap(bufferedRequested, bufferedExisting);
        });
        if (!hasConflict) {
          assignedKarigar = karigarItem;
          break;
        }
      }

      if (!assignedKarigar) {
        return { success: false, msg: 'Selected time par koi karigar free nahi hai. Dusra slot chunein.' };
      }

      const bookingTime = nowIso();
      const bookingRecord = {
        bookingId: `BK-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        name: String(customerName || '').trim() || 'Customer',
        phone: cleanPhone,
        karigarId: assignedKarigar.karigarId,
        karigarName: assignedKarigar.name,
        startTime: requestedRange.startTime,
        endTime: requestedRange.endTime,
        durationMin: requestedRange.durationMin,
        serviceName: String(req.body?.serviceName || '').slice(0, 80),
        selectedServices: normalizeServiceList(req.body?.selectedServices),
        createdAt: bookingTime
      };

      bs.bookings = bookings;
      bs.bookings.push(bookingRecord);
      bs.slots = rebuildLegacySlotsFromBookings(bs);
      persistBookingStates();

      const remaining = allKarigars.length - bs.bookings.filter((entry) => {
        const entryRange = resolveBookingRangeMinutes(entry);
        if (!entryRange) return false;
        return hasTimeOverlap(requestedRange, entryRange);
      }).length;

      return {
        success: true,
        message: `Slot ${requestedRange.startTime} - ${requestedRange.endTime} booked for ${customerName}`,
        remaining: Math.max(0, remaining),
        salonId,
        startTime: requestedRange.startTime,
        time: requestedRange.startTime,
        endTime: requestedRange.endTime,
        customerName,
        durationMin: requestedRange.durationMin,
        karigarId: assignedKarigar.karigarId,
        karigarName: assignedKarigar.name,
        bufferMin: BOOKING_BUFFER_MIN
      };
    });

    return res.json(result);
  } catch (error) {
    console.error('[book-slot] lock failure:', error.message);
    return res.json({ success: false, msg: 'Booking request failed. Retry karein.' });
  }
});

// ── Customer Feedback ─────────────────────────────────────────────
// POST /api/feedback  { name, phone, message }
app.post('/api/feedback', (req, res) => {
  const { name, phone, message } = req.body || {};
  const cleanName = String(name || '').trim().slice(0, 60);
  const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
  const cleanMsg = String(message || '').trim().slice(0, 500);
  if (!cleanName || cleanName.length < 2) return res.json({ success: false, msg: 'Naam sahi likho.' });
  if (cleanPhone.length !== 10) return res.json({ success: false, msg: 'Phone 10 digits ka hona chahiye.' });
  if (!cleanMsg || cleanMsg.length < 5) return res.json({ success: false, msg: 'Message bahut chota hai.' });
  const list = loadFeedback();
  list.push({ name: cleanName, phone: cleanPhone, message: cleanMsg, submittedAt: nowIso() });
  saveFeedback(list);
  console.log(`[Feedback] New from ${cleanName} (${cleanPhone})`);
  return res.json({ success: true, msg: 'Shukriya! Sujhav mil gaya.' });
});

// GET /api/admin/feedback
app.get('/api/admin/feedback', requireAdminKey, (req, res) => {
  const list = loadFeedback();
  return res.json({ success: true, feedback: list.slice().reverse().slice(0, 200) });
});

// POST /api/admin/feedback/reset
app.post('/api/admin/feedback/reset', requireAdminKey, (req, res) => {
  const list = loadFeedback();
  const clearedCount = Array.isArray(list) ? list.length : 0;
  saveFeedback([]);
  return res.json({
    success: true,
    msg: clearedCount > 0
      ? `Sujhav reset complete. Cleared feedback=${clearedCount}.`
      : 'Sujhav reset skipped: clear karne ke liye koi feedback data nahi tha.',
    resetInfo: { clearedCount }
  });
});

// Static site
app.use(express.static('.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} using ${DATA_NAMESPACE ? `data namespace "${DATA_NAMESPACE}"` : 'default data store'}`));