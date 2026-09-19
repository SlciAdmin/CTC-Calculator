const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('script.js', 'utf8');
const end = source.indexOf('function reverseCalcFromFinalCTC');
const calculationSource = source.slice(0, end) +
  '\nthis.testPF = calculatePFContributions; this.testWages = getPFWages; this.testCTC = computeCTC;';
const context = {
  console,
  document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; } },
  firebase: { initializeApp() {}, auth() { return {}; }, firestore() { return {}; } },
  window: {},
  localStorage: { getItem() { return null; } },
  Number, Math, parseFloat, parseInt, isNaN,
};
vm.createContext(context);
vm.runInContext(calculationSource, context);

for (const [wage, expectedPF] of [[12000, 1440], [16953, 2034.36], [20000, 2400], [25000, 3000], [30000, 3000]]) {
  const applicableWage = context.testWages(wage, 'standard', 0, 25000);
  const actualPF = context.testPF(applicableWage, '12.5', wage).employeePF;
  assert.strictEqual(actualPF, expectedPF, `PF wage ${wage}`);
}

const nikhil = context.testCTC(30000, 16868, 'Y', 0, 0, 0, null,
  'standard', false, 0, 0, '12.5', 15, null, 'Y', 'minwage', 8.33, 0, 0);
assert.strictEqual(nikhil.basic, 16953);
assert.strictEqual(nikhil.pfWages, 16953);
assert.strictEqual(nikhil.epfEmployee, 2034.36);
assert.strictEqual(nikhil.epfEmployer, 2119);
assert.strictEqual(nikhil.edliEmployer, 75);
assert.strictEqual(nikhil.finalCTCAnnual, nikhil.finalCTC * 12);
assert.strictEqual(nikhil.pfComparison.oldEmployeePF, 1800);
assert.strictEqual(nikhil.pfComparison.oldEmployerPF, 1875);
assert.ok(source.includes('function exportPDF()'));
assert.ok(source.includes('fmtPF(r.epfEmployee)'));

console.log('PF calculation tests passed');