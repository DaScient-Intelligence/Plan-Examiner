# Executive Briefing

> **Audience:** C-suite leaders, board members, investors, partner
> executives, and any senior leader who needs to make a *decision* about
> Plan-Examiner — to adopt it, fund it, partner around it, or govern it.
>
> **Format:** A 1-page executive summary, followed by a deep-dive for
> readers who want the next layer.

---

## Section A — One-page executive summary

### What Plan-Examiner is
An **AI-assisted, browser-only** building-plan compliance reviewer. It
reads PDF/DXF/DOCX plans, extracts dimensional facts, evaluates them
against deterministic rule packs (IBC, ADA, NFPA), and emits scored
findings, code citations, and draft correction letters. **Plans never
leave the browser** unless an operator explicitly opts in to an LLM.

### What it isn't
- Not a SaaS — there is no Plan-Examiner backend.
- Not a black-box AI — rule evaluation is deterministic JSON-coded
  thresholds.
- Not a substitute for a licensed reviewer — it is a force multiplier.

### Why it matters now
1. **Cost:** marginal review cost falls dramatically; the bottleneck
   moves from rote checking to true judgment work.
2. **Privacy:** an architecture that *cannot* leak plan data is
   regulatory- and client-friendly by construction.
3. **Auditability:** rule packs are versioned JSON; every finding cites
   the same thresholds; verbose logs prove what ran when.
4. **Strategic optionality:** open source under MIT, license-clean rule
   packs, no vendor lock-in.

