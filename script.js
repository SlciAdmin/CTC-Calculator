/* ============================================
   CTC CALCULATOR — JAVASCRIPT LOGIC
   New Labour Code (New Labour Law 2024)
   Formula Source: BULK_CTC_AUTOMATION excel
   ============================================ */

/* ---- STATE ---- */
let pfApplicable = 'Y';
let calcResult = null;

// Default Gratuity & Leave Component formula modes
// 'auto' = formula based, 'manual' = user override
let gratuityMode = 'auto';
let leaveMode = 'auto';

/* ---- PF TOGGLE ---- */
function setPF(val) {
  pfApplicable = val;
  document.getElementById('pfYes').classList.toggle('active', val === 'Y');
  document.getElementById('pfNo').classList.toggle('active', val === 'N');

  const hint = document.getElementById('pfHint');
  if (val === 'Y') {
    hint.textContent = '55% of Gross or Min Wage (whichever is higher) → Basic';
  } else {
    hint.textContent = '53% of Gross or Min Wage (whichever is higher) → Basic';
  }
  liveCalc();
}

/* ---- GRATUITY MODE TOGGLE ---- */
function setGratuityMode(mode) {
  gratuityMode = mode;
  const autoBtn = document.getElementById('gratuityAuto');
  const manualBtn = document.getElementById('gratuityManual');
  const manualInput = document.getElementById('gratuityManualWrapper');
  const hint = document.getElementById('gratuityHint');

  autoBtn.classList.toggle('active', mode === 'auto');
  manualBtn.classList.toggle('active', mode === 'manual');

  if (mode === 'manual') {
    manualInput.classList.remove('hidden');
    hint.textContent = 'Enter custom monthly gratuity amount';
  } else {
    manualInput.classList.add('hidden');
    hint.textContent = 'Formula: Basic ÷ 26 × 15 ÷ 12 (monthly provision)';
  }
  liveCalc();
}

/* ---- LEAVE MODE TOGGLE ---- */
function setLeaveMode(mode) {
  leaveMode = mode;
  const autoBtn = document.getElementById('leaveAuto');
  const manualBtn = document.getElementById('leaveManual');
  const manualInput = document.getElementById('leaveManualWrapper');
  const hint = document.getElementById('leaveHint');

  autoBtn.classList.toggle('active', mode === 'auto');
  manualBtn.classList.toggle('active', mode === 'manual');

  if (mode === 'manual') {
    manualInput.classList.remove('hidden');
    hint.textContent = 'Enter custom monthly leave encashment amount';
  } else {
    manualInput.classList.add('hidden');
    hint.textContent = 'Formula: Basic ÷ 26 × 1.25 (monthly provision for 15 leaves/yr)';
  }
  liveCalc();
}

