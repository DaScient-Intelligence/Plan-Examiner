# Rule Pack Sourcing Policy

> Read this before adding or expanding a rule pack in `assets/data/rules/`.

Plan-Examiner ships rule packs that reference building, accessibility, fire, and life-safety
codes. Some of these underlying documents are **public domain** (federal regulations) and can
be redistributed in full; others are **copyrighted** by private standards-development bodies
(ICC, NFPA) and may **not** be redistributed even when they are freely viewable online.

This document tells contributors which sources fall on which side of that line, and what we
**do** and **do not** copy into the JSON packs.

---

## TL;DR

| Source | Free read-only viewer? | Redistributable? | What we put in our JSON |
|---|---|---|---|
| **ICC** — IBC, IRC, IFC, IEBC, IECC, IMC, IPC, A117.1 (`codes.iccsafe.org`) | Yes (free ICC account) | ❌ Reference-only | Section numbers, titles, numeric facts (thresholds, ratios, distances), our own paraphrased remediation guidance, deep-link to ICC. **Never** the verbatim normative text. |
| **NFPA** — NFPA 1, 13, 72, 80, 101 (`nfpa.org/codes-and-standards`) | Yes (free NFPA Link account) | ❌ Reference-only | Same handling as ICC. |
| **ADA Standards 2010** (`ada.gov`, 28 CFR Part 36 Appendix B/D) | Yes (no account) | ✅ Public domain | Full section text OK, citations, figures from `access-board.gov`. |
| **ABA Standards** (`access-board.gov`) | Yes (no account) | ✅ Public domain | Full section text OK. |
| **OSHA 29 CFR 1910 / 1926** (`osha.gov`) | Yes (no account) | ✅ Public domain | Full section text OK. |
| **HUD Fair Housing Act Design Manual** (`hud.gov`) | Yes (no account) | ✅ Public domain | Full section text OK. |
| **State / municipal codes** as adopted into law | Yes (varies) | ✅ Generally public domain | Cite the state/municipal publication, not ICC. |
| **UpCodes**, code-aggregator sites | Yes | Mixed — their *editorial layer* is theirs; underlying public-law portions are public | Don't scrape. Go to the underlying source. |

> ⚠️ **"Without API credentials" is achievable for ADA / ABA / OSHA / FHAG / state codes.**
> For ICC and NFPA, viewing requires a free account, *and the underlying text is copyrighted*.
> We do not — and contributors must not — circumvent those access controls or paste
> normative prose into our packs.

---

## Why this matters legally