### What we ask of you
| Role | What we need |
| --- | --- |
| Adopting org leader | Fund a 90-day pilot per the [pilot plan](#pilot-template) |
| Investor | Fund the next rule-pack roadmap (IRC, Title 24) and trainer cohort |
| Partner exec | Co-author a rule pack for your jurisdiction or specialty |
| Board member | Confirm the [employee-ownership governance model](../07-employee-ownership/governance-bylaws-template.md) |

### Headline KPIs (define & track)
- **Time per review** — minutes wall-clock, before / after.
- **Findings recovery rate** — % of senior-reviewer findings that the
  pipeline already surfaced.
- **Letter rework rate** — fraction of letters edited materially before
  send.
- **Reviewer satisfaction (Net Promoter-style)** — quarterly.
- **Cost per review** — fully loaded (people + LLM tokens).

---

## Section B — Deep dive

### B1. Strategic positioning

Plan-Examiner sits at the intersection of three trends:

1. **Permitting is bottlenecked.** Cities and AHJs face longer queues
   and rising scrutiny; speed-ups are politically valuable.
2. **AI in regulated workflows demands explainability.** Black-box
   models lose to deterministic rule engines whenever a stamp or
   liability is in play.
3. **Privacy-by-architecture is a moat.** Client-side evaluation isn't
   a feature you can replicate by adding "no logging" — it requires the
   architecture from day one.

Our positioning: the **explainable, private, jurisdictionally
extensible** alternative to either pure-LLM tools or legacy on-prem
software.

### B2. Business model options

The technology is open source under MIT. Revenue models compatible with
the codebase, in increasing scope:

| Model | What it sells | Required investment |
| --- | --- | --- |
| Services | Reviews-as-a-service to design firms or AHJs | People, brand |
| Training | Workshops and certifications via [trainer track](../03-trainer/) | Curriculum, trainers |
| Rule-pack stewardship | Maintained, audited rule packs for jurisdictions or codes | Code expertise, legal review |
| Hosted instance | A managed deployment, support, and SLAs | Ops, security |
| Custom partner builds | White-labeled or partner-specific rule packs and integrations | Engineering |

We do **not** plan to monetize plan data. The architecture cannot
support that even if a future executive wanted to.

### B3. Risk register (what could go wrong)

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A rule pack misfires on a real project | Medium | High | Versioning + verbose log + reviewer-in-the-loop are mandatory |
| Code copyright dispute (ICC/NFPA text) | Low | High | We do not redistribute copyrighted code text; see [SOURCING.md](../../../SOURCING.md) |
| LLM provider costs spike | Medium | Medium | LLM is opt-in; deterministic mode is a cost-floor |
| LLM provider data-handling change | Medium | Medium | Bring-your-own-key isolates us from provider terms |
| Open-source forks consume our market | Medium | Low | Trainer + rule-pack stewardship is the moat, not the code |
| A reviewer over-trusts the tool and signs a bad letter | Medium | High | Trainer track + Operator Handbook §4–9 + verbose log reqs |
| Workforce concentration in a narrow demographic | High | Medium | [Hiring playbook §7](../04-onboarding/hiring-team-playbook.md#7-equity-and-inclusion-in-our-hiring) commitments |

### B4. Why employee ownership

We have chosen an **employee-owned** structure (cooperative or
ESOP-equivalent — see [governance template](../07-employee-ownership/governance-bylaws-template.md))
deliberately, because:

1. The work is craft work. Owners do better craft than employees.
2. The privacy promise is more credible when no outside party can demand
   we monetize plan data.
3. The trainer cascade compounds when trainers are owners.
4. Long-term decisions favor durability over exit. Employee ownership
   structurally biases toward this.

This is documented in detail in the [Employee-Ownership Handbook](../07-employee-ownership/employee-ownership-handbook.md).

### B5. KPI definitions (precise)

| KPI | Definition | Target | Cadence |
| --- | --- | --- | --- |
| Time per review | Wall-clock minutes from "Start Review" click to letter sent. | 30-day rolling median; target ↓20% YoY | Weekly |
| Findings recovery | Findings the pipeline emitted that the senior reviewer would have caught manually, ÷ all findings the senior caught. | ≥85% | Monthly |
| Letter rework | Diff size between auto-draft and sent letter. | ≤30% characters changed | Monthly |
| Reviewer satisfaction | "Would you recommend this work to a peer?" (0–10). | NPS-equivalent ≥40 | Quarterly |
| Cost per review | Fully loaded labor + LLM tokens ÷ reviews completed. | Decreasing trend | Quarterly |
| Trainer cascade | New reviewers reaching Level 200 ÷ planned cohort size. | ≥80% | Per cohort |
| Defensible-bug rate | Issues filed where verbose log proves a real misfire ÷ total issues. | Tracked, not targeted | Monthly |

### B6. Pilot template

A 90-day pilot is the cleanest way to evaluate Plan-Examiner inside an
adopting org.

#### Phase 0 — Setup (Week 0)
- Identify pilot sponsor + 2–3 reviewers
- Schedule a Level 100 + Level 200 workshop in the first 10 days
- Pick 3 archetype projects (1 simple, 1 mixed-use, 1 edge case)

#### Phase 1 — Shadow (Weeks 1–4)
- Reviewers run plans in Plan-Examiner **in addition to** their normal
  workflow. Findings are compared, not relied upon.
- Track findings recovery and time-per-review, even though "time" is
  inflated by double-running.

#### Phase 2 — Lead (Weeks 5–8)
- Plan-Examiner becomes the primary path; manual review is the audit
  pass.
- Quality samples by a senior reviewer who is *not* on the pilot team.

#### Phase 3 — Decision (Weeks 9–12)
- Pilot lead presents KPIs against targets.
- Adoption decision: full rollout, extended pilot, or stop.

#### Pilot success criteria
- Findings recovery ≥80%
- Time per review ↓25% from baseline by end of Phase 2
- Reviewer satisfaction ≥ baseline (we are not allowed to make their
  jobs worse)
- Zero defensible quality regressions

### B7. Decision framework for executives

Use the sub-tree below as a decision guide. Every leaf is intentionally
"adopt with conditions" or "don't adopt yet" — never an unqualified
"adopt."

```
  Have you reviewed the privacy architecture?
   ├── No  → return to the README. Do not pre-decide.
   └── Yes → does your workflow tolerate a 30-day shadow phase?
        ├── No  → don't adopt yet; pre-pilot with samples
        └── Yes → do you have a Reviewer II ready to lead the pilot?
             ├── No  → train one first; trainer track exists for this
             └── Yes → run the 90-day pilot
```

---

## Section C — One-paragraph "tell-the-story"

Hand this to the leader who has 60 seconds and an audience.

> "Plan-Examiner is a browser-only AI-assisted compliance reviewer. It
> runs deterministic rule checks on building plans without sending any
> data to a server. The optional LLM is bring-your-own-key. Our team is
> employee-owned, and the rule packs are open source. The play is to
> make plan review faster, cheaper, more consistent, and provably
> private — and to grow by training other people to do the same."

---

## See also
- [Executive Leadership Handbook](executive-leadership-handbook.md)
- [Operations Manual](../06-operations/company-operations-manual.md)
- [Employee-Ownership Handbook](../07-employee-ownership/employee-ownership-handbook.md)
