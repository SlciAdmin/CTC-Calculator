/* ============================================
   CTC CALCULATOR — FIREBASE AUTH + LOGIC
   New Labour Code | Cross-Device Login System
   LWF + PT: State-wise Auto Calculation (v5.1)
   BULK UPLOAD: Fully Fixed & Parity with Individual
   Conveyance → Special Allowance when Gross > ₹1,00,000
   ============================================ */

// 🔥 FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyBYmsh-IgGPtx804pIWnc7UJ_AvlR51CIo",
  authDomain: "ctc-calculator-51f6d.firebaseapp.com",
  projectId: "ctc-calculator-51f6d",
  storageBucket: "ctc-calculator-51f6d.firebasestorage.app",
  messagingSenderId: "774507368996",
  appId: "1:774507368996:web:fb59fa486bece0bf4c3eb1",
  measurementId: "G-DBRLCZ7VL4"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ============== GLOBAL STATE ==============
let currentUser = null;
let isAdmin = false;
let currentUserId = null;

let pfApplicable = 'Y';
let calcResult = null;
let gratuityMode = 'auto';
let leaveMode = 'auto';
let lwfMode = 'auto';
let ptMode = 'auto';

// ============== HELPER: Conveyance Label ==============
// Jab gross > 1,00,000 ho tab "Special Allowance" warna "Conveyance / Other"
function getConvLabel(gross) {
  return (gross > 100000) ? 'Defer Allowance' : 'Conveyance / Other';
}

// ============== LWF STATE-WISE CONFIG ==============
const LWF_STATES = {
  TN:    { name: 'Tamil Nadu',       months: 'dec',     amount: 20,    formula: null },
  AP:    { name: 'Andhra Pradesh',   months: 'dec',     amount: 30,    formula: null },
  SKL:   { name: 'Kerala',           months: 'all',     amount: 20,    formula: null },
  FKL:   { name: 'Karnataka',        months: 'jun-dec', amount: 20,    formula: null },
  MH:    { name: 'Maharashtra',      months: 'jun-dec', amount: 25,    formula: null },
  Goa:   { name: 'Goa',              months: 'jun-dec', amount: 60,    formula: null },
  DL:    { name: 'Delhi',            months: 'jun-dec', amount: 0.75,  formula: null },
  CH:    { name: 'Chandigarh',       months: 'all',     amount: 5,     formula: null },
  MP:    { name: 'Madhya Pradesh',   months: 'jun-dec', amount: 10,    formula: null },
  CG:    { name: 'Chhattisgarh',     months: 'jun-dec', amount: 15,    formula: null },
  WB:    { name: 'West Bengal',      months: 'jun-dec', amount: 3,     formula: null },
  OD:    { name: 'Odisha',           months: 'jun-dec', amount: 10,    formula: null },
  HR:    { name: 'Haryana',          months: 'all',     amount: null,  formula: 'hr' },
  OTHER: { name: 'Other',            months: 'none',    amount: 0,     formula: null },
};

function computeLWFAuto(stateCode, month, gross, hasLeaves) {
  if (!hasLeaves) return 0;
  if (!stateCode || !LWF_STATES[stateCode]) return 0;
  const state = LWF_STATES[stateCode];
  if (state.formula === 'hr') {
    const hrVal = gross * 0.002;
    return hrVal <= 34 ? Math.round(hrVal * 100) / 100 : 34;
  }
  const isDecember = month === 12;
  const isJuneOrDec = month === 6 || month === 12;
  switch (state.months) {
    case 'all':     return state.amount;
    case 'dec':     return isDecember ? state.amount : 0;
    case 'jun-dec': return isJuneOrDec ? state.amount : 0;
    case 'none':    return 0;
    default:        return 0;
  }
}

function getLWFHint(stateCode, month, gross) {
  if (!stateCode || !LWF_STATES[stateCode]) return 'Select a state to see LWF rule';
  const state = LWF_STATES[stateCode];
  const monthName = new Date(2024, month - 1, 1).toLocaleString('en-IN', { month: 'long' });
  if (stateCode === 'OTHER') return 'No LWF applicable for selected state';
  if (state.formula === 'hr') {
    const hrVal = gross * 0.002;
    const cap = hrVal <= 34 ? hrVal : 34;
    return `HR Formula: Gross × 0.2% = ₹${hrVal.toFixed(2)} → Capped at ₹34 → Result: ₹${cap.toFixed(2)}`;
  }
  const appMonths = { 'all': 'every month', 'dec': 'December only', 'jun-dec': 'June & December only', 'none': 'never' };
  const isApplicable = computeLWFAuto(stateCode, month, gross, true) > 0;
  const rule = appMonths[state.months] || '';
  return `${state.name}: ₹${state.amount} applicable ${rule}. ${monthName} → ${isApplicable ? 'APPLICABLE ✓' : 'NOT applicable this month'}`;
}

// ============== LWF UI FUNCTIONS ==============
function setLWFMode(mode) {
  lwfMode = mode;
  const autoBtn = document.getElementById('lwfAuto');
  const manualBtn = document.getElementById('lwfManual');
  const autoWrapper = document.getElementById('lwfAutoWrapper');
  const manualWrapper = document.getElementById('lwfManualWrapper');
  if (autoBtn) autoBtn.classList.toggle('active', mode === 'auto');
  if (manualBtn) manualBtn.classList.toggle('active', mode === 'manual');
  if (autoWrapper) autoWrapper.classList.toggle('hidden', mode !== 'auto');
  if (manualWrapper) manualWrapper.classList.toggle('hidden', mode !== 'manual');
  if (mode === 'auto') updateLWFAuto();
  liveCalc();
}

function updateLWFAuto() {
  const stateEl = document.getElementById('lwfState');
  const monthEl = document.getElementById('lwfMonth');
  const resultEl = document.getElementById('lwfAutoValue');
  const hintEl = document.getElementById('lwfAutoHint');
  if (!stateEl || !monthEl) return;
  const stateCode = stateEl.value;
  const month = parseInt(monthEl.value) || 12;
  const gross = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  if (!stateCode) {
    if (resultEl) resultEl.textContent = 'Select state to calculate';
    if (hintEl) hintEl.textContent = 'Select state and month to auto-calculate LWF';
    liveCalc();
    return;
  }
  const lwfVal = computeLWFAuto(stateCode, month, gross, true);
  const hint = getLWFHint(stateCode, month, gross);
  if (resultEl) {
    resultEl.textContent = lwfVal > 0 ? `₹${lwfVal}` : '₹0 (Not applicable this month)';
    resultEl.style.color = lwfVal > 0 ? 'var(--accent3)' : 'var(--text-muted)';
  }
  if (hintEl) hintEl.textContent = hint;
  liveCalc();
}

function getLWFValue() {
  if (lwfMode === 'manual') {
    return parseFloat(document.getElementById('lwfAmount')?.value) || 0;
  }
  const stateEl = document.getElementById('lwfState');
  const monthEl = document.getElementById('lwfMonth');
  if (!stateEl || !monthEl || !stateEl.value) return 0;
  const stateCode = stateEl.value;
  const month = parseInt(monthEl.value) || 12;
  const gross = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  return computeLWFAuto(stateCode, month, gross, true);
}

function getLWFLabel() {
  if (lwfMode === 'manual') return 'LWF (Manual)';
  const stateEl = document.getElementById('lwfState');
  if (!stateEl || !stateEl.value) return 'LWF (Auto)';
  const stateCode = stateEl.value;
  const state = LWF_STATES[stateCode];
  if (!state) return 'LWF (Auto)';
  return `LWF – ${state.name}`;
}

