// ============================================
// BookMySalon - JavaScript Logic
// ============================================

// State Management
let selectedService = null;
let selectedDate = null;
let selectedTime = null;
const SALON_WHATSAPP_NUMBER = '919209098349';
let isRegistrationSubmitting = false;
let registrationGeo = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Set today as default date
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('bookingDate');
    if (dateInput) {
        dateInput.value = today;
        dateInput.min = today;
    }
}

// ============================================
// Navigation Functions
// ============================================

function goToNearby() {
    goToNearbySalon();
}

function goToNearbySalon() {
    window.location.href = 'salons.html?type=salon';
}

function goToNearbyBeauty() {
    window.location.href = 'salons.html?type=beauty_parlour';
}

function goToBooking() {
    window.location.href = 'salon.html?id=4582';
}

function goToSalonBooking(salonId) {
    window.location.href = `salon.html?id=${salonId}`;
}

function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

// ============================================
// QR Scanner Function
// ============================================

function openQRScanner() {
    alert('📱 QR Scanner\n\nIn a real app, this would open your device camera to scan salon QR codes.\n\nFor demo, redirecting to sample salon...');
    window.location.href = 'salon.html?id=4582';
}

// ============================================
// Service Selection
// ============================================

function selectService(element, serviceName) {
    // Remove selection from all services
    document.querySelectorAll('.service-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Add selection to clicked service
    element.classList.add('selected');
    selectedService = serviceName;

    // Update summary
    updateSummary();

    // Smooth animation
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ============================================
// Time Slot Selection
// ============================================

function selectTimeSlot(element, time) {
    // Remove selection from all slots
    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.classList.remove('selected');
    });

    // Add selection to clicked slot
    element.classList.add('selected');
    selectedTime = time;

    // Update summary
    updateSummary();
}

// ============================================
// Date Selection
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('bookingDate');
    if (dateInput) {
        dateInput.addEventListener('change', () => {
            selectedDate = dateInput.value;
            updateSummary();
        });
    }
});

// ============================================
// Update Booking Summary
// ============================================

function updateSummary() {
    // Update service
    const summaryService = document.getElementById('summaryService');
    if (summaryService) {
        summaryService.textContent = selectedService || 'Not selected';
    }

    // Update date
    const summaryDate = document.getElementById('summaryDate');
    if (summaryDate) {
        if (selectedDate) {
            const date = new Date(selectedDate);
            summaryDate.textContent = date.toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
            });
        } else {
            summaryDate.textContent = 'Not selected';
        }
    }

    // Update time
    const summaryTime = document.getElementById('summaryTime');
    if (summaryTime) {
        summaryTime.textContent = selectedTime || 'Not selected';
    }

}

// ============================================
// Confirm Booking
// ============================================

function confirmBooking() {
    // Validation
    if (!selectedService || !selectedDate || !selectedTime) {
        alert('⚠️ Please select service, date, and time slot');
        return;
    }

    const bookingDetails = `
🎉 Booking Confirmed!

📋 Service: ${selectedService}
📅 Date: ${new Date(selectedDate).toLocaleDateString()}
⏰ Time: ${selectedTime}

✅ Your booking is confirmed!
You will receive a confirmation message shortly.
    `;

    alert(bookingDetails);
    
    // Reset form
    resetBooking();
}

// ============================================
// Book via WhatsApp
// ============================================

function bookViaWhatsApp() {
    // Validation
    if (!selectedService || !selectedDate || !selectedTime) {
        alert('⚠️ Please select service, date, and time slot');
        return;
    }

    const message = `Hi, I would like to book ${selectedService} on ${new Date(selectedDate).toLocaleDateString()} at ${selectedTime}. Please confirm.`;
    const encodedMessage = encodeURIComponent(message);
    
    // WhatsApp Business API (replace with actual salon number)
    const whatsappURL = `https://wa.me/${SALON_WHATSAPP_NUMBER}?text=${encodedMessage}`;
    
    window.open(whatsappURL, '_blank');
}

// ============================================
// Reset Booking
// ============================================

function resetBooking() {
    selectedService = null;
    selectedDate = null;
    selectedTime = null;

    document.querySelectorAll('.service-card').forEach(card => {
        card.classList.remove('selected');
    });

    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.classList.remove('selected');
    });

    updateSummary();
}

// ============================================
// Salon Search & Filter
// ============================================

function filterSalons() {
    const searchInput = document.getElementById('searchInput');
    const salons = document.querySelectorAll('.salon-card');
    const searchTerm = searchInput.value.toLowerCase();
    let visibleCount = 0;

    salons.forEach(salon => {
        const salonName = salon.querySelector('h3').textContent.toLowerCase();
        if (salonName.includes(searchTerm)) {
            salon.style.display = '';
            visibleCount++;
        } else {
            salon.style.display = 'none';
        }
    });

    // Show/hide no results message
    const noResults = document.getElementById('noResults');
    if (noResults) {
        noResults.classList.toggle('hidden', visibleCount > 0);
    }
}

function resetSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        filterSalons();
    }
}

function sortSalons() {
    const container = document.getElementById('salonsContainer');
    if (!container) return;

    const salons = Array.from(container.querySelectorAll('.salon-card'));
    const isAscending = container.dataset.sortOrder === 'asc';
    
    salons.sort((a, b) => {
        const distA = parseFloat(a.querySelector('p').textContent.match(/[\d.]+/)[0]);
        const distB = parseFloat(b.querySelector('p').textContent.match(/[\d.]+/)[0]);
        return isAscending ? distB - distA : distA - distB;
    });

    container.innerHTML = '';
    salons.forEach(salon => container.appendChild(salon));
    container.dataset.sortOrder = isAscending ? 'desc' : 'asc';
}

// ============================================
// Utility Functions
// ============================================

function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function normalizeDurationMinutes(value, fallback) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(5, Math.min(240, parsed));
}

function parseKarigarsInput(rawText) {
    const lines = String(rawText || '')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    const uniqueNames = [];
    lines.forEach((name) => {
        if (!uniqueNames.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
            uniqueNames.push(name);
        }
    });

    const names = uniqueNames.length ? uniqueNames : ['Karigar 1', 'Karigar 2'];
    return names.map((name, index) => ({
        karigarId: `K${index + 1}`,
        name,
        active: true
    }));
}

