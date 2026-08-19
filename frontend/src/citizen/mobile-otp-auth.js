/**
 * Mobile OTP Authentication for Financial Fraud Portal
 */

// Mobile OTP state
let mobileOtpTimer = null;
let currentMobileOtpPhone = "";
let mobileCaptchaCode = "";

async function sendMobileOtp() {
    const phone = document.getElementById("auth-mobile")?.value?.trim();
    const captcha = document.getElementById("mobile-captcha-input")?.value?.trim();
    
    if (!/^[6-9]\d{9}$/.test(phone)) {
        showAlert("Enter valid 10-digit mobile number", "error");
        return;
    }
    if (!validateMobileCaptcha(captcha)) {
        showAlert("Invalid CAPTCHA", "error");
        generateMobileCaptcha();
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/citizen/auth/mobile/send-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: phone })
        });
        const data = await response.json();
        if (response.ok) {
            currentMobileOtpPhone = phone;
            showMobileOtpPanel();
            startMobileOtpTimer();
            showAlert(`OTP sent to +91-${phone}`, "success");
        } else throw new Error(data.detail);
    } catch (e) {
        showAlert(e.message, "error");
    }
}

function showMobileOtpPanel() {
    const s1 = document.getElementById("mobile-auth-step-1");
    const s2 = document.getElementById("mobile-auth-step-2");
    if (s1) s1.style.display = "none";
    if (s2) s2.style.display = "block";
    const disp = document.getElementById("mobile-otp-display-phone");
    if (disp) disp.textContent = `+91-${currentMobileOtpPhone}`;
}

function startMobileOtpTimer() {
    const div = document.getElementById("mobile-otp-timer");
    if (!div) return;
    let t = 60;
    if (mobileOtpTimer) clearInterval(mobileOtpTimer);
    div.innerHTML = `Resend in ${t}s`;
    mobileOtpTimer = setInterval(() => {
        t--;
        if (t <= 0) {
            clearInterval(mobileOtpTimer);
            div.innerHTML = `<a href="#" onclick="resendMobileOtp(); return false;" style="color:var(--neon-cyan);">Resend</a>`;
        } else div.innerHTML = `Resend in ${t}s`;
    }, 1000);
}

async function resendMobileOtp() {
    if (!currentMobileOtpPhone) return;
    try {
        const response = await fetch(`${API_BASE}/api/citizen/auth/mobile/send-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: currentMobileOtpPhone })
        });
        if (response.ok) {
            startMobileOtpTimer();
            showAlert("New OTP sent", "success");
        }
    } catch (e) {
        showAlert("Failed to resend", "error");
    }
}

async function verifyMobileOtp() {
    const otp = document.getElementById("mobile-otp-input")?.value?.trim();
    if (!/^\d{6}$/.test(otp)) {
        showAlert("Enter 6-digit OTP", "error");
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/api/citizen/auth/mobile/verify-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: currentMobileOtpPhone, otp: otp }),
            credentials: "include"
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem("token", data.access_token);
            localStorage.setItem("user", JSON.stringify(data.user));
            if (typeof currentToken !== "undefined") currentToken = data.access_token;
            if (typeof currentUser !== "undefined") currentUser = data.user;
            if (typeof setupAuthUI === "function") setupAuthUI();
            showAlert("Login successful!", "success");
            window.location.href = "/frontend/src/citizen/fraud-complaint.html";
        } else throw new Error(data.detail);
    } catch (e) {
        showAlert(e.message, "error");
    }
}

function generateMobileCaptcha() {
    const cvs = document.getElementById("mobile-captcha-canvas");
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    mobileCaptchaCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    ctx.fillStyle = "#f8fafc"; ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.font = "bold 24px monospace"; ctx.fillStyle = "#1e293b";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(mobileCaptchaCode, cvs.width/2, cvs.height/2);
}

function validateMobileCaptcha(v) {
    return (v || "").toUpperCase() === mobileCaptchaCode;
}

function backToMobileInput() {
    const s1 = document.getElementById("mobile-auth-step-1");
    const s2 = document.getElementById("mobile-auth-step-2");
    if (mobileOtpTimer) clearInterval(mobileOtpTimer);
    if (s1) s1.style.display = "block";
    if (s2) s2.style.display = "none";
}

function switchAuthTab(tab) {
    const mobile = document.getElementById("mobile-auth-panel");
    const email = document.getElementById("email-auth-panel");
    const mBtn = document.getElementById("tab-mobile");
    const eBtn = document.getElementById("tab-email");
    if (tab === "mobile") {
        if (mobile) mobile.style.display = "block";
        if (email) email.style.display = "none";
        if (mBtn) mBtn.classList.add("active");
        if (eBtn) eBtn.classList.remove("active");
        generateMobileCaptcha();
    } else {
        if (mobile) mobile.style.display = "none";
        if (email) email.style.display = "block";
        if (mBtn) mBtn.classList.remove("active");
        if (eBtn) eBtn.classList.add("active");
    }
}
