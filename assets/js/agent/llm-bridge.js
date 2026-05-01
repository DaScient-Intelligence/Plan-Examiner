/**
 * Plan-Examiner LLM Bridge
 * BYO-key integration for OpenAI, Anthropic, Azure OpenAI, and Ollama.
 * API keys are stored only in localStorage — never sent to any PE server.
 *
 * Config shape (stored as JSON under localStorage key 'pe_llm_config'):
 * {
 *   provider: 'openai' | 'anthropic' | 'azure' | 'ollama',
 *   model:    string,
 *   apiKey:   string,
 *   baseUrl:  string   (required for azure / ollama)
 * }
 */

var PE = window.PE || {};

PE.LLM = (function () {
  'use strict';

  var STORAGE_KEY = 'pe_llm_config';

  var DEFAULTS = {
    openai:    { model: 'gpt-4o-mini',       baseUrl: 'https://api.openai.com/v1' },
    anthropic: { model: 'claude-3-haiku-20240307', baseUrl: 'https://api.anthropic.com' },
    azure:     { model: 'gpt-4o',            baseUrl: '' },
    ollama:    { model: 'llama3',             baseUrl: 'http://localhost:11434' }
  };

  function getConfig() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (e) { return null; }
  }

  function setConfig(cfg) {
    // Intentional clear-text storage in localStorage: the BYO-key design
    // requires the user's API key to be accessible client-side for LLM calls.
    // Keys are never sent to Plan-Examiner servers — only to the user's chosen
    // LLM provider. Users are warned of this in the AI Settings UI.
    // eslint-disable-next-line no-restricted-globals
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  function clearConfig() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function isConfigured() {
    var cfg = getConfig();
    return cfg && cfg.provider && (cfg.apiKey || cfg.provider === 'ollama');
  }

  // ── Provider adapters ────────────────────────────────────────────────

  async function callOpenAI(cfg, messages, signal) {
    var resp = await fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      signal: signal,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + cfg.apiKey
      },
      body: JSON.stringify({
        model: cfg.model || DEFAULTS.openai.model,
        messages: messages,
        temperature: 0.3,
        max_tokens: 1500
      })
    });
    if (!resp.ok) throw new Error('OpenAI error ' + resp.status + ': ' + await resp.text());
    var data = await resp.json();
    return data.choices[0].message.content;
  }

  async function callAnthropic(cfg, messages, signal) {
    var systemMsg = messages.find(function (m) { return m.role === 'system'; });
    var userMsgs  = messages.filter(function (m) { return m.role !== 'system'; });
    var resp = await fetch(cfg.baseUrl + '/v1/messages', {
      method: 'POST',
      signal: signal,
      headers: {
        'Content-Type':   'application/json',
        'x-api-key':      cfg.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      cfg.model || DEFAULTS.anthropic.model,
        max_tokens: 1500,
        system:     systemMsg ? systemMsg.content : undefined,
        messages:   userMsgs
      })
    });
    if (!resp.ok) throw new Error('Anthropic error ' + resp.status + ': ' + await resp.text());
    var data = await resp.json();
    return data.content[0].text;
  }

  async function callAzure(cfg, messages, signal) {
    var url = cfg.baseUrl + '/openai/deployments/' + cfg.model + '/chat/completions?api-version=2024-02-01';
    var resp = await fetch(url, {
      method: 'POST',
      signal: signal,
      headers: {
        'Content-Type': 'application/json',
        'api-key':      cfg.apiKey
      },
      body: JSON.stringify({ messages: messages, temperature: 0.3, max_tokens: 1500 })
    });
    if (!resp.ok) throw new Error('Azure error ' + resp.status + ': ' + await resp.text());
    var data = await resp.json();
    return data.choices[0].message.content;
  }

  async function callOllama(cfg, messages, signal) {
    var resp = await fetch((cfg.baseUrl || DEFAULTS.ollama.baseUrl) + '/api/chat', {
      method: 'POST',
      signal: signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:    cfg.model || DEFAULTS.ollama.model,
        messages: messages,
        stream:   false,
        options:  { temperature: 0.3 }
      })
    });
    if (!resp.ok) throw new Error('Ollama error ' + resp.status + ': ' + await resp.text());
    var data = await resp.json();
    return data.message.content;
  }

  // ── Core send ────────────────────────────────────────────────────────

  async function send(messages, signal) {
    var cfg = getConfig();
    if (!cfg || !cfg.provider) throw new Error('LLM not configured. Open AI Settings to add your API key.');
    var L = (window.PE && window.PE.Log) ? window.PE.Log : null;
    var promptChars = messages.reduce(function (a, m) { return a + (m.content ? String(m.content).length : 0); }, 0);
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (L) L.info('llm', 'request → ' + cfg.provider + ' (' + (cfg.model || '(default)') + ')', {
      provider: cfg.provider, model: cfg.model, baseUrl: cfg.baseUrl, promptChars: promptChars, messages: messages.length
      // Note: cfg.apiKey is intentionally NEVER included here.
    });
    var out;
    try {
      switch (cfg.provider) {
        case 'openai':    out = await callOpenAI(cfg, messages, signal); break;
        case 'anthropic': out = await callAnthropic(cfg, messages, signal); break;
        case 'azure':     out = await callAzure(cfg, messages, signal); break;
        case 'ollama':    out = await callOllama(cfg, messages, signal); break;
        default:          throw new Error('Unknown provider: ' + cfg.provider);
      }
    } catch (e) {
      var t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (L) L.error('llm', 'response error from ' + cfg.provider + ' after ' + Math.round(t1 - t0) + 'ms: ' + (e && e.message), { provider: cfg.provider, model: cfg.model, durationMs: Math.round(t1 - t0) });
      throw e;
    }
    var t2 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (L) L.info('llm', 'response ← ' + cfg.provider + ' in ' + Math.round(t2 - t0) + 'ms (' + (out ? out.length : 0) + ' chars)', {
      provider: cfg.provider, model: cfg.model, promptChars: promptChars, responseChars: out ? out.length : 0, durationMs: Math.round(t2 - t0)
    });
    return out;
  }

  // ── High-level convenience methods ──────────────────────────────────

  var SYSTEM_PROMPT = [
    'You are Plan-Examiner, an expert AI building code compliance reviewer.',
    'You have deep knowledge of IBC 2021, ADA 2010, NFPA 101, IRC, and local jurisdiction codes.',
    'You provide concise, technically accurate, actionable compliance guidance.',
    'When citing codes always include section numbers. Keep answers focused and professional.',
    'Do not include disclaimers about seeking legal advice unless specifically asked.'
  ].join(' ');

  /**
   * Generate a narrative summary for a set of findings.
   */
  async function summarize(projectInfo, findings, signal) {
    var flagged = findings.filter(function (f) { return f.status === 'FLAGGED'; }).length;
    var review  = findings.filter(function (f) { return f.status === 'REVIEW'; }).length;
    var passed  = findings.filter(function (f) { return f.status === 'PASS'; }).length;
    var score   = PE.RuleEngine ? PE.RuleEngine.score(findings) : 0;

    var findingsList = findings
      .filter(function (f) { return f.status !== 'PASS'; })
      .map(function (f) { return '• [' + f.status + '] ' + f.label + ': ' + f.note; })
      .join('\n');

    var messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: [
        'Provide a concise (3-4 paragraph) narrative compliance summary for this plan review:',
        '',
        'Project: ' + projectInfo.buildingType + ' | ' + projectInfo.buildingCode + ' | ' + projectInfo.city + ', ' + projectInfo.state,
        'Score: ' + score + '/100  |  Flagged: ' + flagged + '  |  Needs Review: ' + review + '  |  Passed: ' + passed,
        '',
        'Key issues:',
        findingsList || 'No major issues found.',
        '',
        'Focus on the most critical findings, likely root causes, and overall submission readiness.'
      ].join('\n') }
    ];
    return send(messages, signal);
  }

  /**
   * Draft a correction letter based on flagged/review items.
   */
  async function draftCorrectionLetter(projectInfo, findings, signal) {
    var issues = findings.filter(function (f) { return f.status === 'FLAGGED' || f.status === 'REVIEW'; });
    var messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: [
        'Draft a formal plan correction letter for the following project. Use standard building department format.',
        'Include: project header, correction items numbered with code citations, and a closing paragraph requesting resubmission.',
        '',
        'Project: ' + (projectInfo.buildingType || 'N/A') + ' development',
        'Jurisdiction: ' + (projectInfo.city || 'N/A') + ', ' + (projectInfo.state || 'N/A') + ', ' + (projectInfo.country || 'N/A'),
        'Applicable Code: ' + (projectInfo.buildingCode || 'IBC 2021'),
        'File Name: ' + (projectInfo.fileName || 'N/A'),
        '',
        'Corrections Required:',
        issues.map(function (f, i) {
          return (i + 1) + '. ' + f.label + ' [' + f.code_section + ']\n   Issue: ' + f.note + '\n   Remediation: ' + f.remediation;
        }).join('\n\n') || 'No corrections required.'
      ].join('\n') }
    ];
    return send(messages, signal);
  }

  /**
   * Answer a follow-up question scoped to the current plan analysis.
   * @param {string}  question  - User's question
   * @param {Object}  context   - { projectInfo, facts, findings }
   * @param {Array}   history   - Prior message objects [{role,content}]
   */
  async function chat(question, context, history, signal) {
    var contextSummary = [
      'Project: ' + (context.projectInfo.buildingType || '') + ' | ' + (context.projectInfo.buildingCode || '') + ' | ' + (context.projectInfo.city || '') + ', ' + (context.projectInfo.state || ''),
      'File: ' + (context.projectInfo.fileName || 'N/A'),
      'Occupant load: ' + (context.facts.occupantLoad || 'unknown'),
      'Gross area: ' + (context.facts.grossArea || 'unknown') + ' sq ft',
      'Stories: ' + (context.facts.stories || 'unknown'),
      'Sprinklers: ' + (context.facts.hasSprinklers === true ? 'Yes' : context.facts.hasSprinklers === false ? 'No' : 'Not verified'),
      '',
      'Findings:',
      context.findings.map(function (f) {
        return '[' + f.status + '] ' + f.id + ': ' + f.label + (f.note ? ' — ' + f.note : '');
      }).join('\n')
    ].join('\n');

    var messages = [
      { role: 'system', content: SYSTEM_PROMPT + '\n\nCurrent plan context:\n' + contextSummary }
    ].concat(history || []).concat([
      { role: 'user', content: question }
    ]);

    return send(messages, signal);
  }

  return {
    getConfig:       getConfig,
    setConfig:       setConfig,
    clearConfig:     clearConfig,
    isConfigured:    isConfigured,
    send:            send,
    summarize:       summarize,
    draftCorrectionLetter: draftCorrectionLetter,
    chat:            chat,
    DEFAULTS:        DEFAULTS
  };

}());

window.PE = PE;
