/**
 * Fraud Complaint Form JavaScript
 * Handles multi-step form, dynamic fields, and API integration
 */

// Configuration
const API_BASE_URL = window.location.origin;
let currentStep = 1;
const totalSteps = 7;
let configData = null;
let transactionCount = 0;
let subjectCount = 0;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    lucide.createIcons();
    loadConfig();
    setupEventListeners();
    updateStepIndicator();
    setupStepClickNavigation();
});

// Load configuration from backend
async function loadConfig() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/fraud-complaints/config`);
        if (response.ok) {
            configData = await response.json();
            populateDropdowns();
        }
    } catch (error) {
        console.error('Failed to load config:', error);
        // Use default data if API fails
        configData = {
            countries: ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Other'],
            states: ['Delhi', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'West Bengal', 'Telangana', 'Gujarat', 'Other'],
            critical_infrastructure: {
                'Energy': ['Power Generation', 'Power Distribution', 'Oil & Gas'],
                'Transportation': ['Airports', 'Railways', 'Roadways', 'Ports'],
                'Telecommunications': ['Mobile Networks', 'Internet Services', 'Satellite'],
                'Financial': ['Banking', 'Insurance', 'Stock Markets'],
                'Healthcare': ['Hospitals', 'Pharmaceuticals', 'Medical Devices']
            }
        };
        populateDropdowns();
    }
}

// Populate dropdowns with config data
function populateDropdowns() {
    if (!configData) return;

    // Countries
    const countrySelect = document.getElementById('country');
    if (countrySelect) {
        countrySelect.innerHTML = '<option value="">Select country</option>';
        const countries = configData.countries || ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Other'];
        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            countrySelect.appendChild(option);
        });
    }

    // States (for India)
    const stateSelect = document.getElementById('state');
    if (stateSelect) {
        stateSelect.innerHTML = '<option value="">Select state</option>';
        const states = configData.states || ['Delhi', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'West Bengal', 'Telangana', 'Gujarat', 'Other'];
        states.forEach(state => {
            const option = document.createElement('option');
            option.value = state;
            option.textContent = state;
            stateSelect.appendChild(option);
        });
    }

    // Critical Infrastructure Sectors
    const sectorSelect = document.getElementById('critical-infra-sector');
    if (sectorSelect && configData.critical_infrastructure) {
        Object.keys(configData.critical_infrastructure).forEach(sector => {
            const option = document.createElement('option');
            option.value = sector;
            option.textContent = sector;
            sectorSelect.appendChild(option);
        });
    }
}

// Setup event listeners
function setupEventListeners() {
    // Form submission
    const form = document.getElementById('fraud-complaint-form');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    // Character count for description
    const description = document.getElementById('incident-description');
    if (description) {
        description.addEventListener('input', function() {
            const count = this.value.length;
            const countEl = document.getElementById('description-count');
            if (countEl) countEl.textContent = count;
        });
    }
}

// Step click navigation - allows clicking on step badges to navigate
function setupStepClickNavigation() {
    const stepBadges = document.querySelectorAll('.step-badge');
    stepBadges.forEach(badge => {
        badge.style.cursor = 'pointer';
        badge.addEventListener('click', function() {
            const step = parseInt(this.dataset.step);
            if (step && step >= 1 && step <= totalSteps) {
                // Only allow navigation to completed steps or current step + 1
                if (step <= currentStep + 1) {
                    goToStep(step);
                }
            }
        });
    });
}

// Go to specific step
function goToStep(step) {
    if (step < 1 || step > totalSteps) return;
    
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(s => {
        s.classList.remove('active');
    });
    
    // Show target step
    const targetStep = document.querySelector(`.form-step[data-step="${step}"]`);
    if (targetStep) {
        targetStep.classList.add('active');
        currentStep = step;
        updateStepIndicator();
        updateNavigationButtons();
    }
}

// Update step indicator
function updateStepIndicator() {
    const badges = document.querySelectorAll('.step-badge');
    badges.forEach((badge, index) => {
        const stepNum = index + 1;
        badge.classList.remove('active', 'completed');
        
        if (stepNum === currentStep) {
            badge.classList.add('active');
        } else if (stepNum < currentStep) {
            badge.classList.add('completed');
        }
    });
}

// Update navigation buttons
function updateNavigationButtons() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');
    
    if (prevBtn) {
        prevBtn.style.display = currentStep === 1 ? 'none' : 'inline-flex';
    }
    
    if (nextBtn && submitBtn) {
        if (currentStep === totalSteps) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'inline-flex';
        } else {
            nextBtn.style.display = 'inline-flex';
            submitBtn.style.display = 'none';
        }
    }
}

// Next step
function nextStep() {
    if (validateCurrentStep()) {
        goToStep(currentStep + 1);
    }
}

// Previous step
function prevStep() {
    goToStep(currentStep - 1);
}

// Validate current step
function validateCurrentStep() {
    const currentStepEl = document.querySelector(`.form-step[data-step="${currentStep}"]`);
    if (!currentStepEl) return true;
    
    const requiredFields = currentStepEl.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.style.borderColor = '#ef4444';
            isValid = false;
        } else {
            field.style.borderColor = '';
        }
    });
    
    if (!isValid) {
        showAlert('Please fill in all required fields', 'error');
    }
    
    return isValid;
}

// Toggle filer fields
function toggleFilerFields() {
    const isComplainant = document.getElementById('filer-is-complainant')?.value === 'true';
    const complainantName = document.getElementById('complainant-name');
    const complainantPhone = document.getElementById('complainant-phone');
    const complainantEmail = document.getElementById('complainant-email');
    
    if (isComplainant) {
        const filerName = document.getElementById('filer-name')?.value;
        const filerPhone = document.getElementById('filer-phone')?.value;
        const filerEmail = document.getElementById('filer-email')?.value;
        
        if (complainantName) complainantName.value = filerName || '';
        if (complainantPhone) complainantPhone.value = filerPhone || '';
        if (complainantEmail) complainantEmail.value = filerEmail || '';
    }
}

// Toggle state field based on country
function toggleStateField() {
    const country = document.getElementById('country')?.value;
    const stateField = document.getElementById('state-field');
    
    if (stateField) {
        if (country === 'India') {
            stateField.classList.add('visible');
            document.getElementById('state').required = true;
        } else {
            stateField.classList.remove('visible');
            document.getElementById('state').required = false;
        }
    }
}

// Toggle business fields
function toggleBusinessFields() {
    const isBusiness = document.getElementById('on-behalf-of-business')?.value === 'true';
    const businessFields = document.getElementById('business-fields');
    
    if (businessFields) {
        if (isBusiness) {
            businessFields.classList.add('visible');
            document.getElementById('business-name').required = true;
            document.getElementById('business-ops-impacted').required = true;
        } else {
            businessFields.classList.remove('visible');
            document.getElementById('business-name').required = false;
            document.getElementById('business-ops-impacted').required = false;
        }
    }
}

// Toggle money fields
function toggleMoneyFields() {
    const moneyLost = document.getElementById('money-lost')?.value === 'true';
    const moneyFields = document.getElementById('money-fields');
    
    if (moneyFields) {
        if (moneyLost) {
            moneyFields.classList.add('visible');
            document.getElementById('total-loss-amount').required = true;
        } else {
            moneyFields.classList.remove('visible');
            document.getElementById('total-loss-amount').required = false;
        }
    }
}

// Toggle previous complaint field
function togglePreviousComplaint() {
    const isUpdate = document.getElementById('is-update')?.value === 'true';
    const prevField = document.getElementById('previous-complaint-field');
    
    if (prevField) {
        if (isUpdate) {
            prevField.classList.add('visible');
            document.getElementById('previous-complaint-number').required = true;
        } else {
            prevField.classList.remove('visible');
            document.getElementById('previous-complaint-number').required = false;
        }
    }
}

// Update subsectors based on sector selection
function updateSubsectors() {
    const sector = document.getElementById('critical-infra-sector')?.value;
    const subsectorField = document.getElementById('subsector-field');
    const subsectorSelect = document.getElementById('critical-infra-subsector');
    
    if (!sector || !subsectorSelect) return;
    
    // Clear existing options
    subsectorSelect.innerHTML = '<option value="">Select subsector</option>';
    
    if (configData && configData.critical_infrastructure && configData.critical_infrastructure[sector]) {
        subsectorField.style.display = 'block';
        configData.critical_infrastructure[sector].forEach(subsector => {
            const option = document.createElement('option');
            option.value = subsector;
            option.textContent = subsector;
            subsectorSelect.appendChild(option);
        });
    } else {
        subsectorField.style.display = 'none';
    }
}

// Add transaction
function addTransaction() {
    transactionCount++;
    const container = document.getElementById('transactions-container');
    
    const transactionDiv = document.createElement('div');
    transactionDiv.className = 'transaction-block';
    transactionDiv.id = `transaction-${transactionCount}`;
    transactionDiv.innerHTML = `
        <h4>Transaction ${transactionCount}</h4>
        <div class="form-group">
            <label>Transaction Type <span style="color: #ef4444;">*</span></label>
            <select id="transaction-type-${transactionCount}" class="form-control" required>
                <option value="">Select</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit_card">Credit Card</option>
                <option value="debit_card">Debit Card</option>
                <option value="wallet">Digital Wallet</option>
                <option value="other">Other</option>
            </select>
        </div>
        <div class="form-group">
            <label>Amount (INR) <span style="color: #ef4444;">*</span></label>
            <input type="number" id="transaction-amount-${transactionCount}" class="form-control" placeholder="Amount" min="0" step="0.01" required>
        </div>
        <div class="form-group">
            <label>Date <span style="color: #ef4444;">*</span></label>
            <input type="date" id="transaction-date-${transactionCount}" class="form-control" required>
        </div>
        <div class="form-group">
            <label>Transaction ID / Reference</label>
            <input type="text" id="transaction-id-${transactionCount}" class="form-control" placeholder="Transaction ID">
        </div>
        <button type="button" class="btn-remove" onclick="removeTransaction(${transactionCount})">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Remove
        </button>
    `;
    
    container.appendChild(transactionDiv);
    lucide.createIcons();
}

// Remove transaction
function removeTransaction(id) {
    const transaction = document.getElementById(`transaction-${id}`);
    if (transaction) {
        transaction.remove();
    }
}

// Add subject
function addSubject() {
    subjectCount++;
    const container = document.getElementById('subjects-container');
    
    const subjectDiv = document.createElement('div');
    subjectDiv.className = 'subject-block';
    subjectDiv.id = `subject-${subjectCount}`;
    subjectDiv.innerHTML = `
        <h4>Subject ${subjectCount}</h4>
        <div class="form-group">
            <label>Name</label>
            <input type="text" id="subject-name-${subjectCount}" class="form-control" placeholder="Subject name">
        </div>
        <div class="form-group">
            <label>Phone Number</label>
            <input type="tel" id="subject-phone-${subjectCount}" class="form-control" placeholder="Phone number">
        </div>
        <div class="form-group">
            <label>Email</label>
            <input type="email" id="subject-email-${subjectCount}" class="form-control" placeholder="Email address">
        </div>
        <div class="form-group">
            <label>Description</label>
            <textarea id="subject-desc-${subjectCount}" class="form-control" rows="2" placeholder="Description of subject"></textarea>
        </div>
        <button type="button" class="btn-remove" onclick="removeSubject(${subjectCount})">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Remove
        </button>
    `;
    
    container.appendChild(subjectDiv);
    lucide.createIcons();
}

// Remove subject
function removeSubject(id) {
    const subject = document.getElementById(`subject-${id}`);
    if (subject) {
        subject.remove();
    }
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!validateCurrentStep()) return;
    
    const formData = collectFormData();
    
    // Debug log
    console.log('Submitting complaint:', formData);
    console.log('DigiLocker token:', formData.digilocker_verify_token);
    console.log('DigiLocker verified:', formData.digilocker_verified);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/fraud-complaints`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            const result = await response.json();
            showSuccessMessage(result.reference_id);
        } else {
            const errorText = await response.text();
            console.error('Server error:', response.status, errorText);
            let error;
            try {
                error = JSON.parse(errorText);
            } catch (e) {
                error = { detail: errorText };
            }
            showAlert(error.detail || 'Failed to submit complaint', 'error');
        }
    } catch (error) {
        console.error('Submission error:', error);
        showAlert('Network error. Please try again.', 'error');
    }
}

