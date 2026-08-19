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
let registerCaptchaCode = '';
let currentGeneratedOtp = '';
let registerOtp = '';
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
        citizen_cat_women_child: "CyberTipline Child Safety",
        citizen_cat_women_safety: "Women Safety / Harassment",
        citizen_cat_impersonation: "Social Media Impersonation",
        citizen_cat_hacking: "System Hacking / Ransomware",
        citizen_cat_other: "Other Cyber Crimes",
        citizen_submit_btn: "Submit Cyber Complaint",
        citizen_track_title: "Track Complaint Status",
        // FIR/Report Crime page
        report_crime_title: "Report Crime",
        fir_badge: "FIR",
        fir_subtitle: "First Information Report under Section 154 Cr.P.C.",
        back_to_portal: "Back to Portal",
    },
    hi: {
        tab_auth: "प्रमाणीकरण",
        tab_citizen: "नागरिक पोर्टल",
        citizen_file_title: "साइबर शिकायत दर्ज करें",
        citizen_description_label: "विस्तृत घटना विवरण (कम से कम १० अक्षर)",
        citizen_category_label: "मैन्युअल श्रेणी (वैकल्पिक)",
        citizen_cat_auto: "ऑटो-रूट (अनुशंसित)",
        citizen_cat_financial: "वित्तीय धोखाधड़ी (यूपीआई/बैंक)",
        citizen_cat_women_child: "साइबरटिपलाइन बाल सुरक्षा",
        citizen_cat_women_safety: "महिला सुरक्षा / उत्पीड़न",
        citizen_cat_impersonation: "सोशल मीडिया प्रतिरूपण",
        citizen_cat_hacking: "सिस्टम हैकिंग / रैनसमवेयर",
        citizen_cat_other: "अन्य साइबर अपराध",
        citizen_submit_btn: "शिकायत सबमिट करें",
        citizen_track_title: "शिकायत की स्थिति ट्रैक करें",
        // FIR/Report Crime page
        report_crime_title: "अपराध की रिपोर्ट",
        fir_badge: "FIR",
        fir_subtitle: "धारा 154 Cr.P.C. के अंतर्गत प्रथम सूचना रिपोर्ट",
        back_to_portal: "पोर्टल पर वापस जाएं",
        // Footer translations
        footer_contact: "संपर्क करें",
        footer_privacy: "गोपनीयता नीति",
        footer_rights: "सर्वाधिकार सुरक्षित",
        footer_language: "भाषा:",
        // Dashboard feature cards
        feature_financial_title: "वित्तीय धोखाधड़ी",
        feature_financial_desc: "यूपीआई, एसएमएस, बैंक या क्रेडिट कार्ड धोखाधड़ी रिपोर्ट करें",
        feature_child_title: "बाल सुरक्षा",
        feature_child_desc: "बाल शोषण या ऑनलाइन सुरक्षा चिंताओं की रिपोर्ट करें",
        feature_women_title: "महिला सुरक्षा",
        feature_women_desc: "उत्पीड़न, स्टॉकिंग या डिजिटल दुर्व्यवहार की रिपोर्ट करें",
        feature_fir_title: "FIR दर्ज करें",
        feature_fir_desc: "किसी भी साइबर अपराध Incident के लिए ई-FIR दर्ज करें",
        feature_track_title: "शिकायत ट्रैक करें",
        feature_track_desc: "अपनी दर्ज शिकायत की स्थिति देखें",
        feature_learn_more: "और जानें",
        // Authentication
        auth_title: "लॉगिन",
        auth_register: "रजिस्टर",
        auth_email: "ईमेल पता",
        auth_password: "पासवर्ड",
        auth_forgot: "पासवर्ड भूल गए?",
        auth_or: "या",
        auth_citizen: "नागरिक के रूप में लॉगिन करें",
        auth_police: "पुलिस अधिकारी के रूप में लॉगिन करें",
        auth_no_account: "खाता नहीं है?",
        auth_have_account: "पहले से खाता है?",
        auth_whatsapp: "व्हाट्सएप के माध्यम से लॉगिन",
        auth_aadhar: "आधार के माध्यम से लॉगिन",
        // Form labels
        form_name: "पूरा नाम",
        form_phone: "फोन नंबर",
        form_description: "विवरण",
        form_submit: "सबमिट",
        form_cancel: "रद्द करें",
        form_save: "सहेजें",
        form_next: "आगे",
        form_previous: "पीछे",
        // Track section
        track_heading: "अपना ट्रैकिंग आईडी दर्ज करें",
        track_placeholder: "जैसे, KAN-2026-001234",
        track_button: "अभी ट्रैक करें",
        track_status: "स्थिति",
        track_category: "श्रेणी",
        track_priority: "प्राथमिकता",
        // Financial Fraud page
        financial_badge: "वित्तीय धोखाधड़ी रिपोर्टिंग",
        financial_title_prefix: "रिपोर्ट",
        financial_title_suffix: "वित्तीय धोखाधड़ी",
        financial_description: "यूपीआई धोखाधड़ी, बैंक ट्रांसफर घोटाले, क्रेडिट कार्ड धोखाधड़ी और अन्य वित्तीय साइबर अपराधों की शिकायत दर्ज करें। आपकी रिपोर्ट हमें पैटर्न ट्रैक करने और दूसरों की सुरक्षा करने में मदद करती है।",
        start_complaint: "शिकायत शुरू करें",
        track_existing: "मौजूदा शिकायत ट्रैक करें",
        upi_emergency_title: "यूपीआई धोखाधड़ी आपातकाल",
        upi_emergency_desc: "यदि आपने यूपीआई के माध्यम से पैसे खोए हैं, तो तुरंत <strong>1930</strong> पर कॉल करें। त्वरित रिपोर्ट करने पर बैंक/एनपीसीआई फंड को जमा कर सकते हैं।",
        cyber_helpline_title: "साइबर अपराहेल्पलाइन",
        cyber_helpline_desc: "राष्ट्रीय साइबर अपराध रिपोर्टिंग पोर्टल: <strong>1930</strong> या cybercrime.gov.in पर जाएं",
    },
    gu: {
        tab_auth: "પ્રમાણીકરણ",
        tab_citizen: "નાગરિક પોર્ટલ",
        citizen_file_title: "સાયબર ફરિયાદ નોંધાવો",
        citizen_description_label: "વિગતવાર ઘટના વર્ણન (ઓછામાં ઓછા ૧૦ અક્ષર)",
        citizen_category_label: "મેન્યુઅલ કેટેગરી (વૈકલ્પિક)",
        citizen_cat_auto: "ઓટો-રૂટ (ભલામણ કરેલ)",
        citizen_cat_financial: "નાણાકીય છેતરપિંડી (UPI/બેંક)",
        citizen_cat_women_child: "સાયબરટિપলাইন બાળ સુરક્ષા",
        citizen_cat_women_safety: "મહિલા સુરક્ષા / શિકાર",
        citizen_cat_impersonation: "સોશિયલ મીડિયા ફેક પ્રોફાઇલ",
        citizen_cat_hacking: "સિસ્ટમ હેકિંગ / રેન્સમવેર",
        citizen_cat_other: "અન્ય સાયબર ગુનાઓ",
        citizen_submit_btn: "ફરિયાદ સબમિટ કરો",
        citizen_track_title: "ફરિયાદ સ્થિતિ ટ્રૅક કરો",
        // FIR/Report Crime page
        report_crime_title: "ગુનાની ફરિયાદ",
        fir_badge: "FIR",
        fir_subtitle: "કલમ 154 Cr.P.C. હેઠળ પ્રથમ માહિતી રિપોર્ટ",
        back_to_portal: "પોર્ટલ પર પાછા જાઓ",
        // Footer translations
        footer_contact: "Contact Us",
        footer_privacy: "Privacy Policies",
        footer_rights: "All rights reserved",
        footer_language: "Language:",
        // Dashboard feature cards
        feature_financial_title: "Financial Frauds",
        feature_financial_desc: "Report UPI, SMS, Bank, or Credit Card frauds",
        feature_child_title: "Child Safety",
        feature_child_desc: "Report child exploitation or online safety concerns",
        feature_women_title: "Women Safety",
        feature_women_desc: "Report harassment, stalking, or digital abuse",
        feature_fir_title: "Report FIR",
        feature_fir_desc: "File e-FIR for any cybercrime incident",
        feature_track_title: "Track Complaint",
        feature_track_desc: "Check status of your filed complaint",
        feature_learn_more: "Learn more",
        // Authentication
        auth_title: "Login",
        auth_register: "Register",
        auth_email: "Email Address",
        auth_password: "Password",
        auth_forgot: "Forgot Password?",
        auth_or: "OR",
        auth_citizen: "Sign in as Citizen",
        auth_police: "Sign in as Police Officer",
        auth_no_account: "Don't have an account?",
        auth_have_account: "Already have an account?",
        auth_whatsapp: "Login via WhatsApp",
        auth_aadhar: "Login via Aadhaar",
        // Form labels
        form_name: "Full Name",
        form_phone: "Phone Number",
        form_description: "Description",
        form_submit: "Submit",
        form_cancel: "Cancel",
        form_save: "Save",
        form_next: "Next",
        form_previous: "Previous",
        // Track section
        track_heading: "Enter your tracking ID",
        track_placeholder: "e.g., KAN-2026-001234",
        track_button: "Track Now",
        track_status: "Status",
        track_category: "Category",
        track_priority: "Priority",
        // Financial Fraud page
        financial_badge: "નાણાકીય છેતરપિંડી રિપોર્ટિંગ",
        financial_title_prefix: "ફરિયાદ",
        financial_title_suffix: "નાણાકીય છેતરપિંડી",
        financial_description: "UPI છેતરપિંડી, બેંક ટ્રાન્સફર સ્કેમ, ક્રેડિટ કાર્ડ છેતરપિંડી અને અન્ય નાણાકીય સાયબર ગુનાઓની ફરિયાદ નોંધાવો. તમારી રિપોર્ટ અમને પેટર્ન ટ્રેક કરવામાં અને બીજાને સુરક્ષિત રાખવામાં મદદ કરે છે.",
        start_complaint: "ફરિયાદ શરૂ કરો",
        track_existing: "મૌજૂદા ફરિયાદ ટ્રેક કરો",
        upi_emergency_title: "UPI છેતરપિંડી ઈમરજન્સી",
        upi_emergency_desc: "જો તમે UPI દ્વારા પૈસા ગુમાવ્યા હોય, તો તરત જ <strong>1930</strong> પર કૉલ કરો. ઝડપથી રિપોર્ટ કરવા પર બેંક/એનપીસીઆઈ ફંડ ફ્રીઝ કરી શકે છે.",
        cyber_helpline_title: "સાયબર અપરાધ હેલ્પલાઇન",
        cyber_helpline_desc: "રાષ્ટ્રીય સાયબર અપરાધ રિપોર્ટિંગ પોર્ટલ: <strong>1930</strong> અથવા cybercrime.gov.in મુલાકાત લો",
    }
};

