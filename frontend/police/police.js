// ============================================================
//  police.js  —  KANAD Prototype  |  PART B: Police Intranet
//  Intranet-only JS. Contains employee, investigator & admin
//  portal logic.  Citizen logic lives in citizen/citizen.js
// ============================================================

const API_BASE = window.location.origin;

// State
let currentUser  = null;
let currentToken = null;
let activeCaseId = null;
let categoryChart = null;
let trendChart    = null;
let casesCache    = [];

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

    setupAuthUI();
    lucide.createIcons();
});

// ─── SHARED UTILITIES ─────────────────────────────────────

function initGoogleTranslate() {
    const s1 = document.createElement('script');
    s1.type = 'text/javascript';
    s1.innerHTML = `
    function googleTranslateElementInit() {
      new google.translate.TranslateElement({pageLanguage: 'en', includedLanguages: 'en,hi,gu', layout: google.translate.TranslateElement.InlineLayout.SIMPLE}, 'google_translate_element');
    }`;
    document.body.appendChild(s1);
    const s2 = document.createElement('script');
    s2.type = 'text/javascript';
    s2.src  = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.body.appendChild(s2);
}
initGoogleTranslate();

function showAlert(message, type = 'success') {
    const banner = document.getElementById('alert-banner');
    if (!banner) return;
    banner.innerText  = message;
    banner.className  = 'alert-feedback';

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

function switchDashboardTab(subTabId) {
    document.querySelectorAll('.dashboard-subview').forEach(s => s.classList.remove('active'));

    const buttons = [document.getElementById('btn-sub-cases'), document.getElementById('btn-sub-analytics')];
    buttons.forEach(b => { if (b) b.classList.remove('active'); });

    const subview = document.getElementById(`subview-${subTabId}`);
    if (subview) subview.classList.add('active');

    if (subTabId === 'cases-list') {
        const btn = document.getElementById('btn-sub-cases');
        if (btn) btn.classList.add('active');
    } else if (subTabId === 'analytics') {
        const btn = document.getElementById('btn-sub-analytics');
        if (btn) btn.classList.add('active');
        fetchAnalytics();
    }
}

// ─── AUTH UI ──────────────────────────────────────────────

function setupAuthUI() {
    const path    = window.location.pathname;
    const isEmployee = path.includes('employee');
    const isAdmin    = path.includes('admin');

    ['tab-auth', 'tab-investigator', 'tab-admin'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const logoutBtn = document.getElementById('logout-btn');

    if (!currentUser || !currentToken) {
        if (logoutBtn) logoutBtn.style.display = 'none';
        const tabAuth = document.getElementById('tab-auth');
        if (tabAuth) tabAuth.style.display = 'flex';
        switchTab('auth');
        return;
    }

    if (isEmployee) {
        if (!['employee', 'investigator', 'admin'].includes(currentUser.role)) {
            showAlert('Unauthorized: Employee/Investigator credentials required.', 'error');
            localStorage.removeItem('token'); localStorage.removeItem('user');
            currentUser = null; currentToken = null;
            setupAuthUI();
            return;
        }
        const tabInv = document.getElementById('tab-investigator');
        if (tabInv) { tabInv.style.display = 'flex'; switchTab('investigator'); }
        const tabContainer = document.getElementById('tab-container');
        if (tabContainer) tabContainer.style.display = 'flex';
        fetchCases();

    } else if (isAdmin) {
        if (currentUser.role !== 'admin') {
            showAlert('Unauthorized: Admin credentials required.', 'error');
            localStorage.removeItem('token'); localStorage.removeItem('user');
            currentUser = null; currentToken = null;
            setupAuthUI();
            return;
        }
        const tabAdmin = document.getElementById('tab-admin');
        if (tabAdmin) { tabAdmin.style.display = 'flex'; switchTab('admin'); }
        const tabContainer = document.getElementById('tab-container');
        if (tabContainer) tabContainer.style.display = 'flex';
        fetchAdminPortalData();
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
    });
}

// Login form (employee.html & admin.html both use #login-form)
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email    = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        const formData = new FormData();
        formData.append('username', email);
        formData.append('password', password);

        try {
            const response = await fetch(`${API_BASE}/token`, { method: 'POST', body: formData });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Authentication failed');
            }
            const data   = await response.json();
            currentToken = data.access_token;
            currentUser  = data.user;

            localStorage.setItem('token', currentToken);
            localStorage.setItem('user', JSON.stringify(currentUser));

            setupAuthUI();
            showAlert(`Signed in as ${currentUser.name}`);
            loginForm.reset();
        } catch (err) {
            showAlert(err.message, 'error');
        }
    });
}

