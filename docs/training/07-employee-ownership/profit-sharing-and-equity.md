# Profit-Sharing & Equity Guide

> **Audience:** Owners, prospective owners, the finance steward, and
> counsel adapting our model.
>
> **Status:** A description of our operating principles and a worked
> example. **Not legal, tax, or investment advice.** Pair with counsel
> licensed in your jurisdiction.

This guide answers, in order:

1. How profits become profit-sharing distributions
2. How those distributions are allocated among owners
3. How equity is granted, vested, and bought out
4. How we treat tough cases (recessions, departures, removal)

---

## 1. From revenue to distribution

We use the same waterfall every year. The percentages in brackets are
**defaults to be set in the bylaws** when adopted; this guide treats
them as parameters, not commitments.

```
   Revenue
    │
    ▼
   Direct costs (LLM tokens, vendor fees, project-specific costs)
    │
    ▼
   Gross margin
    │
    ▼
   Operating costs (salaries, benefits, infrastructure, training)
    │
    ▼
   Operating profit
    │
    ▼
   Tax provision
    │
    ▼
   Net profit
    │
    ├─▶ Runway floor top-up (until ≥6 months operating cash held)
    │
    ├─▶ Reinvestment   [X%]   (rule packs, training, tooling, scholarships)
    │
    ├─▶ Community contribution   [Y%]   (recipient elected by Owners)
    │
    └─▶ Profit-sharing pool   [Z%]   (distributed to owners — §2 below)
```

> **The runway floor is non-negotiable.** Profit-sharing happens *only*
> after the floor is met. This is a feature, not a bug — it's what
> makes us recession-resilient.

---

## 2. Allocating the profit-sharing pool to owners

We use a **simple, transparent, and patience-rewarding** formula:

### 2.1 The three buckets

The pool is divided into three buckets. The bylaws set the split. A
common default is:

| Bucket | Default share | Rewards |
| --- | --- | --- |
| **Equal** | 40% | Equal partnership: every owner gets the same dollar amount |
| **Salary-weighted** | 40% | Pay-aligned: rewards the level of role you do |
| **Tenure-weighted** | 20% | Long-haul: rewards staying and stewarding the institution |

### 2.2 Bucket math

For a year with profit-sharing pool **P**, **n** owners, total owner
salaries **S**, and tenure-units **T**:

- **Equal share** for owner i: `(0.40 × P) / n`
- **Salary share** for owner i: `(0.40 × P) × (s_i / S)`
- **Tenure share** for owner i: `(0.20 × P) × (t_i / T)`

Where `s_i` is owner i's annualized salary and `t_i` is their tenure
in completed years (capped at the cap defined in §2.3).

### 2.3 Caps and floors

To prevent compounding inequality:

- **Salary cap.** For the salary-weighted bucket, salaries are capped
  at `[2× the median salary]`. An owner earning above the cap is
  treated as if they earned the cap for this calculation.
- **Tenure cap.** Tenure is capped at `[10 years]`. We reward
  stewardship, not seniority hoarding.
- **Owner floor.** No owner receives less than `[the equal share]`
  unless they joined mid-year (pro-rated).

### 2.4 A worked example

Assume:

- Pool **P** = $300,000
- 10 owners (n=10)
- Salaries (annualized, after capping): owners 1–6 each $90,000;
  owners 7–10 each $130,000. **S** = $1,060,000.
- Tenure (capped): owners 1–4 = 5y; owners 5–8 = 3y; owners 9–10 = 1y.
  **T** = 5×4 + 3×4 + 1×2 = 20 + 12 + 2 = **34**.

Bucket A (Equal, $120,000): each owner = $12,000.
Bucket B (Salary, $120,000):
- Each $90k owner: $120,000 × (90,000 / 1,060,000) ≈ $10,189
- Each $130k owner: $120,000 × (130,000 / 1,060,000) ≈ $14,717
Bucket C (Tenure, $60,000):
- Each 5y owner: $60,000 × (5/34) ≈ $8,824
- Each 3y owner: $60,000 × (3/34) ≈ $5,294
- Each 1y owner: $60,000 × (1/34) ≈ $1,765

Owner 1 (junior salary, 5y tenure): 12,000 + 10,189 + 8,824 ≈ **$31,013**
Owner 7 (senior salary, 3y tenure): 12,000 + 14,717 + 5,294 ≈ **$32,011**
Owner 10 (senior salary, 1y tenure): 12,000 + 14,717 + 1,765 ≈ **$28,482**

The spread between most- and least-rewarded is modest — by design.
Plan-Examiner is not a hedge fund.

---

## 3. Equity: grant, vest, buy-out

The form of "equity" depends on the legal vehicle:

| Vehicle | Equivalent of "share" |
| --- | --- |
| Worker cooperative | Membership share |
| Worker-owned LLC | Class-A units |
| ESOP | Allocated ESOP units |
| Employee-ownership trust | Beneficial-interest units |

This guide uses "share" generically. Substitute the appropriate
instrument under counsel.

### 3.1 Grant vs. buy-in

