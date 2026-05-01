/**
 * Pipeline tests for the vision sub-step gating + graceful degradation.
 *
 * The deterministic regex/rule path remains the source of truth at every
 * step — these tests prove that:
 *  - Vision is skipped when the gate isn't satisfied (no key, no consent,
 *    text-only model, no toggle).
 *  - Vision merge-in succeeds when every gate is satisfied and provenance
 *    is recorded on the result.
 *  - Vision failures degrade gracefully (regex-only facts survive).
 */

const test   = require('node:test');
const assert = require('node:assert');
const fs     = require('node:fs');
const path   = require('node:path');

const loader = require('./helpers/load');
const { ROOT } = loader;

global.fetch = function (url) {
  const rel = url.replace(/^.*?assets\/data\/rules\//, 'assets/data/rules/');
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.reject(new Error('not found')); } });
  }
  const body = fs.readFileSync(abs, 'utf8');
  return Promise.resolve({
    ok: true, status: 200,
    json: function () { return Promise.resolve(JSON.parse(body)); },
    text: function () { return Promise.resolve(body); }
  });
};

loader.loadAll();
loader.loadSource('assets/js/agent/llm-bridge.js');
loader.loadSource('assets/js/agent/pipeline.js');

const PE = global.PE;

// Helper: install a stubbed extractor returning regex facts only.
function stubExtractor(facts) {
  PE.Extractors.extract = async function (file, formData) {
    return {
      source: 'pdf', text: 'GROSS FLOOR AREA: 5000 sq ft',
      pageCount: 2, parseDurationMs: 1,
      fileMeta: { fileName: file.name, sizeBytes: file.size, mimeType: 'application/pdf', sha256: 'mock' },
      facts: Object.assign({ buildingType: formData.buildingType || 'Commercial' }, facts || {})
    };
  };
}

const fakeFile = { name: 'mock.pdf', size: 1234, type: 'application/pdf', arrayBuffer: function () { return Promise.resolve(new ArrayBuffer(0)); } };

test('vision is SKIPPED when LLM is not configured', async () => {
  PE.LLM.clearConfig();
  PE.LLM.setVisionConsent(false);
  stubExtractor({ grossArea: 5000 });
  const r = await PE.Pipeline.run(fakeFile, { buildingType: 'Commercial', buildingCode: '2021 IBC', city: 'X', state: 'Y', useVision: true }, function () {});
  assert.strictEqual(r.visionStatus, 'skipped');
  assert.match(r.visionReason, /not configured/i);
  assert.strictEqual(r.facts.grossArea, 5000);
});

