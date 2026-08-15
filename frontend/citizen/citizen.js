// ============================================================
//  citizen.js  —  KANAD Prototype  |  PART A: Citizen Portal
//  Public-facing JS.  Contains ONLY citizen-side logic.
//  Police/employee/admin logic lives in police/police.js
// ============================================================

const API_BASE = window.location.origin;

// State
let currentUser = null;
let currentToken = null;
let pendingCategory = null;
let currentCaptchaCode = '';
let currentGeneratedOtp = '';
let otpCountdownInterval = null;

// Multi-lingual i18n dictionaries
const i18n = {
    en: {
        tab_auth: "Authentication",
        tab_citizen: "Citizen Portal",
        citizen_file_title: "File Cyber Complaint",
        citizen_description_label: "Detailed Incident Description (Min 10 characters)",
        citizen_category_label: "Manual Category (Optional Override)",
        citizen_cat_auto: "Auto-Route (Recommended)",
        citizen_cat_financial: "Financial Fraud (UPI/SMS/Bank)",
        citizen_cat_women_child: "Women/Child Cyber Cases",
        citizen_cat_impersonation: "Social Media Impersonation",
        citizen_cat_hacking: "System Hacking / Ransomware",
        citizen_cat_other: "Other Cyber Crimes",
        citizen_submit_btn: "Submit Cyber Complaint",
        citizen_track_title: "Track Complaint Status",
    },
    hi: {
        tab_auth: "प्रमाणीकरण",
        tab_citizen: "नागरिक पोर्टल",
        citizen_file_title: "साइबर शिकायत दर्ज करें",
        citizen_description_label: "विस्तृत घटना विवरण (कम से कम १० अक्षर)",
        citizen_category_label: "मैन्युअल श्रेणी (वैकल्पिक)",
        citizen_cat_auto: "ऑटो-रूट (अनुशंसित)",
        citizen_cat_financial: "वित्तीय धोखाधड़ी (यूपीआई/बैंक)",
        citizen_cat_women_child: "महिला/बाल साइबर मामले",
        citizen_cat_impersonation: "सोशल मीडिया प्रतिरूपण",
        citizen_cat_hacking: "सिस्टम हैकिंग / रैनसमवेयर",
        citizen_cat_other: "अन्य साइबर अपराध",
        citizen_submit_btn: "शिकायत सबमिट करें",
        citizen_track_title: "शिकायत की स्थिति ट्रैक करें",
    },
    gu: {
        tab_auth: "પ્રમાણીકરણ",
        tab_citizen: "નાગરિક પોર્ટલ",
        citizen_file_title: "સાયબર ફરિયાદ નોંધાવો",
        citizen_description_label: "વિગતવાર ઘટના વર્ણન (ઓછામાં ઓછા ૧૦ અક્ષર)",
        citizen_category_label: "મેન્યુઅલ કેટેગરી (વૈકલ્પિક)",
        citizen_cat_auto: "ઓટો-રૂટ (ભલામણ કરેલ)",
        citizen_cat_financial: "નાણાકીય છેતરપિંડી (UPI/બેંક)",
        citizen_cat_women_child: "મહિલા/બાળ સાયબર કેસો",
        citizen_cat_impersonation: "સોશિયલ મીડિયા ફેક પ્રોફાઇલ",
        citizen_cat_hacking: "સિસ્ટમ હેકિંગ / રેન્સમવેર",
        citizen_cat_other: "અન્ય સાયબર ગુનાઓ",
        citizen_submit_btn: "ફરિયાદ સબમિટ કરો",
        citizen_track_title: "ફરિયાદ સ્થિતિ ટ્રૅક કરો",
    }
};

let currentLang = "en";

