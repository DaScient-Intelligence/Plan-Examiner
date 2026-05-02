# Contributing to Plan-Examiner

Thank you for your interest in contributing! This document explains how to contribute rule packs, features, bug fixes, and documentation.

> **Looking to contribute training materials?** See the train-the-trainer library at [`docs/training/`](docs/training/README.md). PRs against any of those tracks (foundations, end-user, trainer, onboarding, executive, operations, employee-ownership) are welcome.

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

> **Before you copy any code text from a published source, read [SOURCING.md](SOURCING.md).**
> ICC and NFPA codes are copyrighted; ADA, ABA, OSHA, and FHAG are public domain.
> The wrong choice of source can put a redistributable contribution at legal risk.

### Schema (v3.0.0)

```json
{
  "$schema": "./schema/rule-pack.schema.json",
  "schema_version": "3.0.0",
  "id": "ibc-2021",
  "name": "International Building Code 2021",
  "version": "2021",
  "category": "building",
  "tags": ["egress", "fire"],
  "jurisdiction": { "country": "US", "adopting_body": "varies" },
  "applies_to": ["Commercial", "Residential", "Industrial", "Institutional"],

  "source_authority": "International Code Council (ICC)",
  "source_url": "https://codes.iccsafe.org/content/IBC2021P2",
  "license": "reference-only",
  "copyright_notice": "International Building Code® 2021 © 2021 ICC, Inc. …",
  "effective_date": "2021-01-01",
  "supersedes": [],
  "extends": null,
  "amendments": [],

  "placeholders": {
    "sprinklered": {
      "type": "boolean", "default": false, "label": "Sprinklered (NFPA 13)",
      "description": "Affects allowable height/area, travel distance, etc.",
      "group": "Building"
    }
  },

  "rules": [
    {
      "id": "IBC-1005.1",
      "code_section": "IBC 2021 §1005.1",
      "category": "egress",
      "severity": "critical",
      "label": "Egress Component Width",
      "applies_to": ["Commercial", "Institutional"],
      "check_fn": "min_corridor_width",
      "parameters": { "min_width_in": 44 },
      "parameters_by": {
        "default":           { "min_width_in": 44 },
        "sprinklered.true":  { "min_width_in": 44 },
        "occupancy.B":       { "min_width_in": 44 }
      },
      "applies_when": "facts.stories >= 1",
      "aliases": ["NFPA-7.3"],
      "references": [{ "source": "IBC", "section": "§1005.1", "url": "..." }],
      "evidence_keys": ["corridorWidthInches"],
      "confidence_hint": "high",
      "tags": ["egress"],
      "experimental": false,
      "notes_template": "Required {{params.min_width_in}} in. (found {{facts.corridorWidthInches}}).",
      "citation": "Full citation text or paraphrase…",
      "remediation": "Step-by-step correction instructions…"
    }
  ]
}
```

### Field reference

**Pack envelope** (in addition to v1/v2 fields):

| Field | Required for | Description |
|---|---|---|
| `schema_version` | v3 packs | `"3.0.0"` |
| `category` | optional | One of `building`, `accessibility`, `fire`, `life-safety`, `energy`, `mechanical`, `plumbing`, `residential`, `existing-buildings`, `occupational-safety`, `fair-housing`, `local`. Used by the UI to group packs. |
| `tags` | optional | Free-form tags for filtering |
| `source_authority` | reference-only / cc-by* | Issuing body (ICC, NFPA, U.S. DOJ, U.S. Access Board, OSHA, HUD, …) |
| `source_url` | recommended | Deep link to the official viewer |
| `license` | v3 packs | `public-domain` &#124; `reference-only` &#124; `cc-by` &#124; `cc-by-sa` &#124; `state-law` &#124; `other` |
| `copyright_notice` | reference-only / cc-by* | Plain-language copyright statement |
| `effective_date` | optional | ISO date the code took effect |
| `supersedes` | optional | List of pack ids this version supersedes |
| `extends` | optional | Parent pack id; child rules override parent rules with the same `id`. Use to model state/local amendments without duplicating the parent. |
| `amendments` | optional | Pack ids of overlays |
| `placeholders` | optional | User-overridable variables (sprinklered, construction type, climate zone, …) surfaced in the UI |

**Rule fields** (in addition to v1/v2 fields):

| Field | Description |
|---|---|
| `aliases` | Equivalent rule IDs in other packs. Findings sharing an alias group are deduped and stack their citations. |
| `parameters_by` | Variant table keyed by selector (`default`, `occupancy.A`, `sprinklered.true`, `construction.II-B`, `stories.gte.4`, …). The most-specific selector wins, merged on top of `default`. |
| `applies_when` | Whitelisted boolean expression evaluated against `facts.*` and `placeholders.*` (no `eval`, no globals). Falsy → rule is skipped. |
| `evidence_keys` | Fact keys this rule consumes; powers the "missing evidence" coverage report. |
| `confidence_hint` | `high` / `medium` / `low` — tells the agent how reliable the extractor is for this rule. |
| `experimental` | Don't penalize the score; mark with **EXP** badge in the UI. |
| `disabled` | Skip the rule entirely (also used in child packs to suppress a parent rule). |
| `notes_template` | Mustache-style template (`{{facts.x}}`, `{{params.x}}`, `{{placeholders.x}}`) rendered into the finding's note. |
| `check_fn` | Function id in `rule-engine.js`. Use `"manual"` for stub rules — the engine emits a structured REVIEW item using `notes_template`. |
| `references[]` | `{ source, section, url }` for primary + secondary citations |
| `figures[]` | `{ url, alt, license }` — only use figures from public-domain sources (Access Board, HUD) |
| `tables` | First-class lookup tables (rows of objects with bracketed thresholds) |

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
6. **Validate the pack against the schema and check that all `check_fn` ids exist**:
   `node scripts/validate-rules.mjs`

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