function setRegistrationBusinessType(type) {
    const normalizedType = String(type || '').toLowerCase() === 'beauty_parlour' ? 'beauty_parlour' : 'salon';
    const input = document.getElementById('businessTypeInput');
    if (input) input.value = normalizedType;

    const salonBtn = document.getElementById('typeSalonBtn');
    const beautyBtn = document.getElementById('typeBeautyBtn');
    const switchRow = document.getElementById('registerTypeSwitchRow');

    if (switchRow) switchRow.classList.add('sm:grid-cols-1');
    if (salonBtn) salonBtn.classList.toggle('hidden', normalizedType !== 'salon');
    if (beautyBtn) beautyBtn.classList.toggle('hidden', normalizedType !== 'beauty_parlour');

    if (salonBtn) {
        salonBtn.classList.toggle('bg-cyan-500', normalizedType === 'salon');
        salonBtn.classList.toggle('text-gray-950', normalizedType === 'salon');
        salonBtn.classList.toggle('border-cyan-300', normalizedType === 'salon');
        salonBtn.classList.toggle('bg-white/5', normalizedType !== 'salon');
    }
    if (beautyBtn) {
        beautyBtn.classList.toggle('bg-fuchsia-500', normalizedType === 'beauty_parlour');
        beautyBtn.classList.toggle('text-gray-950', normalizedType === 'beauty_parlour');
        beautyBtn.classList.toggle('border-fuchsia-300', normalizedType === 'beauty_parlour');
        beautyBtn.classList.toggle('bg-white/5', normalizedType !== 'beauty_parlour');
    }

    const heading = document.getElementById('registerTypeHeading');
    if (heading) {
        heading.textContent = normalizedType === 'beauty_parlour' ? 'Beauty Parlour Partner Onboarding' : 'Salon Partner Onboarding';
    }
    const heroTitle = document.getElementById('registerHeroTitle');
    const heroSub = document.getElementById('registerHeroSub');
    if (heroTitle) {
        heroTitle.innerHTML = normalizedType === 'beauty_parlour'
            ? 'Register your beauty parlour in <span class="text-cyan-300">under 2 minutes</span>'
            : 'Register your salon in <span class="text-cyan-300">under 2 minutes</span>';
    }
    if (heroSub) {
        heroSub.textContent = normalizedType === 'beauty_parlour'
            ? 'Get your instant beauty booking link and start receiving customers on WhatsApp.'
            : 'Get your instant booking link and start receiving customer appointments on WhatsApp.';
    }

    const btn = document.getElementById('registerBtn');
    if (btn && !isRegistrationSubmitting) {
        btn.textContent = normalizedType === 'beauty_parlour'
            ? '🚀 Register Beauty Parlour & Get Booking Link'
            : '🚀 Register Salon & Get Booking Link';
    }

    const servicesLabel = document.getElementById('servicesLabel');
    const salonServicesBox = document.getElementById('salonServicesBox');
    const beautyServicesBox = document.getElementById('beautyServicesBox');
    if (servicesLabel) {
        servicesLabel.textContent = normalizedType === 'beauty_parlour'
            ? 'Services with Duration (Optional) - Beauty Parlour'
            : 'Services with Duration (Optional) - Salon';
    }
    if (salonServicesBox) salonServicesBox.classList.toggle('hidden', normalizedType !== 'salon');
    if (beautyServicesBox) beautyServicesBox.classList.toggle('hidden', normalizedType !== 'beauty_parlour');

    document.querySelectorAll('input[name="serviceItem"]').forEach((el) => {
        const itemType = el.getAttribute('data-service-type') || 'salon';
        if (itemType !== normalizedType) el.checked = false;
    });
}

// Get Salon ID from URL
window.addEventListener('load', () => {
    const salonId = getUrlParameter('id');
    if (salonId && document.getElementById('salonId')) {
        document.getElementById('salonId').textContent = salonId;
    }

    if (document.getElementById('businessTypeInput')) {
        const typeFromQuery = getUrlParameter('type');
        setRegistrationBusinessType(typeFromQuery || 'salon');
    }
});

// ============================================
// Touch Optimization for Mobile
// ============================================

document.addEventListener('touchstart', () => {
    // Add touch-start class for styling if needed
}, { passive: true });

// ============================================
// Salon Registration
// ============================================

function sanitizeIndianPhone(numberText) {
    return (numberText || '').replace(/\D/g, '');
}

function isValidIndianMobile(numberText) {
    const number = sanitizeIndianPhone(numberText).slice(-10);
    if (!/^[6-9]\d{9}$/.test(number)) return false;

    // Obvious dummy patterns that should not be accepted.
    if (/^(\d)\1{9}$/.test(number)) return false;
    if (number === '9876543210' || number === '9123456789' || number === '9999999999') return false;
    return true;
}

function generateSalonCode() {
    const random = Math.floor(10000 + Math.random() * 90000);
    return `SALON-${random}`;
}

async function lookupPincodeFromServer(pincode) {
    if (!pincode || pincode.length < 5) return null;
    
    try {
        const response = await fetch(`/api/pincode-lookup/${pincode}`);
        const data = await response.json();
        
        if (data.success) {
            return {
                city: data.city || '',
                state: data.state || '',
                pincode: data.pincode || '',
                area: data.area || ''
            };
        }
    } catch (error) {
        // Silently fail, use what we have
    }
    
    return null;
}

function getFirstNonEmpty(addressObj, keys) {
    for (const key of keys) {
        if (addressObj[key]) return addressObj[key];
    }
    return '';
}

