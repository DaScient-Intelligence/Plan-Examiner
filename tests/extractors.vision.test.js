/**
 * Tests for vision/regex fact merging — the "hardening" itself.
 * Pure logic: no PDF rendering, no network calls.
 */

const test   = require('node:test');
const assert = require('node:assert');
const loader = require('./helpers/load');
loader.loadAll();
loader.loadSource('assets/js/agent/llm-bridge.js');

const { mergeVisionFacts } = global.PE.Extractors;
const { normalizeVisionFacts } = global.PE.LLM;

function v(value, confidence, evidence) { return { value: value, confidence: confidence, evidence: evidence || '' }; }

test('mergeVisionFacts: regex miss + vision present → vision used', () => {
  const r = mergeVisionFacts({}, { occupantLoad: v(320, 0.9, 'sheet G-001') }, { runId: 'r1', model: 'gpt-4o' });
  assert.strictEqual(r.facts.occupantLoad, 320);
  assert.strictEqual(r.provenance.occupantLoad.source, 'vision');
  assert.strictEqual(r.provenance.occupantLoad.confidence, 0.9);
  assert.strictEqual(r.conflicts.length, 0);
});

test('mergeVisionFacts: regex hit + vision agrees → regex+vision', () => {
  const r = mergeVisionFacts(
    { grossArea: 12500 },
    { grossArea: v(12500, 0.95, 'GROSS FLOOR AREA box') }
  );
  assert.strictEqual(r.facts.grossArea, 12500);
  assert.strictEqual(r.provenance.grossArea.source, 'regex+vision');
  assert.ok(r.provenance.grossArea.confidence >= 0.7);
  assert.strictEqual(r.conflicts.length, 0);
});

test('mergeVisionFacts: regex hit + vision close enough → still agrees (5% tolerance)', () => {
  // 5000 vs 5050 is within 5% tolerance — should NOT be a conflict.
  const r = mergeVisionFacts({ grossArea: 5000 }, { grossArea: v(5050, 0.9) });
  assert.strictEqual(r.provenance.grossArea.source, 'regex+vision');
  assert.strictEqual(r.conflicts.length, 0);
});

test('mergeVisionFacts: regex hit + vision disagrees → keep regex, record conflict', () => {
  const r = mergeVisionFacts(
    { occupantLoad: 80 },
    { occupantLoad: v(320, 0.9, 'CODE SUMMARY → 320') }
  );
  assert.strictEqual(r.facts.occupantLoad, 80, 'regex value preserved');
  assert.strictEqual(r.provenance.occupantLoad.source, 'regex');
  assert.ok(r.provenance.occupantLoad.conflict);
  assert.strictEqual(r.provenance.occupantLoad.conflict.visionValue, 320);
  assert.strictEqual(r.conflicts.length, 1);
  assert.strictEqual(r.conflicts[0].factName, 'occupantLoad');
});

test('mergeVisionFacts: both miss → unchanged', () => {
  const r = mergeVisionFacts({}, {});
  assert.deepStrictEqual(r.facts, {});
  assert.strictEqual(r.conflicts.length, 0);
});

test('mergeVisionFacts: bool flags — vision can set when regex missed', () => {
  const r = mergeVisionFacts(
    { hasSprinklers: null },
    { hasSprinklers: v(true, 0.9, 'NFPA 13 noted') }
  );
  assert.strictEqual(r.facts.hasSprinklers, true);
  assert.strictEqual(r.provenance.hasSprinklers.source, 'vision');
});

test('mergeVisionFacts: bool flags — disagreement recorded as conflict', () => {
  const r = mergeVisionFacts(
    { hasSprinklers: false },
    { hasSprinklers: v(true, 0.9) }
  );
  assert.strictEqual(r.facts.hasSprinklers, false);
  assert.strictEqual(r.conflicts.length, 1);
});

test('mergeVisionFacts: low-confidence vision should be filtered upstream by normalizeVisionFacts', () => {
  // Simulate the upstream normalization step — anything < 0.4 is dropped.
  const normalized = normalizeVisionFacts(
    { occupantLoad: { value: 320, confidence: 0.2 } },
    { minConfidence: 0.4 }
  );
  const r = mergeVisionFacts({}, normalized);
  assert.ok(!('occupantLoad' in r.facts), 'low-confidence vision must not bleed into facts');
});

test('mergeVisionFacts: malformed vision response (empty / non-object) is safe', () => {
  // Simulate parseVisionJson returning {} on garbage.
  const r1 = mergeVisionFacts({ grossArea: 5000 }, {});
  assert.strictEqual(r1.facts.grossArea, 5000);
  assert.strictEqual(r1.conflicts.length, 0);
  const r2 = mergeVisionFacts({ grossArea: 5000 }, null);
  assert.strictEqual(r2.facts.grossArea, 5000);
});

test('mergeVisionFacts: provenance includes runId, model, page', () => {
  const r = mergeVisionFacts({}, { stories: v(3, 0.9, 'A-001') }, { runId: 'abc', model: 'claude-3-5-sonnet', page: 1 });
  const p = r.provenance.stories;
  assert.strictEqual(p.runId, 'abc');
  assert.strictEqual(p.model, 'claude-3-5-sonnet');
  assert.strictEqual(p.page, 1);
  assert.strictEqual(p.evidence, 'A-001');
});

test('mergeVisionFacts: occupancy group string equality is case-insensitive', () => {
  const r = mergeVisionFacts({ occupancyGroup: 'b' }, { occupancyGroup: v('B', 0.9) });
  assert.strictEqual(r.provenance.occupancyGroup.source, 'regex+vision');
  assert.strictEqual(r.conflicts.length, 0);
});
