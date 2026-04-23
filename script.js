/* ============================================
   CTC CALCULATOR — COMPLETE AUTH + LOGIC
   New Labour Code | Cross-Device Login System
   ============================================ */

/* ============== CONFIGURATION ============== */
const CONFIG = {
  // Default admin credentials (change these for production!)
  DEFAULT_ADMIN: {
    email: 'admin@slci.com',
    password: 'Admin@123',
    name: 'System Admin',
    companyName: 'SLCI Solutions',
    createdAt: new Date().toISOString()
  },
  
  // Optional: Sync endpoint for cross-device support
  // Set this to your backend URL if you have one
  SYNC_ENDPOINT: null, // e.g., 'https://your-server.com/api/ctc-sync'
  
  // Storage keys
  STORAGE_KEYS: {
    ADMIN: 'ctc_admin_data',
    USERS: 'ctc_users',
    SESSION: 'ctc_session'
  }
};

/* ============== GLOBAL STATE ============== */
let currentUser = null;
let isAdmin = false;

/* ============== INITIALIZATION ============== */
// Safe DOM ready handler
function onReady(callback) {
  if (document.readyState !== 'loading') {
    callback();
  } else {
    document.addEventListener('DOMContentLoaded', callback);
  }
}

onReady(() => {
  initAuth();
  setupEventListeners();
});

/* ============== AUTHENTICATION SYSTEM ============== */

function initAuth() {
  // First, ensure default admin exists in localStorage
  ensureDefaultAdmin();
  
  // Check for existing session
  const session = sessionStorage.getItem(CONFIG.STORAGE_KEYS.SESSION);
  if (session) {
    try {
      currentUser = JSON.parse(session);
      if (currentUser && currentUser.email) {
        // Check if admin
        const adminData = getAdminData();
        isAdmin = adminData && adminData.email === currentUser.email;
        
        showMainApp();
        updateUserInfo();
        if (isAdmin) {
          document.getElementById('adminPanelBtn').style.display = 'flex';
          loadUsersTable();
          updateAdminInfo();
        }
        return;
      }
    } catch (e) {
      console.error('Session parse error:', e);
      clearSession();
    }
  }
  
  // Show login page
  showLoginPage();
}

function ensureDefaultAdmin() {
  // Check if admin already exists
  const existingAdmin = localStorage.getItem(CONFIG.STORAGE_KEYS.ADMIN);
  if (!existingAdmin) {
    // Create default admin
    localStorage.setItem(CONFIG.STORAGE_KEYS.ADMIN, JSON.stringify(CONFIG.DEFAULT_ADMIN));
    console.log('✓ Default admin account created');
  }
}

function getAdminData() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.ADMIN) || 'null');
  } catch {
    return null;
  }
}

function getUsersData() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USERS) || '[]');
  } catch {
    return [];
  }
}

function saveUsersData(users) {
  localStorage.setItem(CONFIG.STORAGE_KEYS.USERS, JSON.stringify(users));
  // Optional: Sync to server if endpoint configured
  if (CONFIG.SYNC_ENDPOINT) {
    syncToServer('users', users);
  }
}

/* ============== EVENT LISTENERS ============== */

function setupEventListeners() {
  // Login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  // Admin register form
  const adminRegisterForm = document.getElementById('adminRegisterForm');
  if (adminRegisterForm) {
    adminRegisterForm.addEventListener('submit', handleAdminRegister);
  }
  
  // Create user form (admin panel)
  const createUserForm = document.getElementById('createUserForm');
  if (createUserForm) {
    createUserForm.addEventListener('submit', handleCreateUser);
  }
  
  // Navigation links - using direct onclick in HTML as fallback
  const showAdminRegisterLink = document.getElementById('showAdminRegister');
  if (showAdminRegisterLink) {
    showAdminRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      showAdminRegister();
    });
  }
  
  const backToLoginLink = document.getElementById('backToLogin');
  if (backToLoginLink) {
    backToLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      showLoginPage();
    });
  }
  
  // Admin panel nav
  const adminPanelBtn = document.getElementById('adminPanelBtn');
  if (adminPanelBtn) {
    adminPanelBtn.addEventListener('click', () => {
      switchTab('admin');
      loadUsersTable();
      updateAdminInfo();
    });
  }
  
  // Tab navigation
  document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab !== 'admin' || isAdmin) {
        switchTab(tab);
      }
    });
  });
}

/* ============== PAGE NAVIGATION ============== */

function showLoginPage() {
  safeToggle('loginPage', false);
  safeToggle('adminRegisterPage', true);
  safeToggle('mainApp', true);
  safeToggle('loginError', true);
  const form = document.getElementById('loginForm');
  if (form) form.reset();
}

function showAdminRegister() {
  safeToggle('loginPage', true);
  safeToggle('adminRegisterPage', false);
  safeToggle('mainApp', true);
  safeToggle('adminError', true);
  safeToggle('adminSuccess', true);
  const form = document.getElementById('adminRegisterForm');
  if (form) form.reset();
}

