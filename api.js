const express = require('express');
require('dotenv').config();
const app = express();
app.use(express.json());

const https = require('https');
const salons = []; // Temporary, use DB in prod!
const salonRegistry = {}; // { salonId: salonData } — webhook lookup
const QRCode = require('qrcode');

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v22.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || 'hello_world';
const WHATSAPP_TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'en_US';
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'bookmysalon_verify';

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
  const { salonId, name, ownerName, email, phone, ownerPhone, location, services, bookingUrl, dashboardUrl } = req.body;
  if (!name || !email || !phone || !location) {
    return res.json({ success: false, msg: 'All fields required' });
  }
  salons.push({ name, email, phone, location, services });
  // Store in registry so webhook can look up by salonId
  if (salonId) {
    salonRegistry[salonId] = {
      salonId,
      salonName: name,
      ownerName: ownerName || '',
      ownerPhone: String(ownerPhone || '').replace(/\D/g, '').slice(-10),
      bookingUrl: bookingUrl || '',
      dashboardUrl: dashboardUrl || ''
    };
  }
  return res.json({ success: true });
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
    const msgText = msg.text?.body || '';
    console.log('[Webhook] Incoming message from', fromPhone, 'text:', msgText);

    // Match "verify my salon SALON-XXXXX" pattern
    const match = msgText.match(/SALON-([A-Z0-9]{5})/i);
    if (!match) return;

    const salonId = `SALON-${match[1].toUpperCase()}`;
    const salon = salonRegistry[salonId];
    const path = `/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    if (!salon) {
      console.log('[Webhook] Salon not found in registry for', salonId);
      try {
        await postGraphJson(path, {
          messaging_product: 'whatsapp',
          to: fromPhone,
          type: 'text',
          text: {
            body: `Salon ID ${salonId} nahi mila. Kripya register form dobara submit karke phir verify message bheje.`
          }
        });
      } catch (notifyErr) {
        console.error('[Webhook] Failed to send salon-not-found message:', notifyErr);
      }
      return;
    }

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
        await postGraphJson(path, {
          messaging_product: 'whatsapp',
          to: fromPhone,
          type: 'text',
          text: {
            body: `Verification receive hua, lekin welcome/QR bhejne mein issue aaya. Kripya 1 min baad fir message bheje: verify my salon ${salonId}`
          }
        });
      } catch (fallbackErr) {
        console.error('[Webhook] Fallback text send failed:', fallbackErr);
      }
    }

  } catch (err) {
    console.error('Webhook error:', err);
  }
});

// ── Booking State (in-memory, swap for DB later) ──────────────────
const bookingStates = {}; // { salonId: { isOpen, karigar, openingTime, closingTime, slots, date } }

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

// GET /api/booking-state/:salonId
app.get('/api/booking-state/:salonId', (req, res) => {
  const { salonId } = req.params;
  const today = getToday();
  let bs = bookingStates[salonId];

  // Auto-reset if new day
  if (bs && bs.date !== today) {
    bs.isOpen = false;
    bs.slots = [];
    bs.karigar = 0;
    bs.date = today;
    bs.closeReason = 'auto-midnight';
  }

  if (!bs) {
    return res.json({ success: true, salonId, isOpen: false, slots: [], karigar: 0, date: today });
  }

  res.json({ success: true, ...bs });
});

// POST /api/booking-open  { salonId, karigar, openingTime, closingTime }
app.post('/api/booking-open', (req, res) => {
  const { salonId, karigar, openingTime, closingTime } = req.body || {};
  if (!salonId || !karigar || !openingTime || !closingTime) {
    return res.json({ success: false, msg: 'Missing fields' });
  }
  if (openingTime >= closingTime) {
    return res.json({ success: false, msg: 'Closing time must be after opening time' });
  }

  const today = getToday();
  const slots = generateSlots(openingTime, closingTime, karigar);
  bookingStates[salonId] = { salonId, isOpen: true, karigar, openingTime, closingTime, slots, date: today, closeReason: null };
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
  res.json({ success: true, message: 'Booking closed' });
});

// POST /api/book-slot  { salonId, time, customerName, customerPhone }
app.post('/api/book-slot', (req, res) => {
  const { salonId, time, customerName, customerPhone } = req.body || {};
  const bs = bookingStates[salonId];
  if (!bs || !bs.isOpen) return res.json({ success: false, msg: 'Salon booking is closed' });

  const slot = bs.slots.find(s => s.time === time);
  if (!slot) return res.json({ success: false, msg: 'Slot not found' });
  if (slot.booked >= slot.capacity) return res.json({ success: false, msg: 'Slot is full' });

  // Prevent duplicate booking for same phone + date + salonId + time
  const already = bs.slots.some(s =>
    s.bookings && s.bookings.some(b => b.phone === customerPhone && s.time === time)
  );
  if (already) return res.json({ success: false, msg: 'Already booked for this slot' });

  slot.booked += 1;
  slot.bookings = slot.bookings || [];
  slot.bookings.push({ name: customerName, phone: customerPhone, bookedAt: new Date().toISOString() });

  res.json({ success: true, message: `Slot ${time} booked for ${customerName}`, remaining: slot.capacity - slot.booked });
});

// Static site
app.use(express.static('.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));