- **Facts are not copyrightable.** *Feist Publications v. Rural Telephone Service*, 499 U.S. 340 (1991).
  A numeric threshold ("32 inches"), a section number ("§1010.1.1"), or a fixture ratio ("1
  per 125") is a fact and may be recorded in our JSON regardless of where we read it.
- **Section text is copyrightable** when authored by a private SDO and not yet adopted by
  reference into law in a way that strips its copyright. ICC and NFPA continue to assert
  copyright in their published codes, including model codes that have been adopted by
  reference into state and municipal law (a position upheld in *American Society for Testing
  and Materials v. Public.Resource.Org*, 896 F.3d 437 (D.C. Cir. 2018), with the practical
  caveat that posting full text for non-commercial educational fair use *may* be
  permissible — but is not litigation-free, and we do not rely on it).
- **U.S. federal works are not copyrightable.** 17 U.S.C. § 105. ADA, ABA, OSHA, and HUD
  publications are works of the U.S. government and are public domain. We can redistribute
  them in full, with attribution.

---

## What you **may** put into a rule pack

Regardless of source, these are always safe:

- The `code_section` reference (e.g., `"IBC 2021 §1010.1.1"`).
- Numeric `parameters` (widths, slopes, ratios, distances, ratings, hours, occupant counts).
- A **paraphrased** `remediation` written in your own words.
- A `label` you author (not copied from the section heading verbatim — close paraphrases of
  short headings are typically OK; transcribing whole headings of every section is not).
- A `source_url` deep-link back to the official viewer.
- Cross-references in `references[]` and `aliases[]`.

For **public-domain sources only** (ADA, ABA, OSHA, FHAG, federal/state regulations as
codified), you may additionally include:

- The full normative text of the cited section in `citation` (a short attribution comment is
  appreciated but not legally required).
- Figures and diagrams hosted by the issuing federal agency (e.g., `access-board.gov`).

## What you **must not** put into a rule pack

- Verbatim normative text from ICC or NFPA codes — even short clauses — except for **brief
  factual quotation** that is unmistakably necessary to convey a numeric requirement
  (typically one sentence, no more). When in doubt, paraphrase.
- Tables transcribed from ICC/NFPA codes that go beyond the numeric facts (e.g., do not copy
  table headings, footnotes, or formatting). The numbers themselves are facts and are fine.
- Figures from ICC/NFPA code commentary or handbooks. Use Access Board figures where you
  need a diagram.
- Content scraped from `codes.iccsafe.org`, `nfpa.org`, `link.nfpa.org`, or aggregator sites
  like UpCodes, beyond the limited factual extracts described above.
- Any content that requires a credential to view, copied past the credential gate. Do not
  use your ICC/NFPA account to mass-export content into the repo.

---

## How packs declare their sourcing

Every rule pack has these envelope fields (introduced in schema v3):

```json
{
  "$schema": "./schema/rule-pack.schema.json",
  "schema_version": "3.0.0",
  "id": "ibc-2021",
  "license": "reference-only",
  "source_authority": "International Code Council (ICC)",
  "source_url": "https://codes.iccsafe.org/content/IBC2021P2",
  "copyright_notice": "International Building Code® 2021 © 2021 International Code Council, Inc. Section numbers and numeric requirements are referenced as facts; no normative text is reproduced."
}
```

Allowed values for `license`:

| Value | Meaning | Required other fields |
|---|---|---|
| `public-domain` | U.S. federal regulation or other public-domain source. Full text OK. | `source_authority`, `source_url` |
| `reference-only` | Copyrighted by an SDO; we capture only facts + citations + paraphrased guidance. | `source_authority`, `source_url`, `copyright_notice` |
| `cc-by` / `cc-by-sa` | Creative-Commons licensed. Attribute and link to license. | `source_authority`, `source_url`, `copyright_notice` |
| `state-law` | Adopted state/municipal code, public record. | `source_authority`, `source_url` |

---

## Reviewer checklist for a new or expanded pack

Before merging a rule-pack PR, the reviewer should confirm:

- [ ] `license` is set, and matches the underlying source.
- [ ] If `license: reference-only`, the pack contains **no** verbatim normative paragraphs
      from the copyrighted code. `citation` fields paraphrase or quote ≤ 1 sentence and only
      where needed for clarity.
- [ ] `source_authority` and `source_url` are filled in.
- [ ] `copyright_notice` is set for any non-public-domain license.
- [ ] No content was scraped from credential-gated viewers.
- [ ] Numeric `parameters` are traceable to the cited section (briefly explain in the PR
      description if a number is computed or summarized).
- [ ] `remediation` text is original prose (paraphrased, not copied).

---

## Practical guidance for ICC packs (IBC, IRC, IFC, etc.)

- Read the section on `codes.iccsafe.org` or in a printed copy you legally own.
- Capture the section number, title (paraphrased if from the public ToC), and numeric
  requirements.
- Write `remediation` in your own words, in the imperative ("Provide …", "Verify …").
- Set `license: "reference-only"` and include the standard `copyright_notice` shown above.

## Practical guidance for NFPA packs

Same as ICC. The `source_url` should be a `link.nfpa.org` deep-link to the section.

## Practical guidance for ADA / OSHA / federal packs

- Pull text from `ada.gov`, `access-board.gov`, `osha.gov`, or `ecfr.gov`.
- `license: "public-domain"`. No `copyright_notice` required (a short attribution is fine).
- You can quote full sections in `citation` without paraphrasing.

---

## Questions

If you are unsure whether content is OK to include, **do not include it**, and ask in a
GitHub Discussion or in the PR review thread before merging.