// ============== PROFESSIONAL TAX STATE-WISE CONFIG ==============
const PT_STATES = {
  KA: {
    name: 'Karnataka',
    rules: [ { min: 24999, max: null, amount: (month) => month === 2 ? 300 : 200 } ]
  },
  OD: {
    name: 'Odisha',
    rules: [
      { min: 13305, max: 25000, amount: 125 },
      { min: 25001, max: null, amount: (month) => month === 2 ? 300 : 200 }
    ]
  },
  GJ: {
    name: 'Gujarat',
    rules: [
      { min: 6000, max: 0, amount: 8 },
      { min: 9000, max: 0, amount: 0 },
      { min: 12000, max: null, amount: 200 }
    ]
  },
  MH: {
    name: 'Maharashtra',
    rules: [
      { min: 7501, max: 10000, amount: 175, gender: 'Male' },
      { min: 10001, max: null, amount: (month) => month === 2 ? 300 : 200, gender: 'Male' },
      { min: 25001, max: null, amount: (month) => month === 2 ? 300 : 200, gender: 'Female' }
    ]
  },
  MH1: {
    name: 'Maharashtra Metro',
    rules: [
      { min: 7501, max: 10000, amount: 175, gender: 'Male' },
      { min: 10001, max: null, amount: (month) => month === 2 ? 300 : 200, gender: 'Male' },
      { min: 25001, max: null, amount: (month) => month === 2 ? 300 : 200, gender: 'Female' }
    ]
  },
  AP: {
    name: 'Andhra Pradesh',
    rules: [
      { min: 15001, max: 20000, amount: 150 },
      { min: 20001, max: null, amount: 200 }
    ]
  },
  TS: {
    name: 'Telangana',
    rules: [
      { min: 15001, max: 20000, amount: 150 },
      { min: 20001, max: null, amount: 200 }
    ]
  },
  AS: {
    name: 'Assam',
    rules: [
      { min: 10001, max: 15000, amount: 150 },
      { min: 15001, max: 25000, amount: 180 },
      { min: 25001, max: null, amount: 208 }
    ]
  },
  SK: {
    name: 'Sikkim',
    rules: [
      { min: 20001, max: 30000, amount: 125 },
      { min: 30001, max: 40000, amount: 150 },
      { min: 40001, max: null, amount: 200 }
    ]
  },
  KL: {
    name: 'Kerala',
    rules: [
      { min: 12000, max: 17999, amount: 120, month: 6 },
      { min: 18000, max: 29999, amount: 180, month: 6 },
      { min: 30000, max: 44999, amount: 300, month: 6 },
      { min: 45000, max: 59999, amount: 450, month: 6 },
      { min: 60000, max: 74999, amount: 600, month: 6 },
      { min: 75000, max: 99999, amount: 750, month: 6 },
      { min: 100000, max: 124999, amount: 1000, month: 6 },
      { min: 125000, max: null, amount: 1250, month: 6 }
    ]
  },
  PB: {
    name: 'Punjab',
    rules: [ { min: 20833, max: null, amount: 200 } ]
  },
  GA: {
    name: 'Goa',
    rules: [
      { min: 15001, max: 25000, amount: 150 },
      { min: 25001, max: null, amount: 200 }
    ]
  },
  BR: {
    name: 'Bihar',
    rules: [
      { min: 25001, max: 41666, amount: 83.33 },
      { min: 41667, max: 83333, amount: 166.67 },
      { min: 83334, max: null, amount: 208.33 }
    ]
  },
  MP: {
    name: 'Madhya Pradesh',
    rules: [
      { min: 18751, max: 25000, amount: 125 },
      { min: 25001, max: 33333, amount: 166 },
      { min: 33334, max: null, amount: (month) => month === 3 ? 208 : 212 }
    ]
  },
  ML: {
    name: 'Meghalaya',
    rules: [
      { min: 4167, max: 6250, amount: 16.50 },
      { min: 6251, max: 8333, amount: 25 },
      { min: 8334, max: 12500, amount: 41.50 },
      { min: 12501, max: 16666, amount: 62.50 },
      { min: 16667, max: 20833, amount: 83.33 },
      { min: 20834, max: 25000, amount: 104.16 },
      { min: 25001, max: 29166, amount: 125 },
      { min: 29167, max: 33333, amount: 150 },
      { min: 33334, max: 37500, amount: 175 },
      { min: 37501, max: 41666, amount: 200 },
      { min: 41667, max: null, amount: 208 }
    ]
  },
  WB: {
    name: 'West Bengal',
    rules: [
      { min: 10001, max: 15000, amount: 110 },
      { min: 15001, max: 25000, amount: 130 },
      { min: 25001, max: 40000, amount: 150 },
      { min: 40001, max: null, amount: 200 }
    ]
  },
  TN: {
    name: 'Tamil Nadu',
    rules: [
      { min: 21001, max: 30000, amount: 30 },
      { min: 30001, max: 45000, amount: 70.83 },
      { min: 45001, max: 60000, amount: 155 },
      { min: 60001, max: 75000, amount: 171 },
      { min: 75001, max: null, amount: 208 }
    ]
  },
  TR: {
    name: 'Tripura',
    rules: [
      { min: 7501, max: 15000, amount: 150 },
      { min: 15001, max: null, amount: 208 }
    ]
  },
  JH: {
    name: 'Jharkhand',
    rules: [
      { min: 25001, max: 41666, amount: 100 },
      { min: 41667, max: 66666, amount: 150 },
      { min: 66667, max: 83333, amount: 175 },
      { min: 83334, max: null, amount: 208 }
    ]
  },
  MN: {
    name: 'Manipur',
    rules: [
      { min: 4168, max: 6250, amount: 100 },
      { min: 6251, max: 8333, amount: 167 },
      { min: 8334, max: 10416, amount: 200 },
      { min: 10417, max: null, amount: (month) => month === 3 ? 208 : 212 }
    ]
  },
  OTHER: { name: 'Other', rules: [] }
};

// ============== PT CALCULATION FUNCTIONS ==============
function computePTAuto(stateCode, salary, month, gender) {
  if (!stateCode || !PT_STATES[stateCode]) return 0;
  const state = PT_STATES[stateCode];
  if (!state.rules || state.rules.length === 0) return 0;
  for (const rule of state.rules) {
    if (salary < rule.min) continue;
    if (rule.max !== null && salary > rule.max) continue;
    if (rule.month !== undefined && rule.month !== month) continue;
    if (rule.gender !== undefined && rule.gender !== gender) continue;
    if (typeof rule.amount === 'function') {
      return Math.round(rule.amount(month) * 100) / 100;
    }
    return Math.round(rule.amount * 100) / 100;
  }
  return 0;
}

function getPTHint(stateCode, salary, month, gender) {
  if (!stateCode || !PT_STATES[stateCode]) return 'Select a state to see PT rule';
  const state = PT_STATES[stateCode];
  const stateName = state.name;
  if (stateCode === 'OTHER') return 'No Professional Tax applicable for selected state';
  const applicableRules = state.rules.filter(rule => {
    if (salary < rule.min) return false;
    if (rule.max !== null && salary > rule.max) return false;
    if (rule.month !== undefined && rule.month !== month) return false;
    if (rule.gender !== undefined && rule.gender !== gender) return false;
    return true;
  });
  if (applicableRules.length === 0) {
    return `${stateName}: No PT applicable for salary ₹${salary.toLocaleString('en-IN')} in ${new Date(2024, month-1).toLocaleString('en-IN', {month:'long'})}`;
  }
  const rule = applicableRules[0];
  const amount = typeof rule.amount === 'function' ? rule.amount(month) : rule.amount;
  return `${stateName}: ₹${amount} applicable (Salary: ₹${salary.toLocaleString('en-IN')}, Month: ${new Date(2024, month-1).toLocaleString('en-IN', {month:'long'})}${rule.gender ? `, Gender: ${rule.gender}` : ''})`;
}

// ============== PT UI FUNCTIONS ==============
function setPTMode(mode) {
  ptMode = mode;
  const autoBtn = document.getElementById('ptAuto');
  const manualBtn = document.getElementById('ptManual');
  const autoWrapper = document.getElementById('ptAutoWrapper');
  const manualWrapper = document.getElementById('ptManualWrapper');
  const manualInput = document.getElementById('ptAmount');
  if (autoBtn) autoBtn.classList.toggle('active', mode === 'auto');
  if (manualBtn) manualBtn.classList.toggle('active', mode === 'manual');
  if (autoWrapper) autoWrapper.classList.toggle('hidden', mode !== 'auto');
  if (manualWrapper) manualWrapper.classList.toggle('hidden', mode !== 'manual');
  const stateEl = document.getElementById('ptState');
  const genderGroup = document.getElementById('ptGenderGroup');
  if (stateEl && genderGroup) {
    const showGender = ['MH', 'MH1'].includes(stateEl.value);
    genderGroup.style.display = showGender ? 'flex' : 'none';
  }
  if (mode === 'auto') {
    updatePTAuto();
  } else {
    const autoVal = computePTAuto(
      document.getElementById('ptState')?.value,
      parseFloat(document.getElementById('grossSalary')?.value) || 0,
      parseInt(document.getElementById('ptMonth')?.value) || 12,
      document.getElementById('ptGender')?.value || 'Male'
    );
    if (manualInput) manualInput.value = autoVal > 0 ? autoVal : '';
  }
  liveCalc();
}

function updatePTAuto() {
  const stateEl = document.getElementById('ptState');
  const monthEl = document.getElementById('ptMonth');
  const genderEl = document.getElementById('ptGender');
  const resultEl = document.getElementById('ptAutoValue');
  const hintEl = document.getElementById('ptAutoHint');
  const genderGroup = document.getElementById('ptGenderGroup');
  if (!stateEl || !monthEl) return;
  const stateCode = stateEl.value;
  const month = parseInt(monthEl.value) || 12;
  const salary = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  const gender = genderEl?.value || 'Male';
  if (genderGroup) {
    const showGender = ['MH', 'MH1'].includes(stateCode);
    genderGroup.style.display = showGender ? 'flex' : 'none';
  }
  if (!stateCode) {
    if (resultEl) resultEl.textContent = 'Select state to calculate';
    if (hintEl) hintEl.textContent = 'Select state, month & gender to auto-calculate Professional Tax';
    liveCalc();
    return;
  }
  const ptVal = computePTAuto(stateCode, salary, month, gender);
  const hint = getPTHint(stateCode, salary, month, gender);
  if (resultEl) {
    resultEl.textContent = ptVal > 0 ? `₹${ptVal}` : '₹0 (Not applicable)';
    resultEl.style.color = ptVal > 0 ? 'var(--accent3)' : 'var(--text-muted)';
  }
  if (hintEl) hintEl.textContent = hint;
  liveCalc();
}

function getPTValue() {
  if (ptMode === 'manual') {
    return parseFloat(document.getElementById('ptAmount')?.value) || 0;
  }
  const stateEl = document.getElementById('ptState');
  const monthEl = document.getElementById('ptMonth');
  const genderEl = document.getElementById('ptGender');
  if (!stateEl || !monthEl || !stateEl.value) return 0;
  const stateCode = stateEl.value;
  const month = parseInt(monthEl.value) || 12;
  const salary = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  const gender = genderEl?.value || 'Male';
  return computePTAuto(stateCode, salary, month, gender);
}

function getPTLabel() {
  if (ptMode === 'manual') return 'PT (Manual)';
  const stateEl = document.getElementById('ptState');
  if (!stateEl || !stateEl.value) return 'PT (Auto)';
  const stateCode = stateEl.value;
  const state = PT_STATES[stateCode];
  if (!state) return 'PT (Auto)';
  return `PT – ${state.name}`;
}

// ============== INITIALIZATION ==============
function onReady(callback) {
  if (document.readyState !== 'loading') {
    callback();
  } else {
    document.addEventListener('DOMContentLoaded', callback);
  }
}

onReady(() => {
  setupAuthListener();
  setupEventListeners();
  initializeCalculator();
  initBulkTab();
});

