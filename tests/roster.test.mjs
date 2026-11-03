import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROSTER, chooseFighters } from '../src/game/roster.ts';
test('all supplied models are registered', () => {
  assert.equal(ROSTER.length, 5);
  assert.equal(new Set(ROSTER.map(f => f.file)).size, 5);
});
test('random match always uses two distinct fighters', () => {
  for (const a of [0, .17, .4, .79, .999999]) for (const b of [0, .2, .49, .999999]) {
    const rolls = [a, b];
    const [first, second] = chooseFighters(() => rolls.shift());
    assert.notEqual(first.id, second.id);
  }
});
