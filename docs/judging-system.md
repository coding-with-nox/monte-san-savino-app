# Emperor — Judging System Reference

> **Scope:** Judging workflow only (source guide pages 21–28).
> **Audience:** AI agent / operator assisting a show admin or head judge.
> **Source:** Emperor Event Organisation Software User Guide.

---

## 0. Quick Orientation

The judging lifecycle, in order:

1. **Score** — each judge opens their class home screen (via QR), scores every exhibitor tile.
2. **Complete Phase 1** — judge taps `Judging Complete`; screen polls until all judges finish.
3. **Reconcile Phase 2** *(conditional)* — only if `Max votes per exhibitor per class > 1`; resolve disagreements.
4. **Close class** — admin closes the class (manual; never automatic). Awards are generated at this point.
5. **Override** *(as needed)* — head judge manually corrects flagged errors after closing.
6. **Monitor** — head judge watches live stats throughout (read-only, pre-close only).

**Award generation happens at class close, not at score submission.**

---

## 1. Key Settings That Drive Judging Behaviour

These live in `Editor → Settings`. Judging logic changes depending on them.

| Setting | Effect on judging |
|---|---|
| `Max votes per exhibit` | Number of votes an exhibitor needs to be "judged". `1` = straight decision. `>1` triggers multi-phase judging (Phase 2 reconciling). If a class has **fewer** judges than this value, the system averages the given votes and multiplies up to this value to reach an award. |
| `Voting Delta` | Max allowed difference between scores (when `>1` vote per exhibitor) before the system flags the jury to re-check. See calc in §4. |
| `Can Nominate Single Model` | `0` = judge gives one award to the whole display. `1` = judge may score a single model **or** toggle `Display` to score the whole display. |
| `Minimum Photo Level` | Minimum award value an exhibit must reach to appear on photography lists (not judging-critical, but downstream of awards). |
| `Enable Absence Register` | `1` = jury only sees exhibitors marked present, so judges don't hunt for absent competitors' displays. |

---

## 2. Jury Class Home Screen

**Access:** Each configured judge gets a personal **QR code** that opens *their* class home screen.
**Display:** Anonymised tiles, one per exhibitor display needing a score.

### Behaviour
- **Anonymised on purpose** — prevents bias in judge decisions.
- **Subtractive list** — once an exhibitor is judged, their tile disappears so the judge always sees "what's left".
- **`SHOW ALL` toggle** — re-displays the full list (including already-judged tiles).
- **`Clear` filter** — exhibitor numbers can appear "missing" simply because the filter wasn't cleared. Check this first if tiles seem absent.
- **Re-scoring** — a judge can reopen any previously submitted score and re-enter it at any time.

### Hard constraints (gotchas)
- ⚠️ Judging is possible **only while the class is NOT closed**.
- ⚠️ Missing / incorrect class entries are **not** fixable on the judging screen — require manual admin intervention (see Error Handling section of the full guide).

---

## 3. Jury Score Screen

**Access:** Select an exhibitor tile (or reach it via Emperor when a class override is required).
**Display:** All expected models within that exhibitor's display.

### Behaviour
- Selecting an **already-judged** exhibitor reloads their previously saved scores.
- **Default mode:** pick a score, submit.
- **If `Can Nominate Single Model = 1`:** judge may either select a single model **or** use the `Display` toggle to award the whole display, then submit.
- Submitting **registers the decision in the database** for aggregation at class close.

---

## 4. Phases & Voting Delta Logic

Multi-phase judging exists **only when `Max votes per exhibit > 1`**.

### Phase 1 completion
- Judge taps `Judging Complete` when all tiles scored (screen reads *"All exhibits in class judged"*).
- Screen enters a **polling state** awaiting other judges.
- When **all** judges submit complete, the system *may* present Phase 2 (error reconciling).