// ============== AUTH LISTENER ==============
function setupAuthListener() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
          currentUser = userDoc.data();
          currentUserId = user.uid;
          isAdmin = currentUser.role === 'admin';
          updateUserInfo();
          showMainApp();
          updateLastLogin();
          if (isAdmin) {
            document.getElementById('adminPanelBtn').style.display = 'flex';
            loadUsersTable();
            updateAdminInfo();
          }
          showToast(`✓ Welcome, ${currentUser.name.split(' ')[0]}!`);
        } else {
          await auth.signOut();
          showLoginPage();
        }
      } catch (error) {
        console.error('Auth state error:', error);
        showToast('⚠️ Session error. Please login again.');
        await auth.signOut();
        showLoginPage();
      }
    } else {
      currentUser = null;
      isAdmin = false;
      currentUserId = null;
      showLoginPage();
    }
  });
}

// ============== EVENT LISTENERS ==============
function setupEventListeners() {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  const adminRegisterForm = document.getElementById('adminRegisterForm');
  if (adminRegisterForm) adminRegisterForm.addEventListener('submit', handleAdminRegister);
  const createUserForm = document.getElementById('createUserForm');
  if (createUserForm) createUserForm.addEventListener('submit', handleCreateUser);
  const showAdminRegisterLink = document.getElementById('showAdminRegister');
  if (showAdminRegisterLink) {
    showAdminRegisterLink.addEventListener('click', (e) => { e.preventDefault(); showAdminRegister(); });
  }
  const backToLoginLink = document.getElementById('backToLogin');
  if (backToLoginLink) {
    backToLoginLink.addEventListener('click', (e) => { e.preventDefault(); showLoginPage(); });
  }
  const adminPanelBtn = document.getElementById('adminPanelBtn');
  if (adminPanelBtn) {
    adminPanelBtn.addEventListener('click', () => {
      if (isAdmin) { switchTab('admin'); loadUsersTable(); updateAdminInfo(); }
    });
  }
  document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab !== 'admin' || isAdmin) switchTab(tab);
    });
  });
  const grossInput = document.getElementById('grossSalary');
  if (grossInput) {
    grossInput.addEventListener('input', () => {
      if (lwfMode === 'auto') updateLWFAuto();
      if (ptMode === 'auto') updatePTAuto();
    });
  }
}

// ============== PAGE NAVIGATION ==============
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
  if (typeof liveCalc === 'function') liveCalc();
}
function safeToggle(elementId, hide) {
  const el = document.getElementById(elementId);
  if (el) el.classList.toggle('hidden', hide);
}

// ============== AUTH FUNCTIONS ==============
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
}
async function handleLogin(e) {
  e.preventDefault();
  const email = (document.getElementById('loginEmail')?.value || '').trim().toLowerCase();
  const password = document.getElementById('loginPassword')?.value || '';
  const errorEl = document.getElementById('loginError');
  if (errorEl) errorEl.classList.add('hidden');
  if (!email || !password) { showError(errorEl, 'Please enter email and password'); return; }
  try { await auth.signInWithEmailAndPassword(email, password); }
  catch (error) {
    let msg = 'Login failed';
    if (error.code === 'auth/user-not-found') msg = 'No account with this email';
    else if (error.code === 'auth/wrong-password') msg = 'Incorrect password';
    else if (error.code === 'auth/invalid-email') msg = 'Invalid email format';
    else if (error.code === 'auth/too-many-requests') msg = 'Too many attempts. Try later.';
    showError(errorEl, msg);
  }
}
async function handleAdminRegister(e) {
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
  if (!name || !companyName || !email || !password) { showError(errorEl, 'All fields are required'); return; }
  if (password.length < 8) { showError(errorEl, 'Password must be at least 8 characters'); return; }
  if (password !== confirmPassword) { showError(errorEl, 'Passwords do not match'); return; }
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;
    await db.collection('users').doc(uid).set({
      uid, name, companyName, email, role: 'admin',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    });
    if (successEl) { successEl.classList.remove('hidden'); successEl.textContent = '✓ Admin account created! Redirecting to login...'; }
    await auth.signOut();
    setTimeout(() => { showLoginPage(); showToast('✓ Admin registered! Please login now.'); }, 2000);
  } catch (error) {
    let msg = 'Registration failed';
    if (error.code === 'auth/email-already-in-use') msg = 'Email already registered';
    else if (error.code === 'auth/weak-password') msg = 'Password too weak (min 6 chars)';
    else if (error.code === 'auth/invalid-email') msg = 'Invalid email format';
    else msg = `Error: ${error.message || error.code}`;
    showError(errorEl, msg);
    showToast('⚠️ ' + msg);
  }
}
async function handleCreateUser(e) {
  e.preventDefault();
  if (!isAdmin) { showToast('⚠️ Admin access required'); return; }
  const name = (document.getElementById('newUserName')?.value || '').trim();
  const email = (document.getElementById('newUserEmail')?.value || '').trim().toLowerCase();
  const password = document.getElementById('newUserPassword')?.value || '';
  const confirmPassword = document.getElementById('confirmNewPassword')?.value || '';
  const msgEl = document.getElementById('createUserMsg');
  if (msgEl) msgEl.classList.add('hidden');
  if (!name || !email || !password) { showError(msgEl, 'All fields are required', true); return; }
  if (password.length < 8) { showError(msgEl, 'Password must be at least 8 characters', true); return; }
  if (password !== confirmPassword) { showError(msgEl, 'Passwords do not match', true); return; }
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;
    await db.collection('users').doc(uid).set({
      uid, name, email, role: 'user', createdBy: currentUserId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(), lastLogin: null
    });
    showSuccess(msgEl, `✓ User "${name}" created! Share credentials with them.`);
    document.getElementById('createUserForm')?.reset();
    loadUsersTable();
  } catch (error) {
    let msg = 'Failed to create user';
    if (error.code === 'auth/email-already-in-use') msg = 'Email already registered';
    showError(msgEl, msg, true);
  }
}
function logout() {
  auth.signOut().then(() => { showToast('↪️ Logged out successfully'); })
  .catch(() => { showToast('⚠️ Logout failed'); });
}
async function updateLastLogin() {
  if (!currentUserId) return;
  try {
    await db.collection('users').doc(currentUserId).update({
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) { console.warn('Could not update last login:', e); }
}

// ============== ADMIN PANEL ==============
function updateAdminInfo() {
  if (!isAdmin || !currentUser) return;
  const adminInfoEl = document.getElementById('currentAdminInfo');
  if (adminInfoEl && currentUser) {
    adminInfoEl.textContent = `${currentUser.name} • ${currentUser.companyName || 'N/A'}`;
  }
}
async function loadUsersTable() {
  if (!isAdmin) return;
  const tbody = document.getElementById('usersTableBody');
  const noUsersMsg = document.getElementById('noUsersMsg');
  if (!tbody) return;
  try {
    const snapshot = await db.collection('users').where('role', '==', 'user').orderBy('createdAt', 'desc').get();
    if (snapshot.empty) {
      tbody.innerHTML = '';
      if (noUsersMsg) noUsersMsg.classList.remove('hidden');
      if (document.getElementById('totalUsersCount')) document.getElementById('totalUsersCount').textContent = '0';
      return;
    }
    if (noUsersMsg) noUsersMsg.classList.add('hidden');
    let html = '';
    let count = 0;
    snapshot.forEach(doc => {
      const user = doc.data();
      count++;
      const date = user.createdAt?.toDate()?.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) || 'N/A';
      html += `<tr><td><strong>${escapeHtml(user.name)}</strong></td><td>${escapeHtml(user.email)}</td><td>${date}</td><td><button class="btn-sm btn-delete" onclick="deleteUser('${user.uid}')">🗑️ Delete</button></td></tr>`;
    });
    tbody.innerHTML = html;
    if (document.getElementById('totalUsersCount')) document.getElementById('totalUsersCount').textContent = count;
  } catch (error) {
    console.error('Load users error:', error);
    showToast('⚠️ Failed to load users');
  }
}
async function deleteUser(uid) {
  if (!isAdmin) return;
  if (!confirm('Are you sure you want to delete this user?')) return;
  try {
    await db.collection('users').doc(uid).delete();
    showToast('✓ User deleted from system');
    loadUsersTable();
  } catch (error) { showToast('⚠️ Failed to delete user'); }
}
async function clearAllData() {
  if (!isAdmin) return;
  if (!confirm('⚠️ WARNING: This will delete ALL user data!\n\nAre you absolutely sure?')) return;
  const confirmText = prompt('Type "DELETE ALL" to confirm:');
  if (confirmText !== 'DELETE ALL') { showToast('⚠️ Operation cancelled'); return; }
  try {
    const snapshot = await db.collection('users').where('role', '==', 'user').get();
    const batch = db.batch();
    snapshot.forEach(doc => { batch.delete(doc.ref); });
    await batch.commit();
    showToast('✓ All user data cleared');
    loadUsersTable();
  } catch (error) { showToast('⚠️ Failed to clear data'); }
}

// ============== UTILITY ==============
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
function updateUserInfo() {
  if (!currentUser) return;
  const nameEl = document.getElementById('userName');
  const emailEl = document.getElementById('userEmail');
  const avatarEl = document.getElementById('userAvatar');
  if (nameEl) nameEl.textContent = currentUser.name;
  if (emailEl) emailEl.textContent = currentUser.email;
  if (avatarEl && currentUser.name) avatarEl.textContent = currentUser.name.charAt(0).toUpperCase();
}

// ============== CALCULATOR INIT ==============
function initializeCalculator() {
  setPF('Y');
  setGratuityMode('auto');
  setLeaveMode('auto');
  setLWFMode('auto');
  setPTMode('auto');
  const currentMonth = new Date().getMonth() + 1;
  const monthEl = document.getElementById('lwfMonth');
  const ptMonthEl = document.getElementById('ptMonth');
  if (monthEl) monthEl.value = currentMonth;
  if (ptMonthEl) ptMonthEl.value = currentMonth;
}

// ============== CALCULATOR LOGIC ==============
function setPF(val) {
  pfApplicable = val;
  const pfYes = document.getElementById('pfYes');
  const pfNo = document.getElementById('pfNo');
  const hint = document.getElementById('pfHint');
  if (pfYes) pfYes.classList.toggle('active', val === 'Y');
  if (pfNo) pfNo.classList.toggle('active', val === 'N');
  if (hint) hint.textContent = val === 'Y'
    ? '55% of Gross or Min Wage (whichever is higher) → Basic'
    : '53% of Gross or Min Wage (whichever is higher) → Basic';
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
  if (manualInput) manualInput.classList.toggle('hidden', mode !== 'manual');
  if (hint) hint.textContent = mode === 'manual'
    ? 'Enter custom monthly gratuity amount'
    : 'Formula: Basic ÷ 26 × 15 ÷ 12 (monthly provision)';
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
  if (manualInput) manualInput.classList.toggle('hidden', mode !== 'manual');
  if (hint) hint.textContent = mode === 'manual'
    ? 'Enter custom monthly leave encashment amount'
    : 'Formula: Basic ÷ 26 × 1.25 (monthly provision for 15 leaves/yr)';
  liveCalc();
}

// ============== CORE CTC ENGINE ==============
// THIS IS THE SINGLE SOURCE OF TRUTH — used by both Individual & Bulk
function computeCTC(gross, minWage, pf, pt, lwf, gratuityOverride, leaveOverride) {
  gross = Math.round(gross);
  minWage = Math.round(minWage);
  let basicPct = pf === 'Y' ? 0.55 : 0.53;
  let basicFromGross = Math.round(gross * basicPct);
  let basic = Math.max(basicFromGross, minWage);
  basic = Math.min(basic, gross);

  let hra = Math.round(basic * 0.5);
  let conv = Math.max(gross - basic - hra, 0);
  if (basic + hra > gross) { hra = gross - basic; conv = 0; }

  let epfEmployer = pf === 'Y' ? Math.min(Math.round(basic * 0.125), 1875) : 0;
  let edliEmployer = pf === 'Y' ? Math.min(Math.round(basic * 0.005), 75) : 0;
  let bonus = basic <= 21000 ? Math.round(minWage * 0.0833) : 0;
  let initialCTC = gross + epfEmployer + edliEmployer + bonus;

  let esiEmployer = basic <= 21000 ? Math.round(basic * 0.0325) : 0;
  let esiEmployee = basic <= 21000 ? Math.round(basic * 0.0075) : 0;

  let gratuityAuto = Math.round((basic / 26) * 15 / 12);
  let gratuity = (gratuityOverride !== null && gratuityOverride !== undefined && !isNaN(gratuityOverride) && gratuityOverride >= 0)
    ? Math.round(gratuityOverride)
    : gratuityAuto;

  let leaveAuto = Math.round((basic / 26) * 1.25);
  let leaveComponent = (leaveOverride !== null && leaveOverride !== undefined && !isNaN(leaveOverride) && leaveOverride >= 0)
    ? Math.round(leaveOverride)
    : leaveAuto;

  let finalCTC = initialCTC + esiEmployer + gratuity + lwf + leaveComponent;

  let epfEmployee = pf === 'Y' ? Math.min(Math.round(basic * 0.12), 1800) : 0;
  let cashInHand = gross - epfEmployee - esiEmployee - lwf - pt;

  // ── Conveyance label: "Special Allowance" jab gross > 1,00,000 ──
  const convLabel = getConvLabel(gross);

  return {
    gross, basic, hra, conv, convLabel, minWage, pfApplicable: pf,
    epfEmployer, edliEmployer, bonus, initialCTC,
    esiEmployer, esiEmployee,
    gratuity, gratuityAuto,
    leaveComponent, leaveAuto, lwf, pt,
    finalCTC, finalCTCAnnual: finalCTC * 12,
    epfEmployee,
    lwfEmployee: lwf,
    ptDeduction: pt,
    cashInHand,
    gratuityMode: (gratuityOverride !== null && gratuityOverride !== undefined && !isNaN(gratuityOverride) && gratuityOverride >= 0) ? 'manual' : 'auto',
    leaveMode: (leaveOverride !== null && leaveOverride !== undefined && !isNaN(leaveOverride) && leaveOverride >= 0) ? 'manual' : 'auto',
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
  } else { input.placeholder = 'e.g. 500'; }
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
  } else { input.placeholder = 'e.g. 200'; }
}

