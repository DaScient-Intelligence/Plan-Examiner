/**
 * Tests for PE.LLM bridge — capability detection, URL validation, error
 * normalization, multimodal routing, vision-JSON tolerant parser, and
 * fact-schema clamping. Network calls are NEVER issued; we monkey-patch
 * `fetch` for the request-shape test.
 */

const test   = require('node:test');
const assert = require('node:assert');
const loader = require('./helpers/load');

loader.loadSource('assets/js/utils/log.js');
loader.loadSource('assets/js/agent/llm-bridge.js');
const LLM = global.PE.LLM;

// Make sure no leftover state is in the test localStorage between tests.
function reset() { LLM.clearConfig(); LLM.setVisionConsent(false); }

// ── Capability detection ────────────────────────────────────────────────

test('visionCapability: openai gpt-4o models are vision-capable', () => {
  reset();
  LLM.setConfig({ provider: 'openai', apiKey: 'sk-x', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' });
  assert.strictEqual(LLM.visionCapability(), 'vision');
  assert.strictEqual(LLM.isVisionCapable(), true);
});

test('visionCapability: openai gpt-3.5 is text-only', () => {
  reset();
  LLM.setConfig({ provider: 'openai', apiKey: 'sk-x', model: 'gpt-3.5-turbo', baseUrl: 'https://api.openai.com/v1' });
  assert.strictEqual(LLM.visionCapability(), 'text');
});

test('visionCapability: anthropic claude-3 family is vision-capable', () => {
  reset();
  LLM.setConfig({ provider: 'anthropic', apiKey: 'sk-ant-x', model: 'claude-3-5-sonnet-20241022', baseUrl: 'https://api.anthropic.com' });
  assert.strictEqual(LLM.visionCapability(), 'vision');
});

test('visionCapability: ollama llava is vision-capable; llama3 is text-only', () => {
  reset();
  LLM.setConfig({ provider: 'ollama', model: 'llava', baseUrl: 'http://localhost:11434' });
  assert.strictEqual(LLM.visionCapability(), 'vision');
  LLM.setConfig({ provider: 'ollama', model: 'llama3', baseUrl: 'http://localhost:11434' });
  assert.strictEqual(LLM.visionCapability(), 'text');
});

test('visionCapability: azure custom deployments default to "unknown"', () => {
  reset();
  LLM.setConfig({ provider: 'azure', apiKey: 'k', model: 'my-custom-deployment', baseUrl: 'https://example.openai.azure.com' });
  assert.strictEqual(LLM.visionCapability(), 'unknown');
});

// ── Base URL validation ─────────────────────────────────────────────────

test('validateBaseUrl: cloud providers require https', () => {
  assert.strictEqual(LLM.validateBaseUrl('openai', 'http://api.openai.com/v1').ok, false);
  assert.strictEqual(LLM.validateBaseUrl('openai', 'https://api.openai.com/v1').ok, true);
  assert.strictEqual(LLM.validateBaseUrl('anthropic', 'https://api.anthropic.com').ok, true);
});

test('validateBaseUrl: query strings, fragments, and ".." rejected', () => {
  assert.strictEqual(LLM.validateBaseUrl('openai', 'https://api.openai.com/v1?foo=1').ok, false);
  assert.strictEqual(LLM.validateBaseUrl('openai', 'https://api.openai.com/v1#x').ok,    false);
  assert.strictEqual(LLM.validateBaseUrl('openai', 'https://api.openai.com/v1/../etc').ok, false);
});

test('validateBaseUrl: ollama allows loopback http; rejects remote without opt-in', () => {
  assert.strictEqual(LLM.validateBaseUrl('ollama', 'http://localhost:11434').ok, true);
  assert.strictEqual(LLM.validateBaseUrl('ollama', 'http://127.0.0.1:11434').ok, true);
  assert.strictEqual(LLM.validateBaseUrl('ollama', 'http://example.com:11434').ok, false);
  assert.strictEqual(LLM.validateBaseUrl('ollama', 'http://example.com:11434', { ollamaAllowRemote: true }).ok, true);
});

test('validateBaseUrl: trailing slash is normalized away', () => {
  var r = LLM.validateBaseUrl('openai', 'https://api.openai.com/v1/');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.url, 'https://api.openai.com/v1');
});

// ── Error normalization ─────────────────────────────────────────────────

test('_normalizeError: 401 → auth, not retryable', () => {
  var e = LLM._normalizeError('openai', 401, '{"error":{"message":"Bad key"}}', null);
  assert.strictEqual(e.code, 'auth');
  assert.strictEqual(e.retryable, false);
  assert.match(e.message, /Invalid or unauthorized/i);
});

test('_normalizeError: 429 → rate_limited, retryable', () => {
  var e = LLM._normalizeError('anthropic', 429, '', null);
  assert.strictEqual(e.code, 'rate_limited');
  assert.strictEqual(e.retryable, true);
});

test('_normalizeError: 503 → server, retryable', () => {
  var e = LLM._normalizeError('azure', 503, '', null);
  assert.strictEqual(e.code, 'server');
  assert.strictEqual(e.retryable, true);
});

test('_normalizeError: network error retryable', () => {
  var e = LLM._normalizeError('ollama', 0, '', new Error('connect refused'));
  assert.strictEqual(e.code, 'network');
  assert.strictEqual(e.retryable, true);
});

// ── parseVisionJson tolerance ───────────────────────────────────────────

test('parseVisionJson: tolerates code-fenced JSON', () => {
  var r = LLM.parseVisionJson('```json\n{ "occupantLoad": { "value": 320, "confidence": 0.9 } }\n```');
  assert.strictEqual(r.occupantLoad.value, 320);
});

test('parseVisionJson: tolerates trailing prose', () => {
  var r = LLM.parseVisionJson('Here is the answer:\n{"grossArea":{"value":12500,"confidence":0.8}}\nHope that helps!');
  assert.strictEqual(r.grossArea.value, 12500);
});

test('parseVisionJson: returns {} on garbage', () => {
  assert.deepStrictEqual(LLM.parseVisionJson('not json at all'), {});
  assert.deepStrictEqual(LLM.parseVisionJson(''), {});
  assert.deepStrictEqual(LLM.parseVisionJson(null), {});
});

test('parseVisionJson: tolerates trailing commas', () => {
  var r = LLM.parseVisionJson('{"stories":{"value":3,"confidence":0.9,},}');
  assert.strictEqual(r.stories.value, 3);
});

// ── normalizeVisionFacts (schema clamping) ──────────────────────────────

test('normalizeVisionFacts: drops out-of-range values', () => {
  var r = LLM.normalizeVisionFacts({
    grossArea: { value: -5, confidence: 0.9 },
    stories:   { value: 9999, confidence: 0.9 }
  });
  assert.ok(!('grossArea' in r));
  assert.ok(!('stories'  in r));
});

test('normalizeVisionFacts: drops below-threshold confidence', () => {
  var r = LLM.normalizeVisionFacts(
    { grossArea: { value: 5000, confidence: 0.2 } },
    { minConfidence: 0.4 }
  );
  assert.ok(!('grossArea' in r));
});

test('normalizeVisionFacts: drops unknown keys', () => {
  var r = LLM.normalizeVisionFacts({
    bogusField:    { value: 'whatever', confidence: 1.0 },
    occupantLoad:  { value: 100, confidence: 0.9 }
  });
  assert.ok(!('bogusField' in r));
  assert.strictEqual(r.occupantLoad.value, 100);
});

test('normalizeVisionFacts: integer fields are rounded', () => {
  var r = LLM.normalizeVisionFacts({ stories: { value: 3.4, confidence: 0.9 } });
  assert.strictEqual(r.stories.value, 3);
});

test('normalizeVisionFacts: bool fields coerce string "true"', () => {
  var r = LLM.normalizeVisionFacts({ hasSprinklers: { value: 'true', confidence: 0.9 } });
  assert.strictEqual(r.hasSprinklers.value, true);
});

test('normalizeVisionFacts: clamps confidence to [0,1]', () => {
  var r = LLM.normalizeVisionFacts({ grossArea: { value: 5000, confidence: 5 } });
  assert.strictEqual(r.grossArea.confidence, 1);
});

// ── send() capability gating ────────────────────────────────────────────

test('send: rejects multimodal content when model is text-only', async () => {
  reset();
  LLM.setConfig({ provider: 'openai', apiKey: 'sk-x', model: 'gpt-3.5-turbo', baseUrl: 'https://api.openai.com/v1' });
  await assert.rejects(
    LLM.send([{ role: 'user', content: [{ type: 'text', text: 'hi' }, { type: 'image', dataUrl: 'data:image/jpeg;base64,AAA=' }] }]),
    /not vision-capable/i
  );
});

test('send: rejects when LLM not configured', async () => {
  reset();
  await assert.rejects(LLM.send([{ role: 'user', content: 'hi' }]), /not configured/i);
});

// ── Header isolation: each provider only sees the header it expects ────

test('send: each provider only sends its own auth header (no leakage)', async () => {
  reset();
  // Capture every fetch call.
  const calls = [];
  const origFetch = global.fetch;
  global.fetch = function (url, opts) {
    calls.push({ url: url, headers: Object.assign({}, opts && opts.headers) });
    return Promise.resolve({
      ok: true, status: 200,
      text: function () { return Promise.resolve(''); },
      json: function () {
        // Provider-specific success body shapes.
        if (/anthropic|messages/.test(url)) return Promise.resolve({ content: [{ type: 'text', text: 'ok' }] });
        if (/ollama|api\/chat/.test(url))   return Promise.resolve({ message: { content: 'ok' } });
        return Promise.resolve({ choices: [{ message: { content: 'ok' } }] });
      }
    });
  };
  try {
    LLM.setConfig({ provider: 'openai', apiKey: 'sk-OPENAI', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' });
    await LLM.send([{ role: 'user', content: 'hi' }]);
    LLM.setConfig({ provider: 'anthropic', apiKey: 'sk-ant-AN', model: 'claude-3-5-sonnet-20241022', baseUrl: 'https://api.anthropic.com' });
    await LLM.send([{ role: 'user', content: 'hi' }]);
    LLM.setConfig({ provider: 'azure', apiKey: 'AZ', model: 'gpt-4o', baseUrl: 'https://x.openai.azure.com' });
    await LLM.send([{ role: 'user', content: 'hi' }]);
    LLM.setConfig({ provider: 'ollama', model: 'llama3', baseUrl: 'http://localhost:11434' });
    await LLM.send([{ role: 'user', content: 'hi' }]);
  } finally {
    global.fetch = origFetch;
  }
  assert.strictEqual(calls.length, 4);

  // OpenAI
  assert.match(calls[0].headers.Authorization, /Bearer sk-OPENAI/);
  assert.strictEqual(calls[0].headers['x-api-key'], undefined);
  assert.strictEqual(calls[0].headers['api-key'],   undefined);

  // Anthropic
  assert.strictEqual(calls[1].headers.Authorization, undefined, 'no Bearer leak to Anthropic');
  assert.strictEqual(calls[1].headers['x-api-key'], 'sk-ant-AN');
  assert.strictEqual(calls[1].headers['api-key'],   undefined);

  // Azure
  assert.strictEqual(calls[2].headers.Authorization, undefined, 'no Bearer leak to Azure');
  assert.strictEqual(calls[2].headers['x-api-key'], undefined);
  assert.strictEqual(calls[2].headers['api-key'],   'AZ');

  // Ollama: no auth header at all
  assert.strictEqual(calls[3].headers.Authorization, undefined);
  assert.strictEqual(calls[3].headers['x-api-key'], undefined);
  assert.strictEqual(calls[3].headers['api-key'],   undefined);
});

// ── describeEndpoints ───────────────────────────────────────────────────

test('describeEndpoints: lists outbound URLs per provider', () => {
  reset();
  LLM.setConfig({ provider: 'openai', apiKey: 'sk-x', model: 'gpt-4o', baseUrl: 'https://api.openai.com/v1' });
  var eps = LLM.describeEndpoints();
  assert.ok(eps.length === 1 && /chat\/completions/.test(eps[0]));
});

// ── Schema versioning ───────────────────────────────────────────────────

test('setConfig stamps schema version', () => {
  reset();
  LLM.setConfig({ provider: 'openai', apiKey: 'sk-x', model: 'gpt-4o', baseUrl: 'https://api.openai.com/v1' });
  var cfg = LLM.getConfig();
  assert.strictEqual(cfg.v, LLM.SCHEMA_VERSION);
});

// ── Vision consent ──────────────────────────────────────────────────────

test('vision consent: off by default, persists when set', () => {
  reset();
  assert.strictEqual(LLM.hasVisionConsent(), false);
  LLM.setVisionConsent(true);
  assert.strictEqual(LLM.hasVisionConsent(), true);
  LLM.setVisionConsent(false);
  assert.strictEqual(LLM.hasVisionConsent(), false);
});

// ── keyShapeWarning ─────────────────────────────────────────────────────

test('keyShapeWarning: warns on mis-shaped keys, silent when correct', () => {
  assert.ok(LLM.keyShapeWarning('openai',    'BAD-KEY'));
  assert.ok(!LLM.keyShapeWarning('openai',   'sk-abcdef'));
  assert.ok(LLM.keyShapeWarning('anthropic', 'sk-not-anthropic'));
  assert.ok(!LLM.keyShapeWarning('anthropic','sk-ant-abc'));
});
