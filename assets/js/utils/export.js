/**
 * Plan-Examiner Export Utilities
 * Generates downloadable compliance reports and correction letters.
 * Uses only built-in browser APIs — no server required.
 */

var PE = window.PE || {};

PE.Export = (function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────

  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _statusBadge(status) {
    var styles = {
      PASS:    'color:#14532d;background:#dcfce7;border:1px solid #86efac;',
      REVIEW:  'color:#78350f;background:#fef3c7;border:1px solid #fcd34d;',
      FLAGGED: 'color:#7f1d1d;background:#fee2e2;border:1px solid #fca5a5;'
    };
    return '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:.06em;' + (styles[status] || '') + '">' + _esc(status) + '</span>';
  }

  function _severityBadge(sev) {
    var s = sev === 'critical' ? 'color:#7f1d1d;background:#fee2e2;' :
            sev === 'high'     ? 'color:#78350f;background:#fef3c7;' :
            sev === 'medium'   ? 'color:#1e3a5f;background:#dbeafe;' :
                                 'color:#1e293b;background:#f1f5f9;';
    return '<span style="font-size:9px;font-weight:600;padding:1px 6px;border-radius:3px;text-transform:uppercase;letter-spacing:.05em;' + s + '">' + _esc(sev) + '</span>';
  }

  // ── HTML Compliance Report ────────────────────────────────────────────

  function buildReportHtml(data) {
    var { projectInfo, facts, findings, score, summary, fileHash } = data;
    var now = new Date().toLocaleString();
    var flagged = (findings || []).filter(function (f) { return f.status === 'FLAGGED'; });
    var review  = (findings || []).filter(function (f) { return f.status === 'REVIEW';  });
    var passed  = (findings || []).filter(function (f) { return f.status === 'PASS';    });

    var scoreColor = score >= 85 ? '#15803d' : score >= 65 ? '#b45309' : '#b91c1c';

    var findingsRows = (findings || []).map(function (f) {
      return [
        '<tr style="border-bottom:1px solid #e2e8f0;">',
        '  <td style="padding:10px 12px;font-size:12px;color:#1e293b;">' + _esc(f.label) + '</td>',
        '  <td style="padding:10px 12px;text-align:center;">' + _statusBadge(f.status) + '</td>',
        '  <td style="padding:10px 12px;text-align:center;">' + _severityBadge(f.severity) + '</td>',
        '  <td style="padding:10px 12px;font-size:11px;color:#475569;">' + _esc(f.note) + '</td>',
        '  <td style="padding:10px 12px;font-size:11px;color:#64748b;">' + _esc(f.code_section) + '</td>',
        '</tr>'
      ].join('\n');
    }).join('\n');

    var correctionItems = flagged.concat(review).map(function (f, i) {
      return [
        '<div style="margin-bottom:20px;padding:16px;border:1px solid #e2e8f0;border-radius:8px;">',
        '  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">',
        '    <span style="font-weight:700;font-size:13px;color:#1e293b;">' + (i + 1) + '. ' + _esc(f.label) + '</span>',
        '    ' + _statusBadge(f.status),
        '  </div>',
        '  <p style="font-size:12px;color:#475569;margin:0 0 6px 0;"><strong>Issue:</strong> ' + _esc(f.note) + '</p>',
        '  <p style="font-size:12px;color:#64748b;margin:0 0 6px 0;"><strong>Citation:</strong> ' + _esc(f.citation) + '</p>',
        '  <p style="font-size:12px;color:#166534;margin:0;"><strong>Remediation:</strong> ' + _esc(f.remediation) + '</p>',
        '</div>'
      ].join('\n');
    }).join('\n');

    // Escape the summary text first, then apply safe markdown-to-HTML transformations.
    // This prevents XSS from untrusted LLM output: any <script> or HTML in the
    // raw summary becomes &lt;script&gt; after _esc() and is never executed.
    var summaryHtml = _esc(summary || '')
      .replace(/^##\s+(.+)$/gm, '<h2 style="font-size:15px;margin:16px 0 8px;color:#1e293b;">$1</h2>')
      .replace(/^###\s+(.+)$/gm,'<h3 style="font-size:13px;margin:12px 0 6px;color:#1e293b;">$1</h3>')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/^-\s+(.+)$/gm, '<li style="font-size:12px;color:#475569;margin-bottom:4px;">$1</li>')
      .replace(/(&lt;li[^&].*?&lt;\/li&gt;\n?)+/g, '<ul style="margin:8px 0 8px 20px;">$&</ul>')
      .replace(/\n/g,'<br>');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Compliance Report – ${_esc(projectInfo.buildingType)} | Plan-Examiner</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; padding: 0; background: #fff; }
  @page { size: letter; margin: 1in; }
  @media print { .no-print { display: none; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  .page { max-width: 800px; margin: 0 auto; padding: 40px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f8fafc; padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #64748b; border-bottom: 2px solid #e2e8f0; }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:20px;border-bottom:2px solid #0ea5e9;margin-bottom:24px;">
    <div>
      <div style="font-size:22px;font-weight:900;color:#0ea5e9;letter-spacing:-.02em;">Plan<span style="color:#1e293b;">Examiner</span></div>
      <div style="font-size:11px;color:#64748b;margin-top:2px;">Automated Building Code Compliance Report</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#64748b;">
      <div><strong>Generated:</strong> ${_esc(now)}</div>
      <div class="no-print" style="margin-top:2px;"><button onclick="window.print()" style="background:#0ea5e9;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:11px;">🖨️ Print / Save PDF</button></div>
    </div>
  </div>

  <!-- Project info -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">
    <div style="padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Project Type</div>
      <div style="font-weight:700;color:#1e293b;">${_esc(projectInfo.buildingType || 'N/A')}</div>
    </div>
    <div style="padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Applicable Code</div>
      <div style="font-weight:700;color:#1e293b;">${_esc(projectInfo.buildingCode || 'IBC 2021')}</div>
    </div>
    <div style="padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Location</div>
      <div style="font-weight:700;color:#1e293b;">${_esc((projectInfo.city || '') + ', ' + (projectInfo.state || ''))}</div>
    </div>
    <div style="padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">File Reviewed</div>
      <div style="font-weight:700;color:#1e293b;word-break:break-all;">${_esc(projectInfo.fileName || 'N/A')}</div>
    </div>
    <div style="padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Compliance Score</div>
      <div style="font-weight:900;font-size:22px;color:${scoreColor};">${score}/100</div>
    </div>
    <div style="padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Findings</div>
      <div style="font-size:12px;color:#1e293b;">
        <span style="color:#15803d;font-weight:700;">${passed.length} PASS</span> ·
        <span style="color:#b45309;font-weight:700;">${review.length} REVIEW</span> ·
        <span style="color:#b91c1c;font-weight:700;">${flagged.length} FLAGGED</span>
      </div>
    </div>
  </div>

  <!-- Summary -->
  ${summary ? '<div style="margin-bottom:24px;padding:16px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;"><h2 style="font-size:14px;font-weight:700;color:#0c4a6e;margin:0 0 10px;">Review Summary</h2><div style="font-size:12px;line-height:1.6;color:#1e293b;">' + summaryHtml + '</div></div>' : ''}

  <!-- Findings table -->
  <h2 style="font-size:16px;font-weight:700;margin:0 0 12px;">Compliance Findings</h2>
  <table>
    <thead><tr>
      <th>Check</th><th>Status</th><th>Severity</th><th>Finding</th><th>Code Section</th>
    </tr></thead>
    <tbody>${findingsRows}</tbody>
  </table>

  <!-- Corrections section -->
  ${correctionItems ? '<h2 style="font-size:16px;font-weight:700;margin:32px 0 12px;">Correction Items</h2>' + correctionItems : ''}

  <!-- File hash -->
  ${fileHash ? '<div style="margin-top:24px;padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:10px;color:#64748b;">File SHA-256: ' + _esc(fileHash) + '</div>' : ''}

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;">
    <span>© 2026 Plan-Examiner · DaScient · PlanExaminer@dascient.com</span>
    <span>Preview report — subscribe for full redline overlay and official corrections</span>
  </div>
</div>
</body>
</html>`;
  }

  /**
   * Open the compliance report in a new tab and prompt to print/save as PDF.
   * Uses a Blob URL to avoid document.write (which is a XSS vector).
   */
  function printReport(data) {
    var html = buildReportHtml(data);
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var win  = window.open(url, '_blank');
    if (!win) {
      URL.revokeObjectURL(url);
      alert('Pop-up blocked. Please allow pop-ups for this site.');
      return;
    }
    // Revoke object URL after a delay to free memory while still allowing print
    setTimeout(function () { URL.revokeObjectURL(url); win.print(); }, 800);
  }

  /**
   * Download the correction letter as a .md or .txt file.
   */
  function downloadLetter(data) {
    var { projectInfo, findings, correctionLetter } = data;
    var content = correctionLetter || _buildFallbackLetter(projectInfo, findings);
    var blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    var a    = document.createElement('a');
    a.href   = URL.createObjectURL(blob);
    a.download = 'correction-letter-' + (projectInfo.city || 'review').toLowerCase().replace(/\s+/g, '-') + '.md';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 200);
  }

  /**
   * Download findings as a JSON data file.
   */
  function downloadJson(data) {
    var exportData = {
      exported:    new Date().toISOString(),
      project:     data.projectInfo,
      file:        data.fileMeta || (data.fileHash ? { sha256: data.fileHash } : null),
      score:       data.score,
      findings:    data.findings,
      coverage:    data.coverage || null,
      placeholders:data.placeholders || null,
      factsExtracted: data.facts
    };
    var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    var a    = document.createElement('a');
    a.href   = URL.createObjectURL(blob);
    a.download = 'plan-review-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 200);
  }

  function _buildFallbackLetter(projectInfo, findings) {
    var now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    var issues = (findings || []).filter(function (f) { return f.status !== 'PASS'; });
    var lines = [
      '# Plan Correction Letter',
      '',
      '**Date:** ' + now,
      '**Project:** ' + (projectInfo.buildingType || 'N/A'),
      '**Jurisdiction:** ' + (projectInfo.city || '') + ', ' + (projectInfo.state || '') + ', ' + (projectInfo.country || ''),
      '**Applicable Code:** ' + (projectInfo.buildingCode || 'IBC 2021'),
      '**File Reviewed:** ' + (projectInfo.fileName || 'N/A'),
      '',
      '---',
      '',
      'Dear Applicant,',
      '',
      'Plan-Examiner has completed a preliminary review of the above-referenced project. The following corrections are required prior to permit issuance:',
      ''
    ];

    issues.forEach(function (f, i) {
      lines.push((i + 1) + '. **' + f.label + '** [' + f.code_section + ']');
      lines.push('   - **Issue:** ' + f.note);
      lines.push('   - **Remediation:** ' + f.remediation);
      lines.push('');
    });

    lines.push(
      issues.length ? 'Please address all items above and resubmit a complete corrected plan set. Resubmittal must include a response letter addressing each correction item by number.' : 'No corrections are required at this time. Proceed to permit issuance.',
      '',
      'This letter represents an automated preview review. Subscribe to Plan-Examiner for the full review with redline overlay, official correction notice, and direct examiner access.',
      '',
      'Regards,',
      '',
      '**Plan-Examiner Engine**',
      'PlanExaminer@dascient.com',
      '623-850-0991',
      'Glendale, Arizona'
    );

    return lines.join('\n');
  }

  /**
   * Compute SHA-256 hash of an ArrayBuffer (for traceability).
   */
  async function hashFile(arrayBuffer) {
    try {
      var hashBuf = await crypto.subtle.digest('SHA-256', arrayBuffer);
      return Array.from(new Uint8Array(hashBuf)).map(function (b) { return ('00' + b.toString(16)).slice(-2); }).join('');
    } catch (e) { return null; }
  }

  return { printReport: printReport, downloadLetter: downloadLetter, downloadJson: downloadJson, hashFile: hashFile, buildReportHtml: buildReportHtml };

}());

window.PE = PE;