- **Grant model.** Each new owner receives one share at admission,
  with vesting per §3.2.
- **Buy-in model.** Each new owner buys one share at the buy-in
  price defined by the bylaws (typically a nominal amount, e.g.,
  the value of one share at par + an annual capital contribution).

The choice depends on the legal vehicle and tax treatment in your
jurisdiction.

### 3.2 Vesting

A typical schedule:

| Time since admission | Cumulative vested |
| --- | --- |
| 1 year | 25% |
| 2 years | 50% |
| 3 years | 75% |
| 4 years | 100% |

Profit-sharing is paid on **vested** equity only. Unvested portions
are forfeited on departure.

### 3.3 Buy-out on departure

When an owner departs (voluntary or otherwise), their vested equity
is bought back per a published formula. A common, simple formula:

> **Buy-out price = book value per share, evaluated at the most
> recent fiscal year-end, paid over `[3]` annual installments.**

Variations:

- **For-cause removals** may forfeit a fraction (e.g., the most
  recent year's profit-sharing, or a portion of unvested).
  Forfeitures must be defined explicitly in the bylaws and applied
  uniformly.
- **Voluntary departures** receive the full buy-out at the standard
  schedule.
- **Involuntary departures (no cause)** — e.g., layoffs after the
  full Sustainability §2.4 sequence has been exhausted — receive an
  **accelerated** buy-out (e.g., a single payment) on top of any
  severance.

We do **not** punish departures from the company by making the
buy-out arbitrarily punitive. The point of an exit is dignity for
the leaver and durability for those remaining.

---

## 4. Tough cases

### 4.1 Profit is zero or negative
- No profit-sharing distributions for that fiscal year.
- The runway floor is the priority.
- Reinvestment continues at a reduced rate per the
  [Sustainability recession protocol](../06-operations/sustainability-and-stewardship.md#24-recession-behavior).
- Hand-wringing is not a strategy. The finance steward writes a
  one-pager explaining what happened and what we'll do differently.

### 4.2 An owner leaves mid-year
- Profit-sharing for the year is **pro-rated** by months active and
  paid out alongside other owners' distributions at year-end.
- Buy-out begins on the next anniversary of the bylaws-defined
  schedule.
- The owner's seat in the next admission cohort is offered to an
  eligible employee.

### 4.3 An exceptional year
A windfall (a big partner contract, a one-time grant) is **not** fully
distributed. The default treatment:

| Bucket | Share of windfall |
| --- | --- |
| Runway top-up beyond the floor | At least 30% |
| Reinvestment in training/scholarships | At least 30% |
| Profit-sharing pool | Up to 40% |

We resist treating windfalls as a "great year for owners" — they're a
great year for the **institution**, which means rest, training, and
durability.

### 4.4 An owner asks for an early buy-out
Permitted at the Steward Council's discretion, with a discount equal
to the cost of capital (so the institution isn't penalized for
prepaying). Cannot be denied capriciously; cannot be granted in a way
that would breach the runway floor.

### 4.5 New money from outside (loans, grants)
Permitted under tighter conditions per [bylaws Article VI §6.3](governance-bylaws-template.md):

- Loans must be at-arm's-length, with no equity or governance
  conversion rights.
- Grants must be for purposes consistent with our mission (rule-pack
  expansion, scholarships, accessibility work).

Outside *equity* requires supermajority and is, deliberately, very
hard to pass.

---

## 5. Tax notes (read with counsel)

Different vehicles produce very different tax outcomes for owners and
the entity. Three commitments regardless of vehicle:

1. **The entity will produce timely K-1s, W-2s, or 1099s** as required
   by the vehicle and jurisdiction.
2. **The entity will offer at least one annual session with a tax
   professional** to help owners understand their obligations. (Cost
   shared, not pushed onto owners.)
3. **No tax structure will be selected primarily for the benefit of
   founders.** Vehicle choice optimizes for *all* owners, including
   the most recent.

---

## 6. The transparency dashboard

Every quarter, the finance steward publishes (to all owners) a single
dashboard showing:

- Revenue, costs, operating profit, net profit
- Runway in months
- Year-to-date pool projection
- Year-to-date allocation simulation by the §2 formula
- Reinvestment & community-contribution year-to-date

This is the single most important habit of a healthy employee-owned
business. Hiding the numbers is how cooperatives fail. Showing them is
how trust compounds.

---

## 7. The "owner's annual statement"

Each owner receives, in addition to their tax forms:

- Vested vs. unvested equity
- Year's profit-sharing detail (per bucket)
- Tenure credit and salary credit used in the calculation
- Buy-out value at fiscal year-end, in case they wish to plan a future
  departure

This statement should be **boring**. If it is interesting in the
"what happened?" sense, the steward council has communication work to
do.

---

## See also
- [Employee-Ownership Handbook](employee-ownership-handbook.md)
- [Governance & Bylaws Template](governance-bylaws-template.md)
- [Sustainability & Stewardship](../06-operations/sustainability-and-stewardship.md)
- [Operations Manual](../06-operations/company-operations-manual.md)
