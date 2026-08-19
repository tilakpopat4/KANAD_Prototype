/**
 * FIR Complaint Handler - NCRB I.I.F.-I Schema
 */
const FIR_API_BASE = window.location.origin;
let currentStep = 1, totalSteps = 8;
let configData = null;
let accusedCount = 0, propertyCount = 0, victimCount = 0;
const stepLabels = ['You', 'When', 'Where', 'What', 'Accused', 'Property', 'Victim', 'Verify'];

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('FIR complaint: DOMContentLoaded fired');
        
        // Initialize Lucide icons if available
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            try {
                lucide.createIcons();
            } catch (e) {
                console.warn('Lucide icons initialization failed:', e);
            }
        }
        
        // Initialize step indicator and form
        initSteps();
        loadConfig();
        
        // Visual debug indicator - remove this later
        console.log('FIR complaint: Initialization complete');
    } catch (err) {
        console.error('FIR complaint: CRITICAL ERROR:', err);
        // Add error indicator to page
        const si = document.getElementById('si');
        if (si) {
            si.innerHTML = `<div style="color:red;padding:20px;text-align:center;">Error loading FIR form: ${err.message}</div>`;
        }
    }
});

function initSteps() {
    console.log('FIR complaint: initSteps called');
    const si = document.getElementById('si');
    if (!si) {
        console.error('FIR complaint: Step indicator element #si not found');
        return;
    }
    console.log('FIR complaint: Found #si, rendering steps');
    si.innerHTML = stepLabels.map((l, i) => 
        `<div class='s ${i===0?'active':''}' data-step='${i+1}' onclick='goToStep(${i+1})'><div class='sn'>${i+1}</div><div class='sl'>${l}</div></div>`
    ).join('');
    renderStep(1);
}

function goToStep(n) {
    if (n < currentStep) { currentStep = n; renderStep(n); }
}

async function loadConfig() {
    console.log('FIR complaint: loadConfig called');
    try {
        const r = await fetch(`${FIR_API_BASE}/api/fir/config`);
        configData = await r.json();
        console.log('FIR complaint: config loaded', configData);
        initForm();
    } catch(e) { 
        console.error('FIR complaint: Error loading config:', e);
        // Initialize form anyway with empty config so user can still see the form
        initForm();
    }
}

function initForm() {
    console.log('FIR complaint: initForm called');
    const fc = document.getElementById('fc');
    if (!fc) {
        console.error('FIR complaint: Form container #fc not found');
        return;
    }
    console.log('FIR complaint: Found #fc, rendering form steps');
    fc.innerHTML = genStep1() + genStep2() + genStep3() + genStep4() + genStep5() + genStep6() + genStep7() + genStep8();
    
    // Re-initialize icons after DOM update
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        try {
            lucide.createIcons();
        } catch (e) {
            console.warn('Lucide icons re-initialization failed:', e);
        }
    }
    console.log('FIR complaint: Form rendered successfully');
}

function genOpts(arr) {
    return arr.map(o => `<option value='${o}'>${o||'Select'}</option>`).join('');
}

function genStep1() {
    return `<div class='form-step active' data-step='1'>
<div class='sec-title'><i data-lucide='user'></i> Your Details (Complainant)</div>
<div class='form-row'>
<div class='form-group'><label class='req'>Full Name</label><input type='text' id='cn' class='form-control' required></div>
<div class='form-group'><label class='req'>Father/Husband Name</label><input type='text' id='cpn' class='form-control' required></div>
</div>
<div class='form-row'>
<div class='form-group'><label class='req'>Date of Birth</label><input type='date' id='cdob' class='form-control' required></div>
<div class='form-group'><label class='req'>Nationality</label><input type='text' id='cnat' class='form-control' value='Indian'></div>
</div>
<div class='form-row'>
<div class='form-group'><label class='req'>Occupation</label><input type='text' id='cocc' class='form-control' required></div>
<div class='form-group'><label class='req'>Phone Number</label><input type='tel' id='cphone' class='form-control' required></div>
</div>
<div class='form-group'><label>Email Address</label><input type='email' id='cemail' class='form-control'></div>
<div class='checkbox-wrap'><label><input type='checkbox' id='chp' onchange="toggleEl('pd',this.checked)"> Have Passport?</label></div>
<div id='pd' class='hidden'><div class='form-group'><label>Passport Number</label><input type='text' id='cpno' class='form-control'></div></div>
<div class='form-group'><label class='req'>Complete Address</label><textarea id='caddr' rows='3' class='form-control' required></textarea></div>
</div>`;
}

