# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| Latest (`main`) | ✅ |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Email us at **PlanExaminer@dascient.com** with:
- A description of the vulnerability
- Steps to reproduce (if applicable)
- The potential impact
- Any suggested mitigations

We aim to respond within 5 business days and will work with you to understand and resolve the issue.

## Security Posture

Plan-Examiner is a **static, client-side application**:
- All plan parsing and rule evaluation runs in the browser
- No plan data is transmitted to Plan-Examiner servers
- API keys (for BYO-key LLM) default to `localStorage` storage, with an opt-in **session-only** mode that uses `sessionStorage` instead
- The LLM bridge sends data directly from your browser to your chosen provider (OpenAI, Anthropic, etc.) — not through us
- Outbound LLM requests use `referrerPolicy: 'no-referrer'`, `cache: 'no-store'`, and `credentials: 'omit'`
- Each provider receives only the auth header it requires; we do not leak `Authorization` to providers that use `x-api-key` or `api-key`
- API keys, auth headers, and image bytes are redacted from the verbose log buffer and any downloaded `.log` files at the logger boundary

### Threat model and mitigations

| Threat | Mitigation |
| --- | --- |
| **XSS exfiltration** of API keys from `localStorage` | Plan-Examiner ships no untrusted user-generated content, but a future XSS would expose a stored key. **Recommended for shared machines: enable AI Settings → "Session only"** so the key lives only in `sessionStorage` and is forgotten when the tab closes. Use **Clear key** to wipe both stores. |
| **Accidental key leak in log exports / shared diagnostics** | Redaction at the logger boundary strips any field whose key matches `apiKey`, `api-key`, `Authorization`, `x-api-key`, `Bearer`, `token`, `secret`, etc., plus inline `Bearer …` / `Basic …` strings in messages. Covered by `tests/log.redaction.test.js`. |
| **Cross-provider header leakage** (e.g. `Authorization` sent to a provider that doesn't need it) | Each adapter constructs only the headers its provider requires. Covered by `tests/llm-bridge.test.js`. |
| **Path-traversal or query-tampering in user-supplied base URL** | Base URLs are parsed, validated, and normalized: `https://` required for cloud providers; `http://localhost`/`127.0.0.1` only for Ollama unless explicitly opted in; query strings, fragments, and `..` segments are rejected. |
| **Hung tabs from a slow / non-responsive provider** | All LLM fetches go through a single chokepoint with strict per-request timeouts (60 s text, 120 s vision) and an `AbortController` plumbed end-to-end so the user can cancel. |
| **Plan images leaving the browser without the user knowing** (vision mode) | Vision is opt-in, gated on a model-capability check, and requires an explicit one-time consent dialog ("I understand — enable vision"). Consent is revocable from AI Settings at any time. |
| **Image bytes ending up in logs or exports** | The rasterizer logs only counts, dimensions, mime types, and `sha256` per page. Data URLs are never recorded. |

### Recommendations

- For shared / public machines, use **Session only** mode and **Clear key** before closing the browser.
- Keep your provider's API key scoped to the minimum required (e.g. OpenAI project keys with limited spending caps).
- Review the **Outbound endpoints** preview in AI Settings before enabling vision so you can confirm the destination URL.

## Scope

In-scope:
- Cross-site scripting (XSS) vulnerabilities in the frontend
- Unsafe handling of user-uploaded files
- Unintended data exfiltration

Out-of-scope:
- Issues with third-party CDN libraries (report to the upstream project)
- Social engineering attacks
- Issues requiring physical access to the user's device