function showMainApp() {
  safeToggle('loginPage', true);
  safeToggle('adminRegisterPage', true);
  safeToggle('mainApp', false);
  
  // Initialize calculator
  if (typeof liveCalc === 'function') liveCalc();
}

function safeToggle(elementId, hide) {
  const el = document.getElementById(elementId);
  if (el) {
    el.classList.toggle('hidden', hide);
  }
}

/* ============== AUTHENTICATION FUNCTIONS ============== */

function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  
  const email = (document.getElementById('loginEmail')?.value || '').trim().toLowerCase();
  const password = document.getElementById('loginPassword')?.value || '';
  const errorEl = document.getElementById('loginError');
  
  if (errorEl) errorEl.classList.add('hidden');
  
  if (!email || !password) {
    showError(errorEl, 'Please enter email and password');
    return;
  }
  
  // Check default admin first
  if (email === CONFIG.DEFAULT_ADMIN.email && password === CONFIG.DEFAULT_ADMIN.password) {
    loginUser({
      ...CONFIG.DEFAULT_ADMIN,
      isAdmin: true
    });
    return;
  }
  
  // Check custom admin
  const adminData = getAdminData();
  if (adminData && adminData.email === email && adminData.password === password) {
    loginUser({
      ...adminData,
      isAdmin: true
    });
    return;
  }
  
  // Check regular users
  const users = getUsersData();
  const user = users.find(u => u.email === email && u.password === password);
  
  if (user) {
    loginUser(user);
  } else {
    showError(errorEl, 'Invalid email or password');
  }
}

function handleAdminRegister(e) {
  e.preventDefault();
  
  const name = (document.getElementById('adminName')?.value || '').trim();
  const companyName = (document.getElementById('adminCompanyName')?.value || '').trim();
  const email = (document.getElementById('adminEmail')?.value || '').trim().toLowerCase();
  const password = document.getElementById('adminPassword')?.value || '';
  const confirmPassword = document.getElementById('confirmPassword')?.value || '';
  const errorEl = document.getElementById('adminError');
  const successEl = document.getElementById('adminSuccess');
  
  if (errorEl) errorEl.classList.add('hidden');
  if (successEl) successEl.classList.add('hidden');
  
  // Validation
  if (!name || !companyName || !email || !password) {
    showError(errorEl, 'All fields are required');
    return;
  }
  
  if (password.length < 8) {
    showError(errorEl, 'Password must be at least 8 characters');
    return;
  }
  
  if (password !== confirmPassword) {
    showError(errorEl, 'Passwords do not match');
    return;
  }
  
  // Check if admin already exists (excluding default)
  const existingAdmin = getAdminData();
  if (existingAdmin && existingAdmin.email !== CONFIG.DEFAULT_ADMIN.email) {
    showError(errorEl, 'Admin account already exists. Please login.');
    return;
  }
  
  // Check if email already registered
  const users = getUsersData();
  if (users.some(u => u.email === email) || email === CONFIG.DEFAULT_ADMIN.email) {
    showError(errorEl, 'Email already registered');
    return;
  }
  
  // Create admin
  const adminData = {
    name,
    companyName,
    email,
    password,
    createdAt: new Date().toISOString()
  };
  
  localStorage.setItem(CONFIG.STORAGE_KEYS.ADMIN, JSON.stringify(adminData));
  
  if (successEl) {
    successEl.classList.remove('hidden');
  }
  const form = document.getElementById('adminRegisterForm');
  if (form) form.reset();
  
  // Auto-switch to login after 2 seconds
  setTimeout(() => {
    showLoginPage();
    showToast('✓ Admin account created! Please login.');
  }, 2000);
}

function handleCreateUser(e) {
  e.preventDefault();
  
  if (!isAdmin) {
    showToast('⚠️ Admin access required');
    return;
  }
  
  const name = (document.getElementById('newUserName')?.value || '').trim();
  const email = (document.getElementById('newUserEmail')?.value || '').trim().toLowerCase();
  const password = document.getElementById('newUserPassword')?.value || '';
  const confirmPassword = document.getElementById('confirmNewPassword')?.value || '';
  const msgEl = document.getElementById('createUserMsg');
  
  if (msgEl) msgEl.classList.add('hidden');
  
  // Validation
  if (!name || !email || !password) {
    showError(msgEl, 'All fields are required', true);
    return;
  }
  
  if (password.length < 8) {
    showError(msgEl, 'Password must be at least 8 characters', true);
    return;
  }
  
  if (password !== confirmPassword) {
    showError(msgEl, 'Passwords do not match', true);
    return;
  }
  
  // Check duplicates
  const adminData = getAdminData();
  let users = getUsersData();
  
  const allEmails = [
    CONFIG.DEFAULT_ADMIN.email,
    adminData?.email,
    ...users.map(u => u.email)
  ].filter(Boolean);
  
  if (allEmails.includes(email)) {
    showError(msgEl, 'Email already registered', true);
    return;
  }
  
  // Create user
  const newUser = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    name,
    email,
    password,
    createdAt: new Date().toISOString(),
    createdBy: adminData?.name || CONFIG.DEFAULT_ADMIN.name
  };
  
  users.push(newUser);
  saveUsersData(users);
  
  showSuccess(msgEl, `✓ User "${name}" created successfully!`);
  const form = document.getElementById('createUserForm');
  if (form) form.reset();
  
  // Refresh table
  loadUsersTable();
  updateAdminInfo();
}