async function reverseGeocodeLocation(latitude, longitude) {
    let best = {
        addressLine: '',
        city: '',
        state: '',
        pincode: ''
    };

    try {
        const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
        const bdcResponse = await fetch(bdcUrl, { headers: { Accept: 'application/json' } });
        if (bdcResponse.ok) {
            const bdcData = await bdcResponse.json();
            const city = getFirstNonEmpty(bdcData, ['city', 'locality', 'principalSubdivision']);
            const state = getFirstNonEmpty(bdcData, ['principalSubdivision', 'region']);
            const pincode = getFirstNonEmpty(bdcData, ['postcode']);
            const addressLine = [bdcData.locality, city, state, pincode].filter(Boolean).join(', ');

            best = { addressLine, city, state, pincode };
        }
    } catch (error) {
        // Continue with OSM fallback.
    }

    const osmUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&addressdetails=1`;
    const osmResponse = await fetch(osmUrl, {
        headers: {
            Accept: 'application/json'
        }
    });

    if (!osmResponse.ok) {
        if (best.addressLine || best.city || best.state || best.pincode) {
            return best;
        }
        throw new Error('Reverse geocoding failed');
    }

    const osmData = await osmResponse.json();
    const address = osmData.address || {};

    const city = getFirstNonEmpty(address, ['city', 'town', 'village', 'municipality', 'county']);
    const state = getFirstNonEmpty(address, ['state', 'region']);
    const pincode = getFirstNonEmpty(address, ['postcode']);
    const road = getFirstNonEmpty(address, ['road', 'suburb', 'neighbourhood']);
    const area = getFirstNonEmpty(address, ['city_district', 'state_district']);

    const addressLine = [road, area, city, state, pincode].filter(Boolean).join(', ');

    return {
        addressLine: addressLine || best.addressLine,
        city: city || best.city,
        state: state || best.state,
        pincode: pincode || best.pincode
    };
}

function requestRegistrationLocation() {
    const status = document.getElementById('locationStatus');
    const addressInput = document.getElementById('address');
    const cityInput = document.getElementById('city');
    const stateInput = document.getElementById('state');
    const pincodeInput = document.getElementById('pincode');

    // Always reset old location values so stale data never stays in form.
    if (addressInput) addressInput.value = '';
    if (cityInput) cityInput.value = '';
    if (stateInput) stateInput.value = '';
    if (pincodeInput) pincodeInput.value = '';
    registrationGeo = null;

    if (!navigator.geolocation) {
        if (status) status.textContent = 'Geolocation is not supported on this browser.';
        return;
    }

    if (status) status.textContent = 'Fetching current location...';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude, accuracy } = position.coords;

            // Avoid filling wrong address when GPS fix is too broad.
            if (accuracy && accuracy > 250) {
                if (addressInput) {
                    addressInput.value = '';
                }
                if (cityInput) cityInput.value = '';
                if (stateInput) stateInput.value = '';
                if (pincodeInput) pincodeInput.value = '';
                if (status) {
                    status.textContent = `⚠️ GPS accuracy low (${Math.round(accuracy)}m). Open area me jaake retry karein ya manually fill karein.`;
                }
                return;
            }

            if (status) status.textContent = 'Location captured. Finding address details...';
            registrationGeo = {
                latitude: Number(latitude.toFixed(6)),
                longitude: Number(longitude.toFixed(6)),
                accuracy: Math.round(accuracy || 0)
            };

            reverseGeocodeLocation(latitude, longitude)
                .then((locationData) => {
                    if (addressInput) {
                        addressInput.value = locationData.addressLine || `Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)}`;
                    }
                    if (cityInput) cityInput.value = locationData.city || '';
                    if (stateInput) stateInput.value = locationData.state || '';
                    if (pincodeInput) pincodeInput.value = (locationData.pincode || '').replace(/\D/g, '').slice(0, 6);

                    if (status) {
                        status.textContent = locationData.pincode
                            ? 'Address, city, state and pincode auto-filled successfully.'
                            : 'Address auto-filled. Please verify pincode manually.';
                    }
                })
                .catch(() => {
                    if (addressInput) {
                        addressInput.value = '';
                    }
                    if (cityInput) cityInput.value = '';
                    if (stateInput) stateInput.value = '';
                    if (pincodeInput) pincodeInput.value = '';
                    registrationGeo = null;
                    if (status) status.textContent = '⚠️ Address lookup failed. Please enter city, state and pincode manually.';
                });
        },
        () => {
            registrationGeo = null;
            if (status) status.textContent = 'Unable to fetch location. Please enter address manually.';
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
}

async function handleSalonRegistrationSubmit(event) {
    event.preventDefault();

    if (isRegistrationSubmitting) {
        return;
    }

    const salonName = document.getElementById('salonName')?.value.trim();
    const ownerName = document.getElementById('ownerName')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const address = document.getElementById('address')?.value.trim();
    const city = document.getElementById('city')?.value.trim();
    const state = document.getElementById('state')?.value.trim();
    const pincode = document.getElementById('pincode')?.value.trim();
    const rawNumber = document.getElementById('whatsappNumber')?.value.trim();
    const businessType = document.getElementById('businessTypeInput')?.value === 'beauty_parlour' ? 'beauty_parlour' : 'salon';
    const registerBtn = document.getElementById('registerBtn');

    const number = sanitizeIndianPhone(rawNumber).slice(-10);
    if (!isValidIndianMobile(number)) {
        alert('कृपया सही 10-अंकों का WhatsApp नंबर डालें। डमी/गलत नंबर स्वीकार नहीं होंगे।');
        return;
    }

    isRegistrationSubmitting = true;

    const selectedServices = Array.from(document.querySelectorAll('input[name="serviceItem"]:checked'))
        .map((el) => ({
            name: String(el.value || '').trim(),
            durationMin: normalizeDurationMinutes(el.getAttribute('data-duration'), 30)
        }))
        .filter((item) => item.name);

    const karigarsRaw = document.getElementById('karigarsInput')?.value || '';
    const karigars = parseKarigarsInput(karigarsRaw);

    const locationText = [address, city, state, pincode].filter(Boolean).join(', ');

    if (registerBtn) {
        registerBtn.disabled = true;
        registerBtn.textContent = 'Creating your salon profile...';
    }

    let responseData = null;
    try {
        const response = await fetch('/api/register-salon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: salonName,
                ownerName,
                email,
                phone: `+91${number}`,
                ownerPhone: number,
                location: locationText || 'Not provided',
                address,
                city,
                state,
                pincode,
                latitude: registrationGeo ? registrationGeo.latitude : null,
                longitude: registrationGeo ? registrationGeo.longitude : null,
                businessType,
                services: selectedServices,
                karigars,
                baseUrl: window.location.origin
            })
        });
        responseData = await response.json();
    } catch (error) {
        responseData = null;
    }

    const verifyCodeDisplay = document.getElementById('verifyCodeDisplay');
    const salonIdForMessage = document.getElementById('salonIdForMessage');
    const whatsappVerifyLink = document.getElementById('whatsappVerifyLink');
    const verifyCard = document.getElementById('whatsappVerifyCard');
    const form = document.getElementById('registrationForm');
    const verifySubscriptionNote = document.getElementById('verifySubscriptionNote');

    if (!responseData) {
        alert('Backend save fail ho gaya. Kripya dobara try karein. WhatsApp verify tabhi karein jab registration successfully save ho jaye.');
        if (registerBtn) {
            registerBtn.disabled = false;
            registerBtn.textContent = 'Register Salon & Get Booking Link';
        }
        isRegistrationSubmitting = false;
        return;
    }

    if (!responseData.success && responseData.code === 'already_registered' && responseData.salon) {
        const existingSalon = responseData.salon;
        window.currentSalonData = {
            salonId: existingSalon.salonId,
            salonName: existingSalon.salonName,
            ownerName: existingSalon.ownerName,
            ownerPhone: number,
            bookingUrl: existingSalon.bookingUrl,
            dashboardUrl: existingSalon.dashboardUrl,
            subscription: existingSalon.subscription || null
        };

        if (existingSalon.subscription && existingSalon.subscription.isActive) {
            const displayText = `${existingSalon.salonId} (${existingSalon.ownerName || ownerName})`;
            if (verifyCodeDisplay) verifyCodeDisplay.textContent = displayText;
            if (salonIdForMessage) salonIdForMessage.textContent = displayText;
            if (verifySubscriptionNote) verifySubscriptionNote.textContent = existingSalon.subscription.label || 'Free Trial Active';
            if (whatsappVerifyLink) {
                whatsappVerifyLink.href = '#';
                whatsappVerifyLink.dataset.opening = '0';
            }
            if (form) form.classList.add('hidden');
            if (verifyCard) {
                verifyCard.classList.remove('hidden');
                verifyCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            alert(responseData.msg + ' Existing salon dashboard aur verify flow hi use karein.');
        } else {
            alert(responseData.msg + ' Naya salon create nahi hoga. Subscription activate karaiye.');
        }

        if (registerBtn) {
            registerBtn.disabled = false;
            registerBtn.textContent = 'Register Salon & Get Booking Link';
        }
        isRegistrationSubmitting = false;
        return;
    }

    if (!responseData.success || !responseData.salon) {
        alert(responseData.msg || 'Registration save nahi hua. Kripya dobara try karein.');
        if (registerBtn) {
            registerBtn.disabled = false;
            registerBtn.textContent = 'Register Salon & Get Booking Link';
        }
        isRegistrationSubmitting = false;
        return;
    }

    const savedSalon = responseData.salon;
    window.currentSalonData = {
        salonId: savedSalon.salonId,
        salonName: savedSalon.salonName,
        ownerName: savedSalon.ownerName,
        ownerPhone: number,
        bookingUrl: savedSalon.bookingUrl,
        dashboardUrl: savedSalon.dashboardUrl,
        subscription: savedSalon.subscription || null
    };

    const displayText = `${savedSalon.salonId} (${savedSalon.ownerName || ownerName})`;
    if (verifyCodeDisplay) verifyCodeDisplay.textContent = displayText;
    if (salonIdForMessage) salonIdForMessage.textContent = displayText;
    if (verifySubscriptionNote) verifySubscriptionNote.textContent = savedSalon.subscription?.label || '7-day Free Trial Started';
    
    if (whatsappVerifyLink) {
        whatsappVerifyLink.href = '#';
        whatsappVerifyLink.dataset.opening = '0';
    }

    if (form) form.classList.add('hidden');
    if (verifyCard) {
        verifyCard.classList.remove('hidden');
        verifyCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    alert(responseData.msg || 'Salon save ho gaya. Ab WhatsApp verify button se same saved salon ID verify karein.');

    if (registerBtn) {
        registerBtn.disabled = false;
        registerBtn.textContent = 'Register Salon & Get Booking Link';
    }

    isRegistrationSubmitting = false;
}

function goToDashboard(event) {
    if (event) event.preventDefault();
    if (window.currentSalonData && window.currentSalonData.salonId) {
        window.location.href = `/dashboard.html?id=${window.currentSalonData.salonId}`;
    } else {
        alert('Salon ID not found. Please register first.');
    }
}

// Step 1: Owner clicks this → WhatsApp opens with pre-filled verify message
// Step 2: Owner sends message → Webhook receives → Welcome + QR auto-sent back
function openWhatsAppVerify(event) {
    if (event) event.preventDefault();
    if (!window.currentSalonData) return;

    const { salonId, salonName } = window.currentSalonData;
    const BOOKMYSALON_WA = '919209098349';
    const msg = `Hi, verify my salon ${salonName} (${salonId})`;
    const waUrl = `https://wa.me/${BOOKMYSALON_WA}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
}

