const express = require('express');
require('dotenv').config();
const app = express();
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

function toIsoAfterDays(baseIso, days) {
  const date = baseIso ? new Date(baseIso) : new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
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
  const registeredAt = salon.registeredAt || new Date().toISOString();
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
  return {
    salonId: salon.salonId,
    salonName: salon.salonName || 'My Salon',
    ownerName: salon.ownerName || 'Owner',
    ownerPhone: salon.ownerPhone ? `0${String(salon.ownerPhone).slice(-10)}` : '',
    bookingUrl: salon.bookingUrl || '',
    dashboardUrl: salon.dashboardUrl || '',
    location: salon.location || '',
    address: salon.address || '',
    city: salon.city || '',
    state: salon.state || '',
    pincode: salon.pincode || '',
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
const ADMIN_PANEL_KEY = process.env.ADMIN_PANEL_KEY || 'bookmysalon_admin_2026';
const FREE_TRIAL_DAYS = 7;
const MANUAL_SUBSCRIPTION_LIMIT = 100;
const DEFAULT_SUBSCRIPTION_DAYS = 30;

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
    // Cost-optimized path: send only QR image when allowed.
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
    bookingUrl,
    dashboardUrl,
    latitude,
    longitude,
    baseUrl
  } = req.body || {};

  const cleanOwnerPhone = normalizePhoneKey(ownerPhone).slice(-10);
  const cleanPincode = String(pincode || '').replace(/\D/g, '').slice(0, 6);
  const latitudeNum = parseCoordinate(latitude);
  const longitudeNum = parseCoordinate(longitude);
  const locationParts = [address, city, state, cleanPincode].filter(Boolean);
  const locationText = String(location || locationParts.join(', ') || '').trim();
  const locationKey = normalizeLocationKey([address, city, state, cleanPincode]);

  if (!name || !ownerName || !email || cleanOwnerPhone.length !== 10 || !city || !state) {
    return res.json({ success: false, msg: 'Salon name, owner name, email, city, state and valid WhatsApp number required.' });
  }

  const existingSalon = findExistingSalonByOwnerPhone(cleanOwnerPhone) || findExistingSalonByLocation(locationKey);
  if (existingSalon) {
    const existingSubscription = getSalonSubscriptionSnapshot(existingSalon);
    return res.json({
      success: false,
      code: 'already_registered',
      msg: existingSubscription.isActive
        ? `Ye WhatsApp number pehle se ${existingSalon.salonId} ke saath registered hai. Naya free trial nahi milega.`
        : `Aapka salon ${existingSalon.salonId} pehle se registered hai. 7 din ka free trial khatam ho chuka hai. Subscription activate karaiye.`,
      salon: buildPublicSalonData(existingSalon)
    });
  }

  const salonId = generateUniqueSalonId();
  const urls = buildSalonUrls(baseUrl, salonId);
  const nowIso = new Date().toISOString();

  salons.push({ name, email, phone, location: locationText, services });
  salonRegistry[salonId] = {
    salonId,
    salonName: name,
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
    services: Array.isArray(services) ? services : [],
    bookingUrl: bookingUrl || urls.bookingUrl,
    dashboardUrl: dashboardUrl || urls.dashboardUrl,
    registeredAt: nowIso,
    verifiedAt: null,
    lastWelcomeSentAt: null,
    verificationMessagesSent: 0,
    subscription: {
      status: 'trial',
      trialStartedAt: nowIso,
      trialEndsAt: toIsoAfterDays(nowIso, FREE_TRIAL_DAYS),
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
    msg: 'Salon registered successfully. 7-day free trial started.',
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
  salon.locationUpdatedAt = new Date().toISOString();
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

  const records = Object.values(salonRegistry)
    .map((salon) => {
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

  const nowIso = new Date().toISOString();
  salon.subscription = salon.subscription || {};
  salon.subscription.status = 'active';
  salon.subscription.plan = plan || `${requestedDays}-day-plan`;
  salon.subscription.activatedAt = nowIso;
  salon.subscription.activeUntil = toIsoAfterDays(nowIso, requestedDays);
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
  salon.locationUpdatedAt = new Date().toISOString();
  persistSalonRegistry(salonRegistry);

  return res.json({
    success: true,
    msg: 'Salon location updated successfully',
    salon: buildPublicSalonData(salon)
  });
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

    salon.verifiedAt = salon.verifiedAt || new Date().toISOString();
    salon.lastWelcomeSentAt = new Date().toISOString();
    salon.verificationMessagesSent = (salon.verificationMessagesSent || 0) + 1;
    persistSalonRegistry(salonRegistry);

  } catch (err) {
    console.error('Webhook error:', err);
  }
});

// ── Booking State (persisted to disk, survives restarts) ─────────────────────
const bookingStates = loadBookingStates(); // { salonId: { isOpen, karigar, openingTime, closingTime, slots, date } }

function getToday() {
  return new Date().toISOString().split('T')[0];
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
  const entry = { phone, stars: parseInt(stars), comment: String(comment || '').slice(0, 200).trim(), date: today, createdAt: new Date().toISOString() };
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
    bs.karigar = 0;
    bs.date = today;
    bs.closeReason = 'auto-midnight';
    persistBookingStates();
  }

  if (!bs) {
    return res.json({ success: true, salonId, isOpen: false, slots: [], karigar: 0, date: today, subscription });
  }

  res.json({ success: true, ...bs, subscription });
});