// Collect form data - FIXED to match backend schema
collectFormData = function() {
    const transactions = [];
    document.querySelectorAll('.transaction-block').forEach(block => {
        const id = block.id.split('-')[1];
        const amount = parseFloat(document.getElementById(`transaction-amount-${id}`)?.value) || null;
        transactions.push({
            transaction_type: document.getElementById(`transaction-type-${id}`)?.value || null,
            money_sent: amount > 0,
            amount: amount,
            transaction_date: document.getElementById(`transaction-date-${id}`)?.value || null,
            contacted_bank: false,
            utr_number: document.getElementById(`transaction-id-${id}`)?.value || null,
            upi_app: document.getElementById(`transaction-upi-app-${id}`)?.value || null
        });
    });
    
    const subjects = [];
    document.querySelectorAll('.subject-block').forEach(block => {
        const id = block.id.split('-')[1];
        subjects.push({
            name: document.getElementById(`subject-name-${id}`)?.value || null,
            phone: document.getElementById(`subject-phone-${id}`)?.value || null,
            email: document.getElementById(`subject-email-${id}`)?.value || null,
            business_name: null, address: null, address_2: null, suite_apt: null,
            city: null, country: null, state: null, zip_code: null, website_social: null, ip_address: null
        });
    });
    
    const data = {
        filer_is_complainant: document.getElementById('filer-is-complainant')?.value === 'true',
        filer_name: document.getElementById('filer-name')?.value || '',
        filer_phone: document.getElementById('filer-phone')?.value || '',
        filer_email: document.getElementById('filer-email')?.value || '',
        filer_business_name: document.getElementById('filer-business-name')?.value || null,
        complainant_name: document.getElementById('complainant-name')?.value || '',
        complainant_age: document.getElementById('complainant-age')?.value || null,
        is_minor: document.getElementById('is-minor')?.value === 'true',
        address: document.getElementById('address')?.value || '',
        address_2: document.getElementById('address-2')?.value || null,
        suite_apt: document.getElementById('suite-apt')?.value || null,
        city: document.getElementById('city')?.value || '',
        county: document.getElementById('county')?.value || null,
        state: document.getElementById('state')?.value || null,
        country: document.getElementById('country')?.value || 'India',
        zip_code: document.getElementById('zip-code')?.value || '',
        complainant_phone: document.getElementById('complainant-phone')?.value || '',
        complainant_email: document.getElementById('complainant-email')?.value || '',
        on_behalf_of_business: document.getElementById('on-behalf-of-business')?.value === 'true',
        business_name: document.getElementById('business-name')?.value || null,
        business_ops_impacted: document.getElementById('business-ops-impacted')?.value === 'true' || null,
        business_it_poc: document.getElementById('business-it-poc')?.value || null,
        business_other_poc: document.getElementById('business-other-poc')?.value || null,
        critical_infra_sector: document.getElementById('critical-infra-sector')?.value || null,
        critical_infra_subsector: document.getElementById('critical-infra-subsector')?.value || null,
        money_lost: document.getElementById('money-lost')?.value === 'true',
        total_loss_amount: parseFloat(document.getElementById('total-loss-amount')?.value) || null,
        transactions: transactions,
        subjects: subjects,
        incident_description: document.getElementById('incident-description')?.value || '',
        technical_details: document.getElementById('technical-details')?.value || null,
        other_witnesses: document.getElementById('other-witnesses')?.value || null,
        reported_elsewhere: document.getElementById('reported-elsewhere')?.value || null,
        is_update: document.getElementById('is-update')?.value === 'true',
        previous_complaint_number: document.getElementById('previous-complaint-number')?.value || null
    };
    
    data.digilocker_verify_token = digilockerVerifyToken;
    data.digilocker_verified = digilockerVerified;
    return data;
};