function liveCalc() {
  updateGratuityPlaceholder();
  updateLeavePlaceholder();
  const gross = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  const minWage = parseFloat(document.getElementById('minWage')?.value) || 0;
  if (gross > 0 && minWage > 0) calculate(true);
}

function calculate(silent = false) {
  const gross = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  const minWage = parseFloat(document.getElementById('minWage')?.value) || 0;
  const pt = getPTValue();
  const lwf = getLWFValue();
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

  r.lwfMode = lwfMode;
  r.lwfLabel = getLWFLabel();
  r.lwfStateName = (() => {
    if (lwfMode === 'manual') return 'Manual';
    const stateEl = document.getElementById('lwfState');
    if (!stateEl || !stateEl.value) return 'Not Selected';
    return LWF_STATES[stateEl.value]?.name || stateEl.value;
  })();

  r.ptMode = ptMode;
  r.ptLabel = getPTLabel();
  r.ptStateName = (() => {
    if (ptMode === 'manual') return 'Manual';
    const stateEl = document.getElementById('ptState');
    if (!stateEl || !stateEl.value) return 'Not Selected';
    return PT_STATES[stateEl.value]?.name || stateEl.value;
  })();

  calcResult = r;
  renderSummary(r);
  renderBreakdown(r);
  renderExportPreview(r);
  if (!silent) showToast('✓ CTC Calculated Successfully');
}

function fmt(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }
function pct(part, total) { if (!total) return '0%'; return (part / total * 100).toFixed(1) + '%'; }

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

  // ── Update "Conveyance" label in summary mini-grid dynamically ──
  const convMiniLabel = document.querySelector('.mini-item .mini-label[data-field="conv"]');
  if (convMiniLabel) convMiniLabel.textContent = r.convLabel;
}
function setText(elementId, text) { const el = document.getElementById(elementId); if (el) el.textContent = text; }