// POST /api/booking-open  { salonId, karigar, openingTime, closingTime }
app.post('/api/booking-open', (req, res) => {
  const { salonId, karigar, openingTime, closingTime } = req.body || {};
  if (!salonId || !karigar || !openingTime || !closingTime) {
    return res.json({ success: false, msg: 'Missing fields' });
  }
  const salon = salonRegistry[salonId];
  if (!salon) {
    return res.json({ success: false, msg: 'Salon not found' });
  }
  const subscription = getSalonSubscriptionSnapshot(salon);
  if (!subscription.isActive) {
    return res.json({ success: false, msg: subscription.ownerMessage });
  }
  if (openingTime >= closingTime) {
    return res.json({ success: false, msg: 'Closing time must be after opening time' });
  }

  const today = getToday();
  const slots = generateSlots(openingTime, closingTime, karigar);
  bookingStates[salonId] = { salonId, isOpen: true, karigar, openingTime, closingTime, slots, date: today, closeReason: null };
  persistBookingStates();
  res.json({ success: true, slots, karigar, message: 'Booking opened' });
});

// POST /api/booking-close  { salonId }
app.post('/api/booking-close', (req, res) => {
  const { salonId } = req.body || {};
  if (!salonId || !bookingStates[salonId]) {
    return res.json({ success: false, msg: 'Salon not found' });
  }
  bookingStates[salonId].isOpen = false;
  bookingStates[salonId].closeReason = 'manual';
  persistBookingStates();
  res.json({ success: true, message: 'Booking closed' });
});

// POST /api/book-slot  { salonId, time, customerName, customerPhone }
app.post('/api/book-slot', (req, res) => {
  const { salonId, time, customerName, customerPhone } = req.body || {};
  const bs = bookingStates[salonId];
  const salon = salonRegistry[salonId];
  const subscription = getSalonSubscriptionSnapshot(salon);
  if (!subscription.isActive) return res.json({ success: false, msg: subscription.customerMessage });
  if (!bs || !bs.isOpen) return res.json({ success: false, msg: 'Salon booking is closed' });

  const slot = bs.slots.find(s => s.time === time);
  if (!slot) return res.json({ success: false, msg: 'Slot not found' });
  if (slot.booked >= slot.capacity) return res.json({ success: false, msg: 'Slot is full' });

  // 1 booking per phone per day per salon
  const alreadyToday = bs.slots.some(s =>
    s.bookings && s.bookings.some(b => b.phone === customerPhone)
  );
  if (alreadyToday) return res.json({ success: false, msg: 'Aapki aaj ki booking pehle se hai is salon mein. Kal dobara aayen! 🙏' });

  slot.booked += 1;
  slot.bookings = slot.bookings || [];
  slot.bookings.push({ name: customerName, phone: customerPhone, bookedAt: new Date().toISOString() });
  persistBookingStates();

  res.json({ success: true, message: `Slot ${time} booked for ${customerName}`, remaining: slot.capacity - slot.booked, salonId, time, customerName });
});

// Static site
app.use(express.static('.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} using ${DATA_NAMESPACE ? `data namespace "${DATA_NAMESPACE}"` : 'default data store'}`));