# Contributing to Plan-Examiner

Thank you for your interest in contributing! This document explains how to contribute rule packs, features, bug fixes, and documentation.

## Quick Start

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally: `git clone https://github.com/YOUR_USERNAME/Plan-Examiner.git`
3. **Create a branch**: `git checkout -b feature/irc-rule-pack`
4. **Make your changes** (see below).
5. **Test** manually (see Testing section).
6. **Open a pull request** using the PR template.

---

## Contributing a Rule Pack

Rule packs live in `assets/data/rules/` as versioned JSON files. This is the most impactful contribution you can make.

### Schema

```json
{
  "id": "ibc-2021",
  "name": "International Building Code 2021",
  "version": "2021.1",
  "description": "Short description of the rule pack",
  "rules": [
    {
      "id": "IBC-1005.1",
      "code_section": "IBC 2021 §1005.1",
      "category": "egress",
      "severity": "critical",
      "label": "Egress Component Width",
      "applies_to": ["Commercial", "Institutional"],
      "check_fn_id": "min_corridor_width",
      "parameters": { "min_width_in": 44 },
      "citation": "Full citation text from the code...",
      "remediation": "Step-by-step correction instructions..."
    }
  ]
}
```

### Field Reference

| Field | Required | Description |
|---|---|---|
| `id` | ✅ | Unique rule ID, e.g. `IBC-1005.1` |
| `code_section` | ✅ | Human-readable section reference |
| `category` | ✅ | `egress`, `stairs`, `fire`, `accessibility`, `plumbing`, `structural`, `lighting`, `signage` |
| `severity` | ✅ | `critical`, `high`, `medium`, `low` |
| `label` | ✅ | Short display label |
| `applies_to` | ✅ | Array of building types |
| `check_fn_id` | ✅ | Function ID in `rule-engine.js` |
| `parameters` | ✅ | Parameters passed to the check function |
| `citation` | ✅ | Full code citation text |
| `remediation` | ✅ | Correction instructions |

### Adding a Check Function

If your rule needs a new check function (not already in `rule-engine.js`), add it to the `checks` object:

```js
// In assets/js/agent/rule-engine.js, inside PE.RuleEngine = (function() {
checks.my_new_check = function(facts, params) {
  var value = facts.someExtractedFact || 0;
  if (!value) return { status: 'REVIEW', note: 'Value not found — manual verification required.' };
  if (value < params.min_value) return { status: 'FLAGGED', note: 'Value ' + value + ' is below minimum ' + params.min_value };
  return { status: 'PASS', note: 'Value ' + value + ' meets minimum ' + params.min_value };
};
```

### Register the Rule Pack

Add your pack to `assets/data/rules/index.json`:

```json
{
  "id": "your-pack-id",
  "name": "Display Name",
  "file": "your-pack.json",
  "applies_to_codes": ["2024 IBC", "Local", "Other"]
}
```

---

## Contributing an Extractor

Document extractors live in `assets/js/agent/extractors.js`. The main `extract(file, formData)` function dispatches by file type and returns:

```js
{
  source: 'pdf' | 'dxf' | 'docx' | 'dwg' | 'image' | 'unknown',
  text: '...full text...',
  facts: {
    corridorWidthInches: 44,
    occupancyGroup: 'B',
    // ... other extracted facts
  },
  // Source-specific extras:
  pageCount: 12,           // PDF
  layers: ['WALL','DOOR'], // DXF
  lineCount: 847           // DXF
}
```

---

## Testing

Before opening a PR:

1. **Serve locally**: `npx serve . -p 3000` then open `http://localhost:3000`
2. **Upload a test file**: Use one of the samples in `examples/`
3. **Check the pipeline tab**: All 7 steps should complete
4. **Verify findings**: Flagged/Review/Pass status should be reasonable
5. **Validate JSON**: `python3 -c "import json; json.load(open('assets/data/rules/your-pack.json'))"`

---

## Code Style

- Vanilla JavaScript, no frameworks, no bundler required
- `var` declarations (ES5-compatible for broad browser support)
- Global namespace: `window.PE.ModuleName`
- 2-space indentation
- Single quotes for strings
- Comment complex logic

---

## Code of Conduct

Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

---

## Questions?

Open a [GitHub Discussion](https://github.com/DaScient/Plan-Examiner/discussions) or email PlanExaminer@dascient.com.
