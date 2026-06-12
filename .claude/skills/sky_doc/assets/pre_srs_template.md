# Pre-SRS — [Project / Initiative Name]

**Document type:** Pre-SRS (Problem Clarification & Evaluation)
**Status:** Draft / Under review / Approved for decision gate
**Version:** 0.1
**Author(s):** [Name]
**Date:** [YYYY-MM-DD]
**Sponsor / Client:** [Name]

> This is a **decision-support document**, not a commitment. No architecture is locked here; no Functional or Non-Functional Requirement is formally defined. Those belong to the SRS, which is written only after this document's decision gate is passed.

---

## 1. Introduction

[One or two paragraphs explaining why this initiative is being analyzed now. Avoid restating the whole context — that belongs in §2.]

---

## 2. Context and Trigger

### 2.1 Current situation

[Describe the current system / process / organization as it is today. Stick to facts.]

### 2.2 Trigger

[What caused this initiative to be opened now? Examples: operational pain point, regulatory deadline, commercial opportunity, platform end-of-life, strategic repositioning.]

---

## 3. Business Need Clarification

### 3.1 Real objectives

[List the actual business outcomes the sponsor wants. Each bullet is one outcome, stated in business terms.]

- [Outcome 1]
- [Outcome 2]

### 3.2 Hypotheses

[Things currently believed but not yet verified. Every hypothesis is a candidate for later invalidation.]

- [Hypothesis 1 — who holds it, how it could be verified]
- [Hypothesis 2]

### 3.3 Success criteria (qualitative)

[How we will know this initiative has succeeded. Measurable criteria come later in the SRS.]

- [Criterion 1]
- [Criterion 2]

---

## 4. Solution Exploration (high level)

> The purpose of this section is to present trade-offs, not to pick a winner.

### 4.1 Option A — [short label]

- **Scope of change:** [what changes]
- **Advantages:** [key upsides]
- **Drawbacks:** [key downsides]
- **Architectural impact:** [qualitative — low / medium / high, and why]

### 4.2 Option B — [short label]

- **Scope of change:**
- **Advantages:**
- **Drawbacks:**
- **Architectural impact:**

### 4.3 Option C — [short label]

- **Scope of change:**
- **Advantages:**
- **Drawbacks:**
- **Architectural impact:**

[Add / remove options as needed. Buy-vs-build is a valid option.]

---

## 5. Risks and Constraints

### 5.1 Risks

| ID   | Risk                           | Likelihood | Impact | Mitigation direction     |
|------|--------------------------------|-----------:|-------:|--------------------------|
| R-01 | [description]                  | Low/Med/Hi | Low/Med/Hi | [initial mitigation] |
| R-02 |                                |            |        |                          |

### 5.2 Assumptions

- [Assumption 1 — what we are taking as given, and what would invalidate it]
- [Assumption 2]

### 5.3 Constraints

- **Budget:** [ceiling, if any]
- **Deadline:** [external dates]
- **Technology:** [mandatory stack / platforms]
- **Regulatory:** [applicable frameworks]
- **Organizational:** [team, partner, vendor constraints]

---

## 6. Preliminary Feasibility & Evaluation (MANDATORY)

> Without this section the Go / No-Go decision cannot be taken responsibly. The evaluation must reflect **total delivery effort**, not only core development. Tolerance: **±30–40%**.

### 6.1 ROM effort estimate

- **Complexity class:** Low / Medium / High
- **Impacted modules:** [list]
- **New components required:** [list]
- **Estimated time range:** [e.g., 4–6 months]

### 6.2 Activities explicitly included in the estimate

- [ ] Requirements clarification and refinement
- [ ] UX/UI analysis and design
- [ ] Development
- [ ] Testing (unit, integration, system, regression)
- [ ] Documentation updates
- [ ] Deployment in test and production
- [ ] Integration with existing systems
- [ ] Technical alignment meetings and architecture reviews
- [ ] Environment and infrastructure configuration
- [ ] CI/CD pipeline adjustments
- [ ] Initial defect management and stabilization
- [ ] Early production rollout support

### 6.3 Cost range per scenario

| Scenario                    | Estimated Cost Range | Notes                 |
|-----------------------------|----------------------|-----------------------|
| [Option A label]            | €[low]–€[high]       | [key assumptions]     |
| [Option B label]            | €[low]–€[high]       | [key assumptions]     |
| [Option C label]            | €[low]–€[high]       | [key assumptions]     |

> The objective is **financial visibility before commitment**, not precision. Widen the range rather than fabricate precision.

---

## 7. Decision Gate

### 7.1 Recommendation

- [ ] **Go** — proceed to SRS with Option [X]
- [ ] **Go with scope adjustment** — proceed with modified scope [describe]
- [ ] **No-Go** — do not proceed; see alternatives in §7.3
- [ ] **Defer** — further investigation required on [topic], estimated duration [weeks]

### 7.2 Rationale

[Why the recommendation above. Reference the trade-offs from §4, the risks from §5, and the evaluation from §6.]

### 7.3 Alternatives (if No-Go)

[What the sponsor can do instead, if any.]

### 7.4 Next steps

- [ ] Decision gate meeting with [stakeholders] on [date]
- [ ] If Go: open the SRS phase with [owner]
- [ ] [Other follow-ups]

---

## Change log

| Version | Date       | Author | Change                |
|--------:|------------|--------|-----------------------|
| 0.1     | YYYY-MM-DD | [Name] | Initial draft         |