/* ---- MAIN FORMULA ENGINE ---- */
function computeCTC(gross, minWage, pf, pt, lwf, gratuityOverride, leaveOverride) {
  gross = Math.round(gross);
  minWage = Math.round(minWage);

  // ──────────────────────────────────────────
  // BASIC CALCULATION (New Labour Law Rule)
  // PF Yes: MAX(55% of gross, minWage)
  // PF No:  MAX(53% of gross, minWage)
  // ──────────────────────────────────────────
  let basicPct = pf === 'Y' ? 0.55 : 0.53;
  let basicFromGross = Math.round(gross * basicPct);
  let basic = Math.max(basicFromGross, minWage);

  // Cap basic at gross (cannot exceed gross)
  basic = Math.min(basic, gross);

  // ──────────────────────────────────────────
  // HRA = 50% of Basic
  // ──────────────────────────────────────────
  let hra = Math.round(basic * 0.5);

  // ──────────────────────────────────────────
  // CONVEYANCE = Gross - Basic - HRA (residual)
  // ──────────────────────────────────────────
  let conv = Math.max(gross - basic - hra, 0);

  // Re-check: if basic + hra > gross, reduce hra
  if (basic + hra > gross) {
    hra = gross - basic;
    conv = 0;
  }

  // ──────────────────────────────────────────
  // EPF EMPLOYER @ 12.5% of Basic (capped at ₹1875)
  // ──────────────────────────────────────────
  let epfEmployer = pf === 'Y' ? Math.min(Math.round(basic * 0.125), 1875) : 0;

  // ──────────────────────────────────────────
  // EDLI EMPLOYER @ 0.5% of Basic (capped at ₹75)
  // ──────────────────────────────────────────
  let edliEmployer = pf === 'Y' ? Math.min(Math.round(basic * 0.005), 75) : 0;

  // ──────────────────────────────────────────
  // BONUS: Applicable only if Basic ≤ 21,000
  // Bonus = 8.33% of Min Wage
  // ──────────────────────────────────────────
  let bonus = basic <= 21000 ? Math.round(minWage * 0.0833) : 0;

  // ──────────────────────────────────────────
  // INITIAL CTC = Gross + EPF Employer + EDLI + Bonus
  // ──────────────────────────────────────────
  let initialCTC = gross + epfEmployer + edliEmployer + bonus;

  // ──────────────────────────────────────────
  // ESI EMPLOYER @ 3.25% of Gross (only if Gross ≤ 21,000)
  // ──────────────────────────────────────────
  let esiEmployer = basic <= 21000 ? Math.round(basic * 0.0325) : 0;

  // ──────────────────────────────────────────
  // GRATUITY — Auto or Manual Override
  // Auto: Basic / 26 * 15 / 12 (monthly provision)
  // Manual: User-entered value
  // ──────────────────────────────────────────
  let gratuityAuto = Math.round((basic / 26) * 15 / 12);
  let gratuity = (gratuityOverride !== null && gratuityOverride >= 0)
    ? Math.round(gratuityOverride)
    : gratuityAuto;

  // ──────────────────────────────────────────
  // LEAVE COMPONENT — Auto or Manual Override
  // Auto: Basic / 26 * 1.25 (monthly provision)
  // Manual: User-entered value
  // ──────────────────────────────────────────
  let leaveAuto = Math.round((basic / 26) * 1.25);
  let leaveComponent = (leaveOverride !== null && leaveOverride >= 0)
    ? Math.round(leaveOverride)
    : leaveAuto;

  // ──────────────────────────────────────────
  // FINAL CTC = Initial CTC + ESI Employer + Gratuity + LWF + Leave
  // ──────────────────────────────────────────
  let finalCTC = initialCTC + esiEmployer + gratuity + lwf + leaveComponent;

  // ──────────────────────────────────────────
  // EMPLOYEE DEDUCTIONS
  // ──────────────────────────────────────────
  // EPF Employee @ 12% of Basic (capped at ₹1800)
  let epfEmployee = pf === 'Y' ? Math.min(Math.round(basic * 0.12), 1800) : 0;

  // ESI Employee @ 0.75% of Gross (only if gross ≤ 21000)
  let esiEmployee = basic <= 21000 ? Math.round(basic * 0.0075) : 0;

  // LWF Employee (passed as input)
  let lwfEmployee = lwf;

  // PT (Professional Tax — state specific, passed as input)
  let ptDeduction = pt;

  // ──────────────────────────────────────────
  // CASH IN HAND = Gross - EPF Employee - ESI Employee - LWF - PT
  // ──────────────────────────────────────────
  let cashInHand = gross - epfEmployee - esiEmployee - lwfEmployee - ptDeduction;

  return {
    gross,
    basic,
    hra,
    conv,
    minWage,
    pfApplicable: pf,
    // Employer
    epfEmployer,
    edliEmployer,
    bonus,
    initialCTC,
    esiEmployer,
    gratuity,
    gratuityAuto,
    leaveComponent,
    leaveAuto,
    lwf,
    finalCTC,
    finalCTCAnnual: finalCTC * 12,
    // Employee
    epfEmployee,
    esiEmployee,
    lwfEmployee,
    ptDeduction,
    cashInHand,
    // Mode flags
    gratuityMode: (gratuityOverride !== null && gratuityOverride >= 0) ? 'manual' : 'auto',
    leaveMode: (leaveOverride !== null && leaveOverride >= 0) ? 'manual' : 'auto',
  };
}

