import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const getFunction = name => {
  const match = page.match(new RegExp(`function ${name}\\([^]*?\\n        \\}`));
  assert.ok(match, `${name} is present in the app`);
  return match[0];
};
const context = runInNewContext(
  `${getFunction('fixedRestReason')}\n${getFunction('countsAsEmployeeRest')}\n({ fixedRestReason, countsAsEmployeeRest })`,
  { Date }
);
const rest = { status: 'راحة' };

for (const [team, date] of [
  ['red', '2026-11-01'],
  ['blue', '2026-11-21'],
  ['yellow', '2026-11-11'],
  ['morning', '2026-11-06'] // Friday
]) {
  assert.ok(context.fixedRestReason(date, { team }), `${team} has a fixed rest`);
  assert.equal(context.countsAsEmployeeRest(date, { team }, rest), false, `${team} fixed rest is excluded`);
}
assert.equal(context.countsAsEmployeeRest('2026-11-02', { team: 'red' }, rest), true);
assert.equal(context.countsAsEmployeeRest('2026-11-02', { team: 'red' }, { status: 'حضور' }), false);
console.log('Fixed shift rests and Friday are excluded from employee rest totals.');