// ─── CASE MANAGEMENT ──────────────────────────────────────

async function fetchCases() {
    try {
        const response = await fetch(`${API_BASE}/cases`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!response.ok) throw new Error('Failed to load active cases');
        casesCache = await response.json();
        renderCases(casesCache);
        updateStats(casesCache);
    } catch (err) {
        showAlert(err.message, 'error');
    }
}

function updateStats(cases) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    set('stats-total',        cases.length);
    set('stats-pending',      cases.filter(c => c.status === 'pending').length);
    set('stats-investigating',cases.filter(c => c.status === 'investigating').length);
    set('stats-resolved',     cases.filter(c => c.status === 'resolved').length);
}

function renderCases(cases) {
    const tbody = document.getElementById('cases-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (cases.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-secondary);">No cases found.</td></tr>`;
        return;
    }

    cases.forEach(c => {
        const tr = document.createElement('tr');
        tr.onclick = () => showCaseDetails(c.id);

        let priorityBadge = '';
        if (c.priority_score >= 4)       priorityBadge = `<span class="badge badge-high">${c.priority_score} - Critical</span>`;
        else if (c.priority_score >= 2)  priorityBadge = `<span class="badge badge-medium">${c.priority_score} - Medium</span>`;
        else                             priorityBadge = `<span class="badge badge-low">${c.priority_score} - Low</span>`;

        let statusStyle = '';
        if (c.status === 'pending')       statusStyle = 'color: var(--warning); font-weight: 600;';
        else if (c.status === 'investigating') statusStyle = 'color: var(--neon-cyan); font-weight: 600;';
        else if (c.status === 'resolved') statusStyle = 'color: var(--success); font-weight: 600;';

        const createdStr = new Date(c.created_at).toLocaleDateString('en-GB', { hour: '2-digit', minute: '2-digit' });

        tr.innerHTML = `
            <td style="font-family: var(--font-heading); font-weight: 600; color: var(--neon-cyan);">${c.ticket_id}</td>
            <td>${c.citizen_name}</td>
            <td>${c.category.toUpperCase().replace('_', ' ')}</td>
            <td>${c.assigned_desk}</td>
            <td>${priorityBadge}</td>
            <td>${createdStr}</td>
            <td>📁 ${c.evidence_count} files</td>
            <td style="${statusStyle}">${c.status.toUpperCase()}</td>
        `;
        tbody.appendChild(tr);
    });
}

function filterCases() {
    const query = (document.getElementById('case-search').value || '').toLowerCase().trim();
    if (!query) { renderCases(casesCache); return; }
    const filtered = casesCache.filter(c =>
        c.ticket_id.toLowerCase().includes(query)   ||
        c.citizen_name.toLowerCase().includes(query) ||
        c.category.toLowerCase().includes(query)    ||
        c.assigned_desk.toLowerCase().includes(query)||
        c.description.toLowerCase().includes(query)
    );
    renderCases(filtered);
}

async function showCaseDetails(caseId) {
    activeCaseId = caseId;
    const caseData = casesCache.find(c => c.id === caseId);
    if (!caseData) return;

    document.getElementById('case-detail-container').style.display = 'grid';

    document.getElementById('detail-ticket').innerText  = caseData.ticket_id;
    document.getElementById('detail-citizen').innerText = caseData.citizen_name;
    document.getElementById('detail-desk').innerText    = caseData.assigned_desk;
    document.getElementById('detail-priority').innerText = `${caseData.priority_score} / 5`;
    document.getElementById('detail-status-select').value = caseData.status;
    document.getElementById('detail-desc').innerText    = caseData.description;

    fetchTimeline(caseId);
    fetchAuditTrail(caseId);
    fetchCaseNotes(caseId);
}