let currentLang = "en";

// ─── LANGUAGE SWITCHER ─────────────────────────────────────────

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('kanad-lang', lang);
    
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[lang] && i18n[lang][key]) {
            // Check if it's an input element
            if (el.tagName === 'INPUT' && el.placeholder !== undefined) {
                if (key.includes('placeholder')) {
                    el.placeholder = i18n[lang][key];
                } else {
                    el.value = i18n[lang][key];
                }
            } else if (el.tagName === 'OPTION') {
                el.text = i18n[lang][key];
            } else {
                el.textContent = i18n[lang][key];
            }
        }
    });
    
    // Update footer links
    const footerLinks = document.querySelectorAll('.app-footer a');
    footerLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === '/contact') {
            link.textContent = i18n[lang].footer_contact || link.textContent;
        } else if (href === '#') {
            link.textContent = i18n[lang].footer_privacy || link.textContent;
        }
    });
    
    // Update footer copyright
    const footerRights = document.querySelector('.app-footer span');
    if (footerRights) {
        footerRights.textContent = `© ${i18n[lang].footer_rights || 'All rights reserved'}`;
    }

    // Update header language selector if exists
    const headerLangSelect = document.getElementById('header-lang-select');
    if (headerLangSelect) {
        headerLangSelect.value = lang;
    }
    
    // Update language selector display
    const langSelect = document.getElementById('footer-lang-select');
    if (langSelect) {
        langSelect.value = lang;
    }
}