function renderBreakdown(r) {
  safeToggle('breakdownEmpty', true);
  safeToggle('breakdownContent', false);

  // ── Salary structure: use r.convLabel for Conveyance row ──
  const salRows = [
    ['Basic', r.basic],
    ['HRA (50% of Basic)', r.hra],
    [r.convLabel, r.conv]   // ← Dynamic label here
  ];
  let salHtml = '';
  salRows.forEach(([label, val]) => { salHtml += `<tr><td>${label}</td><td>${fmt(val)}</td><td>${pct(val, r.gross)}</td></tr>`; });
  setTextContent('salaryTable', salHtml);
  setText('tfoot_gross', fmt(r.gross));

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

  const dedRows = [
    ['EPF – Employee @ 12% of Basic', '12% (max ₹1,800)', r.epfEmployee, r.pfApplicable === 'Y'],
    ['ESI – Employee @ 0.75% (Gross ≤ ₹21,000)', '0.75%', r.esiEmployee, r.gross <= 21000],
    [`PT – ${r.ptStateName} (${r.ptMode === 'manual' ? 'Manual' : 'Auto'})`, 'State', r.ptDeduction, r.ptDeduction > 0],
    [`LWF – ${r.lwfStateName} (${r.lwfMode === 'manual' ? 'Manual' : 'Auto'})`, 'State', r.lwfEmployee, r.lwfEmployee > 0],
  ];
  let dedHtml = '';
  dedRows.forEach(([label, rate, val, applicable]) => {
    const dispVal = applicable && val > 0 ? `<span style="color:var(--danger)">${fmt(val)}</span>` : `<span style="color:var(--text-muted)">—</span>`;
    dedHtml += `<tr><td>${label}</td><td style="color:var(--text-dim)">${rate}</td><td>${dispVal}</td></tr>`;
  });
  setTextContent('deductionTable', dedHtml);
  setText('tfoot_cash', fmt(r.cashInHand));

  const empName = (document.getElementById('empName')?.value || '').trim() || 'Employee';
  const gratuityLabel = r.gratuityMode === 'manual'
    ? `Gratuity <span style="font-size:9px;color:var(--accent2);font-weight:600;background:rgba(159,122,234,0.15);padding:2px 6px;border-radius:4px;margin-left:4px;">CUSTOM</span>`
    : `Gratuity <span style="font-size:9px;color:var(--text-muted);font-weight:600;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;margin-left:4px;">AUTO</span>`;
  const leaveLabel = r.leaveMode === 'manual'
    ? `Leave Component <span style="font-size:9px;color:var(--accent2);font-weight:600;background:rgba(159,122,234,0.15);padding:2px 6px;border-radius:4px;margin-left:4px;">CUSTOM</span>`
    : `Leave Component <span style="font-size:9px;color:var(--text-muted);font-weight:600;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;margin-left:4px;">AUTO</span>`;
  const lwfLabel = r.lwfMode === 'manual'
    ? `LWF – Employee <span style="font-size:9px;color:var(--accent2);font-weight:600;background:rgba(159,122,234,0.15);padding:2px 6px;border-radius:4px;margin-left:4px;">MANUAL</span>`
    : `LWF – ${r.lwfStateName} <span style="font-size:9px;color:var(--accent3);font-weight:600;background:rgba(104,211,145,0.1);padding:2px 6px;border-radius:4px;margin-left:4px;">AUTO</span>`;
  const ptLabel = r.ptMode === 'manual'
    ? `PT – Employee <span style="font-size:9px;color:var(--accent2);font-weight:600;background:rgba(159,122,234,0.15);padding:2px 6px;border-radius:4px;margin-left:4px;">MANUAL</span>`
    : `PT – ${r.ptStateName} <span style="font-size:9px;color:var(--accent3);font-weight:600;background:rgba(104,211,145,0.1);padding:2px 6px;border-radius:4px;margin-left:4px;">AUTO</span>`;

  const finalItemsData = [
    { label: 'Gross Salary', val: fmt(r.gross), sub: 'Monthly', cls: '' },
    { label: 'Initial CTC', val: fmt(r.initialCTC), sub: 'Gross + Employer Contributions', cls: '' },
    { label: 'ESI – Employer', val: r.esiEmployer > 0 ? fmt(r.esiEmployer) : 'N/A', sub: '3.25% of Gross (if ≤ ₹21k)', cls: '' },
    { label: gratuityLabel, val: fmt(r.gratuity), sub: r.gratuityMode === 'manual' ? `Manual (Auto: ${fmt(r.gratuityAuto)})` : 'Basic/26 × 15 ÷ 12', cls: '' },
    { label: leaveLabel, val: fmt(r.leaveComponent), sub: r.leaveMode === 'manual' ? `Manual (Auto: ${fmt(r.leaveAuto)})` : 'Basic/26 × 1.25', cls: '' },
    { label: lwfLabel, val: r.lwf > 0 ? fmt(r.lwf) : '₹0 (N/A)', sub: r.lwfMode === 'auto' ? `${r.lwfStateName} – State-wise auto` : 'Manual override', cls: '' },
    { label: ptLabel, val: r.ptDeduction > 0 ? fmt(r.ptDeduction) : '₹0 (N/A)', sub: r.ptMode === 'auto' ? `${r.ptStateName} – State-wise auto` : 'Manual override', cls: '' },
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
function setTextContent(elementId, html) { const el = document.getElementById(elementId); if (el) el.innerHTML = html; }

function renderExportPreview(r) {
  // ── r.convLabel used here for dynamic Conveyance / Special Allowance ──
  const rows = [
    ['SALARY STRUCTURE', '', true],
    ['Basic', fmt(r.basic), false],
    ['HRA', fmt(r.hra), false],
    [r.convLabel, fmt(r.conv), false],   // ← Dynamic label
    ['Gross Salary', fmt(r.gross), false],
    ['EMPLOYER CONTRIBUTIONS', '', true],
    ['EPF Employer (12.5%)', fmt(r.epfEmployer), false],
    ['EDLI Employer (0.5%)', fmt(r.edliEmployer), false],
    ['Bonus (8.33% of Min Wage)', fmt(r.bonus), false],
    ['Initial CTC', fmt(r.initialCTC), false],
    ['ESI Employer (3.25%)', fmt(r.esiEmployer), false],
    [`Gratuity (${r.gratuityMode})`, fmt(r.gratuity), false],
    [`Leave Component (${r.leaveMode})`, fmt(r.leaveComponent), false],
    ['EMPLOYEE DEDUCTIONS', '', true],
    ['EPF Employee (12%)', fmt(r.epfEmployee), false],
    ['ESI Employee (0.75%)', fmt(r.esiEmployee), false],
    [`PT – ${r.ptStateName} (${r.ptMode})`, fmt(r.ptDeduction), false],
    [`LWF – ${r.lwfStateName} (${r.lwfMode})`, fmt(r.lwf), false],
    ['FINAL TOTALS', '', true],
    ['Final CTC (Monthly)', fmt(r.finalCTC), false],
    ['Final CTC (Annual)', fmt(r.finalCTCAnnual), false],
    ['Cash in Hand', fmt(r.cashInHand), false],
  ];
  let html = '<table class="preview-table">';
  rows.forEach(([label, val, isHead]) => {
    if (isHead) html += `<tr class="section-head"><td colspan="2">${label}</td></tr>`;
    else html += `<tr><td>${label}</td><td>${val}</td></tr>`;
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
  const fields = ['empName', 'grossSalary', 'minWage'];
  fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  lwfMode = 'auto'; setLWFMode('auto');
  const lwfStateEl = document.getElementById('lwfState');
  if (lwfStateEl) lwfStateEl.value = '';
  const lwfResultEl = document.getElementById('lwfAutoValue');
  if (lwfResultEl) lwfResultEl.textContent = 'Select state to calculate';
  const lwfHintEl = document.getElementById('lwfAutoHint');
  if (lwfHintEl) lwfHintEl.textContent = 'Select state and month to auto-calculate LWF';
  const lwfAmountEl = document.getElementById('lwfAmount');
  if (lwfAmountEl) lwfAmountEl.value = '0';
  const monthEl = document.getElementById('lwfMonth');
  if (monthEl) monthEl.value = new Date().getMonth() + 1;
  ptMode = 'auto'; setPTMode('auto');
  const ptStateEl = document.getElementById('ptState');
  if (ptStateEl) ptStateEl.value = '';
  const ptResultEl = document.getElementById('ptAutoValue');
  if (ptResultEl) ptResultEl.textContent = 'Select state to calculate';
  const ptHintEl = document.getElementById('ptAutoHint');
  if (ptHintEl) ptHintEl.textContent = 'Select state, month & gender to auto-calculate Professional Tax';
  const ptAmountEl = document.getElementById('ptAmount');
  if (ptAmountEl) ptAmountEl.value = '0';
  const ptMonthEl = document.getElementById('ptMonth');
  if (ptMonthEl) ptMonthEl.value = new Date().getMonth() + 1;
  setText('r_initialCTC', '—');
  gratuityMode = 'auto'; setGratuityMode('auto');
  const gratuityCustom = document.getElementById('gratuityCustom');
  if (gratuityCustom) gratuityCustom.value = '';
  leaveMode = 'auto'; setLeaveMode('auto');
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
LWF: ${r.lwfStateName} (${r.lwfMode}) = ${fmt(r.lwf)}
PT: ${r.ptStateName} (${r.ptMode}) = ${fmt(r.ptDeduction)}

SALARY STRUCTURE (MONTHLY)
—————————————————————————
Basic Salary      : ${fmt(r.basic)}  (${pct(r.basic, r.gross)} of Gross)
HRA               : ${fmt(r.hra)}    (50% of Basic)
${r.convLabel.padEnd(18)}: ${fmt(r.conv)}
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
PT (${r.ptStateName}) : ${fmt(r.ptDeduction)}
LWF (${r.lwfStateName}) : ${fmt(r.lwf)}
────────────────────────
NET CASH IN HAND  : ${fmt(r.cashInHand)}

Formula: As per New Labour Code — Basic = MAX(${r.pfApplicable === 'Y' ? '55%' : '53%'} of Gross, Min Wage)
${r.convLabel}: Residual after Basic + HRA${r.gross > 100000 ? ' (Defer Allowance applied — Gross > ₹1,00,000)' : ''}
LWF & PT computed as per state-wise New Labour Code rules.
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
    [r.convLabel, r.conv, r.gross > 100000 ? 'Defer Allowance (Gross > ₹1L)' : 'Residual'],   // ← Dynamic
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
    [`LWF – ${r.lwfStateName} (${r.lwfMode})`, r.lwf, 'State-wise Labour Welfare Fund'],
    [`PT – ${r.ptStateName} (${r.ptMode})`, r.ptDeduction, 'State-wise Professional Tax'],
    ['Final CTC Monthly', r.finalCTC, ''],
    ['Final CTC Annual', r.finalCTCAnnual, ''],
    ['', '', ''],
    ['=== EMPLOYEE DEDUCTIONS ===', '', ''],
    ['EPF Employee', r.epfEmployee, '12% of Basic (max ₹1800)'],
    ['ESI Employee', r.esiEmployee, '0.75% of Gross (if ≤ ₹21000)'],
    ['Professional Tax', r.ptDeduction, ''],
    [`LWF – ${r.lwfStateName}`, r.lwfEmployee, 'Employee share'],
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
    `${r.convLabel}\t${r.conv}`,   // ← Dynamic label
    `Gross\t${r.gross}`,
    `EPF (Employer)\t${r.epfEmployer}`,
    `EDLI (Employer)\t${r.edliEmployer}`,
    `Bonus\t${r.bonus}`,
    `ESI (Employer)\t${r.esiEmployer}`,
    `Gratuity (${r.gratuityMode})\t${r.gratuity}`,
    `Leave Component (${r.leaveMode})\t${r.leaveComponent}`,
    `LWF – ${r.lwfStateName} (${r.lwfMode})\t${r.lwf}`,
    `PT – ${r.ptStateName} (${r.ptMode})\t${r.ptDeduction}`,
    `Final CTC (Monthly)\t${r.finalCTC}`,
    `Final CTC (Annual)\t${r.finalCTCAnnual}`,
    `Cash in Hand\t${r.cashInHand}`,
  ].join('\n');
  navigator.clipboard.writeText(text).then(() => { showToast('⎘ Copied to clipboard'); })
  .catch(() => { showToast('⚠️ Copy failed — try downloading instead'); });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.target.matches('input[type="password"]')) {
    const mainApp = document.getElementById('mainApp');
    if (mainApp && !mainApp.classList.contains('hidden')) calculate();
  }
});

/* =====================================================
   BULK UPLOAD — COMPLETELY FIXED v5.1
   Uses same computeCTC() as individual calculator
   convLabel auto-applied per row based on gross
   ===================================================== */

let bulkRawData = [];
let bulkCalcResults = [];

function initBulkTab() {
  const dropZone = document.getElementById('bulkDropZone');
  const fileInput = document.getElementById('bulkFileInput');
  if (!dropZone || !fileInput) return;

  const newDrop = dropZone.cloneNode(true);
  const newInput = fileInput.cloneNode(true);
  dropZone.parentNode.replaceChild(newDrop, dropZone);
  fileInput.parentNode.replaceChild(newInput, fileInput);

  newDrop.addEventListener('dragover', e => { e.preventDefault(); newDrop.classList.add('drag-over'); });
  newDrop.addEventListener('dragleave', () => newDrop.classList.remove('drag-over'));
  newDrop.addEventListener('drop', e => {
    e.preventDefault();
    newDrop.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleBulkFile(file, newInput);
  });
  newDrop.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') newInput.click();
  });
  newInput.addEventListener('change', e => {
    if (e.target.files[0]) handleBulkFile(e.target.files[0], newInput);
  });

  const browseBtn = newDrop.querySelector('.btn-browse');
  if (browseBtn) {
    browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      newInput.click();
    });
  }
}