function closeCaseDetail() {
    document.getElementById('case-detail-container').style.display = 'none';
    activeCaseId = null;
}

// ─── TIMELINE ─────────────────────────────────────────────

async function fetchTimeline(caseId) {
    const list = document.getElementById('timeline-events-list');
    list.innerHTML = `<p style="color: var(--text-secondary);">Loading forensic timeline...</p>`;

    try {
        const response = await fetch(`${API_BASE}/cases/${caseId}/timeline`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!response.ok) throw new Error('Failed to load timeline');
        const events = await response.json();
        list.innerHTML = '';

        if (events.length === 0) {
            list.innerHTML = `<p style="color: var(--text-secondary); padding: 10px;">No digital timeline events found.</p>`;
            return;
        }

        events.forEach(ev => {
            const div = document.createElement('div');
            div.className = 'timeline-item';

            let timeStr = ev.timestamp_utc;
            try { timeStr = new Date(ev.timestamp_utc).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC'; } catch (e) {}

            div.innerHTML = `
                <div class="timeline-dot"></div>
                <div class="timeline-time">${timeStr}</div>
                <div class="timeline-title">${ev.event_type}</div>
                <div class="timeline-desc">${ev.description}</div>
                <div class="timeline-source">Source File: ${ev.source_field}</div>
            `;
            list.appendChild(div);
        });
    } catch (err) {
        list.innerHTML = `<p style="color: var(--danger);">${err.message}</p>`;
    }
}

// ─── AUDIT TRAIL ──────────────────────────────────────────

async function fetchAuditTrail(caseId) {
    const tbody       = document.getElementById('audit-trail-body');
    const evidenceList = document.getElementById('detail-evidence-list');

    tbody.innerHTML       = `<tr><td colspan="7" style="color: var(--text-secondary);">Loading logs...</td></tr>`;
    evidenceList.innerHTML = '';

    try {
        const response = await fetch(`${API_BASE}/cases/${caseId}/audit-trail`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!response.ok) throw new Error('Failed to load logs');
        const trail = await response.json();
        tbody.innerHTML = '';

        const uniqueFiles = new Map();

        if (trail.length === 0) {
            tbody.innerHTML       = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No digital custody steps tracked.</td></tr>`;
            evidenceList.innerHTML = `<li style="font-size: 13px; color: var(--text-secondary);">No files loaded.</li>`;
            return;
        }

        trail.forEach(item => {
            if (!uniqueFiles.has(item.evidence_filename)) {
                uniqueFiles.set(item.evidence_filename, { id: item.evidence_id, hash: item.original_upload_hash, tampered: item.tampered });
            }

            const tr = document.createElement('tr');
            const timeStr = new Date(item.timestamp).toLocaleString('en-GB');

            let actionBadge = '';
            if (item.action === 'uploaded') actionBadge = `<span class="badge badge-low" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">UPLOADED</span>`;
            else if (item.action === 'scanned') actionBadge = `<span class="badge" style="background: rgba(157, 112, 90, 0.15); color: #9d705a; border: 1px solid rgba(157, 112, 90, 0.3);">PC SCANNED</span>`;
            else if (item.action === 'hashed') actionBadge = `<span class="badge" style="background: rgba(120, 196, 224, 0.15); color: #78c4e0; border: 1px solid rgba(120, 196, 224, 0.3);">HASH VERIFIED</span>`;
            else if (item.action === 'parsed') actionBadge = `<span class="badge" style="background: rgba(40, 158, 231, 0.15); color: #289ee7; border: 1px solid rgba(40, 158, 231, 0.3);">TIMELINE PARSED</span>`;
            else if (item.action === 'viewed') actionBadge = `<span class="badge" style="background: rgba(163, 190, 206, 0.1); color: #a3bece; border: 1px solid rgba(163, 190, 206, 0.2);">ACCESSED</span>`;

            const statusCell = item.tampered
                ? `<span class="badge badge-high" style="box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);">🚨 TAMPERED!</span>`
                : `<span class="badge badge-low" style="color: var(--success);">✓ SECURE</span>`;

            tr.innerHTML = `
                <td style="font-weight: 500;">${item.evidence_filename}</td>
                <td>${actionBadge}</td>
                <td>
                    <div style="font-weight: 500;">${item.actor_name}</div>
                    <div style="font-size: 11px; color: var(--text-secondary);">${item.actor_role.toUpperCase()}</div>
                </td>
                <td style="font-size: 13px; color: var(--text-secondary);">${timeStr}</td>
                <td style="font-family: monospace; font-size: 10px; color: var(--text-secondary); word-break: break-all;">${item.original_upload_hash.slice(0, 16)}...</td>
                <td style="font-family: monospace; font-size: 10px; color: var(--text-secondary); word-break: break-all;">${item.current_integrity_hash.slice(0, 16)}...</td>
                <td>${statusCell}</td>
            `;
            tbody.appendChild(tr);
        });

        uniqueFiles.forEach((fileInfo, filename) => {
            const li = document.createElement('li');
            li.style.padding      = '6px 0';
            li.style.fontSize     = '13px';
            li.style.borderBottom = '1px solid rgba(255,255,255,0.03)';

            const statusIcon = fileInfo.tampered
                ? `<span style="color: var(--danger); font-weight: bold; float: right;">🚨 Tampered!</span>`
                : `<span style="color: var(--success); font-weight: bold; float: right;">✓ Verified</span>`;

            li.innerHTML = `
                <div>📁 <strong>${filename}</strong></div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Hash: ${fileInfo.hash.slice(0, 20)}... ${statusIcon}</div>
            `;
            evidenceList.appendChild(li);
        });

        lucide.createIcons();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="color: var(--danger);">${err.message}</td></tr>`;
    }
}

// ─── CASE STATUS UPDATE ───────────────────────────────────

async function updateCaseStatus() {
    const statusVal = document.getElementById('detail-status-select').value;
    if (!activeCaseId) return;

    const formData = new FormData();
    formData.append('status', statusVal);

    try {
        const response = await fetch(`${API_BASE}/cases/${activeCaseId}/status`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${currentToken}` },
            body: formData
        });
        if (!response.ok) throw new Error('Failed to update case status');
        showAlert('Case status updated.');
        fetchCases();
    } catch (err) {
        showAlert(err.message, 'error');
    }
}