function showWelcomePackageUI(data) {
    // Create modal/display for welcome package
    let modal = document.getElementById('welcomePackageModal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'welcomePackageModal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 9999;">
            <div style="background: white; border-radius: 20px; padding: 30px; max-width: 500px; width: 90%; text-align: center;">
                <h2 style="color: #000; margin-bottom: 20px;">✅ Welcome Package Ready</h2>
                
                <div style="background: #f0f0f0; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                    <p style="color: #333; margin: 0; font-size: 14px; line-height: 1.6; text-align: left; white-space: pre-wrap;">${data.welcomeMessage}</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <p style="color: #888; font-size: 12px; margin-bottom: 10px;">📱 QR Code:</p>
                    <img src="${data.qrImageDataUrl}" style="width: 250px; height: 250px; border-radius: 10px;" />
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <button onclick="downloadWelcomeQR('${data.salonId}')" style="background: #4CAF50; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold;">
                        📥 Download QR
                    </button>
                    <button onclick="closeWelcomeModal()" style="background: #2196F3; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold;">
                        ✓ Done
                    </button>
                </div>
                <p style="color: #999; font-size: 12px; margin-top: 10px;">💡 WhatsApp خود  already opened. Send the message & QR to salon owner.</p>
            </div>
        </div>
    `;
}

function closeWelcomeModal() {
    const modal = document.getElementById('welcomePackageModal');
    if (modal) modal.remove();
}

function downloadWelcomeQR(salonId) {
    const pkg = window.currentWelcomePackage;
    if (!pkg || !pkg.qrImageDataUrl) {
        alert('QR image not available');
        return;
    }

    const link = document.createElement('a');
    link.href = pkg.qrImageDataUrl;
    link.download = `salon-qr-${salonId}-${Date.now()}.png`;
    link.click();
}

function copyBookingLink() {
    const bookingLink = document.getElementById('bookingLink');
    if (!bookingLink) return;

    const linkText = bookingLink.textContent.trim();
    if (!linkText) return;

    navigator.clipboard.writeText(linkText)
        .then(() => alert('Booking link copied successfully.'))
        .catch(() => alert('Unable to copy automatically. Please copy it manually.'));
}

function generateQRCode(text) {
    const qrContainer = document.getElementById('qrCodeContainer');
    if (!qrContainer) return;

    qrContainer.innerHTML = '';
    
    if (typeof QRCode === 'undefined') {
        console.error('QRCode library not loaded');
        qrContainer.innerHTML = '<p style="color: red; font-size: 12px;">QR generation failed. Try refreshing page.</p>';
        return;
    }

    try {
        QRCode.toCanvas(qrContainer, text, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            quality: 0.95,
            margin: 1,
            width: 280,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        }, (err) => {
            if (err) {
                console.error('QR error:', err);
                qrContainer.innerHTML = '<p style="color: red; font-size: 12px;">Failed to generate QR code</p>';
            }
        });
    } catch (error) {
        console.error('QR generation error:', error);
        qrContainer.innerHTML = '<p style="color: red; font-size: 12px;">QR code generation failed</p>';
    }
}

async function downloadQRCode() {
    const qrCanvas = document.querySelector('#qrCodeContainer canvas');
    if (!qrCanvas) {
        alert('QR code not yet generated. Please wait a moment.');
        return;
    }

    try {
        const link = document.createElement('a');
        link.href = qrCanvas.toDataURL('image/png');
        link.download = `salon-qr-code-${Date.now()}.png`;
        link.click();
    } catch (error) {
        alert('Unable to download QR code. Try again.');
        console.error(error);
    }
}

function shareQRCode() {
    const bookingLink = document.getElementById('bookingLink')?.textContent.trim() || '';
    const salonName = document.getElementById('salonName')?.value.trim() || 'Our Salon';
    
    if (!bookingLink) {
        alert('Booking link not ready yet.');
        return;
    }

    const message = encodeURIComponent(`🎬 ${salonName}\n\n📱 Scan QR code to book appointment instantly!\n\n${bookingLink}\n\nBooKMySalon - Zero Wait Booking`);
    const whatsappUrl = `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, '_blank');
}

// ============================================
// AI Chat Widget (Owner + Customer)
// ============================================