### Voting Delta calculation (worked example from guide)
Scenario: votes of `2× Gold + 1× Highly Commended`.
- Actual total score = `4 + 4 + 1 = 9`.
- System reference = top score (`4`) × vote count (`3`) = `12`.
- Difference = `12 − 9 = 3`.
- If `Voting Delta = 2`, then `3 > 2` → system **flags an error** to the jury for re-check.

---

## 5. Jury Error Reconciling (Phase 2)

**Condition:** Appears only if `Max votes per exhibitor per class > 1` **and** judge decisions differ enough that an award can't be calculated.

### Behaviour
- Affected exhibitor tiles show **error icons**, colour-coded by the award each judge gave.
- Example: judge 1 gives exhibitor `50137` bronze, judge 2 gives gold → flagged. Whether this is a true problem depends on event config.
- **Resolution path:** team compares devices and talks it out; selecting an exhibitor reveals what each judge awarded.
- **No consensus →** defer to the **head judge**, who has final say and can override the team (see §7).
- **Done when** all error icons clear.

---

## 6. Monitoring Judging (Head Judge Live View)

**Nav:** `Statistics → Contest Live Statistics`
**Visibility:** Emperor only (not on judge devices).

- One tile per class, auto-refreshing every few moments with judging state + **% complete**.
- Shows per-class award counts → head judge can spot teams that are too harsh / too lenient.
- Top panel = aggregated overall totals across all classes.

### Constraints
- ⚠️ Approximation only — **does NOT reflect head-judge overrides**.
- ⚠️ Irrelevant once classes are closed (monitoring/steering tool only).

---

## 7. Closing Classes

**Nav:** `Lists → Classes And Awards`

### Preconditions
- **Every entry in the class must have a score** before closing.
- For large classes, admins can bulk-assign zero/nothing to unjudged entries first (Error Handling → *Awarding Zeros/Nothing*).
- Closing is **manual** and is the **admin team's** responsibility — never automatic.

### What closing does
- Deactivates the class's jury QR codes (no further judge changes).
- Aggregates judge scores per system settings and writes awards to the correct DB locations.
- Surfaces errors needing immediate attention.

---

## 8. System Overrides (Class Corrections)

**Nav:** `Lists → Classes And Awards`
**When:** No team consensus, manual award needed, or any unforeseen issue.

### Identifying issues
- A class needing attention shows its **`Medal Overrides` button in RED**.
- Blue button + closed = finished, no action.

### Class Corrections screen
- Opened via the **red `Medal Overrides`** button; lists **all** exhibitors in the class.
- **Highlighted rows = errors.** Non-highlighted = finished.
- Clicking a highlighted row shows a red banner explaining the problem.
  - Example message: *"Missing award. No jury submission exists for this exhibitor, they haven't been judged."*
- **`Change` button** → after a confirmation prompt, opens manual award assignment for that exhibitor in that class.
  - This is equivalent to the head judge awarding a medal and is treated as a **complete override**.

---

## 9. Cross-Reference: Error Handling Impact on Judging

From the Error Handling section, but judging-critical:

- ⚠️ Editing an exhibitor's models in a class **clears all existing judge scores** for that exhibitor → must re-score **or** apply a system override.
- ⚠️ Moving an entry into a class that has **already finished** → must re-score there (recall that class's jury) **or** apply a system override.
- ⚠️ No level (Masters/Standard) enforcement on the move screen — operator must move exhibits into an appropriate class manually.

---

## 10. Agent Decision Hints

- **"Tiles missing for a judge"** → first suspect uncleared filter (§2), not a data problem.
- **"Can't change a score"** → class is likely closed (§2 constraint); reopen judging or use override (§8).
- **"Phase 2 not appearing"** → expected if `Max votes per exhibit = 1` (§4/§5).
- **"Live stats don't match final awards"** → expected; stats ignore overrides (§6).
- **"Exhibitor flagged as error / never judged"** → use Class Corrections `Change` to override (§8), or re-engage jury.
- **"Edited a model and scores vanished"** → expected side effect; re-score or override (§9).