/* ---- UPDATE GRATUITY PLACEHOLDER (live formula preview) ---- */
function updateGratuityPlaceholder() {
  const gross = parseFloat(document.getElementById('grossSalary').value) || 0;
  const minWage = parseFloat(document.getElementById('minWage').value) || 0;
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

/* ---- UPDATE LEAVE PLACEHOLDER (live formula preview) ---- */
function updateLeavePlaceholder() {
  const gross = parseFloat(document.getElementById('grossSalary').value) || 0;
  const minWage = parseFloat(document.getElementById('minWage').value) || 0;
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

/* ---- LIVE CALC (on input change) ---- */
function liveCalc() {
  updateGratuityPlaceholder();
  updateLeavePlaceholder();

  const gross = parseFloat(document.getElementById('grossSalary').value) || 0;
  const minWage = parseFloat(document.getElementById('minWage').value) || 0;
  if (gross > 0 && minWage > 0) {
    calculate(true);
  }
}

/* ---- MAIN CALCULATE ---- */
function calculate(silent = false) {
  const gross = parseFloat(document.getElementById('grossSalary').value) || 0;
  const minWage = parseFloat(document.getElementById('minWage').value) || 0;
  const pt = parseFloat(document.getElementById('ptAmount').value) || 0;
  const lwf = parseFloat(document.getElementById('lwfAmount').value) || 0;

  if (gross <= 0 || minWage <= 0) {
    if (!silent) showToast('⚠️ Please enter Gross Salary and Minimum Wage');
    return;
  }

  // Gratuity override
  let gratuityOverride = null;
  if (gratuityMode === 'manual') {
    const val = parseFloat(document.getElementById('gratuityCustom').value);
    if (!isNaN(val) && val >= 0) gratuityOverride = val;
  }

  // Leave override
  let leaveOverride = null;
  if (leaveMode === 'manual') {
    const val = parseFloat(document.getElementById('leaveCustom').value);
    if (!isNaN(val) && val >= 0) leaveOverride = val;
  }

  const r = computeCTC(gross, minWage, pfApplicable, pt, lwf, gratuityOverride, leaveOverride);
  calcResult = r;

  renderSummary(r);
  renderBreakdown(r);
  renderExportPreview(r);

  if (!silent) showToast('✓ CTC Calculated Successfully');
}

/* ---- CURRENCY FORMAT ---- */
function fmt(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function pct(part, total) {
  if (!total) return '0%';
  return (part / total * 100).toFixed(1) + '%';
}

/* ---- RENDER SUMMARY ---- */
function renderSummary(r) {
  document.getElementById('summaryEmpty').classList.add('hidden');
  document.getElementById('summaryResults').classList.remove('hidden');

  document.getElementById('r_initialCTC').textContent = fmt(r.initialCTC);

  document.getElementById('annualCTC').textContent = fmt(r.finalCTCAnnual);
  document.getElementById('monthlyCTC').textContent = fmt(r.finalCTC);
  document.getElementById('r_basic').textContent = fmt(r.basic);
  document.getElementById('r_hra').textContent = fmt(r.hra);
  document.getElementById('r_conv').textContent = fmt(r.conv);
  document.getElementById('r_gross').textContent = fmt(r.gross);
  document.getElementById('r_cash').textContent = fmt(r.cashInHand);
  document.getElementById('r_bonus').textContent = r.bonus > 0 ? fmt(r.bonus) : 'N/A';
}

/* ---- RENDER BREAKDOWN ---- */
function renderBreakdown(r) {
  document.getElementById('breakdownEmpty').classList.add('hidden');
  document.getElementById('breakdownContent').classList.remove('hidden');

  // Salary Structure
  const salRows = [
    ['Basic', r.basic],
    ['HRA (50% of Basic)', r.hra],
    ['Conveyance / Other', r.conv],
  ];
  let salHtml = '';
  salRows.forEach(([label, val]) => {
    salHtml += `<tr>
      <td>${label}</td>
      <td>${fmt(val)}</td>
      <td>${pct(val, r.gross)}</td>
    </tr>`;
  });
  document.getElementById('salaryTable').innerHTML = salHtml;
  document.getElementById('tfoot_gross').textContent = fmt(r.gross);

  // Employer Contributions
  const empRows = [
    ['EPF – Employer @ 12.5% of Basic', '12.5% (max ₹1,875)', r.epfEmployer],
    ['EDLI – Employer @ 0.5% upto ₹15,000', '0.5% (max ₹75)', r.edliEmployer],
    ['Bonus (8.33% of Min Wage, if Basic ≤ ₹21,000)', '8.33%', r.bonus],
  ];
  let empHtml = '';
  empRows.forEach(([label, rate, val]) => {
    empHtml += `<tr>
      <td>${label}</td>
      <td style="color:var(--text-dim)">${rate}</td>
      <td>${val > 0 ? fmt(val) : '<span style="color:var(--text-muted)">—</span>'}</td>
    </tr>`;
  });
  document.getElementById('employerTable').innerHTML = empHtml;
  document.getElementById('tfoot_initialCTC').textContent = fmt(r.initialCTC);

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
    dedHtml += `<tr>
      <td>${label}</td>
      <td style="color:var(--text-dim)">${rate}</td>
      <td>${dispVal}</td>
    </tr>`;
  });
  document.getElementById('deductionTable').innerHTML = dedHtml;
  document.getElementById('tfoot_cash').textContent = fmt(r.cashInHand);

  // Final Items
  const empName = document.getElementById('empName').value.trim() || 'Employee';

  const gratuityLabel = r.gratuityMode === 'manual'
    ? `Gratuity <span style="font-size:9px;color:var(--accent2);font-weight:600;background:rgba(159,122,234,0.15);padding:2px 6px;border-radius:4px;margin-left:4px;">CUSTOM</span>`
    : `Gratuity <span style="font-size:9px;color:var(--text-muted);font-weight:600;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;margin-left:4px;">AUTO</span>`;

  const leaveLabel = r.leaveMode === 'manual'
    ? `Leave Component <span style="font-size:9px;color:var(--accent2);font-weight:600;background:rgba(159,122,234,0.15);padding:2px 6px;border-radius:4px;margin-left:4px;">CUSTOM</span>`
    : `Leave Component <span style="font-size:9px;color:var(--text-muted);font-weight:600;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;margin-left:4px;">AUTO</span>`;

  const gratuitySubText = r.gratuityMode === 'manual'
    ? `Manual override (Auto would be ${fmt(r.gratuityAuto)})`
    : 'Basic/26 × 15 ÷ 12';

  const leaveSubText = r.leaveMode === 'manual'
    ? `Manual override (Auto would be ${fmt(r.leaveAuto)})`
    : 'Basic/26 × 1.25';

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
    fiHtml += `<div class="final-item ${item.cls}">
      <div class="fi-label">${item.label}</div>
      <div class="fi-val">${item.val}</div>
      <div class="fi-sub">${item.sub}</div>
    </div>`;
  });
  document.getElementById('finalItems').innerHTML = fiHtml;
}