(function initBookMySalonAIWidget() {
    if (window.__bmsAiWidgetLoaded) return;
    window.__bmsAiWidgetLoaded = true;

    const skipPaths = ['/admin.html', '/cg-control-7x9k-admin.html'];
    const pathName = (window.location.pathname || '').toLowerCase();
    if (skipPaths.some((p) => pathName.endsWith(p))) return;

    const pageSuggestsOwner = pathName.endsWith('/dashboard.html') || pathName.endsWith('/register.html');
    const pageIsBeauty = pathName.endsWith('/register.html') && new URLSearchParams(window.location.search).get('type') === 'beauty_parlour';
    const state = {
        open: false,
        loading: false,
        mode: pageSuggestsOwner ? 'owner' : 'customer',
        language: 'hindi',
        history: [],
        lead: { name: '', phone: '' },
        leadSaved: false,
        leadToken: '',
        leadVerified: false,
        leadExpiresAt: '',
        leadVerifiedAt: '',
        verifyPollId: null
    };
    const legacyLeadSessionKey = 'bms_ai_lead_session';
    const leadSessionKey = 'bms_ai_lead_session_v2';
    const leadSessionStorage = window.sessionStorage;
    const navEntry = (performance.getEntriesByType && performance.getEntriesByType('navigation') && performance.getEntriesByType('navigation')[0]) || null;
    const isReloadNavigation = (navEntry && navEntry.type === 'reload') || (performance.navigation && performance.navigation.type === 1);
    const forceFreshVerifyOnPage = pathName.endsWith('/register.html') || isReloadNavigation;

    if (forceFreshVerifyOnPage) {
        try {
            leadSessionStorage.removeItem(leadSessionKey);
            leadSessionStorage.removeItem(legacyLeadSessionKey);
            localStorage.removeItem(leadSessionKey);
            localStorage.removeItem(legacyLeadSessionKey);
        } catch (_) {
            // Ignore storage errors.
        }
    }

    const style = document.createElement('style');
    style.textContent = `
        .bms-ai-fab { position: fixed; right: 16px; bottom: 16px; z-index: 9998; border: 0; border-radius: 999px; padding: 12px 16px; font-weight: 700; font-size: 14px; color: #fff; background: linear-gradient(135deg, #06b6d4, #2563eb); box-shadow: 0 10px 26px rgba(0,0,0,.35); white-space: nowrap; }
        .bms-ai-panel { position: fixed; right: 16px; bottom: 74px; z-index: 9999; width: min(360px, calc(100vw - 20px)); height: min(530px, calc(100vh - 110px)); border-radius: 18px; overflow: hidden; border: 1px solid rgba(255,255,255,.12); background: #0b1220; color: #fff; box-shadow: 0 18px 45px rgba(0,0,0,.45); display: none; }
        .bms-ai-panel.open { display: flex; flex-direction: column; }
        .bms-ai-head { padding: 10px 12px; background: linear-gradient(135deg, #0ea5e9, #2563eb); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .bms-ai-title { font-size: 14px; font-weight: 800; }
        .bms-ai-close { border: 0; border-radius: 8px; padding: 6px 8px; background: rgba(255,255,255,.18); color: #fff; font-weight: 700; }
        .bms-ai-modes { padding: 10px 12px; display: flex; gap: 8px; border-bottom: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.02); }
        .bms-ai-mode { flex: 1; border: 1px solid rgba(255,255,255,.15); border-radius: 10px; background: transparent; color: #cbd5e1; padding: 8px; font-size: 12px; font-weight: 700; }
        .bms-ai-mode.active { color: #fff; border-color: #22d3ee; background: rgba(34,211,238,.14); }
        .bms-ai-lang { padding: 8px 12px; display: flex; gap: 8px; border-bottom: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.01); }
        .bms-ai-lang-btn { flex: 1; border: 1px solid rgba(255,255,255,.15); border-radius: 10px; background: transparent; color: #cbd5e1; padding: 6px; font-size: 12px; font-weight: 700; }
        .bms-ai-lang-btn.active { color: #fff; border-color: #22d3ee; background: rgba(14,165,233,.18); }
        .bms-ai-body { flex: 1; padding: 12px; overflow: auto; display: flex; flex-direction: column; gap: 8px; }
        .bms-ai-msg { max-width: 90%; border-radius: 12px; padding: 9px 10px; white-space: pre-wrap; line-height: 1.35; font-size: 13px; }
        .bms-ai-msg.user { align-self: flex-end; background: #1d4ed8; }
        .bms-ai-msg.bot { align-self: flex-start; background: rgba(255,255,255,.10); }
        .bms-ai-foot { padding: 10px; border-top: 1px solid rgba(255,255,255,.08); display: flex; gap: 8px; background: rgba(0,0,0,.2); }
        .bms-ai-input { flex: 1; border: 1px solid rgba(255,255,255,.2); border-radius: 10px; padding: 10px; background: rgba(255,255,255,.06); color: #fff; font-size: 13px; }
        .bms-ai-send { border: 0; border-radius: 10px; padding: 10px 12px; font-size: 12px; font-weight: 800; color: #fff; background: linear-gradient(135deg, #14b8a6, #0ea5e9); }
        .bms-ai-send:disabled { opacity: .6; }
        .bms-ai-lead { margin: 10px 12px 0; border: 1px solid rgba(255,255,255,.15); border-radius: 12px; padding: 10px; background: rgba(255,255,255,.03); }
        .bms-ai-mini { width: 100%; border: 1px solid rgba(255,255,255,.2); border-radius: 8px; padding: 8px; background: rgba(255,255,255,.06); color: #fff; font-size: 12px; margin-bottom: 8px; }
        .bms-ai-mini-btn { width: 100%; border: 0; border-radius: 8px; padding: 8px; font-size: 12px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #6366f1, #0ea5e9); }
        .bms-ai-verify-note { font-size: 11px; color: #cbd5e1; margin-top: 6px; }
        .bms-ai-verified-badge { margin: 10px 12px 0; display: none; border: 1px solid rgba(52,211,153,.35); background: rgba(16,185,129,.15); color: #bbf7d0; border-radius: 12px; padding: 8px 10px; font-size: 12px; font-weight: 700; }
        .bms-ai-faq { padding: 8px 12px; display: flex; gap: 6px; flex-wrap: wrap; border-top: 1px solid rgba(255,255,255,.08); border-bottom: 1px solid rgba(255,255,255,.08); }
        .bms-ai-chip { border: 1px solid rgba(255,255,255,.18); border-radius: 999px; padding: 5px 9px; background: rgba(255,255,255,.04); color: #dbeafe; font-size: 11px; }
        @media (max-width: 560px) {
            .bms-ai-fab { right: 10px; bottom: 10px; padding: 11px 13px; font-size: 13px; }
            .bms-ai-panel { right: 10px; bottom: 60px; width: calc(100vw - 12px); height: calc(100vh - 78px); }
        }
    `;
    document.head.appendChild(style);

    const fab = document.createElement('button');
    fab.className = 'bms-ai-fab';
    fab.type = 'button';
    fab.textContent = 'AI Help';

    const panel = document.createElement('section');
    panel.className = 'bms-ai-panel';
    panel.innerHTML = `
        <div class="bms-ai-head">
            <div class="bms-ai-title" id="bmsAiTitle">बुकमायसैलून एआई सहायक</div>
            <button type="button" class="bms-ai-close" id="bmsAiClose">Close</button>
        </div>
        <div class="bms-ai-modes">
            <button type="button" class="bms-ai-mode" id="bmsOwnerMode">Owner Mode</button>
            <button type="button" class="bms-ai-mode" id="bmsCustomerMode">Customer Mode</button>
        </div>
        <div class="bms-ai-lang">
            <button type="button" class="bms-ai-lang-btn" id="bmsLangHindi">Hindi</button>
            <button type="button" class="bms-ai-lang-btn" id="bmsLangEnglish">English</button>
        </div>
        <div class="bms-ai-lead" id="bmsAiLeadBox">
            <input id="bmsAiLeadName" class="bms-ai-mini" type="text" placeholder="Aapka naam" maxlength="60" autocomplete="off" />
            <button id="bmsAiLeadSave" type="button" class="bms-ai-mini-btn">व्हाट्सऐप सत्यापित करें</button>
            <p id="bmsAiVerifyNote" class="bms-ai-verify-note"></p>
        </div>
        <div id="bmsAiVerifiedBadge" class="bms-ai-verified-badge"></div>
        <div class="bms-ai-faq" id="bmsAiFaq"></div>
        <div class="bms-ai-body" id="bmsAiBody"></div>
        <div class="bms-ai-foot">
            <input id="bmsAiInput" class="bms-ai-input" type="text" placeholder="Apna sawal likho..." />
            <button id="bmsAiSend" class="bms-ai-send" type="button">Send</button>
        </div>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    const bodyEl = panel.querySelector('#bmsAiBody');
    const inputEl = panel.querySelector('#bmsAiInput');
    const sendEl = panel.querySelector('#bmsAiSend');
    const ownerBtn = panel.querySelector('#bmsOwnerMode');
    const customerBtn = panel.querySelector('#bmsCustomerMode');
    const closeBtn = panel.querySelector('#bmsAiClose');
    const langHindiBtn = panel.querySelector('#bmsLangHindi');
    const langEnglishBtn = panel.querySelector('#bmsLangEnglish');
    const faqEl = panel.querySelector('#bmsAiFaq');
    const leadBoxEl = panel.querySelector('#bmsAiLeadBox');
    const leadNameEl = panel.querySelector('#bmsAiLeadName');
    const leadSaveEl = panel.querySelector('#bmsAiLeadSave');
    const verifyNoteEl = panel.querySelector('#bmsAiVerifyNote');
    const verifiedBadgeEl = panel.querySelector('#bmsAiVerifiedBadge');
    const titleEl = panel.querySelector('#bmsAiTitle');

    function formatCountdownText(expiresAt) {
        const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now());
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    function setVerifyNote(text) {
        verifyNoteEl.textContent = text || '';
    }

    function showVerifiedBadge(text) {
        verifiedBadgeEl.textContent = text || '';
        verifiedBadgeEl.style.display = text ? 'block' : 'none';
    }

    function saveLeadSession() {
        try {
            leadSessionStorage.setItem(leadSessionKey, JSON.stringify({
                lead: state.lead,
                leadToken: state.leadToken,
                leadVerified: state.leadVerified,
                leadExpiresAt: state.leadExpiresAt,
                leadVerifiedAt: state.leadVerifiedAt
            }));
        } catch (_) {
            // Ignore storage errors.
        }
    }

    function clearLeadSession() {
        try {
            leadSessionStorage.removeItem(leadSessionKey);
            leadSessionStorage.removeItem(legacyLeadSessionKey);
            localStorage.removeItem(leadSessionKey);
            localStorage.removeItem(legacyLeadSessionKey);
        } catch (_) {
            // Ignore storage errors.
        }
    }

    function restoreLeadSession() {
        try {
            const raw = leadSessionStorage.getItem(leadSessionKey);
            if (!raw) {
                // Drop stale data from older schema so old verified phones don't reappear.
                localStorage.removeItem(leadSessionKey);
                localStorage.removeItem(legacyLeadSessionKey);
                return;
            }
            const saved = JSON.parse(raw);
            if (!saved || typeof saved !== 'object') return;

            state.lead = saved.lead && typeof saved.lead === 'object' ? saved.lead : { name: '', phone: '' };
            state.leadToken = String(saved.leadToken || '');
            state.leadVerified = !!saved.leadVerified;
            state.leadSaved = state.leadVerified;
            state.leadExpiresAt = String(saved.leadExpiresAt || '');
            state.leadVerifiedAt = String(saved.leadVerifiedAt || '');

            if (state.leadVerified) {
                leadBoxEl.style.display = 'none';
                showVerifiedBadge(state.language === 'english'
                    ? 'WhatsApp verified'
                    : 'WhatsApp सत्यापित हो गया');
                setVerifyNote('');
                return;
            }

            if (state.leadToken && state.leadExpiresAt && new Date(state.leadExpiresAt).getTime() > Date.now()) {
                leadNameEl.value = state.lead.name || '';
                setVerifyNote(state.language === 'english'
                    ? `Token expires in ${formatCountdownText(state.leadExpiresAt)}`
                    : `टोकन ${formatCountdownText(state.leadExpiresAt)} में expire होगा`);
                if (state.verifyPollId) clearInterval(state.verifyPollId);
                state.verifyPollId = setInterval(pollLeadVerification, 4000);
                return;
            }

            clearLeadSession();
        } catch (_) {
            clearLeadSession();
        }
    }

    function applyLanguageUiText() {
        const isEnglish = state.language === 'english';
        fab.textContent = isEnglish ? 'AI Help' : 'एआई सहायता';
        if (titleEl) titleEl.textContent = isEnglish ? 'BookMySalon AI Assistant' : 'बुकमायसैलून एआई सहायक';
        closeBtn.textContent = isEnglish ? 'Close' : 'बंद';
        ownerBtn.textContent = isEnglish
            ? (pageIsBeauty ? 'Owner Mode' : 'Owner Mode')
            : (pageIsBeauty ? 'ओनर मोड' : 'ओनर मोड');
        customerBtn.textContent = isEnglish ? 'Customer Mode' : 'ग्राहक मोड';
        leadNameEl.placeholder = isEnglish ? 'Your name' : 'आपका नाम';
        leadSaveEl.textContent = isEnglish ? 'Verify on WhatsApp' : 'व्हाट्सऐप सत्यापित करें';
        inputEl.placeholder = isEnglish ? 'Type your question...' : 'अपना सवाल लिखें...';
        sendEl.textContent = isEnglish ? 'Send' : 'भेजें';
        if (!state.leadVerified) {
            setVerifyNote(isEnglish ? 'Chat starts after WhatsApp verification.' : 'WhatsApp verification के बाद ही chat शुरू होगी।');
        }
    }

    function faqForMode() {
        const isEnglish = state.language === 'english';
        if (state.mode === 'owner') {
            if (pageIsBeauty) {
                return isEnglish ? [
                    'How to register beauty parlour?',
                    'Which services to add for beauty parlour?',
                    'How to manage threading / facial bookings?',
                    'How to activate subscription?'
                ] : [
                    'Beauty parlour registration kaise kare?',
                    'Beauty parlour me kaunsi services add kare?',
                    'Threading / facial booking kaise manage kare?',
                    'Subscription active kaise karwana hai?'
                ];
            }
            return isEnglish ? [
                'How to register a salon?',
                'Benefits of setting Google Map location?',
                '5 practical tips to increase bookings',
                'How to activate subscription?'
            ] : [
                'Salon registration kaise kare?',
                'Google Map location set karne ka fayda?',
                'Booking badhane ke 5 practical tips',
                'Subscription active kaise karwana hai?'
            ];
        }
        return isEnglish ? [
            'How to find nearby salons?',
            'Explain booking step-by-step',
            'What if slot is full?',
            'How to choose best booking time?'
        ] : [
            'Nearby salon kaise milega?',
            'Booking ka step-by-step process batao',
            'Slot full ho to kya kare?',
            'Best time booking kaise choose kare?'
        ];
    }

    function renderFaqChips() {
        faqEl.innerHTML = faqForMode().map((item) => `<button type="button" class="bms-ai-chip">${item}</button>`).join('');
        Array.from(faqEl.querySelectorAll('.bms-ai-chip')).forEach((btn) => {
            btn.addEventListener('click', () => {
                inputEl.value = btn.textContent || '';
                askAI();
            });
        });
    }

    async function pollLeadVerification() {
        if (!state.leadToken) return;
        try {
            const res = await fetch(`/api/ai/lead/verify-status/${encodeURIComponent(state.leadToken)}`);
            const data = await res.json();
            if (data.success && data.status === 'verified') {
                if (state.verifyPollId) {
                    clearInterval(state.verifyPollId);
                    state.verifyPollId = null;
                }
                state.leadSaved = true;
                state.leadVerified = true;
                state.leadVerifiedAt = String(data.verifiedAt || new Date().toISOString());
                if (data.phone) state.lead.phone = String(data.phone);
                leadBoxEl.style.display = 'none';
                showVerifiedBadge(state.language === 'english'
                    ? 'WhatsApp verified'
                    : 'WhatsApp सत्यापित हो गया');
                setVerifyNote('');
                saveLeadSession();
                pushMsg('assistant', state.language === 'english'
                    ? 'WhatsApp verification completed. Now ask your question.'
                    : 'WhatsApp सत्यापन पूरा हो गया है। अब आप सवाल पूछें।');
            } else if (data.status === 'pending' && data.expiresAt) {
                state.leadExpiresAt = String(data.expiresAt || '');
                saveLeadSession();
                setVerifyNote(state.language === 'english'
                    ? `Token expires in ${formatCountdownText(data.expiresAt)}`
                    : `टोकन ${formatCountdownText(data.expiresAt)} में expire होगा`);
            } else if (data.status === 'expired') {
                if (state.verifyPollId) {
                    clearInterval(state.verifyPollId);
                    state.verifyPollId = null;
                }
                state.leadToken = '';
                state.leadExpiresAt = '';
                clearLeadSession();
                setVerifyNote(state.language === 'english' ? 'Verification expired. Start again.' : 'Verification expire हो गया। फिर से शुरू करें।');
            }
        } catch (_) {
            // Keep polling silent.
        }
    }

    async function startWhatsAppLeadVerification() {
        const name = String(leadNameEl.value || '').trim();
        if (!name || name.length < 2) {
            alert('Naam sahi likho, minimum 2 letters.');
            return false;
        }
        try {
            const res = await fetch('/api/ai/lead/request-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.msg || 'Verification शुरू नहीं हो पाया।');
                return false;
            }

            state.lead = { name, phone: '' };
            state.leadToken = data.token || '';
            state.leadSaved = false;
            state.leadVerified = false;
            state.leadExpiresAt = String(data.expiresAt || '');
            state.leadVerifiedAt = '';
            saveLeadSession();

            if (state.verifyPollId) clearInterval(state.verifyPollId);
            state.verifyPollId = setInterval(pollLeadVerification, 4000);
            setVerifyNote(state.language === 'english'
                ? `Token expires in ${formatCountdownText(data.expiresAt)}`
                : `टोकन ${formatCountdownText(data.expiresAt)} में expire होगा`);
            showVerifiedBadge('');
            window.open(data.whatsappUrl, '_blank');
            pushMsg('assistant', state.language === 'english'
                ? `WhatsApp opened. Send "${data.whatsappText}" from the same WhatsApp number to complete verification.`
                : `व्हाट्सऐप खुल गया है। उसी WhatsApp नंबर से "${data.whatsappText}" भेजकर verification पूरा करें।`);
            return true;
        } catch (_) {
            alert(state.language === 'english' ? 'Network error. Try again.' : 'नेटवर्क त्रुटि। फिर से कोशिश करें।');
            return false;
        }
    }

    function pushMsg(role, text) {
        const msg = document.createElement('div');
        msg.className = `bms-ai-msg ${role === 'user' ? 'user' : 'bot'}`;
        msg.textContent = text;
        bodyEl.appendChild(msg);
        bodyEl.scrollTop = bodyEl.scrollHeight;
    }

    function renderModeButtons() {
        ownerBtn.classList.toggle('active', state.mode === 'owner');
        customerBtn.classList.toggle('active', state.mode === 'customer');
    }

    function renderLanguageButtons() {
        langHindiBtn.classList.toggle('active', state.language === 'hindi');
        langEnglishBtn.classList.toggle('active', state.language === 'english');
        applyLanguageUiText();
    }

    function resetChatPanel() {
        bodyEl.innerHTML = '';
        state.history = [];
        if (state.verifyPollId) {
            clearInterval(state.verifyPollId);
            state.verifyPollId = null;
        }
        if (state.leadVerified) {
            leadBoxEl.style.display = 'none';
            showVerifiedBadge(state.language === 'english'
                ? 'WhatsApp verified'
                : 'WhatsApp सत्यापित हो गया');
            setVerifyNote('');
        } else {
            leadBoxEl.style.display = 'block';
            showVerifiedBadge('');
            leadNameEl.value = state.lead.name || '';
        }
        renderFaqChips();
        applyLanguageUiText();
        if (!state.leadVerified && state.leadToken && state.leadExpiresAt && new Date(state.leadExpiresAt).getTime() > Date.now()) {
            state.verifyPollId = setInterval(pollLeadVerification, 4000);
            setVerifyNote(state.language === 'english'
                ? `Token expires in ${formatCountdownText(state.leadExpiresAt)}`
                : `टोकन ${formatCountdownText(state.leadExpiresAt)} में expire होगा`);
        }
    }

    async function askAI() {
        if (state.loading) return;
        if (!state.leadVerified) {
            alert(state.language === 'english' ? 'Please complete WhatsApp verification first.' : 'पहले WhatsApp verification पूरा करें।');
            return;
        }
        const text = (inputEl.value || '').trim();
        if (!text) return;

        pushMsg('user', text);
        state.history.push({ role: 'user', text });
        inputEl.value = '';
        state.loading = true;
        sendEl.disabled = true;

        const typingText = state.language === 'english' ? 'Thinking...' : 'सोच रहा हूँ...';
        pushMsg('assistant', typingText);

        try {
            const payload = {
                mode: state.mode,
                language: state.language,
                message: text,
                history: state.history.slice(-8),
                lead: state.lead
            };

            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            const last = bodyEl.lastElementChild;
            if (last && last.textContent === typingText) last.remove();

            if (!data.success) {
                pushMsg('assistant', data.msg || 'AI abhi temporarily unavailable hai. Thodi der me try karo.');
            } else {
                const reply = String(data.reply || '').trim() || 'Mujhe thoda clear question bhejo, main better help karunga.';
                pushMsg('assistant', reply);
                state.history.push({ role: 'assistant', text: reply });
            }
        } catch (err) {
            const last = bodyEl.lastElementChild;
            if (last && last.textContent === typingText) last.remove();
            pushMsg('assistant', 'Network issue aaya. Internet/server check karke phir try karo.');
        } finally {
            state.loading = false;
            sendEl.disabled = false;
            inputEl.focus();
        }
    }

    fab.addEventListener('click', () => {
        state.open = !state.open;
        panel.classList.toggle('open', state.open);
        if (state.open) inputEl.focus();
    });

    closeBtn.addEventListener('click', () => {
        state.open = false;
        panel.classList.remove('open');
    });

    leadSaveEl.addEventListener('click', () => {
        startWhatsAppLeadVerification().then((ok) => {
        if (ok) {
            inputEl.focus();
        }
        });
    });

    ownerBtn.addEventListener('click', () => {
        if (state.mode === 'owner') return;
        state.mode = 'owner';
        renderModeButtons();
        resetChatPanel();
    });

    customerBtn.addEventListener('click', () => {
        if (state.mode === 'customer') return;
        state.mode = 'customer';
        renderModeButtons();
        resetChatPanel();
    });

    langHindiBtn.addEventListener('click', () => {
        if (state.language === 'hindi') return;
        state.language = 'hindi';
        renderLanguageButtons();
        resetChatPanel();
    });

    langEnglishBtn.addEventListener('click', () => {
        if (state.language === 'english') return;
        state.language = 'english';
        renderLanguageButtons();
        resetChatPanel();
    });

    sendEl.addEventListener('click', askAI);
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') askAI();
    });

    renderModeButtons();
    renderLanguageButtons();
    restoreLeadSession();
    resetChatPanel();
})();

// ── Customer Feedback Widget ───────────────────────────────────────
(function initBmsFeedbackWidget() {
    if (window.__bmsFeedbackLoaded) return;
    window.__bmsFeedbackLoaded = true;

    const skipPaths = ['/cg-control-7x9k-admin.html', '/admin.html', '/dashboard.html'];
    const pn = (window.location.pathname || '').toLowerCase();
    if (skipPaths.some((p) => pn.endsWith(p))) return;

    const style = document.createElement('style');
    style.textContent = `
        .bms-fb-fab { position: fixed; right: 16px; bottom: 72px; z-index: 9998; border: 0; border-radius: 999px; padding: 11px 15px; font-weight: 700; font-size: 13px; color: #fff; background: linear-gradient(135deg, #a855f7, #ec4899); box-shadow: 0 8px 22px rgba(0,0,0,.35); cursor: pointer; white-space: nowrap; }
        .bms-fb-panel { position: fixed; right: 16px; bottom: 74px; z-index: 9999; width: min(340px, calc(100vw - 20px)); border-radius: 18px; overflow: hidden; border: 1px solid rgba(168,85,247,.3); background: #0b1220; color: #fff; box-shadow: 0 16px 40px rgba(0,0,0,.5); display: none; }
        .bms-fb-panel.open { display: block; }
        .bms-fb-head { padding: 12px 14px; background: linear-gradient(135deg, #a855f7, #ec4899); display: flex; align-items: center; justify-content: space-between; }
        .bms-fb-title { font-size: 14px; font-weight: 800; }
        .bms-fb-close { border: 0; border-radius: 8px; padding: 5px 9px; background: rgba(255,255,255,.2); color: #fff; font-weight: 700; font-size: 12px; cursor: pointer; }
        .bms-fb-body { padding: 14px; }
        .bms-fb-note { font-size: 12px; color: #c4b5fd; margin-bottom: 12px; line-height: 1.4; }
        .bms-fb-field { width: 100%; border: 1px solid rgba(255,255,255,.18); border-radius: 10px; padding: 9px 11px; background: rgba(255,255,255,.05); color: #fff; font-size: 13px; margin-bottom: 10px; box-sizing: border-box; resize: none; }
        .bms-fb-field::placeholder { color: #888; }
        .bms-fb-submit { width: 100%; border: 0; border-radius: 10px; padding: 10px; font-size: 13px; font-weight: 800; color: #fff; background: linear-gradient(135deg, #a855f7, #ec4899); cursor: pointer; }
        .bms-fb-submit:disabled { opacity: .6; cursor: not-allowed; }
        .bms-fb-success { padding: 18px 14px; text-align: center; font-size: 13px; color: #bbf7d0; }
        @media (max-width: 560px) {
            .bms-fb-fab { right: 10px; bottom: 62px; padding: 10px 12px; font-size: 12px; }
            .bms-fb-panel { right: 10px; bottom: 112px; width: calc(100vw - 12px); }
        }
    `;
    document.head.appendChild(style);

    const fab = document.createElement('button');
    fab.className = 'bms-fb-fab';
    fab.type = 'button';
    fab.textContent = '💬 सुझाव दें';

    const panel = document.createElement('div');
    panel.className = 'bms-fb-panel';
    panel.innerHTML = `
        <div class="bms-fb-head">
            <span class="bms-fb-title">💬 सुझाव / समस्या बताएं</span>
            <button type="button" class="bms-fb-close" id="bmsFbClose">✕</button>
        </div>
        <div id="bmsFbForm">
            <div class="bms-fb-body">
                <p class="bms-fb-note">आप हमें सुझाव या समस्या बता सकते हैं — अपना नंबर दें, हम आपकी सहायता करेंगे।</p>
                <input id="bmsFbName" class="bms-fb-field" type="text" placeholder="आपका नाम *" maxlength="60" autocomplete="off" />
                <input id="bmsFbPhone" class="bms-fb-field" type="tel" placeholder="WhatsApp नंबर (10 अंक) *" maxlength="10" autocomplete="off" />
                <textarea id="bmsFbMsg" class="bms-fb-field" rows="3" placeholder="सुझाव या समस्या लिखें *" maxlength="500"></textarea>
                <button type="button" class="bms-fb-submit" id="bmsFbSubmit">📤 भेजें</button>
                <p id="bmsFbError" style="color:#f87171;font-size:11px;margin-top:6px;display:none;"></p>
            </div>
        </div>
        <div id="bmsFbSuccess" class="bms-fb-success" style="display:none;">
            ✅ आपका सुझाव मिल गया!<br>हम जल्द ही आपसे WhatsApp पर संपर्क करेंगे। 🙏
        </div>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    const closeBtn = panel.querySelector('#bmsFbClose');
    const submitBtn = panel.querySelector('#bmsFbSubmit');
    const nameEl = panel.querySelector('#bmsFbName');
    const phoneEl = panel.querySelector('#bmsFbPhone');
    const msgEl = panel.querySelector('#bmsFbMsg');
    const errorEl = panel.querySelector('#bmsFbError');
    const formEl = panel.querySelector('#bmsFbForm');
    const successEl = panel.querySelector('#bmsFbSuccess');

    fab.addEventListener('click', () => {
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) nameEl.focus();
    });

    closeBtn.addEventListener('click', () => panel.classList.remove('open'));

    // Only allow digits in phone
    phoneEl.addEventListener('input', () => {
        phoneEl.value = phoneEl.value.replace(/\D/g, '').slice(0, 10);
    });

    submitBtn.addEventListener('click', async () => {
        const name = (nameEl.value || '').trim();
        const phone = (phoneEl.value || '').replace(/\D/g, '');
        const message = (msgEl.value || '').trim();

        errorEl.style.display = 'none';
        if (!name || name.length < 2) { errorEl.textContent = 'कृपया सही नाम दर्ज करें।'; errorEl.style.display = 'block'; return; }
        if (phone.length !== 10) { errorEl.textContent = 'WhatsApp नंबर 10 अंकों का होना चाहिए।'; errorEl.style.display = 'block'; return; }
        if (!message || message.length < 5) { errorEl.textContent = 'कृपया कम से कम 5 अक्षर का सुझाव लिखें।'; errorEl.style.display = 'block'; return; }

        submitBtn.disabled = true;
        submitBtn.textContent = 'भेज रहे हैं...';
        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, message })
            });
            const data = await res.json();
            if (!data.success) {
                errorEl.textContent = data.msg || 'कुछ गड़बड़ हो गई। दोबारा कोशिश करें।';
                errorEl.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = '📤 भेजें';
                return;
            }
            formEl.style.display = 'none';
            successEl.style.display = 'block';
            setTimeout(() => { panel.classList.remove('open'); formEl.style.display = 'block'; successEl.style.display = 'none'; nameEl.value = ''; phoneEl.value = ''; msgEl.value = ''; submitBtn.disabled = false; submitBtn.textContent = '📤 भेजें'; }, 4000);
        } catch (_) {
            errorEl.textContent = 'Network error। Internet check karke dobara try karo।';
            errorEl.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = '📤 भेजें';
        }
    });
})();