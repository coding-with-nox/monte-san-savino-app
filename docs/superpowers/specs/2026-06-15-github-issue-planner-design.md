# github-issue-planner Agent — Design Spec

**Date:** 2026-06-15  
**Status:** Approved

---

## 1. Agent Identity

| Field | Value |
|---|---|
| File | `.claude/agents/github-issue-planner.md` |
| Name | `github-issue-planner` |
| Model | `sonnet` |
| Tools | `Bash`, `Read` |
| Role | Thin dispatcher: fetch GitHub issues, let user pick one, hand off to `planner` |

**Description trigger examples:** "pick a GitHub issue", "plan issue", "start from issue", "what issues are assigned to us"

---

## 2. Flow

```
1. Detect repo        → gh repo view --json nameWithOwner
2. Fetch issues       → gh issue list --assignee coding-with-nox --json number,title,labels,state
3. Present list       → numbered menu, ask user to pick
4. Fetch full issue   → gh issue view <number> --json title,body,labels,comments,milestone
5. Hand off           → SendMessage to planner with structured context block
6. Planner takes over → runs standard flow (requirements → arch → plan → PO approval)
```

---

## 3. Planner Handoff Format

When calling `planner` via `SendMessage`, pass:

```
GitHub Issue #<number>
URL: <url>
Title: <title>
Labels: <label1>, <label2>
Milestone: <milestone or none>

## Body
<issue body>

## Comments (if any)
<comment author> — <comment body>
...
```

Planner uses this as the starting requirements brief and runs its standard flow from step 1 (raccolta requisiti).

---

## 4. Error Cases

| Condition | Action |
|---|---|
| `gh` not authenticated | Tell user: run `gh auth login` |
| No issues assigned to `coding-with-nox` | Tell user: no open issues found |
| User picks invalid number | Re-prompt (don't crash) |
| Repo not detected | Tell user: run from inside a git repo |

---

## 5. Constraints

- Single `.md` file under `.claude/agents/`
- No new dependencies
- No scripts outside agent definition
- Does not plan — delegates entirely to existing `planner` agent
- Does not write code

---

## 6. Out of Scope

- Creating/editing GitHub issues
- Filtering by label, milestone, or repo (future)
- Multi-issue batch planning