function genStep2() {
    return `<div class='form-step' data-step='2'>
<div class='sec-title'><i data-lucide='calendar'></i> When Did It Happen?</div>
<div class='form-row'>
<div class='form-group'><label class='req'>Date From</label><input type='date' id='idf' class='form-control' required onchange='calcDay()'></div>
<div class='form-group'><label>Date To</label><input type='date' id='idt' class='form-control'></div>
</div>
<div class='form-row'>
<div class='form-group'><label>Time From</label><input type='time' id='itf' class='form-control'></div>
<div class='form-group'><label>Time To</label><input type='time' id='itt' class='form-control'></div>
</div>
<div class='form-row'>
<div class='form-group'><label>Day of Week</label><select id='iday' class='form-control'>${genOpts(['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])}</select></div>
<div class='form-group'><label>Reason for Delay (if any)</label><textarea id='dr' rows='2' class='form-control'></textarea></div>
</div>
</div>`;
}

function genStep3() {
    return `<div class='form-step' data-step='3'>
<div class='sec-title'><i data-lucide='map-pin'></i> Where Did It Happen?</div>
<div class='form-row'>
<div class='form-group'><label class='req'>District</label><select id='dist' class='form-control' onchange='loadPS()'><option>Select</option>${configData?.districts?.map(d=>`<option>${d.name}</option>`).join('')||''}</select></div>
<div class='form-group'><label class='req'>Police Station</label><select id='ps' class='form-control'><option>Select District First</option></select></div>
</div>
<div class='form-group'><label class='req'>Occurrence Address</label><textarea id='oaddr' rows='2' class='form-control' required></textarea></div>
<div class='form-row'>
<div class='form-group'><label>Latitude (optional)</label><input type='number' id='lat' class='form-control' step='0.000001'></div>
<div class='form-group'><label>Longitude (optional)</label><input type='number' id='lng' class='form-control' step='0.000001'></div>
</div>
</div>`;
}

function genStep4() {
    return `<div class='form-step' data-step='4'>
<div class='sec-title'><i data-lucide='file-text'></i> What Happened (Narrative)</div>
<div class='form-group'><label>Incident Type</label><select id='icat' class='form-control'>${genOpts(['','Theft','Robbery/Dacoity','Burglary','Assault/Hurt','Cheating/Fraud','Criminal Intimidation','Property Damage','Cybercrime','Missing Person','Murder','Kidnapping','Vehicle Theft','Snatching','Other'])}</select></div>
<div class='form-group'><label class='req'>Detailed Narrative</label><textarea id='nar' rows='5' class='form-control' required placeholder='Describe what happened in detail. Our AI will suggest relevant BNS sections based on your description.'></textarea></div>
<div style='background:rgba(24,84,142,0.05);border:1px solid #a3bece;border-radius:8px;padding:15px;margin-top:15px'><p style='color:#5f7a99;font-size:13px'><i data-lucide='info' style='width:16px;height:16px;vertical-align:middle;margin-right:5px'></i> Include dates, locations, suspects known, witnesses, and any evidence available.</p></div>
</div>`;
}

function genStep5() { return `<div class='form-step' data-step='5'><div class='sec-title'><i data-lucide='user-x'></i> Accused Persons</div><div id='acc'></div><button type='button' class='btn-add' onclick='addAcc()'><i data-lucide='plus'></i> Add Accused</button></div>`; }