// ─── INITIALISATION ───────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
    try {
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
    // Only run on pages with the landing view (index.html)
    if (document.getElementById('view-landing')) {
        switchTab('landing');
        if (currentToken && currentUser) {
            setupAuthUI();
        }
    }

    // Load saved language preference (always run this)
    const savedLang = localStorage.getItem('kanad-lang');
    if (savedLang && i18n[savedLang]) {
        setLanguage(savedLang);
    }

    // Skip citizen-specific initializations on FIR and Fraud complaint pages
    const isFIRPage = document.getElementById('si') && document.getElementById('fc');
    const isFraudPage = document.getElementById('fraud-form') || document.getElementById('upi-fraud-form');
    if (isFIRPage || isFraudPage) {
        // These pages have their own initialization logic
        console.log('Citizen.js: Detected complaint page, skipping citizen-specific init');
        return;
    }

    try {
        lucide.createIcons();
    } catch (e) {
        console.warn('Lucide icons initialization failed:', e);
    }

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

    const childSafetyForm = document.getElementById('child-safety-form');
    if (childSafetyForm) {
        childSafetyForm.addEventListener('submit', handleChildSafetySubmit);
    }

    const womenSafetyForm = document.getElementById('women-safety-form');
    if (womenSafetyForm) {
        womenSafetyForm.addEventListener('submit', handleWomenSafetySubmit);
    }

    const childDanger = document.getElementById('child-feels-danger');
    if (childDanger) {
        childDanger.addEventListener('change', toggleChildDangerBanner);
    }

    const childCategory = document.getElementById('child-category');
    if (childCategory) {
        childCategory.addEventListener('change', () => {
            if (childCategory.value) {
                showAlert('Child safety route ready. Complete the remaining details and submit.', 'success');
            }
        });
    }
    } catch (err) {
        console.error('Citizen.js initialization error:', err);
    }
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

