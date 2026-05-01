#!/usr/bin/env node
/**
 * scripts/validate-rules.mjs
 *
 * Lightweight rule-pack validator. Confirms:
 *   1. Every JSON file in assets/data/rules/*.json parses.
 *   2. index.json references a file that exists for each pack.
 *   3. Each pack with `extends: <id>` references a known pack.
 *   4. For schema_version >= 3 packs:
 *        - license is set
 *        - reference-only / cc-by* packs include source_authority + copyright_notice
 *        - rules use only known check_fn ids (sourced from rule-engine.js)
 *   5. Every rule has the required envelope fields (id, code_section, label, applies_to).
 *   6. JSON Schema (draft 2020-12) validation if `ajv` is available; otherwise skipped.
 *
 * No new heavy deps: this only needs Node 18+ standard libraries.
 *
 * Usage:
 *   node scripts/validate-rules.mjs
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const RULES_DIR = join(ROOT, 'assets', 'data', 'rules');
const ENGINE    = join(ROOT, 'assets', 'js', 'agent', 'rule-engine.js');

let errors = 0;
let warnings = 0;
function err(msg) { errors++;   console.error('  ✗ ' + msg); }
function warn(msg){ warnings++; console.warn('  ! ' + msg); }
function ok(msg)  {              console.log('  ✓ ' + msg); }

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// 1. Discover known check_fn ids from rule-engine.js
const engineSrc = readFileSync(ENGINE, 'utf8');
const knownChecks = new Set();
// Match keys in checks = { ... }: identifier followed by `: function`
for (const m of engineSrc.matchAll(/^\s{4}([a-z_][a-z0-9_]*)\s*:\s*function/gmi)) {
  knownChecks.add(m[1]);
}
knownChecks.add('manual'); // always built-in
console.log(`Discovered ${knownChecks.size} check functions in rule-engine.js`);

// 2. Discover packs
const files = readdirSync(RULES_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
const packs = {};
for (const f of files) {
  console.log(`\n[${f}]`);
  let pack;
  try { pack = readJson(join(RULES_DIR, f)); }
  catch (e) { err('JSON parse error: ' + e.message); continue; }

  if (!pack.id) { err('missing id'); continue; }
  if (!pack.name) err('missing name');
  if (!pack.version) err('missing version');
  if (!Array.isArray(pack.rules)) { err('missing or non-array rules'); continue; }
  packs[pack.id] = pack;

  const sv = pack.schema_version;
  const isV3 = sv && /^3\./.test(sv);

  if (isV3) {
    if (!pack.license) err('schema v3+ pack must declare license');
    if (['reference-only', 'cc-by', 'cc-by-sa'].includes(pack.license)) {
      if (!pack.source_authority) err('reference-only/cc-by* pack must declare source_authority');
      if (!pack.copyright_notice) err('reference-only/cc-by* pack must declare copyright_notice');
    }
  } else {
    warn('legacy schema (no schema_version 3.x): consider bumping');
  }

  // Validate rules
  pack.rules.forEach((r, i) => {
    const tag = `rule[${i}] ${r.id || '?'}`;
    if (!r.id)           err(`${tag}: missing id`);
    if (!r.code_section) err(`${tag}: missing code_section`);
    if (!r.label)        err(`${tag}: missing label`);
    if (!Array.isArray(r.applies_to) || r.applies_to.length === 0) err(`${tag}: missing applies_to[]`);
    if (r.check_fn && r.check_fn !== 'manual' && !knownChecks.has(r.check_fn)) {
      err(`${tag}: check_fn "${r.check_fn}" is not implemented in rule-engine.js`);
    }
  });

  ok(`${pack.id} (${pack.rules.length} rules${pack.extends ? ', extends '+pack.extends : ''})`);
}

// 3. Validate index.json
console.log('\n[index.json]');
const idx = readJson(join(RULES_DIR, 'index.json'));
const idxIds = new Set();
(idx.packs || []).forEach(p => {
  idxIds.add(p.id);
  if (!p.file) { err(`index entry ${p.id}: missing file`); return; }
  if (!files.includes(p.file)) err(`index entry ${p.id}: file ${p.file} not found on disk`);
  if (!packs[p.id]) err(`index entry ${p.id}: no pack with that id (file=${p.file})`);
});
Object.keys(packs).forEach(id => {
  if (!idxIds.has(id)) warn(`pack ${id} is not registered in index.json`);
});

// 4. Validate extends chains
Object.values(packs).forEach(p => {
  if (p.extends && !packs[p.extends]) err(`pack ${p.id}: extends "${p.extends}" but that pack does not exist`);
});

// 5. Optional Ajv validation (skipped if not installed)
try {
  const Ajv2020 = (await import('ajv/dist/2020.js')).default;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const schema = readJson(join(RULES_DIR, 'schema', 'rule-pack.schema.json'));
  const validate = ajv.compile(schema);
  console.log('\n[ajv schema validation]');
  Object.values(packs).forEach(p => {
    if (!validate(p)) {
      err(`${p.id}: ${ajv.errorsText(validate.errors, { separator: '\n      ' })}`);
    } else {
      ok(`${p.id} schema-valid`);
    }
  });
} catch (e) {
  console.log('\n[ajv not installed — schema validation skipped]');
}

console.log(`\nDone. Errors: ${errors}. Warnings: ${warnings}.`);
process.exit(errors > 0 ? 1 : 0);