/* ---- RENDER EXPORT PREVIEW ---- */
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
  document.getElementById('exportPreview').innerHTML = html;
}

/* ---- TAB SWITCH ---- */
function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

/* ---- RESET ---- */
function resetAll() {
  document.getElementById('empName').value = '';
  document.getElementById('grossSalary').value = '';
  document.getElementById('minWage').value = '';
  document.getElementById('ptAmount').value = '0';
  document.getElementById('lwfAmount').value = '0';
  // Inside resetAll() function, after clearing other fields:
document.getElementById('r_initialCTC').textContent = '—';


  // Reset gratuity
  gratuityMode = 'auto';
  setGratuityMode('auto');
  document.getElementById('gratuityCustom').value = '';

  // Reset leave
  leaveMode = 'auto';
  setLeaveMode('auto');
  document.getElementById('leaveCustom').value = '';

  pfApplicable = 'Y';
  document.getElementById('pfYes').classList.add('active');
  document.getElementById('pfNo').classList.remove('active');
  document.getElementById('pfHint').textContent = '55% of Gross or Min Wage (whichever is higher) → Basic';

  document.getElementById('summaryEmpty').classList.remove('hidden');
  document.getElementById('summaryResults').classList.add('hidden');
  document.getElementById('breakdownEmpty').classList.remove('hidden');
  document.getElementById('breakdownContent').classList.add('hidden');
  document.getElementById('exportPreview').innerHTML = '<div class="preview-empty">Calculate first to see export preview</div>';

  calcResult = null;
  showToast('↺ Calculator Reset');
}

/* ---- EXPORT PDF ---- */
function exportPDF() {
  if (!calcResult) { showToast('⚠️ Please calculate first'); return; }
  const r = calcResult;
  const empName = document.getElementById('empName').value.trim() || 'Employee';
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

/* ---- EXPORT CSV ---- */
function exportCSV() {
  if (!calcResult) { showToast('⚠️ Please calculate first'); return; }
  const r = calcResult;
  const empName = document.getElementById('empName').value.trim() || 'Employee';

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

/* ---- COPY TO CLIPBOARD ---- */
function copyToClipboard() {
  if (!calcResult) { showToast('⚠️ Please calculate first'); return; }
  const r = calcResult;
  const empName = document.getElementById('empName').value.trim() || 'Employee';

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

/* ---- TOAST ---- */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

/* ---- KEYBOARD SHORTCUT: Enter to calculate ---- */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') calculate();
});