// ─── CASE NOTES ───────────────────────────────────────────

async function fetchCaseNotes(caseId) {
    const list = document.getElementById('case-notes-list');
    if (!list) return;
    list.innerHTML = '';

    try {
        const response = await fetch(`${API_BASE}/cases/${caseId}/notes`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!response.ok) throw new Error('Failed to load case notes');
        const notes = await response.json();
        notes.forEach(n => {
            const li = document.createElement('li');
            li.style.cssText = 'padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);';
            const timeStr = new Date(n.created_at).toLocaleString('en-GB');
            li.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-weight:600; color: var(--neon-cyan);">
                    <span>👮 ${n.employee_name}</span>
                    <span style="font-size:10px; color: var(--text-secondary);">${timeStr}</span>
                </div>
                <div style="color: var(--text-primary); font-size:13px;">${n.note_text}</div>
            `;
            list.appendChild(li);
        });
    } catch (err) { console.error(err); }
}

async function addCaseNote() {
    const input    = document.getElementById('new-note-text');
    const noteText = input.value.trim();
    if (!noteText || !activeCaseId) return;

    const formData = new FormData();
    formData.append('note_text', noteText);

    try {
        const response = await fetch(`${API_BASE}/cases/${activeCaseId}/notes`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentToken}` },
            body: formData
        });
        if (!response.ok) throw new Error('Failed to save case note');
        showAlert('Forensic note added.');
        input.value = '';
        fetchCaseNotes(activeCaseId);
    } catch (err) {
        showAlert(err.message, 'error');
    }
}

