# Facilitator Guide: Activities & Assessments

> **Audience:** Trainers running a session and looking for ready-to-use
> activities, scripts, exercises, and assessments.
>
> **Use this alongside:** [Workshop Curriculum](workshop-curriculum.md)

---

## Contents

1. [Warm-up activities](#1-warm-up-activities)
2. [Skill-building exercises](#2-skill-building-exercises)
3. [Group activities](#3-group-activities)
4. [Assessment templates](#4-assessment-templates)
5. [30-day check-in survey](#5-30-day-check-in-survey)
6. [Trainer scripts](#6-trainer-scripts)
7. [Materials checklist](#7-materials-checklist)

---

## 1. Warm-up activities

### Activity W1 — "What do you already believe?" (⏱ 8 min)
1. Hand each student two sticky notes.
2. Ask them to write one belief about Plan-Examiner — on the green note
   if they think it's true, on the red note if they think it's false.
3. Stick them on the whiteboard.
4. Read each one aloud. Do not comment.
5. Tell the room you'll revisit them at the end of the session.

This surfaces misconceptions early without putting anyone on the spot.

### Activity W2 — "Demo me, in 90 seconds" (⏱ 5 min)
Pair students. Each pair has 90 seconds to demo Plan-Examiner to the
other, *as if the partner were a customer*. Trainer rings a bell at 90s.

Use this on day 2 of any multi-day workshop to surface what stuck and
what didn't from day 1.

### Activity W3 — "Find the lie" (⏱ 7 min)
Trainer reads three statements about Plan-Examiner. Two are true, one
is subtly false. Students vote. Trainer reveals.

> **Sample set:**
> 1. The rule engine is deterministic. *(true)*
> 2. Vision mode is on by default for any vision-capable model. *(false — three gates)*
> 3. The verbose log redacts API keys at the logger boundary. *(true)*

Have 6–8 sets prepared so you can use this multiple times across a
workshop without repetition.

---

## 2. Skill-building exercises

### Exercise S1 — "The four statuses" (⏱ 20 min)
Each student is given a small contrived findings table with two of each
status (PASS, FAIL, REVIEW, SKIP). They must:
- Highlight which goes in the correction letter and which doesn't.
- For each REVIEW: write a one-line note on what they'd verify before
  promoting or dismissing.
- For each SKIP: write the question they'd ask the design team if they
  suspected the classifier had it wrong.

Then debrief as a group.

### Exercise S2 — "Defend your finding" (⏱ 15 min)
Each student picks one FAIL from a recent review and must defend it
against a "design team" challenge played by the trainer:
- "Where did you get that 44-inch number?"
- "We measured 43.5 — does that pass?"
- "What edition of the code are you citing?"

Goal: students learn to point at **Facts used** and **rule-pack version
footer**, not their memory.

### Exercise S3 — "Vision off, vision on" (⏱ 25 min)
1. Run a vision-eligible plan with vision **off**.
2. Capture findings + verbose log.
3. Run the same plan with vision **on**.
4. Capture findings + verbose log.
5. Diff the two.

Discuss: which findings only emerged in vision mode? Which were available
without it? Where would vision be inappropriate (confidentiality,
budget, latency)?

### Exercise S4 — "Author a rule" (⏱ 45 min, Level 300)
Pick a specific code requirement that isn't yet in the rule pack. Walk
through:
- Schema fields (`id`, `description`, `applies_to`, `applies_when`,
  threshold, citation).
- The fact(s) the rule depends on — and whether they're already
  extracted.
- Write the rule, drop it into the pack, run a test plan, see it fire.
- Open a draft PR (don't merge during the workshop).

This is the single highest-leverage exercise in the entire library.

---

## 3. Group activities

### Activity G1 — "Pipeline charades" (⏱ 10 min)
Students divide into 7 groups, each assigned one pipeline step. Each
group has 90 seconds to act out (no software!) what their step does. The
rest of the room guesses the step.

Surprisingly effective at cementing the mental model.

### Activity G2 — "Worst correction letter" (⏱ 30 min)
Hand the room a deliberately bad auto-generated letter — preserved
verbatim findings, no project header, redundant rows, robotic tone.
In small groups, rewrite it for a real client. Compare across groups.

Discussion question: *which edits were judgment, which were process?*
The judgment edits are why the human reviewer exists.

### Activity G3 — "The privacy tour" (⏱ 15 min)
Open DevTools → Network panel → check **Preserve log**. Run a full
review with the LLM **off**. Walk through every outbound request line by
line. Have students confirm aloud: nothing contains the plan.

Repeat with the LLM **on** and a configured key. Note what changes —
and verify the verbose log redacts the key from any saved `.log` file.

---

## 4. Assessment templates

### A1 — Level 100 verbal check (⏱ 1 min per student)

Ask the student two of these four at random:

1. "Name the 7 pipeline steps in order."
2. "What's the difference between SKIP and REVIEW?"
3. "When does Plan-Examiner send anything outbound?"
4. "Why is vision opt-in?"

Pass = correct on both. Re-do = wrong on either. Document the result in
your trainer log.

### A2 — Level 200 graded review

#### Setup (trainer prep, 15 min before)
- Prepare a fresh sample plan the student has not seen.
- Predetermine the "expected" findings yourself by running it in
  advance. Save your reference findings JSON.

#### Student instructions (30 min, time-boxed)
> "Run the attached plan. Produce four artifacts:
> 1. The findings JSON export.
> 2. A triaged correction letter.
> 3. A saved verbose log.
> 4. A one-paragraph statement explaining any REVIEW-status calls and
>    how you ruled."

#### Trainer rubric

| Criterion | Pass | Fail |
| --- | --- | --- |
| Findings JSON exported | yes | no |
| Letter is sendable to a real client | yes | no |
| Verbose log saved with the run | yes | no |
| REVIEW calls are defensible against the trainer's reference | yes | no |
| FAIL rows match trainer reference (within tolerance) | yes | no |

5/5 → pass. ≤4/5 → re-take after 1 week.

### A3 — Level 300 teaching practicum

Each student delivers a 10-minute Level 100 segment.
Score using the [trainer self-assessment rubric](train-the-trainer-handbook.md#5-trainer-self-assessment-rubric).
Average ≥ 3.0 across the panel = pass.

---

## 5. 30-day check-in survey

Send to every Level 100 / 200 graduate exactly 30 days after their
session. Five questions, one minute each.

> 1. How many real plans have you reviewed with Plan-Examiner since the
>    workshop? (0 / 1–5 / 6–20 / 20+)
> 2. What's one thing you wish the workshop had covered?
> 3. Have you turned on verbose mode for at least one defensible review?
>    (yes/no)
> 4. Have you encountered a finding you couldn't defend? If yes, link
>    the issue.
> 5. Would you take the next level if it were offered tomorrow? (yes/no/maybe)

Track the **0 reviews in 30 days** rate. If >20% of graduates report
zero reviews, the workshop didn't translate to practice — fix the
workshop.

---

## 6. Trainer scripts

### Script — Opening a Level 100
> "Welcome. By the end of the next 90 minutes, you will be able to open
> Plan-Examiner, run a review, and explain to your team in plain English
> what just happened — and why. We will demo together, you will drive,
> and we will end with you teaching it back to me. Questions are always
> welcome. Anything I can't answer goes on the parking lot, and I'll
> answer it before you leave or in writing within a day."

### Script — Closing any session
> "Three things before we go:
> 1. The materials we used are in `docs/training/`. Bookmark them.
> 2. If you find a bug or a doc problem, file an issue. The shortest
>    path from frustration to fix is a GitHub ticket.
> 3. You'll get a 30-day survey. Please answer it. We change the
>    curriculum based on those answers."

### Script — When you don't know the answer
> "Honest answer: I don't know, and I'm going to write it down on the
> parking lot rather than guess. I'll have an answer to you in writing
> by [end of day / Friday]."

This is **always** better than improvising. Trainer credibility lives
or dies here.

---

## 7. Materials checklist

Print this. Tape it inside your trainer kit.

### Always pack
- [ ] Laptop, charged, with the live demo bookmarked
- [ ] Backup laptop or tablet
- [ ] USB stick with sample plans (PDF + DXF + DOCX, one each)
- [ ] Whiteboard markers (4 colors)
- [ ] Sticky notes (red + green + yellow)
- [ ] Printed copies of the [Foundations Primer](../01-foundations/plan-examiner-primer.md) — 1 per student
- [ ] Phone hotspot (Wi-Fi will fail at least once)

### For Level 200+
- [ ] At least one configured LLM key on a designated workshop laptop
- [ ] One pre-prepared "broken" plan (image-only PDF) for graceful-degradation demo
- [ ] One pre-prepared verbose log showing a real failure mode

### For Level 300
- [ ] Cloned repos on all student machines
- [ ] List of "good-first-issue" tickets, printed
- [ ] Schema reference for rule packs, printed
- [ ] Local-server commands (`npx serve` / `python3 -m http.server`) on a card

---

## See also
- [Train-the-Trainer Handbook](train-the-trainer-handbook.md)
- [Workshop Curriculum](workshop-curriculum.md)
- [Operator Handbook](../02-end-user/user-handbook.md)