function handleBulkFile(file, fileInputEl) {
  const ext = file.name.split('.').pop().toLowerCase();
  setBulkStatus('info', '⟳ Reading file: ' + file.name + '...');

  if (ext === 'csv') {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        bulkRawData = result.data.filter(row =>
          row && Object.values(row).some(v => {
            if (v === null || v === undefined) return false;
            const s = String(v).trim().toLowerCase();
            return s !== '' && s !== 'null' && s !== 'undefined' && s !== 'n/a' && s !== '-';
          })
        );
        onBulkFileReady(file.name, bulkRawData.length);
      },
      error: (err) => {
        console.error('CSV parse error:', err);
        setBulkStatus('error', '⚠️ CSV parse failed: ' + err.message);
      }
    });

  } else if (['xlsx', 'xls'].includes(ext)) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        let rawJson = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
        let processedData = findHeaderAndData(rawJson);
        if (!processedData || processedData.length === 0) {
          const rawData = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
          if (rawData && rawData.length > 1) {
            const headers = rawData[0].map(h => String(h || '').trim()).filter(h => h);
            processedData = rawData.slice(1).map(row => {
              const obj = {};
              headers.forEach((h, i) => {
                const val = row[i];
                obj[h] = (val === undefined || val === null || String(val).trim() === '') ? null : val;
              });
              return obj;
            }).filter(row => row && Object.keys(row).length > 0);
          }
        }
        bulkRawData = (processedData || []).filter(row => {
          if (!row || typeof row !== 'object') return false;
          return Object.values(row).some(v => {
            if (v === null || v === undefined) return false;
            const s = String(v).trim().toLowerCase();
            return s !== '' && s !== 'null' && s !== 'undefined' && s !== 'n/a' && s !== '-' && s !== 'na';
          });
        });
        if (bulkRawData.length > 0) {
          onBulkFileReady(file.name, bulkRawData.length);
        } else {
          setBulkStatus('error', '⚠️ No valid data rows found. Check file headers & content.');
        }
      } catch (err) {
        console.error('Excel parse error:', err);
        setBulkStatus('error', '⚠️ Excel read failed: ' + err.message);
      }
    };
    reader.onerror = () => setBulkStatus('error', '⚠️ File read error - please try again');
    reader.readAsArrayBuffer(file);

  } else {
    setBulkStatus('error', '⚠️ Unsupported format. Please use .csv, .xlsx, or .xls');
  }
}

function onBulkFileReady(fileName, rowCount) {
  const actionRow = document.getElementById('bulkActionRow');
  const fileNameEl = document.getElementById('bulkFileName');
  const rowCountEl = document.getElementById('bulkRowCount');
  if (actionRow) actionRow.style.display = 'flex';
  if (fileNameEl) fileNameEl.textContent = fileName;
  if (rowCountEl) rowCountEl.textContent = `${rowCount} rows found`;
  setBulkStatus('success', `✓ File loaded: "${fileName}" — ${rowCount} rows detected. Click "Calculate All" to process.`);
}

function normKey(k) {
  if (!k && k !== 0) return '';
  return k.toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_\-\/\(\)\.\,\'\"]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function getBulkField(row, aliases, fieldNameForDebug = null) {
  if (!row || typeof row !== 'object') return null;
  const normalizedRow = {};
  for (const [origKey, origVal] of Object.entries(row)) {
    const nk = normKey(origKey);
    if (nk) normalizedRow[nk] = { originalKey: origKey, value: origVal };
  }
  if (fieldNameForDebug === 'Gross Salary' && window.__debugBulk !== false) {
    console.log('🔍 Available columns:', Object.keys(row));
    console.log('🔍 Normalized keys:', Object.keys(normalizedRow));
    window.__debugBulk = false;
  }
  for (const alias of aliases) {
    const nk = normKey(alias);
    if (!nk) continue;
    if (normalizedRow[nk]) {
      const val = normalizedRow[nk].value;
      if (val === undefined || val === null) continue;
      const s = String(val).trim();
      if (s === '' || ['null', 'undefined', 'n/a', '-', 'na', 'none'].includes(s.toLowerCase())) continue;
      return s;
    }
  }
  for (const alias of aliases) {
    const aliasNorm = normKey(alias);
    if (!aliasNorm) continue;
    for (const [keyNorm, data] of Object.entries(normalizedRow)) {
      if (keyNorm.includes(aliasNorm) || aliasNorm.includes(keyNorm)) {
        const val = data.value;
        if (val === undefined || val === null) continue;
        const s = String(val).trim();
        if (s === '' || ['null', 'undefined', 'n/a', '-', 'na', 'none'].includes(s.toLowerCase())) continue;
        return s;
      }
    }
  }
  if (['Gross Salary', 'Min Wage', 'PT Amount', 'LWF Amount'].includes(fieldNameForDebug)) {
    for (const [keyNorm, data] of Object.entries(normalizedRow)) {
      const val = data.value;
      if (typeof val === 'number' && !isNaN(val) && val > 0) return String(val);
      if (typeof val === 'string') {
        const cleaned = val.replace(/[₹,\s]/g, '').trim();
        if (!isNaN(cleaned) && parseFloat(cleaned) > 0) return cleaned;
      }
    }
  }
  return null;
}

function cleanNum(v) {
  if (v === null || v === undefined) return NaN;
  if (String(v).trim().toLowerCase() === 'null') return NaN;
  const s = String(v)
    .replace(/[₹,\s]/g, '')
    .replace(/[^\d.\-]/g, '')
    .trim();
  if (!s || s === '-' || s === '.' || ['null', 'undefined', 'n/a', 'na', ''].includes(s.toLowerCase())) return NaN;
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

function findHeaderAndData(rawRows) {
  if (!rawRows || !Array.isArray(rawRows) || rawRows.length === 0) return [];
  const headerKeywords = [
    'gross', 'employee', 'name', 'empname', 'minwage', 'minimumwage',
    'salary', 'wage', 'basic', 'hra', 'pf', 'pt', 'lwf', 'gratuity',
    'leave', 'encashment', 'monthly', 'pay', 'amount'
  ];
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = rawRows[i];
    if (!row || typeof row !== 'object') continue;
    const allText = [
      ...Object.keys(row).map(k => String(k || '').toLowerCase()),
      ...Object.values(row).map(v => String(v || '').toLowerCase())
    ].join(' ');
    const keywordCount = headerKeywords.filter(kw => allText.includes(kw)).length;
    if (keywordCount >= 3) {
      if (i === 0) return rawRows;
      const headerValues = Object.values(row).map((v, idx) => {
        const h = String(v || '').trim();
        return h || `Column${idx + 1}`;
      });
      const dataRows = rawRows.slice(i + 1).map(dataRow => {
        const vals = Object.values(dataRow);
        const remapped = {};
        headerValues.forEach((h, colIdx) => {
          if (h) {
            const val = vals[colIdx];
            remapped[h] = (val === undefined || val === null || String(val).trim() === '') ? null : val;
          }
        });
        return remapped;
      });
      return dataRows.filter(r => r && Object.keys(r).length > 0);
    }
  }
  return rawRows;
}