function loginUser(user) {
  currentUser = user;
  isAdmin = user.isAdmin || false;
  
  // Save session
  sessionStorage.setItem(CONFIG.STORAGE_KEYS.SESSION, JSON.stringify({
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin
  }));
  
  // Update UI
  updateUserInfo();
  showMainApp();
  
  if (isAdmin) {
    const adminBtn = document.getElementById('adminPanelBtn');
    if (adminBtn) adminBtn.style.display = 'flex';
    loadUsersTable();
    updateAdminInfo();
  }
  
  showToast(`✓ Welcome, ${user.name.split(' ')[0]}!`);
}

function logout() {
  currentUser = null;
  isAdmin = false;
  clearSession();
  
  // Reset calculator
  if (typeof resetAll === 'function') resetAll();
  
  showLoginPage();
  showToast('↪️ Logged out successfully');
}

function clearSession() {
  sessionStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION);
}

function updateUserInfo() {
  if (!currentUser) return;
  
  const nameEl = document.getElementById('userName');
  const emailEl = document.getElementById('userEmail');
  const avatarEl = document.getElementById('userAvatar');
  
  if (nameEl) nameEl.textContent = currentUser.name;
  if (emailEl) emailEl.textContent = currentUser.email;
  
  // Set avatar initial
  if (avatarEl && currentUser.name) {
    const initial = currentUser.name.charAt(0).toUpperCase();
    avatarEl.textContent = initial;
  }
}

function updateAdminInfo() {
  if (!isAdmin) return;
  
  const adminData = getAdminData();
  const users = getUsersData();
  
  const adminInfoEl = document.getElementById('currentAdminInfo');
  const totalUsersEl = document.getElementById('totalUsersCount');
  
  if (adminInfoEl && adminData) {
    adminInfoEl.textContent = `${adminData.name} • ${adminData.companyName}`;
  }
  
  if (totalUsersEl) {
    totalUsersEl.textContent = users.length;
  }
}