function genStep6() { return `<div class='form-step' data-step='6'><div class='sec-title'><i data-lucide='package'></i> Property Details</div><div id='prop'></div><button type='button' class='btn-add' onclick='addProp()'><i data-lucide='plus'></i> Add Property</button></div>`; }

function genStep7() { return `<div class='form-step' data-step='7'><div class='sec-title'><i data-lucide='users'></i> Victim Details</div><div class='checkbox-wrap'><label><input type='checkbox' id='vsac' checked onchange="toggleEl('vics',!this.checked)"> Complainant is the victim</label></div><div id='vics' class='hidden'><div id='vic'></div><button type='button' class='btn-add' onclick='addVic()'><i data-lucide='plus'></i> Add Victim</button></div></div>`; }

function genStep8() { return `<div class='form-step' data-step='8'><div class='sec-title'><i data-lucide='check-circle'></i> Declaration</div><div style='background:rgba(239,68,68,0.05);border:1px solid #ef4444;border-radius:8px;padding:20px;margin-bottom:20px'><p style='color:#ef4444;font-size:14px'><i data-lucide='alert-triangle' style='width:18px;height:18px;margin-right:8px;vertical-align:middle'></i><strong>Important:</strong> Filing a false FIR is an offence under Section 182/211 IPC (now Section 214 BNS). Please verify all details before submitting.</p></div><div class='checkbox-wrap'><label><input type='checkbox' id='dec'> I declare that the information given above is true to the best of my knowledge and belief.</label></div><div class='form-group' style='margin-top:20px'><label>OTP Verification</label><div style='display:flex;gap:10px'><input type='text' id='otp' maxlength='6' class='form-control' style='flex:1'><button type='button' class='btn-secondary' onclick='sendOtp()'>Send OTP</button></div></div></div>`; }

function loadPS() {
    const dist = document.getElementById('dist'), ps = document.getElementById('ps');
    if (!dist || !ps || !configData) return;
    const d = configData.districts.find(x => x.name === dist.value);
    ps.innerHTML = d ? d.stations.map(s => `<option>${s}</option>`).join('') : '<option>Select District First</option>';
}

function genStep1() {
    return `<div class='form-step active' data-step='1'>
<div class='sec-title'><i data-lucide='user'></i> Your Details</div>
<div class='form-row'><div><label class='req'>Full Name</label><input type='text' id='cn' required></div><div><label class='req'>Father/Husband Name</label><input type='text' id='cpn' required></div></div>
<div class='form-row'><div><label class='req'>DOB</label><input type='date' id='cdob' required></div><div><label class='req'>Nationality</label><input type='text' id='cnat' value='Indian'></div></div>
<div class='form-row'><div><label class='req'>Phone</label><input type='tel' id='cphone' required></div><div><label>Email</label><input type='email' id='cemail'></div></div>
<div><label><input type='checkbox' id='chp' onchange="toggleEl('pd',this.checked)"> Have Passport?</label></div>
<div id='pd' style='display:none'><label>Passport No</label><input type='text' id='cpno'></div>
<div><label class='req'>Address</label><textarea id='caddr' rows='3' required></textarea></div>
</div>`;
}