// ─── INITIALISATION ───────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('token');
    const savedUser  = localStorage.getItem('user');

    if (savedToken && savedUser) {
        currentToken = savedToken;
        currentUser  = JSON.parse(savedUser);
    } else {
        currentToken = null;
        currentUser  = null;
    }

    // Start on landing view; if already logged-in as citizen show tabs
    switchTab('landing');
    if (currentToken && currentUser) {
        setupAuthUI();
    }

    lucide.createIcons();

    // Auto-routing suggestion on description input
    const descInput = document.getElementById('complaint-desc');
    if (descInput) {
        descInput.addEventListener('input', debounce(handleAutoRoutingSuggestion, 500));
    }

    // Load slideshow from API
    if (document.getElementById('slideshow-container')) {
        initSlideshow();
    }

    // Generate initial captcha
    generateCaptcha();
});

// ─── SLIDESHOW ────────────────────────────────────────────

let slideIndex = 0;
let slideTimeout;

async function initSlideshow() {
    try {
        const res = await fetch('/api/slides');
        const slides = await res.json();
        const container = document.getElementById('slideshow-container');
        const dotsContainer = document.getElementById('slideshow-dots');

        if (slides.length === 0) {
            container.style.display = 'none';
            return;
        }

        // Remove existing slide elements (but keep arrows and dots container)
        Array.from(container.children).forEach(child => {
            if (child.id !== 'slideshow-dots' && !child.classList.contains('slide-arrow')) {
                container.removeChild(child);
            }
        });
        dotsContainer.innerHTML = '';

        slides.forEach((s, index) => {
            const slideDiv = document.createElement('div');
            slideDiv.className = 'slide fade';

            if (s.image_url) {
                slideDiv.classList.add('has-image');
                slideDiv.style.backgroundImage = `url('${s.image_url}')`;
            } else {
                let grad = 'linear-gradient(135deg, rgba(24, 84, 142, 0.05), rgba(40, 158, 231, 0.12))';
                if (s.color_scheme === 'success') grad = 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(16, 185, 129, 0.12))';
                if (s.color_scheme === 'warning') grad = 'linear-gradient(135deg, rgba(157, 112, 90, 0.05), rgba(157, 112, 90, 0.12))';
                if (s.color_scheme === 'danger')  grad = 'linear-gradient(135deg, rgba(220, 38, 38, 0.05), rgba(220, 38, 38, 0.12))';
                slideDiv.style.background = grad;
            }

            const iconColor = s.color_scheme === 'info' ? 'var(--neon-cyan)' : `var(--${s.color_scheme})`;
            slideDiv.innerHTML = `
                <div class="slide-content-wrapper">
                    <i data-lucide="${s.icon}" style="width: 56px; height: 56px; color: ${s.image_url ? '#ffffff' : iconColor}; margin-bottom: 18px; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.15));"></i>
                    <h3 style="color: ${s.image_url ? '#ffffff' : iconColor}; font-size: 26px; margin-bottom: 12px; font-weight: 700;">${s.title}</h3>
                    <p style="color: ${s.image_url ? 'rgba(255,255,255,0.88)' : 'var(--text-secondary)'}; font-size: 15px; max-width: 640px; line-height: 1.7;">${s.description}</p>
                </div>
            `;

            const firstArrow = container.querySelector('.slide-arrow');
            if (firstArrow) {
                container.insertBefore(slideDiv, firstArrow);
            } else {
                container.insertBefore(slideDiv, dotsContainer);
            }

            const dot = document.createElement('span');
            dot.className = 'dot';
            dot.addEventListener('click', () => goToSlide(index + 1));
            dotsContainer.appendChild(dot);
        });

        lucide.createIcons();
        slideIndex = 0;
        showSlides();
    } catch (error) {
        console.error("Error loading slideshow:", error);
    }
}

function showSlides() {
    clearTimeout(slideTimeout);
    const slides = document.getElementsByClassName("slide");
    const dots   = document.getElementsByClassName("dot");
    if (slides.length === 0) return;

    slideIndex++;
    if (slideIndex > slides.length) slideIndex = 1;

    for (let i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
        if (dots[i]) dots[i].className = dots[i].className.replace(" active", "");
    }

    slides[slideIndex - 1].style.display = "block";
    if (dots[slideIndex - 1]) dots[slideIndex - 1].className += " active";

    lucide.createIcons();
    slideTimeout = setTimeout(showSlides, 5000);
}

