/* ============================================
   CTC CALCULATOR — FIREBASE AUTH + LOGIC
   New Labour Code | Cross-Device Login System
   ============================================ */

// 🔥 FIREBASE CONFIG - Your config here
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBYmsh-IgGPtx804pIWnc7UJ_AvlR51CIo",
  authDomain: "ctc-calculator-51f6d.firebaseapp.com",
  projectId: "ctc-calculator-51f6d",
  storageBucket: "ctc-calculator-51f6d.firebasestorage.app",
  messagingSenderId: "774507368996",
  appId: "1:774507368996:web:fb59fa486bece0bf4c3eb1",
  measurementId: "G-DBRLCZ7VL4"
};

// Initialize Firebase (SDKs already loaded in HTML head)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ============== GLOBAL STATE ==============
let currentUser = null;
let isAdmin = false;
let currentUserId = null;

// Calculator state
let pfApplicable = 'Y';
let calcResult = null;
let gratuityMode = 'auto';
let leaveMode = 'auto';

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
});

// ============== AUTH LISTENER (Cross-Device Sync) ==============
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
          // User exists in Auth but not in Firestore - sign out
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
      // No user logged in
      currentUser = null;
      isAdmin = false;
      currentUserId = null;
      showLoginPage();
    }
  });
}

// ============== EVENT LISTENERS ==============
function setupEventListeners() {
  // Login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  
  // Admin register form
  const adminRegisterForm = document.getElementById('adminRegisterForm');
  if (adminRegisterForm) adminRegisterForm.addEventListener('submit', handleAdminRegister);
  
  // Create user form (admin panel)
  const createUserForm = document.getElementById('createUserForm');
  if (createUserForm) createUserForm.addEventListener('submit', handleCreateUser);
  
  // Navigation links
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
      if (isAdmin) {
        switchTab('admin');
        loadUsersTable();
        updateAdminInfo();
      }
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
  
  // Initialize calculator if needed
  if (typeof liveCalc === 'function') liveCalc();
}

function safeToggle(elementId, hide) {
  const el = document.getElementById(elementId);
  if (el) el.classList.toggle('hidden', hide);
}

// ============== AUTH FUNCTIONS ==============

function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
}

// 🔐 LOGIN
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
  
  try {
    await auth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged handles the rest
  } catch (error) {
    console.error('Login error:', error);
    let msg = 'Login failed';
    if (error.code === 'auth/user-not-found') msg = 'No account with this email';
    else if (error.code === 'auth/wrong-password') msg = 'Incorrect password';
    else if (error.code === 'auth/invalid-email') msg = 'Invalid email format';
    else if (error.code === 'auth/too-many-requests') msg = 'Too many attempts. Try later.';
    showError(errorEl, msg);
  }
}