function generateRegisterCaptcha() {
    const canvas = document.getElementById('register-captcha-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    registerCaptchaCode = code;

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

// ─── LOGIN & REGISTER ─────────────────────────────────────

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const captcha = document.getElementById('auth-captcha-input').value.trim();

    if (!email || !password) {
        showAlert('Email and password are required', 'error');
        return;
    }

    if (captcha.toUpperCase() !== currentCaptchaCode) {
        showAlert('Invalid Captcha Code. Please try again.', 'error');
        generateCaptcha();
        document.getElementById('auth-captcha-input').value = '';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/citizen/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Login failed');
        }

        const data = await response.json();
        currentToken = data.access_token;
        currentUser = { email: email };
        
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify({ email: email }));

        showAlert('Login successful! Welcome to ForenSync.', 'success');
        setupAuthUI();
        switchTab('landing');
        generateCaptcha();
        document.getElementById('auth-email').value = '';
        document.getElementById('auth-password').value = '';
    } catch (err) {
        console.error('Login error:', err);
        showAlert(`Login failed: ${err.message}`, 'error');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    console.log("Register button clicked");
    
    const fullName = document.getElementById('register-fullname').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const phone = document.getElementById('register-phone').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const confirmPassword = document.getElementById('register-confirm-password').value.trim();
    const captcha = document.getElementById('register-captcha-input').value.trim();

    console.log("Form values:", { fullName, email, phone, password: '***', confirmPassword: '***', captcha });

    if (!fullName || !email || !phone || !password || !confirmPassword) {
        showAlert('All fields are required', 'error');
        console.log("Missing fields");
        return;
    }

    // Validate CAPTCHA (Government Compliance 🇮🇳)
    if (captcha.toUpperCase() !== registerCaptchaCode) {
        showAlert('Invalid CAPTCHA Code. Please try again.', 'error');
        console.log("CAPTCHA mismatch. Expected:", registerCaptchaCode, "Got:", captcha.toUpperCase());
        generateRegisterCaptcha();
        document.getElementById('register-captcha-input').value = '';
        return;
    }

    if (password !== confirmPassword) {
        showAlert('Passwords do not match', 'error');
        console.log("Passwords do not match");
        return;
    }

    if (password.length < 12) {
        showAlert('Password must be at least 12 characters', 'error');
        console.log("Password too short");
        return;
    }

    // Validate password complexity
    if (!/[A-Z]/.test(password)) {
        showAlert('Password must contain an uppercase letter', 'error');
        return;
    }
    if (!/[a-z]/.test(password)) {
        showAlert('Password must contain a lowercase letter', 'error');
        return;
    }
    if (!/\d/.test(password)) {
        showAlert('Password must contain a digit', 'error');
        return;
    }
    if (!/[^\w\s]/.test(password)) {
        showAlert('Password must contain a special character', 'error');
        return;
    }

    try {
        console.log("Sending registration request...");
        const response = await fetch(`${API_BASE}/api/citizen/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: fullName, email, phone, password })
        });

        console.log("Response status:", response.status);

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Registration failed');
        }

        const data = await response.json();
        console.log("Registration successful:", data);

        showAlert('Registration successful! Verify OTP sent to your email.', 'success');
        
        // Store email for OTP verification
        localStorage.setItem('registerEmail', email);
        localStorage.setItem('registerPhone', phone);
        
        // Show OTP verification form after a successful registration
        showOtpVerificationForm(email);
        
        // Clear register form
        document.getElementById('register-fullname').value = '';
        document.getElementById('register-email').value = '';
        document.getElementById('register-phone').value = '';
        document.getElementById('register-password').value = '';
        document.getElementById('register-confirm-password').value = '';
        document.getElementById('register-captcha-input').value = '';
        generateRegisterCaptcha();
        
    } catch (err) {
        console.error('Register error:', err);
        showAlert(`Registration failed: ${err.message}`, 'error');
    }
}

function generateRegisterOtp() {
    registerOtp = String(Math.floor(100000 + Math.random() * 900000));
    return registerOtp;
}

function showOtpVerificationForm(email) {
    const otpPanel = document.getElementById('register-otp-panel');
    const otpEmail = document.getElementById('register-otp-email');
    const otpInput = document.getElementById('register-otp-input');

    if (!otpPanel || !otpEmail || !otpInput) {
        console.warn('OTP verification UI not found');
        return;
    }

    localStorage.setItem('registerEmail', email);
    registerOtp = generateRegisterOtp();
    otpEmail.textContent = email;
    otpInput.value = '';
    otpPanel.style.display = 'block';
    showMockEmailNotification(email, registerOtp);
    showAlert(`Registration successful! Please verify the OTP sent to ${email}.`, 'success');
}

function sendRegisterOtp() {
    const email = localStorage.getItem('registerEmail') || document.getElementById('register-email').value.trim();
    if (!email) {
        showAlert('No registered email found for OTP resending.', 'error');
        return;
    }

    registerOtp = generateRegisterOtp();
    showMockEmailNotification(email, registerOtp);
    showAlert(`A new OTP has been sent to ${email}.`, 'success');
}

function verifyRegisterOtp() {
    const otpInput = document.getElementById('register-otp-input');
    const otpPanel = document.getElementById('register-otp-panel');
    const enteredOtp = (otpInput?.value || '').trim();
    const registeredEmail = document.getElementById('register-otp-email')?.textContent.trim();

    if (!enteredOtp) {
        showAlert('Please enter the OTP sent to your email.', 'error');
        return;
    }

    if (enteredOtp !== registerOtp) {
        showAlert('Invalid OTP. Please check the code and try again.', 'error');
        return;
    }

    if (otpPanel) otpPanel.style.display = 'none';
    showAlert(`OTP verified for ${registeredEmail || 'your account'}. You can now log in.`, 'success');
    toggleAuthForm();
    document.getElementById('auth-email').value = registeredEmail || '';
    document.getElementById('auth-captcha-input').value = '';
    generateCaptcha();
}

async function openWomenSafetyFlow() {
    switchTab('women-safety');
    const tab = document.getElementById('tab-women-safety');
    if (tab) tab.style.display = 'inline-flex';
    const list = document.getElementById('women-safety-resources-list');
    if (list) {
        list.innerHTML = '';
        list.style.display = 'none';
    }
    try {
        await fetch(`${API_BASE}/api/women-safety/resources`);
    } catch (err) {
        console.error('Women safety resources error:', err);
    }
}

async function openChildSafetyFlow() {
    switchTab('child-safety');
    const tab = document.getElementById('tab-child-safety');
    if (tab) tab.style.display = 'inline-flex';
    await loadChildSafetyResources();
}

function toggleChildSafetyLearnMore() {
    const panel = document.getElementById('child-safety-learn-more');
    if (!panel) return;
    panel.classList.toggle('visible');
}

async function loadChildSafetyResources() {
    try {
        const response = await fetch(`${API_BASE}/api/child-safety/resources`);
        if (!response.ok) throw new Error('Unable to load child safety resources');
        const data = await response.json();
        const select = document.getElementById('child-category');
        if (!select) return;
        select.innerHTML = '<option value="">Select</option>' + data.categories.map(category => 
            `<option value="${category.key}">${category.label}</option>`
        ).join('');
    } catch (err) {
        console.error('Child safety resources error:', err);
        showAlert('Child safety resources could not be loaded. Please try again later.', 'error');
    }
}

function toggleChildDangerBanner() {
    const danger = document.getElementById('child-feels-danger');
    const banner = document.getElementById('child-danger-banner');
    if (!danger || !banner) return;
    banner.style.display = danger.value === 'yes' ? 'block' : 'none';
}

async function handleChildSafetySubmit(event) {
    event.preventDefault();
    const form = event.target;
    const payload = {
        is_anonymous: document.getElementById('child-anonymous').checked,
        reporter_name: document.getElementById('child-reporter-name').value.trim() || null,
        reporter_email: document.getElementById('child-reporter-email').value.trim() || null,
        reporter_phone: document.getElementById('child-reporter-phone').value.trim() || null,
        screening: {
            reporting_for: document.getElementById('child-reporting-for').value,
            recency: document.getElementById('child-recency').value,
            incident_datetime: document.getElementById('child-incident-datetime').value || null,
            time_zone: 'IST (UTC+5:30)',
            frequency: document.getElementById('child-frequency').value,
            location_type: document.getElementById('child-location-type').value,
            category_key: document.getElementById('child-category').value,
            feels_in_danger: document.getElementById('child-feels-danger').value,
        },
        victim_name: document.getElementById('child-victim-name').value.trim() || null,
        victim_age: document.getElementById('child-victim-age').value ? Number(document.getElementById('child-victim-age').value) : null,
        victim_identity_unknown: !document.getElementById('child-victim-name').value.trim(),
        platform: document.getElementById('child-platform').value.trim() || null,
        urls_handles: document.getElementById('child-urls-handles').value.trim() || null,
        suspect_name: null,
        suspect_handle: null,
        suspect_relationship: null,
        narrative: document.getElementById('child-narrative').value.trim() || null,
    };

    if (!payload.screening.reporting_for || !payload.screening.recency || !payload.screening.frequency || !payload.screening.location_type || !payload.screening.category_key || !payload.screening.feels_in_danger) {
        showAlert('Please complete all required child safety fields.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/child-safety/reports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Unable to submit report');
        }

        const successPanel = document.getElementById('child-safety-success');
        const refEl = document.getElementById('child-safety-reference');
        const msgEl = document.getElementById('child-safety-message');
        successPanel.style.display = 'block';
        refEl.textContent = `Reference ID: ${data.reference_id}`;
        msgEl.textContent = data.message;
        form.reset();
        toggleChildDangerBanner();
        showAlert('Child safety report submitted successfully.', 'success');
    } catch (err) {
        console.error('child safety submit error:', err);
        showAlert(err.message || 'Failed to submit child safety report.', 'error');
    }
}

async function handleWomenSafetySubmit(event) {
    event.preventDefault();
    const payload = {
        incident_type: document.getElementById('women-incident-type').value,
        incident_datetime: document.getElementById('women-incident-datetime').value || null,
        incident_location: document.getElementById('women-incident-location').value,
        platform: document.getElementById('women-platform').value.trim() || null,
        description: document.getElementById('women-description').value.trim(),
        evidence_links: document.getElementById('women-evidence-links').value.trim() || null,
        evidence_notes: document.getElementById('women-evidence-notes').value.trim() || null,
        reporter_name: document.getElementById('women-reporter-name').value.trim() || null,
        reporter_email: document.getElementById('women-reporter-email').value.trim() || null,
        reporter_phone: document.getElementById('women-reporter-phone').value.trim() || null,
        report_relation: document.getElementById('women-report-relation').value.trim() || null,
        suspect_name: document.getElementById('women-suspect-name').value.trim() || null,
        suspect_handle: document.getElementById('women-suspect-handle').value.trim() || null,
        suspect_relationship: document.getElementById('women-suspect-relationship').value.trim() || null,
        victim_name: document.getElementById('women-victim-name').value.trim() || null,
        narrative: document.getElementById('women-description').value.trim(),
        is_anonymous: document.getElementById('women-anonymous').checked,
        schema_version: 'fir_citizen_intake_v1',
        form_payload: {
            incident_type: document.getElementById('women-incident-type').value,
            incident_datetime: document.getElementById('women-incident-datetime').value || null,
            incident_location: document.getElementById('women-incident-location').value,
            platform: document.getElementById('women-platform').value.trim() || null,
            victim_name: document.getElementById('women-victim-name').value.trim() || null,
            report_relation: document.getElementById('women-report-relation').value.trim() || null,
            suspect_name: document.getElementById('women-suspect-name').value.trim() || null,
            suspect_handle: document.getElementById('women-suspect-handle').value.trim() || null,
            suspect_relationship: document.getElementById('women-suspect-relationship').value.trim() || null,
            description: document.getElementById('women-description').value.trim(),
            evidence_links: document.getElementById('women-evidence-links').value.trim() || null,
            evidence_notes: document.getElementById('women-evidence-notes').value.trim() || null,
            reporter_name: document.getElementById('women-reporter-name').value.trim() || null,
            reporter_email: document.getElementById('women-reporter-email').value.trim() || null,
            reporter_phone: document.getElementById('women-reporter-phone').value.trim() || null,
            is_anonymous: document.getElementById('women-anonymous').checked,
        }
    };

    if (!payload.incident_type || !payload.incident_datetime || !payload.incident_location || !payload.description) {
        showAlert('Please complete the required women safety fields before submitting.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/women-safety/reports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Unable to submit women safety report');
        }
        showAlert(`Women safety report submitted. Reference ID: ${data.reference_id}`, 'success');
        event.target.reset();
    } catch (err) {
        console.error('women safety submit error:', err);
        showAlert(err.message || 'Failed to submit women safety report.', 'error');
    }
}

function toggleAuthForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        generateCaptcha();
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        generateRegisterCaptcha();
    }
}

function sendEmailOtp() {
    showAlert('OTP-based authentication is deprecated. Please use direct login.', 'warning');
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
            Your OTP for citizen verification on ForenSync Cyber Portal is <strong style="color: #38bdf8; font-size: 15px; letter-spacing: 2px;">${otp}</strong>.
            <div style="margin-top: 10px; display: flex; gap: 8px;">
                <button onclick="if(document.getElementById('register-otp-input')){document.getElementById('register-otp-input').value='${otp}';} if(document.getElementById('auth-otp-input')){document.getElementById('auth-otp-input').value='${otp}';} this.parentElement.parentElement.parentElement.remove();" style="background: #0284c7; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer;">Auto-Fill OTP</button>
            </div>
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
        return;
    }

    if (option === 'child_safety') {
        openChildSafetyFlow();
        return;
    }

    if (option === 'women_safety') {
        openWomenSafetyFlow();
        return;
    }

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
    } else if (cat === "women_safety") {
        fieldsDiv.innerHTML = `
            <div class="form-group"><label>Type of Women Safety Issue</label>
            <select id="follow-women-issue" class="form-control">
                <option value="">Select</option>
                <option value="online_harassment">Online harassment</option>
                <option value="stalking">Stalking</option>
                <option value="blackmail">Blackmail / extortion</option>
                <option value="impersonation">Impersonation</option>
                <option value="other">Other</option>
            </select></div>
            <div class="form-group"><label>Platform or Contact Channel</label>
            <input type="text" id="follow-women-platform" class="form-control" placeholder="e.g. WhatsApp, Instagram, email, phone"></div>`;
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
