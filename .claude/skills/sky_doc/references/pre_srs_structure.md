# Pre-SRS — Structural Reference

This is the section-by-section guidance for drafting a Pre-SRS document. Use in combination with the starting template in `../assets/pre_srs_template.md`.

The Pre-SRS is a **decision-support document**, not a commitment. It exists to let the sponsor take a responsible Go / No-Go decision.

---

## What the Pre-SRS IS

- A structured clarification of the business problem
- A separation of facts from hypotheses
- A high-level exploration of solution directions
- A risk and constraint inventory
- A preliminary feasibility and cost/effort evaluation (ROM)
- A recommendation for the decision gate

## What the Pre-SRS is NOT

- A list of detailed Functional Requirements (FRs)
- A list of measurable Non-Functional Requirements (NFRs)
- An architecture commitment
- An implementation plan
- A budget commitment

The Pre-SRS is a decision-support document. The SRS is the formal commitment document.

---

## Logical Structure

The Pre-SRS follows a strict reasoning path. The order matters: each section provides the input for the next.

### 1. Introduction

Explain, briefly, why this initiative is being analyzed. One or two paragraphs. Do not restate the whole context yet.

### 2. Context and Trigger

Describe the current situation and what triggered the initiative. Typical triggers:

- An operational pain point has become unsustainable
- A new regulatory or compliance obligation
- A commercial opportunity with a time window
- A platform reaching end of life or end of support
- A strategic repositioning

Stick to facts. Reserve interpretation for section 3.

### 3. Business Need Clarification

This is where the Pre-SRS earns its keep. Separate, explicitly:

- **Real objectives** — what the business actually needs to achieve
- **Hypotheses** — what is currently believed but not yet verified
- **Success criteria** — how we will know the initiative has succeeded (qualitative at this stage; measurable criteria belong to the SRS)

If you cannot clearly list hypotheses, you probably have not interviewed enough stakeholders yet.

### 4. Solution Exploration (high level)

Identify the possible approaches without committing to one. Typical patterns:

- Option A — minimal intervention on the existing system
- Option B — targeted redesign of specific modules
- Option C — full redesign / rewrite
- Option D — buy vs. build / third-party solution

For each option, summarize:

- Scope of change
- Principal advantages
- Principal drawbacks
- Architectural impact (qualitative)

**Do not pick a winner yet.** The purpose of the Pre-SRS is to present the trade-offs, not to hide them.

### 5. Risks and Constraints

Document:

- **Risks** — things that could go wrong (technical, organizational, commercial, regulatory)
- **Assumptions** — things we are assuming to be true and on which the evaluation depends
- **Constraints** — non-negotiable boundaries (budget ceilings, deadlines, technologies, partners, regulatory)

Every assumption should be flagged so that, if invalidated later, the Pre-SRS can be revisited.

### 6. Preliminary Feasibility & Evaluation — MANDATORY

Without this section, the Go / No-Go decision cannot be made responsibly. See the dedicated guidance below (§ Evaluation).

### 7. Decision Gate

Conclude with a clear recommendation:

- **Go** — proceed to SRS with option X
- **Go with scope adjustment** — proceed but reduce/expand scope as per recommendation
- **No-Go** — do not proceed; reasons and alternatives
- **Defer** — need more investigation; specify what and how long

---

## The Evaluation Section (§6) — Expanded Guidance

The evaluation must provide **financial visibility before commitment**. It must not be precise — it must be **bounded and honest**.

### 6.1 Rough Order of Magnitude (ROM) effort estimate

Provide a high-level complexity assessment:

- Complexity class: **Low / Medium / High**
- Impacted modules (list)
- New components required (list)
- Estimated time range (e.g., 2–3 months, 4–6 months, 9–12 months)

This is not a commitment. It is a bounded estimate with an explicit tolerance of **±30–40%**.

### 6.2 Cost / effort range — total delivery effort

The most common failure is to estimate only core development and miss cross-cutting work. The evaluation **must** explicitly account for:

- Requirements clarification and refinement
- UX/UI analysis and design
- Development effort
- Testing (unit, integration, system, regression)
- Documentation updates
- Deployment in test and production environments
- Integration with existing systems
- Technical alignment meetings and architecture reviews
- Configuration of application environments and infrastructure
- CI/CD pipeline adjustments
- Initial defect management and stabilization
- Early production rollout support

Underestimating these cross-cutting activities is the #1 cause of unrealistic budgets and missed delivery expectations. **The Pre-SRS evaluation reflects total delivery effort, not only implementation effort.**

### 6.3 Scenario table

When multiple solution options are on the table, present the cost range per scenario. Example:

| Scenario                   | Estimated Cost Range |
|----------------------------|----------------------|
| Reporting enhancement only | €40k–€70k            |
| Integration redesign       | €120k–€200k          |
| Full lifecycle redesign    | €200k+               |

The scenario table lets the sponsor see the financial consequence of each direction without having to extrapolate.

---

## Style and Tone

- **Narrative clarity.** The Pre-SRS reads like a structured reasoning, not a checklist.
- **Avoid prematurely defining requirements.** If you catch yourself writing "FR-001: the system shall...", stop — that belongs in the SRS.
- **Audience.** The Pre-SRS is read by sponsors (technical *and* non-technical). Avoid jargon where a plain-language expression works.
- **Length.** Typically 8–20 pages for a medium project. Longer Pre-SRS are usually a symptom of having crept into SRS territory.

---

## Common Pitfalls

- **Committing to an architecture.** The Pre-SRS narrows the option space; it does not close it.
- **Assigning FR/NFR identifiers.** Leave BR-xxx / FR-xxx / NFR-xxx to the SRS.
- **Skipping the evaluation.** A Pre-SRS without a ROM is not a Pre-SRS.
- **Hiding trade-offs.** Presenting only the preferred option defeats the purpose of the decision gate.
- **Inventing numbers to fill the cost range.** If signal is missing, widen the range or mark assumptions explicitly — do not fabricate precision.