function goToSlide(n) {
    clearTimeout(slideTimeout);
    slideIndex = n - 1;
    showSlides();
}

function changeSlide(direction) {
    clearTimeout(slideTimeout);
    const slides = document.getElementsByClassName("slide");
    if (slides.length === 0) return;
    slideIndex += direction;
    if (slideIndex > slides.length) slideIndex = 1;
    if (slideIndex < 1) slideIndex = slides.length;
    slideIndex--;
    showSlides();
}

// ─── CAPTCHA ──────────────────────────────────────────────

function generateCaptcha() {
    const canvas = document.getElementById('captcha-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    currentCaptchaCode = code;

    ctx.strokeStyle = 'rgba(40, 158, 231, 0.2)';
    for (let i = 0; i < canvas.width; i += 15) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for (let j = 0; j < canvas.height; j += 15) {
        ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(canvas.width, j); ctx.stroke();
    }

    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#289ee7';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < code.length; i++) {
        const char = code[i];
        const x = 15 + i * 25;
        const y = canvas.height / 2 + (Math.random() * 10 - 5);
        const angle = (Math.random() * 30 - 15) * Math.PI / 180;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillText(char, 0, 0);
        ctx.restore();
    }

    ctx.strokeStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.moveTo(Math.random() * 20, Math.random() * canvas.height);
    ctx.lineTo(canvas.width - Math.random() * 20, Math.random() * canvas.height);
    ctx.stroke();
}

// ─── OTP / EMAIL AUTH ─────────────────────────────────────

