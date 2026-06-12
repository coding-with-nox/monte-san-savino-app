# SRS — Structural Reference

This is the section-by-section guidance for drafting a Software Requirements Specification (SRS). Use in combination with the starting template in `../assets/srs_template.md`.

The SRS is a **formal commitment document**. It is written only after the Pre-SRS decision gate has been passed (or when requirements are already clearly defined and uncontested). It is the document from which development starts.

---

## What the SRS IS

- The formal statement of Business, Functional and Non-Functional Requirements
- The locked architectural direction
- The requirement traceability baseline
- The contract for acceptance criteria
- A controlled, versioned project artifact

## What the SRS is NOT

- An Execution Plan (no sprint breakdown, no resource allocation, no milestones)
- A detailed technical design (no class diagrams, no database schemas in full, no code)
- A Pre-SRS (no solution exploration, no Go/No-Go — those are settled before the SRS is opened)

---

## Template Philosophy

The SRS template is:

- **Modular** — sections can be omitted if clearly irrelevant
- **Scalable** — scales down for small projects, up for enterprise-grade ones
- **Adaptable** — tailor content to project size, but **preserve section numbering**

**Do not renumber sections** unless strictly necessary. The numbering is the traceability backbone across the organization.

---

## Section Map

### Mandatory sections (always complete)

- **Section 1 — Introduction**
- **Section 2 — Overall Description**
- **Section 3 — System Architecture Overview**
- **Section 5 — Core Modules — Epics, FRs, NFRs**

### Already-completed section (standard content, keep as-is)

- **Section 4 — Requirements Model** — the content of this section is valid for all SRS documents; it clarifies the conventions for business, functional and non-functional requirements with examples. Do not rewrite it per project; reference the organizational standard and keep the section in place.

### Conditional sections (complete only if relevant)

- **Section 6 — Cross-Cutting Non-Functional Requirements** — include only if not centrally governed elsewhere
- **Section 7 — Quality Attributes & Metrics** — for complex or enterprise-grade projects
- **Section 8 — Acceptance Criteria & Readiness**

For smaller or incremental projects, these conditional sections may reference existing organizational standards instead of being redefined from scratch.

---

## Section-by-Section Guidance

### 1. Introduction

- **Purpose** — what this SRS covers
- **Scope** — what is in scope and, crucially, what is out of scope
- **Stakeholders** — sponsor, product owner, technical lead, key business users
- **References** — related Pre-SRS, Architecture & Vision (if any), regulatory references

### 2. Overall Description

- **Product perspective** — where the system fits in the existing landscape
- **User classes / personas** — who uses the system and in what capacity
- **Operating environment** — platforms, channels, constraints
- **Design and implementation constraints** — technology stack, coding standards, regulatory
- **Assumptions and dependencies** — carried over and refined from the Pre-SRS

### 3. System Architecture Overview

This is where the SRS **locks architectural direction** (as opposed to the Pre-SRS, which only explored it).

- Logical architecture (components and responsibilities)
- Integration points with existing systems
- Data flow at a conceptual level
- Technology choices (stack, key platforms)
- Deployment topology (at a high level)

Keep it at architecture level — detailed design belongs elsewhere.

### 4. Requirements Model

**Do not rewrite this section.** It is standardized across the organization and contains the conventions for:

- **Business Requirements (BR-xxx)** — the *why*, the business-level outcomes
- **Functional Requirements (FR-xxx)** — the *what*, concrete capabilities the system must provide
- **Non-Functional Requirements (NFR-xxx)** — the *how well*, measurable qualities (performance, availability, security, usability, maintainability, …)

Keep the section in place with its standard content. Reference it as the canonical definition of identifier conventions used throughout the rest of the document.

### 5. Core Modules — Epics, FRs, NFRs

The heart of the SRS. For each core module / epic of the system:

- **Module description** — one or two paragraphs
- **BR-xxx mapping** — which business requirements this module addresses
- **FR-xxx list** — each requirement uniquely identified, testable, traceable
- **NFR-xxx list** — module-specific non-functional requirements (if any)
- **Dependencies** — on other modules, external systems, data sources

Every requirement must be:

- **Uniquely identified** — BR-001, FR-001, NFR-001 …
- **Testable** — expressed so that pass/fail can be evaluated objectively
- **Traceable** — back to a business objective
- **Aligned with architectural principles**
- **Reviewable** by both technical and business stakeholders

Do not emit requirements with placeholder IDs like `FR-???`. If the ID has to be deferred, leave it as a clearly-marked TODO with the reason.

### 6. Cross-Cutting Non-Functional Requirements (conditional)

Include when NFRs apply system-wide and are not governed by a central standard the project can reference. Typical areas:

- Security and data protection
- Availability and business continuity
- Performance and scalability envelopes
- Observability (logging, monitoring, alerting)
- Auditability and compliance
- Internationalization / localization

If the organization has a central governance doc for these, reference it rather than duplicate.

### 7. Quality Attributes & Metrics (conditional)

For complex or enterprise-grade projects, make quality attributes explicit with metrics:

- Which attribute, which metric, which target threshold
- How the metric is measured
- What happens if it is not met

If you cannot express a metric, you probably do not have a requirement — you have a wish.

### 8. Acceptance Criteria & Readiness (conditional)

- Acceptance criteria at system / module level
- Definition of Done for the initiative
- Readiness checklist (production, operational, support, documentation)
- Sign-off procedure

---

## Traceability and Governance

All requirements defined in the SRS should be:

- **Uniquely identified** (BR-xxx, FR-xxx, NFR-xxx)
- **Testable**
- **Traceable to business objectives**
- **Aligned with architectural principles**
- **Reviewable by technical and business stakeholders**

The SRS is a controlled project artifact and must be **versioned**. Every change after approval should be captured in a change log with rationale and impact.

---

## Tailoring

When starting a new SRS:

1. Duplicate the template (see `../assets/srs_template.md`).
2. Remove clearly irrelevant sections.
3. **Keep numbering consistent** — do not renumber.
4. Maintain traceability identifiers (BR-xxx, FR-xxx, NFR-xxx).
5. Preserve clarity over exhaustiveness.

Use the template as a structured thinking framework, not as a bureaucratic obligation. The goal is clarity, alignment, and traceability — not document inflation.

---

## Common Pitfalls

- **Writing the SRS before the Pre-SRS is settled.** Leads to rework and ambiguity.
- **Skipping identifiers.** Every requirement needs a stable ID from day one — you cannot retrofit traceability cheaply.
- **Untestable requirements.** "The system shall be fast" is not a requirement; "The p95 response time for endpoint X shall be ≤ 500 ms under Y concurrent users" is.
- **Mixing in Execution Plan content.** Sprints, milestones, resource names do not belong in the SRS.
- **Over-specifying design.** The SRS states *what* and *how well*; *how* is design.
- **Renumbering sections.** Breaks cross-document traceability.