// 🔐 ADMIN REGISTER (First Time Setup)
// 🔐 ADMIN REGISTER - FIXED VERSION (No collection query!)
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
  
  try {
    // ✅ STEP 1: Create Firebase Auth user
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;
    
    // ✅ STEP 2: Save to Firestore (rules allow create for own UID)
    await db.collection('users').doc(uid).set({
      uid: uid,
      name: name,
      companyName: companyName,
      email: email,
      role: 'admin',  // ✅ First registrant becomes admin
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // ✅ Success
    if (successEl) {
      successEl.classList.remove('hidden');
      successEl.textContent = '✓ Admin account created! Redirecting to login...';
    }
    
    // ✅ Sign out & redirect
    await auth.signOut();
    setTimeout(() => {
      showLoginPage();
      showToast('✓ Admin registered! Please login now.');
    }, 2000);
    
  } catch (error) {
    console.error('Admin register error:', error);
    
    // ✅ Better error messages
    let msg = 'Registration failed';
    if (error.code === 'auth/email-already-in-use') msg = 'Email already registered';
    else if (error.code === 'auth/weak-password') msg = 'Password too weak (min 6 chars)';
    else if (error.code === 'auth/invalid-email') msg = 'Invalid email format';
    else if (error.code === 'permission-denied') msg = 'Permission error - Hard refresh & try again';
    else msg = `Error: ${error.message || error.code}`;
    
    showError(errorEl, msg);
    showToast('⚠️ ' + msg);
    
    // ✅ If permission error, suggest manual setup
    if (error.code === 'permission-denied') {
      showToast('💡 Try: Hard refresh (Ctrl+Shift+R) or create admin manually in Firebase Console');
    }
  }
}

// 🔐 CREATE USER (Admin Panel)
async function handleCreateUser(e) {
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
  
  try {
    // Create Firebase Auth user
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;
    
    // Save to Firestore
    await db.collection('users').doc(uid).set({
      uid,
      name,
      email,
      role: 'user',
      createdBy: currentUserId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLogin: null
    });
    
    showSuccess(msgEl, `✓ User "${name}" created! Share credentials with them.`);
    document.getElementById('createUserForm')?.reset();
    loadUsersTable();
    
  } catch (error) {
    console.error('Create user error:', error);
    let msg = 'Failed to create user';
    if (error.code === 'auth/email-already-in-use') msg = 'Email already registered';
    showError(msgEl, msg, true);
  }
}

// 🔐 LOGOUT
function logout() {
  auth.signOut().then(() => {
    showToast('↪️ Logged out successfully');
    // onAuthStateChanged handles UI update
  }).catch((error) => {
    console.error('Logout error:', error);
    showToast('⚠️ Logout failed');
  });
}

// 🔐 UPDATE LAST LOGIN
async function updateLastLogin() {
  if (!currentUserId) return;
  try {
    await db.collection('users').doc(currentUserId).update({
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.warn('Could not update last login:', e);
  }
}

// ============== ADMIN PANEL FUNCTIONS ==============

function updateAdminInfo() {
  if (!isAdmin || !currentUser) return;
  
  const adminInfoEl = document.getElementById('currentAdminInfo');
  const totalUsersEl = document.getElementById('totalUsersCount');
  
  if (adminInfoEl && currentUser) {
    adminInfoEl.textContent = `${currentUser.name} • ${currentUser.companyName || 'N/A'}`;
  }
  
  if (totalUsersEl) {
    // Count will be updated by loadUsersTable
  }
}

async function loadUsersTable() {
  if (!isAdmin) return;
  
  const tbody = document.getElementById('usersTableBody');
  const noUsersMsg = document.getElementById('noUsersMsg');
  if (!tbody) return;
  
  try {
    const snapshot = await db.collection('users')
      .where('role', '==', 'user')
      .orderBy('createdAt', 'desc')
      .get();
    
    if (snapshot.empty) {
      tbody.innerHTML = '';
      if (noUsersMsg) noUsersMsg.classList.remove('hidden');
      if (document.getElementById('totalUsersCount')) {
        document.getElementById('totalUsersCount').textContent = '0';
      }
      return;
    }
    
    if (noUsersMsg) noUsersMsg.classList.add('hidden');
    
    let html = '';
    let count = 0;
    snapshot.forEach(doc => {
      const user = doc.data();
      count++;
      const date = user.createdAt?.toDate()?.toLocaleDateString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric'
      }) || 'N/A';
      
      html += `
        <tr>
          <td><strong>${escapeHtml(user.name)}</strong></td>
          <td>${escapeHtml(user.email)}</td>
          <td>${date}</td>
          <td>
            <button class="btn-sm btn-delete" onclick="deleteUser('${user.uid}')">
              🗑️ Delete
            </button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
    
    if (document.getElementById('totalUsersCount')) {
      document.getElementById('totalUsersCount').textContent = count;
    }
    
  } catch (error) {
    console.error('Load users error:', error);
    showToast('⚠️ Failed to load users');
  }
}

async function deleteUser(uid) {
  if (!isAdmin) return;
  if (!confirm('Are you sure you want to delete this user?')) return;
  
  try {
    // Delete from Firestore
    await db.collection('users').doc(uid).delete();
    
    showToast('✓ User deleted from system');
    loadUsersTable();
    
  } catch (error) {
    console.error('Delete user error:', error);
    showToast('⚠️ Failed to delete user');
  }
}

async function clearAllData() {
  if (!isAdmin) return;
  
  if (!confirm('⚠️ WARNING: This will delete ALL user data!\n\nAre you absolutely sure?')) return;
  
  const confirmText = prompt('Type "DELETE ALL" to confirm:');
  if (confirmText !== 'DELETE ALL') {
    showToast('⚠️ Operation cancelled');
    return;
  }
  
  try {
    // Delete all non-admin users from Firestore
    const snapshot = await db.collection('users')
      .where('role', '==', 'user')
      .get();
    
    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    showToast('✓ All user data cleared');
    loadUsersTable();
    
  } catch (error) {
    console.error('Clear data error:', error);
    showToast('⚠️ Failed to clear data');
  }
}

// ============== UTILITY FUNCTIONS ==============

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
  
  if (avatarEl && currentUser.name) {
    const initial = currentUser.name.charAt(0).toUpperCase();
    avatarEl.textContent = initial;
  }
}

// ============== CALCULATOR INIT ==============
function initializeCalculator() {
  // Set default PF state
  setPF('Y');
  setGratuityMode('auto');
  setLeaveMode('auto');
}

// ============== CALCULATOR LOGIC (Original - Unchanged) ==============

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

  if (manualInput) manualInput.classList.toggle('hidden', mode !== 'manual');
  
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

  if (manualInput) manualInput.classList.toggle('hidden', mode !== 'manual');
  
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