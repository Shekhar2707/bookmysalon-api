// ============================================
// BookMySalon - JavaScript Logic
// ============================================

// State Management
let selectedService = null;
let selectedPrice = 0;
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
    window.location.href = 'salons.html';
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

function selectService(element, serviceName, price) {
    // Remove selection from all services
    document.querySelectorAll('.service-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Add selection to clicked service
    element.classList.add('selected');
    selectedService = serviceName;
    selectedPrice = price;

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

    // Update price
    const summaryPrice = document.getElementById('summaryPrice');
    if (summaryPrice) {
        summaryPrice.textContent = `₹${selectedPrice}`;
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
    selectedPrice = 0;
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

// Get Salon ID from URL
window.addEventListener('load', () => {
    const salonId = getUrlParameter('id');
    if (salonId && document.getElementById('salonId')) {
        document.getElementById('salonId').textContent = salonId;
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
            if (accuracy && accuracy > 1000) {
                if (addressInput) {
                    addressInput.value = '';
                }
                if (cityInput) cityInput.value = '';
                if (stateInput) stateInput.value = '';
                if (pincodeInput) pincodeInput.value = '';
                if (status) {
                    status.textContent = `⚠️ GPS accuracy too low (${Math.round(accuracy)}m). Move to open area or fill manually.`;
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
    const registerBtn = document.getElementById('registerBtn');

    const number = sanitizeIndianPhone(rawNumber);
    if (!/^[6-9]\d{9}$/.test(number)) {
        alert('Please enter a valid 10-digit WhatsApp number starting with 6, 7, 8, or 9.');
        return;
    }

    isRegistrationSubmitting = true;

    const selectedServices = Array.from(document.querySelectorAll('input[name="serviceItem"]:checked'))
        .map((el) => el.value);

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
                services: selectedServices,
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