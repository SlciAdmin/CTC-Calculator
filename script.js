/* ============================================
   CTC CALCULATOR — FIREBASE AUTH + LOGIC
   New Labour Code | Cross-Device Login System
   LWF + PT: State-wise Auto Calculation
   
   ✅ PF Mandatory if Basic ≤ ₹15,000 (EPF Act)
   ✅ BULK UPLOAD — FULL INDIVIDUAL-LEVEL PARITY
   ✅ computeCTC accepts leavesPerYear param
   ✅ BULK SEARCH — Search by Name/Code/Branch/Any Field
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
const db   = firebase.firestore();

// ============== GLOBAL STATE ==============
let currentUser   = null;
let isAdmin       = false;
let currentUserId = null;
let leaveCountManual = 15;

let pfApplicable = 'Y';
let calcResult   = null;
let gratuityMode = 'auto';
let leaveMode    = 'auto';
let lwfMode      = 'auto';
let ptMode       = 'auto';

let pfBaseMode     = 'standard';
let pfAddVoluntary = false;
let pfVoluntaryPct = 0;
let pfSpecificAmt  = 0;
let pfEmployerRate = '12.5';

// ============== LWF STATE-WISE CONFIG ==============
const LWF_STATES = {
  TN:    { name: 'Tamil Nadu',       months: 'dec',     amount: 20,   formula: null },
  AP:    { name: 'Andhra Pradesh',   months: 'dec',     amount: 30,   formula: null },
  SKL:   { name: 'Kerala',           months: 'all',     amount: 20,   formula: null },
  FKL:   { name: 'Karnataka',        months: 'jun-dec', amount: 20,   formula: null },
  MH:    { name: 'Maharashtra',      months: 'jun-dec', amount: 25,   formula: null },
  Goa:   { name: 'Goa',              months: 'jun-dec', amount: 60,   formula: null },
  DL:    { name: 'Delhi',            months: 'jun-dec', amount: 0.75, formula: null },
  CH:    { name: 'Chandigarh',       months: 'all',     amount: 5,    formula: null },
  MP:    { name: 'Madhya Pradesh',   months: 'jun-dec', amount: 10,   formula: null },
  CG:    { name: 'Chhattisgarh',     months: 'jun-dec', amount: 15,   formula: null },
  WB:    { name: 'West Bengal',      months: 'jun-dec', amount: 3,    formula: null },
  OD:    { name: 'Odisha',           months: 'jun-dec', amount: 10,   formula: null },
  HR:    { name: 'Haryana',          months: 'all',     amount: null, formula: 'hr' },
  OTHER: { name: 'Other',            months: 'none',    amount: 0,    formula: null },
};

const LWF_STATE_ALIASES = {
  'TN':  ['TN','TAMIL NADU','TAMILNADU'],
  'AP':  ['AP','ANDHRA PRADESH','ANDHRAPRADESH'],
  'SKL': ['SKL','KL','KERALA'],
  'FKL': ['FKL','KA','KARNATAKA'],
  'MH':  ['MH','MAHARASHTRA'],
  'Goa': ['GOA','GA'],
  'DL':  ['DL','DELHI'],
  'CH':  ['CH','CHANDIGARH'],
  'MP':  ['MP','MADHYA PRADESH','MADHYAPRADESH'],
  'CG':  ['CG','CHHATTISGARH','CHATTISGARH'],
  'WB':  ['WB','WEST BENGAL','WESTBENGAL'],
  'OD':  ['OD','ODISHA','ORISSA'],
  'HR':  ['HR','HARYANA'],
  'OTHER': ['OTHER','NONE','NA','NIL',''],
};

function resolveLWFStateCode(input) {
  if (!input) return null;
  const s = String(input).trim().toUpperCase();
  for (const [code, aliases] of Object.entries(LWF_STATE_ALIASES)) {
    if (aliases.includes(s)) return code;
  }
  return null;
}

function computeLWFAuto(stateCode, month, gross, hasLeaves) {
  if (!hasLeaves) return 0;
  if (!stateCode || !LWF_STATES[stateCode]) return 0;
  const state = LWF_STATES[stateCode];
  if (state.formula === 'hr') {
    const hrVal = gross * 0.002;
    return hrVal <= 34 ? Math.round(hrVal * 100) / 100 : 34;
  }
  const isDecember  = month === 12;
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
  const state     = LWF_STATES[stateCode];
  const monthName = new Date(2024, month - 1, 1).toLocaleString('en-IN', { month: 'long' });
  if (stateCode === 'OTHER') return 'No LWF applicable for selected state';
  if (state.formula === 'hr') {
    const hrVal = gross * 0.002;
    const cap   = hrVal <= 34 ? hrVal : 34;
    return 'HR Formula: Gross x 0.2% = Rs.' + hrVal.toFixed(2) + ' -> Capped at Rs.34 -> Result: Rs.' + cap.toFixed(2);
  }
  const appMonths    = { 'all': 'every month', 'dec': 'December only', 'jun-dec': 'June & December only', 'none': 'never' };
  const isApplicable = computeLWFAuto(stateCode, month, gross, true) > 0;
  const rule         = appMonths[state.months] || '';
  return state.name + ': Rs.' + state.amount + ' applicable ' + rule + '. ' + monthName + ' -> ' + (isApplicable ? 'APPLICABLE' : 'NOT applicable this month');
}

function setLWFMode(mode) {
  lwfMode = mode;
  const autoBtn       = document.getElementById('lwfAuto');
  const manualBtn     = document.getElementById('lwfManual');
  const autoWrapper   = document.getElementById('lwfAutoWrapper');
  const manualWrapper = document.getElementById('lwfManualWrapper');
  if (autoBtn)       autoBtn.classList.toggle('active', mode === 'auto');
  if (manualBtn)     manualBtn.classList.toggle('active', mode === 'manual');
  if (autoWrapper)   autoWrapper.classList.toggle('hidden', mode !== 'auto');
  if (manualWrapper) manualWrapper.classList.toggle('hidden', mode !== 'manual');
  if (mode === 'auto') updateLWFAuto();
  liveCalc();
}

function updateLWFAuto() {
  const stateEl  = document.getElementById('lwfState');
  const monthEl  = document.getElementById('lwfMonth');
  const resultEl = document.getElementById('lwfAutoValue');
  const hintEl   = document.getElementById('lwfAutoHint');
  if (!stateEl || !monthEl) return;
  const stateCode = stateEl.value;
  const month     = parseInt(monthEl.value) || 12;
  const gross     = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  if (!stateCode) {
    if (resultEl) resultEl.textContent = 'Select state to calculate';
    if (hintEl)   hintEl.textContent   = 'Select state and month to auto-calculate LWF';
    liveCalc();
    return;
  }
  const lwfVal = computeLWFAuto(stateCode, month, gross, true);
  const hint   = getLWFHint(stateCode, month, gross);
  if (resultEl) {
    resultEl.textContent = lwfVal > 0 ? 'Rs.' + lwfVal : 'Rs.0 (Not applicable this month)';
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
  const month     = parseInt(monthEl.value) || 12;
  const gross     = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  return computeLWFAuto(stateCode, month, gross, true);
}

function getLWFLabel() {
  if (lwfMode === 'manual') return 'LWF (Manual)';
  const stateEl = document.getElementById('lwfState');
  if (!stateEl || !stateEl.value) return 'LWF (Auto)';
  const state = LWF_STATES[stateEl.value];
  if (!state) return 'LWF (Auto)';
  return 'LWF - ' + state.name;
}

// ============== PROFESSIONAL TAX CONFIG ==============
const PT_STATES = {
  KA:  { name: 'Karnataka', rules: [{ min: 24999, max: null, amount: function(m) { return m === 2 ? 300 : 200; } }] },
  OD:  { name: 'Odisha', rules: [
    { min: 13305, max: 25000, amount: 125 },
    { min: 25001, max: null,  amount: function(m) { return m === 2 ? 300 : 200; } }
  ]},
  GJ:  { name: 'Gujarat', rules: [
    { min: 6000,  max: 0,    amount: 8 },
    { min: 9000,  max: 0,    amount: 0 },
    { min: 12000, max: null, amount: 200 }
  ]},
  MH:  { name: 'Maharashtra', rules: [
    { min: 7501,  max: 10000, amount: 175, gender: 'Male' },
    { min: 10001, max: null,  amount: function(m) { return m === 2 ? 300 : 200; }, gender: 'Male' },
    { min: 25001, max: null,  amount: function(m) { return m === 2 ? 300 : 200; }, gender: 'Female' }
  ]},
  MH1: { name: 'Maharashtra Metro', rules: [
    { min: 7501,  max: 10000, amount: 175, gender: 'Male' },
    { min: 10001, max: null,  amount: function(m) { return m === 2 ? 300 : 200; }, gender: 'Male' },
    { min: 25001, max: null,  amount: function(m) { return m === 2 ? 300 : 200; }, gender: 'Female' }
  ]},
  AP:  { name: 'Andhra Pradesh', rules: [
    { min: 15001, max: 20000, amount: 150 },
    { min: 20001, max: null,  amount: 200 }
  ]},
  TS:  { name: 'Telangana', rules: [
    { min: 15001, max: 20000, amount: 150 },
    { min: 20001, max: null,  amount: 200 }
  ]},
  AS:  { name: 'Assam', rules: [
    { min: 10001, max: 15000, amount: 150 },
    { min: 15001, max: 25000, amount: 180 },
    { min: 25001, max: null,  amount: 208 }
  ]},
  SK:  { name: 'Sikkim', rules: [
    { min: 20001, max: 30000, amount: 125 },
    { min: 30001, max: 40000, amount: 150 },
    { min: 40001, max: null,  amount: 200 }
  ]},
  KL:  { name: 'Kerala', rules: [
    { min: 12000,  max: 17999,  amount: 120,  month: 6 },
    { min: 18000,  max: 29999,  amount: 180,  month: 6 },
    { min: 30000,  max: 44999,  amount: 300,  month: 6 },
    { min: 45000,  max: 59999,  amount: 450,  month: 6 },
    { min: 60000,  max: 74999,  amount: 600,  month: 6 },
    { min: 75000,  max: 99999,  amount: 750,  month: 6 },
    { min: 100000, max: 124999, amount: 1000, month: 6 },
    { min: 125000, max: null,   amount: 1250, month: 6 }
  ]},
  PB:  { name: 'Punjab', rules: [{ min: 20833, max: null, amount: 200 }] },
  GA:  { name: 'Goa', rules: [
    { min: 15001, max: 25000, amount: 150 },
    { min: 25001, max: null,  amount: 200 }
  ]},
  BR:  { name: 'Bihar', rules: [
    { min: 25001, max: 41666,  amount: 83.33 },
    { min: 41667, max: 83333,  amount: 166.67 },
    { min: 83334, max: null,   amount: 208.33 }
  ]},
  MP:  { name: 'Madhya Pradesh', rules: [
    { min: 18751, max: 25000, amount: 125 },
    { min: 25001, max: 33333, amount: 166 },
    { min: 33334, max: null,  amount: function(m) { return m === 3 ? 208 : 212; } }
  ]},
  ML:  { name: 'Meghalaya', rules: [
    { min: 4167,  max: 6250,  amount: 16.50 },
    { min: 6251,  max: 8333,  amount: 25 },
    { min: 8334,  max: 12500, amount: 41.50 },
    { min: 12501, max: 16666, amount: 62.50 },
    { min: 16667, max: 20833, amount: 83.33 },
    { min: 20834, max: 25000, amount: 104.16 },
    { min: 25001, max: 29166, amount: 125 },
    { min: 29167, max: 33333, amount: 150 },
    { min: 33334, max: 37500, amount: 175 },
    { min: 37501, max: 41666, amount: 200 },
    { min: 41667, max: null,  amount: 208 }
  ]},
  WB:  { name: 'West Bengal', rules: [
    { min: 10001, max: 15000, amount: 110 },
    { min: 15001, max: 25000, amount: 130 },
    { min: 25001, max: 40000, amount: 150 },
    { min: 40001, max: null,  amount: 200 }
  ]},
  TN:  { name: 'Tamil Nadu', rules: [
    { min: 21001, max: 30000, amount: 30 },
    { min: 30001, max: 45000, amount: 70.83 },
    { min: 45001, max: 60000, amount: 155 },
    { min: 60001, max: 75000, amount: 171 },
    { min: 75001, max: null,  amount: 208 }
  ]},
  TR:  { name: 'Tripura', rules: [
    { min: 7501,  max: 15000, amount: 150 },
    { min: 15001, max: null,  amount: 208 }
  ]},
  JH:  { name: 'Jharkhand', rules: [
    { min: 25001, max: 41666, amount: 100 },
    { min: 41667, max: 66666, amount: 150 },
    { min: 66667, max: 83333, amount: 175 },
    { min: 83334, max: null,  amount: 208 }
  ]},
  MN:  { name: 'Manipur', rules: [
    { min: 4168,  max: 6250,  amount: 100 },
    { min: 6251,  max: 8333,  amount: 167 },
    { min: 8334,  max: 10416, amount: 200 },
    { min: 10417, max: null,  amount: function(m) { return m === 3 ? 208 : 212; } }
  ]},
  OTHER: { name: 'Other', rules: [] }
};

const PT_STATE_ALIASES = {
  'KA':  ['KA','KARNATAKA'],
  'OD':  ['OD','ODISHA','ORISSA'],
  'GJ':  ['GJ','GUJARAT'],
  'MH':  ['MH','MAHARASHTRA'],
  'MH1': ['MH1','MAHARASHTRA METRO','MAHARASHTRAMETRO','MH METRO'],
  'AP':  ['AP','ANDHRA PRADESH','ANDHRAPRADESH'],
  'TS':  ['TS','TELANGANA'],
  'AS':  ['AS','ASSAM'],
  'SK':  ['SK','SIKKIM'],
  'KL':  ['KL','KERALA'],
  'PB':  ['PB','PUNJAB'],
  'GA':  ['GA','GOA'],
  'BR':  ['BR','BIHAR'],
  'MP':  ['MP','MADHYA PRADESH','MADHYAPRADESH'],
  'ML':  ['ML','MEGHALAYA'],
  'WB':  ['WB','WEST BENGAL','WESTBENGAL'],
  'TN':  ['TN','TAMIL NADU','TAMILNADU'],
  'TR':  ['TR','TRIPURA'],
  'JH':  ['JH','JHARKHAND'],
  'MN':  ['MN','MANIPUR'],
  'OTHER': ['OTHER','NONE','NA','NIL','NO PT','','NOPT'],
};

function resolvePTStateCode(input) {
  if (!input) return null;
  const s = String(input).trim().toUpperCase();
  for (const [code, aliases] of Object.entries(PT_STATE_ALIASES)) {
    if (aliases.includes(s)) return code;
  }
  return null;
}

function computePTAuto(stateCode, salary, month, gender) {
  if (!stateCode || !PT_STATES[stateCode]) return 0;
  const state = PT_STATES[stateCode];
  if (!state.rules || state.rules.length === 0) return 0;
  for (var i = 0; i < state.rules.length; i++) {
    const rule = state.rules[i];
    if (salary < rule.min) continue;
    if (rule.max !== null && salary > rule.max) continue;
    if (rule.month !== undefined && rule.month !== month) continue;
    if (rule.gender !== undefined && rule.gender !== gender) continue;
    if (typeof rule.amount === 'function') return Math.round(rule.amount(month) * 100) / 100;
    return Math.round(rule.amount * 100) / 100;
  }
  return 0;
}

function getPTHint(stateCode, salary, month, gender) {
  if (!stateCode || !PT_STATES[stateCode]) return 'Select a state to see PT rule';
  const state     = PT_STATES[stateCode];
  const stateName = state.name;
  if (stateCode === 'OTHER') return 'No Professional Tax applicable for selected state';
  var applicableRules = [];
  for (var i = 0; i < state.rules.length; i++) {
    const rule = state.rules[i];
    if (salary < rule.min) continue;
    if (rule.max !== null && salary > rule.max) continue;
    if (rule.month !== undefined && rule.month !== month) continue;
    if (rule.gender !== undefined && rule.gender !== gender) continue;
    applicableRules.push(rule);
  }
  if (applicableRules.length === 0)
    return stateName + ': No PT applicable for salary Rs.' + salary.toLocaleString('en-IN') + ' in ' + new Date(2024, month-1).toLocaleString('en-IN', {month:'long'});
  const rule   = applicableRules[0];
  const amount = typeof rule.amount === 'function' ? rule.amount(month) : rule.amount;
  return stateName + ': Rs.' + amount + ' applicable (Salary: Rs.' + salary.toLocaleString('en-IN') + ', Month: ' + new Date(2024, month-1).toLocaleString('en-IN', {month:'long'}) + (rule.gender ? ', Gender: ' + rule.gender : '') + ')';
}

function setPTMode(mode) {
  ptMode = mode;
  const autoBtn       = document.getElementById('ptAuto');
  const manualBtn     = document.getElementById('ptManual');
  const autoWrapper   = document.getElementById('ptAutoWrapper');
  const manualWrapper = document.getElementById('ptManualWrapper');
  const manualInput   = document.getElementById('ptAmount');
  if (autoBtn)       autoBtn.classList.toggle('active', mode === 'auto');
  if (manualBtn)     manualBtn.classList.toggle('active', mode === 'manual');
  if (autoWrapper)   autoWrapper.classList.toggle('hidden', mode !== 'auto');
  if (manualWrapper) manualWrapper.classList.toggle('hidden', mode !== 'manual');
  const stateEl     = document.getElementById('ptState');
  const genderGroup = document.getElementById('ptGenderGroup');
  if (stateEl && genderGroup) {
    genderGroup.style.display = ['MH', 'MH1'].includes(stateEl.value) ? 'flex' : 'none';
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
  const stateEl     = document.getElementById('ptState');
  const monthEl     = document.getElementById('ptMonth');
  const genderEl    = document.getElementById('ptGender');
  const resultEl    = document.getElementById('ptAutoValue');
  const hintEl      = document.getElementById('ptAutoHint');
  const genderGroup = document.getElementById('ptGenderGroup');
  if (!stateEl || !monthEl) return;
  const stateCode = stateEl.value;
  const month     = parseInt(monthEl.value) || 12;
  const salary    = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  const gender    = genderEl?.value || 'Male';
  if (genderGroup) genderGroup.style.display = ['MH', 'MH1'].includes(stateCode) ? 'flex' : 'none';
  if (!stateCode) {
    if (resultEl) resultEl.textContent = 'Select state to calculate';
    if (hintEl)   hintEl.textContent   = 'Select state, month & gender to auto-calculate Professional Tax';
    liveCalc();
    return;
  }
  const ptVal = computePTAuto(stateCode, salary, month, gender);
  const hint  = getPTHint(stateCode, salary, month, gender);
  if (resultEl) {
    resultEl.textContent = ptVal > 0 ? 'Rs.' + ptVal : 'Rs.0 (Not applicable)';
    resultEl.style.color = ptVal > 0 ? 'var(--accent3)' : 'var(--text-muted)';
  }
  if (hintEl) hintEl.textContent = hint;
  liveCalc();
}

function getPTValue() {
  if (ptMode === 'manual') return parseFloat(document.getElementById('ptAmount')?.value) || 0;
  const stateEl  = document.getElementById('ptState');
  const monthEl  = document.getElementById('ptMonth');
  const genderEl = document.getElementById('ptGender');
  if (!stateEl || !monthEl || !stateEl.value) return 0;
  return computePTAuto(stateEl.value, parseFloat(document.getElementById('grossSalary')?.value) || 0,
    parseInt(monthEl.value) || 12, genderEl?.value || 'Male');
}

function getPTLabel() {
  if (ptMode === 'manual') return 'PT (Manual)';
  const stateEl = document.getElementById('ptState');
  if (!stateEl || !stateEl.value) return 'PT (Auto)';
  const state = PT_STATES[stateEl.value];
  if (!state) return 'PT (Auto)';
  return 'PT - ' + state.name;
}

// ============== PF MODE FUNCTIONS ==============
function setPFApplicable(val) {
  pfApplicable = val;
  const pfYes         = document.getElementById('pfYes');
  const pfNo          = document.getElementById('pfNo');
  const pfModeSection = document.getElementById('pfModeSection');
  const hint          = document.getElementById('pfHint');

  if (pfYes) pfYes.classList.toggle('active', val === 'Y');
  if (pfNo)  pfNo.classList.toggle('active', val === 'N');

  const gross   = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  const minWage = parseFloat(document.getElementById('minWage')?.value) || 0;
  const basicPct = val === 'Y' ? 0.55 : 0.53;
  const basicFromGross = Math.round(gross * basicPct);
  const basic = Math.min(Math.max(basicFromGross, minWage), gross);
  const isPFMandatory = basic <= 15000;

  if (pfNo) {
    if (isPFMandatory && val === 'N') {
      pfApplicable = 'Y';
      if (pfYes) pfYes.classList.add('active');
      if (pfNo) pfNo.classList.remove('active');
      showToast('⚠️ PF Mandatory: Basic Salary (₹' + Math.round(basic).toLocaleString('en-IN') + ') is ≤ ₹15,000. As per EPF Act, PF cannot be disabled.');
    }
    pfNo.disabled = isPFMandatory;
    pfNo.title = isPFMandatory ? 'PF mandatory for Basic ≤ ₹15,000 as per EPF Act' : '';
    pfNo.style.cursor = isPFMandatory ? 'not-allowed' : 'pointer';
    pfNo.style.opacity = isPFMandatory ? '0.5' : '1';
  }

  if (pfModeSection) pfModeSection.style.display = pfApplicable === 'Y' ? 'block' : 'none';

  if (pfApplicable === 'N') {
    if (hint) hint.textContent = '53% of Gross or Min Wage (whichever is higher) -> Basic. No PF deducted.';
    pfBaseMode     = 'standard';
    pfAddVoluntary = false;
    pfEmployerRate = '12.5';
    _syncPFUI();
  } else {
    updatePFHint();
  }
  liveCalc();
}

function setPF(val) {
  const gross   = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  const minWage = parseFloat(document.getElementById('minWage')?.value) || 0;
  const basicPct = val === 'Y' ? 0.55 : 0.53;
  const basicFromGross = Math.round(gross * basicPct);
  const basic = Math.min(Math.max(basicFromGross, minWage), gross);

  if (val === 'N' && basic <= 15000) {
    showToast('⚠️ PF Cannot Be Disabled: When Basic Salary (₹' + Math.round(basic).toLocaleString('en-IN') + ') is ₹15,000 or less, PF is MANDATORY as per EPF Act 1952.');
    return;
  }
  setPFApplicable(val);
}

function setPFBaseMode(mode) {
  pfBaseMode = mode;
  _syncPFUI();
  updatePFHint();
  liveCalc();
}

function togglePFVoluntary() {
  pfAddVoluntary = !pfAddVoluntary;
  _syncPFUI();
  updatePFHint();
  liveCalc();
}

function togglePFEmployerRate() {
  pfEmployerRate = pfEmployerRate === '12.5' ? '12' : '12.5';
  _syncPFUI();
  updatePFHint();
  liveCalc();
}

function _syncPFUI() {
  ['standard', 'full_basic', 'specific_amt'].forEach(function(m) {
    const btn = document.getElementById('pfBase_' + m);
    if (btn) btn.classList.toggle('active', m === pfBaseMode);
  });
  const volBtn = document.getElementById('pfAddon_voluntary');
  if (volBtn) volBtn.classList.toggle('active', pfAddVoluntary);
  const empRateBtn = document.getElementById('pfEmployerRateToggle');
  if (empRateBtn) {
    empRateBtn.classList.toggle('active', pfEmployerRate === '12');
    empRateBtn.querySelector('.pfm-sub').textContent = pfEmployerRate === '12'
      ? 'Employer: 12% | EDLI: Rs.0'
      : 'Employer: 12.5% | EDLI: 0.5% (max Rs.75)';
  }
  const voluntaryWrapper = document.getElementById('pfVoluntaryWrapper');
  const specificWrapper  = document.getElementById('pfSpecificWrapper');
  if (voluntaryWrapper) voluntaryWrapper.classList.toggle('hidden', !pfAddVoluntary);
  if (specificWrapper)  specificWrapper.classList.toggle('hidden', pfBaseMode !== 'specific_amt');
}

function updatePFHint() {
  const hint = document.getElementById('pfHint');
  if (!hint) return;

  const gross   = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  const minWage = parseFloat(document.getElementById('minWage')?.value) || 0;
  const basicPct = pfApplicable === 'Y' ? 0.55 : 0.53;
  const basicFromGross = Math.round(gross * basicPct);
  const basic = Math.min(Math.max(basicFromGross, minWage), gross);
  const isPFMandatory = basic <= 15000;

  const mandatoryBadge = isPFMandatory ? ' 🔒 MANDATORY' : '';

  if (pfApplicable === 'N') {
    hint.textContent = '53% of Gross or Min Wage -> Basic. No PF deducted.' + mandatoryBadge;
    return;
  }
  const vpct    = parseFloat(document.getElementById('pfVoluntaryPct')?.value) || 0;
  const sAmt    = parseFloat(document.getElementById('pfSpecificAmtVal')?.value) || 0;
  const addText = pfAddVoluntary ? ' + Voluntary ' + vpct + '% (Employee Only)' : '';
  const empRateText = pfEmployerRate === '12'
    ? 'Employer: 12% of PF Wages | EDLI: Rs.0'
    : 'Employer: 12.5% of PF Wages | EDLI: 0.5% of Basic (max Rs.75)';
  switch (pfBaseMode) {
    case 'standard':
      hint.textContent = basicPct*100 + '% of Gross/MinWage -> Basic. PF Wages = min(Basic, Rs.15,000). Employee: 12% + Vol% of PF Wages. ' + empRateText + '.' + addText + mandatoryBadge;
      break;
    case 'full_basic':
      hint.textContent = basicPct*100 + '% of Gross/MinWage -> Basic. PF Wages = Full Basic. Employee: 12% + Vol% of Basic. ' + empRateText + '.' + addText + mandatoryBadge;
      break;
    case 'specific_amt':
      hint.textContent = basicPct*100 + '% of Gross/MinWage -> Basic. PF Wages = Rs.' + sAmt.toLocaleString('en-IN') + ' (fixed). Employee: 12% + Vol% of PF Wages. ' + empRateText + '.' + addText + mandatoryBadge;
      break;
  }
}

// ============== INITIALIZATION ==============
function onReady(callback) {
  if (document.readyState !== 'loading') callback();
  else document.addEventListener('DOMContentLoaded', callback);
}

onReady(function() {
  setupAuthListener();
  setupEventListeners();
  initializeCalculator();
  initBulkTab();
  injectPFModeUI();
  injectBulkSearchStyles();
});

// ============== INJECT BULK SEARCH STYLES ==============
function injectBulkSearchStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* ── BULK SEARCH BAR ── */
    .bulk-search-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 16px 0 10px 0;
      padding: 14px 16px;
      background: rgba(255,255,255,0.03);
      border: 1.5px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      transition: border-color 0.2s;
    }
    .bulk-search-bar:focus-within {
      border-color: rgba(99,179,237,0.45);
      background: rgba(99,179,237,0.04);
    }
    .bulk-search-icon {
      font-size: 16px;
      color: var(--text-muted);
      flex-shrink: 0;
      user-select: none;
    }
    .bulk-search-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text-main);
      font-size: 14px;
      font-family: inherit;
      padding: 0;
      caret-color: var(--accent);
    }
    .bulk-search-input::placeholder {
      color: var(--text-muted);
      font-size: 13px;
    }
    .bulk-search-clear {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      color: var(--text-dim);
      font-size: 12px;
      padding: 4px 10px;
      cursor: pointer;
      transition: all 0.15s;
      display: none;
      font-family: inherit;
    }
    .bulk-search-clear:hover {
      background: rgba(252,129,129,0.15);
      border-color: rgba(252,129,129,0.35);
      color: #fc8181;
    }
    .bulk-search-count {
      font-size: 12px;
      color: var(--text-muted);
      white-space: nowrap;
      flex-shrink: 0;
    }
    .bulk-search-count .match-count {
      color: var(--accent3);
      font-weight: 700;
    }
    .bulk-search-highlight {
      background: rgba(252,211,77,0.28);
      color: #f6e05e;
      border-radius: 2px;
      padding: 0 1px;
      font-weight: 700;
    }
    /* Hide non-matching rows */
    #bulkTableBody tr.bulk-hidden {
      display: none;
    }
    /* Highlight matching rows slightly */
    #bulkTableBody tr.bulk-match {
      background: rgba(99,179,237,0.04) !important;
    }
    /* No results message */
    .bulk-no-results {
      text-align: center;
      padding: 24px;
      color: var(--text-muted);
      font-size: 13px;
      display: none;
    }
    .bulk-no-results.visible {
      display: block;
    }
  `;
  document.head.appendChild(style);
}

// ============== INJECT PF MODE UI ==============
function injectPFModeUI() {
  let pfField = document.querySelector('.field-group:has(#pfYes)');
  if (!pfField) {
    document.querySelectorAll('.field-hint').forEach(function(h) {
      if (h.id === 'pfHint') pfField = h.closest('.field-group');
    });
  }
  if (!pfField) return;
  _insertPFModeAfter(pfField);
}

function _insertPFModeAfter(pfField) {
  if (document.getElementById('pfModeSection')) return;
  const pfModeHTML = `
  <div id="pfModeSection" class="pf-mode-section" style="margin-top:12px;">
    <label class="pf-mode-main-label">
      PF Contribution Mode
      <span class="formula-badge">Multi-Select + Voluntary (Emp Only) + Employer Rate Toggle</span>
    </label>
    <div class="pf-group-label">Base Mode <span style="font-size:10px;color:var(--text-muted)">(select one)</span></div>
    <div class="pf-mode-grid">
      <button class="pf-mode-btn active" id="pfBase_standard" onclick="setPFBaseMode('standard')" type="button">
        <span class="pfm-icon">🏛️</span>
        <span class="pfm-title">Standard</span>
        <span class="pfm-sub">PF Wages = min(Basic, Rs.15,000)</span>
      </button>
      <button class="pf-mode-btn" id="pfBase_full_basic" onclick="setPFBaseMode('full_basic')" type="button">
        <span class="pfm-icon">💯</span>
        <span class="pfm-title">Full Basic</span>
        <span class="pfm-sub">PF Wages = Full Basic<br>(No Rs.15k Cap)</span>
      </button>
      <button class="pf-mode-btn" id="pfBase_specific_amt" onclick="setPFBaseMode('specific_amt')" type="button">
        <span class="pfm-icon">₹</span>
        <span class="pfm-title">Specific Amount</span>
        <span class="pfm-sub">Fixed PF Wages<br>amount</span>
      </button>
    </div>
    <div class="pf-group-label" style="margin-top:10px;">Add-On <span style="font-size:10px;color:var(--text-muted)">(optional, applies to EMPLOYEE only)</span></div>
    <div class="pf-addon-grid">
      <button class="pf-addon-btn" id="pfAddon_voluntary" onclick="togglePFVoluntary()" type="button">
        <span class="pfm-icon">➕</span>
        <span class="pfm-title">+ Voluntary % (Employee)</span>
        <span class="pfm-sub">Extra % on PF Wages for Employee ONLY</span>
      </button>
    </div>
    <div class="pf-group-label" style="margin-top:10px;">Employer Settings <span style="font-size:10px;color:var(--text-muted)">(toggle rate)</span></div>
    <div class="pf-addon-grid">
      <button class="pf-addon-btn" id="pfEmployerRateToggle" onclick="togglePFEmployerRate()" type="button">
        <span class="pfm-icon">⚙️</span>
        <span class="pfm-title">Employer PF Rate</span>
        <span class="pfm-sub">Employer: 12.5% | EDLI: 0.5% (max Rs.75)</span>
      </button>
    </div>
    <div id="pfSpecificWrapper" class="hidden pf-extra-input" style="margin-top:10px;">
      <label class="pt-sub-label">PF Wages Amount (Fixed)</label>
      <div class="input-prefix">
        <span>₹</span>
        <input type="number" id="pfSpecificAmtVal" placeholder="e.g. 15000" min="0" step="1"
               oninput="updatePFHint(); liveCalc();" />
      </div>
      <div class="field-hint" style="margin-top:4px;">
        Fixed PF Wages used for calculation. Employee PF = 12% + Vol% of this amount. Employer PF = selected rate of this amount ONLY (no voluntary).
      </div>
    </div>
    <div id="pfVoluntaryWrapper" class="hidden pf-extra-input" style="margin-top:10px;">
      <label class="pt-sub-label">Voluntary Extra PF % (Employee Side Only)</label>
      <div class="input-prefix">
        <span>%</span>
        <input type="number" id="pfVoluntaryPct" placeholder="e.g. 5" min="0" max="88" step="0.5"
               oninput="updatePFHint(); liveCalc();" style="padding-left:36px;" />
      </div>
      <div class="field-hint" style="margin-top:4px;">
        Extra % added to Employee (12%) contribution on PF Wages ONLY. Employer remains at fixed rate.
      </div>
    </div>
    <div class="pf-live-preview" id="pfLivePreview" style="display:none; margin-top:10px;">
      <div class="pf-preview-row">
        <span class="pf-prev-label">Employee PF (12% + Vol%)</span>
        <span class="pf-prev-val danger" id="pfPreviewEmpVal">—</span>
      </div>
      <div class="pf-preview-row">
        <span class="pf-prev-label">Employer PF (<span id="pfPreviewEmrRate">12.5</span>%)</span>
        <span class="pf-prev-val accent" id="pfPreviewEmrVal">—</span>
      </div>
      <div class="pf-preview-row">
        <span class="pf-prev-label">EDLI</span>
        <span class="pf-prev-val" id="pfPreviewEdliVal" style="color:var(--text-dim);font-size:11px;">—</span>
      </div>
      <div class="pf-preview-row">
        <span class="pf-prev-label">PF Wages Used</span>
        <span class="pf-prev-val" id="pfPreviewBaseVal" style="color:var(--text-dim);font-size:11px;">—</span>
      </div>
      <div class="pf-preview-row">
        <span class="pf-prev-label">Mode</span>
        <span class="pf-prev-val" id="pfPreviewMode" style="color:var(--text-dim);font-size:11px;">—</span>
      </div>
    </div>
  </div>`;
  const style = document.createElement('style');
  style.textContent = `
    .pf-mode-section { border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; }
    .pf-mode-main-label { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:var(--text-main); margin-bottom:8px; }
    .pf-group-label { font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px; }
    .pf-mode-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
    .pf-addon-grid { display:grid; grid-template-columns:1fr; gap:8px; }
    .pf-mode-btn, .pf-addon-btn {
      display:flex; flex-direction:column; align-items:center; gap:3px;
      padding:10px 8px; border-radius:10px; border:1.5px solid rgba(255,255,255,0.08);
      background:rgba(255,255,255,0.03); cursor:pointer; transition:all 0.2s;
      text-align:center; color:var(--text-dim);
    }
    .pf-mode-btn:hover, .pf-addon-btn:hover { border-color:rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:var(--text-main); }
    .pf-mode-btn.active { border-color:var(--accent); background:rgba(99,179,237,0.1); color:var(--text-main); }
    .pf-addon-btn.active { border-color:var(--accent3); background:rgba(104,211,145,0.1); color:var(--text-main); }
    .pf-addon-btn { flex-direction:row; justify-content:center; padding:8px 14px; gap:8px; }
    .pfm-icon { font-size:18px; line-height:1; }
    .pfm-title { font-size:11px; font-weight:700; letter-spacing:0.02em; color:inherit; }
    .pfm-sub { font-size:9.5px; color:var(--text-muted); line-height:1.4; }
    .pf-mode-btn.active .pfm-sub, .pf-addon-btn.active .pfm-sub { color:var(--text-dim); }
    .pf-extra-input { background:rgba(255,255,255,0.03); border-radius:10px; padding:12px; border:1px solid rgba(255,255,255,0.07); }
    .pf-extra-input label { font-size:12px; color:var(--text-dim); font-weight:600; margin-bottom:6px; display:block; }
    .pf-live-preview { background:rgba(99,179,237,0.06); border:1px solid rgba(99,179,237,0.15); border-radius:10px; padding:10px 14px; }
    .pf-preview-row { display:flex; justify-content:space-between; align-items:center; padding:3px 0; }
    .pf-prev-label { font-size:12px; color:var(--text-dim); }
    .pf-prev-val { font-size:13px; font-weight:700; font-family:monospace; }
    .pf-prev-val.danger { color:var(--danger, #fc8181); }
    .pf-prev-val.accent { color:var(--accent, #63b3ed); }
    .min-wage-warning {
      margin-top: 8px; padding: 10px 14px;
      background: rgba(252,129,129,0.12);
      border: 1.5px solid rgba(252,129,129,0.45);
      border-radius: 10px; color: #fc8181;
      font-size: 13px; font-weight: 600; line-height: 1.5;
      animation: fadeInWarn 0.25s ease;
    }
    .min-wage-warning.hidden { display: none; }
    @keyframes fadeInWarn {
      from { opacity:0; transform:translateY(-4px); }
      to   { opacity:1; transform:translateY(0); }
    }
  `;
  document.head.appendChild(style);
  pfField.insertAdjacentHTML('afterend', pfModeHTML);
}

function updatePFPreview(basic) {
  const previewEl = document.getElementById('pfLivePreview');
  const empValEl  = document.getElementById('pfPreviewEmpVal');
  const emrValEl  = document.getElementById('pfPreviewEmrVal');
  const emrRateEl = document.getElementById('pfPreviewEmrRate');
  const edliValEl = document.getElementById('pfPreviewEdliVal');
  const baseValEl = document.getElementById('pfPreviewBaseVal');
  const modeEl    = document.getElementById('pfPreviewMode');
  if (!previewEl) return;
  if (pfApplicable !== 'Y' || basic <= 0) { previewEl.style.display = 'none'; return; }
  previewEl.style.display = 'block';
  const pfWages = getPFBaseWagesFromGlobals(basic);
  const empPF   = computeEmployeePFFromGlobals(basic);
  const emrPF   = computeEmployerPFFromGlobals(basic);
  const edli    = computeEDLIFromGlobals(basic);
  if (empValEl)  empValEl.textContent  = 'Rs.' + Math.round(empPF).toLocaleString('en-IN');
  if (emrValEl)  emrValEl.textContent  = 'Rs.' + Math.round(emrPF).toLocaleString('en-IN');
  if (emrRateEl) emrRateEl.textContent = pfEmployerRate;
  if (edliValEl) edliValEl.textContent = edli > 0 ? 'Rs.' + edli : 'Rs.0 (N/A)';
  if (baseValEl) baseValEl.textContent = 'Rs.' + Math.round(pfWages).toLocaleString('en-IN');
  if (modeEl)    modeEl.textContent    = getPFModeLabel();
}

function getPFBaseWagesFromGlobals(basic) {
  if (pfApplicable !== 'Y') return 0;
  switch (pfBaseMode) {
    case 'standard':    return Math.min(basic, 15000);
    case 'full_basic':  return basic;
    case 'specific_amt': return Math.max(0, parseFloat(document.getElementById('pfSpecificAmtVal')?.value) || 0);
    default: return Math.min(basic, 15000);
  }
}
function computeEmployeePFFromGlobals(basic) {
  if (pfApplicable !== 'Y') return 0;
  const pfWages = getPFBaseWagesFromGlobals(basic);
  const vpct = pfAddVoluntary ? (parseFloat(document.getElementById('pfVoluntaryPct')?.value) || 0) : 0;
  return Math.round(pfWages * 0.12) + (pfAddVoluntary ? Math.round(pfWages * vpct / 100) : 0);
}
function computeEmployerPFFromGlobals(basic) {
  if (pfApplicable !== 'Y') return 0;
  return Math.round(getPFBaseWagesFromGlobals(basic) * parseFloat(pfEmployerRate) / 100);
}
function computeEDLIFromGlobals(basic) {
  if (pfApplicable !== 'Y') return 0;
  if (pfEmployerRate === '12') return 0;
  return Math.min(Math.round(basic * 0.005), 75);
}

function getPFModeLabel() {
  if (pfApplicable !== 'Y') return 'No PF';
  const vpct    = parseFloat(document.getElementById('pfVoluntaryPct')?.value) || 0;
  const sAmt    = parseFloat(document.getElementById('pfSpecificAmtVal')?.value) || 0;
  const volSuffix  = pfAddVoluntary ? ' + Voluntary ' + vpct + '% (Emp Only)' : '';
  const rateSuffix = pfEmployerRate === '12' ? ' | Empl@12% | EDLI=0' : '';
  switch (pfBaseMode) {
    case 'standard':     return 'Standard (PF Wages=min(Basic,Rs.15k))' + volSuffix + rateSuffix;
    case 'full_basic':   return 'Full Basic (PF Wages=Basic)' + volSuffix + rateSuffix;
    case 'specific_amt': return 'Specific PF Wages Rs.' + Math.round(sAmt).toLocaleString('en-IN') + volSuffix + rateSuffix;
    default:             return 'Standard';
  }
}

// ============== AUTH LISTENER ==============
function setupAuthListener() {
  auth.onAuthStateChanged(async function(user) {
    if (user) {
      try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
          currentUser   = userDoc.data();
          currentUserId = user.uid;
          isAdmin       = currentUser.role === 'admin';
          updateUserInfo();
          showMainApp();
          updateLastLogin();
          if (isAdmin) {
            document.getElementById('adminPanelBtn').style.display = 'flex';
            loadUsersTable();
            updateAdminInfo();
          }
          showToast('✓ Welcome, ' + currentUser.name.split(' ')[0] + '!');
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
      currentUser   = null;
      isAdmin       = false;
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
  if (showAdminRegisterLink) showAdminRegisterLink.addEventListener('click', function(e) { e.preventDefault(); showAdminRegister(); });
  const backToLoginLink = document.getElementById('backToLogin');
  if (backToLoginLink) backToLoginLink.addEventListener('click', function(e) { e.preventDefault(); showLoginPage(); });
  const adminPanelBtn = document.getElementById('adminPanelBtn');
  if (adminPanelBtn) adminPanelBtn.addEventListener('click', function() {
    if (isAdmin) { switchTab('admin'); loadUsersTable(); updateAdminInfo(); }
  });
  document.querySelectorAll('.nav-item[data-tab]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const tab = btn.dataset.tab;
      if (tab !== 'admin' || isAdmin) switchTab(tab);
    });
  });
  const grossInput = document.getElementById('grossSalary');
  const minWageInput = document.getElementById('minWage');
  if (grossInput) grossInput.addEventListener('input', function() {
    if (lwfMode === 'auto') updateLWFAuto();
    if (ptMode  === 'auto') updatePTAuto();
    setPFApplicable(pfApplicable);
  });
  if (minWageInput) minWageInput.addEventListener('input', function() {
    setPFApplicable(pfApplicable);
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
  const email    = (document.getElementById('loginEmail')?.value || '').trim().toLowerCase();
  const password = document.getElementById('loginPassword')?.value || '';
  const errorEl  = document.getElementById('loginError');
  if (errorEl) errorEl.classList.add('hidden');
  if (!email || !password) { showError(errorEl, 'Please enter email and password'); return; }
  try { await auth.signInWithEmailAndPassword(email, password); }
  catch (error) {
    let msg = 'Login failed';
    if (error.code === 'auth/user-not-found')        msg = 'No account with this email';
    else if (error.code === 'auth/wrong-password')   msg = 'Incorrect password';
    else if (error.code === 'auth/invalid-email')    msg = 'Invalid email format';
    else if (error.code === 'auth/too-many-requests') msg = 'Too many attempts. Try later.';
    showError(errorEl, msg);
  }
}

async function handleAdminRegister(e) {
  e.preventDefault();
  const name            = (document.getElementById('adminName')?.value || '').trim();
  const companyName     = (document.getElementById('adminCompanyName')?.value || '').trim();
  const email           = (document.getElementById('adminEmail')?.value || '').trim().toLowerCase();
  const password        = document.getElementById('adminPassword')?.value || '';
  const confirmPassword = document.getElementById('confirmPassword')?.value || '';
  const errorEl   = document.getElementById('adminError');
  const successEl = document.getElementById('adminSuccess');
  if (errorEl)   errorEl.classList.add('hidden');
  if (successEl) successEl.classList.add('hidden');
  if (!name || !companyName || !email || !password) { showError(errorEl, 'All fields are required'); return; }
  if (password.length < 8)   { showError(errorEl, 'Password must be at least 8 characters'); return; }
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
    setTimeout(function() { showLoginPage(); showToast('✓ Admin registered! Please login now.'); }, 2000);
  } catch (error) {
    let msg = 'Registration failed';
    if (error.code === 'auth/email-already-in-use') msg = 'Email already registered';
    else if (error.code === 'auth/weak-password')   msg = 'Password too weak (min 6 chars)';
    else if (error.code === 'auth/invalid-email')   msg = 'Invalid email format';
    else msg = 'Error: ' + (error.message || error.code);
    showError(errorEl, msg);
    showToast('⚠️ ' + msg);
  }
}

async function handleCreateUser(e) {
  e.preventDefault();
  if (!isAdmin) { showToast('⚠️ Admin access required'); return; }
  const name            = (document.getElementById('newUserName')?.value || '').trim();
  const email           = (document.getElementById('newUserEmail')?.value || '').trim().toLowerCase();
  const password        = document.getElementById('newUserPassword')?.value || '';
  const confirmPassword = document.getElementById('confirmNewPassword')?.value || '';
  const msgEl = document.getElementById('createUserMsg');
  if (msgEl) msgEl.classList.add('hidden');
  if (!name || !email || !password) { showError(msgEl, 'All fields are required', true); return; }
  if (password.length < 8)          { showError(msgEl, 'Password must be at least 8 characters', true); return; }
  if (password !== confirmPassword)  { showError(msgEl, 'Passwords do not match', true); return; }
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;
    await db.collection('users').doc(uid).set({
      uid, name, email, role: 'user', createdBy: currentUserId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(), lastLogin: null
    });
    showSuccess(msgEl, '✓ User "' + name + '" created! Share credentials with them.');
    document.getElementById('createUserForm')?.reset();
    loadUsersTable();
  } catch (error) {
    let msg = 'Failed to create user';
    if (error.code === 'auth/email-already-in-use') msg = 'Email already registered';
    showError(msgEl, msg, true);
  }
}

function logout() {
  auth.signOut()
    .then(function() { showToast('↪️ Logged out successfully'); })
    .catch(function() { showToast('⚠️ Logout failed'); });
}

async function updateLastLogin() {
  if (!currentUserId) return;
  try {
    await db.collection('users').doc(currentUserId).update({ lastLogin: firebase.firestore.FieldValue.serverTimestamp() });
  } catch (e) { console.warn('Could not update last login:', e); }
}

// ============== ADMIN PANEL ==============
function updateAdminInfo() {
  if (!isAdmin || !currentUser) return;
  const adminInfoEl = document.getElementById('currentAdminInfo');
  if (adminInfoEl) adminInfoEl.textContent = currentUser.name + ' • ' + (currentUser.companyName || 'N/A');
}

async function loadUsersTable() {
  if (!isAdmin) return;
  const tbody      = document.getElementById('usersTableBody');
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
    let html = ''; let count = 0;
    snapshot.forEach(function(doc) {
      const user = doc.data(); count++;
      const date = user.createdAt?.toDate()?.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) || 'N/A';
      html += '<tr><td><strong>' + escapeHtml(user.name) + '</strong></td><td>' + escapeHtml(user.email) + '</td><td>' + date + '</td><td><button class="btn-sm btn-delete" onclick="deleteUser(\'' + user.uid + '\')">🗑️ Delete</button></td></tr>';
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
    const batch    = db.batch();
    snapshot.forEach(function(doc) { batch.delete(doc.ref); });
    await batch.commit();
    showToast('✓ All user data cleared');
    loadUsersTable();
  } catch (error) { showToast('⚠️ Failed to clear data'); }
}

// ============== UTILITY ==============
function showError(element, message, isAdminForm) {
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
  setTimeout(function() { t.classList.remove('show'); }, 3000);
}
function updateUserInfo() {
  if (!currentUser) return;
  const nameEl   = document.getElementById('userName');
  const emailEl  = document.getElementById('userEmail');
  const avatarEl = document.getElementById('userAvatar');
  if (nameEl)   nameEl.textContent   = currentUser.name;
  if (emailEl)  emailEl.textContent  = currentUser.email;
  if (avatarEl && currentUser.name) avatarEl.textContent = currentUser.name.charAt(0).toUpperCase();
}

// ============== CALCULATOR INIT ==============
function initializeCalculator() {
  setPFApplicable('Y');
  pfBaseMode     = 'standard';
  pfAddVoluntary = false;
  pfEmployerRate = '12.5';
  _syncPFUI();
  setGratuityMode('auto');
  setLeaveMode('auto');
  setLWFMode('auto');
  setPTMode('auto');
  const currentMonth = new Date().getMonth() + 1;
  const monthEl      = document.getElementById('lwfMonth');
  const ptMonthEl    = document.getElementById('ptMonth');
  if (monthEl)   monthEl.value   = currentMonth;
  if (ptMonthEl) ptMonthEl.value = currentMonth;
}

// ============== CORE CTC ENGINE ==============
function computeCTC(gross, minWage, pf, pt, lwf, gratuityOverride, leaveOverride,
                    pfBaseModeOverride, pfVoluntaryOverride, pfVolPctOverride,
                    pfSpecAmtOverride, pfEmpRateOverride, leavesPerYear, previousBasic) {

  gross = Math.round(gross);
  minWage = Math.round(minWage);
  
  previousBasic = (previousBasic !== undefined && previousBasic !== null && !isNaN(previousBasic)) 
    ? Math.round(previousBasic) : null;

  const effectiveLeaves = (leavesPerYear !== undefined && leavesPerYear !== null && !isNaN(leavesPerYear))
    ? leavesPerYear
    : (typeof leaveMode !== 'undefined' && leaveMode === 'manual' 
        ? (parseInt(document.getElementById('leaveCountInput')?.value) || 15) 
        : 15);

  const basicPct       = pf === 'Y' ? 0.55 : 0.53;
  const basicFromGross = Math.round(gross * basicPct);
  
  let basic = basicFromGross;
  if (previousBasic !== null && previousBasic > 0) {
    basic = Math.max(basic, previousBasic);
  }
  basic = Math.max(basic, minWage);
  basic = Math.min(basic, gross);

  if (basic <= 15000 && pf !== 'Y') pf = 'Y';

  let hra = Math.round(basic * 0.5);
  if (basic + hra > gross) hra = Math.max(gross - basic, 0);

  let deferAllowance = 0;
  let conv           = 0;
  if (gross > 100000) {
    deferAllowance  = Math.round(gross * 0.10);
    const usedSoFar = basic + hra + deferAllowance;
    if (usedSoFar > gross) {
      deferAllowance = Math.max(gross - basic - hra, 0);
      conv           = 0;
    } else {
      conv = Math.max(gross - basic - hra - deferAllowance, 0);
    }
  } else {
    conv = Math.max(gross - basic - hra, 0);
  }

  const resolvedBase    = pfBaseModeOverride  ?? (typeof pfBaseMode !== 'undefined' ? pfBaseMode : 'standard');
  const resolvedHasVol  = pfVoluntaryOverride ?? (typeof pfAddVoluntary !== 'undefined' ? pfAddVoluntary : false);
  const resolvedVolPct  = pfVolPctOverride    ?? (parseFloat(document.getElementById('pfVoluntaryPct')?.value) || 0);
  const resolvedSpecAmt = pfSpecAmtOverride   ?? (parseFloat(document.getElementById('pfSpecificAmtVal')?.value) || 0);
  const resolvedEmpRate = pfEmpRateOverride   ?? (typeof pfEmployerRate !== 'undefined' ? pfEmployerRate : '12');

  let pfWages = 0;
  if (pf === 'Y') {
    switch (resolvedBase) {
      case 'standard':     pfWages = Math.min(basic, 15000); break;
      case 'full_basic':   pfWages = basic; break;
      case 'specific_amt': pfWages = Math.max(0, resolvedSpecAmt); break;
      default:             pfWages = Math.min(basic, 15000);
    }
  }

  let epfEmployee = 0;
  if (pf === 'Y') {
    const basePF         = Math.round(pfWages * 0.12);
    const voluntaryExtra = resolvedHasVol ? Math.round(pfWages * resolvedVolPct / 100) : 0;
    epfEmployee          = basePF + voluntaryExtra;
  }

  let epfEmployer = 0;
  if (pf === 'Y') {
    const rate  = parseFloat(resolvedEmpRate) / 100;
    epfEmployer = Math.round(pfWages * rate);
  }

  const edliEmployer = (pf === 'Y' && resolvedEmpRate === '12') ? 0
    : (pf === 'Y' ? Math.min(Math.round(basic * 0.005), 75) : 0);

  const bonus = basic <= 21000 ? Math.round(minWage * 0.0833) : 0;

  const initialCTC = gross + epfEmployer + edliEmployer + bonus;

  const esiEmployer = basic <= 21000 ? Math.round(basic * 0.0325) : 0;
  const esiEmployee = basic <= 21000 ? Math.round(basic * 0.0075) : 0;

  const gratuityAuto = Math.round((basic / 26) * 15 / 12);
  const gratuity     = (gratuityOverride !== null && gratuityOverride !== undefined && !isNaN(gratuityOverride) && gratuityOverride >= 0)
    ? Math.round(gratuityOverride) : gratuityAuto;

  const leaveAuto      = Math.round((basic / 26) * (effectiveLeaves / 12));
  const leaveComponent = (leaveOverride !== null && leaveOverride !== undefined && !isNaN(leaveOverride) && leaveOverride >= 0)
    ? Math.round(leaveOverride) : leaveAuto;

  const finalCTC   = initialCTC + esiEmployer + gratuity + lwf + leaveComponent;
  const cashInHand = gross - epfEmployee - esiEmployee - lwf - pt;

  const pfModeLabel = (function() {
    if (pf !== 'Y') return 'No PF';
    const volSuffix  = resolvedHasVol ? ' + Voluntary ' + resolvedVolPct + '% (Emp Only)' : '';
    const rateSuffix = resolvedEmpRate === '12' ? ' | Empl@12% | EDLI=0' : '';
    switch (resolvedBase) {
      case 'standard':     return 'Standard (PF Wages=min(Basic,Rs.15k))' + volSuffix + rateSuffix;
      case 'full_basic':   return 'Full Basic (PF Wages=Basic)' + volSuffix + rateSuffix;
      case 'specific_amt': return 'Specific PF Wages Rs.' + Math.round(resolvedSpecAmt).toLocaleString('en-IN') + volSuffix + rateSuffix;
      default:             return 'Standard';
    }
  })();

  return {
    gross, basic, hra, conv,
    convLabel      : 'Conveyance',
    deferAllowance,
    isHighGross    : gross > 100000,
    minWage,
    previousBasic,
    pfApplicable   : pf,
    pfWages,
    pfEmployerRate : resolvedEmpRate,
    epfEmployer, edliEmployer, bonus, initialCTC,
    esiEmployer, esiEmployee,
    gratuity, gratuityAuto,
    leaveComponent, leaveAuto,
    leavesPerYear  : effectiveLeaves,
    lwf, pt,
    finalCTC,
    finalCTCAnnual : finalCTC * 12,
    epfEmployee,
    lwfEmployee    : lwf,
    ptDeduction    : pt,
    cashInHand,
    pfModeLabel,
    pfBaseUsed     : resolvedBase,
    pfHasVoluntary : resolvedHasVol,
    pfVolPct       : resolvedVolPct,
    pfSpecAmt      : resolvedSpecAmt,
    gratuityMode   : (gratuityOverride !== null && gratuityOverride !== undefined && !isNaN(gratuityOverride) && gratuityOverride >= 0) ? 'manual' : 'auto',
    leaveMode      : (leaveOverride !== null && leaveOverride !== undefined && !isNaN(leaveOverride) && leaveOverride >= 0) ? 'manual' : 'auto',
  };
}

// ============== INDIVIDUAL CALC HELPERS ==============
function setGratuityMode(mode) {
  gratuityMode = mode;
  const autoBtn     = document.getElementById('gratuityAuto');
  const manualBtn   = document.getElementById('gratuityManual');
  const manualInput = document.getElementById('gratuityManualWrapper');
  const hint        = document.getElementById('gratuityHint');
  if (autoBtn)     autoBtn.classList.toggle('active', mode === 'auto');
  if (manualBtn)   manualBtn.classList.toggle('active', mode === 'manual');
  if (manualInput) manualInput.classList.toggle('hidden', mode !== 'manual');
  if (hint) hint.textContent = mode === 'manual'
    ? 'Enter custom monthly gratuity amount'
    : 'Formula: Basic / 26 x 15 / 12 (monthly provision)';
  liveCalc();
}

function setLeaveMode(mode) {
  leaveMode = mode;
  const autoBtn     = document.getElementById('leaveAuto');
  const manualBtn   = document.getElementById('leaveManual');
  const manualInput = document.getElementById('leaveManualWrapper');
  const hint        = document.getElementById('leaveHint');
  const badge       = document.getElementById('leaveFormulaBadge');

  if (autoBtn)     autoBtn.classList.toggle('active', mode === 'auto');
  if (manualBtn)   manualBtn.classList.toggle('active', mode === 'manual');
  if (manualInput) manualInput.classList.toggle('hidden', mode !== 'manual');

  if (hint) {
    hint.textContent = mode === 'manual'
      ? 'Formula: Basic ÷ 26 × (Your Leaves) ÷ 12 = Monthly Provision'
      : 'Formula: Basic ÷ 26 × 15 ÷ 12 (15 leaves/year default)';
  }
  if (badge) {
    badge.textContent = mode === 'manual'
      ? 'Basic ÷ 26 × Leaves ÷ 12'
      : 'Basic ÷ 26 × 15 ÷ 12';
  }

  if (mode === 'manual') updateLeaveCalc();
  liveCalc();
}

function updateLeaveCalc() {
  const gross   = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  const minWage = parseFloat(document.getElementById('minWage')?.value) || 0;
  const leaveInput    = document.getElementById('leaveCountInput');
  const previewBasic  = document.getElementById('leavePreviewBasic');
  const previewLeaves = document.getElementById('leavePreviewLeaves');
  const previewAmount = document.getElementById('leavePreviewAmount');

  if (!leaveInput) return;

  let leaves = parseInt(leaveInput.value) || 15;
  if (leaves < 0) leaves = 0;
  if (leaves > 30) leaves = 30;
  leaveCountManual = leaves;
  leaveInput.value = leaves;

  const basicPct       = pfApplicable === 'Y' ? 0.55 : 0.53;
  const basicFromGross = Math.round(gross * basicPct);
  const basic          = Math.min(Math.max(basicFromGross, minWage), gross);
  const leaveAmount    = basic > 0 ? Math.round((basic / 26) * (leaves / 12)) : 0;

  if (previewBasic)  previewBasic.textContent  = basic > 0 ? Math.round(basic).toLocaleString('en-IN') : '—';
  if (previewLeaves) previewLeaves.textContent  = leaves;
  if (previewAmount) previewAmount.textContent  = leaveAmount > 0 ? leaveAmount.toLocaleString('en-IN') : '0';

  liveCalc();
}

function updateGratuityPlaceholder() {
  const gross   = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  const minWage = parseFloat(document.getElementById('minWage')?.value) || 0;
  const input   = document.getElementById('gratuityCustom');
  if (!input) return;
  if (gross > 0 && minWage > 0) {
    const basicPct = pfApplicable === 'Y' ? 0.55 : 0.53;
    const basic    = Math.min(Math.max(Math.round(gross * basicPct), minWage), gross);
    const autoVal  = Math.round((basic / 26) * 15 / 12);
    input.placeholder = 'Auto = Rs.' + autoVal.toLocaleString('en-IN');
  } else { input.placeholder = 'e.g. 500'; }
}

function updateLeavePlaceholder() {
  const gross   = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  const minWage = parseFloat(document.getElementById('minWage')?.value) || 0;
  const input   = document.getElementById('leaveCustom');
  const leaveCountInput = document.getElementById('leaveCountInput');
  if (!input) return;
  if (gross > 0 && minWage > 0) {
    const basicPct = pfApplicable === 'Y' ? 0.55 : 0.53;
    const basic    = Math.min(Math.max(Math.round(gross * basicPct), minWage), gross);
    const leaves   = (leaveMode === 'manual' && leaveCountInput) ? (parseInt(leaveCountInput.value) || 15) : 15;
    const autoVal  = Math.round((basic / 26) * (leaves / 12));
    input.placeholder = 'Auto = Rs.' + autoVal.toLocaleString('en-IN') + ' (' + leaves + ' leaves)';
  } else { input.placeholder = 'e.g. 500'; }
}

function liveCalc() {
  updateGratuityPlaceholder();
  updateLeavePlaceholder();
  updatePFHint();
  const gross     = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  const minWage   = parseFloat(document.getElementById('minWage')?.value) || 0;
  const warnEl    = document.getElementById('minWageWarning');
  const warnAmtEl = document.getElementById('minWageWarningAmt');

  if (gross > 0 && minWage > 0 && gross < minWage) {
    if (warnEl)    warnEl.classList.remove('hidden');
    if (warnAmtEl) warnAmtEl.textContent = minWage.toLocaleString('en-IN');
    setText('r_initialCTC', '—');
    safeToggle('summaryEmpty', false);
    safeToggle('summaryResults', true);
    safeToggle('breakdownEmpty', false);
    safeToggle('breakdownContent', true);
    const exportPreview = document.getElementById('exportPreview');
    if (exportPreview) exportPreview.innerHTML = '<div class="preview-empty">Gross salary minimum wages se kam hai</div>';
    calcResult = null;
    return;
  } else {
    if (warnEl) warnEl.classList.add('hidden');
  }

  if (gross > 0 && minWage > 0) calculate(true);
}

function calculate(silent) {
  const gross   = parseFloat(document.getElementById('grossSalary')?.value) || 0;
  const minWage = parseFloat(document.getElementById('minWage')?.value) || 0;
  const prevBasic = parseFloat(document.getElementById('previousBasic')?.value) || null;
  const pt      = getPTValue();
  const lwf     = getLWFValue();
  
  if (gross <= 0 || minWage <= 0) {
    if (!silent) showToast('⚠️ Please enter Gross Salary and Minimum Wage');
    return;
  }
  if (gross < minWage) {
    if (!silent) showToast('⚠️ Gross Salary minimum wages (Rs.' + minWage.toLocaleString('en-IN') + ') se kam hai!');
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

  const leavesPerYear = leaveMode === 'manual'
    ? (parseInt(document.getElementById('leaveCountInput')?.value) || 15)
    : 15;

  const r = computeCTC(
    gross, minWage, pfApplicable, pt, lwf,
    gratuityOverride, leaveOverride,
    undefined, undefined, undefined, undefined, undefined,
    leavesPerYear, prevBasic
  );

  updatePFPreview(r.basic);

  r.lwfMode      = lwfMode;
  r.lwfLabel     = getLWFLabel();
  r.lwfStateName = (function() {
    if (lwfMode === 'manual') return 'Manual';
    const stateEl = document.getElementById('lwfState');
    if (!stateEl || !stateEl.value) return 'Not Selected';
    return LWF_STATES[stateEl.value]?.name || stateEl.value;
  })();
  
  r.ptMode      = ptMode;
  r.ptLabel     = getPTLabel();
  r.ptStateName = (function() {
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

function fmt(n) { return 'Rs.' + Math.round(n).toLocaleString('en-IN'); }
function pct(part, total) { if (!total) return '0%'; return (part / total * 100).toFixed(1) + '%'; }

function renderSummary(r) {
  safeToggle('summaryEmpty', true);
  safeToggle('summaryResults', false);
  setText('r_initialCTC', fmt(r.initialCTC));
  setText('annualCTC',    fmt(r.finalCTCAnnual));
  setText('monthlyCTC',   fmt(r.finalCTC));
  setText('r_basic',      fmt(r.basic));
  setText('r_hra',        fmt(r.hra));
  setText('r_conv',       fmt(r.conv));
  setText('r_gross',      fmt(r.gross));
  setText('r_cash',       fmt(r.cashInHand));
  setText('r_bonus',      r.bonus > 0 ? fmt(r.bonus) : 'N/A');
}
function setText(elementId, text) { const el = document.getElementById(elementId); if (el) el.textContent = text; }

function renderBreakdown(r) {
  safeToggle('breakdownEmpty', true);
  safeToggle('breakdownContent', false);

  const salRows = r.isHighGross
    ? [['Basic', r.basic], ['HRA (50% of Basic)', r.hra], ['Defray Expenses (10%)', r.deferAllowance], [r.convLabel + ' (Residual)', r.conv]]
    : [['Basic', r.basic], ['HRA (50% of Basic)', r.hra], [r.convLabel, r.conv]];

  let salHtml = '';
  salRows.forEach(function(item) {
    salHtml += '<tr><td>' + item[0] + '</td><td>' + fmt(item[1]) + '</td><td>' + pct(item[1], r.gross) + '</td></tr>';
  });
  setTextContent('salaryTable', salHtml);
  setText('tfoot_gross', fmt(r.gross));

  const pfModeBadge = r.pfApplicable === 'Y'
    ? '<span style="font-size:9px;color:var(--accent3);font-weight:600;background:rgba(104,211,145,0.1);padding:2px 6px;border-radius:4px;margin-left:4px;">' + r.pfModeLabel + '</span>'
    : '';
  const edliNote = r.pfEmployerRate === '12' ? ' (Rs.0 - Employer@12%)' : ' (0.5% of Basic, max Rs.75)';

  const empRows = [
    ['EPF – Employer @ ' + r.pfEmployerRate + '% of PF Wages ' + pfModeBadge, r.pfEmployerRate + '%', r.epfEmployer],
    ['EDLI – Employer' + edliNote, r.pfEmployerRate === '12' ? 'N/A' : '0.5%', r.edliEmployer],
    ['Bonus (8.33% of Min Wage, if Basic ≤ Rs.21,000)', '8.33%', r.bonus],
  ];
  let empHtml = '';
  empRows.forEach(function(item) {
    empHtml += '<tr><td>' + item[0] + '</td><td style="color:var(--text-dim)">' + item[1] + '</td><td>' + (item[2] > 0 ? fmt(item[2]) : '<span style="color:var(--text-muted)">—</span>') + '</td></tr>';
  });
  setTextContent('employerTable', empHtml);
  setText('tfoot_initialCTC', fmt(r.initialCTC));

  const dedRows = [
    ['EPF – Employee @ 12% + Vol% of PF Wages ' + pfModeBadge, r.pfModeLabel, r.epfEmployee, r.pfApplicable === 'Y'],
    ['ESI – Employee @ 0.75% (Gross ≤ Rs.21,000)', '0.75%', r.esiEmployee, r.gross <= 21000],
    ['PT – ' + (r.ptStateName||'N/A') + ' (' + (r.ptMode === 'manual' ? 'Manual' : 'Auto') + ')', 'State', r.ptDeduction, r.ptDeduction > 0],
    ['LWF – ' + (r.lwfStateName||'N/A') + ' (' + (r.lwfMode === 'manual' ? 'Manual' : 'Auto') + ')', 'State', r.lwfEmployee, r.lwfEmployee > 0],
  ];
  let dedHtml = '';
  dedRows.forEach(function(item) {
    const dispVal = item[3] && item[2] > 0
      ? '<span style="color:var(--danger)">' + fmt(item[2]) + '</span>'
      : '<span style="color:var(--text-muted)">—</span>';
    dedHtml += '<tr><td>' + item[0] + '</td><td style="color:var(--text-dim);font-size:11px">' + item[1] + '</td><td>' + dispVal + '</td></tr>';
  });
  setTextContent('deductionTable', dedHtml);
  setText('tfoot_cash', fmt(r.cashInHand));

  const empName       = (document.getElementById('empName')?.value || '').trim() || 'Employee';
  const gratuityLabel = r.gratuityMode === 'manual'
    ? 'Gratuity <span style="font-size:9px;color:var(--accent2);font-weight:600;background:rgba(159,122,234,0.15);padding:2px 6px;border-radius:4px;margin-left:4px;">CUSTOM</span>'
    : 'Gratuity <span style="font-size:9px;color:var(--text-muted);font-weight:600;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;margin-left:4px;">AUTO</span>';

  const userLeavesDisplay = r.leavesPerYear || 15;
  const leaveLabel = r.leaveMode === 'manual'
    ? 'Leave Component <span style="font-size:9px;color:var(--accent2);font-weight:600;background:rgba(159,122,234,0.15);padding:2px 6px;border-radius:4px;margin-left:4px;">' + userLeavesDisplay + ' LEAVES</span>'
    : 'Leave Component <span style="font-size:9px;color:var(--text-muted);font-weight:600;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;margin-left:4px;">' + userLeavesDisplay + ' LEAVES (Auto)</span>';

  const lwfLabel = r.lwfMode === 'manual'
    ? 'LWF – Employee <span style="font-size:9px;color:var(--accent2);font-weight:600;background:rgba(159,122,234,0.15);padding:2px 6px;border-radius:4px;margin-left:4px;">MANUAL</span>'
    : 'LWF – ' + (r.lwfStateName||'N/A') + ' <span style="font-size:9px;color:var(--accent3);font-weight:600;background:rgba(104,211,145,0.1);padding:2px 6px;border-radius:4px;margin-left:4px;">AUTO</span>';
  const ptLabel = r.ptMode === 'manual'
    ? 'PT – Employee <span style="font-size:9px;color:var(--accent2);font-weight:600;background:rgba(159,122,234,0.15);padding:2px 6px;border-radius:4px;margin-left:4px;">MANUAL</span>'
    : 'PT – ' + (r.ptStateName||'N/A') + ' <span style="font-size:9px;color:var(--accent3);font-weight:600;background:rgba(104,211,145,0.1);padding:2px 6px;border-radius:4px;margin-left:4px;">AUTO</span>';
  const pfModeDisplayLabel = r.pfApplicable === 'Y'
    ? 'PF Mode: <span style="font-size:9px;color:var(--accent3);font-weight:600;background:rgba(104,211,145,0.1);padding:2px 6px;border-radius:4px;">' + r.pfModeLabel + '</span>'
    : 'PF: <span style="font-size:9px;color:var(--text-muted);font-weight:600;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;">Not Applicable</span>';
  const edliDisplay = r.edliEmployer > 0 ? fmt(r.edliEmployer) : 'Rs.0 (N/A)';

  const finalItemsData = [
    { label: 'Gross Salary',        val: fmt(r.gross),         sub: 'Monthly',                        cls: '' },
    { label: 'Initial CTC',         val: fmt(r.initialCTC),    sub: 'Gross + Employer Contributions', cls: '' },
    { label: 'ESI – Employer',      val: r.esiEmployer > 0 ? fmt(r.esiEmployer) : 'N/A', sub: '3.25% of Gross (if ≤ Rs.21k)', cls: '' },
    { label: gratuityLabel,         val: fmt(r.gratuity),      sub: r.gratuityMode === 'manual' ? 'Manual (Auto: ' + fmt(r.gratuityAuto) + ')' : 'Basic/26 x 15 / 12', cls: '' },
    { label: leaveLabel,            val: fmt(r.leaveComponent), sub: r.leaveMode === 'manual' ? 'Manual (Auto: ' + fmt(r.leaveAuto) + ')' : 'Basic/26 x ' + userLeavesDisplay + 'Lvs / 12', cls: '' },
    { label: lwfLabel,              val: r.lwf > 0 ? fmt(r.lwf) : 'Rs.0 (N/A)', sub: r.lwfMode === 'auto' ? (r.lwfStateName||'N/A') + ' – State-wise auto' : 'Manual override', cls: '' },
    { label: ptLabel,               val: r.ptDeduction > 0 ? fmt(r.ptDeduction) : 'Rs.0 (N/A)', sub: r.ptMode === 'auto' ? (r.ptStateName||'N/A') + ' – State-wise auto' : 'Manual override', cls: '' },
    { label: 'Final CTC (Monthly)', val: fmt(r.finalCTC),      sub: empName, cls: 'highlight' },
    { label: 'Final CTC (Annual)',  val: fmt(r.finalCTCAnnual), sub: empName, cls: 'highlight' },
    { label: 'Cash in Hand',        val: fmt(r.cashInHand),    sub: 'After all deductions', cls: 'green' },
    { label: pfModeDisplayLabel,    val: r.pfApplicable === 'Y' ? fmt(r.epfEmployee) : 'Rs.0',
      sub: r.pfApplicable === 'Y' ? 'Employee: 12%+Vol% | Employer: ' + r.pfEmployerRate + '% | EDLI: ' + edliDisplay + ' | PF Wages: Rs.' + Math.round(r.pfWages).toLocaleString('en-IN') : 'No PF applicable', cls: 'purple' },
  ];

  if (r.isHighGross) {
    finalItemsData.splice(1, 0, {
      label: 'Defray Expenses (10%)',
      val: fmt(r.deferAllowance),
      sub: 'Gross > Rs.1,00,000 | Conveyance (Residual): ' + fmt(r.conv),
      cls: 'purple'
    });
  }

  let fiHtml = '';
  finalItemsData.forEach(function(item) {
    fiHtml += '<div class="final-item ' + item.cls + '"><div class="fi-label">' + item.label + '</div><div class="fi-val">' + item.val + '</div><div class="fi-sub">' + item.sub + '</div></div>';
  });
  setTextContent('finalItems', fiHtml);
}
function setTextContent(elementId, html) { const el = document.getElementById(elementId); if (el) el.innerHTML = html; }

function renderExportPreview(r) {
  const rows = [['SALARY STRUCTURE', '', true], ['Basic', fmt(r.basic), false], ['HRA', fmt(r.hra), false]];
  if (r.isHighGross) {
    rows.push(['Defray Expenses (10%)', fmt(r.deferAllowance), false]);
    rows.push(['Conveyance', fmt(r.conv), false]);
  } else {
    rows.push([r.convLabel, fmt(r.conv), false]);
  }
  rows.push(
    ['Gross Salary', fmt(r.gross), false],
    ['EMPLOYER CONTRIBUTIONS', '', true],
    ['EPF – Employer (' + r.pfEmployerRate + '%)', fmt(r.epfEmployer), false],
    ['EDLI – Employer' + (r.pfEmployerRate === '12' ? ' (N/A)' : ''), r.edliEmployer > 0 ? fmt(r.edliEmployer) : 'Rs.0', false],
    ['Bonus', fmt(r.bonus), false],
    ['Initial CTC', fmt(r.initialCTC), false],
    ['ESI – Employer', fmt(r.esiEmployer), false],
    ['Gratuity', fmt(r.gratuity), false],
    ['Leave Encashment (' + r.leavesPerYear + ' leaves/yr)', fmt(r.leaveComponent), false],
    ['EMPLOYEE DEDUCTIONS', '', true],
    ['EPF – Employee', fmt(r.epfEmployee), false],
    ['ESI – Employee', fmt(r.esiEmployee), false],
    ['Professional Tax – ' + (r.ptStateName||'N/A'), fmt(r.ptDeduction), false],
    ['LWF – ' + (r.lwfStateName||'N/A'), fmt(r.lwf), false],
    ['FINAL TOTALS', '', true],
    ['Final CTC (Monthly)', fmt(r.finalCTC), false],
    ['Final CTC (Annual)', fmt(r.finalCTCAnnual), false],
    ['Cash in Hand', fmt(r.cashInHand), false]
  );

  let html = '<table class="preview-table">';
  rows.forEach(function(item) {
    if (item[2]) html += '<tr class="section-head"><td colspan="2">' + item[0] + '</td></tr>';
    else         html += '<tr><td>' + item[0] + '</td><td>' + item[1] + '</td></tr>';
  });
  html += '</table>';
  setTextContent('exportPreview', html);
}

function switchTab(tab) {
  document.querySelectorAll('.tab-panel')?.forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-item')?.forEach(function(b) { b.classList.remove('active'); });
  const tabPanel = document.getElementById('tab-' + tab);
  const navBtn   = document.querySelector('[data-tab="' + tab + '"]');
  if (tabPanel) tabPanel.classList.add('active');
  if (navBtn)   navBtn.classList.add('active');
}

function resetAll() {
  ['empName', 'grossSalary', 'minWage', 'previousBasic'].forEach(function(id) { 
    const el = document.getElementById(id); 
    if (el) el.value = ''; 
  });
  
  const warnEl = document.getElementById('minWageWarning');
  if (warnEl) warnEl.classList.add('hidden');

  lwfMode = 'auto'; setLWFMode('auto');
  const lwfStateEl  = document.getElementById('lwfState');  if (lwfStateEl)  lwfStateEl.value  = '';
  const lwfResultEl = document.getElementById('lwfAutoValue'); if (lwfResultEl) lwfResultEl.textContent = 'Select state to calculate';
  const lwfHintEl   = document.getElementById('lwfAutoHint');  if (lwfHintEl)   lwfHintEl.textContent   = 'Select state and month to auto-calculate LWF';
  const lwfAmountEl = document.getElementById('lwfAmount');    if (lwfAmountEl) lwfAmountEl.value = '0';
  const monthEl     = document.getElementById('lwfMonth');     if (monthEl)     monthEl.value = new Date().getMonth() + 1;

  ptMode = 'auto'; setPTMode('auto');
  const ptStateEl  = document.getElementById('ptState');    if (ptStateEl)  ptStateEl.value  = '';
  const ptResultEl = document.getElementById('ptAutoValue'); if (ptResultEl) ptResultEl.textContent = 'Select state to calculate';
  const ptHintEl   = document.getElementById('ptAutoHint');  if (ptHintEl)   ptHintEl.textContent   = 'Select state, month & gender to auto-calculate Professional Tax';
  const ptAmountEl = document.getElementById('ptAmount');    if (ptAmountEl) ptAmountEl.value = '0';
  const ptMonthEl  = document.getElementById('ptMonth');     if (ptMonthEl)  ptMonthEl.value = new Date().getMonth() + 1;

  gratuityMode = 'auto'; setGratuityMode('auto');
  const gratuityCustom = document.getElementById('gratuityCustom'); if (gratuityCustom) gratuityCustom.value = '';

  leaveMode = 'auto'; setLeaveMode('auto');
  const leaveCustom = document.getElementById('leaveCustom'); if (leaveCustom) leaveCustom.value = '';
  const leaveCountInput = document.getElementById('leaveCountInput'); if (leaveCountInput) leaveCountInput.value = '15';
  leaveCountManual = 15;

  pfApplicable   = 'Y';
  pfBaseMode     = 'standard';
  pfAddVoluntary = false;
  pfEmployerRate = '12.5';
  setPFApplicable('Y');
  _syncPFUI();
  const pfVolEl  = document.getElementById('pfVoluntaryPct');    if (pfVolEl)  pfVolEl.value  = '';
  const pfSpecEl = document.getElementById('pfSpecificAmtVal');  if (pfSpecEl) pfSpecEl.value = '';
  const pfPreview = document.getElementById('pfLivePreview');    if (pfPreview) pfPreview.style.display = 'none';

  setText('r_initialCTC', '—');
  safeToggle('summaryEmpty', false);
  safeToggle('summaryResults', true);
  safeToggle('breakdownEmpty', false);
  safeToggle('breakdownContent', true);
  safeToggle('previousBasicRow', true);
  
  const exportPreview = document.getElementById('exportPreview');
  if (exportPreview) exportPreview.innerHTML = '<div class="preview-empty">Calculate first to see export preview</div>';
  calcResult = null;
  showToast('↺ Calculator Reset');
}

// ============== EXPORT FUNCTIONS ==============
function exportPDF() {
    if (!calcResult) { showToast('Please calculate first'); return; }
    const r = calcResult;
    const empName = (document.getElementById('empName')?.value || '').trim() || 'Employee';
    const now = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const PW = 210, PH = 297, M = 12, CW = PW - (M * 2), HH = 25, FH = 15;
    let Y = HH + 10;
    function fmtP(n) { return 'Rs. ' + Math.round(n).toLocaleString('en-IN'); }
    function needPage(need) {
        if (Y + need > PH - FH - 10) { doc.addPage(); Y = 18; addMiniHeader(); return true; } return false;
    }
    function addMainHeader() {
        doc.setFillColor(28, 58, 108); doc.rect(0, 0, PW, HH, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
        doc.text('CTC SALARY REPORT', PW/2, 12, {align:'center'});
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        doc.text('New Labour Code Compliance - Gross Based', PW/2, 18, {align:'center'});
        doc.text('SLCI Solutions', PW/2, 23, {align:'center'});
    }
    function addMiniHeader() {
        doc.setFillColor(28, 58, 108); doc.rect(0, 0, PW, 10, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        doc.text('CTC Report - ' + empName.substring(0,20), PW/2, 6.5, {align:'center'}); Y = 15;
    }
    function addFooter(pn, tp) {
        const fy = PH - 10; doc.setDrawColor(200, 200, 200); doc.line(M, fy, PW-M, fy);
        doc.setTextColor(120, 120, 120); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
        doc.text('Generated: ' + now, M, fy + 4);
        doc.text('Page ' + pn + ' of ' + tp, PW-M, fy + 4, {align:'right'});
    }
    function addInfo() {
        needPage(35); doc.setTextColor(35, 35, 35); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        const info = [
            ['Employee Name', empName], ['Report Date', now],
            ['PF Status', r.pfApplicable === 'Y' ? 'Applicable' : 'Not Applicable'],
            ['Minimum Wage', fmtP(r.minWage)],
            ['LWF State', r.lwfStateName || 'Not Selected'],
            ['PT State', r.ptStateName || 'Not Selected']
        ];
        info.forEach(function(it, i) {
            doc.setFont('helvetica', 'bold'); doc.text(it[0] + ':', M, Y + (i * 5));
            doc.setFont('helvetica', 'normal'); doc.text(it[1], M + 42, Y + (i * 5));
        });
        Y += (info.length * 5) + 12;
    }
    function addTitle(txt) {
        needPage(20);
        doc.setFillColor(240, 240, 240); doc.rect(M, Y-2, CW, 8, 'F');
        doc.setDrawColor(28, 58, 108); doc.setLineWidth(0.3);
        doc.line(M, Y-2, M+CW, Y-2); doc.line(M, Y+6, M+CW, Y+6);
        doc.setTextColor(28, 58, 108); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        doc.text(txt, M+5, Y+3); Y += 16;
    }
    function addBorderedTable(headers, rows, highlightLast) {
        const col1W = CW * 0.62, col2W = CW - col1W, RH = 7;
        needPage((rows.length + 1) * RH + 15); doc.setFontSize(8);
        doc.setFillColor(28, 58, 108); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
        doc.rect(M, Y, col1W, RH, 'F'); doc.rect(M+col1W, Y, col2W, RH, 'F');
        doc.text(headers[0], M+3, Y+4.5); doc.text(headers[1], M+col1W+3, Y+4.5, {align:'right'});
        doc.setDrawColor(28, 58, 108); doc.setLineWidth(0.4); doc.rect(M, Y, CW, RH, 'S'); Y += RH;
        doc.setTextColor(35, 35, 35); doc.setFont('helvetica', 'normal');
        rows.forEach(function(row, ri) {
            needPage(RH + 5);
            if (ri % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(M, Y, CW, RH, 'F'); }
            if (highlightLast && ri === rows.length-1) { doc.setTextColor(0, 95, 60); doc.setFont('helvetica', 'bold'); }
            doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.2);
            doc.rect(M, Y, col1W, RH, 'S'); doc.rect(M+col1W, Y, col2W, RH, 'S');
            let label = String(row[0]); if (label.length > 38) label = label.substring(0, 35) + '...';
            doc.text(label, M+3, Y+4.5); doc.text(String(row[1]), M+col1W+3, Y+4.5, {align:'right'});
            doc.setTextColor(35, 35, 35); doc.setFont('helvetica', 'normal'); Y += RH;
        });
        doc.setDrawColor(28, 58, 108); doc.setLineWidth(0.4); doc.rect(M, Y-RH, CW, RH, 'S'); Y += 8;
    }
    function addBorderedTable3(headers, rows) {
        const W1 = CW * 0.42, W2 = CW * 0.29, W3 = CW - W1 - W2, RH = 7;
        needPage((rows.length + 1) * RH + 15); doc.setFontSize(8);
        doc.setFillColor(28, 58, 108); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
        doc.rect(M, Y, W1, RH, 'F'); doc.rect(M+W1, Y, W2, RH, 'F'); doc.rect(M+W1+W2, Y, W3, RH, 'F');
        doc.text(headers[0], M+3, Y+4.5); doc.text(headers[1], M+W1+3, Y+4.5, {align:'right'}); doc.text(headers[2], M+W1+W2+3, Y+4.5, {align:'right'});
        doc.setDrawColor(28, 58, 108); doc.setLineWidth(0.4); doc.rect(M, Y, CW, RH, 'S'); Y += RH;
        doc.setTextColor(35, 35, 35); doc.setFont('helvetica', 'normal');
        rows.forEach(function(row, ri) {
            needPage(RH + 5);
            if (ri % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(M, Y, CW, RH, 'F'); }
            doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.2);
            doc.rect(M, Y, W1, RH, 'S'); doc.rect(M+W1, Y, W2, RH, 'S'); doc.rect(M+W1+W2, Y, W3, RH, 'S');
            let label = String(row[0]); if (label.length > 32) label = label.substring(0, 29) + '...';
            doc.text(label, M+3, Y+4.5); doc.text(String(row[1]), M+W1+3, Y+4.5, {align:'right'}); doc.text(String(row[2]), M+W1+W2+3, Y+4.5, {align:'right'});
            Y += RH;
        });
        doc.setDrawColor(28, 58, 108); doc.setLineWidth(0.4); doc.rect(M, Y-RH, CW, RH, 'S'); Y += 8;
    }
    addMainHeader();
    addInfo();
    addTitle('SALARY STRUCTURE (Monthly)');
    let salRows = [['Basic Salary', fmtP(r.basic)], ['HRA', fmtP(r.hra)]];
    if (r.isHighGross) {
        salRows.push(['Defray Expenses (10%)', fmtP(r.deferAllowance)]);
        salRows.push([r.convLabel || 'Conveyance', fmtP(r.conv)]);
    } else {
        salRows.push([r.convLabel || 'Conveyance', fmtP(r.conv)]);
    }
    salRows.push(['-------------------------', '--------------']);
    salRows.push(['GROSS SALARY', fmtP(r.gross)]);
    addBorderedTable(['Component', 'Amount'], salRows);
    addTitle('EMPLOYER CONTRIBUTIONS');
    const empRows = [
        ['EPF - Employer', r.pfApplicable === 'Y' ? fmtP(r.epfEmployer) : 'N/A'],
        ['EDLI - Employer', r.edliEmployer > 0 ? fmtP(r.edliEmployer) : 'Rs. 0'],
        ['Bonus', r.bonus > 0 ? fmtP(r.bonus) : 'N/A'],
        ['-------------------------', '--------------'],
        ['Initial CTC', fmtP(r.initialCTC)],
        ['ESI - Employer', r.esiEmployer > 0 ? fmtP(r.esiEmployer) : 'N/A'],
        ['Gratuity', fmtP(r.gratuity)],
        ['Leave Encashment (' + r.leavesPerYear + ' leaves)', fmtP(r.leaveComponent)],
        ['LWF', r.lwf > 0 ? fmtP(r.lwf) : 'Rs. 0']
    ];
    addBorderedTable(['Component', 'Amount'], empRows);
    addTitle('EMPLOYEE DEDUCTIONS');
    const dedRows = [
        ['EPF - Employee', r.pfApplicable === 'Y' ? fmtP(r.epfEmployee) : 'N/A'],
        ['ESI - Employee', r.esiEmployee > 0 ? fmtP(r.esiEmployee) : 'N/A'],
        ['Professional Tax', r.ptDeduction > 0 ? fmtP(r.ptDeduction) : 'Rs. 0'],
        ['LWF', r.lwf > 0 ? fmtP(r.lwf) : 'Rs. 0']
    ];
    addBorderedTable(['Deduction', 'Amount'], dedRows);
    addTitle('FINAL SUMMARY');
    const finalRows = [
        ['Final CTC', fmtP(r.finalCTC), fmtP(r.finalCTCAnnual)],
        ['Net Cash in Hand', fmtP(r.cashInHand), fmtP(r.cashInHand * 12)]
    ];
    addBorderedTable3(['Particulars', 'Monthly', 'Annual'], finalRows);
    const tp = doc.internal.getNumberOfPages();
    for (let p = 1; p <= tp; p++) { doc.setPage(p); addFooter(p, tp); }
    const safe = empName.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 22);
    doc.save('CTC_Report_' + safe + '_' + new Date().toISOString().slice(0,10) + '.pdf');
    showToast('PDF downloaded successfully');
}

function exportCSV() {
  if (!calcResult) { showToast('⚠️ Please calculate first'); return; }
  const r       = calcResult;
  const empName = (document.getElementById('empName')?.value || '').trim() || 'Employee';
  const now     = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  function cell(v) { return '"' + String(v !== null && v !== undefined ? v : '').replace(/"/g, '""') + '"'; }
  function amt(n)  { return n > 0 ? Math.round(n) : 0; }
  const rows = [
    ['CTC SALARY REPORT', '', ''], ['Employee Name', empName, ''], ['Date', now, ''],
    ['PF Status', r.pfApplicable === 'Y' ? 'Applicable' : 'Not Applicable', ''],
    ['PF Mode', r.pfApplicable === 'Y' ? r.pfModeLabel : 'N/A', ''],
    ['Employer PF Rate', r.pfApplicable === 'Y' ? r.pfEmployerRate + '%' : 'N/A', ''],
    ['State Minimum Wage', amt(r.minWage), ''], ['LWF State', r.lwfStateName||'N/A', ''],
    ['Professional Tax State', r.ptStateName||'N/A', ''], ['', '', ''],
    ['SALARY STRUCTURE', '', 'Monthly Amount (Rs.)'],
    ['Basic Salary', '', amt(r.basic)], ['HRA', '', amt(r.hra)],
    ...(r.isHighGross ? [['Defray Expenses (10%)', '', amt(r.deferAllowance)], ['Conveyance', '', amt(r.conv)]] : [['Conveyance', '', amt(r.conv)]]),
    ['Gross Salary', '', amt(r.gross)], ['', '', ''],
    ['EMPLOYER CONTRIBUTIONS', '', 'Monthly Amount (Rs.)'],
    ['EPF – Employer (' + r.pfEmployerRate + '%)', '', r.pfApplicable === 'Y' ? amt(r.epfEmployer) : 'N/A'],
    ['EDLI – Employer', '', r.edliEmployer > 0 ? amt(r.edliEmployer) : 'N/A'],
    ['Bonus', '', r.bonus > 0 ? amt(r.bonus) : 'N/A'],
    ['Initial CTC', '', amt(r.initialCTC)],
    ['ESI – Employer (3.25%)', '', r.esiEmployer > 0 ? amt(r.esiEmployer) : 'N/A'],
    ['Gratuity', '', amt(r.gratuity)],
    ['Leave Encashment (' + r.leavesPerYear + ' leaves/yr)', '', amt(r.leaveComponent)],
    ['LWF', '', r.lwf > 0 ? amt(r.lwf) : 'N/A'], ['', '', ''],
    ['EMPLOYEE DEDUCTIONS', '', 'Monthly Amount (Rs.)'],
    ['EPF – Employee', '', r.pfApplicable === 'Y' ? amt(r.epfEmployee) : 'N/A'],
    ['ESI – Employee (0.75%)', '', r.esiEmployee > 0 ? amt(r.esiEmployee) : 'N/A'],
    ['Professional Tax – ' + (r.ptStateName||'N/A'), '', r.ptDeduction > 0 ? amt(r.ptDeduction) : 'N/A'],
    ['LWF – ' + (r.lwfStateName||'N/A'), '', r.lwf > 0 ? amt(r.lwf) : 'N/A'], ['', '', ''],
    ['FINAL SUMMARY', '', 'Amount (Rs.)'],
    ['Final CTC (Monthly)', '', amt(r.finalCTC)],
    ['Final CTC (Annual)', '', amt(r.finalCTCAnnual)],
    ['Net Cash in Hand (Monthly)', '', amt(r.cashInHand)],
  ];
  const csv = rows.map(function(row) { return row.map(function(c) { return cell(c); }).join(','); }).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'CTC_Report_' + empName.replace(/\s+/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
  showToast('✓ CSV Downloaded');
}

function copyToClipboard() {
  if (!calcResult) { showToast('⚠️ Please calculate first'); return; }
  const r       = calcResult;
  const empName = (document.getElementById('empName')?.value || '').trim() || 'Employee';
  const allowanceLines = r.isHighGross
    ? ['Defray Expenses (10%)\t' + r.deferAllowance, 'Conveyance\t' + r.conv]
    : ['Conveyance\t' + r.conv];
  const lines = ['CTC Report — ' + empName, 'Basic\t' + r.basic, 'HRA\t' + r.hra]
    .concat(allowanceLines)
    .concat([
      'Gross\t' + r.gross,
      'EPF Employer (' + r.pfEmployerRate + '%)\t' + r.epfEmployer,
      'EDLI Employer\t' + r.edliEmployer,
      'Bonus\t' + r.bonus,
      'ESI Employer\t' + r.esiEmployer,
      'Gratuity\t' + r.gratuity,
      'Leave Encashment (' + r.leavesPerYear + ' leaves)\t' + r.leaveComponent,
      'LWF – ' + (r.lwfStateName||'N/A') + '\t' + r.lwf,
      'PT – ' + (r.ptStateName||'N/A') + '\t' + r.ptDeduction,
      'EPF Employee\t' + r.epfEmployee,
      'ESI Employee\t' + r.esiEmployee,
      'Final CTC (Monthly)\t' + r.finalCTC,
      'Final CTC (Annual)\t' + r.finalCTCAnnual,
      'Cash in Hand\t' + r.cashInHand,
    ]);
  navigator.clipboard.writeText(lines.join('\n'))
    .then(function() { showToast('⎘ Copied to clipboard'); })
    .catch(function() { showToast('⚠️ Copy failed'); });
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.target.matches('input[type="password"]')) {
    const mainApp = document.getElementById('mainApp');
    if (mainApp && !mainApp.classList.contains('hidden')) calculate();
  }
});

/* =====================================================
   BULK UPLOAD — FULL INDIVIDUAL-LEVEL PARITY
   ===================================================== */

let bulkRawData     = [];
let bulkCalcResults = [];

function initBulkTab() {
  const dropZone  = document.getElementById('bulkDropZone');
  const fileInput = document.getElementById('bulkFileInput');
  if (!dropZone || !fileInput) return;
  const newDrop  = dropZone.cloneNode(true);
  const newInput = fileInput.cloneNode(true);
  dropZone.parentNode.replaceChild(newDrop, dropZone);
  fileInput.parentNode.replaceChild(newInput, fileInput);
  newDrop.addEventListener('dragover',  function(e) { e.preventDefault(); newDrop.classList.add('drag-over'); });
  newDrop.addEventListener('dragleave', function()  { newDrop.classList.remove('drag-over'); });
  newDrop.addEventListener('drop', function(e) {
    e.preventDefault(); newDrop.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleBulkFile(file, newInput);
  });
  newDrop.addEventListener('click', function(e) { if (e.target.tagName !== 'BUTTON') newInput.click(); });
  newInput.addEventListener('change', function(e) { if (e.target.files[0]) handleBulkFile(e.target.files[0], newInput); });
  const browseBtn = newDrop.querySelector('.btn-browse');
  if (browseBtn) browseBtn.addEventListener('click', function(e) { e.stopPropagation(); newInput.click(); });
}

function handleBulkFile(file, fileInputEl) {
  const ext = file.name.split('.').pop().toLowerCase();
  setBulkStatus('info', '⟳ Reading file: ' + file.name + '...');
  if (ext === 'csv') {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: function(result) {
        bulkRawData = result.data.filter(function(row) {
          return row && Object.values(row).some(function(v) {
            if (v === null || v === undefined) return false;
            const s = String(v).trim().toLowerCase();
            return s !== '' && s !== 'null' && s !== 'undefined' && s !== 'n/a' && s !== '-';
          });
        });
        onBulkFileReady(file.name, bulkRawData.length);
      },
      error: function(err) { setBulkStatus('error', '⚠️ CSV parse failed: ' + err.message); }
    });
  } else if (['xlsx', 'xls'].includes(ext)) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const wb  = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        let rawJson = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
        let processedData = findHeaderAndData(rawJson);
        if (!processedData || processedData.length === 0) {
          const rawData = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
          if (rawData && rawData.length > 1) {
            const headers = rawData[0].map(function(h) { return String(h || '').trim(); }).filter(function(h) { return h; });
            processedData = rawData.slice(1).map(function(row) {
              const obj = {};
              headers.forEach(function(h, i) { const val = row[i]; obj[h] = (val === undefined || val === null || String(val).trim() === '') ? null : val; });
              return obj;
            }).filter(function(row) { return row && Object.keys(row).length > 0; });
          }
        }
        bulkRawData = (processedData || []).filter(function(row) {
          if (!row || typeof row !== 'object') return false;
          return Object.values(row).some(function(v) {
            if (v === null || v === undefined) return false;
            const s = String(v).trim().toLowerCase();
            return s !== '' && s !== 'null' && s !== 'undefined' && s !== 'n/a' && s !== '-' && s !== 'na';
          });
        });
        if (bulkRawData.length > 0) onBulkFileReady(file.name, bulkRawData.length);
        else setBulkStatus('error', '⚠️ No valid data rows found. Check file headers & content.');
      } catch (err) { setBulkStatus('error', '⚠️ Excel read failed: ' + err.message); }
    };
    reader.onerror = function() { setBulkStatus('error', '⚠️ File read error - please try again'); };
    reader.readAsArrayBuffer(file);
  } else {
    setBulkStatus('error', '⚠️ Unsupported format. Please use .csv, .xlsx, or .xls');
  }
}

function onBulkFileReady(fileName, rowCount) {
  const actionRow  = document.getElementById('bulkActionRow');
  const fileNameEl = document.getElementById('bulkFileName');
  const rowCountEl = document.getElementById('bulkRowCount');
  if (actionRow)  actionRow.style.display = 'flex';
  if (fileNameEl) fileNameEl.textContent  = fileName;
  if (rowCountEl) rowCountEl.textContent  = rowCount + ' rows found';
  setBulkStatus('success', '✓ File loaded: "' + fileName + '" — ' + rowCount + ' rows. Click "Calculate All" to process.');
}

function normKey(k) {
  if (!k && k !== 0) return '';
  return k.toString().trim().toLowerCase().replace(/[\s_\-\/\(\)\.\,\'\"]+/g, '').replace(/[^a-z0-9]/g, '');
}

function getBulkField(row, aliases) {
  if (!row || typeof row !== 'object') return null;
  const normalizedRow = {};
  for (const [origKey, origVal] of Object.entries(row)) {
    const nk = normKey(origKey);
    if (nk) normalizedRow[nk] = { originalKey: origKey, value: origVal };
  }
  for (var i = 0; i < aliases.length; i++) {
    const alias = aliases[i];
    const nk = normKey(alias);
    if (!nk) continue;
    if (normalizedRow[nk]) {
      const val = normalizedRow[nk].value;
      if (val === undefined || val === null) continue;
      const s = String(val).trim();
      if (s === '' || ['null','undefined','n/a','-','na','none'].includes(s.toLowerCase())) continue;
      return s;
    }
  }
  for (var i = 0; i < aliases.length; i++) {
    const aliasNorm = normKey(aliases[i]);
    if (!aliasNorm) continue;
    for (const [keyNorm, data] of Object.entries(normalizedRow)) {
      if (keyNorm.includes(aliasNorm) || aliasNorm.includes(keyNorm)) {
        const val = data.value;
        if (val === undefined || val === null) continue;
        const s = String(val).trim();
        if (s === '' || ['null','undefined','n/a','-','na','none'].includes(s.toLowerCase())) continue;
        return s;
      }
    }
  }
  return null;
}

function cleanNum(v) {
  if (v === null || v === undefined) return NaN;
  if (String(v).trim().toLowerCase() === 'null') return NaN;
  const s = String(v).replace(/[₹,\s]/g,'').replace(/[^\d.\-]/g,'').trim();
  if (!s || s === '-' || s === '.' || ['null','undefined','n/a','na',''].includes(s.toLowerCase())) return NaN;
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

function findHeaderAndData(rawRows) {
  if (!rawRows || !Array.isArray(rawRows) || rawRows.length === 0) return [];
  const headerKeywords = ['gross','employee','name','empname','minwage','minimumwage','salary','wage','basic','hra','pf','pt','lwf','gratuity','leave','encashment','monthly','pay','amount'];
  for (var i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = rawRows[i];
    if (!row || typeof row !== 'object') continue;
    const allText = [...Object.keys(row).map(function(k) { return String(k || '').toLowerCase(); }), ...Object.values(row).map(function(v) { return String(v || '').toLowerCase(); })].join(' ');
    const keywordCount = headerKeywords.filter(function(kw) { return allText.includes(kw); }).length;
    if (keywordCount >= 3) {
      if (i === 0) return rawRows;
      const headerValues = Object.values(row).map(function(v, idx) { return String(v || '').trim() || 'Column' + (idx + 1); });
      const dataRows = rawRows.slice(i + 1).map(function(dataRow) {
        const vals = Object.values(dataRow);
        const remapped = {};
        headerValues.forEach(function(h, colIdx) {
          if (h) { const val = vals[colIdx]; remapped[h] = (val === undefined || val === null || String(val).trim() === '') ? null : val; }
        });
        return remapped;
      });
      return dataRows.filter(function(r) { return r && Object.keys(r).length > 0; });
    }
  }
  return rawRows;
}

// ============================================================
//  ✅ BULK SEARCH — Real-time search across all result columns
// ============================================================

/**
 * injectBulkSearchBar()
 * Injects the search bar HTML above the bulk results table.
 * Called once after renderBulkResults() builds the table.
 */
function injectBulkSearchBar() {
  // Remove existing search bar if present (re-render case)
  const existing = document.getElementById('bulkSearchBar');
  if (existing) existing.remove();

  const noResultsDiv = document.getElementById('bulkNoResults');
  if (noResultsDiv) noResultsDiv.remove();

  const tableScroll = document.querySelector('.bulk-table-scroll');
  if (!tableScroll) return;

  // ── Search Bar HTML ──
  const searchBarHTML = `
    <div class="bulk-search-bar" id="bulkSearchBar">
      <span class="bulk-search-icon">🔍</span>
      <input
        type="text"
        class="bulk-search-input"
        id="bulkSearchInput"
        placeholder="Search employees by name, code, branch, state, PF status, CTC..."
        autocomplete="off"
        spellcheck="false"
      />
      <span class="bulk-search-count" id="bulkSearchCount"></span>
      <button class="bulk-search-clear" id="bulkSearchClear" onclick="clearBulkSearch()" title="Clear search">✕ Clear</button>
    </div>
    <div class="bulk-no-results" id="bulkNoResults">
      <span style="font-size:24px;display:block;margin-bottom:8px;">🔎</span>
      No employees match your search. Try different keywords.
    </div>
  `;

  tableScroll.insertAdjacentHTML('beforebegin', searchBarHTML);

  // Attach live input event
  const searchInput = document.getElementById('bulkSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      filterBulkTable(this.value);
    });
    // Focus the search box
    setTimeout(function() { searchInput.focus(); }, 100);
  }

  // Update count display with total
  updateBulkSearchCount('', bulkCalcResults.length, bulkCalcResults.length);
}

/**
 * filterBulkTable(query)
 * Filters rows of #bulkTableBody based on the search query.
 * Searches across ALL visible text in each row (name, code, branch, states, amounts, etc.)
 * Also highlights matched text inside .td-name cells.
 */
function filterBulkTable(query) {
  const tbody     = document.getElementById('bulkTableBody');
  const clearBtn  = document.getElementById('bulkSearchClear');
  const noResults = document.getElementById('bulkNoResults');
  if (!tbody) return;

  const q = (query || '').trim().toLowerCase();

  // Show/hide clear button
  if (clearBtn) clearBtn.style.display = q ? 'inline-block' : 'none';

  const rows      = Array.from(tbody.querySelectorAll('tr'));
  let visibleCount = 0;
  const total      = rows.length;

  if (!q) {
    // No query → show all rows, remove highlights
    rows.forEach(function(row) {
      row.classList.remove('bulk-hidden', 'bulk-match');
      // Restore original text in name cells
      const nameCell = row.querySelector('.td-name');
      if (nameCell && nameCell.dataset.originalText) {
        nameCell.textContent = nameCell.dataset.originalText;
      }
    });
    updateBulkSearchCount('', total, total);
    if (noResults) noResults.classList.remove('visible');
    return;
  }

  // Query present → filter rows
  rows.forEach(function(row) {
    // Get all text content from this row for searching
    const rowText = row.textContent.toLowerCase();
    const matches = rowText.includes(q);

    if (matches) {
      row.classList.remove('bulk-hidden');
      row.classList.add('bulk-match');
      visibleCount++;

      // Highlight match in the employee name cell
      const nameCell = row.querySelector('.td-name');
      if (nameCell) {
        // Store original text once
        if (!nameCell.dataset.originalText) {
          nameCell.dataset.originalText = nameCell.textContent;
        }
        const original = nameCell.dataset.originalText;
        const lowerOrig = original.toLowerCase();
        const idx = lowerOrig.indexOf(q);
        if (idx >= 0) {
          // Highlight the matching part
          nameCell.innerHTML =
            escapeHtml(original.slice(0, idx)) +
            '<span class="bulk-search-highlight">' + escapeHtml(original.slice(idx, idx + q.length)) + '</span>' +
            escapeHtml(original.slice(idx + q.length));
        } else {
          // Query matched elsewhere in row, just restore name
          nameCell.textContent = original;
        }
      }
    } else {
      row.classList.add('bulk-hidden');
      row.classList.remove('bulk-match');
      // Restore name cell on hidden rows
      const nameCell = row.querySelector('.td-name');
      if (nameCell && nameCell.dataset.originalText) {
        nameCell.textContent = nameCell.dataset.originalText;
      }
    }
  });

  updateBulkSearchCount(q, visibleCount, total);

  // Show no-results message if nothing found
  if (noResults) {
    noResults.classList.toggle('visible', visibleCount === 0);
  }
}

/**
 * updateBulkSearchCount(query, visible, total)
 * Updates the "Showing X of Y" counter next to the search box.
 */
function updateBulkSearchCount(query, visible, total) {
  const countEl = document.getElementById('bulkSearchCount');
  if (!countEl) return;
  if (!query) {
    countEl.innerHTML = '<span class="match-count">' + total + '</span> employees';
  } else {
    countEl.innerHTML = '<span class="match-count">' + visible + '</span> of ' + total + ' match';
  }
}

/**
 * clearBulkSearch()
 * Clears the search input and resets the table.
 */
function clearBulkSearch() {
  const searchInput = document.getElementById('bulkSearchInput');
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
  filterBulkTable('');
}

// ===================================================================
//  ✅ BULK PROCESS — FULL INDIVIDUAL-LEVEL PARITY
// ===================================================================
function processBulkFile() {
  if (!bulkRawData || bulkRawData.length === 0) {
    showToast('⚠️ No file loaded. Please upload first.');
    setBulkStatus('error', '⚠️ No data found in file.');
    return;
  }
  const rows = bulkRawData.filter(function(row) {
    return row && Object.values(row).some(function(v) {
      if (v === null || v === undefined) return false;
      const s = String(v).trim().toLowerCase();
      return s !== '' && s !== 'null' && s !== 'undefined' && s !== 'n/a' && s !== '-';
    });
  });
  if (rows.length === 0) { setBulkStatus('error', '⚠️ No valid data rows. Check file headers.'); return; }

  setBulkStatus('info', '⟳ Processing ' + rows.length + ' employees...');
  const progressWrap = document.getElementById('bulkProgressWrap');
  const progressFill = document.getElementById('bulkProgressFill');
  if (progressWrap) progressWrap.style.display = 'block';
  if (progressFill) progressFill.style.width = '0%';

  bulkCalcResults = [];
  let errors = 0;
  const total = rows.length;
  const currentMonth = new Date().getMonth() + 1;

  rows.forEach(function(row, i) {
    setTimeout(function() {
      if (progressFill) progressFill.style.width = Math.round(((i + 1) / total) * 100) + '%';
    }, i * 5);

    const rowNum = i + 1;

    const name = getBulkField(row, ['Employee Name','EmployeeName','Name','Emp Name','EmpName','Employee','EMPLOYEE NAME']) || 'Employee ' + rowNum;
    const empCode = getBulkField(row, ['Employee Code','Emp Code','EmployeeCode','EmpCode','Code','ID','Employee ID','EmpID']) || '';
    const branch  = getBulkField(row, ['Branch','Office','Location','Site','Branch Name','BranchName','Unit','Department']) || '';

    const prevBasicRaw = getBulkField(row, ['Previous Basic','Prev Basic','PrevBasic','Old Basic','OldBasic','Last Basic','Previous Basic Salary']);
    const previousBasic = isNaN(cleanNum(prevBasicRaw)) ? null : cleanNum(prevBasicRaw);

    const grossRaw = getBulkField(row, ['Gross Salary','Gross','Monthly Gross','GrossSalary','GROSS','Gross Pay','Monthly Gross Salary','Gross_Amt','Total Gross']);
    const gross    = cleanNum(grossRaw);

    const minWageRaw = getBulkField(row, ['Min Wage','Minimum Wage','MinWage','State Min Wage','Min Salary','STATE MIN WAGE','Minimum Monthly Wage','min_wage']);
    const minWage    = cleanNum(minWageRaw);

    if (isNaN(gross) || gross <= 0) {
      bulkCalcResults.push({ name, rowNum, error: '❌ Gross Salary missing. Got: "' + grossRaw + '". Columns: ' + Object.keys(row).join(', ').substring(0,100) });
      errors++; return;
    }
    if (isNaN(minWage) || minWage <= 0) {
      bulkCalcResults.push({ name, rowNum, error: '❌ Min Wage missing. Got: "' + minWageRaw + '".' });
      errors++; return;
    }
    if (gross < minWage) {
      bulkCalcResults.push({ name, rowNum, error: '❌ Gross (Rs.' + Math.round(gross).toLocaleString('en-IN') + ') < Min Wage (Rs.' + Math.round(minWage).toLocaleString('en-IN') + '). Cannot calculate.' });
      errors++; return;
    }

    const pfRaw = getBulkField(row, ['PF','PF Applicable','PF (Y/N)','PF_Applicable','PF Applicability','pf_yn']);
    let pf = (pfRaw && pfRaw.toString().trim().toUpperCase() === 'N') ? 'N' : 'Y';

    const pfBaseModeRaw = getBulkField(row, ['PF Mode','PFMode','pf_mode','PF Type','PFType','PF Base Mode']);
    let bulkPfBase = 'standard';
    if (pfBaseModeRaw) {
      const s = pfBaseModeRaw.toString().trim().toLowerCase();
      if (s.includes('full'))                                    bulkPfBase = 'full_basic';
      else if (s.includes('specific') || s.includes('fixed'))   bulkPfBase = 'specific_amt';
      else                                                       bulkPfBase = 'standard';
    }

    const pfVolRaw   = getBulkField(row, ['Voluntary PF','Has Voluntary','pfvoluntary','voluntary_pf','Voluntary Add-on']);
    const bulkHasVol = pfVolRaw ? ['y','yes','true','1'].includes(pfVolRaw.toString().trim().toLowerCase()) : false;
    const pfVolPctRaw = getBulkField(row, ['Voluntary PF %','VPF %','Voluntary PF Pct','vpf_pct','Vol PF Pct','voluntary_pct']);
    const bulkVolPct  = isNaN(cleanNum(pfVolPctRaw)) ? 0 : cleanNum(pfVolPctRaw);

    const pfSpecAmtRaw = getBulkField(row, ['Specific PF Amount','PF Specific Amt','Fixed PF Amount','pf_specific_amt','SpecificPFAmount']);
    const bulkSpecAmt  = isNaN(cleanNum(pfSpecAmtRaw)) ? 0 : cleanNum(pfSpecAmtRaw);

    const pfEmpRateRaw = getBulkField(row, ['Employer PF Rate','PF Employer Rate','Emp PF Rate','pf_employer_rate','employer_pf_rate']);
    const bulkEmpRate  = pfEmpRateRaw && ['12','12.5'].includes(pfEmpRateRaw.toString().trim()) ? pfEmpRateRaw.toString().trim() : '12.5';

    const salMonthRaw = getBulkField(row, ['Salary Month','Month','SalaryMonth','sal_month','pay_month','PT Month','LWF Month','Payroll Month']);
    let bulkMonth = currentMonth;
    if (salMonthRaw) {
      const mNum = parseInt(salMonthRaw);
      if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
        bulkMonth = mNum;
      } else {
        const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
        const mStr = salMonthRaw.toString().trim().toLowerCase().substring(0,3);
        const mIdx = monthNames.indexOf(mStr);
        if (mIdx >= 0) bulkMonth = mIdx + 1;
      }
    }

    const genderRaw = getBulkField(row, ['Gender','gender','Sex','sex']);
    const bulkGender = (genderRaw && genderRaw.toString().trim().toLowerCase().includes('f')) ? 'Female' : 'Male';

    const ptStateRaw  = getBulkField(row, ['PT State','PTState','Professional Tax State','pt_state','State PT','PT (State)','PT State Code']);
    const ptAmtRaw    = getBulkField(row, ['PT Amount','Professional Tax','PT (Monthly)','Prof Tax','ProfTax','pt_amt','PT','PT Manual']);
    const ptAmtManual = cleanNum(ptAmtRaw);

    let pt = 0, ptStateName = 'N/A', ptMode_row = 'manual';
    if (ptStateRaw) {
      const resolvedPTCode = resolvePTStateCode(ptStateRaw);
      if (resolvedPTCode && PT_STATES[resolvedPTCode]) {
        pt = computePTAuto(resolvedPTCode, gross, bulkMonth, bulkGender);
        ptStateName = PT_STATES[resolvedPTCode].name;
        ptMode_row = 'auto';
      }
    } else if (!isNaN(ptAmtManual) && ptAmtManual >= 0) {
      pt = Math.max(0, ptAmtManual);
      ptStateName = 'Manual';
      ptMode_row = 'manual';
    }

    const lwfStateRaw  = getBulkField(row, ['LWF State','LWFState','Labour Welfare Fund State','lwf_state','State LWF','LWF (State)','LWF State Code']);
    const lwfAmtRaw    = getBulkField(row, ['LWF Amount','Labour Welfare Fund','LWF (Monthly)','lwf','LWF_Amount','lwf_amt','LWF Manual']);
    const lwfAmtManual = cleanNum(lwfAmtRaw);

    let lwf = 0, lwfStateName = 'N/A', lwfMode_row = 'manual';
    if (lwfStateRaw) {
      const resolvedLWFCode = resolveLWFStateCode(lwfStateRaw);
      if (resolvedLWFCode && LWF_STATES[resolvedLWFCode]) {
        lwf = computeLWFAuto(resolvedLWFCode, bulkMonth, gross, true);
        lwfStateName = LWF_STATES[resolvedLWFCode].name;
        lwfMode_row = 'auto';
      }
    } else if (!isNaN(lwfAmtManual) && lwfAmtManual >= 0) {
      lwf = Math.max(0, lwfAmtManual);
      lwfStateName = 'Manual';
      lwfMode_row = 'manual';
    }

    const gratRaw        = getBulkField(row, ['Gratuity','Gratuity Amount','Monthly Gratuity','gratuity_amt']);
    const gratuityOverride = (gratRaw && !isNaN(cleanNum(gratRaw))) ? cleanNum(gratRaw) : null;

    const leaveAmtRaw    = getBulkField(row, ['Leave Encashment Amount','Leave Amount','Monthly Leave Amount','leave_enc_amount']);
    const leaveOverride  = (leaveAmtRaw && !isNaN(cleanNum(leaveAmtRaw))) ? cleanNum(leaveAmtRaw) : null;

    const leavesRaw = getBulkField(row, ['Leaves per Year','Leaves','Leave Count','Leaves Count','No of Leaves','leaves_per_year','Annual Leaves','Yearly Leaves']);
    let bulkLeaves = 15;
    if (leavesRaw) {
      const parsed = parseInt(leavesRaw);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 365) bulkLeaves = parsed;
    }

    try {
      const r = computeCTC(
        gross, minWage, pf, pt, lwf,
        gratuityOverride, leaveOverride,
        bulkPfBase, bulkHasVol, bulkVolPct, bulkSpecAmt, bulkEmpRate,
        bulkLeaves, previousBasic
      );

      bulkCalcResults.push({
        name, rowNum, empCode, branch, error: null,
        previousBasic,
        salaryMonth    : bulkMonth,
        gender         : bulkGender,
        leavesPerYear  : r.leavesPerYear,
        gross: r.gross, basic: r.basic, hra: r.hra, conv: r.conv,
        convLabel: r.convLabel, deferAllowance: r.deferAllowance, isHighGross: r.isHighGross,
        minWage: r.minWage, pfApplicable: r.pfApplicable, pfWages: r.pfWages, pfEmployerRate: r.pfEmployerRate,
        pfModeLabel: r.pfModeLabel, pfBaseUsed: r.pfBaseUsed, pfHasVoluntary: r.pfHasVoluntary,
        pfVolPct: r.pfVolPct, pfSpecAmt: r.pfSpecAmt,
        epfEmp: r.epfEmployer, edliEmployer: r.edliEmployer, bonus: r.bonus, initialCTC: r.initialCTC,
        esiEmp: r.esiEmployer,
        gratuityUsed: r.gratuity, gratuityAuto: r.gratuityAuto, gratuityMode: r.gratuityMode,
        leaveUsed: r.leaveComponent, leaveAuto: r.leaveAuto, leaveMode: r.leaveMode,
        lwf: r.lwf, lwfStateName, lwfMode: lwfMode_row,
        pt: r.ptDeduction, ptStateName, ptMode: ptMode_row,
        finalCTC: r.finalCTC, finalAnnual: r.finalCTCAnnual,
        epfEe: r.epfEmployee, esiEe: r.esiEmployee, lwfEmployee: r.lwfEmployee,
        ptDeduction: r.ptDeduction, cash: r.cashInHand,
      });
    } catch (err) {
      bulkCalcResults.push({ 
        name, rowNum, empCode, branch, previousBasic,
        error: 'Calculation error: ' + err.message 
      });
      errors++;
    }
  });

  const delay = Math.min(total * 8, 1500);
  setTimeout(function() {
    if (progressWrap) progressWrap.style.display = 'none';
    renderBulkResults(errors, total);
    if (errors === 0) showToast('✅ All ' + total + ' employees calculated!');
    else showToast('⚠️ ' + (total - errors) + '/' + total + ' calculated. ' + errors + ' errors.');
  }, delay + 200);
}

function bulkFmt(n) {
  if (n === null || n === undefined || isNaN(n)) return 'Rs.0';
  return 'Rs.' + Math.round(n).toLocaleString('en-IN');
}

// ===================================================================
//  ✅ BULK RESULTS TABLE
// ===================================================================
function renderBulkResults(errors, total) {
  const valid        = bulkCalcResults.filter(function(r) { return !r.error; });
  const totalMonthly = valid.reduce(function(s, r) { return s + (r.finalCTC   || 0); }, 0);
  const totalAnnual  = valid.reduce(function(s, r) { return s + (r.finalAnnual || 0); }, 0);
  const avgCash      = valid.length ? Math.round(valid.reduce(function(s, r) { return s + (r.cash || 0); }, 0) / valid.length) : 0;
  const avgCTC       = valid.length ? Math.round(totalMonthly / valid.length) : 0;
  const minCTC       = valid.length ? Math.min.apply(null, valid.map(function(r) { return r.finalCTC || 0; })) : 0;
  const maxCTC       = valid.length ? Math.max.apply(null, valid.map(function(r) { return r.finalCTC || 0; })) : 0;
  const totalEpfEmp  = valid.reduce(function(s, r) { return s + (r.epfEmp || 0); }, 0);
  const totalBonus   = valid.reduce(function(s, r) { return s + (r.bonus || 0); }, 0);
  const totalGrat    = valid.reduce(function(s, r) { return s + (r.gratuityUsed || 0); }, 0);
  const totalLeave   = valid.reduce(function(s, r) { return s + (r.leaveUsed || 0); }, 0);
  const withPrevBasic = valid.filter(function(r) { return r.previousBasic !== null && r.previousBasic !== undefined && r.previousBasic > 0; }).length;

  // ── Summary Cards ──
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
      <div class="bulk-sum-card"><div class="bsc-label">Total EPF (Employer)</div><div class="bsc-val">${bulkFmt(totalEpfEmp)}</div></div>
      <div class="bulk-sum-card"><div class="bsc-label">Total Bonus</div><div class="bsc-val">${bulkFmt(totalBonus)}</div></div>
      <div class="bulk-sum-card"><div class="bsc-label">Total Gratuity Prov.</div><div class="bsc-val">${bulkFmt(totalGrat)}</div></div>
      <div class="bulk-sum-card"><div class="bsc-label">Total Leave Prov.</div><div class="bsc-val">${bulkFmt(totalLeave)}</div></div>
      ${withPrevBasic > 0 ? `<div class="bulk-sum-card"><div class="bsc-label">Employees w/ Prev Basic</div><div class="bsc-val amber">${withPrevBasic}/${valid.length}</div></div>` : ''}
    `;
  }

  // ── Table Header ──
  const headEl = document.getElementById('bulkTableHead');
  if (headEl) {
    headEl.innerHTML = `<tr>
      <th>#</th>
      <th>Employee Name</th>
      <th>Emp Code</th>
      <th>Branch</th>
      <th>Month</th>
      <th>Gender</th>
      <th>Prev Basic</th>
      <th>PF</th>
      <th>PF Mode</th>
      <th>PF Wages</th>
      <th>Emp Rate</th>
      <th>Voluntary</th>
      <th>Gross</th>
      <th>Basic</th>
      <th>HRA</th>
      <th>Defray(10%)</th>
      <th>Conveyance</th>
      <th>EPF Employer</th>
      <th>EDLI</th>
      <th>Bonus</th>
      <th>ESI Employer</th>
      <th>Gratuity</th>
      <th>Leave Enc.</th>
      <th>Leaves/Yr</th>
      <th>LWF State</th>
      <th>LWF</th>
      <th>PT State</th>
      <th>PT</th>
      <th>Initial CTC</th>
      <th>Final CTC/Mo</th>
      <th>Annual CTC</th>
      <th>EPF Employee</th>
      <th>ESI Employee</th>
      <th>Cash in Hand</th>
      <th>Status</th>
    </tr>`;
  }

  const monthNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const tot = {};
  const totFields = ['gross','basic','hra','deferAllowance','conv','epfEmp','edliEmployer','bonus','esiEmp','gratuityUsed','leaveUsed','lwf','pt','initialCTC','finalCTC','finalAnnual','epfEe','esiEe','cash','pfWages'];
  totFields.forEach(function(k) { tot[k] = 0; });

  let bodyHtml = '';
  bulkCalcResults.forEach(function(r, i) {
    const alt = i % 2 === 0 ? '' : 'alt-row';

    if (r.error) {
      bodyHtml += '<tr class="error-row ' + alt + '">' +
        '<td style="color:var(--text-muted)">' + r.rowNum + '</td>' +
        '<td class="td-name">' + escapeHtml(r.name) + '</td>' +
        '<td colspan="33" style="font-size:11px;color:var(--danger);padding:8px 12px;">' + escapeHtml(r.error) + '</td>' +
        '<td class="td-err">⚠ Error</td>' +
        '</tr>';
      return;
    }

    totFields.forEach(function(k) { tot[k] += (r[k] || 0); });

    const pfModeBadge = r.pfApplicable === 'Y'
      ? '<span style="font-size:9px;padding:2px 5px;border-radius:4px;background:rgba(99,179,237,0.12);color:var(--accent)">' + (r.pfModeLabel || 'Standard').substring(0, 25) + '</span>'
      : '<span style="color:var(--text-muted);font-size:10px">N/A</span>';

    const volCell = r.pfHasVoluntary
      ? '<span style="color:var(--accent3);font-size:10px">+' + r.pfVolPct + '%</span>'
      : '<span style="color:var(--text-muted);font-size:10px">—</span>';

    const deferCell = r.isHighGross
      ? bulkFmt(r.deferAllowance)
      : '<span style="color:var(--text-muted)">—</span>';

    const edliCell = r.edliEmployer > 0 ? bulkFmt(r.edliEmployer) : '<span style="color:var(--text-muted)">Rs.0</span>';
    const bonusCell = r.bonus > 0 ? bulkFmt(r.bonus) : '<span style="color:var(--text-muted)">—</span>';
    const esiEmpCell = r.esiEmp > 0 ? bulkFmt(r.esiEmp) : '<span style="color:var(--text-muted)">—</span>';
    const esiEeCell  = r.esiEe > 0  ? bulkFmt(r.esiEe)  : '<span style="color:var(--text-muted)">—</span>';
    const epfEeCell  = r.pfApplicable === 'Y' ? '<span style="color:var(--danger)">' + bulkFmt(r.epfEe) + '</span>' : '<span style="color:var(--text-muted)">N/A</span>';

    const lwfStateCell = r.lwfStateName !== 'N/A'
      ? '<span style="font-size:10px;color:' + (r.lwfMode === 'auto' ? 'var(--accent3)' : 'var(--accent2)') + '">' + r.lwfStateName + (r.lwfMode === 'auto' ? ' ●' : ' ○') + '</span>'
      : '<span style="color:var(--text-muted)">—</span>';
    const lwfCell = r.lwf > 0 ? '<span style="color:var(--danger)">' + bulkFmt(r.lwf) + '</span>' : '<span style="color:var(--text-muted)">Rs.0</span>';

    const ptStateCell = r.ptStateName !== 'N/A'
      ? '<span style="font-size:10px;color:' + (r.ptMode === 'auto' ? 'var(--accent3)' : 'var(--accent2)') + '">' + r.ptStateName + (r.ptMode === 'auto' ? ' ●' : ' ○') + '</span>'
      : '<span style="color:var(--text-muted)">—</span>';
    const ptCell = r.pt > 0 ? '<span style="color:var(--danger)">' + bulkFmt(r.pt) + '</span>' : '<span style="color:var(--text-muted)">Rs.0</span>';

    const prevBasicCell = (r.previousBasic !== null && r.previousBasic !== undefined && r.previousBasic > 0)
      ? '<span style="color:var(--accent2);font-weight:500">' + bulkFmt(r.previousBasic) + '</span>'
      : '<span style="color:var(--text-muted)">—</span>';

    const gratuityCell = r.gratuityMode === 'manual'
      ? bulkFmt(r.gratuityUsed) + ' <span style="font-size:9px;color:var(--accent2)">M</span>'
      : bulkFmt(r.gratuityUsed);

    const leaveCell = r.leaveMode === 'manual'
      ? bulkFmt(r.leaveUsed) + ' <span style="font-size:9px;color:var(--accent2)">M</span>'
      : bulkFmt(r.leaveUsed);

    bodyHtml += '<tr class="' + alt + '">' +
      '<td style="color:var(--text-muted)">' + r.rowNum + '</td>' +
      '<td class="td-name">' + escapeHtml(r.name) + '</td>' +
      '<td class="td-name" style="font-size:11px;color:var(--accent)">' + escapeHtml(r.empCode || '—') + '</td>' +
      '<td>' + escapeHtml(r.branch || '—') + '</td>' +
      '<td style="text-align:center;font-size:11px;color:var(--text-dim)">' + (monthNames[r.salaryMonth] || '—') + '</td>' +
      '<td style="text-align:center;font-size:10px;color:var(--text-dim)">' + (r.gender || 'M') + '</td>' +
      '<td class="td-right">' + prevBasicCell + '</td>' +
      '<td class="' + (r.pfApplicable === 'Y' ? 'td-pf-y' : 'td-pf-n') + '">' + r.pfApplicable + '</td>' +
      '<td style="min-width:130px">' + pfModeBadge + '</td>' +
      '<td class="td-right">' + bulkFmt(r.pfWages) + '</td>' +
      '<td class="td-right">' + (r.pfApplicable === 'Y' ? r.pfEmployerRate + '%' : '—') + '</td>' +
      '<td class="td-right">' + volCell + '</td>' +
      '<td class="td-right">' + bulkFmt(r.gross) + '</td>' +
      '<td class="td-right">' + bulkFmt(r.basic) + '</td>' +
      '<td class="td-right">' + bulkFmt(r.hra) + '</td>' +
      '<td class="td-right">' + deferCell + '</td>' +
      '<td class="td-right">' + bulkFmt(r.conv) + '</td>' +
      '<td class="td-right">' + (r.pfApplicable === 'Y' ? bulkFmt(r.epfEmp) : '<span style="color:var(--text-muted)">N/A</span>') + '</td>' +
      '<td class="td-right">' + edliCell + '</td>' +
      '<td class="td-right">' + bonusCell + '</td>' +
      '<td class="td-right">' + esiEmpCell + '</td>' +
      '<td class="td-right">' + gratuityCell + '</td>' +
      '<td class="td-right">' + leaveCell + '</td>' +
      '<td class="td-right" style="font-size:10px;color:var(--text-dim)">' + (r.leavesPerYear || 15) + '</td>' +
      '<td>' + lwfStateCell + '</td>' +
      '<td class="td-right">' + lwfCell + '</td>' +
      '<td>' + ptStateCell + '</td>' +
      '<td class="td-right">' + ptCell + '</td>' +
      '<td class="td-right">' + bulkFmt(r.initialCTC) + '</td>' +
      '<td class="td-right td-ctc">' + bulkFmt(r.finalCTC) + '</td>' +
      '<td class="td-right td-annual">' + bulkFmt(r.finalAnnual) + '</td>' +
      '<td class="td-right">' + epfEeCell + '</td>' +
      '<td class="td-right">' + esiEeCell + '</td>' +
      '<td class="td-right td-cash">' + bulkFmt(r.cash) + '</td>' +
      '<td class="td-ok">✓ Done</td>' +
      '</tr>';
  });

  // ── Total Row ──
  if (valid.length > 0) {
    bodyHtml += '<tr class="total-row">' +
      '<td colspan="12">TOTAL (' + valid.length + ' employees)</td>' +
      '<td class="td-right">' + bulkFmt(tot.gross) + '</td>' +
      '<td class="td-right">' + bulkFmt(tot.basic) + '</td>' +
      '<td class="td-right">' + bulkFmt(tot.hra) + '</td>' +
      '<td class="td-right">' + bulkFmt(tot.deferAllowance) + '</td>' +
      '<td class="td-right">' + bulkFmt(tot.conv) + '</td>' +
      '<td class="td-right">' + bulkFmt(tot.epfEmp) + '</td>' +
      '<td class="td-right">' + bulkFmt(tot.edliEmployer) + '</td>' +
      '<td class="td-right">' + bulkFmt(tot.bonus) + '</td>' +
      '<td class="td-right">' + bulkFmt(tot.esiEmp) + '</td>' +
      '<td class="td-right">' + bulkFmt(tot.gratuityUsed) + '</td>' +
      '<td class="td-right">' + bulkFmt(tot.leaveUsed) + '</td>' +
      '<td></td>' +
      '<td></td><td class="td-right">' + bulkFmt(tot.lwf) + '</td>' +
      '<td></td><td class="td-right">' + bulkFmt(tot.pt) + '</td>' +
      '<td class="td-right">' + bulkFmt(tot.initialCTC) + '</td>' +
      '<td class="td-right td-ctc">' + bulkFmt(tot.finalCTC) + '</td>' +
      '<td class="td-right td-annual">' + bulkFmt(tot.finalAnnual) + '</td>' +
      '<td class="td-right">' + bulkFmt(tot.epfEe) + '</td>' +
      '<td class="td-right">' + bulkFmt(tot.esiEe) + '</td>' +
      '<td class="td-right td-cash">' + bulkFmt(tot.cash) + '</td>' +
      '<td>—</td>' +
      '</tr>';
  }

  const bodyEl = document.getElementById('bulkTableBody');
  if (bodyEl) bodyEl.innerHTML = bodyHtml;
  const resultsSection = document.getElementById('bulkResultsSection');
  if (resultsSection) resultsSection.style.display = 'block';

  setBulkStatus(errors > 0 ? 'info' : 'success',
    '✓ Done! ' + valid.length + ' calculated' + (errors > 0 ? ', ' + errors + ' error(s)' : '') +
    ' | ● = Auto State-wise  ○ = Manual  M = Manual Override');

  // ── INJECT SEARCH BAR after table is rendered ──
  injectBulkSearchBar();
}

// ===================================================================
//  ✅ BULK EXPORT CSV
// ===================================================================
function bulkExportCSV() {
  if (!bulkCalcResults.length) { showToast('⚠️ Calculate first'); return; }
  
  function cell(v) { return '"' + String(v !== null && v !== undefined ? v : '').replace(/"/g, '""') + '"'; }
  function amt(n)  { return (n && !isNaN(n)) ? Math.round(n) : 0; }
  
  const now = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const monthNames = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

  const metaRows = [
    ['BULK CTC SALARY REPORT — NEW LABOUR CODE'],
    ['Date: ' + now],
    ['Note: ● = Auto State-wise  ○ = Manual Input  M = Manual Override'],
    [''],
  ];

  const headers = [
    'Sr. No.', 'Employee Name', 'Employee Code', 'Branch', 'Salary Month', 'Gender',
    'Previous Basic (Rs.)', 'PF Status', 'PF Mode', 'PF Wages (Rs.)', 'Employer PF Rate', 'Voluntary PF %',
    'Gross Salary', 'Basic Salary', 'HRA',
    'Defray Expenses 10% (High Gross)', 'Conveyance',
    'EPF – Employer (Rs.)', 'EDLI – Employer (Rs.)', 'Bonus (Rs.)', 'ESI – Employer (Rs.)',
    'Gratuity (Rs.)', 'Gratuity Mode', 'Leave Encashment (Rs.)', 'Leave Mode', 'Leaves Per Year',
    'LWF State', 'LWF Mode', 'LWF Amount (Rs.)',
    'PT State', 'PT Mode', 'Professional Tax (Rs.)',
    'Initial CTC (Monthly)', 'Final CTC (Monthly)', 'Final CTC (Annual)',
    'EPF – Employee (Rs.)', 'ESI – Employee (Rs.)', 'Net Cash in Hand (Rs.)',
    'Status'
  ];

  const dataRows = bulkCalcResults.map(function(r) {
    if (r.error) {
      const blanks = new Array(headers.length - 3).fill('');
      return [r.rowNum, r.name, r.empCode || '', r.branch || '', '', '', '', ...blanks, 'Error: ' + r.error];
    }
    
    const prevBasicVal = (r.previousBasic !== null && r.previousBasic !== undefined && r.previousBasic > 0) 
      ? amt(r.previousBasic) : 'N/A';
    
    return [
      r.rowNum, r.name, r.empCode || '', r.branch || '',
      monthNames[r.salaryMonth] || r.salaryMonth || '',
      r.gender || 'Male',
      prevBasicVal,
      r.pfApplicable === 'Y' ? 'Applicable' : 'Not Applicable',
      r.pfApplicable === 'Y' 
        ? (r.pfBaseUsed === 'standard' ? 'Standard (min Basic,15k)' 
          : r.pfBaseUsed === 'full_basic' ? 'Full Basic' 
          : 'Specific Amount') 
        : 'N/A',
      r.pfApplicable === 'Y' ? amt(r.pfWages) : 'N/A',
      r.pfApplicable === 'Y' ? r.pfEmployerRate + '%' : 'N/A',
      r.pfHasVoluntary ? r.pfVolPct + '%' : '0%',
      amt(r.gross), amt(r.basic), amt(r.hra),
      r.isHighGross ? amt(r.deferAllowance) : 'N/A',
      amt(r.conv),
      r.pfApplicable === 'Y' ? amt(r.epfEmp) : 'N/A',
      r.edliEmployer > 0 ? amt(r.edliEmployer) : 0,
      r.bonus > 0 ? amt(r.bonus) : 0,
      r.esiEmp > 0 ? amt(r.esiEmp) : 0,
      amt(r.gratuityUsed), r.gratuityMode === 'manual' ? 'Manual' : 'Auto (Formula)',
      amt(r.leaveUsed), r.leaveMode === 'manual' ? 'Manual' : 'Auto (Formula)',
      r.leavesPerYear || 15,
      r.lwfStateName || 'N/A', r.lwfMode === 'auto' ? 'Auto (State-wise)' : 'Manual',
      r.lwf > 0 ? amt(r.lwf) : 0,
      r.ptStateName || 'N/A', r.ptMode === 'auto' ? 'Auto (State-wise)' : 'Manual',
      r.pt > 0 ? amt(r.pt) : 0,
      amt(r.initialCTC), amt(r.finalCTC), amt(r.finalAnnual),
      r.pfApplicable === 'Y' ? amt(r.epfEe) : 'N/A',
      r.esiEe > 0 ? amt(r.esiEe) : 0,
      amt(r.cash),
      'Calculated'
    ];
  });

  const valid = bulkCalcResults.filter(function(r) { return !r.error; });
  
  const totRow = [
    'TOTAL (' + valid.length + ')', '', '', '', '', '', 'N/A', '', '', '', '', '',
    valid.reduce(function(s,r){ return s+amt(r.gross); }, 0),
    valid.reduce(function(s,r){ return s+amt(r.basic); }, 0),
    valid.reduce(function(s,r){ return s+amt(r.hra); }, 0),
    valid.reduce(function(s,r){ return s+(r.isHighGross?amt(r.deferAllowance):0); }, 0),
    valid.reduce(function(s,r){ return s+amt(r.conv); }, 0),
    valid.reduce(function(s,r){ return s+amt(r.epfEmp); }, 0),
    valid.reduce(function(s,r){ return s+amt(r.edliEmployer); }, 0),
    valid.reduce(function(s,r){ return s+amt(r.bonus); }, 0),
    valid.reduce(function(s,r){ return s+amt(r.esiEmp); }, 0),
    valid.reduce(function(s,r){ return s+amt(r.gratuityUsed); }, 0), '',
    valid.reduce(function(s,r){ return s+amt(r.leaveUsed); }, 0), '', '',
    '', '', valid.reduce(function(s,r){ return s+amt(r.lwf); }, 0),
    '', '', valid.reduce(function(s,r){ return s+amt(r.pt); }, 0),
    valid.reduce(function(s,r){ return s+amt(r.initialCTC); }, 0),
    valid.reduce(function(s,r){ return s+amt(r.finalCTC); }, 0),
    valid.reduce(function(s,r){ return s+amt(r.finalAnnual); }, 0),
    valid.reduce(function(s,r){ return s+amt(r.epfEe); }, 0),
    valid.reduce(function(s,r){ return s+amt(r.esiEe); }, 0),
    valid.reduce(function(s,r){ return s+amt(r.cash); }, 0),
    ''
  ];

  const allRows = metaRows.concat([headers]).concat(dataRows).concat([totRow]);
  const csv = allRows.map(function(row) {
    return (Array.isArray(row) ? row : [row]).map(function(c) { return cell(c); }).join(',');
  }).join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'Bulk_CTC_Report_' + new Date().toISOString().slice(0, 10) + '.csv';
  link.click();
  showBulkExportStatus('✓ CSV Downloaded!');
  showToast('✓ Bulk CSV Downloaded');
}

// ── Bulk Export TXT ──
function bulkExportTXT() {
  if (!bulkCalcResults.length) { showToast('⚠️ Calculate first'); return; }
  
  const valid        = bulkCalcResults.filter(function(r) { return !r.error; });
  const now          = new Date().toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' });
  const totalMonthly = valid.reduce(function(s, r) { return s + (r.finalCTC    || 0); }, 0);
  const totalAnnual  = valid.reduce(function(s, r) { return s + (r.finalAnnual || 0); }, 0);
  const monthNames   = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

  function padR(s, n) { s = String(s); return s.length >= n ? s.slice(0,n) : s + ' '.repeat(n - s.length); }
  function padL(s, n) { s = String(s); return s.length >= n ? s.slice(0,n) : ' '.repeat(n - s.length) + s; }
  const SEP  = '+' + '-'.repeat(36) + '+' + '-'.repeat(18) + '+';
  function tableRow(label, val) { return '| ' + padR(label,35) + '| ' + padL(val,17) + '|\n'; }

  let txt = '═'.repeat(60) + '\n';
  txt += '   BULK CTC SALARY REPORT — NEW LABOUR CODE\n';
  txt += '═'.repeat(60) + '\n';
  txt += '  Date              : ' + now + '\n';
  txt += '  Total Employees   : ' + bulkCalcResults.length + '\n';
  txt += '  Calculated        : ' + valid.length + '\n';
  txt += '  Errors            : ' + (bulkCalcResults.length - valid.length) + '\n';
  txt += '  Total Monthly CTC : ' + bulkFmt(totalMonthly) + '\n';
  txt += '  Total Annual CTC  : ' + bulkFmt(totalAnnual) + '\n';
  txt += '  ● = Auto State-wise  ○ = Manual  M = Manual Override\n';
  txt += '═'.repeat(60) + '\n\n';

  valid.forEach(function(r, i) {
    txt += '┌' + '─'.repeat(58) + '┐\n';
    txt += '│  ' + padR((i+1) + '. ' + r.name, 56) + '│\n';
    txt += '│  Emp Code: ' + padR((r.empCode || 'N/A'), 48) + '│\n';
    txt += '│  Branch  : ' + padR((r.branch  || 'N/A'), 48) + '│\n';
    txt += '│  Month: ' + padR((monthNames[r.salaryMonth] || '—'), 50) + '│\n';
    txt += '│  Gender: ' + padR((r.gender || 'Male'), 49) + '│\n';
    
    if (r.previousBasic !== null && r.previousBasic !== undefined && r.previousBasic > 0) {
      txt += '│  Previous Basic: Rs.' + padR(Math.round(r.previousBasic).toLocaleString('en-IN'), 36) + '│\n';
    }
    
    txt += '│  PF: ' + padR((r.pfApplicable === 'Y' ? 'Applicable | ' + (r.pfModeLabel||'Standard') : 'Not Applicable'), 52) + '│\n';
    txt += '│  LWF: ' + padR((r.lwfStateName || 'N/A') + ' (' + (r.lwfMode === 'auto' ? '● Auto' : '○ Manual') + ')', 51) + '│\n';
    txt += '│  PT:  ' + padR((r.ptStateName || 'N/A') + ' (' + (r.ptMode === 'auto' ? '● Auto' : '○ Manual') + ')', 51) + '│\n';
    txt += '└' + '─'.repeat(58) + '┘\n';
    
    txt += SEP + '\n';
    txt += tableRow('SALARY STRUCTURE', '');
    txt += SEP + '\n';
    txt += tableRow('Basic Salary', bulkFmt(r.basic));
    txt += tableRow('HRA (50% of Basic)', bulkFmt(r.hra));
    if (r.isHighGross) txt += tableRow('Defray Expenses (10%)', bulkFmt(r.deferAllowance));
    txt += tableRow('Conveyance', bulkFmt(r.conv));
    txt += tableRow('Gross Salary', bulkFmt(r.gross));
    
    txt += SEP + '\n';
    txt += tableRow('EMPLOYER CONTRIBUTIONS', '');
    txt += SEP + '\n';
    txt += tableRow('EPF – Employer (' + (r.pfEmployerRate||'12.5') + '%) ' + (r.pfApplicable !== 'Y' ? '[N/A]' : ''), r.pfApplicable === 'Y' ? bulkFmt(r.epfEmp) : 'N/A');
    txt += tableRow('EDLI – Employer', r.edliEmployer > 0 ? bulkFmt(r.edliEmployer) : 'Rs.0');
    txt += tableRow('Bonus (8.33% of MinWage, Basic≤21k)', r.bonus > 0 ? bulkFmt(r.bonus) : 'N/A');
    txt += tableRow('Initial CTC', bulkFmt(r.initialCTC));
    txt += tableRow('ESI – Employer (3.25%)', r.esiEmp > 0 ? bulkFmt(r.esiEmp) : 'N/A');
    txt += tableRow('Gratuity (' + (r.gratuityMode === 'manual' ? 'M-Manual' : 'Auto') + ')', bulkFmt(r.gratuityUsed));
    txt += tableRow('Leave Enc. (' + (r.leavesPerYear||15) + ' leaves/yr, ' + (r.leaveMode === 'manual' ? 'M-Manual' : 'Auto') + ')', bulkFmt(r.leaveUsed));
    txt += tableRow('LWF – ' + (r.lwfStateName||'N/A') + ' (' + (r.lwfMode==='auto'?'● Auto':'○ Manual') + ')', r.lwf > 0 ? bulkFmt(r.lwf) : 'N/A');
    
    txt += SEP + '\n';
    txt += tableRow('EMPLOYEE DEDUCTIONS', '');
    txt += SEP + '\n';
    txt += tableRow('EPF – Employee (12%' + (r.pfHasVoluntary ? '+' + r.pfVolPct + '% Vol' : '') + ')', r.pfApplicable === 'Y' ? bulkFmt(r.epfEe) : 'N/A');
    txt += tableRow('ESI – Employee (0.75%)', r.esiEe > 0 ? bulkFmt(r.esiEe) : 'N/A');
    txt += tableRow('Professional Tax – ' + (r.ptStateName||'N/A') + ' (' + (r.ptMode==='auto'?'● Auto':'○ Manual') + ')', r.pt > 0 ? bulkFmt(r.pt) : 'N/A');
    txt += tableRow('LWF – Employee', r.lwf > 0 ? bulkFmt(r.lwf) : 'N/A');
    
    txt += SEP + '\n';
    txt += tableRow('FINAL SUMMARY', '');
    txt += SEP + '\n';
    txt += tableRow('Final CTC (Monthly)', bulkFmt(r.finalCTC));
    txt += tableRow('Final CTC (Annual)', bulkFmt(r.finalAnnual));
    txt += tableRow('NET CASH IN HAND', bulkFmt(r.cash));
    txt += SEP + '\n\n';
  });

  if (bulkCalcResults.some(function(r) { return r.error; })) {
    txt += '\nERRORS:\n' + '─'.repeat(60) + '\n';
    bulkCalcResults.filter(function(r) { return r.error; }).forEach(function(r) {
      txt += '  Row ' + r.rowNum + ': ' + r.name + ' — ' + r.error + '\n';
    });
  }

  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'Bulk_CTC_Summary_' + new Date().toISOString().slice(0,10) + '.txt';
  link.click();
  showBulkExportStatus('✓ TXT Downloaded!');
  showToast('✓ Summary TXT Downloaded');
}

// ── Bulk Copy Clipboard ──
function bulkCopyClipboard() {
  if (!bulkCalcResults.length) { showToast('⚠️ Calculate first'); return; }
  
  const valid = bulkCalcResults.filter(function(r) { return !r.error; });
  const monthNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  
  const headers = [
    '#', 'Employee Name', 'Employee Code', 'Branch', 'Month', 'Gender', 'Prev Basic',
    'PF Status', 'PF Mode', 'PF Wages', 'Emp Rate', 'Voluntary %',
    'Gross', 'Basic', 'HRA', 'Defray(10%)', 'Conveyance',
    'EPF Employer', 'EDLI', 'Bonus', 'ESI Employer',
    'Gratuity', 'Grat Mode', 'Leave Enc.', 'Leave Mode', 'Leaves/Yr',
    'LWF State', 'LWF Mode', 'LWF',
    'PT State', 'PT Mode', 'PT',
    'Initial CTC', 'Final CTC/Mo', 'Annual CTC',
    'EPF Employee', 'ESI Employee', 'Net Cash in Hand'
  ];
  
  const rows = valid.map(function(r, i) {
    const prevBasicVal = (r.previousBasic !== null && r.previousBasic !== undefined && r.previousBasic > 0) 
      ? Math.round(r.previousBasic) : 'N/A';
    
    return [
      i+1, r.name, r.empCode || '', r.branch || '',
      monthNames[r.salaryMonth] || '', r.gender || 'Male',
      prevBasicVal,
      r.pfApplicable === 'Y' ? 'Applicable' : 'Not Applicable',
      r.pfApplicable === 'Y' 
        ? (r.pfBaseUsed === 'standard' ? 'Standard' 
          : r.pfBaseUsed === 'full_basic' ? 'Full Basic' 
          : 'Specific Amt') 
        : 'N/A',
      r.pfApplicable === 'Y' ? Math.round(r.pfWages) : 'N/A',
      r.pfEmployerRate + '%',
      r.pfHasVoluntary ? r.pfVolPct + '%' : '0%',
      Math.round(r.gross), Math.round(r.basic), Math.round(r.hra),
      r.isHighGross ? Math.round(r.deferAllowance) : 'N/A', 
      Math.round(r.conv),
      r.pfApplicable === 'Y' ? Math.round(r.epfEmp) : 'N/A',
      r.edliEmployer > 0 ? Math.round(r.edliEmployer) : 0,
      r.bonus > 0 ? Math.round(r.bonus) : 0,
      r.esiEmp > 0 ? Math.round(r.esiEmp) : 0,
      Math.round(r.gratuityUsed), r.gratuityMode === 'manual' ? 'Manual' : 'Auto',
      Math.round(r.leaveUsed), r.leaveMode === 'manual' ? 'Manual' : 'Auto',
      r.leavesPerYear || 15,
      r.lwfStateName || 'N/A', r.lwfMode === 'auto' ? 'Auto' : 'Manual',
      r.lwf > 0 ? Math.round(r.lwf) : 0,
      r.ptStateName || 'N/A', r.ptMode === 'auto' ? 'Auto' : 'Manual',
      r.pt > 0 ? Math.round(r.pt) : 0,
      Math.round(r.initialCTC), Math.round(r.finalCTC), Math.round(r.finalAnnual),
      r.pfApplicable === 'Y' ? Math.round(r.epfEe) : 'N/A',
      r.esiEe > 0 ? Math.round(r.esiEe) : 0,
      Math.round(r.cash)
    ].join('\t');
  });
  
  const text = [headers.join('\t')].concat(rows).join('\n');
  
  navigator.clipboard.writeText(text)
    .then(function() { 
      showBulkExportStatus('✓ Copied!'); 
      showToast('⎘ Bulk data copied to clipboard'); 
    })
    .catch(function() { 
      showToast('⚠️ Copy failed'); 
    });
}

// ── Bulk Template Download ──
function bulkDownloadTemplate() {
  const csv = [
    'Employee Name,Employee Code,Branch,Gross Salary,Min Wage,Previous Basic,PF (Y/N),PF Mode,Voluntary PF,Voluntary PF %,Specific PF Amount,Employer PF Rate,PT State,LWF State,Salary Month,Gender,Gratuity,Leave Encashment Amount,Leaves per Year',
    'Rahul Sharma,EMP001,Mumbai-HO,30000,16868,14000,Y,standard,N,,0,12.5,KA,FKL,12,Male,,,15',
    'Priya Verma,EMP002,Delhi-Branch,45000,16868,20000,Y,full_basic,N,,0,12,MH,MH,12,Male,,500,18',
    'Amit Patel,EMP003,Bangalore-Site,55000,16868,,N,standard,N,,0,12.5,,OTHER,12,Male,,,,15',
    'Neha Singh,EMP004,Chennai-Branch,60000,16868,30000,Y,standard,Y,5,0,12.5,GJ,OTHER,6,Female,,,20',
    'Vikram Gupta,EMP005,Hyderabad-Unit,25000,16868,12000,Y,specific_amt,N,,15000,12,AP,AP,12,Male,,,15',
    'Sunita Kumar,EMP006,Pune-Branch,50000,14000,22000,Y,full_basic,Y,3,0,12.5,TS,OTHER,12,Female,,500,200,12',
    'Rajesh Mehta,EMP007,Mumbai-HO,120000,15860,50000,Y,full_basic,N,,0,12,KA,FKL,12,Male,,,15',
    'Pooja Joshi,EMP008,Kolkata-Branch,150000,16868,60000,Y,specific_amt,Y,10,20000,12.5,WB,WB,6,Female,,800,,18',
    'Arun Rao,EMP009,Coimbatore-Site,80000,16868,,N,standard,N,,0,12.5,TN,TN,12,Male,,,15',
    'Kavita Nair,EMP010,Tirupati-Branch,15000,14858,13000,Y,standard,N,,0,12,TS,,12,Male,,,15',
    'Mohan Das,EMP011,Thiruvananthapuram,35000,16000,18000,Y,standard,N,,0,12.5,KL,SKL,6,Male,,,21',
    'Ritu Sharma,EMP012,Jaipur-Branch,42000,16868,20000,Y,full_basic,N,,0,12,OD,OD,12,Female,,,15',
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'CTC_Bulk_Upload_Template_v14.csv';
  link.click();
  showToast('✓ Template v14 Downloaded');
}

function resetBulk() {
  bulkRawData     = [];
  bulkCalcResults = [];
  const actionRow      = document.getElementById('bulkActionRow');
  const resultsSection = document.getElementById('bulkResultsSection');
  const progressWrap   = document.getElementById('bulkProgressWrap');
  const statusEl       = document.getElementById('bulkStatus');
  const progressFill   = document.getElementById('bulkProgressFill');
  if (actionRow)      actionRow.style.display      = 'none';
  if (resultsSection) resultsSection.style.display = 'none';
  if (progressWrap)   progressWrap.style.display   = 'none';
  if (statusEl)       statusEl.style.display       = 'none';
  if (progressFill)   progressFill.style.width     = '0%';
  
  // ── Remove search bar on reset ──
  const searchBar = document.getElementById('bulkSearchBar');
  if (searchBar) searchBar.remove();
  const noResults = document.getElementById('bulkNoResults');
  if (noResults) noResults.remove();
  
  initBulkTab();
  showToast('↺ Bulk upload reset');
}

function setBulkStatus(type, msg) {
  const el = document.getElementById('bulkStatus');
  if (!el) return;
  el.textContent   = msg;
  el.className     = 'bulk-status ' + type;
  el.style.display = 'block';
}

function showBulkExportStatus(msg) {
  const el = document.getElementById('bulkExportStatus');
  if (!el) return;
  el.textContent = msg;
  setTimeout(function() { el.textContent = ''; }, 3000);
}