function calcDay() {
    const df = document.getElementById('idf'), iday = document.getElementById('iday');
    if (df?.value && iday) { const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']; iday.value = days[new Date(df.value).getDay()]; }
}

function toggleEl(id, show) { const el = document.getElementById(id); if (el) el.style.display = show ? 'block' : 'none'; }

function addAcc() {
    accusedCount++;
    const el = document.getElementById('acc');
    const div = document.createElement('div');
    div.className = 'r-item';
    div.id = `acc-${accusedCount}`;
    div.innerHTML = `<button type='button' onclick='remAcc(${accusedCount})' class='btn-rm'><i data-lucide='x'></i> Remove</button>
<div class='form-row'><div class='form-group'><label>Status</label><select id='as-${accusedCount}' class='form-control'><option>Known</option><option>Suspected</option><option>Unknown</option></select></div>
<div class='form-group'><label>Name</label><input type='text' id='an-${accusedCount}' class='form-control' placeholder='Name or description'></div></div>
<div class='form-group'><label>Description</label><textarea id='aad-${accusedCount}' rows='2' class='form-control'></textarea></div>`;
    el.appendChild(div);
    lucide?.createIcons?.();
}

function remAcc(n) { document.getElementById(`acc-${n}`)?.remove(); }

function addProp() {
    propertyCount++;
    const el = document.getElementById('prop');
    const div = document.createElement('div');
    div.className = 'r-item';
    div.id = `prop-${propertyCount}`;
    div.innerHTML = `<button type='button' onclick='remProp(${propertyCount})' class='btn-rm'><i data-lucide='x'></i> Remove</button>
<div class='form-group'><label>Property Description</label><textarea id='pd-${propertyCount}' rows='2' class='form-control' placeholder='Describe the property (e.g., Gold chain, Mobile phone, documents)'></textarea></div>
<div class='form-row'><div class='form-group'><label>Estimated Value (₹)</label><input type='number' id='pv-${propertyCount}' class='form-control' placeholder='0.00'></div><div class='form-group'><label>Quantity</label><input type='text' id='pq-${propertyCount}' class='form-control' placeholder='e.g., 1 piece, 2 kg'></div></div>`;
    el.appendChild(div);
    lucide?.createIcons?.();
}

function remProp(n) { document.getElementById(`prop-${n}`)?.remove(); }

function addVic() {
    victimCount++;
    const el = document.getElementById('vic');
    const div = document.createElement('div');
    div.className = 'r-item';
    div.id = `vic-${victimCount}`;
    div.innerHTML = `<button type='button' onclick='remVic(${victimCount})' class='btn-rm'><i data-lucide='x'></i> Remove</button>
<div class='form-row'><div class='form-group'><label>Victim Name</label><input type='text' id='vn-${victimCount}' class='form-control'></div><div class='form-group'><label>Gender</label><select id='vs-${victimCount}' class='form-control'>${genOpts(['','Male','Female','Other'])}</select></div></div>`;
    el.appendChild(div);
    lucide?.createIcons?.();
}

function remVic(n) { document.getElementById(`vic-${n}`)?.remove(); }

function renderStep(n) {
    console.log(`FIR complaint: renderStep called with step ${n}`);
    const allSteps = document.querySelectorAll('.form-step');
    console.log(`FIR complaint: Found ${allSteps.length} form steps`);
    
    allSteps.forEach(e => e.classList.remove('active'));
    const targetStep = document.querySelector(`.form-step[data-step='${n}']`);
    if (targetStep) {
        targetStep.classList.add('active');
        console.log(`FIR complaint: Activated step ${n}`);
    } else {
        console.error(`FIR complaint: Step ${n} element not found!`);
    }
    document.querySelectorAll('#si .s').forEach(e => { e.classList.toggle('active', parseInt(e.dataset.step) <= n); });
    
    // Update navigation buttons
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');
    
    if (prevBtn) prevBtn.style.visibility = n === 1 ? 'hidden' : 'visible';
    if (nextBtn) {
        nextBtn.innerHTML = n === totalSteps ? '<i data-lucide="check"></i> Submit FIR' : 'Next <i data-lucide="arrow-right"></i>';
        nextBtn.className = n === totalSteps ? 'btn-primary' : 'btn-primary';
    }
    lucide?.createIcons?.();
}

function nextStep() {
    if (!validateStep(currentStep)) return;
    if (currentStep === totalSteps) { submitFIR(); return; }
    currentStep++; renderStep(currentStep);
}

function prevStep() { if (currentStep > 1) { currentStep--; renderStep(currentStep); } }

function validateStep(n) {
    for (const el of document.querySelector(`.form-step[data-step='${n}']`)?.querySelectorAll('[required]') || []) {
        if (!el.value.trim()) { el.focus(); return false; }
    }
    return true;
}

function sendOtp() {
    const generated = Math.floor(100000 + Math.random() * 900000).toString();
    const otpInput = document.getElementById('otp');
    if (otpInput) otpInput.value = generated;
    alert(`Verification OTP Generated: ${generated}\n(Auto-filled for instant verification)`);
}

function saveDraft() {
    const data = {};
    document.querySelectorAll('input, textarea, select').forEach(el => {
        if (el.id) data[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    });
    localStorage.setItem('fir_draft', JSON.stringify(data));
    alert('Draft saved!');
}

async function submitFIR() {
    if (!document.getElementById('dec')?.checked) return alert('Accept declaration');
    const p = { complainant_name: v('cn'), complainant_parent_spouse_name: v('cpn'), complainant_dob: v('cdob'),
        complainant_nationality: v('cnat')||'Indian', complainant_has_passport: c('chp'), complainant_passport_no: v('cpno'),
        complainant_occupation: v('cocc'), complainant_address: v('caddr'), complainant_phone: v('cphone'),
        complainant_email: v('cemail'), incident_date_from: v('idf'), incident_date_to: v('idt'),
        incident_time_from: v('itf'), incident_time_to: v('itt'), incident_day: v('iday'),
        district: v('dist'), police_station: v('ps'), occurrence_address: v('oaddr'),
        incident_narrative: v('nar'), incident_category_hint: v('icat'),
        declaration_true_to_knowledge: true, e_signature_or_otp_verification: v('otp'),
        digilocker_verified: false, accused_persons: [], properties: [], victims: [] };
    
    for (let i = 1; i <= accusedCount; i++) if (document.getElementById(`acc-${i}`)) 
        p.accused_persons.push({accused_status: v(`as-${i}`), accused_name: v(`an-${i}`), accused_address_or_description: v(`aad-${i}`)});
    for (let i = 1; i <= propertyCount; i++) if (document.getElementById(`prop-${i}`))
        p.properties.push({property_description: v(`pd-${i}`), property_estimated_value: parseFloat(v(`pv-${i}`))||null, property_quantity: v(`pq-${i}`)});
    if (!c('vsac')) for (let i = 1; i <= victimCount; i++) if (document.getElementById(`vic-${i}`))
        p.victims.push({victim_same_as_complainant: false, victim_name: v(`vn-${i}`), victim_sex: v(`vs-${i}`)});
    
    try {
        const r = await fetch(`${FIR_API_BASE}/api/fir/`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(p)});
        if (!r.ok) throw new Error('Failed');
        const d = await r.json();
        document.getElementById('si').style.display = 'none';
        document.querySelector('.nb').style.display = 'none';
        document.getElementById('fc').innerHTML = `
<div class='sc'>
<div style='width:80px;height:80px;background:rgba(16,185,129,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px'><i data-lucide='check-circle' style='width:40px;height:40px;color:#10b981'></i></div>
<h2 style='color:#10b981;margin-bottom:15px'>FIR Submitted Successfully!</h2>
<p style='color:#5f7a99;margin-bottom:20px'>Your First Information Report has been registered</p>
<div class='rf-box'>${d.reference_id}</div>
<p style='font-size:13px;color:#5f7a99'>Save this reference ID for tracking</p>
<div style='margin-top:30px'><button onclick="location.href='index.html'" class='btn-secondary'><i data-lucide='home'></i> Back to Portal</button></div>
</div>`;
        lucide?.createIcons?.();
    } catch(e) { alert('Error: ' + e.message); }
}

function v(id) { return document.getElementById(id)?.value || ''; }
function c(id) { return document.getElementById(id)?.checked || false; }

