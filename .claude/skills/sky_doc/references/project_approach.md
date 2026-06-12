# Standard Project Documentation Approach — Reference

This is the philosophical and governance reference behind the `sky_doc` skill. Read this when:

- The user asks *why* the process is structured this way.
- The request is ambiguous between Pre-SRS and SRS and you need to apply the governance rules.
- A large / strategic initiative is in play and you need to remember what precedes the Pre-SRS.

---

## 1. Core Principle

The documentation lifecycle follows this logic:

**Clarity → Evaluation → Commitment → Execution**

Or, more explicitly:

**Pre-SRS → SRS → Execution Plan**

For large strategic initiatives, additional architectural documentation precedes the Pre-SRS.

The purpose of the whole chain is to:

- Ensure clarity before commitment
- Enforce architectural consistency
- Force financial evaluation before approval
- Preserve traceable requirements
- Enable controlled execution

The process exists to prevent premature implementation and to reduce architectural and financial risk.

---

## 2. Standard Flow for a New Project

### Step 1 — Pre-SRS (Problem Clarification & Evaluation)

Mandatory when:

- Requirements are vague or exploratory
- Multiple solution paths exist
- Business and technical concerns are mixed
- Financial exposure is significant
- Architecture may be impacted

**Purpose:**

- Clarify the real business problem
- Separate facts from hypotheses
- Identify risks and constraints
- Explore solution options
- Provide a Rough Order of Magnitude (ROM) evaluation range
- Enable a Go / No-Go decision

**Output:**

- Problem definition
- High-level solution options
- Risk analysis
- Preliminary effort & cost range
- Decision gate recommendation

No architecture is locked at this stage.

### Step 2 — SRS (Software Requirements Specification)

Written **only after** the Pre-SRS decision gate is passed.

**Purpose:**

- Formalize Business Requirements (BR-xxx)
- Define Functional Requirements (FR-xxx)
- Define measurable Non-Functional Requirements (NFR-xxx)
- Lock architectural direction
- Establish traceability
- Define acceptance criteria

The SRS is a formal commitment document.

### Step 3 — Execution Plan

Produced **only after** the SRS is approved. Out of scope for `sky_doc` but its existence shapes what belongs in the SRS vs. what doesn't.

**Purpose:**

- Break down work into deliverables and milestones
- Estimate effort in detail
- Define resource allocation and delivery phases
- Define risk mitigation plan
- Define CI/CD and operational readiness

---

## 3. Additional Documents for Large Strategic Projects

When the initiative is strategic (platform rewrite, multi-tenant strategy shift, cloud-native direction, long-term architecture evolution, legacy migration), two additional documents precede the Pre-SRS.

### Doc1 — Architecture & Vision

Used when:

- The project impacts long-term architecture
- Modular structure must evolve
- Multi-tenant strategy changes
- Cloud-native direction is involved
- A platform rewrite is considered

**Purpose:** define long-term architectural principles, modular strategy, system boundaries, evolution roadmap, alignment of business and technical vision.

### Doc2 — Execution Strategy (high-level)

Used when:

- The initiative spans multiple phases
- Teams are distributed
- Migration from legacy systems is required
- Incremental rollout is needed

**Purpose:** phased roadmap, transition strategy, coexistence model (legacy vs. new), strategic risk mitigation.

---

## 4. Decision Flow Summary

**Small / incremental project:**
Pre-SRS (optional if requirements are clear) → SRS → Execution Plan

**Medium project:**
Pre-SRS → SRS → Execution Plan

**Large / strategic project:**
Architecture & Vision (Doc1) → Execution Strategy (Doc2) → Pre-SRS → SRS → Execution Plan

---

## 5. When Can the Pre-SRS Be Skipped?

Only when **all** of the following are true:

- The change is incremental
- Requirements are already clearly defined
- No architectural impact is expected
- Financial exposure is low
- No strategic shift is involved

If any of these is uncertain, write the Pre-SRS.

---

## 6. Governance Rules

**No SRS shall be written unless:**

- The business problem is clearly defined
- A rough evaluation range has been provided
- Risks have been identified
- A Go / No-Go decision has been taken

**No Execution Plan shall be written unless:**

- Requirements are formally defined
- Architecture is agreed
- Scope is locked

These rules exist to stop the most common and expensive failure mode: writing a commitment document on top of unstable assumptions.

---

## 7. Practical Screening Questions

When facing a new initiative, ask:

1. Is the business problem clearly understood?
2. Are solution paths multiple or unclear?
3. Is architecture impacted?
4. Is financial exposure relevant?
5. Is this initiative strategic?

If **at least one** answer is "yes", start with a Pre-SRS.

> Clarity before commitment.
> Structure before execution.
> Evaluation before investment.
