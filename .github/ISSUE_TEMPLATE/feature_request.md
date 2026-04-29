---
name: Feature Request
about: Suggest a new rule pack, feature, or improvement
title: "[FEATURE] "
labels: ["enhancement"]
assignees: []
---

## Summary
<!-- A clear and concise description of what you want -->

## Problem This Solves
<!-- Describe the problem or use case this feature addresses -->

## Proposed Solution
<!-- Describe the solution you'd like. For rule packs, include: jurisdiction, code edition, and a sample rule JSON. -->

## Rule Pack Submission (if applicable)
If requesting a new rule pack, follow the schema in `assets/data/rules/ibc-2021.json`:
```json
{
  "id": "your-pack-id",
  "name": "Display Name",
  "version": "x.y",
  "rules": [
    {
      "id": "CODE-SECTION",
      "code_section": "Code §Section",
      "category": "egress|stairs|fire|accessibility|plumbing|structural",
      "severity": "critical|high|medium|low",
      "label": "Human-readable label",
      "applies_to": ["Commercial"],
      "check_fn_id": "check_function_name",
      "parameters": {},
      "citation": "Full citation text",
      "remediation": "Remediation instructions"
    }
  ]
}
```

## Alternatives Considered
<!-- What alternatives have you considered? -->

## Additional Context
<!-- Any other context, screenshots, or references -->
