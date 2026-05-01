/**
 * Tests for PE.Log credential-redaction.
 *
 * Defense-in-depth: even if a caller accidentally stuffs an API key into a
 * log payload, the recorded buffer (and downloaded `.log` text) must never
 * contain the secret.
 */

const test   = require('node:test');
const assert = require('node:assert');
const loader = require('./helpers/load');

loader.loadSource('assets/js/utils/log.js');
const Log = global.PE.Log;
Log.setEnabled(true);

test('PE.Log redacts apiKey / authorization fields in data payloads', () => {
  Log.clear();
  Log.info('llm', 'request', {
    provider: 'openai',
    apiKey: 'sk-test-SECRET-KEY-VALUE-12345',
    Authorization: 'Bearer sk-another-SECRET-67890',
    'x-api-key': 'sk-ant-LEAK',
    nested: { api_key: 'leak-here', model: 'gpt-4o' }
  });
  const buf = Log.formatText();
  assert.ok(!/SECRET-KEY-VALUE-12345/.test(buf), 'apiKey value must be redacted');
  assert.ok(!/SECRET-67890/.test(buf), 'Authorization value must be redacted');
  assert.ok(!/sk-ant-LEAK/.test(buf), 'x-api-key value must be redacted');
  assert.ok(!/leak-here/.test(buf), 'nested api_key must be redacted');
  assert.ok(/redacted/.test(buf), 'redaction marker must appear');
  assert.ok(/openai/.test(buf), 'non-sensitive fields preserved');
  assert.ok(/gpt-4o/.test(buf), 'non-sensitive nested fields preserved');
});

test('PE.Log redacts inline Bearer / Basic tokens in messages', () => {
  Log.clear();
  Log.warn('llm', 'response error: Authorization: Bearer sk-INLINE-TOKEN-EXAMPLE failed');
  const buf = Log.formatText();
  assert.ok(!/sk-INLINE-TOKEN-EXAMPLE/.test(buf), 'inline bearer token must be redacted');
  assert.ok(/redacted/.test(buf));
});

test('PE.Log JSON.stringify of buffer never contains common credential keys', () => {
  Log.clear();
  Log.info('llm', 'config saved', {
    apiKey: 'sk-A', api_key: 'sk-B', 'API-Key': 'sk-C',
    Authorization: 'Bearer sk-D', authorization: 'Bearer sk-E',
    'x-api-key': 'sk-F', 'X-API-KEY': 'sk-G', token: 'tok-H',
    secret: 'shh', password: 'p'
  });
  const json = JSON.stringify(Log.entries());
  ['sk-A','sk-B','sk-C','sk-D','sk-E','sk-F','sk-G','tok-H','shh'].forEach(function (v) {
    assert.ok(json.indexOf(v) === -1, 'serialized buffer must not contain ' + v);
  });
});

test('PE.Log preserves normal payload fields', () => {
  Log.clear();
  Log.info('extract', 'fact extracted: grossArea = 12500', {
    factName: 'grossArea', value: 12500, snippet: 'GROSS FLOOR AREA: 12,500 sq ft'
  });
  const buf = Log.formatText();
  assert.ok(/grossArea/.test(buf));
  assert.ok(/12500/.test(buf));
  assert.ok(/GROSS FLOOR AREA/.test(buf));
});
