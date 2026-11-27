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
  `${getFunction('teamOn')}\n${getFunction('fixedRestReason')}\n${getFunction('countsAsEmployeeRest')}\n({ fixedRestReason, countsAsEmployeeRest })`,
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
// Transfer: blue until 2026-11-14, then red. History keeps blue rest day 21 only for old dates.
const moved = { team: 'red', teamHistory: [{ team: 'blue', until: '2026-11-14' }] };
assert.equal(context.fixedRestReason('2026-10-21', moved), 'راحة الوردية', 'old blue rest day stays a rest');
assert.equal(context.fixedRestReason('2026-11-21', moved), '', 'new red shift has no rest on 21');
assert.ok(context.fixedRestReason('2026-12-01', moved), 'new red rest day is 1');
console.log('Fixed shift rests and Friday are excluded from employee rest totals.');