function loadUsersTable() {
  if (!isAdmin) return;
  
  const users = getUsersData();
  const tbody = document.getElementById('usersTableBody');
  const noUsersMsg = document.getElementById('noUsersMsg');
  
  if (!tbody) return;
  
  if (users.length === 0) {
    tbody.innerHTML = '';
    if (noUsersMsg) noUsersMsg.classList.remove('hidden');
    return;
  }
  
  if (noUsersMsg) noUsersMsg.classList.add('hidden');
  
  tbody.innerHTML = users.map(user => {
    const date = new Date(user.createdAt).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
    
    return `
      <tr>
        <td><strong>${escapeHtml(user.name)}</strong></td>
        <td>${escapeHtml(user.email)}</td>
        <td>${date}</td>
        <td>
          <button class="btn-sm btn-delete" onclick="deleteUser('${user.id}')">
            🗑️ Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function deleteUser(userId) {
  if (!isAdmin) return;
  
  if (!confirm('Are you sure you want to delete this user?')) return;
  
  let users = getUsersData();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex > -1) {
    const deletedName = users[userIndex].name;
    users.splice(userIndex, 1);
    saveUsersData(users);
    
    loadUsersTable();
    updateAdminInfo();
    showToast(`✓ User "${deletedName}" deleted`);
  }
}

function clearAllData() {
  if (!isAdmin) return;
  
  if (!confirm('⚠️ WARNING: This will delete ALL data including admin account!\n\nAre you absolutely sure?')) return;
  
  // Double confirmation
  const confirmText = prompt('Type "DELETE ALL" to confirm:');
  if (confirmText !== 'DELETE ALL') {
    showToast('⚠️ Operation cancelled');
    return;
  }
  
  localStorage.removeItem(CONFIG.STORAGE_KEYS.ADMIN);
  localStorage.removeItem(CONFIG.STORAGE_KEYS.USERS);
  clearSession();
  
  currentUser = null;
  isAdmin = false;
  
  showToast('✓ All data cleared. Default admin restored.');
  setTimeout(() => {
    location.reload();
  }, 1500);
}

/* ============== UTILITY FUNCTIONS ============== */

function showError(element, message, isAdminForm = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.remove('hidden');
  element.className = isAdminForm ? 'admin-msg error' : 'auth-error';
}

function showSuccess(element, message) {
  if (!element) return;
  element.textContent = message;
  element.classList.remove('hidden');
  element.className = 'admin-msg success';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

/* ============== CROSS-DEVICE SYNC (Optional) ============== */

async function syncToServer(type, data) {
  if (!CONFIG.SYNC_ENDPOINT) return;
  
  try {
    await fetch(CONFIG.SYNC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data, timestamp: Date.now() })
    });
  } catch (e) {
    console.warn('Sync failed:', e);
  }
}

async function syncFromServer() {
  if (!CONFIG.SYNC_ENDPOINT) return null;
  
  try {
    const response = await fetch(CONFIG.SYNC_ENDPOINT);
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.warn('Fetch sync failed:', e);
  }
  return null;
}

/* ============== CALCULATOR LOGIC ============== */

let pfApplicable = 'Y';
let calcResult = null;
let gratuityMode = 'auto';
let leaveMode = 'auto';

function setPF(val) {
  pfApplicable = val;
  const pfYes = document.getElementById('pfYes');
  const pfNo = document.getElementById('pfNo');
  const hint = document.getElementById('pfHint');
  
  if (pfYes) pfYes.classList.toggle('active', val === 'Y');
  if (pfNo) pfNo.classList.toggle('active', val === 'N');
  
  if (hint) {
    hint.textContent = val === 'Y' 
      ? '55% of Gross or Min Wage (whichever is higher) → Basic'
      : '53% of Gross or Min Wage (whichever is higher) → Basic';
  }
  liveCalc();
}

function setGratuityMode(mode) {
  gratuityMode = mode;
  const autoBtn = document.getElementById('gratuityAuto');
  const manualBtn = document.getElementById('gratuityManual');
  const manualInput = document.getElementById('gratuityManualWrapper');
  const hint = document.getElementById('gratuityHint');

  if (autoBtn) autoBtn.classList.toggle('active', mode === 'auto');
  if (manualBtn) manualBtn.classList.toggle('active', mode === 'manual');

  if (manualInput) {
    manualInput.classList.toggle('hidden', mode !== 'manual');
  }
  if (hint) {
    hint.textContent = mode === 'manual' 
      ? 'Enter custom monthly gratuity amount'
      : 'Formula: Basic ÷ 26 × 15 ÷ 12 (monthly provision)';
  }
  liveCalc();
}

function setLeaveMode(mode) {
  leaveMode = mode;
  const autoBtn = document.getElementById('leaveAuto');
  const manualBtn = document.getElementById('leaveManual');
  const manualInput = document.getElementById('leaveManualWrapper');
  const hint = document.getElementById('leaveHint');

  if (autoBtn) autoBtn.classList.toggle('active', mode === 'auto');
  if (manualBtn) manualBtn.classList.toggle('active', mode === 'manual');

  if (manualInput) {
    manualInput.classList.toggle('hidden', mode !== 'manual');
  }
  if (hint) {
    hint.textContent = mode === 'manual'
      ? 'Enter custom monthly leave encashment amount'
      : 'Formula: Basic ÷ 26 × 1.25 (monthly provision for 15 leaves/yr)';
  }
  liveCalc();
}

function computeCTC(gross, minWage, pf, pt, lwf, gratuityOverride, leaveOverride) {
  gross = Math.round(gross);
  minWage = Math.round(minWage);

  let basicPct = pf === 'Y' ? 0.55 : 0.53;
  let basicFromGross = Math.round(gross * basicPct);
  let basic = Math.max(basicFromGross, minWage);
  basic = Math.min(basic, gross);

  let hra = Math.round(basic * 0.5);
  let conv = Math.max(gross - basic - hra, 0);

  if (basic + hra > gross) {
    hra = gross - basic;
    conv = 0;
  }

  let epfEmployer = pf === 'Y' ? Math.min(Math.round(basic * 0.125), 1875) : 0;
  let edliEmployer = pf === 'Y' ? Math.min(Math.round(basic * 0.005), 75) : 0;
  let bonus = basic <= 21000 ? Math.round(minWage * 0.0833) : 0;
  let initialCTC = gross + epfEmployer + edliEmployer + bonus;
  let esiEmployer = basic <= 21000 ? Math.round(basic * 0.0325) : 0;

  let gratuityAuto = Math.round((basic / 26) * 15 / 12);
  let gratuity = (gratuityOverride !== null && gratuityOverride >= 0)
    ? Math.round(gratuityOverride)
    : gratuityAuto;

  let leaveAuto = Math.round((basic / 26) * 1.25);
  let leaveComponent = (leaveOverride !== null && leaveOverride >= 0)
    ? Math.round(leaveOverride)
    : leaveAuto;

  let finalCTC = initialCTC + esiEmployer + gratuity + lwf + leaveComponent;

  let epfEmployee = pf === 'Y' ? Math.min(Math.round(basic * 0.12), 1800) : 0;
  let esiEmployee = basic <= 21000 ? Math.round(basic * 0.0075) : 0;
  let lwfEmployee = lwf;
  let ptDeduction = pt;
  let cashInHand = gross - epfEmployee - esiEmployee - lwfEmployee - ptDeduction;

  return {
    gross, basic, hra, conv, minWage, pfApplicable: pf,
    epfEmployer, edliEmployer, bonus, initialCTC,
    esiEmployer, gratuity, gratuityAuto,
    leaveComponent, leaveAuto, lwf,
    finalCTC, finalCTCAnnual: finalCTC * 12,
    epfEmployee, esiEmployee, lwfEmployee, ptDeduction, cashInHand,
    gratuityMode: (gratuityOverride !== null && gratuityOverride >= 0) ? 'manual' : 'auto',
    leaveMode: (leaveOverride !== null && leaveOverride >= 0) ? 'manual' : 'auto',
  };
}

function updateGratuityPlaceholder() {
  const gross = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  const minWage = parseFloat(document.getElementById('minWage')?.value) || 0;
  const input = document.getElementById('gratuityCustom');
  if (!input) return;

  if (gross > 0 && minWage > 0) {
    const basicPct = pfApplicable === 'Y' ? 0.55 : 0.53;
    const basic = Math.min(Math.max(Math.round(gross * basicPct), minWage), gross);
    const autoVal = Math.round((basic / 26) * 15 / 12);
    input.placeholder = `Auto = ₹${autoVal.toLocaleString('en-IN')}`;
  } else {
    input.placeholder = 'e.g. 500';
  }
}

function updateLeavePlaceholder() {
  const gross = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  const minWage = parseFloat(document.getElementById('minWage')?.value) || 0;
  const input = document.getElementById('leaveCustom');
  if (!input) return;

  if (gross > 0 && minWage > 0) {
    const basicPct = pfApplicable === 'Y' ? 0.55 : 0.53;
    const basic = Math.min(Math.max(Math.round(gross * basicPct), minWage), gross);
    const autoVal = Math.round((basic / 26) * 1.25);
    input.placeholder = `Auto = ₹${autoVal.toLocaleString('en-IN')}`;
  } else {
    input.placeholder = 'e.g. 200';
  }
}

function liveCalc() {
  updateGratuityPlaceholder();
  updateLeavePlaceholder();

  const gross = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  const minWage = parseFloat(document.getElementById('minWage')?.value) || 0;
  if (gross > 0 && minWage > 0) {
    calculate(true);
  }
}

function calculate(silent = false) {
  const gross = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  const minWage = parseFloat(document.getElementById('minWage')?.value) || 0;
  const pt = parseFloat(document.getElementById('ptAmount')?.value) || 0;
  const lwf = parseFloat(document.getElementById('lwfAmount')?.value) || 0;

  if (gross <= 0 || minWage <= 0) {
    if (!silent) showToast('⚠️ Please enter Gross Salary and Minimum Wage');
    return;
  }

  let gratuityOverride = null;
  if (gratuityMode === 'manual') {
    const val = parseFloat(document.getElementById('gratuityCustom')?.value);
    if (!isNaN(val) && val >= 0) gratuityOverride = val;
  }

  let leaveOverride = null;
  if (leaveMode === 'manual') {
    const val = parseFloat(document.getElementById('leaveCustom')?.value);
    if (!isNaN(val) && val >= 0) leaveOverride = val;
  }

  const r = computeCTC(gross, minWage, pfApplicable, pt, lwf, gratuityOverride, leaveOverride);
  calcResult = r;

  renderSummary(r);
  renderBreakdown(r);
  renderExportPreview(r);

  if (!silent) showToast('✓ CTC Calculated Successfully');
}

function fmt(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function pct(part, total) {
  if (!total) return '0%';
  return (part / total * 100).toFixed(1) + '%';
}

function renderSummary(r) {
  safeToggle('summaryEmpty', true);
  safeToggle('summaryResults', false);

  setText('r_initialCTC', fmt(r.initialCTC));
  setText('annualCTC', fmt(r.finalCTCAnnual));
  setText('monthlyCTC', fmt(r.finalCTC));
  setText('r_basic', fmt(r.basic));
  setText('r_hra', fmt(r.hra));
  setText('r_conv', fmt(r.conv));
  setText('r_gross', fmt(r.gross));
  setText('r_cash', fmt(r.cashInHand));
  setText('r_bonus', r.bonus > 0 ? fmt(r.bonus) : 'N/A');
}

function setText(elementId, text) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = text;
}

function renderBreakdown(r) {
  safeToggle('breakdownEmpty', true);
  safeToggle('breakdownContent', false);

  // Salary Structure
  const salRows = [
    ['Basic', r.basic],
    ['HRA (50% of Basic)', r.hra],
    ['Conveyance / Other', r.conv],
  ];
  let salHtml = '';
  salRows.forEach(([label, val]) => {
    salHtml += `<tr><td>${label}</td><td>${fmt(val)}</td><td>${pct(val, r.gross)}</td></tr>`;
  });
  setTextContent('salaryTable', salHtml);
  setText('tfoot_gross', fmt(r.gross));

  // Employer Contributions
  const empRows = [
    ['EPF – Employer @ 12.5% of Basic', '12.5% (max ₹1,875)', r.epfEmployer],
    ['EDLI – Employer @ 0.5% upto ₹15,000', '0.5% (max ₹75)', r.edliEmployer],
    ['Bonus (8.33% of Min Wage, if Basic ≤ ₹21,000)', '8.33%', r.bonus],
  ];
  let empHtml = '';
  empRows.forEach(([label, rate, val]) => {
    empHtml += `<tr><td>${label}</td><td style="color:var(--text-dim)">${rate}</td><td>${val > 0 ? fmt(val) : '<span style="color:var(--text-muted)">—</span>'}</td></tr>`;
  });
  setTextContent('employerTable', empHtml);
  setText('tfoot_initialCTC', fmt(r.initialCTC));

  // Deductions
  const dedRows = [
    ['EPF – Employee @ 12% of Basic', '12% (max ₹1,800)', r.epfEmployee, r.pfApplicable === 'Y'],
    ['ESI – Employee @ 0.75% (Gross ≤ ₹21,000)', '0.75%', r.esiEmployee, r.gross <= 21000],
    ['LWF – Employee', 'Fixed', r.lwfEmployee, r.lwfEmployee > 0],
    ['Professional Tax', 'State', r.ptDeduction, r.ptDeduction > 0],
  ];
  let dedHtml = '';
  dedRows.forEach(([label, rate, val, applicable]) => {
    const dispVal = applicable && val > 0
      ? `<span style="color:var(--danger)">${fmt(val)}</span>`
      : `<span style="color:var(--text-muted)">—</span>`;
    dedHtml += `<tr><td>${label}</td><td style="color:var(--text-dim)">${rate}</td><td>${dispVal}</td></tr>`;
  });
  setTextContent('deductionTable', dedHtml);
  setText('tfoot_cash', fmt(r.cashInHand));

  // Final Items
  const empName = (document.getElementById('empName')?.value || '').trim() || 'Employee';
  const gratuityLabel = r.gratuityMode === 'manual'
    ? `Gratuity <span style="font-size:9px;color:var(--accent2);font-weight:600;background:rgba(159,122,234,0.15);padding:2px 6px;border-radius:4px;margin-left:4px;">CUSTOM</span>`
    : `Gratuity <span style="font-size:9px;color:var(--text-muted);font-weight:600;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;margin-left:4px;">AUTO</span>`;
  const leaveLabel = r.leaveMode === 'manual'
    ? `Leave Component <span style="font-size:9px;color:var(--accent2);font-weight:600;background:rgba(159,122,234,0.15);padding:2px 6px;border-radius:4px;margin-left:4px;">CUSTOM</span>`
    : `Leave Component <span style="font-size:9px;color:var(--text-muted);font-weight:600;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;margin-left:4px;">AUTO</span>`;
  const gratuitySubText = r.gratuityMode === 'manual' ? `Manual override (Auto would be ${fmt(r.gratuityAuto)})` : 'Basic/26 × 15 ÷ 12';
  const leaveSubText = r.leaveMode === 'manual' ? `Manual override (Auto would be ${fmt(r.leaveAuto)})` : 'Basic/26 × 1.25';

  const finalItemsData = [
    { label: 'Gross Salary', val: fmt(r.gross), sub: 'Monthly', cls: '' },
    { label: 'Initial CTC', val: fmt(r.initialCTC), sub: 'Gross + Employer Contributions', cls: '' },
    { label: 'ESI – Employer', val: r.esiEmployer > 0 ? fmt(r.esiEmployer) : 'N/A', sub: '3.25% of Gross (if ≤ ₹21k)', cls: '' },
    { label: gratuityLabel, val: fmt(r.gratuity), sub: gratuitySubText, cls: '' },
    { label: leaveLabel, val: fmt(r.leaveComponent), sub: leaveSubText, cls: '' },
    { label: 'Final CTC (Monthly)', val: fmt(r.finalCTC), sub: empName, cls: 'highlight' },
    { label: 'Final CTC (Annual)', val: fmt(r.finalCTCAnnual), sub: empName, cls: 'highlight' },
    { label: 'Cash in Hand', val: fmt(r.cashInHand), sub: 'After all deductions', cls: 'green' },
    { label: 'PF Applicable', val: r.pfApplicable === 'Y' ? 'Yes' : 'No', sub: r.pfApplicable === 'Y' ? '55% Basic Rule' : '53% Basic Rule', cls: 'purple' },
  ];

  let fiHtml = '';
  finalItemsData.forEach(item => {
    fiHtml += `<div class="final-item ${item.cls}"><div class="fi-label">${item.label}</div><div class="fi-val">${item.val}</div><div class="fi-sub">${item.sub}</div></div>`;
  });
  setTextContent('finalItems', fiHtml);
}

function setTextContent(elementId, html) {
  const el = document.getElementById(elementId);
  if (el) el.innerHTML = html;
}

function renderExportPreview(r) {
  const rows = [
    ['SALARY STRUCTURE', '', true],
    ['Basic', fmt(r.basic), false],
    ['HRA', fmt(r.hra), false],
    ['Conveyance', fmt(r.conv), false],
    ['Gross Salary', fmt(r.gross), false],
    ['EMPLOYER CONTRIBUTIONS', '', true],
    ['EPF Employer (12.5%)', fmt(r.epfEmployer), false],
    ['EDLI Employer (0.5%)', fmt(r.edliEmployer), false],
    ['Bonus (8.33% of Min Wage)', fmt(r.bonus), false],
    ['Initial CTC', fmt(r.initialCTC), false],
    ['ESI Employer (3.25%)', fmt(r.esiEmployer), false],
    [`Gratuity (${r.gratuityMode === 'manual' ? 'Custom' : 'Auto'})`, fmt(r.gratuity), false],
    [`Leave Component (${r.leaveMode === 'manual' ? 'Custom' : 'Auto'})`, fmt(r.leaveComponent), false],
    ['EMPLOYEE DEDUCTIONS', '', true],
    ['EPF Employee (12%)', fmt(r.epfEmployee), false],
    ['ESI Employee (0.75%)', fmt(r.esiEmployee), false],
    ['Professional Tax', fmt(r.ptDeduction), false],
    ['FINAL TOTALS', '', true],
    ['Final CTC (Monthly)', fmt(r.finalCTC), false],
    ['Final CTC (Annual)', fmt(r.finalCTCAnnual), false],
    ['Cash in Hand', fmt(r.cashInHand), false],
  ];

  let html = '<table class="preview-table">';
  rows.forEach(([label, val, isHead]) => {
    if (isHead) {
      html += `<tr class="section-head"><td colspan="2">${label}</td></tr>`;
    } else {
      html += `<tr><td>${label}</td><td>${val}</td></tr>`;
    }
  });
  html += '</table>';
  setTextContent('exportPreview', html);
}

function switchTab(tab) {
  document.querySelectorAll('.tab-panel')?.forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item')?.forEach(b => b.classList.remove('active'));

  const tabPanel = document.getElementById('tab-' + tab);
  const navBtn = document.querySelector(`[data-tab="${tab}"]`);
  
  if (tabPanel) tabPanel.classList.add('active');
  if (navBtn) navBtn.classList.add('active');
}

function resetAll() {
  const fields = ['empName', 'grossSalary', 'minWage', 'ptAmount', 'lwfAmount'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'ptAmount' || id === 'lwfAmount' ? '0' : '';
  });
  
  setText('r_initialCTC', '—');

  gratuityMode = 'auto';
  setGratuityMode('auto');
  const gratuityCustom = document.getElementById('gratuityCustom');
  if (gratuityCustom) gratuityCustom.value = '';

  leaveMode = 'auto';
  setLeaveMode('auto');
  const leaveCustom = document.getElementById('leaveCustom');
  if (leaveCustom) leaveCustom.value = '';

  pfApplicable = 'Y';
  const pfYes = document.getElementById('pfYes');
  const pfNo = document.getElementById('pfNo');
  const pfHint = document.getElementById('pfHint');
  
  if (pfYes) pfYes.classList.add('active');
  if (pfNo) pfNo.classList.remove('active');
  if (pfHint) pfHint.textContent = '55% of Gross or Min Wage (whichever is higher) → Basic';

  safeToggle('summaryEmpty', false);
  safeToggle('summaryResults', true);
  safeToggle('breakdownEmpty', false);
  safeToggle('breakdownContent', true);
  
  const exportPreview = document.getElementById('exportPreview');
  if (exportPreview) exportPreview.innerHTML = '<div class="preview-empty">Calculate first to see export preview</div>';

  calcResult = null;
  showToast('↺ Calculator Reset');
}

function exportPDF() {
  if (!calcResult) { showToast('⚠️ Please calculate first'); return; }
  const r = calcResult;
  const empName = (document.getElementById('empName')?.value || '').trim() || 'Employee';
  const now = new Date().toLocaleDateString('en-IN');

  const content = `
CTC CALCULATION REPORT — NEW LABOUR LAW 2024
============================================
Date: ${now}
Employee: ${empName}
PF Applicable: ${r.pfApplicable === 'Y' ? 'Yes' : 'No'}
State Min Wage: ${fmt(r.minWage)}

SALARY STRUCTURE (MONTHLY)
—————————————————————————
Basic Salary      : ${fmt(r.basic)}  (${pct(r.basic, r.gross)} of Gross)
HRA               : ${fmt(r.hra)}    (50% of Basic)
Conveyance/Other  : ${fmt(r.conv)}
────────────────────────
Gross Salary      : ${fmt(r.gross)}

EMPLOYER CONTRIBUTIONS
—————————————————————
EPF Employer      : ${fmt(r.epfEmployer)}
EDLI Employer     : ${fmt(r.edliEmployer)}
Bonus             : ${fmt(r.bonus)}
ESI Employer      : ${fmt(r.esiEmployer)}
Gratuity (${r.gratuityMode === 'manual' ? 'Custom' : 'Auto: Basic/26×15÷12'}) : ${fmt(r.gratuity)}${r.gratuityMode === 'manual' ? ` (Auto would be ${fmt(r.gratuityAuto)})` : ''}
Leave Component (${r.leaveMode === 'manual' ? 'Custom' : 'Auto: Basic/26×1.25'}) : ${fmt(r.leaveComponent)}${r.leaveMode === 'manual' ? ` (Auto would be ${fmt(r.leaveAuto)})` : ''}
────────────────────────
Initial CTC       : ${fmt(r.initialCTC)}
Final CTC (Monthly) : ${fmt(r.finalCTC)}
Final CTC (Annual)  : ${fmt(r.finalCTCAnnual)}

EMPLOYEE DEDUCTIONS
——————————————————
EPF Employee      : ${fmt(r.epfEmployee)}
ESI Employee      : ${fmt(r.esiEmployee)}
Professional Tax  : ${fmt(r.ptDeduction)}
LWF               : ${fmt(r.lwfEmployee)}
────────────────────────
NET CASH IN HAND  : ${fmt(r.cashInHand)}

Formula: As per New Labour Code — Basic = MAX(${r.pfApplicable === 'Y' ? '55%' : '53%'} of Gross, Min Wage)
`;

  const blob = new Blob([content], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `CTC_Report_${empName.replace(/\s+/g, '_')}.txt`;
  link.click();
  showToast('✓ Report Downloaded');
}

function exportCSV() {
  if (!calcResult) { showToast('⚠️ Please calculate first'); return; }
  const r = calcResult;
  const empName = (document.getElementById('empName')?.value || '').trim() || 'Employee';

  const rows = [
    ['Component', 'Amount (Monthly)', 'Notes'],
    ['Employee Name', empName, ''],
    ['PF Applicable', r.pfApplicable, ''],
    ['State Min Wage', r.minWage, ''],
    ['', '', ''],
    ['=== SALARY STRUCTURE ===', '', ''],
    ['Basic', r.basic, `MAX(${r.pfApplicable === 'Y' ? '55%' : '53%'} of Gross, MinWage)`],
    ['HRA', r.hra, '50% of Basic'],
    ['Conveyance / Other', r.conv, 'Residual'],
    ['Gross Salary', r.gross, ''],
    ['', '', ''],
    ['=== EMPLOYER CONTRIBUTIONS ===', '', ''],
    ['EPF Employer', r.epfEmployer, '12.5% of Basic (max ₹1875)'],
    ['EDLI Employer', r.edliEmployer, '0.5% of Basic (max ₹75)'],
    ['Bonus', r.bonus, '8.33% of Min Wage (if Basic ≤ ₹21000)'],
    ['Initial CTC', r.initialCTC, ''],
    ['ESI Employer', r.esiEmployer, '3.25% of Gross (if ≤ ₹21000)'],
    [`Gratuity (${r.gratuityMode})`, r.gratuity, r.gratuityMode === 'manual' ? `Custom (Auto=${r.gratuityAuto})` : 'Basic/26×15÷12'],
    [`Leave Component (${r.leaveMode})`, r.leaveComponent, r.leaveMode === 'manual' ? `Custom (Auto=${r.leaveAuto})` : 'Basic/26×1.25'],
    ['Final CTC Monthly', r.finalCTC, ''],
    ['Final CTC Annual', r.finalCTCAnnual, ''],
    ['', '', ''],
    ['=== EMPLOYEE DEDUCTIONS ===', '', ''],
    ['EPF Employee', r.epfEmployee, '12% of Basic (max ₹1800)'],
    ['ESI Employee', r.esiEmployee, '0.75% of Gross (if ≤ ₹21000)'],
    ['Professional Tax', r.ptDeduction, ''],
    ['LWF', r.lwfEmployee, ''],
    ['Cash in Hand', r.cashInHand, ''],
  ];

  let csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `CTC_Breakdown_${empName.replace(/\s+/g, '_')}.csv`;
  link.click();
  showToast('✓ CSV Downloaded');
}

function copyToClipboard() {
  if (!calcResult) { showToast('⚠️ Please calculate first'); return; }
  const r = calcResult;
  const empName = (document.getElementById('empName')?.value || '').trim() || 'Employee';

  const text = [
    `CTC Report — ${empName}`,
    `Basic\t${r.basic}`,
    `HRA\t${r.hra}`,
    `Conveyance\t${r.conv}`,
    `Gross\t${r.gross}`,
    `EPF (Employer)\t${r.epfEmployer}`,
    `EDLI (Employer)\t${r.edliEmployer}`,
    `Bonus\t${r.bonus}`,
    `ESI (Employer)\t${r.esiEmployer}`,
    `Gratuity (${r.gratuityMode})\t${r.gratuity}`,
    `Leave Component (${r.leaveMode})\t${r.leaveComponent}`,
    `Final CTC (Monthly)\t${r.finalCTC}`,
    `Final CTC (Annual)\t${r.finalCTCAnnual}`,
    `Cash in Hand\t${r.cashInHand}`,
  ].join('\n');

  navigator.clipboard.writeText(text).then(() => {
    showToast('⎘ Copied to clipboard');
  }).catch(() => {
    showToast('⚠️ Copy failed — try downloading instead');
  });
}

// Keyboard shortcut: Enter to calculate
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.target.matches('input[type="password"]')) {
    const mainApp = document.getElementById('mainApp');
    if (mainApp && !mainApp.classList.contains('hidden')) {
      calculate();
    }
  }
});