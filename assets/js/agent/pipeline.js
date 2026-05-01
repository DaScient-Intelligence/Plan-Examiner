/**
 * Plan-Examiner Agent Pipeline
 * Orchestrates the 7-step agentic review process and emits step events
 * for the UI to display the live progress timeline.
 *
 * Steps:
 *  1. Ingest      – parse file
 *  2. Classify    – identify occupancy/use group
 *  3. Extract     – pull numerical facts
 *  4. SelectRules – choose rule packs for jurisdiction
 *  5. Evaluate    – run rule engine
 *  6. Cite        – format findings
 *  7. Draft       – AI summary (if LLM configured) or deterministic summary
 */

var PE = window.PE || {};

PE.Pipeline = (function () {
  'use strict';

  var STEPS = [
    { id: 'ingest',      label: 'Ingest',       icon: 'fa-file-arrow-up',    desc: 'Parsing file format and extracting raw content' },
    { id: 'classify',    label: 'Classify',      icon: 'fa-tag',              desc: 'Identifying occupancy type and use group' },
    { id: 'extract',     label: 'Extract Facts', icon: 'fa-magnifying-glass', desc: 'Pulling dimensional data, counts, and features' },
    { id: 'select',      label: 'Select Rules',  icon: 'fa-books',            desc: 'Loading applicable code packs for jurisdiction' },
    { id: 'evaluate',    label: 'Evaluate',      icon: 'fa-scale-balanced',   desc: 'Running deterministic compliance checks' },
    { id: 'cite',        label: 'Cite',          icon: 'fa-quote-right',      desc: 'Attaching code citations and remediation notes' },
    { id: 'draft',       label: 'Draft Report',  icon: 'fa-file-pen',         desc: 'Generating narrative summary and correction letter' }
  ];

  var BASE_RULES_PATH = 'assets/data/rules/';
  var PLACEHOLDERS_KEY = 'pe.rulePlaceholders';

  // ── Rule pack loader ─────────────────────────────────────────────────
  var _packCache = {};

  async function _fetchPack(filename) {
    if (_packCache[filename]) return _packCache[filename];
    var resp = await fetch(BASE_RULES_PATH + filename);
    if (!resp.ok) throw new Error('Failed to load rule pack: ' + filename);
    var pack = await resp.json();
    _packCache[filename] = pack;
    return pack;
  }

  /**
   * Load a pack and resolve any `extends` chain by deep-merging the parent's
   * rules. Child rules with the same id override parents; child can also set
   * `disabled: true` to suppress a parent rule.
   */
  async function loadPack(filename, indexById) {
    var pack = await _fetchPack(filename);
    if (!pack.extends) return pack;
    indexById = indexById || await _loadIndexById();
    var parentMeta = indexById[pack.extends];
    if (!parentMeta) return pack;
    var parent = await loadPack(parentMeta.file, indexById);
    return _mergePack(parent, pack);
  }

  function _mergePack(parent, child) {
    var rulesById = {};
    (parent.rules || []).forEach(function (r) { rulesById[r.id] = r; });
    (child.rules || []).forEach(function (r) {
      if (r.disabled === true && rulesById[r.id]) {
        delete rulesById[r.id];
      } else {
        rulesById[r.id] = Object.assign({}, rulesById[r.id] || {}, r);
      }
    });
    var merged = Object.assign({}, parent, child);
    merged.rules = Object.keys(rulesById).map(function (id) { return rulesById[id]; });
    // Preserve provenance: track which pack each rule's pack_id is from already
    // happens at evaluate time.
    return merged;
  }

  async function _loadIndexById() {
    var resp = await fetch(BASE_RULES_PATH + 'index.json');
    var idx = await resp.json();
    var map = {};
    (idx.packs || []).forEach(function (p) { map[p.id] = p; });
    return map;
  }

  async function selectPacks(buildingCode, buildingType) {
    var index;
    try {
      var resp = await fetch(BASE_RULES_PATH + 'index.json');
      index = await resp.json();
    } catch (e) {
      // Fallback: load all known packs
      index = { packs: [
        { id: 'ibc-2021',  file: 'ibc-2021.json',  applies_to_codes: ['2024 IBC', 'Local', 'Other'] },
        { id: 'ada-2010',  file: 'ada-2010.json',   applies_to_codes: ['2024 IBC', 'Local', 'Other'] },
        { id: 'nfpa-101',  file: 'nfpa-101.json',   applies_to_codes: ['2024 IBC', 'Local', 'Other'] }
      ]};
    }
    var indexById = {};
    (index.packs || []).forEach(function (p) { indexById[p.id] = p; });
    var relevant = (index.packs || []).filter(function (p) {
      if (p.disabled === true) return false;
      if (p.auto_select === false) return false;
      return !p.applies_to_codes || p.applies_to_codes.some(function (c) {
        return c === buildingCode || buildingCode === 'Other' || buildingCode === 'Local';
      });
    });
    var packs = await Promise.all(relevant.map(function (p) { return loadPack(p.file, indexById); }));
    return packs.filter(Boolean);
  }

  /**
   * Read user-set rule placeholders from localStorage. Return {} if unavailable.
   */
  function getStoredPlaceholders() {
    try {
      var raw = localStorage.getItem(PLACEHOLDERS_KEY);
      return raw ? (JSON.parse(raw) || {}) : {};
    } catch (e) { return {}; }
  }

  function setStoredPlaceholders(obj) {
    try { localStorage.setItem(PLACEHOLDERS_KEY, JSON.stringify(obj || {})); } catch (e) {}
  }

  // ── Deterministic summary (no LLM) ──────────────────────────────────
  function buildDeterministicSummary(projectInfo, findings, score) {
    var flagged = findings.filter(function (f) { return f.status === 'FLAGGED'; });
    var review  = findings.filter(function (f) { return f.status === 'REVIEW'; });
    var passed  = findings.filter(function (f) { return f.status === 'PASS'; });

    var lines = [
      '## Plan Review Summary',
      '',
      '**Project:** ' + (projectInfo.buildingType || 'N/A') + ' | ' + (projectInfo.buildingCode || 'IBC 2021') + ' | ' + (projectInfo.city || '') + ', ' + (projectInfo.state || ''),
      '**File:** ' + (projectInfo.fileName || 'N/A'),
      '**Compliance Score:** ' + score + '/100',
      '',
      '**Results:** ' + passed.length + ' passed · ' + review.length + ' need review · ' + flagged.length + ' flagged',
      ''
    ];

    if (flagged.length) {
      lines.push('### Critical Items Requiring Correction');
      flagged.forEach(function (f) {
        lines.push('- **' + f.label + '** (' + f.code_section + '): ' + f.note);
        lines.push('  *Remediation:* ' + f.remediation);
      });
      lines.push('');
    }

    if (review.length) {
      lines.push('### Items Requiring Manual Verification');
      review.forEach(function (f) {
        lines.push('- **' + f.label + ':** ' + f.note);
      });
      lines.push('');
    }

    lines.push('*This is an automated review preview. Subscribe for the full report with redline overlay and official correction letter.*');
    return lines.join('\n');
  }

  // ── Main run function ────────────────────────────────────────────────

  /**
   * Run the full review pipeline.
   * @param {File}     file       - Uploaded plan file
   * @param {Object}   formData   - Form field values
   * @param {Function} onStep     - Called on each step: onStep(stepId, status, detail)
   *                                status: 'running' | 'done' | 'error'
   * @returns {Object} Full result: { facts, packs, findings, score, summary }
   */
  async function run(file, formData, onStep) {
    var emit = onStep || function () {};
    var result = { facts: {}, packs: [], findings: [], score: 0, summary: '', correctionLetter: '' };

    // ── Step 1: Ingest ─────────────────────────────────────────────
    emit('ingest', 'running', 'Parsing ' + file.name + ' (' + (file.size / 1024).toFixed(0) + ' KB)…');
    var extraction;
    try {
      extraction = await PE.Extractors.extract(file, formData);
      if (extraction.unsupported) {
        emit('ingest', 'done', 'DWG file received. Native DWG rendering requires full engine — convert to DXF or PDF for automated analysis.');
        result.rawExtraction = extraction;
        result.summary = '**DWG files** cannot be parsed in-browser. Please convert to DXF (ASCII) or PDF for automated compliance analysis.\n\nYour file will be fully processed upon subscription.';
        return result;
      }
      emit('ingest', 'done', 'Extracted ' + (extraction.text ? extraction.text.length : 0) + ' chars from ' + extraction.source.toUpperCase() + (extraction.pageCount ? ' (' + extraction.pageCount + ' pages)' : '') + (extraction.layers ? ', ' + extraction.layers.length + ' DXF layers' : ''));
    } catch (err) {
      emit('ingest', 'error', 'Ingestion failed: ' + err.message);
      throw err;
    }

    result.rawExtraction = extraction;
    var facts = extraction.facts || {};

    // ── Step 2: Classify ───────────────────────────────────────────
    emit('classify', 'running', 'Identifying occupancy and use group…');
    await _tick();
    var useGroup = facts.occupancyGroup || _inferUseGroup(formData.buildingType, extraction.text);
    facts.occupancyGroup = useGroup;
    facts.buildingType   = formData.buildingType || facts.buildingType || 'Commercial';
    emit('classify', 'done', 'Classified as ' + facts.buildingType + (useGroup !== facts.buildingType ? ' (IBC Use Group: ' + useGroup + ')' : '') + '.');

    // ── Step 3: Extract Facts ─────────────────────────────────────
    emit('extract', 'running', 'Pulling dimensional data and feature flags…');
    await _tick();
    var extracted = Object.keys(facts).filter(function (k) { return facts[k] !== null && facts[k] !== undefined && !k.startsWith('_'); });
    emit('extract', 'done', extracted.length + ' fact(s) extracted: ' + extracted.slice(0, 5).join(', ') + (extracted.length > 5 ? '…' : '.'));
    result.facts = facts;

    // ── Step 4: Select Rules ──────────────────────────────────────
    emit('select', 'running', 'Loading rule packs for ' + (formData.buildingCode || 'IBC 2021') + '…');
    var packs;
    try {
      packs = await selectPacks(formData.buildingCode || '2024 IBC', facts.buildingType);
      result.packs = packs;
      emit('select', 'done', packs.length + ' rule pack(s) loaded: ' + packs.map(function (p) { return p.name; }).join(', ') + '.');
    } catch (err) {
      emit('select', 'error', 'Failed to load rule packs: ' + err.message);
      throw err;
    }

    // ── Step 5: Evaluate ──────────────────────────────────────────
    emit('evaluate', 'running', 'Running compliance checks across ' + packs.reduce(function (a, p) { return a + (p.rules ? p.rules.length : 0); }, 0) + ' rules…');
    await _tick();
    var placeholders = getStoredPlaceholders();
    var findings = PE.RuleEngine.evaluate(facts, packs, facts.buildingType, { placeholders: placeholders });
    var compScore = PE.RuleEngine.score(findings);
    result.findings = findings;
    result.score    = compScore;
    result.placeholders = placeholders;
    if (PE.RuleEngine.coverageReport) {
      try { result.coverage = PE.RuleEngine.coverageReport(facts, packs, facts.buildingType); } catch (e) {}
    }
    var flagCnt = findings.filter(function (f) { return f.status === 'FLAGGED'; }).length;
    var revCnt  = findings.filter(function (f) { return f.status === 'REVIEW'; }).length;
    emit('evaluate', 'done', findings.length + ' checks completed — ' + flagCnt + ' flagged, ' + revCnt + ' need review. Score: ' + compScore + '/100.');

    // ── Step 6: Cite ──────────────────────────────────────────────
    emit('cite', 'running', 'Attaching code citations and remediation notes…');
    await _tick();
    var citedCount = findings.filter(function (f) { return f.citation; }).length;
    emit('cite', 'done', citedCount + ' citations attached from ' + packs.map(function (p) { return p.name; }).join(', ') + '.');

    // ── Step 7: Draft ─────────────────────────────────────────────
    emit('draft', 'running', PE.LLM && PE.LLM.isConfigured() ? 'Drafting AI narrative summary…' : 'Generating deterministic summary…');
    try {
      if (PE.LLM && PE.LLM.isConfigured()) {
        result.summary          = await PE.LLM.summarize(Object.assign({}, formData, { fileName: file.name }), findings);
        result.correctionLetter = await PE.LLM.draftCorrectionLetter(Object.assign({}, formData, { fileName: file.name }), findings);
        emit('draft', 'done', 'AI-generated summary and correction letter ready.');
      } else {
        result.summary = buildDeterministicSummary(Object.assign({}, formData, { fileName: file.name }), findings, compScore);
        emit('draft', 'done', 'Summary generated. Configure an LLM API key for AI-enhanced narrative.');
      }
    } catch (err) {
      result.summary = buildDeterministicSummary(Object.assign({}, formData, { fileName: file.name }), findings, compScore);
      emit('draft', 'error', 'LLM draft failed (' + err.message + ') — deterministic summary used.');
    }

    return result;
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  function _tick() {
    return new Promise(function (r) { setTimeout(r, 80); });
  }

  function _inferUseGroup(buildingType, text) {
    var t = (text || '').toLowerCase();
    var bt = (buildingType || '').toLowerCase();
    if (/assembly|restaurant|auditorium|gymnasium|theater/.test(t + bt)) return 'A';
    if (/business|office|professional/.test(t + bt))                      return 'B';
    if (/educational|school|university|classroom/.test(t + bt))           return 'E';
    if (/factory|manufacturing|fabricat/.test(t + bt))                    return 'F';
    if (/hazardous|flammable/.test(t + bt))                               return 'H';
    if (/institutional|hospital|care|nursing/.test(t + bt))               return 'I';
    if (/mercantile|retail|store|shop/.test(t + bt))                      return 'M';
    if (/residential|dwelling|apartment|hotel|motel/.test(t + bt))        return 'R';
    if (/storage|warehouse/.test(t + bt))                                 return 'S';
    if (/utility|miscellaneous/.test(t + bt))                             return 'U';
    if (bt.includes('commercial'))  return 'B';
    if (bt.includes('residential')) return 'R';
    if (bt.includes('industrial'))  return 'F';
    if (bt.includes('institution')) return 'I';
    return 'B'; // default
  }

  return { run: run, STEPS: STEPS, loadPack: loadPack, selectPacks: selectPacks, getStoredPlaceholders: getStoredPlaceholders, setStoredPlaceholders: setStoredPlaceholders };

}());

window.PE = PE;