function processBulkFile() {
  if (!bulkRawData || bulkRawData.length === 0) {
    showToast('⚠️ No file loaded. Please upload first.');
    setBulkStatus('error', '⚠️ No data found in file.');
    return;
  }

  window.__debugBulk = true;

  const rows = bulkRawData.filter(row =>
    row && Object.values(row).some(v => {
      if (v === null || v === undefined) return false;
      const s = String(v).trim().toLowerCase();
      return s !== '' && s !== 'null' && s !== 'undefined' && s !== 'n/a' && s !== '-';
    })
  );

  if (rows.length === 0) {
    setBulkStatus('error', '⚠️ No valid data rows. Check file headers.');
    return;
  }

  setBulkStatus('info', `⟳ Processing ${rows.length} employees...`);

  const progressWrap = document.getElementById('bulkProgressWrap');
  const progressFill = document.getElementById('bulkProgressFill');
  if (progressWrap) progressWrap.style.display = 'block';
  if (progressFill) progressFill.style.width = '0%';

  bulkCalcResults = [];
  let errors = 0;
  const total = rows.length;

  rows.forEach((row, i) => {
    setTimeout(() => {
      if (progressFill) progressFill.style.width = Math.round(((i + 1) / total) * 100) + '%';
    }, i * 5);

    const rowNum = i + 1;

    const name = getBulkField(row, [
      'Employee Name', 'EmployeeName', 'Name', 'Emp Name', 'EmpName', 'Employee', 'EMPLOYEE NAME', 'employee name', 'emp_name'
    ], 'Employee Name') || `Employee ${rowNum}`;

    const grossRaw = getBulkField(row, [
      'Gross Salary', 'Gross', 'Monthly Gross', 'GrossSalary', 'GROSS', 'gross salary',
      'Gross Pay', 'Monthly Gross Salary', 'gross_pay', 'Gross_Amt', 'Total Gross'
    ], 'Gross Salary');
    const gross = cleanNum(grossRaw);

    const minWageRaw = getBulkField(row, [
      'Min Wage', 'Minimum Wage', 'MinWage', 'State Min Wage', 'Min Salary',
      'STATE MIN WAGE', 'min wage', 'minimum wage', 'Min_Wage', 'Minimum Monthly Wage', 'min_wage'
    ], 'Min Wage');
    const minWage = cleanNum(minWageRaw);

    if (isNaN(gross) || gross <= 0) {
      const availableCols = Object.keys(row).join(', ');
      bulkCalcResults.push({
        name, rowNum,
        error: `❌ Gross Salary not found. Got: "${grossRaw}". Available columns: ${availableCols.substring(0,100)}...`
      });
      errors++;
      return;
    }
    if (isNaN(minWage) || minWage <= 0) {
      bulkCalcResults.push({
        name, rowNum,
        error: `❌ Min Wage not found. Got: "${minWageRaw}". Check column header.`
      });
      errors++;
      return;
    }

    const pfRaw = getBulkField(row, ['PF', 'PF Applicable', 'PF (Y/N)', 'pf', 'PF_Applicable', 'PF Applicability', 'pf_yn']);
    const pf = pfRaw && pfRaw.toString().trim().toUpperCase() === 'N' ? 'N' : 'Y';

    const ptRaw = getBulkField(row, ['PT', 'PT Amount', 'Professional Tax', 'PT (Monthly)', 'pt', 'Prof Tax', 'ProfTax', 'pt_amt']);
    const pt = isNaN(cleanNum(ptRaw)) ? 0 : Math.max(0, cleanNum(ptRaw));

    const lwfRaw = getBulkField(row, ['LWF', 'LWF Amount', 'Labour Welfare Fund', 'LWF (Monthly)', 'lwf', 'LWF_Amount', 'lwf_amt']);
    const lwf = isNaN(cleanNum(lwfRaw)) ? 0 : Math.max(0, cleanNum(lwfRaw));

    const gratRaw = getBulkField(row, ['Gratuity', 'Gratuity Amount', 'Monthly Gratuity', 'gratuity', 'gratuity_amt']);
    const gratuityOverride = (gratRaw && !isNaN(cleanNum(gratRaw))) ? cleanNum(gratRaw) : null;

    const leaveRaw = getBulkField(row, ['Leave Encashment', 'Leave', 'Monthly Leave', 'Leave Amount', 'leave encashment', 'leave', 'leave_amt']);
    const leaveOverride = (leaveRaw && !isNaN(cleanNum(leaveRaw))) ? cleanNum(leaveRaw) : null;

    try {
      const r = computeCTC(gross, minWage, pf, pt, lwf, gratuityOverride, leaveOverride);
      // convLabel is already set inside computeCTC via getConvLabel(gross)
      bulkCalcResults.push({
        name, rowNum, error: null, ...r,
        epfEmp: r.epfEmployer, edli: r.edliEmployer, esiEmp: r.esiEmployer,
        esiEe: r.esiEmployee, epfEe: r.epfEmployee, gratuityUsed: r.gratuity,
        leaveUsed: r.leaveComponent, finalAnnual: r.finalCTCAnnual,
        cash: r.cashInHand, pfApplicable: pf,
      });
    } catch (err) {
      bulkCalcResults.push({ name, rowNum, error: 'Calculation error: ' + err.message });
      errors++;
    }
  });

  const delay = Math.min(total * 8, 1500);
  setTimeout(() => {
    if (progressWrap) progressWrap.style.display = 'none';
    renderBulkResults(errors, total);
    if (errors === 0) {
      showToast(`✅ Success! All ${total} employees calculated.`);
    } else {
      showToast(`⚠️ ${total - errors}/${total} calculated. ${errors} errors — check red rows.`);
    }
  }, delay + 200);
}

function bulkFmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '₹0';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function renderBulkResults(errors, total) {
  const valid = bulkCalcResults.filter(r => !r.error);

  const totalMonthly = valid.reduce((s, r) => s + (r.finalCTC || 0), 0);
  const totalAnnual = valid.reduce((s, r) => s + (r.finalAnnual || 0), 0);
  const avgCash = valid.length ? Math.round(valid.reduce((s, r) => s + (r.cash || 0), 0) / valid.length) : 0;
  const avgCTC = valid.length ? Math.round(totalMonthly / valid.length) : 0;
  const minCTC = valid.length ? Math.min(...valid.map(r => r.finalCTC || 0)) : 0;
  const maxCTC = valid.length ? Math.max(...valid.map(r => r.finalCTC || 0)) : 0;

  const summaryEl = document.getElementById('bulkSummaryCards');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="bulk-sum-card"><div class="bsc-label">Total Employees</div><div class="bsc-val">${total}</div></div>
      <div class="bulk-sum-card"><div class="bsc-label">Calculated</div><div class="bsc-val green">${valid.length}</div></div>
      <div class="bulk-sum-card"><div class="bsc-label">Errors</div><div class="bsc-val ${errors > 0 ? 'danger' : ''}">${errors}</div></div>
      <div class="bulk-sum-card"><div class="bsc-label">Total Monthly CTC</div><div class="bsc-val accent">${bulkFmt(totalMonthly)}</div></div>
      <div class="bulk-sum-card"><div class="bsc-label">Total Annual CTC</div><div class="bsc-val accent">${bulkFmt(totalAnnual)}</div></div>
      <div class="bulk-sum-card"><div class="bsc-label">Avg Monthly CTC</div><div class="bsc-val">${bulkFmt(avgCTC)}</div></div>
      <div class="bulk-sum-card"><div class="bsc-label">Avg Cash in Hand</div><div class="bsc-val green">${bulkFmt(avgCash)}</div></div>
      <div class="bulk-sum-card"><div class="bsc-label">Min CTC</div><div class="bsc-val amber">${minCTC ? bulkFmt(minCTC) : '—'}</div></div>
      <div class="bulk-sum-card"><div class="bsc-label">Max CTC</div><div class="bsc-val amber">${maxCTC ? bulkFmt(maxCTC) : '—'}</div></div>
    `;
  }

  // ── Table header: "Conveyance / Spl. Allow." — reflects both cases ──
  const headEl = document.getElementById('bulkTableHead');
  if (headEl) {
    headEl.innerHTML = `<tr>
      <th>#</th><th>Employee Name</th><th>PF</th>
      <th>Gross</th><th>Basic</th><th>HRA</th><th>Conv./Spl.Allow.</th>
      <th>EPF Emp</th><th>EDLI</th><th>Bonus</th><th>ESI Emp</th>
      <th>Gratuity</th><th>Leave Enc.</th><th>LWF</th><th>PT</th>
      <th>Initial CTC</th><th>Final CTC/Mo</th><th>Annual CTC</th>
      <th>EPF Ee</th><th>ESI Ee</th><th>Cash in Hand</th><th>Status</th>
    </tr>`;
  }

  const tot = { gross:0, basic:0, hra:0, conv:0, epfEmp:0, edli:0, bonus:0, esiEmp:0,
    gratuityUsed:0, leaveUsed:0, lwf:0, pt:0, initialCTC:0, finalCTC:0,
    finalAnnual:0, epfEe:0, esiEe:0, cash:0 };

  let bodyHtml = '';
  bulkCalcResults.forEach((r, i) => {
    const alt = i % 2 === 0 ? '' : 'alt-row';
    if (r.error) {
      bodyHtml += `<tr class="error-row ${alt}">
        <td style="color:var(--text-muted)">${r.rowNum}</td>
        <td class="td-name">${escapeHtml(r.name)}</td>
        <td colspan="19" style="font-size:11px;color:var(--danger);padding:8px 12px">${escapeHtml(r.error)}</td>
        <td class="td-err">⚠ Error</td>
      </tr>`;
      return;
    }

    ['gross','basic','hra','conv','epfEmp','edli','bonus','esiEmp','gratuityUsed','leaveUsed','lwf','pt','initialCTC','finalCTC','finalAnnual','epfEe','esiEe','cash'].forEach(k => {
      tot[k] = (tot[k] || 0) + (r[k] || 0);
    });

    // ── Show convLabel as tooltip on the cell ──
    const convCellTitle = r.convLabel || 'Conveyance / Other';

    bodyHtml += `<tr class="${alt}">
      <td style="color:var(--text-muted)">${r.rowNum}</td>
      <td class="td-name">${escapeHtml(r.name)}</td>
      <td class="${r.pfApplicable === 'Y' ? 'td-pf-y' : 'td-pf-n'}">${r.pfApplicable}</td>
      <td class="td-right">${bulkFmt(r.gross)}</td>
      <td class="td-right">${bulkFmt(r.basic)}</td>
      <td class="td-right">${bulkFmt(r.hra)}</td>
      <td class="td-right" title="${convCellTitle}">${bulkFmt(r.conv)}${r.gross > 100000 ? ' <span style="font-size:9px;color:var(--accent2)">SA</span>' : ''}</td>
      <td class="td-right">${bulkFmt(r.epfEmp)}</td>
      <td class="td-right">${bulkFmt(r.edli)}</td>
      <td class="td-right">${r.bonus > 0 ? bulkFmt(r.bonus) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="td-right">${r.esiEmp > 0 ? bulkFmt(r.esiEmp) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="td-right">${bulkFmt(r.gratuityUsed)}</td>
      <td class="td-right">${bulkFmt(r.leaveUsed)}</td>
      <td class="td-right">${r.lwf > 0 ? bulkFmt(r.lwf) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="td-right">${r.pt > 0 ? bulkFmt(r.pt) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="td-right">${bulkFmt(r.initialCTC)}</td>
      <td class="td-right td-ctc">${bulkFmt(r.finalCTC)}</td>
      <td class="td-right td-annual">${bulkFmt(r.finalAnnual)}</td>
      <td class="td-right">${r.epfEe > 0 ? bulkFmt(r.epfEe) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="td-right">${r.esiEe > 0 ? bulkFmt(r.esiEe) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="td-right td-cash">${bulkFmt(r.cash)}</td>
      <td class="td-ok">✓ Done</td>
    </tr>`;
  });

  if (valid.length > 0) {
    bodyHtml += `<tr class="total-row">
      <td colspan="3">TOTAL (${valid.length} employees)</td>
      <td class="td-right">${bulkFmt(tot.gross)}</td>
      <td class="td-right">${bulkFmt(tot.basic)}</td>
      <td class="td-right">${bulkFmt(tot.hra)}</td>
      <td class="td-right">${bulkFmt(tot.conv)}</td>
      <td class="td-right">${bulkFmt(tot.epfEmp)}</td>
      <td class="td-right">${bulkFmt(tot.edli)}</td>
      <td class="td-right">${bulkFmt(tot.bonus)}</td>
      <td class="td-right">${bulkFmt(tot.esiEmp)}</td>
      <td class="td-right">${bulkFmt(tot.gratuityUsed)}</td>
      <td class="td-right">${bulkFmt(tot.leaveUsed)}</td>
      <td class="td-right">${bulkFmt(tot.lwf)}</td>
      <td class="td-right">${bulkFmt(tot.pt)}</td>
      <td class="td-right">${bulkFmt(tot.initialCTC)}</td>
      <td class="td-right td-ctc">${bulkFmt(tot.finalCTC)}</td>
      <td class="td-right td-annual">${bulkFmt(tot.finalAnnual)}</td>
      <td class="td-right">${bulkFmt(tot.epfEe)}</td>
      <td class="td-right">${bulkFmt(tot.esiEe)}</td>
      <td class="td-right td-cash">${bulkFmt(tot.cash)}</td>
      <td>—</td>
    </tr>`;
  }

  const bodyEl = document.getElementById('bulkTableBody');
  if (bodyEl) bodyEl.innerHTML = bodyHtml;

  const resultsSection = document.getElementById('bulkResultsSection');
  if (resultsSection) resultsSection.style.display = 'block';

  const statusMsg = `✓ Done! ${valid.length} calculated${errors > 0 ? `, ${errors} error(s) — check red rows` : ''}.`;
  setBulkStatus(errors > 0 ? 'info' : 'success', statusMsg);
}

function bulkExportCSV() {
  if (!bulkCalcResults.length) { showToast('⚠️ Calculate first'); return; }
  const headers = [
    'Row','Employee Name','PF',
    'Gross Salary','Basic','HRA','Conveyance / Defer Allowance',  // ← Updated header
    'EPF Employer','EDLI Employer','Bonus','ESI Employer',
    'Gratuity (Auto)','Gratuity (Used)','Leave Auto','Leave Used',
    'LWF','PT','Initial CTC',
    'Final CTC Monthly','Final CTC Annual',
    'EPF Employee','ESI Employee','Cash in Hand','Status','Notes'
  ];
  const rows = bulkCalcResults.map(r => {
    if (r.error) return [r.rowNum, r.name, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Error', r.error];
    return [
      r.rowNum, r.name, r.pfApplicable,
      r.gross, r.basic, r.hra, r.conv,
      r.epfEmp, r.edli, r.bonus, r.esiEmp,
      r.gratuityAuto, r.gratuityUsed, r.leaveAuto, r.leaveUsed,
      r.lwf, r.pt, r.initialCTC,
      r.finalCTC, r.finalAnnual,
      r.epfEe, r.esiEe, r.cash, 'Calculated',
      // ── convLabel in notes column ──
      `Basic=${r.pfApplicable === 'Y' ? '55%' : '53%'} of Gross or MinWage | ${r.convLabel}`
    ];
  });
  const csv = [headers, ...rows].map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Bulk_CTC_Report_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  showBulkExportStatus('✓ CSV Downloaded!');
  showToast('✓ Bulk CSV Downloaded');
}

function bulkExportTXT() {
  if (!bulkCalcResults.length) { showToast('⚠️ Calculate first'); return; }
  const valid = bulkCalcResults.filter(r => !r.error);
  const now = new Date().toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' });
  const totalMonthly = valid.reduce((s, r) => s + (r.finalCTC || 0), 0);
  const totalAnnual = valid.reduce((s, r) => s + (r.finalAnnual || 0), 0);
  let txt = `BULK CTC CALCULATION REPORT — NEW LABOUR CODE\n${'='.repeat(60)}\nDate: ${now}\nTotal Employees: ${bulkCalcResults.length}  |  Processed: ${valid.length}  |  Errors: ${bulkCalcResults.length - valid.length}\nTotal Monthly CTC Payout: ${bulkFmt(totalMonthly)}\nTotal Annual CTC Payout:  ${bulkFmt(totalAnnual)}\n${'='.repeat(60)}\n\n`;
  valid.forEach((r, i) => {
    txt += `${i+1}. ${r.name}  (PF: ${r.pfApplicable})\n`;
    txt += `   Gross: ${bulkFmt(r.gross)} | Basic: ${bulkFmt(r.basic)} | HRA: ${bulkFmt(r.hra)} | ${r.convLabel}: ${bulkFmt(r.conv)}\n`;  // ← Dynamic
    txt += `   EPF Emp: ${bulkFmt(r.epfEmp)} | EDLI: ${bulkFmt(r.edli)} | Bonus: ${r.bonus > 0 ? bulkFmt(r.bonus) : 'N/A'} | ESI Emp: ${r.esiEmp > 0 ? bulkFmt(r.esiEmp) : 'N/A'}\n`;
    txt += `   Gratuity: ${bulkFmt(r.gratuityUsed)} | Leave: ${bulkFmt(r.leaveUsed)} | LWF: ${r.lwf > 0 ? bulkFmt(r.lwf) : 'N/A'} | PT: ${r.pt > 0 ? bulkFmt(r.pt) : 'N/A'}\n`;
    txt += `   Initial CTC: ${bulkFmt(r.initialCTC)}\n`;
    txt += `   ► Final CTC: ${bulkFmt(r.finalCTC)}/month  |  ${bulkFmt(r.finalAnnual)}/year\n`;
    txt += `   ► Cash in Hand: ${bulkFmt(r.cash)}\n`;
    txt += `${'—'.repeat(55)}\n`;
  });
  if (bulkCalcResults.some(r => r.error)) {
    txt += `\nERRORS:\n`;
    bulkCalcResults.filter(r => r.error).forEach(r => {
      txt += `  Row ${r.rowNum}: ${r.name} — ${r.error}\n`;
    });
  }
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Bulk_CTC_Summary_${new Date().toISOString().slice(0,10)}.txt`;
  link.click();
  showBulkExportStatus('✓ TXT Downloaded!');
  showToast('✓ Summary TXT Downloaded');
}

function bulkCopyClipboard() {
  if (!bulkCalcResults.length) { showToast('⚠️ Calculate first'); return; }
  const valid = bulkCalcResults.filter(r => !r.error);
  // ── Dynamic header based on whether any row has gross > 1L ──
  const hasHighGross = valid.some(r => r.gross > 100000);
  const convHeader = hasHighGross ? 'Conv./Spl.Allow.' : 'Conveyance';
  const headers = ['#','Name','PF','Gross','Basic','HRA',convHeader,'EPF Emp','EDLI','Bonus','ESI Emp','Gratuity','Leave','LWF','PT','Initial CTC','Final CTC/Mo','Annual CTC','EPF Ee','ESI Ee','Cash in Hand'];
  const rows = valid.map((r, i) => [
    i+1, r.name, r.pfApplicable,
    r.gross, r.basic, r.hra, r.conv,
    r.epfEmp, r.edli, r.bonus, r.esiEmp,
    r.gratuityUsed, r.leaveUsed, r.lwf, r.pt,
    r.initialCTC, r.finalCTC, r.finalAnnual,
    r.epfEe, r.esiEe, r.cash
  ].join('\t'));
  const text = [headers.join('\t'), ...rows].join('\n');
  navigator.clipboard.writeText(text)
    .then(() => { showBulkExportStatus('✓ Copied!'); showToast('⎘ Bulk data copied to clipboard'); })
    .catch(() => showToast('⚠️ Copy failed'));
}

function bulkDownloadTemplate() {
  const csv = `Employee Name,Gross Salary,Min Wage,PF (Y/N),PT Amount,LWF Amount,Gratuity,Leave Encashment
Rahul Sharma,30000,16868,Y,200,20,,
Priya Verma,45000,16868,Y,200,0,,
Amit Patel,18000,16868,N,0,0,,
Neha Singh,60000,16868,Y,300,25,,
Vikram Gupta,25000,16868,Y,200,20,,
Sunita Kumar,50000,14000,Y,200,0,,
Rajesh Mehta,120000,15860,Y,200,20,,
Pooja Joshi,150000,16868,Y,200,0,,
Arun Rao,80000,16868,N,208,0,,
Kavita Nair,15000,14858,Y,0,0,,`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'CTC_Bulk_Upload_Template.csv';
  link.click();
  showToast('✓ Template Downloaded');
}

function resetBulk() {
  bulkRawData = [];
  bulkCalcResults = [];
  const actionRow = document.getElementById('bulkActionRow');
  const resultsSection = document.getElementById('bulkResultsSection');
  const progressWrap = document.getElementById('bulkProgressWrap');
  const statusEl = document.getElementById('bulkStatus');
  const progressFill = document.getElementById('bulkProgressFill');
  if (actionRow) actionRow.style.display = 'none';
  if (resultsSection) resultsSection.style.display = 'none';
  if (progressWrap) progressWrap.style.display = 'none';
  if (statusEl) statusEl.style.display = 'none';
  if (progressFill) progressFill.style.width = '0%';
  initBulkTab();
  showToast('↺ Bulk upload reset');
}

function setBulkStatus(type, msg) {
  const el = document.getElementById('bulkStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = 'bulk-status ' + type;
  el.style.display = 'block';
}
function showBulkExportStatus(msg) {
  const el = document.getElementById('bulkExportStatus');
  if (!el) return;
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 3000);
}