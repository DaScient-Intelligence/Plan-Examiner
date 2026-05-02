# Train-the-Trainer Handbook

> **Audience:** Anyone delivering Plan-Examiner training to others —
> internal staff, partner teams, or paying customers.
>
> **Skill prerequisite:** You must have completed the [Operator Handbook](../02-end-user/user-handbook.md)
> and run at least 5 real reviews. You cannot teach what you have not
> internalized.
>
> **Outcome:** After reading this and shadowing one workshop, you can
> deliver Levels 100 & 200 to a new room. Level 300 (mastery) is reserved
> for trainers who have delivered Level 100/200 at least three times.

---

## 1. Why train-the-trainer?

Plan-Examiner is **simple to use and surprisingly easy to misuse**.
A reviewer who runs the pipeline without reading the SKIP rows, or who
treats `PASS` as gospel without spot-checking facts, will produce worse
output than the manual review they replaced. The leverage of training is
massive: one well-trained trainer compounds into dozens of well-trained
reviewers.

We follow a **cascading model**:

```
   Lead Trainer  (delivers + trains other trainers)
        │
        ▼
   Trainer       (delivers Levels 100 & 200)
        │
        ▼
   Reviewer      (Levels 100 & 200 mastered)
        │
        ▼
   New hire      (Level 100 in week one)
```

Every trainer commits to one promotion per quarter — at least one of
their students must complete enough reviews to earn the next level. This
keeps the cascade alive and surfaces trainers who aren't actually
training.

---

## 2. The trainer's three jobs

### Job 1 — Run a workshop that produces working reviewers
Not "people who know about Plan-Examiner." Not "people who have *seen*
a demo." **Working reviewers**, who could sit at their desk on Monday
morning and run a real plan with confidence.

### Job 2 — Surface and address misconceptions
Use the [Common Misconceptions](../01-foundations/plan-examiner-primer.md#6-common-misconceptions-to-correct-early)
list during every workshop. Your students *will* arrive with at least
one of those beliefs. Your job is to interrupt them, not be polite about
them.

### Job 3 — Feed the loop
Every workshop produces:
- Bug reports the trainer files in the repo on the spot.
- Suggested doc improvements (e.g., "Section 4 confused everyone — let's
  rewrite it").
- Names of students who could become trainers themselves.

If a workshop ends with no artifacts in any of those three categories,
either you ran a perfect workshop on a perfect day or — more likely — you
weren't listening hard enough.

---

## 3. The pedagogical model: **See → Try → Teach**

| Phase | Trainer does | Student does |
| --- | --- | --- |
| **See** | Demos a real review end-to-end, narrating decisions. | Watches, asks questions. |
| **Try** | Walks beside as the student runs the same review. | Drives the keyboard. Trainer's hands stay off. |
| **Teach** | Asks the student to explain a step to a peer or back to the trainer. | Verbalizes the model in their own words. |

If a student can't reach **Teach** at the end of a session, you either
spent too long in **See**, intervened too much in **Try**, or the
material was over their head and you must reset.

---

## 4. Workshop logistics

### 4.1 Group size
| Setting | Recommended size |
| --- | --- |
| Hands-on workshop | 4–8 students per trainer |
| Lecture / overview | up to 30 |
| Executive briefing | 1–6 |

Above 8, you cannot watch every screen. Get a co-trainer.

### 4.2 Room and equipment
- One screen per student. Bring-your-own-laptop is fine; pre-flight that
  every laptop can reach the live site.
- One projector or shared screen for the trainer.
- A whiteboard or shared markdown doc for the **parking lot** (questions
  you'll answer later, not now).
- Pre-downloaded sample plans on a USB stick — Wi-Fi will fail at least
  once per workshop and you should not be the reason.

### 4.3 Pre-work for students
Send 24–48 hours ahead:
1. The [Foundations Primer](../01-foundations/plan-examiner-primer.md)
2. A 5-min "what to install before you arrive" list (browser of choice,
   laptop charged, optional: their own LLM key)
3. The sample plan you'll be using

### 4.4 Anti-pattern checklist
- ❌ Don't read slides at students. They can read.
- ❌ Don't run a long demo without student keyboards involved.
- ❌ Don't skip the **Verbose Log** segment — it's the part senior
  reviewers respect most.
- ❌ Don't promise behavior you haven't verified that morning. Software
  changes.

---

## 5. Trainer self-assessment rubric

Score yourself **honestly** after every workshop. 1 = needs work, 5 = nailed it.

| Dimension | 1 | 3 | 5 |
| --- | --- | --- | --- |
| Time discipline | Ran 30+ min long | Ran a few min long | Ended on time with buffer |
| Hands-on ratio | <30% student keyboard time | ~50% | >70% student keyboard time |
| Misconception sweeps | Skipped | Hit some | Hit all five and corrected |
| Verbose-log fluency | Avoided it | Showed it | Used it to debug live |
| Privacy beat | Forgot | Mentioned | Demonstrated and explained |
| Q&A | Defensive | Neutral | Curious and turned questions into doc PRs |
| Artifacts produced | None | One ticket | Tickets + doc PRs + named successor |

Average of 4+ across three workshops → ready to deliver Level 300.

---

## 6. Difficult moments and how to handle them

### "This is overhyped — I can do it faster manually."
Honor the skepticism. Ask them to time-box themselves on the same plan.
Run the pipeline beside them. Whoever produces the better correction
letter in 15 minutes wins. (You'll usually win, but the *quality* of the
discussion is the real prize.)

### "Can I just trust the PASS rows?"
Re-read [Section 4 of the Operator Handbook](../02-end-user/user-handbook.md#4-what-the-four-statuses-really-mean)
together. The answer is: trust them after you've spot-checked the
extraction, never blindly.

### "Your AI will hallucinate citations."
Show them: citations come from the **rule pack JSON**, not from the LLM.
The LLM only writes prose; the citation strings are constants. Open the
JSON file live to prove it.

### "We can't put our plans through any AI."
Demo the **text-only mode with no key configured**. Steps 1–6 still run.
Step 7 produces a deterministic narrative. They get 90% of the value
without a single LLM byte leaving the browser.

### "Everyone's eyes are glazing over."
You went too theoretical. Stop. Ask one student to drive the keyboard
for the next 5 minutes. Movement re-engages the room.

### "A senior reviewer just contradicted me in front of the room."
Thank them out loud, file their correction in the parking lot, move on.
After the workshop, go to them privately, confirm what was right, and
update the materials. Trainer credibility comes from being the person
who is *willing to be corrected*, not the person who is never wrong.

---

## 7. After every workshop

⏱ **30 min, same day:**

- [ ] File any bugs the room surfaced as GitHub issues.
- [ ] Open PRs for any doc improvements the room made obvious.
- [ ] Score yourself with the rubric above.
- [ ] Send each student the 30-day check-in survey (template in the
      [Facilitator Guide](facilitator-guide.md)).
- [ ] Note candidates for the trainer pipeline.

---

## 8. The trainer's promise

Read this aloud at the start of every workshop:

> "I am here to make you a competent Plan-Examiner reviewer by the end
> of this session. I will demo, you will drive, and you will explain
> what you learned back to me before we leave. If something I say turns
> out to be wrong, I will correct it publicly and fix the docs the same
> day. The goal is not for you to like Plan-Examiner. The goal is for
> you to know exactly when to use it, when to trust it, and when to
> override it."

---

## See also
- [Workshop Curriculum (Levels 100/200/300)](workshop-curriculum.md)
- [Facilitator Guide: activities, scripts, assessments](facilitator-guide.md)
- [Operator Handbook](../02-end-user/user-handbook.md)