// Show success message
function showSuccessMessage(referenceId) {
    const form = document.getElementById('fraud-complaint-form');
    const successDiv = document.getElementById('fraud-success-message');
    
    if (form) form.style.display = 'none';
    if (successDiv) {
        successDiv.style.display = 'block';
        document.getElementById('fraud-reference-id').textContent = referenceId;
    }
}

// Track fraud complaint
function trackFraudComplaint() {
    const modal = document.getElementById('track-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

// Close track modal
function closeTrackModal() {
    const modal = document.getElementById('track-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Search fraud complaint
async function searchFraudComplaint() {
    const referenceId = document.getElementById('track-reference-id')?.value?.trim();
    
    if (!referenceId) {
        showAlert('Please enter a reference ID', 'error');
        return;
    }
    
    console.log('Tracking complaint:', referenceId);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/fraud-complaints/${referenceId}`);
        const resultDiv = document.getElementById('track-result');
        
        console.log('Track response:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Track data:', data);
            resultDiv.innerHTML = `
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 8px; padding: 16px;">
                    <h4 style="color: #10b981; margin-bottom: 12px;">Complaint Found</h4>
                    <p><strong>Reference ID:</strong> ${data.reference_id}</p>
                    <p><strong>Status:</strong> ${data.status}</p>
                    <p><strong>Priority:</strong> ${data.priority || 'N/A'}</p>
                    <p><strong>Loss Amount:</strong> ₹${data.total_loss_amount || 0}</p>
                    <p><strong>Submitted:</strong> ${new Date(data.submitted_at).toLocaleDateString()}</p>
                </div>
            `;
            resultDiv.style.display = 'block';
        } else {
            const errorText = await response.text();
            console.error('Track error:', response.status, errorText);
            resultDiv.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 8px; padding: 16px;">
                    <p style="color: #ef4444; margin: 0;">Complaint not found (${response.status}). Please check your reference ID.</p>
                </div>
            `;
            resultDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Search error:', error);
        showAlert('Network error. Please try again.', 'error');
    }
}

// Show alert
function showAlert(message, type = 'info') {
    const banner = document.getElementById('alert-banner');
    if (!banner) return;
    
    banner.textContent = message;
    banner.className = `alert-feedback ${type}`;
    banner.style.display = 'block';
    
    setTimeout(() => {
        banner.style.display = 'none';
    }, 5000);
}

// Close modal on outside click
document.addEventListener('click', function(e) {
    const modal = document.getElementById('track-modal');
    if (e.target === modal) {
        closeTrackModal();
    }
});

// ============================================================
// DIGILOCKER VERIFICATION FUNCTIONS
// ============================================================

let digilockerVerifyToken = null;
let digilockerVerified = false;

// Start DigiLocker verification
async function startDigiLockerVerification() {
    const aadhaarInput = document.getElementById('aadhaar-number');
    const mobileInput = document.getElementById('digilocker-mobile');
    
    // Validate inputs
    const aadhaar = aadhaarInput?.value?.trim();
    const mobile = mobileInput?.value?.trim();
    
    if (!aadhaar || !/^\d{12}$/.test(aadhaar)) {
        showAlert('Please enter a valid 12-digit Aadhaar number', 'error');
        return;
    }
    
    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
        showAlert('Please enter a valid 10-digit mobile number', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/digilocker/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            digilockerVerifyToken = data.verify_token;
            
            // Store token in hidden field
            const tokenField = document.getElementById('digilocker-verify-token');
            if (tokenField) tokenField.value = digilockerVerifyToken;
            
            if (data.simulated) {
                // Show OTP section for simulated mode
                document.getElementById('digilocker-otp-section').style.display = 'block';
                document.getElementById('start-digilocker-btn').style.display = 'none';
                const otpInput = document.getElementById('digilocker-otp');
                if (otpInput) otpInput.value = '123456';
                showAlert('DigiLocker Demo: OTP 123456 generated and filled. Click Verify to continue.', 'info');
            } else {
                // Real DigiLocker - open authorization URL
                if (data.authorization_url) {
                    window.open(data.authorization_url, '_blank', 'width=600,height=700');
                    // Start polling for status
                    startStatusPolling();
                }
            }
        } else {
            const error = await response.json();
            showAlert(error.detail || 'Failed to start verification', 'error');
        }
    } catch (error) {
        console.error('DigiLocker start error:', error);
        showAlert('Network error. Please try again.', 'error');
    }
}

// Complete DigiLocker verification (for simulated mode)
async function completeDigiLockerVerification() {
    const otpInput = document.getElementById('digilocker-otp');
    const otp = otpInput?.value?.trim();
    
    if (!otp || !/^\d{6}$/.test(otp)) {
        showAlert('Please enter a valid 6-digit OTP', 'error');
        return;
    }
    
    if (!digilockerVerifyToken) {
        showAlert('Verification session expired. Please start again.', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/digilocker/simulate-complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                verify_token: digilockerVerifyToken,
                otp: otp
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            digilockerVerified = true;
            
            // Show success section
            document.getElementById('digilocker-otp-section').style.display = 'none';
            document.getElementById('digilocker-success-section').style.display = 'block';
            document.getElementById('verified-name').textContent = data.verified_name || 'Verified Citizen';
            
            showAlert('Identity verified successfully!', 'success');
        } else {
            const error = await response.json();
            showAlert(error.detail || 'Invalid OTP. Please try again.', 'error');
        }
    } catch (error) {
        console.error('DigiLocker complete error:', error);
        showAlert('Network error. Please try again.', 'error');
    }
}

// Poll for verification status (for real DigiLocker)
function startStatusPolling() {
    const pollInterval = setInterval(async () => {
        if (!digilockerVerifyToken) {
            clearInterval(pollInterval);
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/digilocker/status/${digilockerVerifyToken}`);
            if (response.ok) {
                const data = await response.json();
                
                if (data.status === 'verified') {
                    clearInterval(pollInterval);
                    digilockerVerified = true;
                    
                    // Show success section
                    document.getElementById('digilocker-otp-section').style.display = 'none';
                    document.getElementById('digilocker-success-section').style.display = 'block';
                    document.getElementById('verified-name').textContent = data.verified_name || 'Verified Citizen';
                    
                    showAlert('Identity verified successfully!', 'success');
                } else if (data.status === 'failed' || data.status === 'expired') {
                    clearInterval(pollInterval);
                    showAlert('Verification failed. Please try again.', 'error');
                }
            }
        } catch (error) {
            console.error('Status poll error:', error);
        }
    }, 3000); // Poll every 3 seconds
    
    // Stop polling after 5 minutes
    setTimeout(() => {
        clearInterval(pollInterval);
    }, 300000);
}

// Override validateCurrentStep to check DigiLocker verification on Step 7
const originalValidateCurrentStep = validateCurrentStep;
validateCurrentStep = function() {
    if (currentStep === 7) {
        // Check if DigiLocker verification is complete
        if (!digilockerVerified) {
            showAlert('Please complete DigiLocker identity verification before submitting', 'error');
            return false;
        }
    }
    return originalValidateCurrentStep();
};

// Note: collectFormData now includes DigiLocker token directly in the function definition above