test('vision is SKIPPED when consent has not been granted', async () => {
  PE.LLM.setConfig({ provider: 'openai', apiKey: 'sk-x', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', useVision: true });
  PE.LLM.setVisionConsent(false);
  stubExtractor({ grossArea: 5000 });
  const r = await PE.Pipeline.run(fakeFile, { buildingType: 'Commercial', buildingCode: '2021 IBC', city: 'X', state: 'Y' }, function () {});
  assert.strictEqual(r.visionStatus, 'skipped');
  assert.match(r.visionReason, /consent/i);
});

test('vision is SKIPPED when model is text-only', async () => {
  PE.LLM.setConfig({ provider: 'openai', apiKey: 'sk-x', model: 'gpt-3.5-turbo', baseUrl: 'https://api.openai.com/v1', useVision: true });
  PE.LLM.setVisionConsent(true);
  stubExtractor({ grossArea: 5000 });
  const r = await PE.Pipeline.run(fakeFile, { buildingType: 'Commercial', buildingCode: '2021 IBC', city: 'X', state: 'Y' }, function () {});
  assert.strictEqual(r.visionStatus, 'skipped');
  assert.match(r.visionReason, /not vision-capable/i);
});

test('vision is SKIPPED when useVision toggle is off', async () => {
  PE.LLM.setConfig({ provider: 'openai', apiKey: 'sk-x', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', useVision: false });
  PE.LLM.setVisionConsent(true);
  stubExtractor({ grossArea: 5000 });
  const r = await PE.Pipeline.run(fakeFile, { buildingType: 'Commercial', buildingCode: '2021 IBC', city: 'X', state: 'Y' }, function () {});
  assert.strictEqual(r.visionStatus, 'skipped');
  assert.match(r.visionReason, /toggle off/i);
});

test('vision RUNS, merges new fact + records provenance', async () => {
  PE.LLM.setConfig({ provider: 'openai', apiKey: 'sk-x', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', useVision: true });
  PE.LLM.setVisionConsent(true);
  stubExtractor({ grossArea: 5000 });
  // Stub raster + vision so no real PDF rendering or network is needed.
  PE.Extractors.rasterizePdfPages = async function () {
    return { images: [{ page: 1, dataUrl: 'data:image/jpeg;base64,AAAA', bytes: 4, width: 1, height: 1, sha256: 'h' }],
             totalBytes: 4, totalPages: 1, processedPages: 1 };
  };
  PE.LLM.extractFactsFromImages = async function () {
    return { occupantLoad: { value: 240, confidence: 0.9, evidence: 'CODE SUMMARY → 240' } };
  };

  const r = await PE.Pipeline.run(fakeFile, { buildingType: 'Commercial', buildingCode: '2021 IBC', city: 'X', state: 'Y' }, function () {});
  assert.strictEqual(r.visionStatus, 'ok');
  assert.strictEqual(r.facts.grossArea, 5000, 'regex fact preserved');
  assert.strictEqual(r.facts.occupantLoad, 240, 'vision-only fact merged in');
  assert.ok(r.visionProvenance && r.visionProvenance.occupantLoad);
  assert.strictEqual(r.visionProvenance.occupantLoad.source, 'vision');
});

test('vision DISAGREEMENT keeps regex value and adds REVIEW finding', async () => {
  PE.LLM.setConfig({ provider: 'openai', apiKey: 'sk-x', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', useVision: true });
  PE.LLM.setVisionConsent(true);
  stubExtractor({ grossArea: 5000, occupantLoad: 80 });
  PE.Extractors.rasterizePdfPages = async function () {
    return { images: [{ page: 1, dataUrl: 'data:image/jpeg;base64,A', bytes: 1, width: 1, height: 1 }], totalBytes: 1, totalPages: 1, processedPages: 1 };
  };
  PE.LLM.extractFactsFromImages = async function () {
    return { occupantLoad: { value: 320, confidence: 0.9, evidence: 'CODE SUMMARY → 320' } };
  };

  const r = await PE.Pipeline.run(fakeFile, { buildingType: 'Commercial', buildingCode: '2021 IBC', city: 'X', state: 'Y' }, function () {});
  assert.strictEqual(r.facts.occupantLoad, 80, 'regex value preserved on conflict');
  assert.ok(r.visionConflicts && r.visionConflicts.length === 1);
  const reviewFinding = r.findings.find(f => f.id === 'vision-conflict/occupantLoad');
  assert.ok(reviewFinding, 'a REVIEW finding is added for the conflict');
  assert.strictEqual(reviewFinding.status, 'REVIEW');
});

test('vision FAILURE degrades to regex-only without throwing', async () => {
  PE.LLM.setConfig({ provider: 'openai', apiKey: 'sk-x', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', useVision: true });
  PE.LLM.setVisionConsent(true);
  stubExtractor({ grossArea: 5000 });
  PE.Extractors.rasterizePdfPages = async function () {
    return { images: [{ page: 1, dataUrl: 'data:image/jpeg;base64,A', bytes: 1, width: 1, height: 1 }], totalBytes: 1, totalPages: 1, processedPages: 1 };
  };
  PE.LLM.extractFactsFromImages = async function () {
    const e = new Error('rate limited'); e.code = 'rate_limited'; e.status = 429; throw e;
  };

  const r = await PE.Pipeline.run(fakeFile, { buildingType: 'Commercial', buildingCode: '2021 IBC', city: 'X', state: 'Y' }, function () {});
  assert.strictEqual(r.visionStatus, 'failed');
  assert.strictEqual(r.facts.grossArea, 5000, 'regex facts survive vision failure');
  assert.ok(Array.isArray(r.findings), 'pipeline still produced findings');
});
