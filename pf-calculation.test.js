const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('script.js', 'utf8');
const end = source.indexOf('function reverseCalcFromFinalCTC');
const calculationSource = source.slice(0, end) +
  '\nthis.testPF = calculatePFContributions; this.testWages = getPFWages; this.testCTC = computeCTC; this.testNormalize = normalizeCalculationResult;';
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
assert.strictEqual(nikhil.edliEmployer, 85);
assert.strictEqual(nikhil.finalCTCAnnual, nikhil.finalCTC * 12);
assert.strictEqual(nikhil.pfComparison.oldEmployeePF, 1800);
assert.strictEqual(nikhil.pfComparison.oldEmployerPF, 1875);
assert.strictEqual(nikhil.pfComparison.oldEdli, 75);
assert.strictEqual(nikhil.pfComparison.newEdli, 85);

const edliExample = context.testPF(22411, '12.5', 22411);
assert.strictEqual(edliExample.edli, 112);

const incentives = context.testCTC(30000, 16868, 'Y', 0, 0, 0, null,
  'standard', false, 0, 0, '12.5', 15, null, 'Y', 'minwage', 8.33, 100, 0, 200);
assert.strictEqual(incentives.exGratiaMonthly, 100);
assert.strictEqual(incentives.exGratiaAnnual, 1200);
assert.strictEqual(incentives.pliMonthly, 200);
assert.strictEqual(incentives.pliAnnual, 2400);
assert.strictEqual(incentives.finalCTC, nikhil.finalCTC + 300);

const baseArgs = [30000, 16868, 'Y', 0, 0, 0, null, 'standard', false, 0, 0, '12.5', 15, null, 'Y', 'minwage', 8.33];
const exOnly = context.testCTC(...baseArgs, 300, 0, 0);
const pliOnly = context.testCTC(...baseArgs, 0, 0, 300);
const split = context.testCTC(...baseArgs, 200, 0, 100);
const larger = context.testCTC(...baseArgs, 300, 0, 500);
for (const result of [exOnly, pliOnly, split, larger]) {
  assert.strictEqual(result.finalCTC, nikhil.finalCTC + result.totalExGratiaPLI);
  assert.strictEqual(result.totalExGratiaPLIAnnual, result.totalExGratiaPLI * 12);
}
assert.strictEqual(exOnly.exGratiaAnnual, 3600);
assert.strictEqual(exOnly.pliAnnual, 0);
assert.strictEqual(pliOnly.exGratiaAnnual, 0);
assert.strictEqual(pliOnly.pliAnnual, 3600);
assert.strictEqual(split.exGratiaAnnual, 2400);
assert.strictEqual(split.pliAnnual, 1200);
assert.strictEqual(split.totalExGratiaPLI, 300);
assert.strictEqual(split.finalCTC, exOnly.finalCTC);
assert.strictEqual(larger.exGratiaAnnual, 3600);
assert.strictEqual(larger.pliAnnual, 6000);
assert.strictEqual(larger.totalExGratiaPLI, 800);
assert.strictEqual(larger.totalExGratiaPLIAnnual, 9600);
assert.strictEqual(context.testCTC(...baseArgs, -100, 0, 0).exGratiaMonthly, 0);
const migrated = context.testNormalize({ exGratiaPli: 300 });
assert.strictEqual(migrated.exGratiaMonthly, 300);
assert.strictEqual(migrated.pliMonthly, 0);
assert.strictEqual(migrated.exGratiaAnnual, 3600);
assert.ok(source.includes('function exportPDF()'));
assert.ok(source.includes('fmtPF(r.epfEmployee)'));

console.log('PF calculation tests passed');