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
- API keys (for BYO-key LLM) are stored in `localStorage` only
- The LLM bridge sends data directly from your browser to your chosen provider (OpenAI, Anthropic, etc.) — not through us

## Scope

In-scope:
- Cross-site scripting (XSS) vulnerabilities in the frontend
- Unsafe handling of user-uploaded files
- Unintended data exfiltration

Out-of-scope:
- Issues with third-party CDN libraries (report to the upstream project)
- Social engineering attacks
- Issues requiring physical access to the user's device