// ─── FIR DRAFTING ─────────────────────────────────────────

async function reviewFirDraft() {
    if (!activeCaseId) return;
    try {
        const response = await fetch(`${API_BASE}/cases/${activeCaseId}/fir-draft`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!response.ok) throw new Error('Failed to load FIR draft');
        const data = await response.json();
        document.getElementById('fir-draft-text').value = data.generated_text;
        document.getElementById('fir-modal').style.display         = 'block';
        document.getElementById('fir-modal-overlay').style.display = 'block';
    } catch (err) {
        showAlert(err.message, 'error');
    }
}

function closeFirModal() {
    document.getElementById('fir-modal').style.display         = 'none';
    document.getElementById('fir-modal-overlay').style.display = 'none';
}

async function fileOfficialFir() {
    if (!activeCaseId) return;
    try {
        const response = await fetch(`${API_BASE}/cases/${activeCaseId}/fir-file`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!response.ok) throw new Error('Failed to file official FIR');
        showAlert('FIR Filed officially with Ahmedabad Cyber Branch! Status updated.');
        closeFirModal();
        fetchCases();
    } catch (err) {
        showAlert(err.message, 'error');
    }
}

// ─── ADMIN PORTAL ─────────────────────────────────────────

async function fetchAdminPortalData() {
    try {
        const response = await fetch(`${API_BASE}/admin/employees`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!response.ok) throw new Error('Failed to load employees');
        const employees = await response.json();
        renderAdminEmployees(employees);

        const casesResponse = await fetch(`${API_BASE}/cases`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (casesResponse.ok) {
            const cases = await casesResponse.json();
            renderDeskSummary(cases);
        }
    } catch (err) {
        showAlert(err.message, 'error');
    }
}

function renderAdminEmployees(employees) {
    const tbody = document.getElementById('admin-employees-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    employees.forEach(emp => {
        const tr = document.createElement('tr');
        const statusBadge = emp.is_active
            ? `<span class="badge badge-low">Active</span>`
            : `<span class="badge badge-high">Deactivated</span>`;
        const actionBtn = emp.is_active
            ? `<button onclick="toggleEmployeeStatus(${emp.id}, 0)" class="btn-secondary" style="padding:4px 8px; font-size:11px;">Deactivate</button>`
            : `<button onclick="toggleEmployeeStatus(${emp.id}, 1)" class="btn-primary"   style="padding:4px 8px; font-size:11px;">Activate</button>`;

        tr.innerHTML = `
            <td><strong>${emp.name}</strong></td>
            <td>${emp.email}</td>
            <td>${emp.desk || 'General Desk'}</td>
            <td>${emp.role.toUpperCase()}</td>
            <td>${statusBadge}</td>
            <td>${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderDeskSummary(cases) {
    const summaryDiv = document.getElementById('admin-desks-summary');
    if (!summaryDiv) return;
    summaryDiv.innerHTML = '';

    const desks = {
        'Financial Fraud Desk': { total: 0, resolved: 0 },
        'Cyber Social Desk':    { total: 0, resolved: 0 },
        'Cyber Security Desk':  { total: 0, resolved: 0 },
        'General Desk':         { total: 0, resolved: 0 }
    };

    cases.forEach(c => {
        const desk = c.assigned_desk || 'General Desk';
        if (desks[desk]) {
            desks[desk].total++;
            if (c.status === 'resolved') desks[desk].resolved++;
        }
    });

    Object.keys(desks).forEach(deskName => {
        const data = desks[deskName];
        const pct  = data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0;

        const card = document.createElement('div');
        card.className    = 'glass-panel';
        card.style.padding = '15px';
        card.innerHTML    = `
            <h4 style="font-size:13px; color: var(--text-secondary); margin-bottom:8px;">${deskName}</h4>
            <div style="font-size:20px; font-weight:700; color: var(--neon-cyan);">${data.total} Cases</div>
            <div style="font-size:12px; color: var(--success); margin-top:4px;">${pct}% Resolved (${data.resolved}/${data.total})</div>
        `;
        summaryDiv.appendChild(card);
    });
}

async function toggleEmployeeStatus(id, isActive) {
    const formData = new FormData();
    formData.append('is_active', isActive);

    try {
        const response = await fetch(`${API_BASE}/admin/employees/${id}/status`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${currentToken}` },
            body: formData
        });
        if (!response.ok) throw new Error('Failed to update employee status');
        showAlert('Employee status updated.');
        fetchAdminPortalData();
    } catch (err) {
        showAlert(err.message, 'error');
    }
}

