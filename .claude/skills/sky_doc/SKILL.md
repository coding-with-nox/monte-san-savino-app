---
name: sky_doc
description: Use this skill to draft the standard project documentation for a new software initiative — specifically a Pre-SRS (pre-proposal, decision-support document for the client or internal sponsor) and an SRS (Software Requirements Specification, the formal commitment document from which development starts). Trigger whenever the user mentions "Pre-SRS", "SRS", "requirements spec", "project proposal", "client proposal for a software project", "software requirements", "feasibility document", "ROM estimate", "business requirements document", or asks to start documenting a new project, initiative, or feature before development. Use this skill even when the user does not explicitly name the artifact — for example "I need to propose this project to the client", "we need to evaluate this initiative before committing", or "let's formalize the requirements for development". Always prefer this skill over generic document creation skills when the context is software project initiation, scoping, or requirements formalization.
---

# sky_doc — Standard Project Documentation Skill

## 1. Purpose

This skill encodes the **standard documentation approach** for initiating a software project. It produces two artifacts:

1. **Pre-SRS** — a *decision-support* document to propose an initiative to a client (external or internal sponsor). It clarifies the business problem, explores solution options, and provides a Rough Order of Magnitude (ROM) evaluation so a Go / No-Go decision can be taken responsibly.
2. **SRS** — a *formal commitment* document written **only after** the Pre-SRS decision gate is passed. It formalizes Business, Functional and Non-Functional Requirements, locks architectural direction, and defines acceptance criteria. It is the document from which development starts.

The governing principle is:

> **Clarity → Evaluation → Commitment → Execution**
>
> Pre-SRS → SRS → (Execution Plan)

No SRS is written until the Pre-SRS decision gate has been passed. No architecture is locked in the Pre-SRS stage.

The full philosophy behind this approach lives in `references/project_approach.md`. Read it when the user asks *why* the process is structured this way, or when the request is ambiguous between the two artifacts.

---

## 2. Which Document to Produce

Before writing anything, decide which artifact is being requested. Ask the user explicitly if it is not clear — this decision is irreversible in effort terms and getting it wrong wastes significant work.

### Produce a **Pre-SRS** when any of the following are true

- Requirements are still vague, exploratory, or mixed with solution ideas
- Multiple solution paths exist and none is committed
- Business concerns are still entangled with technical pain points
- Financial exposure is significant and no budget envelope exists yet
- Architecture may be impacted but has not been analyzed
- The initiative is strategic and needs executive sign-off before deeper work
- The user says "proposta", "proposal", "feasibility", "valutazione", "ROM", "Go/No-Go", "evaluate if we should do this"

### Produce an **SRS** when all of the following are true

- The Pre-SRS decision gate has been passed (or requirements are already clearly defined and uncontested)
- Business problem is agreed
- A rough evaluation range has already been provided
- Risks have been identified
- The stakeholders want a formal commitment from which development can start
- The user says "SRS", "requisiti", "specifica di progetto", "passiamo allo sviluppo", "FR/NFR", "lock requirements"

### Pre-SRS may be **skipped** only when

- The change is incremental
- Requirements are already clear and uncontested
- No architectural impact is expected
- Financial exposure is low
- No strategic shift is involved

If in doubt, produce the Pre-SRS. The cost of an unnecessary Pre-SRS is always lower than the cost of an SRS written on the wrong assumptions.

### User asking for *both*

If the user asks for both documents in one shot, produce them in order: Pre-SRS first, then SRS. Explicitly mark the hand-off point ("the SRS below assumes the Pre-SRS decision gate has been passed"). Do not duplicate content between the two; the SRS refines what the Pre-SRS framed, it does not repeat it.

---

## 3. Workflow

Follow this sequence every time, regardless of which document is being produced:

### Step 1 — Intent capture

Confirm with the user:

- **Which artifact** (Pre-SRS, SRS, or both)
- **Project / initiative name** and a one-line problem statement
- **Target audience** (external client, internal sponsor, dev team)
- **Output format**: `.docx` (default — these documents are formal deliverables and `.docx` is the reference format in the standard), `.md` (for quick review), or both
- **Any existing material** (emails, meeting notes, previous diagnosis, diagrams) to ground the document

If the user hasn't provided enough context to write meaningful content, ask targeted questions — but do not turn the interview into a requirements-gathering exercise. The objective is to collect enough signal to populate the structure with substance, not to invent content.

### Step 2 — Load the relevant structure reference

- For Pre-SRS → read `references/pre_srs_structure.md`
- For SRS → read `references/srs_structure.md`

These reference files contain the full section-by-section guidance, the traceability ID conventions (BR-xxx / FR-xxx / NFR-xxx), and the evaluation rules that must not be skipped (particularly the mandatory Preliminary Feasibility & Evaluation section of the Pre-SRS).

### Step 3 — Draft in Markdown first

Always draft the document in Markdown, using the corresponding template in `assets/` as a starting point:

- `assets/pre_srs_template.md`
- `assets/srs_template.md`

Markdown is the working format — it's easy to revise iteratively and the user can review structure and content before any binary format is produced. Keep the section numbering exactly as in the template (do not renumber sections unless strictly necessary — numbering is part of the traceability chain).

### Step 4 — Convert to the requested output format

- If the user asked for `.md` only → save the Markdown file to `/sessions/relaxed-tender-euler/mnt/outputs/` and share the link.
- If the user asked for `.docx` (default) → **invoke the `docx` skill** to produce a professionally formatted Word document. Do not hand-roll a `.docx` with raw `python-docx` code; the `docx` skill exists to handle headings, page numbers, tables, styles and letterhead consistently. Pass it the Markdown draft as source content.
- If the user asked for both → produce both and share both links.

### Step 5 — Deliver

Save the final file(s) to `/sessions/relaxed-tender-euler/mnt/outputs/` and provide a `computer://` link. In the final message, briefly state (a) which artifact was produced, (b) which sections remain to be validated or filled in by the user (never invent client-specific content that you cannot know — flag it as TODO instead), and (c) what the next step in the process is (for a Pre-SRS: the decision gate; for an SRS: the Execution Plan).

---

## 4. Non-negotiable Rules

These rules come directly from the standard approach and **must not be relaxed** to please the user. Explain the reason if pushed back on.

1. **No architecture lock in the Pre-SRS.** The Pre-SRS explores solution *directions*. Committing to an architecture at this stage defeats the purpose of the decision gate.
2. **No FR/NFR in the Pre-SRS.** Formal Functional and Non-Functional Requirements belong to the SRS. The Pre-SRS may describe capabilities at a conceptual level but must not assign FR-xxx / NFR-xxx identifiers.
3. **The Pre-SRS evaluation section is mandatory.** A Pre-SRS without a ROM effort estimate and a cost range is not a Pre-SRS — it cannot support a responsible Go / No-Go decision. The evaluation must cover the *total delivery effort*, not only core development (see `references/pre_srs_structure.md` §5).
4. **The SRS requires traceability.** Every requirement must have a unique identifier (BR-xxx, FR-xxx, NFR-xxx), be testable, and be traceable to a business objective. Do not emit an SRS with placeholder IDs like `FR-???`.
5. **No Execution Plan in either document.** Breaking down work into sprints, milestones, and resource allocation is a separate downstream artifact. Keep scope clean.
6. **Preserve section numbering.** The numbering in the templates is the traceability backbone across the organization. Removing irrelevant subsections is fine; renumbering is not.
7. **Flag unknowns as TODO, never invent.** Client names, org charts, existing system names, budget figures, regulatory constraints — if not provided, mark them `[TODO: to be validated with <stakeholder>]`. A plausible lie in a commitment document is far worse than a visible gap.

---

## 5. Rough Order of Magnitude (ROM) — Evaluation Guidance for the Pre-SRS

The evaluation in the Pre-SRS is the single most often-underestimated section. When producing it, the cost/effort range must reflect the **total delivery effort**, not only implementation. Explicitly account for:

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

Present the result as a **bounded range** (±30–40%), not a point estimate. Use a scenario table when multiple solution paths are in play — this helps the sponsor see the financial consequence of each direction. Example:

| Scenario                   | Estimated Cost Range |
|----------------------------|----------------------|
| Reporting enhancement only | €40k–€70k            |
| Integration redesign       | €120k–€200k          |
| Full lifecycle redesign    | €200k+               |

The objective is **financial visibility before commitment**, not precision.

---

## 6. When the User Asks Something Outside This Skill

- **Execution Plan, roadmap, sprint plan, WBS** → This is the artifact *after* the SRS. Tell the user this is out of scope for `sky_doc` and offer to produce it once the SRS is approved.
- **Architecture & Vision document** or **Execution Strategy** → Required only for large strategic initiatives (platform rewrite, multi-tenant strategy shift, etc.). If the user's context suggests one of these, point out that per the standard approach these must precede the Pre-SRS (see `references/project_approach.md` §4).
- **Pure technical design doc, ADR, RFC** → Not covered here; suggest the user produce it as a companion to the SRS rather than inside it.

---

## 7. File Map

```
sky_doc/
├── SKILL.md                          ← this file (workflow & decision logic)
├── references/
│   ├── project_approach.md           ← the underlying philosophy (Clarity → Evaluation → Commitment → Execution)
│   ├── pre_srs_structure.md          ← Pre-SRS section-by-section guidance + evaluation rules
│   └── srs_structure.md              ← SRS section-by-section guidance + traceability conventions
└── assets/
    ├── pre_srs_template.md           ← starting-point Markdown template for Pre-SRS
    └── srs_template.md               ← starting-point Markdown template for SRS
```

Read `references/*` only when needed for the current task (progressive disclosure — don't preload everything).