async function sendEmailOtp() {
    const email   = document.getElementById('auth-email').value.trim();
    const captcha = document.getElementById('auth-captcha-input').value.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAlert('Please enter a valid email address', 'error');
        return;
    }

    if (captcha.toUpperCase() !== currentCaptchaCode) {
        showAlert('Invalid Captcha Code. Please try again.', 'error');
        generateCaptcha();
        document.getElementById('auth-captcha-input').value = '';
        return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    currentGeneratedOtp = otp;

    try {
        const response = await fetch(`${API_BASE}/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Failed to send OTP');
        }
        showAlert('OTP has been successfully sent to your email.');
    } catch (err) {
        console.warn("Mail OTP failed, using fallback:", err);
        showAlert(`SMTP not configured or failed: ${err.message}. Showing mock notification.`, 'warning');
        showMockEmailNotification(email, otp);
    }

    document.getElementById('auth-step-1').style.display = 'none';
    document.getElementById('auth-step-2').style.display = 'block';

    let timeLeft = 60;
    const timerDiv = document.getElementById('otp-timer');
    timerDiv.innerText = `Resend OTP in ${timeLeft}s`;

    if (otpCountdownInterval) clearInterval(otpCountdownInterval);
    otpCountdownInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(otpCountdownInterval);
            timerDiv.innerHTML = `<a href="#" onclick="sendEmailOtp(); return false;" style="color: var(--neon-cyan); text-decoration: underline;">Resend OTP</a>`;
        } else {
            timerDiv.innerText = `Resend OTP in ${timeLeft}s`;
        }
    }, 1000);
}

function backToStep1() {
    document.getElementById('auth-step-2').style.display = 'none';
    document.getElementById('auth-step-1').style.display = 'block';
    if (otpCountdownInterval) clearInterval(otpCountdownInterval);
}

function showMockEmailNotification(email, otp) {
    const existing = document.getElementById('mock-email-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.id = 'mock-email-notification';
    notification.style.cssText = `
        position: fixed; bottom: 30px; right: 30px; width: 380px;
        background: #1c2630; border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.2);
        border-radius: 16px; padding: 14px 16px; color: #fff; z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        animation: slideInRight 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
    `;

    if (!document.getElementById('slide-in-animation-style')) {
        const style = document.createElement('style');
        style.id = 'slide-in-animation-style';
        style.innerText = `@keyframes slideInRight { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
        document.head.appendChild(style);
    }

    notification.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 24px; height: 24px; background: #ea4335; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #fff;">✉️</div>
                <span style="font-weight: 600; color: #f4f4f5; font-size: 12px; letter-spacing: -0.2px;">Email (ForenSync Mailer)</span>
                <span style="color: #a1a1aa; font-size: 11px;">• now</span>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: #a1a1aa; cursor: pointer; font-size: 16px; font-weight: bold; line-height: 1; padding: 0;">&times;</button>
        </div>
        <div style="font-size: 13px; line-height: 1.4; color: #d4d4d8;">
            <strong style="color: #fff; display: block; font-size: 13px; margin-bottom: 2px;">To: ${email}</strong>
            Your OTP for citizen verification on ForenSync Cyber Portal is <strong style="color: var(--neon-cyan); font-size: 14px;">${otp}</strong>. Valid for 5 mins. Please do not share it.
        </div>
    `;

    document.body.appendChild(notification);
}

async function handleOtpSubmit(event) {
    event.preventDefault();
    const enteredOtp = document.getElementById('auth-otp-input').value.trim();
    const email      = document.getElementById('auth-email').value.trim();

    if (enteredOtp !== currentGeneratedOtp) {
        showAlert('Invalid OTP. Please enter the correct code.', 'error');
        return;
    }

    if (otpCountdownInterval) clearInterval(otpCountdownInterval);

    const password = `fixed_otp_secret_pwd_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const name     = `Citizen (${email.split('@')[0]})`;

    // Auto-register citizen account (silent)
    try {
        const regFormData = new FormData();
        regFormData.append('name', name);
        regFormData.append('email', email);
        regFormData.append('password', password);
        regFormData.append('role', 'citizen');
        await fetch(`${API_BASE}/register`, { method: 'POST', body: regFormData });
    } catch (err) { /* silent */ }

    // Login to get JWT
    try {
        const loginFormData = new FormData();
        loginFormData.append('username', email);
        loginFormData.append('password', password);

        const response = await fetch(`${API_BASE}/token`, { method: 'POST', body: loginFormData });
        if (!response.ok) throw new Error('Authentication failed after verification');

        const data   = await response.json();
        currentToken = data.access_token;
        currentUser  = data.user;

        localStorage.setItem('token', currentToken);
        localStorage.setItem('user', JSON.stringify(currentUser));

        setupAuthUI();
        showAlert('Verification successful! You are now logged in.');

        document.getElementById('auth-otp-form').reset();
        document.getElementById('auth-step-2').style.display = 'none';
        document.getElementById('auth-step-1').style.display = 'block';
    } catch (err) {
        showAlert(err.message, 'error');
    }
}

// ─── LANDING PAGE OPTIONS ─────────────────────────────────

function selectLandingOption(option) {
    if (option === 'track') {
        switchTab('citizen-track');
    } else {
        const savedToken = localStorage.getItem('token');
        if (savedToken && currentUser && currentUser.role === 'citizen') {
            switchTab('citizen-file');
            const catSelect = document.getElementById('complaint-cat');
            if (catSelect) {
                catSelect.value = option;
                catSelect.dispatchEvent(new Event('change'));
                const descInput = document.getElementById('complaint-desc');
                if (descInput) {
                    descInput.focus();
                    descInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
            pendingCategory = null;
        } else {
            pendingCategory = option;
            switchTab('auth');
            generateCaptcha();
        }
    }
}

function goHome() {
    switchTab('landing');
}

// ─── SHARED UTILITIES ─────────────────────────────────────

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function initGoogleTranslate() {
    const gtScript1 = document.createElement('script');
    gtScript1.type = 'text/javascript';
    gtScript1.innerHTML = `
    function googleTranslateElementInit() {
      new google.translate.TranslateElement({pageLanguage: 'en', includedLanguages: 'en,hi,gu', layout: google.translate.TranslateElement.InlineLayout.SIMPLE}, 'google_translate_element');
    }
    `;
    document.body.appendChild(gtScript1);

    const gtScript2 = document.createElement('script');
    gtScript2.type = 'text/javascript';
    gtScript2.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.body.appendChild(gtScript2);
}
initGoogleTranslate();

function showAlert(message, type = 'success') {
    const banner = document.getElementById('alert-banner');
    if (!banner) return;
    banner.innerText = message;
    banner.className = 'alert-feedback';

    if (type === 'success') {
        banner.style.background = 'rgba(16, 185, 129, 0.15)';
        banner.style.color      = '#34d399';
        banner.style.border     = '1px solid rgba(16, 185, 129, 0.3)';
    } else if (type === 'error') {
        banner.style.background = 'rgba(239, 68, 68, 0.15)';
        banner.style.color      = '#f87171';
        banner.style.border     = '1px solid rgba(239, 68, 68, 0.3)';
    } else {
        banner.style.background = 'rgba(157, 112, 90, 0.15)';
        banner.style.color      = '#9d705a';
        banner.style.border     = '1px solid rgba(157, 112, 90, 0.3)';
    }

    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, 5000);
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.app-view').forEach(view => view.classList.remove('active'));

    const targetTab  = document.getElementById(`tab-${tabId}`);
    const targetView = document.getElementById(`view-${tabId}`);

    if (targetTab)  targetTab.classList.add('active');
    if (targetView) targetView.classList.add('active');
}

// ─── AUTO-ROUTING SUGGESTION (client-side preview) ────────

function handleAutoRoutingSuggestion() {
    const desc = document.getElementById('complaint-desc').value.trim();
    const banner        = document.getElementById('suggest-banner');
    const catSpan       = document.getElementById('suggest-cat');
    const prioritySpan  = document.getElementById('suggest-priority');
    const severityGuide = document.getElementById('severity-guide');

    if (desc.length < 10) {
        banner.style.display = 'none';
        severityGuide.style.display = 'none';
        return;
    }

    const descLower = desc.toLowerCase();
    let category = "other", priority = 1, isSevere = false;

    const financial     = ["otp","upi","bank","card","money","transaction","debit","credit","paytm","gpay","phonepe","transfer","fraud"];
    const impersonation = ["profile","fake account","instagram","facebook","impersonate","impersonator","fake identity","photo abuse","pretending"];
    const hacking       = ["ransomware","hacked","corrupted","malware","virus","phishing","database down","ddos","unauthorized access","breach"];

    const finM  = financial.reduce((acc, kw) => acc + (descLower.includes(kw) ? 1 : 0), 0);
    const impM  = impersonation.reduce((acc, kw) => acc + (descLower.includes(kw) ? 1 : 0), 0);
    const hackM = hacking.reduce((acc, kw) => acc + (descLower.includes(kw) ? 1 : 0), 0);
    const maxM  = Math.max(finM, impM, hackM);

    if (maxM > 0) {
        if (maxM === finM)       { category = "financial_fraud"; priority = Math.min(3 + Math.floor(finM / 2), 5); }
        else if (maxM === hackM) { category = "hacking";         priority = Math.min(3 + Math.floor(hackM / 2), 5); }
        else                     { category = "impersonation";   priority = Math.min(2 + Math.floor(impM / 2), 5); }
    }

    if (["emergency","threat","ransom","suicide","national security"].some(kw => descLower.includes(kw))) {
        priority = 5; isSevere = true;
    }

    catSpan.innerText      = category.toUpperCase().replace('_', ' ');
    prioritySpan.innerText = `${priority} / 5`;
    banner.style.display   = 'flex';
    severityGuide.style.display = isSevere ? 'block' : 'none';
}

// ─── CATEGORY FOLLOW-UP QUESTIONS ─────────────────────────

function handleCategoryQuestions() {
    const cat      = document.getElementById("complaint-cat").value;
    const condDiv  = document.getElementById("conditional-questions");
    const fieldsDiv = document.getElementById("conditional-fields");
    fieldsDiv.innerHTML = "";

    if (!cat) { condDiv.style.display = "none"; return; }

    condDiv.style.display = "block";
    if (cat === "financial_fraud") {
        fieldsDiv.innerHTML = `
            <div class="form-group"><label>Bank Name / Payment Gateway</label>
            <input type="text" id="follow-bank" class="form-control" placeholder="e.g. State Bank of India"></div>
            <div class="form-group"><label>Amount Lost (INR)</label>
            <input type="number" id="follow-amount" class="form-control" placeholder="e.g. 50000"></div>`;
    } else if (cat === "impersonation") {
        fieldsDiv.innerHTML = `
            <div class="form-group"><label>Impersonating Social Link (URL)</label>
            <input type="url" id="follow-url" class="form-control" placeholder="e.g. https://instagram.com/fake_profile"></div>`;
    } else if (cat === "women_child") {
        fieldsDiv.innerHTML = `
            <div class="form-group"><label>Social Media Platform / App Used</label>
            <input type="text" id="follow-platform" class="form-control" placeholder="e.g. WhatsApp, Instagram, Telegram"></div>
            <div class="form-group"><label>Suspect Profile / Contact Number (if known)</label>
            <input type="text" id="follow-suspect" class="form-control" placeholder="e.g. @username or phone number"></div>`;
    } else if (cat === "hacking") {
        fieldsDiv.innerHTML = `
            <div class="form-group"><label>Operating System / Device Type</label>
            <input type="text" id="follow-os" class="form-control" placeholder="e.g. Windows Server 2022"></div>`;
    } else {
        condDiv.style.display = "none";
    }
}

// ─── AUTH UI ──────────────────────────────────────────────

function setupAuthUI() {
    ['tab-auth','tab-citizen-file','tab-citizen-track'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const logoutBtn = document.getElementById('logout-btn');

    if (!currentUser || !currentToken) {
        if (logoutBtn) logoutBtn.style.display = 'none';
        const tabAuth = document.getElementById('tab-auth');
        if (tabAuth) tabAuth.style.display = 'flex';
        switchTab('auth');
        generateCaptcha();
        return;
    }

    // Citizen portal only serves citizens
    if (currentUser.role !== 'citizen') {
        showAlert('This portal is for Citizens only.', 'error');
        localStorage.removeItem('token'); localStorage.removeItem('user');
        currentUser = null; currentToken = null;
        setupAuthUI();
        return;
    }

    const tabFile  = document.getElementById('tab-citizen-file');
    const tabTrack = document.getElementById('tab-citizen-track');
    if (tabFile)  tabFile.style.display  = 'flex';
    if (tabTrack) tabTrack.style.display = 'flex';

    const tabContainer = document.getElementById('tab-container');
    if (tabContainer) tabContainer.style.display = 'flex';

    if (pendingCategory) {
        selectLandingOption(pendingCategory);
    } else {
        switchTab('citizen-file');
    }

    if (logoutBtn) logoutBtn.style.display = 'flex';
}

// Logout
const logoutBtnEl = document.getElementById('logout-btn');
if (logoutBtnEl) {
    logoutBtnEl.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        currentUser = null; currentToken = null;
        setupAuthUI();
        showAlert('Logged out successfully.');
        switchTab('landing');
    });
}

// ─── COMPLAINT FILING ─────────────────────────────────────

const complaintFormEl = document.getElementById('complaint-form');
if (complaintFormEl) {
    complaintFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const description = document.getElementById('complaint-desc').value;
        const category    = document.getElementById('complaint-cat').value;

        const formData = new FormData();
        formData.append('description', description);
        formData.append('language', currentLang);
        if (category) formData.append('category', category);

        try {
            const response = await fetch(`${API_BASE}/complaints`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${currentToken}` },
                body: formData
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Failed to submit complaint');
            }
            const data = await response.json();
            showAlert(`Complaint Filed! Ticket ID: ${data.ticket_id}`);
            complaintFormEl.reset();
            document.getElementById('suggest-banner').style.display   = 'none';
            document.getElementById('severity-guide').style.display   = 'none';
            document.getElementById('conditional-questions').style.display = 'none';

            // Auto-switch to track view
            document.getElementById('track-ticket-id').value = data.ticket_id;
            switchTab('citizen-track');
            trackComplaint();
        } catch (err) {
            showAlert(err.message, 'error');
        }
    });
}

// ─── COMPLAINT TRACKING ───────────────────────────────────

async function trackComplaint() {
    const ticketId = document.getElementById('track-ticket-id').value.trim();
    if (!ticketId) { showAlert('Please enter a ticket ID', 'error'); return; }

    try {
        const response = await fetch(`${API_BASE}/complaints/${ticketId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Complaint not found or unauthorized');
        }
        const data = await response.json();

        document.getElementById('track-result').style.display       = 'block';
        document.getElementById('track-ticket-num').innerText        = data.ticket_id;
        document.getElementById('track-cat').innerText               = data.category.toUpperCase().replace('_', ' ');
        document.getElementById('track-desk').innerText              = data.assigned_desk;
        document.getElementById('track-priority').innerText          = `${data.priority_score} / 5`;
        document.getElementById('track-desc-body').innerText         = data.description;

        const statusBadge = document.getElementById('track-badge-status');
        statusBadge.innerText = data.status.toUpperCase();
        if (data.status === 'pending')       statusBadge.className = 'badge badge-medium';
        else if (data.status === 'investigating') statusBadge.className = 'badge badge-high';
        else if (data.status === 'resolved') statusBadge.className = 'badge badge-low';

        document.getElementById('track-result').dataset.complaintId = data.id;

        const list = document.getElementById('track-evidence-list');
        list.innerHTML = '';
        if (data.evidence && data.evidence.length > 0) {
            data.evidence.forEach(ev => {
                const li = document.createElement('li');
                li.style.padding      = '8px 0';
                li.style.borderBottom = '1px solid rgba(255,255,255,0.03)';

                let scanBadge = `<span style="color: var(--success); font-weight: bold; float: right;">✓ Bridging PC Clean</span>`;
                if (ev.scan_status === 'flagged') {
                    scanBadge = `<span style="color: var(--warning); font-weight: bold; float: right;">⚠️ MALICIOUS FILE FLAGGED</span>`;
                }

                li.innerHTML = `
                    <div style="display: flex; justify-content: space-between; font-size: 13px;">
                        <strong>📁 ${ev.filename}</strong> ${scanBadge}
                    </div>
                    <div class="hash-log">SHA-256: ${ev.sha256_hash}</div>
                `;
                list.appendChild(li);
            });
        } else {
            list.innerHTML = `<li style="font-size: 13px; color: var(--text-secondary);">No evidence files uploaded yet.</li>`;
        }
    } catch (err) {
        showAlert(err.message, 'error');
    }
}

// ─── EVIDENCE UPLOAD (with offline queue fallback) ────────

async function uploadEvidenceFile() {
    const fileInput      = document.getElementById('evidence-file-input');
    const statusDiv      = document.getElementById('evidence-upload-status');
    const complaintId    = document.getElementById('track-result').dataset.complaintId;
    const offlineNotifier = document.getElementById('offline-queue-notifier');

    if (!fileInput.files || fileInput.files.length === 0) return;
    if (!complaintId) { showAlert('No active tracked complaint selected', 'error'); return; }

    const file = fileInput.files[0];

    if (!navigator.onLine) {
        offlineNotifier.style.display = 'block';
        statusDiv.innerText = `Queued "${file.name}" for future upload when connection resumes.`;
        return;
    }

    offlineNotifier.style.display = 'none';
    statusDiv.innerText = `Bridging PC Scanning & Uploading "${file.name}"...`;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_BASE}/complaints/${complaintId}/evidence`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentToken}` },
            body: formData
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Evidence upload/parsing failed');
        }
        const data = await response.json();
        if (data.scan_status === 'flagged') {
            showAlert(`Bridging PC Security Shield: Malicious signature detected in ${file.name}! Blocked from parsing.`, 'error');
        } else {
            showAlert(`Evidence uploaded and parsed! ${data.events_count} timeline events indexed.`);
        }
        statusDiv.innerText = '';
        fileInput.value     = '';
        trackComplaint();
    } catch (err) {
        showAlert(err.message, 'error');
        statusDiv.innerText = '';
        fileInput.value     = '';
    }
}