// Add Employee form
const adminAddEmployeeForm = document.getElementById('admin-add-employee-form');
if (adminAddEmployeeForm) {
    adminAddEmployeeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name     = document.getElementById('admin-emp-name').value;
        const email    = document.getElementById('admin-emp-email').value;
        const password = document.getElementById('admin-emp-pass').value;
        const desk     = document.getElementById('admin-emp-desk').value;

        const formData = new FormData();
        formData.append('name', name);
        formData.append('email', email);
        formData.append('password', password);
        formData.append('desk', desk);

        try {
            const response = await fetch(`${API_BASE}/admin/employees`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${currentToken}` },
                body: formData
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Failed to create employee account');
            }
            showAlert('Desk employee account created successfully.');
            adminAddEmployeeForm.reset();
            fetchAdminPortalData();
        } catch (err) {
            showAlert(err.message, 'error');
        }
    });
}

// ─── CRIME ANALYTICS ──────────────────────────────────────

async function fetchAnalytics() {
    try {
        const response = await fetch(`${API_BASE}/analytics/stats`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!response.ok) throw new Error('Failed to load analytics data');
        const data = await response.json();
        renderCharts(data);
    } catch (err) {
        showAlert(err.message, 'error');
    }
}

function renderCharts(data) {
    const catCtx    = document.getElementById('categoryChart');
    const categories = data.by_category;

    if (catCtx) {
        if (categoryChart) categoryChart.destroy();
        categoryChart = new Chart(catCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Financial Fraud', 'Impersonation', 'Hacking', 'Other'],
                datasets: [{
                    data: [
                        categories.financial_fraud || 0,
                        categories.impersonation   || 0,
                        categories.hacking         || 0,
                        categories.other           || 0
                    ],
                    backgroundColor: ['#18548e', '#78c4e0', '#289ee7', '#9d705a'],
                    borderWidth: 1,
                    borderColor: '#0c131c'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#a3bece', font: { family: 'Outfit' } } }
                }
            }
        });
    }

    const trendCtx = document.getElementById('trendChart');
    if (trendCtx) {
        const dailyVolume = data.daily_volume;
        const labels = dailyVolume.map(d => new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
        const values = dailyVolume.map(d => d.count);

        if (trendChart) trendChart.destroy();
        trendChart = new Chart(trendCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Inflow Complaints',
                    data: values,
                    borderColor: '#289ee7',
                    backgroundColor: 'rgba(40, 158, 231, 0.1)',
                    fill: true, tension: 0.3, borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { grid: { color: 'rgba(163, 190, 206, 0.05)' }, ticks: { color: '#a3bece', stepSize: 1, beginAtZero: true } },
                    x: { grid: { display: false }, ticks: { color: '#a3bece' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
}

// ─── FIREBASE LOGIN INTEGRATION HOOK ──────────────────────
window._onFirebaseLogin = function(branchId) {
    if (window.FIREBASE_TOKEN && window.EMP_PROFILE) {
        currentToken = window.FIREBASE_TOKEN;
        currentUser  = window.EMP_PROFILE;

        // Hide login, show dashboard workstation
        const authView = document.getElementById('view-auth');
        const workView = document.getElementById('view-investigator');
        if (authView) authView.style.display = 'none';
        if (workView) workView.style.display = 'block';

        const tabInv = document.getElementById('tab-investigator');
        if (tabInv) tabInv.style.display = 'flex';
        const tabContainer = document.getElementById('tab-container');
        if (tabContainer) tabContainer.style.display = 'flex';

        switchTab('investigator');
        fetchCases();
    }
};

