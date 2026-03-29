const path = require('path');
const { spawn } = require('child_process');

const verifyPort = String(process.env.BMS_PORT || '3100');
const baseUrl = process.env.BMS_BASE_URL || `http://127.0.0.1:${verifyPort}`;
const useRunningServer = process.env.BMS_USE_RUNNING_SERVER === '1';

let serverProcess = null;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServerReady(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(baseUrl + '/api/booking-state/SALON-H3WOS');
      if (response.ok) return;
    } catch (_) {
      // Server still booting
    }
    await wait(250);
  }
  throw new Error('verify server startup timeout');
}

async function startVerifyServer() {
  if (useRunningServer) return;

  const rootDir = path.resolve(__dirname, '..');
  const apiFile = path.join(rootDir, 'api.js');
  const env = {
    ...process.env,
    PORT: verifyPort,
    DATA_NAMESPACE: process.env.DATA_NAMESPACE || 'verifyflow'
  };

  serverProcess = spawn(process.execPath, [apiFile], {
    cwd: rootDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  serverProcess.stderr.on('data', (chunk) => {
    process.stderr.write(String(chunk));
  });

  await waitForServerReady();
}

function stopVerifyServer() {
  if (!serverProcess) return;
  try {
    serverProcess.kill();
  } catch (_) {
    // Ignore kill errors during teardown
  }
  serverProcess = null;
}

async function post(path, body) {
  const response = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return response.json();
}

async function get(path) {
  const response = await fetch(baseUrl + path);
  return response.json();
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function printSummary(summary) {
  const checkEntries = Object.entries(summary.checks || {});
  const allPassed = checkEntries.every(([, value]) => value === true);

  console.log(`[verify-booking-flow] ${allPassed ? 'PASS' : 'FAIL'} salonId=${summary.salonId}`);
  checkEntries.forEach(([name, value]) => {
    console.log(`CHECK ${name}=${value ? 'PASS' : 'FAIL'}`);
  });

  (summary.bookings || []).forEach((booking, index) => {
    console.log(
      `BOOKING ${index + 1}: ${booking.name} ${booking.karigarId} ${booking.startTime}-${booking.endTime} (${booking.durationMin}m)`
    );
  });

  // Stable token for CI parsers.
  console.log(`VERIFY_BOOKING_FLOW=${allPassed ? 'PASS' : 'FAIL'}`);
}

function uniqueTag() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  const rand = String(Math.floor(Math.random() * 10));
  return `${hh}${mm}${ss}${ms}${rand}`;
}

(async () => {
  await startVerifyServer();

  const tag = uniqueTag();
  const ownerPhone = `8${String(Date.now()).slice(-8)}${Math.floor(Math.random() * 10)}`;
  const uniqueAddress = `Sector ${tag.slice(-2)}, Gurugram`;
  const uniquePincode = `1${String(Date.now()).slice(-5)}`;

  const register = await post('/api/register-salon', {
    name: `Flow Verify ${tag}`,
    ownerName: 'Flow QA',
    email: `flow.${tag}@test.local`,
    phone: `+91${ownerPhone}`,
    ownerPhone,
    location: uniqueAddress,
    address: uniqueAddress,
    city: 'Gurugram',
    state: 'Haryana',
    pincode: uniquePincode,
    businessType: 'salon',
    services: [
      { name: 'Haircut', durationMin: 30 },
      { name: 'Beard Trim', durationMin: 20 },
      { name: 'Hair Spa', durationMin: 45 }
    ],
    karigars: [
      { karigarId: 'K1', name: 'Raju', active: true },
      { karigarId: 'K2', name: 'Imran', active: true }
    ],
    baseUrl
  });

  assertCondition(register.success === true, `register failed: ${register.msg || 'unknown'}`);
  const salonId = String(register.salonId || register.salon?.salonId || '').trim().toUpperCase();
  assertCondition(!!salonId, 'register response missing salonId');

  assertCondition(
    Array.isArray(register.salon?.services) && register.salon.services.every((item) => item && typeof item.name === 'string' && Number.isFinite(item.durationMin)),
    'registered services schema invalid'
  );

  assertCondition(
    Array.isArray(register.salon?.karigars) && register.salon.karigars.length >= 2,
    'registered karigar schema invalid'
  );

  const opened = await post('/api/booking-open', {
    salonId,
    openingTime: '10:00',
    closingTime: '12:00',
    karigars: [
      { karigarId: 'K1', name: 'Raju', active: true },
      { karigarId: 'K2', name: 'Imran', active: true }
    ]
  });

  assertCondition(opened.success === true, `booking-open failed: ${opened.msg || 'unknown'}`);

  const booking1 = await post('/api/book-slot', {
    salonId,
    customerName: 'Alice',
    customerPhone: '9876501111',
    startTime: '10:00',
    endTime: '10:50',
    durationMin: 50,
    serviceName: 'Haircut, Beard Trim',
    selectedServices: [
      { name: 'Haircut', durationMin: 30 },
      { name: 'Beard Trim', durationMin: 20 }
    ],
    karigarId: 'K1'
  });

  assertCondition(booking1.success === true, `booking1 failed: ${booking1.msg || 'unknown'}`);
  assertCondition(booking1.karigarId === 'K1', `booking1 expected K1 but got ${booking1.karigarId || 'none'}`);

  const overlapSameKarigar = await post('/api/book-slot', {
    salonId,
    customerName: 'Bob',
    customerPhone: '9876502222',
    startTime: '10:30',
    endTime: '11:15',
    durationMin: 45,
    serviceName: 'Hair Spa',
    selectedServices: [{ name: 'Hair Spa', durationMin: 45 }],
    karigarId: 'K1'
  });

  assertCondition(overlapSameKarigar.success === false, 'overlapSameKarigar should fail but succeeded');

  const anyKarigar = await post('/api/book-slot', {
    salonId,
    customerName: 'Charlie',
    customerPhone: '9876503333',
    startTime: '10:30',
    endTime: '11:15',
    durationMin: 45,
    serviceName: 'Hair Spa',
    selectedServices: [{ name: 'Hair Spa', durationMin: 45 }],
    karigarId: 'ANY'
  });

  assertCondition(anyKarigar.success === true, `anyKarigar failed: ${anyKarigar.msg || 'unknown'}`);
  assertCondition(anyKarigar.karigarId === 'K2', `anyKarigar expected K2 but got ${anyKarigar.karigarId || 'none'}`);

  const legacyNoEndTime = await post('/api/book-slot', {
    salonId,
    customerName: 'Dinesh',
    customerPhone: '9876505555',
    startTime: '11:20',
    durationMin: 30,
    serviceName: 'Haircut',
    selectedServices: [{ name: 'Haircut', durationMin: 30 }],
    karigarId: 'K1'
  });

  assertCondition(legacyNoEndTime.success === true, `legacy no-endTime booking failed: ${legacyNoEndTime.msg || 'unknown'}`);
  assertCondition(legacyNoEndTime.endTime === '11:50', `legacy endTime expected 11:50 but got ${legacyNoEndTime.endTime || 'none'}`);

  const allBusyAny = await post('/api/book-slot', {
    salonId,
    customerName: 'Eshan',
    customerPhone: '9876506666',
    startTime: '10:35',
    endTime: '11:05',
    durationMin: 30,
    serviceName: 'Haircut',
    selectedServices: [{ name: 'Haircut', durationMin: 30 }],
    karigarId: 'ANY'
  });

  assertCondition(allBusyAny.success === false, 'allBusyAny should fail but succeeded');

  const state = await get(`/api/booking-state/${salonId}`);
  assertCondition(state.success === true, 'booking-state failed');
  assertCondition(Number(state.bufferMin) === 5, `bufferMin expected 5 but got ${state.bufferMin}`);
  assertCondition(Array.isArray(state.bookings) && state.bookings.length === 3, `expected 3 bookings but got ${Array.isArray(state.bookings) ? state.bookings.length : 'invalid'}`);

  const summary = {
    salonId,
    checks: {
      register: true,
      open: true,
      booking1: true,
      overlapSameKarigarRejected: true,
      anyKarigarAssigned: true,
      legacyNoEndTimeHandled: true,
      allBusyRejected: true,
      bufferMin5: true
    },
    bookings: state.bookings.map((b) => ({
      name: b.name,
      karigarId: b.karigarId,
      startTime: b.startTime,
      endTime: b.endTime,
      durationMin: b.durationMin
    }))
  };

  printSummary(summary);
  console.log(JSON.stringify(summary, null, 2));
})().catch((error) => {
  console.error('[verify-booking-flow] FAILED:', error.message);
  console.error('VERIFY_BOOKING_FLOW=FAIL');
  stopVerifyServer();
  process.exit(1);
}).finally(() => {
  stopVerifyServer();
});
